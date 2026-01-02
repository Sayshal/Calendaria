/**
 * Core module constants for Calendaria.
 * @module Constants
 * @author Tyler
 */

/** Module identification */
export const MODULE = {
  ID: 'calendaria',
  TITLE: 'Calendaria',
  LOG_LEVEL: 0
};

/** @enum {string} Settings keys for Foundry VTT game settings */
export const SETTINGS = {
  LOGGING_LEVEL: 'loggingLevel',
  CALENDAR_POSITION: 'calendarPosition',
  DARKNESS_SYNC: 'darknessSync',
  CALENDARS: 'calendars',
  ACTIVE_CALENDAR: 'activeCalendar',
  PRIMARY_GM: 'primaryGM',
  CUSTOM_CALENDARS: 'customCalendars',
  DEFAULT_OVERRIDES: 'defaultOverrides',
  POSITION_LOCKED: 'positionLocked',
  CUSTOM_CATEGORIES: 'customCategories',
  SHOW_MOON_PHASES: 'showMoonPhases',
  ADVANCE_TIME_ON_REST: 'advanceTimeOnRest',
  CUSTOM_THEME_COLORS: 'customThemeColors',
  THEME_MODE: 'themeMode',
  SHOW_TIME_KEEPER: 'showTimeKeeper',
  TIME_KEEPER_POSITION: 'timeKeeperPosition',
  SHOW_MINI_CALENDAR: 'showMiniCalendar',
  ADVANCE_TIME_ON_COMBAT: 'advanceTimeOnCombat',
  SYNC_CLOCK_PAUSE: 'syncClockPause',
  MINI_CALENDAR_POSITION: 'miniCalendarPosition',
  MINI_CALENDAR_CONTROLS_DELAY: 'miniCalendarControlsDelay',
  MINI_CALENDAR_STICKY_STATES: 'miniCalendarStickyStates',
  DEV_MODE: 'devMode',
  CURRENT_WEATHER: 'currentWeather',
  CUSTOM_WEATHER_PRESETS: 'customWeatherPresets',
  TEMPERATURE_UNIT: 'temperatureUnit',
  MACRO_TRIGGERS: 'macroTriggers',
  SHOW_CALENDAR_HUD: 'showCalendarHUD',
  CALENDAR_HUD_MODE: 'calendarHUDMode',
  CALENDAR_HUD_LOCKED: 'calendarHUDLocked',
  HUD_STICKY_STATES: 'hudStickyStates',
  CALENDAR_HUD_POSITION: 'calendarHUDPosition',
  CHAT_TIMESTAMP_MODE: 'chatTimestampMode',
  CHAT_TIMESTAMP_SHOW_TIME: 'chatTimestampShowTime',
  DISPLAY_FORMATS: 'displayFormats'
};

/**
 * Display format location identifiers.
 * Each location can have separate GM and player formats.
 * @enum {string}
 */
export const DISPLAY_LOCATIONS = {
  HUD_DATE: 'hudDate',
  HUD_TIME: 'hudTime',
  MINI_CALENDAR_HEADER: 'miniCalendarHeader',
  MINI_CALENDAR_TIME: 'miniCalendarTime',
  FULL_CALENDAR_HEADER: 'fullCalendarHeader',
  CHAT_TIMESTAMP: 'chatTimestamp'
};

/** @enum {string} Scene flags for scene-specific configuration */
export const SCENE_FLAGS = {
  DARKNESS_SYNC: 'darknessSync'
};

/** Template file paths for UI components */
export const TEMPLATES = {
  FORM_FOOTER: 'templates/generic/form-footer.hbs',
  SETTINGS: {
    PANEL_MOONS: `modules/${MODULE.ID}/templates/settings/tab-moons.hbs`,
    PANEL_CALENDAR: `modules/${MODULE.ID}/templates/settings/tab-calendar.hbs`,
    PANEL_NOTES: `modules/${MODULE.ID}/templates/settings/tab-notes.hbs`,
    PANEL_TIME: `modules/${MODULE.ID}/templates/settings/tab-time.hbs`,
    PANEL_WEATHER: `modules/${MODULE.ID}/templates/settings/tab-weather.hbs`,
    PANEL_APPEARANCE: `modules/${MODULE.ID}/templates/settings/tab-appearance.hbs`,
    PANEL_MACROS: `modules/${MODULE.ID}/templates/settings/tab-macros.hbs`,
    PANEL_CHAT: `modules/${MODULE.ID}/templates/settings/tab-chat.hbs`,
    PANEL_ADVANCED: `modules/${MODULE.ID}/templates/settings/tab-advanced.hbs`,
    PANEL_MINI_CALENDAR: `modules/${MODULE.ID}/templates/settings/tab-mini-calendar.hbs`,
    PANEL_HUD: `modules/${MODULE.ID}/templates/settings/tab-hud.hbs`,
    PANEL_TIMEKEEPER: `modules/${MODULE.ID}/templates/settings/tab-timekeeper.hbs`,
    PANEL_FULLCAL: `modules/${MODULE.ID}/templates/settings/tab-fullcal.hbs`,
    PANEL_FORMATS: `modules/${MODULE.ID}/templates/settings/tab-formats.hbs`
  },
  PARTIALS: {
    SCENE_DARKNESS_SYNC: `modules/${MODULE.ID}/templates/partials/scene-darkness-sync.hbs`,
    DATE_PICKER: `modules/${MODULE.ID}/templates/partials/dialog-date-picker.hbs`,
    CHAT_ANNOUNCEMENT: `modules/${MODULE.ID}/templates/partials/chat-announcement.hbs`
  },
  TIME_DIAL: `modules/${MODULE.ID}/templates/time-dial.hbs`,
  TIME_KEEPER_HUD: `modules/${MODULE.ID}/templates/time-keeper-hud.hbs`,
  MINI_CALENDAR: `modules/${MODULE.ID}/templates/mini-calendar.hbs`,
  CALENDAR_HUD: `modules/${MODULE.ID}/templates/calendaria-hud.hbs`,
  CALENDAR_HUD_DOME: `modules/${MODULE.ID}/templates/calendaria-hud-dome.hbs`,
  CALENDAR_HUD_BAR: `modules/${MODULE.ID}/templates/calendaria-hud-bar.hbs`,
  SHEETS: {
    CALENDAR_HEADER: `modules/${MODULE.ID}/templates/sheets/calendar-header.hbs`,
    CALENDAR_GRID: `modules/${MODULE.ID}/templates/sheets/calendar-grid.hbs`,
    CALENDAR_CONTENT: `modules/${MODULE.ID}/templates/sheets/calendar-content.hbs`,
    CALENDAR_WEEK: `modules/${MODULE.ID}/templates/sheets/calendar-week.hbs`,
    CALENDAR_YEAR: `modules/${MODULE.ID}/templates/sheets/calendar-year.hbs`,
    CALENDAR_NOTE_FORM: `modules/${MODULE.ID}/templates/sheets/calendar-note-form.hbs`,
    CALENDAR_NOTE_VIEW: `modules/${MODULE.ID}/templates/sheets/calendar-note-view.hbs`
  },
  EDITOR: {
    TAB_NAVIGATION: `modules/${MODULE.ID}/templates/editor/tab-navigation.hbs`,
    TAB_BASIC: `modules/${MODULE.ID}/templates/editor/tab-basic.hbs`,
    TAB_MONTHS: `modules/${MODULE.ID}/templates/editor/tab-months.hbs`,
    TAB_WEEKDAYS: `modules/${MODULE.ID}/templates/editor/tab-weekdays.hbs`,
    TAB_TIME: `modules/${MODULE.ID}/templates/editor/tab-time.hbs`,
    TAB_SEASONS: `modules/${MODULE.ID}/templates/editor/tab-seasons.hbs`,
    TAB_ERAS: `modules/${MODULE.ID}/templates/editor/tab-eras.hbs`,
    TAB_MOONS: `modules/${MODULE.ID}/templates/editor/tab-moons.hbs`,
    TAB_FESTIVALS: `modules/${MODULE.ID}/templates/editor/tab-festivals.hbs`,
    TAB_CYCLES: `modules/${MODULE.ID}/templates/editor/tab-cycles.hbs`,
    TAB_WEATHER: `modules/${MODULE.ID}/templates/editor/tab-weather.hbs`
  },
  IMPORTER: { APP: `modules/${MODULE.ID}/templates/importers/importer-app.hbs` },
  WEATHER: { PICKER: `modules/${MODULE.ID}/templates/weather/weather-picker.hbs` },
  SEARCH: { PANEL: `modules/${MODULE.ID}/templates/search/search-panel.hbs` }
};

/** Asset paths */
export const ASSETS = {
  MOON_ICONS: `modules/${MODULE.ID}/assets/moon-phases`
};

/** Standard 8-phase moon cycle (start/end are 0-1 range) */
export const DEFAULT_MOON_PHASES = [
  { name: 'CALENDARIA.MoonPhase.NewMoon', icon: `${ASSETS.MOON_ICONS}/01_newmoon.svg`, start: 0, end: 0.125 },
  { name: 'CALENDARIA.MoonPhase.WaxingCrescent', icon: `${ASSETS.MOON_ICONS}/02_waxingcrescent.svg`, start: 0.125, end: 0.25 },
  { name: 'CALENDARIA.MoonPhase.FirstQuarter', icon: `${ASSETS.MOON_ICONS}/03_firstquarter.svg`, start: 0.25, end: 0.375 },
  { name: 'CALENDARIA.MoonPhase.WaxingGibbous', icon: `${ASSETS.MOON_ICONS}/04_waxinggibbous.svg`, start: 0.375, end: 0.5 },
  { name: 'CALENDARIA.MoonPhase.FullMoon', icon: `${ASSETS.MOON_ICONS}/05_fullmoon.svg`, start: 0.5, end: 0.625 },
  { name: 'CALENDARIA.MoonPhase.WaningGibbous', icon: `${ASSETS.MOON_ICONS}/06_waninggibbous.svg`, start: 0.625, end: 0.75 },
  { name: 'CALENDARIA.MoonPhase.LastQuarter', icon: `${ASSETS.MOON_ICONS}/07_lastquarter.svg`, start: 0.75, end: 0.875 },
  { name: 'CALENDARIA.MoonPhase.WaningCrescent', icon: `${ASSETS.MOON_ICONS}/08_waningcrescent.svg`, start: 0.875, end: 1 }
];

/** @enum {string} Custom hook names fired by the module */
export const HOOKS = {
  INIT: 'calendaria.init',
  READY: 'calendaria.ready',
  CALENDAR_SWITCHED: 'calendaria.calendarSwitched',
  REMOTE_CALENDAR_SWITCH: 'calendaria.remoteCalendarSwitch',
  CALENDAR_ADDED: 'calendaria.calendarAdded',
  CALENDAR_UPDATED: 'calendaria.calendarUpdated',
  CALENDAR_REMOVED: 'calendaria.calendarRemoved',
  DATE_TIME_CHANGE: 'calendaria.dateTimeChange',
  DAY_CHANGE: 'calendaria.dayChange',
  MONTH_CHANGE: 'calendaria.monthChange',
  YEAR_CHANGE: 'calendaria.yearChange',
  SEASON_CHANGE: 'calendaria.seasonChange',
  REMOTE_DATE_CHANGE: 'calendaria.remoteDateChange',
  SUNRISE: 'calendaria.sunrise',
  SUNSET: 'calendaria.sunset',
  MIDNIGHT: 'calendaria.midnight',
  MIDDAY: 'calendaria.midday',
  MOON_PHASE_CHANGE: 'calendaria.moonPhaseChange',
  REST_DAY_CHANGE: 'calendaria.restDayChange',
  CLOCK_START_STOP: 'calendaria.clockStartStop',
  CLOCK_UPDATE: 'calendaria.clockUpdate',
  NOTE_CREATED: 'calendaria.noteCreated',
  NOTE_UPDATED: 'calendaria.noteUpdated',
  NOTE_DELETED: 'calendaria.noteDeleted',
  EVENT_TRIGGERED: 'calendaria.eventTriggered',
  EVENT_DAY_CHANGED: 'calendaria.eventDayChanged',
  PRE_RENDER_CALENDAR: 'calendaria.preRenderCalendar',
  RENDER_CALENDAR: 'calendaria.renderCalendar',
  IMPORT_STARTED: 'calendaria.importStarted',
  IMPORT_COMPLETE: 'calendaria.importComplete',
  IMPORT_FAILED: 'calendaria.importFailed',
  WEATHER_CHANGE: 'calendaria.weatherChange'
};

/** @enum {string} Journal page type identifiers */
export const JOURNALS = {
  CALENDAR_NOTE: 'calendaria.calendarnote'
};

/** @enum {string} Sheet registration identifiers */
export const SHEETS = {
  CALENDARIA: 'calendaria'
};

/** @enum {string} Socket message types for multiplayer sync */
export const SOCKET_TYPES = {
  CLOCK_UPDATE: 'clockUpdate',
  DATE_CHANGE: 'dateChange',
  NOTE_UPDATE: 'noteUpdate',
  CALENDAR_SWITCH: 'calendarSwitch',
  WEATHER_CHANGE: 'weatherChange'
};
