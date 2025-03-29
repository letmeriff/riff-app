# Yjs Testing Strategy

This document outlines the specialized testing approach for the Yjs-based collaboration features of the Riff application.

## Yjs Overview

Yjs is a CRDT framework that enables real-time collaboration with automatic conflict resolution. Testing Yjs integration requires specialized approaches to verify:

1. **Document Synchronization**: Data consistency across clients
2. **Conflict Resolution**: Handling concurrent edits correctly
3. **Offline Support**: Operation during disconnection and resynchronization
4. **Awareness Protocol**: User presence and cursor sharing

## Testing Infrastructure

### Yjs Test Harness

Create a specialized test harness for Yjs:

```typescript
// src/test-utils/yjsTestHarness.ts
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { waitFor } from '@testing-library/react';

interface YjsClient {
  doc: Y.Doc;
  provider: WebsocketProvider;
  disconnect: () => void;
  connect: () => void;
  getNodes: () => Map<string, any>;
  getNode: (id: string) => any;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  createNode: (data: any) => string;
  deleteNode: (id: string) => void;
}

export const createYjsTestHarness = () => {
  const clients: YjsClient[] = [];

  const createClient = (userId: string): YjsClient => {
    // Create Yjs document
    const doc = new Y.Doc();
    doc.clientID = parseInt(userId, 16) || Math.floor(Math.random() * 1000000);

    // Create WebSocket provider
    const provider = new WebsocketProvider(
      'ws://localhost:1234',
      'test-doc',
      doc,
      { params: { token: `test-token-${userId}` } }
    );

    // Create client interface
    const client: YjsClient = {
      doc,
      provider,

      disconnect() {
        provider.disconnect();
      },

      connect() {
        provider.connect();
      },

      getNodes() {
        return doc.getMap('nodes');
      },

      getNode(id: string) {
        return doc.getMap('nodes').get(id);
      },

      updateNodePosition(id: string, position: { x: number; y: number }) {
        const node = this.getNode(id);
        if (node) {
          node.position = position;
          doc.getMap('nodes').set(id, { ...node });
        }
      },

      createNode(data: any) {
        const id = `node-${Math.random().toString(36).substring(2, 9)}`;
        doc.getMap('nodes').set(id, {
          id,
          ...data,
          createdBy: userId,
        });
        return id;
      },

      deleteNode(id: string) {
        doc.getMap('nodes').delete(id);
      },
    };

    clients.push(client);
    return client;
  };

  const cleanup = () => {
    // Disconnect all clients
    clients.forEach((client) => {
      client.disconnect();
      client.doc.destroy();
    });
    clients.length = 0;
  };

  const waitForSync = async (timeout = 1000) => {
    // Wait for synchronization to complete
    await new Promise((resolve) => setTimeout(resolve, timeout));
  };

  return {
    createClient,
    cleanup,
    waitForSync,
  };
};
```

### Mock WebSocket Provider

Create a mock version of the WebSocket provider for unit tests:

```typescript
// src/test-utils/mockYjsProvider.ts
import * as Y from 'yjs';

export class MockWebsocketProvider {
  public awareness: {
    setLocalState: jest.Mock;
    getLocalState: jest.Mock;
    getStates: jest.Mock;
    on: jest.Mock;
    off: jest.Mock;
  };

  public on: jest.Mock;
  public off: jest.Mock;
  public connect: jest.Mock;
  public disconnect: jest.Mock;
  public wsconnected: boolean;

  constructor() {
    this.awareness = {
      setLocalState: jest.fn(),
      getLocalState: jest.fn().mockReturnValue({}),
      getStates: jest.fn().mockReturnValue(new Map()),
      on: jest.fn(),
      off: jest.fn(),
    };

    this.on = jest.fn();
    this.off = jest.fn();
    this.connect = jest.fn();
    this.disconnect = jest.fn();
    this.wsconnected = true;
  }

  // Simulate connection changes
  simulateConnect() {
    this.wsconnected = true;
    this.on.mock.calls
      .filter(([event]) => event === 'status')
      .forEach(([, callback]) => {
        callback({ status: 'connected' });
      });
  }

  simulateDisconnect() {
    this.wsconnected = false;
    this.on.mock.calls
      .filter(([event]) => event === 'status')
      .forEach(([, callback]) => {
        callback({ status: 'disconnected' });
      });
  }

  // Simulate awareness updates
  simulateAwarenessUpdate(states: Map<number, any>) {
    this.awareness.getStates.mockReturnValue(states);
    this.awareness.on.mock.calls
      .filter(([event]) => event === 'change')
      .forEach(([, callback]) => {
        callback({
          added: [],
          updated: Array.from(states.keys()),
          removed: [],
        });
      });
  }
}
```

## Testing Approaches

### Unit Testing Yjs Services

Test Yjs service integration with focus on:

- Document structure manipulation
- State updates and notifications
- Error handling

Example:

```typescript
// src/services/yjsService.test.ts
import * as Y from 'yjs';
import { YjsService } from './yjsService';
import { MockWebsocketProvider } from '../test-utils/mockYjsProvider';

describe('YjsService', () => {
  let yjsService: YjsService;
  let mockDoc: Y.Doc;
  let mockProvider: MockWebsocketProvider;

  beforeEach(() => {
    mockDoc = new Y.Doc();
    mockProvider = new MockWebsocketProvider();
    yjsService = new YjsService();
    yjsService.initialize(mockDoc, mockProvider as any, 'test-doc');
  });

  afterEach(() => {
    yjsService.destroy();
    mockDoc.destroy();
  });

  it('should create a node in the Yjs document', () => {
    const nodeData = {
      id: 'node1',
      position: { x: 100, y: 100 },
      data: { content: 'Test Node' },
    };

    yjsService.createNode(nodeData);

    // Get the node from the Yjs document
    const nodesMap = mockDoc.getMap('nodes');
    const node = nodesMap.get('node1');

    expect(node).toMatchObject(nodeData);
  });

  it('should update a node position', () => {
    // Create a node first
    const nodeData = {
      id: 'node1',
      position: { x: 100, y: 100 },
      data: { content: 'Test Node' },
    };
    yjsService.createNode(nodeData);

    // Update position
    const newPosition = { x: 200, y: 200 };
    yjsService.updateNodePosition('node1', newPosition);

    // Get the updated node
    const nodesMap = mockDoc.getMap('nodes');
    const node = nodesMap.get('node1');

    expect(node.position).toEqual(newPosition);
  });

  it('should notify about node changes', () => {
    const onChangeSpy = jest.fn();
    yjsService.onNodeChange('node1', onChangeSpy);

    // Create a node
    const nodeData = {
      id: 'node1',
      position: { x: 100, y: 100 },
      data: { content: 'Test Node' },
    };
    yjsService.createNode(nodeData);

    expect(onChangeSpy).toHaveBeenCalledWith(nodeData);
  });

  it('should handle connection status changes', () => {
    const onStatusChangeSpy = jest.fn();
    yjsService.onConnectionStatusChange(onStatusChangeSpy);

    // Simulate disconnect
    mockProvider.simulateDisconnect();

    expect(onStatusChangeSpy).toHaveBeenCalledWith({ status: 'disconnected' });

    // Simulate reconnect
    mockProvider.simulateConnect();

    expect(onStatusChangeSpy).toHaveBeenCalledWith({ status: 'connected' });
  });

  it('should handle awareness updates', () => {
    const onAwarenessUpdateSpy = jest.fn();
    yjsService.onAwarenessUpdate(onAwarenessUpdateSpy);

    // Simulate awareness update
    const states = new Map([
      [
        1,
        { user: { id: 'user1', name: 'User 1' }, cursor: { x: 100, y: 100 } },
      ],
    ]);
    mockProvider.simulateAwarenessUpdate(states);

    expect(onAwarenessUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        users: [{ id: 'user1', name: 'User 1', cursor: { x: 100, y: 100 } }],
      })
    );
  });
});
```

### Integration Testing Yjs Synchronization

Test document synchronization across multiple clients:

```typescript
// src/services/yjsSync.test.ts
import { createYjsTestHarness } from '../test-utils/yjsTestHarness';

describe('Yjs Synchronization', () => {
  const testHarness = createYjsTestHarness();

  afterEach(() => {
    testHarness.cleanup();
  });

  it('should synchronize node creation between clients', async () => {
    // Create two clients
    const client1 = testHarness.createClient('user1');
    const client2 = testHarness.createClient('user2');

    // Create a node on client1
    const nodeId = client1.createNode({
      data: { content: 'Test Node' },
      position: { x: 100, y: 100 },
    });

    // Wait for synchronization
    await testHarness.waitForSync();

    // Check if node exists on client2
    const node = client2.getNode(nodeId);

    expect(node).toBeDefined();
    expect(node.data.content).toBe('Test Node');
    expect(node.position).toEqual({ x: 100, y: 100 });
  });

  it('should handle concurrent edits correctly', async () => {
    // Create two clients
    const client1 = testHarness.createClient('user1');
    const client2 = testHarness.createClient('user2');

    // Create a node on client1
    const nodeId = client1.createNode({
      data: { content: 'Original Content' },
      position: { x: 100, y: 100 },
    });

    // Wait for synchronization
    await testHarness.waitForSync();

    // Concurrent updates
    client1.updateNodePosition(nodeId, { x: 200, y: 100 });
    client2.updateNodePosition(nodeId, { x: 100, y: 200 });

    // Wait for synchronization
    await testHarness.waitForSync();

    // Both clients should converge to the same state
    const node1 = client1.getNode(nodeId);
    const node2 = client2.getNode(nodeId);

    expect(node1.position).toEqual(node2.position);
  });

  it('should handle offline edits and resynchronization', async () => {
    // Create two clients
    const client1 = testHarness.createClient('user1');
    const client2 = testHarness.createClient('user2');

    // Create initial node
    const nodeId = client1.createNode({
      data: { content: 'Initial Content' },
      position: { x: 100, y: 100 },
    });

    // Wait for synchronization
    await testHarness.waitForSync();

    // Disconnect client2
    client2.disconnect();

    // Client1 makes changes while client2 is offline
    client1.updateNodePosition(nodeId, { x: 200, y: 200 });

    // Client2 makes offline changes
    client2.updateNodePosition(nodeId, { x: 300, y: 300 });

    // Reconnect client2
    client2.connect();

    // Wait for synchronization
    await testHarness.waitForSync(2000);

    // Both clients should converge to the same state
    const node1 = client1.getNode(nodeId);
    const node2 = client2.getNode(nodeId);

    expect(node1.position).toEqual(node2.position);
  });
});
```

### Component Testing with Yjs

Test React components that integrate with Yjs:

```typescript
// src/components/YjsAwareCanvas.test.tsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YjsContext } from '../contexts/YjsContext';
import { YjsAwareCanvas } from './YjsAwareCanvas';

describe('YjsAwareCanvas', () => {
  const mockYjsService = {
    initialize: jest.fn(),
    destroy: jest.fn(),
    getNodes: jest.fn(),
    createNode: jest.fn(),
    updateNodePosition: jest.fn(),
    deleteNode: jest.fn(),
    onNodeChange: jest.fn(),
    onAwarenessUpdate: jest.fn(),
    onConnectionStatusChange: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    getAwarenessUsers: jest.fn().mockReturnValue([]),
  };

  beforeEach(() => {
    mockYjsService.getNodes.mockReturnValue([
      { id: 'node1', position: { x: 100, y: 100 }, data: { content: 'Node 1' } },
    ]);
  });

  it('renders nodes from Yjs document', () => {
    render(
      <YjsContext.Provider value={mockYjsService}>
        <YjsAwareCanvas />
      </YjsContext.Provider>
    );

    expect(screen.getByText('Node 1')).toBeInTheDocument();
  });

  it('updates node position in Yjs document when dragged', async () => {
    const user = userEvent.setup();

    render(
      <YjsContext.Provider value={mockYjsService}>
        <YjsAwareCanvas />
      </YjsContext.Provider>
    );

    const node = screen.getByTestId('node-node1');

    // Simulate drag
    await act(async () => {
      await user.pointer([
        { target: node, keys: '[MouseLeft>]', coords: { clientX: 100, clientY: 100 } },
        { coords: { clientX: 150, clientY: 150 } },
        { keys: '[/MouseLeft]' },
      ]);
    });

    expect(mockYjsService.updateNodePosition).toHaveBeenCalledWith(
      'node1',
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
  });

  it('shows awareness cursors of other users', () => {
    mockYjsService.getAwarenessUsers.mockReturnValue([
      { id: 'user1', name: 'User 1', cursor: { x: 100, y: 100 } },
    ]);

    render(
      <YjsContext.Provider value={mockYjsService}>
        <YjsAwareCanvas />
      </YjsContext.Provider>
    );

    expect(screen.getByTestId('cursor-user1')).toBeInTheDocument();
  });

  it('shows offline indicator when disconnected', () => {
    mockYjsService.isConnected.mockReturnValue(false);

    render(
      <YjsContext.Provider value={mockYjsService}>
        <YjsAwareCanvas />
      </YjsContext.Provider>
    );

    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
  });
});
```

## Testing Offline Support

To test offline capabilities specifically:

```typescript
// src/features/offline/offlineSupport.test.ts
import { createYjsTestHarness } from '../../test-utils/yjsTestHarness';
import { IndexeddbPersistence } from 'y-indexeddb';

// Mock IndexedDB for testing offline persistence
jest.mock('y-indexeddb', () => {
  return {
    IndexeddbPersistence: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      off: jest.fn(),
      destroy: jest.fn(),
      whenSynced: Promise.resolve(),
    })),
  };
});

describe('Offline Support', () => {
  const testHarness = createYjsTestHarness();

  afterEach(() => {
    testHarness.cleanup();
    IndexeddbPersistence.mockClear();
  });

  it('should initialize IndexeddbPersistence for offline support', async () => {
    // Create a client with offline support
    const client = testHarness.createClient('user1');

    // Check if IndexeddbPersistence was initialized
    expect(IndexeddbPersistence).toHaveBeenCalledWith(
      'test-doc',
      expect.any(Object) // Y.Doc instance
    );
  });

  it('should save state during online session', async () => {
    const client = testHarness.createClient('user1');

    // Create a node
    const nodeId = client.createNode({
      data: { content: 'Offline Test' },
      position: { x: 100, y: 100 },
    });

    // Simulate IndexedDB sync
    const mockPersistence = IndexeddbPersistence.mock.results[0].value;
    const syncSpy = jest.fn();
    mockPersistence.on.mock.calls
      .filter(([event]) => event === 'synced')
      .forEach(([, callback]) => {
        syncSpy();
        callback();
      });

    // Verify IndexedDB was synced
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(syncSpy).toHaveBeenCalled();
  });

  it('should work with programmatic connection/disconnection', async () => {
    const client = testHarness.createClient('user1');

    // Create initial state
    const nodeId = client.createNode({
      data: { content: 'Before Offline' },
      position: { x: 100, y: 100 },
    });

    // Disconnect client
    client.disconnect();

    // Make offline changes
    client.updateNodePosition(nodeId, { x: 200, y: 200 });

    // Reconnect client
    client.connect();

    // Wait for sync
    await testHarness.waitForSync();

    // Verify node has updated position
    const node = client.getNode(nodeId);
    expect(node.position).toEqual({ x: 200, y: 200 });
  });
});
```

## Testing Awareness Protocol

To test user awareness features:

```typescript
// src/features/awareness/awarenessProtocol.test.ts
import { createYjsTestHarness } from '../../test-utils/yjsTestHarness';

describe('Awareness Protocol', () => {
  const testHarness = createYjsTestHarness();

  afterEach(() => {
    testHarness.cleanup();
  });

  it('should share user information between clients', async () => {
    // Create two clients
    const client1 = testHarness.createClient('user1');
    const client2 = testHarness.createClient('user2');

    // Set user information on client1
    client1.provider.awareness.setLocalState({
      user: { id: 'user1', name: 'User 1' },
      cursor: { x: 100, y: 100 },
    });

    // Wait for synchronization
    await testHarness.waitForSync();

    // Get awareness states from client2
    const states = client2.provider.awareness.getStates();

    // Find user1's state on client2
    const user1State = Array.from(states.values()).find(
      (state) => state.user?.id === 'user1'
    );

    expect(user1State).toBeDefined();
    expect(user1State.user.name).toBe('User 1');
    expect(user1State.cursor).toEqual({ x: 100, y: 100 });
  });

  it('should remove user state when client disconnects', async () => {
    // Create two clients
    const client1 = testHarness.createClient('user1');
    const client2 = testHarness.createClient('user2');

    // Set user information on both clients
    client1.provider.awareness.setLocalState({
      user: { id: 'user1', name: 'User 1' },
    });

    client2.provider.awareness.setLocalState({
      user: { id: 'user2', name: 'User 2' },
    });

    // Wait for synchronization
    await testHarness.waitForSync();

    // Verify both clients are aware of each other
    let states = client1.provider.awareness.getStates();
    expect(states.size).toBe(2);

    // Disconnect client2
    client2.disconnect();

    // Wait for cleanup
    await testHarness.waitForSync(2000);

    // Verify client1 no longer sees client2
    states = client1.provider.awareness.getStates();
    expect(states.size).toBe(1);
    expect(Array.from(states.values())[0].user.id).toBe('user1');
  });

  it('should track cursor positions', async () => {
    // Create two clients
    const client1 = testHarness.createClient('user1');
    const client2 = testHarness.createClient('user2');

    // Set cursor position on client1
    client1.provider.awareness.setLocalState({
      user: { id: 'user1', name: 'User 1' },
      cursor: { x: 100, y: 100 },
    });

    // Wait for synchronization
    await testHarness.waitForSync();

    // Update cursor position
    client1.provider.awareness.setLocalState({
      user: { id: 'user1', name: 'User 1' },
      cursor: { x: 200, y: 200 },
    });

    // Wait for synchronization
    await testHarness.waitForSync();

    // Get awareness states from client2
    const states = client2.provider.awareness.getStates();
    const user1State = Array.from(states.values()).find(
      (state) => state.user?.id === 'user1'
    );

    expect(user1State.cursor).toEqual({ x: 200, y: 200 });
  });
});
```

## End-to-End Testing

For complete Yjs collaboration flows:

```typescript
// e2e/yjs-collaboration.spec.ts
import { test, expect, Page } from '@playwright/test';

test.describe('Yjs Collaboration', () => {
  let page1: Page;
  let page2: Page;

  test.beforeAll(async ({ browser }) => {
    // Create two browser contexts for two users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Log in both users
    await loginUser(page1, 'user1@example.com', 'password1');
    await loginUser(page2, 'user2@example.com', 'password2');
  });

  test.afterAll(async () => {
    await page1.close();
    await page2.close();
  });

  test('two users can collaborate on the same canvas', async () => {
    // User 1 creates a new canvas
    await page1.goto('/canvas/new');

    // Get the canvas URL and open it in user 2's browser
    const canvasUrl = page1.url();
    await page2.goto(canvasUrl);

    // User 1 adds a node
    await page1.click('[data-testid="add-node-button"]');
    await page1.click('[data-testid="canvas"]');

    // Type message in the node
    await page1.fill('[data-testid="chat-input"]', 'Hello from User 1');
    await page1.press('[data-testid="chat-input"]', 'Enter');

    // Wait for synchronization
    await page2.waitForSelector('text=Hello from User 1');

    // User 2 adds a node
    await page2.click('[data-testid="add-node-button"]');
    await page2.click('[data-testid="canvas"]', {
      position: { x: 300, y: 300 },
    });

    // Type message in the node
    await page2.fill('[data-testid="chat-input"]', 'Hello from User 2');
    await page2.press('[data-testid="chat-input"]', 'Enter');

    // User 1 should see User 2's node
    await page1.waitForSelector('text=Hello from User 2');

    // User 1 should see User 2's cursor when they move the mouse
    await page2.mouse.move(150, 150);
    await page1.waitForSelector('[data-testid="cursor-user2"]');
  });

  test('offline changes sync when coming back online', async () => {
    // Both users open the same canvas
    await page1.goto('/canvas/new');
    const canvasUrl = page1.url();
    await page2.goto(canvasUrl);

    // User 1 adds a node
    await page1.click('[data-testid="add-node-button"]');
    await page1.click('[data-testid="canvas"]');
    await page1.fill('[data-testid="chat-input"]', 'Initial message');
    await page1.press('[data-testid="chat-input"]', 'Enter');

    // Wait for User 2 to receive the node
    await page2.waitForSelector('text=Initial message');

    // Disconnect User 2 from the network
    await page2.context().setOffline(true);

    // User 2 adds a message while offline
    await page2.fill('[data-testid="chat-input"]', 'Offline message');
    await page2.press('[data-testid="chat-input"]', 'Enter');

    // User 1 adds another message
    await page1.fill('[data-testid="chat-input"]', 'Online message');
    await page1.press('[data-testid="chat-input"]', 'Enter');

    // Reconnect User 2
    await page2.context().setOffline(false);

    // Wait for synchronization
    await page2.waitForSelector('text=Online message');
    await page1.waitForSelector('text=Offline message');
  });
});

async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForNavigation();
}
```

By following this specialized Yjs testing strategy, we ensure the reliability and correctness of the real-time collaboration features in the Riff application.
