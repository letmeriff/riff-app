import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '@testing-library/react';
import { Canvas } from '../Canvas';
import { CanvasProps } from '../../../types/canvas';

// Import types from ReactFlow for typechecking
import { Node, Edge } from 'reactflow';

// Mock the YjsContext module
jest.mock('../../../contexts/YjsContext', () => ({
  YjsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

// Mock the auth context
jest.mock('../../../contexts/AuthContext', () => {
  const mockAuthValue = {
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: { access_token: 'test-access-token' },
    signUp: jest.fn(() => Promise.resolve()),
    signIn: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(() => Promise.resolve()),
  };
  
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAuth: () => mockAuthValue
  };
});

// Mock ReactFlow with all required exports
jest.mock('reactflow', () => {
  const MockReactFlow = ({
    nodes = [], 
    edges = [], 
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    children
  }: any) => (
    <div data-testid="reactflow-mock">
      <div data-testid="nodes-count">{nodes.length}</div>
      <div data-testid="edges-count">{edges.length}</div>
      <button 
        data-testid="trigger-node-click" 
        onClick={(e) => onNodeClick && onNodeClick(e, { id: 'test-node-1' } as any)}
      >
        Trigger Node Click
      </button>
      <button 
        data-testid="trigger-connect" 
        onClick={() => onConnect && onConnect({ source: 'node-1', target: 'node-2', sourceHandle: null, targetHandle: null })}
      >
        Trigger Connect
      </button>
      {children}
    </div>
  );

  return {
    __esModule: true,
    Background: () => <div data-testid="reactflow-background">Background</div>,
    Controls: () => <div data-testid="reactflow-controls">Controls</div>,
    MiniMap: () => <div data-testid="reactflow-minimap">MiniMap</div>,
    Panel: ({ children }: { children: React.ReactNode }) => <div data-testid="reactflow-panel">{children}</div>,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="reactflow-provider">{children}</div>,
    default: MockReactFlow
  };
});

describe('Canvas Component', () => {
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
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders ReactFlow with provided nodes and edges', () => {
    render(<Canvas {...mockProps} />);
    
    expect(screen.getByTestId('reactflow-mock')).toBeInTheDocument();
    expect(screen.getByTestId('nodes-count').textContent).toBe('2');
    expect(screen.getByTestId('edges-count').textContent).toBe('1');
  });
  
  it('renders background, controls, and minimap', () => {
    render(<Canvas {...mockProps} />);
    
    expect(screen.getByTestId('reactflow-background')).toBeInTheDocument();
    expect(screen.getByTestId('reactflow-controls')).toBeInTheDocument();
    expect(screen.getByTestId('reactflow-minimap')).toBeInTheDocument();
  });
  
  it('passes node click events to the handler', () => {
    render(<Canvas {...mockProps} />);
    
    fireEvent.click(screen.getByTestId('trigger-node-click'));
    
    expect(mockProps.onNodeClick).toHaveBeenCalled();
  });
  
  it('passes connection events to the handler', () => {
    render(<Canvas {...mockProps} />);
    
    fireEvent.click(screen.getByTestId('trigger-connect'));
    
    expect(mockProps.onConnect).toHaveBeenCalled();
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