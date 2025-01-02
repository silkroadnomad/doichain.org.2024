<script>
    export let imageUrls = [];
    export let imageUrl
    export let defaultImageUrl;
    let currentSlideIndex = 0;

    function nextSlide() {
        if (imageUrls.length > 1) {
            currentSlideIndex = (currentSlideIndex + 1) % imageUrls.length;
        }
    }

    function prevSlide() {
        if (imageUrls.length > 1) {
            currentSlideIndex = (currentSlideIndex - 1 + imageUrls.length) % imageUrls.length;
        }
    }
</script>

<div class="image-container relative">
    <img src={imageUrls[currentSlideIndex] || imageUrl || defaultImageUrl} alt="NFT image" class="object-cover w-full h-full" />
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

<style>
    .image-container {
        /* Add styles for the image container */
    }
</style>
