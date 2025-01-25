import { nameOps, cidMessages, requestedCids, orbitdb } from '$lib/doichain/doichain-store.js';
import { CONTENT_TOPIC } from '$lib/doichain/doichain.js';
import { get } from 'svelte/store';
import { getOrCreateDB } from '$lib/utils/orbitDBUtils.js';
let _requestedCids = [];
requestedCids.subscribe((_) => {
	_requestedCids = _;
});
export function handlePubsubMessage(event, libp2p) {
	if (event.detail.topic === 'doichain._peer-discovery._p2p._pubsub') {
		console.log('A: handlePubsubMessage', event.detail.topic)
		// handlePeerDiscoveryMessage(event, libp2p)
	} else if (event.detail.topic === CONTENT_TOPIC) {
		console.log(`Received pubsub message from ${event.detail.from} on topic ${event.detail.topic}`);
		
		// Check and establish WebRTC connection if needed
		checkAndDialPeer(libp2p, event.detail.from).then(() => {
			handlePinningMessage(event, libp2p);
		}).catch(error => {
			console.error('Failed to establish connection with peer:', error);
		});
	}
}

async function checkAndDialPeer(libp2p, peerId) {
	try {
		// Check if we're already connected
		const connections = libp2p.getConnections(peerId);
		if (connections.length > 0) {
			console.log(`Already connected to peer ${peerId}`);
			return;
		}

		// Get peer info to find WebRTC addresses
		const peerInfo = await libp2p.peerStore.get(peerId);
		const webrtcAddresses = peerInfo.addresses
			.map(addr => addr.multiaddr)
			.filter(ma => ma.protos().some(p => p.name === 'webrtc'));

		if (webrtcAddresses.length === 0) {
			console.log(`No WebRTC addresses found for peer ${peerId}`);
			return;
		}

		console.log(`Found WebRTC addresses for peer ${peerId}:`, webrtcAddresses.map(ma => ma.toString()));
		
		// Try dialing each WebRTC address
		for (const address of webrtcAddresses) {
			try {
				console.log(`Attempting to dial peer ${peerId} at ${address.toString()}`);
				await libp2p.dial(address);
				console.log(`Successfully connected to peer ${peerId} via WebRTC`);
				return; // Success, stop trying other addresses
			} catch (error) {
				console.warn(`Failed to dial ${address.toString()}:`, error);
				// Continue to next address
			}
		}

		throw new Error(`Could not establish WebRTC connection to ${peerId}`);
	} catch (error) {
		console.error(`Failed to connect to peer ${peerId}:`, error);
		throw error;
	}
}

function handlePinningMessage(event, libp2p) {
	const message = new TextDecoder().decode(event.detail.data);

	try {
		const jsonData = JSON.parse(message);

		// Handle array type messages (nameOps)
		if (Array.isArray(jsonData)) {
			handleNameOpsMessage(message);
		} else if (
			typeof jsonData === 'object' &&
			(	jsonData.status === 'ADDING-CID' ||
				jsonData.status === 'ADDED-CID' || 
				jsonData.status === "CID-PINNED-WITH-NAME")
		) {
			console.log('Received CID message:', jsonData);

			// Check if message is from the allowed peer
			if (
				event.detail.from.toString() !== '12D3KooWLzMiAt4S8YWH7QANh3SURDwfV3Cgih1XYPAePSYWR1cj' &&
				event.detail.from.toString() !== '12D3KooWP2xyF6sHAtfVbUybUsu4F8Ku6acw9X5PX815fQt17Lm2' &&
				event.detail.from.toString() !== '12D3KooWQpeSaj6FR8SpnDzkESTXY5VqnZVWNUKrkqymGiZTZbW2'
			) {
				//local dev
				console.log('Ignoring CID message from unauthorized peer:', event.detail.from);
				return;
			}

			cidMessages.update((messages) => {
				console.log('_requestedCids', _requestedCids);
				console.log('cid', jsonData.cid);
				// Check if any of the CIDs in the message match our requested CIDs
				const hasRequestedCid = _requestedCids.includes(jsonData.cid);

				if (!hasRequestedCid) {
					console.log('Ignoring CID message for unrequested CIDs');
					return messages;
				}

				// Store the peerId and multiaddress along with the message
				const peerId = event.detail.from.toString();
				const multiaddress = libp2p.getMultiaddrs().map((ma) => ma.toString());

				const updatedMessage = {
					...jsonData,
					peerId,
					multiaddress
				};

				return [updatedMessage, ...messages];
			});
		}
	} catch (e) {
		// Handle non-JSON arra
		if (message === 'LIST_LAST_100') {
			handleList100Request(libp2p);
		} else if (
			message.startsWith('LIST_DATE:') ||
			message.startsWith('LIST_ALL') ||
			message.endsWith(':NONE')
		) {
			console.log('ignoring other list messages for now', message);
		} else {
			// console.error("Error parsing message:", e);
		}
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

function sanitizeInput(input) {
	return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function handleNameOpsMessage(message) {
	nameOps.update((currentOps) => {
		try {
			const jsonMessage = JSON.parse(message);
			const sanitizedMessage = jsonMessage.map((op) => ({
				...op,
				nameId: sanitizeInput(op.nameId),
				nameValue: sanitizeInput(op.nameValue),
			}));

			const newNameOps = sanitizedMessage.filter((newOp) => {
				const isDuplicate = currentOps.some((existingOp) => {
					return existingOp.txid === newOp.txid;
				});
				return !isDuplicate;
			});

			if (newNameOps.length > 0) {
				const updatedOps = [...currentOps, ...newNameOps].sort((a, b) => {
					const timeA = a.blocktime || 0;
					const timeB = b.blocktime || 0;
					return timeB - timeA;
				});

				// Store new nameOps in OrbitDB
				const dbInstance = get(orbitdb);
				if (dbInstance) {
					console.log("dbInstance available",dbInstance)
					getOrCreateDB(dbInstance).then(async db => {
						console.log("db", db);
						newNameOps.forEach(op => {
							const doc = {
								_id: op.txid,
								...op
							};
							
							console.log("doc", doc);
							
							// Use proper put method
							db.put(doc)
								.then(hash => {
									console.log('Stored document with hash:', hash);
									return db.all();
								})
								.then(entries => {
									console.log('Current database entries:', entries);
								})
								.catch(error => {
									console.error('Error storing nameOp in OrbitDB:', op.txid, error);
								});
						});
					}).catch(error => {
						console.error('Error getting database:', error);
					});
				}

				return updatedOps;
			}
			return currentOps;
		} catch (e) {
			console.error('Failed to parse message:', e);
			return currentOps;
		}
	});
}
