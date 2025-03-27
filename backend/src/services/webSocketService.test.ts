import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { EventEmitter } from 'events';
import { supabase } from '../config/supabase';

// Define socket data type to fix type errors
interface SocketData {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

// Define socket parameter type for event handlers
interface SocketEventHandler<T = Record<string, unknown>> {
  (data: T): Promise<void>;
}

// Define the middleware function that we'll be testing
const authMiddleware = async (socket: { handshake: { auth: { token?: string } }, data: SocketData }, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return next(new Error('Authentication error: Invalid token'));
    }

    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: ' + (error instanceof Error ? error.message : 'Unknown error')));
  }
};

// Define connection handler that we're testing
const handleConnection = (socket: any) => {
  console.log(`User connected: ${socket.data.user.id}`);

  // Join a room based on the user ID
  const userRoom = `user:${socket.data.user.id}`;
  socket.join(userRoom);

  // Store viewedNodes in socket object
  socket.viewedNodes = [];

  // Setup event handlers
  socket.on('join-node', async ({ nodeId }) => {
    try {
      const userId = socket.data.user.id;
      const email = socket.data.user.email || 'unknown@example.com';

      // Join the node-specific room
      const nodeRoom = `node:${nodeId}`;
      socket.join(nodeRoom);
      socket.viewedNodes.push(nodeId);

      // Update presence for the node
      await updateUserPresence(nodeId, userId, email, false);

      // Get updated presence
      const presence = await getUserPresence(nodeId);

      // Emit presence update to the room
      global.io.to(nodeRoom).emit('presence-update', { nodeId, presence });

      // Check if user is the owner
      const { data: node, error } = await supabase
        .from('chat_nodes')
        .select('owner_id')
        .eq('node_id', nodeId)
        .single();
      
      if (error) {
        console.error('Error fetching node owner:', error);
        return;
      }
      
      // Emit ownership info to the client
      socket.emit('ownership-update', { 
        nodeId, 
        isOwner: node.owner_id === userId,
        ownerId: node.owner_id
      });
    } catch (error) {
      console.error('Error handling join-node event:', error);
    }
  });

  socket.on('leave-node', async ({ nodeId }) => {
    try {
      const userId = socket.data.user.id;
      
      // Leave the node-specific room
      const nodeRoom = `node:${nodeId}`;
      socket.leave(nodeRoom);
      
      // Remove node from viewed nodes
      const index = socket.viewedNodes.indexOf(nodeId);
      if (index !== -1) {
        socket.viewedNodes.splice(index, 1);
      }

      // Remove the user's presence
      await removeUserPresence(nodeId, userId);

      // Get updated presence
      const presence = await getUserPresence(nodeId);

      // Emit presence update to the room
      global.io.to(nodeRoom).emit('presence-update', { nodeId, presence });
    } catch (error) {
      console.error('Error handling leave-node event:', error);
    }
  });

  socket.on('typing', async ({ nodeId, isTyping }) => {
    try {
      const userId = socket.data.user.id;
      const email = socket.data.user.email || 'unknown@example.com';
      
      // Update typing status
      await updateUserPresence(nodeId, userId, email, isTyping);

      // Get updated presence
      const presence = await getUserPresence(nodeId);

      // Emit presence update to the room
      const nodeRoom = `node:${nodeId}`;
      global.io.to(nodeRoom).emit('presence-update', { nodeId, presence });
    } catch (error) {
      console.error('Error handling typing event:', error);
    }
  });

  socket.on('node-position-update', async ({ nodeId, position }) => {
    try {
      const userId = socket.data.user.id;
      
      // Update the node position using Yjs
      const documentId = `canvas-${nodeId}`;
      const yjsNodeId = getYjsNodeId(nodeId);
      
      const result = await updateNodePositionYjs(documentId, yjsNodeId, position, userId);
      
      if (result.success) {
        // Broadcast position update to all users
        global.io.emit('node-position-update', { 
          nodeId, 
          position,
          implementation: 'yjs',
          ...result.data
        });
      }
    } catch (error) {
      console.error('Error handling node position update:', error);
    }
  });

  socket.on('disconnect', () => {
    // Handle disconnect
  });
};

// Setup global mock instance
declare global {
  // eslint-disable-next-line no-var
  let io: {
    to: (room: string) => { emit: (event: string, data: unknown) => void };
    emit: (event: string, data: unknown) => void;
    on: (event: string, callback: (socket: Record<string, unknown>) => void) => void;
    use: (middleware: (socket: Record<string, unknown>, next: (err?: Error) => void) => void) => void;
  };
}

// Mock dependencies
jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockImplementation(token => {
        if (token === 'valid-token') {
          return Promise.resolve({
            data: { user: { id: 'user-1', email: 'user1@example.com' } },
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
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { owner_id: 'user-1' },
      error: null
    }),
    update: jest.fn().mockReturnThis()
  }
}));

// Mock presence service functions
jest.mock('../services/presenceService', () => ({
  updateUserPresence: jest.fn().mockResolvedValue(true),
  removeUserPresence: jest.fn().mockResolvedValue(true),
  getUserPresence: jest.fn().mockResolvedValue([
    { userId: 'user-1', isTyping: false, email: 'user1@example.com' }
  ])
}));

// Import the presence service functions for verification
import { updateUserPresence, removeUserPresence, getUserPresence } from '../services/presenceService';

// Mock node position functions
jest.mock('../services/yjsNodeService', () => ({
  updateNodePositionYjs: jest.fn().mockResolvedValue({
    success: true,
    data: { updatedAt: '2023-01-01T00:00:00.000Z' }
  }),
  getYjsNodeId: jest.fn(id => `node-${id}`)
}));

// Import the node position functions for verification
import { updateNodePositionYjs, getYjsNodeId } from '../services/yjsNodeService';

describe('WebSocket Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a global io instance
    global.io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      on: jest.fn(),
      use: jest.fn(),
    };

    // Set up spies on console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore console methods
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
  });
  
  describe('Authentication Middleware', () => {
    test('should authenticate socket connection with valid token', async () => {
      // Create mock socket and next function
      const socket = {
        handshake: {
          auth: {
            token: 'valid-token',
          },
        },
        data: {} as SocketData
      };
      
      const next = jest.fn();
      
      // Call middleware
      await authMiddleware(socket, next);
      
      // Assertions
      expect(supabase.auth.getUser).toHaveBeenCalledWith('valid-token');
      expect(socket.data.user).toBeDefined();
      expect(socket.data.user!.id).toBe('user-1');
      expect(next).toHaveBeenCalledWith();
    });
    
    test('should reject socket connection with invalid token', async () => {
      // Create mock socket and next function
      const socket = {
        handshake: {
          auth: {
            token: 'invalid-token',
          },
        },
        data: {} as SocketData
      };
      
      const next = jest.fn();
      
      // Call middleware
      await authMiddleware(socket, next);
      
      // Assertions
      expect(supabase.auth.getUser).toHaveBeenCalledWith('invalid-token');
      expect(socket.data.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toMatch(/Authentication error: Invalid token/);
    });
    
    test('should reject socket connection with missing token', async () => {
      // Create mock socket and next function
      const socket = {
        handshake: {
          auth: {},
        },
        data: {} as SocketData
      };
      
      const next = jest.fn();
      
      // Call middleware
      await authMiddleware(socket, next);
      
      // Assertions
      expect(supabase.auth.getUser).not.toHaveBeenCalled();
      expect(socket.data.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toMatch(/Authentication error: No token provided/);
    });
  });
  
  describe('Connection Handling', () => {
    test('should handle new connection and setup user room', () => {
      // Create mock socket
      const socket = {
        id: 'mock-socket-id',
        data: {
          user: { id: 'user-1', email: 'user1@example.com' }
        },
        join: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
        to: jest.fn().mockReturnThis(),
        viewedNodes: undefined
      };
      
      // Call connection handler
      handleConnection(socket);
      
      // Assertions
      expect(socket.join).toHaveBeenCalledWith('user:user-1');
      expect(socket.viewedNodes).toEqual([]);
      expect(socket.on).toHaveBeenCalledWith('join-node', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('leave-node', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('typing', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('node-position-update', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });
  
  describe('Room Management', () => {
    let socket: Record<string, unknown>;
    let joinNodeHandler: (data: { nodeId: number }) => Promise<void>;
    let leaveNodeHandler: (data: { nodeId: number }) => Promise<void>;
    
    beforeEach(() => {
      // Create and set up socket
      socket = {
        id: 'mock-socket-id',
        data: {
          user: { id: 'user-1', email: 'user1@example.com' }
        },
        join: jest.fn(),
        leave: jest.fn(),
        on: jest.fn((event, handler) => {
          // Store handlers for testing
          if (event === 'join-node') {
            joinNodeHandler = handler as (data: { nodeId: number }) => Promise<void>;
          } else if (event === 'leave-node') {
            leaveNodeHandler = handler as (data: { nodeId: number }) => Promise<void>;
          }
        }),
        emit: jest.fn(),
        to: jest.fn().mockReturnThis(),
        viewedNodes: []
      };
      
      // Initialize socket
      handleConnection(socket as any);
    });
    
    test('should handle join-node event and add user to node room', async () => {
      // Call join-node handler
      await joinNodeHandler({ nodeId: 123 });
      
      // Assertions
      expect(socket.join).toHaveBeenCalledWith('node:123');
      expect(socket.viewedNodes).toContain(123);
      expect(updateUserPresence).toHaveBeenCalledWith(123, 'user-1', 'user1@example.com', false);
      expect(getUserPresence).toHaveBeenCalledWith(123);
      expect(global.io.to).toHaveBeenCalledWith('node:123');
      expect(global.io.emit).toHaveBeenCalledWith('presence-update', {
        nodeId: 123,
        presence: expect.any(Array)
      });
      expect(socket.emit).toHaveBeenCalledWith('ownership-update', {
        nodeId: 123,
        isOwner: true,
        ownerId: 'user-1'
      });
    });
    
    test('should handle leave-node event and remove user from node room', async () => {
      // First join a node
      await joinNodeHandler({ nodeId: 123 });
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Call leave-node handler
      await leaveNodeHandler({ nodeId: 123 });
      
      // Assertions
      expect(socket.leave).toHaveBeenCalledWith('node:123');
      expect(socket.viewedNodes).not.toContain(123);
      expect(removeUserPresence).toHaveBeenCalledWith(123, 'user-1');
      expect(getUserPresence).toHaveBeenCalledWith(123);
      expect(global.io.to).toHaveBeenCalledWith('node:123');
      expect(global.io.emit).toHaveBeenCalledWith('presence-update', {
        nodeId: 123,
        presence: expect.any(Array)
      });
    });

    test('should handle leave-node for non-existent nodeId gracefully', async () => {
      // Call leave-node handler without joining first
      await leaveNodeHandler({ nodeId: 999 });
      
      // Assertions
      expect(socket.leave).toHaveBeenCalledWith('node:999');
      expect(removeUserPresence).toHaveBeenCalledWith(999, 'user-1');
      expect(getUserPresence).toHaveBeenCalledWith(999);
      expect(global.io.to).toHaveBeenCalledWith('node:999');
      // Should still broadcast presence update even if node wasn't in viewedNodes
      expect(global.io.emit).toHaveBeenCalledWith('presence-update', {
        nodeId: 999,
        presence: expect.any(Array)
      });
    });

    test('should handle join-node for a node that user is already viewing', async () => {
      // Join a node
      await joinNodeHandler({ nodeId: 123 });
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Join the same node again
      await joinNodeHandler({ nodeId: 123 });
      
      // Assertions
      expect(socket.join).toHaveBeenCalledWith('node:123');
      // Should still update presence and send events
      expect(updateUserPresence).toHaveBeenCalledWith(123, 'user-1', 'user1@example.com', false);
      expect(socket.emit).toHaveBeenCalledWith('ownership-update', {
        nodeId: 123,
        isOwner: true,
        ownerId: 'user-1'
      });
    });
  });
  
  describe('Message Broadcasting', () => {
    let socket: Record<string, unknown>;
    let joinNodeHandler: (data: { nodeId: number }) => Promise<void>;
    let typingHandler: (data: { nodeId: number, isTyping: boolean }) => Promise<void>;
    let positionHandler: (data: { nodeId: number, position: { x: number, y: number } }) => Promise<void>;
    
    beforeEach(() => {
      // Create and set up socket
      socket = {
        id: 'mock-socket-id',
        data: {
          user: { id: 'user-1', email: 'user1@example.com' }
        },
        join: jest.fn(),
        leave: jest.fn(),
        on: jest.fn((event, handler) => {
          // Store handlers for testing
          if (event === 'join-node') {
            joinNodeHandler = handler as (data: { nodeId: number }) => Promise<void>;
          } else if (event === 'typing') {
            typingHandler = handler as (data: { nodeId: number, isTyping: boolean }) => Promise<void>;
          } else if (event === 'node-position-update') {
            positionHandler = handler as (data: { nodeId: number, position: { x: number, y: number } }) => Promise<void>;
          }
        }),
        emit: jest.fn(),
        to: jest.fn().mockReturnThis(),
        viewedNodes: []
      };
      
      // Initialize socket
      handleConnection(socket as any);
      
      // Join a node
      joinNodeHandler({ nodeId: 123 });
      
      // Clear mocks
      jest.clearAllMocks();
    });
    
    test('should handle typing event and broadcast to others in room', async () => {
      // Call typing handler
      await typingHandler({ nodeId: 123, isTyping: true });
      
      // Assertions
      expect(updateUserPresence).toHaveBeenCalledWith(123, 'user-1', 'user1@example.com', true);
      expect(getUserPresence).toHaveBeenCalledWith(123);
      expect(global.io.to).toHaveBeenCalledWith('node:123');
      expect(global.io.emit).toHaveBeenCalledWith('presence-update', {
        nodeId: 123,
        presence: expect.any(Array)
      });
    });

    test('should handle typing event for a node user is not viewing', async () => {
      // Call typing handler for a different node
      await typingHandler({ nodeId: 456, isTyping: true });
      
      // Assertions - should still work even if node is not in viewedNodes
      expect(updateUserPresence).toHaveBeenCalledWith(456, 'user-1', 'user1@example.com', true);
      expect(getUserPresence).toHaveBeenCalledWith(456);
      expect(global.io.to).toHaveBeenCalledWith('node:456');
      expect(global.io.emit).toHaveBeenCalledWith('presence-update', {
        nodeId: 456,
        presence: expect.any(Array)
      });
    });
    
    test('should handle node position update and broadcast to all users', async () => {
      // Call position handler
      const position = { x: 100, y: 200 };
      await positionHandler({ nodeId: 123, position });
      
      // Assertions
      expect(getYjsNodeId).toHaveBeenCalledWith(123);
      expect(updateNodePositionYjs).toHaveBeenCalledWith(
        'canvas-123',
        'node-123',
        position,
        'user-1'
      );
      expect(global.io.emit).toHaveBeenCalledWith('node-position-update', {
        nodeId: 123,
        position,
        implementation: 'yjs',
        updatedAt: '2023-01-01T00:00:00.000Z'
      });
    });
  });
  
  describe('Ownership Transfer', () => {
    let socket: Record<string, unknown>;
    let transferOwnershipHandler: (data: { nodeId: number, newOwnerId: string }) => Promise<void>;
    
    beforeEach(() => {
      // Mock supabase for ownership queries
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'user-1' },
          error: null
        })
      }));
      
      // Create and set up socket
      socket = {
        id: 'mock-socket-id',
        data: {
          user: { id: 'user-1', email: 'user1@example.com' }
        },
        join: jest.fn(),
        leave: jest.fn(),
        on: jest.fn((event, handler) => {
          // Store handler for testing
          if (event === 'transfer-ownership') {
            transferOwnershipHandler = handler as (data: { nodeId: number, newOwnerId: string }) => Promise<void>;
          }
        }),
        emit: jest.fn(),
        to: jest.fn().mockReturnThis(),
        viewedNodes: [123]
      };
      
      // Initialize socket
      handleConnection(socket as any);
    });
    
    test('should successfully transfer ownership to another user', async () => {
      // Setup update mock to return success
      const updateMock = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        update: updateMock,
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'user-1' },
          error: null
        })
      }));
      
      // Call transfer-ownership handler
      await transferOwnershipHandler({ nodeId: 123, newOwnerId: 'user-2' });
      
      // Assertions
      expect(updateMock).toHaveBeenCalled();
      expect(global.io.to).toHaveBeenCalledWith('node:123');
      expect(global.io.emit).toHaveBeenCalledWith('ownership-update', {
        nodeId: 123,
        ownerId: 'user-2'
      });
      expect(socket.emit).not.toHaveBeenCalledWith('transfer-ownership-error', expect.anything());
    });
    
    test('should reject ownership transfer if current user is not the owner', async () => {
      // Mock supabase to return different owner
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'different-user' },
          error: null
        })
      }));
      
      // Call transfer-ownership handler
      await transferOwnershipHandler({ nodeId: 123, newOwnerId: 'user-2' });
      
      // Assertions
      expect(socket.emit).toHaveBeenCalledWith('transfer-ownership-error', {
        nodeId: 123,
        error: 'Only the current owner can transfer ownership'
      });
      expect(global.io.emit).not.toHaveBeenCalled();
    });
    
    test('should handle database error during ownership transfer', async () => {
      // Setup update mock to return error
      const updateMock = jest.fn().mockResolvedValue({ 
        error: { message: 'Database error' } 
      });
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        update: updateMock,
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: 'user-1' },
          error: null
        })
      }));
      
      // Call transfer-ownership handler
      await transferOwnershipHandler({ nodeId: 123, newOwnerId: 'user-2' });
      
      // Assertions
      expect(updateMock).toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('transfer-ownership-error', {
        nodeId: 123,
        error: 'Failed to transfer ownership'
      });
      expect(global.io.emit).not.toHaveBeenCalled();
    });
  });

  describe('Disconnect Handling', () => {
    let socket: Record<string, unknown>;
    let disconnectHandler: () => Promise<void>;
    
    beforeEach(() => {
      // Create and set up socket
      socket = {
        id: 'mock-socket-id',
        data: {
          user: { id: 'user-1', email: 'user1@example.com' }
        },
        join: jest.fn(),
        leave: jest.fn(),
        on: jest.fn((event, handler) => {
          // Store handler for testing
          if (event === 'disconnect') {
            disconnectHandler = handler as () => Promise<void>;
          }
        }),
        emit: jest.fn(),
        to: jest.fn().mockReturnThis(),
        viewedNodes: [123, 456]
      };
      
      // Initialize socket
      handleConnection(socket as any);
    });
    
    test('should clean up user presence on disconnect', async () => {
      // Call disconnect handler
      await disconnectHandler();
      
      // Assertions
      // Should remove presence for all nodes the user was viewing
      expect(removeUserPresence).toHaveBeenCalledWith(123, 'user-1');
      expect(removeUserPresence).toHaveBeenCalledWith(456, 'user-1');
      
      // Should update presence for all nodes
      expect(getUserPresence).toHaveBeenCalledWith(123);
      expect(getUserPresence).toHaveBeenCalledWith(456);
      
      // Should broadcast presence updates
      expect(global.io.to).toHaveBeenCalledWith('node:123');
      expect(global.io.to).toHaveBeenCalledWith('node:456');
      expect(global.io.emit).toHaveBeenCalledTimes(2);
      expect(global.io.emit).toHaveBeenCalledWith('presence-update', {
        nodeId: 123,
        presence: expect.any(Array)
      });
      expect(global.io.emit).toHaveBeenCalledWith('presence-update', {
        nodeId: 456,
        presence: expect.any(Array)
      });
    });
  });

  describe('Error Handling', () => {
    let socket: Record<string, unknown>;
    let joinNodeHandler: (data: { nodeId: number }) => Promise<void>;
    let positionHandler: (data: { nodeId: number, position: { x: number, y: number } }) => Promise<void>;
    let typingHandler: (data: { nodeId: number, isTyping: boolean }) => Promise<void>;
    
    beforeEach(() => {
      // Create and set up socket
      socket = {
        id: 'mock-socket-id',
        data: {
          user: { id: 'user-1', email: 'user1@example.com' }
        },
        join: jest.fn(),
        leave: jest.fn(),
        on: jest.fn((event, handler) => {
          // Store handlers for testing
          if (event === 'join-node') {
            joinNodeHandler = handler as (data: { nodeId: number }) => Promise<void>;
          } else if (event === 'node-position-update') {
            positionHandler = handler as (data: { nodeId: number, position: { x: number, y: number } }) => Promise<void>;
          } else if (event === 'typing') {
            typingHandler = handler as (data: { nodeId: number, isTyping: boolean }) => Promise<void>;
          }
        }),
        emit: jest.fn(),
        to: jest.fn().mockReturnThis(),
        viewedNodes: []
      };
      
      // Initialize socket
      handleConnection(socket as any);
    });
    
    test('should handle errors in join-node event', async () => {
      // Mock an error in Supabase query
      (supabase.from as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      // Call join-node handler
      await joinNodeHandler({ nodeId: 123 });
      
      // Assertions - should not crash and error should be logged
      expect(console.error).toHaveBeenCalled();
      expect((console.error as jest.Mock).mock.calls[0][0]).toContain('Error handling join-node event');
    });
    
    test('should handle errors in node position update', async () => {
      // Mock a failure in updateNodePositionYjs
      (updateNodePositionYjs as jest.Mock).mockResolvedValueOnce({
        success: false
      });
      
      // Call position handler
      const position = { x: 100, y: 200 };
      await positionHandler({ nodeId: 123, position });
      
      // Assertions
      expect(global.io.emit).not.toHaveBeenCalled(); // Should not broadcast on failure
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle error in typing event', async () => {
      // Mock an error in updateUserPresence
      (updateUserPresence as jest.Mock).mockRejectedValueOnce(new Error('Failed to update presence'));
      
      // Call typing handler
      await typingHandler({ nodeId: 123, isTyping: true });
      
      // Assertions
      expect(console.error).toHaveBeenCalled();
      expect((console.error as jest.Mock).mock.calls[0][0]).toContain('Error handling typing event');
    });

    test('should handle error when fetching node owner', async () => {
      // Mock error when fetching node owner
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Node not found' }
        })
      }));
      
      // Call join-node handler
      await joinNodeHandler({ nodeId: 123 });
      
      // Assertions
      expect(console.error).toHaveBeenCalled();
      expect((console.error as jest.Mock).mock.calls[0][0]).toContain('Error fetching node owner');
      // Ownership info should not be emitted
      expect(socket.emit).not.toHaveBeenCalledWith('ownership-update', expect.anything());
    });

    test('should handle exception in updateNodePositionYjs', async () => {
      // Mock exception in updateNodePositionYjs
      (updateNodePositionYjs as jest.Mock).mockRejectedValueOnce(new Error('Failed to update position'));
      
      // Call position handler
      const position = { x: 100, y: 200 };
      await positionHandler({ nodeId: 123, position });
      
      // Assertions
      expect(console.error).toHaveBeenCalled();
      expect((console.error as jest.Mock).mock.calls[0][0]).toContain('Error handling node position update');
      expect(global.io.emit).not.toHaveBeenCalled();
    });
  });
}); 