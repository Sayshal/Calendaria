/**
 * Importer Registry
 * Central registry for all calendar importers.
 *
 * @module Importers
 * @author Tyler
 */

import { log } from '../utils/logger.mjs';
import BaseImporter from './base-importer.mjs';
import SimpleCalendarImporter from './simple-calendar-importer.mjs';
import FantasyCalendarImporter from './fantasy-calendar-importer.mjs';
import SeasonsStarsImporter from './seasons-stars-importer.mjs';
import SimpleTimekeepingImporter from './simple-timekeeping-importer.mjs';
import CalendariumImporter from './calendarium-importer.mjs';

/**
 * Registry of all available importers.
 * @type {Map<string, typeof BaseImporter>}
 */
const IMPORTERS = new Map();

/**
 * Register an importer class.
 * @param {typeof BaseImporter} ImporterClass - The importer class to register
 * @throws {Error} If importer is invalid or already registered
 */
export function registerImporter(ImporterClass) {
  if (!ImporterClass?.id) throw new Error('Importer class must have a static id property');

  if (IMPORTERS.has(ImporterClass.id)) {
    log(2, `Importer ${ImporterClass.id} is already registered, skipping`);
    return;
  }

  IMPORTERS.set(ImporterClass.id, ImporterClass);
  log(3, `Registered importer: ${ImporterClass.id}`);
}

/**
 * Get an importer class by ID.
 * @param {string} id - Importer ID
 * @returns {typeof BaseImporter|undefined}
 */
export function getImporter(id) {
  return IMPORTERS.get(id);
}

/**
 * Get all registered importers.
 * @returns {Array<typeof BaseImporter>}
 */
export function getAvailableImporters() {
  return [...IMPORTERS.values()];
}

/**
 * Get importers that have detected their source module as installed.
 * @returns {Array<typeof BaseImporter>}
 */
export function getDetectedImporters() {
  return getAvailableImporters().filter((importer) => importer.supportsLiveImport && importer.detect());
}

/**
 * Get importer options for UI dropdowns.
 * @returns {Array<{value: string, label: string, icon: string, detected: boolean}>}
 */
export function getImporterOptions() {
  return getAvailableImporters().map((importer) => ({
    value: importer.id,
    label: importer.label,
    icon: importer.icon,
    description: importer.description,
    supportsFileUpload: importer.supportsFileUpload,
    supportsLiveImport: importer.supportsLiveImport,
    detected: importer.supportsLiveImport && importer.detect()
  }));
}

/**
 * Create an instance of an importer.
 * @param {string} id - Importer ID
 * @returns {BaseImporter|null}
 */
export function createImporter(id) {
  const ImporterClass = IMPORTERS.get(id);
  if (!ImporterClass) {
    log(2, `Unknown importer: ${id}`);
    return null;
  }
  return new ImporterClass();
}

/**
 * Initialize the importer system.
 * Registers all built-in importers.
 */
export function initializeImporters() {
  log(3, 'Initializing importer registry...');

  // Register built-in importers
  registerImporter(SimpleCalendarImporter);
  registerImporter(FantasyCalendarImporter);
  registerImporter(SeasonsStarsImporter);
  registerImporter(SimpleTimekeepingImporter);
  registerImporter(CalendariumImporter);

  log(3, `Importer registry initialized with ${IMPORTERS.size} importers`);
}

// Re-export base class for subclassing
export { default as BaseImporter } from './base-importer.mjs';
