import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow';
import NodeSettingsModal from './NodeSettingsModal';
import EditIndicator from './EditIndicator';
import { useYjs } from '../contexts/YjsContext';

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
  attachments?: { attachment_id: number; file_url: string; file_type: string }[];
  description?: string;
}

// Helper function to get initials from email
const getInitials = (email: string): string => {
  if (!email) return '?';
  // Get first letter of the part before the @ sign
  return email.split('@')[0].charAt(0).toUpperCase();
};

// Memoized sub-components for performance optimization
const UserPresenceIndicator = React.memo(({ user }: { user: UserPresence }) => (
  <div
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
));

const ConnectionItem = React.memo(({ conn, isPulledBy }: { 
  conn: { nodeId: string; hasUpdates?: boolean; pullId?: number }, 
  isPulledBy: boolean 
}) => (
  <div
    style={{
      padding: '3px 5px',
      background: isPulledBy ? '#1E90FF' : '#FFD700',
      position: 'relative',
      cursor: 'help',
      borderRadius: '3px',
      fontSize: '10px',
      color: isPulledBy ? 'white' : 'inherit',
    }}
    title={`${isPulledBy ? 'Pulled by' : 'Pulls from'} Node ${conn.nodeId}${!isPulledBy && conn.hasUpdates ? ' - Has new updates!' : ''}`}
  >
    Node {conn.nodeId}
    {!isPulledBy && conn.hasUpdates && (
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#FF0000',
          position: 'absolute',
          top: '3px',
          right: '3px',
        }}
        title="New updates available"
      />
    )}
  </div>
));

const AttachmentIndicator = React.memo(({ attachment }: { 
  attachment: { attachment_id: number; file_url: string; file_type: string } 
}) => (
  <div
    style={{
      width: '20px',
      height: '10px',
      background: '#FFA500',
      cursor: 'help',
    }}
    title={`Attachment: ${attachment.file_type.toUpperCase()}`}
  />
));

// Main ChatNode component with memoization
const ChatNode = React.memo(({ id, data }: NodeProps<ChatNodeData>) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const [showSettings, setShowSettings] = useState(false);
  const { isFeatureEnabled: isYjsEnabled, updateAwareness } = useYjs();
  const [isEditing, setIsEditing] = useState(false);

  // Update node internals when specific props change to ensure proper resizing
  useEffect(() => {
    if (nodeRef.current) {
      // Getting dimensions for potential future use with more complex resizing logic
      // Currently, just updating the node internals is sufficient
      updateNodeInternals(id);
    }
  }, [id, updateNodeInternals, data.users, data.pulledConnections, data.pulledByConnections, data.attachments]);

  // Update Yjs awareness when this user starts/stops editing this node
  useEffect(() => {
    if (!isYjsEnabled) return;
    
    // Update awareness with editingNode property when editing state changes
    if (isEditing) {
      updateAwareness({ editingNode: id });
    } else {
      updateAwareness({ editingNode: null });
    }
    
    return () => {
      // Clear editing state when component unmounts
      updateAwareness({ editingNode: null });
    };
  }, [isEditing, id, updateAwareness, isYjsEnabled]);

  // Memoize event handlers
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(true);
    // Set editing status when opening settings
    setIsEditing(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setShowSettings(false);
    // Clear editing status when closing settings
    setIsEditing(false);
  }, []);

  // Memoize the node header to prevent re-renders when only other parts change
  const NodeHeader = useMemo(() => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>{data.label}</div>
      <div style={{ fontSize: '10px', color: '#777' }}>ID: {data.nodeId}</div>
    </div>
  ), [data.label, data.nodeId]);

  // Memoize presence indicators
  const UserPresenceIndicators = useMemo(() => (
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
        <UserPresenceIndicator key={user.userId} user={user} />
      ))}
    </div>
  ), [data.users]);

  // Memoize pulled connections
  const PulledConnections = useMemo(() => (
    data.pulledConnections && data.pulledConnections.length > 0 ? (
      <div>
        <div style={{ fontSize: '10px', color: '#777', marginBottom: '2px' }}>
          Pulls from:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '5px' }}>
          {data.pulledConnections.map((conn) => (
            <ConnectionItem 
              key={conn.nodeId} 
              conn={conn} 
              isPulledBy={false} 
            />
          ))}
        </div>
      </div>
    ) : null
  ), [data.pulledConnections]);

  // Memoize pulled by connections
  const PulledByConnections = useMemo(() => (
    data.pulledByConnections && data.pulledByConnections.length > 0 ? (
      <div>
        <div style={{ fontSize: '10px', color: '#777', marginBottom: '2px' }}>
          Pulled by:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '5px' }}>
          {data.pulledByConnections.map((conn) => (
            <ConnectionItem 
              key={conn.nodeId} 
              conn={conn} 
              isPulledBy={true} 
            />
          ))}
        </div>
      </div>
    ) : null
  ), [data.pulledByConnections]);

  // Memoize attachments
  const Attachments = useMemo(() => (
    data.attachments && data.attachments.length > 0 ? (
      <div>
        <div style={{ fontSize: '10px', color: '#777', marginBottom: '2px' }}>
          Attachments:
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          {data.attachments.map((attachment) => (
            <AttachmentIndicator key={attachment.attachment_id} attachment={attachment} />
          ))}
        </div>
      </div>
    ) : null
  ), [data.attachments]);

  return (
    <>
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
        onDoubleClick={handleDoubleClick}
      >
        {/* Yjs Edit Indicator - shows when other users are editing this node */}
        {isYjsEnabled && <EditIndicator nodeId={id} />}
        
        <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />

        {NodeHeader}
        {UserPresenceIndicators}

        <div style={{ marginTop: '10px' }}>
          {PulledConnections}
          {PulledByConnections}
          {Attachments}
        </div>
      </div>

      <NodeSettingsModal 
        show={showSettings} 
        onHide={handleSettingsClose} 
        node={showSettings ? { id, data } : null} 
      />
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo to prevent unnecessary re-renders
  // Only re-render when data actually changes
  const prevData = prevProps.data;
  const nextData = nextProps.data;
  
  // Different node id always causes re-render
  if (prevProps.id !== nextProps.id) return false;
  
  // Compare basic properties
  if (prevData.label !== nextData.label || 
      prevData.nodeId !== nextData.nodeId ||
      prevData.description !== nextData.description) {
    return false;
  }
  
  // Compare arrays by length
  if (prevData.users?.length !== nextData.users?.length ||
      prevData.pulledConnections?.length !== nextData.pulledConnections?.length ||
      prevData.pulledByConnections?.length !== nextData.pulledByConnections?.length ||
      prevData.attachments?.length !== nextData.attachments?.length) {
    return false;
  }
  
  // Deep comparison only for users since typing state changes frequently
  if (prevData.users && nextData.users) {
    for (let i = 0; i < prevData.users.length; i++) {
      if (prevData.users[i].isTyping !== nextData.users[i].isTyping ||
          prevData.users[i].userId !== nextData.users[i].userId) {
        return false;
      }
    }
  }
  
  // Props are equal, no re-render needed
  return true;
});

export default ChatNode; 