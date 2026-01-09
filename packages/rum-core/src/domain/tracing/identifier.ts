import { v7 as uuidv7 } from 'uuid'

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

export function createTraceIdentifier() {
  // UUID v7 generates a 128-bit identifier with timestamp-based ordering
  const uuid = uuidv7()
  // Remove hyphens to get a 32-character hex string (128 bits)
  const hex = uuid.replace(/-/g, '')

  return {
    toString(radix = 10) {
      if (radix === 16) {
        return hex
      }
      // For other radixes, convert from hex
      let result = ''
      let value = BigInt('0x' + hex)
      if (value === BigInt(0)) return '0'

      const radixBigInt = BigInt(radix)
      while (value > BigInt(0)) {
        const remainder = value % radixBigInt
        result = remainder.toString(radix) + result
        value = value / radixBigInt
      }
      return result
    },
    __brand: 'traceIdentifier' as const,
  } as TraceIdentifier
}

export function createSpanIdentifier() {
  return createIdentifier(63) as SpanIdentifier
}

function createIdentifier(bits: 63 | 64): BaseIdentifier {
  const buffer = crypto.getRandomValues(new Uint32Array(2))
  if (bits === 63) {
    // eslint-disable-next-line no-bitwise
    buffer[buffer.length - 1] >>>= 1 // force 63-bit
  }

  // The `.toString` function is intentionally similar to Number and BigInt `.toString` method.
  //
  // JavaScript numbers can represent integers up to 48 bits, this is why we need two of them to
  // represent a 64 bits identifier. But BigInts don't have this limitation and can represent larger
  // integer values.
  //
  // In the future, when we drop browsers without BigInts support, we could use BigInts directly
  // represent identifiers by simply returning a BigInt from this function (as all we need is a
  // value with a `.toString` method).
  //
  // Examples:
  //   const buffer = getCrypto().getRandomValues(new Uint32Array(2))
  //   return BigInt(buffer[0]) + BigInt(buffer[1]) << 32n
  //
  //   // Alternative with BigUint64Array (different Browser support than plain bigints!):
  //   return crypto.getRandomValues(new BigUint64Array(1))[0]
  //
  // For now, let's keep using two plain numbers as having two different implementations (one for
  // browsers with BigInt support and one for older browsers) don't bring much value.
  return {
    toString(radix = 10) {
      let high = buffer[1]
      let low = buffer[0]
      let str = ''

      do {
        const mod = (high % radix) * 4294967296 + low
        high = Math.floor(high / radix)
        low = Math.floor(mod / radix)
        str = (mod % radix).toString(radix) + str
      } while (high || low)

      return str
    },
  }
}

export function toPaddedHexadecimalString(id: BaseIdentifier) {
  const hexString = id.toString(16)
  // UUID v7 trace IDs are 128 bits (32 hex chars), span IDs are 64 bits (16 hex chars)
  const targetLength = hexString.length > 16 ? 32 : 16
  return hexString.padStart(targetLength, '0')
}
