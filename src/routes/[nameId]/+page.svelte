<script>
  import NameShow from '$lib/components/nameShow.svelte';
  import { electrumClient } from "$lib/doichain/doichain-store.js";
  export let data;
  
  // Get the nameId from the URL parameters
  $: nameId = data.nameId;
  
  // Meta information for social sharing
  $: title = `${nameId} on Doichain`;
  $: description = `View details for ${nameId} on the Doichain network`;
  $: url = `https://doichain-org-2024.vercel.app/${nameId}`;
  $: image = "/nasa-Q1p7bh3SHj8-unsplash.jpg"; // Using default image from use/+page.svelte
</script>

<svelte:head>
  <title>{title}</title>
  <meta property="og:type" content="article" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={image} />
  <meta property="og:url" content={url} />
  <meta name="description" content={description}/>
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <NameShow nameId={nameId} />
</div>
