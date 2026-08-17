/**
 * SENTINELA API v1 — response envelope
 */

import { ApiErrorCode, httpStatusForCode, sanitizePublicDetails } from './errors';
import { withCors } from './cors';

export type ApiSuccessBody<T> = {
  ok: true;
  success: true;
  request_id: string;
  correlation_id?: string | null;
  operation?: string;
  api_version: 'v1';
  data: T;
};

export type ApiErrorBody = {
  ok: false;
  success: false;
  request_id: string;
  correlation_id?: string | null;
  operation?: string;
  api_version: 'v1';
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function jsonSuccess<T>(
  requestId: string,
  data: T,
  init?: {
    status?: number;
    correlationId?: string | null;
    operation?: string;
  }
): Response {
  const body: ApiSuccessBody<T> = {
    ok: true,
    success: true,
    request_id: requestId,
    api_version: 'v1',
    data
  };
  if (init?.correlationId) body.correlation_id = init.correlationId;
  if (init?.operation) body.operation = init.operation;

  return Response.json(body, {
    status: init?.status ?? 200,
    headers: withCors({
      'Content-Type': 'application/json',
      'X-Request-Id': requestId
    })
  });
}

export function jsonError(
  requestId: string,
  code: ApiErrorCode,
  message: string,
  init?: {
    correlationId?: string | null;
    operation?: string;
    details?: Record<string, unknown>;
    status?: number;
  }
): Response {
  const safeDetails = sanitizePublicDetails(init?.details);
  const body: ApiErrorBody = {
    ok: false,
    success: false,
    request_id: requestId,
    api_version: 'v1',
    error: {
      code,
      message,
      ...(safeDetails ? { details: safeDetails } : {})
    }
  };
  if (init?.correlationId) body.correlation_id = init.correlationId;
  if (init?.operation) body.operation = init.operation;

  return Response.json(body, {
    status: init?.status ?? httpStatusForCode(code),
    headers: withCors({
      'Content-Type': 'application/json',
      'X-Request-Id': requestId
    })
  });
}

export function jsonOptions(): Response {
  return new Response(null, { status: 204, headers: withCors() });
}
