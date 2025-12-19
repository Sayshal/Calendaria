/**
 * Moon Utility Functions
 * Provides calendar-agnostic moon phase calculations.
 *
 * @module Utils/MoonUtils
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';

/**
 * Get the current phase position (0-1) for a moon at a given date.
 * @param {object} moon - Moon definition with cycleLength and referenceDate
 * @param {object} date - Date to check { year, month, day }
 * @param {object} calendar - Calendar instance (optional, uses active if not provided)
 * @returns {number} Phase position from 0 to 1
 */
export function getMoonPhasePosition(moon, date, calendar = null) {
  calendar = calendar || CalendarManager.getActiveCalendar();
  if (!calendar || !moon) return 0;

  const daysBetween = calculateDaysBetween(moon.referenceDate, date, calendar);
  const cyclePosition = ((daysBetween % moon.cycleLength) + moon.cycleLength) % moon.cycleLength;
  return cyclePosition / moon.cycleLength;
}

/**
 * Check if a moon is in its full phase at a given date.
 * @param {object} moon - Moon definition
 * @param {object} date - Date to check
 * @param {object} calendar - Calendar instance (optional)
 * @returns {boolean} True if moon is full
 */
export function isMoonFull(moon, date, calendar = null) {
  const position = getMoonPhasePosition(moon, date, calendar);
  return position >= 0.5 && position < 0.625;
}

/**
 * Find the next date when all moons are simultaneously full (Convergence).
 * @param {Array} moons - Array of moon definitions
 * @param {object} startDate - Date to start searching from { year, month, day }
 * @param {object} options - Search options
 * @param {number} options.maxDays - Maximum days to search (default: 1000)
 * @param {object} options.calendar - Calendar instance (optional)
 * @returns {object|null} Next convergence date, or null if not found within maxDays
 */
export function getNextConvergence(moons, startDate, options = {}) {
  const { maxDays = 1000, calendar: providedCalendar } = options;
  const calendar = providedCalendar || CalendarManager.getActiveCalendar();

  if (!calendar || !moons || moons.length === 0) return null;

  // Single moon - just find next full moon
  if (moons.length === 1) return getNextFullMoon(moons[0], startDate, { maxDays, calendar });

  // Multiple moons - find when all are full simultaneously
  let currentDate = { ...startDate };

  for (let i = 0; i < maxDays; i++) {
    const allFull = moons.every((moon) => isMoonFull(moon, currentDate, calendar));
    if (allFull) return currentDate;
    currentDate = addOneDay(currentDate, calendar);
  }

  return null;
}

/**
 * Find the next full moon date for a single moon.
 * @param {object} moon - Moon definition
 * @param {object} startDate - Date to start searching from
 * @param {object} options - Search options
 * @returns {object|null} Next full moon date
 */
export function getNextFullMoon(moon, startDate, options = {}) {
  const { maxDays = 1000, calendar: providedCalendar } = options;
  const calendar = providedCalendar || CalendarManager.getActiveCalendar();

  if (!calendar || !moon) return null;

  let currentDate = { ...startDate };

  for (let i = 0; i < maxDays; i++) {
    if (isMoonFull(moon, currentDate, calendar)) return currentDate;
    currentDate = addOneDay(currentDate, calendar);
  }

  return null;
}

/**
 * Get all convergences within a date range.
 * @param {Array} moons - Array of moon definitions
 * @param {object} startDate - Range start date
 * @param {object} endDate - Range end date
 * @param {object} options - Search options
 * @returns {Array} Array of convergence dates
 */
export function getConvergencesInRange(moons, startDate, endDate, options = {}) {
  const calendar = options.calendar || CalendarManager.getActiveCalendar();
  if (!calendar || !moons || moons.length === 0) return [];

  const convergences = [];
  let currentDate = { ...startDate };
  let maxIterations = 10000; // Safety limit

  while (compareDates(currentDate, endDate) <= 0 && maxIterations-- > 0) {
    const allFull = moons.every((moon) => isMoonFull(moon, currentDate, calendar));
    if (allFull) {
      convergences.push({ ...currentDate });
      // Skip ahead past the full moon phase to avoid duplicates
      for (let skip = 0; skip < 5; skip++) currentDate = addOneDay(currentDate, calendar);
    } else {
      currentDate = addOneDay(currentDate, calendar);
    }
  }

  return convergences;
}

/**
 * Calculate days between two dates.
 * @param {object} date1 - First date { year, month, day }
 * @param {object} date2 - Second date { year, month, day }
 * @param {object} calendar - Calendar instance
 * @returns {number} Days between dates (negative if date1 > date2)
 */
function calculateDaysBetween(date1, date2, calendar) {
  const days1 = dateToDayNumber(date1, calendar);
  const days2 = dateToDayNumber(date2, calendar);
  return days2 - days1;
}

/**
 * Convert a date to an absolute day number for comparison.
 * @param {object} date - Date { year, month, day }
 * @param {object} calendar - Calendar instance
 * @returns {number} Absolute day number
 */
function dateToDayNumber(date, calendar) {
  const daysPerYear = calendar.days?.daysPerYear ?? 365;
  const months = calendar.months?.values ?? [];

  let dayNumber = date.year * daysPerYear;

  // Add days for completed months
  for (let m = 0; m < date.month && m < months.length; m++) dayNumber += months[m]?.days ?? 30;

  // Add day within month (convert from 1-indexed to 0-indexed)
  dayNumber += (date.day ?? 1) - 1;

  return dayNumber;
}

/**
 * Add one day to a date.
 * @param {object} date - Date to increment
 * @param {object} calendar - Calendar instance
 * @returns {object} New date
 */
function addOneDay(date, calendar) {
  const months = calendar.months?.values ?? [];
  let { year, month, day } = date;

  day++;

  // Check if we've exceeded the days in this month
  const daysInMonth = months[month]?.days ?? 30;
  if (day > daysInMonth) {
    day = 1;
    month++;

    // Check if we've exceeded the months in this year
    if (month >= months.length) {
      month = 0;
      year++;
    }
  }

  return { year, month, day };
}

/**
 * Compare two dates.
 * @param {object} date1 - First date
 * @param {object} date2 - Second date
 * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
function compareDates(date1, date2) {
  if (date1.year !== date2.year) return date1.year < date2.year ? -1 : 1;
  if (date1.month !== date2.month) return date1.month < date2.month ? -1 : 1;
  if (date1.day !== date2.day) return date1.day < date2.day ? -1 : 1;
  return 0;
}
