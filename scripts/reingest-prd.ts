#!/usr/bin/env tsx
/**
 * Re-ingest a specific PRD file
 * Usage: npx tsx reingest-prd.ts <storage_path>
 * Example: npx tsx reingest-prd.ts "prds/cPlus/Auto-Checked Food Subscription Trial Results.txt"
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as crypto from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { retryWithBackoff } from './retry-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const STORAGE_BUCKET = 'tidal-docs';
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 300;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 25;

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

async function downloadFile(filePath: string): Promise<string> {
  return retryWithBackoff(
    async () => {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(filePath);

      if (error) {
        throw new Error(`Failed to read file: ${error.message}`);
      }

      if (!data) {
        throw new Error(`File exists but has no content: ${filePath}`);
      }

      return await data.text();
    },
    3,
    2000,
    `Downloading ${filePath}`
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return embeddings;
}

async function reingestPRD(storagePath: string) {
  console.log(`\n📥 Re-ingesting PRD: ${storagePath}\n`);

  try {
    // Download file
    console.log('📥 Downloading file...');
    const content = await downloadFile(storagePath);
    console.log(`✅ Downloaded ${content.length} characters\n`);

    // Parse path to get title and team
    const pathParts = storagePath.split('/');
    const fileName = pathParts.pop()!;
    let title: string;
    let teamName: string | null = null;

    if (pathParts.length >= 3 && pathParts[0] === 'prds') {
      // Structure: prds/team_name/file_name
      // Extract team_name from pathParts[1] (second segment after 'prds')
      teamName = pathParts[1].replace(/_\d+:\d+$/, '');
      // Use the actual file name (with extension) as file_name
      title = fileName;
    } else {
      title = fileName;
    }

    console.log(`📝 Title: ${title}`);
    if (teamName) console.log(`👥 Team: ${teamName}`);
    console.log();

    // Hash content
    const hash = sha256(content);
    console.log(`🔐 Hash: ${hash.substring(0, 8)}...\n`);

    // Chunk content
    console.log('✂️  Chunking content...');
    const chunks = chunkText(content);
    console.log(`✅ Created ${chunks.length} chunks\n`);

    if (chunks.length === 0) {
      console.error('❌ No chunks created');
      return;
    }

    // Create embeddings
    console.log('🧮 Creating embeddings...');
    const embeddings = await createEmbeddings(chunks);
    console.log(`✅ Created ${embeddings.length} embeddings\n`);

    // Find or create PRD record
    const { data: existingPrd } = await supabase
      .from('prds')
      .select('id')
      .eq('storage_path', storagePath)
      .maybeSingle();

    let prdId: string;

    if (existingPrd) {
      console.log('📝 Updating existing PRD record...');
      await supabase
        .from('prds')
        .update({ sha256: hash, file_name: title, team_name: teamName })
        .eq('id', existingPrd.id);

      // Delete old chunks (check both prd_id and document_id for legacy chunks)
      await supabase
        .from('chunks')
        .delete()
        .eq('prd_id', existingPrd.id);
      
      // Also delete any legacy chunks linked via document_id
      await supabase
        .from('chunks')
        .delete()
        .eq('document_id', existingPrd.id);

      prdId = existingPrd.id;
      console.log(`✅ Updated PRD: ${prdId}\n`);
    } else {
      console.log('📝 Creating new PRD record...');
      const { data: newPrd, error: prdError } = await supabase
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
      prdId = newPrd.id;
      console.log(`✅ Created PRD: ${prdId}\n`);
    }

    // Insert chunks with prd_id
    console.log('📄 Inserting chunks...');
    const chunkRows = chunks.map((content, i) => ({
      document_id: null,
      prd_id: prdId,
      chunk_index: i,
      content,
    }));

    const { data: chunkData, error: chunkError } = await supabase
      .from('chunks')
      .insert(chunkRows)
      .select('id');

    if (chunkError) throw chunkError;
    console.log(`✅ Created ${chunkData.length} chunks\n`);

    // Insert embeddings
    console.log('💾 Inserting embeddings...');
    const embeddingRows = chunkData.map((chunk, i) => ({
      chunk_id: chunk.id,
      embedding: embeddings[i],
    }));

    const { error: embError } = await supabase
      .from('chunk_embeddings')
      .insert(embeddingRows);

    if (embError) throw embError;
    console.log(`✅ Created ${embeddingRows.length} embeddings\n`);

    console.log('='.repeat(60));
    console.log('✅ Re-ingestion complete!');
    console.log(`   PRD: ${title}`);
    console.log(`   Chunks: ${chunkData.length}`);
    console.log(`   Embeddings: ${embeddingRows.length}`);
    console.log('='.repeat(60));
    console.log();

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Get storage path from command line
const storagePath = process.argv[2];

if (!storagePath) {
  console.error('❌ Usage: npx tsx reingest-prd.ts <storage_path>');
  console.error('Example: npx tsx reingest-prd.ts "prds/cPlus/Auto-Checked Food Subscription Trial Results.txt"');
  process.exit(1);
}

reingestPRD(storagePath).catch(console.error);

