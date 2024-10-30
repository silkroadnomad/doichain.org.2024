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

    libp2p.addEventListener('connection:close', (p) => {
        connectedPeers.update(peers => peers.filter(peer => peer.id !== p.detail.id))
    })

    // Peer discovery and connection
    libp2p.addEventListener('peer:discovery', async (evt) => {
        const peer = evt.detail
        console.log('Discovered peer:', peer.id.toString())
        console.log('Peer multiaddrs:', peer.multiaddrs.map(ma => ma.toString()))

        // for (const addr of peer.multiaddrs) {
        //     try {
        //         const connection = await libp2p.dial(addr)
        //         console.log('Connected to discovered peer:', peer.id.toString())
        //         console.log('Using multiaddr:', addr.toString())
        //         break
        //     } catch (err) {
        //         console.error('Failed to connect to discovered peer:', peer.id.toString())
        //         console.error('Failed multiaddr:', addr.toString())
        //         console.error('Error:', err)
        //     }
        // }
    })

    // Peer connect event
    libp2p.addEventListener('peer:connect', () => {
        publishList100Request()
    })

    // Pubsub logging events
    libp2p.services.pubsub.addEventListener('publish', (evt) => {
        if (evt.detail.topic === pubsubPeerDiscoveryTopics || evt.detail.topic === '_peer-discovery._p2p._pubsub') {
            console.log('Publishing peer discovery message on topic:', evt.detail.topic)
        }
    })

    libp2p.services.pubsub.addEventListener('message', (evt) => {
        if (evt.detail.topic === pubsubPeerDiscoveryTopics || evt.detail.topic === '_peer-discovery._p2p._pubsub') {
            console.log('Received peer discovery message on topic:', evt.detail.topic)
        }
    })

    libp2p.addEventListener('peer:discovery', (evt) => {
        console.log('Discovered new peer:', evt.detail.id.toString())
    })
} 