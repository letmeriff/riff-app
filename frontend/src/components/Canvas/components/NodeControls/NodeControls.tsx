/**
 * NodeControls Component
 * 
 * Component for managing node operations like creation and deletion.
 * Provides UI controls for common node actions.
 * 
 * Implementation Notes:
 * - Uses type-safe network event handling
 * - Validates incoming payloads with type guards
 * - Performs safe type conversions for node IDs
 */

import React, { useCallback, useState, useEffect } from 'react';
import { CanvasNode } from '../../../../types/canvas';
import { useNetwork } from '../../../../contexts/NetworkContext';
import { 
  NetworkPayload,
  NodeUpdatePayload,
  OwnershipUpdatePayload,
  NodeId 
} from '../../../../types/messaging';
import { 
  parseNodeId, 
  compareNodeIds,
  isNodeUpdatePayload,
  isOwnershipUpdatePayload
} from '../../../../utils/typeGuards';
import { validatePayload } from '../../../../services/networkService';
import styles from './NodeControls.module.css';

export interface NodeControlsProps {
  node: CanvasNode | null;
  content: string;
  onContentChange: (nodeId: string, content: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onOpenSettings?: (nodeId: string) => void;
  isReadOnly?: boolean;
  position?: { top?: number; left?: number; right?: number; bottom?: number };
}

export const NodeControls: React.FC<NodeControlsProps> = ({
  node,
  content,
  onContentChange,
  onDeleteNode,
  onOpenSettings,
  isReadOnly = false,
  position,
}) => {
  // Local state for text editing and node data
  const [localContent, setLocalContent] = useState(content);
  const [nodeOwner, setNodeOwner] = useState<string | null>(null);
  
  // Get network context
  const { networkAdapter } = useNetwork();
  
  // Parse node ID from string to number for type safety
  const parsedNodeId = node ? parseNodeId(node.id) : null;
  
  // Calculate position styles based on props
  const positionStyle = {
    top: position?.top !== undefined ? `${position.top}px` : undefined,
    left: position?.left !== undefined ? `${position.left}px` : undefined,
    right: position?.right !== undefined ? `${position.right}px` : undefined,
    bottom: position?.bottom !== undefined ? `${position.bottom}px` : undefined,
  };
  
  // Type-safe handlers for network events
  const handleNodeUpdate = useCallback((payload: NodeUpdatePayload) => {
    if (payload.new && parsedNodeId && compareNodeIds(payload.new.node_id, node?.id || null)) {
      // Update local node data if needed
      if (payload.new.content && payload.new.content !== localContent) {
        setLocalContent(payload.new.content as string);
      }
    }
  }, [node?.id, parsedNodeId, localContent]);
  
  const handleOwnershipUpdate = useCallback((payload: OwnershipUpdatePayload) => {
    if (parsedNodeId && compareNodeIds(payload.nodeId, node?.id || null)) {
      setNodeOwner(payload.ownerId);
    }
  }, [node?.id, parsedNodeId]);
  
  // Set up event subscriptions using type-safe hooks
  useEffect(() => {
    // Skip setup if no networkAdapter or no node selected
    if (!networkAdapter || !node || !parsedNodeId) return;
    
    // Get ownership information
    const getNodeOwnership = async () => {
      try {
        // Implementation would depend on your API
        // This is a placeholder for actual implementation
        console.log('Fetching ownership for node:', parsedNodeId);
      } catch (error) {
        console.error('Error fetching node ownership:', error);
      }
    };
    
    getNodeOwnership();
  }, [networkAdapter, node, parsedNodeId]);
  
  // Subscribe to network events
  useEffect(() => {
    if (!networkAdapter || !node) return;
    
    // Subscribe to events using network adapter directly
    const unsubscribeNodeUpdate = networkAdapter.subscribeToEvent('node-update', (payload) => {
      const validPayload = validatePayload(payload, isNodeUpdatePayload);
      if (validPayload) {
        handleNodeUpdate(validPayload);
      }
    });
    
    const unsubscribeOwnershipUpdate = networkAdapter.subscribeToEvent('ownership-update', (payload) => {
      const validPayload = validatePayload(payload, isOwnershipUpdatePayload);
      if (validPayload) {
        handleOwnershipUpdate(validPayload);
      }
    });
    
    // Cleanup subscriptions
    return () => {
      unsubscribeNodeUpdate();
      unsubscribeOwnershipUpdate();
    };
  }, [
    networkAdapter, 
    node, 
    handleNodeUpdate,
    handleOwnershipUpdate
  ]);
  
  // Update local content when prop changes
  useEffect(() => {
    setLocalContent(content);
  }, [content]);
  
  // Handle content change
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value);
  }, []);
  
  // Handle save changes
  const handleSaveChanges = useCallback(() => {
    if (!node || isReadOnly) return;
    onContentChange(node.id, localContent);
  }, [node, localContent, onContentChange, isReadOnly]);
  
  // Handle node deletion
  const handleDeleteNode = useCallback(() => {
    if (!node || isReadOnly) return;
    onDeleteNode(node.id);
  }, [node, onDeleteNode, isReadOnly]);
  
  // Handle open settings
  const handleOpenSettings = useCallback(() => {
    if (!node || isReadOnly || !onOpenSettings) return;
    onOpenSettings(node.id);
  }, [node, onOpenSettings, isReadOnly]);
  
  // If no node selected, show empty state
  if (!node) {
    return (
      <div 
        className={styles.controlsContainer} 
        style={positionStyle}
        data-testid="node-controls-container"
      >
        <div className={styles.emptyState}>
          Select a node to edit
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={styles.controlsContainer} 
      style={positionStyle}
      data-testid="node-controls-container"
    >
      <div className={styles.nodeContent}>
        <h3>Edit Node</h3>
        
        {/* Content Editor */}
        <textarea
          className={styles.contentEditor}
          value={localContent}
          onChange={handleContentChange}
          disabled={isReadOnly}
          data-testid="content-editor"
        />
        
        <div className={styles.buttonContainer}>
          {/* Save Button */}
          <button
            className={styles.saveButton}
            onClick={handleSaveChanges}
            disabled={isReadOnly}
            data-testid="save-button"
          >
            Save Changes
          </button>
          
          {/* Delete Button */}
          <button
            className={styles.deleteButton}
            onClick={handleDeleteNode}
            disabled={isReadOnly}
            data-testid="delete-node-button"
          >
            Delete Node
          </button>
          
          {/* Settings Button */}
          {onOpenSettings && (
            <button
              className={styles.settingsButton}
              onClick={handleOpenSettings}
              disabled={isReadOnly}
              data-testid="settings-button"
            >
              Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 