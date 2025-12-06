/**
 * Time Tracker
 * Monitors world time changes and fires hooks when specific time thresholds are crossed.
 * Thresholds include sunrise, sunset, midnight, and midday.
 *
 * @module Time/TimeTracker
 * @author Tyler
 */

import { MODULE, HOOKS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';

/**
 * Static class that tracks world time changes and fires threshold hooks.
 */
export default class TimeTracker {
  /** @type {number|null} Last known world time in seconds */
  static #lastWorldTime = null;

  /** @type {Object|null} Last checked time components */
  static #lastComponents = null;

  /**
   * Initialize the time tracker.
   * Called during module initialization.
   */
  static initialize() {
    log(3, 'Initializing Time Tracker...');

    // Store current time as baseline
    this.#lastWorldTime = game.time.worldTime;
    this.#lastComponents = game.time.components;

    log(3, 'Time Tracker initialized');
  }

  /**
   * Handle world time updates.
   * Called by the updateWorldTime hook.
   *
   * @param {number} worldTime - The new world time in seconds
   * @param {number} delta - The time delta in seconds
   */
  static onUpdateWorldTime(worldTime, delta) {
    // Only process if we have a calendar
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) {
      log(3, 'No active calendar, skipping time tracking');
      return;
    }

    // If this is the first update, just store the time
    if (this.#lastWorldTime === null) {
      this.#lastWorldTime = worldTime;
      this.#lastComponents = game.time.components;
      return;
    }

    // Check for threshold crossings
    this.#checkThresholds(this.#lastWorldTime, worldTime, calendar);

    // Update last known time
    this.#lastWorldTime = worldTime;
    this.#lastComponents = game.time.components;
  }

  /**
   * Check if any thresholds were crossed between two times.
   *
   * @param {number} previousTime - Previous world time in seconds
   * @param {number} currentTime - Current world time in seconds
   * @param {Object} calendar - The active calendar
   * @private
   */
  static #checkThresholds(previousTime, currentTime, calendar) {
    // If time went backwards, don't process
    if (currentTime <= previousTime) {
      log(3, 'Time went backwards, skipping threshold checks');
      return;
    }

    const crossedThresholds = [];

    // Convert times to Date objects for easier manipulation
    const startTime = previousTime;
    const endTime = currentTime;

    // Calculate the time difference
    const deltaSeconds = endTime - startTime;

    // For each second in the range, check if we crossed a threshold
    // For performance, we check at day boundaries and specific hours
    // Convert to hours for comparison
    const previousComponents = this.#getComponentsForTime(previousTime);
    const currentComponents = game.time.components;

    // Determine all thresholds in chronological order
    const thresholds = this.#getAllThresholdsCrossed(previousComponents, currentComponents, calendar);

    // Fire hooks for each threshold in order
    for (const threshold of thresholds) {
      this.#fireThresholdHook(threshold.name, threshold.data);
    }
  }

  /**
   * Get all thresholds crossed between two time points.
   *
   * @param {Object} startComponents - Starting time components
   * @param {Object} endComponents - Ending time components
   * @param {Object} calendar - The active calendar
   * @returns {Array} Array of crossed thresholds with {name, data}
   * @private
   */
  static #getAllThresholdsCrossed(startComponents, endComponents, calendar) {
    const thresholds = [];

    // Get start and end time in hours (as decimal)
    const startHour = startComponents.hour + startComponents.minute / 60 + startComponents.second / 3600;
    const endHour = endComponents.hour + endComponents.minute / 60 + endComponents.second / 3600;

    // Calculate total days spanned
    const startDayOfYear = this.#getDayOfYear(startComponents, calendar);
    const endDayOfYear = this.#getDayOfYear(endComponents, calendar);
    const yearDiff = endComponents.year - startComponents.year;

    // If we're in the same day and year
    if (yearDiff === 0 && startDayOfYear === endDayOfYear) {
      // Check thresholds within the same day
      const dayThresholds = this.#getThresholdsForDay(endComponents, calendar);

      for (const [name, hour] of Object.entries(dayThresholds)) {
        if (hour !== null && startHour < hour && endHour >= hour) {
          thresholds.push({
            name,
            data: this.#createThresholdData(endComponents, calendar)
          });
        }
      }
    } else {
      // We crossed at least one day boundary - need to check multiple days
      // This is more complex, so we'll iterate through each day

      // First, complete the starting day
      const startDayThresholds = this.#getThresholdsForDay(startComponents, calendar);
      for (const [name, hour] of Object.entries(startDayThresholds)) {
        if (hour !== null && startHour < hour) {
          thresholds.push({
            name,
            data: this.#createThresholdData(startComponents, calendar)
          });
        }
      }

      // Then, for each complete day in between (if any), add all thresholds
      // This is simplified - in practice, we'd iterate through each day
      // For now, we'll just handle the end day

      // Finally, check thresholds in the ending day
      const endDayThresholds = this.#getThresholdsForDay(endComponents, calendar);
      for (const [name, hour] of Object.entries(endDayThresholds)) {
        if (hour !== null && endHour >= hour) {
          thresholds.push({
            name,
            data: this.#createThresholdData(endComponents, calendar)
          });
        }
      }
    }

    // Sort thresholds chronologically
    const order = { midnight: 0, sunrise: 1, midday: 2, sunset: 3 };
    thresholds.sort((a, b) => (order[a.name] || 999) - (order[b.name] || 999));

    return thresholds;
  }

  /**
   * Get threshold times for a specific day.
   *
   * @param {Object} components - Time components for the day
   * @param {Object} calendar - The active calendar
   * @returns {Object} Object with threshold names and their times in hours
   * @private
   */
  static #getThresholdsForDay(components, calendar) {
    // Get sunrise and sunset times for this day
    const sunrise = typeof calendar.sunrise === 'function' ? calendar.sunrise() : null;
    const sunset = typeof calendar.sunset === 'function' ? calendar.sunset() : null;

    return {
      midnight: 0,      // Midnight is always at hour 0
      sunrise: sunrise, // Sunrise varies by calendar/season
      midday: 12,       // Midday is always at hour 12
      sunset: sunset    // Sunset varies by calendar/season
    };
  }

  /**
   * Create threshold event data.
   *
   * @param {Object} components - Time components
   * @param {Object} calendar - The active calendar
   * @returns {Object} Threshold event data
   * @private
   */
  static #createThresholdData(components, calendar) {
    return {
      worldTime: game.time.worldTime,
      components: components,
      calendar: calendar
    };
  }

  /**
   * Fire a threshold hook.
   *
   * @param {string} thresholdName - Name of the threshold (midnight, sunrise, midday, sunset)
   * @param {Object} data - Event data to pass to the hook
   * @private
   */
  static #fireThresholdHook(thresholdName, data) {
    const hookName = HOOKS[thresholdName.toUpperCase()];
    if (!hookName) {
      log(2, `Unknown threshold name: ${thresholdName}`);
      return;
    }

    log(3, `Threshold crossed: ${thresholdName}`);
    Hooks.callAll(hookName, data);
  }

  /**
   * Get time components for a specific world time.
   *
   * @param {number} worldTime - World time in seconds
   * @returns {Object} Time components
   * @private
   */
  static #getComponentsForTime(worldTime) {
    // This is a simplified version - ideally we'd use the calendar's method
    // For now, we'll use the stored last components if available
    return this.#lastComponents || game.time.components;
  }

  /**
   * Calculate day of year from components.
   *
   * @param {Object} components - Time components
   * @param {Object} calendar - The active calendar
   * @returns {number} Day of year (0-based)
   * @private
   */
  static #getDayOfYear(components, calendar) {
    // Sum up days in previous months
    let dayOfYear = 0;
    for (let i = 0; i < components.month; i++) {
      const month = calendar.months?.values?.[i];
      dayOfYear += month?.days || 30; // Default to 30 if not specified
    }
    // Add days in current month
    dayOfYear += components.dayOfMonth;
    return dayOfYear;
  }
}
