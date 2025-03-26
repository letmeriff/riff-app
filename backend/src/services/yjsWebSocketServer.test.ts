import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as yjsService from './yjsService';
import { initYjsWebSocketServer } from './yjsWebSocketServer';
import { supabase } from '../config/supabase';

// Mock dependencies
jest.mock('ws', () => {
  const mockWebSocket = {
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // WebSocket.OPEN
  };
  
  const mockServer = {
    on: jest.fn(),
    handleUpgrade: jest.fn(),
  };
  
  return {
    WebSocket: jest.fn(() => mockWebSocket),
    WebSocketServer: jest.fn(() => mockServer),
  };
});

jest.mock('y-protocols/awareness', () => ({
  Awareness: jest.fn(() => ({
    on: jest.fn(),
    setLocalState: jest.fn(),
    getStates: jest.fn(() => new Map()),
    removeStates: jest.fn(),
  })),
  encodeAwarenessUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
  applyAwarenessUpdate: jest.fn(),
}));

jest.mock('y-protocols/sync', () => ({
  writeUpdate: jest.fn(),
  writeSyncStep1: jest.fn(),
  writeSyncStep2: jest.fn(),
  readSyncMessage: jest.fn(() => ({ type: 'sync-step-1' })),
}));

jest.mock('lib0/encoding', () => ({
  createEncoder: jest.fn(() => ({})),
  writeVarUint: jest.fn(),
  writeUint8Array: jest.fn(),
  toUint8Array: jest.fn(() => new Uint8Array([1, 2, 3])),
}));

jest.mock('./yjsService', () => ({
  getYjsDocument: jest.fn(),
  storeYjsDocument: jest.fn(),
  storeYjsUpdate: jest.fn(),
  getYjsUpdates: jest.fn(),
  createDocumentSnapshot: jest.fn(),
  recoverDocumentFromUpdates: jest.fn(),
  getDocumentStats: jest.fn(),
}));

jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

jest.mock('yjs', () => {
  const mockDoc = {
    on: jest.fn(),
    off: jest.fn(),
    transact: jest.fn((fn) => fn()),
    clientID: 1,
    destroy: jest.fn(),
  };
  
  return {
    Doc: jest.fn(() => mockDoc),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
  };
});

describe('yjsWebSocketServer', () => {
  let mockServer: any;
  let mockHttpServer: any;
  let mockWebSocket: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockServer = new WebSocketServer();
    mockWebSocket = new WebSocket();
    mockHttpServer = {
      on: jest.fn(),
    };
    
    // Mock successful auth
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user1' } },
      error: null,
    });
    
    // Mock successful document retrieval
    (yjsService.getYjsDocument as jest.Mock).mockResolvedValue(new Uint8Array([1, 2, 3]));
  });
  
  describe('initYjsWebSocketServer', () => {
    it('should create a WebSocketServer and set up connection handler', () => {
      initYjsWebSocketServer(mockHttpServer);
      
      expect(WebSocketServer).toHaveBeenCalled();
      expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });
  
  describe('handleConnection', () => {
    it('should reject connections without proper authentication', async () => {
      // Mock URL without token
      const req = {
        url: '/yjs?document=test-doc',
      };
      
      // Extract connection handler
      initYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler
      await connectionHandler(mockWebSocket, req);
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
    
    it('should reject connections with invalid tokens', async () => {
      // Mock URL with token
      const req = {
        url: '/yjs?document=test-doc&token=invalid-token',
      };
      
      // Mock auth failure
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: 'Invalid token',
      });
      
      // Extract connection handler
      initYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler
      await connectionHandler(mockWebSocket, req);
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
    
    it('should accept connections with valid tokens and setup event handlers', async () => {
      // Mock URL with token
      const req = {
        url: '/yjs?document=test-doc&token=valid-token',
      };
      
      // Extract connection handler
      initYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler
      await connectionHandler(mockWebSocket, req);
      
      expect(mockWebSocket.close).not.toHaveBeenCalled();
      expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });
  
  describe('document management', () => {
    it('should create a document snapshot when requested', async () => {
      (yjsService.createDocumentSnapshot as jest.Mock).mockResolvedValue(true);
      
      // Mock URL with token
      const req = {
        url: '/yjs?document=test-doc&token=valid-token',
      };
      
      // Extract connection handler
      initYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler
      await connectionHandler(mockWebSocket, req);
      
      // Extract message handler
      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      
      // Create a message that requests a snapshot
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 4); // Assuming 4 is the snapshot message type
      const message = encoding.toUint8Array(encoder);
      
      // Call message handler
      await messageHandler(message);
      
      // Check if snapshot was created
      expect(yjsService.createDocumentSnapshot).toHaveBeenCalled();
    });
  });
  
  describe('cleanup', () => {
    it('should clean up resources when a client disconnects', async () => {
      // Mock URL with token
      const req = {
        url: '/yjs?document=test-doc&token=valid-token',
      };
      
      // Extract connection handler
      initYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler
      await connectionHandler(mockWebSocket, req);
      
      // Extract close handler
      const closeHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'close')[1];
      
      // Call close handler
      await closeHandler();
      
      // Verify cleanup (depends on implementation details)
      // This part may need adjustment based on the actual implementation
      expect(awarenessProtocol.removeStates).toHaveBeenCalled();
    });
    
    it('should create a final snapshot when the last client disconnects', async () => {
      // This test would depend on internal state, and might be hard to test directly
      // You might need to expose some functions or state for testing, or mock internal functions
    });
  });
}); 