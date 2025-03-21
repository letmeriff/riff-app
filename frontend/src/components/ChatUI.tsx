import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

interface ChatMessage {
  message_id: number;
  node_id: number;
  content: string;
  is_user: boolean;
  timestamp: string;
}

interface ChatUIProps {
  nodeId: string | null; // Selected node's ID
  nodeTitle: string | null; // Selected node's title
}

const ChatUI: React.FC<ChatUIProps> = ({ nodeId, nodeTitle }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch messages when the node changes
  useEffect(() => {
    if (!nodeId) {
      setMessages([]);
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

    // Subscribe to new messages for real-time updates
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
  }, [nodeId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !nodeId) return;

    setLoading(true);
    try {
      // Get the token from localStorage
      const token = localStorage.getItem('supabase.auth.token');
      if (!token) {
        throw new Error('Authentication token not found');
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
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error instanceof Error ? error.message : 'An error occurred sending your message');
    } finally {
      setLoading(false);
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
        }}
      >
        {nodeId ? `Chat for ${nodeTitle} (ID: ${nodeId})` : 'Select a node to start chatting'}
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
        {/* Placeholder Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button disabled style={{ padding: '5px 10px', background: '#ddd' }}>
            Attach
          </button>
          <button disabled style={{ padding: '5px 10px', background: '#ddd' }}>
            Pull
          </button>
          <button disabled style={{ padding: '5px 10px', background: '#ddd' }}>
            Branch
          </button>
        </div>

        {/* Text Input */}
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '5px',
            }}
            disabled={!nodeId || loading}
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              background: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: nodeId && !loading ? 'pointer' : 'not-allowed',
            }}
            disabled={!nodeId || loading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatUI; 