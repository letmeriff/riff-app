import { test, expect } from '@playwright/test';

/**
 * Basic smoke tests to verify that the application loads
 */
test.describe('Smoke tests', () => {
  test('homepage should load', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
    
    // Check that the page loaded successfully
    await expect(page).toHaveTitle(/Riff/);
  });

  test('should show login form', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');
    
    // Check that the login form is displayed
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });
});

/**
 * This is just a sample test to demonstrate the structure.
 * More comprehensive tests will be added as part of the testing strategy.
 */ 