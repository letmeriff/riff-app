import { test as base, Page, BrowserContext, expect } from '@playwright/test';

// Define the structure for our userPages object
type UserPagesObject = {
  [key: string]: Page;
};

// Define the full interface with the method
type UserPages = UserPagesObject & {
  create(userId: string): Promise<Page>;
};

/**
 * Custom test fixture that provides multiple browser contexts and pages
 * for testing collaborative features across multiple simulated users
 */
export const test = base.extend<{
  contexts: BrowserContext[];
  pages: Page[];
  userPages: UserPages;
}>({
  contexts: async ({ browser }, use) => {
    // Create an array to hold our contexts
    const contexts: BrowserContext[] = [];
    
    // Setup: Create browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    contexts.push(context1, context2);
    
    // Use the contexts in the test
    await use(contexts);
    
    // Teardown: Close all contexts
    for (const context of contexts) {
      await context.close();
    }
  },
  
  pages: async ({ contexts }, use) => {
    // Create an array to hold our pages
    const pages: Page[] = [];
    
    // Setup: Create pages for each context
    for (const context of contexts) {
      const page = await context.newPage();
      pages.push(page);
    }
    
    // Use the pages in the test
    await use(pages);
  },
  
  userPages: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    
    // Create a base object for user pages
    const userPagesObj: UserPagesObject = {};
    
    // Create the user pages object with the create method
    const userPages = userPagesObj as UserPages;
    
    // Setup: Create a function to create user pages
    const createUserPage = async (userId: string) => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      userPages[userId] = page;
      return page;
    };
    
    // Attach the create method
    userPages.create = createUserPage;
    
    // Create pages for "alice" and "bob" by default
    await createUserPage('alice');
    await createUserPage('bob');
    
    // Use the user pages in the test
    await use(userPages);
    
    // Teardown: Close all contexts
    for (const context of contexts) {
      await context.close();
    }
  }
});

/**
 * Login helper for multi-user tests
 */
export async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/**/dashboard');
}

/**
 * Navigate to the same canvas as multiple users
 */
export async function joinSameCanvas(pages: Page[], canvasId: string) {
  for (const page of pages) {
    await page.goto(`/canvas/${canvasId}`);
    await page.waitForSelector('[data-testid="canvas-container"]');
  }
}

/**
 * Wait for changes to synchronize between users
 */
export async function waitForSync(pages: Page[], timeout = 2000) {
  // This is a simplified approach - in a real implementation,
  // you might want to wait for specific network events or UI indicators
  await Promise.all(
    pages.map(page => 
      page.waitForFunction(() => {
        // Check for a data attribute that indicates sync is complete
        // This assumes your app sets this attribute when sync is done
        return document.querySelector('[data-sync-complete="true"]') !== null;
      }, { timeout })
    )
  );
}

/**
 * Helper to create a new canvas with a random ID for testing
 */
export async function createTestCanvas(page: Page) {
  await page.goto('/dashboard');
  await page.click('[data-testid="create-canvas-button"]');
  
  // Wait for the canvas to be created and redirected
  await page.waitForURL(/\/canvas\/[a-zA-Z0-9-]+/);
  
  // Extract the canvas ID from the URL
  const url = page.url();
  const canvasId = url.split('/').pop();
  
  return canvasId;
}

/**
 * Helper to create a node on the canvas
 */
export async function createNode(page: Page, position = { x: 200, y: 200 }, content = 'Test Node') {
  // Double click to create a node at the specified position
  await page.mouse.dblclick(position.x, position.y);
  
  // Wait for the node editor to appear and fill it with content
  await page.waitForSelector('[data-testid="node-editor"]');
  await page.fill('[data-testid="node-content"]', content);
  
  // Save the node
  await page.click('[data-testid="save-node-button"]');
  
  // Wait for the node to appear on the canvas
  const nodeSelector = '[data-testid="canvas-node"]:has-text("' + content + '")';
  await page.waitForSelector(nodeSelector);
  
  // Return the node element for future reference
  return page.locator(nodeSelector);
} 