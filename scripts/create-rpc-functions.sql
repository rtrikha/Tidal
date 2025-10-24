-- RPC Functions for Tidal RAG System
-- These functions handle semantic search using vector embeddings

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS match_chunks(vector(1536), float, int);
DROP FUNCTION IF EXISTS match_chunks_by_document(vector(1536), uuid, float, int);

-- Function: match_chunks
-- Searches across ALL documents for semantically similar chunks
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  document_title text,
  image_url text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    1 - (ce.embedding <=> query_embedding) AS similarity,
    d.page_name AS document_title,
    d.image_url
  FROM chunks c
  JOIN chunk_embeddings ce ON c.id = ce.chunk_id
  JOIN documents d ON c.document_id = d.id
  WHERE 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: match_chunks_by_document
-- Searches within a SPECIFIC document for semantically similar chunks
CREATE OR REPLACE FUNCTION match_chunks_by_document(
  query_embedding vector(1536),
  doc_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  document_title text,
  image_url text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    1 - (ce.embedding <=> query_embedding) AS similarity,
    d.page_name AS document_title,
    d.image_url
  FROM chunks c
  JOIN chunk_embeddings ce ON c.id = ce.chunk_id
  JOIN documents d ON c.document_id = d.id
  WHERE c.document_id = doc_id
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION match_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION match_chunks_by_document TO authenticated;
GRANT EXECUTE ON FUNCTION match_chunks TO anon;
GRANT EXECUTE ON FUNCTION match_chunks_by_document TO anon;

