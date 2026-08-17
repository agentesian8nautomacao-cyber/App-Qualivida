/**
 * G7-G — Redact sensitive fields before emitting observability events.
 */

const BLOCKED_KEYS = new Set([
  'secret',
  'hmac',
  'signature',
  'x-sentinela-signature',
  'password',
  'token',
  'confirmation_token',
  'confirmationtoken',
  'authorization',
  'service_role',
  'servicerole',
  'supabase_service_role_key',
  'audio',
  'image',
  'image_bytes',
  'photo',
  'whatsapp_payload',
  'raw_body',
  'payload',
  'boleto_pdf',
  'pdf',
  'cpf',
  'document',
  'stack',
  'sql',
  'query'
]);

const BLOCKED_KEY_RE =
  /(secret|password|token|signature|hmac|service.?role|authorization|audio|image|photo|pdf|cpf|document|whatsapp|raw.?body)/i;

export function isBlockedObservabilityKey(key: string): boolean {
  const k = key.toLowerCase().replace(/-/g, '_');
  if (BLOCKED_KEYS.has(k)) return true;
  return BLOCKED_KEY_RE.test(key);
}

/** Deep-ish redact for plain objects (1–2 levels; arrays of primitives kept truncated). */
export function redactObservabilityValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 120) return `${value.slice(0, 40)}…[redacted_len=${value.length}]`;
    if (/^Bearer\s+/i.test(value)) return '[redacted]';
    if (/^[0-9a-f]{64}$/i.test(value)) return '[redacted_hex]';
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth > 2) return `[array:${value.length}]`;
    return value.slice(0, 5).map((v) => redactObservabilityValue(v, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth > 2) return '[object]';
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isBlockedObservabilityKey(k)) {
        out[k] = '[redacted]';
        continue;
      }
      out[k] = redactObservabilityValue(v, depth + 1);
    }
    return out;
  }
  return '[unsupported]';
}

export function assertNoSensitiveLeak(payload: unknown): string[] {
  const leaks: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (node == null) return;
    if (typeof node === 'string') {
      if (/service_role|BEGIN\s|SELECT\s|password=/i.test(node)) leaks.push(path);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        const p = path ? `${path}.${k}` : k;
        if (isBlockedObservabilityKey(k) && v !== '[redacted]' && v != null) {
          leaks.push(p);
        }
        walk(v, p);
      }
    }
  };
  walk(payload, '');
  return leaks;
}
