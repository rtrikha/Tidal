#!/usr/bin/env tsx
/**
 * Ingestion Producer for Tidal RAG
 * 
 * Discovers files from Supabase Storage and queues ingestion jobs in Bull.
 * Make sure to have the worker running in another terminal: npm run worker
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { waitForSupabaseWakeup } from './retry-utils.js';
import { createIngestionQueue } from './queue-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../rag_system/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const STORAGE_BUCKET = 'tidal-docs';

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
    // In Supabase Storage: folders have id === null, files have an id
    // However, we also check for file extensions to be sure
    const hasFileExtension = item.name.match(/\.(txt|md|json|pdf|ts|js|py|go|java|cpp|c|h|rb|php|rs|sh)$/i);
    
    if (hasFileExtension) {
      // Definitely a file (has extension)
      console.log(`  📄 File: ${item.name}`);
      files.push(itemPath);
    } else if (item.id === null) {
      // No ID = folder in Supabase Storage
      console.log(`  📁 Folder: ${item.name}`);
      const subFiles = await listStorageFilesRecursive(itemPath);
      files.push(...subFiles);
    } else {
      // Has ID but no extension - could be a file without extension or edge case
      // Try recursing first (safer - if it's a folder, we'll find files inside)
      // If it fails or returns nothing, it's likely a file without extension
      console.log(`  ❓ Checking: ${item.name} (has ID but no extension)`);
      const subFiles = await listStorageFilesRecursive(itemPath);
      if (subFiles.length > 0) {
        // It was a folder, got files
        files.push(...subFiles);
      } else {
        // No files found inside, treat as file anyway (might be file without extension)
        console.log(`  📄 Treating as file: ${item.name}`);
        files.push(itemPath);
      }
    }
  }

  return files;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 Tidal RAG - Queueing Ingestion Jobs');
  console.log('='.repeat(60) + '\n');

  // Get custom path from command line argument
  const customPath = process.argv[2];
  
  let paths: string[] = [];
  if (customPath) {
    console.log(`🎯 Custom path specified: ${customPath}`);
    paths = [customPath];
  } else {
    console.log('📂 Using default paths: prds, designs, code\n');
    paths = ['prds', 'designs', 'code'];
  }

  // Wait for Supabase
  const isAwake = await waitForSupabaseWakeup(supabase);
  if (!isAwake) {
    console.error('❌ Could not connect to Supabase. Please check your connection.\n');
    process.exit(1);
  }

  // List files from storage
  console.log('🔍 Scanning Supabase Storage...\n');
  
  const allFiles: { path: string; type: 'prd' | 'design' | 'code' }[] = [];

  for (const scanPath of paths) {
    const files = await listStorageFilesRecursive(scanPath);
    
    // Determine file type based on the full file path (not just scanPath)
    // This handles nested folders correctly
    allFiles.push(...files.map(f => {
      let fileType: 'prd' | 'design' | 'code' = 'prd';
      if (f.startsWith('designs/')) fileType = 'design';
      else if (f.startsWith('code/')) fileType = 'code';
      else if (f.startsWith('prds/')) fileType = 'prd';
      // Fallback to scanPath if file path doesn't match standard prefixes
      else {
        if (scanPath.includes('design')) fileType = 'design';
        else if (scanPath.includes('code')) fileType = 'code';
        else fileType = 'prd';
      }
      return { path: f, type: fileType };
    }));
  }

  console.log(`\n✅ Found ${allFiles.length} files to ingest\n`);

  if (allFiles.length === 0) {
    console.log('ℹ️  No files to ingest');
    process.exit(0);
  }

  // Create queue and add jobs
  const queue = createIngestionQueue();

  console.log('📤 Queuing jobs...\n');

  let queued = 0;

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    const fileName = file.path.split('/').pop();

    try {
      await queue.add(
        {
          storagePath: file.path,
          type: file.type,
          jobIndex: i + 1,
          totalJobs: allFiles.length
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: false,
          removeOnFail: false
        }
      );

      queued++;
      console.log(`  ✅ Queued: ${fileName}`);
    } catch (err) {
      console.error(`  ❌ Failed to queue ${fileName}:`, err);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Queue Status');
  console.log('='.repeat(60));
  console.log(`✅ Queued: ${queued}/${allFiles.length} files`);
  console.log(`\n🎯 Make sure worker is running: npm run worker`);
  console.log('🔄 Jobs will be processed with automatic retry on failure\n');

  // Close queue connection
  await queue.close();
}

main().catch((err) => {
  console.error('💥 Error:', err);
  process.exit(1);
});
