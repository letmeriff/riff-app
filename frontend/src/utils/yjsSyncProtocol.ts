import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { encodeStateVector, encodeStateAsUpdate } from 'yjs';

/**
 * Helper utility for Yjs synchronization protocol
 * This file contains utilities for managing the synchronization protocol
 * between clients to replace the custom vector clock system
 */

/**
 * Get a state vector representing the current state of the document
 * This is used to determine what updates are needed
 */
export const getDocumentStateVector = (doc: Y.Doc): Uint8Array => {
  return encodeStateVector(doc);
};

/**
 * Encode the full document state as an update
 * This is used for creating snapshots or sending the complete document state
 */
export const getFullDocumentState = (doc: Y.Doc): Uint8Array => {
  return encodeStateAsUpdate(doc);
};

/**
 * Check if a client needs synchronization
 * @param localDoc Local Yjs document
 * @param remoteStateVector State vector from another client
 * @returns True if the documents are out of sync
 */
export const needsSynchronization = (localDoc: Y.Doc, remoteStateVector: Uint8Array): boolean => {
  // Create a diff update based on the remote state vector
  const diffUpdate = Y.encodeStateAsUpdate(localDoc, remoteStateVector);
  
  // If the diff update has content, it means we have updates that the other client needs
  return diffUpdate.length > 0;
};

/**
 * Create a differential update for synchronization
 * @param localDoc Local Yjs document
 * @param remoteStateVector State vector from another client
 * @returns Update containing only the changes needed by the remote client
 */
export const createDifferentialUpdate = (localDoc: Y.Doc, remoteStateVector: Uint8Array): Uint8Array => {
  return Y.encodeStateAsUpdate(localDoc, remoteStateVector);
};

/**
 * Utility to handle reconnection sync
 * @param doc Yjs document
 * @param provider WebSocket provider
 * @returns A promise that resolves when sync is complete
 */
export const handleReconnectionSync = async (
  doc: Y.Doc,
  provider: WebsocketProvider
): Promise<void> => {
  return new Promise((resolve) => {
    // When we're connected, the sync is complete
    const onSync = () => {
      provider.off('sync', onSync);
      resolve();
    };
    
    provider.on('sync', onSync);
  });
};

/**
 * Get a timestamp that can be used for version ordering
 * This replaces the vector clock with a simpler mechanism
 */
export const getTimestampVector = (): number => {
  return Date.now();
};

/**
 * Configure sync protocol for offline support
 * @param doc Yjs document
 * @param websocketProvider WebSocket provider
 * @param indexeddbProvider IndexedDB provider 
 */
export const configureSyncProtocol = (
  doc: Y.Doc,
  websocketProvider: WebsocketProvider, 
  indexeddbProvider: IndexeddbPersistence
): void => {
  // Handle sync status
  websocketProvider.on('status', ({ status }: { status: string }) => {
    console.log(`WebSocket connection status: ${status}`);
    
    if (status === 'connected') {
      // We're online, make sure we have the latest updates
      console.log('Connected to WebSocket, syncing document');
    }
  });
  
  // Listen for document load from IndexedDB
  indexeddbProvider.on('synced', () => {
    console.log('Document synced with local database');
  });
  
  // Handle when we get updates from the server
  doc.on('update', (update: Uint8Array, origin: any) => {
    if (origin === websocketProvider) {
      // This update came from the server
      console.log('Received update from server');
    } else if (origin !== indexeddbProvider) {
      // This is a local update (not from IndexedDB)
      console.log('Local update will be synced');
    }
  });
};

/**
 * Configure conflict resolution strategy
 * @param doc Yjs document
 */
export const configureConflictResolution = (doc: Y.Doc): void => {
  // Yjs has built-in conflict resolution, but we can add logging
  doc.on('afterTransaction', (transaction) => {
    if (transaction.origin && transaction.changed.size > 0) {
      console.log(`Transaction applied from client ${transaction.origin}`);
    }
  });
};

/**
 * Sync protocol configuration for a canvas
 * Sets up all necessary event handlers and configurations
 */
export const setupCanvasSyncProtocol = (
  doc: Y.Doc,
  websocketProvider: WebsocketProvider,
  indexeddbProvider: IndexeddbPersistence,
  onSyncStatusChange?: (isOnline: boolean) => void
): void => {
  // Configure basic sync protocol
  configureSyncProtocol(doc, websocketProvider, indexeddbProvider);
  
  // Configure conflict resolution
  configureConflictResolution(doc);
  
  // Handle connection status
  websocketProvider.on('status', ({ status }: { status: string }) => {
    if (onSyncStatusChange) {
      onSyncStatusChange(status === 'connected');
    }
  });
  
  // Handle when we go offline
  window.addEventListener('offline', () => {
    console.log('Browser went offline, switching to local updates only');
    if (onSyncStatusChange) {
      onSyncStatusChange(false);
    }
  });
  
  // Handle when we come back online
  window.addEventListener('online', () => {
    console.log('Browser back online, resuming sync');
    
    // Force a reconnection to sync changes
    websocketProvider.connect();
    
    if (onSyncStatusChange) {
      onSyncStatusChange(true);
    }
  });
}; 