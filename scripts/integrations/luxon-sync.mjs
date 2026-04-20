/**
 * Luxon-based WorldClock sync for Gregorian-compatible calendars.
 * @module Integrations/LuxonSync
 * @author Tyler
 */

import CalendariaCalendar from '../data/calendaria-calendar.mjs';

/**
 * Get the active system world clock that exposes a Luxon DateTime.
 * @returns {object|null} Luxon-based worldClock, or null if no compatible system is active
 */
export function getSystemWorldClock() {
  return game.pf2e?.worldClock ?? game.sf2e?.worldClock ?? null;
}

/**
 * Whether the active Foundry system uses a Luxon-based WorldClock.
 * @returns {boolean} True if Luxon sync enforcement should apply
 */
export function isLuxonSyncRequired() {
  return game.system?.id === 'pf2e' || game.system?.id === 'sf2e';
}

/**
 * Whether a calendar declares a Luxon-compatible theme for sync.
 * @param {CalendariaCalendar|object} calendar - Calendar instance or raw data
 * @returns {boolean} True if the calendar has a theme set in metadata
 */
export function isLuxonCompatible(calendar) {
  return Boolean(calendar?.metadata?.luxonSync?.theme);
}

/**
 * Compute the yearOffset for a given Luxon-sync dateTheme.
 * @param {string} theme - 'AR'|'IC'|'AG'|'AD'|'CE'
 * @returns {number} Year offset relative to Luxon Gregorian year
 */
function getYearOffset(theme) {
  return CONFIG.PF2E?.worldClock?.[theme]?.yearOffset ?? 0;
}

/**
 * Align Calendaria's internal time with the system's Luxon Gregorian display.
 * @param {CalendariaCalendar} calendar - Active calendar
 * @returns {boolean} True if sync was applied, false otherwise
 */
export function syncWithLuxon(calendar) {
  CalendariaCalendar.setEpochSync(0, null);
  if (!calendar) return false;
  const wc = getSystemWorldClock();
  if (!wc) return false;
  const theme = calendar.metadata?.luxonSync?.theme ?? null;
  if (!theme) return false;
  const worldCreatedOn = wc.worldCreatedOn;
  if (!worldCreatedOn?.isValid) return false;
  const luxonNow = worldCreatedOn.plus({ seconds: game.time.worldTime });
  const yearOffset = getYearOffset(theme);
  const yearZero = calendar.years?.yearZero ?? 0;
  const internalYear = luxonNow.year + yearOffset - yearZero;
  const components = { year: internalYear, month: luxonNow.month - 1, dayOfMonth: luxonNow.day - 1, hour: luxonNow.hour, minute: luxonNow.minute, second: luxonNow.second };
  const internalTime = calendar.componentsToTime(components);
  const epochOffset = internalTime - game.time.worldTime;
  const firstWeekday = computeFirstWeekday(calendar, luxonNow, internalTime, components);
  CalendariaCalendar.setEpochSync(epochOffset, firstWeekday);
  if (calendar.years) calendar.years.firstWeekday = firstWeekday;
  return true;
}

/**
 * Derive the calendar-level firstWeekday so day-of-week at the synced date matches Luxon.
 * @param {CalendariaCalendar} calendar - Active calendar
 * @param {object} luxonNow - Luxon DateTime at current worldTime
 * @param {number} internalTime - Computed internal seconds at luxonNow
 * @param {object} components - Date components at luxonNow
 * @returns {number} firstWeekday value for `calendar.years.firstWeekday`
 */
function computeFirstWeekday(calendar, luxonNow, internalTime, components) {
  const numWeekdays = calendar.daysInWeek || 7;
  const secondsPerDay = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
  const daysSinceYearZero = Math.floor(internalTime / secondsPerDay);
  const nonCountingBeforeYear = (calendar.countNonWeekdayFestivalsBeforeYear?.(components.year) ?? 0) + (calendar.countIntercalaryDaysBeforeYear?.(components.year) ?? 0);
  const nonCountingInYear = (calendar.countNonWeekdayFestivalsBefore?.(components) ?? 0) + (calendar.countIntercalaryDaysBefore?.(components) ?? 0);
  const countingDays = daysSinceYearZero - (nonCountingBeforeYear + nonCountingInYear);
  const isoOfFirstWeekday = calendar.metadata?.id === 'gregorian' ? 7 : 1;
  const desiredIdx = (((luxonNow.weekday - isoOfFirstWeekday) % numWeekdays) + numWeekdays) % numWeekdays;
  return (((desiredIdx - (countingDays % numWeekdays)) % numWeekdays) + numWeekdays) % numWeekdays;
}
