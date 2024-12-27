import { describe, it, expect, vi } from 'vitest';
import { generateNameIdHTML } from '../src/lib/doichain/namePage.js';

describe('namePage HTML Generation', () => {
    it('generates valid HTML with proper meta tags', async () => {
        const nameId = 'test-name';
        const blockDate = '2024-01-27';
        const description = 'Test description';
        const imageUrl = 'ipfs://QmTest123';

        const html = await generateNameIdHTML(nameId, blockDate, description, imageUrl);

        // Verify HTML structure
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html lang="en">');
        
        // Verify meta tags
        expect(html).toContain('<meta property="og:title"');
        expect(html).toContain('<meta property="twitter:card"');
        
        // Verify gateway URL conversion
        expect(html).toContain('https://ipfs.le-space.de/ipfs/QmTest123');
        
        // Verify content
        expect(html).toContain(nameId);
        expect(html).toContain(description);
        expect(html).toContain(blockDate);
    });

    it('properly sanitizes HTML input', async () => {
        const nameId = '<script>alert("xss")</script>';
        const blockDate = '2024-01-27';
        const description = '<img src="x" onerror="alert(1)">';
        const imageUrl = 'ipfs://QmTest123';

        const html = await generateNameIdHTML(nameId, blockDate, description, imageUrl);

        // Verify XSS prevention
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('onerror=');
        expect(html).toContain('&lt;script&gt;');
    });
});
