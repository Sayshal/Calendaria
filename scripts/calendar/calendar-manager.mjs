/**
 * Calendar Manager
 * Main entry point for calendar system management.
 * Handles calendar initialization, switching, and persistence.
 * @module Calendar/CalendarManager
 * @author Tyler
 */

import { HOOKS, MODULE, SETTINGS } from '../constants.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { DEFAULT_CALENDAR, isBundledCalendar, loadBundledCalendars } from './calendar-loader.mjs';
import CalendarRegistry from './calendar-registry.mjs';
import CalendariaCalendar from './data/calendaria-calendar.mjs';

/**
 * Main entry point for calendar system management.
 */
export default class CalendarManager {
  /** Flag to prevent responding to our own calendar changes */
  static #isSwitchingCalendar = false;

  /**
   * Initialize the calendar system.
   * Called during module initialization.
   */
  static async initialize() {
    await loadBundledCalendars();
    await this.#loadDefaultOverrides();
    await this.#loadCustomCalendars();
    await this.loadCalendars();
    const activeId = game.settings.get(MODULE.ID, SETTINGS.ACTIVE_CALENDAR) || DEFAULT_CALENDAR;
    if (CalendarRegistry.has(activeId)) {
      CalendarRegistry.setActive(activeId);
    } else if (CalendarRegistry.size > 0) {
      const firstId = CalendarRegistry.getAllIds()[0];
      CalendarRegistry.setActive(firstId);
      log(2, `Active calendar "${activeId}" not found, using "${firstId}"`);
    }

    const activeCalendar = CalendarRegistry.getActive();
    if (activeCalendar) {
      CalendariaCalendar.initializeEpochOffset();
      CONFIG.time.worldCalendarConfig = activeCalendar.toObject();
      CONFIG.time.worldCalendarClass = CalendariaCalendar;
      CONFIG.time.roundTime = activeCalendar.secondsPerRound ?? 6;
      if (CalendariaCalendar.correctFirstWeekday !== null && CONFIG.time.worldCalendarConfig.years) CONFIG.time.worldCalendarConfig.years.firstWeekday = CalendariaCalendar.correctFirstWeekday;
      game.time.initializeCalendar();
      log(3, `Synced game.time.calendar to: ${activeCalendar.name} (roundTime: ${CONFIG.time.roundTime}s)`);
    }

    log(3, 'Calendar Manager initialized');
  }

  /**
   * Load calendars from game settings.
   * @private
   */
  static async loadCalendars() {
    try {
      const savedData = game.settings.get(MODULE.ID, SETTINGS.CALENDARS);
      const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
      const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
      if (savedData?.calendars && Object.keys(savedData.calendars).length > 0) {
        let count = 0;
        for (const [id, calendarData] of Object.entries(savedData.calendars)) {
          // Skip calendars already loaded from dedicated settings
          if (overrides[id] || customCalendars[id]) continue;
          this.#migrateCalendarData(calendarData);
          // Preserve isCustom flag from existing calendar if present
          const existing = CalendarRegistry.get(id);
          if (existing?.metadata?.isCustom) {
            calendarData.metadata = calendarData.metadata || {};
            calendarData.metadata.isCustom = true;
          }
          CalendarRegistry.register(id, calendarData);
          count++;
        }
        log(3, `Merged ${count} calendars from settings (total: ${CalendarRegistry.size})`);
      }
    } catch (error) {
      log(1, 'Error loading calendars from settings:', error);
    }
  }

  /**
   * Migrate calendar data to ensure required fields exist.
   * @param {object} data - Calendar data to migrate
   * @private
   */
  static #migrateCalendarData(data) {
    const added = [];
    if (!data.seasons) { data.seasons = { values: [] }; added.push('seasons'); }
    if (!data.months) { data.months = { values: [] }; added.push('months'); }
    if (added.length) log(3, `Migrated calendar "${data.name}": added missing fields: ${added.join(', ')}`);
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
          log(1, `Error loading custom calendar ${id}:`, error);
        }
      }

      log(3, `Loaded ${ids.length} custom calendars`);
    } catch (error) {
      log(1, 'Error loading custom calendars:', error);
    }
  }

  /**
   * Load and apply user overrides for bundled calendars.
   * @private
   */
  static async #loadDefaultOverrides() {
    try {
      const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
      const ids = Object.keys(overrides);
      if (ids.length === 0) return;
      for (const id of ids) {
        const data = overrides[id];
        this.#migrateCalendarData(data);
        try {
          const calendar = new CalendariaCalendar(data);
          CalendarRegistry.register(id, calendar);
          log(3, `Applied override for bundled calendar: ${id}`);
        } catch (error) {
          log(1, `Error applying override for ${id}:`, error);
        }
      }

      log(3, `Applied ${ids.length} default calendar overrides`);
    } catch (error) {
      log(1, 'Error loading default overrides:', error);
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
      log(1, 'Error saving calendars to settings:', error);
    }
  }

  /**
   * Get a calendar by ID.
   * @param {string} id  Calendar ID
   * @returns {object|null} - Calendar instance or null
   */
  static getCalendar(id) {
    return CalendarRegistry.get(id);
  }

  /**
   * Get all calendars.
   * @returns {Map<string, CalendariaCalendar>} - Map of calendar IDs to instances
   */
  static getAllCalendars() {
    return CalendarRegistry.getAll();
  }

  /**
   * Get the active calendar.
   * @returns {object|null} - Active calendar instance or null
   */
  static getActiveCalendar() {
    return CalendarRegistry.getActive();
  }

  /**
   * Switch to a different calendar.
   * Uses game.time.initializeCalendar() to switch without reload.
   * @param {string} id  Calendar ID to switch to
   * @returns {Promise<boolean>}  True if calendar was switched
   */
  static async switchCalendar(id) {
    if (!CalendarRegistry.has(id)) {
      log(1, `Cannot switch to calendar: ${id} not found`);
      ui.notifications.error(format('CALENDARIA.Error.CalendarNotFound', { id }));
      return false;
    }

    const calendar = CalendarRegistry.get(id);
    CalendarRegistry.setActive(id);
    CalendariaCalendar.initializeEpochOffset();
    CONFIG.time.worldCalendarConfig = calendar.toObject();
    CONFIG.time.worldCalendarClass = CalendariaCalendar;
    CONFIG.time.roundTime = calendar.secondsPerRound ?? 6;
    game.time.initializeCalendar();
    if (game.user.isGM) {
      try {
        this.#isSwitchingCalendar = true;
        await game.settings.set(MODULE.ID, SETTINGS.ACTIVE_CALENDAR, id);
        log(3, `Updated active calendar setting to: ${id}`);
      } catch (error) {
        // Suppress validation errors for newly created custom calendars (will persist after reload)
        if (error.name !== 'DataModelValidationError') log(1, `Error updating active calendar setting:`, error);
      } finally {
        this.#isSwitchingCalendar = false;
      }
    }

    await this.saveCalendars();
    Hooks.callAll(HOOKS.CALENDAR_SWITCHED, id, calendar);
    this.rerenderCalendarUIs();
    log(3, `Switched to calendar: ${id}`);
    return true;
  }

  /**
   * Re-render all calendar-related UI applications.
   */
  static rerenderCalendarUIs() {
    const ids = ['calendaria-hud', 'time-keeper', 'mini-calendar', 'calendaria-big-cal'];
    for (const id of ids) foundry.applications.instances.get(id)?.render();
  }

  /**
   * Handle a remote calendar switch from another client.
   * Updates the local registry and reinitializes the calendar.
   * @param {string} id  Calendar ID to switch to
   */
  static handleRemoteSwitch(id) {
    if (!CalendarRegistry.has(id)) {
      log(2, `Cannot handle remote switch: calendar ${id} not found`);
      return;
    }

    log(3, `Handling remote calendar switch to: ${id}`);
    CalendarRegistry.setActive(id);
    const calendar = CalendarRegistry.get(id);
    CalendariaCalendar.initializeEpochOffset();
    CONFIG.time.worldCalendarConfig = calendar.toObject();
    CONFIG.time.worldCalendarClass = CalendariaCalendar;
    CONFIG.time.roundTime = calendar.secondsPerRound ?? 6;
    game.time.initializeCalendar();
    const calendarName = calendar?.name || id;
    ui.notifications.info(format('CALENDARIA.Info.CalendarSwitched', { name: calendarName }));
    Hooks.callAll(HOOKS.REMOTE_CALENDAR_SWITCH, id, calendar);
    this.rerenderCalendarUIs();
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
      ui.notifications.error(format('CALENDARIA.Error.CalendarAlreadyExists', { id }));
      return null;
    }

    try {
      const calendar = CalendarRegistry.register(id, definition);
      await this.saveCalendars();
      Hooks.callAll(HOOKS.CALENDAR_ADDED, id, calendar);
      log(3, `Added calendar: ${id}`);

      return calendar;
    } catch (error) {
      log(1, `Error adding calendar ${id}:`, error);
      ui.notifications.error(format('CALENDARIA.Error.CalendarAddFailed', { message: error.message }));
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

    if (CalendarRegistry.getActiveId() === id) {
      log(1, `Cannot remove active calendar: ${id}`);
      ui.notifications.warn('CALENDARIA.Error.CannotRemoveActiveCalendar', { localize: true });
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

  /**
   * Handle updateSetting hook for active calendar changes.
   * @param {object} setting - The setting that was updated
   * @param {object} changes - The changes to the setting
   * @private
   */
  static onUpdateSetting(setting, changes) {
    if (setting.key === `${MODULE.ID}.${SETTINGS.ACTIVE_CALENDAR}`) {
      const newCalendarId = changes.value;

      if (this.#isSwitchingCalendar) {
        log(3, 'Active calendar updated (by Calendaria)');
        return;
      }

      log(3, 'Active calendar updated (externally)');
      if (newCalendarId && CalendarRegistry.has(newCalendarId)) {
        CalendarRegistry.setActive(newCalendarId);
        const calendar = CalendarRegistry.get(newCalendarId);
        CalendariaCalendar.initializeEpochOffset();
        CONFIG.time.worldCalendarConfig = calendar.toObject();
        CONFIG.time.worldCalendarClass = CalendariaCalendar;
        CONFIG.time.roundTime = calendar.secondsPerRound ?? 6;
        game.time.initializeCalendar();
      }
    }
  }

  /**
   * Handle closeGame hook to save calendars.
   * @private
   */
  static onCloseGame() {
    if (game.user.isGM) CalendarManager.saveCalendars();
  }

  /**
   * Get the current moon phase for the active calendar.
   * @param {number} moonIndex  Index of the moon (0 for primary)
   * @returns {object|null}  Moon phase data
   */
  static getCurrentMoonPhase(moonIndex = 0) {
    const calendar = this.getActiveCalendar();
    if (!calendar) return null;
    return calendar.getMoonPhase(moonIndex);
  }

  /**
   * Get all moon phases for the active calendar.
   * @returns {Array<object>}  Array of moon phase data
   */
  static getAllCurrentMoonPhases() {
    const calendar = this.getActiveCalendar();
    if (!calendar) return [];
    return calendar.getAllMoonPhases();
  }

  /**
   * Check if the current date is a festival day.
   * @returns {object|null}  Festival data or null
   */
  static getCurrentFestival() {
    const calendar = this.getActiveCalendar();
    if (!calendar) return null;
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

  /**
   * Create a new custom calendar from a definition.
   * Saves to the CUSTOM_CALENDARS setting and registers in the system.
   * @param {string} id - Unique calendar ID (will be prefixed with 'custom-' if not already)
   * @param {object} definition - Calendar definition object
   * @returns {Promise<CalendariaCalendar|null>} The created calendar or null on error
   */
  static async createCustomCalendar(id, definition) {
    const calendarId = id.startsWith('custom-') ? id : `custom-${id}`;
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    if (customCalendars[calendarId]) {
      log(2, `Cannot create calendar: ${calendarId} already exists`);
      return null;
    }

    if (CalendarRegistry.has(calendarId)) {
      log(3, `Cleaning up stale registry entry for: ${calendarId}`);
      CalendarRegistry.unregister(calendarId);
    }

    try {
      if (!definition.metadata) definition.metadata = {};
      definition.metadata.id = calendarId;
      definition.metadata.author = definition.metadata.author || game.user.name;
      definition.metadata.isCustom = true;
      const calendar = new CalendariaCalendar(definition);
      customCalendars[calendarId] = calendar.toObject();
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, customCalendars);
      CalendarRegistry.register(calendarId, calendar);
      Hooks.callAll(HOOKS.CALENDAR_ADDED, calendarId, calendar);
      log(3, `Created custom calendar: ${calendarId}`);
      return calendar;
    } catch (error) {
      log(1, `Error creating custom calendar ${calendarId}:`, error);
      return null;
    }
  }

  /**
   * Update an existing custom calendar.
   * @param {string} id - Calendar ID to update
   * @param {object} changes - Partial definition with changes to apply
   * @returns {Promise<CalendariaCalendar|null>} The updated calendar or null on error
   */
  static async updateCustomCalendar(id, changes) {
    const calendar = CalendarRegistry.get(id);
    if (!calendar) {
      log(1, `Cannot update calendar: ${id} not found`);
      ui.notifications.error(format('CALENDARIA.Error.CalendarNotFound', { id }));
      return null;
    }

    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    if (!customCalendars[id]) {
      log(2, `Cannot update calendar: ${id} is not a custom calendar`);
      return null;
    }

    try {
      const existingData = calendar.toObject();
      const updatedData = foundry.utils.mergeObject(existingData, changes, { inplace: false });
      const updatedCalendar = new CalendariaCalendar(updatedData);
      customCalendars[id] = updatedCalendar.toObject();
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, customCalendars);
      CalendarRegistry.register(id, updatedCalendar);
      if (CalendarRegistry.getActiveId() === id) {
        CalendariaCalendar.initializeEpochOffset();
        CONFIG.time.worldCalendarConfig = updatedCalendar.toObject();
        CONFIG.time.roundTime = updatedCalendar.secondsPerRound ?? 6;
        game.time.initializeCalendar();
      }

      Hooks.callAll(HOOKS.CALENDAR_UPDATED, id, updatedCalendar);
      log(3, `Updated custom calendar: ${id}`);
      return updatedCalendar;
    } catch (error) {
      ui.notifications.error(format('CALENDARIA.Error.CalendarUpdateFailed', { message: error.message }));
      return null;
    }
  }

  /**
   * Delete a custom calendar.
   * @param {string} id - Calendar ID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async deleteCustomCalendar(id) {
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    const legacyData = game.settings.get(MODULE.ID, SETTINGS.CALENDARS) || {};
    const legacyCalendars = legacyData.calendars || {};
    const inCustom = !!customCalendars[id];
    const inLegacy = !!legacyCalendars[id];

    if (!inCustom && !inLegacy) {
      log(2, `Cannot delete calendar: ${id} is not a custom calendar`);
      return false;
    }

    if (CalendarRegistry.getActiveId() === id) {
      log(2, `Cannot delete active calendar: ${id}`);
      return false;
    }

    try {
      if (inCustom) {
        delete customCalendars[id];
        await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, customCalendars);
      }
      if (inLegacy) {
        delete legacyCalendars[id];
        await game.settings.set(MODULE.ID, SETTINGS.CALENDARS, { ...legacyData, calendars: legacyCalendars });
      }
      CalendarRegistry.unregister(id);
      Hooks.callAll(HOOKS.CALENDAR_REMOVED, id);
      log(3, `Deleted custom calendar: ${id}`);
      return true;
    } catch (error) {
      log(1, `Error deleting custom calendar ${id}:`, error);
      return false;
    }
  }

  /**
   * Get available calendar templates for "Start from..." feature.
   * Returns all registered calendars that can be used as templates.
   * @returns {Array<{id: string, name: string, description: string}>} - Template options
   */
  static getCalendarTemplates() {
    const templates = [];
    for (const [id, calendar] of CalendarRegistry.getAll()) {
      const name = calendar.name ? localize(calendar.name) : id;
      templates.push({ id, name, description: calendar.metadata?.description || '', isCustom: calendar.metadata?.isCustom || false });
    }
    templates.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    return templates;
  }

  /**
   * Duplicate an existing calendar as a starting point for a new custom calendar.
   * @param {string} sourceId - ID of calendar to duplicate
   * @param {string} newId - ID for the new calendar
   * @param {string} [newName] - Name for the new calendar
   * @returns {Promise<CalendariaCalendar|null>} The new calendar or null on error
   */
  static async duplicateCalendar(sourceId, newId, newName) {
    const sourceCalendar = CalendarRegistry.get(sourceId);
    if (!sourceCalendar) {
      log(2, `Cannot duplicate calendar: ${sourceId} not found`);
      return null;
    }

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
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar is custom
   */
  static isCustomCalendar(id) {
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    if (customCalendars[id]) return true;
    const legacyData = game.settings.get(MODULE.ID, SETTINGS.CALENDARS) || {};
    const legacyCalendars = legacyData.calendars || {};
    return !!legacyCalendars[id];
  }

  /**
   * Check if a calendar is a bundled (built-in) calendar.
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar is a bundled calendar
   */
  static isBundledCalendar(id) {
    return isBundledCalendar(id) && !this.isCustomCalendar(id);
  }

  /**
   * Check if a bundled calendar has a user override.
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar has an override
   */
  static hasDefaultOverride(id) {
    const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
    return !!overrides[id];
  }

  /**
   * Save a user override for a bundled calendar.
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
      if (!data.metadata) data.metadata = {};
      data.metadata.id = id;
      data.metadata.hasOverride = true;
      const calendar = new CalendariaCalendar(data);
      const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
      overrides[id] = calendar.toObject();
      await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES, overrides);
      CalendarRegistry.register(id, calendar);
      if (CalendarRegistry.getActiveId() === id) {
        CalendariaCalendar.initializeEpochOffset();
        CONFIG.time.worldCalendarConfig = calendar.toObject();
        CONFIG.time.roundTime = calendar.secondsPerRound ?? 6;
        game.time.initializeCalendar();
      }
      Hooks.callAll(HOOKS.CALENDAR_UPDATED, id, calendar);
      log(3, `Saved override for bundled calendar: ${id}`);
      return calendar;
    } catch (error) {
      log(1, `Error saving override for ${id}:`, error);
      return null;
    }
  }

  /**
   * Reset a bundled calendar to its original state by removing the override.
   * @param {string} id - Calendar ID to reset
   * @returns {Promise<boolean>} True if reset successfully
   */
  static async resetDefaultCalendar(id) {
    if (!this.hasDefaultOverride(id)) {
      log(2, `Cannot reset: ${id} has no override`);
      return false;
    }

    try {
      const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
      delete overrides[id];
      await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES, overrides);
      const path = `modules/${MODULE.ID}/calendars/${id}.json`;
      const response = await fetch(path);
      if (response.ok) {
        const calendarData = await response.json();
        const calendar = new CalendariaCalendar(calendarData);
        CalendarRegistry.register(id, calendar);
        if (CalendarRegistry.getActiveId() === id) {
          CalendariaCalendar.initializeEpochOffset();
          CONFIG.time.worldCalendarConfig = calendar.toObject();
          CONFIG.time.roundTime = calendar.secondsPerRound ?? 6;
          game.time.initializeCalendar();
        }
        Hooks.callAll(HOOKS.CALENDAR_UPDATED, id, calendar);
      }
      log(3, `Reset bundled calendar: ${id}`);
      return true;
    } catch (error) {
      log(1, `Error resetting bundled calendar ${id}:`, error);
      return false;
    }
  }
}
