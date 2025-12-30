/**
 * Note Manager
 * Main entry point for calendar notes system management.
 * Handles note creation, indexing, and retrieval with JournalEntry integration.
 * @module Notes/NoteManager
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SETTINGS } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { createNoteStub, getCategoryDefinition, getDefaultNoteData, getPredefinedCategories, sanitizeNoteData, validateNoteData } from './note-data.mjs';
import { compareDates } from './utils/date-utils.mjs';
import { getOccurrencesInRange, getRecurrenceDescription, isRecurringMatch } from './utils/recurrence.mjs';

/**
 * Main entry point for calendar notes system management.
 * Handles note creation, indexing, and retrieval with JournalEntry integration.
 */
export default class NoteManager {
  /** @type {Map<string, object>} In-memory index of note stubs */
  static #noteIndex = new Map();

  /** @type {boolean} Whether the index has been built */
  static #initialized = false;

  /** @type {string|null} Calendar notes folder ID */
  static #notesFolderId = null;

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Initialize the note manager.
   * Called during module initialization.
   */
  static async initialize() {
    await this.#buildIndex();
    if (game.user.isGM) {
      await this.getCalendarNotesFolder();
      await this.#initializeActiveCalendarJournal();
    }

    this.#initialized = true;
    log(3, 'Note Manager initialized');
  }

  /**
   * Initialize the calendar journal for the active calendar.
   * Creates the journal, description page, and month pages if they don't exist.
   * @returns {Promise<void>}
   * @private
   */
  static async #initializeActiveCalendarJournal() {
    try {
      const activeCalendar = CalendarManager.getActiveCalendar();
      if (!activeCalendar || !activeCalendar.metadata?.id) {
        log(2, 'No active calendar found during initialization');
        return;
      }

      const calendarId = activeCalendar.metadata.id;
      const journal = await this.getCalendarJournal(calendarId, activeCalendar);
      if (journal) log(3, `Initialized calendar journal for: ${calendarId}`);
    } catch (error) {
      log(1, 'Error initializing active calendar journal:', error);
    }
  }

  /**
   * Build the in-memory index of all calendar notes.
   * @private
   */
  static async #buildIndex() {
    this.#noteIndex.clear();
    for (const journal of game.journal) {
      for (const page of journal.pages) {
        const stub = createNoteStub(page);
        if (stub) {
          this.#noteIndex.set(page.id, stub);
          log(3, `Indexed calendar note: ${page.name}`);
        }
      }
    }

    log(3, `Built note index with ${this.#noteIndex.size} notes`);
  }

  /* -------------------------------------------- */
  /*  Hook Handlers                               */
  /* -------------------------------------------- */

  /**
   * Handle createJournalEntryPage hook.
   * @param {object} page - The created page
   * @param {object} _options - Creation options
   * @param {string} _userId - User ID who created the page
   */
  static onCreateJournalEntryPage(page, _options, _userId) {
    const stub = createNoteStub(page);
    if (stub) {
      NoteManager.#noteIndex.set(page.id, stub);
      log(3, `Added note to index: ${page.name}`);
      Hooks.callAll(HOOKS.NOTE_CREATED, stub);
    }
  }

  /**
   * Handle updateJournalEntryPage hook.
   * @param {object} page - The updated page
   * @param {object} _changes - The changes made
   * @param {object} _options - Update options
   * @param {string} _userId - User ID who updated the page
   */
  static onUpdateJournalEntryPage(page, _changes, _options, _userId) {
    const stub = createNoteStub(page);
    if (stub) {
      NoteManager.#noteIndex.set(page.id, stub);
      log(3, `Updated note in index: ${page.name}`);
      Hooks.callAll(HOOKS.NOTE_UPDATED, stub);
    } else {
      if (NoteManager.#noteIndex.has(page.id)) {
        NoteManager.#noteIndex.delete(page.id);
        log(3, `Removed note from index: ${page.name}`);
        Hooks.callAll(HOOKS.NOTE_DELETED, page.id);
      }
    }

    if (page.getFlag(MODULE.ID, 'isDescriptionPage')) NoteManager.#syncDescriptionToCalendar(page);
  }

  /**
   * Handle deleteJournalEntryPage hook.
   * @param {object} page - The deleted page
   * @param {object} _options - Deletion options
   * @param {string} _userId - User ID who deleted the page
   */
  static onDeleteJournalEntryPage(page, _options, _userId) {
    if (NoteManager.#noteIndex.has(page.id)) {
      NoteManager.#noteIndex.delete(page.id);
      log(3, `Deleted note from index: ${page.name}`);
      Hooks.callAll(HOOKS.NOTE_DELETED, page.id);
    }
  }

  /**
   * Handle calendaria.calendarSwitched hook.
   * @param {string} calendarId - The calendar ID that was switched to
   * @param {object} calendar - The calendar that was switched to
   */
  static async onCalendarSwitched(calendarId, calendar) {
    if (game.user.isGM && calendar) {
      await NoteManager.getCalendarJournal(calendarId, calendar);
      log(3, `Ensured calendar journal exists for: ${calendarId}`);
    }
  }

  /**
   * Handle preDeleteJournalEntry hook.
   * @param {JournalEntry} journal - The journal about to be deleted
   * @param {object} _options - Deletion options
   * @param {string} _userId - User ID attempting deletion
   * @returns {boolean|void} False to prevent deletion
   * @todo Localize
   */
  static onPreDeleteJournalEntry(journal, _options, _userId) {
    if (game.settings.get(MODULE.ID, SETTINGS.DEV_MODE)) return;
    const isCalendarJournal = journal.getFlag(MODULE.ID, 'isCalendarJournal');
    if (isCalendarJournal) {
      ui.notifications.warn('Cannot delete calendar journal. This journal contains the calendar structure and all events.');
      log(2, `Prevented deletion of calendar journal: ${journal.name}`);
      return false;
    }
  }

  /**
   * Handle preDeleteFolder hook.
   * @param {Folder} folder - The folder about to be deleted
   * @param {object} _options - Deletion options
   * @param {string} _userId - User ID attempting deletion
   * @returns {boolean|void} False to prevent deletion
   * @todo Localize
   */
  static onPreDeleteFolder(folder, _options, _userId) {
    if (game.settings.get(MODULE.ID, SETTINGS.DEV_MODE)) return;
    const isCalendarNotesFolder = folder.getFlag(MODULE.ID, 'isCalendarNotesFolder');
    if (isCalendarNotesFolder) {
      ui.notifications.warn('Cannot delete Calendar Notes folder. This folder contains all calendar journals and events.');
      log(2, `Prevented deletion of Calendar Notes folder: ${folder.name}`);
      return false;
    }
  }

  /* -------------------------------------------- */
  /*  CRUD Operations                             */
  /* -------------------------------------------- */

  /**
   * Create a new calendar note.
   * @param {object} options  Note creation options
   * @param {string} options.name  Journal entry name
   * @param {string} [options.content]  Journal entry content (HTML)
   * @param {object} options.noteData  Calendar note data
   * @param {string} [options.calendarId]  Calendar ID (defaults to active calendar)
   * @param {object} [options.journalData]  Additional journal entry data
   * @returns {Promise<object>} Created journal entry page
   */
  static async createNote({ name, content = '', noteData, calendarId, journalData = {} }) {
    const validation = validateNoteData(noteData);
    if (!validation.valid) log(1, `Invalid note data: ${validation.errors.join(', ')}`);
    const sanitized = sanitizeNoteData(noteData);
    if (!calendarId) {
      const activeCalendar = CalendarManager.getActiveCalendar();
      if (!activeCalendar || !activeCalendar.metadata?.id) throw new Error('No active calendar found');
      calendarId = activeCalendar.metadata.id;
    }

    const calendar = CalendarManager.getCalendar(calendarId);
    if (!calendar) throw new Error(`Calendar not found: ${calendarId}`);
    const journal = await this.getCalendarJournal(calendarId, calendar);
    if (!journal) throw new Error('Failed to get or create calendar journal');
    const monthIndex = sanitized.startDate.month;
    if (monthIndex === undefined || monthIndex < 0 || monthIndex >= calendar.months.values.length) throw new Error(`Invalid month index: ${monthIndex}`);
    const monthPage = this.getMonthPage(journal, monthIndex);
    if (!monthPage) throw new Error(`Month page not found for index: ${monthIndex}`);

    try {
      const dayOfMonth = sanitized.startDate.day;
      const sort = monthPage.sort + dayOfMonth;
      const page = await JournalEntryPage.create(
        { name, type: 'calendaria.calendarnote', system: sanitized, text: { content }, title: { level: 2, show: true }, flags: { [MODULE.ID]: { monthIndex, calendarId } }, sort, ...journalData },
        { parent: journal }
      );

      log(3, `Created calendar note page: ${name} under ${monthPage.name}`);
      return page;
    } catch (error) {
      log(1, `Error creating calendar note page:`, error);
    }
  }

  /**
   * Update an existing calendar note.
   * @param {string} pageId  Journal entry page ID
   * @param {object} updates  Updates to apply
   * @param {string} [updates.name]  New name
   * @param {object} [updates.noteData]  Calendar note data updates (system data)
   * @returns {Promise<object>} Updated journal entry page
   */
  static async updateNote(pageId, updates) {
    let page = null;
    for (const journal of game.journal) {
      page = journal.pages.get(pageId);
      if (page) break;
    }

    if (!page) throw new Error(`Journal entry page not found: ${pageId}`);
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.noteData) {
      const currentNoteData = page.system || {};
      const mergedNoteData = foundry.utils.mergeObject(currentNoteData, updates.noteData);
      const validation = validateNoteData(mergedNoteData);
      if (!validation.valid) log(1, `Invalid note data: ${validation.errors.join(', ')}`);
      updateData.system = sanitizeNoteData(mergedNoteData);
    }

    try {
      await page.update(updateData);
      log(3, `Updated calendar note: ${page.name}`);
      return page;
    } catch (error) {
      log(1, `Error updating calendar note:`, error);
    }
  }

  /**
   * Delete a calendar note.
   * @param {string} pageId - Journal entry page ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async deleteNote(pageId) {
    let page = null;
    for (const journal of game.journal) {
      page = journal.pages.get(pageId);
      if (page) break;
    }

    if (!page) throw new Error(`Journal entry page not found: ${pageId}`);

    try {
      await page.delete();
      log(3, `Deleted calendar note: ${page.name}`);
      return true;
    } catch (error) {
      log(1, `Error deleting calendar note:`, error);
      ui.notifications.error(`Error deleting note: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a note stub from the index.
   * @param {string} pageId  Journal entry page ID
   * @returns {object|null}  Note stub or null
   */
  static getNote(pageId) {
    return this.#noteIndex.get(pageId) || null;
  }

  /**
   * Get full journal entry page for a note.
   * @param {string} pageId  Journal entry page ID
   * @returns {object|null}  Journal entry page or null
   */
  static getFullNote(pageId) {
    for (const journal of game.journal) {
      const page = journal.pages.get(pageId);
      if (page) return page;
    }
    return null;
  }

  /**
   * Get all note stubs.
   * @returns {object[]}  Array of note stubs
   */
  static getAllNotes() {
    return Array.from(this.#noteIndex.values());
  }

  /**
   * Delete all calendar notes.
   * @param {object} [_options] - Options
   * @param {string} [_options.calendarId] - Only delete notes for this calendar (not yet implemented)
   * @returns {Promise<number>} Number of notes deleted
   * @todo Implement options.calendarId feature
   */
  static async deleteAllNotes(_options = {}) {
    if (!game.user.isGM) return 0;
    const allNotes = this.getAllNotes();
    if (allNotes.length === 0) return 0;
    const pagesToDelete = [];
    for (const note of allNotes) {
      const page = this.getFullNote(note.id);
      if (page) pagesToDelete.push(page);
    }

    let deletedCount = 0;
    for (const page of pagesToDelete) {
      try {
        await page.delete();
        deletedCount++;
      } catch (error) {
        log(1, `Error deleting note ${page.name}:`, error);
      }
    }

    log(3, `Deleted ${deletedCount} calendar notes`);
    return deletedCount;
  }

  /* -------------------------------------------- */
  /*  Date Queries                                */
  /* -------------------------------------------- */

  /**
   * Get all notes for a specific date.
   * @param {number} year  Year
   * @param {number} month  Month (0-indexed)
   * @param {number} day  Day of month
   * @param {string} [calendarId]  Optional calendar ID filter (defaults to active calendar)
   * @returns {object[]}  Array of note stubs
   */
  static getNotesForDate(year, month, day, calendarId = null) {
    const targetDate = { year, month, day };
    const matchingNotes = [];
    const targetCalendarId = calendarId || CalendarManager.getActiveCalendar()?.metadata?.id;
    for (const stub of this.#noteIndex.values()) {
      if (!stub.visible) continue;
      if (targetCalendarId && stub.calendarId !== targetCalendarId) continue;
      if (this.#matchesDate(stub, targetDate)) matchingNotes.push(stub);
    }

    matchingNotes.sort((a, b) => {
      const aTime = a.flagData.allDay ? 0 : a.flagData.startDate.hour * 60 + a.flagData.startDate.minute;
      const bTime = b.flagData.allDay ? 0 : b.flagData.startDate.hour * 60 + b.flagData.startDate.minute;
      return aTime - bTime;
    });

    return matchingNotes;
  }

  /**
   * Get all notes within a date range.
   * @param {object} startDate  Range start date
   * @param {object} endDate  Range end date
   * @param {string} [calendarId]  Optional calendar ID filter (defaults to active calendar)
   * @returns {object[]}  Array of note stubs
   */
  static getNotesInRange(startDate, endDate, calendarId = null) {
    const matchingNotes = [];
    const targetCalendarId = calendarId || CalendarManager.getActiveCalendar()?.metadata?.id;
    for (const stub of this.#noteIndex.values()) {
      if (!stub.visible) continue;
      if (targetCalendarId && stub.calendarId !== targetCalendarId) continue;
      const noteStart = stub.flagData.startDate;
      const noteEnd = stub.flagData.endDate;
      const startsInRange = compareDates(noteStart, startDate) >= 0 && compareDates(noteStart, endDate) <= 0;
      const endsInRange = noteEnd && compareDates(noteEnd, startDate) >= 0 && compareDates(noteEnd, endDate) <= 0;
      const spansRange = noteEnd && compareDates(noteStart, startDate) < 0 && compareDates(noteEnd, endDate) > 0;
      if (startsInRange || endsInRange || spansRange) matchingNotes.push(stub);
      else if (stub.flagData.repeat && stub.flagData.repeat !== 'never') {
        const occurrences = getOccurrencesInRange(stub.flagData, startDate, endDate, 10);
        if (occurrences.length > 0) matchingNotes.push(stub);
      }
    }

    return matchingNotes;
  }

  /**
   * Check if a note matches a specific date.
   * @param {object} noteStub  Note stub
   * @param {object} targetDate  Target date
   * @returns {boolean}  True if matches
   * @private
   */
  static #matchesDate(noteStub, targetDate) {
    return isRecurringMatch(noteStub.flagData, targetDate);
  }

  /* -------------------------------------------- */
  /*  Categories & Filtering                      */
  /* -------------------------------------------- */

  /**
   * Get notes by category.
   * @param {string} category  Category ID
   * @returns {object[]}  Array of note stubs
   */
  static getNotesByCategory(category) {
    return this.getAllNotes().filter((stub) => {
      return stub.flagData.categories?.includes(category);
    });
  }

  /**
   * Get all unique categories in use.
   * @returns {string[]}  Array of category IDs
   */
  static getAllCategories() {
    const categories = new Set();
    for (const stub of this.#noteIndex.values()) if (stub.flagData.categories) stub.flagData.categories.forEach((cat) => categories.add(cat));
    return Array.from(categories);
  }

  /**
   * Get predefined category definitions.
   * @returns {object[]}  Array of category definitions
   */
  static getCategoryDefinitions() {
    return getPredefinedCategories();
  }

  /**
   * Get category definition by ID.
   * @param {string} categoryId  Category ID
   * @returns {object|null}  Category definition or null
   */
  static getCategoryDefinition(categoryId) {
    return getCategoryDefinition(categoryId);
  }

  /* -------------------------------------------- */
  /*  Calendar Journal Management                 */
  /* -------------------------------------------- */

  /**
   * Get or create the Journal for a specific calendar.
   * Creates the description page and month pages if they don't exist.
   * @param {string} calendarId  Calendar ID
   * @param {object} calendar  Calendar data
   * @returns {Promise<JournalEntry|null>}  Calendar journal or null
   */
  static async getCalendarJournal(calendarId, calendar) {
    if (!calendar) {
      log(2, `Cannot get calendar journal: calendar ${calendarId} not found`);
      return null;
    }

    const folder = await this.getCalendarNotesFolder();
    const existing = game.journal.find((j) => {
      const flagId = j.getFlag(MODULE.ID, 'calendarId');
      return flagId === calendarId;
    });

    if (existing) {
      await this.#ensureDescriptionPage(existing, calendar);
      await this.#ensureMonthPages(existing, calendar);
      return existing;
    }

    if (game.user.isGM) {
      try {
        let calendarName = calendar.name || calendarId;
        if (calendarName.includes('.')) calendarName = localize(calendarName);
        const journal = await JournalEntry.create({ name: calendarName, folder: folder?.id, flags: { [MODULE.ID]: { calendarId, isCalendarJournal: true } } });
        log(3, `Created calendar journal: ${journal.name}`);
        await this.#ensureDescriptionPage(journal, calendar);
        await this.#ensureMonthPages(journal, calendar);
        return journal;
      } catch (error) {
        log(1, 'Error creating calendar journal:', error);
        return null;
      }
    }

    return null;
  }

  /**
   * Ensure the description page exists and is synced with calendar.
   * @param {JournalEntry} journal  Calendar journal
   * @param {object} calendar  Calendar data
   * @returns {Promise<object|null>}  Description page
   * @todo Localize
   * @private
   */
  static async #ensureDescriptionPage(journal, calendar) {
    const existing = journal.pages.find((p) => p.getFlag(MODULE.ID, 'isDescriptionPage'));
    const description = calendar.metadata?.description || calendar.description || '';

    if (existing) {
      if (existing.text?.content !== description) {
        await existing.update({ 'text.content': description });
        log(3, `Updated description page for ${journal.name}`);
      }
      return existing;
    }

    try {
      const page = await JournalEntryPage.create(
        { name: 'Calendar Description', type: 'text', text: { content: description }, title: { level: 1, show: true }, flags: { [MODULE.ID]: { isDescriptionPage: true } }, sort: 0 },
        { parent: journal }
      );
      log(3, `Created description page for ${journal.name}`);
      return page;
    } catch (error) {
      log(1, 'Error creating description page:', error);
      return null;
    }
  }

  /**
   * Ensure month pages exist for all months in the calendar.
   * @param {JournalEntry} journal  Calendar journal
   * @param {object} calendar  Calendar data
   * @returns {Promise<object[]>}  Array of month pages
   * @private
   */
  static async #ensureMonthPages(journal, calendar) {
    const monthPages = [];
    const existingMonthPages = journal.pages.filter((p) => p.getFlag(MODULE.ID, 'monthIndex') !== undefined);
    const monthPageMap = new Map();
    for (const page of existingMonthPages) {
      const monthIndex = page.getFlag(MODULE.ID, 'monthIndex');
      monthPageMap.set(monthIndex, page);
    }

    for (let i = 0; i < calendar.months.values.length; i++) {
      const month = calendar.months.values[i];
      if (monthPageMap.has(i)) {
        monthPages.push(monthPageMap.get(i));
      } else {
        try {
          const monthName = localize(month.name);
          const page = await JournalEntryPage.create(
            {
              name: monthName,
              type: 'text',
              text: { content: `<p>Events for this month will appear below.</p>` },
              title: { level: 1, show: true },
              flags: { [MODULE.ID]: { isMonthPage: true, monthIndex: i } },
              sort: (i + 1) * 1000
            },
            { parent: journal }
          );

          log(3, `Created month page for ${monthName}`);
          monthPages.push(page);
        } catch (error) {
          log(1, `Error creating month page for index ${i}:`, error);
        }
      }
    }

    return monthPages;
  }

  /**
   * Get the month page for a specific month index.
   * @param {JournalEntry} journal  Calendar journal
   * @param {number} monthIndex  Month index (0-based)
   * @returns {object|null}  Month page or null
   */
  static getMonthPage(journal, monthIndex) {
    return journal.pages.find((p) => p.getFlag(MODULE.ID, 'monthIndex') === monthIndex) || null;
  }

  /**
   * Sync description page content to calendar.metadata.description.
   * @param {object} page  Description page
   * @returns {Promise<void>}
   * @private
   */
  static async #syncDescriptionToCalendar(page) {
    const journal = page.parent;
    if (!journal) return;
    const calendarId = journal.getFlag(MODULE.ID, 'calendarId');
    if (!calendarId) return;
    const calendar = CalendarManager.getCalendar(calendarId);
    if (!calendar) return;
    const newDescription = page.text?.content || '';
    const currentDescription = calendar.metadata?.description || calendar.description || '';
    if (newDescription === currentDescription) return;
    if (calendar.metadata) calendar.metadata.description = newDescription;
    else calendar.description = newDescription;
    log(3, `Synced description from journal to calendar ${calendarId}`);
    if (game.user.isGM) await CalendarManager.saveCalendars();
  }

  /* -------------------------------------------- */
  /*  Utilities                                   */
  /* -------------------------------------------- */

  /**
   * Get or create the Calendar Notes folder.
   * @returns {Promise<Folder|null>}  Folder document or null
   * @todo Localize
   */
  static async getCalendarNotesFolder() {
    if (this.#notesFolderId) {
      const folder = game.folders.get(this.#notesFolderId);
      if (folder) return folder;
    }

    const existing = game.folders.find((f) => {
      const isCalendarFolder = f.getFlag(MODULE.ID, 'isCalendarNotesFolder');
      return f.type === 'JournalEntry' && isCalendarFolder;
    });

    if (existing) {
      this.#notesFolderId = existing.id;
      return existing;
    }

    if (game.user.isGM) {
      try {
        const folder = await Folder.create({ name: 'Calendar Notes', type: 'JournalEntry', color: '#4a9eff', flags: { [MODULE.ID]: { isCalendarNotesFolder: true } } });
        this.#notesFolderId = folder.id;
        log(3, 'Created Calendar Notes folder');
        return folder;
      } catch (error) {
        log(1, 'Error creating Calendar Notes folder:', error);
        return null;
      }
    }

    return null;
  }

  /**
   * Get default note data for a specific date.
   * @param {number} year  Year
   * @param {number} month  Month (0-indexed)
   * @param {number} day  Day
   * @param {number} [hour]  Hour (optional)
   * @param {number} [minute]  Minute (optional)
   * @returns {object}  Default note data
   */
  static getDefaultNoteDataForDate(year, month, day, hour, minute) {
    const defaults = getDefaultNoteData();
    defaults.startDate = { year, month, day, hour: hour ?? 0, minute: minute ?? 0 };
    return defaults;
  }

  /**
   * Get recurrence description for a note.
   * @param {string} journalId  Journal entry ID
   * @returns {string}  Human-readable recurrence description
   */
  static getRecurrenceDescription(journalId) {
    const stub = this.getNote(journalId);
    if (!stub) return 'Unknown';
    return getRecurrenceDescription(stub.flagData);
  }

  /**
   * Check if note manager is initialized.
   * @returns {boolean}  True if initialized
   */
  static isInitialized() {
    return this.#initialized;
  }
}
