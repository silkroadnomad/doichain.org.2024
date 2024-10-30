import { nameOps } from '$lib/doichain/doichain-store.js'
import { decodeMessage } from 'protons-runtime'
import { peerCodec } from '$lib/codecs/peer-codec.js'
import { multiaddr } from '@multiformats/multiaddr'

const CONTENT_TOPIC = '/doichain-nfc/1/message/proto'

export function handlePubsubMessage(event, libp2p) {
    console.log(`Received pubsub message from ${event.detail.from} on topic ${event.detail.topic}`)

    if (event.detail.topic === 'doichain._peer-discovery._p2p._pubsub') {
        handlePeerDiscoveryMessage(event, libp2p)
    } else if (event.detail.topic === CONTENT_TOPIC) {
        handleContentMessage(event, libp2p)
    }
}

function handlePeerDiscoveryMessage(event, libp2p) {
    try {
        const peer = decodeMessage(event.detail.data, peerCodec)
        const publicKeyHex = Buffer.from(peer.publicKey).toString('hex')
        
        const formattedAddrs = peer.addrs.map(addr => {
            try {
                libp2p.dial(multiaddr(addr))
                return multiaddr(addr).toString()
            } catch (err) {
                return `<invalid multiaddr: ${Buffer.from(addr).toString('hex')}>`
            }
        })

        // console.info('  Addresses:')
        // formattedAddrs.forEach((addr, index) => {
        //     console.info(`    ${index + 1}. ${addr}`)
        // })
    } catch(err) {
        console.error('Error processing peer discovery message:', err)
    }
}

function handleContentMessage(event, libp2p) {
    const message = new TextDecoder().decode(event.detail.data)
    
    if(message.startsWith('ADDING-CID') || message.startsWith('ADDED-CID') || 
       message.startsWith('PINNING-CID') || message.startsWith('PINNED-CID')) {
        console.log("ignoring cid messages for now", message)
    } 
    else if (message === 'LIST_LAST_100') {
        handleList100Request(libp2p)
    }
    else if (message.startsWith('LIST_DATE:') || 
             message.startsWith('LIST_ALL') || 
             message.endsWith(':NONE')) {
        console.log("ignoring other list messages for now", message)
    }
    else {
        handleNameOpsMessage(message)
    }
}

function handleList100Request(libp2p) {
    console.log("Received request for LIST_LAST_100")
    if (nameOps.length > 0) {
        const lastNameOps = nameOps.slice(0, 100)
        console.log(`Publishing last ${lastNameOps.length} NameOps`, lastNameOps)
        const jsonString = JSON.stringify(lastNameOps)
        libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode(jsonString))
    } else {
        console.log("No NameOps found")
        libp2p.services.pubsub.publish(CONTENT_TOPIC, new TextEncoder().encode("LAST_100_CIDS:NONE"))
    }
}

function handleNameOpsMessage(message) {
    nameOps.update(currentOps => {
        try {
            const jsonMessage = JSON.parse(message)
            const newNameOps = jsonMessage.filter(newOp => {
                return !currentOps.some(existingOp => 
                    existingOp.currentNameUtxo?.txid === newOp.currentNameUtxo?.txid
                )
            })

            if (newNameOps.length > 0) {
                const updatedOps = [...currentOps, ...newNameOps].sort((a, b) => {
                    const timeA = a.blocktime || 0
                    const timeB = b.blocktime || 0
                    return timeB - timeA
                })
                console.log(`Added ${newNameOps.length} new unique nameOps. Total nameOps after update:`, updatedOps.length)
                return updatedOps
            }
            console.log("No new unique nameOps to add.")
            return currentOps
        } catch (e) {
            console.log("message", message)
            console.error('Failed to parse message:', e)
            return currentOps
        }
    })
} 