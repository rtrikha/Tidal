#!/usr/bin/env tsx
/**
 * Ingestion Script for Tidal RAG
 * 
 * Reads files from Supabase Storage bucket, chunks them, creates embeddings,
 * and stores in Postgres. Skips unchanged files using SHA256 hashing.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as crypto from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { retryWithBackoff, waitForSupabaseWakeup } from './retry-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from rag_system/.env
dotenv.config({ path: path.join(__dirname, '../rag_system/.env') });

// Load env
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_KEY });

/**
 * Ensure database tables exist with proper schema
 */
async function ensureTablesExist() {
  try {
    // Check if documents table exists
    const { error: docsError } = await supabase
      .from('documents')
      .select('id')
      .limit(1);
    
    if (docsError && docsError.code === 'PGRST116') {
      console.log('❌ Documents table does not exist - please set up your database schema first');
      process.exit(1);
    }
    
    // Check if chunks table exists
    const { error: chunksError } = await supabase
      .from('chunks')
      .select('id')
      .limit(1);
    
    if (chunksError && chunksError.code === 'PGRST116') {
      console.log('❌ Chunks table does not exist - please set up your database schema first');
      process.exit(1);
    }
  } catch (err) {
    console.log('ℹ️  Skipping table validation (tables may need manual setup)');
  }
}

// Config
const STORAGE_BUCKET = 'tidal-docs';
const CHUNK_SIZE = 1000; // characters (approximate)
const CHUNK_OVERLAP = 200;
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims
const BATCH_SIZE = 100; // embeddings per batch

/**
 * Compute SHA256 hash of text content
 */
// Image extensions to look for
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Simple text chunker with overlap
 */
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

/**
 * Check if file already ingested with same hash
 */
async function isAlreadyIngested(storagePath: string, hash: string): Promise<boolean> {
  const { data } = await supabase
    .from('documents')
    .select('sha256')
    .eq('storage_path', storagePath)
    .maybeSingle();
  
  return data?.sha256 === hash;
}

/**
 * Recursively list all files in Supabase Storage
 */
async function listStorageFilesRecursive(folderPath: string = ''): Promise<string[]> {
  console.log(`  🔍 Scanning: ${folderPath || 'root'}`);
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(folderPath, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    });
  
  if (error) {
    console.error(`  ❌ Error listing ${folderPath}:`, error);
    return [];
  }
  
  if (!data || data.length === 0) {
    console.log(`  📭 Empty: ${folderPath}`);
    return [];
  }
  
  const files: string[] = [];
  
  for (const item of data) {
    const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;
    
    // Check if it's a file or folder
    const hasMetadata = item.metadata !== null && typeof item.metadata === 'object';
    const hasFileExtension = item.name.match(/\.(txt|md|json)$/i);
    
    if (!hasMetadata || item.id === null) {
      // Likely a folder, recurse
      console.log(`  📁 Folder: ${item.name}`);
      const subFiles = await listStorageFilesRecursive(itemPath);
      files.push(...subFiles);
    } else if (hasFileExtension) {
      // It's a file with proper extension
      console.log(`  📄 File: ${item.name}`);
      files.push(itemPath);
    }
  }
  
  return files;
}

/**
 * Download file content from Supabase Storage with retry
 */
/**
 * Find ANY image file in the same folder as the JSON/text file
 * This is more flexible and works with any naming convention
 */
async function findMatchingImage(filePath: string): Promise<string | null> {
  const dir = path.dirname(filePath);
  
  try {
    // List all files in the same folder
    const { data: files, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(dir, {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (error || !files) {
      return null;
    }
    
    // Find the first image file in the folder
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

/**
 * Get public URL for an image in storage
 * Properly encodes the path to handle special characters like colons
 */
function getImagePublicUrl(imagePath: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(imagePath);
  
  // The URL might contain unencoded colons and other special chars
  // Split by slashes, encode each part, then rejoin
  const url = new URL(data.publicUrl);
  const pathParts = url.pathname.split('/').map(part => encodeURIComponent(decodeURIComponent(part)));
  url.pathname = pathParts.join('/');
  
  return url.toString();
}

async function downloadFile(path: string): Promise<string> {
  return retryWithBackoff(
    async () => {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(path);
      
      if (error) {
        throw new Error(`Failed to read file from storage: ${error.message || JSON.stringify(error)}`);
      }
      
      if (!data) {
        throw new Error(`File exists but has no content: ${path}`);
      }
      
      return await data.text();
    },
    3,
    2000,
    `Downloading ${path.split('/').pop()}`
  );
}

/**
 * Create embeddings in batches
 */
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
      await new Promise(resolve => setTimeout(resolve, 1000)); // rate limit
    }
  }
  
  return embeddings;
}

/**
 * Ingest a single file from Supabase Storage
 */
async function ingestFileFromStorage(
  storagePath: string,
  type: 'prd' | 'design'
): Promise<{ status: string; chunks: number }> {
  try {
    // Read content from Supabase Storage (temporary download to memory)
    const content = await downloadFile(storagePath);
    
    if (!content || content.trim().length === 0) {
      console.error(`\n  ⚠️  File is empty or invalid`);
      return { status: 'failed', chunks: 0 };
    }
    
    const hash = sha256(content);
    
    // Check if already ingested with same hash
    if (await isAlreadyIngested(storagePath, hash)) {
      return { status: 'skipped', chunks: 0 };
    }
    
    // Extract title, team_name and page from FOLDER structure
    // This avoids duplicates like "button.json" and "button.png" 
    const pathParts = storagePath.split('/');
    const fileName = pathParts.pop()!;
    let title: string;
    let teamName: string | null = null;
    
    if (type === 'design' && pathParts.length > 1) {
      // page_name (documents) = 2 levels back from file (category)
      // Example: .../Buttons_Counter/counter_buttons_34374:99994/data.json
      //          page_name = Buttons_Counter
      
      // 2 levels back from file = page_name (category)
      const categoryFolderName = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : '';
      const cleanCategoryName = categoryFolderName.replace(/_\d+:\d+$/, '');
      
      // Check if we have a team name (5+ parts means team folder exists)
      if (pathParts.length >= 5 && pathParts[0] === 'designs') {
        teamName = pathParts[1].replace(/_\d+:\d+$/, ''); // Team name
        title = cleanCategoryName; // 2 levels back = category (e.g., Buttons_Counter)
        
        console.log(`     📁 Design hierarchy with team detected:`);
        console.log(`        Team: ${teamName}`);
        console.log(`        Document: ${title}`);
        console.log(`        Full path: ${storagePath}`);
      } else {
        // Structure: designs/ProjectName/ScreenName (no team folder)
        const parentFolderName = pathParts[pathParts.length - 2];
        const cleanParentName = parentFolderName.replace(/_\d+:\d+$/, '');
        title = cleanParentName;
        
        console.log(`     📁 Design hierarchy detected:`);
        console.log(`        Document: ${title}`);
      }
    } else if (type === 'prd' && pathParts.length >= 3 && pathParts[0] === 'prds') {
      // Support team structure for PRDs too: prds/TeamName/file.txt
      if (pathParts.length >= 3) {
        teamName = pathParts[1].replace(/_\d+:\d+$/, '');
        title = fileName.replace(/\.(txt|md|json)$/, '');
        
        console.log(`     📁 PRD with team detected:`);
        console.log(`        Team: ${teamName}`);
        console.log(`        Document: ${title}`);
      } else {
        title = fileName.replace(/\.(txt|md|json)$/, '');
      }
    } else {
      // Use filename for simple structures
      title = fileName.replace(/\.(txt|md|json)$/, '');
    }
    
    // Look for matching image
    const imagePath = await findMatchingImage(storagePath);
    const imageUrl = imagePath ? getImagePublicUrl(imagePath) : null;
    
    if (imagePath) {
      console.log(`  🖼️  Found screenshot: ${path.basename(imagePath)}`);
    }
    
    // Chunk content
    const chunks = chunkText(content);
    
    // Create embeddings
    const embeddings = await createEmbeddings(chunks);
    
    // Check if document exists (update) or create new
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('storage_path', storagePath)
      .maybeSingle();
    
    let docId: string;
    
    if (existingDoc) {
      // Update existing document
      await supabase
        .from('documents')
        .update({ sha256: hash, page_name: title, type, image_url: imageUrl, team_name: teamName })
        .eq('id', existingDoc.id);
      
      // Delete old chunks
      await supabase
        .from('chunks')
        .delete()
        .eq('document_id', existingDoc.id);
      
      docId = existingDoc.id;
    } else {
      // Insert new document
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          storage_path: storagePath,
          sha256: hash,
          type,
          page_name: title,
          image_url: imageUrl,
          team_name: teamName,
        })
        .select('id')
        .single();
      
      if (docError) throw docError;
      docId = doc.id;
    }
    
    // Insert chunks directly to document (no page_id)
    console.log(`     📄 Inserting ${chunks.length} chunks...`);
    const chunkRows = chunks.map((content, i) => ({
      document_id: docId,
      chunk_index: i,
      content,
    }));
    
    const { data: chunkData, error: chunkError } = await supabase
      .from('chunks')
      .insert(chunkRows)
      .select('id');
    
    if (chunkError) throw chunkError;
    
    console.log(`     ✅ Created ${chunkData.length} chunks`);
    
    // Insert embeddings
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
      console.error(`\n  ❌ Error: ${error.message}`);
      console.error(`  Stack: ${error.stack?.split('\n')[1]?.trim()}`);
    } else {
      console.error(`\n  ❌ Error: ${JSON.stringify(error, null, 2)}`);
    }
    return { status: 'failed', chunks: 0 };
  }
}

/**
 * Main ingestion
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('📥 Tidal RAG - Ingesting from Supabase Storage');
  console.log('='.repeat(60) + '\n');
  
  console.log(`📦 Storage bucket: ${STORAGE_BUCKET}\n`);
  
  // Wait for Supabase to wake up if needed
  const isAwake = await waitForSupabaseWakeup(supabase);
  if (!isAwake) {
    console.error('❌ Could not connect to Supabase. Please check your connection and try again.\n');
    process.exit(1);
  }

  // Ensure database tables exist
  await ensureTablesExist();
  
  // List files in storage recursively
  console.log('🔍 Scanning Supabase Storage...\n');
  const prdFiles = await listStorageFilesRecursive('prds');
  const designFiles = await listStorageFilesRecursive('designs');
  
  console.log(`\n✅ Found ${prdFiles.length + designFiles.length} files (${prdFiles.length} PRDs, ${designFiles.length} designs)\n`);
  
  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  let totalChunks = 0;
  
  // Process PRDs
  for (const file of prdFiles) {
    const fileName = file.split('/').pop()!;
    process.stdout.write(`Processing ${fileName}...`);
    const result = await ingestFileFromStorage(file, 'prd');
    
    if (result.status === 'ingested') {
      console.log(` ✅ ${result.chunks} chunks`);
      ingested++;
      totalChunks += result.chunks;
    } else if (result.status === 'skipped') {
      console.log(` ⏭️  unchanged`);
      skipped++;
    } else {
      console.log(` ❌ failed`);
      failed++;
    }
  }
  
  // Process designs
  for (const file of designFiles) {
    const fileName = file.split('/').pop()!;
    process.stdout.write(`Processing ${fileName}...`);
    const result = await ingestFileFromStorage(file, 'design');
    
    if (result.status === 'ingested') {
      console.log(` ✅ ${result.chunks} chunks`);
      ingested++;
      totalChunks += result.chunks;
    } else if (result.status === 'skipped') {
      console.log(` ⏭️  unchanged`);
      skipped++;
    } else {
      console.log(` ❌ failed`);
      failed++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`✅ Ingested: ${ingested} files (${totalChunks} chunks)`);
  console.log(`⏭️  Skipped: ${skipped} files`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed} files`);
  }
  console.log();
}

main().catch(console.error);

