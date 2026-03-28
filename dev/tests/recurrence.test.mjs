import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import { generateRandomOccurrences, getNextOccurrences, getOccurrencesInRange, getRecurrenceDescription, isRecurringMatch, matchesCachedOccurrence, needsRandomRegeneration, resolveComputedDate } from '../../scripts/notes/recurrence.mjs';

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

  describe('daily', () => {
    it('matches every day after start', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1 };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 1 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 9 })).toBe(true);
    });
    it('does not match before start date', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'daily', repeatInterval: 1 };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 13 })).toBe(false);
    });
    it('respects interval', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 3 };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 1 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 3 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 6 })).toBe(true);
    });
    it('respects repeatEndDate', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeatEndDate: { year: 2024, month: 0, dayOfMonth: 9 }, repeat: 'daily', repeatInterval: 1 };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 9 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 10 })).toBe(false);
    });
  });

  describe('weekly', () => {
    it('matches every 7 days after start', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'weekly', repeatInterval: 1 };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 7 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 1 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 8 })).toBe(false);
    });
    it('respects interval (bi-weekly)', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'weekly', repeatInterval: 2 };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 7 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 21 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 28 })).toBe(true);
    });
  });

  describe('monthly', () => {
    it('matches same day each month', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'monthly', repeatInterval: 1 };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 14 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 2, dayOfMonth: 14 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 13 })).toBe(false);
    });
    it('respects interval (every 2 months)', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'monthly', repeatInterval: 2 };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 14 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2024, month: 2, dayOfMonth: 14 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 3, dayOfMonth: 14 })).toBe(false);
    });
  });

  describe('yearly', () => {
    it('matches same day and month each year', () => {
      const noteData = { startDate: { year: 2020, month: 6, dayOfMonth: 3 }, repeat: 'yearly', repeatInterval: 1 };
      expect(isRecurringMatch(noteData, { year: 2020, month: 6, dayOfMonth: 3 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2021, month: 6, dayOfMonth: 3 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2025, month: 6, dayOfMonth: 3 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2021, month: 6, dayOfMonth: 4 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2021, month: 7, dayOfMonth: 3 })).toBe(false);
    });
    it('respects interval (every 2 years)', () => {
      const noteData = { startDate: { year: 2020, month: 6, dayOfMonth: 3 }, repeat: 'yearly', repeatInterval: 2 };
      expect(isRecurringMatch(noteData, { year: 2020, month: 6, dayOfMonth: 3 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2021, month: 6, dayOfMonth: 3 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2022, month: 6, dayOfMonth: 3 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 6, dayOfMonth: 3 })).toBe(true);
    });
  });

  describe('invalid/unknown repeat type', () => {
    it('returns false for unknown repeat type', () => {
      const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'unknown' };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
    });
  });
});

describe('getRecurrenceDescription()', () => {
  it('returns localization key for daily', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1 };
    expect(getRecurrenceDescription(noteData)).toContain('CALENDARIA');
  });
  it('returns localization key for weekly', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'weekly', repeatInterval: 1 };
    expect(getRecurrenceDescription(noteData)).toContain('CALENDARIA');
  });
  it('returns localization key for monthly', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'monthly', repeatInterval: 1 };
    expect(getRecurrenceDescription(noteData)).toContain('CALENDARIA');
  });
  it('returns localization key for yearly', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'yearly', repeatInterval: 1 };
    expect(getRecurrenceDescription(noteData)).toContain('CALENDARIA');
  });
  it('returns localization key for never/no repeat', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'never' };
    expect(getRecurrenceDescription(noteData)).toContain('CALENDARIA');
  });
});

describe('getOccurrencesInRange()', () => {
  it('returns empty array for non-repeating note outside start date', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'never' };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 0, dayOfMonth: 9 });
    expect(occurrences).toEqual([]);
  });
  it('returns start date for non-repeating note within range', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 4 }, repeat: 'never' };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 0, dayOfMonth: 9 });
    expect(occurrences.length).toBe(1);
    expect(occurrences[0]).toEqual({ year: 2024, month: 0, dayOfMonth: 4 });
  });
  it('returns multiple occurrences for daily repeat', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1 };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 0, dayOfMonth: 4 });
    expect(occurrences.length).toBe(5);
  });
  it('returns weekly occurrences in range', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'weekly', repeatInterval: 1 };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 0, dayOfMonth: 30 });
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
    expect(occurrences.length).toBeLessThanOrEqual(5);
  });
  it('respects maxOccurrences parameter', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1 };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 11, dayOfMonth: 30 }, 10);
    expect(occurrences.length).toBe(10);
  });
  it('returns monthly occurrences in range', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'monthly', repeatInterval: 1 };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 5, dayOfMonth: 29 });
    expect(occurrences.length).toBe(6);
    expect(occurrences[0]).toEqual({ year: 2024, month: 0, dayOfMonth: 14 });
    expect(occurrences[5]).toEqual({ year: 2024, month: 5, dayOfMonth: 14 });
  });
  it('returns yearly occurrences in range', () => {
    const noteData = { startDate: { year: 2020, month: 6, dayOfMonth: 3 }, repeat: 'yearly', repeatInterval: 1 };
    const occurrences = getOccurrencesInRange(noteData, { year: 2020, month: 0, dayOfMonth: 0 }, { year: 2025, month: 11, dayOfMonth: 30 });
    expect(occurrences.length).toBe(6);
  });
});

describe('maxOccurrences limit', () => {
  it('limits daily recurrence to maxOccurrences', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, maxOccurrences: 5 };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 5 })).toBe(false);
  });
  it('limits weekly recurrence to maxOccurrences', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'weekly', repeatInterval: 1, maxOccurrences: 3 };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 7 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 21 })).toBe(false);
  });
  it('limits monthly recurrence to maxOccurrences', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'monthly', repeatInterval: 1, maxOccurrences: 2 };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, dayOfMonth: 14 })).toBe(false);
  });
  it('limits yearly recurrence to maxOccurrences', () => {
    const noteData = { startDate: { year: 2020, month: 6, dayOfMonth: 3 }, repeat: 'yearly', repeatInterval: 1, maxOccurrences: 3 };
    expect(isRecurringMatch(noteData, { year: 2020, month: 6, dayOfMonth: 3 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2021, month: 6, dayOfMonth: 3 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2022, month: 6, dayOfMonth: 3 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2023, month: 6, dayOfMonth: 3 })).toBe(false);
  });
});

describe('multi-day events', () => {
  it('handles multi-day recurring events with daily pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, endDate: { year: 2024, month: 0, dayOfMonth: 2 }, repeat: 'daily', repeatInterval: 7 };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 2 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 7 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 8 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 9 })).toBe(true);
  });
  it('handles multi-day recurring events with weekly pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, endDate: { year: 2024, month: 0, dayOfMonth: 2 }, repeat: 'weekly', repeatInterval: 1 };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 2 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 7 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 8 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 9 })).toBe(true);
  });
});

describe('weekOfMonth recurrence', () => {
  it('matches 2nd Tuesday of every month', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 8 }, repeat: 'weekOfMonth', repeatInterval: 1, weekday: 2, weekNumber: 2 };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 8 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 12 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 15 })).toBe(false);
  });
  it('matches last Friday of every month (negative weekNumber)', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 25 }, repeat: 'weekOfMonth', repeatInterval: 1, weekday: 5, weekNumber: -1 };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 25 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 22 })).toBe(true);
  });
  it('respects interval for weekOfMonth', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 8 }, repeat: 'weekOfMonth', repeatInterval: 2, weekday: 2, weekNumber: 2 };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 8 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 12 })).toBe(false);
  });
});

describe('range pattern recurrence', () => {
  it('matches specific day across all months', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'range', rangePattern: { year: null, month: null, dayOfMonth: 15 } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2025, month: 3, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 13 })).toBe(false);
  });
  it('matches day range within specific months', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'range', rangePattern: { year: null, month: [0, 2], dayOfMonth: [1, 10] } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, dayOfMonth: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 3, dayOfMonth: 4 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(false);
  });
  it('matches specific year only', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'range', rangePattern: { year: 2024, month: null, dayOfMonth: null } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, dayOfMonth: 19 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2025, month: 5, dayOfMonth: 19 })).toBe(false);
  });
  it('handles open-ended ranges', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'range', rangePattern: { year: [2024, null], month: null, dayOfMonth: 1 } };
    expect(isRecurringMatch(noteData, { year: 2023, month: 0, dayOfMonth: 0 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2030, month: 0, dayOfMonth: 0 })).toBe(true);
  });
});

describe('seasonal recurrence', () => {
  beforeEach(() => {
    CalendarManager._configure({
      seasons: {
        values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', dayStart: 355, dayEnd: 79 }]
      }
    });
  });

  it('matches entire season', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'seasonal', seasonalConfig: { seasonIndex: 1, trigger: 'entire' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, dayOfMonth: 21 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, dayOfMonth: 20 })).toBe(false);
  });
  it('matches first day of season', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'seasonal', seasonalConfig: { seasonIndex: 0, trigger: 'firstDay' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, dayOfMonth: 21 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, dayOfMonth: 22 })).toBe(false);
  });
  it('matches last day of season', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'seasonal', seasonalConfig: { seasonIndex: 0, trigger: 'lastDay' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, dayOfMonth: 20 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, dayOfMonth: 19 })).toBe(false);
  });
});

describe('random events', () => {
  it('matchesCachedOccurrence returns true for matching date', () => {
    const cached = [{ year: 2024, month: 0, dayOfMonth: 4 }, { year: 2024, month: 0, dayOfMonth: 14 }, { year: 2024, month: 1, dayOfMonth: 2 }];
    expect(matchesCachedOccurrence(cached, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(true);
    expect(matchesCachedOccurrence(cached, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    expect(matchesCachedOccurrence(cached, { year: 2024, month: 0, dayOfMonth: 5 })).toBe(false);
  });
  it('matchesCachedOccurrence returns false for empty array', () => {
    expect(matchesCachedOccurrence([], { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
    expect(matchesCachedOccurrence(null, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
  });
  it('isRecurringMatch with random uses cached occurrences', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'random',
      randomConfig: { seed: 12345, probability: 10, checkInterval: 'daily' },
      cachedRandomOccurrences: [{ year: 2024, month: 0, dayOfMonth: 4 }, { year: 2024, month: 0, dayOfMonth: 19 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 19 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 5 })).toBe(false);
  });
  it('random with 0% probability never matches', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'random', randomConfig: { seed: 12345, probability: 0, checkInterval: 'daily' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 99 })).toBe(false);
  });
  it('random with 100% probability always matches', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'random', randomConfig: { seed: 12345, probability: 100, checkInterval: 'daily' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 99 })).toBe(true);
  });
  it('random respects repeatEndDate', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeatEndDate: { year: 2024, month: 0, dayOfMonth: 9 }, repeat: 'random', randomConfig: { seed: 12345, probability: 100, checkInterval: 'daily' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 10 })).toBe(false);
  });
  it('random does not match before startDate', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 9 }, repeat: 'random', randomConfig: { seed: 12345, probability: 100, checkInterval: 'daily' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 9 })).toBe(true);
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

describe('conditions on events', () => {
  it('repeating event with day modulo condition', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'day', op: '%', value: 5 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 5 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 10 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
  });
  it('repeating event with year condition', () => {
    const noteData = { startDate: { year: 2020, month: 0, dayOfMonth: 0 }, repeat: 'yearly', repeatInterval: 1, conditions: [{ field: 'year', op: '>=', value: 2022 }] };
    expect(isRecurringMatch(noteData, { year: 2020, month: 0, dayOfMonth: 0 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2022, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2025, month: 0, dayOfMonth: 0 })).toBe(true);
  });
  it('repeating event with month condition', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'monthly', repeatInterval: 1, conditions: [{ field: 'month', op: '<=', value: 6 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 6, dayOfMonth: 14 })).toBe(false);
  });
});

describe('getRecurrenceDescription() extended', () => {
  it('includes until date when repeatEndDate is set', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, repeatEndDate: { year: 2024, month: 5, dayOfMonth: 29 } };
    expect(getRecurrenceDescription(noteData)).toContain('Until');
  });
  it('includes max occurrences suffix when set', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, maxOccurrences: 10 };
    expect(getRecurrenceDescription(noteData)).toContain('Times');
  });
  it('describes weekOfMonth pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 8 }, repeat: 'weekOfMonth', repeatInterval: 1, weekday: 2, weekNumber: 2 };
    expect(getRecurrenceDescription(noteData)).toContain('CALENDARIA');
  });
  it('describes seasonal pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'seasonal', seasonalConfig: { seasonIndex: 0, trigger: 'firstDay' } };
    expect(getRecurrenceDescription(noteData)).toContain('CALENDARIA');
  });
  it('describes random pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'random', randomConfig: { seed: 123, probability: 25, checkInterval: 'daily' } };
    expect(getRecurrenceDescription(noteData)).toContain('ChanceEach');
  });
  it('describes range pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'range', rangePattern: { year: 2024, month: null, dayOfMonth: 15 } };
    expect(getRecurrenceDescription(noteData)).toContain('Range');
  });
  it('describes interval > 1 with units', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 3 };
    expect(getRecurrenceDescription(noteData)).toContain('EveryXUnits');
  });
});

describe('getOccurrencesInRange() extended', () => {
  it('handles weekOfMonth pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 8 }, repeat: 'weekOfMonth', repeatInterval: 1, weekday: 2, weekNumber: 2 };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 2, dayOfMonth: 30 });
    expect(occurrences.length).toBe(3);
  });
  it('handles range pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'range', rangePattern: { year: null, month: null, dayOfMonth: 15 } };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 2, dayOfMonth: 30 });
    expect(occurrences.length).toBe(3);
  });
  it('handles random with cached occurrences', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'random',
      randomConfig: { seed: 123, probability: 50, checkInterval: 'daily' },
      cachedRandomOccurrences: [{ year: 2024, month: 0, dayOfMonth: 4 }, { year: 2024, month: 0, dayOfMonth: 14 }, { year: 2024, month: 1, dayOfMonth: 9 }]
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 0, dayOfMonth: 30 });
    expect(occurrences.length).toBe(2);
    expect(occurrences[0]).toEqual({ year: 2024, month: 0, dayOfMonth: 4 });
    expect(occurrences[1]).toEqual({ year: 2024, month: 0, dayOfMonth: 14 });
  });
  it('handles seasonal pattern', () => {
    CalendarManager._configure({
      seasons: {
        values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', dayStart: 355, dayEnd: 79 }]
      }
    });
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'seasonal', seasonalConfig: { seasonIndex: 1, trigger: 'entire' } };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 5, dayOfMonth: 20 }, { year: 2024, month: 5, dayOfMonth: 24 }, 5);
    expect(occurrences.length).toBeGreaterThan(0);
  });
  it('handles moon pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'moon', moonConditions: [{ moonIndex: 0, phaseStart: 0.45, phaseEnd: 0.55 }] };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 1, dayOfMonth: 27 }, 10);
    expect(occurrences.length).toBeGreaterThanOrEqual(0);
  });
});

describe('moon recurrence', () => {
  it('returns false for moon pattern without moonConditions', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'moon', moonConditions: [] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(false);
  });
  it('returns false for moon pattern with null moonConditions', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'moon', moonConditions: null };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(false);
  });
  it('respects startDate for moon pattern', () => {
    const noteData = { startDate: { year: 2024, month: 6, dayOfMonth: 0 }, repeat: 'moon', moonConditions: [{ moonIndex: 0, phaseStart: 0.4, phaseEnd: 0.6 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(false);
  });
  it('respects repeatEndDate for moon pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeatEndDate: { year: 2024, month: 0, dayOfMonth: 9 }, repeat: 'moon', moonConditions: [{ moonIndex: 0, phaseStart: 0.4, phaseEnd: 0.6 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 14 })).toBe(false);
  });
  it('respects maxOccurrences for moon pattern', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'moon', moonConditions: [{ moonIndex: 0, phaseStart: 0.4, phaseEnd: 0.6 }], maxOccurrences: 1 };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 11, dayOfMonth: 30 }, 100);
    expect(occurrences.length).toBeLessThanOrEqual(1);
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
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', dayStart: 355, dayEnd: 79 }] } });
    const result = resolveComputedDate({ chain: [{ type: 'anchor', value: 'springEquinox' }] }, 2024);
    expect(result).not.toBe(null);
    expect(result.year).toBe(2024);
  });
  it('resolveComputedDate handles autumnEquinox anchor', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', dayStart: 355, dayEnd: 79 }] } });
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
    CalendarManager._configure({ daylight: {}, seasons: { values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', dayStart: 355, dayEnd: 79 }] } });
    const result = resolveComputedDate({ chain: [{ type: 'anchor', value: 'winterSolstice' }] }, 2024);
    expect(result).not.toBe(null);
    expect(result.year).toBe(2024);
  });
  it('resolveComputedDate handles daysAfter step', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }] } });
    const config = { chain: [{ type: 'anchor', value: 'springEquinox' }, { type: 'daysAfter', params: { days: 10 } }] };
    expect(resolveComputedDate(config, 2024)).not.toBe(null);
  });
  it('resolveComputedDate handles weekdayOnOrAfter step', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }] } });
    const config = { chain: [{ type: 'anchor', value: 'springEquinox' }, { type: 'weekdayOnOrAfter', params: { weekday: 0 } }] };
    expect(resolveComputedDate(config, 2024)).not.toBe(null);
  });
  it('resolveComputedDate handles firstAfter weekday condition', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }] } });
    const config = { chain: [{ type: 'anchor', value: 'springEquinox' }, { type: 'firstAfter', condition: 'weekday', params: { weekday: 0 } }] };
    expect(resolveComputedDate(config, 2024)).not.toBe(null);
  });
  it('isRecurringMatch with computed pattern', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }] } });
    const noteData = { startDate: { year: 2020, month: 0, dayOfMonth: 0 }, repeat: 'computed', computedConfig: { chain: [{ type: 'anchor', value: 'springEquinox' }] } };
    const result = isRecurringMatch(noteData, { year: 2024, month: 2, dayOfMonth: 20 });
    expect(typeof result).toBe('boolean');
  });
  it('getOccurrencesInRange with computed pattern', () => {
    CalendarManager._configure({ seasons: { values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }] } });
    const noteData = { startDate: { year: 2020, month: 0, dayOfMonth: 0 }, repeat: 'computed', computedConfig: { chain: [{ type: 'anchor', value: 'springEquinox' }] } };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2026, month: 11, dayOfMonth: 30 }, 10);
    expect(occurrences.length).toBeGreaterThan(0);
  });
});

describe('random with different check intervals', () => {
  it('weekly checkInterval with 100% probability matches all days', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'random', randomConfig: { seed: 12345, probability: 100, checkInterval: 'weekly' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 7 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 1 })).toBe(true);
  });
  it('monthly checkInterval with 100% probability matches all days', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'random', randomConfig: { seed: 12345, probability: 100, checkInterval: 'monthly' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 15 })).toBe(true);
  });
  it('getOccurrencesInRange with weekly random interval', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'random', randomConfig: { seed: 42, probability: 50, checkInterval: 'weekly' } };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 1, dayOfMonth: 27 }, 20);
    for (const occ of occurrences) { expect(occ.year).toBe(2024); }
  });
  it('getOccurrencesInRange with monthly random interval', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 14 }, repeat: 'random', randomConfig: { seed: 42, probability: 50, checkInterval: 'monthly' } };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, { year: 2024, month: 5, dayOfMonth: 29 }, 10);
    for (const occ of occurrences) { expect(occ.dayOfMonth).toBe(14); }
  });
});

describe('condition operators', () => {
  it('!= operator works correctly', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'day', op: '!=', value: 15 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 13 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 15 })).toBe(true);
  });
  it('> operator works correctly', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'day', op: '>', value: 20 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 19 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 20 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 24 })).toBe(true);
  });
  it('< operator works correctly', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'day', op: '<', value: 5 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 3 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 5 })).toBe(false);
  });
  it('<= operator works correctly', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'day', op: '<=', value: 5 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 5 })).toBe(false);
  });
  it('== operator works correctly', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'day', op: '==', value: 15 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 15 })).toBe(false);
  });
  it('% operator offsets from startDate implicitly', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 2 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'day', op: '%', value: 7 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 2 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 9 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
  });
  it('% operator with value 0 returns false', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'day', op: '%', value: 0 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
  });
  it('unknown operator returns false', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'day', op: '~=', value: 5 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
  });
  it('unknown field returns null, causing condition to fail', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'unknownField', op: '==', value: 5 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(false);
  });
});

describe('condition field types', () => {
  it('dayOfYear field works', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'dayOfYear', op: '==', value: 32 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(false);
  });
  it('weekday field works', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'weekday', op: '>=', value: 1 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
  });
  it('weekNumberInMonth field works', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'weekNumberInMonth', op: '==', value: 2 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 7 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('daysBeforeMonthEnd field works', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'daysBeforeMonthEnd', op: '==', value: 0 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 30 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 29 })).toBe(false);
  });
  it('multiple conditions with AND logic', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 1, conditions: [{ field: 'day', op: '>=', value: 10 }, { field: 'day', op: '<=', value: 20 }] };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 8 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 9 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 19 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 20 })).toBe(false);
  });
});

describe('season wrap-around', () => {
  beforeEach(() => {
    CalendarManager._configure({
      seasons: {
        values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }, { name: 'Summer', dayStart: 172, dayEnd: 264 }, { name: 'Autumn', dayStart: 265, dayEnd: 354 }, { name: 'Winter', dayStart: 355, dayEnd: 79 }]
      }
    });
  });
  it('matches winter at start of year (wrap-around)', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'seasonal', seasonalConfig: { seasonIndex: 3, trigger: 'entire' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(true);
  });
  it('matches winter at end of year (wrap-around)', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'seasonal', seasonalConfig: { seasonIndex: 3, trigger: 'entire' } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 11, dayOfMonth: 24 })).toBe(true);
  });
});

describe('getRecurrenceDescription edge cases', () => {
  it('describes computed event', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'computed', computedConfig: { chain: [{ type: 'anchor', value: 'springEquinox' }, { type: 'daysAfter', params: { days: 49 } }] } };
    expect(getRecurrenceDescription(noteData)).toContain('Spring');
  });
  it('describes moon conditions', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'moon', moonConditions: [{ moonIndex: 0, phaseStart: 0.45, phaseEnd: 0.55 }] };
    expect(typeof getRecurrenceDescription(noteData)).toBe('string');
  });
  it('describes negative weekNumber (last occurrence)', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 25 }, repeat: 'weekOfMonth', repeatInterval: 1, weekday: 5, weekNumber: -1 };
    expect(getRecurrenceDescription(noteData)).toContain('CALENDARIA');
  });
  it('describes weekOfMonth with interval > 1', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 8 }, repeat: 'weekOfMonth', repeatInterval: 3, weekday: 2, weekNumber: 2 };
    expect(getRecurrenceDescription(noteData)).toContain('CALENDARIA');
  });
  it('describes seasonal lastDay trigger', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'seasonal', seasonalConfig: { seasonIndex: 1, trigger: 'lastDay' } };
    expect(getRecurrenceDescription(noteData)).toContain('LastDayOf');
  });
  it('describes seasonal entire trigger', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'seasonal', seasonalConfig: { seasonIndex: 0, trigger: 'entire' } };
    expect(getRecurrenceDescription(noteData)).toContain('EveryDayDuring');
  });
  it('handles weekly check interval description', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'random', randomConfig: { seed: 123, probability: 25, checkInterval: 'weekly' } };
    expect(getRecurrenceDescription(noteData)).toContain('ChanceEach');
  });
  it('handles monthly check interval description', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'random', randomConfig: { seed: 123, probability: 25, checkInterval: 'monthly' } };
    expect(getRecurrenceDescription(noteData)).toContain('ChanceEach');
  });
});

describe('condition-tree dual-engine dispatch', () => {
  it('routes to condition-tree engine when conditionTree is present', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'weekday', op: '==', value: 2 }] } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 1 })).toBe(false);
  });
  it('routes to legacy engine when conditionTree is absent', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'daily', repeatInterval: 2 };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 2 })).toBe(true);
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
  it('always matches within start-end duration span', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, endDate: { year: 2024, month: 0, dayOfMonth: 4 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 99 }] } };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 2 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, dayOfMonth: 4 })).toBe(true);
  });
});

describe('duration + condition tree', () => {
  it('multi-day event covers days after tree-match start', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, dayOfMonth: 0 }, endDate: { year: 2024, month: 0, dayOfMonth: 2 },
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
  it('works with legacy pattern notes', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, repeat: 'monthly', repeatInterval: 1 };
    const occurrences = getNextOccurrences(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, 2);
    expect(occurrences.length).toBe(2);
  });
  it('respects maxSearchDays parameter', () => {
    const noteData = { startDate: { year: 2024, month: 0, dayOfMonth: 0 }, conditionTree: { type: 'group', mode: 'and', children: [{ field: 'day', op: '==', value: 1 }] } };
    const occurrences = getNextOccurrences(noteData, { year: 2024, month: 0, dayOfMonth: 0 }, 5, 15);
    expect(occurrences.length).toBe(1);
  });
});
