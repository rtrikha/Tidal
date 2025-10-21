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

async function listAllDocuments() {
  console.log('\n📚 All Documents in Database:\n');
  
  console.log('🔌 Connecting to Supabase...');
  console.log(`   URL: ${process.env.SUPABASE_URL}`);
  
  let docs;
  let error;
  
  try {
    const result = await supabase
      .from('documents')
      .select('id, title, type, storage_path')
      .order('type')
      .order('title');
    
    docs = result.data;
    error = result.error;
  } catch (e) {
    console.error('\n❌ Connection Error:', e);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify SUPABASE_URL in rag_system/.env');
    console.log('   3. Verify SUPABASE_SERVICE_ROLE_KEY in rag_system/.env');
    console.log('   4. Try again in a moment\n');
    return;
  }
  
  if (error) {
    console.error('❌ Database Error:', error);
    return;
  }
  
  if (!docs || docs.length === 0) {
    console.log('No documents found.');
    return;
  }
  
  const prds = docs.filter(d => d.type === 'prd');
  const designs = docs.filter(d => d.type === 'design');
  
  console.log(`📝 PRDs (${prds.length}):`);
  prds.forEach(d => {
    console.log(`  - ${d.title}`);
    if (d.storage_path) console.log(`    Storage: ${d.storage_path}`);
  });
  
  console.log(`\n🎨 Designs (${designs.length}):`);
  designs.forEach(d => {
    console.log(`  - ${d.title}`);
    if (d.storage_path) console.log(`    Storage: ${d.storage_path}`);
  });
  
  console.log(`\n✅ Total: ${docs.length} documents in database`);
  console.log('\n💡 These are what show up in @mentions in the UI\n');
}

listAllDocuments().catch(console.error);

