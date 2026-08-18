/**
 * Cliente HTTP Master. Autorização real está no servidor.
 * Nunca envia user_id como prova de identidade.
 */

export type MasterAdminSession = {
  id: string;
  role: string;
  status: string;
};

export type MasterOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  sites_count?: number;
};

export type MasterSite = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  vertical: string;
  status: string;
};

export type MasterDashboard = {
  metrics: {
    organizations_total: number;
    organizations_active: number;
    organizations_suspended: number;
    sites_operational: number;
    subscriptions_active: null;
    subscriptions_expired: null;
    trial: null;
    mrr: null;
  };
  billing: string;
};

export type MasterApiError = {
  status: number;
  code?: string;
  error: string;
  reason?: string;
};

function masterErrorMessage(body: Record<string, unknown>, status: number): string {
  if (typeof body.error === 'string' && body.error.trim()) return body.error;
  const nested = body.error;
  if (nested && typeof nested === 'object' && typeof (nested as { message?: unknown }).message === 'string') {
    return (nested as { message: string }).message;
  }
  if (typeof body.message === 'string' && body.message.trim()) return body.message;
  if (status === 404) {
    return 'API Master não encontrada. Confirme o deploy da rota /api/master.';
  }
  if (status === 500) {
    return 'API Master retornou HTTP 500. Veja o log da função no Vercel (não é 401/403).';
  }
  return `Falha Master (HTTP ${status})`;
}

async function masterFetch<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<{ ok: true; data: T } | { ok: false; error: MasterApiError }> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
  } catch {
    return {
      ok: false,
      error: {
        status: 503,
        code: 'API_UNAVAILABLE',
        error: 'API Master indisponível. Verifique o proxy /api e o servidor local.'
      }
    };
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        code: typeof body.code === 'string' ? body.code : undefined,
        error: masterErrorMessage(body, res.status),
        reason: typeof body.reason === 'string' ? body.reason : undefined
      }
    };
  }
  return { ok: true, data: body as T };
}

export function getMasterSession(accessToken: string) {
  return masterFetch<{ ok: true; admin: MasterAdminSession }>(
    '/api/master/session',
    accessToken
  );
}

export function getMasterDashboard(accessToken: string) {
  return masterFetch<{ ok: true } & MasterDashboard>('/api/master/dashboard', accessToken);
}

export function listMasterOrganizations(accessToken: string) {
  return masterFetch<{
    ok: true;
    organizations: MasterOrganization[];
    subscription: string;
    plan: string;
  }>('/api/master/organizations', accessToken);
}

export function getMasterOrganization(accessToken: string, id: string) {
  return masterFetch<{
    ok: true;
    organization: MasterOrganization;
    sites: MasterSite[];
    subscription: string;
    users: string;
  }>(`/api/master/organizations/${id}`, accessToken);
}

export function updateMasterOrganization(
  accessToken: string,
  id: string,
  patch: { name?: string; slug?: string; status?: string }
) {
  return masterFetch<{ ok: true; organization: MasterOrganization }>(
    `/api/master/organizations/${id}`,
    accessToken,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
}
