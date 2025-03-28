/**
 * EditIndicator Component
 * 
 * Displays indicators for users who are currently editing a node.
 * 
 * Implementation Notes:
 * - Uses type-safe interfaces for user data
 * - Implements proper state validation for edit awareness
 * - Safely handles YJS awareness state updates
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useYjs } from '../contexts/YjsContext';
import { useNetwork } from '../contexts/NetworkContext';
import { NetworkPayload } from '../types/messaging';

/**
 * Component props interface
 */
interface EditIndicatorProps {
  nodeId: string;
}

/**
 * Type-safe interface for users currently editing
 */
interface EditingUser {
  userId: string;
  color: string;
  timestamp: number;
}

/**
 * Type-safe interface for awareness state
 */
interface AwarenessState {
  userId: string;
  editingNode?: string | null;
  user?: { id: string; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Type-safe interface for edit status payload
 */
interface EditStatusPayload extends NetworkPayload {
  nodeId: string;
  users: Array<{ userId: string; timestamp?: number; [key: string]: unknown }>;
}

/**
 * Type guard for edit status payload
 */
function isEditStatusPayload(payload: NetworkPayload): payload is EditStatusPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'nodeId' in payload &&
    typeof payload.nodeId === 'string' &&
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

const EditIndicator: React.FC<EditIndicatorProps> = ({ nodeId }) => {
  const { ydoc, connectedUsers, isFeatureEnabled } = useYjs();
  const { networkAdapter } = useNetwork();
  const [editingUsers, setEditingUsers] = useState<EditingUser[]>([]);
  
  // Generate a consistent color for each user
  const getUserColor = useCallback((userId: string) => {
    // Simple hash function to generate a color
    const hash = userId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Convert to HSL color (keeping saturation and lightness constant)
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }, []);
  
  // Process YJS awareness states
  const processAwarenessStates = useCallback((states: Map<number, unknown>) => {
    try {
      const newEditingUsers: EditingUser[] = [];
      
      states.forEach((stateData, clientId) => {
        // Skip our own edits
        if (ydoc && clientId === ydoc.clientID) return;
        
        // Type-safe cast and validation
        const state = stateData as AwarenessState;
        
        // Only add users who are editing this specific node
        if (
          typeof state?.userId === 'string' && 
          state.editingNode === nodeId
        ) {
          newEditingUsers.push({
            userId: state.userId,
            color: getUserColor(state.userId),
            timestamp: Date.now()
          });
        }
      });
      
      setEditingUsers(newEditingUsers);
    } catch (error) {
      console.error('Error processing awareness states:', error);
    }
  }, [ydoc, nodeId, getUserColor]);
  
  // Handle YJS awareness updates
  useEffect(() => {
    if (!ydoc || !isFeatureEnabled) return;
    
    interface YjsAwarenessProvider {
      awareness: {
        getStates(): Map<number, unknown>;
        on(event: string, callback: () => void): void;
        off(event: string, callback: () => void): void;
      };
    }
    
    const awareness = (window as Window & { yjsWebsocketProvider?: YjsAwarenessProvider })
      .yjsWebsocketProvider?.awareness;
    if (!awareness) return;
    
    const updateEditingUsers = () => {
      try {
        const states = awareness.getStates() as Map<number, unknown>;
        processAwarenessStates(states);
      } catch (error) {
        console.error('Error updating editing users:', error);
      }
    };
    
    // Listen for awareness changes
    awareness.on('change', updateEditingUsers);
    
    // Initial update
    updateEditingUsers();
    
    // Clean up old entries periodically (if a user stops editing but doesn't clear the state)
    const cleanupInterval = setInterval(() => {
      setEditingUsers(prev => prev.filter(user => 
        Date.now() - user.timestamp < 30000 // Remove after 30 seconds of inactivity
      ));
    }, 10000);
    
    return () => {
      awareness.off('change', updateEditingUsers);
      clearInterval(cleanupInterval);
    };
  }, [ydoc, nodeId, isFeatureEnabled, processAwarenessStates]);
  
  // Handle standard network events for non-YJS mode
  useEffect(() => {
    if (isFeatureEnabled || !networkAdapter) return;
    
    const handleEditStatus = (payload: NetworkPayload) => {
      if (!isEditStatusPayload(payload) || payload.nodeId !== nodeId) return;
      
      // Convert to consistent format
      const newEditingUsers = payload.users.map(user => ({
        userId: user.userId,
        color: getUserColor(user.userId),
        timestamp: typeof user.timestamp === 'number' ? user.timestamp : Date.now()
      }));
      
      setEditingUsers(newEditingUsers);
    };
    
    // Subscribe to edit status events
    const unsubscribe = networkAdapter.subscribeToEvent('edit-status', handleEditStatus);
    
    // Cleanup old entries periodically
    const cleanupInterval = setInterval(() => {
      setEditingUsers(prev => prev.filter(user => 
        Date.now() - user.timestamp < 30000 // Remove after 30 seconds of inactivity
      ));
    }, 10000);
    
    return () => {
      unsubscribe();
      clearInterval(cleanupInterval);
    };
  }, [networkAdapter, isFeatureEnabled, nodeId, getUserColor]);
  
  if (editingUsers.length === 0) return null;
  
  return (
    <div 
      className="edit-indicator" 
      style={{ 
        position: 'absolute',
        top: '-28px',
        right: '0px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        pointerEvents: 'none',
        zIndex: 10,
      }}
      data-testid="edit-indicator"
    >
      {editingUsers.map((user) => (
        <div 
          key={user.userId} 
          title={`Being edited by ${connectedUsers.find(u => u.userId === user.userId)?.userId || 'User'}`}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: user.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            animation: 'pulse 1.5s infinite'
          }}
          data-testid={`editing-user-${user.userId}`}
        >
          {/* Display first letter of userId or a pencil icon */}
          {user.userId.charAt(0).toUpperCase()}
        </div>
      ))}
      
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
};

export default EditIndicator; 