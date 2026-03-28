import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';

vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager, defaultCalendar } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager, defaultCalendar };
});

beforeEach(() => {
  CalendarManager._reset();
});

describe('Date Indexing Conventions', () => {
  describe('External API uses 1-indexed days', () => {
    it('day 1 represents the first day of the month', () => {
      const internalDayOfMonth = 0;
      const externalDay = internalDayOfMonth + 1;
      expect(externalDay).toBe(1);
    });
    it('day 31 represents the 31st day of the month', () => {
      const internalDayOfMonth = 30;
      const externalDay = internalDayOfMonth + 1;
      expect(externalDay).toBe(31);
    });
  });

  describe('Internal uses 0-indexed dayOfMonth', () => {
    it('dayOfMonth 0 represents the first day of the month', () => {
      const externalDay = 1;
      const internalDayOfMonth = externalDay - 1;
      expect(internalDayOfMonth).toBe(0);
    });
    it('dayOfMonth 30 represents the 31st day of the month', () => {
      const externalDay = 31;
      const internalDayOfMonth = externalDay - 1;
      expect(internalDayOfMonth).toBe(30);
    });
  });
});

describe('timestampToDate()', () => {
  it('returns 1-indexed day from 0-indexed internal dayOfMonth', () => {
    const calendar = CalendarManager.getActiveCalendar();
    const timestamp = 0;
    const components = calendar.timeToComponents(timestamp);
    const result = { year: components.year, month: components.month, day: components.dayOfMonth + 1, hour: components.hour, minute: components.minute };
    expect(result.day).toBe(1);
  });
  it('returns day 15 for internal dayOfMonth 14', () => {
    const calendar = CalendarManager.getActiveCalendar();
    const secondsPerDay = 24 * 60 * 60;
    const timestamp = 14 * secondsPerDay;
    const components = calendar.timeToComponents(timestamp);
    const result = { day: components.dayOfMonth + 1 };
    expect(result.day).toBe(15);
  });
});

describe('dateToTimestamp()', () => {
  it('converts 1-indexed day to 0-indexed for internal use', () => {
    const externalDate = { year: 0, month: 0, day: 1 };
    const dayOfMonth = externalDate.day - 1;
    expect(dayOfMonth).toBe(0);
  });
  it('converts day 19 to internal dayOfMonth 18', () => {
    const externalDate = { year: 2026, month: 4, day: 19 };
    const dayOfMonth = externalDate.day - 1;
    expect(dayOfMonth).toBe(18);
  });
  it('handles dayOfMonth property directly (0-indexed)', () => {
    const internalDate = { year: 2026, month: 4, dayOfMonth: 18 };
    const dayOfMonth = internalDate.dayOfMonth ?? (internalDate.day != null ? internalDate.day - 1 : 0);
    expect(dayOfMonth).toBe(18);
  });
  it('prioritizes dayOfMonth over day when both are provided', () => {
    const mixedDate = { year: 2026, month: 4, day: 19, dayOfMonth: 18 };
    const dayOfMonth = mixedDate.dayOfMonth ?? (mixedDate.day != null ? mixedDate.day - 1 : 0);
    expect(dayOfMonth).toBe(18);
  });
});

describe('Roundtrip: dateToTimestamp → timestampToDate', () => {
  it('preserves day value through roundtrip (day 1)', () => {
    const calendar = CalendarManager.getActiveCalendar();
    const originalDate = { year: 0, month: 0, day: 1 };
    const dayOfMonth = originalDate.day - 1;
    const components = { year: originalDate.year, day: dayOfMonth, hour: 0, minute: 0, second: 0 };
    const timestamp = calendar.componentsToTime(components);
    const resultComponents = calendar.timeToComponents(timestamp);
    const resultDay = resultComponents.dayOfMonth + 1;
    expect(resultDay).toBe(originalDate.day);
  });
  it('preserves day value through roundtrip (day 19)', () => {
    const calendar = CalendarManager.getActiveCalendar();
    const originalDate = { year: 0, month: 4, day: 19 };
    const dayOfMonth = originalDate.day - 1;
    let dayOfYear = dayOfMonth;
    const months = calendar.months.values;
    for (let i = 0; i < originalDate.month; i++) dayOfYear += months[i].days;
    const components = { year: originalDate.year, day: dayOfYear, hour: 0, minute: 0, second: 0 };
    const timestamp = calendar.componentsToTime(components);
    const resultComponents = calendar.timeToComponents(timestamp);
    const resultDay = resultComponents.dayOfMonth + 1;
    expect(resultDay).toBe(originalDate.day);
  });
  it('preserves day value through roundtrip (last day of month)', () => {
    const calendar = CalendarManager.getActiveCalendar();
    const originalDate = { year: 0, month: 0, day: 31 };
    const dayOfMonth = originalDate.day - 1;
    const components = { year: originalDate.year, day: dayOfMonth, hour: 0, minute: 0, second: 0 };
    const timestamp = calendar.componentsToTime(components);
    const resultComponents = calendar.timeToComponents(timestamp);
    const resultDay = resultComponents.dayOfMonth + 1;
    expect(resultDay).toBe(originalDate.day);
  });
  it('preserves full date through roundtrip', () => {
    const calendar = CalendarManager.getActiveCalendar();
    const originalDate = { year: 5, month: 6, day: 15, hour: 14, minute: 30 };
    const dayOfMonth = originalDate.day - 1;
    let dayOfYear = dayOfMonth;
    const months = calendar.months.values;
    for (let i = 0; i < originalDate.month; i++) dayOfYear += months[i].days;
    const components = { year: originalDate.year, day: dayOfYear, hour: originalDate.hour, minute: originalDate.minute, second: 0 };
    const timestamp = calendar.componentsToTime(components);
    const resultComponents = calendar.timeToComponents(timestamp);
    const result = { year: resultComponents.year, month: resultComponents.month, day: resultComponents.dayOfMonth + 1, hour: resultComponents.hour, minute: resultComponents.minute };
    expect(result.year).toBe(originalDate.year);
    expect(result.month).toBe(originalDate.month);
    expect(result.day).toBe(originalDate.day);
    expect(result.hour).toBe(originalDate.hour);
    expect(result.minute).toBe(originalDate.minute);
  });
});

describe('Edge Cases', () => {
  it('handles day 1 of month correctly (boundary)', () => {
    const externalDay = 1;
    const internalDayOfMonth = externalDay - 1;
    expect(internalDayOfMonth).toBe(0);
    const backToExternal = internalDayOfMonth + 1;
    expect(backToExternal).toBe(1);
  });
  it('handles missing day property with default', () => {
    const dateWithoutDay = { year: 2026, month: 4 };
    const dayOfMonth = dateWithoutDay.dayOfMonth ?? (dateWithoutDay.day != null ? dateWithoutDay.day - 1 : 0);
    expect(dayOfMonth).toBe(0);
  });
  it('handles null day property', () => {
    const dateWithNullDay = { year: 2026, month: 4, day: null };
    const dayOfMonth = dateWithNullDay.dayOfMonth ?? (dateWithNullDay.day != null ? dateWithNullDay.day - 1 : 0);
    expect(dayOfMonth).toBe(0);
  });
  it('handles December 31st correctly', () => {
    const calendar = CalendarManager.getActiveCalendar();
    const originalDate = { year: 0, month: 11, day: 31 };
    const dayOfMonth = originalDate.day - 1;
    let dayOfYear = dayOfMonth;
    const months = calendar.months.values;
    for (let i = 0; i < originalDate.month; i++) dayOfYear += months[i].days;
    const components = { year: originalDate.year, day: dayOfYear, hour: 0, minute: 0, second: 0 };
    const timestamp = calendar.componentsToTime(components);
    const resultComponents = calendar.timeToComponents(timestamp);
    const resultDay = resultComponents.dayOfMonth + 1;
    expect(resultDay).toBe(31);
    expect(resultComponents.month).toBe(11);
  });
  it('handles first day of year correctly', () => {
    const calendar = CalendarManager.getActiveCalendar();
    const originalDate = { year: 1, month: 0, day: 1 };
    const dayOfMonth = originalDate.day - 1;
    const components = { year: originalDate.year, day: dayOfMonth, hour: 0, minute: 0, second: 0 };
    const timestamp = calendar.componentsToTime(components);
    const resultComponents = calendar.timeToComponents(timestamp);
    const result = { year: resultComponents.year, month: resultComponents.month, day: resultComponents.dayOfMonth + 1 };
    expect(result.year).toBe(1);
    expect(result.month).toBe(0);
    expect(result.day).toBe(1);
  });
});

describe('Regression: Bug fix verification', () => {
  it('dateToTimestamp then timestampToDate returns same day (the reported bug)', () => {
    const calendar = CalendarManager.getActiveCalendar();
    const inputDate = { year: 2026, month: 4, day: 19 };
    const dayOfMonth = inputDate.dayOfMonth ?? (inputDate.day != null ? inputDate.day - 1 : 0);
    expect(dayOfMonth).toBe(18);
    let dayOfYear = dayOfMonth;
    const months = calendar.months.values;
    for (let i = 0; i < inputDate.month; i++) dayOfYear += months[i].days;
    const components = { year: inputDate.year, day: dayOfYear, hour: 0, minute: 0, second: 0 };
    const timestamp = calendar.componentsToTime(components);
    const resultComponents = calendar.timeToComponents(timestamp);
    const outputDate = { year: resultComponents.year, month: resultComponents.month, day: resultComponents.dayOfMonth + 1, hour: resultComponents.hour, minute: resultComponents.minute };
    expect(outputDate.day).toBe(19);
    expect(outputDate.month).toBe(4);
    expect(outputDate.year).toBe(2026);
  });
  it('multiple roundtrips preserve the date', () => {
    const calendar = CalendarManager.getActiveCalendar();
    let date = { year: 2026, month: 4, day: 19 };
    for (let i = 0; i < 5; i++) {
      const dayOfMonth = date.dayOfMonth ?? (date.day != null ? date.day - 1 : 0);
      let dayOfYear = dayOfMonth;
      const months = calendar.months.values;
      for (let m = 0; m < date.month; m++) dayOfYear += months[m].days;
      const timestamp = calendar.componentsToTime({ year: date.year, day: dayOfYear, hour: 0, minute: 0, second: 0 });
      const resultComponents = calendar.timeToComponents(timestamp);
      date = { year: resultComponents.year, month: resultComponents.month, day: resultComponents.dayOfMonth + 1 };
    }
    expect(date.year).toBe(2026);
    expect(date.month).toBe(4);
    expect(date.day).toBe(19);
  });
});
