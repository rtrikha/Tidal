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

async function isAlreadyIngested(storagePath: string, hash: string): Promise<boolean> {
  const { data } = await supabase
    .from('documents')
    .select('sha256')
    .eq('storage_path', storagePath)
    .maybeSingle();

  return data?.sha256 === hash;
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
    const content = await downloadFile(storagePath);

    if (!content || content.trim().length === 0) {
      return { status: 'failed', chunks: 0 };
    }

    const hash = sha256(content);

    if (await isAlreadyIngested(storagePath, hash)) {
      return { status: 'skipped', chunks: 0 };
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
      if (pathParts.length >= 3) {
        teamName = pathParts[1].replace(/_\d+:\d+$/, '');
        title = fileName.replace(/\.(txt|md|json)$/, '');
      } else {
        title = fileName.replace(/\.(txt|md|json)$/, '');
      }
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

    const chunks = chunkText(content);
    const embeddings = await createEmbeddings(chunks);

    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('storage_path', storagePath)
      .maybeSingle();

    let docId: string;

    if (existingDoc) {
      await supabase
        .from('documents')
        .update({ sha256: hash, page_name: title, type, image_url: imageUrl, team_name: teamName })
        .eq('id', existingDoc.id);

      await supabase
        .from('chunks')
        .delete()
        .eq('document_id', existingDoc.id);

      docId = existingDoc.id;
    } else {
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
