<script>
	import { electrumClient, helia, connectedServer, getConnectionStatus, nameShow } from 'doi-js';
	import { getNFTData } from '$lib/utils/ipfsUtils.js';
	import { Button, Input, Card, Group, Text, SimpleGrid } from '@svelteuidev/core'; //https://svelteui.dev/core/card
	import { browser } from '$app/environment';
	import NFTImage from '$lib/components/NFTImage.svelte';
	export let nameId = '';
	export let metadata = {};
	let results = [];
	let title = '';
	let description = '';
	let imageUrl = '';
	let isConnected = false;
	$: ({ isConnected } = getConnectionStatus($connectedServer));
	// Add a marker when helia is initialized
	$: if (browser && $helia) {
		const script = document.createElement('script');
		script.setAttribute('data-helia-initialized', 'true');
		document.head.appendChild(script);
	}

	$: if (browser && nameId && isConnected) {
		nameShow($electrumClient, nameId).then(async (r) => {
			results = r;
			if (r.length > 0 && r[0].scriptPubKey.nameOp) {
				const { metadata: nft, imageUrl: img } = await getNFTData($helia, r[0].scriptPubKey.nameOp.value);
				title = nft.name || nameId;
				description = nft.description || `Details for ${nameId}`;
				imageUrl = img;
			}
		});	
	}
</script>

<svelte:head>
	<title>{title || nameId || 'Doichain Name Details'}</title>
	<meta
		property="og:title"
		content={title || nameId || 'Doichain Name Details'}
		data-testid="meta-title"
	/>
	<meta name="twitter:title" content={title || nameId || 'Doichain Name Details'} />
	<meta
		property="og:description"
		content={description || `Details for ${nameId}` || 'View Doichain name registration details'}
		data-testid="meta-description"
	/>
	<meta
		name="twitter:description"
		content={description || `Details for ${nameId}` || 'View Doichain name registration details'}
	/>
	<meta
		property="og:image"
		content={imageUrl || 'https://doichain.org/favicon.png'}
		data-testid="meta-image"
	/>
	<meta name="twitter:image" content={imageUrl || 'https://doichain.org/favicon.png'} />
	<meta property="og:url" content={browser ? window.location.href : 'https://doichain.org'} />
	<meta name="twitter:card" content="summary" data-testid="meta-twitter-card" />
</svelte:head>

<div class="nameShow" data-testid="name-show-container">
	{#if !nameId}
		<SimpleGrid cols={2}>
			<div>
				<Input
					data-testid="name-search-input"
					on:keydown={async (event) => {
						if (event.key === 'Enter') {
							results = await nameShow($electrumClient, event.target.value);
						}
					}}
					placeholder="Enter name to search"
				/>
			</div>
			<div>
				<Button
					data-testid="name-search-button"
					on:click={async (e) => {
						const input = e.target.closest('.nameShow').querySelector('input');
						if (input) results = await nameShow($electrumClient, input.value);
					}}
				>
					NameShow
				</Button>
			</div>
		</SimpleGrid>
	{/if}
	<p>&nbsp;</p>
	{#if results.length > 0}
		{#each results as tx}
			{#if tx.scriptPubKey.nameOp}
				<Card shadow="sm" padding="lg">
					<Group position="apart">
						<Text weight={500}>{tx.scriptPubKey.nameOp.name} ({tx.formattedBlocktime})</Text>
						<!--							<Badge color='pink' variant='light'>on sale</Badge>-->
					</Group>
					<Text>
						{#await getNFTData($helia, tx.scriptPubKey.nameOp.value)}
							<p>loading for nft data...</p>
						{:then { metadata: nft, imageUrl, imageUrls }}
							<p>NFC: {nft.name || 'no name'}</p>
							<p>Description: {nft.description || 'no description'}</p>
							<p>&nbsp;</p>
							<NFTImage {imageUrl} {imageUrls} />
						{/await}
					</Text>
					<p>&nbsp;</p>
					<SimpleGrid cols={2}>
						<div>wallet address:</div>
						<div>{tx.scriptPubKey.addresses[0]}</div>
						<div>txid:</div>
						<div>{tx.txid}</div>
						<div>time:</div>
						<div>{tx.formattedBlocktime}</div>
						<div>name:</div>
						<div>{tx.scriptPubKey.nameOp.name}</div>
						<div>value:</div>
						<div>{tx.scriptPubKey.nameOp.value}</div>
						<div>DOI amount:</div>
						<div>{tx.value}</div>
					</SimpleGrid>
					<p>&nbsp;</p>
					<Button variant="light" color="blue" fullSize on:click={() => alert('coming soon')}
						>Buy</Button
					>
				</Card>
			{/if}
		{/each}
	{:else}
		<p>No NameId found for given entry.</p>
	{/if}
</div>

<style>
	:global(.nameShow) {
		padding: 1rem;
		font-size: small !important;
		background-color: #f1f3f5;
		color: var(--text-3);
		/*overflow-wrap: break-word;*/
	}
	:global(.nameShow p) {
		font-size: inherit;
	}
	.nameShow input {
		margin-right: 8px;
	}
	.nameShow button {
		margin-left: 8px;
	}
	.nameShow img {
		max-width: 300px;
		max-height: 300px;
		object-fit: contain;
	}
</style>
