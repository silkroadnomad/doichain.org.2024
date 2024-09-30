<script>
    import { getConnectionStatus } from "../doichain/connectElectrum.js";
    import { checkName } from "$lib/doichain/nameValidation.js";
    import { electrumClient, connectedServer } from "../doichain/doichain-store.js";

    export let name = '';
    export let totalUtxoValue = 0;
    export let totalAmount = 0;

    let isConnected = false;
    let isNameValid = true;
    let nameErrorMessage = '';
    let doichainAddress =  localStorage.getItem('doichainAddress') || '';

    $: ({ isConnected, serverName } = getConnectionStatus($connectedServer));
    $: console.log("isConnected",isConnected)
    async function nameCheckCallback(result) {
        doichainAddress = result.currentNameAddress || doichainAddress;
        isNameValid = result.isNameValid;
        nameErrorMessage = result.nameErrorMessage;
    }

    $: name ? checkName($electrumClient, name, totalUtxoValue, totalAmount, nameCheckCallback) : null;
</script>

<div>
    <label for="name" class="block text-sm font-medium leading-6 text-gray-900">Check your Doichain Name</label>
    <div class="relative mt-2 rounded-md shadow-sm">
        <input bind:value={name} name="name" id="name"
               type="text"
               class="input {isNameValid ? '' : 'input-error'}"
               placeholder="name"
               aria-invalid="{!isNameValid}"
               aria-describedby="name-error"/>

        {#if !isNameValid}
            <div class="input-icon">
                <svg class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                </svg>
            </div>
        {:else if name}
            <div class="input-icon">
                <svg class="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                </svg>
            </div>
        {/if}
    </div>
    {#if !isNameValid}
        <p class="mt-2 text-sm text-red-600" id="name-error">{nameErrorMessage}</p>
    {:else if name}
        <p class="mt-2 text-sm text-green-600" id="name-success">Address: {doichainAddress}</p>
    {/if}
    <p class="mt-2 text-sm font-semibold tracking-tight server-status {isConnected ? 'connected' : ''}">{serverName}</p>
</div>

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
</style>