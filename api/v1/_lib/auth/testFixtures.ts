/**
 * Test helpers for G2 HMAC signing — no secrets logged in assertions beyond fixture ids.
 */

import {
  buildCanonicalString,
  pathWithQueryFromUrl,
  sha256Hex,
  signCanonical
} from './hmac';

export const FIXTURE_ORG_A = '0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928';
export const FIXTURE_CONDO_A = '3f383313-5ec0-4d21-97c7-1b2500c933be';
/** Condo that belongs to a different org (cross-tenant fixture) */
export const FIXTURE_ORG_B = '11111111-1111-1111-1111-111111111111';
export const FIXTURE_CONDO_B = '22222222-2222-2222-2222-222222222222';

export const FIXTURE_CLIENT = {
  client_id: 'n8n-pilot-test',
  secret: 'test-secret-do-not-use-in-prod',
  organization_id: FIXTURE_ORG_A,
  condominium_id: FIXTURE_CONDO_A,
  permission_keys: [
    'packages.create',
    'packages.update',
    'residents.view',
    'occurrences.create',
    'occurrences.update',
    'reservations.create',
    'reservations.delete',
    'boletos.view'
  ]
};

export function signRequest(opts: {
  method: string;
  url: string;
  body?: string;
  timestamp: string;
  organizationId: string;
  condominiumId: string;
  secret?: string;
  idempotencyKey?: string;
}): string {
  const url = new URL(opts.url);
  const body = opts.body ?? '';
  const canonical = buildCanonicalString({
    timestamp: opts.timestamp,
    method: opts.method,
    pathWithQuery: pathWithQueryFromUrl(url),
    bodySha256Hex: sha256Hex(body),
    organizationId: opts.organizationId,
    condominiumId: opts.condominiumId,
    idempotencyKey: opts.idempotencyKey || ''
  });
  return signCanonical(opts.secret ?? FIXTURE_CLIENT.secret, canonical);
}

export function authHeaders(opts: {
  method: string;
  url: string;
  body?: string;
  timestamp?: string;
  organizationId?: string;
  condominiumId?: string;
  clientId?: string;
  secret?: string;
  signature?: string | null;
  idempotencyKey?: string;
  omit?: Array<
    | 'client'
    | 'signature'
    | 'timestamp'
    | 'organization'
    | 'condominium'
  >;
}): Record<string, string> {
  const omit = new Set(opts.omit || []);
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000));
  const organizationId = opts.organizationId ?? FIXTURE_ORG_A;
  const condominiumId = opts.condominiumId ?? FIXTURE_CONDO_A;
  const clientId = opts.clientId ?? FIXTURE_CLIENT.client_id;
  const headers: Record<string, string> = {};

  if (!omit.has('client')) headers['X-Sentinela-Client-Id'] = clientId;
  if (!omit.has('timestamp')) headers['X-Sentinela-Timestamp'] = timestamp;
  if (!omit.has('organization')) headers['X-Organization-Id'] = organizationId;
  if (!omit.has('condominium')) headers['X-Condominium-Id'] = condominiumId;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  if (!omit.has('signature')) {
    headers['X-Sentinela-Signature'] =
      opts.signature === null
        ? ''
        : opts.signature ??
          signRequest({
            method: opts.method,
            url: opts.url,
            body: opts.body,
            timestamp,
            organizationId,
            condominiumId,
            secret: opts.secret,
            idempotencyKey: opts.idempotencyKey
          });
  }

  return headers;
}
