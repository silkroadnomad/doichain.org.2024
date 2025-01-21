import { unixfs } from '@helia/unixfs';
import { publishCID } from '$lib/doichain/nameDoi.js';

/**
 * Generates and publishes an HTML page for a nameId to IPFS
 * @param {Object} helia - Helia instance
 * @param {string} nameId - The name identifier
 * @param {string} blockDate - The date from the blockchain
 * @param {string} description - Description of the name
 * @param {string} imageCid - IPFS CID of the associated image
 * @returns {Promise<string>} The IPFS CID of the generated HTML page
 */
export async function writeNameIdHTMLToIPFS(helia, nameId, blockDate, description, imageCid) {
    const encoder = new TextEncoder();
    const fs = unixfs(helia);

    try {
        const { generateNameIdHTML } = await import('$lib/doichain/namePage.js');
        const htmlString = await generateNameIdHTML(
            nameId,
            blockDate,
            description,
            `https://ipfs.le-space.de/ipfs/${imageCid}`
        );

        const cid = await fs.addBytes(encoder.encode(htmlString));
        console.log('Added nameId HTML to IPFS:', cid.toString());

        await publishCID(cid.toString());

        return cid.toString();
    } catch (error) {
        console.error('Error in writeNameIdHTMLToIPFS:', error);
        throw error;
    }
} 