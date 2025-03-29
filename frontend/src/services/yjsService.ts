import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Node, Edge } from 'reactflow';
import { ChatNode } from './nodeService';
import { setupCanvasSyncProtocol } from '../utils/yjsSyncProtocol';
import { 
  initOfflineSupport, 
  getSyncStatus, 
  syncPendingChanges,
  registerOfflineChangeHandler,
  createConflictResolver,
  cleanupOfflineSupport,
  SyncStatus
} from '../utils/yjsOfflineSupport';
import { UserAwarenessState } from '../types/yjs';
import type { Awareness } from 'y-protocols/awareness';

// Define document structure types for TypeScript
// Commented out unused interfaces
/* 
interface YjsNodeData {
  title: string;
  model?: string;
  flavor?: string;
  description?: string;
  user_id: string;
  owner_id: string;
  created_at: string;
}

interface YjsPosition {
  x: number;
  y: number;
}

interface YjsEdgeData {
  origin_node_id: number;
  target_node_id: number;
  created_at: string;
}
*/

// Use the imported interface instead of redefining it
// interface YjsAwarenessState {
//   clientID: number;
//   userId: string;
//   user: { id: string };
//   cursor?: { x: number; y: number };
//   isTyping?: boolean;
//   isOffline?: boolean;
// }

let doc: Y.Doc | null = null;
let wsProvider: WebsocketProvider | null = null;
let dbProvider: IndexeddbPersistence | null = null;
let awareness: Awareness | null = null;

// Reference to the conflict resolver
let conflictResolver: { updateSyncedState: () => void; detectConflict: (update: Uint8Array) => boolean } | null = null;

// Flag to track if we have pending sync operations
// let hasPendingSyncOperations = false;

// Track offline changes
let offlineChangesCount = 0;
let offlineChangeHandler: (() => void) | null = null;

// Track last sync status
// let lastSyncStatus: SyncStatus | null = null;

/**
 * Initialize the Yjs document and providers
 * @param userId User ID for the current user
 * @param canvasId Canvas ID to connect to
 * @param websocketUrl WebSocket server URL
 */
export const initYjsDocument = (
  userId: string,
  canvasId: string,
  websocketUrl: string = 'ws://localhost:3001/yjs'
): Y.Doc => {
  // Create a new Y.Doc or return existing one
  if (doc) return doc;

  // Create a new Y.Doc with a unique ID
  doc = new Y.Doc();

  // Store the doc globally for debugging and for network adapter
  window.yjsDoc = doc;
  
  // Set up the WebSocket provider for real-time collaboration
  wsProvider = new WebsocketProvider(websocketUrl, canvasId, doc, {
    connect: true,
    params: { token: userId },  // Pass user token for authentication
  });
  
  // Store the provider globally for debugging
  window.yjsWebsocketProvider = wsProvider;
  
  // Get awareness instance for user presence features
  awareness = wsProvider.awareness as Awareness;
  
  // Set initial awareness state
  updateAwareness({
    clientID: doc.clientID,
    userId: userId,
    user: { id: userId }
  });

  // Set up IndexedDB provider for offline persistence
  dbProvider = new IndexeddbPersistence(canvasId, doc);
  
  // Setup the synchronization protocol
  if (wsProvider && dbProvider) {
    setupCanvasSyncProtocol(doc, wsProvider, dbProvider, (isOnline) => {
      console.log(`Sync protocol status changed: ${isOnline ? 'online' : 'offline'}`);
      // Update awareness with online/offline status
      updateAwareness({ 
        isOffline: !isOnline 
      } as Partial<UserAwarenessState>);
    });
    
    // Initialize enhanced offline support
    initOfflineSupport(doc, wsProvider, dbProvider, canvasId);
    
    // Set up conflict resolver
    conflictResolver = createConflictResolver(doc);
    
    // Register handler for offline changes
    offlineChangeHandler = registerOfflineChangeHandler(doc, (update, isOffline) => {
      if (isOffline) {
        offlineChangesCount++;
        console.log(`Offline change detected. Total offline changes: ${offlineChangesCount}`);
      }
    });
    
    // Schedule periodic sync status check
    const syncStatusCheckInterval = setInterval(() => {
      if (doc) {
        const status = getSyncStatus(canvasId);
        // lastSyncStatus = status;
        // hasPendingSyncOperations = status.pendingChanges;
        
        // Update UI awareness with sync status
        updateAwareness({
          isOffline: !status.isConnected || !status.isOnline,
          syncStatus: {
            // pendingChanges: status.pendingChanges,
            lastSyncedAt: status.lastSyncedAt,
            isReconnecting: status.isReconnecting
          }
        } as Partial<UserAwarenessState>);
      } else {
        clearInterval(syncStatusCheckInterval);
      }
    }, 2000);
    
    // Listen for sync completion
    wsProvider.on('sync', (isSynced: boolean) => {
      if (isSynced && conflictResolver) {
        // Update our synchronized state when in sync
        conflictResolver.updateSyncedState();
        
        // Reset offline changes counter
        offlineChangesCount = 0;
      }
    });
  }

  // Listen for document changes
  subscribeToYjsChanges((changes, source) => {
    console.log(`Yjs document changed (${source}):`, changes);
  });

  return doc;
};

/**
 * Get shared data types from the Yjs document
 */
export const getYjsSharedTypes = () => {
  if (!doc) throw new Error('Yjs document not initialized');

  // Get or create shared data structures
  const nodes = doc.getMap('nodes');
  const edges = doc.getMap('edges');
  const metadata = doc.getMap('metadata');

  return { nodes, edges, metadata };
};

/**
 * Set the user's awareness state (cursor position, etc.)
 */
export const updateAwareness = (state: Partial<UserAwarenessState>) => {
  if (!awareness) throw new Error('Yjs awareness not initialized');
  
  // Get current state
  const currentState = awareness.getLocalState() || {};
  
  // Update with new state
  awareness.setLocalState({ ...currentState, ...state });
};

/**
 * Map a React Flow node to the Yjs document
 */
export const mapNodeToYjs = (reactFlowNode: Node, chatNode: ChatNode) => {
  if (!doc) throw new Error('Yjs document not initialized');
  
  const { nodes } = getYjsSharedTypes();
  const nodeId = reactFlowNode.id;
  
  // Create node in Yjs if it doesn't exist
  if (!nodes.has(nodeId)) {
    // Create position map
    const nodeYPosition = new Y.Map();
    nodeYPosition.set('x', reactFlowNode.position.x);
    nodeYPosition.set('y', reactFlowNode.position.y);
    
    // Create data map
    const nodeYData = new Y.Map();
    nodeYData.set('title', chatNode.title);
    nodeYData.set('model', chatNode.model || '');
    nodeYData.set('flavor', chatNode.flavor || '');
    nodeYData.set('description', chatNode.description || 'No description available.');
    nodeYData.set('user_id', chatNode.user_id);
    nodeYData.set('owner_id', chatNode.owner_id);
    nodeYData.set('created_at', chatNode.created_at);
    
    // Create the full node structure
    const nodeY = new Y.Map();
    nodeY.set('id', nodeId);
    nodeY.set('position', nodeYPosition);
    nodeY.set('data', nodeYData);
    // Convert to string to ensure type compatibility
    nodeY.set('node_id', String(chatNode.node_id));
    
    // Add to nodes collection
    nodes.set(nodeId, nodeY);
  } else {
    // Update existing node
    const nodeY = nodes.get(nodeId) as Y.Map<unknown>;
    const nodeYPosition = nodeY.get('position') as Y.Map<unknown>;
    
    // Update position
    nodeYPosition.set('x', reactFlowNode.position.x);
    nodeYPosition.set('y', reactFlowNode.position.y);
  }
};

/**
 * Map a React Flow edge to the Yjs document
 */
export const mapEdgeToYjs = (reactFlowEdge: Edge) => {
  if (!doc) throw new Error('Yjs document not initialized');
  
  const { edges } = getYjsSharedTypes();
  const edgeId = reactFlowEdge.id;
  
  // Create edge in Yjs if it doesn't exist
  if (!edges.has(edgeId)) {
    // Create the edge structure
    const edgeY = new Y.Map();
    edgeY.set('id', edgeId);
    edgeY.set('source', reactFlowEdge.source);
    edgeY.set('target', reactFlowEdge.target);
    
    // Add to edges collection
    edges.set(edgeId, edgeY);
  }
};

/**
 * Get all nodes from the Yjs document, convert to React Flow format
 */
export const getNodesFromYjs = (): Node[] => {
  if (!doc) throw new Error('Yjs document not initialized');
  
  const { nodes } = getYjsSharedTypes();
  const reactFlowNodes: Node[] = [];
  
  // Convert each Yjs node to a React Flow node
  nodes.forEach((nodeY, id) => {
    const nodeYMap = nodeY as Y.Map<unknown>;
    const positionYMap = nodeYMap.get('position') as Y.Map<unknown>;
    const dataYMap = nodeYMap.get('data') as Y.Map<unknown>;
    
    // Only create node if all required data is present
    if (nodeYMap && positionYMap && dataYMap) {
      const node: Node = {
        id,
        position: {
          x: positionYMap.get('x') as number,
          y: positionYMap.get('y') as number
        },
        data: {
          title: dataYMap.get('title') as string,
          model: dataYMap.get('model') as string,
          flavor: dataYMap.get('flavor') as string,
          description: dataYMap.get('description') as string,
          user_id: dataYMap.get('user_id') as string,
          owner_id: dataYMap.get('owner_id') as string,
          created_at: dataYMap.get('created_at') as string,
          node_id: nodeYMap.get('node_id') as string,
        },
        type: 'chatNode',
      };
      
      reactFlowNodes.push(node);
    }
  });
  
  return reactFlowNodes;
};

/**
 * Get all edges from the Yjs document, convert to React Flow format
 */
export const getEdgesFromYjs = (): Edge[] => {
  if (!doc) throw new Error('Yjs document not initialized');
  
  const { edges } = getYjsSharedTypes();
  const reactFlowEdges: Edge[] = [];
  
  // Convert each Yjs edge to a React Flow edge
  edges.forEach((edgeY, id) => {
    const edgeYMap = edgeY as Y.Map<unknown>;
    
    if (edgeYMap) {
      const edge: Edge = {
        id,
        source: edgeYMap.get('source') as string,
        target: edgeYMap.get('target') as string,
        type: 'chatEdge',
      };
      
      reactFlowEdges.push(edge);
    }
  });
  
  return reactFlowEdges;
};

/**
 * Clean up Yjs document and providers
 */
export const destroyYjsDocument = () => {
  if (offlineChangeHandler) {
    offlineChangeHandler();
    offlineChangeHandler = null;
  }
  
  // Clean up offline support
  if (doc && wsProvider && dbProvider) {
    cleanupOfflineSupport(doc.guid);
  }
  
  // Disconnect WebSocket provider
  if (wsProvider) {
    wsProvider.disconnect();
    wsProvider.destroy();
    wsProvider = null;
  }
  
  // Close IndexedDB connection
  if (dbProvider) {
    dbProvider.destroy();
    dbProvider = null;
  }
  
  // Clean up document
  if (doc) {
    doc.destroy();
    doc = null;
  }
  
  // Reset state
  awareness = null;
  conflictResolver = null;
  offlineChangesCount = 0;
  
  // Remove global references
  delete window.yjsDoc;
  delete window.yjsWebsocketProvider;
};

/**
 * Get list of connected users from awareness state
 */
export const getConnectedUsers = () => {
  if (!awareness) return [];
  
  const states = awareness.getStates();
  const users: Record<string, UserAwarenessState> = {};
  
  // Collect unique users
  Object.entries(states).forEach(([_, state]) => {
    const userState = state as UserAwarenessState;
    if (userState.user?.id && !userState.isOffline) {
      users[userState.user.id] = userState;
    }
  });
  
  return Object.values(users);
};

/**
 * Subscribe to Yjs document changes
 */
export const subscribeToYjsChanges = (
  callback: (event: { 
    changed: Map<string, unknown>; 
    added: Map<string, unknown>; 
    deleted: Map<string, unknown> 
  }, source: string) => void
) => {
  if (!doc) throw new Error('Yjs document not initialized');
  
  const { nodes, edges } = getYjsSharedTypes();
  
  // Subscribe to node changes
  const nodeObserver = (event: Y.YMapEvent<unknown>) => {
    // Creating a simpler event object structure for the callback
    const changedMap = new Map<string, unknown>();
    const addedMap = new Map<string, unknown>();
    const deletedMap = new Map<string, unknown>();
    
    // Process all changed keys
    event.keysChanged.forEach((_, key) => {
      const keyStr = key as string;
      
      // If node still exists, it was added or updated
      if (nodes.has(keyStr)) {
        const value = nodes.get(keyStr);
        addedMap.set(keyStr, value);
        changedMap.set(keyStr, value);
      } else {
        // Node no longer exists, it was deleted
        deletedMap.set(keyStr, null);
      }
    });
    
    callback({
      changed: changedMap,
      added: addedMap,
      deleted: deletedMap
    }, 'nodes');
  };
  
  // Subscribe to edge changes
  const edgeObserver = (event: Y.YMapEvent<unknown>) => {
    // Creating a simpler event object structure for the callback
    const changedMap = new Map<string, unknown>();
    const addedMap = new Map<string, unknown>();
    const deletedMap = new Map<string, unknown>();
    
    // Process all changed keys
    event.keysChanged.forEach((_, key) => {
      const keyStr = key as string;
      
      // If edge still exists, it was added or updated
      if (edges.has(keyStr)) {
        const value = edges.get(keyStr);
        addedMap.set(keyStr, value);
        changedMap.set(keyStr, value);
      } else {
        // Edge no longer exists, it was deleted
        deletedMap.set(keyStr, null);
      }
    });
    
    callback({
      changed: changedMap,
      added: addedMap,
      deleted: deletedMap
    }, 'edges');
  };
  
  // Start observing changes
  nodes.observe(nodeObserver);
  edges.observe(edgeObserver);
  
  // Return cleanup function
  return () => {
    nodes.unobserve(nodeObserver);
    edges.unobserve(edgeObserver);
  };
};

/**
 * Update a node's position in the Yjs document
 */
export const updateNodePositionYjs = (nodeId: string, position: { x: number; y: number }) => {
  if (!doc) throw new Error('Yjs document not initialized');
  
  const { nodes } = getYjsSharedTypes();
  const nodeY = nodes.get(nodeId) as Y.Map<unknown> | undefined;
  
  if (nodeY) {
    const positionY = nodeY.get('position') as Y.Map<unknown>;
    
    if (positionY) {
      positionY.set('x', position.x);
      positionY.set('y', position.y);
    }
  }
};

/**
 * Force synchronization of the Yjs document with server
 */
export const forceDocumentSync = async (): Promise<boolean> => {
  if (!doc || !wsProvider) {
    console.error('Cannot sync - document or provider not initialized');
    return false;
  }
  
  // Check if we're online
  if (!wsProvider.wsconnected) {
    console.warn('Cannot sync - not connected to WebSocket server');
    return false;
  }
  
  try {
    // Try to sync pending changes with proper types
    const result = await syncPendingChanges(doc.guid, wsProvider, dbProvider);
    
    if (result) {
      console.log('Document synced successfully');
      offlineChangesCount = 0;
      
      // Update awareness
      updateAwareness({
        isOffline: false,
      } as Partial<UserAwarenessState>);
      
      return true;
    } else {
      console.warn('Document sync attempted but not confirmed');
      return false;
    }
  } catch (error) {
    console.error('Error during document sync:', error);
    return false;
  }
};

/**
 * Check if there are pending changes to be synced
 */
export const hasPendingChanges = (): boolean => {
  if (!doc) return false;
  
  const status = getSyncStatus(doc.guid);
  
  return status.pendingChanges;
};

/**
 * Get count of changes made while offline
 */
export const getOfflineChangesCount = (): number => {
  return offlineChangesCount;
};

/**
 * Get current synchronization status
 */
export const getSynchronizationStatus = (): SyncStatus | null => {
  if (!doc) return null;
  
  return getSyncStatus(doc.guid);
};

/**
 * Detect conflicts between local and remote updates
 */
export const detectConflicts = (remoteUpdate: Uint8Array): boolean => {
  if (!conflictResolver) return false;
  
  return conflictResolver.detectConflict(remoteUpdate);
}; 