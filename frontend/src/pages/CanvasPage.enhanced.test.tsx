/**
 * CanvasPage Enhanced Tests
 * 
 * This file contains comprehensive tests for the CanvasPage component,
 * covering core functionality, edge cases, and integration with Yjs.
 * It uses the mock utilities for ReactFlow and Yjs to test real-time
 * collaboration features without depending on actual instances.
 */

import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Node, Edge, Connection } from 'reactflow';

// Mock CSS imports
jest.mock('reactflow/dist/style.css', () => ({}));
jest.mock('../styles/reactflow.css', () => ({}));

// Import mock utilities
import {
  createTestNode,
  createTestEdge,
  createMockYjsContext,
  simulateYjsNetworkEvent,
  simulateUserJoin,
  simulateUserLeave
} from '../test-utils/mocks';

// Import the component
import CanvasPage from './CanvasPage';

// Mock the required contexts
jest.mock('../contexts/AuthContext', () => ({
  AuthContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children
  },
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    session: { user: { id: 'user-1' } }
  })
}));

jest.mock('../contexts/SocketContext', () => ({
  SocketContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children
  },
  useSocket: () => ({
    socket: { 
      on: jest.fn(), 
      off: jest.fn(), 
      emit: jest.fn() 
    },
    connectionStatus: 'connected'
  })
}));

// Advanced Yjs context mock with test control
const mockYjsContext = createMockYjsContext();
let mockIsConnected = true;
let mockIsOffline = false;
let mockHasPendingSyncs = false;

jest.mock('../contexts/YjsContext', () => ({
  YjsContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children
  },
  useYjs: () => ({
    ydoc: mockYjsContext.ydoc,
    isConnected: mockIsConnected,
    isOffline: mockIsOffline,
    offlineChangesCount: 0,
    syncStatus: null,
    connectedUsers: mockYjsContext.connectedUsers,
    updateAwareness: jest.fn(),
    getNodesFromYjs: () => mockYjsContext.getNodesFromYjs(),
    getEdgesFromYjs: () => mockYjsContext.getEdgesFromYjs(),
    syncNodeToYjs: (node: Node) => mockYjsContext.syncNodeToYjs(node),
    syncEdgeToYjs: (edge: Edge) => mockYjsContext.syncEdgeToYjs(edge),
    deleteNodeFromYjs: (nodeId: string) => mockYjsContext.deleteNodeFromYjs(nodeId),
    deleteEdgeFromYjs: (edgeId: string) => mockYjsContext.deleteEdgeFromYjs(edgeId),
    isFeatureEnabled: true,
    hasPendingSyncs: mockHasPendingSyncs,
    forceSync: () => Promise.resolve(true),
  })
}));

// Mock components
jest.mock('../components/FloatingMenu', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="floating-menu">
      <button 
        data-testid="create-node-button" 
        onClick={() => props.onCreateNode && props.onCreateNode()}
      >
        Create Node
      </button>
    </div>
  )
}));

jest.mock('../components/ChatNode', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid={`chat-node-${props.id}`} data-nodeid={props.id}>
      {props.data?.content}
      <button 
        data-testid={`delete-node-${props.id}`} 
        onClick={() => props.data?.onDeleteNode && props.data.onDeleteNode(props.id)}
      >
        Delete
      </button>
    </div>
  )
}));

jest.mock('../components/UserCursors', () => ({
  __esModule: true,
  default: () => <div data-testid="user-cursors">User Cursors</div>
}));

jest.mock('../components/CollaborationStatus', () => ({
  __esModule: true,
  default: () => <div data-testid="collaboration-status">Collaboration Status</div>
}));

// Enhanced ReactFlow mock with more realistic behavior
jest.mock('reactflow', () => {
  return {
    __esModule: true,
    default: function ReactFlow(props) {
      return (
        <div data-testid="react-flow">
          <div data-testid="nodes">
            {props.nodes && props.nodes.map((node) => (
              <div key={node.id} data-testid={`node-${node.id}`} data-nodeid={node.id}>
                {/* Simulate rendering node content */}
                <div data-testid={`chat-node-${node.id}`}>{node.data?.content}</div>
              </div>
            ))}
          </div>
          <div data-testid="edges">
            {props.edges && props.edges.map((edge) => (
              <div key={edge.id} data-testid={`edge-${edge.id}`} data-edgeid={edge.id}>
                {edge.source} → {edge.target}
              </div>
            ))}
          </div>
          <button 
            data-testid="add-node-button" 
            onClick={() => {
              if (props.onNodesChange) {
                props.onNodesChange([{ 
                  type: 'add', 
                  item: { id: 'new-node', position: { x: 100, y: 100 }, data: {} } 
                }])
              }
            }}
          >
            Add Node
          </button>
          <button 
            data-testid="add-edge-button" 
            onClick={() => {
              if (props.onConnect) {
                props.onConnect({ source: 'node-1', target: 'node-2' })
              }
            }}
          >
            Add Edge
          </button>
          <button 
            data-testid="move-node-button" 
            onClick={() => {
              if (props.onNodesChange) {
                props.onNodesChange([{ 
                  type: 'position', 
                  id: 'node-1', 
                  position: { x: 200, y: 200 } 
                }])
              }
            }}
          >
            Move Node
          </button>
          <button 
            data-testid="select-node-button" 
            onClick={() => {
              if (props.onNodesChange) {
                props.onNodesChange([{ 
                  type: 'select', 
                  id: 'node-1', 
                  selected: true
                }])
              }
            }}
          >
            Select Node
          </button>
          {props.children}
        </div>
      );
    },
    Background: () => <div data-testid="background">Background</div>,
    Controls: () => <div data-testid="controls">Controls</div>,
    MiniMap: () => <div data-testid="minimap">MiniMap</div>,
    useNodesState: () => {
      const nodesState = useState([]);
      const [nodes, setNodes] = nodesState;
      
      const onNodesChange = (changes) => {
        setNodes((nds) => {
          return changes.reduce((acc, change) => {
            if (change.type === 'add') {
              return [...acc, change.item];
            } else if (change.type === 'remove') {
              return acc.filter((node) => node.id !== change.id);
            } else if (change.type === 'position') {
              return acc.map((node) => {
                if (node.id === change.id) {
                  return {
                    ...node,
                    position: change.position,
                  };
                }
                return node;
              });
            } else if (change.type === 'select') {
              return acc.map((node) => {
                if (node.id === change.id) {
                  return {
                    ...node,
                    selected: change.selected,
                  };
                }
                return node;
              });
            }
            return acc;
          }, nds);
        });
      };
      
      return [nodes, setNodes, onNodesChange];
    },
    useEdgesState: () => {
      const edgesState = useState([]);
      const [edges, setEdges] = edgesState;
      
      const onEdgesChange = (changes) => {
        setEdges((eds) => {
          return changes.reduce((acc, change) => {
            if (change.type === 'add') {
              return [...acc, change.item];
            } else if (change.type === 'remove') {
              return acc.filter((edge) => edge.id !== change.id);
            } else if (change.type === 'select') {
              return acc.map((edge) => {
                if (edge.id === change.id) {
                  return {
                    ...edge,
                    selected: change.selected,
                  };
                }
                return edge;
              });
            }
            return acc;
          }, eds);
        });
      };
      
      return [edges, setEdges, onEdgesChange];
    },
    addEdge: (params, edges) => {
      if (!params.source || !params.target) return edges;
      const newEdge = {
        id: `${params.source}-${params.target}`,
        source: params.source,
        target: params.target,
      };
      return [...edges, newEdge];
    },
    updateEdge: (oldEdge, newConnection, edges) => {
      if (!newConnection.source || !newConnection.target) return edges;
      return edges.map((edge) => {
        if (edge.id === oldEdge.id) {
          return {
            ...edge,
            source: newConnection.source,
            target: newConnection.target,
          };
        }
        return edge;
      });
    },
  };
});

// Mock services
import * as nodeService from '../services/nodeService';
jest.mock('../services/nodeService', () => ({
  fetchNodes: jest.fn().mockResolvedValue([
    { 
      node_id: 'node-1', 
      content: 'Test Node 1',
      position: { x: 100, y: 100 },
    },
    { 
      node_id: 'node-2', 
      content: 'Test Node 2',
      position: { x: 300, y: 200 },
    }
  ]),
  createNode: jest.fn().mockResolvedValue({ 
    node_id: 'new-node', 
    content: 'New Node',
    position: { x: 400, y: 300 },
  }),
  deleteNode: jest.fn().mockResolvedValue(true),
  updateNodePosition: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/contextPullService', () => ({
  getContextPullsForNode: jest.fn().mockResolvedValue([]),
  getNodesPullingFromNode: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          gt: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        }),
      }),
      insert: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/signed-url' },
        }),
      }),
    },
  },
}));

describe('CanvasPage Component - Enhanced Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Yjs mock state
    mockIsConnected = true;
    mockIsOffline = false;
    mockHasPendingSyncs = false;
    // Reset connected users
    mockYjsContext.connectedUsers = [];
  });

  describe('Core Rendering', () => {
    test('renders ReactFlow with correct components', async () => {
      render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Wait for nodes to be loaded
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // Check that essential components are rendered
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      expect(screen.getByTestId('background')).toBeInTheDocument();
      expect(screen.getByTestId('controls')).toBeInTheDocument();
      expect(screen.getByTestId('minimap')).toBeInTheDocument();
      expect(screen.getByTestId('floating-menu')).toBeInTheDocument();
      expect(screen.getByTestId('user-cursors')).toBeInTheDocument();
      expect(screen.getByTestId('collaboration-status')).toBeInTheDocument();
    });
  });

  describe('Node Operations', () => {
    test('creates a new node when create node button is clicked', async () => {
      render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Click create node button in floating menu
      fireEvent.click(screen.getByTestId('create-node-button'));
      
      // Check if createNode service was called
      await waitFor(() => {
        expect(nodeService.createNode).toHaveBeenCalled();
      });
    });
    
    test('selects a node when clicked', async () => {
      const onNodeSelectMock = jest.fn();
      render(<CanvasPage onNodeSelect={onNodeSelectMock} />);
      
      // Wait for nodes to be loaded
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // Simulate node selection
      fireEvent.click(screen.getByTestId('select-node-button'));
      
      // Check if onNodeSelect callback was called
      await waitFor(() => {
        expect(onNodeSelectMock).toHaveBeenCalledWith('node-1', null);
      });
    });
    
    test('updates node position when moved', async () => {
      render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Wait for nodes to be loaded
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // Simulate node movement
      fireEvent.click(screen.getByTestId('move-node-button'));
      
      // Check if updateNodePosition service was called
      await waitFor(() => {
        expect(nodeService.updateNodePosition).toHaveBeenCalledWith(
          'node-1',
          expect.objectContaining({ x: 200, y: 200 })
        );
      });
    });
  });

  describe('Edge Operations', () => {
    test('creates an edge when connecting nodes', async () => {
      render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Wait for nodes to be loaded
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // Simulate edge creation
      fireEvent.click(screen.getByTestId('add-edge-button'));
      
      // Check if edge was created
      await waitFor(() => {
        expect(screen.getByTestId('edge-node-1-node-2')).toBeInTheDocument();
      });
    });
  });

  describe('Yjs Integration', () => {
    test('syncs with Yjs when online', async () => {
      mockIsConnected = true;
      
      render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Wait for nodes to be loaded
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // Create a new node
      fireEvent.click(screen.getByTestId('create-node-button'));
      
      // Check if node was synced to Yjs
      await waitFor(() => {
        expect(mockYjsContext.getNodesFromYjs().length).toBeGreaterThan(0);
      });
    });
    
    test('handles offline mode correctly', async () => {
      // Simulate offline mode
      mockIsConnected = false;
      mockIsOffline = true;
      
      render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Wait for nodes to be loaded
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // Create a new node in offline mode
      fireEvent.click(screen.getByTestId('create-node-button'));
      
      // Check if node was created locally
      await waitFor(() => {
        expect(screen.getByTestId('node-new-node')).toBeInTheDocument();
      });
    });
    
    test('handles syncing of pending changes when reconnecting', async () => {
      // Start offline
      mockIsConnected = false;
      mockIsOffline = true;
      mockHasPendingSyncs = true;
      
      const { rerender } = render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Wait for initial render
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // Simulate reconnection
      mockIsConnected = true;
      mockIsOffline = false;
      
      // Force rerender to simulate reconnection
      rerender(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Check if sync was attempted
      await waitFor(() => {
        expect(mockHasPendingSyncs).toBe(false);
      });
    });
  });

  describe('Collaboration Features', () => {
    test('shows other users in the collaboration UI', async () => {
      // Add some mock users
      simulateUserJoin(mockYjsContext, 'user-2', { 
        name: 'Test User 2',
        color: '#ff0000',
        position: { x: 150, y: 150 }
      });
      
      render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Wait for nodes to be loaded
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // Check if collaboration status shows user presence
      expect(screen.getByTestId('user-cursors')).toBeInTheDocument();
      expect(screen.getByTestId('collaboration-status')).toBeInTheDocument();
    });
  });
  
  describe('Error Handling', () => {
    test('handles errors when fetching nodes fails', async () => {
      // Mock a failure
      (nodeService.fetchNodes as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch nodes'));
      
      render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Verify it doesn't crash
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // The component should still render
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
    
    test('handles errors when creating nodes fails', async () => {
      // Mock a failure
      (nodeService.createNode as jest.Mock).mockRejectedValueOnce(new Error('Failed to create node'));
      
      render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Wait for initial render
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // Try to create a node
      fireEvent.click(screen.getByTestId('create-node-button'));
      
      // Verify it called the service
      await waitFor(() => {
        expect(nodeService.createNode).toHaveBeenCalled();
      });
      
      // The component should still render
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });
  
  describe('Performance Considerations', () => {
    test('debounces position updates to avoid excessive API calls', async () => {
      jest.useFakeTimers();
      
      render(<CanvasPage onNodeSelect={jest.fn()} />);
      
      // Wait for nodes to be loaded
      await waitFor(() => {
        expect(nodeService.fetchNodes).toHaveBeenCalled();
      });
      
      // Simulate multiple node movements in quick succession
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getByTestId('move-node-button'));
      }
      
      // Fast-forward timers to trigger debounced updates
      jest.runAllTimers();
      
      // Check that updateNodePosition was only called once despite multiple movements
      expect(nodeService.updateNodePosition).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });
  });
}); 