export const peerCodec = {
  encode: () => {
    throw new Error('Encoding not implemented')
  },
  decode: (reader) => {
    const obj = {
      publicKey: new Uint8Array(0),
      addrs: []
    }

    while (reader.pos < reader.len) {
      const tag = reader.uint32()

      switch (tag >>> 3) {
        case 1:
          obj.publicKey = reader.bytes()
          break
        case 2:
          obj.addrs.push(reader.bytes())
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }

    return obj
  }
} 