#!/usr/bin/env node
/**
 * G7-F harness — assina request como o n8n faria (sem chamar WhatsApp/n8n real).
 * Uso: node scripts/n8n-harness/sign.mjs --method POST --path /api/v1/operations/packages --body ./fixtures/create_package_text.json
 */

import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const method = (arg('--method', 'GET') || 'GET').toUpperCase();
const pathWithQuery = arg('--path', '/api/v1/health');
const bodyPath = arg('--body', '');
const idem = arg('--idempotency-key', '');
const secret = process.env.SENTINELA_HARNESS_SECRET || 'test-secret-do-not-use-in-prod';
const clientId = process.env.SENTINELA_HARNESS_CLIENT_ID || 'n8n-pilot-test';
const org = process.env.SENTINELA_HARNESS_ORG || '0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928';
const condo = process.env.SENTINELA_HARNESS_CONDO || '3f383313-5ec0-4d21-97c7-1b2500c933be';

let rawBody = '';
if (bodyPath) {
  const parsed = JSON.parse(readFileSync(resolve(bodyPath), 'utf8'));
  const apiBody = parsed.api_body || parsed;
  rawBody = JSON.stringify(apiBody);
}

const timestamp = String(Math.floor(Date.now() / 1000));
const bodySha = createHash('sha256').update(rawBody).digest('hex');
const canonical = [
  'v1',
  timestamp,
  method,
  pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`,
  bodySha,
  org,
  condo,
  idem
].join('\n');
const signature = createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

const headers = {
  'X-Sentinela-Client-Id': clientId,
  'X-Sentinela-Timestamp': timestamp,
  'X-Sentinela-Signature': signature,
  'X-Organization-Id': org,
  'X-Condominium-Id': condo,
  ...(idem ? { 'Idempotency-Key': idem } : {}),
  ...(rawBody ? { 'Content-Type': 'application/json' } : {})
};

console.log(JSON.stringify({ method, path: pathWithQuery, headers, body: rawBody || null, canonical_lines: canonical.split('\n') }, null, 2));
