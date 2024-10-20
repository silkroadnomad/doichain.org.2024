<script>
	import { helia, libp2p, connectedPeers, nameOps} from '$lib/doichain/doichain-store.js'
	import "../app.css";
	import Navigation from './navigation.svelte'
	import { onMount } from "svelte";

	import { createLibp2p } from 'libp2p'
	import { bootstrap } from '@libp2p/bootstrap'
	import { createHelia, libp2pDefaults } from 'helia'
	import { LevelBlockstore } from "blockstore-level"
	import { LevelDatastore } from "datastore-level";
	import { gossipsub } from "@chainsafe/libp2p-gossipsub";
	import { webSockets } from '@libp2p/websockets'
	import * as filters from '@libp2p/websockets/filters'
	import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
	import { webRTC, webRTCDirect } from '@libp2p/webrtc'
	import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
	import { webTransport } from '@libp2p/webtransport';
	import { ping } from '@libp2p/ping'
	import { identify } from '@libp2p/identify'
	import { autoNAT } from '@libp2p/autonat'
	import { dcutr } from '@libp2p/dcutr'
	import { multiaddr } from '@multiformats/multiaddr'
	import { noise } from '@chainsafe/libp2p-noise'
	import { yamux } from '@chainsafe/libp2p-yamux'

	const pubsubPeerDiscoveryTopics = import.meta.env.VITE_P2P_PUPSUB || 'doichain._peer-discovery._p2p._pubsub'

	const CONTENT_TOPIC = '/doichain-nfc/1/message/proto';

	const config = libp2pDefaults()
	console.log("config", config)

	// If you want to ensure the ping service is included:
	config.services = {
		...config.services,
		ping: ping({
				protocolPrefix: 'doi-libp2p', // default
			}),
		identify: identify(),
		autoNAT: autoNAT(),
		dcutr: dcutr(),
	}

	let blockstore = new LevelBlockstore("./helia-blocks")
	let datastore = new LevelDatastore("./helia-data")

	config.addresses = { listen: ['/webrtc','/webrtc-direct','/wss']}
	config.transports =  [
		webSockets({ filter: filters.all}),
		webTransport(),
		webRTC(),
		webRTCDirect(),
		circuitRelayTransport({
			discoverRelays: 1
		})
	]

	// Ensure proper connection encryption and stream multiplexing
	config.connectionEncrypters = [noise()]
	config.streamMuxers = [yamux()]

	// Add connection manager to limit connections
	config.connectionManager = {
		maxConnections: 1,
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

	const newPubSubPeerDiscovey = [...config.peerDiscovery, ...[
		// bootstrap({ list: 
		// 	[
		// 		// '/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo',
		// 		// '/ip4/127.0.0.1/tcp/9092/wss/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'
		// 	]
		// }),
		pubsubPeerDiscovery({
			interval: 10000,
			topics: [pubsubPeerDiscoveryTopics], // defaults to ['_peer-discovery._p2p._pubsub'] //if we enable this too many will connect to us!
			listenOnly: false
		})
	]]
	let hasReceivedList100 = false;
	config.peerDiscovery = newPubSubPeerDiscovey

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

	onMount(async () => {
		$libp2p = await createLibp2p(config)
		window.libp2p = $libp2p
		$helia = await createHelia({ libp2p: $libp2p, datastore: datastore, blockstore: blockstore})
		window.helia = $helia

		try {
			if($libp2p) {
				$libp2p.services.pubsub.subscribe(CONTENT_TOPIC)
				console.log("libp2p is available")
				const pubsub = $libp2p.services.pubsub;
				pubsub.addEventListener('message', (event) => {
				if (event.detail.topic === CONTENT_TOPIC) {
						const message = new TextDecoder().decode(event.detail.data);
						if(message.startsWith('ADDING-CID') || message.startsWith('ADDED-CID') || message.startsWith('PINNING-CID') || message.startsWith('PINNED-CID')){
							console.log("ignoring cid messages for now", message)
						} 
						else if (
							message.startsWith('LIST_DATE:') 
							|| message.startsWith('LIST_LAST_100') 
							|| message.startsWith('LIST_ALL') 
							|| message.endsWith(':NONE')
						){
							console.log("ignoring list messages for now", message)
						}
						else {
							if (!hasReceivedList100) {
									$nameOps = []
									try {
										const jsonMessage = JSON.parse(message)
										$nameOps = jsonMessage.sort((a, b) => {
											const timeA = a.currentNameUtxo?.blocktime || 0;
											const timeB = b.currentNameUtxo?.blocktime || 0;
											return timeB - timeA;
										});

										console.log("Total nameOps after update:", $nameOps.length);
										hasReceivedList100 = true;
									} catch (e) {
										console.log("message", message)
										console.error('Failed to parse message:', e);
									}
							}
						}
					} else{
						// console.log("message", new TextDecoder().decode(event.detail.data));	
					}
			});
		
			$libp2p.addEventListener('connection:open',  (p) => {
					$connectedPeers = $connectedPeers + 1
					// console.log("connectedPeers",$connectedPeers)
			});
				//
			$libp2p.addEventListener('connection:close', () => {
					$connectedPeers = $connectedPeers - 1
			});


  		// await $helia.libp2p.dial(multiaddr('/ip4/127.0.0.1/udp/9092/webrtc-direct/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'))
		// await $helia.libp2p.dial(multiaddr('/ip4/127.0.0.1/tcp/9091/wss/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'))
 		// await $helia.libp2p.dial(multiaddr('/ip4/127.0.0.1/udp/9093/quic-v1/webtransport/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'))
	
		// await $helia.libp2p.dial(multiaddr('/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'))
		// await $helia.libp2p.dial(multiaddr('/ip4/159.69.119.82/udp/4001/quic-v1/webtransport/certhash/uEiCJm1b3Z_aLNu9lBcYJ64C7mgeQmOojkYjrFne0VSMY2Q/certhash/uEiDl2NHHKh-V4jr5hckVHZ74ygXPxNliaivVsVXqMo7GZw/p2p/12D3KooWK8X8tjKHDyoXyR4EH4FBuqgWQnhRuuAm5SSNLr4zAQp2'))
	    // await $helia.libp2p.dial(multiaddr('/ip4/159.69.119.82/udp/4001/quic-v1/webtransport/certhash/uEiCJm1b3Z_aLNu9lBcYJ64C7mgeQmOojkYjrFne0VSMY2Q/certhash/uEiDl2NHHKh-V4jr5hckVHZ74ygXPxNliaivVsVXqMo7GZw/p2p/12D3KooWK8X8tjKHDyoXyR4EH4FBuqgWQnhRuuAm5SSNLr4zAQp2'))
		// console.log("dialed istanbul (159.69.119.82)")// await $libp2p.dial(multiaddr('/ip4/65.21.180.203/udp/4001/quic-v1/webtransport/certhash/uEiDk1JxhhAhI3c3Q_90QiRUdw5WDyxDLjzeDvg94_Zz4yQ/certhash/uEiDnxUwThh3AGQtzaojyo5CX6o0WJcQEE4NAdCFpbKUP4w/p2p/12D3KooWALjeG5hYT9qtBtqpv1X3Z4HVgjDrBamHfo37Jd61uW1t'))
			const targetPeerId = '12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'

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
				if (event.detail.toString() === targetPeerId) {
					console.log(`Connected to target peer: ${targetPeerId}`)
					
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
				}
			})

			// Attempt to connect to the target peer
			const relayAddr = multiaddr('/dns4/istanbul.le-space.de/tcp/443/wss/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo')
			// const relayAddr = multiaddr('/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo')
			try {
				await $libp2p.dial(relayAddr)
				console.log("Dialed relay successfully")
			} catch (error) {
				console.error("Failed to dial relay:", error)
			}
		}
		// await $helia.libp2p.dial(multiaddr('/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'))
			// console.log("topics",$helia.libp2p.services.pubsub.getTopics())


		} catch(ex){ console.log("helia.libp2p.exception", ex) }
	})
</script>

<body class="bg-white text-gray-900 flex flex-col min-h-screen">
	<section class="flex items-center justify-center mt-8">
		<div class="text-center max-w-4xl mx-auto px-4">
			<!-- Logo -->
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
</body>

<style>
	body {
		font-family: 'Poppins', sans-serif;
	}
</style>




