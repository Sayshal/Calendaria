/**
 * Tests for settings-io.mjs
 * Covers: exportSettings, importSettings — dialog flows, file I/O, calendar ID generation.
 * @module Tests/SettingsIO
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: vi.fn((key) => key),
  format: vi.fn((key, _data) => key)
}));
vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  SETTINGS: {
    ACTIVE_CALENDAR: 'activeCalendar',
    ADVANCE_TIME_ON_REST: 'advanceTimeOnRest',
    ALLOW_SIDEBAR_OVERLAP: 'allowSidebarOverlap',
    AMBIENCE_SYNC: 'ambienceSync',
    BIG_CAL_CYCLES_DISPLAY_MODE: 'bigCalCyclesDisplayMode',
    BIG_CAL_ERA_DISPLAY_MODE: 'bigCalEraDisplayMode',
    BIG_CAL_SEASON_DISPLAY_MODE: 'bigCalSeasonDisplayMode',
    BIG_CAL_SHOW_CYCLES: 'bigCalShowCycles',
    BIG_CAL_SHOW_ERA: 'bigCalShowEra',
    BIG_CAL_SHOW_MOON_PHASES: 'bigCalShowMoonPhases',
    BIG_CAL_SHOW_SEASON: 'bigCalShowSeason',
    BIG_CAL_SHOW_WEATHER: 'bigCalShowWeather',
    BIG_CAL_WEATHER_DISPLAY_MODE: 'bigCalWeatherDisplayMode',
    CALENDAR_HUD_MODE: 'calendarHudMode',
    CALENDARS: 'calendars',
    CHAT_TIMESTAMP_MODE: 'chatTimestampMode',
    CHAT_TIMESTAMP_SHOW_TIME: 'chatTimestampShowTime',
    CURRENT_WEATHER: 'currentWeather',
    CUSTOM_CALENDARS: 'customCalendars',
    CUSTOM_CATEGORIES: 'customCategories',
    CUSTOM_THEME_COLORS: 'customThemeColors',
    CUSTOM_TIME_JUMPS: 'customTimeJumps',
    CUSTOM_WEATHER_PRESETS: 'customWeatherPresets',
    DARKNESS_SYNC: 'darknessSync',
    DARKNESS_WEATHER_SYNC: 'darknessWeatherSync',
    DEFAULT_BRIGHTNESS_MULTIPLIER: 'defaultBrightnessMultiplier',
    DEFAULT_OVERRIDES: 'defaultOverrides',
    DISPLAY_FORMATS: 'displayFormats',
    FORCE_HUD: 'forceHud',
    FORCE_MINI_CAL: 'forceMiniCal',
    HUD_AUTO_FADE: 'hudAutoFade',
    HUD_COMBAT_COMPACT: 'hudCombatCompact',
    HUD_COMBAT_HIDE: 'hudCombatHide',
    HUD_CYCLES_DISPLAY_MODE: 'hudCyclesDisplayMode',
    HUD_DIAL_STYLE: 'hudDialStyle',
    HUD_DOME_AUTO_HIDE: 'hudDomeAutoHide',
    HUD_DOME_BELOW: 'hudDomeBelow',
    HUD_ERA_DISPLAY_MODE: 'hudEraDisplayMode',
    HUD_IDLE_OPACITY: 'hudIdleOpacity',
    HUD_SEASON_DISPLAY_MODE: 'hudSeasonDisplayMode',
    HUD_SHOW_CYCLES: 'hudShowCycles',
    HUD_SHOW_ERA: 'hudShowEra',
    HUD_SHOW_SEASON: 'hudShowSeason',
    HUD_SHOW_WEATHER: 'hudShowWeather',
    HUD_STICKY_STATES: 'hudStickyStates',
    HUD_STICKY_ZONES_ENABLED: 'hudStickyZonesEnabled',
    HUD_TRAY_DIRECTION: 'hudTrayDirection',
    HUD_WEATHER_DISPLAY_MODE: 'hudWeatherDisplayMode',
    HUD_WIDTH_SCALE: 'hudWidthScale',
    MACRO_TRIGGERS: 'macroTriggers',
    MINI_CAL_AUTO_FADE: 'miniCalAutoFade',
    MINI_CAL_CONFIRM_SET_DATE: 'miniCalConfirmSetDate',
    MINI_CAL_CONTROLS_DELAY: 'miniCalControlsDelay',
    MINI_CAL_CYCLES_DISPLAY_MODE: 'miniCalCyclesDisplayMode',
    MINI_CAL_ERA_DISPLAY_MODE: 'miniCalEraDisplayMode',
    MINI_CAL_IDLE_OPACITY: 'miniCalIdleOpacity',
    MINI_CAL_SEASON_DISPLAY_MODE: 'miniCalSeasonDisplayMode',
    MINI_CAL_SHOW_CYCLES: 'miniCalShowCycles',
    MINI_CAL_SHOW_ERA: 'miniCalShowEra',
    MINI_CAL_SHOW_MOON_PHASES: 'miniCalShowMoonPhases',
    MINI_CAL_SHOW_SEASON: 'miniCalShowSeason',
    MINI_CAL_SHOW_WEATHER: 'miniCalShowWeather',
    MINI_CAL_STICKY_STATES: 'miniCalStickyStates',
    MINI_CAL_TIME_JUMPS: 'miniCalTimeJumps',
    MINI_CAL_WEATHER_DISPLAY_MODE: 'miniCalWeatherDisplayMode',
    PERMISSIONS: 'permissions',
    PRIMARY_GM: 'primaryGM',
    SAVED_TIMEPOINTS: 'savedTimepoints',
    SHOW_ACTIVE_CALENDAR_TO_PLAYERS: 'showActiveCalendarToPlayers',
    SHOW_CALENDAR_HUD: 'showCalendarHud',
    SHOW_MINI_CAL: 'showMiniCal',
    SHOW_TIME_KEEPER: 'showTimeKeeper',
    SHOW_JOURNAL_FOOTER: 'showJournalFooter',
    SHOW_TOOLBAR_BUTTON: 'showToolbarButton',
    STOPWATCH_AUTO_START_TIME: 'stopwatchAutoStartTime',
    STOPWATCH_STICKY_STATES: 'stopwatchStickyStates',
    SYNC_CLOCK_PAUSE: 'syncClockPause',
    TEMPERATURE_UNIT: 'temperatureUnit',
    THEME_MODE: 'themeMode',
    TIME_SPEED_INCREMENT: 'timeSpeedIncrement',
    TIME_SPEED_MULTIPLIER: 'timeSpeedMultiplier',
    TIMEKEEPER_AUTO_FADE: 'timekeeperAutoFade',
    TIMEKEEPER_IDLE_OPACITY: 'timekeeperIdleOpacity',
    TIMEKEEPER_STICKY_STATES: 'timekeeperStickyStates',
    TIMEKEEPER_TIME_JUMPS: 'timekeeperTimeJumps',
    TOOLBAR_APPS: 'toolbarApps',
    AUTO_GENERATE_WEATHER: 'autoGenerateWeather',
    COLOR_SHIFT_SYNC: 'colorShiftSync',
    DARKNESS_MOON_SYNC: 'darknessMoonSync',
    DARKNESS_SYNC_ALL_SCENES: 'darknessSyncAllScenes'
  }
}));
vi.mock('../../scripts/calendar/calendar-manager.mjs', () => ({
  default: {
    getActiveCalendar: vi.fn(() => null),
    getCurrentDateTime: vi.fn(() => ({ year: 0, month: 0, day: 0 })),
    createCustomCalendar: vi.fn(async () => ({})),
    switchCalendar: vi.fn(async () => true)
  }
}));

import { exportSettings, importSettings } from '../../scripts/utils/settings-io.mjs';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';

/* -------------------------------------------- */
/*  Helper                                       */
/* -------------------------------------------- */

/**
 * Build a mock input element for importSettings file picker.
 * @returns {object} Mock input element
 */
function createMockInput() {
  const input = {
    type: '',
    accept: '',
    addEventListener: vi.fn(),
    click: vi.fn()
  };
  document.createElement.mockReturnValue(input);
  return input;
}

/**
 * Trigger the 'change' handler registered on the mock input.
 * @param {object} mockInput - Mock input element from createMockInput
 * @param {object} file - Mock file object
 */
async function triggerFileChange(mockInput, file) {
  const changeCall = mockInput.addEventListener.mock.calls.find((c) => c[0] === 'change');
  if (changeCall) await changeCall[1]({ target: { files: [file] } });
}

/* -------------------------------------------- */
/*  exportSettings                               */
/* -------------------------------------------- */

describe('exportSettings()', () => {
  beforeEach(() => {
    game.settings.get.mockReturnValue('mock-value');
    game.modules.get.mockReturnValue({ version: '1.0.0' });
  });

  it('returns early when dialog is cancelled', async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    await exportSettings();
    expect(foundry.utils.saveDataToFile).not.toHaveBeenCalled();
  });

  it('exports settings to file when dialog confirmed', async () => {
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ render }) => {
      if (render) render(null, { element: { querySelector: vi.fn(() => null) } });
      return 'export';
    });

    await exportSettings();

    expect(foundry.utils.saveDataToFile).toHaveBeenCalledTimes(1);
    const [jsonStr, mimeType] = foundry.utils.saveDataToFile.mock.calls[0];
    expect(mimeType).toBe('application/json');
    const data = JSON.parse(jsonStr);
    expect(data).toHaveProperty('version', '1.0.0');
    expect(data).toHaveProperty('settings');
    expect(data).toHaveProperty('exportedAt');
    expect(Object.keys(data.settings).length).toBeGreaterThan(0);
    expect(ui.notifications.info).toHaveBeenCalled();
  });

  it('includes calendar data when checkbox checked and calendar exists', async () => {
    CalendarManager.getActiveCalendar.mockReturnValue({
      name: 'Test Calendar',
      yearZero: 0,
      toObject: () => ({ name: 'Test Calendar', months: [] })
    });
    CalendarManager.getCurrentDateTime.mockReturnValue({ year: 5, month: 2, day: 10 });

    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ render }) => {
      if (render) render(null, { element: { querySelector: vi.fn(() => ({ checked: true })) } });
      return 'export';
    });

    await exportSettings();

    const data = JSON.parse(foundry.utils.saveDataToFile.mock.calls[0][0]);
    expect(data).toHaveProperty('calendarData');
    expect(data.calendarData.name).toBe('Test Calendar');
    expect(data.calendarData.currentDate).toEqual({ year: 5, month: 2, day: 10 });
  });

  it('skips CALENDAR_DATA_SETTINGS keys when including calendar data', async () => {
    CalendarManager.getActiveCalendar.mockReturnValue({
      name: 'Test Calendar',
      yearZero: 0,
      toObject: () => ({ name: 'Test Calendar' })
    });
    CalendarManager.getCurrentDateTime.mockReturnValue({ year: 1, month: 0, day: 0 });

    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ render }) => {
      if (render) render(null, { element: { querySelector: vi.fn(() => ({ checked: true })) } });
      return 'export';
    });

    await exportSettings();

    const data = JSON.parse(foundry.utils.saveDataToFile.mock.calls[0][0]);
    expect(data.settings).not.toHaveProperty('calendars');
    expect(data.settings).not.toHaveProperty('customCalendars');
    expect(data.settings).not.toHaveProperty('defaultOverrides');
  });
});

/* -------------------------------------------- */
/*  importSettings                               */
/* -------------------------------------------- */

describe('importSettings()', () => {
  beforeEach(() => {
    game.settings.set.mockResolvedValue(true);
  });

  it('creates a file input and clicks it', async () => {
    const mockInput = createMockInput();
    await importSettings();
    expect(document.createElement).toHaveBeenCalledWith('input');
    expect(mockInput.type).toBe('file');
    expect(mockInput.accept).toBe('.json');
    expect(mockInput.click).toHaveBeenCalled();
  });

  it('does nothing when no file is selected', async () => {
    const mockInput = createMockInput();
    await importSettings();

    const changeCall = mockInput.addEventListener.mock.calls.find((c) => c[0] === 'change');
    await changeCall[1]({ target: { files: [] } });

    expect(game.settings.set).not.toHaveBeenCalled();
  });

  it('shows error for invalid file format', async () => {
    const mockInput = createMockInput();
    foundry.utils.readTextFromFile.mockResolvedValue(JSON.stringify({ noSettings: true }));
    await importSettings();
    await triggerFileChange(mockInput, { name: 'bad.json' });

    expect(ui.notifications.error).toHaveBeenCalled();
  });

  it('imports settings from valid file when dialog confirmed', async () => {
    const mockInput = createMockInput();
    const importData = {
      version: '1.0.0',
      settings: { activeCalendar: 'gregorian', themeMode: 'dark' }
    };
    foundry.utils.readTextFromFile.mockResolvedValue(JSON.stringify(importData));
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ render }) => {
      if (render) render(null, { element: { querySelector: vi.fn(() => null) } });
      return 'import';
    });

    const onComplete = vi.fn();
    await importSettings(onComplete);
    await triggerFileChange(mockInput, { name: 'settings.json' });

    expect(game.settings.set).toHaveBeenCalledWith('calendaria', 'activeCalendar', 'gregorian');
    expect(game.settings.set).toHaveBeenCalledWith('calendaria', 'themeMode', 'dark');
    expect(onComplete).toHaveBeenCalled();
  });

  it('skips settings not in EXPORTABLE_SETTINGS list', async () => {
    const mockInput = createMockInput();
    const importData = {
      version: '1.0.0',
      settings: { themeMode: 'dark', bogusKey: 'ignored' }
    };
    foundry.utils.readTextFromFile.mockResolvedValue(JSON.stringify(importData));
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ render }) => {
      if (render) render(null, { element: { querySelector: vi.fn(() => null) } });
      return 'import';
    });

    await importSettings();
    await triggerFileChange(mockInput, { name: 'settings.json' });

    expect(game.settings.set).toHaveBeenCalledWith('calendaria', 'themeMode', 'dark');
    expect(game.settings.set).not.toHaveBeenCalledWith('calendaria', 'bogusKey', expect.anything());
  });

  it('imports calendar data when present and selected', async () => {
    const mockInput = createMockInput();
    const importData = {
      version: '1.0.0',
      settings: {},
      calendarData: { name: 'My Custom Calendar' }
    };
    foundry.utils.readTextFromFile.mockResolvedValue(JSON.stringify(importData));
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ render }) => {
      if (render) {
        render(null, {
          element: {
            querySelector: vi.fn((selector) => {
              if (selector === 'input[name="importCalendar"]') return { checked: true };
              if (selector === 'input[name="setActive"]') return { checked: true };
              return null;
            })
          }
        });
      }
      return 'import';
    });

    await importSettings();
    await triggerFileChange(mockInput, { name: 'settings.json' });

    expect(CalendarManager.createCustomCalendar).toHaveBeenCalledWith('my-custom-calendar', importData.calendarData);
    expect(CalendarManager.switchCalendar).toHaveBeenCalledWith('custom-my-custom-calendar');
  });

  it('generates valid calendar ID from name', async () => {
    const mockInput = createMockInput();
    const importData = {
      version: '1.0.0',
      settings: {},
      calendarData: { name: '  !!My SpeciaL Calendar!! 2024  ' }
    };
    foundry.utils.readTextFromFile.mockResolvedValue(JSON.stringify(importData));
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ render }) => {
      if (render) {
        render(null, {
          element: {
            querySelector: vi.fn((selector) => {
              if (selector === 'input[name="importCalendar"]') return { checked: true };
              if (selector === 'input[name="setActive"]') return { checked: false };
              return null;
            })
          }
        });
      }
      return 'import';
    });

    await importSettings();
    await triggerFileChange(mockInput, { name: 'settings.json' });

    // Expected: lowercase, non-alphanumeric replaced with -, leading/trailing dashes stripped, max 32 chars
    expect(CalendarManager.createCustomCalendar).toHaveBeenCalledWith('my-special-calendar-2024', importData.calendarData);
  });

  it('does not switch calendar when setActive is unchecked', async () => {
    const mockInput = createMockInput();
    const importData = {
      version: '1.0.0',
      settings: {},
      calendarData: { name: 'Test' }
    };
    foundry.utils.readTextFromFile.mockResolvedValue(JSON.stringify(importData));
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ render }) => {
      if (render) {
        render(null, {
          element: {
            querySelector: vi.fn((selector) => {
              if (selector === 'input[name="importCalendar"]') return { checked: true };
              if (selector === 'input[name="setActive"]') return { checked: false };
              return null;
            })
          }
        });
      }
      return 'import';
    });

    await importSettings();
    await triggerFileChange(mockInput, { name: 'settings.json' });

    expect(CalendarManager.createCustomCalendar).toHaveBeenCalled();
    expect(CalendarManager.switchCalendar).not.toHaveBeenCalled();
  });
});
