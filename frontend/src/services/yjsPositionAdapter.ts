import * as Y from 'yjs';
import { PositionAdapter } from './positionAdapter';
import { 
  updateNodePositionYjs, 
  getNodesFromYjs,
  subscribeToYjsChanges,
  forceDocumentSync,
  hasPendingChanges
} from './yjsService';

/**
 * Yjs-based implementation of the PositionAdapter interface
 * This adapter encapsulates all Yjs-specific position management functionality
 */
class YjsPositionAdapter implements PositionAdapter {
  /**
   * Updates a node's position using Yjs
   */
  updateNodePosition = async (nodeId: string, x: number, y: number): Promise<boolean> => {
    try {
      const result = updateNodePositionYjs(nodeId, { x, y });
      return result !== null;
    } catch (error) {
      console.error('Error updating node position in Yjs:', error);
      return false;
    }
  };

  /**
   * Retrieves node positions from the Yjs document
   */
  getNodePositions = async (nodeIds: string[]): Promise<{[nodeId: string]: {x: number, y: number}}> => {
    try {
      // Get all nodes from Yjs
      const allNodes = getNodesFromYjs();
      
      // Filter to only the requested nodeIds and extract positions
      const positions: {[nodeId: string]: {x: number, y: number}} = {};
      allNodes.forEach(node => {
        if (nodeIds.includes(node.id)) {
          positions[node.id] = { x: node.position.x, y: node.position.y };
        }
      });
      
      return positions;
    } catch (error) {
      console.error('Error getting node positions from Yjs:', error);
      return {};
    }
  };

  /**
   * Subscribes to position updates from the Yjs document
   * Returns an unsubscribe function
   */
  subscribeToPositionUpdates = (callback: (updates: any) => void): (() => void) => {
    return subscribeToYjsChanges(callback);
  };

  /**
   * Batch updates multiple node positions at once
   */
  batchUpdatePositions = async (updates: {nodeId: string, x: number, y: number}[]): Promise<boolean> => {
    try {
      // Process updates one by one since we don't have a batch update function
      for (const update of updates) {
        updateNodePositionYjs(update.nodeId, { x: update.x, y: update.y });
      }
      return true;
    } catch (error) {
      console.error('Error batch updating positions in Yjs:', error);
      return false;
    }
  };

  /**
   * Returns the current connection status to the Yjs WebSocket provider
   */
  isConnected = (): boolean => {
    // Access the WebSocket provider from the window object
    const wsProvider = (window as any).yjsWebsocketProvider;
    return wsProvider ? wsProvider.wsconnected : false;
  };

  /**
   * Returns whether the client is currently offline
   */
  isOffline = (): boolean => {
    return !navigator.onLine;
  };

  /**
   * Forces synchronization of the Yjs document
   */
  forceSync = async (): Promise<boolean> => {
    try {
      return await forceDocumentSync();
    } catch (error) {
      console.error('Error forcing sync in Yjs:', error);
      return false;
    }
  };

  /**
   * Checks if there are any pending changes to be synchronized
   */
  hasPendingChanges = (): boolean => {
    return hasPendingChanges();
  };
}

// Export a singleton instance
const yjsPositionAdapter = new YjsPositionAdapter();
export default yjsPositionAdapter; 