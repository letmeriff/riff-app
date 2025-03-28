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

// Type definitions for event handlers
type EventHandler = (...args: unknown[]) => void;
type EventHandlerMap = Record<string, EventHandler[]>;

// Type for WebSocket provider to avoid 'any'
interface WebsocketProviderLike {
  on: (event: string, callback: EventHandler) => unknown;
  off: (event: string, callback?: EventHandler) => unknown;
  connect: () => void;
  awareness: {
    setLocalState: (state: unknown) => void;
    getLocalState: () => unknown;
    getStates: () => Map<unknown, unknown>;
    on: (event: string, callback: EventHandler) => void;
    off: (event: string, callback: EventHandler) => void;
  };
}

// Type for IndexedDB provider to avoid 'any'
interface IndexeddbPersistenceLike {
  on: (event: string, callback: EventHandler) => unknown;
  off: (event: string, callback?: EventHandler) => unknown;
}

// Mock for Y.Doc event handling
class MockYDoc {
  private eventHandlers: EventHandlerMap = {};
  
  clientID = Math.floor(Math.random() * 1000);
  
  on(eventName: string, callback: EventHandler): this {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(callback);
    return this;
  }
  
  off(eventName: string, callback?: EventHandler): this {
    if (!callback) {
      delete this.eventHandlers[eventName];
    } else if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(cb => cb !== callback);
    }
    return this;
  }
  
  emit(eventName: string, ...args: unknown[]): this {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(callback => callback(...args));
    }
    return this;
  }

  // Mock methods that might be called by the implementation
  getMap(_name: string): { observe: jest.Mock } {
    return { observe: jest.fn() };
  }

  getArray(_name: string): { observe: jest.Mock } {
    return { observe: jest.fn() };
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
class MockWebsocketProvider implements WebsocketProviderLike {
  private eventHandlers: EventHandlerMap = {};
  
  on(eventName: string, callback: EventHandler): EventHandler {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(callback);
    return callback;
  }
  
  off(eventName: string, callback?: EventHandler): this {
    if (!callback) {
      delete this.eventHandlers[eventName];
    } else if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(cb => cb !== callback);
    }
    return this;
  }
  
  emit(eventName: string, ...args: unknown[]): this {
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
  simulateStatusChange(status: string): void {
    this.emit('status', { status });
  }
  
  // Helper to simulate sync event
  simulateSync(isSynced: boolean): void {
    this.emit('sync', isSynced);
  }
}

// Mock IndexeddbPersistence
class MockIndexeddbPersistence implements IndexeddbPersistenceLike {
  private eventHandlers: EventHandlerMap = {};
  
  on(eventName: string, callback: EventHandler): EventHandler {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(callback);
    return callback;
  }
  
  off(eventName: string, callback?: EventHandler): this {
    if (!callback) {
      delete this.eventHandlers[eventName];
    } else if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(cb => cb !== callback);
    }
    return this;
  }
  
  emit(eventName: string, ...args: unknown[]): this {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(callback => callback(...args));
    }
    return this;
  }
  
  // Helper to simulate synced event
  simulateSynced(): void {
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
    it('should create a timestamp that can be used for ordering', () => {
      // Setup
      jest.spyOn(Date, 'now').mockReturnValue(1000);
      
      // Execute
      const result = getTimestampVector();
      
      // Verify
      expect(result).toBe(1000);
    });
  });

  describe('handleReconnectionSync', () => {
    it('should handle reconnection sync correctly', async () => {
      // Setup
      const syncPromise = handleReconnectionSync(
        mockDoc as unknown as Y.Doc,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockWebsocketProvider as unknown as any
      );
      
      // Simulate sync event
      mockWebsocketProvider.simulateSync(true);
      
      // Await the promise to resolve
      await syncPromise;
      
      // Test passes if promise resolves without error
      expect(true).toBe(true);
    });
  });

  describe('configureSyncProtocol', () => {
    it('should register event handlers correctly', () => {
      // Spy on the event registrations
      const onSpy = jest.spyOn(mockWebsocketProvider, 'on');
      
      // Execute
      configureSyncProtocol(
        mockDoc as unknown as Y.Doc,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockWebsocketProvider as unknown as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockIndexeddbProvider as unknown as any
      );
      
      // Verify proper event listeners were set up
      expect(onSpy).toHaveBeenCalledWith('status', expect.any(Function));
    });
  });

  describe('configureConflictResolution', () => {
    it('should register the correct event handlers', () => {
      // Spy on the doc.on method
      const onSpy = jest.spyOn(mockDoc, 'on');
      
      // Execute
      configureConflictResolution(mockDoc as unknown as Y.Doc);
      
      // Verify that the afterTransaction event handler was registered
      expect(onSpy).toHaveBeenCalledWith('afterTransaction', expect.any(Function));
    });
  });

  describe('setupCanvasSyncProtocol', () => {
    it('should configure everything correctly', () => {
      // Setup
      const statusCallback = jest.fn();
      
      // Execute
      setupCanvasSyncProtocol(
        mockDoc as unknown as Y.Doc,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockWebsocketProvider as unknown as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockIndexeddbProvider as unknown as any,
        statusCallback
      );
      
      // Verify window event listeners were added
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    });
  });
});
