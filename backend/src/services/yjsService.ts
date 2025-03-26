import { supabase } from '../config/supabase';

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
      .select('id')
      .eq('document_id', documentId)
      .single();
    
    let result;
    
    if (existingDoc) {
      // Update existing document
      result = await supabase
        .from('yjs_documents')
        .update({
          document_content: base64Content,
          version,
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId);
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
    
    if (result.error) {
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