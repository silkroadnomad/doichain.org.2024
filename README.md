# Doichain.org

Key Features:
Name Registration and Availability Check:
Users can input a name to check its availability on the Doichain network.
If the name is available, users can register it, and if it's already taken, they receive a notification.
Non-Fungible Coin (NFC) Management:
The app allows users to mint and manage NFCs, which are similar to NFTs but on the Doichain network.
Users can upload images and metadata to IPFS (InterPlanetary File System) and associate them with NFCs.
Advanced PSBT Transaction Management:
Users can prepare and sign Partially Signed Bitcoin Transactions (PSBT) using UTXOs from their wallet.
Features an animated BC-QR code display that cycles through QR code frames for PSBT data.
These QR codes can be scanned by DoiWallet, which specifically understands and can process NameOp transactions.
The animated QR approach allows transmission of larger PSBT data that wouldn't fit in a single QR code. 4. Filtering and Displaying Name Operations:
Users can filter and view different types of name operations (e.g., NFCs, names, DOI, etc.) using a set of predefined filters.
The app displays these operations in a card-like format, similar to NFTs.
Integration with Libp2p and Helia:
The app uses libp2p for peer-to-peer communication and Helia for IPFS integration, allowing decentralized data storage and retrieval.
Responsive UI with Svelte:
The application is built using Svelte, providing a responsive and interactive user interface.
It includes animations and transitions for a smooth user experience.
The animated BC-QR code feature is particularly important as it enables secure and efficient transfer of PSBT data to the DoiWallet, making it possible to handle complex NameOp transactions in a user-friendly way.

# Todo

- [ ] PWA needs screenshots form-factor wide (see Opera error), not wide and a quadratic symbol
- [ ] every browser should also index the blockchain for name_ops (like the relay does) and answer for requests
- [ ] question is: how much should every browser cache
- [x] restart electrumx / libp2p when disconnected
- [ ] Docker Compose file for Doichain RegTest + Electrumx
- [ ] enable "Buy with DoiWallet"
  - [ ] click overwrite to set a price
  - [ ] when a price (and recipient address) is set a new psbt & qr-code is generated which can be scanned by DoiWallet
  - [ ] the signed transaction qr code on the doiWallet can be scanned by the web app
  - [ ] the signed transaction will be stored with the new metadata.json as two fields: price, partially-signed-tx
  - [ ] the relay is pinning it
  - [ ] when clicking on "Buy-With-DoiWallet"
- [ ] when receiving name_ops they must be checked if they are trustworthy (anybody could send nameOps arond and claim they are from the blockchain)
- [ ] if a nameOp appears in the mempool and its coherent with a just signed psbt nameop transaction, switch to view it.
- [ ] enable mpg, mp4, mov support in NFT upload und display.
  - [ ] when uploading movies to IPFS, is it possible to stream them.
- [ ] test a deployed version is receiving all nameOps from locally running browsers via istanbul
  - https://ipfs.video/
- [ ] when entering a Doichain address in to find name field inside nameInput.svelte, scan address for nameOps and use them in currentNameOp and currentNameUtxo
- [ ] add apple-touch-icon to app.html
- [ ] add change and total utxo value below
- [ ] download psbt file (keep psbt into clipboard)
- [ ] pub-sub messages from relay (CID-ADDING, CID-ADDED) seem not reliable. Should we repeat them?
- [ ] fix meta info for social media posts og:type twitter:type
- [ ] remove / fade out messages from nameInput
- [ ] custom name error message handling should be handled in checkName function and not in nameInput
- [x] add address scan function to nameDOI utxo input addreses
- [x] retry publish NEW-CID if no ADDED response from relay
- [x] add button "overwrite" in transaction details, when clicked the NFTCard should open as the name would be not yet defined
- [x] toggle between local and public relay when in svelte development mode
- [x] when reading TOP 100 NameOps other peers then relay can answer too
- [x] LIST_LAST_100 should be indexed in parallel on relay
- [x] LIST_LAST_100 100 name-ops message should be called
- [x] relay doesn't publish
- [x] deploy on vercel
- [x] deploy on ipfs
- [x] fix ipfs pinning service
  - [x] fix libs in +layout.js
  - [x] call pubsub for current name_ops and display as nft cards (such as on OpenSea)
- [x] fix toggle
- [x] fix expires and height
- [x] center NFT on screen below input
- [x] if name-op is no nft just display detail data with a simple dummy foto
