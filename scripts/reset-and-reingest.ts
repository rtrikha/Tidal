#!/usr/bin/env tsx
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

async function main() {
  console.log('\n⚠️  WARNING: This will DELETE ALL data from Supabase!\n');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('🗑️  Deleting all embeddings...');
  const { error: embError } = await supabase
    .from('chunk_embeddings')
    .delete()
    .neq('chunk_id', '00000000-0000-0000-0000-000000000000');
  
  if (embError) console.error('Error:', embError);
  else console.log('✅ Embeddings deleted');
  
  console.log('🗑️  Deleting all chunks...');
  const { error: chunkError } = await supabase
    .from('chunks')
    .delete()
    .neq('document_id', '00000000-0000-0000-0000-000000000000');
  
  if (chunkError) console.error('Error:', chunkError);
  else console.log('✅ Chunks deleted');
  
  console.log('🗑️  Deleting all documents...');
  const { error: docError } = await supabase
    .from('documents')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (docError) console.error('Error:', docError);
  else console.log('✅ Documents deleted');
  
  console.log('💾 Reclaiming database space...');
  const { error: vacuumError } = await supabase.rpc('execute_vacuum');
  
  if (vacuumError) {
    console.log('ℹ️  VACUUM not available via RPC - run manually in SQL Editor:');
    console.log('   VACUUM FULL;');
  } else {
    console.log('✅ Database space reclaimed');
  }
  
  console.log('\n✅ Database cleared! Now run: npm run ingest\n');
}

main().catch(console.error);

