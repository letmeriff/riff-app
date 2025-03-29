import * as awarenessProtocol from 'y-protocols/awareness';
import { WebSocket } from 'ws';
import * as encoding from 'lib0/encoding';

/**
 * Manages awareness state for collaborative documents
 */
export class AwarenessManager {
  constructor() {}

  /**
   * Send awareness update to all clients
   */
  broadcastAwarenessUpdate(
    subscribers: Set<WebSocket>,
    awareness: awarenessProtocol.Awareness,
    changedClients: number[],
    excluded: WebSocket | null = null
  ): void {
    if (!subscribers || subscribers.size === 0) return;

    const message = encoding.createEncoder();
    encoding.writeVarUint(message, 1); // Message type 1 = awareness
    encoding.writeVarUint8Array(message, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
    const messageBuffer = encoding.toUint8Array(message);

    subscribers.forEach(client => {
      if (client !== excluded && client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageBuffer);
        } catch (err) {
          console.error('Error broadcasting awareness update:', err);
        }
      }
    });
  }

  /**
   * Process an awareness update from a client
   */
  processAwarenessUpdate(
    awareness: awarenessProtocol.Awareness,
    update: Uint8Array,
    origin: WebSocket
  ): number[] {
    // Apply awareness update
    awarenessProtocol.applyAwarenessUpdate(awareness, update, origin);
    
    // Extract changed client IDs from the update to broadcast
    const changedClientsSet = new Set<number>();
    for (let i = 0; i < update.length; i++) {
      changedClientsSet.add(update[i]);
    }
    
    return Array.from(changedClientsSet);
  }

  /**
   * Log awareness state
   */
  logAwarenessState(documentId: string, awareness: awarenessProtocol.Awareness): void {
    const states = awareness.getStates();
    if (states.size > 0) {
      console.log(`[AWARENESS] Document ${documentId} has ${states.size} active users`);
    }
  }
} 