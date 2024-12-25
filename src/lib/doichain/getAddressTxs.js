import * as bitcoin from 'bitcoinjs-lib';
const { payments, crypto } = bitcoin;
import bs58 from 'bs58';
import moment from 'moment';
import * as ecc from 'tiny-secp256k1';
import BIP32Factory from 'bip32';
const bip32 = BIP32Factory(ecc);
import { logs } from '$lib/doichain/doichain-store.js';

const loglevel = 0;
/** @type {Map<string, {confirmed: number, unconfirmed: number}>} */
let addressBalances = new Map();

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp - ISO timestamp
 * @property {string} message - Log message
 * @property {'info'|'error'|'success'} type - Log type
 */

/** @type {import('svelte/store').Writable<Array<LogEntry>>} */
const logStore = logs;

/**
 * @typedef {import('bitcoinjs-lib').Network} Network
 */

const batchSize = 10; // Define batch size for address scanning

/**
 * @module getAddressTxs
 * @description Handles transaction retrieval and processing for both single Bitcoin addresses
 * and extended public keys (xpub/zpub). Supports legacy and SegWit addresses.
 */

/**
 * Retrieves and processes transactions for a given Bitcoin address or extended public key
 * @async
 * @param {string} xpubOrDoiAddress - Bitcoin address or extended public key (xpub/zpub)
 * @param {Array<Object>} _historyStore - Transaction history store
 * @param {Object} _electrumClient - Electrum client instance
 * @param {Network} _network - Bitcoin network configuration
 * @returns {Promise<AddressScanResult>} Scan results including transactions and addresses
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
 * @param {Network} _network - Bitcoin network configuration
 * @returns {Promise<AddressScanResult>} Scan results including transactions and addresses
 */
/**
 * @typedef {Object} ElectrumClient
 * @property {(method: string, params: any[]) => Promise<any>} request - Method to make Electrum protocol requests
 */


/**
 * Retrieves and processes transactions for a given Bitcoin address or extended public key
 * @async
 * @param {string} xpubOrDoiAddress - Bitcoin address or extended public key (xpub/zpub)
 * @param {Array<Object>} _historyStore - Transaction history store
 * @param {ElectrumClient} _electrumClient - Electrum client instance
 * @param {Network} _network - Bitcoin network configuration
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
            nextUnusedAddress = result.nextUnusedAddress;
            nextUnusedChangeAddress = result.nextUnusedChangeAddress;
            
            // Update global address balances
            for (const [address, balance] of result.balances) {
                addressBalances.set(address, balance);
            }

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
        console.log(`Fatal error in Txs: ${error.message}`, 'error');
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
 * @typedef {Object} Balance
 * @property {number} confirmed - Confirmed balance
 * @property {number} unconfirmed - Unconfirmed balance
 */

/**
 * @typedef {Object} AddressData
 * @property {Array<Object>} utxos - Unspent transaction outputs
 * @property {Array<Object>} history - Transaction history
 * @property {Balance} balance - Address balance information
 */

/**
 * @typedef {Object} ExtendedKeyScanResult
 * @property {Array<string>} addresses - List of derived addresses
 * @property {Array<Object>} utxos - All UTXOs found
 * @property {Array<Object>} history - All transaction history
 * @property {Map<string, string>} nextUnusedAddressesMap - Map of unused addresses
 * @property {string|null} nextUnusedAddress - Next unused receiving address
 * @property {string|null} nextUnusedChangeAddress - Next unused change address
 * @property {Map<string, Balance>} balances - Map of address balances
 */

/**
 * Fetches UTXOs and transaction history for a single address
 * @async
 * @param {string} addr - Bitcoin address
 * @param {Object} client - Electrum client instance
 * @param {Network} network - Bitcoin network configuration
 * @returns {Promise<AddressData>} Address data including UTXOs and history
 */
// Type definitions moved to top of file

/**
 * Fetches data for a Bitcoin address
 * @param {string} addr - Bitcoin address
 * @param {Object} client - Electrum client
 * @param {Network} network - Bitcoin network configuration
 * @returns {Promise<AddressData>} Address data including UTXOs and history
 */
async function fetchAddressData(addr, client, network)  {
    console.log(`\n🔍 Fetching data for address: ${addr}`);
    const script = bitcoin.address.toOutputScript(addr, network);
    const hash = crypto.sha256(script);
    const reversedHash = Buffer.from(hash.reverse()).toString("hex");

    try {
        // Apply rate limiting if configured
        const [utxos, history, balance] = await Promise.all([
            client.request('blockchain.scripthash.listunspent', [reversedHash]),
            client.request('blockchain.scripthash.get_history', [reversedHash]),
            client.request('blockchain.scripthash.get_balance', [reversedHash])
        ]);

        // Update balance tracking
        addressBalances.set(addr, {
            confirmed: balance.confirmed,
            unconfirmed: balance.unconfirmed
        });

        console.log(`├── 💰 UTXOs: ${utxos.length}`);
        console.log(`├── 💵 Balance: ${balance.confirmed/100000000} BTC (confirmed)`);
        console.log(`└── 📜 History: ${history.length} transactions`);

        return { 
            utxos, 
            history,
            balance: {
                confirmed: balance.confirmed,
                unconfirmed: balance.unconfirmed
            }
        };
    } catch (error) {
        console.error("❌ Error fetching address data:", error);
        return { 
            utxos: [], 
            history: [],
            balance: {
                confirmed: 0,
                unconfirmed: 0
            }
        };
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
        basePath: "m",
        pathTypes: ["m/0'", "m/1'"]
    },
    'bip84': {
        basePath: "m/84'/0'",
        pathTypes: ["m/84'/0'", "m/84'/0'"]
    },
    'bip49': {
        basePath: "m/49'/0'",
        pathTypes: ["m/49'/0'", "m/49'/0'"]
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

// Type definitions moved to top of file

/**
 * Scans an extended public key for transactions and balances
 * @param {string} xpub - Extended public key
 * @param {Object} client - Electrum client
 * @param {Network} network - Network configuration
 * @returns {Promise<ExtendedKeyScanResult>} Scan results
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
        nextUnusedAddressesMap: new Map(),
        nextUnusedAddress,
        nextUnusedChangeAddress,
        balances: addressBalances
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
        if(loglevel>0)  console.log(`├── Version bytes: ${versionHex}`);

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
            if(loglevel>0) console.log(`└── ✅ Generated segwit: ${address}`);
            return address;
        } else { // legacy p2pkh
            const address = payments.p2pkh({ 
                pubkey: child.publicKey, 
                network 
            }).address;
            if(loglevel>0) console.log(`└── ✅ Generated legacy: ${address}`);
            return address;
        }
    } catch (error) {
        console.log(`└── ❌ Error in deriveAddress: ${error}`, 'error');
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
/**
 * Scans a derivation path for addresses and transactions
 * @param {string} xpub - Extended public key
 * @param {string} basePath - Base derivation path
 * @param {string} standard - Wallet standard being used
 * @param {ElectrumClient} client - Electrum client
 * @param {Network} network - Network configuration
 * @param {number} [limit=50] - Maximum number of addresses to scan
 * @returns {Promise<DerivationScanResult>} Scan results
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
    let currentBatchSize = batchSize;

    try {
        for (let i = 0; i < limit && consecutiveUnused < GAP_LIMIT; i += currentBatchSize) {
            if(loglevel>0) console.log(`\n📍 Processing batch ${Math.floor(i/currentBatchSize)}:`);
            
            const batchAddresses = [];
            const batchPromises = [];
            
            // Derive addresses in batch
            for (let j = 0; j < Math.min(currentBatchSize, limit - i); j++) {
                const index = i + j;
                const derivationPath = `${basePath}/${index}`;
                if(loglevel>0) console.log(`├── Path: ${derivationPath}`);
                if(loglevel>0) console.log(`├── Index: ${index}`);
                
                try {
                    const address = deriveAddress(xpub, derivationPath, network, standard === 'electrum-segwit' ? 'p2wpkh' : 'p2pkh');
                    if(loglevel>0) console.log(`└── ✅ Generated: ${address}`);
                    batchAddresses.push(address);
                    addresses.push(address);
                    
                    // Queue up address data fetching with rate limiting
                    batchPromises.push(fetchAddressData(address, client, network));
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    if(loglevel>0) console.log(`└── ❌ Error: ${errorMessage}`);
                    continue;
                }
            }

            if(loglevel>0) console.log(`\n🔄 Checking transactions for ${batchAddresses.length} addresses`);

            try {
                // Process batch of addresses in parallel
                const results = await Promise.allSettled(batchPromises);
                let batchHasTransactions = false;
                
                for (let j = 0; j < results.length; j++) {
                    const result = results[j];
                    const address = batchAddresses[j];
                    
                    if (result.status === 'fulfilled') {
                        const { utxos: addressUtxos, history: addressHistory, balance } = result.value;
                        
                        // Update global address balances
                        if (balance) {
                            addressBalances.set(address, {
                                confirmed: balance.confirmed,
                                unconfirmed: balance.unconfirmed
                            });
                            if(loglevel>0) console.log(`└── 💰 Balance: ${balance.confirmed/100000000} BTC (confirmed)`);
                        }

                        if (addressHistory.length > 0 || addressUtxos.length > 0) {
                            transactionsFound = true;
                            consecutiveUnused = 0;
                            if(loglevel>0) console.log(`└── ✨ Found ${addressHistory.length} transactions for ${address}`);
                            
                            // Extend scanning window when we find transactions
                            if (limit !== 1) {
                                limit = Math.max(limit, i + GAP_LIMIT + 10);
                            }
                        } else {
                            consecutiveUnused++;
                            if(loglevel>0) console.log(`└── 📭 No transactions found for ${address}`);
                            if (!unusedAddress) {
                                unusedAddress = address;
                            }
                        }

                        utxos.push(...addressUtxos);
                        history.push(...addressHistory);
                        addresses.push(address);
                        // Check for the first unused address
                        if (addressUtxos.length === 0 && addressHistory.length === 0) {
                            unusedAddress = address;
                        }
                    }
                }
            } catch (error) {
                console.error(`Error fetching data for address ${address}:`, error);
            }
        }
    } catch (error) {
        console.error(`Error in scanDerivationPath: ${error}`);
    }

    const timestamp = new Date().toISOString();
    /** @type {LogEntry} */
    const logEntry = {
        timestamp,
        message: `Scanned derivation path: ${basePath}`,
        type: 'info'
    };

    logStore.update(currentLogs => {
        const newLogs = [logEntry, ...currentLogs];
        return newLogs.slice(0, 1000); // Keep last 1000 logs
    });
    console.log(`Scanned derivation path: ${basePath}`);

    return {
        addresses,
        utxos,
        history,
        unusedAddress,
        transactionsFound
    };
}
