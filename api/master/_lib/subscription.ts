/**
 * Situação administrativa da assinatura — separada do status operacional.
 * Sem valores, PIX, gateway ou qualquer dado financeiro.
 */

export const SUBSCRIPTION_STATUSES = [
  'active',
  'overdue',
  'grace',
  'suspended',
  'terminated',
  'cancelled'
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const FINANCIAL_KEY =
  /pix|boleto|gateway|stripe|asaas|mercado.?pago|payment|amount|invoice|bank_|card_|mrr|receita|faturamento|transaction/i;

export type AdminOrgView = {
  id: string;
  name: string;
  status: string;
  profile?: Record<string, unknown> | null;
  blocked_at?: string | null;
  block_reason?: string | null;
  block_source?: string | null;
  scheduled_block_at?: string | null;
  contract_starts_at?: string | null;
  contract_ends_at?: string | null;
  subscription_status?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  renewal_at?: string | null;
  grace_started_at?: string | null;
  grace_ends_at?: string | null;
  auto_block_enabled?: boolean | null;
  regularized_at?: string | null;
  regularized_by?: string | null;
  administrative_notes?: string | null;
};

function str(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v;
  return null;
}

function bool(v: unknown): boolean {
  return v === true || v === 'true';
}

export function stripFinancialKeys(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (FINANCIAL_KEY.test(k)) continue;
    out[k] = v;
  }
  return out;
}

export function hydrateAdminOrg(org: AdminOrgView): AdminOrgView {
  const p = org.profile && typeof org.profile === 'object' ? org.profile : {};
  return {
    ...org,
    subscription_status:
      org.subscription_status || str(p.subscription_status) || 'active',
    current_period_start: org.current_period_start || str(p.current_period_start),
    current_period_end: org.current_period_end || str(p.current_period_end),
    renewal_at: org.renewal_at || str(p.renewal_at),
    grace_started_at: org.grace_started_at || str(p.grace_started_at),
    grace_ends_at: org.grace_ends_at || str(p.grace_ends_at),
    auto_block_enabled:
      org.auto_block_enabled === true || org.auto_block_enabled === false
        ? org.auto_block_enabled
        : bool(p.auto_block_enabled),
    regularized_at: org.regularized_at || str(p.regularized_at),
    regularized_by: org.regularized_by || str(p.regularized_by),
    administrative_notes:
      org.administrative_notes || str(p.administrative_notes) || str(p.notes),
    contract_starts_at: org.contract_starts_at || str(p.contract_starts_at),
    contract_ends_at: org.contract_ends_at || str(p.contract_ends_at)
  };
}

export function isValidSubscriptionStatus(v: string): v is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(v);
}

export function isOperationalBlocked(org: AdminOrgView): boolean {
  return org.status === 'suspended';
}

export function isGraceActive(org: AdminOrgView, now = Date.now()): boolean {
  const h = hydrateAdminOrg(org);
  if (!h.grace_ends_at) return false;
  const end = Date.parse(h.grace_ends_at);
  if (!Number.isFinite(end)) return false;
  const start = h.grace_started_at ? Date.parse(h.grace_started_at) : 0;
  return now <= end && (!Number.isFinite(start) || now >= start);
}

export function isGraceExpired(org: AdminOrgView, now = Date.now()): boolean {
  const h = hydrateAdminOrg(org);
  if (!h.grace_ends_at) return false;
  const end = Date.parse(h.grace_ends_at);
  return Number.isFinite(end) && end < now;
}

export function daysRemaining(org: AdminOrgView, now = Date.now()): number | null {
  const h = hydrateAdminOrg(org);
  const target = h.grace_ends_at || h.current_period_end || h.contract_ends_at;
  if (!target) return null;
  const t = Date.parse(target);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - now) / 86400000);
}

export function contractNearExpiry(org: AdminOrgView, now = Date.now(), days = 30): boolean {
  const h = hydrateAdminOrg(org);
  const end = h.contract_ends_at || h.current_period_end;
  if (!end) return false;
  const t = Date.parse(end);
  if (!Number.isFinite(t)) return false;
  const diff = t - now;
  return diff >= 0 && diff <= days * 86400000;
}

export function scheduledBlockToday(org: AdminOrgView, now = Date.now()): boolean {
  if (!org.scheduled_block_at) return false;
  const t = Date.parse(org.scheduled_block_at);
  if (!Number.isFinite(t)) return false;
  const d = new Date(now);
  const s = new Date(t);
  return d.toISOString().slice(0, 10) === s.toISOString().slice(0, 10);
}

export type AdminAlert = {
  level: 'red' | 'orange' | 'yellow';
  code: string;
  title: string;
  organization_id: string;
  organization_name: string;
};

export function adminAlerts(orgs: AdminOrgView[], now = Date.now()): AdminAlert[] {
  const out: AdminAlert[] = [];
  for (const raw of orgs) {
    const org = hydrateAdminOrg(raw);
    if (isGraceExpired(org, now) && !isOperationalBlocked(org)) {
      out.push({
        level: 'red',
        code: 'GRACE_EXPIRED',
        title: 'Organização com tolerância vencida',
        organization_id: org.id,
        organization_name: org.name
      });
    } else if (isGraceActive(org, now)) {
      out.push({
        level: 'orange',
        code: 'GRACE_ACTIVE',
        title: 'Organização em período de tolerância',
        organization_id: org.id,
        organization_name: org.name
      });
    }
    if (contractNearExpiry(org, now)) {
      out.push({
        level: 'yellow',
        code: 'CONTRACT_NEAR',
        title: 'Contrato próximo do vencimento',
        organization_id: org.id,
        organization_name: org.name
      });
    }
    if (scheduledBlockToday(org, now) && !isOperationalBlocked(org)) {
      out.push({
        level: 'red',
        code: 'BLOCK_TODAY',
        title: 'Organização com bloqueio programado para hoje',
        organization_id: org.id,
        organization_name: org.name
      });
    }
  }
  return out;
}

export function adminMetrics(orgs: AdminOrgView[], now = Date.now()) {
  const list = orgs.map(hydrateAdminOrg);
  const sub = (s: SubscriptionStatus) =>
    list.filter((o) => {
      if (s === 'grace') return o.subscription_status === 'grace' || isGraceActive(o, now);
      return o.subscription_status === s;
    }).length;
  return {
    subscriptions_active: sub('active'),
    subscriptions_overdue: sub('overdue'),
    subscriptions_grace: list.filter((o) => o.subscription_status === 'grace' || isGraceActive(o, now)).length,
    subscriptions_suspended: sub('suspended'),
    contracts_near_expiry: list.filter((o) => contractNearExpiry(o, now)).length,
    trial: null,
    mrr: null
  };
}

function mergeProfile(org: AdminOrgView, extra: Record<string, unknown>): Record<string, unknown> {
  const base = org.profile && typeof org.profile === 'object' ? { ...org.profile } : {};
  return stripFinancialKeys({ ...base, ...extra });
}

export function patchRegisterDelay(
  org: AdminOrgView,
  body: Record<string, unknown>,
  actorId: string
): { patch: Record<string, unknown>; audit: string; meta: Record<string, unknown> } | { error: string } {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return { error: 'Motivo obrigatório' };
  const identified = typeof body.identified_at === 'string' ? body.identified_at : new Date().toISOString();
  const extra = {
    subscription_status: 'overdue',
    delay_identified_at: identified,
    delay_reference: typeof body.reference === 'string' ? body.reference : null,
    delay_original_due: typeof body.original_due_at === 'string' ? body.original_due_at : null,
    administrative_notes: reason
  };
  return {
    patch: {
      ...extra,
      profile: mergeProfile(org, extra)
    },
    audit: 'SUBSCRIPTION_STATUS_CHANGED',
    meta: {
      reason,
      from: hydrateAdminOrg(org).subscription_status,
      to: 'overdue',
      identified_at: identified,
      reference: extra.delay_reference,
      actor_user_id: actorId
    }
  };
}

export function patchStartGrace(
  org: AdminOrgView,
  body: Record<string, unknown>
): { patch: Record<string, unknown>; audit: string; meta: Record<string, unknown> } | { error: string } {
  let start = typeof body.grace_started_at === 'string' ? body.grace_started_at : new Date().toISOString().slice(0, 10);
  let end = typeof body.grace_ends_at === 'string' ? body.grace_ends_at : '';
  const days = typeof body.grace_days === 'number' ? body.grace_days : Number(body.grace_days);
  if (!end && Number.isFinite(days) && days > 0) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + days);
    end = d.toISOString().slice(0, 10);
  }
  if (!end) return { error: 'Informe o fim da tolerância ou a quantidade de dias' };
  const extra = {
    subscription_status: 'grace',
    grace_started_at: start,
    grace_ends_at: end
  };
  return {
    patch: { ...extra, profile: mergeProfile(org, extra) },
    audit: 'GRACE_PERIOD_STARTED',
    meta: { grace_started_at: start, grace_ends_at: end }
  };
}

export function patchRegularize(
  org: AdminOrgView,
  body: Record<string, unknown>,
  actorId: string
): { patch: Record<string, unknown>; audit: string; meta: Record<string, unknown> } | { error: string } {
  const current = hydrateAdminOrg(org).subscription_status;
  if (current !== 'overdue' && current !== 'grace') {
    return { error: 'Somente organizações em atraso ou em tolerância podem ser regularizadas' };
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return { error: 'Observação obrigatória' };
  const when = typeof body.regularized_at === 'string' ? body.regularized_at : new Date().toISOString();
  const extra = {
    subscription_status: 'active',
    regularized_at: when,
    regularized_by: actorId,
    administrative_notes: reason,
    grace_started_at: null,
    grace_ends_at: null
  };
  return {
    patch: { ...extra, profile: mergeProfile(org, extra) },
    audit: 'SUBSCRIPTION_REGULARIZED',
    meta: { reason, regularized_at: when, from: current, to: 'active' }
  };
}

export function patchContractStatus(
  org: AdminOrgView,
  next: 'suspended' | 'terminated' | 'cancelled',
  body: Record<string, unknown>
): { patch: Record<string, unknown>; audit: string; meta: Record<string, unknown> } | { error: string } {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return { error: 'Motivo obrigatório' };
  const extra = { subscription_status: next, administrative_notes: reason };
  return {
    patch: { ...extra, profile: mergeProfile(org, extra) },
    audit: next === 'suspended' ? 'CONTRACT_SUSPENDED' : 'CONTRACT_TERMINATED',
    meta: { reason, from: hydrateAdminOrg(org).subscription_status, to: next }
  };
}

export function patchAutoBlock(
  org: AdminOrgView,
  enabled: boolean
): { patch: Record<string, unknown>; audit: string; meta: Record<string, unknown> } {
  const extra = { auto_block_enabled: enabled };
  return {
    patch: { ...extra, profile: mergeProfile(org, extra) },
    audit: 'CONTRACT_UPDATED',
    meta: { auto_block_enabled: enabled }
  };
}

export function shouldAutoBlockAfterGrace(org: AdminOrgView, now = Date.now()): boolean {
  const h = hydrateAdminOrg(org);
  if (!h.auto_block_enabled) return false;
  if (isOperationalBlocked(h)) return false;
  if (h.subscription_status === 'terminated' || h.subscription_status === 'cancelled') return false;
  const overdueLike = h.subscription_status === 'overdue' || h.subscription_status === 'grace';
  return overdueLike && isGraceExpired(h, now);
}
