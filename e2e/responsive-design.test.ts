import { expect } from '@playwright/test';
import { test as base } from '@playwright/test';
import { loginUser, createNode } from './utils/multi-browser-test';

/**
 * Custom test for responsive design testing with specific viewports
 */
const test = base.extend({
  // Override the page fixture to automatically set viewport
  page: async ({ browser }, use, testInfo) => {
    // Get the viewport from the config or annotation
    const viewport = getViewport(testInfo);
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    // Log viewport size for test reporting
    console.log(`Testing with viewport: ${viewport.width}x${viewport.height}`);

    // Use the page in the test
    await use(page);

    // Clean up
    await context.close();
  },
});

/**
 * Get viewport dimensions from test annotation or test title
 */
function getViewport(testInfo) {
  // Define standard sizes
  const viewports = {
    mobile: { width: 375, height: 667 }, // iPhone 8
    tablet: { width: 768, height: 1024 }, // iPad
    laptop: { width: 1366, height: 768 }, // Common laptop
    desktop: { width: 1920, height: 1080 }, // Full HD desktop
  };

  // Check if test has a viewport annotation
  const viewportAnnotation = testInfo.annotations.find(
    (a) => a.type === 'viewport'
  );
  if (viewportAnnotation) {
    return viewports[viewportAnnotation.description] || viewports.laptop;
  }

  // Check if test title includes a viewport name
  for (const [name, dimensions] of Object.entries(viewports)) {
    if (testInfo.title.toLowerCase().includes(name.toLowerCase())) {
      return dimensions;
    }
  }

  // Default to laptop
  return viewports.laptop;
}

/**
 * Responsive design tests for various device sizes
 *
 * Reference: Phase 3: Collaborative Feature Testing - Week 8: End-to-End Collaborative Flows
 */
test.describe('Responsive Design Testing', () => {
  const testUser = { email: 'alice@example.com', password: 'password123' };

  test('dashboard adapts to mobile viewport', async ({ page }) => {
    test.info().annotations.push({ type: 'viewport', description: 'mobile' });

    // Login
    await loginUser(page, testUser.email, testUser.password);

    // Check that the dashboard UI adapts to mobile
    await expect(
      page.locator('[data-testid="mobile-menu-button"]')
    ).toBeVisible();

    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');

    // Verify mobile menu items are visible
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="create-canvas-button"]')
    ).toBeVisible();
  });

  test('canvas controls adapt to tablet viewport', async ({ page }) => {
    test.info().annotations.push({ type: 'viewport', description: 'tablet' });

    // Login
    await loginUser(page, testUser.email, testUser.password);

    // Create a new canvas
    const createButton = page.locator('[data-testid="create-canvas-button"]');
    await createButton.click();

    // Wait for canvas to load
    await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    await page.waitForSelector('[data-testid="canvas-container"]');

    // Verify tablet-specific UI elements
    await expect(page.locator('[data-testid="canvas-toolbar"]')).toBeVisible();

    // Check that toolbar has adapted to tablet size
    const toolbar = page.locator('[data-testid="canvas-toolbar"]');
    const boundingBox = await toolbar.boundingBox();

    // On tablet, toolbar should be positioned appropriately
    // This is just an example assertion - adjust based on your design
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      expect(boundingBox.width).toBeLessThan(768); // Should not exceed viewport width
    }
  });

  test('canvas interaction works on mobile viewport', async ({ page }) => {
    test.info().annotations.push({ type: 'viewport', description: 'mobile' });

    // Login
    await loginUser(page, testUser.email, testUser.password);

    // Create a new canvas
    const createButton = page.locator('[data-testid="create-canvas-button"]');
    await createButton.click();

    // Wait for canvas to load
    await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
    await page.waitForSelector('[data-testid="canvas-container"]');

    // Test mobile touch interactions
    // Note: Playwright simulates touches as mouse events by default

    // Double tap to create a node
    await page.dblclick(200, 200);

    // Wait for node editor to appear
    await page.waitForSelector('[data-testid="node-editor"]');

    // Type content
    await page.fill('[data-testid="node-content"]', 'Mobile test node');

    // Save the node
    await page.click('[data-testid="save-node-button"]');

    // Verify node was created
    const nodeSelector =
      '[data-testid="canvas-node"]:has-text("Mobile test node")';
    await expect(page.locator(nodeSelector)).toBeVisible();

    // Test canvas navigation
    // Use keyboard shortcut for zoom instead of mouse wheel
    await page.keyboard.down('Control');
    await page.keyboard.press('+'); // Zoom in
    await page.keyboard.up('Control');

    // Test pan by dragging
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(300, 300);
    await page.mouse.up();
  });

  // Test a range of viewports in a parameterized test
  for (const viewport of ['mobile', 'tablet', 'laptop', 'desktop']) {
    test(`canvas renders correctly on ${viewport}`, async ({ page }) => {
      test.info().annotations.push({ type: 'viewport', description: viewport });

      // Login
      await loginUser(page, testUser.email, testUser.password);

      // Create a new canvas
      const createButton = page.locator('[data-testid="create-canvas-button"]');
      await createButton.click();

      // Wait for canvas to load
      await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
      await page.waitForSelector('[data-testid="canvas-container"]');

      // Create multiple nodes
      await createNode(page, { x: 200, y: 200 }, 'Node 1');
      await createNode(page, { x: 400, y: 200 }, 'Node 2');

      // Verify nodes are visible
      for (let i = 1; i <= 2; i++) {
        const node = page.locator(
          `[data-testid="canvas-node"]:has-text("Node ${i}")`
        );
        await expect(node).toBeVisible();
      }

      // Take a screenshot for visual comparison
      await page.screenshot({
        path: `responsive-${viewport}.png`,
        fullPage: false,
      });
    });
  }

  test('chat interface adapts to different viewports', async ({ page }) => {
    // Test on multiple viewport sizes
    for (const viewport of ['mobile', 'tablet', 'desktop']) {
      // Set viewport for this iteration
      const viewportSizes = {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1920, height: 1080 },
      };

      await page.setViewportSize(viewportSizes[viewport]);

      // Log current viewport for debugging
      console.log(
        `Testing chat interface on ${viewport}: ${JSON.stringify(viewportSizes[viewport])}`
      );

      // Login
      await loginUser(page, testUser.email, testUser.password);

      // Create a new canvas
      const createButton = page.locator('[data-testid="create-canvas-button"]');
      await createButton.click();

      // Wait for canvas to load
      await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
      await page.waitForSelector('[data-testid="canvas-container"]');

      // Create a chat node
      await createNode(page, { x: 200, y: 200 }, 'Chat Node');

      // Open the chat interface (implementation may vary)
      const chatNode = page.locator(
        '[data-testid="canvas-node"]:has-text("Chat Node")'
      );
      await chatNode.click();

      // Verify chat interface is visible
      await expect(
        page.locator('[data-testid="chat-interface"]')
      ).toBeVisible();

      // Check that chat input and messages container are appropriately sized
      const chatInputBox = page.locator('[data-testid="chat-input"]');
      const boundingBox = await chatInputBox.boundingBox();

      // On mobile, the chat input should be smaller
      if (viewport === 'mobile' && boundingBox) {
        expect(boundingBox.width).toBeLessThan(350);
      }

      // Take a screenshot for visual comparison
      await page.screenshot({
        path: `chat-interface-${viewport}.png`,
        fullPage: false,
      });
    }
  });
});
