import { test, expect } from '@playwright/test';

test('should display nameId details for valid name using hash route', async ({ page }) => {
	await page.goto('/#/PeaceDove-CC');
	await expect(page.getByText('PeaceDove-CC')).toBeVisible();
	await expect(page.getByText('No NameId found for given entry.')).not.toBeVisible();
});

test('should display no results message for non-existent nameId using hash route', async ({
	page
}) => {
	await page.goto('/#/NonExistentName123');
	await expect(page.getByText('No NameId found for given entry.')).toBeVisible();
});

test('should set proper meta tags for social media sharing with hash route', async ({ page }) => {
	await page.goto('/#/PeaceDove-CC');

	// Wait for meta tags to be updated by client-side JavaScript
	await page.waitForSelector('meta[property="og:title"]');

	// Check meta tags
	const title = await page.title();
	expect(title).toBe('PeaceDove-CC - Doichain Name Details');

	const ogTitle = await page.$eval('meta[property="og:title"]', (el) => el.getAttribute('content'));
	expect(ogTitle).toBe('PeaceDove-CC - Doichain Name Details');

	const twitterTitle = await page.$eval('meta[name="twitter:title"]', (el) =>
		el.getAttribute('content')
	);
	expect(twitterTitle).toBe('PeaceDove-CC - Doichain Name Details');

	// Check that URL meta tag contains hash
	const ogUrl = await page.$eval('meta[property="og:url"]', (el) => el.getAttribute('content'));
	expect(ogUrl).toContain('#/PeaceDove-CC');
});

test('should allow searching for names when no hash route is present', async ({ page }) => {
	await page.goto('/');

	// Type a name and press enter
	await page.getByPlaceholder('Enter name to search').fill('PeaceDove-CC');
	await page.keyboard.press('Enter');

	// Verify results appear
	await expect(page.getByText('PeaceDove-CC')).toBeVisible();
});

test('should handle hash route changes correctly', async ({ page }) => {
	// Start with one nameId
	await page.goto('/#/PeaceDove-CC');
	await expect(page.getByText('PeaceDove-CC')).toBeVisible();

	// Change to another nameId by updating hash
	await page.evaluate(() => {
		window.location.hash = '#/AnotherName';
	});

	// Wait for UI to update
	await expect(page.getByText('No NameId found for given entry.')).toBeVisible();
});
