import { CalendarManager } from '../calendar/_module.mjs';
import { log } from '../utils/_module.mjs';

/**
 * Compare two date objects.
 * @param {object} date1  First date
 * @param {object} date2  Second date
 * @returns {number}  -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(date1, date2) {
  if (date1.year !== date2.year) return date1.year < date2.year ? -1 : 1;
  if (date1.month !== date2.month) return date1.month < date2.month ? -1 : 1;
  if (date1.dayOfMonth !== date2.dayOfMonth) return date1.dayOfMonth < date2.dayOfMonth ? -1 : 1;
  const hour1 = date1.hour ?? 0;
  const hour2 = date2.hour ?? 0;
  if (hour1 !== hour2) return hour1 < hour2 ? -1 : 1;
  const minute1 = date1.minute ?? 0;
  const minute2 = date2.minute ?? 0;
  if (minute1 !== minute2) return minute1 < minute2 ? -1 : 1;
  return 0;
}

/**
 * Check if two dates are the same day (ignoring time).
 * @param {object} date1  First date
 * @param {object} date2  Second date
 * @returns {boolean}  True if same day
 */
export function isSameDay(date1, date2) {
  return date1.year === date2.year && date1.month === date2.month && date1.dayOfMonth === date2.dayOfMonth;
}

/**
 * Compare two dates by day only (ignoring time).
 * @param {object} date1  First date
 * @param {object} date2  Second date
 * @returns {number}  -1 if date1 < date2, 0 if same day, 1 if date1 > date2
 */
export function compareDays(date1, date2) {
  if (date1.year !== date2.year) return date1.year < date2.year ? -1 : 1;
  if (date1.month !== date2.month) return date1.month < date2.month ? -1 : 1;
  if (date1.dayOfMonth !== date2.dayOfMonth) return date1.dayOfMonth < date2.dayOfMonth ? -1 : 1;
  return 0;
}

/**
 * Calculate days between two dates using calendar's time system.
 * @param {object} startDate  Start date
 * @param {object} endDate  End date
 * @returns {number}  Number of days (can be negative)
 */
export function daysBetween(startDate, endDate) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return 0;
  try {
    const yearZero = calendar.years?.yearZero ?? 0;
    const startInternalYear = startDate.year - yearZero;
    const endInternalYear = endDate.year - yearZero;
    const startComponents = { year: startInternalYear, month: startDate.month, dayOfMonth: startDate.dayOfMonth ?? 0, hour: 0, minute: 0, second: 0 };
    const endComponents = { year: endInternalYear, month: endDate.month, dayOfMonth: endDate.dayOfMonth ?? 0, hour: 0, minute: 0, second: 0 };
    const startTime = calendar.componentsToTime(startComponents);
    const endTime = calendar.componentsToTime(endComponents);
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
    const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
    const secondsPerDay = hoursPerDay * minutesPerHour * secondsPerMinute;
    return Math.floor((endTime - startTime) / secondsPerDay);
  } catch (error) {
    log(1, 'Error calculating days between dates:', error);
    return 0;
  }
}

/**
 * Calculate months between two dates.
 * @param {object} startDate  Start date
 * @param {object} endDate  End date
 * @returns {number}  Number of months (can be negative)
 */
export function monthsBetween(startDate, endDate) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return 0;
  const yearDiff = endDate.year - startDate.year;
  const monthDiff = endDate.month - startDate.month;
  const monthsPerYear = calendar.monthsArray?.length || 12;
  return yearDiff * monthsPerYear + monthDiff;
}

/**
 * Get day of week for a date (0 = first day of week).
 * @param {object} date  Date to check
 * @param {object} [cal]  Calendar to use (defaults to active calendar)
 * @returns {number}  Day of week index
 */
export function dayOfWeek(date, cal) {
  const calendar = cal || CalendarManager.getActiveCalendar();
  if (!calendar) return 0;
  try {
    const yearZero = calendar.years?.yearZero ?? 0;
    const components = { year: date.year - yearZero, month: date.month, dayOfMonth: date.dayOfMonth ?? 0 };
    return calendar._computeDayOfWeek(components);
  } catch (error) {
    log(1, 'Error calculating day of week:', error);
    return 0;
  }
}

/**
 * Add days to a date.
 * @param {object} date  Starting date
 * @param {number} days  Days to add (can be negative)
 * @returns {object}  New date object
 */
export function addDays(date, days) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return date;
  try {
    const yearZero = calendar.years?.yearZero ?? 0;
    const internalYear = date.year - yearZero;
    const components = { year: internalYear, month: date.month, dayOfMonth: date.dayOfMonth ?? 0, hour: date.hour ?? 0, minute: date.minute ?? 0, second: 0 };
    const time = calendar.componentsToTime(components);
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
    const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
    const secondsPerDay = hoursPerDay * minutesPerHour * secondsPerMinute;
    const newTime = time + days * secondsPerDay;
    const newComponents = calendar.timeToComponents(newTime);
    return { year: newComponents.year + yearZero, month: newComponents.month, dayOfMonth: newComponents.dayOfMonth, hour: newComponents.hour, minute: newComponents.minute };
  } catch (error) {
    log(1, 'Error adding days to date:', error);
    return date;
  }
}

/**
 * Add months to a date.
 * @param {object} date  Starting date
 * @param {number} months  Months to add (can be negative)
 * @returns {object}  New date object
 */
export function addMonths(date, months) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return date;
  const yearZero = calendar.years?.yearZero ?? 0;
  let newYear = date.year;
  let newMonth = date.month + months;
  const monthsPerYear = calendar.monthsArray?.length || 12;
  while (newMonth >= monthsPerYear) {
    newMonth -= monthsPerYear;
    newYear++;
  }
  while (newMonth < 0) {
    newMonth += monthsPerYear;
    newYear--;
  }
  const maxDays = calendar.getDaysInMonth(newMonth, newYear - yearZero);
  const newDayOfMonth = Math.min(date.dayOfMonth ?? 0, maxDays - 1);
  return { year: newYear, month: newMonth, dayOfMonth: newDayOfMonth, hour: date.hour, minute: date.minute };
}

/**
 * Add years to a date.
 * @param {object} date  Starting date
 * @param {number} years  Years to add (can be negative)
 * @returns {object}  New date object
 */
export function addYears(date, years) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return date;
  const yearZero = calendar.years?.yearZero ?? 0;
  const newYear = date.year + years;
  const maxDays = calendar.getDaysInMonth(date.month, newYear - yearZero);
  const newDayOfMonth = Math.min(date.dayOfMonth ?? 0, maxDays - 1);
  return { year: newYear, month: date.month, dayOfMonth: newDayOfMonth, hour: date.hour, minute: date.minute };
}

/**
 * Get the calendar's time unit sizes in seconds.
 * @returns {{secondsPerMinute: number, secondsPerHour: number, secondsPerDay: number}} Time unit sizes
 */
function getTimeUnits() {
  const calendar = CalendarManager.getActiveCalendar();
  const secondsPerMinute = calendar?.days?.secondsPerMinute ?? 60;
  const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const secondsPerHour = minutesPerHour * secondsPerMinute;
  const secondsPerDay = hoursPerDay * secondsPerHour;
  return { secondsPerMinute, secondsPerHour, secondsPerDay };
}

/**
 * Add hours to a date.
 * @param {object} date  Starting date
 * @param {number} hours  Hours to add (can be negative)
 * @returns {object}  New date object
 */
export function addHours(date, hours) {
  const { secondsPerHour, secondsPerDay } = getTimeUnits();
  return addDays(date, (hours * secondsPerHour) / secondsPerDay);
}

/**
 * Add minutes to a date.
 * @param {object} date  Starting date
 * @param {number} minutes  Minutes to add (can be negative)
 * @returns {object}  New date object
 */
export function addMinutes(date, minutes) {
  const { secondsPerMinute, secondsPerDay } = getTimeUnits();
  return addDays(date, (minutes * secondsPerMinute) / secondsPerDay);
}

/**
 * Add seconds to a date.
 * @param {object} date  Starting date
 * @param {number} seconds  Seconds to add (can be negative)
 * @returns {object}  New date object
 */
export function addSeconds(date, seconds) {
  return addDays(date, seconds / getTimeUnits().secondsPerDay);
}

/**
 * Calculate seconds between two dates (including time components).
 * @param {object} startDate  Start date
 * @param {object} endDate  End date
 * @returns {number}  Number of seconds (can be negative)
 */
export function secondsBetween(startDate, endDate) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return 0;
  try {
    const yearZero = calendar.years?.yearZero ?? 0;
    const startTime = calendar.componentsToTime({
      year: startDate.year - yearZero,
      month: startDate.month,
      dayOfMonth: startDate.dayOfMonth ?? 0,
      hour: startDate.hour ?? 0,
      minute: startDate.minute ?? 0,
      second: startDate.second ?? 0
    });
    const endTime = calendar.componentsToTime({
      year: endDate.year - yearZero,
      month: endDate.month,
      dayOfMonth: endDate.dayOfMonth ?? 0,
      hour: endDate.hour ?? 0,
      minute: endDate.minute ?? 0,
      second: endDate.second ?? 0
    });
    return endTime - startTime;
  } catch (error) {
    log(1, 'Error calculating seconds between dates:', error);
    return 0;
  }
}

/**
 * Calculate hours between two dates (including time components).
 * @param {object} startDate  Start date
 * @param {object} endDate  End date
 * @returns {number}  Number of hours (can be negative/fractional)
 */
export function hoursBetween(startDate, endDate) {
  return secondsBetween(startDate, endDate) / getTimeUnits().secondsPerHour;
}

/**
 * Calculate minutes between two dates (including time components).
 * @param {object} startDate  Start date
 * @param {object} endDate  End date
 * @returns {number}  Number of minutes (can be negative)
 */
export function minutesBetween(startDate, endDate) {
  return Math.floor(secondsBetween(startDate, endDate) / getTimeUnits().secondsPerMinute);
}

/**
 * Get current date from game time.
 * @returns {object}  Current date components (all 0-indexed)
 */
export function getCurrentDate() {
  const components = game.time.components;
  const calendar = CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  return { year: components.year + yearZero, month: components.month, dayOfMonth: components.dayOfMonth, hour: components.hour, minute: components.minute };
}

/**
 * Check if a date is valid for the current calendar.
 * @param {object} date  Date to validate
 * @returns {boolean}  True if valid
 */
export function isValidDate(date) {
  if (!date || typeof date !== 'object') return false;
  if (typeof date.year !== 'number') return false;
  if (typeof date.month !== 'number') return false;
  if (typeof date.dayOfMonth !== 'number') return false;
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return true;
  const yearZero = calendar.years?.yearZero ?? 0;
  const internalYear = date.year - yearZero;
  if (calendar.isMonthless) {
    if (date.month !== 0) return false;
    const maxDays = calendar.getDaysInYear(internalYear);
    if (date.dayOfMonth < 0 || date.dayOfMonth >= maxDays) return false;
  } else {
    if (date.month < 0 || date.month >= calendar.monthsArray.length) return false;
    const maxDays = calendar.getDaysInMonth(date.month, internalYear);
    if (date.dayOfMonth < 0 || date.dayOfMonth >= maxDays) return false;
  }
  if (date.hour !== undefined) {
    const hoursPerDay = calendar.hours ?? 24;
    if (date.hour < 0 || date.hour >= hoursPerDay) return false;
  }
  if (date.minute !== undefined) if (date.minute < 0 || date.minute >= 60) return false;
  return true;
}
