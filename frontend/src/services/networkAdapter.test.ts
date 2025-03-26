import { Socket } from 'socket.io-client';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { NetworkAdapter, SocketIONetworkAdapter, YjsNetworkAdapter, createNetworkAdapter } from './networkAdapter';

// Mock Socket.io
jest.mock('socket.io-client');

// Mock Y.js and WebsocketProvider
jest.mock('y-websocket', () => ({
  WebsocketProvider: jest.fn().mockImplementation(() => ({
    awareness: {
      getLocalState: jest.fn().mockReturnValue({}),
      setLocalState: jest.fn(),
      on: jest.fn(),
      getStates: jest.fn().mockReturnValue(new Map()),
    },
    on: jest.fn(),
    off: jest.fn(),
    wsconnected: true,
    disconnect: jest.fn(),
  })),
}));

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
  let mockDoc: any;
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
    
    // Create mock WebsocketProvider
    mockWebsocketProvider = new (WebsocketProvider as any)('ws://localhost', 'test-doc', new Y.Doc());
    
    // Create mock Doc
    mockDoc = new Y.Doc();
  });
  
  describe('SocketIONetworkAdapter', () => {
    let adapter: SocketIONetworkAdapter;
    
    beforeEach(() => {
      adapter = new SocketIONetworkAdapter(mockSocket);
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
      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { test: 'data' });
    });
    
    it('should subscribe to events', () => {
      const callback = jest.fn();
      adapter.subscribeToEvent('test-event', callback);
      expect(mockSocket.on).toHaveBeenCalledWith('test-event', callback);
    });
    
    it('should update user presence', () => {
      adapter.updateUserPresence('node-123', true);
      expect(mockSocket.emit).toHaveBeenCalledWith('update-typing', { nodeId: 'node-123', isTyping: true });
    });
  });
  
  describe('YjsNetworkAdapter', () => {
    let adapter: YjsNetworkAdapter;
    
    beforeEach(() => {
      adapter = new YjsNetworkAdapter(mockWebsocketProvider, mockDoc, userId);
    });
    
    it('should initialize properly', () => {
      expect(adapter).toBeDefined();
      expect(mockWebsocketProvider.awareness.on).toHaveBeenCalledWith('change', expect.any(Function));
    });
    
    it('should check connection status', () => {
      expect(adapter.isConnected()).toBe(true);
      
      mockWebsocketProvider.wsconnected = false;
      expect(adapter.isConnected()).toBe(false);
    });
    
    it('should send messages via awareness', () => {
      adapter.sendMessage('test-event', { test: 'data' });
      expect(mockWebsocketProvider.awareness.setLocalState).toHaveBeenCalled();
    });
    
    it('should update user presence', () => {
      adapter.updateUserPresence('node-123', true);
      expect(mockWebsocketProvider.awareness.setLocalState).toHaveBeenCalled();
    });
    
    it('should set user cursor', () => {
      adapter.setUserCursor({ x: 100, y: 200 });
      expect(mockWebsocketProvider.awareness.setLocalState).toHaveBeenCalled();
    });
  });
  
  describe('createNetworkAdapter', () => {
    const originalEnv = process.env;
    
    beforeEach(() => {
      process.env = { ...originalEnv };
    });
    
    afterEach(() => {
      process.env = originalEnv;
    });
    
    it('should create SocketIONetworkAdapter when Yjs network is disabled', () => {
      process.env.REACT_APP_USE_YJS_NETWORK = 'false';
      const adapter = createNetworkAdapter(mockSocket, mockWebsocketProvider, mockDoc, userId);
      expect(adapter.constructor.name).toBe('SocketIONetworkAdapter');
    });
    
    it('should create YjsNetworkAdapter when Yjs network is enabled', () => {
      process.env.REACT_APP_USE_YJS_NETWORK = 'true';
      const adapter = createNetworkAdapter(mockSocket, mockWebsocketProvider, mockDoc, userId);
      expect(adapter.constructor.name).toBe('YjsNetworkAdapter');
    });
    
    it('should fall back to SocketIONetworkAdapter when Yjs provider is missing', () => {
      process.env.REACT_APP_USE_YJS_NETWORK = 'true';
      const adapter = createNetworkAdapter(mockSocket, null, mockDoc, userId);
      expect(adapter.constructor.name).toBe('SocketIONetworkAdapter');
    });
  });
}); 