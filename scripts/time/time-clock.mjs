/**
 * TimeClock - Real-time clock controller for Calendaria.
 * Manages automatic time advancement with configurable intervals and increments.
 * @module Time/TimeClock
 * @author Tyler
 */

import { HOOKS, MODULE, SETTINGS, SOCKET_TYPES } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { canChangeDateTime } from '../utils/permissions.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';

/**
 * Get calendar-aware time increment presets in seconds.
 * Values for day, week, month, and year are calculated from the active calendar.
 * @returns {Object<string, number>} Time increment presets
 */
export function getTimeIncrements() {
  const cal = game.time?.calendar;
  const days = cal?.days ?? {};
  const seasons = cal?.seasons?.values ?? [];
  const secsPerMinute = days.secondsPerMinute ?? 60;
  const minutesPerHour = days.minutesPerHour ?? 60;
  const hoursPerDay = days.hoursPerDay ?? 24;
  const daysPerYear = days.daysPerYear ?? 365;
  const secsPerHour = secsPerMinute * minutesPerHour;
  const secsPerDay = secsPerHour * hoursPerDay;
  const monthDays = cal?.months?.values?.[0]?.days ?? Math.floor(daysPerYear / 12);
  const secsPerMonth = secsPerDay * monthDays;
  const seasonDays = seasons[0]?.duration ?? Math.floor(daysPerYear / 4);
  const secsPerSeason = secsPerDay * seasonDays;
  const secsPerYear = secsPerDay * daysPerYear;
  const secsPerRound = cal?.secondsPerRound ?? 6;
  return { second: 1, round: secsPerRound, minute: secsPerMinute, hour: secsPerHour, day: secsPerDay, week: secsPerDay * 7, month: secsPerMonth, season: secsPerSeason, year: secsPerYear };
}

/**
 * Real-time clock controller for advancing game time automatically.
 */
export default class TimeClock {
  /** @type {number|null} Interval ID for the clock tick */
  static #intervalId = null;

  /** @type {boolean} Whether the clock is currently running */
  static #running = false;

  /** @type {number} Time increment in seconds per tick (for manual advancement) */
  static #increment = 60;

  /** @type {string} Current increment key (for manual advancement) */
  static #incrementKey = 'minute';

  /** @type {number} Real-time clock speed (game seconds per real second, from settings) */
  static #realTimeSpeed = 1;

  /** @type {Map<string, {incrementKey: string, multiplier: number}>} Per-app settings */
  static #appSettings = new Map();

  /** @returns {boolean} Whether the clock is running */
  static get running() {
    return this.#running;
  }

  /** @returns {number} Current time increment in seconds (for manual advancement) */
  static get increment() {
    return this.#increment;
  }

  /** @returns {string} Current increment key (for manual advancement) */
  static get incrementKey() {
    return this.#incrementKey;
  }

  /** @returns {number} Real-time clock speed (game seconds per real second) */
  static get realTimeSpeed() {
    return this.#realTimeSpeed;
  }

  /**
   * Check if the current user can adjust time.
   * @returns {boolean} True if user has permission to adjust time
   */
  static canAdjustTime() {
    return canChangeDateTime();
  }

  /**
   * Initialize the TimeClock and register socket listeners.
   */
  static initialize() {
    this.setIncrement('minute');
    this.loadSpeedFromSettings();
    Hooks.on(HOOKS.CLOCK_UPDATE, this.#onRemoteClockUpdate.bind(this));
    Hooks.on('pauseGame', this.#onPauseGame.bind(this));
    Hooks.on('combatStart', this.#onCombatStart.bind(this));
    Hooks.on('deleteCombat', this.#onCombatEnd.bind(this));
    this.#autoStartIfSynced();
    log(3, 'TimeClock initialized');
  }

  /**
   * Auto-start clock if sync enabled and game unpaused.
   * Called during initialization (which happens on ready).
   */
  static #autoStartIfSynced() {
    if (!CalendariaSocket.isPrimaryGM()) return;
    if (!game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE)) return;
    if (game.paused || game.combat?.started) return;
    this.start();
    log(3, 'Clock auto-started (sync enabled, game unpaused)');
  }

  /**
   * Load real-time clock speed from settings.
   * Called on init and when settings change.
   */
  static loadSpeedFromSettings() {
    const multiplier = game.settings.get(MODULE.ID, SETTINGS.TIME_SPEED_MULTIPLIER) || 1;
    const incrementKey = game.settings.get(MODULE.ID, SETTINGS.TIME_SPEED_INCREMENT) || 'second';
    const increments = getTimeIncrements();
    const incrementSeconds = increments[incrementKey] || 1;
    this.#realTimeSpeed = multiplier * incrementSeconds;
    log(3, `TimeClock real-time speed set to: ${this.#realTimeSpeed} game seconds per real second (${multiplier} ${incrementKey}s)`);

    // Restart interval if running to apply new speed
    if (this.#running) {
      this.#stopInterval();
      this.#startInterval();
    }
  }

  /**
   * Handle game pause/unpause to sync clock state.
   * When sync is enabled, clock resumes at settings-configured speed on unpause.
   * @param {boolean} paused - Whether the game is paused
   */
  static #onPauseGame(paused) {
    if (!game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE)) return;
    if (!CalendariaSocket.isPrimaryGM()) return;

    if (paused) {
      if (this.#running) this.stop();
      log(3, 'Clock stopped (game paused)');
    } else if (!game.combat?.started) {
      if (!this.#running) this.start();
      log(3, 'Clock started at configured speed (game unpaused)');
    }
  }

  /**
   * Handle combat start to pause clock.
   * @param {object} _combat - The combat that started
   */
  static #onCombatStart(_combat) {
    if (!game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE)) return;
    if (!CalendariaSocket.isPrimaryGM()) return;

    if (this.#running) {
      this.stop();
      log(3, 'Clock stopped (combat started)');
    }
  }

  /**
   * Handle combat end to resume clock.
   * @param {object} _combat - The combat that ended
   */
  static #onCombatEnd(_combat) {
    if (!game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE)) return;
    if (!CalendariaSocket.isPrimaryGM()) return;

    if (!game.paused) {
      if (!this.#running) this.start();
      log(3, 'Clock started at configured speed (combat ended)');
    }
  }

  /**
   * Start the real-time clock.
   * @param {object} [options] - Start options
   * @param {boolean} [options.broadcast] - Whether to broadcast to other clients
   */
  static start({ broadcast = true } = {}) {
    if (this.#running) return;
    if (!this.canAdjustTime()) {
      ui.notifications.warn('CALENDARIA.TimeClock.NoPermission', { localize: true });
      return;
    }

    // When sync is enabled, prevent start if game is paused or combat is active
    if (game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE)) {
      if (game.paused || game.combat?.started) {
        log(3, 'Clock start blocked (sync active, game paused or in combat)');
        ui.notifications.clear();
        ui.notifications.warn('CALENDARIA.TimeClock.ClockBlocked', { localize: true });
        return;
      }
    }

    this.#running = true;
    this.#startInterval();
    Hooks.callAll(HOOKS.CLOCK_START_STOP, { running: true, increment: this.#increment });
    if (broadcast && CalendariaSocket.isPrimaryGM()) CalendariaSocket.emitClockUpdate(true, this.#increment);
  }

  /**
   * Stop the real-time clock.
   * @param {object} [options] - Stop options
   * @param {boolean} [options.broadcast] - Whether to broadcast to other clients
   */
  static stop({ broadcast = true } = {}) {
    if (!this.#running) return;
    this.#running = false;
    this.#stopInterval();
    log(3, 'TimeClock stopped');
    Hooks.callAll(HOOKS.CLOCK_START_STOP, { running: false, increment: this.#increment });
    if (broadcast && CalendariaSocket.isPrimaryGM()) CalendariaSocket.emitClockUpdate(false, this.#increment);
  }

  /**
   * Toggle the clock running state.
   */
  static toggle() {
    if (this.#running) this.stop();
    else this.start();
  }

  /**
   * Set the time increment for manual advancement.
   * Does not affect real-time clock speed (controlled by settings).
   * @param {string} key - Increment key from getTimeIncrements()
   */
  static setIncrement(key) {
    const increments = getTimeIncrements();
    if (!increments[key]) return;
    this.#incrementKey = key;
    this.#increment = increments[key];
    log(3, `TimeClock manual increment set to: ${key} (${this.#increment}s)`);
  }

  /**
   * Get settings for a specific application.
   * @param {string} appId - Application identifier
   * @returns {{incrementKey: string, multiplier: number}} - Application settings
   */
  static getAppSettings(appId) {
    if (!this.#appSettings.has(appId)) this.#appSettings.set(appId, { incrementKey: 'minute', multiplier: 1 });
    return this.#appSettings.get(appId);
  }

  /**
   * Set increment for a specific application.
   * @param {string} appId - Application identifier
   * @param {string} key - Increment key from getTimeIncrements()
   */
  static setAppIncrement(appId, key) {
    const increments = getTimeIncrements();
    if (!increments[key]) {
      log(2, `Invalid increment key: ${key}`);
      return;
    }
    const settings = this.getAppSettings(appId);
    settings.incrementKey = key;
    log(3, `TimeClock[${appId}] increment set to: ${key}`);
  }

  /**
   * Set multiplier for a specific application.
   * @param {string} appId - Application identifier
   * @param {number} multiplier - Multiplier value (0.25 to 10)
   */
  static setAppMultiplier(appId, multiplier) {
    const settings = this.getAppSettings(appId);
    settings.multiplier = Math.max(0.25, Math.min(10, multiplier));
    log(3, `TimeClock[${appId}] multiplier set to: ${settings.multiplier}x`);
  }

  /**
   * Advance time using a specific application's settings.
   * @param {string} appId - Application identifier
   */
  static async forwardFor(appId) {
    if (!this.canAdjustTime()) return;
    const settings = this.getAppSettings(appId);
    const increments = getTimeIncrements();
    const increment = increments[settings.incrementKey] ?? 60;
    const amount = increment * settings.multiplier;
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: amount });
      return;
    }
    await game.time.advance(amount);
    log(3, `Time advanced by ${amount}s for ${appId}`);
  }

  /**
   * Reverse time using a specific application's settings.
   * @param {string} appId - Application identifier
   */
  static async reverseFor(appId) {
    if (!this.canAdjustTime()) return;
    const settings = this.getAppSettings(appId);
    const increments = getTimeIncrements();
    const increment = increments[settings.incrementKey] ?? 60;
    const amount = increment * settings.multiplier;
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: -amount });
      return;
    }
    await game.time.advance(-amount);
    log(3, `Time reversed by ${amount}s for ${appId}`);
  }

  /**
   * Advance time by the current increment.
   * @param {number} [multiplier] - Multiplier for the increment
   */
  static async forward(multiplier = 1) {
    if (!this.canAdjustTime()) return;
    const amount = this.#increment * multiplier;
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: amount });
      return;
    }
    await game.time.advance(amount);
    log(3, `Time advanced by ${amount}s (${multiplier}x)`);
  }

  /**
   * Reverse time by the current increment.
   * @param {number} [multiplier] - Multiplier for the increment
   */
  static async reverse(multiplier = 1) {
    if (!this.canAdjustTime()) return;
    const amount = this.#increment * multiplier;
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: -amount });
      return;
    }
    await game.time.advance(-amount);
    log(3, `Time reversed by ${amount}s (${multiplier}x)`);
  }

  /**
   * Advance time by a specific amount.
   * @param {number} seconds - Seconds to advance (negative to reverse)
   */
  static async advance(seconds) {
    if (!this.canAdjustTime()) return;
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: seconds });
      return;
    }
    await game.time.advance(seconds);
    log(3, `Time advanced by ${seconds}s`);
  }

  /**
   * Get the smooth animation unit based on real-time speed.
   * Smaller speeds use seconds, larger use hours/days/months.
   * @returns {number} Smooth unit in seconds
   * @private
   */
  static #getSmoothUnit() {
    const increments = getTimeIncrements();
    const speed = this.#realTimeSpeed;

    // Choose smooth unit based on speed magnitude
    if (speed <= increments.minute) return 1;
    if (speed <= increments.hour) return increments.minute;
    if (speed <= increments.day) return increments.hour;
    if (speed <= increments.week) return increments.day;
    return increments.day;
  }

  /**
   * Start the clock interval.
   * Uses smooth units for animation while maintaining correct time rate.
   * @private
   */
  static #startInterval() {
    if (this.#intervalId) return;
    const MIN_INTERVAL = 50;
    const MAX_INTERVAL = 1000;
    const smoothUnit = this.#getSmoothUnit();
    const targetRate = this.#realTimeSpeed;
    const idealUpdatesPerSec = targetRate / smoothUnit;
    const idealInterval = 1000 / idealUpdatesPerSec;
    const intervalMs = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, idealInterval));
    const actualUpdatesPerSec = 1000 / intervalMs;
    const advanceAmount = targetRate / actualUpdatesPerSec;
    log(3, `TimeClock interval: ${intervalMs.toFixed(0)}ms, advance: ${advanceAmount.toFixed(1)}s (speed: ${targetRate})`);
    this.#intervalId = setInterval(async () => {
      if (!this.#running) return;
      if (!CalendariaSocket.isPrimaryGM()) return;
      await game.time.advance(advanceAmount);
    }, intervalMs);
  }

  /**
   * Stop the clock interval.
   * @private
   */
  static #stopInterval() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  /**
   * Handle remote clock update from socket.
   * @param {object} data - Clock update data
   * @param {boolean} data.running - Whether clock is running
   * @param {number} data.ratio - Time increment
   * @private
   */
  static #onRemoteClockUpdate({ running, ratio }) {
    log(3, `Remote clock update: running=${running}, ratio=${ratio}`);
    const increments = getTimeIncrements();
    const key = Object.entries(increments).find(([, v]) => v === ratio)?.[0];
    if (key) {
      this.#incrementKey = key;
      this.#increment = ratio;
    }

    if (running && !this.#running) {
      this.#running = true;
      this.#startInterval();
      Hooks.callAll(HOOKS.CLOCK_START_STOP, { running: true, increment: this.#increment });
    } else if (!running && this.#running) {
      this.#running = false;
      this.#stopInterval();
      Hooks.callAll(HOOKS.CLOCK_START_STOP, { running: false, increment: this.#increment });
    }
  }

  /**
   * Get the current time formatted as HH:MM:SS.
   * @returns {string} Formatted time string
   */
  static getFormattedTime() {
    const cal = game.time?.calendar;
    if (!cal) return '--:--:--';
    const components = cal.timeToComponents(game.time.worldTime);
    const h = String(components.hour ?? 0).padStart(2, '0');
    const m = String(components.minute ?? 0).padStart(2, '0');
    const s = String(components.second ?? 0).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  /**
   * Get the current date formatted.
   * @returns {string} Formatted date string
   */
  static getFormattedDate() {
    const cal = game.time?.calendar;
    if (!cal) return '';
    const components = cal.timeToComponents(game.time.worldTime);
    const monthData = cal.months?.values?.[components.month];
    const monthNameRaw = monthData?.name ?? `Month ${components.month + 1}`;
    const monthName = localize(monthNameRaw);
    const day = components.dayOfMonth + 1;
    const yearZero = cal.years?.yearZero ?? 0;
    const year = components.year + yearZero;
    return `${day} ${monthName}, ${year}`;
  }
}
