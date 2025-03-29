import React from 'react';
import { ChatNode } from '../../services/nodeService';

interface ChatHeaderProps {
  nodeId: string | null;
  nodeTitle: string | null;
  isOwner: boolean;
  currentNode: ChatNode | null;
  isHeaderExpanded: boolean;
  onToggleExpand: () => void;
  onTitleEdit: () => void;
  onDescriptionEdit: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  nodeId,
  nodeTitle,
  isOwner,
  currentNode,
  isHeaderExpanded,
  onToggleExpand,
  onTitleEdit,
  onDescriptionEdit,
}) => {
  return (
    <div
      style={{
        padding: '10px',
        background: '#fff',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        boxShadow: isHeaderExpanded ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 'bold',
              fontSize: '18px',
              cursor: isOwner && nodeId ? 'pointer' : 'default',
            }}
            onClick={isOwner && nodeId ? onTitleEdit : undefined}
            title={isOwner && nodeId ? 'Click to edit title' : ''}
          >
            {nodeTitle || 'No node selected'}
            {isOwner && nodeId && (
              <span
                style={{ marginLeft: '5px', fontSize: '14px', color: '#666' }}
              >
                ✏️
              </span>
            )}
          </div>
          {nodeId && (
            <div style={{ fontSize: '12px', color: '#777' }}>
              ID: {nodeId} |{' '}
              {isOwner ? 'You are the owner' : 'You are viewing (read-only)'}
            </div>
          )}
        </div>

        {nodeId && (
          <button
            onClick={onToggleExpand}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              transition: 'background 0.2s',
              transform: isHeaderExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              marginLeft: '10px',
            }}
            title={isHeaderExpanded ? 'Collapse details' : 'Expand details'}
          >
            ▼
          </button>
        )}
      </div>

      {isHeaderExpanded && currentNode && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px',
            background: '#f8f9fa',
            borderRadius: '6px',
            fontSize: '14px',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 12px',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#555' }}>Description:</div>
          <div
            style={{
              cursor: isOwner ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onClick={isOwner ? onDescriptionEdit : undefined}
            title={isOwner ? 'Click to edit description' : ''}
          >
            <div style={{ flex: 1 }}>
              {currentNode.description || 'No description available.'}
            </div>
            {isOwner && (
              <span
                style={{ fontSize: '14px', color: '#666', marginLeft: '5px' }}
              >
                ✏️
              </span>
            )}
          </div>

          <div style={{ fontWeight: 'bold', color: '#555' }}>Created:</div>
          <div>{new Date(currentNode.created_at).toLocaleString()}</div>

          <div style={{ fontWeight: 'bold', color: '#555' }}>Model:</div>
          <div>{currentNode.model || 'Not specified'}</div>

          <div style={{ fontWeight: 'bold', color: '#555' }}>Flavor:</div>
          <div>{currentNode.flavor || 'Not specified'}</div>

          <div style={{ fontWeight: 'bold', color: '#555' }}>Created by:</div>
          <div>{currentNode.user_id}</div>

          <div style={{ fontWeight: 'bold', color: '#555' }}>Owner:</div>
          <div>{currentNode.owner_id}</div>

          <div style={{ fontWeight: 'bold', color: '#555' }}>Position:</div>
          <div>
            X: {currentNode.position_x?.toFixed(2) || '0'}, Y:{' '}
            {currentNode.position_y?.toFixed(2) || '0'}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
