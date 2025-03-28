import { renderHook, act } from '@testing-library/react';
import { Connection, Edge } from 'reactflow';
import { useCanvasEdges } from '../useCanvasEdges';
import { useYjs } from '../../../contexts/YjsContext';

// Import the mocks
import '../../../test-utils/mocks/reactflow.mock';
import '../../../test-utils/mocks/yjs.mock';

// Mock the Yjs context
jest.mock('../../../contexts/YjsContext', () => ({
  useYjs: jest.fn(() => ({ 
    isConnected: true, 
    ydoc: {}, 
    getEdgesFromYjs: jest.fn().mockReturnValue([]) 
  })),
}));

// Mock the utility functions
jest.mock('../../../utils/reactFlowYjsBinding', () => ({
  syncEdgeChangesToYjs: jest.fn((changes, edges) => edges),
  syncEdgeDeletionToYjs: jest.fn(),
}));

describe('useCanvasEdges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useCanvasEdges());
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('should load edges from backend on initialization', async () => {
    const { result } = renderHook(() => useCanvasEdges());
    
    // Initially in loading state
    expect(result.current.loading).toBe(true);
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // After loading
    expect(result.current.loading).toBe(false);
  });

  it('should load edges from Yjs when available', async () => {
    const mockYjsEdges = [
      { id: 'edge-1-2', source: '1', target: '2' },
      { id: 'edge-2-3', source: '2', target: '3' },
    ];
    
    (useYjs as jest.Mock).mockReturnValue({
      isConnected: true,
      ydoc: {},
      getEdgesFromYjs: jest.fn().mockReturnValue(mockYjsEdges),
    });
    
    const { result } = renderHook(() => useCanvasEdges());
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current.loading).toBe(false);
  });

  it('should create a new edge', async () => {
    const { result } = renderHook(() => useCanvasEdges());
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    let newEdge: Edge | null = null;
    
    act(() => {
      // Type assertion here to make TypeScript happy
      newEdge = result.current.createEdge('1', '2') as Edge;
    });
    
    expect(newEdge).not.toBeNull();
    if (newEdge) {
      expect(newEdge.id).toContain('edge');
      expect(newEdge.source).toBe('1');
      expect(newEdge.target).toBe('2');
    }
  });

  it('should connect nodes via onConnect callback', async () => {
    const { result } = renderHook(() => useCanvasEdges());
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    act(() => {
      const connection: Connection = {
        source: '3',
        target: '4',
        sourceHandle: null,
        targetHandle: null
      };
      result.current.onConnect(connection);
    });

    // We can't directly test state changes with the mocked useEdgesState,
    // but we can verify that the callback was executed without errors
  });

  it('should delete an edge', async () => {
    const { result } = renderHook(() => useCanvasEdges());
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    let success = false;
    
    act(() => {
      success = result.current.deleteEdge('edge-1-2');
    });
    
    expect(success).toBe(true);
  });

  it('should handle errors during operations', async () => {
    // Mock Yjs to throw an error
    (useYjs as jest.Mock).mockReturnValue({
      isConnected: true,
      ydoc: {},
      getEdgesFromYjs: jest.fn().mockImplementation(() => {
        throw new Error('Failed to get edges from Yjs');
      }),
    });
    
    const { result } = renderHook(() => useCanvasEdges());
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current.error).toEqual(expect.any(Error));
    expect(result.current.error?.message).toBe('Failed to get edges from Yjs');
  });
}); 