/**
 * Yjs Mock Utility
 * 
 * This module provides mocks for Yjs document, awareness, and other Yjs structures
 * to enable better testing of real-time collaboration features without requiring
 * actual Yjs instances.
 */

import { Node, Edge } from 'reactflow';
import * as Y from 'yjs';

// Interface for the mock Yjs context that our components use
export interface MockYjsContext {
  ydoc: any;
  isConnected: boolean;
  isOffline: boolean;
  offlineChangesCount: number;
  syncStatus: string | null;
  connectedUsers: any[];
  updateAwareness: (data: any) => void;
  getNodesFromYjs: () => Node[];
  getEdgesFromYjs: () => Edge[];
  syncNodeToYjs: (node: Node) => void;
  syncEdgeToYjs: (edge: Edge) => void;
  deleteNodeFromYjs: (nodeId: string) => void;
  deleteEdgeFromYjs: (edgeId: string) => void;
  isFeatureEnabled: boolean;
  hasPendingSyncs: boolean;
  forceSync: () => Promise<boolean>;
}

// Factory function to create a mock Y.Doc instance
export function createMockYDoc() {
  // Simple in-memory structure to mimic Y.Doc behavior
  const store = {
    nodes: new Map<string, Node>(),
    edges: new Map<string, Edge>(),
    awareness: new Map<number, any>(),
  };

  // Mock object to simulate a Y.Doc
  const mockYDoc = {
    // Mock methods to get/set data
    getMap: (name: string) => {
      if (name === 'nodes' || name === 'edges') {
        return {
          get: (id: string) => store[name].get(id),
          set: (id: string, value: any) => store[name].set(id, value),
          delete: (id: string) => store[name].delete(id),
          forEach: (callback: (value: any, key: string) => void) => {
            store[name].forEach((value, key) => callback(value, key));
          },
          toJSON: () => {
            const result: Record<string, any> = {};
            store[name].forEach((value, key) => {
              result[key] = value;
            });
            return result;
          },
        };
      }
      return null;
    },
    // Mock transaction API
    transact: (callback: () => void) => {
      callback();
    },
  };

  return mockYDoc;
}

// Factory function to create a mock awareness instance
export function createMockAwareness() {
  const clients = new Map<number, any>();
  let localClientId = 1;

  return {
    getLocalState: () => clients.get(localClientId) || {},
    setLocalState: (state: any) => {
      clients.set(localClientId, state);
    },
    getStates: () => {
      const states: Record<number, any> = {};
      clients.forEach((state, clientId) => {
        states[clientId] = state;
      });
      return states;
    },
    on: (event: string, callback: any) => {
      // Simplified event handling
      return () => {}; // Return cleanup function
    },
    off: (event: string, callback: any) => {},
    setLocalStateField: (field: string, value: any) => {
      const currentState = clients.get(localClientId) || {};
      clients.set(localClientId, {
        ...currentState,
        [field]: value,
      });
    },
    getLocalClientId: () => localClientId,
    setLocalClientId: (id: number) => {
      localClientId = id;
    },
    destroy: () => {},
  };
}

// Create a complete mock Yjs context for use in tests
export function createMockYjsContext(initialNodes: Node[] = [], initialEdges: Edge[] = []): MockYjsContext {
  const mockYDoc = createMockYDoc();
  const mockAwareness = createMockAwareness();
  let isConnected = true;
  let isOffline = false;
  let hasPendingSyncs = false;

  // Initialize with initial nodes and edges
  initialNodes.forEach(node => {
    const nodesMap = mockYDoc.getMap('nodes');
    if (nodesMap) nodesMap.set(node.id, node);
  });
  
  initialEdges.forEach(edge => {
    const edgesMap = mockYDoc.getMap('edges');
    if (edgesMap) edgesMap.set(edge.id, edge);
  });

  return {
    ydoc: mockYDoc,
    isConnected,
    isOffline,
    offlineChangesCount: 0,
    syncStatus: null,
    connectedUsers: [],
    updateAwareness: (data: any) => {
      mockAwareness.setLocalState(data);
    },
    getNodesFromYjs: () => {
      const nodes: Node[] = [];
      const nodesMap = mockYDoc.getMap('nodes');
      if (nodesMap) {
        nodesMap.forEach((node: Node) => {
          nodes.push(node);
        });
      }
      return nodes;
    },
    getEdgesFromYjs: () => {
      const edges: Edge[] = [];
      const edgesMap = mockYDoc.getMap('edges');
      if (edgesMap) {
        edgesMap.forEach((edge: Edge) => {
          edges.push(edge);
        });
      }
      return edges;
    },
    syncNodeToYjs: (node: Node) => {
      const nodesMap = mockYDoc.getMap('nodes');
      if (nodesMap) nodesMap.set(node.id, node);
    },
    syncEdgeToYjs: (edge: Edge) => {
      const edgesMap = mockYDoc.getMap('edges');
      if (edgesMap) edgesMap.set(edge.id, edge);
    },
    deleteNodeFromYjs: (nodeId: string) => {
      const nodesMap = mockYDoc.getMap('nodes');
      if (nodesMap) nodesMap.delete(nodeId);
    },
    deleteEdgeFromYjs: (edgeId: string) => {
      const edgesMap = mockYDoc.getMap('edges');
      if (edgesMap) edgesMap.delete(edgeId);
    },
    isFeatureEnabled: true,
    hasPendingSyncs,
    forceSync: async () => {
      hasPendingSyncs = false;
      return true;
    },
  };
}

// Helper to simulate Yjs network events
export function simulateYjsNetworkEvent(context: MockYjsContext, event: 'connect' | 'disconnect') {
  if (event === 'connect') {
    (context as any).isConnected = true;
    (context as any).isOffline = false;
  } else if (event === 'disconnect') {
    (context as any).isConnected = false;
    (context as any).isOffline = true;
  }
}

// Helper to simulate other users joining/leaving
export function simulateUserJoin(context: MockYjsContext, userId: string, userData: any) {
  const updatedUsers = [...context.connectedUsers, { id: userId, ...userData }];
  (context as any).connectedUsers = updatedUsers;
}

export function simulateUserLeave(context: MockYjsContext, userId: string) {
  const updatedUsers = context.connectedUsers.filter(user => user.id !== userId);
  (context as any).connectedUsers = updatedUsers;
} 