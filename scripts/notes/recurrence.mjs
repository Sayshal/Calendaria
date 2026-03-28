/**
 * Recurring Event Logic
 * @module Notes/Utils/Recurrence
 * @author Tyler
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { CONDITION_FIELDS, CONDITION_OPERATORS } from '../constants.mjs';
import { format, getCalendarMoonPhaseIndex, getDayOfYear, getLastDayOfMonth, getMidpoint, isInSeasonRange, localize, log, seededRandom } from '../utils/_module.mjs';
import {
  EpochDataCache,
  NoteManager,
  addDays,
  addMonths,
  addYears,
  canConditionTreeMatchRange,
  compareDays,
  createEpochContext,
  dayOfWeek,
  daysBetween,
  evaluateConditions,
  evaluateEntry,
  getSearchDistanceFromTree,
  isGroup,
  isSameDay,
  monthsBetween,
  registerFieldHandler
} from './_module.mjs';

/** Recursion guard for resolveAnchor event: references. */
const _resolvingAnchors = new Set();

/** Per-config, per-year cache for resolveComputedDate results. Keyed by stable fingerprint. */
const _computedDateCache = new Map();

/**
 * Compute the effective duration in days for a note.
 * @param {object} noteData - Note flag data
 * @returns {number} Duration in days (0 if no duration)
 */
export function getEffectiveDuration(noteData) {
  const { startDate, endDate, hasDuration, duration } = noteData;
  if (hasDuration && duration > 0) return duration - 1;
  if (endDate && !isSameDay(startDate, endDate)) return daysBetween(startDate, endDate);
  return 0;
}

/**
 * Resolve a computed date for a given year using the chain.
 * @param {object} computedConfig - Computed config { chain, yearOverrides }
 * @param {number} year - Year to compute for
 * @returns {object|null} Resolved date { year, month, day } or null
 */
export function resolveComputedDate(computedConfig, year) {
  if (!computedConfig?.chain?.length) return null;
  const key = (computedConfig._cacheKey ??= JSON.stringify(computedConfig.chain));
  let yearMap = _computedDateCache.get(key);
  if (yearMap?.has(year)) return yearMap.get(year);
  const { chain, yearOverrides } = computedConfig;
  let result = null;
  if (yearOverrides?.[year]) {
    const override = yearOverrides[year];
    result = { year, month: override.month, dayOfMonth: override.dayOfMonth ?? override.day };
  } else {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    let currentDate = null;
    for (const step of chain) {
      switch (step.type) {
        case 'anchor':
          currentDate = resolveAnchor(step.value, year, calendar);
          break;
        case 'firstAfter':
          if (!currentDate) break;
          currentDate = resolveFirstAfter(currentDate, step.condition, step.params, calendar);
          break;
        case 'daysAfter':
          if (!currentDate) break;
          currentDate = addDays(currentDate, step.params?.days ?? 0);
          break;
        case 'weekdayOnOrAfter':
          if (!currentDate) break;
          currentDate = resolveWeekdayOnOrAfter(currentDate, step.params?.weekday ?? 0, calendar);
          break;
        default:
          break;
      }
      if (!currentDate) break;
    }
    result = currentDate ?? null;
  }
  if (!yearMap) {
    yearMap = new Map();
    _computedDateCache.set(key, yearMap);
  }
  yearMap.set(year, result);
  return result;
}

/** Clear the computed date cache. Call when calendar settings change. */
export function clearComputedDateCache() {
  _computedDateCache.clear();
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
        if (_resolvingAnchors.has(noteId)) {
          log(2, `Circular event anchor detected for note ${noteId}`);
          return null;
        }
        _resolvingAnchors.add(noteId);
        try {
          const linkedNote = NoteManager.getNote(noteId);
          if (linkedNote?.flagData) {
            const linkedData = linkedNote.flagData;
            if (linkedData.repeat === 'computed' && linkedData.computedConfig) return resolveComputedDate(linkedData.computedConfig, year);
            const occurrences = getOccurrencesInRange(linkedData, { year, month: 0, dayOfMonth: 0 }, { year, month: 11, dayOfMonth: 30 }, 1);
            if (occurrences.length > 0) return occurrences[0];
          }
        } finally {
          _resolvingAnchors.delete(noteId);
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
 * @returns {object} Date { year, month, dayOfMonth }
 */
function dayOfYearToDate(dayOfYear, year, calendar) {
  const months = calendar?.monthsArray ?? [];
  let remaining = dayOfYear;
  for (let m = 0; m < months.length; m++) {
    const daysInMonth = months[m]?.days || 30;
    if (remaining <= daysInMonth) return { year, month: m, dayOfMonth: remaining - 1 };
    remaining -= daysInMonth;
  }
  return { year, month: months.length - 1, dayOfMonth: (months[months.length - 1]?.days || 1) - 1 };
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
 * Evaluate a condition tree against a target date for a note.
 * @param {object} noteData - Note flag data with conditionTree, startDate, etc.
 * @param {object} targetDate - Date to check
 * @param {object} [options] - Options
 * @param {object} [options.epochCtx] - Epoch context for caching
 * @param {number} [options._runningCount] - Pre-computed occurrence count up to targetDate (skips re-counting)
 * @returns {boolean} True if condition tree matches this date
 */
function evaluateConditionTree(noteData, targetDate, options = {}) {
  const { startDate, endDate, repeatEndDate, conditionTree, maxOccurrences, hasDuration } = noteData;
  if (compareDays(targetDate, startDate) < 0) return false;
  if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;
  const duration = getEffectiveDuration(noteData);
  if (duration > 0 && !hasDuration && compareDays(targetDate, startDate) >= 0 && compareDays(targetDate, endDate) <= 0) return true;
  const epochCtx = options.epochCtx ?? createEpochContext(targetDate);
  const evalOptions = { startDate, epochCtx, _evaluatingNotes: options._evaluatingNotes };
  let matches;
  if (isGroup(conditionTree)) matches = evaluateConditions([conditionTree], targetDate, evalOptions);
  else matches = evaluateEntry(conditionTree, targetDate, evalOptions);
  if (!matches && duration > 0) {
    for (let offset = 1; offset <= duration; offset++) {
      const priorDate = addDays(targetDate, -offset);
      if (compareDays(priorDate, startDate) < 0) continue;
      if (repeatEndDate && compareDays(priorDate, repeatEndDate) > 0) continue;
      const priorCtx = options._cache?.getContext(priorDate) ?? createEpochContext(priorDate);
      const priorOptions = { startDate, epochCtx: priorCtx, _evaluatingNotes: options._evaluatingNotes };
      const priorMatch = isGroup(conditionTree) ? evaluateConditions([conditionTree], priorDate, priorOptions) : evaluateEntry(conditionTree, priorDate, priorOptions);
      if (priorMatch) {
        matches = true;
        break;
      }
    }
  }
  if (!matches) return false;
  if (maxOccurrences > 0) {
    const count = options._runningCount ?? countConditionTreeOccurrencesUpTo(noteData, targetDate);
    if (count > maxOccurrences) return false;
  }
  return true;
}

/**
 * Count condition tree occurrences from startDate up to (including) targetDate.
 * @param {object} noteData - Note flag data
 * @param {object} targetDate - Count up to this date
 * @returns {number} Number of occurrences
 */
function countConditionTreeOccurrencesUpTo(noteData, targetDate) {
  const { startDate, repeatEndDate, conditionTree } = noteData;
  const effectiveEnd = repeatEndDate && compareDays(repeatEndDate, targetDate) < 0 ? { ...repeatEndDate } : { ...targetDate };
  let currentDate = { ...startDate };
  let count = 0;
  const maxIterations = 100000;
  let iterations = 0;
  const cache = new EpochDataCache();
  while (compareDays(currentDate, effectiveEnd) <= 0 && iterations < maxIterations) {
    const epochCtx = cache.getContext(currentDate);
    const evalOptions = { startDate, epochCtx };
    const matches = isGroup(conditionTree) ? evaluateConditions([conditionTree], currentDate, evalOptions) : evaluateEntry(conditionTree, currentDate, evalOptions);
    if (matches) count++;
    currentDate = addDays(currentDate, 1);
    iterations++;
  }
  return count;
}

/**
 * Get all occurrences of a condition-tree note within a date range.
 * @param {object} noteData - Note flag data with conditionTree
 * @param {object} rangeStart - Range start date
 * @param {object} rangeEnd - Range end date
 * @param {number} [max] - Maximum occurrences to return
 * @returns {object[]} Array of matching date objects
 */
function getOccurrencesInRangeForTree(noteData, rangeStart, rangeEnd, max = 100) {
  const { startDate, repeatEndDate, conditionTree, maxOccurrences } = noteData;
  if (!canConditionTreeMatchRange(conditionTree, rangeStart, rangeEnd)) return [];
  const occurrences = [];
  const effectiveStart = compareDays(startDate, rangeStart) >= 0 ? { ...startDate } : { ...rangeStart };
  const effectiveEnd = repeatEndDate && compareDays(repeatEndDate, rangeEnd) < 0 ? { ...repeatEndDate } : { ...rangeEnd };
  let currentDate = { ...effectiveStart };
  let totalCount = 0;
  const cache = new EpochDataCache();
  if (maxOccurrences > 0 && compareDays(effectiveStart, startDate) > 0) totalCount = countConditionTreeOccurrencesUpTo(noteData, addDays(effectiveStart, -1));
  const maxIterations = 100000;
  let iterations = 0;
  while (compareDays(currentDate, effectiveEnd) <= 0 && iterations < maxIterations) {
    const epochCtx = cache.getContext(currentDate);
    const evalOptions = { startDate, epochCtx };
    const matches = isGroup(conditionTree) ? evaluateConditions([conditionTree], currentDate, evalOptions) : evaluateEntry(conditionTree, currentDate, evalOptions);
    if (matches) {
      totalCount++;
      if (maxOccurrences > 0 && totalCount > maxOccurrences) break;
      occurrences.push({ ...currentDate });
      if (occurrences.length >= max) break;
    }
    currentDate = addDays(currentDate, 1);
    iterations++;
  }
  return occurrences;
}

/**
 * Get the next N occurrences of a note from a given date.
 * @param {object} noteData - Note flag data
 * @param {object} fromDate - Start searching from this date
 * @param {number} [count] - Number of occurrences to find
 * @param {number} [maxSearchDays] - Maximum days to search forward (auto-estimated if omitted)
 * @returns {object[]} Array of occurrence dates
 */
export function getNextOccurrences(noteData, fromDate, count = 1, maxSearchDays) {
  const searchDays = maxSearchDays ?? (noteData.conditionTree ? getSearchDistanceFromTree(noteData.conditionTree) * (count + 1) : 366 * (count + 1));
  const rangeEnd = addDays(fromDate, searchDays);
  return getOccurrencesInRange(noteData, fromDate, rangeEnd, count);
}

/**
 * Check if a recurring note occurs on a target date.
 * @param {object} noteData  Note flag data with recurrence settings
 * @param {object} targetDate  Date to check
 * @param {object} [evalOptions] - Options forwarded to condition tree evaluation
 * @param {Set<string>} [evalOptions._evaluatingNotes] - Circular dependency guard for event conditions
 * @returns {boolean}  True if note occurs on this date
 */
export function isRecurringMatch(noteData, targetDate, evalOptions) {
  ensureFieldHandlersRegistered();
  if (noteData.conditionTree?.type) return evaluateConditionTree(noteData, targetDate, evalOptions);
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
    if (matches && noteData.conditions?.length > 0) if (!evaluateConditions(noteData.conditions, targetDate, { startDate })) return false;
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
    if (matches && noteData.conditions?.length > 0) if (!evaluateConditions(noteData.conditions, targetDate, { startDate })) return false;
    return matches;
  }
  if (moonConditions?.length > 0) if (!matchesMoonConditions(moonConditions, targetDate)) return false;
  if (repeat === 'never' || !repeat) {
    if (!isSameDay(startDate, targetDate)) return false;
    if (noteData.conditions?.length > 0) if (!evaluateConditions(noteData.conditions, targetDate, { startDate })) return false;
    return true;
  }
  if (compareDays(targetDate, startDate) < 0) return false;
  if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;
  const duration = getEffectiveDuration(noteData);
  if (duration > 0 && !noteData.hasDuration && endDate && compareDays(targetDate, endDate) <= 0) return true;
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
      if (noteData.conditions?.length > 0 && !evaluateConditions(noteData.conditions, targetDate, { startDate })) return false;
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
  if (matches && noteData.conditions?.length > 0) if (!evaluateConditions(noteData.conditions, targetDate, { startDate })) return false;
  return matches;
}

/**
 * Count occurrences from start date up to and including target date.
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
 * @param {object[]} moonConditions  Array of moon condition objects
 * @param {object} targetDate  Date to check
 * @returns {boolean}  True if any moon condition matches
 */
function matchesMoonConditions(moonConditions, targetDate) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar?.moonsArray?.length) return false;
  const yearZero = calendar.years?.yearZero ?? 0;
  const components = { year: targetDate.year - yearZero, month: targetDate.month, dayOfMonth: targetDate.dayOfMonth, hour: 12, minute: 0, second: 0 };
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
 * Evaluate an EVENT condition against a target date.
 * @param {object} condition - { field, op, value, value2: { noteId, inclusive? } }
 * @param {object} date - Target date to evaluate
 * @param {object} [options] - Evaluation options
 * @param {Set<string>} [options._evaluatingNotes] - Circular dependency guard
 * @returns {boolean} True if the event condition is satisfied
 */
function evaluateEventCondition(condition, date, options = {}) {
  const { op, value, value2 } = condition;
  const noteId = typeof value2 === 'string' ? value2 : value2?.noteId;
  if (!noteId) return false;
  const evaluating = options._evaluatingNotes ?? new Set();
  if (evaluating.has(noteId)) return false;
  const linkedNote = NoteManager.getNote(noteId);
  if (!linkedNote?.flagData) return false;
  const childEvaluating = new Set(evaluating);
  childEvaluating.add(noteId);
  const childNoteData = { ...linkedNote.flagData, linkedEvent: null };
  const inclusive = value2?.inclusive !== false;
  const n = value ?? 0;
  switch (op) {
    case CONDITION_OPERATORS.DAYS_AGO: {
      const checkDate = addDays(date, -n);
      return isRecurringMatch(childNoteData, checkDate, { _evaluatingNotes: childEvaluating });
    }
    case CONDITION_OPERATORS.DAYS_FROM_NOW: {
      const checkDate = addDays(date, n);
      return isRecurringMatch(childNoteData, checkDate, { _evaluatingNotes: childEvaluating });
    }
    case CONDITION_OPERATORS.WITHIN_LAST: {
      const rangeEnd = inclusive ? { ...date } : addDays(date, -1);
      const rangeStart = addDays(date, -n);
      return getOccurrencesInRange(childNoteData, rangeStart, rangeEnd, 1).length > 0;
    }
    case CONDITION_OPERATORS.WITHIN_NEXT: {
      const rangeStart = inclusive ? { ...date } : addDays(date, 1);
      const rangeEnd = addDays(date, n);
      return getOccurrencesInRange(childNoteData, rangeStart, rangeEnd, 1).length > 0;
    }
    default:
      return false;
  }
}
/** @type {boolean} One-time init guard preventing duplicate field handler registration. */
let _fieldHandlersRegistered = false;

/** Ensure custom field handlers (EVENT, COMPUTED) are registered with the condition engine. */
export function ensureFieldHandlersRegistered() {
  if (_fieldHandlersRegistered) return;
  _fieldHandlersRegistered = true;
  registerFieldHandler(CONDITION_FIELDS.EVENT, evaluateEventCondition);
  registerFieldHandler(CONDITION_FIELDS.COMPUTED, evaluateComputedCondition);
}

/**
 * Field handler for COMPUTED conditions. Resolves a computed date and checks if it matches.
 * @param {object} condition - { field, op, value, value2: computedConfig }
 * @param {object} date - Date to evaluate
 * @returns {boolean} True if computed date matches
 */
function evaluateComputedCondition(condition, date) {
  const config = condition.value2;
  if (!config?.chain?.length) return false;
  const resolved = resolveComputedDate(config, date.year);
  if (!resolved) return false;
  return isSameDay(resolved, date);
}

/**
 * Check if target date matches a linked event occurrence.
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
    if (startDate.dayOfMonth !== targetDate.dayOfMonth) return false;
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
  const effectiveStartDay = Math.min(startDate.dayOfMonth, targetMonthLastDay - 1);
  return targetDate.dayOfMonth === effectiveStartDay;
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
  const effectiveStartDay = Math.min(startDate.dayOfMonth, targetMonthLastDay - 1);
  return targetDate.dayOfMonth === effectiveStartDay;
}

/**
 * Check if note matches week-of-month recurrence pattern.
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
  if (targetWeekNumber == null) targetWeekNumber = Math.ceil((startDate.dayOfMonth + 1) / daysInWeek);
  const currentWeekday = dayOfWeek(targetDate);
  if (currentWeekday !== targetWeekday) return false;
  const monthsDiff = monthsBetween(startDate, targetDate);
  if (monthsDiff < 0 || monthsDiff % interval !== 0) return false;
  const targetDayWeekNumber = getWeekNumberInMonth(targetDate, daysInWeek);
  if (targetWeekNumber > 0) return targetDayWeekNumber === targetWeekNumber;
  else return getInverseWeekNumberInMonth(targetDate, daysInWeek) === Math.abs(targetWeekNumber);
}

/**
 * Calculate which occurrence of the weekday this day is in the month.
 * @param {object} date - Date to check
 * @param {number} daysInWeek - Days per week in this calendar
 * @returns {number} Week ordinal (1-5)
 */
function getWeekNumberInMonth(date, daysInWeek) {
  return Math.ceil((date.dayOfMonth + 1) / daysInWeek);
}

/**
 * Calculate the inverse week number (from end of month).
 * @param {object} date - Date to check
 * @param {number} daysInWeek - Days per week in this calendar
 * @returns {number} Inverse week ordinal (1 = last, 2 = second-to-last, etc.)
 */
function getInverseWeekNumberInMonth(date, daysInWeek) {
  const lastDayOfMonth = getLastDayOfMonth(date);
  const daysUntilEndOfMonth = lastDayOfMonth - (date.dayOfMonth + 1);
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
 * Find the day number for an ordinal weekday occurrence in a month.
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
  for (let day = 0; day < daysInMonth; day++) {
    const date = { year, month, dayOfMonth: day };
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
 * @param {object} pattern - Range pattern { year, month, day }
 * @param {object} targetDate - Date to check
 * @param {object} startDate - Note start date (filter: don't match before this)
 * @param {object} [repeatEndDate] - Note repeat end date (filter: don't match after this)
 * @returns {boolean} True if matches
 */
function matchesRangePattern(pattern, targetDate, startDate, repeatEndDate) {
  const { year, month, dayOfMonth } = pattern;
  if (compareDays(targetDate, startDate) < 0) return false;
  if (repeatEndDate && compareDays(targetDate, repeatEndDate) > 0) return false;
  if (!matchesRangeBit(year, targetDate.year)) return false;
  if (!matchesRangeBit(month, targetDate.month)) return false;
  if (!matchesRangeBit(dayOfMonth, targetDate.dayOfMonth + 1)) return false;
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
  ensureFieldHandlersRegistered();
  const occurrences = [];
  const { startDate, repeat, repeatInterval, linkedEvent, repeatEndDate, limitedRepeat, limitedRepeatDays } = noteData;
  if (limitedRepeat && limitedRepeatDays > 0) {
    const earliest = addDays(rangeEnd, -limitedRepeatDays);
    if (compareDays(earliest, rangeStart) > 0) rangeStart = earliest;
  }
  if (linkedEvent?.noteId) return getLinkedEventOccurrences(linkedEvent, rangeStart, rangeEnd, startDate, repeatEndDate, maxOccurrences);
  if (noteData.conditionTree?.type) return getOccurrencesInRangeForTree(noteData, rangeStart, rangeEnd, maxOccurrences);
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
    const weekNumber = noteData.weekNumber ?? Math.ceil((startDate.dayOfMonth + 1) / daysInWeek);
    let currentMonth = compareDays(startDate, rangeStart) >= 0 ? { year: startDate.year, month: startDate.month } : { year: rangeStart.year, month: rangeStart.month };
    let iterations = 0;
    const maxIterations = 1000;
    while (iterations < maxIterations) {
      const matchingDay = findWeekdayInMonth(currentMonth.year, currentMonth.month, targetWeekday, weekNumber);
      if (matchingDay) {
        const date = { year: currentMonth.year, month: currentMonth.month, dayOfMonth: matchingDay };
        if (compareDays(date, rangeEnd) > 0) break; // Past end of range
        if (compareDays(date, rangeStart) >= 0 && compareDays(date, startDate) >= 0) {
          if (!noteData.repeatEndDate || compareDays(date, noteData.repeatEndDate) <= 0) {
            occurrences.push(date);
            if (occurrences.length >= maxOccurrences) break;
          }
        }
      }
      currentMonth = addMonths({ ...currentMonth, dayOfMonth: 0 }, interval);
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
  const formatDate = (d) => `${d.month + 1}/${d.dayOfMonth + 1}/${d.year}`;
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
  if (repeat === 'never' || !repeat) {
    const tree = noteData.conditionTree;
    if (tree && (tree.children?.length || (tree.type === 'condition' && tree.field))) return localize('CALENDARIA.Recurrence.Conditional');
    return localize('CALENDARIA.Recurrence.DoesNotRepeat');
  }
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
  const yearEnd = { year: targetYear, month: lastMonthIndex, dayOfMonth: lastMonthDays - 1 };
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
        occurrences.push({ year: currentDate.year, month: currentDate.month, dayOfMonth: currentDate.dayOfMonth });
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
  const currentDay = components.dayOfMonth ?? 0;
  const lastMonthIndex = calendar.monthsArray.length - 1;
  const lastMonthDays = calendar.monthsArray[lastMonthIndex]?.days || 30;
  const daysInWeek = calendar?.daysInWeek ?? 7;
  if (cachedData.year < currentYear) return true;
  if (currentMonth === lastMonthIndex && currentDay > lastMonthDays - daysInWeek - 1) return cachedData.year <= currentYear;
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
  return cachedOccurrences.some((occ) => occ.year === targetDate.year && occ.month === targetDate.month && occ.dayOfMonth === targetDate.dayOfMonth);
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
  const { year, month, dayOfMonth } = pattern;
  const yearDesc = describeRangeBit(year, 'year');
  const monthDesc = describeRangeBit(month, 'month');
  const dayDesc = describeRangeBit(dayOfMonth, 'day');
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
