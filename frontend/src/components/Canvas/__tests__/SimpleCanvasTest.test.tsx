import React from 'react';
import { render, screen } from '@testing-library/react';
import { Canvas } from '../Canvas';
import { CanvasProps } from '../../../types/canvas';
import { Node, Edge } from 'reactflow';

// Mock the YjsContext hooks to return predictable values
jest.mock('../../../contexts/YjsContext', () => ({
  YjsProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="yjs-provider-mock">{children}</div>,
  useYjs: () => ({
    ydoc: null,
    isConnected: true,
    isOffline: false,
    offlineChangesCount: 0,
    syncStatus: null,
    connectedUsers: [],
    updateAwareness: jest.fn(),
    getNodesFromYjs: jest.fn(() => []),
    getEdgesFromYjs: jest.fn(() => []),
    isFeatureEnabled: true,
    hasPendingSyncs: false,
    forceSync: jest.fn(() => Promise.resolve(true))
  })
}));

// Mock the auth context
jest.mock('../../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider-mock">{children}</div>,
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    session: { access_token: 'token' },
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn()
  })
}));

// Mock the Canvas hook to avoid actual Yjs integration
jest.mock('../../../hooks/canvas', () => ({
  useYjsIntegration: () => ({
    isConnected: true,
    isOffline: false,
    offlineChangesCount: 0,
    syncStatus: null,
    connectedUsers: [],
    updateAwareness: jest.fn(),
    forceSync: jest.fn(() => Promise.resolve(true)),
    updateCursorPosition: jest.fn(),
    setTypingStatus: jest.fn()
  })
}));

// Interface for ReactFlow mock component props
interface ReactFlowMockProps {
  nodes?: Node[];
  edges?: Edge[];
  onNodesChange?: (changes: unknown) => void;
  _onEdgesChange?: (changes: unknown) => void;
  _onConnect?: (connection: unknown) => void;
  children?: React.ReactNode;
}

// Mock ReactFlow with all required exports
jest.mock('reactflow', () => {
  const ReactFlowMock = ({
    nodes,
    edges,
    onNodesChange,
    _onEdgesChange,
    _onConnect,
    children
  }: ReactFlowMockProps) => (
    <div data-testid="reactflow-mock">
      <div data-testid="nodes-count">{nodes?.length || 0}</div>
      <div data-testid="edges-count">{edges?.length || 0}</div>
      <button 
        data-testid="trigger-node-click" 
        onClick={(_e) => onNodesChange && onNodesChange([{ type: 'select', id: 'node-1' }])}
      >
        Click Node
      </button>
      <div data-testid="reactflow-children">{children}</div>
    </div>
  );

  return {
    // Export named components
    Background: () => <div data-testid="reactflow-background">Background</div>,
    Controls: () => <div data-testid="reactflow-controls">Controls</div>,
    MiniMap: () => <div data-testid="reactflow-minimap">MiniMap</div>,
    Panel: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="reactflow-panel">{children}</div>
    ),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="reactflow-provider-mock">{children}</div>
    ),
    // Default export is the ReactFlow component
    __esModule: true,
    default: ReactFlowMock,
  };
});

describe('Simple Canvas Component Test', () => {
  const mockProps: CanvasProps = {
    nodes: [
      { id: 'node-1', position: { x: 100, y: 100 }, data: { label: 'Node 1', content: 'Content 1' } },
      { id: 'node-2', position: { x: 200, y: 200 }, data: { label: 'Node 2', content: 'Content 2' } },
    ] as Node[],
    edges: [
      { id: 'edge-1-2', source: 'node-1', target: 'node-2' },
    ] as Edge[],
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
    onConnect: jest.fn(),
    onNodeClick: jest.fn(),
    onNodeDragStop: jest.fn(),
  };

  it('renders the canvas with correct nodes and edges', () => {
    render(<Canvas {...mockProps} />);
    
    // Check if ReactFlow is rendered
    expect(screen.getByTestId('reactflow-mock')).toBeInTheDocument();
    expect(screen.getByTestId('nodes-count').textContent).toBe('2');
    expect(screen.getByTestId('edges-count').textContent).toBe('1');
    
    // Check if UI components are rendered
    expect(screen.getByTestId('reactflow-background')).toBeInTheDocument();
    expect(screen.getByTestId('reactflow-controls')).toBeInTheDocument();
    expect(screen.getByTestId('reactflow-minimap')).toBeInTheDocument();
  });

  it('renders with offline mode indicator when specified', () => {
    render(<Canvas {...mockProps} isOfflineMode={true} />);
    
    expect(screen.getByTestId('offline-mode-indicator')).toBeInTheDocument();
  });

  it('renders in read-only mode when specified', () => {
    render(<Canvas {...mockProps} readOnly={true} />);
    
    expect(screen.getByTestId('read-only-indicator')).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    render(
      <Canvas {...mockProps}>
        <div data-testid="custom-child">Custom Child Component</div>
      </Canvas>
    );
    
    expect(screen.getByTestId('custom-child')).toBeInTheDocument();
  });
}); 