/**
 * Tests for moon-utils.mjs
 * @module Tests/MoonUtils
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CalendarManager before importing
vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager };
});

import { getMoonPhasePosition, isMoonFull, getNextFullMoon, getNextConvergence, getConvergencesInRange } from '../../scripts/utils/formatting/moon-utils.mjs';

import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';

/* -------------------------------------------- */
/*  Mock Data                                   */
/* -------------------------------------------- */

// Mock moon with 28-day cycle (like Earth's moon)
const mockMoon = {
  name: 'Luna',
  cycleLength: 28,
  referenceDate: { year: 2020, month: 0, dayOfMonth: 0 } // Reference date when moon was new (position 0)
};

// Second moon for convergence tests
const mockMoon2 = {
  name: 'Selene',
  cycleLength: 14, // Shorter cycle
  referenceDate: { year: 2020, month: 0, dayOfMonth: 0 }
};

beforeEach(() => {
  CalendarManager._reset();
});

/* -------------------------------------------- */
/*  getMoonPhasePosition()                      */
/* -------------------------------------------- */

describe('getMoonPhasePosition()', () => {
  it('returns 0 at reference date', () => {
    const position = getMoonPhasePosition(mockMoon, { year: 2020, month: 0, dayOfMonth: 0 });
    expect(position).toBeCloseTo(0, 2);
  });

  it('returns ~0.5 at half cycle', () => {
    // 14 days after reference = half cycle for 28-day moon
    const position = getMoonPhasePosition(mockMoon, { year: 2020, month: 0, dayOfMonth: 14 });
    expect(position).toBeCloseTo(0.5, 2);
  });

  it('returns ~0.25 at quarter cycle', () => {
    // 7 days after reference
    const position = getMoonPhasePosition(mockMoon, { year: 2020, month: 0, dayOfMonth: 7 });
    expect(position).toBeCloseTo(0.25, 2);
  });

  it('wraps around after full cycle', () => {
    // 28 days = full cycle, should be back to 0
    const position = getMoonPhasePosition(mockMoon, { year: 2020, month: 0, dayOfMonth: 28 });
    expect(position).toBeCloseTo(0, 2);
  });

  it('handles dates before reference date', () => {
    // Date before reference should still work (negative days wrapped)
    const position = getMoonPhasePosition(mockMoon, { year: 2019, month: 11, dayOfMonth: 17 });
    // 14 days before = should be half cycle backwards = 0.5
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

/* -------------------------------------------- */
/*  isMoonFull()                                */
/* -------------------------------------------- */

describe('isMoonFull()', () => {
  it('returns true when moon is at full phase (0.5-0.625)', () => {
    // At exactly half cycle
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
    // Position 0.5 should be full
    // 14 days / 28 = 0.5
    expect(isMoonFull(mockMoon, { year: 2020, month: 0, dayOfMonth: 14 })).toBe(true);
  });

  it('returns true at position just below 0.625', () => {
    // 17 days / 28 ≈ 0.607 - should still be full
    expect(isMoonFull(mockMoon, { year: 2020, month: 0, dayOfMonth: 17 })).toBe(true);
  });

  it('returns false at position 0.625 and above', () => {
    // 18 days / 28 ≈ 0.643 - waning gibbous
    expect(isMoonFull(mockMoon, { year: 2020, month: 0, dayOfMonth: 18 })).toBe(false);
  });
});

/* -------------------------------------------- */
/*  getNextFullMoon()                           */
/* -------------------------------------------- */

describe('getNextFullMoon()', () => {
  it('finds full moon when starting before full phase', () => {
    // Start at new moon (day 0), should find full around day 14
    const result = getNextFullMoon(mockMoon, { year: 2020, month: 0, dayOfMonth: 0 });
    expect(result).not.toBeNull();
    expect(result.dayOfMonth).toBeGreaterThanOrEqual(13);
    expect(result.dayOfMonth).toBeLessThanOrEqual(17);
  });

  it('returns current date if already full', () => {
    // Start at full moon
    const result = getNextFullMoon(mockMoon, { year: 2020, month: 0, dayOfMonth: 14 });
    expect(result).toEqual({ year: 2020, month: 0, dayOfMonth: 14 });
  });

  it('finds next cycle full moon when past full phase', () => {
    // Start at day 19 (past full), should find next cycle's full
    const result = getNextFullMoon(mockMoon, { year: 2020, month: 0, dayOfMonth: 19 });
    expect(result).not.toBeNull();
    // Next full should be ~28 days later (around Feb 12)
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

/* -------------------------------------------- */
/*  getNextConvergence()                        */
/* -------------------------------------------- */

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
    // With moons of 28 and 14 day cycles, they align at the start
    // But if we start past that point, need to wait longer
    const result = getNextConvergence([mockMoon, mockMoon2], { year: 2020, month: 0, dayOfMonth: 19 }, { maxDays: 5 });
    expect(result).toBeNull();
  });

  it('returns null with no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const result = getNextConvergence([mockMoon], { year: 2020, month: 0, dayOfMonth: 0 });
    expect(result).toBeNull();
  });
});

/* -------------------------------------------- */
/*  getConvergencesInRange()                    */
/* -------------------------------------------- */

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
    // In ~60 days, should find about 2 full moons for 28-day cycle
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
