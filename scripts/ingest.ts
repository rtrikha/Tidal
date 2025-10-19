#!/usr/bin/env tsx
/**
 * Ingestion Script for Tidal RAG
 * 
 * Uploads files to Supabase Storage, chunks them, creates embeddings,
 * and stores in Postgres. Skips unchanged files using SHA256 hashing.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

// Config
const CHUNK_SIZE = 800; // tokens (approximate)
const CHUNK_OVERLAP = 150;
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims
const BATCH_SIZE = 20; // embeddings per batch

interface FileInfo {
  localPath: string;
  storagePath: string;
  type: 'prd' | 'design';
  title: string;
}

/**
 * Compute SHA256 hash of file content
 */
function sha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Simple text chunker (splits on ~CHUNK_SIZE chars with overlap)
 */
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    if (currentChunk.length + line.length > CHUNK_SIZE * 4) { // ~4 chars/token
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      // Keep overlap
      const words = currentChunk.split(' ');
      currentChunk = words.slice(-CHUNK_OVERLAP).join(' ') + '\n' + line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
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
    .single();
  
  return data?.sha256 === hash;
}

/**
 * Upload file to Supabase Storage
 */
async function uploadFile(localPath: string, storagePath: string): Promise<void> {
  const fileBuffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from('tidal-docs')
    .upload(storagePath, fileBuffer, { upsert: true });
  
  if (error) throw error;
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
      await new Promise(resolve => setTimeout(resolve, 200)); // rate limit
    }
  }
  
  return embeddings;
}

/**
 * Ingest a single file
 */
async function ingestFile(file: FileInfo): Promise<{ status: string; chunks: number }> {
  const hash = sha256(file.localPath);
  
  // Check if already ingested
  if (await isAlreadyIngested(file.storagePath, hash)) {
    return { status: 'skipped', chunks: 0 };
  }
  
  // Upload to Storage
  await uploadFile(file.localPath, file.storagePath);
  
  // Read and chunk
  const content = fs.readFileSync(file.localPath, 'utf-8');
  const chunks = chunkText(content);
  
  // Create embeddings
  const embeddings = await createEmbeddings(chunks);
  
  // Insert document
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      storage_path: file.storagePath,
      sha256: hash,
      type: file.type,
      title: file.title,
    })
    .select('id')
    .single();
  
  if (docError) throw docError;
  
  // Insert chunks
  const chunkRows = chunks.map((content, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content,
  }));
  
  const { data: chunkData, error: chunkError } = await supabase
    .from('chunks')
    .insert(chunkRows)
    .select('id');
  
  if (chunkError) throw chunkError;
  
  // Insert embeddings
  const embeddingRows = chunkData.map((chunk, i) => ({
    chunk_id: chunk.id,
    embedding: embeddings[i],
  }));
  
  const { error: embError } = await supabase
    .from('chunk_embeddings')
    .insert(embeddingRows);
  
  if (embError) throw embError;
  
  return { status: 'ingested', chunks: chunks.length };
}

/**
 * Scan directory and collect files
 */
function scanFiles(baseDir: string, type: 'prd' | 'design'): FileInfo[] {
  const dir = path.join(baseDir, type === 'prd' ? 'prds' : 'designs');
  if (!fs.existsSync(dir)) return [];
  
  const ext = type === 'prd' ? ['.txt', '.md'] : ['.json'];
  const files = fs.readdirSync(dir).filter(f => ext.some(e => f.endsWith(e)));
  
  return files.map(f => ({
    localPath: path.join(dir, f),
    storagePath: `prod/${type}s/${f}`,
    type,
    title: f.replace(/\.(txt|md|json)$/, ''),
  }));
}

/**
 * Main ingestion
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('📥 Tidal RAG Ingestion');
  console.log('='.repeat(60) + '\n');
  
  const dataDir = path.join(__dirname, '../rag_system/data');
  const prdFiles = scanFiles(dataDir, 'prd');
  const designFiles = scanFiles(dataDir, 'design');
  const allFiles = [...prdFiles, ...designFiles];
  
  console.log(`Found ${allFiles.length} files (${prdFiles.length} PRDs, ${designFiles.length} designs)\n`);
  
  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  let totalChunks = 0;
  
  for (const file of allFiles) {
    try {
      process.stdout.write(`Processing ${file.title}...`);
      const result = await ingestFile(file);
      
      if (result.status === 'ingested') {
        console.log(` ✅ ${result.chunks} chunks`);
        ingested++;
        totalChunks += result.chunks;
      } else {
        console.log(` ⏭️  unchanged`);
        skipped++;
      }
    } catch (error) {
      console.log(` ❌ ${error}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`✅ Ingested: ${ingested} files (${totalChunks} chunks)`);
  console.log(`⏭️  Skipped: ${skipped} files`);
  if (failed > 0) console.log(`❌ Failed: ${failed} files`);
  console.log();
}

main().catch(console.error);

