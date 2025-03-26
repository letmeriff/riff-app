import * as Y from 'yjs';
import { Node, Edge } from 'reactflow';
import throttle from 'lodash/throttle';
import debounce from 'lodash/debounce';

// Viewport bounds type for selective loading
export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  padding?: number; // Additional padding around viewport for preloading
}

// Canvas chunk definition
interface CanvasChunk {
  id: string;
  bounds: ViewportBounds;
  loaded: boolean;
}

// Define chunk size constants
const CHUNK_SIZE = 1000; // Size of each chunk in pixels
const CHUNK_PADDING = 500; // Padding around viewport for preloading
const DEFAULT_THROTTLE_DELAY = 200; // Default throttle delay for position updates in ms
const POSITION_DEBOUNCE_DELAY = 500; // Debounce delay for position updates in ms

// Map to store chunks and their loaded state
const chunks = new Map<string, CanvasChunk>();
// Track current viewport bounds
// let currentViewport: ViewportBounds | null = null;
// Track loaded nodes to prevent redundant loading
const loadedNodeIds = new Set<string>();

/**
 * Divides a large canvas into chunks for efficient loading
 * @param totalBounds The total bounds of the canvas
 * @returns Array of canvas chunks
 */
export const createCanvasChunks = (totalBounds: ViewportBounds): CanvasChunk[] => {
  const chunkList: CanvasChunk[] = [];
  
  // Calculate number of chunks in each dimension
  const xChunks = Math.ceil((totalBounds.maxX - totalBounds.minX) / CHUNK_SIZE);
  const yChunks = Math.ceil((totalBounds.maxY - totalBounds.minY) / CHUNK_SIZE);
  
  // Create a grid of chunks
  for (let x = 0; x < xChunks; x++) {
    for (let y = 0; y < yChunks; y++) {
      const chunkId = `chunk-${x}-${y}`;
      const chunk: CanvasChunk = {
        id: chunkId,
        bounds: {
          minX: totalBounds.minX + (x * CHUNK_SIZE),
          maxX: totalBounds.minX + ((x + 1) * CHUNK_SIZE),
          minY: totalBounds.minY + (y * CHUNK_SIZE),
          maxY: totalBounds.minY + ((y + 1) * CHUNK_SIZE),
        },
        loaded: false
      };
      
      chunkList.push(chunk);
      chunks.set(chunkId, chunk);
    }
  }
  
  return chunkList;
};

/**
 * Determines which chunks intersect with the current viewport
 * @param viewport Current viewport bounds
 * @returns Array of chunk IDs that should be loaded
 */
export const getVisibleChunks = (viewport: ViewportBounds): string[] => {
  const visibleChunks: string[] = [];
  
  // Add padding to viewport for preloading nearby chunks
  const paddedViewport: ViewportBounds = {
    minX: viewport.minX - (viewport.padding || CHUNK_PADDING),
    maxX: viewport.maxX + (viewport.padding || CHUNK_PADDING),
    minY: viewport.minY - (viewport.padding || CHUNK_PADDING),
    maxY: viewport.maxY + (viewport.padding || CHUNK_PADDING),
  };
  
  // Find chunks that intersect with padded viewport
  chunks.forEach((chunk, chunkId) => {
    if (
      chunk.bounds.minX <= paddedViewport.maxX &&
      chunk.bounds.maxX >= paddedViewport.minX &&
      chunk.bounds.minY <= paddedViewport.maxY &&
      chunk.bounds.maxY >= paddedViewport.minY
    ) {
      visibleChunks.push(chunkId);
    }
  });
  
  return visibleChunks;
};

/**
 * Updates the current viewport and returns chunks that need to be loaded
 * @param viewport New viewport bounds
 * @returns Array of chunk IDs that need to be loaded
 */
export const updateViewport = (viewport: ViewportBounds): string[] => {
  // currentViewport = viewport;
  const visibleChunks = getVisibleChunks(viewport);
  
  // Mark visible chunks as loaded
  visibleChunks.forEach(chunkId => {
    const chunk = chunks.get(chunkId);
    if (chunk) {
      chunk.loaded = true;
      chunks.set(chunkId, chunk);
    }
  });
  
  // Return only chunks that need to be loaded
  return visibleChunks.filter(chunkId => {
    const chunk = chunks.get(chunkId);
    return !chunk || !chunk.loaded;
  });
};

/**
 * Checks if a node is within the current viewport
 * @param node ReactFlow node to check
 * @param viewport Current viewport bounds
 * @returns True if node is within viewport (with padding)
 */
export const isNodeInViewport = (node: Node, viewport: ViewportBounds): boolean => {
  if (!viewport) return true;
  
  const paddedViewport: ViewportBounds = {
    minX: viewport.minX - (viewport.padding || CHUNK_PADDING),
    maxX: viewport.maxX + (viewport.padding || CHUNK_PADDING),
    minY: viewport.minY - (viewport.padding || CHUNK_PADDING),
    maxY: viewport.maxY + (viewport.padding || CHUNK_PADDING),
  };
  
  return (
    node.position.x >= paddedViewport.minX &&
    node.position.x <= paddedViewport.maxX &&
    node.position.y >= paddedViewport.minY &&
    node.position.y <= paddedViewport.maxY
  );
};

/**
 * Selectively loads nodes and edges from a Yjs document based on viewport
 * @param ydoc Yjs document
 * @param viewport Current viewport bounds
 * @returns Object containing visible nodes and edges
 */
export const selectivelyLoadNodes = (
  ydoc: Y.Doc | null,
  viewport: ViewportBounds
): { nodes: Node[], edges: Edge[] } => {
  if (!ydoc) return { nodes: [], edges: [] };
  
  const visibleNodes: Node[] = [];
  const visibleEdges: Edge[] = [];
  
  try {
    const nodesMap = ydoc.getMap('nodes');
    const edgesMap = ydoc.getMap('edges');
    
    // Update current viewport
    // currentViewport = viewport;
    
    // Process nodes selectively
    nodesMap.forEach((nodeValue: any, nodeId: string) => {
      try {
        const nodeY = nodeValue as Y.Map<any>;
        const positionY = nodeY.get('position') as Y.Map<any>;
        
        if (positionY) {
          const nodePosition = {
            x: positionY.get('x'),
            y: positionY.get('y')
          };
          
          // Check if this node is in the viewport
          if (
            nodePosition.x >= viewport.minX - (viewport.padding || CHUNK_PADDING) &&
            nodePosition.x <= viewport.maxX + (viewport.padding || CHUNK_PADDING) &&
            nodePosition.y >= viewport.minY - (viewport.padding || CHUNK_PADDING) &&
            nodePosition.y <= viewport.maxY + (viewport.padding || CHUNK_PADDING)
          ) {
            // Node is visible, add it to our visible nodes
            const dataY = nodeY.get('data') as Y.Map<any>;
            
            visibleNodes.push({
              id: nodeId,
              position: nodePosition,
              type: 'chatNode',
              data: {
                label: dataY.get('title'),
                nodeId: nodeY.get('node_id'),
                model: dataY.get('model'),
                flavor: dataY.get('flavor'),
                description: dataY.get('description'),
              }
            });
            
            // Mark this node as loaded
            loadedNodeIds.add(nodeId);
          }
        }
      } catch (error) {
        console.error(`Error processing node ${nodeId} for selective loading:`, error);
      }
    });
    
    // Process edges - only include edges between visible nodes
    edgesMap.forEach((edgeValue: any, edgeId: string) => {
      try {
        const edgeY = edgeValue as Y.Map<any>;
        const sourceId = edgeY.get('source');
        const targetId = edgeY.get('target');
        
        // Only include edges where both source and target are visible
        if (loadedNodeIds.has(sourceId) && loadedNodeIds.has(targetId)) {
          visibleEdges.push({
            id: edgeId,
            source: sourceId,
            target: targetId,
            type: 'straight',
            animated: true,
          });
        }
      } catch (error) {
        console.error(`Error processing edge ${edgeId} for selective loading:`, error);
      }
    });
  } catch (error) {
    console.error('Error selectively loading nodes:', error);
  }
  
  return { nodes: visibleNodes, edges: visibleEdges };
};

/**
 * Creates a throttled version of the node position update function
 * @param updateFn Function that updates node position in Yjs
 * @param delay Throttle delay in milliseconds
 * @returns Throttled update function
 */
export const createThrottledPositionUpdater = (
  updateFn: (nodeId: string, position: { x: number; y: number }) => void,
  delay: number = DEFAULT_THROTTLE_DELAY
) => {
  return throttle(updateFn, delay, { leading: true, trailing: true });
};

/**
 * Creates a debounced version of the node position update function
 * @param updateFn Function that updates node position in Yjs
 * @param delay Debounce delay in milliseconds
 * @returns Debounced update function
 */
export const createDebouncedPositionUpdater = (
  updateFn: (nodeId: string, position: { x: number; y: number }) => void,
  delay: number = POSITION_DEBOUNCE_DELAY
) => {
  return debounce(updateFn, delay);
};

/**
 * Creates an optimized node position updater that reduces network traffic
 * @param ydoc Yjs document
 * @returns Optimized position update function
 */
export const createOptimizedPositionUpdater = (ydoc: Y.Doc | null) => {
  if (!ydoc) {
    return (nodeId: string, position: { x: number; y: number }) => {};
  }
  
  // Keep a cache of the most recent positions to avoid redundant updates
  const positionCache = new Map<string, { x: number; y: number; timestamp: number }>();
  
  // The actual update function that writes to Yjs doc
  const performYjsUpdate = (nodeId: string, position: { x: number; y: number }) => {
    try {
      const nodes = ydoc.getMap('nodes');
      if (nodes.has(nodeId)) {
        const nodeY = nodes.get(nodeId) as Y.Map<any>;
        const positionY = nodeY.get('position') as Y.Map<any>;
        
        // Update position
        positionY.set('x', position.x);
        positionY.set('y', position.y);
        
        // Update cache
        positionCache.set(nodeId, { 
          x: position.x, 
          y: position.y,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`Error updating position for node ${nodeId}:`, error);
    }
  };
  
  // Create throttled version
  const throttledUpdate = throttle(performYjsUpdate, DEFAULT_THROTTLE_DELAY, { 
    leading: true, 
    trailing: true 
  });
  
  // Create final optimized update function
  return (nodeId: string, position: { x: number; y: number }) => {
    // Check if this update is significantly different from the cached position
    const cachedPosition = positionCache.get(nodeId);
    const now = Date.now();
    
    if (cachedPosition) {
      const timeDiff = now - cachedPosition.timestamp;
      const xDiff = Math.abs(position.x - cachedPosition.x);
      const yDiff = Math.abs(position.y - cachedPosition.y);
      
      // Skip updates that are too frequent and too small
      if (timeDiff < 100 && xDiff < 5 && yDiff < 5) {
        return;
      }
      
      // For small movements, use the throttled updater
      if (xDiff < 20 && yDiff < 20) {
        throttledUpdate(nodeId, position);
        return;
      }
    }
    
    // For larger movements or no cached position, update immediately
    performYjsUpdate(nodeId, position);
  };
};

/**
 * Cleans up optimization resources
 */
export const cleanupOptimization = () => {
  chunks.clear();
  loadedNodeIds.clear();
  // currentViewport = null;
}; 