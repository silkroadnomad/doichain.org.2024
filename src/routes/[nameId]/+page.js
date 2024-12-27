import { electrumClient, helia } from '$lib/doichain/doichain-store.js';
import { nameShow } from '$lib/doichain/nameShow.js';
import { getMetadataFromIPFS } from '$lib/doichain/nfc/getMetadataFromIPFS.js';
import { getImageUrlFromIPFS } from '$lib/doichain/nfc/getImageUrlFromIPFS.js';

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

  try {
    const results = await nameShow(electrumClient, nameId);
    if (results.length > 0 && results[0].scriptPubKey.nameOp) {
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

  return {
    nameId,
    metadata
  };
}
