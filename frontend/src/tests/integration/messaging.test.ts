/**
 * Integration Tests for Messaging Architecture
 * 
 * These tests verify the type safety and correctness of our real-time messaging
 * implementation with multiple simultaneous clients.
 */

import { createTestMultiUserEnvironment } from '../../test-utils/multiUserTestHarness';
import { validatePayload } from '../../services/networkService';
import {
  isMessageUpdatePayload,
  isPresenceUpdatePayload,
  isOwnershipUpdatePayload,
  isNodeUpdatePayload,
  parseNodeId,
  compareNodeIds
} from '../../utils/typeGuards';
import {
  NetworkPayload,
  MessageUpdatePayload,
  PresenceUpdatePayload,
  OwnershipUpdatePayload,
  NodeId
} from '../../types/messaging';

// Mock the socket.io client library
jest.mock('socket.io-client', () => {
  const mockSocketOn = jest.fn();
  const mockSocketOff = jest.fn();
  const mockSocketEmit = jest.fn();
  const mockSocketDisconnect = jest.fn();

  return {
    io: jest.fn(() => ({
      on: mockSocketOn,
      off: mockSocketOff,
      emit: mockSocketEmit,
      disconnect: mockSocketDisconnect,
      id: 'mock-socket-id',
      connected: true
    }))
  };
});

// Mock the network adapter
const mockSubscribeToEvent = jest.fn();
const mockSendMessage = jest.fn();
const mockNetworkAdapter = {
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn(),
  isConnected: jest.fn().mockReturnValue(true),
  sendMessage: mockSendMessage,
  subscribeToEvent: mockSubscribeToEvent,
  updateUserPresence: jest.fn(),
  setUserCursor: jest.fn()
};

// Mock implementation of event handlers
const mockEventHandlers = new Map<string, Set<(payload: NetworkPayload) => void>>();

describe('Messaging Architecture Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the mock event handlers
    mockEventHandlers.clear();
    
    // Setup mock event subscription
    mockSubscribeToEvent.mockImplementation((eventName, callback) => {
      if (!mockEventHandlers.has(eventName)) {
        mockEventHandlers.set(eventName, new Set());
      }
      mockEventHandlers.get(eventName)?.add(callback);
      
      return () => {
        mockEventHandlers.get(eventName)?.delete(callback);
      };
    });
    
    // Setup mock send message to trigger handlers
    mockSendMessage.mockImplementation((eventName, payload) => {
      const handlers = mockEventHandlers.get(eventName);
      if (handlers) {
        handlers.forEach(handler => handler(payload));
      }
    });
  });
  
  describe('Type Guards for Network Payloads', () => {
    test('isMessageUpdatePayload correctly validates message payloads', () => {
      // Valid payload
      const validPayload: MessageUpdatePayload = {
        nodeId: 123,
        new: {
          node_id: 123,
          message_id: 456,
          content: 'Hello, world!',
          is_user: true,
          timestamp: '2023-03-20T12:00:00Z'
        }
      };
      
      // Invalid payloads
      const invalidPayload1 = { nodeId: 123 }; // Missing 'new'
      const invalidPayload2 = { nodeId: 123, new: null }; // 'new' is null
      const invalidPayload3 = { 
        nodeId: 123, 
        new: { content: 'Missing required fields' } 
      }; // Missing node_id
      
      // Test validation
      expect(isMessageUpdatePayload(validPayload)).toBe(true);
      expect(isMessageUpdatePayload(invalidPayload1)).toBe(false);
      expect(isMessageUpdatePayload(invalidPayload2)).toBe(false);
      expect(isMessageUpdatePayload(invalidPayload3)).toBe(false);
    });
    
    test('isPresenceUpdatePayload correctly validates presence payloads', () => {
      // Valid payload
      const validPayload: PresenceUpdatePayload = {
        nodeId: 123,
        presence: [
          { userId: 'user1', email: 'user1@example.com', isTyping: true, lastActive: '2023-03-20T12:00:00Z' }
        ]
      };
      
      // Invalid payloads
      const invalidPayload1 = { nodeId: 123 }; // Missing 'presence'
      const invalidPayload2 = { nodeId: 123, presence: 'not-an-array' }; // 'presence' is not an array
      
      // Test validation
      expect(isPresenceUpdatePayload(validPayload)).toBe(true);
      expect(isPresenceUpdatePayload(invalidPayload1)).toBe(false);
      expect(isPresenceUpdatePayload(invalidPayload2)).toBe(false);
    });
    
    test('isOwnershipUpdatePayload correctly validates ownership payloads', () => {
      // Valid payload
      const validPayload: OwnershipUpdatePayload = {
        nodeId: 123,
        ownerId: 'user1'
      };
      
      // Invalid payloads
      const invalidPayload1 = { nodeId: 123 }; // Missing 'ownerId'
      const invalidPayload2 = { ownerId: 'user1' }; // Missing 'nodeId'
      
      // Test validation
      expect(isOwnershipUpdatePayload(validPayload)).toBe(true);
      expect(isOwnershipUpdatePayload(invalidPayload1)).toBe(false);
      expect(isOwnershipUpdatePayload(invalidPayload2)).toBe(false);
    });
  });
  
  describe('ID Parsing and Comparison', () => {
    test('parseNodeId safely converts string to number', () => {
      expect(parseNodeId('123')).toBe(123);
      expect(parseNodeId('abc')).toBe(null); // Invalid number
      expect(parseNodeId(null)).toBe(null); // null input
    });
    
    test('compareNodeIds safely compares numeric and string IDs', () => {
      expect(compareNodeIds(123, '123')).toBe(true);
      expect(compareNodeIds(123, '456')).toBe(false);
      expect(compareNodeIds(123, 'abc')).toBe(false); // Invalid string number
      expect(compareNodeIds(123, null)).toBe(false); // null string
    });
  });
  
  describe('Payload Validation', () => {
    test('validatePayload returns valid payload or null', () => {
      // Valid payload
      const validMessagePayload: MessageUpdatePayload = {
        nodeId: 123,
        new: {
          node_id: 123,
          message_id: 456,
          content: 'Hello, world!',
          is_user: true,
          timestamp: '2023-03-20T12:00:00Z'
        }
      };
      
      // Invalid payload
      const invalidPayload = { nodeId: 123 }; // Missing 'new'
      
      // Test validation
      expect(validatePayload(validMessagePayload, isMessageUpdatePayload)).toEqual(validMessagePayload);
      expect(validatePayload(invalidPayload, isMessageUpdatePayload)).toBe(null);
    });
  });
  
  describe('Multi-User Messaging', () => {
    let testEnv: ReturnType<typeof createTestMultiUserEnvironment>;
    
    beforeEach(() => {
      // Create a test environment with 3 users
      testEnv = createTestMultiUserEnvironment(3);
    });
    
    afterEach(() => {
      // Clean up the test environment
      testEnv.cleanup();
    });
    
    test('message updates are correctly validated across clients', async () => {
      const mockMessageHandler1 = jest.fn();
      const mockMessageHandler2 = jest.fn();
      
      // Set up event handlers for clients
      mockSubscribeToEvent('message-update', (payload: NetworkPayload) => {
        const validPayload = validatePayload(payload, isMessageUpdatePayload);
        if (validPayload) {
          mockMessageHandler1(validPayload);
        }
      });
      
      mockSubscribeToEvent('message-update', (payload: NetworkPayload) => {
        const validPayload = validatePayload(payload, isMessageUpdatePayload);
        if (validPayload) {
          mockMessageHandler2(validPayload);
        }
      });
      
      // Send a message update
      const messagePayload: MessageUpdatePayload = {
        nodeId: 123,
        new: {
          node_id: 123,
          message_id: 456,
          content: 'Hello from client 1!',
          is_user: true,
          timestamp: '2023-03-20T12:00:00Z'
        }
      };
      
      mockSendMessage('message-update', messagePayload);
      
      // Wait for sync
      await testEnv.waitForSync();
      
      // Verify that the handlers were called with valid payloads
      expect(mockMessageHandler1).toHaveBeenCalledWith(expect.objectContaining({
        nodeId: 123,
        new: expect.objectContaining({
          node_id: 123,
          content: 'Hello from client 1!'
        })
      }));
      
      expect(mockMessageHandler2).toHaveBeenCalledWith(expect.objectContaining({
        nodeId: 123,
        new: expect.objectContaining({
          node_id: 123,
          content: 'Hello from client 1!'
        })
      }));
    });
    
    test('presence updates are correctly validated across clients', async () => {
      const mockPresenceHandler = jest.fn();
      
      // Set up event handlers
      mockSubscribeToEvent('presence-update', (payload: NetworkPayload) => {
        const validPayload = validatePayload(payload, isPresenceUpdatePayload);
        if (validPayload) {
          mockPresenceHandler(validPayload);
        }
      });
      
      // Send a presence update
      const presencePayload: PresenceUpdatePayload = {
        nodeId: 123,
        presence: [
          { userId: 'user1', email: 'user1@example.com', isTyping: true, lastActive: '2023-03-20T12:00:00Z' },
          { userId: 'user2', email: 'user2@example.com', isTyping: false, lastActive: '2023-03-20T12:01:00Z' }
        ]
      };
      
      mockSendMessage('presence-update', presencePayload);
      
      // Wait for sync
      await testEnv.waitForSync();
      
      // Verify that the handler was called with a valid payload
      expect(mockPresenceHandler).toHaveBeenCalledWith(expect.objectContaining({
        nodeId: 123,
        presence: expect.arrayContaining([
          expect.objectContaining({ userId: 'user1', isTyping: true }),
          expect.objectContaining({ userId: 'user2', isTyping: false })
        ])
      }));
    });
    
    test('invalid payloads are rejected by validation', async () => {
      const mockMessageHandler = jest.fn();
      
      // Set up event handler with validation
      mockSubscribeToEvent('message-update', (payload: NetworkPayload) => {
        const validPayload = validatePayload(payload, isMessageUpdatePayload);
        if (validPayload) {
          mockMessageHandler(validPayload);
        }
      });
      
      // Send an invalid message update
      const invalidPayload = {
        nodeId: 123,
        // Missing 'new' property
      };
      
      mockSendMessage('message-update', invalidPayload);
      
      // Wait for sync
      await testEnv.waitForSync();
      
      // Verify that the handler was not called due to validation failure
      expect(mockMessageHandler).not.toHaveBeenCalled();
    });
  });
}); 