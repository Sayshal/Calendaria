/**
 * Calendar Loader
 * @module Calendar/CalendarLoader
 * @author Tyler
 */

import { MODULE } from '../constants.mjs';
import { log } from '../utils/_module.mjs';
import { CalendarRegistry, preLocalizeCalendar } from './_module.mjs';

/** @type {string[]} List of bundled calendar IDs that ship with the module. */
export const BUNDLED_CALENDARS = [
  'athasian',
  'barovian',
  'cerilian',
  'drakkenheim',
  'exandrian',
  'forbidden-lands',
  'galifar',
  'golarion',
  'golarion-imperial',
  'gregorian',
  'pact-standard',
  'greyhawk',
  'greyhawk-364',
  'harptos',
  'imperial-warhammer',
  'khorvaire',
  'krynn-elven',
  'krynn-solamnia',
  'renescara',
  'thyatian',
  'traveller'
];

/** @type {string} Default calendar ID to use when no calendar is selected. */
export const DEFAULT_CALENDAR = 'gregorian';

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
 * @returns {boolean} - If calendar is module-provided
 */
export function isBundledCalendar(id) {
  return BUNDLED_CALENDARS.includes(id);
}
