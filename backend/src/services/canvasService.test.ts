import { supabase } from '../config/supabase';
import * as Y from 'yjs';
import * as yjsService from './yjsService';
import { updateNodePositionYjs, getNodePositionYjs, getYjsNodeId } from './yjsNodeService';

// Mock dependencies
jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    data: null,
    error: null,
  },
}));

// Mock Y.js
jest.mock('yjs', () => {
  // Create mock maps and functions
  const createMockMap = () => ({
    set: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
  });
  
  const mockMap = createMockMap();
  
  const mockDoc = {
    getMap: jest.fn().mockReturnValue(mockMap),
    transact: jest.fn((fn) => fn()),
  };
  
  return {
    Doc: jest.fn(() => mockDoc),
    Map: jest.fn(() => createMockMap()),
    encodeStateAsUpdate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    applyUpdate: jest.fn(),
  };
});

jest.mock('./yjsService', () => ({
  getYjsDocument: jest.fn(),
  storeYjsUpdate: jest.fn(),
  createDocumentSnapshot: jest.fn(),
}));

// Test data
const mockDocumentId = 'canvas-123';
const mockNodeId = 'node-123';
const mockUserId = 'user-123';
const mockPosition = { x: 100, y: 200 };

describe('Canvas Service Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Canvas Node Position Operations', () => {
    test('updateNodePositionYjs should update node position in Yjs document', async () => {
      // Mock getYjsDocument to return null (simulate new document)
      (yjsService.getYjsDocument as jest.Mock).mockResolvedValueOnce(null);
      
      // Mock storeYjsUpdate and createDocumentSnapshot to resolve successfully
      (yjsService.storeYjsUpdate as jest.Mock).mockResolvedValueOnce(true);
      (yjsService.createDocumentSnapshot as jest.Mock).mockResolvedValueOnce(true);
      
      // Mock Supabase response
      (supabase.from as jest.Mock).mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValueOnce({
          data: { node_id: 123, position_x: 100, position_y: 200 },
          error: null,
        }),
      }));
      
      // Call the function
      const result = await updateNodePositionYjs(
        mockDocumentId,
        mockNodeId,
        mockPosition,
        mockUserId
      );
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        position: mockPosition,
      }));
      
      // Verify storeYjsUpdate was called
      expect(yjsService.storeYjsUpdate).toHaveBeenCalledWith(
        mockDocumentId,
        expect.any(Uint8Array),
        mockUserId,
        expect.any(Number)
      );
      
      // Verify createDocumentSnapshot was called
      expect(yjsService.createDocumentSnapshot).toHaveBeenCalledWith(
        mockDocumentId,
        expect.any(Object)
      );
    });
    
    test('updateNodePositionYjs should update existing Yjs document when available', async () => {
      // Create mock document state
      const mockDocState = new Uint8Array([1, 2, 3]);
      
      // Mock getYjsDocument to return existing document
      (yjsService.getYjsDocument as jest.Mock).mockResolvedValueOnce(mockDocState);
      
      // Mock other dependencies
      (yjsService.storeYjsUpdate as jest.Mock).mockResolvedValueOnce(true);
      (yjsService.createDocumentSnapshot as jest.Mock).mockResolvedValueOnce(true);
      
      // Set up Yjs mocks for this test
      const mockDoc = new Y.Doc();
      const nodesMap = mockDoc.getMap('nodes');
      
      // Configure the mock to properly handle node lookups
      (nodesMap.has as jest.Mock).mockReturnValue(true);
      
      const mockNodeMap = {
        has: jest.fn().mockReturnValue(true),
        get: jest.fn().mockReturnValue({
          set: jest.fn(),
        }),
      };
      
      (nodesMap.get as jest.Mock).mockReturnValue(mockNodeMap);
      
      // Mock Supabase response
      (supabase.from as jest.Mock).mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValueOnce({
          data: { node_id: 123, position_x: 100, position_y: 200 },
          error: null,
        }),
      }));
      
      // Call the function
      const result = await updateNodePositionYjs(
        mockDocumentId,
        mockNodeId,
        mockPosition,
        mockUserId
      );
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        position: mockPosition,
      }));
      
      // Verify getYjsDocument was called
      expect(yjsService.getYjsDocument).toHaveBeenCalledWith(mockDocumentId);
    });
    
    test('updateNodePositionYjs should handle errors gracefully', async () => {
      // Mock getYjsDocument to throw an error
      (yjsService.getYjsDocument as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection error')
      );
      
      // Call the function
      const result = await updateNodePositionYjs(
        mockDocumentId,
        mockNodeId,
        mockPosition,
        mockUserId
      );
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
    });
    
    test('getNodePositionYjs should retrieve node position from Yjs document', async () => {
      // Create mock document state
      const mockDocState = new Uint8Array([1, 2, 3]);
      
      // Mock getYjsDocument to return document state
      (yjsService.getYjsDocument as jest.Mock).mockResolvedValueOnce(mockDocState);
      
      // Set up Yjs mocks for this test
      const mockDoc = new Y.Doc();
      const nodesMap = mockDoc.getMap('nodes');
      
      // Configure the mock to properly handle node lookups
      (nodesMap.has as jest.Mock).mockReturnValue(true);
      
      const positionMap = {
        get: jest.fn((key) => {
          if (key === 'x') return 100;
          if (key === 'y') return 200;
          return null;
        }),
      };
      
      const mockNodeMap = {
        has: jest.fn().mockReturnValue(true),
        get: jest.fn().mockReturnValue(positionMap),
      };
      
      (nodesMap.get as jest.Mock).mockReturnValue(mockNodeMap);
      
      // Call the function
      const position = await getNodePositionYjs(mockDocumentId, mockNodeId);
      
      // Assertions
      expect(position).toEqual({ x: 100, y: 200 });
      expect(yjsService.getYjsDocument).toHaveBeenCalledWith(mockDocumentId);
    });
    
    test('getNodePositionYjs should return null if document does not exist', async () => {
      // Mock getYjsDocument to return null
      (yjsService.getYjsDocument as jest.Mock).mockResolvedValueOnce(null);
      
      // Call the function
      const position = await getNodePositionYjs(mockDocumentId, mockNodeId);
      
      // Assertions
      expect(position).toBeNull();
    });
    
    test('getNodePositionYjs should return null if node does not exist in document', async () => {
      // Create mock document state
      const mockDocState = new Uint8Array([1, 2, 3]);
      
      // Mock getYjsDocument to return document state
      (yjsService.getYjsDocument as jest.Mock).mockResolvedValueOnce(mockDocState);
      
      // Set up Yjs mocks for this test
      const mockDoc = new Y.Doc();
      const nodesMap = mockDoc.getMap('nodes');
      
      // Configure the mock to return false for node lookup
      (nodesMap.has as jest.Mock).mockReturnValue(false);
      
      // Call the function
      const position = await getNodePositionYjs(mockDocumentId, mockNodeId);
      
      // Assertions
      expect(position).toBeNull();
    });
  });

  describe('Canvas Utility Functions', () => {
    test('getYjsNodeId should format node ID correctly', () => {
      expect(getYjsNodeId(123)).toBe('node-123');
      expect(getYjsNodeId(456)).toBe('node-456');
    });
  });
}); 