/**
 * Calendar Manager
 * Main entry point for calendar system management.
 * Handles calendar initialization, switching, and persistence.
 *
 * @module Calendar/CalendarManager
 * @author Tyler
 */

import { MODULE, SETTINGS, HOOKS } from '../constants.mjs';
import { localize, format } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import CalendarRegistry from './calendar-registry.mjs';
import CalendariaCalendar from './data/calendaria-calendar.mjs';
import { loadBundledCalendars, DEFAULT_CALENDAR, isBundledCalendar } from './calendar-loader.mjs';

export default class CalendarManager {
  /** Flag to prevent responding to our own calendar changes */
  static #isSwitchingCalendar = false;

  /**
   * Initialize the calendar system.
   * Called during module initialization.
   */
  static async initialize() {
    // Load bundled calendars from JSON files
    await loadBundledCalendars();

    // Load any custom calendars from settings
    await this.#loadCustomCalendars();

    // Load any saved calendar state
    await this.loadCalendars();

    // Set active calendar from our setting
    const activeId = game.settings.get(MODULE.ID, SETTINGS.ACTIVE_CALENDAR) || DEFAULT_CALENDAR;
    if (CalendarRegistry.has(activeId)) {
      CalendarRegistry.setActive(activeId);
    } else if (CalendarRegistry.size > 0) {
      // Fallback to first available calendar
      const firstId = CalendarRegistry.getAllIds()[0];
      CalendarRegistry.setActive(firstId);
      log(2, `Active calendar "${activeId}" not found, using "${firstId}"`);
    }

    // Sync game.time.calendar with our active calendar
    const activeCalendar = CalendarRegistry.getActive();
    if (activeCalendar) {
      CONFIG.time.worldCalendarConfig = activeCalendar.toObject();
      CONFIG.time.worldCalendarClass = CalendariaCalendar;
      game.time.initializeCalendar();
      log(3, `Synced game.time.calendar to: ${activeCalendar.name}`);
    }

    log(3, 'Calendar Manager initialized');
  }

  /* -------------------------------------------- */
  /*  Calendar Loading                            */
  /* -------------------------------------------- */

  /**
   * Load calendars from game settings.
   * @private
   */
  static async loadCalendars() {
    try {
      const savedData = game.settings.get(MODULE.ID, SETTINGS.CALENDARS);
      if (savedData) {
        // Migrate saved calendar data to ensure required fields exist
        if (savedData.calendars) {
          for (const calendarData of Object.values(savedData.calendars)) {
            this.#migrateCalendarData(calendarData);
          }
        }
        CalendarRegistry.fromObject(savedData);
        log(3, `Loaded ${CalendarRegistry.size} calendars from settings`);
      }
    } catch (error) {
      log(2, 'Error loading calendars from settings:', error);
    }
  }

  /**
   * Migrate calendar data to ensure required fields exist.
   * @param {object} data - Calendar data to migrate
   * @private
   */
  static #migrateCalendarData(data) {
    // Ensure seasons exists with empty values array (required by Foundry's timeToComponents)
    if (!data.seasons) {
      data.seasons = { values: [] };
      log(3, `Migrated calendar "${data.name}": added missing seasons field`);
    }
    // Ensure months exists
    if (!data.months) {
      data.months = { values: [] };
      log(3, `Migrated calendar "${data.name}": added missing months field`);
    }
  }

  /**
   * Load custom calendars from settings.
   * @private
   */
  static async #loadCustomCalendars() {
    try {
      const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
      const ids = Object.keys(customCalendars);

      if (ids.length === 0) return;

      for (const id of ids) {
        const data = customCalendars[id];
        this.#migrateCalendarData(data);
        try {
          const calendar = new CalendariaCalendar(data);
          CalendarRegistry.register(id, calendar);
          log(3, `Loaded custom calendar: ${id}`);
        } catch (error) {
          log(2, `Error loading custom calendar ${id}:`, error);
        }
      }

      log(3, `Loaded ${ids.length} custom calendars`);
    } catch (error) {
      log(2, 'Error loading custom calendars:', error);
    }
  }

  /**
   * Save calendars to game settings.
   */
  static async saveCalendars() {
    try {
      const data = CalendarRegistry.toObject();
      await game.settings.set(MODULE.ID, SETTINGS.CALENDARS, data);
      log(3, 'Calendars saved to settings');
    } catch (error) {
      log(2, 'Error saving calendars to settings:', error);
    }
  }

  /* -------------------------------------------- */
  /*  Calendar Management                         */
  /* -------------------------------------------- */

  /**
   * Get a calendar by ID.
   * @param {string} id  Calendar ID
   * @returns {CalendariaCalendar|null}
   */
  static getCalendar(id) {
    return CalendarRegistry.get(id);
  }

  /**
   * Get all calendars.
   * @returns {Map<string, CalendariaCalendar>}
   */
  static getAllCalendars() {
    return CalendarRegistry.getAll();
  }

  /**
   * Get the active calendar.
   * @returns {CalendariaCalendar|null}
   */
  static getActiveCalendar() {
    return CalendarRegistry.getActive();
  }

  /**
   * Switch to a different calendar.
   * Uses game.time.initializeCalendar() to switch without reload.
   *
   * @param {string} id  Calendar ID to switch to
   * @returns {Promise<boolean>}  True if calendar was switched
   */
  static async switchCalendar(id) {
    if (!CalendarRegistry.has(id)) {
      log(2, `Cannot switch to calendar: ${id} not found`);
      ui.notifications.error(`Calendar "${id}" not found`);
      return false;
    }

    // Get the calendar
    const calendar = CalendarRegistry.get(id);
    const calendarName = calendar?.name || id;

    // Set as active in registry
    CalendarRegistry.setActive(id);

    // Update CONFIG.time with the new calendar
    CONFIG.time.worldCalendarConfig = calendar.toObject();
    CONFIG.time.worldCalendarClass = CalendariaCalendar;

    // Reinitialize the calendar system - no reload needed!
    game.time.initializeCalendar();

    // Save to our settings
    if (game.user.isGM) {
      try {
        this.#isSwitchingCalendar = true;
        await game.settings.set(MODULE.ID, SETTINGS.ACTIVE_CALENDAR, id);
        log(3, `Updated active calendar setting to: ${id}`);
      } catch (error) {
        log(2, `Error updating active calendar setting:`, error);
      } finally {
        this.#isSwitchingCalendar = false;
      }
    }

    await this.saveCalendars();

    // Emit hook for calendar switch
    Hooks.callAll(HOOKS.CALENDAR_SWITCHED, id, calendar);

    // Re-render all calendar-related UIs
    this.#rerenderCalendarUIs();

    ui.notifications.info(`Switched to ${calendarName} calendar`);
    log(3, `Switched to calendar: ${id}`);

    return true;
  }

  /**
   * Re-render all calendar-related UI applications.
   * @private
   */
  static #rerenderCalendarUIs() {
    // Re-render all open calendar applications
    for (const app of foundry.applications.instances.values()) {
      const name = app.constructor.name;
      if (['CalendariaHUD', 'TimeKeeperHUD', 'CompactCalendar', 'CalendarApplication'].includes(name)) {
        app.render();
      }
    }
  }

  /**
   * Handle a remote calendar switch from another client.
   * Updates the local registry and reinitializes the calendar.
   *
   * @param {string} id  Calendar ID to switch to
   */
  static handleRemoteSwitch(id) {
    if (!CalendarRegistry.has(id)) {
      log(2, `Cannot handle remote switch: calendar ${id} not found`);
      return;
    }

    log(3, `Handling remote calendar switch to: ${id}`);

    // Update local registry
    CalendarRegistry.setActive(id);

    // Get the calendar and update CONFIG.time
    const calendar = CalendarRegistry.get(id);
    CONFIG.time.worldCalendarConfig = calendar.toObject();
    CONFIG.time.worldCalendarClass = CalendariaCalendar;

    // Reinitialize the calendar system
    game.time.initializeCalendar();

    // Notify user
    const calendarName = calendar?.name || id;
    ui.notifications.info(`Calendar switched to ${calendarName} by GM`);

    // Emit hook
    Hooks.callAll(HOOKS.REMOTE_CALENDAR_SWITCH, id, calendar);

    // Re-render all calendar-related UIs
    this.#rerenderCalendarUIs();
  }

  /**
   * Add a new calendar.
   * @param {string} id  Calendar ID
   * @param {object} definition  Calendar definition
   * @returns {Promise<CalendariaCalendar|null>}  The created calendar or null
   */
  static async addCalendar(id, definition) {
    if (CalendarRegistry.has(id)) {
      log(2, `Cannot add calendar: ${id} already exists`);
      ui.notifications.error(`Calendar "${id}" already exists`);
      return null;
    }

    try {
      const calendar = CalendarRegistry.register(id, definition);
      await this.saveCalendars();

      Hooks.callAll(HOOKS.CALENDAR_ADDED, id, calendar);
      log(3, `Added calendar: ${id}`);

      return calendar;
    } catch (error) {
      log(2, `Error adding calendar ${id}:`, error);
      ui.notifications.error(`Error adding calendar: ${error.message}`);
      return null;
    }
  }

  /**
   * Remove a calendar.
   * @param {string} id  Calendar ID
   * @returns {Promise<boolean>}  True if calendar was removed
   */
  static async removeCalendar(id) {
    if (!CalendarRegistry.has(id)) {
      log(2, `Cannot remove calendar: ${id} not found`);
      return false;
    }

    // Don't allow removing the active calendar
    if (CalendarRegistry.getActiveId() === id) {
      log(2, `Cannot remove active calendar: ${id}`);
      ui.notifications.warn('Cannot remove the active calendar');
      return false;
    }

    const removed = CalendarRegistry.unregister(id);
    if (removed) {
      await this.saveCalendars();
      Hooks.callAll(HOOKS.CALENDAR_REMOVED, id);
      log(3, `Removed calendar: ${id}`);
    }

    return removed;
  }

  /* -------------------------------------------- */
  /*  Calendar Utilities                          */
  /* -------------------------------------------- */

  /**
   * Get calendar metadata for UI display.
   * @param {string} id  Calendar ID
   * @returns {object|null}  Calendar metadata
   */
  static getCalendarMetadata(id) {
    const calendar = CalendarRegistry.get(id);
    if (!calendar) return null;

    return {
      id: calendar.metadata?.id ?? id,
      name: calendar.name ? localize(calendar.name) : id,
      description: calendar.metadata?.description ?? '',
      system: calendar.metadata?.system ?? '',
      author: calendar.metadata?.author ?? '',
      isActive: CalendarRegistry.getActiveId() === id
    };
  }

  /**
   * Get metadata for all calendars.
   * @returns {object[]}  Array of calendar metadata
   */
  static getAllCalendarMetadata() {
    const ids = CalendarRegistry.getAllIds();
    return ids.map((id) => this.getCalendarMetadata(id)).filter(Boolean);
  }

  /* -------------------------------------------- */
  /*  Hook Registration                           */
  /* -------------------------------------------- */

  /**
   * Handle updateSetting hook for active calendar changes.
   * @param {object} setting - The setting that was updated
   * @param {object} changes - The changes to the setting
   * @internal
   */
  static onUpdateSetting(setting, changes) {
    if (setting.key === `${MODULE.ID}.${SETTINGS.ACTIVE_CALENDAR}`) {
      const newCalendarId = changes.value;

      // If we triggered this change, skip
      if (this.#isSwitchingCalendar) {
        log(3, 'Active calendar updated (by Calendaria)');
        return;
      }

      // External change - update registry to match
      log(3, 'Active calendar updated (externally)');
      if (newCalendarId && CalendarRegistry.has(newCalendarId)) {
        CalendarRegistry.setActive(newCalendarId);
        const calendar = CalendarRegistry.get(newCalendarId);
        CONFIG.time.worldCalendarConfig = calendar.toObject();
        CONFIG.time.worldCalendarClass = CalendariaCalendar;
        game.time.initializeCalendar();
      }
    }
  }

  /**
   * Handle closeGame hook to save calendars.
   * @internal
   */
  static onCloseGame() {
    if (game.user.isGM) CalendarManager.saveCalendars();
  }

  /* -------------------------------------------- */
  /*  API Methods                                 */
  /* -------------------------------------------- */

  /**
   * Get the current moon phase for the active calendar.
   * @param {number} moonIndex  Index of the moon (0 for primary)
   * @returns {object|null}  Moon phase data
   */
  static getCurrentMoonPhase(moonIndex = 0) {
    const calendar = this.getActiveCalendar();
    if (!calendar || !(calendar instanceof CalendariaCalendar)) return null;
    return calendar.getMoonPhase(moonIndex);
  }

  /**
   * Get all moon phases for the active calendar.
   * @returns {Array<object>}  Array of moon phase data
   */
  static getAllCurrentMoonPhases() {
    const calendar = this.getActiveCalendar();
    if (!calendar || !(calendar instanceof CalendariaCalendar)) return [];
    return calendar.getAllMoonPhases();
  }

  /**
   * Check if the current date is a festival day.
   * @returns {object|null}  Festival data or null
   */
  static getCurrentFestival() {
    const calendar = this.getActiveCalendar();
    if (!calendar || !(calendar instanceof CalendariaCalendar)) return null;
    return calendar.findFestivalDay();
  }

  /**
   * Get the current calendar date and time.
   * Uses game.time.components and applies calendar year offset.
   * @returns {object}  Current date/time object with year, month, day, hour, minute
   */
  static getCurrentDateTime() {
    const components = game.time.components;
    const calendar = this.getActiveCalendar();
    const yearOffset = calendar?.yearZero ?? 0;
    return { year: components.year + yearOffset, month: components.month, day: components.dayOfMonth, hour: components.hour, minute: components.minute };
  }

  /* -------------------------------------------- */
  /*  Custom Calendar Management                  */
  /* -------------------------------------------- */

  /**
   * Create a new custom calendar from a definition.
   * Saves to the CUSTOM_CALENDARS setting and registers in the system.
   *
   * @param {string} id - Unique calendar ID (will be prefixed with 'custom-' if not already)
   * @param {object} definition - Calendar definition object
   * @returns {Promise<CalendariaCalendar|null>} The created calendar or null on error
   */
  static async createCustomCalendar(id, definition) {
    // Ensure ID is prefixed
    const calendarId = id.startsWith('custom-') ? id : `custom-${id}`;

    // Check if already exists in settings (authoritative source)
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    if (customCalendars[calendarId]) {
      log(2, `Cannot create calendar: ${calendarId} already exists`);
      ui.notifications.error(`Calendar "${calendarId}" already exists`);
      return null;
    }

    // Clean up stale registry entry if present
    if (CalendarRegistry.has(calendarId)) {
      log(3, `Cleaning up stale registry entry for: ${calendarId}`);
      CalendarRegistry.unregister(calendarId);
    }

    try {
      // Add metadata if not present
      if (!definition.metadata) definition.metadata = {};
      definition.metadata.id = calendarId;
      definition.metadata.author = definition.metadata.author || game.user.name;
      definition.metadata.isCustom = true;

      // Create calendar instance
      const calendar = new CalendariaCalendar(definition);

      // Save to custom calendars setting (reuse customCalendars from above)
      customCalendars[calendarId] = calendar.toObject();
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, customCalendars);

      // Register in CalendarRegistry
      CalendarRegistry.register(calendarId, calendar);

      Hooks.callAll(HOOKS.CALENDAR_ADDED, calendarId, calendar);
      log(3, `Created custom calendar: ${calendarId}`);
      ui.notifications.info(`Created calendar "${definition.name || calendarId}"`);

      return calendar;
    } catch (error) {
      log(2, `Error creating custom calendar ${calendarId}:`, error);
      ui.notifications.error(`Error creating calendar: ${error.message}`);
      return null;
    }
  }

  /**
   * Update an existing custom calendar.
   *
   * @param {string} id - Calendar ID to update
   * @param {object} changes - Partial definition with changes to apply
   * @returns {Promise<CalendariaCalendar|null>} The updated calendar or null on error
   */
  static async updateCustomCalendar(id, changes) {
    const calendar = CalendarRegistry.get(id);
    if (!calendar) {
      log(2, `Cannot update calendar: ${id} not found`);
      ui.notifications.error(`Calendar "${id}" not found`);
      return null;
    }

    // Check if this is a custom calendar
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    if (!customCalendars[id]) {
      log(2, `Cannot update calendar: ${id} is not a custom calendar`);
      ui.notifications.error('Cannot modify built-in calendars');
      return null;
    }

    try {
      // Merge changes with existing data
      const existingData = calendar.toObject();
      const updatedData = foundry.utils.mergeObject(existingData, changes, { inplace: false });

      // Create new calendar instance
      const updatedCalendar = new CalendariaCalendar(updatedData);

      // Update in settings
      customCalendars[id] = updatedCalendar.toObject();
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, customCalendars);

      // Update in registry
      CalendarRegistry.register(id, updatedCalendar);

      // If this is the active calendar, reinitialize
      if (CalendarRegistry.getActiveId() === id) {
        CONFIG.time.worldCalendarConfig = updatedCalendar.toObject();
        game.time.initializeCalendar();
      }

      Hooks.callAll(HOOKS.CALENDAR_UPDATED, id, updatedCalendar);
      log(3, `Updated custom calendar: ${id}`);
      ui.notifications.info(`Updated calendar "${updatedData.name || id}"`);

      return updatedCalendar;
    } catch (error) {
      log(2, `Error updating custom calendar ${id}:`, error);
      ui.notifications.error(`Error updating calendar: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete a custom calendar.
   *
   * @param {string} id - Calendar ID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async deleteCustomCalendar(id) {
    // Check if this is a custom calendar
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    if (!customCalendars[id]) {
      log(2, `Cannot delete calendar: ${id} is not a custom calendar`);
      ui.notifications.error('Cannot delete built-in calendars');
      return false;
    }

    // Don't allow deleting the active calendar
    if (CalendarRegistry.getActiveId() === id) {
      log(2, `Cannot delete active calendar: ${id}`);
      ui.notifications.warn('Cannot delete the active calendar. Switch to a different calendar first.');
      return false;
    }

    try {
      // Remove from settings
      delete customCalendars[id];
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, customCalendars);

      // Remove from registry
      CalendarRegistry.unregister(id);

      Hooks.callAll(HOOKS.CALENDAR_REMOVED, id);
      log(3, `Deleted custom calendar: ${id}`);
      ui.notifications.info(`Deleted calendar "${id}"`);

      return true;
    } catch (error) {
      log(2, `Error deleting custom calendar ${id}:`, error);
      ui.notifications.error(`Error deleting calendar: ${error.message}`);
      return false;
    }
  }

  /**
   * Get available calendar templates for "Start from..." feature.
   * Returns all registered calendars that can be used as templates.
   *
   * @returns {Array<{id: string, name: string, description: string}>}
   */
  static getCalendarTemplates() {
    const templates = [];

    // Add all registered calendars as templates
    for (const [id, calendar] of CalendarRegistry.getAll()) {
      templates.push({ id, name: calendar.name || id, description: calendar.metadata?.description || '', isCustom: calendar.metadata?.isCustom || false });
    }

    return templates;
  }

  /**
   * Duplicate an existing calendar as a starting point for a new custom calendar.
   *
   * @param {string} sourceId - ID of calendar to duplicate
   * @param {string} newId - ID for the new calendar
   * @param {string} [newName] - Name for the new calendar
   * @returns {Promise<CalendariaCalendar|null>} The new calendar or null on error
   */
  static async duplicateCalendar(sourceId, newId, newName) {
    const sourceCalendar = CalendarRegistry.get(sourceId);
    if (!sourceCalendar) {
      log(2, `Cannot duplicate calendar: ${sourceId} not found`);
      ui.notifications.error(`Calendar "${sourceId}" not found`);
      return null;
    }

    // Get source data and modify for new calendar
    const newData = sourceCalendar.toObject();
    newData.name = newName || `Copy of ${sourceCalendar.name || sourceId}`;
    if (newData.metadata) {
      delete newData.metadata.id;
      delete newData.metadata.author;
      delete newData.metadata.isCustom;
    }

    return this.createCustomCalendar(newId, newData);
  }

  /**
   * Check if a calendar is a custom calendar (user-created).
   *
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar is custom
   */
  static isCustomCalendar(id) {
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    return !!customCalendars[id];
  }

  /* -------------------------------------------- */
  /*  Bundled Calendar Override Management        */
  /* -------------------------------------------- */

  /**
   * Check if a calendar is a bundled (built-in) calendar.
   *
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar is a bundled calendar
   */
  static isBundledCalendar(id) {
    return isBundledCalendar(id) && !this.isCustomCalendar(id);
  }

  /**
   * Check if a bundled calendar has a user override.
   *
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar has an override
   */
  static hasDefaultOverride(id) {
    const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
    return !!overrides[id];
  }

  /**
   * Save a user override for a bundled calendar.
   *
   * @param {string} id - Calendar ID to override
   * @param {object} data - Full calendar data to save as override
   * @returns {Promise<CalendariaCalendar|null>} The updated calendar or null on error
   */
  static async saveDefaultOverride(id, data) {
    if (!this.isBundledCalendar(id) && !this.hasDefaultOverride(id)) {
      log(2, `Cannot save override: ${id} is not a bundled calendar`);
      return null;
    }

    try {
      // Ensure metadata is present
      if (!data.metadata) data.metadata = {};
      data.metadata.id = id;
      data.metadata.hasOverride = true;

      // Create calendar instance
      const calendar = new CalendariaCalendar(data);

      // Save to overrides setting
      const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
      overrides[id] = calendar.toObject();
      await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES, overrides);

      // Update in registry
      CalendarRegistry.register(id, calendar);

      // Update game.time.calendar if this is the active calendar
      if (CalendarRegistry.getActiveId() === id) {
        CONFIG.time.worldCalendarConfig = calendar.toObject();
        game.time.initializeCalendar();
      }

      Hooks.callAll(HOOKS.CALENDAR_UPDATED, id, calendar);
      log(3, `Saved override for bundled calendar: ${id}`);
      ui.notifications.info(format('CALENDARIA.Editor.SaveSuccess', { name: data.name || id }));

      return calendar;
    } catch (error) {
      log(2, `Error saving override for ${id}:`, error);
      ui.notifications.error(`Error saving calendar: ${error.message}`);
      return null;
    }
  }

  /**
   * Reset a bundled calendar to its original state by removing the override.
   *
   * @param {string} id - Calendar ID to reset
   * @returns {Promise<boolean>} True if reset successfully
   */
  static async resetDefaultCalendar(id) {
    if (!this.hasDefaultOverride(id)) {
      log(2, `Cannot reset: ${id} has no override`);
      return false;
    }

    try {
      // Remove from overrides
      const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
      delete overrides[id];
      await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES, overrides);

      // Reload the calendar from bundled JSON
      const path = `modules/${MODULE.ID}/calendars/${id}.json`;
      const response = await fetch(path);
      if (response.ok) {
        const calendarData = await response.json();
        const calendar = new CalendariaCalendar(calendarData);
        CalendarRegistry.register(id, calendar);

        // Update game.time.calendar if this is the active calendar
        if (CalendarRegistry.getActiveId() === id) {
          CONFIG.time.worldCalendarConfig = calendar.toObject();
          game.time.initializeCalendar();
        }

        Hooks.callAll(HOOKS.CALENDAR_UPDATED, id, calendar);
      }

      log(3, `Reset bundled calendar: ${id}`);
      ui.notifications.info(localize('CALENDARIA.Editor.ResetComplete'));
      return true;
    } catch (error) {
      log(2, `Error resetting bundled calendar ${id}:`, error);
      return false;
    }
  }
}
