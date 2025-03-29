-- Drop any existing policies for node position updates
DROP POLICY IF EXISTS "Allow authenticated users to update node positions" ON chat_nodes;

-- Create policy that allows users to update position_x and position_y columns on nodes they own
CREATE POLICY "Allow authenticated users to update node positions" 
ON chat_nodes
FOR UPDATE
TO authenticated
USING (auth.uid() IN (user_id, owner_id))
WITH CHECK (auth.uid() IN (user_id, owner_id));

-- Add this comment as documentation
COMMENT ON POLICY "Allow authenticated users to update node positions" ON chat_nodes IS 
'Allow users to update the position of nodes they created or own.';
