<script>
  import NameShow from '$lib/components/nameShow.svelte';
  export let data;
  const { metadata, nameId } = data;
</script>

<svelte:head>
  <title>{metadata.title}</title>
  <meta property="og:title" content={metadata.title} />
  <meta name="twitter:title" content={metadata.title} />
  <meta property="og:description" content={metadata.description} />
  <meta name="twitter:description" content={metadata.description} />
  {#if metadata.image}
    <meta property="og:image" content={metadata.image} />
    <meta name="twitter:image" content={metadata.image} />
  {/if}
  <meta property="og:url" content={metadata.url} />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <NameShow {nameId} {metadata} />
</div>

<style>
  .container {
    max-width: 1200px;
  }
</style>
