// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as Y from 'yjs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as yjsService from './yjsService';
import { startYjsWebSocketServer, stopYjsWebSocketServer } from './yjsWebSocketServer';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { supabase } from '../config/supabase';
import { verifyUserToken } from '../utils/auth';

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
    clients: new Set([mockWebSocket]),
  };
  
  return {
    WebSocket: jest.fn(() => mockWebSocket),
    WebSocketServer: jest.fn(() => mockServer),
    OPEN: 1,
  };
});

// Improved awareness protocol mock
jest.mock('y-protocols/awareness', () => {
  const mockAwareness = {
    on: jest.fn(),
    setLocalState: jest.fn(),
    getStates: jest.fn(() => new Map([[1, { user: { id: 'user1' } }]])),
    destroy: jest.fn(),
    setLocalStateField: jest.fn(),
    getLocalState: jest.fn(() => ({ user: { id: 'user1' } })),
  };

  return {
    Awareness: jest.fn(() => mockAwareness),
    encodeAwarenessUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
    applyAwarenessUpdate: jest.fn((_awareness, _update) => {
      // Simulate applying awareness update
      mockAwareness.getStates().set(2, { user: { id: 'user2' } });
    }, undefined),
    removeAwarenessStates: jest.fn((_awareness, clients) => {
      // Simulate removing awareness states
      const states = mockAwareness.getStates();
      for (const client of clients) {
        states.delete(client);
      }
    }, undefined),
  };
});

// Improved sync protocol mock
jest.mock('y-protocols/sync', () => {
  return {
    writeUpdate: jest.fn((encoder, _doc, update) => {
      // Simulate writing update message
      encoding.writeVarUint(encoder, 1); // Message type
      encoding.writeUint8Array(encoder, update);
    }),
    writeSyncStep1: jest.fn((encoder, _doc) => {
      // Simulate writing sync step 1 message
      encoding.writeVarUint(encoder, 0); // Message type
    }),
    writeSyncStep2: jest.fn((encoder, _doc, _stateVector) => {
      // Simulate writing sync step 2 message
      encoding.writeVarUint(encoder, 2); // Message type
      encoding.writeUint8Array(encoder, new Uint8Array([1, 2, 3]));
    }),
    readSyncMessage: jest.fn((decoder, encoder, doc, transactionOrigin) => {
      // Read message type
      const messageType = decoding.readVarUint(decoder);
      
      if (messageType === 0) {
        // Sync step 1
        syncProtocol.readSyncStep1(decoder, encoder, doc);
        return { type: 'sync-step-1', messageType };
      } else if (messageType === 1) {
        // Update message
        const update = decoding.readUint8Array(decoder);
        Y.applyUpdate(doc, update, transactionOrigin);
        return { type: 'update', messageType, update };
      } else if (messageType === 2) {
        // Sync step 2
        syncProtocol.readSyncStep2(decoder, encoder, doc);
        return { type: 'sync-step-2', messageType };
      }
      
      return { type: 'unknown', messageType };
    }),
    readSyncStep1: jest.fn((decoder, encoder, doc) => {
      // Simulate reading sync step 1 and writing sync step 2
      syncProtocol.writeSyncStep2(encoder, doc, new Uint8Array([1, 2, 3]));
    }),
    readSyncStep2: jest.fn((decoder, encoder, doc) => {
      // Simulate reading sync step 2 and applying an update
      const update = decoding.readUint8Array(decoder);
      Y.applyUpdate(doc, update, 'sync');
    }),
  };
});

// Improved encoding mock
jest.mock('lib0/encoding', () => {
  return {
    createEncoder: jest.fn(() => ({
      buffer: [],
      _bufs: [[]],
      cpos: 0,
    })),
    writeVarUint: jest.fn(),
    writeUint8Array: jest.fn(),
    toUint8Array: jest.fn(() => new Uint8Array([1, 2, 3])),
    length: jest.fn(() => 3),
    write: jest.fn(),
  };
});

// Improved decoding mock
jest.mock('lib0/decoding', () => {
  return {
    createDecoder: jest.fn(() => ({ 
      arr: new Uint8Array([0, 1, 2]),
      pos: 0,
    })),
    readVarUint: jest.fn(() => 0), // Default to sync message type
    readUint8Array: jest.fn(() => new Uint8Array([1, 2, 3])),
    readVarUint8Array: jest.fn(() => new Uint8Array([1, 2, 3])),
    hasContent: jest.fn(() => false),
  };
});

// Improved YjsService mock
jest.mock('./yjsService', () => {
  return {
    getYjsDocument: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    storeYjsDocument: jest.fn().mockResolvedValue(true),
    storeYjsUpdate: jest.fn().mockResolvedValue(true),
    getYjsUpdates: jest.fn().mockResolvedValue([new Uint8Array([1, 2, 3])]),
    createDocumentSnapshot: jest.fn().mockResolvedValue(true),
    recoverDocumentFromUpdates: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    getDocumentStats: jest.fn().mockResolvedValue({ updates: 5, lastModified: new Date() }),
    decompressContent: jest.fn(data => Promise.resolve(data)),
    runDatabaseMaintenanceJobs: jest.fn().mockResolvedValue(true),
  };
});

// Mock authentication
jest.mock('../utils/auth', () => ({
  verifyUserToken: jest.fn().mockResolvedValue({ userId: 'user1', valid: true }),
}));

// Mock Supabase
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
            error: { message: 'Invalid token' }
          });
        }
      })
    },
  }
}));

// Define interface for mockDoc to fix type issues
interface MockYDoc {
  on: jest.Mock;
  off: jest.Mock;
  transact: jest.Mock;
  clientID: number;
  destroy: jest.Mock;
  getMap: jest.Mock;
  getArray: jest.Mock;
  getText: jest.Mock;
  callbacks?: Record<string, (update: Uint8Array, origin: string) => void>;
  simulateUpdateEvent?: (update: Uint8Array, origin: string) => void;
}

// Mock Yjs document with improved implementation
jest.mock('yjs', () => {
  const mockDoc: MockYDoc = {
    on: jest.fn((eventName, callback) => {
      // Store callback reference for testing
      if (!mockDoc.callbacks) {
        mockDoc.callbacks = {};
      }
      mockDoc.callbacks[eventName] = callback;
    }),
    off: jest.fn(),
    transact: jest.fn((fn) => fn()),
    clientID: 1,
    destroy: jest.fn(),
    getMap: jest.fn(() => ({
      set: jest.fn(),
      get: jest.fn(),
      observe: jest.fn(),
      toJSON: jest.fn().mockReturnValue({ key: 'value' }),
    })),
    getArray: jest.fn(() => ({
      toArray: jest.fn().mockReturnValue([]),
      insert: jest.fn(),
      observe: jest.fn(),
      toJSON: jest.fn().mockReturnValue([]),
    })),
    getText: jest.fn(() => ({
      toString: jest.fn().mockReturnValue(''),
      insert: jest.fn(),
      delete: jest.fn(),
      observe: jest.fn(),
    })),
  };
  
  // Add the simulateUpdateEvent method
  mockDoc.simulateUpdateEvent = (update, origin) => {
    if (mockDoc.callbacks && mockDoc.callbacks.update) {
      mockDoc.callbacks.update(update, origin);
    }
  };
  
  return {
    Doc: jest.fn(() => mockDoc),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
  };
});

// Reference to messageType constants
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MESSAGE_AUTH = 2;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MESSAGE_QUERY_AWARENESS = 3;
const MESSAGE_POSITION_UPDATE = 4;

// Mock HTTP server
class MockHttpServer {
  listeners: Record<string, (...args: unknown[]) => void> = {};
  on(event: string, callback: (...args: unknown[]) => void): this {
    this.listeners[event] = callback;
    return this;
  }
  close(callback?: () => void): void {
    if (callback) callback();
  }
  emit(event: string, ...args: unknown[]): boolean {
    const callback = this.listeners[event];
    if (callback) callback(...args);
    return true;
  }
}

describe('Yjs WebSocket Server', () => {
  let httpServer;
  let wss;
  let mockSocket;
  let mockRequest;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock HTTP server
    httpServer = new MockHttpServer();
    
    // Mock WebSocket methods
    WebSocket.prototype.send = jest.fn();
    WebSocket.prototype.on = jest.fn((event, callback) => {
      if (event === 'message') {
        mockSocket._messageCallback = callback;
      } else if (event === 'close') {
        mockSocket._closeCallback = callback;
      } else if (event === 'error') {
        mockSocket._errorCallback = callback;
      }
    });
    WebSocket.prototype.close = jest.fn();
    
    // Mock Yjs document methods
    Y.Doc.prototype.on = jest.fn();
    Y.Doc.prototype.off = jest.fn();
    Y.encodeStateAsUpdate = jest.fn().mockReturnValue(new Uint8Array([0, 1, 2, 3]));
    Y.applyUpdate = jest.fn();
    
    // Mock verification to return a valid user
    (verifyUserToken as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com'
    });
    
    // Mock getYjsDocument to return null (new document)
    (yjsService.getYjsDocument as jest.Mock).mockResolvedValue(null);
    
    // Setup mock data
    mockSocket = new WebSocket(null);
    mockSocket.readyState = WebSocket.OPEN;
    mockRequest = {
      url: '/ws/canvas-123?auth=mock-token',
      headers: {
        origin: 'http://localhost:3000',
        'user-agent': 'jest-test'
      }
    };
    
    // Start WebSocket server
    wss = startYjsWebSocketServer(httpServer as unknown as http.Server);
  });
  
  afterEach(() => {
    // Stop WebSocket server
    stopYjsWebSocketServer();
  });
  
  describe('WebSocket connection handling', () => {
    test('should handle new connection with valid auth token', async () => {
      // Simulate connection event
      const connectionListener = wss.on.mock.calls.find(call => call[0] === 'connection')[1];
      await connectionListener(mockSocket, mockRequest);
      
      // Verify token was verified
      expect(verifyUserToken).toHaveBeenCalledWith('mock-token');
      
      // Verify socket event listeners were set up
      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
    
    test('should reject connection with invalid auth token', async () => {
      // Mock token verification to fail
      (verifyUserToken as jest.Mock).mockResolvedValue(null);
      
      // Simulate connection event
      const connectionListener = wss.on.mock.calls.find(call => call[0] === 'connection')[1];
      await connectionListener(mockSocket, mockRequest);
      
      // Verify socket was closed
      expect(mockSocket.close).toHaveBeenCalledWith(1008, expect.any(String));
    });
    
    test('should handle connection without document ID', async () => {
      // Create request without document ID
      const invalidRequest = {
        ...mockRequest,
        url: '/ws?auth=mock-token'
      };
      
      // Simulate connection event
      const connectionListener = wss.on.mock.calls.find(call => call[0] === 'connection')[1];
      await connectionListener(mockSocket, invalidRequest);
      
      // Verify socket was closed
      expect(mockSocket.close).toHaveBeenCalledWith(1008, expect.any(String));
    });
    
    test('should handle connection errors gracefully', async () => {
      // Mock token verification to throw
      (verifyUserToken as jest.Mock).mockRejectedValue(new Error('Auth error'));
      
      // Simulate connection event
      const connectionListener = wss.on.mock.calls.find(call => call[0] === 'connection')[1];
      await connectionListener(mockSocket, mockRequest);
      
      // Verify socket was closed
      expect(mockSocket.close).toHaveBeenCalledWith(1011, expect.any(String));
    });
  });
  
  describe('Message processing', () => {
    beforeEach(async () => {
      // Establish connection first
      const connectionListener = wss.on.mock.calls.find(call => call[0] === 'connection')[1];
      await connectionListener(mockSocket, mockRequest);
    });
    
    test('should handle sync step 1 message (sync step 1)', async () => {
      // Create a sync step 1 message
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC); // Message type: sync
      syncProtocol.writeSyncStep1(encoder, new Uint8Array([1, 2, 3])); // Mock state vector
      const message = encoding.toUint8Array(encoder);
      
      // Process message
      await mockSocket._messageCallback(message);
      
      // Should send a sync step 2 message back
      expect(mockSocket.send).toHaveBeenCalled();
    });
    
    test('should handle awareness update message', async () => {
      // Create awareness update message
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS); // Message type: awareness
      encoding.writeUint8Array(encoder, new Uint8Array([1, 2, 3])); // Mock awareness update
      const message = encoding.toUint8Array(encoder);
      
      // Process message
      await mockSocket._messageCallback(message);
      
      // No direct response expected, but awareness should be updated
      // This test verifies the function doesn't throw
    });
    
    test('should handle position update message', async () => {
      // Create position update message
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_POSITION_UPDATE); // Message type: position update
      
      // Mock position data
      const positionData = {
        nodeId: 'node-123',
        position: { x: 100, y: 200 }
      };
      
      // Serialize position data
      const jsonString = JSON.stringify(positionData);
      const textEncoder = new TextEncoder();
      const positionBytes = textEncoder.encode(jsonString);
      
      encoding.writeUint8Array(encoder, positionBytes);
      const message = encoding.toUint8Array(encoder);
      
      // Process message
      await mockSocket._messageCallback(message);
      
      // Position update should be broadcast (implementation specific)
      // This test verifies the function doesn't throw
    });
    
    test('should handle invalid message gracefully', async () => {
      // Send invalid message (empty)
      await mockSocket._messageCallback(new Uint8Array([]));
      
      // Send message with invalid type
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 99); // Invalid message type
      const message = encoding.toUint8Array(encoder);
      await mockSocket._messageCallback(message);
      
      // Both should be handled without throwing errors
    });
  });
  
  describe('Document synchronization', () => {
    beforeEach(async () => {
      // Establish connection first
      const connectionListener = wss.on.mock.calls.find(call => call[0] === 'connection')[1];
      await connectionListener(mockSocket, mockRequest);
    });
    
    test('should store document updates', async () => {
      // Create a document update message
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC); // Message type: sync
      syncProtocol.writeSyncStep2(encoder, new Uint8Array([4, 5, 6])); // Mock document update
      const message = encoding.toUint8Array(encoder);
      
      // Process message
      await mockSocket._messageCallback(message);
      
      // Verify update was stored
      expect(yjsService.storeYjsUpdate).toHaveBeenCalledWith(
        'canvas-123', // Document ID extracted from URL
        expect.any(Uint8Array), // Update data
        expect.any(String), // Client ID
        expect.any(Number) // Version
      );
    });
    
    test('should load existing document from database', async () => {
      // Mock existing document data
      const mockDocData = new Uint8Array([10, 11, 12]);
      (yjsService.getYjsDocument as jest.Mock).mockResolvedValue(mockDocData);
      
      // Stop and restart server to test document loading
      stopYjsWebSocketServer();
      wss = startYjsWebSocketServer(httpServer as unknown as http.Server);
      
      // Establish new connection
      const connectionListener = wss.on.mock.calls.find(call => call[0] === 'connection')[1];
      await connectionListener(mockSocket, mockRequest);
      
      // Verify document was loaded
      expect(yjsService.getYjsDocument).toHaveBeenCalledWith('canvas-123');
      expect(Y.applyUpdate).toHaveBeenCalled();
    });
    
    test('should recover document from updates if no snapshot exists', async () => {
      // Mock recovery from updates
      const mockUpdatesData = new Uint8Array([20, 21, 22]);
      (yjsService.recoverDocumentFromUpdates as jest.Mock).mockResolvedValue(mockUpdatesData);
      
      // Stop and restart server to test document loading
      stopYjsWebSocketServer();
      wss = startYjsWebSocketServer(httpServer as unknown as http.Server);
      
      // Establish new connection
      const connectionListener = wss.on.mock.calls.find(call => call[0] === 'connection')[1];
      await connectionListener(mockSocket, mockRequest);
      
      // Verify recovery was attempted
      expect(yjsService.recoverDocumentFromUpdates).toHaveBeenCalledWith('canvas-123');
      expect(Y.applyUpdate).toHaveBeenCalled();
    });
  });
  
  describe('Client disconnection handling', () => {
    beforeEach(async () => {
      // Establish connection first
      const connectionListener = wss.on.mock.calls.find(call => call[0] === 'connection')[1];
      await connectionListener(mockSocket, mockRequest);
    });
    
    test('should clean up resources when client disconnects', async () => {
      // Simulate client disconnection
      await mockSocket._closeCallback();
      
      // Resource cleanup doesn't have direct observable effects
      // but we can verify the function runs without errors
    });
    
    test('should handle errors on the WebSocket connection', async () => {
      // Spy on console.error
      jest.spyOn(console, 'error').mockImplementation();
      
      // Simulate error
      const mockError = new Error('WebSocket error');
      await mockSocket._errorCallback(mockError);
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket error:'),
        mockError
      );
      
      // Restore console.error
      (console.error as jest.Mock).mockRestore();
    });
  });
  
  describe('Server shutdown', () => {
    test('should clean up resources when server stops', () => {
      // Stop the server
      stopYjsWebSocketServer();
      
      // Start it again to test the clean state
      wss = startYjsWebSocketServer(httpServer as unknown as http.Server);
      
      // Stop again for final cleanup
      stopYjsWebSocketServer();
    });
  });
}); 