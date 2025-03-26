import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { getDocumentStateVector, createDifferentialUpdate } from './yjsSyncProtocol';

// Interface for synchronization status
export interface SyncStatus {
  lastSyncedAt: number | null;
  pendingChanges: boolean;
  isOnline: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectionAttempts: number;
  syncInProgress: boolean;
}

// Default sync status
const defaultSyncStatus: SyncStatus = {
  lastSyncedAt: null,
  pendingChanges: false,
  isOnline: navigator.onLine,
  isConnected: false,
  isReconnecting: false,
  reconnectionAttempts: 0,
  syncInProgress: false,
};

// Store sync status for each document
const documentSyncStatus = new Map<string, SyncStatus>();

/**
 * Initialize offline support for a document
 * @param doc Yjs document
 * @param websocketProvider WebSocket provider
 * @param indexeddbProvider IndexedDB provider
 * @param documentId Document identifier
 */
export const initOfflineSupport = (
  doc: Y.Doc,
  websocketProvider: WebsocketProvider,
  indexeddbProvider: IndexeddbPersistence,
  documentId: string
): void => {
  // Initialize sync status for this document if not exists
  if (!documentSyncStatus.has(documentId)) {
    documentSyncStatus.set(documentId, { ...defaultSyncStatus });
  }
  
  // Handle offline/online browser events
  const handleOffline = () => {
    console.log('Browser went offline');
    const status = documentSyncStatus.get(documentId);
    if (status) {
      documentSyncStatus.set(documentId, {
        ...status,
        isOnline: false,
        isConnected: false
      });
    }
  };
  
  const handleOnline = () => {
    console.log('Browser back online, attempting reconnection');
    const status = documentSyncStatus.get(documentId);
    if (status) {
      documentSyncStatus.set(documentId, {
        ...status,
        isOnline: true,
        isReconnecting: true,
        reconnectionAttempts: 0
      });
    }
    
    // Attempt to reconnect WebSocket
    websocketProvider.connect();
  };
  
  // Remove any existing event listeners to prevent duplicates
  window.removeEventListener('offline', handleOffline);
  window.removeEventListener('online', handleOnline);
  
  // Add event listeners
  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);
  
  // Handle IndexedDB synced event
  indexeddbProvider.on('synced', () => {
    console.log('Document synced with local database');
    const status = documentSyncStatus.get(documentId);
    if (status) {
      documentSyncStatus.set(documentId, {
        ...status,
        lastSyncedAt: Date.now()
      });
    }
  });
  
  // Handle WebSocket connection status
  websocketProvider.on('status', ({ status: connectionStatus }: { status: string }) => {
    console.log(`WebSocket connection status: ${connectionStatus}`);
    const status = documentSyncStatus.get(documentId);
    if (status) {
      documentSyncStatus.set(documentId, {
        ...status,
        isConnected: connectionStatus === 'connected',
        isReconnecting: connectionStatus === 'connecting',
        reconnectionAttempts: connectionStatus === 'connecting' 
          ? status.reconnectionAttempts + 1 
          : 0
      });
    }
  });
  
  // Handle document updates
  doc.on('update', (update: Uint8Array, origin: any) => {
    if (origin !== websocketProvider && origin !== indexeddbProvider) {
      // This is a local update, mark that we have pending changes
      const status = documentSyncStatus.get(documentId);
      if (status) {
        documentSyncStatus.set(documentId, {
          ...status,
          pendingChanges: true
        });
      }
    } else if (origin === websocketProvider) {
      // This is a remote update from the server, we're in sync
      const status = documentSyncStatus.get(documentId);
      if (status) {
        documentSyncStatus.set(documentId, {
          ...status,
          lastSyncedAt: Date.now(),
          pendingChanges: false
        });
      }
    }
  });
  
  // Handle sync events
  websocketProvider.on('sync', (isSynced: boolean) => {
    console.log(`WebSocket sync status: ${isSynced ? 'synced' : 'syncing'}`);
    const status = documentSyncStatus.get(documentId);
    if (status) {
      documentSyncStatus.set(documentId, {
        ...status,
        syncInProgress: !isSynced,
        lastSyncedAt: isSynced ? Date.now() : status.lastSyncedAt,
        pendingChanges: isSynced ? false : status.pendingChanges
      });
    }
  });
  
  // Initial status update
  const initialStatus = {
    ...defaultSyncStatus,
    isOnline: navigator.onLine,
    isConnected: websocketProvider.wsconnected
  };
  documentSyncStatus.set(documentId, initialStatus);
};

/**
 * Get the current synchronization status for a document
 * @param documentId Document identifier
 */
export const getSyncStatus = (documentId: string): SyncStatus => {
  return documentSyncStatus.get(documentId) || { ...defaultSyncStatus };
};

/**
 * Manually trigger synchronization of pending changes
 * @param doc Yjs document
 * @param websocketProvider WebSocket provider
 * @param documentId Document identifier
 */
export const syncPendingChanges = async (
  doc: Y.Doc,
  websocketProvider: WebsocketProvider,
  documentId: string
): Promise<boolean> => {
  const status = documentSyncStatus.get(documentId);
  
  if (!status || !status.isOnline || !status.isConnected) {
    console.log('Cannot sync: offline or disconnected');
    return false;
  }
  
  if (!status.pendingChanges) {
    console.log('No pending changes to sync');
    return true;
  }
  
  try {
    // Update status
    documentSyncStatus.set(documentId, {
      ...status,
      syncInProgress: true
    });
    
    // Create a promise that resolves when sync is complete
    const syncPromise = new Promise<boolean>((resolve) => {
      const onSync = (isSynced: boolean) => {
        if (isSynced) {
          websocketProvider.off('sync', onSync);
          resolve(true);
        }
      };
      
      websocketProvider.on('sync', onSync);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        websocketProvider.off('sync', onSync);
        resolve(false);
      }, 10000);
    });
    
    // Force sync by disconnecting and reconnecting
    websocketProvider.disconnect();
    setTimeout(() => websocketProvider.connect(), 500);
    
    const result = await syncPromise;
    
    // Update status based on result
    const currentStatus = documentSyncStatus.get(documentId);
    if (currentStatus) {
      documentSyncStatus.set(documentId, {
        ...currentStatus,
        syncInProgress: false,
        lastSyncedAt: result ? Date.now() : currentStatus.lastSyncedAt,
        pendingChanges: !result
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error syncing pending changes:', error);
    
    // Update status to reflect failure
    const currentStatus = documentSyncStatus.get(documentId);
    if (currentStatus) {
      documentSyncStatus.set(documentId, {
        ...currentStatus,
        syncInProgress: false
      });
    }
    
    return false;
  }
};

/**
 * Register an offline change handler
 * @param doc Yjs document
 * @param handler Handler function called when changes occur while offline
 */
export const registerOfflineChangeHandler = (
  doc: Y.Doc,
  handler: (update: Uint8Array, isOffline: boolean) => void
): () => void => {
  const updateHandler = (update: Uint8Array, origin: any) => {
    // Check if we're offline
    const isOffline = !navigator.onLine;
    
    // If this is a local update and we're offline, call the handler
    if (origin !== 'remote' && isOffline) {
      handler(update, isOffline);
    }
  };
  
  // Register the handler
  doc.on('update', updateHandler);
  
  // Return a function to unregister the handler
  return () => {
    doc.off('update', updateHandler);
  };
};

/**
 * Create a conflict resolution function that can be used to handle
 * conflicts between local and remote changes
 * @param doc Yjs document
 */
export const createConflictResolver = (doc: Y.Doc) => {
  // Yjs has automatic CRDT-based conflict resolution,
  // but we can provide a way to detect conflicts
  
  let lastSyncedState: Uint8Array | null = null;
  
  // Store the current state when we're in sync
  const syncHandler = () => {
    lastSyncedState = getDocumentStateVector(doc);
  };
  
  // Initialize with current state
  syncHandler();
  
  // Detect if there's a potential conflict
  const detectConflict = (remoteUpdate: Uint8Array): boolean => {
    if (!lastSyncedState) return false;
    
    // Create a diff between our last synced state and the remote update
    const diff = createDifferentialUpdate(doc, lastSyncedState);
    
    // If the diff has content and we received an update, there might be a conflict
    return diff.length > 0 && remoteUpdate.length > 0;
  };
  
  return {
    updateSyncedState: syncHandler,
    detectConflict
  };
};

/**
 * Clean up offline support for a document
 * @param documentId Document identifier
 */
export const cleanupOfflineSupport = (documentId: string): void => {
  // Remove sync status for this document
  documentSyncStatus.delete(documentId);
  
  // Remove event listeners
  window.removeEventListener('offline', () => {});
  window.removeEventListener('online', () => {});
}; 