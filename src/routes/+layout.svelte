<script>
	import { helia, libp2p, nameOps } from '$lib/doichain/doichain-store.js';
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { createLibp2p } from 'libp2p';
	import { createHelia, libp2pDefaults } from 'helia';
	import { LevelBlockstore } from 'blockstore-level';
	import { LevelDatastore } from 'datastore-level';
	import { createLibp2pConfig } from '$lib/config/libp2p-config';
	import { setupLibp2pEventHandlers } from '$lib/handlers/libp2pEventHandler.js';
	import LibP2PTransportTags from '$lib/components/LibP2PTransportTags.svelte';

	const CONTENT_TOPIC = '/doichain-nfc/1/message/proto';
	const config = createLibp2pConfig();

	let blockstore = new LevelBlockstore('./helia-blocks');
	let datastore = new LevelDatastore('./helia-data');
	let addressUpdateInterval;

	let attemptCount = 0;
	const maxAttempts = 5;

	function publishList100Request() {
		// Check if we should continue publishing requests
		if (attemptCount < maxAttempts && (!$nameOps || $nameOps.length === 0)) {
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

	function updateNodeAddresses() {
		const newAddresses = $libp2p.getMultiaddrs().map((ma) => ma.toString());
		nodeAddresses = [...new Set(newAddresses)];
		console.log('Updated node addresses:', nodeAddresses);
	}

	onMount(async () => {
		$libp2p = await createLibp2p(config);
		window.libp2p = $libp2p;

		nodeAddresses = $libp2p.getMultiaddrs().map((ma) => ma.toString());
		console.log('Our node addresses:', nodeAddresses);

		$helia = await createHelia({ libp2p: $libp2p, datastore: datastore, blockstore: blockstore });
		window.helia = $helia;

		try {
			if ($libp2p) {
				setupLibp2pEventHandlers($libp2p, publishList100Request);
			}
		} catch (ex) {
			console.log('helia.libp2p.exception', ex);
		}

		updateNodeAddresses();

		addressUpdateInterval = setInterval(() => {
			updateNodeAddresses();
		}, 20000);

		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.then((registration) => {
					console.log('Service Worker registered with scope:', registration.scope);
				})
				.catch((error) => {
					console.error('Service Worker registration failed:', error);
				});
		}
	});

	onDestroy(() => {
		clearInterval(addressUpdateInterval);
	});
</script>

<body class="bg-gray-50 text-gray-900 flex flex-col min-h-screen pb-[footer-height]">
	<div class="flex-grow">
		<section class="flex items-center justify-center mt-8">
			<div class="text-center max-w-4xl mx-auto px-4">
				<div class="flex justify-center mb-12">
					<div class="bg-gray-900 rounded-full p-4">
						<img src="/doichain_logo-min.svg" alt="Doichain Logo" class="h-16" />
					</div>
				</div>
			</div>
		</section>

		<main class="mb-16">
			<slot />
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
</body>

<style lang="postcss">
	body {
		font-family: 'Poppins', sans-serif;
	}

	textarea {
		min-height: 60px;
		max-height: 200px;
		overflow-y: auto;
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
</style>
