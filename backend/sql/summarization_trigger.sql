-- Create a function that will be triggered when chat_messages are inserted
CREATE OR REPLACE FUNCTION trigger_summarization()
RETURNS TRIGGER AS $$
DECLARE
  message_count INTEGER;
BEGIN
  -- Count the number of messages for the node
  SELECT COUNT(*) INTO message_count
  FROM chat_messages
  WHERE node_id = NEW.node_id;

  -- If the message count exceeds 50, trigger summarization
  IF message_count >= 50 THEN
    -- Insert a pending summarization entry or update the existing one
    INSERT INTO chat_summaries (node_id, summary)
    VALUES (NEW.node_id, 'Pending summarization...')
    ON CONFLICT (node_id)
    DO UPDATE SET summary = 'Pending summarization...';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that runs after a new message is inserted
DROP TRIGGER IF EXISTS on_message_insert ON chat_messages;
CREATE TRIGGER on_message_insert
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION trigger_summarization(); 