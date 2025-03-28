/**
 * YjsNodeControls Component
 * 
 * Displays Yjs collaboration status and controls for node operations.
 * 
 * Implementation Notes:
 * - Uses type-safe interface definitions
 * - Implements proper state validation for connection status
 * - Handles real-time user presence data
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useYjs } from '../contexts/YjsContext';
import { useNetwork } from '../contexts/NetworkContext';
import { NetworkPayload } from '../types/messaging';
import '../styles/reactflow.css';

/**
 * Type-safe connection status type
 */
type ConnectionStatus = 'connected' | 'connecting' | 'offline' | 'unknown';

/**
 * Type-safe connected user interface
 */
interface ConnectedUser {
  userId: string;
  clientId: number;
  color?: string;
  cursor?: { x: number; y: number } | null;
  [key: string]: unknown;
}

/**
 * Type-safe status change payload
 */
interface StatusChangePayload extends NetworkPayload {
  status: ConnectionStatus;
  userCount?: number;
}

/**
 * Type guard for status change payload
 */
function isStatusChangePayload(payload: NetworkPayload): payload is StatusChangePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'status' in payload &&
    typeof payload.status === 'string' &&
    ['connected', 'connecting', 'offline', 'unknown'].includes(payload.status)
  );
}

interface YjsNodeControlsProps {
}

const YjsNodeControls: React.FC<YjsNodeControlsProps> = () => {
  const { isConnected: yjsConnected, isOffline, connectedUsers: yjsUsers } = useYjs();
  const { networkAdapter, connectionStatus: networkConnectionStatus } = useNetwork();
  const [showConnectedUsers, setShowConnectedUsers] = useState(false);
  const [standardUsers, setStandardUsers] = useState<ConnectedUser[]>([]);
  const [standardStatus, setStandardStatus] = useState<ConnectionStatus>('unknown');
  
  // Use YJS connection state if available, otherwise use standard connection
  const isConnected = yjsConnected || (!isOffline && networkConnectionStatus === 'connected');
  
  // Combine user lists - YJS users take precedence
  const connectedUsers = yjsUsers.length > 0 ? yjsUsers : standardUsers;

  // Subscribe to standard connection state changes
  useEffect(() => {
    if (!networkAdapter) return;
    
    // Handler for status change events
    const handleStatusChange = (payload: NetworkPayload) => {
      if (isStatusChangePayload(payload)) {
        setStandardStatus(payload.status);
        
        // If userCount is provided but no users are known, create placeholders
        if (payload.status === 'connected' && 
            typeof payload.userCount === 'number' && 
            payload.userCount > 0 && 
            standardUsers.length === 0) {
          
          // Create placeholder users when only count is known
          const placeholderUsers: ConnectedUser[] = Array.from(
            { length: payload.userCount }, 
            (_, i) => ({
              userId: `User ${i+1}`,
              clientId: Date.now() + i,
            })
          );
          
          setStandardUsers(placeholderUsers);
        }
      }
    };
    
    // Handler for user list updates
    const handleUserList = (payload: NetworkPayload) => {
      if (typeof payload === 'object' && 
          payload !== null && 
          'users' in payload && 
          Array.isArray(payload.users)) {
        
        // Safely convert to our expected format
        const users = payload.users
          .filter(user => typeof user === 'object' && user !== null && 'userId' in user)
          .map(user => ({
            userId: String(user.userId || ''),
            clientId: typeof user.clientId === 'number' ? user.clientId : Date.now(),
            color: typeof user.color === 'string' ? user.color : undefined
          }));
        
        setStandardUsers(users);
      }
    };
    
    // Subscribe to events
    const unsubscribeStatus = networkAdapter.subscribeToEvent('connection-status', handleStatusChange);
    const unsubscribeUsers = networkAdapter.subscribeToEvent('user-list', handleUserList);
    
    // Set initial status based on network context
    setStandardStatus(
      networkConnectionStatus === 'connected' ? 'connected' : 
      networkConnectionStatus === 'connecting' ? 'connecting' : 
      networkConnectionStatus === 'disconnected' ? 'offline' : 'unknown'
    );
    
    return () => {
      unsubscribeStatus();
      unsubscribeUsers();
    };
  }, [networkAdapter, networkConnectionStatus, standardUsers.length]);

  const toggleConnectedUsers = useCallback(() => {
    setShowConnectedUsers(prev => !prev);
  }, []);

  // Determine the current status, prioritizing YJS over standard connection
  const currentStatus: ConnectionStatus = isOffline 
    ? 'offline' 
    : isConnected 
      ? 'connected' 
      : 'connecting';

  const getStatusColor = useCallback(() => {
    switch(currentStatus) {
      case 'connected': return '#4CAF50'; // Green
      case 'connecting': return '#FF9800'; // Orange
      case 'offline': return '#F44336'; // Red
      default: return '#9E9E9E'; // Grey
    }
  }, [currentStatus]);

  const getStatusText = useCallback(() => {
    switch(currentStatus) {
      case 'connected': return `Connected (${connectedUsers.length} user${connectedUsers.length !== 1 ? 's' : ''})`;
      case 'connecting': return 'Connecting...';
      case 'offline': return 'Offline (changes will sync when online)';
      default: return 'Status unknown';
    }
  }, [currentStatus, connectedUsers.length]);

  return (
    <div className="yjs-controls" data-testid="yjs-node-controls">
      <div 
        className="yjs-status-indicator"
        style={{ 
          position: 'absolute', 
          top: '10px', 
          right: '10px',
          zIndex: 10,
          padding: '8px 12px',
          borderRadius: '4px',
          background: 'white',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          cursor: 'pointer'
        }}
        onClick={toggleConnectedUsers}
        data-testid="connection-status-indicator"
      >
        <div 
          style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%',
            background: getStatusColor()
          }} 
          data-testid="status-dot"
        />
        <span>{getStatusText()}</span>
      </div>

      {showConnectedUsers && connectedUsers.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50px',
            right: '10px',
            zIndex: 10,
            padding: '8px',
            borderRadius: '4px',
            background: 'white',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            width: '200px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}
          data-testid="connected-users-list"
        >
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
            Connected Users
          </h4>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {connectedUsers.map(user => (
              <li 
                key={user.clientId}
                style={{
                  padding: '4px 0',
                  borderBottom: '1px solid #eee',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                data-testid={`user-${user.clientId}`}
              >
                <div 
                  style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%',
                    background: '#4CAF50'
                  }} 
                />
                <span>{user.userId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOffline && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            padding: '8px 16px',
            borderRadius: '4px',
            background: '#ff9800',
            color: 'white',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
          data-testid="offline-indicator"
        >
          Offline Mode - Changes will sync when connection is restored
        </div>
      )}
    </div>
  );
};

export default YjsNodeControls; 