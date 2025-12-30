/**
 * Recurring Event Logic
 * Handles pattern matching for repeating calendar notes.
 * @module Notes/Utils/Recurrence
 * @author Tyler
 */

import { compareDates, compareDays, daysBetween, monthsBetween, dayOfWeek, isSameDay, addDays, addMonths, addYears } from './date-utils.mjs';
import { localize, format } from '../../utils/localization.mjs';
import CalendarManager from '../../calendar/calendar-manager.mjs';
import NoteManager from '../note-manager.mjs';

/**
 * Seeded random number generator.
 * Same inputs always produce the same output (deterministic).
 * @param {number} seed - Base seed value
 * @param {number} year - Year component
 * @param {number} dayOfYear - Day of year (1-366)
 * @returns {number} Value between 0-99.99
 */
function seededRandom(seed, year, dayOfYear) {
  // LCG-based hash for deterministic pseudo-randomness
  let hash = Math.abs(seed) || 1;
  hash = ((hash * 1103515245 + 12345) >>> 0) % 0x7fffffff;
  hash = ((hash + year * 31337) >>> 0) % 0x7fffffff;
  hash = ((hash * 1103515245 + dayOfYear * 7919) >>> 0) % 0x7fffffff;
  return (hash % 10000) / 100;
}

/**
 * Calculate day of year for a date (1-based).
 * @param {object} date - Date with year, month, day
 * @returns {number} Day of year (1-366)
 */
function getDayOfYear(date) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar?.months?.values) return date.day;

  let dayOfYear = 0;
  for (let m = 0; m < date.month; m++) {
    const monthData = calendar.months.values[m];
    dayOfYear += monthData?.days ?? 30;
  }
  return dayOfYear + date.day;
}

/* -------------------------------------------- */
/*  Condition Evaluation System                 */
/* -------------------------------------------- */

/**
 * Get the value of a condition field for a given date.
 * @param {string} field - Field name
 * @param {object} date - Date to evaluate
 * @param {*} value2 - Secondary value (e.g., moon index, cycle index)
 * @returns {number|boolean|string|null} Field value
 */
function getFieldValue(field, date, value2 = null) {
  const calendar = CalendarManager.getActiveCalendar();

  switch (field) {
    // Date fields
    case 'year':
      return date.year;

    case 'month':
      return date.month + 1; // Convert 0-indexed to 1-indexed for user

    case 'day':
      return date.day; // Already 1-indexed

    case 'dayOfYear':
      return getDayOfYear(date);

    case 'daysBeforeMonthEnd': {
      const lastDay = getLastDayOfMonth(date);
      return lastDay - date.day;
    }

    // Weekday fields (1-indexed for user: 1=first weekday)
    case 'weekday':
      return dayOfWeek(date) + 1; // Convert 0-indexed to 1-indexed

    case 'weekNumberInMonth': {
      const daysInWeek = calendar?.days?.values?.length || 7;
      return Math.ceil(date.day / daysInWeek);
    }

    case 'inverseWeekNumber': {
      const daysInWeek = calendar?.days?.values?.length || 7;
      const lastDay = getLastDayOfMonth(date);
      return Math.floor((lastDay - date.day) / daysInWeek) + 1;
    }

    // Week fields
    case 'weekInMonth': {
      const daysInWeek = calendar?.days?.values?.length || 7;
      return Math.ceil(date.day / daysInWeek);
    }

    case 'weekInYear': {
      const daysInWeek = calendar?.days?.values?.length || 7;
      const dayOfYear = getDayOfYear(date);
      return Math.ceil(dayOfYear / daysInWeek);
    }

    case 'totalWeek': {
      // Total weeks since year 0 - requires epoch calculation
      const daysInWeek = calendar?.days?.values?.length || 7;
      const totalDays = getTotalDaysSinceEpoch(date);
      return Math.floor(totalDays / daysInWeek);
    }

    case 'weeksBeforeMonthEnd': {
      const daysInWeek = calendar?.days?.values?.length || 7;
      const lastDay = getLastDayOfMonth(date);
      return Math.floor((lastDay - date.day) / daysInWeek);
    }

    case 'weeksBeforeYearEnd': {
      const daysInWeek = calendar?.days?.values?.length || 7;
      const totalDaysInYear = getTotalDaysInYear();
      const dayOfYear = getDayOfYear(date);
      return Math.floor((totalDaysInYear - dayOfYear) / daysInWeek);
    }

    // Season fields
    case 'season': {
      const seasons = calendar?.seasons?.values || [];
      if (!seasons.length) return null;
      const dayOfYear = getDayOfYear(date);
      return getSeasonIndex(dayOfYear, seasons, getTotalDaysInYear()) + 1; // 1-indexed for user
    }

    case 'seasonPercent': {
      const seasons = calendar?.seasons?.values || [];
      if (!seasons.length) return null;
      const dayOfYear = getDayOfYear(date);
      return getSeasonPercent(dayOfYear, seasons, getTotalDaysInYear());
    }

    case 'seasonDay': {
      const seasons = calendar?.seasons?.values || [];
      if (!seasons.length) return null;
      const dayOfYear = getDayOfYear(date);
      return getSeasonDay(dayOfYear, seasons, getTotalDaysInYear());
    }

    case 'isLongestDay': {
      const seasons = calendar?.seasons?.values || [];
      if (!seasons.length) return false;
      // Longest day is typically summer solstice - mid-point of summer
      return checkSolsticeOrEquinox(date, seasons, 'longest');
    }

    case 'isShortestDay': {
      const seasons = calendar?.seasons?.values || [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'shortest');
    }

    case 'isSpringEquinox': {
      const seasons = calendar?.seasons?.values || [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'spring');
    }

    case 'isAutumnEquinox': {
      const seasons = calendar?.seasons?.values || [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'autumn');
    }

    // Moon fields
    case 'moonPhase': {
      const moons = calendar?.moons || [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      return getMoonPhase(date, moons[moonIndex]);
    }

    case 'moonPhaseIndex': {
      const moons = calendar?.moons || [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      const phase = getMoonPhase(date, moons[moonIndex]);
      const phaseCount = moons[moonIndex].phases?.length || 8;
      return Math.floor(phase * phaseCount);
    }

    case 'moonPhaseCountMonth': {
      // Nth occurrence of this phase in the month
      const moons = calendar?.moons || [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      return getMoonPhaseCountInMonth(date, moons[moonIndex]);
    }

    case 'moonPhaseCountYear': {
      // Nth occurrence of this phase in the year
      const moons = calendar?.moons || [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      return getMoonPhaseCountInYear(date, moons[moonIndex]);
    }

    // Other fields
    case 'cycle': {
      const cycles = calendar?.cycles || [];
      const cycleIndex = value2 ?? 0;
      if (cycleIndex >= cycles.length) return null;
      return getCycleValue(date, cycles[cycleIndex]);
    }

    case 'era': {
      const eras = calendar?.eras || [];
      if (!eras.length) return null;
      return getEraIndex(date.year, eras) + 1; // 1-indexed for user
    }

    case 'eraYear': {
      const eras = calendar?.eras || [];
      if (!eras.length) return date.year;
      return getEraYear(date.year, eras);
    }

    case 'intercalary': {
      const months = calendar?.months?.values || [];
      const monthData = months[date.month];
      return monthData?.type === 'intercalary';
    }

    default:
      return null;
  }
}

/**
 * Evaluate a single condition against a date.
 * @param {object} condition - Condition { field, op, value, value2?, offset? }
 * @param {object} date - Date to evaluate
 * @returns {boolean} True if condition passes
 */
function evaluateCondition(condition, date) {
  const { field, op, value, value2, offset = 0 } = condition;
  const fieldValue = getFieldValue(field, date, value2);

  if (fieldValue === null || fieldValue === undefined) return false;

  switch (op) {
    case '==':
      return fieldValue === value;
    case '!=':
      return fieldValue !== value;
    case '>=':
      return fieldValue >= value;
    case '<=':
      return fieldValue <= value;
    case '>':
      return fieldValue > value;
    case '<':
      return fieldValue < value;
    case '%':
      // Modulo: (fieldValue - offset) % value === 0
      if (value === 0) return false;
      return ((fieldValue - offset) % value) === 0;
    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a date (AND logic).
 * @param {object[]} conditions - Array of conditions
 * @param {object} date - Date to evaluate
 * @returns {boolean} True if all conditions pass
 */
function evaluateConditions(conditions, date) {
  if (!conditions?.length) return true;
  return conditions.every((cond) => evaluateCondition(cond, date));
}

/* -------------------------------------------- */
/*  Condition Helper Functions                  */
/* -------------------------------------------- */

/**
 * Get total days since epoch (year 0, day 1).
 * @param {object} date - Date object
 * @returns {number}
 */
function getTotalDaysSinceEpoch(date) {
  const calendar = CalendarManager.getActiveCalendar();
  const daysPerYear = getTotalDaysInYear();
  const yearZero = calendar?.years?.yearZero ?? 0;
  const yearsFromEpoch = date.year - yearZero;
  const dayOfYear = getDayOfYear(date);
  // Simplified - doesn't account for leap years
  return yearsFromEpoch * daysPerYear + dayOfYear;
}

/**
 * Get current season index for a day of year.
 * @param {number} dayOfYear - Day of year
 * @param {object[]} seasons - Seasons array
 * @param {number} totalDays - Total days in year
 * @returns {number} Season index
 */
function getSeasonIndex(dayOfYear, seasons, totalDays) {
  for (let i = 0; i < seasons.length; i++) {
    const season = seasons[i];
    const start = season.dayStart ?? 0;
    const end = season.dayEnd ?? start;

    if (isInSeasonRange(dayOfYear, start, end, totalDays)) {
      return i;
    }
  }
  return 0;
}

/**
 * Get percentage progress through current season (0-100).
 * @param {number} dayOfYear - Day of year
 * @param {object[]} seasons - Seasons array
 * @param {number} totalDays - Total days in year
 * @returns {number} Percentage (0-100)
 */
function getSeasonPercent(dayOfYear, seasons, totalDays) {
  const idx = getSeasonIndex(dayOfYear, seasons, totalDays);
  const season = seasons[idx];
  const start = season.dayStart ?? 0;
  const end = season.dayEnd ?? start;

  let seasonLength, dayInSeason;
  if (start <= end) {
    seasonLength = end - start + 1;
    dayInSeason = dayOfYear - start;
  } else {
    // Wrapping season
    seasonLength = (totalDays - start) + end + 1;
    dayInSeason = dayOfYear >= start ? dayOfYear - start : (totalDays - start) + dayOfYear;
  }

  return Math.round((dayInSeason / seasonLength) * 100);
}

/**
 * Get day number within current season (1-based).
 * @param {number} dayOfYear - Day of year
 * @param {object[]} seasons - Seasons array
 * @param {number} totalDays - Total days in year
 * @returns {number} Day in season
 */
function getSeasonDay(dayOfYear, seasons, totalDays) {
  const idx = getSeasonIndex(dayOfYear, seasons, totalDays);
  const season = seasons[idx];
  const start = season.dayStart ?? 0;

  if (dayOfYear >= start) {
    return dayOfYear - start + 1;
  } else {
    // Wrapping season
    return (totalDays - start) + dayOfYear + 1;
  }
}

/**
 * Check if date is a solstice or equinox.
 * @param {object} date - Date to check
 * @param {object[]} seasons - Seasons array
 * @param {string} type - 'longest', 'shortest', 'spring', 'autumn'
 * @returns {boolean}
 */
function checkSolsticeOrEquinox(date, seasons, type) {
  const totalDays = getTotalDaysInYear();
  const dayOfYear = getDayOfYear(date);

  // Find summer and winter seasons by name or position
  let summerIdx = seasons.findIndex((s) => /summer/i.test(s.name));
  let winterIdx = seasons.findIndex((s) => /winter/i.test(s.name));
  let springIdx = seasons.findIndex((s) => /spring/i.test(s.name));
  let autumnIdx = seasons.findIndex((s) => /autumn|fall/i.test(s.name));

  // Default to positions if names not found (assuming 4 seasons)
  if (summerIdx === -1 && seasons.length >= 4) summerIdx = 1;
  if (winterIdx === -1 && seasons.length >= 4) winterIdx = 3;
  if (springIdx === -1 && seasons.length >= 4) springIdx = 0;
  if (autumnIdx === -1 && seasons.length >= 4) autumnIdx = 2;

  switch (type) {
    case 'longest': {
      // Summer solstice - midpoint of summer
      if (summerIdx === -1) return false;
      const summer = seasons[summerIdx];
      const midpoint = getMidpoint(summer.dayStart ?? 0, summer.dayEnd ?? 0, totalDays);
      return dayOfYear === midpoint;
    }

    case 'shortest': {
      // Winter solstice - midpoint of winter
      if (winterIdx === -1) return false;
      const winter = seasons[winterIdx];
      const midpoint = getMidpoint(winter.dayStart ?? 0, winter.dayEnd ?? 0, totalDays);
      return dayOfYear === midpoint;
    }

    case 'spring': {
      // Spring equinox - first day of spring
      if (springIdx === -1) return false;
      return dayOfYear === (seasons[springIdx].dayStart ?? 0);
    }

    case 'autumn': {
      // Autumn equinox - first day of autumn
      if (autumnIdx === -1) return false;
      return dayOfYear === (seasons[autumnIdx].dayStart ?? 0);
    }

    default:
      return false;
  }
}

/**
 * Get midpoint of a season range.
 * @param {number} start - Start day
 * @param {number} end - End day
 * @param {number} totalDays - Total days in year
 * @returns {number} Midpoint day
 */
function getMidpoint(start, end, totalDays) {
  if (start <= end) {
    return Math.floor((start + end) / 2);
  } else {
    // Wrapping
    const length = (totalDays - start) + end + 1;
    const mid = Math.floor(length / 2);
    return (start + mid) % totalDays;
  }
}

/**
 * Get moon phase (0-1) for a date.
 * @param {object} date - Date to check
 * @param {object} moon - Moon configuration
 * @returns {number} Phase 0-1
 */
function getMoonPhase(date, moon) {
  if (!moon?.cycleLength) return 0;

  const calendar = CalendarManager.getActiveCalendar();
  const refDate = moon.referenceDate || { year: 1, month: 0, day: 1 };

  // Calculate days between reference and target
  const totalDays = daysBetween(refDate, date);
  const adjustedDays = totalDays + (moon.cycleDayAdjust || 0);

  // Get position in cycle
  const cyclePosition = ((adjustedDays % moon.cycleLength) + moon.cycleLength) % moon.cycleLength;
  return cyclePosition / moon.cycleLength;
}

/**
 * Get count of current moon phase occurrences in the month.
 * @param {object} date - Date to check
 * @param {object} moon - Moon configuration
 * @returns {number} Count (1 = first occurrence)
 */
function getMoonPhaseCountInMonth(date, moon) {
  const currentPhaseIndex = Math.floor(getMoonPhase(date, moon) * (moon.phases?.length || 8));
  let count = 0;

  for (let day = 1; day <= date.day; day++) {
    const checkDate = { ...date, day };
    const phaseIndex = Math.floor(getMoonPhase(checkDate, moon) * (moon.phases?.length || 8));
    if (phaseIndex === currentPhaseIndex) count++;
  }

  return count;
}

/**
 * Get count of current moon phase occurrences in the year.
 * @param {object} date - Date to check
 * @param {object} moon - Moon configuration
 * @returns {number} Count (1 = first occurrence)
 */
function getMoonPhaseCountInYear(date, moon) {
  const calendar = CalendarManager.getActiveCalendar();
  const currentPhaseIndex = Math.floor(getMoonPhase(date, moon) * (moon.phases?.length || 8));
  const targetDayOfYear = getDayOfYear(date);
  let count = 0;

  // Iterate through year up to current day
  let dayCounter = 0;
  const months = calendar?.months?.values || [];

  for (let m = 0; m < months.length && dayCounter < targetDayOfYear; m++) {
    const daysInMonth = months[m]?.days || 30;
    for (let d = 1; d <= daysInMonth && dayCounter < targetDayOfYear; d++) {
      dayCounter++;
      const checkDate = { year: date.year, month: m, day: d };
      const phaseIndex = Math.floor(getMoonPhase(checkDate, moon) * (moon.phases?.length || 8));
      if (phaseIndex === currentPhaseIndex) count++;
    }
  }

  return count;
}

/**
 * Get cycle value for a date.
 * @param {object} date - Date to check
 * @param {object} cycle - Cycle configuration
 * @returns {number} Cycle entry index
 */
function getCycleValue(date, cycle) {
  if (!cycle?.length || !cycle?.entries?.length) return 0;

  let value;
  switch (cycle.basedOn) {
    case 'year':
      value = date.year;
      break;
    case 'eraYear':
      value = getEraYear(date.year, CalendarManager.getActiveCalendar()?.eras || []);
      break;
    case 'month':
      value = date.month;
      break;
    case 'monthDay':
      value = date.day;
      break;
    case 'yearDay':
      value = getDayOfYear(date);
      break;
    case 'day':
    default:
      value = getTotalDaysSinceEpoch(date);
      break;
  }

  return ((value - (cycle.offset || 0)) % cycle.length + cycle.length) % cycle.length;
}

/**
 * Get era index for a year.
 * @param {number} year - Year to check
 * @param {object[]} eras - Eras array
 * @returns {number} Era index
 */
function getEraIndex(year, eras) {
  for (let i = eras.length - 1; i >= 0; i--) {
    const era = eras[i];
    if (year >= (era.startYear ?? 0)) {
      if (era.endYear == null || year <= era.endYear) {
        return i;
      }
    }
  }
  return 0;
}

/**
 * Get year within current era.
 * @param {number} year - Year to check
 * @param {object[]} eras - Eras array
 * @returns {number} Year in era
 */
function getEraYear(year, eras) {
  const idx = getEraIndex(year, eras);
  const era = eras[idx];
  if (!era) return year;
  return year - (era.startYear ?? 0) + 1;
}

/* -------------------------------------------- */
/*  Main Recurrence Functions                   */
/* -------------------------------------------- */

/**
 * Check if a recurring note occurs on a target date.
 * @param {object} noteData  Note flag data with recurrence settings
 * @param {object} targetDate  Date to check
 * @returns {boolean}  True if note occurs on this date
 */
export function isRecurringMatch(noteData, targetDate) {
  const { startDate, endDate, repeat, repeatInterval, repeatEndDate, moonConditions, randomConfig, cachedRandomOccurrences, linkedEvent, maxOccurrences } = noteData;

  // Handle linked event type - occurs relative to another event
  if (linkedEvent?.noteId) return matchesLinkedEvent(linkedEvent, targetDate, startDate, repeatEndDate);

  // Handle random repeat type
  if (repeat === 'random') {
    if (!randomConfig) return false;
    if (compareDays(targetDate, startDate) < 0) return false;
    if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;
    let matches = false;
    if (cachedRandomOccurrences?.length) matches = matchesCachedOccurrence(cachedRandomOccurrences, targetDate);
    else matches = matchesRandom(randomConfig, targetDate, startDate);
    if (matches && maxOccurrences > 0) {
      const occurrenceNum = countOccurrencesUpTo(noteData, targetDate);
      if (occurrenceNum > maxOccurrences) return false;
    }
    return matches;
  }

  // Handle moon-based repeat type
  if (repeat === 'moon') {
    // Moon repeat requires moon conditions
    if (!moonConditions?.length) return false;
    // Check if target is before start date
    if (compareDays(targetDate, startDate) < 0) return false;
    // Check if target is after repeat end date
    if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;

    // Match any day with matching moon conditions
    const matches = matchesMoonConditions(moonConditions, targetDate);

    // Check maxOccurrences limit
    if (matches && maxOccurrences > 0) {
      const occurrenceNum = countOccurrencesUpTo(noteData, targetDate);
      if (occurrenceNum > maxOccurrences) return false;
    }
    return matches;
  }

  // Check moon conditions as filter for other repeat types (if any)
  // Moon conditions act as additional filters - if defined, at least one must match
  if (moonConditions?.length > 0) if (!matchesMoonConditions(moonConditions, targetDate)) return false;

  // If no recurrence, only matches exact start date (but still check conditions)
  if (repeat === 'never' || !repeat) {
    if (!isSameDay(startDate, targetDate)) return false;
    // Apply conditions even for non-recurring events
    if (noteData.conditions?.length > 0) {
      if (!evaluateConditions(noteData.conditions, targetDate)) return false;
    }
    return true;
  }

  // Check if target is before start date (day-level comparison, ignoring time)
  if (compareDays(targetDate, startDate) < 0) return false;

  // Check if target is after repeat end date
  if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;

  // Check if target is during multi-day event (only if endDate is different from startDate)
  if (endDate && !isSameDay(startDate, endDate)) {
    const afterStart = compareDays(targetDate, startDate) >= 0;
    const beforeEnd = compareDays(targetDate, endDate) <= 0;
    if (afterStart && beforeEnd) return true; // Within multi-day event range
  }

  const interval = repeatInterval || 1;

  let matches = false;
  switch (repeat) {
    case 'daily':
      matches = matchesDaily(startDate, targetDate, interval);
      break;

    case 'weekly':
      matches = matchesWeekly(startDate, targetDate, interval);
      break;

    case 'monthly':
      matches = matchesMonthly(startDate, targetDate, interval);
      break;

    case 'yearly':
      matches = matchesYearly(startDate, targetDate, interval);
      break;

    case 'range':
      if (!noteData.rangePattern) return false;
      if (!matchesRangePattern(noteData.rangePattern, targetDate, startDate, repeatEndDate)) return false;
      // Apply conditions filter for range type
      if (noteData.conditions?.length > 0 && !evaluateConditions(noteData.conditions, targetDate)) return false;
      return true;

    case 'weekOfMonth':
      matches = matchesWeekOfMonth(startDate, targetDate, interval, noteData.weekday, noteData.weekNumber);
      break;

    case 'seasonal':
      matches = matchesSeasonal(noteData.seasonalConfig, targetDate, startDate);
      break;

    default:
      return false;
  }

  // Check maxOccurrences limit for standard repeat types
  if (matches && maxOccurrences > 0) {
    const occurrenceNum = countOccurrencesUpTo(noteData, targetDate);
    if (occurrenceNum > maxOccurrences) return false;
  }

  // Apply advanced conditions filter (AND logic)
  if (matches && noteData.conditions?.length > 0) {
    if (!evaluateConditions(noteData.conditions, targetDate)) return false;
  }

  return matches;
}

/**
 * Count occurrences from start date up to and including target date.
 * Used for enforcing maxOccurrences limit.
 * @param {object} noteData - Note flag data
 * @param {object} targetDate - Date to count up to (inclusive)
 * @returns {number} Number of occurrences (1-based, start date = occurrence 1)
 */
function countOccurrencesUpTo(noteData, targetDate) {
  const { startDate, repeat, repeatInterval, moonConditions, randomConfig, cachedRandomOccurrences, linkedEvent } = noteData;
  const interval = repeatInterval || 1;

  // For simple repeat types, use mathematical calculation
  switch (repeat) {
    case 'daily': {
      const daysDiff = daysBetween(startDate, targetDate);
      return Math.floor(daysDiff / interval) + 1;
    }

    case 'weekly': {
      const daysDiff = daysBetween(startDate, targetDate);
      const calendar = CalendarManager.getActiveCalendar();
      const daysInWeek = calendar?.days?.values?.length || 7;
      const weeksDiff = Math.floor(daysDiff / daysInWeek);
      return Math.floor(weeksDiff / interval) + 1;
    }

    case 'monthly': {
      const monthsDiff = monthsBetween(startDate, targetDate);
      return Math.floor(monthsDiff / interval) + 1;
    }

    case 'yearly': {
      const yearsDiff = targetDate.year - startDate.year;
      return Math.floor(yearsDiff / interval) + 1;
    }

    case 'random': {
      // Use cached occurrences if available
      if (cachedRandomOccurrences?.length) {
        let count = 0;
        for (const occ of cachedRandomOccurrences) if (compareDays(occ, targetDate) <= 0) count++;
        return count;
      }
      // Fall through to iteration
      break;
    }

    case 'weekOfMonth': {
      // Approximate count - iterate through months
      const monthsDiff = monthsBetween(startDate, targetDate);
      return Math.floor(monthsDiff / interval) + 1;
    }

    case 'seasonal':
    case 'moon':
    default:
      // Need to iterate for complex types
      break;
  }

  // For moon/random without cache/linked, iterate and count
  const occurrences = getOccurrencesInRange({ ...noteData, maxOccurrences: 0 }, startDate, targetDate, 10000);
  return occurrences.length;
}

/**
 * Check if target date matches any moon condition.
 * @param {object[]} moonConditions  Array of moon condition objects
 * @param {object} targetDate  Date to check
 * @returns {boolean}  True if any moon condition matches
 */
function matchesMoonConditions(moonConditions, targetDate) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar?.moons?.length) return false;

  // Convert targetDate to time components format for getMoonPhase
  const components = { year: targetDate.year, month: targetDate.month, dayOfMonth: targetDate.day - 1, hour: 12, minute: 0, second: 0 };

  // Check each moon condition - any match is sufficient
  for (const cond of moonConditions) {
    const moonPhase = calendar.getMoonPhase(cond.moonIndex, components);
    if (!moonPhase) continue;
    const position = moonPhase.position;
    if (cond.phaseStart <= cond.phaseEnd) {
      // Normal range
      if (position >= cond.phaseStart && position <= cond.phaseEnd) return true;
    } else {
      // Wrapping range (spans 0/1 boundary)
      if (position >= cond.phaseStart || position <= cond.phaseEnd) return true;
    }
  }

  return false;
}

/**
 * Check if target date matches a linked event occurrence.
 * The note occurs X days before/after each occurrence of the linked event.
 * @param {object} linkedEvent - Linked event config { noteId, offset }
 * @param {object} targetDate - Date to check
 * @param {object} startDate - Note's start date (filter: don't match before this)
 * @param {object} [repeatEndDate] - Note's end date (filter: don't match after this)
 * @returns {boolean} True if matches linked event
 */
function matchesLinkedEvent(linkedEvent, targetDate, startDate, repeatEndDate) {
  const { noteId, offset } = linkedEvent;
  if (!noteId) return false;

  // Check date bounds first (day-level comparison)
  if (compareDays(targetDate, startDate) < 0) return false;
  if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;

  // Get the linked note's data
  const linkedNote = NoteManager.getNote(noteId);
  if (!linkedNote?.flagData) return false;

  // Calculate the source date (what date of the linked event would produce this target date)
  // If offset is +5, then for target "Jan 10", we need linked event on "Jan 5"
  const sourceDate = addDays(targetDate, -offset);

  // Check if the linked note occurs on the source date
  // Important: avoid infinite recursion by not following linkedEvent chains
  const linkedNoteData = { ...linkedNote.flagData, linkedEvent: null };

  return isRecurringMatch(linkedNoteData, sourceDate);
}

/**
 * Get occurrences of a linked event within a date range.
 * @param {object} linkedEvent - Linked event config { noteId, offset }
 * @param {object} rangeStart - Start of date range
 * @param {object} rangeEnd - End of date range
 * @param {object} noteStartDate - This note's start date (filter)
 * @param {object} [noteEndDate] - This note's repeat end date (filter)
 * @param {number} maxOccurrences - Maximum occurrences to return
 * @returns {object[]} Array of date objects
 */
function getLinkedEventOccurrences(linkedEvent, rangeStart, rangeEnd, noteStartDate, noteEndDate, maxOccurrences) {
  const { noteId, offset } = linkedEvent;
  const occurrences = [];

  // Get linked note
  const linkedNote = NoteManager.getNote(noteId);
  if (!linkedNote?.flagData) return occurrences;

  // Calculate adjusted range for querying linked note
  // If offset is +5 (5 days after), we need to look at linked events 5 days earlier
  const adjustedRangeStart = addDays(rangeStart, -offset);
  const adjustedRangeEnd = addDays(rangeEnd, -offset);

  // Get linked note's occurrences (avoiding recursion)
  const linkedNoteData = { ...linkedNote.flagData, linkedEvent: null };
  const linkedOccurrences = getOccurrencesInRange(linkedNoteData, adjustedRangeStart, adjustedRangeEnd, maxOccurrences);

  // Apply offset to each occurrence
  for (const occ of linkedOccurrences) {
    const shiftedDate = addDays(occ, offset);

    // Filter by this note's date bounds (day-level comparison)
    if (compareDays(shiftedDate, noteStartDate) < 0) continue;
    if (noteEndDate && compareDays(shiftedDate, noteEndDate) > 0) continue;

    // Filter by original range (in case offset shifted it)
    if (compareDays(shiftedDate, rangeStart) < 0) continue;
    if (compareDays(shiftedDate, rangeEnd) > 0) continue;

    occurrences.push(shiftedDate);
    if (occurrences.length >= maxOccurrences) break;
  }

  return occurrences;
}

/**
 * Check if target date matches random event criteria.
 * Uses deterministic seeded randomness for reproducible results.
 * @param {object} randomConfig - Random configuration {seed, probability, checkInterval}
 * @param {object} targetDate - Date to check
 * @param {object} startDate - Event start date
 * @returns {boolean} True if event should occur on this date
 */
function matchesRandom(randomConfig, targetDate, startDate) {
  const { seed, probability, checkInterval } = randomConfig;
  if (probability <= 0) return false;
  if (probability >= 100) return true;

  const calendar = CalendarManager.getActiveCalendar();
  const daysInWeek = calendar?.days?.values?.length || 7;

  // For weekly/monthly intervals, only check on specific days
  if (checkInterval === 'weekly') {
    // Only check on same day of week as start date
    const startDOW = dayOfWeek(startDate);
    const targetDOW = dayOfWeek(targetDate);
    if (startDOW !== targetDOW) return false;
  } else if (checkInterval === 'monthly') {
    // Only check on same day of month as start date
    if (startDate.day !== targetDate.day) return false;
  }

  // Calculate day of year for seeded random
  const dayOfYearValue = getDayOfYear(targetDate);

  // Get deterministic random value (0-99.99)
  const randomValue = seededRandom(seed, targetDate.year, dayOfYearValue);

  return randomValue < probability;
}

/**
 * Check if note matches daily recurrence pattern.
 * @param {object} startDate  Note start date
 * @param {object} targetDate  Date to check
 * @param {number} interval  Repeat every N days
 * @returns {boolean}  True if matches
 */
function matchesDaily(startDate, targetDate, interval) {
  const daysDiff = daysBetween(startDate, targetDate);

  // Must be positive and divisible by interval
  return daysDiff >= 0 && daysDiff % interval === 0;
}

/**
 * Check if note matches weekly recurrence pattern.
 * @param {object} startDate  Note start date
 * @param {object} targetDate  Date to check
 * @param {number} interval  Repeat every N weeks
 * @returns {boolean}  True if matches
 */
function matchesWeekly(startDate, targetDate, interval) {
  const daysDiff = daysBetween(startDate, targetDate);

  // Must be positive
  if (daysDiff < 0) return false;

  // Must be same day of week
  const startDayOfWeek = dayOfWeek(startDate);
  const targetDayOfWeek = dayOfWeek(targetDate);
  if (startDayOfWeek !== targetDayOfWeek) return false;

  // Must be N weeks apart
  const calendar = CalendarManager.getActiveCalendar();
  const daysInWeek = calendar?.days?.values?.length || 7;
  const weeksDiff = Math.floor(daysDiff / daysInWeek);
  return weeksDiff % interval === 0;
}

/**
 * Check if note matches monthly recurrence pattern.
 * @param {object} startDate  Note start date
 * @param {object} targetDate  Date to check
 * @param {number} interval  Repeat every N months
 * @returns {boolean}  True if matches
 */
function matchesMonthly(startDate, targetDate, interval) {
  const monthsDiff = monthsBetween(startDate, targetDate);

  // Must be positive and divisible by interval
  if (monthsDiff < 0 || monthsDiff % interval !== 0) return false;

  // Must be same day of month
  // Handle edge case: if start date is 31st but target month has 30 days,
  // match on last day of month
  const targetMonthLastDay = getLastDayOfMonth(targetDate);
  const effectiveStartDay = Math.min(startDate.day, targetMonthLastDay);

  return targetDate.day === effectiveStartDay;
}

/**
 * Check if note matches yearly recurrence pattern.
 * @param {object} startDate  Note start date
 * @param {object} targetDate  Date to check
 * @param {number} interval  Repeat every N years
 * @returns {boolean}  True if matches
 */
function matchesYearly(startDate, targetDate, interval) {
  const yearsDiff = targetDate.year - startDate.year;

  // Must be positive and divisible by interval
  if (yearsDiff < 0 || yearsDiff % interval !== 0) return false;

  // Must be same month and day
  // Handle leap year edge case (Feb 29)
  if (startDate.month !== targetDate.month) return false;

  const targetMonthLastDay = getLastDayOfMonth(targetDate);
  const effectiveStartDay = Math.min(startDate.day, targetMonthLastDay);

  return targetDate.day === effectiveStartDay;
}

/**
 * Get last day of month for a given date.
 * @param {object} date  Date object
 * @returns {number}  Last day of month
 */
function getLastDayOfMonth(date) {
  const calendar = game.time?.calendar;
  if (!calendar) return 30;
  const monthData = calendar.months?.[date.month];
  return monthData?.days ?? 30;
}

/**
 * Check if note matches week-of-month recurrence pattern.
 * Supports ordinal weekday patterns like "2nd Tuesday" or "Last Friday".
 * @param {object} startDate - Note start date (defines the weekday if not specified)
 * @param {object} targetDate - Date to check
 * @param {number} interval - Repeat every N months
 * @param {number|null} weekday - Target weekday (0-indexed), or null to use startDate's weekday
 * @param {number|null} weekNumber - Week ordinal (1-5 for first-fifth, -1 to -5 for last to fifth-from-last)
 * @returns {boolean} True if matches
 */
function matchesWeekOfMonth(startDate, targetDate, interval, weekday, weekNumber) {
  const calendar = CalendarManager.getActiveCalendar();
  const daysInWeek = calendar?.days?.values?.length || 7;

  // Determine target weekday
  const targetWeekday = weekday ?? dayOfWeek(startDate);

  // Determine week number (default to calculating from start date)
  let targetWeekNumber = weekNumber;
  if (targetWeekNumber == null) {
    // Calculate week number from start date's day
    targetWeekNumber = Math.ceil(startDate.day / daysInWeek);
  }

  // Check if target date is on the correct weekday
  const currentWeekday = dayOfWeek(targetDate);
  if (currentWeekday !== targetWeekday) return false;

  // Check month interval
  const monthsDiff = monthsBetween(startDate, targetDate);
  if (monthsDiff < 0 || monthsDiff % interval !== 0) return false;

  // Calculate week ordinal for target date
  const targetDayWeekNumber = getWeekNumberInMonth(targetDate, daysInWeek);

  // Handle positive vs negative week numbers
  if (targetWeekNumber > 0) {
    // Positive: 1st, 2nd, 3rd, 4th, 5th occurrence
    return targetDayWeekNumber === targetWeekNumber;
  } else {
    // Negative: -1 = last, -2 = second-to-last, etc.
    const inverseWeekNumber = getInverseWeekNumberInMonth(targetDate, daysInWeek);
    return inverseWeekNumber === Math.abs(targetWeekNumber);
  }
}

/**
 * Calculate which occurrence of the weekday this day is in the month.
 * E.g., if it's the 2nd Tuesday of the month, returns 2.
 * @param {object} date - Date to check
 * @param {number} daysInWeek - Days per week in this calendar
 * @returns {number} Week ordinal (1-5)
 */
function getWeekNumberInMonth(date, daysInWeek) {
  // The Nth occurrence of a weekday in a month is ceil(day / daysInWeek)
  return Math.ceil(date.day / daysInWeek);
}

/**
 * Calculate the inverse week number (from end of month).
 * E.g., if this is the last Tuesday of the month, returns 1.
 * @param {object} date - Date to check
 * @param {number} daysInWeek - Days per week in this calendar
 * @returns {number} Inverse week ordinal (1 = last, 2 = second-to-last, etc.)
 */
function getInverseWeekNumberInMonth(date, daysInWeek) {
  const lastDayOfMonth = getLastDayOfMonth(date);
  const daysUntilEndOfMonth = lastDayOfMonth - date.day;
  // Days from end of month to next occurrence of this weekday (or beyond month)
  const weeksRemaining = Math.floor(daysUntilEndOfMonth / daysInWeek);
  return weeksRemaining + 1;
}

/**
 * Check if note matches seasonal recurrence pattern.
 * @param {object} seasonalConfig - Seasonal config object {seasonIndex, trigger}
 * @param {object} targetDate - Date to check
 * @param {object} startDate - Note start date (for date bounds)
 * @returns {boolean} True if matches
 */
function matchesSeasonal(seasonalConfig, targetDate, startDate) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar?.seasons?.values?.length) return false;
  if (!seasonalConfig) return false;

  const seasonIndex = seasonalConfig.seasonIndex ?? 0;
  const trigger = seasonalConfig.trigger ?? 'entire';

  // Get target season
  const targetSeason = calendar.seasons.values[seasonIndex];
  if (!targetSeason) return false;

  // Calculate day of year for target date
  const targetDayOfYear = getDayOfYear(targetDate);
  const totalDaysInYear = getTotalDaysInYear();

  // Get season bounds
  const seasonStart = targetSeason.dayStart ?? 0;
  const seasonEnd = targetSeason.dayEnd ?? seasonStart;

  // Check if target day is within season (handling year wrap)
  const inSeason = isInSeasonRange(targetDayOfYear, seasonStart, seasonEnd, totalDaysInYear);
  if (!inSeason) return false;

  // Apply trigger type
  switch (trigger) {
    case 'firstDay':
      return targetDayOfYear === seasonStart || (seasonStart > seasonEnd && targetDayOfYear === seasonStart);

    case 'lastDay':
      return targetDayOfYear === seasonEnd;

    case 'entire':
    default:
      return true; // Already confirmed in season
  }
}

/**
 * Check if a day of year is within a season's range.
 * Handles seasons that wrap around the year boundary.
 * @param {number} dayOfYear - Target day of year
 * @param {number} start - Season start day
 * @param {number} end - Season end day
 * @param {number} totalDays - Total days in year
 * @returns {boolean}
 */
function isInSeasonRange(dayOfYear, start, end, totalDays) {
  if (start <= end) {
    // Normal range (e.g., Spring: day 80 to day 171)
    return dayOfYear >= start && dayOfYear <= end;
  } else {
    // Wrapping range (e.g., Winter: day 355 to day 79)
    return dayOfYear >= start || dayOfYear <= end;
  }
}

/**
 * Get total days in year from calendar.
 * @returns {number}
 */
function getTotalDaysInYear() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar?.months?.values) return 365;
  return calendar.months.values.reduce((sum, m) => sum + (m.days || 0), 0);
}

/**
 * Find the day number for an ordinal weekday occurrence in a month.
 * E.g., "2nd Tuesday" or "Last Friday".
 * @param {number} year - Year
 * @param {number} month - Month index (0-based)
 * @param {number} weekday - Target weekday (0-indexed)
 * @param {number} weekNumber - Ordinal (1-5 for 1st-5th, -1 to -5 for last, etc.)
 * @param {number} daysInWeek - Days per week
 * @returns {number|null} Day number (1-indexed) or null if not found
 */
function findWeekdayInMonth(year, month, weekday, weekNumber, daysInWeek) {
  const calendar = CalendarManager.getActiveCalendar();
  const months = calendar?.months?.values || [];
  const monthData = months[month];
  if (!monthData) return null;

  const daysInMonth = monthData.days || 30;

  // Find all occurrences of the weekday in this month
  const occurrences = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = { year, month, day };
    if (dayOfWeek(date) === weekday) {
      occurrences.push(day);
    }
  }

  if (occurrences.length === 0) return null;

  if (weekNumber > 0) {
    // Positive: 1st, 2nd, 3rd, etc.
    const idx = weekNumber - 1;
    return idx < occurrences.length ? occurrences[idx] : null;
  } else {
    // Negative: -1 = last, -2 = second-to-last, etc.
    const idx = occurrences.length + weekNumber;
    return idx >= 0 ? occurrences[idx] : null;
  }
}

/**
 * Check if note matches range pattern recurrence.
 * Range pattern specifies year/month/day as exact values, ranges, or wildcards.
 * @param {object} pattern - Range pattern { year, month, day }
 * @param {object} targetDate - Date to check
 * @param {object} startDate - Note start date (filter: don't match before this)
 * @param {object} [repeatEndDate] - Note repeat end date (filter: don't match after this)
 * @returns {boolean} True if matches
 */
function matchesRangePattern(pattern, targetDate, startDate, repeatEndDate) {
  const { year, month, day } = pattern;

  // Check date bounds first (day-level comparison)
  if (compareDays(targetDate, startDate) < 0) return false;
  if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;

  // Check year range/value
  if (!matchesRangeBit(year, targetDate.year)) return false;

  // Check month range/value
  if (!matchesRangeBit(month, targetDate.month)) return false;

  // Check day range/value
  if (!matchesRangeBit(day, targetDate.day)) return false;

  return true;
}

/**
 * Check if a value matches a range bit specification.
 * Range bit can be:
 * - null/undefined: match any value
 * - number: exact match
 * - [min, max]: inclusive range (each can be number or null)
 *   - [null, null]: match any
 *   - [min, null]: >= min
 *   - [null, max]: <= max
 *   - [min, max]: between inclusive
 * @param {number|Array|null} rangeBit - Range specification
 * @param {number} value - Value to check
 * @returns {boolean} True if value matches range bit
 */
function matchesRangeBit(rangeBit, value) {
  // null or undefined = match any
  if (rangeBit == null) return true;

  // Single number = exact match
  if (typeof rangeBit === 'number') return value === rangeBit;

  // Array [min, max]
  if (Array.isArray(rangeBit) && rangeBit.length === 2) {
    const [min, max] = rangeBit;

    // [null, null] = match any
    if (min === null && max === null) return true;

    // [min, null] = >= min
    if (min !== null && max === null) return value >= min;

    // [null, max] = <= max
    if (min === null && max !== null) return value <= max;

    // [min, max] = between inclusive
    return value >= min && value <= max;
  }

  return false;
}

/**
 * Get all occurrences of a recurring note within a date range.
 * @param {object} noteData  Note flag data
 * @param {object} rangeStart  Start of range
 * @param {object} rangeEnd  End of range
 * @param {number} maxOccurrences  Maximum number of occurrences to return
 * @returns {object[]}  Array of date objects
 */
export function getOccurrencesInRange(noteData, rangeStart, rangeEnd, maxOccurrences = 100) {
  const occurrences = [];
  const { startDate, repeat, repeatInterval, linkedEvent, repeatEndDate } = noteData;

  // Handle linked events - derive occurrences from linked note
  if (linkedEvent?.noteId) return getLinkedEventOccurrences(linkedEvent, rangeStart, rangeEnd, startDate, repeatEndDate, maxOccurrences);

  // If no recurrence, check if single occurrence is in range
  if (repeat === 'never' || !repeat) {
    const afterStart = compareDays(startDate, rangeStart) >= 0;
    const beforeEnd = compareDays(startDate, rangeEnd) <= 0;
    if (afterStart && beforeEnd) occurrences.push({ ...startDate });

    return occurrences;
  }

  // For moon-based repeat, iterate day by day and check conditions
  if (repeat === 'moon') {
    let currentDate = compareDays(startDate, rangeStart) >= 0 ? { ...startDate } : { ...rangeStart };
    let iterations = 0;
    const maxIterations = 10000;

    while (compareDays(currentDate, rangeEnd) <= 0 && iterations < maxIterations) {
      if (isRecurringMatch(noteData, currentDate)) {
        occurrences.push({ ...currentDate });
        if (occurrences.length >= maxOccurrences) break;
      }
      currentDate = addDays(currentDate, 1);
      iterations++;
    }
    return occurrences;
  }

  // For random repeat, use cached occurrences if available
  if (repeat === 'random') {
    const { cachedRandomOccurrences, maxOccurrences: noteMaxOccurrences } = noteData;

    // If we have cached occurrences, filter to range
    if (cachedRandomOccurrences?.length) {
      // Apply note's maxOccurrences limit first (cached occurrences are chronological)
      const limitedCache = noteMaxOccurrences > 0 ? cachedRandomOccurrences.slice(0, noteMaxOccurrences) : cachedRandomOccurrences;

      for (const occ of limitedCache) {
        if (compareDays(occ, rangeStart) >= 0 && compareDays(occ, rangeEnd) <= 0) {
          occurrences.push({ ...occ });
          if (occurrences.length >= maxOccurrences) break;
        }
      }
      return occurrences;
    }

    // Fall back to lazy evaluation
    const { randomConfig } = noteData;
    const checkInterval = randomConfig?.checkInterval || 'daily';
    let currentDate = compareDays(startDate, rangeStart) >= 0 ? { ...startDate } : { ...rangeStart };
    let iterations = 0;
    const maxIterations = 10000;

    while (compareDays(currentDate, rangeEnd) <= 0 && iterations < maxIterations) {
      if (isRecurringMatch(noteData, currentDate)) {
        occurrences.push({ ...currentDate });
        if (occurrences.length >= maxOccurrences) break;
      }

      // Advance based on check interval
      if (checkInterval === 'weekly') {
        const calendar = CalendarManager.getActiveCalendar();
        const daysInWeek = calendar?.days?.values?.length || 7;
        currentDate = addDays(currentDate, daysInWeek);
      } else if (checkInterval === 'monthly') {
        currentDate = addMonths(currentDate, 1);
      } else {
        currentDate = addDays(currentDate, 1);
      }
      iterations++;
    }
    return occurrences;
  }

  // For range-based repeat, iterate day by day and check pattern
  if (repeat === 'range') {
    let currentDate = compareDays(startDate, rangeStart) >= 0 ? { ...startDate } : { ...rangeStart };
    let iterations = 0;
    const maxIterations = 10000;

    while (compareDays(currentDate, rangeEnd) <= 0 && iterations < maxIterations) {
      if (isRecurringMatch(noteData, currentDate)) {
        occurrences.push({ ...currentDate });
        if (occurrences.length >= maxOccurrences) break;
      }
      currentDate = addDays(currentDate, 1);
      iterations++;
    }
    return occurrences;
  }

  // For weekOfMonth repeat, iterate month by month and find matching day
  if (repeat === 'weekOfMonth') {
    const calendar = CalendarManager.getActiveCalendar();
    const daysInWeek = calendar?.days?.values?.length || 7;
    const interval = noteData.repeatInterval || 1;
    const targetWeekday = noteData.weekday ?? dayOfWeek(startDate);
    const weekNumber = noteData.weekNumber ?? Math.ceil(startDate.day / daysInWeek);

    // Start from the first month in range that's >= startDate
    let currentMonth = compareDays(startDate, rangeStart) >= 0 ? { year: startDate.year, month: startDate.month } : { year: rangeStart.year, month: rangeStart.month };
    let iterations = 0;
    const maxIterations = 1000;

    while (iterations < maxIterations) {
      const matchingDay = findWeekdayInMonth(currentMonth.year, currentMonth.month, targetWeekday, weekNumber, daysInWeek);
      if (matchingDay) {
        const date = { year: currentMonth.year, month: currentMonth.month, day: matchingDay };
        if (compareDays(date, rangeEnd) > 0) break; // Past end of range
        if (compareDays(date, rangeStart) >= 0 && compareDays(date, startDate) >= 0) {
          if (!noteData.repeatEndDate || compareDays(date, noteData.repeatEndDate) <= 0) {
            occurrences.push(date);
            if (occurrences.length >= maxOccurrences) break;
          }
        }
      }
      // Advance to next month
      currentMonth = addMonths({ ...currentMonth, day: 1 }, interval);
      iterations++;
    }
    return occurrences;
  }

  // For seasonal repeat, iterate through season days
  if (repeat === 'seasonal') {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.seasons?.values?.length) return occurrences;

    const config = noteData.seasonalConfig;
    if (!config) return occurrences;

    const season = calendar.seasons.values[config.seasonIndex];
    if (!season) return occurrences;

    const totalDaysInYear = getTotalDaysInYear();
    let currentDate = compareDays(startDate, rangeStart) >= 0 ? { ...startDate } : { ...rangeStart };
    let iterations = 0;
    const maxIterations = 10000;

    while (compareDays(currentDate, rangeEnd) <= 0 && iterations < maxIterations) {
      if (isRecurringMatch(noteData, currentDate)) {
        occurrences.push({ ...currentDate });
        if (occurrences.length >= maxOccurrences) break;
      }
      // For 'entire' season, check each day. For first/last, we could optimize but day-by-day is safe.
      currentDate = addDays(currentDate, 1);
      iterations++;
    }
    return occurrences;
  }

  // For recurring events, iterate through range
  // Start from whichever is later: note start or range start
  let currentDate = compareDays(startDate, rangeStart) >= 0 ? { ...startDate } : { ...rangeStart };

  const interval = repeatInterval || 1;

  // Iterate through dates in range
  let iterations = 0;
  const maxIterations = 10000; // Safety limit

  while (compareDays(currentDate, rangeEnd) <= 0 && iterations < maxIterations) {
    if (isRecurringMatch(noteData, currentDate)) {
      occurrences.push({ ...currentDate });

      if (occurrences.length >= maxOccurrences) break;
    }

    // Advance to next potential occurrence
    currentDate = advanceDate(currentDate, repeat, interval);
    iterations++;
  }

  return occurrences;
}

/**
 * Advance a date by the recurrence pattern.
 * @param {object} date  Current date
 * @param {string} repeat  Repeat pattern
 * @param {number} interval  Repeat interval
 * @returns {object}  Next date
 */
function advanceDate(date, repeat, interval) {
  const calendar = CalendarManager.getActiveCalendar();
  const daysInWeek = calendar?.days?.values?.length || 7;

  switch (repeat) {
    case 'daily':
      return addDays(date, interval);

    case 'weekly':
      return addDays(date, interval * daysInWeek);

    case 'monthly':
      return addMonths(date, interval);

    case 'yearly':
      return addYears(date, interval);

    default:
      return addDays(date, 1);
  }
}

/**
 * Get human-readable description of recurrence pattern.
 * @param {object} noteData  Note flag data
 * @returns {string}  Description like "Every 2 weeks"
 */
export function getRecurrenceDescription(noteData) {
  const { repeat, repeatInterval, repeatEndDate, moonConditions, randomConfig, linkedEvent, maxOccurrences } = noteData;

  // Helper to append occurrence limit text
  const appendMaxOccurrences = (desc) => {
    if (maxOccurrences > 0) desc += `, ${maxOccurrences} time${maxOccurrences === 1 ? '' : 's'}`;
    return desc;
  };

  // Handle linked event
  if (linkedEvent?.noteId) {
    const linkedNote = NoteManager.getNote(linkedEvent.noteId);
    const linkedName = linkedNote?.name || 'Unknown Event';
    const offset = linkedEvent.offset || 0;
    let description;
    if (offset === 0) description = `Same day as "${linkedName}"`;
    else if (offset > 0) description = `${offset} day${offset === 1 ? '' : 's'} after "${linkedName}"`;
    else description = `${Math.abs(offset)} day${Math.abs(offset) === 1 ? '' : 's'} before "${linkedName}"`;
    description = appendMaxOccurrences(description);
    if (repeatEndDate) description += ` until ${repeatEndDate.month + 1}/${repeatEndDate.day}/${repeatEndDate.year}`;
    return description;
  }

  if (repeat === 'never' || !repeat) return 'Does not repeat';

  // Handle moon-based repeat
  if (repeat === 'moon') {
    let description = getMoonConditionsDescription(moonConditions);
    description = appendMaxOccurrences(description);
    if (repeatEndDate) description += ` until ${repeatEndDate.month + 1}/${repeatEndDate.day}/${repeatEndDate.year}`;
    return description;
  }

  // Handle random repeat
  if (repeat === 'random') {
    const probability = randomConfig?.probability ?? 10;
    const checkInterval = randomConfig?.checkInterval ?? 'daily';
    const intervalLabel = checkInterval === 'weekly' ? 'week' : checkInterval === 'monthly' ? 'month' : 'day';
    let description = `${probability}% chance each ${intervalLabel}`;
    description = appendMaxOccurrences(description);
    if (repeatEndDate) description += ` until ${repeatEndDate.month + 1}/${repeatEndDate.day}/${repeatEndDate.year}`;
    return description;
  }

  // Handle range-based repeat
  if (repeat === 'range') {
    let description = describeRangePattern(noteData.rangePattern);
    description = appendMaxOccurrences(description);
    if (repeatEndDate) description += ` until ${repeatEndDate.month + 1}/${repeatEndDate.day}/${repeatEndDate.year}`;
    return description;
  }

  // Handle weekOfMonth repeat
  if (repeat === 'weekOfMonth') {
    const calendar = CalendarManager.getActiveCalendar();
    const weekdays = calendar?.days?.values || [];
    const weekNumber = noteData.weekNumber ?? 1;
    const weekdayIndex = noteData.weekday ?? 0;
    const weekdayName = weekdays[weekdayIndex]?.name ? localize(weekdays[weekdayIndex].name) : `Day ${weekdayIndex + 1}`;

    let ordinal;
    if (weekNumber > 0) {
      const ordinals = ['1st', '2nd', '3rd', '4th', '5th'];
      ordinal = ordinals[weekNumber - 1] || `${weekNumber}th`;
    } else {
      const inverseOrdinals = ['Last', '2nd-to-last', '3rd-to-last', '4th-to-last', '5th-to-last'];
      ordinal = inverseOrdinals[Math.abs(weekNumber) - 1] || 'Last';
    }

    const interval = repeatInterval || 1;
    let description = interval === 1 ? `${ordinal} ${weekdayName} of every month` : `${ordinal} ${weekdayName} every ${interval} months`;
    description = appendMaxOccurrences(description);
    if (repeatEndDate) description += ` until ${repeatEndDate.month + 1}/${repeatEndDate.day}/${repeatEndDate.year}`;
    return description;
  }

  // Handle seasonal repeat
  if (repeat === 'seasonal') {
    const calendar = CalendarManager.getActiveCalendar();
    const seasons = calendar?.seasons?.values || [];
    const config = noteData.seasonalConfig;
    const seasonName = seasons[config?.seasonIndex]?.name ? localize(seasons[config?.seasonIndex].name) : `Season ${(config?.seasonIndex ?? 0) + 1}`;
    const trigger = config?.trigger ?? 'entire';

    let description;
    switch (trigger) {
      case 'firstDay':
        description = `First day of ${seasonName}`;
        break;
      case 'lastDay':
        description = `Last day of ${seasonName}`;
        break;
      case 'entire':
      default:
        description = `Every day during ${seasonName}`;
        break;
    }

    description = appendMaxOccurrences(description);
    if (repeatEndDate) description += ` until ${repeatEndDate.month + 1}/${repeatEndDate.day}/${repeatEndDate.year}`;
    return description;
  }

  const interval = repeatInterval || 1;
  const unit = repeat === 'daily' ? 'day' : repeat === 'weekly' ? 'week' : repeat === 'monthly' ? 'month' : repeat === 'yearly' ? 'year' : '';
  const pluralUnit = interval === 1 ? unit : `${unit}s`;
  const prefix = interval === 1 ? 'Every' : `Every ${interval}`;

  let description = `${prefix} ${pluralUnit}`;

  // Add moon condition info if present with regular repeat
  if (moonConditions?.length > 0) description += ` (${getMoonConditionsDescription(moonConditions)})`;

  description = appendMaxOccurrences(description);
  if (repeatEndDate) description += ` until ${repeatEndDate.month + 1}/${repeatEndDate.day}/${repeatEndDate.year}`;

  return description;
}

/**
 * Generate pre-computed random occurrences for a note.
 * Generates occurrences from startDate until end of targetYear.
 * @param {object} noteData - Note flag data with random config
 * @param {number} targetYear - Year to generate occurrences until (inclusive)
 * @returns {object[]} Array of date objects { year, month, day }
 */
export function generateRandomOccurrences(noteData, targetYear) {
  const { startDate, randomConfig, repeatEndDate } = noteData;
  if (!randomConfig || randomConfig.probability <= 0) return [];

  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar?.months?.values) return [];

  const occurrences = [];
  const maxOccurrences = 500; // Safety limit per year

  // Build end-of-year date
  const lastMonthIndex = calendar.months.values.length - 1;
  const lastMonthDays = calendar.months.values[lastMonthIndex]?.days || 30;
  const yearEnd = { year: targetYear, month: lastMonthIndex, day: lastMonthDays };

  // Determine iteration start
  let currentDate = { ...startDate };
  if (currentDate.year > targetYear) return []; // Start is after target year

  // Don't iterate before startDate
  const rangeStart = { ...startDate };

  // Determine iteration end (earlier of yearEnd or repeatEndDate)
  let rangeEnd = yearEnd;
  if (repeatEndDate && compareDays(repeatEndDate, yearEnd) < 0) rangeEnd = repeatEndDate;

  const { checkInterval } = randomConfig;
  let iterations = 0;
  const maxIterations = 50000;

  while (compareDays(currentDate, rangeEnd) <= 0 && iterations < maxIterations) {
    // Only check dates on/after startDate
    if (compareDays(currentDate, rangeStart) >= 0) {
      if (matchesRandom(randomConfig, currentDate, startDate)) {
        occurrences.push({ year: currentDate.year, month: currentDate.month, day: currentDate.day });
        if (occurrences.length >= maxOccurrences) break;
      }
    }

    // Advance based on check interval
    if (checkInterval === 'weekly') {
      const daysInWeek = calendar?.days?.values?.length || 7;
      currentDate = addDays(currentDate, daysInWeek);
    } else if (checkInterval === 'monthly') {
      currentDate = addMonths(currentDate, 1);
    } else {
      currentDate = addDays(currentDate, 1);
    }
    iterations++;
  }

  return occurrences;
}

/**
 * Check if pre-generated occurrences need regeneration.
 * Returns true if current date is in the last week of the last month of the cached year.
 * @param {object} cachedData - Cached occurrence data { year, occurrences }
 * @returns {boolean} True if regeneration needed
 */
export function needsRandomRegeneration(cachedData) {
  if (!cachedData?.year || !cachedData?.occurrences) return true;

  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar?.months?.values) return false;

  const components = game.time.components || {};
  const yearZero = calendar?.years?.yearZero ?? 0;
  const currentYear = (components.year ?? 0) + yearZero;
  const currentMonth = components.month ?? 0;
  const currentDay = (components.dayOfMonth ?? 0) + 1;

  const lastMonthIndex = calendar.months.values.length - 1;
  const lastMonthDays = calendar.months.values[lastMonthIndex]?.days || 30;
  const daysInWeek = calendar?.days?.values?.length || 7;

  // If cached year is less than current year, always regenerate
  if (cachedData.year < currentYear) return true;

  // If in last month and last week, regenerate for next year
  if (currentMonth === lastMonthIndex && currentDay > lastMonthDays - daysInWeek) return cachedData.year <= currentYear;

  return false;
}

/**
 * Check if a date matches a cached random occurrence.
 * @param {object[]} cachedOccurrences - Array of cached date objects
 * @param {object} targetDate - Date to check
 * @returns {boolean} True if date is in cached occurrences
 */
export function matchesCachedOccurrence(cachedOccurrences, targetDate) {
  if (!cachedOccurrences?.length) return false;
  return cachedOccurrences.some((occ) => occ.year === targetDate.year && occ.month === targetDate.month && occ.day === targetDate.day);
}

/**
 * Get human-readable description of moon conditions.
 * @param {object[]} moonConditions  Array of moon condition objects
 * @returns {string}  Description like "Every Full Moon"
 */
function getMoonConditionsDescription(moonConditions) {
  if (!moonConditions?.length) return 'Moon phase event';

  const calendar = CalendarManager.getActiveCalendar();
  const descriptions = [];

  for (const cond of moonConditions) {
    const moon = calendar?.moons?.[cond.moonIndex];
    const moonName = moon?.name ? localize(moon.name) : `Moon ${cond.moonIndex + 1}`;

    // Find phase name(s) that match the condition range
    const matchingPhases = moon?.phases?.filter((p) => {
      // Check if phase overlaps with condition range
      if (cond.phaseStart <= cond.phaseEnd) {
        return p.start < cond.phaseEnd && p.end > cond.phaseStart;
      } else {
        // Wrapping range
        return p.end > cond.phaseStart || p.start < cond.phaseEnd;
      }
    });

    if (matchingPhases?.length === 1) {
      const phaseName = localize(matchingPhases[0].name);
      descriptions.push(`${moonName}: ${phaseName}`);
    } else if (matchingPhases?.length > 1) {
      const phaseNames = matchingPhases.map((p) => localize(p.name)).join(', ');
      descriptions.push(`${moonName}: ${phaseNames}`);
    } else {
      descriptions.push(`${moonName}: custom phase`);
    }
  }

  return descriptions.join('; ');
}

/**
 * Generate human-readable description of a range pattern.
 * @param {object} pattern - Range pattern { year, month, day }
 * @returns {string} Description like "year=2020-2025, month=0, day=15"
 */
function describeRangePattern(pattern) {
  if (!pattern) return 'Custom range pattern';

  const { year, month, day } = pattern;

  const yearDesc = describeRangeBit(year, 'year');
  const monthDesc = describeRangeBit(month, 'month');
  const dayDesc = describeRangeBit(day, 'day');

  const parts = [yearDesc, monthDesc, dayDesc].filter(Boolean);
  return parts.length > 0 ? `Range: ${parts.join(', ')}` : 'Custom range pattern';
}

/**
 * Generate human-readable description of a single range bit.
 * @param {number|Array|null} bit - Range bit (number, [min, max], or null)
 * @param {string} unit - Unit name ('year', 'month', 'day')
 * @returns {string|null} Description or null if any value
 */
function describeRangeBit(bit, unit) {
  if (bit == null) return null;

  // Single number = exact value
  if (typeof bit === 'number') return `${unit}=${bit}`;

  // Array [min, max]
  if (Array.isArray(bit) && bit.length === 2) {
    const [min, max] = bit;

    // [null, null] = any
    if (min === null && max === null) return `any ${unit}`;

    // [min, null] = >= min
    if (min !== null && max === null) return `${unit}>=${min}`;

    // [null, max] = <= max
    if (min === null && max !== null) return `${unit}<=${max}`;

    // [min, max] = range
    return `${unit}=${min}-${max}`;
  }

  return null;
}
