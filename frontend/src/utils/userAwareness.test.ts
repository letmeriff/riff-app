/**
 * Test file for user awareness functionality
 * 
 * Reference: REQ-501 User Awareness
 * Tests focused on real-time user presence, cursor positions, 
 * editing status, and other user awareness features.
 */

import * as Y from 'yjs';
import { createTestMultiUserEnvironment } from '../test-utils/multiUserTestHarness';
import { 
  updateUserCursor, 
  updateEditingStatus, 
  updateUserPresence,
  getUsersInCanvas,
  getEditingUsers,
  getUsersAtNode,
  getUserCursors
} from './userAwareness';

// Define types for the mock awareness class
interface EventHandlers {
  [key: string]: Function[];
}

// Mock Y.js awareness functionality
jest.mock('y-protocols/awareness', () => {
  class MockAwareness {
    public states = new Map();
    private eventHandlers: EventHandlers = {};

    constructor(public doc: Y.Doc) {}

    setLocalState(state: any) {
      this.states.set(this.doc.clientID, state);
      this.emit('change', [this.doc.clientID]);
      return this;
    }

    getLocalState() {
      return this.states.get(this.doc.clientID) || {};
    }

    getStates() {
      return this.states;
    }

    on(event: string, callback: Function) {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }
      this.eventHandlers[event].push(callback);
      return this;
    }

    off(event: string, callback?: Function) {
      if (!callback) {
        delete this.eventHandlers[event];
      } else if (this.eventHandlers[event]) {
        this.eventHandlers[event] = this.eventHandlers[event].filter(
          (cb: Function) => cb !== callback
        );
      }
      return this;
    }

    emit(event: string, args: any[]) {
      if (this.eventHandlers[event]) {
        this.eventHandlers[event].forEach((callback: Function) => callback(args));
      }
      return this;
    }

    removeStates(clientIds: number[]) {
      clientIds.forEach(id => {
        this.states.delete(id);
      });
      this.emit('change', clientIds);
      return this;
    }
  }

  return {
    Awareness: MockAwareness,
    // Add any additional functions needed
    removeAwarenessStates: jest.fn((awareness, clientIds) => {
      awareness.removeStates(clientIds);
    })
  };
});

// Define types for our test environment
interface MockClient {
  id: string;
  doc: Y.Doc;
  awareness: any;
  clientId: number;
  updateCursor: (position: { x: number; y: number }) => void;
  updateEditingStatus: (nodeId: string, isEditing: boolean) => void;
  updatePresence: (isOnline: boolean) => void;
  disconnect: () => void;
  connect: () => void;
}

interface TestEnvironment {
  clients: MockClient[];
  syncAwareness: () => void;
  cleanup: () => void;
  waitForSync: () => Promise<void>;
  disconnectClient: (clientIndex: number) => void;
  reconnectClient: (clientIndex: number) => void;
}

// Mock our test environment
jest.mock('../test-utils/multiUserTestHarness', () => {
  return {
    createTestMultiUserEnvironment: jest.fn().mockImplementation((): TestEnvironment => {
      const mockDocs: Y.Doc[] = [];
      const mockAwareness: any[] = [];
      const mockClients: MockClient[] = [];

      for (let i = 0; i < 3; i++) {
        const doc = new Y.Doc();
        mockDocs.push(doc);

        // Create awareness for each client
        const awareness = new (require('y-protocols/awareness')).Awareness(doc);
        mockAwareness.push(awareness);

        mockClients.push({
          id: `user${i + 1}`,
          doc,
          awareness,
          clientId: i + 1,
          updateCursor: jest.fn((position) => {
            const state = awareness.getLocalState() || {};
            awareness.setLocalState({
              ...state,
              user: { id: `user${i + 1}`, name: `User ${i + 1}` },
              cursor: position
            });
          }),
          updateEditingStatus: jest.fn((nodeId, isEditing) => {
            const state = awareness.getLocalState() || {};
            awareness.setLocalState({
              ...state,
              user: { id: `user${i + 1}`, name: `User ${i + 1}` },
              editing: isEditing ? { nodeId } : null
            });
          }),
          updatePresence: jest.fn((isOnline) => {
            const state = awareness.getLocalState() || {};
            awareness.setLocalState({
              ...state,
              user: { id: `user${i + 1}`, name: `User ${i + 1}` },
              isOnline
            });
          }),
          disconnect: jest.fn(() => {
            const state = awareness.getLocalState() || {};
            awareness.setLocalState({
              ...state,
              isOnline: false
            });
          }),
          connect: jest.fn(() => {
            const state = awareness.getLocalState() || {};
            awareness.setLocalState({
              ...state,
              isOnline: true
            });
          }),
        });
      }

      return {
        clients: mockClients,
        syncAwareness: jest.fn(() => {
          // Simulate awareness sync between clients
          for (let i = 0; i < mockClients.length; i++) {
            const sourceAwareness = mockAwareness[i];
            const sourceStates = sourceAwareness.getStates();
            
            for (let j = 0; j < mockClients.length; j++) {
              if (i !== j) {
                const targetAwareness = mockAwareness[j];
                sourceStates.forEach((state, clientId) => {
                  if (clientId !== mockClients[j].clientId) {
                    targetAwareness.states.set(clientId, state);
                  }
                });
              }
            }
          }
          
          // Emit change event for all clients
          mockAwareness.forEach(a => {
            a.emit('change', Array.from(a.getStates().keys()));
          });
        }),
        cleanup: jest.fn(),
        waitForSync: jest.fn().mockImplementation(() => Promise.resolve()),
        disconnectClient: jest.fn((clientIndex) => {
          if (clientIndex >= 0 && clientIndex < mockClients.length) {
            mockClients[clientIndex].disconnect();
          }
        }),
        reconnectClient: jest.fn((clientIndex) => {
          if (clientIndex >= 0 && clientIndex < mockClients.length) {
            mockClients[clientIndex].connect();
          }
        }),
      };
    }),
  };
});

describe('User Awareness', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Reference: REQ-501.1 Cursor Positioning
  describe('Cursor Tracking', () => {
    it('should update and share cursor position between users', async () => {
      // Arrange
      const { clients, syncAwareness } = createTestMultiUserEnvironment();
      
      // Act - User 1 updates cursor position
      const cursorPosition = { x: 100, y: 200 };
      updateUserCursor(clients[0].doc, cursorPosition);
      
      // Sync the awareness states
      syncAwareness();
      
      // Assert - Other clients should see User 1's cursor position
      const user1State = getUserCursors(clients[1].doc).find(
        (cursor) => cursor.userId === 'user1'
      );
      
      expect(user1State).toBeDefined();
      expect(user1State?.position).toEqual(cursorPosition);
    });
    
    it('should handle multiple users moving cursors simultaneously', async () => {
      // Arrange
      const { clients, syncAwareness } = createTestMultiUserEnvironment();
      
      // Act - Multiple users update cursor positions
      updateUserCursor(clients[0].doc, { x: 100, y: 100 });
      updateUserCursor(clients[1].doc, { x: 200, y: 200 });
      updateUserCursor(clients[2].doc, { x: 300, y: 300 });
      
      // Sync the awareness states
      syncAwareness();
      
      // Assert - All clients should see all cursors
      const cursorsSeenByClient1 = getUserCursors(clients[0].doc);
      expect(cursorsSeenByClient1.length).toBe(2); // Should see other clients, not own cursor
      
      const user2Cursor = cursorsSeenByClient1.find(c => c.userId === 'user2');
      const user3Cursor = cursorsSeenByClient1.find(c => c.userId === 'user3');
      
      expect(user2Cursor?.position).toEqual({ x: 200, y: 200 });
      expect(user3Cursor?.position).toEqual({ x: 300, y: 300 });
    });
    
    it('should remove cursor when user disconnects', async () => {
      // Arrange
      const { clients, syncAwareness, disconnectClient } = createTestMultiUserEnvironment();
      
      // Act - All users update cursor positions
      updateUserCursor(clients[0].doc, { x: 100, y: 100 });
      updateUserCursor(clients[1].doc, { x: 200, y: 200 });
      updateUserCursor(clients[2].doc, { x: 300, y: 300 });
      
      // Sync the awareness states
      syncAwareness();
      
      // Verify all cursors are initially visible
      expect(getUserCursors(clients[0].doc).length).toBe(2);
      
      // Disconnect user 2
      disconnectClient(1);
      syncAwareness();
      
      // Assert - User 2's cursor should be removed
      const cursorsAfterDisconnect = getUserCursors(clients[0].doc);
      expect(cursorsAfterDisconnect.length).toBe(1);
      expect(cursorsAfterDisconnect[0].userId).toBe('user3');
    });
  });

  // Reference: REQ-501.2 Editing Status
  describe('Editing Status', () => {
    it('should show which node a user is editing', async () => {
      // Arrange
      const { clients, syncAwareness } = createTestMultiUserEnvironment();
      const nodeId = 'node-123';
      
      // Act - User 1 starts editing a node
      updateEditingStatus(clients[0].doc, nodeId, true);
      
      // Sync the awareness states
      syncAwareness();
      
      // Assert - Other users should see User 1 is editing the node
      const editingUsers = getEditingUsers(clients[1].doc);
      
      expect(editingUsers.length).toBe(1);
      expect(editingUsers[0].userId).toBe('user1');
      expect(editingUsers[0].nodeId).toBe(nodeId);
    });
    
    it('should handle multiple users editing different nodes', async () => {
      // Arrange
      const { clients, syncAwareness } = createTestMultiUserEnvironment();
      
      // Act - Multiple users edit different nodes
      updateEditingStatus(clients[0].doc, 'node-1', true);
      updateEditingStatus(clients[1].doc, 'node-2', true);
      updateEditingStatus(clients[2].doc, 'node-3', true);
      
      // Sync the awareness states
      syncAwareness();
      
      // Assert - Should see who is editing each node
      const editingUsers = getEditingUsers(clients[0].doc);
      expect(editingUsers.length).toBe(2); // Should see other users, not self
      
      const nodesBeingEdited = editingUsers.map(u => u.nodeId);
      expect(nodesBeingEdited).toContain('node-2');
      expect(nodesBeingEdited).toContain('node-3');
    });
    
    it('should show which users are editing a specific node', async () => {
      // Arrange
      const { clients, syncAwareness } = createTestMultiUserEnvironment();
      const sharedNodeId = 'shared-node';
      
      // Act - Multiple users edit the same node
      updateEditingStatus(clients[0].doc, sharedNodeId, true);
      updateEditingStatus(clients[1].doc, sharedNodeId, true);
      
      // Sync the awareness states
      syncAwareness();
      
      // Assert - Should see all users editing the node
      const usersAtNode = getUsersAtNode(clients[2].doc, sharedNodeId);
      
      expect(usersAtNode.length).toBe(2);
      expect(usersAtNode.map(u => u.userId)).toContain('user1');
      expect(usersAtNode.map(u => u.userId)).toContain('user2');
    });
    
    it('should update when a user stops editing a node', async () => {
      // Arrange
      const { clients, syncAwareness } = createTestMultiUserEnvironment();
      const nodeId = 'node-123';
      
      // User starts editing
      updateEditingStatus(clients[0].doc, nodeId, true);
      syncAwareness();
      
      // Verify initial state
      expect(getEditingUsers(clients[1].doc).length).toBe(1);
      
      // Act - User stops editing
      updateEditingStatus(clients[0].doc, nodeId, false);
      syncAwareness();
      
      // Assert - User should no longer be shown as editing
      expect(getEditingUsers(clients[1].doc).length).toBe(0);
    });
  });

  // Reference: REQ-501.3 User Presence
  describe('User Presence', () => {
    it('should show all connected users', async () => {
      // Arrange
      const { clients, syncAwareness } = createTestMultiUserEnvironment();
      
      // Act - All users mark themselves as online
      clients.forEach(client => {
        updateUserPresence(client.doc, true);
      });
      
      // Sync the awareness states
      syncAwareness();
      
      // Assert - Should see all connected users
      const connectedUsers = getUsersInCanvas(clients[0].doc);
      
      expect(connectedUsers.length).toBe(2); // Should see other users, not self
      expect(connectedUsers.map(u => u.userId)).toContain('user2');
      expect(connectedUsers.map(u => u.userId)).toContain('user3');
    });
    
    it('should update when users connect or disconnect', async () => {
      // Arrange
      const { clients, syncAwareness, disconnectClient } = createTestMultiUserEnvironment();
      
      // All users are initially online
      clients.forEach(client => {
        updateUserPresence(client.doc, true);
      });
      
      syncAwareness();
      
      // Verify initial state
      expect(getUsersInCanvas(clients[0].doc).length).toBe(2);
      
      // Act - User 2 disconnects
      disconnectClient(1);
      syncAwareness();
      
      // Assert - User 2 should no longer be in the list of connected users
      const connectedUsers = getUsersInCanvas(clients[0].doc);
      
      expect(connectedUsers.length).toBe(1);
      expect(connectedUsers[0].userId).toBe('user3');
    });
  });
}); 