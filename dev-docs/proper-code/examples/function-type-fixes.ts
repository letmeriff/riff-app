/**
 * Function Type Fixes Examples
 * 
 * This file demonstrates how to fix ESLint issues related to the use of the 'Function' type
 * by providing proper function signatures.
 */

import { YDoc, YEvent, YTransaction } from './common-types';

// ==============================
// Problem: Using 'Function' type
// ==============================

// ❌ Bad: Using 'Function' type
interface _BadEventEmitter {
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): boolean;
}

// ❌ Bad: Using 'Function' in test utilities
function _createMockObserver(callback: () => void) {
  return {
    observe: () => callback(),
    disconnect: () => {},
  };
}

// ❌ Bad: Function type in event handlers
interface _BadComponentProps {
  onClick: (event: unknown) => void;
  onChange: (value: unknown) => void;
  onSubmit: (data: unknown) => void;
}

// ==============================
// Solution: Using proper function signatures
// ==============================

// ✅ Good: Using proper function signature for event emitter
interface _GoodEventEmitter {
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): boolean;
}

// ✅ Better: Using typed event emitter with specific event types
interface TypedEventEmitter<Events extends Record<string, unknown[]>> {
  on<E extends keyof Events>(event: E, callback: (...args: Events[E]) => void): void;
  off<E extends keyof Events>(event: E, callback: (...args: Events[E]) => void): void;
  emit<E extends keyof Events>(event: E, ...args: Events[E]): boolean;
}

// Example usage of typed event emitter
interface DocumentEvents extends Record<string, unknown[]> {
  'change': [YEvent, YTransaction];
  'update': [string, unknown];
  'destroy': [];
}

const typedEmitter: TypedEventEmitter<DocumentEvents> = {
  on(_event, _callback) { return this; },
  off(_event, _callback) { return this; },
  emit(_event, ..._args) { return true; }
};

// Type-safe event subscription
typedEmitter.on('change', (event, transaction) => {
  // event and transaction are properly typed
  console.log(event.path, transaction.local);
});

// ✅ Good: Using proper function signature for test utilities
function _createBetterMockObserver(callback: () => void) {
  return {
    observe: () => callback(),
    disconnect: () => {},
  };
}

// ✅ Better: Using typed callback for test utilities with parameters
function _createTypedMockObserver<T>(callback: (data: T) => void) {
  return {
    observe: (target: T) => callback(target),
    disconnect: () => {},
  };
}

// ✅ Good: Using proper function signatures in component props
interface _GoodComponentProps {
  onClick: (event: React.MouseEvent) => void;
  onChange: (value: string) => void;
  onSubmit: (data: unknown) => Promise<void>;
}

// ==============================
// Solution: For event callbacks with specific parameters
// ==============================

// ✅ Good: Properly typed callback for specific events
type YEventCallback = (event: YEvent, transaction: YTransaction) => void;

interface _YDocEvents {
  on(eventName: string, callback: YEventCallback): void;
  off(eventName: string, callback: YEventCallback): void;
}

// ✅ Good: Generic callback type for reuse
type _EventCallback<TEvent> = (event: TEvent) => void;
type _DataCallback<TData> = (data: TData) => void;

// ✅ Good: Callbacks with optional parameters
type _OptionalCallback<T> = (data?: T) => void;

// ==============================
// Additional patterns for complex scenarios
// ==============================

// For callbacks that might receive different argument combinations
type _ComplexCallback = 
  | (() => void)
  | ((id: string) => void)
  | ((id: string, data: unknown) => void);

// For event handlers that need access to event and data
interface _EventHandler<TEvent, TData> {
  (event: TEvent, data?: TData): void;
}

// For callbacks with context
type _ContextCallback<TContext, TResult> = 
  (this: TContext, ...args: unknown[]) => TResult;

// For callbacks that can return different types
type _ReturnCallback<TData, TResult> = 
  (data: TData) => TResult | Promise<TResult>;

// ==============================
// Solution: Using JSDoc comments for clarity
// ==============================

/**
 * Creates a document observer with typed callback
 * 
 * @param callback Function that will be called when document changes
 * @returns Observer instance
 */
function _createDocumentObserver(
  callback: (doc: YDoc, event?: YEvent) => void
) {
  return {
    observe: (doc: YDoc) => callback(doc),
    disconnect: () => {}
  };
}

// ==============================
// Summary of patterns
// ==============================

/**
 * Pattern 1: Specify parameter types and return type
 * 
 * Change: 
 *   callback: Function
 * To:
 *   callback: (param1: Type1, param2: Type2) => ReturnType
 */

/**
 * Pattern 2: Use generic types for flexible typing
 * 
 * Change:
 *   callback: Function
 * To:
 *   callback: <T>(data: T) => void
 */

/**
 * Pattern 3: Create named callback types for reuse
 * 
 * Change:
 *   Multiple uses of Function
 * To:
 *   type CallbackType = (param: Type) => ReturnType;
 *   // Then use CallbackType instead of Function
 */

/**
 * Pattern 4: Use union types for multiple signatures
 * 
 * Change:
 *   callback: Function
 * To:
 *   callback: (() => void) | ((id: string) => void)
 */

/**
 * Pattern 5: Use typed event emitters
 * 
 * Change:
 *   on(event: string, callback: Function)
 * To:
 *   on<E extends keyof Events>(event: E, callback: (...args: Events[E]) => void)
 */ 