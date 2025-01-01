<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let onClose; // function to call when splash is closed

	let agreeP2P = false;
	let agreeCookie = false;

	function handleConfirm() {
		if (agreeP2P && agreeCookie) {
			// Indicate acceptance in localStorage
			if (browser) {
				localStorage.setItem('splashAgreed', 'true');
			}
			onClose?.(); // tell parent to hide the splash
		} else {
			alert('Please check both boxes to continue.');
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-90 text-white"
>
	<div class="max-w-lg p-6 bg-gray-800 rounded-lg shadow-xl">
		<h2 class="text-2xl font-bold mb-6">Welcome to the Doichain Decentralized Progressive Web App, featuring Doichain Non-Fungible Coins and leveraging atomic transactions with PSBTs</h2>

		<div class="space-y-4">
			<div class="bg-gray-700 p-4 rounded">
				<h3 class="font-semibold mb-2">Important Information</h3>
				<ul class="space-y-2">
					<li class="flex items-start">
						<span class="text-yellow-400 mr-2">⚠️</span>
						<span>This dPWA is still experimental - use it at your own risk</span>
					</li>
					<li class="flex items-start">
						<span class="text-blue-400 mr-2">🌐</span>
						<span>It is a local-first, peer-to-peer, decentralized PWA hosted on IPFS</span>
					</li>
					<li class="flex items-start">
						<span class="text-green-400 mr-2">🔒</span>
						<span>No platform, no cloud, nor application servers are storing, processing or tracking your private data, private keys or other account information</span>
					</li>
					<li class="flex items-start">
						<span class="text-purple-400 mr-2">🔗</span>
						<span>Your browser will connect peer-to-peer to blockchain nodes and other browser nodes of the peer-to-peer network</span
						>
					</li>
					<li class="flex items-start">
						<span class="text-orange-400 mr-2">💾</span>
						<span>Public blockchain data might be stored temporarily in your browser</span>
					</li>
				</ul>
			</div>

			<div class="space-y-3 mt-6">
				<label
					class="flex items-start space-x-3 p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors cursor-pointer"
				>
					<input type="checkbox" bind:checked={agreeP2P} class="mt-1" />
					<span
						>I understand and agree that this browser will connect peer-to-peer to other nodes and doesn't have a central server</span
					>
				</label>

				<label
					class="flex items-start space-x-3 p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors cursor-pointer"
				>
					<input type="checkbox" bind:checked={agreeCookie} class="mt-1" />
					<span
						>I agree that my browsers local storage will be used to save preferences and eventually caches public
						blockchain data</span
					>
				</label>
			</div>

			<button
				on:click={handleConfirm}
				class="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
			>
				Continue to Doichain dPWA
			</button>
		</div>
	</div>
</div>
