/**
 * UserCursors Component
 * 
 * This component displays real-time user cursor positions during collaboration.
 * 
 * Implementation Notes:
 * - Uses type-safe network event handling
 * - Validates cursor position data types
 * - Maps awareness state updates to type-safe interfaces
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useYjs } from '../contexts/YjsContext';
import { useNetwork } from '../contexts/NetworkContext';
import { NetworkPayload } from '../types/messaging';

/**
 * Type-safe interface for cursor position data
 */
interface CursorPosition {
  userId: string;
  clientId: number;
  x: number;
  y: number;
  color: string;
}

/**
 * Type-safe interface for awareness state
 */
interface AwarenessState {
  userId: string;
  user?: { id: string; [key: string]: unknown };
  cursor?: { x: number; y: number } | null;
  [key: string]: unknown;
}

/**
 * Type guard to validate cursor position data
 */
function isCursorPositionValid(
  userId: unknown, 
  clientId: unknown, 
  cursor: unknown
): boolean {
  return (
    typeof userId === 'string' &&
    typeof clientId === 'number' &&
    cursor !== null &&
    typeof cursor === 'object' &&
    cursor !== null &&
    'x' in cursor &&
    'y' in cursor &&
    typeof cursor.x === 'number' &&
    typeof cursor.y === 'number'
  );
}

const UserCursors: React.FC = () => {
  const { ydoc, connectedUsers, isFeatureEnabled } = useYjs();
  const { networkAdapter } = useNetwork();
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  
  // Generate a consistent color for each user
  const getUserColor = useCallback((userId: string) => {
    // Simple hash function to generate a color
    const hash = userId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Convert to HSL color (keeping saturation and lightness constant)
    // This ensures nice, distinct colors with good contrast
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }, []);
  
  // Process awareness state into type-safe cursor positions
  const processAwarenessState = useCallback((states: Map<number, unknown>) => {
    try {
      const newCursors: CursorPosition[] = [];
      
      states.forEach((stateData, clientId) => {
        // Skip our own cursor
        if (ydoc && clientId === ydoc.clientID) return;
        
        // Validate state data structure
        const state = stateData as AwarenessState;
        
        // Only add users with cursor position data
        if (isCursorPositionValid(state?.userId, clientId, state?.cursor)) {
          const cursor = state.cursor as { x: number; y: number };
          
          newCursors.push({
            userId: state.userId,
            clientId,
            x: cursor.x,
            y: cursor.y,
            color: getUserColor(state.userId)
          });
        }
      });
      
      setCursors(newCursors);
    } catch (error) {
      console.error('Error processing awareness states:', error);
    }
  }, [ydoc, getUserColor]);
  
  // Listen for awareness updates to track cursor positions
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
    
    const updateCursors = () => {
      try {
        const states = awareness.getStates() as Map<number, unknown>;
        processAwarenessState(states);
      } catch (error) {
        console.error('Error updating cursors:', error);
      }
    };
    
    // Listen for awareness changes with type-safe handling
    awareness.on('change', updateCursors);
    
    // Initial update
    updateCursors();
    
    return () => {
      awareness.off('change', updateCursors);
    };
  }, [ydoc, isFeatureEnabled, processAwarenessState]);
  
  // Subscribe to cursor-update events for non-YJS implementations
  useEffect(() => {
    if (!networkAdapter || isFeatureEnabled) return;
    
    const handleCursorUpdate = (payload: NetworkPayload) => {
      if (!payload || typeof payload !== 'object') return;
      
      try {
        // Parse and validate cursor data from payload
        const cursorData = payload as { userId?: string; position?: { x: number; y: number } };
        
        if (
          typeof cursorData.userId === 'string' && 
          cursorData.position && 
          typeof cursorData.position?.x === 'number' &&
          typeof cursorData.position?.y === 'number'
        ) {
          // Update cursors array
          setCursors(prev => {
            // Remove any previous cursor for this user
            const filtered = prev.filter(c => c.userId !== cursorData.userId);
            
            // Add the new cursor position
            return [
              ...filtered,
              {
                userId: cursorData.userId as string,
                clientId: Date.now(), // Use timestamp as clientId for non-YJS
                x: cursorData.position!.x,
                y: cursorData.position!.y,
                color: getUserColor(cursorData.userId as string)
              }
            ];
          });
        }
      } catch (error) {
        console.error('Error handling cursor update:', error);
      }
    };
    
    // Subscribe to cursor updates
    const unsubscribe = networkAdapter.subscribeToEvent('cursor-update', handleCursorUpdate);
    
    return () => {
      unsubscribe();
    };
  }, [networkAdapter, isFeatureEnabled, getUserColor]);
  
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
            {(() => {
              const user = connectedUsers.find(u => u.clientId === cursor.clientId);
              return typeof user?.userId === 'string' ? user.userId : 'User';
            })()}
          </div>
        </div>
      ))}
    </>
  );
};

export default UserCursors; 