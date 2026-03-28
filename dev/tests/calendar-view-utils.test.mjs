import { describe, expect, it, vi } from 'vitest';
import { getLeadingDays } from '../../scripts/utils/ui/calendar-view-utils.mjs';

vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: (key) => key,
  format: (key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) result = result.replace(`{${k}}`, String(v));
    return result;
  }
}));
vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager };
});
vi.mock('../../scripts/calendar/calendar-registry.mjs', () => ({ default: { getCalendar: vi.fn(), getAllCalendars: vi.fn(() => []), getActiveCalendarId: vi.fn(() => 'default') } }));
vi.mock('../../scripts/calendar/date-converter.mjs', () => ({ getEquivalentDates: vi.fn(() => []) }));
vi.mock('../../scripts/notes/note-data.mjs', () => ({ extractNoteMatchData: vi.fn(() => ({})), resolveNoteDisplayProps: vi.fn(() => ({})) }));
vi.mock('../../scripts/notes/note-manager.mjs', () => ({ default: { getAllNotes: vi.fn(() => []), getNotesForDate: vi.fn(() => []) } }));
vi.mock('../../scripts/weather/weather-manager.mjs', async () => {
  const { default: WeatherManager } = await import('../__mocks__/weather-manager.mjs');
  return { default: WeatherManager };
});
vi.mock('../../scripts/utils/formatting/format-utils.mjs', () => ({ formatCustom: vi.fn(() => ''), toRomanNumeral: vi.fn((n) => String(n)) }));
vi.mock('../../scripts/utils/permissions.mjs', () => ({ canViewWeatherForecast: vi.fn(() => true) }));
vi.mock('../../scripts/utils/socket.mjs', () => ({ CalendariaSocket: { executeAsGM: vi.fn(), isPrimaryGM: vi.fn(() => true) } }));
vi.mock('../../scripts/applications/_module.mjs', () => ({ BigCal: { show: vi.fn(), hide: vi.fn(), toggle: vi.fn() }, HUD: { show: vi.fn(), hide: vi.fn() }, MiniCal: { show: vi.fn(), hide: vi.fn() }, Stopwatch: { show: vi.fn() }, SunDial: { show: vi.fn() }, TimeKeeper: { show: vi.fn() } }));
vi.mock('../../scripts/applications/calendar/note-viewer.mjs', () => ({ NoteViewer: class {} }));
vi.mock('../../scripts/utils/fog-of-war.mjs', () => ({ isFogEnabled: vi.fn(() => false), isRevealed: vi.fn(() => true), revealRange: vi.fn() }));
vi.mock('../../scripts/constants.mjs', () => ({ MODULE: { ID: 'calendaria' }, NOTE_VISIBILITY: { VISIBLE: 'visible', HIDDEN: 'hidden', SECRET: 'secret' }, SETTINGS: {}, SOCKET_TYPES: {}, TEMPLATES: {} }));
vi.mock('../../scripts/notes/date-utils.mjs', () => ({ addDays: vi.fn((date, n) => ({ ...date, dayOfMonth: date.dayOfMonth + n })), compareDays: vi.fn(() => 0) }));
vi.mock('../../scripts/notes/recurrence.mjs', () => ({ isRecurringMatch: vi.fn(() => false), getEffectiveDuration: vi.fn(() => null) }));

function mockCalendar({ months = 12, daysPerMonth = 30, yearZero = 0, festivalDays = {} } = {}) {
  const monthsArray = Array.from({ length: months }, (_, i) => ({ name: `Month ${i}`, days: daysPerMonth }));
  return {
    years: { yearZero },
    monthsArray,
    getDaysInMonth: vi.fn((monthIdx) => monthsArray[monthIdx]?.days ?? daysPerMonth),
    findFestivalDay: vi.fn((date) => {
      const key = `${date.year}:${date.month}:${date.dayOfMonth}`;
      return festivalDays[key] ?? null;
    })
  };
}

describe('getLeadingDays()', () => {
  it('returns empty array when startDayOfWeek is 0', () => {
    const cal = mockCalendar();
    expect(getLeadingDays(cal, 2024, 3, 0)).toEqual([]);
  });
  it('returns empty array when startDayOfWeek is negative', () => {
    const cal = mockCalendar();
    expect(getLeadingDays(cal, 2024, 3, -1)).toEqual([]);
  });
  it('returns correct leading days from previous month (mid-year)', () => {
    const cal = mockCalendar({ daysPerMonth: 30 });
    const result = getLeadingDays(cal, 2024, 3, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ day: 29, dayOfMonth: 28, year: 2024, month: 2, isFromOtherMonth: true });
    expect(result[1]).toEqual({ day: 30, dayOfMonth: 29, year: 2024, month: 2, isFromOtherMonth: true });
  });
  it('wraps to last month of previous year when month is 0', () => {
    const cal = mockCalendar({ months: 12, daysPerMonth: 30 });
    const result = getLeadingDays(cal, 2024, 0, 1);
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe(11);
    expect(result[0].year).toBe(2023);
    expect(result[0].day).toBe(30);
  });
  it('skips festival days that do not count for weekday', () => {
    const festivalDays = { '2024:2:29': { countsForWeekday: false } };
    const cal = mockCalendar({ daysPerMonth: 30, festivalDays });
    const result = getLeadingDays(cal, 2024, 3, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ day: 28, dayOfMonth: 27, year: 2024, month: 2, isFromOtherMonth: true });
    expect(result[1]).toEqual({ day: 29, dayOfMonth: 28, year: 2024, month: 2, isFromOtherMonth: true });
  });
  it('does not skip festival days that count for weekday', () => {
    const festivalDays = { '2024:2:29': { countsForWeekday: true } };
    const cal = mockCalendar({ daysPerMonth: 30, festivalDays });
    const result = getLeadingDays(cal, 2024, 3, 2);
    expect(result).toHaveLength(2);
    expect(result[0].day).toBe(29);
    expect(result[1].day).toBe(30);
  });
  it('wraps to a second previous month when needed', () => {
    const cal = mockCalendar({ months: 12, daysPerMonth: 30 });
    cal.getDaysInMonth.mockImplementation((m) => (m === 2 ? 2 : 30));
    const result = getLeadingDays(cal, 2024, 3, 4);
    expect(result).toHaveLength(4);
    expect(result[0].month).toBe(1);
    expect(result[1].month).toBe(1);
    expect(result[2].month).toBe(2);
    expect(result[3].month).toBe(2);
  });
  it('all entries are marked isFromOtherMonth', () => {
    const cal = mockCalendar();
    const result = getLeadingDays(cal, 2024, 6, 3);
    for (const entry of result) {
      expect(entry.isFromOtherMonth).toBe(true);
    }
  });
});
