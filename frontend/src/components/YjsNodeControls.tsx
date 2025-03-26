import React, { useCallback, useState } from 'react';
import { useYjs } from '../contexts/YjsContext';
import '../styles/reactflow.css';

interface YjsNodeControlsProps {
}

const YjsNodeControls: React.FC<YjsNodeControlsProps> = () => {
  const { isConnected, isOffline, connectedUsers } = useYjs();
  const [showConnectedUsers, setShowConnectedUsers] = useState(false);

  const toggleConnectedUsers = useCallback(() => {
    setShowConnectedUsers(prev => !prev);
  }, []);

  // If Yjs is not connected or we're offline, show a warning
  const connectionStatus = isOffline 
    ? 'offline' 
    : isConnected 
      ? 'connected' 
      : 'connecting';

  const getStatusColor = () => {
    switch(connectionStatus) {
      case 'connected': return '#4CAF50'; // Green
      case 'connecting': return '#FF9800'; // Orange
      case 'offline': return '#F44336'; // Red
      default: return '#9E9E9E'; // Grey
    }
  };

  const getStatusText = () => {
    switch(connectionStatus) {
      case 'connected': return `Connected (${connectedUsers.length} users)`;
      case 'connecting': return 'Connecting...';
      case 'offline': return 'Offline (changes will sync when online)';
      default: return 'Status unknown';
    }
  };

  return (
    <div className="yjs-controls">
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
      >
        <div 
          style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%',
            background: getStatusColor()
          }} 
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
        >
          Offline Mode - Changes will sync when connection is restored
        </div>
      )}
    </div>
  );
};

export default YjsNodeControls; 