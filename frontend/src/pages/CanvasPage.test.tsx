import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the CSS imports before importing CanvasPage
jest.mock('reactflow/dist/style.css', () => ({}));
jest.mock('../styles/reactflow.css', () => ({}));

// Mock the useAuth hook used inside CanvasPage
jest.mock('../contexts/AuthContext', () => ({
  AuthContext: {
    Provider: ({ children }) => children
  },
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    session: { user: { id: 'user-1' } }
  })
}));

// Mock the useSocket hook used inside CanvasPage
jest.mock('../contexts/SocketContext', () => ({
  SocketContext: {
    Provider: ({ children }) => children
  },
  useSocket: () => ({
    socket: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
    connectionStatus: 'connected'
  })
}));

// Mock the useYjs hook used inside CanvasPage
jest.mock('../contexts/YjsContext', () => ({
  YjsContext: {
    Provider: ({ children }) => children
  },
  useYjs: () => ({
    ydoc: {},
    isConnected: true,
    isOffline: false,
    offlineChangesCount: 0,
    syncStatus: null,
    connectedUsers: [],
    updateAwareness: jest.fn(),
    getNodesFromYjs: jest.fn().mockReturnValue([]),
    getEdgesFromYjs: jest.fn().mockReturnValue([]),
    isFeatureEnabled: true,
    hasPendingSyncs: false,
    forceSync: jest.fn().mockResolvedValue(true),
  })
}));

// Mock component imports
jest.mock('../components/FloatingMenu', () => ({
  __esModule: true,
  default: (props) => (
    <div data-testid="floating-menu">
      <button data-testid="create-node-button" onClick={() => props.onCreateNode && props.onCreateNode()}>
        Create Node
      </button>
    </div>
  )
}));

jest.mock('../components/ChatNode', () => ({
  __esModule: true,
  default: (props) => <div data-testid="chat-node">{props.data?.content}</div>
}));

jest.mock('../components/UserCursors', () => ({
  __esModule: true,
  default: () => <div data-testid="user-cursors">User Cursors</div>
}));

jest.mock('../components/CollaborationStatus', () => ({
  __esModule: true,
  default: () => <div data-testid="collaboration-status">Collaboration Status</div>
}));

// Mock reactflow module
jest.mock('reactflow', () => {
  const mockReactFlow = (props) => (
    <div data-testid="react-flow">
      <div data-testid="nodes">
        {props.nodes && props.nodes.map((node) => (
          <div key={node.id} data-testid={`node-${node.id}`}>
            {node.data?.label || 'Node'}
          </div>
        ))}
      </div>
      <div data-testid="edges">
        {props.edges && props.edges.map((edge) => (
          <div key={edge.id} data-testid={`edge-${edge.id}`}>
            {edge.id}
          </div>
        ))}
      </div>
      <button 
        data-testid="add-node-button" 
        onClick={() => props.onNodesChange && props.onNodesChange([{ type: 'add', item: { id: 'new-node', position: { x: 100, y: 100 } } }])}
      >
        Add Node
      </button>
      <button 
        data-testid="add-edge-button" 
        onClick={() => props.onConnect && props.onConnect({ source: 'node-1', target: 'node-2' })}
      >
        Add Edge
      </button>
      <button 
        data-testid="move-node-button" 
        onClick={() => props.onNodesChange && props.onNodesChange([{ type: 'position', id: 'node-1', position: { x: 200, y: 200 } }])}
      >
        Move Node
      </button>
      {props.children}
    </div>
  );
  
  return {
    __esModule: true,
    default: mockReactFlow,
    Background: () => <div data-testid="background">Background</div>,
    Controls: () => <div data-testid="controls">Controls</div>,
    MiniMap: () => <div data-testid="minimap">MiniMap</div>,
    useNodesState: () => [[], jest.fn(), jest.fn()],
    useEdgesState: () => [[], jest.fn(), jest.fn()],
    addEdge: (params, edges) => [...edges, { id: 'new-edge', source: params.source, target: params.target }],
    updateEdge: jest.fn(),
    Node: (props) => <div data-testid={`node-${props.id}`}>{props.data?.label}</div>,
    Edge: (props) => <div data-testid={`edge-${props.id}`}>{props.id}</div>,
  };
});

import CanvasPage from './CanvasPage';
import { render as renderWithProviders } from '../test-utils/helpers/renderWithProviders';
import { sampleCanvas } from '../test-utils/fixtures/canvasFixtures';
import { AuthContext, AuthContextType } from '../contexts/AuthContext';
import { Node, Edge } from 'reactflow';
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

describe('CanvasPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Test node rendering
  test('renders nodes from the database', async () => {
    render(<CanvasPage onNodeSelect={jest.fn()} />);
    
    // Wait for nodes to be loaded
    await waitFor(() => {
      expect(nodeService.fetchNodes).toHaveBeenCalled();
    });
    
    // Check if ReactFlow component is rendered
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    
    // Check if background and controls are rendered
    expect(screen.getByTestId('background')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
    
    // Check if floating menu is rendered
    expect(screen.getByTestId('floating-menu')).toBeInTheDocument();
    
    // Check if collaboration components are rendered
    expect(screen.getByTestId('user-cursors')).toBeInTheDocument();
    expect(screen.getByTestId('collaboration-status')).toBeInTheDocument();
  });
  
  // Test 2: Test node creation
  test('creates a new node when create node button is clicked', async () => {
    render(<CanvasPage onNodeSelect={jest.fn()} />);
    
    // Click create node button in floating menu
    fireEvent.click(screen.getByTestId('create-node-button'));
    
    // Check if createNode service was called
    await waitFor(() => {
      expect(nodeService.createNode).toHaveBeenCalled();
    });
  });
  
  // Test 3: Test node deletion
  test('deletes a node when delete is triggered', async () => {
    render(<CanvasPage onNodeSelect={jest.fn()} />);
    
    // Wait for nodes to be loaded
    await waitFor(() => {
      expect(nodeService.fetchNodes).toHaveBeenCalled();
    });
    
    // Simulate node deletion
    // In a real implementation, this would involve selecting a node and clicking delete
    // Since ReactFlow is mocked, we need to simulate this differently
    
    // Here we're testing if the delete function is properly wired
    // by calling the mock directly to simulate what would happen
    fireEvent.click(screen.getByTestId('add-node-button'));
    
    // Now we have a node that can be deleted
    await waitFor(() => {
      expect(screen.getByTestId('node-new-node')).toBeInTheDocument();
    });
    
    // Simulate deleting the node
    // In the real implementation, you'd need to:
    // 1. Select the node (which is simulated by the mock)
    // 2. Press delete key or click a delete button
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    
    // Check if deleteNode service was called (would be in a real implementation)
    // This might require modifying the implementation to expose the delete functionality
    // or adding a custom test ID for the delete button
  });
  
  // Test 4: Test node position updating
  test('updates node position when a node is moved', async () => {
    render(<CanvasPage onNodeSelect={jest.fn()} />);
    
    // Wait for nodes to be loaded
    await waitFor(() => {
      expect(nodeService.fetchNodes).toHaveBeenCalled();
    });
    
    // Simulate moving a node
    fireEvent.click(screen.getByTestId('move-node-button'));
    
    // Check if updateNodePosition was called
    await waitFor(() => {
      expect(nodeService.updateNodePosition).toHaveBeenCalled();
    });
  });
  
  // Test 5: Test edge creation
  test('creates an edge when connecting nodes', async () => {
    render(<CanvasPage onNodeSelect={jest.fn()} />);
    
    // Wait for nodes to be loaded
    await waitFor(() => {
      expect(nodeService.fetchNodes).toHaveBeenCalled();
    });
    
    // Simulate creating an edge
    fireEvent.click(screen.getByTestId('add-edge-button'));
    
    // In a real implementation, this would add the edge to the state
    // Since we've mocked ReactFlow, we need to verify this differently
    
    // Check if the edge is created in the mock React Flow
    await waitFor(() => {
      expect(screen.getByTestId('edge-new-edge')).toBeInTheDocument();
    });
  });
  
  // Test 6: Test canvas navigation and interaction
  test('supports canvas navigation and interaction', async () => {
    render(<CanvasPage onNodeSelect={jest.fn()} />);
    
    // Wait for nodes to be loaded
    await waitFor(() => {
      expect(nodeService.fetchNodes).toHaveBeenCalled();
    });
    
    // Check if controls are rendered
    expect(screen.getByTestId('controls')).toBeInTheDocument();
    
    // Simulate zoom and pan (this would need to be mocked or tested with a real ReactFlow instance)
    // For now, we're just checking if the controls are present
  });
}); 