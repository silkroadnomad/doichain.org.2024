# Doichain.org

# Todo
- [ ] test a deployed version is receiving all nameOps from locally running browsers via istanbul
- [x] when reading TOP 100 NameOps other peers then relay can answer too
- [ ] when receiving name_ops they must be checked if they are trustworthy (anybody could send nameOps arond and claim they are from the blockchain) 
- [ ] when entering a Doichain address in to find name field inside nameInput.svelte, scan address for nameOps and use them in currentNameOp and currentNameUtxo
- [ ] pub-sub messages from relay (CID-ADDING, CID-ADDED) seem not reliable. Should we repeat them? 
- [x] LIST_LAST_100 should be indexed in parallel on relay
- [x] LIST_LAST_100 100 name-ops message should be called
- [x] relay doesn't publish
- [x] deploy on vercel 
- [x] deploy on ipfs
- [ ] add change and total utxo value below
- [ ] download psbt file (keep psbt into clipboard)
- [x] fix ipfs pinning service
  - [x] fix libs in +layout.js
  - [x] call pubsub for current name_ops and display as nft cards (such as on OpenSea)
- [x] fix toggle 
- [ ] fix meta info for social media posts og:type twitter:type
- [ ] remove / fade out messages from nameInput
- [ ] custom name error message handling should be handled in checkName function and not in nameInput
- [x] fix expires and height
- [x] center NFT on screen below input
- [x] if name-op is no nft just display detail data with a simple dummy foto