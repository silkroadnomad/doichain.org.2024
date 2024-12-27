import { test, expect } from '@playwright/test';

/**
 * @typedef {Object} MetaTag
 * @property {string} property
 * @property {string} content
 */

test.describe('NameId Page', () => {
    test.beforeEach(async ({ page }) => {
        // Wait for IPFS initialization
        await page.waitForTimeout(5000);
    });

    test('should display nameId details and meta tags', async ({ page }) => {
        // Navigate to a nameId page and wait for client-side routing
        await page.goto('http://localhost:5173/');
        
        // Wait for page to be ready with IPFS initialization
        await page.waitForFunction(() => {
            const container = document.querySelector('[data-testid="name-show-container"]');
            return container && window.getComputedStyle(container).display !== 'none';
        }, { timeout: 60000 });
        
        // Set the hash and wait for navigation
        await page.evaluate(() => {
            window.location.hash = '#/test-name-123';
        });
        
        // Wait for container to be visible first
        const container = await page.waitForSelector('[data-testid="name-show-container"]', { 
            state: 'visible',
            timeout: 60000  // Extended timeout for IPFS operations
        });
        expect(container).toBeTruthy();

        // Get meta tags using data-testid attributes
        const title = await page.$eval('[data-testid="meta-title"]', el => el.getAttribute('content'));
        const description = await page.$eval('[data-testid="meta-description"]', el => el.getAttribute('content'));
        const image = await page.$eval('[data-testid="meta-image"]', el => el.getAttribute('content'));
        const twitterCard = await page.$eval('[data-testid="meta-twitter-card"]', el => el.getAttribute('content'));

        // Verify meta tags exist and have correct format
        expect(title).toBeTruthy();
        expect(description).toBeTruthy();
        expect(image).toBeTruthy();
        expect(twitterCard).toBeTruthy();

        // Verify image URL is either IPFS gateway URL or fallback image
        const imageUrl = await page.$eval('img', el => el.getAttribute('src'));
        expect(imageUrl).toMatch(/^(https:\/\/ipfs\.le-space\.de\/ipfs\/Qm|\/doichain_logo-min\.svg|https:\/\/doichain\.org\/favicon\.png)/);
    });

    test('should handle search functionality', async ({ page }) => {
        await page.goto('http://localhost:5173/');
        
        // Wait for page to be ready with all elements visible
        await page.waitForFunction(() => {
            const input = document.querySelector('[data-testid="name-search-input"]');
            const button = document.querySelector('[data-testid="name-search-button"]');
            return input && button && 
                   window.getComputedStyle(input).display !== 'none' &&
                   window.getComputedStyle(button).display !== 'none';
        }, { timeout: 60000 });

        const input = await page.waitForSelector('[data-testid="name-search-input"]', { 
            state: 'visible',
            timeout: 60000 
        });
        expect(input).toBeTruthy();
        
        const button = await page.waitForSelector('[data-testid="name-search-button"]', { 
            state: 'visible',
            timeout: 60000 
        });
        expect(button).toBeTruthy();
        
        // Fill search input and click button
        await input.fill('test-name');
        await button.click();
        
        // Wait for results
        const container = await page.waitForSelector('[data-testid="name-show-container"]', {
            state: 'visible',
            timeout: 10000
        });
        
        // Verify results are displayed
        expect(container).toBeTruthy();
    });

    test('should handle invalid nameId gracefully', async ({ page }) => {
        // Navigate to an invalid nameId
        await page.goto('http://localhost:5173/#/invalid-name-xyz');
        
        // Wait for container with extended timeout
        const container = await page.waitForSelector('[data-testid="name-show-container"]', { 
            state: 'visible',
            timeout: 60000 
        });
        expect(container).toBeTruthy();
        
        // Wait for error message to appear
        const errorText = await page.textContent('[data-testid="name-show-container"]', { timeout: 60000 });
        expect(errorText).toBeTruthy();
        expect(errorText).toContain('No NameId found for given entry');
    });

    test('should verify IPFS publishing workflow', async ({ page }) => {
        // Navigate to name registration page
        await page.goto('http://localhost:5173/');
        
        // Wait for essential elements with extended timeouts for IPFS
        const input = await page.waitForSelector('[data-testid="name-search-input"]', { 
            state: 'visible',
            timeout: 60000 
        });
        expect(input).toBeTruthy();
        
        const button = await page.waitForSelector('[data-testid="name-search-button"]', { 
            state: 'visible',
            timeout: 60000 
        });
        expect(button).toBeTruthy();
        
        // Fill search input and click button
        await input.fill('test-name-ipfs');
        await button.click();
        
        // Wait for IPFS processing with increased timeout
        const container = await page.waitForSelector('[data-testid="name-show-container"]', {
            state: 'visible',
            timeout: 30000
        });
        
        // Verify container exists and has content
        expect(container).toBeTruthy();
        const content = await container.textContent();
        expect(content).toContain('test-name-ipfs');
    });
});
