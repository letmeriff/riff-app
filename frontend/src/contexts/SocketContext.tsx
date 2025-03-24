import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode; token: string | null }> = ({
  children,
  token,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token) {
      setConnectionStatus('disconnected');
      return;
    }

    const connectSocket = () => {
      setConnectionStatus('connecting');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
      console.log(`Attempting to connect to Socket.IO server at ${backendUrl}`);
      
      const newSocket = io(backendUrl, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      newSocket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        
        if (reconnectInterval.current) {
          clearInterval(reconnectInterval.current);
          reconnectInterval.current = null;
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.warn(`Socket.IO disconnected: ${reason}`);
        setConnectionStatus('disconnected');
        
        if (reason === 'io server disconnect') {
          // The server has forcefully disconnected the connection
          console.log('Server disconnected the connection, attempting to reconnect...');
          newSocket.connect();
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        setConnectionStatus('error');
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          console.log(`Connection attempt ${reconnectAttempts.current}/${maxReconnectAttempts} failed. Retrying...`);
        } else {
          console.error(`Failed to connect after ${maxReconnectAttempts} attempts`);
          
          if (!reconnectInterval.current) {
            // Set up a long-interval reconnect strategy
            reconnectInterval.current = setInterval(() => {
              console.log('Attempting to reconnect to Socket.IO server...');
              reconnectAttempts.current = 0;
              newSocket.connect();
            }, 30000); // Try every 30 seconds
          }
        }
      });

      setSocket(newSocket);

      return newSocket;
    };

    const socket = connectSocket();

    return () => {
      if (reconnectInterval.current) {
        clearInterval(reconnectInterval.current);
      }
      
      socket.disconnect();
      setConnectionStatus('disconnected');
    };
  }, [token]);

  return <SocketContext.Provider value={{ socket, connectionStatus }}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
}; 