/**
 * Mocking utilities for Yjs in tests
 * 
 * These utilities provide mock implementations of Yjs classes and methods
 * for testing collaborative features without requiring a real Yjs setup.
 */

import * as _Y from 'yjs';
import * as _awarenessProtocol from 'y-protocols/awareness';
import * as _syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import { EventEmitter } from 'events';

// Define domain-specific types for our mock implementations
interface _YjsMapValue {
  [key: string]: unknown;
}

interface YjsMapUpdateEvent {
  key?: string;
  newValue?: unknown;
  oldValue?: unknown;
  keys?: string[];
}

interface YjsTextUpdateEvent {
  index: number;
  text?: string;
  length?: number;
  deletedText?: string;
}

interface YjsArrayUpdateEvent {
  type: 'push' | 'insert' | 'delete';
  index?: number;
  item?: unknown;
  length?: number;
  deleted?: unknown[];
}

interface YjsTransactionEvent {
  currentTarget: YjsDoc;
  target: YjsDoc;
  transaction: {
    origin: string;
    local: boolean;
    changesets: unknown[];
    changed: Map<unknown, unknown>;
    deleteSet: { 
      clients: Map<unknown, unknown> 
    };
  };
}

interface YjsAwarenessEvent {
  currentTarget: YjsAwareness;
  added: number[];
  updated: number[];
  removed: number[];
}

interface _YjsAwarenessChangeEvent {
  added: number[];
  updated: number[];
  removed: number[];
}

// Utility type for event callbacks
type EventCallback = (...args: unknown[]) => void;

// Mock interfaces
interface YjsMap {
  set: (key: string, value: unknown) => unknown;
  get: (key: string) => unknown;
  delete: (key: string) => boolean;
  has: (key: string) => boolean;
  size: () => number;
  observe: (callback: (event: YjsMapUpdateEvent) => void) => () => void;
  toJSON: () => Record<string, unknown>;
  clear: () => void;
}

interface YjsText {
  toString: () => string;
  insert: (index: number, text: string) => string;
  delete: (index: number, length: number) => void;
  toJSON: () => string;
  length: () => number;
  observe: (callback: (event: YjsTextUpdateEvent) => void) => () => void;
}

interface YjsArray {
  push: (item: unknown) => void;
  insert: (index: number, item: unknown) => void;
  delete: (index: number, length?: number) => void;
  get: (index: number) => unknown;
  toArray: () => unknown[];
  toJSON: () => unknown[];
  length: () => number;
  observe: (callback: (event: YjsArrayUpdateEvent) => void) => () => void;
}

interface YjsDoc {
  clientID: number;
  getMap: (name: string) => YjsMap;
  getText: (name: string) => YjsText;
  getArray: (name: string) => YjsArray;
  on: (eventName: string, callback: EventCallback) => () => void;
  off: (eventName: string, callback: EventCallback) => void;
  emit: (eventName: string, ...args: unknown[]) => void;
  transact: (fn: () => void, origin?: unknown) => void;
  destroy: () => void;
  share: {
    maps: Record<string, YjsMap>;
    texts: Record<string, YjsText>;
    arrays: Record<string, YjsArray>;
  };
  gc: boolean;
  shouldLoad: boolean;
  isLoaded: boolean;
}

interface YjsAwareness {
  getLocalState: () => Record<string, unknown> | null;
  setLocalState: (state: Record<string, unknown>) => void;
  setLocalStateField: (field: string, value: unknown) => void;
  getStates: () => Map<number, Record<string, unknown>>;
  setClientState: (clientId: number, state: Record<string, unknown>) => void;
  removeClientState: (clientId: number) => void;
  on: (eventName: string, callback: EventCallback) => () => void;
  off: (eventName: string, callback: EventCallback) => void;
  destroy: () => void;
  doc: YjsDoc;
}

/**
 * Creates a mock Y.Map
 */
export function mockMap(): YjsMap {
  const store = new Map<string, unknown>();
  const eventEmitter = new EventEmitter();
  
  return {
    set: (key: string, value: unknown) => {
      store.set(key, value);
      eventEmitter.emit('update', { key, newValue: value });
      return value;
    },
    get: (key: string) => store.get(key),
    delete: (key: string) => {
      const had = store.has(key);
      store.delete(key);
      if (had) {
        eventEmitter.emit('update', { key, oldValue: undefined });
      }
      return had;
    },
    has: (key: string) => store.has(key),
    size: () => store.size,
    observe: (callback: (event: YjsMapUpdateEvent) => void) => {
      eventEmitter.on('update', callback);
      return () => eventEmitter.off('update', callback);
    },
    toJSON: () => {
      const json: Record<string, unknown> = {};
      for (const [key, value] of store.entries()) {
        json[key] = value;
      }
      return json;
    },
    clear: () => {
      store.clear();
      eventEmitter.emit('update', { keys: [] });
    }
  };
}

/**
 * Creates a mock Y.Text
 */
export function mockText(): YjsText {
  let content = '';
  const eventEmitter = new EventEmitter();
  
  return {
    toString: () => content,
    insert: (index: number, text: string) => {
      content = content.substring(0, index) + text + content.substring(index);
      eventEmitter.emit('update', { index, text });
      return content;
    },
    delete: (index: number, length: number) => {
      const deletedText = content.substring(index, index + length);
      content = content.substring(0, index) + content.substring(index + length);
      eventEmitter.emit('update', { index, length, deletedText });
    },
    toJSON: () => content,
    length: () => content.length,
    observe: (callback: (event: YjsTextUpdateEvent) => void) => {
      eventEmitter.on('update', callback);
      return () => eventEmitter.off('update', callback);
    }
  };
}

/**
 * Creates a mock Y.Array
 */
export function mockArray(): YjsArray {
  const items: unknown[] = [];
  const eventEmitter = new EventEmitter();
  
  return {
    push: (item: unknown) => {
      items.push(item);
      eventEmitter.emit('update', { type: 'push', item });
    },
    insert: (index: number, item: unknown) => {
      items.splice(index, 0, item);
      eventEmitter.emit('update', { type: 'insert', index, item });
    },
    delete: (index: number, length: number = 1) => {
      const deleted = items.splice(index, length);
      eventEmitter.emit('update', { type: 'delete', index, length, deleted });
    },
    get: (index: number) => items[index],
    toArray: () => [...items],
    toJSON: () => [...items],
    length: () => items.length,
    observe: (callback: (event: YjsArrayUpdateEvent) => void) => {
      eventEmitter.on('update', callback);
      return () => eventEmitter.off('update', callback);
    }
  };
}

/**
 * Creates a mock Y.Doc
 */
export function mockDoc(): YjsDoc {
  const eventEmitter = new EventEmitter();
  const maps: Record<string, ReturnType<typeof mockMap>> = {};
  const texts: Record<string, ReturnType<typeof mockText>> = {};
  const arrays: Record<string, ReturnType<typeof mockArray>> = {};
  const clientID = Math.floor(Math.random() * 1000);
  
  const doc: YjsDoc = {
    clientID,
    getMap: (name: string) => {
      if (!maps[name]) {
        maps[name] = mockMap();
      }
      return maps[name];
    },
    getText: (name: string) => {
      if (!texts[name]) {
        texts[name] = mockText();
      }
      return texts[name];
    },
    getArray: (name: string) => {
      if (!arrays[name]) {
        arrays[name] = mockArray();
      }
      return arrays[name];
    },
    on: (eventName: string, callback: EventCallback) => {
      eventEmitter.on(eventName, callback);
      return () => eventEmitter.off(eventName, callback);
    },
    off: (eventName: string, callback: EventCallback) => {
      eventEmitter.off(eventName, callback);
    },
    emit: (eventName: string, ...args: unknown[]) => {
      eventEmitter.emit(eventName, ...args);
    },
    transact: (fn: () => void, origin?: unknown) => {
      fn();
      const update = mockUpdate();
      eventEmitter.emit('update', update, origin);
    },
    destroy: () => {
      eventEmitter.removeAllListeners();
    },
    // Mock document state for testing
    share: {
      maps,
      texts,
      arrays
    },
    gc: false,
    shouldLoad: true,
    isLoaded: true
  };
  
  return doc;
}

/**
 * Creates a mock awareness instance
 */
export function mockAwareness(doc: ReturnType<typeof mockDoc>): YjsAwareness {
  const states = new Map<number, Record<string, unknown>>();
  const eventEmitter = new EventEmitter();
  let localState: Record<string, unknown> | null = null;
  
  const awareness: YjsAwareness = {
    getLocalState: () => localState,
    setLocalState: (state: Record<string, unknown>) => {
      const prevState = localState;
      localState = state;
      states.set(doc.clientID, state);
      eventEmitter.emit('change', {
        added: prevState ? [] : [doc.clientID],
        updated: prevState ? [doc.clientID] : [],
        removed: []
      });
    },
    setLocalStateField: (field: string, value: unknown) => {
      const newState = { ...(localState || {}), [field]: value };
      awareness.setLocalState(newState);
    },
    getStates: () => states,
    setClientState: (clientId: number, state: Record<string, unknown>) => {
      const prevState = states.get(clientId);
      states.set(clientId, state);
      eventEmitter.emit('change', {
        added: prevState ? [] : [clientId],
        updated: prevState ? [clientId] : [],
        removed: []
      });
    },
    removeClientState: (clientId: number) => {
      const had = states.has(clientId);
      states.delete(clientId);
      if (had) {
        eventEmitter.emit('change', {
          added: [],
          updated: [],
          removed: [clientId]
        });
      }
    },
    on: (eventName: string, callback: EventCallback) => {
      eventEmitter.on(eventName, callback);
      return () => eventEmitter.off(eventName, callback);
    },
    off: (eventName: string, callback: EventCallback) => {
      eventEmitter.off(eventName, callback);
    },
    destroy: () => {
      states.clear();
      localState = null;
      eventEmitter.removeAllListeners();
    },
    doc
  };
  
  return awareness;
}

/**
 * Creates a mock Yjs update
 */
export function mockUpdate(): Uint8Array {
  // Simple fake update data
  return new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
}

/**
 * Creates a mock transaction event
 */
export function mockTransactionEvent(doc: ReturnType<typeof mockDoc>): YjsTransactionEvent {
  return {
    currentTarget: doc,
    target: doc,
    transaction: {
      origin: 'test',
      local: true,
      changesets: [],
      changed: new Map(),
      deleteSet: { clients: new Map() }
    }
  };
}

/**
 * Creates a mock awareness event
 */
export function mockAwarenessEvent(awareness: ReturnType<typeof mockAwareness>): YjsAwarenessEvent {
  return {
    currentTarget: awareness,
    added: [],
    updated: [awareness.doc.clientID],
    removed: []
  };
}

/**
 * Mock sync step 1 message
 */
export function mockSyncStep1(): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // Message type: sync
  encoding.writeVarUint8Array(encoder, new Uint8Array([1, 2, 3])); // State vector
  return encoding.toUint8Array(encoder);
}

/**
 * Mock sync step 2 message
 */
export function mockSyncStep2(): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 1); // Message type: sync
  encoding.writeVarUint8Array(encoder, new Uint8Array([4, 5, 6])); // Update data
  return encoding.toUint8Array(encoder);
}

/**
 * Mock YJS Provider interface
 */
export interface MockYjsProvider {
  awareness: ReturnType<typeof mockAwareness>;
  doc: ReturnType<typeof mockDoc>;
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
  on: (eventName: string, callback: EventCallback) => void;
  off: (eventName: string, callback: EventCallback) => void;
  emit: (eventName: string, args?: unknown[]) => void;
}

/**
 * Creates a mock WebSocket provider
 */
export function createMockYjsProvider(): MockYjsProvider {
  const doc = mockDoc();
  const awareness = mockAwareness(doc);
  const eventEmitter = new EventEmitter();
  let connected = false;
  
  return {
    doc,
    awareness,
    connect: () => {
      connected = true;
      eventEmitter.emit('connect', []);
      eventEmitter.emit('status', [{ status: 'connected' }]);
    },
    disconnect: () => {
      connected = false;
      eventEmitter.emit('disconnect', [{ reason: 'user-initiated' }]);
      eventEmitter.emit('status', [{ status: 'disconnected' }]);
    },
    isConnected: () => connected,
    on: (eventName: string, callback: EventCallback) => {
      eventEmitter.on(eventName, callback);
    },
    off: (eventName: string, callback: EventCallback) => {
      eventEmitter.off(eventName, callback);
    },
    emit: (eventName: string, args: unknown[] = []) => {
      eventEmitter.emit(eventName, ...args);
    }
  };
} 