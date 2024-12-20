<script>
	import { onDestroy, onMount } from 'svelte';
	import Dropzone from 'svelte-file-dropzone';
	import { helia, libp2p, network, electrumClient } from '$lib/doichain/doichain-store.js';
	import { prepareSignTransaction } from '$lib/doichain/prepareSignTransaction.js';
	import { renderBCUR } from '../doichain/renderQR.js';
	import { DOICHAIN } from '$lib/doichain/doichain.js';
	import { unixfs } from '@helia/unixfs';
	import ScanModal from '$lib/doichain/ScanModal.svelte';
	import { getAddressTxs } from '$lib/doichain/getAddressTxs.js';
	import TransactionDetails from './TransactionDetails.svelte';

	// Add event dispatcher
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	const CONTENT_TOPIC = import.meta.env.VITE_CONTENT_TOPIC || '/doichain-nfc/1/message/proto';

	let scanOpen = false;
	let scanTarget = '';
	let scanData = '';

	export let walletAddress = localStorage.getItem('walletAddress') || '';
	let recipientsAddress = walletAddress;
	let changeAddress = walletAddress;
	let changeAmount;
	export let nameId;
	export let nameValue;
	export let nftName;
	$: nameId = nftName;

	let nftDescription;
	let utxos = [];
	let psbtBaseText;
	let utxoErrorMessage;
	let qrCodeData;
	let qrCode;
	let transactionFee;
	let totalAmount;
	let errorMessage;
	let storageFee = 1000000;

	let files = {
		accepted: [],
		rejected: []
	};

	function handleFilesSelect(e) {
		const { acceptedFiles, fileRejections } = e.detail;
		if (files.accepted.length > 0) files.accepted.pop();
		files.accepted = acceptedFiles;
		files.rejected = fileRejections;
	}

	let previewImgSrc;
	let imageCID;
	let metadataCID;
	let metadataJSON;

	let retryCount = 0;
	const MAX_RETRIES = 3;
	const RETRY_DELAY = 2000; // 2 seconds

	async function publishCID(cid, type = 'NEW') {
		const message = `${type}-CID:${cid}`;
		let success = false;
		retryCount = 0;

		const attemptPublish = async () => {
			try {
				await $libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode(message));
				success = true;
				console.log(`Successfully published ${message} on attempt ${retryCount + 1}`);
			} catch (error) {
				console.error(`Failed to publish ${message} on attempt ${retryCount + 1}:`, error);
				if (retryCount < MAX_RETRIES) {
					retryCount++;
					console.log(`Retrying in ${RETRY_DELAY}ms...`);
					await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
					await attemptPublish();
				}
			}
		};

		await attemptPublish();
		return success;
	}

	async function writeMetadata() {
		const encoder = new TextEncoder();
		const fs = unixfs($helia);

		metadataJSON = {
			name: nftName,
			description: nftDescription,
			image: `ipfs://${imageCID}`
		};

		metadataCID = await fs.addBytes(encoder.encode(JSON.stringify(metadataJSON)));
		nameValue = `ipfs://${metadataCID.toString()}`;
		console.log('Added metadata file to IPFS:', metadataCID.toString());
		await publishCID(metadataCID.toString());
	}

	async function previewFile() {
		console.log('rendering preview with file', files.accepted[0].name);
		const fs = unixfs($helia);
		if (!nftName) nftName = files.accepted[0].name;
		if (!nameId) nameId = files.accepted[0].name;
		let file = files.accepted[0];

		/** reader for ipfs upload */
		const readerToArrayBuffer = new FileReader();
		readerToArrayBuffer.addEventListener(
			'load',
			() => {
				console.log('readerToArrayBuffer got data', readerToArrayBuffer.result);
				if (readerToArrayBuffer.result instanceof ArrayBuffer) {
					const byteArray = new Uint8Array(readerToArrayBuffer.result);
					fs.addBytes(new Buffer(byteArray), {
						onProgress: (evt) => {
							console.info('add event', evt.type, evt.detail);
						}
					}).then(async (cid) => {
						imageCID = cid.toString();
						console.log('Added file to IPFS:', imageCID);
						await publishCID(imageCID.toString());
						writeMetadata();
					});
				} else {
					console.log('not ArrayBuffer');
				}
			},
			false
		);

		/** reader for image preview / convert image file to base64 string */
		const readerToDataUrl = new FileReader();
		readerToDataUrl.addEventListener(
			'load',
			() => {
				previewImgSrc = readerToDataUrl.result;
			},
			false
		);

		if (file) {
			readerToArrayBuffer.readAsArrayBuffer(file);
			readerToDataUrl.readAsDataURL(file);
		}
	}

	$: {
		if (files.accepted.length > 0) previewFile();
	}
	$: {
		if (nftName || nftDescription) writeMetadata();
	}

	let activeTimeLine = 0;
	let selectedUtxos = [];
	$: selectedUtxosCount = selectedUtxos.length;

	function toggleUtxoSelection(utxo) {
		const index = selectedUtxos.findIndex((u) => u.hash === utxo.hash && u.n === utxo.n);
		if (index !== -1) {
			selectedUtxos = selectedUtxos.filter((_, i) => i !== index);
		} else {
			selectedUtxos = [...selectedUtxos, utxo];
		}
	}

	function isUtxoSelected(utxo) {
		return selectedUtxos.some((u) => u.hash === utxo.hash && u.n === utxo.n);
	}

	$: {
		if (selectedUtxosCount > 0 && nameId && nameValue) {
			console.log('prepare signing transaction', selectedUtxos);
			const result = prepareSignTransaction(
				selectedUtxos,
				nameId,
				nameValue,
				DOICHAIN,
				storageFee,
				recipientsAddress,
				changeAddress
			);

			if (result.error) {
				console.log('error', result.error);
				utxoErrorMessage = result.error;
				qrCodeData = undefined;
			} else {
				psbtBaseText = result.psbtBase64;
				transactionFee = result.transactionFee;
				changeAmount = result.changeAmount;
				totalAmount = result.totalAmount;
				console.log('result', result);
				console.log('psbtBaseText', psbtBaseText);
				renderBCUR(psbtBaseText)
					.then((_qr) => {
						qrCodeData = _qr;
						displayQrCodes();
					})
					.catch((error) => {
						console.error('Error generating QR code:', error);
						qrCodeData = undefined;
					});
			}
		}
	}

	let activePanel = 'psbtQR';

	function copyToClipboard(text) {
		navigator.clipboard
			.writeText(text)
			.then(() => {
				alert('Copied to clipboard!');
			})
			.catch((err) => {
				console.error('Failed to copy: ', err);
			});
	}

	let animationTimeout;
	let currentSvgIndex;

	function displayQrCodes() {
		currentSvgIndex = 0;
		if (animationTimeout) clearTimeout(animationTimeout);
		animateQrCodes();
	}

	function animateQrCodes() {
		qrCode = qrCodeData[currentSvgIndex];
		currentSvgIndex = (currentSvgIndex + 1) % qrCodeData.length;
		animationTimeout = setTimeout(animateQrCodes, 300);
	}

	onDestroy(() => {
		if (animationTimeout) clearTimeout(animationTimeout);
	});

	let cidStatus = 'idle'; // Can be 'idle', 'adding', or 'added'

	onMount(() => {
		if ($libp2p) {
			$libp2p.services.pubsub.addEventListener('message', (event) => {
				if (event.detail.topic === CONTENT_TOPIC) {
					const message = new TextDecoder().decode(event.detail.data);
					if (message.startsWith('ADDING-CID')) {
						cidStatus = 'adding';
					} else if (message.startsWith('ADDED-CID')) {
						cidStatus = 'added';
					}
				}
			});
		}
	});

	$: if (scanData) {
		if (scanTarget === 'wallet') {
			walletAddress = scanData;
		} else if (scanTarget === 'recipient') {
			recipientsAddress = scanData;
		} else if (scanTarget === 'change') {
			changeAddress = scanData;
		}
		scanData = ''; // Reset after use
	}

	// Add state for active tab
	let activeTab = 'nfc'; // or 'keyValue'

	function handleFinish() {
		// Dispatch event to parent component
		dispatch('finish');

		// Reset local states
		activeTimeLine = 0;
		files.accepted = [];
		previewImgSrc = null;
		selectedUtxos = [];
		// ... reset other relevant states ...
	}

	// Calculate the sum of selected UTXOs in satoshis
	$: selectedUtxosSum = selectedUtxos.reduce((sum, utxo) => sum + utxo.value * 100000000, 0);

	let utxosFetched = true; // State to track if UTXOs have been fetched

	async function fetchUtxos() {
		utxosFetched = false;
		console.log('Fetching UTXOs for address:', walletAddress);
		localStorage.setItem('walletAddress', walletAddress);
		const result = await getAddressTxs(walletAddress, [], $electrumClient, $network);
		console.log('utxos:', result);
		console.log('nextUnusedAddress:', result.nextUnusedAddress);
		console.log('nextUnusedChangeAddress:', result.nextUnusedChangeAddress);
		recipientsAddress = result.nextUnusedAddress;
		changeAddress = result.nextUnusedChangeAddress;
		utxos = result.transactions.filter((tx) => tx.type === 'output' && tx.utxo === true);
		console.log('Received UTXOs:', utxos);
		utxosFetched = true; // Set to true if UTXOs are fetched
	}
</script>

{#if scanOpen}
	<ScanModal bind:scanOpen bind:scanData />
{/if}
<p class="mt-4">&nbsp;</p>
<div class="nameShow">
	{#if $electrumClient}
		<div class="relative border-l-2 border-gray-200 ml-3 max-w-3xl mx-auto">
			<div class="mb-8 flex items-center">
				<div class="absolute w-8 h-8 bg-blue-500 rounded-full -left-4 border-4 border-white"></div>
				<div class="ml-6 w-full">
					<h3 class="font-bold">1. Data Definition</h3>
					{#if activeTimeLine === 0}
						<p class="text-sm text-gray-500">
							<li>Mint a NFC (non-fungible-coin),</li>
							<li>send an individual key-value transaction!</li>
						</p>
						<p class="mt-4">&nbsp;</p>
						<div class="border-b border-gray-200">
							<nav class="-mb-px flex">
								<a
									class="border-b-2 py-2 px-4 text-sm font-medium {activeTab === 'nfc'
										? 'border-blue-500 text-blue-600'
										: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
									href="#"
									on:click|preventDefault={() => (activeTab = 'nfc')}
								>
									NFC (non-fungible-coin)
								</a>
								<a
									class="border-b-2 py-2 px-4 text-sm font-medium {activeTab === 'keyValue'
										? 'border-blue-500 text-blue-600'
										: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
									href="#"
									on:click|preventDefault={() => (activeTab = 'keyValue')}
								>
									Key-Value Transaction
								</a>
							</nav>
						</div>
						<div class="py-4">
							{#if activeTab === 'nfc'}
								<div class="grid grid-cols-[auto,1fr] gap-6 items-start mb-8">
									<div class="font-semibold text-left">NFC-Name:</div>
									<div>
										<input
											type="text"
											bind:value={nftName}
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										/>
									</div>

									<div class="font-semibold text-left">Description:</div>
									<div>
										<input
											type="text"
											bind:value={nftDescription}
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										/>
									</div>
								</div>

								<div class="mb-8">
									<div class="font-semibold text-left mb-2">Image:</div>
									<div class="grid md:grid-cols-2 gap-6">
										<div
											class="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300"
										>
											{#if previewImgSrc}
												<img
													src={previewImgSrc}
													alt="Image preview"
													class="w-full h-full object-cover"
												/>
												<button
													on:click={() => {
														files.accepted = [];
														previewImgSrc = null;
													}}
													class="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600 focus:outline-none"
												>
													<svg
														class="w-4 h-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M6 18L18 6M6 6l12 12"
														/>
													</svg>
												</button>
											{:else}
												<Dropzone
													multiple={false}
													on:drop={handleFilesSelect}
													class="w-full h-full flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-gray-50"
												>
													<svg
														class="w-12 h-12 text-gray-400 mb-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M12 4v16m8-8H4"
														/>
													</svg>
													<p class="text-sm text-gray-600">
														Drop your image here or click to upload
													</p>
													<p class="text-xs text-gray-500 mt-2">PNG, JPG, GIF up to 10MB</p>
												</Dropzone>
											{/if}
										</div>

										{#if files.accepted.length > 0}
											<div class="bg-gray-50 rounded-lg p-4">
												<h4 class="font-medium text-gray-900 mb-4">File Details</h4>
												<div class="space-y-3">
													<div class="flex items-center">
														<span class="text-sm font-medium text-gray-500 w-20">Name:</span>
														<span class="text-sm text-gray-900 truncate"
															>{files.accepted[0].name}</span
														>
													</div>
													<div class="flex items-center">
														<span class="text-sm font-medium text-gray-500 w-20">Type:</span>
														<span class="text-sm text-gray-900">{files.accepted[0].type}</span>
													</div>
													<div class="flex items-center">
														<span class="text-sm font-medium text-gray-500 w-20">Size:</span>
														<span class="text-sm text-gray-900"
															>{(files.accepted[0].size / 1024).toFixed(2)} KB</span
														>
													</div>
													<div class="flex items-center">
														<span class="text-sm font-medium text-gray-500 w-20">CID:</span>
														<span class="text-sm text-gray-900 truncate"
															>{imageCID || 'Generating...'}</span
														>
													</div>
													<div class="flex items-center">
														<span class="text-sm font-medium text-gray-500 w-20">Status:</span>
														<div class="flex items-center">
															{#if cidStatus !== 'idle'}
																<div class="flex items-center gap-2">
																	<div
																		class={`w-2 h-2 rounded-full ${cidStatus === 'adding' ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}
																	></div>
																	<span class="text-sm text-gray-900">
																		{cidStatus === 'adding' ? 'Processing...' : 'Added to IPFS'}
																	</span>
																</div>
															{/if}
														</div>
													</div>
												</div>
											</div>
										{/if}
									</div>
								</div>
							{:else}
								<div class="grid grid-cols-[auto,1fr] gap-6 items-start mb-8">
									<div class="font-semibold text-left">Key:</div>
									<div>
										<input
											type="text"
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										/>
									</div>

									<div class="font-semibold text-left">Value:</div>
									<div>
										<input
											type="text"
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										/>
									</div>
								</div>
							{/if}
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div>
								<button
									on:click={() => activeTimeLine--}
									class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
									>Back</button
								>
							</div>
							<div>
								<button
									on:click={() => activeTimeLine++}
									class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
									>Next</button
								>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="mb-8 flex items-center">
				<div class="absolute w-8 h-8 bg-blue-500 rounded-full -left-4 border-4 border-white"></div>
				<div class="ml-6">
					<h3 class="font-bold">2. Wallet Address</h3>
					{#if activeTimeLine === 1}
						<p class="text-sm text-gray-500">
							Enter your wallet address which contains the UTXOs to be used for the transaction.
							Toggle to spendable coins as inputs to the transaction. NameOps are utxos too but not
							spendable, since burned.
						</p>
						<p class="mt-4">&nbsp;</p>
						<div class="grid grid-cols-2 gap-4">
							<div class="flex">
								<input
									type="text"
									bind:value={walletAddress}
									on:keydown={async (event) => {
										if (event.key === 'Enter') {
											localStorage.setItem('walletAddress', walletAddress);
											const {
												transactions,
												nextUnusedAddressesMap,
												nextUnusedAddress,
												nextUnusedChangeAddress
											} = await getAddressTxs(walletAddress, [], $electrumClient, $network);
											console.log('nextUnusedAddressesMap:', nextUnusedAddressesMap);
											console.log('nextUnusedAddress:', nextUnusedAddress);
											console.log('nextUnusedChangeAddress:', nextUnusedChangeAddress);
											recipientsAddress = nextUnusedAddress;
											changeAddress = nextUnusedChangeAddress;
											utxos = transactions
												.filter((tx) => tx.type === 'output' && tx.utxo === true)
												.map((tx) => ({
													tx_hash: tx.txid,
													tx_pos: tx.n,
													value: tx.value,
													height: tx.height
												}));
										}
									}}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
								<button
									on:click={() => {
										scanTarget = 'wallet';
										scanOpen = true;
									}}
									class="ml-2"
								>
									<svg
										class="h-8 w-8 text-orange-600"
										width="24"
										height="24"
										viewBox="0 0 24 24"
										stroke-width="2"
										stroke="currentColor"
										fill="none"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path stroke="none" d="M0 0h24v24H0z" />
										<path d="M4 7v-1a2 2 0 0 1 2 -2h2" />
										<path d="M4 17v1a2 2 0 0 0 2 2h2" />
										<path d="M16 4h2a2 2 0 0 1 2 2v1" />
										<path d="M16 20h2a2 2 0 0 0 2 -2v-1" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</svg>
								</button>
							</div>
							<div>
								{#if !utxosFetched}
									<svg
										class="h-8 w-8 text-blue-500 animate-spin"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
										/>
									</svg>
								{:else}
									<button
										on:click={fetchUtxos}
										class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
									>
										Show Coins
									</button>
								{/if}
							</div>
						</div>
						<p class="mt-4">&nbsp;</p>
						<div class="grid grid-cols-2 gap-4">
							{#each utxos as utxo}
								{#if !utxo.nameId && utxo.value > 0}
									<div class="grid grid-cols-2 gap-4">
										<div>wallet address:</div>
										<div>{utxo.address ? utxo.address : utxo.scriptPubKey.addresses[0]}</div>
										<div>amount:</div>
										<div>{utxo?.value || 0} DOI</div>
										<div><b>Activate this UTXO:</b></div>
										<div class="utxo-item">
											<button
												on:click={() => toggleUtxoSelection(utxo)}
												type="button"
												class="group relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
												role="switch"
												aria-checked={selectedUtxos.some(
													(u) => u.hash === utxo.hash && u.n === utxo.n
												)
													? true
													: false}
											>
												<span
													aria-hidden="true"
													class="pointer-events-none absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out"
													class:bg-indigo-600={selectedUtxos.some(
														(u) => u.hash === utxo.hash && u.n === utxo.n
													)}
													class:bg-gray-200={!selectedUtxos.some(
														(u) => u.hash === utxo.hash && u.n === utxo.n
													)}
												></span>
												<span
													aria-hidden="true"
													class="pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full border border-gray-200 bg-white shadow ring-0 transition-transform duration-200 ease-in-out"
													class:translate-x-5={selectedUtxos.some(
														(u) => u.hash === utxo.hash && u.n === utxo.n
													)}
													class:translate-x-0={!selectedUtxos.some(
														(u) => u.hash === utxo.hash && u.n === utxo.n
													)}
												></span>
											</button>
											{#if utxo.nameOps}
												<div class="tooltip">
													NameOps: {utxo.nameOps}
												</div>
											{/if}
										</div>
									</div>
									<div class="w-full h-px bg-gray-200 my-2"></div>
								{/if}
							{/each}
							<TransactionDetails
								{transactionFee}
								{totalAmount}
								{selectedUtxosSum}
								{changeAmount}
							/>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<button
									on:click={() => activeTimeLine--}
									class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
									>Back</button
								>
							</div>
							<div>
								<button
									disabled={selectedUtxos.length === 0}
									on:click={() => activeTimeLine++}
									class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
									>Next</button
								>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="mb-8 flex items-center">
				<div class="absolute w-8 h-8 bg-blue-500 rounded-full -left-4 border-4 border-white"></div>
				<div class="ml-6">
					<h3 class="font-bold">3. Add Recipient and Change Address</h3>
					{#if activeTimeLine === 2}
						<p class="text-sm text-gray-500"></p>
						<p class="mt-4">&nbsp;</p>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<div class="mb-4">
									<label class="block text-gray-700 text-sm font-bold mb-2" for="recipientsAddress">
										Recipient
									</label>
									<div class="flex">
										<input
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
											id="recipientsAddress"
											type="text"
											placeholder="Recipient address"
											bind:value={recipientsAddress}
										/>
										<button
											on:click={() => {
												scanTarget = 'recipient';
												scanOpen = true;
											}}
											class="ml-2"
										>
											<svg
												class="h-8 w-8 text-orange-600"
												width="24"
												height="24"
												viewBox="0 0 24 24"
												stroke-width="2"
												stroke="currentColor"
												fill="none"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path stroke="none" d="M0 0h24v24H0z" />
												<path d="M4 7v-1a2 2 0 0 1 2 -2h2" />
												<path d="M4 17v1a2 2 0 0 0 2 2h2" />
												<path d="M16 4h2a2 2 0 0 1 2 2v1" />
												<path d="M16 20h2a2 2 0 0 0 2 -2v-1" />
												<line x1="5" y1="12" x2="19" y2="12" />
											</svg>
										</button>
									</div>
								</div>
							</div>
							<div>&nbsp;</div>
							<div>
								<div class="mb-4">
									<label class="block text-gray-700 text-sm font-bold mb-2" for="changeAddress">
										Change Address
									</label>
									<div class="flex">
										<input
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
											id="changeAddress"
											type="text"
											placeholder="Change address"
											bind:value={changeAddress}
										/>
										<button
											on:click={() => {
												scanTarget = 'change';
												scanOpen = true;
											}}
											class="ml-2"
										>
											<svg
												class="h-8 w-8 text-orange-600"
												width="24"
												height="24"
												viewBox="0 0 24 24"
												stroke-width="2"
												stroke="currentColor"
												fill="none"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path stroke="none" d="M0 0h24v24H0z" />
												<path d="M4 7v-1a2 2 0 0 1 2 -2h2" />
												<path d="M4 17v1a2 2 0 0 0 2 2h2" />
												<path d="M16 4h2a2 2 0 0 1 2 2v1" />
												<path d="M16 20h2a2 2 0 0 0 2 -2v-1" />
												<line x1="5" y1="12" x2="19" y2="12" />
											</svg>
										</button>
									</div>
								</div>
							</div>
							<div>&nbsp;</div>
							<TransactionDetails
								{transactionFee}
								{totalAmount}
								{selectedUtxosSum}
								{changeAmount}
							/>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<button
									on:click={() => activeTimeLine--}
									class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
									>Back</button
								>
							</div>
							<div>
								<button
									on:click={() => activeTimeLine++}
									class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
									>Next</button
								>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="mb-8 flex items-center">
				<div class="absolute w-8 h-8 bg-blue-500 rounded-full -left-4 border-4 border-white"></div>
				<div class="ml-6">
					<h3 class="font-bold">4. Review, Scan or Copy PSBT Transaction</h3>
					{#if activeTimeLine === 3}
						<div class="border-b border-gray-200">
							<nav class="-mb-px flex">
								<a
									class="border-b-2 {activePanel === 'psbtQR'
										? 'border-blue-500 text-blue-600'
										: 'border-transparent text-gray-500'} py-2 px-4 text-sm font-medium hover:text-gray-700 hover:border-gray-300"
									href="#"
									on:click|preventDefault={() => (activePanel = 'psbtQR')}>PSBT QR</a
								>
								<a
									class="border-b-2 {activePanel === 'psbtFile'
										? 'border-blue-500 text-blue-600'
										: 'border-transparent text-gray-500'} py-2 px-4 text-sm font-medium hover:text-gray-700 hover:border-gray-300"
									href="#"
									on:click|preventDefault={() => (activePanel = 'psbtFile')}>PSBT File</a
								>
								<a
									class="border-b-2 {activePanel === 'metadata'
										? 'border-blue-500 text-blue-600'
										: 'border-transparent text-gray-500'} py-2 px-4 text-sm font-medium hover:text-gray-700 hover:border-gray-300"
									href="#"
									on:click|preventDefault={() => (activePanel = 'metadata')}>Metadata.json</a
								>
							</nav>
						</div>
						<div class="py-4">
							{#if errorMessage}
								<p class="text-red-500">{errorMessage}</p>
							{:else if activePanel === 'psbtQR'}
								{#if qrCode}
									{@html qrCode}
								{:else}
									<p>Loading QR code...</p>
								{/if}
							{:else if activePanel === 'psbtFile'}
								<textarea
									class="w-full h-40 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									readonly
									on:click={() => copyToClipboard(psbtBaseText)}>{psbtBaseText}</textarea
								>
								<p class="text-sm text-gray-500 mt-2">
									Click on the text area to copy the PSBT to clipboard
								</p>
							{:else if activePanel === 'metadata'}
								<pre class="bg-gray-100 p-4 rounded-md overflow-auto">
              {JSON.stringify(metadataJSON, null, 2)}
            </pre>
							{/if}

							<TransactionDetails
								{transactionFee}
								{totalAmount}
								{selectedUtxosSum}
								{changeAmount}
							/>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<button
									on:click={() => activeTimeLine--}
									class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
									>Back</button
								>
							</div>
							<div>
								<button
									on:click={handleFinish}
									class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
									>Finish</button
								>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(.nameDoi) {
		padding: 1rem;
		font-size: small !important;
		background-color: #f1f3f5;
		color: var(--text-3);
	}

	.nameShow {
		overflow-x: hidden;
	}

	.nameShow input[type='text'],
	.nameShow textarea {
		max-width: 100%;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
	.animate-pulse {
		animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
	.utxo-item {
		margin-bottom: 10px; /* Add space between items */
	}
	.tooltip {
		position: absolute;
		background-color: #333;
		color: #fff;
		padding: 5px;
		border-radius: 4px;
		font-size: 12px;
		visibility: hidden;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.utxo-item:hover .tooltip {
		visibility: visible;
		opacity: 1;
	}
</style>
