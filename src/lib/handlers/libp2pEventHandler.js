import { connectedPeers } from '$lib/doichain/doichain-store.js'
import { handlePubsubMessage } from './pubsubMessageHandler.js'

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
        console.log('No connected peers, attempting to reconnect...')
        try {
            await libp2p.start()
            // Attempt to connect to bootstrap/relay nodes
            const bootstrapAddrs = libp2p.config?.bootstrap || []
            for (const addr of bootstrapAddrs) {
                try {
                    await libp2p.dial(addr)
                } catch (err) {
                    console.warn(`Failed to connect to bootstrap node ${addr}:`, err)
                }
            }
        } catch (err) {
            console.error('Reconnection attempt failed:', err)
        }
    }

    libp2p.addEventListener('connection:close', (p) => {
        connectedPeers.update(peers => {
            const updatedPeers = peers.filter(peer => peer.id !== p.detail.id)
            // If this was our last peer, attempt reconnection
            if (updatedPeers.length === 0) {
                setTimeout(attemptReconnection, 60000) //TODO this does only 1 time reconnection after reconnect can we try more often?
            }
            return updatedPeers
        })
    })

    // Peer connect event
    libp2p.addEventListener('peer:connect', () => {
        publishList100Request()
    })

    // Pubsub logging events
    libp2p.services.pubsub.addEventListener('publish', (evt) => {
        if (evt.detail.topic === pubsubPeerDiscoveryTopics || evt.detail.topic === '_peer-discovery._p2p._pubsub') {
//            console.log('Publishing peer discovery message on topic:', evt.detail.topic)
        }
    })

    libp2p.services.pubsub.addEventListener('message', (evt) => {
        if (evt.detail.topic === pubsubPeerDiscoveryTopics || evt.detail.topic === '_peer-discovery._p2p._pubsub') {
   //         console.log('Received peer discovery message on topic:', evt.detail.topic)
        }
    })

    libp2p.addEventListener('peer:discovery', (evt) => {
       // console.log('Discovered new peer:', evt.detail.id.toString())
    })
} 