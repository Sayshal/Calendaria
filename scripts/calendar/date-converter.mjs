import { formatCustom, log } from '../utils/_module.mjs';
import { CalendarRegistry } from './_module.mjs';

/**
 * Convert a date from one calendar to another via shared worldTime.
 * @param {object} date - Display date {year, month (0-indexed), dayOfMonth (0-indexed), hour?, minute?}
 * @param {string} fromCalendarId - Source calendar ID
 * @param {string} toCalendarId - Target calendar ID
 * @returns {object|null} Converted date in target calendar's display coords, or null on error
 */
export function convertDate(date, fromCalendarId, toCalendarId) {
  if (fromCalendarId === toCalendarId) return { ...date };
  const fromCal = CalendarRegistry.get(fromCalendarId);
  const toCal = CalendarRegistry.get(toCalendarId);
  if (!fromCal || !toCal) {
    log(2, `convertDate: calendar not found (from=${fromCalendarId}, to=${toCalendarId})`);
    return null;
  }
  const fromYearZero = fromCal.years?.yearZero ?? 0;
  const internalComponents = {
    year: date.year - fromYearZero,
    month: date.month ?? 0,
    dayOfMonth: date.dayOfMonth ?? 0,
    hour: date.hour ?? 0,
    minute: date.minute ?? 0,
    second: date.second ?? 0
  };
  const worldTime = fromCal.componentsToTime(internalComponents);
  const targetComponents = toCal.timeToComponents(worldTime);
  const toYearZero = toCal.years?.yearZero ?? 0;
  return {
    year: targetComponents.year + toYearZero,
    month: targetComponents.month,
    dayOfMonth: targetComponents.dayOfMonth,
    hour: targetComponents.hour,
    minute: targetComponents.minute,
    second: targetComponents.second
  };
}

/**
 * Get equivalent dates on other calendars for a given date.
 * @param {object} date - Display date {year, month (0-indexed), dayOfMonth (0-indexed)}
 * @param {string} calendarId - Source calendar ID
 * @param {string[]} [filterIds] - Target calendar IDs to include (null = all others)
 * @returns {Array<{calendarId: string, calendarName: string, date: object, formatted: string}>} Equivalent dates on other calendars
 */
export function getEquivalentDates(date, calendarId, filterIds = null) {
  if (CalendarRegistry.size <= 1) return [];
  const allIds = CalendarRegistry.getAllIds().filter((id) => id !== calendarId);
  const targetIds = filterIds?.length ? allIds.filter((id) => filterIds.includes(id)) : allIds;
  const results = [];
  for (const targetId of targetIds) {
    const converted = convertDate(date, calendarId, targetId);
    if (!converted) continue;
    const targetCal = CalendarRegistry.get(targetId);
    const formatted = formatCustom(targetCal, converted, 'D MMMM, YYYY');
    const calendarName = targetCal.name ?? targetId;
    results.push({ calendarId: targetId, calendarName, date: converted, formatted });
  }
  return results;
}

/**
 * Get the current worldTime expressed as a date on a specific calendar.
 * @param {string} calendarId - Target calendar ID
 * @returns {object|null} Display date {year, month, dayOfMonth, hour, minute} or null
 */
export function getCurrentDateOn(calendarId) {
  const calendar = CalendarRegistry.get(calendarId);
  if (!calendar) return null;
  const components = calendar.timeToComponents(game.time.worldTime);
  const yearZero = calendar.years?.yearZero ?? 0;
  return {
    year: components.year + yearZero,
    month: components.month,
    dayOfMonth: components.dayOfMonth,
    hour: components.hour,
    minute: components.minute
  };
}
