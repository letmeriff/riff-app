import React, { useRef, useEffect } from 'react';
import { useChatMessages } from '../../hooks/useChatMessages';

interface ChatInputProps {
  nodeId: string | null;
  isOwner: boolean;
  loading: boolean;
  onSendMessage: () => void;
  onTyping: (isTyping: boolean) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  nodeId,
  isOwner,
  loading,
  onSendMessage,
  onTyping,
}) => {
  // Get the input value and setter from the useChatMessages hook
  const { input, setInput } = useChatMessages(nodeId, '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when the component mounts or when node changes
  useEffect(() => {
    if (nodeId && isOwner && inputRef.current) {
      inputRef.current.focus();
    }
  }, [nodeId, isOwner]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (nodeId && isOwner) {
      onTyping(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && nodeId && isOwner && !loading) {
      onSendMessage();
      // The setInput('') is handled in the useChatMessages hook's handleSendMessage

      // Focus the input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={handleInputChange}
        disabled={!nodeId || !isOwner}
        placeholder={
          nodeId
            ? isOwner
              ? 'Type a message...'
              : 'Only the node owner can write messages'
            : 'Select a node to start chatting'
        }
        style={{
          padding: '10px',
          borderRadius: '20px',
          border: '1px solid #ddd',
          flexGrow: 1,
        }}
      />
      <button
        type="submit"
        disabled={!nodeId || loading || !input.trim() || !isOwner}
        style={{
          padding: '10px 15px',
          background:
            !nodeId || loading || !input.trim() || !isOwner
              ? '#ddd'
              : '#007bff',
          color:
            !nodeId || loading || !input.trim() || !isOwner ? '#666' : '#fff',
          border: 'none',
          borderRadius: '20px',
          cursor:
            !nodeId || loading || !input.trim() || !isOwner
              ? 'not-allowed'
              : 'pointer',
        }}
      >
        {loading ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
};

export default ChatInput;
