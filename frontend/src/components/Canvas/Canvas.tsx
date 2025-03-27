/**
 * Canvas Component
 * 
 * This component wraps ReactFlow and provides a consistent interface
 * for working with the canvas functionality.
 */

import React from 'react';
import ReactFlow, { Background, Controls, MiniMap, OnMove } from 'reactflow';
import 'reactflow/dist/style.css';
import { CanvasProps } from '../../types/canvas';

/**
 * @TODO: Implement this component as part of the refactoring process.
 * This will be the main ReactFlow wrapper component.
 */
const Canvas: React.FC<CanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeDragStop,
  onSelectionChange,
  onViewportChange,
  isOfflineMode,
  readOnly,
  children
}) => {
  // Convert onViewportChange to onMove for ReactFlow
  const handleMove: OnMove = (_, viewport) => {
    if (onViewportChange) {
      onViewportChange(viewport);
    }
  };

  return (
    <div className="canvas-container">
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
      >
        <Background />
        <Controls />
        <MiniMap />
        {children}
      </ReactFlow>
    </div>
  );
};

export default Canvas; 