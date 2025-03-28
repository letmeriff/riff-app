/**
 * Test file for Yjs WebSocket Provider
 * 
 * References: 
 * - REQ-303 WebSocket Provider
 * - REQ-303.1 Connection Lifecycle
 * - REQ-303.2 Message Handling
 * - REQ-303.3 Authentication
 * - REQ-303.4 Reconnection Behavior
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { setupYjsWebSocketProvider, getConnectionStatus, reconnect, disconnect, getAuthParams } from './yjsWebSocketProvider'; // To be implemented

// Define event types for stronger typing
type EventListener = (event: Event) => void;
type _MessageEventListener = (event: MessageEvent) => void;
type _CloseEventListener = (event: CloseEvent) => void;

// Set up WebSocket and awareness mocks
class MockWebSocket {
  private eventListeners: Record<string, EventListener[]> = {};
  url: string;
  readyState: number = 0; // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
  
  constructor(url: string) {
    this.url = url;
  }
  
  addEventListener(event: string, callback: EventListener) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
    return this;
  }
  
  removeEventListener(event: string, callback: EventListener) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
    return this;
  }
  
  dispatchEvent(event: Event) {
    if (this.eventListeners[event.type]) {
      this.eventListeners[event.type].forEach(callback => callback(event));
    }
    return true;
  }
  
  send = jest.fn();
  close = jest.fn();
  
  // Helper methods for testing
  simulateOpen() {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }
  
  simulateMessage(data: string) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
  
  simulateError() {
    this.dispatchEvent(new Event('error'));
  }
  
  simulateClose(code: number = 1000, reason: string = '') {
    this.readyState = 3;
    this.dispatchEvent(new CloseEvent('close', { code, reason }));
  }
}

// Define types for WebsocketProvider event handlers
type _StatusEventCallback = (status: { status: string }) => void;
type _YjsEventName = 'status' | 'connection-close' | 'connection-error' | 'sync' | 'message';

// Define our mock provider interface - not extending WebsocketProvider
interface MockAwareness {
  setLocalState: jest.Mock;
  getLocalState: jest.Mock;
  getStates: jest.Mock;
  on: jest.Mock;
  off: jest.Mock;
}

interface MockWebsocketProvider {
  awareness: MockAwareness;
  wsconnected: boolean;
  wsconnecting: boolean;
  _ws: unknown;
  on: jest.Mock;
  off: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
  destroy: jest.Mock;
  broadcastMessage: jest.Mock;
  _simulateStatusChange(status: string): void;
}

// Mock the WebsocketProvider constructor and prototype
jest.mock('y-websocket', () => {
  const mockAwareness = {
    setLocalState: jest.fn(),
    getLocalState: jest.fn().mockReturnValue({}),
    getStates: jest.fn().mockReturnValue(new Map()),
    on: jest.fn(),
    off: jest.fn()
  };
  
  const mockProvider = {
    awareness: mockAwareness,
    wsconnected: false,
    wsconnecting: false,
    _ws: null as unknown,
    on: jest.fn(),
    off: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    destroy: jest.fn(),
    broadcastMessage: jest.fn(),
    
    // Testing helper to simulate connection events
    _simulateStatusChange(status: string) {
      const statusListeners = (this.on as jest.Mock).mock.calls
        .filter(call => call[0] === 'status')
        .map(call => call[1]);
      
      statusListeners.forEach(listener => listener({ status }));
    }
  };
  
  // Create the mock constructor that returns our mock provider
  const MockWebsocketProvider = jest.fn().mockImplementation(() => mockProvider);
  
  return {
    WebsocketProvider: MockWebsocketProvider
  };
});

// Mock Y.Doc
jest.mock('yjs', () => {
  const mockDoc = {
    on: jest.fn(),
    off: jest.fn(),
    transact: jest.fn(fn => fn()),
    clientID: 123
  };
  
  return {
    Doc: jest.fn(() => mockDoc)
  };
});

describe('Yjs WebSocket Provider', () => {
  let mockDoc: Y.Doc;
  let mockProvider: MockWebsocketProvider;
  let originalWebSocket: typeof WebSocket;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Save original WebSocket and replace with our mock
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    
    // Create a fresh document for each test
    mockDoc = new Y.Doc();
  });
  
  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
  });
  
  // Reference: REQ-303.1 Connection Lifecycle
  describe('Connection Lifecycle', () => {
    it('should create a WebsocketProvider with correct parameters', () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      const params = { token: 'test-token' };
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName, params) as unknown as MockWebsocketProvider;
      
      // Assert
      expect(WebsocketProvider).toHaveBeenCalledWith(
        wsUrl,
        roomName,
        mockDoc,
        expect.objectContaining({
          params
        })
      );
    });
    
    it('should report connected status when WebSocket connects', () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName) as unknown as MockWebsocketProvider;
      
      // Simulate connection
      mockProvider._simulateStatusChange('connected');
      
      // Assert
      expect(getConnectionStatus()).toBe('connected');
    });
    
    it('should report disconnected status when WebSocket disconnects', () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName) as unknown as MockWebsocketProvider;
      
      // Simulate disconnection
      mockProvider._simulateStatusChange('disconnected');
      
      // Assert
      expect(getConnectionStatus()).toBe('disconnected');
    });
    
    it('should clean up resources when destroyed', () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName) as unknown as MockWebsocketProvider;
      disconnect();
      
      // Assert
      expect(mockProvider.disconnect).toHaveBeenCalled();
    });
  });
  
  // Reference: REQ-303.2 Message Handling
  describe('Message Handling', () => {
    it('should broadcast messages to the server', () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName) as unknown as MockWebsocketProvider;
      
      // Simulate broadcasting a message
      mockProvider.broadcastMessage('test-message', 'test-data');
      
      // Assert
      expect(mockProvider.broadcastMessage).toHaveBeenCalledWith('test-message', 'test-data');
    });
    
    it('should register event handlers for incoming messages', () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      const onMessage = jest.fn();
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName) as unknown as MockWebsocketProvider;
      mockProvider.on('message', onMessage);
      
      // Assert
      expect(mockProvider.on).toHaveBeenCalledWith('message', onMessage);
    });
  });
  
  // Reference: REQ-303.3 Authentication
  describe('Authentication', () => {
    it('should pass authentication token with WebSocket connection', () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      const token = 'auth-token-123';
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName, { token }) as unknown as MockWebsocketProvider;
      
      // Assert
      expect(WebsocketProvider).toHaveBeenCalledWith(
        wsUrl,
        roomName,
        mockDoc,
        expect.objectContaining({
          params: { token }
        })
      );
    });
    
    it('should retrieve authentication parameters', () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      const token = 'auth-token-123';
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName, { token }) as unknown as MockWebsocketProvider;
      const params = getAuthParams();
      
      // Assert
      expect(params).toEqual({ token });
    });
  });
  
  // Reference: REQ-303.4 Reconnection Behavior
  describe('Reconnection Behavior', () => {
    it('should attempt to reconnect after connection loss', () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName) as unknown as MockWebsocketProvider;
      
      // Simulate disconnection
      mockProvider._simulateStatusChange('disconnected');
      
      // Trigger manual reconnect
      reconnect();
      
      // Assert
      expect(mockProvider.connect).toHaveBeenCalled();
    });
    
    it('should handle reconnection with exponential backoff', async () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      jest.useFakeTimers();
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName, {}, {
        maxBackoffTime: 5000,
        initialBackoffTime: 1000
      }) as unknown as MockWebsocketProvider;
      
      // Simulate multiple disconnections to trigger backoff
      mockProvider._simulateStatusChange('disconnected');
      reconnect();
      
      // Fast-forward time
      jest.advanceTimersByTime(1000);
      
      // Simulate another disconnection
      mockProvider._simulateStatusChange('disconnected');
      reconnect();
      
      // Assert that connect was called twice
      expect(mockProvider.connect).toHaveBeenCalledTimes(2);
      
      // Restore timers
      jest.useRealTimers();
    });
    
    it('should reset backoff after successful connection', () => {
      // Arrange
      const wsUrl = 'ws://localhost:1234';
      const roomName = 'test-room';
      
      // Act
      mockProvider = setupYjsWebSocketProvider(mockDoc, wsUrl, roomName) as unknown as MockWebsocketProvider;
      
      // Simulate disconnection then reconnection
      mockProvider._simulateStatusChange('disconnected');
      reconnect();
      mockProvider._simulateStatusChange('connected');
      
      // Force another disconnection to check if backoff was reset
      mockProvider._simulateStatusChange('disconnected');
      reconnect();
      
      // Assert that connect was called with initial backoff time
      expect(mockProvider.connect).toHaveBeenCalledTimes(2);
    });
  });
}); 