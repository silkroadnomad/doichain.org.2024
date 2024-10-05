import { Psbt } from "bitcoinjs-lib";
import { getNameOPStackScript } from "./getNameOPStackScript.js";
import { VERSION } from "./doichain.js";

/**
 * Creates and signs a Partially Signed Bitcoin Transaction (PSBT) for registering a Doichain name.
 * 
 * @param {Array<Object>} _utxoAddresses - Array of UTXO objects to use as inputs.
 * @param {string} _name - The Doichain name to be registered.
 * @param {string} _value - The Doichain value to be registered with the nameId.
 * @param {Object} _network - The network object (e.g., DOICHAIN) containing network-specific parameters.
 * @param {number} _storageFee - The fee for storing the name on the Doichain network.
 * @param {string} _recipientAddress - The address that will own the registered name.
 * @param {string} _changeAddress - The address to send any remaining funds after the transaction.
 * @param {string} doichainAddress - The Doichain address used for error messages.
 * 
 * @returns {Object} An object containing the PSBT base64 string and transaction details.
 * 
 * @throws {Error} Implicitly throws an error if any of the required parameters are missing or invalid.
 */
export function prepareSignTransaction(_utxoAddresses, _name, _nameValue, _network, _storageFee, _recipientAddress, _changeAddress, doichainAddress) {
    if(!_name || _utxoAddresses.length === 0 || !_recipientAddress || !_changeAddress) {
        return { error: "Missing required parameters" };
    }

    const psbt = new Psbt({ network: _network });
    let totalInputAmount = 0;
    let totalOutputAmount = 0;
    let transactionFee;
    let changeAmount;

    _utxoAddresses.forEach(utxo => {
        const isSegWit = utxo?.fullTx.scriptPubKey?.type === "witness_v0_keyhash" || scriptPubKeyHex?.startsWith('0014') || scriptPubKeyHex?.startsWith('0020');
        if (isSegWit) {
            psbt.addInput({
                hash: utxo.tx_hash,
                index: utxo.tx_pos,
                witnessUtxo: {
                    script: Buffer.from(utxo?.fullTx.scriptPubKey.hex, 'hex'),
                    value: utxo.value,
                }
            });
        } else {
            psbt.addInput({
                hash: utxo.tx_hash,
                index: utxo.tx_pos,
                nonWitnessUtxo: Buffer.from(utxo?.fullTx.hex, 'hex')
            });
        }
        totalInputAmount += utxo.value;
    });

    if(_name) {
        try {
            const opCodesStackScript = getNameOPStackScript(_name, _nameValue || 'empty', _recipientAddress, _network);
            psbt.setVersion(VERSION); // for name transactions
            psbt.addOutput({
                script: opCodesStackScript,
                value: _storageFee
            });
            totalOutputAmount = totalOutputAmount + _storageFee;
        }catch( ex ) { console.error(ex) }
    }

    const feeRate = 34 * 500; // TODO: get feeRate from an API
    transactionFee = (_utxoAddresses.length + 1) * 180 + 3 * feeRate;
    changeAmount = totalInputAmount - totalOutputAmount - transactionFee;
    let totalAmount = totalOutputAmount + transactionFee;
    if(changeAmount < 0) {
        return {
            error: `Funds on ${doichainAddress} are insufficient for this Doichain name`,
            isUTXOAddressValid: false
        };
    }

    psbt.addOutput({
        address: _changeAddress || doichainAddress,
        value: changeAmount,
    });

    const psbtFile = psbt.toBase64();

    return {
        psbtBase64: psbtFile,
        totalInputAmount,
        totalOutputAmount,
        transactionFee,
        changeAmount,
        totalAmount
    };
}