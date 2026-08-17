/**
 * n8n Code node — Generate HMAC for Sentinela API v1
 *
 * Local n8n (piloto) requires:
 *   N8N_BLOCK_ENV_ACCESS_IN_NODE=false
 *   NODE_FUNCTION_ALLOW_BUILTIN=crypto
 *
 * Credentials from env — NEVER hardcode secrets.
 * Input $json: method, path, body?, idempotencyKey?, auth? (false = public)
 */

const method = String($json.method || 'GET').toUpperCase();
const pathWithQuery = String($json.path || '/api/v1/health');
const bodyObj = $json.body;
const body =
  bodyObj === undefined || bodyObj === null
    ? ''
    : typeof bodyObj === 'string'
      ? bodyObj
      : JSON.stringify(bodyObj);
const idempotencyKey = String($json.idempotencyKey || '');
const baseUrl = String($json.baseUrl || $env.SENTINELA_PILOT_BASE || 'http://127.0.0.1:3099');
const requestId = String($json.requestId || `n8n-${Date.now()}`);

if ($json.auth === false) {
  return [
    {
      json: {
        ...$json,
        method,
        path: pathWithQuery,
        body,
        url: `${baseUrl}${pathWithQuery}`,
        headers: { 'X-Request-Id': requestId },
        meta: { canonical_version: 'v1', auth: false }
      }
    }
  ];
}

const nodeCrypto = require('crypto');
const secret = $env.SENTINELA_N8N_SECRET || $env.SENTINELA_HARNESS_SECRET;
const clientId = $env.SENTINELA_N8N_CLIENT_ID || $env.SENTINELA_HARNESS_CLIENT_ID;
const org = $env.SENTINELA_N8N_ORGANIZATION_ID || $env.SENTINELA_HARNESS_ORG;
const condo = $env.SENTINELA_N8N_CONDOMINIUM_ID || $env.SENTINELA_HARNESS_CONDO;

if (!secret || !clientId || !org || !condo) {
  throw new Error('Missing Sentinela n8n credential env vars');
}

const timestamp = String(Math.floor(Date.now() / 1000));
const bodySha = nodeCrypto.createHash('sha256').update(body).digest('hex');
const canonical = ['v1', timestamp, method, pathWithQuery, bodySha, org, condo, idempotencyKey].join('\n');
const signature = nodeCrypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

return [
  {
    json: {
      ...$json,
      method,
      path: pathWithQuery,
      body,
      url: `${baseUrl}${pathWithQuery}`,
      headers: {
        'X-Sentinela-Client-Id': clientId,
        'X-Sentinela-Timestamp': timestamp,
        'X-Sentinela-Signature': signature,
        'X-Organization-Id': org,
        'X-Condominium-Id': condo,
        'X-Request-Id': requestId,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      meta: { canonical_version: 'v1', body_sha256: bodySha }
    }
  }
];
