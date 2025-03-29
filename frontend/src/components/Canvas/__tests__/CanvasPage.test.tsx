/**
 * CanvasPage Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CanvasPage from '../CanvasPage';
import {
  useCanvasNodes,
  useCanvasEdges,
  useYjsIntegration,
  useCanvasUI
} from '../../../hooks/canvas';

// Mock the hooks
jest.mock('../../../hooks/canvas', () => ({
  useCanvasNodes: jest.fn(),
  useCanvasEdges: jest.fn(),
  useYjsIntegration: jest.fn(),
  useCanvasUI: jest.fn()
}));

// Mock Canvas and supporting components
jest.mock('../Canvas', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas-component">
      {children}
    </div>
  )
}));

jest.mock('../components/CanvasToolbar/CanvasToolbar', () => ({
  CanvasToolbar: () => <div data-testid="canvas-toolbar" />
}));

jest.mock('../components/CollaborationOverlay/CollaborationOverlay', () => ({
  CollaborationOverlay: () => <div data-testid="collaboration-overlay" />
}));

jest.mock('../components/NodeControls/NodeControls', () => ({
  NodeControls: () => <div data-testid="node-controls" />
}));

describe('CanvasPage Component', () => {
  // Mock implementations for hooks
  const mockNodes = [
    { id: 'node-1', data: { content: 'Node 1 content' }, position: { x: 0, y: 0 } },
    { id: 'node-2', data: { content: 'Node 2 content' }, position: { x: 100, y: 100 } }
  ];
  
  const mockEdges = [
    { id: 'edge-1-2', source: 'node-1', target: 'node-2' }
  ];
  
  const mockSetNodes = jest.fn();
  const mockOnNodesChange = jest.fn();
  const mockCreateNode = jest.fn().mockResolvedValue({ id: 'new-node', data: { content: 'New node' }, position: { x: 0, y: 0 } });
  const mockUpdateNodeContent = jest.fn();
  const mockUpdateNodePosition = jest.fn();
  const mockDeleteNode = jest.fn().mockResolvedValue(true);
  
  const mockSetEdges = jest.fn();
  const mockOnEdgesChange = jest.fn();
  const mockOnConnect = jest.fn();
  const mockCreateEdge = jest.fn();
  const mockDeleteEdge = jest.fn();
  
  const mockSetSelectedNodeId = jest.fn();
  const mockSetSelectedNodeContent = jest.fn();
  const mockSetViewport = jest.fn();
  const mockToggleMenu = jest.fn();
  const mockGetMenuPosition = jest.fn().mockReturnValue({ top: 0, right: 0 });
  
  const mockForceSync = jest.fn().mockResolvedValue(true);
  const mockUpdateCursorPosition = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configure hook mocks
    (useCanvasNodes as jest.Mock).mockReturnValue({
      nodes: mockNodes,
      setNodes: mockSetNodes,
      onNodesChange: mockOnNodesChange,
      createNode: mockCreateNode,
      updateNodeContent: mockUpdateNodeContent,
      updateNodePosition: mockUpdateNodePosition,
      deleteNode: mockDeleteNode,
      loading: false,
      error: null
    });
    
    (useCanvasEdges as jest.Mock).mockReturnValue({
      edges: mockEdges,
      setEdges: mockSetEdges,
      onEdgesChange: mockOnEdgesChange,
      onConnect: mockOnConnect,
      createEdge: mockCreateEdge,
      deleteEdge: mockDeleteEdge,
      loading: false,
      error: null
    });
    
    (useYjsIntegration as jest.Mock).mockReturnValue({
      isConnected: true,
      isOffline: false,
      offlineChangesCount: 0,
      syncStatus: null,
      connectedUsers: [],
      forceSync: mockForceSync,
      updateCursorPosition: mockUpdateCursorPosition,
      setTypingStatus: jest.fn()
    });
    
    (useCanvasUI as jest.Mock).mockReturnValue({
      selectedNodeId: null,
      setSelectedNodeId: mockSetSelectedNodeId,
      selectedNodeContent: null,
      setSelectedNodeContent: mockSetSelectedNodeContent,
      viewport: null,
      setViewport: mockSetViewport,
      isMenuOpen: false,
      toggleMenu: mockToggleMenu,
      getMenuPosition: mockGetMenuPosition
    });
  });
  
  it('renders the canvas and supporting components', () => {
    const onNodeSelect = jest.fn();
    render(<CanvasPage onNodeSelect={onNodeSelect} />);
    
    expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('collaboration-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('node-controls')).toBeInTheDocument();
  });
  
  it('renders loading state when nodes or edges are loading', () => {
    (useCanvasNodes as jest.Mock).mockReturnValue({
      nodes: [],
      setNodes: mockSetNodes,
      onNodesChange: mockOnNodesChange,
      createNode: mockCreateNode,
      updateNodeContent: mockUpdateNodeContent,
      updateNodePosition: mockUpdateNodePosition,
      deleteNode: mockDeleteNode,
      loading: true,
      error: null
    });
    
    const onNodeSelect = jest.fn();
    render(<CanvasPage onNodeSelect={onNodeSelect} />);
    
    expect(screen.getByText('Loading canvas...')).toBeInTheDocument();
  });
  
  // Additional tests for node selection, event handlers, etc. would go here
}); 