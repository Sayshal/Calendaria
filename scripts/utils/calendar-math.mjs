/**
 * Shared calendar math helpers used by condition-engine and recurrence.
 * @module Utils/CalendarMath
 * @author Tyler
 */

import { CalendarManager } from '../calendar/_module.mjs';

/**
 * Deterministic seeded random number generator.
 * @param {number} seed - Random seed
 * @param {number} year - Year component
 * @param {number} dayOfYear - Day of year component
 * @returns {number} Pseudo-random value in [0, 99.99]
 */
export function seededRandom(seed, year, dayOfYear) {
  let hash = Math.abs(seed) || 1;
  hash = ((hash * 1103515245 + 12345) >>> 0) % 0x7fffffff;
  hash = ((hash + year * 31337) >>> 0) % 0x7fffffff;
  hash = ((hash * 1103515245 + dayOfYear * 7919) >>> 0) % 0x7fffffff;
  return (hash % 10000) / 100;
}

/**
 * Get day of year for a date (0-based).
 * @param {object} date - Date with year, month, dayOfMonth (0-based)
 * @returns {number} Day of year (0-based)
 */
export function getDayOfYear(date) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return date.dayOfMonth;
  const yearZero = calendar.years?.yearZero ?? 0;
  const internalYear = date.year - yearZero;
  let dayOfYear = 0;
  for (let m = 0; m < date.month; m++) dayOfYear += calendar.getDaysInMonth(m, internalYear);
  return dayOfYear + date.dayOfMonth;
}

/**
 * Get the last day number of a month (1-indexed).
 * @param {object} date - Date with year, month
 * @returns {number} Last day of month
 */
export function getLastDayOfMonth(date) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return 30;
  const yearZero = calendar.years?.yearZero ?? 0;
  return calendar.getDaysInMonth(date.month, date.year - yearZero);
}

/**
 * Get total days in a year.
 * @param {number} year - Display year
 * @returns {number} Total days
 */
export function getTotalDaysInYear(year) {
  const calendar = CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  return calendar.getDaysInYear(year - yearZero);
}

/**
 * Get total days since epoch for a date.
 * @param {object} date - Date with year, month, dayOfMonth
 * @returns {number} Total days
 */
export function getTotalDaysSinceEpoch(date) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return 0;
  const yearZero = calendar.years?.yearZero ?? 0;
  const components = { year: date.year - yearZero, month: date.month, dayOfMonth: date.dayOfMonth ?? 0, hour: 0, minute: 0, second: 0 };
  const time = calendar.componentsToTime(components);
  const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
  const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
  const secondsPerDay = hoursPerDay * minutesPerHour * secondsPerMinute;
  return Math.floor(time / secondsPerDay);
}

/**
 * Get season index for a given day-of-year.
 * @param {number} dayOfYear - Day of year (1-based)
 * @param {object[]} seasons - Seasons array
 * @param {object} [date] - Full date for month-based season resolution
 * @returns {number} Season index or -1
 */
export function getSeasonIndex(dayOfYear, seasons, date) {
  const calendar = CalendarManager.getActiveCalendar();
  if (calendar?.seasons?.type === 'periodic') {
    const yearZero = calendar.years?.yearZero ?? 0;
    const totalDays = calendar.getDaysInYear((date?.year ?? 0) - yearZero);
    for (let i = 0; i < seasons.length; i++) {
      const { dayStart, dayEnd } = calendar._calculatePeriodicSeasonBounds(i, totalDays);
      if (isInSeasonRange(dayOfYear, dayStart, dayEnd)) return i;
    }
    return -1;
  }
  for (let i = 0; i < seasons.length; i++) {
    const season = seasons[i];
    if (season.monthStart != null && season.monthEnd != null && date) {
      const currentMonth = date.month;
      const startDay = season.dayStart ?? 0;
      const months = calendar?.monthsArray ?? [];
      const endDay = season.dayEnd ?? (months[season.monthEnd]?.days ?? 30) - 1;
      if (season.monthStart === season.monthEnd) {
        if (currentMonth === season.monthStart && date.dayOfMonth >= startDay && date.dayOfMonth <= endDay) return i;
      } else if (season.monthStart < season.monthEnd) {
        if (currentMonth > season.monthStart && currentMonth < season.monthEnd) return i;
        if (currentMonth === season.monthStart && date.dayOfMonth >= startDay) return i;
        if (currentMonth === season.monthEnd && date.dayOfMonth <= endDay) return i;
      } else {
        if (currentMonth > season.monthStart || currentMonth < season.monthEnd) return i;
        if (currentMonth === season.monthStart && date.dayOfMonth >= startDay) return i;
        if (currentMonth === season.monthEnd && date.dayOfMonth <= endDay) return i;
      }
    } else {
      const start = season.dayStart ?? 0;
      const end = season.dayEnd ?? start;
      if (isInSeasonRange(dayOfYear, start, end)) return i;
    }
  }
  return -1;
}

/**
 * Check if dayOfYear falls within a season range (handles wrap-around).
 * @param {number} dayOfYear - Day of year
 * @param {number} start - Range start
 * @param {number} end - Range end
 * @returns {boolean} True if in range
 */
export function isInSeasonRange(dayOfYear, start, end) {
  if (start <= end) return dayOfYear >= start && dayOfYear <= end;
  return dayOfYear >= start || dayOfYear <= end;
}

/**
 * Get percentage progress through current season (0-100).
 * @param {number} dayOfYear - Day of year
 * @param {object[]} seasons - Seasons array
 * @param {number} totalDays - Total days in year
 * @param {number} idx - Season index
 * @returns {number} Percentage 0-100
 */
export function getSeasonPercent(dayOfYear, seasons, totalDays, idx) {
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
 * @param {number} idx - Season index
 * @returns {number} Day in season
 */
export function getSeasonDay(dayOfYear, seasons, totalDays, idx) {
  const season = seasons[idx];
  const start = season.dayStart ?? 0;
  if (dayOfYear >= start) return dayOfYear - start + 1;
  return totalDays - start + dayOfYear + 1;
}

/**
 * Check if date is a solstice or equinox.
 * @param {object} date - Date to check
 * @param {object[]} seasons - Seasons array
 * @param {string} type - 'longest', 'shortest', 'spring', 'autumn'
 * @returns {boolean} True if date matches the solstice or equinox
 */
export function checkSolsticeOrEquinox(date, seasons, type) {
  const totalDays = getTotalDaysInYear(date.year);
  const doy = getDayOfYear(date);
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
      return doy === getMidpoint(summer.dayStart ?? 0, summer.dayEnd ?? 0, totalDays);
    }
    case 'shortest': {
      if (winterIdx === -1) return false;
      const winter = seasons[winterIdx];
      return doy === getMidpoint(winter.dayStart ?? 0, winter.dayEnd ?? 0, totalDays);
    }
    case 'spring':
      if (springIdx === -1) return false;
      return doy === (seasons[springIdx].dayStart ?? 0);
    case 'autumn':
      if (autumnIdx === -1) return false;
      return doy === (seasons[autumnIdx].dayStart ?? 0);
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
export function getMidpoint(start, end, totalDays) {
  if (start <= end) return Math.floor((start + end) / 2);
  const length = totalDays - start + end + 1;
  const mid = Math.floor(length / 2);
  return (start + mid) % totalDays;
}

/**
 * Get moon phase index using the calendar's method.
 * @param {object} date - Date to check
 * @param {number} moonIndex - Index of the moon
 * @returns {number|null} Phase index or null
 */
export function getCalendarMoonPhaseIndex(date, moonIndex) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const yearZero = calendar.years?.yearZero ?? 0;
  const components = { year: date.year - yearZero, month: date.month, dayOfMonth: date.dayOfMonth, hour: 12, minute: 0, second: 0 };
  const moonPhaseInfo = calendar.getMoonPhase(moonIndex, components);
  return moonPhaseInfo?.phaseIndex ?? null;
}

/**
 * Count occurrences of current moon phase in the month up to date.
 * @param {object} date - Date to check
 * @param {number} moonIndex - Moon index
 * @returns {number} Count (1 = first occurrence)
 */
export function getMoonPhaseCountInMonth(date, moonIndex) {
  const currentPhaseIndex = getCalendarMoonPhaseIndex(date, moonIndex);
  if (currentPhaseIndex === null) return 0;
  let count = 0;
  let wasInPhase = false;
  for (let d = 0; d <= date.dayOfMonth; d++) {
    const phaseIndex = getCalendarMoonPhaseIndex({ ...date, dayOfMonth: d }, moonIndex);
    const isInPhase = phaseIndex === currentPhaseIndex;
    if (isInPhase && !wasInPhase) count++;
    wasInPhase = isInPhase;
  }
  return count;
}

/**
 * Count occurrences of current moon phase in the year up to date.
 * @param {object} date - Date to check
 * @param {number} moonIndex - Moon index
 * @returns {number} Count (1 = first occurrence)
 */
export function getMoonPhaseCountInYear(date, moonIndex) {
  const calendar = CalendarManager.getActiveCalendar();
  const currentPhaseIndex = getCalendarMoonPhaseIndex(date, moonIndex);
  if (currentPhaseIndex === null) return 0;
  const targetDayOfYear = getDayOfYear(date);
  let count = 0;
  let dayCounter = 0;
  let wasInPhase = false;
  const months = calendar?.monthsArray ?? [];
  for (let m = 0; m < months.length && dayCounter <= targetDayOfYear; m++) {
    const daysInMonth = months[m]?.days || 30;
    for (let d = 0; d < daysInMonth && dayCounter <= targetDayOfYear; d++) {
      dayCounter++;
      const phaseIndex = getCalendarMoonPhaseIndex({ year: date.year, month: m, dayOfMonth: d }, moonIndex);
      const isInPhase = phaseIndex === currentPhaseIndex;
      if (isInPhase && !wasInPhase) count++;
      wasInPhase = isInPhase;
    }
  }
  return count;
}

/**
 * Advance a date by one day using the calendar's month structure.
 * @param {object} date - Date {year, month, dayOfMonth}
 * @param {object[]} months - Calendar months array
 * @returns {object} New date advanced by one day
 */
function advanceByOneDay(date, months) {
  let { year, month, dayOfMonth } = date;
  dayOfMonth++;
  if (dayOfMonth >= (months[month]?.days || 30)) {
    dayOfMonth = 0;
    month++;
    if (month >= months.length) {
      month = 0;
      year++;
    }
  }
  return { year, month, dayOfMonth };
}

/**
 * Count occurrences of current moon phase since epoch using cycle-length optimization.
 * Splits total days into complete cycles (each contributing exactly 1 occurrence)
 * plus a remainder iterated day-by-day. O(cycleLength) regardless of epoch size.
 * For randomized moons, falls back to capped day-by-day iteration.
 * @param {object} date - Date to check
 * @param {number} moonIndex - Moon index
 * @returns {number} Count (1 = first occurrence)
 */
export function getMoonPhaseCountSinceEpoch(date, moonIndex) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return 0;
  const currentPhaseIndex = getCalendarMoonPhaseIndex(date, moonIndex);
  if (currentPhaseIndex === null) return 0;
  const moons = calendar.moonsArray ?? [];
  const moon = moons[moonIndex];
  if (!moon?.cycleLength || moon.cycleLength <= 0) return 0;
  const totalDays = getTotalDaysSinceEpoch(date);
  if (totalDays < 0) return 0;
  if (moon.phaseMode === 'randomized') {
    const maxIterations = Math.min(totalDays + 1, 50000);
    const yearZero = calendar.years?.yearZero ?? 0;
    const months = calendar.monthsArray ?? [];
    let cur = { year: yearZero, month: 0, dayOfMonth: 0 };
    let count = 0;
    let wasInPhase = false;
    for (let i = 0; i < maxIterations; i++) {
      const phase = getCalendarMoonPhaseIndex(cur, moonIndex);
      if (phase === currentPhaseIndex && !wasInPhase) count++;
      wasInPhase = phase === currentPhaseIndex;
      if (i < maxIterations - 1) cur = advanceByOneDay(cur, months);
    }
    return Math.max(count, 1);
  }
  const cycleLen = Math.ceil(moon.cycleLength);
  const numDays = totalDays + 1;
  const fullCycles = Math.floor(numDays / cycleLen);
  const remainder = numDays - fullCycles * cycleLen;
  let count = fullCycles;
  if (remainder > 0) {
    const yearZero = calendar.years?.yearZero ?? 0;
    const months = calendar.monthsArray ?? [];
    let cur = { year: yearZero, month: 0, dayOfMonth: 0 };
    let wasInPhase = false;
    for (let i = 0; i < remainder; i++) {
      const phase = getCalendarMoonPhaseIndex(cur, moonIndex);
      if (phase === currentPhaseIndex && !wasInPhase) count++;
      wasInPhase = phase === currentPhaseIndex;
      if (i < remainder - 1) cur = advanceByOneDay(cur, months);
    }
  }
  return Math.max(count, 1);
}

/**
 * Get cycle value for a date.
 * @param {object} date - Date to check
 * @param {object} cycle - Cycle configuration
 * @returns {number} Cycle entry index
 */
export function getCycleValue(date, cycle) {
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
      value = date.dayOfMonth + 1;
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
export function getEraIndex(year, eras) {
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
export function getEraYear(year, eras) {
  const idx = getEraIndex(year, eras);
  const era = eras[idx];
  if (!era) return year;
  return year - (era.startYear ?? 0) + 1;
}
