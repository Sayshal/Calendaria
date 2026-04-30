import { CalendarManager, isBundledCalendar } from '../calendar/_module.mjs';
import { HOOKS, MODULE, NOTE_VISIBILITY, SETTINGS, SOCKET_TYPES } from '../constants.mjs';
import { CalendariaSocket, canAddNotes, canDeleteNotes, format, localize, log } from '../utils/_module.mjs';
import {
  DEFAULT_PRESET_ID,
  applyPresetDefaultsToNoteData,
  compareDates,
  createNoteStub,
  getAllPresets,
  getDefaultNoteData,
  getOccurrencesInRange,
  getPlayerUsablePresets,
  getPresetContentTemplate,
  getPresetDefaults,
  getPresetDefinition,
  getRecurrenceDescription,
  isRecurringMatch,
  sanitizeNoteData,
  validateNoteData
} from './_module.mjs';

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

  /** @type {boolean} Guard flag to prevent ownership rebuild during sheet form submission */
  static #suppressOwnershipRebuild = false;

  /** @type {Map<string, string|undefined>} Prior visibility stashed in preUpdate, read in updateJournalEntryPage */
  static #priorVisibilityByPage = new Map();

  /** @type {Map<string, Promise<Folder|null>>} In-flight calendar folder lookups, keyed by calendarId */
  static #calendarFolderPromises = new Map();

  /** @type {Promise<Folder|null>|null} In-flight Calendar Notes folder lookup */
  static #notesFolderPromise = null;

  /**
   * Initialize the note manager.
   */
  static async initialize() {
    await this.#buildIndex();
    if (game.user.isGM) {
      await this.getCalendarNotesFolder();
      await this.#initializeActiveCalendarFolder();
    }
    this.#initialized = true;
    log(3, 'Note Manager initialized');
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
        if (stub) this.#noteIndex.set(page.id, stub);
      }
    }
    log(3, `Built note index with ${this.#noteIndex.size} notes`);
  }

  /**
   * Handle createJournalEntry hook — index pages when a journal appears (e.g. ownership grant).
   * @param {JournalEntry} journal - The created journal
   */
  static onCreateJournalEntry(journal) {
    for (const page of journal.pages) {
      const stub = createNoteStub(page);
      if (stub && !NoteManager.#noteIndex.has(page.id)) {
        NoteManager.#noteIndex.set(page.id, stub);
        Hooks.callAll(HOOKS.NOTE_CREATED, stub);
      }
    }
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
      Hooks.callAll(HOOKS.NOTE_CREATED, stub);
    }
  }

  /**
   * Handle preUpdateJournalEntryPage hook.
   * @param {object} page - The page about to be updated
   * @param {object} changes - The pending changes
   * @param {object} _options - Update options
   * @param {string} _userId - User ID performing the update
   */
  static onPreUpdateJournalEntryPage(page, changes, _options, _userId) {
    if (changes.system?.visibility !== undefined) NoteManager.#priorVisibilityByPage.set(page.id, page.system?.visibility);
  }

  /**
   * Handle updateJournalEntryPage hook.
   * @param {object} page - The updated page
   * @param {object} changes - The changes made
   * @param {object} _options - Update options
   * @param {string} _userId - User ID who updated the page
   */
  static async onUpdateJournalEntryPage(page, changes, _options, _userId) {
    const priorVisibility = NoteManager.#priorVisibilityByPage.get(page.id);
    NoteManager.#priorVisibilityByPage.delete(page.id);
    const stub = createNoteStub(page);
    if (stub) {
      if (!game.user.isGM && changes.system?.visibility !== undefined) {
        const vis = changes.system.visibility;
        const isAuthor = page.system?.author?._id === game.user.id;
        if (vis === NOTE_VISIBILITY.SECRET) stub.visible = false;
        else if (vis === NOTE_VISIBILITY.HIDDEN) stub.visible = isAuthor;
      }
      NoteManager.#noteIndex.set(page.id, stub);
      Hooks.callAll(HOOKS.NOTE_UPDATED, stub);
      if (game.user.isGM) {
        if (changes.name !== undefined) {
          const journal = page.parent;
          if (journal?.getFlag(MODULE.ID, 'isCalendarNote') && journal.name !== page.name) await journal.update({ name: page.name });
        }
        if (changes.system?.visibility !== undefined) {
          if (priorVisibility !== changes.system.visibility) {
            const journal = page.parent;
            if (journal?.getFlag(MODULE.ID, 'isCalendarNote')) {
              const authorId = page.system?.author?._id;
              const defaults = this.#buildOwnership(changes.system.visibility, authorId);
              const nextOwnership = {};
              for (const [k, v] of Object.entries(journal.ownership ?? {})) if (typeof v === 'number' && !k.startsWith('-=')) nextOwnership[k] = v;
              nextOwnership.default = defaults.default;
              if (authorId) {
                if (authorId in defaults) nextOwnership[authorId] = defaults[authorId];
                else delete nextOwnership[authorId];
              }
              await journal.update({ ownership: nextOwnership });
              log(3, `Updated journal ownership defaults for visibility change: ${changes.system.visibility}`);
            }
          }
        }
      }
    } else {
      if (NoteManager.#noteIndex.has(page.id)) {
        NoteManager.#noteIndex.delete(page.id);
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
      Hooks.callAll(HOOKS.NOTE_DELETED, page.id);
    }
  }

  /**
   * Handle deleteJournalEntry hook.
   * @param {JournalEntry} journal - The deleted journal
   * @param {object} _options - Deletion options
   * @param {string} _userId - User ID who deleted the journal
   */
  static async onDeleteJournalEntry(journal, _options, _userId) {
    let removed = false;
    for (const page of journal.pages) {
      if (NoteManager.#noteIndex.has(page.id)) {
        NoteManager.#noteIndex.delete(page.id);
        Hooks.callAll(HOOKS.NOTE_DELETED, page.id);
        removed = true;
      }
    }
    if (!removed) {
      for (const [id, stub] of NoteManager.#noteIndex) {
        if (stub.journalId === journal.id) {
          NoteManager.#noteIndex.delete(id);
          Hooks.callAll(HOOKS.NOTE_DELETED, id);
        }
      }
    }
  }

  /**
   * Handle updateJournalEntry hook — re-sync ownership when native Foundry UI edits ownership.
   * @param {JournalEntry} journal - The updated journal
   * @param {object} changes - The changes applied
   */
  static async onUpdateJournalEntry(journal, changes) {
    if (!journal.getFlag?.(MODULE.ID, 'isCalendarNote')) return;
    if (!changes.ownership) return;
    for (const page of journal.pages) {
      const stub = createNoteStub(page);
      if (stub) {
        const existed = NoteManager.#noteIndex.has(page.id);
        NoteManager.#noteIndex.set(page.id, stub);
        Hooks.callAll(existed ? HOOKS.NOTE_UPDATED : HOOKS.NOTE_CREATED, stub);
      } else if (NoteManager.#noteIndex.has(page.id)) {
        NoteManager.#noteIndex.delete(page.id);
        Hooks.callAll(HOOKS.NOTE_DELETED, page.id);
      }
    }
    if (!game.user.isGM || NoteManager.#suppressOwnershipRebuild) return;
    const page = journal.pages.contents[0];
    if (!page) return;
    const visibility = page.system?.visibility;
    if (!visibility) return;
    const expected = this.#buildOwnership(visibility, page.system?.author?._id);
    const current = journal.ownership || {};
    const repair = {};
    for (const [key, value] of Object.entries(expected)) if (current[key] !== value) repair[key] = value;
    if (Object.keys(repair).length) {
      await journal.update({ ownership: repair });
      log(3, `Re-synced ownership for "${journal.name}" after external edit`);
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
    const page = journal.pages.contents[0];
    if (game.settings.get(MODULE.ID, SETTINGS.DEV_MODE)) return;
    if (this.#bypassDeleteProtection) return;
    const isCalendarJournal = journal.getFlag(MODULE.ID, 'isCalendarJournal');
    if (isCalendarJournal) {
      ui.notifications.warn('CALENDARIA.Warning.CannotDeleteCalendarJournal', { localize: true });
      log(2, `Prevented deletion of calendar journal: ${journal.name}`);
      return false;
    }
    if (!game.user.isGM) {
      if (page?.system?.linkedFestival) {
        ui.notifications.warn('CALENDARIA.Warning.CannotDeleteFestivalNote', { localize: true });
        log(2, `Prevented deletion of festival note: ${journal.name}`);
        return false;
      }
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
    if (this.#bypassDeleteProtection) return;
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
   * @param {'ui'|undefined} [options.source]  Pass 'ui' for interactive callers to trigger preset selection dialog
   * @returns {Promise<object>} Created journal entry page
   */
  static async createNote({ name, content = '', noteData, calendarId, journalData = {}, creatorId, openSheet = 'edit', source }) {
    if (!canAddNotes()) {
      ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    const validation = validateNoteData(noteData);
    if (!validation.valid) log(1, `Invalid note data: ${validation.errors.join(', ')}`);
    const sanitized = sanitizeNoteData(noteData);
    if (source === 'ui' && !sanitized.categories?.length && !sanitized.linkedFestival) {
      const result = await this.#resolvePresetForNewNote(sanitized);
      if (result === false) return null;
    }
    applyPresetDefaultsToNoteData(sanitized, sanitized.categories);
    if (!content) content = getPresetContentTemplate(sanitized.categories) || '';
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
    const presetMerged = getPresetDefaults(sanitized.categories);
    if (presetMerged.name && name === localize('CALENDARIA.Note.NewNote')) name = presetMerged.name;
    if (!sanitized.categories?.length && !sanitized.linkedFestival) {
      const defaultPreset = getPresetDefinition(DEFAULT_PRESET_ID);
      sanitized.icon = defaultPreset.icon;
      sanitized.color = defaultPreset.color;
    }
    const ownership = this.#buildOwnership(sanitized.visibility, actualCreatorId);
    if (presetMerged.defaultOwnership != null) {
      const level = presetMerged.defaultOwnership;
      for (const user of game.users) if (!user.isGM && ownership[user.id] !== undefined) ownership[user.id] = Math.max(ownership[user.id], level);
      ownership.default = Math.max(ownership.default ?? 0, level);
    }
    const journal = await JournalEntry.create({ name, folder: folder.id, ownership, flags: { [MODULE.ID]: { calendarId, isCalendarNote: true } }, ...journalData });
    const page = await JournalEntryPage.create(
      { name, type: 'calendaria.calendarnote', system: sanitized, text: { content }, title: { level: 1, show: true }, flags: { [MODULE.ID]: { calendarId } } },
      { parent: journal }
    );
    log(3, `Created calendar note: ${name}`);
    if (openSheet && (!creatorId || creatorId === game.user.id)) page.sheet.render(true, { mode: openSheet, forceMode: openSheet });
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
      const currentNoteData = page.system?.toObject?.() ?? page.system ?? {};
      const mergedNoteData = foundry.utils.mergeObject(currentNoteData, updates.noteData);
      if (mergedNoteData.color && typeof mergedNoteData.color !== 'string') mergedNoteData.color = String(mergedNoteData.color);
      const validation = validateNoteData(mergedNoteData);
      if (!validation.valid) log(1, `Invalid note data: ${validation.errors.join(', ')}`);
      updateData.system = sanitizeNoteData(mergedNoteData);
    }
    if (updates.content !== undefined) {
      updateData['text.content'] = updates.content;
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
   * @param {number} dayOfMonth  Day of month (0-indexed)
   * @param {string} [calendarId]  Optional calendar ID filter (defaults to active calendar)
   * @returns {object[]}  Array of note stubs
   */
  static getNotesForDate(year, month, dayOfMonth, calendarId = null) {
    const targetDate = { year, month, dayOfMonth };
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
      else if ((stub.flagData.repeat && stub.flagData.repeat !== 'never') || stub.flagData.conditionTree) {
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
   * Get notes by preset.
   * @param {string} presetId  Preset ID
   * @returns {object[]}  Array of note stubs
   */
  static getNotesByPreset(presetId) {
    return this.getAllNotes().filter((stub) => {
      return stub.flagData.categories?.includes(presetId);
    });
  }

  /**
   * Get all unique preset IDs in use.
   * @returns {string[]}  Array of preset IDs
   */
  static getAllUsedPresetIds() {
    const presetIds = new Set();
    for (const stub of this.#noteIndex.values()) if (stub.flagData.categories) stub.flagData.categories.forEach((cat) => presetIds.add(cat));
    return Array.from(presetIds);
  }

  /**
   * Get predefined preset definitions.
   * @returns {object[]}  Array of preset definitions
   */
  static getPresetDefinitions() {
    return getAllPresets();
  }

  /**
   * Get preset definition by ID.
   * @param {string} presetId  Preset ID
   * @returns {object|null}  Preset definition or null
   */
  static getPresetDefinition(presetId) {
    return getPresetDefinition(presetId);
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
    const inFlight = this.#calendarFolderPromises.get(calendarId);
    if (inFlight) return inFlight;
    const promise = this.#resolveCalendarFolder(calendarId, calendar).finally(() => {
      this.#calendarFolderPromises.delete(calendarId);
    });
    this.#calendarFolderPromises.set(calendarId, promise);
    return promise;
  }

  /**
   * Internal implementation of calendar folder lookup/creation.
   * @param {string} calendarId  Calendar ID
   * @param {object} calendar  Calendar data
   * @returns {Promise<Folder|null>} The resolved or newly created calendar folder, or null if unavailable
   * @private
   */
  static async #resolveCalendarFolder(calendarId, calendar) {
    const parentFolder = await this.getCalendarNotesFolder();
    if (!parentFolder) return null;
    const allMatching = game.folders.filter((f) => f.type === 'JournalEntry' && f.getFlag(MODULE.ID, 'calendarId') === calendarId);
    if (allMatching.length > 1 && game.user.isGM) {
      const [keep, ...duplicates] = allMatching;
      this.#bypassDeleteProtection = true;
      for (const dup of duplicates) {
        if (!game.folders.get(dup.id)) continue;
        for (const journal of game.journal.filter((j) => j.folder?.id === dup.id)) await journal.update({ folder: keep.id });
        try {
          await dup.delete();
          log(3, `Merged duplicate calendar folder for ${calendarId}: ${dup.name}`);
        } catch (error) {
          if (!game.folders.get(dup.id)) log(3, `Duplicate calendar folder ${dup.id} already removed`);
          else throw error;
        }
      }
      this.#bypassDeleteProtection = false;
      return keep;
    }
    if (allMatching.length === 1) return allMatching[0];
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
    if (game.user.isGM) {
      if (isBundledCalendar(calendarId)) await CalendarManager.saveDefaultOverride(calendarId, calendar.toObject());
      else await CalendarManager.updateCustomCalendar(calendarId, calendar.toObject());
    }
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
    if (this.#notesFolderPromise) return this.#notesFolderPromise;
    this.#notesFolderPromise = this.#resolveNotesFolder().finally(() => {
      this.#notesFolderPromise = null;
    });
    return this.#notesFolderPromise;
  }

  /**
   * Internal implementation of Calendar Notes folder lookup/creation.
   * @returns {Promise<Folder|null>} The resolved or newly created Calendar Notes folder, or null if unavailable
   * @private
   */
  static async #resolveNotesFolder() {
    const allMatching = game.folders.filter((f) => f.type === 'JournalEntry' && f.getFlag(MODULE.ID, 'isCalendarNotesFolder'));
    if (allMatching.length > 1 && game.user.isGM) {
      const [keep, ...duplicates] = allMatching;
      this.#bypassDeleteProtection = true;
      for (const dup of duplicates) {
        if (!game.folders.get(dup.id)) continue;
        for (const child of game.folders.filter((f) => f.folder?.id === dup.id)) await child.update({ folder: keep.id });
        for (const journal of game.journal.filter((j) => j.folder?.id === dup.id)) await journal.update({ folder: keep.id });
        try {
          await dup.delete();
          log(3, `Merged duplicate Calendar Notes folder: ${dup.name}`);
        } catch (error) {
          if (!game.folders.get(dup.id)) log(3, `Duplicate Calendar Notes folder ${dup.id} already removed`);
          else throw error;
        }
      }
      this.#bypassDeleteProtection = false;
      this.#notesFolderId = keep.id;
      return keep;
    }
    const existing = allMatching[0];
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
   * @param {number} dayOfMonth  Day of month (0-indexed)
   * @param {number} [hour]  Hour (optional)
   * @param {number} [minute]  Minute (optional)
   * @returns {object}  Default note data
   */
  static getDefaultNoteDataForDate(year, month, dayOfMonth, hour, minute) {
    const defaults = getDefaultNoteData();
    defaults.startDate = { year, month, dayOfMonth, hour: hour ?? 0, minute: minute ?? 0 };
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
   * Resolve which preset to apply for a new UI-created note.
   * @param {object} sanitized - Sanitized note data (mutated in place)
   * @returns {Promise<string|null|false>} Preset ID, null (no category), or false (cancelled)
   * @private
   */
  static async #resolvePresetForNewNote(sanitized) {
    const storedDefault = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_NOTE_PRESET);
    if (storedDefault) {
      const preset = getPresetDefinition(storedDefault);
      if (preset) {
        sanitized.categories = [storedDefault];
        if (preset.icon) sanitized.icon = preset.icon;
        if (preset.color) sanitized.color = preset.color;
        return storedDefault;
      }
    }
    return this.#showPresetSelectionDialog(sanitized);
  }

  /**
   * Show a dialog for the user to select a preset for the new note.
   * @param {object} sanitized - Sanitized note data (mutated in place)
   * @returns {Promise<string|null|false>} Preset ID, null (no category), or false (cancelled)
   * @private
   */
  static async #showPresetSelectionDialog(sanitized) {
    const presets = game.user.isGM ? getAllPresets() : getPlayerUsablePresets();
    const options = presets.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
    const html = `<div class="form-group">
      <label>${localize('CALENDARIA.PresetDialog.SelectLabel')}</label>
      <div class="form-fields">
        <multi-select name="presetChoice">${options}</multi-select>
      </div>
    </div>
    <div class="form-group">
      <label class="checkbox">
        <input type="checkbox" name="alwaysUse">
        ${localize('CALENDARIA.PresetDialog.AlwaysUse')}
      </label>
    </div>`;
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: localize('CALENDARIA.PresetDialog.Title') },
      content: html,
      buttons: [
        {
          action: 'ok',
          label: localize('CALENDARIA.Common.Confirm'),
          icon: 'fas fa-check',
          default: true,
          callback: (_event, button) => {
            const form = button.form ?? button.closest('form');
            const multiSelect = form.querySelector('multi-select[name="presetChoice"]');
            const selected = multiSelect
              ? Array.from(multiSelect.querySelectorAll('.tag'))
                  .map((t) => t.dataset.key)
                  .filter(Boolean)
              : [];
            const alwaysUse = form.querySelector('input[name="alwaysUse"]')?.checked ?? false;
            return { presetIds: selected, alwaysUse };
          }
        },
        {
          action: 'cancel',
          label: localize('CALENDARIA.Common.Cancel'),
          icon: 'fas fa-times'
        }
      ],
      rejectClose: false,
      modal: false
    });
    if (!result || result === 'cancel') return false;
    const { presetIds, alwaysUse } = result;
    if (alwaysUse && presetIds.length === 1) await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_NOTE_PRESET, presetIds[0]);
    if (presetIds.length) {
      sanitized.categories = presetIds;
      const firstPreset = getPresetDefinition(presetIds[0]);
      if (firstPreset?.icon) sanitized.icon = firstPreset.icon;
      if (firstPreset?.color) sanitized.color = firstPreset.color;
    }
    return presetIds.length ? presetIds[0] : null;
  }

  /**
   * Build ownership object based on visibility level.
   * @param {string} visibility - Note visibility level
   * @param {string} [authorId] - Author user ID
   * @returns {object} Foundry ownership object
   * @private
   */
  static #buildOwnership(visibility, authorId) {
    const ownership = { default: 0 };
    switch (visibility) {
      case NOTE_VISIBILITY.VISIBLE:
        ownership.default = 2;
        if (authorId) ownership[authorId] = 3;
        break;
      case NOTE_VISIBILITY.HIDDEN:
        if (authorId) ownership[authorId] = 3;
        break;
      case NOTE_VISIBILITY.SECRET:
        break;
    }
    return ownership;
  }

  /**
   * Enable bypass of delete protection (used internally by FestivalManager).
   */
  static enableBypassDeleteProtection() {
    this.#bypassDeleteProtection = true;
  }

  /**
   * Disable bypass of delete protection.
   */
  static disableBypassDeleteProtection() {
    this.#bypassDeleteProtection = false;
  }

  /**
   * Enable suppression of ownership rebuild (prevents race condition during note sheet form submission).
   */
  static enableSuppressOwnershipRebuild() {
    this.#suppressOwnershipRebuild = true;
  }

  /**
   * Disable suppression of ownership rebuild.
   */
  static disableSuppressOwnershipRebuild() {
    this.#suppressOwnershipRebuild = false;
  }

  /**
   * Check if note manager is initialized.
   * @returns {boolean}  True if initialized
   */
  static isInitialized() {
    return this.#initialized;
  }
}
