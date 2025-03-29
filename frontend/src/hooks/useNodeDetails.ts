import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useNetwork } from '../contexts/NetworkContext';
import { useNodeUpdateEvent } from '../contexts/NetworkContext';
import {
  ChatNode,
  updateNodeTitle,
  updateNodeDescription,
} from '../services/nodeService';
import { NodeUpdatePayload } from '../types/messaging';
import { parseNodeId, isNodeUpdatePayload } from '../utils/typeGuards';
import { validatePayload } from '../services/networkService';

export const useNodeDetails = (
  nodeId: string | null,
  nodeTitle: string | null
) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [currentNode, setCurrentNode] = useState<ChatNode | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const { networkAdapter } = useNetwork();

  const parsedNodeId = parseNodeId(nodeId);

  // Node update handler
  const handleNodeUpdate = useCallback(
    (payload: NodeUpdatePayload) => {
      if (payload.new && parsedNodeId && payload.new.node_id === parsedNodeId) {
        console.log('Node update detected, refreshing node details');
        fetchNodeDetails();
      }
    },
    [nodeId, parsedNodeId]
  );

  // Register event subscription
  const _subscribeToNodeUpdates = useNodeUpdateEvent(handleNodeUpdate);

  // Update editedTitle and editedDescription when nodeTitle or currentNode changes
  useEffect(() => {
    if (nodeTitle) {
      setEditedTitle(nodeTitle);
    }
  }, [nodeTitle]);

  useEffect(() => {
    if (currentNode) {
      setEditedDescription(
        currentNode.description || 'No description available.'
      );
    }
  }, [currentNode]);

  // Fetch node details when nodeId changes
  useEffect(() => {
    if (!nodeId) {
      setCurrentNode(null);
      return;
    }

    fetchNodeDetails();

    // Set up real-time updates for node updates
    if (networkAdapter) {
      const unsubscribeNodeUpdate = networkAdapter.subscribeToEvent(
        'node-update',
        (payload) => {
          const validPayload = validatePayload(payload, isNodeUpdatePayload);
          if (validPayload) {
            handleNodeUpdate(validPayload);
          }
        }
      );

      return () => {
        unsubscribeNodeUpdate();
      };
    }
  }, [nodeId, networkAdapter, handleNodeUpdate]);

  // Function to fetch node details
  const fetchNodeDetails = async () => {
    if (!nodeId) return;

    try {
      console.log(`Fetching node details for node ${nodeId}`);
      const { data, error } = await supabase
        .from('chat_nodes')
        .select('*')
        .eq('node_id', parseInt(nodeId))
        .single();

      if (error) {
        console.error('Error fetching node details:', error);
        throw error;
      }

      setCurrentNode(data);
    } catch (error) {
      console.error('Error fetching node details:', error);
    }
  };

  const handleTitleEdit = () => {
    if (nodeId) {
      setIsEditingTitle(true);
      // Focus the input after a brief delay to allow rendering
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  };

  const handleTitleSave = async () => {
    if (nodeId && editedTitle.trim()) {
      try {
        await updateNodeTitle(parseInt(nodeId), editedTitle.trim());
        setIsEditingTitle(false);
        // The actual UI update will happen through the real-time subscription
      } catch (error) {
        console.error('Error updating node title:', error);
      }
    }
  };

  const handleTitleCancel = () => {
    if (nodeTitle) {
      setEditedTitle(nodeTitle);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const handleDescriptionEdit = () => {
    if (nodeId) {
      setIsEditingDescription(true);
      // Focus the textarea after a brief delay to allow rendering
      setTimeout(() => {
        descriptionInputRef.current?.focus();
      }, 50);
    }
  };

  const handleDescriptionSave = async () => {
    if (nodeId && editedDescription.trim()) {
      try {
        await updateNodeDescription(parseInt(nodeId), editedDescription.trim());
        setIsEditingDescription(false);
        // The actual UI update will happen through the real-time subscription
      } catch (error) {
        console.error('Error updating node description:', error);
      }
    }
  };

  const handleDescriptionCancel = () => {
    if (currentNode && currentNode.description) {
      setEditedDescription(currentNode.description);
    } else {
      setEditedDescription('No description available.');
    }
    setIsEditingDescription(false);
  };

  const handleDescriptionKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Escape') {
      handleDescriptionCancel();
    }
  };

  return {
    currentNode,
    isEditingTitle,
    editedTitle,
    isHeaderExpanded,
    setIsHeaderExpanded,
    isEditingDescription,
    editedDescription,
    titleInputRef,
    descriptionInputRef,
    handleTitleEdit,
    handleTitleSave,
    handleTitleCancel,
    handleTitleKeyDown,
    handleDescriptionEdit,
    handleDescriptionSave,
    handleDescriptionCancel,
    handleDescriptionKeyDown,
    setEditedTitle,
    setEditedDescription,
  };
};
