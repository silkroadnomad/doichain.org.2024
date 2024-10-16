<script>
	import NameInput from '$lib/components/nameInput.svelte';
	import NFTCard from '$lib/components/NFTCard.svelte';
	import NameDoi from '$lib/components/nameDoi.svelte';
	import { onMount } from 'svelte';

	let showHeroSection = true;
	let inputValue = '';
	let currentNameOp
	let currentNameUtxo;
	$: updatedCurrentNameOp = currentNameOp;
	$: updatedCurrentNameUtxo = currentNameUtxo;
	$: console.log("updatedCurrentNameUtxo",updatedCurrentNameUtxo)
	let customErrorMessage = "Name ---name--- is already registered! Hit 'Enter' to see observe!";
	let customSuccessMessage = "Doichain Name ---name--- is available! Hit 'Enter' to register!";

	function handleInput(event) {
		inputValue = event.detail;
		if (inputValue.length > 0) {
			showHeroSection = false;
		}
	}

	let title = `Doichain.org names on chain`
	let description = "Simple name registration for Doichain";
	const url = "ipns://name-on-chain.com"
	let image = "/nasa-Q1p7bh3SHj8-unsplash.jpg"
	const favicon = "./favicon.ico"

	const flyAndFade = (node, params) => {
		return {
			delay: params.delay || 0,
			duration: params.duration || 300,
			css: t => {
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

	onMount(() => {
		const handleScroll = () => {
			if (nameOpsSection) {
				const rect = nameOpsSection.getBoundingClientRect();
				const viewportHeight = window.innerHeight;
				
				// Calculate how much of the section is visible
				const visibleHeight = Math.min(viewportHeight, Math.max(0, viewportHeight - Math.max(0, rect.top) - Math.max(0, viewportHeight - rect.bottom)));
				
				// Calculate progress based on visible portion
				gradientProgress = visibleHeight / rect.height;
				
				// Update parallax offset
				parallaxOffset = (rect.top - viewportHeight) * 0.5;
			}
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	$: gradientPercentage = Math.round(gradientProgress * 100);
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
		transition:flyAndFade={{ y: -50, duration: 300 }} 
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
	<div class="text-center w-full max-w-sm mt-4 mx-auto px-4">
		<NameInput 
			bind:currentNameOp
			bind:currentNameUtxo
			on:input={handleInput}
			bind:customErrorMessage
			bind:customSuccessMessage
			/>
	</div>
</section>
<section>
	<div class="flex justify-center mt-4">
		{#if currentNameOp && !showHeroSection}
			<NFTCard currentNameOp={updatedCurrentNameOp} currentNameUtxo={updatedCurrentNameUtxo} />
		{:else}
			{#if !currentNameOp && inputValue}
				<div class="text-center w-full max-w-2xl mt-2 mx-auto px-4">
					<NameDoi nftName={inputValue} />
				</div>
			{/if}
		{/if}
	</div>
</section>

<!-- New NameOps section with parallax effect and gradient background -->
<section 
	bind:this={nameOpsSection}
	class="relative overflow-hidden py-20"
	style="height: 100vh; background: linear-gradient(135deg, 
		rgb(255, {255 - gradientProgress * 255}, 0), 
		rgb(255, {128 - gradientProgress * 128}, 0), 
		rgb(255, 0, 0));"
>
	<div 
		class="absolute inset-0 flex items-center justify-center"
		style="transform: translateY({parallaxOffset}px);"
	>
		<h2 class="text-6xl font-bold text-white opacity-10">NameOps</h2>
	</div>
	<div class="relative z-10 max-w-4xl mx-auto px-4">
		<h2 class="text-4xl font-bold mb-8 text-center text-white">Recent NameOps</h2>
		<!-- Add your NameOps content here -->
		<div class="bg-white bg-opacity-90 rounded-lg shadow-lg p-6">
			<p class="text-lg mb-4">Here you can display recent NameOps or other relevant information.</p>
			<!-- Gradient progress display -->
			<div class="mt-4 text-center">
				<p class="text-xl font-semibold">Gradient Progress: {gradientPercentage}%</p>
				<div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
					<div class="bg-yellow-500 h-2.5 rounded-full" style="width: {gradientPercentage}%"></div>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;500;800&display=swap');
</style>
