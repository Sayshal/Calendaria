/**
 * Core module constants, identifiers, and configuration for the Calendaria module.
 *
 * This module contains all central configuration constants including module identification,
 * settings keys, default configurations, and enums. It serves as the authoritative source
 * for all module-wide constants and default values.
 *
 * @module Constants
 * @author Tyler
 */

/**
 * Module identification and configuration constants.
 * Contains all core module settings, identifiers, and default configurations.
 *
 * @typedef {Object} ModuleConfig
 * @property {string} ID - The module identifier for Foundry VTT
 * @property {string} TITLE - Human-readable module title
 * @property {number} LOG_LEVEL - Current logging level (0=off, 1=error, 2=warn, 3=debug)
 */

/**
 * Core module identification and configuration constants.
 * Contains all module-wide settings, identifiers, and default configurations.
 *
 * @type {ModuleConfig}
 */
export const MODULE = {
  /** @type {string} Foundry VTT module identifier */
  ID: 'calendaria',

  /** @type {string} Human-readable module title */
  TITLE: 'Calendaria',

  /** @type {number} Current logging level (0=off, 1=error, 2=warn, 3=debug) */
  LOG_LEVEL: 0
};

/**
 * Settings keys used by the module for Foundry VTT game settings.
 * Each key corresponds to a registered setting that can be configured by users.
 *
 * @typedef {Object} SettingsKeys
 * @property {string} LOGGING_LEVEL - Module logging level for debugging
 * @property {string} CALENDAR_POSITION - Saved position of the draggable calendar
 * @property {string} DARKNESS_SYNC - Default setting for syncing scene darkness with sun position
 * @property {string} CALENDARS - Stored calendar configurations and active calendar
 * @property {string} PRIMARY_GM - Override for which user ID is the primary GM for sync operations
 */

/**
 * Settings keys used by the module for Foundry VTT game settings.
 * Each key corresponds to a registered setting that can be configured by users.
 *
 * @type {SettingsKeys}
 */
export const SETTINGS = {
  /** @type {string} Module logging level for debugging */
  LOGGING_LEVEL: 'loggingLevel',

  /** @type {string} Saved position of the draggable calendar */
  CALENDAR_POSITION: 'calendarPosition',

  /** @type {string} Default setting for syncing scene darkness with sun position */
  DARKNESS_SYNC: 'darknessSync',

  /** @type {string} Stored calendar configurations and active calendar */
  CALENDARS: 'calendars',

  /** @type {string} Override for which user ID is the primary GM for sync operations */
  PRIMARY_GM: 'primaryGM',

  /** @type {string} User-created custom calendar definitions */
  CUSTOM_CALENDARS: 'customCalendars',

  /** @type {string} User overrides for default/built-in calendars */
  DEFAULT_OVERRIDES: 'defaultOverrides',

  /** @type {string} Whether the calendar HUD position is locked */
  POSITION_LOCKED: 'positionLocked',

  /** @type {string} User-created custom note categories */
  CUSTOM_CATEGORIES: 'customCategories',

  /** @type {string} Whether to show moon phases on the calendar UI */
  SHOW_MOON_PHASES: 'showMoonPhases',

  /** @type {string} Whether to advance time during short/long rests (dnd5e only) */
  ADVANCE_TIME_ON_REST: 'advanceTimeOnRest',

  /** @type {string} User-customized theme color overrides */
  CUSTOM_THEME_COLORS: 'customThemeColors',

  /** @type {string} Whether to show TimeKeeper HUD on world load */
  SHOW_TIME_KEEPER: 'showTimeKeeper',

  /** @type {string} Whether to show Compact Calendar on world load */
  SHOW_COMPACT_CALENDAR: 'showCompactCalendar',

  /** @type {string} Whether to advance time when combat rounds change */
  ADVANCE_TIME_ON_COMBAT: 'advanceTimeOnCombat',

  /** @type {string} Saved position of the compact calendar */
  COMPACT_CALENDAR_POSITION: 'compactCalendarPosition',

  /** @type {string} Delay in seconds before auto-hiding compact calendar controls */
  COMPACT_CONTROLS_DELAY: 'compactControlsDelay',

  /** @type {string} Sticky states for compact calendar (time controls, sidebar, position) */
  COMPACT_STICKY_STATES: 'compactStickyStates',

  /** @type {string} Dev mode - allows deletion of calendar note journals */
  DEV_MODE: 'devMode',

  /* -------------------------------------------- */
  /*  Weather Settings                            */
  /* -------------------------------------------- */

  /** @type {string} Current weather state */
  CURRENT_WEATHER: 'currentWeather',

  /** @type {string} Custom weather presets created by the GM */
  CUSTOM_WEATHER_PRESETS: 'customWeatherPresets',

  /** @type {string} Temperature unit preference (celsius or fahrenheit) */
  TEMPERATURE_UNIT: 'temperatureUnit',

  /* -------------------------------------------- */
  /*  Macro Triggers                              */
  /* -------------------------------------------- */

  /** @type {string} Macro trigger configuration object */
  MACRO_TRIGGERS: 'macroTriggers'
};

/**
 * Scene flags used by the module for scene-specific configuration.
 *
 * @typedef {Object} SceneFlags
 * @property {string} DARKNESS_SYNC - Override for darkness sync behavior on this scene
 */

/**
 * Scene flags used by the module for scene-specific configuration.
 *
 * @type {SceneFlags}
 */
export const SCENE_FLAGS = {
  /** @type {string} Override for darkness sync behavior on this scene */
  DARKNESS_SYNC: 'darknessSync'
};

/**
 * Template file paths used by the module for rendering UI components.
 *
 * @typedef {Object} TemplateKeys
 * @property {Object} SETTINGS - Settings-related templates
 * @property {string} SETTINGS.RESET_POSITION - Reset position dialog template
 * @property {string} TIME_DIAL - Time rotation dial template
 */

/**
 * Template file paths used by the module for rendering UI components.
 *
 * @type {TemplateKeys}
 */
export const TEMPLATES = {
  /** @type {string} Foundry generic form footer template */
  FORM_FOOTER: 'templates/generic/form-footer.hbs',

  SETTINGS: {
    /** @type {string} Reset position dialog template */
    RESET_POSITION: `modules/${MODULE.ID}/templates/settings/reset-position.hbs`,
    /** @type {string} Theme editor template */
    THEME_EDITOR: `modules/${MODULE.ID}/templates/settings/theme-editor.hbs`,
    /** @type {string} Macro trigger configuration template */
    MACRO_TRIGGER_CONFIG: `modules/${MODULE.ID}/templates/settings/macro-trigger-config.hbs`
  },

  /** @type {string} Time rotation dial template */
  TIME_DIAL: `modules/${MODULE.ID}/templates/time-dial.hbs`,

  /** @type {string} TimeKeeper HUD template */
  TIME_KEEPER_HUD: `modules/${MODULE.ID}/templates/time-keeper-hud.hbs`,

  /** @type {string} Compact calendar template */
  COMPACT_CALENDAR: `modules/${MODULE.ID}/templates/compact-calendar.hbs`,

  SHEETS: {
    /** @type {string} Calendar sheet header template */
    CALENDAR_HEADER: `modules/${MODULE.ID}/templates/sheets/calendar-header.hbs`,
    /** @type {string} Calendar sheet grid template */
    CALENDAR_GRID: `modules/${MODULE.ID}/templates/sheets/calendar-grid.hbs`,
    /** @type {string} Calendar sheet content wrapper template */
    CALENDAR_CONTENT: `modules/${MODULE.ID}/templates/sheets/calendar-content.hbs`,
    /** @type {string} Calendar week view template */
    CALENDAR_WEEK: `modules/${MODULE.ID}/templates/sheets/calendar-week.hbs`,
    /** @type {string} Calendar year view template */
    CALENDAR_YEAR: `modules/${MODULE.ID}/templates/sheets/calendar-year.hbs`,
    /** @type {string} Calendar note form template */
    CALENDAR_NOTE_FORM: `modules/${MODULE.ID}/templates/sheets/calendar-note-form.hbs`,
    /** @type {string} Calendar note view template */
    CALENDAR_NOTE_VIEW: `modules/${MODULE.ID}/templates/sheets/calendar-note-view.hbs`
  },

  EDITOR: {
    /** @type {string} Calendar editor tab navigation */
    TAB_NAVIGATION: `modules/${MODULE.ID}/templates/editor/tab-navigation.hbs`,
    /** @type {string} Calendar editor basic info tab */
    TAB_BASIC: `modules/${MODULE.ID}/templates/editor/tab-basic.hbs`,
    /** @type {string} Calendar editor months tab */
    TAB_MONTHS: `modules/${MODULE.ID}/templates/editor/tab-months.hbs`,
    /** @type {string} Calendar editor weekdays tab */
    TAB_WEEKDAYS: `modules/${MODULE.ID}/templates/editor/tab-weekdays.hbs`,
    /** @type {string} Calendar editor time tab */
    TAB_TIME: `modules/${MODULE.ID}/templates/editor/tab-time.hbs`,
    /** @type {string} Calendar editor seasons tab */
    TAB_SEASONS: `modules/${MODULE.ID}/templates/editor/tab-seasons.hbs`,
    /** @type {string} Calendar editor eras tab */
    TAB_ERAS: `modules/${MODULE.ID}/templates/editor/tab-eras.hbs`,
    /** @type {string} Calendar editor moons tab */
    TAB_MOONS: `modules/${MODULE.ID}/templates/editor/tab-moons.hbs`,
    /** @type {string} Calendar editor festivals tab */
    TAB_FESTIVALS: `modules/${MODULE.ID}/templates/editor/tab-festivals.hbs`,
    /** @type {string} Calendar editor cycles tab */
    TAB_CYCLES: `modules/${MODULE.ID}/templates/editor/tab-cycles.hbs`,
    /** @type {string} Calendar editor weather tab */
    TAB_WEATHER: `modules/${MODULE.ID}/templates/editor/tab-weather.hbs`
  },

  IMPORTER: {
    /** @type {string} Main importer application template */
    APP: `modules/${MODULE.ID}/templates/importers/importer-app.hbs`
  },

  WEATHER: {
    /** @type {string} Weather picker template */
    PICKER: `modules/${MODULE.ID}/templates/weather/weather-picker.hbs`
  }
};

/**
 * Asset paths used by the module.
 * @type {Object}
 */
export const ASSETS = {
  /** @type {string} Base path for moon phase icons */
  MOON_ICONS: `modules/${MODULE.ID}/assets/moon-phases`
};

/**
 * System utilities and helpers.
 * Provides convenient access to system-specific checks and integrations.
 *
 * @type {Object}
 */
export const SYSTEM = {
  /**
   * Get the current game system.
   * @returns {System} The current Foundry VTT system
   */
  get current() {
    return game.system;
  },

  /**
   * Check if the current system is D&D 5e.
   * @returns {boolean} True if running on dnd5e system
   */
  get isDnd5e() {
    return game.system?.id === 'dnd5e';
  }
};

/**
 * Custom Calendaria hook names fired by the module.
 * Other modules and macros can listen for these hooks to respond to Calendaria events.
 *
 * ## Lifecycle Hooks
 * - `calendaria.init` - Fired when Calendaria starts initializing
 * - `calendaria.ready` - Fired when Calendaria is fully initialized and ready
 *
 * ## Calendar Hooks
 * - `calendaria.calendarSwitched` - Fired when the active calendar is switched locally
 * - `calendaria.remoteCalendarSwitch` - Fired when a remote calendar switch is received
 * - `calendaria.calendarAdded` - Fired when a new calendar is added
 * - `calendaria.calendarUpdated` - Fired when an existing calendar is updated
 * - `calendaria.calendarRemoved` - Fired when a calendar is removed
 *
 * ## Time Hooks
 * - `calendaria.dateTimeChange` - Fired on ANY date/time change (most commonly used)
 * - `calendaria.dayChange` - Fired when the day changes
 * - `calendaria.monthChange` - Fired when the month changes
 * - `calendaria.yearChange` - Fired when the year changes
 * - `calendaria.seasonChange` - Fired when the season changes
 * - `calendaria.clockStartStop` - Fired when real-time clock starts or stops
 *
 * ## Time-of-Day Hooks
 * - `calendaria.sunrise` - Fired when sunrise occurs
 * - `calendaria.sunset` - Fired when sunset occurs
 * - `calendaria.midnight` - Fired when midnight passes
 * - `calendaria.midday` - Fired when midday passes
 *
 * ## Note Hooks
 * - `calendaria.noteCreated` - Fired when a calendar note is created
 * - `calendaria.noteUpdated` - Fired when a calendar note is updated
 * - `calendaria.noteDeleted` - Fired when a calendar note is deleted
 * - `calendaria.eventTriggered` - Fired when an event's start time is reached
 *
 * @example
 * // Listen for any date/time change
 * Hooks.on('calendaria.dateTimeChange', (data) => {
 *   console.log('Time changed:', data.current, 'Delta:', data.diff);
 * });
 *
 * // Listen for day changes only
 * Hooks.on('calendaria.dayChange', (data) => {
 *   console.log('New day:', data.current.dayOfMonth);
 * });
 *
 * // Listen for note creation
 * Hooks.on('calendaria.noteCreated', (noteStub) => {
 *   console.log('Note created:', noteStub.name);
 * });
 */

/**
 * Custom Calendaria hook names.
 * These hooks are fired by the module and can be listened to by other modules and macros.
 */
export const HOOKS = {
  /* -------------------------------------------- */
  /*  Lifecycle Hooks                             */
  /* -------------------------------------------- */

  /** @type {string} Fired when Calendaria starts initializing (before ready) */
  INIT: 'calendaria.init',

  /** @type {string} Fired when Calendaria is fully initialized and ready to use */
  READY: 'calendaria.ready',

  /* -------------------------------------------- */
  /*  Calendar Hooks                              */
  /* -------------------------------------------- */

  /** @type {string} Fired when the active calendar is switched locally */
  CALENDAR_SWITCHED: 'calendaria.calendarSwitched',

  /** @type {string} Fired when a remote calendar switch is received */
  REMOTE_CALENDAR_SWITCH: 'calendaria.remoteCalendarSwitch',

  /** @type {string} Fired when a new calendar is added to the registry */
  CALENDAR_ADDED: 'calendaria.calendarAdded',

  /** @type {string} Fired when an existing calendar is updated */
  CALENDAR_UPDATED: 'calendaria.calendarUpdated',

  /** @type {string} Fired when a calendar is removed from the registry */
  CALENDAR_REMOVED: 'calendaria.calendarRemoved',

  /* -------------------------------------------- */
  /*  Date/Time Change Hooks                      */
  /* -------------------------------------------- */

  /**
   * Fired whenever the world time changes. This is the primary hook for tracking time.
   * Passes: { previous: TimeComponents, current: TimeComponents, diff: number, calendar: Calendar }
   */
  DATE_TIME_CHANGE: 'calendaria.dateTimeChange',

  /** @type {string} Fired when the day changes (new day begins) */
  DAY_CHANGE: 'calendaria.dayChange',

  /** @type {string} Fired when the month changes */
  MONTH_CHANGE: 'calendaria.monthChange',

  /** @type {string} Fired when the year changes */
  YEAR_CHANGE: 'calendaria.yearChange',

  /** @type {string} Fired when the season changes */
  SEASON_CHANGE: 'calendaria.seasonChange',

  /** @type {string} Fired when a remote date/time change is received */
  REMOTE_DATE_CHANGE: 'calendaria.remoteDateChange',

  /* -------------------------------------------- */
  /*  Time-of-Day Hooks                           */
  /* -------------------------------------------- */

  /** @type {string} Fired when sunrise occurs */
  SUNRISE: 'calendaria.sunrise',

  /** @type {string} Fired when sunset occurs */
  SUNSET: 'calendaria.sunset',

  /** @type {string} Fired when midnight passes */
  MIDNIGHT: 'calendaria.midnight',

  /** @type {string} Fired when midday passes */
  MIDDAY: 'calendaria.midday',

  /** @type {string} Fired when any moon's phase changes */
  MOON_PHASE_CHANGE: 'calendaria.moonPhaseChange',

  /* -------------------------------------------- */
  /*  Clock Hooks                                 */
  /* -------------------------------------------- */

  /** @type {string} Fired when real-time clock state changes (running/stopped) */
  CLOCK_START_STOP: 'calendaria.clockStartStop',

  /** @type {string} Fired on each real-time clock tick (if clock is running) */
  CLOCK_UPDATE: 'calendaria.clockUpdate',

  /* -------------------------------------------- */
  /*  Note/Event Hooks                            */
  /* -------------------------------------------- */

  /** @type {string} Fired when a calendar note is created */
  NOTE_CREATED: 'calendaria.noteCreated',

  /** @type {string} Fired when a calendar note is updated */
  NOTE_UPDATED: 'calendaria.noteUpdated',

  /** @type {string} Fired when a calendar note is deleted */
  NOTE_DELETED: 'calendaria.noteDeleted',

  /** @type {string} Fired when an event/note triggers (time reached its start date) */
  EVENT_TRIGGERED: 'calendaria.eventTriggered',

  /** @type {string} Fired when a multi-day event starts a new day */
  EVENT_DAY_CHANGED: 'calendaria.eventDayChanged',

  /* -------------------------------------------- */
  /*  UI Hooks                                    */
  /* -------------------------------------------- */

  /** @type {string} Fired before the calendar UI renders */
  PRE_RENDER_CALENDAR: 'calendaria.preRenderCalendar',

  /** @type {string} Fired after the calendar UI renders */
  RENDER_CALENDAR: 'calendaria.renderCalendar',

  /* -------------------------------------------- */
  /*  Importer Hooks                              */
  /* -------------------------------------------- */

  /** @type {string} Fired when an import operation starts */
  IMPORT_STARTED: 'calendaria.importStarted',

  /** @type {string} Fired when an import operation completes successfully */
  IMPORT_COMPLETE: 'calendaria.importComplete',

  /** @type {string} Fired when an import operation fails */
  IMPORT_FAILED: 'calendaria.importFailed',

  /* -------------------------------------------- */
  /*  Weather Hooks                               */
  /* -------------------------------------------- */

  /** @type {string} Fired when weather changes */
  WEATHER_CHANGE: 'calendaria.weatherChange'
};

/**
 * Journal page type identifiers used by the module.
 *
 * @typedef {Object} JournalTypes
 * @property {string} CALENDAR_NOTE - Calendar note journal page type
 */

/**
 * Journal page type identifiers.
 * These are used for registering and identifying custom journal page types.
 *
 * @type {JournalTypes}
 */
export const JOURNAL_TYPES = {
  /** @type {string} Calendar note journal page type */
  CALENDAR_NOTE: 'calendaria.calendarnote'
};

/**
 * Sheet registration identifiers used by the module.
 *
 * @typedef {Object} SheetIds
 * @property {string} CALENDARIA - Main sheet registration ID
 */

/**
 * Sheet registration identifiers.
 * These are used when registering custom document sheets with Foundry.
 *
 * @type {SheetIds}
 */
export const SHEET_IDS = {
  /** @type {string} Main sheet registration ID for Calendaria sheets */
  CALENDARIA: 'calendaria'
};

/**
 * Socket message types for multiplayer synchronization.
 *
 * @typedef {Object} SocketTypes
 * @property {string} CLOCK_UPDATE - Clock/time update message
 * @property {string} DATE_CHANGE - Date change message
 * @property {string} NOTE_UPDATE - Note update message
 * @property {string} CALENDAR_SWITCH - Calendar switch message
 */

/**
 * Socket message types for multiplayer synchronization.
 * These define the different types of messages sent over the socket for syncing.
 *
 * @type {SocketTypes}
 */
export const SOCKET_TYPES = {
  /** @type {string} Clock/time update message */
  CLOCK_UPDATE: 'clockUpdate',

  /** @type {string} Date change message */
  DATE_CHANGE: 'dateChange',

  /** @type {string} Note update message */
  NOTE_UPDATE: 'noteUpdate',

  /** @type {string} Calendar switch message */
  CALENDAR_SWITCH: 'calendarSwitch',

  /** @type {string} Weather change message */
  WEATHER_CHANGE: 'weatherChange'
};
