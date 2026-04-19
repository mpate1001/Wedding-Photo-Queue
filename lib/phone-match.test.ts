import { describe, it, expect } from 'vitest';
import { normalizePhone, phonesMatch } from './phone-match';

describe('normalizePhone', () => {
  it('strips non-digits and returns last 10 digits for US number', () => {
    expect(normalizePhone('+12566584291')).toBe('2566584291');
  });

  it('handles formatted US number', () => {
    expect(normalizePhone('(256) 658-4291')).toBe('2566584291');
  });

  it('handles international number (UK +44)', () => {
    expect(normalizePhone('+447700900123')).toBe('7700900123');
  });

  it('handles international number with more than 10 significant digits', () => {
    expect(normalizePhone('+919876543210')).toBe('9876543210');
  });

  it('returns null for malformed (too few digits)', () => {
    expect(normalizePhone('abc123')).toBeNull();
    expect(normalizePhone('555')).toBeNull();
  });

  it('returns null for empty/null input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
  });

  it('handles trailing whitespace and special chars', () => {
    expect(normalizePhone('  +1 (256) 658-4291  ')).toBe('2566584291');
  });
});

describe('phonesMatch', () => {
  it('matches same number in different formats', () => {
    expect(phonesMatch('+12566584291', '(256) 658-4291')).toBe(true);
  });

  it('matches US and international representations of same last-10', () => {
    expect(phonesMatch('+12566584291', '+442566584291')).toBe(true);
  });

  it('does not match different numbers', () => {
    expect(phonesMatch('+12566584291', '+19783193978')).toBe(false);
  });

  it('does not match when one side is unparseable', () => {
    expect(phonesMatch('abc', '+12566584291')).toBe(false);
  });

  it('does not match two unparseable inputs', () => {
    expect(phonesMatch('abc', 'xyz')).toBe(false);
  });
});
