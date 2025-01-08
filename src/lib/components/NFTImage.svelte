<script>
    /**
     * A Svelte component for displaying NFT images with slideshow and fullscreen capabilities.
     * 
     * @component
     */

    // External Libraries
    // (No external libraries in this file)

    // Exported Props

    /**
     * An array of image URLs for the slideshow.
     * @type {string[]}
     */
    export let imageUrls = [];

    /**
     * A single image URL to display if imageUrls is empty.
     * @type {string}
     */
    export let imageUrl;

    /**
     * The index of the current slide in the imageUrls array.
     * @type {number}
     */
    export let currentSlideIndex = 0;

    // Constants

    /**
     * The default image URL used when no other image is available.
     * @constant {string}
     */
    const defaultImageUrl = 'https://images.unsplash.com/photo-1629367494173-c78a56567877?ixlib=rb-4.0.3&amp;ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8MHx8&amp;auto=format&amp;fit=crop&amp;w=927&amp;q=80';

    // Reactive Variables

    /**
     * A flag indicating whether the image is in fullscreen mode.
     * @type {boolean}
     */
    let isFullscreen = false;

    /**
     * The image element in the DOM.
     * @type {HTMLImageElement}
     */
    let imageElement;

    /**
     * The URL of the current image being displayed.
     * @type {string}
     */
    let currentImageUrl;

    // Reactive Statement
    $: {
        currentImageUrl = imageUrls[currentSlideIndex] || imageUrl || defaultImageUrl;
    }

    // Functions

    /**
     * Advances to the next slide in the imageUrls array.
     * If at the end, it loops back to the first image.
     */
    function nextSlide() {
        if (imageUrls.length > 1) {
            currentSlideIndex = (currentSlideIndex + 1) % imageUrls.length;
        } 
    }

    /**
     * Moves to the previous slide in the imageUrls array.
     * If at the beginning, it loops back to the last image.
     */
    function prevSlide() {
        if (imageUrls.length > 1) {
            currentSlideIndex = (currentSlideIndex - 1 + imageUrls.length) % imageUrls.length;
        } 
    }

    /**
     * Toggles the fullscreen mode for the imageElement.
     * If the element is not in fullscreen, it requests fullscreen.
     * If the element is in fullscreen, it exits fullscreen.
     */
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

    /**
     * Handles the 'keydown' event to exit fullscreen mode
     * when the 'Escape' key is pressed.
     * 
     * @param {KeyboardEvent} event - The keyboard event object.
     */
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
