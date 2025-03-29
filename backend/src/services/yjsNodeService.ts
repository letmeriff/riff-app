import * as Y from 'yjs';
import { supabase } from '../config/supabase';
import { getYjsDocument, storeYjsUpdate, createDocumentSnapshot } from './yjsService';

// Define interfaces for node data
interface _NodePosition {
  x: number;
  y: number;
  updatedAt: string;
  updatedBy: string;
}

interface NodePositionResult {
  success: boolean;
  data?: {
    nodeId: string;
    position: { x: number; y: number };
    updatedAt: string;
    updatedBy: string;
  };
}

/**
 * Apply a node position update using Yjs instead of custom CRDT
 * @param documentId The canvas document ID
 * @param nodeId The ID of the node being updated
 * @param position The new position {x, y}
 * @param userId The user making the update
 * @returns Success status and updated document data
 */
export const updateNodePositionYjs = async (
  documentId: string,
  nodeId: string,
  position: { x: number; y: number },
  userId: string
): Promise<NodePositionResult> => {
  try {
    // Validate inputs
    if (!documentId || !nodeId || !position || !userId) {
      console.error('Missing required parameters for updateNodePositionYjs');
      return { success: false };
    }
    
    const validX = isNaN(position.x) ? 0 : position.x;
    const validY = isNaN(position.y) ? 0 : position.y;
    
    console.log(`YJS: Updating position for node ${nodeId} to x=${validX}, y=${validY}`);
    
    // Get or initialize Yjs document
    let ydoc: Y.Doc;
    
    // Try to get existing document state
    const docState = await getYjsDocument(documentId);
    if (docState) {
      // Create document and apply state
      ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, docState);
    } else {
      // Initialize new document if none exists
      ydoc = new Y.Doc();
      console.log(`No existing document found for ${documentId}, creating new`);
    }
    
    // Access shared data structures
    const nodes = ydoc.getMap('nodes');
    
    // Get or create node in Yjs document
    let nodeMap: Y.Map<unknown>;
    if (nodes.has(nodeId)) {
      nodeMap = nodes.get(nodeId) as Y.Map<unknown>;
    } else {
      // Create a new node entry if it doesn't exist
      nodeMap = new Y.Map();
      nodes.set(nodeId, nodeMap);
    }
    
    // Get or create position data
    let positionMap: Y.Map<unknown>;
    if (nodeMap.has('position')) {
      positionMap = nodeMap.get('position') as Y.Map<unknown>;
    } else {
      positionMap = new Y.Map();
      nodeMap.set('position', positionMap);
    }
    
    // Update position in transaction to make it atomic
    ydoc.transact(() => {
      positionMap.set('x', validX);
      positionMap.set('y', validY);
      // Add last modified information
      positionMap.set('updatedAt', new Date().toISOString());
      positionMap.set('updatedBy', userId);
    });
    
    // Capture the update to store in database
    const update = Y.encodeStateAsUpdate(ydoc);
    
    // Store update in database
    const version = Date.now(); // Use timestamp as version
    await storeYjsUpdate(documentId, update, userId, version);
    
    // Periodically store full document snapshots
    // We'll do this less frequently in production, but for testing we'll do it on every update
    await createDocumentSnapshot(documentId, ydoc);
    
    // Also update the traditional database for backward compatibility
    // This allows existing code to still work during the transition
    const { error } = await supabase
      .from('chat_nodes')
      .update({
        position_x: validX,
        position_y: validY,
        position_updated_at: new Date().toISOString()
      })
      .eq('node_id', parseInt(nodeId))
      .select();
    
    if (error) {
      console.error('Error updating node position in traditional database:', error);
      // We still return success: true because the Yjs update succeeded
    }
    
    return {
      success: true,
      data: {
        nodeId,
        position: { x: validX, y: validY },
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      }
    };
  } catch (error) {
    console.error('Error in updateNodePositionYjs:', error);
    return { success: false };
  }
};

/**
 * Get node position from the Yjs document
 * @param documentId The canvas document ID
 * @param nodeId The node ID
 * @returns The node position or null if not found
 */
export const getNodePositionYjs = async (
  documentId: string,
  nodeId: string
): Promise<{ x: number; y: number } | null> => {
  try {
    // Get document state
    const docState = await getYjsDocument(documentId);
    if (!docState) return null;
    
    // Create document and apply state
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, docState);
    
    // Access nodes collection
    const nodes = ydoc.getMap('nodes');
    if (!nodes.has(nodeId)) return null;
    
    // Get node position
    const nodeMap = nodes.get(nodeId) as Y.Map<unknown>;
    if (!nodeMap.has('position')) return null;
    
    const positionMap = nodeMap.get('position') as Y.Map<unknown>;
    
    return {
      x: (positionMap.get('x') as number) || 0,
      y: (positionMap.get('y') as number) || 0
    };
  } catch (error) {
    console.error(`Error getting node position from Yjs:`, error);
    return null;
  }
};

/**
 * Convert node ID (number) to document-specific node ID (string)
 * This is used to create a unique ID for each node in the Yjs document
 */
export const getYjsNodeId = (nodeId: number): string => {
  return `node-${nodeId}`;
};

/**
 * Extract node ID (number) from Yjs node ID (string)
 */
export const extractNodeId = (yjsNodeId: string): number | null => {
  const matches = yjsNodeId.match(/^node-(\d+)$/);
  if (matches && matches[1]) {
    return parseInt(matches[1]);
  }
  return null;
}; 