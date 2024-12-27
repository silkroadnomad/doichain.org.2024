import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateNameIdHTML, getNameIdData } from '../src/lib/doichain/namePage.js';
import { nameShow } from '../src/lib/doichain/nameShow.js';
import { getMetadataFromIPFS } from '../src/lib/doichain/nfc/getMetadataFromIPFS.js';

// Mock dependencies
vi.mock('../src/lib/doichain/nameShow.js');
vi.mock('../src/lib/doichain/nfc/getMetadataFromIPFS.js');

describe('namePage.js', () => {
    describe('generateNameIdHTML', () => {
        it('should generate valid HTML with proper meta tags', async () => {
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

        it('should properly sanitize HTML input', async () => {
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

    describe('getNameIdData', () => {
        beforeEach(() => {
            // Reset mocks
            vi.resetAllMocks();
        });

        it('should retrieve and format nameId data correctly', async () => {
            // Mock nameShow response
            nameShow.mockResolvedValue([{
                formattedBlocktime: '2024-01-27',
                nameValue: 'ipfs://QmMetadata123'
            }]);

            // Mock getMetadataFromIPFS response
            getMetadataFromIPFS.mockResolvedValue({
                description: 'Test description',
                image: 'ipfs://QmImage123'
            });

            const result = await getNameIdData(
                {}, // mock electrum client
                {}, // mock helia client
                'test-name'
            );

            expect(result).toEqual({
                blockDate: '2024-01-27',
                description: 'Test description',
                imageCid: 'QmImage123'
            });

            // Verify function calls
            expect(nameShow).toHaveBeenCalledWith({}, 'test-name');
            expect(getMetadataFromIPFS).toHaveBeenCalledWith({}, 'ipfs://QmMetadata123');
        });

        it('should handle missing data appropriately', async () => {
            nameShow.mockResolvedValue([]);

            await expect(getNameIdData({}, {}, 'test-name'))
                .rejects
                .toThrow('No transactions found for nameId: test-name');
        });
    });
});
