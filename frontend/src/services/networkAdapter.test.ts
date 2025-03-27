/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  SocketIONetworkAdapter,
  YjsNetworkAdapter,
  createNetworkAdapter,
} from './networkAdapter';
import * as Y from 'yjs';
import { Socket } from 'socket.io-client';
import { WebsocketProvider } from 'y-websocket';

// Mock Socket.io
jest.mock('socket.io-client');

// Mock Y.js and WebsocketProvider
jest.mock('y-websocket', () => {
  const mockAwareness = {
    getLocalState: jest.fn().mockReturnValue({}),
    setLocalState: jest.fn(),
    on: jest.fn(),
    getStates: jest.fn().mockReturnValue(new Map()),
  };

  return {
    WebsocketProvider: jest.fn().mockImplementation(() => ({
      awareness: mockAwareness,
      on: jest.fn(),
      off: jest.fn(),
      wsconnected: true,
      disconnect: jest.fn(),
      destroy: jest.fn(),
    })),
  };
});

jest.mock('yjs', () => {
  return {
    Doc: jest.fn().mockImplementation(() => ({
      clientID: 1,
    })),
  };
});

describe('NetworkAdapter', () => {
  let mockSocket: any;
  let mockWebsocketProvider: any;
  let mockDoc: Y.Doc;
  let mockAwareness: any;
  const userId = 'user-123';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock Socket
    mockSocket = {
      connected: true,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };

    // Create mock awareness
    mockAwareness = {
      getLocalState: jest.fn().mockReturnValue({}),
      setLocalState: jest.fn(),
      on: jest.fn(),
      getStates: jest.fn().mockReturnValue(new Map()),
    };

    // Create mock WebsocketProvider with explicit wsconnected property
    mockWebsocketProvider = {
      awareness: mockAwareness,
      on: jest.fn(),
      off: jest.fn(),
      wsconnected: true,
      disconnect: jest.fn(),
      destroy: jest.fn(),
    };

    // Create mock Doc
    mockDoc = new Y.Doc();
  });

  /**
   * NOTE: These tests for SocketIONetworkAdapter are kept for historical reference.
   * The application now exclusively uses YjsNetworkAdapter, but these tests are maintained
   * to ensure that if the adapter is ever needed in the future, it will work correctly.
   */
  describe('SocketIONetworkAdapter (Legacy)', () => {
    let adapter: SocketIONetworkAdapter;

    beforeEach(() => {
      adapter = new SocketIONetworkAdapter(mockSocket as Socket);
    });

    it('should initialize properly', () => {
      expect(adapter).toBeDefined();
    });

    it('should check connection status', () => {
      expect(adapter.isConnected()).toBe(true);

      mockSocket.connected = false;
      expect(adapter.isConnected()).toBe(false);
    });

    it('should send messages', () => {
      adapter.sendMessage('test-event', { test: 'data' });
      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', {
        test: 'data',
      });
    });

    it('should subscribe to events', () => {
      const callback = jest.fn();
      adapter.subscribeToEvent('test-event', callback);
      expect(mockSocket.on).toHaveBeenCalledWith('test-event', callback);
    });

    it('should update user presence', () => {
      adapter.updateUserPresence('node-123', true);
      expect(mockSocket.emit).toHaveBeenCalledWith('update-typing', {
        nodeId: 'node-123',
        isTyping: true,
      });
    });
  });

  describe('YjsNetworkAdapter', () => {
    let adapter: YjsNetworkAdapter;

    beforeEach(() => {
      adapter = new YjsNetworkAdapter(
        mockWebsocketProvider as WebsocketProvider,
        mockDoc,
        userId
      );
    });

    it('should initialize properly', () => {
      expect(adapter).toBeDefined();
      expect(mockWebsocketProvider.awareness.on).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('should check connection status', () => {
      mockWebsocketProvider.wsconnected = true;
      expect(adapter.isConnected()).toBe(true);

      mockWebsocketProvider.wsconnected = false;
      expect(adapter.isConnected()).toBe(false);
    });

    it('should send messages via awareness', () => {
      mockWebsocketProvider.wsconnected = true;
      adapter.sendMessage('test-event', { test: 'data' });
      expect(mockWebsocketProvider.awareness.setLocalState).toHaveBeenCalled();
    });

    it('should update user presence', () => {
      mockWebsocketProvider.wsconnected = true;
      adapter.updateUserPresence('node-123', true);
      expect(mockWebsocketProvider.awareness.setLocalState).toHaveBeenCalled();
    });

    it('should set user cursor', () => {
      mockWebsocketProvider.wsconnected = true;
      adapter.setUserCursor({ x: 100, y: 200 });
      expect(mockWebsocketProvider.awareness.setLocalState).toHaveBeenCalled();
    });
  });

  describe('createNetworkAdapter', () => {
    it('should always create YjsNetworkAdapter when Yjs provider is available', () => {
      const adapter = createNetworkAdapter(
        mockSocket as Socket,
        mockWebsocketProvider as WebsocketProvider,
        mockDoc,
        userId
      );
      expect(adapter.constructor.name).toBe('YjsNetworkAdapter');
    });

    it('should fall back to SocketIONetworkAdapter when Yjs provider is missing', () => {
      const adapter = createNetworkAdapter(
        mockSocket as Socket,
        null,
        mockDoc,
        userId
      );
      expect(adapter.constructor.name).toBe('SocketIONetworkAdapter');
    });
  });
});
