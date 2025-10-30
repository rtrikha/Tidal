#!/usr/bin/env tsx
/**
 * Find all PRDs that don't have any chunks
 * These need to be re-ingested
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

async function findPRDsWithoutChunks() {
  console.log('\n🔍 Finding PRDs without chunks...\n');

  // Get all PRDs
  const { data: allPRDs, error: prdError } = await supabase
    .from('prds')
    .select('id, file_name, storage_path')
    .order('file_name');

  if (prdError || !allPRDs) {
    console.error('❌ Error fetching PRDs:', prdError);
    return;
  }

  console.log(`📊 Found ${allPRDs.length} total PRDs\n`);

  const prdsWithoutChunks: Array<{ id: string; file_name: string; storage_path: string }> = [];

  for (const prd of allPRDs) {
    // Check for chunks with prd_id
    const { data: chunksWithPrdId } = await supabase
      .from('chunks')
      .select('id')
      .eq('prd_id', prd.id)
      .limit(1);

    // Check for legacy chunks with document_id
    const { data: legacyChunks } = await supabase
      .from('chunks')
      .select('id')
      .eq('document_id', prd.id)
      .is('prd_id', null)
      .limit(1);

    const hasChunks = (chunksWithPrdId && chunksWithPrdId.length > 0) || 
                      (legacyChunks && legacyChunks.length > 0);

    if (!hasChunks) {
      prdsWithoutChunks.push(prd);
    }
  }

  if (prdsWithoutChunks.length === 0) {
    console.log('✅ All PRDs have chunks!\n');
    return;
  }

  console.log(`❌ Found ${prdsWithoutChunks.length} PRDs without chunks:\n`);
  prdsWithoutChunks.forEach((prd, i) => {
    console.log(`   ${i + 1}. ${prd.file_name}`);
    console.log(`      ID: ${prd.id}`);
    console.log(`      Path: ${prd.storage_path}`);
    console.log();
  });

  console.log('\n💡 To re-ingest these PRDs, run:');
  prdsWithoutChunks.forEach(prd => {
    console.log(`   npx tsx reingest-prd.ts "${prd.storage_path}"`);
  });
  console.log();
}

findPRDsWithoutChunks().catch(console.error);

