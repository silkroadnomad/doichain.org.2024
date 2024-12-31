<script>
	import { libp2p, nameOps, blockHeight } from '$lib/doichain/doichain-store.js';
	import NameInput from '$lib/components/nameInput.svelte';
	import NFTCard from '$lib/components/NFTCard.svelte';
	import NameDoi from '$lib/components/nameDoi.svelte';
	import { onMount } from 'svelte';
	import { CONTENT_TOPIC } from '$lib/doichain/doichain.js';

	let showHeroSection = true;
	let inputValue = '';
	let currentNameOp = null;
	let currentNameUtxo = null;
	$: updatedCurrentNameOp = currentNameOp;
	$: updatedCurrentNameUtxo = currentNameUtxo;

	let customErrorMessage = "Name ---name--- is already registered! Hit 'Enter' to observe!";
	let customSuccessMessage = "Doichain Name ---name--- is available! Hit 'Enter' to register!";
	let isNameAvailable = false;

	function handleInput(event) {
		inputValue = event.detail;
		if (inputValue.length > 0) {
			showHeroSection = false;
			checkNameAvailability(inputValue);
		}
	}

	let title = `Doichain.org names on chain`;
	let description = 'Simple name registration for Doichain';
	const url = 'ipns://name-on-chain.com';
	let image = '/nasa-Q1p7bh3SHj8-unsplash.jpg';
	const favicon = './favicon.svg';

	const flyAndFade = (node, params) => {
		return {
			delay: params.delay || 0,
			duration: params.duration || 300,
			css: (t) => {
				const y = params.y || 0;
				const opacity = t;
				return `
					transform: translateY(${(1 - t) * y}px);
					opacity: ${opacity};
				`;
			}
		};
	};

	let nameOpsSection;
	let parallaxOffset = 0;
	let gradientProgress = 0;
	let selectedFilter;

	const filters = [
		{ id: 'collections', label: 'Collections' },
		{ id: 'nfc', label: 'Non-Fungible-Coins (NFC)' },
		{ id: 'names', label: 'Names' },
		{ id: 'e', label: 'DOI (e/)' },
		{ id: 'pe', label: 'Proof-Of-Existence (/pe /poe)' },
		{ id: 'bp', label: 'BlockPro (/bp)' },
		{ id: 'all', label: 'All' }
	];

	$: if (selectedFilter) {
		localStorage.setItem('selectedFilter', selectedFilter);
	}
	$: filteredNameOps = $nameOps.filter((nameOp) => {
		//TODO this filter we use on the server

		const hasNameValue =
			nameOp.nameValue &&
			nameOp.nameValue !== '' &&
			nameOp.nameValue !== ' ' &&
			nameOp.nameValue !== 'empty';

		const isNotSpecialPrefix =
			!nameOp.nameId.startsWith('e/') &&
			!nameOp.nameId.startsWith('pe/') &&
			!nameOp.nameId.startsWith('poe/') &&
			!nameOp.nameId.startsWith('nft/') &&
			!nameOp.nameId.startsWith('bp/');

		if (selectedFilter === 'all') return true;
		if (selectedFilter === 'e') return nameOp.nameId.startsWith('e/');
		if (selectedFilter === 'pe')
			return nameOp.nameId.startsWith('pe/') || nameOp.nameId.startsWith('poe/');
		if (selectedFilter === 'bp') return nameOp.nameId.startsWith('bp/');
		if (selectedFilter === 'names') {
			return !hasNameValue && isNotSpecialPrefix;
		}
		if (selectedFilter === 'nfc') {
			return nameOp.nameValue && nameOp.nameValue.startsWith('ipfs://');
		}
		if (selectedFilter === 'collections') {
			return nameOp.nameId.startsWith('collections/');
		}
		return true;
	});

	let isLoading = false;
	let lastRequestTime = 0;
	const DEBOUNCE_DELAY = 1000; // 1 second delay between requests

	onMount(async () => {
		selectedFilter = localStorage.getItem('selectedFilter') || 'other';
		const handleScroll = () => {
			if (nameOpsSection && !isLoading) {
				const rect = nameOpsSection.getBoundingClientRect();
				const viewportHeight = window.innerHeight;
				const visibleHeight = Math.min(
					viewportHeight,
					Math.max(
						0,
						viewportHeight - Math.max(0, rect.top) - Math.max(0, viewportHeight - rect.bottom)
					)
				);
				gradientProgress = visibleHeight / rect.height;
				parallaxOffset = (rect.top - viewportHeight) * 0.5;

				// Check if we're near the bottom and enough time has passed
				const buffer = 100;
				const bottomOfSection = rect.bottom;
				const bottomOfViewport = window.innerHeight;
				const currentTime = Date.now();

				if (
					bottomOfSection - bottomOfViewport - buffer <= 0 &&
					currentTime - lastRequestTime >= DEBOUNCE_DELAY
				) {
					isLoading = true;
					lastRequestTime = currentTime;

					handleFilterClick(selectedFilter);

					// Reset loading state after a delay
					setTimeout(() => {
						isLoading = false;
					}, DEBOUNCE_DELAY);
				}
			}
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	$: gradientStyle = `
		background: linear-gradient(
			135deg,
			#18D685 0%,
			#0390CB ${gradientProgress * 50}%,
			#0B3E74 100%
		);
	`;

	let overWriteValue;
	$: {
		if (overWriteValue) {
			console.log('overwrite handler called', overWriteValue);
			inputValue = overWriteValue;
			currentNameOp = null;
			currentNameUtxo = null;
		}
	}

	function sendPubSubRequest(filter, pageSize = 10, from = 0, dateString = 'LAST') {
		const messageObject = {
			type: 'LIST',
			dateString: dateString,
			pageSize: pageSize,
			from: from,
			filter: filter
		};

		const message = JSON.stringify(messageObject);
		console.log('sending pubsub request', message);

		// Assuming you have a pubsub mechanism to send the message
		$libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode(message));
	}

	let currentFromMap = {
		collections: 0,
		all: 0,
		other: 0,
		names: 0,
		e: 0,
		pe: 0,
		bp: 0
	};

	function handleFilterClick(filterId) {
		selectedFilter = filterId;
		const currentFrom = currentFromMap[selectedFilter] || 0;
		sendPubSubRequest(selectedFilter, 10, currentFrom, 'LAST');
		currentFromMap[selectedFilter] = currentFrom + 5;
	}

	async function checkNameAvailability(name) {
		try {
			const nameExists = $nameOps.some(
				(nameOp) => nameOp.nameId.toLowerCase() === name.toLowerCase()
			);

			isNameAvailable = !nameExists;

			customErrorMessage = customErrorMessage.replace('---name---', name);
			customSuccessMessage = customSuccessMessage.replace('---name---', name);

			return isNameAvailable;
		} catch (error) {
			console.error('Error checking name availability:', error);
			customErrorMessage = 'Error checking name availability. Please try again.';
			return false;
		}
	}
</script>

<svelte:head>
	<title>{title} {__APP_VERSION__}</title>
	<link rel="icon" type="image/svg" href={favicon} />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:url" content={url} />
	<meta name="description" content={description} />
	<meta name="twitter:card" content={description} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>

<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Doichain - Simplified Name-Value Storage</title>
	<link
		rel="icon"
		href="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png"
		sizes="32x32"
	/>
	<link
		rel="icon"
		href="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png"
		sizes="192x192"
	/>
	<link
		rel="apple-touch-icon"
		href="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png"
	/>
	<meta
		name="msapplication-TileImage"
		content="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png"
	/>
	<link
		href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;700&display=swap"
		rel="stylesheet"
	/>
</head>

{#if showHeroSection}
	<section
		transition:flyAndFade={{ y: -50, duration: 300 }}
		class="flex items-center justify-center flex-grow"
	>
		<div class="text-center max-w-4xl mx-auto px-4">
			<!-- <h1 class="text-6xl font-bold mb-4 tracking-tight">Meet Doichain:</h1> -->
			<h1 class="text-3xl font-semibold text-gray-600 mb-12">Simplified name-value storage</h1>

			<p class="text-xl mb-6 max-w-2xl mx-auto leading-relaxed">
				The Doichain network is like Bitcoin: Just for names.
			</p>

			<p class="text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
				Doichain NameOps have many applications: from securing fingerprints of documents and
				decentralized email double opt-ins to trading non-fungible-coins for renewable
				energy-certificates and digital art.
			</p>

			<p class="text-xl mb-6 max-w-2xl mx-auto leading-relaxed">
				Smooth name transaction setup, quick to find. Doichain leverages CO2-neutral, merge-mine-PoW
				of Bitcoin.
			</p>
		</div>
	</section>
{/if}

<section class="flex items-center justify-center">
	<div class="text-center w-full max-w-sm mt-4 mx-auto px-4">
		<NameInput
			bind:currentNameOp
			bind:currentNameUtxo
			on:input={handleInput}
			bind:customErrorMessage
			bind:customSuccessMessage
			{isNameAvailable}
		/>
	</div>
</section>
<section>
	<div class="flex justify-center mt-4">
		{#if currentNameOp && !showHeroSection}
			<NFTCard currentNameOp={updatedCurrentNameOp} currentNameUtxo={updatedCurrentNameUtxo} />
		{:else if !currentNameOp && inputValue}
			<div class="text-center w-full max-w-2xl mt-2 mx-auto px-4">
				<NameDoi
					nftName={inputValue}
					on:finish={() => {
						// Reset parent component states
						inputValue = '';
						showHeroSection = true;
						currentNameOp = null;
						currentNameUtxo = null;
					}}
				/>
			</div>
		{/if}
	</div>
</section>

<!-- New NameOps section with NFT-like cards -->
<section
	bind:this={nameOpsSection}
	class="relative overflow-hidden py-20"
	style="min-height: 100vh; {gradientStyle}"
>
	<div
		class="absolute inset-0 flex items-center justify-center"
		style="transform: translateY({parallaxOffset}px);"
	>
		<h2 class="text-6xl font-bold text-white opacity-10">NameOps</h2>
	</div>
	<div class="relative z-10 max-w-6xl mx-auto px-4">
		<!-- Filter tags -->
		<div class="flex justify-center flex-wrap gap-2 mb-8">
			{#each filters as filter}
				<button
					class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ease-in-out
						{selectedFilter === filter.id
						? 'bg-white text-gray-800'
						: 'bg-gray-700 text-white hover:bg-gray-600'}"
					on:click={() => handleFilterClick(filter.id)}
				>
					{filter.label}
				</button>
			{/each}
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
			{#each filteredNameOps as nameOp}
				<NFTCard currentNameOp={nameOp} currentNameUtxo={null} bind:overWriteValue />
			{/each}
		</div>
	</div>
</section>

<div
	class="fixed top-4 right-4 transform rotate-3 bg-white/90 backdrop-blur-sm shadow-xl rounded-lg px-4 py-2 z-50"
>
	<div class="text-sm">
		<span class="font-bold text-gray-900 ml-1">{selectedFilter}: {filteredNameOps.length}</span>
	</div>
	<div class="text-xs text-gray-500 mt-2">
		Current Block Height: {$blockHeight}
	</div>
</div>

<style>
	.poppins-heading {
		font-family: 'Poppins', sans-serif;
	}

	/* Replace the global styles with more specific ones */
	:global(.nft-card) {
		-webkit-transform: none !important;
		transform: none !important;
		-webkit-transform-style: unset !important;
		transform-style: unset !important;
		-webkit-backface-visibility: unset !important;
		backface-visibility: unset !important;
		-webkit-perspective: none !important;
		perspective: none !important;
		transition: none !important;
	}

	:global(.nft-card .overflow-hidden),
	:global(.nft-card .overflow-hidden img) {
		-webkit-transform: translateZ(0) !important;
		transform: translateZ(0) !important;
		-webkit-mask-image: -webkit-radial-gradient(white, black) !important;
	}
</style>
