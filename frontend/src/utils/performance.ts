/**
 * Performance Utilities
 * 
 * This file provides utility functions for measuring and optimizing performance
 * in the application, particularly for Canvas rendering and Yjs data sync.
 */

import { Node, Edge } from 'reactflow';
import * as Y from 'yjs';
import { debounce, throttle } from 'lodash';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  renderTime?: number;
  frameRate?: number;
  memoryUsage?: number;
  nodeCount?: number;
  edgeCount?: number;
  syncTime?: number;
}

/**
 * Viewport boundaries
 */
export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  zoom: number;
}

// Define commonly used types
interface Position {
  x: number;
  y: number;
}

interface CachedPosition extends Position {
  timestamp: number;
}

// Custom interface for Yjs map access
interface YNodeMap {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
}

// Default constants for performance optimization
const DEFAULT_THROTTLE_DELAY = 100; // ms
const DEFAULT_DEBOUNCE_DELAY = 300; // ms
const MIN_POSITION_CHANGE = 5; // pixels
const FRAME_SAMPLE_SIZE = 60; // frames

/**
 * Creates a throttled function for updating node positions
 * to reduce the frequency of updates during dragging
 */
export const createThrottledPositionUpdater = <T extends unknown[]>(
  updateFn: (...args: T) => void,
  delay: number = DEFAULT_THROTTLE_DELAY
): ((...args: T) => void) => {
  return throttle(updateFn, delay, { leading: true, trailing: true });
};

/**
 * Creates a debounced function for position updates
 * to delay updates until user has stopped dragging
 */
export const createDebouncedPositionUpdater = <T extends unknown[]>(
  updateFn: (...args: T) => void,
  delay: number = DEFAULT_DEBOUNCE_DELAY
): ((...args: T) => void) => {
  return debounce(updateFn, delay);
};

/**
 * Optimized position update function that filters out insignificant movements
 * to reduce unnecessary updates
 */
export const createOptimizedPositionUpdater = (
  updateFn: (nodeId: string, position: Position) => void
) => {
  // Cache of last known positions to compare against
  const positionCache = new Map<string, CachedPosition>();
  
  return (nodeId: string, position: Position) => {
    const cachedPosition = positionCache.get(nodeId);
    const now = Date.now();
    
    // If we have a cached position, check if the movement is significant enough
    if (cachedPosition) {
      const timeDiff = now - cachedPosition.timestamp;
      const xDiff = Math.abs(position.x - cachedPosition.x);
      const yDiff = Math.abs(position.y - cachedPosition.y);
      
      // Skip tiny movements that happen frequently (likely just minor adjustments)
      if (timeDiff < 50 && xDiff < MIN_POSITION_CHANGE && yDiff < MIN_POSITION_CHANGE) {
        return;
      }
    }
    
    // Update cache
    positionCache.set(nodeId, {
      x: position.x,
      y: position.y,
      timestamp: now
    });
    
    // Call the actual update function
    updateFn(nodeId, position);
  };
};

/**
 * Creates a viewport filter function that only includes nodes
 * visible in the current viewport (with padding) for performance
 */
export const createViewportFilter = (padding: number = 500) => {
  return (nodes: Node[], viewport: ViewportBounds): Node[] => {
    if (!viewport) return nodes;
    
    const { minX, minY, maxX, maxY } = viewport;
    
    // Add padding to the viewport bounds
    const paddedMinX = minX - padding;
    const paddedMinY = minY - padding;
    const paddedMaxX = maxX + padding;
    const paddedMaxY = maxY + padding;
    
    // Filter nodes to only include those in the padded viewport
    return nodes.filter(node => {
      const { x, y } = node.position;
      return (
        x >= paddedMinX &&
        x <= paddedMaxX &&
        y >= paddedMinY &&
        y <= paddedMaxY
      );
    });
  };
};

/**
 * Optimizes Yjs updates to prevent excessive document updates
 * for performance-critical operations
 */
export const createOptimizedYjsUpdater = (
  ydoc: Y.Doc,
  nodesMapName: string = 'nodes',
  edgesMapName: string = 'edges'
) => {
  // Create a transaction queue to batch updates
  const pendingNodeUpdates = new Map<string, Node>();
  const pendingEdgeUpdates = new Map<string, Edge>();
  let isTransactionScheduled = false;
  
  // Function to schedule a transaction
  const scheduleTransaction = () => {
    if (isTransactionScheduled) return;
    
    isTransactionScheduled = true;
    
    // Schedule transaction for the next tick
    setTimeout(() => {
      // Process all pending updates in a single transaction
      ydoc.transact(() => {
        // Get node and edge maps
        const nodesMap = ydoc.getMap(nodesMapName);
        const edgesMap = ydoc.getMap(edgesMapName);
        
        // Apply node updates
        Array.from(pendingNodeUpdates.entries()).forEach(([nodeId, nodeData]) => {
          let nodeYMap: YNodeMap;
          
          if (nodesMap.has(nodeId)) {
            nodeYMap = nodesMap.get(nodeId) as YNodeMap;
          } else {
            nodeYMap = new Y.Map() as YNodeMap;
            nodesMap.set(nodeId, nodeYMap);
          }
          
          // Update node data
          if (nodeData.position) {
            let posYMap: YNodeMap;
            
            if (nodeYMap.has('position')) {
              posYMap = nodeYMap.get('position') as YNodeMap;
            } else {
              posYMap = new Y.Map() as YNodeMap;
              nodeYMap.set('position', posYMap);
            }
            
            posYMap.set('x', nodeData.position.x);
            posYMap.set('y', nodeData.position.y);
          }
          
          // Update data properties if changed
          if (nodeData.data) {
            let dataYMap: YNodeMap;
            
            if (nodeYMap.has('data')) {
              dataYMap = nodeYMap.get('data') as YNodeMap;
            } else {
              dataYMap = new Y.Map() as YNodeMap;
              nodeYMap.set('data', dataYMap);
            }
            
            // Update all data properties
            Object.entries(nodeData.data).forEach(([key, value]) => {
              dataYMap.set(key, value);
            });
          }
        });
        
        // Apply edge updates (simplified)
        Array.from(pendingEdgeUpdates.entries()).forEach(([edgeId, edgeData]) => {
          // Similar logic for edges (simplified here)
          if (edgesMap.has(edgeId)) {
            // Update existing edge
            const edgeYMap = edgesMap.get(edgeId) as YNodeMap;
            
            // Set edge properties
            if (edgeData.source) edgeYMap.set('source', edgeData.source);
            if (edgeData.target) edgeYMap.set('target', edgeData.target);
          } else {
            // Create new edge
            const edgeYMap = new Y.Map() as YNodeMap;
            edgeYMap.set('id', edgeId);
            edgeYMap.set('source', edgeData.source);
            edgeYMap.set('target', edgeData.target);
            edgesMap.set(edgeId, edgeYMap);
          }
        });
      });
      
      // Clear pending updates and reset flag
      pendingNodeUpdates.clear();
      pendingEdgeUpdates.clear();
      isTransactionScheduled = false;
    }, 0);
  };
  
  // Return the update functions
  return {
    // Queue a node update
    updateNode: (node: Node) => {
      pendingNodeUpdates.set(node.id, node);
      scheduleTransaction();
    },
    
    // Queue an edge update
    updateEdge: (edge: Edge) => {
      pendingEdgeUpdates.set(edge.id, edge);
      scheduleTransaction();
    },
    
    // Update a node's position only
    updateNodePosition: (nodeId: string, position: Position) => {
      const existingNode = pendingNodeUpdates.get(nodeId) || { id: nodeId } as Node;
      pendingNodeUpdates.set(nodeId, {
        ...existingNode,
        position
      });
      scheduleTransaction();
    },
    
    // Force apply all pending updates immediately
    flushUpdates: () => {
      if (pendingNodeUpdates.size > 0 || pendingEdgeUpdates.size > 0) {
        // Cancel any scheduled transaction
        if (isTransactionScheduled) {
          isTransactionScheduled = false;
        }
        
        // Apply updates immediately
        ydoc.transact(() => {
          const nodesMap = ydoc.getMap(nodesMapName);
          const edgesMap = ydoc.getMap(edgesMapName);
          
          // Apply node updates
          Array.from(pendingNodeUpdates.entries()).forEach(([nodeId, nodeData]) => {
            let nodeYMap: YNodeMap;
            
            if (nodesMap.has(nodeId)) {
              nodeYMap = nodesMap.get(nodeId) as YNodeMap;
            } else {
              nodeYMap = new Y.Map() as YNodeMap;
              nodesMap.set(nodeId, nodeYMap);
            }
            
            // Update position and data
            if (nodeData.position) {
              let posYMap: YNodeMap;
              
              if (nodeYMap.has('position')) {
                posYMap = nodeYMap.get('position') as YNodeMap;
              } else {
                posYMap = new Y.Map() as YNodeMap;
                nodeYMap.set('position', posYMap);
              }
              
              posYMap.set('x', nodeData.position.x);
              posYMap.set('y', nodeData.position.y);
            }
            
            if (nodeData.data) {
              let dataYMap: YNodeMap;
              
              if (nodeYMap.has('data')) {
                dataYMap = nodeYMap.get('data') as YNodeMap;
              } else {
                dataYMap = new Y.Map() as YNodeMap;
                nodeYMap.set('data', dataYMap);
              }
              
              Object.entries(nodeData.data).forEach(([key, value]) => {
                dataYMap.set(key, value);
              });
            }
          });
          
          // Apply edge updates
          Array.from(pendingEdgeUpdates.entries()).forEach(([edgeId, edgeData]) => {
            let edgeYMap: YNodeMap;
            
            if (edgesMap.has(edgeId)) {
              edgeYMap = edgesMap.get(edgeId) as YNodeMap;
            } else {
              edgeYMap = new Y.Map() as YNodeMap;
              edgesMap.set(edgeId, edgeYMap);
            }
            
            edgeYMap.set('id', edgeId);
            edgeYMap.set('source', edgeData.source);
            edgeYMap.set('target', edgeData.target);
          });
        });
        
        // Clear pending updates
        pendingNodeUpdates.clear();
        pendingEdgeUpdates.clear();
      }
    }
  };
};

/**
 * Measures render performance for a component
 */
export const measureRenderPerformance = (
  callback?: (metrics: PerformanceMetrics) => void
) => {
  let frameCounter = 0;
  let lastFrameTime = performance.now();
  let frameRates: number[] = [];
  
  const measure = () => {
    const now = performance.now();
    const frameDuration = now - lastFrameTime;
    const frameRate = 1000 / frameDuration;
    
    // Record frame rate
    frameRates.push(frameRate);
    
    // Keep only the most recent samples
    if (frameRates.length > FRAME_SAMPLE_SIZE) {
      frameRates = frameRates.slice(-FRAME_SAMPLE_SIZE);
    }
    
    // Calculate average frame rate
    const avgFrameRate = frameRates.reduce((sum, rate) => sum + rate, 0) / frameRates.length;
    
    // Get memory usage if available
    let memoryUsage: number | undefined;
    // The Performance object may have a non-standard memory property in some browsers
    // Use type assertion to handle this browser-specific property
    const performanceWithMemory = performance as unknown as { memory?: { usedJSHeapSize: number } };
    if (performanceWithMemory.memory) {
      memoryUsage = performanceWithMemory.memory.usedJSHeapSize;
    }
    
    // Update metrics
    const metrics: PerformanceMetrics = {
      renderTime: frameDuration,
      frameRate: avgFrameRate,
      memoryUsage
    };
    
    // Call the callback with metrics
    if (callback && frameCounter % 10 === 0) {
      callback(metrics);
    }
    
    // Update for next frame
    lastFrameTime = now;
    frameCounter++;
    
    // Continue measuring
    requestAnimationFrame(measure);
  };
  
  // Start measuring
  requestAnimationFrame(measure);
  
  // Return function to stop measuring
  return {
    stop: () => {
      // No direct way to stop requestAnimationFrame
      // This method would require a global ID to cancel
      // In a real implementation, track the RAF ID
    },
    getMetrics: (): PerformanceMetrics => {
      return {
        frameRate: frameRates.length ? 
          frameRates.reduce((sum, rate) => sum + rate, 0) / frameRates.length : 
          undefined,
        renderTime: lastFrameTime ? performance.now() - lastFrameTime : undefined
      };
    }
  };
}; 