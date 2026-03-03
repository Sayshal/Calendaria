/**
 * Calendar Registry
 * @module Calendar/CalendarRegistry
 * @author Tyler
 */

import CalendariaCalendar from '../data/calendaria-calendar.mjs';
import { log } from '../utils/logger.mjs';

/**
 * Registry for managing calendar instances.
 */
export default class CalendarRegistry {
  /** @type {Map<string, CalendariaCalendar>} Map of calendar ID to calendar instance */
  static #calendars = new Map();

  /** @type {string|null} Currently active calendar ID */
  static #activeId = null;

  /**
   * Register a calendar instance.
   * @param {string} id  Calendar ID
   * @param {CalendariaCalendar|object} calendar  Calendar instance or config
   * @returns {object}  The registered calendar instance
   */
  static register(id, calendar) {
    if (!(calendar instanceof CalendariaCalendar)) calendar = new CalendariaCalendar(calendar);
    this.#calendars.set(id, calendar);

    return calendar;
  }

  /**
   * Unregister a calendar.
   * @param {string} id  Calendar ID
   * @returns {boolean}  True if calendar was unregistered
   */
  static unregister(id) {
    const result = this.#calendars.delete(id);

    return result;
  }

  /**
   * Check if a calendar is registered.
   * @param {string} id  Calendar ID
   * @returns {boolean} - Is calendar registered?
   */
  static has(id) {
    return this.#calendars.has(id);
  }

  /**
   * Get a calendar by ID.
   * @param {string} id  Calendar ID
   * @returns {object|null}  Calendar instance or null if not found
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
   * @returns {object|null}  Active calendar instance or null
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
    if (!this.has(id)) return false;
    this.#activeId = id;
    log(3, `Active calendar set to: ${id}`);
    return true;
  }

  /**
   * Clear all calendars from the registry.
   */
  static clear() {
    this.#calendars.clear();
    this.#activeId = null;
  }

  /**
   * Get the number of registered calendars.
   * @returns {number} - Count of registered calendars
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
    return { calendars };
  }

  /**
   * Restore registry from a plain object.
   * @param {object} data  Serialized registry data
   */
  static fromObject(data) {
    this.clear();
    if (data.calendars) for (const [id, calendarData] of Object.entries(data.calendars)) this.register(id, calendarData);
  }
}
