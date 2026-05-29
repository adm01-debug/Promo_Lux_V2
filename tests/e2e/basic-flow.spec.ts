import { test, expect } from '@playwright/test';

test.describe('Freight Quest E2E Flow', () => {
  test('should navigate through dashboard and check monitoring', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/');
    
    // Check for logo or main title to confirm landing
    await expect(page.getByText(/LUX IA/i).first()).toBeVisible();

    // Navigate to Monitoring
    await page.click('nav >> text=Monitoring');
    await expect(page).toHaveURL(/\/monitoring/);

    // Check if the monitoring table is present
    await expect(page.locator('table')).toBeVisible();
  });

  test('should open job details sheet', async ({ page }) => {
    await page.goto('/monitoring');
    
    // Wait for data to load
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible();

    // Click on a row to open details
    await firstRow.click();

    // Verify sheet is open
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.getByText(/Job Details/i)).toBeVisible();
  });
});
