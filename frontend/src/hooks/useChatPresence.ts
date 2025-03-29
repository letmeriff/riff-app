import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import { usePresenceUpdateEvent } from '../contexts/NetworkContext';
import { PresenceUpdatePayload, UserPresence } from '../types/messaging';
import {
  parseNodeId,
  compareNodeIds,
  isPresenceUpdatePayload,
} from '../utils/typeGuards';
import { validatePayload } from '../services/networkService';

export const useChatPresence = (nodeId: string | null, userId: string) => {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [presentUsers, setPresentUsers] = useState<UserPresence[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { networkAdapter, updateUserPresence } = useNetwork();

  const parsedNodeId = parseNodeId(nodeId);

  // Presence update handler
  const handlePresenceUpdate = useCallback(
    (payload: PresenceUpdatePayload) => {
      console.log('Presence update received:', payload);

      if (parsedNodeId && compareNodeIds(payload.nodeId, nodeId)) {
        // Extract emails of users who are typing (excluding the current user)
        const typing = payload.presence
          .filter((p: UserPresence) => p.isTyping && p.userId !== userId)
          .map((p: UserPresence) => p.email);

        setTypingUsers(typing);
        setPresentUsers(payload.presence);
      }
    },
    [nodeId, parsedNodeId, userId]
  );

  // Register event subscription
  const _subscribeToPresenceUpdates =
    usePresenceUpdateEvent(handlePresenceUpdate);

  // Set up real-time updates for presence
  useEffect(() => {
    if (!nodeId) {
      setTypingUsers([]);
      setPresentUsers([]);
      return;
    }

    if (networkAdapter) {
      const unsubscribePresence = networkAdapter.subscribeToEvent(
        'presence-update',
        (payload) => {
          const validPayload = validatePayload(
            payload,
            isPresenceUpdatePayload
          );
          if (validPayload) {
            handlePresenceUpdate(validPayload);
          }
        }
      );

      return () => {
        unsubscribePresence();
      };
    }
  }, [nodeId, networkAdapter, handlePresenceUpdate]);

  // Handle user typing with debounce
  const handleUserTyping = (isTyping: boolean) => {
    if (!nodeId) return;

    // Update typing status using network adapter
    updateUserPresence(nodeId, isTyping);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // If user is typing, set a timeout to stop typing indication after 2 seconds of inactivity
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        if (nodeId) {
          updateUserPresence(nodeId, false);
        }
      }, 2000);
    }
  };

  return {
    typingUsers,
    presentUsers,
    updateUserPresence: handleUserTyping,
  };
};
