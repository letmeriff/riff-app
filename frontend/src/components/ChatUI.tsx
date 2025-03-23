import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useSocket } from '../contexts/SocketContext';
import { ChatNode } from '../services/nodeService';

interface ChatMessage {
  message_id: number;
  node_id: number;
  content: string;
  is_user: boolean;
  timestamp: string;
}

interface UserPresence {
  userId: string;
  email: string;
  isTyping: boolean;
  lastActive: string;
}

interface ChatUIProps {
  nodeId: string | null; // Selected node's ID
  nodeTitle: string | null; // Selected node's title
  userId: string; // Current user's ID
}

const ChatUI: React.FC<ChatUIProps> = ({ nodeId, nodeTitle, userId }) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<ChatNode[]>([]);
  const [selectedPullNode, setSelectedPullNode] = useState<string>('');
  const [pullLoading, setPullLoading] = useState(false);
  const [pullMode, setPullMode] = useState<'full' | 'summary'>('full');
  const [branchLoading, setBranchLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [presentUsers, setPresentUsers] = useState<UserPresence[]>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch available nodes for the Pull dropdown
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_nodes')
          .select('*');
        
        if (error) throw error;
        setNodes(data || []);
      } catch (error) {
        console.error('Error fetching nodes:', error);
      }
    };

    fetchNodes();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch messages when the node changes and set up real-time updates
  useEffect(() => {
    if (!nodeId) {
      setMessages([]);
      setTypingUsers([]);
      setIsOwner(false);
      setPresentUsers([]);
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

    const fetchNodeDetails = async () => {
      try {
        console.log(`Fetching node details for node ${nodeId}`);
        const { data, error } = await supabase
          .from('chat_nodes')
          .select('owner_id')
          .eq('node_id', parseInt(nodeId))
          .single();
        
        if (error) {
          console.error('Error fetching node details:', error);
          throw error;
        }
        const isOwnerValue = data.owner_id === userId;
        console.log(`User ${userId} is ${isOwnerValue ? '' : 'not '}the owner of node ${nodeId}`);
        setIsOwner(isOwnerValue);
      } catch (error) {
        console.error('Error fetching node details:', error);
      }
    };

    fetchMessages();
    fetchNodeDetails();

    // Set up real-time updates for messages
    if (socket) {
      // Use Socket.IO for real-time updates
      socket.on('message-update', (payload) => {
        console.log('Socket: Message update received:', payload);
        console.log('Current nodeId:', nodeId, 'Payload node_id:', payload.new?.node_id);
        if (payload.new && payload.new.node_id === parseInt(nodeId)) {
          setMessages((prev) => {
            // Check if this message is already in the list to avoid duplicates
            if (prev.some((msg) => msg.message_id === payload.new.message_id)) {
              console.log('Message already exists in state, not adding again');
              return prev;
            }
            console.log('Adding new message to state');
            return [...prev, payload.new as ChatMessage];
          });
        } else {
          console.log('Message is for a different node, ignoring');
        }
      });

      socket.on('presence-update', (payload) => {
        console.log('Socket: Presence update received in ChatUI:', payload);
        if (payload.nodeId.toString() === nodeId) {
          // Extract emails of users who are typing (excluding the current user)
          const typing = payload.presence
            .filter((p: UserPresence) => p.isTyping && p.userId !== userId)
            .map((p: UserPresence) => p.email);
          
          setTypingUsers(typing);
          setPresentUsers(payload.presence);
        }
      });

      // Listen for ownership updates
      socket.on('ownership-update', (payload) => {
        console.log('Socket: Ownership update received:', payload);
        if (payload.nodeId.toString() === nodeId) {
          setIsOwner(payload.ownerId === userId);
        }
      });

      socket.on('transfer-ownership-error', (payload) => {
        if (payload.nodeId.toString() === nodeId) {
          console.error('Ownership transfer error:', payload.error);
          alert(`Failed to transfer ownership: ${payload.error}`);
          setIsTransferring(false);
        }
      });

      return () => {
        socket.off('message-update');
        socket.off('presence-update');
        socket.off('ownership-update');
        socket.off('transfer-ownership-error');
      };
    } else {
      // Fallback to Supabase real-time if Socket.IO is not available
      const subscription = supabase
        .channel(`chat_messages:node_${nodeId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `node_id=eq.${nodeId}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as ChatMessage]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [nodeId, socket, userId]);

  // Handle input changes and emit typing events
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (!socket || !nodeId || !isOwner) return;

    // Emit typing event
    socket.emit('typing', { nodeId: parseInt(nodeId), isTyping: true });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set a timeout to stop typing indication after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (socket && nodeId) {
        socket.emit('typing', { nodeId: parseInt(nodeId), isTyping: false });
      }
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !nodeId || !isOwner) return;

    setLoading(true);
    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      const response = await fetch(`http://localhost:3001/api/chat/${nodeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const { response: aiResponse } = await response.json();
      console.log('AI Response:', aiResponse); // For debugging
      setInput('');

      // Stop typing indication after sending the message
      if (socket) {
        socket.emit('typing', { nodeId: parseInt(nodeId), isTyping: false });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error instanceof Error ? error.message : 'An error occurred sending your message');
    } finally {
      setLoading(false);
    }
  };

  const handlePullContext = async () => {
    if (!nodeId || !selectedPullNode) return;
    
    setPullLoading(true);
    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      // For summary mode, first get a summary of the selected node
      if (pullMode === 'summary') {
        const summaryResponse = await fetch(
          `http://localhost:3001/api/summarize/${selectedPullNode}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        if (!summaryResponse.ok) {
          const errorData = await summaryResponse.json();
          throw new Error(errorData.error || 'Failed to generate summary');
        }
        
        const { summary } = await summaryResponse.json();
        
        // Add summary message directly
        const { error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            node_id: parseInt(nodeId),
            content: `Summary pulled from Node ${selectedPullNode}:\n\n${summary}`,
            is_user: false,
            timestamp: new Date().toISOString(),
          });
        
        if (insertError) throw insertError;
      }
      
      // Always establish the pull relationship
      const pullResponse = await fetch('http://localhost:3001/api/context/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetNodeId: parseInt(nodeId),
          originNodeId: parseInt(selectedPullNode),
          mode: pullMode
        }),
      });
      
      if (!pullResponse.ok) {
        const errorData = await pullResponse.json();
        throw new Error(errorData.error || 'Failed to pull context');
      }
      
      // Reset the pull node selection
      setSelectedPullNode('');
    } catch (error) {
      console.error('Error pulling context:', error);
      alert(error instanceof Error ? error.message : 'An error occurred while pulling context');
    } finally {
      setPullLoading(false);
    }
  };

  const handleBranch = async () => {
    if (!nodeId) return;
    
    setBranchLoading(true);
    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      const response = await fetch('http://localhost:3001/api/branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ originNodeId: parseInt(nodeId) }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to branch node');
      }
      
      const { newNodeId } = await response.json();
      
      // Dispatch a custom event to notify other components that node selection should change
      window.dispatchEvent(
        new CustomEvent('select-node', { 
          detail: { nodeId: newNodeId.toString() } 
        })
      );
    } catch (error) {
      console.error('Error branching node:', error);
      alert(error instanceof Error ? error.message : 'An error occurred while branching the node');
    } finally {
      setBranchLoading(false);
    }
  };

  const handleTransferOwnership = () => {
    if (!nodeId || !isOwner || !selectedNewOwner || !socket) return;
    
    setIsTransferring(true);
    try {
      socket.emit('transfer-ownership', {
        nodeId: parseInt(nodeId),
        newOwnerId: selectedNewOwner
      });
      
      // Reset the selection
      setSelectedNewOwner('');
    } catch (error) {
      console.error('Error initiating ownership transfer:', error);
      alert(error instanceof Error ? error.message : 'An error occurred while transferring ownership');
      setIsTransferring(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#f0f0f0',
        padding: '10px',
      }}
    >
      <div
        style={{
          padding: '10px',
          background: '#fff',
          borderBottom: '1px solid #ddd',
          fontWeight: 'bold',
          fontSize: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          {nodeId ? `Chat for ${nodeTitle} (ID: ${nodeId})` : 'Select a node to start chatting'}
        </div>
        {nodeId && (
          <div style={{ fontSize: '14px', color: '#777' }}>
            {isOwner ? 'You are the owner' : 'You are viewing (read-only)'}
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxHeight: 'calc(100vh - 220px)', // Fixed height with space for header and controls
        }}
      >
        {messages.map((message) => (
          <div
            key={message.message_id}
            style={{
              alignSelf: message.is_user ? 'flex-end' : 'flex-start',
              background: message.is_user ? '#007bff' : '#e0e0e0',
              color: message.is_user ? '#fff' : '#000',
              padding: '8px 12px',
              borderRadius: '10px',
              maxWidth: '70%',
              whiteSpace: 'pre-wrap',
            }}
          >
            {message.content}
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', color: '#777' }}>
            AI is typing...
          </div>
        )}
        {typingUsers.length > 0 && (
          <div style={{ alignSelf: 'flex-start', color: '#777' }}>
            {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: '10px',
          background: '#fff',
          borderTop: '1px solid #ddd',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button disabled style={{ padding: '5px 10px', background: '#ddd' }}>
            Attach
          </button>
          
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <select
              value={selectedPullNode}
              onChange={(e) => setSelectedPullNode(e.target.value)}
              style={{ padding: '5px' }}
              disabled={!nodeId || pullLoading}
            >
              <option value="">Select a node to pull from</option>
              {nodes
                .filter((node) => node.node_id.toString() !== nodeId)
                .map((node) => (
                  <option key={node.node_id} value={node.node_id}>
                    {node.title} (ID: {node.node_id})
                  </option>
                ))}
            </select>
            <select
              value={pullMode}
              onChange={(e) => setPullMode(e.target.value as 'full' | 'summary')}
              style={{ padding: '5px' }}
              disabled={!nodeId || pullLoading || !selectedPullNode}
            >
              <option value="full">Full History</option>
              <option value="summary">Summary</option>
            </select>
            <button
              onClick={handlePullContext}
              style={{
                padding: '5px 10px',
                background: selectedPullNode && !pullLoading ? '#007bff' : '#ddd',
                color: selectedPullNode && !pullLoading ? '#fff' : '#000',
                border: 'none',
                borderRadius: '5px',
                cursor: selectedPullNode && !pullLoading ? 'pointer' : 'not-allowed',
              }}
              disabled={!selectedPullNode || pullLoading}
            >
              {pullLoading ? 'Pulling...' : 'Pull'}
            </button>
          </div>
          
          <button
            onClick={handleBranch}
            style={{
              padding: '5px 10px',
              background: nodeId && !branchLoading ? '#007bff' : '#ddd',
              color: nodeId && !branchLoading ? '#fff' : '#000',
              border: 'none',
              borderRadius: '5px',
              cursor: nodeId && !branchLoading ? 'pointer' : 'not-allowed',
            }}
            disabled={!nodeId || branchLoading}
          >
            {branchLoading ? 'Branching...' : 'Branch'}
          </button>
          
          {isOwner && presentUsers.length > 1 && (
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <select
                value={selectedNewOwner}
                onChange={(e) => setSelectedNewOwner(e.target.value)}
                style={{ padding: '5px' }}
                disabled={isTransferring}
              >
                <option value="">Transfer ownership to...</option>
                {presentUsers
                  .filter((user) => user.userId !== userId)
                  .map((user) => (
                    <option key={user.userId} value={user.userId}>
                      {user.email}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleTransferOwnership}
                style={{
                  padding: '5px 10px',
                  background: selectedNewOwner && !isTransferring ? '#007bff' : '#ddd',
                  color: selectedNewOwner && !isTransferring ? '#fff' : '#000',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: selectedNewOwner && !isTransferring ? 'pointer' : 'not-allowed',
                }}
                disabled={!selectedNewOwner || isTransferring}
              >
                {isTransferring ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={
              nodeId 
                ? isOwner 
                  ? 'Type a message...' 
                  : 'Only the node owner can write messages'
                : 'Select a node to start chatting'
            }
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '5px',
            }}
            disabled={!nodeId || loading || !isOwner}
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              background: nodeId && !loading && isOwner ? '#007bff' : '#ddd',
              color: nodeId && !loading && isOwner ? '#fff' : '#000',
              border: 'none',
              borderRadius: '5px',
              cursor: nodeId && !loading && isOwner ? 'pointer' : 'not-allowed',
            }}
            disabled={!nodeId || loading || !isOwner}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatUI; 