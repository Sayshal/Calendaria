/**
 * Recurring Event Logic
 * @module Notes/Utils/Recurrence
 * @author Tyler
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { CONDITION_FIELDS, CONDITION_OPERATORS } from '../constants.mjs';
import { getCalendarMoonPhaseIndex, getDayOfYear, getMidpoint, localize, log, seededRandom } from '../utils/_module.mjs';
import {
  EpochDataCache,
  NoteManager,
  addDays,
  addMonths,
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
  return isSameDay(noteData.startDate, targetDate);
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
 * Get all occurrences of a recurring note within a date range.
 * @param {object} noteData  Note flag data
 * @param {object} rangeStart  Start of range
 * @param {object} rangeEnd  End of range
 * @param {number} maxOccurrences  Maximum number of occurrences to return
 * @returns {object[]}  Array of date objects
 */
export function getOccurrencesInRange(noteData, rangeStart, rangeEnd, maxOccurrences = 100) {
  ensureFieldHandlersRegistered();
  const { startDate, limitedRepeat, limitedRepeatDays } = noteData;
  if (limitedRepeat && limitedRepeatDays > 0) {
    const earliest = addDays(rangeEnd, -limitedRepeatDays);
    if (compareDays(earliest, rangeStart) > 0) rangeStart = earliest;
  }
  if (noteData.conditionTree?.type) return getOccurrencesInRangeForTree(noteData, rangeStart, rangeEnd, maxOccurrences);
  const occurrences = [];
  const afterStart = compareDays(startDate, rangeStart) >= 0;
  const beforeEnd = compareDays(startDate, rangeEnd) <= 0;
  if (afterStart && beforeEnd) occurrences.push({ ...startDate });
  return occurrences;
}

/**
 * Get human-readable description of recurrence pattern.
 * @param {object} noteData  Note flag data
 * @returns {string}  Description like "Every 2 weeks"
 */
export function getRecurrenceDescription(noteData) {
  const tree = noteData.conditionTree;
  if (tree && (tree.children?.length || (tree.type === 'condition' && tree.field))) return localize('CALENDARIA.Recurrence.Conditional');
  return localize('CALENDARIA.Recurrence.DoesNotRepeat');
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
