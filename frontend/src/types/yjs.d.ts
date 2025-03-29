/**
 * Type declarations for Yjs library
 * 
 * These type definitions extend the official Yjs types with application-specific
 * types and interfaces to improve type safety across the codebase.
 */

import { Node, Edge } from 'reactflow';
import * as Y from 'yjs';

// Core Yjs document type extensions
export interface YjsDocumentData {
  nodes: Map<string, Node>;
  edges: Map<string, Edge>;
  [key: string]: unknown;
}

// Enhanced YDoc with strongly typed maps
export interface EnhancedYDoc extends Y.Doc {
  getMap(name: 'nodes'): YjsMap<string, Node>;
  getMap(name: 'edges'): YjsMap<string, Edge>;
  getMap(name: string): YjsMap<string, unknown>;
}

// Type-safe map interface for Yjs
export interface YjsMap<K extends string | number, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  delete(key: K): void;
  has(key: K): boolean;
  forEach(callback: (value: V, key: K) => void): void;
  toJSON(): Record<string, V>;
  observe(callback: (event: Y.YMapEvent<V>) => void): () => void;
  unobserve(callback: (event: Y.YMapEvent<V>) => void): void;
}

// Awareness Types
export interface UserAwarenessState {
  id?: string;
  name?: string;
  color?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
  cursor?: {
    x: number;
    y: number;
  };
  editing?: {
    nodeId: string;
  };
  selection?: string[];
  isOnline?: boolean;
  lastActive?: number;
  [key: string]: unknown;
}

export interface YjsAwareness {
  getLocalState(): UserAwarenessState;
  setLocalState(state: UserAwarenessState): void;
  getStates(): Record<number, UserAwarenessState>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
  setLocalStateField(field: string, value: unknown): void;
  getLocalClientId(): number;
  destroy(): void;
}

// Provider interface for WebSocket or other network providers
export interface YjsProvider {
  awareness: YjsAwareness;
  connect(): void;
  disconnect(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
  destroy(): void;
}

// Application-specific Yjs context interface
export interface YjsContext {
  ydoc: EnhancedYDoc;
  isConnected: boolean;
  isOffline: boolean;
  offlineChangesCount: number;
  syncStatus: string | null;
  connectedUsers: UserAwarenessState[];
  updateAwareness: (data: Partial<UserAwarenessState>) => void;
  getNodesFromYjs: () => Node[];
  getEdgesFromYjs: () => Edge[];
  syncNodeToYjs: (node: Node) => void;
  syncEdgeToYjs: (edge: Edge) => void;
  deleteNodeFromYjs: (nodeId: string) => void;
  deleteEdgeFromYjs: (edgeId: string) => void;
  isFeatureEnabled: boolean;
  hasPendingSyncs: boolean;
  forceSync: () => Promise<boolean>;
} 