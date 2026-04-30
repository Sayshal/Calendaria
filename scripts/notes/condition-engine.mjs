import { CalendarManager } from '../calendar/_module.mjs';
import { CONDITION_FIELDS, CONDITION_GROUP_MODES, CONDITION_OPERATORS, MAX_NESTING_DEPTH } from '../constants.mjs';
import {
  checkSolsticeOrEquinox,
  getCalendarMoonPhaseIndex,
  getCycleValue,
  getDayOfYear,
  getEclipseAtDate,
  getEclipseOnDate,
  getEraIndex,
  getEraYear,
  getLastDayOfMonth,
  getMoonPhaseCountInMonth,
  getMoonPhaseCountInYear,
  getMoonPhaseCountSinceEpoch,
  getSeasonDay,
  getSeasonIndex,
  getSeasonPercent,
  getTotalDaysInYear,
  getTotalDaysSinceEpoch,
  isLunarEclipse,
  isSolarEclipse,
  seededRandom
} from '../utils/_module.mjs';
import { WeatherManager } from '../weather/_module.mjs';
import { dayOfWeek } from './_module.mjs';

/**
 * Registry for custom field handlers that bypass the standard getFieldValue path.
 * @type {Map<string, Function>}
 */
const fieldHandlers = new Map();

/**
 * Register a custom field handler for condition evaluation.
 * @param {string} field - Condition field identifier (CONDITION_FIELDS value)
 * @param {Function} handler - (condition, date, options) => boolean
 */
export function registerFieldHandler(field, handler) {
  fieldHandlers.set(field, handler);
}

/**
 * Build an epoch context for a date, caching expensive computations.
 * @param {object} date - Date with year, month, dayOfMonth
 * @returns {object} Epoch context with lazily-computed cached values
 */
export function createEpochContext(date) {
  const context = { date, _cache: {} };

  /**
   * Get a cached value, computing it on first access.
   * @param {string} key - Cache key
   * @param {Function} compute - Computation function
   * @returns {*} Cached or freshly computed value
   */
  context.get = function (key, compute) {
    if (!(key in this._cache)) this._cache[key] = compute();
    return this._cache[key];
  };
  return context;
}

/**
 * Get the sub-phase of a moon (rising/true/fading) as 1/2/3.
 * @param {object} date - Date to check
 * @param {number} moonIndex - Index of the moon
 * @returns {number|null} 1=rising, 2=true, 3=fading, or null
 */
export function getMoonSubPhase(date, moonIndex) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const moons = calendar.moonsArray ?? [];
  if (moonIndex >= moons.length) return null;
  const yearZero = calendar.years?.yearZero ?? 0;
  const components = { year: date.year - yearZero, month: date.month, dayOfMonth: date.dayOfMonth, hour: 12, minute: 0, second: 0 };
  const moonPhaseInfo = calendar.getMoonPhase(moonIndex, components);
  if (!moonPhaseInfo || moonPhaseInfo.dayWithinPhase == null || moonPhaseInfo.phaseDuration == null) return null;
  const { dayWithinPhase, phaseDuration } = moonPhaseInfo;
  const third = phaseDuration / 3;
  if (dayWithinPhase < third) return 1;
  if (dayWithinPhase < phaseDuration - third) return 2;
  return 3;
}

/**
 * Convert a date to total-days integer for comparison.
 * @param {object} dateValue - { year, month, dayOfMonth }
 * @returns {number} Total days since epoch
 */
function dateToTotalDays(dateValue) {
  return getTotalDaysSinceEpoch({ year: dateValue.year ?? 0, month: dateValue.month ?? 0, dayOfMonth: dateValue.dayOfMonth ?? 0 });
}

/**
 * Get the value of a condition field for a given date.
 * The `value2` parameter is a polymorphic secondary value whose type is determined by the `field`:
 *
 * | Field group                  | value2 type     | Meaning                                    |
 * |------------------------------|-----------------|--------------------------------------------|
 * | MOON_PHASE, MOON_PHASE_INDEX,|                 |                                            |
 * | MOON_PHASE_COUNT_*, MOON_SUB | `number`        | Moon array index (0-based)                 |
 * | CYCLE                        | `number`        | Cycle array index (0-based)                |
 * | RANDOM                       | `number`        | Deterministic seed for seededRandom()      |
 * | WEATHER                      | `string\|undef` | Weather zone ID (omit for default zone)    |
 * | EVENT                        | `object\|string`| `{noteId, inclusive?}` or legacy noteId    |
 * | COMPUTED                     | `object`        | `{chain: [...]}` resolution config         |
 * | All others                   | `null`          | Not used                                   |
 * @param {string} field - Field name (CONDITION_FIELDS value)
 * @param {object} date - Date to evaluate { year, month, dayOfMonth }
 * @param {number|string|object|null} [value2] - Secondary context value (see table above)
 * @param {object} [epochCtx] - Epoch context from createEpochContext()
 * @returns {number|boolean|string|null} Field value
 */
export function getFieldValue(field, date, value2 = null, epochCtx = null) {
  const calendar = CalendarManager.getActiveCalendar();
  const cache = epochCtx ? (key, fn) => epochCtx.get(key, fn) : (_key, fn) => fn();
  switch (field) {
    case CONDITION_FIELDS.YEAR:
      return date.year;
    case CONDITION_FIELDS.MONTH:
      return date.month + 1;
    case CONDITION_FIELDS.DAY:
      return date.dayOfMonth + 1;
    case CONDITION_FIELDS.DAY_OF_YEAR:
      return cache('dayOfYear', () => getDayOfYear(date)) + 1;
    case CONDITION_FIELDS.DAYS_BEFORE_MONTH_END: {
      const lastDay = cache('lastDayOfMonth', () => getLastDayOfMonth(date));
      return lastDay - (date.dayOfMonth + 1);
    }
    case CONDITION_FIELDS.WEEKDAY:
      return cache('weekday', () => dayOfWeek(date) + 1);
    case CONDITION_FIELDS.WEEK_NUMBER_IN_MONTH: {
      const diw = calendar?.daysInWeek ?? 7;
      return Math.ceil((date.dayOfMonth + 1) / diw);
    }
    case CONDITION_FIELDS.INVERSE_WEEK_NUMBER: {
      const diw = calendar?.daysInWeek ?? 7;
      const lastDay = cache('lastDayOfMonth', () => getLastDayOfMonth(date));
      return Math.floor((lastDay - (date.dayOfMonth + 1)) / diw) + 1;
    }
    case CONDITION_FIELDS.WEEK_IN_MONTH: {
      const diw = calendar?.daysInWeek ?? 7;
      return Math.ceil((date.dayOfMonth + 1) / diw);
    }
    case CONDITION_FIELDS.WEEK_IN_YEAR: {
      const diw = calendar?.daysInWeek ?? 7;
      const doy = cache('dayOfYear', () => getDayOfYear(date));
      return Math.ceil((doy + 1) / diw);
    }
    case CONDITION_FIELDS.TOTAL_WEEK: {
      const diw = calendar?.daysInWeek ?? 7;
      const totalDays = cache('totalDays', () => getTotalDaysSinceEpoch(date));
      return Math.floor(totalDays / diw);
    }
    case CONDITION_FIELDS.WEEKS_BEFORE_MONTH_END: {
      const diw = calendar?.daysInWeek ?? 7;
      const lastDay = cache('lastDayOfMonth', () => getLastDayOfMonth(date));
      return Math.floor((lastDay - (date.dayOfMonth + 1)) / diw);
    }
    case CONDITION_FIELDS.WEEKS_BEFORE_YEAR_END: {
      const diw = calendar?.daysInWeek ?? 7;
      const totalDaysInYear = cache('totalDaysInYear', () => getTotalDaysInYear(date.year));
      const doy = cache('dayOfYear', () => getDayOfYear(date));
      return Math.floor((totalDaysInYear - doy) / diw);
    }
    case CONDITION_FIELDS.SEASON: {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return null;
      const doy = cache('dayOfYear', () => getDayOfYear(date));
      const idx = cache('seasonIndex', () => getSeasonIndex(doy, seasons, date));
      return idx >= 0 ? idx + 1 : null;
    }
    case CONDITION_FIELDS.SEASON_PERCENT: {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return null;
      const doy = cache('dayOfYear', () => getDayOfYear(date));
      const idx = cache('seasonIndex', () => getSeasonIndex(doy, seasons, date));
      if (idx < 0) return null;
      return getSeasonPercent(
        doy,
        seasons,
        cache('totalDaysInYear', () => getTotalDaysInYear(date.year)),
        idx
      );
    }
    case CONDITION_FIELDS.SEASON_DAY: {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return null;
      const doy = cache('dayOfYear', () => getDayOfYear(date));
      const idx = cache('seasonIndex', () => getSeasonIndex(doy, seasons, date));
      if (idx < 0) return null;
      return getSeasonDay(
        doy,
        seasons,
        cache('totalDaysInYear', () => getTotalDaysInYear(date.year)),
        idx
      );
    }
    case CONDITION_FIELDS.IS_LONGEST_DAY: {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'longest');
    }
    case CONDITION_FIELDS.IS_SHORTEST_DAY: {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'shortest');
    }
    case CONDITION_FIELDS.IS_SPRING_EQUINOX: {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'spring');
    }
    case CONDITION_FIELDS.IS_AUTUMN_EQUINOX: {
      const seasons = calendar?.seasonsArray ?? [];
      if (!seasons.length) return false;
      return checkSolsticeOrEquinox(date, seasons, 'autumn');
    }
    case CONDITION_FIELDS.MOON_PHASE: {
      const moons = calendar?.moonsArray ?? [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      const yearZero = calendar.years?.yearZero ?? 0;
      const components = { year: date.year - yearZero, month: date.month, dayOfMonth: date.dayOfMonth, hour: 12, minute: 0, second: 0 };
      const moonPhaseInfo = calendar.getMoonPhase(moonIndex, components);
      return moonPhaseInfo?.position ?? null;
    }
    case CONDITION_FIELDS.MOON_PHASE_INDEX: {
      const moons = calendar?.moonsArray ?? [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      return getCalendarMoonPhaseIndex(date, moonIndex);
    }
    case CONDITION_FIELDS.MOON_PHASE_COUNT_MONTH: {
      const moons = calendar?.moonsArray ?? [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      return getMoonPhaseCountInMonth(date, moonIndex);
    }
    case CONDITION_FIELDS.MOON_PHASE_COUNT_YEAR: {
      const moons = calendar?.moonsArray ?? [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      return getMoonPhaseCountInYear(date, moonIndex);
    }
    case CONDITION_FIELDS.MOON_PHASE_COUNT_EPOCH: {
      const moons = calendar?.moonsArray ?? [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      return getMoonPhaseCountSinceEpoch(date, moonIndex);
    }
    case CONDITION_FIELDS.CYCLE: {
      const cycles = calendar?.cyclesArray ?? [];
      const cycleIndex = value2 ?? 0;
      if (cycleIndex >= cycles.length) return null;
      return getCycleValue(date, cycles[cycleIndex]);
    }
    case CONDITION_FIELDS.ERA: {
      const eras = calendar?.erasArray ?? [];
      if (!eras.length) return null;
      return getEraIndex(date.year, eras) + 1;
    }
    case CONDITION_FIELDS.ERA_YEAR: {
      const eras = calendar?.erasArray ?? [];
      if (!eras.length) return date.year;
      return getEraYear(date.year, eras);
    }
    case CONDITION_FIELDS.INTERCALARY: {
      const months = calendar?.monthsArray ?? [];
      const monthData = months[date.month];
      return monthData?.type === 'intercalary';
    }
    case CONDITION_FIELDS.DATE: {
      return cache('totalDays', () => getTotalDaysSinceEpoch(date));
    }
    case CONDITION_FIELDS.EPOCH:
      return cache('totalDays', () => getTotalDaysSinceEpoch(date));
    case CONDITION_FIELDS.WEATHER: {
      const zoneId = value2 ?? undefined;
      const yz = calendar?.years?.yearZero ?? 0;
      const historical = WeatherManager.getWeatherForDate(date.year - yz, date.month, date.dayOfMonth, zoneId);
      if (historical) return historical.id ?? null;
      const weather = WeatherManager.getCurrentWeather(zoneId);
      return weather?.id ?? null;
    }
    case CONDITION_FIELDS.MOON_SUB_PHASE:
      return getMoonSubPhase(date, value2 ?? 0);
    case CONDITION_FIELDS.RANDOM: {
      const doy = cache('dayOfYear', () => getDayOfYear(date));
      return seededRandom(value2 ?? 0, date.year, doy);
    }
    case CONDITION_FIELDS.IS_LEAP_YEAR: {
      if (!calendar) return false;
      const yearZero = calendar.years?.yearZero ?? 0;
      return calendar.isLeapYear(date.year - yearZero);
    }
    case CONDITION_FIELDS.ECLIPSE: {
      const moons = calendar?.moonsArray ?? [];
      const moonIndex = value2 ?? 0;
      if (moonIndex >= moons.length) return null;
      const result = getEclipseAtDate(moons[moonIndex], date, calendar);
      return result.type ?? null;
    }
    case CONDITION_FIELDS.IS_ECLIPSE: {
      const moons = calendar?.moonsArray ?? [];
      if (!moons.length) return false;
      return getEclipseOnDate(moons, date, calendar) !== null;
    }
    case CONDITION_FIELDS.IS_SOLAR_ECLIPSE: {
      const moons = calendar?.moonsArray ?? [];
      if (!moons.length) return false;
      const result = getEclipseOnDate(moons, date, calendar);
      return result !== null && isSolarEclipse(result.type);
    }
    case CONDITION_FIELDS.IS_LUNAR_ECLIPSE: {
      const moons = calendar?.moonsArray ?? [];
      if (!moons.length) return false;
      const result = getEclipseOnDate(moons, date, calendar);
      return result !== null && isLunarEclipse(result.type);
    }
    default:
      return null;
  }
}

/**
 * Evaluate a single condition against a date.
 * @param {object} condition - { field, op, value, value2?, offset? }
 * @param {object} date - Date to evaluate
 * @param {object} [options] - Evaluation options
 * @param {object} [options.startDate] - Note start date for modulo offset
 * @param {object} [options.epochCtx] - Epoch context for caching
 * @returns {boolean} True if condition passes
 */
export function evaluateCondition(condition, date, options = {}) {
  const { field, op, value, value2 } = condition;
  const { startDate, epochCtx } = options;
  const handler = fieldHandlers.get(field);
  if (handler) return handler(condition, date, options);
  const fieldValue = getFieldValue(field, date, value2, epochCtx);
  if (fieldValue === null || fieldValue === undefined) return false;
  let compareValue = value;
  if (field === CONDITION_FIELDS.DATE && typeof value === 'object' && value !== null) compareValue = dateToTotalDays(value);
  switch (op) {
    case CONDITION_OPERATORS.EQUAL:
      return fieldValue === compareValue;
    case CONDITION_OPERATORS.NOT_EQUAL:
      return fieldValue !== compareValue;
    case CONDITION_OPERATORS.GREATER_EQUAL:
      return fieldValue >= compareValue;
    case CONDITION_OPERATORS.LESS_EQUAL:
      return fieldValue <= compareValue;
    case CONDITION_OPERATORS.GREATER:
      return fieldValue > compareValue;
    case CONDITION_OPERATORS.LESS:
      return fieldValue < compareValue;
    case CONDITION_OPERATORS.MODULO: {
      if (compareValue === 0) return false;
      const effectiveOffset = startDate ? (getFieldValue(field, startDate, value2) ?? 0) : 0;
      return (fieldValue - effectiveOffset) % compareValue === 0;
    }
    default:
      return false;
  }
}

/**
 * Check if an entry is a condition group (vs a flat condition).
 * @param {object} entry - Condition or group object
 * @returns {boolean} True if entry is a group
 */
export function isGroup(entry) {
  return entry?.type === 'group';
}

/**
 * Create a condition group object.
 * @param {string} mode - Boolean mode (CONDITION_GROUP_MODES value)
 * @param {object[]} children - Array of conditions and/or nested groups
 * @param {object} [options] - Additional options
 * @param {number} [options.threshold] - Required count for COUNT mode
 * @returns {object} Condition group object
 */
export function createGroup(mode, children = [], { threshold } = {}) {
  const group = { type: 'group', mode, children };
  if (mode === CONDITION_GROUP_MODES.COUNT) group.threshold = threshold ?? 1;
  return group;
}

/**
 * Validate a condition tree entry (condition or group) recursively.
 * @param {object} entry - Condition or group to validate
 * @param {number} [depth] - Current nesting depth
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateConditionTree(entry, depth = 0) {
  const errors = [];
  if (depth >= MAX_NESTING_DEPTH) {
    errors.push(`Maximum nesting depth of ${MAX_NESTING_DEPTH} exceeded`);
    return { valid: false, errors };
  }
  if (isGroup(entry)) {
    const validModes = Object.values(CONDITION_GROUP_MODES);
    if (!validModes.includes(entry.mode)) errors.push(`Invalid group mode: ${entry.mode}`);
    if (!Array.isArray(entry.children)) {
      errors.push('Group children must be an array');
    } else {
      for (let i = 0; i < entry.children.length; i++) {
        const childResult = validateConditionTree(entry.children[i], depth + 1);
        if (!childResult.valid) errors.push(...childResult.errors.map((e) => `children[${i}]: ${e}`));
      }
    }
    if (entry.mode === CONDITION_GROUP_MODES.COUNT) if (typeof entry.threshold !== 'number' || entry.threshold < 1) errors.push('COUNT mode requires a threshold >= 1');
  } else {
    if (!entry?.field) errors.push('Condition missing required field');
    if (!entry?.op) errors.push('Condition missing required operator');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate an entire conditions array (the root-level array from note data).
 * @param {Array} conditions - Root conditions array (mixed conditions and groups)
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateConditions(conditions) {
  if (!Array.isArray(conditions)) return { valid: false, errors: ['Conditions must be an array'] };
  const errors = [];
  for (let i = 0; i < conditions.length; i++) {
    const result = validateConditionTree(conditions[i], 0);
    if (!result.valid) errors.push(...result.errors.map((e) => `[${i}]: ${e}`));
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Evaluate a single entry (condition or group) against a date.
 * @param {object} entry - Condition or group object
 * @param {object} date - Date to evaluate
 * @param {object} [options] - Evaluation options
 * @param {object} [options.startDate] - Note start date for modulo offset
 * @param {object} [options.epochCtx] - Epoch context for caching
 * @param {number} [options._depth] - Internal depth counter for recursion safety
 * @returns {boolean} True if entry passes
 */
export function evaluateEntry(entry, date, options = {}) {
  if (isGroup(entry)) return evaluateGroup(entry, date, options);
  return evaluateCondition(entry, date, options);
}

/**
 * Evaluate a condition group against a date.
 * @param {object} group - { type: 'group', mode, children, threshold? }
 * @param {object} date - Date to evaluate
 * @param {object} [options] - Evaluation options
 * @param {object} [options.startDate] - Note start date for modulo offset
 * @param {object} [options.epochCtx] - Epoch context for caching
 * @param {number} [options._depth] - Internal depth counter
 * @returns {boolean} True if group passes
 */
export function evaluateGroup(group, date, options = {}) {
  const depth = options._depth ?? 0;
  if (depth >= MAX_NESTING_DEPTH) return false;
  const children = group.children;
  if (!children?.length) {
    const mode = group.mode;
    return mode === CONDITION_GROUP_MODES.AND || mode === CONDITION_GROUP_MODES.NAND;
  }
  const childOptions = { ...options, _depth: depth + 1 };
  switch (group.mode) {
    case CONDITION_GROUP_MODES.AND:
      for (const child of children) if (!evaluateEntry(child, date, childOptions)) return false;
      return true;
    case CONDITION_GROUP_MODES.OR:
      for (const child of children) if (evaluateEntry(child, date, childOptions)) return true;
      return false;
    case CONDITION_GROUP_MODES.NAND:
      for (const child of children) if (!evaluateEntry(child, date, childOptions)) return true;
      return false;
    case CONDITION_GROUP_MODES.XOR: {
      let trueCount = 0;
      for (const child of children) {
        if (evaluateEntry(child, date, childOptions)) trueCount++;
        if (trueCount > 1) return false;
      }
      return trueCount === 1;
    }
    case CONDITION_GROUP_MODES.COUNT: {
      const threshold = group.threshold ?? 1;
      let trueCount = 0;
      for (const child of children) {
        if (evaluateEntry(child, date, childOptions)) trueCount++;
        if (trueCount >= threshold) return true;
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a date.
 * @param {Array} conditions - Array of condition and/or group objects
 * @param {object} date - Date to evaluate
 * @param {object} [options] - Evaluation options
 * @param {object} [options.startDate] - Note start date for modulo offset
 * @param {object} [options.epochCtx] - Epoch context for caching (created automatically if not provided)
 * @returns {boolean} True if all entries pass (empty array returns true)
 */
export function evaluateConditions(conditions, date, options = {}) {
  if (!conditions?.length) return true;
  const epochCtx = options.epochCtx ?? createEpochContext(date);
  const evalOptions = { ...options, epochCtx, _depth: 0 };
  for (const entry of conditions) if (!evaluateEntry(entry, date, evalOptions)) return false;
  return true;
}

/**
 * Shared cache for epoch contexts, keyed by `year:month:dayOfMonth`.
 */
export class EpochDataCache {
  #cache = new Map();

  /**
   * Get or create an epoch context for a date.
   * @param {object} date - Date with year, month, dayOfMonth
   * @returns {object} Cached epoch context
   */
  getContext(date) {
    const key = `${date.year}:${date.month}:${date.dayOfMonth}`;
    if (!this.#cache.has(key)) this.#cache.set(key, createEpochContext(date));
    return this.#cache.get(key);
  }

  /** Clear all cached contexts. */
  clear() {
    this.#cache.clear();
  }

  /** @returns {number} Number of cached contexts */
  get size() {
    return this.#cache.size;
  }
}

/**
 * Quick-reject: check if a condition tree can possibly match any date in a range.
 * @param {object} tree - Condition tree (group or single condition)
 * @param {object} rangeStart - Range start date { year, month, dayOfMonth }
 * @param {object} rangeEnd - Range end date { year, month, dayOfMonth }
 * @returns {boolean} False if tree definitely cannot match; true if it might
 */
export function canConditionTreeMatchRange(tree, rangeStart, rangeEnd) {
  if (!tree) return true;
  if (isGroup(tree)) {
    if (tree.mode !== CONDITION_GROUP_MODES.AND) return true;
    const children = tree.children;
    if (!children?.length) return true;
    for (const child of children) {
      if (isGroup(child)) continue;
      if (!_canConditionMatchRange(child, rangeStart, rangeEnd)) return false;
    }
    return true;
  }
  return _canConditionMatchRange(tree, rangeStart, rangeEnd);
}

/**
 * Check if a single condition can possibly match within a range.
 * @param {object} cond - Single condition { field, op, value }
 * @param {object} rangeStart - Range start
 * @param {object} rangeEnd - Range end
 * @returns {boolean} False if condition definitely cannot match
 * @private
 */
function _canConditionMatchRange(cond, rangeStart, rangeEnd) {
  const { field, op, value } = cond;
  if (field === CONDITION_FIELDS.YEAR) {
    if (op === CONDITION_OPERATORS.EQUAL && (value < rangeStart.year || value > rangeEnd.year)) return false;
    if (op === CONDITION_OPERATORS.GREATER_EQUAL && rangeEnd.year < value) return false;
    if (op === CONDITION_OPERATORS.GREATER && rangeEnd.year <= value) return false;
    if (op === CONDITION_OPERATORS.LESS_EQUAL && rangeStart.year > value) return false;
    if (op === CONDITION_OPERATORS.LESS && rangeStart.year >= value) return false;
  }
  if (field === CONDITION_FIELDS.MONTH) {
    if (op === CONDITION_OPERATORS.EQUAL) {
      const monthIdx = value - 1;
      if (rangeStart.year === rangeEnd.year && (monthIdx < rangeStart.month || monthIdx > rangeEnd.month)) return false;
    }
  }
  if (field === CONDITION_FIELDS.DATE || field === CONDITION_FIELDS.EPOCH) {
    const targetDays = typeof value === 'object' && value !== null ? dateToTotalDays(value) : typeof value === 'number' ? value : null;
    if (targetDays !== null) {
      const startDays = dateToTotalDays(rangeStart);
      const endDays = dateToTotalDays(rangeEnd);
      if (op === CONDITION_OPERATORS.EQUAL && (targetDays < startDays || targetDays > endDays)) return false;
      if (op === CONDITION_OPERATORS.GREATER_EQUAL && endDays < targetDays) return false;
      if (op === CONDITION_OPERATORS.GREATER && endDays <= targetDays) return false;
      if (op === CONDITION_OPERATORS.LESS_EQUAL && startDays > targetDays) return false;
      if (op === CONDITION_OPERATORS.LESS && startDays >= targetDays) return false;
    }
  }
  return true;
}

/**
 * Get a conservative max-days-in-year estimate from the active calendar.
 * @returns {number} Maximum days in a year
 */
function getMaxDaysInYear() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return 366;
  const yearZero = calendar.years?.yearZero ?? 0;
  const current = calendar.getDaysInYear?.(0 - yearZero) ?? 366;
  const next = calendar.getDaysInYear?.(1 - yearZero) ?? 366;
  return Math.max(current, next, 1);
}

/**
 * Estimate the maximum gap (in days) between occurrences from tree analysis.
 * @param {object} tree - Condition tree (group or single condition)
 * @returns {number} Estimated max gap in days (defaults to calendar year length)
 */
export function getSearchDistanceFromTree(tree) {
  const estimates = [];
  _collectGapEstimates(tree, estimates);
  if (!estimates.length) return getMaxDaysInYear();
  return Math.min(...estimates);
}

/**
 * Recursively collect gap estimates from a condition tree.
 * @param {object} entry - Condition or group
 * @param {number[]} estimates - Accumulator array
 * @private
 */
function _collectGapEstimates(entry, estimates) {
  if (!entry) return;
  if (isGroup(entry)) {
    if (!entry.children?.length) return;
    if (entry.mode === CONDITION_GROUP_MODES.AND) {
      for (const child of entry.children) _collectGapEstimates(child, estimates);
    } else {
      const childEstimates = [];
      for (const child of entry.children) {
        const sub = [];
        _collectGapEstimates(child, sub);
        if (sub.length) childEstimates.push(Math.min(...sub));
      }
      if (childEstimates.length) estimates.push(Math.max(...childEstimates));
    }
    return;
  }
  const { field, op, value } = entry;
  const yearGap = getMaxDaysInYear();
  if (field === CONDITION_FIELDS.EVENT) {
    estimates.push(yearGap);
    return;
  }
  if (op === CONDITION_OPERATORS.MODULO && (field === CONDITION_FIELDS.DAY || field === CONDITION_FIELDS.EPOCH) && value > 0) {
    estimates.push(value);
  } else if (op === CONDITION_OPERATORS.EQUAL) {
    if (field === CONDITION_FIELDS.WEEKDAY) estimates.push(7);
    else if (field === CONDITION_FIELDS.MONTH) estimates.push(yearGap);
    else if (field === CONDITION_FIELDS.DAY) estimates.push(31);
    else if (field === CONDITION_FIELDS.DAY_OF_YEAR) estimates.push(yearGap);
    else if (field === CONDITION_FIELDS.EPOCH) estimates.push(1);
  } else if (op === CONDITION_OPERATORS.MODULO) {
    if (value > 0) estimates.push(value);
  }
}
