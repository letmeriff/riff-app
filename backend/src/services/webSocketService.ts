/**
 * WebSocket Service
 * 
 * This module provides utilities for WebSocket service implementation
 * with a focus on centralized error handling.
 */

import { supabase } from '../config/supabase';
import { updateUserPresence, removeUserPresence, getUserPresence } from './presenceService';
import { updateNodePositionYjs, getYjsNodeId } from './yjsNodeService';

// Define socket data type
export interface SocketData {
  user?: {
    id: string;
    email?: string;
    [key: string]: unknown;
  };
}

// Define socket parameter type for event handlers
export interface SocketEventHandler<T = Record<string, unknown>> {
  (data: T): Promise<void>;
}

// Define socket with IO reference for broadcasting
export interface SocketWithIO {
  id: string;
  data: SocketData;
  join: (room: string) => void;
  leave: (room: string) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  emit: (event: string, data: unknown) => void;
  to: (room: string) => { emit: (event: string, data: unknown) => void };
}

// Define extended socket type with viewedNodes
export interface SocketWithViewedNodes extends SocketWithIO {
  viewedNodes: number[];
}

// Declare global io object for server-wide broadcasts
declare global {
  // eslint-disable-next-line no-var
  var io: {
    to: (room: string) => { emit: (event: string, data: unknown) => void };
    emit: (event: string, data: unknown) => void;
  };
}

/**
 * Utility function to create an error handler wrapper
 * 
 * @param eventName The name of the event for logging purposes
 * @param handler The original handler function to wrap
 * @returns A function that wraps the handler in a try/catch block
 */
export const withErrorHandling = (eventName: string, handler: (...args: unknown[]) => unknown) => {
  return async (...args: unknown[]) => {
    try {
      await handler(...args);
    } catch (error) {
      console.error(`Error handling ${eventName} event:`, error);
    }
  };
};

/**
 * Authentication middleware for Socket.IO
 * 
 * @param socket Socket instance
 * @param next Next function to call
 */
export const authMiddleware = async (
  socket: { 
    handshake: { auth: { token?: string } }, 
    data: { user?: { id: string; email?: string; [key: string]: unknown } }
  }, 
  next: (err?: Error) => void
) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return next(new Error('Authentication error: Invalid token'));
    }

    // Store simplified user data
    socket.data.user = {
      id: user.id,
      email: user.email,
    };
    next();
  } catch (error) {
    next(new Error('Authentication error: ' + (error instanceof Error ? error.message : 'Unknown error')));
  }
};

/**
 * Handle new socket connection
 * 
 * @param socket Socket instance
 */
export const handleConnection = (socket: SocketWithViewedNodes) => {
  console.log(`User connected: ${socket.data.user?.id}`);

  // Join a room based on the user ID
  const userRoom = `user:${socket.data.user?.id}`;
  socket.join(userRoom);

  // Store viewedNodes in socket object
  socket.viewedNodes = [];

  // Handle join-node event
  const handleJoinNode = async ({ nodeId }: { nodeId: number }) => {
    const userId = socket.data.user!.id;
    const email = socket.data.user?.email || 'unknown@example.com';

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
  };

  // Handle leave-node event
  const handleLeaveNode = async ({ nodeId }: { nodeId: number }) => {
    const userId = socket.data.user!.id;
    
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
  };

  // Handle typing event
  const handleTyping = async ({ nodeId, isTyping }: { nodeId: number; isTyping: boolean }) => {
    const userId = socket.data.user!.id;
    const email = socket.data.user?.email || 'unknown@example.com';
    
    // Update typing status
    await updateUserPresence(nodeId, userId, email, isTyping);

    // Get updated presence
    const presence = await getUserPresence(nodeId);

    // Emit presence update to the room
    const nodeRoom = `node:${nodeId}`;
    global.io.to(nodeRoom).emit('presence-update', { nodeId, presence });
  };

  // Handle node position update event
  const handleNodePositionUpdate = async ({ 
    nodeId, 
    position 
  }: { 
    nodeId: number; 
    position: { x: number; y: number } 
  }) => {
    const userId = socket.data.user!.id;
    
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
  };

  // Register event handlers with error handling
  socket.on('join-node', withErrorHandling('join-node', handleJoinNode));
  socket.on('leave-node', withErrorHandling('leave-node', handleLeaveNode));
  socket.on('typing', withErrorHandling('typing', handleTyping));
  socket.on('node-position-update', withErrorHandling('node-position-update', handleNodePositionUpdate));

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.data.user?.id}`);
    // Additional cleanup if needed
  });
};
