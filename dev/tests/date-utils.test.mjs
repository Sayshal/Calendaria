import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import { addDays, addHours, addMinutes, addMonths, addSeconds, addYears, compareDates, compareDays, dayOfWeek, daysBetween, getCurrentDate, hoursBetween, isSameDay, isValidDate, minutesBetween, monthsBetween, secondsBetween } from '../../scripts/notes/date-utils.mjs';

vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager, defaultCalendar } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager, defaultCalendar };
});

beforeEach(() => {
  CalendarManager._reset();
});

describe('compareDates()', () => {
  it('returns -1 when date1 is earlier by year', () => {
    const date1 = { year: 2020, month: 6, dayOfMonth: 14 };
    const date2 = { year: 2021, month: 1, dayOfMonth: 0 };
    expect(compareDates(date1, date2)).toBe(-1);
  });
  it('returns 1 when date1 is later by year', () => {
    const date1 = { year: 2022, month: 1, dayOfMonth: 0 };
    const date2 = { year: 2021, month: 12, dayOfMonth: 30 };
    expect(compareDates(date1, date2)).toBe(1);
  });
  it('returns -1 when date1 is earlier by month (same year)', () => {
    const date1 = { year: 2021, month: 3, dayOfMonth: 14 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 0 };
    expect(compareDates(date1, date2)).toBe(-1);
  });
  it('returns 1 when date1 is later by month (same year)', () => {
    const date1 = { year: 2021, month: 9, dayOfMonth: 0 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 29 };
    expect(compareDates(date1, date2)).toBe(1);
  });
  it('returns -1 when date1 is earlier by day (same month)', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 9 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 19 };
    expect(compareDates(date1, date2)).toBe(-1);
  });
  it('returns 1 when date1 is later by day (same month)', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 24 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14 };
    expect(compareDates(date1, date2)).toBe(1);
  });
  it('returns -1 when date1 is earlier by hour (same day)', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 14, hour: 10 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14, hour: 14 };
    expect(compareDates(date1, date2)).toBe(-1);
  });
  it('returns 1 when date1 is later by hour (same day)', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 14, hour: 18 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14, hour: 9 };
    expect(compareDates(date1, date2)).toBe(1);
  });
  it('returns -1 when date1 is earlier by minute (same hour)', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 14, hour: 14, minute: 15 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14, hour: 14, minute: 45 };
    expect(compareDates(date1, date2)).toBe(-1);
  });
  it('returns 0 when dates are equal', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 14, hour: 14, minute: 30 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14, hour: 14, minute: 30 };
    expect(compareDates(date1, date2)).toBe(0);
  });
  it('treats missing hour as 0', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 14 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14, hour: 0 };
    expect(compareDates(date1, date2)).toBe(0);
  });
  it('treats missing minute as 0', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 14, hour: 14 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14, hour: 14, minute: 0 };
    expect(compareDates(date1, date2)).toBe(0);
  });
});

describe('isSameDay()', () => {
  it('returns true for same day', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 14 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14 };
    expect(isSameDay(date1, date2)).toBe(true);
  });
  it('returns true for same day with different times', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 14, hour: 9, minute: 0 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14, hour: 18, minute: 30 };
    expect(isSameDay(date1, date2)).toBe(true);
  });
  it('returns false for different years', () => {
    const date1 = { year: 2020, month: 6, dayOfMonth: 14 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14 };
    expect(isSameDay(date1, date2)).toBe(false);
  });
  it('returns false for different months', () => {
    const date1 = { year: 2021, month: 5, dayOfMonth: 14 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14 };
    expect(isSameDay(date1, date2)).toBe(false);
  });
  it('returns false for different days', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 13 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14 };
    expect(isSameDay(date1, date2)).toBe(false);
  });
});

describe('compareDays()', () => {
  it('returns 0 for same day (ignoring time)', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 14, hour: 9 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14, hour: 18 };
    expect(compareDays(date1, date2)).toBe(0);
  });
  it('returns -1 when date1 is earlier', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 13 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14 };
    expect(compareDays(date1, date2)).toBe(-1);
  });
  it('returns 1 when date1 is later', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 15 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 14 };
    expect(compareDays(date1, date2)).toBe(1);
  });
  it('compares by year first', () => {
    const date1 = { year: 2020, month: 12, dayOfMonth: 30 };
    const date2 = { year: 2021, month: 1, dayOfMonth: 0 };
    expect(compareDays(date1, date2)).toBe(-1);
  });
  it('compares by month second', () => {
    const date1 = { year: 2021, month: 5, dayOfMonth: 30 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 0 };
    expect(compareDays(date1, date2)).toBe(-1);
  });
});

describe('monthsBetween()', () => {
  it('returns 0 for same month', () => {
    const date1 = { year: 2021, month: 6, dayOfMonth: 0 };
    const date2 = { year: 2021, month: 6, dayOfMonth: 29 };
    expect(monthsBetween(date1, date2)).toBe(0);
  });
  it('returns positive for later month same year', () => {
    const date1 = { year: 2021, month: 3, dayOfMonth: 0 };
    const date2 = { year: 2021, month: 9, dayOfMonth: 0 };
    expect(monthsBetween(date1, date2)).toBe(6);
  });
  it('returns negative for earlier month same year', () => {
    const date1 = { year: 2021, month: 9, dayOfMonth: 0 };
    const date2 = { year: 2021, month: 3, dayOfMonth: 0 };
    expect(monthsBetween(date1, date2)).toBe(-6);
  });
  it('accounts for year difference', () => {
    const date1 = { year: 2020, month: 10, dayOfMonth: 0 };
    const date2 = { year: 2021, month: 2, dayOfMonth: 0 };
    expect(monthsBetween(date1, date2)).toBe(4);
  });
  it('returns 0 when no calendar available', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date1 = { year: 2021, month: 3, dayOfMonth: 0 };
    const date2 = { year: 2021, month: 9, dayOfMonth: 0 };
    expect(monthsBetween(date1, date2)).toBe(0);
  });
});

describe('addMonths()', () => {
  it('adds months within same year', () => {
    const date = { year: 2021, month: 3, dayOfMonth: 14 };
    const result = addMonths(date, 2);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(5);
    expect(result.dayOfMonth).toBe(14);
  });
  it('wraps to next year when adding', () => {
    const date = { year: 2021, month: 10, dayOfMonth: 14 };
    const result = addMonths(date, 3);
    expect(result.year).toBe(2022);
    expect(result.month).toBe(1);
  });
  it('subtracts months within same year', () => {
    const date = { year: 2021, month: 6, dayOfMonth: 14 };
    const result = addMonths(date, -2);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(4);
  });
  it('wraps to previous year when subtracting', () => {
    const date = { year: 2021, month: 2, dayOfMonth: 14 };
    const result = addMonths(date, -4);
    expect(result.year).toBe(2020);
    expect(result.month).toBe(10);
  });
  it('clamps day to max days in new month', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 30 };
    const result = addMonths(date, 1);
    expect(result.dayOfMonth).toBeLessThanOrEqual(27);
  });
  it('returns original date when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date = { year: 2021, month: 3, dayOfMonth: 14 };
    const result = addMonths(date, 2);
    expect(result).toEqual(date);
  });
});

describe('addYears()', () => {
  it('adds years', () => {
    const date = { year: 2021, month: 6, dayOfMonth: 14 };
    const result = addYears(date, 5);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(6);
    expect(result.dayOfMonth).toBe(14);
  });
  it('subtracts years', () => {
    const date = { year: 2021, month: 6, dayOfMonth: 14 };
    const result = addYears(date, -10);
    expect(result.year).toBe(2011);
  });
  it('preserves time components', () => {
    const date = { year: 2021, month: 6, dayOfMonth: 14, hour: 14, minute: 30 };
    const result = addYears(date, 1);
    expect(result.hour).toBe(14);
    expect(result.minute).toBe(30);
  });
  it('returns original date when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date = { year: 2021, month: 6, dayOfMonth: 14 };
    const result = addYears(date, 5);
    expect(result).toEqual(date);
  });
});

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
    expect(isValidDate({ month: 6, dayOfMonth: 14 })).toBe(false);
  });
  it('returns false for missing month', () => {
    expect(isValidDate({ year: 2021, dayOfMonth: 14 })).toBe(false);
  });
  it('returns false for missing dayOfMonth', () => {
    expect(isValidDate({ year: 2021, month: 6 })).toBe(false);
  });
  it('returns true for valid date', () => {
    expect(isValidDate({ year: 2021, month: 6, dayOfMonth: 14 })).toBe(true);
  });
  it('returns false for invalid month', () => {
    expect(isValidDate({ year: 2021, month: 13, dayOfMonth: 14 })).toBe(false);
    expect(isValidDate({ year: 2021, month: -1, dayOfMonth: 14 })).toBe(false);
  });
  it('returns false for dayOfMonth < 0', () => {
    expect(isValidDate({ year: 2021, month: 6, dayOfMonth: -1 })).toBe(false);
  });
  it('returns false for dayOfMonth >= days in month', () => {
    expect(isValidDate({ year: 2021, month: 1, dayOfMonth: 31 })).toBe(false);
  });
  it('returns true when no calendar (basic validation only)', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    expect(isValidDate({ year: 2021, month: 6, dayOfMonth: 14 })).toBe(true);
  });
});

describe('addDays()', () => {
  it('adds positive days within same month', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 9 };
    const result = addDays(date, 5);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(0);
    expect(result.dayOfMonth).toBe(14);
  });
  it('adds negative days within same month', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 14 };
    const result = addDays(date, -5);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(0);
    expect(result.dayOfMonth).toBe(9);
  });
  it('crosses month boundary when adding days', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 29 };
    const result = addDays(date, 5);
    expect(result.month).toBe(1);
    expect(result.dayOfMonth).toBe(3);
  });
  it('preserves time components', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 9, hour: 14, minute: 30 };
    const result = addDays(date, 1);
    expect(result.hour).toBe(14);
    expect(result.minute).toBe(30);
  });
  it('returns original date when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date = { year: 2021, month: 0, dayOfMonth: 9 };
    const result = addDays(date, 5);
    expect(result).toEqual(date);
  });
});

describe('daysBetween()', () => {
  it('returns 0 for same day', () => {
    const date = { year: 2021, month: 6, dayOfMonth: 14 };
    expect(daysBetween(date, date)).toBe(0);
  });
  it('returns 1 for adjacent days', () => {
    const date1 = { year: 2021, month: 0, dayOfMonth: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 1 };
    expect(daysBetween(date1, date2)).toBe(1);
  });
  it('returns negative for reversed dates', () => {
    const date1 = { year: 2021, month: 0, dayOfMonth: 9 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 4 };
    expect(daysBetween(date1, date2)).toBe(-5);
  });
  it('counts days across month boundary', () => {
    const date1 = { year: 2021, month: 0, dayOfMonth: 29 };
    const date2 = { year: 2021, month: 1, dayOfMonth: 1 };
    expect(daysBetween(date1, date2)).toBe(3);
  });
  it('returns 0 when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date1 = { year: 2021, month: 0, dayOfMonth: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 9 };
    expect(daysBetween(date1, date2)).toBe(0);
  });
});

describe('dayOfWeek()', () => {
  it('returns a number', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 0 };
    const result = dayOfWeek(date);
    expect(typeof result).toBe('number');
  });
  it('returns value within 0..6 for 7-day week', () => {
    const date = { year: 2021, month: 3, dayOfMonth: 14 };
    const result = dayOfWeek(date);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(7);
  });
  it('consecutive days have consecutive weekday indices', () => {
    const day1 = dayOfWeek({ year: 2021, month: 0, dayOfMonth: 0 });
    const day2 = dayOfWeek({ year: 2021, month: 0, dayOfMonth: 1 });
    expect(day2).toBe((day1 + 1) % 7);
  });
  it('returns 0 when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date = { year: 2021, month: 0, dayOfMonth: 0 };
    expect(dayOfWeek(date)).toBe(0);
  });
});

describe('getCurrentDate()', () => {
  it('returns object with expected shape', () => {
    const result = getCurrentDate();
    expect(result).toHaveProperty('year');
    expect(result).toHaveProperty('month');
    expect(result).toHaveProperty('dayOfMonth');
    expect(typeof result.year).toBe('number');
    expect(typeof result.month).toBe('number');
    expect(typeof result.dayOfMonth).toBe('number');
  });
  it('dayOfMonth is 0-indexed', () => {
    const result = getCurrentDate();
    expect(result.dayOfMonth).toBeGreaterThanOrEqual(0);
  });
});

describe('addHours()', () => {
  it('adds hours within the same day', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 0, hour: 6, minute: 0 };
    const result = addHours(date, 3);
    expect(result.year).toBe(2021);
    expect(result.month).toBe(0);
    expect(result.dayOfMonth).toBe(0);
    expect(result.hour).toBe(9);
  });
  it('crosses day boundary when adding hours', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 0, hour: 22, minute: 0 };
    const result = addHours(date, 5);
    expect(result.dayOfMonth).toBe(1);
    expect(result.hour).toBe(3);
  });
  it('subtracts hours', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 1, hour: 3, minute: 0 };
    const result = addHours(date, -5);
    expect(result.dayOfMonth).toBe(0);
    expect(result.hour).toBe(22);
  });
});

describe('addMinutes()', () => {
  it('adds minutes within the same hour', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 0, hour: 6, minute: 15 };
    const result = addMinutes(date, 30);
    expect(result.hour).toBe(6);
    expect(result.minute).toBe(45);
  });
  it('crosses hour boundary', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 0, hour: 6, minute: 45 };
    const result = addMinutes(date, 30);
    expect(result.hour).toBe(7);
    expect(result.minute).toBe(15);
  });
});

describe('addSeconds()', () => {
  it('adds a full day of seconds', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const result = addSeconds(date, 86400);
    expect(result.dayOfMonth).toBe(1);
    expect(result.hour).toBe(0);
  });
  it('adds partial-day seconds', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const result = addSeconds(date, 3600);
    expect(result.dayOfMonth).toBe(0);
    expect(result.hour).toBe(1);
  });
});

describe('secondsBetween()', () => {
  it('returns 0 for same date and time', () => {
    const date = { year: 2021, month: 0, dayOfMonth: 0, hour: 12, minute: 0 };
    expect(secondsBetween(date, date)).toBe(0);
  });
  it('returns seconds for a one-day difference', () => {
    const date1 = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 1, hour: 0, minute: 0 };
    expect(secondsBetween(date1, date2)).toBe(86400);
  });
  it('returns negative for reversed dates', () => {
    const date1 = { year: 2021, month: 0, dayOfMonth: 1, hour: 0, minute: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    expect(secondsBetween(date1, date2)).toBe(-86400);
  });
  it('includes hour and minute differences', () => {
    const date1 = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 0, hour: 1, minute: 30 };
    expect(secondsBetween(date1, date2)).toBe(5400);
  });
  it('returns 0 when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date1 = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 1, hour: 0, minute: 0 };
    expect(secondsBetween(date1, date2)).toBe(0);
  });
});

describe('hoursBetween()', () => {
  it('returns hours for a one-day difference', () => {
    const date1 = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 1, hour: 0, minute: 0 };
    expect(hoursBetween(date1, date2)).toBe(24);
  });
  it('returns fractional hours', () => {
    const date1 = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 0, hour: 1, minute: 30 };
    expect(hoursBetween(date1, date2)).toBe(1.5);
  });
  it('returns 0 when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date1 = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 1, hour: 0, minute: 0 };
    expect(hoursBetween(date1, date2)).toBe(0);
  });
});

describe('minutesBetween()', () => {
  it('returns minutes for a one-hour difference', () => {
    const date1 = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 0, hour: 1, minute: 0 };
    expect(minutesBetween(date1, date2)).toBe(60);
  });
  it('returns negative for reversed dates', () => {
    const date1 = { year: 2021, month: 0, dayOfMonth: 0, hour: 1, minute: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    expect(minutesBetween(date1, date2)).toBe(-60);
  });
  it('returns 0 when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    const date1 = { year: 2021, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const date2 = { year: 2021, month: 0, dayOfMonth: 0, hour: 1, minute: 0 };
    expect(minutesBetween(date1, date2)).toBe(0);
  });
});
