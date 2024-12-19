import { nameOps } from '$lib/doichain/doichain-store.js';

const CONTENT_TOPIC = '/doichain-nfc/1/message/proto';

export function handlePubsubMessage(event, libp2p) {
	if (event.detail.topic === 'doichain._peer-discovery._p2p._pubsub') {
		// handlePeerDiscoveryMessage(event, libp2p)
	} else if (event.detail.topic === CONTENT_TOPIC) {
		console.log(`Received pubsub message from ${event.detail.from} on topic ${event.detail.topic}`);
		handleContentMessage(event, libp2p);
	}
}

function handleContentMessage(event, libp2p) {
	const message = new TextDecoder().decode(event.detail.data);

	if (
		message.startsWith('ADDING-CID') ||
		message.startsWith('ADDED-CID') ||
		message.startsWith('PINNING-CID') ||
		message.startsWith('PINNED-CID')
	) {
		console.log('ignoring cid messages for now', message);
	} else if (message === 'LIST_LAST_100') {
		handleList100Request(libp2p);
	} else if (
		message.startsWith('LIST_DATE:') ||
		message.startsWith('LIST_ALL') ||
		message.endsWith(':NONE')
	) {
		console.log('ignoring other list messages for now', message);
	} else {
		handleNameOpsMessage(message);
	}
}

function handleList100Request(libp2p) {
	console.log('Received request for LIST_LAST_100');
	if (nameOps.length > 0) {
		const lastNameOps = nameOps.slice(0, 100);
		console.log(`Publishing last ${lastNameOps.length} NameOps`, lastNameOps);
		const jsonString = JSON.stringify(lastNameOps);
		libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode(jsonString));
	} else {
		console.log('No NameOps found');
		libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode('LAST_100_CIDS:NONE'));
	}
}

function handleNameOpsMessage(message) {
	// console.log('handleNameOpsMessage', message);
	nameOps.update((currentOps) => {
		try {
			const jsonMessage = JSON.parse(message);

			const newNameOps = jsonMessage.filter((newOp) => {
				const isDuplicate = currentOps.some((existingOp) => {
					return existingOp.txid === newOp.txid;
				});
				return !isDuplicate;
			});

			console.log('newNameOps.length', newNameOps.length);

			if (newNameOps.length > 0) {
				const updatedOps = [...currentOps, ...newNameOps].sort((a, b) => {
					const timeA = a.blocktime || 0;
					const timeB = b.blocktime || 0;
					return timeB - timeA;
				});
				console.log(
					`Added ${newNameOps.length} new unique nameOps. Total nameOps after update:`,
					updatedOps.length
				);
				return updatedOps;
			}
			console.log('No new unique nameOps to add.');
			return currentOps;
		} catch (e) {
			console.log('message', message);
			console.error('Failed to parse message:', e);
			return currentOps;
		}
	});
}
