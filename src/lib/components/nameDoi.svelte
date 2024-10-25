<script>
  import { onDestroy, onMount } from 'svelte';
  import Dropzone from "svelte-file-dropzone";
  import { helia, libp2p, electrumClient} from '$lib/doichain/doichain-store.js'
  import { prepareSignTransaction } from '$lib/doichain/prepareSignTransaction.js'
  import { getUTXOSFromAddress } from '$lib/doichain/nfc/nameDoi.js'
  import { renderBCUR } from '../doichain/renderQR.js'
  import { DOICHAIN } from "$lib/doichain/doichain.js";
  import { unixfs } from '@helia/unixfs'
  import * as sb from 'satoshi-bitcoin';  // Import the satoshi-bitcoin library

  const CONTENT_TOPIC = import.meta.env.VITE_CONTENT_TOPIC || "/doichain-nfc/1/message/proto"

  export let walletAddress = ''
  $:recipientsAddress = walletAddress
  $:changeAddress = walletAddress
  let changeAmount
  export let nameId
  export let nameValue
  export let nftName
  $:nameId = nftName

  let nftDescription
  let utxos = []
  let psbtBaseText;
  let utxoErrorMessage;
  let qrCodeData
  let qrCode
  let transactionFee;
  let totalAmount;
  let errorMessage;
  let storageFee = 1000000;

  onMount(async ()=>{
    utxos = await getUTXOSFromAddress($electrumClient,walletAddress)
  })

  let files = {
    accepted: [],
    rejected: []
  };

  function handleFilesSelect(e) {
    const { acceptedFiles, fileRejections } = e.detail;
    if(files.accepted.length>0) files.accepted.pop()
    files.accepted = acceptedFiles
    files.rejected = fileRejections
  }

  let previewImgSrc;
  let imageCID;
  let metadataCID;
  let metadataJSON

  async function writeMetadata() {
    const encoder = new TextEncoder()
    const fs = unixfs($helia)

    metadataJSON = {
      "name": nftName,
      "description": nftDescription,
      "image": `ipfs://${imageCID}`
    }

    metadataCID = await fs.addBytes(encoder.encode(JSON.stringify(metadataJSON)))
    nameValue=`ipfs://${metadataCID.toString()}`
    console.log('Added metadata file to IPFS:', metadataCID.toString())
    await $helia.libp2p.services.pubsub.publish(CONTENT_TOPIC,new TextEncoder().encode("NEW-CID:"+metadataCID.toString()))
  }

  async function previewFile() {
    console.log("rendering preview with file",files.accepted[0].name)
    const fs = unixfs($helia)
    if(!nftName) nftName = files.accepted[0].name
    if(!nameId) nameId = files.accepted[0].name
    let file = files.accepted[0]

    /** reader for ipfs upload */
    const readerToArrayBuffer = new FileReader()
    readerToArrayBuffer.addEventListener(
      "load",
      () => {
        console.log("readerToArrayBuffer got data",readerToArrayBuffer.result)
        if (readerToArrayBuffer.result instanceof ArrayBuffer) {
          const byteArray = new Uint8Array(readerToArrayBuffer.result)
          fs.addBytes(new Buffer(byteArray), {
            onProgress: (evt) => {
              console.info('add event', evt.type, evt.detail)
            }
          }).then((cid) => {
            imageCID = cid.toString()
            console.log('Added file to IPFS:', imageCID)
            $libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode("NEW-CID:"+imageCID.toString()))
            writeMetadata()
          })}else{
            console.log("not ArrayBuffer")
          }
      },
      false,)

    /** reader for image preview / convert image file to base64 string */
    const readerToDataUrl = new FileReader();
    readerToDataUrl.addEventListener("load", () => { previewImgSrc = readerToDataUrl.result },false,)

    if (file) {
      readerToArrayBuffer.readAsArrayBuffer(file)
      readerToDataUrl.readAsDataURL(file);
    }
  }

  $:{ if(files.accepted.length>0) previewFile() }
  $:{ if(nftName || nftDescription) writeMetadata() }

  let activeTimeLine = 0
  let selectedUtxos = [];
  $: selectedUtxosCount = selectedUtxos.length;
  function toggleUtxoSelection(utxo) {
    const index = selectedUtxos.findIndex(u => u.tx_hash === utxo.tx_hash && u.tx_pos === utxo.tx_pos);
    if (index !== -1) {
      selectedUtxos = selectedUtxos.filter((_, i) => i !== index);
    } else {
      selectedUtxos = [...selectedUtxos, utxo];
    }
  }

  function isUtxoSelected(utxo) {
    return selectedUtxos.some(u => u.tx_hash === utxo.tx_hash && u.tx_pos === utxo.tx_pos);
  }

  $: {
    if(selectedUtxosCount > 0 && nameId && nameValue) {
      console.log("prepare signing transaction",selectedUtxos)
      const result = prepareSignTransaction(
        selectedUtxos,
        nameId,
        nameValue,
        DOICHAIN,
        storageFee,
        recipientsAddress,
        changeAddress,
        walletAddress);

      if (result.error) {
        console.log("error",result.error)
        utxoErrorMessage = result.error;
        qrCodeData = undefined;
      } else {
        psbtBaseText = result.psbtBase64;
        transactionFee = result.transactionFee;
        changeAmount = result.changeAmount;
        totalAmount = result.totalAmount;
        console.log("result",result)
        console.log("psbtBaseText",psbtBaseText)
        renderBCUR(psbtBaseText).then(_qr => {
          qrCodeData = _qr;
          displayQrCodes();
        }).catch(error => {
          console.error('Error generating QR code:', error);
          qrCodeData = undefined;
        });
      }
    }
  }

  let activePanel = 'psbtQR';

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  let animationTimeout;
  let currentSvgIndex;

  function displayQrCodes() {
    currentSvgIndex = 0;
    if (animationTimeout) clearTimeout(animationTimeout);
    animateQrCodes();
  }

  function animateQrCodes() {
    qrCode = qrCodeData[currentSvgIndex];
    currentSvgIndex = (currentSvgIndex + 1) % qrCodeData.length;
    animationTimeout = setTimeout(animateQrCodes, 300);
  }

  onDestroy(() => {
    if (animationTimeout) clearTimeout(animationTimeout);
  });

  let cidStatus = 'idle'; // Can be 'idle', 'adding', or 'added'

  onMount(() => {
    if ($libp2p) {
      $libp2p.services.pubsub.addEventListener('message', (event) => {
        if (event.detail.topic === CONTENT_TOPIC) {
          const message = new TextDecoder().decode(event.detail.data);
          if (message.startsWith('ADDING-CID')) {
            cidStatus = 'adding';
          } else if (message.startsWith('ADDED-CID')) {
            cidStatus = 'added';
          }
        }
      });
    }
  });
</script>

<p class="mt-4">&nbsp;</p>
<div class="nameShow">
{#if $electrumClient }
<div class="relative border-l-2 border-gray-200 ml-3 max-w-3xl mx-auto">
  <div class="mb-8 flex items-center">
    <div class="absolute w-8 h-8 bg-blue-500 rounded-full -left-4 border-4 border-white"></div>
    <div class="ml-6 w-full">
      <h3 class="font-bold">1. Data Definition</h3>
      {#if activeTimeLine === 0}
        <p class="text-sm text-gray-500">
          <li>Mint a NFC (non-fungible-coin),
          <li>send an individual key-value transaction!
        </p>
        <p class="mt-4">&nbsp;</p>
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex">
            <a class="border-b-2 border-blue-500 py-2 px-4 text-sm font-medium text-blue-600" href="#">NFC (non-fungible-coin)</a>
            <a class="border-b-2 border-transparent py-2 px-4 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300" href="#">Key-Value Transaction</a>
          </nav>
        </div>
        <div class="py-4">
          <div class="grid grid-cols-[auto,1fr] gap-4 items-start">
            <div class="font-semibold text-left">NFC-Name:</div>
            <div><input type="text" bind:value={nftName} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"></div>
            
            <div class="font-semibold text-left">Description:</div>
            <div><input type="text" bind:value={nftDescription} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"></div>
            
            <div class="font-semibold text-left self-start">Image:</div>
            <div class="w-64 h-64 text-left overflow-hidden">
              <img
                src={previewImgSrc || "https://images.unsplash.com/photo-1629367494173-c78a56567877?ixlib=rb-4.0.3&amp;ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;auto=format&amp;fit=crop&amp;w=927&amp;q=80"}
                alt="Image preview"
                class="w-full h-full object-cover"
              />
            </div>
          </div>
          {#if files.accepted.length===0}
            <Dropzone multiple={false} on:drop={handleFilesSelect} />
          {:else}
            {#if files.accepted.length > 0}
              <div class="grid grid-cols-[auto,1fr] gap-4 overflow-x-auto whitespace-nowrap max-w-full">
                <div class="font-semibold text-left pr-4 min-w-[60px]">name:</div>
                <div class="text-left">
                  <div class="truncate">{files.accepted[0].name}</div>
                </div>
                <div class="font-semibold text-left pr-4 min-w-[60px]">type:</div>
                <div class="text-left">
                  <div class="truncate">{files.accepted[0].type}</div>
                </div>
                <div class="font-semibold text-left pr-4 min-w-[60px]">size:</div>
                <div class="text-left">
                  <div class="truncate">{files.accepted[0].size}</div>
                </div>
                <div class="font-semibold text-left pr-4 pt-2 min-w-[60px]">cid:</div>
                <div class="text-left pt-2">
                  <div class="truncate">{imageCID}</div>
                </div>
                <div class="font-semibold text-left pr-4 pt-2 min-w-[60px]">status:</div>
                <div class="text-left pt-2 flex items-center">
                  {#if cidStatus !== 'idle'}
                    <div class={`w-4 h-4 rounded-full mr-2 ${cidStatus === 'adding' ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
                    <span>{cidStatus === 'adding' ? 'Adding to pinning service' : 'Added to pinning service'}</span>
                  {:else}
                    <span>Waiting for CID</span>
                  {/if}
                </div>
              </div>
            {/if}
          {/if}
        </div>
        <p class="mt-4 pt-2">&nbsp;</p>
        <div class="grid grid-cols-[auto,1fr] gap-4 items-start">
          <div class="font-semibold text-left">NameId:</div>
          <div>
            <input type="text" bind:value={nameId} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          </div>
          
          <div class="font-semibold text-left">NameValue:</div>
          <div>
            <input type="text" bind:value={nameValue} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          </div>
        </div>
        <p class="mt-4">&nbsp;</p>
        <div class="grid grid-cols-2 gap-4">
          <div>&nbsp;</div>
          <div><button on:click={() => activeTimeLine++} class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">Next</button></div>
        </div>
      {/if}
    </div>
  </div>
  
  <div class="mb-8 flex items-center">
    <div class="absolute w-8 h-8 bg-blue-500 rounded-full -left-4 border-4 border-white"></div>
    <div class="ml-6">
      <h3 class="font-bold">2. Wallet Address</h3>
      {#if activeTimeLine===1}
        <p class="text-sm text-gray-500">
          Enter your wallet address which contains the UTXOs to use for the transaction.
          Add spendable coins as inputs to the transaction.
          NameOp transactions are spendable too, but make sure you are not accidentally transfering them.
        </p>
        <p class="mt-4">&nbsp;</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <input type="text" bind:value={walletAddress} on:keydown={ async (event) => {
              if (event.key === 'Enter') {
                utxos = await getUTXOSFromAddress($electrumClient,walletAddress)
              }
            }} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          </div>
          <div>
            <button on:click={ async () => utxos = await getUTXOSFromAddress($electrumClient,walletAddress)} class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">Show Coins</button>
          </div>
        </div>
        <p class="mt-4">&nbsp;</p>
        <div class="grid grid-cols-2 gap-4">
          {#each utxos as utxo}
            {#if !utxo.fullTx?.scriptPubKey.nameOp }
              <div class="grid grid-cols-2 gap-4">
                <div>wallet address:</div>
                <div>{utxo.fullTx?.address?utxo.fullTx?.address:utxo.fullTx?.scriptPubKey.addresses[0]}</div>
                <div>wallet amount:</div>
                <div>{sb.toBitcoin(utxo.value)} BTC</div>
                <div><b>Activate this UTXO:</b></div>
                <div>
                  {#key selectedUtxosCount}
                    <div>
                      <button
                        on:click={() => toggleUtxoSelection(utxo)}
                        type="button" 
                        class="group relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2" 
                        role="switch" 
                        aria-checked={isUtxoSelected(utxo)}
                      >
                        <span
                          aria-hidden="true"
                          class="pointer-events-none absolute mx-auto h-4 w-9 rounded-full bg-gray-200 transition-colors duration-200 ease-in-out"
                          class:bg-indigo-600={isUtxoSelected(utxo)}
                          class:bg-gray-200={!isUtxoSelected(utxo)}
                        ></span>
                        <span
                          aria-hidden="true"
                          class="pointer-events-none absolute left-0 inline-block h-5 w-5 translate-x-0 transform rounded-full border border-gray-200 bg-white shadow ring-0 transition-transform duration-200 ease-in-out"
                          class:translate-x-5={isUtxoSelected(utxo)}
                          class:translate-x-0={!isUtxoSelected(utxo)}
                        ></span>
                      </button>
                    </div>
                  {/key}
                </div>
              </div>
            {/if}
          {/each}
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><button on:click={() => activeTimeLine--} class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">Back</button></div>
          <div><button disabled={selectedUtxos.length===0} on:click={() => activeTimeLine++} class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">Next</button></div>
        </div>
      {/if}
    </div>
  </div>
  
  <div class="mb-8 flex items-center">
    <div class="absolute w-8 h-8 bg-blue-500 rounded-full -left-4 border-4 border-white"></div>
    <div class="ml-6">
      <h3 class="font-bold">3. Add Recipient and Change Address</h3>
      {#if activeTimeLine===2}
        <p class="text-sm text-gray-500">
          <p class="mt-4">&nbsp;</p>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="recipientsAddress">
                  Recipient
                </label>
                <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="recipientsAddress" type="text" placeholder="Recipient address" bind:value={recipientsAddress}>
              </div>
            </div>
            <div>&nbsp;</div>
            <div>
              <div class="mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="changeAddress">
                  Change Address
                </label>
                <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="changeAddress" type="text" placeholder="Change address" bind:value={changeAddress}>
              </div>
            </div>
            <div>&nbsp;</div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><button on:click={() => activeTimeLine--} class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">Back</button></div>
            <div><button on:click={() => activeTimeLine++} class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">Next</button></div>
          </div>
      {/if}
    </div>
  </div>
  
  <div class="mb-8 flex items-center">
    <div class="absolute w-8 h-8 bg-blue-500 rounded-full -left-4 border-4 border-white"></div>
    <div class="ml-6">
      <h3 class="font-bold">4. Review, Scan or Copy PSBT Transaction</h3>
      {#if activeTimeLine === 3}
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex">
            <a class="border-b-2 {activePanel === 'psbtQR' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'} py-2 px-4 text-sm font-medium hover:text-gray-700 hover:border-gray-300" href="#" on:click|preventDefault={() => activePanel = 'psbtQR'}>PSBT QR</a>
            <a class="border-b-2 {activePanel === 'psbtFile' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'} py-2 px-4 text-sm font-medium hover:text-gray-700 hover:border-gray-300" href="#" on:click|preventDefault={() => activePanel = 'psbtFile'}>PSBT File</a>
            <a class="border-b-2 {activePanel === 'metadata' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'} py-2 px-4 text-sm font-medium hover:text-gray-700 hover:border-gray-300" href="#" on:click|preventDefault={() => activePanel = 'metadata'}>Metadata.json</a>
          </nav>
        </div>
        <div class="py-4">
          {#if errorMessage}
            <p class="text-red-500">{errorMessage}</p>
          {:else if activePanel === 'psbtQR'}
            {#if qrCode}
              {@html qrCode}
            {:else}
              <p>Loading QR code...</p>
            {/if}
          {:else if activePanel === 'psbtFile'}
            <textarea 
              class="w-full h-40 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              readonly
              on:click={ () => copyToClipboard(psbtBaseText) }
            >{psbtBaseText}</textarea>
            <p class="text-sm text-gray-500 mt-2">Click on the text area to copy the PSBT to clipboard</p>
          {:else if activePanel === 'metadata'}
            <pre class="bg-gray-100 p-4 rounded-md overflow-auto">
              {JSON.stringify(metadataJSON, null, 2)}
            </pre>
          {/if}
          
          {#if transactionFee !== undefined && totalAmount !== undefined}
            <div class="mt-4 text-right">
              <p class="flex justify-end">
                <span class="font-semibold mr-2">Transaction Fee:</span>
                <span>{sb.toBitcoin(transactionFee).toFixed(8)} BTC</span>
              </p>
              <p class="flex justify-end">
                <span class="font-semibold mr-2">Total Amount:</span>
                <span>{sb.toBitcoin(totalAmount).toFixed(8)} BTC</span>
              </p>
            </div>
          {/if}
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><button on:click={() => activeTimeLine--} class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">Back</button></div>
          <div><button on:click={() => activeTimeLine++} class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">Forward</button></div>
        </div>
      {/if}
    </div>
  </div>
</div>
{/if}
</div>

<style>
    :global(.nameDoi) {
        padding: 1rem;
        font-size: small !important;
        background-color: #f1f3f5;
        color: var(--text-3);
    }

    .nameShow {
        overflow-x: hidden;
    }

    .nameShow input[type="text"],
    .nameShow textarea {
        max-width: 100%;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .animate-pulse {
      animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
</style>
