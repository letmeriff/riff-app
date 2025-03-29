-- Add CRDT-related columns to chat_nodes table
ALTER TABLE chat_nodes 
ADD COLUMN IF NOT EXISTS vector_clock JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS position_updated_at TIMESTAMP WITH TIME ZONE;

-- Initialize vector clocks for existing nodes
UPDATE chat_nodes
SET vector_clock = json_build_object(user_id, 1)
WHERE vector_clock IS NULL OR vector_clock = '{}'::jsonb;

-- Set position_updated_at for existing nodes
UPDATE chat_nodes
SET position_updated_at = created_at
WHERE position_updated_at IS NULL;

COMMENT ON COLUMN chat_nodes.vector_clock IS 'Vector clock used for conflict resolution in CRDT implementation';
COMMENT ON COLUMN chat_nodes.position_updated_at IS 'Timestamp of when the node position was last updated'; 