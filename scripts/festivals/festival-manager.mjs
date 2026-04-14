/**
 * Festival Template Utility
 * @module Festivals/FestivalManager
 * @author Tyler
 */

import { CalendarManager, isBundledCalendar } from '../calendar/_module.mjs';
import { DISPLAY_STYLES, NOTE_VISIBILITY } from '../constants.mjs';
import { NoteManager } from '../notes/_module.mjs';
import { getMidpoint } from '../utils/calendar-math.mjs';
import { localize, log } from '../utils/_module.mjs';

/**
 * Manages the lifecycle of festival notes — creation, deletion, and template refresh.
 */
export default class FestivalManager {
  /**
   * Create a single festival note from a template definition.
   * @param {string} calendarId - Calendar ID
   * @param {string} key - Festival key
   * @param {object} festival - Festival definition (template)
   * @param {object} calendar - Calendar instance
   * @returns {Promise<object>} Created page
   */
  static async createFestivalNote(calendarId, key, festival, calendar) {
    const noteData = this.#mapFestivalToNoteData(calendarId, key, festival, calendar);
    const name = festival.name ? localize(festival.name) : 'Festival';
    const content = festival.description ? `<p>${localize(festival.description)}</p>` : '';
    return NoteManager.createNote({ name, content, noteData, calendarId, openSheet: false });
  }

  /**
   * Delete a single festival note by its key.
   * @param {string} calendarId - Calendar ID
   * @param {string} key - Festival key
   * @returns {Promise<boolean>} True if deleted
   */
  static async deleteFestivalNote(calendarId, key) {
    const stub = this.getFestivalNoteByKey(calendarId, key);
    if (!stub) return false;
    NoteManager.enableBypassDeleteProtection();
    await NoteManager.deleteNote(stub.id);
    NoteManager.disableBypassDeleteProtection();
    return true;
  }

  /**
   * Refresh a festival note back to its template defaults.
   * @param {string} calendarId - Calendar ID
   * @param {string} key - Festival key
   * @param {object} festival - Festival definition (template)
   * @param {object} calendar - Calendar instance
   * @returns {Promise<boolean>} True if refreshed
   */
  static async refreshFestivalNote(calendarId, key, festival, calendar) {
    const stub = this.getFestivalNoteByKey(calendarId, key);
    if (!stub) return false;
    const name = festival.name ? localize(festival.name) : 'Festival';
    const content = festival.description ? `<p>${localize(festival.description)}</p>` : '';
    const festivalDuration = festival.duration ?? 1;
    const conditionTree = festival.conditionTree ?? this.#buildFestivalConditionTree(festival, calendar);
    const startDate = this.#getFestivalStartDate(festival, game.time.components, calendar);
    const noteData = {
      color: festival.color || '#f0a500',
      icon: festival.icon ? `fas ${festival.icon}` : 'fas fa-masks-theater',
      iconType: 'fontawesome',
      hasDuration: festivalDuration > 1,
      duration: festivalDuration,
      displayStyle: festival.displayStyle || DISPLAY_STYLES.BANNER,
      conditionTree,
      allDay: festival.allDay ?? true,
      startDate,
      endDate: { ...startDate }
    };
    await NoteManager.updateNote(stub.id, { name, content, noteData });
    log(3, `Refreshed festival note "${key}" to template defaults`);
    return true;
  }

  /**
   * Create missing festival notes for a calendar. Does NOT update or delete existing notes.
   * @param {string} calendarId - Calendar ID
   * @param {object} calendar - Calendar instance
   * @returns {Promise<number>} Number of notes created
   */
  static async ensureFestivalNotes(calendarId, calendar) {
    if (!game.user.isGM || !calendarId || !calendar) return 0;
    const festivals = calendar.festivals ?? {};
    const festivalEntries = Object.entries(festivals);
    if (!festivalEntries.length) return 0;
    const existingNotes = this.getFestivalNotes(calendarId);
    const seenKeys = new Map();
    for (const stub of existingNotes) {
      const key = stub.flagData.linkedFestival?.festivalKey;
      if (!key) continue;
      if (seenKeys.has(key)) {
        NoteManager.enableBypassDeleteProtection();
        await NoteManager.deleteNote(stub.id);
        NoteManager.disableBypassDeleteProtection();
        log(3, `Removed duplicate festival note "${key}" (${stub.id})`);
      } else {
        seenKeys.set(key, stub);
      }
    }
    let created = 0;
    for (const [key, festival] of festivalEntries) {
      if (seenKeys.has(key)) continue;
      await this.createFestivalNote(calendarId, key, festival, calendar);
      created++;
    }
    if (created) log(3, `Created ${created} missing festival notes for ${calendarId}`);
    return created;
  }

  /**
   * Patch a calendar data object's festival definitions in-place using dates
   * from any festival-linked notes in the supplied note bundle. Used during
   * import to heal v1.0.3-era exports whose festival definitions kept the
   * editor default of month 0 / day 0 even though the user edited the linked
   * notes to the correct dates. Pure (mutates `calendarData`, no Foundry API).
   * @param {object} calendarData - Mutable calendarData
   * @param {object[]} notes - Serialized note array (entries with `system.linkedFestival`)
   * @returns {number} Number of festival definitions patched
   */
  static applyFestivalDatesToCalendarData(calendarData, notes) {
    if (!calendarData?.festivals || !Array.isArray(notes)) return 0;
    let patched = 0;
    for (const note of notes) {
      const linked = note?.system?.linkedFestival;
      if (!linked?.festivalKey) continue;
      const festival = calendarData.festivals[linked.festivalKey];
      if (!festival) continue;
      const tree = note.system.conditionTree ?? null;
      const derived = this.deriveDateFromConditionTree(tree);
      const nextMonth = derived?.month ?? note.system.startDate?.month ?? festival.month ?? 0;
      const nextDay = derived?.dayOfMonth ?? note.system.startDate?.dayOfMonth ?? festival.dayOfMonth ?? 0;
      festival.month = nextMonth;
      festival.dayOfMonth = nextDay;
      if (tree) festival.conditionTree = tree;
      patched++;
    }
    return patched;
  }

  /**
   * Walk all festival notes for a calendar and write each note's date and
   * conditionTree back into the calendar's festival definition. Heals
   * calendars whose festival definitions drifted from their notes (e.g.
   * pre-fix worlds where editing a festival via the note sheet never
   * propagated month/dayOfMonth back to the calendar).
   * @param {string} calendarId - Calendar ID
   * @returns {Promise<number>} Number of festivals updated
   */
  static async syncFestivalDefinitionsFromNotes(calendarId) {
    if (!game.user.isGM) return 0;
    const calendar = CalendarManager.getCalendar(calendarId);
    if (!calendar?.festivals) return 0;
    const data = calendar.toObject();
    let changed = 0;
    for (const stub of this.getFestivalNotes(calendarId)) {
      const key = stub.flagData?.linkedFestival?.festivalKey;
      const festival = key ? data.festivals[key] : null;
      if (!festival) continue;
      const page = NoteManager.getFullNote(stub.id);
      const pageSystem = page?.system?.toObject?.() ?? page?.system ?? stub.flagData;
      if (!pageSystem) continue;
      const newTree = pageSystem.conditionTree ?? null;
      const derived = newTree ? this.deriveDateFromConditionTree(newTree) : null;
      const nextMonth = derived?.month ?? pageSystem.startDate?.month ?? festival.month ?? 0;
      const nextDay = derived?.dayOfMonth ?? pageSystem.startDate?.dayOfMonth ?? festival.dayOfMonth ?? 0;
      const treeUnchanged = JSON.stringify(festival.conditionTree ?? null) === JSON.stringify(newTree);
      if (festival.month === nextMonth && festival.dayOfMonth === nextDay && treeUnchanged) continue;
      festival.month = nextMonth;
      festival.dayOfMonth = nextDay;
      festival.conditionTree = newTree;
      changed++;
    }
    if (changed) {
      if (isBundledCalendar(calendarId)) await CalendarManager.saveDefaultOverride(calendarId, data);
      else await CalendarManager.updateCustomCalendar(calendarId, data);
      log(3, `Synced ${changed} festival definitions from notes for ${calendarId}`);
    }
    return changed;
  }

  /**
   * Delete all festival notes for a calendar (used on calendar reset/delete).
   * @param {string} calendarId - Calendar ID
   * @returns {Promise<number>} Number of notes deleted
   */
  static async deleteAllFestivalNotes(calendarId) {
    const notes = this.getFestivalNotes(calendarId);
    if (!notes.length) return 0;
    NoteManager.enableBypassDeleteProtection();
    let deleted = 0;
    for (const stub of notes) {
      await NoteManager.deleteNote(stub.id);
      deleted++;
    }
    NoteManager.disableBypassDeleteProtection();
    log(3, `Deleted ${deleted} festival notes for ${calendarId}`);
    return deleted;
  }

  /**
   * Get all festival note stubs for a calendar.
   * @param {string} calendarId - Calendar ID
   * @returns {object[]} Festival note stubs
   */
  static getFestivalNotes(calendarId) {
    return NoteManager.getAllNotes().filter((stub) => stub.flagData?.linkedFestival?.calendarId === calendarId);
  }

  /**
   * Get a festival note by its festival key.
   * @param {string} calendarId - Calendar ID
   * @param {string} festivalKey - Festival key in the calendar's festivals object
   * @returns {object|null} Note stub or null
   */
  static getFestivalNoteByKey(calendarId, festivalKey) {
    return this.getFestivalNotes(calendarId).find((stub) => stub.flagData.linkedFestival.festivalKey === festivalKey) || null;
  }

  /**
   * Map a calendar festival definition to note system data (used for creation).
   * @param {string} calendarId - Calendar ID
   * @param {string} festivalKey - Festival key
   * @param {object} festival - Festival definition
   * @param {object} calendar - Calendar instance
   * @returns {object} Note data for NoteManager.createNote
   * @private
   */
  static #mapFestivalToNoteData(calendarId, festivalKey, festival, calendar) {
    const currentDate = game.time.components;
    const startDate = this.#getFestivalStartDate(festival, currentDate, calendar);
    const festivalDuration = festival.duration ?? 1;
    return {
      startDate,
      endDate: { ...startDate },
      allDay: festival.allDay ?? true,
      repeat: 'never',
      conditionTree: festival.conditionTree ?? this.#buildFestivalConditionTree(festival, calendar),
      categories: [],
      color: festival.color || '#f0a500',
      icon: festival.icon ? `fas ${festival.icon}` : 'fas fa-masks-theater',
      iconType: 'fontawesome',
      hasDuration: festival.hasDuration ?? festivalDuration > 1,
      duration: festivalDuration,
      displayStyle: festival.displayStyle || DISPLAY_STYLES.BANNER,
      visibility: festival.visibility || NOTE_VISIBILITY.VISIBLE,
      reminderType: festival.reminderType || 'none',
      reminderOffset: festival.reminderOffset ?? 0,
      silent: festival.silent ?? true,
      linkedFestival: {
        calendarId,
        festivalKey
      }
    };
  }

  /**
   * Compute a start date for the festival note (used as the note's anchor date).
   * Prefers a fixed month/day encoded in the festival's conditionTree (the
   * authoritative source after a user edit) before falling back to the
   * legacy month/dayOfMonth fields, so re-imports of older data with stale
   * (0, 0) defaults still resolve to the correct date.
   * @param {object} festival - Festival definition
   * @param {object} currentDate - Current game time components
   * @param {object} calendar - Calendar instance
   * @returns {object} Start date { year, month, dayOfMonth, hour, minute }
   * @private
   */
  static #getFestivalStartDate(festival, currentDate, calendar) {
    const fromTree = this.deriveDateFromConditionTree(festival.conditionTree);
    if (fromTree) return { year: currentDate.year, month: fromTree.month, dayOfMonth: fromTree.dayOfMonth, hour: 0, minute: 0 };
    const fromAstro = this.#resolveAstronomicalDate(festival.conditionTree, currentDate, calendar);
    if (fromAstro) return { year: currentDate.year, month: fromAstro.month, dayOfMonth: fromAstro.dayOfMonth, hour: 0, minute: 0 };
    if (festival.month != null && festival.dayOfMonth != null) {
      return { year: currentDate.year, month: festival.month, dayOfMonth: festival.dayOfMonth, hour: 0, minute: 0 };
    }
    if (festival.dayOfYear != null) {
      const yearZero = calendar.years?.yearZero ?? 0;
      const months = calendar.monthsArray ?? [];
      let remaining = festival.dayOfYear;
      let month = 0;
      for (let m = 0; m < months.length; m++) {
        const daysInMonth = calendar.getDaysInMonth(m, currentDate.year - yearZero);
        if (remaining < daysInMonth) {
          month = m;
          break;
        }
        remaining -= daysInMonth;
        month = m + 1;
      }
      return { year: currentDate.year, month, dayOfMonth: remaining, hour: 0, minute: 0 };
    }
    return { year: currentDate.year, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
  }

  /**
   * Extract a fixed { month, dayOfMonth } (0-indexed) from a simple
   * "month == M AND day == D" condition tree, optionally wrapped in an
   * isLeapYear group. Returns null for trees that aren't a fixed date.
   * @param {object|null} tree - Condition tree from a festival or note
   * @returns {{month: number, dayOfMonth: number}|null} 0-indexed date or null if the tree isn't a fixed-date pattern
   */
  static deriveDateFromConditionTree(tree) {
    if (!tree || typeof tree !== 'object') return null;
    const inner = this.#unwrapLeapYearGroup(tree);
    if (!inner || inner.type !== 'group' || inner.mode !== 'and' || !Array.isArray(inner.children)) return null;
    let month = null;
    let day = null;
    for (const child of inner.children) {
      if (child?.type !== 'condition' || child.op !== '==') continue;
      const value = Number(child.value);
      if (!Number.isFinite(value)) continue;
      if (child.field === 'month') month = value - 1;
      else if (child.field === 'day') day = value - 1;
    }
    if (month == null || day == null || month < 0 || day < 0) return null;
    return { month, dayOfMonth: day };
  }

  /**
   * If the tree is `isLeapYear AND <inner>`, return the inner group; otherwise return the tree as-is.
   * @param {object} tree - Condition tree
   * @returns {object|null} The inner group if leap-year wrapped, the original tree otherwise
   * @private
   */
  static #unwrapLeapYearGroup(tree) {
    if (tree?.type !== 'group' || tree.mode !== 'and' || !Array.isArray(tree.children) || tree.children.length !== 2) return tree;
    const [a, b] = tree.children;
    const isLeapCheck = (c) => c?.type === 'condition' && c.field === 'isLeapYear';
    if (isLeapCheck(a)) return b;
    if (isLeapCheck(b)) return a;
    return tree;
  }

  /**
   * Resolve an astronomical date (equinox/solstice) from a condition tree.
   * @param {object|null} tree - Condition tree
   * @param {object} currentDate - Current date components
   * @param {object} calendar - Calendar instance
   * @returns {{month: number, dayOfMonth: number}|null} 0-indexed date or null
   * @private
   */
  static #resolveAstronomicalDate(tree, currentDate, calendar) {
    if (!tree || !calendar) return null;
    const astroField = this.#findAstronomicalField(tree);
    if (!astroField) return null;
    const seasons = calendar.seasonsArray ?? [];
    if (!seasons.length) return null;
    const yearZero = calendar.years?.yearZero ?? 0;
    const totalDays = calendar.getDaysInYear?.(currentDate.year - yearZero) ?? 365;
    let summerIdx = seasons.findIndex((s) => /summer/i.test(s.name));
    let winterIdx = seasons.findIndex((s) => /winter/i.test(s.name));
    let springIdx = seasons.findIndex((s) => /spring/i.test(s.name));
    let autumnIdx = seasons.findIndex((s) => /autumn|fall/i.test(s.name));
    if (summerIdx === -1 && seasons.length >= 4) summerIdx = 1;
    if (winterIdx === -1 && seasons.length >= 4) winterIdx = 3;
    if (springIdx === -1 && seasons.length >= 4) springIdx = 0;
    if (autumnIdx === -1 && seasons.length >= 4) autumnIdx = 2;
    let dayOfYear = null;
    switch (astroField) {
      case 'isLongestDay': {
        if (summerIdx === -1) return null;
        const s = seasons[summerIdx];
        dayOfYear = getMidpoint(s.dayStart ?? 0, s.dayEnd ?? 0, totalDays);
        break;
      }
      case 'isShortestDay': {
        if (winterIdx === -1) return null;
        const s = seasons[winterIdx];
        dayOfYear = getMidpoint(s.dayStart ?? 0, s.dayEnd ?? 0, totalDays);
        break;
      }
      case 'isSpringEquinox':
        if (springIdx === -1) return null;
        dayOfYear = seasons[springIdx].dayStart ?? 0;
        break;
      case 'isAutumnEquinox':
        if (autumnIdx === -1) return null;
        dayOfYear = seasons[autumnIdx].dayStart ?? 0;
        break;
    }
    if (dayOfYear == null) return null;
    const months = calendar.monthsArray ?? [];
    let remaining = dayOfYear;
    for (let m = 0; m < months.length; m++) {
      const daysInMonth = calendar.getDaysInMonth(m, currentDate.year - yearZero);
      if (remaining < daysInMonth) return { month: m, dayOfMonth: remaining };
      remaining -= daysInMonth;
    }
    return null;
  }

  /**
   * Find an astronomical condition field in a condition tree.
   * @param {object} node - Condition tree node
   * @returns {string|null} Field name or null
   * @private
   */
  static #findAstronomicalField(node) {
    if (!node) return null;
    const astroFields = new Set(['isLongestDay', 'isShortestDay', 'isSpringEquinox', 'isAutumnEquinox']);
    if (node.type === 'condition' && astroFields.has(node.field)) return node.field;
    if (node.children) {
      for (const child of node.children) {
        const found = this.#findAstronomicalField(child);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Build a condition tree for yearly festival recurrence
   * @param {object} festival - Festival definition
   * @param {object} _calendar - Calendar instance (reserved for future)
   * @returns {object} Condition tree
   * @private
   */
  static #buildFestivalConditionTree(festival, _calendar) {
    let dateCondition;
    if (festival.dayOfYear != null) {
      dateCondition = { type: 'condition', field: 'dayOfYear', op: '==', value: festival.dayOfYear + 1 };
    } else if (festival.month != null && festival.dayOfMonth != null) {
      dateCondition = {
        type: 'group',
        mode: 'and',
        children: [
          { type: 'condition', field: 'month', op: '==', value: festival.month + 1 },
          { type: 'condition', field: 'day', op: '==', value: festival.dayOfMonth + 1 }
        ]
      };
    } else {
      return { type: 'group', mode: 'and', children: [] };
    }
    if (festival.leapYearOnly) return { type: 'group', mode: 'and', children: [{ type: 'condition', field: 'isLeapYear', op: '==', value: 1 }, dateCondition] };
    return dateCondition;
  }
}
