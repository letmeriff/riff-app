-- Add extracted_content column to chat_attachments table
ALTER TABLE chat_attachments ADD COLUMN IF NOT EXISTS extracted_content TEXT;

-- Comment explaining the purpose of this column
COMMENT ON COLUMN chat_attachments.extracted_content IS 'Stores extracted text from PDF files for AI processing';
