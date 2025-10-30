#!/usr/bin/env tsx
/**
 * Cleanup Script: Remove PRDs at root level (prds/filename.txt)
 * Keeps PRDs in subfolders (prds/cPlus/filename.txt, etc.)
 * 
 * This script identifies PRDs that are directly under prds/ (no subfolder)
 * and removes them along with their associated chunks.
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

async function cleanupRootPRDs() {
  console.log('\n🧹 Cleaning up root-level PRDs...\n');
  console.log('🔌 Connecting to Supabase...');
  console.log(`   URL: ${process.env.SUPABASE_URL}\n`);

  try {
    // Get all PRDs
    const { data: allPRDs, error: fetchError } = await supabase
      .from('prds')
      .select('id, storage_path, file_name');

    if (fetchError) {
      console.error('❌ Error fetching PRDs:', fetchError);
      return;
    }

    if (!allPRDs || allPRDs.length === 0) {
      console.log('✅ No PRDs found in database');
      return;
    }

    console.log(`📊 Found ${allPRDs.length} total PRDs\n`);

    // Filter PRDs that are at root level (prds/filename.txt)
    // Exclude those in subfolders (prds/cPlus/filename.txt, prds/CareemPlus/filename.txt, etc.)
    const rootPRDs = allPRDs.filter(prd => {
      const pathParts = prd.storage_path.split('/');
      // Root level means: prds/filename.txt (only 2 parts)
      // Subfolder means: prds/cPlus/filename.txt (3+ parts)
      return pathParts.length === 2 && pathParts[0] === 'prds';
    });

    if (rootPRDs.length === 0) {
      console.log('✅ No root-level PRDs found. All PRDs are in subfolders.');
      return;
    }

    console.log(`📝 Found ${rootPRDs.length} root-level PRDs to remove:`);
    rootPRDs.forEach((prd, i) => {
      console.log(`   ${i + 1}. ${prd.storage_path} (${prd.file_name || 'unnamed'})`);
    });

    console.log('\n⚠️  This will delete:');
    console.log(`   - ${rootPRDs.length} PRD records`);
    console.log(`   - All associated chunks for these PRDs`);
    console.log(`   - All associated embeddings for these chunks\n`);

    // Get confirmation
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('❓ Continue with deletion? (yes/no): ', resolve);
    });

    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Deletion cancelled.');
      return;
    }

    console.log('\n🗑️  Deleting root-level PRDs...\n');

    let deletedCount = 0;
    let errorCount = 0;

    for (const prd of rootPRDs) {
      try {
        console.log(`   Deleting: ${prd.storage_path}`);

        // Get chunk IDs first so we can delete their embeddings
        const { data: chunks, error: chunksFetchError } = await supabase
          .from('chunks')
          .select('id')
          .eq('prd_id', prd.id);

        if (chunksFetchError) {
          console.error(`     ⚠️  Error fetching chunks: ${chunksFetchError.message}`);
          errorCount++;
          continue;
        }

        // Delete embeddings for these chunks
        if (chunks && chunks.length > 0) {
          const chunkIds = chunks.map(c => c.id);
          const { error: embeddingsError } = await supabase
            .from('chunk_embeddings')
            .delete()
            .in('chunk_id', chunkIds);

          if (embeddingsError) {
            console.error(`     ⚠️  Error deleting embeddings: ${embeddingsError.message}`);
            errorCount++;
            continue;
          }
        }

        // Delete chunks (they have foreign key to prds)
        const { error: chunksError } = await supabase
          .from('chunks')
          .delete()
          .eq('prd_id', prd.id);

        if (chunksError) {
          console.error(`     ⚠️  Error deleting chunks: ${chunksError.message}`);
          errorCount++;
          continue;
        }

        // Delete the PRD record
        const { error: prdError } = await supabase
          .from('prds')
          .delete()
          .eq('id', prd.id);

        if (prdError) {
          console.error(`     ❌ Error deleting PRD: ${prdError.message}`);
          errorCount++;
          continue;
        }

        console.log(`     ✅ Deleted: ${prd.file_name || prd.storage_path}`);
        deletedCount++;
      } catch (err) {
        console.error(`     ❌ Exception deleting ${prd.storage_path}:`, err);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Cleanup Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully deleted: ${deletedCount} PRDs`);
    if (errorCount > 0) {
      console.log(`❌ Errors encountered: ${errorCount} PRDs`);
    }
    console.log(`📝 Remaining PRDs: ${allPRDs.length - deletedCount}`);
    console.log();
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

cleanupRootPRDs().catch(console.error);

