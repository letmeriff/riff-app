/**
 * Typing Service
 *
 * This module provides utilities for handling typing status updates
 */

import { SocketWithViewedNodes } from './webSocketService';
import { updateUserPresence, getUserPresence } from './presenceService';
import { emitToRoom } from './socketIoService';

/**
 * Handle typing status updates
 *
 * @param socket Socket instance with viewed nodes
 * @param data The data containing the node ID and typing status
 */
export const handleTyping = async (
  socket: SocketWithViewedNodes,
  { nodeId, isTyping }: { nodeId: number; isTyping: boolean }
): Promise<void> => {
  const userId = socket.data.user?.id;
  const email = socket.data.user?.email || 'unknown@example.com';

  if (!userId) {
    console.error('User ID not found in socket data');
    return;
  }

  // Update presence with typing status
  await updateUserPresence(nodeId, userId, email, isTyping);

  // Get updated presence
  const presence = await getUserPresence(nodeId);

  // Emit presence update to the node room
  const nodeRoom = `node:${nodeId}`;
  emitToRoom(nodeRoom, 'presence-update', { nodeId, presence });
};
