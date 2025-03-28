/**
 * CollaborationOverlay Component
 * 
 * Displays real-time collaboration information such as connected users,
 * their cursor positions, and sync status.
 */

import React from 'react';
import { useYjsIntegration } from '../../../../hooks/canvas';
import styles from './CollaborationOverlay.module.css';

export interface CollaborationOverlayProps {
  position?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

export const CollaborationOverlay: React.FC<CollaborationOverlayProps> = ({
  position = { top: 10, right: 10 }
}) => {
  // Get collaboration state from Yjs hook
  const { isConnected, isOffline, connectedUsers = [], forceSync } = useYjsIntegration();
  
  // Don't render if no collaboration functionality
  if (!isConnected && !isOffline && connectedUsers.length === 0) {
    return null;
  }
  
  // Calculate position styles
  const positionStyle = {
    top: position.top !== undefined ? `${position.top}px` : undefined,
    right: position.right !== undefined ? `${position.right}px` : undefined,
    bottom: position.bottom !== undefined ? `${position.bottom}px` : undefined,
    left: position.left !== undefined ? `${position.left}px` : undefined,
  };
  
  return (
    <div className={styles.overlay} style={positionStyle}>
      <div className={styles.statusIndicator}>
        {isConnected ? (
          <span className={styles.connected}>Connected</span>
        ) : (
          <span className={styles.disconnected}>Disconnected</span>
        )}
        
        {isOffline && (
          <span className={styles.offline}>Offline Mode</span>
        )}
      </div>
      
      {connectedUsers.length > 0 && (
        <div className={styles.userList}>
          <div className={styles.userCount}>
            {connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''} connected
          </div>
          
          <div className={styles.avatarContainer}>
            {connectedUsers.slice(0, 5).map(user => (
              <div 
                key={user.userId} 
                className={styles.avatar}
                style={{ backgroundColor: user.color || '#ccc' }}
                title={user.name || user.email}
              >
                {(user.name || user.email || '?').charAt(0).toUpperCase()}
              </div>
            ))}
            
            {connectedUsers.length > 5 && (
              <div className={styles.avatarMore}>
                +{connectedUsers.length - 5}
              </div>
            )}
          </div>
        </div>
      )}
      
      {isOffline && (
        <button 
          className={styles.syncButton}
          onClick={() => forceSync()}
        >
          Sync Changes
        </button>
      )}
    </div>
  );
}; 