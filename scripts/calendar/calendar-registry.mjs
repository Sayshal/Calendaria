/**
 * Calendar Registry
 * Manages the storage and retrieval of calendar instances.
 *
 * @module Calendar/CalendarRegistry
 * @author Tyler
 */

import { log } from '../utils/logger.mjs';
import CalendariaCalendar from './data/calendaria-calendar.mjs';

export default class CalendarRegistry {
  /**
   * Map of calendar ID to calendar instance
   * @type {Map<string, CalendariaCalendar>}
   * @private
   */
  static #calendars = new Map();

  /**
   * Currently active calendar ID
   * @type {string|null}
   * @private
   */
  static #activeId = null;

  /* -------------------------------------------- */
  /*  Registration Methods                        */
  /* -------------------------------------------- */

  /**
   * Register a calendar instance.
   * @param {string} id  Calendar ID
   * @param {CalendariaCalendar|object} calendar  Calendar instance or config
   * @returns {CalendariaCalendar}  The registered calendar instance
   */
  static register(id, calendar) {
    // If calendar is a plain config object, create a CalendariaCalendar instance
    if (!(calendar instanceof CalendariaCalendar)) calendar = new CalendariaCalendar(calendar);

    this.#calendars.set(id, calendar);
    log(3, `Registered calendar: ${id}`);
    return calendar;
  }

  /**
   * Unregister a calendar.
   * @param {string} id  Calendar ID
   * @returns {boolean}  True if calendar was unregistered
   */
  static unregister(id) {
    const result = this.#calendars.delete(id);
    if (result) log(3, `Unregistered calendar: ${id}`);
    return result;
  }

  /**
   * Check if a calendar is registered.
   * @param {string} id  Calendar ID
   * @returns {boolean}
   */
  static has(id) {
    return this.#calendars.has(id);
  }

  /* -------------------------------------------- */
  /*  Retrieval Methods                           */
  /* -------------------------------------------- */

  /**
   * Get a calendar by ID.
   * @param {string} id  Calendar ID
   * @returns {CalendariaCalendar|null}  Calendar instance or null if not found
   */
  static get(id) {
    return this.#calendars.get(id) ?? null;
  }

  /**
   * Get all registered calendars.
   * @returns {Map<string, CalendariaCalendar>}  Map of calendar IDs to instances
   */
  static getAll() {
    return new Map(this.#calendars);
  }

  /**
   * Get all calendar IDs.
   * @returns {string[]}  Array of calendar IDs
   */
  static getAllIds() {
    return Array.from(this.#calendars.keys());
  }

  /**
   * Get the currently active calendar.
   * @returns {CalendariaCalendar|null}  Active calendar instance or null
   */
  static getActive() {
    if (!this.#activeId) return null;
    return this.get(this.#activeId);
  }

  /**
   * Get the active calendar ID.
   * @returns {string|null}  Active calendar ID or null
   */
  static getActiveId() {
    return this.#activeId;
  }

  /**
   * Set the active calendar.
   * @param {string} id  Calendar ID to set as active
   * @returns {boolean}  True if calendar was set as active
   */
  static setActive(id) {
    if (!this.has(id)) {
      log(2, `Cannot set active calendar: ${id} not found`);
      return false;
    }

    this.#activeId = id;
    log(3, `Active calendar set to: ${id}`);
    return true;
  }

  /* -------------------------------------------- */
  /*  Utility Methods                             */
  /* -------------------------------------------- */

  /**
   * Clear all calendars from the registry.
   */
  static clear() {
    this.#calendars.clear();
    this.#activeId = null;
    log(3, 'Calendar registry cleared');
  }

  /**
   * Get the number of registered calendars.
   * @returns {number}
   */
  static get size() {
    return this.#calendars.size;
  }

  /**
   * Convert registry to a plain object for serialization.
   * @returns {object}  Serialized registry data
   */
  static toObject() {
    const calendars = {};
    for (const [id, calendar] of this.#calendars.entries()) calendars[id] = calendar.toObject();

    return { calendars, activeId: this.#activeId };
  }

  /**
   * Restore registry from a plain object.
   * @param {object} data  Serialized registry data
   */
  static fromObject(data) {
    this.clear();

    if (data.calendars) for (const [id, calendarData] of Object.entries(data.calendars)) this.register(id, calendarData);

    if (data.activeId && this.has(data.activeId)) this.setActive(data.activeId);
  }
}
