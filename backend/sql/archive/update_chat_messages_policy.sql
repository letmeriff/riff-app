-- Drop any existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read chat messages" ON chat_messages;

-- Create policy for authenticated users to read all chat messages
CREATE POLICY "Allow authenticated users to read chat messages" ON chat_messages
FOR SELECT
TO authenticated
USING (true);

-- Make sure other permissions are restricted appropriately
DROP POLICY IF EXISTS "Allow authenticated users to insert chat messages" ON chat_messages;
CREATE POLICY "Allow authenticated users to insert chat messages" ON chat_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IN (
  SELECT owner_id FROM chat_nodes WHERE node_id = chat_messages.node_id
));
