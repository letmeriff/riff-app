/**
 * Canvas Rendering Performance Tests
 * 
 * These tests measure the rendering performance of the canvas with
 * different numbers of nodes and edges.
 */
import { test, expect } from '@playwright/test';
import { createLargeCanvas, PerformanceMetrics } from '../utils/performance-test-utils';

// Test configurations with different node counts
const testConfigurations = [
  { name: 'small', nodeCount: 20, edgeCount: 10 },
  { name: 'medium', nodeCount: 100, edgeCount: 50 },
  { name: 'large', nodeCount: 250, edgeCount: 125 },
  { name: 'very-large', nodeCount: 500, edgeCount: 250 },
];

// Test threshold values
const thresholds = {
  // Time to become interactive (in ms)
  interactiveTimeThreshold: 5000,
  // FPS should not drop below this value during navigation
  minFPS: 20,
  // Maximum acceptable CPU usage percentage during idle state
  maxCPUUsage: 35,
  // Maximum memory usage in MB
  maxMemoryUsage: 350,
};

// Performance test suite
test.describe('Canvas Rendering Performance', () => {
  // Run test for each configuration
  for (const config of testConfigurations) {
    // Giving more time for larger tests
    const timeout = config.nodeCount > 200 ? 60000 : 30000;
    
    test(`Rendering performance with ${config.name} canvas (${config.nodeCount} nodes)`, async ({ page }) => {
      test.setTimeout(timeout);
      
      // Login and prepare test data
      await test.step('Login and setup', async () => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'password123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('/dashboard');
      });
      
      // Create canvas with test data
      const canvasId = await test.step('Create test canvas', async () => {
        return createLargeCanvas(
          page, 
          `Performance Test Canvas - ${config.name}`, 
          config.nodeCount, 
          config.edgeCount
        );
      });
      
      // Measure initial load performance
      const initialLoadMetrics = await test.step('Measure initial load performance', async () => {
        await page.goto(`/canvas/${canvasId}`);
        
        // Ensure the canvas is fully loaded
        await page.waitForSelector('[data-testid="canvas-container"]');
        await page.waitForSelector('[data-testid="node-element"]');
        
        // Start performance metrics collection
        await page.evaluate(() => {
          window.performance.mark('initial-load-start');
        });
        
        // Wait for canvas to be interactive (all nodes rendered)
        const nodeCount = await page.locator('[data-testid="node-element"]').count();
        expect(nodeCount).toBeGreaterThan(0);
        
        // End performance measurement
        const metrics = await page.evaluate(() => {
          window.performance.mark('initial-load-end');
          window.performance.measure('initial-load', 'initial-load-start', 'initial-load-end');
          
          const measure = window.performance.getEntriesByName('initial-load')[0];
          const memoryInfo = window.performance.memory;
          
          return {
            loadTime: measure.duration,
            nodeCount: document.querySelectorAll('[data-testid="node-element"]').length,
            memoryUsage: memoryInfo ? memoryInfo.usedJSHeapSize / (1024 * 1024) : null,
            timeToInteractive: performance.now()
          };
        });
        
        return metrics;
      });
      
      // Verify initial load metrics meet thresholds
      await test.step('Verify initial load metrics', async () => {
        console.log(`Initial load metrics for ${config.name} canvas:`, initialLoadMetrics);
        
        expect(initialLoadMetrics.timeToInteractive).toBeLessThan(thresholds.interactiveTimeThreshold);
        if (initialLoadMetrics.memoryUsage) {
          expect(initialLoadMetrics.memoryUsage).toBeLessThan(thresholds.maxMemoryUsage);
        }
      });
      
      // Measure canvas navigation performance
      const navigationMetrics = await test.step('Measure canvas navigation performance', async () => {
        // Start FPS monitoring
        await page.evaluate(() => {
          window.fpsValues = [];
          window.lastFrameTime = performance.now();
          
          window.frameCounter = requestAnimationFrame(function frameCounterFn() {
            const now = performance.now();
            const elapsed = now - (window.lastFrameTime || 0);
            
            if (elapsed > 0) {
              const fps = 1000 / elapsed;
              if (!window.fpsValues) window.fpsValues = [];
              window.fpsValues.push(fps);
            }
            
            window.lastFrameTime = now;
            window.frameCounter = requestAnimationFrame(frameCounterFn);
          });
        });
        
        // Perform canvas navigation actions
        await page.evaluate(() => {
          window.performance.mark('navigation-start');
        });
        
        // Simulate panning the canvas
        const canvasContainer = page.locator('[data-testid="canvas-container"]');
        const box = await canvasContainer.boundingBox();
        if (box) {
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          
          await page.mouse.move(centerX, centerY);
          await page.mouse.down();
          
          // Pan in multiple directions
          await page.mouse.move(centerX + 200, centerY, { steps: 10 });
          await page.mouse.move(centerX + 200, centerY + 200, { steps: 10 });
          await page.mouse.move(centerX, centerY + 200, { steps: 10 });
          await page.mouse.move(centerX, centerY, { steps: 10 });
          
          await page.mouse.up();
        }
        
        // Simulate zooming in and out
        await page.keyboard.down('Control');
        for (let i = 0; i < 5; i++) {
          await page.mouse.wheel(0, -50); // Zoom in
          await page.waitForTimeout(100);
        }
        
        for (let i = 0; i < 5; i++) {
          await page.mouse.wheel(0, 50); // Zoom out
          await page.waitForTimeout(100);
        }
        await page.keyboard.up('Control');
        
        // End navigation measurement
        const metrics = await page.evaluate(() => {
          window.performance.mark('navigation-end');
          window.performance.measure('navigation', 'navigation-start', 'navigation-end');
          
          const measure = window.performance.getEntriesByName('navigation')[0];
          
          // Clean up frame counter
          cancelAnimationFrame(window.frameCounter);
          
          // Calculate FPS statistics
          const fpsValues = window.fpsValues || [];
          const avgFps = fpsValues.reduce((sum, fps) => sum + fps, 0) / (fpsValues.length || 1);
          const minFps = Math.min(...(fpsValues.length ? fpsValues : [0]));
          
          const memoryInfo = window.performance.memory;
          
          return {
            navigationTime: measure.duration,
            averageFPS: avgFps,
            minFPS: minFps,
            memoryUsage: memoryInfo ? memoryInfo.usedJSHeapSize / (1024 * 1024) : null,
            frameCount: fpsValues.length
          };
        });
        
        return metrics;
      });
      
      // Verify navigation metrics meet thresholds
      await test.step('Verify navigation metrics', async () => {
        console.log(`Navigation metrics for ${config.name} canvas:`, navigationMetrics);
        
        // Only enforce strict limits for smaller canvases
        const fpsThreshold = config.nodeCount > 250 ? thresholds.minFPS * 0.7 : thresholds.minFPS;
        
        expect(navigationMetrics.minFPS).toBeGreaterThan(fpsThreshold);
        if (navigationMetrics.memoryUsage) {
          // Allow more memory for larger canvases
          const memoryThreshold = config.nodeCount > 250 ? 
            thresholds.maxMemoryUsage * 1.5 : thresholds.maxMemoryUsage;
          expect(navigationMetrics.memoryUsage).toBeLessThan(memoryThreshold);
        }
      });
      
      // Measure CPU usage during idle state
      const idleMetrics = await test.step('Measure idle state metrics', async () => {
        // Wait for canvas to become idle
        await page.waitForTimeout(2000);
        
        // Measure CPU usage over a short period
        return await page.evaluate(() => {
          return new Promise<PerformanceMetrics>(resolve => {
            let samples = 0;
            let totalCpuUsage = 0;
            let maxCpuUsage = 0;
            let startTime = performance.now();
            
            // Sample CPU usage a few times
            const sampleInterval = setInterval(() => {
              if (window.performance.cpu) {
                const cpuUsage = window.performance.cpu.usage;
                totalCpuUsage += cpuUsage;
                maxCpuUsage = Math.max(maxCpuUsage, cpuUsage);
                samples++;
              }
              
              if (samples >= 5 || performance.now() - startTime > 5000) {
                clearInterval(sampleInterval);
                
                const memoryInfo = window.performance.memory;
                
                resolve({
                  averageCPUUsage: samples > 0 ? totalCpuUsage / samples : null,
                  maxCPUUsage: maxCpuUsage,
                  memoryUsage: memoryInfo ? memoryInfo.usedJSHeapSize / (1024 * 1024) : null,
                  idleTime: performance.now() - startTime
                });
              }
            }, 1000);
          });
        });
      });
      
      // Verify idle metrics meet thresholds
      await test.step('Verify idle metrics', async () => {
        console.log(`Idle metrics for ${config.name} canvas:`, idleMetrics);
        
        if (idleMetrics.averageCPUUsage !== null) {
          // Adjust threshold for larger canvases
          const cpuThreshold = config.nodeCount > 250 ? 
            thresholds.maxCPUUsage * 1.5 : thresholds.maxCPUUsage;
          expect(idleMetrics.averageCPUUsage).toBeLessThan(cpuThreshold);
        }
      });
    });
  }
}); 