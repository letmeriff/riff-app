# Collaborative Features Testing Strategy

This document outlines the approach for testing the collaborative features of the Riff application.

## Collaborative Features Overview

Riff's collaborative features enable multiple users to work together on a canvas in real-time:

1. **Real-time Editing**: Multiple users can create and edit nodes simultaneously
2. **User Awareness**: Visual indicators show who is editing what and where they are
3. **Conflict Resolution**: Automatic merging of concurrent changes
4. **Offline Support**: Continued work during disconnection with seamless resynchronization
5. **User Presence**: Information about who is currently viewing the canvas

## Multi-User Testing Approach

Testing collaborative features requires simulating multiple users interacting with the system simultaneously.

### Simulated Multi-User Testing

For automated testing with multiple simulated users:

```typescript
// src/test-utils/multiUserTestHarness.ts
import { createYjsTestHarness } from './yjsTestHarness';
import { MockWebsocketProvider } from './mockYjsProvider';

export const createMultiUserTestHarness = () => {
  const yjsHarness = createYjsTestHarness();

  // Create multiple clients with controlled interactions
  const createMultiUserScenario = async (numUsers = 2) => {
    const clients = [];

    // Create specified number of clients
    for (let i = 0; i < numUsers; i++) {
      clients.push(yjsHarness.createClient(`user${i + 1}`));
    }

    // Wait for all clients to connect
    await yjsHarness.waitForSync();

    return {
      clients,
      async cleanup() {
        yjsHarness.cleanup();
      },
      async waitForSync(timeout = 1000) {
        await yjsHarness.waitForSync(timeout);
      },
    };
  };

  return {
    createMultiUserScenario,
  };
};
```

### Manual Multi-Browser Testing

For exploratory testing with real browsers:

1. **Environment Setup**:

   - Launch multiple browsers (Chrome, Firefox, etc.)
   - Log in with different user accounts
   - Open the same canvas URL in each browser

2. **Test Scenarios**:
   - Concurrent node creation and editing
   - Cursor tracking across browsers
   - Network disconnection and reconnection
   - Different device/screen sizes

## Key Collaborative Test Scenarios

### Real-time Synchronization Testing

Test that changes from one user appear for other users in real-time:

```typescript
// src/features/collaboration/realTimeSynchronization.test.ts
import { createMultiUserTestHarness } from '../../test-utils/multiUserTestHarness';

describe('Real-time Synchronization', () => {
  const testHarness = createMultiUserTestHarness();

  it('should propagate node creation to all users', async () => {
    // Set up scenario with 3 users
    const { clients, waitForSync, cleanup } =
      await testHarness.createMultiUserScenario(3);

    try {
      // User 1 creates a node
      const nodeId = clients[0].createNode({
        data: { content: 'Collaborative Test' },
        position: { x: 100, y: 100 },
      });

      // Wait for synchronization
      await waitForSync();

      // Check if other users received the node
      const node1 = clients[1].getNode(nodeId);
      const node2 = clients[2].getNode(nodeId);

      expect(node1).toBeDefined();
      expect(node2).toBeDefined();
      expect(node1.data.content).toBe('Collaborative Test');
      expect(node2.data.content).toBe('Collaborative Test');
    } finally {
      await cleanup();
    }
  });

  it('should propagate node updates to all users', async () => {
    const { clients, waitForSync, cleanup } =
      await testHarness.createMultiUserScenario(3);

    try {
      // User 1 creates a node
      const nodeId = clients[0].createNode({
        data: { content: 'Original Content' },
        position: { x: 100, y: 100 },
      });

      // Wait for synchronization
      await waitForSync();

      // User 2 updates the node
      clients[1].updateNodePosition(nodeId, { x: 200, y: 200 });

      // Wait for synchronization
      await waitForSync();

      // Check if updates reached user 1 and user 3
      const node1 = clients[0].getNode(nodeId);
      const node3 = clients[2].getNode(nodeId);

      expect(node1.position).toEqual({ x: 200, y: 200 });
      expect(node3.position).toEqual({ x: 200, y: 200 });
    } finally {
      await cleanup();
    }
  });
});
```

### User Awareness Testing

Test that users can see indicators of other users' presence and activities:

```typescript
// src/features/collaboration/userAwareness.test.ts
import { createMultiUserTestHarness } from '../../test-utils/multiUserTestHarness';

describe('User Awareness', () => {
  const testHarness = createMultiUserTestHarness();

  it('should show cursor positions of other users', async () => {
    const { clients, waitForSync, cleanup } =
      await testHarness.createMultiUserScenario(2);

    try {
      // Set user 1's cursor position
      clients[0].provider.awareness.setLocalState({
        user: { id: 'user1', name: 'User 1' },
        cursor: { x: 100, y: 100 },
      });

      // Wait for synchronization
      await waitForSync();

      // Check if user 2 can see user 1's cursor
      const awareness = clients[1].provider.awareness;
      const states = awareness.getStates();
      const user1State = Array.from(states.values()).find(
        (state) => state.user?.id === 'user1'
      );

      expect(user1State).toBeDefined();
      expect(user1State.cursor).toEqual({ x: 100, y: 100 });
    } finally {
      await cleanup();
    }
  });

  it('should show which node a user is editing', async () => {
    const { clients, waitForSync, cleanup } =
      await testHarness.createMultiUserScenario(2);

    try {
      // User 1 creates a node
      const nodeId = clients[0].createNode({
        data: { content: 'Awareness Test' },
        position: { x: 100, y: 100 },
      });

      // Wait for synchronization
      await waitForSync();

      // User 1 indicates they are editing the node
      clients[0].provider.awareness.setLocalState({
        user: { id: 'user1', name: 'User 1' },
        editing: { nodeId },
      });

      // Wait for synchronization
      await waitForSync();

      // Check if user 2 can see that user 1 is editing the node
      const awareness = clients[1].provider.awareness;
      const states = awareness.getStates();
      const user1State = Array.from(states.values()).find(
        (state) => state.user?.id === 'user1'
      );

      expect(user1State).toBeDefined();
      expect(user1State.editing.nodeId).toBe(nodeId);
    } finally {
      await cleanup();
    }
  });
});
```

### Conflict Resolution Testing

Test that concurrent edits are resolved correctly:

```typescript
// src/features/collaboration/conflictResolution.test.ts
import { createMultiUserTestHarness } from '../../test-utils/multiUserTestHarness';

describe('Conflict Resolution', () => {
  const testHarness = createMultiUserTestHarness();

  it('should resolve concurrent position updates correctly', async () => {
    const { clients, waitForSync, cleanup } =
      await testHarness.createMultiUserScenario(2);

    try {
      // User 1 creates a node
      const nodeId = clients[0].createNode({
        data: { content: 'Conflict Test' },
        position: { x: 100, y: 100 },
      });

      // Wait for synchronization
      await waitForSync();

      // Simulate concurrent updates by both users
      clients[0].updateNodePosition(nodeId, { x: 200, y: 100 });
      clients[1].updateNodePosition(nodeId, { x: 100, y: 200 });

      // Wait for conflict resolution
      await waitForSync(2000);

      // Check that both clients converge to the same state
      const node1 = clients[0].getNode(nodeId);
      const node2 = clients[1].getNode(nodeId);

      expect(node1.position).toEqual(node2.position);
    } finally {
      await cleanup();
    }
  });

  it('should resolve concurrent content updates correctly', async () => {
    const { clients, waitForSync, cleanup } =
      await testHarness.createMultiUserScenario(2);

    try {
      // User 1 creates a node
      const nodeId = clients[0].createNode({
        data: { content: 'Original Content' },
        position: { x: 100, y: 100 },
      });

      // Wait for synchronization
      await waitForSync();

      // Simulate concurrent content updates
      const nodesMap1 = clients[0].doc.getMap('nodes');
      const node1 = nodesMap1.get(nodeId);
      node1.data.content = 'Updated by User 1';
      nodesMap1.set(nodeId, { ...node1 });

      const nodesMap2 = clients[1].doc.getMap('nodes');
      const node2 = nodesMap2.get(nodeId);
      node2.data.content = 'Updated by User 2';
      nodesMap2.set(nodeId, { ...node2 });

      // Wait for conflict resolution
      await waitForSync(2000);

      // Check that both clients converge to the same state
      const finalNode1 = clients[0].getNode(nodeId);
      const finalNode2 = clients[1].getNode(nodeId);

      expect(finalNode1.data.content).toEqual(finalNode2.data.content);
    } finally {
      await cleanup();
    }
  });
});
```

### Offline Support Testing

Test behavior during network disconnection and reconnection:

```typescript
// src/features/collaboration/offlineSupport.test.ts
import { createMultiUserTestHarness } from '../../test-utils/multiUserTestHarness';

describe('Offline Support', () => {
  const testHarness = createMultiUserTestHarness();

  it('should sync changes after reconnection', async () => {
    const { clients, waitForSync, cleanup } =
      await testHarness.createMultiUserScenario(2);

    try {
      // User 1 creates a node
      const nodeId = clients[0].createNode({
        data: { content: 'Before Offline' },
        position: { x: 100, y: 100 },
      });

      // Wait for synchronization
      await waitForSync();

      // Disconnect user 2
      clients[1].disconnect();

      // User 1 updates the node while user 2 is offline
      clients[0].updateNodePosition(nodeId, { x: 200, y: 200 });

      // User 2 makes offline changes
      const nodesMap2 = clients[1].doc.getMap('nodes');
      const node2 = nodesMap2.get(nodeId);
      node2.data.content = 'Offline Update';
      nodesMap2.set(nodeId, { ...node2 });

      // Reconnect user 2
      clients[1].connect();

      // Wait for synchronization
      await waitForSync(2000);

      // Check that both clients have synchronized state
      const finalNode1 = clients[0].getNode(nodeId);
      const finalNode2 = clients[1].getNode(nodeId);

      expect(finalNode1.position).toEqual({ x: 200, y: 200 });
      expect(finalNode2.position).toEqual({ x: 200, y: 200 });
      expect(finalNode1.data.content).toBe('Offline Update');
      expect(finalNode2.data.content).toBe('Offline Update');
    } finally {
      await cleanup();
    }
  });

  it('should handle multiple offline changes gracefully', async () => {
    const { clients, waitForSync, cleanup } =
      await testHarness.createMultiUserScenario(3);

    try {
      // User 1 creates a node
      const nodeId = clients[0].createNode({
        data: { content: 'Original Content' },
        position: { x: 100, y: 100 },
      });

      // Wait for synchronization
      await waitForSync();

      // Disconnect all users
      clients.forEach((client) => client.disconnect());

      // Each user makes offline changes
      for (let i = 0; i < clients.length; i++) {
        const nodesMap = clients[i].doc.getMap('nodes');
        const node = nodesMap.get(nodeId);
        node.data.content = `Updated by User ${i + 1}`;
        node.position = { x: 100 * (i + 1), y: 100 * (i + 1) };
        nodesMap.set(nodeId, { ...node });
      }

      // Reconnect all users
      clients.forEach((client) => client.connect());

      // Wait for synchronization
      await waitForSync(3000);

      // Check that all clients converge to the same state
      const positions = clients.map(
        (client) => client.getNode(nodeId).position
      );
      const contents = clients.map(
        (client) => client.getNode(nodeId).data.content
      );

      // All positions should be the same
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toEqual(positions[0]);
      }

      // All contents should be the same
      for (let i = 1; i < contents.length; i++) {
        expect(contents[i]).toEqual(contents[0]);
      }
    } finally {
      await cleanup();
    }
  });
});
```

### User Presence Testing

Test that users can see who is currently viewing the canvas:

```typescript
// src/features/collaboration/userPresence.test.ts
import { createMultiUserTestHarness } from '../../test-utils/multiUserTestHarness';

describe('User Presence', () => {
  const testHarness = createMultiUserTestHarness();

  it('should show when users join the canvas', async () => {
    const { clients, waitForSync, cleanup } =
      await testHarness.createMultiUserScenario(1);

    try {
      // User 1 is already connected
      clients[0].provider.awareness.setLocalState({
        user: { id: 'user1', name: 'User 1' },
      });

      // Create a second client (user 2 joins)
      const client2 =
        testHarness.createMultiUserScenario.clients[0].createClient('user2');
      client2.provider.awareness.setLocalState({
        user: { id: 'user2', name: 'User 2' },
      });

      // Wait for synchronization
      await waitForSync();

      // Check that user 1 is aware of user 2
      const awareness = clients[0].provider.awareness;
      const states = awareness.getStates();

      expect(states.size).toBe(2);
      expect(
        Array.from(states.values()).some((state) => state.user?.id === 'user2')
      ).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('should show when users leave the canvas', async () => {
    const { clients, waitForSync, cleanup } =
      await testHarness.createMultiUserScenario(2);

    try {
      // Both users set their state
      clients[0].provider.awareness.setLocalState({
        user: { id: 'user1', name: 'User 1' },
      });

      clients[1].provider.awareness.setLocalState({
        user: { id: 'user2', name: 'User 2' },
      });

      // Wait for synchronization
      await waitForSync();

      // Verify both users are aware of each other
      let states = clients[0].provider.awareness.getStates();
      expect(states.size).toBe(2);

      // User 2 disconnects
      clients[1].disconnect();

      // Wait for awareness protocol to clean up
      await waitForSync(2000);

      // Check that user 1 is no longer aware of user 2
      states = clients[0].provider.awareness.getStates();
      expect(states.size).toBe(1);
      expect(Array.from(states.values())[0].user.id).toBe('user1');
    } finally {
      await cleanup();
    }
  });
});
```

## End-to-End Collaborative Testing

Using Playwright for end-to-end collaborative testing:

```typescript
// e2e/collaboration.spec.ts
import { test, expect, Page } from '@playwright/test';

test.describe('Collaboration', () => {
  let page1: Page;
  let page2: Page;

  test.beforeAll(async ({ browser }) => {
    // Create two browser contexts
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

  test('two users can collaborate in real-time', async () => {
    // User 1 creates a new canvas
    await page1.goto('/canvas/new');
    const canvasUrl = page1.url();

    // User 2 joins the same canvas
    await page2.goto(canvasUrl);

    // User 1 creates a node
    await page1.click('[data-testid="add-node-button"]');
    await page1.click('[data-testid="canvas"]');

    // User 1 adds content to the node
    await page1.fill('[data-testid="chat-input"]', 'Hello from User 1');
    await page1.press('[data-testid="chat-input"]', 'Enter');

    // User 2 should see the node and its content
    await page2.waitForSelector('text=Hello from User 1');

    // User 2 creates another node
    await page2.click('[data-testid="add-node-button"]');
    await page2.click('[data-testid="canvas"]', {
      position: { x: 300, y: 300 },
    });

    // User 2 adds content to their node
    await page2.fill('[data-testid="chat-input"]', 'Hello from User 2');
    await page2.press('[data-testid="chat-input"]', 'Enter');

    // User 1 should see User 2's node
    await page1.waitForSelector('text=Hello from User 2');

    // Test user awareness - User 2 should see User 1's cursor
    await page1.mouse.move(150, 150);

    // Look for a cursor indicator element
    await page2.waitForSelector('[data-testid="cursor-user1"]');
  });

  test('changes persist between sessions', async () => {
    // User 1 creates a new canvas
    await page1.goto('/canvas/new');
    const canvasUrl = page1.url();

    // User 1 creates a node
    await page1.click('[data-testid="add-node-button"]');
    await page1.click('[data-testid="canvas"]');
    await page1.fill('[data-testid="chat-input"]', 'Persistent Content');
    await page1.press('[data-testid="chat-input"]', 'Enter');

    // Both users leave the canvas
    await page1.goto('/dashboard');
    await page2.goto('/dashboard');

    // User 2 opens the canvas later
    await page2.goto(canvasUrl);

    // User 2 should see the persisted content
    await page2.waitForSelector('text=Persistent Content');
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

## Additional Testing Considerations

### Network Condition Testing

Test collaboration under various network conditions:

```typescript
// e2e/networkResilience.spec.ts
import { test, expect, Page } from '@playwright/test';

test.describe('Network Resilience', () => {
  let page1: Page;
  let page2: Page;

  test.beforeEach(async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Log in both users
    await loginUser(page1, 'user1@example.com', 'password1');
    await loginUser(page2, 'user2@example.com', 'password2');

    // User 1 creates a canvas and User 2 joins
    await page1.goto('/canvas/new');
    const canvasUrl = page1.url();
    await page2.goto(canvasUrl);
  });

  test.afterEach(async () => {
    await page1.close();
    await page2.close();
  });

  test('handles network interruptions', async () => {
    // User 1 creates a node
    await page1.click('[data-testid="add-node-button"]');
    await page1.click('[data-testid="canvas"]');
    await page1.fill('[data-testid="chat-input"]', 'Before Disconnect');
    await page1.press('[data-testid="chat-input"]', 'Enter');

    // Wait for User 2 to see it
    await page2.waitForSelector('text=Before Disconnect');

    // User 2 goes offline
    await page2.context().setOffline(true);

    // User 2 should see an offline indicator
    await page2.waitForSelector('[data-testid="offline-indicator"]');

    // User 2 continues to edit while offline
    await page2.fill('[data-testid="chat-input"]', 'Offline Edit');
    await page2.press('[data-testid="chat-input"]', 'Enter');

    // User 1 continues to edit online
    await page1.fill('[data-testid="chat-input"]', 'Online Edit');
    await page1.press('[data-testid="chat-input"]', 'Enter');

    // User 2 comes back online
    await page2.context().setOffline(false);

    // Wait for reconnection and sync
    await page2.waitForSelector('[data-testid="online-indicator"]');

    // Both users should see all edits
    await page1.waitForSelector('text=Offline Edit');
    await page2.waitForSelector('text=Online Edit');
  });

  test('handles slow connections', async () => {
    // Slow down User 2's connection
    await page2.context().route('**/*', async (route) => {
      // Add 500ms delay to all requests
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    // User 1 creates a node
    await page1.click('[data-testid="add-node-button"]');
    await page1.click('[data-testid="canvas"]');

    // User 1 types multiple messages rapidly
    for (let i = 1; i <= 5; i++) {
      await page1.fill('[data-testid="chat-input"]', `Message ${i}`);
      await page1.press('[data-testid="chat-input"]', 'Enter');
    }

    // Despite the slow connection, User 2 should eventually receive all messages
    await page2.waitForSelector('text=Message 5', { timeout: 10000 });

    // Count the messages to ensure all were received
    const messageCount = await page2.locator('.message-content').count();
    expect(messageCount).toBe(5);
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

## Manual Testing Checklist

For comprehensive manual testing of collaborative features:

1. **Basic Collaboration**:

   - [ ] Multiple users can join the same canvas
   - [ ] User presence indicators show currently connected users
   - [ ] Cursor positions of other users are visible
   - [ ] Node creation by one user is visible to others
   - [ ] Node edits by one user are visible to others
   - [ ] Node deletion by one user is reflected for others

2. **Awareness Features**:

   - [ ] User information (name, avatar) is displayed correctly
   - [ ] Editing indicators show which user is editing which node
   - [ ] Users can see when someone is typing
   - [ ] Cursors move smoothly as users navigate the canvas

3. **Conflict Handling**:

   - [ ] Concurrent position edits are resolved consistently
   - [ ] Concurrent content edits are resolved consistently
   - [ ] Users receive visual feedback during conflict resolution
   - [ ] No data loss occurs during conflicts

4. **Offline Support**:

   - [ ] Users can continue working when disconnected
   - [ ] Changes made while offline are preserved
   - [ ] Changes sync correctly when reconnecting
   - [ ] Users receive appropriate offline/online status indicators

5. **Performance**:
   - [ ] Canvas remains responsive with many users
   - [ ] Synchronization occurs promptly (within expected time)
   - [ ] Large documents load and update efficiently
   - [ ] UI remains smooth during synchronization

By following this testing strategy for collaborative features, we ensure that Riff provides a seamless real-time collaboration experience for all users.
