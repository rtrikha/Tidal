#!/usr/bin/env tsx
/**
 * Delete documents from database that don't exist in Storage
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
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

const STORAGE_BUCKET = 'tidal-docs';

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

async function cleanupMissingFiles() {
  console.log('\n⚠️  CLEANUP MISSING FILES\n');
  console.log('This will DELETE database records for files that don\'t exist in Storage.\n');

  // Get all documents from database
  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, storage_path, title, type');

  if (error) {
    console.error('❌ Error fetching documents:', error);
    return;
  }

  console.log(`📊 Checking ${documents?.length || 0} documents...\n`);

  const missingFiles: any[] = [];

  for (const doc of documents || []) {
    try {
      const { data, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(doc.storage_path);

      if (downloadError || !data) {
        missingFiles.push(doc);
      }
    } catch (err) {
      missingFiles.push(doc);
    }
  }

  if (missingFiles.length === 0) {
    console.log('✅ No missing files found! All database records have corresponding Storage files.\n');
    return;
  }

  console.log(`\n❌ Found ${missingFiles.length} orphaned database records:\n`);
  missingFiles.forEach((doc, i) => {
    console.log(`${i + 1}. ${doc.title} (${doc.type})`);
    console.log(`   Path: ${doc.storage_path}`);
  });

  console.log('\n⚠️  These records will be DELETED from the database (including chunks and embeddings).\n');
  
  const answer = await askQuestion('Continue? (yes/no): ');

  if (answer.toLowerCase() !== 'yes') {
    console.log('\n❌ Cancelled.\n');
    return;
  }

  console.log('\n🗑️  Deleting orphaned records...\n');

  let deleted = 0;
  for (const doc of missingFiles) {
    try {
      // Delete embeddings first (foreign key constraint)
      const { data: chunks } = await supabase
        .from('chunks')
        .select('id')
        .eq('document_id', doc.id);

      if (chunks && chunks.length > 0) {
        const chunkIds = chunks.map(c => c.id);
        await supabase
          .from('chunk_embeddings')
          .delete()
          .in('chunk_id', chunkIds);
      }

      // Delete chunks
      await supabase
        .from('chunks')
        .delete()
        .eq('document_id', doc.id);

      // Delete document
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (deleteError) {
        console.log(`❌ Failed to delete ${doc.title}: ${deleteError.message}`);
      } else {
        console.log(`✅ Deleted: ${doc.title}`);
        deleted++;
      }
    } catch (err) {
      console.log(`❌ Error deleting ${doc.title}:`, err);
    }
  }

  console.log(`\n✅ Cleanup complete! Deleted ${deleted}/${missingFiles.length} orphaned records.\n`);
}

cleanupMissingFiles().catch(console.error);

