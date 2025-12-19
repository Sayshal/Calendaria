/**
 * Socket communication manager for Calendaria multiplayer synchronization.
 *
 * This module provides real-time synchronization between all connected clients for:
 * - Calendar switches (when GM changes the active calendar)
 * - Date/time changes (when world time advances)
 * - Note updates (when calendar notes are created/updated/deleted)
 * - Clock state changes (for real-time clock start/stop)
 *
 * ## Architecture
 *
 * The socket system uses a "Primary GM" pattern to prevent race conditions:
 * - Only the primary GM broadcasts authoritative updates
 * - Other clients receive and apply these updates locally
 * - Primary GM is determined by lowest user ID among active GMs (or manual override)
 *
 * ## Usage
 *
 * ```javascript
 * // Initialize during module setup (called automatically)
 * CalendariaSocket.initialize();
 *
 * // Emit a calendar switch to all clients
 * CalendariaSocket.emitCalendarSwitch('gregorian');
 *
 * // Emit a note update to all clients
 * CalendariaSocket.emitNoteUpdate('created', noteStub);
 *
 * // Check if current user should broadcast
 * if (CalendariaSocket.isPrimaryGM()) {
 *   CalendariaSocket.emitDateChange(worldTime, delta);
 * }
 * ```
 *
 * ## Hooks Fired
 *
 * The socket system fires these hooks for other modules to respond:
 * - `calendaria.remoteDateChange` - When time changes from another client
 * - `calendaria.remoteCalendarSwitch` - When calendar switches from another client
 *
 * @module Socket
 * @author Tyler
 */

import { MODULE, SETTINGS, SYSTEM, SOCKET_TYPES, HOOKS } from '../constants.mjs';
import { log } from './logger.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import NoteManager from '../notes/note-manager.mjs';
import WeatherManager from '../weather/weather-manager.mjs';

/**
 * Socket manager for handling multiplayer synchronization.
 * Manages socket communication and determines the primary GM for authoritative updates.
 *
 * @example
 * // Listen for remote date changes
 * Hooks.on('calendaria.remoteDateChange', (data) => {
 *   console.log(`Time changed to ${data.worldTime}`);
 * });
 *
 * @example
 * // Broadcast a calendar switch (GM only)
 * if (game.user.isGM) {
 *   CalendariaSocket.emitCalendarSwitch('exandrian');
 * }
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

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Initialize the socket system and register message handlers.
   * Called automatically during module initialization.
   *
   * @returns {void}
   */
  static initialize() {
    game.socket.on(`module.${MODULE.ID}`, this.#onMessage.bind(this));
    log(3, 'Socket system initialized');
  }

  /* -------------------------------------------- */
  /*  Emit Methods                                */
  /* -------------------------------------------- */

  /**
   * Emit a raw socket message to all connected clients.
   * Prefer using the typed emit methods (emitCalendarSwitch, emitNoteUpdate, etc.)
   * for better type safety and validation.
   *
   * @param {string} type - The message type from CalendariaSocket.TYPES
   * @param {Object} data - The data payload to send
   * @returns {void}
   */
  static emit(type, data) {
    game.socket.emit(`module.${MODULE.ID}`, { type, data });
    log(3, `Socket message emitted: ${type}`, data);
  }

  /**
   * Emit a calendar switch message to all connected clients.
   * Should only be called by GM when switching the active calendar.
   *
   * @param {string} calendarId - The ID of the calendar to switch to
   * @returns {void}
   *
   * @example
   * // Switch all clients to the Exandrian calendar
   * CalendariaSocket.emitCalendarSwitch('exandrian');
   */
  static emitCalendarSwitch(calendarId) {
    if (!game.user.isGM) {
      log(2, 'Only GM can emit calendar switch');
      return;
    }

    this.emit(SOCKET_TYPES.CALENDAR_SWITCH, { calendarId });
  }

  /**
   * Emit a date/time change message to all connected clients.
   * Should only be called by primary GM to prevent duplicate broadcasts.
   *
   * @param {number} worldTime - The new world time in seconds
   * @param {number} delta - The time delta in seconds
   * @returns {void}
   *
   * @example
   * // Broadcast time advancement
   * if (CalendariaSocket.isPrimaryGM()) {
   *   CalendariaSocket.emitDateChange(game.time.worldTime, 3600);
   * }
   */
  static emitDateChange(worldTime, delta) {
    if (!this.isPrimaryGM()) {
      log(3, 'Skipping date change emit - not primary GM');
      return;
    }

    this.emit(SOCKET_TYPES.DATE_CHANGE, { worldTime, delta });
  }

  /**
   * Emit a note update message to all connected clients.
   * Broadcasts note create/update/delete operations for real-time sync.
   *
   * @param {'created'|'updated'|'deleted'} action - The type of note operation
   * @param {Object} noteData - The note data (stub for created/updated, id for deleted)
   * @param {string} noteData.id - The journal page ID
   * @param {string} [noteData.name] - The note name (for created/updated)
   * @param {Object} [noteData.flagData] - The note's calendar data (for created/updated)
   * @returns {void}
   *
   * @example
   * // Broadcast a new note
   * CalendariaSocket.emitNoteUpdate('created', {
   *   id: page.id,
   *   name: page.name,
   *   flagData: page.system
   * });
   *
   * @example
   * // Broadcast a note deletion
   * CalendariaSocket.emitNoteUpdate('deleted', { id: pageId });
   */
  static emitNoteUpdate(action, noteData) {
    if (!game.user.isGM) {
      log(2, 'Only GM can emit note updates');
      return;
    }

    this.emit(SOCKET_TYPES.NOTE_UPDATE, { action, ...noteData });
  }

  /**
   * Emit a clock state update to all connected clients.
   * Used for real-time clock synchronization (start/stop/pause).
   *
   * @param {boolean} running - Whether the real-time clock is running
   * @param {number} [ratio=1] - The real-time to game-time ratio
   * @returns {void}
   *
   * @example
   * // Start the clock for all clients
   * CalendariaSocket.emitClockUpdate(true, 60); // 1 minute real = 1 hour game
   */
  static emitClockUpdate(running, ratio = 1) {
    if (!this.isPrimaryGM()) {
      log(3, 'Skipping clock update emit - not primary GM');
      return;
    }

    this.emit(SOCKET_TYPES.CLOCK_UPDATE, { running, ratio });
  }

  /* -------------------------------------------- */
  /*  Message Router                              */
  /* -------------------------------------------- */

  /**
   * Handle incoming socket messages and route to appropriate handlers.
   * @private
   *
   * @param {Object} message - The incoming socket message
   * @param {string} message.type - The message type
   * @param {Object} message.data - The message data payload
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

      default:
        log(1, `Unknown socket message type: ${type}`);
    }
  }

  /* -------------------------------------------- */
  /*  Message Handlers                            */
  /* -------------------------------------------- */

  /**
   * Handle remote calendar switch messages.
   * Updates the local calendar registry to match the remote switch.
   * @private
   *
   * @param {Object} data - The calendar switch data
   * @param {string} data.calendarId - The ID of the calendar to switch to
   * @returns {void}
   */
  static #handleCalendarSwitch(data) {
    const { calendarId } = data;
    if (!calendarId) {
      log(2, 'Invalid calendar switch data - missing calendarId');
      return;
    }

    log(3, `Handling remote calendar switch to: ${calendarId}`);
    CalendarManager.handleRemoteSwitch(calendarId);
  }

  /**
   * Handle remote date/time change messages.
   * Re-renders the calendar HUD to reflect the new time.
   * @private
   *
   * @param {Object} data - The date change data
   * @param {number} data.worldTime - The new world time in seconds
   * @param {number} data.delta - The time delta in seconds
   * @returns {void}
   */
  static #handleDateChange(data) {
    log(3, 'Handling remote date change', data);

    // Re-render the calendar HUD if it exists (dnd5e only)
    if (SYSTEM.isDnd5e && dnd5e.ui.calendar) dnd5e.ui.calendar.render();

    // Emit hook for other systems to respond
    Hooks.callAll(HOOKS.REMOTE_DATE_CHANGE, data);
  }

  /**
   * Handle remote note update messages.
   * Triggers index rebuild to reflect remote note changes.
   * @private
   *
   * @param {Object} data - The note update data
   * @param {'created'|'updated'|'deleted'} data.action - The type of operation
   * @param {string} data.id - The journal page ID
   * @param {string} [data.name] - The note name
   * @param {Object} [data.flagData] - The note's calendar data
   * @returns {void}
   */
  static #handleNoteUpdate(data) {
    const { action, id } = data;

    if (!action || !id) {
      log(2, 'Invalid note update data - missing action or id');
      return;
    }

    log(3, `Handling remote note ${action}: ${id}`);

    // The NoteManager already listens to Foundry's document hooks
    // which fire for all clients when documents change.
    // This socket message is primarily for:
    // 1. Triggering immediate UI updates on remote clients
    // 2. Future use cases where we need to sync data not stored in documents

    // Re-render any open calendar applications
    for (const app of foundry.applications.instances.values()) if (app.constructor.name === 'CalendarApplication') app.render();

    // Re-render dnd5e calendar HUD if present
    if (SYSTEM.isDnd5e && dnd5e.ui.calendar) dnd5e.ui.calendar.render();

    // Emit appropriate hook based on action
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
   * Syncs the real-time clock state across all clients.
   * @private
   *
   * @param {Object} data - The clock update data
   * @param {boolean} data.running - Whether the clock is running
   * @param {number} data.ratio - The real-time to game-time ratio
   * @returns {void}
   */
  static #handleClockUpdate(data) {
    const { running, ratio } = data;

    log(3, `Handling remote clock update: running=${running}, ratio=${ratio}`);

    // Emit hook for TimeKeeper or other modules to respond
    Hooks.callAll('calendaria.clockUpdate', { running, ratio });
  }

  /**
   * Handle remote weather change messages.
   * Syncs the weather state across all clients.
   * @private
   *
   * @param {Object} data - The weather change data
   * @param {Object} data.weather - The new weather state
   * @returns {void}
   */
  static #handleWeatherChange(data) {
    const { weather } = data;
    log(3, `Handling remote weather change: ${weather?.id ?? 'cleared'}`);
    WeatherManager.handleRemoteWeatherChange(data);
  }

  /* -------------------------------------------- */
  /*  Primary GM Election                         */
  /* -------------------------------------------- */

  /**
   * Determine if the current user is the primary GM.
   *
   * The primary GM is responsible for authoritative updates to prevent race conditions
   * when multiple GMs are connected. Only the primary GM should broadcast time changes
   * and other authoritative updates.
   *
   * ## Election Method
   *
   * 1. First checks the `primaryGM` setting for a manual override
   * 2. If not set, automatically selects the active GM with the lowest user ID
   *
   * @returns {boolean} True if the current user is the primary GM
   *
   * @example
   * // Only broadcast if we're the primary GM
   * if (CalendariaSocket.isPrimaryGM()) {
   *   CalendariaSocket.emitDateChange(worldTime, delta);
   * }
   *
   * @example
   * // Check primary GM status for UI display
   * const statusText = CalendariaSocket.isPrimaryGM()
   *   ? 'Primary GM (broadcasting)'
   *   : 'Secondary GM (receiving)';
   */
  static isPrimaryGM() {
    // Non-GMs are never primary
    if (!game.user.isGM) return false;

    // Check for manual override setting
    const primaryGMOverride = game.settings.get(MODULE.ID, SETTINGS.PRIMARY_GM);

    if (primaryGMOverride) return primaryGMOverride === game.user.id;

    // Fallback to automatic election: lowest user ID among active GMs
    const activeGMs = game.users.filter((u) => u.isGM && u.active);

    if (activeGMs.length === 0) {
      log(2, 'No active GMs found for primary GM election');
      return false;
    }

    const primaryGM = activeGMs.sort((a, b) => a.id.localeCompare(b.id))[0];
    const isPrimary = primaryGM.id === game.user.id;

    log(3, `Primary GM check (automatic): ${isPrimary} (primary: ${primaryGM.name}, current: ${game.user.name})`);

    return isPrimary;
  }

  /**
   * Get the current primary GM user.
   * Useful for displaying which GM is currently authoritative.
   *
   * @returns {User|null} The primary GM user, or null if none active
   *
   * @example
   * // Display primary GM in settings
   * const primary = CalendariaSocket.getPrimaryGM();
   * console.log(`Primary GM: ${primary?.name ?? 'None'}`);
   */
  static getPrimaryGM() {
    // Check for manual override
    const primaryGMOverride = game.settings.get(MODULE.ID, SETTINGS.PRIMARY_GM);
    if (primaryGMOverride) return game.users.get(primaryGMOverride) ?? null;

    // Automatic election
    const activeGMs = game.users.filter((u) => u.isGM && u.active);
    if (activeGMs.length === 0) return null;

    return activeGMs.sort((a, b) => a.id.localeCompare(b.id))[0];
  }
}
