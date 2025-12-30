/**
 * Date Utility Functions
 * Provides calendar-agnostic date comparison and manipulation utilities.
 * @module Notes/Utils/DateUtils
 * @author Tyler
 */

import CalendarManager from '../../calendar/calendar-manager.mjs';

/**
 * Compare two date objects.
 * @param {object} date1  First date
 * @param {object} date2  Second date
 * @returns {number}  -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(date1, date2) {
  if (date1.year !== date2.year) return date1.year < date2.year ? -1 : 1;
  if (date1.month !== date2.month) return date1.month < date2.month ? -1 : 1;
  if (date1.day !== date2.day) return date1.day < date2.day ? -1 : 1;
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
  return date1.year === date2.year && date1.month === date2.month && date1.day === date2.day;
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
  if (date1.day !== date2.day) return date1.day < date2.day ? -1 : 1;
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
    const monthDays = calendar.months?.values || [];
    let startDayOfYear = (startDate.day ?? 1) - 1;
    for (let i = 0; i < startDate.month && i < monthDays.length; i++) startDayOfYear += monthDays[i]?.days || 30;
    let endDayOfYear = (endDate.day ?? 1) - 1;
    for (let i = 0; i < endDate.month && i < monthDays.length; i++) endDayOfYear += monthDays[i]?.days || 30;
    const startComponents = { year: startDate.year, day: startDayOfYear, hour: 0, minute: 0, second: 0 };
    const endComponents = { year: endDate.year, day: endDayOfYear, hour: 0, minute: 0, second: 0 };
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
  const monthsPerYear = calendar.months?.values?.length || 12;
  return yearDiff * monthsPerYear + monthDiff;
}

/**
 * Get day of week for a date (0 = first day of week).
 * Respects month's startingWeekday if set.
 * Accounts for intercalary days that don't count for weekday calculation.
 * @param {object} date  Date to check
 * @returns {number}  Day of week index
 */
export function dayOfWeek(date) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return 0;

  try {
    const monthData = calendar.months?.values?.[date.month];
    if (monthData?.startingWeekday != null) {
      const daysInWeek = calendar.days?.values?.length || 7;
      const dayIndex = (date.day ?? 1) - 1;
      const nonCountingDays = calendar.countNonWeekdayFestivalsBefore?.({ year: date.year - (calendar.years?.yearZero ?? 0), month: date.month, dayOfMonth: (date.day ?? 1) - 1 }) ?? 0;
      return (monthData.startingWeekday + dayIndex - nonCountingDays + daysInWeek * 100) % daysInWeek;
    }

    const yearZero = calendar.years?.yearZero ?? 0;
    const internalYear = date.year - yearZero;
    let dayOfYear = (date.day ?? 1) - 1;
    const monthDays = calendar.months?.values || [];
    for (let i = 0; i < date.month && i < monthDays.length; i++) dayOfYear += monthDays[i]?.days || 30;
    const nonCountingDays = calendar.countNonWeekdayFestivalsBefore?.({ year: internalYear, month: date.month, dayOfMonth: (date.day ?? 1) - 1 }) ?? 0;
    const adjustedDayOfYear = dayOfYear - nonCountingDays;
    const components = { year: internalYear, day: adjustedDayOfYear, hour: 0, minute: 0, second: 0 };
    const time = calendar.componentsToTime(components);
    const timeComponents = calendar.timeToComponents(time);
    return timeComponents.dayOfWeek ?? 0;
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
    let dayOfYear = date.day - 1;
    const monthDays = calendar.months?.values || [];
    for (let i = 0; i < date.month && i < monthDays.length; i++) dayOfYear += monthDays[i]?.days || 30;
    const components = { year: date.year, day: dayOfYear, hour: date.hour ?? 0, minute: date.minute ?? 0, second: 0 };
    const time = calendar.componentsToTime(components);
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
    const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
    const secondsPerDay = hoursPerDay * minutesPerHour * secondsPerMinute;
    const newTime = time + days * secondsPerDay;
    const newComponents = calendar.timeToComponents(newTime);
    return { year: newComponents.year, month: newComponents.month, day: newComponents.dayOfMonth + 1, hour: newComponents.hour, minute: newComponents.minute };
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
  let newYear = date.year;
  let newMonth = date.month + months;
  const monthsPerYear = calendar.months?.values?.length || 12;
  while (newMonth >= monthsPerYear) {
    newMonth -= monthsPerYear;
    newYear++;
  }

  while (newMonth < 0) {
    newMonth += monthsPerYear;
    newYear--;
  }

  const monthData = calendar.months?.values?.[newMonth];
  const maxDays = monthData?.days ?? 30;
  const newDay = Math.min(date.day, maxDays);
  return { year: newYear, month: newMonth, day: newDay, hour: date.hour, minute: date.minute };
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
  const newYear = date.year + years;
  const monthData = calendar.months?.values?.[date.month];
  const maxDays = monthData?.days ?? 30;
  const newDay = Math.min(date.day, maxDays);
  return { year: newYear, month: date.month, day: newDay, hour: date.hour, minute: date.minute };
}

/**
 * Get current date from game time.
 * @returns {object}  Current date components (day is 1-indexed to match note storage)
 */
export function getCurrentDate() {
  const components = game.time.components;
  const calendar = CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  return { year: components.year + yearZero, month: components.month, day: components.dayOfMonth + 1, hour: components.hour, minute: components.minute };
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
  if (typeof date.day !== 'number') return false;
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return true;
  if (date.month < 0 || date.month >= calendar.months.length) return false;
  const monthData = calendar.months[date.month];
  const maxDays = monthData?.days ?? 30;
  if (date.day < 1 || date.day > maxDays) return false;
  if (date.hour !== undefined) {
    const hoursPerDay = calendar.hours ?? 24;
    if (date.hour < 0 || date.hour >= hoursPerDay) return false;
  }
  if (date.minute !== undefined) if (date.minute < 0 || date.minute >= 60) return false;
  return true;
}
