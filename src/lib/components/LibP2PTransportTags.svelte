<script>
	import { connectedPeers } from 'doi-js';
	let peerCounts;
	let peerAddresses;

	let hoveredType = null;

	$: peerCounts = {
		webrtc: 0,
		webtransport: 0,
		wss: 0,
		ws: 0
	};

	$: peerAddresses = {
		webrtc: [],
		webtransport: [],
		wss: [],
		ws: []
	};

	$: {
		if (Array.isArray($connectedPeers)) {
			peerCounts = { webrtc: 0, webtransport: 0, wss: 0, ws: 0 };
			peerAddresses = { webrtc: [], webtransport: [], wss: [], ws: [] };

			$connectedPeers.forEach((peer) => {
				if (peer && peer.remoteAddr) {
					const addr = peer.remoteAddr.toString().toLowerCase();
					if (addr.includes('/webrtc/')) {
						peerCounts.webrtc++;
						peerAddresses.webrtc.push(peer.remoteAddr.toString());
					} else if (addr.includes('/webtransport/')) {
						peerCounts.webtransport++;
						peerAddresses.webtransport.push(peer.remoteAddr.toString());
					} else if (addr.includes('/wss/')) {
						peerCounts.wss++;
						peerAddresses.wss.push(peer.remoteAddr.toString());
					} else if (addr.includes('/ws/')) {
						peerCounts.ws++;
						peerAddresses.ws.push(peer.remoteAddr.toString());
					}
				}
			});
		}
	}

	function showAddresses(type) {
		hoveredType = type;
	}

	function hideAddresses() {
		hoveredType = null;
	}
</script>

<div class="flex justify-center flex-wrap gap-2 mb-6 relative">
	<span
		class="px-2 py-1 bg-blue-400 text-white hover:bg-blue-500 text-xs font-semibold rounded-full cursor-pointer"
		on:mouseenter={() => showAddresses('webrtc')}
		on:mouseleave={hideAddresses}
	>
		WebRTC: {peerCounts.webrtc}
	</span>
	<span
		class="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded-full cursor-pointer"
		on:mouseenter={() => showAddresses('webtransport')}
		on:mouseleave={hideAddresses}
	>
		WebTransport: {peerCounts.webtransport}
	</span>
	<span
		class="px-2 py-1 bg-purple-500 text-white text-xs font-semibold rounded-full cursor-pointer"
		on:mouseenter={() => showAddresses('wss')}
		on:mouseleave={hideAddresses}
	>
		WSS: {peerCounts.wss}
	</span>
	<span
		class="px-2 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-full cursor-pointer"
		on:mouseenter={() => showAddresses('ws')}
		on:mouseleave={hideAddresses}
	>
		WS: {peerCounts.ws}
	</span>

	{#if hoveredType}
		<div
			class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-4 bg-white rounded-lg shadow-lg z-50 w-full max-w-3xl"
		>
			<h3 class="text-lg font-semibold mb-2 text-gray-800">
				{hoveredType.toUpperCase()} Peer Addresses
			</h3>
			<ul class="text-sm space-y-2 max-h-60 overflow-y-auto">
				{#each peerAddresses[hoveredType] as address}
					<li class="p-2 bg-gray-100 rounded break-all">{address}</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
