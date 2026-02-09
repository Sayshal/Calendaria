/**
 * Calendaria Importer
 * Imports calendar data exported from Calendaria.
 * @module Importers/CalendariaImporter
 * @author Tyler
 */

import { log } from '../utils/logger.mjs';
import BaseImporter from './base-importer.mjs';

/**
 * Importer for Calendaria JSON exports.
 * Since exported data is already in Calendaria format, minimal transformation is needed.
 * Also accepts settings export files that contain calendarData.
 * @extends BaseImporter
 */
export default class CalendariaImporter extends BaseImporter {
  static id = 'calendaria';
  static label = 'CALENDARIA.Importer.Calendaria.Name';
  static icon = 'fa-calendar-alt';
  static description = 'CALENDARIA.Importer.Calendaria.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = false;
  static fileExtensions = ['.json'];

  /**
   * Check if data is a settings export file and extract calendar data if so.
   * @param {object} data - Raw data from file
   * @returns {object} Calendar data (extracted from settings export or original)
   */
  #extractCalendarData(data) {
    // Detect settings export format: has settings object and calendarData
    if (data.settings && data.calendarData?.name) {
      log(3, 'Detected settings export file, extracting calendarData');
      return data.calendarData;
    }
    return data;
  }

  /**
   * Extract current date from Calendaria data for preservation after import.
   * @param {object} data - Raw Calendaria data
   * @returns {{year: number, month: number, day: number}|null} Current date
   */
  extractCurrentDate(data) {
    const calendarData = this.#extractCalendarData(data);
    if (calendarData.currentDate) return calendarData.currentDate;
    if (calendarData.metadata?.currentDate) return calendarData.metadata.currentDate;
    return null;
  }

  /**
   * Extract notes from Calendaria export data.
   * @param {object} data - Raw Calendaria export data
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    const calendarData = this.#extractCalendarData(data);
    if (!calendarData.notes?.length) return [];
    return calendarData.notes.map((note) => ({
      name: note.name,
      content: note.content || '',
      startDate: note.startDate,
      endDate: note.endDate,
      allDay: note.allDay ?? true,
      repeat: note.repeat || 'never',
      categories: note.categories || [],
      originalId: note.id,
      suggestedType: 'note'
    }));
  }

  /**
   * Transform Calendaria export data.
   * Validates structure and passes through with minimal changes.
   * Also handles settings export files by extracting calendarData.
   * @param {object} data - Raw Calendaria export data or settings export
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    const calendarData = this.#extractCalendarData(data);
    const monthValues = calendarData.months?.values;
    if (!calendarData.name || !monthValues || !Object.values(monthValues).length) throw new Error('Invalid Calendaria export format');
    log(3, `Transforming Calendaria export: ${calendarData.name}`);
    const metadata = { ...calendarData.metadata };
    delete metadata.id;
    delete metadata.importedAt;
    metadata.importedFrom = 'calendaria';
    return { ...calendarData, metadata };
  }
}
