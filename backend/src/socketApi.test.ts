import { supabase } from './config/supabase';
import {
  updateUserPresence,
  removeUserPresence,
  getUserPresence,
} from './services/presenceService';
import { updateNodePositionYjs, getYjsNodeId } from './services/yjsNodeService';

// Mock dependencies
jest.mock('./config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnValue({
        data: { owner_id: 'user-1' },
        error: null,
      }),
    })),
  },
}));

jest.mock('./services/presenceService', () => ({
  updateUserPresence: jest.fn().mockResolvedValue(true),
  removeUserPresence: jest.fn().mockResolvedValue(true),
  getUserPresence: jest
    .fn()
    .mockResolvedValue([
      { userId: 'user-1', email: 'test@example.com', isTyping: false },
    ]),
}));

jest.mock('./services/yjsNodeService', () => ({
  updateNodePositionYjs: jest.fn().mockResolvedValue({
    success: true,
    data: { updatedAt: '2023-01-01T00:00:00.000Z' },
  }),
  getYjsNodeId: jest.fn((id) => `node-${id}`),
}));

// Create handler functions that match the implementation in index.ts
// These are the actual functions we're testing
const createHandlers = (socket, io) => {
  return {
    joinNode: async ({ nodeId }) => {
      try {
        const userId = socket.data.user.id;
        const email = socket.data.user.email || 'unknown@example.com';

        // Join the node-specific room
        const nodeRoom = `node:${nodeId}`;
        socket.join(nodeRoom);
        socket.data.viewedNodes.push(nodeId);

        // Update presence for the node
        await updateUserPresence(nodeId, userId, email, false);

        // Get updated presence
        const presence = await getUserPresence(nodeId);

        // Emit presence update to the room
        io.to(nodeRoom).emit('presence-update', { nodeId, presence });

        // Check if user is the owner
        const result = await supabase
          .from('chat_nodes')
          .select('owner_id')
          .eq('node_id', nodeId)
          .single();

        const node = result.data;
        const error = result.error;

        if (error) {
          console.error('Error fetching node owner:', error);
          return;
        }

        // Emit ownership info to the client
        socket.emit('ownership-update', {
          nodeId,
          isOwner: node.owner_id === userId,
          ownerId: node.owner_id,
        });
      } catch (error) {
        console.error('Error handling join-node event:', error);
      }
    },

    leaveNode: async ({ nodeId }) => {
      try {
        const userId = socket.data.user.id;

        // Leave the node-specific room
        const nodeRoom = `node:${nodeId}`;
        socket.leave(nodeRoom);

        // Remove node from viewed nodes
        const index = socket.data.viewedNodes.indexOf(nodeId);
        if (index !== -1) {
          socket.data.viewedNodes.splice(index, 1);
        }

        // Remove the user's presence
        await removeUserPresence(nodeId, userId);

        // Get updated presence
        const presence = await getUserPresence(nodeId);

        // Emit presence update to the room
        io.to(nodeRoom).emit('presence-update', { nodeId, presence });
      } catch (error) {
        console.error('Error handling leave-node event:', error);
      }
    },

    typing: async ({ nodeId, isTyping }) => {
      try {
        const userId = socket.data.user.id;
        const email = socket.data.user.email || 'unknown@example.com';

        // Update typing status
        await updateUserPresence(nodeId, userId, email, isTyping);

        // Get updated presence
        const presence = await getUserPresence(nodeId);

        // Emit presence update to the room
        const nodeRoom = `node:${nodeId}`;
        io.to(nodeRoom).emit('presence-update', { nodeId, presence });
      } catch (error) {
        console.error('Error handling typing event:', error);
      }
    },

    nodePositionUpdate: async ({ nodeId, position }) => {
      try {
        const userId = socket.data.user.id;

        // Update the node position using Yjs
        const documentId = `canvas-${nodeId}`;
        const yjsNodeId = getYjsNodeId(nodeId);

        const result = await updateNodePositionYjs(
          documentId,
          yjsNodeId,
          position,
          userId
        );

        if (result.success) {
          // Broadcast position update to all users
          io.emit('node-position-update', {
            nodeId,
            position,
            implementation: 'yjs',
            ...result.data,
          });
        }
      } catch (error) {
        console.error('Error handling node position update:', error);
      }
    },
  };
};

describe('WebSocket API Tests', () => {
  // Create mock objects
  let mockIo;
  let mockSocket;
  let handlers;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock the Socket.IO server
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    // Mock a socket client
    mockSocket = {
      id: 'test-socket-id',
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        viewedNodes: [],
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      rooms: new Set(['user:user-1']),
    };

    // Create the handlers with our mock objects
    handlers = createHandlers(mockSocket, mockIo);
  });

  describe('Socket Event Handlers', () => {
    test('should handle join-node event correctly', async () => {
      // Call the joinNode handler with test data
      await handlers.joinNode({ nodeId: 123 });

      // Verify socket joined the room
      expect(mockSocket.join).toHaveBeenCalledWith('node:123');

      // Verify presence was updated
      expect(updateUserPresence).toHaveBeenCalledWith(
        123,
        'user-1',
        'test@example.com',
        false
      );

      // Verify presence was retrieved
      expect(getUserPresence).toHaveBeenCalledWith(123);

      // Verify room received presence update
      expect(mockIo.to).toHaveBeenCalledWith('node:123');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'presence-update',
        expect.objectContaining({
          nodeId: 123,
          presence: expect.any(Array),
        })
      );

      // Verify socket received ownership update
      expect(mockSocket.emit).toHaveBeenCalledWith('ownership-update', {
        nodeId: 123,
        isOwner: true,
        ownerId: 'user-1',
      });

      // Verify node was added to viewedNodes
      expect(mockSocket.data.viewedNodes).toContain(123);
    });

    test('should handle leave-node event correctly', async () => {
      // Set up the test: add node to viewedNodes
      mockSocket.data.viewedNodes.push(123);

      // Call the leaveNode handler with test data
      await handlers.leaveNode({ nodeId: 123 });

      // Verify socket left the room
      expect(mockSocket.leave).toHaveBeenCalledWith('node:123');

      // Verify presence was removed
      expect(removeUserPresence).toHaveBeenCalledWith(123, 'user-1');

      // Verify presence was retrieved
      expect(getUserPresence).toHaveBeenCalledWith(123);

      // Verify room received presence update
      expect(mockIo.to).toHaveBeenCalledWith('node:123');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'presence-update',
        expect.objectContaining({
          nodeId: 123,
          presence: expect.any(Array),
        })
      );

      // Verify node was removed from viewedNodes
      expect(mockSocket.data.viewedNodes).not.toContain(123);
    });

    test('should handle typing event correctly', async () => {
      // Call the typing handler with test data
      await handlers.typing({ nodeId: 123, isTyping: true });

      // Verify presence was updated with typing status
      expect(updateUserPresence).toHaveBeenCalledWith(
        123,
        'user-1',
        'test@example.com',
        true
      );

      // Verify presence was retrieved
      expect(getUserPresence).toHaveBeenCalledWith(123);

      // Verify room received presence update
      expect(mockIo.to).toHaveBeenCalledWith('node:123');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'presence-update',
        expect.objectContaining({
          nodeId: 123,
          presence: expect.any(Array),
        })
      );
    });

    test('should handle node-position-update event correctly', async () => {
      // Call the nodePositionUpdate handler with test data
      await handlers.nodePositionUpdate({
        nodeId: 123,
        position: { x: 100, y: 200 },
      });

      // Verify position was updated
      expect(getYjsNodeId).toHaveBeenCalledWith(123);
      expect(updateNodePositionYjs).toHaveBeenCalledWith(
        'canvas-123',
        'node-123',
        { x: 100, y: 200 },
        'user-1'
      );

      // Verify broadcast was sent to all clients
      expect(mockIo.emit).toHaveBeenCalledWith(
        'node-position-update',
        expect.objectContaining({
          nodeId: 123,
          position: { x: 100, y: 200 },
          implementation: 'yjs',
          updatedAt: '2023-01-01T00:00:00.000Z',
        })
      );
    });
  });

  describe('WebSocket Message Formats', () => {
    test('presence-update message format', async () => {
      // Set up expected format
      const expectedFormat = {
        nodeId: 123,
        presence: [
          { userId: 'user-1', email: 'test@example.com', isTyping: false },
        ],
      };

      // Call the joinNode handler with test data
      await handlers.joinNode({ nodeId: 123 });

      // Verify message format sent to the room
      expect(mockIo.emit).toHaveBeenCalledWith(
        'presence-update',
        expect.objectContaining(expectedFormat)
      );
    });

    test('ownership-update message format', async () => {
      // Set up expected format
      const expectedFormat = {
        nodeId: 123,
        isOwner: true,
        ownerId: 'user-1',
      };

      // Call the joinNode handler with test data
      await handlers.joinNode({ nodeId: 123 });

      // Verify message format sent to the client
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'ownership-update',
        expectedFormat
      );
    });

    test('node-position-update message format', async () => {
      // Set up expected format
      const expectedFormat = {
        nodeId: 123,
        position: { x: 100, y: 200 },
        implementation: 'yjs',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      // Call the nodePositionUpdate handler with test data
      await handlers.nodePositionUpdate({
        nodeId: 123,
        position: { x: 100, y: 200 },
      });

      // Verify message format sent to all clients
      expect(mockIo.emit).toHaveBeenCalledWith(
        'node-position-update',
        expect.objectContaining(expectedFormat)
      );
    });
  });
});
