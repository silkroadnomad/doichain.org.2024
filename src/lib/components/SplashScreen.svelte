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
		<h2 class="text-2xl font-bold mb-6">Welcome to Doichain - Experimental DApp</h2>

		<div class="space-y-4">
			<div class="bg-gray-700 p-4 rounded">
				<h3 class="font-semibold mb-2">Important Information</h3>
				<ul class="space-y-2">
					<li class="flex items-start">
						<span class="text-yellow-400 mr-2">⚠️</span>
						<span>This is experimental software in development</span>
					</li>
					<li class="flex items-start">
						<span class="text-blue-400 mr-2">🌐</span>
						<span
							>This is a peer-to-peer, decentralized Progressive Web App that can run from IPFS</span
						>
					</li>
					<li class="flex items-start">
						<span class="text-green-400 mr-2">🔒</span>
						<span>No application server processes or tracks your data</span>
					</li>
					<li class="flex items-start">
						<span class="text-purple-400 mr-2">🔗</span>
						<span>Your browser will connect P2P to seed nodes and other browsers via ElectrumX</span
						>
					</li>
					<li class="flex items-start">
						<span class="text-orange-400 mr-2">💾</span>
						<span>Public blockchain data will be stored locally in your browser</span>
					</li>
				</ul>
			</div>

			<div class="space-y-3 mt-6">
				<label
					class="flex items-start space-x-3 p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors cursor-pointer"
				>
					<input type="checkbox" bind:checked={agreeP2P} class="mt-1" />
					<span
						>I understand and agree that this browser will connect peer-to-peer to other nodes</span
					>
				</label>

				<label
					class="flex items-start space-x-3 p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors cursor-pointer"
				>
					<input type="checkbox" bind:checked={agreeCookie} class="mt-1" />
					<span
						>I agree that local storage will be used to save my preferences and cache public
						blockchain data</span
					>
				</label>
			</div>

			<button
				on:click={handleConfirm}
				class="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
			>
				Continue to Doichain
			</button>
		</div>
	</div>
</div>
