# Riff Testing Patterns and Conventions

This document outlines the standard patterns and conventions for writing tests in the Riff application, with a particular focus on handling complex dependencies like Yjs and Supabase.

## Table of Contents

1. [General Testing Principles](#general-testing-principles)
2. [Test Structure](#test-structure)
3. [Mocking Dependencies](#mocking-dependencies)
4. [Mocking Supabase](#mocking-supabase)
5. [Mocking Yjs](#mocking-yjs)
6. [Testing WebSockets](#testing-websockets)
7. [Test Data Management](#test-data-management)
8. [Testing Async Code](#testing-async-code)

## General Testing Principles

We follow these core principles for all tests:

- **Isolation**: Tests should be independent and not rely on the state of other tests
- **Deterministic**: Tests should always produce the same result when run multiple times
- **Fast**: Tests should execute quickly
- **Focused**: Each test should focus on one aspect of functionality
- **Readable**: Tests should be easy to understand and maintain

## Test Structure

We use the Arrange-Act-Assert (AAA) pattern for structuring our tests:

```typescript
it('should do something specific', async () => {
  // Arrange - set up test data and conditions
  const input = { /* test data */ };
  const mockDependency = jest.fn();
  
  // Act - execute the code being tested
  const result = await functionUnderTest(input);
  
  // Assert - verify the result is as expected
  expect(result).toEqual(/* expected output */);
  expect(mockDependency).toHaveBeenCalledTimes(1);
});
```

## Mocking Dependencies

For consistent testing, we follow these patterns for mocking dependencies:

1. **Use jest.mock at the top of the file** - Mock entire modules near imports
2. **Reset mocks in beforeEach** - Use `jest.clearAllMocks()` to ensure test isolation
3. **Use jest.spyOn for specific methods** - When you need to mock only specific methods
4. **Prefer mock implementations over return values** - They give more control
5. **Restore mocks in afterEach when using spies** - Clean up to prevent test pollution

## Mocking Supabase

Supabase requires special mocking due to its method chaining pattern:

```typescript
// Example mocking Supabase client with chaining support
jest.mock('../config/supabase', () => {
  // Create a query builder that supports method chaining
  const createMockQueryBuilder = () => {
    const mock = {
      select: jest.fn(() => mock),
      insert: jest.fn(() => mock),
      update: jest.fn(() => mock),
      delete: jest.fn(() => mock),
      eq: jest.fn(() => mock),
      gt: jest.fn(() => mock),
      lt: jest.fn(() => mock),
      order: jest.fn(() => mock),
      single: jest.fn(() => mock),
      mockResolvedValue: jest.fn((val) => {
        mock.resolvedValue = val;
        return mock;
      }),
      then: jest.fn((callback) => {
        return Promise.resolve(callback(mock.resolvedValue));
      })
    };
    return mock;
  };

  return {
    supabase: {
      from: jest.fn(() => createMockQueryBuilder())
    }
  };
});

// Using the mock in tests
(supabase.from as jest.Mock)().select().eq().single.mockResolvedValue({
  data: mockData,
  error: null,
});
```

### Authentication Mocking

For authentication, mock the Supabase auth API:

```typescript
jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockImplementation(token => {
        if (token === 'valid-token') {
          return Promise.resolve({
            data: { user: { id: 'user1' } },
            error: null
          });
        } else {
          return Promise.resolve({
            data: { user: null },
            error: { message: 'Invalid token' }
          });
        }
      })
    },
  }
}));
```

## Mocking Yjs

Yjs is complex to mock due to its interdependent modules and callback-based architecture. Here are patterns we use:

### Basic Yjs Doc Mocking

```typescript
// Define interface for mockDoc to fix type issues
interface MockYDoc {
  on: jest.Mock;
  off: jest.Mock;
  transact: jest.Mock;
  clientID: number;
  destroy: jest.Mock;
  getMap: jest.Mock;
  getArray: jest.Mock;
  getText: jest.Mock;
  callbacks?: Record<string, (update: Uint8Array, origin: string) => void>;
  simulateUpdateEvent?: (update: Uint8Array, origin: string) => void;
}

// Mock Yjs document with improved implementation
jest.mock('yjs', () => {
  const mockDoc: MockYDoc = {
    on: jest.fn((eventName, callback) => {
      // Store callback reference for testing
      if (!mockDoc.callbacks) {
        mockDoc.callbacks = {};
      }
      mockDoc.callbacks[eventName] = callback;
    }),
    off: jest.fn(),
    transact: jest.fn((fn) => fn()),
    clientID: 1,
    destroy: jest.fn(),
    getMap: jest.fn(() => ({
      set: jest.fn(),
      get: jest.fn(),
      observe: jest.fn(),
      toJSON: jest.fn().mockReturnValue({ key: 'value' }),
    })),
    getArray: jest.fn(() => ({
      toArray: jest.fn().mockReturnValue([]),
      insert: jest.fn(),
      observe: jest.fn(),
      toJSON: jest.fn().mockReturnValue([]),
    })),
    getText: jest.fn(() => ({
      toString: jest.fn().mockReturnValue(''),
      insert: jest.fn(),
      delete: jest.fn(),
      observe: jest.fn(),
    })),
  };
  
  // Add the simulateUpdateEvent method for triggering callbacks
  mockDoc.simulateUpdateEvent = (update, origin) => {
    if (mockDoc.callbacks && mockDoc.callbacks.update) {
      mockDoc.callbacks.update(update, origin);
    }
  };
  
  return {
    Doc: jest.fn(() => mockDoc),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
  };
});
```

### Simulating Document Updates

To test document update events:

```typescript
// Get the Y.Doc instance
const YDoc = Y.Doc as jest.Mock;
const mockDoc = YDoc.mock.results[0].value as MockYDoc;

// Simulate a document update
const update = new Uint8Array([5, 6, 7]);
mockDoc.simulateUpdateEvent(update, 'client');

// Assert expected behavior
expect(mockCallback).toHaveBeenCalled();
```

### Mocking Y-protocols

For awareness and sync protocols:

```typescript
// Awareness protocol mock
jest.mock('y-protocols/awareness', () => {
  const mockAwareness = {
    on: jest.fn(),
    setLocalState: jest.fn(),
    getStates: jest.fn(() => new Map([[1, { user: { id: 'user1' } }]])),
    destroy: jest.fn(),
    setLocalStateField: jest.fn(),
    getLocalState: jest.fn(() => ({ user: { id: 'user1' } })),
  };

  return {
    Awareness: jest.fn(() => mockAwareness),
    encodeAwarenessUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
    applyAwarenessUpdate: jest.fn(_awareness => {
      // Simulate applying awareness update
      mockAwareness.getStates().set(2, { user: { id: 'user2' } });
    }),
    removeAwarenessStates: jest.fn((_awareness, clients) => {
      // Simulate removing awareness states
      const states = mockAwareness.getStates();
      for (const client of clients) {
        states.delete(client);
      }
    }),
  };
});

// Sync protocol mock
jest.mock('y-protocols/sync', () => {
  return {
    writeUpdate: jest.fn((encoder, _doc, update) => {
      // Simulate writing update message
      encoding.writeVarUint(encoder, 1);
      encoding.writeUint8Array(encoder, update);
    }),
    writeSyncStep1: jest.fn(),
    writeSyncStep2: jest.fn(),
    readSyncMessage: jest.fn(),
    readSyncStep1: jest.fn(),
    readSyncStep2: jest.fn(),
  };
});
```

## Testing WebSockets

For WebSocket testing, mock the ws library:

```typescript
jest.mock('ws', () => {
  const mockWebSocket = {
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // WebSocket.OPEN
  };
  
  const mockServer = {
    on: jest.fn(),
    handleUpgrade: jest.fn(),
    close: jest.fn((callback) => callback && callback()),
    clients: new Set([mockWebSocket]),
  };
  
  return {
    WebSocket: jest.fn(() => mockWebSocket),
    WebSocketServer: jest.fn(() => mockServer),
    OPEN: 1,
  };
});
```

Handle connection events and message passing:

```typescript
// Extract connection handler
const connectionHandler = mockServer.on.mock.calls[0][1];

// Call connection handler
await connectionHandler(mockWebSocket, req);

// Get message handler
const messageHandler = mockWebSocket.on.mock.calls.find(
  call => call[0] === 'message'
)?.[1];

// Simulate receiving a message
await messageHandler({ data: new Uint8Array([0, 1, 2, 3]) });

// Assertions
expect(mockWebSocket.send).toHaveBeenCalled();
```

## Test Data Management

Use factories and fixtures for consistent test data:

```typescript
// User factory example
const createTestUser = (overrides = {}) => ({
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides
});

// Canvas factory example
const createTestCanvas = (overrides = {}) => ({
  id: 'test-canvas-1',
  name: 'Test Canvas',
  createdBy: 'test-user-1',
  nodes: [],
  edges: [],
  ...overrides
});
```

## Testing Async Code

Always use async/await for asynchronous tests:

```typescript
it('should load data asynchronously', async () => {
  // Arrange
  const mockData = { id: '123', name: 'Test' };
  jest.spyOn(api, 'fetchData').mockResolvedValue(mockData);
  
  // Act
  const result = await service.loadData();
  
  // Assert
  expect(result).toEqual(mockData);
});
```

For timers and intervals, use Jest's timer mocks:

```typescript
jest.useFakeTimers();

it('should update after interval', () => {
  // Start something with setInterval
  startPeriodicUpdate();
  
  // Fast-forward time
  jest.advanceTimersByTime(5000);
  
  // Assert expected behavior
  expect(updateFn).toHaveBeenCalledTimes(5);
  
  // Clean up
  jest.useRealTimers();
});
``` 