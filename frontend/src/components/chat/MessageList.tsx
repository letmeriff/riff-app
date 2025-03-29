import React from 'react';
import { ChatMessage, ChatAttachment } from '../../types/messaging';
import { useChatAttachments } from '../../hooks/useChatAttachments';

// Define types for mixed items
interface AttachmentItem {
  isAttachment: true;
  attachment: ChatAttachment;
  timestamp: string;
}

type ChatItem = ChatMessage | AttachmentItem;

interface MessageListProps {
  messages: ChatMessage[];
  attachments: ChatAttachment[];
  loading: boolean;
  isUploading: boolean;
  typingUsers: string[];
  isOwner: boolean;
  userId: string;
  isHeaderExpanded: boolean;
  onDeleteAttachment: (attachmentId: number | string) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  attachments,
  loading,
  isUploading,
  typingUsers,
  isOwner,
  userId,
  isHeaderExpanded,
  onDeleteAttachment,
  messagesEndRef,
}) => {
  // Use the formatFileSize function from useChatAttachments
  const { formatFileSize } = useChatAttachments(null, userId);

  // Sort and combine messages and attachments
  const combinedItems: ChatItem[] = [
    ...messages.map((msg) => msg as ChatMessage),
    ...attachments.map(
      (attachment) =>
        ({
          isAttachment: true,
          attachment,
          timestamp: attachment.created_at || new Date().toISOString(),
        }) as AttachmentItem
    ),
  ].sort((a, b) => {
    const timeA =
      'isAttachment' in a
        ? new Date(a.timestamp || new Date().toISOString()).getTime()
        : new Date(a.timestamp).getTime();
    const timeB =
      'isAttachment' in b
        ? new Date(b.timestamp || new Date().toISOString()).getTime()
        : new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '20px',
        flexGrow: 1,
        overflowY: 'auto',
        background: '#f5f5f5',
        maxHeight: isHeaderExpanded
          ? 'calc(100% - 180px)'
          : 'calc(100% - 60px)',
        transition: 'max-height 0.3s ease',
      }}
    >
      {/* Combine messages and attachments in a single chronological list */}
      {combinedItems.map((item) => {
        if ('isAttachment' in item) {
          const attachment = item.attachment;
          return (
            <div
              key={`attachment-${attachment.attachment_id}`}
              style={{
                alignSelf: 'flex-start',
                background: '#e0e0e0',
                padding: '8px 12px',
                borderRadius: '10px',
                maxWidth: '70%',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <a
                  href={attachment.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0066cc', textDecoration: 'none' }}
                >
                  {attachment.file_name} ({formatFileSize(attachment.file_size)}
                  )
                </a>
                {(isOwner || attachment.user_id === userId) && (
                  <button
                    onClick={() => onDeleteAttachment(attachment.attachment_id)}
                    style={{
                      marginLeft: '8px',
                      background: 'none',
                      border: 'none',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.7 }}>
                {attachment.created_at
                  ? new Date(attachment.created_at).toLocaleTimeString()
                  : new Date().toLocaleTimeString()}
              </div>
              {attachment.file_type.startsWith('image/') && (
                <img
                  src={attachment.file_url}
                  alt={attachment.file_name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    borderRadius: '5px',
                    marginTop: '5px',
                  }}
                />
              )}
            </div>
          );
        } else {
          const msg = item;
          return (
            <div
              key={`message-${msg.message_id}`}
              style={{
                alignSelf: msg.is_user ? 'flex-end' : 'flex-start',
                background: msg.is_user ? '#007bff' : '#fff',
                color: msg.is_user ? '#fff' : '#000',
                padding: '10px 15px',
                borderRadius: '18px',
                maxWidth: '70%',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                position: 'relative',
              }}
            >
              <div>{msg.content}</div>
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '5px' }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          );
        }
      })}

      {loading && (
        <div style={{ alignSelf: 'flex-start', color: '#777' }}>
          AI is typing...
        </div>
      )}

      {isUploading && (
        <div style={{ alignSelf: 'flex-start', color: '#777' }}>
          Uploading file...
        </div>
      )}

      {typingUsers.length > 0 && (
        <div style={{ alignSelf: 'flex-start', color: '#777' }}>
          {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'}{' '}
          typing...
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
