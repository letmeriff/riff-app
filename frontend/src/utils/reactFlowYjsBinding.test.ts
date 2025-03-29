/* eslint-disable @typescript-eslint/no-explicit-any */
// Disabling explicit any for test mocks since we're mocking Yjs functionality
import { 
  Node, 
  Edge, 
  NodeChange, 
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow';
import { 
  syncNodeChangesToYjs, 
  syncEdgeChangesToYjs,
  syncNodeDeletionToYjs,
  setupYjsSubscription
} from './reactFlowYjsBinding';
import * as yjsService from '../services/yjsService';

// Adding type declarations for mocks
type YDocMock = {
  getMap: jest.Mock;
};

type YMapMock = {
  observe: jest.Mock;
  unobserve: jest.Mock;
  forEach: jest.Mock;
  has: jest.Mock;
  delete: jest.Mock;
};

// Mock dependencies
jest.mock('reactflow', () => ({
  applyNodeChanges: jest.fn((changes, nodes) => nodes),
  applyEdgeChanges: jest.fn((changes, edges) => edges),
}));

jest.mock('../services/yjsService', () => ({
  updateNodePositionYjs: jest.fn(),
  syncNodeDeletionToYjs: jest.fn(),
  syncEdgeDeletionToYjs: jest.fn(),
  getYjsDocument: jest.fn(),
  mapEdgeToYjs: jest.fn(),
}));

describe('reactFlowYjsBinding', () => {
  let mockDoc: any;
  let mockNodesMap: any;
  let mockEdgesMap: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Y.Doc and Y.Map
    mockNodesMap = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      forEach: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
    } as YMapMock;
    
    mockEdgesMap = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      forEach: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
    } as YMapMock;
    
    mockDoc = {
      getMap: jest.fn((name) => {
        if (name === 'nodes') return mockNodesMap;
        if (name === 'edges') return mockEdgesMap;
        return new Map();
      }),
    } as YDocMock;
  });
  
  describe('syncNodeChangesToYjs', () => {
    it('should apply node changes locally without Yjs when doc is null', () => {
      const nodes: Node[] = [{ id: '1', position: { x: 100, y: 100 }, data: {} }];
      const changes: NodeChange[] = [{ type: 'position', id: '1', position: { x: 200, y: 200 } }];
      
      syncNodeChangesToYjs(changes, nodes, null);
      
      expect(applyNodeChanges).toHaveBeenCalledWith(changes, nodes);
      expect(yjsService.updateNodePositionYjs).not.toHaveBeenCalled();
    });
    
    it('should sync position changes to Yjs', () => {
      const nodes: Node[] = [{ id: '1', position: { x: 100, y: 100 }, data: {} }];
      const changes: NodeChange[] = [{ type: 'position', id: '1', position: { x: 200, y: 200 } }];
      
      syncNodeChangesToYjs(changes, nodes, mockDoc);
      
      expect(applyNodeChanges).toHaveBeenCalledWith(changes, nodes);
      expect(yjsService.updateNodePositionYjs).toHaveBeenCalledWith('1', { x: 200, y: 200 });
    });
  });
  
  describe('syncEdgeChangesToYjs', () => {
    it('should apply edge changes locally without Yjs when doc is null', () => {
      const edges: Edge[] = [{ id: '1', source: 'a', target: 'b' }];
      const changes: EdgeChange[] = [{ type: 'remove', id: '1' }];
      
      syncEdgeChangesToYjs(changes, edges, null);
      
      expect(applyEdgeChanges).toHaveBeenCalledWith(changes, edges);
      expect(yjsService.mapEdgeToYjs).not.toHaveBeenCalled();
    });
    
    it('should sync edge additions to Yjs', () => {
      const edges: Edge[] = [];
      const newEdge = { id: '1', source: 'a', target: 'b' };
      const changes: EdgeChange[] = [{ type: 'add', item: newEdge }];
      
      (applyEdgeChanges as jest.Mock).mockReturnValue([newEdge]);
      
      syncEdgeChangesToYjs(changes, edges, mockDoc);
      
      expect(applyEdgeChanges).toHaveBeenCalledWith(changes, edges);
      expect(yjsService.mapEdgeToYjs).toHaveBeenCalledWith(newEdge);
    });
  });
  
  describe('syncNodeDeletionToYjs', () => {
    it('should not delete node when doc is null', () => {
      syncNodeDeletionToYjs('1', null);
      
      expect((mockNodesMap as YMapMock).delete).not.toHaveBeenCalled();
    });
    
    it('should delete node when it exists in Yjs', () => {
      (mockNodesMap as YMapMock).has.mockReturnValue(true);
      
      syncNodeDeletionToYjs('1', mockDoc);
      
      expect((mockNodesMap as YMapMock).has).toHaveBeenCalledWith('1');
      expect((mockNodesMap as YMapMock).delete).toHaveBeenCalledWith('1');
    });
    
    it('should not delete node when it doesn\'t exist in Yjs', () => {
      (mockNodesMap as YMapMock).has.mockReturnValue(false);
      
      syncNodeDeletionToYjs('1', mockDoc);
      
      expect((mockNodesMap as YMapMock).has).toHaveBeenCalledWith('1');
      expect((mockNodesMap as YMapMock).delete).not.toHaveBeenCalled();
    });
  });
  
  describe('setupYjsSubscription', () => {
    it('should return empty function when doc is null', () => {
      const setNodes = jest.fn();
      const setEdges = jest.fn();
      
      const cleanup = setupYjsSubscription(null, setNodes, setEdges);
      
      expect(typeof cleanup).toBe('function');
      expect((mockNodesMap as YMapMock).observe).not.toHaveBeenCalled();
      expect((mockEdgesMap as YMapMock).observe).not.toHaveBeenCalled();
    });
    
    it('should set up observers for nodes and edges', () => {
      const setNodes = jest.fn();
      const setEdges = jest.fn();
      
      setupYjsSubscription(mockDoc, setNodes, setEdges);
      
      expect((mockNodesMap as YMapMock).observe).toHaveBeenCalled();
      expect((mockEdgesMap as YMapMock).observe).toHaveBeenCalled();
    });
    
    it('should provide a cleanup function that unobserves', () => {
      const setNodes = jest.fn();
      const setEdges = jest.fn();
      
      const cleanup = setupYjsSubscription(mockDoc, setNodes, setEdges);
      cleanup();
      
      expect((mockNodesMap as YMapMock).unobserve).toHaveBeenCalled();
      expect((mockEdgesMap as YMapMock).unobserve).toHaveBeenCalled();
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */ 