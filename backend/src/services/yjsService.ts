import { supabase } from '../config/supabase';
import * as Y from 'yjs';

/**
 * Service for managing Yjs documents in the database
 */

/**
 * Get a Yjs document by its ID
 * @param documentId The unique identifier for the document
 * @returns The document content as a Uint8Array or null if not found
 */
export async function getYjsDocument(documentId: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await supabase
      .from('yjs_documents')
      .select('document_content')
      .eq('document_id', documentId)
      .single();
    
    if (error || !data) {
      console.error('Error fetching Yjs document:', error);
      return null;
    }
    
    // Convert the binary data to a Uint8Array
    return new Uint8Array(Buffer.from(data.document_content, 'base64'));
  } catch (error) {
    console.error('Exception fetching Yjs document:', error);
    return null;
  }
}

/**
 * Store a Yjs document snapshot
 * @param documentId The unique identifier for the document
 * @param documentContent The document content as a Uint8Array
 * @param version The document version
 * @returns Success status
 */
export async function storeYjsDocument(
  documentId: string,
  documentContent: Uint8Array,
  version: number
): Promise<boolean> {
  try {
    // Convert Uint8Array to base64 string for storage
    const base64Content = Buffer.from(documentContent).toString('base64');
    
    // Check if document exists
    const { data: existingDoc } = await supabase
      .from('yjs_documents')
      .select('id, version')
      .eq('document_id', documentId)
      .single();
    
    let result;
    
    if (existingDoc) {
      // Only update if the new version is higher than the stored version
      if (existingDoc.version < version) {
        result = await supabase
          .from('yjs_documents')
          .update({
            document_content: base64Content,
            version,
            updated_at: new Date().toISOString()
          })
          .eq('document_id', documentId);
      } else {
        // Version is not newer, consider it a success but don't update
        return true;
      }
    } else {
      // Insert new document
      result = await supabase
        .from('yjs_documents')
        .insert({
          document_id: documentId,
          document_content: base64Content,
          version
        });
    }
    
    if (result?.error) {
      console.error('Error storing Yjs document:', result.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception storing Yjs document:', error);
    return false;
  }
}

/**
 * Store a Yjs update
 * @param documentId The unique identifier for the document
 * @param updateContent The update content as a Uint8Array
 * @param clientId The client ID that generated the update
 * @param version The update version
 * @returns Success status
 */
export async function storeYjsUpdate(
  documentId: string,
  updateContent: Uint8Array,
  clientId: string,
  version: number
): Promise<boolean> {
  try {
    // Convert Uint8Array to base64 string for storage
    const base64Content = Buffer.from(updateContent).toString('base64');
    
    const { error } = await supabase
      .from('yjs_updates')
      .insert({
        document_id: documentId,
        update_content: base64Content,
        client_id: clientId,
        version
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
 * Get Yjs updates for a document since a specific version
 * @param documentId The unique identifier for the document
 * @param sinceVersion Get updates with version > sinceVersion
 * @returns Array of updates as Uint8Array
 */
export async function getYjsUpdates(
  documentId: string,
  sinceVersion: number
): Promise<Array<{ update: Uint8Array, version: number }>> {
  try {
    const { data, error } = await supabase
      .from('yjs_updates')
      .select('update_content, version')
      .eq('document_id', documentId)
      .gt('version', sinceVersion)
      .order('version', { ascending: true });
    
    if (error || !data) {
      console.error('Error fetching Yjs updates:', error);
      return [];
    }
    
    // Convert base64 data to Uint8Array
    return data.map(item => ({
      update: new Uint8Array(Buffer.from(item.update_content, 'base64')),
      version: item.version
    }));
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
 * @returns A new Y.Doc with all updates applied, or null if recovery failed
 */
export async function recoverDocumentFromUpdates(documentId: string): Promise<Y.Doc | null> {
  try {
    // Create a new empty document
    const doc = new Y.Doc();
    
    // Get all updates for this document
    const { data, error } = await supabase
      .from('yjs_updates')
      .select('update_content, version')
      .eq('document_id', documentId)
      .order('version', { ascending: true });
    
    if (error || !data || data.length === 0) {
      console.error('No updates found for document recovery:', documentId);
      return null;
    }
    
    // Apply all updates in order
    for (const update of data) {
      const updateContent = new Uint8Array(Buffer.from(update.update_content, 'base64'));
      Y.applyUpdate(doc, updateContent);
    }
    
    // Store the recovered document
    const latestVersion = data[data.length - 1].version;
    const docContent = Y.encodeStateAsUpdate(doc);
    await storeYjsDocument(documentId, docContent, latestVersion);
    
    return doc;
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
      .select('document_content')
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
    const documentSize = docData.document_content.length;
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
export function compressUpdate(documentContent: Uint8Array): Uint8Array {
  // In a real implementation, you might use a compression library like zlib
  // For now, we'll just return the original content as this would require
  // additional libraries and consistency in decompression
  return documentContent;
}

/**
 * Decompress a stored document update
 * @param compressedContent Compressed binary data
 * @returns Original Yjs update as Uint8Array
 */
export function decompressUpdate(compressedContent: Uint8Array): Uint8Array {
  // Matching counterpart to compressUpdate
  // Would implement actual decompression if compression was used
  return compressedContent;
} 