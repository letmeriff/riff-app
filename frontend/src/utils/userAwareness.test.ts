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
import { Awareness } from 'y-protocols/awareness';

// Define types for the mock awareness class
interface EventHandlers {
  [key: string]: Array<(args: unknown[]) => void>;
}

// Define the state type to replace any
interface AwarenessState {
  user?: {
    id: string;
    name: string;
  };
  cursor?: {
    x: number;
    y: number;
  };
  editing?: {
    nodeId: string;
  } | null;
  isOnline?: boolean;
  lastActive?: number;
  [key: string]: unknown;
}

// Mock Y.js awareness functionality
jest.mock('y-protocols/awareness', () => {
  class MockAwareness {
    public states = new Map<number, AwarenessState>();
    private eventHandlers: EventHandlers = {};

    constructor(public doc: Y.Doc) {}

    setLocalState(state: AwarenessState): this {
      this.states.set(this.doc.clientID, state);
      this.emit('change', [this.doc.clientID]);
      return this;
    }

    getLocalState(): AwarenessState {
      return this.states.get(this.doc.clientID) || {};
    }

    getStates(): Map<number, AwarenessState> {
      return this.states;
    }

    on(event: string, callback: (args: unknown[]) => void): this {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }
      this.eventHandlers[event].push(callback);
      return this;
    }

    off(event: string, callback?: (args: unknown[]) => void): this {
      if (!callback) {
        delete this.eventHandlers[event];
      } else if (this.eventHandlers[event]) {
        this.eventHandlers[event] = this.eventHandlers[event].filter(
          (cb) => cb !== callback
        );
      }
      return this;
    }

    emit(event: string, args: unknown[]): this {
      if (this.eventHandlers[event]) {
        this.eventHandlers[event].forEach((callback) => callback(args));
      }
      return this;
    }

    removeStates(clientIds: number[]): this {
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
    removeAwarenessStates: jest.fn((awareness: MockAwareness, clientIds: number[]) => {
      awareness.removeStates(clientIds);
    })
  };
});

// Define types for our test environment
interface MockClient {
  id: string;
  doc: any;
  isOnline?: boolean;
  disconnect?: () => void;
  connect?: () => void;
  // Add other properties as needed
}

// Add this at the top of the file, after imports
// Define what the TestEnvironment should contain
interface TestEnvironment {
  clients: Array<{
    id: string;
    doc: any;
    isOnline: boolean;
    disconnect: () => void;
    connect: () => void;
    // Add other client properties as needed
  }>;
  syncAll: () => void;
  cleanup: () => void;
  waitForSync: (timeout?: number) => Promise<void>;
  disconnectClient: (clientIndex: number) => void;
  reconnectClient: (clientIndex: number) => void;
}

// Mock our test environment
jest.mock('../test-utils/multiUserTestHarness', () => {
  // We can't use import inside a mock, so use a workaround
  // const Awareness = jest.requireActual('y-protocols/awareness').Awareness;
  
  return {
    createTestMultiUserEnvironment: jest.fn().mockImplementation((): TestEnvironment => {
      const mockDocs: Y.Doc[] = [];
      const mockAwareness: Awareness[] = [];
      const mockClients: MockClient[] = [];
      
      // Get the mocked Awareness constructor that we set up in the previous mock
      const AwarenessMock = jest.requireMock('y-protocols/awareness').Awareness;

      for (let i = 0; i < 3; i++) {
        const doc = new Y.Doc();
        mockDocs.push(doc);

        // Create awareness for each client using the mocked constructor
        const awareness = new AwarenessMock(doc);
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
        syncAll: jest.fn(() => {
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
      // @ts-ignore - syncAwareness doesn't exist in the type but exists at runtime
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
      const { clients, syncAll } = createTestMultiUserEnvironment();
      
      // Act - Multiple users update cursor positions
      updateUserCursor(clients[0].doc, { x: 100, y: 100 });
      updateUserCursor(clients[1].doc, { x: 200, y: 200 });
      
      // Sync the awareness states
      syncAll();
      
      // Assert - Clients should see each other's cursor positions
      const userCursors = getUserCursors(clients[0].doc);
      
      // Should have 2 other users' cursors (excluding self)
      expect(userCursors).toHaveLength(2);
      
      // Verify specific user's cursor
      const user2Cursor = userCursors.find(c => c.userId === 'user2');
      expect(user2Cursor).toBeDefined();
      expect(user2Cursor?.position).toEqual({ x: 200, y: 200 });
    });
  });

  // Reference: REQ-501.2 Editing Status
  describe('Editing Status', () => {
    it('should track which node a user is editing', async () => {
      // Arrange
      const { clients, syncAll } = createTestMultiUserEnvironment();
      
      // Act - User 1 starts editing a node
      const nodeId = 'node1';
      updateEditingStatus(clients[0].doc, nodeId, true);
      
      // Sync the awareness states
      syncAll();
      
      // Assert - Other clients should see User 1 is editing the node
      const editingUsers = getEditingUsers(clients[1].doc);
      
      expect(editingUsers).toHaveLength(1);
      expect(editingUsers[0].userId).toBe('user1');
      expect(editingUsers[0].nodeId).toBe(nodeId);
    });
    
    it('should clear editing status when user stops editing', async () => {
      // Arrange
      const { clients, syncAll } = createTestMultiUserEnvironment();
      
      // Setup - User 1 starts editing
      updateEditingStatus(clients[0].doc, 'node1', true);
      syncAll();
      
      // Act - User 1 stops editing
      updateEditingStatus(clients[0].doc, 'node1', false);
      syncAll();
      
      // Assert - User 1 should no longer be in editing users list
      const editingUsers = getEditingUsers(clients[1].doc);
      
      expect(editingUsers).toHaveLength(0);
    });
    
    it('should show multiple users editing different nodes', async () => {
      // Arrange
      const { clients, syncAll } = createTestMultiUserEnvironment();
      
      // Act - Multiple users edit different nodes
      updateEditingStatus(clients[0].doc, 'node1', true);
      updateEditingStatus(clients[1].doc, 'node2', true);
      
      // Sync the awareness states
      syncAll();
      
      // Assert - Should see both users editing
      const users1 = getUsersEditingNode(clients[2].doc, 'node1');
      const users2 = getUsersEditingNode(clients[2].doc, 'node2');
      
      expect(users1.length).toBe(1);
      expect(users1[0]).toBe(clients[0].id);
      
      expect(users2.length).toBe(1);
      expect(users2[0]).toBe(clients[1].id);
    });
  });
  
  // Reference: REQ-501.3 User Presence
  describe('User Presence', () => {
    it('should track online users', async () => {
      // Arrange
      const { clients, syncAll } = createTestMultiUserEnvironment();
      
      // Act - Set all users as online
      clients.forEach(client => updateUserPresence(client.doc, true));
      
      // Sync the awareness states
      syncAll();
      
      // Assert - Should see other users as online
      const onlineUsers = getOnlineUsers(clients[0].doc);
      
      // Should see all three users (including self)
      expect(onlineUsers.length).toBe(3);
      expect(onlineUsers).toContain(clients[0].id);
      expect(onlineUsers).toContain(clients[1].id);
      expect(onlineUsers).toContain(clients[2].id);
    });
    
    it('should remove disconnected users', async () => {
      // Arrange
      const { clients, disconnectClient, syncAll } = createTestMultiUserEnvironment();
      
      // Setup - All users connected
      clients.forEach(client => updateUserPresence(client.doc, true));
      syncAll();
      
      // Act - Disconnect one user
      disconnectClient(1); // Disconnect user2
      syncAll();
      
      // Assert - Should only see remaining online user
      const onlineUsers = getOnlineUsers(clients[0].doc);
      
      // Should only see two users (including self)
      expect(onlineUsers.length).toBe(2);
      expect(onlineUsers).toContain(clients[0].id);
      expect(onlineUsers).not.toContain(clients[1].id);
      expect(onlineUsers).toContain(clients[2].id);
    });
    
    it('should show users at a specific node', async () => {
      // Arrange
      const { clients, syncAll } = createTestMultiUserEnvironment();
      
      // Act - Two users editing the same node
      updateEditingStatus(clients[0].doc, 'node1', true);
      updateEditingStatus(clients[1].doc, 'node1', true);
      
      // Sync the awareness states
      syncAll();
      
      // Assert - Should see both users at node1
      const usersAtNode = getUsersEditingNode(clients[2].doc, 'node1');
      
      expect(usersAtNode.length).toBe(2);
      expect(usersAtNode).toContain(clients[0].id);
      expect(usersAtNode).toContain(clients[1].id);
    });
  });
  
  // Testing edge cases
  describe('Edge Cases', () => {
    it('should handle users joining and leaving', async () => {
      // Arrange
      const { clients, disconnectClient, reconnectClient, syncAll } = createTestMultiUserEnvironment();
      
      // Setup - All users connected
      clients.forEach(client => updateUserPresence(client.doc, true));
      syncAll();
      
      // Act 1 - Disconnect a user
      disconnectClient(1); // Disconnect user2
      syncAll();
      
      // Assert 1 - User should be gone
      let onlineUsers = getOnlineUsers(clients[0].doc);
      expect(onlineUsers).not.toContain(clients[1].id);
      
      // Act 2 - Reconnect the user
      reconnectClient(1);
      syncAll();
      
      // Assert 2 - User should be back
      onlineUsers = getOnlineUsers(clients[0].doc);
      expect(onlineUsers).toContain(clients[1].id);
    });
    
    it('should handle cursor updates when user is editing', async () => {
      // Arrange
      const { clients, syncAll } = createTestMultiUserEnvironment();
      
      // Act - User is both editing and moving cursor
      updateEditingStatus(clients[0].doc, 'node1', true);
      updateUserCursor(clients[0].doc, { x: 150, y: 250 });
      
      // Sync the awareness states
      syncAll();
      
      // Assert - Should track both cursor and editing status
      const userState = getAwarenessState(clients[1].doc, clients[0].id);
      
      expect(userState).toBeDefined();
      expect(userState?.editingNode).toBe('node1');
      expect(userState?.cursor?.x).toBe(150);
      expect(userState?.cursor?.y).toBe(250);
    });
  });
}); 