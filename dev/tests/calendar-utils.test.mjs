/**
 * Tests for calendar-utils.mjs
 * @module Tests/CalendarUtils
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localization before importing
vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: (key) => key,
  format: (key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) {
      result = result.replace(`{${k}}`, String(v));
    }
    return result;
  }
}));

import { preLocalizeCalendar, findFestivalDay, getMonthAbbreviation, formatMonthDay, formatMonthDayYear, formatEraTemplate } from '../../scripts/calendar/calendar-utils.mjs';
import { addCalendarGetters } from '../__mocks__/calendar-manager.mjs';

/* -------------------------------------------- */
/*  Mock Calendar Data                          */
/* -------------------------------------------- */

const mockCalendar = addCalendarGetters({
  months: {
    values: [
      { name: 'January', abbreviation: 'Jan', days: 31 },
      { name: 'February', abbreviation: 'Feb', days: 28 }
    ]
  },
  years: {
    yearZero: 0
  },
  festivals: [
    { name: 'New Year', month: 1, day: 1 },
    { name: 'Festival Day', month: 2, day: 15 }
  ],
  timeToComponents: vi.fn((_time) => ({
    year: 2024,
    month: 0,
    dayOfMonth: 0,
    hour: 0,
    minute: 0,
    second: 0
  }))
});

/* -------------------------------------------- */
/*  preLocalizeCalendar()                       */
/* -------------------------------------------- */

describe('preLocalizeCalendar()', () => {
  it('localizes string values', () => {
    const data = { name: 'CALENDAR.Name' };
    const result = preLocalizeCalendar(data);
    expect(result.name).toBe('CALENDAR.Name');
  });

  it('recursively localizes nested objects', () => {
    const data = {
      level1: {
        level2: {
          name: 'DEEP.Key'
        }
      }
    };
    const result = preLocalizeCalendar(data);
    expect(result.level1.level2.name).toBe('DEEP.Key');
  });

  it('recursively localizes arrays of objects', () => {
    const data = {
      items: [{ name: 'Item1' }, { name: 'Item2' }]
    };
    const result = preLocalizeCalendar(data);
    expect(result.items[0].name).toBe('Item1');
    expect(result.items[1].name).toBe('Item2');
  });

  it('preserves non-string values', () => {
    const data = {
      count: 5,
      enabled: true,
      items: [1, 2, 3]
    };
    const result = preLocalizeCalendar(data);
    expect(result.count).toBe(5);
    expect(result.enabled).toBe(true);
    expect(result.items).toEqual([1, 2, 3]);
  });

  it('handles null values', () => {
    const data = { value: null };
    const result = preLocalizeCalendar(data);
    expect(result.value).toBe(null);
  });
});

/* -------------------------------------------- */
/*  findFestivalDay()                           */
/* -------------------------------------------- */

describe('findFestivalDay()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for calendar without festivals', () => {
    const calWithoutFestivals = addCalendarGetters({ ...mockCalendar, festivals: [] });
    const result = findFestivalDay(calWithoutFestivals, { month: 0, dayOfMonth: 0 });
    expect(result).toBe(null);
  });

  it('returns null for undefined festivals', () => {
    const calWithoutFestivals = addCalendarGetters({ ...mockCalendar, festivals: undefined });
    const result = findFestivalDay(calWithoutFestivals, { month: 0, dayOfMonth: 0 });
    expect(result).toBe(null);
  });

  it('finds matching festival by components', () => {
    // Festival is month: 1 (1-indexed), day: 1 (1-indexed)
    // Components are month: 0 (0-indexed), dayOfMonth: 0 (0-indexed)
    const result = findFestivalDay(mockCalendar, { month: 0, dayOfMonth: 0 });
    expect(result).toEqual({ name: 'New Year', month: 1, day: 1 });
  });

  it('returns null when no festival matches', () => {
    const result = findFestivalDay(mockCalendar, { month: 5, dayOfMonth: 15 });
    expect(result).toBe(null);
  });

  it('finds festival in later month', () => {
    // Festival is month: 2 (Feb), day: 15
    const result = findFestivalDay(mockCalendar, { month: 1, dayOfMonth: 14 });
    expect(result).toEqual({ name: 'Festival Day', month: 2, day: 15 });
  });
});

/* -------------------------------------------- */
/*  getMonthAbbreviation()                      */
/* -------------------------------------------- */

describe('getMonthAbbreviation()', () => {
  it('returns abbreviation when available', () => {
    const month = { name: 'January', abbreviation: 'Jan' };
    expect(getMonthAbbreviation(month)).toBe('Jan');
  });

  it('returns full name when abbreviation is undefined', () => {
    const month = { name: 'January' };
    expect(getMonthAbbreviation(month)).toBe('January');
  });

  it('returns full name when abbreviation is null', () => {
    const month = { name: 'January', abbreviation: null };
    expect(getMonthAbbreviation(month)).toBe('January');
  });
});

/* -------------------------------------------- */
/*  formatMonthDay()                            */
/* -------------------------------------------- */

describe('formatMonthDay()', () => {
  it('returns festival name for festival day', () => {
    const result = formatMonthDay(mockCalendar, { month: 0, dayOfMonth: 0 });
    expect(result).toBe('New Year');
  });

  it('returns localization key for non-festival day', () => {
    const result = formatMonthDay(mockCalendar, { month: 0, dayOfMonth: 14 });
    // Mock format returns the localization key (real impl would interpolate)
    expect(result).toBe('CALENDARIA.Formatters.DayMonth');
  });

  it('returns localization key when abbreviated option is set', () => {
    const result = formatMonthDay(mockCalendar, { month: 0, dayOfMonth: 14 }, { abbreviated: true });
    // Still returns the localization key
    expect(result).toBe('CALENDARIA.Formatters.DayMonth');
  });
});

/* -------------------------------------------- */
/*  formatMonthDayYear()                        */
/* -------------------------------------------- */

describe('formatMonthDayYear()', () => {
  it('returns FestivalDayYear localization key for festival day', () => {
    const result = formatMonthDayYear(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0 });
    // Mock format returns the localization key
    expect(result).toBe('CALENDARIA.Formatters.FestivalDayYear');
  });

  it('returns DayMonthYear localization key for non-festival day', () => {
    const result = formatMonthDayYear(mockCalendar, { year: 2024, month: 0, dayOfMonth: 14 });
    expect(result).toBe('CALENDARIA.Formatters.DayMonthYear');
  });

  it('returns localization key when abbreviated option is set', () => {
    const result = formatMonthDayYear(mockCalendar, { year: 2024, month: 0, dayOfMonth: 14 }, { abbreviated: true });
    expect(result).toBe('CALENDARIA.Formatters.DayMonthYear');
  });

  it('returns localization key with yearZero offset applied', () => {
    const calWithOffset = addCalendarGetters({ ...mockCalendar, years: { yearZero: 1000 } });
    const result = formatMonthDayYear(calWithOffset, { year: 24, month: 0, dayOfMonth: 14 });
    // Still returns the localization key - actual year calculation happens internally
    expect(result).toBe('CALENDARIA.Formatters.DayMonthYear');
  });
});

/* -------------------------------------------- */
/*  formatEraTemplate()                         */
/* -------------------------------------------- */

describe('formatEraTemplate()', () => {
  it('replaces YYYY with year value', () => {
    const result = formatEraTemplate('YYYY', { year: 2024 });
    expect(result).toBe('2024');
  });

  it('replaces YY with 2-digit year', () => {
    const result = formatEraTemplate('YY', { year: 2024 });
    expect(result).toBe('24');
  });

  it('replaces G with abbreviation', () => {
    const result = formatEraTemplate('G', { abbreviation: 'CE' });
    expect(result).toBe('CE');
  });

  it('replaces GGGG with era name', () => {
    const result = formatEraTemplate('GGGG', { era: 'Common Era' });
    expect(result).toBe('Common Era');
  });

  it('replaces yy with year in era', () => {
    const result = formatEraTemplate('yy', { yearInEra: 42 });
    expect(result).toBe('42');
  });

  it('handles multiple replacements', () => {
    const result = formatEraTemplate('YYYY G', { year: 2024, abbreviation: 'CE' });
    expect(result).toBe('2024 CE');
  });

  it('preserves unmatched text', () => {
    const result = formatEraTemplate('Year YYYY', { year: 2024 });
    expect(result).toBe('Year 2024');
  });

  it('uses fallback for era from name', () => {
    const result = formatEraTemplate('GGGG', { name: 'First Age' });
    expect(result).toBe('First Age');
  });

  it('uses fallback for abbreviation from short', () => {
    const result = formatEraTemplate('G', { short: 'FA' });
    expect(result).toBe('FA');
  });

  it('handles complex template', () => {
    const result = formatEraTemplate('Year yy of the GGGG (YYYY G)', {
      year: 2024,
      yearInEra: 24,
      era: 'Third Age',
      abbreviation: 'TA'
    });
    expect(result).toBe('Year 24 of the Third Age (2024 TA)');
  });
});
