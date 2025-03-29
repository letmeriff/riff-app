import * as Y from 'yjs';
import { WebSocket } from 'ws';
import * as syncProtocol from 'y-protocols/sync';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { DocumentManager } from './DocumentManager';
import { AwarenessManager } from './AwarenessManager';
import { PersistenceService } from './PersistenceService';

/**
 * Handles WebSocket messages for YJS synchronization
 */
export class MessageHandler {
  private throttledBroadcasts = new Map<string, (encoder: encoding.Encoder) => void>();
  
  constructor(
    private documentManager: DocumentManager,
    private awarenessManager: AwarenessManager,
    private persistenceService: PersistenceService
  ) {}

  /**
   * Process an incoming message from a client
   */
  async processMessage(ws: WebSocket, message: Uint8Array): Promise<void> {
    // Check if client is associated with a document
    const client = this.documentManager.getClientInfo(ws);
    if (!client) {
      console.error('Client not found for WebSocket connection');
      return;
    }
    
    const { documentId, clientId } = client;
    const doc = await this.documentManager.getDocument(documentId);
    const awareness = this.documentManager.getAwareness(documentId);
    const subscribers = this.documentManager.getSubscribers(documentId);

    if (!awareness || !subscribers) {
      console.error(`No awareness or subscribers for document ${documentId}`);
      return;
    }

    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case 0: { // Sync step 1: Client sends its state vector to request missing updates
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 1); // Message type 1 = sync step 2
        
        // Read client's state vector
        const stateVector = decoding.readVarUint8Array(decoder);
        
        // Generate sync message with updates the client doesn't have
        syncProtocol.writeSyncStep2(encoder, doc, stateVector);
        
        // Send response with missing updates
        ws.send(encoding.toUint8Array(encoder));
        
        // Log sync activity
        console.log(`[SYNC] Client ${clientId} requested updates for document ${documentId}`);
        break;
      }
      case 1: { // Sync step 2: Server responds with missing updates (handled by client)
        // This case is typically handled by clients, but we include it for completeness
        try {
          // Apply the updates to our document
          syncProtocol.readSyncStep2(decoder, doc, new Uint8Array());
          console.log(`[SYNC] Received sync step 2 from client ${clientId}`);
        } catch (error) {
          console.error(`[SYNC] Error processing sync step 2: ${error}`);
        }
        break;
      }
      case 2: { // Sync step 3: Client sends its updates to the server
        try {
          // Read client's updates
          const update = decoding.readVarUint8Array(decoder);
          
          // Apply updates to the document
          Y.applyUpdate(doc, update, ws);
          
          // Store update in the database with timestamp-based version
          await this.persistenceService.storeUpdate(documentId, update, clientId);
          
          // Log update
          console.log(`[SYNC] Applied update from client ${clientId} to document ${documentId}`);
          
          // Broadcast the update to all other clients
          this.broadcastDocumentUpdate(subscribers, update, ws);
          
          // Periodically check if we should create a snapshot
          const shouldSnapshot = Math.random() < 0.1; // ~10% chance on each update
          if (shouldSnapshot) {
            await this.persistenceService.createSnapshot(documentId, doc);
            console.log(`[SYNC] Created snapshot for document ${documentId} after update`);
          }
        } catch (error) {
          console.error(`[SYNC] Error processing update: ${error}`);
        }
        break;
      }
      case 3: { // Awareness update
        if (!awareness) break;
        
        try {
          // Read awareness update
          const awarenessUpdate = decoding.readVarUint8Array(decoder);
          
          // Process the awareness update and get changed clients
          const changedClients = this.awarenessManager.processAwarenessUpdate(
            awareness, 
            awarenessUpdate, 
            ws
          );
          
          // Broadcast awareness update to other clients
          if (changedClients.length > 0) {
            this.awarenessManager.broadcastAwarenessUpdate(
              subscribers,
              awareness,
              changedClients,
              ws
            );
            
            // Log awareness update
            this.awarenessManager.logAwarenessState(documentId, awareness);
          }
        } catch (error) {
          console.error(`[AWARENESS] Error processing awareness update: ${error}`);
        }
        break;
      }
      case 4: { // Sync status request - send if the client is in sync with the server
        try {
          // Read client's state vector
          const stateVector = decoding.readVarUint8Array(decoder);
          
          // Create a diff update based on the client's state vector
          const diffUpdate = Y.encodeStateAsUpdate(doc, stateVector);
          
          // Send response indicating if the client is in sync
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, 4); // Message type 4 = sync status response
          encoding.writeVarUint(encoder, diffUpdate.length === 0 ? 1 : 0); // 1 = in sync, 0 = needs updates
          ws.send(encoding.toUint8Array(encoder));
          
          console.log(`[SYNC STATUS] Client ${clientId} is ${diffUpdate.length === 0 ? 'in sync' : 'out of sync'}`);
        } catch (error) {
          console.error(`[SYNC STATUS] Error processing sync status request: ${error}`);
        }
        break;
      }
      default:
        console.warn(`Unknown message type: ${messageType}`);
    }
  }

  /**
   * Send update to all clients subscribed to a document
   */
  private broadcastDocumentUpdate(
    subscribers: Set<WebSocket>,
    update: Uint8Array,
    excluded: WebSocket | null = null
  ): void {
    if (!subscribers || subscribers.size === 0) return;

    const message = encoding.createEncoder();
    encoding.writeVarUint(message, 0); // Message type 0 = sync
    encoding.writeVarUint8Array(message, update);
    const messageBuffer = encoding.toUint8Array(message);

    subscribers.forEach(client => {
      if (client !== excluded && client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageBuffer);
        } catch (err) {
          console.error('Error broadcasting document update:', err);
        }
      }
    });
  }
} 