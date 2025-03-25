import React, { useEffect, useState } from 'react';
import { fetchNodePositionHistory } from '../services/nodeService';

interface NodePositionHistoryProps {
  nodeId: number;
  limit?: number;
}

interface PositionHistoryItem {
  id: number;
  node_id: number;
  position_x: number;
  position_y: number;
  user_id: string;
  vector_clock: Record<string, number>;
  lamport_timestamp: number;
  created_at: string;
  is_applied: boolean;
  user_email?: string;
}

/**
 * Component to display the position history of a node and allow
 * reverting to previous positions
 */
const NodePositionHistory: React.FC<NodePositionHistoryProps> = ({ nodeId, limit = 10 }) => {
  const [history, setHistory] = useState<PositionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const historyData = await fetchNodePositionHistory(nodeId, limit);
        setHistory(historyData);
        setError(null);
      } catch (err) {
        setError('Failed to load position history');
        console.error('Error fetching node position history:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadHistory();
  }, [nodeId, limit]);
  
  if (loading) {
    return <div className="position-history-loading">Loading history...</div>;
  }
  
  if (error) {
    return <div className="position-history-error">{error}</div>;
  }
  
  if (history.length === 0) {
    return <div className="position-history-empty">No position history available</div>;
  }
  
  return (
    <div className="position-history-container">
      <h4>Position History</h4>
      <div className="position-history-list">
        {history.map((item) => (
          <div key={item.id} className="position-history-item">
            <div className="position-details">
              <span className="position-coords">
                Position: ({item.position_x.toFixed(2)}, {item.position_y.toFixed(2)})
              </span>
              <span className="position-timestamp">
                {new Date(item.created_at).toLocaleString()}
              </span>
            </div>
            <div className="position-metadata">
              <span className="position-user">
                By: {item.user_email || 'Unknown user'}
              </span>
              <span className={`position-status ${item.is_applied ? 'applied' : 'pending'}`}>
                {item.is_applied ? 'Applied' : 'Pending'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NodePositionHistory; 