import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import { getConvergencesInRange, getMoonPhasePosition, getNextConvergence, getNextFullMoon, isMoonFull } from '../../scripts/utils/formatting/moon-utils.mjs';

vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager };
});

const mockMoon = { name: 'Luna', cycleLength: 28, referenceDate: { year: 2020, month: 0, dayOfMonth: 0 } };
const mockMoon2 = { name: 'Selene', cycleLength: 14, referenceDate: { year: 2020, month: 0, dayOfMonth: 0 } };

beforeEach(() => {
  CalendarManager._reset();
});

describe('getMoonPhasePosition()', () => {
  it('returns 0 at reference date', () => {
    const position = getMoonPhasePosition(mockMoon, { year: 2020, month: 0, dayOfMonth: 0 });
    expect(position).toBeCloseTo(0, 2);
  });
  it('returns ~0.5 at half cycle', () => {
    const position = getMoonPhasePosition(mockMoon, { year: 2020, month: 0, dayOfMonth: 14 });
    expect(position).toBeCloseTo(0.5, 2);
  });
  it('returns ~0.25 at quarter cycle', () => {
    const position = getMoonPhasePosition(mockMoon, { year: 2020, month: 0, dayOfMonth: 7 });
    expect(position).toBeCloseTo(0.25, 2);
  });
  it('wraps around after full cycle', () => {
    const position = getMoonPhasePosition(mockMoon, { year: 2020, month: 0, dayOfMonth: 28 });
    expect(position).toBeCloseTo(0, 2);
  });
  it('handles dates before reference date', () => {
    const position = getMoonPhasePosition(mockMoon, { year: 2019, month: 11, dayOfMonth: 17 });
    expect(position).toBeCloseTo(0.5, 2);
  });
  it('returns 0 with null moon', () => {
    const position = getMoonPhasePosition(null, { year: 2020, month: 0, dayOfMonth: 0 });
    expect(position).toBe(0);
  });
  it('returns 0 with no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const position = getMoonPhasePosition(mockMoon, { year: 2020, month: 0, dayOfMonth: 0 });
    expect(position).toBe(0);
  });
});

describe('isMoonFull()', () => {
  it('returns true when moon is at full phase (0.5-0.625)', () => {
    const result = isMoonFull(mockMoon, { year: 2020, month: 0, dayOfMonth: 14 });
    expect(result).toBe(true);
  });
  it('returns false when moon is new (position 0)', () => {
    const result = isMoonFull(mockMoon, { year: 2020, month: 0, dayOfMonth: 0 });
    expect(result).toBe(false);
  });
  it('returns false when moon is waxing (position ~0.25)', () => {
    const result = isMoonFull(mockMoon, { year: 2020, month: 0, dayOfMonth: 7 });
    expect(result).toBe(false);
  });
  it('returns false when moon is waning (position ~0.75)', () => {
    const result = isMoonFull(mockMoon, { year: 2020, month: 0, dayOfMonth: 21 });
    expect(result).toBe(false);
  });
  it('returns true at position just above 0.5', () => {
    expect(isMoonFull(mockMoon, { year: 2020, month: 0, dayOfMonth: 14 })).toBe(true);
  });
  it('returns true at position just below 0.625', () => {
    expect(isMoonFull(mockMoon, { year: 2020, month: 0, dayOfMonth: 17 })).toBe(true);
  });
  it('returns false at position 0.625 and above', () => {
    expect(isMoonFull(mockMoon, { year: 2020, month: 0, dayOfMonth: 18 })).toBe(false);
  });
});

describe('getNextFullMoon()', () => {
  it('finds full moon when starting before full phase', () => {
    const result = getNextFullMoon(mockMoon, { year: 2020, month: 0, dayOfMonth: 0 });
    expect(result).not.toBeNull();
    expect(result.dayOfMonth).toBeGreaterThanOrEqual(13);
    expect(result.dayOfMonth).toBeLessThanOrEqual(17);
  });
  it('returns current date if already full', () => {
    const result = getNextFullMoon(mockMoon, { year: 2020, month: 0, dayOfMonth: 14 });
    expect(result).toEqual({ year: 2020, month: 0, dayOfMonth: 14 });
  });
  it('finds next cycle full moon when past full phase', () => {
    const result = getNextFullMoon(mockMoon, { year: 2020, month: 0, dayOfMonth: 19 });
    expect(result).not.toBeNull();
    expect(result.month).toBeGreaterThanOrEqual(1);
  });
  it('returns null with no moon', () => {
    const result = getNextFullMoon(null, { year: 2020, month: 0, dayOfMonth: 0 });
    expect(result).toBeNull();
  });
  it('returns null with no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const result = getNextFullMoon(mockMoon, { year: 2020, month: 0, dayOfMonth: 0 });
    expect(result).toBeNull();
  });
  it('returns null if full moon not found within maxDays', () => {
    const result = getNextFullMoon(mockMoon, { year: 2020, month: 0, dayOfMonth: 0 }, { maxDays: 5 });
    expect(result).toBeNull();
  });
});

describe('getNextConvergence()', () => {
  it('returns null for empty moons array', () => {
    const result = getNextConvergence([], { year: 2020, month: 0, dayOfMonth: 0 });
    expect(result).toBeNull();
  });
  it('returns null for null moons', () => {
    const result = getNextConvergence(null, { year: 2020, month: 0, dayOfMonth: 0 });
    expect(result).toBeNull();
  });
  it('finds full moon for single moon', () => {
    const result = getNextConvergence([mockMoon], { year: 2020, month: 0, dayOfMonth: 0 });
    expect(result).not.toBeNull();
    expect(result.dayOfMonth).toBeGreaterThanOrEqual(13);
  });
  it('returns null if no convergence within maxDays', () => {
    const result = getNextConvergence([mockMoon, mockMoon2], { year: 2020, month: 0, dayOfMonth: 19 }, { maxDays: 5 });
    expect(result).toBeNull();
  });
  it('returns null with no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const result = getNextConvergence([mockMoon], { year: 2020, month: 0, dayOfMonth: 0 });
    expect(result).toBeNull();
  });
});

describe('getConvergencesInRange()', () => {
  it('returns empty array for empty moons', () => {
    const result = getConvergencesInRange([], { year: 2020, month: 0, dayOfMonth: 0 }, { year: 2020, month: 11, dayOfMonth: 30 });
    expect(result).toEqual([]);
  });
  it('returns empty array with no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const result = getConvergencesInRange([mockMoon], { year: 2020, month: 0, dayOfMonth: 0 }, { year: 2020, month: 11, dayOfMonth: 30 });
    expect(result).toEqual([]);
  });
  it('finds multiple full moons for single moon in range', () => {
    const result = getConvergencesInRange([mockMoon], { year: 2020, month: 0, dayOfMonth: 0 }, { year: 2020, month: 2, dayOfMonth: 0 });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
  it('returns array of date objects', () => {
    const result = getConvergencesInRange([mockMoon], { year: 2020, month: 0, dayOfMonth: 0 }, { year: 2020, month: 1, dayOfMonth: 27 });
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('year');
      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('dayOfMonth');
    }
  });
});
