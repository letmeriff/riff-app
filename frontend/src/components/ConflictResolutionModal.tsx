import React, { useEffect, useState } from 'react';
import { Node } from 'reactflow';
import { useYjs } from '../contexts/YjsContext';

interface ConflictResolutionModalProps {
  nodeId: string;
  onResolve: (resolution: 'local' | 'remote') => void;
  onCancel: () => void;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({ 
  nodeId, 
  onResolve, 
  onCancel 
}) => {
  const { ydoc } = useYjs();
  const [localNode, setLocalNode] = useState<Node | null>(null);
  const [remoteNode, setRemoteNode] = useState<Node | null>(null);
  
  useEffect(() => {
    // In practice, Yjs handles most conflicts automatically
    // This component is more for visual feedback when there are
    // conflicts that the application wants to make the user aware of
    // For this implementation, we'll simulate a conflict scenario
    
    if (!ydoc) return;
    
    // Here we would get the conflicting versions
    // For now we'll simulate with mock data
    const mockLocalNode: Node = {
      id: nodeId,
      position: { x: 100, y: 150 },
      data: { label: 'Local version' },
      type: 'chatNode'
    };
    
    const mockRemoteNode: Node = {
      id: nodeId,
      position: { x: 250, y: 300 },
      data: { label: 'Remote version' },
      type: 'chatNode'
    };
    
    setLocalNode(mockLocalNode);
    setRemoteNode(mockRemoteNode);
  }, [nodeId, ydoc]);
  
  if (!localNode || !remoteNode) {
    return null;
  }
  
  return (
    <div className="conflict-resolution-modal">
      <div className="modal-backdrop" 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div className="modal-content"
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            width: '500px',
            maxWidth: '90%',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
          }}
        >
          <h3 style={{ marginTop: 0 }}>Conflicting Changes Detected</h3>
          
          <p>
            Changes to this node were made simultaneously in multiple places. 
            Please choose which version you want to keep:
          </p>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            marginBottom: '20px',
            gap: '20px'
          }}>
            <div style={{ 
              flex: 1,
              border: '2px solid #4CAF50',
              borderRadius: '4px',
              padding: '10px',
              cursor: 'pointer'
            }} 
            onClick={() => onResolve('local')}
            >
              <h4 style={{ margin: '0 0 10px 0' }}>Your Version</h4>
              <div>
                <div>Position: ({localNode.position.x}, {localNode.position.y})</div>
                <div>Content: {JSON.stringify(localNode.data)}</div>
              </div>
            </div>
            
            <div style={{ 
              flex: 1,
              border: '2px solid #2196F3',
              borderRadius: '4px',
              padding: '10px',
              cursor: 'pointer'
            }}
            onClick={() => onResolve('remote')}
            >
              <h4 style={{ margin: '0 0 10px 0' }}>Remote Version</h4>
              <div>
                <div>Position: ({remoteNode.position.x}, {remoteNode.position.y})</div>
                <div>Content: {JSON.stringify(remoteNode.data)}</div>
              </div>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}>
            <button
              style={{
                padding: '8px 16px',
                border: 'none',
                backgroundColor: '#9E9E9E',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              style={{
                padding: '8px 16px',
                border: 'none',
                backgroundColor: '#FFC107',
                color: 'black',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              onClick={() => onResolve('remote')}
            >
              Accept Remote
            </button>
            <button
              style={{
                padding: '8px 16px',
                border: 'none',
                backgroundColor: '#4CAF50',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              onClick={() => onResolve('local')}
            >
              Keep Mine
            </button>
          </div>
          
          <div style={{ 
            marginTop: '15px',
            padding: '8px',
            backgroundColor: '#F5F5F5',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            <strong>Note:</strong> Yjs usually resolves most conflicts automatically. This modal appears only for specific cases where user decision is required.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal; 