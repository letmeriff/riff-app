import React, { createContext, useContext, useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { NetworkAdapter, createNetworkAdapter } from '../services/networkAdapter';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

interface NetworkContextType {
  networkAdapter: NetworkAdapter | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  isYjsNetwork: boolean;
  sendMessage: (eventName: string, payload: any) => void;
  subscribeToEvent: (eventName: string, callback: (payload: any) => void) => () => void;
  updateUserPresence: (nodeId: string, isTyping: boolean) => void;
  setUserCursor: (position: { x: number, y: number } | null) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: React.ReactNode;
  wsProvider: WebsocketProvider | null;
  doc: Y.Doc | null;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ 
  children, 
  wsProvider, 
  doc 
}) => {
  const { user } = useAuth();
  const { socket, connectionStatus: socketStatus } = useSocket();
  const [networkAdapter, setNetworkAdapter] = useState<NetworkAdapter | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');
  const [isYjsNetwork, setIsYjsNetwork] = useState(false);
  
  // Initialize network adapter when dependencies change
  useEffect(() => {
    if (!user) return;
    
    const userId = user.id;
    
    // Create appropriate network adapter
    const adapter = createNetworkAdapter(socket, wsProvider, doc, userId);
    setNetworkAdapter(adapter);
    setIsYjsNetwork(adapter.constructor.name === 'YjsNetworkAdapter');
    
    // Initial connection status
    setConnectionStatus('connecting');
    
    // Try to connect
    adapter.connect().then(success => {
      setConnectionStatus(success ? 'connected' : 'error');
    });
    
    // Cleanup
    return () => {
      adapter.disconnect();
      setNetworkAdapter(null);
    };
  }, [user, socket, wsProvider, doc]);
  
  // Update connection status when socket status changes
  useEffect(() => {
    if (networkAdapter && !isYjsNetwork) {
      setConnectionStatus(socketStatus);
    }
  }, [socketStatus, networkAdapter, isYjsNetwork]);
  
  // Proxy methods to make the context more convenient to use
  const sendMessage = (eventName: string, payload: any) => {
    networkAdapter?.sendMessage(eventName, payload);
  };
  
  const subscribeToEvent = (eventName: string, callback: (payload: any) => void) => {
    return networkAdapter?.subscribeToEvent(eventName, callback) || (() => {});
  };
  
  const updateUserPresence = (nodeId: string, isTyping: boolean) => {
    networkAdapter?.updateUserPresence(nodeId, isTyping);
  };
  
  const setUserCursor = (position: { x: number, y: number } | null) => {
    networkAdapter?.setUserCursor(position);
  };
  
  const value = {
    networkAdapter,
    connectionStatus,
    isYjsNetwork,
    sendMessage,
    subscribeToEvent,
    updateUserPresence,
    setUserCursor
  };
  
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

// Custom hook to use the network context
export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}; 