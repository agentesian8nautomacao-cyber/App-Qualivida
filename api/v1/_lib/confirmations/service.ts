/**
 * Confirmation service — create / validate / consume (G4 + G7-B)
 * Fail-closed. HMAC ≠ confirmation. Memory ≠ production.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { requiresConfirmation } from '../ops/classification';
import { createUnavailableConfirmationStore } from './unavailableStore';
import { confirmationOperationFingerprint } from './fingerprint';
import type {
  ConfirmationStore,
  CreateConfirmationInput,
  CreateConfirmationResult,
  ValidateConfirmationInput,
  ValidateConfirmationResult
} from './types';

const DEFAULT_TTL_SECONDS = 300;

export function hashConfirmationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a.toLowerCase(), 'utf8');
    const bb = Buffer.from(b.toLowerCase(), 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function resolveConfirmationStore(
  override?: ConfirmationStore | null
): ConfirmationStore {
  if (override) return override;
  return createUnavailableConfirmationStore();
}

export async function createConfirmationRequest(
  input: CreateConfirmationInput,
  store: ConfirmationStore,
  nowMs: number = Date.now()
): Promise<
  | { ok: true; data: CreateConfirmationResult }
  | { ok: false; code: 'CONFIRMATION_STORE_UNAVAILABLE' | 'INVALID_REQUEST'; message: string }
> {
  if (store.kind === 'unavailable') {
    return {
      ok: false,
      code: 'CONFIRMATION_STORE_UNAVAILABLE',
      message:
        'Persistent confirmation store not configured. Memory is not production-safe.'
    };
  }

  if (!requiresConfirmation(input.operation)) {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: 'operation does not require confirmation'
    };
  }

  const org = input.organization_id.trim();
  const condo = input.condominium_id.trim();
  const client = input.client_id.trim();
  const resource = input.resource_id.trim();
  const operation = input.operation.trim();
  if (!org || !condo || !client || !resource || !operation) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'incomplete confirmation binding' };
  }

  const ttl = Math.min(Math.max(input.ttl_seconds ?? DEFAULT_TTL_SECONDS, 30), 3600);
  const confirmation_id = `cnf_${randomBytes(16).toString('hex')}`;
  const confirmation_token = randomBytes(32).toString('hex');
  const created_at = new Date(nowMs).toISOString();
  const expires_at = new Date(nowMs + ttl * 1000).toISOString();
  const operation_fingerprint = confirmationOperationFingerprint({
    organization_id: org,
    condominium_id: condo,
    operation,
    resource_id: resource
  });

  await store.create({
    confirmation_id,
    token_hash: hashConfirmationToken(confirmation_token),
    organization_id: org,
    condominium_id: condo,
    client_id: client,
    requester_identity: input.requester_identity?.trim() || null,
    operation,
    resource_id: resource,
    operation_fingerprint,
    prompt: input.prompt,
    expires_at,
    used_at: null,
    created_at,
    status: 'pending'
  });

  return {
    ok: true,
    data: {
      confirmation_id,
      confirmation_token,
      expires_at,
      operation,
      resource_id: resource,
      prompt: input.prompt,
      organization_id: org,
      condominium_id: condo
    }
  };
}

/**
 * Validate and consume (single-use) a confirmation.
 * Fail-closed on any mismatch.
 */
export async function validateConfirmation(
  input: ValidateConfirmationInput,
  store: ConfirmationStore,
  nowMs: number = Date.now()
): Promise<ValidateConfirmationResult> {
  if (store.kind === 'unavailable') {
    return {
      ok: false,
      code: 'CONFIRMATION_STORE_UNAVAILABLE',
      message: 'Persistent confirmation store not configured'
    };
  }

  const org = input.organization_id.trim();
  const condo = input.condominium_id.trim();
  const scope = { organization_id: org, condominium_id: condo };

  const record = await store.get(input.confirmation_id.trim(), scope);
  if (!record) {
    return { ok: false, code: 'CONFIRMATION_INVALID', message: 'confirmation not found' };
  }

  if (record.used_at || record.status === 'consumed') {
    return {
      ok: false,
      code: 'CONFIRMATION_ALREADY_CONSUMED',
      message: 'confirmation already used'
    };
  }

  if (new Date(record.expires_at).getTime() <= nowMs) {
    return { ok: false, code: 'CONFIRMATION_EXPIRED', message: 'confirmation expired' };
  }

  if (record.organization_id !== org || record.condominium_id !== condo) {
    return {
      ok: false,
      code: 'CONFIRMATION_INVALID',
      message: 'confirmation tenant mismatch'
    };
  }

  if (record.client_id !== input.client_id.trim()) {
    return {
      ok: false,
      code: 'CONFIRMATION_INVALID',
      message: 'confirmation client mismatch'
    };
  }

  if (record.operation !== input.operation.trim()) {
    return {
      ok: false,
      code: 'CONFIRMATION_INVALID',
      message: 'confirmation operation mismatch'
    };
  }

  if (record.resource_id !== input.resource_id.trim()) {
    return {
      ok: false,
      code: 'CONFIRMATION_INVALID',
      message: 'confirmation resource mismatch'
    };
  }

  const expectedFp = confirmationOperationFingerprint({
    organization_id: org,
    condominium_id: condo,
    operation: input.operation.trim(),
    resource_id: input.resource_id.trim()
  });
  if (
    record.operation_fingerprint &&
    !safeEqualHex(record.operation_fingerprint, expectedFp)
  ) {
    return {
      ok: false,
      code: 'CONFIRMATION_INVALID',
      message: 'confirmation fingerprint mismatch'
    };
  }

  const providedHash = hashConfirmationToken(input.confirmation_token.trim());
  if (!safeEqualHex(record.token_hash, providedHash)) {
    return { ok: false, code: 'CONFIRMATION_INVALID', message: 'confirmation token invalid' };
  }

  const usedAt = new Date(nowMs).toISOString();
  const marked = await store.markUsed(record.confirmation_id, usedAt, scope);
  if (!marked) {
    return {
      ok: false,
      code: 'CONFIRMATION_ALREADY_CONSUMED',
      message: 'confirmation already used'
    };
  }

  return {
    ok: true,
    record: { ...record, used_at: usedAt, status: 'consumed' }
  };
}

export { requiresConfirmation } from '../ops/classification';
export { confirmationOperationFingerprint } from './fingerprint';
