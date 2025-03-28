import { expect } from '@playwright/test';
import {
  test,
  loginUser,
  createTestCanvas,
  createNode,
  waitForSync,
} from './utils/multi-browser-test';

/**
 * End-to-end tests for different network conditions
 *
 * Reference: Phase 3: Collaborative Feature Testing - Week 8: End-to-End Collaborative Flows
 */
test.describe('Network Conditions Testing', () => {
  // Test credentials for test users
  const testUsers = {
    alice: { email: 'alice@example.com', password: 'password123' },
    bob: { email: 'bob@example.com', password: 'password123' },
  };

  test('users can continue editing during network interruptions', async ({
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
    const aliceNodeContent = 'Node created by Alice';
    await createNode(userPages.alice, { x: 200, y: 200 }, aliceNodeContent);

    // Wait for synchronization
    await waitForSync([userPages.alice, userPages.bob]);

    // Simulate network offline for Bob
    await userPages.bob.context().setOffline(true);

    // Verify Bob sees offline indicator
    const offlineIndicator = userPages.bob.locator(
      '[data-testid="offline-indicator"]'
    );
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Bob creates a node while offline
    const bobOfflineNodeContent = 'Node created by Bob while offline';
    await createNode(userPages.bob, { x: 400, y: 200 }, bobOfflineNodeContent);

    // Alice creates another node (online)
    const aliceSecondNodeContent = 'Second node by Alice';
    await createNode(
      userPages.alice,
      { x: 200, y: 400 },
      aliceSecondNodeContent
    );

    // Bob can't see Alice's second node yet because he's offline
    const bobsViewOfAliceSecondNode = userPages.bob.locator(
      `[data-testid="canvas-node"]:has-text("${aliceSecondNodeContent}")`
    );
    await expect(bobsViewOfAliceSecondNode).not.toBeVisible({ timeout: 5000 });

    // Restore Bob's connection
    await userPages.bob.context().setOffline(false);

    // Verify offline indicator disappears
    await expect(offlineIndicator).not.toBeVisible({ timeout: 5000 });

    // Wait for synchronization
    await waitForSync([userPages.alice, userPages.bob]);

    // Verify Alice can now see Bob's offline node
    const alicesViewOfBobOfflineNode = userPages.alice.locator(
      `[data-testid="canvas-node"]:has-text("${bobOfflineNodeContent}")`
    );
    await expect(alicesViewOfBobOfflineNode).toBeVisible();

    // Verify Bob can now see Alice's second node
    await expect(bobsViewOfAliceSecondNode).toBeVisible();
  });

  test('reconnection after prolonged disconnection works correctly', async ({
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

    // Disconnect Bob by closing his browser completely
    await userPages.bob.close();

    // Alice creates three nodes while Bob is disconnected
    for (let i = 1; i <= 3; i++) {
      await createNode(
        userPages.alice,
        { x: 200, y: 100 * i },
        `Node ${i} created while Bob was disconnected`
      );
    }

    // Bob reconnects after a while
    const bobNewPage = await userPages.create('bob-reconnect');
    await loginUser(bobNewPage, testUsers.bob.email, testUsers.bob.password);

    // Bob rejoins the canvas
    await bobNewPage.goto(`/canvas/${canvasId}`);
    await bobNewPage.waitForSelector('[data-testid="canvas-container"]');

    // Verify Bob can see all nodes created while he was disconnected
    for (let i = 1; i <= 3; i++) {
      const nodeContent = `Node ${i} created while Bob was disconnected`;
      const node = bobNewPage.locator(
        `[data-testid="canvas-node"]:has-text("${nodeContent}")`
      );
      await expect(node).toBeVisible();
    }
  });

  test.describe('Cross-browser Compatibility', () => {
    // These tests will automatically run on all browser projects configured in playwright.config.ts

    test('canvas renders correctly across different browsers', async ({
      userPages,
      browserName,
    }) => {
      // Skip detailed test information logging if not needed
      test.info().annotations.push({
        type: 'Browser',
        description: browserName,
      });

      // Login user
      await loginUser(
        userPages.alice,
        testUsers.alice.email,
        testUsers.alice.password
      );

      // Create a new canvas and open it
      await createTestCanvas(userPages.alice);

      // Create multiple nodes and edges to test rendering
      await createNode(userPages.alice, { x: 200, y: 200 }, 'Node 1');
      await createNode(userPages.alice, { x: 400, y: 200 }, 'Node 2');
      await createNode(userPages.alice, { x: 300, y: 400 }, 'Node 3');

      // Test that all nodes are visible
      for (let i = 1; i <= 3; i++) {
        const node = userPages.alice.locator(
          `[data-testid="canvas-node"]:has-text("Node ${i}")`
        );
        await expect(node).toBeVisible();
      }

      // Take a screenshot for visual comparison
      await userPages.alice.screenshot({
        path: `cross-browser-${browserName}.png`,
        fullPage: false,
      });
    });

    test('collaborative editing works across different browsers', async ({
      userPages,
      browserName,
    }) => {
      // This test will need customization based on your environment's multi-browser capabilities
      // Skip if it's not the primary browser for multi-browser testing
      if (browserName !== 'chromium') {
        test.skip();
      }

      // For a true cross-browser test, you would need to coordinate with external testing
      // or use a different approach than what Playwright fixtures provide by default

      // Login both users
      await loginUser(
        userPages.alice,
        testUsers.alice.email,
        testUsers.alice.password
      );
      await loginUser(
        userPages.bob,
        testUsers.bob.email,
        testUsers.bob.password
      );

      // Alice creates a new canvas
      const canvasId = await createTestCanvas(userPages.alice);

      // Bob joins the same canvas
      await userPages.bob.goto(`/canvas/${canvasId}`);
      await userPages.bob.waitForSelector('[data-testid="canvas-container"]');

      // Alice creates a node
      const aliceNodeContent = 'Cross-browser collaboration test';
      await createNode(userPages.alice, { x: 200, y: 200 }, aliceNodeContent);

      // Wait for synchronization
      await waitForSync([userPages.alice, userPages.bob]);

      // Verify that Bob can see Alice's node
      const bobsViewOfAliceNode = userPages.bob.locator(
        `[data-testid="canvas-node"]:has-text("${aliceNodeContent}")`
      );
      await expect(bobsViewOfAliceNode).toBeVisible();
    });
  });
});

/**
 * Test for throttled network connections
 * Note: These tests require browser support for connection throttling
 */
test.describe('Throttled Network Testing', () => {
  test.skip('app functions with slow 3G connection', async ({ browser }) => {
    // Create a context with network throttling
    const throttledContext = await browser.newContext({
      // These settings simulate a slow 3G connection
      deviceScaleFactor: 1,
      isMobile: false,
      // Additional network throttling would be applied here
      // Actual implementation may vary based on Playwright's available APIs
    });

    // Create pages for the throttled context
    const page = await throttledContext.newPage();

    // Login user
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alice@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to dashboard
    await page.waitForURL('/**/dashboard', { timeout: 30000 }); // Longer timeout for slow connection

    // Create a new canvas (expect longer loading times)
    await page.click('[data-testid="create-canvas-button"]');
    await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/, { timeout: 30000 });

    // Verify the canvas loads eventually
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible({
      timeout: 30000,
    });

    // Create a node
    await page.mouse.dblclick(200, 200);
    await page.waitForSelector('[data-testid="node-editor"]', {
      timeout: 30000,
    });
    await page.fill('[data-testid="node-content"]', 'Slow connection test');
    await page.click('[data-testid="save-node-button"]');

    // Verify node appears despite slow connection
    const nodeSelector =
      '[data-testid="canvas-node"]:has-text("Slow connection test")';
    await page.waitForSelector(nodeSelector, { timeout: 30000 });

    // Clean up
    await throttledContext.close();
  });
});
