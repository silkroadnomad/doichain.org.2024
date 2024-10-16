<script>
	import { helia, libp2p, connectedPeers} from '$lib/doichain/doichain-store.js'
	import "../app.css";
	import Navigation from './navigation.svelte'
	import { onMount } from "svelte";

	import { createLibp2p } from 'libp2p'
	import { createHelia, libp2pDefaults } from 'helia'
	import { LevelBlockstore } from "blockstore-level"
	import { LevelDatastore } from "datastore-level";
	import { multiaddr } from '@multiformats/multiaddr'
	import { gossipsub } from "@chainsafe/libp2p-gossipsub";
	import { webSockets } from '@libp2p/websockets'
	import * as filters from '@libp2p/websockets/filters'
	import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
	import { webRTC, webRTCDirect } from '@libp2p/webrtc'
	import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
	import { webTransport } from '@libp2p/webtransport';
	const pubsubPeerDiscoveryTopics = import.meta.env.VITE_P2P_PUPSUB || '_peer-discovery._p2p._pubsub'
	export let data

	const config = libp2pDefaults()
	console.log("config",config)
	let blockstore = new LevelBlockstore("./helia-blocks")
	let datastore = new LevelDatastore("./helia-data")

	config.addresses = { listen: ['/webrtc','/webrtc-direct']}
	config.transports =  [
		circuitRelayTransport({
			discoverRelays: 1
		}),
		// tcp(),
		webRTC(),
		webRTCDirect(),
		webTransport(),
		webSockets({ filter: filters.all})
	]
	const newPubsub = {...config.services.pubsub, ...{ services: { pubsub: gossipsub({ emitSelf: true, allowPublishToZeroTopicPeers: true, canRelayMessage: true }) } }}
	config.services.pubsub = newPubsub.services.pubsub
	delete config.services['delegatedRouting']

	config.connectionGater =  {
		denyDialMultiaddr: () => {
			// by default we refuse to dial local addresses from browsers since they
			// are usually sent by remote peers broadcasting undialable multiaddrs and
			// cause errors to appear in the console but in this example we are
			// explicitly connecting to a local node so allow all addresses
			return false
		}
	}

	const newPubSubPeerDiscovey = [...config.peerDiscovery, ...[
		// bootstrap({ list: bootstrapList }),
		pubsubPeerDiscovery({
			interval: 10000,
			topics: [pubsubPeerDiscoveryTopics], // defaults to ['_peer-discovery._p2p._pubsub'] //if we enable this too many will connect to us!
			listenOnly: false
		})
	]]

	config.peerDiscovery = newPubSubPeerDiscovey

	onMount( async () => {
		$libp2p = await createLibp2p(config)
		window.libp2p = $libp2p
		$helia = await createHelia({ libp2p: $libp2p, datastore: datastore, blockstore: blockstore})
		window.helia = $helia
		try {
			if($libp2p) {
				$libp2p.addEventListener('connection:open',  (p) => {
					$connectedPeers = $connectedPeers + 1
					console.log("connectedPeers",$connectedPeers)
				});
				//
				$libp2p.addEventListener('connection:close', () => {
					$connectedPeers = $connectedPeers - 1
				});
				await $helia.libp2p.dial(multiaddr('/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'))
				// await $helia.libp2p.dial(multiaddr('/ip4/159.69.119.82/udp/4001/quic-v1/webtransport/certhash/uEiCJm1b3Z_aLNu9lBcYJ64C7mgeQmOojkYjrFne0VSMY2Q/certhash/uEiDl2NHHKh-V4jr5hckVHZ74ygXPxNliaivVsVXqMo7GZw/p2p/12D3KooWK8X8tjKHDyoXyR4EH4FBuqgWQnhRuuAm5SSNLr4zAQp2'))
				await $helia.libp2p.dial(multiaddr('/ip4/159.69.119.82/udp/4001/quic-v1/webtransport/certhash/uEiCJm1b3Z_aLNu9lBcYJ64C7mgeQmOojkYjrFne0VSMY2Q/certhash/uEiDl2NHHKh-V4jr5hckVHZ74ygXPxNliaivVsVXqMo7GZw/p2p/12D3KooWK8X8tjKHDyoXyR4EH4FBuqgWQnhRuuAm5SSNLr4zAQp2'))
				console.log("dialed istanbul (159.69.119.82)")// await $libp2p.dial(multiaddr('/ip4/65.21.180.203/udp/4001/quic-v1/webtransport/certhash/uEiDk1JxhhAhI3c3Q_90QiRUdw5WDyxDLjzeDvg94_Zz4yQ/certhash/uEiDnxUwThh3AGQtzaojyo5CX6o0WJcQEE4NAdCFpbKUP4w/p2p/12D3KooWALjeG5hYT9qtBtqpv1X3Z4HVgjDrBamHfo37Jd61uW1t'))
				//await $libp2p.dial(multiaddr('/dns4/istanbul.le-space.de/tcp/443/wss/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'))
			}
			// await $helia.libp2p.dial(multiaddr('/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'))
			// console.log("topics",$helia.libp2p.services.pubsub.getTopics())
		} catch(ex){ console.log("helia.libp2p.dial.exeption",ex) }
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
