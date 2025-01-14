import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByLabel('I understand and agree that').check();
  await page.getByLabel('I agree that my browsers').check();
  await page.getByRole('button', { name: 'Continue to Doichain dPWA' }).click();
  await page.getByPlaceholder('Find name...').fill('hello');
    // Wait for the spinner to disappear
  await page.waitForSelector('.animate-spin', { state: 'detached' });

  await expect(page.locator('text=Doichain Name hello is available! Hit \'Enter\' to register!')).toBeVisible();
  await page.getByPlaceholder('Find name...').press('Enter');
  //here a loading indicator is shown and must stop see in nameInput.svelte
  // Wait for the label indicating "hello" was found
  // await expect(page.locator('text=hello')).toBeVisible();
 
  // await page.getByText('-05-04 21:00:47').click();
  await page.getByRole('button', { name: 'Show Transaction Details' }).click();
  await page.getByText('N8YtTBMRqMq9E45VMT9KVbfwt5X5oLD4vt').click();
  await page.getByText('b474aa49fcea7cb1cadd41598db64f4bcddd10e58cf9070db34283dac357e7d5').click();
  // await expect(page.locator('div').filter({ hasText: /^2024-05-04 21:00:47$/ })).toBeVisible();
  await page.getByText('hello').nth(2).click();
  await page.getByText('world').click();
  await page.getByText('100000000').click();
  await page.getByText('b474aa49fcea7cb1cadd41598db64f4bcddd10e58cf9070db34283dac357e7d5').click();
  await page.getByText('N8YtTBMRqMq9E45VMT9KVbfwt5X5oLD4vt').click();
});