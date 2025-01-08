<script>
    // External Libraries
    // (No external libraries in this file)

    // Exported Props
    export let imageUrls = [];
    export let imageUrl;
    export let currentSlideIndex = 0;

    // Constants
    const defaultImageUrl = 'https://images.unsplash.com/photo-1629367494173-c78a56567877?ixlib=rb-4.0.3&amp;ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;auto=format&amp;fit=crop&amp;w=927&amp;q=80';

    // Reactive Variables
    let isFullscreen = false;
    let imageElement;
    let currentImageUrl;

    // Reactive Statement
    $: {
        currentImageUrl = imageUrls[currentSlideIndex] || imageUrl || defaultImageUrl
    }

    // Functions
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

    function toggleFullscreen() {
        if (!isFullscreen) {
            if (imageElement.requestFullscreen) {
                imageElement.requestFullscreen();
            } else if (imageElement.webkitRequestFullscreen) { /* Safari */
                imageElement.webkitRequestFullscreen();
            } else if (imageElement.msRequestFullscreen) { /* IE11 */
                imageElement.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
            }
        }
        isFullscreen = !isFullscreen;
    }

    function handleKeydown(event) {
        if (event.key === 'Escape' && isFullscreen) {
            toggleFullscreen();
        }
    }

    // Event Listeners
    window.addEventListener('keydown', handleKeydown);
</script>

<div class="image-container relative">
    <img 
        bind:this={imageElement}
        src={currentImageUrl} 
        alt="NFT image" 
        class="normal-image" 
        on:dblclick={toggleFullscreen}
    />
    {#if imageUrls.length > 1}
        <div class="footer-container">
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
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }
    .normal-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .footer-container {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: space-between;
        padding: 1rem;
        background-color: rgba(0, 0, 0, 0.5);
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
    }
    .image-container:hover .footer-container {
        opacity: 1;
    }
</style>
