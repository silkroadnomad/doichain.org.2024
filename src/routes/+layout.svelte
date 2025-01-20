<script>
	// External Libraries
	import { createHelia } from 'helia';
	import { createLibp2p } from 'libp2p';
	import { createOrbitDB, Identities, KeyStore } from '@orbitdb/core';
	import { base58btc } from 'multiformats/bases/base58';
	import { CID } from 'multiformats/cid'
	import { multiaddr } from '@multiformats/multiaddr';
	import { unixfs } from '@helia/unixfs';
	import { onMount } from 'svelte';
	import { LevelBlockstore } from 'blockstore-level';
	import { LevelDatastore } from 'datastore-level';

	// Styles
	import '../app.css';

	// Internal Modules
	import { browser } from '$app/environment';
	import { CONTENT_TOPIC } from '$lib/doichain/doichain.js';
	import { getConnectionStatus } from '$lib/doichain/connectElectrum.js';
	import { setupElectrumConnection } from '$lib/doichain/electrumConnection.js'; 
	import { publishCID } from '$lib/doichain/nameDoi.js';
	import { getNameIdData } from '$lib/doichain/namePage.js';
	import {
		connectedServer,
		electrumClient,
		helia,
		libp2p,
		connectedPeers,
		nameOps,
		network,
		orbitdb
	} from '$lib/doichain/doichain-store.js';
	import { createLibp2pConfig } from '$lib/config/libp2p-config';
	import { setupLibp2pEventHandlers } from '$lib/handlers/libp2pEventHandler.js';
	import { currentNameId } from '$lib/hashRouter';

	// Components
	import LibP2PTransportTags from '$lib/components/LibP2PTransportTags.svelte';
	import NameShow from '$lib/components/nameShow.svelte';
	import SplashScreen from '$lib/components/SplashScreen.svelte';

	const config = createLibp2pConfig();

	let blockstore = new LevelBlockstore('./helia-blocks');
	let datastore = new LevelDatastore('./helia-data');
	let isConnected = false;
	let attemptCount = 0;
	const maxAttempts = 5;
	let gatewayUrl = '';
	let isDarkMode = false;
	let agreed = false;
	let showSplash = true;
	let initialized = false;

	/**
	 * Generates and publishes an HTML page for a nameId to IPFS
	 * @param {string} nameId - The name identifier
	 * @param {string} blockDate - The date from the blockchain
	 * @param {string} description - Description of the name
	 * @param {string} imageCid - IPFS CID of the associated image
	 * @returns {Promise<string>} The IPFS CID of the generated HTML page
	 */
	async function writeNameIdHTMLToIPFS(nameId, blockDate, description, imageCid) {
		const encoder = new TextEncoder();
		const fs = unixfs($helia);

		try {
			const { generateNameIdHTML } = await import('$lib/doichain/namePage.js');
			const htmlString = await generateNameIdHTML(
				nameId,
				blockDate,
				description,
				`https://ipfs.le-space.de/ipfs/${imageCid}`
			);

			const cid = await fs.addBytes(encoder.encode(htmlString));
			console.log('Added nameId HTML to IPFS:', cid.toString());

			await publishCID(cid.toString());

			return cid.toString();
		} catch (error) {
			console.error('Error in writeNameIdHTMLToIPFS:', error);
			throw error;
		}
	}

	function publishList100Request() {
		// if (attemptCount < maxAttempts && (!$nameOps || $nameOps.length === 0)) {
		if (attemptCount < maxAttempts) {
			try {
				const messageObject = {
					type: 'LIST',
					dateString: 'LAST',
					pageSize: 10,
					from: 0,
					filter: '' // Add any specific filter if needed
				};

				const message = JSON.stringify(messageObject);
				$libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode(message));
				console.log(`Published request for LIST_LAST_100 (Attempt ${attemptCount + 1})`, message);
				attemptCount++;

				// Schedule next attempt after 5 seconds
				setTimeout(() => {
					publishList100Request();
				}, 5000);
			} catch (error) {
				console.error('Error publishing LIST_LAST_100 message:', error);
			}
		} else {
			console.log(
				'Stopping LIST_LAST_100 requests: either max attempts reached or nameOps received.',
				nameOps.length
			);
		}
	}

	let nodeAddresses = [];
	$: {
		if ($connectedPeers && $connectedPeers.length > 0) {
			updateNodeAddresses();
		}
	}

	function updateNodeAddresses() {
		const newAddresses = $libp2p.getMultiaddrs().map((ma) => ma.toString());
		nodeAddresses = [...new Set(newAddresses)];
		console.log('Updated node addresses:', nodeAddresses);
	}

	// Function to detect system dark mode preference
	function detectSystemDarkMode() {
		const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
		isDarkMode = false //prefersDarkScheme.matches;

		// Listen for changes in the system preference
		prefersDarkScheme.addEventListener('change', (event) => {
			isDarkMode = event.matches;
		});
	}

	function generateAndPublishHTMLPage() {
		console.log('Generate and publish HTML page for', $currentNameId);
		try {
			getNameIdData($electrumClient, $helia, $currentNameId).then((nameData) => {
				console.log('nameData', nameData);
				writeNameIdHTMLToIPFS(
					$currentNameId,
					nameData.blockDate,
					nameData.description,
					nameData.imageCid
				).then((htmlCid) => {
					// Forward to IPFS gateway
					gatewayUrl = `https://ipfs.le-space.de/ipfs/${htmlCid}`;
					console.log('HTML page available at:', gatewayUrl);
					console.log('Added HTML page to IPFS:', htmlCid);
				});
			});
		} catch (error) {
			console.error('Error generating HTML page:', error);
			// Don't throw error to avoid blocking metadata publishing
		}
	}

	// Move initialization logic into a separate function
	async function initializeServices() {
		const agreed = localStorage.getItem('splashAgreed');
		if (!agreed) {
			console.log('Cannot initialize services before splash screen agreement');
			return;
		}

		try {
			// $libp2p = await createLibp2p({...config}); //incl. global libp2p network, webtransport etc.
			$libp2p = await createLibp2p(config);	
			window.libp2p = $libp2p;
			
			nodeAddresses = $libp2p.getMultiaddrs().map((ma) => ma.toString());
			console.log('Our node addresses:', nodeAddresses);

			// Initialize Helia
			$helia = await createHelia({ libp2p: $libp2p, datastore: datastore, blockstore: blockstore });
			const identities = await Identities({ ipfs: $helia })
			const identity = await identities.createIdentity({ id: 'me' })
			const cid = CID.parse(identity.hash, base58btc)
			console.log("identity cid",cid.toString())
			console.log("libp2p peerId:",$helia.libp2p.peerId.toString())
			window.helia = $helia;
			try {
				$orbitdb = await createOrbitDB({ 
					ipfs: $helia,
					identity: identity
				//	identity: await identities.createIdentity({ id: $helia.libp2p.peerId.toString() })
				});
				console.log('OrbitDB initialized',$orbitdb);
			} catch (error) {
				console.error('Error initializing OrbitDB:', error);
			}

			window.dialMultiaddr = (multiaddr_string) => {
				const addr = multiaddr(multiaddr_string);
				return $libp2p.dial(addr);
			};

			if ($libp2p) {
				setupLibp2pEventHandlers($libp2p, publishList100Request);
			}

			// Initialize electrum connection
			const { isConnected } = getConnectionStatus($connectedServer);
			if (!isConnected) {
				await setupElectrumConnection($network);

				if ($currentNameId) {
					generateAndPublishHTMLPage();
				}
			}

			// Set initialized to true only after everything is ready
			initialized = true;
			console.log('All services initialized successfully');
		} catch (error) {
			console.error('Error initializing services:', error);
			initialized = false;
		}
	}

	onMount(async () => {
		console.log("localStorage",localStorage.getItem('selectedFilter'))
		if (browser) {
			agreed = localStorage.getItem('splashAgreed');
			showSplash = !agreed;
			
			if (!showSplash) {
				initializeServices();
			}

			if ('serviceWorker' in navigator) {
				navigator.serviceWorker.register('/service-worker.js')
					.then((registration) => {
						console.log('Service Worker registered with scope:', registration.scope);
					})
					.catch((error) => {
						console.log('Service Worker not enabled!');
					});
			}
		}
		
		detectSystemDarkMode();
		return async () => {
			// ... existing cleanup code ...
			try {
				if ($orbitdb) {
					await $orbitdb.stop();
					$orbitdb.set(null);
					console.log('OrbitDB closed');
				}
			} catch (error) {
				console.error('Error closing OrbitDB:', error);
			}
		};
	});

	async function closeSplash() {
		showSplash = false;
		localStorage.setItem('splashAgreed', 'true');
		// Initialize services after splash screen is closed
		await initializeServices();
	}

	// Function to copy the URL to the clipboard
	function copyToClipboard() {
		navigator.clipboard
			.writeText(gatewayUrl)
			.then(() => {
				alert('URL copied to clipboard!');
			})
			.catch((err) => {
				console.error('Failed to copy: ', err);
			});
	}
	
</script>

<body class="bg-gray-50 text-gray-900 flex flex-col min-h-screen pb-[footer-height]">
	<div class={isDarkMode ? 'dark-mode' : ''}>
		{#if showSplash}
			<SplashScreen onClose={closeSplash} />
		{/if}
		<div class="flex-grow">
			<section class="flex items-center justify-center mt-8">
				<div class="text-center max-w-4xl mx-auto px-4">
					<div class="flex justify-center mb-12">
						<div class="bg-gray-900 rounded-full p-4">
							<div
								on:click={() => {
									window.location.href = '/';
								}}
							>
								<img src="/doichain_logo-min.svg" alt="Doichain Logo" class="h-16" />
							</div>
						</div>
					</div>
				</div>
			</section>

			<main class="mb-16">
				{#if $currentNameId}
					<div class="container mx-auto px-4">
						<NameShow nameId={$currentNameId} />
						<!-- Share Button -->
						<button
							on:click={copyToClipboard}
							class="bg-blue-500 text-white px-4 py-2 rounded mt-4"
						>
							Copy Share URL
						</button>
					</div>
				{:else}
					<slot />
				{/if}
			</main>
		</div>

		<footer class="fixed bottom-2 left-0 right-0 z-50">
			<div class="container mx-auto px-4 py-2">
				<div class="network-stats-grid">
					<div class="stat-card group">
						<div class="flex items-center gap-2 mb-1">
							<LibP2PTransportTags class="interactive-stats" variant="stats" />
						</div>
					</div>
				</div>
			</div>
		</footer>

		<div class="fixed inset-0 pointer-events-none">
			{#each nodeAddresses as address, i}
				<div
					class="constellation-node"
					style="
					--x: {Math.random() * 100}%;
					--y: {Math.random() * 100}%;
					--speed: {3 + Math.random() * 2}s;
				"
				>
					<div class="h-2 w-2 bg-blue-400 rounded-full" />
					<div class="tooltip">
						<code class="text-xs">{address}</code>
					</div>
				</div>
		{/each}
	</div>
	</div>
</body>

<style lang="postcss">
	body {
		font-family: 'Poppins', sans-serif;
	}
	:global(body) {
		padding-bottom: calc(var(--footer-height, 32px) + 1rem);
	}

	footer {
		@apply mx-2;
		height: var(--footer-height, 32px);
		transition: transform 0.3s ease;
	}

	:global(.interactive-stats .transport-tag) {
		@apply px-1.5 py-0.5 rounded-full text-xs transition-all duration-200;
		@apply bg-gray-200 text-gray-600;
		@apply cursor-pointer;
	}

	:global(.interactive-stats .transport-tag:hover) {
		@apply bg-blue-500 text-white;
		transform: scale(1.1);
	}

	:global(.interactive-stats) {
		@apply flex flex-wrap gap-1.5;
	}

	.constellation-node {
		@apply absolute pointer-events-auto cursor-pointer;
		left: var(--x);
		top: var(--y);
		animation: pulse var(--speed) ease-in-out infinite;
	}

	.tooltip {
		@apply invisible absolute -top-8 bg-black text-white p-2 rounded whitespace-nowrap;
		transform: translateX(-50%);
		left: 50%;
		z-index: 50;
	}

	.constellation-node:hover .tooltip {
		@apply visible;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.2);
			opacity: 1;
		}
		100% {
			transform: scale(1);
			opacity: 0.5;
		}
	}

	.dark-mode {
		background-color: #121212;
		color: #ffffff;
	}

	.toggle-dark-mode {
		position: absolute;
		top: 10px;
		left: 10px;
		background-color: #007bff;
		color: white;
		border: none;
		padding: 5px 10px;
		cursor: pointer;
		border-radius: 5px;
	}

	.toggle-dark-mode:hover {
		background-color: #0056b3;
	}
</style>
