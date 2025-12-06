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
  CUSTOM_CALENDARS: 'customCalendars'
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
  SETTINGS: {
    /** @type {string} Reset position dialog template */
    RESET_POSITION: `modules/${MODULE.ID}/templates/settings/reset-position.hbs`
  },

  /** @type {string} Time rotation dial template */
  TIME_DIAL: `modules/${MODULE.ID}/templates/time-dial.hbs`,

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
    CALENDAR_NOTE_FORM: `modules/${MODULE.ID}/templates/sheets/calendar-note-form.hbs`
  },

  EDITOR: {
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
    /** @type {string} Calendar editor moons tab */
    TAB_MOONS: `modules/${MODULE.ID}/templates/editor/tab-moons.hbs`,
    /** @type {string} Calendar editor festivals tab */
    TAB_FESTIVALS: `modules/${MODULE.ID}/templates/editor/tab-festivals.hbs`
  }
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
 * @typedef {Object} HookNames
 * @property {string} CALENDAR_SWITCHED - Fired when the active calendar is switched locally
 * @property {string} REMOTE_CALENDAR_SWITCH - Fired when a remote calendar switch is received
 * @property {string} CALENDAR_ADDED - Fired when a new calendar is added to the registry
 * @property {string} CALENDAR_REMOVED - Fired when a calendar is removed from the registry
 * @property {string} REMOTE_DATE_CHANGE - Fired when a remote date/time change is received
 * @property {string} NOTE_CREATED - Fired when a calendar note is created
 * @property {string} NOTE_UPDATED - Fired when a calendar note is updated
 * @property {string} NOTE_DELETED - Fired when a calendar note is deleted
 */

/**
 * Custom Calendaria hook names.
 * These hooks are fired by the module and can be listened to by other modules and macros.
 *
 * @type {HookNames}
 */
export const HOOKS = {
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

  /** @type {string} Fired when a remote date/time change is received */
  REMOTE_DATE_CHANGE: 'calendaria.remoteDateChange',

  /** @type {string} Fired when a calendar note is created */
  NOTE_CREATED: 'calendaria.noteCreated',

  /** @type {string} Fired when a calendar note is updated */
  NOTE_UPDATED: 'calendaria.noteUpdated',

  /** @type {string} Fired when a calendar note is deleted */
  NOTE_DELETED: 'calendaria.noteDeleted',

  /** @type {string} Fired when sunrise occurs */
  SUNRISE: 'calendaria.sunrise',

  /** @type {string} Fired when sunset occurs */
  SUNSET: 'calendaria.sunset',

  /** @type {string} Fired when midnight passes */
  MIDNIGHT: 'calendaria.midnight',

  /** @type {string} Fired when midday passes */
  MIDDAY: 'calendaria.midday'
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
  CALENDAR_SWITCH: 'calendarSwitch'
};
