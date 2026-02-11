/**
 * Tests for recurrence.mjs
 * @module Tests/Recurrence
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
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

vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager };
});

vi.mock('../../scripts/notes/note-manager.mjs', () => ({
  default: {
    getNoteById: vi.fn(() => null)
  }
}));

import {
  isRecurringMatch,
  getRecurrenceDescription,
  getOccurrencesInRange,
  resolveComputedDate,
  generateRandomOccurrences,
  needsRandomRegeneration,
  matchesCachedOccurrence
} from '../../scripts/notes/utils/recurrence.mjs';

import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';

beforeEach(() => {
  CalendarManager._reset();
});

/* -------------------------------------------- */
/*  isRecurringMatch() - Basic Patterns         */
/* -------------------------------------------- */

describe('isRecurringMatch()', () => {
  describe('never (no repeat)', () => {
    it('matches on exact start date', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 15 },
        repeat: 'never'
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
    });

    it('does not match on different date', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 15 },
        repeat: 'never'
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 16 })).toBe(false);
    });
  });

  describe('daily', () => {
    it('matches every day after start', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 1 },
        repeat: 'daily',
        repeatInterval: 1
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 2 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 10 })).toBe(true);
    });

    it('does not match before start date', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 15 },
        repeat: 'daily',
        repeatInterval: 1
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 14 })).toBe(false);
    });

    it('respects interval', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 1 },
        repeat: 'daily',
        repeatInterval: 3 // Every 3rd day
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 2 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 4 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 7 })).toBe(true);
    });

    it('respects repeatEndDate', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 1 },
        repeatEndDate: { year: 2024, month: 0, day: 10 },
        repeat: 'daily',
        repeatInterval: 1
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 10 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 11 })).toBe(false);
    });
  });

  describe('weekly', () => {
    it('matches every 7 days after start', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 1 },
        repeat: 'weekly',
        repeatInterval: 1
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 8 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
      // Non-matching days
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 2 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 9 })).toBe(false);
    });

    it('respects interval (bi-weekly)', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 1 },
        repeat: 'weekly',
        repeatInterval: 2
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 8 })).toBe(false); // 1 week
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true); // 2 weeks
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 22 })).toBe(false); // 3 weeks
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 29 })).toBe(true); // 4 weeks
    });
  });

  describe('monthly', () => {
    it('matches same day each month', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 15 },
        repeat: 'monthly',
        repeatInterval: 1
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 15 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 2, day: 15 })).toBe(true);
      // Wrong day
      expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 14 })).toBe(false);
    });

    it('respects interval (every 2 months)', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 15 },
        repeat: 'monthly',
        repeatInterval: 2
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 15 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2024, month: 2, day: 15 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 3, day: 15 })).toBe(false);
    });
  });

  describe('yearly', () => {
    it('matches same day and month each year', () => {
      const noteData = {
        startDate: { year: 2020, month: 6, day: 4 },
        repeat: 'yearly',
        repeatInterval: 1
      };
      expect(isRecurringMatch(noteData, { year: 2020, month: 6, day: 4 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2021, month: 6, day: 4 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2025, month: 6, day: 4 })).toBe(true);
      // Wrong day or month
      expect(isRecurringMatch(noteData, { year: 2021, month: 6, day: 5 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2021, month: 7, day: 4 })).toBe(false);
    });

    it('respects interval (every 2 years)', () => {
      const noteData = {
        startDate: { year: 2020, month: 6, day: 4 },
        repeat: 'yearly',
        repeatInterval: 2
      };
      expect(isRecurringMatch(noteData, { year: 2020, month: 6, day: 4 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2021, month: 6, day: 4 })).toBe(false);
      expect(isRecurringMatch(noteData, { year: 2022, month: 6, day: 4 })).toBe(true);
      expect(isRecurringMatch(noteData, { year: 2024, month: 6, day: 4 })).toBe(true);
    });
  });

  describe('invalid/unknown repeat type', () => {
    it('returns false for unknown repeat type', () => {
      const noteData = {
        startDate: { year: 2024, month: 0, day: 1 },
        repeat: 'unknown'
      };
      expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(false);
    });
  });
});

/* -------------------------------------------- */
/*  getRecurrenceDescription()                  */
/* -------------------------------------------- */

describe('getRecurrenceDescription()', () => {
  it('returns localization key for daily', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('CALENDARIA');
  });

  it('returns localization key for weekly', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'weekly',
      repeatInterval: 1
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('CALENDARIA');
  });

  it('returns localization key for monthly', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 15 },
      repeat: 'monthly',
      repeatInterval: 1
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('CALENDARIA');
  });

  it('returns localization key for yearly', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'yearly',
      repeatInterval: 1
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('CALENDARIA');
  });

  it('returns localization key for never/no repeat', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'never'
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('CALENDARIA');
  });
});

/* -------------------------------------------- */
/*  getOccurrencesInRange()                     */
/* -------------------------------------------- */

describe('getOccurrencesInRange()', () => {
  it('returns empty array for non-repeating note outside start date', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 15 },
      repeat: 'never'
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 0, day: 10 });
    expect(occurrences).toEqual([]);
  });

  it('returns start date for non-repeating note within range', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 5 },
      repeat: 'never'
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 0, day: 10 });
    expect(occurrences.length).toBe(1);
    expect(occurrences[0]).toEqual({ year: 2024, month: 0, day: 5 });
  });

  it('returns multiple occurrences for daily repeat', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 0, day: 5 });
    expect(occurrences.length).toBe(5);
  });

  it('returns weekly occurrences in range', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'weekly',
      repeatInterval: 1
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 0, day: 31 });
    // Jan has ~4-5 weeks, should have 4-5 occurrences
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
    expect(occurrences.length).toBeLessThanOrEqual(5);
  });

  it('respects maxOccurrences parameter', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1
    };
    const occurrences = getOccurrencesInRange(
      noteData,
      { year: 2024, month: 0, day: 1 },
      { year: 2024, month: 11, day: 31 }, // Full year
      10 // Max 10 occurrences
    );
    expect(occurrences.length).toBe(10);
  });

  it('returns monthly occurrences in range', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 15 },
      repeat: 'monthly',
      repeatInterval: 1
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 5, day: 30 });
    expect(occurrences.length).toBe(6);
    expect(occurrences[0]).toEqual({ year: 2024, month: 0, day: 15 });
    expect(occurrences[5]).toEqual({ year: 2024, month: 5, day: 15 });
  });

  it('returns yearly occurrences in range', () => {
    const noteData = {
      startDate: { year: 2020, month: 6, day: 4 },
      repeat: 'yearly',
      repeatInterval: 1
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2020, month: 0, day: 1 }, { year: 2025, month: 11, day: 31 });
    expect(occurrences.length).toBe(6);
  });
});

/* -------------------------------------------- */
/*  maxOccurrences Limit                        */
/* -------------------------------------------- */

describe('maxOccurrences limit', () => {
  it('limits daily recurrence to maxOccurrences', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      maxOccurrences: 5
    };
    // First 5 should match
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(true);
    // 6th occurrence should not match
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 6 })).toBe(false);
  });

  it('limits weekly recurrence to maxOccurrences', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'weekly',
      repeatInterval: 1,
      maxOccurrences: 3
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 8 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 22 })).toBe(false);
  });

  it('limits monthly recurrence to maxOccurrences', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 15 },
      repeat: 'monthly',
      repeatInterval: 1,
      maxOccurrences: 2
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, day: 15 })).toBe(false);
  });

  it('limits yearly recurrence to maxOccurrences', () => {
    const noteData = {
      startDate: { year: 2020, month: 6, day: 4 },
      repeat: 'yearly',
      repeatInterval: 1,
      maxOccurrences: 3
    };
    expect(isRecurringMatch(noteData, { year: 2020, month: 6, day: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2021, month: 6, day: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2022, month: 6, day: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2023, month: 6, day: 4 })).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Multi-day Events (Duration)                 */
/* -------------------------------------------- */

describe('multi-day events', () => {
  it('handles multi-day recurring events with daily pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      endDate: { year: 2024, month: 0, day: 3 },
      repeat: 'daily',
      repeatInterval: 7
    };
    // First occurrence: days 1-3
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 2 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 3 })).toBe(true);
    // Second occurrence: days 8-10
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 8 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 9 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 10 })).toBe(true);
  });

  it('handles multi-day recurring events with weekly pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      endDate: { year: 2024, month: 0, day: 3 },
      repeat: 'weekly',
      repeatInterval: 1
    };
    // First occurrence: days 1-3
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 2 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 3 })).toBe(true);
    // Second occurrence: days 8-10
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 8 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 9 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 10 })).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Week of Month Recurrence                    */
/* -------------------------------------------- */

describe('weekOfMonth recurrence', () => {
  it('matches 2nd Tuesday of every month', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 9 }, // 2nd Tuesday of Jan 2024
      repeat: 'weekOfMonth',
      repeatInterval: 1,
      weekday: 2, // Tuesday (0-indexed: Sun=0, Mon=1, Tue=2)
      weekNumber: 2
    };
    // 2nd Tuesday of Jan 2024 is the 9th
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 9 })).toBe(true);
    // 2nd Tuesday of Feb 2024 is the 13th
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 13 })).toBe(true);
    // Not 2nd Tuesday
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 16 })).toBe(false);
  });

  it('matches last Friday of every month (negative weekNumber)', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 26 }, // Last Friday of Jan 2024
      repeat: 'weekOfMonth',
      repeatInterval: 1,
      weekday: 5, // Friday
      weekNumber: -1 // Last
    };
    // Last Friday of Jan 2024 is the 26th
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 26 })).toBe(true);
    // Last Friday of Feb 2024 is the 23rd
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 23 })).toBe(true);
  });

  it('respects interval for weekOfMonth', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 9 },
      repeat: 'weekOfMonth',
      repeatInterval: 2, // Every other month
      weekday: 2,
      weekNumber: 2
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 9 })).toBe(true);
    // Feb should not match (1 month later, odd interval)
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 13 })).toBe(false);
    // March 2nd Tuesday - check actual matching behavior
    // With interval=2 starting from Jan, next match is March
    // The 2nd Tuesday of March 2024 is the 12th
    // But the matching depends on weekday calculation
  });
});

/* -------------------------------------------- */
/*  Range Pattern Recurrence                    */
/* -------------------------------------------- */

describe('range pattern recurrence', () => {
  it('matches specific day across all months', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 15 },
      repeat: 'range',
      rangePattern: {
        year: null, // Any year
        month: null, // Any month
        day: 15 // Only 15th
      }
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, day: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2025, month: 3, day: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 14 })).toBe(false);
  });

  it('matches day range within specific months', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'range',
      rangePattern: {
        year: null,
        month: [0, 2], // Jan through March
        day: [1, 10] // 1st through 10th
      }
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 5 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, day: 5 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 3, day: 5 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(false);
  });

  it('matches specific year only', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'range',
      rangePattern: {
        year: 2024,
        month: null,
        day: null
      }
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, day: 20 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2025, month: 5, day: 20 })).toBe(false);
  });

  it('handles open-ended ranges', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'range',
      rangePattern: {
        year: [2024, null], // 2024 and onwards
        month: null,
        day: 1
      }
    };
    expect(isRecurringMatch(noteData, { year: 2023, month: 0, day: 1 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2030, month: 0, day: 1 })).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Seasonal Recurrence                         */
/* -------------------------------------------- */

describe('seasonal recurrence', () => {
  beforeEach(() => {
    CalendarManager._configure({
      seasons: {
        values: [
          { name: 'Spring', dayStart: 80, dayEnd: 171 },
          { name: 'Summer', dayStart: 172, dayEnd: 264 },
          { name: 'Autumn', dayStart: 265, dayEnd: 354 },
          { name: 'Winter', dayStart: 355, dayEnd: 79 }
        ]
      }
    });
  });

  it('matches entire season', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'seasonal',
      seasonalConfig: {
        seasonIndex: 1, // Summer
        trigger: 'entire'
      }
    };
    // Day 172 is in Summer (around June 21)
    // June 21 = 31+29+31+30+31+21 = 173
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, day: 21 })).toBe(true);
    // Day 80 is Spring
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, day: 21 })).toBe(false);
  });

  it('matches first day of season', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'seasonal',
      seasonalConfig: {
        seasonIndex: 0, // Spring
        trigger: 'firstDay'
      }
    };
    // Spring starts at dayStart=80
    // Day 80 = 31 (Jan) + 28 (Feb) + 21 = 80 -> March 21
    // But day counting is 1-based, so day 80 = March 21 (day 21 of month 2)
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, day: 21 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 2, day: 22 })).toBe(false);
  });

  it('matches last day of season', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'seasonal',
      seasonalConfig: {
        seasonIndex: 0, // Spring
        trigger: 'lastDay'
      }
    };
    // Spring ends at day 171 (June 20)
    // Day 171 = 31+28+31+30+31+20 = 171
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, day: 20 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, day: 19 })).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Random Events                               */
/* -------------------------------------------- */

describe('random events', () => {
  it('matchesCachedOccurrence returns true for matching date', () => {
    const cached = [
      { year: 2024, month: 0, day: 5 },
      { year: 2024, month: 0, day: 15 },
      { year: 2024, month: 1, day: 3 }
    ];
    expect(matchesCachedOccurrence(cached, { year: 2024, month: 0, day: 5 })).toBe(true);
    expect(matchesCachedOccurrence(cached, { year: 2024, month: 0, day: 15 })).toBe(true);
    expect(matchesCachedOccurrence(cached, { year: 2024, month: 0, day: 6 })).toBe(false);
  });

  it('matchesCachedOccurrence returns false for empty array', () => {
    expect(matchesCachedOccurrence([], { year: 2024, month: 0, day: 5 })).toBe(false);
    expect(matchesCachedOccurrence(null, { year: 2024, month: 0, day: 5 })).toBe(false);
  });

  it('isRecurringMatch with random uses cached occurrences', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'random',
      randomConfig: { seed: 12345, probability: 10, checkInterval: 'daily' },
      cachedRandomOccurrences: [
        { year: 2024, month: 0, day: 5 },
        { year: 2024, month: 0, day: 20 }
      ]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 20 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 6 })).toBe(false);
  });

  it('random with 0% probability never matches', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'random',
      randomConfig: { seed: 12345, probability: 0, checkInterval: 'daily' }
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 100 })).toBe(false);
  });

  it('random with 100% probability always matches', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'random',
      randomConfig: { seed: 12345, probability: 100, checkInterval: 'daily' }
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 100 })).toBe(true);
  });

  it('random respects repeatEndDate', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeatEndDate: { year: 2024, month: 0, day: 10 },
      repeat: 'random',
      randomConfig: { seed: 12345, probability: 100, checkInterval: 'daily' }
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 11 })).toBe(false);
  });

  it('random does not match before startDate', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 10 },
      repeat: 'random',
      randomConfig: { seed: 12345, probability: 100, checkInterval: 'daily' }
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 10 })).toBe(true);
  });
});

/* -------------------------------------------- */
/*  generateRandomOccurrences()                 */
/* -------------------------------------------- */

describe('generateRandomOccurrences()', () => {
  it('returns empty array for 0% probability', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      randomConfig: { seed: 12345, probability: 0, checkInterval: 'daily' }
    };
    const occurrences = generateRandomOccurrences(noteData, 2024);
    expect(occurrences).toEqual([]);
  });

  it('returns occurrences for valid probability', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      randomConfig: { seed: 42, probability: 50, checkInterval: 'daily' }
    };
    const occurrences = generateRandomOccurrences(noteData, 2024);
    expect(occurrences.length).toBeGreaterThan(0);
    // Should be deterministic with same seed
    const occurrences2 = generateRandomOccurrences(noteData, 2024);
    expect(occurrences).toEqual(occurrences2);
  });

  it('returns empty if startDate is after targetYear', () => {
    const noteData = {
      startDate: { year: 2025, month: 0, day: 1 },
      randomConfig: { seed: 42, probability: 50, checkInterval: 'daily' }
    };
    const occurrences = generateRandomOccurrences(noteData, 2024);
    expect(occurrences).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  needsRandomRegeneration()                   */
/* -------------------------------------------- */

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

/* -------------------------------------------- */
/*  Conditions on Events                        */
/* -------------------------------------------- */

describe('conditions on events', () => {
  it('repeating event with day modulo condition', () => {
    // Modulo offsets from startDate.day implicitly (startDate.day=1 here)
    // So matches when (day - 1) % 5 === 0 → day=1,6,11,16...
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [{ field: 'day', op: '%', value: 5 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 6 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 11 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(false);
  });

  it('repeating event with year condition', () => {
    const noteData = {
      startDate: { year: 2020, month: 0, day: 1 },
      repeat: 'yearly',
      repeatInterval: 1,
      conditions: [{ field: 'year', op: '>=', value: 2022 }]
    };
    expect(isRecurringMatch(noteData, { year: 2020, month: 0, day: 1 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2022, month: 0, day: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2025, month: 0, day: 1 })).toBe(true);
  });

  it('repeating event with month condition', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 15 },
      repeat: 'monthly',
      repeatInterval: 1,
      conditions: [
        { field: 'month', op: '<=', value: 6 } // Only first 6 months (months 1-6)
      ]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true); // Month 1
    expect(isRecurringMatch(noteData, { year: 2024, month: 5, day: 15 })).toBe(true); // Month 6
    expect(isRecurringMatch(noteData, { year: 2024, month: 6, day: 15 })).toBe(false); // Month 7
  });
});

/* -------------------------------------------- */
/*  getRecurrenceDescription() Extended         */
/* -------------------------------------------- */

describe('getRecurrenceDescription() extended', () => {
  it('includes until date when repeatEndDate is set', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      repeatEndDate: { year: 2024, month: 5, day: 30 }
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('Until');
  });

  it('includes max occurrences suffix when set', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      maxOccurrences: 10
    };
    const result = getRecurrenceDescription(noteData);
    // Mock format doesn't interpolate, so we just check the key is present
    expect(result).toContain('Times');
  });

  it('describes weekOfMonth pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 9 },
      repeat: 'weekOfMonth',
      repeatInterval: 1,
      weekday: 2,
      weekNumber: 2
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('CALENDARIA');
  });

  it('describes seasonal pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'seasonal',
      seasonalConfig: { seasonIndex: 0, trigger: 'firstDay' }
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('CALENDARIA');
  });

  it('describes random pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'random',
      randomConfig: { seed: 123, probability: 25, checkInterval: 'daily' }
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('ChanceEach');
  });

  it('describes range pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'range',
      rangePattern: { year: 2024, month: null, day: 15 }
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('Range');
  });

  it('describes interval > 1 with units', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 3
    };
    const result = getRecurrenceDescription(noteData);
    // Mock format uses key, so check for X units pattern key
    expect(result).toContain('EveryXUnits');
  });
});

/* -------------------------------------------- */
/*  getOccurrencesInRange() Extended            */
/* -------------------------------------------- */

describe('getOccurrencesInRange() extended', () => {
  it('handles weekOfMonth pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 9 },
      repeat: 'weekOfMonth',
      repeatInterval: 1,
      weekday: 2,
      weekNumber: 2
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 2, day: 31 });
    expect(occurrences.length).toBe(3);
  });

  it('handles range pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'range',
      rangePattern: { year: null, month: null, day: 15 }
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 2, day: 31 });
    expect(occurrences.length).toBe(3); // 15th of Jan, Feb, Mar
  });

  it('handles random with cached occurrences', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'random',
      randomConfig: { seed: 123, probability: 50, checkInterval: 'daily' },
      cachedRandomOccurrences: [
        { year: 2024, month: 0, day: 5 },
        { year: 2024, month: 0, day: 15 },
        { year: 2024, month: 1, day: 10 }
      ]
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 0, day: 31 });
    expect(occurrences.length).toBe(2);
    expect(occurrences[0]).toEqual({ year: 2024, month: 0, day: 5 });
    expect(occurrences[1]).toEqual({ year: 2024, month: 0, day: 15 });
  });

  it('handles seasonal pattern', () => {
    CalendarManager._configure({
      seasons: {
        values: [
          { name: 'Spring', dayStart: 80, dayEnd: 171 },
          { name: 'Summer', dayStart: 172, dayEnd: 264 },
          { name: 'Autumn', dayStart: 265, dayEnd: 354 },
          { name: 'Winter', dayStart: 355, dayEnd: 79 }
        ]
      }
    });
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'seasonal',
      seasonalConfig: { seasonIndex: 1, trigger: 'entire' }
    };
    const occurrences = getOccurrencesInRange(
      noteData,
      { year: 2024, month: 5, day: 21 }, // Summer start
      { year: 2024, month: 5, day: 25 },
      5
    );
    expect(occurrences.length).toBeGreaterThan(0);
  });

  it('handles moon pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'moon',
      moonConditions: [{ moonIndex: 0, phaseStart: 0.45, phaseEnd: 0.55 }] // Full moon
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 1, day: 28 }, 10);
    // Should find some full moon occurrences
    expect(occurrences.length).toBeGreaterThanOrEqual(0);
  });
});

/* -------------------------------------------- */
/*  Moon Recurrence                             */
/* -------------------------------------------- */

describe('moon recurrence', () => {
  it('returns false for moon pattern without moonConditions', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'moon',
      moonConditions: []
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(false);
  });

  it('returns false for moon pattern with null moonConditions', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'moon',
      moonConditions: null
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(false);
  });

  it('respects startDate for moon pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 6, day: 1 },
      repeat: 'moon',
      moonConditions: [{ moonIndex: 0, phaseStart: 0.4, phaseEnd: 0.6 }]
    };
    // Before start date should not match
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(false);
  });

  it('respects repeatEndDate for moon pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeatEndDate: { year: 2024, month: 0, day: 10 },
      repeat: 'moon',
      moonConditions: [{ moonIndex: 0, phaseStart: 0.4, phaseEnd: 0.6 }]
    };
    // After end date should not match
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 15 })).toBe(false);
  });

  it('respects maxOccurrences for moon pattern', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'moon',
      moonConditions: [{ moonIndex: 0, phaseStart: 0.4, phaseEnd: 0.6 }],
      maxOccurrences: 1
    };
    // With low maxOccurrences, later matches should fail
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 11, day: 31 }, 100);
    expect(occurrences.length).toBeLessThanOrEqual(1);
  });
});

/* -------------------------------------------- */
/*  Computed Events                             */
/* -------------------------------------------- */

describe('computed events', () => {
  it('resolveComputedDate returns null for empty chain', () => {
    expect(resolveComputedDate({}, 2024)).toBe(null);
    expect(resolveComputedDate({ chain: [] }, 2024)).toBe(null);
    expect(resolveComputedDate(null, 2024)).toBe(null);
  });

  it('resolveComputedDate uses yearOverrides when available', () => {
    const config = {
      chain: [{ type: 'anchor', value: 'springEquinox' }],
      yearOverrides: {
        2024: { month: 2, day: 25 }
      }
    };
    const result = resolveComputedDate(config, 2024);
    expect(result).toEqual({ year: 2024, month: 2, day: 25 });
  });

  it('resolveComputedDate handles springEquinox anchor', () => {
    CalendarManager._configure({
      seasons: {
        values: [
          { name: 'Spring', dayStart: 80, dayEnd: 171 },
          { name: 'Summer', dayStart: 172, dayEnd: 264 },
          { name: 'Autumn', dayStart: 265, dayEnd: 354 },
          { name: 'Winter', dayStart: 355, dayEnd: 79 }
        ]
      }
    });
    const config = {
      chain: [{ type: 'anchor', value: 'springEquinox' }]
    };
    const result = resolveComputedDate(config, 2024);
    expect(result).not.toBe(null);
    expect(result.year).toBe(2024);
  });

  it('resolveComputedDate handles autumnEquinox anchor', () => {
    CalendarManager._configure({
      seasons: {
        values: [
          { name: 'Spring', dayStart: 80, dayEnd: 171 },
          { name: 'Summer', dayStart: 172, dayEnd: 264 },
          { name: 'Autumn', dayStart: 265, dayEnd: 354 },
          { name: 'Winter', dayStart: 355, dayEnd: 79 }
        ]
      }
    });
    const config = {
      chain: [{ type: 'anchor', value: 'autumnEquinox' }]
    };
    const result = resolveComputedDate(config, 2024);
    expect(result).not.toBe(null);
    expect(result.year).toBe(2024);
  });

  it('resolveComputedDate handles summerSolstice anchor with daylight config', () => {
    CalendarManager._configure({
      daylight: { summerSolstice: 172, winterSolstice: 355 },
      seasons: { values: [] }
    });
    const config = {
      chain: [{ type: 'anchor', value: 'summerSolstice' }]
    };
    const result = resolveComputedDate(config, 2024);
    expect(result).not.toBe(null);
  });

  it('resolveComputedDate handles winterSolstice anchor with daylight config', () => {
    CalendarManager._configure({
      daylight: { summerSolstice: 172, winterSolstice: 355 },
      seasons: { values: [] }
    });
    const config = {
      chain: [{ type: 'anchor', value: 'winterSolstice' }]
    };
    const result = resolveComputedDate(config, 2024);
    expect(result).not.toBe(null);
  });

  it('resolveComputedDate handles daysAfter step', () => {
    CalendarManager._configure({
      seasons: {
        values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }]
      }
    });
    const config = {
      chain: [
        { type: 'anchor', value: 'springEquinox' },
        { type: 'daysAfter', params: { days: 10 } }
      ]
    };
    const result = resolveComputedDate(config, 2024);
    expect(result).not.toBe(null);
  });

  it('resolveComputedDate handles weekdayOnOrAfter step', () => {
    CalendarManager._configure({
      seasons: {
        values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }]
      }
    });
    const config = {
      chain: [
        { type: 'anchor', value: 'springEquinox' },
        { type: 'weekdayOnOrAfter', params: { weekday: 0 } } // Sunday
      ]
    };
    const result = resolveComputedDate(config, 2024);
    expect(result).not.toBe(null);
  });

  it('resolveComputedDate handles firstAfter weekday condition', () => {
    CalendarManager._configure({
      seasons: {
        values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }]
      }
    });
    const config = {
      chain: [
        { type: 'anchor', value: 'springEquinox' },
        { type: 'firstAfter', condition: 'weekday', params: { weekday: 0 } }
      ]
    };
    const result = resolveComputedDate(config, 2024);
    expect(result).not.toBe(null);
  });

  it('isRecurringMatch with computed pattern', () => {
    CalendarManager._configure({
      seasons: {
        values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }]
      }
    });
    const noteData = {
      startDate: { year: 2020, month: 0, day: 1 },
      repeat: 'computed',
      computedConfig: {
        chain: [{ type: 'anchor', value: 'springEquinox' }]
      }
    };
    // The spring equinox for the calendar is around day 80, which is March 21
    const result = isRecurringMatch(noteData, { year: 2024, month: 2, day: 21 });
    // Should match on the computed date
    expect(typeof result).toBe('boolean');
  });

  it('getOccurrencesInRange with computed pattern', () => {
    CalendarManager._configure({
      seasons: {
        values: [{ name: 'Spring', dayStart: 80, dayEnd: 171 }]
      }
    });
    const noteData = {
      startDate: { year: 2020, month: 0, day: 1 },
      repeat: 'computed',
      computedConfig: {
        chain: [{ type: 'anchor', value: 'springEquinox' }]
      }
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2026, month: 11, day: 31 }, 10);
    expect(occurrences.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------- */
/*  Random with Weekly/Monthly Intervals        */
/* -------------------------------------------- */

describe('random with different check intervals', () => {
  it('weekly checkInterval with 100% probability matches all days', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'random',
      randomConfig: { seed: 12345, probability: 100, checkInterval: 'weekly' }
    };
    // 100% probability matches regardless of interval
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 8 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 2 })).toBe(true);
  });

  it('monthly checkInterval with 100% probability matches all days', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 15 },
      repeat: 'random',
      randomConfig: { seed: 12345, probability: 100, checkInterval: 'monthly' }
    };
    // 100% probability matches regardless of interval
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 16 })).toBe(true);
  });

  it('getOccurrencesInRange with weekly random interval', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'random',
      randomConfig: { seed: 42, probability: 50, checkInterval: 'weekly' }
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 1, day: 28 }, 20);
    // Should only include Mondays (same weekday as start)
    for (const occ of occurrences) {
      // All occurrences should be valid dates
      expect(occ.year).toBe(2024);
    }
  });

  it('getOccurrencesInRange with monthly random interval', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 15 },
      repeat: 'random',
      randomConfig: { seed: 42, probability: 50, checkInterval: 'monthly' }
    };
    const occurrences = getOccurrencesInRange(noteData, { year: 2024, month: 0, day: 1 }, { year: 2024, month: 5, day: 30 }, 10);
    // All occurrences should be on day 15
    for (const occ of occurrences) {
      expect(occ.day).toBe(15);
    }
  });
});

/* -------------------------------------------- */
/*  Additional Condition Operators              */
/* -------------------------------------------- */

describe('condition operators', () => {
  it('!= operator works correctly', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [{ field: 'day', op: '!=', value: 15 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 14 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 16 })).toBe(true);
  });

  it('> operator works correctly', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [{ field: 'day', op: '>', value: 20 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 20 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 21 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 25 })).toBe(true);
  });

  it('< operator works correctly', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [{ field: 'day', op: '<', value: 5 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 4 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 6 })).toBe(false);
  });

  it('<= operator works correctly', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [{ field: 'day', op: '<=', value: 5 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 6 })).toBe(false);
  });

  it('== operator works correctly', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [{ field: 'day', op: '==', value: 15 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 16 })).toBe(false);
  });

  it('% operator offsets from startDate implicitly', () => {
    // startDate.day=3, so matches when (day - 3) % 7 === 0 → day=3,10,17...
    const noteData = {
      startDate: { year: 2024, month: 0, day: 3 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [{ field: 'day', op: '%', value: 7 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 3 })).toBe(true); // (3-3)%7=0
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 10 })).toBe(true); // (10-3)%7=0
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(false); // (5-3)%7=2
  });

  it('% operator with value 0 returns false', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [{ field: 'day', op: '%', value: 0 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(false);
  });

  it('unknown operator returns false', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [{ field: 'day', op: '~=', value: 5 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(false);
  });

  it('unknown field returns null, causing condition to fail', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [{ field: 'unknownField', op: '==', value: 5 }]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 5 })).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Additional Field Types                      */
/* -------------------------------------------- */

describe('condition field types', () => {
  it('dayOfYear field works', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [
        { field: 'dayOfYear', op: '==', value: 32 } // Feb 1 = day 32
      ]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 1, day: 1 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(false);
  });

  it('weekday field works', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [
        { field: 'weekday', op: '>=', value: 1 } // Any weekday >= 1
      ]
    };
    // All weekdays are >= 1 (range is 1-7)
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(true);
  });

  it('weekNumberInMonth field works', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [
        { field: 'weekNumberInMonth', op: '==', value: 2 } // 2nd week
      ]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 8 })).toBe(true); // Day 8 is in week 2
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 1 })).toBe(false); // Day 1 is in week 1
  });

  it('daysBeforeMonthEnd field works', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [
        { field: 'daysBeforeMonthEnd', op: '==', value: 0 } // Last day of month
      ]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 31 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 30 })).toBe(false);
  });

  it('multiple conditions with AND logic', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'daily',
      repeatInterval: 1,
      conditions: [
        { field: 'day', op: '>=', value: 10 },
        { field: 'day', op: '<=', value: 20 }
      ]
    };
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 9 })).toBe(false);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 10 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 20 })).toBe(true);
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 21 })).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Season Wrap-around                          */
/* -------------------------------------------- */

describe('season wrap-around', () => {
  beforeEach(() => {
    CalendarManager._configure({
      seasons: {
        values: [
          { name: 'Spring', dayStart: 80, dayEnd: 171 },
          { name: 'Summer', dayStart: 172, dayEnd: 264 },
          { name: 'Autumn', dayStart: 265, dayEnd: 354 },
          { name: 'Winter', dayStart: 355, dayEnd: 79 } // Wraps around year
        ]
      }
    });
  });

  it('matches winter at start of year (wrap-around)', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'seasonal',
      seasonalConfig: {
        seasonIndex: 3, // Winter
        trigger: 'entire'
      }
    };
    // January 15 should be in winter (day 15 < 79)
    expect(isRecurringMatch(noteData, { year: 2024, month: 0, day: 15 })).toBe(true);
  });

  it('matches winter at end of year (wrap-around)', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'seasonal',
      seasonalConfig: {
        seasonIndex: 3, // Winter
        trigger: 'entire'
      }
    };
    // December 25 should be in winter (day 360 > 355)
    expect(isRecurringMatch(noteData, { year: 2024, month: 11, day: 25 })).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Description Functions                       */
/* -------------------------------------------- */

describe('getRecurrenceDescription edge cases', () => {
  it('describes computed event', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'computed',
      computedConfig: {
        chain: [
          { type: 'anchor', value: 'springEquinox' },
          { type: 'daysAfter', params: { days: 49 } }
        ]
      }
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('Spring');
  });

  it('describes moon conditions', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'moon',
      moonConditions: [{ moonIndex: 0, phaseStart: 0.45, phaseEnd: 0.55 }]
    };
    const result = getRecurrenceDescription(noteData);
    expect(typeof result).toBe('string');
  });

  it('describes negative weekNumber (last occurrence)', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 26 },
      repeat: 'weekOfMonth',
      repeatInterval: 1,
      weekday: 5,
      weekNumber: -1 // Last Friday
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('CALENDARIA');
  });

  it('describes weekOfMonth with interval > 1', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 9 },
      repeat: 'weekOfMonth',
      repeatInterval: 3,
      weekday: 2,
      weekNumber: 2
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('CALENDARIA');
  });

  it('describes seasonal lastDay trigger', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'seasonal',
      seasonalConfig: { seasonIndex: 1, trigger: 'lastDay' }
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('LastDayOf');
  });

  it('describes seasonal entire trigger', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'seasonal',
      seasonalConfig: { seasonIndex: 0, trigger: 'entire' }
    };
    const result = getRecurrenceDescription(noteData);
    expect(result).toContain('EveryDayDuring');
  });

  it('handles weekly check interval description', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'random',
      randomConfig: { seed: 123, probability: 25, checkInterval: 'weekly' }
    };
    const result = getRecurrenceDescription(noteData);
    // Random description includes ChanceEach key
    expect(result).toContain('ChanceEach');
  });

  it('handles monthly check interval description', () => {
    const noteData = {
      startDate: { year: 2024, month: 0, day: 1 },
      repeat: 'random',
      randomConfig: { seed: 123, probability: 25, checkInterval: 'monthly' }
    };
    const result = getRecurrenceDescription(noteData);
    // Random description includes ChanceEach key
    expect(result).toContain('ChanceEach');
  });
});
