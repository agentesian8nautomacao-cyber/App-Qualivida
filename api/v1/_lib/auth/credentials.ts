/**
 * Integration credentials — server-side only.
 *
 * Source (never frontend, never git):
 *   SENTINELA_API_CREDENTIALS='[{
 *     "client_id":"...","secret":"...",
 *     "organization_id":"...","condominium_id":"...",
 *     "role_name":"porteiro",
 *     "permission_keys":["packages.create","packages.update"]
 *   }]'
 *
 * Profile: role_name and/or permission_keys required for G3 AuthZ.
 * FUTURE MIGRATION: table api_integration_credentials / membership bridge.
 */

export type IntegrationCredential = {
  client_id: string;
  /** Current HMAC secret — never log */
  secret: string;
  /** Optional previous secret during rotation */
  secret_previous?: string;
  organization_id: string;
  condominium_id: string;
  /** RBAC roles.name (e.g. porteiro) — resolved via role_permissions; NO bypass */
  role_name?: string;
  /** Explicit grants — must be known RBAC keys; intersected with role if both set */
  permission_keys?: string[];
};

export type CredentialStore = {
  getByClientId(clientId: string): IntegrationCredential | null;
};

function parseCredentialsJson(raw: string): IntegrationCredential[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('SENTINELA_API_CREDENTIALS must be a JSON array');
  }
  const out: IntegrationCredential[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const client_id = String(r.client_id || '').trim();
    const secret = String(r.secret || '').trim();
    const organization_id = String(r.organization_id || '').trim();
    const condominium_id = String(r.condominium_id || '').trim();
    if (!client_id || !secret || !organization_id || !condominium_id) continue;
    const secret_previous =
      typeof r.secret_previous === 'string' && r.secret_previous.trim()
        ? r.secret_previous.trim()
        : undefined;
    const role_name =
      typeof r.role_name === 'string' && r.role_name.trim()
        ? r.role_name.trim().toLowerCase()
        : undefined;
    let permission_keys: string[] | undefined;
    if (Array.isArray(r.permission_keys)) {
      permission_keys = r.permission_keys
        .map((k) => String(k || '').trim())
        .filter(Boolean);
    }
    out.push({
      client_id,
      secret,
      secret_previous,
      organization_id,
      condominium_id,
      role_name,
      permission_keys
    });
  }
  return out;
}

export function createMemoryCredentialStore(rows: IntegrationCredential[]): CredentialStore {
  const map = new Map(rows.map((r) => [r.client_id, r]));
  return {
    getByClientId(clientId: string) {
      return map.get(clientId) ?? null;
    }
  };
}

/** Loads from process.env.SENTINELA_API_CREDENTIALS — empty store if unset. */
export function createEnvCredentialStore(
  env: NodeJS.ProcessEnv = process.env
): CredentialStore {
  const raw = (env.SENTINELA_API_CREDENTIALS || '').trim();
  if (!raw) {
    return createMemoryCredentialStore([]);
  }
  try {
    return createMemoryCredentialStore(parseCredentialsJson(raw));
  } catch {
    console.error('[sentinela-api] invalid SENTINELA_API_CREDENTIALS (not logging value)');
    return createMemoryCredentialStore([]);
  }
}
