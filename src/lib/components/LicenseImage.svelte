<script>
    export let imageUrls = [];
    export let imageUrl;
    const defaultImageUrl = 'https://images.unsplash.com/photo-1629367494173-c78a56567877?ixlib=rb-4.0.3&amp;ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;auto=format&amp;fit=crop&amp;w=927&amp;q=80';
    let currentSlideIndex = 0;
    let isFullscreen = false;
    let imageElement;

    function nextSlide() {
        console.log("nextSlide called");
        if (imageUrls.length > 1) {
            currentSlideIndex = (currentSlideIndex + 1) % imageUrls.length;
            console.log("Next Slide Index:", currentSlideIndex);
        } else {
            console.log("Not enough images to slide");
        }
    }

    function prevSlide() {
        console.log("prevSlide called");
        if (imageUrls.length > 1) {
            currentSlideIndex = (currentSlideIndex - 1 + imageUrls.length) % imageUrls.length;
            console.log("Previous Slide Index:", currentSlideIndex);
        } else {
            console.log("Not enough images to slide");
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

    window.addEventListener('keydown', handleKeydown);
    let currentImageUrl
    // Ensure the image updates when currentSlideIndex changes
    $: {
        currentImageUrl = imageUrls[currentSlideIndex] || imageUrl  || defaultImageUrl
        console.log("currentSlideIndex", currentSlideIndex);
        console.log("currentImageUrl", currentImageUrl);
        console.log("imageUrls[currentSlideIndex]", imageUrls[currentSlideIndex])
    }
</script>

<div class="image-container relative">
    <img 
        bind:this={imageElement}
        src={currentImageUrl} 
        alt="License image" 
        class="normal-image" 
        on:dblclick={toggleFullscreen}
    />
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
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }
    .normal-image {
        width: 100%;
        height: 100%;
        object-fit: cover; /* Ensures the image covers the container while maintaining aspect ratio */
    }
</style>
