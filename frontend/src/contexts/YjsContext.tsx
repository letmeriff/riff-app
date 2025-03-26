import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Y from 'yjs';
import { Node, Edge } from 'reactflow';
import { 
  initYjsDocument, 
  destroyYjsDocument, 
  getNodesFromYjs, 
  getEdgesFromYjs, 
  updateAwareness, 
  getConnectedUsers,
  subscribeToYjsChanges,
  forceDocumentSync,
  hasPendingChanges,
  getOfflineChangesCount,
  getSynchronizationStatus
} from '../services/yjsService';
import { useAuth } from './AuthContext';
import { SyncStatus } from '../utils/yjsOfflineSupport';

// Import or define the YjsAwarenessState to match the one in yjsService
interface YjsAwarenessState {
  clientID: number;
  userId: string;
  user: { id: string; email?: string };
  cursor?: { x: number; y: number };
  isTyping?: boolean;
  isOffline?: boolean;
  syncStatus?: {
    pendingChanges: boolean;
    lastSyncedAt: number | null;
    isReconnecting: boolean;
  };
}

interface YjsContextType {
  ydoc: Y.Doc | null;
  isConnected: boolean;
  isOffline: boolean;
  offlineChangesCount: number;
  syncStatus: SyncStatus | null;
  connectedUsers: { userId: string; clientId: number }[];
  updateAwareness: (state: any) => void;
  getNodesFromYjs: () => Node[];
  getEdgesFromYjs: () => Edge[];
  isFeatureEnabled: boolean;
  hasPendingSyncs: boolean;
  forceSync: () => Promise<boolean>;
}

const YjsContext = createContext<YjsContextType | undefined>(undefined);

interface YjsProviderProps {
  children: ReactNode;
  canvasId: string;
  websocketUrl?: string;
}

export const YjsProvider: React.FC<YjsProviderProps> = ({ 
  children, 
  canvasId,
  websocketUrl = 'ws://localhost:3001/yjs' 
}) => {
  const { user } = useAuth();
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [connectedUsers, setConnectedUsers] = useState<{ userId: string; clientId: number }[]>([]);
  const [hasPendingSyncs, setHasPendingSyncs] = useState<boolean>(false);
  const [offlineChangesCount, setOfflineChangesCount] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  
  // Feature flag to control Yjs integration (can be fetched from config)
  const [isFeatureEnabled] = useState<boolean>(true);
  
  // Function to force sync all changes
  const forceSync = async (): Promise<boolean> => {
    try {
      if (isOffline) {
        console.warn('Cannot force sync while offline');
        return false;
      }
      
      const result = await forceDocumentSync();
      if (result) {
        // Update UI state after successful sync
        setHasPendingSyncs(false);
        setOfflineChangesCount(0);
      }
      return result;
    } catch (error) {
      console.error('Error forcing sync:', error);
      return false;
    }
  };
  
  // Initialize Yjs document when component mounts
  useEffect(() => {
    if (!user || !isFeatureEnabled) return;

    try {
      console.log('Initializing Yjs document for canvas:', canvasId);
      const doc = initYjsDocument(user.id, canvasId, websocketUrl);
      setYdoc(doc);
      
      // Listen for connection status changes
      const wsProvider = (window as any).yjsWebsocketProvider;
      
      if (wsProvider) {
        wsProvider.on('status', ({ status }: { status: string }) => {
          const isConnectedNow = status === 'connected';
          setIsConnected(isConnectedNow);
          console.log(`WebSocket connection status: ${status}`);
          
          // When we reconnect, check for pending changes
          if (isConnectedNow && isOffline) {
            // We just reconnected from offline, update UI
            setIsOffline(false);
          }
        });
        
        wsProvider.on('sync', (isSynced: boolean) => {
          if (isSynced) {
            console.log('Document synchronized with server');
            // After sync completes successfully, update UI states
            setHasPendingSyncs(false);
          }
        });
      }
      
      // Subscribe to connected users
      const intervalId = setInterval(() => {
        if (wsProvider && wsProvider.awareness) {
          const users = getConnectedUsers();
          setConnectedUsers(users);
        }
      }, 1000);
      
      // Listen for document changes
      subscribeToYjsChanges((changes) => {
        console.log('Yjs document changed:', changes);
      });
      
      // Listen for online/offline events
      const handleOnline = () => {
        console.log('Browser is online');
        setIsOffline(false);
      };
      
      const handleOffline = () => {
        console.log('Browser is offline');
        setIsOffline(true);
      };
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      // Poll for sync status and offline changes
      const statusInterval = setInterval(() => {
        // Update pending syncs
        setHasPendingSyncs(hasPendingChanges());
        
        // Get current offline changes count
        setOfflineChangesCount(getOfflineChangesCount());
        
        // Get detailed sync status
        setSyncStatus(getSynchronizationStatus());
      }, 2000);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        clearInterval(intervalId);
        clearInterval(statusInterval);
        destroyYjsDocument();
        setYdoc(null);
      };
    } catch (error) {
      console.error('Error initializing Yjs document:', error);
    }
  }, [user, canvasId, websocketUrl, isFeatureEnabled]);
  
  // Update user awareness when offline status changes
  useEffect(() => {
    if (ydoc && user) {
      // Pass awareness info with the correct structure
      const userState: Partial<YjsAwarenessState> = {
        userId: user.id,
        user: { id: user.id },
        isOffline
      };
      
      updateAwareness(userState);
    }
  }, [isOffline, user, ydoc]);
  
  // Effect to sync when coming back online
  useEffect(() => {
    if (!isOffline && hasPendingSyncs) {
      // We're online with pending changes, try to sync them
      console.log('Attempting to sync pending changes after coming online');
      forceSync().then(success => {
        if (success) {
          console.log('Successfully synced changes after reconnecting');
        } else {
          console.warn('Failed to sync after reconnecting');
        }
      });
    }
  }, [isOffline, hasPendingSyncs]);
  
  const value = {
    ydoc,
    isConnected,
    isOffline,
    offlineChangesCount,
    syncStatus,
    connectedUsers,
    updateAwareness,
    getNodesFromYjs,
    getEdgesFromYjs,
    isFeatureEnabled,
    hasPendingSyncs,
    forceSync
  };
  
  return <YjsContext.Provider value={value}>{children}</YjsContext.Provider>;
};

export const useYjs = () => {
  const context = useContext(YjsContext);
  if (context === undefined) {
    throw new Error('useYjs must be used within a YjsProvider');
  }
  return context;
}; 