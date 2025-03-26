import React, { useEffect, useState } from 'react';
import { useYjs } from '../contexts/YjsContext';

interface EditIndicatorProps {
  nodeId: string;
}

interface EditingUser {
  userId: string;
  color: string;
  timestamp: number;
}

const EditIndicator: React.FC<EditIndicatorProps> = ({ nodeId }) => {
  const { ydoc, connectedUsers, isFeatureEnabled } = useYjs();
  const [editingUsers, setEditingUsers] = useState<EditingUser[]>([]);
  
  // Generate a consistent color for each user
  const getUserColor = (userId: string) => {
    // Simple hash function to generate a color
    const hash = userId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Convert to HSL color (keeping saturation and lightness constant)
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };
  
  useEffect(() => {
    if (!ydoc || !isFeatureEnabled) return;
    
    const awareness = (window as any).yjsWebsocketProvider?.awareness;
    if (!awareness) return;
    
    const updateEditingUsers = () => {
      try {
        const states = awareness.getStates() as Map<number, any>;
        const newEditingUsers: EditingUser[] = [];
        
        states.forEach((state, clientId) => {
          // Skip our own edits
          if (clientId === ydoc.clientID) return;
          
          // Only add users who are editing this specific node
          if (state?.editingNode === nodeId && state.userId) {
            newEditingUsers.push({
              userId: state.userId,
              color: getUserColor(state.userId),
              timestamp: Date.now()
            });
          }
        });
        
        setEditingUsers(newEditingUsers);
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
  }, [ydoc, nodeId, isFeatureEnabled]);
  
  if (!isFeatureEnabled || editingUsers.length === 0) return null;
  
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
    >
      {editingUsers.map((user, index) => (
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