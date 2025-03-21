import React, { useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow';

interface ChatNodeData {
  label: string;
  nodeId: number;
  users?: { id: string; email: string }[];
  pulledConnections?: { nodeId: string; hasUpdates: boolean }[];
  pulledByConnections?: { nodeId: string }[];
  attachments?: { file_url: string; file_type: string }[];
}

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
            key={user.id}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#4CAF50',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
            }}
            title={user.email}
          >
            {user.email.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '10px' }}>
        {/* Pulled Connections (Yellow Rectangles) */}
        {data.pulledConnections && data.pulledConnections.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
            {data.pulledConnections.map((conn) => (
              <div
                key={conn.nodeId}
                style={{
                  width: '20px',
                  height: '10px',
                  background: '#FFD700',
                  position: 'relative',
                }}
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
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pulled By Connections (Blue Rectangles) */}
        {data.pulledByConnections && data.pulledByConnections.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
            {data.pulledByConnections.map((conn) => (
              <div
                key={conn.nodeId}
                style={{
                  width: '20px',
                  height: '10px',
                  background: '#1E90FF',
                }}
              />
            ))}
          </div>
        )}

        {/* Attachments (Orange Rectangles) */}
        {data.attachments && data.attachments.length > 0 && (
          <div style={{ display: 'flex', gap: '5px' }}>
            {data.attachments.map((attachment, index) => (
              <div
                key={index}
                style={{
                  width: '20px',
                  height: '10px',
                  background: '#FFA500',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatNode; 