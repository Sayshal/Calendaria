/**
 * TimeKeeper - Real-time clock controller for Calendaria.
 * Manages automatic time advancement with configurable intervals and increments.
 * @module Time/TimeKeeper
 * @author Tyler
 */

import { HOOKS, MODULE, SETTINGS } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
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
export default class TimeKeeper {
  /** @type {number|null} Interval ID for the clock tick */
  static #intervalId = null;

  /** @type {boolean} Whether the clock is currently running */
  static #running = false;

  /** @type {number} Time increment in seconds per tick (for real-time clock) */
  static #increment = 60;

  /** @type {number} Game-time to real-time ratio (game seconds per real second) */
  static #gameTimeRatio = 1;

  /** @type {string} Current increment key (for real-time clock) */
  static #incrementKey = 'minute';

  /** @type {number} Multiplier for time advancement (for real-time clock) */
  static #multiplier = 1;

  /** @type {Map<string, {incrementKey: string, multiplier: number}>} Per-app settings */
  static #appSettings = new Map();

  /* -------------------------------------------- */
  /*  Getters                                     */
  /* -------------------------------------------- */

  /** @returns {boolean} Whether the clock is running */
  static get running() {
    return this.#running;
  }

  /** @returns {number} Current time increment in seconds */
  static get increment() {
    return this.#increment;
  }

  /** @returns {string} Current increment key */
  static get incrementKey() {
    return this.#incrementKey;
  }

  /** @returns {number} Game-time to real-time ratio */
  static get gameTimeRatio() {
    return this.#gameTimeRatio;
  }

  /** @returns {number} Current multiplier */
  static get multiplier() {
    return this.#multiplier;
  }

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /** @type {boolean} Whether the clock was running before game pause */
  static #wasRunningBeforePause = false;

  /**
   * Initialize the TimeKeeper and register socket listeners.
   */
  static initialize() {
    this.setIncrement('minute');
    Hooks.on(HOOKS.CLOCK_UPDATE, this.#onRemoteClockUpdate.bind(this));
    Hooks.on('pauseGame', this.#onPauseGame.bind(this));
    log(3, 'TimeKeeper initialized');
  }

  /**
   * Handle game pause/unpause to sync clock state.
   * @param {boolean} paused - Whether the game is paused
   */
  static #onPauseGame(paused) {
    if (!game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE)) return;
    if (!game.user.isGM) return;

    if (paused && this.#running) {
      this.#wasRunningBeforePause = true;
      this.stop();
      log(3, 'Clock paused (synced with game pause)');
    } else if (!paused && this.#wasRunningBeforePause) {
      this.#wasRunningBeforePause = false;
      this.start();
      log(3, 'Clock resumed (synced with game unpause)');
    }
  }

  /* -------------------------------------------- */
  /*  Clock Control                               */
  /* -------------------------------------------- */

  /**
   * Start the real-time clock.
   * @param {object} [options] - Start options
   * @param {boolean} [options.broadcast] - Whether to broadcast to other clients
   */
  static start({ broadcast = true } = {}) {
    if (this.#running) return;
    if (!game.user.isGM) {
      ui.notifications.warn('CALENDARIA.TimeKeeper.GMOnly', { localize: true });
      return;
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
    log(3, 'TimeKeeper stopped');
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

  /* -------------------------------------------- */
  /*  Time Increment                              */
  /* -------------------------------------------- */

  /**
   * Set the time increment.
   * @param {string} key - Increment key from getTimeIncrements()
   */
  static setIncrement(key) {
    const increments = getTimeIncrements();
    if (!increments[key]) return;
    this.#incrementKey = key;
    this.#increment = increments[key];
    this.#gameTimeRatio = increments[key];
    log(3, `TimeKeeper increment set to: ${key} (ratio: ${this.#gameTimeRatio})`);

    if (this.#running) {
      this.#stopInterval();
      this.#startInterval();
    }
  }

  /**
   * Set the time multiplier.
   * @param {number} multiplier - Multiplier value (0.25 to 10)
   */
  static setMultiplier(multiplier) {
    this.#multiplier = Math.max(0.25, Math.min(10, multiplier));
    log(3, `TimeKeeper multiplier set to: ${this.#multiplier}x`);

    if (this.#running) {
      this.#stopInterval();
      this.#startInterval();
    }
  }

  /* -------------------------------------------- */
  /*  Per-App Settings                            */
  /* -------------------------------------------- */

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
    log(3, `TimeKeeper[${appId}] increment set to: ${key}`);
  }

  /**
   * Set multiplier for a specific application.
   * @param {string} appId - Application identifier
   * @param {number} multiplier - Multiplier value (0.25 to 10)
   */
  static setAppMultiplier(appId, multiplier) {
    const settings = this.getAppSettings(appId);
    settings.multiplier = Math.max(0.25, Math.min(10, multiplier));
    log(3, `TimeKeeper[${appId}] multiplier set to: ${settings.multiplier}x`);
  }

  /**
   * Advance time using a specific application's settings.
   * @param {string} appId - Application identifier
   */
  static async forwardFor(appId) {
    if (!game.user.isGM) return;
    const settings = this.getAppSettings(appId);
    const increments = getTimeIncrements();
    const increment = increments[settings.incrementKey] ?? 60;
    const amount = increment * settings.multiplier;
    await game.time.advance(amount);
    log(3, `Time advanced by ${amount}s for ${appId}`);
  }

  /**
   * Reverse time using a specific application's settings.
   * @param {string} appId - Application identifier
   */
  static async reverseFor(appId) {
    if (!game.user.isGM) return;
    const settings = this.getAppSettings(appId);
    const increments = getTimeIncrements();
    const increment = increments[settings.incrementKey] ?? 60;
    const amount = increment * settings.multiplier;
    await game.time.advance(-amount);
    log(3, `Time reversed by ${amount}s for ${appId}`);
  }

  /* -------------------------------------------- */
  /*  Manual Time Control                         */
  /* -------------------------------------------- */

  /**
   * Advance time by the current increment.
   * @param {number} [multiplier] - Multiplier for the increment
   */
  static async forward(multiplier = 1) {
    if (!game.user.isGM) return;
    const amount = this.#increment * multiplier;
    await game.time.advance(amount);
    log(3, `Time advanced by ${amount}s (${multiplier}x)`);
  }

  /**
   * Reverse time by the current increment.
   * @param {number} [multiplier] - Multiplier for the increment
   */
  static async reverse(multiplier = 1) {
    if (!game.user.isGM) return;
    const amount = this.#increment * multiplier;
    await game.time.advance(-amount);
    log(3, `Time reversed by ${amount}s (${multiplier}x)`);
  }

  /**
   * Advance time by a specific amount.
   * @param {number} seconds - Seconds to advance (negative to reverse)
   */
  static async advance(seconds) {
    if (!game.user.isGM) return;
    await game.time.advance(seconds);
    log(3, `Time advanced by ${seconds}s`);
  }

  /* -------------------------------------------- */
  /*  Private Methods                             */
  /* -------------------------------------------- */

  /**
   * Get the smooth animation unit based on current increment.
   * Smaller increments use seconds, larger use hours/days/months.
   * @returns {number} Smooth unit in seconds
   * @private
   */
  static #getSmoothUnit() {
    const increments = getTimeIncrements();
    switch (this.#incrementKey) {
      case 'second':
      case 'round':
      case 'minute':
        return 1;
      case 'hour':
        return increments.minute;
      case 'day':
        return increments.hour;
      case 'week':
      case 'month':
        return increments.day;
      case 'season':
      case 'year':
        return increments.month;
      default:
        return 1;
    }
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
    const targetRate = this.#gameTimeRatio * this.#multiplier;
    const idealUpdatesPerSec = targetRate / smoothUnit;
    const idealInterval = 1000 / idealUpdatesPerSec;
    const intervalMs = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, idealInterval));
    const actualUpdatesPerSec = 1000 / intervalMs;
    const advanceAmount = targetRate / actualUpdatesPerSec;
    log(3, `TimeKeeper interval: ${intervalMs.toFixed(0)}ms, advance: ${advanceAmount.toFixed(1)}s`);
    this.#intervalId = setInterval(async () => {
      if (!this.#running) return;
      if (!game.user.isGM) return;
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

  /* -------------------------------------------- */
  /*  Time Display                                */
  /* -------------------------------------------- */

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
    const yearZero = cal.year?.yearZero ?? 0;
    const year = components.year + yearZero;
    return `${day} ${monthName}, ${year}`;
  }
}
