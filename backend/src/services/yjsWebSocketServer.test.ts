import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as yjsService from './yjsService';
import { startYjsWebSocketServer, stopYjsWebSocketServer } from './yjsWebSocketServer';
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
    close: jest.fn((callback) => callback && callback()),
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
    destroy: jest.fn(),
  })),
  encodeAwarenessUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
  applyAwarenessUpdate: jest.fn(),
  removeAwarenessStates: jest.fn(),
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
  length: jest.fn(() => 3),
}));

jest.mock('lib0/decoding', () => ({
  createDecoder: jest.fn(),
  readVarUint: jest.fn(() => 0), // Default to sync message type
  readUint8Array: jest.fn(() => new Uint8Array([1, 2, 3])),
}));

jest.mock('./yjsService', () => ({
  getYjsDocument: jest.fn(),
  storeYjsDocument: jest.fn(),
  storeYjsUpdate: jest.fn(),
  getYjsUpdates: jest.fn(),
  createDocumentSnapshot: jest.fn(),
  recoverDocumentFromUpdates: jest.fn(),
  getDocumentStats: jest.fn(),
  decompressContent: jest.fn(data => Promise.resolve(data)),
  runDatabaseMaintenanceJobs: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  verifyUserToken: jest.fn().mockResolvedValue({ userId: 'user1', valid: true }),
}));

jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockImplementation(token => {
        if (token === 'valid-token') {
          return Promise.resolve({
            data: { user: { id: 'user1' } },
            error: null
          });
        } else {
          return Promise.resolve({
            data: { user: null },
            error: 'Invalid token'
          });
        }
      })
    },
  }
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
    jest.useFakeTimers();
    
    mockServer = new WebSocketServer();
    mockWebSocket = new WebSocket('ws://localhost:1234');
    mockHttpServer = {
      on: jest.fn(),
    };
    
    // Mock successful document retrieval
    (yjsService.getYjsDocument as jest.Mock).mockResolvedValue(new Uint8Array([1, 2, 3]));
    (yjsService.createDocumentSnapshot as jest.Mock).mockResolvedValue(true);
  });
  
  afterEach(() => {
    stopYjsWebSocketServer();
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  
  describe('startYjsWebSocketServer', () => {
    it('should create a WebSocketServer and set up connection handler', () => {
      startYjsWebSocketServer(mockHttpServer);
      
      expect(WebSocketServer).toHaveBeenCalled();
      expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
    
    it('should set up maintenance interval', () => {
      jest.spyOn(global, 'setInterval');
      
      startYjsWebSocketServer(mockHttpServer);
      
      expect(setInterval).toHaveBeenCalled();
    });
  });
  
  describe('handleConnection', () => {
    it('should reject connections without proper authentication', async () => {
      // Mock URL without token
      const req = {
        url: '/yjs?document=test-doc',
        headers: {
          host: 'localhost:3000'
        }
      };
      
      // Extract connection handler
      startYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler
      await connectionHandler(mockWebSocket, req);
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
    
    it('should reject connections without document ID', async () => {
      // Mock URL with token but no document
      const req = {
        url: '/yjs?token=valid-token',
        headers: {
          host: 'localhost:3000'
        }
      };
      
      // Extract connection handler
      startYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler
      await connectionHandler(mockWebSocket, req);
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
    
    it('should accept connections with valid tokens and setup event handlers', async () => {
      // Mock URL with token
      const req = {
        url: '/yjs?document=test-doc&token=valid-token',
        headers: {
          host: 'localhost:3000'
        }
      };
      
      // Extract connection handler
      startYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler
      await connectionHandler(mockWebSocket, req);
      
      expect(mockWebSocket.close).not.toHaveBeenCalled();
      expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });
  
  describe('message handling', () => {
    it('should process sync messages', async () => {
      // Mock URL with token
      const req = {
        url: '/yjs?document=test-doc&token=valid-token',
        headers: {
          host: 'localhost:3000'
        }
      };
      
      // Setup sync message mocks
      const decodingModule = require('lib0/decoding');
      (decodingModule.readVarUint as jest.Mock).mockReturnValue(0); // 0 = sync message
      
      // Extract connection handler
      startYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler
      await connectionHandler(mockWebSocket, req);
      
      // Extract message handler
      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      
      // Call message handler
      await messageHandler(new Uint8Array([0, 1, 2]));
      
      // Check if sync protocol was used
      expect(syncProtocol.readSyncMessage).toHaveBeenCalled();
    });
    
    it('should process awareness messages', async () => {
      // Mock URL with token
      const req = {
        url: '/yjs?document=test-doc&token=valid-token',
        headers: {
          host: 'localhost:3000'
        }
      };
      
      // Setup awareness message mocks
      const decodingModule = require('lib0/decoding');
      (decodingModule.readVarUint as jest.Mock).mockReturnValue(1); // 1 = awareness message
      
      // Extract connection handler
      startYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler
      await connectionHandler(mockWebSocket, req);
      
      // Extract message handler
      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      
      // Call message handler
      await messageHandler(new Uint8Array([1, 1, 2]));
      
      // Check if awareness protocol was used
      expect(awarenessProtocol.applyAwarenessUpdate).toHaveBeenCalled();
    });
  });
  
  describe('stopYjsWebSocketServer', () => {
    it('should close the server and clean up resources', async () => {
      // Start server
      startYjsWebSocketServer(mockHttpServer);
      
      // Mock URL with token and connect a client
      const req = {
        url: '/yjs?document=test-doc&token=valid-token',
        headers: {
          host: 'localhost:3000'
        }
      };
      const connectionHandler = mockServer.on.mock.calls[0][1];
      await connectionHandler(mockWebSocket, req);
      
      // Stop the server
      stopYjsWebSocketServer();
      
      // Should close the server
      expect(mockServer.close).toHaveBeenCalled();
      
      // Should create final snapshots
      expect(yjsService.createDocumentSnapshot).toHaveBeenCalled();
    });
  });
}); 