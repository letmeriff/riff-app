-- Create a storage bucket for chat attachments
CREATE BUCKET chat-attachments;

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'chat-attachments');

-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated users to read files" ON storage.objects
  FOR SELECT
  USING (auth.role() = 'authenticated' AND bucket_id = 'chat-attachments');

-- Create a table for file metadata
CREATE TABLE chat_attachments (
  id SERIAL PRIMARY KEY,
  node_id INTEGER REFERENCES chat_nodes(node_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL, -- Path in Supabase Storage (e.g., 'chat-attachments/123/file.pdf')
  file_name TEXT NOT NULL, -- Original file name
  file_type TEXT NOT NULL, -- MIME type (e.g., 'application/pdf')
  file_size INTEGER NOT NULL, -- Size in bytes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security on the chat_attachments table
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert attachments for nodes they can access
CREATE POLICY chat_attachments_insert ON chat_attachments
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND node_id IN (
      SELECT node_id FROM chat_nodes WHERE owner_id = auth.uid()
      OR node_id IN (SELECT node_id FROM collaborators WHERE user_id = auth.uid())
    )
  );

-- Allow users to read attachments for nodes they own or collaborate on
CREATE POLICY chat_attachments_read ON chat_attachments
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND node_id IN (
      SELECT node_id FROM chat_nodes WHERE owner_id = auth.uid()
      OR node_id IN (SELECT node_id FROM collaborators WHERE user_id = auth.uid())
    )
  ); 