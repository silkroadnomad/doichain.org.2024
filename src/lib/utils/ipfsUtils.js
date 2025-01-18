// src/lib/utils/ipfsUtils.js
import { getMetadataFromIPFS, getImageUrlFromIPFS } from 'doi-js';

export async function getNFTData(helia, ipfsUrl) {
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
        console.error('Error fetching NFT data:', error);
        return { metadata: null, imageUrl: null, imageUrls: [] };
    }
}
