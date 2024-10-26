<script>
	import { helia, libp2p, connectedPeers, nameOps} from '$lib/doichain/doichain-store.js'
	import "../app.css";
	import Navigation from './navigation.svelte'
	import { onMount, onDestroy } from "svelte";
	import { browser } from '$app/environment';
	import { decodeMessage } from 'protons-runtime'
	import { createLibp2p } from 'libp2p'
	import { bootstrap } from '@libp2p/bootstrap'
	import { createHelia, libp2pDefaults } from 'helia'
	import { LevelBlockstore } from "blockstore-level"
	import { LevelDatastore } from "datastore-level";
	import { gossipsub } from "@chainsafe/libp2p-gossipsub";
	import { webSockets } from '@libp2p/websockets'
	import * as filters from '@libp2p/websockets/filters'
	import { noise } from '@chainsafe/libp2p-noise'
	// import { tls } from '@libp2p/tls'
	import { circuitRelayTransport, circuitRelayServer } from '@libp2p/circuit-relay-v2'
	import { webRTC, webRTCDirect } from '@libp2p/webrtc'
	import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
	import { webTransport } from '@libp2p/webtransport';
	import { ping } from '@libp2p/ping'
	import { identify } from '@libp2p/identify'
	import { autoNAT } from '@libp2p/autonat'
	import { dcutr } from '@libp2p/dcutr'
	import { multiaddr } from '@multiformats/multiaddr'
	import { yamux } from '@chainsafe/libp2p-yamux'
	import { logger } from '@libp2p/logger'

	//const pubsubPeerDiscoveryTopics = import.meta.env.VITE_P2P_PUPSUB?.split(',') || ['doichain._peer-discovery._p2p._pubsub','_peer-discovery._p2p._pubsub']
	const pubsubPeerDiscoveryTopics = import.meta.env.VITE_P2P_PUPSUB?.split(',') || ['doichain._peer-discovery._p2p._pubsub']
	const CONTENT_TOPIC = '/doichain-nfc/1/message/proto';

	const config = libp2pDefaults()

	// If you want to ensure the ping service is included:
	config.services = {
		...config.services,
		ping: ping(),
		identify: identify(),
		autoNAT: autoNAT(),
		dcutr: dcutr(),
	}

	let blockstore = new LevelBlockstore("./helia-blocks")
	let datastore = new LevelDatastore("./helia-data")
//https://github.com/libp2p/js-libp2p/blob/3244ed08625516b25716485c936c26a34b69466a/doc/migrations/v0.42-v0.43.md
	config.addresses = { listen: ['/p2p-circuit','/webrtc','/webrtc-direct','/wss','/ws']}

	config.transports =  [
		webSockets({ filter: filters.all}),
		// webTransport(),
		webRTC({ //https://www.npmjs.com/package/@libp2p/webrtc
			rtcConfiguration: {
				iceServers: [
					{ urls: 'stun:stun.l.google.com:19302' },
					{ urls: 'stun:stun1.l.google.com:19302' },
					{ urls: 'stun:stun2.l.google.com:19302' },
					{ urls: 'stun:stun3.l.google.com:19302' },
					{ urls: 'stun:stun4.l.google.com:19302' },
					// Add a TURN server if possible
					// { urls: 'turn:your-turn-server.com:3478', username: 'username', credential: 'password' }
				]
			}
		}),
		webRTCDirect(),
		circuitRelayTransport({
			discoverRelays: 1
		})
	]

	// Ensure proper connection encryption and stream multiplexing
	config.connectionEncrypters = [
   	 noise()
  	]
	config.streamMuxers = [
		yamux({
			enableKeepAlive: true,
			keepAliveInterval: 10000, // 10 seconds
			keepAliveTimeout: 30000, // 30 seconds
		})
	]

	config.connectionManager = {
		...config.connectionManager,
		maxConnections: 50, // Adjust as needed
		autoDialInterval: 10000, // 10 seconds
		autoDial: true,
	}

	const newPubsub = {...config.services.pubsub, ...{ services: { 
		pubsub: gossipsub({ 
			emitSelf: false, 
			allowPublishToZeroTopicPeers: true, 
			canRelayMessage: true 
		}) 
	} }}
	config.services.pubsub = newPubsub.services.pubsub
	delete config.services['delegatedRouting']

	config.connectionGater =  {
		denyDialMultiaddr: (multiaddr) => {
			// by default we refuse to dial local addresses from browsers since they
			// are usually sent by remote peers broadcasting undialable multiaddrs and
			// cause errors to appear in the console but in this example we are
			// explicitly connecting to a local node so allow all addresses
			return false;
		}
	}

	const log = logger('doichain:pubsub')

	// const newPubSubPeerDiscovery = [...config.peerDiscovery, ...[
	// 	bootstrap({ list: 
	// 		[
	// 		'/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWRBemKo6NDuXZfpxuHJZ5UNEVamgBN5geoVq6Vk62NREH',
	// 		// '/dns4/istanbul.le-space.de/tcp/443/wss/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'
	// 		]
	// 	}),
	// 	pubsubPeerDiscovery({
	// 		interval: 10000,
	// 		topics: pubsubPeerDiscoveryTopics,
	// 		listenOnly: false
	// 	})
	// ]]
	const newPubSubPeerDiscovery = [
		bootstrap({ list: 
			[
				// '/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWQpeSaj6FR8SpnDzkESTXY5VqnZVWNUKrkqymGiZTZbW2',
			'/dns4/istanbul.le-space.de/tcp/443/wss/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'
			]
		}),
		pubsubPeerDiscovery({
			interval: 10000,
			topics: pubsubPeerDiscoveryTopics,
			listenOnly: false
		})
	]

	let hasReceivedList100 = false;
	config.peerDiscovery = newPubSubPeerDiscovery

	let attemptCount = 0;
	const maxAttempts = 5;

	function publishList100Request() {
		if (!hasReceivedList100 && attemptCount < maxAttempts) {
			try {
				$libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode('LIST_LAST_100'));
				console.log(`Published request for LIST_LAST_100 (Attempt ${attemptCount + 1})`);
				attemptCount++;
				
				// Schedule next attempt after 5 seconds if no response
				setTimeout(() => {
					if (!hasReceivedList100) {
						publishList100Request();
					}
				}, 5000);
			} catch (error) {
				console.error("Error publishing LIST_LAST100 message:", error);
			}
		} else if (hasReceivedList100) {
			console.log("Received LIST_LAST_100 response, stopping requests.");
		} else {
			console.log("Max attempts reached, stopping LIST_LAST_100 requests.");
		}
	}

	const CLEAR_PEERSTORE_ON_START = true // or false, or make it an environment variable

	let nodeAddresses = [];

	const peerCodec = {
  encode: () => {
    throw new Error('Encoding not implemented')
  },
  decode: (reader) => {
    const obj = {
      publicKey: new Uint8Array(0),
      addrs: []
    }

    while (reader.pos < reader.len) {
      const tag = reader.uint32()

      switch (tag >>> 3) {
        case 1:
          obj.publicKey = reader.bytes()
          break
        case 2:
          obj.addrs.push(reader.bytes())
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }

    return obj
  }
}

	onMount(async () => {
		$libp2p = await createLibp2p(config)
		window.libp2p = $libp2p

		// Print node's multiaddresses
		nodeAddresses = $libp2p.getMultiaddrs().map(ma => ma.toString());
		console.log('Our node addresses:', nodeAddresses);

		if (CLEAR_PEERSTORE_ON_START) {
			await clearPeerStore($libp2p)
		}

		$helia = await createHelia({ libp2p: $libp2p, datastore: datastore, blockstore: blockstore})
		window.helia = $helia

		try {
			if($libp2p) {
				$libp2p.services.pubsub.subscribe(CONTENT_TOPIC)
				const pubsub = $libp2p.services.pubsub;
				pubsub.addEventListener('message', async (event) => {
				console.log(`Received pubsub message from ${event.detail.from} on topic ${event.detail.topic}`)
				

				if (event.detail.topic === 'doichain._peer-discovery._p2p._pubsub') {
					try {
						const peer = decodeMessage(event.detail.data, peerCodec)
						console.log("peer",peer)
						// Format the public key as a hex string
						const publicKeyHex = Buffer.from(peer.publicKey).toString('hex')
						console.log("publicKeyHex",publicKeyHex)
						// Format the addresses
						const formattedAddrs = peer.addrs.map(addr => {
							try {
								//dial the address
								$libp2p.dial(multiaddr(addr))
								return multiaddr(addr).toString()
							} catch (err) {
								return `<invalid multiaddr: ${Buffer.from(addr).toString('hex')}>`
							}
						})

						// console.info('Discovered peer on %s:', topic)
						// console.info('  Public Key: %s', publicKeyHex)
						console.info('  Addresses:')
						formattedAddrs.forEach((addr, index) => {
							console.info(`    ${index + 1}. ${addr}`)
						})

					} catch(err) {
						console.error('Error processing peer discovery message:', err)
					}
				} 

				if (event.detail.topic === CONTENT_TOPIC) {
						const message = new TextDecoder().decode(event.detail.data);
						if(message.startsWith('ADDING-CID') || message.startsWith('ADDED-CID') || message.startsWith('PINNING-CID') || message.startsWith('PINNED-CID')){
							console.log("ignoring cid messages for now", message)
						} 
						else if (message === 'LIST_LAST_100') {
							console.log("Received request for LIST_LAST_100");
							if ($nameOps.length > 0) {
								const lastNameOps = $nameOps.slice(0, 100); // Get the last 100 items
								console.log(`Publishing last ${lastNameOps.length} NameOps`,lastNameOps);
								const jsonString = JSON.stringify(lastNameOps);
								$libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode(jsonString));
							} else {
								console.log("No NameOps found");
								$libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode("LAST_100_CIDS:NONE"));
							}
						}
						else if (
							message.startsWith('LIST_DATE:') 
							|| message.startsWith('LIST_ALL') 
							|| message.endsWith(':NONE')
						){
							console.log("ignoring other list messages for now", message)
						}
						else {
							// if (!hasReceoivedList100) {
									$nameOps = []
									try {
										const jsonMessage = JSON.parse(message);
										const newNameOps = jsonMessage.filter(newOp => {
											// Check if this operation already exists in $nameOps
											return !$nameOps.some(existingOp => 
												existingOp.currentNameUtxo?.txid === newOp.currentNameUtxo?.txid
											);
										});

										if (newNameOps.length > 0) {
											// Combine existing and new unique nameOps, then sort
											$nameOps = [...$nameOps, ...newNameOps].sort((a, b) => {
												const timeA = a.blocktime || 0;
												const timeB = b.blocktime || 0;
												return timeB - timeA;
											});

											console.log(`Added ${newNameOps.length} new unique nameOps. Total nameOps after update:`, $nameOps.length);
										} else {
											console.log("No new unique nameOps to add.");
										}

										hasReceivedList100 = true;
									} catch (e) {
										console.log("message", message);
										console.error('Failed to parse message:', e);
									}
							// }
						}
					} else{
						// console.log("message", new TextDecoder().decode(event.detail.data));	
					}
			});
		
			$libp2p.addEventListener('connection:open',  (p) => {
					$connectedPeers = [...$connectedPeers,p.detail]
					// add the connected peer to $connectedPeers
					console.log("connectedPeers",p.detail.remoteAddr.toString())
			});
			
			$libp2p.addEventListener('connection:close', (p) => {
				// $connectedPeers = $connectedPeers - 1
				// remove the closed peer from $connectedPeers 
				$connectedPeers = $connectedPeers.filter(peer => peer.id !== p.detail.id)
			});

$libp2p.addEventListener('peer:discovery', async (evt) => {
  const peer = evt.detail
  console.log('Discovered peer:', peer.id.toString())
  console.log('Peer multiaddrs:', peer.multiaddrs.map(ma => ma.toString()))

  for (const addr of peer.multiaddrs) {
    try {
      const connection = await $libp2p.dial(addr)
      console.log('Connected to discovered peer:', peer.id.toString())
      console.log('Using multiaddr:', addr.toString())
      break // Exit the loop if successful
    } catch (err) {
      console.error('Failed to connect to discovered peer:', peer.id.toString())
      console.error('Failed multiaddr:', addr.toString())
      console.error('Error:', err)
    }
  }
})

			let datesToRequest = [];
			let currentDate = new Date();
			const daysToGoBack = 30; // Adjust this value as needed

			// Populate the initial list of dates
			for (let i = 0; i < daysToGoBack; i++) {
				let date = new Date(currentDate);
				date.setDate(currentDate.getDate() - i);
				datesToRequest.push(date.toISOString().split('T')[0]);
			}

			$libp2p.addEventListener('peer:connect', (event) => {
				 $connectedPeers 
					publishList100Request();
					// Set up interval to publish messages every 5 seconds
					/*const publishInterval = setInterval(async () => {
						if (datesToRequest.length > 0) {
							const dateToRequest = datesToRequest[0];
							try {
								await $libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode(`LIST_DATE:${dateToRequest}`));
								console.log(`Published request for date: ${dateToRequest}`);
							} catch (error) {
								console.error("Error publishing message:", error);
							}
						} else {
							console.log("All dates have been requested and processed.");
							clearInterval(publishInterval);
						}
					}, 5000); // 5000 milliseconds = 5 seconds*/

					// Clean up the interval when the component is destroyed
					return () => clearInterval(publishInterval)
				// }
			})

			// Log when we're publishing a peer discovery message
			$libp2p.services.pubsub.addEventListener('publish', (evt) => {
				if (evt.detail.topic === pubsubPeerDiscoveryTopics || evt.detail.topic === '_peer-discovery._p2p._pubsub') {
					log('Publishing peer discovery message on topic:', evt.detail.topic)
				}
			})

			// Log when we receive a peer discovery message
			$libp2p.services.pubsub.addEventListener('message', (evt) => {
				if (evt.detail.topic === pubsubPeerDiscoveryTopics || evt.detail.topic === '_peer-discovery._p2p._pubsub') {
					log('Received peer discovery message on topic:', evt.detail.topic)
					// You can add more detailed logging here if needed
					// const message = new TextDecoder().decode(evt.detail.data)
					// log('Peer discovery message content:', message)
				}
			})

			// Log when we discover a new peer
			$libp2p.addEventListener('peer:discovery', (evt) => {
				log('Discovered new peer:', evt.detail.id.toString())
			})

		}
		// await $helia.libp2p.dial(multiaddr('/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'))
			// console.log("topics",$helia.libp2p.services.pubsub.getTopics())


		} catch(ex){ console.log("helia.libp2p.exception", ex) }

		// Set up an interval to periodically update the addresses
		const addressUpdateInterval = setInterval(() => {
			nodeAddresses = $libp2p.getMultiaddrs().map(ma => ma.toString());
			console.log('Updated node addresses:', nodeAddresses);
		}, 60000); // Update every minute

		// Clean up the interval when the component is destroyed
		onDestroy(() => {
			clearInterval(addressUpdateInterval);
		});
	})

	async function clearPeerStore(libp2p) {
		const peers = await libp2p.peerStore.all()
		for (const peer of peers) {
			await libp2p.peerStore.delete(peer.id)
		}
		console.log('PeerStore cleared')
	}


	onMount(() => {
		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js')
				.then((registration) => {
					console.log('Service Worker registered with scope:', registration.scope);
				})
				.catch((error) => {
					console.error('Service Worker registration failed:', error);
				});
		}
	});
</script>

<body class="bg-white text-gray-900 flex flex-col min-h-screen">
	<section class="flex items-center justify-center mt-8">
		<div class="text-center max-w-4xl mx-auto px-4">
			<!-- Logo -->
			<!-- <div class="flex justify-center mb-12">
				<div class="bg-gray-900 rounded-full p-4">
					<img src="/doichain_logo-min.svg" alt="Doichain Logo" class="h-16">
				</div>
			</div> -->
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

