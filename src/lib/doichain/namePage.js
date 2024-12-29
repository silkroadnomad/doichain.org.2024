import { nameShow } from './nameShow.js';
import { getMetadataFromIPFS } from './nfc/getMetadataFromIPFS.js';

/**
 * Retrieves all necessary data for a nameId HTML page
 * @param {Object} electrumClient - The Electrum client instance
 * @param {Object} helia - The Helia IPFS client
 * @param {string} nameId - The name identifier to fetch data for
 * @returns {Promise<Object>} Object containing blockDate, description, and imageCid
 */
export async function getNameIdData(electrumClient, helia, nameId) {
	try {
		// Get name transactions
		const nameResults = await nameShow(electrumClient, nameId);
		if (!nameResults || nameResults.length === 0) {
			throw new Error(`No transactions found for nameId: ${nameId}`);
		}
		console.log('nameResults', nameResults);
		// Get the most recent transaction
		const latestTx = nameResults[0];
		console.log('latestTx', latestTx);
		const blockDate = latestTx.formattedBlocktime;
		console.log('blockDate', blockDate);
		// Get metadata from IPFS
		const tokenURI = latestTx.scriptPubKey?.nameOp?.value;
		if (!tokenURI || !tokenURI.startsWith('ipfs://')) {
			throw new Error(`Invalid token URI for nameId: ${nameId}`);
		}
		console.log('tokenURI', tokenURI);
		const metadata = await getMetadataFromIPFS(helia, tokenURI);
		console.log('metadata', metadata);
		// Extract image CID from ipfs:// URL
		const imageCid = metadata.image.split('//')[1];

		return {
			blockDate,
			description: metadata.description,
			imageCid
		};
	} catch (error) {
		console.error('Error in getNameIdData:', error);
		throw error;
	}
}

/**
 * Generates a complete HTML page for a nameId with proper meta tags and content structure
 * @param {string} nameId - The name identifier
 * @param {string} blockDate - The date from the blockchain
 * @param {string} description - Description of the name
 * @param {string} imageUrl - URL of the associated image
 * @returns {string} Complete HTML document as a string
 */
export async function generateNameIdHTML(nameId, blockDate, description, imageUrl) {
	// Convert IPFS URLs to gateway URLs
	const getGatewayUrl = (url) => {
		if (url.startsWith('ipfs://')) {
			const cid = url.replace('ipfs://', '');
			return `https://ipfs.le-space.de/ipfs/${cid}`;
		}
		return url;
	};

	// Sanitize inputs to prevent XSS
	const sanitize = (str) =>
		str.replace(
			/[&<>"']/g,
			(char) =>
				({
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;'
				})[char]
		);

	const safeNameId = sanitize(nameId);
	const safeDesc = description ? sanitize(description) : '';
	const safeImageUrl = imageUrl ? sanitize(getGatewayUrl(imageUrl)) : '';
	const safeBlockDate = blockDate ? sanitize(blockDate) : '';

	const currentServerUrl = window.location.origin; // Get the current server URL

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeNameId} - Doichain</title>
    
    <!-- Primary Meta Tags -->
    <meta name="title" content="${safeNameId} - Doichain">
    <meta name="description" content="${safeDesc}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://www.doichain.org/name/${safeNameId}">
    <meta property="og:title" content="${safeNameId} - Doichain">
    <meta property="og:description" content="${safeDesc}">
    <meta property="og:image" content="${safeImageUrl}">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://www.doichain.org/name/${safeNameId}">
    <meta property="twitter:title" content="${safeNameId} - Doichain">
    <meta property="twitter:description" content="${safeDesc}">
    <meta property="twitter:image" content="${safeImageUrl}">
    
    <link rel="canonical" href="https://www.doichain.org" />
    
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 1rem;
            color: #333;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 2rem 0;
        }
        footer {
            margin-top: 3rem;
            padding-top: 1rem;
            border-top: 1px solid #eee;
            text-align: center;
        }
        a {
            color: #0066cc;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .block-date {
            color: #666;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <main>
        <h1>${safeNameId}</h1>
        <p>${safeDesc}</p>
        <img src="${safeImageUrl}" alt="${safeNameId}">
        <p class="block-date">Block date: ${safeBlockDate}</p>
    </main>
    <footer>
        <p><a href="${currentServerUrl}/#/${safeNameId}">Buy this Doichain NFC and others here!</a></p>
    </footer>
</body>
</html>`;

	return html;
}
