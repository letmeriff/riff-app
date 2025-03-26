import * as Y from 'yjs';
import { 
  Node, 
  Edge, 
  NodeChange, 
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow';
import * as yjsService from '../services/yjsService';
import {
  syncNodeChangesToYjs,
  syncEdgeChangesToYjs,
  syncNewNodeToYjs,
  syncNodeDeletionToYjs,
  syncEdgeDeletionToYjs,
  setupYjsSubscription
} from './reactFlowYjsBinding';

// Mock dependencies
jest.mock('reactflow', () => ({
  applyNodeChanges: jest.fn((changes, nodes) => nodes),
  applyEdgeChanges: jest.fn((changes, edges) => edges),
}));

jest.mock('../services/yjsService', () => ({
  updateNodePositionYjs: jest.fn(),
  mapNodeToYjs: jest.fn(),
  mapEdgeToYjs: jest.fn(),
}));

describe('reactFlowYjsBinding', () => {
  let mockYDoc: any;
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
    };
    
    mockEdgesMap = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      forEach: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
    };
    
    mockYDoc = {
      getMap: jest.fn((name) => {
        if (name === 'nodes') return mockNodesMap;
        if (name === 'edges') return mockEdgesMap;
        return new Map();
      }),
    };
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
      
      syncNodeChangesToYjs(changes, nodes, mockYDoc);
      
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
      
      syncEdgeChangesToYjs(changes, edges, mockYDoc);
      
      expect(applyEdgeChanges).toHaveBeenCalledWith(changes, edges);
      expect(yjsService.mapEdgeToYjs).toHaveBeenCalledWith(newEdge);
    });
  });
  
  describe('syncNewNodeToYjs', () => {
    it('should not call mapNodeToYjs when doc is null', () => {
      const node: Node = { id: '1', position: { x: 100, y: 100 }, data: {} };
      const chatNode = { node_id: 1, title: 'Node 1', user_id: 'user1', owner_id: 'owner1', created_at: '2023-01-01' };
      
      syncNewNodeToYjs(node, chatNode, null);
      
      expect(yjsService.mapNodeToYjs).not.toHaveBeenCalled();
    });
    
    it('should call mapNodeToYjs with node and chatNode', () => {
      const node: Node = { id: '1', position: { x: 100, y: 100 }, data: {} };
      const chatNode = { node_id: 1, title: 'Node 1', user_id: 'user1', owner_id: 'owner1', created_at: '2023-01-01' };
      
      syncNewNodeToYjs(node, chatNode, mockYDoc);
      
      expect(yjsService.mapNodeToYjs).toHaveBeenCalledWith(node, chatNode);
    });
  });
  
  describe('syncNodeDeletionToYjs', () => {
    it('should not delete node when doc is null', () => {
      syncNodeDeletionToYjs('1', null);
      
      expect(mockNodesMap.delete).not.toHaveBeenCalled();
    });
    
    it('should delete node when it exists in Yjs', () => {
      mockNodesMap.has.mockReturnValue(true);
      
      syncNodeDeletionToYjs('1', mockYDoc);
      
      expect(mockNodesMap.has).toHaveBeenCalledWith('1');
      expect(mockNodesMap.delete).toHaveBeenCalledWith('1');
    });
    
    it('should not delete node when it doesn\'t exist in Yjs', () => {
      mockNodesMap.has.mockReturnValue(false);
      
      syncNodeDeletionToYjs('1', mockYDoc);
      
      expect(mockNodesMap.has).toHaveBeenCalledWith('1');
      expect(mockNodesMap.delete).not.toHaveBeenCalled();
    });
  });
  
  describe('setupYjsSubscription', () => {
    it('should return empty function when doc is null', () => {
      const setNodes = jest.fn();
      const setEdges = jest.fn();
      
      const cleanup = setupYjsSubscription(null, setNodes, setEdges);
      
      expect(typeof cleanup).toBe('function');
      expect(mockNodesMap.observe).not.toHaveBeenCalled();
      expect(mockEdgesMap.observe).not.toHaveBeenCalled();
    });
    
    it('should set up observers for nodes and edges', () => {
      const setNodes = jest.fn();
      const setEdges = jest.fn();
      
      setupYjsSubscription(mockYDoc, setNodes, setEdges);
      
      expect(mockNodesMap.observe).toHaveBeenCalled();
      expect(mockEdgesMap.observe).toHaveBeenCalled();
    });
    
    it('should provide a cleanup function that unobserves', () => {
      const setNodes = jest.fn();
      const setEdges = jest.fn();
      
      const cleanup = setupYjsSubscription(mockYDoc, setNodes, setEdges);
      cleanup();
      
      expect(mockNodesMap.unobserve).toHaveBeenCalled();
      expect(mockEdgesMap.unobserve).toHaveBeenCalled();
    });
  });
}); 