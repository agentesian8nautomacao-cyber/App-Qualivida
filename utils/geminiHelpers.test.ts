import { describe, it, expect } from 'vitest';
import { extractGeminiText } from './geminiHelpers';

describe('extractGeminiText', () => {
  it('returns empty string for null/undefined', () => {
    expect(extractGeminiText(null)).toBe('');
    expect(extractGeminiText(undefined)).toBe('');
  });

  it('returns .text when string', () => {
    expect(extractGeminiText({ text: 'hello' })).toBe('hello');
  });

  it('returns result of .text() when function', () => {
    expect(extractGeminiText({ text: () => 'fn' })).toBe('fn');
  });

  it('extracts from candidates[0].content.parts', () => {
    const res = {
      candidates: [{ content: { parts: [{ text: 'from-parts' }] } }]
    };
    expect(extractGeminiText(res)).toBe('from-parts');
  });

  it('returns empty string when no text found', () => {
    expect(extractGeminiText({})).toBe('');
    expect(extractGeminiText({ candidates: [] })).toBe('');
  });
});
