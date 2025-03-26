import { PositionAdapter } from './positionAdapter';
import { 
  updateNodePosition as crdtUpdateNodePosition
} from './nodeService';
import { useCRDT } from '../contexts/CRDTContext';

/**
 * Legacy CRDT-based implementation of the PositionAdapter interface
 * This adapter encapsulates all legacy CRDT position management functionality
 */
class CRDTPositionAdapter implements PositionAdapter {
  private crdtContext: any = null;
  
  constructor() {
    // We can't directly use the context hook here, so we'll set it later
    // This will be set when a component uses the adapter
    setTimeout(() => {
      try {
        // Try to get CRDT context from a component that has initialized it
        const crdtContext = (window as any).__CRDT_CONTEXT__;
        if (crdtContext) {
          this.crdtContext = crdtContext;
        }
      } catch (e) {
        console.warn('Failed to get CRDT context, some features may not work');
      }
    }, 1000);
  }
  
  /**
   * Updates a node's position using the legacy CRDT implementation
   */
  updateNodePosition = async (nodeId: string, x: number, y: number): Promise<boolean> => {
    try {
      // Convert string nodeId to number for the legacy function
      const numericNodeId = parseInt(nodeId, 10);
      if (isNaN(numericNodeId)) {
        console.error('Invalid node ID for CRDT position update:', nodeId);
        return false;
      }
      
      const result = await crdtUpdateNodePosition(numericNodeId, { x, y });
      return result.success;
    } catch (error) {
      console.error('Error updating node position in CRDT:', error);
      return false;
    }
  };

  /**
   * Retrieves node positions from the Supabase
   */
  getNodePositions = async (nodeIds: string[]): Promise<{[nodeId: string]: {x: number, y: number}}> => {
    try {
      // The existing code doesn't have a direct API for this, so we'll make our own
      // In a real implementation, you would add a proper function to nodeService.ts
      
      // Simulating fetching from Supabase
      const positions: {[nodeId: string]: {x: number, y: number}} = {};
      
      // If CRDT context is available, try to get positions from there
      if (this.crdtContext && this.crdtContext.nodePositions) {
        nodeIds.forEach((nodeId) => {
          const nodePos = this.crdtContext.nodePositions[nodeId];
          if (nodePos) {
            positions[nodeId] = { x: nodePos.x, y: nodePos.y };
          }
        });
      }
      
      return positions;
    } catch (error) {
      console.error('Error getting node positions from CRDT:', error);
      return {};
    }
  };

  /**
   * Subscribes to position updates from the Socket.IO events
   * Returns an unsubscribe function
   */
  subscribeToPositionUpdates = (callback: (updates: any) => void): (() => void) => {
    // Since there's no direct subscription function in nodeService,
    // we'll implement a simple one based on socket events
    try {
      // Get socket from window object (assuming it's set up by the socket provider)
      const socket = (window as any).socket;
      
      if (socket) {
        // Listen for node-position-update events
        socket.on('node-position-update', callback);
        
        // Return function to unsubscribe
        return () => {
          socket.off('node-position-update', callback);
        };
      }
      
      // If no socket is available, return a no-op function
      return () => {};
    } catch (error) {
      console.error('Error subscribing to position updates:', error);
      return () => {};
    }
  };

  /**
   * Batch updates multiple node positions at once
   */
  batchUpdatePositions = async (updates: {nodeId: string, x: number, y: number}[]): Promise<boolean> => {
    try {
      // Since there's no batch update in the legacy code, we'll do them one by one
      const results = await Promise.all(
        updates.map(async (update) => {
          // Convert string nodeId to number for the legacy function
          const numericNodeId = parseInt(update.nodeId, 10);
          if (isNaN(numericNodeId)) {
            console.error('Invalid node ID for CRDT position update:', update.nodeId);
            return false;
          }
          
          const result = await crdtUpdateNodePosition(numericNodeId, { x: update.x, y: update.y });
          return result.success;
        })
      );
      
      // Return true if all updates succeeded
      return results.every(Boolean);
    } catch (error) {
      console.error('Error batch updating positions in CRDT:', error);
      return false;
    }
  };

  /**
   * Returns the current connection status to the Socket.IO
   */
  isConnected = (): boolean => {
    // Access the socket from the context if available
    if (this.crdtContext && this.crdtContext.isConnected) {
      return this.crdtContext.isConnected;
    }
    
    // Fallback to checking if the socket object exists on window
    const socket = (window as any).socket;
    return socket ? socket.connected : false;
  };

  /**
   * Returns whether the client is currently offline
   */
  isOffline = (): boolean => {
    return !navigator.onLine;
  };

  /**
   * Forces synchronization (not really applicable in the CRDT context, but implementing for interface)
   */
  forceSync = async (): Promise<boolean> => {
    try {
      // The CRDT implementation doesn't have a direct equivalent,
      // but we could trigger individual position updates for all known nodes
      if (this.crdtContext && this.crdtContext.nodePositions) {
        const positions = this.crdtContext.nodePositions;
        
        // Update each node position to force synchronization
        await Promise.all(
          Object.entries(positions).map(async ([nodeId, position]: [string, any]) => {
            const numericNodeId = parseInt(nodeId, 10);
            if (!isNaN(numericNodeId) && position) {
              await crdtUpdateNodePosition(numericNodeId, { x: position.x, y: position.y });
            }
          })
        );
      }
      return true;
    } catch (error) {
      console.error('Error forcing sync in CRDT:', error);
      return false;
    }
  };

  /**
   * Checks if there are any pending changes (not really applicable in CRDT, but implementing for interface)
   */
  hasPendingChanges = (): boolean => {
    // The CRDT system doesn't track pending changes in the same way,
    // so we'll always return false
    return false;
  };
}

// Export a singleton instance
const crdtPositionAdapter = new CRDTPositionAdapter();
export default crdtPositionAdapter;

// Add an initialization function to be called from a component with context
export const initCRDTAdapter = (crdtContext: any) => {
  (window as any).__CRDT_CONTEXT__ = crdtContext;
}; 