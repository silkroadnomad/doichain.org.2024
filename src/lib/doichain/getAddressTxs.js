import * as bitcoin from 'bitcoinjs-lib';
const { payments, crypto } = bitcoin;
import bs58 from 'bs58';
import moment from 'moment';
import * as ecc from 'tiny-secp256k1';
import BIP32Factory from 'bip32';
const bip32 = BIP32Factory(ecc);

/**
 * @module getAddressTxs
 * @description Handles transaction retrieval and processing for both single Bitcoin addresses
 * and extended public keys (xpub/zpub). Supports legacy and SegWit addresses.
 */

/**
 * Retrieves and processes transactions for a given Bitcoin address or extended public key
 * @async
 * @param {string} xpubOrDoiAddress - Bitcoin address or extended public key (xpub/zpub)
 * @param {Array} _historyStore - Transaction history store
 * @param {Object} _electrumClient - Electrum client instance
 * @param {Object} _network - Bitcoin network configuration
 * @returns {Promise<Array>} Sorted array of processed transactions
 */
export const getAddressTxs = async (xpubOrDoiAddress, _historyStore, _electrumClient, _network) => {
    console.log("\n🔍 Processing address/xpub:", xpubOrDoiAddress);
    
    const isAddress = isValidBitcoinAddress(xpubOrDoiAddress, _network);
    let electrumUTXOs = [];
    let ourTxs = [];
    let derivedAddresses = [];
    let nextUnusedAddressesMap = {}; // in case its not an xpub/zpub
    let nextUnusedAddress = null;
    let nextUnusedChangeAddress = null;
    
    if (isAddress) {
        console.log("📍 Single address mode");
        derivedAddresses.push(xpubOrDoiAddress);
        const { utxos, history } = await fetchAddressData(xpubOrDoiAddress, _electrumClient, _network);
        electrumUTXOs = utxos;
        _historyStore = history;
        console.log(`✨ Found ${history.length} transactions`);
    } 
    else {
        console.log("🔑 Extended key mode");
        const result = await scanExtendedKey(xpubOrDoiAddress, _electrumClient, _network);
        derivedAddresses = result.addresses;
        electrumUTXOs = result.utxos;
        _historyStore = result.history;
        nextUnusedAddressesMap = result.nextUnusedAddressesMap;
        nextUnusedAddress = result.nextUnusedAddress
        nextUnusedChangeAddress = result.nextUnusedChangeAddress

        console.log(`✨ Found ${_historyStore.length} transactions across ${derivedAddresses.length} addresses`);
    }

    // Process transactions
    console.log("\n⚙️  Processing transactions...");
    ourTxs = await processTransactions(_historyStore, derivedAddresses, electrumUTXOs, _electrumClient);
    console.log(`✅ Processed ${ourTxs.length} relevant transactions`);
    
    return {
        transactions: ourTxs.sort((a, b) => b.blocktime - a.blocktime),
        nextUnusedAddressesMap,
        nextUnusedAddress,
        nextUnusedChangeAddress
    };
}

export function deriveAddress(xpubOrZpub, derivationPath, network, type) {
    try {
        console.log(`\n Deriving address:`);
        console.log(`├── Input Key: ${xpubOrZpub.slice(0, 20)}...`);
        console.log(`├── Path: ${derivationPath}`);
        console.log(`└── Type: ${type}`);

        const decodedData = bs58.decode(xpubOrZpub);
        const data = Buffer.from(decodedData);
        
        if (data.length !== 82) {
            throw new Error('Invalid extended public key length', data.length);
        }

        const versionBytes = data.subarray(0, 4);
        const versionHex = versionBytes.toString('hex');
        console.log(`├── Version bytes: ${versionHex}`);

        let xpub = xpubOrZpub;
        
        // Handle ZPUB conversion to XPUB if needed
        if (versionHex === '04b24746') { // ZPUB (Doichain/Bitcoin mainnet)
            console.log(`├── Converting ZPUB to XPUB`);
            // Convert ZPUB to XPUB by changing version bytes
            const xpubVersionBytes = Buffer.from([0x04, 0x88, 0xb2, 0x1e]); // mainnet xpub
            const xpubBuffer = Buffer.concat([
                xpubVersionBytes,
                data.subarray(4)
            ]);
            xpub = bs58.encode(xpubBuffer);
        }

        let node;
        if (versionHex === '04b24746') { // ZPUB case
            console.log(`├── Using native segwit network configuration`);
            // Use appropriate network configuration for native segwit
            const segwitNetwork = {
                ...network,
                bip32: {
                    public: 0x04b24746,  // ZPUB version bytes
                    private: 0x04b2430c  // ZPRV version bytes
                }
            };
            node = bip32.fromBase58(xpubOrZpub, segwitNetwork);
        } else {
            // Regular XPUB case
            console.log(`├── Using regular network configuration`);
            node = bip32.fromBase58(xpub, network);
        }
        // Derive the child node using the derivation path
        const child = node.derivePath(derivationPath);

        if (type === 'p2wpkh' || type === 'segwit') {
            const address = payments.p2wpkh({ 
                pubkey: child.publicKey, 
                network 
            }).address;
            console.log(`└── ✅ Generated segwit: ${address}`);
            return address;
        } else { // legacy p2pkh
            const address = payments.p2pkh({ 
                pubkey: child.publicKey, 
                network 
            }).address;
            console.log(`└── ✅ Generated legacy: ${address}`);
            return address;
        }
    } catch (error) {
        console.error(`└── ❌ Error in deriveAddress:`, error);
        throw error;
    }
}
/**
 * Validates a Bitcoin address
 * @param {string} addressStr - Bitcoin address
 * @param {Object} network - Bitcoin network configuration
 * @returns {boolean} True if the address is valid, false otherwise
 */
function isValidBitcoinAddress(addressStr, network) {
    try {
        bitcoin.address.toOutputScript(addressStr, network);
        return true;
    } catch (e) {
        return false;
    }
  }

/**
 * Fetches UTXOs and transaction history for a single address
 * @async
 * @param {string} addr - Bitcoin address
 * @param {Object} client - Electrum client instance
 * @param {Object} network - Bitcoin network configuration
 * @returns {Promise<Object>} Object containing UTXOs and transaction history
 */
async function fetchAddressData(addr, client, network) {
    console.log(`\n🔍 Fetching data for address: ${addr}`);
    const script = bitcoin.address.toOutputScript(addr, network);
    const hash = crypto.sha256(script);
    const reversedHash = Buffer.from(hash.reverse()).toString("hex");

    try {
        const utxos = await client.request('blockchain.scripthash.listunspent', [reversedHash]);
        const history = await client.request('blockchain.scripthash.get_history', [reversedHash]);
        console.log(`├── 💰 UTXOs: ${utxos.length}`);
        console.log(`└── 📜 History: ${history.length} transactions`);
        return { utxos, history };
    } catch (error) {
        console.error("❌ Error fetching address data:", error);
        return { utxos: [], history: [] };
    }
}

/**
 * Processes a batch of transactions, handling both inputs and outputs
 * @async
 * @param {Array} history - Array of transaction history items
 * @param {Array} derivedAddresses - Array of derived addresses to check against
 * @param {Array} utxos - Array of unspent transaction outputs
 * @param {Object} client - Electrum client instance
 * @returns {Promise<Array>} Array of processed transactions
 */
async function processTransactions(history, derivedAddresses, utxos, client) {
    const transactions = [];
    console.log(`\n📦 Processing ${history.length} transactions`);

    for (const tx of history) {
        console.log(`\n🔄 Transaction: ${tx.tx_hash.slice(0, 8)}...`);
        const decryptedTx = await client.request('blockchain.transaction.get', [tx.tx_hash, 1]);
        decryptedTx.formattedBlocktime = decryptedTx.blocktime ? 
            moment.unix(decryptedTx.blocktime).format('YYYY-MM-DD HH:mm:ss') : '⏳ mempool';

        // Process inputs
        console.log(`├── 📥 Processing ${decryptedTx.vin.length} inputs`);
        for (const [index, vin] of decryptedTx.vin.entries()) {
            if (!vin.coinbase) {
                const inputTx = await processInput(vin, client, derivedAddresses, decryptedTx, index);
                if (inputTx) {
                    console.log(`│   └── 💸 Found relevant input: ${inputTx.value} BTC`);
                    transactions.push(inputTx);
                }
            }
        }

        // Process outputs
        console.log(`└── 📤 Processing ${decryptedTx.vout.length} outputs`);
        for (const [index, vout] of decryptedTx.vout.entries()) {
            const outputTx = await processOutput(vout, derivedAddresses, decryptedTx, index, utxos);
            if (outputTx) {
                console.log(`    └── ${outputTx.utxo ? '🟢' : '⭕'} Found relevant output: ${outputTx.value} BTC`);
                transactions.push(outputTx);
            }
        }
    }

    return transactions;
}

/**
 * Processes a transaction input
 * @async
 * @param {Object} vin - Transaction input data
 * @param {Object} client - Electrum client instance
 * @param {Array} derivedAddresses - Array of derived addresses to check against
 * @param {Object} decryptedTx - Decrypted transaction data
 * @param {number} index - Input index
 * @returns {Promise<Object|null>} Processed transaction input or null if not relevant
 */
async function processInput(vin, client, derivedAddresses, decryptedTx, index) {
    const prevTx = await client.request('blockchain.transaction.get', [vin.txid, 1]);
    const spentOutput = prevTx.vout[vin.vout];
    const inputAddress = spentOutput.scriptPubKey?.addresses?.[0];

    if (derivedAddresses.includes(inputAddress)) {
        return {
            ...decryptedTx,
            id: `${decryptedTx.txid}_in_${index}`,
            value: -spentOutput.value,
            address: inputAddress,
            type: 'input'
        };
    }
    return null;
}

/**
 * Processes a transaction output
 * @param {Object} vout - Transaction output data
 * @param {Array} derivedAddresses - Array of derived addresses to check against
 * @param {Object} decryptedTx - Decrypted transaction data
 * @param {number} index - Output index
 * @param {Array} utxos - Array of unspent transaction outputs
 * @returns {Object|null} Processed transaction output or null if not relevant
 */
function processOutput(vout, derivedAddresses, decryptedTx, index, utxos) {
    const outputAddress = vout.scriptPubKey?.addresses?.[0];
    
    if (derivedAddresses.includes(outputAddress)) {
        const tx = {
            ...decryptedTx,
            id: `${decryptedTx.txid}_out_${index}`,
            value: vout.value,
            address: outputAddress,
            type: 'output',
            n: vout.n,
            scriptPubKey: vout.scriptPubKey
        };

        // Check UTXO status
        tx.utxo = utxos.some(utxo => 
            utxo.tx_hash === tx.txid && utxo.tx_pos === tx.n
        );

        // Process name operations
        processNameOp(tx, vout.scriptPubKey);

        return tx;
    }
    return null;
}

/**
 * Processes Doichain name operations in transaction outputs
 * @param {Object} tx - Transaction object to be modified
 * @param {Object} scriptPubKey - Script public key data
 */
function processNameOp(tx, scriptPubKey) {
    const asmParts = scriptPubKey.asm.split(" ");
    if (['OP_10', 'OP_NAME_DOI', 'OP_2', 'OP_NAME_FIRSTUPDATE', 'OP_3', 'OP_NAME_UPDATE']
        .includes(asmParts[0])) {
        tx.nameId = scriptPubKey.nameOp.name;
        tx.nameValue = scriptPubKey.nameOp.value;
    }
}

/**
 * Scans an extended public key for transactions across multiple derivation paths
 * 
 * @async
 * @param {string} xpub - Extended public key
 * @param {Object} client - Electrum client instance
 * @param {Object} network - Bitcoin network configuration
 * @returns {Promise<Object>} Object containing addresses, UTXOs, and transaction history
 */
async function scanExtendedKey(xpub, client, network) {
    
    const derivationPaths = {
        'electrum-legacy': 'm',
        'electrum-segwit': "m/0'"
    };

    let addresses = [];
    let allUtxos = [];
    let allHistory = [];
    const nextUnusedAddressesMap = new Map();
    const transactionCounts = new Map();

    for (const [standard, basePath] of Object.entries(derivationPaths)) {
        const pathTypes = {
            'electrum-segwit': ["m/0'/0", "m/0'/1"],
            'electrum-legacy': ['m/0', 'm/1'],
            'bip84': ["m/84'/0'/0'", "m/84'/0'/1'"],
            'bip49': ["m/49'/0'/0'", "m/49'/0'/1'"]
        }[standard] || ['m/0', 'm/1']; // Default to legacy if unknown

        for (const [index, pathType] of pathTypes.entries()) {
            const isChangeAddress = index === 1; // Assuming the second element is always a change address
            const result = await scanDerivationPath(xpub, pathType, standard, client, network, isChangeAddress);
            addresses = addresses ? [...addresses, result.address] : result.address;
            allUtxos = [...allUtxos, ...result.utxos];
            allHistory = [...allHistory, ...result.history];

            // Initialize or update the map for each pathType
            if (!nextUnusedAddressesMap.has(pathType)) {
                nextUnusedAddressesMap.set(pathType, {
                    nextUnusedAddress: null,
                    nextUnusedChangeAddress: null
                });
            }

            const pathTypeData = nextUnusedAddressesMap.get(pathType);

            // Determine next unused address or change address for each pathType
            if (result.utxos.length === 0 && result.history.length === 0) {
                if (!isChangeAddress && !pathTypeData.nextUnusedAddress) {
                    pathTypeData.nextUnusedAddress = result.address;
                } else if (isChangeAddress && !pathTypeData.nextUnusedChangeAddress) {
                    pathTypeData.nextUnusedChangeAddress = result.address;
                }
            }

            // Update the map with the new data
            nextUnusedAddressesMap.set(pathType, pathTypeData);

            // Track transaction count for each pathType
            const transactionCount = result.history.length;
            transactionCounts.set(pathType, (transactionCounts.get(pathType) || 0) + transactionCount);
        }
    }

    // Determine the pathType with the most transactions
    let maxTransactions = 0;
    let pathTypeWithMostTransactions = null;
    for (const [pathType, count] of transactionCounts.entries()) {
        if (count > maxTransactions) {
            maxTransactions = count;
            pathTypeWithMostTransactions = pathType;
        }
    }

    // Retrieve next unused addresses for the pathType with the most transactions
    const mostTransactionsData = nextUnusedAddressesMap.get(pathTypeWithMostTransactions);
    const nextUnusedAddress = mostTransactionsData ? mostTransactionsData.nextUnusedAddress : null;
    const nextUnusedChangeAddress = mostTransactionsData ? mostTransactionsData.nextUnusedChangeAddress : null;

    // Return the results
    return {
        addresses,
        utxos: allUtxos,
        history: allHistory,
        pathTypeWithMostTransactions,
        nextUnusedAddress,
        nextUnusedChangeAddress
    };
}


/**
 * Scans an extended public key for transactions across multiple derivation paths
 * @async
 * @param {string} xpub - Extended public key
 * @param {string} basePath - Base path for derivation
 * @param {string} standard - Standard for derivation
 * @param {Object} client - Electrum client instance
 * @param {Object} network - Bitcoin network configuration
 * @returns {Promise<Object>} Object containing addresses, UTXOs, and transaction history
 */
async function scanDerivationPath(xpub, basePath, standard, client, network, isChangeAddress) {
    let address;
    const utxos = [];
    const history = [];
    const gapLimit = 20; // Define a gap limit for address derivation
    const batchSize = 10; // Define the batch size for requests
    let unusedAddress = false;
    let index = 0;
    let transactionsFound = true;

    while (transactionsFound || index < gapLimit) {
        transactionsFound = false;

        for (let i = 0; i < batchSize && (transactionsFound || index < gapLimit); i++, index++) {
            const derivationPath = `${basePath}/${index}`;
            address = deriveAddress(xpub, derivationPath, network, standard === 'electrum-segwit' ? 'p2wpkh' : 'p2pkh');
            
            const script = bitcoin.address.toOutputScript(address, network);
            const hash = crypto.sha256(script);
            const reversedHash = Buffer.from(hash.reverse()).toString("hex");

            try {
                const addressUtxos = await client.request('blockchain.scripthash.listunspent', [reversedHash]);
                const addressHistory = await client.request('blockchain.scripthash.get_history', [reversedHash]);

                if (addressHistory.length > 0) {
                    transactionsFound = true;
                }

                utxos.push(...addressUtxos);
                history.push(...addressHistory);

                // Check for the first unused address
                if (addressUtxos.length === 0 && addressHistory.length === 0) {
                        unusedAddress = true;
                }
            } catch (error) {
                console.error(`Error fetching data for address ${address}:`, error);
            }
        }
    }

    return { address, utxos, history, unusedAddress };
}