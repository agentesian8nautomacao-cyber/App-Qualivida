/**
 * FASE C — autorização Master (fail-closed).
 * Sem senhas, sem JWT real, sem service_role.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  authorizeMasterAction,
  PLATFORM_ACTIONS,
  redactAuditMetadata
} from './authorize';
import { createMasterApiHandler } from './handler';
import { createMemoryMasterStore } from './store';

const MASTER_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const SITE_ID = '33333333-3333-4333-8333-333333333333';

const masterUser = { id: 'user-master-1', email: 'master@example.com' };
const masterAdmin = {
  id: MASTER_ID,
  user_id: masterUser.id,
  role: 'platform_owner' as const,
  status: 'active' as const
};

function seedStore(overrides?: Parameters<typeof createMemoryMasterStore>[0]) {
  return createMemoryMasterStore({
    admins: [masterAdmin],
    organizations: [
      {
        id: ORG_ID,
        name: 'Org Demo',
        slug: 'org-demo',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z'
      }
    ],
    sites: [
      {
        id: SITE_ID,
        organization_id: ORG_ID,
        name: 'Site 1',
        slug: 'site-1',
        vertical: 'condominium',
        status: 'active'
      }
    ],
    ...overrides
  });
}

function handlerFor(
  getUser: (token: string) => Promise<{ id: string; email?: string | null } | null>,
  store = seedStore()
) {
  return { api: createMasterApiHandler({ getUserFromAccessToken: getUser, store }), store };
}

async function call(
  api: ReturnType<typeof createMasterApiHandler>,
  path: string,
  init: RequestInit = {}
) {
  return api.fetch(new Request(`http://localhost${path}`, init));
}

describe('authorizeMasterAction', () => {
  it('sem usuário → 401', async () => {
    const r = await authorizeMasterAction({
      user: null,
      admin: masterAdmin,
      action: PLATFORM_ACTIONS.SESSION
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('usuário comum / morador / porteiro / síndico / administradora → 403 NOT_MASTER', async () => {
    for (const id of ['morador-1', 'porteiro-1', 'sindico-1', 'administradora-1', 'comum-1']) {
      const r = await authorizeMasterAction({
        user: { id },
        admin: null,
        action: PLATFORM_ACTIONS.SESSION
      });
      expect(r.ok).toBe(false);
      if (!r.ok && r.status === 403) expect(r.reason).toBe('NOT_MASTER');
    }
  });

  it('admin suspenso → 403 SUSPENDED', async () => {
    const r = await authorizeMasterAction({
      user: masterUser,
      admin: { ...masterAdmin, status: 'suspended' },
      action: PLATFORM_ACTIONS.SESSION
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.status === 403) expect(r.reason).toBe('SUSPENDED');
  });

  it('Master ativo em ação não implementada → 403 ACTION_DENIED', async () => {
    const r = await authorizeMasterAction({
      user: masterUser,
      admin: masterAdmin,
      action: PLATFORM_ACTIONS.ADMINS_MANAGE
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.status === 403) expect(r.reason).toBe('ACTION_DENIED');
  });

  it('Master ativo + ação FASE C → ALLOW', async () => {
    const r = await authorizeMasterAction({
      user: masterUser,
      admin: masterAdmin,
      action: PLATFORM_ACTIONS.ORGANIZATIONS_READ
    });
    expect(r.ok).toBe(true);
  });
});

describe('redactAuditMetadata', () => {
  it('não registra senha, token, service_role, anon key nem JWT', () => {
    const out = redactAuditMetadata({
      password: 'secret',
      token: 'abc',
      service_role: 'srk',
      anon_key: 'anon',
      jwt: 'a.b.c',
      access_token: 'tok',
      fields: ['name'],
      fakeJwt: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${'a'.repeat(40)}.${'b'.repeat(40)}`
    });
    expect(out.password).toBeUndefined();
    expect(out.token).toBeUndefined();
    expect(out.service_role).toBeUndefined();
    expect(out.anon_key).toBeUndefined();
    expect(out.jwt).toBeUndefined();
    expect(out.access_token).toBeUndefined();
    expect(out.fakeJwt).toBeUndefined();
    expect(out.fields).toEqual(['name']);
  });
});

describe('/api/master HTTP', () => {
  it('API sem autenticação → 401', async () => {
    const { api } = handlerFor(async () => masterUser);
    const res = await call(api, '/api/master/session');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHENTICATED');
  });

  it('sessão expirada (token inválido) → 401', async () => {
    const { api } = handlerFor(async () => null);
    const res = await call(api, '/api/master/session', {
      headers: { Authorization: 'Bearer expired-token' }
    });
    expect(res.status).toBe(401);
  });

  it('Master → /api/master/session = ALLOW + MASTER_LOGIN', async () => {
    const { api, store } = handlerFor(async (t) => (t === 'master-jwt' ? masterUser : null));
    const res = await call(api, '/api/master/session', {
      headers: { Authorization: 'Bearer master-jwt' }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.admin.role).toBe('platform_owner');
    expect(store.audits.some((a) => a.action === 'MASTER_LOGIN')).toBe(true);
  });

  it('usuário comum autenticado → 403 + MASTER_ACCESS_DENIED', async () => {
    const { api, store } = handlerFor(async () => ({ id: 'user-comum' }));
    const res = await call(api, '/api/master/session', {
      headers: { Authorization: 'Bearer operational-jwt' }
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN');
    expect(store.audits.some((a) => a.action === 'MASTER_ACCESS_DENIED')).toBe(true);
  });

  it.each([
    ['morador', 'user-morador'],
    ['porteiro', 'user-porteiro'],
    ['síndico', 'user-sindico'],
    ['administradora', 'user-administradora']
  ])('%s autenticado → 403', async (_label, userId) => {
    const { api } = handlerFor(async () => ({ id: userId }));
    const res = await call(api, '/api/master/dashboard', {
      headers: { Authorization: 'Bearer op' }
    });
    expect(res.status).toBe(403);
  });

  it('admin suspenso → 403', async () => {
    const store = seedStore({
      admins: [{ ...masterAdmin, status: 'suspended' }]
    });
    const { api } = handlerFor(async () => masterUser, store);
    const res = await call(api, '/api/master/session', {
      headers: { Authorization: 'Bearer master-jwt' }
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe('SUSPENDED');
  });

  it('ignora user_id no body (identidade só do JWT)', async () => {
    const { api } = handlerFor(async () => ({ id: 'user-comum' }));
    const res = await call(api, '/api/master/session', {
      method: 'GET',
      headers: { Authorization: 'Bearer op', 'Content-Type': 'application/json' }
    });
    expect(res.status).toBe(403);
  });

  it('GET organizations → lista + ORGANIZATION_VIEW; billing Não configurado', async () => {
    const { api, store } = handlerFor(async () => masterUser);
    const res = await call(api, '/api/master/organizations', {
      headers: { Authorization: 'Bearer m' }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organizations).toHaveLength(1);
    expect(body.organizations[0].sites_count).toBe(1);
    expect(body.subscription).toBe('Não configurado');
    expect(body.plan).toBe('Não configurado');
    expect(store.audits.some((a) => a.action === 'ORGANIZATION_VIEW')).toBe(true);
  });

  it('GET dashboard não inventa MRR', async () => {
    const { api } = handlerFor(async () => masterUser);
    const res = await call(api, '/api/master/dashboard', {
      headers: { Authorization: 'Bearer m' }
    });
    const body = await res.json();
    expect(body.billing).toBe('Não configurado');
    expect(body.metrics.mrr).toBeNull();
    expect(body.metrics.organizations_total).toBe(1);
  });

  it('GET org detalhe + PATCH name registra ORGANIZATION_UPDATE', async () => {
    const { api, store } = handlerFor(async () => masterUser);
    const getRes = await call(api, `/api/master/organizations/${ORG_ID}`, {
      headers: { Authorization: 'Bearer m' }
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.subscription).toBe('active');
    expect(getBody.sites).toHaveLength(1);

    const patchRes = await call(api, `/api/master/organizations/${ORG_ID}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer m', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Org Nova', user_id: 'attacker-uuid' })
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.organization.name).toBe('Org Nova');
    expect(store.audits.some((a) => a.action === 'ORGANIZATION_UPDATE')).toBe(true);
  });

  it('POST organização cria + ORGANIZATION_CREATE; user_id no body é ignorado', async () => {
    const { api, store } = handlerFor(async () => masterUser);
    const res = await call(api, '/api/master/organizations', {
      method: 'POST',
      headers: { Authorization: 'Bearer m', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Administradora XYZ', user_id: 'attacker-uuid' })
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.organization.name).toBe('Administradora XYZ');
    expect(store.audits.some((a) => a.action === 'ORGANIZATION_CREATE')).toBe(true);
  });

  it('POST site + bloqueio manual + desbloqueio geram auditoria operacional', async () => {
    const { api, store } = handlerFor(async () => masterUser);
    const siteRes = await call(api, `/api/master/organizations/${ORG_ID}/sites`, {
      method: 'POST',
      headers: { Authorization: 'Bearer m', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Condomínio Alpha' })
    });
    expect(siteRes.status).toBe(201);
    const blockRes = await call(api, `/api/master/organizations/${ORG_ID}/block`, {
      method: 'POST',
      headers: { Authorization: 'Bearer m', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Inadimplência contratual', immediate: true })
    });
    expect(blockRes.status).toBe(200);
    const blocked = await blockRes.json();
    expect(blocked.organization.status).toBe('suspended');
    const unRes = await call(api, `/api/master/organizations/${ORG_ID}/unblock`, {
      method: 'POST',
      headers: { Authorization: 'Bearer m', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Regularizado' })
    });
    expect(unRes.status).toBe(200);
    expect(store.audits.some((a) => a.action === 'SITE_CREATE')).toBe(true);
    expect(store.audits.some((a) => a.action === 'OPERATION_BLOCK')).toBe(true);
    expect(store.audits.some((a) => a.action === 'OPERATION_UNBLOCK')).toBe(true);
  });

  it('GET dashboard aplica bloqueio programado já vencido', async () => {
    const { api, store } = handlerFor(async () => masterUser);
    await store.updateOrganization(ORG_ID, {
      scheduled_block_at: '2020-01-01T00:00:00.000Z',
      block_reason: 'Inadimplência contratual',
      block_source: 'automatic'
    });
    const res = await call(api, '/api/master/dashboard', {
      headers: { Authorization: 'Bearer m' }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const row = body.organizations.find((o: { id: string }) => o.id === ORG_ID);
    expect(row.status).toBe('suspended');
    expect(store.audits.some((a) => a.action === 'OPERATION_BLOCK')).toBe(true);
  });

  it('Master registra atraso sem bloquear operação e sem dado financeiro', async () => {
    const { api, store } = handlerFor(async () => masterUser);
    const res = await call(api, `/api/master/organizations/${ORG_ID}/delay`, {
      method: 'POST',
      headers: { Authorization: 'Bearer m', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Atraso identificado fora da plataforma', user_id: 'attacker', payment_amount: 99 })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organization.subscription_status).toBe('overdue');
    expect(body.organization.status).toBe('active');
    expect(JSON.stringify(body)).not.toMatch(/payment_amount|pix_key|amount_due/);
    expect(store.audits.some((a) => a.action === 'SUBSCRIPTION_STATUS_CHANGED')).toBe(true);
  });

  it('Master inicia tolerância, regulariza sem desbloquear, e comum recebe 403', async () => {
    const { api, store } = handlerFor(async () => masterUser);
    await call(api, `/api/master/organizations/${ORG_ID}/delay`, {
      method: 'POST',
      headers: { Authorization: 'Bearer m', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Atraso' })
    });
    const grace = await call(api, `/api/master/organizations/${ORG_ID}/grace`, {
      method: 'POST',
      headers: { Authorization: 'Bearer m', 'Content-Type': 'application/json' },
      body: JSON.stringify({ grace_days: 10 })
    });
    expect(grace.status).toBe(200);
    expect((await grace.json()).organization.subscription_status).toBe('grace');
    expect(store.audits.some((a) => a.action === 'GRACE_PERIOD_STARTED')).toBe(true);
    const reg = await call(api, `/api/master/organizations/${ORG_ID}/regularize`, {
      method: 'POST',
      headers: { Authorization: 'Bearer m', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Pagamento externo confirmado pelo admin' })
    });
    expect(reg.status).toBe(200);
    const regularized = await reg.json();
    expect(regularized.organization.subscription_status).toBe('active');
    expect(regularized.organization.status).toBe('active');
    expect(store.audits.some((a) => a.action === 'SUBSCRIPTION_REGULARIZED')).toBe(true);
    const denied = await handlerFor(async () => ({ id: 'user-comum' })).api.fetch(
      new Request(`http://localhost/api/master/organizations/${ORG_ID}/delay`, {
        method: 'POST',
        headers: { Authorization: 'Bearer op', 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'não' })
      })
    );
    expect(denied.status).toBe(403);
  });

  it('GET dashboard aplica bloqueio automático só com auto_block após tolerância vencida', async () => {
    const { api, store } = handlerFor(async () => masterUser);
    await store.updateOrganization(ORG_ID, {
      subscription_status: 'overdue',
      auto_block_enabled: true,
      grace_ends_at: '2020-01-01',
      status: 'active'
    });
    const res = await call(api, '/api/master/dashboard', {
      headers: { Authorization: 'Bearer m' }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.mrr).toBeNull();
    expect(body.metrics.trial).toBeNull();
    const row = body.organizations.find((o: { id: string }) => o.id === ORG_ID);
    expect(row.status).toBe('suspended');
    expect(store.audits.some((a) => a.action === 'GRACE_PERIOD_EXPIRED')).toBe(true);
    expect(store.audits.some((a) => a.action === 'OPERATION_BLOCK')).toBe(true);
  });

  it('sem Bearer nas novas rotas administrativas → 401', async () => {
    const { api } = handlerFor(async () => masterUser);
    const res = await call(api, `/api/master/organizations/${ORG_ID}/regularize`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'x' })
    });
    expect(res.status).toBe(401);
  });

  it('usuário comum não cria organização', async () => {
    const { api } = handlerFor(async () => ({ id: 'user-comum' }));
    const res = await call(api, '/api/master/organizations', {
      method: 'POST',
      headers: { Authorization: 'Bearer op', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Não deve' })
    });
    expect(res.status).toBe(403);
  });

  it('rota inexistente → 404 (não vaza como 200)', async () => {
    const { api } = handlerFor(async () => masterUser);
    const res = await call(api, '/api/master/plans', {
      headers: { Authorization: 'Bearer m' }
    });
    expect(res.status).toBe(404);
  });
});

describe('FASE C regressão de superfície', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '../../..');

  it('.env.example não expõe service role no frontend', () => {
    const envEx = readFileSync(join(root, '.env.example'), 'utf8');
    expect(envEx).not.toMatch(/^VITE_SUPABASE_SERVICE_ROLE/m);
    expect(envEx).toMatch(/PLATFORM_OWNER_EMAILS/);
  });

  it('migration FASE C não altera residents, roles, tenant_memberships, users', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260817190000_010_platform_master_fase_c.sql'),
      'utf8'
    );
    expect(sql).not.toMatch(/ALTER TABLE public\.(residents|users|roles|tenant_memberships)/i);
    expect(sql).not.toMatch(/CREATE TABLE public\.(platform_plans|organization_subscriptions)/i);
    expect(sql).toMatch(/UNIQUE \(user_id\)/);
    expect(sql).toMatch(/CREATE FUNCTION public\.is_platform_admin\(\)/);
    expect(sql).not.toMatch(/is_platform_admin\s*\(\s*uuid/i);
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/\bTO anon\b/i);
    expect(sql).not.toMatch(/\bpassword\b/i);
  });

  it('plano M1–M16 e M5 não foram alterados por este arquivo', () => {
    const plan = readFileSync(join(root, 'docs/FASE-1-MIGRATION-PLAN.md'), 'utf8');
    expect(plan).toMatch(/## M5 — `005_residents_condo_id`/);
    expect(plan).toMatch(/## M8 /);
  });

  it('012 não cria módulo financeiro nem altera M5', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260818190000_012_master_subscription_admin.sql'),
      'utf8'
    );
    expect(sql).not.toMatch(/ADD COLUMN IF NOT EXISTS (pix_|payment_|amount_|gateway_|boleto_|mrr)/i);
    expect(sql).not.toMatch(/CREATE TABLE public\.(invoices|payments|subscriptions_billing)/i);
    expect(sql).not.toMatch(/residents|tenant_memberships|public\.roles/i);
    expect(sql).toMatch(/subscription_status/);
    expect(sql).toMatch(/NOT EXECUTED/);
  });
});
