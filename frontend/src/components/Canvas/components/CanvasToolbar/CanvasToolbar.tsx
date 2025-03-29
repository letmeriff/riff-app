/**
 * CanvasToolbar Component
 *
 * Provides UI controls for common canvas actions such as
 * adding nodes and applying layouts.
 */

import React, { useState, useCallback } from 'react';
import styles from './CanvasToolbar.module.css';

export type LayoutType =
  | 'horizontal'
  | 'vertical'
  | 'grid'
  | 'circular'
  | 'dagre';

export interface CanvasToolbarProps {
  onAddNode: () => void;
  onApplyLayout?: (layoutType: LayoutType) => void;
  isReadOnly?: boolean;
  isOffline?: boolean;
  position?: { top?: number; left?: number; right?: number; bottom?: number };
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  onAddNode,
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
    setIsCompact((prev) => !prev);
  }, []);

  // Toggle layout menu
  const toggleLayoutMenu = useCallback(() => {
    setLayoutMenuOpen((prev) => !prev);
  }, []);

  // Handle layout selection
  const handleLayoutSelect = useCallback(
    (layoutType: LayoutType) => {
      if (onApplyLayout) {
        onApplyLayout(layoutType);
      }
      setLayoutMenuOpen(false);
    },
    [onApplyLayout]
  );

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

      {/* Layout controls - these are custom and not provided by React Flow natively */}
      {onApplyLayout && (
        <>
          <div className={styles.separator} />
          <div
            className={`${styles.buttonGroup} ${styles.layoutButton} ${layoutMenuOpen ? styles.open : ''}`}
          >
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
        </>
      )}

      {/* Offline Indicator */}
      {isOffline && (
        <>
          <div className={styles.separator} />
          <div className={styles.offlineIndicator} title="Offline Mode">
            Offline
          </div>
        </>
      )}

      {/* Compact Toggle */}
      <div className={styles.separator} />
      <button
        className={`${styles.button} ${styles.compactToggle}`}
        onClick={toggleCompact}
        title={isCompact ? 'Expand' : 'Compact'}
        data-testid="toggle-compact-button"
      >
        {isCompact ? '↔' : '↕'}
      </button>
    </div>
  );
};
