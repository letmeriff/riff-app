-- Add a framework column to the chat_nodes table
-- The column references the frameworks table's name column
ALTER TABLE chat_nodes ADD COLUMN framework TEXT REFERENCES frameworks(name) ON DELETE SET NULL; 