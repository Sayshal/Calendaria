/**
 * Recurring Event Logic
 * Handles pattern matching for repeating calendar notes.
 *
 * @module Notes/Utils/Recurrence
 * @author Tyler
 */

// TODO: Implement 'weekOfMonth' repeat type
// - Should repeat on the same week of the month (e.g., 2nd Tuesday of every month)
// - Needs logic to calculate which week of month the start date falls in
// - Handle edge cases where target month doesn't have that week

// TODO: Implement 'seasonal' repeat type
// - Define season boundaries (which months = which season)
// - Decide behavior: same date within matching season? start of season? every day?
// - Consider calendar-specific season definitions

import { compareDates, compareDays, daysBetween, monthsBetween, dayOfWeek, isSameDay, addDays, addMonths, addYears } from './date-utils.mjs';
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

  // If no recurrence, only matches exact start date
  if (repeat === 'never' || !repeat) return isSameDay(startDate, targetDate);

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
      return matchesRangePattern(noteData.rangePattern, targetDate, startDate, repeatEndDate);

    default:
      return false;
  }

  // Check maxOccurrences limit for standard repeat types
  if (matches && maxOccurrences > 0) {
    const occurrenceNum = countOccurrencesUpTo(noteData, targetDate);
    if (occurrenceNum > maxOccurrences) return false;
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
    const moonName = moon?.name ? game.i18n.localize(moon.name) : `Moon ${cond.moonIndex + 1}`;

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
      const phaseName = game.i18n.localize(matchingPhases[0].name);
      descriptions.push(`${moonName}: ${phaseName}`);
    } else if (matchingPhases?.length > 1) {
      const phaseNames = matchingPhases.map((p) => game.i18n.localize(p.name)).join(', ');
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
