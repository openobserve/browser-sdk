# Product Requirements Document: Trace-ID Unification for Browser SDK

**Document Version:** 1.0
**Date:** 2026-01-12
**Author:** OpenObserve Team
**Status:** Draft

---

## 1. Executive Summary

### Problem Statement

OpenObserve's web application generates its own trace-ids for tracking search jobs, but the integrated browser-sdk either creates duplicate trace-ids or overrides OpenObserve's trace-ids, resulting in broken trace continuity and inability to correlate RUM (Real User Monitoring) data with application traces.

### Proposed Solution

Enhance the browser-sdk to detect and reuse existing W3C Trace Context headers (`traceparent`) instead of always generating new trace-ids, ensuring trace continuity across application boundaries while maintaining backward compatibility.

### Success Metrics

- Single unified trace-id used by both OpenObserve and browser-sdk
- Successful correlation of RUM data with application search traces
- Zero breaking changes for existing SDK users
- Compliance with W3C Trace Context specification

---

## 2. Background & Context

### Current Architecture

**OpenObserve Application (Consumer)**

- Generates trace-ids using UUID v7 for search job tracking
- Creates W3C-compliant `traceparent` headers: `00-{trace-id}-{span-id}-01`
- Uses trace-id as key for internal state management (request tracking, cancellation)
- File: `web/src/composables/useStreamingSearch.ts:254-255`

**Browser SDK (Interceptor)**

- Intercepts all fetch/XHR requests matching `allowedTracingUrls`
- Always generates new trace-ids (UUID v7) upon interception
- Supports multiple propagator types:
  - `"openobserve"`: Custom headers (`x-openobserve-trace-id`, etc.)
  - `"tracecontext"`: W3C standard (`traceparent`, `tracestate`)
  - `"b3"`, `"b3multi"`: Zipkin B3 format
- Files: `browser-sdk/packages/rum-core/src/domain/tracing/tracer.ts`

### The Problem in Detail

#### Scenario 1: PropagatorType = "openobserve"

```
Request Flow:
1. OpenObserve sets: traceparent: 00-abc123...-def456...-01
2. SDK intercepts and adds: x-openobserve-trace-id: xyz789...
3. Backend receives TWO different trace-ids
4. Cannot correlate RUM spans with application traces
```

#### Scenario 2: PropagatorType = "tracecontext"

```
Request Flow:
1. OpenObserve sets: traceparent: 00-abc123...-def456...-01
2. SDK intercepts and REPLACES: traceparent: 00-xyz789...-ghi012...-01
3. OpenObserve's internal tracking uses abc123...
4. Backend receives xyz789...
5. Trace-id mismatch breaks search job tracking
```

### Root Cause Analysis

**Location:** `browser-sdk/packages/rum-core/src/domain/tracing/tracer.ts:152-153`

```typescript
context.traceId = createTraceIdentifier() // Always creates NEW trace-id
context.spanId = createSpanIdentifier()
```

The SDK has no logic to:

- Check for existing trace context headers
- Parse existing `traceparent` values
- Reuse trace-ids from parent contexts
- Differentiate between "start new trace" vs "continue existing trace"

---

## 3. Goals & Non-Goals

### Goals

1. ✅ Enable browser-sdk to detect and reuse existing `traceparent` headers
2. ✅ Maintain trace continuity across OpenObserve application and SDK
3. ✅ Support proper parent-child span relationships in distributed traces
4. ✅ Remain backward compatible with existing SDK users
5. ✅ Comply with W3C Trace Context specification
6. ✅ Benefit all SDK consumers, not just OpenObserve

### Non-Goals

1. ❌ Modify OpenObserve's trace generation logic (maintain existing behavior)
2. ❌ Change SDK's public API surface
3. ❌ Support non-standard trace context formats beyond W3C/B3/OpenObserve
4. ❌ Implement distributed sampling decisions (out of scope)
5. ❌ Handle trace context propagation for non-HTTP protocols

---

## 4. User Stories

### As an OpenObserve Developer

```
GIVEN I generate a traceparent header for search requests
WHEN the browser-sdk intercepts my request
THEN the SDK should reuse my trace-id and create a child span
SO THAT I can correlate RUM data with my search job traces
```

### As a Browser SDK User

```
GIVEN my application already implements distributed tracing
WHEN I integrate browser-sdk for RUM monitoring
THEN the SDK should continue my existing traces
SO THAT I get unified observability across frontend and backend
```

### As a Backend Engineer

```
GIVEN I receive requests with trace context headers
WHEN I analyze distributed traces
THEN I should see continuous trace spans from browser → frontend → backend
SO THAT I can debug performance issues across the entire stack
```

---

## 5. Functional Requirements

### FR-1: Existing Traceparent Detection

**Priority:** P0 (Critical)

The SDK MUST check for existing `traceparent` headers before generating new trace-ids.

**Detection Sources (in order of precedence):**

1. `context.init.headers` (Headers object)
2. `context.init.headers` (Array of [key, value] tuples)
3. `context.init.headers` (Plain object)
4. `context.input` (Request object)

**Acceptance Criteria:**

- SDK detects `traceparent` in all supported header formats
- Header name matching is case-insensitive per HTTP standards
- Detection occurs before new trace-id generation

---

### FR-2: Traceparent Parsing

**Priority:** P0 (Critical)

The SDK MUST correctly parse W3C Trace Context `traceparent` values.

**Format:** `{version}-{trace-id}-{parent-id}-{flags}`

- `version`: 2-digit hex (currently `00`)
- `trace-id`: 32-digit hex (128 bits)
- `parent-id`: 16-digit hex (64 bits)
- `flags`: 2-digit hex (8 bits, LSB indicates sampling decision)

**Validation Rules:**

- Must have exactly 4 dash-separated components
- Version must be `00` (only supported version)
- trace-id must not be all zeros
- parent-id must not be all zeros

**Acceptance Criteria:**

- Valid traceparent values are parsed successfully
- Invalid formats are rejected (return null)
- Sampling flag is correctly extracted from flags byte

**Reference:** https://www.w3.org/TR/trace-context/#traceparent-header

---

### FR-3: Trace-ID Reuse Logic

**Priority:** P0 (Critical)

When an existing traceparent is detected and valid, the SDK MUST:

1. Reuse the existing trace-id
2. Generate a NEW span-id (create child span)
3. Preserve the sampling decision from parent
4. Update the traceparent header with new span-id

**Decision Tree:**

```
if (existingTraceparent detected) {
  if (valid) {
    traceId = existingTraceparent.traceId        // REUSE
    spanId = createSpanIdentifier()               // NEW
    sampled = existingTraceparent.sampled         // PRESERVE
    → Continue existing trace
  } else {
    → Fall through to new trace generation
  }
} else {
  traceId = createTraceIdentifier()               // NEW
  spanId = createSpanIdentifier()                 // NEW
  sampled = isSampled(...)                        // COMPUTE
  → Start new trace
}
```

**Acceptance Criteria:**

- Existing trace-id is reused byte-for-byte (no transformation)
- New span-id is cryptographically random (63 bits)
- Sampling decision follows parent's decision
- All propagator types receive consistent trace context

---

### FR-4: Multi-Propagator Support

**Priority:** P0 (Critical)

When reusing trace-id, the SDK MUST inject headers for ALL configured propagator types.

**Example:**

```javascript
// Input: propagatorTypes: ["tracecontext", "openobserve"]
// Existing: traceparent: 00-abc123...-def456...-01

// Output headers:
{
  "traceparent": "00-abc123...-NEW_SPAN...-01",     // Reused trace-id
  "tracestate": "oo=s:1;o:rum",
  "x-openobserve-trace-id": "abc123...",            // Same trace-id
  "x-openobserve-span-id": "NEW_SPAN...",
  "x-openobserve-sampled": "1"
}
```

**Acceptance Criteria:**

- All propagator types use the same trace-id
- Each propagator format is correctly updated
- No duplicate or conflicting headers

---

### FR-5: Backward Compatibility

**Priority:** P0 (Critical)

The SDK MUST maintain existing behavior when no traceparent is present.

**Acceptance Criteria:**

- Requests without existing traceparent work identically to current SDK
- Sampling rates are respected for new traces
- All existing tests pass without modification
- No breaking changes to public API

---

### FR-6: Span Hierarchy

**Priority:** P1 (High)

The SDK SHOULD establish proper parent-child span relationships.

**Span Attributes:**

- Parent span: OpenObserve application (span-id from traceparent)
- Child span: Browser SDK (new span-id generated)
- Relationship: SDK span is child of application span in same trace

**Acceptance Criteria:**

- Backend tracing systems recognize span hierarchy
- Flame graphs show correct nesting
- Trace visualization tools render relationships correctly

---

## 6. Technical Design

### 6.1 Modified Function: `injectHeadersIfTracingAllowed`

**File:** `browser-sdk/packages/rum-core/src/domain/tracing/tracer.ts`

**Changes:**

```typescript
function injectHeadersIfTracingAllowed(
  configuration: RumConfiguration,
  context: Partial<RumFetchStartContext | RumXhrStartContext>,
  sessionManager: RumSessionManager,
  userContext: ContextManager,
  accountContext: ContextManager,
  inject: (tracingHeaders: TracingHeaders) => void
) {
  const session = sessionManager.findTrackedSession()
  if (!session) {
    return
  }

  const tracingOption = configuration.allowedTracingUrls.find((tracingOption) =>
    matchList([tracingOption.match], context.url!, true)
  )
  if (!tracingOption) {
    return
  }

  // ============ NEW LOGIC START ============
  // Check for existing traceparent and reuse if valid
  const existingTraceparent = extractExistingTraceparent(context)

  if (existingTraceparent) {
    // Continue existing trace with new span
    context.traceId = existingTraceparent.traceId
    context.spanId = createSpanIdentifier()
    context.traceSampled = existingTraceparent.sampled

    inject(
      makeTracingHeaders(
        context.traceId,
        context.spanId,
        context.traceSampled,
        session.id,
        tracingOption.propagatorTypes,
        userContext,
        accountContext,
        configuration
      )
    )
    return
  }
  // ============ NEW LOGIC END ============

  // Original logic: Start new trace
  const traceSampled = isSampled(session.id, configuration.traceSampleRate)
  const shouldInjectHeaders = traceSampled || configuration.traceContextInjection === TraceContextInjection.ALL

  if (!shouldInjectHeaders) {
    return
  }

  context.traceSampled = traceSampled
  context.traceId = createTraceIdentifier()
  context.spanId = createSpanIdentifier()

  inject(
    makeTracingHeaders(
      context.traceId,
      context.spanId,
      context.traceSampled,
      session.id,
      tracingOption.propagatorTypes,
      userContext,
      accountContext,
      configuration
    )
  )
}
```

---

### 6.2 New Function: `extractExistingTraceparent`

**File:** `browser-sdk/packages/rum-core/src/domain/tracing/tracer.ts`

```typescript
/**
 * Extracts and validates existing traceparent header from request context.
 *
 * Supports multiple header formats:
 * - Headers object (fetch API)
 * - Array of tuples (fetch API)
 * - Plain object (fetch API)
 * - Request object
 *
 * @param context - Request context from fetch/XHR interception
 * @returns Parsed trace context or null if not found/invalid
 */
function extractExistingTraceparent(
  context: Partial<RumFetchStartContext | RumXhrStartContext>
): { traceId: TraceIdentifier; sampled: boolean } | null {
  let traceparentValue: string | null = null

  // Check context.init.headers (various formats)
  if (context.init?.headers) {
    if (context.init.headers instanceof Headers) {
      traceparentValue = context.init.headers.get('traceparent')
    } else if (Array.isArray(context.init.headers)) {
      const traceparentHeader = context.init.headers.find(([key]) => key.toLowerCase() === 'traceparent')
      traceparentValue = traceparentHeader?.[1] || null
    } else if (typeof context.init.headers === 'object') {
      // Check both lowercase and original case
      const headers = context.init.headers as Record<string, string>
      traceparentValue = headers['traceparent'] || headers['Traceparent'] || null
    }
  }

  // Check Request object headers
  if (!traceparentValue && context.input instanceof Request) {
    traceparentValue = context.input.headers.get('traceparent')
  }

  if (!traceparentValue) {
    return null
  }

  return parseTraceparent(traceparentValue)
}
```

---

### 6.3 New Function: `parseTraceparent`

**File:** `browser-sdk/packages/rum-core/src/domain/tracing/tracer.ts`

```typescript
/**
 * Parses W3C Trace Context traceparent header value.
 *
 * Format: {version}-{trace-id}-{parent-id}-{flags}
 * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 *
 * @param traceparentValue - Raw traceparent header value
 * @returns Parsed trace context or null if invalid
 *
 * @see https://www.w3.org/TR/trace-context/#traceparent-header
 */
function parseTraceparent(traceparentValue: string): { traceId: TraceIdentifier; sampled: boolean } | null {
  const parts = traceparentValue.trim().split('-')

  // Validate format: exactly 4 parts
  if (parts.length !== 4) {
    return null
  }

  const [version, traceIdHex, parentIdHex, flags] = parts

  // Validate version (only 00 supported)
  if (version !== '00') {
    return null
  }

  // Validate trace-id: 32 hex chars, not all zeros
  if (!/^[0-9a-f]{32}$/i.test(traceIdHex) || traceIdHex === '00000000000000000000000000000000') {
    return null
  }

  // Validate parent-id: 16 hex chars, not all zeros
  if (!/^[0-9a-f]{16}$/i.test(parentIdHex) || parentIdHex === '0000000000000000') {
    return null
  }

  // Validate flags: 2 hex chars
  if (!/^[0-9a-f]{2}$/i.test(flags)) {
    return null
  }

  // Extract sampling decision from flags (LSB)
  const sampled = flags.endsWith('1')

  // Create TraceIdentifier from parsed hex string
  const traceId = createTraceIdentifierFromHex(traceIdHex.toLowerCase())

  return { traceId, sampled }
}
```

---

### 6.4 New Function: `createTraceIdentifierFromHex`

**File:** `browser-sdk/packages/rum-core/src/domain/tracing/identifier.ts`

```typescript
/**
 * Creates a TraceIdentifier from an existing 128-bit hex string.
 * Used when reusing trace-ids from parent contexts.
 *
 * @param hexString - 32-character hexadecimal string (128 bits)
 * @returns TraceIdentifier with toString method
 */
export function createTraceIdentifierFromHex(hexString: string): TraceIdentifier {
  if (!/^[0-9a-f]{32}$/.test(hexString)) {
    throw new Error(`Invalid trace-id hex string: ${hexString}`)
  }

  return {
    toString(radix = 10) {
      if (radix === 16) {
        return hexString
      }
      // Convert hex string to decimal or other radix
      const value = BigInt('0x' + hexString)
      return value.toString(radix)
    },
    __brand: 'traceIdentifier' as const,
  } as TraceIdentifier
}
```

---

### 6.5 Type Additions

**File:** `browser-sdk/packages/rum-core/src/domain/tracing/tracer.types.ts`

```typescript
/**
 * Parsed trace context from existing traceparent header
 */
export interface ExistingTraceContext {
  traceId: TraceIdentifier
  parentSpanId: string // Original span-id from traceparent
  sampled: boolean
  version: string // Always '00' for now
}
```

---

## 7. Testing Requirements

### 7.1 Unit Tests

**File:** `browser-sdk/packages/rum-core/src/domain/tracing/tracer.spec.ts`

#### Test Suite: `extractExistingTraceparent`

```typescript
describe('extractExistingTraceparent', () => {
  it('should extract traceparent from Headers object', () => {
    const context = {
      init: {
        headers: new Headers({
          traceparent: '00-abc123-def456-01',
        }),
      },
    }
    const result = extractExistingTraceparent(context)
    expect(result).not.toBeNull()
    expect(result.traceId.toString(16)).toBe('abc123...')
  })

  it('should extract traceparent from array headers', () => {
    const context = {
      init: {
        headers: [['traceparent', '00-abc123-def456-01']],
      },
    }
    const result = extractExistingTraceparent(context)
    expect(result).not.toBeNull()
  })

  it('should extract traceparent from plain object headers', () => {
    const context = {
      init: {
        headers: { traceparent: '00-abc123-def456-01' },
      },
    }
    const result = extractExistingTraceparent(context)
    expect(result).not.toBeNull()
  })

  it('should extract traceparent from Request object', () => {
    const request = new Request('https://example.com', {
      headers: { traceparent: '00-abc123-def456-01' },
    })
    const context = { input: request }
    const result = extractExistingTraceparent(context)
    expect(result).not.toBeNull()
  })

  it('should be case-insensitive for header name', () => {
    const context = {
      init: {
        headers: { Traceparent: '00-abc123-def456-01' },
      },
    }
    const result = extractExistingTraceparent(context)
    expect(result).not.toBeNull()
  })

  it('should return null when no traceparent exists', () => {
    const context = { init: { headers: {} } }
    const result = extractExistingTraceparent(context)
    expect(result).toBeNull()
  })
})
```

#### Test Suite: `parseTraceparent`

```typescript
describe('parseTraceparent', () => {
  it('should parse valid traceparent with sampled flag', () => {
    const result = parseTraceparent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01')
    expect(result).not.toBeNull()
    expect(result.traceId.toString(16)).toBe('0af7651916cd43dd8448eb211c80319c')
    expect(result.sampled).toBe(true)
  })

  it('should parse valid traceparent without sampled flag', () => {
    const result = parseTraceparent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00')
    expect(result).not.toBeNull()
    expect(result.sampled).toBe(false)
  })

  it('should reject invalid version', () => {
    const result = parseTraceparent('01-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01')
    expect(result).toBeNull()
  })

  it('should reject all-zero trace-id', () => {
    const result = parseTraceparent('00-00000000000000000000000000000000-b7ad6b7169203331-01')
    expect(result).toBeNull()
  })

  it('should reject all-zero parent-id', () => {
    const result = parseTraceparent('00-0af7651916cd43dd8448eb211c80319c-0000000000000000-01')
    expect(result).toBeNull()
  })

  it('should reject wrong number of parts', () => {
    expect(parseTraceparent('00-abc123-def456')).toBeNull()
    expect(parseTraceparent('00-abc-def-01-extra')).toBeNull()
  })

  it('should reject non-hex characters', () => {
    const result = parseTraceparent('00-0af7651916cd43dd8448eb211c80319Z-b7ad6b7169203331-01')
    expect(result).toBeNull()
  })

  it('should handle uppercase hex', () => {
    const result = parseTraceparent('00-0AF7651916CD43DD8448EB211C80319C-B7AD6B7169203331-01')
    expect(result).not.toBeNull()
    expect(result.traceId.toString(16)).toBe('0af7651916cd43dd8448eb211c80319c')
  })
})
```

#### Test Suite: Integration

```typescript
describe('tracer with existing traceparent', () => {
  it('should reuse trace-id from existing traceparent', () => {
    const context = {
      url: 'https://api.example.com/search',
      init: {
        headers: {
          traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        },
      },
    }

    tracer.traceFetch(context)

    // Should reuse trace-id
    expect(context.traceId.toString(16)).toBe('0af7651916cd43dd8448eb211c80319c')

    // Should generate new span-id
    expect(context.spanId.toString(16)).not.toBe('b7ad6b7169203331')

    // Should preserve sampling decision
    expect(context.traceSampled).toBe(true)
  })

  it('should inject reused trace-id in all propagator types', () => {
    const context = {
      url: 'https://api.example.com/search',
      init: {
        headers: {
          traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        },
      },
    }

    // Configure multiple propagators
    configuration.allowedTracingUrls = [
      {
        match: 'https://api.example.com',
        propagatorTypes: ['tracecontext', 'openobserve'],
      },
    ]

    tracer.traceFetch(context)

    const headers = getInjectedHeaders(context)

    // Check traceparent (W3C)
    expect(headers['traceparent']).toMatch(/^00-0af7651916cd43dd8448eb211c80319c-[0-9a-f]{16}-01$/)

    // Check openobserve headers
    expect(headers['x-openobserve-trace-id']).toBe('0af7651916cd43dd8448eb211c80319c')
    expect(headers['x-openobserve-sampled']).toBe('1')
  })

  it('should generate new trace-id when no traceparent exists', () => {
    const context = {
      url: 'https://api.example.com/search',
      init: { headers: {} },
    }

    tracer.traceFetch(context)

    // Should generate new trace-id
    expect(context.traceId).toBeDefined()
    expect(context.traceId.toString(16)).toHaveLength(32)
  })

  it('should maintain backward compatibility for requests without traceparent', () => {
    const context = {
      url: 'https://api.example.com/search',
      init: {},
    }

    tracer.traceFetch(context)

    // Original behavior: new trace, respects sampling
    expect(context.traceId).toBeDefined()
    expect(context.spanId).toBeDefined()
    expect(typeof context.traceSampled).toBe('boolean')
  })
})
```

---

### 7.2 Integration Tests

**File:** `browser-sdk/test/e2e/scenario/rum/tracing.scenario.ts`

```typescript
describe('Distributed Tracing Integration', () => {
  it('should continue trace from application-generated traceparent', async () => {
    // Simulate application setting traceparent
    const appTraceId = '0af7651916cd43dd8448eb211c80319c'
    const appSpanId = 'b7ad6b7169203331'

    await fetch('https://api.example.com/search', {
      headers: {
        traceparent: `00-${appTraceId}-${appSpanId}-01`,
      },
    })

    // Verify SDK reused trace-id
    const rumEvents = await getRumEvents()
    const resourceEvent = rumEvents.find((e) => e.type === 'resource')

    expect(resourceEvent.context.traceId).toBe(appTraceId)
    expect(resourceEvent.context.spanId).not.toBe(appSpanId) // New span
  })

  it('should work with XHR in addition to fetch', () => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'https://api.example.com/search')
    xhr.setRequestHeader('traceparent', '00-0af765...-b7ad6b...-01')
    xhr.send()

    // Verify SDK handled XHR correctly
    // ... assertions
  })
})
```

---

### 7.3 Manual Testing Checklist

- [ ] Test with OpenObserve's search streaming API
- [ ] Test with PropagatorType: "tracecontext"
- [ ] Test with PropagatorType: "openobserve"
- [ ] Test with multiple propagatorTypes
- [ ] Test with existing traceparent (valid)
- [ ] Test with invalid traceparent (should fall back to new trace)
- [ ] Test without traceparent (backward compatibility)
- [ ] Verify trace continuity in backend tracing UI (Jaeger/Tempo)
- [ ] Verify RUM events contain correct trace/span IDs
- [ ] Test request cancellation with reused trace-ids
- [ ] Test concurrent requests with different trace-ids
- [ ] Performance: Measure overhead of traceparent parsing

---

## 8. Migration & Rollout Plan

### Phase 1: SDK Development (Week 1)

- [ ] Implement `extractExistingTraceparent` function
- [ ] Implement `parseTraceparent` function
- [ ] Implement `createTraceIdentifierFromHex` function
- [ ] Modify `injectHeadersIfTracingAllowed` function
- [ ] Write unit tests (target: 100% coverage for new code)
- [ ] Write integration tests
- [ ] Code review and approval

### Phase 2: SDK Testing (Week 1-2)

- [ ] Run existing test suite (ensure no regressions)
- [ ] Run new test suite
- [ ] Manual testing with OpenObserve application
- [ ] Performance benchmarking
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

### Phase 3: SDK Release (Week 2)

- [ ] Update CHANGELOG.md with new feature
- [ ] Update SDK documentation
- [ ] Publish beta version: `0.3.3-beta.0`
- [ ] Update npm package
- [ ] Tag GitHub release

### Phase 4: OpenObserve Integration (Week 2-3)

- [ ] Update OpenObserve's package.json to use new SDK version
- [ ] Test with PropagatorType: "tracecontext"
- [ ] Verify trace continuity in OpenObserve backend
- [ ] Update OpenObserve documentation
- [ ] Deploy to staging environment

### Phase 5: Production Rollout (Week 3)

- [ ] Monitor RUM metrics for anomalies
- [ ] Verify trace correlation in production
- [ ] Gradual rollout: 10% → 50% → 100%
- [ ] Publish stable SDK version: `0.3.3`

### Rollback Plan

- Keep previous SDK version (`0.3.2-beta.1`) available
- If issues detected:
  1. Revert OpenObserve to previous SDK version
  2. Use Solution 2 (exclude search endpoints) as temporary workaround
  3. Debug and fix SDK issues
  4. Retry rollout

---

## 9. Success Criteria

### Functional Success

- ✅ Single trace-id flows through OpenObserve → SDK → Backend
- ✅ Search job tracking works correctly with reused trace-ids
- ✅ RUM spans appear as children of application spans in trace visualizations
- ✅ All unit tests pass (100% coverage for new code)
- ✅ All integration tests pass
- ✅ No regressions in existing SDK functionality

### Performance Success

- ✅ Traceparent parsing adds < 1ms overhead per request
- ✅ No measurable impact on SDK initialization time
- ✅ No increase in memory consumption

### User Experience Success

- ✅ Zero breaking changes for existing SDK users
- ✅ No configuration changes required for basic use case
- ✅ Clear documentation and examples

### Business Success

- ✅ Improved observability for OpenObserve search operations
- ✅ Better debugging experience for performance issues
- ✅ Competitive advantage: full-stack distributed tracing

---

## 10. Documentation Updates

### SDK Documentation

**New Section:** Continuing Existing Traces

````markdown
## Continuing Existing Traces

The browser-sdk automatically detects and continues existing W3C Trace Context traces. If your application already sets a `traceparent` header, the SDK will reuse the trace-id and create a child span.

### Example

```javascript
// Your application code
const traceId = generateTraceId()
const spanId = generateSpanId()

fetch('/api/search', {
  headers: {
    traceparent: `00-${traceId}-${spanId}-01`,
  },
})

// Browser SDK automatically:
// 1. Detects existing traceparent
// 2. Reuses traceId
// 3. Generates new spanId (child span)
// 4. Updates traceparent header
```
````

This enables seamless correlation between your application traces and RUM data.

### Supported Formats

The SDK detects `traceparent` headers in:

- W3C Trace Context format (recommended)
- Headers object, array, or plain object
- Request objects

### Validation

Invalid `traceparent` values are ignored, and the SDK falls back to generating a new trace.

````

### OpenObserve Documentation

**Updated Section:** Browser RUM Configuration

```markdown
## Trace Correlation

OpenObserve's search requests automatically generate trace-ids for job tracking. With browser-sdk v0.3.3+, these trace-ids are preserved and enhanced with RUM data.

### Configuration

```javascript
openobserveRum.init({
  allowedTracingUrls: [
    {
      match: "https://your-domain.com/",
      propagatorTypes: ["tracecontext"]  // Use W3C standard
    }
  ]
})
````

### Benefits

- Correlate search performance with RUM metrics
- Debug slow searches with full distributed traces
- Track requests from browser → frontend → backend

### Verification

Check your backend tracing UI (e.g., Jaeger) to see:

- Single trace spanning browser and backend
- OpenObserve search spans as parents
- RUM resource spans as children

```

---

## 11. Open Questions & Risks

### Open Questions

**Q1:** Should we support trace context propagation for non-HTTP protocols (WebSocket, WebRTC)?
- **Decision:** Out of scope for v1, revisit in future release

**Q2:** Should we expose a configuration option to disable trace-id reuse?
- **Decision:** No. Always reuse is the correct behavior per W3C spec.

**Q3:** How do we handle `tracestate` header from existing traces?
- **Decision:** Preserve and append SDK's tracestate values

**Q4:** Should we validate that reused trace-id is from same session?
- **Decision:** No. Trust the application's trace context.

### Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes for edge cases | Low | Medium | Comprehensive test suite, beta release |
| Performance regression | Low | High | Benchmarking, profiling before release |
| W3C spec non-compliance | Low | Medium | Thorough spec review, validation tests |
| Backend systems reject reused trace-ids | Medium | High | Test with OpenObserve backend early, document requirements |
| Trace-id collision (UUID v4 vs v7) | Very Low | Low | Both use 128-bit space, collision unlikely |

---

## 12. Future Enhancements

### Post-V1 Improvements

1. **B3 Traceparent Detection** (v0.3.4)
   - Support reusing B3 format trace contexts
   - Handle both single-header and multi-header B3

2. **Custom Propagator Detection** (v0.4.0)
   - Support detecting OpenObserve custom headers
   - Plugin architecture for custom propagators

3. **Trace Context Mutation Callbacks** (v0.4.0)
   - Allow applications to modify trace context before injection
   - Use case: Add custom baggage items

4. **Sampling Decision Override** (v0.5.0)
   - Allow SDK to change sampling decision based on local factors
   - Requires distributed sampling delegation protocol

5. **WebSocket Trace Propagation** (v0.5.0)
   - Extend trace context to WebSocket connections
   - Handle long-lived connection scenarios

---

## 13. Appendices

### Appendix A: W3C Trace Context Specification

**Reference:** https://www.w3.org/TR/trace-context/

**Key Points:**
- Version `00` is the only currently defined version
- trace-id MUST be 16 bytes (32 hex chars)
- span-id MUST be 8 bytes (16 hex chars)
- Flags: 8 bits, only LSB defined (sampled)
- Header name is case-insensitive
- trace-id and span-id MUST NOT be all zeros

### Appendix B: Code References

**OpenObserve Files:**
- `web/src/composables/useStreamingSearch.ts` (lines 254-255, 262)
- `web/src/utils/zincutils.ts` (lines 780-786, 860-867)
- `web/src/main.ts` (lines 97-99)

**Browser SDK Files:**
- `packages/rum-core/src/domain/tracing/tracer.ts` (lines 124-167)
- `packages/rum-core/src/domain/tracing/tracer.types.ts` (lines 1-11)
- `packages/rum-core/src/domain/tracing/identifier.ts` (lines 17-43)

### Appendix C: Glossary

- **Trace-ID:** 128-bit identifier for a distributed trace
- **Span-ID:** 64-bit identifier for a segment of work within a trace
- **Traceparent:** W3C standard header for propagating trace context
- **Propagator:** Mechanism for injecting trace context headers
- **Sampling:** Decision whether to record detailed trace data
- **RUM:** Real User Monitoring
- **UUID v4:** Random UUID (used by OpenObserve)
- **UUID v7:** Time-ordered UUID (used by SDK)
- **W3C:** World Wide Web Consortium
- **B3:** Zipkin's trace context format

---

## 14. Approval & Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Manager | | | |
| Tech Lead - SDK | | | |
| Tech Lead - OpenObserve | | | |
| QA Lead | | | |
| DevOps Lead | | | |

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-12 | OpenObserve Team | Initial draft |

---

**End of Document**
```
