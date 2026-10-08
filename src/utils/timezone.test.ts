import { describe, expect, it } from 'vitest';
import { isValidTimeZone, localDateTimeToUtc } from './timezone.js';

describe('isValidTimeZone', () => {
  it('accepts a real IANA timezone', () => {
    expect(isValidTimeZone('Africa/Johannesburg')).toBe(true);
  });

  it('rejects a bogus timezone name', () => {
    expect(isValidTimeZone('Not/ARealZone')).toBe(false);
  });
});

describe('localDateTimeToUtc', () => {
  it('converts a local wall-clock time to the correct UTC instant', () => {
    // Africa/Johannesburg is UTC+2 with no DST.
    const result = localDateTimeToUtc('2024-06-10', '09:00', 'Africa/Johannesburg');
    expect(result?.toISOString()).toBe('2024-06-10T07:00:00.000Z');
  });

  it('accounts for daylight saving time in a DST-observing zone', () => {
    // America/New_York is UTC-4 in June (EDT) and UTC-5 in January (EST).
    const summer = localDateTimeToUtc('2024-06-10', '09:00', 'America/New_York');
    const winter = localDateTimeToUtc('2024-01-10', '09:00', 'America/New_York');
    expect(summer?.toISOString()).toBe('2024-06-10T13:00:00.000Z');
    expect(winter?.toISOString()).toBe('2024-01-10T14:00:00.000Z');
  });

  it('returns undefined for an invalid timezone', () => {
    expect(localDateTimeToUtc('2024-06-10', '09:00', 'Not/ARealZone')).toBeUndefined();
  });

  it('returns undefined for a malformed date string', () => {
    expect(localDateTimeToUtc('10-06-2024', '09:00', 'UTC')).toBeUndefined();
  });

  it('returns undefined for a malformed time string', () => {
    expect(localDateTimeToUtc('2024-06-10', '9am', 'UTC')).toBeUndefined();
  });

  it('returns undefined for an out-of-range time', () => {
    expect(localDateTimeToUtc('2024-06-10', '24:00', 'UTC')).toBeUndefined();
  });
});
