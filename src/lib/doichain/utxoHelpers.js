import { getUTXOSFromAddress } from "./nameDoi.js";

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
                hash: utxo.tx_hash,
                n: utxo.fullTx.n,
                value: utxo.value,
                address: utxo.fullTx.scriptPubKey.addresses[0]})
        } else {
            nameOpTxs.push(scriptPubKey.nameOp.name)
        }
    }
    return { nameOpTxs, utxoAddresses, totalUtxoValue }
}