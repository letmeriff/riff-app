-- Add position_x and position_y columns to chat_nodes table
ALTER TABLE chat_nodes ADD COLUMN position_x FLOAT DEFAULT 0;
ALTER TABLE chat_nodes ADD COLUMN position_y FLOAT DEFAULT 0;

-- Update existing nodes with random positions
UPDATE chat_nodes SET 
  position_x = (RANDOM() * 500), 
  position_y = (RANDOM() * 500);
