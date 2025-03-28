/**
 * Yjs Mock Utility
 * 
 * This module provides mocks for Yjs document, awareness, and other Yjs structures
 * to enable better testing of real-time collaboration features without requiring
 * actual Yjs instances.
 */

import { Node, Edge } from 'reactflow';
// Import the type definitions we created
import { UserAwarenessState, YjsContext } from '../../types/yjs';

// Interface for the mock Yjs context that our components use
export interface MockYjsContext extends Omit<YjsContext, 'ydoc'> {
  ydoc: MockYDoc;
  isConnected: boolean;
  isOffline: boolean;
  offlineChangesCount: number;
  syncStatus: string | null;
  connectedUsers: UserAwarenessState[];
  updateAwareness: (data: Partial<UserAwarenessState>) => void;
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

// Interface for our mock Yjs map
export interface MockYjsMap<K extends string, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  delete(key: K): void;
  forEach(callback: (value: V, key: K) => void): void;
  toJSON(): Record<string, V>;
}

// Interface for our mock Y.Doc
export interface MockYDoc {
  getMap(name: 'nodes'): MockYjsMap<string, Node>;
  getMap(name: 'edges'): MockYjsMap<string, Edge>;
  getMap(name: string): MockYjsMap<string, unknown> | null;
  transact(callback: () => void): void;
}

// Factory function to create a mock Y.Doc instance
export function createMockYDoc(): MockYDoc {
  // Simple in-memory structure to mimic Y.Doc behavior
  const store = {
    nodes: new Map<string, Node>(),
    edges: new Map<string, Edge>(),
    awareness: new Map<number, UserAwarenessState>(),
  };

  // Define map getters with proper types
  const getMockNodeMap = (): MockYjsMap<string, Node> => ({
    get: (id: string) => store.nodes.get(id),
    set: (id: string, value: Node) => { store.nodes.set(id, value); },
    delete: (id: string) => { store.nodes.delete(id); },
    forEach: (callback: (value: Node, key: string) => void) => {
      store.nodes.forEach((value, key) => callback(value, key));
    },
    toJSON: () => {
      const result: Record<string, Node> = {};
      store.nodes.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    },
  });

  const getMockEdgeMap = (): MockYjsMap<string, Edge> => ({
    get: (id: string) => store.edges.get(id),
    set: (id: string, value: Edge) => { store.edges.set(id, value); },
    delete: (id: string) => { store.edges.delete(id); },
    forEach: (callback: (value: Edge, key: string) => void) => {
      store.edges.forEach((value, key) => callback(value, key));
    },
    toJSON: () => {
      const result: Record<string, Edge> = {};
      store.edges.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    },
  });

  // Mock object to simulate a Y.Doc with method overloads
  const mockYDoc = {
    // Method overloads need to be implemented as a single function with type checking
    getMap(name: string): MockYjsMap<string, Node> | MockYjsMap<string, Edge> | null {
      if (name === 'nodes') {
        return getMockNodeMap();
      } else if (name === 'edges') {
        return getMockEdgeMap();
      }
      return null;
    },
    
    // Mock transaction API
    transact: (callback: () => void) => {
      callback();
    },
  } as MockYDoc; // Type assertion to match the interface

  return mockYDoc;
}

// Factory function to create a mock awareness instance
export function createMockAwareness(): MockYjsAwareness {
  const clients = new Map<number, UserAwarenessState>();
  let localClientId = 1;

  return {
    getLocalState: () => clients.get(localClientId) || {},
    setLocalState: (state: UserAwarenessState) => {
      clients.set(localClientId, state);
    },
    getStates: () => {
      const states: Record<number, UserAwarenessState> = {};
      clients.forEach((state, clientId) => {
        states[clientId] = state;
      });
      return states;
    },
    on: (_event: string, _callback: () => void) => {
      // Simplified event handling
      return () => {}; // Return cleanup function
    },
    off: (_event: string, _callback: () => void) => {
      // No-op for mock
    },
    setLocalStateField: (field: string, value: unknown) => {
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
    destroy: () => {
      // No-op for mock
    },
  };
}

// Mock awareness interface
export interface MockYjsAwareness {
  getLocalState(): UserAwarenessState;
  setLocalState(state: UserAwarenessState): void;
  getStates(): Record<number, UserAwarenessState>;
  on(event: string, callback: () => void): () => void;
  off(event: string, callback: () => void): void;
  setLocalStateField(field: string, value: unknown): void;
  getLocalClientId(): number;
  setLocalClientId(id: number): void;
  destroy(): void;
}

// Create a complete mock Yjs context for use in tests
export function createMockYjsContext(initialNodes: Node[] = [], initialEdges: Edge[] = []): MockYjsContext {
  const mockYDoc = createMockYDoc();
  const mockAwareness = createMockAwareness();
  const isConnected = true;
  const isOffline = false;
  const hasPendingSyncs = false;

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
    updateAwareness: (data: Partial<UserAwarenessState>) => {
      mockAwareness.setLocalState({
        ...mockAwareness.getLocalState(),
        ...data
      });
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
      return true;
    },
  };
}

// Helper to simulate Yjs network events
export function simulateYjsNetworkEvent(context: MockYjsContext, event: 'connect' | 'disconnect'): void {
  if (event === 'connect') {
    (context as { isConnected: boolean; isOffline: boolean }).isConnected = true;
    (context as { isConnected: boolean; isOffline: boolean }).isOffline = false;
  } else if (event === 'disconnect') {
    (context as { isConnected: boolean; isOffline: boolean }).isConnected = false;
    (context as { isConnected: boolean; isOffline: boolean }).isOffline = true;
  }
}

// Helper to simulate other users joining/leaving
export function simulateUserJoin(context: MockYjsContext, userId: string, userData: UserAwarenessState): void {
  const updatedUsers = [...context.connectedUsers, { id: userId, ...userData }];
  (context as { connectedUsers: UserAwarenessState[] }).connectedUsers = updatedUsers;
}

export function simulateUserLeave(context: MockYjsContext, userId: string): void {
  const updatedUsers = context.connectedUsers.filter(user => user.id !== userId);
  (context as { connectedUsers: UserAwarenessState[] }).connectedUsers = updatedUsers;
} 