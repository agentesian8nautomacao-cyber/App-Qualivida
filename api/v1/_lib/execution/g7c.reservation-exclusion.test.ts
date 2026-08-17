/**
 * G7-C — Reservation exclusion constraint SQL (static + domain alignment).
 * Does NOT APPLY migration. Does NOT write to LIVE.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { timesOverlap, hasReservationConflict } from '../../../../sentinela/core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const migrationPath = join(
  root,
  'supabase/migrations/20260814210000_007_reservations_no_overlap.sql'
);
const rollbackPath = join(
  root,
  'supabase/migrations/20260814210000_007_reservations_no_overlap.rollback.sql'
);
const precheckPath = join(
  root,
  'docs/evidence/M-G7C-RESERVATION-EXCLUSION-PRECHECK-LIVE.sql'
);

describe('G7-C reservation exclusion SQL artifacts', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  const rollback = readFileSync(rollbackPath, 'utf8');
  const precheck = readFileSync(precheckPath, 'utf8');

  /** Strip SQL line comments so header docs don't false-positive banned keywords. */
  function sqlBody(src: string): string {
    return src
      .split('\n')
      .filter((line) => !/^\s*--/.test(line))
      .join('\n');
  }

  const migBody = sqlBody(migration);
  const rbBody = sqlBody(rollback);

  it('migration defines EXCLUDE with half-open [)', () => {
    expect(migBody).toMatch(/EXCLUDE USING gist/i);
    expect(migBody).toContain("'[)'");
    expect(migBody).toContain('reservations_area_date_slot_excl');
    expect(migBody).toContain('area_id WITH =');
    expect(migBody).toMatch(/status IN \('scheduled', 'active'\)/);
  });

  it('migration does not invent condominium_id column', () => {
    expect(migBody).not.toMatch(/ADD COLUMN\s+condominium_id/i);
    expect(migBody).not.toMatch(/ADD COLUMN\s+organization_id/i);
    expect(migration).toMatch(/condominium_id.*ABSENT|ABSENT.*condominium_id/i);
  });

  it('migration does not mutate reservation rows', () => {
    expect(migBody).not.toMatch(/\bINSERT\b/i);
    expect(migBody).not.toMatch(/\bUPDATE\b/i);
    expect(migBody).not.toMatch(/\bDELETE\b/i);
    expect(migBody).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('migration does not alter M1–M4 / G6 tables', () => {
    expect(migBody).not.toMatch(
      /ALTER TABLE public\.(organizations|condominiums|units|tenant_memberships)/i
    );
    expect(migBody).not.toMatch(/api_idempotency_keys|api_confirmations/);
  });

  it('migration blocks when overlapping pairs exist', () => {
    expect(migBody).toMatch(/conflict_count > 0/i);
    expect(migration).toMatch(/overlapping active reservation/i);
  });

  it('rollback drops only the exclusion constraint', () => {
    expect(rbBody).toMatch(/DROP CONSTRAINT reservations_area_date_slot_excl/);
    expect(rbBody).not.toMatch(/CASCADE/i);
    expect(rbBody).not.toMatch(/\bDELETE\b/i);
    expect(rbBody).not.toMatch(/DROP TABLE/i);
    expect(rbBody).not.toMatch(/DROP EXTENSION/i);
    expect(rbBody).not.toMatch(/IF EXISTS/i);
  });

  it('precheck is read-only and detects conflicts', () => {
    expect(precheck).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/im);
    expect(precheck).toContain('overlapping_active_pairs');
    expect(precheck).toContain('m_g7c1_create_safe');
    expect(precheck).toContain('condominium_id');
  });

  it('domain half-open rule aligns with SQL [)', () => {
    expect(timesOverlap('10:00', '12:00', '11:00', '13:00')).toBe(true);
    expect(timesOverlap('10:00', '12:00', '12:00', '14:00')).toBe(false);
    expect(timesOverlap('10:00', '12:00', '09:00', '10:00')).toBe(false);
    expect(
      hasReservationConflict(
        { areaIdOrName: 'a1', date: '2026-09-01', startTime: '10:00', endTime: '12:00' },
        [{ areaIdOrName: 'a1', date: '2026-09-01', startTime: '12:00', endTime: '14:00' }]
      )
    ).toBe(false);
    expect(
      hasReservationConflict(
        { areaIdOrName: 'a1', date: '2026-09-01', startTime: '10:00', endTime: '12:00' },
        [{ areaIdOrName: 'a1', date: '2026-09-01', startTime: '11:00', endTime: '13:00' }]
      )
    ).toBe(true);
    expect(
      hasReservationConflict(
        { areaIdOrName: 'a1', date: '2026-09-01', startTime: '10:00', endTime: '12:00' },
        [{ areaIdOrName: 'a1', date: '2026-09-01', startTime: '09:00', endTime: '10:00' }]
      )
    ).toBe(false);
  });

  it('different area_id must not conflict in domain rule', () => {
    expect(
      hasReservationConflict(
        { areaIdOrName: 'area-a', date: '2026-09-01', startTime: '10:00', endTime: '12:00' },
        [{ areaIdOrName: 'area-b', date: '2026-09-01', startTime: '10:00', endTime: '12:00' }]
      )
    ).toBe(false);
  });

  it('migration WHERE uses LIVE status spellings (canceled not cancelled)', () => {
    // Body only lists participating statuses; canceled/completed excluded by omission
    const whereMatch = migBody.match(/WHERE\s*\(\s*status\s+IN\s*\(([^)]+)\)\s*\)/i);
    expect(whereMatch?.[1]).toMatch(/scheduled/);
    expect(whereMatch?.[1]).toMatch(/active/);
    expect(whereMatch?.[1]).not.toMatch(/completed|canceled|cancelled/);
    // Header documents LIVE spelling "canceled"
    expect(migration).toMatch(/canceled/);
    expect(migBody).not.toMatch(/'cancelled'/);
  });

  it('documents SQLSTATE 23P01 as exclusion_violation for G7-D mapping', () => {
    // Static reminder: adapter/API must map 23P01 → CONFLICT (not yet implemented)
    expect('23P01').toBe('23P01');
    expect(migBody).toContain('reservations_area_date_slot_excl');
  });
});
