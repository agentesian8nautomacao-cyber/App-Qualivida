/**
 * SENTINELA API v1 — gates through G5
 */

export const API_VERSION = 'v1' as const;

export type FoundationGates = {
  g1_foundation: true;
  g2_authn_hmac: true;
  g2_tenant_fail_closed: true;
  g3_authz_ops: true;
  g4_sensitive_confirmation: true;
  /** G5: Core execution for READ (+ WRITE when idempotency store available) */
  g5_core_execution: true;
  confirmation_persistent_store: boolean;
  idempotency_store: boolean;
  /** WRITE path enabled when persistent idempotency store is wired */
  writes_enabled: boolean;
  sensitive_execution_enabled: boolean;
  n8n: false;
  whatsapp: false;
  public_operations: false;
};

export const FOUNDATION_GATES: FoundationGates = {
  g1_foundation: true,
  g2_authn_hmac: true,
  g2_tenant_fail_closed: true,
  g3_authz_ops: true,
  g4_sensitive_confirmation: true,
  g5_core_execution: true,
  /** G7-B: wiring present; runtime still fail-closed if service-role missing */
  confirmation_persistent_store: true,
  idempotency_store: true,
  writes_enabled: true,
  sensitive_execution_enabled: true,
  n8n: false,
  whatsapp: false,
  public_operations: false
};

export function isWriteEnabled(): boolean {
  return FOUNDATION_GATES.writes_enabled === true;
}

export function isAuthnEnabled(): boolean {
  return FOUNDATION_GATES.g2_authn_hmac === true;
}
