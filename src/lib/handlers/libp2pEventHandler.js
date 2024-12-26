import { connectedPeers } from '$lib/doichain/doichain-store.js'
import { handlePubsubMessage } from './pubsubMessageHandler.js'
import { peerIdFromString } from '@libp2p/peer-id'

export function setupLibp2pEventHandlers(libp2p, publishList100Request) {
    const CONTENT_TOPIC = '/doichain-nfc/1/message/proto'
    const pubsubPeerDiscoveryTopics = import.meta.env.VITE_P2P_PUPSUB?.split(',') || ['doichain._peer-discovery._p2p._pubsub']

    // Subscribe to content topic
    libp2p.services.pubsub.subscribe(CONTENT_TOPIC)
    const pubsub = libp2p.services.pubsub
    pubsub.addEventListener('message', async (event) => {
        handlePubsubMessage(event, libp2p)
    })

    // Connection events
    libp2p.addEventListener('connection:open', (p) => {
        connectedPeers.update(peers => [...peers, p.detail])
        console.log("connectedPeers", p.detail.remoteAddr.toString())
    })

    async function attemptReconnection() {
        console.log('No connected peers, attempting to reconnect...');
        const maxAttempts = 50; // Maximum number of reconnection attempts
        let attempts = 0;

        const reconnect = async () => {
            console.log(`Reconnection attempt ${attempts + 1} of ${maxAttempts}`);

            if (attempts >= maxAttempts) {
                console.error('Max reconnection attempts reached.');
                return;
            }

            try {
                const peers = await libp2p.peerStore.all();
                console.log("Attempting to connect to peers", peers);

                for (const peer of peers) {
                    const peerId = peerIdFromString(peer.id.toString());
                    const multiaddrs = peer.addresses.map(addr => addr.multiaddr.toString());
                    console.log(`Attempting to connect to peer ID: ${peerId.toString()}`);
                    console.log('Multiaddresses:', multiaddrs);

                    // Filter for localhost addresses
                    const localhostAddrs = multiaddrs.filter(addr => addr.includes('127.0.0.1') || addr.includes('localhost'));
                    console.log('Localhost Addresses:', localhostAddrs);

                    // Attempt to connect to localhost addresses first
                    for (const addr of localhostAddrs) {
                        try {
                            console.log(`Trying to connect to localhost address: ${addr}`);
                            await libp2p.dialProtocol(peerId, addr);
                            console.log(`Connected to localhost peer at ${addr}`);
                            return; // Exit if connection is successful
                        } catch (err) {
                            console.warn(`Failed to connect to localhost peer at ${addr}:`, err);
                        }
                    }

                    // If no localhost connection, try other addresses
                    if (localhostAddrs.length === 0) {
                        console.log('No localhost addresses found, trying other addresses.');
                        for (const addr of multiaddrs) {
                            try {
                                console.log(`Trying to connect to address: ${addr}`);
                                await libp2p.dialProtocol(peerId, addr);
                                console.log(`Connected to peer at ${addr}`);
                                return; // Exit if connection is successful
                            } catch (err) {
                                console.warn(`Failed to connect to peer at ${addr}:`, err);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Reconnection attempt failed:', err);

                // Check if the error message contains "Unsupported key type"
                if (err.message.includes('Unsupported key type')) {
                    console.warn('Unsupported key type detected. Clearing peerStore and aborting reconnection.');
                    await libp2p.peerStore.clear(); // Clear all peers from the peerStore
                    return; // Exit the reconnection attempt
                }
            }

            // Check if there are any active connections
            const connections = libp2p.getConnections();
            if (connections.length === 0) {
                attempts++;
                setTimeout(reconnect, 10000); // Retry after 10 seconds
            } else {
                console.log('At least one connection is active, stopping reconnection attempts.');
            }
        };

        // Start the reconnection process
        reconnect();
    }

    libp2p.addEventListener('connection:close', (p) => {
        connectedPeers.update(peers => {
            const updatedPeers = peers.filter(peer => peer.id !== p.detail.id)
            // Log if we have less than 3 connected nodes
            if (updatedPeers.length < 3) {
                console.log(`Warning: Only ${updatedPeers.length} connected peers.`);
            }

            // If this was our last peer, attempt reconnection
            if (updatedPeers.length === 0) {
                attemptReconnection() 
            }
            return updatedPeers
        })
    })

    // Peer connect event
    libp2p.addEventListener('peer:connect', () => {
        publishList100Request()
    })

//     // Pubsub logging events
//     libp2p.services.pubsub.addEventListener('publish', (evt) => {
//         if (evt.detail.topic === pubsubPeerDiscoveryTopics || evt.detail.topic === '_peer-discovery._p2p._pubsub') {
// //            console.log('Publishing peer discovery message on topic:', evt.detail.topic)
//         }
//     })

//     libp2p.services.pubsub.addEventListener('message', (evt) => {
//         if (evt.detail.topic === pubsubPeerDiscoveryTopics || evt.detail.topic === '_peer-discovery._p2p._pubsub') {
//    //         console.log('Received peer discovery message on topic:', evt.detail.topic)
//         }
//     })

//     libp2p.addEventListener('peer:discovery', (evt) => {
//        // console.log('Discovered new peer:', evt.detail.id.toString())
//     })
} 