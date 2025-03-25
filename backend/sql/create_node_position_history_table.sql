-- Create node position history table
CREATE TABLE IF NOT EXISTS node_position_history (
  id SERIAL PRIMARY KEY,
  node_id INTEGER REFERENCES chat_nodes(node_id) ON DELETE CASCADE,
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  vector_clock JSONB NOT NULL,
  lamport_timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_applied BOOLEAN DEFAULT TRUE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_node_position_history_node_id ON node_position_history(node_id);
CREATE INDEX IF NOT EXISTS idx_node_position_history_lamport ON node_position_history(lamport_timestamp);

-- Create policies
CREATE POLICY "Allow authenticated users to insert position history" 
ON node_position_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow authenticated users to read position history" 
ON node_position_history
FOR SELECT
TO authenticated
USING (node_id IN (
  SELECT node_id FROM chat_nodes WHERE user_id = auth.uid() OR owner_id = auth.uid()
));

COMMENT ON TABLE node_position_history IS 'Stores the history of position changes for nodes with CRDT metadata for conflict resolution.'; 