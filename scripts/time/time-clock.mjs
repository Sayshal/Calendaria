/**
 * TimeClock - Real-time clock controller for Calendaria.
 * @module Time/TimeClock
 * @author Tyler
 */

import { HOOKS, MODULE, SETTINGS, SOCKET_TYPES } from '../constants.mjs';
import { updateDarknessFromWorldTime } from '../time/darkness.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { canChangeDateTime } from '../utils/permissions.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';
import EventScheduler from './event-scheduler.mjs';
import ReminderScheduler from './reminder-scheduler.mjs';
import TimeTracker from './time-tracker.mjs';

/**
 * Get calendar-aware time increment presets in seconds.
 * @returns {Object<string, number>} Time increment presets
 */
export function getTimeIncrements() {
  const cal = game.time?.calendar;
  const days = cal?.days ?? {};
  const seasons = cal?.seasonsArray ?? [];
  const secsPerMinute = days.secondsPerMinute ?? 60;
  const minutesPerHour = days.minutesPerHour ?? 60;
  const hoursPerDay = days.hoursPerDay ?? 24;
  const daysPerYear = days.daysPerYear ?? 365;
  const secsPerHour = secsPerMinute * minutesPerHour;
  const secsPerDay = secsPerHour * hoursPerDay;
  const monthDays = cal?.monthsArray?.[0]?.days ?? Math.floor(daysPerYear / 12);
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
  /** @type {number|null} Interval ID for the 60s advance tick */
  static #advanceIntervalId = null;

  /** @type {number|null} Interval ID for the 1s visual tick */
  static #visualIntervalId = null;

  /** @type {number} Game seconds accumulated since last advance */
  static #accumulatedSeconds = 0;

  /** @type {boolean} Guard against re-entrant day-boundary flush */
  static #flushing = false;

  /** @type {boolean} Whether the clock is currently running */
  static #running = false;

  /** @type {boolean} Whether the clock is locked (prevents all time advancement) */
  static #locked = false;

  /** @type {number} Time increment in seconds per tick (for manual advancement) */
  static #increment = 60;

  /** @type {string} Current increment key (for manual advancement) */
  static #incrementKey = 'minute';

  /** @type {number} Real-time clock speed (game seconds per real second, from settings) */
  static #realTimeSpeed = 1;

  /** @type {Map<string, {incrementKey: string, multiplier: number}>} Per-app settings */
  static #appSettings = new Map();

  /**
   * Whether the clock is running.
   * @returns {boolean} True if running
   */
  static get running() {
    return this.#running;
  }

  /**
   * Whether the clock is locked.
   * @returns {boolean} True if locked
   */
  static get locked() {
    return this.#locked;
  }

  /**
   * Toggle the clock lock state. When locked, all time advancement is blocked.
   */
  static async toggleLock() {
    this.#locked = !this.#locked;
    if (this.#locked && this.#running) this.stop();
    await game.settings.set(MODULE.ID, SETTINGS.CLOCK_LOCKED, this.#locked);
    ui.notifications.info(this.#locked ? 'CALENDARIA.TimeClock.Locked' : 'CALENDARIA.TimeClock.Unlocked', { localize: true });
    Hooks.callAll(HOOKS.CLOCK_START_STOP, { running: this.#running, increment: this.#increment, locked: this.#locked });
    log(3, `Clock lock ${this.#locked ? 'engaged' : 'released'}`);
  }

  /**
   * Current time increment in seconds (for manual advancement).
   * @returns {number} Increment in seconds
   */
  static get increment() {
    return this.#increment;
  }

  /**
   * Current increment key (for manual advancement).
   * @returns {string} Increment key
   */
  static get incrementKey() {
    return this.#incrementKey;
  }

  /**
   * Real-time clock speed (game seconds per real second).
   * @returns {number} Speed multiplier
   */
  static get realTimeSpeed() {
    return this.#realTimeSpeed;
  }

  /**
   * Predicted world time including accumulated seconds for UI display.
   * @returns {number} Predicted world time in seconds
   */
  static get predictedWorldTime() {
    return game.time.worldTime + this.#accumulatedSeconds;
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
    this.#locked = game.settings.get(MODULE.ID, SETTINGS.CLOCK_LOCKED) ?? false;
    this.loadSpeedFromSettings();
    Hooks.on(HOOKS.CLOCK_UPDATE, this.#onRemoteClockUpdate.bind(this));
    Hooks.on('updateWorldTime', (_worldTime, delta) => {
      this.#accumulatedSeconds = Math.max(0, this.#accumulatedSeconds - Math.abs(delta));
    });
    Hooks.on('pauseGame', this.#onPauseGame.bind(this));
    Hooks.on('combatStart', this.#onCombatStart.bind(this));
    Hooks.on('deleteCombat', this.#onCombatEnd.bind(this));
    this.#autoStartIfSynced();
    log(3, 'TimeClock initialized');
  }

  /**
   * Auto-start clock if sync enabled and game unpaused.
   */
  static #autoStartIfSynced() {
    if (!CalendariaSocket.isPrimaryGM()) return;
    if (!game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE)) return;
    if (this.#locked || game.paused || game.combat?.started) return;
    this.start();
    log(3, 'Clock auto-started (sync enabled, game unpaused)');
  }

  /**
   * Load real-time clock speed from settings.
   */
  static loadSpeedFromSettings() {
    const multiplier = game.settings.get(MODULE.ID, SETTINGS.TIME_SPEED_MULTIPLIER) || 1;
    const incrementKey = game.settings.get(MODULE.ID, SETTINGS.TIME_SPEED_INCREMENT) || 'second';
    const increments = getTimeIncrements();
    const incrementSeconds = increments[incrementKey] || 1;
    this.#realTimeSpeed = multiplier * incrementSeconds;
    log(3, `TimeClock real-time speed set to: ${this.#realTimeSpeed} game seconds per real second (${multiplier} ${incrementKey}s)`);
    if (this.#running) {
      this.#stopIntervals();
      this.#startIntervals();
    }
  }

  /**
   * Handle game pause/unpause to sync clock state.
   * @param {boolean} paused - Whether the game is paused
   */
  static #onPauseGame(paused) {
    if (!game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE)) return;
    if (!CalendariaSocket.isPrimaryGM()) return;
    if (paused) {
      if (this.#running) this.stop();
      log(3, 'Clock stopped: game paused');
    } else if (!game.combat?.started && !this.#locked) {
      if (!this.#running) this.start();
      log(3, 'Clock started at configured speed (game unpaused)');
    }
  }

  /**
   * Handle combat start to pause clock.
   * @param {object} _combat - The combat that started
   */
  static #onCombatStart(_combat) {
    if (!CalendariaSocket.isPrimaryGM()) return;
    if (this.#running) {
      this.stop();
      log(3, 'Clock stopped: combat started');
    }
  }

  /**
   * Handle combat end to resume clock.
   * @param {object} _combat - The combat that ended
   */
  static #onCombatEnd(_combat) {
    if (!CalendariaSocket.isPrimaryGM()) return;
    if (!game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE)) return;
    if (!this.#locked && !game.paused && !this.#running) {
      this.start();
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
    if (this.#locked) {
      log(3, 'Clock start blocked: locked');
      return;
    }
    if (!this.canAdjustTime()) {
      ui.notifications.warn('CALENDARIA.TimeClock.NoPermission', { localize: true });
      return;
    }
    if (game.combat?.started) {
      log(3, 'Clock start blocked: combat active');
      ui.notifications.clear();
      ui.notifications.warn('CALENDARIA.TimeClock.ClockBlocked', { localize: true });
      return;
    }
    if (game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE) && game.paused) {
      log(3, 'Clock start blocked: game paused');
      ui.notifications.clear();
      ui.notifications.warn('CALENDARIA.TimeClock.ClockBlocked', { localize: true });
      return;
    }
    this.#running = true;
    this.#accumulatedSeconds = 0;
    this.#startIntervals();
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
    this.#flushAccumulated();
    this.#stopIntervals();
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
  }

  /**
   * Set multiplier for a specific application.
   * @param {string} appId - Application identifier
   * @param {number} multiplier - Multiplier value (0.25 to 10)
   */
  static setAppMultiplier(appId, multiplier) {
    const settings = this.getAppSettings(appId);
    settings.multiplier = Math.max(0.25, Math.min(10, multiplier));
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
    if (this.#running) await this.#flushAccumulated();
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
    if (this.#running) await this.#flushAccumulated();
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
    if (this.#running) await this.#flushAccumulated();
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
    if (this.#running) await this.#flushAccumulated();
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
    if (this.#running) await this.#flushAccumulated();
    await game.time.advance(seconds);
    log(3, `Time advanced by ${seconds}s`);
  }

  /**
   * Advance interval period in milliseconds (from setting, default 60s).
   * @returns {number} Interval in milliseconds
   */
  static get ADVANCE_INTERVAL_MS() {
    return (game.settings?.get(MODULE.ID, SETTINGS.TIME_ADVANCE_INTERVAL) ?? 60) * 1000;
  }

  /**
   * Restart advance/visual intervals (e.g. after changing advance interval setting).
   */
  static restartIntervals() {
    if (!this.#running) return;
    this.#stopIntervals();
    this.#startIntervals();
  }

  /**
   * Start the visual tick and advance intervals.
   * @private
   */
  static #startIntervals() {
    if (this.#visualIntervalId) return;
    const speed = this.#realTimeSpeed;
    const intervalMs = this.ADVANCE_INTERVAL_MS;
    const directMode = intervalMs <= 1000;
    log(3, `TimeClock intervals started (speed: ${speed}, advance every ${intervalMs / 1000}s, direct: ${directMode})`);
    if (directMode) {
      let advancing = false;
      this.#visualIntervalId = setInterval(async () => {
        if (!this.#running || game.combat?.started || advancing) return;
        advancing = true;
        try {
          if (CalendariaSocket.isPrimaryGM()) await game.time.advance(speed);
          Hooks.callAll(HOOKS.VISUAL_TICK, { predictedWorldTime: game.time.worldTime });
        } finally {
          advancing = false;
        }
      }, 1000);
      return;
    }
    this.#visualIntervalId = setInterval(() => {
      if (!this.#running || game.combat?.started) return;
      this.#accumulatedSeconds += speed;
      const predicted = this.predictedWorldTime;
      Hooks.callAll(HOOKS.VISUAL_TICK, { predictedWorldTime: predicted });
      if (!this.#flushing && CalendariaSocket.isPrimaryGM() && this.#accumulatedSeconds > 0) {
        const cal = game.time?.calendar;
        if (cal) {
          const committed = cal.timeToComponents(game.time.worldTime);
          const pred = cal.timeToComponents(predicted);
          if (committed.dayOfMonth !== pred.dayOfMonth || committed.month !== pred.month || committed.year !== pred.year) {
            this.#flushing = true;
            const toAdvance = this.#accumulatedSeconds;
            this.#accumulatedSeconds = 0;
            game.time.advance(toAdvance).finally(() => {
              this.#flushing = false;
            });
          }
        }
      }
    }, 1000);
    this.#advanceIntervalId = setInterval(async () => {
      if (!this.#running || game.combat?.started) return;
      if (!CalendariaSocket.isPrimaryGM()) return;
      const toAdvance = this.#accumulatedSeconds;
      if (toAdvance <= 0) return;
      await game.time.advance(toAdvance);
    }, intervalMs);
  }

  /**
   * Stop both intervals and reset accumulated seconds.
   * @private
   */
  static #stopIntervals() {
    if (this.#visualIntervalId) {
      clearInterval(this.#visualIntervalId);
      this.#visualIntervalId = null;
    }
    if (this.#advanceIntervalId) {
      clearInterval(this.#advanceIntervalId);
      this.#advanceIntervalId = null;
    }
    this.#accumulatedSeconds = 0;
  }

  /**
   * Flush any accumulated seconds as a final advance before stopping.
   * @private
   */
  static async #flushAccumulated() {
    if (this.#accumulatedSeconds <= 0) return;
    if (!CalendariaSocket.isPrimaryGM()) return;
    const toAdvance = this.#accumulatedSeconds;
    this.#accumulatedSeconds = 0;
    await game.time.advance(toAdvance);
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
      this.#accumulatedSeconds = 0;
      this.#startIntervals();
      Hooks.callAll(HOOKS.CLOCK_START_STOP, { running: true, increment: this.#increment });
    } else if (!running && this.#running) {
      this.#running = false;
      this.#stopIntervals();
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
    const monthData = cal.monthsArray?.[components.month];
    const monthNameRaw = monthData?.name ?? `Month ${components.month + 1}`;
    const monthName = localize(monthNameRaw);
    const day = components.dayOfMonth + 1;
    const yearZero = cal.years?.yearZero ?? 0;
    const year = components.year + yearZero;
    return `${day} ${monthName}, ${year}`;
  }

  /**
   * Block combat round/turn time advancement when the clock is locked.
   * @param {object} _combat - The combat document
   * @param {object} _updateData - The update data
   * @param {object} updateOptions - The update options containing worldTime delta
   */
  static onCombatTimeBlock(_combat, _updateData, updateOptions) {
    if (TimeClock.locked && updateOptions.worldTime) updateOptions.worldTime.delta = 0;
  }

  /**
   * Unified updateWorldTime handler — dispatches to all time subsystems.
   * @param {number} worldTime - The new world time
   * @param {number} dt - The delta time in seconds
   */
  static async onUpdateWorldTime(worldTime, dt) {
    EventScheduler.onUpdateWorldTime(worldTime, dt);
    await updateDarknessFromWorldTime(worldTime, dt);
    ReminderScheduler.onUpdateWorldTime(worldTime, dt);
    TimeTracker.onUpdateWorldTime(worldTime, dt);
    Hooks.callAll(HOOKS.WORLD_TIME_UPDATED, worldTime, dt);
  }
}
