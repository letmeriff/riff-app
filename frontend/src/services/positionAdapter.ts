// Define the common interface for position management
export interface PositionAdapter {
  // Core position update operations
  updateNodePosition: (nodeId: string, x: number, y: number) => Promise<boolean>;
  getNodePositions: (nodeIds: string[]) => Promise<{[nodeId: string]: {x: number, y: number}}>;
  
  // Subscription methods
  subscribeToPositionUpdates: (callback: (updates: any) => void) => () => void;
  
  // Batch operations
  batchUpdatePositions: (updates: {nodeId: string, x: number, y: number}[]) => Promise<boolean>;
  
  // Connection status
  isConnected: () => boolean;
  isOffline: () => boolean;
  
  // Sync operations
  forceSync: () => Promise<boolean>;
  hasPendingChanges: () => boolean;
}

// Feature flag detection
export const isYjsEnabled = (): boolean => {
  // Yjs has been fully implemented and the legacy CRDT code has been removed
  // This function now always returns true
  return true;
};

// Factory function to get the appropriate adapter based on configuration
export const getPositionAdapter = (): PositionAdapter => {
  // Yjs is now the only implementation
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./yjsPositionAdapter').default;
}; 