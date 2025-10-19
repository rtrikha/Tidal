#!/usr/bin/env python3
"""
Direct File Ingestion Script

Reads files from data/ directory and inserts them directly into the knowledge base
without needing the MindsDB Files API.
"""

import argparse
import sys
import requests
from pathlib import Path
import json


def execute_sql(host, port, query):
    """Execute SQL query via MindsDB REST API."""
    url = f"http://{host}:{port}/api/sql/query"
    
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
            return False, f"Error: {response.status_code} - {response.text}"
    except requests.exceptions.RequestException as e:
        return False, f"Connection error: {e}"


def escape_sql_string(text):
    """Escape single quotes in SQL strings."""
    return text.replace("'", "''")


def ingest_file(host, port, file_path):
    """Read a file and insert its content into the knowledge base."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Escape single quotes for SQL
        escaped_content = escape_sql_string(content)
        
        # Create INSERT query
        query = f"""
INSERT INTO prd_knowledge_base (content)
SELECT '{escaped_content}' AS content;
"""
        
        success, result = execute_sql(host, port, query)
        return success, result
        
    except Exception as e:
        return False, str(e)


def main():
    parser = argparse.ArgumentParser(
        description="Ingest files from data/ directory into MindsDB knowledge base"
    )
    parser.add_argument(
        "--host",
        default="localhost",
        help="MindsDB host (default: localhost)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=47334,
        help="MindsDB port (default: 47334)"
    )
    parser.add_argument(
        "--prds-dir",
        default="./data/prds",
        help="Directory containing PRD files (default: ./data/prds)"
    )
    parser.add_argument(
        "--json-dir",
        default="./data/designs",
        help="Directory containing design files (default: ./data/designs)"
    )
    
    args = parser.parse_args()
    
    print("\n" + "="*60)
    print("📥 Direct File Ingestion to Knowledge Base")
    print("="*60 + "\n")
    
    # Check MindsDB connection
    try:
        response = requests.get(f"http://{args.host}:{args.port}/api/status", timeout=5)
        if response.status_code != 200:
            print(f"❌ Cannot connect to MindsDB at {args.host}:{args.port}")
            sys.exit(1)
        print(f"✅ Connected to MindsDB at {args.host}:{args.port}\n")
    except requests.exceptions.RequestException:
        print(f"❌ Cannot connect to MindsDB at {args.host}:{args.port}")
        sys.exit(1)
    
    ingested = 0
    failed = 0
    
    # Ingest PRD files
    print("📄 Ingesting PRD files...")
    prd_dir = Path(args.prds_dir)
    if prd_dir.exists():
        for file_path in sorted(prd_dir.glob("*.txt")) + sorted(prd_dir.glob("*.md")):
            print(f"   {file_path.name}...", end=" ")
            success, result = ingest_file(args.host, args.port, file_path)
            if success:
                print("✅")
                ingested += 1
            else:
                print(f"❌ {result}")
                failed += 1
    else:
        print(f"   ⚠️  Directory not found: {prd_dir}")
    
    # Ingest design files
    print("\n📊 Ingesting design files...")
    json_dir = Path(args.json_dir)
    if json_dir.exists():
        for file_path in sorted(json_dir.glob("*.json")):
            print(f"   {file_path.name}...", end=" ")
            success, result = ingest_file(args.host, args.port, file_path)
            if success:
                print("✅")
                ingested += 1
            else:
                print(f"❌ {result}")
                failed += 1
    else:
        print(f"   ⚠️  Directory not found: {json_dir}")
    
    # Summary
    print("\n" + "="*60)
    print("📊 Ingestion Summary")
    print("="*60)
    print(f"✅ Successfully ingested: {ingested} files")
    if failed > 0:
        print(f"❌ Failed: {failed} files")
    


if __name__ == "__main__":
    main()

