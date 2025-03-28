/**
 * Integration Tests for Refactored Canvas
 * 
 * This file contains tests to verify that the refactored Canvas components
 * integrate properly with the rest of the application.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { CanvasPage } from '../';
import * as canvasHooks from '../../../hooks/canvas';

// Import mocks
import '../../../test-utils/mocks/reactflow.mock';
import '../../../test-utils/mocks/yjs.mock';

// Mock the hooks explicitly to avoid issues with hook ordering
jest.mock('../../../hooks/canvas', () => ({
  useCanvasNodes: jest.fn().mockReturnValue({
    nodes: [],
    setNodes: jest.fn(),
    onNodesChange: jest.fn(),
    createNode: jest.fn().mockResolvedValue({ id: 'new-node', data: { content: 'New node' } }),
    updateNodeContent: jest.fn(),
    updateNodePosition: jest.fn(),
    deleteNode: jest.fn().mockResolvedValue(true),
    loading: false,
    error: null
  }),
  useCanvasEdges: jest.fn().mockReturnValue({
    edges: [],
    setEdges: jest.fn(),
    onEdgesChange: jest.fn(),
    onConnect: jest.fn(),
    createEdge: jest.fn(),
    deleteEdge: jest.fn(),
    loading: false,
    error: null
  }),
  useYjsIntegration: jest.fn().mockReturnValue({
    isConnected: true,
    isOffline: false,
    offlineChangesCount: 0,
    syncStatus: null,
    connectedUsers: [],
    forceSync: jest.fn().mockResolvedValue(true),
    updateCursorPosition: jest.fn(),
    setTypingStatus: jest.fn(),
    updateAwareness: jest.fn()
  }),
  useCanvasUI: jest.fn().mockReturnValue({
    selectedNodeId: null,
    setSelectedNodeId: jest.fn(),
    selectedNodeContent: null,
    setSelectedNodeContent: jest.fn(),
    viewport: null,
    setViewport: jest.fn(),
    isMenuOpen: false,
    toggleMenu: jest.fn(),
    getMenuPosition: jest.fn().mockReturnValue({ top: 0, right: 0 })
  })
}));

// Mock context providers
jest.mock('../../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({ user: { id: 'test-user' }, session: { access_token: 'test-token' } })
}));

jest.mock('../../../contexts/SocketContext', () => ({
  SocketProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="socket-provider">{children}</div>,
  useSocket: () => ({ socket: null })
}));

jest.mock('../../../contexts/YjsContext', () => ({
  YjsProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="yjs-provider">{children}</div>,
  useYjs: () => ({ isConnected: true, ydoc: {} })
}));

jest.mock('../../../contexts/NetworkContext', () => ({
  NetworkProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="network-provider">{children}</div>
}));

// Mock Canvas components
jest.mock('../Canvas', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas-component">{children}</div>
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

// Import providers
import { AuthProvider } from '../../../contexts/AuthContext';
import { SocketProvider } from '../../../contexts/SocketContext';
import { YjsProvider } from '../../../contexts/YjsContext';
import { NetworkProvider } from '../../../contexts/NetworkContext';

describe('CanvasPage Integration Tests', () => {
  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <AuthProvider>
        <SocketProvider token="test-token">
          <YjsProvider canvasId="test-canvas" websocketUrl="ws://localhost:3001/yjs">
            <NetworkProvider wsProvider={null} doc={null}>
              {ui}
            </NetworkProvider>
          </YjsProvider>
        </SocketProvider>
      </AuthProvider>
    );
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders with all required providers', () => {
    const onNodeSelect = jest.fn();
    const onOpenSettings = jest.fn();
    
    renderWithProviders(
      <CanvasPage onNodeSelect={onNodeSelect} onOpenSettings={onOpenSettings} />
    );
    
    // Check that the component renders within all providers
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('socket-provider')).toBeInTheDocument();
    expect(screen.getByTestId('yjs-provider')).toBeInTheDocument();
    expect(screen.getByTestId('network-provider')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('collaboration-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('node-controls')).toBeInTheDocument();
  });

  it('handles loading state correctly', () => {
    // Override the hook mock for this test to show loading
    const originalUseCanvasNodes = canvasHooks.useCanvasNodes;
    jest.spyOn(canvasHooks, 'useCanvasNodes').mockReturnValue({
      ...originalUseCanvasNodes(),
      loading: true
    });

    const onNodeSelect = jest.fn();
    const onOpenSettings = jest.fn();
    
    renderWithProviders(
      <CanvasPage onNodeSelect={onNodeSelect} onOpenSettings={onOpenSettings} />
    );
    
    // Check for loading indicator
    expect(screen.getByText('Loading canvas...')).toBeInTheDocument();
  });
}); 