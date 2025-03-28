/**
 * Collaborative Editing Functionality
 * 
 * This module provides functions for implementing collaborative editing
 * features in the Riff application, with a focus on conflict resolution
 * and synchronization of concurrent changes from multiple users.
 * 
 * Reference: REQ-401 Collaborative Editing
 */

import * as Y from 'yjs';
import { Node, Edge } from 'reactflow';

// Node structure as stored in Yjs
interface YjsNode {
  id: string;
  position: {
    x: number;
    y: number;
    timestamp?: number;
  };
  data: Record<string, any> & {
    timestamp?: number;
  };
  type?: string;
  style?: Record<string, any>;
}

// Edge structure as stored in Yjs
interface YjsEdge {
  id: string;
  source: string;
  target: string;
  data?: Record<string, any> & {
    timestamp?: number;
  };
  style?: Record<string, any>;
  animated?: boolean;
}

/**
 * Applies an update to a node in the Yjs document
 * 
 * @param doc The Yjs document
 * @param nodeId ID of the node to update
 * @param nodeUpdate Updates to apply to the node
 */
export function applyNodeUpdate(
  doc: Y.Doc,
  nodeId: string,
  nodeUpdate: Partial<Node>
): void {
  doc.transact(() => {
    const nodesMap = doc.getMap('nodes');
    
    // Skip if node doesn't exist
    if (!nodesMap.has(nodeId)) {
      return;
    }
    
    // Get the current node data from Yjs
    const currentNodeData = nodesMap.get(nodeId) as YjsNode;
    
    // Apply updates
    if (nodeUpdate.position) {
      const updatedPosition = {
        ...currentNodeData.position,
        ...nodeUpdate.position,
        timestamp: Date.now() // Add timestamp for conflict resolution
      };
      
      currentNodeData.position = updatedPosition;
    }
    
    if (nodeUpdate.data) {
      const updatedData = {
        ...currentNodeData.data,
        ...nodeUpdate.data,
        timestamp: Date.now() // Add timestamp for conflict resolution
      };
      
      currentNodeData.data = updatedData;
    }
    
    // Update other properties if needed
    if (nodeUpdate.type) {
      currentNodeData.type = nodeUpdate.type;
    }
    
    if (nodeUpdate.style) {
      currentNodeData.style = {
        ...currentNodeData.style,
        ...nodeUpdate.style
      };
    }
    
    // Write back to the shared map
    nodesMap.set(nodeId, currentNodeData);
  });
}

/**
 * Applies an update to an edge in the Yjs document
 * 
 * @param doc The Yjs document
 * @param edgeId ID of the edge to update
 * @param edgeUpdate Updates to apply to the edge
 */
export function applyEdgeUpdate(
  doc: Y.Doc,
  edgeId: string,
  edgeUpdate: Partial<Edge>
): void {
  doc.transact(() => {
    const edgesMap = doc.getMap('edges');
    
    // Skip if edge doesn't exist
    if (!edgesMap.has(edgeId)) {
      return;
    }
    
    // Get the current edge data from Yjs
    const currentEdgeData = edgesMap.get(edgeId) as YjsEdge;
    
    // Apply updates
    if (edgeUpdate.source) {
      currentEdgeData.source = edgeUpdate.source;
    }
    
    if (edgeUpdate.target) {
      currentEdgeData.target = edgeUpdate.target;
    }
    
    if (edgeUpdate.data) {
      const updatedData = {
        ...currentEdgeData.data || {},
        ...edgeUpdate.data,
        timestamp: Date.now() // Add timestamp for conflict resolution
      };
      
      currentEdgeData.data = updatedData;
    }
    
    if (edgeUpdate.style) {
      currentEdgeData.style = {
        ...currentEdgeData.style || {},
        ...edgeUpdate.style
      };
    }
    
    if (edgeUpdate.animated !== undefined) {
      currentEdgeData.animated = edgeUpdate.animated;
    }
    
    // Write back to the shared map
    edgesMap.set(edgeId, currentEdgeData);
  });
}

/**
 * Type of conflicts that can occur during collaborative editing
 */
type ConflictType = 'position' | 'content' | 'data' | 'style';

/**
 * Resolves conflicts between concurrent updates using appropriate strategies
 * 
 * @param type Type of conflict to resolve
 * @param original Original value before concurrent changes
 * @param userAValue Value from user A
 * @param userBValue Value from user B
 * @param timestampA Timestamp of user A's changes
 * @param timestampB Timestamp of user B's changes
 * @returns Resolved value
 */
export function resolveConflict<T>(
  type: ConflictType,
  original: T,
  userAValue: T,
  userBValue: T,
  timestampA: number,
  timestampB: number
): T {
  // Position conflicts: use last-writer-wins
  if (type === 'position') {
    return timestampA > timestampB ? userAValue : userBValue;
  }
  
  // Content conflicts: preserve both changes
  if (type === 'content') {
    // Simple string concatenation with marker for clarity
    if (typeof userAValue === 'string' && typeof userBValue === 'string') {
      // Determine which came first for ordering
      if (timestampA < timestampB) {
        return `${userAValue}\n\n---\n\n${userBValue}` as unknown as T;
      } else {
        return `${userBValue}\n\n---\n\n${userAValue}` as unknown as T;
      }
    }
    
    // Default to last writer wins for non-string content
    return timestampA > timestampB ? userAValue : userBValue;
  }
  
  // Data conflicts: deep merge with array concatenation
  if (type === 'data') {
    if (typeof userAValue === 'object' && typeof userBValue === 'object' && !Array.isArray(userAValue)) {
      const mergedData = { ...userAValue as object } as Record<string, any>;
      
      // Merge properties from userB
      for (const key in userBValue as object) {
        const valueA = (userAValue as Record<string, any>)[key];
        const valueB = (userBValue as Record<string, any>)[key];
        
        // If both users modified the same nested object
        if (typeof valueA === 'object' && typeof valueB === 'object' && !Array.isArray(valueA)) {
          // Recursively resolve nested object conflicts
          mergedData[key] = resolveConflict(
            'data',
            original ? (original as Record<string, any>)[key] : {},
            valueA,
            valueB,
            timestampA,
            timestampB
          );
        }
        // If both modified the same array, concatenate unique values
        else if (Array.isArray(valueA) && Array.isArray(valueB)) {
          // Combine arrays and remove duplicates using Array.from() instead of spread operator
          const combinedSet = new Set([...valueA, ...valueB]);
          mergedData[key] = Array.from(combinedSet);
        }
        // For primitive values, use last-writer-wins
        else {
          mergedData[key] = timestampB > timestampA ? valueB : valueA;
        }
      }
      
      // Add any properties from userA that weren't in userB
      for (const key in userAValue as object) {
        if (!mergedData.hasOwnProperty(key)) {
          mergedData[key] = (userAValue as Record<string, any>)[key];
        }
      }
      
      return mergedData as unknown as T;
    }
    
    // For arrays, concatenate unique values
    if (Array.isArray(userAValue) && Array.isArray(userBValue)) {
      // Use Array.from() instead of spread operator
      const combinedSet = new Set([...userAValue, ...userBValue]);
      return Array.from(combinedSet) as unknown as T;
    }
    
    // Default to last writer wins for other types
    return timestampA > timestampB ? userAValue : userBValue;
  }
  
  // Style conflicts: merge styles with last-writer-wins for individual properties
  if (type === 'style') {
    if (typeof userAValue === 'object' && typeof userBValue === 'object') {
      return {
        ...(userAValue as object),
        ...(userBValue as object)
      } as unknown as T;
    }
    
    return timestampA > timestampB ? userAValue : userBValue;
  }
  
  // Default to last-writer-wins for unknown conflict types
  return timestampA > timestampB ? userAValue : userBValue;
}

/**
 * Creates a multiuser test harness for testing collaborative features.
 * This is only exported for test use.
 */
export const createTestMultiUserEnvironment = () => {
  throw new Error('This function should only be used in test files, not in production code');
}; 