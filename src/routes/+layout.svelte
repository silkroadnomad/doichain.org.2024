<script>
	import { helia, libp2p, connectedPeers, nameOps} from '$lib/doichain/doichain-store.js'
	import "../app.css";
	import Navigation from './navigation.svelte'
	import { onMount, onDestroy } from "svelte";
	import { browser } from '$app/environment';
	import { createLibp2p } from 'libp2p'
	import { createHelia, libp2pDefaults } from 'helia'
	import { LevelBlockstore } from "blockstore-level"
	import { LevelDatastore } from "datastore-level";
	import { createLibp2pConfig } from '$lib/config/libp2p-config'
	import { setupLibp2pEventHandlers } from '$lib/handlers/libp2pEventHandler.js'

	//const pubsubPeerDiscoveryTopics = import.meta.env.VITE_P2P_PUPSUB?.split(',') || ['doichain._peer-discovery._p2p._pubsub','_peer-discovery._p2p._pubsub']
	const pubsubPeerDiscoveryTopics = import.meta.env.VITE_P2P_PUPSUB?.split(',') || ['doichain._peer-discovery._p2p._pubsub']
	const CONTENT_TOPIC = '/doichain-nfc/1/message/proto';

	const config = createLibp2pConfig()

	let blockstore = new LevelBlockstore("./helia-blocks")
	let datastore = new LevelDatastore("./helia-data")
	let addressUpdateInterval;

	let attemptCount = 0;
	const maxAttempts = 5;

	function publishList100Request() {
		if (attemptCount < maxAttempts) {
			try {
				$libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode('LIST_LAST_100'));
				console.log(`Published request for LIST_LAST_100 (Attempt ${attemptCount + 1})`);
				attemptCount++;
				
				// Schedule next attempt after 5 seconds if no response
				setTimeout(() => {
						publishList100Request();
				}, 5000);
			} catch (error) {
				console.error("Error publishing LIST_LAST100 message:", error);
			}
		} else {
			console.log("Max attempts reached, stopping LIST_LAST_100 requests.");
		}
	}

	let nodeAddresses = [];

	function updateNodeAddresses() {
		const newAddresses = $libp2p.getMultiaddrs().map(ma => ma.toString());
		// Use Set to remove duplicates
		nodeAddresses = [...new Set(newAddresses)];
		console.log('Updated node addresses:', nodeAddresses);
	}

	onMount(async () => {
		$libp2p = await createLibp2p(config)
		window.libp2p = $libp2p

		// Print node's multiaddresses
		nodeAddresses = $libp2p.getMultiaddrs().map(ma => ma.toString());
		console.log('Our node addresses:', nodeAddresses);

		$helia = await createHelia({ libp2p: $libp2p, datastore: datastore, blockstore: blockstore})
		window.helia = $helia

		try {
			if($libp2p) {
				setupLibp2pEventHandlers($libp2p, publishList100Request)
			}
			} catch(ex){ console.log("helia.libp2p.exception", ex) }

			updateNodeAddresses();

			addressUpdateInterval = setInterval(() => {
				updateNodeAddresses();
			}, 60000);

			if (browser && 'serviceWorker' in navigator) {
				navigator.serviceWorker.register('/service-worker.js')
					.then((registration) => {
						console.log('Service Worker registered with scope:', registration.scope);
					})
					.catch((error) => {
						console.error('Service Worker registration failed:', error);
					});
			}
		})
		
		onDestroy(() => {
			clearInterval(addressUpdateInterval);
		});
		
	</script>

	<body class="bg-gray-50 text-gray-900 flex flex-col min-h-screen">
		<section class="flex items-center justify-center mt-8">
			<div class="text-center max-w-4xl mx-auto px-4">
				<div class="flex justify-center mb-12">
					<div class="bg-gray-900 rounded-full p-4">
						<img src="/doichain_logo-min.svg" alt="Doichain Logo" class="h-16">
					</div>
				</div>
			</div>
		</section>

		<main class="flex-grow mb-16">
			<slot />
		</main>

		<div class="fixed bottom-0 left-0 right-0 z-50">
			<Navigation />
		</div>

		<!-- Add this section to display the addresses -->
		<section class="mt-4 px-4">
			<h2 class="text-xl font-bold mb-2">Node Addresses:</h2>
			<ul class="list-disc pl-5">
				{#each nodeAddresses as address}
					<li class="mb-1">{address}</li>
				{/each}
			</ul>
		</section>
	</body>

	<style>
		body {
			font-family: 'Poppins', sans-serif;
		}
	</style>

