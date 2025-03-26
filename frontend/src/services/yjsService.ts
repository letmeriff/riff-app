import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Node, Edge } from 'reactflow';
import { ChatNode } from './nodeService';
import { setupCanvasSyncProtocol } from '../utils/yjsSyncProtocol';

// Define document structure types for TypeScript
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

interface YjsAwarenessState {
  clientID: number;
  userId: string;
  user: { id: string };
  cursor?: { x: number; y: number };
  isTyping?: boolean;
  isOffline?: boolean;
}

let doc: Y.Doc | null = null;
let wsProvider: WebsocketProvider | null = null;
let dbProvider: IndexeddbPersistence | null = null;
let awareness: any | null = null;

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

  // Set up the WebSocket provider for real-time collaboration
  wsProvider = new WebsocketProvider(websocketUrl, canvasId, doc, {
    connect: true,
    params: { token: userId },  // Pass user token for authentication
  });
  
  // Store the provider globally for debugging
  (window as any).yjsWebsocketProvider = wsProvider;
  
  // Get awareness instance for user presence features
  awareness = wsProvider.awareness;
  
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
      } as Partial<YjsAwarenessState>);
    });
  }

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
export const updateAwareness = (state: Partial<YjsAwarenessState>) => {
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
    nodeY.set('node_id', chatNode.node_id);
    
    // Add to nodes collection
    nodes.set(nodeId, nodeY);
  } else {
    // Update existing node
    const nodeY = nodes.get(nodeId) as Y.Map<any>;
    const nodeYPosition = nodeY.get('position') as Y.Map<any>;
    
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
    const edgeY = new Y.Map();
    edgeY.set('id', edgeId);
    edgeY.set('source', reactFlowEdge.source);
    edgeY.set('target', reactFlowEdge.target);
    
    // Additional edge data if available
    if (reactFlowEdge.data) {
      const edgeYData = new Y.Map();
      Object.entries(reactFlowEdge.data).forEach(([key, value]) => {
        edgeYData.set(key, value);
      });
      edgeY.set('data', edgeYData);
    }
    
    edges.set(edgeId, edgeY);
  }
};

/**
 * Convert Yjs nodes to React Flow nodes
 */
export const getNodesFromYjs = (): Node[] => {
  if (!doc) throw new Error('Yjs document not initialized');
  
  const { nodes } = getYjsSharedTypes();
  const reactFlowNodes: Node[] = [];
  
  // Using a type assertion to handle type mismatch with forEach
  (nodes as any).forEach((nodeY: Y.Map<any>, id: string) => {
    const positionY = nodeY.get('position') as Y.Map<any>;
    const dataY = nodeY.get('data') as Y.Map<any>;
    
    reactFlowNodes.push({
      id,
      position: {
        x: positionY.get('x'),
        y: positionY.get('y')
      },
      type: 'chatNode',
      data: {
        label: dataY.get('title'),
        nodeId: nodeY.get('node_id'),
        model: dataY.get('model'),
        flavor: dataY.get('flavor'),
        description: dataY.get('description'),
        // Additional data will be populated by the canvas component
      }
    });
  });
  
  return reactFlowNodes;
};

/**
 * Convert Yjs edges to React Flow edges
 */
export const getEdgesFromYjs = (): Edge[] => {
  if (!doc) throw new Error('Yjs document not initialized');
  
  const { edges } = getYjsSharedTypes();
  const reactFlowEdges: Edge[] = [];
  
  // Using a type assertion to handle type mismatch with forEach
  (edges as any).forEach((edgeY: Y.Map<any>, id: string) => {
    reactFlowEdges.push({
      id,
      source: edgeY.get('source'),
      target: edgeY.get('target'),
      type: 'straight',
      animated: true,
      // Additional properties from Yjs edge if needed
    });
  });
  
  return reactFlowEdges;
};

/**
 * Clean up Yjs providers
 */
export const destroyYjsDocument = () => {
  if (wsProvider) {
    wsProvider.disconnect();
    wsProvider = null;
  }
  
  if (dbProvider) {
    dbProvider.destroy();
    dbProvider = null;
  }
  
  doc = null;
  awareness = null;
};

/**
 * Get all users currently connected to the document (awareness)
 */
export const getConnectedUsers = () => {
  if (!awareness) return [];
  
  const states = awareness.getStates();
  const users: any[] = [];
  
  states.forEach((state: any, clientId: number) => {
    if (state.user && state.userId) {
      users.push({
        clientId,
        userId: state.userId,
        user: state.user,
        // Include any other awareness state like cursor position, etc.
        cursor: state.cursor,
        isTyping: state.isTyping
      });
    }
  });
  
  return users;
};

/**
 * Subscribe to Yjs document changes
 */
export const subscribeToYjsChanges = (
  callback: (event: { changed: Map<string, any>; added: Map<string, any>; deleted: Map<string, any> }, source: string) => void
) => {
  if (!doc) throw new Error('Yjs document not initialized');
  
  const { nodes, edges } = getYjsSharedTypes();
  
  // Observe nodes
  nodes.observe((event: any) => {
    callback(event, 'nodes');
  });
  
  // Observe edges
  edges.observe((event: any) => {
    callback(event, 'edges');
  });
  
  return () => {
    nodes.unobserve(callback as any);
    edges.unobserve(callback as any);
  };
};

/**
 * Update a node's position in the Yjs document
 * Replaced custom vector clock with Yjs's CRDT algorithm
 */
export const updateNodePositionYjs = (nodeId: string, position: { x: number; y: number }) => {
  if (!doc) throw new Error('Yjs document not initialized');
  
  const { nodes } = getYjsSharedTypes();
  const nodeY = nodes.get(nodeId) as Y.Map<any>;
  
  if (nodeY) {
    try {
      // Get the position map from the node
      const positionY = nodeY.get('position') as Y.Map<any>;
      if (positionY) {
        // Update position coordinates
        // Yjs automatically handles the conflict resolution
        // No need for vector clocks anymore
        doc.transact(() => {
          positionY.set('x', position.x);
          positionY.set('y', position.y);
        }, doc.clientID); // Use clientID as origin to identify the source
      }
    } catch (error) {
      console.error(`Error updating node position in Yjs: ${error}`);
    }
  }
};

/**
 * Helper function to force a document sync with the server
 * Useful for ensuring all changes are synchronized
 */
export const forceDocumentSync = async (): Promise<boolean> => {
  if (!doc || !wsProvider) return false;
  
  try {
    // Only force sync if we're connected
    if (wsProvider.wsconnected) {
      // Create a small transaction to trigger sync
      const docRef = doc;
      docRef.transact(() => {
        const metadata = docRef.getMap('metadata');
        const lastSync = metadata.get('lastSync') || 0;
        metadata.set('lastSync', Date.now());
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error forcing document sync:', error);
    return false;
  }
};

/**
 * Check if there are pending changes that haven't been synced
 * Useful for UI indicators showing sync status
 */
export const hasPendingChanges = (): boolean => {
  if (!doc || !wsProvider) return false;
  
  // If we're not connected, and we have local changes, they're pending
  if (!wsProvider.wsconnected) {
    // This is a simplified check - in a real app you might want to 
    // compare the local and remote state vectors
    return true;
  }
  
  return false;
}; 