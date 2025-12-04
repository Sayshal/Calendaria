/**
 * Recurring Event Logic
 * Handles pattern matching for repeating calendar notes.
 *
 * @module Notes/Utils/Recurrence
 * @author Tyler
 */

import { compareDates, daysBetween, monthsBetween, dayOfWeek, isSameDay, addDays, addMonths, addYears } from './date-utils.mjs';
import CalendarManager from '../../calendar/calendar-manager.mjs';

/**
 * Check if a recurring note occurs on a target date.
 * @param {object} noteData  Note flag data with recurrence settings
 * @param {object} targetDate  Date to check
 * @returns {boolean}  True if note occurs on this date
 */
export function isRecurringMatch(noteData, targetDate) {
  const { startDate, endDate, repeat, repeatInterval, repeatEndDate } = noteData;

  // If no recurrence, only matches exact start date
  if (repeat === 'never' || !repeat) return isSameDay(startDate, targetDate);

  // Check if target is before start date
  if (compareDates(targetDate, startDate) < 0) return false;

  // Check if target is after repeat end date
  if (repeatEndDate && compareDates(targetDate, repeatEndDate) > 0) return false;

  // Check if target is during multi-day event
  if (endDate) {
    const afterStart = compareDates(targetDate, startDate) >= 0;
    const beforeEnd = compareDates(targetDate, endDate) <= 0;
    if (afterStart && beforeEnd) return true; // Within multi-day event range
  }

  const interval = repeatInterval || 1;

  switch (repeat) {
    case 'daily':
      return matchesDaily(startDate, targetDate, interval);

    case 'weekly':
      return matchesWeekly(startDate, targetDate, interval);

    case 'monthly':
      return matchesMonthly(startDate, targetDate, interval);

    case 'yearly':
      return matchesYearly(startDate, targetDate, interval);

    default:
      return false;
  }
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
 * Get all occurrences of a recurring note within a date range.
 * @param {object} noteData  Note flag data
 * @param {object} rangeStart  Start of range
 * @param {object} rangeEnd  End of range
 * @param {number} maxOccurrences  Maximum number of occurrences to return
 * @returns {object[]}  Array of date objects
 */
export function getOccurrencesInRange(noteData, rangeStart, rangeEnd, maxOccurrences = 100) {
  const occurrences = [];
  const { startDate, repeat, repeatInterval } = noteData;

  // If no recurrence, check if single occurrence is in range
  if (repeat === 'never' || !repeat) {
    const afterStart = compareDates(startDate, rangeStart) >= 0;
    const beforeEnd = compareDates(startDate, rangeEnd) <= 0;
    if (afterStart && beforeEnd) occurrences.push({ ...startDate });

    return occurrences;
  }

  // For recurring events, iterate through range
  // Start from whichever is later: note start or range start
  let currentDate = compareDates(startDate, rangeStart) >= 0 ? { ...startDate } : { ...rangeStart };

  const interval = repeatInterval || 1;

  // Iterate through dates in range
  let iterations = 0;
  const maxIterations = 10000; // Safety limit

  while (compareDates(currentDate, rangeEnd) <= 0 && iterations < maxIterations) {
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
  const { repeat, repeatInterval, repeatEndDate } = noteData;

  if (repeat === 'never' || !repeat) return 'Does not repeat';

  const interval = repeatInterval || 1;
  const unit = repeat === 'daily' ? 'day' : repeat === 'weekly' ? 'week' : repeat === 'monthly' ? 'month' : repeat === 'yearly' ? 'year' : '';

  const pluralUnit = interval === 1 ? unit : `${unit}s`;
  const prefix = interval === 1 ? 'Every' : `Every ${interval}`;

  let description = `${prefix} ${pluralUnit}`;

  if (repeatEndDate) description += ` until ${repeatEndDate.month + 1}/${repeatEndDate.day}/${repeatEndDate.year}`;

  return description;
}
