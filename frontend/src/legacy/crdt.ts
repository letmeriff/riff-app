/**
 * @deprecated Types for CRDT (Conflict-free Replicated Data Types) implementation
 * Used for handling node position synchronization with conflict resolution
 * This file is maintained for backward compatibility and will be removed in future releases.
 */

/**
 * @deprecated Vector clock representation for tracking causal relationships
 * Maps user IDs to logical clock values
 */
export type VectorClock = Record<string, number>;

/**
 * @deprecated Represents a node position update operation
 * This interface will be removed once the transition to Yjs is complete.
 */
export interface NodePositionOperation {
  nodeId: string;
  position: { x: number; y: number };
  vectorClock: VectorClock;
  lamportTimestamp: number;
  userId: string;
  applied?: boolean;
}

/**
 * @deprecated Represents an entry in the node position history
 * This interface will be removed once the transition to Yjs is complete.
 */
export interface NodePositionHistory {
  id: number;
  node_id: number;
  position_x: number;
  position_y: number;
  user_id: string;
  vector_clock: VectorClock;
  lamport_timestamp: number;
  created_at: string;
  is_applied: boolean;
} 