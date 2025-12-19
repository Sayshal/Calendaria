/**
 * TimeKeeper - Real-time clock controller for Calendaria.
 * Manages automatic time advancement with configurable intervals and increments.
 *
 * @module Time/TimeKeeper
 * @author Tyler
 */

import { MODULE, HOOKS } from '../constants.mjs';
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

  // Base time units from calendar (defaults for 24h day)
  const secondsPerMinute = days.secondsPerMinute ?? 60;
  const minutesPerHour = days.minutesPerHour ?? 60;
  const hoursPerDay = days.hoursPerDay ?? 24;
  const daysPerYear = days.daysPerYear ?? 365;

  // Calculate derived values
  const secondsPerHour = secondsPerMinute * minutesPerHour;
  const secondsPerDay = secondsPerHour * hoursPerDay;

  // Average days per month (use first month's days or estimate from year)
  const monthDays = cal?.months?.values?.[0]?.days ?? Math.floor(daysPerYear / 12);
  const secondsPerMonth = secondsPerDay * monthDays;

  // Average days per season (use first season's duration or estimate from year)
  const seasonDays = seasons[0]?.duration ?? Math.floor(daysPerYear / 4);
  const secondsPerSeason = secondsPerDay * seasonDays;

  const secondsPerYear = secondsPerDay * daysPerYear;

  return { second: 1, round: 6, minute: secondsPerMinute, hour: secondsPerHour, day: secondsPerDay, week: secondsPerDay * 7, month: secondsPerMonth, season: secondsPerSeason, year: secondsPerYear };
}

/**
 * Real-time clock controller for advancing game time automatically.
 */
export default class TimeKeeper {
  /** @type {number|null} Interval ID for the clock tick */
  static #intervalId = null;

  /** @type {boolean} Whether the clock is currently running */
  static #running = false;

  /** @type {number} Time increment in seconds per tick */
  static #increment = 60;

  /** @type {number} Real-time interval in seconds between ticks */
  static #updateFrequency = 1;

  /** @type {number} Game-time to real-time ratio (game seconds per real second) */
  static #gameTimeRatio = 1;

  /** @type {string} Current increment key */
  static #incrementKey = 'minute';

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

  /** @returns {number} Update frequency in seconds */
  static get updateFrequency() {
    return this.#updateFrequency;
  }

  /** @returns {number} Game-time to real-time ratio */
  static get gameTimeRatio() {
    return this.#gameTimeRatio;
  }

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Initialize the TimeKeeper and register socket listeners.
   */
  static initialize() {
    log(3, 'Initializing TimeKeeper...');

    // Listen for remote clock updates
    Hooks.on(HOOKS.CLOCK_UPDATE, this.#onRemoteClockUpdate.bind(this));

    log(3, 'TimeKeeper initialized');
  }

  /* -------------------------------------------- */
  /*  Clock Control                               */
  /* -------------------------------------------- */

  /**
   * Start the real-time clock.
   * @param {Object} [options] - Start options
   * @param {boolean} [options.broadcast=true] - Whether to broadcast to other clients
   */
  static start({ broadcast = true } = {}) {
    if (this.#running) return;

    if (!game.user.isGM) {
      ui.notifications.warn('CALENDARIA.TimeKeeper.GMOnly', { localize: true });
      return;
    }

    this.#running = true;
    this.#startInterval();

    log(3, `TimeKeeper started: ${this.#incrementKey} (ratio: ${this.#gameTimeRatio}x, every ${this.#updateFrequency}s)`);

    Hooks.callAll(HOOKS.CLOCK_START_STOP, { running: true, increment: this.#increment });

    if (broadcast && CalendariaSocket.isPrimaryGM()) CalendariaSocket.emitClockUpdate(true, this.#increment);
  }

  /**
   * Stop the real-time clock.
   * @param {Object} [options] - Stop options
   * @param {boolean} [options.broadcast=true] - Whether to broadcast to other clients
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
    if (!increments[key]) {
      log(2, `Invalid increment key: ${key}`);
      return;
    }

    this.#incrementKey = key;
    this.#increment = increments[key];
    // Game time ratio = how many game seconds pass per real second
    this.#gameTimeRatio = increments[key];

    log(3, `TimeKeeper increment set to: ${key} (ratio: ${this.#gameTimeRatio})`);

    // Restart interval if running to apply new ratio
    if (this.#running) {
      this.#stopInterval();
      this.#startInterval();
    }
  }

  /**
   * Set the update frequency (real-time seconds between advances).
   * @param {number} seconds - Interval in seconds (min 1)
   */
  static setUpdateFrequency(seconds) {
    this.#updateFrequency = Math.max(1, seconds);

    log(3, `TimeKeeper update frequency set to: ${this.#updateFrequency}s`);

    // Restart interval if running
    if (this.#running) {
      this.#stopInterval();
      this.#startInterval();
    }
  }

  /* -------------------------------------------- */
  /*  Manual Time Control                         */
  /* -------------------------------------------- */

  /**
   * Advance time by the current increment.
   * @param {number} [multiplier=1] - Multiplier for the increment
   */
  static async forward(multiplier = 1) {
    if (!game.user.isGM) return;
    const amount = this.#increment * multiplier;
    await game.time.advance(amount);
    log(3, `Time advanced by ${amount}s (${multiplier}x)`);
  }

  /**
   * Reverse time by the current increment.
   * @param {number} [multiplier=1] - Multiplier for the increment
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
   * Start the clock interval.
   * @private
   */
  static #startInterval() {
    if (this.#intervalId) return;

    // Interval runs every updateFrequency seconds, advances by gameTimeRatio * updateFrequency
    this.#intervalId = setInterval(async () => {
      if (!this.#running) return;
      if (!game.user.isGM) return;

      const advanceAmount = this.#gameTimeRatio * this.#updateFrequency;
      await game.time.advance(advanceAmount);
    }, this.#updateFrequency * 1000);
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
   * @param {Object} data - Clock update data
   * @param {boolean} data.running - Whether clock is running
   * @param {number} data.ratio - Time increment
   * @private
   */
  static #onRemoteClockUpdate({ running, ratio }) {
    log(3, `Remote clock update: running=${running}, ratio=${ratio}`);

    // Find matching increment key from calendar-aware increments
    const increments = getTimeIncrements();
    const key = Object.entries(increments).find(([, v]) => v === ratio)?.[0];
    if (key) {
      this.#incrementKey = key;
      this.#increment = ratio;
    }

    // Sync running state without broadcasting back
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
    const monthName = game.i18n.localize(monthNameRaw);
    const day = components.dayOfMonth + 1;
    const yearZero = cal.year?.yearZero ?? 0;
    const year = components.year + yearZero;

    return `${day} ${monthName}, ${year}`;
  }
}
