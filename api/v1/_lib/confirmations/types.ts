/**
 * Confirmation contracts (G4)
 *
 * Persistent single-use store = FUTURE MIGRATION / DECISION REQUIRED.
 * In-memory store is TEST_ONLY — never production default.
 */

export type ConfirmationRecord = {
  confirmation_id: string;
  /** Opaque token returned to caller; store hashes it — never log raw in prod */
  token_hash: string;
  organization_id: string;
  condominium_id: string;
  client_id: string;
  /** Optional requester identity (WA phone / actor) */
  requester_identity: string | null;
  operation: string;
  resource_id: string;
  /** Canonical SHA-256 (G6-2 DR5) */
  operation_fingerprint: string;
  /** Human-readable prompt for external channel */
  prompt: string;
  expires_at: string;
  /** Maps to consumed_at in SQL */
  used_at: string | null;
  created_at: string;
  status?: 'pending' | 'consumed';
};

export type CreateConfirmationInput = {
  organization_id: string;
  condominium_id: string;
  client_id: string;
  requester_identity?: string | null;
  operation: string;
  resource_id: string;
  prompt: string;
  /** TTL seconds — default 300 */
  ttl_seconds?: number;
};

export type CreateConfirmationResult = {
  confirmation_id: string;
  /** One-time secret token — return once to caller; never persist plaintext in logs */
  confirmation_token: string;
  expires_at: string;
  operation: string;
  resource_id: string;
  prompt: string;
  organization_id: string;
  condominium_id: string;
};

export type ValidateConfirmationInput = {
  confirmation_id: string;
  confirmation_token: string;
  organization_id: string;
  condominium_id: string;
  client_id: string;
  operation: string;
  resource_id: string;
};

export type ValidateConfirmationFailureCode =
  | 'CONFIRMATION_INVALID'
  | 'CONFIRMATION_EXPIRED'
  | 'CONFIRMATION_ALREADY_USED'
  | 'CONFIRMATION_ALREADY_CONSUMED'
  | 'CONFIRMATION_STORE_UNAVAILABLE';

export type ValidateConfirmationResult =
  | { ok: true; record: ConfirmationRecord }
  | { ok: false; code: ValidateConfirmationFailureCode; message: string };

/**
 * Persistence port for confirmations.
 * Production MUST use durable store (createSupabaseConfirmationStore).
 */
export type ConfirmationTenantScope = {
  organization_id: string;
  condominium_id: string;
};

export type ConfirmationStore = {
  readonly kind: 'persistent' | 'memory_test_only' | 'unavailable';
  create(record: ConfirmationRecord): Promise<void>;
  get(
    confirmationId: string,
    scope?: ConfirmationTenantScope
  ): Promise<ConfirmationRecord | null>;
  /**
   * Atomic consume: pending → consumed.
   * Returns false if already used / expired / missing / tenant mismatch.
   */
  markUsed(
    confirmationId: string,
    usedAtIso: string,
    scope?: ConfirmationTenantScope
  ): Promise<boolean>;
};
