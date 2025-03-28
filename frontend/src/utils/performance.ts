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

// Default constants for performance optimization
const DEFAULT_THROTTLE_DELAY = 100; // ms
const DEFAULT_DEBOUNCE_DELAY = 300; // ms
const MIN_POSITION_CHANGE = 5; // pixels
const FRAME_SAMPLE_SIZE = 60; // frames

/**
 * Creates a throttled function for updating node positions
 * to reduce the frequency of updates during dragging
 */
export const createThrottledPositionUpdater = <T extends any[]>(
  updateFn: (...args: T) => void,
  delay: number = DEFAULT_THROTTLE_DELAY
): ((...args: T) => void) => {
  return throttle(updateFn, delay, { leading: true, trailing: true });
};

/**
 * Creates a debounced function for position updates
 * to delay updates until user has stopped dragging
 */
export const createDebouncedPositionUpdater = <T extends any[]>(
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
  updateFn: (nodeId: string, position: { x: number, y: number }) => void
) => {
  // Cache of last known positions to compare against
  const positionCache = new Map<string, { x: number, y: number, timestamp: number }>();
  
  return (nodeId: string, position: { x: number, y: number }) => {
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
  let pendingNodeUpdates = new Map<string, Node>();
  let pendingEdgeUpdates = new Map<string, Edge>();
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
          let nodeYMap: Y.Map<any>;
          
          if (nodesMap.has(nodeId)) {
            nodeYMap = nodesMap.get(nodeId) as Y.Map<any>;
          } else {
            nodeYMap = new Y.Map();
            nodesMap.set(nodeId, nodeYMap);
          }
          
          // Update node data
          if (nodeData.position) {
            let posYMap: Y.Map<any>;
            
            if (nodeYMap.has('position')) {
              posYMap = nodeYMap.get('position') as Y.Map<any>;
            } else {
              posYMap = new Y.Map();
              nodeYMap.set('position', posYMap);
            }
            
            posYMap.set('x', nodeData.position.x);
            posYMap.set('y', nodeData.position.y);
          }
          
          // Update data properties if changed
          if (nodeData.data) {
            let dataYMap: Y.Map<any>;
            
            if (nodeYMap.has('data')) {
              dataYMap = nodeYMap.get('data') as Y.Map<any>;
            } else {
              dataYMap = new Y.Map();
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
            const edgeYMap = edgesMap.get(edgeId) as Y.Map<any>;
            
            // Set edge properties
            if (edgeData.source) edgeYMap.set('source', edgeData.source);
            if (edgeData.target) edgeYMap.set('target', edgeData.target);
          } else {
            // Create new edge
            const edgeYMap = new Y.Map();
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
    updateNodePosition: (nodeId: string, position: { x: number, y: number }) => {
      const existingNode = pendingNodeUpdates.get(nodeId) || { id: nodeId } as Node;
      pendingNodeUpdates.set(nodeId, {
        ...existingNode,
        position
      });
      scheduleTransaction();
    },
    
    // Force immediate processing of the queue
    flush: () => {
      if (pendingNodeUpdates.size > 0 || pendingEdgeUpdates.size > 0) {
        // Clear scheduled transaction if any
        isTransactionScheduled = false;
        
        // Process immediately
        ydoc.transact(() => {
          // Same logic as in scheduleTransaction
          const nodesMap = ydoc.getMap(nodesMapName);
          const edgesMap = ydoc.getMap(edgesMapName);
          
          // Apply node updates
          Array.from(pendingNodeUpdates.entries()).forEach(([nodeId, nodeData]) => {
            let nodeYMap: Y.Map<any>;
            
            if (nodesMap.has(nodeId)) {
              nodeYMap = nodesMap.get(nodeId) as Y.Map<any>;
            } else {
              nodeYMap = new Y.Map();
              nodesMap.set(nodeId, nodeYMap);
            }
            
            // Update position
            if (nodeData.position) {
              let posYMap: Y.Map<any>;
              
              if (nodeYMap.has('position')) {
                posYMap = nodeYMap.get('position') as Y.Map<any>;
              } else {
                posYMap = new Y.Map();
                nodeYMap.set('position', posYMap);
              }
              
              posYMap.set('x', nodeData.position.x);
              posYMap.set('y', nodeData.position.y);
            }
            
            // Update data
            if (nodeData.data) {
              let dataYMap: Y.Map<any>;
              
              if (nodeYMap.has('data')) {
                dataYMap = nodeYMap.get('data') as Y.Map<any>;
              } else {
                dataYMap = new Y.Map();
                nodeYMap.set('data', dataYMap);
              }
              
              // Update all data properties
              Object.entries(nodeData.data).forEach(([key, value]) => {
                dataYMap.set(key, value);
              });
            }
          });
          
          // Apply edge updates
          Array.from(pendingEdgeUpdates.entries()).forEach(([edgeId, edgeData]) => {
            if (edgesMap.has(edgeId)) {
              const edgeYMap = edgesMap.get(edgeId) as Y.Map<any>;
              if (edgeData.source) edgeYMap.set('source', edgeData.source);
              if (edgeData.target) edgeYMap.set('target', edgeData.target);
            } else {
              const edgeYMap = new Y.Map();
              edgeYMap.set('id', edgeId);
              edgeYMap.set('source', edgeData.source);
              edgeYMap.set('target', edgeData.target);
              edgesMap.set(edgeId, edgeYMap);
            }
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
 * Measures rendering performance by tracking frame rates
 * Use this for performance testing and optimization
 */
export const measureRenderPerformance = (
  callback?: (metrics: PerformanceMetrics) => void
) => {
  let frameCount = 0;
  let lastTime = performance.now();
  let frameTimes: number[] = [];
  
  // Function to measure frame rate
  const measure = () => {
    const now = performance.now();
    const elapsed = now - lastTime;
    
    // Record frame time
    frameTimes.push(elapsed);
    if (frameTimes.length > FRAME_SAMPLE_SIZE) {
      frameTimes.shift();
    }
    
    // Calculate metrics
    frameCount++;
    
    // Every 60 frames, report metrics
    if (frameCount % FRAME_SAMPLE_SIZE === 0) {
      const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
      const frameRate = 1000 / avgFrameTime;
      
      // Create metrics report
      const metrics: PerformanceMetrics = {
        renderTime: avgFrameTime,
        frameRate: frameRate
      };
      
      // Try to get memory usage if available
      if (window.performance && 'memory' in window.performance) {
        const memory = (window.performance as any).memory;
        metrics.memoryUsage = memory.usedJSHeapSize / (1024 * 1024); // MB
      }
      
      // Report metrics via callback
      if (callback) {
        callback(metrics);
      }
    }
    
    lastTime = now;
    requestAnimationFrame(measure);
  };
  
  // Start measurement
  requestAnimationFrame(measure);
  
  // Return a function to stop measurement
  return () => {
    // Cancel measurement (not actually possible with requestAnimationFrame)
    // This is just a signal that measurement should stop
    frameTimes = [];
  };
}; 