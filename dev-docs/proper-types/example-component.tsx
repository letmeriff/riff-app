/**
 * Example Component Using Type-Safe Messaging
 * 
 * This is a reference implementation of a React component that demonstrates
 * best practices for working with the type-safe messaging architecture.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  NetworkPayload, 
  MessageUpdatePayload, 
  PresenceUpdatePayload,
  NodeId
} from '../types/messaging';
import { 
  isMessageUpdatePayload, 
  isPresenceUpdatePayload,
  parseNodeId,
  compareNodeIds
} from '../utils/typeGuards';
import { validatePayload } from '../services/networkService';
import { useNetwork } from '../contexts/NetworkContext';

// Define component props with proper types
interface ExampleComponentProps {
  nodeId: string;
  userId: string;
}

/**
 * ExampleComponent demonstrates the type-safe messaging patterns
 */
const ExampleComponent: React.FC<ExampleComponentProps> = ({ nodeId, userId }) => {
  const { networkAdapter, sendMessage } = useNetwork();
  const [messages, setMessages] = useState<Array<{ id: string | number; content: string; timestamp: string }>>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  // Parse node ID safely
  const parsedNodeId = parseNodeId(nodeId);
  
  // Type-safe message update handler
  const handleMessageUpdate = useCallback((payload: MessageUpdatePayload) => {
    // Check that payload is for the current node
    if (payload.new && parsedNodeId && compareNodeIds(payload.new.node_id, nodeId)) {
      // Update messages state
      setMessages(prev => {
        // Skip if message already exists
        if (prev.some(msg => msg.id === payload.new?.message_id)) {
          return prev;
        }
        
        return [
          ...prev,
          {
            id: payload.new.message_id,
            content: payload.new.content,
            timestamp: payload.new.timestamp
          }
        ];
      });
    }
  }, [nodeId, parsedNodeId]);
  
  // Type-safe presence update handler
  const handlePresenceUpdate = useCallback((payload: PresenceUpdatePayload) => {
    // Check that payload is for the current node
    if (parsedNodeId && compareNodeIds(payload.nodeId, nodeId)) {
      // Extract typing users (excluding current user)
      const typing = payload.presence
        .filter(user => user.isTyping && user.userId !== userId)
        .map(user => user.email);
      
      setTypingUsers(typing);
    }
  }, [nodeId, parsedNodeId, userId]);
  
  // Setup network event subscriptions
  useEffect(() => {
    if (!networkAdapter || !parsedNodeId) return;
    
    // Subscribe to message updates with validation
    const unsubscribeMessage = networkAdapter.subscribeToEvent('message-update', (payload: NetworkPayload) => {
      const validPayload = validatePayload(payload, isMessageUpdatePayload);
      if (validPayload) {
        handleMessageUpdate(validPayload);
      }
    });
    
    // Subscribe to presence updates with validation
    const unsubscribePresence = networkAdapter.subscribeToEvent('presence-update', (payload: NetworkPayload) => {
      const validPayload = validatePayload(payload, isPresenceUpdatePayload);
      if (validPayload) {
        handlePresenceUpdate(validPayload);
      }
    });
    
    // Clean up subscriptions
    return () => {
      unsubscribeMessage();
      unsubscribePresence();
    };
  }, [networkAdapter, parsedNodeId, handleMessageUpdate, handlePresenceUpdate]);
  
  // Update typing status
  useEffect(() => {
    if (!networkAdapter || !parsedNodeId) return;
    
    // Update presence when typing
    const isTyping = inputValue.length > 0;
    networkAdapter.updateUserPresence(nodeId, isTyping);
    
    // No cleanup needed - component unmount will handle it
  }, [networkAdapter, nodeId, parsedNodeId, inputValue]);
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  // Send a message
  const sendChatMessage = () => {
    if (!inputValue.trim() || !parsedNodeId) return;
    
    // Create a properly typed payload
    const payload: MessageUpdatePayload = {
      nodeId: parsedNodeId,
      new: {
        node_id: parsedNodeId,
        message_id: Date.now(),
        content: inputValue,
        is_user: true,
        timestamp: new Date().toISOString()
      }
    };
    
    // Send the message
    sendMessage('message-update', payload);
    
    // Clear input
    setInputValue('');
  };
  
  // Handle keyboard events
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };
  
  return (
    <div className="example-component">
      <div className="messages-container">
        {messages.map(message => (
          <div key={message.id} className="message">
            <div className="message-content">{message.content}</div>
            <div className="message-timestamp">{new Date(message.timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
      
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.length === 1
            ? `${typingUsers[0]} is typing...`
            : `${typingUsers.join(', ')} are typing...`
          }
        </div>
      )}
      
      <div className="input-container">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
        />
        <button onClick={sendChatMessage}>Send</button>
      </div>
    </div>
  );
};

export default ExampleComponent; 