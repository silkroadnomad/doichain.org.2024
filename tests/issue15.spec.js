import { test, expect } from '@playwright/test';

test.describe('Dynamic nameId route', () => {
  test('displays nameId details for valid name', async ({ page }) => {
    // Use a known valid nameId from the example in nameShow.svelte
    const nameId = 'PeaceDove-CC';
    await page.goto(`/${nameId}`);
    
    // Check that the page shows the nameId
    await expect(page.getByText(nameId)).toBeVisible();
    
    // Wait for the nameShow component to load data
    await page.waitForSelector('.nameShow');
    
    // Verify that we don't see the search interface when nameId is provided
    const searchButton = page.getByText('NameShow');
    await expect(searchButton).not.toBeVisible();
    
    // Verify that we see some data loaded (basic structure check)
    await expect(page.locator('.nameShow')).toBeVisible();
  });

  test('handles non-existent nameId gracefully', async ({ page }) => {
    const nameId = 'NonExistentName-' + Date.now();
    await page.goto(`/${nameId}`);
    
    // Check that the page loads
    await expect(page.locator('.nameShow')).toBeVisible();
    
    // Verify we see the "no results" message
    await expect(page.getByText('No NameId found for given entry')).toBeVisible();
  });

  test('has proper meta tags', async ({ page }) => {
    const nameId = 'TestName';
    await page.goto(`/${nameId}`);
    
    // Check meta tags
    await expect(page).toHaveTitle(`${nameId} on Doichain`);
    
    // Check OpenGraph meta tags
    const ogTitle = await page.locator('meta[property="og:title"]');
    const ogDescription = await page.locator('meta[property="og:description"]');
    const ogUrl = await page.locator('meta[property="og:url"]');
    
    await expect(ogTitle).toHaveAttribute('content', `${nameId} on Doichain`);
    await expect(ogDescription).toHaveAttribute('content', `View details for ${nameId} on the Doichain network`);
    await expect(ogUrl).toHaveAttribute('content', expect.stringContaining(nameId));
  });
});
