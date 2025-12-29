/**
 * Calendar Loader
 * Loads bundled JSON calendar files and registers them with the CalendarRegistry.
 * @module Calendar/CalendarLoader
 * @author Tyler
 */

import { MODULE } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import CalendarRegistry from './calendar-registry.mjs';
import { preLocalizeCalendar } from './calendar-utils.mjs';

/**
 * List of bundled calendar IDs that ship with the module.
 * @type {string[]}
 */
export const BUNDLED_CALENDARS = ['gregorian', 'greyhawk', 'harptos', 'khorvaire', 'renescara'];

/**
 * Default calendar ID to use when no calendar is selected.
 * @type {string}
 */
export const DEFAULT_CALENDAR = 'gregorian';

/* -------------------------------------------- */
/*  Loader Functions                            */
/* -------------------------------------------- */

/**
 * Load a single calendar JSON file.
 * @param {string} id  Calendar ID (filename without extension)
 * @returns {Promise<object|null>}  Calendar data or null if failed
 */
async function loadCalendarFile(id) {
  const path = `modules/${MODULE.ID}/calendars/${id}.json`;
  try {
    const response = await fetch(path);
    if (!response.ok) {
      log(1, `Failed to load calendar file: ${path} (${response.status})`);
      return null;
    }
    const data = await response.json();
    // Prelocalize all strings in the calendar data
    preLocalizeCalendar(data);
    log(3, `Loaded calendar file: ${id}`);
    return data;
  } catch (error) {
    log(1, `Error loading calendar file ${path}:`, error);
    return null;
  }
}

/**
 * Load all bundled calendars and register them with the CalendarRegistry.
 * @returns {Promise<string[]>}  Array of successfully loaded calendar IDs
 */
export async function loadBundledCalendars() {
  const loaded = [];

  for (const id of BUNDLED_CALENDARS) {
    const data = await loadCalendarFile(id);
    if (data) {
      CalendarRegistry.register(id, data);
      loaded.push(id);
    }
  }

  log(3, `Loaded ${loaded.length}/${BUNDLED_CALENDARS.length} bundled calendars`);
  return loaded;
}

/**
 * Load a specific calendar by ID if not already registered.
 * @param {string} id  Calendar ID
 * @returns {Promise<boolean>}  True if calendar was loaded or already exists
 */
export async function loadCalendar(id) {
  if (CalendarRegistry.has(id)) return true;

  const data = await loadCalendarFile(id);
  if (data) {
    CalendarRegistry.register(id, data);
    return true;
  }
  return false;
}

/**
 * Check if a calendar ID is a bundled calendar.
 * @param {string} id  Calendar ID
 * @returns {boolean}
 */
export function isBundledCalendar(id) {
  return BUNDLED_CALENDARS.includes(id);
}
