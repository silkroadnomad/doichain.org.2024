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

    $: cardBackgroundColor = currentNameOp?.name?.startsWith('e/') 
        ? (isConfirmedDOI(currentNameOp) ? 'bg-green-100' : 'bg-yellow-100')
        : 'bg-blue-100';

    $:console.log(currentNameOp)
</script>

<div class="{cardBackgroundColor} rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow duration-300">
    <div class="mb-4">
        <h2 class="text-xl font-semibold text-gray-800" title={currentNameOp?.name ?? ''}>
            {(currentNameOp?.name ?? '').slice(0, 20)}
        </h2>
    </div>

    {#if isIPFS}
        <div class="relative mx-4 mt-4 overflow-hidden text-gray-700 bg-white bg-clip-border rounded-xl h-96">
            <img src={imageUrl} alt="NFT image" class="object-cover w-full h-full" />
        </div>
        <div class="p-6">
            <p class="block font-sans text-sm antialiased font-normal leading-normal text-gray-700 opacity-75">
                {#if nftMetadata}
                    <p>NFC: {nftMetadata.name}</p>
                    <p>Description: {nftMetadata.description}</p>
                {:else}
                    <p>Loading NFT data from {$connectedPeers} peers...</p>
                {/if}
            </p>
        </div>
    {:else}
        <div class="p-6">
            <p class="block font-sans text-sm antialiased font-normal leading-normal text-gray-700 opacity-75">
            {#if currentNameOp?.name?.startsWith('e/')}
                {#if isConfirmedDOI(currentNameOp)}
                    <span class="font-semibold">Confirmed Email Double Opt-In</span>
                {:else}
                    <span class="font-semibold">Requested Email Double Opt-In</span>
                {/if}
            {:else if currentNameOp?.name?.startsWith('pe/') || currentNameOp?.name?.startsWith('poe/')}
                <span class="font-semibold">Proof-Of-Existence</span>
            {:else if currentNameOp?.name?.startsWith('nft/')}
                <span class="font-semibold">NFT</span>
            {:else if isIPFS}
                <span class="font-semibold">IPFS content</span>
            {:else}
                <span class="font-semibold">Non-Standard NameOp</span> {currentNameOp?.name}  
            {/if}
            </p>
            <p class="mt-2 text-xs text-gray-600">
                Block time: {currentNameOp?.blocktime ? moment.unix(currentNameOp.blocktime).format('YYYY-MM-DD HH:mm:ss') : 'Unknown date'}
            </p>
        </div>
    {/if}

    <div class="p-6 pt-0">
        <button
            on:click={() => showDetails = !showDetails}
            class="mb-2 w-full text-sm text-blue-500 hover:text-blue-700"
            type="button">
            {showDetails ? 'Hide' : 'Show'} Details
        </button>
        {#if showDetails}
            <div class="text-xs mb-4 max-h-40 overflow-y-auto">
                <div class="space-y-1 overflow-y-auto">
                    <div class="text-gray-600 whitespace-nowrap">
                        wallet address: <span class="text-gray-800">{currentNameUtxo?.scriptPubKey?.addresses?.[0]}</span>
                    </div>
                    <div class="text-gray-600 whitespace-nowrap">
                        txid: <span class="text-gray-800">{currentNameUtxo?.txid}</span>
                    </div>
                    <div class="text-gray-600 whitespace-nowrap">
                        block time: <span class="text-gray-800">{currentNameUtxo?.formattedBlocktime}</span>
                    </div>
                    <div class="text-gray-600 whitespace-nowrap overflow-x-auto">
                        expires: <span class="text-gray-800">{currentNameUtxo?.expires}</span>
                    </div>
                    <div class="text-gray-600 whitespace-nowrap">
                        name: <span class="text-gray-800">{currentNameOp?.name}</span>
                    </div>
                    <div class="text-gray-600 whitespace-nowrap">
                        value: <span class="text-gray-800">{currentNameOp?.value}</span>
                    </div>
                    <div class="text-gray-600 whitespace-nowrap">
                        amount (burned): <span class="text-gray-800">{currentNameUtxo?.value} DOI</span>
                    </div>
                </div>
            </div>
        {/if}
        <button
            class="align-middle select-none font-sans font-bold text-center uppercase transition-all disabled:opacity-50 disabled:shadow-none disabled:pointer-events-none text-xs py-3 px-6 rounded-lg shadow-gray-900/10 hover:shadow-gray-900/20 focus:opacity-[0.85] active:opacity-[0.85] active:shadow-none block w-full bg-blue-gray-900/10 text-blue-gray-900 shadow-none hover:scale-105 hover:shadow-none focus:scale-105 focus:shadow-none active:scale-100"
            type="button">
            Buy with DoiWallet
        </button>
    </div>
</div>
