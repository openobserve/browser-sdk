import type { TimeStamp } from '@openobserve/browser-core'
import {
  createDocumentTraceData,
  findTraceComment,
  getDocumentTraceDataFromMeta,
  getDocumentTraceId,
  INITIAL_DOCUMENT_OUTDATED_TRACE_ID_THRESHOLD,
} from './getDocumentTraceId'

const HTML_DOCTYPE = '\n<!DOCTYPE html>\n'
const HTML_CONTENT = '\n<html><head></head><body></body></html>\n'

describe('getDocumentTraceId', () => {
  it('gets a trace id found from a document comment', () => {
    expect(
      getDocumentTraceId(
        createDocument(
          `<!-- OPENOBSERVE;trace-id=foo;trace-time=${Date.now()} -->
          ${HTML_DOCTYPE}
          <html>
            <head>
            </head>
            <body>
            </body>
          </html>`
        )
      )
    ).toEqual('foo')
  })

  it('gets a trace id found from meta tags', () => {
    expect(
      getDocumentTraceId(
        createDocument(
          `${HTML_DOCTYPE}
          <html>
            <head>
              <meta name="dd-trace-id" content="foo" />
              <meta name="dd-trace-time" content="${Date.now()}" />
            </head>
            <body>
            </body>
          </html>`
        )
      )
    ).toEqual('foo')
  })

  it('uses the meta strategy in priority', () => {
    expect(
      getDocumentTraceId(
        createDocument(
          `<!-- OPENOBSERVE;trace-id=comment;trace-time=${Date.now()} -->
          ${HTML_DOCTYPE}
          <html>
            <head>
              <meta name="dd-trace-id" content="meta" />
              <meta name="dd-trace-time" content="${Date.now()}" />
            </head>
            <body>
            </body>
          </html>`
        )
      )
    ).toEqual('meta')
  })

  it('returns undefined if nothing is present', () => {
    expect(getDocumentTraceId(createDocument(HTML_DOCTYPE + HTML_CONTENT))).toEqual(undefined)
  })

  it('ignores the trace id if it has been created too long ago', () => {
    expect(
      getDocumentTraceId(
        createDocument(`<!-- OPENOBSERVE;trace-id=foo;trace-time=${Date.now() - INITIAL_DOCUMENT_OUTDATED_TRACE_ID_THRESHOLD
          } -->
          ${HTML_DOCTYPE}
          <html>
            <head>
            </head>
            <body>
            </body>
          </html>`)
      )
    ).toBe(undefined)
  })
})

describe('getDocumentTraceDataFromMeta', () => {
  it('gets data from meta', () => {
    expect(
      getDocumentTraceDataFromMeta(
        createDocument(
          `${HTML_DOCTYPE}
          <html>
            <head>
              <meta name="dd-trace-id" content="123" />
              <meta name="dd-trace-time" content="456" />
            </head>
            <body>
            </body>
          </html>`
        )
      )
    ).toEqual({ traceId: '123', traceTime: 456 as TimeStamp })
  })

  it('returns undefined if a meta is missing', () => {
    expect(
      getDocumentTraceDataFromMeta(
        createDocument(
          `${HTML_DOCTYPE}
          <html>
            <head>
              <meta name="dd-trace-id" content="123" />
            </head>
            <body>
            </body>
          </html>`
        )
      )
    ).toEqual(undefined)
  })
})

describe('findTraceComment', () => {
  const OPENOBSERVE_COMMENT = '\n<!-- OPENOBSERVE;foo=bar -->\n'

  it('returns undefined if no comment is present', () => {
    expect(findTraceComment(createDocument(HTML_DOCTYPE + HTML_CONTENT))).toBe(undefined)
  })

  it('returns undefined if no body is present', () => {
    expect(findTraceComment(createDocument(`${HTML_DOCTYPE}<html></html>`))).toBe(undefined)
  })

  it('finds a comment before the doctype', () => {
    expect(findTraceComment(createDocument(OPENOBSERVE_COMMENT + HTML_DOCTYPE + HTML_CONTENT))).toBe('foo=bar')
  })

  it('finds a comment before the HTML content', () => {
    expect(findTraceComment(createDocument(HTML_DOCTYPE + OPENOBSERVE_COMMENT + HTML_CONTENT))).toBe('foo=bar')
  })

  it('finds a comment after the HTML content', () => {
    expect(findTraceComment(createDocument(HTML_DOCTYPE + HTML_CONTENT + OPENOBSERVE_COMMENT))).toBe('foo=bar')
  })

  it('finds a comment at the end of the body', () => {
    expect(findTraceComment(createDocument(`${HTML_DOCTYPE}<html><body>${OPENOBSERVE_COMMENT}</body></html>`))).toBe(
      'foo=bar'
    )
  })

  it("doesn't match comments without the OPENOBSERVE; prefix", () => {
    expect(findTraceComment(createDocument(`${HTML_DOCTYPE}${HTML_CONTENT}<!-- foo=bar -->`))).toBe(undefined)
  })

  it("doesn't look for comments nested below the body", () => {
    expect(
      findTraceComment(createDocument(`${HTML_DOCTYPE}<html><body><div>${OPENOBSERVE_COMMENT}</div></body></html>`))
    ).toBe(undefined)
  })

  it('finds a comment surrounded by newlines', () => {
    expect(findTraceComment(createDocument(`<!--\nOPENOBSERVE;foo=bar\n-->${HTML_DOCTYPE}${HTML_CONTENT}`))).toBe('foo=bar')
  })
})

describe('createDocumentTraceData', () => {
  it('parses a trace comment', () => {
    expect(createDocumentTraceData('123', '456')).toEqual({
      traceId: '123',
      traceTime: 456 as TimeStamp,
    })
  })

  it('returns undefined if the time is not a number', () => {
    expect(createDocumentTraceData('123', '4x6')).toBe(undefined)
  })

  it('returns undefined if the time is missing', () => {
    expect(createDocumentTraceData('123', undefined)).toBe(undefined)
  })

  it('returns undefined if the trace id is missing', () => {
    expect(createDocumentTraceData(undefined, '456')).toBe(undefined)
  })

  it('returns undefined if the trace id is empty', () => {
    expect(createDocumentTraceData('', '456')).toBe(undefined)
  })
})

function createDocument(content: string) {
  return new DOMParser().parseFromString(content, 'text/html')
}
