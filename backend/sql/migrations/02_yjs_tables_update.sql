-- Migration to update Yjs tables schema to match code
-- Update yjs_documents table
ALTER TABLE IF EXISTS yjs_documents 
RENAME COLUMN document_content TO document_state;

-- Add is_compressed column to yjs_documents
ALTER TABLE IF EXISTS yjs_documents 
ADD COLUMN IF NOT EXISTS is_compressed BOOLEAN DEFAULT FALSE;

-- Update yjs_updates table
ALTER TABLE IF EXISTS yjs_updates 
RENAME COLUMN update_content TO update;

-- Add is_compressed column to yjs_updates
ALTER TABLE IF EXISTS yjs_updates 
ADD COLUMN IF NOT EXISTS is_compressed BOOLEAN DEFAULT FALSE; 