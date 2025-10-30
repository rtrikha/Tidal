#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../rag_system/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = 'tidal-docs';
const FOLDER_PATH = 'designs/Aurora_Design_System'; // Change this as needed

/**
 * Recursively list all files in a folder
 */
async function listAllFilesRecursive(folderPath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const { data: items, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(folderPath, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error(`❌ Error listing ${folderPath}:`, error.message);
      return files;
    }

    if (!items) {
      return files;
    }

    for (const item of items) {
      const itemPath = `${folderPath}/${item.name}`;

      // Check if it's a file (has metadata) or folder (no metadata)
      const isFile = item.metadata !== null && typeof item.metadata === 'object';

      if (isFile) {
        files.push(itemPath);
      } else {
        // It's a folder - recurse into it
        const subFiles = await listAllFilesRecursive(itemPath);
        files.push(...subFiles);
      }
    }
  } catch (err) {
    console.error(`💥 Error in listAllFilesRecursive:`, err);
  }

  return files;
}

async function deleteFolder(folderPath: string) {
  console.log(`\n🗑️  Deleting folder: ${folderPath}\n`);

  try {
    // List all files recursively
    console.log('📋 Scanning for files...');
    const filePaths = await listAllFilesRecursive(folderPath);

    if (filePaths.length === 0) {
      console.log('📭 No files found in folder');
      return;
    }

    console.log(`✅ Found ${filePaths.length} files to delete\n`);

    // Delete in batches (Supabase has limits)
    const batchSize = 100;
    let deleted = 0;

    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      console.log(`🗑️  Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filePaths.length / batchSize)} (${batch.length} files)...`);

      const { error: deleteError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(batch);

      if (deleteError) {
        console.error(`❌ Error deleting batch:`, deleteError.message);
        continue;
      }

      deleted += batch.length;
      console.log(`   ✅ Deleted ${batch.length} files`);
    }

    console.log(`\n✨ Successfully deleted ${deleted} files from: ${folderPath}\n`);

  } catch (err) {
    console.error('💥 Error:', err);
  }
}

deleteFolder(FOLDER_PATH);
