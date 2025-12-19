/**
 * Calendar Manager
 * Main entry point for calendar system management.
 * Handles calendar initialization, switching, and persistence.
 *
 * @module Calendar/CalendarManager
 * @author Tyler
 */

import { MODULE, SETTINGS, SYSTEM, HOOKS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import CalendarRegistry from './calendar-registry.mjs';
import CalendariaCalendar from './data/calendaria-calendar.mjs';
import { RENESCARA_CALENDAR } from './data/renescara-calendar.mjs';
import { getCalendarDefaults } from './data/calendar-defaults.mjs';

export default class CalendarManager {
  /** Flag to prevent responding to our own calendar changes */
  static #isSwitchingCalendar = false;

  /**
   * Initialize the calendar system.
   * Called during module initialization.
   */
  static async initialize() {
    await this.#loadCustomCalendars();
    if (SYSTEM.isDnd5e) {
      await this.#initializeDnd5e();
    } else {
      await this.loadCalendars();
      if (CalendarRegistry.size === 0) await this.loadDefaultCalendars();
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
        CalendarRegistry.fromObject(savedData);
        log(3, `Loaded ${CalendarRegistry.size} calendars from settings`);
      }
    } catch (error) {
      log(2, 'Error loading calendars from settings:', error);
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
        try {
          const calendar = new CalendariaCalendar(data);
          CalendarRegistry.register(id, calendar);

          // Add to dnd5e calendar list if applicable
          if (SYSTEM.isDnd5e && CONFIG.DND5E?.calendar?.calendars) {
            const exists = CONFIG.DND5E.calendar.calendars.some((c) => c.value === id);
            if (!exists) CONFIG.DND5E.calendar.calendars.push({ value: id, label: data.name || id, config: calendar, class: CalendariaCalendar });
          }

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
   * Initialize for dnd5e system.
   * Loads calendars from CONFIG.DND5E.calendar.calendars
   * @private
   */
  static async #initializeDnd5e() {
    log(3, 'Initializing for D&D 5e system...');

    // Load any saved overrides for default calendars
    const defaultOverrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};

    // Load calendars from CONFIG.DND5E.calendar.calendars
    const dnd5eCalendars = CONFIG.DND5E?.calendar?.calendars ?? [];

    for (const calendarDef of dnd5eCalendars) {
      try {
        // Extract the calendar ID and config
        const id = calendarDef.value;
        const config = calendarDef.config;

        // Check if user has an override for this calendar
        if (defaultOverrides[id]) {
          // Use the override data instead of the default
          const calendar = new CalendariaCalendar(defaultOverrides[id]);
          CalendarRegistry.register(id, calendar);
          log(3, `Loaded calendar ${id} from user override`);
          continue;
        }

        // If the config is already a CalendarData instance, convert to plain object
        const calendarData = config instanceof foundry.data.CalendarData ? config.toObject() : config;

        // Add default metadata for dnd5e calendars
        if (!calendarData.metadata) calendarData.metadata = {};

        calendarData.metadata.id = calendarData.metadata.id || id;
        calendarData.metadata.description = calendarData.metadata.description || calendarData.description || '5e default calendar';
        calendarData.metadata.author = calendarData.metadata.author || 'dnd5e-system';

        // Extract festivals if they exist in the dnd5e calendar config
        // Festivals may be in the original config object
        if (config.festivals && !calendarData.festivals) calendarData.festivals = config.festivals;

        // Extract moons if they exist in the dnd5e calendar config
        if (config.moons && !calendarData.moons) calendarData.moons = config.moons;

        // Apply defaults (moons, seasons, eras) for known calendars
        const defaults = getCalendarDefaults(id);
        if (defaults) {
          if (defaults.moons && !calendarData.moons?.length) calendarData.moons = defaults.moons;
          if (defaults.seasons && !calendarData.seasons?.values?.length) calendarData.seasons = defaults.seasons;
          if (defaults.eras && !calendarData.eras?.length) calendarData.eras = defaults.eras;
        }

        // Convert dnd5e calendar definition to CalendariaCalendar
        const calendar = new CalendariaCalendar(calendarData);
        CalendarRegistry.register(id, calendar);

        log(3, `Loaded calendar ${id} with ${calendar.festivals?.length} festivals, ${calendar.moons?.length} moons, ${calendar.seasons?.values?.length} seasons, ${calendar.eras?.length} eras`);
      } catch (error) {
        log(2, `Error loading dnd5e calendar:`, error);
      }
    }

    // Get active calendar from dnd5e settings
    const activeCalendarId = game.settings.get('dnd5e', 'calendar');
    if (activeCalendarId) {
      CalendarRegistry.setActive(activeCalendarId);
      log(3, `Active calendar from dnd5e: ${activeCalendarId}`);
    } else if (CalendarRegistry.size > 0) {
      // Set first calendar as active
      const firstId = CalendarRegistry.getAllIds()[0];
      CalendarRegistry.setActive(firstId);
      log(3, `Set default active calendar: ${firstId}`);
    }

    // Sync game.time.calendar with our active calendar
    const activeCalendar = CalendarRegistry.getActive();
    if (activeCalendar) {
      CONFIG.time.worldCalendarConfig = activeCalendar.toObject();
      CONFIG.time.worldCalendarClass = CalendariaCalendar;
      game.time.initializeCalendar();
      log(3, `Synced game.time.calendar to: ${activeCalendar.name}`);
    }
  }

  /**
   * Load default calendar definitions.
   * @private
   */
  static async loadDefaultCalendars() {
    log(3, 'Loading default calendars...');

    // Load Renescarran Calendar as the default for non-dnd5e systems
    try {
      const calendar = new CalendariaCalendar(RENESCARA_CALENDAR);
      CalendarRegistry.register('renescara', calendar);
      CalendarRegistry.setActive('renescara');
      log(3, 'Loaded Renescarran Calendar as default');
    } catch (error) {
      log(2, 'Error loading Renescarran Calendar:', error);
    }

    // Save state
    await this.saveCalendars();
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

    // For dnd5e, update the system's calendar setting for persistence
    if (SYSTEM.isDnd5e && game.user.isGM) {
      try {
        this.#isSwitchingCalendar = true;
        await game.settings.set('dnd5e', 'calendar', id);
        log(3, `Updated dnd5e calendar setting to: ${id}`);
      } catch (error) {
        log(2, `Error updating dnd5e calendar setting:`, error);
      } finally {
        this.#isSwitchingCalendar = false;
      }
    }

    // Save to our own settings for non-dnd5e systems
    await this.saveCalendars();

    // Re-render calendar UI
    if (SYSTEM.isDnd5e && dnd5e?.ui?.calendar) dnd5e.ui.calendar.render();

    // Emit hook for calendar switch
    Hooks.callAll(HOOKS.CALENDAR_SWITCHED, id, calendar);

    ui.notifications.info(`Switched to ${calendarName} calendar`);
    log(3, `Switched to calendar: ${id}`);

    return true;
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

    // Re-render calendar HUD if available
    if (SYSTEM.isDnd5e && dnd5e?.ui?.calendar) dnd5e.ui.calendar.render();
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
      name: calendar.metadata?.id ? game.i18n.localize(`CALENDARIA.Calendar.${calendar.metadata.id}.Name`) : id,
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
   * Handle updateSetting hook for dnd5e calendar changes.
   * @param {object} setting - The setting that was updated
   * @param {object} changes - The changes to the setting
   * @internal
   */
  static onUpdateSetting(setting, changes) {
    if (setting.key === 'dnd5e.calendar') {
      const newCalendarId = changes.value;

      // If we triggered this change, skip (we're handling the reload)
      if (this.#isSwitchingCalendar) {
        log(3, 'D&D 5e calendar updated (by Calendaria) - reload pending');
        return;
      }

      // External change - update registry to match
      log(3, 'D&D 5e calendar updated (externally)');
      if (newCalendarId) CalendarRegistry.setActive(newCalendarId);

      // Notify user that a reload is recommended for full UI update
      ui.notifications.warn('Calendar changed. Please reload for full effect.');
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

      // Add to dnd5e calendar list if applicable
      if (SYSTEM.isDnd5e && CONFIG.DND5E?.calendar?.calendars) {
        CONFIG.DND5E.calendar.calendars.push({ value: calendarId, label: definition.name || calendarId, config: calendar, class: CalendariaCalendar });
      }

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

      // Update in dnd5e calendar list if applicable
      if (SYSTEM.isDnd5e && CONFIG.DND5E?.calendar?.calendars) {
        const entry = CONFIG.DND5E.calendar.calendars.find((c) => c.value === id);
        if (entry) {
          entry.config = updatedCalendar;
          entry.label = updatedData.name || id;
        }
      }

      // If this is the active calendar, reinitialize
      if (CalendarRegistry.getActiveId() === id) {
        CONFIG.time.worldCalendarConfig = updatedCalendar.toObject();
        game.time.initializeCalendar();
        if (SYSTEM.isDnd5e && dnd5e?.ui?.calendar) dnd5e.ui.calendar.render();
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

      // Remove from dnd5e calendar list if applicable
      if (SYSTEM.isDnd5e && CONFIG.DND5E?.calendar?.calendars) {
        const index = CONFIG.DND5E.calendar.calendars.findIndex((c) => c.value === id);
        if (index !== -1) CONFIG.DND5E.calendar.calendars.splice(index, 1);
      }

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
  /*  Default Calendar Override Management        */
  /* -------------------------------------------- */

  /**
   * Check if a calendar is a default (built-in) calendar from dnd5e.
   *
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar is a default calendar
   */
  static isDefaultCalendar(id) {
    if (!SYSTEM.isDnd5e) return false;
    const dnd5eCalendars = CONFIG.DND5E?.calendar?.calendars ?? [];
    return dnd5eCalendars.some((c) => c.value === id) && !this.isCustomCalendar(id);
  }

  /**
   * Check if a default calendar has a user override.
   *
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar has an override
   */
  static hasDefaultOverride(id) {
    const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
    return !!overrides[id];
  }

  /**
   * Save a user override for a default calendar.
   *
   * @param {string} id - Calendar ID to override
   * @param {object} data - Full calendar data to save as override
   * @returns {Promise<CalendariaCalendar|null>} The updated calendar or null on error
   */
  static async saveDefaultOverride(id, data) {
    if (!this.isDefaultCalendar(id) && !this.hasDefaultOverride(id)) {
      log(2, `Cannot save override: ${id} is not a default calendar`);
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
      log(3, `Saved override for default calendar: ${id}`);
      ui.notifications.info(game.i18n.format('CALENDARIA.Editor.SaveSuccess', { name: data.name || id }));

      return calendar;
    } catch (error) {
      log(2, `Error saving default override for ${id}:`, error);
      ui.notifications.error(`Error saving calendar: ${error.message}`);
      return null;
    }
  }

  /**
   * Reset a default calendar to its original state by removing the override.
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

      // Reload the calendar from dnd5e defaults
      const dnd5eCalendars = CONFIG.DND5E?.calendar?.calendars ?? [];
      const calendarDef = dnd5eCalendars.find((c) => c.value === id);

      if (calendarDef) {
        const config = calendarDef.config;
        const calendarData = config instanceof foundry.data.CalendarData ? config.toObject() : config;

        // Add metadata
        if (!calendarData.metadata) calendarData.metadata = {};
        calendarData.metadata.id = id;
        calendarData.metadata.description = calendarData.description || '5e default calendar';
        calendarData.metadata.author = 'dnd5e-system';

        // Apply defaults
        const defaults = getCalendarDefaults(id);
        if (defaults) {
          if (defaults.moons && !calendarData.moons?.length) calendarData.moons = defaults.moons;
          if (defaults.seasons && !calendarData.seasons?.values?.length) calendarData.seasons = defaults.seasons;
          if (defaults.eras && !calendarData.eras?.length) calendarData.eras = defaults.eras;
        }

        const calendar = new CalendariaCalendar(calendarData);
        CalendarRegistry.register(id, calendar);

        // Update game.time.calendar if this is the active calendar
        if (CalendarRegistry.getActiveId() === id) {
          CONFIG.time.worldCalendarConfig = calendar.toObject();
          game.time.initializeCalendar();
        }

        Hooks.callAll(HOOKS.CALENDAR_UPDATED, id, calendar);
      }

      log(3, `Reset default calendar: ${id}`);
      ui.notifications.info(game.i18n.localize('CALENDARIA.Editor.ResetComplete'));
      return true;
    } catch (error) {
      log(2, `Error resetting default calendar ${id}:`, error);
      return false;
    }
  }
}
