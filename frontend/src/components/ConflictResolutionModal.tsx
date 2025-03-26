import React, { useState, useEffect, CSSProperties } from 'react';
import { Node } from 'reactflow';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  localNodes: Node[];
  remoteNodes: Node[];
  onResolve: (resolution: 'local' | 'remote' | 'merge') => void;
}

// CSS styles for the component
const styles: Record<string, CSSProperties> = {
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  heading: {
    marginTop: 0,
    color: '#e53935',
  },
  optionsContainer: {
    margin: '20px 0',
  },
  option: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  optionInput: {
    marginTop: '4px',
    marginRight: '12px',
  },
  optionLabel: {
    flex: 1,
  },
  optionDescription: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#666',
  },
  conflictDetails: {
    backgroundColor: '#f5f5f5',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  conflictList: {
    margin: 0,
    paddingLeft: '20px',
  },
  conflictItem: {
    marginBottom: '8px',
  },
  positionDiff: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '14px',
    marginTop: '4px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px',
  },
  primaryButton: {
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  secondaryButton: {
    backgroundColor: '#f5f5f5',
    color: '#333',
    border: '1px solid #ddd',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

/**
 * Component for resolving conflicts between local and remote changes
 * during synchronization after being offline
 */
const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  localNodes,
  remoteNodes,
  onResolve
}) => {
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | 'merge'>('merge');
  const [conflictedNodeIds, setConflictedNodeIds] = useState<string[]>([]);
  
  // Detect which nodes have conflicts
  useEffect(() => {
    if (isOpen) {
      const conflicts: string[] = [];
      
      // Compare local and remote nodes to find conflicts
      localNodes.forEach(localNode => {
        const remoteNode = remoteNodes.find(node => node.id === localNode.id);
        
        if (remoteNode) {
          // Check for position differences
          if (
            remoteNode.position.x !== localNode.position.x ||
            remoteNode.position.y !== localNode.position.y
          ) {
            conflicts.push(localNode.id);
          }
        }
      });
      
      setConflictedNodeIds(conflicts);
    }
  }, [isOpen, localNodes, remoteNodes]);
  
  if (!isOpen) return null;
  
  return (
    <div style={styles.modal}>
      <div style={styles.content}>
        <h2 style={styles.heading}>Sync Conflict Detected</h2>
        <p>
          Changes were made to the same nodes both locally and remotely while you were offline.
          {conflictedNodeIds.length > 0 && (
            <span> Conflicts detected in {conflictedNodeIds.length} nodes.</span>
          )}
        </p>
        
        <div style={styles.optionsContainer}>
          <h3>Choose how to resolve:</h3>
          
          <div style={styles.option}>
            <input
              type="radio"
              id="local"
              name="resolution"
              value="local"
              checked={selectedResolution === 'local'}
              onChange={() => setSelectedResolution('local')}
              style={styles.optionInput}
            />
            <label htmlFor="local" style={styles.optionLabel}>
              <strong>Keep my changes</strong>
              <p style={styles.optionDescription}>Use your local changes and discard remote changes.</p>
            </label>
          </div>
          
          <div style={styles.option}>
            <input
              type="radio"
              id="remote"
              name="resolution"
              value="remote"
              checked={selectedResolution === 'remote'}
              onChange={() => setSelectedResolution('remote')}
              style={styles.optionInput}
            />
            <label htmlFor="remote" style={styles.optionLabel}>
              <strong>Use remote changes</strong>
              <p style={styles.optionDescription}>Discard your local changes and use the remote version.</p>
            </label>
          </div>
          
          <div style={styles.option}>
            <input
              type="radio"
              id="merge"
              name="resolution"
              value="merge"
              checked={selectedResolution === 'merge'}
              onChange={() => setSelectedResolution('merge')}
              style={styles.optionInput}
            />
            <label htmlFor="merge" style={styles.optionLabel}>
              <strong>Smart merge (Recommended)</strong>
              <p style={styles.optionDescription}>Let Yjs automatically merge changes using its CRDT algorithm.</p>
            </label>
          </div>
        </div>
        
        {conflictedNodeIds.length > 0 && (
          <div style={styles.conflictDetails}>
            <h3>Affected Nodes:</h3>
            <ul style={styles.conflictList}>
              {conflictedNodeIds.map(nodeId => {
                const localNode = localNodes.find(n => n.id === nodeId);
                const remoteNode = remoteNodes.find(n => n.id === nodeId);
                
                return (
                  <li key={nodeId} style={styles.conflictItem}>
                    Node: {localNode?.data?.label || nodeId}
                    <div style={styles.positionDiff}>
                      <div>
                        <strong>Local:</strong> ({localNode?.position.x.toFixed(0)}, 
                        {localNode?.position.y.toFixed(0)})
                      </div>
                      <div>
                        <strong>Remote:</strong> ({remoteNode?.position.x.toFixed(0)}, 
                        {remoteNode?.position.y.toFixed(0)})
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        
        <div style={styles.modalActions}>
          <button onClick={() => onResolve(selectedResolution)} style={styles.primaryButton}>
            Apply Resolution
          </button>
          <button onClick={onClose} style={styles.secondaryButton}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal; 