#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../rag_system/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = 'tidal-docs';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

async function uploadFolder(localFolder: string, remotePath: string) {
  // Verify local folder exists
  if (!fs.existsSync(localFolder)) {
    console.error(`❌ Local folder not found: ${localFolder}`);
    rl.close();
    process.exit(1);
  }

  console.log(`\n📤 Uploading folder to Supabase Storage\n`);
  console.log(`📁 Local folder: ${localFolder}`);
  console.log(`☁️  Remote path: tidal-docs/${remotePath}\n`);

  try {
    // Get all files recursively
    const allFiles = getAllFiles(localFolder);

    if (allFiles.length === 0) {
      console.log('📭 No files found in folder');
      rl.close();
      return;
    }

    console.log(`✅ Found ${allFiles.length} files\n`);

    // Show preview of first few files
    console.log('📋 Preview of files to upload:');
    allFiles.slice(0, 5).forEach(filePath => {
      const relativePath = path.relative(localFolder, filePath);
      const remoteFilePath = path.join(remotePath, relativePath)
        .replace(/\\/g, '/');
      console.log(`   • ${remoteFilePath}`);
    });

    if (allFiles.length > 5) {
      console.log(`   ... and ${allFiles.length - 5} more files\n`);
    } else {
      console.log();
    }

    // Ask for confirmation
    const confirm = await prompt('Proceed with upload? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('❌ Upload cancelled');
      rl.close();
      return;
    }

    console.log();

    let uploaded = 0;
    let failed = 0;

    for (const filePath of allFiles) {
      // Get relative path from local folder root
      const relativePath = path.relative(localFolder, filePath);
      
      // Construct remote path preserving folder structure
      const remoteFilePath = path.join(remotePath, relativePath)
        .replace(/\\/g, '/'); // Convert Windows backslashes to forward slashes

      const fileName = path.basename(filePath);

      try {
        // Read file content
        const fileContent = fs.readFileSync(filePath);

        // Upload to Supabase
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(remoteFilePath, fileContent, {
            upsert: true, // Overwrite if exists
          });

        if (error) {
          console.error(`   ❌ ${fileName}: ${error.message}`);
          failed++;
        } else {
          console.log(`   ✅ ${remoteFilePath}`);
          uploaded++;
        }
      } catch (err) {
        console.error(`   ❌ ${fileName}: ${err}`);
        failed++;
      }

      // Rate limiting - avoid overwhelming Supabase
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Upload Summary');
    console.log('='.repeat(60));
    console.log(`✅ Uploaded: ${uploaded} files`);
    if (failed > 0) {
      console.log(`❌ Failed: ${failed} files`);
    }
    console.log();

    rl.close();

  } catch (err) {
    console.error('💥 Error:', err);
    rl.close();
    process.exit(1);
  }
}

/**
 * Main - Interactive mode
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('📤 Supabase Folder Upload Tool');
  console.log('='.repeat(60) + '\n');

  // Check for command line arguments
  let localFolder = process.argv[2];
  let remotePath = process.argv[3];

  // If arguments provided, use them directly
  if (localFolder && remotePath) {
    console.log('Using provided arguments:\n');
    await uploadFolder(localFolder, remotePath);
    return;
  }

  // Interactive mode
  console.log('Enter the details below:\n');

  localFolder = await prompt('📁 Local folder path (e.g., /Users/name/Documents/MyFolder): ');
  
  if (!localFolder) {
    console.error('❌ Local folder path is required');
    rl.close();
    process.exit(1);
  }

  // Expand ~ to home directory
  if (localFolder.startsWith('~')) {
    localFolder = localFolder.replace('~', process.env.HOME);
  }

  remotePath = await prompt('☁️  Remote Supabase path (e.g., designs/MyFolder or prds/TeamName): ');

  if (!remotePath) {
    console.error('❌ Remote path is required');
    rl.close();
    process.exit(1);
  }

  console.log();
  await uploadFolder(localFolder, remotePath);
}

main();
