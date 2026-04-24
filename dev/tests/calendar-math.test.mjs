import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import {
  checkSolsticeOrEquinox,
  findSeasonIndexByType,
  getCalendarMoonPhaseIndex,
  getCycleValue,
  getDayOfYear,
  getEraIndex,
  getEraYear,
  getLastDayOfMonth,
  getMidpoint,
  getMoonPhaseCountInMonth,
  getSeasonDay,
  getSeasonDayOfYearBounds,
  getSeasonIndex,
  getSeasonPercent,
  getTotalDaysInYear,
  getTotalDaysSinceEpoch,
  isInSeasonRange,
  seededRandom
} from '../../scripts/utils/calendar-math.mjs';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager, defaultCalendar } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager, defaultCalendar };
});

beforeEach(() => {
  CalendarManager._reset();
});

describe('seededRandom()', () => {
  it('returns deterministic values for same inputs', () => {
    const a = seededRandom(42, 2026, 100);
    const b = seededRandom(42, 2026, 100);
    expect(a).toBe(b);
  });
  it('returns different values for different seeds', () => {
    const a = seededRandom(1, 2026, 100);
    const b = seededRandom(2, 2026, 100);
    expect(a).not.toBe(b);
  });
  it('returns values in [0, 99.99] range', () => {
    for (let i = 0; i < 100; i++) {
      const val = seededRandom(i, i * 3, i * 7);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(99.99);
    }
  });
  it('returns different values for different days', () => {
    const a = seededRandom(42, 2026, 1);
    const b = seededRandom(42, 2026, 2);
    expect(a).not.toBe(b);
  });
});

describe('getDayOfYear()', () => {
  it('returns 0 for Jan 1', () => {
    expect(getDayOfYear({ year: 0, month: 0, dayOfMonth: 0 })).toBe(0);
  });
  it('returns 31 for Feb 1', () => {
    expect(getDayOfYear({ year: 0, month: 1, dayOfMonth: 0 })).toBe(31);
  });
  it('returns 364 for Dec 31', () => {
    expect(getDayOfYear({ year: 0, month: 11, dayOfMonth: 30 })).toBe(364);
  });
  it('returns 59 for Mar 1 (non-leap)', () => {
    expect(getDayOfYear({ year: 0, month: 2, dayOfMonth: 0 })).toBe(59);
  });
});

describe('getLastDayOfMonth()', () => {
  it('returns 31 for January', () => {
    expect(getLastDayOfMonth({ year: 0, month: 0 })).toBe(31);
  });
  it('returns 28 for February (non-leap)', () => {
    expect(getLastDayOfMonth({ year: 1, month: 1 })).toBe(28);
  });
  it('returns 30 for April', () => {
    expect(getLastDayOfMonth({ year: 0, month: 3 })).toBe(30);
  });
});

describe('getTotalDaysInYear()', () => {
  it('returns 365 for standard year', () => {
    expect(getTotalDaysInYear(0)).toBe(365);
  });
});

describe('getTotalDaysSinceEpoch()', () => {
  it('returns 0 for epoch origin', () => {
    expect(getTotalDaysSinceEpoch({ year: 0, month: 0, dayOfMonth: 0 })).toBe(0);
  });
  it('returns 365 for year 1 day 0', () => {
    expect(getTotalDaysSinceEpoch({ year: 1, month: 0, dayOfMonth: 0 })).toBe(365);
  });
  it('returns 31 for Feb 1 year 0', () => {
    expect(getTotalDaysSinceEpoch({ year: 0, month: 1, dayOfMonth: 0 })).toBe(31);
  });
});

describe('isInSeasonRange()', () => {
  it('returns true for day within non-wrapping range', () => {
    expect(isInSeasonRange(100, 80, 171)).toBe(true);
  });
  it('returns false for day outside non-wrapping range', () => {
    expect(isInSeasonRange(50, 80, 171)).toBe(false);
  });
  it('handles wrap-around range (winter)', () => {
    expect(isInSeasonRange(360, 355, 79)).toBe(true);
    expect(isInSeasonRange(10, 355, 79)).toBe(true);
    expect(isInSeasonRange(200, 355, 79)).toBe(false);
  });
});

describe('getSeasonIndex()', () => {
  const seasons = [ { name: 'Spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', dayStart: 355, dayEnd: 79 } ];
  it('returns 0 for spring day', () => {
    expect(getSeasonIndex(100, seasons)).toBe(0);
  });
  it('returns 1 for summer day', () => {
    expect(getSeasonIndex(200, seasons)).toBe(1);
  });
  it('returns 3 for winter day (wrapped)', () => {
    expect(getSeasonIndex(10, seasons)).toBe(3);
    expect(getSeasonIndex(360, seasons)).toBe(3);
  });
  it('returns -1 for empty seasons', () => {
    expect(getSeasonIndex(100, [])).toBe(-1);
  });
});

describe('getSeasonPercent()', () => {
  const seasons = [{ name: 'Spring', dayStart: 80, dayEnd: 171 }];
  it('returns 0 at season start', () => {
    expect(getSeasonPercent(80, seasons, 365, 0)).toBe(0);
  });
  it('returns ~50 at midpoint', () => {
    const mid = Math.floor((80 + 171) / 2);
    const pct = getSeasonPercent(mid, seasons, 365, 0);
    expect(pct).toBeGreaterThanOrEqual(45);
    expect(pct).toBeLessThanOrEqual(55);
  });
});

describe('getSeasonDay()', () => {
  const seasons = [{ name: 'Spring', dayStart: 80, dayEnd: 171 }];
  it('returns 1 at season start', () => {
    expect(getSeasonDay(80, seasons, 365, 0)).toBe(1);
  });
  it('returns 10 on day 89', () => {
    expect(getSeasonDay(89, seasons, 365, 0)).toBe(10);
  });
});

describe('getMidpoint()', () => {
  it('returns midpoint of non-wrapping range', () => {
    expect(getMidpoint(80, 170, 365)).toBe(125);
  });
  it('handles wrap-around range', () => {
    expect(getMidpoint(355, 79, 365)).toBe(35);
  });
});

describe('getCalendarMoonPhaseIndex()', () => {
  it('returns a phase index for valid moon', () => {
    const result = getCalendarMoonPhaseIndex({ year: 2026, month: 0, dayOfMonth: 0 }, 0);
    expect(result).toBeTypeOf('number');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(8);
  });
  it('returns null for invalid moon index', () => {
    const result = getCalendarMoonPhaseIndex({ year: 2026, month: 0, dayOfMonth: 0 }, 99);
    expect(result).toBeNull();
  });
});

describe('getMoonPhaseCountInMonth()', () => {
  it('returns at least 1 for a valid date', () => {
    const count = getMoonPhaseCountInMonth({ year: 2026, month: 0, dayOfMonth: 15 }, 0);
    expect(count).toBeGreaterThanOrEqual(1);
  });
  it('returns 0 for invalid moon', () => {
    expect(getMoonPhaseCountInMonth({ year: 2026, month: 0, dayOfMonth: 0 }, 99)).toBe(0);
  });
});

describe('getCycleValue()', () => {
  it('returns correct day-based cycle value', () => {
    const cycle = { length: 7, basedOn: 'day', offset: 0, entries: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] };
    const val = getCycleValue({ year: 0, month: 0, dayOfMonth: 0 }, cycle);
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(7);
  });
  it('returns correct year-based cycle value', () => {
    const cycle = { length: 4, basedOn: 'year', offset: 0, entries: ['A', 'B', 'C', 'D'] };
    expect(getCycleValue({ year: 0, month: 0, dayOfMonth: 0 }, cycle)).toBe(0);
    expect(getCycleValue({ year: 1, month: 0, dayOfMonth: 0 }, cycle)).toBe(1);
    expect(getCycleValue({ year: 4, month: 0, dayOfMonth: 0 }, cycle)).toBe(0);
  });
  it('applies offset correctly', () => {
    const cycle = { length: 4, basedOn: 'year', offset: 1, entries: ['A', 'B', 'C', 'D'] };
    expect(getCycleValue({ year: 1, month: 0, dayOfMonth: 0 }, cycle)).toBe(0);
    expect(getCycleValue({ year: 2, month: 0, dayOfMonth: 0 }, cycle)).toBe(1);
  });
  it('returns 0 for null/empty cycle', () => {
    expect(getCycleValue({ year: 0, month: 0, dayOfMonth: 0 }, null)).toBe(0);
    expect(getCycleValue({ year: 0, month: 0, dayOfMonth: 0 }, {})).toBe(0);
  });
});

describe('getEraIndex()', () => {
  const eras = [ { name: 'First Age', startYear: 1, endYear: 999 }, { name: 'Second Age', startYear: 1000, endYear: 1999 }, { name: 'Third Age', startYear: 2000 } ];
  it('returns 0 for year in first era', () => {
    expect(getEraIndex(500, eras)).toBe(0);
  });
  it('returns 1 for year in second era', () => {
    expect(getEraIndex(1500, eras)).toBe(1);
  });
  it('returns 2 for year in open-ended third era', () => {
    expect(getEraIndex(3000, eras)).toBe(2);
  });
  it('returns 0 for year before first era', () => {
    expect(getEraIndex(0, eras)).toBe(0);
  });
});

describe('getEraYear()', () => {
  const eras = [ { name: 'First Age', startYear: 1, endYear: 999 }, { name: 'Second Age', startYear: 1000, endYear: 1999 }, { name: 'Third Age', startYear: 2000 } ];
  it('returns year within era', () => {
    expect(getEraYear(1000, eras)).toBe(1);
    expect(getEraYear(1005, eras)).toBe(6);
  });
  it('returns year within first era', () => {
    expect(getEraYear(1, eras)).toBe(1);
    expect(getEraYear(500, eras)).toBe(500);
  });
});

describe('findSeasonIndexByType()', () => {
  it('returns index of season with matching seasonalType', () => {
    const seasons = [
      { name: 'Aut', seasonalType: 'autumn' },
      { name: 'Win', seasonalType: 'winter' },
      { name: 'Spr', seasonalType: 'spring' },
      { name: 'Sum', seasonalType: 'summer' }
    ];
    expect(findSeasonIndexByType(seasons, 'autumn')).toBe(0);
    expect(findSeasonIndexByType(seasons, 'winter')).toBe(1);
    expect(findSeasonIndexByType(seasons, 'spring')).toBe(2);
    expect(findSeasonIndexByType(seasons, 'summer')).toBe(3);
  });
  it('ignores season name, even when name matches the requested type', () => {
    const seasons = [{ name: 'Summer', seasonalType: 'winter' }];
    expect(findSeasonIndexByType(seasons, 'summer')).toBe(-1);
    expect(findSeasonIndexByType(seasons, 'winter')).toBe(0);
  });
  it('returns -1 when no season has the requested seasonalType', () => {
    const seasons = [
      { name: 'Spring', seasonalType: 'spring' },
      { name: 'Summer', seasonalType: 'summer' }
    ];
    expect(findSeasonIndexByType(seasons, 'autumn')).toBe(-1);
  });
  it('returns -1 when seasonalType is missing (no regex/positional fallback)', () => {
    const seasons = [
      { name: 'Spring' },
      { name: 'Summer' },
      { name: 'Autumn' },
      { name: 'Winter' }
    ];
    expect(findSeasonIndexByType(seasons, 'spring')).toBe(-1);
    expect(findSeasonIndexByType(seasons, 'autumn')).toBe(-1);
  });
  it('returns -1 for empty or invalid input', () => {
    expect(findSeasonIndexByType([], 'spring')).toBe(-1);
    expect(findSeasonIndexByType(null, 'spring')).toBe(-1);
    expect(findSeasonIndexByType([{ seasonalType: 'spring' }], '')).toBe(-1);
  });
});

describe('getSeasonDayOfYearBounds()', () => {
  const calendar = CalendarManager.getActiveCalendar();
  it('returns stored dayStart/dayEnd for legacy day-of-year convention', () => {
    const season = { seasonalType: 'spring', dayStart: 80, dayEnd: 171 };
    expect(getSeasonDayOfYearBounds(season, calendar, 0)).toEqual({ startDoY: 80, endDoY: 171 });
  });
  it('handles wrap-around for legacy convention', () => {
    const season = { seasonalType: 'winter', dayStart: 355, dayEnd: 79 };
    expect(getSeasonDayOfYearBounds(season, calendar, 0)).toEqual({ startDoY: 355, endDoY: 79 });
  });
  it('resolves month-anchored convention to absolute day-of-year', () => {
    const season = { seasonalType: 'spring', monthStart: 2, monthEnd: 4, dayStart: 0, dayEnd: 30 };
    expect(getSeasonDayOfYearBounds(season, calendar, 0)).toEqual({ startDoY: 59, endDoY: 150 });
  });
  it('handles month-anchored seasons that wrap the year end', () => {
    const season = { seasonalType: 'summer', monthStart: 10, monthEnd: 0, dayStart: 0, dayEnd: 29 };
    expect(getSeasonDayOfYearBounds(season, calendar, 0)).toEqual({ startDoY: 304, endDoY: 29 });
  });
  it('defaults dayStart to 0 and dayEnd to last day of end month when omitted', () => {
    const season = { seasonalType: 'winter', monthStart: 11, monthEnd: 0 };
    expect(getSeasonDayOfYearBounds(season, calendar, 0)).toEqual({ startDoY: 334, endDoY: 30 });
  });
  it('returns null for incomplete input', () => {
    expect(getSeasonDayOfYearBounds(null, calendar, 0)).toBeNull();
    expect(getSeasonDayOfYearBounds({ seasonalType: 'spring' }, calendar, 0)).toBeNull();
    expect(getSeasonDayOfYearBounds({ seasonalType: 'spring', dayStart: 80, dayEnd: 171 }, null, 0)).toBeNull();
  });
});

describe('checkSolsticeOrEquinox()', () => {
  const legacySeasons = [
    { name: 'Spring', seasonalType: 'spring', dayStart: 80, dayEnd: 171 },
    { name: 'Summer', seasonalType: 'summer', dayStart: 172, dayEnd: 264 },
    { name: 'Autumn', seasonalType: 'autumn', dayStart: 265, dayEnd: 354 },
    { name: 'Winter', seasonalType: 'winter', dayStart: 355, dayEnd: 79 }
  ];
  it('detects spring equinox at season start (legacy convention)', () => {
    expect(checkSolsticeOrEquinox({ year: 0, month: 2, dayOfMonth: 21 }, legacySeasons, 'spring')).toBe(true);
  });
  it('returns false for non-equinox date', () => {
    expect(checkSolsticeOrEquinox({ year: 0, month: 5, dayOfMonth: 15 }, legacySeasons, 'spring')).toBe(false);
  });
  it('returns false for invalid type', () => {
    expect(checkSolsticeOrEquinox({ year: 0, month: 0, dayOfMonth: 0 }, legacySeasons, 'invalid')).toBe(false);
  });
  it('returns false when seasonalType is missing (no regex fallback)', () => {
    const unTyped = [
      { name: 'Spring', dayStart: 80, dayEnd: 171 },
      { name: 'Summer', dayStart: 172, dayEnd: 264 },
      { name: 'Autumn', dayStart: 265, dayEnd: 354 },
      { name: 'Winter', dayStart: 355, dayEnd: 79 }
    ];
    expect(checkSolsticeOrEquinox({ year: 0, month: 2, dayOfMonth: 21 }, unTyped, 'spring')).toBe(false);
  });
  it('handles month-anchored convention (regression for #635)', () => {
    const anchored = [
      { name: 'Aut', seasonalType: 'autumn', monthStart: 8, monthEnd: 10, dayStart: 0, dayEnd: 29 },
      { name: 'Win', seasonalType: 'winter', monthStart: 11, monthEnd: 1, dayStart: 0, dayEnd: 27 },
      { name: 'Spr', seasonalType: 'spring', monthStart: 2, monthEnd: 4, dayStart: 0, dayEnd: 30 },
      { name: 'Sum', seasonalType: 'summer', monthStart: 5, monthEnd: 7, dayStart: 0, dayEnd: 30 }
    ];
    expect(checkSolsticeOrEquinox({ year: 0, month: 2, dayOfMonth: 0 }, anchored, 'spring')).toBe(true);
    expect(checkSolsticeOrEquinox({ year: 0, month: 0, dayOfMonth: 0 }, anchored, 'spring')).toBe(false);
    expect(checkSolsticeOrEquinox({ year: 0, month: 0, dayOfMonth: 14 }, anchored, 'longest')).toBe(false);
  });
});
