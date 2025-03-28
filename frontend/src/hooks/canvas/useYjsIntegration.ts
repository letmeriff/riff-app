/**
 * useYjsIntegration Hook
 * 
 * This hook provides integration with Yjs for real-time collaboration features.
 * It handles awareness, offline support, and synchronization with the server.
 */

import { useState, useCallback, useEffect } from 'react';
import { useYjs } from '../../contexts/YjsContext';
import { 
  UseYjsIntegrationResult,
  UserPresence 
} from '../../types/canvas';
import { SyncStatus } from '../../utils/yjsOfflineSupport';
import { debounce } from 'lodash';

/**
 * Hook for Yjs integration and collaboration features
 * Provides functionality for real-time collaboration, offline support,
 * and synchronization with the server
 */
export function useYjsIntegration(): UseYjsIntegrationResult {
  // Get Yjs context
  const yjs = useYjs();
  
  // States for collaboration features
  const [isConnected, setIsConnected] = useState<boolean>(yjs?.isConnected || false);
  const [isOffline, setIsOffline] = useState<boolean>(yjs?.isOffline || false);
  const [offlineChangesCount, setOfflineChangesCount] = useState<number>(yjs?.offlineChangesCount || 0);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<UserPresence[]>([]);
  
  // Update states based on Yjs context changes
  useEffect(() => {
    if (!yjs) return;
    
    setIsConnected(yjs.isConnected);
    setIsOffline(yjs.isOffline);
    setOfflineChangesCount(yjs.offlineChangesCount);
    
    // Derive sync status text from Yjs status
    if (yjs.syncStatus) {
      if (yjs.syncStatus.syncInProgress) {
        setSyncStatus('Syncing');
      } else if (yjs.syncStatus.pendingChanges) {
        setSyncStatus('Pending changes');
      } else if (yjs.syncStatus.lastSyncedAt) {
        const lastSynced = new Date(yjs.syncStatus.lastSyncedAt);
        setSyncStatus(`Synced at ${lastSynced.toLocaleTimeString()}`);
      } else {
        setSyncStatus(null);
      }
    } else {
      setSyncStatus(null);
    }
    
    // Transform connected users to UserPresence format
    if (yjs.connectedUsers && yjs.connectedUsers.length > 0) {
      const transformedUsers: UserPresence[] = yjs.connectedUsers.map(user => {
        // Basic user presence information
        return {
          userId: user.userId,
          email: user.userId, // Use userId as fallback for email
          name: user.userId, // Use userId as fallback for name
          isTyping: false,
          lastActive: new Date().toISOString(),
          color: getRandomColor(user.userId), // Generate a color based on userId
        };
      });
      
      setConnectedUsers(transformedUsers);
    } else {
      setConnectedUsers([]);
    }
  }, [
    yjs, 
    yjs?.isConnected, 
    yjs?.isOffline, 
    yjs?.offlineChangesCount, 
    yjs?.syncStatus,
    yjs?.connectedUsers
  ]);
  
  // Debounced awareness update to avoid excessive updates
  const updateAwareness = useCallback(
    debounce((data: any) => {
      if (!yjs) return;
      
      try {
        yjs.updateAwareness(data);
      } catch (error) {
        console.error('Error updating awareness:', error);
      }
    }, 50),
    [yjs]
  );
  
  // Force synchronization of changes with the server
  const forceSync = useCallback(async (): Promise<boolean> => {
    if (!yjs) return false;
    
    try {
      // Update sync status
      setSyncStatus('Syncing');
      
      // Attempt to force sync through Yjs context
      const result = await yjs.forceSync();
      
      // Update sync status based on result
      if (result) {
        setSyncStatus('Synced');
        setOfflineChangesCount(0);
      } else {
        setSyncStatus('Sync failed');
      }
      
      return result;
    } catch (error) {
      console.error('Error forcing sync:', error);
      setSyncStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [yjs]);
  
  // Update cursor position in awareness
  const updateCursorPosition = useCallback((position: { x: number; y: number }) => {
    updateAwareness({ cursor: position });
  }, [updateAwareness]);
  
  // Update typing status in awareness
  const setTypingStatus = useCallback((isTyping: boolean) => {
    updateAwareness({ isTyping });
  }, [updateAwareness]);
  
  return {
    isConnected,
    isOffline,
    offlineChangesCount,
    syncStatus,
    connectedUsers,
    updateAwareness,
    forceSync,
    updateCursorPosition,
    setTypingStatus
  };
}

/**
 * Helper function to generate a consistent color from a string
 */
function getRandomColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate HSL color with high saturation and medium lightness for good contrast
  const h = Math.abs(hash % 360);
  const s = 75;  // High saturation
  const l = 60;  // Medium lightness
  
  return `hsl(${h}, ${s}%, ${l}%)`;
} 