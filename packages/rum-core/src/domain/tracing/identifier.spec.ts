import { createSpanIdentifier, createTraceIdentifier, createTraceIdentifierFromHex, toPaddedHexadecimalString } from './identifier'

describe('identifier', () => {
  describe('TraceIdentifier', () => {
    it('generates a random id', () => {
      const identifier = createTraceIdentifier()
      expect(identifier.toString()).toMatch(/^\d+$/)
    })

    it('formats using base 16', () => {
      mockRandomValues((buffer) => (buffer[0] = 0xff))
      const identifier = createTraceIdentifier()
      expect(identifier.toString(16)).toEqual('ff')
    })

    it('should generate a max value of 64 bits', () => {
      mockRandomValues((buffer) => buffer.fill(0xff))
      const identifier = createTraceIdentifier()
      expect(identifier.toString(16)).toEqual('ffffffffffffffff')
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

describe('toPaddedHexadecimalString', () => {
  it('should pad the string to 16 characters', () => {
    mockRandomValues((buffer) => (buffer[0] = 0x01))
    const identifier = createTraceIdentifier()
    expect(toPaddedHexadecimalString(identifier)).toEqual('0000000000000001')
  })
})

describe('createTraceIdentifierFromHex', () => {
  it('should create a TraceIdentifier from a valid 32-character hex string', () => {
    const hexString = '0af7651916cd43dd8448eb211c80319c'
    const identifier = createTraceIdentifierFromHex(hexString)
    expect(identifier.toString(16)).toEqual('0af7651916cd43dd8448eb211c80319c')
  })

  it('should handle uppercase hex strings and normalize to lowercase', () => {
    const hexString = '0AF7651916CD43DD8448EB211C80319C'
    const identifier = createTraceIdentifierFromHex(hexString)
    expect(identifier.toString(16)).toEqual('0af7651916cd43dd8448eb211c80319c')
  })

  it('should support toString with different radixes', () => {
    const hexString = '0af7651916cd43dd8448eb211c80319c'
    const identifier = createTraceIdentifierFromHex(hexString)
    expect(identifier.toString(10)).toMatch(/^\d+$/)
    expect(identifier.toString(16)).toEqual('0af7651916cd43dd8448eb211c80319c')
  })

  it('should throw an error for invalid hex string (wrong length)', () => {
    expect(() => createTraceIdentifierFromHex('abc123')).toThrowError('Invalid trace-id hex string: abc123')
  })

  it('should throw an error for invalid hex string (non-hex characters)', () => {
    expect(() => createTraceIdentifierFromHex('0af7651916cd43dd8448eb211c80319g')).toThrowError(
      'Invalid trace-id hex string: 0af7651916cd43dd8448eb211c80319g'
    )
  })

  it('should throw an error for invalid hex string (too short)', () => {
    expect(() => createTraceIdentifierFromHex('0af7651916cd43dd')).toThrowError('Invalid trace-id hex string: 0af7651916cd43dd')
  })

  it('should throw an error for invalid hex string (too long)', () => {
    expect(() => createTraceIdentifierFromHex('0af7651916cd43dd8448eb211c80319caa')).toThrowError(
      'Invalid trace-id hex string: 0af7651916cd43dd8448eb211c80319caa'
    )
  })
})

function mockRandomValues(cb: (buffer: Uint8Array) => void) {
  spyOn(window.crypto, 'getRandomValues').and.callFake((bufferView) => {
    cb(new Uint8Array(bufferView.buffer))
    return bufferView
  })
}
