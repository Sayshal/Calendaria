/**
 * Calendaria Public API
 * Provides a stable public API for macros and other modules to interact with Calendaria.
 *
 * Access via: game.modules.get('calendaria').api or window.CALENDARIA.api
 *
 * @module API
 * @author Tyler
 */

import CalendarManager from './calendar/calendar-manager.mjs';
import { log } from './utils/logger.mjs';

/**
 * Public API for Calendaria module.
 * Provides access to calendar data, time management, moon phases, and more.
 */
export const CalendariaAPI = {
  /* -------------------------------------------- */
  /*  Time Management                             */
  /* -------------------------------------------- */

  /**
   * Get the current date and time components.
   * @returns {TimeComponents} Current time components (year, month, day, hour, minute, second, etc.)
   * @example
   * const now = CALENDARIA.api.getCurrentDateTime();
   * console.log(now.year, now.month, now.dayOfMonth);
   */
  getCurrentDateTime() {
    const components = game.time.components;
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;

    return {
      ...components,
      year: components.year + yearZero
    };
  },

  /**
   * Advance the current time by a delta.
   * @param {object} delta - Time delta to advance (e.g., {day: 1, hour: 2})
   * @returns {Promise<number>} New world time after advancement
   * @example
   * await CALENDARIA.api.advanceTime({ day: 1 }); // Advance by 1 day
   * await CALENDARIA.api.advanceTime({ hour: 8, minute: 30 }); // Advance by 8.5 hours
   */
  async advanceTime(delta) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can advance time');
      ui.notifications.error('Only GMs can advance time');
      return game.time.worldTime;
    }

    return await game.time.advance(delta);
  },

  /**
   * Set the current date and time to specific components.
   * @param {object} components - Time components to set (year, month, day, hour, minute, second)
   * @returns {Promise<number>} New world time after setting
   * @example
   * await CALENDARIA.api.setDateTime({ year: 1492, month: 1, day: 15 });
   */
  async setDateTime(components) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can set date/time');
      ui.notifications.error('Only GMs can set date/time');
      return game.time.worldTime;
    }

    // Convert display year to internal year if year is provided
    const internalComponents = { ...components };
    if (components.year !== undefined) {
      const calendar = CalendarManager.getActiveCalendar();
      const yearZero = calendar?.years?.yearZero ?? 0;
      internalComponents.year = components.year - yearZero;
    }

    return await game.time.set(internalComponents);
  },

  /**
   * Jump to a specific date while preserving the current time of day.
   * @param {object} options - Date to jump to
   * @param {number} [options.year] - Target year
   * @param {number} [options.month] - Target month (0-indexed)
   * @param {number} [options.day] - Target day of month
   * @returns {Promise<void>}
   * @example
   * await CALENDARIA.api.jumpToDate({ year: 1492, month: 5, day: 21 });
   */
  async jumpToDate({ year, month, day }) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can jump to date');
      ui.notifications.error('Only GMs can jump to date');
      return;
    }

    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) {
      log(2, 'No active calendar available');
      ui.notifications.warn('No active calendar available');
      return;
    }

    await calendar.jumpToDate({ year, month, day });
  },

  /* -------------------------------------------- */
  /*  Calendar Access                             */
  /* -------------------------------------------- */

  /**
   * Get the currently active calendar.
   * @returns {CalendariaCalendar|null} The active calendar or null if none
   * @example
   * const calendar = CALENDARIA.api.getActiveCalendar();
   * console.log(calendar.name, calendar.months);
   */
  getActiveCalendar() {
    return CalendarManager.getActiveCalendar();
  },

  /**
   * Get a specific calendar by ID.
   * @param {string} id - Calendar ID
   * @returns {CalendariaCalendar|null} The calendar or null if not found
   * @example
   * const harptos = CALENDARIA.api.getCalendar('harptos');
   */
  getCalendar(id) {
    return CalendarManager.getCalendar(id);
  },

  /**
   * Get all registered calendars.
   * @returns {Map<string, CalendariaCalendar>} Map of calendar ID to calendar
   * @example
   * const allCalendars = CALENDARIA.api.getAllCalendars();
   * for (const [id, calendar] of allCalendars) {
   *   console.log(id, calendar.name);
   * }
   */
  getAllCalendars() {
    return CalendarManager.getAllCalendars();
  },

  /**
   * Get metadata for all calendars.
   * @returns {object[]} Array of calendar metadata
   * @example
   * const metadata = CALENDARIA.api.getAllCalendarMetadata();
   * metadata.forEach(cal => console.log(cal.name, cal.author, cal.isActive));
   */
  getAllCalendarMetadata() {
    return CalendarManager.getAllCalendarMetadata();
  },

  /**
   * Switch to a different calendar.
   * @param {string} id - Calendar ID to switch to
   * @returns {Promise<boolean>} True if calendar was switched successfully
   * @example
   * await CALENDARIA.api.switchCalendar('greyhawk');
   */
  async switchCalendar(id) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can switch calendars');
      ui.notifications.error('Only GMs can switch calendars');
      return false;
    }

    return await CalendarManager.switchCalendar(id);
  },

  /* -------------------------------------------- */
  /*  Moon Phases                                 */
  /* -------------------------------------------- */

  /**
   * Get the current phase of a specific moon.
   * @param {number} [moonIndex=0] - Index of the moon (0 for primary moon)
   * @returns {object|null} Moon phase data with name, icon, position, and dayInCycle
   * @example
   * const selune = CALENDARIA.api.getMoonPhase(0);
   * console.log(selune.name, selune.position);
   */
  getMoonPhase(moonIndex = 0) {
    return CalendarManager.getCurrentMoonPhase(moonIndex);
  },

  /**
   * Get all moon phases for the active calendar.
   * @returns {Array<object>} Array of moon phase data
   * @example
   * const moons = CALENDARIA.api.getAllMoonPhases();
   * moons.forEach(moon => console.log(moon.name));
   */
  getAllMoonPhases() {
    return CalendarManager.getAllCurrentMoonPhases();
  },

  /* -------------------------------------------- */
  /*  Seasons & Sun Position                      */
  /* -------------------------------------------- */

  /**
   * Get the current season.
   * @returns {object|null} Season data with name and other properties
   * @example
   * const season = CALENDARIA.api.getCurrentSeason();
   * console.log(season.name);
   */
  getCurrentSeason() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || !calendar.seasons) return null;

    const components = game.time.components;
    const seasonIndex = components.season ?? 0;
    return calendar.seasons.values?.[seasonIndex] ?? null;
  },

  /**
   * Get the sunrise time in hours for the current day.
   * @returns {number|null} Sunrise time in hours (e.g., 6.5 = 6:30 AM)
   * @example
   * const sunrise = CALENDARIA.api.getSunrise();
   * console.log(`Sunrise at ${Math.floor(sunrise)}:${Math.round((sunrise % 1) * 60)}`);
   */
  getSunrise() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.sunrise !== 'function') return null;

    return calendar.sunrise();
  },

  /**
   * Get the sunset time in hours for the current day.
   * @returns {number|null} Sunset time in hours (e.g., 18.5 = 6:30 PM)
   * @example
   * const sunset = CALENDARIA.api.getSunset();
   * console.log(`Sunset at ${Math.floor(sunset)}:${Math.round((sunset % 1) * 60)}`);
   */
  getSunset() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.sunset !== 'function') return null;

    return calendar.sunset();
  },

  /**
   * Get the number of daylight hours for the current day.
   * @returns {number|null} Hours of daylight (e.g., 12.5)
   * @example
   * const daylight = CALENDARIA.api.getDaylightHours();
   * console.log(`${daylight} hours of daylight`);
   */
  getDaylightHours() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.daylightHours !== 'function') return null;

    return calendar.daylightHours();
  },

  /**
   * Get progress through the day period (0 = sunrise, 1 = sunset).
   * @returns {number|null} Progress value between 0-1
   * @example
   * const progress = CALENDARIA.api.getProgressDay();
   * console.log(`${Math.round(progress * 100)}% through the day`);
   */
  getProgressDay() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.progressDay !== 'function') return null;

    return calendar.progressDay();
  },

  /**
   * Get progress through the night period (0 = sunset, 1 = sunrise).
   * @returns {number|null} Progress value between 0-1
   * @example
   * const progress = CALENDARIA.api.getProgressNight();
   * console.log(`${Math.round(progress * 100)}% through the night`);
   */
  getProgressNight() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.progressNight !== 'function') return null;

    return calendar.progressNight();
  },

  /**
   * Get time until next sunrise.
   * @returns {Object|null} Time delta {hours, minutes, seconds} or null
   * @example
   * const until = CALENDARIA.api.getTimeUntilSunrise();
   * if (until) console.log(`${until.hours}h ${until.minutes}m until sunrise`);
   */
  getTimeUntilSunrise() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.sunrise !== 'function') return null;

    const targetHour = calendar.sunrise();
    if (targetHour === null) return null;

    const components = game.time.components;
    const currentHour = components.hour + components.minute / 60 + components.second / 3600;
    const hoursUntil = currentHour < targetHour ? targetHour - currentHour : (24 - currentHour) + targetHour;

    const hours = Math.floor(hoursUntil);
    const remainingMinutes = (hoursUntil - hours) * 60;
    const minutes = Math.floor(remainingMinutes);
    const seconds = Math.floor((remainingMinutes - minutes) * 60);

    return { hours, minutes, seconds };
  },

  /**
   * Get time until next sunset.
   * @returns {Object|null} Time delta {hours, minutes, seconds} or null
   * @example
   * const until = CALENDARIA.api.getTimeUntilSunset();
   * if (until) console.log(`${until.hours}h ${until.minutes}m until sunset`);
   */
  getTimeUntilSunset() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.sunset !== 'function') return null;

    const targetHour = calendar.sunset();
    if (targetHour === null) return null;

    const components = game.time.components;
    const currentHour = components.hour + components.minute / 60 + components.second / 3600;
    const hoursUntil = currentHour < targetHour ? targetHour - currentHour : (24 - currentHour) + targetHour;

    const hours = Math.floor(hoursUntil);
    const remainingMinutes = (hoursUntil - hours) * 60;
    const minutes = Math.floor(remainingMinutes);
    const seconds = Math.floor((remainingMinutes - minutes) * 60);

    return { hours, minutes, seconds };
  },

  /**
   * Get time until next midnight.
   * @returns {Object|null} Time delta {hours, minutes, seconds} or null
   * @example
   * const until = CALENDARIA.api.getTimeUntilMidnight();
   * if (until) console.log(`${until.hours}h ${until.minutes}m until midnight`);
   */
  getTimeUntilMidnight() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;

    const targetHour = 0;
    const components = game.time.components;
    const currentHour = components.hour + components.minute / 60 + components.second / 3600;
    const hoursUntil = currentHour < targetHour ? targetHour - currentHour : (24 - currentHour) + targetHour;

    const hours = Math.floor(hoursUntil);
    const remainingMinutes = (hoursUntil - hours) * 60;
    const minutes = Math.floor(remainingMinutes);
    const seconds = Math.floor((remainingMinutes - minutes) * 60);

    return { hours, minutes, seconds };
  },

  /**
   * Get time until next midday.
   * @returns {Object|null} Time delta {hours, minutes, seconds} or null
   * @example
   * const until = CALENDARIA.api.getTimeUntilMidday();
   * if (until) console.log(`${until.hours}h ${until.minutes}m until midday`);
   */
  getTimeUntilMidday() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;

    const targetHour = 12;
    const components = game.time.components;
    const currentHour = components.hour + components.minute / 60 + components.second / 3600;
    const hoursUntil = currentHour < targetHour ? targetHour - currentHour : (24 - currentHour) + targetHour;

    const hours = Math.floor(hoursUntil);
    const remainingMinutes = (hoursUntil - hours) * 60;
    const minutes = Math.floor(remainingMinutes);
    const seconds = Math.floor((remainingMinutes - minutes) * 60);

    return { hours, minutes, seconds };
  },

  /* -------------------------------------------- */
  /*  Festivals & Special Days                    */
  /* -------------------------------------------- */

  /**
   * Get the festival for the current date, if any.
   * @returns {object|null} Festival data with name, month, and day
   * @example
   * const festival = CALENDARIA.api.getCurrentFestival();
   * if (festival) console.log(`Today is ${festival.name}!`);
   */
  getCurrentFestival() {
    return CalendarManager.getCurrentFestival();
  },

  /**
   * Check if the current date is a festival day.
   * @returns {boolean} True if current date is a festival
   * @example
   * if (CALENDARIA.api.isFestivalDay()) {
   *   console.log('It\'s a festival day!');
   * }
   */
  isFestivalDay() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.isFestivalDay !== 'function') return false;

    return calendar.isFestivalDay();
  },

  /* -------------------------------------------- */
  /*  Formatters                                  */
  /* -------------------------------------------- */

  /**
   * Format date and time components as a string.
   * @param {TimeComponents} [components] - Time components to format (defaults to current time)
   * @param {string} [formatter] - Formatter type (e.g., 'date', 'time', 'datetime')
   * @returns {string} Formatted date/time string
   * @example
   * const formatted = CALENDARIA.api.formatDate(null, 'datetime');
   * console.log(formatted); // "15 Hammer 1492, 3:30 PM"
   */
  formatDate(components = null, formatter = 'date') {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return '';

    // If no components provided, use current game time (internal year)
    const isInternalComponents = !components;
    components = components || game.time.components;

    // Use calendar's format method if available
    if (typeof calendar.format === 'function') {
      return calendar.format(components, formatter);
    }

    // Fallback to basic formatting
    // Only add yearZero if components are internal (from game.time.components)
    const displayYear = isInternalComponents ? components.year + calendar.years.yearZero : components.year;
    return `${components.dayOfMonth + 1} ${calendar.months.values[components.month]?.name ?? 'Unknown'} ${displayYear}`;
  }
};
