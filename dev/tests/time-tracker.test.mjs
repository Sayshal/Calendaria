/**
 * Tests for time-tracker.mjs
 * Covers: onUpdateWorldTime period changes, threshold crossings,
 * moon phase changes, skipNextHooks.
 * @module Tests/TimeTracker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: vi.fn((key) => key),
  format: vi.fn((key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) result = result.replace(`{${k}}`, String(v));
    return result;
  })
}));
vi.mock('../../scripts/utils/macro-utils.mjs', () => ({
  executeMacroById: vi.fn()
}));
vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  SETTINGS: { MACRO_TRIGGERS: 'macroTriggers' },
  HOOKS: {
    DATE_TIME_CHANGE: 'calendaria.dateTimeChange',
    DAY_CHANGE: 'calendaria.dayChange',
    MONTH_CHANGE: 'calendaria.monthChange',
    YEAR_CHANGE: 'calendaria.yearChange',
    SEASON_CHANGE: 'calendaria.seasonChange',
    MIDNIGHT: 'calendaria.midnight',
    SUNRISE: 'calendaria.sunrise',
    MIDDAY: 'calendaria.midday',
    SUNSET: 'calendaria.sunset',
    MOON_PHASE_CHANGE: 'calendaria.moonPhaseChange',
    REST_DAY_CHANGE: 'calendaria.restDayChange'
  }
}));

vi.mock('../../scripts/calendar/calendar-manager.mjs', () => ({
  default: {
    getActiveCalendar: vi.fn(() => ({
      monthsArray: [
        { name: 'January', days: 31 },
        { name: 'February', days: 28 },
        { name: 'March', days: 31 }
      ],
      seasonsArray: [{ name: 'Spring' }, { name: 'Summer' }, { name: 'Autumn' }, { name: 'Winter' }],
      moonsArray: [],
      days: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
      years: { yearZero: 0 },
      timeToComponents: vi.fn((t) => {
        const spd = 86400;
        const totalDays = Math.floor(t / spd);
        const year = Math.floor(totalDays / 365);
        const dayOfYear = totalDays % 365;
        let month = 0;
        let dayOfMonth = dayOfYear;
        const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        for (let i = 0; i < days.length; i++) {
          if (dayOfMonth < days[i]) {
            month = i;
            break;
          }
          dayOfMonth -= days[i];
        }
        const remaining = t % spd;
        const hour = Math.floor(remaining / 3600);
        const minute = Math.floor((remaining % 3600) / 60);
        const second = remaining % 60;
        return { year, month, dayOfMonth, hour, minute, second };
      }),
      sunrise: vi.fn(() => 6),
      sunset: vi.fn(() => 18),
      getMoonPhase: vi.fn(() => null),
      getWeekdayForDate: vi.fn(() => null)
    }))
  }
}));

vi.mock('../../scripts/weather/weather-manager.mjs', () => ({
  default: {
    getActiveZone: vi.fn(() => null)
  }
}));

import TimeTracker from '../../scripts/time/time-tracker.mjs';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';

beforeEach(() => {
  game.time.worldTime = 43200; // noon day 0
  game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 12, minute: 0, second: 0 };
  game.settings.get.mockReturnValue({ global: {}, moonPhase: [] });
  game.scenes = { active: null, filter: vi.fn(() => []) };
  Hooks.callAll.mockClear();
  TimeTracker.initialize();
});

/* -------------------------------------------- */
/*  Period changes                               */
/* -------------------------------------------- */

describe('TimeTracker — period changes', () => {
  it('fires DAY_CHANGE when dayOfMonth changes', () => {
    // Advance from day 0 to day 1
    game.time.worldTime = 86400 + 43200; // day 1, noon
    game.time.components = { year: 0, month: 0, dayOfMonth: 1, hour: 12, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 86400);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.dayChange', expect.any(Object));
  });

  it('fires MONTH_CHANGE when month changes', () => {
    game.time.worldTime = 31 * 86400 + 43200;
    game.time.components = { year: 0, month: 1, dayOfMonth: 0, hour: 12, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 86400);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.monthChange', expect.any(Object));
  });

  it('fires YEAR_CHANGE when year changes', () => {
    game.time.worldTime = 365 * 86400 + 43200;
    game.time.components = { year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 86400);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.yearChange', expect.any(Object));
  });

  it('fires SEASON_CHANGE when season changes', () => {
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 12, minute: 0, second: 0, season: 0 };
    TimeTracker.initialize();
    game.time.worldTime = 86400 + 43200;
    game.time.components = { year: 0, month: 0, dayOfMonth: 1, hour: 12, minute: 0, second: 0, season: 1 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 86400);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.seasonChange', expect.any(Object));
  });

  it('always fires DATE_TIME_CHANGE', () => {
    game.time.worldTime = 43200 + 3600;
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 13, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 3600);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.dateTimeChange', expect.any(Object));
  });

  it('does not fire period hooks when no period change', () => {
    game.time.worldTime = 43200 + 60;
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 12, minute: 1, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 60);
    expect(Hooks.callAll).not.toHaveBeenCalledWith('calendaria.dayChange', expect.any(Object));
    expect(Hooks.callAll).not.toHaveBeenCalledWith('calendaria.monthChange', expect.any(Object));
  });
});

/* -------------------------------------------- */
/*  Threshold crossings                          */
/* -------------------------------------------- */

describe('TimeTracker — threshold crossings', () => {
  it('fires MIDDAY when crossing midday (hour 12)', () => {
    // Start at hour 11
    game.time.worldTime = 11 * 3600;
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 11, minute: 0, second: 0 };
    TimeTracker.initialize();
    // Advance to hour 13
    game.time.worldTime = 13 * 3600;
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 13, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 2 * 3600);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.midday', expect.any(Object));
  });

  it('fires SUNRISE when crossing sunrise (hour 6)', () => {
    game.time.worldTime = 5 * 3600;
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 5, minute: 0, second: 0 };
    TimeTracker.initialize();
    game.time.worldTime = 7 * 3600;
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 7, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 2 * 3600);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.sunrise', expect.any(Object));
  });

  it('fires SUNSET when crossing sunset (hour 18)', () => {
    game.time.worldTime = 17 * 3600;
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 17, minute: 0, second: 0 };
    TimeTracker.initialize();
    game.time.worldTime = 19 * 3600;
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 19, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 2 * 3600);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.sunset', expect.any(Object));
  });

  it('does not fire threshold when time goes backwards', () => {
    game.time.worldTime = 13 * 3600;
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 13, minute: 0, second: 0 };
    TimeTracker.initialize();
    // Go backwards
    game.time.worldTime = 10 * 3600;
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 10, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, -3 * 3600);
    // Should not fire midday or sunrise
    const hookCalls = Hooks.callAll.mock.calls.map((c) => c[0]);
    expect(hookCalls).not.toContain('calendaria.midday');
    expect(hookCalls).not.toContain('calendaria.sunrise');
  });
});

/* -------------------------------------------- */
/*  skipNextHooks                                */
/* -------------------------------------------- */

describe('TimeTracker — skipNextHooks', () => {
  it('skips period and threshold hooks after skipNextHooks()', () => {
    TimeTracker.skipNextHooks();
    // Large time jump from day 0 to day 5
    game.time.worldTime = 5 * 86400 + 43200;
    game.time.components = { year: 0, month: 0, dayOfMonth: 5, hour: 12, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 5 * 86400);
    // Only DATE_TIME_CHANGE should fire, not period or threshold hooks
    const hookCalls = Hooks.callAll.mock.calls.map((c) => c[0]);
    expect(hookCalls).toContain('calendaria.dateTimeChange');
    expect(hookCalls).not.toContain('calendaria.dayChange');
    expect(hookCalls).not.toContain('calendaria.midday');
  });

  it('resumes normal behavior after one skip', () => {
    TimeTracker.skipNextHooks();
    // First update — skipped
    game.time.worldTime = 86400 + 43200;
    game.time.components = { year: 0, month: 0, dayOfMonth: 1, hour: 12, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 86400);
    Hooks.callAll.mockClear();
    // Second update — should fire normally
    game.time.worldTime = 2 * 86400 + 43200;
    game.time.components = { year: 0, month: 0, dayOfMonth: 2, hour: 12, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 86400);
    const hookCalls = Hooks.callAll.mock.calls.map((c) => c[0]);
    expect(hookCalls).toContain('calendaria.dayChange');
  });
});

/* -------------------------------------------- */
/*  Moon phase changes                           */
/* -------------------------------------------- */

describe('TimeTracker — moon phase changes', () => {
  it('fires MOON_PHASE_CHANGE when phase changes', () => {
    // Override getActiveCalendar to return a persistent object with moonsArray
    const moonCalendar = {
      monthsArray: [
        { name: 'January', days: 31 },
        { name: 'February', days: 28 },
        { name: 'March', days: 31 }
      ],
      seasonsArray: [{ name: 'Spring' }, { name: 'Summer' }, { name: 'Autumn' }, { name: 'Winter' }],
      moonsArray: [{ name: 'Luna', phases: { 0: { name: 'New' }, 1: { name: 'Crescent' } } }],
      days: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
      years: { yearZero: 0 },
      timeToComponents: vi.fn((t) => {
        const spd = 86400;
        const totalDays = Math.floor(t / spd);
        const year = Math.floor(totalDays / 365);
        const dayOfYear = totalDays % 365;
        let month = 0;
        let dayOfMonth = dayOfYear;
        const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        for (let i = 0; i < days.length; i++) {
          if (dayOfMonth < days[i]) {
            month = i;
            break;
          }
          dayOfMonth -= days[i];
        }
        const remaining = t % spd;
        const hour = Math.floor(remaining / 3600);
        const minute = Math.floor((remaining % 3600) / 60);
        const second = remaining % 60;
        return { year, month, dayOfMonth, hour, minute, second };
      }),
      sunrise: vi.fn(() => 6),
      sunset: vi.fn(() => 18),
      getMoonPhase: vi.fn(() => ({ phaseIndex: 0 })),
      getWeekdayForDate: vi.fn(() => null)
    };
    CalendarManager.getActiveCalendar.mockReturnValue(moonCalendar);
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 12, minute: 0, second: 0 };
    TimeTracker.initialize();
    Hooks.callAll.mockClear();

    // Now change the phase
    moonCalendar.getMoonPhase.mockReturnValue({ phaseIndex: 1 });
    game.time.worldTime = 86400 + 43200;
    game.time.components = { year: 0, month: 0, dayOfMonth: 1, hour: 12, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 86400);
    expect(Hooks.callAll).toHaveBeenCalledWith(
      'calendaria.moonPhaseChange',
      expect.objectContaining({
        moons: expect.arrayContaining([expect.objectContaining({ moonIndex: 0 })])
      })
    );
  });

  it('does not fire when no phase change', () => {
    const calendar = CalendarManager.getActiveCalendar();
    calendar.moonsArray = [{ name: 'Luna', phases: { 0: { name: 'New' } } }];
    calendar.getMoonPhase.mockReturnValue({ phaseIndex: 0 });
    game.time.components = { year: 0, month: 0, dayOfMonth: 0, hour: 12, minute: 0, second: 0 };
    TimeTracker.initialize();

    game.time.worldTime = 86400 + 43200;
    game.time.components = { year: 0, month: 0, dayOfMonth: 1, hour: 12, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 86400);
    expect(Hooks.callAll).not.toHaveBeenCalledWith('calendaria.moonPhaseChange', expect.any(Object));
  });
});

/* -------------------------------------------- */
/*  No calendar                                  */
/* -------------------------------------------- */

describe('TimeTracker — edge cases', () => {
  it('returns early when no active calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValueOnce(null);
    game.time.worldTime = 86400;
    game.time.components = { year: 0, month: 0, dayOfMonth: 1, hour: 0, minute: 0, second: 0 };
    TimeTracker.onUpdateWorldTime(game.time.worldTime, 86400);
    expect(Hooks.callAll).not.toHaveBeenCalled();
  });
});
