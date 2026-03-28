/**
 * Eclipse Calculator — detects solar and lunar eclipses from moon orbital data.
 * @module Utils/EclipseCalculator
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { addOneDay, compareDates, dateToDayNumber, isMoonFull, isNewMoon } from './formatting/moon-utils.mjs';

/** @enum {string} Eclipse type identifiers. */
export const ECLIPSE_TYPES = {
  TOTAL_SOLAR: 'totalSolar',
  PARTIAL_SOLAR: 'partialSolar',
  ANNULAR_SOLAR: 'annularSolar',
  TOTAL_LUNAR: 'totalLunar',
  PARTIAL_LUNAR: 'partialLunar',
  PENUMBRAL_LUNAR: 'penumbralLunar'
};

/** @type {Object<string, number>} Nodal period multipliers for frequency presets. */
const FREQUENCY_MULTIPLIERS = { rare: 12, occasional: 6, frequent: 3 };

/** @type {number} Sin-value threshold for eclipse window detection. */
const ECLIPSE_WINDOW_THRESHOLD = 0.15;

/**
 * Resolve the effective nodal period for a moon.
 * @param {object} moon - Moon definition
 * @returns {number|null} Nodal period in days, or null if eclipses disabled
 */
function resolveNodalPeriod(moon) {
  const mode = moon.eclipseMode ?? 'never';
  if (mode === 'never') return null;
  if (mode === 'custom') return moon.nodalPeriod ?? null;
  const multiplier = FREQUENCY_MULTIPLIERS[mode];
  if (!multiplier) return null;
  return moon.cycleLength * multiplier;
}

/**
 * Calculate how close a date is to an eclipse window center.
 * @param {number} absoluteDay - Absolute day number
 * @param {number} nodalPeriod - Nodal period in days
 * @returns {number} Sin-value (0 = at node crossing, 1 = farthest from node)
 */
function getNodalSinValue(absoluteDay, nodalPeriod) {
  const nodalPosition = (((absoluteDay % nodalPeriod) + nodalPeriod) % nodalPeriod) / nodalPeriod;
  return Math.abs(Math.sin(nodalPosition * 2 * Math.PI));
}

/**
 * Determine solar eclipse subtype from proximity and apparent size.
 * @param {number} proximity - 0 (center) to 1 (edge) within window
 * @param {number} apparentSize - Moon apparent size relative to sun
 * @returns {string} Eclipse type
 */
function getSolarEclipseType(proximity, apparentSize) {
  if (proximity < 0.3) return apparentSize >= 1.0 ? ECLIPSE_TYPES.TOTAL_SOLAR : ECLIPSE_TYPES.ANNULAR_SOLAR;
  return ECLIPSE_TYPES.PARTIAL_SOLAR;
}

/**
 * Determine lunar eclipse subtype from proximity.
 * @param {number} proximity - 0 (center) to 1 (edge) within window
 * @returns {string} Eclipse type
 */
function getLunarEclipseType(proximity) {
  if (proximity < 0.3) return ECLIPSE_TYPES.TOTAL_LUNAR;
  if (proximity < 0.7) return ECLIPSE_TYPES.PARTIAL_LUNAR;
  return ECLIPSE_TYPES.PENUMBRAL_LUNAR;
}

/**
 * Check if an eclipse type is solar.
 * @param {string} type - Eclipse type
 * @returns {boolean} True if the eclipse type is solar
 */
export function isSolarEclipse(type) {
  return type === ECLIPSE_TYPES.TOTAL_SOLAR || type === ECLIPSE_TYPES.PARTIAL_SOLAR || type === ECLIPSE_TYPES.ANNULAR_SOLAR;
}

/**
 * Check if an eclipse type is lunar.
 * @param {string} type - Eclipse type
 * @returns {boolean} True if the eclipse type is lunar
 */
export function isLunarEclipse(type) {
  return type === ECLIPSE_TYPES.TOTAL_LUNAR || type === ECLIPSE_TYPES.PARTIAL_LUNAR || type === ECLIPSE_TYPES.PENUMBRAL_LUNAR;
}

/**
 * Get eclipse data for a single moon on a specific date.
 * @param {object} moon - Moon definition with eclipseMode, cycleLength, etc.
 * @param {object} date - Date to check { year, month, dayOfMonth }
 * @param {object} [calendar] - Calendar instance (uses active if not provided)
 * @returns {object} Eclipse result { type, proximity } or { type: null }
 */
export function getEclipseAtDate(moon, date, calendar = null) {
  calendar = calendar || CalendarManager.getActiveCalendar();
  if (!calendar || !moon) return { type: null };
  const nodalPeriod = resolveNodalPeriod(moon);
  if (!nodalPeriod) return { type: null };
  const absoluteDay = dateToDayNumber(date, calendar);
  const sinValue = getNodalSinValue(absoluteDay, nodalPeriod);
  if (sinValue >= ECLIPSE_WINDOW_THRESHOLD) return { type: null };
  const proximity = sinValue / ECLIPSE_WINDOW_THRESHOLD;
  const apparentSize = moon.apparentSize ?? 1.0;
  if (isNewMoon(moon, date, calendar)) return { type: getSolarEclipseType(proximity, apparentSize), proximity };
  if (isMoonFull(moon, date, calendar)) return { type: getLunarEclipseType(proximity), proximity };
  return { type: null };
}

/**
 * Estimate days until the next nodal window entry from a given day.
 * @param {number} absoluteDay - Current absolute day number
 * @param {number} nodalPeriod - Nodal period in days
 * @returns {number} Estimated days to skip (0 if already in or near a window)
 */
function estimateSkipDays(absoluteDay, nodalPeriod) {
  const sinValue = getNodalSinValue(absoluteDay, nodalPeriod);
  if (sinValue < ECLIPSE_WINDOW_THRESHOLD * 2) return 0;
  const nodalPosition = (((absoluteDay % nodalPeriod) + nodalPeriod) % nodalPeriod) / nodalPeriod;
  const distTo0 = nodalPosition;
  const distTo05 = Math.abs(nodalPosition - 0.5);
  const distTo1 = 1.0 - nodalPosition;
  const minDist = Math.min(distTo0, distTo05, distTo1);
  const windowHalfWidth = Math.asin(ECLIPSE_WINDOW_THRESHOLD) / (2 * Math.PI);
  const skipFraction = Math.max(0, minDist - windowHalfWidth);
  return Math.floor(skipFraction * nodalPeriod);
}

/**
 * Find the next eclipse for a single moon.
 * @param {object} moon - Moon definition
 * @param {object} startDate - Date to start searching from { year, month, dayOfMonth }
 * @param {object} [options] - Search options
 * @param {number} [options.maxDays] - Maximum days to search
 * @param {object} [options.calendar] - Calendar instance
 * @returns {object|null} Result { date, type, proximity } or null if not found
 */
export function getNextEclipse(moon, startDate, options = {}) {
  const { maxDays = 2000, calendar: providedCalendar } = options;
  const calendar = providedCalendar || CalendarManager.getActiveCalendar();
  if (!calendar || !moon) return null;
  const nodalPeriod = resolveNodalPeriod(moon);
  if (!nodalPeriod) return null;
  let currentDate = { ...startDate };
  let daysSearched = 0;
  while (daysSearched < maxDays) {
    const absoluteDay = dateToDayNumber(currentDate, calendar);
    const skip = estimateSkipDays(absoluteDay, nodalPeriod);
    if (skip > 1) {
      const toSkip = Math.min(skip - 1, maxDays - daysSearched);
      for (let s = 0; s < toSkip; s++) currentDate = addOneDay(currentDate, calendar);
      daysSearched += toSkip;
      continue;
    }
    const result = getEclipseAtDate(moon, currentDate, calendar);
    if (result.type) return { date: { ...currentDate }, type: result.type, proximity: result.proximity };
    currentDate = addOneDay(currentDate, calendar);
    daysSearched++;
  }
  return null;
}

/**
 * Get all eclipses for a single moon within a date range.
 * @param {object} moon - Moon definition
 * @param {object} startDate - Range start { year, month, dayOfMonth }
 * @param {object} endDate - Range end { year, month, dayOfMonth }
 * @param {object} [options] - Search options
 * @param {object} [options.calendar] - Calendar instance
 * @returns {Array} Array of { date, type, proximity }
 */
export function getEclipsesInRange(moon, startDate, endDate, options = {}) {
  const calendar = options.calendar || CalendarManager.getActiveCalendar();
  if (!calendar || !moon) return [];
  const nodalPeriod = resolveNodalPeriod(moon);
  if (!nodalPeriod) return [];
  const eclipses = [];
  let currentDate = { ...startDate };
  let maxIterations = 10000;
  while (compareDates(currentDate, endDate) <= 0 && maxIterations-- > 0) {
    const absoluteDay = dateToDayNumber(currentDate, calendar);
    const skip = estimateSkipDays(absoluteDay, nodalPeriod);
    if (skip > 1) {
      for (let s = 0; s < skip - 1 && compareDates(currentDate, endDate) <= 0; s++) currentDate = addOneDay(currentDate, calendar);
      continue;
    }
    const result = getEclipseAtDate(moon, currentDate, calendar);
    if (result.type) {
      eclipses.push({ date: { ...currentDate }, type: result.type, proximity: result.proximity });
      for (let s = 0; s < 2; s++) currentDate = addOneDay(currentDate, calendar);
    } else {
      currentDate = addOneDay(currentDate, calendar);
    }
  }
  return eclipses;
}

/**
 * Check all moons for an eclipse on a specific date. Returns the first found.
 * @param {Array} moons - Array of moon definitions
 * @param {object} date - Date to check { year, month, dayOfMonth }
 * @param {object} [calendar] - Calendar instance
 * @returns {object|null} Result { type, proximity, moonIndex } or null
 */
export function getEclipseOnDate(moons, date, calendar = null) {
  calendar = calendar || CalendarManager.getActiveCalendar();
  if (!calendar || !moons?.length) return null;
  for (let i = 0; i < moons.length; i++) {
    const result = getEclipseAtDate(moons[i], date, calendar);
    if (result.type) return { type: result.type, proximity: result.proximity, moonIndex: i };
  }
  return null;
}

/**
 * Check if any eclipse occurs on a specific date across all moons.
 * @param {Array} moons - Array of moon definitions
 * @param {object} date - Date to check { year, month, dayOfMonth }
 * @param {object} [calendar] - Calendar instance
 * @returns {boolean} True if any eclipse occurs on the given date
 */
export function isEclipseOnDate(moons, date, calendar = null) {
  return getEclipseOnDate(moons, date, calendar) !== null;
}
