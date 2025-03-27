/**
 * Test Data Generator
 * 
 * This module provides utility functions for generating test data for the Riff application.
 * All generators accept an options object that allows customizing the generated data.
 */

import { v4 as uuidv4 } from 'uuid';
import * as Y from 'yjs';

// User data types
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface generateUserOptions {
  id?: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

// Generate a random user
export function generateUser(options: generateUserOptions = {}): User {
  const randomName = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis'][
    Math.floor(Math.random() * 7)
  ];
  const randomString = Math.random().toString(36).substring(2, 8);
  
  return {
    id: options.id || `user-${uuidv4()}`,
    email: options.email || `${randomString}@example.com`,
    name: options.name || `Test User ${randomName}`,
    avatarUrl: options.avatarUrl,
  };
}

// Node data types
export interface Node {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    content: string;
    [key: string]: any;
  };
}

export interface generateNodeOptions {
  id?: string;
  type?: string;
  position?: {
    x: number;
    y: number;
  };
  data?: {
    content?: string;
    [key: string]: any;
  };
}

// Generate a random node
export function generateNode(options: generateNodeOptions = {}): Node {
  const randomId = Math.random().toString(16).substring(2, 10);
  const randomX = Math.floor(Math.random() * 1000);
  const randomY = Math.floor(Math.random() * 800);
  
  return {
    id: options.id || `node-${randomId}`,
    type: options.type || 'chatNode',
    position: options.position || { x: randomX, y: randomY },
    data: {
      content: options.data?.content || `Test node content ${randomId}`,
      ...options.data
    }
  };
}

// Edge data types
export interface Edge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  label?: string;
  [key: string]: any;
}

export interface generateEdgeOptions {
  id?: string;
  source: string;
  target: string;
  animated?: boolean;
  label?: string;
  [key: string]: any;
}

// Generate a random edge
export function generateEdge(options: generateEdgeOptions): Edge {
  const randomId = Math.random().toString(16).substring(2, 10);
  
  return {
    id: options.id || `edge-${randomId}`,
    source: options.source,
    target: options.target,
    ...(options.animated !== undefined && { animated: options.animated }),
    ...(options.label !== undefined && { label: options.label }),
    ...Object.keys(options)
      .filter(key => !['id', 'source', 'target', 'animated', 'label'].includes(key))
      .reduce((obj, key) => ({ ...obj, [key]: options[key] }), {})
  };
}

// Canvas data types
export interface Canvas {
  id: string;
  name: string;
  createdBy: string;
  nodes: Node[];
  edges: Edge[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface generateCanvasOptions {
  id?: string;
  name?: string;
  createdBy?: string;
  nodes?: Node[];
  edges?: Edge[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

// Generate a random canvas
export function generateCanvas(options: generateCanvasOptions = {}): Canvas {
  const randomId = Math.random().toString(16).substring(2, 10);
  const defaultNodes = Array.from({ length: 2 }, () => generateNode());
  const defaultEdges = defaultNodes.length > 1 
    ? [generateEdge({ source: defaultNodes[0].id, target: defaultNodes[1].id })]
    : [];
  
  return {
    id: options.id || `canvas-${randomId}`,
    name: options.name || `Test Canvas ${randomId}`,
    createdBy: options.createdBy || `user-${uuidv4().substring(0, 8)}`,
    nodes: options.nodes || defaultNodes,
    edges: options.edges || defaultEdges,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt
  };
}

// Chat message data types
export interface ChatMessage {
  id: string;
  nodeId: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface generateChatMessageOptions {
  id?: string;
  nodeId?: string;
  content?: string;
  isUser?: boolean;
  timestamp?: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

// Generate a random chat message
export function generateChatMessage(options: generateChatMessageOptions = {}): ChatMessage {
  const randomId = Math.random().toString(16).substring(2, 10);
  const randomNodeId = Math.random().toString(16).substring(2, 10);
  
  return {
    id: options.id || `message-${randomId}`,
    nodeId: options.nodeId || `node-${randomNodeId}`,
    content: options.content || `Test message content ${randomId}`,
    isUser: options.isUser !== undefined ? options.isUser : Math.random() > 0.5,
    timestamp: options.timestamp || new Date(),
    userId: options.userId,
    metadata: options.metadata
  };
}

// Yjs data types
export interface YjsAwarenessData {
  clientId: number;
  user: {
    id: string;
    name?: string;
    color?: string;
    position?: { x: number; y: number };
  };
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
}

// Generate Yjs awareness data
export function generateYjsAwareness(userId: string, clientId: number = Math.floor(Math.random() * 1000)): YjsAwarenessData {
  const randomColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;
  
  return {
    clientId,
    user: {
      id: userId,
      name: `User ${clientId}`,
      color: randomColor,
      position: { 
        x: Math.floor(Math.random() * 1000), 
        y: Math.floor(Math.random() * 800) 
      }
    },
    cursor: { 
      x: Math.floor(Math.random() * 1000), 
      y: Math.floor(Math.random() * 800) 
    }
  };
}

// Generate mock Yjs update
export function generateYjsUpdate(): Uint8Array {
  // Create a temporary Y.Doc to generate a real update
  const doc = new Y.Doc();
  const map = doc.getMap('test');
  
  // Make some changes to the document
  map.set('key1', 'value1');
  map.set('key2', 'value2');
  
  // Encode the state as an update
  return Y.encodeStateAsUpdate(doc);
}

// Export a helper to generate multiple items
export function generateMultiple<T>(
  generator: (...args: any[]) => T, 
  count: number = 3, 
  options: any = {}
): T[] {
  return Array.from({ length: count }, () => generator(options));
} 