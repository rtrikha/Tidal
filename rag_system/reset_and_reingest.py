#!/usr/bin/env python3
"""
Reset Knowledge Base and Re-ingest All Files
Wipes all data and starts fresh to avoid duplicates
"""

import requests
import json
import time
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
MINDSDB_HOST = "localhost"
MINDSDB_PORT = 47334
MINDSDB_SQL_URL = f"http://{MINDSDB_HOST}:{MINDSDB_PORT}/api/sql/query"

# Your OpenAI API Key from environment
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

if not OPENAI_API_KEY:
    print("❌ Error: OPENAI_API_KEY not found in environment variables")
    print("   Please set it in rag_system/.env file")
    exit(1)

def execute_sql(query):
    """Execute SQL query against MindsDB"""
    try:
        response = requests.post(
            MINDSDB_SQL_URL,
            json={"query": query},
            timeout=300
        )
        response.raise_for_status()
        result = response.json()
        
        if result.get('type') == 'error':
            # Ignore "does not exist" errors
            if 'does not exist' not in result.get('error_message', ''):
                print(f"   ⚠️  Error: {result.get('error_message')}")
                return False
        return True
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        return False

def main():
    print("\n" + "="*70)
    print("  🗑️  RESET & RE-INGEST - Remove All Duplicates")
    print("="*70 + "\n")
    
    # Step 1: Drop agent
    print("📋 Step 1: Dropping agent 'tidal'...")
    execute_sql("DROP AGENT tidal;")
    print("   ✅ Agent dropped\n")
    time.sleep(2)
    
    # Step 2: Drop knowledge base
    print("📋 Step 2: Dropping knowledge base 'prd_knowledge_base'...")
    execute_sql("DROP KNOWLEDGE_BASE prd_knowledge_base;")
    print("   ✅ Knowledge base dropped\n")
    time.sleep(2)
    
    # Step 3: Recreate knowledge base with model
    print("📋 Step 3: Creating embedding model...")
    model_query = f"""
    CREATE MODEL kb_embedding_prd_knowledge_base
    PREDICT embeddings
    USING
        engine = 'openai',
        model_name = 'text-embedding-3-large',
        api_key = '{OPENAI_API_KEY}';
    """
    execute_sql(model_query)
    print("   ✅ Embedding model created\n")
    time.sleep(3)
    
    print("📋 Step 4: Creating fresh knowledge base...")
    kb_query = """
    CREATE KNOWLEDGE_BASE prd_knowledge_base;
    """
    if execute_sql(kb_query):
        print("   ✅ Knowledge base created\n")
    else:
        print("   ❌ Failed to create knowledge base")
        return
    time.sleep(2)
    
    # Step 5: Recreate agent
    print("📋 Step 5: Creating agent 'tidal'...")
    agent_query = f"""
    CREATE AGENT tidal
    USING
        model = 'gpt-4o',
        provider = 'openai',
        api_key = '{OPENAI_API_KEY}',
        prompt_template = 'You are Tidal, a helpful AI assistant specialized in analyzing Careem Plus product documents and design specifications.

Your knowledge base contains:

1. PRODUCT REQUIREMENTS DOCUMENTS (PRDs):
   - Careem Plus Q4 2025 Product Vision
   - Careem Plus: Add subscription on Ride
   - Careem Plus: Experiences enhancement Food E2E
   - Auto-Checked Food Subscription Trial Results
   - Pricing Insights

2. UI/UX DESIGN SPECIFICATIONS (JSON files):
   - Creating a Booking flow designs
   - Verify Screen designs (2 versions)
   - These contain detailed component hierarchies, UI elements, and screen structures

When answering questions:
- For questions about FEATURES, BUSINESS GOALS, or STRATEGY: Reference the PRD documents
- For questions about UI COMPONENTS, SCREENS, or DESIGN: Look in the JSON design files which contain component names, hierarchies, and UI structures
- For questions about SPECIFIC DATA: Search for exact terms in the documents
- Always cite which document your answer comes from
- If you find relevant information, provide specific details
- If information is truly not available, clearly state that

The JSON design files contain structured component data like:
- Component names (e.g., "Touch area", "Background", "Border", "Wrapper", "Label", "Icon")
- Screen layouts and hierarchies
- UI element specifications

Answer the user\\'s question with specific details from the appropriate documents.',
        knowledge_bases = ['mindsdb.prd_knowledge_base'];
    """
    if execute_sql(agent_query):
        print("   ✅ Agent created\n")
    else:
        print("   ❌ Failed to create agent")
        return
    time.sleep(2)
    
    # Step 6: Delete tracking file
    print("📋 Step 6: Clearing ingestion tracking...")
    tracking_file = Path(__file__).parent / ".ingested_files.json"
    if tracking_file.exists():
        tracking_file.unlink()
        print("   ✅ Tracking file deleted\n")
    else:
        print("   ℹ️  No tracking file to delete\n")
    
    print("="*70)
    print("  ✅ RESET COMPLETE!")
    print("="*70 + "\n")
    
    print("📥 Next step: Re-ingest your files\n")
    print("Run:")
    print("  python3 ingest_files_smart.py\n")
    print("This will:")
    print("  • Ingest all files from data/")
    print("  • Track which files are ingested")
    print("  • Prevent future duplicates")
    print()

if __name__ == "__main__":
    main()

