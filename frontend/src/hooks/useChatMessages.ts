import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useNetwork } from '../contexts/NetworkContext';
import { useMessageUpdateEvent } from '../contexts/NetworkContext';
import { MessageUpdatePayload, ChatMessage } from '../types/messaging';
import { parseNodeId, isMessageUpdatePayload } from '../utils/typeGuards';
import { validatePayload } from '../services/networkService';

export const useChatMessages = (nodeId: string | null, _userId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { networkAdapter } = useNetwork();

  const parsedNodeId = parseNodeId(nodeId);

  // Message update handler
  const handleMessageUpdate = useCallback(
    (payload: MessageUpdatePayload) => {
      console.log('Message update received:', payload);
      console.log(
        'Current nodeId:',
        nodeId,
        'Payload node_id:',
        payload.new?.node_id
      );

      if (payload.new && parsedNodeId && payload.new.node_id === parsedNodeId) {
        setMessages((prev) => {
          if (!payload.new) {
            console.log('No new message data, not adding anything');
            return prev;
          }

          if (prev.some((msg) => msg.message_id === payload.new!.message_id)) {
            console.log('Message already exists in state, not adding again');
            return prev;
          }

          console.log('Adding new message to state');
          // Convert the network payload to a ChatMessage with compatible properties
          const newMessage: ChatMessage = {
            message_id: payload.new.message_id,
            content: payload.new.content,
            is_user: payload.new.is_user,
            timestamp: payload.new.timestamp,
            user_id: payload.new.user_id as string | undefined,
            email: payload.new.email as string | undefined,
          };
          return [...prev, newMessage];
        });
      } else {
        console.log('Message is for a different node, ignoring');
      }
    },
    [nodeId, parsedNodeId]
  );

  // Register event subscription
  const _subscribeToMessageUpdates = useMessageUpdateEvent(handleMessageUpdate);

  useEffect(() => {
    if (!nodeId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        console.log(`Fetching messages for node ${nodeId}`);
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('node_id', parseInt(nodeId))
          .order('timestamp', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          throw error;
        }
        console.log(`Fetched ${data?.length || 0} messages for node ${nodeId}`);
        setMessages(data || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();

    // Set up real-time updates for messages
    if (networkAdapter) {
      const unsubscribeMessage = networkAdapter.subscribeToEvent(
        'message-update',
        (payload) => {
          const validPayload = validatePayload(payload, isMessageUpdatePayload);
          if (validPayload) {
            handleMessageUpdate(validPayload);
          }
        }
      );

      return () => {
        unsubscribeMessage();
      };
    }
  }, [nodeId, networkAdapter, handleMessageUpdate]);

  const handleSendMessage = async () => {
    if (!input.trim() || !nodeId) return;

    // Don't modify the message text with references to attachments
    const messageText = input;
    setInput('');

    // Temporarily add the message to the UI for immediate feedback
    const tempMessage: ChatMessage = {
      message_id: Date.now(), // Temporary ID
      node_id: parseInt(nodeId),
      content: messageText,
      is_user: true,
      timestamp: new Date().toISOString(),
    };

    setMessages((msgs) => [...msgs, tempMessage]);

    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      setLoading(true);

      // Send the message to the server
      const response = await fetch(`http://localhost:3001/api/chat/${nodeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: messageText,
          attachments: [], // This will be handled by the ChatUI component
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      // Just consume the response body without assigning the unused data variable
      await response.json();

      // Server will broadcast the message via socket, so no need to update state here
    } catch (error) {
      console.error('Error sending message:', error);
      alert(
        'Error sending message: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );

      // Remove the temporary message on error
      setMessages((msgs) =>
        msgs.filter((msg) => msg.message_id !== tempMessage.message_id)
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    messages,
    input,
    setInput,
    loading,
    handleSendMessage,
  };
};
