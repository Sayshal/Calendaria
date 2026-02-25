/**
 * Note Manager
 * @module Notes/NoteManager
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SETTINGS, SOCKET_TYPES } from '../constants.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { canAddNotes, canDeleteNotes, getUsersWithPermission } from '../utils/permissions.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';
import { compareDates } from './date-utils.mjs';
import { createNoteStub, getCategoryDefinition, getDefaultNoteData, getPredefinedCategories, sanitizeNoteData, validateNoteData } from './note-data.mjs';
import { getOccurrencesInRange, getRecurrenceDescription, isRecurringMatch } from './recurrence.mjs';

/**
 * Main entry point for calendar notes system management.
 */
export default class NoteManager {
  /** @type {Map<string, object>} In-memory index of note stubs */
  static #noteIndex = new Map();

  /** @type {boolean} Whether the index has been built */
  static #initialized = false;

  /** @type {string|null} Calendar notes folder ID */
  static #notesFolderId = null;

  /** @type {boolean} Bypass flag for internal cleanup operations */
  static #bypassDeleteProtection = false;

  /**
   * Initialize the note manager.
   */
  static async initialize() {
    await this.#buildIndex();
    if (game.user.isGM) {
      await this.getCalendarNotesFolder();
      await this.#initializeActiveCalendarFolder();
      await this.#migrateCalendarJournalsToFolders();
      await this.#syncNoteOwnership();
    }
    this.#initialized = true;
    log(3, 'Note Manager initialized');
  }

  /**
   * Re-sync note ownership after editNotes permissions change.
   * @returns {Promise<void>}
   */
  static async syncNoteOwnership() {
    if (game.user.isGM) await this.#syncNoteOwnership();
  }

  /**
   * Sync ownership for all calendar notes based on editNotes permission.
   * @returns {Promise<void>}
   * @private
   */
  static async #syncNoteOwnership() {
    const usersWithPermission = getUsersWithPermission('editNotes');
    const permittedIds = new Set(usersWithPermission.map((u) => u.id));
    let updated = 0;
    for (const journal of game.journal) {
      if (!journal.getFlag(MODULE.ID, 'isCalendarNote')) continue;
      const page = journal.pages.contents[0];
      if (!page || page.system?.gmOnly) continue;
      const currentOwnership = journal.ownership || {};
      const authorId = page.system?.author?._id;
      const updateData = {};
      for (const id of permittedIds) if (currentOwnership[id] !== 3) updateData[`ownership.${id}`] = 3;
      for (const [userId, level] of Object.entries(currentOwnership)) {
        if (userId === 'default') continue;
        if (level !== 3) continue;
        if (permittedIds.has(userId)) continue;
        if (game.users.get(userId)?.isGM) continue;
        if (userId === authorId) continue;
        updateData[`ownership.-=${userId}`] = null;
      }
      if (Object.keys(updateData).length > 0) {
        await journal.update(updateData);
        updated++;
      }
    }
    if (updated > 0) log(3, `Synced ownership for ${updated} calendar notes`);
  }

  /**
   * Initialize the calendar folder for the active calendar.
   * @returns {Promise<void>}
   * @private
   */
  static async #initializeActiveCalendarFolder() {
    try {
      const activeCalendar = CalendarManager.getActiveCalendar();
      if (!activeCalendar?.metadata?.id) {
        log(2, 'No active calendar found during initialization');
        return;
      }
      const calendarId = activeCalendar.metadata.id;
      const folder = await this.getCalendarFolder(calendarId, activeCalendar);
      if (folder) log(3, `Initialized calendar folder for: ${calendarId}`);
    } catch (error) {
      log(1, 'Error initializing active calendar folder:', error);
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
   * @param {object} changes - The changes made
   * @param {object} _options - Update options
   * @param {string} _userId - User ID who updated the page
   */
  static async onUpdateJournalEntryPage(page, changes, _options, _userId) {
    const stub = createNoteStub(page);
    if (stub) {
      NoteManager.#noteIndex.set(page.id, stub);
      log(3, `Updated note in index: ${page.name}`);
      Hooks.callAll(HOOKS.NOTE_UPDATED, stub);
      if (game.user.isGM) {
        if (changes.name !== undefined) {
          const journal = page.parent;
          if (journal?.getFlag(MODULE.ID, 'isCalendarNote') && journal.name !== page.name) await journal.update({ name: page.name });
        }
        if (changes.system?.gmOnly !== undefined) {
          const journal = page.parent;
          if (journal?.getFlag(MODULE.ID, 'isCalendarNote')) {
            if (changes.system.gmOnly) {
              await journal.update({ ownership: { default: 0 } });
            } else {
              const newOwnership = { default: 2 };
              for (const user of getUsersWithPermission('editNotes')) newOwnership[user.id] = 3;
              await journal.update({ ownership: newOwnership });
            }
            log(3, `Updated journal ownership for gmOnly change: ${changes.system.gmOnly}`);
          }
        }
      }
    } else {
      if (NoteManager.#noteIndex.has(page.id)) {
        NoteManager.#noteIndex.delete(page.id);
        log(3, `Removed note from index: ${page.name}`);
        Hooks.callAll(HOOKS.NOTE_DELETED, page.id);
      }
    }
    if (game.user.isGM && page.getFlag(MODULE.ID, 'isDescriptionPage')) NoteManager.#syncDescriptionToCalendar(page);
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
   * Handle deleteJournalEntry hook.
   * @param {JournalEntry} journal - The deleted journal
   * @param {object} _options - Deletion options
   * @param {string} _userId - User ID who deleted the journal
   */
  static onDeleteJournalEntry(journal, _options, _userId) {
    for (const page of journal.pages) {
      if (NoteManager.#noteIndex.has(page.id)) {
        NoteManager.#noteIndex.delete(page.id);
        log(3, `Deleted note from index (parent deleted): ${page.name}`);
        Hooks.callAll(HOOKS.NOTE_DELETED, page.id);
      }
    }
  }

  /**
   * Handle calendaria.calendarSwitched hook.
   * @param {string} calendarId - The calendar ID that was switched to
   * @param {object} calendar - The calendar that was switched to
   */
  static async onCalendarSwitched(calendarId, calendar) {
    if (game.user.isGM && calendar) {
      await NoteManager.getCalendarFolder(calendarId, calendar);
      log(3, `Ensured calendar folder exists for: ${calendarId}`);
    }
  }

  /**
   * Handle preDeleteJournalEntry hook.
   * @param {JournalEntry} journal - The journal about to be deleted
   * @param {object} _options - Deletion options
   * @param {string} _userId - User ID attempting deletion
   * @returns {boolean|void} False to prevent deletion
   */
  static onPreDeleteJournalEntry(journal, _options, _userId) {
    if (game.settings.get(MODULE.ID, SETTINGS.DEV_MODE)) return;
    if (this.#bypassDeleteProtection) return;
    const isCalendarJournal = journal.getFlag(MODULE.ID, 'isCalendarJournal');
    if (isCalendarJournal) {
      ui.notifications.warn('CALENDARIA.Warning.CannotDeleteCalendarJournal', { localize: true });
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
   */
  static onPreDeleteFolder(folder, _options, _userId) {
    if (game.settings.get(MODULE.ID, SETTINGS.DEV_MODE)) return;
    const isCalendarNotesFolder = folder.getFlag(MODULE.ID, 'isCalendarNotesFolder');
    if (isCalendarNotesFolder) {
      ui.notifications.warn('CALENDARIA.Warning.CannotDeleteNotesFolder', { localize: true });
      log(2, `Prevented deletion of Calendar Notes folder: ${folder.name}`);
      return false;
    }
    const isCalendarFolder = folder.getFlag(MODULE.ID, 'isCalendarFolder');
    if (isCalendarFolder) {
      ui.notifications.warn('CALENDARIA.Warning.CannotDeleteCalendarFolder', { localize: true });
      log(2, `Prevented deletion of calendar folder: ${folder.name}`);
      return false;
    }
  }

  /**
   * Create a new calendar note.
   * @param {object} options  Note creation options
   * @param {string} options.name  Journal entry name
   * @param {string} [options.content]  Journal entry content (HTML)
   * @param {object} options.noteData  Calendar note data
   * @param {string} [options.calendarId]  Calendar ID (defaults to active calendar)
   * @param {object} [options.journalData]  Additional journal entry data
   * @param {string} [options.creatorId]  User ID of creator (for socket-created notes)
   * @param {false|'edit'|'view'} [options.openSheet]  Open the note sheet after creation in the given mode, or false to skip (default 'edit')
   * @returns {Promise<object>} Created journal entry page
   */
  static async createNote({ name, content = '', noteData, calendarId, journalData = {}, creatorId, openSheet = 'edit' }) {
    if (!canAddNotes()) {
      ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    const validation = validateNoteData(noteData);
    if (!validation.valid) log(1, `Invalid note data: ${validation.errors.join(', ')}`);
    const sanitized = sanitizeNoteData(noteData);
    if (!calendarId) {
      const activeCalendar = CalendarManager.getActiveCalendar();
      if (!activeCalendar?.metadata?.id) throw new Error('No active calendar found');
      calendarId = activeCalendar.metadata.id;
    }
    if (!game.user.isGM && !game.user.can('JOURNAL_CREATE')) {
      CalendariaSocket.emit(SOCKET_TYPES.CREATE_NOTE, { name, content, noteData: sanitized, calendarId, journalData, requesterId: game.user.id, openSheet });
      log(3, `Note creation requested via GM: ${name}`);
      return null;
    }
    const calendar = CalendarManager.getCalendar(calendarId);
    if (!calendar) throw new Error(`Calendar not found: ${calendarId}`);
    const folder = await this.getCalendarFolder(calendarId, calendar);
    if (!folder) throw new Error('Failed to get or create calendar folder');
    const actualCreatorId = creatorId || game.user.id;
    const ownership = sanitized.gmOnly ? { default: 0 } : { default: 2 };
    ownership[actualCreatorId] = 3;
    if (!sanitized.gmOnly) for (const user of getUsersWithPermission('editNotes')) ownership[user.id] = 3;
    const journal = await JournalEntry.create({ name, folder: folder.id, ownership, flags: { [MODULE.ID]: { calendarId, isCalendarNote: true } }, ...journalData });
    const page = await JournalEntryPage.create(
      { name, type: 'calendaria.calendarnote', system: sanitized, text: { content }, title: { level: 1, show: true }, flags: { [MODULE.ID]: { calendarId } } },
      { parent: journal }
    );
    log(3, `Created calendar note: ${name}`);
    if (openSheet) page.sheet.render(true, { mode: openSheet });
    return page;
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
    if (updates.name !== undefined) {
      updateData.name = updates.name;
      const journal = page.parent;
      if (journal?.getFlag(MODULE.ID, 'isCalendarNote')) await journal.update({ name: updates.name });
    }
    if (updates.noteData) {
      const currentNoteData = page.system || {};
      const mergedNoteData = foundry.utils.mergeObject(currentNoteData, updates.noteData);
      const validation = validateNoteData(mergedNoteData);
      if (!validation.valid) log(1, `Invalid note data: ${validation.errors.join(', ')}`);
      updateData.system = sanitizeNoteData(mergedNoteData);
    }
    await page.update(updateData);
    log(3, `Updated calendar note: ${page.name}`);
    return page;
  }

  /**
   * Delete a calendar note.
   * @param {string} pageId - Journal entry page ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async deleteNote(pageId) {
    let page = null;
    let parentJournal = null;
    for (const journal of game.journal) {
      page = journal.pages.get(pageId);
      if (page) {
        parentJournal = journal;
        break;
      }
    }
    if (!page) throw new Error(`Journal entry page not found: ${pageId}`);
    try {
      if (parentJournal?.getFlag(MODULE.ID, 'isCalendarNote')) {
        await parentJournal.delete();
        log(3, `Deleted calendar note journal: ${parentJournal.name}`);
      } else {
        await page.delete();
        log(3, `Deleted calendar note page: ${page.name}`);
      }
      return true;
    } catch (error) {
      log(1, `Error deleting calendar note:`, error);
      ui.notifications.error(format('CALENDARIA.Error.NoteDeleteFailed', { message: error.message }));
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
   * @param {object} [options] - Options
   * @param {string} [options.calendarId] - Only delete notes for this calendar
   * @returns {Promise<number>} Number of notes deleted
   */
  static async deleteAllNotes(options = {}) {
    if (!canDeleteNotes()) return 0;
    let notes = this.getAllNotes();
    if (notes.length === 0) return 0;
    if (options.calendarId) notes = notes.filter((note) => note.calendarId === options.calendarId);
    const pagesToDelete = [];
    for (const note of notes) {
      const page = this.getFullNote(note.id);
      if (page) pagesToDelete.push(page);
    }
    let deletedCount = 0;
    for (const page of pagesToDelete) {
      await page.delete();
      deletedCount++;
    }
    log(3, `Deleted ${deletedCount} calendar notes`);
    return deletedCount;
  }

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
    const minutesPerHour = CalendarManager.getActiveCalendar()?.days?.minutesPerHour ?? 60;
    matchingNotes.sort((a, b) => {
      const aTime = a.flagData.allDay ? 0 : a.flagData.startDate.hour * minutesPerHour + a.flagData.startDate.minute;
      const bTime = b.flagData.allDay ? 0 : b.flagData.startDate.hour * minutesPerHour + b.flagData.startDate.minute;
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

  /**
   * Get or create the Folder for a specific calendar's notes.
   * @param {string} calendarId  Calendar ID
   * @param {object} calendar  Calendar data
   * @returns {Promise<Folder|null>}  Calendar folder or null
   */
  static async getCalendarFolder(calendarId, calendar) {
    if (!calendar) {
      log(2, `Cannot get calendar folder: calendar ${calendarId} not found`);
      return null;
    }
    const parentFolder = await this.getCalendarNotesFolder();
    if (!parentFolder) return null;
    const existing = game.folders.find((f) => {
      const flagId = f.getFlag(MODULE.ID, 'calendarId');
      return f.type === 'JournalEntry' && flagId === calendarId;
    });
    if (existing) return existing;
    if (game.user.isGM) {
      try {
        let calendarName = calendar.name || calendarId;
        if (calendarName.includes('.')) calendarName = localize(calendarName);
        const folder = await Folder.create({ name: calendarName, type: 'JournalEntry', folder: parentFolder.id, color: '#4a9eff', flags: { [MODULE.ID]: { calendarId, isCalendarFolder: true } } });
        log(3, `Created calendar folder: ${folder.name}`);
        return folder;
      } catch (error) {
        log(1, 'Error creating calendar folder:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Migrate legacy calendar journals to new folder-based structure.
   * @returns {Promise<void>}
   * @private
   */
  static async #migrateCalendarJournalsToFolders() {
    const legacyJournals = game.journal.filter((j) => j.getFlag(MODULE.ID, 'isCalendarJournal'));
    if (legacyJournals.length === 0) return;
    log(3, `Found ${legacyJournals.length} legacy calendar journal(s) to migrate`);
    for (const journal of legacyJournals) {
      const calendarId = journal.getFlag(MODULE.ID, 'calendarId');
      if (!calendarId) continue;
      const calendar = CalendarManager.getCalendar(calendarId);
      if (!calendar) {
        if (game.user.isGM) {
          log(3, `Deleting orphaned legacy journal "${journal.name}" - calendar ${calendarId} no longer exists`);
          this.#bypassDeleteProtection = true;
          await journal.delete();
          this.#bypassDeleteProtection = false;
        }
        continue;
      }
      const folder = await this.getCalendarFolder(calendarId, calendar);
      if (!folder) continue;
      const notePages = journal.pages.filter((p) => p.type === 'calendaria.calendarnote');
      log(3, `Migrating ${notePages.length} notes from ${journal.name}`);
      for (const page of notePages) {
        const noteData = page.system;
        const ownership = noteData?.gmOnly ? { default: 0 } : { default: 2 };
        const newJournal = await JournalEntry.create({ name: page.name, folder: folder.id, ownership, flags: { [MODULE.ID]: { calendarId, isCalendarNote: true } } });
        await JournalEntryPage.create(
          { name: page.name, type: 'calendaria.calendarnote', system: noteData, text: { content: page.text?.content || '' }, title: { level: 1, show: true }, flags: { [MODULE.ID]: { calendarId } } },
          { parent: newJournal }
        );
        log(3, `Migrated note: ${page.name}`);
      }
      const originalName = journal.name;
      await journal.update({ name: `(DELETEME) - ${originalName}` });
      await journal.unsetFlag(MODULE.ID, 'isCalendarJournal');
      log(2, `Renamed legacy calendar journal: ${originalName} → (DELETEME) - ${originalName}`);
    }
    await this.#buildIndex();
    log(3, 'Calendar journal migration complete');
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

  /**
   * Get or create the Calendar Notes folder.
   * @returns {Promise<Folder|null>}  Folder document or null
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
      const folder = await Folder.create({ name: localize('CALENDARIA.Note.CalendarNotesFolder'), type: 'JournalEntry', color: '#4a9eff', flags: { [MODULE.ID]: { isCalendarNotesFolder: true } } });
      this.#notesFolderId = folder.id;
      log(3, 'Created Calendar Notes folder');
      return folder;
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
