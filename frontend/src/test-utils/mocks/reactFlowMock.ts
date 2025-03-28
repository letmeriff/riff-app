/**
 * ReactFlow Mock Utility
 * 
 * This module provides mocks for ReactFlow hooks and components to enable
 * better testing of canvas-related components without needing actual DOM rendering
 * of ReactFlow elements.
 */

import { Node, Edge, NodeChange, EdgeChange, Connection, XYPosition } from 'reactflow';

// Mock for useNodesState hook
export function mockUseNodesState(initialNodes: Node[] = []) {
  const [nodes, setNodes] = React.useState<Node[]>(initialNodes);
  
  const onNodesChange = React.useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      return changes.reduce((acc, change) => {
        if (change.type === 'add') {
          return [...acc, change.item];
        } else if (change.type === 'remove') {
          return acc.filter((node) => node.id !== change.id);
        } else if (change.type === 'position') {
          return acc.map((node) => {
            if (node.id === change.id) {
              return {
                ...node,
                position: change.position || node.position,
              };
            }
            return node;
          });
        } else if (change.type === 'select') {
          return acc.map((node) => {
            if (node.id === change.id) {
              return {
                ...node,
                selected: change.selected,
              };
            }
            return node;
          });
        }
        return acc;
      }, nds);
    });
  }, []);

  return [nodes, setNodes, onNodesChange] as const;
}

// Mock for useEdgesState hook
export function mockUseEdgesState(initialEdges: Edge[] = []) {
  const [edges, setEdges] = React.useState<Edge[]>(initialEdges);
  
  const onEdgesChange = React.useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => {
      return changes.reduce((acc, change) => {
        if (change.type === 'add') {
          return [...acc, change.item];
        } else if (change.type === 'remove') {
          return acc.filter((edge) => edge.id !== change.id);
        } else if (change.type === 'select') {
          return acc.map((edge) => {
            if (edge.id === change.id) {
              return {
                ...edge,
                selected: change.selected,
              };
            }
            return edge;
          });
        }
        return acc;
      }, eds);
    });
  }, []);

  return [edges, setEdges, onEdgesChange] as const;
}

// Mock for addEdge function
export function mockAddEdge(params: Connection, edges: Edge[]) {
  if (!params.source || !params.target) return edges;
  
  const newEdge: Edge = {
    ...params,
    id: `${params.source}-${params.target}`,
    source: params.source,
    target: params.target,
  };
  
  return [...edges, newEdge];
}

// Mock for updateEdge function
export function mockUpdateEdge(oldEdge: Edge, newConnection: Connection, edges: Edge[]) {
  if (!newConnection.source || !newConnection.target) return edges;
  
  return edges.map((edge) => {
    if (edge.id === oldEdge.id) {
      return {
        ...edge,
        source: newConnection.source,
        target: newConnection.target,
        sourceHandle: newConnection.sourceHandle,
        targetHandle: newConnection.targetHandle,
      };
    }
    return edge;
  });
}

// Factory for creating test nodes
export function createTestNode(id: string, position: XYPosition, data: any = {}): Node {
  return {
    id,
    position,
    data,
    type: 'chatNode',
  };
}

// Factory for creating test edges
export function createTestEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
  };
}

// React import needed for the hooks
import React from 'react'; 