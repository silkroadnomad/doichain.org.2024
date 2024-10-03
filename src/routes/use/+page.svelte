<script>
	import NameInput from '$lib/components/nameInput.svelte'
	let title = `Doichain.org names on chain`
	let description = "A name registration service for Doichain";
	const url = "ipns://name-on-chain.com"
	let image = "/nasa-Q1p7bh3SHj8-unsplash.jpg"
	const favicon = "./favicon.ico"
</script>

<svelte:head>
	<title>{title} {__APP_VERSION__}</title>
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
<!--	<script src="https://cdn.tailwindcss.com"></script>-->
	<link rel="icon" href="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png" sizes="32x32">
	<link rel="icon" href="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png" sizes="192x192">
	<link rel="apple-touch-icon" href="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png">
	<meta name="msapplication-TileImage" content="https://www.doichain.org/wp-content/uploads/2024/05/bildmarke.png">
	<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;700&display=swap" rel="stylesheet">
</head>

<!-- Hero Section -->
<section class="flex items-center justify-center flex-grow">
	<div class="text-center max-w-4xl mx-auto px-4">
		<NameInput/>
	</div>
</section>






