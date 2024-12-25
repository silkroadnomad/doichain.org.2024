import { libp2pDefaults } from 'helia'
import { bootstrap } from '@libp2p/bootstrap'
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { noise } from '@chainsafe/libp2p-noise'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { ping } from '@libp2p/ping'
import { identify } from '@libp2p/identify'
import { autoNAT } from '@libp2p/autonat'
import { dcutr } from '@libp2p/dcutr'
import { yamux } from '@chainsafe/libp2p-yamux'
import { dev } from '$app/environment'
import { devToolsMetrics } from '@libp2p/devtools-metrics'
const pubsubPeerDiscoveryTopics = import.meta.env.VITE_P2P_PUPSUB?.split(',') || ['doichain._peer-discovery._p2p._pubsub']

export function createLibp2pConfig() {
    const config = libp2pDefaults()
    config.metrics = devToolsMetrics()
    // Services configuration
    config.services = {
        ...config.services,
        ping: ping(),
        identify: identify(),
        autoNAT: autoNAT(),
        dcutr: dcutr(),
    }

    // Network addresses
    //https://github.com/libp2p/js-libp2p/blob/3244ed08625516b25716485c936c26a34b69466a/doc/migrations/v0.42-v0.43.md
    config.addresses = { 
        listen: dev 
            ? ['/p2p-circuit', '/webrtc', '/webrtc-direct', '/wss', '/ws'] 
            : ['/p2p-circuit', '/webrtc', '/webrtc-direct', '/wss']
    }

    // Transport configuration
    config.transports = [
        webSockets({ filter: filters.all }),
        webRTC({
            rtcConfiguration: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    // Add a TURN server if possible
                    // { urls: 'turn:your-turn-server.com:3478', username: 'username', credential: 'password' }
                ]
            }
        }),
        webRTCDirect(),
        circuitRelayTransport()
    ]

    config.connectionEncrypters = [noise()]
    config.streamMuxers = [
        yamux({
            enableKeepAlive: true,
            keepAliveInterval: 10000,
            keepAliveTimeout: 30000,
        })
    ]

    config.connectionManager = {
        ...config.connectionManager,
        maxConnections: 50,
        autoDialInterval: 10000,
        autoDial: true,
    }

    const pubsubConfig = gossipsub({ 
        emitSelf: false, 
        allowPublishToZeroTopicPeers: true, 
        canRelayMessage: true 
    })
    config.services.pubsub = pubsubConfig
    //delete config.services['delegatedRouting']
    // const bootstrapList = ['/ip4/127.0.0.1/tcp/8080/ws/p2p/12D3KooWQvNEC1EAnupGVsT517abvx7w6FcQ7u8LciKd2ha1XgCm']
        const bootstrapList = dev ? ['/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWQpeSaj6FR8SpnDzkESTXY5VqnZVWNUKrkqymGiZTZbW2']: 
        ['/dns4/istanbul.le-space.de/tcp/443/wss/p2p/12D3KooWP2xyF6sHAtfVbUybUsu4F8Ku6acw9X5PX815fQt17Lm2',
        '/dns4/ipfs.namokado.com/tcp/443/wss/p2p/12D3KooWLzMiAt4S8YWH7QANh3SURDwfV3Cgih1XYPAePSYWR1cj']

    // const bootstrapList = dev ? ['/ip4/127.0.0.1/tcp/9091/ws/p2p/12D3KooWQpeSaj6FR8SpnDzkESTXY5VqnZVWNUKrkqymGiZTZbW2',
    //     // '/dns4/istanbul.le-space.de/tcp/443/wss/p2p/12D3KooWP2xyF6sHAtfVbUybUsu4F8Ku6acw9X5PX815fQt17Lm2',
    //    '/dns4/ipfs.namokado.com/tcp/443/wss/p2p/12D3KooWLzMiAt4S8YWH7QANh3SURDwfV3Cgih1XYPAePSYWR1cj'
    // ]
    // : ['/dns4/istanbul.le-space.de/tcp/443/wss/p2p/12D3KooWP2xyF6sHAtfVbUybUsu4F8Ku6acw9X5PX815fQt17Lm2',
    //    '/dns4/ipfs.namokado.com/tcp/443/wss/p2p/12D3KooWLzMiAt4S8YWH7QANh3SURDwfV3Cgih1XYPAePSYWR1cj']

    console.log("bootstrapList", bootstrapList)
    // Connection gater
    config.connectionGater = {
        denyDialMultiaddr: () => false
    }

    // Peer discovery configuration
    config.peerDiscovery = [
        bootstrap({ list: bootstrapList }),
        pubsubPeerDiscovery({
            interval: 10000,
            topics: pubsubPeerDiscoveryTopics,
            listenOnly: false
        })
    ]

    return config
} 