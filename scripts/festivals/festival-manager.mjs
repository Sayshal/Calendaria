/**
 * Festival Template Utility
 * @module Festivals/FestivalManager
 * @author Tyler
 */

import { DISPLAY_STYLES, NOTE_VISIBILITY } from '../constants.mjs';
import { NoteManager } from '../notes/_module.mjs';
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
   * @param {object} festival - Festival definition
   * @param {object} currentDate - Current game time components
   * @param {object} calendar - Calendar instance
   * @returns {object} Start date { year, month, dayOfMonth, hour, minute }
   * @private
   */
  static #getFestivalStartDate(festival, currentDate, calendar) {
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
