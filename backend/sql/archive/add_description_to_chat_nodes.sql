-- Add description column to chat_nodes table
ALTER TABLE chat_nodes ADD COLUMN description TEXT DEFAULT 'No description available.';

-- Add a comment on the column
COMMENT ON COLUMN chat_nodes.description IS 'A text description providing more information about the node'; 