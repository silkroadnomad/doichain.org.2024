import { electrumServerVersion, connectedServer, electrumServerBanner } from './doichain-store.js';

export async function setupElectrumConnection(network) {
	const { connectElectrum } = await import('./connectElectrum.js');

	await connectElectrum(network);
	console.log('electrum connected');

	window.addEventListener('offline', handleOffline);
	window.addEventListener('online', () => handleOnline(network));
}

function handleOffline() {
	console.log('offline');
	electrumServerVersion.set('server disconnected');
	connectedServer.set('offline');
	electrumServerBanner.set('server disconnected');
}

async function handleOnline(network) {
	console.log('online');
	console.log('connecting to electrum', network);
	const { connectElectrum } = await import('./connectElectrum.js');
	await connectElectrum(network);
}

let blockHeight = null;

export function subscribeToBlockHeight(electrumClient) {
	electrumClient.subscribe.on('blockchain.headers.subscribe', (header) => {
		blockHeight = header.height;
		console.log('Current block height:', blockHeight);
	});

	// Send the subscription request
	electrumClient
		.request('blockchain.headers.subscribe', [])
		.then((header) => {
			blockHeight = header.height;
			console.log('Subscribed to block headers. Current block height:', blockHeight);
		})
		.catch((error) => {
			console.error('Error subscribing to block headers:', error);
		});
}
