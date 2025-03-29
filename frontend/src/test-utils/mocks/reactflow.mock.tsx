import React from 'react';
import { Node, Edge, NodeTypes, NodeChange, EdgeChange, Connection, Viewport } from 'reactflow';

// Mock React Flow components
export const MockReactFlow: React.FC<{ 
  nodes?: Node[]; 
  edges?: Edge[];
  onNodesChange?: (changes: NodeChange[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onNodeDragStop?: (event: React.MouseEvent, node: Node, nodes: Node[]) => void;
  onSelectionChange?: (params: { nodes: Node[]; edges: Edge[] }) => void;
  onMove?: (event: React.MouseEvent, viewport: Viewport) => void;
  nodeTypes?: NodeTypes;
  children?: React.ReactNode;
}> = ({ 
  nodes = [], 
  edges = [], 
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeDragStop,
  children 
}) => (
  <div data-testid="reactflow-mock">
    <div data-testid="nodes-count">{nodes.length}</div>
    <div data-testid="edges-count">{edges.length}</div>
    <div data-testid="children">{children}</div>
    <button 
      data-testid="trigger-node-click" 
      onClick={(e) => onNodeClick && onNodeClick(e, { id: 'test-node-1' } as Node)}
    >
      Trigger Node Click
    </button>
    <button 
      data-testid="trigger-connect" 
      onClick={() => onConnect && onConnect({ source: 'node-1', target: 'node-2', sourceHandle: null, targetHandle: null } as Connection)}
    >
      Trigger Connect
    </button>
    <button 
      data-testid="trigger-node-drag" 
      onClick={(e) => onNodeDragStop && onNodeDragStop(e, { id: 'test-node-1' } as Node, nodes)}
    >
      Trigger Node Drag
    </button>
  </div>
);

export const MockBackground: React.FC<{
  color?: string;
  gap?: number;
  size?: number;
  className?: string;
}> = () => <div data-testid="reactflow-background">Background</div>;

export const MockControls: React.FC<{
  className?: string;
}> = () => <div data-testid="reactflow-controls">Controls</div>;

export const MockMiniMap: React.FC<{
  nodeColor?: string;
  nodeStrokeColor?: string;
  className?: string;
}> = () => <div data-testid="reactflow-minimap">MiniMap</div>;

export const MockHandle: React.FC = () => <div data-testid="reactflow-handle">Handle</div>;

export const MockPanel: React.FC<{ 
  position: string; 
  children?: React.ReactNode 
}> = ({ 
  children, 
  position 
}) => (
  <div data-testid={`reactflow-panel-${position}`}>{children}</div>
);

export const MockReactFlowProvider: React.FC<{
  children?: React.ReactNode
}> = ({ children }) => (
  <div data-testid="reactflow-provider">{children}</div>
);

// Mock React Flow hooks and utilities
export const mockUseReactFlow = jest.fn().mockReturnValue({
  getNodes: jest.fn().mockReturnValue([]),
  getEdges: jest.fn().mockReturnValue([]),
  setNodes: jest.fn(),
  setEdges: jest.fn(),
  getViewport: jest.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 }),
  setViewport: jest.fn(),
  fitView: jest.fn(),
  getIntersectingNodes: jest.fn().mockReturnValue([]),
  screenToFlowPosition: jest.fn().mockReturnValue({ x: 0, y: 0 }),
});

export const mockUseNodesState = jest.fn().mockImplementation((initialNodes = []) => {
  let nodes = [...initialNodes];
  const setNodes = jest.fn((newNodes) => {
    if (typeof newNodes === 'function') {
      nodes = newNodes(nodes);
    } else {
      nodes = newNodes;
    }
    return nodes;
  });
  const onNodesChange = jest.fn((changes) => {
    // Simple implementation for testing
    changes.forEach((change: NodeChange) => {
      if (change.type === 'remove') {
        nodes = nodes.filter(node => node.id !== change.id);
      }
    });
    return nodes;
  });
  return [nodes, setNodes, onNodesChange];
});

export const mockUseEdgesState = jest.fn().mockImplementation((initialEdges = []) => {
  let edges = [...initialEdges];
  const setEdges = jest.fn((newEdges) => {
    if (typeof newEdges === 'function') {
      edges = newEdges(edges);
    } else {
      edges = newEdges;
    }
    return edges;
  });
  const onEdgesChange = jest.fn((changes) => {
    // Simple implementation for testing
    changes.forEach((change: EdgeChange) => {
      if (change.type === 'remove') {
        edges = edges.filter(edge => edge.id !== change.id);
      }
    });
    return edges;
  });
  return [edges, setEdges, onEdgesChange];
});

// Set up the React Flow mock
jest.mock('reactflow', () => ({
  __esModule: true,
  default: MockReactFlow,
  Background: MockBackground,
  Controls: MockControls,
  MiniMap: MockMiniMap,
  Handle: MockHandle,
  Panel: MockPanel,
  ReactFlowProvider: MockReactFlowProvider,
  useReactFlow: mockUseReactFlow,
  useNodesState: mockUseNodesState,
  useEdgesState: mockUseEdgesState,
})); 