import { describe, expect, it, vi } from 'vitest';
import CalendariaCalendar from '../../scripts/data/calendaria-calendar.mjs';
import { clampViewedYear } from '../../scripts/notes/date-utils.mjs';

vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager, defaultCalendar } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager, defaultCalendar };
});

const countingDaysFor = (stub, components, sinceYearStart) => CalendariaCalendar.prototype._countingDaysFor.call(stub, components, sinceYearStart);
const computeDayOfWeek = (stub, components) => CalendariaCalendar.prototype._computeDayOfWeek.call(stub, components);

/**
 * Build a minimal calendar stub: 12 months of 30 days, 7-day week, no festivals or intercalary days.
 * @param {object} years - The years config under test
 * @returns {object} Stub exposing only what the two methods touch
 */
function stubCalendar(years = {}) {
  const DAYS_PER_MONTH = 30;
  const MONTHS = 12;
  const stub = {
    years,
    daysInWeek: 7,
    effectiveFirstWeekday: 0,
    monthsArray: Array.from({ length: MONTHS }, () => ({})),
    getDaysInMonth: () => DAYS_PER_MONTH,
    totalDaysBeforeYear: (year) => year * MONTHS * DAYS_PER_MONTH,
    _computeCyclePosition: () => null
  };
  stub._countingDaysFor = (components, sinceYearStart) => countingDaysFor(stub, components, sinceYearStart);
  return stub;
}

describe('clampViewedYear()', () => {
  it('leaves the date alone when negative years are allowed', () => {
    const cal = { years: { allowNegativeYears: true } };
    expect(clampViewedYear({ year: -50, month: 2, dayOfMonth: 4 }, cal)).toEqual({ year: -50, month: 2, dayOfMonth: 4 });
  });

  it('leaves the date alone when the field is absent, since the default permits negative years', () => {
    expect(clampViewedYear({ year: -3, month: 0, dayOfMonth: 0 }, { years: {} })).toEqual({ year: -3, month: 0, dayOfMonth: 0 });
  });

  it('clamps to year 1 when negative years are forbidden', () => {
    const cal = { years: { allowNegativeYears: false } };
    expect(clampViewedYear({ year: 0, month: 5, dayOfMonth: 9 }, cal)).toEqual({ year: 1, month: 5, dayOfMonth: 9 });
    expect(clampViewedYear({ year: -20, month: 1, dayOfMonth: 2 }, cal)).toEqual({ year: 1, month: 1, dayOfMonth: 2 });
  });

  it('leaves years at or after 1 untouched when negative years are forbidden', () => {
    const cal = { years: { allowNegativeYears: false } };
    const date = { year: 1, month: 0, dayOfMonth: 0 };
    expect(clampViewedYear(date, cal)).toBe(date);
    expect(clampViewedYear({ year: 1389, month: 3, dayOfMonth: 1 }, cal)).toEqual({ year: 1389, month: 3, dayOfMonth: 1 });
  });

  it('passes a missing date straight through', () => {
    expect(clampViewedYear(null, { years: { allowNegativeYears: false } })).toBe(null);
  });
});

describe('_countingDaysFor()', () => {
  const cal = stubCalendar();
  const components = { year: 3, month: 2, dayOfMonth: 4 };

  it('counts from the epoch by default', () => {
    expect(countingDaysFor(cal, components, false)).toBe(3 * 360 + 2 * 30 + 4);
  });

  it('counts from the start of the year when asked', () => {
    expect(countingDaysFor(cal, components, true)).toBe(2 * 30 + 4);
  });

  it('splits into whole years plus the within-year remainder', () => {
    const total = countingDaysFor(cal, components, false);
    const withinYear = countingDaysFor(cal, components, true);
    expect(total - withinYear).toBe(cal.totalDaysBeforeYear(components.year));
  });
});

describe('_computeDayOfWeek() with resetWeekdays', () => {
  it('runs the weekday cycle continuously across the year boundary by default', () => {
    const cal = stubCalendar({ resetWeekdays: false });
    // 360 days is not a multiple of 7, so year 1 day 0 must not land on the same weekday as year 0 day 0.
    expect(computeDayOfWeek(cal, { year: 0, month: 0, dayOfMonth: 0 })).toBe(0);
    expect(computeDayOfWeek(cal, { year: 1, month: 0, dayOfMonth: 0 })).toBe(360 % 7);
  });

  it('restarts every year on the first weekday when enabled', () => {
    const cal = stubCalendar({ resetWeekdays: true });
    for (const year of [0, 1, 2, 57]) expect(computeDayOfWeek(cal, { year, month: 0, dayOfMonth: 0 })).toBe(0);
  });

  it('still advances within the year when enabled', () => {
    const cal = stubCalendar({ resetWeekdays: true });
    expect(computeDayOfWeek(cal, { year: 4, month: 0, dayOfMonth: 3 })).toBe(3);
    expect(computeDayOfWeek(cal, { year: 4, month: 1, dayOfMonth: 0 })).toBe(30 % 7);
  });

  it('honours a non-zero first weekday on each year start', () => {
    const cal = stubCalendar({ resetWeekdays: true });
    cal.effectiveFirstWeekday = 3;
    expect(computeDayOfWeek(cal, { year: 9, month: 0, dayOfMonth: 0 })).toBe(3);
  });
});
