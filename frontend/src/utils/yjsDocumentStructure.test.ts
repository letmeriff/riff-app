/**
 * Test file for Yjs document structure operations
 * 
 * Reference: REQ-301 Collaborative Document Structure
 * Tests for proper Yjs document structure initialization, shared types (Map, Array),
 * document updates, and transactional changes.
 */

import { 
  initializeDocument, 
  getSharedTypes, 
  updateNode, 
  updateEdge, 
  updateMetadata,
  applyYjsUpdate,
  createNodeWithId
} from './yjsDocumentStructure'; // This file will be created after tests

import { Node, Edge } from 'reactflow';

// Mock Yjs module
jest.mock('yjs', () => {
  return {
    Doc: jest.fn(),
    Map: jest.fn(),
    Array: jest.fn(),
    Text: jest.fn(),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn(() => new Uint8Array([1, 2, 3]))
  };
});

// Import after mocking
import * as yjs from 'yjs';

// Define interfaces for our mock objects
interface MockMap {
  set: jest.Mock;
  get: jest.Mock;
  has: jest.Mock;
  delete: jest.Mock;
  toJSON: jest.Mock;
}

interface MockYjsDoc {
  getMap: jest.Mock;
  share: {
    has: jest.Mock;
  };
  destroy: jest.Mock;
  transact: jest.Mock;
}

describe('Yjs Document Structure', () => {
  // Create mock maps for our document structure
  const mockMaps: Record<string, MockMap> = {};
  
  // Create mock doc before each test
  let mockDoc: MockYjsDoc;
  let mockTransactFn: jest.Mock;
  
  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    
    // Reset mock maps
    for (const key in mockMaps) {
      delete mockMaps[key];
    }
    
    // Create mock transaction function
    mockTransactFn = jest.fn((fn) => fn());
    
    // Create a mock document
    mockDoc = {
      getMap: jest.fn((name) => {
        if (!mockMaps[name]) {
          mockMaps[name] = createMockMap();
        }
        return mockMaps[name];
      }),
      share: {
        has: jest.fn((name) => !!mockMaps[name])
      },
      destroy: jest.fn(),
      transact: mockTransactFn
    };
  });

  // Helper to create a mock Y.Map
  function createMockMap(): MockMap {
    const data = new Map<string, unknown>();
    return {
      set: jest.fn((key, value) => {
        data.set(key, value);
        return value;
      }),
      get: jest.fn((key) => data.get(key)),
      has: jest.fn((key) => data.has(key)),
      delete: jest.fn((key) => data.delete(key)),
      toJSON: jest.fn(() => {
        const obj: Record<string, unknown> = {};
        data.forEach((value, key) => {
          obj[key] = value;
        });
        return obj;
      })
    };
  }

  // Reference: REQ-301.1 Document Initialization
  describe('Document Initialization', () => {
    it('should initialize a document with required shared collections', () => {
      // Act
      const initializedDoc = initializeDocument(mockDoc as unknown as yjs.Doc);
      
      // Assert
      expect(initializedDoc).toBe(mockDoc); // Should return the same document
      expect(mockDoc.getMap).toHaveBeenCalledWith('nodes');
      expect(mockDoc.getMap).toHaveBeenCalledWith('edges');
      expect(mockDoc.getMap).toHaveBeenCalledWith('metadata');
    });

    it('should initialize with correct metadata structure', () => {
      // Arrange
      const mockMetadataMap = createMockMap();
      mockDoc.getMap.mockReturnValue(mockMetadataMap);
      
      // Act
      initializeDocument(mockDoc as unknown as yjs.Doc);
      
      // Assert
      expect(mockMetadataMap.set).toHaveBeenCalledWith('title', 'Untitled Canvas');
      expect(mockMetadataMap.set).toHaveBeenCalledWith('version', '1.0');
      expect(mockMetadataMap.set).toHaveBeenCalledWith('createdAt', expect.any(String));
    });
  });

  // Reference: REQ-301.2 Shared Types Operations
  describe('Shared Types Operations', () => {
    let mockNodesMap: MockMap;
    let mockEdgesMap: MockMap;
    let mockMetadataMap: MockMap;
    
    beforeEach(() => {
      mockNodesMap = createMockMap();
      mockEdgesMap = createMockMap();
      mockMetadataMap = createMockMap();
      
      mockDoc.getMap.mockImplementation((name) => {
        if (name === 'nodes') return mockNodesMap;
        if (name === 'edges') return mockEdgesMap;
        if (name === 'metadata') return mockMetadataMap;
        return createMockMap();
      });
    });

    it('should provide access to shared types', () => {
      // Act
      const { nodes, edges, metadata } = getSharedTypes(mockDoc as unknown as yjs.Doc);

      // Assert
      expect(mockDoc.getMap).toHaveBeenCalledWith('nodes');
      expect(mockDoc.getMap).toHaveBeenCalledWith('edges');
      expect(mockDoc.getMap).toHaveBeenCalledWith('metadata');
      expect(nodes).toBe(mockNodesMap);
      expect(edges).toBe(mockEdgesMap);
      expect(metadata).toBe(mockMetadataMap);
    });

    it('should update a node in the nodes collection', () => {
      // Arrange
      const nodeId = 'node1';
      const reactFlowNode: Node = {
        id: nodeId,
        position: { x: 100, y: 200 },
        data: { label: 'Test Node' }
      };
      
      // Create nested mock maps
      const mockNodeMap = createMockMap();
      const mockPositionMap = createMockMap();
      const mockDataMap = createMockMap();
      
      // Set up mock returns for nested structure
      mockNodesMap.has.mockReturnValue(false);
      mockNodesMap.get.mockReturnValue(mockNodeMap);
      
      mockNodeMap.has.mockImplementation((key) => {
        if (key === 'position') return false;
        if (key === 'data') return false;
        return false;
      });
      
      mockNodeMap.get.mockImplementation((key) => {
        if (key === 'position') return mockPositionMap;
        if (key === 'data') return mockDataMap;
        return null;
      });

      // Act
      updateNode(mockDoc as unknown as yjs.Doc, nodeId, reactFlowNode);

      // Assert
      expect(mockNodesMap.set).toHaveBeenCalledWith(nodeId, expect.anything());
      expect(mockNodeMap.set).toHaveBeenCalledWith('id', nodeId);
      expect(mockNodeMap.set).toHaveBeenCalledWith('position', expect.anything());
      expect(mockNodeMap.set).toHaveBeenCalledWith('data', expect.anything());
      expect(mockPositionMap.set).toHaveBeenCalledWith('x', 100);
      expect(mockPositionMap.set).toHaveBeenCalledWith('y', 200);
      expect(mockDataMap.set).toHaveBeenCalledWith('label', 'Test Node');
    });

    it('should update an edge in the edges collection', () => {
      // Arrange
      const edgeId = 'edge1';
      const reactFlowEdge: Edge = {
        id: edgeId,
        source: 'node1',
        target: 'node2',
        data: { label: 'Connection' }
      };
      
      // Create nested mock maps
      const mockEdgeMap = createMockMap();
      const mockDataMap = createMockMap();
      
      // Set up mock returns
      mockEdgesMap.has.mockReturnValue(false);
      mockEdgesMap.get.mockReturnValue(mockEdgeMap);
      
      mockEdgeMap.has.mockImplementation((key) => {
        if (key === 'data') return false;
        return false;
      });
      
      mockEdgeMap.get.mockImplementation((key) => {
        if (key === 'data') return mockDataMap;
        return null;
      });

      // Act
      updateEdge(mockDoc as unknown as yjs.Doc, edgeId, reactFlowEdge);

      // Assert
      expect(mockEdgesMap.set).toHaveBeenCalledWith(edgeId, expect.anything());
      expect(mockEdgeMap.set).toHaveBeenCalledWith('id', edgeId);
      expect(mockEdgeMap.set).toHaveBeenCalledWith('source', 'node1');
      expect(mockEdgeMap.set).toHaveBeenCalledWith('target', 'node2');
      expect(mockEdgeMap.set).toHaveBeenCalledWith('data', expect.anything());
      expect(mockDataMap.set).toHaveBeenCalledWith('label', 'Connection');
    });

    it('should update metadata in the metadata collection', () => {
      // Act
      updateMetadata(mockDoc as unknown as yjs.Doc, { title: 'Updated Canvas', customField: 'Value' });

      // Assert
      expect(mockMetadataMap.set).toHaveBeenCalledWith('title', 'Updated Canvas');
      expect(mockMetadataMap.set).toHaveBeenCalledWith('customField', 'Value');
    });
  });

  // Reference: REQ-301.3 Document Updates
  describe('Document Updates', () => {
    it('should apply updates between documents', () => {
      // Arrange
      const mockUpdate = new Uint8Array([1, 2, 3]);
      
      // Act
      applyYjsUpdate(mockDoc as unknown as yjs.Doc, mockUpdate);

      // Assert
      expect(yjs.applyUpdate).toHaveBeenCalledWith(mockDoc, mockUpdate);
    });
  });

  // Reference: REQ-301.4 Node Creation
  describe('Node Creation', () => {
    it('should create a node with generated ID', () => {
      // Arrange
      const mockNodesMap = createMockMap();
      mockDoc.getMap.mockReturnValue(mockNodesMap);
      
      const nodeTemplate = {
        position: { x: 150, y: 250 },
        data: { label: 'New Node' }
      };
      
      // Act
      const nodeId = createNodeWithId(mockDoc as unknown as yjs.Doc, nodeTemplate);

      // Assert
      expect(mockDoc.transact).toHaveBeenCalled();
      expect(nodeId).toMatch(/^node-\d+-\d+$/); // Should generate ID with pattern
      
      // Should create the node in the transaction
      expect(mockNodesMap.set).toHaveBeenCalled();
    });
  });
}); 