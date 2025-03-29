/**
 * Node Position Service
 *
 * This module provides utilities for handling node position updates
 */

import { SocketWithViewedNodes } from './webSocketService';
import { updateNodePositionYjs, getYjsNodeId } from './yjsNodeService';
import { emitToAll } from './socketIoService';

/**
 * Handle node position updates
 *
 * @param socket Socket instance with viewed nodes
 * @param data The data containing the node ID and position
 */
export const handleNodePosition = async (
  socket: SocketWithViewedNodes,
  { nodeId, position }: { nodeId: number; position: { x: number; y: number } }
): Promise<void> => {
  const userId = socket.data.user?.id;

  if (!userId) {
    console.error('User ID not found in socket data');
    return;
  }

  try {
    console.log(`User ${userId} updated position of node ${nodeId}:`, position);

    // Use node ID as part of document ID for simplicity
    const documentId = `canvas-${nodeId}`;
    const yjsNodeId = getYjsNodeId(nodeId);

    const result = await updateNodePositionYjs(
      documentId,
      yjsNodeId,
      position,
      userId
    );

    if (result.success) {
      console.log(`Successfully updated position for node ${nodeId} using Yjs`);

      // Broadcast the position update to all users
      emitToAll('node-position-update', {
        nodeId,
        position,
        implementation: 'yjs',
        ...result.data,
      });
    } else {
      console.error(`Failed to update position for node ${nodeId} using Yjs`);
    }
  } catch (error) {
    console.error('Error handling node position update:', error);
  }
};
