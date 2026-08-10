import { describe, it, expect } from 'vitest';
import { normalizeUnit, compareUnits } from './unitFormatter';

describe('unitFormatter', () => {
  describe('normalizeUnit', () => {
    it('normalizes unit strings', () => {
      expect(normalizeUnit('101')).toBeTruthy();
      expect(normalizeUnit(' 102 ').trim().length).toBeGreaterThan(0);
    });
  });

  describe('compareUnits', () => {
    it('returns true when units are equal', () => {
      expect(compareUnits('101', '101')).toBe(true);
    });
    it('returns false when units differ', () => {
      expect(compareUnits('101', '102')).toBe(false);
    });
  });
});
