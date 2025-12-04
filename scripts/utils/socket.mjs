/**
 * Socket communication manager for Calendaria multiplayer synchronization.
 * Handles socket message routing and primary GM election for authoritative updates.
 *
 * @module Socket
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';
import { log } from './logger.mjs';

/**
 * Socket manager for handling multiplayer synchronization.
 * Manages socket communication and determines the primary GM for authoritative updates.
 */
export class CalendariaSocket {
  /**
   * Socket message types for different sync operations.
   * @enum {string}
   */
  static TYPES = {
    CLOCK_UPDATE: 'clockUpdate',
    DATE_CHANGE: 'dateChange',
    NOTE_UPDATE: 'noteUpdate',
    CALENDAR_SWITCH: 'calendarSwitch'
  };

  /**
   * Initialize the socket system and register message handlers.
   * Called during module initialization.
   */
  static initialize() {
    game.socket.on(`module.${MODULE.ID}`, this.#onMessage.bind(this));
    log(3, 'Socket system initialized');
  }

  /**
   * Emit a socket message to all connected clients.
   *
   * @param {string} type - The message type from CalendariaSocket.TYPES
   * @param {Object} data - The data payload to send
   */
  static emit(type, data) {
    game.socket.emit(`module.${MODULE.ID}`, { type, data });
    log(3, `Socket message emitted: ${type}`, data);
  }

  /**
   * Handle incoming socket messages and route to appropriate handlers.
   * @private
   *
   * @param {Object} message - The incoming socket message
   * @param {string} message.type - The message type
   * @param {Object} message.data - The message data payload
   */
  static #onMessage({ type, data }) {
    log(3, `Socket message received: ${type}`, data);

    switch (type) {
      case this.TYPES.CLOCK_UPDATE:
        // TODO: TimeKeeper.handleRemoteUpdate(data);
        log(2, 'CLOCK_UPDATE handler not yet implemented');
        break;
      case this.TYPES.DATE_CHANGE:
        // TODO: Handle remote date changes
        log(2, 'DATE_CHANGE handler not yet implemented');
        break;
      case this.TYPES.NOTE_UPDATE:
        // TODO: NoteManager.handleRemoteUpdate(data);
        log(2, 'NOTE_UPDATE handler not yet implemented');
        break;
      case this.TYPES.CALENDAR_SWITCH:
        // TODO: CalendarManager.handleRemoteSwitch(data);
        log(2, 'CALENDAR_SWITCH handler not yet implemented');
        break;
      default:
        log(1, `Unknown socket message type: ${type}`);
    }
  }

  /**
   * Determine if the current user is the primary GM.
   * The primary GM is responsible for authoritative updates to prevent race conditions.
   *
   * First checks the PRIMARY_GM setting for a manual override.
   * If not set, automatically selects the active GM with the lowest user ID.
   *
   * @returns {boolean} True if the current user is the primary GM
   */
  static isPrimaryGM() {
    // Check for manual override setting
    const primaryGMOverride = game.settings.get(MODULE.ID, SETTINGS.PRIMARY_GM);

    if (primaryGMOverride) {
      const isPrimary = primaryGMOverride === game.user.id;
      log(3, `Primary GM check (override): ${isPrimary} (override: ${primaryGMOverride}, current: ${game.user.id})`);
      return isPrimary;
    }

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
}
