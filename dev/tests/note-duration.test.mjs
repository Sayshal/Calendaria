import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultNoteData, sanitizeNoteData, validateNoteData } from '../../scripts/notes/note-data.mjs';
import { getEffectiveDuration, isRecurringMatch } from '../../scripts/notes/recurrence.mjs';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: vi.fn((key) => key),
  format: vi.fn((key, _data) => key)
}));
vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  SETTINGS: { CUSTOM_PRESETS: 'customPresets' },
  NOTE_VISIBILITY: { VISIBLE: 'visible', HIDDEN: 'hidden', SECRET: 'secret' },
  DISPLAY_STYLES: { ICON: 'icon', PIP: 'pip', BANNER: 'banner' },
  CONDITION_FIELDS: {},
  CONDITION_OPERATORS: { EQUAL: '==', NOT_EQUAL: '!=', GREATER_EQUAL: '>=', LESS_EQUAL: '<=', GREATER: '>', LESS: '<', MODULO: '%', DAYS_AGO: 'daysAgo', DAYS_FROM_NOW: 'daysFromNow', WITHIN_LAST: 'withinLast', WITHIN_NEXT: 'withinNext' }
}));
vi.mock('../../scripts/calendar/calendar-manager.mjs', () => ({
  default: {
    getActiveCalendar: vi.fn(() => ({
      monthsArray: [{ name: 'January', days: 31 }, { name: 'February', days: 28 }, { name: 'March', days: 31 }],
      years: { yearZero: 0 },
      isMonthless: false,
      daysInWeek: 7,
      getDaysInMonth: vi.fn((month) => [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] || 30),
      getDaysInYear: vi.fn(() => 365)
    }))
  }
}));
vi.mock('../../scripts/notes/condition-engine.mjs', () => ({
  evaluateConditions: vi.fn(() => true),
  createEpochContext: vi.fn(() => ({})),
  evaluateEntry: vi.fn(() => true),
  canConditionTreeMatchRange: vi.fn(() => true),
  getSearchDistanceFromTree: vi.fn(() => 365),
  isGroup: vi.fn(() => false),
  registerFieldHandler: vi.fn()
}));
vi.mock('../../scripts/notes/note-manager.mjs', () => ({
  default: { getAllNotes: vi.fn(() => []), getNote: vi.fn(() => null) }
}));
vi.mock('../../scripts/notes/date-utils.mjs', () => ({
  isValidDate: vi.fn((date) => {
    if (!date || typeof date !== 'object') return false;
    return typeof date.year === 'number' && typeof date.month === 'number' && typeof date.dayOfMonth === 'number';
  }),
  getCurrentDate: vi.fn(() => ({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 })),
  addDays: vi.fn((date, days) => {
    let totalDays = date.dayOfMonth + days;
    let month = date.month;
    let year = date.year;
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    while (totalDays >= daysPerMonth[month]) { totalDays -= daysPerMonth[month]; month++; if (month >= 12) { month = 0; year++; } }
    while (totalDays < 0) { month--; if (month < 0) { month = 11; year--; } totalDays += daysPerMonth[month]; }
    return { year, month, dayOfMonth: totalDays, hour: date.hour, minute: date.minute };
  }),
  addMonths: vi.fn((date, months) => {
    let m = date.month + months;
    let y = date.year;
    while (m >= 12) { m -= 12; y++; }
    return { year: y, month: m, dayOfMonth: date.dayOfMonth };
  }),
  addYears: vi.fn((date, years) => ({ ...date, year: date.year + years })),
  compareDays: vi.fn((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.dayOfMonth - b.dayOfMonth;
  }),
  dayOfWeek: vi.fn((date) => date.dayOfMonth % 7),
  daysBetween: vi.fn((a, b) => {
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let totalA = a.year * 365 + a.dayOfMonth;
    for (let m = 0; m < a.month; m++) totalA += daysPerMonth[m];
    let totalB = b.year * 365 + b.dayOfMonth;
    for (let m = 0; m < b.month; m++) totalB += daysPerMonth[m];
    return totalB - totalA;
  }),
  isSameDay: vi.fn((a, b) => a.year === b.year && a.month === b.month && a.dayOfMonth === b.dayOfMonth),
  monthsBetween: vi.fn((a, b) => (b.year - a.year) * 12 + (b.month - a.month))
}));

beforeEach(() => {
  game.settings.get.mockReturnValue([]);
  game.settings.set.mockResolvedValue(true);
  globalThis.CONFIG = { JournalEntryPage: { dataModels: { 'calendaria.calendarnote': { _schema: { fields: { repeat: { choices: ['never', 'daily', 'weekly', 'monthly', 'yearly', 'moon', 'random', 'linked', 'seasonal', 'weekOfMonth', 'range'] } } } } } } };
});

describe('getEffectiveDuration()', () => {
  it('returns 0 when no duration is set', () => {
    const noteData = { startDate: { year: 1, month: 0, dayOfMonth: 0 }, endDate: null, hasDuration: false, duration: 1 };
    expect(getEffectiveDuration(noteData)).toBe(0);
  });
  it('returns duration - 1 (additional days after start) when hasDuration is true', () => {
    const noteData = { startDate: { year: 1, month: 0, dayOfMonth: 0 }, endDate: null, hasDuration: true, duration: 5 };
    expect(getEffectiveDuration(noteData)).toBe(4);
  });
  it('falls back to endDate when hasDuration is false', () => {
    const noteData = { startDate: { year: 1, month: 0, dayOfMonth: 0 }, endDate: { year: 1, month: 0, dayOfMonth: 3 }, hasDuration: false, duration: 1 };
    expect(getEffectiveDuration(noteData)).toBe(3);
  });
  it('returns 0 when hasDuration is true but duration is 0', () => {
    const noteData = { startDate: { year: 1, month: 0, dayOfMonth: 0 }, endDate: null, hasDuration: true, duration: 0 };
    expect(getEffectiveDuration(noteData)).toBe(0);
  });
  it('returns 0 when endDate equals startDate', () => {
    const noteData = { startDate: { year: 1, month: 0, dayOfMonth: 5 }, endDate: { year: 1, month: 0, dayOfMonth: 5 }, hasDuration: false, duration: 1 };
    expect(getEffectiveDuration(noteData)).toBe(0);
  });
});

describe('isRecurringMatch with hasDuration', () => {
  it('matches within duration span of a yearly event', () => {
    const noteData = {
      startDate: { year: 1, month: 0, dayOfMonth: 0 }, endDate: null, repeat: 'yearly', repeatInterval: 1, hasDuration: true, duration: 3,
      repeatEndDate: null, maxOccurrences: 0, moonConditions: [], randomConfig: null, linkedEvent: null, weekday: null, weekNumber: null, seasonalConfig: null, conditions: []
    };
    // duration: 3 = 3 total days (start + 2 more)
    expect(isRecurringMatch(noteData, { year: 1, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 1, month: 0, dayOfMonth: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 1, month: 0, dayOfMonth: 2 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 1, month: 0, dayOfMonth: 3 })).toBe(false);
  });
});

describe('validateNoteData with duration/display fields', () => {
  const baseData = { startDate: { year: 1, month: 0, dayOfMonth: 0 }, repeat: 'never' };
  it('accepts valid hasDuration', () => {
    const result = validateNoteData({ ...baseData, hasDuration: true });
    expect(result.valid).toBe(true);
  });
  it('rejects non-boolean hasDuration', () => {
    const result = validateNoteData({ ...baseData, hasDuration: 'yes' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('hasDuration must be a boolean');
  });
  it('rejects non-positive duration', () => {
    const result = validateNoteData({ ...baseData, duration: 0 });
    expect(result.valid).toBe(false);
  });
  it('rejects non-boolean showBookends', () => {
    const result = validateNoteData({ ...baseData, showBookends: 'yes' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('showBookends must be a boolean');
  });
  it('rejects invalid displayStyle', () => {
    const result = validateNoteData({ ...baseData, displayStyle: 'sparkle' });
    expect(result.valid).toBe(false);
  });
  it('accepts valid displayStyle values', () => {
    for (const style of ['icon', 'pip', 'banner']) {
      const result = validateNoteData({ ...baseData, displayStyle: style });
      expect(result.valid).toBe(true);
    }
  });
});

describe('sanitizeNoteData with duration/display fields', () => {
  it('includes duration/display defaults', () => {
    const result = sanitizeNoteData({ startDate: { year: 1, month: 0, dayOfMonth: 0 } });
    expect(result.hasDuration).toBe(false);
    expect(result.duration).toBe(1);
    expect(result.showBookends).toBe(false);
    expect(result.limitedRepeat).toBe(false);
    expect(result.limitedRepeatDays).toBe(365);
    expect(result.displayStyle).toBe('icon');
  });
  it('preserves provided values', () => {
    const result = sanitizeNoteData({ startDate: { year: 1, month: 0, dayOfMonth: 0 }, hasDuration: true, duration: 7, showBookends: true, limitedRepeat: true, limitedRepeatDays: 30, displayStyle: 'pip' });
    expect(result.hasDuration).toBe(true);
    expect(result.duration).toBe(7);
    expect(result.showBookends).toBe(true);
    expect(result.limitedRepeat).toBe(true);
    expect(result.limitedRepeatDays).toBe(30);
    expect(result.displayStyle).toBe('pip');
  });
});

describe('getDefaultNoteData includes duration/display fields', () => {
  it('has new fields with correct defaults', () => {
    const data = getDefaultNoteData();
    expect(data.hasDuration).toBe(false);
    expect(data.duration).toBe(1);
    expect(data.showBookends).toBe(false);
    expect(data.limitedRepeat).toBe(false);
    expect(data.limitedRepeatDays).toBe(365);
    expect(data.displayStyle).toBe('icon');
  });
});
