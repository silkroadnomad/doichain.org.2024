import * as bitcoin from 'bitcoinjs-lib';
const { payments, crypto, networks } = bitcoin;
import bs58 from 'bs58';
import moment from 'moment';
import * as ecc from 'tiny-secp256k1';
import BIP32Factory from 'bip32';
const bip32 = BIP32Factory(ecc);
import { logs } from '$lib/doichain/doichain-store.js';

/** @type {import('svelte/store').Writable<Array<LogEntry>>} */
const logStore = logs;

/**
 * @typedef {import('bitcoinjs-lib').Network} Network
 */

const loglevel = 0
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
/**
 * @typedef {Object} Transaction
 * @property {string} txid - Transaction ID
 * @property {number} blocktime - Block timestamp
 * @property {string} id - Unique transaction identifier
 * @property {number} value - Transaction value
 * @property {string} address - Associated address
 * @property {string} type - Transaction type (input/output)
 * @property {boolean} [utxo] - Whether this is an unspent output
 * @property {string} [nameId] - Name operation ID
 * @property {string} [nameValue] - Name operation value
 */

/**
 * @typedef {Object} AddressScanResult
 * @property {Array<Transaction>} transactions - Sorted array of processed transactions
 * @property {Map<string, string>} nextUnusedAddressesMap - Map of unused addresses
 * @property {string|null} nextUnusedAddress - Next unused receiving address
 * @property {string|null} nextUnusedChangeAddress - Next unused change address
 */

/**
 * Retrieves and processes transactions for a given Bitcoin address or extended public key
 * @async
 * @param {string} xpubOrDoiAddress - Bitcoin address or extended public key (xpub/zpub)
 * @param {Array<Object>} _historyStore - Transaction history store
 * @param {Object} _electrumClient - Electrum client instance
 * @param {import('bitcoinjs-lib').Network} _network - Bitcoin network configuration
 * @returns {Promise<AddressScanResult>} Scan results including transactions and addresses
 */
export const getAddressTxs = async (xpubOrDoiAddress, _historyStore, _electrumClient, _network) => {
    try {
        if(loglevel>0)console.log("\n🔍 Processing address/xpub:", xpubOrDoiAddress);
        
        const isAddress = isValidBitcoinAddress(xpubOrDoiAddress, _network);
        /** @type {Array<Object>} */
        let electrumUTXOs = [];
        /** @type {Array<Transaction>} */
        let ourTxs = [];
        /** @type {Array<string>} */
        let derivedAddresses = [];
        /** @type {Map<string, string>} */
        let nextUnusedAddressesMap = new Map();
        /** @type {string|null} */
        let nextUnusedAddress = null;
        /** @type {string|null} */
        let nextUnusedChangeAddress = null;
        
        if (isAddress) {
            if(loglevel>=0) console.log("📍 Single address mode");
            derivedAddresses.push(xpubOrDoiAddress);
            const { utxos, history } = await fetchAddressData(xpubOrDoiAddress, _electrumClient, _network);
            electrumUTXOs = utxos;
            _historyStore = history;
            if(loglevel>0) console.log(`✨ Found ${history.length} transactions`);
        } 
        else {
            if(loglevel>=0) console.log("🔑 Extended key mode");
            const result = await scanExtendedKey(xpubOrDoiAddress, _electrumClient, _network);
            console.log("result", result)
            derivedAddresses = result.addresses;
            electrumUTXOs = result.utxos;
            _historyStore = result.history;
            nextUnusedAddressesMap = result.nextUnusedAddressesMap;
            nextUnusedAddress = result.nextUnusedAddress
            nextUnusedChangeAddress = result.nextUnusedChangeAddress

            if(loglevel>0) console.log(`✨ Found ${_historyStore.length} transactions across ${derivedAddresses.length} addresses`);
        }

        // Process transactions
        if(loglevel>0) console.log("\n⚙️  Processing transactions...");
        ourTxs = await processTransactions(_historyStore, derivedAddresses, electrumUTXOs, _electrumClient);
        if(loglevel>0) console.log(`✅ Processed ${ourTxs.length} relevant transactions`);
        
        return {
            transactions: ourTxs.sort((a, b) => b.blocktime - a.blocktime),
            nextUnusedAddressesMap,
            nextUnusedAddress,
            nextUnusedChangeAddress
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Fatal error in getAddressTxs: ${errorMessage}`);
        logs.update(currentLogs => {
            const newLogs = [{
                timestamp: new Date().toISOString(),
                message: `Fatal error in getAddressTxs: ${errorMessage}`,
                type: 'error'
            }, ...currentLogs];
            return newLogs.slice(0, 1000);
        });
        return {
            transactions: [],
            nextUnusedAddressesMap: new Map(),
            nextUnusedAddress: null,
            nextUnusedChangeAddress: null
        };
    }
}

/**
 * Validates a Bitcoin address
 * @param {string} addressStr - Bitcoin address
 * @param {Object} network - Bitcoin network configuration
 * @returns {boolean} True if the address is valid, false otherwise
 */
/**
 * Validates a Bitcoin address
 * @param {string} addressStr - Bitcoin address to validate
 * @param {Network} network - Bitcoin network configuration
 * @returns {boolean} True if address is valid
 */
/**
 * Validates a Bitcoin address
 * @param {string} addressStr - Bitcoin address to validate
 * @param {Network} network - Bitcoin network configuration
 * @returns {boolean} True if address is valid
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
/**
 * @typedef {Object} AddressData
 * @property {Array<Object>} utxos - Unspent transaction outputs
 * @property {Array<Object>} history - Transaction history
 */

/**
 * Fetches data for a Bitcoin address
 * @param {string} addr - Bitcoin address
 * @param {Object} client - Electrum client
 * @param {Network} network - Bitcoin network configuration
 * @returns {Promise<AddressData>} Address data including UTXOs and history
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
                    console.log(`│   └── 💸 Found relevant input: ${inputTx.value} DOI`);
                    transactions.push(inputTx);
                }
            }
        }

        // Process outputs
        console.log(`└── 📤 Processing ${decryptedTx.vout.length} outputs`);
        for (const [index, vout] of decryptedTx.vout.entries()) {
            const outputTx = await processOutput(vout, derivedAddresses, decryptedTx, index, utxos);
            if (outputTx) {
                console.log(`    └── ${outputTx.utxo ? '🟢' : '⭕'} Found relevant output: ${outputTx.value} DOI`);
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
    console.log("inputAddress", inputAddress)
    if (derivedAddresses.includes(inputAddress)) {
        
        console.log("derivedAddresses.includes(inputAddress)", inputAddress)

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
    console.log("outputAddress", outputAddress)
    if (derivedAddresses.includes(outputAddress)) {
        console.log("derivedAddresses.includes(outputAddress)", outputAddress)
        const tx = {
            ...decryptedTx,
            id: `${decryptedTx.txid}_out_${index}`,
            value: vout.value,
            address: outputAddress,
            type: 'output',
            n: vout.n,
            scriptPubKey: vout.scriptPubKey
        };
        console.log("tx", tx)
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

const derivationConfig = {
    'electrum-legacy': {
        basePath: 'm',
        pathTypes: ['m/0', 'm/1']
    },
    'electrum-segwit': {
        basePath: "m/0'",
        pathTypes: ["m/0'/0", "m/0'/1"]
    },
    'bip84': {
        basePath: "m/84'/0'",
        pathTypes: ["m/84'/0'/0'", "m/84'/0'/1'"]
    },
    'bip49': {
        basePath: "m/49'/0'",
        pathTypes: ["m/49'/0'/0'", "m/49'/0'/1'"]
    }
};

/**
 * Scans an extended public key for transactions across multiple derivation paths
 * 
 * @async
 * @param {string} xpub - Extended public key
 * @param {Object} client - Electrum client instance
 * @param {Object} network - Bitcoin network configuration
 * @returns {Promise<Object>} Object containing addresses, UTXOs, and transaction history
 */
/**
 * @typedef {Object} ScanResult
 * @property {string[]} addresses - List of derived addresses
 * @property {Object[]} utxos - List of UTXOs found
 * @property {Object[]} history - Transaction history
 * @property {string|null} unusedAddress - First unused address found
 * @property {boolean} transactionsFound - Whether any transactions were found
 */

/**
 * @typedef {Object} ExtendedKeyScanResult
 * @property {string[]} addresses - List of all derived addresses
 * @property {Object[]} utxos - List of all UTXOs found
 * @property {Object[]} history - Combined transaction history
 * @property {string|null} nextUnusedAddress - Next unused receiving address
 * @property {string|null} nextUnusedChangeAddress - Next unused change address
 */

async function scanExtendedKey(xpub, client, network) {
    /** @type {string|null} */
    let nextUnusedAddress = null;
    /** @type {string|null} */
    let nextUnusedChangeAddress = null;

    /** @type {string[]} */
    let addresses = [];
    /** @type {Object[]} */
    let allUtxos = [];
    /** @type {Object[]} */
    let allHistory = [];
    /** @type {Map<string, number>} */
    const transactionCounts = new Map();
    /** @type {string[]} */
    let standardsWithTransactions = [];
    for (const [standard, config] of Object.entries(derivationConfig)) {
        if(loglevel>=0) console.log("scanning standard", standard);
        const { pathTypes } = config;

        for (const pathType of pathTypes) {
            if(loglevel>=0) console.log("scanning pathType", pathType);
            const result = await scanDerivationPath(xpub, pathType, standard, client, network, 1);
            if(loglevel>=0) console.log("result", result)
            if (result.transactionsFound) {
                if(loglevel>=0) console.log("found transactions for standard", standard);
                standardsWithTransactions.push(standard);
                break;
            }
        }
    }

    // Second pass: Deep scan all standards with transactions
    for (const standard of standardsWithTransactions) {
        if(loglevel>=0) console.log("deep scanning standard", standard);
        const { pathTypes } = derivationConfig[standard];

        for (const [index, pathType] of pathTypes.entries()) {
            if(loglevel>=0) console.log("deep scanning pathType", pathType);
            const isChangeAddress = index === 1;
            // Use a larger initial scan window for thorough scanning
            const result = await scanDerivationPath(xpub, pathType, standard, client, network);
            if(loglevel>=0) console.log("result "+index, result);
            addresses = [...addresses, ...result.addresses];
            allUtxos = [...allUtxos, ...result.utxos];
            allHistory = [...allHistory, ...result.history];
            // Only set unused addresses if we haven't found them yet
            if (!isChangeAddress && !nextUnusedAddress) {
                nextUnusedAddress = result.unusedAddress;
            } else if (isChangeAddress && !nextUnusedChangeAddress) {
                nextUnusedChangeAddress = result.unusedAddress;
            }

            // Track transaction count for each pathType
            const transactionCount = result.history.length;
            transactionCounts.set(pathType, (transactionCounts.get(pathType) || 0) + transactionCount);
        }
    }
    console.log("addresses", addresses)
    return {
        addresses,
        utxos: allUtxos,
        history: allHistory,
        nextUnusedAddress,
        nextUnusedChangeAddress
    };
}

/**
 * Derives a Bitcoin address from an extended public key
 * @param {string} xpubOrZpub - Extended public key (xpub or zpub format)
 * @param {string} derivationPath - BIP32 derivation path
 * @param {Object} network - Network configuration object
 * @param {('p2wpkh'|'p2pkh'|'segwit')} type - Address type to generate
 * @returns {string} Derived Bitcoin address
 * @throws {Error} If derivation fails or input is invalid
 */
export function deriveAddress(xpubOrZpub, derivationPath, network, type) {
    try {
        if(loglevel>0) console.log(`\n Deriving address:`);
        if(loglevel>0) console.log(`├── Input Key: ${xpubOrZpub.slice(0, 20)}...`);
        if(loglevel>0) console.log(`├── Path: ${derivationPath}`);
        if(loglevel>0) console.log(`└── Type: ${type}`);

        const decodedData = bs58.decode(xpubOrZpub);
        const data = Buffer.from(decodedData);
        
        if (data.length !== 82) {
            throw new Error('Invalid extended public key length');
        }

        const versionBytes = data.subarray(0, 4);
        const versionHex = versionBytes.toString('hex');
        if(loglevel>0) console.log(`├── Version bytes: ${versionHex}`);

        let xpub = xpubOrZpub;
        
        // Handle ZPUB conversion to XPUB if needed
        if (versionHex === '04b24746') { // ZPUB (Doichain/Bitcoin mainnet)
            if(loglevel>0) console.log(`├── Converting ZPUB to XPUB`);
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
            if(loglevel>0) console.log(`├── Using native segwit network configuration`);
            // Use appropriate network configuration for native segwit
            /** @type {Network} */
const segwitNetwork = {
    ...network,
    messagePrefix: '\x19Doichain Signed Message:\n',
    bech32: 'doi',
    pubKeyHash: 0x1e,
    scriptHash: 0x3f,
    wif: 0x80,
    bip32: {
        public: 0x04b24746,  // ZPUB version bytes
        private: 0x04b2430c  // ZPRV version bytes
    }
};
            node = bip32.fromBase58(xpubOrZpub, segwitNetwork);
        } else {
            // Regular XPUB case
            if(loglevel>0) console.log(`├── Using regular network configuration`);
            /** @type {Network} */
            const regularNetwork = { ...network };
            node = bip32.fromBase58(xpub, regularNetwork);
        }
        
        // Parse the derivation path
        const pathSegments = derivationPath
            .replace('m/', '')
            .split('/')
            .filter(segment => segment !== '');

        // Derive each segment individually
        let child = node;
        for (const segment of pathSegments) {
            const index = parseInt(segment.replace("'", ""), 10);
            if (isNaN(index)) {
                throw new Error(`Invalid path segment: ${segment}`);
            }
            child = child.derive(index);
        }

        // Generate address based on type
        if (type === 'p2wpkh' || type === 'segwit') {
            const address = payments.p2wpkh({ 
                pubkey: child.publicKey, 
                network 
            }).address;
            if(loglevel>0) log(`└── ✅ Generated segwit: ${address}`);
            return address;
        } else { // legacy p2pkh
            const address = payments.p2pkh({ 
                pubkey: child.publicKey, 
                network 
            }).address;
            if(loglevel>0) log(`└─��� ✅ Generated legacy: ${address}`);
            return address;
        }
    } catch (error) {
        console.error(`└── ❌ Error in deriveAddress: ${error}`);
        throw error;
    }
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
/**
 * Scans a derivation path for addresses and transactions
 * @param {string} xpub - Extended public key
 * @param {string} basePath - Base derivation path
 * @param {string} standard - Wallet standard being used
 * @param {Object} client - Electrum client
 * @param {Object} network - Network configuration
 * @param {number} [limit=50] - Maximum number of addresses to scan
 * @returns {Promise<ScanResult>} Scan results including addresses and transactions
 */
/**
 * @typedef {Object} DerivationScanResult
 * @property {Array<string>} addresses - List of derived addresses
 * @property {Array<Object>} utxos - List of UTXOs found
 * @property {Array<Object>} history - Transaction history
 * @property {string|null} unusedAddress - First unused address found
 * @property {boolean} transactionsFound - Whether any transactions were found
 */

/**
 * Scans a derivation path for addresses and transactions
 * @async
 * @param {string} xpub - Extended public key
 * @param {string} basePath - Base derivation path
 * @param {string} standard - Wallet standard being used
 * @param {Object} client - Electrum client
 * @param {import('bitcoinjs-lib').Network} network - Network configuration
 * @param {number} [limit=50] - Maximum number of addresses to scan
 * @returns {Promise<DerivationScanResult>} Scan results including addresses and transactions
 */
async function scanDerivationPath(xpub, basePath, standard, client, network, limit = 50) {
    if(loglevel>=0) console.log(`\n🔍 Scanning derivation path: ${standard} ${basePath}`);
    /** @type {Array<Object>} */
    const utxos = [];
    /** @type {Array<Object>} */
    const history = [];
    /** @type {Array<string>} */
    const addresses = [];
    /** @type {string|null} */
    let unusedAddress = null;
    /** @type {boolean} */
    let transactionsFound = false;
    /** @type {number} */
    let consecutiveUnused = 0;
    /** @type {number} */
    const GAP_LIMIT = 20;
    /** @type {number} */
    let batchSize = 10; // Process addresses in batches for better performance

    try {
        for (let i = 0; i < limit && consecutiveUnused < GAP_LIMIT; i += batchSize) {
            const currentBatchSize = Math.min(batchSize, limit - i);
            const derivedAddresses = [];
            const addressPromises = [];
            
            // Derive addresses in batch
            for (let j = 0; j < currentBatchSize; j++) {
                const index = i + j;
                const derivationPath = `${basePath}/${index}`;
                try {
                    const address = deriveAddress(xpub, derivationPath, network, standard === 'electrum-segwit' ? 'p2wpkh' : 'p2pkh');
                    derivedAddresses.push(address);
                    addresses.push(address);
                    // Queue up address data fetching
                    addressPromises.push(fetchAddressData(address, client, network));
                } catch (error) {
                    console.error(`Error deriving address at ${derivationPath}:`, error);
                    continue;
                }
            }

            try {
                // Process batch of addresses in parallel
                const results = await Promise.allSettled(addressPromises);
                
                for (let j = 0; j < results.length; j++) {
                    const result = results[j];
                    const address = derivedAddresses[j];
                    
                    if (result.status === 'fulfilled') {
                        const { utxos: currentUtxos, history: currentHistory } = result.value;

                        if (currentHistory.length > 0 || currentUtxos.length > 0) {
                            transactionsFound = true;
                            consecutiveUnused = 0; // Reset counter when we find activity
                            if(limit===1) break;
                            // Extend scanning window when we find transactions
                            limit = Math.max(limit, i + GAP_LIMIT + 10);
                        } else {
                            consecutiveUnused++;
                        }

                        utxos.push(...currentUtxos);
                        history.push(...currentHistory);

                        // Set the first unused address we find
                        if (!unusedAddress && currentUtxos.length === 0 && currentHistory.length === 0) {
                            unusedAddress = address;
                        }
                    } else {
                        console.error(`Error fetching data for address ${address}:`, result.reason);
                        // Don't count failed requests in consecutive unused
                        consecutiveUnused = Math.max(0, consecutiveUnused - 1);
                    }
                }

                // Adjust batch size based on success rate
                const successRate = results.filter(r => r.status === 'fulfilled').length / results.length;
                if (successRate < 0.8 && batchSize > 5) {
                    batchSize = Math.max(5, Math.floor(batchSize * 0.8));
                } else if (successRate > 0.9 && batchSize < 20) {
                    batchSize = Math.min(20, Math.floor(batchSize * 1.2));
                }

                // Stop if we've found too many consecutive unused addresses
                if (consecutiveUnused >= GAP_LIMIT) {
                    if(loglevel>=0) console.log(`Found ${GAP_LIMIT} consecutive unused addresses, stopping scan`);
                    break;
                }
            } catch (error) {
                console.error(`Error processing batch starting at index ${i}:`, error);
                // Reduce batch size on error
                batchSize = Math.max(5, Math.floor(batchSize * 0.5));
            }
        }
    } catch (error) {
        console.error('Fatal error in scanDerivationPath:', error);
        throw error;
    }

    return { addresses, utxos, history, unusedAddress, transactionsFound };
}

/**
 * Logs a message with timestamp and type
 * @param {string} message - Message to log
 * @param {('info'|'error'|'success')} [type='info'] - Type of log entry
 * @private
 */
/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp - ISO timestamp
 * @property {string} message - Log message
 * @property {'info'|'error'|'success'} type - Log type
 */

/**
 * Logs a message with timestamp and type
 * @param {string} message - Message to log
 * @param {'info'|'error'|'success'} [type='info'] - Type of log entry
 */
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    /** @type {LogEntry} */
    const logEntry = {
        timestamp,
        message,
        type
    };
    
    logStore.update(currentLogs => {
        const newLogs = [logEntry, ...currentLogs];
        return newLogs.slice(0, 1000); // Keep last 1000 logs
    });
    
    console.log(message);
}
