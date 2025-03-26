import * as Y from 'yjs';
import { 
  Node, 
  Edge, 
  NodeChange, 
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  EdgeAddChange
} from 'reactflow';
import { updateNodePositionYjs, mapNodeToYjs, mapEdgeToYjs } from '../services/yjsService';
import { ChatNode } from '../services/nodeService';

/**
 * Applies changes from ReactFlow to Yjs document
 * @param changes Array of NodeChange objects from ReactFlow
 * @param nodes Current nodes array
 * @param doc Yjs document
 * @returns Updated nodes array
 */
export const syncNodeChangesToYjs = (
  changes: NodeChange[],
  nodes: Node[],
  ydoc: Y.Doc | null
): Node[] => {
  if (!ydoc) return applyNodeChanges(changes, nodes);
  
  // Apply changes locally first
  const updatedNodes = applyNodeChanges(changes, nodes);
  
  // Now sync changes to Yjs
  changes.forEach(change => {
    // Handle position changes
    if (change.type === 'position' && change.position) {
      updateNodePositionYjs(change.id, change.position);
    }
  });
  
  return updatedNodes;
};

/**
 * Applies changes from ReactFlow to Yjs document for edges
 * @param changes Array of EdgeChange objects from ReactFlow
 * @param edges Current edges array
 * @param doc Yjs document
 * @returns Updated edges array
 */
export const syncEdgeChangesToYjs = (
  changes: EdgeChange[],
  edges: Edge[],
  ydoc: Y.Doc | null
): Edge[] => {
  if (!ydoc) return applyEdgeChanges(changes, edges);
  
  // Apply changes locally first
  const updatedEdges = applyEdgeChanges(changes, edges);
  
  // Now sync changes to Yjs
  changes.forEach(change => {
    if (change.type === 'add') {
      // Find the new edge in updated edges
      const edgeChange = change as EdgeAddChange;
      const newEdge = updatedEdges.find(edge => edge.id === edgeChange.item.id);
      if (newEdge) {
        mapEdgeToYjs(newEdge);
      }
    }
    // We don't handle removal here as it's usually handled separately
  });
  
  return updatedEdges;
};

/**
 * Syncs a new node to Yjs when created in ReactFlow
 * @param node ReactFlow node
 * @param chatNode Chat node data
 * @param ydoc Yjs document
 */
export const syncNewNodeToYjs = (
  node: Node,
  chatNode: ChatNode,
  ydoc: Y.Doc | null
): void => {
  if (!ydoc) return;
  
  mapNodeToYjs(node, chatNode);
};

/**
 * Syncs a node deletion to Yjs
 * @param nodeId ID of node to delete
 * @param ydoc Yjs document
 */
export const syncNodeDeletionToYjs = (
  nodeId: string,
  ydoc: Y.Doc | null
): void => {
  if (!ydoc) return;
  
  try {
    const nodes = ydoc.getMap('nodes');
    if (nodes.has(nodeId)) {
      nodes.delete(nodeId);
    }
  } catch (error) {
    console.error('Error deleting node from Yjs:', error);
  }
};

/**
 * Syncs an edge deletion to Yjs
 * @param edgeId ID of edge to delete
 * @param ydoc Yjs document
 */
export const syncEdgeDeletionToYjs = (
  edgeId: string,
  ydoc: Y.Doc | null
): void => {
  if (!ydoc) return;
  
  try {
    const edges = ydoc.getMap('edges');
    if (edges.has(edgeId)) {
      edges.delete(edgeId);
    }
  } catch (error) {
    console.error('Error deleting edge from Yjs:', error);
  }
};

/**
 * Sets up a subscription to Yjs document changes to update ReactFlow state
 * @param ydoc Yjs document
 * @param setNodes Function to update nodes state
 * @param setEdges Function to update edges state
 * @returns Cleanup function
 */
export const setupYjsSubscription = (
  ydoc: Y.Doc | null,
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void
): (() => void) => {
  if (!ydoc) return () => {};
  
  const nodes = ydoc.getMap('nodes');
  const edges = ydoc.getMap('edges');
  
  // Helper to update ReactFlow nodes from Yjs
  const updateNodesFromYjs = () => {
    const nodesArray: Node[] = [];
    
    // Use a type-safe approach for iterating the Y.Map
    nodes.forEach((nodeValue: any, key: string) => {
      try {
        const nodeY = nodeValue as Y.Map<any>;
        const positionY = nodeY.get('position') as Y.Map<any>;
        const dataY = nodeY.get('data') as Y.Map<any>;
        
        if (positionY && dataY) {
          nodesArray.push({
            id: key,
            position: {
              x: positionY.get('x'),
              y: positionY.get('y')
            },
            type: 'chatNode',
            data: {
              label: dataY.get('title'),
              nodeId: nodeY.get('node_id'),
              model: dataY.get('model'),
              flavor: dataY.get('flavor'),
              description: dataY.get('description'),
            }
          });
        }
      } catch (error) {
        console.error(`Error processing Yjs node ${key}:`, error);
      }
    });
    
    setNodes(nodesArray);
  };
  
  // Helper to update ReactFlow edges from Yjs
  const updateEdgesFromYjs = () => {
    const edgesArray: Edge[] = [];
    
    // Use a type-safe approach for iterating the Y.Map
    edges.forEach((edgeValue: any, key: string) => {
      try {
        const edgeY = edgeValue as Y.Map<any>;
        
        edgesArray.push({
          id: key,
          source: edgeY.get('source'),
          target: edgeY.get('target'),
          type: 'straight',
          animated: true,
        });
      } catch (error) {
        console.error(`Error processing Yjs edge ${key}:`, error);
      }
    });
    
    setEdges(edgesArray);
  };
  
  // Subscribe to Yjs changes
  const nodesObserver = () => {
    updateNodesFromYjs();
  };
  
  const edgesObserver = () => {
    updateEdgesFromYjs();
  };
  
  // Observe changes
  nodes.observe(nodesObserver);
  edges.observe(edgesObserver);
  
  // Return cleanup function
  return () => {
    nodes.unobserve(nodesObserver);
    edges.unobserve(edgesObserver);
  };
}; 