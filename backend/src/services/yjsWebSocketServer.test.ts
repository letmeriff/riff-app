import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
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
    applyAwarenessUpdate: jest.fn((awareness, update, origin) => {
      // Simulate applying awareness update
      awareness.getStates().set(2, { user: { id: 'user2' } });
    }),
    removeAwarenessStates: jest.fn((awareness, clients, origin) => {
      // Simulate removing awareness states
      const states = awareness.getStates();
      for (const client of clients) {
        states.delete(client);
      }
    }),
  };
});

// Improved sync protocol mock
jest.mock('y-protocols/sync', () => {
  return {
    writeUpdate: jest.fn((encoder, doc, update) => {
      // Simulate writing update message
      encoding.writeVarUint(encoder, 1); // Message type
      encoding.writeUint8Array(encoder, update);
    }),
    writeSyncStep1: jest.fn((encoder, doc) => {
      // Simulate writing sync step 1 message
      encoding.writeVarUint(encoder, 0); // Message type
    }),
    writeSyncStep2: jest.fn((encoder, doc, stateVector) => {
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

// Mock Yjs document with improved implementation
jest.mock('yjs', () => {
  // Define the mock document interface with callbacks
  interface MockYDoc {
    on: jest.Mock;
    off: jest.Mock;
    transact: jest.Mock;
    clientID: number;
    destroy: jest.Mock;
    getMap: jest.Mock;
    getArray: jest.Mock;
    getText: jest.Mock;
    callbacks?: Record<string, Function>;
    simulateUpdateEvent?: (update: Uint8Array, origin: string) => void;
  }
  
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
    it('should process sync messages from clients', async () => {
      // Mock URL with token
      const req = {
        url: '/yjs?document=test-doc&token=valid-token',
        headers: { host: 'localhost:3000' }
      };
      
      // Extract connection handler
      startYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Call connection handler to set up the connection
      await connectionHandler(mockWebSocket, req);
      
      // Get message handler
      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      
      // Create a mock message (binary data)
      const message = { data: new Uint8Array([0, 1, 2, 3]) }; // Sync step 1 message
      
      // Call message handler
      await messageHandler(message);
      
      // The message handler should process the sync message and respond
      expect(decoding.createDecoder).toHaveBeenCalled();
      expect(syncProtocol.readSyncMessage).toHaveBeenCalled();
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });
  
  describe('document update handling', () => {
    it('should broadcast updates to connected clients', async () => {
      // Setup a connection
      const req = {
        url: '/yjs?document=test-doc&token=valid-token',
        headers: { host: 'localhost:3000' }
      };
      
      // Start server and get connection handler
      startYjsWebSocketServer(mockHttpServer);
      const connectionHandler = mockServer.on.mock.calls[0][1];
      
      // Connect a client
      await connectionHandler(mockWebSocket, req);
      
      // Get the Y.Doc instance created for this connection
      const YDoc = Y.Doc as jest.Mock;
      const mockDoc = YDoc.mock.results[0].value;
      
      // Simulate a document update
      const update = new Uint8Array([5, 6, 7]);
      mockDoc.simulateUpdateEvent(update, 'client');
      
      // Should have created an encoder and sent the update
      expect(encoding.createEncoder).toHaveBeenCalled();
      expect(syncProtocol.writeUpdate).toHaveBeenCalled();
      expect(mockWebSocket.send).toHaveBeenCalled();
      
      // Should store the update in the database
      expect(yjsService.storeYjsUpdate).toHaveBeenCalledWith(
        'test-doc',
        expect.any(Uint8Array),
        expect.any(String),
        expect.any(Number)
      );
    });
  });
}); 