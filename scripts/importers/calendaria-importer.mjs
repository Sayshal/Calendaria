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
   * Extract current date from Calendaria data for preservation after import.
   * @param {object} data - Raw Calendaria data
   * @returns {{year: number, month: number, day: number}|null} Current date
   */
  extractCurrentDate(data) {
    if (data.currentDate) return data.currentDate;
    if (data.metadata?.currentDate) return data.metadata.currentDate;
    return null;
  }

  /**
   * Extract notes from Calendaria export data.
   * @param {object} data - Raw Calendaria export data
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    if (!data.notes?.length) return [];
    return data.notes.map((note) => ({
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
   * @param {object} data - Raw Calendaria export data
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    if (!data.name || !data.months?.values) throw new Error('Invalid Calendaria export format');
    log(3, `Transforming Calendaria export: ${data.name}`);
    const metadata = { ...data.metadata };
    delete metadata.id;
    delete metadata.importedAt;
    metadata.importedFrom = 'calendaria';
    return { ...data, metadata };
  }
}
