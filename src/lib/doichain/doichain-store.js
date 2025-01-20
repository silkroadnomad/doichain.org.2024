import { writable } from 'svelte/store';
import { DOICHAIN, DOICHAIN_REGTEST } from '$lib/doichain/doichain.js';
export const peerIdFromHash = writable(null);
export const network = writable(peerIdFromHash?DOICHAIN_REGTEST:DOICHAIN);

const BITCOIN_MAINNET = {
	name: 'bitcoin-mainnet',
	messagePrefix: '\x18Bitcoin Signed Message:\n',
	bech32: 'bc',
	bip32: {
		public: 0x0488b21e,
		private: 0x0488ade4
	},
	pubKeyHash: 0x00,
	scriptHash: 0x05,
	wif: 0x80
};


export const electrumServers = [
	{
	  network: 'doichain-mainnet',
	  host: 'pink-deer-69.doi.works',
	  port: 50004,
	  protocol: 'wss',
	},
	{
	  network: 'doichain-mainnet',
	  host: 'ugly-bird-70.doi.works',
	  port: 50004,
	  protocol: 'wss',
	},
	{
	  network: 'doichain-mainnet',
	  host: 'lovely-dolphin-15.doi.works',
	  port: 50004,
	  protocol: 'wss',
	},
	{
	  network: 'doichain-mainnet',
	  host: 'big-parrot-60.doi.works',
	  port: 50004,
	  protocol: 'wss',
	},
	{
	  network: 'doichain-mainnet',
	  host: 'cuddly-mouse-39.doi.works',
	  port: 50004,
	  protocol: 'wss',
	},
	{
	  network: 'doichain-mainnet',
	  host: 'gentle-liger-36.doi.works',
	  port: 50004,
	  protocol: 'wss',
	},
	{
	  network: 'doichain-mainnet',
	  host: 'white-snail-54.doi.works',
	  port: 50004,
	  protocol: 'wss',
	},
	{
	  network: 'doichain-regtest',
	  host: peerIdFromHash?'localhost':'electrumx',
	  port: 8081,
	  protocol: 'ws',
	},
	{
		network: 'doichain-regtest',
		host: peerIdFromHash?'localhost':'electrumx',
		port: 8081,
		protocol: 'ws',
	  },
	{
	  network: 'bitcoin-mainnet',
	  host: 'btcpay.doi.works',
	  port: 50004,
	  protocol: 'wss',
	},
  ];


export const networks = [
	{ id: 'doichain-mainnet', text: 'Doichain-Mainnet', value: DOICHAIN },
	// { id: 'testnet', text: 'Testnet', value: DOICHAIN_TESTNET },
	{ id: 'doichain-regtest', text: 'Doichain-Regtest', value: DOICHAIN_REGTEST },
	{ id: 'bitcoin-mainnet', text: 'Bitcoin-Mainnet', value: BITCOIN_MAINNET }
];

export const libp2p = writable();
export const helia = writable();
export const orbitdb = writable();
export const connectedPeers = writable([]);
export const blockHeight = writable(0);
export const nameOps = writable([]);
export const requestedCids = writable([]);
export const cidMessages = writable([]);
export const scanOpen = writable(false);
export const scanData = writable();
export const connectedServer = writable('offline');
export const electrumClient = writable();
export const electrumServerVersion = writable('');
export const electrumServerBanner = writable('disconnected');
export const electrumBlockchainBlockHeadersSubscribe = writable();
export const electrumBlockchainRelayfee = writable();
export const electrumBlockchainBlockHeaders = writable();
export const logs = writable([]);
export const orbitDB = writable(null);
