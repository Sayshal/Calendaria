import { DISPLAY_STYLES, MODULE, NOTE_VISIBILITY, SETTINGS } from '../constants.mjs';
import { NoteManager } from '../notes/_module.mjs';
import { localize, log } from '../utils/_module.mjs';
import { findSeasonIndexByType, getMidpoint, getSeasonDayOfYearBounds } from '../utils/calendar-math.mjs';

/** Creates and manages festival journal notes. */
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
   * Seed missing festival notes for a calendar from its `calendar.festivals` template.
   * @param {string} calendarId - Calendar ID
   * @param {object} calendar - Calendar instance
   * @returns {Promise<number>} Number of notes created
   */
  static async seedFestivalNotes(calendarId, calendar) {
    if (!game.user?.isGM || !calendarId || !calendar) return 0;
    const seeded = game.settings.get(MODULE.ID, SETTINGS.SEEDED_CALENDARS) ?? new Set();
    if (seeded.has(calendarId)) return 0;
    const festivals = calendar.festivals ?? {};
    const festivalEntries = Object.entries(festivals);
    const existing = new Set(this.getFestivalNotes(calendarId).map((s) => s.flagData?.linkedFestival?.festivalKey));
    let created = 0;
    for (const [key, festival] of festivalEntries) {
      if (existing.has(key)) continue;
      await this.createFestivalNote(calendarId, key, festival, calendar);
      created++;
    }
    const next = seeded instanceof Set ? new Set(seeded) : new Set(seeded);
    next.add(calendarId);
    await game.settings.set(MODULE.ID, SETTINGS.SEEDED_CALENDARS, next);
    if (created) log(3, `Seeded ${created} festival notes for ${calendarId}`);
    return created;
  }

  /**
   * Clear the seed record for a calendar so the next seedFestivalNotes call runs again.
   * @param {string} calendarId - Calendar ID
   * @returns {Promise<void>}
   */
  static async clearSeedRecord(calendarId) {
    if (!game.user?.isGM || !calendarId) return;
    const seeded = game.settings.get(MODULE.ID, SETTINGS.SEEDED_CALENDARS) ?? new Set();
    if (!seeded.has(calendarId)) return;
    const next = new Set(seeded);
    next.delete(calendarId);
    await game.settings.set(MODULE.ID, SETTINGS.SEEDED_CALENDARS, next);
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
   * @param {string} festivalKey - Festival key
   * @returns {object|null} Note stub or null
   */
  static getFestivalNoteByKey(calendarId, festivalKey) {
    return this.getFestivalNotes(calendarId).find((stub) => stub.flagData.linkedFestival.festivalKey === festivalKey) || null;
  }

  /**
   * Extract a fixed { month, dayOfMonth } from a condition tree, unwrapping leap-year guards.
   * @param {object|null} tree - Condition tree
   * @returns {{month: number, dayOfMonth: number}|null} 0-indexed date or null
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
   * Map a calendar festival seed to note system data.
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
      conditionTree: festival.conditionTree ?? this.#buildFestivalConditionTree(festival),
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
      linkedFestival: { calendarId, festivalKey, countsForWeekday: festival.countsForWeekday ?? true, leapYearOnly: !!festival.leapYearOnly, leapDuration: festival.leapDuration ?? null }
    };
  }

  /**
   * Compute a seed-time start date for a festival note.
   * @param {object} festival - Festival definition
   * @param {object} currentDate - Current game time components
   * @param {object} calendar - Calendar instance
   * @returns {object} Start date { year, month, dayOfMonth, hour, minute }
   * @private
   */
  static #getFestivalStartDate(festival, currentDate, calendar) {
    const yearZero = calendar?.years?.yearZero ?? 0;
    const displayedYear = (currentDate.year ?? 0) + yearZero;
    const fromTree = this.deriveDateFromConditionTree(festival.conditionTree);
    if (fromTree) return { year: displayedYear, month: fromTree.month, dayOfMonth: fromTree.dayOfMonth, hour: 0, minute: 0 };
    const fromAstro = this.#resolveAstronomicalDate(festival.conditionTree, currentDate, calendar);
    if (fromAstro) return { year: displayedYear, month: fromAstro.month, dayOfMonth: fromAstro.dayOfMonth, hour: 0, minute: 0 };
    if (festival.month != null && festival.dayOfMonth != null) return { year: displayedYear, month: festival.month, dayOfMonth: festival.dayOfMonth, hour: 0, minute: 0 };
    if (festival.dayOfYear != null) {
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
      return { year: displayedYear, month, dayOfMonth: remaining, hour: 0, minute: 0 };
    }
    return { year: displayedYear, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
  }

  /**
   * If the tree is `isLeapYear AND <inner>`, return the inner group; otherwise return the tree as-is.
   * @param {object} tree - Condition tree
   * @returns {object|null} Inner group or the original tree.
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
   * @returns {{month: number, dayOfMonth: number}|null} 0-indexed resolved date or null.
   * @private
   */
  static #resolveAstronomicalDate(tree, currentDate, calendar) {
    if (!tree || !calendar) return null;
    const astroField = this.#findAstronomicalField(tree);
    if (!astroField) return null;
    const seasons = calendar.seasonsArray ?? [];
    if (!seasons.length) return null;
    const yearZero = calendar.years?.yearZero ?? 0;
    const internalYear = currentDate.year - yearZero;
    const totalDays = calendar.getDaysInYear?.(internalYear) ?? 365;
    const typeMap = { isLongestDay: 'summer', isShortestDay: 'winter', isSpringEquinox: 'spring', isAutumnEquinox: 'autumn' };
    const seasonalType = typeMap[astroField];
    if (!seasonalType) return null;
    const idx = findSeasonIndexByType(seasons, seasonalType);
    if (idx === -1) return null;
    const bounds = getSeasonDayOfYearBounds(seasons[idx], calendar, internalYear);
    if (!bounds) return null;
    const dayOfYear = astroField === 'isLongestDay' || astroField === 'isShortestDay' ? getMidpoint(bounds.startDoY, bounds.endDoY, totalDays) : bounds.startDoY;
    const months = calendar.monthsArray ?? [];
    let remaining = dayOfYear;
    for (let m = 0; m < months.length; m++) {
      const daysInMonth = calendar.getDaysInMonth(m, internalYear);
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
   * Build a condition tree for yearly festival recurrence from a seed definition.
   * @param {object} festival - Festival definition
   * @returns {object} Condition tree representing the recurrence pattern.
   * @private
   */
  static #buildFestivalConditionTree(festival) {
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
