/**
 * Core module constants for Calendaria.
 * @module Constants
 * @author Tyler
 */

/** Module identification */
export const MODULE = {
  ID: 'calendaria',
  LOG_LEVEL: 0,
  TITLE: 'Calendaria'
};

/** @enum {string} Settings keys for Foundry VTT game settings */
export const SETTINGS = {
  ACTIVE_CALENDAR: 'activeCalendar',
  ADVANCE_TIME_ON_REST: 'advanceTimeOnRest',
  ALLOW_SIDEBAR_OVERLAP: 'allowSidebarOverlap',
  AMBIENCE_SYNC: 'ambienceSync',
  BIG_CAL_CYCLES_DISPLAY_MODE: 'bigCalCyclesDisplayMode',
  BIG_CAL_ERA_DISPLAY_MODE: 'bigCalEraDisplayMode',
  BIG_CAL_HEADER_SHOW_SELECTED: 'bigCalHeaderShowSelected',
  BIG_CAL_SEASON_DISPLAY_MODE: 'bigCalSeasonDisplayMode',
  BIG_CAL_SHOW_CYCLES: 'bigCalShowCycles',
  BIG_CAL_SHOW_ERA: 'bigCalShowEra',
  BIG_CAL_SHOW_MOON_PHASES: 'bigCalShowMoonPhases',
  BIG_CAL_SHOW_SEASON: 'bigCalShowSeason',
  BIG_CAL_SHOW_WEATHER: 'bigCalShowWeather',
  BIG_CAL_WEATHER_DISPLAY_MODE: 'bigCalWeatherDisplayMode',
  CALENDAR_HUD_LOCKED: 'calendarHUDLocked',
  CALENDAR_HUD_MODE: 'calendarHUDMode',
  CALENDAR_HUD_POSITION: 'calendarHUDPosition',
  CALENDAR_POSITION: 'calendarPosition',
  CALENDARS: 'calendars',
  CHAT_TIMESTAMP_MODE: 'chatTimestampMode',
  CHAT_TIMESTAMP_SHOW_TIME: 'chatTimestampShowTime',
  CURRENT_WEATHER: 'currentWeather',
  CUSTOM_CALENDARS: 'customCalendars',
  CUSTOM_CATEGORIES: 'customCategories',
  CUSTOM_THEME_COLORS: 'customThemeColors',
  CUSTOM_TIME_JUMPS: 'customTimeJumps',
  CUSTOM_WEATHER_PRESETS: 'customWeatherPresets',
  DARKNESS_SYNC_ALL_SCENES: 'darknessSyncAllScenes',
  DARKNESS_SYNC: 'darknessSync',
  DARKNESS_WEATHER_SYNC: 'darknessWeatherSync',
  DEFAULT_BRIGHTNESS_MULTIPLIER: 'defaultBrightnessMultiplier',
  DEFAULT_OVERRIDES: 'defaultOverrides',
  DEV_MODE: 'devMode',
  DISPLAY_FORMATS: 'displayFormats',
  FORCE_HUD: 'forceHUD',
  FORCE_MINI_CAL: 'forceMiniCal',
  HUD_AUTO_FADE: 'hudAutoFade',
  HUD_COMBAT_COMPACT: 'hudCombatCompact',
  HUD_COMBAT_HIDE: 'hudCombatHide',
  HUD_CYCLES_DISPLAY_MODE: 'hudCyclesDisplayMode',
  HUD_DIAL_STYLE: 'hudDialStyle',
  HUD_DOME_AUTO_HIDE: 'hudDomeAutoHide',
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
  LOGGING_LEVEL: 'loggingLevel',
  MACRO_TRIGGERS: 'macroTriggers',
  MINI_CAL_AUTO_FADE: 'miniCalAutoFade',
  MINI_CAL_CONFIRM_SET_DATE: 'miniCalConfirmSetDate',
  MINI_CAL_CONTROLS_DELAY: 'miniCalControlsDelay',
  MINI_CAL_CYCLES_DISPLAY_MODE: 'miniCalCyclesDisplayMode',
  MINI_CAL_ERA_DISPLAY_MODE: 'miniCalEraDisplayMode',
  MINI_CAL_HEADER_SHOW_SELECTED: 'miniCalHeaderShowSelected',
  MINI_CAL_IDLE_OPACITY: 'miniCalIdleOpacity',
  MINI_CAL_POSITION: 'miniCalPosition',
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
  POSITION_LOCKED: 'positionLocked',
  PRIMARY_GM: 'primaryGM',
  SAVED_TIMEPOINTS: 'savedTimepoints',
  SHOW_ACTIVE_CALENDAR_TO_PLAYERS: 'showActiveCalendarToPlayers',
  SHOW_CALENDAR_HUD: 'showCalendarHUD',
  SHOW_JOURNAL_FOOTER: 'showJournalFooter',
  SHOW_MINI_CAL: 'showMiniCal',
  SHOW_TIME_KEEPER: 'showTimeKeeper',
  SHOW_TOOLBAR_BUTTON: 'showToolbarButton',
  STOPWATCH_AUTO_START_TIME: 'stopwatchAutoStartTime',
  STOPWATCH_POSITION: 'stopwatchPosition',
  STOPWATCH_STATE: 'stopwatchState',
  STOPWATCH_STICKY_STATES: 'stopwatchStickyStates',
  SYNC_CLOCK_PAUSE: 'syncClockPause',
  TEMPERATURE_UNIT: 'temperatureUnit',
  THEME_MODE: 'themeMode',
  TIME_KEEPER_POSITION: 'timeKeeperPosition',
  TIME_SPEED_INCREMENT: 'timeSpeedIncrement',
  TIME_SPEED_MULTIPLIER: 'timeSpeedMultiplier',
  TIMEKEEPER_AUTO_FADE: 'timeKeeperAutoFade',
  TIMEKEEPER_IDLE_OPACITY: 'timeKeeperIdleOpacity',
  TIMEKEEPER_STICKY_STATES: 'timeKeeperStickyStates',
  TIMEKEEPER_TIME_JUMPS: 'timeKeeperTimeJumps',
  TOOLBAR_APPS: 'toolbarApps',
  WEATHER_PRESET_ALIASES: 'weatherPresetAliases'
};

/**
 * Display format location identifiers.
 * Each location can have separate GM and player formats.
 * @enum {string}
 */
export const DISPLAY_LOCATIONS = {
  BIG_CAL_HEADER: 'bigCalHeader',
  CHAT_TIMESTAMP: 'chatTimestamp',
  HUD_DATE: 'hudDate',
  HUD_TIME: 'hudTime',
  MINI_CAL_HEADER: 'miniCalHeader',
  MINI_CAL_TIME: 'miniCalTime',
  STOPWATCH_GAMETIME: 'stopwatchGametime',
  STOPWATCH_REALTIME: 'stopwatchRealtime',
  TIMEKEEPER_DATE: 'timekeeperDate',
  TIMEKEEPER_TIME: 'timekeeperTime'
};

/** @enum {string} Scene flags for scene-specific configuration */
export const SCENE_FLAGS = {
  BRIGHTNESS_MULTIPLIER: 'brightnessMultiplier',
  CLIMATE_ZONE_OVERRIDE: 'climateZoneOverride',
  DARKNESS_SYNC: 'darknessSync',
  HUD_HIDE_FOR_PLAYERS: 'hudHideForPlayers'
};

/** Template file paths for UI components */
export const TEMPLATES = {
  FORM_FOOTER: 'templates/generic/form-footer.hbs',
  TAB_NAVIGATION: `modules/${MODULE.ID}/templates/partials/tab-navigation.hbs`,
  SETTINGS: {
    PANEL_HOME: `modules/${MODULE.ID}/templates/settings/tab-home.hbs`,
    PANEL_NOTES: `modules/${MODULE.ID}/templates/settings/tab-notes.hbs`,
    PANEL_TIME: `modules/${MODULE.ID}/templates/settings/tab-time.hbs`,
    PANEL_WEATHER: `modules/${MODULE.ID}/templates/settings/tab-weather.hbs`,
    PANEL_THEME: `modules/${MODULE.ID}/templates/settings/tab-theme.hbs`,
    PANEL_MACROS: `modules/${MODULE.ID}/templates/settings/tab-macros.hbs`,
    PANEL_CHAT: `modules/${MODULE.ID}/templates/settings/tab-chat.hbs`,
    PANEL_PERMISSIONS: `modules/${MODULE.ID}/templates/settings/tab-permissions.hbs`,
    PANEL_CANVAS: `modules/${MODULE.ID}/templates/settings/tab-canvas.hbs`,
    PANEL_MODULE: `modules/${MODULE.ID}/templates/settings/tab-module.hbs`,
    PANEL_BIGCAL: `modules/${MODULE.ID}/templates/settings/tab-bigcal.hbs`,
    PANEL_MINI_CAL: `modules/${MODULE.ID}/templates/settings/tab-mini-cal.hbs`,
    PANEL_HUD: `modules/${MODULE.ID}/templates/settings/tab-hud.hbs`,
    PANEL_TIMEKEEPER: `modules/${MODULE.ID}/templates/settings/tab-timekeeper.hbs`,
    PANEL_STOPWATCH: `modules/${MODULE.ID}/templates/settings/tab-stopwatch.hbs`,
    PANEL_FOOTER: `modules/${MODULE.ID}/templates/settings/form-footer.hbs`
  },
  PARTIALS: {
    SCENE_DARKNESS_SYNC: `modules/${MODULE.ID}/templates/partials/scene-darkness-sync.hbs`,
    DATE_PICKER: `modules/${MODULE.ID}/templates/partials/dialog-date-picker.hbs`,
    CHAT_ANNOUNCEMENT: `modules/${MODULE.ID}/templates/partials/chat-announcement.hbs`
  },
  STOPWATCH: `modules/${MODULE.ID}/templates/stopwatch.hbs`,
  TIME_DIAL: `modules/${MODULE.ID}/templates/time-dial.hbs`,
  TIME_KEEPER: `modules/${MODULE.ID}/templates/time-keeper.hbs`,
  MINI_CAL: `modules/${MODULE.ID}/templates/mini-cal.hbs`,
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
    TAB_OVERVIEW: `modules/${MODULE.ID}/templates/editor/tab-overview.hbs`,
    TAB_DISPLAY: `modules/${MODULE.ID}/templates/editor/tab-display.hbs`,
    TAB_MONTHS: `modules/${MODULE.ID}/templates/editor/tab-months.hbs`,
    TAB_WEEKS: `modules/${MODULE.ID}/templates/editor/tab-weeks.hbs`,
    TAB_TIME: `modules/${MODULE.ID}/templates/editor/tab-time.hbs`,
    TAB_SEASONS: `modules/${MODULE.ID}/templates/editor/tab-seasons.hbs`,
    TAB_YEARS: `modules/${MODULE.ID}/templates/editor/tab-years.hbs`,
    TAB_ERAS: `modules/${MODULE.ID}/templates/editor/tab-eras.hbs`,
    TAB_MOONS: `modules/${MODULE.ID}/templates/editor/tab-moons.hbs`,
    TAB_FESTIVALS: `modules/${MODULE.ID}/templates/editor/tab-festivals.hbs`,
    TAB_CYCLES: `modules/${MODULE.ID}/templates/editor/tab-cycles.hbs`,
    TAB_WEATHER: `modules/${MODULE.ID}/templates/editor/tab-weather.hbs`
  },
  IMPORTER: { APP: `modules/${MODULE.ID}/templates/importers/importer-app.hbs` },
  WEATHER: {
    PICKER: `modules/${MODULE.ID}/templates/weather/weather-picker.hbs`,
    CLIMATE_EDITOR: `modules/${MODULE.ID}/templates/weather/climate-editor.hbs`
  },
  SEARCH: { PANEL: `modules/${MODULE.ID}/templates/search/search-panel.hbs` },
  SET_DATE_DIALOG: `modules/${MODULE.ID}/templates/set-date-dialog.hbs`
};

/** Asset paths */
export const ASSETS = {
  MOON_ICONS: `modules/${MODULE.ID}/assets/moon-phases`
};

/** Standard 8-phase moon cycle (start/end are 0-1 range) */
export const DEFAULT_MOON_PHASES = {
  newmoon000000000: { name: 'CALENDARIA.MoonPhase.NewMoon', icon: `${ASSETS.MOON_ICONS}/01_newmoon.svg`, start: 0, end: 0.125 },
  waxingcrescent00: { name: 'CALENDARIA.MoonPhase.WaxingCrescent', icon: `${ASSETS.MOON_ICONS}/02_waxingcrescent.svg`, start: 0.125, end: 0.25 },
  firstquarter0000: { name: 'CALENDARIA.MoonPhase.FirstQuarter', icon: `${ASSETS.MOON_ICONS}/03_firstquarter.svg`, start: 0.25, end: 0.375 },
  waxinggibbous000: { name: 'CALENDARIA.MoonPhase.WaxingGibbous', icon: `${ASSETS.MOON_ICONS}/04_waxinggibbous.svg`, start: 0.375, end: 0.5 },
  fullmoon00000000: { name: 'CALENDARIA.MoonPhase.FullMoon', icon: `${ASSETS.MOON_ICONS}/05_fullmoon.svg`, start: 0.5, end: 0.625 },
  waninggibbous000: { name: 'CALENDARIA.MoonPhase.WaningGibbous', icon: `${ASSETS.MOON_ICONS}/06_waninggibbous.svg`, start: 0.625, end: 0.75 },
  lastquarter00000: { name: 'CALENDARIA.MoonPhase.LastQuarter', icon: `${ASSETS.MOON_ICONS}/07_lastquarter.svg`, start: 0.75, end: 0.875 },
  waningcrescent00: { name: 'CALENDARIA.MoonPhase.WaningCrescent', icon: `${ASSETS.MOON_ICONS}/08_waningcrescent.svg`, start: 0.875, end: 1 }
};

/** @enum {string} Custom hook names fired by the module */
export const HOOKS = {
  CALENDAR_ADDED: 'calendaria.calendarAdded',
  CALENDAR_REMOVED: 'calendaria.calendarRemoved',
  CALENDAR_SWITCHED: 'calendaria.calendarSwitched',
  CALENDAR_UPDATED: 'calendaria.calendarUpdated',
  CLOCK_START_STOP: 'calendaria.clockStartStop',
  CLOCK_UPDATE: 'calendaria.clockUpdate',
  DATE_TIME_CHANGE: 'calendaria.dateTimeChange',
  DAY_CHANGE: 'calendaria.dayChange',
  EVENT_DAY_CHANGED: 'calendaria.eventDayChanged',
  EVENT_TRIGGERED: 'calendaria.eventTriggered',
  IMPORT_COMPLETE: 'calendaria.importComplete',
  IMPORT_FAILED: 'calendaria.importFailed',
  IMPORT_STARTED: 'calendaria.importStarted',
  INIT: 'calendaria.init',
  MIDDAY: 'calendaria.midday',
  MIDNIGHT: 'calendaria.midnight',
  MONTH_CHANGE: 'calendaria.monthChange',
  MOON_PHASE_CHANGE: 'calendaria.moonPhaseChange',
  NOTE_CREATED: 'calendaria.noteCreated',
  NOTE_DELETED: 'calendaria.noteDeleted',
  NOTE_UPDATED: 'calendaria.noteUpdated',
  PRE_RENDER_CALENDAR: 'calendaria.preRenderCalendar',
  READY: 'calendaria.ready',
  REMINDER_RECEIVED: 'calendaria.reminderReceived',
  REMOTE_CALENDAR_SWITCH: 'calendaria.remoteCalendarSwitch',
  REMOTE_DATE_CHANGE: 'calendaria.remoteDateChange',
  RENDER_CALENDAR: 'calendaria.renderCalendar',
  REST_DAY_CHANGE: 'calendaria.restDayChange',
  SEASON_CHANGE: 'calendaria.seasonChange',
  STOPWATCH_LAP: 'calendaria.stopwatchLap',
  STOPWATCH_PAUSE: 'calendaria.stopwatchPause',
  STOPWATCH_RESET: 'calendaria.stopwatchReset',
  STOPWATCH_START: 'calendaria.stopwatchStart',
  SUNRISE: 'calendaria.sunrise',
  SUNSET: 'calendaria.sunset',
  VISUAL_TICK: 'calendaria.visualTick',
  WEATHER_CHANGE: 'calendaria.weatherChange',
  WIDGET_REGISTERED: 'calendaria.widgetRegistered',
  WIDGETS_REFRESH: 'calendaria.widgetsRefresh',
  WORLD_TIME_UPDATED: 'calendaria.worldTimeUpdated',
  YEAR_CHANGE: 'calendaria.yearChange'
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
  CALENDAR_REQUEST: 'calendarRequest',
  CALENDAR_SWITCH: 'calendarSwitch',
  CLOCK_UPDATE: 'clockUpdate',
  CREATE_NOTE_COMPLETE: 'createNoteComplete',
  CREATE_NOTE: 'createNote',
  DATE_CHANGE: 'dateChange',
  HUD_VISIBILITY: 'hudVisibility',
  MINI_CAL_VISIBILITY: 'miniCalVisibility',
  NOTE_UPDATE: 'noteUpdate',
  REMINDER_NOTIFY: 'reminderNotify',
  TIME_KEEPER_VISIBILITY: 'timeKeeperVisibility',
  TIME_REQUEST: 'timeRequest',
  WEATHER_CHANGE: 'weatherChange',
  WEATHER_REQUEST: 'weatherRequest'
};

/** @enum {string} Widget insertion points for external modules */
export const WIDGET_POINTS = {
  BIGCAL_ACTIONS: 'bigcal.actions',
  HUD_BUTTONS_LEFT: 'hud.buttons.left',
  HUD_BUTTONS_RIGHT: 'hud.buttons.right',
  HUD_INDICATORS: 'hud.indicators',
  HUD_TRAY: 'hud.tray',
  MINICAL_SIDEBAR: 'minical.sidebar'
};

/** @enum {string} Built-in elements that can be replaced by widgets */
export const REPLACEABLE_ELEMENTS = {
  CYCLE_INDICATOR: 'cycle-indicator',
  ERA_INDICATOR: 'era-indicator',
  SEASON_INDICATOR: 'season-indicator',
  WEATHER_INDICATOR: 'weather-indicator'
};
