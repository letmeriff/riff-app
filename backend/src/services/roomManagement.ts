/**
 * Room Management Service
 *
 * This module provides utilities for managing room-based operations in WebSocket connections
 */

import { supabase } from '../config/supabase';
import { SocketWithViewedNodes } from './webSocketService';
import {
  updateUserPresence,
  removeUserPresence,
  getUserPresence,
} from './presenceService';
import { emitToRoom } from './socketIoService';

/**
 * Handle a user joining a node room
 *
 * @param socket Socket instance with viewed nodes
 * @param data The data containing the node ID
 */
export const joinNode = async (
  socket: SocketWithViewedNodes,
  { nodeId }: { nodeId: number }
): Promise<void> => {
  const userId = socket.data.user?.id;
  const email = socket.data.user?.email || 'unknown@example.com';

  if (!userId) {
    console.error('User ID not found in socket data');
    return;
  }

  // Join the node-specific room
  const nodeRoom = `node:${nodeId}`;
  socket.join(nodeRoom);
  socket.viewedNodes.push(nodeId);

  // Update presence for the node
  await updateUserPresence(nodeId, userId, email, false);

  // Get updated presence
  const presence = await getUserPresence(nodeId);

  // Emit presence update to the room
  emitToRoom(nodeRoom, 'presence-update', { nodeId, presence });

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
    ownerId: node.owner_id,
  });
};

/**
 * Handle a user leaving a node room
 *
 * @param socket Socket instance with viewed nodes
 * @param data The data containing the node ID
 */
export const leaveNode = async (
  socket: SocketWithViewedNodes,
  { nodeId }: { nodeId: number }
): Promise<void> => {
  const userId = socket.data.user?.id;

  if (!userId) {
    console.error('User ID not found in socket data');
    return;
  }

  // Leave the node-specific room
  const nodeRoom = `node:${nodeId}`;
  socket.leave(nodeRoom);

  // Remove node from viewedNodes
  socket.viewedNodes = socket.viewedNodes.filter((id) => id !== nodeId);

  // Update presence
  await removeUserPresence(nodeId, userId);

  // Get updated presence
  const presence = await getUserPresence(nodeId);

  // Emit presence update to the room
  emitToRoom(nodeRoom, 'presence-update', { nodeId, presence });
};

/**
 * Handle disconnect events
 *
 * @param socket Socket instance with viewed nodes
 */
export const handleDisconnect = async (
  socket: SocketWithViewedNodes
): Promise<void> => {
  const userId = socket.data.user?.id;

  if (!userId) {
    console.error('User ID not found in socket data');
    return;
  }

  console.log(`User disconnected: ${userId}`);

  // Clean up presence for all viewed nodes
  for (const nodeId of socket.viewedNodes) {
    await removeUserPresence(nodeId, userId);

    // Get updated presence
    const presence = await getUserPresence(nodeId);

    // Emit presence update to the node room
    const nodeRoom = `node:${nodeId}`;
    emitToRoom(nodeRoom, 'presence-update', { nodeId, presence });
  }
};
