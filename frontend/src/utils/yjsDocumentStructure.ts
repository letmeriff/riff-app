/**
 * Utilities for Yjs document structure management
 * 
 * These utilities provide structured access to Yjs document components
 * and operations for the Riff application, facilitating collaborative
 * document structure maintenance.
 */

import * as Y from 'yjs';
import { Node, Edge } from 'reactflow';

// Define more specific types for node data and edge data
interface NodeData {
  title?: string;
  description?: string;
  model?: string;
  flavor?: string;
  nodeId?: string | number;
  [key: string]: unknown;
}

interface EdgeData {
  label?: string;
  animated?: boolean;
  [key: string]: unknown;
}

// Type definitions for Yjs shared types
export interface YjsNode extends Y.Map<unknown> {
  get(key: 'id'): string;
  get(key: 'position'): Y.Map<number>;
  get(key: 'data'): Y.Map<unknown>;
  get(key: string): unknown;
}

export interface YjsEdge extends Y.Map<unknown> {
  get(key: 'id'): string;
  get(key: 'source'): string;
  get(key: 'target'): string;
  get(key: 'data'): Y.Map<unknown>;
  get(key: string): unknown;
}

export interface YjsSharedTypes {
  nodes: Y.Map<YjsNode>;
  edges: Y.Map<YjsEdge>;
  metadata: Y.Map<unknown>;
}

/**
 * Initialize a Yjs document with the required shared collections
 * 
 * @param doc - The Yjs document to initialize
 * @returns The initialized document
 */
export function initializeDocument(doc: Y.Doc): Y.Doc {
  // Create shared collections if they don't exist
  doc.getMap('nodes');
  doc.getMap('edges');
  
  // Initialize metadata with default values
  const metadata = doc.getMap('metadata');
  if (!metadata.has('title')) {
    metadata.set('title', 'Untitled Canvas');
  }
  if (!metadata.has('createdAt')) {
    metadata.set('createdAt', new Date().toISOString());
  }
  if (!metadata.has('version')) {
    metadata.set('version', '1.0');
  }

  return doc;
}

/**
 * Get shared data types from the Yjs document
 * 
 * @param doc - The Yjs document
 * @returns Object containing references to nodes, edges, and metadata collections
 */
export function getSharedTypes(doc: Y.Doc): YjsSharedTypes {
  // Get or create shared data structures
  const nodes = doc.getMap('nodes') as Y.Map<YjsNode>;
  const edges = doc.getMap('edges') as Y.Map<YjsEdge>;
  const metadata = doc.getMap('metadata');

  return { nodes, edges, metadata };
}

/**
 * Update a node in the Yjs document
 * 
 * @param doc - The Yjs document
 * @param nodeId - The unique identifier for the node
 * @param node - The React Flow node data
 */
export function updateNode(doc: Y.Doc, nodeId: string, node: Node): void {
  const nodes = doc.getMap('nodes');
  
  // Create or get existing node
  let nodeMap: Y.Map<unknown>;
  if (!nodes.has(nodeId)) {
    nodeMap = new Y.Map();
    nodes.set(nodeId, nodeMap);
  } else {
    nodeMap = nodes.get(nodeId) as Y.Map<unknown>;
  }

  // Set node ID
  nodeMap.set('id', nodeId);
  
  // Create or update position
  let positionMap: Y.Map<number>;
  if (!nodeMap.has('position')) {
    positionMap = new Y.Map();
    nodeMap.set('position', positionMap);
  } else {
    positionMap = nodeMap.get('position') as Y.Map<number>;
  }
  
  // Update position values
  positionMap.set('x', node.position.x);
  positionMap.set('y', node.position.y);
  
  // Create or update data
  let dataMap: Y.Map<unknown>;
  if (!nodeMap.has('data')) {
    dataMap = new Y.Map();
    nodeMap.set('data', dataMap);
  } else {
    dataMap = nodeMap.get('data') as Y.Map<unknown>;
  }
  
  // Update data values
  if (node.data) {
    Object.entries(node.data as NodeData).forEach(([key, value]) => {
      dataMap.set(key, value);
    });
  }
}

/**
 * Update an edge in the Yjs document
 * 
 * @param doc - The Yjs document
 * @param edgeId - The unique identifier for the edge
 * @param edge - The React Flow edge data
 */
export function updateEdge(doc: Y.Doc, edgeId: string, edge: Edge): void {
  const edges = doc.getMap('edges');
  
  // Create or get existing edge
  let edgeMap: Y.Map<unknown>;
  if (!edges.has(edgeId)) {
    edgeMap = new Y.Map();
    edges.set(edgeId, edgeMap);
  } else {
    edgeMap = edges.get(edgeId) as Y.Map<unknown>;
  }

  // Set basic edge properties
  edgeMap.set('id', edgeId);
  edgeMap.set('source', edge.source);
  edgeMap.set('target', edge.target);
  
  // Handle optional properties
  if (edge.type) {
    edgeMap.set('type', edge.type);
  }
  
  // Create or update data
  if (edge.data) {
    let dataMap: Y.Map<unknown>;
    if (!edgeMap.has('data')) {
      dataMap = new Y.Map();
      edgeMap.set('data', dataMap);
    } else {
      dataMap = edgeMap.get('data') as Y.Map<unknown>;
    }
    
    // Update data values
    Object.entries(edge.data as EdgeData).forEach(([key, value]) => {
      dataMap.set(key, value);
    });
  }
}

/**
 * Update metadata in the Yjs document
 * 
 * @param doc - The Yjs document
 * @param metadataUpdate - Object containing metadata updates
 */
export function updateMetadata(doc: Y.Doc, metadataUpdate: Record<string, unknown>): void {
  const metadata = doc.getMap('metadata');
  
  // Update metadata fields
  Object.entries(metadataUpdate).forEach(([key, value]) => {
    metadata.set(key, value);
  });
}

/**
 * Apply Yjs update to a document
 * 
 * @param doc - The target Yjs document
 * @param update - The Yjs update to apply
 */
export function applyYjsUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update);
}

/**
 * Create a node with a generated ID in a transaction
 * 
 * @param doc - The Yjs document
 * @param nodeTemplate - Template for the node to create
 * @returns The generated node ID
 */
export function createNodeWithId(doc: Y.Doc, nodeTemplate: Omit<Node, 'id'>): string {
  let nodeId = '';
  
  // Create node in a transaction for atomicity
  doc.transact(() => {
    // Generate a unique ID
    nodeId = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create the node
    updateNode(doc, nodeId, {
      id: nodeId,
      ...nodeTemplate
    });
  });
  
  return nodeId;
} 