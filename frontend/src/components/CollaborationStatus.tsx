import React, { useState } from 'react';
import { useYjs } from '../contexts/YjsContext';
import ConnectionStatus from './ConnectionStatus';

const CollaborationStatus: React.FC = () => {
  const { isConnected, isOffline, connectedUsers, isFeatureEnabled } = useYjs();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isFeatureEnabled) {
    // If Yjs is not enabled, fall back to the standard connection status
    return <ConnectionStatus />;
  }

  const getStatusColor = () => {
    if (isOffline) return '#F44336'; // Red
    return isConnected ? '#4CAF50' : '#FFC107'; // Green or Yellow
  };

  const getStatusText = () => {
    if (isOffline) return 'Offline (changes saved locally)';
    return isConnected 
      ? `Collaborating (${connectedUsers.length} user${connectedUsers.length !== 1 ? 's' : ''})` 
      : 'Connecting to collaboration server...';
  };

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
                    key={user.clientId}
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
                      {user.userId}
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