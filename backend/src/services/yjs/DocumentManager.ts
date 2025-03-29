import * as Y from 'yjs';
import { WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import { getYjsDocument, storeYjsDocument } from '../yjsService';

/**
 * Manages YJS documents and their lifecycle
 */
export class DocumentManager {
  // Map of all active documents, document-id -> Y.Doc instance
  private docs = new Map<string, Y.Doc>();

  // Map of all active document awareness states, document-id -> awarenessProtocol.Awareness
  private documentAwareness = new Map<string, awarenessProtocol.Awareness>();

  // Map of all active document subscribers, document-id -> WebSocket[]
  private documentSubscribers = new Map<string, Set<WebSocket>>();

  // Map of clients to their associated document and user info
  private clients = new Map<WebSocket, { documentId: string; userId: string; clientId: number }>();

  // Map of active snapshot timers, document-id -> NodeJS.Timeout
  private snapshotTimers = new Map<string, NodeJS.Timeout>();

  constructor() {}

  /**
   * Get or create Y.Doc instance for a document
   */
  async getDocument(documentId: string): Promise<Y.Doc> {
    // Return existing document if available
    const existingDoc = this.docs.get(documentId);
    if (existingDoc) return existingDoc;

    // Create new Y.Doc
    const doc = new Y.Doc();
    this.docs.set(documentId, doc);

    // Initialize document awareness state
    const awareness = new awarenessProtocol.Awareness(doc);
    this.documentAwareness.set(documentId, awareness);

    // Try to load document state from database
    const persistedState = await getYjsDocument(documentId);
    
    // If document found, apply stored state to the document
    if (persistedState) {
      Y.applyUpdate(doc, persistedState);
      console.log(`Loaded document ${documentId} from database`);
    } else {
      console.log(`No persisted state found for document ${documentId}, starting fresh`);
    }

    // Set up subscribers set
    this.documentSubscribers.set(documentId, new Set());
    
    return doc;
  }

  /**
   * Register a client with a document
   */
  async registerClient(ws: WebSocket, documentId: string, userId: string): Promise<number> {
    // Get document
    const doc = await this.getDocument(documentId);
    
    // Generate a unique client ID for this connection
    const clientId = doc.clientID;
    
    // Store client information
    const clientInfo = { 
      documentId, 
      userId,
      clientId 
    };
    
    // Add client to tracking maps
    this.clients.set(ws, clientInfo);
    
    // Add client to document subscribers
    let subscribers = this.documentSubscribers.get(documentId);
    if (!subscribers) {
      subscribers = new Set();
      this.documentSubscribers.set(documentId, subscribers);
    }
    subscribers.add(ws);
    
    return clientId;
  }

  /**
   * Unregister a client when they disconnect
   */
  unregisterClient(ws: WebSocket): void {
    // Get client info
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) return;
    
    const { documentId, clientId } = clientInfo;
    
    // Remove from clients map
    this.clients.delete(ws);
    
    // Remove from subscribers
    const subscribers = this.documentSubscribers.get(documentId);
    if (subscribers) {
      subscribers.delete(ws);
      console.log(`Removed client from subscribers for document ${documentId}, ${subscribers.size} remaining`);
      
      // Check if we should clean up the document
      if (subscribers.size === 0) {
        this.cleanupDocument(documentId).catch(err => {
          console.error(`Error cleaning up document ${documentId}:`, err);
        });
      }
    }
    
    // Remove from awareness
    const awareness = this.documentAwareness.get(documentId);
    if (awareness) {
      // Remove client's awareness states
      awarenessProtocol.removeAwarenessStates(
        awareness,
        [clientId],
        'connection-closed'
      );
    }
    
    console.log(`Client disconnected from document: ${documentId}`);
  }

  /**
   * Get client info for a WebSocket
   */
  getClientInfo(ws: WebSocket): { documentId: string; userId: string; clientId: number } | undefined {
    return this.clients.get(ws);
  }

  /**
   * Get document awareness for a document
   */
  getAwareness(documentId: string): awarenessProtocol.Awareness | undefined {
    return this.documentAwareness.get(documentId);
  }

  /**
   * Get document subscribers for a document
   */
  getSubscribers(documentId: string): Set<WebSocket> | undefined {
    return this.documentSubscribers.get(documentId);
  }

  /**
   * Clean up resources when a document has no more subscribers
   */
  async cleanupDocument(documentId: string): Promise<void> {
    const subscribers = this.documentSubscribers.get(documentId);
    if (!subscribers || subscribers.size > 0) {
      return; // Document still has subscribers
    }
    
    console.log(`Cleaning up document ${documentId} resources`);
    
    // Create final snapshot before cleanup
    const doc = this.docs.get(documentId);
    if (doc) {
      // Create a final snapshot
      const snapshot = Y.encodeStateAsUpdate(doc);
      const version = Date.now();
      await storeYjsDocument(documentId, snapshot, version);
      
      // Remove from docs map
      this.docs.delete(documentId);
    }
    
    // Clear awareness state
    this.documentAwareness.delete(documentId);
    
    // Clear subscribers set
    this.documentSubscribers.delete(documentId);
    
    // Clear snapshot timer
    if (this.snapshotTimers.has(documentId)) {
      clearInterval(this.snapshotTimers.get(documentId)!);
      this.snapshotTimers.delete(documentId);
    }
    
    console.log(`Document ${documentId} resources cleaned up`);
  }

  /**
   * Clean up all documents
   */
  async cleanupAllDocuments(): Promise<void> {
    // Get all document IDs
    const documentIds = [...this.docs.keys()];
    
    // Clean up each document
    for (const documentId of documentIds) {
      await this.cleanupDocument(documentId);
    }
  }

  /**
   * Sets up a timer for periodic snapshots
   */
  setupSnapshotTimer(documentId: string, callback: () => Promise<void>, interval: number): void {
    // Clear any existing timer
    if (this.snapshotTimers.has(documentId)) {
      clearInterval(this.snapshotTimers.get(documentId)!);
    }
    
    // Create a new timer
    const timer = setInterval(callback, interval);
    this.snapshotTimers.set(documentId, timer);
  }
} 