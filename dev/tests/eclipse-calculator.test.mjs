import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import { ECLIPSE_TYPES, getEclipseAtDate, getEclipseOnDate, getEclipsesInRange, getNextEclipse, isEclipseOnDate, isLunarEclipse, isSolarEclipse } from '../../scripts/utils/eclipse-calculator.mjs';

vi.mock('../../scripts/constants.mjs', async (importOriginal) => ({ ...(await importOriginal()) }));
vi.mock('../../scripts/utils/enrichers.mjs', () => ({ handlers: {}, registerEnrichers: vi.fn() }));
vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager };
});

const eclipseMoon = {
  name: 'Luna',
  cycleLength: 28,
  referenceDate: { year: 0, month: 0, dayOfMonth: 0 },
  eclipseMode: 'frequent',
  apparentSize: 1.0
};

const noEclipseMoon = {
  name: 'Luna',
  cycleLength: 28,
  referenceDate: { year: 0, month: 0, dayOfMonth: 0 },
  eclipseMode: 'never'
};

const smallMoon = { ...eclipseMoon, apparentSize: 0.8 };

const customMoon = {
  name: 'Morrslieb',
  cycleLength: 28,
  referenceDate: { year: 0, month: 0, dayOfMonth: 0 },
  eclipseMode: 'custom',
  nodalPeriod: 84
};

const solarDate = { year: 0, month: 0, dayOfMonth: 0 };
const lunarDate = { year: 0, month: 1, dayOfMonth: 11 };
const noEclipseDate = { year: 0, month: 0, dayOfMonth: 7 };

beforeEach(() => {
  CalendarManager._reset();
});

describe('getEclipseAtDate()', () => {
  it('returns null type when eclipseMode is never', () => {
    const result = getEclipseAtDate(noEclipseMoon, solarDate);
    expect(result.type).toBeNull();
  });
  it('returns null type when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const result = getEclipseAtDate(eclipseMoon, solarDate);
    expect(result.type).toBeNull();
  });
  it('returns null type when no moon', () => {
    const result = getEclipseAtDate(null, solarDate);
    expect(result.type).toBeNull();
  });
  it('detects total solar eclipse at new moon in nodal window', () => {
    const result = getEclipseAtDate(eclipseMoon, solarDate);
    expect(result.type).toBe(ECLIPSE_TYPES.TOTAL_SOLAR);
    expect(result.proximity).toBeDefined();
    expect(result.proximity).toBeCloseTo(0, 1);
  });
  it('detects total lunar eclipse at full moon in nodal window', () => {
    const result = getEclipseAtDate(eclipseMoon, lunarDate);
    expect(result.type).toBe(ECLIPSE_TYPES.TOTAL_LUNAR);
  });
  it('returns null type when moon is not at new/full phase', () => {
    const result = getEclipseAtDate(eclipseMoon, noEclipseDate);
    expect(result.type).toBeNull();
  });
  it('returns null type when in new/full phase but outside nodal window', () => {
    const result = getEclipseAtDate(eclipseMoon, { year: 0, month: 0, dayOfMonth: 28 });
    expect(result.type).toBeNull();
  });
  it('returns annular solar eclipse when apparentSize < 1.0', () => {
    const result = getEclipseAtDate(smallMoon, solarDate);
    expect(result.type).toBe(ECLIPSE_TYPES.ANNULAR_SOLAR);
  });
  it('works with custom nodal period', () => {
    const result = getEclipseAtDate(customMoon, solarDate);
    expect(result.type).toBe(ECLIPSE_TYPES.TOTAL_SOLAR);
  });
  it('returns null when custom eclipseMode but no nodalPeriod', () => {
    const brokenMoon = { ...eclipseMoon, eclipseMode: 'custom', nodalPeriod: null };
    const result = getEclipseAtDate(brokenMoon, solarDate);
    expect(result.type).toBeNull();
  });
  it('is deterministic — same inputs always produce same output', () => {
    const r1 = getEclipseAtDate(eclipseMoon, solarDate);
    const r2 = getEclipseAtDate(eclipseMoon, solarDate);
    expect(r1.type).toBe(r2.type);
    expect(r1.proximity).toBe(r2.proximity);
  });
});

describe('isSolarEclipse() / isLunarEclipse()', () => {
  it('correctly identifies solar eclipse types', () => {
    expect(isSolarEclipse(ECLIPSE_TYPES.TOTAL_SOLAR)).toBe(true);
    expect(isSolarEclipse(ECLIPSE_TYPES.PARTIAL_SOLAR)).toBe(true);
    expect(isSolarEclipse(ECLIPSE_TYPES.ANNULAR_SOLAR)).toBe(true);
    expect(isSolarEclipse(ECLIPSE_TYPES.TOTAL_LUNAR)).toBe(false);
    expect(isSolarEclipse(null)).toBe(false);
  });
  it('correctly identifies lunar eclipse types', () => {
    expect(isLunarEclipse(ECLIPSE_TYPES.TOTAL_LUNAR)).toBe(true);
    expect(isLunarEclipse(ECLIPSE_TYPES.PARTIAL_LUNAR)).toBe(true);
    expect(isLunarEclipse(ECLIPSE_TYPES.PENUMBRAL_LUNAR)).toBe(true);
    expect(isLunarEclipse(ECLIPSE_TYPES.TOTAL_SOLAR)).toBe(false);
    expect(isLunarEclipse(null)).toBe(false);
  });
});

describe('getNextEclipse()', () => {
  it('finds eclipse starting from the reference date', () => {
    const result = getNextEclipse(eclipseMoon, solarDate);
    expect(result).not.toBeNull();
    expect(result.type).toBe(ECLIPSE_TYPES.TOTAL_SOLAR);
    expect(result.date).toEqual(solarDate);
  });
  it('finds next eclipse when starting from non-eclipse date', () => {
    const result = getNextEclipse(eclipseMoon, { year: 0, month: 0, dayOfMonth: 1 });
    expect(result).not.toBeNull();
    expect(result.type).toBeDefined();
    expect(result.date).toBeDefined();
  });
  it('returns null when eclipseMode is never', () => {
    const result = getNextEclipse(noEclipseMoon, solarDate);
    expect(result).toBeNull();
  });
  it('returns null when maxDays exceeded', () => {
    const result = getNextEclipse(eclipseMoon, { year: 0, month: 0, dayOfMonth: 10 }, { maxDays: 2 });
    expect(result).toBeNull();
  });
  it('returns null with no moon', () => {
    const result = getNextEclipse(null, solarDate);
    expect(result).toBeNull();
  });
  it('returns null with no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const result = getNextEclipse(eclipseMoon, solarDate);
    expect(result).toBeNull();
  });
});

describe('getEclipsesInRange()', () => {
  it('finds eclipses within a range', () => {
    const start = { year: 0, month: 0, dayOfMonth: 0 };
    const end = { year: 0, month: 2, dayOfMonth: 29 };
    const results = getEclipsesInRange(eclipseMoon, start, end);
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].type).toBeDefined();
    expect(results[0].date).toBeDefined();
  });
  it('returns empty array when eclipseMode is never', () => {
    const start = { year: 0, month: 0, dayOfMonth: 0 };
    const end = { year: 0, month: 11, dayOfMonth: 30 };
    const results = getEclipsesInRange(noEclipseMoon, start, end);
    expect(results).toEqual([]);
  });
  it('returns empty array with no moon', () => {
    const results = getEclipsesInRange(null, solarDate, { year: 0, month: 11, dayOfMonth: 30 });
    expect(results).toEqual([]);
  });
  it('includes both solar and lunar eclipses', () => {
    const start = { year: 0, month: 0, dayOfMonth: 0 };
    const end = { year: 0, month: 2, dayOfMonth: 29 };
    const results = getEclipsesInRange(eclipseMoon, start, end);
    const hasSolar = results.some((r) => isSolarEclipse(r.type));
    const hasLunar = results.some((r) => isLunarEclipse(r.type));
    expect(hasSolar).toBe(true);
    expect(hasLunar).toBe(true);
  });
});

describe('getEclipseOnDate()', () => {
  it('returns eclipse data with moonIndex when eclipse occurs', () => {
    const result = getEclipseOnDate([eclipseMoon], solarDate);
    expect(result).not.toBeNull();
    expect(result.type).toBe(ECLIPSE_TYPES.TOTAL_SOLAR);
    expect(result.moonIndex).toBe(0);
  });
  it('returns null when no eclipse on date', () => {
    const result = getEclipseOnDate([eclipseMoon], noEclipseDate);
    expect(result).toBeNull();
  });
  it('returns null for empty moons array', () => {
    const result = getEclipseOnDate([], solarDate);
    expect(result).toBeNull();
  });
  it('checks all moons and returns first match', () => {
    const result = getEclipseOnDate([noEclipseMoon, eclipseMoon], solarDate);
    expect(result).not.toBeNull();
    expect(result.moonIndex).toBe(1);
  });
});

describe('isEclipseOnDate()', () => {
  it('returns true when eclipse occurs', () => {
    expect(isEclipseOnDate([eclipseMoon], solarDate)).toBe(true);
  });
  it('returns false when no eclipse', () => {
    expect(isEclipseOnDate([eclipseMoon], noEclipseDate)).toBe(false);
  });
  it('returns false for empty moons', () => {
    expect(isEclipseOnDate([], solarDate)).toBe(false);
  });
});

describe('edge cases', () => {
  it('handles very short cycle moons (5 days)', () => {
    const shortMoon = { ...eclipseMoon, cycleLength: 5 };
    const result = getEclipseAtDate(shortMoon, solarDate);
    expect(result.type).toBe(ECLIPSE_TYPES.TOTAL_SOLAR);
  });
  it('handles very long cycle moons (400 days)', () => {
    const longMoon = { ...eclipseMoon, cycleLength: 400 };
    const result = getEclipseAtDate(longMoon, solarDate);
    expect(result.type).toBe(ECLIPSE_TYPES.TOTAL_SOLAR);
  });
  it('handles rare eclipseMode', () => {
    const rareMoon = { ...eclipseMoon, eclipseMode: 'rare' };
    const result = getEclipseAtDate(rareMoon, solarDate);
    expect(result.type).toBe(ECLIPSE_TYPES.TOTAL_SOLAR);
  });
  it('handles occasional eclipseMode', () => {
    const occMoon = { ...eclipseMoon, eclipseMode: 'occasional' };
    const result = getEclipseAtDate(occMoon, solarDate);
    expect(result.type).toBe(ECLIPSE_TYPES.TOTAL_SOLAR);
  });
});
