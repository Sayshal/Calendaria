import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCalendarGetters } from '../__mocks__/calendar-manager.mjs';

const mockNotesByDate = new Map();
const makeKey = (y, m, d) => `${y}:${m}:${d}`;
const setMockNotes = (calendarId, y, m, d, stubs) => mockNotesByDate.set(`${calendarId}|${makeKey(y, m, d)}`, stubs);

vi.mock('../../scripts/notes/_module.mjs', () => ({
  NoteManager: {
    getNotesForDate: (year, month, dayOfMonth, calendarId) => mockNotesByDate.get(`${calendarId}|${makeKey(year, month, dayOfMonth)}`) ?? [],
    getAllNotes: () => []
  }
}));

vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: (key) => key,
  format: (key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) result = result.replace(`{${k}}`, String(v));
    return result;
  }
}));

const { findFestivalDay, formatEraTemplate, formatMonthDay, formatMonthDayYear, getMonthAbbreviation, preLocalizeCalendar } = await import('../../scripts/calendar/calendar-utils.mjs');

const mockCalendar = addCalendarGetters({
  metadata: { id: 'test-cal' },
  months: { values: [ { name: 'January', abbreviation: 'Jan', days: 31 }, { name: 'February', abbreviation: 'Feb', days: 28 } ] },
  years: { yearZero: 0 },
  festivals: [ { name: 'New Year', month: 0, dayOfMonth: 0 }, { name: 'Festival Day', month: 1, dayOfMonth: 14 } ],
  timeToComponents: vi.fn((_time) => ({ year: 2024, month: 0, dayOfMonth: 0, hour: 0, minute: 0, second: 0 }))
});

const noteStub = (name, month, dayOfMonth, festivalKey = 'fest') => ({
  id: `note-${festivalKey}`,
  name,
  flagData: {
    icon: 'fas fa-star',
    color: '#f0a500',
    duration: 1,
    hasDuration: false,
    conditionTree: { type: 'group', mode: 'and', children: [] },
    startDate: { month, dayOfMonth },
    linkedFestival: { calendarId: 'test-cal', festivalKey, countsForWeekday: true }
  }
});

describe('preLocalizeCalendar()', () => {
  it('localizes name, abbreviation, and description keys', () => {
    const data = { name: 'CALENDAR.Name', abbreviation: 'CALENDAR.Abbr', description: 'CALENDAR.Desc' };
    preLocalizeCalendar(data);
    expect(data.name).toBe('CALENDAR.Name');
    expect(data.abbreviation).toBe('CALENDAR.Abbr');
    expect(data.description).toBe('CALENDAR.Desc');
  });
  it('recursively localizes nested objects', () => {
    const data = { level1: { level2: { name: 'DEEP.Key' } } };
    preLocalizeCalendar(data);
    expect(data.level1.level2.name).toBe('DEEP.Key');
  });
  it('recursively localizes arrays of objects', () => {
    const data = { items: [{ name: 'Item1' }, { name: 'Item2' }] };
    preLocalizeCalendar(data);
    expect(data.items[0].name).toBe('Item1');
    expect(data.items[1].name).toBe('Item2');
  });
  it('preserves non-localizable keys', () => {
    const data = { count: 5, enabled: true, label: 'SOME.Label' };
    preLocalizeCalendar(data);
    expect(data.count).toBe(5);
    expect(data.enabled).toBe(true);
    expect(data.label).toBe('SOME.Label');
  });
  it('handles null and undefined input', () => {
    expect(() => preLocalizeCalendar(null)).not.toThrow();
    expect(() => preLocalizeCalendar(undefined)).not.toThrow();
  });
});

describe('findFestivalDay()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotesByDate.clear();
  });
  it('returns null when no festival notes match the date', () => {
    const result = findFestivalDay(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0 });
    expect(result).toBe(null);
  });
  it('returns null when no calendarId is set', () => {
    const noIdCalendar = addCalendarGetters({ ...mockCalendar, metadata: {} });
    const result = findFestivalDay(noIdCalendar, { year: 2024, month: 0, dayOfMonth: 0 });
    expect(result).toBe(null);
  });
  it('finds matching festival note by components', () => {
    setMockNotes('test-cal', 2024, 0, 0, [noteStub('New Year', 0, 0, 'new-year')]);
    const result = findFestivalDay(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0 });
    expect(result).toMatchObject({ name: 'New Year', month: 0, dayOfMonth: 0, festivalKey: 'new-year' });
  });
  it('returns null when a linked festival note is not on this date', () => {
    const result = findFestivalDay(mockCalendar, { year: 2024, month: 5, dayOfMonth: 15 });
    expect(result).toBe(null);
  });
  it('finds festival in later month', () => {
    setMockNotes('test-cal', 2024, 1, 14, [noteStub('Festival Day', 1, 14, 'festival-day')]);
    const result = findFestivalDay(mockCalendar, { year: 2024, month: 1, dayOfMonth: 14 });
    expect(result).toMatchObject({ name: 'Festival Day', month: 1, dayOfMonth: 14, festivalKey: 'festival-day' });
  });
});

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

describe('formatMonthDay()', () => {
  beforeEach(() => {
    mockNotesByDate.clear();
  });
  it('returns festival name for festival day', () => {
    setMockNotes('test-cal', 2024, 0, 0, [noteStub('New Year', 0, 0, 'new-year')]);
    const result = formatMonthDay(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0 });
    expect(result).toBe('New Year');
  });
  it('returns localization key for non-festival day', () => {
    const result = formatMonthDay(mockCalendar, { month: 0, dayOfMonth: 14 });
    expect(result).toBe('CALENDARIA.Formatters.DayMonth');
  });
  it('returns localization key when abbreviated option is set', () => {
    const result = formatMonthDay(mockCalendar, { month: 0, dayOfMonth: 14 }, { abbreviated: true });
    expect(result).toBe('CALENDARIA.Formatters.DayMonth');
  });
});

describe('formatMonthDayYear()', () => {
  beforeEach(() => {
    mockNotesByDate.clear();
  });
  it('returns FestivalDayYear localization key for festival day', () => {
    setMockNotes('test-cal', 2024, 0, 0, [noteStub('New Year', 0, 0, 'new-year')]);
    const result = formatMonthDayYear(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0 });
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
    expect(result).toBe('CALENDARIA.Formatters.DayMonthYear');
  });
});

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
    const result = formatEraTemplate('Year yy of the GGGG (YYYY G)', { year: 2024, yearInEra: 24, era: 'Third Age', abbreviation: 'TA' });
    expect(result).toBe('Year 24 of the Third Age (2024 TA)');
  });
});
