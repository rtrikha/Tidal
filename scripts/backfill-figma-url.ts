#!/usr/bin/env tsx
/**
 * Backfill script to extract and store figma_url for existing design documents
 * This reads the first chunk of each design document and extracts identifiers.figmaUrl
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../rag_system/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillFigmaUrls() {
  console.log('\n🔄 Backfilling figma_url for existing design documents...\n');

  // Get all design documents
  const { data: documents, error } = await supabase
    .from('designs')
    .select('id, page_name, storage_path, figma_url')
    .eq('type', 'design');

  if (error) {
    console.error('❌ Error fetching documents:', error);
    return;
  }

  if (!documents || documents.length === 0) {
    console.log('📭 No design documents found');
    return;
  }

  console.log(`📊 Found ${documents.length} design documents to check\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches to avoid overwhelming the database
  const batchSize = 20;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    
    for (const doc of batch) {
      try {
        // Skip if already has figma_url
        if (doc.figma_url) {
          console.log(`⏭️  Skipping ${doc.page_name} (already has figma_url)`);
          skipped++;
          continue;
        }

        // Get first chunk (chunk_index = 0) which should contain the JSON top structure
        const { data: chunks, error: chunkError } = await supabase
          .from('chunks')
          .select('content')
          .eq('document_id', doc.id)
          .eq('chunk_index', 0)
          .limit(1)
          .maybeSingle();

        if (chunkError || !chunks || !chunks.content) {
          console.log(`⚠️  No first chunk found for ${doc.page_name}`);
          errors++;
          continue;
        }

        // Try to parse as JSON and extract figmaUrl
        let figmaUrl: string | null = null;
        try {
          const jsonData = JSON.parse(chunks.content);
          figmaUrl = jsonData.identifiers?.figmaUrl || jsonData.figmaUrl || null;
        } catch (parseError) {
          // Not valid JSON, try string search
          const content = chunks.content;
          const urlMatch = content.match(/https?:\/\/[^\s]+figma\.com[^\s]*/);
          if (urlMatch) {
            figmaUrl = urlMatch[0];
          }
        }

        if (figmaUrl) {
          // Update document with figma_url
          const { error: updateError } = await supabase
            .from('designs')
            .update({ figma_url: figmaUrl })
            .eq('id', doc.id);

          if (updateError) {
            console.error(`❌ Failed to update ${doc.page_name}:`, updateError.message);
            errors++;
          } else {
            console.log(`✅ Updated ${doc.page_name}`);
            console.log(`   📎 ${figmaUrl.substring(0, 80)}...`);
            updated++;
          }
        } else {
          console.log(`⚠️  No figmaUrl found in ${doc.page_name}`);
          errors++;
        }
      } catch (err) {
        console.error(`❌ Error processing ${doc.page_name}:`, err);
        errors++;
      }
    }

    // Progress update
    console.log(`\n📈 Progress: ${Math.min(i + batchSize, documents.length)}/${documents.length} processed\n`);
  }

  console.log('\n📊 Backfill Summary:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ⚠️  Errors: ${errors}`);
  console.log(`\n🎉 Backfill complete!\n`);
}

backfillFigmaUrls().catch(console.error);

