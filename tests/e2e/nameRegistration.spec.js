import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { Psbt } from 'bitcoinjs-lib';
import { DoichainRPC } from '../doichainRPC.js';

const bip32 = BIP32Factory(ecc);

// Helper to generate random name
function generateRandomName() {
  return randomBytes(8).toString('hex');
}

// Helper to sign PSBT
async function signPsbt(psbtBase64, seedPhrase) {
  const root = bip32.fromSeed(Buffer.from(seedPhrase, 'hex'));
  const psbt = Psbt.fromBase64(psbtBase64);
  
  psbt.data.inputs.forEach((input, index) => {
    const path = input.bip32Derivation[0].path;
    const child = root.derivePath(path);
    psbt.signInput(index, child);
  });
  
  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}

// Start local node before tests
test.beforeAll(async () => {
  process.env.E2E_TESTING = 'true';
  
  // Initialize Doichain RPC
  const doichainRPC = new DoichainRPC({
    host: 'localhost',
    port: 18332,
    username: process.env.DOICHAIN_RPC_USER || 'admin',
    password: process.env.DOICHAIN_RPC_PASSWORD || 'adminpw',
  });

  // Generate new address and mine coins
  try {
    const newAddress = await doichainRPC.call('getnewaddress');
    console.log(`🏠 New address generated: ${newAddress}`);
    
    console.log('⛏️ Mining 200 DOI...');
    const miningResult = await doichainRPC.call('generatetoaddress', [
      200,
      newAddress,
    ]);
    console.log(`✅ Mining complete! ${miningResult.length} blocks mined`);
  } catch (error) {
    console.error('❌ Error setting up regtest:', error);
    throw error;
  }

  // Get peer ID
  const response = await fetch('http://localhost:3000/peer-id');
  const { peerId } = await response.json();
  console.log('peerId', peerId);
  process.env.LOCAL_PEER_ID = peerId;
});

// Cleanup after tests
test.afterAll(async () => {
  delete process.env.E2E_TESTING;
  delete process.env.LOCAL_PEER_ID;
//   await stopLocalNode();
});

test('complete name registration flow', async ({ page }) => {
  // Test configuration
  const seedPhrase = 'your_test_seed_phrase_here'; // Replace with test seed
  const xpub = 'your_test_xpub_here'; // Replace with test xpub
  const testImage = 'tests/fixtures/test-image.jpg'; // Add a test image
  const electrumUrl = 'your_electrum_server_url'; // Replace with test electrum server
  
  // Generate random name
  const nameId = generateRandomName();
  const nameValue = 'test-value';

  // Accept terms and connect
  await page.goto('http://localhost:5173/#/e2e');
  await page.getByLabel('I understand and agree that').check();
  await page.getByLabel('I agree that my browsers').check();
  await page.getByRole('button', { name: 'Continue to Doichain dPWA' }).click();

  // Wait for form to appear and fill name/description
  await page.waitForSelector('[data-testid="name-input"]');
  await page.getByTestId('name-input').fill('hello');
    // Wait for the spinner to disappear
  await page.waitForSelector('.animate-spin', { state: 'detached' });

  await expect(page.locator('text=Doichain Name hello is available! Hit \'Enter\' to register!')).toBeVisible();
  await page.getByPlaceholder('Find name...').press('Enter'); 
  await page.getByTestId('nftDescription-input').fill('a test description');
 
 /*


  // Upload test image  
  // const fileChooserPromise = page.waitForEvent('filechooser');
  // await page.locator('.dropzone').click();
  // const fileChooser = await fileChooserPromise;
  // await fileChooser.setFiles('tests/e2e/test-image.png');

  // Wait for image preview to appear
  await page.waitForSelector('img[alt="Preview"]');

  // Click next button
  await page.getByRole('button', { name: 'Next' }).click();

    // Enter xpub
  await page.getByPlaceholder('Enter your xpub').fill(xpub);
  await page.getByRole('button', { name: 'Load UTXOs' }).click();

  // Wait for UTXOs to load
  await page.waitForSelector('[data-testid="utxo-item"]');
  
  // Select first UTXO
  const firstUtxo = page.locator('[data-testid="utxo-item"]').first();
  await firstUtxo.click();

  // Enter name details
  await page.getByPlaceholder('Enter name').fill(nameId);
  await page.getByPlaceholder('Enter value').fill(nameValue);

  // Upload image
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Upload Image').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(testImage);

  // Wait for image upload and metadata creation
  await page.waitForSelector('text=Metadata created successfully');

  // Generate PSBT
  await page.getByRole('button', { name: 'Generate PSBT' }).click();
  
  // Get PSBT data
  const psbtBase64 = await page.locator('[data-testid="psbt-data"]').textContent();
  
  // Sign PSBT
  const signedTxHex = await signPsbt(psbtBase64, seedPhrase);

  // Broadcast transaction (this would need to be implemented in your app)
  const broadcastResponse = await page.evaluate(async (signedTxHex, electrumUrl) => {
    return await fetch(`${electrumUrl}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({ tx: signedTxHex })
    });
  }, signedTxHex, electrumUrl);

  // Verify broadcast was successful
  expect(broadcastResponse.status).toBe(200);
  
  // Verify name appears in the list
  await page.getByPlaceholder('Find name...').fill(nameId);
  await expect(page.locator(`text=${nameId}`)).toBeVisible(); */
}); 