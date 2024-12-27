import { browser } from '$app/environment';

export const prerender = true;
export const ssr = true;

export async function load({ params }) {
  const { nameId } = params;
  let metadata = {
    title: `${nameId} - Doichain Name Details`,
    description: `View details for ${nameId} on Doichain`,
    image: '',
    url: `/${nameId}`
  };

  // Only attempt to fetch metadata on the client side
  if (browser) {
    try {
      const { electrumClient, helia } = await import('$lib/doichain/doichain-store.js');
      const { nameShow } = await import('$lib/doichain/nameShow.js');
      const { getMetadataFromIPFS } = await import('$lib/doichain/nfc/getMetadataFromIPFS.js');
      const { getImageUrlFromIPFS } = await import('$lib/doichain/nfc/getImageUrlFromIPFS.js');

      const results = await nameShow(electrumClient, nameId);
      if (results?.length > 0 && results[0].scriptPubKey.nameOp) {
        const nft = await getMetadataFromIPFS(helia, results[0].scriptPubKey.nameOp.value);
        metadata.title = `${nameId} - ${nft.name || 'Doichain Name Details'}`;
        metadata.description = nft.description || `View details for ${nameId} on Doichain`;
        if (nft.image) {
          metadata.image = await getImageUrlFromIPFS(helia, nft.image);
        }
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
    }
  }

  return {
    nameId,
    metadata
  };
}
