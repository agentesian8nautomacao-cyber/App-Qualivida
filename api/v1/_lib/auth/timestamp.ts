/**
 * Timestamp anti-replay window (signature-level).
 * Full nonce/Idempotency store = FUTURE MIGRATION / G3+.
 */

export type TimestampCheckResult =
  | { ok: true; skewSeconds: number }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'future' };

const DEFAULT_WINDOW_SECONDS = 300;

export function getTimestampWindowSeconds(env: NodeJS.ProcessEnv = process.env): number {
  const raw = (env.SENTINELA_API_TIMESTAMP_WINDOW_SECONDS || '').trim();
  const n = raw ? Number(raw) : DEFAULT_WINDOW_SECONDS;
  if (!Number.isFinite(n) || n < 30 || n > 3600) return DEFAULT_WINDOW_SECONDS;
  return Math.floor(n);
}

/**
 * Accepts unix seconds (string or number). Rejects ms timestamps by magnitude.
 */
export function checkTimestamp(
  timestampHeader: string | null | undefined,
  nowMs: number = Date.now(),
  windowSeconds: number = DEFAULT_WINDOW_SECONDS
): TimestampCheckResult {
  const raw = (timestampHeader || '').trim();
  if (!raw) return { ok: false, reason: 'missing' };
  if (!/^\d+$/.test(raw)) return { ok: false, reason: 'invalid' };

  const ts = Number(raw);
  if (!Number.isFinite(ts) || ts <= 0) return { ok: false, reason: 'invalid' };

  // Reject likely millisecond values (13+ digits)
  if (raw.length >= 13) return { ok: false, reason: 'invalid' };

  const nowSec = Math.floor(nowMs / 1000);
  const skew = ts - nowSec;
  if (skew < -windowSeconds) return { ok: false, reason: 'expired' };
  if (skew > windowSeconds) return { ok: false, reason: 'future' };
  return { ok: true, skewSeconds: skew };
}
