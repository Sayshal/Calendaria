/**
 * Time Tracker
 * Monitors world time changes and fires hooks when specific time thresholds are crossed.
 * Fires hooks for: dateTimeChange, dayChange, monthChange, yearChange, seasonChange,
 * and time-of-day thresholds (sunrise, sunset, midnight, midday).
 *
 * @module Time/TimeTracker
 * @author Tyler
 */

import { MODULE, HOOKS, SETTINGS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { executeMacroById } from '../utils/macro-utils.mjs';

/**
 * Static class that tracks world time changes and fires threshold hooks.
 */
export default class TimeTracker {
  /** @type {number|null} Last known world time in seconds */
  static #lastWorldTime = null;

  /** @type {Object|null} Last checked time components */
  static #lastComponents = null;

  /** @type {number|null} Last known season index */
  static #lastSeason = null;

  /** @type {Map<number, number>|null} Last known moon phases (moonIndex -> phaseIndex) */
  static #lastMoonPhases = null;

  /**
   * Initialize the time tracker.
   * Called during module initialization.
   */
  static initialize() {
    // Store current time as baseline
    this.#lastWorldTime = game.time.worldTime;
    this.#lastComponents = foundry.utils.deepClone(game.time.components);
    this.#lastSeason = game.time.components?.season ?? null;
    this.#lastMoonPhases = this.#getCurrentMoonPhases();

    log(3, 'Time Tracker initialized');
  }

  /**
   * Handle world time updates.
   * Called by the updateWorldTime hook.
   * Fires dateTimeChange hook and checks for period/threshold crossings.
   *
   * @param {number} worldTime - The new world time in seconds
   * @param {number} delta - The time delta in seconds
   */
  static onUpdateWorldTime(worldTime, delta) {
    // Only process if we have a calendar
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return;
    const currentComponents = game.time.components;

    // If this is the first update, just store the time
    if (this.#lastWorldTime === null || this.#lastComponents === null) {
      this.#lastWorldTime = worldTime;
      this.#lastComponents = foundry.utils.deepClone(currentComponents);
      this.#lastSeason = currentComponents?.season ?? null;
      return;
    }

    // Always fire dateTimeChange hook for any time update
    this.#fireDateTimeChangeHook(this.#lastComponents, currentComponents, delta, calendar);

    // Check for period changes (day, month, year, season)
    this.#checkPeriodChanges(this.#lastComponents, currentComponents, calendar);

    // Check for threshold crossings (sunrise, sunset, midnight, midday)
    this.#checkThresholds(this.#lastWorldTime, worldTime, calendar);

    // Check for moon phase changes
    this.#checkMoonPhaseChanges(calendar);

    // Update last known time
    this.#lastWorldTime = worldTime;
    this.#lastComponents = foundry.utils.deepClone(currentComponents);
    this.#lastSeason = currentComponents?.season ?? null;
    this.#lastMoonPhases = this.#getCurrentMoonPhases();
  }

  /**
   * Fire the dateTimeChange hook with comprehensive time change data.
   * This is the primary hook other modules should listen to for time changes.
   *
   * @param {Object} previousComponents - Previous time components
   * @param {Object} currentComponents - Current time components
   * @param {number} delta - Time delta in seconds
   * @param {Object} calendar - Active calendar
   * @private
   */
  static #fireDateTimeChangeHook(previousComponents, currentComponents, delta, calendar) {
    const yearZero = calendar?.years?.yearZero ?? 0;

    const hookData = {
      previous: { ...previousComponents, year: previousComponents.year + yearZero },
      current: { ...currentComponents, year: currentComponents.year + yearZero },
      diff: delta,
      calendar: calendar,
      worldTime: game.time.worldTime
    };

    Hooks.callAll(HOOKS.DATE_TIME_CHANGE, hookData);
  }

  /**
   * Check for and fire period change hooks (day, month, year, season).
   *
   * @param {Object} previousComponents - Previous time components
   * @param {Object} currentComponents - Current time components
   * @param {Object} calendar - Active calendar
   * @private
   */
  static #checkPeriodChanges(previousComponents, currentComponents, calendar) {
    const yearZero = calendar?.years?.yearZero ?? 0;

    // Create hook data with display years
    const hookData = {
      previous: { ...previousComponents, year: previousComponents.year + yearZero },
      current: { ...currentComponents, year: currentComponents.year + yearZero },
      calendar: calendar
    };

    // Check for year change
    if (previousComponents.year !== currentComponents.year) {
      log(3, `Year changed: ${previousComponents.year + yearZero} -> ${currentComponents.year + yearZero}`);
      Hooks.callAll(HOOKS.YEAR_CHANGE, hookData);
    }

    // Check for month change
    if (previousComponents.month !== currentComponents.month) {
      log(3, `Month changed: ${previousComponents.month} -> ${currentComponents.month}`);
      Hooks.callAll(HOOKS.MONTH_CHANGE, hookData);
    }

    // Check for day change
    if (previousComponents.dayOfMonth !== currentComponents.dayOfMonth || previousComponents.month !== currentComponents.month || previousComponents.year !== currentComponents.year) {
      log(3, `Day changed`);
      Hooks.callAll(HOOKS.DAY_CHANGE, hookData);
      this.#executePeriodMacro('day', hookData);
    }

    // Check for season change
    const previousSeason = previousComponents.season ?? this.#lastSeason;
    const currentSeason = currentComponents.season;
    if (previousSeason !== null && currentSeason !== null && previousSeason !== currentSeason) {
      const seasonData = {
        ...hookData,
        previousSeason: calendar.seasons?.values?.[previousSeason] ?? null,
        currentSeason: calendar.seasons?.values?.[currentSeason] ?? null
      };
      log(3, `Season changed: ${previousSeason} -> ${currentSeason}`);
      Hooks.callAll(HOOKS.SEASON_CHANGE, seasonData);
      this.#executePeriodMacro('season', seasonData);
    }
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
    const startHour = startComponents.hour + startComponents.minute / 60 + (startComponents.second || 0) / 3600;
    const endHour = endComponents.hour + endComponents.minute / 60 + (endComponents.second || 0) / 3600;

    // Calculate total days between start and end
    const totalDays = this.#calculateDaysBetween(startComponents, endComponents, calendar);

    // If we're in the same day
    if (totalDays === 0) {
      // Check thresholds within the same day
      const dayThresholds = this.#getThresholdsForDay(endComponents, calendar);

      for (const [name, hour] of Object.entries(dayThresholds)) {
        if (hour !== null && startHour < hour && endHour >= hour) {
          thresholds.push({ name, data: this.#createThresholdData(endComponents, calendar) });
        }
      }
    } else {
      // We crossed at least one day boundary
      const dayThresholds = this.#getThresholdsForDay(startComponents, calendar);

      // First, complete thresholds remaining in the starting day
      for (const [name, hour] of Object.entries(dayThresholds)) {
        if (hour !== null && startHour < hour) {
          thresholds.push({ name, data: this.#createThresholdData(startComponents, calendar) });
        }
      }

      // For each complete day in between, add all 4 thresholds
      // (totalDays - 1 because we handle start and end days separately)
      const intermediateDays = totalDays - 1;
      for (let day = 0; day < intermediateDays; day++) {
        for (const [name, hour] of Object.entries(dayThresholds)) {
          if (hour !== null) thresholds.push({ name, data: this.#createThresholdData(endComponents, calendar) });
        }
      }

      // Finally, check thresholds in the ending day up to current hour
      const endDayThresholds = this.#getThresholdsForDay(endComponents, calendar);
      for (const [name, hour] of Object.entries(endDayThresholds)) {
        if (hour !== null && endHour >= hour) thresholds.push({ name, data: this.#createThresholdData(endComponents, calendar) });
      }
    }

    return thresholds;
  }

  /**
   * Calculate the number of day boundaries crossed between two time points.
   *
   * @param {Object} startComponents - Starting time components
   * @param {Object} endComponents - Ending time components
   * @param {Object} calendar - The active calendar
   * @returns {number} Number of day boundaries crossed
   * @private
   */
  static #calculateDaysBetween(startComponents, endComponents, calendar) {
    const startDayOfYear = this.#getDayOfYear(startComponents, calendar);
    const endDayOfYear = this.#getDayOfYear(endComponents, calendar);
    const yearDiff = endComponents.year - startComponents.year;

    if (yearDiff === 0) return endDayOfYear - startDayOfYear;

    // Calculate days remaining in start year + days in end year
    const daysInYear = this.#getDaysInYear(calendar);
    return daysInYear - startDayOfYear + endDayOfYear + (yearDiff - 1) * daysInYear;
  }

  /**
   * Get total days in a year for the calendar.
   *
   * @param {Object} calendar - The active calendar
   * @returns {number} Total days in year
   * @private
   */
  static #getDaysInYear(calendar) {
    let total = 0;
    const months = calendar.months?.values || calendar.months || [];
    for (const month of months) total += month?.days || 30;
    return total || 365;
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
    const sunrise = typeof calendar.sunrise === 'function' ? calendar.sunrise() : null;
    const sunset = typeof calendar.sunset === 'function' ? calendar.sunset() : null;
    return { midnight: 0, sunrise: sunrise, midday: 12, sunset: sunset };
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
    return { worldTime: game.time.worldTime, components: components, calendar: calendar };
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

    // Execute global macro for this threshold
    this.#executeThresholdMacro(thresholdName, data);
  }

  /**
   * Get time components for a specific world time.
   *
   * @param {number} worldTime - World time in seconds
   * @returns {Object} Time components
   * @private
   */
  static #getComponentsForTime(worldTime) {
    const calendar = CalendarManager.getActiveCalendar();
    if (calendar) return calendar.timeToComponents(worldTime);
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
      dayOfYear += month?.days || 30;
    }
    // Add days in current month
    dayOfYear += components.dayOfMonth;
    return dayOfYear;
  }

  /* -------------------------------------------- */
  /*  Moon Phase Tracking                         */
  /* -------------------------------------------- */

  /**
   * Get the current moon phase indices for all moons.
   *
   * @returns {Map<number, number>|null} Map of moonIndex -> phaseIndex, or null if no calendar
   * @private
   */
  static #getCurrentMoonPhases() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.moons?.length) return null;

    const phases = new Map();
    for (let i = 0; i < calendar.moons.length; i++) {
      const moon = calendar.moons[i];
      const phaseData = calendar.getMoonPhase?.(i);
      if (phaseData?.phaseIndex !== undefined) phases.set(i, phaseData.phaseIndex);
    }
    return phases.size > 0 ? phases : null;
  }

  /**
   * Check for moon phase changes and fire hooks/macros.
   *
   * @param {Object} calendar - The active calendar
   * @private
   */
  static #checkMoonPhaseChanges(calendar) {
    if (!calendar?.moons?.length) return;
    if (!this.#lastMoonPhases) return;

    const currentPhases = this.#getCurrentMoonPhases();
    if (!currentPhases) return;

    const changedMoons = [];

    for (const [moonIndex, currentPhaseIndex] of currentPhases) {
      const lastPhaseIndex = this.#lastMoonPhases.get(moonIndex);
      if (lastPhaseIndex !== undefined && lastPhaseIndex !== currentPhaseIndex) {
        const moon = calendar.moons[moonIndex];
        const previousPhase = moon.phases?.[lastPhaseIndex];
        const currentPhase = moon.phases?.[currentPhaseIndex];

        changedMoons.push({
          moonIndex,
          moonName: moon.name ? game.i18n.localize(moon.name) : `Moon ${moonIndex + 1}`,
          previousPhaseIndex: lastPhaseIndex,
          previousPhaseName: previousPhase?.name ? game.i18n.localize(previousPhase.name) : null,
          currentPhaseIndex,
          currentPhaseName: currentPhase?.name ? game.i18n.localize(currentPhase.name) : null
        });
      }
    }

    if (changedMoons.length > 0) {
      log(3, `Moon phase changed for ${changedMoons.length} moon(s)`);

      // Fire hook with all changed moons
      Hooks.callAll(HOOKS.MOON_PHASE_CHANGE, { moons: changedMoons, calendar, worldTime: game.time.worldTime });

      // Execute moon phase macros from config
      this.#executeMoonPhaseMacros(changedMoons);
    }
  }

  /* -------------------------------------------- */
  /*  Global Macro Execution                      */
  /* -------------------------------------------- */

  /**
   * Get the macro trigger configuration.
   *
   * @returns {Object} The macro trigger config
   * @private
   */
  static #getMacroConfig() {
    return game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS) || { global: {}, moonPhase: [] };
  }

  /**
   * Execute a global trigger macro if configured.
   *
   * @param {string} triggerKey - The trigger key (dawn, dusk, midday, midnight, newDay, seasonChange)
   * @param {Object} context - Context data to pass to the macro
   * @private
   */
  static #executeGlobalTrigger(triggerKey, context) {
    // Only GM should execute macros
    if (!game.user.isGM) return;

    const config = this.#getMacroConfig();
    const macroId = config.global?.[triggerKey];
    if (!macroId) return;

    executeMacroById(macroId, context);
  }

  /**
   * Execute the appropriate macro for a threshold crossing.
   *
   * @param {string} thresholdName - Name of the threshold (midnight, sunrise, midday, sunset)
   * @param {Object} data - Event data
   * @private
   */
  static #executeThresholdMacro(thresholdName, data) {
    // Map threshold names to config keys
    const keyMap = { midnight: 'midnight', sunrise: 'dawn', midday: 'midday', sunset: 'dusk' };
    const triggerKey = keyMap[thresholdName];
    if (!triggerKey) return;
    this.#executeGlobalTrigger(triggerKey, { trigger: thresholdName, ...data });
  }

  /**
   * Execute the appropriate macro for a period change.
   *
   * @param {string} periodName - Name of the period (day, season)
   * @param {Object} data - Event data
   * @private
   */
  static #executePeriodMacro(periodName, data) {
    if (periodName === 'day') this.#executeGlobalTrigger('newDay', { trigger: 'newDay', ...data });
    else if (periodName === 'season') this.#executeSeasonMacros(data);
  }

  /**
   * Execute macros for season changes based on config.
   *
   * @param {Object} data - Season change event data
   * @private
   */
  static #executeSeasonMacros(data) {
    // Only GM should execute macros
    if (!game.user.isGM) return;

    const config = this.#getMacroConfig();
    const seasonTriggers = config.season || [];

    if (!seasonTriggers.length) return;

    // Get the new season index from the data
    const currentSeasonIndex = data.currentComponents?.season;
    if (currentSeasonIndex === undefined) return;

    // Find matching triggers: -1 means "all seasons", otherwise match specific
    const matchingTriggers = seasonTriggers.filter((t) => t.seasonIndex === -1 || t.seasonIndex === currentSeasonIndex);

    for (const trigger of matchingTriggers) executeMacroById(trigger.macroId, { trigger: 'seasonChange', ...data });
  }

  /**
   * Execute macros for moon phase changes based on config.
   *
   * @param {Array} changedMoons - Array of moon phase change data
   * @private
   */
  static #executeMoonPhaseMacros(changedMoons) {
    // Only GM should execute macros
    if (!game.user.isGM) return;

    const config = this.#getMacroConfig();
    const moonTriggers = config.moonPhase || [];

    if (!moonTriggers.length) return;

    for (const changed of changedMoons) {
      // Find matching triggers:
      // -1 moonIndex means "all moons", -1 phaseIndex means "all phases"
      const matchingTriggers = moonTriggers.filter((t) => {
        const moonMatches = t.moonIndex === -1 || t.moonIndex === changed.moonIndex;
        const phaseMatches = t.phaseIndex === -1 || t.phaseIndex === changed.currentPhaseIndex;
        return moonMatches && phaseMatches;
      });

      for (const trigger of matchingTriggers) executeMacroById(trigger.macroId, { trigger: 'moonPhaseChange', moon: changed });
    }
  }
}
