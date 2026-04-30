/**
 * Core module constants for Calendaria.
 * @module Constants
 * @author Tyler
 */

/** @type {object} Module identification */
export const MODULE = {
  ID: 'calendaria',
  LOG_LEVEL: 0,
  TITLE: 'Calendaria'
};

/** @enum {string} Keybinding action IDs */
export const KEYBINDS = {
  STOPWATCH_RESET: 'stopwatch-reset',
  STOPWATCH_START_PAUSE: 'stopwatch-start-pause',
  TOGGLE_BIGCAL: 'toggle-bigcal',
  TOGGLE_HUD: 'toggle-hud',
  TOGGLE_MINICAL: 'toggle-minical',
  TOGGLE_STOPWATCH: 'toggle-stopwatch',
  TOGGLE_CHRONICLE: 'toggle-chronicle',
  TOGGLE_NOTEVIEWER: 'toggle-noteviewer',
  TOGGLE_SUNDIAL: 'toggle-sundial',
  TOGGLE_TIMEKEEPER: 'toggle-timekeeper'
};

/** @enum {string} Settings keys for Foundry VTT game settings */
export const SETTINGS = {
  ACTIVE_CALENDAR: 'activeCalendar',
  ADVANCE_BASTION_ORDERS: 'advanceBastionOrders',
  ADVANCE_TIME_ON_REST: 'advanceTimeOnRest',
  ALLOW_SIDEBAR_OVERLAP: 'allowSidebarOverlap',
  AMBIENCE_SYNC: 'ambienceSync',
  AUTO_GENERATE_WEATHER: 'autoGenerateWeather',
  BASTION_LAST_ADVANCE: 'bastionLastAdvance',
  BIG_CAL_AUTO_FADE: 'bigCalAutoFade',
  BIG_CAL_COMBAT_MODE: 'bigCalCombatMode',
  BIG_CAL_CYCLES_DISPLAY_MODE: 'bigCalCyclesDisplayMode',
  BIG_CAL_ERA_DISPLAY_MODE: 'bigCalEraDisplayMode',
  BIG_CAL_HEADER_SHOW_SELECTED: 'bigCalHeaderShowSelected',
  BIG_CAL_IDLE_OPACITY: 'bigCalIdleOpacity',
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
  CHAT_TIMESTAMP_MODE: 'chatTimestampMode',
  CHAT_TIMESTAMP_SHOW_TIME: 'chatTimestampShowTime',
  CHRONICLE_BIG_CAL_BUTTON: 'chronicleBigCalButton',
  CHRONICLE_CATEGORY_FILTER: 'chronicleCategoryFilter',
  CHRONICLE_COMBAT_MODE: 'chronicleCombatMode',
  CHRONICLE_EMPTY_CONTENT_TYPES: 'chronicleEmptyContentTypes',
  CHRONICLE_ENTRY_DEPTH: 'chronicleEntryDepth',
  CHRONICLE_HUD_BUTTON: 'chronicleHudButton',
  CHRONICLE_MINI_CAL_BUTTON: 'chronicleMiniCalButton',
  CHRONICLE_POSITION: 'chroniclePosition',
  CHRONICLE_SHOW_EMPTY: 'chronicleShowEmpty',
  CHRONICLE_SHOW_MOON_PHASES: 'chronicleShowMoonPhases',
  CHRONICLE_SHOW_SEASON_CHANGES: 'chronicleShowSeasonChanges',
  CHRONICLE_SHOW_WEATHER: 'chronicleShowWeather',
  CHRONICLE_VIEW_MODE: 'chronicleViewMode',
  CINEMATIC_ENABLED: 'cinematicEnabled',
  CINEMATIC_EVENT_MAX_CARDS: 'cinematicEventMaxCards',
  CINEMATIC_EVENT_WEIGHTING: 'cinematicEventWeighting',
  CINEMATIC_ON_REST: 'cinematicOnRest',
  CINEMATIC_PANEL_DURATION: 'cinematicPanelDuration',
  CINEMATIC_SHOW_EVENTS: 'cinematicShowEvents',
  CINEMATIC_SHOW_MOONS: 'cinematicShowMoons',
  CINEMATIC_SHOW_WEATHER: 'cinematicShowWeather',
  CINEMATIC_THRESHOLD_UNIT: 'cinematicThresholdUnit',
  CINEMATIC_THRESHOLD: 'cinematicThreshold',
  CLOCK_LOCKED: 'clockLocked',
  CLOCK_RUN_DURING_COMBAT: 'clockRunDuringCombat',
  COLOR_SHIFT_SYNC: 'colorShiftSync',
  CURRENT_WEATHER: 'currentWeather',
  CUSTOM_CALENDARS: 'customCalendars',
  CUSTOM_PRESETS: 'customPresets',
  CUSTOM_THEME_COLORS: 'customThemeColors',
  CUSTOM_TIME_JUMPS: 'customTimeJumps',
  CUSTOM_WEATHER_PRESETS: 'customWeatherPresets',
  DARKNESS_MOON_SYNC: 'darknessMoonSync',
  DARKNESS_SYNC_ALL_SCENES: 'darknessSyncAllScenes',
  DARKNESS_SYNC: 'darknessSync',
  DARKNESS_WEATHER_SYNC: 'darknessWeatherSync',
  DEFAULT_BRIGHTNESS_MULTIPLIER: 'defaultBrightnessMultiplier',
  DEFAULT_NOTE_PRESET: 'defaultNotePreset',
  DEFAULT_OVERRIDES: 'defaultOverrides',
  DEV_MODE: 'devMode',
  DISPLAY_FORMATS: 'displayFormats',
  ENRICHER_CLICK_TARGET: 'enricherClickTarget',
  EQUIVALENT_DATE_CALENDARS: 'equivalentDateCalendars',
  FOG_OF_WAR_CONFIG: 'fogOfWarConfig',
  FOG_OF_WAR_ENABLED: 'fogOfWarEnabled',
  FOG_OF_WAR_NAV_MODE: 'fogOfWarNavMode',
  FOG_OF_WAR_RANGES: 'fogOfWarRanges',
  FOG_OF_WAR_REVEAL_INTERMEDIATE: 'fogOfWarRevealIntermediate',
  FOG_OF_WAR_START_DATE: 'fogOfWarStartDate',
  FORCE_BIG_CAL: 'forceBigCal',
  FORCE_CHRONICLE: 'forceChronicle',
  FORCE_HUD: 'forceHUD',
  FORCE_MINI_CAL: 'forceMiniCal',
  FORCE_STOPWATCH: 'forceStopwatch',
  FORCE_SUN_DIAL: 'forceSunDial',
  FORCE_THEME: 'forceTheme',
  FORCE_TIME_KEEPER: 'forceTimeKeeper',
  FORCED_THEME_COLORS: 'forcedThemeColors',
  FORECAST_ACCURACY: 'forecastAccuracy',
  FORECAST_DAYS: 'forecastDays',
  FXMASTER_BELOW_TOKENS: 'fxmasterBelowTokens',
  FXMASTER_ENABLED: 'fxmasterEnabled',
  FXMASTER_FORCE_DOWNWARD: 'fxmasterForceDownward',
  FXMASTER_SOUND_FX: 'fxMasterSoundFx',
  FXMASTER_TOP_DOWN: 'fxmasterTopDown',
  GM_OVERRIDE_CLEARS_FORECAST: 'gmOverrideClearsForecast',
  HUD_AUTO_FADE: 'hudAutoFade',
  HUD_BORDER_GLOW: 'hudBorderGlow',
  HUD_CALENDAR_BUTTON: 'hudCalendarButton',
  HUD_COMBAT_MODE: 'hudCombatMode',
  HUD_CYCLES_DISPLAY_MODE: 'hudCyclesDisplayMode',
  HUD_DIAL_STYLE: 'hudDialStyle',
  HUD_DOME_AUTO_HIDE: 'hudDomeAutoHide',
  HUD_DOME_BELOW: 'hudDomeBelow',
  HUD_ERA_DISPLAY_MODE: 'hudEraDisplayMode',
  HUD_IDLE_OPACITY: 'hudIdleOpacity',
  HUD_SEASON_DISPLAY_MODE: 'hudSeasonDisplayMode',
  HUD_SHOW_ALL_MOONS: 'hudShowAllMoons',
  HUD_SHOW_CYCLES: 'hudShowCycles',
  HUD_SHOW_ERA: 'hudShowEra',
  HUD_SHOW_SEASON: 'hudShowSeason',
  HUD_SHOW_WEATHER: 'hudShowWeather',
  HUD_STICKY_STATES: 'hudStickyStates',
  HUD_STICKY_ZONES_ENABLED: 'hudStickyZonesEnabled',
  HUD_TRAY_DIRECTION: 'hudTrayDirection',
  HUD_WEATHER_DISPLAY_MODE: 'hudWeatherDisplayMode',
  HUD_WEATHER_FX_MODE: 'hudWeatherFxMode',
  HUD_WIDTH_SCALE: 'hudWidthScale',
  INTRADAY_CARRY_OVER: 'intradayCarryOver',
  INTRADAY_WEATHER: 'intradayWeather',
  LOGGING_LEVEL: 'loggingLevel',
  MACRO_TRIGGERS: 'macroTriggers',
  MINI_CAL_AUTO_FADE: 'miniCalAutoFade',
  MINI_CAL_AUTO_OPEN_NOTES: 'miniCalAutoOpenNotes',
  MINI_CAL_COMBAT_MODE: 'miniCalCombatMode',
  MINI_CAL_COMPACT_MODE: 'miniCalCompactMode',
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
  MINI_CAL_SHOW_TIME: 'miniCalShowTime',
  MINI_CAL_SHOW_WEATHER: 'miniCalShowWeather',
  MINI_CAL_STICKY_STATES: 'miniCalStickyStates',
  MINI_CAL_TIME_JUMPS: 'miniCalTimeJumps',
  MINI_CAL_WEATHER_DISPLAY_MODE: 'miniCalWeatherDisplayMode',
  NOTE_OPEN_MODE: 'noteOpenMode',
  PERMISSIONS: 'permissions',
  POSITION_LOCKED: 'positionLocked',
  PRECIPITATION_UNIT: 'precipitationUnit',
  PRIMARY_GM: 'primaryGM',
  REST_ADVANCE_MODE: 'restAdvanceMode',
  REST_FIXED_HOURS: 'restFixedHours',
  SAVED_TIMEPOINTS: 'savedTimepoints',
  SEEDED_CALENDARS: 'seededCalendars',
  SHOW_BIG_CAL: 'showBigCal',
  SHOW_CALENDAR_HUD: 'showCalendarHUD',
  SHOW_CHRONICLE: 'showChronicle',
  SHOW_JOURNAL_FOOTER: 'showJournalFooter',
  SHOW_MINI_CAL: 'showMiniCal',
  SHOW_SECRET_NOTES: 'showSecretNotes',
  SHOW_STOPWATCH: 'showStopwatch',
  SHOW_SUN_DIAL: 'showSunDial',
  SHOW_TIME_KEEPER: 'showTimeKeeper',
  SHOW_TOOLBAR_BUTTON: 'showToolbarButton',
  STOPWATCH_AUTO_FADE: 'stopwatchAutoFade',
  STOPWATCH_AUTO_START_TIME: 'stopwatchAutoStartTime',
  STOPWATCH_COMBAT_MODE: 'stopwatchCombatMode',
  STOPWATCH_IDLE_OPACITY: 'stopwatchIdleOpacity',
  STOPWATCH_POSITION: 'stopwatchPosition',
  STOPWATCH_STATE: 'stopwatchState',
  STOPWATCH_STICKY_STATES: 'stopwatchStickyStates',
  SUN_DIAL_AUTO_FADE: 'sunDialAutoFade',
  SUN_DIAL_COMBAT_MODE: 'sunDialCombatMode',
  SUN_DIAL_CRANK_MODE: 'sunDialCrankMode',
  SUN_DIAL_IDLE_OPACITY: 'sunDialIdleOpacity',
  SUN_DIAL_POSITION: 'sunDialPosition',
  SUN_DIAL_STICKY_STATES: 'sunDialStickyStates',
  SYNC_CLOCK_PAUSE: 'syncClockPause',
  TEMPERATURE_SHOW_BOTH: 'temperatureShowBoth',
  TEMPERATURE_UNIT: 'temperatureUnit',
  THEME_MODE: 'themeMode',
  TIME_ADVANCE_INTERVAL: 'timeAdvanceInterval',
  TIME_KEEPER_POSITION: 'timeKeeperPosition',
  TIME_SPEED_INCREMENT: 'timeSpeedIncrement',
  TIME_SPEED_MULTIPLIER: 'timeSpeedMultiplier',
  TIMEKEEPER_AUTO_FADE: 'timeKeeperAutoFade',
  TIMEKEEPER_COMBAT_MODE: 'timeKeeperCombatMode',
  TIMEKEEPER_IDLE_OPACITY: 'timeKeeperIdleOpacity',
  TIMEKEEPER_STICKY_STATES: 'timeKeeperStickyStates',
  TIMEKEEPER_TIME_JUMPS: 'timeKeeperTimeJumps',
  TOOLBAR_APPS: 'toolbarApps',
  WEATHER_DAY_INDEX_MIGRATED: 'weatherDayIndexMigrated',
  WEATHER_FORECAST_PLAN: 'weatherForecastPlan',
  WEATHER_HISTORY_DAYS: 'weatherHistoryDays',
  WEATHER_HISTORY: 'weatherHistory',
  WEATHER_INERTIA: 'weatherInertia',
  WEATHER_PRESET_ALIASES: 'weatherPresetAliases',
  WEATHER_SOUND_FX: 'weatherSoundFx',
  WEATHER_SOUND_VOLUME: 'weatherSoundVolume',
  WEATHER_VISUAL_OVERRIDES: 'weatherVisualOverrides',
  WEATHER_YEAR_KEY_MIGRATED: 'weatherYearKeyMigrated',
  WIND_SPEED_UNIT: 'windSpeedUnit'
};

/** @enum {string} Display format location identifiers. */
export const DISPLAY_LOCATIONS = {
  BIG_CAL_HEADER: 'bigCalHeader',
  CHAT_TIMESTAMP: 'chatTimestamp',
  HUD_DATE: 'hudDate',
  HUD_TIME: 'hudTime',
  MICRO_CAL_HEADER: 'microCalHeader',
  MINI_CAL_HEADER: 'miniCalHeader',
  MINI_CAL_TIME: 'miniCalTime',
  STOPWATCH_GAMETIME: 'stopwatchGametime',
  STOPWATCH_REALTIME: 'stopwatchRealtime',
  SUNDIAL_TIME: 'sundialTime',
  TIMEKEEPER_DATE: 'timekeeperDate',
  TIMEKEEPER_TIME: 'timekeeperTime'
};

/** @enum {string} Scene flags for scene-specific configuration */
export const SCENE_FLAGS = {
  BRIGHTNESS_MULTIPLIER: 'brightnessMultiplier',
  CLIMATE_ZONE_OVERRIDE: 'climateZoneOverride',
  DARKNESS_SYNC: 'darknessSync',
  FXMASTER_TOP_DOWN_OVERRIDE: 'fxmasterTopDownOverride',
  HUD_HIDE_FOR_PLAYERS: 'hudHideForPlayers',
  WEATHER_FX_DISABLED: 'weatherFxDisabled',
  WEATHER_SOUND_DISABLED: 'weatherSoundDisabled'
};

/** @type {object} Template file paths for UI components */
export const TEMPLATES = {
  FORM_FOOTER: 'templates/generic/form-footer.hbs',
  TAB_NAVIGATION: `modules/${MODULE.ID}/templates/partials/tab-navigation.hbs`,
  SETTINGS: {
    PANEL_BIGCAL: `modules/${MODULE.ID}/templates/applications/settings/tab-bigcal.hbs`,
    PANEL_CANVAS: `modules/${MODULE.ID}/templates/applications/settings/tab-canvas.hbs`,
    PANEL_CINEMATICS: `modules/${MODULE.ID}/templates/applications/settings/tab-cinematics.hbs`,
    PANEL_CHAT: `modules/${MODULE.ID}/templates/applications/settings/tab-chat.hbs`,
    PANEL_FOG_OF_WAR: `modules/${MODULE.ID}/templates/applications/settings/tab-fogofwar.hbs`,
    PANEL_FOOTER: `modules/${MODULE.ID}/templates/applications/settings/form-footer.hbs`,
    PANEL_HOME: `modules/${MODULE.ID}/templates/applications/settings/tab-home.hbs`,
    PANEL_HUD: `modules/${MODULE.ID}/templates/applications/settings/tab-hud.hbs`,
    PANEL_MACROS: `modules/${MODULE.ID}/templates/applications/settings/tab-macros.hbs`,
    PANEL_MINI_CAL: `modules/${MODULE.ID}/templates/applications/settings/tab-mini-cal.hbs`,
    PANEL_MODULE: `modules/${MODULE.ID}/templates/applications/settings/tab-module.hbs`,
    PANEL_CHRONICLE: `modules/${MODULE.ID}/templates/applications/settings/tab-chronicle.hbs`,
    PANEL_NOTES: `modules/${MODULE.ID}/templates/applications/settings/tab-notes.hbs`,
    PANEL_PERMISSIONS: `modules/${MODULE.ID}/templates/applications/settings/tab-permissions.hbs`,
    PANEL_STOPWATCH: `modules/${MODULE.ID}/templates/applications/settings/tab-stopwatch.hbs`,
    PANEL_SUN_DIAL: `modules/${MODULE.ID}/templates/applications/settings/tab-sun-dial.hbs`,
    PANEL_THEME: `modules/${MODULE.ID}/templates/applications/settings/tab-theme.hbs`,
    PANEL_TIME: `modules/${MODULE.ID}/templates/applications/settings/tab-time.hbs`,
    PANEL_TIMEKEEPER: `modules/${MODULE.ID}/templates/applications/settings/tab-timekeeper.hbs`,
    PANEL_WEATHER: `modules/${MODULE.ID}/templates/applications/settings/tab-weather.hbs`,
    TOKEN_REFERENCE: `modules/${MODULE.ID}/templates/applications/dialogs/token-reference.hbs`,
    WEATHER_EDITOR_FOOTER: `modules/${MODULE.ID}/templates/applications/weather/weather-editor-footer.hbs`,
    WEATHER_EDITOR: `modules/${MODULE.ID}/templates/applications/weather/weather-editor.hbs`
  },
  PARTIALS: {
    CHAT_ANNOUNCEMENT: `modules/${MODULE.ID}/templates/partials/chat-announcement.hbs`,
    DATE_PICKER: `modules/${MODULE.ID}/templates/partials/dialog-date-picker.hbs`,
    MOON_PICKER: `modules/${MODULE.ID}/templates/partials/moon-picker.hbs`,
    NOTE_PANEL_ITEM: `modules/${MODULE.ID}/templates/partials/note-panel-item.hbs`,
    RELEASE_MESSAGE: `modules/${MODULE.ID}/templates/chat/release-message.hbs`
  },
  CALENDAR_HUD_BAR: `modules/${MODULE.ID}/templates/applications/hud/calendaria-hud-bar.hbs`,
  CALENDAR_HUD_DOME: `modules/${MODULE.ID}/templates/applications/hud/calendaria-hud-dome.hbs`,
  CALENDAR_HUD: `modules/${MODULE.ID}/templates/applications/hud/calendaria-hud.hbs`,
  MINI_CAL: `modules/${MODULE.ID}/templates/applications/calendar/mini-cal.hbs`,
  SECONDARY_CALENDAR: `modules/${MODULE.ID}/templates/applications/calendar/secondary-calendar.hbs`,
  STOPWATCH: `modules/${MODULE.ID}/templates/applications/time/stopwatch.hbs`,
  SUN_DIAL: `modules/${MODULE.ID}/templates/applications/time/sun-dial.hbs`,
  TIME_KEEPER: `modules/${MODULE.ID}/templates/applications/time/time-keeper.hbs`,
  SCENE: { CONFIG_CALENDARIA: `modules/${MODULE.ID}/templates/scene/scene-config-calendaria.hbs` },
  SHEETS: {
    CALENDAR_CONTENT: `modules/${MODULE.ID}/templates/applications/sheets/calendar-content.hbs`,
    CALENDAR_GRID: `modules/${MODULE.ID}/templates/applications/sheets/calendar-grid.hbs`,
    CALENDAR_HEADER: `modules/${MODULE.ID}/templates/applications/sheets/calendar-header.hbs`,
    CALENDAR_NOTE_VIEW: `modules/${MODULE.ID}/templates/applications/sheets/calendar-note-view.hbs`,
    CALENDAR_WEEK: `modules/${MODULE.ID}/templates/applications/sheets/calendar-week.hbs`,
    CALENDAR_YEAR: `modules/${MODULE.ID}/templates/applications/sheets/calendar-year.hbs`,
    NOTE_TAB_CONTENT: `modules/${MODULE.ID}/templates/applications/sheets/note-tab-content.hbs`,
    NOTE_TAB_SETTINGS: `modules/${MODULE.ID}/templates/applications/sheets/note-tab-settings.hbs`,
    NOTE_TAB_SCHEDULE: `modules/${MODULE.ID}/templates/applications/sheets/note-tab-schedule.hbs`
  },
  EDITOR: {
    TAB_CYCLES: `modules/${MODULE.ID}/templates/editor/tab-cycles.hbs`,
    TAB_DISPLAY: `modules/${MODULE.ID}/templates/editor/tab-display.hbs`,
    TAB_ERAS: `modules/${MODULE.ID}/templates/editor/tab-eras.hbs`,
    TAB_FESTIVALS: `modules/${MODULE.ID}/templates/editor/tab-festivals.hbs`,
    TAB_MONTHS: `modules/${MODULE.ID}/templates/editor/tab-months.hbs`,
    TAB_MOONS: `modules/${MODULE.ID}/templates/editor/tab-moons.hbs`,
    TAB_OVERVIEW: `modules/${MODULE.ID}/templates/editor/tab-overview.hbs`,
    TAB_SEASONS: `modules/${MODULE.ID}/templates/editor/tab-seasons.hbs`,
    TAB_TIME: `modules/${MODULE.ID}/templates/editor/tab-time.hbs`,
    TAB_WEATHER: `modules/${MODULE.ID}/templates/editor/tab-weather.hbs`,
    TAB_WEEKS: `modules/${MODULE.ID}/templates/editor/tab-weeks.hbs`,
    TAB_YEARS: `modules/${MODULE.ID}/templates/editor/tab-years.hbs`
  },
  IMPORTER: { APP: `modules/${MODULE.ID}/templates/importers/importer-app.hbs` },
  WEATHER: {
    CLIMATE_EDITOR_ENVIRONMENT: `modules/${MODULE.ID}/templates/applications/weather/climate-editor-environment.hbs`,
    CLIMATE_EDITOR_PRESETS: `modules/${MODULE.ID}/templates/applications/weather/climate-editor-presets.hbs`,
    CLIMATE_EDITOR_TABS: `modules/${MODULE.ID}/templates/applications/weather/climate-editor-tabs.hbs`,
    CLIMATE_EDITOR_WEATHER: `modules/${MODULE.ID}/templates/applications/weather/climate-editor-weather.hbs`,
    CLIMATE_EDITOR: `modules/${MODULE.ID}/templates/applications/weather/climate-editor.hbs`,
    PICKER_FOOTER: `modules/${MODULE.ID}/templates/applications/weather/weather-picker-footer.hbs`,
    PICKER: `modules/${MODULE.ID}/templates/applications/weather/weather-picker.hbs`,
    PROBABILITY_DIALOG: `modules/${MODULE.ID}/templates/applications/weather/weather-probability-dialog.hbs`
  },
  DIALOGS: {
    COMPUTED_EVENT_BUILDER: `modules/${MODULE.ID}/templates/applications/dialogs/computed-event-builder.hbs`,
    CONDITION_BUILDER: `modules/${MODULE.ID}/templates/applications/dialogs/condition-builder.hbs`,
    SET_DATE: `modules/${MODULE.ID}/templates/applications/dialogs/set-date-dialog.hbs`
  },
  CHRONICLE: `modules/${MODULE.ID}/templates/applications/calendar/chronicle.hbs`,
  CHRONICLE_CONTENT: `modules/${MODULE.ID}/templates/applications/calendar/chronicle-content.hbs`,
  CHRONICLE_ENTRY: `modules/${MODULE.ID}/templates/applications/calendar/chronicle-entry.hbs`,
  CHRONICLE_TIMELINE_ENTRY: `modules/${MODULE.ID}/templates/applications/calendar/chronicle-timeline-entry.hbs`,
  NOTE_VIEWER: {
    SEARCH: `modules/${MODULE.ID}/templates/applications/calendar/note-viewer-search.hbs`,
    FILTERS: `modules/${MODULE.ID}/templates/applications/calendar/note-viewer-filters.hbs`,
    RESULTS: `modules/${MODULE.ID}/templates/applications/calendar/note-viewer-results.hbs`,
    ROW: `modules/${MODULE.ID}/templates/applications/calendar/note-viewer-row.hbs`,
    FOOTER: `modules/${MODULE.ID}/templates/applications/calendar/note-viewer-footer.hbs`
  },
  SET_DATE_DIALOG: `modules/${MODULE.ID}/templates/applications/dialogs/set-date-dialog.hbs`
};

/** @type {Object<string, string>} Asset paths */
export const ASSETS = {
  MOON_ICONS: `modules/${MODULE.ID}/assets/moon-phases`
};

/** @type {Object<string, object>} Standard 8-phase moon cycle (start/end are 0-1 range) */
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

/** @type {string[]} Standard 8-phase moon localization keys. */
export const MOON_PHASE_LABELS = [
  'CALENDARIA.MoonPhase.NewMoon',
  'CALENDARIA.MoonPhase.WaxingCrescent',
  'CALENDARIA.MoonPhase.FirstQuarter',
  'CALENDARIA.MoonPhase.WaxingGibbous',
  'CALENDARIA.MoonPhase.FullMoon',
  'CALENDARIA.MoonPhase.WaningGibbous',
  'CALENDARIA.MoonPhase.LastQuarter',
  'CALENDARIA.MoonPhase.WaningCrescent'
];

/** @type {Object<string, object>} Wind speed scale (0-5). Canonical values stored in kph; imperial conversion at display time. */
export const WIND_SPEEDS = {
  CALM: { id: 'calm', value: 0, label: 'CALENDARIA.Weather.Wind.Calm', kph: 5 },
  LIGHT: { id: 'light', value: 1, label: 'CALENDARIA.Common.Light', kph: 20 },
  MODERATE: { id: 'moderate', value: 2, label: 'CALENDARIA.Common.Moderate', kph: 40 },
  STRONG: { id: 'strong', value: 3, label: 'CALENDARIA.Weather.Wind.Strong', kph: 60 },
  SEVERE: { id: 'severe', value: 4, label: 'CALENDARIA.Common.Severe', kph: 90 },
  EXTREME: { id: 'extreme', value: 5, label: 'CALENDARIA.Weather.Wind.Extreme', kph: 250 }
};

/** @enum {string|null} Precipitation type identifiers */
export const PRECIPITATION_TYPES = { NONE: null, DRIZZLE: 'drizzle', RAIN: 'rain', SNOW: 'snow', SLEET: 'sleet', HAIL: 'hail' };

/** @type {Object<string, number>} Compass direction degrees for 16-point wind rose */
export const COMPASS_DIRECTIONS = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 };

/** @type {Object<string, object>} Intraday weather period definitions tied to threshold hooks */
export const WEATHER_PERIODS = {
  NIGHT: { id: 'night', index: 0, label: 'CALENDARIA.Common.Night', icon: 'fa-moon' },
  MORNING: { id: 'morning', index: 1, label: 'CALENDARIA.Format.ApproxTime.Morning', icon: 'fa-sun' },
  AFTERNOON: { id: 'afternoon', index: 2, label: 'CALENDARIA.Format.ApproxTime.Afternoon', icon: 'fa-cloud-sun' },
  EVENING: { id: 'evening', index: 3, label: 'CALENDARIA.Format.ApproxTime.Evening', icon: 'fa-cloud-moon' }
};

/** @enum {string} Condition field identifiers for the unified condition engine. */
export const CONDITION_FIELDS = {
  COMPUTED: 'computed',
  CYCLE: 'cycle',
  DATE: 'date',
  DAY_OF_YEAR: 'dayOfYear',
  DAY: 'day',
  DAYS_BEFORE_MONTH_END: 'daysBeforeMonthEnd',
  ECLIPSE: 'eclipse',
  EPOCH: 'epoch',
  ERA_YEAR: 'eraYear',
  ERA: 'era',
  EVENT: 'event',
  INTERCALARY: 'intercalary',
  INVERSE_WEEK_NUMBER: 'inverseWeekNumber',
  IS_AUTUMN_EQUINOX: 'isAutumnEquinox',
  IS_ECLIPSE: 'isEclipse',
  IS_LEAP_YEAR: 'isLeapYear',
  IS_LONGEST_DAY: 'isLongestDay',
  IS_LUNAR_ECLIPSE: 'isLunarEclipse',
  IS_SHORTEST_DAY: 'isShortestDay',
  IS_SOLAR_ECLIPSE: 'isSolarEclipse',
  IS_SPRING_EQUINOX: 'isSpringEquinox',
  MONTH: 'month',
  MOON_PHASE_COUNT_MONTH: 'moonPhaseCountMonth',
  MOON_PHASE_COUNT_EPOCH: 'moonPhaseCountEpoch',
  MOON_PHASE_COUNT_YEAR: 'moonPhaseCountYear',
  MOON_PHASE_INDEX: 'moonPhaseIndex',
  MOON_PHASE: 'moonPhase',
  MOON_SUB_PHASE: 'moonSubPhase',
  RANDOM: 'random',
  SEASON_DAY: 'seasonDay',
  SEASON_PERCENT: 'seasonPercent',
  SEASON: 'season',
  TOTAL_WEEK: 'totalWeek',
  WEATHER: 'weather',
  WEEK_IN_MONTH: 'weekInMonth',
  WEEK_IN_YEAR: 'weekInYear',
  WEEK_NUMBER_IN_MONTH: 'weekNumberInMonth',
  WEEKDAY: 'weekday',
  WEEKS_BEFORE_MONTH_END: 'weeksBeforeMonthEnd',
  WEEKS_BEFORE_YEAR_END: 'weeksBeforeYearEnd',
  YEAR: 'year'
};

/** @enum {string} Condition operator identifiers for the unified condition engine. */
export const CONDITION_OPERATORS = {
  DAYS_AGO: 'daysAgo',
  DAYS_FROM_NOW: 'daysFromNow',
  EQUAL: '==',
  GREATER_EQUAL: '>=',
  GREATER: '>',
  LESS_EQUAL: '<=',
  LESS: '<',
  MODULO: '%',
  NOT_EQUAL: '!=',
  WITHIN_LAST: 'withinLast',
  WITHIN_NEXT: 'withinNext'
};

/** @enum {string} Condition group boolean modes for nested condition logic. */
export const CONDITION_GROUP_MODES = { AND: 'and', COUNT: 'count', NAND: 'nand', OR: 'or', XOR: 'xor' };

/** @type {number} Maximum allowed nesting depth for condition groups. */
export const MAX_NESTING_DEPTH = 5;

/** @type {number} Density multiplier for reduced weather FX mode. */
export const REDUCED_FX_DENSITY = 0.3;

/** @enum {string} Note display style options. */
export const DISPLAY_STYLES = { BANNER: 'banner', ICON: 'icon', PIP: 'pip' };

/** @enum {string} Note visibility levels. */
export const NOTE_VISIBILITY = { HIDDEN: 'hidden', SECRET: 'secret', VISIBLE: 'visible' };

/** @enum {string} Custom hook names fired by the module */
export const HOOKS = {
  CALENDAR_ADDED: 'calendaria.calendarAdded',
  CALENDAR_REMOVED: 'calendaria.calendarRemoved',
  CALENDAR_SWITCHED: 'calendaria.calendarSwitched',
  CALENDAR_UPDATED: 'calendaria.calendarUpdated',
  CINEMATIC_ABORT: 'calendaria.cinematicAbort',
  CINEMATIC_END: 'calendaria.cinematicEnd',
  CINEMATIC_START: 'calendaria.cinematicStart',
  PRESETS_CHANGED: 'calendaria.presetsChanged',
  CLOCK_START_STOP: 'calendaria.clockStartStop',
  CLOCK_UPDATE: 'calendaria.clockUpdate',
  CONDITION_EVALUATED: 'calendaria.conditionEvaluated',
  DATE_TIME_CHANGE: 'calendaria.dateTimeChange',
  DAY_CHANGE: 'calendaria.dayChange',
  DISPLAY_FORMATS_CHANGED: 'calendaria.displayFormatsChanged',
  EVENT_DAY_CHANGED: 'calendaria.eventDayChanged',
  FOG_RANGE_CHANGED: 'calendaria.fogRangeChanged',
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
  RENDERED: 'calendaria.rendered',
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
  WEATHER_PERIOD_CHANGE: 'calendaria.weatherPeriodChange',
  WIDGET_REGISTERED: 'calendaria.widgetRegistered',
  WIDGETS_REFRESH: 'calendaria.widgetsRefresh',
  WORLD_TIME_UPDATED: 'calendaria.worldTimeUpdated',
  YEAR_CHANGE: 'calendaria.yearChange'
};

/** @enum {string} Journal page type identifiers */
export const JOURNALS = { CALENDAR_NOTE: 'calendaria.calendarnote' };

/** @enum {string} Sheet registration identifiers */
export const SHEETS = { CALENDARIA: 'calendaria' };

/** @enum {string} Socket message types for multiplayer sync */
export const SOCKET_TYPES = {
  BIG_CAL_VISIBILITY: 'bigCalVisibility',
  CALENDAR_REQUEST: 'calendarRequest',
  CHRONICLE_VISIBILITY: 'chronicleVisibility',
  CINEMATIC_ABORT: 'cinematicAbort',
  CINEMATIC_PLAY: 'cinematicPlay',
  CALENDAR_SWITCH: 'calendarSwitch',
  CLOCK_UPDATE: 'clockUpdate',
  CREATE_NOTE_COMPLETE: 'createNoteComplete',
  CREATE_NOTE: 'createNote',
  DATE_CHANGE: 'dateChange',
  HUD_VISIBILITY: 'hudVisibility',
  MINI_CAL_VISIBILITY: 'miniCalVisibility',
  NOTE_UPDATE: 'noteUpdate',
  OWNERSHIP_UPDATE: 'ownershipUpdate',
  REMINDER_NOTIFY: 'reminderNotify',
  STOPWATCH_VISIBILITY: 'stopwatchVisibility',
  SUN_DIAL_VISIBILITY: 'sunDialVisibility',
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
export const REPLACEABLE_ELEMENTS = { CYCLE_INDICATOR: 'cycle-indicator', ERA_INDICATOR: 'era-indicator', SEASON_INDICATOR: 'season-indicator', WEATHER_INDICATOR: 'weather-indicator' };
