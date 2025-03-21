import React, { useState, useEffect } from 'react';

interface ChatMessage {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: string;
}

interface ChatUIProps {
  nodeId: string | null; // Selected node's ID
  nodeTitle: string | null; // Selected node's title
}

const ChatUI: React.FC<ChatUIProps> = ({ nodeId, nodeTitle }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  // Reset messages when the node changes
  useEffect(() => {
    setMessages([]);
  }, [nodeId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: ChatMessage = {
      id: messages.length + 1,
      content: input,
      isUser: true,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput('');
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
            key={message.id}
            style={{
              alignSelf: message.isUser ? 'flex-end' : 'flex-start',
              background: message.isUser ? '#007bff' : '#e0e0e0',
              color: message.isUser ? '#fff' : '#000',
              padding: '8px 12px',
              borderRadius: '10px',
              maxWidth: '70%',
            }}
          >
            {message.content}
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
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
            disabled={!nodeId}
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              background: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: nodeId ? 'pointer' : 'not-allowed',
            }}
            disabled={!nodeId}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatUI; 