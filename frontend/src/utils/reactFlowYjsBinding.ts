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
 * Batch updates multiple nodes in Yjs document
 * @param nodes Array of nodes to update
 * @param ydoc Yjs document
 */
export const batchUpdateNodesToYjs = (
  nodes: Node[],
  chatNodes: Record<string, ChatNode>,
  ydoc: Y.Doc | null
): void => {
  if (!ydoc) return;
  
  try {
    // Create a transaction for batch updates
    ydoc.transact(() => {
      nodes.forEach(node => {
        if (chatNodes[node.id]) {
          mapNodeToYjs(node, chatNodes[node.id]);
        }
      });
    });
  } catch (error) {
    console.error('Error batch updating nodes in Yjs:', error);
  }
};

/**
 * Sync node content changes (not just position) to Yjs
 * @param nodeId ID of the node to update
 * @param newData New data for the node
 * @param ydoc Yjs document
 */
export const syncNodeContentToYjs = (
  nodeId: string,
  newData: Partial<ChatNode>,
  ydoc: Y.Doc | null
): void => {
  if (!ydoc) return;
  
  try {
    const nodes = ydoc.getMap('nodes');
    if (nodes.has(nodeId)) {
      const nodeY = nodes.get(nodeId) as Y.Map<unknown>;
      const dataY = nodeY.get('data') as Y.Map<unknown>;
      
      // Update data fields
      if (newData.title !== undefined) {
        dataY.set('title', newData.title);
      }
      if (newData.model !== undefined) {
        dataY.set('model', newData.model);
      }
      if (newData.flavor !== undefined) {
        dataY.set('flavor', newData.flavor);
      }
      if (newData.description !== undefined) {
        dataY.set('description', newData.description);
      }
    }
  } catch (error) {
    console.error('Error updating node content in Yjs:', error);
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
  
  // Debounce to prevent too many React updates
  let nodesUpdateTimeout: NodeJS.Timeout | null = null;
  let edgesUpdateTimeout: NodeJS.Timeout | null = null;
  
  // Helper to update ReactFlow nodes from Yjs - optimized for large documents
  const updateNodesFromYjs = () => {
    // Clear existing timeout to avoid multiple rapid updates
    if (nodesUpdateTimeout) clearTimeout(nodesUpdateTimeout);
    
    // Set a new timeout for debounced update
    nodesUpdateTimeout = setTimeout(() => {
      const nodesArray: Node[] = [];
      const processedCount = { value: 0 };
      
      // Use a type-safe approach for iterating the Y.Map
      nodes.forEach((nodeValue: unknown, key: string) => {
        try {
          const nodeY = nodeValue as Y.Map<unknown>;
          const positionY = nodeY.get('position') as Y.Map<unknown>;
          const dataY = nodeY.get('data') as Y.Map<unknown>;
          
          if (positionY && dataY) {
            nodesArray.push({
              id: key,
              position: {
                x: positionY.get('x') as number,
                y: positionY.get('y') as number
              },
              type: 'chatNode',
              data: {
                label: dataY.get('title') as string,
                nodeId: nodeY.get('node_id') as string,
                model: dataY.get('model') as string,
                flavor: dataY.get('flavor') as string,
                description: dataY.get('description') as string,
              }
            });
            processedCount.value++;
          }
        } catch (error) {
          console.error(`Error processing Yjs node ${key}:`, error);
        }
      });
      
      console.log(`Processed ${processedCount.value} nodes from Yjs document`);
      setNodes(nodesArray);
    }, 50); // 50ms debounce
  };
  
  // Helper to update ReactFlow edges from Yjs - optimized for large documents
  const updateEdgesFromYjs = () => {
    // Clear existing timeout to avoid multiple rapid updates
    if (edgesUpdateTimeout) clearTimeout(edgesUpdateTimeout);
    
    // Set a new timeout for debounced update
    edgesUpdateTimeout = setTimeout(() => {
      const edgesArray: Edge[] = [];
      const processedCount = { value: 0 };
      
      // Use a type-safe approach for iterating the Y.Map
      edges.forEach((edgeValue: unknown, key: string) => {
        try {
          const edgeY = edgeValue as Y.Map<unknown>;
          
          edgesArray.push({
            id: key,
            source: edgeY.get('source') as string,
            target: edgeY.get('target') as string,
            type: 'straight',
            animated: true,
          });
          processedCount.value++;
        } catch (error) {
          console.error(`Error processing Yjs edge ${key}:`, error);
        }
      });
      
      console.log(`Processed ${processedCount.value} edges from Yjs document`);
      setEdges(edgesArray);
    }, 50); // 50ms debounce
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
    // Clear any pending timeouts
    if (nodesUpdateTimeout) clearTimeout(nodesUpdateTimeout);
    if (edgesUpdateTimeout) clearTimeout(edgesUpdateTimeout);
    
    // Unobserve changes
    nodes.unobserve(nodesObserver);
    edges.unobserve(edgesObserver);
  };
};