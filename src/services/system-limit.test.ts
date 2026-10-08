import { describe, expect, it } from 'vitest';
import { calculateAge } from './system-limit.service.js';

describe('calculateAge', () => {
  it('computes a simple whole-year age', () => {
    const dob = new Date(Date.UTC(2000, 5, 15));
    const now = new Date(Date.UTC(2024, 5, 15));
    expect(calculateAge(dob, now)).toBe(24);
  });

  it('has not yet had this year\'s birthday', () => {
    const dob = new Date(Date.UTC(2000, 11, 31));
    const now = new Date(Date.UTC(2024, 0, 1));
    expect(calculateAge(dob, now)).toBe(23);
  });

  it('turns the new age exactly on the birthday', () => {
    const dob = new Date(Date.UTC(2000, 5, 15));
    const now = new Date(Date.UTC(2024, 5, 15));
    expect(calculateAge(dob, now)).toBe(24);
    const dayBefore = new Date(Date.UTC(2024, 5, 14));
    expect(calculateAge(dob, dayBefore)).toBe(23);
  });

  it('handles a leap-day birthday', () => {
    const dob = new Date(Date.UTC(2000, 1, 29));
    const beforeLeapDay = new Date(Date.UTC(2023, 1, 28));
    const afterLeapDay = new Date(Date.UTC(2024, 1, 29));
    expect(calculateAge(dob, beforeLeapDay)).toBe(22);
    expect(calculateAge(dob, afterLeapDay)).toBe(24);
  });
});
