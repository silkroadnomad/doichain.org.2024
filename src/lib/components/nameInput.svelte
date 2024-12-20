<script>
	import { getConnectionStatus } from '../doichain/connectElectrum.js';
	import { checkName } from '$lib/doichain/nameValidation.js';
	import { electrumClient, connectedServer, network } from '../doichain/doichain-store.js';
	import { createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	import { getAddressTxs } from '$lib/doichain/getAddressTxs.js';

	const dispatch = createEventDispatcher();
	export let name = '';
	export let totalUtxoValue = 0;
	export let totalAmount = 0;
	export let customErrorMessage = '';
	export let customSuccessMessage = '';
	export let currentNameOp = null;
	export let currentNameUtxo = null;
	let isConnected = false;
	let isNameValid = true;
	let nameErrorMessage = '';
	let processedErrorMessage = '';
	let processedSuccessMessage = '';
	let doichainAddress = localStorage.getItem('doichainAddress') || '';
	let isValidating = false;
	let debounceTimeout;

	$: ({ isConnected, serverName } = getConnectionStatus($connectedServer));
	$: {
		if (customErrorMessage) {
			processedErrorMessage = customErrorMessage.replace('---name---', name);
			processedErrorMessage = processedErrorMessage.replace('---address---', doichainAddress);
		} else {
			processedErrorMessage = '';
		}
	}
	$: {
		if (customSuccessMessage) {
			processedSuccessMessage = customSuccessMessage.replace('---name---', name);
		} else {
			processedSuccessMessage = '';
		}
	}

	async function nameCheckCallback(result) {
		console.log('result', result);
		doichainAddress = result.currentNameAddress || doichainAddress;
		isNameValid = result.isNameValid;
		currentNameOp = result.currentNameOp;
		currentNameUtxo = result.currentNameUtxo;
		nameErrorMessage = result.nameErrorMessage;

		// Check if currentNameOp and currentNameUtxo are empty arrays
		if (
			Array.isArray(currentNameOp) &&
			currentNameOp.length === 0 &&
			Array.isArray(currentNameUtxo) &&
			currentNameUtxo.length === 0
		) {
			// The input might be a Doichain address
			try {
				const addressTxs = await getAddressTxs(doichainAddress, null, $electrumClient, $network);
				const nameOps = addressTxs.filter((tx) => tx.nameId && tx.nameValue);

				if (nameOps.length > 0) {
					// Sort nameOps by blocktime in descending order (latest first)
					nameOps.sort((a, b) => b.blocktime - a.blocktime);

					// Set currentNameOp to the latest name operation
					currentNameOp = nameOps[0];
					isNameValid = true;
					nameErrorMessage = '';
				} else {
					nameErrorMessage = 'No name operations found for this address';
					isNameValid = false;
				}
			} catch (error) {
				console.error('Error fetching transactions:', error);
				nameErrorMessage = 'Error fetching transactions for this address';
				isNameValid = false;
			}
		}

		// Add UTXO balance check here
		if (totalUtxoValue < totalAmount) {
			nameErrorMessage = `Funds on ${doichainAddress} are insufficient for this Doichain name`;
			isNameValid = false;
		}
	}

	function debounceValidation(value) {
		isValidating = true;
		clearTimeout(debounceTimeout);
		debounceTimeout = setTimeout(() => {
			if (value) {
				checkName($electrumClient, doichainAddress, value, nameCheckCallback);
			}
			isValidating = false;
		}, 300);
	}

	function handleInput(event) {
		if (event.type === 'input') {
			debounceValidation(event.target.value);
		} else if (event.type === 'keydown' && event.keyCode === 13) {
			clearTimeout(debounceTimeout);
			dispatch('input', name);
		}
	}

	$: if (name) {
		debounceValidation(name);
	} else {
		isNameValid = true;
		nameErrorMessage = '';
		processedErrorMessage = '';
		processedSuccessMessage = '';
	}
</script>

{#if isConnected}
	<div class="w-full">
		<div class="relative w-full">
			<div
				class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
				on:click={handleInput}
			>
				<svg
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					class="w-5 h-5 text-gray-400"
				>
					<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
				</svg>
			</div>
			<input
				bind:value={name}
				autofocus
				on:input={handleInput}
				on:keydown={handleInput}
				type="search"
				name="name"
				id="name"
				class="block w-full pl-10 pr-10 py-2 text-sm
               border-{isNameValid ? 'blue' : 'yellow'}-500
               focus:border-{isNameValid ? 'blue' : 'yellow'}-700
               text-gray-900 bg-white rounded-md
               focus:outline-none focus:ring-2
               focus:ring-{isNameValid ? 'blue' : 'yellow'}-500
               border border-gray-300
               {isValidating ? 'opacity-75' : ''}"
				placeholder="Find name..."
				autocomplete="off"
				aria-invalid={!isNameValid}
				aria-describedby="name-error"
			/>
			<div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
				{#if isValidating}
					<svg class="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
				{:else if !isNameValid}
					<svg
						class="h-5 w-5 text-yellow-500"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
							clip-rule="evenodd"
						/>
					</svg>
				{:else if name}
					<svg
						class="h-5 w-5 text-green-500"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
			</div>
		</div>
		{#if name}
			{#key name}
				{#if !isNameValid && (processedErrorMessage || nameErrorMessage)}
					<p
						transition:fade={{ duration: 200 }}
						class="mt-2 text-sm text-yellow-600 break-words"
						id="name-error"
					>
						{processedErrorMessage || nameErrorMessage}
					</p>
				{:else if isNameValid && (processedSuccessMessage || doichainAddress)}
					<p
						transition:fade={{ duration: 200 }}
						class="mt-2 text-sm text-green-600 break-words"
						id="name-success"
					>
						{processedSuccessMessage || `Address: ${doichainAddress}`}
					</p>
				{/if}
			{/key}
		{/if}
	</div>
{:else}
	<p
		class="mt-2 text-sm font-extralight tracking-tight server-status {isConnected
			? 'connected'
			: ''}"
	>
		Connecting Doichain ...
	</p>
{/if}

<style>
	.input-icon {
		@apply pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3;
	}
	.server-status {
		transition: color 1s;
		color: red;
	}
	.server-status.connected {
		color: green;
	}
	/* Add these new styles */
	.relative {
		max-width: 100%;
	}

	#name-error,
	#name-success {
		max-width: 100%;
		word-break: break-word;
		hyphens: auto;
	}
</style>
