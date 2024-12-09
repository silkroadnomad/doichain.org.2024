import * as bitcoin from 'bitcoinjs-lib';
const { payments, crypto } = bitcoin;
import bs58 from 'bs58';
import moment from 'moment';
import * as ecc from 'tiny-secp256k1';
import BIP32Factory from 'bip32';
const bip32 = BIP32Factory(ecc);
import { logs } from '$lib/doichain/doichain-store.js';

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
export const getAddressTxs = async (xpubOrDoiAddress, _historyStore, _electrumClient, _network) => {
    try {
        if(loglevel>0)console.log("\n🔍 Processing address/xpub:", xpubOrDoiAddress);
        
        const isAddress = isValidBitcoinAddress(xpubOrDoiAddress, _network);
        let electrumUTXOs = [];
        let ourTxs = [];
        let derivedAddresses = [];
        let nextUnusedAddressesMap = new Map();
        let nextUnusedAddress = null;
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
        log(`Fatal error in getAddressTxs: ${error.message}`, 'error');
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
async function scanExtendedKey(xpub, client, network) {
    let nextUnusedAddress = null;
    let nextUnusedChangeAddress = null;

    let addresses = [];
    let allUtxos = [];
    let allHistory = [];
    const transactionCounts = new Map();
    let walletStandardWithTransactions = null;

    // First pass: Identify the standard with transactions
    for (const [standard, config] of Object.entries(derivationConfig)) {
        console.log("scanning standard", standard);
        const { basePath, pathTypes } = config;

        for (const pathType of pathTypes) {
            console.log("scanning pathType", pathType);
            const result = await scanDerivationPath(xpub, pathType, standard, client, network, 1);
            console.log("result", result)
            if (result.transactionsFound) {
                console.log("found transactions for standard", standard);
                walletStandardWithTransactions = standard;
                break;
            }
        }
        if (walletStandardWithTransactions) break;
    }

    // Second pass: Deep scan the identified standard
    if (walletStandardWithTransactions) {
        console.log("walletStandardWithTransactions", walletStandardWithTransactions)
        const { pathTypes } = derivationConfig[walletStandardWithTransactions];

        for (const [index, pathType] of pathTypes.entries()) {
            console.log("deep scanning pathType", pathType);
            const isChangeAddress = index === 1;
            const result = await scanDerivationPath(xpub, pathType, walletStandardWithTransactions, client, network);
            console.log("result "+index, result)
            addresses = [...addresses, ...result.addresses];
            allUtxos = [...allUtxos, ...result.utxos];
            allHistory = [...allHistory, ...result.history];
            if (!isChangeAddress) {
                nextUnusedAddress = result.unusedAddress;
            } else {
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
        if(loglevel>0) log(`\n Deriving address:`);
        if(loglevel>0) log(`├── Input Key: ${xpubOrZpub.slice(0, 20)}...`);
        if(loglevel>0) log(`├── Path: ${derivationPath}`);
        if(loglevel>0) log(`└── Type: ${type}`);

        const decodedData = bs58.decode(xpubOrZpub);
        const data = Buffer.from(decodedData);
        
        if (data.length !== 82) {
            throw new Error('Invalid extended public key length');
        }

        const versionBytes = data.subarray(0, 4);
        const versionHex = versionBytes.toString('hex');
        if(loglevel>0) log(`├── Version bytes: ${versionHex}`);

        let xpub = xpubOrZpub;
        
        // Handle ZPUB conversion to XPUB if needed
        if (versionHex === '04b24746') { // ZPUB (Doichain/Bitcoin mainnet)
            if(loglevel>0) log(`├── Converting ZPUB to XPUB`);
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
            if(loglevel>0) log(`├── Using native segwit network configuration`);
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
            if(loglevel>0) log(`├── Using regular network configuration`);
            node = bip32.fromBase58(xpub, network);
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
        log(`└── ❌ Error in deriveAddress: ${error}`, 'error');
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
async function scanDerivationPath(xpub, basePath, standard, client, network, limit = 20) {
    if(loglevel>=0) console.log(`\n🔍 Scanning derivation path: ${standard} ${basePath}`);
    const utxos = [];
    const history = [];
    const addresses = [];
    let unusedAddress = false;
    let transactionsFound = false;

    for (let i = 0; i < limit; i++) {
        const derivationPath = `${basePath}/${i}`;
        const address = deriveAddress(xpub, derivationPath, network, standard === 'electrum-segwit' ? 'p2wpkh' : 'p2pkh');
        
        try {
            const { utxos: addressUtxos, history: addressHistory } = await fetchAddressData(address, client, network);

            if (addressHistory.length > 0 || addressUtxos.length > 0) {
                transactionsFound = true;
                if(limit===1) break;
                limit = i + 20; // Adjust limit to i + 20
            }

            utxos.push(...addressUtxos);
            history.push(...addressHistory);
            addresses.push(address);
            // Check for the first unused address
            if (addressUtxos.length === 0 && addressHistory.length === 0) {
                unusedAddress = address;
            }
        } catch (error) {
            console.error(`Error fetching data for address ${address}:`, error);
        }
    }

    return { addresses, utxos, history, unusedAddress, transactionsFound };
}

/**
 * Logs a message with timestamp and type
 * @param {string} message - Message to log
 * @param {('info'|'error'|'success')} [type='info'] - Type of log entry
 * @private
 */
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        message,
        type // 'info', 'error', 'success'
    };
    
    logs.update(currentLogs => {
        const newLogs = [logEntry, ...currentLogs];
        // Optionally limit the number of logs kept
        return newLogs.slice(0, 1000); // Keep last 1000 logs
    });
    
    // Still keep console.log for debugging
    console.log(message);
}
