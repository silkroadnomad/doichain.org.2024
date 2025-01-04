import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByLabel('I understand and agree that').check();
  await page.getByLabel('I agree that my browsers').check();
  await page.getByRole('button', { name: 'Continue to Doichain dPWA' }).click();
  await page.getByPlaceholder('Find name...').fill('hello');
  await page.getByPlaceholder('Find name...').press('Enter');
  await page.getByText('-05-04 21:00:47').click();
  await page.getByRole('button', { name: 'Show Transaction Details' }).click();
  await page.getByText('N8YtTBMRqMq9E45VMT9KVbfwt5X5oLD4vt').click();
  await page.getByText('b474aa49fcea7cb1cadd41598db64f4bcddd10e58cf9070db34283dac357e7d5').click();
  await page.locator('div').filter({ hasText: /^2024-05-04 21:00:47$/ }).click();
  await page.getByText('hello').nth(2).click();
  await page.getByText('world').click();
  await page.getByText('100000000').click();
  await page.getByText('b474aa49fcea7cb1cadd41598db64f4bcddd10e58cf9070db34283dac357e7d5').click();
  await page.getByText('N8YtTBMRqMq9E45VMT9KVbfwt5X5oLD4vt').click();
});