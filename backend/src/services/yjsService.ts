import { supabase } from '../config/supabase';
import * as Y from 'yjs';
import * as zlib from 'zlib';
import { promisify } from 'util';

/**
 * Service for managing Yjs documents in the database
 */

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Compression threshold in bytes
const COMPRESSION_THRESHOLD = 1024; // 1KB

/**
 * Compress document content if it exceeds threshold
 * @param content The binary content to compress
 * @returns Compressed content and flag indicating if it was compressed
 */
export const compressContent = async (content: Uint8Array): Promise<{ data: Uint8Array, compressed: boolean }> => {
  if (content.length < COMPRESSION_THRESHOLD) {
    return { data: content, compressed: false };
  }
  
  try {
    const compressed = await gzip(Buffer.from(content));
    return { 
      data: new Uint8Array(compressed), 
      compressed: true 
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
export const decompressContent = async (content: Uint8Array, isCompressed: boolean): Promise<Uint8Array> => {
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
export async function getYjsDocument(documentId: string): Promise<Uint8Array | null> {
  try {
    // Try to get the document snapshot
    const { data, error } = await supabase
      .from('yjs_documents')
      .select('*')
      .eq('document_id', documentId)
      .single();
    
    if (error || !data) {
      console.log(`No document snapshot found for ${documentId}, trying to recover from updates`);
      return await recoverDocumentFromUpdates(documentId);
    }
    
    // Decompress if needed
    const isCompressed = data.is_compressed || false;
    return await decompressContent(data.document_state, isCompressed);
    
  } catch (error) {
    console.error('Exception fetching Yjs document:', error);
    return null;
  }
}

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
    const { data: compressedState, compressed } = await compressContent(documentState);
    
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
          is_compressed: compressed
        })
        .eq('document_id', documentId);
      
      if (error) {
        console.error('Error updating Yjs document:', error);
        return false;
      }
    } else {
      // Insert new document
      const { error } = await supabase
        .from('yjs_documents')
        .insert({
          document_id: documentId,
          document_state: compressedState,
          version: version,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_compressed: compressed
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
 * Store a Yjs update with compression
 * @param documentId Document ID
 * @param update Document update
 * @param clientId Client ID
 * @param version Version number
 * @returns Success status
 */
export async function storeYjsUpdate(
  documentId: string,
  update: Uint8Array,
  clientId: string,
  version: number
): Promise<boolean> {
  try {
    // Compress the update if it's large
    const { data: compressedUpdate, compressed } = await compressContent(update);
    
    // Store in the database
    const { error } = await supabase
      .from('yjs_updates')
      .insert({
        document_id: documentId,
        update: compressedUpdate,
        client_id: clientId,
        version: version,
        created_at: new Date().toISOString(),
        is_compressed: compressed
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
}

/**
 * Get Yjs document updates with decompression
 * @param documentId Document ID
 * @param fromVersion Optional minimum version to fetch from
 * @returns Array of updates
 */
export async function getYjsUpdates(
  documentId: string, 
  fromVersion?: number
): Promise<Uint8Array[]> {
  try {
    // Query updates
    const query = supabase
      .from('yjs_updates')
      .select('*')
      .eq('document_id', documentId)
      .order('version', { ascending: true });
    
    // Add version filter if provided
    if (fromVersion !== undefined) {
      query.gt('version', fromVersion);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching Yjs updates:', error);
      return [];
    }
    
    // Process and decompress updates
    const updates: Uint8Array[] = [];
    
    for (const row of data) {
      try {
        const update = row.update;
        const isCompressed = row.is_compressed || false;
        
        // Decompress if needed
        const decompressedUpdate = await decompressContent(update, isCompressed);
        updates.push(decompressedUpdate);
      } catch (err) {
        console.error('Error processing update:', err);
      }
    }
    
    return updates;
  } catch (error) {
    console.error('Exception fetching Yjs updates:', error);
    return [];
  }
}

/**
 * Delete old updates to prevent database bloat
 * @param documentId The document ID
 * @param olderThanDays Delete updates older than this many days
 * @returns Success status
 */
export async function cleanupOldUpdates(
  documentId: string,
  olderThanDays: number = 30
): Promise<boolean> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const { error } = await supabase
      .from('yjs_updates')
      .delete()
      .eq('document_id', documentId)
      .lt('created_at', cutoffDate.toISOString());
    
    if (error) {
      console.error('Error cleaning up old Yjs updates:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception cleaning up old Yjs updates:', error);
    return false;
  }
}

/**
 * Get the latest document version
 * @param documentId The document ID
 * @returns The latest version number or 0 if not found
 */
export async function getLatestDocumentVersion(documentId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('yjs_documents')
      .select('version')
      .eq('document_id', documentId)
      .single();
    
    if (error || !data) {
      return 0;
    }
    
    return data.version;
  } catch (error) {
    console.error('Exception getting latest document version:', error);
    return 0;
  }
}

/**
 * Recover a document from its updates
 * @param documentId The document ID
 * @returns Encoded state as Uint8Array or null if recovery failed
 */
export async function recoverDocumentFromUpdates(documentId: string): Promise<Uint8Array | null> {
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
    
    // Return the encoded state
    return docContent;
  } catch (error) {
    console.error('Exception recovering document from updates:', error);
    return null;
  }
}

/**
 * Create a document snapshot and clean up old updates
 * @param documentId The document ID
 * @param doc The Y.Doc instance
 * @returns Success status
 */
export async function createDocumentSnapshot(documentId: string, doc: Y.Doc): Promise<boolean> {
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
 * Get document size statistics
 * @param documentId The document ID
 * @returns Object containing size information
 */
export async function getDocumentStats(documentId: string): Promise<{
  documentSize: number;
  updatesCount: number;
  totalUpdatesSize: number;
  oldestUpdate: Date | null;
  newestUpdate: Date | null;
} | null> {
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
    
    // Get updates information
    const { data: updatesData, error: updatesError } = await supabase
      .from('yjs_updates')
      .select('update_content, created_at')
      .eq('document_id', documentId);
    
    if (updatesError) {
      console.error('Error fetching updates for stats:', updatesError);
      return null;
    }
    
    // Calculate stats
    const documentSize = docData.document_state.length;
    const updatesCount = updatesData.length;
    const totalUpdatesSize = updatesData.reduce((sum, update) => sum + update.update_content.length, 0);
    
    // Find oldest and newest update dates
    let oldestUpdate = null;
    let newestUpdate = null;
    
    if (updatesCount > 0) {
      const dates = updatesData.map(update => new Date(update.created_at)).sort();
      oldestUpdate = dates[0];
      newestUpdate = dates[dates.length - 1];
    }
    
    return {
      documentSize,
      updatesCount,
      totalUpdatesSize,
      oldestUpdate,
      newestUpdate
    };
  } catch (error) {
    console.error('Exception getting document stats:', error);
    return null;
  }
}

/**
 * Optimize storage by compressing document using binary encoding
 * @param documentContent The raw Yjs update as Uint8Array
 * @returns Compressed binary data as Uint8Array
 */
export async function compressUpdate(documentContent: Uint8Array): Promise<Uint8Array> {
  try {
    // Use zlib compression for better results
    const compressed = await gzip(Buffer.from(documentContent));
    return new Uint8Array(compressed);
  } catch (error) {
    console.error('Error compressing update:', error);
    // Return original content on error
    return documentContent;
  }
}

/**
 * Optimize document storage by pruning old updates after snapshot
 * @param documentId The document ID
 * @returns Success status
 */
export async function optimizeDocumentStorage(documentId: string): Promise<boolean> {
  try {
    // Get the latest document version
    const currentVersion = await getLatestDocumentVersion(documentId);
    
    // Delete all updates up to this version as they're now in the snapshot
    const { error } = await supabase
      .from('yjs_updates')
      .delete()
      .eq('document_id', documentId)
      .lte('version', currentVersion);
    
    if (error) {
      console.error('Error optimizing document storage:', error);
      return false;
    }
    
    console.log(`Optimized storage for document ${documentId}, pruned updates up to version ${currentVersion}`);
    return true;
  } catch (error) {
    console.error('Exception optimizing document storage:', error);
    return false;
  }
}

/**
 * Create cleanup jobs for database maintenance
 * Meant to be called on a schedule (e.g., daily)
 * @returns Number of documents processed
 */
export async function runDatabaseMaintenanceJobs(): Promise<number> {
  try {
    // Get list of document IDs
    const { data, error } = await supabase
      .from('yjs_documents')
      .select('document_id');
    
    if (error || !data) {
      console.error('Error fetching documents for maintenance:', error);
      return 0;
    }
    
    let processedCount = 0;
    
    // Process each document
    for (const doc of data) {
      const documentId = doc.document_id;
      
      // 1. Cleanup old updates (older than 14 days)
      await cleanupOldUpdates(documentId, 14);
      
      // 2. Create a fresh snapshot if needed
      const docStats = await getDocumentStats(documentId);
      if (docStats && docStats.updatesCount > 50) {
        // If we have many updates, recover the document and create a new snapshot
        const docData = await recoverDocumentFromUpdates(documentId);
        if (docData) {
          const ydoc = new Y.Doc();
          Y.applyUpdate(ydoc, docData);
          await createDocumentSnapshot(documentId, ydoc);
          await optimizeDocumentStorage(documentId);
        }
      }
      
      processedCount++;
    }
    
    return processedCount;
  } catch (error) {
    console.error('Exception running database maintenance jobs:', error);
    return 0;
  }
}

/**
 * Advanced update tracking for analytics and debugging
 * @param documentId The document ID
 * @param clientId The client ID
 * @param updateSize Update size in bytes
 * @param isCompressed Whether the update was compressed
 * @returns Success status
 */
export async function trackUpdateMetrics(
  documentId: string,
  clientId: string,
  updateSize: number,
  isCompressed: boolean
): Promise<boolean> {
  try {
    // We could store this in a separate table for analytics
    // For now, just log to console in development
    console.log(`Update metrics - Document: ${documentId}, Client: ${clientId}, Size: ${updateSize}b, Compressed: ${isCompressed}`);
    return true;
  } catch (error) {
    console.error('Exception tracking update metrics:', error);
    return false;
  }
} 