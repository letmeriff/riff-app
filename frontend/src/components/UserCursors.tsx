import React, { useEffect, useState } from 'react';
import { useYjs } from '../contexts/YjsContext';

interface CursorPosition {
  userId: string;
  clientId: number;
  x: number;
  y: number;
  color: string;
}

const UserCursors: React.FC = () => {
  const { ydoc, connectedUsers, isFeatureEnabled } = useYjs();
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  
  // Generate a consistent color for each user
  const getUserColor = (userId: string) => {
    // Simple hash function to generate a color
    const hash = userId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Convert to HSL color (keeping saturation and lightness constant)
    // This ensures nice, distinct colors with good contrast
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };
  
  // Listen for awareness updates to track cursor positions
  useEffect(() => {
    if (!ydoc || !isFeatureEnabled) return;
    
    const awareness = (window as any).yjsWebsocketProvider?.awareness;
    if (!awareness) return;
    
    const updateCursors = () => {
      try {
        const states = awareness.getStates() as Map<number, any>;
        const newCursors: CursorPosition[] = [];
        
        states.forEach((state, clientId) => {
          // Skip our own cursor
          if (clientId === ydoc.clientID) return;
          
          // Only add users with cursor position data
          if (state?.cursor && state.userId) {
            newCursors.push({
              userId: state.userId,
              clientId,
              x: state.cursor.x,
              y: state.cursor.y,
              color: getUserColor(state.userId)
            });
          }
        });
        
        setCursors(newCursors);
      } catch (error) {
        console.error('Error updating cursors:', error);
      }
    };
    
    // Listen for awareness changes
    awareness.on('change', updateCursors);
    
    // Initial update
    updateCursors();
    
    return () => {
      awareness.off('change', updateCursors);
    };
  }, [ydoc, isFeatureEnabled]);
  
  if (!isFeatureEnabled || cursors.length === 0) return null;
  
  return (
    <>
      {cursors.map((cursor) => (
        <div
          key={cursor.clientId}
          style={{
            position: 'absolute',
            left: cursor.x,
            top: cursor.y,
            pointerEvents: 'none',
            zIndex: 1000,
            transition: 'transform 0.1s ease-out',
          }}
        >
          {/* Cursor icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ 
              transform: 'translate(-2, -2)',
              filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.3))'
            }}
          >
            <path
              d="M2 2L10 14L14 10L22 22L2 2Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          
          {/* Username label */}
          <div
            style={{
              position: 'absolute',
              left: '10px',
              top: '8px',
              background: cursor.color,
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              boxShadow: '0px 1px 3px rgba(0,0,0,0.2)',
              maxWidth: '150px',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {connectedUsers.find(u => u.clientId === cursor.clientId)?.userId || 'User'}
          </div>
        </div>
      ))}
    </>
  );
};

export default UserCursors; 