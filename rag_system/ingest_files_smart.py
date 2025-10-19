#!/usr/bin/env python3
"""
Smart File Ingestion - Only ingest new/changed files
Tracks what's been ingested to avoid duplicates
"""

import argparse
import sys
import requests
import hashlib
import json
from pathlib import Path

MINDSDB_API = 'http://localhost:47334/api/sql/query'
TRACKING_FILE = '.ingested_files.json'

def execute_sql(query):
    """Execute SQL query via MindsDB REST API."""
    url = MINDSDB_API
    try:
        response = requests.post(
            url,
            json={"query": query},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"Error: {response.status_code}"
    except Exception as e:
        return False, str(e)

def get_chunk_count():
    """Get current number of chunks in knowledge base."""
    try:
        success, result = execute_sql("SELECT COUNT(*) as count FROM prd_knowledge_base;")
        if success and result.get('type') == 'table':
            return result['data'][0][0]
        return 0
    except:
        return 0

def file_hash(filepath):
    """Get MD5 hash of file content."""
    with open(filepath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def load_tracking():
    """Load tracking of ingested files."""
    if Path(TRACKING_FILE).exists():
        with open(TRACKING_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_tracking(tracking):
    """Save tracking data."""
    with open(TRACKING_FILE, 'w') as f:
        json.dump(tracking, f, indent=2)

def escape_sql_string(text):
    """Escape single quotes in SQL strings."""
    return text.replace("'", "''")

def ingest_file(file_path, tracking):
    """Ingest file only if new or changed."""
    file_key = str(file_path)
    current_hash = file_hash(file_path)
    
    # Check if already ingested with same content
    if file_key in tracking and tracking[file_key] == current_hash:
        return 'skipped', 'Already ingested', 0
    
    # Get chunk count before ingestion
    chunks_before = get_chunk_count()
    
    # Read and ingest
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        escaped_content = escape_sql_string(content)
        
        query = f"""
INSERT INTO prd_knowledge_base (content)
SELECT '{escaped_content}' AS content;
"""
        
        success, result = execute_sql(query)
        
        if success:
            # Get chunk count after ingestion
            chunks_after = get_chunk_count()
            chunks_created = chunks_after - chunks_before
            
            # Update tracking
            tracking[file_key] = current_hash
            return 'ingested', 'Success', chunks_created
        else:
            return 'failed', result, 0
            
    except Exception as e:
        return 'failed', str(e), 0

def main():
    parser = argparse.ArgumentParser(
        description="Smart ingestion - only ingest new/changed files"
    )
    parser.add_argument("--force", action="store_true", help="Re-ingest all files")
    parser.add_argument("--prds-dir", default="./data/prds", help="PRD directory")
    parser.add_argument("--designs-dir", default="./data/designs", help="Designs directory")
    
    args = parser.parse_args()
    
    print("\n" + "="*60)
    print("📥 Smart File Ingestion")
    print("="*60 + "\n")
    
    # Load tracking
    tracking = {} if args.force else load_tracking()
    
    if args.force:
        print("⚠️  Force mode: Re-ingesting all files\n")
    
    # Check connection
    try:
        response = requests.get(f"http://localhost:47334/api/status", timeout=5)
        if response.status_code != 200:
            print("❌ Cannot connect to MindsDB")
            sys.exit(1)
        print("✅ Connected to MindsDB\n")
    except:
        print("❌ Cannot connect to MindsDB")
        sys.exit(1)
    
    stats = {'ingested': 0, 'skipped': 0, 'failed': 0, 'total_chunks': 0}
    
    # Process PRD files
    print("📄 Processing PRD files...")
    prd_dir = Path(args.prds_dir)
    if prd_dir.exists():
        for file_path in sorted(prd_dir.glob("*.txt")) + sorted(prd_dir.glob("*.md")):
            status, msg, chunks = ingest_file(file_path, tracking)
            
            if status == 'ingested':
                print(f"   ✅ {file_path.name} → {chunks} chunks")
                stats['ingested'] += 1
                stats['total_chunks'] += chunks
            elif status == 'skipped':
                print(f"   ⏭️  {file_path.name} (unchanged)")
                stats['skipped'] += 1
            else:
                print(f"   ❌ {file_path.name}: {msg}")
                stats['failed'] += 1
    
    # Process design files
    print("\n📊 Processing design files...")
    design_dir = Path(args.designs_dir)
    if design_dir.exists():
        for file_path in sorted(design_dir.glob("*.json")):
            status, msg, chunks = ingest_file(file_path, tracking)
            
            if status == 'ingested':
                print(f"   ✅ {file_path.name} → {chunks} chunks")
                stats['ingested'] += 1
                stats['total_chunks'] += chunks
            elif status == 'skipped':
                print(f"   ⏭️  {file_path.name} (unchanged)")
                stats['skipped'] += 1
            else:
                print(f"   ❌ {file_path.name}: {msg}")
                stats['failed'] += 1
    
    # Save tracking
    save_tracking(tracking)
    
    # Get final total chunk count
    total_chunks_kb = get_chunk_count()
    
    # Summary
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"✅ Newly ingested: {stats['ingested']} files")
    print(f"⏭️  Skipped (unchanged): {stats['skipped']} files")
    if stats['failed'] > 0:
        print(f"❌ Failed: {stats['failed']} files")
    
    if stats['ingested'] > 0:
        print(f"\n📦 Chunks created: {stats['total_chunks']}")
        print(f"📚 Total chunks in KB: {total_chunks_kb}")
        print("\n✨ New files added to knowledge base!")
    elif stats['skipped'] > 0:
        print(f"\n📚 Total chunks in KB: {total_chunks_kb}")
        print("\n✨ All files already up to date!")
    
    print(f"\n💾 Tracking saved to: {TRACKING_FILE}\n")
    
    sys.exit(0 if stats['failed'] == 0 else 1)

if __name__ == "__main__":
    main()

