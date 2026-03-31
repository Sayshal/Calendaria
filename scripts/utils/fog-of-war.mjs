/**
 * Fog of War manager for progressive calendar revelation.
 * Players only see dates within revealed ranges; GMs always see all dates.
 * @module Utils/FogOfWar
 * @author Tyler
 */

import { CalendarManager, CalendarRegistry } from '../calendar/_module.mjs';
import { HOOKS, MODULE, SETTINGS } from '../constants.mjs';
import { addDays, compareDays } from '../notes/_module.mjs';
import { CalendariaSocket } from './socket.mjs';

/** @type {Map<string, Array<{start: object, end: object}>>|null} Cached revealed ranges per calendar */
let rangeCache = null;

/**
 * Check if Fog of War is enabled.
 * @returns {boolean} Whether fog of war is enabled
 */
export function isFogEnabled() {
  return game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_ENABLED);
}

/**
 * Check if a specific date is revealed for the current user.
 * @param {number} year - Display year (with yearZero applied)
 * @param {number} month - Month (0-indexed)
 * @param {number} dayOfMonth - Day (0-indexed)
 * @param {string} [calendarId] - Calendar ID (defaults to active)
 * @returns {boolean} Whether the date is revealed
 */
export function isRevealed(year, month, dayOfMonth, calendarId = null) {
  if (game.user.isGM) return true;
  if (!isFogEnabled()) return true;
  calendarId = calendarId || CalendarRegistry.getActiveId();
  if (!calendarId) return true;
  const date = { year, month, dayOfMonth };
  const startDate = getCompleteStartDate();
  if (startDate) {
    const config = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_CONFIG);
    const radius = config.revealRadius || 0;
    const floor = radius > 0 ? addDays(startDate, -radius) : startDate;
    if (compareDays(date, floor) < 0) return false;
  }
  const ranges = getRevealedRanges(calendarId);
  for (const range of ranges) if (compareDays(date, range.start) >= 0 && compareDays(date, range.end) <= 0) return true;
  return false;
}

/**
 * Get revealed ranges for a calendar.
 * @param {string} calendarId - Calendar ID to look up
 * @returns {Array<{start: object, end: object}>} Revealed date ranges
 */
export function getRevealedRanges(calendarId) {
  if (!rangeCache) refreshCache();
  return rangeCache.get(calendarId) || [];
}

/**
 * Reveal a date range. GM only. Merges adjacent/overlapping ranges.
 * @param {object} start - {year, month, dayOfMonth}
 * @param {object} end - {year, month, dayOfMonth}
 * @param {string} [calendarId] - Calendar ID (defaults to active)
 */
export async function revealRange(start, end, calendarId = null) {
  if (!game.user.isGM) return;
  calendarId = calendarId || CalendarRegistry.getActiveId();
  if (!calendarId) return;
  const allRanges = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_RANGES));
  const calRanges = allRanges[calendarId] || [];
  calRanges.push({ start: { year: start.year, month: start.month, dayOfMonth: start.dayOfMonth }, end: { year: end.year, month: end.month, dayOfMonth: end.dayOfMonth } });
  allRanges[calendarId] = mergeRanges(calRanges);
  await game.settings.set(MODULE.ID, SETTINGS.FOG_OF_WAR_RANGES, allRanges);
  Hooks.callAll(HOOKS.FOG_RANGE_CHANGED, { calendarId, ranges: allRanges[calendarId] });
}

/**
 * Remove a revealed range by index. GM only.
 * @param {number} index - Range index to remove
 * @param {string} [calendarId] - Calendar ID (defaults to active)
 */
export async function removeRange(index, calendarId = null) {
  if (!game.user.isGM) return;
  calendarId = calendarId || CalendarRegistry.getActiveId();
  if (!calendarId) return;
  const allRanges = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_RANGES));
  const calRanges = allRanges[calendarId] || [];
  if (index < 0 || index >= calRanges.length) return;
  calRanges.splice(index, 1);
  allRanges[calendarId] = calRanges;
  await game.settings.set(MODULE.ID, SETTINGS.FOG_OF_WAR_RANGES, allRanges);
  Hooks.callAll(HOOKS.FOG_RANGE_CHANGED, { calendarId, ranges: allRanges[calendarId] });
}

/**
 * Clear all revealed ranges for a calendar. GM only.
 * @param {string} [calendarId] - Calendar ID (defaults to active)
 */
export async function clearRanges(calendarId = null) {
  if (!game.user.isGM) return;
  calendarId = calendarId || CalendarRegistry.getActiveId();
  if (!calendarId) return;
  const allRanges = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_RANGES));
  allRanges[calendarId] = [];
  await game.settings.set(MODULE.ID, SETTINGS.FOG_OF_WAR_RANGES, allRanges);
  Hooks.callAll(HOOKS.FOG_RANGE_CHANGED, { calendarId, ranges: [] });
}

/**
 * Auto-reveal the current date on DAY_CHANGE. Only runs for primary GM.
 * @param {object} hookData - DAY_CHANGE hook data with {current, previous, calendar}
 */
export async function autoRevealCurrentDay(hookData) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  if (!isFogEnabled()) return;
  const config = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_CONFIG);
  if (!config.autoReveal) return;
  const { current, previous, calendar } = hookData;
  const calendarId = calendar?.metadata?.id;
  if (!calendarId) return;
  const radius = config.revealRadius || 0;
  const revealIntermediate = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_REVEAL_INTERMEDIATE);
  let start = revealIntermediate ? { year: previous.year, month: previous.month, dayOfMonth: previous.dayOfMonth } : { year: current.year, month: current.month, dayOfMonth: current.dayOfMonth };
  let end = { year: current.year, month: current.month, dayOfMonth: current.dayOfMonth };
  if (radius > 0) {
    start = addDays(start, -radius);
    end = addDays(end, radius);
  }
  await revealRange(start, end, calendarId);
}

/**
 * Check if an entire month is fully fogged for the current user.
 * @param {number} year - Display year
 * @param {number} month - Month (0-indexed)
 * @param {string} [calendarId] - Calendar ID (defaults to active)
 * @returns {boolean} Whether the entire month is fogged
 */
export function isMonthFullyFogged(year, month, calendarId = null) {
  if (game.user.isGM) return false;
  if (!isFogEnabled()) return false;
  calendarId = calendarId || CalendarRegistry.getActiveId();
  if (!calendarId) return true;
  const calendar = CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  const daysInMonth = calendar?.getDaysInMonth(month, year - yearZero) ?? 30;
  const monthStart = { year, month, dayOfMonth: 0 };
  const monthEnd = { year, month, dayOfMonth: daysInMonth - 1 };
  const startDate = getCompleteStartDate();
  if (startDate && compareDays(monthEnd, startDate) < 0) return true;
  const ranges = getRevealedRanges(calendarId);
  for (const range of ranges) if (compareDays(range.end, monthStart) >= 0 && compareDays(range.start, monthEnd) <= 0) return false;
  return true;
}

/**
 * Check if there's a revealed month in the given direction from the current month.
 * @param {number} year - Current viewed year
 * @param {number} month - Current viewed month (0-indexed)
 * @param {number} direction - -1 for previous, 1 for next
 * @param {object} calendar - The calendar object
 * @returns {boolean} True if a revealed month exists in that direction
 */
export function hasFogRevealedMonthInDirection(year, month, direction, calendar) {
  if (!calendar) return true;
  const monthsInYear = calendar.monthsArray?.length ?? 12;
  let checkMonth = month + direction;
  let checkYear = year;
  if (checkMonth >= monthsInYear) {
    checkMonth = 0;
    checkYear++;
  } else if (checkMonth < 0) {
    checkMonth = monthsInYear - 1;
    checkYear--;
  }
  let attempts = 0;
  const maxAttempts = monthsInYear * 10;
  while (attempts < maxAttempts) {
    if (!isMonthFullyFogged(checkYear, checkMonth)) return true;
    checkMonth += direction;
    if (checkMonth >= monthsInYear) {
      checkMonth = 0;
      checkYear++;
    } else if (checkMonth < 0) {
      checkMonth = monthsInYear - 1;
      checkYear--;
    }
    attempts++;
  }
  return false;
}

/**
 * Get the complete start date if all fields are filled.
 * @returns {object|null} {year, month, dayOfMonth} or null if incomplete
 * @private
 */
function getCompleteStartDate() {
  const sd = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_START_DATE);
  if (!sd || sd.year == null || sd.month == null || sd.dayOfMonth == null) return null;
  return sd;
}

/**
 * Invalidate the internal range cache. Called when FOG_OF_WAR_RANGES setting changes.
 */
export function invalidateCache() {
  rangeCache = null;
}

/**
 * Refresh the internal cache from settings.
 * @private
 */
function refreshCache() {
  rangeCache = new Map();
  const allRanges = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_RANGES);
  for (const [calendarId, ranges] of Object.entries(allRanges)) rangeCache.set(calendarId, ranges);
}

/**
 * Merge overlapping or adjacent date ranges into minimal set.
 * @param {Array<{start: object, end: object}>} ranges - Unsorted ranges
 * @returns {Array<{start: object, end: object}>} Merged ranges
 * @private
 */
function mergeRanges(ranges) {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => compareDays(a.start, b.start));
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    const lastEndPlusOne = addDays(last.end, 1);
    if (compareDays(current.start, lastEndPlusOne) <= 0) {
      if (compareDays(current.end, last.end) > 0) last.end = current.end;
    } else {
      merged.push(current);
    }
  }
  return merged;
}
