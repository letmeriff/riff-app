import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Node } from 'reactflow';
import * as yjsService from './yjsService';
import * as yjsSyncProtocol from '../utils/yjsSyncProtocol';
import * as yjsOfflineSupport from '../utils/yjsOfflineSupport';

// Mock dependencies
jest.mock('yjs', () => {
  // Create reusable mock maps that will be returned by getMap
  const mockNodesMap = {
    has: jest.fn().mockReturnValue(false),
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockEdgesMap = {
    has: jest.fn().mockReturnValue(false),
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockMetadataMap = {
    has: jest.fn().mockReturnValue(false),
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockDocInstance = {
    clientID: 1,
    getMap: jest.fn((name) => {
      if (name === 'nodes') return mockNodesMap;
      if (name === 'edges') return mockEdgesMap;
      if (name === 'metadata') return mockMetadataMap;
      return mockNodesMap; // default fallback
    }),
    on: jest.fn(),
    off: jest.fn(),
    destroy: jest.fn(),
  };

  return {
    Doc: jest.fn().mockImplementation(() => mockDocInstance),
    Map: jest.fn().mockImplementation(() => ({
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    })),
    Array: jest.fn().mockImplementation(() => ({
      push: jest.fn(),
      delete: jest.fn(),
      forEach: jest.fn(),
    })),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn(),
  };
});

jest.mock('y-websocket', () => {
  const mockAwareness = {
    getLocalState: jest.fn().mockReturnValue({}),
    setLocalState: jest.fn(),
    destroy: jest.fn(),
    on: jest.fn(),
  };

  return {
    WebsocketProvider: jest.fn().mockImplementation(() => ({
      awareness: mockAwareness,
      on: jest.fn(),
      off: jest.fn(),
      disconnect: jest.fn(),
      destroy: jest.fn(),
      wsconnected: true,
    })),
  };
});

jest.mock('y-indexeddb', () => {
  return {
    IndexeddbPersistence: jest.fn().mockImplementation(() => ({
      destroy: jest.fn(),
    })),
  };
});

jest.mock('../utils/yjsSyncProtocol', () => ({
  setupCanvasSyncProtocol: jest.fn(),
}));

jest.mock('../utils/yjsOfflineSupport', () => ({
  initOfflineSupport: jest.fn(),
  createConflictResolver: jest.fn().mockReturnValue({
    updateSyncedState: jest.fn(),
    detectConflict: jest.fn(),
  }),
  registerOfflineChangeHandler: jest.fn().mockReturnValue(jest.fn()),
  cleanupOfflineSupport: jest.fn(),
  getSyncStatus: jest.fn().mockReturnValue({
    isConnected: true,
    isOnline: true,
    pendingChanges: false,
    lastSyncedAt: new Date().toISOString(),
    isReconnecting: false,
  }),
}));

// Reset the module between tests to avoid state leakage
beforeEach(() => {
  // Reset any internal state in the module
  yjsService.destroyYjsDocument();
  jest.clearAllMocks();
});

describe('yjsService', () => {
  describe('initYjsDocument', () => {
    it('should initialize a new Y.Doc if none exists', () => {
      yjsService.initYjsDocument('user1', 'canvas1', 'ws://localhost:3001');

      expect(Y.Doc).toHaveBeenCalled();
      expect(WebsocketProvider).toHaveBeenCalledWith(
        'ws://localhost:3001',
        'canvas1',
        expect.anything(),
        expect.objectContaining({
          params: { token: 'user1' },
        })
      );
      expect(IndexeddbPersistence).toHaveBeenCalledWith(
        'canvas1',
        expect.anything()
      );
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
      expect(() => yjsService.getYjsSharedTypes()).toThrow(
        'Yjs document not initialized'
      );
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
      expect(() => yjsService.updateAwareness({ userId: 'user1' })).toThrow(
        'Yjs awareness not initialized'
      );
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
        set: jest.fn(),
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
      const mockPersistence = (IndexeddbPersistence as jest.Mock).mock
        .instances[0];

      expect(mockProvider.disconnect).toHaveBeenCalled();
      expect(mockProvider.destroy).toHaveBeenCalled();
      expect(mockPersistence.destroy).toHaveBeenCalled();
      expect(mockDoc.destroy).toHaveBeenCalled();
      expect(yjsOfflineSupport.cleanupOfflineSupport).toHaveBeenCalled();
    });
  });
});
