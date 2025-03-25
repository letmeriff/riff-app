import React, { useState, useEffect } from 'react';
import { updateNodeTitle, updateNodeDescription } from '../services/nodeService';
import NodePositionHistory from './NodePositionHistory';

interface NodeSettingsModalProps {
  show: boolean;
  onHide: () => void;
  node: {
    id: string;
    data: {
      label: string;
      nodeId: number;
      description?: string;
    }
  } | null;
}

const NodeSettingsModal: React.FC<NodeSettingsModalProps> = ({ show, onHide, node }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (node) {
      setTitle(node.data.label || '');
      setDescription(node.data.description || '');
    }
  }, [node]);

  const handleSave = async () => {
    if (!node) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await updateNodeTitle(node.data.nodeId, title);
      
      if (description) {
        await updateNodeDescription(node.data.nodeId, description);
      }
      
      setSuccess('Node updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update node:', err);
      setError('Failed to update node. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h4 className="modal-title">Node Settings {node ? `(ID: ${node.data.nodeId})` : ''}</h4>
          <button className="close-button" onClick={onHide}>&times;</button>
        </div>
        <div className="modal-body">
          {!node ? (
            <p>No node selected</p>
          ) : (
            <>
              <div className="settings-tabs">
                <button 
                  className={`tab-button ${activeTab === 'general' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('general')}
                >
                  General
                </button>
                <button 
                  className={`tab-button ${activeTab === 'position' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('position')}
                >
                  Position History
                </button>
              </div>

              {activeTab === 'general' && (
                <div className="form-container">
                  {error && <div className="error-message">{error}</div>}
                  {success && <div className="success-message">{success}</div>}
                  
                  <div className="form-group">
                    <label htmlFor="title">Title</label>
                    <input 
                      id="title"
                      type="text" 
                      value={title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                      placeholder="Enter node title"
                      className="form-control"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea 
                      id="description"
                      rows={3}
                      value={description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                      placeholder="Enter node description"
                      className="form-control"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'position' && (
                <div className="position-history-tab">
                  <NodePositionHistory nodeId={node.data.nodeId} limit={15} />
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="cancel-button" onClick={onHide}>
            Close
          </button>
          {activeTab === 'general' && (
            <button 
              className="save-button" 
              onClick={handleSave}
              disabled={loading || !title}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NodeSettingsModal; 