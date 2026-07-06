interface BaseIdentifier {
  toString(radix?: number): string
}

export interface TraceIdentifier extends BaseIdentifier {
  // We use a brand to distinguish between TraceIdentifier and SpanIdentifier, else TypeScript
  // considers them as the same type
  __brand: 'traceIdentifier'
}

export interface SpanIdentifier extends BaseIdentifier {
  __brand: 'spanIdentifier'
}

/**
 * OpenObserve: trace identifiers are 128-bit UUIDv7-shaped values (timestamp-ordered), so they
 * can be correlated with OpenObserve traces and stay unique across sessions. Span identifiers
 * remain 63-bit like upstream.
 */
export function createTraceIdentifier() {
  return createUuidV7Identifier() as TraceIdentifier
}

export function createSpanIdentifier() {
  return createIdentifier(63) as SpanIdentifier
}

/**
 * Creates a TraceIdentifier from a 32-character hex string (e.g. from an existing W3C
 * traceparent header).
 */
export function createTraceIdentifierFromHex(hexString: string): TraceIdentifier {
  return BigInt(`0x${hexString}`) as unknown as TraceIdentifier
}

/**
 * Creates a SpanIdentifier from a 16-character hex string (e.g. from an existing W3C
 * traceparent header).
 */
export function createSpanIdentifierFromHex(hexString: string): SpanIdentifier {
  return BigInt(`0x${hexString}`) as unknown as SpanIdentifier
}

function createIdentifier(bits: 63 | 64): BaseIdentifier {
  // TODO: when Safari 15 becomes the minimum, simplify to:
  //   crypto.getRandomValues(new BigUint64Array(1))[0]
  const buffer = crypto.getRandomValues(new Uint32Array(2))
  // eslint-disable-next-line no-bitwise
  let value = BigInt(buffer[0]) + (BigInt(buffer[1]) << 32n)
  if (bits === 63) {
    // eslint-disable-next-line no-bitwise
    value &= 0x7fffffffffffffffn // force 63-bit by clearing the top bit
  }
  return value
}

/**
 * Builds a 128-bit identifier following the UUIDv7 layout:
 * 48-bit unix timestamp (ms) | 4-bit version (7) | 12-bit random | 2-bit variant (0b10) | 62-bit random
 *
 * See https://www.rfc-editor.org/rfc/rfc9562#name-uuid-version-7
 */
function createUuidV7Identifier(): BaseIdentifier {
  const buffer = crypto.getRandomValues(new Uint32Array(3))
  const timestamp = BigInt(Date.now())
  /* eslint-disable no-bitwise */
  const randA = BigInt(buffer[0] & 0x0fff) // 12 bits
  const randB = (BigInt(buffer[1]) << 32n) | BigInt(buffer[2]) // 64 bits, truncated to 62 below
  return (
    (timestamp << 80n) | // unix_ts_ms
    (0x7n << 76n) | // version 7
    (randA << 64n) | // rand_a
    (0x2n << 62n) | // variant 0b10
    (randB & 0x3fffffffffffffffn) // rand_b
  )
  /* eslint-enable no-bitwise */
}

/**
 * Pads an identifier to its canonical hex length: 16 characters for 64-bit identifiers, 32
 * characters for 128-bit (trace) identifiers.
 */
export function toPaddedHexadecimalString(id: BaseIdentifier) {
  const hexString = id.toString(16)
  return hexString.padStart(hexString.length > 16 ? 32 : 16, '0')
}
