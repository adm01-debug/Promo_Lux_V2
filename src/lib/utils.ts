import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * W3C Traceparent helper for distributed tracing
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

export function createTraceparent(traceId?: string, parentId?: string): string {
  const tid = traceId || generateTraceId();
  const sid = parentId || generateSpanId();
  return `00-${tid}-${sid}-01`;
}

export function parseTraceparent(traceparent: string) {
  const parts = traceparent.split('-');
  if (parts.length !== 4) return null;
  return {
    traceId: parts[1],
  };
}
