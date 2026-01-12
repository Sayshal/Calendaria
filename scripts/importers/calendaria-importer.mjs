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
   * Transform Calendaria export data.
   * Validates structure and passes through with minimal changes.
   * @param {object} data - Raw Calendaria export data
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    if (!data.name || !data.months?.values) {
      throw new Error('Invalid Calendaria export format');
    }

    log(3, `Transforming Calendaria export: ${data.name}`);

    // Clean metadata for re-import
    const metadata = { ...data.metadata };
    delete metadata.id;
    delete metadata.importedAt;
    metadata.importedFrom = 'calendaria';

    return {
      ...data,
      metadata
    };
  }
}
