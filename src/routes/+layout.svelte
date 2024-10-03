<script>
	import { helia, connectedPeers} from '$lib/doichain/doichain-store.js'
	import "../app.css";
	import Navigation from './navigation.svelte'

	import { onMount } from "svelte";
	import { createHelia } from 'helia'
	import { multiaddr } from "@multiformats/multiaddr";

	onMount( async () => {
		$helia = await createHelia()

		try {
			if($helia) {
				$helia.libp2p.addEventListener('connection:open',  (p) => {
					$connectedPeers = $connectedPeers + 1
				});
				//
				$helia.libp2p.addEventListener('connection:close', () => {
					$connectedPeers = $connectedPeers - 1
				});
				await $helia.libp2p.dial(multiaddr('/ip4/65.21.180.203/udp/4001/quic-v1/webtransport/certhash/uEiDk1JxhhAhI3c3Q_90QiRUdw5WDyxDLjzeDvg94_Zz4yQ/certhash/uEiDnxUwThh3AGQtzaojyo5CX6o0WJcQEE4NAdCFpbKUP4w/p2p/12D3KooWALjeG5hYT9qtBtqpv1X3Z4HVgjDrBamHfo37Jd61uW1t'))
				//   await _helia.libp2p.dial(multiaddr('/dns4/istanbul.le-space.de/tcp/443/wss/p2p/12D3KooWR7R2mMusGhtsXofgsdY1gzVgG2ykCfS7G5NnNKsAkdCo'))
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

	<main class="flex-grow">
		<slot />
	</main>

	<Navigation />
</body>

<style>
    body {
        font-family: 'Poppins', sans-serif;
    }
</style>