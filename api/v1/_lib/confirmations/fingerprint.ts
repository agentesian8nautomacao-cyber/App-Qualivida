/**
 * Canonical confirmation operation fingerprint (G6-2 DR5).
 * SHA-256 hex of:
 *   sentinela-confirm/v1 \n org \n condo \n operation \n resource_id
 */

import { createHash } from 'crypto';

export function confirmationOperationFingerprint(input: {
  organization_id: string;
  condominium_id: string;
  operation: string;
  resource_id: string;
}): string {
  const canonical = [
    'sentinela-confirm/v1',
    input.organization_id.trim(),
    input.condominium_id.trim(),
    input.operation.trim(),
    input.resource_id.trim()
  ].join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
