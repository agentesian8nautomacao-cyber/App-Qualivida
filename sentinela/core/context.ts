/**
 * Tenant / site context helpers for Operational Core.
 * Does not enforce RLS. Does not write to DB.
 */

import type { OperationContext } from './types';

/** Pilot IDs from M4 APPLY evidence (reference only — not hardcoded into SQL). */
export const PILOT_ORGANIZATION_ID = '0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928';
export const PILOT_CONDOMINIUM_ID = '3f383313-5ec0-4d21-97c7-1b2500c933be';

export function hasTenantContext(ctx: OperationContext): boolean {
  return Boolean(ctx.organizationId && ctx.condominiumId);
}

/**
 * Legacy single-tenant mode: operations may run without org/site IDs.
 * After M5–M11 isolation, callers SHOULD supply context.
 * Hard-fail is deferred (DECISION REQUIRED / future).
 */
export function tenantWarnings(ctx: OperationContext): string[] {
  if (hasTenantContext(ctx)) return [];
  return ['TENANT_CONTEXT_ABSENT'];
}

export function withPilotTenantDefaults(ctx: OperationContext): OperationContext {
  return {
    ...ctx,
    organizationId: ctx.organizationId ?? PILOT_ORGANIZATION_ID,
    condominiumId: ctx.condominiumId ?? PILOT_CONDOMINIUM_ID
  };
}
