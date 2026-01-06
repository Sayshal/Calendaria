/**
 * Calendar Utility Functions
 * Helper functions for calendar data manipulation and conversion.
 * @module Calendar/CalendarUtils
 * @author Tyler
 */

import { format, localize } from '../utils/localization.mjs';

/**
 * Prelocalize calendar configuration data.
 * Recursively walks through the calendar definition and replaces localization keys with their localized values.
 * @param {object} calendarData - Calendar definition object to prelocalize
 * @returns {object} The same calendar object with prelocalized strings
 */
export function preLocalizeCalendar(calendarData) {
  for (const key in calendarData) {
    const value = calendarData[key];
    if (typeof value === 'string') calendarData[key] = localize(value);
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'object' && item !== null) preLocalizeCalendar(item);
    } else if (typeof value === 'object' && value !== null) {
      preLocalizeCalendar(value);
    }
  }
  return calendarData;
}

/**
 * Find festival day for a given date.
 * Works with any calendar that has a festivals array.
 * @param {object} calendar - Calendar instance with festivals array
 * @param {number|object} time - Time to check (worldTime number or components object)
 * @returns {object|null} Festival object if found, null otherwise
 */
export function findFestivalDay(calendar, time = game.time.worldTime) {
  if (!calendar.festivals || calendar.festivals.length === 0) return null;
  const components = typeof time === 'number' ? calendar.timeToComponents(time) : time;
  return calendar.festivals.find((f) => f.month === components.month + 1 && f.day === components.dayOfMonth + 1) ?? null;
}

/**
 * Get month abbreviation with fallback to full name.
 * Ensures we always have a displayable month name even if abbreviation is undefined.
 * @param {object} month - Month object from calendar definition
 * @returns {string} Month abbreviation or full name if abbreviation is undefined
 */
export function getMonthAbbreviation(month) {
  return month.abbreviation ?? month.name;
}

/**
 * Format a date as "Day Month" or festival name if applicable.
 * This is a reusable formatter for any calendar with festivals.
 * @param {object} calendar - Calendar instance
 * @param {object} components - Date components
 * @param {object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatMonthDay(calendar, components, options = {}) {
  const festivalDay = findFestivalDay(calendar, components);
  if (festivalDay) return localize(festivalDay.name);
  const day = components.dayOfMonth + 1;
  const month = calendar.months.values[components.month];
  const monthName = options.abbreviated ? getMonthAbbreviation(month) : month.name;
  return format('CALENDARIA.Formatters.DayMonth', { day, month: localize(monthName) });
}

/**
 * Format a date as "Day Month Year" or "Festival, Year" if applicable.
 * This is a reusable formatter for any calendar with festivals.
 * @param {object} calendar - Calendar instance
 * @param {object} components - Date components
 * @param {object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatMonthDayYear(calendar, components, options = {}) {
  const festivalDay = findFestivalDay(calendar, components);
  if (festivalDay) {
    const year = components.year + (calendar.years?.yearZero ?? 0);
    return format('CALENDARIA.Formatters.FestivalDayYear', { day: localize(festivalDay.name), yyyy: year });
  }

  // Use standard formatting if no festival
  const day = components.dayOfMonth + 1;
  const month = calendar.months.values[components.month];
  const monthName = options.abbreviated ? getMonthAbbreviation(month) : month.name;
  const year = components.year + (calendar.years?.yearZero ?? 0);
  return format('CALENDARIA.Formatters.DayMonthYear', { day, month: localize(monthName), yyyy: year });
}

/**
 * Format era template string with variable substitution.
 * Replaces [variable] patterns with corresponding values from context.
 * @param {string} template - Template string (e.g., "[year] [eraAbbr]")
 * @param {object} context - Variable values to substitute
 * @param {number} context.year - Display year
 * @param {string} context.abbreviation - Era abbreviation (also [eraAbbr])
 * @param {string} context.era - Full era name
 * @param {number} context.yearInEra - Year within the era (1-based)
 * @returns {string} Formatted string with variables replaced
 */
export function formatEraTemplate(template, context) {
  const ctx = {
    ...context,
    era: context.era ?? context.name,
    eraAbbr: context.abbreviation ?? context.short,
    short: context.abbreviation ?? context.short,
    abbreviation: context.abbreviation ?? context.short
  };

  return template.replace(/\[(\w+)]/g, (match, key) => ctx[key] ?? match);
}
