/**
 * CanvasContext
 * 
 * This context provides a shared state for the Canvas components.
 * It combines the various canvas hooks into a single provider.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { Connection } from 'reactflow';
import { CanvasNode, CanvasEdge, ViewportBounds } from '../types/canvas';
import { 
  useCanvasNodes, 
  useCanvasEdges, 
  useYjsIntegration,
  useCanvasUI 
} from '../hooks/canvas';

// Define context interface
interface CanvasContextValue {
  // Node state and operations
  nodes: CanvasNode[];
  onNodesChange: unknown;
  createNode: (position?: { x: number; y: number }) => Promise<CanvasNode | null>;
  updateNodeContent: (nodeId: string, content: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => Promise<boolean>;
  
  // Edge state and operations
  edges: CanvasEdge[];
  onEdgesChange: unknown;
  onConnect: (connection: Connection) => void;
  createEdge: (source: string, target: string, data?: Record<string, unknown>) => CanvasEdge | null;
  deleteEdge: (edgeId: string) => boolean;
  
  // UI state
  selectedNodeId: string | null;
  setSelectedNodeId: (nodeId: string | null) => void;
  selectedNodeContent: string | null;
  setSelectedNodeContent: (content: string | null) => void;
  viewport: ViewportBounds | null;
  setViewport: (viewport: ViewportBounds) => void;
  
  // Collaboration state
  isConnected: boolean;
  isOffline: boolean;
  
  // Loading state
  loading: boolean;
  error: Error | null;
}

// Create context
const CanvasContext = createContext<CanvasContextValue | null>(null);

// Provider props interface
interface CanvasProviderProps {
  children: ReactNode;
}

// Provider component
export const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
  // Initialize hooks
  const { 
    nodes, 
    onNodesChange, 
    createNode, 
    updateNodeContent, 
    updateNodePosition, 
    deleteNode, 
    loading: nodesLoading,
    error: nodesError
  } = useCanvasNodes();
  
  const { 
    edges, 
    onEdgesChange, 
    onConnect, 
    createEdge, 
    deleteEdge,
    loading: edgesLoading,
    error: edgesError
  } = useCanvasEdges();
  
  const { 
    isConnected, 
    isOffline 
  } = useYjsIntegration();
  
  const { 
    selectedNodeId, 
    setSelectedNodeId, 
    selectedNodeContent, 
    setSelectedNodeContent,
    viewport,
    setViewport
  } = useCanvasUI();
  
  // Combine loading and error states
  const loading = nodesLoading || edgesLoading;
  const error = nodesError || edgesError;
  
  // Create context value
  const contextValue: CanvasContextValue = {
    // Node state and operations
    nodes,
    onNodesChange,
    createNode,
    updateNodeContent,
    updateNodePosition,
    deleteNode,
    
    // Edge state and operations
    edges,
    onEdgesChange,
    onConnect,
    createEdge,
    deleteEdge,
    
    // UI state
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeContent,
    setSelectedNodeContent,
    viewport,
    setViewport,
    
    // Collaboration state
    isConnected,
    isOffline,
    
    // Loading state
    loading,
    error
  };
  
  return (
    <CanvasContext.Provider value={contextValue}>
      {children}
    </CanvasContext.Provider>
  );
};

// Custom hook to use canvas context
export const useCanvas = (): CanvasContextValue => {
  const context = useContext(CanvasContext);
  
  if (!context) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  
  return context;
}; 