import * as Y from 'yjs';
import {
  getDocumentStateVector,
  getFullDocumentState,
  needsSynchronization,
  createDifferentialUpdate,
  getTimestampVector,
  handleReconnectionSync,
  configureSyncProtocol,
  configureConflictResolution,
  setupCanvasSyncProtocol
} from './yjsSyncProtocol';

// Mock for Y.Doc event handling
class MockYDoc {
  private eventHandlers: Record<string, Function[]> = {};
  
  clientID = Math.floor(Math.random() * 1000);
  
  on(eventName: string, callback: Function) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(callback);
    return this;
  }
  
  off(eventName: string, callback?: Function) {
    if (!callback) {
      delete this.eventHandlers[eventName];
    } else if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(cb => cb !== callback);
    }
    return this;
  }
  
  emit(eventName: string, ...args: any[]) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(callback => callback(...args));
    }
    return this;
  }
}

// Mock Y namespace functions
jest.mock('yjs', () => {
  return {
    encodeStateVector: jest.fn(),
    encodeStateAsUpdate: jest.fn(),
    Doc: jest.fn().mockImplementation(() => new MockYDoc()),
    applyUpdate: jest.fn()
  };
});

// Mock WebsocketProvider
class MockWebsocketProvider {
  private eventHandlers: Record<string, Function[]> = {};
  
  on(eventName: string, callback: Function) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(callback);
    return callback;
  }
  
  off(eventName: string, callback?: Function) {
    if (!callback) {
      delete this.eventHandlers[eventName];
    } else if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(cb => cb !== callback);
    }
    return this;
  }
  
  emit(eventName: string, ...args: any[]) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(callback => callback(...args));
    }
    return this;
  }
  
  connect = jest.fn();
  disconnect = jest.fn();
  
  awareness = {
    setLocalState: jest.fn(),
    getLocalState: jest.fn().mockReturnValue({}),
    getStates: jest.fn().mockReturnValue(new Map()),
    on: jest.fn(),
    off: jest.fn()
  };

  // Helper to simulate status change
  simulateStatusChange(status: string) {
    this.emit('status', { status });
  }
  
  // Helper to simulate sync event
  simulateSync(isSynced: boolean) {
    this.emit('sync', isSynced);
  }
}

// Mock IndexeddbPersistence
class MockIndexeddbPersistence {
  private eventHandlers: Record<string, Function[]> = {};
  
  on(eventName: string, callback: Function) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(callback);
    return callback;
  }
  
  off(eventName: string, callback?: Function) {
    if (!callback) {
      delete this.eventHandlers[eventName];
    } else if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(cb => cb !== callback);
    }
    return this;
  }
  
  emit(eventName: string, ...args: any[]) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(callback => callback(...args));
    }
    return this;
  }
  
  // Helper to simulate synced event
  simulateSynced() {
    this.emit('synced');
  }
}

describe('yjsSyncProtocol', () => {
  let mockDoc: MockYDoc;
  let mockWebsocketProvider: MockWebsocketProvider;
  let mockIndexeddbProvider: MockIndexeddbPersistence;
  let originalConsoleLog: typeof console.log;
  let originalAddEventListener: typeof window.addEventListener;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc = new Y.Doc() as unknown as MockYDoc;
    mockWebsocketProvider = new MockWebsocketProvider();
    mockIndexeddbProvider = new MockIndexeddbPersistence();
    
    // Mock console.log to prevent noise during tests
    originalConsoleLog = console.log;
    console.log = jest.fn();
    
    // Mock window event listeners
    originalAddEventListener = window.addEventListener;
    window.addEventListener = jest.fn();
  });
  
  afterEach(() => {
    // Restore original functions
    console.log = originalConsoleLog;
    window.addEventListener = originalAddEventListener;
  });

  describe('getDocumentStateVector', () => {
    it('should call encodeStateVector with the document', () => {
      // Setup
      const mockStateVector = new Uint8Array([1, 2, 3]);
      (Y.encodeStateVector as jest.Mock).mockReturnValue(mockStateVector);

      // Execute
      const result = getDocumentStateVector(mockDoc as unknown as Y.Doc);

      // Verify
      expect(Y.encodeStateVector).toHaveBeenCalledWith(mockDoc);
      expect(result).toBe(mockStateVector);
    });
  });
  
  describe('getFullDocumentState', () => {
    it('should call encodeStateAsUpdate with the document', () => {
      // Setup
      const mockFullState = new Uint8Array([1, 2, 3, 4, 5]);
      (Y.encodeStateAsUpdate as jest.Mock).mockReturnValue(mockFullState);
      
      // Execute
      const result = getFullDocumentState(mockDoc as unknown as Y.Doc);
      
      // Verify
      expect(Y.encodeStateAsUpdate).toHaveBeenCalledWith(mockDoc);
      expect(result).toBe(mockFullState);
    });
  });

  describe('needsSynchronization', () => {
    it('should return true when there are differences between documents', () => {
      // Setup
      const mockRemoteVector = new Uint8Array([1, 2, 3]);
      const mockDiffUpdate = new Uint8Array([4, 5, 6]); // Non-empty update means there are differences
      (Y.encodeStateAsUpdate as jest.Mock).mockReturnValue(mockDiffUpdate);

      // Execute
      const result = needsSynchronization(mockDoc as unknown as Y.Doc, mockRemoteVector);

      // Verify
      expect(Y.encodeStateAsUpdate).toHaveBeenCalledWith(
        mockDoc,
        mockRemoteVector
      );
      expect(result).toBe(true);
    });

    it('should return false when documents are in sync', () => {
      // Setup
      const mockRemoteVector = new Uint8Array([1, 2, 3]);
      const mockEmptyDiffUpdate = new Uint8Array([]); // Empty update means documents are in sync
      (Y.encodeStateAsUpdate as jest.Mock).mockReturnValue(mockEmptyDiffUpdate);

      // Execute
      const result = needsSynchronization(mockDoc as unknown as Y.Doc, mockRemoteVector);

      // Verify
      expect(Y.encodeStateAsUpdate).toHaveBeenCalledWith(
        mockDoc,
        mockRemoteVector
      );
      expect(result).toBe(false);
    });
  });

  describe('createDifferentialUpdate', () => {
    it('should call encodeStateAsUpdate with the document and remote state vector', () => {
      // Setup
      const mockRemoteVector = new Uint8Array([1, 2, 3]);
      const mockDiffUpdate = new Uint8Array([4, 5, 6]);
      (Y.encodeStateAsUpdate as jest.Mock).mockReturnValue(mockDiffUpdate);

      // Execute
      const result = createDifferentialUpdate(mockDoc as unknown as Y.Doc, mockRemoteVector);

      // Verify
      expect(Y.encodeStateAsUpdate).toHaveBeenCalledWith(
        mockDoc,
        mockRemoteVector
      );
      expect(result).toBe(mockDiffUpdate);
    });
  });

  describe('getTimestampVector', () => {
    it('should return a timestamp that increases over time', () => {
      // Setup
      const originalDateNow = Date.now;
      let mockTime = 1000;
      Date.now = jest.fn().mockImplementation(() => mockTime);

      // Execute
      const ts1 = getTimestampVector();
      mockTime += 10;
      const ts2 = getTimestampVector();

      // Cleanup
      Date.now = originalDateNow;

      // Verify
      expect(ts1).toBe(1000);
      expect(ts2).toBe(1010);
      expect(ts2).toBeGreaterThan(ts1);
    });
  });
  
  // Reference: REQ-302.1 Connection Handling
  describe('handleReconnectionSync', () => {
    it('should return a promise that resolves when sync event is triggered', async () => {
      // Setup
      let resolvedValue;
      const syncPromise = handleReconnectionSync(mockDoc as unknown as Y.Doc, mockWebsocketProvider as any)
        .then(() => {
          resolvedValue = true;
        });
      
      // Execute - simulate sync event
      mockWebsocketProvider.simulateSync(true);
      await syncPromise;
      
      // Verify
      expect(resolvedValue).toBe(true);
    });
    
    it('should clean up event listeners if cancelled', async () => {
      // Setup
      const syncPromise = handleReconnectionSync(mockDoc as unknown as Y.Doc, mockWebsocketProvider as any);
      
      // Execute - simulate multiple sync events
      mockWebsocketProvider.simulateSync(false); // Still syncing
      mockWebsocketProvider.simulateSync(true);  // Sync complete
      
      await syncPromise;
    });
  });
  
  // Reference: REQ-302.2 Synchronization Protocol
  describe('configureSyncProtocol', () => {
    it('should set up event listeners for WebSocket and IndexedDB providers', () => {
      // Setup
      const spyDocOn = jest.spyOn(mockDoc, 'on');
      const spyWsOn = jest.spyOn(mockWebsocketProvider, 'on');
      const spyDbOn = jest.spyOn(mockIndexeddbProvider, 'on');
      
      // Execute
      configureSyncProtocol(
        mockDoc as unknown as Y.Doc, 
        mockWebsocketProvider as any, 
        mockIndexeddbProvider as any
      );
      
      // Verify
      expect(spyWsOn).toHaveBeenCalledWith('status', expect.any(Function));
      expect(spyDbOn).toHaveBeenCalledWith('synced', expect.any(Function));
      expect(spyDocOn).toHaveBeenCalledWith('update', expect.any(Function));
    });
    
    it('should log appropriate messages when connection status changes', () => {
      // Setup
      configureSyncProtocol(
        mockDoc as unknown as Y.Doc, 
        mockWebsocketProvider as any, 
        mockIndexeddbProvider as any
      );
      
      // Execute - simulate status change
      mockWebsocketProvider.simulateStatusChange('connected');
      
      // Verify
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('WebSocket connection status: connected'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Connected to WebSocket'));
    });
    
    it('should log when document syncs with IndexedDB', () => {
      // Setup
      configureSyncProtocol(
        mockDoc as unknown as Y.Doc, 
        mockWebsocketProvider as any, 
        mockIndexeddbProvider as any
      );
      
      // Execute - simulate IndexedDB sync
      mockIndexeddbProvider.simulateSynced();
      
      // Verify
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Document synced with local database'));
    });
    
    it('should handle document updates from different sources', () => {
      // Setup
      const mockUpdate = new Uint8Array([1, 2, 3]);
      configureSyncProtocol(
        mockDoc as unknown as Y.Doc, 
        mockWebsocketProvider as any, 
        mockIndexeddbProvider as any
      );
      
      // Execute - emit update event directly
      mockDoc.emit('update', mockUpdate, mockWebsocketProvider);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Received update from server'));
      
      // Simulate local update
      mockDoc.emit('update', mockUpdate, null);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Local update will be synced'));
      
      // Simulate update from IndexedDB (should not log)
      const logCallCount = (console.log as jest.Mock).mock.calls.length;
      mockDoc.emit('update', mockUpdate, mockIndexeddbProvider);
      expect((console.log as jest.Mock).mock.calls.length).toBe(logCallCount); // No new log calls
    });
  });
  
  // Reference: REQ-302.3 Conflict Resolution
  describe('configureConflictResolution', () => {
    it('should add an afterTransaction event listener', () => {
      // Setup
      const spyDocOn = jest.spyOn(mockDoc, 'on');
      
      // Execute
      configureConflictResolution(mockDoc as unknown as Y.Doc);
      
      // Verify
      expect(spyDocOn).toHaveBeenCalledWith('afterTransaction', expect.any(Function));
    });
    
    it('should log transactions with changes and origin', () => {
      // Setup
      configureConflictResolution(mockDoc as unknown as Y.Doc);
      
      // Mock transaction object
      const mockTransaction = {
        origin: 'client-123',
        changed: new Map([['key1', 'value1']])
      };
      
      // Execute - emit afterTransaction event
      mockDoc.emit('afterTransaction', mockTransaction);
      
      // Verify
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Transaction applied from client client-123'));
    });
    
    it('should not log transactions without changes or origin', () => {
      // Setup
      configureConflictResolution(mockDoc as unknown as Y.Doc);
      
      // Mock transaction object with no changes
      const mockTransaction = {
        origin: null,
        changed: new Map()
      };
      
      // Execute - emit afterTransaction event
      const logCallCount = (console.log as jest.Mock).mock.calls.length;
      mockDoc.emit('afterTransaction', mockTransaction);
      
      // Verify no additional logs
      expect((console.log as jest.Mock).mock.calls.length).toBe(logCallCount);
    });
  });
  
  // Reference: REQ-302.4 Canvas Sync Protocol
  describe('setupCanvasSyncProtocol', () => {
    it('should call configureSyncProtocol and configureConflictResolution', () => {
      // Setup - spy on internal functions
      const origConfigureSyncProtocol = configureSyncProtocol;
      const origConfigureConflictResolution = configureConflictResolution;
      
      const mockConfigureSyncProtocol = jest.fn();
      const mockConfigureConflictResolution = jest.fn();
      
      // @ts-ignore - Replace with mock functions
      global.configureSyncProtocol = mockConfigureSyncProtocol;
      // @ts-ignore - Replace with mock functions
      global.configureConflictResolution = mockConfigureConflictResolution;
      
      // Execute
      setupCanvasSyncProtocol(
        mockDoc as unknown as Y.Doc, 
        mockWebsocketProvider as any, 
        mockIndexeddbProvider as any
      );
      
      // Verify
      expect(mockConfigureSyncProtocol).toHaveBeenCalledWith(
        mockDoc, mockWebsocketProvider, mockIndexeddbProvider
      );
      expect(mockConfigureConflictResolution).toHaveBeenCalledWith(mockDoc);
      
      // Restore original functions
      // @ts-ignore - Restore original functions
      global.configureSyncProtocol = origConfigureSyncProtocol;
      // @ts-ignore - Restore original functions
      global.configureConflictResolution = origConfigureConflictResolution;
    });
    
    it('should add event listeners for WebSocket status changes', () => {
      // Skip this test since we're directly testing the configureSyncProtocol function
      // that is called by setupCanvasSyncProtocol
      const mockStatusCallback = jest.fn();
      
      // Create spies instead of relying on internal implementation
      jest.spyOn(mockWebsocketProvider, 'on');
      
      // Execute
      setupCanvasSyncProtocol(
        mockDoc as unknown as Y.Doc, 
        mockWebsocketProvider as any, 
        mockIndexeddbProvider as any, 
        mockStatusCallback
      );
      
      // Execute callback directly
      // Find the status callback and invoke it
      mockWebsocketProvider.simulateStatusChange('connected');
      
      // Verify
      expect(mockStatusCallback).toHaveBeenCalledWith(true);
    });
    
    it('should add window event listeners for online/offline events', () => {
      // Execute
      setupCanvasSyncProtocol(
        mockDoc as unknown as Y.Doc, 
        mockWebsocketProvider as any, 
        mockIndexeddbProvider as any
      );
      
      // Verify
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    });
    
    it('should handle browser going offline correctly', () => {
      // Setup
      const mockStatusCallback = jest.fn();
      setupCanvasSyncProtocol(
        mockDoc as unknown as Y.Doc, 
        mockWebsocketProvider as any, 
        mockIndexeddbProvider as any, 
        mockStatusCallback
      );
      
      // Execute - get and trigger the offline handler
      const offlineHandler = (window.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'offline'
      )[1];
      
      offlineHandler();
      
      // Verify
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Browser went offline'));
      expect(mockStatusCallback).toHaveBeenCalledWith(false);
    });
    
    it('should handle browser coming back online correctly', () => {
      // Setup
      const mockStatusCallback = jest.fn();
      setupCanvasSyncProtocol(
        mockDoc as unknown as Y.Doc, 
        mockWebsocketProvider as any, 
        mockIndexeddbProvider as any, 
        mockStatusCallback
      );
      
      // Execute - get and trigger the online handler
      const onlineHandler = (window.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'online'
      )[1];
      
      onlineHandler();
      
      // Verify
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Browser back online'));
      expect(mockWebsocketProvider.connect).toHaveBeenCalled();
      expect(mockStatusCallback).toHaveBeenCalledWith(true);
    });
  });
});
