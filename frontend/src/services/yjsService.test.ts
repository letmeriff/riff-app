import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Node } from 'reactflow';
import * as yjsService from './yjsService';
import * as yjsSyncProtocol from '../utils/yjsSyncProtocol';
import * as yjsOfflineSupport from '../utils/yjsOfflineSupport';

// Mock dependencies
jest.mock('yjs');
jest.mock('y-websocket');
jest.mock('y-indexeddb');
jest.mock('../utils/yjsSyncProtocol');
jest.mock('../utils/yjsOfflineSupport');

describe('yjsService', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up basic mocks
    (Y.Doc as jest.Mock).mockImplementation(() => ({
      clientID: 1,
      getMap: jest.fn().mockImplementation(() => {
        const map = new Map();
        map.has = jest.fn().mockReturnValue(false);
        map.set = jest.fn();
        map.get = jest.fn();
        return map;
      }),
      on: jest.fn(),
      off: jest.fn(),
      destroy: jest.fn(),
    }));
    
    (WebsocketProvider as jest.Mock).mockImplementation(() => ({
      awareness: {
        getLocalState: jest.fn().mockReturnValue({}),
        setLocalState: jest.fn(),
        destroy: jest.fn(),
      },
      on: jest.fn(),
      off: jest.fn(),
      disconnect: jest.fn(),
      destroy: jest.fn(),
    }));
    
    (IndexeddbPersistence as jest.Mock).mockImplementation(() => ({
      destroy: jest.fn(),
    }));
    
    (yjsSyncProtocol.setupCanvasSyncProtocol as jest.Mock).mockImplementation(() => {});
    (yjsOfflineSupport.initOfflineSupport as jest.Mock).mockImplementation(() => {});
    (yjsOfflineSupport.createConflictResolver as jest.Mock).mockImplementation(() => ({
      updateSyncedState: jest.fn(),
      detectConflict: jest.fn(),
    }));
    (yjsOfflineSupport.registerOfflineChangeHandler as jest.Mock).mockImplementation(() => jest.fn());
  });
  
  describe('initYjsDocument', () => {
    it('should initialize a new Y.Doc if none exists', () => {
      yjsService.initYjsDocument('user1', 'canvas1', 'ws://localhost:3001');
      
      expect(Y.Doc).toHaveBeenCalled();
      expect(WebsocketProvider).toHaveBeenCalledWith(
        'ws://localhost:3001', 
        'canvas1', 
        expect.anything(), 
        expect.objectContaining({
          params: { token: 'user1' }
        })
      );
      expect(IndexeddbPersistence).toHaveBeenCalledWith('canvas1', expect.anything());
      expect(yjsSyncProtocol.setupCanvasSyncProtocol).toHaveBeenCalled();
      expect(yjsOfflineSupport.initOfflineSupport).toHaveBeenCalled();
    });
    
    it('should return existing doc if already initialized', () => {
      const firstDoc = yjsService.initYjsDocument('user1', 'canvas1');
      const secondDoc = yjsService.initYjsDocument('user1', 'canvas1');
      
      expect(Y.Doc).toHaveBeenCalledTimes(1);
      expect(firstDoc).toBe(secondDoc);
    });
  });
  
  describe('getYjsSharedTypes', () => {
    it('should throw an error if document is not initialized', () => {
      expect(() => yjsService.getYjsSharedTypes()).toThrow('Yjs document not initialized');
    });
    
    it('should return shared data structures', () => {
      yjsService.initYjsDocument('user1', 'canvas1');
      const { nodes, edges, metadata } = yjsService.getYjsSharedTypes();
      
      expect(nodes).toBeDefined();
      expect(edges).toBeDefined();
      expect(metadata).toBeDefined();
    });
  });
  
  describe('updateAwareness', () => {
    it('should throw an error if awareness is not initialized', () => {
      expect(() => yjsService.updateAwareness({ userId: 'user1' })).toThrow('Yjs awareness not initialized');
    });
    
    it('should update the awareness state', () => {
      yjsService.initYjsDocument('user1', 'canvas1');
      yjsService.updateAwareness({ cursor: { x: 100, y: 200 } });
      
      const mockProvider = (WebsocketProvider as jest.Mock).mock.instances[0];
      expect(mockProvider.awareness.setLocalState).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { x: 100, y: 200 } })
      );
    });
  });
  
  describe('mapNodeToYjs', () => {
    it('should add a new node to the Yjs document', () => {
      const reactFlowNode: Node = {
        id: 'node1',
        position: { x: 100, y: 200 },
        data: { label: 'Node 1' },
        type: 'default',
      };
      
      const chatNode = {
        node_id: 1,
        title: 'Test Node',
        user_id: 'user1',
        owner_id: 'user1',
        created_at: '2023-01-01',
      };
      
      // Setup mock Y.Map for node testing
      const mockNodeMap = {
        set: jest.fn()
      };
      (Y.Map as jest.Mock).mockImplementation(() => mockNodeMap);
      
      yjsService.initYjsDocument('user1', 'canvas1');
      yjsService.mapNodeToYjs(reactFlowNode, chatNode);
      
      // Verify Y.Map was used to create the node structure
      expect(Y.Map).toHaveBeenCalled();
    });
  });
  
  describe('destroyYjsDocument', () => {
    it('should clean up resources', () => {
      yjsService.initYjsDocument('user1', 'canvas1');
      yjsService.destroyYjsDocument();
      
      const mockDoc = (Y.Doc as jest.Mock).mock.instances[0];
      const mockProvider = (WebsocketProvider as jest.Mock).mock.instances[0];
      const mockPersistence = (IndexeddbPersistence as jest.Mock).mock.instances[0];
      
      expect(mockProvider.disconnect).toHaveBeenCalled();
      expect(mockProvider.destroy).toHaveBeenCalled();
      expect(mockPersistence.destroy).toHaveBeenCalled();
      expect(mockDoc.destroy).toHaveBeenCalled();
      expect(yjsOfflineSupport.cleanupOfflineSupport).toHaveBeenCalled();
    });
  });
}); 