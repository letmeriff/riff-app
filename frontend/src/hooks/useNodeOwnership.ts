import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useNetwork } from '../contexts/NetworkContext';
import {
  useOwnershipUpdateEvent,
  useTransferErrorEvent,
} from '../contexts/NetworkContext';
import {
  OwnershipUpdatePayload,
  TransferErrorPayload,
} from '../types/messaging';
import {
  parseNodeId,
  compareNodeIds,
  isOwnershipUpdatePayload,
  isTransferErrorPayload,
} from '../utils/typeGuards';
import { validatePayload } from '../services/networkService';
import { supabase } from '../services/supabase';

export const useNodeOwnership = (nodeId: string | null, userId: string) => {
  const [isOwner, setIsOwner] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const { socket } = useSocket();
  const { networkAdapter } = useNetwork();

  const parsedNodeId = parseNodeId(nodeId);

  // Ownership update handler
  const handleOwnershipUpdate = useCallback(
    (payload: OwnershipUpdatePayload) => {
      console.log('Ownership update received:', payload);

      if (parsedNodeId && compareNodeIds(payload.nodeId, nodeId)) {
        setIsOwner(payload.ownerId === userId);

        // No need to call fetchNodeDetails here as it's called in useNodeDetails
      }
    },
    [nodeId, parsedNodeId, userId]
  );

  // Transfer error handler
  const handleTransferError = useCallback(
    (payload: TransferErrorPayload) => {
      if (parsedNodeId && compareNodeIds(payload.nodeId, nodeId)) {
        console.error('Ownership transfer error:', payload.error);
        alert(`Failed to transfer ownership: ${payload.error}`);
        setIsTransferring(false);
      }
    },
    [nodeId, parsedNodeId]
  );

  // Register event subscriptions
  const _subscribeToOwnershipUpdates = useOwnershipUpdateEvent(
    handleOwnershipUpdate
  );
  const _subscribeToTransferErrors = useTransferErrorEvent(handleTransferError);

  // Check initial ownership when nodeId changes
  useEffect(() => {
    if (!nodeId) {
      setIsOwner(false);
      return;
    }

    const checkOwnership = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_nodes')
          .select('owner_id')
          .eq('node_id', parseInt(nodeId))
          .single();

        if (error) {
          console.error('Error checking node ownership:', error);
          throw error;
        }

        const isOwnerValue = data.owner_id === userId;
        console.log(
          `User ${userId} is ${isOwnerValue ? '' : 'not '}the owner of node ${nodeId}`
        );
        setIsOwner(isOwnerValue);
      } catch (error) {
        console.error('Error checking node ownership:', error);
      }
    };

    checkOwnership();

    // Set up real-time updates for ownership changes
    if (networkAdapter) {
      const unsubscribeOwnership = networkAdapter.subscribeToEvent(
        'ownership-update',
        (payload) => {
          const validPayload = validatePayload(
            payload,
            isOwnershipUpdatePayload
          );
          if (validPayload) {
            handleOwnershipUpdate(validPayload);
          }
        }
      );

      const unsubscribeTransferError = networkAdapter.subscribeToEvent(
        'transfer-ownership-error',
        (payload) => {
          const validPayload = validatePayload(payload, isTransferErrorPayload);
          if (validPayload) {
            handleTransferError(validPayload);
          }
        }
      );

      return () => {
        unsubscribeOwnership();
        unsubscribeTransferError();
      };
    }
  }, [
    nodeId,
    userId,
    networkAdapter,
    handleOwnershipUpdate,
    handleTransferError,
  ]);

  const handleTransferOwnership = (newOwnerId: string) => {
    if (!nodeId || !isOwner || !newOwnerId || !socket) return;

    setIsTransferring(true);
    try {
      socket.emit('transfer-ownership', {
        nodeId: parseInt(nodeId),
        newOwnerId: newOwnerId,
      });

      // Reset the selection
      setSelectedNewOwner('');
    } catch (error) {
      console.error('Error initiating ownership transfer:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'An error occurred while transferring ownership'
      );
      setIsTransferring(false);
    }
  };

  return {
    isOwner,
    isTransferring,
    selectedNewOwner,
    setSelectedNewOwner,
    handleTransferOwnership,
  };
};
