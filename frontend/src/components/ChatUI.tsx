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

interface WritePermission {
  currentWriter: { userId: string; email: string } | null;
  queue: { userId: string; email: string; joinedAt: string }[];
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
  const [hasWritePermission, setHasWritePermission] = useState(false);
  const [positionInQueue, setPositionInQueue] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch available nodes for the Pull dropdown
  useEffect(() => {
    if (!userId) return;

    const fetchNodes = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_nodes')
          .select('*')
          .eq('user_id', userId);
        
        if (error) throw error;
        setNodes(data || []);
      } catch (error) {
        console.error('Error fetching nodes:', error);
      }
    };

    fetchNodes();
  }, [userId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch messages when the node changes and set up real-time updates
  useEffect(() => {
    if (!nodeId) {
      setMessages([]);
      setTypingUsers([]);
      setHasWritePermission(false);
      setPositionInQueue(0);
      return;
    }

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('node_id', parseInt(nodeId))
          .order('timestamp', { ascending: true });
        
        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();

    // Set up real-time updates for messages
    if (socket) {
      // Use Socket.IO for real-time updates
      socket.on('message-update', (payload) => {
        console.log('Socket: Message update received:', payload);
        if (payload.new && payload.new.node_id === parseInt(nodeId)) {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
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
        }
      });

      // Listen for write permission updates
      socket.on('write-permission-update', (payload) => {
        console.log('Socket: Write permission update received:', payload);
        if (payload.nodeId.toString() === nodeId) {
          setHasWritePermission(payload.hasPermission);
          setPositionInQueue(payload.positionInQueue);
        }
      });

      // Listen for write permission broadcasts (when other users join/leave)
      socket.on('write-permission-broadcast', (payload) => {
        console.log('Socket: Write permission broadcast received:', payload);
        if (payload.nodeId.toString() === nodeId) {
          const permission = payload.permission as WritePermission;
          
          // Update local state based on the broadcast
          const hasPermission = permission.currentWriter?.userId === userId;
          const position = permission.currentWriter?.userId === userId 
            ? 0 
            : permission.queue.findIndex(entry => entry.userId === userId) + 1;
          
          setHasWritePermission(hasPermission);
          setPositionInQueue(position === -1 ? 0 : position); // Handle case where user isn't in queue
        }
      });

      return () => {
        socket.off('message-update');
        socket.off('presence-update');
        socket.off('write-permission-update');
        socket.off('write-permission-broadcast');
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

    if (!socket || !nodeId || !hasWritePermission) return;

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
    if (!input.trim() || !nodeId || !hasWritePermission) return;

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
      
      if (pullMode === 'summary') {
        // First, get summary of the selected node's chat history
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
          throw new Error(errorData.error || 'Failed to get summary');
        }

        const { summary } = await summaryResponse.json();
        
        // Add the summary as a placeholder message in the current node
        const { error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            node_id: parseInt(nodeId),
            content: `Summary pulled from Node ${selectedPullNode}:\n${summary}`,
            is_user: false,
            timestamp: new Date().toISOString(),
          });
        
        if (insertError) throw insertError;
      }
      
      // Perform the context pull (will update the relationship in database)
      const response = await fetch('http://localhost:3001/api/context/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetNodeId: parseInt(nodeId),
          originNodeId: parseInt(selectedPullNode),
          mode: pullMode // Add mode parameter (backend can use this if needed)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to pull context');
      }

      // If we're pulling the full history, the backend will have inserted a message
      // No need to do anything else, as our subscription will update the UI
      
      // Reset the selected pull node
      setSelectedPullNode('');
    } catch (error) {
      console.error('Error pulling context:', error);
      alert(error instanceof Error ? error.message : 'An error occurred pulling context');
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
      
      // Automatically switch to the new branched node
      window.dispatchEvent(new CustomEvent('select-node', { 
        detail: { nodeId: newNodeId.toString() } 
      }));
      
      // Refresh the nodes list to include the new branched node
      const { data, error } = await supabase
        .from('chat_nodes')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      setNodes(data || []);
      
    } catch (error) {
      console.error('Error branching node:', error);
      alert(error instanceof Error ? error.message : 'An error occurred while branching the node');
    } finally {
      setBranchLoading(false);
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
      {/* Header Bar */}
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
          <div style={{ 
            fontSize: '12px', 
            color: hasWritePermission ? '#4CAF50' : '#FF5722',
            padding: '4px 8px',
            borderRadius: '4px',
            background: hasWritePermission ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 87, 34, 0.1)'
          }}>
            {hasWritePermission 
              ? 'You have write permission' 
              : positionInQueue > 0 
                ? `Waiting in queue (position: ${positionInQueue})` 
                : 'Read-only mode'}
          </div>
        )}
      </div>

      {/* Message Display Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
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
              wordBreak: 'break-word',
            }}
          >
            {message.content}
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', color: '#777', padding: '8px' }}>
            AI is typing...
          </div>
        )}
        {typingUsers.length > 0 && (
          <div style={{ alignSelf: 'flex-start', color: '#777', padding: '8px' }}>
            {typingUsers.length === 1 
              ? `${typingUsers[0]} is typing...` 
              : `${typingUsers.join(', ')} are typing...`}
          </div>
        )}
        {!hasWritePermission && positionInQueue > 0 && (
          <div style={{ 
            alignSelf: 'center', 
            color: '#FF5722', 
            padding: '12px',
            background: 'rgba(255, 87, 34, 0.05)',
            borderRadius: '8px',
            marginTop: '8px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Waiting for write permission</div>
            <div>Your position in queue: {positionInQueue}</div>
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              Tip: You can create your own parallel conversation by clicking the "Branch" button above.
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area and Buttons */}
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
        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button disabled style={{ padding: '5px 10px', background: '#ddd' }}>
            Attach
          </button>
          <div style={{ display: 'flex', gap: '5px', flex: 1 }}>
            <select
              value={selectedPullNode}
              onChange={(e) => setSelectedPullNode(e.target.value)}
              style={{ 
                padding: '5px',
                flex: 1,
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
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
              style={{
                padding: '5px',
                width: '120px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
              disabled={!nodeId || pullLoading}
            >
              <option value="full">Full History</option>
              <option value="summary">Summary</option>
            </select>
            <button
              onClick={handlePullContext}
              style={{
                padding: '5px 10px',
                background: selectedPullNode && !pullLoading ? '#007bff' : '#ddd',
                color: selectedPullNode && !pullLoading ? '#fff' : '#555',
                border: 'none',
                borderRadius: '4px',
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
              color: nodeId && !branchLoading ? '#fff' : '#555',
              border: 'none',
              borderRadius: '4px',
              cursor: nodeId && !branchLoading ? 'pointer' : 'not-allowed',
            }}
            disabled={!nodeId || branchLoading}
          >
            {branchLoading ? 'Branching...' : 'Branch'}
          </button>
        </div>

        {/* Text Input */}
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={hasWritePermission 
              ? "Type a message..." 
              : positionInQueue > 0
                ? "Waiting for write permission..."
                : "Read-only mode - branch to create your own chat"
            }
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              backgroundColor: hasWritePermission ? '#fff' : '#f5f5f5'
            }}
            disabled={!nodeId || loading || !hasWritePermission}
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              background: nodeId && !loading && hasWritePermission ? '#007bff' : '#ddd',
              color: nodeId && !loading && hasWritePermission ? '#fff' : '#555',
              border: 'none',
              borderRadius: '5px',
              cursor: nodeId && !loading && hasWritePermission ? 'pointer' : 'not-allowed',
            }}
            disabled={!nodeId || loading || !hasWritePermission}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatUI; 