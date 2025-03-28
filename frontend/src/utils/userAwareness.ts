/**
 * User Awareness Functionality
 * 
 * This module provides utilities for handling user presence, cursor positions,
 * and editing status information in collaborative environments using Yjs.
 * 
 * Reference: REQ-501 User Awareness
 */

import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';

/**
 * Interface defining a user's cursor position
 */
export interface CursorPosition {
  userId: string;
  clientId: number;
  position: { x: number; y: number };
  color?: string;
}

/**
 * Interface defining a user's editing status
 */
export interface EditingStatus {
  userId: string;
  clientId: number;
  nodeId: string;
}

/**
 * Interface defining a user's presence in the canvas
 */
export interface UserPresence {
  userId: string;
  clientId: number;
  userName?: string;
  isOnline: boolean;
  lastActive?: number;
}

// Define a type for the awareness state
interface AwarenessState {
  user?: {
    id?: string;
    name?: string;
  };
  cursor?: { x: number; y: number };
  editing?: { nodeId?: string };
  isOnline?: boolean;
  lastActive?: number;
}

// Define a type for the window with YjsWebsocketProvider
interface WindowWithYjs extends Window {
  yjsWebsocketProvider?: {
    awareness?: awarenessProtocol.Awareness;
  };
}

/**
 * Helper function to get the awareness instance from a Y.Doc
 */
const getAwareness = (_doc: Y.Doc): awarenessProtocol.Awareness | null => {
  // In the real application, this would likely be stored in the window object
  // or passed via context rather than being derived from the doc
  return ((window as unknown) as WindowWithYjs).yjsWebsocketProvider?.awareness || null;
};

/**
 * Update the local user's cursor position
 * 
 * @param doc The Yjs document
 * @param position The cursor position to set (x, y coordinates)
 */
export function updateUserCursor(
  doc: Y.Doc,
  position: { x: number; y: number }
): void {
  const awareness = getAwareness(doc);
  if (!awareness) return;
  
  const currentState = awareness.getLocalState() || {};
  
  awareness.setLocalState({
    ...currentState,
    cursor: position
  });
}

/**
 * Update the local user's editing status
 * 
 * @param doc The Yjs document
 * @param nodeId ID of the node being edited (or null if not editing)
 * @param isEditing Whether the user is currently editing the node
 */
export function updateEditingStatus(
  doc: Y.Doc,
  nodeId: string | null,
  isEditing: boolean
): void {
  const awareness = getAwareness(doc);
  if (!awareness) return;
  
  const currentState = awareness.getLocalState() || {};
  
  // Update editing status based on isEditing flag
  if (isEditing && nodeId) {
    awareness.setLocalState({
      ...currentState,
      editing: { nodeId }
    });
  } else {
    // If we're not editing, remove the editing property
    const newState = { ...currentState };
    if (newState.editing) {
      delete newState.editing;
    }
    awareness.setLocalState(newState);
  }
}

/**
 * Update the local user's presence status (online/offline)
 * 
 * @param doc The Yjs document
 * @param isOnline Whether the user is currently online
 */
export function updateUserPresence(
  doc: Y.Doc,
  isOnline: boolean
): void {
  const awareness = getAwareness(doc);
  if (!awareness) return;
  
  const currentState = awareness.getLocalState() || {};
  
  awareness.setLocalState({
    ...currentState,
    isOnline,
    lastActive: isOnline ? Date.now() : currentState.lastActive
  });
}

/**
 * Get all users currently in the canvas
 * 
 * @param doc The Yjs document
 * @returns Array of user presence information
 */
export function getUsersInCanvas(doc: Y.Doc): UserPresence[] {
  const awareness = getAwareness(doc);
  if (!awareness) return [];
  
  const states = awareness.getStates();
  const users: UserPresence[] = [];
  
  // Loop through all states to gather connected users
  states.forEach((state: unknown, clientId: number) => {
    const userState = state as AwarenessState;
    // Skip states without proper user info
    if (!userState.user || !userState.user.id) return;
    
    // Skip ourselves
    if (clientId === doc.clientID) return;
    
    // Skip users explicitly marked as offline
    if (userState.isOnline === false) return;
    
    // Determine online status - default to true if not specified
    const isOnline = userState.isOnline === undefined ? true : userState.isOnline;
    
    users.push({
      userId: userState.user.id,
      clientId,
      userName: userState.user.name,
      isOnline,
      lastActive: userState.lastActive || Date.now()
    });
  });
  
  return users;
}

/**
 * Get all users currently editing nodes
 * 
 * @param doc The Yjs document
 * @returns Array of user editing status information
 */
export function getEditingUsers(doc: Y.Doc): EditingStatus[] {
  const awareness = getAwareness(doc);
  if (!awareness) return [];
  
  const states = awareness.getStates();
  const editingUsers: EditingStatus[] = [];
  
  states.forEach((state: unknown, clientId: number) => {
    const userState = state as AwarenessState;
    // Skip states without proper user info or editing status
    if (!userState.user || !userState.user.id || !userState.editing || !userState.editing.nodeId) return;
    
    // Skip ourselves
    if (clientId === doc.clientID) return;
    
    editingUsers.push({
      userId: userState.user.id,
      clientId,
      nodeId: userState.editing.nodeId
    });
  });
  
  return editingUsers;
}

/**
 * Get all users editing a specific node
 * 
 * @param doc The Yjs document
 * @param nodeId ID of the node to check
 * @returns Array of users editing the node
 */
export function getUsersAtNode(doc: Y.Doc, nodeId: string): UserPresence[] {
  const awareness = getAwareness(doc);
  if (!awareness) return [];
  
  const states = awareness.getStates();
  const usersAtNode: UserPresence[] = [];
  
  states.forEach((state: unknown, clientId: number) => {
    const userState = state as AwarenessState;
    // Skip states without proper user info or editing status
    if (!userState.user || !userState.user.id) return;
    
    // Skip ourselves
    if (clientId === doc.clientID) return;
    
    // Check if user is editing the specified node
    if (userState.editing && userState.editing.nodeId === nodeId) {
      // Determine online status - default to true if not specified
      const isOnline = userState.isOnline === undefined ? true : userState.isOnline;
      
      usersAtNode.push({
        userId: userState.user.id,
        clientId,
        userName: userState.user.name,
        isOnline
      });
    }
  });
  
  return usersAtNode;
}

/**
 * Get cursor positions of all users
 * 
 * @param doc The Yjs document
 * @returns Array of user cursor positions
 */
export function getUserCursors(doc: Y.Doc): CursorPosition[] {
  const awareness = getAwareness(doc);
  if (!awareness) return [];
  
  const states = awareness.getStates();
  const cursors: CursorPosition[] = [];
  
  states.forEach((state: unknown, clientId: number) => {
    const userState = state as AwarenessState;
    // Skip states without proper user info or cursor
    if (!userState.user || !userState.user.id || !userState.cursor) return;
    
    // Skip ourselves
    if (clientId === doc.clientID) return;
    
    // Get user's cursor
    cursors.push({
      userId: userState.user.id,
      clientId,
      position: userState.cursor
    });
  });
  
  return cursors;
}

/**
 * Generate a consistent color for a user based on their ID
 * 
 * @param userId User ID to generate color for
 * @returns HSL color string
 */
export function getUserColor(userId: string): string {
  // Simple hash function to generate a color
  const hash = userId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  // Convert to HSL color (keeping saturation and lightness constant)
  // This ensures nice, distinct colors with good contrast
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
} 