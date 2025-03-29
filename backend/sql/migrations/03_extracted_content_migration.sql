-- SQL script to add extracted_content column to chat_attachments table
ALTER TABLE chat_attachments
ADD COLUMN IF NOT EXISTS extracted_content TEXT;

-- Update existing PDF files to have NULL extracted_content
UPDATE chat_attachments
SET extracted_content = NULL
WHERE file_type = 'application/pdf' AND extracted_content IS NULL;

-- Display the updated schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_attachments'; 