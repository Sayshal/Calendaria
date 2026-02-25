/**
 * Calendar Utility Functions
 * @module Calendar/CalendarUtils
 * @author Tyler
 */

import { format, localize } from '../utils/localization.mjs';

/**
 * Parse a single interval string into an interval object.
 * @param {string|number} intervalStr - Interval string like "4", "!100", or "+400"
 * @param {number} offset - Offset for modulo calculation (typically leapStart)
 * @returns {{interval: number, subtracts: boolean, offset: number}} - Parsed interval object
 */
export function parseInterval(intervalStr, offset = 0) {
  const str = String(intervalStr).trim();
  const subtracts = str.includes('!');
  const ignoresOffset = str.includes('+');
  const interval = Math.max(1, parseInt(str.replace(/[!+]/g, ''), 10) || 1);
  const normalizedOffset = interval === 1 || ignoresOffset ? 0 : (((interval + offset) % interval) + interval) % interval;
  return { interval, subtracts, offset: normalizedOffset };
}

/**
 * Parse a full pattern string into an array of interval objects.
 * @param {string} pattern - Pattern string like "400,!100,4"
 * @param {number} [offset] - Offset for modulo (typically leapStart)
 * @returns {Array<{interval: number, subtracts: boolean, offset: number}>} - Array of interval objects
 */
export function parsePattern(pattern, offset = 0) {
  if (!pattern || typeof pattern !== 'string') return [];
  return pattern
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseInterval(s, offset));
}

/**
 * Get vote for a single interval on a given year.
 * @param {{interval: number, subtracts: boolean, offset: number}} intervalObj - Interval config object
 * @param {number} year - Year to check
 * @param {boolean} [yearZeroExists] - Whether year 0 exists in the calendar
 * @returns {'allow'|'deny'|'abstain'} - Vote result
 */
export function voteOnYear(intervalObj, year, yearZeroExists = true) {
  let mod = year - intervalObj.offset;
  if (!yearZeroExists && year < 0) mod++;
  if (mod % intervalObj.interval === 0) return intervalObj.subtracts ? 'deny' : 'allow';
  return 'abstain';
}

/**
 * Determine if a year is a leap year using interval pattern voting.
 * @param {Array<{interval: number, subtracts: boolean, offset: number}>} intervals - Parsed intervals
 * @param {number} year - Year to check
 * @param {boolean} [yearZeroExists] - Whether year 0 exists
 * @returns {boolean} - Is leap year?
 */
export function intersectsYear(intervals, year, yearZeroExists = true) {
  if (!intervals || intervals.length === 0) return false;
  const votes = intervals.map((interval) => voteOnYear(interval, year, yearZeroExists));
  const total = votes.reduce((acc, vote) => {
    if (vote === 'allow') return acc + 1;
    if (vote === 'deny') return acc - 1;
    return acc;
  }, 0);
  return total > 0;
}

/**
 * Check if a year is a leap year based on leap year configuration.
 * @param {object} leapYearConfig - Leap year configuration object
 * @param {string} [leapYearConfig.rule] - Rule type
 * @param {number} [leapYearConfig.interval] - Simple interval (for 'simple' rule)
 * @param {number} [leapYearConfig.start] - First leap year (offset)
 * @param {string} [leapYearConfig.pattern] - Custom pattern (for 'custom' rule)
 * @param {number} year - Year to check
 * @param {boolean} [yearZeroExists] - Whether year 0 exists
 * @returns {boolean} - Is leap year?
 */
export function isLeapYear(leapYearConfig, year, yearZeroExists = true) {
  if (!leapYearConfig) return false;
  const rule = leapYearConfig.rule || 'none';
  const start = leapYearConfig.start ?? leapYearConfig.leapStart ?? 0;
  switch (rule) {
    case 'none':
      return false;
    case 'simple': {
      const interval = leapYearConfig.interval ?? leapYearConfig.leapInterval;
      if (!interval || interval <= 0) return false;
      const intervals = [parseInterval(String(interval), start)];
      return intersectsYear(intervals, year, yearZeroExists);
    }
    case 'gregorian': {
      const intervals = parsePattern('400,!100,4', start);
      return intersectsYear(intervals, year, yearZeroExists);
    }
    case 'custom': {
      const pattern = leapYearConfig.pattern;
      if (!pattern) return false;
      const intervals = parsePattern(pattern, start);
      return intersectsYear(intervals, year, yearZeroExists);
    }
    default:
      return false;
  }
}

/**
 * Get a human-readable description of a leap year rule.
 * @param {object} leapYearConfig - Leap year configuration
 * @returns {string} - Human-readable description
 */
export function getLeapYearDescription(leapYearConfig) {
  if (!leapYearConfig) return localize('CALENDARIA.LeapYear.None');
  const rule = leapYearConfig.rule || 'none';
  switch (rule) {
    case 'none':
      return localize('CALENDARIA.LeapYear.None');
    case 'simple': {
      const interval = leapYearConfig.interval ?? leapYearConfig.leapInterval ?? 4;
      const start = leapYearConfig.start ?? leapYearConfig.leapStart ?? 0;
      return format('CALENDARIA.LeapYear.Simple', { interval, start });
    }
    case 'gregorian':
      return localize('CALENDARIA.LeapYear.Gregorian');
    case 'custom': {
      const pattern = leapYearConfig.pattern || '';
      return format('CALENDARIA.LeapYear.Custom', { pattern });
    }
    default:
      return localize('CALENDARIA.LeapYear.None');
  }
}

/** @type {Set<string>} Keys whose string values should be localized */
const LOCALIZE_KEYS = new Set(['name', 'abbreviation', 'description']);

/**
 * Prelocalize calendar configuration data.
 * @param {object} calendarData - Calendar definition object to prelocalize
 */
export function preLocalizeCalendar(calendarData) {
  if (!calendarData) return;
  /** @param {*} value - Value to walk */
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      if (LOCALIZE_KEYS.has(key) && typeof entry === 'string') {
        value[key] = localize(entry);
        continue;
      }
      walk(entry);
    }
  }
  walk(calendarData);
}

/**
 * Find festival day for a given date.
 * @param {object} calendar - Calendar instance with festivals array
 * @param {number|object} time - Time to check (worldTime number or components object)
 * @returns {object|null} Festival object if found, null otherwise
 */
export function findFestivalDay(calendar, time = game.time.worldTime) {
  if (!calendar.festivalsArray?.length) return null;
  const components = typeof time === 'number' ? calendar.timeToComponents(time) : time;
  return calendar.festivalsArray.find((f) => f.month === components.month + 1 && f.day === components.dayOfMonth + 1) ?? null;
}

/**
 * Get month abbreviation with fallback to full name.
 * @param {object} month - Month object from calendar definition
 * @returns {string} Month abbreviation or full name if abbreviation is undefined
 */
export function getMonthAbbreviation(month) {
  return month.abbreviation ?? month.name;
}

/**
 * Format a date as "Day Month" or festival name if applicable.
 * @param {object} calendar - Calendar instance
 * @param {object} components - Date components
 * @param {object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatMonthDay(calendar, components, options = {}) {
  const festivalDay = findFestivalDay(calendar, components);
  if (festivalDay) return localize(festivalDay.name);
  const day = components.dayOfMonth + 1;
  const month = calendar.monthsArray[components.month];
  const monthName = options.abbreviated ? getMonthAbbreviation(month) : month.name;
  return format('CALENDARIA.Formatters.DayMonth', { day, month: localize(monthName) });
}

/**
 * Format a date as "Day Month Year" or "Festival, Year" if applicable.
 * @param {object} calendar - Calendar instance
 * @param {object} components - Date components
 * @param {object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatMonthDayYear(calendar, components, options = {}) {
  const festivalDay = findFestivalDay(calendar, components);
  if (festivalDay) {
    const year = components.year + (calendar.years?.yearZero ?? 0);
    return format('CALENDARIA.Formatters.FestivalDayYear', { day: localize(festivalDay.name), yyyy: year });
  }
  const day = components.dayOfMonth + 1;
  const month = calendar.monthsArray[components.month];
  const monthName = options.abbreviated ? getMonthAbbreviation(month) : month.name;
  const year = components.year + (calendar.years?.yearZero ?? 0);
  return format('CALENDARIA.Formatters.DayMonthYear', { day, month: localize(monthName), yyyy: year });
}

/**
 * Format an era template string by replacing tokens with era data.
 * @param {string} template - Template string with tokens
 * @param {object} data - Era data object
 * @returns {string} Formatted string
 */
export function formatEraTemplate(template, data = {}) {
  const era = data.era ?? data.name ?? '';
  const abbreviation = data.abbreviation ?? data.short ?? '';
  const year = data.year ?? 0;
  const yearInEra = data.yearInEra ?? year;
  return template.replace(/YYYY/g, String(year)).replace(/YY/g, String(year).slice(-2)).replace(/GGGG/g, era).replace(/yy/g, String(yearInEra)).replace(/G/g, abbreviation);
}
