#!/usr/bin/env tsx
/**
 * Diagnostic Script: Check if chunks exist for a PRD
 * This helps identify why PRDs aren't returning chunks
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../rag_system/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnosePRD(prdId?: string) {
  console.log('\n🔍 Diagnosing PRD chunks...\n');
  
  // If PRD ID provided, use it; otherwise, check first PRD
  let targetPrdId = prdId;
  
  if (!targetPrdId) {
    // Get first PRD to diagnose
    const { data: prds } = await supabase
      .from('prds')
      .select('id, file_name, storage_path')
      .limit(1);
    
    if (!prds || prds.length === 0) {
      console.log('❌ No PRDs found in database');
      return;
    }
    
    targetPrdId = prds[0].id;
    console.log(`Using PRD: ${prds[0].file_name} (${targetPrdId})`);
  }
  
  console.log(`\n📋 PRD ID: ${targetPrdId}\n`);
  
  // Check PRD exists
  const { data: prd, error: prdError } = await supabase
    .from('prds')
    .select('id, file_name, storage_path')
    .eq('id', targetPrdId)
    .single();
  
  if (prdError || !prd) {
    console.error('❌ PRD not found:', prdError);
    return;
  }
  
  console.log(`✅ PRD found: ${prd.file_name}`);
  console.log(`   Storage path: ${prd.storage_path}\n`);
  
  // Check chunks with prd_id
  const { data: chunksWithPrdId, error: prdIdError } = await supabase
    .from('chunks')
    .select('id, chunk_index, content, prd_id, document_id')
    .eq('prd_id', targetPrdId)
    .order('chunk_index');
  
  console.log(`📊 Chunks with prd_id = ${targetPrdId}:`);
  console.log(`   Count: ${chunksWithPrdId?.length || 0}`);
  if (chunksWithPrdId && chunksWithPrdId.length > 0) {
    chunksWithPrdId.forEach(c => {
      console.log(`   - Chunk ${c.chunk_index}: ${c.content.substring(0, 50)}...`);
    });
  }
  
  // Check chunks with document_id (legacy)
  const { data: chunksWithDocId, error: docIdError } = await supabase
    .from('chunks')
    .select('id, chunk_index, content, prd_id, document_id')
    .eq('document_id', targetPrdId)
    .is('prd_id', null)
    .order('chunk_index');
  
  console.log(`\n📊 Chunks with document_id = ${targetPrdId} (legacy, prd_id is null):`);
  console.log(`   Count: ${chunksWithDocId?.length || 0}`);
  if (chunksWithDocId && chunksWithDocId.length > 0) {
    chunksWithDocId.forEach(c => {
      console.log(`   - Chunk ${c.chunk_index}: ${c.content.substring(0, 50)}...`);
    });
  }
  
  // Check if document_id points to designs table (wrong link)
  const { data: wrongDesign, error: designError } = await supabase
    .from('designs')
    .select('id, page_name')
    .eq('id', targetPrdId)
    .maybeSingle();
  
  if (wrongDesign) {
    console.log(`\n⚠️  WARNING: This ID also exists in designs table as: ${wrongDesign.page_name}`);
  }
  
  // Check embeddings
  const allChunkIds = [
    ...(chunksWithPrdId || []).map(c => c.id),
    ...(chunksWithDocId || []).map(c => c.id)
  ];
  
  if (allChunkIds.length > 0) {
    const { data: embeddings, error: embError } = await supabase
      .from('chunk_embeddings')
      .select('chunk_id')
      .in('chunk_id', allChunkIds);
    
    console.log(`\n📊 Embeddings for these chunks: ${embeddings?.length || 0}`);
  } else {
    console.log(`\n❌ No chunks found at all for this PRD!`);
    console.log(`\n💡 This PRD has no chunks. Possible reasons:`);
    console.log(`   1. The PRD was never ingested`);
    console.log(`   2. The chunks were deleted`);
    console.log(`   3. The chunks are linked to a different ID`);
    console.log(`\n🔧 Solution: Re-ingest this PRD to create chunks`);
  }
  
  console.log();
}

// Get PRD ID from command line if provided
const prdId = process.argv[2];
diagnosePRD(prdId).catch(console.error);

