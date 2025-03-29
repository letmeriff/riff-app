/**
 * CanvasPage Component
 *
 * This is the container component for the Canvas system.
 * It coordinates the various hooks and subcomponents for the canvas.
 */

import React, { useCallback, useState, useMemo } from 'react';
import { XYPosition, Node } from 'reactflow';
import { CanvasPageProps, ViewportBounds } from '../../types/canvas';
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
  useCanvasUI,
} from '../../hooks/canvas';
import { PerformanceMetrics } from '../../utils/performance';
import { features } from '../../features/flags';

// Import CSS
import styles from './CanvasPage.module.css';

// Define types to ensure type safety
interface _NodeData {
  content: string;
  label: string;
  [key: string]: unknown;
}

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
const CanvasPage: React.FC<CanvasPageProps> = React.memo(
  ({
    onNodeSelect,
    onOpenSettings,
    // Legacy featureFlags prop maintained for backward compatibility
    featureFlags = {},
  }) => {
    // Use canvas hooks for state management
    const {
      nodes,
      // Not using setNodes directly but needed for test mocks
      setNodes: _setNodes,
      onNodesChange,
      createNode,
      updateNodeContent,
      updateNodePosition,
      deleteNode,
      loading: nodesLoading,
    } = useCanvasNodes();

    const {
      edges,
      onEdgesChange,
      onConnect,
      loading: edgesLoading,
    } = useCanvasEdges();

    const { isOffline } = useYjsIntegration();

    const {
      selectedNodeId,
      setSelectedNodeId,
      setSelectedNodeContent,
      setViewport,
    } = useCanvasUI();

    // Local state
    const [isReadOnly] = useState<boolean>(false);
    const [showNodeControls] = useState<boolean>(true);
    const [performanceMetrics, setPerformanceMetrics] =
      useState<PerformanceMetrics>({});
    const [, setCanvasError] = useState<Error | null>(null);

    // Loading state
    const isLoading = nodesLoading || edgesLoading;

    // Use centralized feature flags (with backward compatibility for featureFlags prop)
    const showPerformanceMonitor =
      features.canvas.performanceMonitoring ||
      featureFlags.enablePerformanceMonitoring ||
      false;

    const enableVirtualization =
      features.canvas.virtualization ||
      featureFlags.enableVirtualization ||
      false;

    // Apply virtualization if enabled
    const visibleNodes = useMemo(() => {
      if (!nodes) return [];

      // Apply virtualization if enabled
      if (enableVirtualization) {
        // This is a simplified approach - a more sophisticated implementation would
        // use the actual viewport bounds from ReactFlow
        return nodes.slice(0, 100);
      } else {
        // Return all nodes
        return nodes;
      }
    }, [nodes, enableVirtualization]);

    // Handle node selection
    const handleNodeClick = useCallback(
      (event: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
        if (onNodeSelect) {
          // Extract content for the callback
          const content = node.data?.content || '';
          onNodeSelect(node.id, content);
        }
      },
      [setSelectedNodeId, onNodeSelect]
    );

    // Handle node position changes after dragging
    const handleNodeDragStop = useCallback(
      (event: React.MouseEvent, node: Node) => {
        updateNodePosition(node.id, node.position as XYPosition);
      },
      [updateNodePosition]
    );

    // Handle selection change (multiple nodes can be selected)
    const handleSelectionChange = useCallback(
      ({ nodes }: { nodes: Node[] }) => {
        // If there's exactly one node selected, set it as the active node
        if (nodes.length === 1) {
          const node = nodes[0];
          setSelectedNodeId(node.id);
          if (onNodeSelect) {
            const content = node.data?.content || '';
            onNodeSelect(node.id, content);
          }
        } else if (nodes.length === 0) {
          // Clear selection if no nodes are selected
          setSelectedNodeId(null);
          if (onNodeSelect) {
            onNodeSelect(null, null);
          }
        }
      },
      [setSelectedNodeId, onNodeSelect]
    );

    // Handle node content changes
    const handleContentChange = useCallback(
      (nodeId: string, content: string) => {
        updateNodeContent(nodeId, content);
        setSelectedNodeContent(content);
      },
      [updateNodeContent, setSelectedNodeContent]
    );

    // Handle node deletion
    const handleDeleteNode = useCallback(
      (nodeId: string) => {
        deleteNode(nodeId);
        setSelectedNodeId(null);
      },
      [deleteNode, setSelectedNodeId]
    );

    // Handle canvas viewport changes
    const handleViewportChange = useCallback(
      (viewport: { x: number; y: number; zoom: number }) => {
        // Convert ReactFlow viewport format to our internal format
        const viewportBounds: ViewportBounds = {
          minX: -viewport.x / viewport.zoom,
          minY: -viewport.y / viewport.zoom,
          maxX: (-viewport.x + window.innerWidth) / viewport.zoom,
          maxY: (-viewport.y + window.innerHeight) / viewport.zoom,
          zoom: viewport.zoom,
        };
        setViewport(viewportBounds);
      },
      [setViewport]
    );

    // Handle opening node settings
    const handleOpenSettings = useCallback(
      (nodeId: string) => {
        if (onOpenSettings) {
          onOpenSettings(nodeId);
        }
      },
      [onOpenSettings]
    );

    // Handle canvas operations
    const handleAddNode = useCallback(() => {
      // Create a new node at a slightly offset position
      const position: XYPosition = { x: 100, y: 100 };

      createNode(position)
        .then((newNode) => {
          if (newNode) {
            setSelectedNodeId(newNode.id);
          }
        })
        .catch((error) => {
          console.error('Error creating node:', error);
          setCanvasError(
            error instanceof Error ? error : new Error(String(error))
          );
        });
    }, [createNode, setSelectedNodeId, setCanvasError]);

    // Handle canvas errors
    const handleCanvasError = useCallback(
      (error: Error) => {
        console.error('Canvas Error:', error);
        setCanvasError(error);
      },
      [setCanvasError]
    );

    // Render loading state if data is being fetched
    if (isLoading) {
      return <LoadingIndicator />;
    }

    // Main render
    return (
      <div className={styles.canvasPageContainer}>
        <CanvasErrorBoundary onError={handleCanvasError}>
          <CanvasToolbar
            onAddNode={handleAddNode}
            onZoomIn={() => {}}
            onZoomOut={() => {}}
            onFitView={() => {}}
            isOffline={isOffline}
            isReadOnly={isReadOnly}
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
                node={nodes.find((node) => node.id === selectedNodeId) || null}
                content={
                  selectedNodeId
                    ? nodes.find((node) => node.id === selectedNodeId)?.data
                        ?.content || ''
                    : ''
                }
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
  }
);

export default CanvasPage;
