/**
 * NodeControls Component
 * 
 * Component for managing node operations like creation and deletion.
 * Provides UI controls for common node actions.
 */

import React, { useCallback, useState } from 'react';
import { CanvasNode } from '../../../../types/canvas';
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
  // Local state for text editing
  const [localContent, setLocalContent] = useState(content);
  
  // Calculate position styles based on props
  const positionStyle = {
    top: position?.top !== undefined ? `${position.top}px` : undefined,
    left: position?.left !== undefined ? `${position.left}px` : undefined,
    right: position?.right !== undefined ? `${position.right}px` : undefined,
    bottom: position?.bottom !== undefined ? `${position.bottom}px` : undefined,
  };
  
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