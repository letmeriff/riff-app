/**
 * CanvasPage Component
 * 
 * This is the container component for the Canvas system.
 * It coordinates the various hooks and subcomponents for the canvas.
 */

import React, { useCallback, useState, useMemo } from 'react';
import { XYPosition, Node, Edge } from 'reactflow';
import { CanvasPageProps } from '../../types/canvas';
import { Canvas } from './Canvas';
import { CanvasToolbar } from './components/CanvasToolbar/CanvasToolbar';
import { CollaborationOverlay } from './components/CollaborationOverlay/CollaborationOverlay';
import { NodeControls } from './components/NodeControls/NodeControls';
import { PerformanceMonitor } from './components/PerformanceMonitor/PerformanceMonitor';
import CanvasErrorBoundary from './components/CanvasErrorBoundary';
import { 
  useCanvasNodes, 
  useCanvasEdges, 
  useYjsIntegration,
  useCanvasUI 
} from '../../hooks/canvas';
import { PerformanceMetrics } from '../../utils/performance';

// Import CSS
import styles from './CanvasPage.module.css';

/**
 * Memoized Loading Component 
 * Extracted to prevent re-renders of the loading UI
 */
const LoadingIndicator = React.memo(() => (
  <div className={styles.loadingContainer || 'loading-container'}>
    <div className={styles.loadingSpinner || 'loading-spinner'} />
    <p>Loading canvas...</p>
  </div>
));

/**
 * CanvasPage Container Component
 * 
 * This is the main container component for the Canvas system.
 * It integrates all the hooks and subcomponents into a cohesive canvas experience.
 */
const CanvasPage: React.FC<CanvasPageProps> = React.memo(({ 
  onNodeSelect, 
  onOpenSettings,
  featureFlags = {}
}) => {
  // Use canvas hooks for state management
  const { 
    nodes, 
    setNodes, 
    onNodesChange, 
    createNode, 
    updateNodeContent, 
    updateNodePosition, 
    deleteNode, 
    loading: nodesLoading 
  } = useCanvasNodes();
  
  const { 
    edges, 
    onEdgesChange, 
    onConnect, 
    loading: edgesLoading 
  } = useCanvasEdges();
  
  const { 
    isOffline, 
  } = useYjsIntegration();
  
  const { 
    selectedNodeId, 
    setSelectedNodeId, 
    setSelectedNodeContent, 
    setViewport
  } = useCanvasUI();
  
  // Local state
  const [isReadOnly] = useState<boolean>(false);
  const [showNodeControls] = useState<boolean>(true);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({});
  const [, setCanvasError] = useState<Error | null>(null);
  
  // Loading state
  const isLoading = nodesLoading || edgesLoading;
  
  // Determine if performance monitoring is enabled
  const showPerformanceMonitor = featureFlags.enablePerformanceMonitoring || false;
  
  // Apply virtualization if enabled
  const visibleNodes = useMemo(() => {
    if (!nodes) return [];
    
    // Apply virtualization if enabled
    if (featureFlags.enableVirtualization) {
      // This is a simplified approach - a more sophisticated implementation would
      // use the actual viewport bounds from ReactFlow
      return nodes.slice(0, 100);
    } else {
      // Return all nodes
      return nodes;
    }
  }, [nodes, featureFlags.enableVirtualization]);
  
  // Event handlers with memoization
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    try {
      setSelectedNodeId(node.id);
      if (node.data?.content) {
        setSelectedNodeContent(node.data.content);
      }
      if (onNodeSelect) {
        onNodeSelect(node.id, node.data?.content || null);
      }
    } catch (error) {
      console.error("Error handling node click:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [setSelectedNodeId, setSelectedNodeContent, onNodeSelect]);
  
  const handleNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    try {
      updateNodePosition(node.id, node.position);
    } catch (error) {
      console.error("Error handling node drag:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [updateNodePosition]);
  
  const handleSelectionChange = useCallback((elements: { nodes: Node[]; edges: Edge[] }) => {
    try {
      // If no nodes are selected, clear selection
      if (elements.nodes.length === 0) {
        setSelectedNodeId(null);
      } else if (elements.nodes.length === 1) {
        // If exactly one node is selected
        const node = elements.nodes[0];
        setSelectedNodeId(node.id);
        if (node.data?.content) {
          setSelectedNodeContent(node.data.content);
        }
        if (onNodeSelect) {
          onNodeSelect(node.id, node.data?.content || null);
        }
      }
    } catch (error) {
      console.error("Error handling selection change:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [setSelectedNodeId, setSelectedNodeContent, onNodeSelect]);
  
  const handleViewportChange = useCallback((viewport: { x: number; y: number; zoom: number }) => {
    try {
      if (viewport) {
        // Convert viewport to format expected by our hooks
        setViewport({
          minX: -viewport.x / viewport.zoom,
          minY: -viewport.y / viewport.zoom,
          maxX: (-viewport.x + window.innerWidth) / viewport.zoom,
          maxY: (-viewport.y + window.innerHeight) / viewport.zoom,
          zoom: viewport.zoom
        });
      }
    } catch (error) {
      console.error("Error handling viewport change:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [setViewport]);
  
  // These are implementation placeholders for when we fully wire up the UI
  const handleAddNode = useCallback(async (position?: XYPosition) => {
    try {
      const newNode = await createNode(position);
      if (newNode) {
        setSelectedNodeId(newNode.id);
        if (onNodeSelect) {
          onNodeSelect(newNode.id, newNode.data.content);
        }
      }
    } catch (error) {
      console.error("Error creating node:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [createNode, setSelectedNodeId, onNodeSelect]);
  
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    try {
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
        if (onNodeSelect) {
          onNodeSelect(null, null);
        }
      }
      await deleteNode(nodeId);
    } catch (error) {
      console.error("Error deleting node:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [deleteNode, selectedNodeId, setSelectedNodeId, onNodeSelect]);
  
  const handleContentChange = useCallback((nodeId: string, content: string) => {
    try {
      updateNodeContent(nodeId, content);
      setSelectedNodeContent(content);
    } catch (error) {
      console.error("Error updating content:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [updateNodeContent, setSelectedNodeContent]);
  
  const handleZoomIn = useCallback(() => {
    try {
      setNodes(currentNodes => {
        // This is a placeholder for actual zoom functionality
        // In a real implementation, this would interact with ReactFlow's zoom methods
        return [...currentNodes];
      });
    } catch (error) {
      console.error("Error zooming in:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [setNodes]);
  
  const handleZoomOut = useCallback(() => {
    try {
      setNodes(currentNodes => {
        // This is a placeholder for actual zoom functionality
        // In a real implementation, this would interact with ReactFlow's zoom methods
        return [...currentNodes];
      });
    } catch (error) {
      console.error("Error zooming out:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [setNodes]);
  
  const handleFitView = useCallback(() => {
    try {
      // Placeholder for fit view functionality
      // In a real implementation, this would interact with ReactFlow's fitView method
      console.log("Fit view requested");
    } catch (error) {
      console.error("Error fitting view:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, []);
  
  const handleOpenSettings = useCallback((nodeId: string) => {
    try {
      // Call the onOpenSettings prop if provided
      if (onOpenSettings) {
        onOpenSettings(nodeId);
      }
    } catch (error) {
      console.error("Error opening settings:", error);
      setCanvasError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [onOpenSettings]);
  
  // If loading, show loading indicator
  if (isLoading) {
    return <LoadingIndicator />;
  }
  
  return (
    <div className={styles.canvasPageContainer}>
      <CanvasErrorBoundary
        onError={(error) => {
          console.error("Canvas error caught by boundary:", error);
          setCanvasError(error);
        }}
      >
        <CanvasToolbar
          onAddNode={handleAddNode}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={handleFitView}
          isReadOnly={isReadOnly}
          isOffline={isOffline}
        />
        
        <div className={styles.canvasContainer}>
          <Canvas
            nodes={visibleNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onNodeDragStop={handleNodeDragStop}
            onSelectionChange={handleSelectionChange}
            onViewportChange={handleViewportChange}
            isOfflineMode={isOffline}
            readOnly={isReadOnly}
          >
            <CollaborationOverlay />
          </Canvas>
          
          {showNodeControls && selectedNodeId && (
            <NodeControls
              node={nodes.find(node => node.id === selectedNodeId) || null}
              content={selectedNodeId ? nodes.find(node => node.id === selectedNodeId)?.data?.content || '' : ''}
              onContentChange={handleContentChange}
              onDeleteNode={handleDeleteNode}
              onOpenSettings={handleOpenSettings}
              isReadOnly={isReadOnly}
            />
          )}
        </div>
        
        {showPerformanceMonitor && (
          <PerformanceMonitor
            enabled={true}
            metrics={performanceMetrics}
            onMetricsUpdate={setPerformanceMetrics}
          />
        )}
      </CanvasErrorBoundary>
    </div>
  );
});

export default CanvasPage; 