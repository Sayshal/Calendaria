/**
 * Recurring Event Logic
 * Handles pattern matching for repeating calendar notes.
 * @module Notes/Utils/Recurrence
 * @author Tyler
 */

import CalendarManager from '../../calendar/calendar-manager.mjs';
import { format, localize } from '../../utils/localization.mjs';
import NoteManager from '../note-manager.mjs';
import { addDays, addMonths, addYears, compareDays, dayOfWeek, daysBetween, isSameDay, monthsBetween } from './date-utils.mjs';

/**
 * Seeded random number generator.
 * Same inputs always produce the same output (deterministic).
 * @param {number} seed - Base seed value
 * @param {number} year - Year component
 * @param {number} dayOfYear - Day of year (1-366)
 * @returns {number} Value between 0-99.99
 */
function seededRandom(seed, year, dayOfYear) {
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
  if (!calendar) return date.day;
  const yearZero = calendar.years?.yearZero ?? 0;
  const internalYear = date.year - yearZero;
  let dayOfYear = 0;
  for (let m = 0; m < date.month; m++) {
    dayOfYear += calendar.getDaysInMonth(m, internalYear);
  }
  return dayOfYear + date.day;
}

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
    case 'year':
      return date.year;
    case 'month':
      return date.month + 1;
    case 'day':
      return date.day;
    case 'dayOfYear':
      return getDayOfYear(date);
    case 'daysBeforeMonthEnd': {
      const lastDay = getLastDayOfMonth(date);
      return lastDay - date.day;
    }
    case 'weekday':
      return dayOfWeek(date) + 1;
    case 'weekNumberInMonth': {
      const daysInWeek = calendar?.daysInWeek ?? 7;
      return Math.ceil(date.day / daysInWeek);
    }
    case 'inverseWeekNumber': {
      const daysInWeek = calendar?.daysInWeek ?? 7;
      const lastDay = getLastDayOfMonth(date);
      return Math.floor((lastDay - date.day) / daysInWeek) + 1;
    }
    case 'weekInMonth': {
      const daysInWeek = calendar?.daysInWeek ?? 7;
      return Math.ceil(date.day / daysInWeek);
    }
    case 'weekInYear': {
      const daysInWeek = calendar?.daysInWeek ?? 7;
      const dayOfYear = getDayOfYear(date);
      return Math.ceil(dayOfYear / daysInWeek);
    }
    case 'totalWeek': {
      const daysInWeek = calendar?.daysInWeek ?? 7;
      const totalDays = getTotalDaysSinceEpoch(date);
      return Math.floor(totalDays / daysInWeek);
    }
    case 'weeksBeforeMonthEnd': {
      const daysInWeek = calendar?.daysInWeek ?? 7;
      const lastDay = getLastDayOfMonth(date);
      return Math.floor((lastDay - date.day) / daysInWeek);
    }
    case 'weeksBeforeYearEnd': {
      const daysInWeek = calendar?.daysInWeek ?? 7;
      const totalDaysInYear = getTotalDaysInYear(date.year);
      const dayOfYear = getDayOfYear(date);
      return Math.floor((totalDaysInYear - dayOfYear) / daysInWeek);
    }
    case 'season': {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return null;
      const dayOfYear = getDayOfYear(date);
      return getSeasonIndex(dayOfYear, seasons) + 1;
    }
    case 'seasonPercent': {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return null;
      const dayOfYear = getDayOfYear(date);
      return getSeasonPercent(dayOfYear, seasons, getTotalDaysInYear(date.year));
    }
    case 'seasonDay': {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return null;
      const dayOfYear = getDayOfYear(date);
      return getSeasonDay(dayOfYear, seasons, getTotalDaysInYear(date.year));
    }
    case 'isLongestDay': {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'longest');
    }
    case 'isShortestDay': {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'shortest');
    }
    case 'isSpringEquinox': {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'spring');
    }
    case 'isAutumnEquinox': {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'autumn');
    }
    case 'moonPhase': {
      const moons = calendar?.moonsArray ?? [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      const yearZero = calendar.years?.yearZero ?? 0;
      const components = { year: date.year - yearZero, month: date.month, dayOfMonth: date.day - 1, hour: 12, minute: 0, second: 0 };
      const moonPhaseInfo = calendar.getMoonPhase(moonIndex, components);
      return moonPhaseInfo?.position ?? null;
    }
    case 'moonPhaseIndex': {
      const moons = calendar?.moonsArray ?? [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      return getCalendarMoonPhaseIndex(date, moonIndex);
    }
    case 'moonPhaseCountMonth': {
      const moons = calendar?.moonsArray ?? [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      return getMoonPhaseCountInMonth(date, moons[moonIndex], moonIndex);
    }
    case 'moonPhaseCountYear': {
      const moons = calendar?.moonsArray ?? [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      return getMoonPhaseCountInYear(date, moons[moonIndex], moonIndex);
    }
    case 'cycle': {
      const cycles = calendar?.cyclesArray ?? [];
      const cycleIndex = value2 ?? 0;
      if (cycleIndex >= cycles.length) return null;
      return getCycleValue(date, cycles[cycleIndex]);
    }
    case 'era': {
      const eras = calendar?.erasArray ?? [];
      if (!eras.length) return null;
      return getEraIndex(date.year, eras) + 1;
    }
    case 'eraYear': {
      const eras = calendar?.erasArray ?? [];
      if (!eras.length) return date.year;
      return getEraYear(date.year, eras);
    }
    case 'intercalary': {
      const months = calendar?.monthsArray ?? [];
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
 * @param {object} [startDate] - Note start date, used as implicit offset for modulo conditions
 * @returns {boolean} True if condition passes
 */
function evaluateCondition(condition, date, startDate) {
  const { field, op, value, value2 } = condition;
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
    case '%': {
      if (value === 0) return false;
      const effectiveOffset = startDate ? (getFieldValue(field, startDate, value2) ?? 0) : 0;
      return (fieldValue - effectiveOffset) % value === 0;
    }
    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a date (AND logic).
 * @param {object[]} conditions - Array of conditions
 * @param {object} date - Date to evaluate
 * @param {object} [startDate] - Note start date, used as implicit offset for modulo conditions
 * @returns {boolean} True if all conditions pass
 */
function evaluateConditions(conditions, date, startDate) {
  if (!conditions?.length) return true;
  return conditions.every((cond) => evaluateCondition(cond, date, startDate));
}

/**
 * Get total days since epoch (year 0, day 1).
 * @param {object} date - Date object
 * @returns {number} - Total days since beginning
 */
function getTotalDaysSinceEpoch(date) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return 0;
  const yearZero = calendar.years?.yearZero ?? 0;
  const internalYear = date.year - yearZero;
  const dayOfMonth = date.day - 1;
  const components = { year: internalYear, month: date.month, dayOfMonth, hour: 0, minute: 0, second: 0 };
  const time = calendar.componentsToTime(components);
  const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
  const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
  const secondsPerDay = hoursPerDay * minutesPerHour * secondsPerMinute;
  return Math.floor(time / secondsPerDay);
}

/**
 * Get current season index for a day of year.
 * @param {number} dayOfYear - Day of year
 * @param {object[]} seasons - Seasons array
 * @returns {number} Season index
 */
function getSeasonIndex(dayOfYear, seasons) {
  for (let i = 0; i < seasons.length; i++) {
    const season = seasons[i];
    const start = season.dayStart ?? 0;
    const end = season.dayEnd ?? start;
    if (isInSeasonRange(dayOfYear, start, end)) return i;
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
  const idx = getSeasonIndex(dayOfYear, seasons);
  const season = seasons[idx];
  const start = season.dayStart ?? 0;
  const end = season.dayEnd ?? start;
  let seasonLength, dayInSeason;
  if (start <= end) {
    seasonLength = end - start + 1;
    dayInSeason = dayOfYear - start;
  } else {
    seasonLength = totalDays - start + end + 1;
    dayInSeason = dayOfYear >= start ? dayOfYear - start : totalDays - start + dayOfYear;
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
  const idx = getSeasonIndex(dayOfYear, seasons);
  const season = seasons[idx];
  const start = season.dayStart ?? 0;
  if (dayOfYear >= start) return dayOfYear - start + 1;
  else return totalDays - start + dayOfYear + 1;
}

/**
 * Check if date is a solstice or equinox.
 * @param {object} date - Date to check
 * @param {object[]} seasons - Seasons array
 * @param {string} type - 'longest', 'shortest', 'spring', 'autumn'
 * @returns {boolean} Is date solstice/equinox?
 */
function checkSolsticeOrEquinox(date, seasons, type) {
  const totalDays = getTotalDaysInYear(date.year);
  const dayOfYear = getDayOfYear(date);
  let summerIdx = seasons.findIndex((s) => /summer/i.test(s.name));
  let winterIdx = seasons.findIndex((s) => /winter/i.test(s.name));
  let springIdx = seasons.findIndex((s) => /spring/i.test(s.name));
  let autumnIdx = seasons.findIndex((s) => /autumn|fall/i.test(s.name));
  if (summerIdx === -1 && seasons.length >= 4) summerIdx = 1;
  if (winterIdx === -1 && seasons.length >= 4) winterIdx = 3;
  if (springIdx === -1 && seasons.length >= 4) springIdx = 0;
  if (autumnIdx === -1 && seasons.length >= 4) autumnIdx = 2;
  switch (type) {
    case 'longest': {
      if (summerIdx === -1) return false;
      const summer = seasons[summerIdx];
      const midpoint = getMidpoint(summer.dayStart ?? 0, summer.dayEnd ?? 0, totalDays);
      return dayOfYear === midpoint;
    }
    case 'shortest': {
      if (winterIdx === -1) return false;
      const winter = seasons[winterIdx];
      const midpoint = getMidpoint(winter.dayStart ?? 0, winter.dayEnd ?? 0, totalDays);
      return dayOfYear === midpoint;
    }
    case 'spring': {
      if (springIdx === -1) return false;
      return dayOfYear === (seasons[springIdx].dayStart ?? 0);
    }
    case 'autumn': {
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
    const length = totalDays - start + end + 1;
    const mid = Math.floor(length / 2);
    return (start + mid) % totalDays;
  }
}

/**
 * Get moon phase index using the calendar's method for accurate phase matching.
 * @param {object} date - Date to check (year, month, day)
 * @param {number} moonIndex - Index of the moon
 * @returns {number|null} Phase index or null
 */
function getCalendarMoonPhaseIndex(date, moonIndex) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const yearZero = calendar.years?.yearZero ?? 0;
  const components = { year: date.year - yearZero, month: date.month, dayOfMonth: date.day - 1, hour: 12, minute: 0, second: 0 };
  const moonPhaseInfo = calendar.getMoonPhase(moonIndex, components);
  return moonPhaseInfo?.phaseIndex ?? null;
}

/**
 * Get count of current moon phase occurrences in the month.
 * Counts phase transitions (entering the phase), not individual days.
 * @param {object} date - Date to check
 * @param {object} _moon - Moon configuration
 * @param {number} moonIndex - Index of this moon in calendar.moons
 * @returns {number} Count (1 = first occurrence)
 */
function getMoonPhaseCountInMonth(date, _moon, moonIndex = 0) {
  const currentPhaseIndex = getCalendarMoonPhaseIndex(date, moonIndex);
  if (currentPhaseIndex === null) return 0;
  let count = 0;
  let wasInPhase = false;
  for (let day = 1; day <= date.day; day++) {
    const checkDate = { ...date, day };
    const phaseIndex = getCalendarMoonPhaseIndex(checkDate, moonIndex);
    const isInPhase = phaseIndex === currentPhaseIndex;
    if (isInPhase && !wasInPhase) count++;
    wasInPhase = isInPhase;
  }
  return count;
}

/**
 * Get count of current moon phase occurrences in the year.
 * Counts phase transitions (entering the phase), not individual days.
 * @param {object} date - Date to check
 * @param {object} _moon - Moon configuration
 * @param {number} moonIndex - Index of this moon in calendar.moons
 * @returns {number} Count (1 = first occurrence)
 */
function getMoonPhaseCountInYear(date, _moon, moonIndex = 0) {
  const calendar = CalendarManager.getActiveCalendar();
  const currentPhaseIndex = getCalendarMoonPhaseIndex(date, moonIndex);
  if (currentPhaseIndex === null) return 0;
  const targetDayOfYear = getDayOfYear(date);
  let count = 0;
  let dayCounter = 0;
  let wasInPhase = false;
  const months = calendar?.monthsArray ?? [];
  for (let m = 0; m < months.length && dayCounter < targetDayOfYear; m++) {
    const daysInMonth = months[m]?.days || 30;
    for (let d = 1; d <= daysInMonth && dayCounter < targetDayOfYear; d++) {
      dayCounter++;
      const checkDate = { year: date.year, month: m, day: d };
      const phaseIndex = getCalendarMoonPhaseIndex(checkDate, moonIndex);
      const isInPhase = phaseIndex === currentPhaseIndex;
      if (isInPhase && !wasInPhase) count++;
      wasInPhase = isInPhase;
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
      value = getEraYear(date.year, CalendarManager.getActiveCalendar()?.erasArray ?? []);
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
  return (((value - (cycle.offset || 0)) % cycle.length) + cycle.length) % cycle.length;
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
    if (year >= (era.startYear ?? 0)) if (era.endYear == null || year <= era.endYear) return i;
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

/**
 * Resolve a computed date for a given year using the chain.
 * @param {object} computedConfig - Computed config { chain, yearOverrides }
 * @param {number} year - Year to compute for
 * @returns {object|null} Resolved date { year, month, day } or null
 */
export function resolveComputedDate(computedConfig, year) {
  if (!computedConfig?.chain?.length) return null;
  const { chain, yearOverrides } = computedConfig;
  if (yearOverrides?.[year]) {
    const override = yearOverrides[year];
    return { year, month: override.month, day: override.day };
  }

  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  let currentDate = null;

  for (const step of chain) {
    switch (step.type) {
      case 'anchor':
        currentDate = resolveAnchor(step.value, year, calendar);
        break;
      case 'firstAfter':
        if (!currentDate) return null;
        currentDate = resolveFirstAfter(currentDate, step.condition, step.params, calendar);
        break;
      case 'daysAfter':
        if (!currentDate) return null;
        currentDate = addDays(currentDate, step.params?.days ?? 0);
        break;
      case 'weekdayOnOrAfter':
        if (!currentDate) return null;
        currentDate = resolveWeekdayOnOrAfter(currentDate, step.params?.weekday ?? 0, calendar);
        break;
      default:
        break;
    }
    if (!currentDate) return null;
  }

  return currentDate;
}

/**
 * Resolve an anchor point for a computed event.
 * @param {string} anchorType - Anchor type (springEquinox, summerSolstice, etc.)
 * @param {number} year - Year to resolve for
 * @param {object} calendar - Calendar instance
 * @returns {object|null} Date { year, month, day } or null
 */
function resolveAnchor(anchorType, year, calendar) {
  const seasons = calendar?.seasonsArray ?? [];
  const daylight = calendar?.daylight || {};
  const yearZero = calendar?.years?.yearZero ?? 0;
  const totalDays = calendar.getDaysInYear(year - yearZero);

  switch (anchorType) {
    case 'springEquinox': {
      const springIdx = seasons.findIndex((s) => /spring/i.test(s.name));
      if (springIdx === -1 && seasons.length >= 4) return dayOfYearToDate(seasons[0]?.dayStart ?? 1, year, calendar);
      if (springIdx !== -1) return dayOfYearToDate(seasons[springIdx].dayStart ?? 1, year, calendar);
      return null;
    }
    case 'autumnEquinox': {
      const autumnIdx = seasons.findIndex((s) => /autumn|fall/i.test(s.name));
      if (autumnIdx === -1 && seasons.length >= 4) return dayOfYearToDate(seasons[2]?.dayStart ?? 1, year, calendar);
      if (autumnIdx !== -1) return dayOfYearToDate(seasons[autumnIdx].dayStart ?? 1, year, calendar);
      return null;
    }
    case 'summerSolstice': {
      if (daylight.summerSolstice) return dayOfYearToDate(daylight.summerSolstice, year, calendar);
      const summerIdx = seasons.findIndex((s) => /summer/i.test(s.name));
      if (summerIdx !== -1) {
        const summer = seasons[summerIdx];
        const mid = getMidpoint(summer.dayStart ?? 0, summer.dayEnd ?? 0, totalDays);
        return dayOfYearToDate(mid, year, calendar);
      }
      return null;
    }
    case 'winterSolstice': {
      if (daylight.winterSolstice) return dayOfYearToDate(daylight.winterSolstice, year, calendar);
      const winterIdx = seasons.findIndex((s) => /winter/i.test(s.name));
      if (winterIdx !== -1) {
        const winter = seasons[winterIdx];
        const mid = getMidpoint(winter.dayStart ?? 0, winter.dayEnd ?? 0, totalDays);
        return dayOfYearToDate(mid, year, calendar);
      }
      return null;
    }
    default:
      if (anchorType?.startsWith('seasonStart:')) {
        const idx = parseInt(anchorType.split(':')[1], 10);
        if (seasons[idx]) return dayOfYearToDate(seasons[idx].dayStart ?? 1, year, calendar);
      }
      if (anchorType?.startsWith('seasonEnd:')) {
        const idx = parseInt(anchorType.split(':')[1], 10);
        if (seasons[idx]) return dayOfYearToDate(seasons[idx].dayEnd ?? 1, year, calendar);
      }
      if (anchorType?.startsWith('event:')) {
        const noteId = anchorType.split(':')[1];
        const linkedNote = NoteManager.getNote(noteId);
        if (linkedNote?.flagData) {
          const linkedData = linkedNote.flagData;
          if (linkedData.repeat === 'computed' && linkedData.computedConfig) return resolveComputedDate(linkedData.computedConfig, year);
          const occurrences = getOccurrencesInRange(linkedData, { year, month: 0, day: 1 }, { year, month: 11, day: 31 }, 1);
          if (occurrences.length > 0) return occurrences[0];
        }
      }
      return null;
  }
}

/**
 * Resolve "first X after" condition.
 * @param {object} startDate - Date to search from
 * @param {string} condition - Condition type (moonPhase, weekday)
 * @param {object} params - Condition params
 * @param {object} calendar - Calendar instance
 * @returns {object|null} Date or null
 */
function resolveFirstAfter(startDate, condition, params, calendar) {
  const maxSearch = 200;
  let currentDate = { ...startDate };

  for (let i = 0; i < maxSearch; i++) {
    currentDate = addDays(currentDate, 1);
    switch (condition) {
      case 'moonPhase': {
        const moons = calendar?.moonsArray ?? [];
        const moonIndex = params?.moon ?? 0;
        const targetPhase = params?.phase ?? 'full';
        if (moonIndex >= moons.length) return null;
        const moon = moons[moonIndex];
        const phaseIndex = getCalendarMoonPhaseIndex(currentDate, moonIndex);
        if (phaseIndex === null) break;
        const phaseName = Object.values(moon.phases ?? {})[phaseIndex]?.name?.toLowerCase() || '';
        if (phaseName.includes(targetPhase.toLowerCase())) return currentDate;
        break;
      }
      case 'weekday': {
        const targetWeekday = params?.weekday ?? 0;
        if (dayOfWeek(currentDate) === targetWeekday) return currentDate;
        break;
      }
      default:
        return null;
    }
  }
  return null;
}

/**
 * Resolve weekday on or after a date.
 * @param {object} startDate - Date to search from
 * @param {number} targetWeekday - Target weekday (0-indexed)
 * @param {object} calendar - Calendar instance
 * @returns {object} Date on or after with matching weekday
 */
function resolveWeekdayOnOrAfter(startDate, targetWeekday, calendar) {
  const currentWeekday = dayOfWeek(startDate);
  if (currentWeekday === targetWeekday) return { ...startDate };
  const daysInWeek = calendar?.daysInWeek ?? 7;
  const daysToAdd = (targetWeekday - currentWeekday + daysInWeek) % daysInWeek;
  return addDays(startDate, daysToAdd);
}

/**
 * Convert day of year to date object.
 * @param {number} dayOfYear - Day of year (1-based)
 * @param {number} year - Year
 * @param {object} calendar - Calendar instance
 * @returns {object} Date { year, month, day }
 */
function dayOfYearToDate(dayOfYear, year, calendar) {
  const months = calendar?.monthsArray ?? [];
  let remaining = dayOfYear;
  for (let m = 0; m < months.length; m++) {
    const daysInMonth = months[m]?.days || 30;
    if (remaining <= daysInMonth) return { year, month: m, day: remaining };
    remaining -= daysInMonth;
  }
  return { year, month: months.length - 1, day: months[months.length - 1]?.days || 1 };
}

/**
 * Check if note matches computed recurrence pattern.
 * @param {object} noteData - Note flag data
 * @param {object} targetDate - Date to check
 * @returns {boolean} True if matches
 */
function matchesComputed(noteData, targetDate) {
  const { computedConfig, startDate, repeatEndDate, maxOccurrences } = noteData;
  if (!computedConfig?.chain?.length) return false;
  if (compareDays(targetDate, startDate) < 0) return false;
  if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;

  const resolvedDate = resolveComputedDate(computedConfig, targetDate.year);
  if (!resolvedDate) return false;
  const matches = isSameDay(resolvedDate, targetDate);
  if (matches && maxOccurrences > 0) {
    const occurrenceNum = countComputedOccurrencesUpTo(noteData, targetDate);
    if (occurrenceNum > maxOccurrences) return false;
  }
  return matches;
}

/**
 * Count computed occurrences up to a target date.
 * @param {object} noteData - Note flag data
 * @param {object} targetDate - Target date
 * @returns {number} Occurrence count
 */
function countComputedOccurrencesUpTo(noteData, targetDate) {
  const { computedConfig, startDate } = noteData;
  let count = 0;
  for (let y = startDate.year; y <= targetDate.year; y++) {
    const resolved = resolveComputedDate(computedConfig, y);
    if (resolved && compareDays(resolved, startDate) >= 0 && compareDays(resolved, targetDate) <= 0) count++;
  }
  return count;
}

/**
 * Get computed event occurrences in a date range.
 * @param {object} noteData - Note flag data
 * @param {object} rangeStart - Start of range
 * @param {object} rangeEnd - End of range
 * @param {number} maxOccurrences - Max occurrences to return
 * @returns {object[]} Array of dates
 */
function getComputedOccurrencesInRange(noteData, rangeStart, rangeEnd, maxOccurrences) {
  const { computedConfig, startDate, repeatEndDate, maxOccurrences: noteMaxOccurrences } = noteData;
  const occurrences = [];
  if (!computedConfig?.chain?.length) return occurrences;

  let totalCount = 0;
  for (let year = rangeStart.year; year <= rangeEnd.year; year++) {
    const resolved = resolveComputedDate(computedConfig, year);
    if (!resolved) continue;
    if (compareDays(resolved, startDate) < 0) continue;
    if (repeatEndDate && compareDays(resolved, repeatEndDate) > 0) continue;
    if (compareDays(resolved, rangeStart) < 0) continue;
    if (compareDays(resolved, rangeEnd) > 0) continue;
    totalCount++;
    if (noteMaxOccurrences > 0 && totalCount > noteMaxOccurrences) break;
    occurrences.push(resolved);
    if (occurrences.length >= maxOccurrences) break;
  }
  return occurrences;
}

/**
 * Check if a recurring note occurs on a target date.
 * @param {object} noteData  Note flag data with recurrence settings
 * @param {object} targetDate  Date to check
 * @returns {boolean}  True if note occurs on this date
 */
export function isRecurringMatch(noteData, targetDate) {
  const { startDate, endDate, repeat, repeatInterval, repeatEndDate, moonConditions, randomConfig, cachedRandomOccurrences, linkedEvent, maxOccurrences } = noteData;
  if (linkedEvent?.noteId) return matchesLinkedEvent(linkedEvent, targetDate, startDate, repeatEndDate);
  if (repeat === 'computed') return matchesComputed(noteData, targetDate);
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
    if (matches && noteData.conditions?.length > 0) if (!evaluateConditions(noteData.conditions, targetDate, startDate)) return false;
    return matches;
  }

  if (repeat === 'moon') {
    if (!moonConditions?.length) return false;
    if (compareDays(targetDate, startDate) < 0) return false;
    if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;
    const matches = matchesMoonConditions(moonConditions, targetDate);
    if (matches && maxOccurrences > 0) {
      const occurrenceNum = countOccurrencesUpTo(noteData, targetDate);
      if (occurrenceNum > maxOccurrences) return false;
    }
    if (matches && noteData.conditions?.length > 0) if (!evaluateConditions(noteData.conditions, targetDate, startDate)) return false;
    return matches;
  }

  if (moonConditions?.length > 0) if (!matchesMoonConditions(moonConditions, targetDate)) return false;
  if (repeat === 'never' || !repeat) {
    if (!isSameDay(startDate, targetDate)) return false;
    if (noteData.conditions?.length > 0) if (!evaluateConditions(noteData.conditions, targetDate, startDate)) return false;
    return true;
  }

  if (compareDays(targetDate, startDate) < 0) return false;
  if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;
  const duration = endDate && !isSameDay(startDate, endDate) ? daysBetween(startDate, endDate) : 0;
  if (duration > 0 && compareDays(targetDate, endDate) <= 0) return true;
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
      if (noteData.conditions?.length > 0 && !evaluateConditions(noteData.conditions, targetDate, startDate)) return false;
      return true;
    case 'weekOfMonth':
      matches = matchesWeekOfMonth(startDate, targetDate, interval, noteData.weekday, noteData.weekNumber);
      break;
    case 'seasonal':
      matches = matchesSeasonal(noteData.seasonalConfig, targetDate);
      break;
    default:
      return false;
  }
  if (!matches && duration > 0) {
    for (let offset = 1; offset <= duration; offset++) {
      const potentialStart = addDays(targetDate, -offset);
      if (compareDays(potentialStart, startDate) < 0) continue;
      if (repeatEndDate && compareDays(potentialStart, repeatEndDate) > 0) continue;
      let isStart = false;
      switch (repeat) {
        case 'daily':
          isStart = matchesDaily(startDate, potentialStart, interval);
          break;
        case 'weekly':
          isStart = matchesWeekly(startDate, potentialStart, interval);
          break;
        case 'monthly':
          isStart = matchesMonthly(startDate, potentialStart, interval);
          break;
        case 'yearly':
          isStart = matchesYearly(startDate, potentialStart, interval);
          break;
        case 'weekOfMonth':
          isStart = matchesWeekOfMonth(startDate, potentialStart, interval, noteData.weekday, noteData.weekNumber);
          break;
        default:
          break;
      }
      if (isStart) {
        matches = true;
        break;
      }
    }
  }

  if (matches && maxOccurrences > 0) {
    const occurrenceNum = countOccurrencesUpTo(noteData, targetDate);
    if (occurrenceNum > maxOccurrences) return false;
  }

  if (matches && noteData.conditions?.length > 0) if (!evaluateConditions(noteData.conditions, targetDate, startDate)) return false;
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
  const { startDate, repeat, repeatInterval, cachedRandomOccurrences } = noteData;
  const interval = repeatInterval || 1;
  switch (repeat) {
    case 'daily': {
      const daysDiff = daysBetween(startDate, targetDate);
      return Math.floor(daysDiff / interval) + 1;
    }
    case 'weekly': {
      const daysDiff = daysBetween(startDate, targetDate);
      const calendar = CalendarManager.getActiveCalendar();
      const daysInWeek = calendar?.daysInWeek ?? 7;
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
      if (cachedRandomOccurrences?.length) {
        let count = 0;
        for (const occ of cachedRandomOccurrences) if (compareDays(occ, targetDate) <= 0) count++;
        return count;
      }
      break;
    }
    case 'weekOfMonth': {
      const monthsDiff = monthsBetween(startDate, targetDate);
      return Math.floor(monthsDiff / interval) + 1;
    }
    case 'seasonal':
    case 'moon':
    default:
      break;
  }

  const occurrences = getOccurrencesInRange({ ...noteData, maxOccurrences: 0 }, startDate, targetDate, 10000);
  return occurrences.length;
}

/**
 * Check if target date matches any moon condition.
 * Supports modifiers: 'any' (default), 'rising' (first third), 'true' (middle third), 'fading' (last third).
 * Uses the calendar's getMoonPhase directly to ensure alignment with display.
 * @param {object[]} moonConditions  Array of moon condition objects
 * @param {object} targetDate  Date to check
 * @returns {boolean}  True if any moon condition matches
 */
function matchesMoonConditions(moonConditions, targetDate) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar?.moonsArray?.length) return false;
  const yearZero = calendar.years?.yearZero ?? 0;
  const components = { year: targetDate.year - yearZero, month: targetDate.month, dayOfMonth: targetDate.day - 1, hour: 12, minute: 0, second: 0 };
  for (const cond of moonConditions) {
    const moonPhaseInfo = calendar.getMoonPhase(cond.moonIndex, components);
    if (!moonPhaseInfo) continue;
    const modifier = cond.modifier || 'any';
    if (modifier === 'any') {
      if (moonPhaseInfo.phaseIndex !== undefined) {
        const moon = calendar.moonsArray[cond.moonIndex];
        const phasesArr = Object.values(moon?.phases ?? {});
        const phase = phasesArr[moonPhaseInfo.phaseIndex];
        if (phase && Math.abs(phase.start - cond.phaseStart) < 0.01 && Math.abs(phase.end - cond.phaseEnd) < 0.01) return true;
      }
      continue;
    }
    const moon = calendar.moonsArray[cond.moonIndex];
    const phase = Object.values(moon?.phases ?? {})[moonPhaseInfo.phaseIndex];
    if (!phase || Math.abs(phase.start - cond.phaseStart) >= 0.01 || Math.abs(phase.end - cond.phaseEnd) >= 0.01) continue;
    const { dayWithinPhase, phaseDuration } = moonPhaseInfo;
    const third = phaseDuration / 3;
    if (modifier === 'rising' && dayWithinPhase < third) return true;
    if (modifier === 'true' && dayWithinPhase >= third && dayWithinPhase < phaseDuration - third) return true;
    if (modifier === 'fading' && dayWithinPhase >= phaseDuration - third) return true;
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
  if (compareDays(targetDate, startDate) < 0) return false;
  if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;
  const linkedNote = NoteManager.getNote(noteId);
  if (!linkedNote?.flagData) return false;
  const sourceDate = addDays(targetDate, -offset);
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
  const linkedNote = NoteManager.getNote(noteId);
  if (!linkedNote?.flagData) return occurrences;
  const adjustedRangeStart = addDays(rangeStart, -offset);
  const adjustedRangeEnd = addDays(rangeEnd, -offset);
  const linkedNoteData = { ...linkedNote.flagData, linkedEvent: null };
  const linkedOccurrences = getOccurrencesInRange(linkedNoteData, adjustedRangeStart, adjustedRangeEnd, maxOccurrences);
  for (const occ of linkedOccurrences) {
    const shiftedDate = addDays(occ, offset);
    if (compareDays(shiftedDate, noteStartDate) < 0) continue;
    if (noteEndDate && compareDays(shiftedDate, noteEndDate) > 0) continue;
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
  if (checkInterval === 'weekly') {
    const startDOW = dayOfWeek(startDate);
    const targetDOW = dayOfWeek(targetDate);
    if (startDOW !== targetDOW) return false;
  } else if (checkInterval === 'monthly') {
    if (startDate.day !== targetDate.day) return false;
  }

  const dayOfYearValue = getDayOfYear(targetDate);
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
  if (daysDiff < 0) return false;
  const startDayOfWeek = dayOfWeek(startDate);
  const targetDayOfWeek = dayOfWeek(targetDate);
  if (startDayOfWeek !== targetDayOfWeek) return false;
  const calendar = CalendarManager.getActiveCalendar();
  const daysInWeek = calendar?.daysInWeek ?? 7;
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
  if (monthsDiff < 0 || monthsDiff % interval !== 0) return false;
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
  if (yearsDiff < 0 || yearsDiff % interval !== 0) return false;
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
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return 30;
  const yearZero = calendar.years?.yearZero ?? 0;
  return calendar.getDaysInMonth(date.month, date.year - yearZero);
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
  const daysInWeek = calendar?.daysInWeek ?? 7;
  const targetWeekday = weekday ?? dayOfWeek(startDate);
  let targetWeekNumber = weekNumber;
  if (targetWeekNumber == null) targetWeekNumber = Math.ceil(startDate.day / daysInWeek);
  const currentWeekday = dayOfWeek(targetDate);
  if (currentWeekday !== targetWeekday) return false;
  const monthsDiff = monthsBetween(startDate, targetDate);
  if (monthsDiff < 0 || monthsDiff % interval !== 0) return false;
  const targetDayWeekNumber = getWeekNumberInMonth(targetDate, daysInWeek);
  if (targetWeekNumber > 0) {
    return targetDayWeekNumber === targetWeekNumber;
  } else {
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
  const weeksRemaining = Math.floor(daysUntilEndOfMonth / daysInWeek);
  return weeksRemaining + 1;
}

/**
 * Check if note matches seasonal recurrence pattern.
 * @param {object} seasonalConfig - Seasonal config object {seasonIndex, trigger}
 * @param {object} targetDate - Date to check
 * @returns {boolean} True if matches
 */
function matchesSeasonal(seasonalConfig, targetDate) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar?.seasonsArray?.length) return false;
  if (!seasonalConfig) return false;
  const seasonIndex = seasonalConfig.seasonIndex ?? 0;
  const trigger = seasonalConfig.trigger ?? 'entire';
  const targetSeason = calendar.seasonsArray[seasonIndex];
  if (!targetSeason) return false;
  const targetDayOfYear = getDayOfYear(targetDate);
  const seasonStart = targetSeason.dayStart ?? 0;
  const seasonEnd = targetSeason.dayEnd ?? seasonStart;
  const inSeason = isInSeasonRange(targetDayOfYear, seasonStart, seasonEnd);
  if (!inSeason) return false;
  switch (trigger) {
    case 'firstDay':
      return targetDayOfYear === seasonStart || (seasonStart > seasonEnd && targetDayOfYear === seasonStart);
    case 'lastDay':
      return targetDayOfYear === seasonEnd;
    case 'entire':
    default:
      return true;
  }
}

/**
 * Check if a day of year is within a season's range.
 * Handles seasons that wrap around the year boundary.
 * @param {number} dayOfYear - Target day of year
 * @param {number} start - Season start day
 * @param {number} end - Season end day
 * @returns {boolean} - Is day part of given season?
 */
function isInSeasonRange(dayOfYear, start, end) {
  if (start <= end) return dayOfYear >= start && dayOfYear <= end;
  else return dayOfYear >= start || dayOfYear <= end;
}

/**
 * Get total days in year from calendar, accounting for leap years.
 * @param {number} [year] - The display year to check
 * @returns {number} - Total days in the year
 */
function getTotalDaysInYear(year) {
  const calendar = CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  return calendar.getDaysInYear(year - yearZero);
}

/**
 * Find the day number for an ordinal weekday occurrence in a month.
 * E.g., "2nd Tuesday" or "Last Friday".
 * @param {number} year - Year
 * @param {number} month - Month index (0-based)
 * @param {number} weekday - Target weekday (0-indexed)
 * @param {number} weekNumber - Ordinal (1-5 for 1st-5th, -1 to -5 for last, etc.)
 * @returns {number|null} Day number (1-indexed) or null if not found
 */
function findWeekdayInMonth(year, month, weekday, weekNumber) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const yearZero = calendar.years?.yearZero ?? 0;
  const daysInMonth = calendar.getDaysInMonth(month, year - yearZero);
  const occurrences = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = { year, month, day };
    if (dayOfWeek(date) === weekday) occurrences.push(day);
  }
  if (occurrences.length === 0) return null;
  if (weekNumber > 0) {
    const idx = weekNumber - 1;
    return idx < occurrences.length ? occurrences[idx] : null;
  } else {
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
  if (compareDays(targetDate, startDate) < 0) return false;
  if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;
  if (!matchesRangeBit(year, targetDate.year)) return false;
  if (!matchesRangeBit(month, targetDate.month)) return false;
  if (!matchesRangeBit(day, targetDate.day)) return false;
  return true;
}

/**
 * Check if a value matches a range bit specification.
 * @param {number|Array|null} rangeBit - Range specification
 * @param {number} value - Value to check
 * @returns {boolean} True if value matches range bit
 */
function matchesRangeBit(rangeBit, value) {
  if (rangeBit == null) return true;
  if (typeof rangeBit === 'number') return value === rangeBit;
  if (Array.isArray(rangeBit) && rangeBit.length === 2) {
    const [min, max] = rangeBit;
    if (min === null && max === null) return true;
    if (min !== null && max === null) return value >= min;
    if (min === null && max !== null) return value <= max;
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
  if (linkedEvent?.noteId) return getLinkedEventOccurrences(linkedEvent, rangeStart, rangeEnd, startDate, repeatEndDate, maxOccurrences);
  if (repeat === 'never' || !repeat) {
    const afterStart = compareDays(startDate, rangeStart) >= 0;
    const beforeEnd = compareDays(startDate, rangeEnd) <= 0;
    if (afterStart && beforeEnd) occurrences.push({ ...startDate });
    return occurrences;
  }

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

  if (repeat === 'random') {
    const { cachedRandomOccurrences, maxOccurrences: noteMaxOccurrences } = noteData;
    if (cachedRandomOccurrences?.length) {
      const limitedCache = noteMaxOccurrences > 0 ? cachedRandomOccurrences.slice(0, noteMaxOccurrences) : cachedRandomOccurrences;
      for (const occ of limitedCache) {
        if (compareDays(occ, rangeStart) >= 0 && compareDays(occ, rangeEnd) <= 0) {
          occurrences.push({ ...occ });
          if (occurrences.length >= maxOccurrences) break;
        }
      }
      return occurrences;
    }

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

      if (checkInterval === 'weekly') {
        const calendar = CalendarManager.getActiveCalendar();
        const daysInWeek = calendar?.daysInWeek ?? 7;
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

  if (repeat === 'weekOfMonth') {
    const calendar = CalendarManager.getActiveCalendar();
    const daysInWeek = calendar?.daysInWeek ?? 7;
    const interval = noteData.repeatInterval || 1;
    const targetWeekday = noteData.weekday ?? dayOfWeek(startDate);
    const weekNumber = noteData.weekNumber ?? Math.ceil(startDate.day / daysInWeek);
    let currentMonth = compareDays(startDate, rangeStart) >= 0 ? { year: startDate.year, month: startDate.month } : { year: rangeStart.year, month: rangeStart.month };
    let iterations = 0;
    const maxIterations = 1000;

    while (iterations < maxIterations) {
      const matchingDay = findWeekdayInMonth(currentMonth.year, currentMonth.month, targetWeekday, weekNumber);
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
      currentMonth = addMonths({ ...currentMonth, day: 1 }, interval);
      iterations++;
    }
    return occurrences;
  }

  if (repeat === 'computed') return getComputedOccurrencesInRange(noteData, rangeStart, rangeEnd, maxOccurrences);

  if (repeat === 'seasonal') {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.seasonsArray?.length) return occurrences;
    const config = noteData.seasonalConfig;
    if (!config) return occurrences;
    const season = calendar.seasonsArray[config.seasonIndex];
    if (!season) return occurrences;
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

  let currentDate = compareDays(startDate, rangeStart) >= 0 ? { ...startDate } : { ...rangeStart };
  const interval = repeatInterval || 1;

  let iterations = 0;
  const maxIterations = 10000;
  while (compareDays(currentDate, rangeEnd) <= 0 && iterations < maxIterations) {
    if (isRecurringMatch(noteData, currentDate)) {
      occurrences.push({ ...currentDate });
      if (occurrences.length >= maxOccurrences) break;
    }

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
  const daysInWeek = calendar?.daysInWeek ?? 7;

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
  const formatDate = (d) => `${d.month + 1}/${d.day}/${d.year}`;
  const appendUntil = (desc) => (repeatEndDate ? `${desc} ${format('CALENDARIA.Recurrence.Until', { date: formatDate(repeatEndDate) })}` : desc);
  const appendMaxOccurrences = (desc) => {
    if (maxOccurrences > 0) {
      const suffix = maxOccurrences === 1 ? localize('CALENDARIA.Recurrence.TimesOnce') : format('CALENDARIA.Recurrence.Times', { count: maxOccurrences });
      return `${desc}, ${suffix}`;
    }
    return desc;
  };
  if (linkedEvent?.noteId) {
    const linkedNote = NoteManager.getNote(linkedEvent.noteId);
    const linkedName = linkedNote?.name || localize('CALENDARIA.Note.UnknownEvent');
    const offset = linkedEvent.offset || 0;
    let description;
    if (offset === 0) description = format('CALENDARIA.Recurrence.SameDayAs', { name: linkedName });
    else if (offset > 0) {
      description = offset === 1 ? format('CALENDARIA.Recurrence.DayAfter', { count: offset, name: linkedName }) : format('CALENDARIA.Recurrence.DaysAfter', { count: offset, name: linkedName });
    } else {
      const absOffset = Math.abs(offset);
      description =
        absOffset === 1 ? format('CALENDARIA.Recurrence.DayBefore', { count: absOffset, name: linkedName }) : format('CALENDARIA.Recurrence.DaysBefore', { count: absOffset, name: linkedName });
    }
    return appendUntil(appendMaxOccurrences(description));
  }
  if (repeat === 'never' || !repeat) return localize('CALENDARIA.Recurrence.DoesNotRepeat');
  if (repeat === 'computed') return appendUntil(appendMaxOccurrences(getComputedDescription(noteData.computedConfig)));
  if (repeat === 'moon') return appendUntil(appendMaxOccurrences(getMoonConditionsDescription(moonConditions)));
  if (repeat === 'random') {
    const probability = randomConfig?.probability ?? 10;
    const checkInterval = randomConfig?.checkInterval ?? 'daily';
    const intervalKey = checkInterval === 'weekly' ? 'IntervalWeekly' : checkInterval === 'monthly' ? 'IntervalMonthly' : 'IntervalDaily';
    const description = format('CALENDARIA.Recurrence.ChanceEach', { probability, interval: localize(`CALENDARIA.Recurrence.${intervalKey}`) });
    return appendUntil(appendMaxOccurrences(description));
  }
  if (repeat === 'range') return appendUntil(appendMaxOccurrences(describeRangePattern(noteData.rangePattern)));
  if (repeat === 'weekOfMonth') {
    const calendar = CalendarManager.getActiveCalendar();
    const weekdays = calendar?.weekdaysArray ?? [];
    const weekNumber = noteData.weekNumber ?? 1;
    const weekdayIndex = noteData.weekday ?? 0;
    const weekdayName = weekdays[weekdayIndex]?.name ? localize(weekdays[weekdayIndex].name) : `Day ${weekdayIndex + 1}`;
    let ordinal;

    if (weekNumber > 0) {
      const ordinalKeys = ['WeekOrdinal1st', 'WeekOrdinal2nd', 'WeekOrdinal3rd', 'WeekOrdinal4th', 'WeekOrdinal5th'];
      ordinal = localize(`CALENDARIA.Note.${ordinalKeys[weekNumber - 1]}`) || `${weekNumber}th`;
    } else {
      const inverseKeys = ['WeekOrdinalLast', 'WeekOrdinal2ndLast'];
      ordinal = localize(`CALENDARIA.Note.${inverseKeys[Math.abs(weekNumber) - 1]}`) || localize('CALENDARIA.Note.WeekOrdinalLast');
    }

    const interval = repeatInterval || 1;
    const description =
      interval === 1
        ? format('CALENDARIA.Recurrence.OrdinalEveryMonth', { ordinal, weekday: weekdayName })
        : format('CALENDARIA.Recurrence.OrdinalEveryXMonths', { ordinal, weekday: weekdayName, count: interval });
    return appendUntil(appendMaxOccurrences(description));
  }

  if (repeat === 'seasonal') {
    const calendar = CalendarManager.getActiveCalendar();
    const seasons = calendar?.seasonsArray ?? [];
    const config = noteData.seasonalConfig;
    const seasonName = seasons[config?.seasonIndex]?.name ? localize(seasons[config?.seasonIndex].name) : `Season ${(config?.seasonIndex ?? 0) + 1}`;
    const trigger = config?.trigger ?? 'entire';
    let description;
    switch (trigger) {
      case 'firstDay':
        description = format('CALENDARIA.Recurrence.FirstDayOf', { season: seasonName });
        break;
      case 'lastDay':
        description = format('CALENDARIA.Recurrence.LastDayOf', { season: seasonName });
        break;
      case 'entire':
      default:
        description = format('CALENDARIA.Recurrence.EveryDayDuring', { season: seasonName });
        break;
    }
    return appendUntil(appendMaxOccurrences(description));
  }

  const interval = repeatInterval || 1;
  const unitKey = repeat === 'daily' ? 'Day' : repeat === 'weekly' ? 'Week' : repeat === 'monthly' ? 'Month' : repeat === 'yearly' ? 'Year' : '';
  let description;
  if (interval === 1) description = format('CALENDARIA.Recurrence.EveryUnit', { unit: localize(`CALENDARIA.Recurrence.Unit.${unitKey}`) });
  else description = format('CALENDARIA.Recurrence.EveryXUnits', { count: interval, units: localize(`CALENDARIA.Recurrence.Unit.${unitKey}s`) });
  if (moonConditions?.length > 0) description += ` (${getMoonConditionsDescription(moonConditions)})`;
  return appendUntil(appendMaxOccurrences(description));
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
  if (!calendar?.monthsArray) return [];
  const occurrences = [];
  const maxOccurrences = 500;
  const lastMonthIndex = calendar.monthsArray.length - 1;
  const lastMonthDays = calendar.monthsArray[lastMonthIndex]?.days || 30;
  const yearEnd = { year: targetYear, month: lastMonthIndex, day: lastMonthDays };
  let currentDate = { ...startDate };
  if (currentDate.year > targetYear) return [];
  const rangeStart = { ...startDate };
  let rangeEnd = yearEnd;
  if (repeatEndDate && compareDays(repeatEndDate, yearEnd) < 0) rangeEnd = repeatEndDate;
  const { checkInterval } = randomConfig;
  let iterations = 0;
  const maxIterations = 50000;

  while (compareDays(currentDate, rangeEnd) <= 0 && iterations < maxIterations) {
    if (compareDays(currentDate, rangeStart) >= 0) {
      if (matchesRandom(randomConfig, currentDate, startDate)) {
        occurrences.push({ year: currentDate.year, month: currentDate.month, day: currentDate.day });
        if (occurrences.length >= maxOccurrences) break;
      }
    }

    if (checkInterval === 'weekly') currentDate = addDays(currentDate, calendar?.daysInWeek ?? 7);
    else if (checkInterval === 'monthly') currentDate = addMonths(currentDate, 1);
    else currentDate = addDays(currentDate, 1);
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
  if (!calendar?.monthsArray) return false;
  const components = game.time.components || {};
  const yearZero = calendar?.years?.yearZero ?? 0;
  const currentYear = (components.year ?? 0) + yearZero;
  const currentMonth = components.month ?? 0;
  const currentDay = (components.dayOfMonth ?? 0) + 1;
  const lastMonthIndex = calendar.monthsArray.length - 1;
  const lastMonthDays = calendar.monthsArray[lastMonthIndex]?.days || 30;
  const daysInWeek = calendar?.daysInWeek ?? 7;
  if (cachedData.year < currentYear) return true;
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
 * Get human-readable description of computed recurrence.
 * @param {object} computedConfig - Computed config
 * @returns {string} Description
 */
function getComputedDescription(computedConfig) {
  if (!computedConfig?.chain?.length) return localize('CALENDARIA.Recurrence.ComputedEvent');
  const steps = [];
  for (const step of computedConfig.chain) {
    switch (step.type) {
      case 'anchor':
        if (step.value === 'springEquinox') steps.push(localize('CALENDARIA.Recurrence.SpringEquinox'));
        else if (step.value === 'autumnEquinox') steps.push(localize('CALENDARIA.Recurrence.AutumnEquinox'));
        else if (step.value === 'summerSolstice') steps.push(localize('CALENDARIA.Recurrence.SummerSolstice'));
        else if (step.value === 'winterSolstice') steps.push(localize('CALENDARIA.Recurrence.WinterSolstice'));
        else if (step.value?.startsWith('event:')) steps.push(format('CALENDARIA.Recurrence.AfterEvent', { event: step.value.split(':')[1] }));
        else steps.push(step.value);
        break;
      case 'firstAfter':
        if (step.condition === 'moonPhase') steps.push(format('CALENDARIA.Recurrence.FirstMoonPhaseAfter', { phase: step.params?.phase || 'full' }));
        else if (step.condition === 'weekday') {
          const calendar = CalendarManager.getActiveCalendar();
          const weekdays = calendar?.weekdaysArray ?? [];
          const wdName = weekdays[step.params?.weekday]?.name ? localize(weekdays[step.params?.weekday].name) : 'weekday';
          steps.push(format('CALENDARIA.Recurrence.FirstWeekdayAfter', { weekday: wdName }));
        }
        break;
      case 'daysAfter':
        steps.push(format('CALENDARIA.Recurrence.DaysAfterAnchor', { days: step.params?.days || 0 }));
        break;
      case 'weekdayOnOrAfter': {
        const calendar = CalendarManager.getActiveCalendar();
        const weekdays = calendar?.weekdaysArray ?? [];
        const wdName = weekdays[step.params?.weekday]?.name ? localize(weekdays[step.params?.weekday].name) : 'weekday';
        steps.push(format('CALENDARIA.Recurrence.WeekdayOnOrAfter', { weekday: wdName }));
        break;
      }
    }
  }
  return steps.join(' → ') || localize('CALENDARIA.Recurrence.ComputedEvent');
}

/**
 * Get human-readable description of moon conditions.
 * @param {object[]} moonConditions  Array of moon condition objects
 * @returns {string}  Description like "Every Full Moon"
 */
function getMoonConditionsDescription(moonConditions) {
  if (!moonConditions?.length) return 'Moon phase event';
  const calendar = CalendarManager.getActiveCalendar();
  const modifierLabels = {
    any: '',
    rising: ` (${localize('CALENDARIA.Note.MoonModifier.Rising')})`,
    true: ` (${localize('CALENDARIA.Note.MoonModifier.True')})`,
    fading: ` (${localize('CALENDARIA.Note.MoonModifier.Fading')})`
  };
  const descriptions = [];
  for (const cond of moonConditions) {
    const moon = calendar?.moonsArray?.[cond.moonIndex];
    const moonName = moon?.name ? localize(moon.name) : `Moon ${cond.moonIndex + 1}`;
    const modifierSuffix = modifierLabels[cond.modifier] || '';

    const matchingPhases = Object.values(moon?.phases ?? {}).filter((p) => {
      if (cond.phaseStart <= cond.phaseEnd) return p.start < cond.phaseEnd && p.end > cond.phaseStart;
      else return p.end > cond.phaseStart || p.start < cond.phaseEnd;
    });

    if (matchingPhases?.length === 1) {
      const phaseName = localize(matchingPhases[0].name);
      descriptions.push(`${moonName}: ${phaseName}${modifierSuffix}`);
    } else if (matchingPhases?.length > 1) {
      const phaseNames = matchingPhases.map((p) => localize(p.name)).join(', ');
      descriptions.push(`${moonName}: ${phaseNames}${modifierSuffix}`);
    } else {
      descriptions.push(`${moonName}: custom phase${modifierSuffix}`);
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
  if (typeof bit === 'number') return `${unit}=${bit}`;
  if (Array.isArray(bit) && bit.length === 2) {
    const [min, max] = bit;
    if (min === null && max === null) return `any ${unit}`;
    if (min !== null && max === null) return `${unit}>=${min}`;
    if (min === null && max !== null) return `${unit}<=${max}`;
    return `${unit}=${min}-${max}`;
  }
  return null;
}
