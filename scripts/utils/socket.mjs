/**
 * Socket communication manager for Calendaria multiplayer synchronization.
 * @module Socket
 * @author Tyler
 */

import { HUD } from '../applications/hud.mjs';
import { MiniCal } from '../applications/mini-cal.mjs';
import { TimeKeeper } from '../applications/time-keeper.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SETTINGS, SOCKET_TYPES } from '../constants.mjs';
import WeatherManager from '../weather/weather-manager.mjs';
import { log } from './logger.mjs';

/**
 * Socket manager for handling multiplayer synchronization.
 * Manages socket communication and determines the primary GM for authoritative updates.
 */
export class CalendariaSocket {
  /**
   * Socket message types for different sync operations.
   * @enum {string}
   * @readonly
   */
  static TYPES = {
    /** Clock start/stop state update */
    CLOCK_UPDATE: 'clockUpdate',
    /** World time change */
    DATE_CHANGE: 'dateChange',
    /** Calendar note CRUD operation */
    NOTE_UPDATE: 'noteUpdate',
    /** Active calendar change */
    CALENDAR_SWITCH: 'calendarSwitch'
  };

  /**
   * Initialize the socket system and register message handlers.
   * @returns {void}
   */
  static initialize() {
    game.socket.on(`module.${MODULE.ID}`, this.#onMessage.bind(this));
    log(3, 'Socket system initialized');
  }

  /**
   * Emit a raw socket message to all connected clients.
   * @param {string} type - The message type from CalendariaSocket.TYPES
   * @param {object} data - The data payload to send
   * @returns {void}
   */
  static emit(type, data) {
    game.socket.emit(`module.${MODULE.ID}`, { type, data });
    log(3, `Socket message emitted: ${type}`, data);
  }

  /**
   * Emit a calendar switch message to all connected clients.
   * @param {string} calendarId - The ID of the calendar to switch to
   * @returns {void}
   */
  static emitCalendarSwitch(calendarId) {
    if (!game.user.isGM) return;
    this.emit(SOCKET_TYPES.CALENDAR_SWITCH, { calendarId });
  }

  /**
   * Emit a date/time change message to all connected clients.
   * @param {number} worldTime - The new world time in seconds
   * @param {number} delta - The time delta in seconds
   * @returns {void}
   */
  static emitDateChange(worldTime, delta) {
    if (!this.isPrimaryGM()) return;
    this.emit(SOCKET_TYPES.DATE_CHANGE, { worldTime, delta });
  }

  /**
   * Emit a note update message to all connected clients.
   * @param {'created'|'updated'|'deleted'} action - The type of note operation
   * @param {object} noteData - The note data (stub for created/updated, id for deleted)
   * @param {string} noteData.id - The journal page ID
   * @param {string} [noteData.name] - The note name (for created/updated)
   * @param {object} [noteData.flagData] - The note's calendar data (for created/updated)
   * @returns {void}
   */
  static emitNoteUpdate(action, noteData) {
    if (!game.user.isGM) return;
    this.emit(SOCKET_TYPES.NOTE_UPDATE, { action, ...noteData });
  }

  /**
   * Emit a clock state update to all connected clients.
   * @param {boolean} running - Whether the real-time clock is running
   * @param {number} [ratio] - The real-time to game-time ratio
   * @returns {void}
   */
  static emitClockUpdate(running, ratio = 1) {
    if (!this.isPrimaryGM()) return;
    this.emit(SOCKET_TYPES.CLOCK_UPDATE, { running, ratio });
  }

  /**
   * Handle incoming socket messages and route to appropriate handlers.
   * @private
   * @param {object} message - The incoming socket message
   * @param {string} message.type - The message type
   * @param {object} message.data - The message data payload
   * @returns {void}
   */
  static #onMessage({ type, data }) {
    log(3, `Socket message received: ${type}`, data);

    switch (type) {
      case SOCKET_TYPES.CLOCK_UPDATE:
        this.#handleClockUpdate(data);
        break;
      case SOCKET_TYPES.DATE_CHANGE:
        this.#handleDateChange(data);
        break;
      case SOCKET_TYPES.NOTE_UPDATE:
        this.#handleNoteUpdate(data);
        break;
      case SOCKET_TYPES.CALENDAR_SWITCH:
        this.#handleCalendarSwitch(data);
        break;
      case SOCKET_TYPES.WEATHER_CHANGE:
        this.#handleWeatherChange(data);
        break;
      case SOCKET_TYPES.WEATHER_REQUEST:
        this.#handleWeatherRequest(data);
        break;
      case SOCKET_TYPES.TIME_REQUEST:
        this.#handleTimeRequest(data);
        break;
      case SOCKET_TYPES.CALENDAR_REQUEST:
        this.#handleCalendarRequest(data);
        break;
      case SOCKET_TYPES.REMINDER_NOTIFY:
        this.#handleReminderNotify(data);
        break;
      case SOCKET_TYPES.HUD_VISIBILITY:
        this.#handleHUDVisibility(data);
        break;
      case SOCKET_TYPES.MINI_CAL_VISIBILITY:
        this.#handleMiniCalVisibility(data);
        break;
      case SOCKET_TYPES.TIME_KEEPER_VISIBILITY:
        this.#handleTimeKeeperVisibility(data);
        break;
      default:
        log(1, `Unknown socket message type: ${type}`);
    }
  }

  /**
   * Handle remote calendar switch messages.
   * @private
   * @param {object} data - The calendar switch data
   * @param {string} data.calendarId - The ID of the calendar to switch to
   * @returns {void}
   */
  static #handleCalendarSwitch(data) {
    const { calendarId } = data;
    if (!calendarId) return;
    log(3, `Handling remote calendar switch to: ${calendarId}`);
    CalendarManager.handleRemoteSwitch(calendarId);
  }

  /**
   * Handle remote date/time change messages.
   * @private
   * @param {object} data - The date change data
   * @param {number} data.worldTime - The new world time in seconds
   * @param {number} data.delta - The time delta in seconds
   * @returns {void}
   */
  static #handleDateChange(data) {
    log(3, 'Handling remote date change', data);
    Hooks.callAll(HOOKS.REMOTE_DATE_CHANGE, data);
  }

  /**
   * Handle remote note update messages.
   * @private
   * @param {object} data - The note update data
   * @param {'created'|'updated'|'deleted'} data.action - The type of operation
   * @param {string} data.id - The journal page ID
   * @param {string} [data.name] - The note name
   * @param {object} [data.flagData] - The note's calendar data
   * @returns {void}
   */
  static #handleNoteUpdate(data) {
    const { action, id } = data;
    if (!action || !id) return;
    log(3, `Handling remote note ${action}: ${id}`);
    foundry.applications.instances.get('calendaria-big-cal')?.render();

    switch (action) {
      case 'created':
        Hooks.callAll(HOOKS.NOTE_CREATED, data);
        break;
      case 'updated':
        Hooks.callAll(HOOKS.NOTE_UPDATED, data);
        break;
      case 'deleted':
        Hooks.callAll(HOOKS.NOTE_DELETED, id);
        break;
    }
  }

  /**
   * Handle remote clock state update messages.
   * @private
   * @param {object} data - The clock update data
   * @param {boolean} data.running - Whether the clock is running
   * @param {number} data.ratio - The real-time to game-time ratio
   * @returns {void}
   */
  static #handleClockUpdate(data) {
    const { running, ratio } = data;
    log(3, `Handling remote clock update: running=${running}, ratio=${ratio}`);
    Hooks.callAll('calendaria.clockUpdate', { running, ratio });
  }

  /**
   * Handle remote weather change messages.
   * @private
   * @param {object} data - The weather change data
   * @param {object} data.weather - The new weather state
   * @returns {void}
   */
  static #handleWeatherChange(data) {
    const { weather } = data;
    log(3, `Handling remote weather change: ${weather?.id ?? 'cleared'}`);
    WeatherManager.handleRemoteWeatherChange(data);
  }

  /**
   * Handle weather change request from non-GM users.
   * @private
   * @param {object} data - The weather request data
   * @param {string} [data.action] - The action: 'set', 'generate', or 'clear'
   * @param {string} [data.presetId] - The preset ID (for 'set' action)
   * @param {object} [data.options] - Additional options
   * @returns {void}
   */
  static async #handleWeatherRequest(data) {
    if (!this.isPrimaryGM()) return;
    const { action, presetId, options = {} } = data;
    log(3, `Primary GM handling weather request: ${action}`, data);

    switch (action) {
      case 'set':
        await WeatherManager.setWeather(presetId, { ...options, fromSocket: true });
        break;
      case 'generate':
        await WeatherManager.generateAndSetWeather({ ...options, fromSocket: true });
        break;
      case 'clear':
        await WeatherManager.clearWeather(true, true);
        break;
    }
  }

  /**
   * Handle time change request from non-GM users.
   * @private
   * @param {object} data - The time request data
   * @param {string} data.action - The action: 'advance', 'set', or 'jump'
   * @param {number} [data.delta] - Time delta in seconds (for 'advance')
   * @param {object} [data.components] - Time components (for 'set')
   * @param {object} [data.date] - Date object (for 'jump')
   * @returns {void}
   */
  static async #handleTimeRequest(data) {
    if (!this.isPrimaryGM()) return;
    const { action, delta, components, date } = data;
    log(3, `Primary GM handling time request: ${action}`, data);

    switch (action) {
      case 'advance':
        await game.time.advance(delta);
        break;
      case 'set': {
        const calendar = CalendarManager.getActiveCalendar();
        if (!calendar) return;
        const currentComponents = game.time.components;
        const merged = { ...currentComponents, ...components };
        const targetSeconds = calendar.componentsToTime(merged);
        const timeDelta = targetSeconds - game.time.worldTime;
        await game.time.advance(timeDelta);
        break;
      }
      case 'jump': {
        const calendar = CalendarManager.getActiveCalendar();
        if (!calendar || !date) return;
        const current = game.time.components;
        const targetComponents = { ...current, year: date.year, month: date.month, dayOfMonth: date.day };
        const targetSeconds = calendar.componentsToTime(targetComponents);
        const timeDelta = targetSeconds - game.time.worldTime;
        await game.time.advance(timeDelta);
        break;
      }
    }
  }

  /**
   * Handle calendar switch request from non-GM users.
   * @private
   * @param {object} data - The calendar request data
   * @param {string} data.calendarId - The calendar ID to switch to
   * @returns {void}
   */
  static async #handleCalendarRequest(data) {
    if (!this.isPrimaryGM()) return;
    const { calendarId } = data;
    log(3, `Primary GM handling calendar switch request: ${calendarId}`);
    await CalendarManager.switchCalendar(calendarId);
  }

  /**
   * Handle remote reminder notification messages.
   * @private
   * @param {object} data - The reminder notification data
   * @returns {void}
   */
  static #handleReminderNotify(data) {
    log(3, `Handling reminder notification for ${data.noteName}`);
    Hooks.callAll(HOOKS.REMINDER_RECEIVED, data);
  }

  /**
   * Handle HUD visibility commands from GM.
   * @private
   * @param {object} data - The HUD visibility data
   * @param {boolean} data.visible - Whether HUD should be visible
   * @returns {void}
   */
  static #handleHUDVisibility(data) {
    if (game.user.isGM) return;
    const { visible } = data;
    log(3, `Handling HUD visibility: ${visible}`);
    if (visible) HUD.show();
    else HUD.hide();
  }

  /**
   * Handle MiniCal visibility commands from GM.
   * @private
   * @param {object} data - The MiniCal visibility data
   * @param {boolean} data.visible - Whether MiniCal should be visible
   * @returns {void}
   */
  static #handleMiniCalVisibility(data) {
    if (game.user.isGM) return;
    const { visible } = data;
    log(3, `Handling MiniCal visibility: ${visible}`);
    if (visible) MiniCal.show();
    else MiniCal.hide();
  }

  /**
   * Handle TimeKeeper visibility commands from GM.
   * @private
   * @param {object} data - The TimeKeeper visibility data
   * @param {boolean} data.visible - Whether TimeKeeper should be visible
   * @returns {void}
   */
  static #handleTimeKeeperVisibility(data) {
    if (game.user.isGM) return;
    const { visible } = data;
    log(3, `Handling TimeKeeper visibility: ${visible}`);
    if (visible) TimeKeeper.show();
    else TimeKeeper.hide();
  }

  /**
   * Determine if the current user is the primary GM.
   * @returns {boolean} True if the current user is the primary GM
   */
  static isPrimaryGM() {
    if (!game.user.isGM) return false;
    const primaryGMOverride = game.settings.get(MODULE.ID, SETTINGS.PRIMARY_GM);
    if (primaryGMOverride) return primaryGMOverride === game.user.id;
    const activeGMs = game.users.filter((u) => u.isGM && u.active);
    if (activeGMs.length === 0) return false;
    const primaryGM = activeGMs.sort((a, b) => a.id.localeCompare(b.id))[0];
    return primaryGM.id === game.user.id;
  }

  /**
   * Get the current primary GM user.
   * @returns {object|null} The primary GM user, or null if none active
   */
  static getPrimaryGM() {
    const primaryGMOverride = game.settings.get(MODULE.ID, SETTINGS.PRIMARY_GM);
    if (primaryGMOverride) return game.users.get(primaryGMOverride) ?? null;
    const activeGMs = game.users.filter((u) => u.isGM && u.active);
    if (activeGMs.length === 0) return null;
    return activeGMs.sort((a, b) => a.id.localeCompare(b.id))[0];
  }
}
