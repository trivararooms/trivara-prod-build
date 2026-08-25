import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('extracts the message from a real Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns a plain string as-is', () => {
    expect(getErrorMessage('something went wrong')).toBe('something went wrong');
  });

  it('extracts .message from a Supabase-style error-like object', () => {
    expect(getErrorMessage({ message: 'row not found', code: 'PGRST116' })).toBe('row not found');
  });

  it('falls back to the default message for unrecognized shapes', () => {
    expect(getErrorMessage(42)).toBe('An unexpected error occurred');
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
  });

  it('supports a custom fallback message', () => {
    expect(getErrorMessage({}, 'Payment failed')).toBe('Payment failed');
  });
});
