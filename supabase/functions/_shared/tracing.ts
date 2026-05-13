/**
 * Simple W3C traceparent implementation for distributed tracing.
 * Format: 00-traceid-parentid-flags
 * version: 00
 * traceid: 16-byte array, 32 hex chars
 * parentid: 8-byte array, 16 hex chars
 * flags: 1-byte array, 2 hex chars (01 means recorded)
 */

export function generateTraceId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSpanId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getTraceparent(headers: Headers): string | null {
  return headers.get('traceparent');
}

export function createTraceparent(traceId?: string, parentId?: string): string {
  const tid = traceId || generateTraceId();
  const sid = parentId || generateSpanId();
  return `00-${tid}-${sid}-01`;
}

export function parseTraceparent(traceparent: string) {
  const parts = traceparent.split('-');
  if (parts.length !== 4) return null;
  return {
    version: parts[0],
    traceId: parts[1],
    parentId: parts[2],
    flags: parts[3],
  };
}
