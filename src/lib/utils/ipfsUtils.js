// src/lib/utils/ipfsUtils.js
import { getMetadataFromIPFS } from '$lib/doichain/nfc/getMetadataFromIPFS.js';
import { getImageUrlFromIPFS } from '$lib/doichain/nfc/getImageUrlFromIPFS.js';

export async function getLicenseData(helia, ipfsUrl) {
    try {
        const metadata = await getMetadataFromIPFS(helia, ipfsUrl);
        let imageUrl = null;
        let imageUrls = [];
        if (metadata && metadata.image) {
            imageUrl = await getImageUrlFromIPFS(helia, metadata.image);
        }
        if (metadata && metadata.images) {
            imageUrls = await Promise.all(
                metadata.images.map(async (image) => {
                    try {
                        return await getImageUrlFromIPFS(helia, image);
                    } catch (err) {
                        console.error(`Error loading image: ${image}`, err);
                        return null;
                    }
                })
            );
        }
        return { metadata, imageUrl, imageUrls };
    } catch (error) {
        console.error('Error fetching license data:', error);
        return { metadata: null, imageUrl: null, imageUrls: [] };
    }
}
