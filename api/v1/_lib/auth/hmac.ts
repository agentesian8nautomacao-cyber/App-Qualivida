/**
 * HMAC-SHA256 request signing — SENTINELA API v1 (DR4 / G2)
 *
 * Canonical string (UTF-8, LF line endings, NO trailing newline after last line):
 *
 *   v1
 *   {timestamp}
 *   {METHOD}
 *   {path_with_query}
 *   {body_sha256_hex}
 *   {organization_id}
 *   {condominium_id}
 *   {idempotency_key_or_empty}
 *
 * path_with_query = pathname + (search || '')
 *   e.g. /api/v1/protected-probe
 *   e.g. /api/v1/boletos?unit=3-5
 *
 * body_sha256_hex = SHA-256 of raw body bytes as lowercase hex;
 *   empty body → hash of empty string.
 *
 * Signature header: lowercase hex HMAC-SHA256(secret, canonical).
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const HMAC_PROTOCOL_VERSION = 'v1';

export type CanonicalInput = {
  timestamp: string;
  method: string;
  pathWithQuery: string;
  bodySha256Hex: string;
  organizationId: string;
  condominiumId: string;
  idempotencyKey: string;
};

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function buildCanonicalString(input: CanonicalInput): string {
  const method = input.method.toUpperCase();
  const path = input.pathWithQuery.startsWith('/')
    ? input.pathWithQuery
    : `/${input.pathWithQuery}`;
  return [
    HMAC_PROTOCOL_VERSION,
    input.timestamp.trim(),
    method,
    path,
    input.bodySha256Hex.toLowerCase().trim(),
    input.organizationId.trim(),
    input.condominiumId.trim(),
    (input.idempotencyKey || '').trim()
  ].join('\n');
}

export function signCanonical(secret: string, canonical: string): string {
  return createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}

/** Timing-safe compare of two hex signatures (or any utf8 strings of equal length). */
export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a.toLowerCase(), 'utf8');
    const bb = Buffer.from(b.toLowerCase(), 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function verifySignature(
  secrets: string[],
  canonical: string,
  providedSignature: string
): boolean {
  const provided = (providedSignature || '').trim().toLowerCase();
  if (!provided || !/^[0-9a-f]+$/.test(provided)) return false;
  for (const secret of secrets) {
    if (!secret) continue;
    const expected = signCanonical(secret, canonical);
    if (safeEqualHex(expected, provided)) return true;
  }
  return false;
}

export function pathWithQueryFromUrl(url: URL): string {
  return `${url.pathname}${url.search || ''}`;
}
