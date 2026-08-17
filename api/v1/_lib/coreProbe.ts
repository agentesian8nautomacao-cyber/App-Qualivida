/**
 * SENTINELA API v1 — Core import probe (no DB, no writes)
 * Proves Operational Core is reachable from the API layer.
 */

import { identifyResident, identifyUnit } from '../../../sentinela/core';

export type CoreProbeResult = {
  core_reachable: boolean;
  identify_resident: boolean;
  identify_unit: boolean;
  sample_match_strategy?: string;
  error?: string;
};

/**
 * Pure Core call with empty catalog — no persistence, no Supabase.
 */
export function probeOperationalCore(): CoreProbeResult {
  try {
    const idRes = identifyResident({ residents: [], phone: '+5500000000000' }, { channel: 'system' });
    const unitRes = identifyUnit({ unit: '3-5' }, { channel: 'system' });

    return {
      core_reachable: true,
      identify_resident: typeof idRes.success === 'boolean',
      identify_unit: unitRes.success === true,
      sample_match_strategy:
        idRes.success && idRes.data ? idRes.data.matchStrategy : 'none'
    };
  } catch (err: unknown) {
    return {
      core_reachable: false,
      identify_resident: false,
      identify_unit: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
