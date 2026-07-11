import { describe, expect, it } from 'vitest';
import { validateTicketKey } from './ticketValidation';

describe('validateTicketKey', () => {
  it('accepts valid ticket keys', () => {
    expect(validateTicketKey('OPL-1234')).toBeUndefined();
  });

  it('rejects invalid characters', () => {
    expect(validateTicketKey('bad key!')).toBeTruthy();
  });
});
