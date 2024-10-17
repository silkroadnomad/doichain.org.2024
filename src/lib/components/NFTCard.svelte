<script lang="ts">
    import { getMetadataFromIPFS } from "$lib/doichain/nfc/getMetadataFromIPFS.js";
    import { getImageUrlFromIPFS } from "$lib/doichain/nfc/getImageUrlFromIPFS.js";
    import { helia, connectedPeers } from "../doichain/doichain-store.js";
    import { adaptNameOp } from "$lib/doichain/utxoHelpers.js";
    import moment from 'moment';

    export let currentNameOp
    export let currentNameUtxo;

    let nftMetadata = null;
    let imageUrl = null;
    let showDetails = false;
    let isIPFS = false;

    $: {
        if (currentNameOp.nameId) {
            currentNameOp = adaptNameOp(currentNameOp) 
            currentNameUtxo = currentNameOp.currentNameUtxo;
        }
        
        isIPFS = typeof currentNameOp.value === 'string' && currentNameOp.value.startsWith('ipfs://');
        if (isIPFS) {
            loadNFTData();
            showDetails = false;
        } else {
            showDetails = false;
        }
    }

    async function loadNFTData() {
        try {
            nftMetadata = await getMetadataFromIPFS($helia, currentNameOp.value);
            if (nftMetadata && nftMetadata.image) {
                const newImageUrl = await getImageUrlFromIPFS($helia, nftMetadata.image);
                if (newImageUrl) {
                    imageUrl = newImageUrl;
                }
            }
        } catch (error) {
            console.error("Error loading NFT data:", error);
        }
    }

    function isConfirmedDOI(nameOp) {
        if (typeof nameOp.value === 'string') {
            try {
                const valueObj = JSON.parse(nameOp.value);
                return valueObj.doiSignature && valueObj.doiTimestamp;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    $: cardBackgroundColor = 
        currentNameOp?.name?.startsWith('e/') 
            ? (isConfirmedDOI(currentNameOp) ? 'bg-green-100' : 'bg-yellow-100')
            : currentNameOp?.name?.startsWith('pe/') || currentNameOp?.name?.startsWith('poe/')
                ? 'bg-orange-100'
                : currentNameOp?.name?.startsWith('nft/')
                    ? 'bg-blue-100'
                    : 'bg-gray-800'; // Dark background for non-standard nameOps

    $: textColor = cardBackgroundColor === 'bg-gray-800' ? 'text-white' : 'text-gray-800';

    $:console.log(currentNameOp)
</script>

<div class="{cardBackgroundColor} {textColor} rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow duration-300">
    <div class="mb-4">
        <h2 class="text-xl font-semibold" title={currentNameOp?.name ?? ''}>
            {(currentNameOp?.name ?? '').slice(0, 19)}
        </h2>
    </div>

    <div class="p-6">
        <p class="block font-sans text-sm antialiased font-normal leading-normal opacity-75">
            {#if currentNameOp?.name?.startsWith('e/')}
                {#if isConfirmedDOI(currentNameOp)}
                    <span class="font-semibold">Email Double Opt-In (Confirmed)</span>
                {:else}
                    <span class="font-semibold">Email Double Opt-In (Requested)</span>
                {/if}
            {:else if currentNameOp?.name?.startsWith('pe/') || currentNameOp?.name?.startsWith('poe/')}
                <span class="font-semibold">Proof-Of-Existence</span>
            {:else if currentNameOp?.name?.startsWith('nft/')}
                <span class="font-semibold">NFT</span>
            {:else if isIPFS}
                <span class="font-semibold">IPFS content</span>
            {:else}
                <span class="font-semibold">Non-Standard NameOp</span>
            {/if}
        </p>
        <p class="mt-2 text-xs opacity-75">
            {currentNameOp?.currentNameUtxo?.formattedBlocktime}
        </p>
    </div>

    <div class="p-6 pt-0">
        <button
            class="align-middle select-none font-sans font-bold text-center uppercase transition-all disabled:opacity-50 disabled:shadow-none disabled:pointer-events-none text-xs py-3 px-6 rounded-lg shadow-gray-900/10 hover:shadow-gray-900/20 focus:opacity-[0.85] active:opacity-[0.85] active:shadow-none block w-full bg-blue-gray-900/10 shadow-none hover:scale-105 hover:shadow-none focus:scale-105 focus:shadow-none active:scale-100"
            type="button">
            Buy with DoiWallet
        </button>
    </div>
</div>
