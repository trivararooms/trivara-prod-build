import { describe, it, expect } from 'vitest';
import { toDateOnly, formatINR, cn } from './utils';

describe('toDateOnly', () => {
  it('formats a local date as YYYY-MM-DD without shifting days', () => {
    // Regression guard: bookings are stored as DATE columns. If this ever
    // went through `.toISOString()` instead, a date picked in a timezone
    // ahead of UTC could roll back a day once serialized.
    const date = new Date(2026, 0, 31); // Jan 31, 2026, local midnight
    expect(toDateOnly(date)).toBe('2026-01-31');
  });

  it('pads single-digit months and days', () => {
    const date = new Date(2026, 2, 5); // March 5, 2026
    expect(toDateOnly(date)).toBe('2026-03-05');
  });
});

describe('formatINR', () => {
  it('formats a whole number as Indian Rupees with no decimal places', () => {
    expect(formatINR(1500)).toBe('₹1,500');
  });

  it('formats zero', () => {
    expect(formatINR(0)).toBe('₹0');
  });

  it('uses Indian digit grouping for large numbers', () => {
    // 1,00,000 not 100,000 - this is what `en-IN` grouping should produce.
    expect(formatINR(100000)).toBe('₹1,00,000');
  });
});

describe('cn', () => {
  it('merges class names and resolves Tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});
