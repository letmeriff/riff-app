import React, { useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow';

interface UserPresence {
  userId: string;
  email: string;
  isTyping: boolean;
  lastActive: string;
}

interface ChatNodeData {
  label: string;
  nodeId: number;
  users?: UserPresence[];
  pulledConnections?: { nodeId: string; hasUpdates: boolean; pullId?: number }[];
  pulledByConnections?: { nodeId: string; pullId?: number }[];
  attachments?: { file_url: string; file_type: string }[];
}

// Helper function to get initials from email
const getInitials = (email: string): string => {
  if (!email) return '?';
  // Get first letter of the part before the @ sign
  return email.split('@')[0].charAt(0).toUpperCase();
};

const ChatNode: React.FC<NodeProps<ChatNodeData>> = ({ id, data }) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    if (nodeRef.current) {
      // Getting dimensions for potential future use with more complex resizing logic
      // Currently, just updating the node internals is sufficient
      updateNodeInternals(id);
    }
  }, [id, updateNodeInternals, data.users, data.pulledConnections, data.pulledByConnections, data.attachments]);

  return (
    <div
      ref={nodeRef}
      style={{
        padding: '10px',
        border: '1px solid #777',
        borderRadius: '5px',
        background: '#fff',
        minWidth: '200px',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>{data.label}</div>
        <div style={{ fontSize: '10px', color: '#777' }}>ID: {data.nodeId}</div>
      </div>

      {/* User Presence Indicators */}
      <div
        style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          display: 'flex',
          gap: '5px',
        }}
      >
        {data.users?.map((user) => (
          <div
            key={user.userId}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: user.isTyping ? '#FF5722' : '#4CAF50', // Red when typing, green otherwise
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              position: 'relative',
              overflow: 'visible',
            }}
            title={`${user.email}${user.isTyping ? ' (typing...)' : ''}`}
          >
            {getInitials(user.email)}
            {user.isTyping && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '-8px',
                  left: '0',
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '8px',
                  color: '#FF5722',
                }}
              >
                ✎
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '10px' }}>
        {/* Pulled Connections (Yellow Rectangles) */}
        {data.pulledConnections && data.pulledConnections.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', color: '#777', marginBottom: '2px' }}>
              Pulls from:
            </div>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
              {data.pulledConnections.map((conn) => (
                <div
                  key={conn.nodeId}
                  style={{
                    width: '20px',
                    height: '10px',
                    background: '#FFD700',
                    position: 'relative',
                    cursor: 'help',
                  }}
                  title={`Pulls from Node ${conn.nodeId}${conn.hasUpdates ? ' - Has new updates!' : ''}`}
                >
                  {conn.hasUpdates && (
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#FF0000',
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                      }}
                      title="New updates available"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pulled By Connections (Blue Rectangles) */}
        {data.pulledByConnections && data.pulledByConnections.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', color: '#777', marginBottom: '2px' }}>
              Pulled by:
            </div>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
              {data.pulledByConnections.map((conn) => (
                <div
                  key={conn.nodeId}
                  style={{
                    width: '20px',
                    height: '10px',
                    background: '#1E90FF',
                    cursor: 'help',
                  }}
                  title={`Pulled by Node ${conn.nodeId}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Attachments (Orange Rectangles) */}
        {data.attachments && data.attachments.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', color: '#777', marginBottom: '2px' }}>
              Attachments:
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              {data.attachments.map((attachment, index) => (
                <div
                  key={index}
                  style={{
                    width: '20px',
                    height: '10px',
                    background: '#FFA500',
                    cursor: 'help',
                  }}
                  title={`Attachment: ${attachment.file_type.toUpperCase()}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatNode; 