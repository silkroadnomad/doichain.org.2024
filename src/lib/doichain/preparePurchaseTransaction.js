export function preparePurchaseTransaction(
  selectedUtxos,
  nameId,
  nameValue,
  DOICHAIN,
  price,
  sellerRecipientAddress
) {
  try {
    const psbt = new DOICHAIN.Psbt();
    
    // Add the name_op as input
    selectedUtxos.forEach(utxo => {
      psbt.addInput({
        hash: utxo.tx_hash,
        index: utxo.tx_pos,
        // ... other input details
      });
    });

    // Add recipient output for the payment
    psbt.addOutput({
      address: sellerRecipientAddress,
      value: price
    });

    // Add name operation data
    // ... add your name operation output logic here

    return {
      psbtBase64: psbt.toBase64(),
      transactionFee: fee,
      totalAmount: price
    };
  } catch (error) {
    return { error: error.message };
  }
} 