/**
 * Canvas Component Exports
 * 
 * This file serves as the public API for the Canvas component system.
 * It exports the Canvas components for use in the application.
 */

export { Canvas } from './Canvas';
export { default as CanvasPage } from './CanvasPage';

// Export supporting components
export { CanvasToolbar } from './components/CanvasToolbar';
export { CollaborationOverlay } from './components/CollaborationOverlay';
export { NodeControls } from './components/NodeControls';
export { default as PerformanceMonitor } from './components/PerformanceMonitor/PerformanceMonitor';
export { default as CanvasErrorBoundary } from './components/CanvasErrorBoundary'; 