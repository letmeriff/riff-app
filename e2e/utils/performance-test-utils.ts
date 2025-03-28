/**
 * Performance Testing Utilities
 * 
 * This module provides helper functions and interfaces for performance testing.
 */
import { Page } from '@playwright/test';

/**
 * Performance metrics interface for collecting test results
 */
export interface PerformanceMetrics {
  // Timing metrics
  loadTime?: number;
  navigationTime?: number;
  timeToInteractive?: number;
  idleTime?: number;
  
  // Resource metrics
  memoryUsage?: number | null;
  nodeCount?: number;
  edgeCount?: number;
  
  // Rendering metrics
  averageFPS?: number;
  minFPS?: number;
  frameCount?: number;
  
  // CPU metrics
  averageCPUUsage?: number | null;
  maxCPUUsage?: number;
}

// Type definitions for performance API extensions
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceCPU {
  usage: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
  cpu?: PerformanceCPU;
}

// Node and edge types for the canvas
interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  data?: Record<string, unknown>;
}

interface TestUtils {
  createTestNodes: (nodeCount: number, edgeCount: number) => void;
}

interface CanvasAPI {
  addNodes: (nodes: CanvasNode[]) => Promise<void>;
  addEdges: (edges: CanvasEdge[]) => Promise<void>;
}

interface YjsDoc {
  getMap: (name: string) => unknown;
}

interface YjsProvider {
  ydoc?: YjsDoc;
}

interface CanvasInstance {
  addNodes?: (nodes: CanvasNode[]) => void;
  setNodes?: (nodes: CanvasNode[]) => void;
  addEdges?: (edges: CanvasEdge[]) => void;
  setEdges?: (edges: CanvasEdge[]) => void;
}

/**
 * Extends Window interface to include performance test properties
 */
declare global {
  interface Window {
    // Performance tracking properties
    fpsValues?: number[];
    lastFrameTime?: number;
    frameCounter?: number;
    performanceMetrics?: PerformanceMetrics;
    
    // Canvas related properties
    testUtils?: TestUtils;
    canvasAPI?: CanvasAPI;
    canvas?: CanvasInstance;
    reactFlowInstance?: CanvasInstance;
    yjsProvider?: YjsProvider;
    
    // Make TypeScript happy with our Performance API extensions
    performance: ExtendedPerformance;
  }
}

/**
 * Create a test canvas with specified number of nodes and edges
 * @param page Playwright page object
 * @param name Name of the canvas
 * @param nodeCount Number of nodes to create
 * @param edgeCount Number of edges to create
 * @returns Promise with the created canvas ID
 */
export async function createLargeCanvas(
  page: Page, 
  name: string, 
  nodeCount: number = 50, 
  edgeCount: number = 25
): Promise<string> {
  // Create a new canvas
  await page.goto('/dashboard');
  await page.click('[data-testid="create-canvas-button"]');
  await page.fill('[data-testid="canvas-name-input"]', name);
  await page.click('[data-testid="submit-canvas-button"]');
  
  // Wait for canvas to load
  await page.waitForSelector('[data-testid="canvas-container"]');
  
  // Get the canvas ID from the URL
  const url = page.url();
  const canvasId = url.split('/').pop() || '';
  
  // Programmatically create nodes and edges for testing
  await page.evaluate(({ nodeCount, edgeCount }) => {
    // Use any available test helpers in the application
    if (window.testUtils && window.testUtils.createTestNodes) {
      window.testUtils.createTestNodes(nodeCount, edgeCount);
      return;
    }
    
    // Fallback method if no test helpers are available
    // This assumes there's a global canvas object or we can access it
    const createTestNodes = async () => {
      // Mock node data - adapt this to the application's data structure
      const nodes = Array.from({ length: nodeCount }, (_, i) => ({
        id: `node-${i}`,
        type: i % 3 === 0 ? 'chat' : i % 3 === 1 ? 'text' : 'document',
        position: { 
          x: Math.floor(Math.random() * 2000) - 1000, 
          y: Math.floor(Math.random() * 2000) - 1000 
        },
        data: { 
          label: `Node ${i}`,
          content: `This is test content for node ${i}` 
        }
      }));
      
      // Use canvas API if available
      if (window.canvasAPI && window.canvasAPI.addNodes) {
        await window.canvasAPI.addNodes(nodes);
      } else {
        // Try to find canvas related objects in global scope
        const canvasInstance = 
          window.canvas || 
          window.reactFlowInstance || 
          window.yjsProvider?.ydoc?.getMap('nodes');
        
        if (canvasInstance && 'addNodes' in canvasInstance && typeof canvasInstance.addNodes === 'function') {
          await canvasInstance.addNodes(nodes);
        } else if (canvasInstance && 'setNodes' in canvasInstance && typeof canvasInstance.setNodes === 'function') {
          await canvasInstance.setNodes(nodes);
        }
      }
      
      // Create edges if we have a function for it
      if (edgeCount > 0) {
        const createEdges = () => {
          const edges: CanvasEdge[] = [];
          for (let i = 0; i < edgeCount; i++) {
            const sourceIndex = Math.floor(Math.random() * nodeCount);
            let targetIndex;
            do {
              targetIndex = Math.floor(Math.random() * nodeCount);
            } while (targetIndex === sourceIndex);
            
            edges.push({
              id: `edge-${i}`,
              source: `node-${sourceIndex}`,
              target: `node-${targetIndex}`,
              data: { label: `Connection ${i}` }
            });
          }
          return edges;
        };
        
        const edges = createEdges();
        
        // Try to find canvas API or instance
        const canvasAPI = window.canvasAPI;
        const canvasInstance = 
          window.canvas || 
          window.reactFlowInstance || 
          window.yjsProvider?.ydoc?.getMap('edges');
        
        if (canvasAPI && canvasAPI.addEdges) {
          await canvasAPI.addEdges(edges);
        } else if (canvasInstance && 'addEdges' in canvasInstance && typeof canvasInstance.addEdges === 'function') {
          await canvasInstance.addEdges(edges);
        } else if (canvasInstance && 'setEdges' in canvasInstance && typeof canvasInstance.setEdges === 'function') {
          await canvasInstance.setEdges(edges);
        }
      }
    };
    
    return createTestNodes();
  }, { nodeCount, edgeCount });
  
  // Wait for everything to be rendered
  await page.waitForTimeout(2000);
  
  return canvasId;
}

/**
 * Measure performance metrics of the current page
 * @param page Playwright page
 * @returns Performance metrics
 */
export async function measurePerformance(page: Page): Promise<PerformanceMetrics> {
  return await page.evaluate(() => {
    const metrics: PerformanceMetrics = {};
    
    // Get memory usage if available
    if (window.performance.memory) {
      metrics.memoryUsage = window.performance.memory.usedJSHeapSize / (1024 * 1024);
    }
    
    // Get number of nodes and edges (assuming we can find them in the DOM)
    metrics.nodeCount = document.querySelectorAll('[data-testid="node-element"]').length;
    metrics.edgeCount = document.querySelectorAll('[data-testid="edge-element"]').length;
    
    // Get CPU usage if available
    if (window.performance.cpu) {
      metrics.averageCPUUsage = window.performance.cpu.usage;
    }
    
    return metrics;
  });
}

/**
 * Record FPS measurements over a specified period
 * @param page Playwright page
 * @param durationMs Duration to measure FPS in milliseconds
 * @returns FPS metrics
 */
export async function recordFPS(page: Page, durationMs: number = 5000): Promise<{
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
}> {
  // Start FPS recording
  await page.evaluate(() => {
    window.fpsValues = [];
    window.lastFrameTime = performance.now();
    
    window.frameCounter = requestAnimationFrame(function frameCounterFn() {
      const now = performance.now();
      const elapsed = now - (window.lastFrameTime || now);
      
      if (elapsed > 0) {
        const fps = 1000 / elapsed;
        if (!window.fpsValues) window.fpsValues = [];
        window.fpsValues.push(fps);
      }
      
      window.lastFrameTime = now;
      window.frameCounter = requestAnimationFrame(frameCounterFn);
    });
  });
  
  // Wait for the specified duration
  await page.waitForTimeout(durationMs);
  
  // Stop recording and compute metrics
  return await page.evaluate(() => {
    if (window.frameCounter) {
      cancelAnimationFrame(window.frameCounter);
    }
    
    const fpsValues = window.fpsValues || [];
    if (fpsValues.length === 0) {
      return { averageFPS: 0, minFPS: 0, maxFPS: 0 };
    }
    
    const sum = fpsValues.reduce((total, fps) => total + fps, 0);
    return {
      averageFPS: sum / fpsValues.length,
      minFPS: Math.min(...fpsValues),
      maxFPS: Math.max(...fpsValues)
    };
  });
} 