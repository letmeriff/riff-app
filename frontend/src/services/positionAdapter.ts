import { Node, Edge } from 'reactflow';

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
  // Check for explicit environment variable
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_USE_YJS === 'true') {
    return true;
  }
  
  // Check for window-based configuration (useful for runtime toggling)
  if (typeof window !== 'undefined' && (window as any).__USE_YJS === true) {
    return true;
  }
  
  // Default value - in production, this would be false until fully tested
  return true; // Currently defaulting to true for development
};

// Factory function to get the appropriate adapter based on configuration
export const getPositionAdapter = (): PositionAdapter => {
  if (isYjsEnabled()) {
    // This will be lazily imported to avoid loading Yjs code when not needed
    return require('./yjsPositionAdapter').default;
  } else {
    // Legacy CRDT implementation
    return require('./crdtPositionAdapter').default;
  }
}; 