/**
 * Multi-User Test Harness
 * 
 * This module provides utilities for testing collaborative features with multiple
 * simulated users. It creates a controlled environment where multiple Yjs clients
 * can interact with the same document without requiring real-time networking.
 */

import * as Y from 'yjs';
import { Node, Edge } from 'reactflow';

// Define more specific types for node and edge data
interface NodeData {
  timestamp?: number;
  [key: string]: unknown;
}

interface EdgeData {
  timestamp?: number;
  [key: string]: unknown;
}

// Node and edge data structure as stored in Yjs
interface YjsNode {
  id: string;
  position: {
    x: number;
    y: number;
    timestamp?: number;
  };
  data: NodeData;
  type?: string;
  style?: Record<string, unknown>;
}

interface YjsEdge {
  id: string;
  source: string;
  target: string;
  data?: EdgeData;
  style?: Record<string, unknown>;
  animated?: boolean;
}

interface MockClient {
  id: string;
  doc: Y.Doc;
  getNode: (id: string) => Node | undefined;
  createNode: (nodeData: Partial<Node>) => string;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  deleteNode: (nodeId: string) => void;
  getEdge: (id: string) => Edge | undefined;
  createEdge: (edgeData: Partial<Edge>) => string;
  updateEdge: (edgeId: string, updates: Partial<Edge>) => void;
  deleteEdge: (edgeId: string) => void;
  disconnect: () => void;
  connect: () => void;
  isOnline: boolean;
}

interface TestEnvironment {
  clients: MockClient[];
  syncAll: () => void;
  cleanup: () => void;
  waitForSync: (timeout?: number) => Promise<void>;
  disconnectClient: (clientIndex: number) => void;
  reconnectClient: (clientIndex: number) => void;
}

/**
 * Creates a test environment with multiple users for collaborative testing
 * 
 * @param numClients Number of clients to create (default: 3)
 * @returns Test environment with methods for controlling collaboration
 */
export function createTestMultiUserEnvironment(numClients: number = 3): TestEnvironment {
  const clientDocs: Y.Doc[] = [];
  const mockClients: MockClient[] = [];
  const disconnectedUpdates: Map<number, Uint8Array[]> = new Map();
  const updateQueue: Array<{clientIndex: number, update: Uint8Array}> = [];
  
  // Create specified number of clients
  for (let i = 0; i < numClients; i++) {
    const doc = new Y.Doc();
    clientDocs.push(doc);
    
    // Create shared data structures if they don't exist
    const nodesMap = doc.getMap('nodes');
    const edgesMap = doc.getMap('edges');
    // Commented out as it's unused
    // const metadataMap = doc.getMap('metadata');
    
    // Helper function to get a node from the Yjs document
    const getNode = (id: string): Node | undefined => {
      if (!nodesMap.has(id)) return undefined;
      
      const yjsNode = nodesMap.get(id) as unknown as YjsNode;
      if (!yjsNode) return undefined;
      
      return {
        id,
        position: yjsNode.position,
        data: yjsNode.data,
        type: yjsNode.type
      };
    };
    
    // Helper function to create a node in the Yjs document
    const createNode = (nodeData: Partial<Node>): string => {
      const id = nodeData.id || `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      doc.transact(() => {
        // Create a Yjs Map for the node
        const nodeMap = new Y.Map();
        
        // Set node properties
        nodeMap.set('id', id);
        
        // Set position
        const position = nodeData.position || { x: 0, y: 0 };
        const positionMap = new Y.Map();
        positionMap.set('x', position.x);
        positionMap.set('y', position.y);
        nodeMap.set('position', positionMap.toJSON());
        
        // Set data
        const data = nodeData.data || {};
        const dataMap = new Y.Map();
        for (const key in data) {
          dataMap.set(key, data[key]);
        }
        nodeMap.set('data', dataMap.toJSON());
        
        // Set type if provided
        if (nodeData.type) {
          nodeMap.set('type', nodeData.type);
        }
        
        // Add the node to the nodes map
        nodesMap.set(id, nodeMap.toJSON());
      });
      
      return id;
    };
    
    // Helper function to update a node in the Yjs document
    const updateNode = (nodeId: string, updates: Partial<Node>): void => {
      doc.transact(() => {
        if (!nodesMap.has(nodeId)) return;
        
        const nodeData = nodesMap.get(nodeId) as unknown as YjsNode;
        if (!nodeData) return;
        
        // Apply updates
        if (updates.position) {
          nodeData.position = {
            ...nodeData.position,
            ...updates.position,
            timestamp: Date.now()
          };
        }
        
        if (updates.data) {
          nodeData.data = {
            ...nodeData.data,
            ...updates.data,
            timestamp: Date.now()
          };
        }
        
        if (updates.type) {
          nodeData.type = updates.type;
        }
        
        // Write back to shared map
        nodesMap.set(nodeId, nodeData);
      });
    };
    
    // Helper function to delete a node from the Yjs document
    const deleteNode = (nodeId: string): void => {
      doc.transact(() => {
        nodesMap.delete(nodeId);
      });
    };
    
    // Helper function to get an edge from the Yjs document
    const getEdge = (id: string): Edge | undefined => {
      if (!edgesMap.has(id)) return undefined;
      
      const yjsEdge = edgesMap.get(id) as unknown as YjsEdge;
      if (!yjsEdge) return undefined;
      
      return {
        id,
        source: yjsEdge.source,
        target: yjsEdge.target,
        data: yjsEdge.data,
        animated: yjsEdge.animated
      };
    };
    
    // Helper function to create an edge in the Yjs document
    const createEdge = (edgeData: Partial<Edge>): string => {
      const id = edgeData.id || `edge-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      if (!edgeData.source || !edgeData.target) {
        throw new Error('Edge must have source and target');
      }
      
      doc.transact(() => {
        // Create a Yjs Map for the edge
        const edgeMap = new Y.Map();
        
        // Set edge properties
        edgeMap.set('id', id);
        edgeMap.set('source', edgeData.source);
        edgeMap.set('target', edgeData.target);
        
        // Set data if provided
        if (edgeData.data) {
          const dataMap = new Y.Map();
          for (const key in edgeData.data) {
            dataMap.set(key, edgeData.data[key]);
          }
          edgeMap.set('data', dataMap.toJSON());
        }
        
        // Set animated if provided
        if (edgeData.animated !== undefined) {
          edgeMap.set('animated', edgeData.animated);
        }
        
        // Add the edge to the edges map
        edgesMap.set(id, edgeMap.toJSON());
      });
      
      return id;
    };
    
    // Helper function to update an edge in the Yjs document
    const updateEdge = (edgeId: string, updates: Partial<Edge>): void => {
      doc.transact(() => {
        if (!edgesMap.has(edgeId)) return;
        
        const edgeData = edgesMap.get(edgeId) as unknown as YjsEdge;
        if (!edgeData) return;
        
        // Apply updates
        if (updates.source) {
          edgeData.source = updates.source;
        }
        
        if (updates.target) {
          edgeData.target = updates.target;
        }
        
        if (updates.data) {
          edgeData.data = {
            ...edgeData.data || {},
            ...updates.data,
            timestamp: Date.now()
          };
        }
        
        if (updates.animated !== undefined) {
          edgeData.animated = updates.animated;
        }
        
        // Write back to shared map
        edgesMap.set(edgeId, edgeData);
      });
    };
    
    // Helper function to delete an edge from the Yjs document
    const deleteEdge = (edgeId: string): void => {
      doc.transact(() => {
        edgesMap.delete(edgeId);
      });
    };
    
    // Create the client object
    const client: MockClient = {
      id: `user${i + 1}`,
      doc,
      getNode,
      createNode,
      updateNode,
      deleteNode,
      getEdge,
      createEdge,
      updateEdge,
      deleteEdge,
      disconnect: () => {
        client.isOnline = false;
        disconnectedUpdates.set(i, []);
        
        // Set up update capture for this client
        doc.on('update', (update: Uint8Array) => {
          if (!client.isOnline) {
            const updates = disconnectedUpdates.get(i) || [];
            updates.push(update);
            disconnectedUpdates.set(i, updates);
          } else {
            // When online, add to sync queue
            updateQueue.push({ clientIndex: i, update });
          }
        });
      },
      connect: () => {
        client.isOnline = true;
        
        // Apply any updates that happened while disconnected
        const updates = disconnectedUpdates.get(i) || [];
        updates.forEach(update => {
          updateQueue.push({ clientIndex: i, update });
        });
        
        disconnectedUpdates.delete(i);
      },
      isOnline: true
    };
    
    // Set up update forwarding
    doc.on('update', (update: Uint8Array) => {
      if (client.isOnline) {
        updateQueue.push({ clientIndex: i, update });
      }
    });
    
    mockClients.push(client);
  }
  
  // Helper function to synchronize all clients
  const syncAll = () => {
    // Process the update queue
    while (updateQueue.length > 0) {
      const { clientIndex, update } = updateQueue.shift()!;
      
      // Apply this update to all other clients
      for (let i = 0; i < mockClients.length; i++) {
        if (i !== clientIndex && mockClients[i].isOnline) {
          Y.applyUpdate(mockClients[i].doc, update);
        }
      }
    }
  };
  
  // Helper function to wait for synchronization to complete
  const waitForSync = (timeout: number = 100): Promise<void> => {
    return new Promise<void>((resolve) => {
      // Process any pending updates
      syncAll();
      
      // Wait a bit to ensure all updates are processed
      setTimeout(() => {
        syncAll();
        resolve();
      }, timeout);
    });
  };
  
  // Helper function to disconnect a client
  const disconnectClient = (clientIndex: number): void => {
    if (clientIndex >= 0 && clientIndex < mockClients.length) {
      mockClients[clientIndex].disconnect();
    }
  };
  
  // Helper function to reconnect a client
  const reconnectClient = (clientIndex: number): void => {
    if (clientIndex >= 0 && clientIndex < mockClients.length) {
      mockClients[clientIndex].connect();
      syncAll();
    }
  };
  
  // Helper function to clean up resources
  const cleanup = () => {
    clientDocs.forEach(doc => {
      doc.destroy();
    });
    updateQueue.length = 0;
    disconnectedUpdates.clear();
  };
  
  return {
    clients: mockClients,
    syncAll,
    cleanup,
    waitForSync,
    disconnectClient,
    reconnectClient
  };
} 