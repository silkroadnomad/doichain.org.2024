import { getUTXOSFromAddress } from "./nfc/nameDoi.js";

export async function getUtxosAndNamesOfAddress(electrumClient, doichainAddress) {
    let nameOpTxs = []
    let utxoAddresses = []
    let totalUtxoValue = 0
    const result = await getUTXOSFromAddress(electrumClient, doichainAddress)
    for (let utxo of result) {
        const scriptPubKey = utxo.fullTx.scriptPubKey;
        if (!scriptPubKey.nameOp) {
            utxoAddresses.push({
                formattedBlocktime: utxo.fullTx.formattedBlocktime,
                txid: utxo.fullTx.txid,
                hex: utxo.fullTx.hex,
                scriptPubKey: utxo.fullTx.scriptPubKey,
                hash: utxo.tx_hash,
                n: utxo.fullTx.n,
                value: utxo.value,
                height: utxo.height,
                address: utxo.fullTx?.scriptPubKey?.addresses[0]})
        } else {
            nameOpTxs.push({
                name: scriptPubKey.nameOp.name,
                nameValue: scriptPubKey.nameOp.value,
                expires: utxo.height+36000,
                txid: utxo.fullTx.txid,
                hex: utxo.fullTx.hex,
                scriptPubKey: utxo.fullTx.scriptPubKey,
                hash: utxo.tx_hash,
                n: utxo.fullTx.n,
                value: utxo.value,
                height: utxo.height,
                address: utxo.fullTx?.scriptPubKey?.addresses[0]
            })
        }
        totalUtxoValue+=utxo.value;
    }
    return { nameOpTxs, utxoAddresses, totalUtxoValue }
}