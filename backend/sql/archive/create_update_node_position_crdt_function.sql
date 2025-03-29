-- Create or replace CRDT update function for node positions
CREATE OR REPLACE FUNCTION update_node_position_crdt(
  node_id INTEGER,
  pos_x DOUBLE PRECISION,
  pos_y DOUBLE PRECISION,
  vector_clock JSONB,
  lamport_timestamp BIGINT,
  user_id UUID
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
  current_vector_clock JSONB;
  should_apply BOOLEAN := TRUE;
BEGIN
  -- Get current vector clock
  SELECT n.vector_clock INTO current_vector_clock
  FROM chat_nodes n
  WHERE n.node_id = update_node_position_crdt.node_id;
  
  -- Check if this update should be applied (using vector clock comparison)
  -- An update is applied if:
  -- 1. The current node has no vector clock yet (first update)
  -- 2. The new vector clock dominates the current one
  -- 3. The vector clocks are concurrent but the lamport timestamp is higher
  
  IF current_vector_clock IS NULL OR current_vector_clock = '{}'::jsonb THEN
    should_apply := TRUE;
  ELSIF (
    -- Check if any value in vector_clock is higher than the corresponding value in current_vector_clock
    -- This is a simplified dominance check
    EXISTS (
      SELECT 1
      FROM jsonb_each_text(vector_clock) AS new_clock(user_key, user_count)
      LEFT JOIN jsonb_each_text(current_vector_clock) AS curr_clock(user_key, user_count)
        ON new_clock.user_key = curr_clock.user_key
      WHERE 
        (curr_clock.user_count IS NULL) OR 
        (CAST(new_clock.user_count AS INTEGER) > CAST(curr_clock.user_count AS INTEGER))
    )
    -- AND check that no value in current_vector_clock is higher than vector_clock
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each_text(current_vector_clock) AS curr_clock(user_key, user_count)
      LEFT JOIN jsonb_each_text(vector_clock) AS new_clock(user_key, user_count)
        ON curr_clock.user_key = new_clock.user_key
      WHERE 
        (new_clock.user_count IS NULL) OR 
        (CAST(curr_clock.user_count AS INTEGER) > CAST(new_clock.user_count AS INTEGER))
    )
  ) THEN
    -- New vector clock dominates current one
    should_apply := TRUE;
  ELSIF NOT EXISTS (
    -- Check if current_vector_clock dominates vector_clock
    SELECT 1
    FROM jsonb_each_text(current_vector_clock) AS curr_clock(user_key, user_count)
    LEFT JOIN jsonb_each_text(vector_clock) AS new_clock(user_key, user_count)
      ON curr_clock.user_key = new_clock.user_key
    WHERE 
      (new_clock.user_count IS NULL) OR 
      (CAST(curr_clock.user_count AS INTEGER) > CAST(new_clock.user_count AS INTEGER))
  ) THEN
    -- Vector clocks are concurrent, use lamport timestamp to break tie
    SELECT lamport_timestamp > COALESCE(
      (SELECT MAX(lamport_timestamp) 
       FROM node_position_history 
       WHERE node_id = update_node_position_crdt.node_id),
      0
    ) INTO should_apply;
  ELSE
    -- Current vector clock dominates new one, don't apply
    should_apply := FALSE;
  END IF;
  
  -- Record this operation in history regardless of whether it's applied
  INSERT INTO node_position_history (
    node_id, position_x, position_y, user_id, vector_clock, 
    lamport_timestamp, is_applied
  ) VALUES (
    update_node_position_crdt.node_id, pos_x, pos_y, user_id, 
    vector_clock, lamport_timestamp, should_apply
  );
  
  -- Update the node position if this update should be applied
  IF should_apply THEN
    UPDATE chat_nodes
    SET 
      position_x = pos_x,
      position_y = pos_y,
      vector_clock = vector_clock,
      position_updated_at = NOW()
    WHERE node_id = update_node_position_crdt.node_id;
  END IF;
  
  -- Return the result
  result := json_build_object(
    'node_id', update_node_position_crdt.node_id,
    'position_x', pos_x,
    'position_y', pos_y,
    'vector_clock', vector_clock,
    'lamport_timestamp', lamport_timestamp,
    'applied', should_apply
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_node_position_crdt IS 'Applies node position updates with CRDT conflict resolution using vector clocks'; 