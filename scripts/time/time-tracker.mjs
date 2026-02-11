/**
 * Time Tracker
 * Monitors world time changes and fires hooks when specific time thresholds are crossed.
 * Fires hooks for: dateTimeChange, dayChange, monthChange, yearChange, seasonChange,
 * and time-of-day thresholds (sunrise, sunset, midnight, midday).
 * @module Time/TimeTracker
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SETTINGS } from '../constants.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { executeMacroById } from '../utils/macro-utils.mjs';
import WeatherManager from '../weather/weather-manager.mjs';

/**
 * Static class that tracks world time changes and fires threshold hooks.
 */
export default class TimeTracker {
  /** @type {number|null} Last known world time in seconds */
  static #lastWorldTime = null;

  /** @type {object | null} Last checked time components */
  static #lastComponents = null;

  /** @type {number|null} Last known season index */
  static #lastSeason = null;

  /** @type {Map<number, number>|null} Last known moon phases (moonIndex -> phaseIndex) */
  static #lastMoonPhases = null;

  /** @type {boolean|null} Last known rest day status */
  static #lastRestDay = null;

  /** @type {boolean} Flag to skip threshold/period hooks on next update (for timepoint jumps) */
  static #skipNextHooks = false;

  /**
   * Skip threshold and period hooks on the next time update.
   * Used when jumping to timepoints to prevent re-triggering events.
   */
  static skipNextHooks() {
    this.#skipNextHooks = true;
  }

  /**
   * Initialize the time tracker.
   * Called during module initialization.
   */
  static initialize() {
    this.#lastWorldTime = game.time.worldTime;
    this.#lastComponents = foundry.utils.deepClone(game.time.components);
    this.#lastSeason = game.time.components?.season ?? null;
    this.#lastMoonPhases = this.#getCurrentMoonPhases();
    this.#lastRestDay = this.#isCurrentDayRestDay();
    log(3, 'Time Tracker initialized');
  }

  /**
   * Handle world time updates.
   * Called by the updateWorldTime hook.
   * Fires dateTimeChange hook and checks for period/threshold crossings.
   * @param {number} worldTime - The new world time in seconds
   * @param {number} delta - The time delta in seconds
   */
  static onUpdateWorldTime(worldTime, delta) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return;
    const currentComponents = game.time.components;
    if (this.#lastWorldTime === null || this.#lastComponents === null) {
      this.#lastWorldTime = worldTime;
      this.#lastComponents = foundry.utils.deepClone(currentComponents);
      this.#lastSeason = currentComponents?.season ?? null;
      return;
    }

    if (this.#skipNextHooks) {
      this.#skipNextHooks = false;
      log(3, 'Skipping threshold/period hooks (timepoint jump)');
      this.#lastWorldTime = worldTime;
      this.#lastComponents = foundry.utils.deepClone(currentComponents);
      this.#lastSeason = currentComponents?.season ?? null;
      this.#lastMoonPhases = this.#getCurrentMoonPhases();
      this.#lastRestDay = this.#isCurrentDayRestDay();
      this.#fireDateTimeChangeHook(this.#lastComponents, currentComponents, delta, calendar);
      return;
    }

    this.#fireDateTimeChangeHook(this.#lastComponents, currentComponents, delta, calendar);
    this.#checkPeriodChanges(this.#lastComponents, currentComponents, calendar);
    this.#checkThresholds(this.#lastWorldTime, worldTime, calendar);
    this.#checkMoonPhaseChanges(calendar);
    this.#checkRestDayChange(calendar);
    this.#lastWorldTime = worldTime;
    this.#lastComponents = foundry.utils.deepClone(currentComponents);
    this.#lastSeason = currentComponents?.season ?? null;
    this.#lastMoonPhases = this.#getCurrentMoonPhases();
    this.#lastRestDay = this.#isCurrentDayRestDay();
  }

  /**
   * Fire the dateTimeChange hook with comprehensive time change data.
   * This is the primary hook other modules should listen to for time changes.
   * @param {object} previousComponents - Previous time components
   * @param {object} currentComponents - Current time components
   * @param {number} delta - Time delta in seconds
   * @param {object} calendar - Active calendar
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
   * @param {object} previousComponents - Previous time components
   * @param {object} currentComponents - Current time components
   * @param {object} calendar - Active calendar
   * @private
   */
  static #checkPeriodChanges(previousComponents, currentComponents, calendar) {
    const yearZero = calendar?.years?.yearZero ?? 0;
    const hookData = {
      previous: { ...previousComponents, year: previousComponents.year + yearZero },
      current: { ...currentComponents, year: currentComponents.year + yearZero },
      calendar: calendar
    };

    if (previousComponents.year !== currentComponents.year) {
      log(3, `Year changed: ${previousComponents.year + yearZero} -> ${currentComponents.year + yearZero}`);
      Hooks.callAll(HOOKS.YEAR_CHANGE, hookData);
    }

    if (previousComponents.month !== currentComponents.month) {
      log(3, `Month changed: ${previousComponents.month} -> ${currentComponents.month}`);
      Hooks.callAll(HOOKS.MONTH_CHANGE, hookData);
    }

    if (previousComponents.dayOfMonth !== currentComponents.dayOfMonth || previousComponents.month !== currentComponents.month || previousComponents.year !== currentComponents.year) {
      log(3, `Day changed`);
      Hooks.callAll(HOOKS.DAY_CHANGE, hookData);
      this.#executePeriodMacro('day', hookData);
    }

    const previousSeason = previousComponents.season ?? this.#lastSeason;
    const currentSeason = currentComponents.season;
    if (previousSeason !== null && currentSeason !== null && previousSeason !== currentSeason) {
      const seasonData = { ...hookData, previousSeason: calendar.seasonsArray?.[previousSeason] ?? null, currentSeason: calendar.seasonsArray?.[currentSeason] ?? null };
      log(3, `Season changed: ${previousSeason} -> ${currentSeason}`);
      Hooks.callAll(HOOKS.SEASON_CHANGE, seasonData);
      this.#executePeriodMacro('season', seasonData);
    }
  }

  /**
   * Check if any thresholds were crossed between two times.
   * @param {number} previousTime - Previous world time in seconds
   * @param {number} currentTime - Current world time in seconds
   * @param {object} calendar - The active calendar
   * @private
   */
  static #checkThresholds(previousTime, currentTime, calendar) {
    if (currentTime <= previousTime) {
      log(3, 'Time went backwards, skipping threshold checks');
      return;
    }

    const previousComponents = this.#getComponentsForTime(previousTime);
    const currentComponents = game.time.components;
    const thresholds = this.#getAllThresholdsCrossed(previousComponents, currentComponents, calendar);
    for (const threshold of thresholds) this.#fireThresholdHook(threshold.name, threshold.data);
  }

  /** @type {number} Maximum days to fire threshold hooks for (prevents hook spam on large advances) */
  static #MAX_THRESHOLD_DAYS = 30;

  /**
   * Get all thresholds crossed between two time points.
   * Limits threshold firing to MAX_THRESHOLD_DAYS to prevent hook spam on large time advances.
   * @param {object} startComponents - Starting time components
   * @param {object} endComponents - Ending time components
   * @param {object} calendar - The active calendar
   * @returns {Array} Array of crossed thresholds with {name, data}
   * @private
   */
  static #getAllThresholdsCrossed(startComponents, endComponents, calendar) {
    const thresholds = [];
    const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
    const secondsPerMinute = calendar?.days?.secondsPerMinute ?? 60;
    const secondsPerHour = minutesPerHour * secondsPerMinute;
    const startHour = startComponents.hour + startComponents.minute / minutesPerHour + (startComponents.second || 0) / secondsPerHour;
    const endHour = endComponents.hour + endComponents.minute / minutesPerHour + (endComponents.second || 0) / secondsPerHour;
    const totalDays = this.#calculateDaysBetween(startComponents, endComponents, calendar);

    if (totalDays === 0) {
      const dayThresholds = this.#getThresholdsForDay(endComponents, calendar);
      for (const [name, hour] of Object.entries(dayThresholds)) {
        if (hour !== null && startHour < hour && endHour >= hour) thresholds.push({ name, data: this.#createThresholdData(endComponents, calendar) });
      }
    } else {
      const dayThresholds = this.#getThresholdsForDay(startComponents, calendar);
      for (const [name, hour] of Object.entries(dayThresholds)) {
        if (hour !== null && startHour < hour) thresholds.push({ name, data: this.#createThresholdData(startComponents, calendar) });
      }

      // Cap intermediate days to prevent hook spam on large time advances
      const intermediateDays = Math.min(totalDays - 1, this.#MAX_THRESHOLD_DAYS);
      if (totalDays - 1 > this.#MAX_THRESHOLD_DAYS) {
        log(3, `Capping threshold hooks: ${totalDays - 1} intermediate days reduced to ${this.#MAX_THRESHOLD_DAYS}`);
      }
      for (let day = 0; day < intermediateDays; day++) {
        for (const [name, hour] of Object.entries(dayThresholds)) if (hour !== null) thresholds.push({ name, data: this.#createThresholdData(endComponents, calendar) });
      }

      const endDayThresholds = this.#getThresholdsForDay(endComponents, calendar);
      for (const [name, hour] of Object.entries(endDayThresholds)) if (hour !== null && endHour >= hour) thresholds.push({ name, data: this.#createThresholdData(endComponents, calendar) });
    }

    return thresholds;
  }

  /**
   * Calculate the number of day boundaries crossed between two time points.
   * @param {object} startComponents - Starting time components
   * @param {object} endComponents - Ending time components
   * @param {object} calendar - The active calendar
   * @returns {number} Number of day boundaries crossed
   * @private
   */
  static #calculateDaysBetween(startComponents, endComponents, calendar) {
    const startDayOfYear = this.#getDayOfYear(startComponents, calendar);
    const endDayOfYear = this.#getDayOfYear(endComponents, calendar);
    const yearDiff = endComponents.year - startComponents.year;
    if (yearDiff === 0) return endDayOfYear - startDayOfYear;
    const daysInYear = this.#getDaysInYear(calendar);
    return daysInYear - startDayOfYear + endDayOfYear + (yearDiff - 1) * daysInYear;
  }

  /**
   * Get total days in a year for the calendar.
   * @param {object} calendar - The active calendar
   * @returns {number} Total days in year
   * @private
   */
  static #getDaysInYear(calendar) {
    let total = 0;
    const months = calendar.monthsArray || [];
    for (const month of months) total += month?.days || 30;
    return total || 365;
  }

  /**
   * Get threshold times for a specific day.
   * @param {object} _components - Time components for the day
   * @param {object} calendar - The active calendar
   * @returns {object} Object with threshold names and their times in hours
   * @private
   */
  static #getThresholdsForDay(_components, calendar) {
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const sunrise = calendar.sunrise(undefined, zone);
    const sunset = calendar.sunset(undefined, zone);
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    return { midnight: 0, sunrise: sunrise, midday: hoursPerDay / 2, sunset: sunset };
  }

  /**
   * Create threshold event data.
   * @param {object} components - Time components
   * @param {object} calendar - The active calendar
   * @returns {object} Threshold event data
   * @private
   */
  static #createThresholdData(components, calendar) {
    return { worldTime: game.time.worldTime, components: components, calendar: calendar };
  }

  /**
   * Fire a threshold hook.
   * @param {string} thresholdName - Name of the threshold (midnight, sunrise, midday, sunset)
   * @param {object} data - Event data to pass to the hook
   * @private
   */
  static #fireThresholdHook(thresholdName, data) {
    const hookName = HOOKS[thresholdName.toUpperCase()];
    if (!hookName) return;
    log(3, `Threshold crossed: ${thresholdName}`);
    Hooks.callAll(hookName, data);
    this.#executeThresholdMacro(thresholdName, data);
  }

  /**
   * Get time components for a specific world time.
   * @param {number} worldTime - World time in seconds
   * @returns {object} Time components
   * @private
   */
  static #getComponentsForTime(worldTime) {
    const calendar = CalendarManager.getActiveCalendar();
    if (calendar) return calendar.timeToComponents(worldTime);
    return this.#lastComponents || game.time.components;
  }

  /**
   * Calculate day of year from components.
   * @param {object} components - Time components
   * @param {object} calendar - The active calendar
   * @returns {number} Day of year (0-based)
   * @private
   */
  static #getDayOfYear(components, calendar) {
    let dayOfYear = 0;
    for (let i = 0; i < components.month; i++) {
      const month = calendar.monthsArray?.[i];
      dayOfYear += month?.days || 30;
    }
    dayOfYear += components.dayOfMonth;
    return dayOfYear;
  }

  /**
   * Get the current moon phase indices for all moons.
   * @returns {Map<number, number>|null} Map of moonIndex -> phaseIndex, or null if no calendar
   * @private
   */
  static #getCurrentMoonPhases() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.moonsArray?.length) return null;
    const phases = new Map();
    for (let i = 0; i < calendar.moonsArray.length; i++) {
      const phaseData = calendar.getMoonPhase?.(i);
      if (phaseData?.phaseIndex !== undefined) phases.set(i, phaseData.phaseIndex);
    }
    return phases.size > 0 ? phases : null;
  }

  /**
   * Check for moon phase changes and fire hooks/macros.
   * @param {object} calendar - The active calendar
   * @private
   */
  static #checkMoonPhaseChanges(calendar) {
    if (!calendar?.moonsArray?.length) return;
    if (!this.#lastMoonPhases) return;
    const currentPhases = this.#getCurrentMoonPhases();
    if (!currentPhases) return;
    const changedMoons = [];

    for (const [moonIndex, currentPhaseIndex] of currentPhases) {
      const lastPhaseIndex = this.#lastMoonPhases.get(moonIndex);
      if (lastPhaseIndex !== undefined && lastPhaseIndex !== currentPhaseIndex) {
        const moon = calendar.moonsArray[moonIndex];
        const phasesArr = Object.values(moon.phases ?? {});
        const previousPhase = phasesArr[lastPhaseIndex];
        const currentPhase = phasesArr[currentPhaseIndex];
        changedMoons.push({
          moonIndex,
          moonName: moon.name ? localize(moon.name) : format('CALENDARIA.Calendar.MoonFallback', { num: moonIndex + 1 }),
          previousPhaseIndex: lastPhaseIndex,
          previousPhaseName: previousPhase?.name ? localize(previousPhase.name) : null,
          currentPhaseIndex,
          currentPhaseName: currentPhase?.name ? localize(currentPhase.name) : null
        });
      }
    }

    if (changedMoons.length > 0) {
      log(3, `Moon phase changed for ${changedMoons.length} moon(s)`);
      Hooks.callAll(HOOKS.MOON_PHASE_CHANGE, { moons: changedMoons, calendar, worldTime: game.time.worldTime });
      this.#executeMoonPhaseMacros(changedMoons);
    }
  }

  /**
   * Get the macro trigger configuration.
   * @returns {object} The macro trigger config
   * @private
   */
  static #getMacroConfig() {
    return game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS) || { global: {}, moonPhase: [] };
  }

  /**
   * Execute a global trigger macro if configured.
   * @param {string} triggerKey - The trigger key (dawn, dusk, midday, midnight, newDay, seasonChange)
   * @param {object} context - Context data to pass to the macro
   * @private
   */
  static #executeGlobalTrigger(triggerKey, context) {
    if (!game.user.isGM) return;
    const config = this.#getMacroConfig();
    const macroId = config.global?.[triggerKey];
    if (!macroId) return;
    executeMacroById(macroId, context);
  }

  /**
   * Execute the appropriate macro for a threshold crossing.
   * @param {string} thresholdName - Name of the threshold (midnight, sunrise, midday, sunset)
   * @param {object} data - Event data
   * @private
   */
  static #executeThresholdMacro(thresholdName, data) {
    const keyMap = { midnight: 'midnight', sunrise: 'dawn', midday: 'midday', sunset: 'dusk' };
    const triggerKey = keyMap[thresholdName];
    if (!triggerKey) return;
    this.#executeGlobalTrigger(triggerKey, { trigger: thresholdName, ...data });
  }

  /**
   * Execute the appropriate macro for a period change.
   * @param {string} periodName - Name of the period (day, season)
   * @param {object} data - Event data
   * @private
   */
  static #executePeriodMacro(periodName, data) {
    if (periodName === 'day') this.#executeGlobalTrigger('newDay', { trigger: 'newDay', ...data });
    else if (periodName === 'season') this.#executeSeasonMacros(data);
  }

  /**
   * Execute macros for season changes based on config.
   * @param {object} data - Season change event data
   * @private
   */
  static #executeSeasonMacros(data) {
    if (!game.user.isGM) return;
    const config = this.#getMacroConfig();
    const seasonTriggers = config.season || [];
    if (!seasonTriggers.length) return;
    const currentSeasonIndex = data.currentComponents?.season;
    if (currentSeasonIndex === undefined) return;
    const matchingTriggers = seasonTriggers.filter((t) => t.seasonIndex === -1 || t.seasonIndex === currentSeasonIndex);
    for (const trigger of matchingTriggers) executeMacroById(trigger.macroId, { trigger: 'seasonChange', ...data });
  }

  /**
   * Execute macros for moon phase changes based on config.
   * @param {Array} changedMoons - Array of moon phase change data
   * @private
   */
  static #executeMoonPhaseMacros(changedMoons) {
    if (!game.user.isGM) return;
    const config = this.#getMacroConfig();
    const moonTriggers = config.moonPhase || [];
    if (!moonTriggers.length) return;
    for (const changed of changedMoons) {
      const matchingTriggers = moonTriggers.filter((t) => {
        const moonMatches = t.moonIndex === -1 || t.moonIndex === changed.moonIndex;
        const phaseMatches = t.phaseIndex === -1 || t.phaseIndex === changed.currentPhaseIndex;
        return moonMatches && phaseMatches;
      });

      for (const trigger of matchingTriggers) executeMacroById(trigger.macroId, { trigger: 'moonPhaseChange', moon: changed });
    }
  }

  /**
   * Check if the current day is a rest day.
   * @returns {boolean} True if current day is a rest day
   * @private
   */
  static #isCurrentDayRestDay() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return false;
    const weekdayInfo = calendar.getWeekdayForDate?.();
    return weekdayInfo?.isRestDay || false;
  }

  /**
   * Check for rest day status change and fire hook if changed.
   * @param {object} calendar - The active calendar
   * @private
   */
  static #checkRestDayChange(calendar) {
    if (this.#lastRestDay === null) return;
    const currentRestDay = this.#isCurrentDayRestDay();
    if (this.#lastRestDay !== currentRestDay) {
      const weekdayInfo = calendar?.getWeekdayForDate?.();

      const hookData = {
        isRestDay: currentRestDay,
        wasRestDay: this.#lastRestDay,
        weekday: weekdayInfo ? { index: weekdayInfo.index, name: weekdayInfo.name || '', abbreviation: weekdayInfo.abbreviation || '' } : null,
        worldTime: game.time.worldTime,
        calendar
      };

      log(3, `Rest day status changed: ${this.#lastRestDay} -> ${currentRestDay}`);
      Hooks.callAll(HOOKS.REST_DAY_CHANGE, hookData);
    }
  }
}
