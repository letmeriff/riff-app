/**
 * Yjs Service
 *
 * This module provides a class-based abstraction for Yjs operations
 */

import * as Y from 'yjs';
import { supabase } from '../config/supabase';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { GlobalIo } from './socketIoService';

/**
 * Service for managing Yjs documents in the database
 */

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Compression threshold in bytes
const COMPRESSION_THRESHOLD = 1024; // 1KB

/**
 * Type definitions for node position operations
 */
export interface NodePosition {
  x: number;
  y: number;
}

export interface NodePositionUpdate {
  nodeId: string;
  position: NodePosition;
  userId: string;
}

export interface NodePositionResult {
  success: boolean;
  data?: {
    updatedAt: string;
    [key: string]: unknown;
  };
}

/**
 * Compress document content if it exceeds threshold
 * @param content The binary content to compress
 * @returns Compressed content and flag indicating if it was compressed
 */
export const compressContent = async (
  content: Uint8Array
): Promise<{ data: Uint8Array; compressed: boolean }> => {
  if (content.length < COMPRESSION_THRESHOLD) {
    return { data: content, compressed: false };
  }

  try {
    const compressed = await gzip(Buffer.from(content));
    return {
      data: new Uint8Array(compressed),
      compressed: true,
    };
  } catch (error) {
    console.error('Error compressing document content:', error);
    return { data: content, compressed: false };
  }
};

/**
 * Decompress document content if it was compressed
 * @param content The binary content to decompress
 * @param isCompressed Flag indicating if content is compressed
 * @returns Original uncompressed content
 */
export const decompressContent = async (
  content: Uint8Array,
  isCompressed: boolean
): Promise<Uint8Array> => {
  if (!isCompressed) {
    return content;
  }

  try {
    const decompressed = await gunzip(Buffer.from(content));
    return new Uint8Array(decompressed);
  } catch (error) {
    console.error('Error decompressing document content:', error);
    return content;
  }
};

/**
 * Get a Yjs document by its ID
 * @param documentId The unique identifier for the document
 * @returns The document content as a Uint8Array or null if not found
 */
export const getYjsDocument = async (
  documentId: string
): Promise<Uint8Array | null> => {
  try {
    // Try to get the document snapshot
    const { data, error } = await supabase
      .from('yjs_documents')
      .select('*')
      .eq('document_id', documentId)
      .single();

    if (error || !data) {
      console.log(
        `No document snapshot found for ${documentId}, trying to recover from updates`
      );
      return await recoverDocumentFromUpdates(documentId);
    }

    // Decompress if needed
    const isCompressed = data.is_compressed || false;
    return await decompressContent(data.document_state, isCompressed);
  } catch (error) {
    console.error('Exception fetching Yjs document:', error);
    return null;
  }
};

/**
 * Store a Yjs document update with compression
 * @param documentId Document ID
 * @param update Document update
 * @param clientId Client ID
 * @param version Version number
 * @returns Success status
 */
export const storeYjsUpdate = async (
  documentId: string,
  update: Uint8Array,
  clientId: string = 'system',
  version: number = Date.now()
): Promise<boolean> => {
  try {
    // Compress the update if it's large
    const { data: compressedUpdate, compressed } =
      await compressContent(update);

    // Store in the database
    const { error } = await supabase.from('yjs_updates').insert({
      document_id: documentId,
      update: compressedUpdate,
      client_id: clientId,
      version: version,
      created_at: new Date().toISOString(),
      is_compressed: compressed,
    });

    if (error) {
      console.error('Error storing Yjs update:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception storing Yjs update:', error);
    return false;
  }
};

/**
 * Recover a document from its updates
 * @param documentId The document ID
 * @returns Encoded state as Uint8Array or null if recovery failed
 */
export const recoverDocumentFromUpdates = async (
  documentId: string
): Promise<Uint8Array | null> => {
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
        const decompressedUpdate = await decompressContent(
          updateContent,
          isCompressed
        );
        Y.applyUpdate(doc, decompressedUpdate);
      } catch (err) {
        console.error('Error applying update during recovery:', err);
      }
    }

    // Store the recovered document
    const latestVersion = data[data.length - 1].version;
    const docContent = Y.encodeStateAsUpdate(doc);
    await storeYjsDocument(documentId, docContent, latestVersion);

    // Return the encoded state
    return docContent;
  } catch (error) {
    console.error('Exception recovering document from updates:', error);
    return null;
  }
};

/**
 * Store a Yjs document snapshot with compression
 * @param documentId Document ID
 * @param documentState Document state
 * @param version Version number
 * @returns Success status
 */
export async function storeYjsDocument(
  documentId: string,
  documentState: Uint8Array,
  version: number
): Promise<boolean> {
  try {
    // Compress the document state
    const { data: compressedState, compressed } =
      await compressContent(documentState);

    // Check for existing document
    const { data: existingDoc } = await supabase
      .from('yjs_documents')
      .select('id')
      .eq('document_id', documentId)
      .single();

    if (existingDoc) {
      // Update existing document
      const { error } = await supabase
        .from('yjs_documents')
        .update({
          document_state: compressedState,
          version: version,
          updated_at: new Date().toISOString(),
          is_compressed: compressed,
        })
        .eq('document_id', documentId);

      if (error) {
        console.error('Error updating Yjs document:', error);
        return false;
      }
    } else {
      // Insert new document
      const { error } = await supabase.from('yjs_documents').insert({
        document_id: documentId,
        document_state: compressedState,
        version: version,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_compressed: compressed,
      });

      if (error) {
        console.error('Error storing Yjs document:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Exception storing Yjs document:', error);
    return false;
  }
}

/**
 * Create a document snapshot and clean up old updates
 * @param documentId The document ID
 * @param doc The Y.Doc instance
 * @returns Success status
 */
export async function createDocumentSnapshot(
  documentId: string,
  doc: Y.Doc
): Promise<boolean> {
  try {
    // Create a snapshot of the current document state
    const snapshot = Y.encodeStateAsUpdate(doc);
    const version = Date.now(); // Use timestamp as version

    // Store the snapshot
    const success = await storeYjsDocument(documentId, snapshot, version);
    if (!success) {
      return false;
    }

    // After successful snapshot, clean up old updates
    // We can now remove all updates older than the snapshot version
    const { error } = await supabase
      .from('yjs_updates')
      .delete()
      .eq('document_id', documentId)
      .lt('version', version);

    if (error) {
      console.error('Error cleaning up old updates after snapshot:', error);
      // Don't fail the whole operation if cleanup fails
    }

    return true;
  } catch (error) {
    console.error('Exception creating document snapshot:', error);
    return false;
  }
}

/**
 * YjsService class provides a clean abstraction for Yjs operations
 */
export class YjsService {
  private io: GlobalIo;

  /**
   * Initialize the service with Socket.IO instance
   * @param io Socket.IO server instance
   */
  constructor(io: GlobalIo) {
    this.io = io;
  }

  /**
   * Update a node position using Yjs
   * @param documentId The canvas document ID
   * @param nodeId The ID of the node being updated
   * @param position The new position {x, y}
   * @param userId The user making the update
   * @returns Success status and updated document data
   */
  async updateNodePosition(
    documentId: string,
    nodeId: string,
    position: NodePosition,
    userId: string
  ): Promise<NodePositionResult> {
    try {
      // Validate inputs
      if (!documentId || !nodeId || !position || !userId) {
        console.error('Missing required parameters for updateNodePosition');
        return { success: false };
      }

      const validX = isNaN(position.x) ? 0 : position.x;
      const validY = isNaN(position.y) ? 0 : position.y;

      console.log(
        `YJS: Updating position for node ${nodeId} to x=${validX}, y=${validY}`
      );

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
        console.log(
          `No existing document found for ${documentId}, creating new`
        );
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

      // Update position
      const timestamp = new Date().toISOString();
      positionMap.set('x', validX);
      positionMap.set('y', validY);
      positionMap.set('updatedAt', timestamp);
      positionMap.set('updatedBy', userId);

      // Store the updated state
      const update = Y.encodeStateAsUpdate(ydoc);
      await storeYjsUpdate(documentId, update, userId);

      // Create a snapshot after significant changes
      await createDocumentSnapshot(documentId, ydoc);

      // Return success result
      return {
        success: true,
        data: {
          updatedAt: timestamp,
        },
      };
    } catch (error) {
      console.error('Error updating node position with Yjs:', error);
      return { success: false };
    }
  }

  /**
   * Broadcast node position update to clients
   * @param update Node position update data
   */
  broadcastNodePosition(update: NodePositionUpdate): void {
    if (this.io) {
      this.io.emit('node-position-update', {
        nodeId: update.nodeId,
        position: update.position,
        implementation: 'yjs',
      });
    }
  }

  /**
   * Get node positions from a Yjs document
   * @param documentId Document ID
   * @returns Map of node IDs to positions
   */
  async getNodePositions(
    documentId: string
  ): Promise<Record<string, NodePosition>> {
    try {
      const docState = await getYjsDocument(documentId);
      if (!docState) return {};

      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, docState);

      const nodes = ydoc.getMap('nodes');
      const positions: Record<string, NodePosition> = {};

      nodes.forEach((nodeMap, nodeId) => {
        const node = nodeMap as Y.Map<unknown>;
        if (node.has('position')) {
          const position = node.get('position') as Y.Map<unknown>;
          positions[nodeId] = {
            x: (position.get('x') as number) || 0,
            y: (position.get('y') as number) || 0,
          };
        }
      });

      return positions;
    } catch (error) {
      console.error('Error getting node positions:', error);
      return {};
    }
  }
}

/**
 * Get statistics about a document
 * @param documentId The document ID
 * @returns Stats about document size and updates
 */
export async function getDocumentStats(
  documentId: string
): Promise<{ documentSize: number; updatesCount: number; totalUpdatesSize: number } | null> {
  try {
    // Get document size
    const { data: docData, error: docError } = await supabase
      .from('yjs_documents')
      .select('document_state')
      .eq('document_id', documentId)
      .single();

    if (docError) {
      console.error('Error fetching document for stats:', docError);
      return null;
    }

    // Get updates count and size
    const { data: updatesData, error: updatesError } = await supabase
      .from('yjs_updates')
      .select('update')
      .eq('document_id', documentId);

    if (updatesError) {
      console.error('Error fetching updates for stats:', updatesError);
      return null;
    }

    // Calculate sizes
    const documentSize = docData?.document_state ? docData.document_state.length : 0;
    const updatesCount = updatesData?.length || 0;
    let totalUpdatesSize = 0;

    if (updatesData && updatesData.length > 0) {
      totalUpdatesSize = updatesData.reduce((total, item) => {
        return total + (item.update ? item.update.length : 0);
      }, 0);
    }

    return {
      documentSize,
      updatesCount,
      totalUpdatesSize
    };
  } catch (error) {
    console.error('Exception getting document stats:', error);
    return null;
  }
}

/**
 * Run database maintenance tasks to optimize storage and performance
 * @returns Number of documents processed
 */
export async function runDatabaseMaintenanceJobs(): Promise<number> {
  try {
    console.log('Running YJS database maintenance jobs...');
    
    // 1. Clean up old updates that have been incorporated into snapshots
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('yjs_documents')
      .select('document_id, version')
      .order('version', { ascending: false });

    if (snapshotsError || !snapshots) {
      console.error('Error fetching document snapshots:', snapshotsError);
      return 0;
    }

    let processedCount = 0;

    // For each document with a snapshot, delete updates older than the snapshot
    for (const snapshot of snapshots) {
      // First count how many records will be deleted
      const { data: countData, error: countError } = await supabase
        .from('yjs_updates')
        .select('id', { count: 'exact' })
        .eq('document_id', snapshot.document_id)
        .lt('version', snapshot.version);

      if (countError) {
        console.error(`Error counting updates for document ${snapshot.document_id}:`, countError);
        continue;
      }

      const count = countData?.length || 0;

      if (count > 0) {
        // Then delete the records
        const { error: deleteError } = await supabase
          .from('yjs_updates')
          .delete()
          .eq('document_id', snapshot.document_id)
          .lt('version', snapshot.version);

        if (deleteError) {
          console.error(`Error cleaning up updates for document ${snapshot.document_id}:`, deleteError);
        } else {
          processedCount++;
          console.log(`Cleaned up ${count} old updates for document ${snapshot.document_id}`);
        }
      }
    }

    return processedCount;
  } catch (error) {
    console.error('Exception running database maintenance:', error);
    return 0;
  }
}
