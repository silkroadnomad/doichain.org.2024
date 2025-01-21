import { test, expect } from '@playwright/test';

async function checkWssConnection(page) {
  await expect(async () => {
    const wssText = await page.locator('[data-testid="transport-wss"]').textContent();
    const wssCount = parseInt(wssText.split(':')[1].trim(), 10);
    expect(wssCount).toBeGreaterThan(0);
  }).toPass({ timeout: 30000 });
}

async function acceptTermsAndContinue(page) {

  await page.goto('/');
  await page.getByLabel('I understand and agree that').check();
  await page.getByLabel('I agree that my browsers').check();
  await page.getByRole('button', { name: 'Continue to Doichain dPWA' }).click();
}
  
test('find the hello world nfc', async ({ page }) => {
  await acceptTermsAndContinue(page);
  await checkWssConnection(page);
  
  await page.getByPlaceholder('Find name...').fill('hello');
  // Wait for the spinner to disappear
  await page.waitForSelector('.animate-spin', { state: 'detached' });

  await expect(page.locator('text=Doichain Name hello is available! Hit \'Enter\' to register!')).toBeVisible();
  await page.getByPlaceholder('Find name...').press('Enter'); 
  await page.getByRole('button', { name: 'Show Transaction Details' }).click();
  await page.getByText('N8YtTBMRqMq9E45VMT9KVbfwt5X5oLD4vt').click();
  await page.getByText('b474aa49fcea7cb1cadd41598db64f4bcddd10e58cf9070db34283dac357e7d5').click();
  await page.getByText('hello').nth(2).click();
  await page.getByText('world').click();
  await page.getByText('100000000').click();
  await page.getByText('b474aa49fcea7cb1cadd41598db64f4bcddd10e58cf9070db34283dac357e7d5').click();
  await page.getByText('N8YtTBMRqMq9E45VMT9KVbfwt5X5oLD4vt').click();
});

test('check for at least one wss transport connection', async ({ page }) => {
  await acceptTermsAndContinue(page);
  
  await page.getByRole('button', { name: 'Collections' }).click();
  await page.getByText('Current Block Height:').click();
  
  await checkWssConnection(page);
});

test('verify at least 3 NFCs are displayed in NameOps section', async ({ page }) => {
  await acceptTermsAndContinue(page);
  await checkWssConnection(page);
  
  // Wait for NFC cards to load
  await page.waitForSelector('[data-testid="nft-card"]');
  
  // Get all NFC cards
  const nftCards = await page.locator('[data-testid="nft-card"]');
  const nftCardCount = await nftCards.count();
  
  // Verify more than 3 NFCs are displayed
  expect(nftCardCount).toBeGreaterThan(3);
  
  // Optional: Verify some content in the NFC cards
  const firstNfc = nftCards.first();
  await expect(firstNfc).toBeVisible();
  await expect(firstNfc.locator('h2')).not.toBeEmpty();
});


test('verify block height matches explorer API', async ({ page }) => {
  await acceptTermsAndContinue(page);
  await checkWssConnection(page); 
  // Get block height from the UI
  const uiBlockHeightText = await page.getByText('Current Block Height:').textContent();
  const uiBlockHeight = parseInt(uiBlockHeightText.split(':')[1].trim(), 10);
  console.log("uiBlockHeight",uiBlockHeight)
  // Fetch block height from API
  const apiResponse = await fetch('https://explorer.doichain.org/api/getblockcount/');
  const apiData = await apiResponse.json();
  console.log("apiData",apiData)
  const apiBlockHeight = apiData.blockcount;
  
  // Compare values with a tolerance of ±1 block to account for potential delays
  expect(uiBlockHeight).toBeGreaterThanOrEqual(apiBlockHeight - 1);
  expect(uiBlockHeight).toBeLessThanOrEqual(apiBlockHeight + 1);
});