/**
 * Tests for api.mjs
 * Covers every public method on CalendariaAPI and createGlobalNamespace.
 * @module Tests/API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: vi.fn((key) => key),
  format: vi.fn((key, _data) => key)
}));
vi.mock('../../scripts/calendar/calendar-manager.mjs', () => ({
  default: {
    getActiveCalendar: vi.fn(() => null),
    getCalendar: vi.fn(() => null),
    getAllCalendars: vi.fn(() => new Map()),
    getAllCalendarMetadata: vi.fn(() => []),
    switchCalendar: vi.fn(async () => true),
    getCurrentMoonPhase: vi.fn(() => null),
    getAllCurrentMoonPhases: vi.fn(() => []),
    getCurrentFestival: vi.fn(() => null),
    isBundledCalendar: vi.fn(() => false),
    getCurrentDateTime: vi.fn(() => ({ year: 0, month: 0, day: 0 }))
  }
}));
vi.mock('../../scripts/notes/note-manager.mjs', () => ({
  default: {
    getAllNotes: vi.fn(() => []),
    getNote: vi.fn(() => null),
    getFullNote: vi.fn(() => null),
    getNotesForDate: vi.fn(() => []),
    getNotesInRange: vi.fn(() => []),
    getNotesByCategory: vi.fn(() => []),
    getCategoryDefinitions: vi.fn(() => []),
    createNote: vi.fn(async () => ({})),
    updateNote: vi.fn(async () => ({})),
    deleteNote: vi.fn(async () => true),
    deleteAllNotes: vi.fn(async () => 0)
  }
}));
vi.mock('../../scripts/weather/weather-manager.mjs', () => ({
  default: {
    getActiveZone: vi.fn(() => null),
    getCurrentWeather: vi.fn(() => null),
    getCalendarZones: vi.fn(() => []),
    setWeather: vi.fn(async () => ({})),
    setCustomWeather: vi.fn(async () => ({})),
    clearWeather: vi.fn(async () => {}),
    generateAndSetWeather: vi.fn(async () => ({})),
    getForecast: vi.fn(() => []),
    getWeatherForDate: vi.fn(() => null),
    getWeatherHistory: vi.fn(() => ({})),
    setActiveZone: vi.fn(async () => {}),
    getAllPresets: vi.fn(async () => []),
    addCustomPreset: vi.fn(async () => ({})),
    removeCustomPreset: vi.fn(async () => true),
    updateCustomPreset: vi.fn(async () => ({})),
    getTemperature: vi.fn(() => null),
    getPreset: vi.fn(() => null),
    formatTemperature: vi.fn(() => ''),
    getClimateZoneTemplates: vi.fn(() => [])
  }
}));
vi.mock('../../scripts/utils/socket.mjs', () => ({
  CalendariaSocket: { isPrimaryGM: vi.fn(() => true), emit: vi.fn() }
}));
vi.mock('../../scripts/utils/permissions.mjs', () => ({
  canAddNotes: vi.fn(() => true),
  canChangeActiveCalendar: vi.fn(() => true),
  canChangeDateTime: vi.fn(() => true),
  canEditCalendars: vi.fn(() => true),
  canEditNotes: vi.fn(() => true),
  canViewWeatherForecast: vi.fn(() => true)
}));
vi.mock('../../scripts/time/time-clock.mjs', () => ({
  default: { running: false, realTimeSpeed: 1, start: vi.fn(), stop: vi.fn(), toggle: vi.fn() }
}));
vi.mock('../../scripts/time/time-tracker.mjs', () => ({ default: {} }));
vi.mock('../../scripts/utils/search-manager.mjs', () => ({
  default: { search: vi.fn(() => []) }
}));
vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  HOOKS: {
    DATE_TIME_CHANGE: 'calendaria.dateTimeChange',
    DAY_CHANGE: 'calendaria.dayChange'
  },
  SOCKET_TYPES: {
    TIME_REQUEST: 'timeRequest',
    CALENDAR_REQUEST: 'calendarRequest',
    REMINDER_NOTIFY: 'reminderNotify'
  },
  REPLACEABLE_ELEMENTS: { CLOCK: 'clock' },
  WIDGET_POINTS: { HUD_TOP: 'hud-top' }
}));
vi.mock('../../scripts/utils/formatting/format-utils.mjs', () => ({
  DEFAULT_FORMAT_PRESETS: { dateLong: '{DD} {MMM} {YYYY}' },
  formatCustom: vi.fn(() => 'formatted'),
  getAvailableTokens: vi.fn(() => [{ token: 'DD' }]),
  PRESET_FORMATTERS: {
    dateLong: vi.fn(() => '1 January 1000')
  },
  resolveFormatString: vi.fn((s) => s),
  timeSince: vi.fn(() => '3 days ago')
}));
vi.mock('../../scripts/utils/formatting/moon-utils.mjs', () => ({
  getMoonPhasePosition: vi.fn(() => 0.5),
  isMoonFull: vi.fn(() => false),
  getNextConvergence: vi.fn(() => null),
  getNextFullMoon: vi.fn(() => null),
  getConvergencesInRange: vi.fn(() => [])
}));
vi.mock('../../scripts/notes/date-utils.mjs', () => ({
  addDays: vi.fn((d) => d),
  addMonths: vi.fn((d) => d),
  addYears: vi.fn((d) => d),
  compareDates: vi.fn(() => 0),
  compareDays: vi.fn(() => 0),
  dayOfWeek: vi.fn(() => 0),
  daysBetween: vi.fn(() => 0),
  isSameDay: vi.fn(() => false),
  isValidDate: vi.fn(() => true),
  monthsBetween: vi.fn(() => 0)
}));
vi.mock('../../scripts/utils/widget-manager.mjs', () => ({
  registerWidget: vi.fn(() => true),
  getRegisteredWidgets: vi.fn(() => []),
  getWidgetByReplacement: vi.fn(() => null),
  refreshWidgets: vi.fn()
}));
vi.mock('../../scripts/data/calendaria-calendar.mjs', () => ({ default: class {} }));
vi.mock('../../scripts/utils/migrations.mjs', () => ({
  diagnoseWeatherConfig: vi.fn(async () => ({ ok: true }))
}));
vi.mock('../../scripts/applications/calendar/big-cal.mjs', () => ({
  BigCal: class {
    /** @returns {object} this */
    render() {
      return this;
    }
  }
}));
vi.mock('../../scripts/applications/calendar/calendar-editor.mjs', () => ({
  CalendarEditor: class {
    /** @returns {object} this */
    render() {
      return this;
    }
  }
}));
vi.mock('../../scripts/applications/calendar/mini-cal.mjs', () => ({
  MiniCal: { show: vi.fn(), hide: vi.fn(), toggle: vi.fn() }
}));
vi.mock('../../scripts/applications/hud/hud.mjs', () => ({ HUD: {} }));
vi.mock('../../scripts/applications/time/stopwatch.mjs', () => ({ Stopwatch: {} }));
vi.mock('../../scripts/applications/time/time-keeper.mjs', () => ({ TimeKeeper: {} }));

import { CalendariaAPI, createGlobalNamespace } from '../../scripts/api.mjs';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import NoteManager from '../../scripts/notes/note-manager.mjs';
import WeatherManager from '../../scripts/weather/weather-manager.mjs';
import { CalendariaSocket } from '../../scripts/utils/socket.mjs';
import TimeClock from '../../scripts/time/time-clock.mjs';
import SearchManager from '../../scripts/utils/search-manager.mjs';
import { canChangeDateTime, canAddNotes, canChangeActiveCalendar, canEditCalendars, canEditNotes, canViewWeatherForecast } from '../../scripts/utils/permissions.mjs';
import { addDays, addMonths, addYears, daysBetween, monthsBetween, compareDates, compareDays, isSameDay, dayOfWeek, isValidDate } from '../../scripts/notes/date-utils.mjs';
import { PRESET_FORMATTERS, formatCustom, resolveFormatString, getAvailableTokens, timeSince } from '../../scripts/utils/formatting/format-utils.mjs';
import { getMoonPhasePosition, isMoonFull, getNextConvergence, getNextFullMoon, getConvergencesInRange } from '../../scripts/utils/formatting/moon-utils.mjs';
import { registerWidget, getRegisteredWidgets, getWidgetByReplacement, refreshWidgets } from '../../scripts/utils/widget-manager.mjs';
import { diagnoseWeatherConfig } from '../../scripts/utils/migrations.mjs';
import { MiniCal } from '../../scripts/applications/calendar/mini-cal.mjs';

beforeEach(() => {
  game.time.components = { year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0, second: 0, season: 0 };
  game.time.worldTime = 0;
  game.time.set = vi.fn();
  game.user.isGM = true;
  game.scenes = { active: null };
});

/* -------------------------------------------- */
/*  getCurrentDateTime                           */
/* -------------------------------------------- */

describe('getCurrentDateTime', () => {
  it('returns components with yearZero = 0 when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    const result = CalendariaAPI.getCurrentDateTime();
    expect(result.year).toBe(1);
    expect(result.hour).toBe(12);
  });

  it('adds yearZero to the year when calendar has yearZero', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ years: { yearZero: 1000 } });
    const result = CalendariaAPI.getCurrentDateTime();
    expect(result.year).toBe(1001);
  });

  it('defaults yearZero to 0 when calendar.years is undefined', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({});
    const result = CalendariaAPI.getCurrentDateTime();
    expect(result.year).toBe(1);
  });
});

/* -------------------------------------------- */
/*  advanceTime                                  */
/* -------------------------------------------- */

describe('advanceTime', () => {
  it('shows error and returns worldTime when permission denied', async () => {
    canChangeDateTime.mockReturnValue(false);
    game.time.worldTime = 42;
    const result = await CalendariaAPI.advanceTime(100);
    expect(ui.notifications.error).toHaveBeenCalledWith('CALENDARIA.Permissions.NoAccess', { localize: true });
    expect(result).toBe(42);
  });

  it('emits socket for non-GM users with permission', async () => {
    canChangeDateTime.mockReturnValue(true);
    game.user.isGM = false;
    game.time.worldTime = 50;
    const result = await CalendariaAPI.advanceTime(100);
    expect(CalendariaSocket.emit).toHaveBeenCalledWith('timeRequest', { action: 'advance', delta: 100 });
    expect(result).toBe(50);
  });

  it('calls game.time.advance for GM users', async () => {
    canChangeDateTime.mockReturnValue(true);
    game.time.advance.mockResolvedValue(200);
    const result = await CalendariaAPI.advanceTime(100);
    expect(game.time.advance).toHaveBeenCalledWith(100);
    expect(result).toBe(200);
  });
});

/* -------------------------------------------- */
/*  setDateTime                                  */
/* -------------------------------------------- */

describe('setDateTime', () => {
  it('shows error when permission denied', async () => {
    canChangeDateTime.mockReturnValue(false);
    game.time.worldTime = 42;
    const result = await CalendariaAPI.setDateTime({ year: 5 });
    expect(ui.notifications.error).toHaveBeenCalled();
    expect(result).toBe(42);
  });

  it('subtracts yearZero from year for internal components', async () => {
    canChangeDateTime.mockReturnValue(true);
    CalendarManager.getActiveCalendar.mockReturnValue({ years: { yearZero: 1000 } });
    game.time.set.mockResolvedValue(999);
    await CalendariaAPI.setDateTime({ year: 1005, month: 2 });
    const args = game.time.set.mock.calls[0][0];
    expect(args.year).toBe(5);
    expect(args.month).toBe(2);
  });

  it('emits socket for non-GM users', async () => {
    canChangeDateTime.mockReturnValue(true);
    CalendarManager.getActiveCalendar.mockReturnValue({ years: { yearZero: 0 } });
    game.user.isGM = false;
    game.time.worldTime = 50;
    await CalendariaAPI.setDateTime({ year: 5 });
    expect(CalendariaSocket.emit).toHaveBeenCalledWith('timeRequest', expect.objectContaining({ action: 'set' }));
  });
});

/* -------------------------------------------- */
/*  jumpToDate                                   */
/* -------------------------------------------- */

describe('jumpToDate', () => {
  it('shows error when permission denied', async () => {
    canChangeDateTime.mockReturnValue(false);
    await CalendariaAPI.jumpToDate({ year: 5, month: 0, day: 1 });
    expect(ui.notifications.error).toHaveBeenCalled();
  });

  it('warns when no active calendar', async () => {
    canChangeDateTime.mockReturnValue(true);
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    await CalendariaAPI.jumpToDate({ year: 5, month: 0, day: 1 });
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  it('emits socket for non-GM users', async () => {
    canChangeDateTime.mockReturnValue(true);
    CalendarManager.getActiveCalendar.mockReturnValue({});
    game.user.isGM = false;
    await CalendariaAPI.jumpToDate({ year: 5, month: 0, day: 1 });
    expect(CalendariaSocket.emit).toHaveBeenCalledWith('timeRequest', expect.objectContaining({ action: 'jump' }));
  });

  it('calls calendar.jumpToDate for GM users', async () => {
    canChangeDateTime.mockReturnValue(true);
    const cal = { jumpToDate: vi.fn() };
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    await CalendariaAPI.jumpToDate({ year: 5, month: 0, day: 1 });
    expect(cal.jumpToDate).toHaveBeenCalledWith({ year: 5, month: 0, day: 1 });
  });
});

/* -------------------------------------------- */
/*  Calendar access                              */
/* -------------------------------------------- */

describe('calendar access', () => {
  it('getActiveCalendar delegates to CalendarManager', () => {
    const cal = { id: 'test' };
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    expect(CalendariaAPI.getActiveCalendar()).toBe(cal);
  });

  it('getCalendar delegates with id', () => {
    const cal = { id: 'gregorian' };
    CalendarManager.getCalendar.mockReturnValue(cal);
    expect(CalendariaAPI.getCalendar('gregorian')).toBe(cal);
    expect(CalendarManager.getCalendar).toHaveBeenCalledWith('gregorian');
  });

  it('getAllCalendars delegates to CalendarManager', () => {
    const map = new Map([['a', {}]]);
    CalendarManager.getAllCalendars.mockReturnValue(map);
    expect(CalendariaAPI.getAllCalendars()).toBe(map);
  });

  it('getAllCalendarMetadata delegates to CalendarManager', () => {
    const meta = [{ id: 'a', name: 'A' }];
    CalendarManager.getAllCalendarMetadata.mockReturnValue(meta);
    expect(CalendariaAPI.getAllCalendarMetadata()).toBe(meta);
  });
});

/* -------------------------------------------- */
/*  switchCalendar                               */
/* -------------------------------------------- */

describe('switchCalendar', () => {
  it('shows error and returns false when permission denied', async () => {
    canChangeActiveCalendar.mockReturnValue(false);
    const result = await CalendariaAPI.switchCalendar('test');
    expect(ui.notifications.error).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('emits socket for non-GM users', async () => {
    canChangeActiveCalendar.mockReturnValue(true);
    game.user.isGM = false;
    const result = await CalendariaAPI.switchCalendar('test');
    expect(CalendariaSocket.emit).toHaveBeenCalledWith('calendarRequest', { calendarId: 'test' });
    expect(result).toBe(true);
  });

  it('calls CalendarManager.switchCalendar for GM users', async () => {
    canChangeActiveCalendar.mockReturnValue(true);
    CalendarManager.switchCalendar.mockResolvedValue(true);
    const result = await CalendariaAPI.switchCalendar('test');
    expect(CalendarManager.switchCalendar).toHaveBeenCalledWith('test');
    expect(result).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Moon phases                                  */
/* -------------------------------------------- */

describe('moon phases', () => {
  it('getMoonPhase delegates with default index 0', () => {
    CalendarManager.getCurrentMoonPhase.mockReturnValue({ name: 'Full' });
    expect(CalendariaAPI.getMoonPhase()).toEqual({ name: 'Full' });
    expect(CalendarManager.getCurrentMoonPhase).toHaveBeenCalledWith(0);
  });

  it('getMoonPhase delegates with custom index', () => {
    CalendariaAPI.getMoonPhase(2);
    expect(CalendarManager.getCurrentMoonPhase).toHaveBeenCalledWith(2);
  });

  it('getAllMoonPhases delegates to CalendarManager', () => {
    const phases = [{ name: 'Full' }, { name: 'New' }];
    CalendarManager.getAllCurrentMoonPhases.mockReturnValue(phases);
    expect(CalendariaAPI.getAllMoonPhases()).toBe(phases);
  });

  it('getMoonPhasePosition passes date or defaults to components', () => {
    const moon = { cycleLength: 28 };
    CalendariaAPI.getMoonPhasePosition(moon);
    expect(getMoonPhasePosition).toHaveBeenCalledWith(moon, game.time.components);

    const customDate = { year: 5, month: 2, day: 10 };
    CalendariaAPI.getMoonPhasePosition(moon, customDate);
    expect(getMoonPhasePosition).toHaveBeenCalledWith(moon, customDate);
  });

  it('isMoonFull passes date or defaults to components', () => {
    const moon = { cycleLength: 28 };
    CalendariaAPI.isMoonFull(moon);
    expect(isMoonFull).toHaveBeenCalledWith(moon, game.time.components);

    const customDate = { year: 5, month: 2, day: 10 };
    CalendariaAPI.isMoonFull(moon, customDate);
    expect(isMoonFull).toHaveBeenCalledWith(moon, customDate);
  });

  it('getNextConvergence passes startDate or defaults to components', () => {
    const moons = [{ cycleLength: 28 }];
    CalendariaAPI.getNextConvergence(moons);
    expect(getNextConvergence).toHaveBeenCalledWith(moons, game.time.components, {});

    const date = { year: 5, month: 0, day: 1 };
    CalendariaAPI.getNextConvergence(moons, date, { maxDays: 500 });
    expect(getNextConvergence).toHaveBeenCalledWith(moons, date, { maxDays: 500 });
  });

  it('getNextFullMoon passes startDate or defaults to components', () => {
    const moon = { cycleLength: 28 };
    CalendariaAPI.getNextFullMoon(moon);
    expect(getNextFullMoon).toHaveBeenCalledWith(moon, game.time.components, {});

    const date = { year: 5, month: 0, day: 1 };
    CalendariaAPI.getNextFullMoon(moon, date);
    expect(getNextFullMoon).toHaveBeenCalledWith(moon, date, {});
  });

  it('getConvergencesInRange delegates to moon-utils', () => {
    const moons = [{ cycleLength: 28 }];
    const start = { year: 1, month: 0, day: 1 };
    const end = { year: 1, month: 11, day: 30 };
    CalendariaAPI.getConvergencesInRange(moons, start, end, { maxDays: 100 });
    expect(getConvergencesInRange).toHaveBeenCalledWith(moons, start, end, { maxDays: 100 });
  });
});

/* -------------------------------------------- */
/*  getCurrentSeason / getCycleValues            */
/* -------------------------------------------- */

describe('getCurrentSeason', () => {
  it('returns the season at the current season index', () => {
    const seasons = [{ name: 'Spring' }, { name: 'Summer' }];
    CalendarManager.getActiveCalendar.mockReturnValue({ seasons: true, seasonsArray: seasons });
    game.time.components.season = 1;
    expect(CalendariaAPI.getCurrentSeason()).toEqual({ name: 'Summer' });
  });

  it('returns null when no calendar is active', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getCurrentSeason()).toBeNull();
  });

  it('returns null when seasonsArray is empty', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ seasons: true, seasonsArray: [] });
    game.time.components.season = 0;
    expect(CalendariaAPI.getCurrentSeason()).toBeNull();
  });

  it('returns null when calendar has no seasons', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ seasons: false });
    expect(CalendariaAPI.getCurrentSeason()).toBeNull();
  });
});

describe('getCycleValues', () => {
  it('returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getCycleValues()).toBeNull();
  });

  it('delegates to calendar.getCycleValues()', () => {
    const result = { text: 'Zodiac: Aries', values: [{ cycleName: 'Zodiac', entryName: 'Aries', index: 0 }] };
    CalendarManager.getActiveCalendar.mockReturnValue({ getCycleValues: vi.fn(() => result) });
    expect(CalendariaAPI.getCycleValues()).toBe(result);
  });
});

/* -------------------------------------------- */
/*  Sun methods                                  */
/* -------------------------------------------- */

describe('sun methods', () => {
  const makeCal = () => ({
    sunrise: vi.fn(() => 6),
    sunset: vi.fn(() => 18),
    daylightHours: vi.fn(() => 12),
    progressDay: vi.fn(() => 0.5),
    progressNight: vi.fn(() => 0.3)
  });

  it('getSunrise returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getSunrise()).toBeNull();
  });

  it('getSunrise delegates to calendar.sunrise', () => {
    const cal = makeCal();
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    expect(CalendariaAPI.getSunrise()).toBe(6);
  });

  it('getSunrise passes zone override', () => {
    const cal = makeCal();
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    const zone = { id: 'desert' };
    CalendariaAPI.getSunrise(zone);
    expect(cal.sunrise).toHaveBeenCalledWith(undefined, zone);
  });

  it('getSunset returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getSunset()).toBeNull();
  });

  it('getSunset delegates to calendar.sunset', () => {
    const cal = makeCal();
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    expect(CalendariaAPI.getSunset()).toBe(18);
  });

  it('getDaylightHours returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getDaylightHours()).toBeNull();
  });

  it('getDaylightHours delegates to calendar.daylightHours', () => {
    const cal = makeCal();
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    expect(CalendariaAPI.getDaylightHours()).toBe(12);
  });

  it('getProgressDay returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getProgressDay()).toBeNull();
  });

  it('getProgressDay delegates to calendar.progressDay', () => {
    const cal = makeCal();
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    expect(CalendariaAPI.getProgressDay()).toBe(0.5);
  });

  it('getProgressNight returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getProgressNight()).toBeNull();
  });

  it('getProgressNight delegates to calendar.progressNight', () => {
    const cal = makeCal();
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    expect(CalendariaAPI.getProgressNight()).toBe(0.3);
  });
});

/* -------------------------------------------- */
/*  getTimeUntilTarget                           */
/* -------------------------------------------- */

describe('getTimeUntilTarget', () => {
  it('calculates time until a future hour on the same day', () => {
    game.time.components = { hour: 10, minute: 0, second: 0 };
    const result = CalendariaAPI.getTimeUntilTarget(14);
    expect(result.hours).toBe(4);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });

  it('wraps to next day when target is before current hour', () => {
    game.time.components = { hour: 20, minute: 0, second: 0 };
    const result = CalendariaAPI.getTimeUntilTarget(6);
    expect(result.hours).toBe(10);
    expect(result.minutes).toBe(0);
  });

  it('returns full day when current hour equals target', () => {
    game.time.components = { hour: 6, minute: 0, second: 0 };
    const result = CalendariaAPI.getTimeUntilTarget(6);
    expect(result.hours).toBe(24);
    expect(result.minutes).toBe(0);
  });

  it('accounts for minutes and seconds in current time', () => {
    game.time.components = { hour: 10, minute: 30, second: 0 };
    const result = CalendariaAPI.getTimeUntilTarget(14);
    expect(result.hours).toBe(3);
    expect(result.minutes).toBe(30);
    expect(result.seconds).toBe(0);
  });
});

/* -------------------------------------------- */
/*  getTimeUntil convenience methods             */
/* -------------------------------------------- */

describe('getTimeUntil convenience methods', () => {
  it('getTimeUntilSunrise returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getTimeUntilSunrise()).toBeNull();
  });

  it('getTimeUntilSunrise uses calendar sunrise', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ sunrise: vi.fn(() => 6) });
    game.time.components = { hour: 4, minute: 0, second: 0 };
    const result = CalendariaAPI.getTimeUntilSunrise();
    expect(result.hours).toBe(2);
  });

  it('getTimeUntilSunset returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getTimeUntilSunset()).toBeNull();
  });

  it('getTimeUntilSunset uses calendar sunset', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ sunset: vi.fn(() => 18) });
    game.time.components = { hour: 16, minute: 0, second: 0 };
    const result = CalendariaAPI.getTimeUntilSunset();
    expect(result.hours).toBe(2);
  });

  it('getTimeUntilMidnight returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getTimeUntilMidnight()).toBeNull();
  });

  it('getTimeUntilMidnight targets hour 0', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({});
    game.time.components = { hour: 22, minute: 0, second: 0 };
    const result = CalendariaAPI.getTimeUntilMidnight();
    expect(result.hours).toBe(2);
  });

  it('getTimeUntilMidday returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getTimeUntilMidday()).toBeNull();
  });

  it('getTimeUntilMidday targets half of hoursPerDay', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ days: { hoursPerDay: 24 } });
    game.time.components = { hour: 10, minute: 0, second: 0 };
    const result = CalendariaAPI.getTimeUntilMidday();
    expect(result.hours).toBe(2);
  });
});

/* -------------------------------------------- */
/*  Weekday / Rest Day / Festival                */
/* -------------------------------------------- */

describe('weekday and festival', () => {
  it('getCurrentWeekday returns null when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.getCurrentWeekday()).toBeNull();
  });

  it('getCurrentWeekday returns null when getWeekdayForDate returns null', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ getWeekdayForDate: vi.fn(() => null) });
    expect(CalendariaAPI.getCurrentWeekday()).toBeNull();
  });

  it('getCurrentWeekday returns structured weekday data', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({
      getWeekdayForDate: vi.fn(() => ({ index: 2, name: 'Wednesday', abbreviation: 'Wed', isRestDay: false }))
    });
    const result = CalendariaAPI.getCurrentWeekday();
    expect(result).toEqual({ index: 2, name: 'Wednesday', abbreviation: 'Wed', isRestDay: false });
  });

  it('isRestDay returns false when no weekday', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.isRestDay()).toBe(false);
  });

  it('isRestDay returns true when weekday isRestDay is true', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({
      getWeekdayForDate: vi.fn(() => ({ index: 6, name: 'Sunday', abbreviation: 'Sun', isRestDay: true }))
    });
    expect(CalendariaAPI.isRestDay()).toBe(true);
  });

  it('getCurrentFestival delegates to CalendarManager', () => {
    const festival = { name: 'Midsummer', month: 5, day: 21 };
    CalendarManager.getCurrentFestival.mockReturnValue(festival);
    expect(CalendariaAPI.getCurrentFestival()).toBe(festival);
  });

  it('isFestivalDay returns false when no calendar', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.isFestivalDay()).toBe(false);
  });

  it('isFestivalDay delegates to calendar.isFestivalDay', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ isFestivalDay: vi.fn(() => true) });
    expect(CalendariaAPI.isFestivalDay()).toBe(true);
  });
});

/* -------------------------------------------- */
/*  formatDate                                   */
/* -------------------------------------------- */

describe('formatDate', () => {
  it('returns empty string when no calendar is active', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.formatDate()).toBe('');
  });

  it('uses preset formatter when preset name is given', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ years: { yearZero: 0 } });
    const result = CalendariaAPI.formatDate(null, 'dateLong');
    expect(PRESET_FORMATTERS.dateLong).toHaveBeenCalled();
    expect(result).toBe('1 January 1000');
  });

  it('uses formatCustom when a custom format string is given', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ years: { yearZero: 0 } });
    const result = CalendariaAPI.formatDate({ year: 5, month: 2, day: 10 }, '{YYYY}-{MM}-{DD}');
    expect(resolveFormatString).toHaveBeenCalledWith('{YYYY}-{MM}-{DD}');
    expect(formatCustom).toHaveBeenCalled();
    expect(result).toBe('formatted');
  });
});

/* -------------------------------------------- */
/*  timeSince / getFormatTokens / getFormatPresets */
/* -------------------------------------------- */

describe('formatting helpers', () => {
  it('timeSince defaults currentDate to game.time.components', () => {
    const target = { year: 0, month: 0, dayOfMonth: 0 };
    CalendariaAPI.timeSince(target);
    expect(timeSince).toHaveBeenCalledWith(target, game.time.components);
  });

  it('timeSince uses provided currentDate', () => {
    const target = { year: 0, month: 0, dayOfMonth: 0 };
    const current = { year: 1, month: 0, dayOfMonth: 0 };
    CalendariaAPI.timeSince(target, current);
    expect(timeSince).toHaveBeenCalledWith(target, current);
  });

  it('getFormatTokens delegates to getAvailableTokens', () => {
    const result = CalendariaAPI.getFormatTokens();
    expect(getAvailableTokens).toHaveBeenCalled();
    expect(result).toEqual([{ token: 'DD' }]);
  });

  it('getFormatPresets returns a copy of DEFAULT_FORMAT_PRESETS', () => {
    const result = CalendariaAPI.getFormatPresets();
    expect(result).toEqual({ dateLong: '{DD} {MMM} {YYYY}' });
  });
});

/* -------------------------------------------- */
/*  Notes                                        */
/* -------------------------------------------- */

describe('note operations', () => {
  it('getAllNotes delegates to NoteManager', () => {
    const notes = [{ id: '1' }];
    NoteManager.getAllNotes.mockReturnValue(notes);
    expect(CalendariaAPI.getAllNotes()).toBe(notes);
  });

  it('getNote delegates with pageId', () => {
    const note = { id: '1', name: 'Test' };
    NoteManager.getNote.mockReturnValue(note);
    expect(CalendariaAPI.getNote('1')).toBe(note);
    expect(NoteManager.getNote).toHaveBeenCalledWith('1');
  });

  it('deleteNote delegates with pageId', async () => {
    NoteManager.deleteNote.mockResolvedValue(true);
    const result = await CalendariaAPI.deleteNote('1');
    expect(result).toBe(true);
    expect(NoteManager.deleteNote).toHaveBeenCalledWith('1');
  });

  it('deleteAllNotes delegates to NoteManager', async () => {
    NoteManager.deleteAllNotes.mockResolvedValue(5);
    const result = await CalendariaAPI.deleteAllNotes();
    expect(result).toBe(5);
  });

  it('search delegates to SearchManager', () => {
    SearchManager.search.mockReturnValue([{ id: '1' }]);
    const result = CalendariaAPI.search('dragon', { limit: 10 });
    expect(SearchManager.search).toHaveBeenCalledWith('dragon', { limit: 10 });
    expect(result).toHaveLength(1);
  });

  it('getNotesForDate delegates to NoteManager', () => {
    NoteManager.getNotesForDate.mockReturnValue([{ id: '1' }]);
    CalendariaAPI.getNotesForDate(1000, 2, 15);
    expect(NoteManager.getNotesForDate).toHaveBeenCalledWith(1000, 2, 15);
  });

  it('getNotesForMonth calls getNotesInRange with month bounds', () => {
    CalendarManager.getActiveCalendar.mockReturnValue({
      years: { yearZero: 0 },
      getDaysInMonth: vi.fn(() => 31),
      monthsArray: [{ days: 31 }]
    });
    CalendariaAPI.getNotesForMonth(1000, 0);
    expect(NoteManager.getNotesInRange).toHaveBeenCalledWith({ year: 1000, month: 0, day: 1 }, { year: 1000, month: 0, day: 31 });
  });

  it('getNotesInRange delegates to NoteManager', () => {
    const start = { year: 1, month: 0, day: 1 };
    const end = { year: 1, month: 0, day: 30 };
    CalendariaAPI.getNotesInRange(start, end);
    expect(NoteManager.getNotesInRange).toHaveBeenCalledWith(start, end);
  });

  it('getNotesByCategory delegates to NoteManager', () => {
    CalendariaAPI.getNotesByCategory('quest');
    expect(NoteManager.getNotesByCategory).toHaveBeenCalledWith('quest');
  });

  it('getCategories delegates to NoteManager.getCategoryDefinitions', () => {
    const cats = [{ id: 'quest', label: 'Quest' }];
    NoteManager.getCategoryDefinitions.mockReturnValue(cats);
    expect(CalendariaAPI.getCategories()).toBe(cats);
  });

  it('getNoteDocument delegates to NoteManager.getFullNote', () => {
    const doc = { id: '1', name: 'Test' };
    NoteManager.getFullNote.mockReturnValue(doc);
    expect(CalendariaAPI.getNoteDocument('1')).toBe(doc);
    expect(NoteManager.getFullNote).toHaveBeenCalledWith('1');
  });
});

/* -------------------------------------------- */
/*  createNote                                   */
/* -------------------------------------------- */

describe('createNote', () => {
  it('returns null when permission denied', async () => {
    canAddNotes.mockReturnValue(false);
    const result = await CalendariaAPI.createNote({ name: 'Test', startDate: { year: 1, month: 0, day: 1 } });
    expect(result).toBeNull();
    expect(ui.notifications.error).toHaveBeenCalled();
  });

  it('creates note with defaults', async () => {
    canAddNotes.mockReturnValue(true);
    NoteManager.createNote.mockResolvedValue({ id: 'new' });
    const result = await CalendariaAPI.createNote({ name: 'Test', startDate: { year: 1, month: 0, day: 1 } });
    expect(result).toEqual({ id: 'new' });
    const call = NoteManager.createNote.mock.calls[0][0];
    expect(call.name).toBe('Test');
    expect(call.content).toBe('');
    expect(call.noteData.allDay).toBe(true);
    expect(call.noteData.repeat).toBe('never');
    expect(call.noteData.icon).toBe('fas fa-calendar-day');
    expect(call.noteData.color).toBe('#4a90e2');
    expect(call.noteData.gmOnly).toBe(false);
  });

  it('passes all custom options', async () => {
    canAddNotes.mockReturnValue(true);
    NoteManager.createNote.mockResolvedValue({});
    await CalendariaAPI.createNote({
      name: 'Event',
      content: '<p>Details</p>',
      startDate: { year: 1, month: 0, day: 1, hour: 10, minute: 30 },
      endDate: { year: 1, month: 0, day: 2, hour: 14, minute: 0 },
      allDay: false,
      repeat: 'weekly',
      categories: ['quest'],
      icon: 'fa-sword',
      color: '#ff0000',
      gmOnly: true
    });
    const call = NoteManager.createNote.mock.calls[0][0];
    expect(call.noteData.startDate.hour).toBe(10);
    expect(call.noteData.endDate.hour).toBe(14);
    expect(call.noteData.allDay).toBe(false);
    expect(call.noteData.repeat).toBe('weekly');
    expect(call.noteData.categories).toEqual(['quest']);
    expect(call.noteData.gmOnly).toBe(true);
  });
});

/* -------------------------------------------- */
/*  updateNote                                   */
/* -------------------------------------------- */

describe('updateNote', () => {
  it('returns null when permission denied', async () => {
    canEditNotes.mockReturnValue(false);
    const result = await CalendariaAPI.updateNote('1', { name: 'Updated' });
    expect(result).toBeNull();
    expect(ui.notifications.error).toHaveBeenCalled();
  });

  it('passes name and noteData to NoteManager', async () => {
    canEditNotes.mockReturnValue(true);
    NoteManager.updateNote.mockResolvedValue({ id: '1' });
    await CalendariaAPI.updateNote('1', { name: 'Updated', startDate: { year: 2 }, categories: ['quest'] });
    expect(NoteManager.updateNote).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        name: 'Updated',
        noteData: expect.objectContaining({ startDate: { year: 2 }, categories: ['quest'] })
      })
    );
  });

  it('passes undefined noteData when no note fields provided', async () => {
    canEditNotes.mockReturnValue(true);
    NoteManager.updateNote.mockResolvedValue({ id: '1' });
    await CalendariaAPI.updateNote('1', { name: 'Updated' });
    const call = NoteManager.updateNote.mock.calls[0][1];
    expect(call.noteData).toBeUndefined();
  });
});

/* -------------------------------------------- */
/*  openNote                                     */
/* -------------------------------------------- */

describe('openNote', () => {
  it('warns when note not found', async () => {
    NoteManager.getFullNote.mockReturnValue(null);
    await CalendariaAPI.openNote('missing');
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  it('renders note sheet with view mode by default', async () => {
    const render = vi.fn();
    NoteManager.getFullNote.mockReturnValue({ sheet: { render } });
    await CalendariaAPI.openNote('1');
    expect(render).toHaveBeenCalledWith(true, { mode: 'view' });
  });

  it('renders note sheet with edit mode when specified', async () => {
    const render = vi.fn();
    NoteManager.getFullNote.mockReturnValue({ sheet: { render } });
    await CalendariaAPI.openNote('1', { mode: 'edit' });
    expect(render).toHaveBeenCalledWith(true, { mode: 'edit' });
  });
});

/* -------------------------------------------- */
/*  searchNotes                                  */
/* -------------------------------------------- */

describe('searchNotes', () => {
  const notes = [
    { name: 'Dragon Attack', content: 'A red dragon appeared', flagData: { categories: ['quest'] } },
    { name: 'Festival of Stars', content: 'Annual celebration', flagData: { categories: ['holiday'] } },
    { name: 'Trade Route', content: 'New dragon trade route', flagData: { categories: ['quest'] } },
    { name: 'Secret Meeting', content: 'Only for GM eyes', flagData: { categories: [] } }
  ];

  beforeEach(() => {
    NoteManager.getAllNotes.mockReturnValue(notes);
  });

  it('matches by name (case-insensitive)', () => {
    const result = CalendariaAPI.searchNotes('festival');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Festival of Stars');
  });

  it('matches by content (case-insensitive)', () => {
    const result = CalendariaAPI.searchNotes('trade route');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Trade Route');
  });

  it('matches name and content across notes', () => {
    const result = CalendariaAPI.searchNotes('dragon');
    expect(result.some((n) => n.name === 'Dragon Attack')).toBe(true);
    expect(result.some((n) => n.name === 'Trade Route')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('filters by categories', () => {
    const result = CalendariaAPI.searchNotes('a', { categories: ['holiday'] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Festival of Stars');
  });

  it('returns empty when category does not match', () => {
    expect(CalendariaAPI.searchNotes('dragon', { categories: ['holiday'] })).toHaveLength(0);
  });

  it('supports case-sensitive search', () => {
    const result = CalendariaAPI.searchNotes('Dragon', { caseSensitive: true });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dragon Attack');
  });

  it('returns empty when no matches', () => {
    expect(CalendariaAPI.searchNotes('nonexistent')).toHaveLength(0);
  });

  it('returns empty when notes list is empty', () => {
    NoteManager.getAllNotes.mockReturnValue([]);
    expect(CalendariaAPI.searchNotes('anything')).toHaveLength(0);
  });
});

/* -------------------------------------------- */
/*  UI methods                                   */
/* -------------------------------------------- */

describe('UI methods', () => {
  it('openBigCal creates and renders a BigCal instance', async () => {
    const result = await CalendariaAPI.openBigCal();
    expect(result).toBeDefined();
  });

  it('openCalendarEditor returns null when permission denied', async () => {
    canEditCalendars.mockReturnValue(false);
    const result = await CalendariaAPI.openCalendarEditor('test');
    expect(result).toBeNull();
    expect(ui.notifications.error).toHaveBeenCalled();
  });

  it('openCalendarEditor creates and renders when permitted', async () => {
    canEditCalendars.mockReturnValue(true);
    const result = await CalendariaAPI.openCalendarEditor('test');
    expect(result).toBeDefined();
  });

  it('showMiniCal delegates to MiniCal.show', async () => {
    await CalendariaAPI.showMiniCal();
    expect(MiniCal.show).toHaveBeenCalled();
  });

  it('hideMiniCal delegates to MiniCal.hide', async () => {
    await CalendariaAPI.hideMiniCal();
    expect(MiniCal.hide).toHaveBeenCalled();
  });

  it('toggleMiniCal delegates to MiniCal.toggle', async () => {
    await CalendariaAPI.toggleMiniCal();
    expect(MiniCal.toggle).toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  timestampToDate / dateToTimestamp             */
/* -------------------------------------------- */

describe('timestampToDate', () => {
  it('returns null when no calendar is active', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.timestampToDate(1000)).toBeNull();
  });

  it('converts timestamp with yearZero adjustment', () => {
    const cal = {
      years: { yearZero: 1000 },
      timeToComponents: vi.fn(() => ({ year: 5, month: 2, dayOfMonth: 9, hour: 14, minute: 30 }))
    };
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    const result = CalendariaAPI.timestampToDate(86400);
    expect(cal.timeToComponents).toHaveBeenCalledWith(86400);
    expect(result.year).toBe(1005);
    expect(result.day).toBe(10);
  });
});

describe('dateToTimestamp', () => {
  it('returns 0 when no calendar is active', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    expect(CalendariaAPI.dateToTimestamp({ year: 1000, month: 0, day: 1 })).toBe(0);
  });

  it('calls componentsToTime with yearZero subtracted', () => {
    const cal = {
      years: { yearZero: 1000 },
      monthsArray: [{ days: 30 }, { days: 28 }],
      isLeapYear: vi.fn(() => false),
      componentsToTime: vi.fn(() => 999)
    };
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    const result = CalendariaAPI.dateToTimestamp({ year: 1005, month: 1, day: 15 });
    expect(cal.componentsToTime).toHaveBeenCalled();
    const args = cal.componentsToTime.mock.calls[0][0];
    expect(args.year).toBe(5);
    expect(result).toBe(999);
  });
});

/* -------------------------------------------- */
/*  chooseRandomDate                             */
/* -------------------------------------------- */

describe('chooseRandomDate', () => {
  it('generates a date between start and end timestamps', () => {
    const cal = {
      years: { yearZero: 0 },
      monthsArray: [{ days: 30 }],
      isLeapYear: vi.fn(() => false),
      componentsToTime: vi.fn((c) => c.year * 86400 * 365),
      timeToComponents: vi.fn(() => ({ year: 1, month: 5, dayOfMonth: 14, hour: 0, minute: 0 }))
    };
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    const result = CalendariaAPI.chooseRandomDate({ year: 1, month: 0, day: 1 }, { year: 2, month: 0, day: 1 });
    expect(result).toHaveProperty('year');
    expect(result).toHaveProperty('month');
    expect(result).toHaveProperty('day');
  });
});

/* -------------------------------------------- */
/*  isDaytime / isNighttime                      */
/* -------------------------------------------- */

describe('isDaytime / isNighttime', () => {
  it('returns true when between sunrise and sunset', () => {
    const cal = { sunrise: vi.fn(() => 6), sunset: vi.fn(() => 18) };
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    game.time.components = { hour: 12, minute: 0 };
    expect(CalendariaAPI.isDaytime()).toBe(true);
    expect(CalendariaAPI.isNighttime()).toBe(false);
  });

  it('returns false when before sunrise', () => {
    const cal = { sunrise: vi.fn(() => 6), sunset: vi.fn(() => 18) };
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    game.time.components = { hour: 4, minute: 0 };
    expect(CalendariaAPI.isDaytime()).toBe(false);
    expect(CalendariaAPI.isNighttime()).toBe(true);
  });

  it('returns false when after sunset', () => {
    const cal = { sunrise: vi.fn(() => 6), sunset: vi.fn(() => 18) };
    CalendarManager.getActiveCalendar.mockReturnValue(cal);
    game.time.components = { hour: 20, minute: 0 };
    expect(CalendariaAPI.isDaytime()).toBe(false);
    expect(CalendariaAPI.isNighttime()).toBe(true);
  });

  it('returns true (daytime) when sunrise/sunset are null', () => {
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    game.time.components = { hour: 12, minute: 0 };
    expect(CalendariaAPI.isDaytime()).toBe(true);
    expect(CalendariaAPI.isNighttime()).toBe(false);
  });
});

/* -------------------------------------------- */
/*  advanceTimeToPreset                          */
/* -------------------------------------------- */

describe('advanceTimeToPreset', () => {
  beforeEach(() => {
    canChangeDateTime.mockReturnValue(true);
    game.time.components = { hour: 10, minute: 0, second: 0 };
    game.time.advance.mockResolvedValue(99);
  });

  it('returns worldTime when permission denied', async () => {
    canChangeDateTime.mockReturnValue(false);
    game.time.worldTime = 42;
    const result = await CalendariaAPI.advanceTimeToPreset('sunrise');
    expect(result).toBe(42);
  });

  it('advances to sunrise', async () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ sunrise: vi.fn(() => 6) });
    game.time.components = { hour: 22, minute: 0, second: 0 };
    await CalendariaAPI.advanceTimeToPreset('sunrise');
    expect(game.time.advance).toHaveBeenCalled();
    const delta = game.time.advance.mock.calls[0][0];
    expect(delta).toBe(8 * 3600); // 22 -> 6 next day = 8 hours
  });

  it('advances to midday/noon', async () => {
    game.time.components = { hour: 10, minute: 0, second: 0 };
    await CalendariaAPI.advanceTimeToPreset('midday');
    const delta = game.time.advance.mock.calls[0][0];
    expect(delta).toBe(2 * 3600); // 10 -> 12 = 2 hours
  });

  it('accepts "noon" as alias for midday', async () => {
    game.time.components = { hour: 10, minute: 0, second: 0 };
    await CalendariaAPI.advanceTimeToPreset('noon');
    const delta = game.time.advance.mock.calls[0][0];
    expect(delta).toBe(2 * 3600);
  });

  it('advances to sunset', async () => {
    CalendarManager.getActiveCalendar.mockReturnValue({ sunset: vi.fn(() => 18) });
    game.time.components = { hour: 16, minute: 0, second: 0 };
    await CalendariaAPI.advanceTimeToPreset('sunset');
    const delta = game.time.advance.mock.calls[0][0];
    expect(delta).toBe(2 * 3600);
  });

  it('advances to midnight', async () => {
    game.time.components = { hour: 22, minute: 0, second: 0 };
    await CalendariaAPI.advanceTimeToPreset('midnight');
    const delta = game.time.advance.mock.calls[0][0];
    expect(delta).toBe(2 * 3600);
  });

  it('returns worldTime for unknown preset', async () => {
    game.time.worldTime = 42;
    const result = await CalendariaAPI.advanceTimeToPreset('dusk');
    expect(result).toBe(42);
  });

  it('emits socket for non-GM users', async () => {
    game.user.isGM = false;
    game.time.components = { hour: 10, minute: 0, second: 0 };
    game.time.worldTime = 50;
    await CalendariaAPI.advanceTimeToPreset('midday');
    expect(CalendariaSocket.emit).toHaveBeenCalledWith('timeRequest', expect.objectContaining({ action: 'advance' }));
  });
});

/* -------------------------------------------- */
/*  Clock                                        */
/* -------------------------------------------- */

describe('clock methods', () => {
  it('isClockRunning returns TimeClock.running', () => {
    TimeClock.running = false;
    expect(CalendariaAPI.isClockRunning()).toBe(false);
    TimeClock.running = true;
    expect(CalendariaAPI.isClockRunning()).toBe(true);
    TimeClock.running = false;
  });

  it('startClock delegates to TimeClock.start', () => {
    CalendariaAPI.startClock();
    expect(TimeClock.start).toHaveBeenCalled();
  });

  it('stopClock delegates to TimeClock.stop', () => {
    CalendariaAPI.stopClock();
    expect(TimeClock.stop).toHaveBeenCalled();
  });

  it('toggleClock delegates to TimeClock.toggle', () => {
    CalendariaAPI.toggleClock();
    expect(TimeClock.toggle).toHaveBeenCalled();
  });

  it('getClockSpeed returns TimeClock.realTimeSpeed', () => {
    TimeClock.realTimeSpeed = 5;
    expect(CalendariaAPI.getClockSpeed()).toBe(5);
    TimeClock.realTimeSpeed = 1;
  });
});

/* -------------------------------------------- */
/*  Permission checks                            */
/* -------------------------------------------- */

describe('permission checks', () => {
  it('canModifyTime delegates to canChangeDateTime', () => {
    canChangeDateTime.mockReturnValue(false);
    expect(CalendariaAPI.canModifyTime()).toBe(false);
    canChangeDateTime.mockReturnValue(true);
    expect(CalendariaAPI.canModifyTime()).toBe(true);
  });

  it('canManageNotes delegates to canAddNotes', () => {
    canAddNotes.mockReturnValue(false);
    expect(CalendariaAPI.canManageNotes()).toBe(false);
    canAddNotes.mockReturnValue(true);
    expect(CalendariaAPI.canManageNotes()).toBe(true);
  });

  it('isPrimaryGM delegates to CalendariaSocket.isPrimaryGM', () => {
    CalendariaSocket.isPrimaryGM.mockReturnValue(false);
    expect(CalendariaAPI.isPrimaryGM()).toBe(false);
    CalendariaSocket.isPrimaryGM.mockReturnValue(true);
    expect(CalendariaAPI.isPrimaryGM()).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Weather                                      */
/* -------------------------------------------- */

describe('weather methods', () => {
  it('getCurrentWeather delegates with zoneId', () => {
    const weather = { id: 'clear' };
    WeatherManager.getCurrentWeather.mockReturnValue(weather);
    expect(CalendariaAPI.getCurrentWeather('zone-1')).toBe(weather);
    expect(WeatherManager.getCurrentWeather).toHaveBeenCalledWith('zone-1');
  });

  it('setWeather delegates to WeatherManager', async () => {
    WeatherManager.setWeather.mockResolvedValue({ id: 'rain' });
    const result = await CalendariaAPI.setWeather('rain', { temperature: 15 });
    expect(WeatherManager.setWeather).toHaveBeenCalledWith('rain', { temperature: 15 });
    expect(result).toEqual({ id: 'rain' });
  });

  it('setCustomWeather delegates to WeatherManager', async () => {
    const data = { label: 'Custom Storm' };
    WeatherManager.setCustomWeather.mockResolvedValue(data);
    const result = await CalendariaAPI.setCustomWeather(data);
    expect(WeatherManager.setCustomWeather).toHaveBeenCalledWith(data);
    expect(result).toBe(data);
  });

  it('clearWeather delegates to WeatherManager', async () => {
    await CalendariaAPI.clearWeather();
    expect(WeatherManager.clearWeather).toHaveBeenCalled();
  });

  it('generateWeather delegates to WeatherManager.generateAndSetWeather', async () => {
    const opts = { climate: 'desert' };
    WeatherManager.generateAndSetWeather.mockResolvedValue({ id: 'hot' });
    const result = await CalendariaAPI.generateWeather(opts);
    expect(WeatherManager.generateAndSetWeather).toHaveBeenCalledWith(opts);
    expect(result).toEqual({ id: 'hot' });
  });

  it('getWeatherForecast returns empty when non-GM lacks permission', () => {
    game.user.isGM = false;
    canViewWeatherForecast.mockReturnValue(false);
    const result = CalendariaAPI.getWeatherForecast();
    expect(result).toEqual([]);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  it('getWeatherForecast delegates for GM with accuracy override', () => {
    game.user.isGM = true;
    WeatherManager.getForecast.mockReturnValue([{ day: 1 }]);
    const result = CalendariaAPI.getWeatherForecast({ days: 3, accuracy: 80 });
    expect(WeatherManager.getForecast).toHaveBeenCalledWith({ days: 3, accuracy: 80 });
    expect(result).toEqual([{ day: 1 }]);
  });

  it('getWeatherForecast defaults GM accuracy to 100', () => {
    game.user.isGM = true;
    CalendariaAPI.getWeatherForecast({ days: 3 });
    expect(WeatherManager.getForecast).toHaveBeenCalledWith({ days: 3, accuracy: 100 });
  });

  it('getWeatherForecast omits accuracy for non-GM with permission', () => {
    game.user.isGM = false;
    canViewWeatherForecast.mockReturnValue(true);
    CalendariaAPI.getWeatherForecast({ days: 3 });
    expect(WeatherManager.getForecast).toHaveBeenCalledWith({ days: 3, accuracy: undefined });
  });

  it('getWeatherForDate delegates to WeatherManager', () => {
    CalendariaAPI.getWeatherForDate(1000, 2, 15, 'zone-1');
    expect(WeatherManager.getWeatherForDate).toHaveBeenCalledWith(1000, 2, 15, 'zone-1');
  });

  it('getWeatherHistory delegates to WeatherManager', () => {
    CalendariaAPI.getWeatherHistory({ year: 1000, month: 2 });
    expect(WeatherManager.getWeatherHistory).toHaveBeenCalledWith({ year: 1000, month: 2 });
  });

  it('getActiveZone delegates to WeatherManager', () => {
    CalendariaAPI.getActiveZone();
    expect(WeatherManager.getActiveZone).toHaveBeenCalled();
  });

  it('setActiveZone delegates to WeatherManager', async () => {
    await CalendariaAPI.setActiveZone('desert');
    expect(WeatherManager.setActiveZone).toHaveBeenCalledWith('desert');
  });

  it('getWeatherPresets delegates to WeatherManager.getAllPresets', async () => {
    const presets = [{ id: 'clear' }];
    WeatherManager.getAllPresets.mockResolvedValue(presets);
    const result = await CalendariaAPI.getWeatherPresets();
    expect(result).toBe(presets);
  });

  it('getCalendarZones delegates to WeatherManager', () => {
    CalendariaAPI.getCalendarZones();
    expect(WeatherManager.getCalendarZones).toHaveBeenCalled();
  });

  it('addWeatherPreset delegates to WeatherManager.addCustomPreset', async () => {
    const preset = { id: 'my-preset', label: 'My Preset' };
    WeatherManager.addCustomPreset.mockResolvedValue(preset);
    const result = await CalendariaAPI.addWeatherPreset(preset);
    expect(WeatherManager.addCustomPreset).toHaveBeenCalledWith(preset);
    expect(result).toBe(preset);
  });

  it('removeWeatherPreset delegates to WeatherManager.removeCustomPreset', async () => {
    WeatherManager.removeCustomPreset.mockResolvedValue(true);
    const result = await CalendariaAPI.removeWeatherPreset('my-preset');
    expect(WeatherManager.removeCustomPreset).toHaveBeenCalledWith('my-preset');
    expect(result).toBe(true);
  });

  it('updateWeatherPreset delegates to WeatherManager.updateCustomPreset', async () => {
    WeatherManager.updateCustomPreset.mockResolvedValue({ id: 'x' });
    const result = await CalendariaAPI.updateWeatherPreset('x', { label: 'New' });
    expect(WeatherManager.updateCustomPreset).toHaveBeenCalledWith('x', { label: 'New' });
    expect(result).toEqual({ id: 'x' });
  });

  it('getTemperature delegates to WeatherManager', () => {
    CalendariaAPI.getTemperature('zone-1');
    expect(WeatherManager.getTemperature).toHaveBeenCalledWith('zone-1');
  });

  it('getPreset delegates to WeatherManager', () => {
    CalendariaAPI.getPreset('rain');
    expect(WeatherManager.getPreset).toHaveBeenCalledWith('rain');
  });

  it('formatTemperature delegates to WeatherManager', () => {
    WeatherManager.formatTemperature.mockReturnValue('72°F');
    expect(CalendariaAPI.formatTemperature(22)).toBe('72°F');
    expect(WeatherManager.formatTemperature).toHaveBeenCalledWith(22);
  });

  it('getClimateZoneTemplates delegates to WeatherManager', () => {
    const templates = [{ id: 'temperate' }];
    WeatherManager.getClimateZoneTemplates.mockReturnValue(templates);
    expect(CalendariaAPI.getClimateZoneTemplates()).toBe(templates);
  });
});

/* -------------------------------------------- */
/*  Diagnostic / Bundled                         */
/* -------------------------------------------- */

describe('diagnostic methods', () => {
  it('isBundledCalendar delegates to CalendarManager', () => {
    CalendarManager.isBundledCalendar.mockReturnValue(true);
    expect(CalendariaAPI.isBundledCalendar('gregorian')).toBe(true);
    expect(CalendarManager.isBundledCalendar).toHaveBeenCalledWith('gregorian');
  });

  it('diagnoseWeather delegates to diagnoseWeatherConfig', async () => {
    const result = await CalendariaAPI.diagnoseWeather(false);
    expect(diagnoseWeatherConfig).toHaveBeenCalledWith(false);
    expect(result).toEqual({ ok: true });
  });

  it('diagnoseWeather defaults showDialog to true', async () => {
    await CalendariaAPI.diagnoseWeather();
    expect(diagnoseWeatherConfig).toHaveBeenCalledWith(true);
  });
});

/* -------------------------------------------- */
/*  Getters: hooks, widgetPoints, replaceableElements */
/* -------------------------------------------- */

describe('getters', () => {
  it('hooks returns a copy of HOOKS constants', () => {
    const hooks = CalendariaAPI.hooks;
    expect(hooks.DATE_TIME_CHANGE).toBe('calendaria.dateTimeChange');
    expect(hooks.DAY_CHANGE).toBe('calendaria.dayChange');
  });

  it('widgetPoints returns a copy of WIDGET_POINTS', () => {
    const wp = CalendariaAPI.widgetPoints;
    expect(wp.HUD_TOP).toBe('hud-top');
  });

  it('replaceableElements returns a copy of REPLACEABLE_ELEMENTS', () => {
    const re = CalendariaAPI.replaceableElements;
    expect(re.CLOCK).toBe('clock');
  });
});

/* -------------------------------------------- */
/*  Date arithmetic delegations                  */
/* -------------------------------------------- */

describe('date arithmetic delegations', () => {
  const d1 = { year: 1, month: 0, day: 1 };
  const d2 = { year: 1, month: 0, day: 10 };

  it('addDays delegates to date-utils', () => {
    CalendariaAPI.addDays(d1, 5);
    expect(addDays).toHaveBeenCalledWith(d1, 5);
  });

  it('addMonths delegates to date-utils', () => {
    CalendariaAPI.addMonths(d1, 3);
    expect(addMonths).toHaveBeenCalledWith(d1, 3);
  });

  it('addYears delegates to date-utils', () => {
    CalendariaAPI.addYears(d1, 2);
    expect(addYears).toHaveBeenCalledWith(d1, 2);
  });

  it('daysBetween delegates to date-utils', () => {
    CalendariaAPI.daysBetween(d1, d2);
    expect(daysBetween).toHaveBeenCalledWith(d1, d2);
  });

  it('monthsBetween delegates to date-utils', () => {
    CalendariaAPI.monthsBetween(d1, d2);
    expect(monthsBetween).toHaveBeenCalledWith(d1, d2);
  });

  it('compareDates delegates to date-utils', () => {
    CalendariaAPI.compareDates(d1, d2);
    expect(compareDates).toHaveBeenCalledWith(d1, d2);
  });

  it('compareDays delegates to date-utils', () => {
    CalendariaAPI.compareDays(d1, d2);
    expect(compareDays).toHaveBeenCalledWith(d1, d2);
  });

  it('isSameDay delegates to date-utils', () => {
    CalendariaAPI.isSameDay(d1, d2);
    expect(isSameDay).toHaveBeenCalledWith(d1, d2);
  });

  it('dayOfWeek delegates to date-utils', () => {
    CalendariaAPI.dayOfWeek(d1);
    expect(dayOfWeek).toHaveBeenCalledWith(d1);
  });

  it('isValidDate delegates to date-utils', () => {
    CalendariaAPI.isValidDate(d1);
    expect(isValidDate).toHaveBeenCalledWith(d1);
  });
});

/* -------------------------------------------- */
/*  Widget methods                               */
/* -------------------------------------------- */

describe('widget methods', () => {
  it('registerWidget delegates to WidgetManager', () => {
    const config = { id: 'test', type: 'button' };
    CalendariaAPI.registerWidget('my-module', config);
    expect(registerWidget).toHaveBeenCalledWith('my-module', config);
  });

  it('getRegisteredWidgets delegates with optional insertPoint', () => {
    CalendariaAPI.getRegisteredWidgets('hud-top');
    expect(getRegisteredWidgets).toHaveBeenCalledWith('hud-top');
  });

  it('getRegisteredWidgets delegates without insertPoint', () => {
    CalendariaAPI.getRegisteredWidgets();
    expect(getRegisteredWidgets).toHaveBeenCalledWith(undefined);
  });

  it('getWidgetByReplacement delegates to WidgetManager', () => {
    CalendariaAPI.getWidgetByReplacement('clock');
    expect(getWidgetByReplacement).toHaveBeenCalledWith('clock');
  });

  it('refreshWidgets delegates to WidgetManager', () => {
    CalendariaAPI.refreshWidgets();
    expect(refreshWidgets).toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  createGlobalNamespace                        */
/* -------------------------------------------- */

describe('createGlobalNamespace', () => {
  it('installs CALENDARIA global with api reference', () => {
    createGlobalNamespace();
    expect(globalThis.CALENDARIA).toBeDefined();
    expect(globalThis.CALENDARIA.api).toBe(CalendariaAPI);
  });

  it('exposes apps, managers, models, socket, permissions', () => {
    createGlobalNamespace();
    const ns = globalThis.CALENDARIA;
    expect(ns.apps).toBeDefined();
    expect(ns.managers).toBeDefined();
    expect(ns.models).toBeDefined();
    expect(ns.socket).toBeDefined();
    expect(ns.permissions).toBeDefined();
  });

  it('proxies deprecated top-level keys with compatibility warning', () => {
    createGlobalNamespace();
    foundry.utils.logCompatibilityWarning = vi.fn();
    void globalThis.CALENDARIA.CalendarManager;
    expect(foundry.utils.logCompatibilityWarning).toHaveBeenCalledWith(expect.stringContaining('CALENDARIA.CalendarManager is deprecated'), expect.any(Object));
  });

  it('returns correct value for deprecated key', () => {
    createGlobalNamespace();
    foundry.utils.logCompatibilityWarning = vi.fn();
    expect(globalThis.CALENDARIA.CalendarManager).toBe(globalThis.CALENDARIA.managers.CalendarManager);
  });

  it('does not trigger deprecation for non-deprecated keys', () => {
    createGlobalNamespace();
    foundry.utils.logCompatibilityWarning = vi.fn();
    void globalThis.CALENDARIA.api;
    expect(foundry.utils.logCompatibilityWarning).not.toHaveBeenCalled();
  });
});
