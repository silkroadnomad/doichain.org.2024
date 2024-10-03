<script>
	import { fade, fly } from 'svelte/transition';
	import NameInput from '$lib/components/nameInput.svelte';

	let showHeroSection = true;
	let inputValue = '';

	function handleInput(event) {
		inputValue = event.detail;
		if (inputValue.length > 0) {
			showHeroSection = false;
		}
	}

	let title = `Doichain.org names on chain`
	let description = "A name registration service for Doichain";
	const url = "ipns://name-on-chain.com"
	let image = "/nasa-Q1p7bh3SHj8-unsplash.jpg"
	const favicon = "./favicon.ico"
</script>

<svelte:head>
	<title>{title } {__APP_VERSION__}</title>
	<link rel="icon" type="image/svg" href={favicon} />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:url" content={url} />
	<meta name="description" content={description}/>
	<meta name="twitter:card" content={description} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Doichain - Simplified Name-Value Storage</title>
	<link rel="icon" href="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png" sizes="32x32">
	<link rel="icon" href="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png" sizes="192x192">
	<link rel="apple-touch-icon" href="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png">
	<meta name="msapplication-TileImage" content="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png">
	<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;700&display=swap" rel="stylesheet">
</head>

{#if showHeroSection}
	<section 
		transition:fly={{ y: -50, duration: 300, opacity: 0 }} 
		class="flex items-center justify-center flex-grow"
	>
		<div class="text-center max-w-4xl mx-auto px-4">
			<!-- Title -->
			<h1 class="text-6xl font-medium mb-2 tracking-tight">Meet Doichain:</h1>
			<h1 class="text-3xl font-mediumtext-gray-600 mb-12">Simplified name-value storage</h1>

			<!-- Description -->
			<p class="text-xl mb-6 max-w-2xl mx-auto leading-relaxed">
				The Doichain network is like Bitcoin: Just for names.
			</p>

			<p class="text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
				Doichain names have many applications: from securing fingerprints of documents and decentralized email-double-opt-ins to
				trading non-fungible-coins for renewable-energy-proofs and digital art.
			</p>

			<p class="text-xl mb-6 max-w-2xl mx-auto leading-relaxed">
				Smooth name transaction setup, quick to find.
				Doichain leverages CO2-neutral, merge-mine-PoW of Bitcoin.
			</p>
		</div>
	</section>
{/if}

<section class="flex items-center justify-center">
	<div class="text-center w-full max-w-sm mx-auto px-4">
		<NameInput 
			on:input={handleInput}
			customErrorMessage="Name '{name}' is already registered"
			customSuccessMessage="Custom success message: "
		/>
	</div>
</section>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;500;800&display=swap');
</style>
