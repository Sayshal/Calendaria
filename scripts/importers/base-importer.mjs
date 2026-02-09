/**
 * Base Importer Class
 * Abstract foundation for all calendar importers.
 * Subclasses must implement transform() at minimum.
 * @module Importers/BaseImporter
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS } from '../constants.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';

/**
 * Abstract base class for calendar importers.
 * Provides common functionality for parsing, transforming, and importing calendars.
 */
export default class BaseImporter {
  /** @type {string} Unique importer identifier */
  static id = 'base';

  /** @type {string} Localization key for importer name */
  static label = 'CALENDARIA.Importer.Base';

  /** @type {string} FontAwesome icon class */
  static icon = 'fa-file-import';

  /** @type {string} Localization key for importer description */
  static description = 'CALENDARIA.Importer.BaseDescription';

  /** @type {boolean} Whether this importer supports file upload */
  static supportsFileUpload = true;

  /** @type {boolean} Whether this importer can read from an installed module */
  static supportsLiveImport = false;

  /** @type {string} Module ID to detect for live import (if supported) */
  static moduleId = null;

  /** @type {string[]} Accepted file extensions */
  static fileExtensions = ['.json'];

  /** @type {object[]} Undated events to migrate to journal entries */
  _undatedEvents = [];

  /**
   * Check if the source module is installed and active.
   * @returns {boolean} True if module is available for live import
   */
  static detect() {
    if (!this.moduleId) return false;
    return game.modules.get(this.moduleId)?.active ?? false;
  }

  /**
   * Load calendar data from an installed module's settings.
   * Must be overridden by subclasses that support live import.
   * @returns {Promise<object>} Raw calendar data from module
   * @throws {Error} If not implemented or module not available
   */
  async loadFromModule() {
    throw new Error(`${this.constructor.name}.loadFromModule() not implemented`);
  }

  /**
   * Parse an uploaded file into raw data.
   * @param {File} file - The uploaded file
   * @returns {Promise<object>} Parsed data object
   */
  async parseFile(file) {
    const text = await file.text();
    return JSON.parse(text);
  }

  /**
   * Transform raw source data into CalendariaCalendar format.
   * Must be overridden by subclasses.
   * @param {object} data - Raw source data
   * @returns {Promise<object>} CalendariaCalendar-compatible data object
   * @throws {Error} If not implemented
   */
  async transform(data) {
    log(1, `${this.constructor.name}.transform() not implemented`, { data });
    return null;
  }

  /**
   * Extract notes/events from source data.
   * Override in subclasses that support note import.
   * @param {object} data - Raw source data
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    log(1, `${this.constructor.name}.extractNotes() not implemented`, { data });
    return null;
  }

  /**
   * Extract the current date from source data.
   * Override in subclasses to return the date the source module was displaying.
   * @param {object} _data - Raw source data
   * @returns {{year: number, month: number, day: number, hour: number, minute: number}|null} Current date or null
   */
  extractCurrentDate(_data) {
    return null;
  }

  /**
   * Apply a date to the imported calendar by setting worldTime.
   * Uses the calendar's jumpToDate method to set the correct time.
   * @param {{year: number, month: number, day: number, hour: number, minute: number}} dateComponents - Date to apply
   * @param {string} calendarId - Calendar ID to apply the date to
   * @returns {Promise<boolean>} True if date was applied successfully
   */
  async applyCurrentDate(dateComponents, calendarId) {
    if (!dateComponents) return false;
    try {
      const calendar = CalendarManager.getCalendar(calendarId);
      if (!calendar) {
        log(2, `Cannot apply date: calendar ${calendarId} not found`);
        return false;
      }
      const yearZero = calendar.years?.yearZero ?? 0;
      const displayYear = dateComponents.year + yearZero;
      log(3, `Applying imported date: ${displayYear}/${dateComponents.month + 1}/${dateComponents.day}`);
      await calendar.jumpToDate({
        year: displayYear,
        month: dateComponents.month,
        day: dateComponents.day
      });
      return true;
    } catch (error) {
      log(2, `Failed to apply current date:`, error);
      return false;
    }
  }

  /**
   * Validate transformed data against CalendariaCalendar schema.
   * @param {object} data - Transformed calendar data
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validate(data) {
    const errors = [];
    if (!data.name) errors.push(localize('CALENDARIA.Importer.Error.MissingName'));
    const months = data.months?.values ? Object.values(data.months.values) : [];
    if (!months.length) errors.push(localize('CALENDARIA.Importer.Error.NoMonths'));
    if (!data.days) errors.push(localize('CALENDARIA.Importer.Error.MissingTimeConfig'));
    if (data.days) {
      if (!data.days.hoursPerDay || data.days.hoursPerDay < 1) errors.push(localize('CALENDARIA.Importer.Error.InvalidHoursPerDay'));
      if (!data.days.minutesPerHour || data.days.minutesPerHour < 1) errors.push(localize('CALENDARIA.Importer.Error.InvalidMinutesPerHour'));
      if (!data.days.secondsPerMinute || data.days.secondsPerMinute < 1) errors.push(localize('CALENDARIA.Importer.Error.InvalidSecondsPerMinute'));
    }
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      if (!month.name) errors.push(format('CALENDARIA.Importer.Error.MonthMissingName', { num: i + 1 }));
      if (!month.days || month.days < 1) errors.push(format('CALENDARIA.Importer.Error.MonthNoDays', { num: i + 1 }));
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Import a calendar into Calendaria.
   * @param {object} data - Transformed calendar data
   * @param {object} options - Import options
   * @param {string} options.id - Calendar ID (will be prefixed with 'custom-')
   * @param {string} [options.name] - Override calendar name
   * @returns {Promise<object>} imported calendar data
   */
  async importCalendar(data, options = {}) {
    const calendarId = options.id || this.#generateId(data.name);
    if (options.name) data.name = options.name;
    if (!data.metadata) data.metadata = {};
    data.metadata.importedFrom = this.constructor.id;
    data.metadata.importedAt = Date.now();
    Hooks.callAll(HOOKS.IMPORT_STARTED, { importerId: this.constructor.id, calendarId });
    try {
      const calendar = await CalendarManager.createCustomCalendar(calendarId, data);
      if (calendar) {
        const actualCalendarId = calendar.metadata?.id || `custom-${calendarId}`;
        log(3, `Successfully imported calendar: ${actualCalendarId}`);
        Hooks.callAll(HOOKS.IMPORT_COMPLETE, { importerId: this.constructor.id, calendarId: actualCalendarId, calendar });
        return { success: true, calendar, calendarId: actualCalendarId };
      } else {
        throw new Error('Calendar creation returned null');
      }
    } catch (error) {
      log(2, `Import failed for ${calendarId}:`, error);
      Hooks.callAll(HOOKS.IMPORT_FAILED, { importerId: this.constructor.id, calendarId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Import notes from source data.
   * Override in subclasses that support note import.
   * @param {object[]} notes - Extracted note data
   * @param {object} options - Import options
   * @param {string} options.calendarId - Target calendar ID
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>} - Import result
   */
  async importNotes(notes, options = {}) {
    log(1, `${this.constructor.name}.importNotes() not implemented`, { notes, options });
    return null;
  }

  /**
   * Import festivals (fixed calendar events) from source data.
   * Override in subclasses that support festival import.
   * @param {object[]} festivals - Extracted festival data
   * @param {object} options - Import options
   * @param {string} options.calendarId - Target calendar ID
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>} - Import result
   */
  async importFestivals(festivals, options = {}) {
    log(1, `${this.constructor.name}.importFestivals() not implemented`, { festivals, options });
    return null;
  }

  /**
   * Migrate undated events to Foundry journal entries.
   * Creates folder hierarchy: Calendaria Imports/[Calendar Name]/Undated Events
   * @param {string} calendarName - Name of the calendar for folder organization
   * @returns {Promise<{count: number}>} - Migration result with count
   */
  async migrateUndatedEvents(calendarName) {
    if (!this._undatedEvents?.length) return { count: 0 };
    const parts = ['Calendaria Imports', calendarName, 'Undated Events'];
    let parentId = null;
    for (const part of parts) {
      let existing = game.folders.find((f) => f.name === part && f.folder?.id === parentId && f.type === 'JournalEntry');
      if (!existing) existing = await Folder.create({ name: part, type: 'JournalEntry', folder: parentId });
      parentId = existing.id;
    }
    const journalData = this._undatedEvents.map((event) => ({ name: event.name, folder: parentId, pages: [{ name: event.name, type: 'text', text: { content: event.content || '' } }] }));
    await JournalEntry.createDocuments(journalData);
    const count = this._undatedEvents.length;
    ui.notifications.info(format('CALENDARIA.Importer.UndatedEventsMigrated', { count }));
    log(3, `Migrated ${count} undated events to journal entries`);
    return { count };
  }

  /**
   * Generate preview data for the import UI.
   * @param {object} rawData - Raw source data
   * @param {object} transformedData - Transformed calendar data
   * @returns {object} Preview summary
   */
  getPreviewData(rawData, transformedData) {
    const notes = this.#countNotes(rawData);
    return {
      name: transformedData.name || 'Unknown',
      monthCount: transformedData.months?.values ? Object.values(transformedData.months.values).length : 0,
      weekdayCount: transformedData.days?.values ? Object.values(transformedData.days.values).length : 0,
      moonCount: transformedData.moons ? Object.values(transformedData.moons).length : 0,
      seasonCount: transformedData.seasons?.values ? Object.values(transformedData.seasons.values).length : 0,
      eraCount: transformedData.eras ? Object.values(transformedData.eras).length : 0,
      festivalCount: transformedData.festivals ? Object.values(transformedData.festivals).length : 0,
      noteCount: notes,
      undatedCount: this._undatedEvents?.length ?? 0,
      hasLeapYear: !!transformedData.years?.leapYear?.rule,
      daysPerYear: this.#calculateDaysPerYear(transformedData)
    };
  }

  /**
   * Generate a URL-safe ID from a name.
   * @param {string} name - Calendar name
   * @returns {string} Generated ID
   * @private
   */
  #generateId(name) {
    if (!name) return `imported-${Date.now()}`;
    return name
      .toLowerCase()
      .replace(/[^\da-z]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 32);
  }

  /**
   * Count notes in raw data.
   * Override in subclasses for accurate counts.
   * @param {object} _data - Raw source data
   * @returns {number} Note count
   * @private
   */
  #countNotes(_data) {
    return 0;
  }

  /**
   * Calculate total days per year from calendar data.
   * @param {object} data - Transformed calendar data
   * @returns {number} Days per year
   * @private
   */
  #calculateDaysPerYear(data) {
    const months = data.months?.values ? Object.values(data.months.values) : [];
    return months.reduce((sum, month) => sum + (month.days || 0), 0);
  }
}
