/**
 * Final Integration Tests for Canvas Components
 * 
 * These tests verify that the refactored Canvas components work correctly
 * when integrated with the rest of the application.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CanvasPage } from '../';
import CanvasErrorBoundary from '../components/CanvasErrorBoundary';

// Import mocks
import '../../../test-utils/mocks/reactflow.mock';
import '../../../test-utils/mocks/yjs.mock';

// Import providers
import { AuthProvider } from '../../../contexts/AuthContext';
import { SocketProvider } from '../../../contexts/SocketContext';
import { YjsProvider } from '../../../contexts/YjsContext';
import { NetworkProvider } from '../../../contexts/NetworkContext';

// Mock the hooks
jest.mock('../../../hooks/canvas', () => ({
  useCanvasNodes: jest.fn(() => ({
    nodes: [
      { id: '1', data: { label: 'Test Node 1', content: 'Test content 1' }, position: { x: 0, y: 0 } },
      { id: '2', data: { label: 'Test Node 2', content: 'Test content 2' }, position: { x: 100, y: 100 } }
    ],
    setNodes: jest.fn(),
    onNodesChange: jest.fn(),
    createNode: jest.fn(),
    updateNodeContent: jest.fn(),
    updateNodePosition: jest.fn(),
    deleteNode: jest.fn(),
    loading: false
  })),
  useCanvasEdges: jest.fn(() => ({
    edges: [{ id: 'e1-2', source: '1', target: '2' }],
    onEdgesChange: jest.fn(),
    onConnect: jest.fn(),
    loading: false
  })),
  useYjsIntegration: jest.fn(() => ({
    isOffline: false,
    awareness: null,
    connectedUsers: [],
    forceSync: jest.fn(),
    updateCursorPosition: jest.fn(),
    setTypingStatus: jest.fn()
  })),
  useCanvasUI: jest.fn(() => ({
    selectedNodeId: null,
    setSelectedNodeId: jest.fn(),
    setSelectedNodeContent: jest.fn(),
    setViewport: jest.fn(),
    isMenuOpen: false,
    toggleMenu: jest.fn(),
    getMenuPosition: jest.fn().mockReturnValue({ top: 0, right: 0 })
  }))
}));

// Mock React Flow to return nodes with testids
jest.mock('reactflow', () => {
  const reactFlowMock = jest.requireActual('../../../test-utils/mocks/reactflow.mock');
  return {
    ...reactFlowMock,
    default: ({ nodes, ...props }: any) => (
      <div data-testid="reactflow-container">
        {nodes.map((node: any) => (
          <div key={node.id} data-testid={`rf__node-${node.id}`} onClick={() => props.onNodeClick?.(null, node)}>
            {node.data.label}
          </div>
        ))}
        {props.children}
      </div>
    )
  };
});

// Component wrapper for providing all required context
const CanvasWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <SocketProvider token="mock-token">
      <YjsProvider canvasId="test-canvas" websocketUrl="ws://localhost:3001/yjs">
        <NetworkProvider wsProvider={null} doc={null}>
          {children}
        </NetworkProvider>
      </YjsProvider>
    </SocketProvider>
  </AuthProvider>
);

// Helper component that intentionally throws an error
const ErrorComponent = () => {
  throw new Error('Intentional test error');
};

describe('Canvas Final Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders CanvasPage with nodes and edges', async () => {
    // Mock onNodeSelect callback
    const onNodeSelectMock = jest.fn();
    
    render(
      <CanvasWrapper>
        <CanvasPage onNodeSelect={onNodeSelectMock} onOpenSettings={jest.fn()} />
      </CanvasWrapper>
    );
    
    // Wait for the canvas to load
    await waitFor(() => {
      // React Flow creates nodes with data-testid containing the node id
      expect(screen.getByTestId('rf__node-1')).toBeInTheDocument();
    });
  });
  
  it('handles errors gracefully with CanvasErrorBoundary', async () => {
    // Mock console.error to prevent test output noise
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    // Render with error boundary
    render(
      <CanvasErrorBoundary>
        <ErrorComponent />
      </CanvasErrorBoundary>
    );
    
    // Verify error UI is displayed
    expect(screen.getByText('Something went wrong in the Canvas')).toBeInTheDocument();
    
    // Verify retry button is present
    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();
    
    // Restore console.error
    console.error = originalConsoleError;
  });
  
  it('handles node selection and passes it to parent', async () => {
    // Get mocked hooks
    const { useCanvasNodes, useCanvasUI } = require('../../../hooks/canvas');
    
    // Prepare mocks for testing node selection
    const nodes = [
      { id: '1', data: { label: 'Test Node 1', content: 'Test content 1' }, position: { x: 0, y: 0 } }
    ];
    
    // Update mocks
    useCanvasNodes.mockReturnValue({
      nodes,
      setNodes: jest.fn(),
      onNodesChange: jest.fn(),
      createNode: jest.fn(),
      updateNodeContent: jest.fn(),
      updateNodePosition: jest.fn(),
      deleteNode: jest.fn(),
      loading: false
    });
    
    const setSelectedNodeIdMock = jest.fn();
    useCanvasUI.mockReturnValue({
      selectedNodeId: null,
      setSelectedNodeId: setSelectedNodeIdMock,
      setSelectedNodeContent: jest.fn(),
      setViewport: jest.fn(),
      isMenuOpen: false,
      toggleMenu: jest.fn(),
      getMenuPosition: jest.fn().mockReturnValue({ top: 0, right: 0 })
    });
    
    // Mock onNodeSelect callback
    const onNodeSelectMock = jest.fn();
    
    render(
      <CanvasWrapper>
        <CanvasPage onNodeSelect={onNodeSelectMock} onOpenSettings={jest.fn()} />
      </CanvasWrapper>
    );
    
    // Wait for the canvas to render
    await waitFor(() => {
      expect(screen.getByTestId('rf__node-1')).toBeInTheDocument();
    });
    
    // Simulate node click
    fireEvent.click(screen.getByTestId('rf__node-1'));
    
    // Verify the onNodeSelect callback was called
    expect(onNodeSelectMock).toHaveBeenCalled();
  });
}); 