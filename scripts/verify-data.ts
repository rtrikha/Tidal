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
  console.log('\n📊 Verifying Supabase Data...\n');
  
  // Count documents
  const { data: docs, error: docsError } = await supabase
    .from('designs')
    .select('id, title, type');
  
  if (docsError) {
    console.error('❌ Error fetching documents:', docsError);
    return;
  }
  
  console.log(`✅ Documents in database: ${docs?.length || 0}\n`);
  
  // List all documents
  if (docs && docs.length > 0) {
    console.log('📄 Documents:');
    const prds = docs.filter(d => d.type === 'prd');
    const designs = docs.filter(d => d.type === 'design');
    
    if (prds.length > 0) {
      console.log('\n  PRDs:');
      prds.forEach(d => console.log(`    - ${d.title}`));
    }
    
    if (designs.length > 0) {
      console.log('\n  Designs:');
      designs.forEach(d => console.log(`    - ${d.title}`));
    }
    
    // Count chunks
    const { count: chunkCount } = await supabase
      .from('chunks')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n✅ Total chunks: ${chunkCount || 0}`);
    
    // Count embeddings
    const { count: embeddingCount } = await supabase
      .from('chunk_embeddings')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Total embeddings: ${embeddingCount || 0}`);
  } else {
    console.log('❌ No documents found in database!');
    console.log('\n💡 To force re-ingestion, delete the documents and run:');
    console.log('   npm run ingest');
  }
  
  console.log();
}

main().catch(console.error);

