/**
 * Canvas Component
 * 
 * A wrapper around ReactFlow that provides a consistent interface for the canvas.
 * Includes background, controls, minimap, and other canvas features.
 */

import React, { useCallback, useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  NodeTypes,
  ReactFlowProvider,
  OnMove
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CanvasProps } from '../../types/canvas';
import ChatNode from '../ChatNode';
import { useYjsIntegration } from '../../hooks/canvas';
import styles from './Canvas.module.css';

// Register custom node types - memoized to prevent unnecessary recreations
const nodeTypes: NodeTypes = {
  chatNode: ChatNode,
};

// Memoized components for performance
const MemoizedBackground = React.memo(Background);
const MemoizedControls = React.memo(Controls);
const MemoizedMiniMap = React.memo(MiniMap);

/**
 * Canvas Component
 * 
 * Optimized with React.memo to prevent unnecessary re-renders
 * when parent components change but props remain the same
 */
export const Canvas: React.FC<CanvasProps> = React.memo(({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeDragStop,
  onSelectionChange,
  onViewportChange,
  isOfflineMode = false,
  readOnly = false,
  children,
}) => {
  // Get collaboration status from Yjs hook
  const { isOffline } = useYjsIntegration();
  
  // Determine if offline mode is active (either explicitly set or from Yjs)
  const isOfflineModeActive = isOfflineMode || isOffline;
  
  // Handle viewport changes and convert to expected format - memoized
  const handleMove: OnMove = useCallback((_, viewport) => {
    if (onViewportChange) {
      onViewportChange(viewport);
    }
  }, [onViewportChange]);
  
  // Memoize constant ReactFlow props to prevent unnecessary re-renders
  const flowProps = useMemo(() => ({
    zoomOnScroll: !readOnly,
    zoomOnPinch: !readOnly,
    panOnScroll: !readOnly,
    nodesDraggable: !readOnly,
    nodesConnectable: !readOnly,
    elementsSelectable: !readOnly,
    nodeTypes,
  }), [readOnly]);
  
  return (
    <div className={styles.canvasContainer}>
      {/* Offline mode indicator */}
      {isOfflineModeActive && (
        <div className={styles.offlineBanner} data-testid="offline-mode-indicator">
          Offline Mode - Changes will sync when back online
        </div>
      )}
      
      {/* Read-only mode indicator */}
      {readOnly && (
        <div className={styles.readOnlyBanner} data-testid="read-only-indicator">
          Read Only View
        </div>
      )}
      
      {/* ReactFlow wrapper */}
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          onMove={handleMove}
          className={styles.reactFlowWrapper}
          {...flowProps}
        >
          <MemoizedBackground 
            color="#aaa" 
            gap={16} 
            size={1}
            className={styles.background}
          />
          <MemoizedControls className={styles.controls} />
          <MemoizedMiniMap 
            nodeStrokeColor="#888" 
            nodeColor="#f7f7f7"
            className={styles.minimap}
          />
          
          {/* Render any children passed to the component */}
          {children}
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}); 