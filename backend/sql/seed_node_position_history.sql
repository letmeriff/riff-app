-- Seed node_position_history table with test data
-- This is for demonstration and testing of the CRDT position history

-- Insert test position history entries for node_id 1
INSERT INTO node_position_history (
  node_id,
  position_x,
  position_y,
  user_id,
  vector_clock,
  lamport_timestamp,
  is_applied,
  created_at
)
VALUES
  -- Oldest first, applied positions
  (1, 100.0, 150.0, 'user1', '{"user1": 1}', 1, true, NOW() - INTERVAL '1 day'),
  (1, 120.0, 170.0, 'user1', '{"user1": 2}', 2, true, NOW() - INTERVAL '23 hours'),
  (1, 130.0, 180.0, 'user2', '{"user1": 2, "user2": 1}', 3, true, NOW() - INTERVAL '22 hours'),
  (1, 140.0, 190.0, 'user1', '{"user1": 3, "user2": 1}', 4, true, NOW() - INTERVAL '21 hours'),
  (1, 145.0, 195.0, 'user2', '{"user1": 3, "user2": 2}', 5, true, NOW() - INTERVAL '20 hours'),
  
  -- Recent positions, mix of applied and not applied
  (1, 150.0, 200.0, 'user1', '{"user1": 4, "user2": 2}', 6, true, NOW() - INTERVAL '2 hours'),
  (1, 155.0, 205.0, 'user2', '{"user1": 4, "user2": 3}', 7, true, NOW() - INTERVAL '1 hour'),
  (1, 160.0, 210.0, 'user1', '{"user1": 5, "user2": 3}', 8, false, NOW() - INTERVAL '30 minutes');

-- Insert test position history entries for node_id 2
INSERT INTO node_position_history (
  node_id,
  position_x,
  position_y,
  user_id,
  vector_clock,
  lamport_timestamp,
  is_applied,
  created_at
)
VALUES
  -- Only a couple of entries for this node
  (2, 300.0, 350.0, 'user1', '{"user1": 1}', 1, true, NOW() - INTERVAL '12 hours'),
  (2, 320.0, 370.0, 'user2', '{"user1": 1, "user2": 1}', 2, true, NOW() - INTERVAL '10 hours'),
  (2, 340.0, 390.0, 'user1', '{"user1": 2, "user2": 1}', 3, true, NOW() - INTERVAL '8 hours');

-- Example of conflict entries with same vector clock but different positions
INSERT INTO node_position_history (
  node_id,
  position_x,
  position_y,
  user_id,
  vector_clock,
  lamport_timestamp,
  is_applied,
  created_at
)
VALUES
  -- Two concurrent updates - higher lamport timestamp wins
  (3, 400.0, 450.0, 'user1', '{"user1": 1}', 1, true, NOW() - INTERVAL '5 hours'),
  (3, 420.0, 470.0, 'user1', '{"user1": 2}', 2, true, NOW() - INTERVAL '4 hours'),
  (3, 440.0, 490.0, 'user2', '{"user2": 1}', 3, false, NOW() - INTERVAL '3 hours 5 minutes'),
  (3, 460.0, 510.0, 'user1', '{"user1": 3}', 4, true, NOW() - INTERVAL '3 hours'); 