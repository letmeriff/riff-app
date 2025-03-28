/**
 * Enhanced type definitions for React Flow
 *
 * These types extend the base React Flow types to provide better type safety
 * for our application-specific node and edge types.
 */

import { Node as BaseNode, Edge as BaseEdge } from 'reactflow';
// Import but don't use these types directly - they're referenced in type documentation
import type { NodeProps as _NodeProps, EdgeProps as _EdgeProps } from 'reactflow';

// Node Types
export enum NodeType {
  DEFAULT = 'default',
  INPUT = 'input',
  OUTPUT = 'output',
  CHAT = 'chat',
  NOTE = 'note',
  AI = 'ai',
  DOCUMENT = 'document',
  CUSTOM = 'custom',
}

// Base data interface for all nodes
export interface NodeBaseData {
  label: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  isCollapsed?: boolean;
}

// Type-specific data interfaces
export interface ChatNodeData extends NodeBaseData {
  messages?: Array<{
    id: string;
    content: string;
    role: 'user' | 'assistant' | 'system';
    timestamp: string;
  }>;
  status?: 'idle' | 'thinking' | 'error';
}

export interface NoteNodeData extends NodeBaseData {
  content: string;
}

export interface DocumentNodeData extends NodeBaseData {
  documentId: string;
  documentType: 'pdf' | 'image' | 'text';
  documentUrl?: string;
}

export interface AINodeData extends NodeBaseData {
  prompt?: string;
  response?: string;
  model?: string;
  status?: 'idle' | 'generating' | 'error';
}

// Custom node data - catch-all for future node types
export interface CustomNodeData extends NodeBaseData {
  [key: string]: unknown;
}

// Union type for all possible node data types
export type NodeData = 
  | ChatNodeData
  | NoteNodeData
  | DocumentNodeData
  | AINodeData
  | CustomNodeData;

// Enhanced Node type with typed data property
export interface TypedNode<T extends NodeData = NodeData> extends BaseNode {
  type: NodeType | string;
  data: T;
}

// Type guard functions to check node types
export function isChatNode(node: TypedNode): node is TypedNode<ChatNodeData> {
  return node.type === NodeType.CHAT;
}

export function isNoteNode(node: TypedNode): node is TypedNode<NoteNodeData> {
  return node.type === NodeType.NOTE;
}

export function isDocumentNode(node: TypedNode): node is TypedNode<DocumentNodeData> {
  return node.type === NodeType.DOCUMENT;
}

export function isAINode(node: TypedNode): node is TypedNode<AINodeData> {
  return node.type === NodeType.AI;
}

// Edge Types
export enum EdgeType {
  DEFAULT = 'default',
  STRAIGHT = 'straight',
  STEP = 'step',
  BEZIER = 'bezier',
  CUSTOM = 'custom',
}

// Edge data interface
export interface EdgeData {
  label?: string;
  edgeType?: string;
  isHidden?: boolean;
  metadata?: Record<string, unknown>;
}

// Enhanced Edge type with typed data property
export interface TypedEdge extends BaseEdge {
  type?: EdgeType | string;
  data?: EdgeData;
} 