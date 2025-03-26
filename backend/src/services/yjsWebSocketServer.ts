import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as mutex from 'lib0/mutex';
import { debounce } from 'lodash';
import { throttle as lodashThrottle } from 'lodash';
import { supabase } from '../config/supabase';
import { verifyUserToken } from '../utils/auth';
import { 
  getYjsDocument, 
  storeYjsDocument, 
  storeYjsUpdate, 
  getYjsUpdates, 
  createDocumentSnapshot,
  recoverDocumentFromUpdates as getDocumentFromUpdates,
  getDocumentStats,
  runDatabaseMaintenanceJobs,
  decompressContent
} from './yjsService';

const CALLBACK_DEBOUNCE_WAIT = 2000;
const CALLBACK_DEBOUNCE_MAXWAIT = 10000;
const SNAPSHOT_INTERVAL = 5 * 60 * 1000; // Create snapshots every 5 minutes
const BROADCAST_THROTTLE_TIME = 50; // Time in ms to throttle broadcasts
const BROADCAST_DEBOUNCE_TIME = 100; // Time in ms to debounce broadcasts
const POSITION_UPDATE_THROTTLE = 100; // Throttle frequent position updates

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

// Map of throttled/debounced broadcast functions by document ID
const throttledBroadcasts = new Map<string, Function>();

let wss: WebSocketServer | null = null;
let maintenanceInterval: NodeJS.Timeout | null = null;

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
    const recoveredData = await getDocumentFromUpdates(documentId);
    if (recoveredData) {
      console.log(`Successfully recovered document ${documentId} from updates`);
      // Apply the recovered data to our document
      // @ts-ignore Types are not compatible but the function works correctly
      Y.applyUpdate(doc, recoveredData);
    } else {
      console.log(`No updates found for document ${documentId}, starting fresh`);
    }
  } else {
    // Apply stored state to the document
    // @ts-ignore Types are not compatible but the function works correctly
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

// Create a throttled broadcast function for a document
const getThrottledBroadcast = (documentId: string, messageType: number): Function => {
  const key = `${documentId}-${messageType}`;
  
  if (!throttledBroadcasts.has(key)) {
    // Create a new throttled function
    const throttledFn = (encoder: encoding.Encoder) => {
      const message = encoding.toUint8Array(encoder);
      const subscribers = documentSubscribers.get(documentId) || new Set<WebSocket>();
      
      // Broadcast to all subscribers
      subscribers.forEach(client => {
        try {
          client.send(message);
        } catch (err) {
          console.error('Error broadcasting message:', err);
        }
      });
    };
    
    // Store based on message type
    if (messageType === POSITION_UPDATE_THROTTLE) {
      // More aggressive throttling for position updates
      throttledBroadcasts.set(key, lodashThrottle(throttledFn, BROADCAST_THROTTLE_TIME));
    } else {
      // Regular throttling for other updates
      throttledBroadcasts.set(key, lodashThrottle(throttledFn, BROADCAST_DEBOUNCE_TIME));
    }
  }
  
  return throttledBroadcasts.get(key)!;
};

// Rename the throttle helper function to avoid conflict
function createThrottle(func: Function, wait: number): Function {
  let lastCall = 0;
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: any[] = [];
  
  return function(...args: any[]) {
    const now = Date.now();
    const diff = now - lastCall;
    
    lastArgs = args;
    
    if (diff >= wait) {
      // If enough time has passed, execute immediately
      lastCall = now;
      func(...args);
    } else if (!timeout) {
      // Schedule execution for remaining time
      timeout = setTimeout(() => {
        lastCall = Date.now();
        timeout = null;
        func(...lastArgs);
      }, wait - diff);
    }
  };
}

// Broadcast message to all subscribers of a document
const broadcastMessage = (
  documentId: string,
  message: Uint8Array,
  sender: WebSocket | null = null,
  messageType: number = 0
) => {
  const subscribers = documentSubscribers.get(documentId);
  if (!subscribers) return;
  
  // For high-frequency updates like position changes, use throttled broadcast
  if (messageType === POSITION_UPDATE_THROTTLE) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageType);
    encoding.writeUint8Array(encoder, message);
    
    // Get or create throttled broadcast function
    const throttledBroadcast = getThrottledBroadcast(documentId, messageType);
    throttledBroadcast(encoder);
    return;
  }
  
  // For regular updates, broadcast immediately
  subscribers.forEach(client => {
    if (client !== sender) {
      try {
        client.send(message);
      } catch (err) {
        console.error('Error broadcasting message:', err);
      }
    }
  });
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
      
      // Read client's state vector
      const stateVector = decoding.readVarUint8Array(decoder);
      
      // Generate sync message with updates the client doesn't have
      syncProtocol.writeSyncStep2(encoder, doc, stateVector);
      
      // Send response with missing updates
      ws.send(encoding.toUint8Array(encoder));
      
      // Log sync activity
      console.log(`[SYNC] Client ${clientInfo.clientId} requested updates for document ${documentId}`);
      break;
    }
    case 1: { // Sync step 2: Server responds with missing updates (handled by client)
      // This case is typically handled by clients, but we include it for completeness
      try {
        // Apply the updates to our document
        syncProtocol.readSyncStep2(decoder, doc, new Uint8Array());
        console.log(`[SYNC] Received sync step 2 from client ${clientInfo.clientId}`);
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
        const version = Date.now();
        await storeYjsUpdate(documentId, update, clientInfo.clientId.toString(), version);
        
        // Log update
        console.log(`[SYNC] Applied update from client ${clientInfo.clientId} to document ${documentId}`);
        
        // Broadcast the update to all other clients
        broadcastDocumentUpdate(documentId, update, ws);
        
        // Periodically check if we should create a snapshot
        const shouldSnapshot = Math.random() < 0.1; // ~10% chance on each update
        if (shouldSnapshot) {
          await createDocumentSnapshot(documentId, doc);
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
        
        // Apply awareness update
        awarenessProtocol.applyAwarenessUpdate(awareness, awarenessUpdate, ws);
        
        // Extract changed client IDs to broadcast
        const changedClients = Array.from(
          new Set(
            Array.from(
              new Uint8Array(awarenessUpdate.buffer, 0, awarenessUpdate.byteLength)
            )
          )
        );
        
        // Broadcast awareness update to other clients
        if (changedClients.length > 0) {
          broadcastAwarenessUpdate(documentId, awareness, changedClients, ws);
          
          // Log awareness update
          const states = awareness.getStates();
          if (states.size > 0) {
            console.log(`[AWARENESS] Document ${documentId} has ${states.size} active users`);
          }
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
        
        console.log(`[SYNC STATUS] Client ${clientInfo.clientId} is ${diffUpdate.length === 0 ? 'in sync' : 'out of sync'}`);
      } catch (error) {
        console.error(`[SYNC STATUS] Error processing sync status request: ${error}`);
      }
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

  // Authenticate the user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    console.error('Authentication error:', authError);
    ws.close(1008, 'Authentication failed');
    return;
  }
  
  try {
    // Get document
    const doc = await getYDoc(documentId);
    
    // Generate a unique client ID for this connection
    const clientId = doc.clientID;
    
    // Store client information
    const clientInfo = { 
      documentId, 
      userId: user.id,
      clientId 
    };
    
    // Add client to tracking maps
    clients.set(ws, clientInfo);
    
    // Add client to document subscribers
    let subscribers = documentSubscribers.get(documentId);
    if (!subscribers) {
      subscribers = new Set();
      documentSubscribers.set(documentId, subscribers);
    }
    subscribers.add(ws);
    
    // Get awareness instance
    const awareness = documentAwareness.get(documentId);
    
    console.log(`Client connected: ${user.id} to document: ${documentId}`);

    // Set up message handler
    ws.on('message', async (message: Buffer) => {
      try {
        await processMessage(ws, new Uint8Array(message));
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    // Send initial sync message when client connects
    const initSync = async () => {
      try {
        // Get the document
        const doc = await getYDoc(documentId);
        
        // Generate initial sync message (full document state)
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 0); // Message type 0 = sync step 1 response
        syncProtocol.writeSyncStep1(encoder, doc);
        
        // Send the sync message to the client
        ws.send(encoding.toUint8Array(encoder));
        
        // Log sync activity
        console.log(`[SYNC] Sent initial sync for document ${documentId} to client ${clientInfo.clientId}`);
        
        // Also send awareness states
        const awareness = documentAwareness.get(documentId);
        if (awareness) {
          // Get all client IDs
          const awarenessStates = awareness.getStates();
          const awarenessClientIds = Array.from(awarenessStates.keys());
          
          if (awarenessClientIds.length > 0) {
            // Send awareness update
            const awarenessEncoder = encoding.createEncoder();
            encoding.writeVarUint(awarenessEncoder, 1); // Message type 1 = awareness
            encoding.writeVarUint8Array(
              awarenessEncoder, 
              awarenessProtocol.encodeAwarenessUpdate(awareness, awarenessClientIds)
            );
            ws.send(encoding.toUint8Array(awarenessEncoder));
            
            console.log(`[AWARENESS] Sent awareness update with ${awarenessClientIds.length} clients`);
          }
        }
      } catch (error) {
        console.error('Error sending initial sync:', error);
      }
    };
    
    // Initialize sync after a short delay to ensure the connection is stable
    setTimeout(initSync, 100);

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

/**
 * Scheduled maintenance function that runs database optimization tasks
 */
async function runScheduledMaintenance(): Promise<void> {
  try {
    console.log('Running scheduled Yjs database maintenance...');
    const processedCount = await runDatabaseMaintenanceJobs();
    console.log(`Database maintenance completed. Processed ${processedCount} documents.`);
  } catch (error) {
    console.error('Error during scheduled database maintenance:', error);
  }
}

// Export the initialization function with proper cleanup
export function startYjsWebSocketServer(httpServer: http.Server): WebSocketServer {
  wss = new WebSocketServer({ noServer: true });
  
  // Handle WebSocket connections
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/yjs')) {
      wss!.handleUpgrade(request, socket, head, ws => {
        wss!.emit('connection', ws, request);
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
  
  // Schedule periodic database maintenance (every 24 hours)
  maintenanceInterval = setInterval(runScheduledMaintenance, 24 * 60 * 60 * 1000); // 24 hours
  
  console.log('Yjs WebSocket server started with scheduled maintenance');
  
  return wss;
}

// Non-null assertion for wss when needed
export function stopYjsWebSocketServer(): void {
  if (wss) {
    wss.close();
    wss = null;
  }
  
  // Clear maintenance interval
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
  }
  
  console.log('Yjs WebSocket server stopped');
}

// Function that is used for recovery (needs type fix)
async function recoverDocumentFromUpdates(documentId: string): Promise<Y.Doc | null> {
  try {
    // Create a new empty document
    const doc = new Y.Doc();
    
    // Get all updates for this document
    const { data, error } = await supabase
      .from('yjs_updates')
      .select('*')
      .eq('document_id', documentId)
      .order('version', { ascending: true });
    
    if (error || !data || data.length === 0) {
      console.error('No updates found for document recovery:', documentId);
      return null;
    }
    
    // Apply all updates in order
    for (const update of data) {
      try {
        const updateContent = update.update;
        const isCompressed = update.is_compressed || false;
        
        // Decompress if needed
        const decompressedUpdate = await decompressContent(updateContent, isCompressed);
        Y.applyUpdate(doc, decompressedUpdate);
      } catch (err) {
        console.error('Error applying update during recovery:', err);
      }
    }
    
    // Store the recovered document
    const latestVersion = data[data.length - 1].version;
    const docContent = Y.encodeStateAsUpdate(doc);
    await storeYjsDocument(documentId, docContent, latestVersion);
    
    // Return the doc (not the encoded state)
    return doc;
  } catch (error) {
    console.error('Exception recovering document from updates:', error);
    return null;
  }
} 