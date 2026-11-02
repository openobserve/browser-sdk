import {
  createSpanIdentifier,
  createSpanIdentifierFromHex,
  createTraceIdentifier,
  createTraceIdentifierFromHex,
  toPaddedHexadecimalString,
  toPaddedSpanIdHex,
  toPaddedTraceIdHex,
} from './identifier'

describe('identifier', () => {
  describe('TraceIdentifier', () => {
    it('generates a UUIDv7-shaped 128-bit id (version 7, variant 0b10)', () => {
      const hex = toPaddedTraceIdHex(createTraceIdentifier())
      expect(hex).toMatch(/^[0-9a-f]{32}$/)
      // nibble 13 is the UUID version
      expect(hex[12]).toEqual('7')
      // nibble 17's top two bits are the variant 0b10
      expect(['8', '9', 'a', 'b']).toContain(hex[16])
    })

    it('embeds the current timestamp in the top 48 bits', () => {
      const before = Date.now()
      const hex = toPaddedTraceIdHex(createTraceIdentifier())
      const after = Date.now()
      const embedded = parseInt(hex.slice(0, 12), 16)
      expect(embedded).toBeGreaterThanOrEqual(before)
      expect(embedded).toBeLessThanOrEqual(after)
    })
  })

  describe('SpanIdentifier', () => {
    it('generates a max value of 63 bits', () => {
      mockRandomValues((buffer) => buffer.fill(0xff))
      const identifier = createSpanIdentifier()
      expect(identifier.toString(16)).toEqual('7fffffffffffffff')
    })
  })
})

describe('fixed-width hex serialization', () => {
  // BigInt toString(16) drops leading zeros; UUIDv7 trace ids always start with a zero
  // nibble, so unpadded serialization is one char short on effectively every id — the
  // regression that broke RUM↔trace correlation in 0.4.0-beta.7..0.4.2-beta.2.
  it('pads a UUIDv7 trace id to 32 chars', () => {
    const id = createTraceIdentifierFromHex('01a034c1aabc72f78880daf6c9755cff')
    expect(id.toString(16).length).toEqual(31) // the raw form IS short...
    expect(toPaddedTraceIdHex(id)).toEqual('01a034c1aabc72f78880daf6c9755cff')
  })

  it('pads a freshly generated trace id to 32 chars', () => {
    expect(toPaddedTraceIdHex(createTraceIdentifier()).length).toEqual(32)
  })

  it('pads a 64-bit-style trace id (zero upper half) to 32 chars', () => {
    // e.g. reused from the traceparent of a system using 64-bit ids — the
    // width-guessing toPaddedHexadecimalString gets this one wrong.
    const id = createTraceIdentifierFromHex('00000000000000001234567890abcdef')
    expect(toPaddedTraceIdHex(id)).toEqual('00000000000000001234567890abcdef')
  })

  it('pads a span id with leading zeros to 16 chars', () => {
    expect(toPaddedSpanIdHex(createSpanIdentifierFromHex('0123456789abcdef'))).toEqual(
      '0123456789abcdef'
    )
  })

  it('pads a freshly generated span id to 16 chars', () => {
    mockRandomValues((buffer) => (buffer[0] = 0x01))
    expect(toPaddedSpanIdHex(createSpanIdentifier())).toEqual('0000000000000001')
  })
})

describe('toPaddedHexadecimalString', () => {
  it('should pad the string to 16 characters', () => {
    mockRandomValues((buffer) => (buffer[0] = 0x01))
    const identifier = createSpanIdentifier()
    expect(toPaddedHexadecimalString(identifier)).toEqual('0000000000000001')
  })
})

function mockRandomValues(cb: (buffer: Uint8Array) => void) {
  spyOn(window.crypto, 'getRandomValues').and.callFake((bufferView) => {
    cb(new Uint8Array(bufferView.buffer))
    return bufferView
  })
}
