import { Psbt } from 'bitcoinjs-lib';

export function preparePurchaseTransaction(selectedUtxos, price, sellerRecipientAddress, _network) {
  try {
    // Get seller's address from the name UTXO if no explicit address is provided
    const sellerAddress = sellerRecipientAddress || selectedUtxos[0]?.address;
    if (!sellerAddress) {
      throw new Error('No seller address available');
    }

    const psbt = new Psbt({ network: _network });
    //only one nameOp possible  
    selectedUtxos.forEach(utxo => {
      const isSegWit = utxo?.fullTx?.scriptPubKey?.type === "witness_v0_keyhash" ||  utxo?.scriptPubKey?.type === "witness_v0_keyhash";
      if (isSegWit) {
          psbt.addInput({
              hash: utxo.tx_hash || utxo.hash,
              index: utxo.tx_pos || utxo.n,
              witnessUtxo: {
                  script: Buffer.from(utxo?.scriptPubKey?.hex || utxo?.hex, 'hex'),
                  value: utxo.value,
              }
          });
      } else {
          psbt.addInput({
              hash: utxo.tx_hash || utxo.hash,
              index: utxo.tx_pos || utxo.n,
              nonWitnessUtxo: Buffer.from(utxo?.hex || utxo?.fullTx?.hex, 'hex')
          });
      }
  })

    psbt.addOutput({
      address: sellerAddress,
      value: parseInt(price)
    });
    psbt.setMaximumFeeRate(10000) // 10000 sat/vbyte we need this becausee doiWallet is complaining about the fee rate
    ///psbt.validateSignaturesOfInput(0);
    ///psbt
    //psbt.validateSignaturesOfAllInputs(noValidateSignature);
   const psbtBase64 = psbt.toBase64()
   console.log("psbtBase64",psbtBase64)
   return psbtBase64;
  } catch (error) {
    console.log("preparePurchaseTransaction error",error)
    return { error: error.message };
  }
}