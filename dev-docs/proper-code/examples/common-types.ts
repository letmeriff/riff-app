/**
 * Common TypeScript utility types
 * 
 * This file provides utility types for common patterns and external libraries
 * to help reduce the use of 'any' types in the codebase.
 */

import { Node, Edge } from 'reactflow';

// ==============================
// Yjs-related types
// ==============================

/**
 * Represents a Yjs document with common methods
 */
export interface YDoc {
  clientID: number;
  gc: boolean;
  store: unknown;
  getMap: (name: string) => YMap<any>;
  getArray: <T = any>(name: string) => YArray<T>;
  getText: (name: string) => YText;
  on: (eventName: string, callback: YEventCallback) => void;
  off: (eventName: string, callback: YEventCallback) => void;
  transact: (transaction: () => void) => void;
  destroy: () => void;
}

/**
 * Represents a Yjs map data structure
 */
export interface YMap<T> {
  get: (key: string) => T;
  set: (key: string, value: T) => void;
  delete: (key: string) => void;
  has: (key: string) => boolean;
  forEach: (callback: (value: T, key: string) => void) => void;
  entries: () => IterableIterator<[string, T]>;
  toJSON: () => Record<string, T>;
  observe: (callback: YObserveCallback<Map<string, T>>) => void;
  unobserve: (callback: YObserveCallback<Map<string, T>>) => void;
}

/**
 * Represents a Yjs array data structure
 */
export interface YArray<T> {
  length: number;
  insert: (index: number, content: T[]) => void;
  push: (content: T[]) => void;
  delete: (index: number, length: number) => void;
  get: (index: number) => T;
  toArray: () => T[];
  toJSON: () => T[];
  forEach: (callback: (value: T, index: number) => void) => void;
  map: <M>(callback: (value: T, index: number) => M) => M[];
  observe: (callback: YObserveCallback<T[]>) => void;
  unobserve: (callback: YObserveCallback<T[]>) => void;
}

/**
 * Represents a Yjs text data structure
 */
export interface YText {
  toString: () => string;
  insert: (index: number, content: string) => void;
  delete: (index: number, length: number) => void;
  length: number;
  observe: (callback: YObserveCallback<string>) => void;
  unobserve: (callback: YObserveCallback<string>) => void;
}

/**
 * Generic event callback type for Yjs
 */
export type YEventCallback = (event: YEvent, transaction: YTransaction) => void;

/**
 * Generic observe callback type for Yjs
 */
export type YObserveCallback<T> = (event: YEvent, transaction: YTransaction) => void;

/**
 * Represents a Yjs event
 */
export interface YEvent {
  target: unknown;
  currentTarget: unknown;
  transaction: YTransaction;
  path: string[];
}

/**
 * Represents a Yjs transaction
 */
export interface YTransaction {
  local: boolean;
  origin: unknown;
  doc: YDoc;
}

// ==============================
// Websocket and awareness types
// ==============================

/**
 * Represents a WebSocket provider for Yjs
 */
export interface YWebsocketProvider {
  doc: YDoc;
  awareness: YAwareness;
  wsconnected: boolean;
  bcconnected: boolean;
  connect: () => void;
  disconnect: () => void;
  destroy: () => void;
  on: (eventName: string, callback: WebsocketEventCallback) => void;
  off: (eventName: string, callback: WebsocketEventCallback) => void;
}

/**
 * Websocket event callback type
 */
export type WebsocketEventCallback = (data: WebsocketEventData) => void;

/**
 * Websocket event data structure
 */
export interface WebsocketEventData {
  status?: string;
  type?: string;
  data?: unknown;
  [key: string]: unknown;
}

/**
 * Represents an awareness instance for user presence
 */
export interface YAwareness {
  clientID: number;
  doc: YDoc;
  getLocalState: () => AwarenessState | null;
  setLocalState: (state: AwarenessState) => void;
  getStates: () => Map<number, AwarenessState>;
  on: (eventName: string, callback: AwarenessEventCallback) => void;
  off: (eventName: string, callback: AwarenessEventCallback) => void;
}

/**
 * Awareness event callback type
 */
export type AwarenessEventCallback = (
  changes: { added: number[]; updated: number[]; removed: number[] },
  origin: unknown
) => void;

/**
 * Awareness state structure
 */
export interface AwarenessState {
  user?: {
    id: string;
    name: string;
    color?: string;
    [key: string]: unknown;
  };
  cursor?: {
    x: number;
    y: number;
  };
  editing?: {
    nodeId: string;
    timestamp?: number;
  } | null;
  isOnline?: boolean;
  [key: string]: unknown;
}

// ==============================
// ReactFlow extensions
// ==============================

/**
 * Node data extension for application-specific properties
 */
export interface NodeData {
  content: string;
  status?: 'draft' | 'published' | 'archived';
  createdBy?: string;
  updatedBy?: string;
  createdAt?: number;
  updatedAt?: number;
  collaborators?: string[];
  permissions?: NodePermissions;
  [key: string]: unknown;
}

/**
 * Node permissions structure
 */
export interface NodePermissions {
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  [key: string]: boolean;
}

/**
 * Custom node type for the application
 */
export interface CustomNode extends Node {
  data: NodeData;
  position: {
    x: number;
    y: number;
    timestamp?: number;
  };
}

/**
 * Edge data extension for application-specific properties
 */
export interface EdgeData {
  label?: string;
  type?: string;
  createdBy?: string;
  createdAt?: number;
  [key: string]: unknown;
}

/**
 * Custom edge type for the application
 */
export interface CustomEdge extends Edge {
  data: EdgeData;
}

// ==============================
// Testing Utility Types
// ==============================

/**
 * Generic Mock Function with typed parameters and return
 */
export type MockFn<TParams extends unknown[] = any[], TReturn = any> = 
  jest.Mock<TReturn, TParams>;

/**
 * Event callback for test components
 */
export type EventCallback<T = unknown> = (event: T) => void;

/**
 * Callback function with specified parameters
 */
export type CallbackFn<TParams extends unknown[] = unknown[], TReturn = void> = 
  (...args: TParams) => TReturn;

/**
 * Mock implementation of a document for testing
 */
export interface MockDocument {
  getById: (id: string) => unknown;
  getAll: () => unknown[];
  create: (data: unknown) => string;
  update: (id: string, data: unknown) => void;
  delete: (id: string) => void;
}

/**
 * Test fixture generator function type
 */
export type FixtureGenerator<T> = (overrides?: Partial<T>) => T;

/**
 * Test factory function type
 */
export type Factory<T, P = unknown> = (params?: P) => T;

// ==============================
// Other Utility Types
// ==============================

/**
 * Makes all properties of T optional and allows for unknown additional properties
 */
export type ExtendedPartial<T> = {
  [P in keyof T]?: T[P];
} & Record<string, unknown>;

/**
 * Generic async result type
 */
export type AsyncResult<T> = Promise<T>;

/**
 * Function with error handling and callback
 */
export type SafeFunction<TParams extends unknown[], TReturn> = 
  (...args: TParams) => Promise<TReturn | Error>;

/**
 * Typed version of Record
 */
export type TypedRecord<K extends string | number | symbol, T> = Record<K, T>;

/**
 * Type for a dictionary with string keys
 */
export type Dictionary<T> = Record<string, T>;

/**
 * Type safe event emitter
 */
export interface TypedEventEmitter<Events extends Record<string, unknown[]>> {
  on<E extends keyof Events>(event: E, listener: (...args: Events[E]) => void): this;
  off<E extends keyof Events>(event: E, listener: (...args: Events[E]) => void): this;
  emit<E extends keyof Events>(event: E, ...args: Events[E]): boolean;
}

// Export a namespace with all types to make imports cleaner
export namespace AppTypes {
  export type Document = YDoc;
  export type WebSocketProvider = YWebsocketProvider;
  export type Awareness = YAwareness;
  export type AppNode = CustomNode;
  export type AppEdge = CustomEdge;
} 