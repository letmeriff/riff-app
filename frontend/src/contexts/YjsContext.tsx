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
  subscribeToYjsChanges 
} from '../services/yjsService';
import { useAuth } from './AuthContext';

// Import or define the YjsAwarenessState to match the one in yjsService
interface YjsAwarenessState {
  clientID: number;
  userId: string;
  user: { id: string; email?: string };
  cursor?: { x: number; y: number };
  isTyping?: boolean;
  isOffline?: boolean;
}

interface YjsContextType {
  ydoc: Y.Doc | null;
  isConnected: boolean;
  isOffline: boolean;
  connectedUsers: { userId: string; clientId: number }[];
  updateAwareness: (state: any) => void;
  getNodesFromYjs: () => Node[];
  getEdgesFromYjs: () => Edge[];
  isFeatureEnabled: boolean;
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
  
  // Feature flag to control Yjs integration (can be fetched from config)
  const [isFeatureEnabled] = useState<boolean>(true);
  
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
          setIsConnected(status === 'connected');
          console.log(`WebSocket connection status: ${status}`);
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
        // The changes will be handled by the components directly
      });
      
      // Listen for online/offline events
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        clearInterval(intervalId);
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
      const userState = {
        userId: user.id,
        user: { id: user.id }
      };
      
      // Add offline status information
      if (isOffline) {
        // Use as any to bypass type checking for custom properties
        updateAwareness({ ...userState, isOffline } as any);
      } else {
        updateAwareness(userState);
      }
    }
  }, [isOffline, user, ydoc]);
  
  const value = {
    ydoc,
    isConnected,
    isOffline,
    connectedUsers,
    updateAwareness,
    getNodesFromYjs,
    getEdgesFromYjs,
    isFeatureEnabled
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