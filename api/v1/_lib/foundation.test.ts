/**
 * SENTINELA API v1 — foundation unit tests (Etapa 4 / G1)
 */

import { describe, expect, it } from 'vitest';
import { ApiErrorCodes, httpStatusForCode } from './errors';
import { FOUNDATION_GATES, isWriteEnabled, isAuthnEnabled } from './gates';
import { probeOperationalCore } from './coreProbe';
import { extractRequestIds, newRequestId } from './requestIds';
import { jsonError, jsonSuccess } from './response';
import health from './handlers/health';
import packagesCreate from './handlers/operations/packages/index';
import packagesPickup from './handlers/operations/packages/pickup';

describe('sentinela api v1 foundation gates', () => {
  it('keeps G2–G5 flags; G7-B store wiring flags true; n8n/whatsapp false', () => {
    expect(FOUNDATION_GATES.g1_foundation).toBe(true);
    expect(FOUNDATION_GATES.writes_enabled).toBe(true);
    expect(FOUNDATION_GATES.g2_authn_hmac).toBe(true);
    expect(FOUNDATION_GATES.g2_tenant_fail_closed).toBe(true);
    expect(FOUNDATION_GATES.g3_authz_ops).toBe(true);
    expect(FOUNDATION_GATES.g4_sensitive_confirmation).toBe(true);
    expect(FOUNDATION_GATES.g5_core_execution).toBe(true);
    expect(FOUNDATION_GATES.confirmation_persistent_store).toBe(true);
    expect(FOUNDATION_GATES.idempotency_store).toBe(true);
    expect(FOUNDATION_GATES.sensitive_execution_enabled).toBe(true);
    expect(FOUNDATION_GATES.n8n).toBe(false);
    expect(FOUNDATION_GATES.whatsapp).toBe(false);
    expect(isWriteEnabled()).toBe(true);
    expect(isAuthnEnabled()).toBe(true);
  });

  it('maps GATE_PENDING to 501', () => {
    expect(httpStatusForCode(ApiErrorCodes.GATE_PENDING)).toBe(501);
    expect(httpStatusForCode(ApiErrorCodes.WRITES_DISABLED)).toBe(501);
  });
});

describe('sentinela api v1 envelope', () => {
  it('generates request ids', () => {
    expect(newRequestId().startsWith('req_')).toBe(true);
  });

  it('prefers incoming X-Request-Id', () => {
    const req = new Request('http://localhost/api/v1/health', {
      headers: {
        'X-Request-Id': 'req_fixed',
        'X-Correlation-Id': 'cor_1'
      }
    });
    const ids = extractRequestIds(req);
    expect(ids.request_id).toBe('req_fixed');
    expect(ids.correlation_id).toBe('cor_1');
  });

  it('builds success and error envelopes', async () => {
    const ok = jsonSuccess('req_a', { ping: true }, { operation: 'health' });
    const okBody = await ok.json();
    expect(okBody.success).toBe(true);
    expect(okBody.api_version).toBe('v1');
    expect(okBody.data.ping).toBe(true);

    const err = jsonError('req_b', ApiErrorCodes.GATE_PENDING, 'pending', {
      operation: 'create_package'
    });
    expect(err.status).toBe(501);
    const errBody = await err.json();
    expect(errBody.success).toBe(false);
    expect(errBody.error.code).toBe('GATE_PENDING');
  });

  it('does not set Access-Control-Allow-Origin *', async () => {
    const res = jsonSuccess('req_c', {});
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('sentinela api v1 core probe', () => {
  it('reaches Operational Core without DB', () => {
    const probe = probeOperationalCore();
    expect(probe.core_reachable).toBe(true);
    expect(probe.identify_resident).toBe(true);
    expect(probe.identify_unit).toBe(true);
  });
});

describe('sentinela api v1 HTTP handlers', () => {
  it('GET /api/v1/health returns foundation status', async () => {
    const res = await health.fetch(
      new Request('http://localhost/api/v1/health', { method: 'GET' })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.stage).toBe('ETAPA_G7_H_B_N8N_PILOT');
    expect(body.data.gates.writes_enabled).toBe(true);
    expect(body.data.gates.g2_authn_hmac).toBe(true);
    expect(body.data.gates.g5_core_execution).toBe(true);
    expect(body.data.gates.idempotency_store).toBe(true);
    expect(body.data.gates.confirmation_persistent_store).toBe(true);
    expect(body.data.core.core_reachable).toBe(true);
    expect(body.data.boundaries.database_changes).toBe(0);
    expect(body.ok).toBe(true);
    expect(body.data.boundaries.next_gate).toBeTruthy();
    expect(body.data.boundaries.n8n).toBe(0);
    expect(body.data.boundaries.whatsapp).toBe(0);
  });

  it('POST packages without auth is blocked (G2)', async () => {
    const res = await packagesCreate.fetch(
      new Request('http://localhost/api/v1/operations/packages', {
        method: 'POST',
        body: JSON.stringify({ recipient: 'Paulo' })
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST pickup without auth is blocked (G2)', async () => {
    const res = await packagesPickup.fetch(
      new Request('http://localhost/api/v1/operations/packages/pickup', {
        method: 'POST'
      })
    );
    expect(res.status).toBe(401);
  });

  it('rejects wrong method on health', async () => {
    const res = await health.fetch(
      new Request('http://localhost/api/v1/health', { method: 'POST' })
    );
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
  });
});
