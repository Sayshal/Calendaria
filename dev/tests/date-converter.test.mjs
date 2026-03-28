import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { convertDate, getEquivalentDates } from '../../scripts/calendar/date-converter.mjs';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/utils/formatting/format-utils.mjs', () => ({ formatCustom: vi.fn(() => 'formatted') }));
const SECS_PER_MINUTE = 60;
const SECS_PER_HOUR = 3600;
const SECS_PER_DAY = 86400;
const calendarsDir = join(import.meta.dirname, '../../calendars');
const calendarFiles = readdirSync(calendarsDir).filter((f) => f.endsWith('.json'));

function extractMonthDays(json) {
  const values = json.months?.values;
  if (!values) return [];
  const entries = Array.isArray(values) ? values : Object.values(values);
  if (entries.length === 0) return [];
  return entries.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0)).map((m) => m.days);
}

function extractLeapMonthDays(json) {
  if (!json.leapYearConfig?.rule) return null;
  const values = json.months?.values;
  if (!values) return null;
  const entries = Array.isArray(values) ? values : Object.values(values);
  if (entries.length === 0) return null;
  const sorted = entries.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  if (!sorted.some((m) => m.leapDays !== undefined && m.leapDays !== m.days)) return null;
  return sorted.map((m) => m.leapDays ?? m.days);
}

function isGregorianLeapYear(displayYear) { return (displayYear % 4 === 0 && displayYear % 100 !== 0) || displayYear % 400 === 0; }
function createMockFromJson(json) {
  const monthDays = extractMonthDays(json);
  const leapMonthDays = extractLeapMonthDays(json);
  const baseDaysPerYear = monthDays.reduce((s, d) => s + d, 0);
  const yearZero = json.years?.yearZero ?? 0;
  const isMonthless = monthDays.length === 0;
  const effectiveDPY = isMonthless ? (json.days?.daysPerYear ?? 365) : baseDaysPerYear;
  function monthDaysForYear(internalYear) {
    if (!leapMonthDays) return monthDays;
    return isGregorianLeapYear(internalYear + yearZero) ? leapMonthDays : monthDays;
  }
  function daysInYear(internalYear) {
    if (isMonthless || !leapMonthDays) return effectiveDPY;
    return monthDaysForYear(internalYear).reduce((s, d) => s + d, 0);
  }
  return {
    name: json.name ?? json.id,
    years: { yearZero },
    months: { values: monthDays.map((days, i) => ({ name: `M${i + 1}`, days })) },
    _monthDays: monthDays,
    _daysPerYear: baseDaysPerYear,
    _isMonthless: isMonthless,
    _hasLeapYears: !!leapMonthDays,
    componentsToTime({ year, month = 0, dayOfMonth = 0, hour = 0, minute = 0, second = 0 }) {
      let totalDays = 0;
      for (let y = 0; y < year; y++) totalDays += daysInYear(y);
      if (!isMonthless) {
        const md = monthDaysForYear(year);
        for (let m = 0; m < month; m++) totalDays += md[m];
      }
      totalDays += dayOfMonth;
      return totalDays * SECS_PER_DAY + hour * SECS_PER_HOUR + minute * SECS_PER_MINUTE + second;
    },
    timeToComponents(time) {
      let totalDays = Math.floor(time / SECS_PER_DAY);
      const rem = time % SECS_PER_DAY;
      let year = 0;
      while (totalDays >= daysInYear(year)) {
        totalDays -= daysInYear(year);
        year++;
      }
      let month = 0;
      if (!isMonthless) {
        const md = monthDaysForYear(year);
        for (let i = 0; i < md.length; i++) {
          if (totalDays < md[i]) {
            month = i;
            break;
          }
          totalDays -= md[i];
        }
      }
      return { year, month, dayOfMonth: totalDays, hour: Math.floor(rem / SECS_PER_HOUR), minute: Math.floor((rem % SECS_PER_HOUR) / SECS_PER_MINUTE), second: rem % SECS_PER_MINUTE };
    }
  };
}
const bundledCalendars = new Map();
const bundledJsons = new Map();
for (const file of calendarFiles) {
  const json = JSON.parse(readFileSync(join(calendarsDir, file), 'utf-8'));
  const id = json.id ?? file.replace('.json', '');
  bundledCalendars.set(id, createMockFromJson(json));
  bundledJsons.set(id, json);
}

vi.mock('../../scripts/calendar/calendar-registry.mjs', () => ({
  default: {
    get: vi.fn((id) => bundledCalendars.get(id) ?? null),
    getAllIds: vi.fn(() => Array.from(bundledCalendars.keys())),
    get size() { return bundledCalendars.size; }
  }
}));

describe('Bundled calendar JSON validation', () => {
  for (const [id, json] of bundledJsons) {
    const cal = bundledCalendars.get(id);
    describe(id, () => {
      it('has a numeric yearZero', () => {
        expect(typeof json.years?.yearZero).toBe('number');
      });
      it('has weekday definitions', () => {
        const days = json.days?.values;
        expect(days).toBeDefined();
        const entries = Array.isArray(days) ? days : Object.values(days);
        expect(entries.length).toBeGreaterThan(0);
      });
      it('has standard time units (24h, 60m, 60s)', () => {
        expect(json.days?.hoursPerDay).toBe(24);
        expect(json.days?.minutesPerHour).toBe(60);
        expect(json.days?.secondsPerMinute).toBe(60);
      });
      if (!cal._isMonthless) {
        it('has months with positive day counts', () => {
          expect(cal._monthDays.length).toBeGreaterThan(0);
          for (const days of cal._monthDays) {
            expect(days).toBeGreaterThan(0);
            expect(Number.isInteger(days)).toBe(true);
          }
        });
        it('has reasonable year length (100-400 days)', () => {
          expect(cal._daysPerYear).toBeGreaterThanOrEqual(100);
          expect(cal._daysPerYear).toBeLessThanOrEqual(400);
        });
      } else {
        it('is correctly identified as monthless', () => {
          expect(cal._isMonthless).toBe(true);
        });
      }
      it('self round-trips epoch origin', () => {
        const yearZero = cal.years.yearZero;
        const date = { year: yearZero, month: 0, dayOfMonth: 0 };
        const result = convertDate(date, id, id);
        expect(result.year).toBe(yearZero);
        expect(result.month).toBe(0);
        expect(result.dayOfMonth).toBe(0);
      });
      it('self round-trips mid-year date', () => {
        const yearZero = cal.years.yearZero;
        const midMonth = cal._isMonthless ? 0 : Math.min(1, cal._monthDays.length - 1);
        const midDay = cal._isMonthless ? 50 : Math.min(5, cal._monthDays[midMonth] - 1);
        const date = { year: yearZero + 3, month: midMonth, dayOfMonth: midDay, hour: 14, minute: 30, second: 45 };
        const result = convertDate(date, id, id);
        expect(result).toEqual(date);
      });
    });
  }
});

describe('Cross-calendar A→B→A round-trip', () => {
  const calIds = Array.from(bundledCalendars.keys()).filter((id) => !bundledCalendars.get(id)._isMonthless);
  const pairsToTest = [];
  for (let i = 0; i < calIds.length; i++) pairsToTest.push([calIds[i], calIds[(i + 1) % calIds.length]]);
  const diversePairs = [
    ['gregorian', 'exandrian'],
    ['gregorian', 'forbidden-lands'],
    ['harptos', 'khorvaire'],
    ['exandrian', 'forbidden-lands'],
    ['greyhawk', 'greyhawk-364'],
    ['cerilian', 'renescara'],
    ['athasian', 'galifar']
  ].filter(([a, b]) => bundledCalendars.has(a) && bundledCalendars.has(b));
  for (const pair of diversePairs) if (!pairsToTest.some(([a, b]) => (a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0]))) pairsToTest.push(pair);
  for (const [idA, idB] of pairsToTest) {
    const calA = bundledCalendars.get(idA);
    describe(`${idA} (${calA._daysPerYear}d) ↔ ${idB} (${bundledCalendars.get(idB)._daysPerYear}d)`, () => {
      it('round-trips epoch origin', () => {
        const date = { year: calA.years.yearZero, month: 0, dayOfMonth: 0 };
        const converted = convertDate(date, idA, idB);
        expect(converted).not.toBeNull();
        const back = convertDate(converted, idB, idA);
        expect(back).not.toBeNull();
        expect(back.year).toBe(date.year);
        expect(back.month).toBe(0);
        expect(back.dayOfMonth).toBe(0);
      });
      it('round-trips mid-year date with time', () => {
        const midMonth = Math.min(1, calA._monthDays.length - 1);
        const midDay = Math.min(5, calA._monthDays[midMonth] - 1);
        const date = { year: calA.years.yearZero + 3, month: midMonth, dayOfMonth: midDay, hour: 14, minute: 30, second: 45 };
        const converted = convertDate(date, idA, idB);
        expect(converted).not.toBeNull();
        const back = convertDate(converted, idB, idA);
        expect(back).not.toBeNull();
        expect(back.year).toBe(date.year);
        expect(back.month).toBe(date.month);
        expect(back.dayOfMonth).toBe(date.dayOfMonth);
        expect(back.hour).toBe(14);
        expect(back.minute).toBe(30);
        expect(back.second).toBe(45);
      });
      it('round-trips last month, last day', () => {
        const lastMonth = calA._monthDays.length - 1;
        const lastDay = calA._monthDays[lastMonth] - 1;
        const date = { year: calA.years.yearZero + 1, month: lastMonth, dayOfMonth: lastDay };
        const converted = convertDate(date, idA, idB);
        expect(converted).not.toBeNull();
        const back = convertDate(converted, idB, idA);
        expect(back).not.toBeNull();
        expect(back.year).toBe(date.year);
        expect(back.month).toBe(lastMonth);
        expect(back.dayOfMonth).toBe(lastDay);
      });
    });
  }
});

describe('yearZero offset alignment', () => {
  for (const [id, cal] of bundledCalendars) {
    if (cal._isMonthless) continue;
    it(`${id}: yearZero ${cal.years.yearZero} round-trips through gregorian`, () => {
      const date = { year: cal.years.yearZero, month: 0, dayOfMonth: 0 };
      const toGreg = convertDate(date, id, 'gregorian');
      expect(toGreg).not.toBeNull();
      const back = convertDate(toGreg, 'gregorian', id);
      expect(back).not.toBeNull();
      expect(back.year).toBe(cal.years.yearZero);
      expect(back.month).toBe(0);
      expect(back.dayOfMonth).toBe(0);
    });
  }
});

describe('convertDate() error cases', () => {
  it('returns null for unknown source calendar', () => {
    expect(convertDate({ year: 0, month: 0, dayOfMonth: 0 }, 'unknown', 'gregorian')).toBeNull();
  });
  it('returns null for unknown target calendar', () => {
    expect(convertDate({ year: 0, month: 0, dayOfMonth: 0 }, 'gregorian', 'unknown')).toBeNull();
  });
  it('defaults missing fields to 0', () => {
    const result = convertDate({ year: 0 }, 'gregorian', 'harptos');
    expect(result).not.toBeNull();
    expect(result.month).toBe(0);
    expect(result.dayOfMonth + 0).toBe(0);
  });
  it('returns a copy for same-calendar conversion', () => {
    const date = { year: 5, month: 3, dayOfMonth: 10 };
    const result = convertDate(date, 'gregorian', 'gregorian');
    expect(result).toEqual(date);
    expect(result).not.toBe(date);
  });
});

describe('Leap year round-trip conversions', () => {
  it('self round-trips Feb 29 of a leap year', () => {
    const date = { year: 2000, month: 1, dayOfMonth: 28 };
    const result = convertDate(date, 'gregorian', 'gregorian');
    expect(result).toEqual(date);
  });
  it('self round-trips last day of a leap year (Dec 31)', () => {
    const date = { year: 2000, month: 11, dayOfMonth: 30 };
    const result = convertDate(date, 'gregorian', 'gregorian');
    expect(result).toEqual(date);
  });
  it('self round-trips Feb 28 of a non-leap year', () => {
    const date = { year: 1999, month: 1, dayOfMonth: 27 };
    const result = convertDate(date, 'gregorian', 'gregorian');
    expect(result).toEqual(date);
  });
  it('round-trips Feb 29 through a non-leap calendar', () => {
    const date = { year: 2000, month: 1, dayOfMonth: 28 };
    const converted = convertDate(date, 'gregorian', 'harptos');
    expect(converted).not.toBeNull();
    const back = convertDate(converted, 'harptos', 'gregorian');
    expect(back).not.toBeNull();
    expect(back.year).toBe(2000);
    expect(back.month).toBe(1);
    expect(back.dayOfMonth).toBe(28);
  });
  it('round-trips Dec 31 of a leap year through another calendar', () => {
    const date = { year: 2000, month: 11, dayOfMonth: 30 };
    const converted = convertDate(date, 'gregorian', 'exandrian');
    expect(converted).not.toBeNull();
    const back = convertDate(converted, 'exandrian', 'gregorian');
    expect(back).not.toBeNull();
    expect(back.year).toBe(2000);
    expect(back.month).toBe(11);
    expect(back.dayOfMonth).toBe(30);
  });
  it('round-trips Jan 1 after a leap year', () => {
    const date = { year: 2001, month: 0, dayOfMonth: 0 };
    const converted = convertDate(date, 'gregorian', 'harptos');
    expect(converted).not.toBeNull();
    const back = convertDate(converted, 'harptos', 'gregorian');
    expect(back).not.toBeNull();
    expect(back.year).toBe(2001);
    expect(back.month).toBe(0);
    expect(back.dayOfMonth).toBe(0);
  });
  it('handles century non-leap year (1900)', () => {
    const date = { year: 1982, month: 1, dayOfMonth: 27 };
    const converted = convertDate(date, 'gregorian', 'harptos');
    expect(converted).not.toBeNull();
    const back = convertDate(converted, 'harptos', 'gregorian');
    expect(back).not.toBeNull();
    expect(back.year).toBe(1982);
    expect(back.month).toBe(1);
    expect(back.dayOfMonth).toBe(27);
  });
});

describe('Monthless (Traveller) cross-calendar conversion', () => {
  it('converts epoch origin to Gregorian and back', () => {
    const date = { year: 1105, month: 0, dayOfMonth: 0 };
    const toGreg = convertDate(date, 'traveller', 'gregorian');
    expect(toGreg).not.toBeNull();
    const back = convertDate(toGreg, 'gregorian', 'traveller');
    expect(back).not.toBeNull();
    expect(back.year).toBe(1105);
    expect(back.month).toBe(0);
    expect(back.dayOfMonth).toBe(0);
  });
  it('converts mid-year date to Gregorian and back', () => {
    const date = { year: 1108, month: 0, dayOfMonth: 182 };
    const toGreg = convertDate(date, 'traveller', 'gregorian');
    expect(toGreg).not.toBeNull();
    const back = convertDate(toGreg, 'gregorian', 'traveller');
    expect(back).not.toBeNull();
    expect(back.year).toBe(1108);
    expect(back.month).toBe(0);
    expect(back.dayOfMonth).toBe(182);
  });
  it('converts last day of year to Gregorian and back', () => {
    const date = { year: 1107, month: 0, dayOfMonth: 364 };
    const toGreg = convertDate(date, 'traveller', 'gregorian');
    expect(toGreg).not.toBeNull();
    const back = convertDate(toGreg, 'gregorian', 'traveller');
    expect(back).not.toBeNull();
    expect(back.year).toBe(1107);
    expect(back.month).toBe(0);
    expect(back.dayOfMonth).toBe(364);
  });
  it('converts to a non-Gregorian month-based calendar and back', () => {
    const date = { year: 1106, month: 0, dayOfMonth: 100 };
    const toHarptos = convertDate(date, 'traveller', 'harptos');
    expect(toHarptos).not.toBeNull();
    const back = convertDate(toHarptos, 'harptos', 'traveller');
    expect(back).not.toBeNull();
    expect(back.year).toBe(1106);
    expect(back.month).toBe(0);
    expect(back.dayOfMonth).toBe(100);
  });
  it('round-trips with time components preserved', () => {
    const date = { year: 1110, month: 0, dayOfMonth: 200, hour: 8, minute: 45, second: 30 };
    const toGreg = convertDate(date, 'traveller', 'gregorian');
    expect(toGreg).not.toBeNull();
    const back = convertDate(toGreg, 'gregorian', 'traveller');
    expect(back).not.toBeNull();
    expect(back.year).toBe(1110);
    expect(back.dayOfMonth).toBe(200);
    expect(back.hour).toBe(8);
    expect(back.minute).toBe(45);
    expect(back.second).toBe(30);
  });
  it('reads daysPerYear from JSON for monthless calendars', () => {
    const traveller = bundledCalendars.get('traveller');
    expect(traveller._isMonthless).toBe(true);
    const time1 = traveller.componentsToTime({ year: 1, dayOfMonth: 0 });
    expect(time1).toBe(365 * SECS_PER_DAY);
  });
});

describe('getEquivalentDates()', () => {
  it('returns dates for all other calendars', () => {
    const results = getEquivalentDates({ year: 0, month: 0, dayOfMonth: 0 }, 'gregorian');
    expect(results).toHaveLength(bundledCalendars.size - 1);
  });
  it('filters by target IDs', () => {
    const results = getEquivalentDates({ year: 0, month: 0, dayOfMonth: 0 }, 'gregorian', ['harptos']);
    expect(results).toHaveLength(1);
    expect(results[0].calendarId).toBe('harptos');
  });
  it('includes formatted string and calendar name', () => {
    const results = getEquivalentDates({ year: 0, month: 0, dayOfMonth: 0 }, 'gregorian', ['harptos']);
    expect(results[0].formatted).toBe('formatted');
    expect(results[0].calendarName).toBeDefined();
  });
});
