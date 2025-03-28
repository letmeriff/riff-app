/**
 * CanvasToolbar Component
 * 
 * Provides UI controls for common canvas actions such as zooming,
 * applying layouts, and accessing settings.
 */

import React, { useState, useCallback } from 'react';
import styles from './CanvasToolbar.module.css';

export type LayoutType = 'horizontal' | 'vertical' | 'grid' | 'circular' | 'dagre';

export interface CanvasToolbarProps {
  onAddNode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onApplyLayout?: (layoutType: LayoutType) => void;
  isReadOnly?: boolean;
  isOffline?: boolean;
  position?: { top?: number; left?: number; right?: number; bottom?: number };
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  onAddNode,
  onZoomIn,
  onZoomOut,
  onFitView,
  onApplyLayout,
  isReadOnly = false,
  isOffline = false,
  position,
}) => {
  // Local state for UI management
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState<boolean>(false);
  
  // Calculate position styles based on props
  const positionStyle = {
    top: position?.top !== undefined ? `${position.top}px` : '20px',
    left: position?.left !== undefined ? `${position.left}px` : undefined,
    right: position?.right !== undefined ? `${position.right}px` : undefined,
    bottom: position?.bottom !== undefined ? `${position.bottom}px` : undefined,
  };
  
  // Toggle compact mode
  const toggleCompact = useCallback(() => {
    setIsCompact(prev => !prev);
  }, []);
  
  // Toggle layout menu
  const toggleLayoutMenu = useCallback(() => {
    setLayoutMenuOpen(prev => !prev);
  }, []);
  
  // Handle layout selection
  const handleLayoutSelect = useCallback((layoutType: LayoutType) => {
    if (onApplyLayout) {
      onApplyLayout(layoutType);
    }
    setLayoutMenuOpen(false);
  }, [onApplyLayout]);
  
  return (
    <div 
      className={`${styles.toolbar} ${isCompact ? styles.compact : ''} ${isOffline ? styles.offline : ''}`} 
      style={positionStyle}
      data-testid="canvas-toolbar"
    >
      {/* Add Node button */}
      <button
        className={`${styles.button} ${styles.addNodeButton}`}
        onClick={onAddNode}
        disabled={isReadOnly}
        title="Add Node"
        data-testid="add-node-button"
      >
        +
      </button>
      
      <div className={styles.separator} />
      
      <div className={styles.buttonGroup}>
        {/* Zoom In */}
        <button
          className={styles.button}
          onClick={onZoomIn}
          disabled={isReadOnly}
          title="Zoom In"
          data-testid="zoom-in-button"
        >
          +
        </button>
        
        {/* Zoom Out */}
        <button
          className={styles.button}
          onClick={onZoomOut}
          disabled={isReadOnly}
          title="Zoom Out"
          data-testid="zoom-out-button"
        >
          -
        </button>
        
        {/* Fit View */}
        <button
          className={styles.button}
          onClick={onFitView}
          title="Fit View"
          data-testid="fit-view-button"
        >
          ⟲
        </button>
      </div>
      
      <div className={styles.separator} />
      
      {/* Layout controls */}
      {onApplyLayout && (
        <>
          <div className={`${styles.buttonGroup} ${styles.layoutButton} ${layoutMenuOpen ? styles.open : ''}`}>
            <button
              className={styles.button}
              onClick={toggleLayoutMenu}
              disabled={isReadOnly}
              title="Layout Options"
              data-testid="layout-button"
            >
              ⊞
            </button>
            
            {/* Layout dropdown menu */}
            <div className={styles.layoutDropdown}>
              <button 
                className={styles.menuItem} 
                onClick={() => handleLayoutSelect('horizontal')}
                data-testid="layout-horizontal"
              >
                Horizontal Layout
              </button>
              <button 
                className={styles.menuItem} 
                onClick={() => handleLayoutSelect('vertical')}
                data-testid="layout-vertical"
              >
                Vertical Layout
              </button>
              <button 
                className={styles.menuItem} 
                onClick={() => handleLayoutSelect('grid')}
                data-testid="layout-grid"
              >
                Grid Layout
              </button>
              <button 
                className={styles.menuItem} 
                onClick={() => handleLayoutSelect('circular')}
                data-testid="layout-circular"
              >
                Circular Layout
              </button>
              <button 
                className={styles.menuItem} 
                onClick={() => handleLayoutSelect('dagre')}
                data-testid="layout-dagre"
              >
                Hierarchical Layout
              </button>
            </div>
          </div>
          <div className={styles.separator} />
        </>
      )}
      
      {/* Offline Indicator */}
      {isOffline && (
        <div className={styles.offlineIndicator} title="Offline Mode">
          Offline
        </div>
      )}
      
      {/* Compact Toggle */}
      <button
        className={`${styles.button} ${styles.compactToggle}`}
        onClick={toggleCompact}
        title={isCompact ? "Expand" : "Compact"}
        data-testid="toggle-compact-button"
      >
        {isCompact ? '↔' : '↕'}
      </button>
    </div>
  );
}; 