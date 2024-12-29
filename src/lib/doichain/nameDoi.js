import { address, crypto, Psbt } from 'bitcoinjs-lib';
import { libp2p } from './doichain-store.js';
import { DOICHAIN, NETWORK_FEE, VERSION } from './doichain.js';
import { CONTENT_TOPIC } from './doichain.js';

let _libp2p;
libp2p.subscribe((value) => (_libp2p = value));

/**
 * @typedef {Object} UTXO
 * @property {string} tx_hash - Transaction hash
 * @property {number} tx_pos - Output index
 * @property {number} value - Amount in satoshis
 * @property {Object} fullTx - Full transaction data
 * @property {Object} fullTx.scriptPubKey - Script public key data
 * @property {string} fullTx.scriptPubKey.hex - Hex representation of script
 * @property {string} fullTx.hex - Raw transaction hex
 */

/**
 * @typedef {Object} ElectrumClient
 * @property {function(string, Array<*>): Promise<*>} request - Method to make Electrum requests
 * @property {Object} subscribe - Subscription handler
 * @property {function(string, function(string, string): void): void} subscribe.on - Event subscription method
 */

import { getNameOPStackScript } from './getNameOPStackScript.js';
import { getNameOpUTXOsOfTxHash } from './getNameOpUTXOsOfTxHash.js';

/**
 * Gets the unspent transaction outputs
 * @param electrumClient
 * @param utxoAddress
 * @returns {Promise<*>}
 */
/**
 * Gets the unspent transaction outputs for a given address
 * @param {ElectrumClient} electrumClient - The Electrum client instance
 * @param {string} utxoAddress - The address to get UTXOs for
 * @returns {Promise<Array<UTXO>>} Array of UTXOs
 */
export const getUTXOSFromAddress = async (electrumClient, utxoAddress) => {
	if (!electrumClient || !utxoAddress) return [];
	let script = address.toOutputScript(utxoAddress, DOICHAIN);
	let hash = crypto.sha256(script);
	let reversedHash = Buffer.from(hash.reverse()).toString('hex');

	const utxos = await electrumClient.request('blockchain.scripthash.listunspent', [reversedHash]);
	for (let i = 0; i < utxos.length; i++) {
		const utxo = utxos[i];
		const fullTX = await getNameOpUTXOsOfTxHash(electrumClient, utxo.tx_hash, utxo.tx_pos);
		utxo.fullTx = fullTX;
	}
	return utxos;
};

/**
 * Generates a Partially Signed Bitcoin Transaction
 * @param {ElectrumClient} electrumClient - The Electrum client instance
 * @param {Array<UTXO>} selectedUtxos - Array of selected UTXOs to spend
 * @param {string} nameId - The name identifier
 * @param {string} nameValue - The name value
 * @param {string} changeAddress - Address to send change to
 * @param {string} recipientAddress - Address to send funds to
 * @returns {Promise<{psbtBaseText: string, changeAmount: number}>} The generated PSBT and change amount
 */
export const generatePSBT = async (
	electrumClient,
	selectedUtxos,
	nameId,
	nameValue,
	changeAddress,
	recipientAddress
) => {
	if (selectedUtxos.length === 0) return;
	const psbt = new Psbt({ network: DOICHAIN });

	let storageFee = NETWORK_FEE.satoshis;
	let doiAmount = 0;

	let totalInputAmount = 0;
	let totalOutputAmount = 0;

	for (let i = 0; i < selectedUtxos.length; i++) {
		const utxo = selectedUtxos[i];
		console.log('utxo', utxo);
		const scriptPubKeyHex = utxo.fullTx.scriptPubKey.hex;
		const isSegWit = scriptPubKeyHex?.startsWith('0014') || scriptPubKeyHex?.startsWith('0020');
		if (isSegWit) {
			psbt.addInput({
				hash: utxo.tx_hash,
				index: utxo.tx_pos,
				witnessUtxo: {
					script: Buffer.from(scriptPubKeyHex, 'hex'),
					value: utxo.value
				}
			});
		} else {
			console.log('nonWitnessUtxo utxo.hex', utxo.fullTx.hex);
			psbt.addInput({
				hash: utxo.tx_hash,
				index: utxo.tx_pos,
				nonWitnessUtxo: Buffer.from(utxo.fullTx.hex, 'hex')
				// nonWitnessUtxo: Buffer.from(fullTX.vout[utxo.tx_pos].hex, 'hex')
			});
		}
		totalInputAmount += utxo.value;
	}

	console.log(`recipientAddress namescript output ${doiAmount}`, recipientAddress);
	const opCodesStackScript = getNameOPStackScript(nameId, nameValue, recipientAddress, DOICHAIN);
	psbt.setVersion(VERSION); //use this for name transactions
	psbt.addOutput({
		script: opCodesStackScript,
		value: storageFee //not the doiAmount here!
	});
	totalOutputAmount += storageFee;
	let utxoCount = 1;
	let transactionFee = utxoCount * 180 + 3 * 34 * 500;
	// console.log("totalInputAmount",totalInputAmount)
	// console.log("doiAmount",doiAmount)
	// console.log("outAmount",(doiAmount+transactionFee+(nameId?storageFee:0)))

	let changeAmount = totalInputAmount - (doiAmount + transactionFee + (nameId ? storageFee : 0));
	console.log(`changeAddress ${changeAddress} gets`, changeAmount);
	psbt.addOutput({
		address: changeAddress,
		value: changeAmount
	});
	totalOutputAmount += changeAmount;
	console.log('changeAmount:     ', changeAmount);
	console.log('Total Input  Amount:', totalInputAmount);
	console.log('Total Output Amount:', totalOutputAmount);
	const psbtBaseText = psbt.toBase64();
	console.log('psbt-file', psbtBaseText);
	return { psbtBaseText, changeAmount };
};

/**
 * Subscribes to an address for mempool transaction monitoring
 * @param {{ request: Function, subscribe: { on: Function } }} electrumClient - The Electrum client instance
 * @param {string} address - The address to monitor
 * @param {(data: { scripthash: string, status: string }) => void} onMempoolTx - Callback function when mempool transaction is detected
 * @returns {Promise<void>}
 */
export const subscribeToAddress = async (electrumClient, address, onMempoolTx) => {
	if (!electrumClient || !address || !onMempoolTx) return;

	try {
		// Convert address to script hash for Electrum
		const script = address.toOutputScript(address, DOICHAIN);
		const hash = crypto.sha256(script);
		const reversedHash = Buffer.from(hash.reverse()).toString('hex');

		// Subscribe to address
		await electrumClient.request('blockchain.scripthash.subscribe', [reversedHash]);
		console.log(`Subscribed to address: ${address}`);

		// Set up event listener for address updates
		/** @param {string} scripthash - The script hash of the monitored address
		 *  @param {string} status - The status of the transaction ('mempool' or block height)
		 */
		electrumClient.subscribe.on('blockchain.scripthash.subscribe', (scripthash, status) => {
			if (scripthash === reversedHash && status === 'mempool') {
				console.log(`Detected mempool transaction for address: ${address}`);
				onMempoolTx({ scripthash, status });
			}
		});
	} catch (error) {
		console.error('Error subscribing to address:', error);
		throw error;
	}
};

let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

export async function publishCID(cid, type = 'NEW') {
	const message = `${type}-CID:${cid}`;
	let success = false;
	retryCount = 0;

	const attemptPublish = async () => {
		try {
			await _libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode(message));
			success = true;
			console.log(`Successfully published ${message} on attempt ${retryCount + 1}`);
		} catch (error) {
			console.error(`Failed to publish ${message} on attempt ${retryCount + 1}:`, error);
			if (retryCount < MAX_RETRIES) {
				retryCount++;
				console.log(`Retrying in ${RETRY_DELAY}ms...`);
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
				await attemptPublish();
			}
		}
	};

	await attemptPublish();
	return success;
}
