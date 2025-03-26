import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { supabase } from '../config/supabase';
import { 
  getYjsDocument, 
  storeYjsDocument, 
  storeYjsUpdate, 
  getYjsUpdates, 
  createDocumentSnapshot,
  recoverDocumentFromUpdates,
  getDocumentStats
} from './yjsService';

const CALLBACK_DEBOUNCE_WAIT = 2000;
const CALLBACK_DEBOUNCE_MAXWAIT = 10000;
const SNAPSHOT_INTERVAL = 5 * 60 * 1000; // Create snapshots every 5 minutes

type YjsWSMessage = {
  type: 'sync' | 'awareness' | 'auth';
  data?: Uint8Array;
  [key: string]: any;
};

// Map of all active documents, document-id -> Y.Doc instance
const docs = new Map<string, Y.Doc>();

// Map of all active document awareness states, document-id -> awarenessProtocol.Awareness
const documentAwareness = new Map<string, awarenessProtocol.Awareness>();

// Map of all active document subscribers, document-id -> WebSocket[]
const documentSubscribers = new Map<string, Set<WebSocket>>();

// Map of clients to their associated document and user info
const clients = new Map<WebSocket, { documentId: string; userId: string; clientId: number }>();

// Map of active snapshot timers, document-id -> NodeJS.Timeout
const snapshotTimers = new Map<string, NodeJS.Timeout>();

// Get or create Y.Doc instance for a document
const getYDoc = async (documentId: string): Promise<Y.Doc> => {
  // Return existing document if available
  const existingDoc = docs.get(documentId);
  if (existingDoc) return existingDoc;

  // Create new Y.Doc
  const doc = new Y.Doc();
  docs.set(documentId, doc);

  // Initialize document awareness state
  const awareness = new awarenessProtocol.Awareness(doc);
  documentAwareness.set(documentId, awareness);

  // Try to load document state from database
  let persistedState = await getYjsDocument(documentId);
  
  // If no document found, try to recover from updates
  if (!persistedState) {
    console.log(`No document snapshot found for ${documentId}, attempting recovery from updates...`);
    const recoveredDoc = await recoverDocumentFromUpdates(documentId);
    if (recoveredDoc) {
      console.log(`Successfully recovered document ${documentId} from updates`);
      // We don't need to apply state as recoverDocumentFromUpdates returns a new doc with updates applied
      // Instead, we'll use this doc and discard our empty one
      docs.set(documentId, recoveredDoc);
      return recoveredDoc;
    } else {
      console.log(`No updates found for document ${documentId}, starting fresh`);
    }
  } else {
    // Apply stored state to the document
    Y.applyUpdate(doc, persistedState);
    console.log(`Loaded document ${documentId} from database`);
  }

  // Set up subscribers set
  documentSubscribers.set(documentId, new Set());

  // Set up document change handlers
  setupDocumentChangeHandlers(doc, documentId);
  
  // Setup periodic snapshot creation
  setupSnapshotTimer(doc, documentId);

  return doc;
};

// Set up document change handlers for persistence
const setupDocumentChangeHandlers = (doc: Y.Doc, documentId: string) => {
  // Debounced version to prevent too frequent updates
  let updateTimeout: NodeJS.Timeout | null = null;
  let updatePending = false;

  // Handle document updates
  doc.on('update', (update: Uint8Array, origin: any) => {
    // Store update in the database
    const clientId = typeof origin === 'number' ? origin : doc.clientID;
    // Using store.getStateVector would cause a TypeScript error, so we use a more generic approach
    const version = Date.now(); // Use timestamp as version for simplicity
    storeYjsUpdate(documentId, update, clientId.toString(), version);

    // Debounce full document state persistence
    if (!updateTimeout) {
      updateTimeout = setTimeout(() => {
        if (updatePending) {
          // Create a snapshot of the full document
          const snapshot = Y.encodeStateAsUpdate(doc);
          storeYjsDocument(documentId, snapshot, version);
          updatePending = false;
          updateTimeout = null;
        }
      }, CALLBACK_DEBOUNCE_WAIT);
    }
    updatePending = true;
  });
};

// Set up periodic snapshot creation
const setupSnapshotTimer = (doc: Y.Doc, documentId: string) => {
  // Clear any existing timer
  if (snapshotTimers.has(documentId)) {
    clearInterval(snapshotTimers.get(documentId)!);
  }
  
  // Create a new timer
  const timer = setInterval(async () => {
    try {
      // Only create a snapshot if there are active subscribers
      const subscribers = documentSubscribers.get(documentId);
      if (subscribers && subscribers.size > 0) {
        console.log(`Creating periodic snapshot for document ${documentId}`);
        await createDocumentSnapshot(documentId, doc);
        
        // Log document statistics periodically
        const stats = await getDocumentStats(documentId);
        if (stats) {
          console.log(`Document ${documentId} stats:`, {
            documentSize: `${(stats.documentSize / 1024).toFixed(2)} KB`,
            updatesCount: stats.updatesCount,
            totalUpdatesSize: `${(stats.totalUpdatesSize / 1024).toFixed(2)} KB`,
          });
        }
      }
    } catch (err) {
      console.error(`Error creating periodic snapshot for document ${documentId}:`, err);
    }
  }, SNAPSHOT_INTERVAL);
  
  snapshotTimers.set(documentId, timer);
};

// Send update to all clients subscribed to a document
const broadcastDocumentUpdate = (documentId: string, update: Uint8Array, excluded: WebSocket | null = null) => {
  const subscribers = documentSubscribers.get(documentId);
  if (!subscribers) return;

  const message = encoding.createEncoder();
  encoding.writeVarUint(message, 0); // Message type 0 = sync
  encoding.writeVarUint8Array(message, update);
  const messageBuffer = encoding.toUint8Array(message);

  subscribers.forEach(client => {
    if (client !== excluded && client.readyState === WebSocket.OPEN) {
      client.send(messageBuffer);
    }
  });
};

// Send awareness update to all clients
const broadcastAwarenessUpdate = (
  documentId: string,
  awareness: awarenessProtocol.Awareness,
  changedClients: number[],
  excluded: WebSocket | null = null
) => {
  const subscribers = documentSubscribers.get(documentId);
  if (!subscribers) return;

  const message = encoding.createEncoder();
  encoding.writeVarUint(message, 1); // Message type 1 = awareness
  encoding.writeVarUint8Array(message, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
  const messageBuffer = encoding.toUint8Array(message);

  subscribers.forEach(client => {
    if (client !== excluded && client.readyState === WebSocket.OPEN) {
      client.send(messageBuffer);
    }
  });
};

// Process an incoming message from a client
const processMessage = async (ws: WebSocket, message: Uint8Array) => {
  const clientInfo = clients.get(ws);
  if (!clientInfo) {
    console.error('Received message from unauthenticated client');
    return;
  }

  const { documentId, userId } = clientInfo;
  const doc = await getYDoc(documentId);
  const awareness = documentAwareness.get(documentId);

  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case 0: { // Sync step 1: Client sends its state vector to request missing updates
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 1); // Message type 1 = sync step 2
      syncProtocol.writeSyncStep2(encoder, doc, decoding.readVarUint8Array(decoder));
      ws.send(encoding.toUint8Array(encoder));
      break;
    }
    case 1: { // Sync step 2: Server responds with missing updates (handled by client)
      syncProtocol.readSyncStep2(decoder, doc, new Uint8Array());
      break;
    }
    case 2: { // Sync step 3: Client sends its updates to the server
      const update = decoding.readVarUint8Array(decoder);
      Y.applyUpdate(doc, update, ws);
      // Broadcast the update to all other clients
      broadcastDocumentUpdate(documentId, update, ws);
      break;
    }
    case 3: { // Awareness update
      if (!awareness) break;
      const awarenessUpdate = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(awareness, awarenessUpdate, ws);
      break;
    }
    default:
      console.warn(`Unknown message type: ${messageType}`);
  }
};

// Handle WebSocket connection
const handleConnection = async (ws: WebSocket, req: http.IncomingMessage) => {
  // Extract token from URL query parameters
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const documentId = url.searchParams.get('document');

  if (!token || !documentId) {
    ws.close(1008, 'Missing token or document ID');
    return;
  }

  try {
    // Authenticate the user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      ws.close(1008, 'Authentication failed');
      return;
    }

    // Set up the Y.Doc for this document
    const doc = await getYDoc(documentId);
    const awareness = documentAwareness.get(documentId);

    // Store client information
    clients.set(ws, {
      documentId,
      userId: user.id,
      clientId: doc.clientID
    });

    // Add client to document subscribers
    const subscribers = documentSubscribers.get(documentId);
    if (subscribers) {
      subscribers.add(ws);
    }

    console.log(`Client connected: ${user.id} to document: ${documentId}`);

    // Send initial sync
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // Message type 0 = sync step 1
    syncProtocol.writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));

    // Send initial awareness state if available
    if (awareness) {
      const awarenessStates = Array.from(awareness.getStates().keys());
      if (awarenessStates.length > 0) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 3); // Message type 3 = awareness
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, awarenessStates));
        ws.send(encoding.toUint8Array(encoder));
      }

      // Set up awareness handlers for this client
      awareness.on('update', ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }) => {
        const changedClients = [...added, ...updated, ...removed];
        broadcastAwarenessUpdate(documentId, awareness, changedClients, null);
      });
    }

    // Handle messages from client
    ws.on('message', ((messageData: Buffer) => {
      processMessage(ws, new Uint8Array(messageData));
    }) as any);

    // Handle client disconnect
    ws.on('close', (() => {
      const clientInfo = clients.get(ws);
      if (!clientInfo) return;

      const { documentId } = clientInfo;
      
      // Remove client from subscribers
      const subscribers = documentSubscribers.get(documentId);
      if (subscribers) {
        subscribers.delete(ws);
        
        // If no more subscribers, clean up document resources
        if (subscribers.size === 0) {
          cleanupDocument(documentId);
        }
      }
      
      // Remove client from awareness
      if (awareness) {
        awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], null);
      }
      
      // Remove client from clients map
      clients.delete(ws);
      
      console.log(`Client disconnected from document: ${documentId}`);
    }) as any);
  } catch (err) {
    console.error(`Error handling connection for document ${documentId}:`, err);
    ws.close(1011, 'Internal server error');
  }
};

// Clean up resources when a document has no more subscribers
const cleanupDocument = async (documentId: string) => {
  const subscribers = documentSubscribers.get(documentId);
  if (!subscribers || subscribers.size > 0) {
    return; // Document still has subscribers
  }
  
  console.log(`Cleaning up document ${documentId} resources`);
  
  // Create final snapshot before cleanup
  const doc = docs.get(documentId);
  if (doc) {
    // Create a final snapshot
    const snapshot = Y.encodeStateAsUpdate(doc);
    const version = Date.now();
    await storeYjsDocument(documentId, snapshot, version);
    
    // Remove from docs map
    docs.delete(documentId);
  }
  
  // Clear awareness state
  documentAwareness.delete(documentId);
  
  // Clear subscribers set
  documentSubscribers.delete(documentId);
  
  // Clear snapshot timer
  if (snapshotTimers.has(documentId)) {
    clearInterval(snapshotTimers.get(documentId)!);
    snapshotTimers.delete(documentId);
  }
  
  console.log(`Document ${documentId} resources cleaned up`);
};

// Export the initialization function with proper cleanup
export const initYjsWebSocketServer = (httpServer: http.Server) => {
  const wss = new WebSocketServer({ noServer: true });
  
  // Handle WebSocket connections
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/yjs')) {
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
      });
    }
  });
  
  wss.on('connection', handleConnection);
  
  // Handle server shutdown
  httpServer.on('close', async () => {
    console.log('Server closing, creating final snapshots for all documents');
    
    // Create final snapshots for all documents
    for (const [documentId, doc] of docs.entries()) {
      try {
        const snapshot = Y.encodeStateAsUpdate(doc);
        const version = Date.now();
        await storeYjsDocument(documentId, snapshot, version);
        console.log(`Created final snapshot for document ${documentId}`);
      } catch (err) {
        console.error(`Error creating final snapshot for document ${documentId}:`, err);
      }
    }
    
    // Clear all snapshot timers
    for (const timer of snapshotTimers.values()) {
      clearInterval(timer);
    }
    snapshotTimers.clear();
    
    // Close all WebSocket connections
    wss.clients.forEach(client => {
      client.close(1001, 'Server shutting down');
    });
    
    // Close the WebSocket server
    wss.close();
  });
  
  console.log('Yjs WebSocket server initialized');
  return wss;
}; 