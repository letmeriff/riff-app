import { renderHook, act } from '@testing-library/react';
import { useCanvasNodes } from '../useCanvasNodes';
import * as nodeService from '../../../services/nodeService';
import { useAuth } from '../../../contexts/AuthContext';
import { useYjs } from '../../../contexts/YjsContext';
import { XYPosition } from 'reactflow';

// Import the mocks
import '../../../test-utils/mocks/reactflow.mock';
import '../../../test-utils/mocks/yjs.mock';

// Additional mocks for services and contexts
jest.mock('../../../services/nodeService', () => ({
  fetchNodes: jest.fn(),
  createNode: jest.fn(),
  deleteNode: jest.fn(),
  updateNodePosition: jest.fn(),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'test-user' } })),
}));

jest.mock('../../../contexts/YjsContext', () => ({
  useYjs: jest.fn(() => ({ 
    isConnected: true, 
    ydoc: {}, 
    getNodesFromYjs: jest.fn().mockReturnValue([]) 
  })),
}));

describe('useCanvasNodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useCanvasNodes());
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('should load nodes from backend on initialization', async () => {
    const mockNodes = [
      { node_id: 1, title: 'Test Node 1', position_x: 100, position_y: 100 },
      { node_id: 2, title: 'Test Node 2', position_x: 200, position_y: 200 },
    ];
    (nodeService.fetchNodes as jest.Mock).mockResolvedValue(mockNodes);
    
    const { result } = renderHook(() => useCanvasNodes());
    
    // Initially in loading state
    expect(result.current.loading).toBe(true);
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // After loading
    expect(result.current.loading).toBe(false);
    expect(nodeService.fetchNodes).toHaveBeenCalled();
  });

  it('should load nodes from Yjs when available', async () => {
    const mockYjsNodes = [
      { id: '1', position: { x: 100, y: 100 }, data: { label: 'Test Node 1' } },
      { id: '2', position: { x: 200, y: 200 }, data: { label: 'Test Node 2' } },
    ];
    
    (useYjs as jest.Mock).mockReturnValue({
      isConnected: true,
      ydoc: {},
      getNodesFromYjs: jest.fn().mockReturnValue(mockYjsNodes),
    });
    
    const { result } = renderHook(() => useCanvasNodes());
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current.loading).toBe(false);
  });

  it('should create a new node', async () => {
    const mockCreatedNode = {
      node_id: 3,
      title: 'New Node',
      position_x: 300,
      position_y: 300,
    };
    (nodeService.createNode as jest.Mock).mockResolvedValue(mockCreatedNode);
    
    const { result } = renderHook(() => useCanvasNodes());
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current.loading).toBe(false);
    
    await act(async () => {
      const position: XYPosition = { x: 300, y: 300 };
      await result.current.createNode(position);
    });
    
    expect(nodeService.createNode).toHaveBeenCalled();
  });

  it('should update node position', async () => {
    const mockPosition = { x: 500, y: 500 };
    (nodeService.updateNodePosition as jest.Mock).mockResolvedValue({ success: true });
    
    const { result } = renderHook(() => useCanvasNodes());
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    await act(async () => {
      result.current.updateNodePosition('1', mockPosition);
    });
    
    expect(nodeService.updateNodePosition).toHaveBeenCalled();
  });

  it('should delete a node', async () => {
    (nodeService.deleteNode as jest.Mock).mockResolvedValue(undefined);
    
    const { result } = renderHook(() => useCanvasNodes());
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    let success: boolean = false;
    await act(async () => {
      success = await result.current.deleteNode('1');
    });
    
    expect(success).toBe(true);
    expect(nodeService.deleteNode).toHaveBeenCalledWith(1);
  });

  it('should handle errors during operations', async () => {
    const mockError = new Error('Something went wrong');
    (nodeService.fetchNodes as jest.Mock).mockRejectedValue(mockError);
    
    const { result } = renderHook(() => useCanvasNodes());
    
    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current.error).toEqual(mockError);
  });
}); 