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
  CALENDARS: 'calendars'
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
  }
};
