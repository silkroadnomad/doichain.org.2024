<script>
    import { createEventDispatcher } from "svelte";
    import { Scanner } from '@peerpiper/qrcode-scanner-svelte'
    import { joinQRs } from 'bbqr';
    import { URDecoder } from '@ngraveio/bc-ur'

    const dispatch = createEventDispatcher();
    let result = "";
    let parts = []
    let foundParts = 0
    let scanTimeout;
    const scanTimeoutDuration = 1000;
    export let scanOpen
    export let scanData

    // Initialize BC-UR decoder
    const urDecoder = new URDecoder()

    function handleScan(newResult) {
        result = newResult;
        console.log("New scan detected:", result);
        
        // Try BC-UR first
        try {
            urDecoder.receivePart(result);
            if (urDecoder.isComplete() && urDecoder.isSuccess()) {
                const ur = urDecoder.resultUR();
                const decoded = ur.decodeCBOR();
                const decodedString = decoded.toString();
                console.log("BC-UR decoded data:", decodedString);
                
                try {
                    scanData = JSON.parse(decodedString);
                } catch {
                    scanData = decodedString;
                }
                scanOpen = false;
                dispatch('close');
                return;
            }
        } catch (ex) {
            console.log("Not a BC-UR code, trying BBQR...", ex);
            // Continue to BBQR handling
        }
    }

    // BBQR handling in reactive statement
    $: {
        if (result && parts.indexOf(result) === -1) {
            console.log("BBQR result found", result)
            clearTimeout(scanTimeout);
            parts.push(result);
            scanTimeout = setTimeout(() => {
                try {
                    if (parts.length === 1 || foundParts === parts.length) {
                        const reassembled = joinQRs(parts)
                        console.log(reassembled.fileType);
                        console.log(reassembled.encoding);
                        const decoder = new TextDecoder('utf-8');
                        const decodedString = decoder.decode(new Uint8Array(reassembled.raw));
                        console.log(JSON.parse(decodedString));
                        scanData = JSON.parse(decodedString);
                        scanOpen = false;
                        dispatch('close');
                    }
                } catch(ex) {
                    console.log("issue with bbqr code, using raw text", ex)
                    scanData = result
                    scanOpen = false;
                    dispatch('close');
                }
            }, scanTimeoutDuration);
        } else if (result) {
            foundParts += 1;
        }

        if (foundParts === parts.length && parts.length > 1) {
            scanOpen = false;
            dispatch('close');
        }
    }
</script>

<div class="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <!-- Backdrop with higher z-index -->
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-40" aria-hidden="true"></div>

    <!-- Modal content with highest z-index -->
    <div class="fixed inset-0 z-50 w-screen overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <!--
              Modal panel, show/hide based on modal state.

              Entering: "ease-out duration-300"
                From: "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                To: "opacity-100 translate-y-0 sm:scale-100"
              Leaving: "ease-in duration-200"
                From: "opacity-100 translate-y-0 sm:scale-100"
                To: "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            -->
            <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                <div>
                    <Scanner 
                        bind:result
                        on:scan={({detail}) => handleScan(detail)}
                        scanning={true}
                    >
                        {#if result}
                            <div>
                                {#if urDecoder.getProgress() > 0}
                                    BC-UR Progress: {urDecoder.getProgress()}%
                                {:else}
                                    BBQR Parts: {parts.length}
                                {/if}
                                <div>Last scan: {result}</div>
                            </div>
                        {/if}
                    </Scanner>
                </div>
                <div class="mt-5 sm:mt-6">
                    <button 
                        on:click={() => { scanOpen = false }}
                        type="button"
                        class="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    /* Ensure modal is always on top of other elements */
    :global(.relative.z-50) {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
    }
</style>
