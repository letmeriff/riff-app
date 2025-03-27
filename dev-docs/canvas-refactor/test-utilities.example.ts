/**
 * Canvas Refactoring Test Utilities
 * 
 * This file provides mock implementations and test utilities for testing
 * the refactored Canvas components and hooks.
 */

import { Node, Edge, NodeChange, EdgeChange, Connection } from 'reactflow';
import * as Y from 'yjs';

/**
 * ReactFlow Test Utilities
 */

/**
 * Mock for useNodesState hook from ReactFlow
 */
export const createMockUseNodesState = (initialNodes: Node[] = []) => {
  let nodes = [...initialNodes];
  const setNodes = jest.fn((newNodes: Node[] | ((prevNodes: Node[]) => Node[])) => {
    if (typeof newNodes === 'function') {
      nodes = newNodes(nodes);
    } else {
      nodes = newNodes;
    }
    return nodes;
  });
  
  const onNodesChange = jest.fn((changes: NodeChange[]) => {
    changes.forEach(change => {
      if (change.type === 'add') {
        nodes.push(change.item);
      } else if (change.type === 'remove') {
        nodes = nodes.filter(node => node.id !== change.id);
      } else if (change.type === 'position') {
        const node = nodes.find(n => n.id === change.id);
        if (node && change.position) {
          node.position = change.position;
        }
      }
    });
  });
  
  return [nodes, setNodes, onNodesChange] as const;
};

/**
 * Mock for useEdgesState hook from ReactFlow
 */
export const createMockUseEdgesState = (initialEdges: Edge[] = []) => {
  let edges = [...initialEdges];
  const setEdges = jest.fn((newEdges: Edge[] | ((prevEdges: Edge[]) => Edge[])) => {
    if (typeof newEdges === 'function') {
      edges = newEdges(edges);
    } else {
      edges = newEdges;
    }
    return edges;
  });
  
  const onEdgesChange = jest.fn((changes: EdgeChange[]) => {
    changes.forEach(change => {
      if (change.type === 'add') {
        edges.push(change.item);
      } else if (change.type === 'remove') {
        edges = edges.filter(edge => edge.id !== change.id);
      }
    });
  });
  
  return [edges, setEdges, onEdgesChange] as const;
};

/**
 * Mock ReactFlow component props
 */
export const createMockReactFlowProps = () => ({
  nodes: [],
  edges: [],
  onNodesChange: jest.fn(),
  onEdgesChange: jest.fn(),
  onConnect: jest.fn(),
  onNodeClick: jest.fn(),
  onNodeDrag: jest.fn(),
  onNodeDragStop: jest.fn(),
  onPaneClick: jest.fn(),
  nodeTypes: {},
  edgeTypes: {},
});

/**
 * Create a mock connection event
 */
export const createMockConnection = (source: string, target: string): Connection => ({
  source,
  target,
  sourceHandle: null,
  targetHandle: null,
});

/**
 * Yjs Test Utilities
 */

/**
 * Create a mock Y.Doc with maps for nodes and edges
 */
export const createMockYDoc = () => {
  const nodesMap = new Map<string, any>();
  const edgesMap = new Map<string, any>();
  const awarenessStates = new Map<number, any>();

  // Mock Y.Doc methods
  const mockYDoc = {
    getMap: jest.fn((name: string) => {
      if (name === 'nodes') {
        return {
          set: jest.fn((key: string, value: any) => nodesMap.set(key, value)),
          get: jest.fn((key: string) => nodesMap.get(key)),
          has: jest.fn((key: string) => nodesMap.has(key)),
          delete: jest.fn((key: string) => nodesMap.delete(key)),
          forEach: jest.fn((callback: (value: any, key: string) => void) => {
            nodesMap.forEach((value, key) => callback(value, key));
          }),
          observe: jest.fn((callback: (event: any) => void) => {
            // Store callback for simulation
            return () => {}; // Return unobserve function
          }),
          toJSON: jest.fn(() => {
            const obj: Record<string, any> = {};
            nodesMap.forEach((value, key) => {
              obj[key] = value;
            });
            return obj;
          }),
        };
      } else if (name === 'edges') {
        return {
          set: jest.fn((key: string, value: any) => edgesMap.set(key, value)),
          get: jest.fn((key: string) => edgesMap.get(key)),
          has: jest.fn((key: string) => edgesMap.has(key)),
          delete: jest.fn((key: string) => edgesMap.delete(key)),
          forEach: jest.fn((callback: (value: any, key: string) => void) => {
            edgesMap.forEach((value, key) => callback(value, key));
          }),
          observe: jest.fn((callback: (event: any) => void) => {
            // Store callback for simulation
            return () => {}; // Return unobserve function
          }),
          toJSON: jest.fn(() => {
            const obj: Record<string, any> = {};
            edgesMap.forEach((value, key) => {
              obj[key] = value;
            });
            return obj;
          }),
        };
      }
      return {
        set: jest.fn(),
        get: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
        observe: jest.fn(() => () => {}),
        toJSON: jest.fn(() => ({})),
      };
    }),
    transact: jest.fn((callback: () => void) => {
      callback();
    }),
    on: jest.fn((eventName: string, callback: (event: any) => void) => {
      // Store callback for simulation
    }),
    off: jest.fn((eventName: string, callback: (event: any) => void) => {
      // Remove callback
    }),
  };

  // Mock awareness states and methods
  const mockAwareness = {
    getStates: jest.fn(() => awarenessStates),
    setLocalState: jest.fn((state: any) => {
      awarenessStates.set(1, state); // Use client ID 1 for local
    }),
    getLocalState: jest.fn(() => awarenessStates.get(1)),
    on: jest.fn((eventName: string, callback: (event: any) => void) => {
      // Store callback for simulation
    }),
    off: jest.fn((eventName: string, callback: (event: any) => void) => {
      // Remove callback
    }),
  };

  // Utility methods to help with testing
  const simulateNodeChange = (id: string, data: any) => {
    const nodeYMap = nodesMap.get(id);
    if (nodeYMap) {
      Object.entries(data).forEach(([key, value]) => {
        nodeYMap.set(key, value);
      });
    }
  };

  const simulateEdgeChange = (id: string, data: any) => {
    const edgeYMap = edgesMap.get(id);
    if (edgeYMap) {
      Object.entries(data).forEach(([key, value]) => {
        edgeYMap.set(key, value);
      });
    }
  };

  const simulateAwarenessChange = (clientId: number, state: any) => {
    awarenessStates.set(clientId, state);
    // Trigger callbacks if needed
  };

  return {
    ydoc: mockYDoc as unknown as Y.Doc,
    awareness: mockAwareness,
    nodesMap,
    edgesMap,
    awarenessStates,
    simulateNodeChange,
    simulateEdgeChange,
    simulateAwarenessChange,
  };
};

/**
 * Mock implementation of useYjs hook
 */
export const createMockUseYjs = () => {
  const mockYDoc = createMockYDoc();
  
  return {
    ydoc: mockYDoc.ydoc,
    awareness: mockYDoc.awareness,
    isConnected: true,
    isOffline: false,
    offlineChangesCount: 0,
    syncStatus: null,
    connectedUsers: [{ userId: 'user-1', clientId: 1 }],
    updateAwareness: jest.fn((state: any) => {
      mockYDoc.simulateAwarenessChange(1, state);
    }),
    getNodesFromYjs: jest.fn(() => {
      const nodes: Node[] = [];
      mockYDoc.nodesMap.forEach((nodeData, nodeId) => {
        nodes.push({
          id: nodeId,
          position: { x: nodeData.position?.x || 0, y: nodeData.position?.y || 0 },
          type: 'chatNode',
          data: nodeData.data || { label: 'Mock Node' },
        });
      });
      return nodes;
    }),
    getEdgesFromYjs: jest.fn(() => {
      const edges: Edge[] = [];
      mockYDoc.edgesMap.forEach((edgeData, edgeId) => {
        edges.push({
          id: edgeId,
          source: edgeData.source || '',
          target: edgeData.target || '',
          type: edgeData.type,
        });
      });
      return edges;
    }),
    isFeatureEnabled: true,
    hasPendingSyncs: false,
    forceSync: jest.fn().mockResolvedValue(true),
    _mockInternals: mockYDoc, // Expose internals for test manipulation
  };
};

/**
 * Multi-User Simulation Test Harness
 */
export const createMultiUserTestHarness = (userCount: number = 2) => {
  const users = Array.from({ length: userCount }, (_, i) => ({
    id: `user-${i + 1}`,
    clientId: i + 1,
    mockYDoc: createMockYDoc(),
    mockYjs: {} as ReturnType<typeof createMockUseYjs>,
  }));

  // Initialize the mock YJS for each user
  users.forEach((user) => {
    user.mockYjs = createMockUseYjs();
    user.mockYjs._mockInternals = user.mockYDoc;
  });

  // Simulate synchronization between users
  const synchronize = () => {
    // For each node in each user's doc, propagate to all other users
    users.forEach((sourceUser) => {
      sourceUser.mockYDoc.nodesMap.forEach((nodeData, nodeId) => {
        users.forEach((targetUser) => {
          if (targetUser.id !== sourceUser.id) {
            targetUser.mockYDoc.nodesMap.set(nodeId, { ...nodeData });
          }
        });
      });

      // Same for edges
      sourceUser.mockYDoc.edgesMap.forEach((edgeData, edgeId) => {
        users.forEach((targetUser) => {
          if (targetUser.id !== sourceUser.id) {
            targetUser.mockYDoc.edgesMap.set(edgeId, { ...edgeData });
          }
        });
      });
    });

    // Update awareness states across users
    users.forEach((sourceUser) => {
      sourceUser.mockYDoc.awarenessStates.forEach((state, clientId) => {
        users.forEach((targetUser) => {
          if (targetUser.id !== sourceUser.id) {
            targetUser.mockYDoc.awarenessStates.set(clientId, { ...state });
          }
        });
      });
    });
  };

  // Simulate a user going offline
  const setUserOffline = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      user.mockYjs.isConnected = false;
      user.mockYjs.isOffline = true;
    }
  };

  // Simulate a user coming back online
  const setUserOnline = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      user.mockYjs.isConnected = true;
      user.mockYjs.isOffline = false;
    }
  };

  return {
    users,
    synchronize,
    setUserOffline,
    setUserOnline,
  };
};

/**
 * Network Condition Simulation
 */
export const createNetworkSimulator = () => {
  let isOnline = true;
  const listeners: Array<(online: boolean) => void> = [];

  const setOnline = (online: boolean) => {
    isOnline = online;
    listeners.forEach((listener) => listener(online));
  };

  const addListener = (listener: (online: boolean) => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  };

  return {
    isOnline: () => isOnline,
    setOnline,
    addListener,
  };
};

/**
 * Performance Testing Utilities
 */
export const createPerformanceTester = () => {
  const measurements: Record<string, number[]> = {};

  const measure = async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    if (!measurements[name]) {
      measurements[name] = [];
    }
    
    measurements[name].push(end - start);
    return result;
  };

  const getAverageMeasurement = (name: string): number => {
    if (!measurements[name] || measurements[name].length === 0) {
      return 0;
    }
    
    const sum = measurements[name].reduce((a, b) => a + b, 0);
    return sum / measurements[name].length;
  };

  const getAllMeasurements = () => measurements;

  const clearMeasurements = (name?: string) => {
    if (name) {
      delete measurements[name];
    } else {
      Object.keys(measurements).forEach((key) => {
        delete measurements[key];
      });
    }
  };

  return {
    measure,
    getAverageMeasurement,
    getAllMeasurements,
    clearMeasurements,
  };
};

export default {
  createMockUseNodesState,
  createMockUseEdgesState,
  createMockReactFlowProps,
  createMockConnection,
  createMockYDoc,
  createMockUseYjs,
  createMultiUserTestHarness,
  createNetworkSimulator,
  createPerformanceTester,
}; 