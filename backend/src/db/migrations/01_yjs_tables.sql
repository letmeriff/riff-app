-- Migration for Yjs document storage
-- Create table for Yjs document snapshots
CREATE TABLE IF NOT EXISTS yjs_documents (
  id SERIAL PRIMARY KEY,
  document_id TEXT NOT NULL UNIQUE,
  document_content BYTEA NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster document retrieval
CREATE INDEX IF NOT EXISTS idx_yjs_documents_document_id ON yjs_documents(document_id);

-- Create table for Yjs update history
CREATE TABLE IF NOT EXISTS yjs_updates (
  id SERIAL PRIMARY KEY,
  document_id TEXT NOT NULL,
  update_content BYTEA NOT NULL,
  client_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (document_id) REFERENCES yjs_documents(document_id)
);

-- Create indices for efficient update retrieval
CREATE INDEX IF NOT EXISTS idx_yjs_updates_document_id ON yjs_updates(document_id);
CREATE INDEX IF NOT EXISTS idx_yjs_updates_version ON yjs_updates(version); 