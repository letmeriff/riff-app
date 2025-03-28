import { renderHook, act } from '@testing-library/react';
import { useCanvasUI } from '../useCanvasUI';
import { ViewportBounds } from '../../../types/canvas';

describe('useCanvasUI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useCanvasUI());
    
    expect(result.current.selectedNodeId).toBe(null);
    expect(result.current.selectedNodeContent).toBe(null);
    expect(result.current.viewport).toBe(null);
    expect(result.current.isMenuOpen).toBe(false);
  });

  it('should set selected node id', () => {
    const { result } = renderHook(() => useCanvasUI());
    
    act(() => {
      result.current.setSelectedNodeId('node-123');
    });
    
    expect(result.current.selectedNodeId).toBe('node-123');
  });

  it('should set selected node content', () => {
    const { result } = renderHook(() => useCanvasUI());
    
    act(() => {
      result.current.setSelectedNodeContent('Test content');
    });
    
    expect(result.current.selectedNodeContent).toBe('Test content');
  });

  it('should update viewport', () => {
    const { result } = renderHook(() => useCanvasUI());
    
    const viewport: ViewportBounds = {
      minX: 0,
      minY: 0,
      maxX: 1000,
      maxY: 800,
      zoom: 1.5
    };
    
    act(() => {
      result.current.setViewport(viewport);
    });
    
    expect(result.current.viewport).toEqual(viewport);
  });

  it('should toggle menu state', () => {
    const { result } = renderHook(() => useCanvasUI());
    
    // Initially menu is closed
    expect(result.current.isMenuOpen).toBe(false);
    
    // Toggle to open
    act(() => {
      result.current.toggleMenu();
    });
    
    expect(result.current.isMenuOpen).toBe(true);
    
    // Toggle to closed again
    act(() => {
      result.current.toggleMenu();
    });
    
    expect(result.current.isMenuOpen).toBe(false);
  });

  it('should clear selection when setting null node id', () => {
    const { result } = renderHook(() => useCanvasUI());
    
    // Set node id and content
    act(() => {
      result.current.setSelectedNodeId('node-123');
      result.current.setSelectedNodeContent('Test content');
    });
    
    expect(result.current.selectedNodeId).toBe('node-123');
    expect(result.current.selectedNodeContent).toBe('Test content');
    
    // Clear selection
    act(() => {
      result.current.setSelectedNodeId(null);
    });
    
    // Both id and content should be null
    expect(result.current.selectedNodeId).toBe(null);
    expect(result.current.selectedNodeContent).toBe(null);
  });

  it('should provide menu positioning helpers', () => {
    const { result } = renderHook(() => useCanvasUI());
    
    expect(typeof result.current.getMenuPosition).toBe('function');
    
    // Test without viewport
    expect(result.current.getMenuPosition()).toEqual({ top: 20, right: 20 });
    
    // Set viewport
    act(() => {
      result.current.setViewport({
        minX: 0,
        minY: 0,
        maxX: 1000,
        maxY: 800,
        zoom: 1
      });
    });
    
    // Test with viewport
    const menuPosition = result.current.getMenuPosition();
    expect(menuPosition).toHaveProperty('top');
    expect(menuPosition).toHaveProperty('right');
  });
}); 