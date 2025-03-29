/**
 * CollaborationStatus Component
 * 
 * Displays real-time collaboration status information and connected users.
 * 
 * Implementation Notes:
 * - Uses type-safe state handling
 * - Implements proper type validation for user data
 * - Handles both YJS and standard network interfaces
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useYjs } from '../contexts/YjsContext';
import { useNetwork } from '../contexts/NetworkContext';
import { NetworkPayload } from '../types/messaging';
import ConnectionStatus from './ConnectionStatus';

/**
 * Type-safe interface for connected user data
 */
interface ConnectedUser {
  userId: string;
  clientId?: number;
  email?: string;
  name?: string;
  color?: string;
  isActive?: boolean;
  lastActive?: string;
}

/**
 * Type guard for connection status payload
 */
function isConnectionStatusPayload(payload: NetworkPayload): payload is NetworkPayload & {
  status: 'connected' | 'disconnected';
  userCount: number;
} {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'status' in payload &&
    (payload.status === 'connected' || payload.status === 'disconnected') &&
    'userCount' in payload &&
    typeof payload.userCount === 'number'
  );
}

/**
 * Type guard for user list payload
 */
function isUserListPayload(payload: NetworkPayload): payload is NetworkPayload & {
  users: Array<{ userId: string; clientId?: number; [key: string]: unknown }>;
} {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'users' in payload &&
    Array.isArray(payload.users) &&
    payload.users.every(user => 
      typeof user === 'object' && 
      user !== null && 
      'userId' in user && 
      typeof user.userId === 'string'
    )
  );
}

const CollaborationStatus: React.FC = () => {
  const { isConnected: yjsConnected, isOffline, connectedUsers: yjsUsers, isFeatureEnabled } = useYjs();
  const { networkAdapter, connectionStatus } = useNetwork();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Use standard network connection status when YJS is not enabled
  const [standardConnectedUsers, setStandardConnectedUsers] = useState<ConnectedUser[]>([]);
  const [standardConnectionStatus, setStandardConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  
  // Combined state that works with both YJS and standard connections
  const isConnected = isFeatureEnabled ? yjsConnected : (connectionStatus === 'connected' || standardConnectionStatus === 'connected');
  const connectedUsers = isFeatureEnabled ? yjsUsers : standardConnectedUsers;

  // Subscribe to standard network events if YJS is not enabled
  useEffect(() => {
    if (isFeatureEnabled || !networkAdapter) return;
    
    // Handle connection status updates with type validation
    const handleConnectionStatus = (payload: NetworkPayload) => {
      if (isConnectionStatusPayload(payload)) {
        setStandardConnectionStatus(payload.status);
      }
    };
    
    // Handle user list updates with type validation
    const handleUserList = (payload: NetworkPayload) => {
      if (isUserListPayload(payload)) {
        // Convert to our standard format with proper type safety
        const users: ConnectedUser[] = payload.users.map(user => ({
          userId: user.userId,
          clientId: user.clientId ?? Date.now(), // Fallback if no clientId
          email: typeof user.email === 'string' ? user.email : undefined,
          isActive: user.isActive === true
        }));
        
        setStandardConnectedUsers(users);
      }
    };
    
    // Subscribe to relevant events
    const unsubscribeStatus = networkAdapter.subscribeToEvent('connection-status', handleConnectionStatus);
    const unsubscribeUsers = networkAdapter.subscribeToEvent('user-list', handleUserList);
    
    // Initial state based on connection context
    setStandardConnectionStatus(connectionStatus === 'connected' ? 'connected' : 'disconnected');
    
    return () => {
      unsubscribeStatus();
      unsubscribeUsers();
    };
  }, [networkAdapter, isFeatureEnabled, connectionStatus]);

  if (!isFeatureEnabled && !networkAdapter) {
    // If neither YJS nor standard networking is available, fall back to basic status
    return <ConnectionStatus />;
  }

  // Status indicator color based on state
  const getStatusColor = useCallback(() => {
    if (isOffline) return '#F44336'; // Red
    return isConnected ? '#4CAF50' : '#FFC107'; // Green or Yellow
  }, [isOffline, isConnected]);

  // Status text based on state
  const getStatusText = useCallback(() => {
    if (isOffline) return 'Offline (changes saved locally)';
    return isConnected 
      ? `Collaborating (${connectedUsers.length} user${connectedUsers.length !== 1 ? 's' : ''})` 
      : 'Connecting to collaboration server...';
  }, [isOffline, isConnected, connectedUsers.length]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="collaboration-status">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '4px',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          cursor: 'pointer',
        }}
        onClick={toggleExpand}
      >
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
          }}
        />
        <span>{getStatusText()}</span>
      </div>

      {isExpanded && (
        <div
          style={{
            position: 'absolute',
            backgroundColor: 'white',
            borderRadius: '4px',
            padding: '12px',
            marginTop: '4px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            width: '250px',
            zIndex: 1000,
          }}
        >
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
            Collaboration Status
          </h4>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Connection:</span>
              <span style={{ 
                color: isConnected ? '#4CAF50' : isOffline ? '#F44336' : '#FFC107',
                fontWeight: 'bold'
              }}>
                {isOffline ? 'Offline' : isConnected ? 'Connected' : 'Connecting'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Sync:</span>
              <span style={{ 
                color: isOffline ? '#F44336' : '#4CAF50',
                fontWeight: 'bold'
              }}>
                {isOffline ? 'Local only' : 'Real-time'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Awareness:</span>
              <span style={{ 
                color: isOffline ? '#F44336' : '#4CAF50',
                fontWeight: 'bold'
              }}>
                {isOffline ? 'Disabled' : 'Enabled'}
              </span>
            </div>
          </div>

          {!isOffline && connectedUsers.length > 0 && (
            <>
              <h4 style={{ margin: '12px 0 8px 0', fontSize: '14px' }}>
                Connected Users ({connectedUsers.length})
              </h4>
              <ul style={{ 
                margin: 0, 
                padding: 0, 
                listStyle: 'none',
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                {connectedUsers.map(user => (
                  <li
                    key={`user-${user.userId}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#4CAF50',
                      }}
                    />
                    <span style={{ fontSize: '13px' }}>
                      {typeof user.name === 'string' ? user.name : 
                       typeof user.userId === 'string' ? user.userId : 'Unknown User'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {isOffline && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: '#FFF3E0',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#E65100'
            }}>
              <strong>Offline Mode:</strong> Your changes are saved locally and will sync automatically when you're back online.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CollaborationStatus; 