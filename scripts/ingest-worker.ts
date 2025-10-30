#!/usr/bin/env tsx
/**
 * Ingestion Worker for Tidal RAG
 * 
 * Processes ingestion jobs from Bull queue with automatic retry and error handling.
 * Run this in a separate terminal: npm run worker
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as crypto from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { retryWithBackoff } from './retry-utils.js';
import { createIngestionQueue } from './queue-config.js';
import type { Job } from 'bull';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../rag_system/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// Config
const STORAGE_BUCKET = 'tidal-docs';
const CHUNK_SIZE = 1500;           // Increased from 1000 to create fewer chunks
const CHUNK_OVERLAP = 300;         // Increased overlap
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 25;             // Reduced from 100 to reduce database load
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Sanitize content by removing null bytes, invalid Unicode surrogates, and other problematic characters
 * that PostgreSQL text columns cannot handle
 */
function sanitizeContent(content: string): string {
  if (!content) return '';
  
  // First, handle invalid Unicode surrogates (common in PDFs)
  // Remove lone surrogates (high surrogates without low, or low without high)
  let sanitized = content.replace(/[\uD800-\uDFFF]/g, '');
  
  // Remove null bytes and other control characters (except common whitespace)
  sanitized = sanitized
    .replace(/\0/g, '')  // Remove null bytes
    .replace(/\x00/g, '')  // Remove any additional null bytes
    .replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');  // Remove other control chars except \t, \n, \r
  
  // Ensure valid UTF-8 encoding
  try {
    // Re-encode to ensure valid UTF-8
    const buffer = Buffer.from(sanitized, 'utf-8');
    sanitized = buffer.toString('utf-8');
  } catch (e) {
    // If encoding fails, try to recover by removing invalid sequences
    sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');  // Fallback: ASCII only
  }
  
  return sanitized.trim();
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks.length > 0 ? chunks : [text];
}

async function isAlreadyIngested(storagePath: string, hash: string, type: 'prd' | 'design' | 'code'): Promise<boolean> {
  if (type === 'prd') {
    const { data: prd } = await supabase
      .from('prds')
      .select('id, sha256')
      .eq('storage_path', storagePath)
      .maybeSingle();
    
    // If hash doesn't match, need to re-ingest
    if (!prd || prd.sha256 !== hash) {
      return false;
    }
    
    // Hash matches, but check if chunks actually exist
    const { data: chunks } = await supabase
      .from('chunks')
      .select('id')
      .eq('prd_id', prd.id)
      .limit(1);
    
    // If no chunks found, check legacy document_id
    if (!chunks || chunks.length === 0) {
      const { data: legacyChunks } = await supabase
        .from('chunks')
        .select('id')
        .eq('document_id', prd.id)
        .is('prd_id', null)
        .limit(1);
      
      return (legacyChunks && legacyChunks.length > 0);
    }
    
    return true;
  } else {
    const { data: doc } = await supabase
      .from('designs')
      .select('id, sha256')
      .eq('storage_path', storagePath)
      .maybeSingle();
    
    // If hash doesn't match, need to re-ingest
    if (!doc || doc.sha256 !== hash) {
      return false;
    }
    
    // Hash matches, but check if chunks actually exist
    const { data: chunks } = await supabase
      .from('chunks')
      .select('id')
      .eq('document_id', doc.id)
      .limit(1);
    
    return (chunks && chunks.length > 0);
  }
}

async function downloadFile(filePath: string): Promise<string> {
  return retryWithBackoff(
    async () => {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(filePath);

      if (error) {
        throw new Error(`Failed to read file from storage: ${error.message || JSON.stringify(error)}`);
      }

      if (!data) {
        throw new Error(`File exists but has no content: ${filePath}`);
      }

      // Handle PDF files differently
      if (filePath.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`   📄 Parsing PDF file (${buffer.length} bytes)...`);
        
        try {
          // Use pdf-parse for PDF text extraction
          let pdfParse;
          try {
            pdfParse = await import('pdf-parse');
          } catch (importError) {
            console.error(`   ❌ Failed to import pdf-parse module. Make sure you ran 'npm install' in the scripts directory.`);
            throw new Error(`pdf-parse module not found. Install with: npm install pdf-parse`);
          }
          
          const pdfData = await pdfParse.default(buffer);
          
          console.log(`   📊 PDF parsed: ${pdfData.numpages} pages`);
          
          // PDF text can contain invalid Unicode sequences - sanitize immediately
          let pdfText = pdfData.text || '';
          
          console.log(`   📝 Raw PDF text length: ${pdfText.length} characters`);
          
          if (!pdfText || pdfText.trim().length === 0) {
            console.warn(`   ⚠️  PDF appears to be image-based (no extractable text)`);
            console.warn(`   📄 This PDF contains scanned images instead of selectable text.`);
            console.warn(`   💡 To enable OCR for image-based PDFs, you would need to:`);
            console.warn(`      1. Install system dependencies: brew install pkg-config cairo pango libpng jpeg giflib librsvg`);
            console.warn(`      2. Install npm packages: npm install canvas pdfjs-dist tesseract.js`);
            console.warn(`   ❌ This PDF cannot be ingested without OCR. It will be skipped.`);
            throw new Error('PDF is image-based (scanned) and has no extractable text. OCR is not currently configured. To enable OCR, install system dependencies and npm packages.');
          }
          
          // Remove invalid Unicode surrogates (common issue with PDF extraction)
          pdfText = pdfText.replace(/[\uD800-\uDFFF]/g, '');
          
          // Remove other problematic characters
          pdfText = pdfText
            .replace(/\0/g, '')  // Null bytes
            .replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');  // Control chars
          
          // Normalize whitespace (PDFs often have weird spacing) - but preserve newlines for paragraphs
          pdfText = pdfText.replace(/[ \t]+/g, ' ');  // Only normalize spaces/tabs, keep newlines
          pdfText = pdfText.replace(/\n{3,}/g, '\n\n');  // Max 2 consecutive newlines
          pdfText = pdfText.trim();
          
          console.log(`   ✅ Sanitized PDF text length: ${pdfText.length} characters`);
          
          if (!pdfText || pdfText.length === 0) {
            throw new Error('PDF text became empty after sanitization');
          }
          
          return pdfText;
        } catch (pdfError) {
          const errorMsg = pdfError instanceof Error ? pdfError.message : String(pdfError);
          console.error(`   ❌ PDF parsing failed for ${filePath}:`, errorMsg);
          throw new Error(`PDF parsing failed: ${errorMsg}`);
        }
      }

      // For text-based files (txt, md, json, etc.)
      return await data.text();
    },
    3,
    2000,
    `Downloading ${filePath.split('/').pop()}`
  );
}

async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    embeddings.push(...response.data.map(e => e.embedding));

    if (i + BATCH_SIZE < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Increased from 1000 to 3000ms for database recovery
    }
  }

  return embeddings;
}

async function findMatchingImage(filePath: string): Promise<string | null> {
  const dir = path.dirname(filePath);

  try {
    const { data: files, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(dir, {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error || !files) {
      return null;
    }

    for (const file of files) {
      const isImage = IMAGE_EXTENSIONS.some(ext =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (isImage && file.metadata) {
        return `${dir}/${file.name}`;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

function getImagePublicUrl(imagePath: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(imagePath);

  const url = new URL(data.publicUrl);
  const pathParts = url.pathname.split('/').map(part => encodeURIComponent(decodeURIComponent(part)));
  url.pathname = pathParts.join('/');

  return url.toString();
}

async function ingestFile(
  storagePath: string,
  type: 'prd' | 'design' | 'code'
): Promise<{ status: string; chunks: number }> {
  try {
    console.log(`   📥 Downloading file: ${storagePath.split('/').pop()}`);
    let content = await downloadFile(storagePath);
    
    console.log(`   🧹 Sanitizing content (initial length: ${content?.length || 0})...`);
    
    // Sanitize content to remove null bytes and control characters
    content = sanitizeContent(content);

    console.log(`   📏 Content after sanitization: ${content?.length || 0} characters`);

    if (!content || content.trim().length === 0) {
      console.error(`   ❌ Content is empty after sanitization for: ${storagePath}`);
      return { status: 'failed', chunks: 0 };
    }

    const hash = sha256(content);
    console.log(`   🔐 Content hash: ${hash.substring(0, 8)}...`);

    const alreadyIngested = await isAlreadyIngested(storagePath, hash, type);
    if (alreadyIngested) {
      console.log(`   ⏭️  File already ingested (same hash AND has chunks) - skipping`);
      return { status: 'skipped', chunks: 0 };
    } else {
      // Hash matches but no chunks - need to re-ingest
      const { data: existingRecord } = type === 'prd' 
        ? await supabase.from('prds').select('id').eq('storage_path', storagePath).maybeSingle()
        : await supabase.from('designs').select('id').eq('storage_path', storagePath).maybeSingle();
      
      if (existingRecord) {
        console.log(`   🔄 Hash matches but no chunks found - re-ingesting to create chunks`);
      }
    }

    const pathParts = storagePath.split('/');
    const fileName = pathParts.pop()!;
    let title: string;
    let teamName: string | null = null;

    if (type === 'design' && pathParts.length > 1) {
      const categoryFolderName = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : '';
      const cleanCategoryName = categoryFolderName.replace(/_\d+:\d+$/, '');

      if (pathParts.length >= 5 && pathParts[0] === 'designs') {
        teamName = pathParts[1].replace(/_\d+:\d+$/, '');
        title = cleanCategoryName;
      } else {
        const parentFolderName = pathParts[pathParts.length - 2];
        const cleanParentName = parentFolderName.replace(/_\d+:\d+$/, '');
        title = cleanParentName;
      }
    } else if (type === 'prd' && pathParts.length >= 3 && pathParts[0] === 'prds') {
      // Structure: prds/team_name/file_name
      // Extract team_name from pathParts[1] (second segment after 'prds')
      teamName = pathParts[1].replace(/_\d+:\d+$/, '');
      // Use the actual file name (with extension) as file_name
      title = fileName;
    } else if (type === 'code' && pathParts.length >= 2 && pathParts[0] === 'code') {
      // Handle code folder structure: code/ProjectName/folder/file.ts
      if (pathParts.length >= 3) {
        teamName = pathParts[1]; // Project name
        title = fileName; // Keep file name with extension for code files
      } else {
        title = fileName;
      }
    } else {
      title = fileName.replace(/\.(txt|md|json|ts|js|py|go|java|cpp|c|h|rb|php|rs|sh)$/, '');
    }

    const imagePath = await findMatchingImage(storagePath);
    const imageUrl = imagePath ? getImagePublicUrl(imagePath) : null;

    // Extract figma_url from JSON design files (from identifiers.figmaUrl)
    let figmaUrl: string | null = null;
    if (type === 'design' && fileName.endsWith('.json')) {
      try {
        const jsonData = JSON.parse(content);
        figmaUrl = jsonData.identifiers?.figmaUrl || jsonData.figmaUrl || null;
        if (figmaUrl) {
          console.log(`   📎 Extracted Figma URL: ${figmaUrl.substring(0, 80)}...`);
        }
      } catch (e) {
        // Not valid JSON or missing identifiers - skip figma_url extraction
        console.log(`   ⚠️  Could not extract figma_url from JSON: ${fileName}`);
      }
    }

    console.log(`   ✂️  Chunking content...`);
    const chunks = chunkText(content);
    console.log(`   📦 Created ${chunks.length} chunks (avg ${Math.round(content.length / chunks.length)} chars per chunk)`);

    if (chunks.length === 0) {
      console.error(`   ❌ No chunks created for: ${storagePath}`);
      return { status: 'failed', chunks: 0 };
    }

    console.log(`   🧮 Creating embeddings...`);
    const embeddings = await createEmbeddings(chunks);
    console.log(`   ✅ Created ${embeddings.length} embeddings`);

    let docId: string;
    let isPrd = type === 'prd';

    if (isPrd) {
      // Handle PRDs in the prds table
      const { data: existingPrd } = await supabase
        .from('prds')
        .select('id')
        .eq('storage_path', storagePath)
        .maybeSingle();

      if (existingPrd) {
        await supabase
          .from('prds')
          .update({ sha256: hash, file_name: title, team_name: teamName })
          .eq('id', existingPrd.id);

        await supabase
          .from('chunks')
          .delete()
          .eq('prd_id', existingPrd.id);

        docId = existingPrd.id;
      } else {
        const { data: prd, error: prdError } = await supabase
          .from('prds')
          .insert({
            storage_path: storagePath,
            sha256: hash,
            file_name: title,
            team_name: teamName,
          })
          .select('id')
          .single();

        if (prdError) throw prdError;
        docId = prd.id;
      }
    } else {
      // Handle designs/code in the designs table
      const { data: existingDoc } = await supabase
        .from('designs')
        .select('id')
        .eq('storage_path', storagePath)
        .maybeSingle();

      if (existingDoc) {
        await supabase
          .from('designs')
          .update({ sha256: hash, page_name: title, type, image_url: imageUrl, team_name: teamName, figma_url: figmaUrl })
          .eq('id', existingDoc.id);

        await supabase
          .from('chunks')
          .delete()
          .eq('document_id', existingDoc.id);

        docId = existingDoc.id;
      } else {
        const { data: doc, error: docError } = await supabase
          .from('designs')
          .insert({
            storage_path: storagePath,
            sha256: hash,
            type,
            page_name: title,
            image_url: imageUrl,
            team_name: teamName,
            figma_url: figmaUrl,
          })
          .select('id')
          .single();

        if (docError) throw docError;
        docId = doc.id;
      }
    }

    const chunkRows = chunks.map((content, i) => ({
      document_id: isPrd ? null : docId,
      prd_id: isPrd ? docId : null,
      chunk_index: i,
      content,
    }));

    const { data: chunkData, error: chunkError } = await supabase
      .from('chunks')
      .insert(chunkRows)
      .select('id');

    if (chunkError) throw chunkError;

    const embeddingRows = chunkData.map((chunk, i) => ({
      chunk_id: chunk.id,
      embedding: embeddings[i],
    }));

    const { error: embError } = await supabase
      .from('chunk_embeddings')
      .insert(embeddingRows);

    if (embError) throw embError;

    return { status: 'ingested', chunks: chunkData.length };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Ingestion failed: ${error.message}`);
    }
    throw error;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Tidal Ingestion Worker Started');
  console.log('='.repeat(60) + '\n');

  const queue = createIngestionQueue();

  // Process jobs with concurrency of 2 (to avoid overwhelming OpenAI)
  queue.process(2, async (job: Job) => {
    const { storagePath, type, jobIndex, totalJobs } = job.data;

    console.log(`\n📝 [Job ${job.id}] Processing ${jobIndex}/${totalJobs}: ${storagePath}`);
    job.progress(Math.round((jobIndex / totalJobs) * 100));

    try {
      const result = await ingestFile(storagePath, type);
      console.log(`   ✅ ${result.status} - ${result.chunks} chunks`);
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      console.error(`   ❌ Error: ${message}`);
      throw error;
    }
  });

  // Listen to job completion
  queue.on('completed', (job) => {
    console.log(`✨ Job ${job.id} completed`);
  });

  queue.on('progress', (job, progress) => {
    if (progress % 25 === 0) {
      console.log(`   ⏳ Progress: ${progress}%`);
    }
  });

  console.log('🎯 Worker ready - waiting for jobs...\n');
}

main().catch((err) => {
  console.error('💥 Worker error:', err);
  process.exit(1);
});
