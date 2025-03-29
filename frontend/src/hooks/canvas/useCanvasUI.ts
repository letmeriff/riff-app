/**
 * useCanvasUI Hook
 * 
 * This hook provides UI state management for the Canvas component.
 * It handles selection state, viewport management, and UI element positioning.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  ViewportBounds,
  UseCanvasUIResult 
} from '../../types/canvas';

/**
 * Custom hook for managing Canvas UI state
 * Provides functionality for managing selected nodes, viewport, and UI elements
 */
export function useCanvasUI(): UseCanvasUIResult {
  // Selection state
  const [selectedNodeId, setSelectedNodeIdInternal] = useState<string | null>(null);
  const [selectedNodeContent, setSelectedNodeContentInternal] = useState<string | null>(null);
  
  // Viewport state
  const [viewport, setViewport] = useState<ViewportBounds | null>(null);
  
  // UI element states
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  
  // Handle selection - clearing content when node is deselected
  const setSelectedNodeId = useCallback((nodeId: string | null) => {
    setSelectedNodeIdInternal(nodeId);
    if (nodeId === null) {
      setSelectedNodeContentInternal(null);
    }
  }, []);
  
  // Memoized menu position based on viewport
  const getMenuPosition = useCallback(() => {
    // Default position (top right corner with padding)
    const defaultPosition = { top: 20, right: 20 };
    
    if (!viewport) {
      return defaultPosition;
    }
    
    // Calculate position based on viewport
    // This can be adjusted based on the specific UI requirements
    const paddingX = 20;
    const paddingY = 20;
    
    return {
      top: paddingY,
      right: paddingX
    };
  }, [viewport]);
  
  // Toggle menu open/closed state
  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prevState => !prevState);
  }, []);
  
  // For consistency, define setter with the same name pattern
  const setSelectedNodeContent = useCallback((content: string | null) => {
    setSelectedNodeContentInternal(content);
  }, []);
  
  return {
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeContent,
    setSelectedNodeContent,
    viewport,
    setViewport,
    isMenuOpen,
    toggleMenu,
    getMenuPosition
  };
} 