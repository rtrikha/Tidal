#!/usr/bin/env tsx
/**
 * Cleanup Script: Remove PRD records from designs table
 * 
 * After migrating PRDs to the prds table, any remaining PRD records
 * in the designs table should be removed along with their chunks.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../rag_system/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function cleanupPRDsFromDesigns() {
  console.log('\n🧹 Cleaning up PRD records from designs table...\n');
  console.log('🔌 Connecting to Supabase...');
  console.log(`   URL: ${process.env.SUPABASE_URL}\n`);

  try {
    // Get all PRD records from designs table
    const { data: prdDesigns, error: fetchError } = await supabase
      .from('designs')
      .select('id, storage_path, page_name, type')
      .eq('type', 'prd');

    if (fetchError) {
      console.error('❌ Error fetching PRDs from designs table:', fetchError);
      return;
    }

    if (!prdDesigns || prdDesigns.length === 0) {
      console.log('✅ No PRD records found in designs table. All PRDs are in the prds table.');
      return;
    }

    console.log(`📊 Found ${prdDesigns.length} PRD records in designs table:\n`);
    prdDesigns.forEach((prd, i) => {
      console.log(`   ${i + 1}. ${prd.storage_path}`);
      console.log(`      Name: ${prd.page_name || 'unnamed'}`);
      console.log(`      ID: ${prd.id}`);
    });

    console.log('\n⚠️  This will delete:');
    console.log(`   - ${prdDesigns.length} PRD records from designs table`);
    console.log(`   - All associated chunks for these PRDs (linked via document_id)`);
    console.log(`   - All associated embeddings for these chunks\n`);

    const answer = await askQuestion('❓ Continue with deletion? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Deletion cancelled.');
      return;
    }

    console.log('\n🗑️  Deleting PRD records from designs table...\n');

    let deletedCount = 0;
    let errorCount = 0;

    for (const prd of prdDesigns) {
      try {
        console.log(`   Deleting: ${prd.storage_path}`);

        // Get chunk IDs first so we can delete their embeddings
        const { data: chunks, error: chunksFetchError } = await supabase
          .from('chunks')
          .select('id')
          .eq('document_id', prd.id);

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

        // Delete chunks (they have foreign key to designs via document_id)
        const { error: chunksError } = await supabase
          .from('chunks')
          .delete()
          .eq('document_id', prd.id);

        if (chunksError) {
          console.error(`     ⚠️  Error deleting chunks: ${chunksError.message}`);
          errorCount++;
          continue;
        }

        // Delete the PRD record from designs table
        const { error: designError } = await supabase
          .from('designs')
          .delete()
          .eq('id', prd.id);

        if (designError) {
          console.error(`     ❌ Error deleting PRD from designs: ${designError.message}`);
          errorCount++;
          continue;
        }

        console.log(`     ✅ Deleted: ${prd.page_name || prd.storage_path}`);
        deletedCount++;
      } catch (err) {
        console.error(`     ❌ Exception deleting ${prd.storage_path}:`, err);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Cleanup Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully deleted: ${deletedCount} PRD records from designs table`);
    if (errorCount > 0) {
      console.log(`❌ Errors encountered: ${errorCount} PRD records`);
    }
    console.log();
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

cleanupPRDsFromDesigns().catch(console.error);

