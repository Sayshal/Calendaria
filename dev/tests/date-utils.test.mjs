/**
 * Tests for date-utils.mjs
 * @module Tests/DateUtils
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CalendarManager before importing
vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager, defaultCalendar } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager, defaultCalendar };
});

import { compareDates, isSameDay, compareDays, daysBetween, addDays, dayOfWeek, getCurrentDate, monthsBetween, addMonths, addYears, isValidDate } from '../../scripts/notes/date-utils.mjs';

import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';

beforeEach(() => {
  CalendarManager._reset();
});

/* -------------------------------------------- */
/*  compareDates() - Pure function              */
/* -------------------------------------------- */

describe('compareDates()', () => {
  it('returns -1 when date1 is earlier by year', () => {
    const date1 = { year: 2020, month: 6, day: 15 };
    const date2 = { year: 2021, month: 1, day: 1 };
    expect(compareDates(date1, date2)).toBe(-1);
  });

  it('returns 1 when date1 is later by year', () => {
    const date1 = { year: 2022, month: 1, day: 1 };
    const date2 = { year: 2021, month: 12, day: 31 };
    expect(compareDates(date1, date2)).toBe(1);
  });

  it('returns -1 when date1 is earlier by month (same year)', () => {
    const date1 = { year: 2021, month: 3, day: 15 };
    const date2 = { year: 2021, month: 6, day: 1 };
    expect(compareDates(date1, date2)).toBe(-1);
  });

  it('returns 1 when date1 is later by month (same year)', () => {
    const date1 = { year: 2021, month: 9, day: 1 };
    const date2 = { year: 2021, month: 6, day: 30 };
    expect(compareDates(date1, date2)).toBe(1);
  });

  it('returns -1 when date1 is earlier by day (same month)', () => {
    const date1 = { year: 2021, month: 6, day: 10 };
    const date2 = { year: 2021, month: 6, day: 20 };
    expect(compareDates(date1, date2)).toBe(-1);
  });

  it('returns 1 when date1 is later by day (same month)', () => {
    const date1 = { year: 2021, month: 6, day: 25 };
    const date2 = { year: 2021, month: 6, day: 15 };
    expect(compareDates(date1, date2)).toBe(1);
  });

  it('returns -1 when date1 is earlier by hour (same day)', () => {
    const date1 = { year: 2021, month: 6, day: 15, hour: 10 };
    const date2 = { year: 2021, month: 6, day: 15, hour: 14 };
    expect(compareDates(date1, date2)).toBe(-1);
  });

  it('returns 1 when date1 is later by hour (same day)', () => {
    const date1 = { year: 2021, month: 6, day: 15, hour: 18 };
    const date2 = { year: 2021, month: 6, day: 15, hour: 9 };
    expect(compareDates(date1, date2)).toBe(1);
  });

  it('returns -1 when date1 is earlier by minute (same hour)', () => {
    const date1 = { year: 2021, month: 6, day: 15, hour: 14, minute: 15 };
    const date2 = { year: 2021, month: 6, day: 15, hour: 14, minute: 45 };
    expect(compareDates(date1, date2)).toBe(-1);
  });

  it('returns 0 when dates are equal', () => {
    const date1 = { year: 2021, month: 6, day: 15, hour: 14, minute: 30 };
    const date2 = { year: 2021, month: 6, day: 15, hour: 14, minute: 30 };
    expect(compareDates(date1, date2)).toBe(0);
  });

  it('treats missing hour as 0', () => {
    const date1 = { year: 2021, month: 6, day: 15 };
    const date2 = { year: 2021, month: 6, day: 15, hour: 0 };
    expect(compareDates(date1, date2)).toBe(0);
  });

  it('treats missing minute as 0', () => {
    const date1 = { year: 2021, month: 6, day: 15, hour: 14 };
    const date2 = { year: 2021, month: 6, day: 15, hour: 14, minute: 0 };
    expect(compareDates(date1, date2)).toBe(0);
  });
});

/* -------------------------------------------- */
/*  isSameDay() - Pure function                 */
/* -------------------------------------------- */

describe('isSameDay()', () => {
  it('returns true for same day', () => {
    const date1 = { year: 2021, month: 6, day: 15 };
    const date2 = { year: 2021, month: 6, day: 15 };
    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('returns true for same day with different times', () => {
    const date1 = { year: 2021, month: 6, day: 15, hour: 9, minute: 0 };
    const date2 = { year: 2021, month: 6, day: 15, hour: 18, minute: 30 };
    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('returns false for different years', () => {
    const date1 = { year: 2020, month: 6, day: 15 };
    const date2 = { year: 2021, month: 6, day: 15 };
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('returns false for different months', () => {
    const date1 = { year: 2021, month: 5, day: 15 };
    const date2 = { year: 2021, month: 6, day: 15 };
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('returns false for different days', () => {
    const date1 = { year: 2021, month: 6, day: 14 };
    const date2 = { year: 2021, month: 6, day: 15 };
    expect(isSameDay(date1, date2)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  compareDays() - Pure function               */
/* -------------------------------------------- */

describe('compareDays()', () => {
  it('returns 0 for same day (ignoring time)', () => {
    const date1 = { year: 2021, month: 6, day: 15, hour: 9 };
    const date2 = { year: 2021, month: 6, day: 15, hour: 18 };
    expect(compareDays(date1, date2)).toBe(0);
  });

  it('returns -1 when date1 is earlier', () => {
    const date1 = { year: 2021, month: 6, day: 14 };
    const date2 = { year: 2021, month: 6, day: 15 };
    expect(compareDays(date1, date2)).toBe(-1);
  });

  it('returns 1 when date1 is later', () => {
    const date1 = { year: 2021, month: 6, day: 16 };
    const date2 = { year: 2021, month: 6, day: 15 };
    expect(compareDays(date1, date2)).toBe(1);
  });

  it('compares by year first', () => {
    const date1 = { year: 2020, month: 12, day: 31 };
    const date2 = { year: 2021, month: 1, day: 1 };
    expect(compareDays(date1, date2)).toBe(-1);
  });

  it('compares by month second', () => {
    const date1 = { year: 2021, month: 5, day: 31 };
    const date2 = { year: 2021, month: 6, day: 1 };
    expect(compareDays(date1, date2)).toBe(-1);
  });
});

/* -------------------------------------------- */
/*  monthsBetween() - Needs CalendarManager     */
/* -------------------------------------------- */

describe('monthsBetween()', () => {
  it('returns 0 for same month', () => {
    const date1 = { year: 2021, month: 6, day: 1 };
    const date2 = { year: 2021, month: 6, day: 30 };
    expect(monthsBetween(date1, date2)).toBe(0);
  });

  it('returns positive for later month same year', () => {
    const date1 = { year: 2021, month: 3, day: 1 };
    const date2 = { year: 2021, month: 9, day: 1 };
    expect(monthsBetween(date1, date2)).toBe(6);
  });

  it('returns negative for earlier month same year', () => {
    const date1 = { year: 2021, month: 9, day: 1 };
    const date2 = { year: 2021, month: 3, day: 1 };
    expect(monthsBetween(date1, date2)).toBe(-6);
  });

  it('accounts for year difference', () => {
    const date1 = { year: 2020, month: 10, day: 1 };
    const date2 = { year: 2021, month: 2, day: 1 };
    // 12 months/year + (2 - 10) = 12 - 8 = 4
    expect(monthsBetween(date1, date2)).toBe(4);
  });

  it('returns 0 when no calendar available', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date1 = { year: 2021, month: 3, day: 1 };
    const date2 = { year: 2021, month: 9, day: 1 };
    expect(monthsBetween(date1, date2)).toBe(0);
  });
});

/* -------------------------------------------- */
/*  addMonths() - Needs CalendarManager         */
/* -------------------------------------------- */

describe('addMonths()', () => {
  it('adds months within same year', () => {
    const date = { year: 2021, month: 3, day: 15 };
    const result = addMonths(date, 2);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(5);
    expect(result.day).toBe(15);
  });

  it('wraps to next year when adding', () => {
    const date = { year: 2021, month: 10, day: 15 };
    const result = addMonths(date, 3);
    expect(result.year).toBe(2022);
    expect(result.month).toBe(1);
  });

  it('subtracts months within same year', () => {
    const date = { year: 2021, month: 6, day: 15 };
    const result = addMonths(date, -2);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(4);
  });

  it('wraps to previous year when subtracting', () => {
    const date = { year: 2021, month: 2, day: 15 };
    const result = addMonths(date, -4);
    expect(result.year).toBe(2020);
    expect(result.month).toBe(10);
  });

  it('clamps day to max days in new month', () => {
    const date = { year: 2021, month: 0, day: 31 }; // Jan 31
    const result = addMonths(date, 1); // -> Feb
    expect(result.day).toBeLessThanOrEqual(28);
  });

  it('returns original date when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date = { year: 2021, month: 3, day: 15 };
    const result = addMonths(date, 2);
    expect(result).toEqual(date);
  });
});

/* -------------------------------------------- */
/*  addYears() - Needs CalendarManager          */
/* -------------------------------------------- */

describe('addYears()', () => {
  it('adds years', () => {
    const date = { year: 2021, month: 6, day: 15 };
    const result = addYears(date, 5);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(6);
    expect(result.day).toBe(15);
  });

  it('subtracts years', () => {
    const date = { year: 2021, month: 6, day: 15 };
    const result = addYears(date, -10);
    expect(result.year).toBe(2011);
  });

  it('preserves time components', () => {
    const date = { year: 2021, month: 6, day: 15, hour: 14, minute: 30 };
    const result = addYears(date, 1);
    expect(result.hour).toBe(14);
    expect(result.minute).toBe(30);
  });

  it('returns original date when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date = { year: 2021, month: 6, day: 15 };
    const result = addYears(date, 5);
    expect(result).toEqual(date);
  });
});

/* -------------------------------------------- */
/*  isValidDate() - Needs CalendarManager       */
/* -------------------------------------------- */

describe('isValidDate()', () => {
  it('returns false for null', () => {
    expect(isValidDate(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidDate(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isValidDate('2021-06-15')).toBe(false);
    expect(isValidDate(12345)).toBe(false);
  });

  it('returns false for missing year', () => {
    expect(isValidDate({ month: 6, day: 15 })).toBe(false);
  });

  it('returns false for missing month', () => {
    expect(isValidDate({ year: 2021, day: 15 })).toBe(false);
  });

  it('returns false for missing day', () => {
    expect(isValidDate({ year: 2021, month: 6 })).toBe(false);
  });

  it('returns true for valid date', () => {
    expect(isValidDate({ year: 2021, month: 6, day: 15 })).toBe(true);
  });

  it('returns false for invalid month', () => {
    expect(isValidDate({ year: 2021, month: 13, day: 15 })).toBe(false);
    expect(isValidDate({ year: 2021, month: -1, day: 15 })).toBe(false);
  });

  it('returns false for day < 1', () => {
    expect(isValidDate({ year: 2021, month: 6, day: 0 })).toBe(false);
  });

  it('returns false for day > days in month', () => {
    expect(isValidDate({ year: 2021, month: 1, day: 32 })).toBe(false);
  });

  it('returns true when no calendar (basic validation only)', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    expect(isValidDate({ year: 2021, month: 6, day: 15 })).toBe(true);
  });
});

/* -------------------------------------------- */
/*  addDays() - Needs CalendarManager            */
/* -------------------------------------------- */

describe('addDays()', () => {
  it('adds positive days within same month', () => {
    const date = { year: 2021, month: 0, day: 10 };
    const result = addDays(date, 5);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(0);
    expect(result.day).toBe(15);
  });

  it('adds negative days within same month', () => {
    const date = { year: 2021, month: 0, day: 15 };
    const result = addDays(date, -5);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(0);
    expect(result.day).toBe(10);
  });

  it('crosses month boundary when adding days', () => {
    const date = { year: 2021, month: 0, day: 30 };
    const result = addDays(date, 5);
    // Jan 30 + 5 days = Feb 4 (month 1, day 4)
    expect(result.month).toBe(1);
    expect(result.day).toBe(4);
  });

  it('preserves time components', () => {
    const date = { year: 2021, month: 0, day: 10, hour: 14, minute: 30 };
    const result = addDays(date, 1);
    expect(result.hour).toBe(14);
    expect(result.minute).toBe(30);
  });

  it('returns original date when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date = { year: 2021, month: 0, day: 10 };
    const result = addDays(date, 5);
    expect(result).toEqual(date);
  });
});

/* -------------------------------------------- */
/*  daysBetween() - Needs CalendarManager        */
/* -------------------------------------------- */

describe('daysBetween()', () => {
  it('returns 0 for same day', () => {
    const date = { year: 2021, month: 6, day: 15 };
    expect(daysBetween(date, date)).toBe(0);
  });

  it('returns 1 for adjacent days', () => {
    const date1 = { year: 2021, month: 0, day: 1 };
    const date2 = { year: 2021, month: 0, day: 2 };
    expect(daysBetween(date1, date2)).toBe(1);
  });

  it('returns negative for reversed dates', () => {
    const date1 = { year: 2021, month: 0, day: 10 };
    const date2 = { year: 2021, month: 0, day: 5 };
    expect(daysBetween(date1, date2)).toBe(-5);
  });

  it('counts days across month boundary', () => {
    const date1 = { year: 2021, month: 0, day: 30 };
    const date2 = { year: 2021, month: 1, day: 2 };
    // Jan 30 to Feb 2 = 3 days
    expect(daysBetween(date1, date2)).toBe(3);
  });

  it('returns 0 when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date1 = { year: 2021, month: 0, day: 1 };
    const date2 = { year: 2021, month: 0, day: 10 };
    expect(daysBetween(date1, date2)).toBe(0);
  });
});

/* -------------------------------------------- */
/*  dayOfWeek() - Needs CalendarManager          */
/* -------------------------------------------- */

describe('dayOfWeek()', () => {
  it('returns a number', () => {
    const date = { year: 2021, month: 0, day: 1 };
    const result = dayOfWeek(date);
    expect(typeof result).toBe('number');
  });

  it('returns value within 0..6 for 7-day week', () => {
    const date = { year: 2021, month: 3, day: 15 };
    const result = dayOfWeek(date);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(7);
  });

  it('consecutive days have consecutive weekday indices', () => {
    const day1 = dayOfWeek({ year: 2021, month: 0, day: 1 });
    const day2 = dayOfWeek({ year: 2021, month: 0, day: 2 });
    expect(day2).toBe((day1 + 1) % 7);
  });

  it('returns 0 when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date = { year: 2021, month: 0, day: 1 };
    expect(dayOfWeek(date)).toBe(0);
  });
});

/* -------------------------------------------- */
/*  getCurrentDate() - Needs game.time mock      */
/* -------------------------------------------- */

describe('getCurrentDate()', () => {
  it('returns object with expected shape', () => {
    // game.time.components is set up by the foundry mock
    const result = getCurrentDate();
    expect(result).toHaveProperty('year');
    expect(result).toHaveProperty('month');
    expect(result).toHaveProperty('day');
    expect(typeof result.year).toBe('number');
    expect(typeof result.month).toBe('number');
    expect(typeof result.day).toBe('number');
  });

  it('day is 1-indexed', () => {
    const result = getCurrentDate();
    expect(result.day).toBeGreaterThanOrEqual(1);
  });
});
