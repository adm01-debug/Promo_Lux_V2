import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Auth logic if needed
  });

  test('Dashboard should be accessible', async ({ page }) => {
    await injectAxe(page);
    await checkA11y(page, undefined, {
      axeOptions: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa'],
        },
      },
    });
  });

  test('Settings should be accessible', async ({ page }) => {
    await page.click('button[aria-label="Configurações"]');
    await injectAxe(page);
    await checkA11y(page);
  });
});
