import { describe, it, expect, vi } from 'vitest';
import { writeNameIdHTMLToIPFS } from '../src/lib/components/nameDoi.svelte';

// Mock unixfs and publishCID
vi.mock('@helia/unixfs', () => ({
	unixfs: vi.fn().mockReturnValue({
		addBytes: vi.fn().mockResolvedValue({ toString: () => 'QmTestCID123' })
	})
}));

describe('nameDoi.svelte', () => {
	it('writeNameIdHTMLToIPFS returns a valid CID', async () => {
		const cid = await writeNameIdHTMLToIPFS('testName', '2023-10-05', 'description', 'QmXYZ123');
		expect(cid).toMatch(/^Qm/); // simple CID check
		expect(typeof cid).toBe('string');
		expect(cid.length).toBeGreaterThan(0);
	});
});
