<script>
	import { electrumClient, helia } from "../doichain/doichain-store.js";
	import { nameShow } from '../doichain/nameShow.js'
	import { getImageUrlFromIPFS } from '$lib/doichain/nfc/getImageUrlFromIPFS.js'
	import { getMetadataFromIPFS } from '$lib/doichain/nfc/getMetadataFromIPFS.js'
	import { Button, Input, Card, Group, Text, SimpleGrid } from '@svelteuidev/core' //https://svelteui.dev/core/card
	export let nameId = '';
	export let metadata = {};
	let results = [];
	
	$: if (nameId) {
		// Fetch results when nameId changes
		nameShow($electrumClient, nameId).then(r => {
			results = r;
		});
	}
</script>

<svelte:head>
	{#if browser && title}
		<title>{title}</title>
		<meta property="og:title" content={title} />
		<meta name="twitter:title" content={title} />
	{/if}
	{#if browser && description}
		<meta property="og:description" content={description} />
		<meta name="twitter:description" content={description} />
	{/if}
	{#if browser && imageUrl}
		<meta property="og:image" content={imageUrl} />
		<meta name="twitter:image" content={imageUrl} />
	{/if}
	{#if browser}
		<meta property="og:url" content={window.location.href} />
	{/if}
</svelte:head>

<div class="nameShow">
	{#if !nameId}
		<SimpleGrid cols={2}>
			<div>
				<Input on:keydown={
					async (event) => { if (event.key === 'Enter') { results = await nameShow($electrumClient, event.target.value)} }}
							placeholder="Enter name to search" />
			</div>
			<div>
				<Button on:click={async (e) => {
					const input = e.target.closest('.nameShow').querySelector('input');
					if (input) results = await nameShow($electrumClient, input.value);
				}}>NameShow</Button>
			</div>
		</SimpleGrid>
	{/if}
<p>&nbsp;</p>
	{#if results.length > 0}
		{#each results as tx}
			{#if tx.scriptPubKey.nameOp }
				<Card shadow='sm' padding='lg'>
<!--						<Card.Section first padding='lg'>-->
<!--							<Image-->
<!--								src='./image.png'-->
<!--								height={160}-->
<!--								alt='NFT'-->
<!--							/>-->
<!--						</Card.Section>-->
						<Group position='apart'>
							<Text weight={500}>{tx.scriptPubKey.nameOp.name} ({tx.formattedBlocktime})</Text>
<!--							<Badge color='pink' variant='light'>on sale</Badge>-->
						</Group>
					<Text>
						{#await getMetadataFromIPFS($helia,tx.scriptPubKey.nameOp.value)}
							<p>loading for nft data...</p>
						{:then nft}

							<p>NFC: {nft.name || 'no name'}</p>
							<p>Description: {nft.description || 'no description'}</p>
							<p>&nbsp;</p>
							{#await getImageUrlFromIPFS($helia,nft.image)}
								<p>loading for img from ipfs url {nft.image}... <br>
									(can take some time - helia node needs to find enough peers!)</p>
							{:then img}
								{#if img}
									<img src={img} alt={nft.name} style="max-width: 300px; max-height: 300px; object-fit: contain;" />
								{/if}
							{:catch error}

							{/await}
						{:catch error}
						{/await}
					</Text>
					<p>&nbsp;</p>
						<SimpleGrid  cols={2}>
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
						<Button variant='light' color='blue' fullSize on:click={()=>alert('coming soon')}>Buy</Button>
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
