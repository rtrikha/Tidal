-- Update RPC Functions to Support Both Designs and PRDs Tables
-- These updated functions search across both designs and prds tables

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS match_chunks(vector(1536), float, int);
DROP FUNCTION IF EXISTS match_chunks_by_document(vector(1536), uuid, float, int);
DROP FUNCTION IF EXISTS match_chunks_by_prd(vector(1536), uuid, float, int);

-- Function: match_chunks
-- Searches across ALL documents (designs) AND prds for semantically similar chunks
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  prd_id uuid,
  content text,
  similarity float,
  document_title text,
  image_url text,
  doc_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Search in design documents
  SELECT
    c.id,
    c.document_id,
    NULL::uuid AS prd_id,
    c.content,
    1 - (ce.embedding <=> query_embedding) AS similarity,
    d.page_name AS document_title,
    d.image_url,
    'design'::text AS doc_type
  FROM chunks c
  JOIN chunk_embeddings ce ON c.id = ce.chunk_id
  JOIN designs d ON c.document_id = d.id
  WHERE c.document_id IS NOT NULL
    AND c.prd_id IS NULL
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  
  UNION ALL
  
  -- Search in PRDs (new structure with prd_id)
  SELECT
    c.id,
    NULL::uuid AS document_id,
    c.prd_id,
    c.content,
    1 - (ce.embedding <=> query_embedding) AS similarity,
        p.file_name AS document_title,
    NULL::text AS image_url,
    'prd'::text AS doc_type
  FROM chunks c
  JOIN chunk_embeddings ce ON c.id = ce.chunk_id
  JOIN prds p ON c.prd_id = p.id
  WHERE c.prd_id IS NOT NULL
    AND c.document_id IS NULL
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  
  UNION ALL
  
  -- Search in PRDs (legacy structure with document_id pointing to prds table)
  SELECT
    c.id,
    c.document_id,
    NULL::uuid AS prd_id,
    c.content,
    1 - (ce.embedding <=> query_embedding) AS similarity,
        p.file_name AS document_title,
    NULL::text AS image_url,
    'prd'::text AS doc_type
  FROM chunks c
  JOIN chunk_embeddings ce ON c.id = ce.chunk_id
  JOIN prds p ON c.document_id = p.id
  WHERE c.document_id IS NOT NULL
    AND c.prd_id IS NULL
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function: match_chunks_by_document
-- Searches within a SPECIFIC design document for semantically similar chunks
CREATE OR REPLACE FUNCTION match_chunks_by_document(
  query_embedding vector(1536),
  doc_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  prd_id uuid,
  content text,
  similarity float,
  document_title text,
  image_url text,
  doc_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    NULL::uuid AS prd_id,
    c.content,
    1 - (ce.embedding <=> query_embedding) AS similarity,
    d.page_name AS document_title,
    d.image_url,
    'design'::text AS doc_type
  FROM chunks c
  JOIN chunk_embeddings ce ON c.id = ce.chunk_id
  JOIN designs d ON c.document_id = d.id
  WHERE c.document_id = doc_id
    AND c.document_id IS NOT NULL
    AND c.prd_id IS NULL
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: match_chunks_by_prd
-- Searches within a SPECIFIC PRD for semantically similar chunks
-- Handles both new structure (prd_id) and legacy structure (document_id pointing to prds table)
CREATE OR REPLACE FUNCTION match_chunks_by_prd(
  query_embedding vector(1536),
  prd_id_param uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  prd_id uuid,
  content text,
  similarity float,
  document_title text,
  image_url text,
  doc_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Search chunks with prd_id (new structure)
  (
    SELECT
      c.id,
      NULL::uuid AS document_id,
      c.prd_id,
      c.content,
      1 - (ce.embedding <=> query_embedding) AS similarity,
        p.file_name AS document_title,
      NULL::text AS image_url,
      'prd'::text AS doc_type
    FROM chunks c
    JOIN chunk_embeddings ce ON c.id = ce.chunk_id
    JOIN prds p ON c.prd_id = p.id
    WHERE c.prd_id = prd_id_param
      AND c.prd_id IS NOT NULL
      AND c.document_id IS NULL
      AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  )
  UNION ALL
  -- Search chunks with document_id pointing to PRD (legacy structure)
  (
    SELECT
      c.id,
      c.document_id,
      NULL::uuid AS prd_id,
      c.content,
      1 - (ce.embedding <=> query_embedding) AS similarity,
        p.file_name AS document_title,
      NULL::text AS image_url,
      'prd'::text AS doc_type
    FROM chunks c
    JOIN chunk_embeddings ce ON c.id = ce.chunk_id
    JOIN prds p ON c.document_id = p.id
    WHERE c.document_id = prd_id_param
      AND c.document_id IS NOT NULL
      AND c.prd_id IS NULL
      AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION match_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION match_chunks_by_document TO authenticated;
GRANT EXECUTE ON FUNCTION match_chunks_by_prd TO authenticated;
GRANT EXECUTE ON FUNCTION match_chunks TO anon;
GRANT EXECUTE ON FUNCTION match_chunks_by_document TO anon;
GRANT EXECUTE ON FUNCTION match_chunks_by_prd TO anon;

