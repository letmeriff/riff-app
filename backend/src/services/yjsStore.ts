/**
 * Yjs Document Storage
 *
 * This module provides storage utilities for Yjs documents
 */

import * as Y from 'yjs';
import { supabase } from '../config/supabase';

/**
 * Store a Yjs document update in the database
 * @param documentId The ID of the document
 * @param update The binary update to store
 * @returns Success status
 */
export const storeYjsUpdate = async (
  documentId: string,
  update: Uint8Array
): Promise<boolean> => {
  try {
    // Convert Uint8Array to Base64 string for storage
    const updateBase64 = Buffer.from(update).toString('base64');

    // Store in the database
    const { error } = await supabase.from('yjs_updates').insert({
      document_id: documentId,
      update: updateBase64,
      created_at: new Date().toISOString(),
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
 * Retrieve the latest Yjs document state from the database
 * @param documentId The ID of the document to retrieve
 * @returns Binary representation of the document state or null if not found
 */
export const getYjsDocument = async (
  documentId: string
): Promise<Uint8Array | null> => {
  try {
    // First try to get a snapshot if available
    const { data: snapshotData, error: snapshotError } = await supabase
      .from('yjs_snapshots')
      .select('state')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!snapshotError && snapshotData) {
      // Convert Base64 string back to Uint8Array
      return Buffer.from(snapshotData.state, 'base64');
    }

    // If no snapshot, build from updates
    const { data: updatesData, error: updatesError } = await supabase
      .from('yjs_updates')
      .select('update')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (updatesError || !updatesData || updatesData.length === 0) {
      return null;
    }

    // Create a new document
    const ydoc = new Y.Doc();

    // Apply all updates in order
    for (const update of updatesData) {
      const updateBinary = Buffer.from(update.update, 'base64');
      Y.applyUpdate(ydoc, updateBinary);
    }

    // Return the final state
    return Y.encodeStateAsUpdate(ydoc);
  } catch (error) {
    console.error('Error retrieving Yjs document:', error);
    return null;
  }
};

/**
 * Create a snapshot of the current document state
 * @param documentId The ID of the document
 * @param doc The Yjs document to snapshot
 * @returns Success status
 */
export const createDocumentSnapshot = async (
  documentId: string,
  doc: Y.Doc
): Promise<boolean> => {
  try {
    // Encode the current state
    const state = Y.encodeStateAsUpdate(doc);
    const stateBase64 = Buffer.from(state).toString('base64');

    // Store in the snapshots table
    const { error } = await supabase.from('yjs_snapshots').insert({
      document_id: documentId,
      state: stateBase64,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error creating Yjs snapshot:', error);
      return false;
    }

    // Clean up old updates after snapshot is created
    const { error: cleanupError } = await supabase
      .from('yjs_updates')
      .delete()
      .eq('document_id', documentId)
      .lt(
        'created_at',
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );

    if (cleanupError) {
      console.warn('Error cleaning up old Yjs updates:', cleanupError);
    }

    return true;
  } catch (error) {
    console.error('Exception creating Yjs snapshot:', error);
    return false;
  }
};
