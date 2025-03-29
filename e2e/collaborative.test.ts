import { expect } from '@playwright/test';
import {
  test,
  loginUser,
  createTestCanvas,
  createNode,
  waitForSync,
} from './utils/multi-browser-test';

/**
 * End-to-end tests for collaborative features
 *
 * Reference: Phase 3: Collaborative Feature Testing - Week 8: End-to-End Collaborative Flows
 */
test.describe('Collaborative Feature Testing', () => {
  // Test credentials for test users
  const testUsers = {
    alice: { email: 'alice@example.com', password: 'password123' },
    bob: { email: 'bob@example.com', password: 'password123' },
  };

  test('two users can edit the same canvas simultaneously', async ({
    userPages,
  }) => {
    // Login both users
    await loginUser(
      userPages.alice,
      testUsers.alice.email,
      testUsers.alice.password
    );
    await loginUser(userPages.bob, testUsers.bob.email, testUsers.bob.password);

    // Alice creates a new canvas
    const canvasId = await createTestCanvas(userPages.alice);

    // Bob joins the same canvas
    await userPages.bob.goto(`/canvas/${canvasId}`);
    await userPages.bob.waitForSelector('[data-testid="canvas-container"]');

    // Alice creates a node
    const aliceNodePosition = { x: 200, y: 200 };
    const aliceNodeContent = 'Node created by Alice';
    await createNode(userPages.alice, aliceNodePosition, aliceNodeContent);

    // Wait for synchronization
    await waitForSync([userPages.alice, userPages.bob]);

    // Verify that Bob can see Alice's node
    const bobsViewOfAliceNode = userPages.bob.locator(
      `[data-testid="canvas-node"]:has-text("${aliceNodeContent}")`
    );
    await expect(bobsViewOfAliceNode).toBeVisible();

    // Bob creates a node
    const bobNodePosition = { x: 400, y: 200 };
    const bobNodeContent = 'Node created by Bob';
    await createNode(userPages.bob, bobNodePosition, bobNodeContent);

    // Wait for synchronization
    await waitForSync([userPages.alice, userPages.bob]);

    // Verify that Alice can see Bob's node
    const alicesViewOfBobNode = userPages.alice.locator(
      `[data-testid="canvas-node"]:has-text("${bobNodeContent}")`
    );
    await expect(alicesViewOfBobNode).toBeVisible();
  });

  test('changes persist when a user disconnects and reconnects', async ({
    userPages,
  }) => {
    // Login both users
    await loginUser(
      userPages.alice,
      testUsers.alice.email,
      testUsers.alice.password
    );
    await loginUser(userPages.bob, testUsers.bob.email, testUsers.bob.password);

    // Alice creates a new canvas
    const canvasId = await createTestCanvas(userPages.alice);

    // Bob joins the same canvas
    await userPages.bob.goto(`/canvas/${canvasId}`);
    await userPages.bob.waitForSelector('[data-testid="canvas-container"]');

    // Alice creates a node
    const nodeContent = 'Persistent node';
    await createNode(userPages.alice, { x: 200, y: 200 }, nodeContent);

    // Wait for synchronization
    await waitForSync([userPages.alice, userPages.bob]);

    // Bob disconnects (closes the page)
    await userPages.bob.close();

    // Create a new page for Bob
    const bobNewPage = await userPages.create('bob-new');

    // Log in Bob again
    await loginUser(bobNewPage, testUsers.bob.email, testUsers.bob.password);

    // Bob rejoins the canvas
    await bobNewPage.goto(`/canvas/${canvasId}`);
    await bobNewPage.waitForSelector('[data-testid="canvas-container"]');

    // Verify that Bob can still see the node Alice created
    const bobsViewOfNode = bobNewPage.locator(
      `[data-testid="canvas-node"]:has-text("${nodeContent}")`
    );
    await expect(bobsViewOfNode).toBeVisible();
  });

  test('user awareness indicators show which users are online', async ({
    userPages,
  }) => {
    // Login both users
    await loginUser(
      userPages.alice,
      testUsers.alice.email,
      testUsers.alice.password
    );
    await loginUser(userPages.bob, testUsers.bob.email, testUsers.bob.password);

    // Alice creates a new canvas
    const canvasId = await createTestCanvas(userPages.alice);

    // Bob joins the same canvas
    await userPages.bob.goto(`/canvas/${canvasId}`);
    await userPages.bob.waitForSelector('[data-testid="canvas-container"]');

    // Verify that Alice can see Bob is online
    const alicesViewOfUserList = userPages.alice.locator(
      '[data-testid="user-presence-list"]'
    );
    await expect(alicesViewOfUserList).toContainText('Bob');

    // Verify that Bob can see Alice is online
    const bobsViewOfUserList = userPages.bob.locator(
      '[data-testid="user-presence-list"]'
    );
    await expect(bobsViewOfUserList).toContainText('Alice');
  });

  test('user cursor positions are synchronized', async ({ userPages }) => {
    // This test requires awareness features to be implemented

    // Login both users
    await loginUser(
      userPages.alice,
      testUsers.alice.email,
      testUsers.alice.password
    );
    await loginUser(userPages.bob, testUsers.bob.email, testUsers.bob.password);

    // Alice creates a new canvas
    const canvasId = await createTestCanvas(userPages.alice);

    // Bob joins the same canvas
    await userPages.bob.goto(`/canvas/${canvasId}`);
    await userPages.bob.waitForSelector('[data-testid="canvas-container"]');

    // Move Bob's cursor to a specific position
    await userPages.bob.mouse.move(300, 300);

    // Wait for synchronization
    await waitForSync([userPages.alice, userPages.bob]);

    // Verify that Alice can see Bob's cursor
    const alicesViewOfBobsCursor = userPages.alice.locator(
      '[data-testid="remote-cursor"][data-user-id="bob"]'
    );
    await expect(alicesViewOfBobsCursor).toBeVisible();

    // The exact position check might be implementation-specific
    // This is a simplified check - your actual implementation might need different assertions
  });

  test('concurrent edits on the same node are resolved properly', async ({
    userPages,
  }) => {
    // Login both users
    await loginUser(
      userPages.alice,
      testUsers.alice.email,
      testUsers.alice.password
    );
    await loginUser(userPages.bob, testUsers.bob.email, testUsers.bob.password);

    // Alice creates a new canvas
    const canvasId = await createTestCanvas(userPages.alice);

    // Bob joins the same canvas
    await userPages.bob.goto(`/canvas/${canvasId}`);
    await userPages.bob.waitForSelector('[data-testid="canvas-container"]');

    // Alice creates a node
    const initialContent = 'Initial content';
    const node = await createNode(
      userPages.alice,
      { x: 200, y: 200 },
      initialContent
    );

    // Wait for synchronization
    await waitForSync([userPages.alice, userPages.bob]);

    // Both users select the same node to edit simultaneously
    await node.dblclick();
    const bobsNode = userPages.bob.locator(
      `[data-testid="canvas-node"]:has-text("${initialContent}")`
    );
    await bobsNode.dblclick();

    // Alice edits the node
    await userPages.alice.fill(
      '[data-testid="node-content"]',
      'Alice edited this node'
    );
    await userPages.alice.click('[data-testid="save-node-button"]');

    // Bob edits the same node with different content
    await userPages.bob.fill(
      '[data-testid="node-content"]',
      'Bob edited this node'
    );
    await userPages.bob.click('[data-testid="save-node-button"]');

    // Wait for synchronization
    await waitForSync([userPages.alice, userPages.bob]);

    // Check that both users see the same content after conflict resolution
    // The exact expected content depends on your conflict resolution strategy
    const alicesNodeAfterEdit = userPages.alice
      .locator('[data-testid="canvas-node"]')
      .first();
    const bobsNodeAfterEdit = userPages.bob
      .locator('[data-testid="canvas-node"]')
      .first();

    const alicesNodeContent = await alicesNodeAfterEdit.textContent();
    const bobsNodeContent = await bobsNodeAfterEdit.textContent();

    // Both users should see the same content (either Alice's or Bob's or merged)
    expect(alicesNodeContent).toEqual(bobsNodeContent);
  });
});
