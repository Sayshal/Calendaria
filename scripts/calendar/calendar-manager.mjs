/**
 * Calendar Manager
 * @module Calendar/CalendarManager
 * @author Tyler
 */

import { HOOKS, MODULE, SETTINGS } from '../constants.mjs';
import CalendariaCalendar from '../data/calendaria-calendar.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { BUNDLED_CALENDARS, DEFAULT_CALENDAR, isBundledCalendar, loadBundledCalendars } from './calendar-loader.mjs';
import CalendarRegistry from './calendar-registry.mjs';

/**
 * Main entry point for calendar system management.
 */
export default class CalendarManager {
  /** Flag to prevent responding to our own calendar changes */
  static #isSwitchingCalendar = false;

  /** @type {Map<string, object>} Pristine bundled calendar data for delta computation */
  static #bundledData = new Map();

  /**
   * Patch game.time.calendar to restore Foundry-compatible arrays.
   * @private
   */
  static #patchFoundryCalendar() {
    const cal = game.time.calendar;
    if (!cal) return;
    for (const prop of ['months', 'days', 'seasons']) if (cal[prop]?.values && !Array.isArray(cal[prop].values)) cal[prop].values = Object.values(cal[prop].values);
    if (cal.months?.values && cal.days) cal.days.daysPerLeapYear = cal.months.values.reduce((sum, m) => sum + (m.leapDays ?? m.days ?? 0), 0);
  }

  /**
   * Initialize the calendar system.
   */
  static async initialize() {
    await loadBundledCalendars();
    for (const id of BUNDLED_CALENDARS) {
      const bundled = CalendarRegistry.get(id);
      if (bundled) this.#bundledData.set(id, bundled.toObject());
    }
    await this.#loadDefaultOverrides();
    await this.#loadCustomCalendars();
    const activeId = game.settings.get(MODULE.ID, SETTINGS.ACTIVE_CALENDAR) || DEFAULT_CALENDAR;
    if (CalendarRegistry.has(activeId)) {
      CalendarRegistry.setActive(activeId);
    } else if (CalendarRegistry.size > 0) {
      const firstId = CalendarRegistry.getAllIds()[0];
      CalendarRegistry.setActive(firstId);
      log(2, `Active calendar "${activeId}" not found, using "${firstId}"`);
    }
    const activeCalendar = CalendarRegistry.getActive();
    if (activeCalendar) {
      CalendariaCalendar.initializeEpochOffset();
      CONFIG.time.worldCalendarConfig = activeCalendar.toObject();
      CONFIG.time.worldCalendarClass = CalendariaCalendar;
      CONFIG.time.roundTime = activeCalendar.secondsPerRound ?? 6;
      if (CalendariaCalendar.correctFirstWeekday !== null && CONFIG.time.worldCalendarConfig.years) CONFIG.time.worldCalendarConfig.years.firstWeekday = CalendariaCalendar.correctFirstWeekday;
      game.time.initializeCalendar();
      this.#patchFoundryCalendar();
      log(3, `Synced game.time.calendar to: ${activeCalendar.name} (roundTime: ${CONFIG.time.roundTime}s)`);
    }
    log(3, 'Calendar Manager initialized');
  }

  /**
   * Get pristine bundled calendar data (before overrides).
   * @param {string} id - Calendar ID
   * @returns {object|null} Bundled calendar data or null
   */
  static getBundledCalendarData(id) {
    return this.#bundledData.get(id) ?? null;
  }

  /**
   * Load custom calendars from settings.
   * @private
   */
  static async #loadCustomCalendars() {
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    const ids = Object.keys(customCalendars);
    if (ids.length === 0) return;
    for (const id of ids) {
      const data = customCalendars[id];
      const calendar = new CalendariaCalendar(data);
      CalendarRegistry.register(id, calendar);
      log(3, `Loaded custom calendar: ${id}`);
    }
    log(3, `Loaded ${ids.length} custom calendars`);
  }

  /**
   * Load and apply user overrides for bundled calendars.
   * @private
   */
  static async #loadDefaultOverrides() {
    const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
    const ids = Object.keys(overrides);
    if (ids.length === 0) return;
    let needsSave = false;
    for (const id of ids) {
      const data = overrides[id];
      const bundledData = this.#bundledData.get(id);
      if (data._isDelta && bundledData) {
        CalendarManager.#stripStaleDefaults(data, bundledData);
        const calendarData = foundry.utils.mergeObject(foundry.utils.deepClone(bundledData), data, { performDeletions: true });
        delete calendarData._isDelta;
        const calendar = new CalendariaCalendar(calendarData);
        CalendarRegistry.register(id, calendar);
        log(3, `Applied delta override for bundled calendar: ${id}`);
      } else if (bundledData) {
        if (CalendarManager.#alignOverrideKeys(data, bundledData)) needsSave = true;
        const calendar = new CalendariaCalendar(data);
        CalendarRegistry.register(id, calendar);
        needsSave = true;
        log(3, `Applied legacy override for bundled calendar: ${id}`);
      } else {
        const calendar = new CalendariaCalendar(data);
        CalendarRegistry.register(id, calendar);
        log(3, `Applied override for calendar: ${id}`);
      }
    }
    if (needsSave && game.user?.isGM) {
      for (const id of ids) {
        const cal = CalendarRegistry.get(id);
        const bundledData = this.#bundledData.get(id);
        if (cal && bundledData) overrides[id] = CalendarManager.#computeOverrideDelta(bundledData, cal.toObject());
      }
      await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES, overrides);
      log(3, 'Persisted override deltas');
    }
    log(3, `Applied ${ids.length} default calendar overrides`);
  }

  /**
   * Align a single collection's keys to match bundled keys.
   * @param {Array|object} collection - Override collection (array or keyed object)
   * @param {object} bundled - Bundled collection (keyed object)
   * @returns {object|null} Aligned keyed object, or null if already aligned
   * @private
   */
  static #alignCollection(collection, bundled) {
    if (!bundled || typeof bundled !== 'object') return null;
    const bundledKeys = Object.keys(bundled);
    if (bundledKeys.length === 0) return null;
    let items;
    if (Array.isArray(collection)) {
      items = collection;
    } else if (typeof collection === 'object') {
      const overrideKeys = Object.keys(collection);
      const bundledKeySet = new Set(bundledKeys);
      const matchCount = overrideKeys.filter((k) => bundledKeySet.has(k)).length;
      if (matchCount === Math.min(overrideKeys.length, bundledKeys.length)) return null;
      items = Object.values(collection);
    } else {
      return null;
    }
    if (items.length === 0) return null;
    const nameToKey = new Map();
    for (const [key, val] of Object.entries(bundled)) if (val?.name) nameToKey.set(val.name, key);
    const result = {};
    const usedKeys = new Set();
    const unmatchedIndices = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item?.name && nameToKey.has(item.name)) {
        const key = nameToKey.get(item.name);
        if (!usedKeys.has(key)) {
          result[key] = item;
          usedKeys.add(key);
          continue;
        }
      }
      unmatchedIndices.push(i);
    }
    const remainingKeys = bundledKeys.filter((k) => !usedKeys.has(k));
    for (let j = 0; j < unmatchedIndices.length; j++) {
      const item = items[unmatchedIndices[j]];
      const key = j < remainingKeys.length ? remainingKeys[j] : foundry.utils.randomID();
      result[key] = item;
    }
    return result;
  }

  /**
   * Align deeply nested collection keys within a parent object.
   * @param {object} parentObj - Override parent object
   * @param {object} bundledParent - Bundled parent object
   * @param {string} childKey - Key of the nested collection to align
   * @returns {boolean} Whether any changes were made
   * @private
   */
  static #alignDeeplyNested(parentObj, bundledParent, childKey) {
    if (!parentObj || typeof parentObj !== 'object' || Array.isArray(parentObj)) return false;
    let changed = false;
    for (const [key, entry] of Object.entries(parentObj)) {
      if (entry?.[childKey] && bundledParent?.[key]?.[childKey]) {
        const aligned = CalendarManager.#alignCollection(entry[childKey], bundledParent[key][childKey]);
        if (aligned) {
          entry[childKey] = aligned;
          changed = true;
        }
      }
    }
    return changed;
  }

  /**
   * Align override data keys to match bundled calendar data keys.
   * @param {object} overrideData - Override data to align
   * @param {object} bundledData - Bundled calendar data
   * @returns {boolean} Whether any changes were made
   * @private
   */
  static #alignOverrideKeys(overrideData, bundledData) {
    let changed = false;
    for (const key of ['festivals', 'eras', 'moons', 'cycles', 'canonicalHours']) {
      if (overrideData[key]) {
        const aligned = CalendarManager.#alignCollection(overrideData[key], bundledData[key]);
        if (aligned) {
          overrideData[key] = aligned;
          changed = true;
        }
      }
    }
    const nested = [
      ['months', 'values'],
      ['days', 'values'],
      ['seasons', 'values'],
      ['weather', 'zones'],
      ['weeks', 'names']
    ];
    for (const [parent, child] of nested) {
      if (overrideData[parent]?.[child]) {
        const aligned = CalendarManager.#alignCollection(overrideData[parent][child], bundledData[parent]?.[child]);
        if (aligned) {
          overrideData[parent][child] = aligned;
          changed = true;
        }
      }
    }
    if (CalendarManager.#alignDeeplyNested(overrideData.moons, bundledData.moons, 'phases')) changed = true;
    if (CalendarManager.#alignDeeplyNested(overrideData.cycles, bundledData.cycles, 'stages')) changed = true;
    if (CalendarManager.#alignDeeplyNested(overrideData.weather?.zones, bundledData.weather?.zones, 'presets')) changed = true;
    if (CalendarManager.#alignDeeplyNested(overrideData.months?.values, bundledData.months?.values, 'weekdays')) changed = true;
    if (overrideData.seasons?.values && typeof overrideData.seasons.values === 'object') {
      for (const [key, season] of Object.entries(overrideData.seasons.values)) {
        if (season?.climate?.presets && bundledData.seasons?.values?.[key]?.climate?.presets) {
          const aligned = CalendarManager.#alignCollection(season.climate.presets, bundledData.seasons.values[key].climate.presets);
          if (aligned) {
            season.climate.presets = aligned;
            changed = true;
          }
        }
      }
    }
    return changed;
  }

  /**
   * Compute a delta between bundled and override calendar data.
   * @param {object} bundledData - Pristine bundled calendar data
   * @param {object} overrideData - Current override calendar data
   * @param {object|null} [previousDelta] - Previous delta to detect user-added entry deletions
   * @returns {object} Delta object with `_isDelta: true`
   * @private
   */
  static #computeOverrideDelta(bundledData, overrideData, previousDelta = null) {
    const delta = foundry.utils.diffObject(bundledData, overrideData);
    for (const key of ['festivals', 'eras', 'moons', 'cycles', 'canonicalHours']) {
      if (bundledData[key]) {
        for (const entryKey of Object.keys(bundledData[key])) {
          if (!overrideData[key]?.[entryKey]) {
            if (!delta[key]) delta[key] = {};
            delta[key][`-=${entryKey}`] = null;
          }
        }
      }
      if (previousDelta?.[key]) {
        for (const entryKey of Object.keys(previousDelta[key])) {
          if (entryKey.startsWith('-=')) continue;
          if (!overrideData[key]?.[entryKey]) {
            if (!delta[key]) delta[key] = {};
            delta[key][`-=${entryKey}`] = null;
          }
        }
      }
    }
    for (const [parent, child] of [
      ['months', 'values'],
      ['days', 'values'],
      ['seasons', 'values'],
      ['weather', 'zones'],
      ['weeks', 'names']
    ]) {
      const bCol = bundledData[parent]?.[child];
      const oCol = overrideData[parent]?.[child];
      if (bCol && oCol) {
        for (const entryKey of Object.keys(bCol)) {
          if (!(entryKey in oCol)) {
            if (!delta[parent]) delta[parent] = {};
            if (!delta[parent][child]) delta[parent][child] = {};
            delta[parent][child][`-=${entryKey}`] = null;
          }
        }
      }
      const pCol = previousDelta?.[parent]?.[child];
      if (pCol) {
        for (const entryKey of Object.keys(pCol)) {
          if (entryKey.startsWith('-=')) continue;
          if (!overrideData[parent]?.[child]?.[entryKey]) {
            if (!delta[parent]) delta[parent] = {};
            if (!delta[parent][child]) delta[parent][child] = {};
            delta[parent][child][`-=${entryKey}`] = null;
          }
        }
      }
    }
    const deepDeletionCheck = (bParent, oParent, deltaRef, childKey) => {
      if (!bParent || !oParent) return;
      for (const [pKey, pVal] of Object.entries(bParent)) {
        if (!pVal?.[childKey] || !oParent[pKey]?.[childKey]) continue;
        for (const cKey of Object.keys(pVal[childKey])) {
          if (!(cKey in oParent[pKey][childKey])) {
            if (!deltaRef[pKey]) deltaRef[pKey] = {};
            if (!deltaRef[pKey][childKey]) deltaRef[pKey][childKey] = {};
            deltaRef[pKey][childKey][`-=${cKey}`] = null;
          }
        }
      }
    };
    if (bundledData.moons && overrideData.moons) {
      if (!delta.moons) delta.moons = {};
      deepDeletionCheck(bundledData.moons, overrideData.moons, delta.moons, 'phases');
    }
    if (previousDelta?.moons) {
      if (!delta.moons) delta.moons = {};
      deepDeletionCheck(previousDelta.moons, overrideData.moons ?? {}, delta.moons, 'phases');
    }
    if (delta.moons && !Object.keys(delta.moons).length) delete delta.moons;
    if (bundledData.cycles && overrideData.cycles) {
      if (!delta.cycles) delta.cycles = {};
      deepDeletionCheck(bundledData.cycles, overrideData.cycles, delta.cycles, 'stages');
    }
    if (previousDelta?.cycles) {
      if (!delta.cycles) delta.cycles = {};
      deepDeletionCheck(previousDelta.cycles, overrideData.cycles ?? {}, delta.cycles, 'stages');
    }
    if (delta.cycles && !Object.keys(delta.cycles).length) delete delta.cycles;
    if (bundledData.weather?.zones && overrideData.weather?.zones) {
      if (!delta.weather) delta.weather = {};
      if (!delta.weather.zones) delta.weather.zones = {};
      deepDeletionCheck(bundledData.weather.zones, overrideData.weather.zones, delta.weather.zones, 'presets');
    }
    if (previousDelta?.weather?.zones) {
      if (!delta.weather) delta.weather = {};
      if (!delta.weather.zones) delta.weather.zones = {};
      deepDeletionCheck(previousDelta.weather.zones, overrideData.weather?.zones ?? {}, delta.weather.zones, 'presets');
    }
    if (delta.weather?.zones && !Object.keys(delta.weather.zones).length) delete delta.weather.zones;
    if (delta.weather && !Object.keys(delta.weather).length) delete delta.weather;
    if (bundledData.months?.values && overrideData.months?.values) {
      if (!delta.months) delta.months = {};
      if (!delta.months.values) delta.months.values = {};
      deepDeletionCheck(bundledData.months.values, overrideData.months.values, delta.months.values, 'weekdays');
    }
    if (previousDelta?.months?.values) {
      if (!delta.months) delta.months = {};
      if (!delta.months.values) delta.months.values = {};
      deepDeletionCheck(previousDelta.months.values, overrideData.months?.values ?? {}, delta.months.values, 'weekdays');
    }
    if (delta.months?.values && !Object.keys(delta.months.values).length) delete delta.months.values;
    if (delta.months && !Object.keys(delta.months).length) delete delta.months;
    CalendarManager.#stripStaleDefaults(delta, bundledData);
    delta._isDelta = true;
    return delta;
  }

  /**
   * Recursively strip empty-string values from a delta.
   * @param {object} delta - Delta object (mutated in place)
   * @param {object} bundled - Pristine bundled data to compare against
   * @private
   */
  static #stripStaleDefaults(delta, bundled) {
    for (const key of Object.keys(delta)) {
      if (key.startsWith('-=')) continue;
      const dVal = delta[key];
      const bVal = bundled?.[key];
      if (dVal !== null && typeof dVal === 'object' && !Array.isArray(dVal) && bVal !== null && typeof bVal === 'object' && !Array.isArray(bVal)) {
        CalendarManager.#stripStaleDefaults(dVal, bVal);
        if (!Object.keys(dVal).length) delete delta[key];
      } else if (typeof dVal === 'string' && dVal === '' && typeof bVal === 'string' && bVal !== '') {
        delete delta[key];
      }
    }
  }

  /**
   * Get a calendar by ID.
   * @param {string} id  Calendar ID
   * @returns {object|null} - Calendar instance or null
   */
  static getCalendar(id) {
    return CalendarRegistry.get(id);
  }

  /**
   * Get all calendars.
   * @returns {Map<string, CalendariaCalendar>} - Map of calendar IDs to instances
   */
  static getAllCalendars() {
    return CalendarRegistry.getAll();
  }

  /**
   * Get the active calendar.
   * @returns {object|null} - Active calendar instance or null
   */
  static getActiveCalendar() {
    return CalendarRegistry.getActive();
  }

  /**
   * Switch to a different calendar.
   * @param {string} id  Calendar ID to switch to
   * @returns {Promise<boolean>}  True if calendar was switched
   */
  static async switchCalendar(id) {
    if (!CalendarRegistry.has(id)) {
      log(1, `Cannot switch to calendar: ${id} not found`);
      ui.notifications.error(format('CALENDARIA.Error.CalendarNotFound', { id }));
      return false;
    }
    const calendar = CalendarRegistry.get(id);
    CalendarRegistry.setActive(id);
    CalendariaCalendar.initializeEpochOffset();
    CONFIG.time.worldCalendarConfig = calendar.toObject();
    CONFIG.time.worldCalendarClass = CalendariaCalendar;
    CONFIG.time.roundTime = calendar.secondsPerRound ?? 6;
    game.time.initializeCalendar();
    this.#patchFoundryCalendar();
    if (game.user.isGM) {
      try {
        this.#isSwitchingCalendar = true;
        await game.settings.set(MODULE.ID, SETTINGS.ACTIVE_CALENDAR, id);
        log(3, `Updated active calendar setting to: ${id}`);
      } catch (error) {
        if (error.name !== 'DataModelValidationError') log(1, `Error updating active calendar setting:`, error);
      } finally {
        this.#isSwitchingCalendar = false;
      }
    }
    Hooks.callAll(HOOKS.CALENDAR_SWITCHED, id, calendar);
    this.rerenderCalendarUIs();
    log(3, `Switched to calendar: ${id}`);
    return true;
  }

  /**
   * Re-render all calendar-related UI applications.
   */
  static rerenderCalendarUIs() {
    const ids = ['calendaria-hud', 'calendaria-timekeeper', 'calendaria-mini-cal', 'calendaria-big-cal'];
    for (const id of ids) foundry.applications.instances.get(id)?.render();
  }

  /**
   * Handle a remote calendar switch from another client.
   * @param {string} id  Calendar ID to switch to
   */
  static handleRemoteSwitch(id) {
    if (!CalendarRegistry.has(id)) {
      log(2, `Cannot handle remote switch: calendar ${id} not found`);
      return;
    }
    log(3, `Handling remote calendar switch to: ${id}`);
    CalendarRegistry.setActive(id);
    const calendar = CalendarRegistry.get(id);
    CalendariaCalendar.initializeEpochOffset();
    CONFIG.time.worldCalendarConfig = calendar.toObject();
    CONFIG.time.worldCalendarClass = CalendariaCalendar;
    CONFIG.time.roundTime = calendar.secondsPerRound ?? 6;
    game.time.initializeCalendar();
    this.#patchFoundryCalendar();
    const calendarName = calendar?.name || id;
    ui.notifications.info(format('CALENDARIA.Info.CalendarSwitched', { name: calendarName }));
    Hooks.callAll(HOOKS.REMOTE_CALENDAR_SWITCH, id, calendar);
    this.rerenderCalendarUIs();
  }

  /**
   * Add a new calendar.
   * @param {string} id  Calendar ID
   * @param {object} definition  Calendar definition
   * @returns {Promise<CalendariaCalendar|null>}  The created calendar or null
   */
  static async addCalendar(id, definition) {
    if (CalendarRegistry.has(id)) {
      log(2, `Cannot add calendar: ${id} already exists`);
      ui.notifications.error(format('CALENDARIA.Error.CalendarAlreadyExists', { id }));
      return null;
    }
    try {
      const calendar = CalendarRegistry.register(id, definition);
      Hooks.callAll(HOOKS.CALENDAR_ADDED, id, calendar);
      log(3, `Added calendar: ${id}`);
      return calendar;
    } catch (error) {
      log(1, `Error adding calendar ${id}:`, error);
      ui.notifications.error(format('CALENDARIA.Error.CalendarAddFailed', { message: error.message }));
      return null;
    }
  }

  /**
   * Remove a calendar.
   * @param {string} id  Calendar ID
   * @returns {Promise<boolean>}  True if calendar was removed
   */
  static async removeCalendar(id) {
    if (!CalendarRegistry.has(id)) {
      log(2, `Cannot remove calendar: ${id} not found`);
      return false;
    }
    if (CalendarRegistry.getActiveId() === id) {
      log(1, `Cannot remove active calendar: ${id}`);
      ui.notifications.warn('CALENDARIA.Error.CannotRemoveActiveCalendar', { localize: true });
      return false;
    }
    const removed = CalendarRegistry.unregister(id);
    if (removed) {
      Hooks.callAll(HOOKS.CALENDAR_REMOVED, id);
      log(3, `Removed calendar: ${id}`);
    }
    return removed;
  }

  /**
   * Get calendar metadata for UI display.
   * @param {string} id  Calendar ID
   * @returns {object|null}  Calendar metadata
   */
  static getCalendarMetadata(id) {
    const calendar = CalendarRegistry.get(id);
    if (!calendar) return null;
    return {
      id: calendar.metadata?.id ?? id,
      name: calendar.name ? localize(calendar.name) : id,
      description: calendar.metadata?.description ?? '',
      system: calendar.metadata?.system ?? '',
      author: calendar.metadata?.author ?? '',
      isActive: CalendarRegistry.getActiveId() === id
    };
  }

  /**
   * Get metadata for all calendars.
   * @returns {object[]}  Array of calendar metadata
   */
  static getAllCalendarMetadata() {
    const ids = CalendarRegistry.getAllIds();
    return ids.map((id) => this.getCalendarMetadata(id)).filter(Boolean);
  }

  /**
   * Handle updateSetting hook for active calendar changes.
   * @param {object} setting - The setting that was updated
   * @param {object} changes - The changes to the setting
   * @private
   */
  static onUpdateSetting(setting, changes) {
    if (setting.key === `${MODULE.ID}.${SETTINGS.ACTIVE_CALENDAR}`) {
      const newCalendarId = changes.value;
      if (this.#isSwitchingCalendar) return;
      log(3, 'Active calendar updated (externally)');
      if (newCalendarId && CalendarRegistry.has(newCalendarId)) {
        CalendarRegistry.setActive(newCalendarId);
        const calendar = CalendarRegistry.get(newCalendarId);
        CalendariaCalendar.initializeEpochOffset();
        CONFIG.time.worldCalendarConfig = calendar.toObject();
        CONFIG.time.worldCalendarClass = CalendariaCalendar;
        CONFIG.time.roundTime = calendar.secondsPerRound ?? 6;
        game.time.initializeCalendar();
        this.#patchFoundryCalendar();
      }
    }
  }

  /**
   * Get the current moon phase for the active calendar.
   * @param {number} moonIndex  Index of the moon (0 for primary)
   * @returns {object|null}  Moon phase data
   */
  static getCurrentMoonPhase(moonIndex = 0) {
    const calendar = this.getActiveCalendar();
    if (!calendar) return null;
    return calendar.getMoonPhase(moonIndex);
  }

  /**
   * Get all moon phases for the active calendar.
   * @returns {Array<object>}  Array of moon phase data
   */
  static getAllCurrentMoonPhases() {
    const calendar = this.getActiveCalendar();
    if (!calendar) return [];
    return calendar.getAllMoonPhases();
  }

  /**
   * Check if the current date is a festival day.
   * @returns {object|null}  Festival data or null
   */
  static getCurrentFestival() {
    const calendar = this.getActiveCalendar();
    if (!calendar) return null;
    return calendar.findFestivalDay();
  }

  /**
   * Get the current calendar date and time.
   * @returns {object}  Current date/time object with year, month, day, hour, minute
   */
  static getCurrentDateTime() {
    const components = game.time.components;
    const calendar = this.getActiveCalendar();
    const yearOffset = calendar?.yearZero ?? 0;
    return { year: components.year + yearOffset, month: components.month, dayOfMonth: components.dayOfMonth, hour: components.hour, minute: components.minute };
  }

  /**
   * Create a new custom calendar from a definition.
   * @param {string} id - Unique calendar ID (will be prefixed with 'custom-' if not already)
   * @param {object} definition - Calendar definition object
   * @returns {Promise<CalendariaCalendar|null>} The created calendar or null on error
   */
  static async createCustomCalendar(id, definition) {
    const calendarId = id.startsWith('custom-') ? id : `custom-${id}`;
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    if (customCalendars[calendarId]) {
      log(2, `Cannot create calendar: ${calendarId} already exists`);
      return null;
    }
    if (CalendarRegistry.has(calendarId)) {
      log(3, `Cleaning up stale registry entry for: ${calendarId}`);
      CalendarRegistry.unregister(calendarId);
    }
    try {
      if (!definition.metadata) definition.metadata = {};
      definition.metadata.id = calendarId;
      definition.metadata.author = definition.metadata.author || game.user.name;
      definition.metadata.isCustom = true;
      const calendar = new CalendariaCalendar(definition);
      customCalendars[calendarId] = calendar.toObject();
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, customCalendars);
      CalendarRegistry.register(calendarId, calendar);
      Hooks.callAll(HOOKS.CALENDAR_ADDED, calendarId, calendar);
      log(3, `Created custom calendar: ${calendarId}`);
      return calendar;
    } catch (error) {
      log(1, `Error creating custom calendar ${calendarId}:`, error);
      return null;
    }
  }

  /**
   * Update an existing custom calendar.
   * @param {string} id - Calendar ID to update
   * @param {object} changes - Partial definition with changes to apply
   * @returns {Promise<CalendariaCalendar|null>} The updated calendar or null on error
   */
  static async updateCustomCalendar(id, changes) {
    const calendar = CalendarRegistry.get(id);
    if (!calendar) {
      log(1, `Cannot update calendar: ${id} not found`);
      ui.notifications.error(format('CALENDARIA.Error.CalendarNotFound', { id }));
      return null;
    }
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    if (!customCalendars[id]) {
      log(2, `Cannot update calendar: ${id} is not a custom calendar`);
      return null;
    }
    try {
      const updatedCalendar = new CalendariaCalendar(changes);
      customCalendars[id] = updatedCalendar.toObject();
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, customCalendars);
      CalendarRegistry.register(id, updatedCalendar);
      if (CalendarRegistry.getActiveId() === id) {
        CalendariaCalendar.initializeEpochOffset();
        CONFIG.time.worldCalendarConfig = updatedCalendar.toObject();
        CONFIG.time.roundTime = updatedCalendar.secondsPerRound ?? 6;
        game.time.initializeCalendar();
        this.#patchFoundryCalendar();
      }
      Hooks.callAll(HOOKS.CALENDAR_UPDATED, id, updatedCalendar);
      log(3, `Updated custom calendar: ${id}`);
      return updatedCalendar;
    } catch (error) {
      log(1, 'Calendar update failed:', error);
      ui.notifications.error(format('CALENDARIA.Error.CalendarUpdateFailed', { message: error.message }));
      return null;
    }
  }

  /**
   * Delete a custom calendar.
   * @param {string} id - Calendar ID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async deleteCustomCalendar(id) {
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    if (!customCalendars[id]) {
      log(2, `Cannot delete calendar: ${id} is not a custom calendar`);
      return false;
    }
    if (CalendarRegistry.getActiveId() === id) {
      log(2, `Cannot delete active calendar: ${id}`);
      return false;
    }
    try {
      delete customCalendars[id];
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, customCalendars);
      CalendarRegistry.unregister(id);
      Hooks.callAll(HOOKS.CALENDAR_REMOVED, id);
      log(3, `Deleted custom calendar: ${id}`);
      return true;
    } catch (error) {
      log(1, `Error deleting custom calendar ${id}:`, error);
      return false;
    }
  }

  /**
   * Get available calendar templates for "Start from..." feature.
   * @returns {Array<{id: string, name: string, description: string}>} - Template options
   */
  static getCalendarTemplates() {
    const templates = [];
    for (const [id, calendar] of CalendarRegistry.getAll()) {
      let name;
      if (isBundledCalendar(id)) {
        const key = id
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
        name = localize(`CALENDARIA.Calendar.${key}.Name`);
      } else {
        name = calendar.name ? localize(calendar.name) : id;
      }
      templates.push({ id, name, description: calendar.metadata?.description || '', isCustom: calendar.metadata?.isCustom || false });
    }
    templates.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    return templates;
  }

  /**
   * Duplicate an existing calendar as a starting point for a new custom calendar.
   * @param {string} sourceId - ID of calendar to duplicate
   * @param {string} newId - ID for the new calendar
   * @param {string} [newName] - Name for the new calendar
   * @returns {Promise<CalendariaCalendar|null>} The new calendar or null on error
   */
  static async duplicateCalendar(sourceId, newId, newName) {
    const sourceCalendar = CalendarRegistry.get(sourceId);
    if (!sourceCalendar) {
      log(2, `Cannot duplicate calendar: ${sourceId} not found`);
      return null;
    }
    const newData = sourceCalendar.toObject();
    newData.name = newName || `Copy of ${sourceCalendar.name || sourceId}`;
    if (newData.metadata) {
      delete newData.metadata.id;
      delete newData.metadata.author;
      delete newData.metadata.isCustom;
    }

    return this.createCustomCalendar(newId, newData);
  }

  /**
   * Check if a calendar is a custom calendar (user-created).
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar is custom
   */
  static isCustomCalendar(id) {
    if (isBundledCalendar(id)) return false;
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    return !!customCalendars[id];
  }

  /**
   * Check if a calendar is a bundled (built-in) calendar.
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar is a bundled calendar
   */
  static isBundledCalendar(id) {
    return isBundledCalendar(id);
  }

  /**
   * Check if a bundled calendar has a user override.
   * @param {string} id - Calendar ID to check
   * @returns {boolean} True if the calendar has an override
   */
  static hasDefaultOverride(id) {
    const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
    return !!overrides[id];
  }

  /**
   * Save a user override for a bundled calendar.
   * @param {string} id - Calendar ID to override
   * @param {object} data - Full calendar data to save as override
   * @returns {Promise<CalendariaCalendar|null>} The updated calendar or null on error
   */
  static async saveDefaultOverride(id, data) {
    if (!isBundledCalendar(id) && !this.hasDefaultOverride(id)) {
      log(2, `Cannot save override: ${id} is not a bundled calendar`);
      return null;
    }
    try {
      if (!data.metadata) data.metadata = {};
      data.metadata.id = id;
      data.metadata.hasOverride = true;
      const calendar = new CalendariaCalendar(data);
      const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
      const bundledData = this.#bundledData.get(id);
      if (bundledData) {
        const previousDelta = overrides[id] || null;
        overrides[id] = CalendarManager.#computeOverrideDelta(bundledData, calendar.toObject(), previousDelta);
      } else {
        overrides[id] = calendar.toObject();
      }
      await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES, overrides);
      CalendarRegistry.register(id, calendar);
      if (CalendarRegistry.getActiveId() === id) {
        CalendariaCalendar.initializeEpochOffset();
        CONFIG.time.worldCalendarConfig = calendar.toObject();
        CONFIG.time.roundTime = calendar.secondsPerRound ?? 6;
        game.time.initializeCalendar();
        this.#patchFoundryCalendar();
      }
      Hooks.callAll(HOOKS.CALENDAR_UPDATED, id, calendar);
      log(3, `Saved override for bundled calendar: ${id}`);
      return calendar;
    } catch (error) {
      log(1, `Error saving override for ${id}:`, error);
      return null;
    }
  }

  /**
   * Reset a bundled calendar to its original state by removing the override.
   * @param {string} id - Calendar ID to reset
   * @returns {Promise<boolean>} True if reset successfully
   */
  static async resetDefaultCalendar(id) {
    if (!this.hasDefaultOverride(id)) {
      log(2, `Cannot reset: ${id} has no override`);
      return false;
    }
    try {
      const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
      delete overrides[id];
      await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES, overrides);
      const bundledData = this.#bundledData.get(id);
      if (bundledData) {
        const calendar = new CalendariaCalendar(foundry.utils.deepClone(bundledData));
        CalendarRegistry.register(id, calendar);
        if (CalendarRegistry.getActiveId() === id) {
          CalendariaCalendar.initializeEpochOffset();
          CONFIG.time.worldCalendarConfig = calendar.toObject();
          CONFIG.time.roundTime = calendar.secondsPerRound ?? 6;
          game.time.initializeCalendar();
          this.#patchFoundryCalendar();
        }
        Hooks.callAll(HOOKS.CALENDAR_UPDATED, id, calendar);
      }
      log(3, `Reset bundled calendar: ${id}`);
      return true;
    } catch (error) {
      log(1, `Error resetting bundled calendar ${id}:`, error);
      return false;
    }
  }
}
