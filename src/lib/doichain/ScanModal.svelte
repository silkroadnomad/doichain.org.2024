<script>
	import { createEventDispatcher } from 'svelte';
	import { Scanner } from '@peerpiper/qrcode-scanner-svelte';
	import { joinQRs } from 'bbqr';
	import { CryptoPSBT } from '@keystonehq/bc-ur-registry';
	import { URDecoder } from '@ngraveio/bc-ur';

	const dispatch = createEventDispatcher();
	let result = '';
	let parts = [];
	let foundParts = 0;
	let scanTimeout;
	const scanTimeoutDuration = 1000;
	export let scanOpen;
	export let scanData;
	$: {
		if (result && parts.indexOf(result) === -1) {
			console.log('result found', result);
			clearTimeout(scanTimeout);
			parts.push(result);
			scanTimeout = setTimeout(() => {
				try {
					if (parts.length === 1 || foundParts === parts.length) {
						const reassembled = joinQRs(parts);
						console.log(reassembled.fileType);
						console.log(reassembled.encoding);
						const decoder = new TextDecoder('utf-8');
						const decodedString = decoder.decode(new Uint8Array(reassembled.raw));
						console.log(JSON.parse(decodedString));
						scanData = JSON.parse(decodedString);
						scanOpen = false;
						dispatch('close');
					}
				} catch (ex) {
					console.log('issue with bbqr code, attempting BC-UR parse', ex);
					try {
						// Check if it's a BC-UR format
						if (result.toLowerCase().startsWith('ur:')) {
							// Handle single-part UR
							const urDecoder = new URDecoder();
							urDecoder.receivePart(result);
							
							if (urDecoder.isComplete()) {
								const decoded = urDecoder.resultUR();
								if (decoded.type === 'crypto-psbt') {
									try {
										const psbt = CryptoPSBT.fromCBOR(decoded.cbor);
										// Convert PSBT to base64 format expected by renderQR.js
										const psbtBuffer = Buffer.from(psbt.getPSBT());
										const psbtBase64 = psbtBuffer.toString('base64');
										scanData = psbtBase64;
									} catch (psbtError) {
										console.error('Error processing PSBT:', psbtError);
										scanData = decoded;
									}
								} else {
									scanData = decoded;
								}
								scanOpen = false;
								dispatch('close');
								return;
							}
						}
						// If not BC-UR or incomplete, fall back to plain text
						console.log('not a valid BC-UR code, using as plain text');
						scanData = result;
						scanOpen = false;
						dispatch('close');
					} catch (urError) {
						console.log('error parsing BC-UR code, using as plain text', urError);
						scanData = result;
						scanOpen = false;
						dispatch('close');
					}
				}
			}, scanTimeoutDuration);
		} else {
			foundParts += 1;
		}

		if (foundParts === parts.length && parts.length > 1) {
			scanOpen = false;
			dispatch('close');
		}
	}
</script>

<div class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
	<!--
      Background backdrop, show/hide based on modal state.

      Entering: "ease-out duration-300"
        From: "opacity-0"
        To: "opacity-100"
      Leaving: "ease-in duration-200"
        From: "opacity-100"
        To: "opacity-0"
    -->
	<div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

	<div class="fixed inset-0 z-10 w-screen overflow-y-auto">
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
			<div
				class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6"
			>
				<div>
					<Scanner bind:result>
						<!-- Insert custom results component if you want to do something unique with the QR code data -->
						<!-- override default by placing handler in here  -->
						{#if result}
							<div>
								The scan contained: {result}
							</div>
							<!--                            <div>-->
							<!--                                <button on:click={() => (result = null)}>Scan again</button>-->
							<!--                            </div>-->
						{/if}
					</Scanner>
				</div>
				<div class="mt-5 sm:mt-6">
					<button
						on:click={() => {
							scanOpen = false;
						}}
						type="button"
						class="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
						>Close</button
					>
				</div>
			</div>
		</div>
	</div>
</div>
