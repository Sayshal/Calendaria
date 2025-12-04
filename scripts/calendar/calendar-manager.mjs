/**
 * Calendar Manager
 * Main entry point for calendar system management.
 * Handles calendar initialization, switching, and persistence.
 *
 * @module Calendar/CalendarManager
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import CalendarRegistry from './calendar-registry.mjs';
import CalendariaCalendar from './data/calendaria-calendar.mjs';

export default class CalendarManager {
  /** Flag to prevent responding to our own calendar changes */
  static #isSwitchingCalendar = false;

  /**
   * Initialize the calendar system.
   * Called during module initialization.
   */
  static async initialize() {
    log(3, 'Initializing Calendar Manager...');

    // Check if we're in a dnd5e game
    if (game.system.id === 'dnd5e') await this.#initializeDnd5e();
    else {
      // For non-dnd5e systems, load from our own settings
      await this.loadCalendars();
      if (CalendarRegistry.size === 0) await this.loadDefaultCalendars();
    }

    // Set up hooks
    this.#registerHooks();

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
   * Initialize for dnd5e system.
   * Loads calendars from CONFIG.DND5E.calendar.calendars
   * @private
   */
  static async #initializeDnd5e() {
    log(3, 'Initializing for D&D 5e system...');

    // Load calendars from CONFIG.DND5E.calendar.calendars
    const dnd5eCalendars = CONFIG.DND5E?.calendar?.calendars ?? [];

    for (const calendarDef of dnd5eCalendars) {
      try {
        // Extract the calendar ID and config
        const id = calendarDef.value;
        const config = calendarDef.config;

        // If the config is already a CalendarData instance, convert to plain object
        const calendarData = config instanceof foundry.data.CalendarData ? config.toObject() : config;

        // Add default metadata for dnd5e calendars
        if (!calendarData.metadata) calendarData.metadata = {};

        calendarData.metadata.id = calendarData.metadata.id || id;
        calendarData.metadata.description = calendarData.metadata.description || calendarData.description || '5e default calendar';
        calendarData.metadata.author = calendarData.metadata.author || 'dnd5e-system';

        // Convert dnd5e calendar definition to CalendariaCalendar
        const calendar = new CalendariaCalendar(calendarData);
        CalendarRegistry.register(id, calendar);
        log(3, `Loaded dnd5e calendar: ${id}`);
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
  }

  /**
   * Load default calendar definitions.
   * @private
   */
  static async loadDefaultCalendars() {
    log(3, 'Loading default calendars...');

    // For non-dnd5e systems, we'll add default calendars here later
    // For now, just log that no defaults are available
    log(2, 'No default calendars available for non-dnd5e systems yet');

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
   * @param {string} id  Calendar ID to switch to
   * @returns {Promise<boolean>}  True if calendar was switched
   */
  static async switchCalendar(id) {
    if (!CalendarRegistry.has(id)) {
      log(2, `Cannot switch to calendar: ${id} not found`);
      ui.notifications.error(`Calendar "${id}" not found`);
      return false;
    }

    // Set as active in registry
    CalendarRegistry.setActive(id);

    // For dnd5e, update the system's calendar settings
    if (game.system.id === 'dnd5e' && game.user.isGM) {
      try {
        // Set flag to prevent responding to our own change
        this.#isSwitchingCalendar = true;

        // Update dnd5e's active calendar setting (just the string ID)
        await game.settings.set('dnd5e', 'calendar', id);
        log(3, `Switched dnd5e calendar to: ${id}`);

        // Get calendar name for notification
        const calendar = CalendarRegistry.get(id);
        const calendarName = calendar?.name || id;

        // Notify user and reload to apply changes
        ui.notifications.info(`Switching to ${calendarName} calendar. Reloading...`);

        // Reload after brief delay so notification is visible
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        log(2, `Error updating dnd5e calendar:`, error);
      } finally {
        // Clear flag after setting completes
        this.#isSwitchingCalendar = false;
      }
    } else {
      // For non-dnd5e systems, save to our own settings
      await this.saveCalendars();
    }

    // Emit hook for calendar switch
    const calendar = CalendarRegistry.get(id);
    Hooks.callAll('calendaria.calendarSwitched', id, calendar);

    // Note: For dnd5e, the updateSetting hook will handle HUD refresh after reload
    // For other systems, HUD refresh could be handled differently

    return true;
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

      Hooks.callAll('calendaria.calendarAdded', id, calendar);
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
      Hooks.callAll('calendaria.calendarRemoved', id);
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
   * Register Foundry hooks for calendar management.
   * @private
   */
  static #registerHooks() {
    // For dnd5e, listen for calendar changes
    if (game.system.id === 'dnd5e') {
      Hooks.on('updateSetting', (setting, changes) => {
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
      });
    }

    // Save calendars when world closes (for non-dnd5e systems)
    if (game.system.id !== 'dnd5e') {
      Hooks.on('closeGame', () => {
        if (game.user.isGM) this.saveCalendars();
      });
    }
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
}
