import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { ChatNode } from '../../services/nodeService';
import { UserPresence } from '../../types/messaging';
import { useNodeContext } from '../../hooks/useNodeContext';

interface ChatActionsProps {
  nodeId: string | null;
  isOwner: boolean;
  isUploading: boolean;
  presentUsers: UserPresence[];
  userId: string;
  isTransferring: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onTransferOwnership: (newOwnerId: string) => void;
}

const ChatActions: React.FC<ChatActionsProps> = ({
  nodeId,
  isOwner,
  isUploading,
  presentUsers,
  userId,
  isTransferring,
  onFileUpload,
  onTransferOwnership,
}) => {
  const [nodes, setNodes] = useState<ChatNode[]>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use the nodeContext hook for branching and pulling functionality
  const {
    selectedPullNode,
    setSelectedPullNode,
    pullLoading,
    pullMode,
    setPullMode,
    branchLoading,
    pullContext,
    branchNode,
  } = useNodeContext(nodeId);

  // Fetch available nodes for the Pull dropdown
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const { data, error } = await supabase.from('chat_nodes').select('*');

        if (error) throw error;
        setNodes(data || []);
      } catch (error) {
        console.error('Error fetching nodes:', error);
      }
    };

    fetchNodes();
  }, []);

  const handlePullContext = async () => {
    try {
      await pullContext();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'An error occurred while pulling context'
      );
    }
  };

  const handleBranch = async () => {
    try {
      await branchNode();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'An error occurred while branching the node'
      );
    }
  };

  const handleTransferClick = () => {
    if (selectedNewOwner) {
      onTransferOwnership(selectedNewOwner);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '5px 10px',
          background: nodeId && isOwner && !isUploading ? '#007bff' : '#ddd',
          color: nodeId && isOwner && !isUploading ? '#fff' : '#000',
          border: 'none',
          borderRadius: '5px',
          cursor: nodeId && isOwner && !isUploading ? 'pointer' : 'not-allowed',
        }}
        disabled={!nodeId || !isOwner || isUploading}
        type="button"
      >
        {isUploading ? 'Uploading...' : 'Attach'}
      </button>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={onFileUpload}
        disabled={!nodeId || !isOwner || isUploading}
      />

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
            cursor:
              selectedPullNode && !pullLoading ? 'pointer' : 'not-allowed',
          }}
          disabled={!selectedPullNode || pullLoading}
          type="button"
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
        type="button"
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
            onClick={handleTransferClick}
            style={{
              padding: '5px 10px',
              background:
                selectedNewOwner && !isTransferring ? '#007bff' : '#ddd',
              color: selectedNewOwner && !isTransferring ? '#fff' : '#000',
              border: 'none',
              borderRadius: '5px',
              cursor:
                selectedNewOwner && !isTransferring ? 'pointer' : 'not-allowed',
            }}
            disabled={!selectedNewOwner || isTransferring}
            type="button"
          >
            {isTransferring ? 'Transferring...' : 'Transfer'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatActions;
