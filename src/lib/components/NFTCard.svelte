<script lang="ts">
	import { getMetadataFromIPFS } from '$lib/doichain/nfc/getMetadataFromIPFS.js';
	import { getImageUrlFromIPFS } from '$lib/doichain/nfc/getImageUrlFromIPFS.js';
	import { helia, connectedPeers } from '../doichain/doichain-store.js';
	import { adaptNameOp } from '$lib/doichain/utxoHelpers.js';
	import moment from 'moment';
	import { Button, SimpleGrid, Notification } from '@svelteuidev/core';
	import { createEventDispatcher } from 'svelte';

	export let currentNameOp;
	export let currentNameUtxo;
	const defaultImageUrl =
		'https://images.unsplash.com/photo-1629367494173-c78a56567877?ixlib=rb-4.0.3&amp;ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;auto=format&amp;fit=crop&amp;w=927&amp;q=80';

	let nftMetadata = null;
	let imageUrl = null;
	let showDetails = false;
	let isIPFS = false;
	let showTransactionDetails = false;
	let currentSlideIndex = 0;
	let imageUrls = [];

	$: {
		if (currentNameOp.nameId) {
			currentNameOp = adaptNameOp(currentNameOp);
			currentNameUtxo = currentNameOp.currentNameUtxo;
		} else {
			currentNameOp.currentNameUtxo = currentNameUtxo;
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
			if (nftMetadata) {
				// Handle single image
				if (nftMetadata.image) {
					const newImageUrl = await getImageUrlFromIPFS($helia, nftMetadata.image);
					if (newImageUrl) {
						imageUrl = newImageUrl;
						imageUrls = [newImageUrl];
					}
				}
				// Handle multiple images for collections
				if (nftMetadata.images && Array.isArray(nftMetadata.images)) {
					imageUrls = await Promise.all(
						nftMetadata.images.map(async (imgUrl) => {
							try {
								return await getImageUrlFromIPFS($helia, imgUrl);
							} catch (err) {
								console.error('Error loading collection image:', err);
								return null;
							}
						})
					);
					imageUrls = imageUrls.filter(url => url !== null);
					if (imageUrls.length > 0) {
						imageUrl = imageUrls[0];
					}
				}
			}
		} catch (error) {
			console.error('Error loading NFT data:', error);
		}
	}

	function nextSlide() {
		if (imageUrls.length > 1) {
			currentSlideIndex = (currentSlideIndex + 1) % imageUrls.length;
			imageUrl = imageUrls[currentSlideIndex];
		}
	}

	function prevSlide() {
		if (imageUrls.length > 1) {
			currentSlideIndex = (currentSlideIndex - 1 + imageUrls.length) % imageUrls.length;
			imageUrl = imageUrls[currentSlideIndex];
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
		? isConfirmedDOI(currentNameOp)
			? 'bg-green-100'
			: 'bg-yellow-100'
		: currentNameOp?.name?.startsWith('pe/') || currentNameOp?.name?.startsWith('poe/')
			? 'bg-orange-100'
			: currentNameOp?.name?.startsWith('nft/')
				? 'bg-blue-100'
				: 'bg-gray-800'; // Dark background for non-standard nameOps

	$: textColor = cardBackgroundColor === 'bg-gray-800' ? 'text-white' : 'text-gray-800';

	function toggleTransactionDetails() {
		showTransactionDetails = !showTransactionDetails;
	}

	let showNotification = false;
	let notificationMessage = '';

	function copyToClipboard(text, label) {
		navigator.clipboard
			.writeText(text)
			.then(() => {
				notificationMessage = `${label} copied to clipboard: ${text}`;
				showNotification = true;
				setTimeout(() => {
					showNotification = false;
				}, 3000);
				console.log('Copied to clipboard:', text);
			})
			.catch((err) => {
				console.error('Failed to copy: ', err);
			});
	}

	export let overWriteValue;

	function handleOverwrite() {
		console.log('handleOverwrite', currentNameOp.name);
		window.scrollTo({
			top: 0,
			behavior: 'smooth'
		});
		overWriteValue = currentNameOp.name;
	}
</script>

<div class="nft-card bg-white rounded-lg shadow-md overflow-hidden max-w-sm mx-auto">
	<div
		class="{cardBackgroundColor} {textColor} rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow duration-300 flex flex-col h-full"
	>
		<div class="mb-4">
			<h2 class="text-xl font-semibold" title={currentNameOp?.name ?? ''}>
				{(currentNameOp?.name ?? '').slice(0, 19)}
			</h2>
		</div>

		{#if isIPFS}
			<div
				class="relative mx-4 mt-4 overflow-hidden text-gray-700 bg-white bg-clip-border rounded-xl aspect-square"
			>
				<img src={imageUrl || defaultImageUrl} alt="NFT image" class="object-cover w-full h-full" />
				{#if imageUrls.length > 1}
					<div class="absolute inset-x-0 bottom-0 flex justify-between p-4 bg-black bg-opacity-50">
						<button
							class="px-3 py-1 text-white bg-gray-800 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
							on:click={prevSlide}
						>
							←
						</button>
						<span class="text-white">
							{currentSlideIndex + 1} / {imageUrls.length}
						</span>
						<button
							class="px-3 py-1 text-white bg-gray-800 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
							on:click={nextSlide}
						>
							→
						</button>
					</div>
				{/if}
			</div>
			<div class="p-6">
				<div class="flex items-center justify-between mb-2">
					<p class="block font-sans text-base antialiased font-medium leading-relaxed">
						{currentNameOp?.name}
					</p>
				</div>
				<p class="block font-sans text-sm antialiased font-normal leading-normal opacity-75">
					{#if nftMetadata}
						<p>Name: {nftMetadata.name || 'not available'}</p>
						<p>Description: {nftMetadata.description || 'not available'}</p>
					{:else}
						<p>Loading NFT data from {$connectedPeers.length} peers...</p>
					{/if}
				</p>
			</div>
		{/if}

		<div class="p-6 flex-grow">
			<p class="block font-sans text-sm antialiased font-normal leading-normal opacity-75">
				{#if currentNameOp?.name?.startsWith('e/')}
					{#if isConfirmedDOI(currentNameOp)}
						<span class="font-semibold">Email Double Opt-In (confirmed)</span>
					{:else}
						<span class="font-semibold">Email Double Opt-In (requested)</span>
					{/if}
				{:else if currentNameOp?.name?.startsWith('pe/') || currentNameOp?.name?.startsWith('poe/')}
					<span class="font-semibold">Proof-Of-Existence</span>
				{:else if isIPFS}
					<span class="font-semibold">Non Fungible Coin</span>
				{:else}
					<span class="font-semibold">Non-Standard NameOp</span>
				{/if}
			</p>
			<p class="mt-2 text-xs opacity-75">
				{#if currentNameOp?.currentNameUtxo?.formattedBlocktime}
					{currentNameOp.currentNameUtxo.formattedBlocktime}
				{:else if currentNameOp?.blocktime}
					{moment.unix(currentNameOp.blocktime).format('YYYY-MM-DD HH:mm:ss')}
				{:else}
					Timestamp not available
				{/if}
			</p>
		</div>

		<div class="p-6 pt-0 mt-auto">
			<button
				class="align-middle select-none font-sans font-bold text-center uppercase transition-all disabled:opacity-50 disabled:shadow-none disabled:pointer-events-none text-xs py-3 px-6 rounded-lg shadow-gray-900/10 hover:shadow-gray-900/20 focus:opacity-[0.85] active:opacity-[0.85] active:shadow-none block w-full bg-blue-gray-900/10 shadow-none"
				type="button"
			>
				Buy with DoiWallet
			</button>
			<Button variant="light" color="blue" fullSize on:click={toggleTransactionDetails}>
				{showTransactionDetails ? 'Hide' : 'Show'} Transaction Details
			</Button>
		</div>

		{#if showTransactionDetails}
			<div class="p-4 bg-gray-100 transaction-details text-xs sm:text-sm">
				<SimpleGrid cols={2}>
					<div class="font-semibold text-xs sm:text-sm">wallet address:</div>
					<div
						class="clickable text-xs sm:text-sm"
						on:click={() =>
							copyToClipboard(
								currentNameOp?.address
									? currentNameOp.address
									: currentNameOp?.currentNameUtxo?.scriptPubKey?.addresses[0] || 'N/A'
							)}
					>
						{currentNameOp?.address
							? currentNameOp.address
							: currentNameOp?.currentNameUtxo?.scriptPubKey?.addresses[0] || 'N/A'}
					</div>
					<div class="font-semibold text-xs sm:text-sm">txid:</div>
					<div
						class="clickable text-xs sm:text-sm"
						on:click={() =>
							copyToClipboard(currentNameOp.currentNameUtxo?.txid || 'N/A', 'Transaction ID')}
					>
						{currentNameOp.currentNameUtxo?.txid || 'N/A'}
					</div>
					<div class="font-semibold text-xs sm:text-sm">time:</div>
					<div class="clickable text-xs sm:text-sm">
						{currentNameOp.currentNameUtxo?.formattedBlocktime || 'N/A'}
					</div>
					<div class="font-semibold text-xs sm:text-sm">name:</div>
					<div
						class="clickable text-xs sm:text-sm"
						on:click={() => copyToClipboard(currentNameOp.name || 'N/A', 'Name')}
					>
						{currentNameOp.name || 'N/A'}
					</div>
					<div class="font-semibold text-xs sm:text-sm">value:</div>
					<div
						class="clickable text-xs sm:text-sm"
						on:click={() => copyToClipboard(currentNameOp.value || 'N/A', 'Value')}
					>
						{currentNameOp.value || 'N/A'}
					</div>
					<div class="font-semibold text-xs sm:text-sm">DOI amount:</div>
					<div
						class="clickable text-xs sm:text-sm"
						on:click={() =>
							copyToClipboard(currentNameOp.currentNameUtxo?.value || 'N/A', 'DOI amount')}
					>
						{currentNameOp.currentNameUtxo?.value || 'N/A'}
					</div>
				</SimpleGrid>

				<div class="mt-4">
					<Button variant="filled" color="red" fullSize on:click={handleOverwrite}>
						Overwrite
					</Button>
				</div>
			</div>
		{/if}

		{#if showNotification}
			<Notification
				withCloseButton={false}
				color="teal"
				position="top-center"
				transition="slide-down"
			>
				{notificationMessage}
			</Notification>
		{/if}
	</div>
</div>

<style>
	:global(.max-w-sm) {
		max-width: 24rem;
	}

	.transaction-details {
		font-size: 0.25rem;
		line-height: 1.2;
		color: #333;
		background-color: #f8f9fa;
		border-top: 1px solid #e9ecef;
	}

	:global(.transaction-details .svelte-simple-grid) {
		gap: 0.5rem;
	}

	.transaction-details :global(.svelte-simple-grid > div) {
		padding: 0.25rem;
		overflow-wrap: break-word;
		word-break: break-all;
	}

	.transaction-details :global(.svelte-simple-grid > div:nth-child(odd)) {
		background-color: #e9ecef;
	}

	.clickable {
		cursor: pointer;
		transition: background-color 0.3s ease;
	}

	.clickable:hover {
		background-color: #e2e8f0;
	}

	.clickable:active {
		background-color: #cbd5e0;
	}

	.nft-card {
		transform: scale(1) !important;
	}

	.transaction-details .clickable {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 150px; /* Adjust based on your needs */
	}

	.transaction-details .clickable:hover {
		white-space: normal;
		word-break: break-all;
		position: relative;
		z-index: 1;
		background-color: #fff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 2px 4px;
	}
</style>
