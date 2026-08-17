/**
 * SENTINELA AUT — Operational Core types
 * Independent of React / DOM / WhatsApp / n8n.
 */

export type OperationChannel = 'panel' | 'voice' | 'qr' | 'photo' | 'import' | 'system' | 'whatsapp_future';

export type OperationErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_TIME_RANGE'
  | 'NOT_FOUND'
  | 'AUTHORIZATION_ERROR'
  | 'DUPLICATE'
  | 'CONFLICT'
  | 'OPERATIONAL_ERROR'
  | 'CLARIFICATION_REQUIRED'
  | 'TENANT_CONTEXT_ABSENT';

export interface OperationContext {
  channel: OperationChannel;
  actorAuthUserId?: string | null;
  actorMembershipId?: string | null;
  /** Optional until app is wired to M1–M4; accepted when present. */
  organizationId?: string | null;
  condominiumId?: string | null;
  actorDisplayName?: string | null;
  actorRole?: string | null;
}

export interface OperationError {
  code: OperationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface DomainEvent {
  type: string;
  at: string;
  organizationId?: string | null;
  condominiumId?: string | null;
  payload: Record<string, unknown>;
}

export interface OperationNotificationIntent {
  /** Inbox notification already handled by adapter when true */
  channel: 'inbox' | 'whatsapp_future' | 'panel_toast';
  residentId?: string;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
}

export type OperationResult<T = unknown> =
  | {
      success: true;
      data: T;
      events: DomainEvent[];
      notifications: OperationNotificationIntent[];
      warnings?: string[];
    }
  | {
      success: false;
      error: OperationError;
      events?: DomainEvent[];
      notifications?: OperationNotificationIntent[];
      warnings?: string[];
    };

export function ok<T>(
  data: T,
  opts?: {
    events?: DomainEvent[];
    notifications?: OperationNotificationIntent[];
    warnings?: string[];
  }
): OperationResult<T> {
  return {
    success: true,
    data,
    events: opts?.events ?? [],
    notifications: opts?.notifications ?? [],
    warnings: opts?.warnings
  };
}

export function fail(
  code: OperationErrorCode,
  message: string,
  details?: Record<string, unknown>
): OperationResult<never> {
  return {
    success: false,
    error: { code, message, details },
    events: [],
    notifications: []
  };
}

export function makeEvent(
  type: string,
  ctx: OperationContext,
  payload: Record<string, unknown>
): DomainEvent {
  return {
    type,
    at: new Date().toISOString(),
    organizationId: ctx.organizationId ?? null,
    condominiumId: ctx.condominiumId ?? null,
    payload
  };
}
