import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import { generateRandomOccurrences, getNextOccurrences, getOccurrencesInRange, getRecurrenceDescription, isRecurringMatch, needsRandomRegeneration, resolveComputedDate } from '../../scripts/notes/recurrence.mjs';

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
vi.mock('../../scripts/weather/weather-manager.mjs', async () => {
  const { default: WeatherManager } = await import('../__mocks__/weather-manager.mjs');
  return { default: WeatherManager };
});
vi.mock('../../scripts/notes/note-manager.mjs', () => ({
  default: { getNoteById: vi.fn(() => null) }
}));

beforeEach(() => {
  CalendarManager._reset();
});

describe('isRecurringMatch()', () => {
  describe('never (no repeat)', () => {
    it('matches on exact start date', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'never' };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    });
    it('does not match on different date', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'never' };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 15 })).toBe(false);
    });
  });
});

describe('generateRandomOccurrences()', () => {
  it('returns empty array for 0% probability', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, randomConfig: { seed: 12345, probability: 0, checkInterval: 'daily' } };
    expect(generateRandomOccurrences(noteData, 2024)).toEqual([]);
  });
  it('returns occurrences for valid probability', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, randomConfig: { seed: 42, probability: 50, checkInterval: 'daily' } };
    const occurrences = generateRandomOccurrences(noteData, 2024);
    expect(occurrences.length).toBeGreaterThan(0);
    const occurrences2 = generateRandomOccurrences(noteData, 2024);
    expect(occurrences).toEqual(occurrences2);
  });
  it('returns empty if startDate is after targetYear', () => {
    const noteData = { startDate: { year: 2025, month: 0, dayOfMonth: 0 }, randomConfig: { seed: 42, probability: 50, checkInterval: 'daily' } };
    expect(generateRandomOccurrences(noteData, 2024)).toEqual([]);
  });
});

describe('needsRandomRegeneration()', () => {
  it('returns true for null/undefined cached data', () => {
    expect(needsRandomRegeneration(null)).toBe(true);
    expect(needsRandomRegeneration(undefined)).toBe(true);
    expect(needsRandomRegeneration({})).toBe(true);
  });
  it('returns true for missing year or occurrences', () => {
    expect(needsRandomRegeneration({ year: 2024 })).toBe(true);
    expect(needsRandomRegeneration({ occurrences: [] })).toBe(true);
  });
});

describe('getRecurrenceDescription()', () => {
  it('returns Conditional for notes with conditionTree', () => {
    const noteData = { conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 1 }] } };
    expect(getRecurrenceDescription(noteData)).toBe('CALENDARIA.Recurrence.Conditional');
  });
  it('returns DoesNotRepeat for notes without conditionTree', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 } };
    expect(getRecurrenceDescription(noteData)).toBe('CALENDARIA.Recurrence.DoesNotRepeat');
  });
});

describe('computed events', () => {
  it('resolveComputedDate returns null for empty chain', () => {
    expect(resolveComputedDate({}, 2024)).toBe(null);
    expect(resolveComputedDate({ chain: [] }, 2024)).toBe(null);
    expect(resolveComputedDate(null, 2024)).toBe(null);
  });
  it('resolveComputedDate uses yearOverrides when available', () => {
    const config = { chain: [{ type: 'anchor', value: 'springEquinox' }], yearOverrides: { 2024: { month: 2, dayOfMonth: 24 } } };
    expect(resolveComputedDate(config, 2024)).toEqual({ year: 2024, month: 2, dayOfMonth: 24 });
  });
  it('resolveComputedDate handles springEquinox anchor', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', seasonalType: 'spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', seasonalType: 'summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', seasonalType: 'autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', seasonalType: 'winter', dayStart: 355, dayEnd: 79 }] } });
    const result = resolveComputedDate({ chain: [{ type: 'anchor', value: 'springEquinox' }] }, 2024);
    expect(result).not.toBe(null);
    expect(result.year).toBe(2024);
  });
  it('resolveComputedDate handles autumnEquinox anchor', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', seasonalType: 'spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', seasonalType: 'summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', seasonalType: 'autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', seasonalType: 'winter', dayStart: 355, dayEnd: 79 }] } });
    const result = resolveComputedDate({ chain: [{ type: 'anchor', value: 'autumnEquinox' }] }, 2024);
    expect(result).not.toBe(null);
    expect(result.year).toBe(2024);
  });
  it('resolveComputedDate handles summerSolstice anchor with daylight config', () => {
    CalendarManager._configure({ daylight: { summerSolstice: 172, winterSolstice: 355 }, seasons: { values: [] } });
    expect(resolveComputedDate({ chain: [{ type: 'anchor', value: 'summerSolstice' }] }, 2024)).not.toBe(null);
  });
  it('resolveComputedDate handles winterSolstice anchor with daylight config', () => {
    CalendarManager._configure({ daylight: { summerSolstice: 172, winterSolstice: 355 }, seasons: { values: [] } });
    expect(resolveComputedDate({ chain: [{ type: 'anchor', value: 'winterSolstice' }] }, 2024)).not.toBe(null);
  });
  it('resolveComputedDate resolves summerSolstice via season midpoint when daylight config is absent', () => {
    CalendarManager._configure({ daylight: {}, seasons: { values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', dayStart: 355, dayEnd: 79 }] } });
    const result = resolveComputedDate({ chain: [{ type: 'anchor', value: 'summerSolstice' }] }, 2024);
    expect(result).not.toBe(null);
    expect(result.year).toBe(2024);
  });
  it('resolveComputedDate resolves winterSolstice via season midpoint when daylight config is absent', () => {
    CalendarManager._configure({ daylight: {}, seasons: { values: [{ name: 'Spring', seasonalType: 'spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', seasonalType: 'summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', seasonalType: 'autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', seasonalType: 'winter', dayStart: 355, dayEnd: 79 }] } });
    const result = resolveComputedDate({ chain: [{ type: 'anchor', value: 'winterSolstice' }] }, 2024);
    expect(result).not.toBe(null);
    expect(result.year).toBe(2024);
  });
  it('resolveComputedDate returns null when no season has matching seasonalType', () => {
    CalendarManager._configure({ daylight: {}, seasons: { values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }] } });
    expect(resolveComputedDate({ chain: [{ type: 'anchor', value: 'springEquinox' }] }, 9998)).toBeNull();
  });
  it('resolveComputedDate handles daysAfter step', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', seasonalType: 'spring', dayStart: 80, dayEnd: 171 }] } });
    const config = { chain: [{ type: 'anchor', value: 'springEquinox' }, { type: 'daysAfter', params: { days: 10 } }] };
    expect(resolveComputedDate(config, 2024)).not.toBe(null);
  });
  it('resolveComputedDate handles weekdayOnOrAfter step', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', seasonalType: 'spring', dayStart: 80, dayEnd: 171 }] } });
    const config = { chain: [{ type: 'anchor', value: 'springEquinox' }, { type: 'weekdayOnOrAfter', params: { weekday: 0 } }] };
    expect(resolveComputedDate(config, 2024)).not.toBe(null);
  });
  it('resolveComputedDate handles firstAfter weekday condition', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', seasonalType: 'spring', dayStart: 80, dayEnd: 171 }] } });
    const config = { chain: [{ type: 'anchor', value: 'springEquinox' }, { type: 'firstAfter', condition: 'weekday', params: { weekday: 0 } }] };
    expect(resolveComputedDate(config, 2024)).not.toBe(null);
  });
});

describe('condition-tree dispatch', () => {
  it('routes to condition-tree engine when conditionTree is present', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'weekday', op: '==', value: 2 }] } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 1 })).toBe(false);
  });
});

describe('evaluateConditionTree (via isRecurringMatch)', () => {
  it('matches AND tree correctly', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, dayOfMonth: 0 },
      conditionTree: { type: 'group', mode: 'and', children: [{ field: 'month', op: '==', value: 1 }, { field: 'day', op: '==', value: 15 }] }
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 13 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 14 })).toBe(false);
  });
  it('rejects dates before startDate', () => {
    const noteData = { startDate: { year: 2024, month: 6, dayOfMonth: 0 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 1 }] } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('rejects dates after repeatEndDate', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeatEndDate: { year: 2024, month: 5, dayOfMonth: 29 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 1 }] } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 11, dayOfMonth: 0 })).toBe(false);
  });
  it('enforces maxOccurrences', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, maxOccurrences: 3, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 1 }] } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 3, dayOfMonth: 0 })).toBe(false);
  });
  it('ignores endDate span when a condition tree is present', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, endDate: { year: 2024, month: 0, dayOfMonth: 4 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 99 }] } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 2 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
  });
});

describe('duration + condition tree', () => {
  it('multi-day event covers days after tree-match start via hasDuration', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, dayOfMonth: 0 }, endDate: { year: 2024, month: 0, dayOfMonth: 0 },
      hasDuration: true, duration: 3,
      conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 15 }] }
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 16 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 17 })).toBe(false);
  });
});

describe('getOccurrencesInRange with conditionTree', () => {
  it('returns correct occurrences', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 1 }] } };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 2, dayOfMonth: 30 });
    expect(occurrences.length).toBe(3);
    expect(occurrences[0]).toMatchObject({ year: 2024, month: 0, dayOfMonth: 0 });
    expect(occurrences[1]).toMatchObject({ year: 2024, month: 1, dayOfMonth: 0 });
    expect(occurrences[2]).toMatchObject({ year: 2024, month: 2, dayOfMonth: 0 });
  });
  it('respects maxOccurrences limit', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 1 }] } };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 11, dayOfMonth: 30 }, 2);
    expect(occurrences.length).toBe(2);
  });
  it('pre-filters with impossible year constraint', () => {
    const noteData = { startDate: { year: 2020, month: 0, dayOfMonth: 0 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'year', op: '==', value: 2020 }] } };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 11, dayOfMonth: 30 });
    expect(occurrences.length).toBe(0);
  });
});

describe('getNextOccurrences()', () => {
  it('returns correct count with condition tree', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 1 }] } };
    const from = { year: 2024, month: 0, dayOfMonth: 0 };
    const occurrences = getNextOccurrences(noteData, from, 3);
    expect(occurrences.length).toBe(3);
    expect(occurrences[0]).toMatchObject({ year: 2024, month: 0, dayOfMonth: 0 });
    expect(occurrences[1]).toMatchObject({ year: 2024, month: 1, dayOfMonth: 0 });
    expect(occurrences[2]).toMatchObject({ year: 2024, month: 2, dayOfMonth: 0 });
  });
  it('respects maxSearchDays parameter', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 1 }] } };
    const occurrences = getNextOccurrences(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, 5, 15);
    expect(occurrences.length).toBe(1);
  });
});
