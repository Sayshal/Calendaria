/**
 * Note Manager
 * Main entry point for calendar notes system management.
 * Handles note creation, indexing, and retrieval with JournalEntry integration.
 *
 * @module Notes/NoteManager
 * @author Tyler
 */

import { MODULE } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import { getDefaultNoteData, validateNoteData, sanitizeNoteData, createNoteStub, getPredefinedCategories, getCategoryDefinition } from './note-data.mjs';
import { compareDates, getCurrentDate, isValidDate } from './utils/date-utils.mjs';
import { isRecurringMatch, getOccurrencesInRange, getRecurrenceDescription } from './utils/recurrence.mjs';

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
    log(3, 'Initializing Note Manager...');

    await this.#buildIndex();
    this.#registerHooks();

    // Create Calendar Notes folder if GM
    if (game.user.isGM) await this.getCalendarNotesFolder();

    this.#initialized = true;
    log(3, 'Note Manager initialized');
  }

  /**
   * Build the in-memory index of all calendar notes.
   * @private
   */
  static async #buildIndex() {
    this.#noteIndex.clear();

    // Scan all journal entries for calendar notes
    for (const journal of game.journal) {
      const stub = createNoteStub(journal);
      if (stub) {
        this.#noteIndex.set(journal.id, stub);
        log(3, `Indexed calendar note: ${journal.name}`);
      }
    }

    log(3, `Built note index with ${this.#noteIndex.size} notes`);
  }

  /**
   * Register Foundry hooks for note management.
   * @private
   */
  static #registerHooks() {
    // When journal is created
    Hooks.on('createJournalEntry', (journal, options, userId) => {
      const stub = createNoteStub(journal);
      if (stub) {
        this.#noteIndex.set(journal.id, stub);
        log(3, `Added note to index: ${journal.name}`);
        Hooks.callAll('calendaria.noteCreated', stub);
      }
    });

    // When journal is updated
    Hooks.on('updateJournalEntry', (journal, changes, options, userId) => {
      const stub = createNoteStub(journal);

      if (stub) {
        this.#noteIndex.set(journal.id, stub);
        log(3, `Updated note in index: ${journal.name}`);
        Hooks.callAll('calendaria.noteUpdated', stub);
      } else {
        // Journal no longer has calendar flag, remove from index
        if (this.#noteIndex.has(journal.id)) {
          this.#noteIndex.delete(journal.id);
          log(3, `Removed note from index: ${journal.name}`);
          Hooks.callAll('calendaria.noteDeleted', journal.id);
        }
      }
    });

    // When journal is deleted
    Hooks.on('deleteJournalEntry', (journal, options, userId) => {
      if (this.#noteIndex.has(journal.id)) {
        this.#noteIndex.delete(journal.id);
        log(3, `Deleted note from index: ${journal.name}`);
        Hooks.callAll('calendaria.noteDeleted', journal.id);
      }
    });

    log(3, 'Note Manager hooks registered');
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
   * @param {object} [options.journalData]  Additional journal entry data
   * @returns {Promise<JournalEntry>}  Created journal entry
   */
  static async createNote({ name, content = '', noteData, journalData = {} }) {
    // Validate note data
    const validation = validateNoteData(noteData);
    if (!validation.valid) {
      const errorMsg = `Invalid note data: ${validation.errors.join(', ')}`;
      log(2, errorMsg);
      ui.notifications.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Sanitize note data
    const sanitized = sanitizeNoteData(noteData);

    // Get or create notes folder
    const folder = await this.getCalendarNotesFolder();

    // Create journal entry
    try {
      const journal = await JournalEntry.create({
        name,
        content,
        folder: folder?.id,
        flags: { [MODULE.ID]: { noteData: sanitized } },
        ...journalData
      });

      log(3, `Created calendar note: ${name}`);
      return journal;
    } catch (error) {
      log(2, `Error creating calendar note:`, error);
      ui.notifications.error(`Error creating note: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing calendar note.
   * @param {string} journalId  Journal entry ID
   * @param {object} updates  Updates to apply
   * @param {string} [updates.name]  New name
   * @param {string} [updates.content]  New content
   * @param {object} [updates.noteData]  Calendar note data updates
   * @returns {Promise<JournalEntry>}  Updated journal entry
   */
  static async updateNote(journalId, updates) {
    const journal = game.journal.get(journalId);
    if (!journal) throw new Error(`Journal entry not found: ${journalId}`);

    const updateData = {};

    // Update name if provided
    if (updates.name !== undefined) updateData.name = updates.name;

    // Update content if provided
    if (updates.content !== undefined) updateData.content = updates.content;

    // Update note data if provided
    if (updates.noteData) {
      const currentNoteData = journal.getFlag(MODULE.ID, 'noteData') || {};
      const mergedNoteData = foundry.utils.mergeObject(currentNoteData, updates.noteData);

      // Validate merged data
      const validation = validateNoteData(mergedNoteData);
      if (!validation.valid) {
        const errorMsg = `Invalid note data: ${validation.errors.join(', ')}`;
        log(2, errorMsg);
        ui.notifications.error(errorMsg);
        throw new Error(errorMsg);
      }

      updateData[`flags.${MODULE.ID}.noteData`] = sanitizeNoteData(mergedNoteData);
    }

    try {
      await journal.update(updateData);
      log(3, `Updated calendar note: ${journal.name}`);
      return journal;
    } catch (error) {
      log(2, `Error updating calendar note:`, error);
      ui.notifications.error(`Error updating note: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a calendar note.
   * @param {string} journalId  Journal entry ID
   * @returns {Promise<boolean>}  True if deleted
   */
  static async deleteNote(journalId) {
    const journal = game.journal.get(journalId);
    if (!journal) throw new Error(`Journal entry not found: ${journalId}`);

    try {
      await journal.delete();
      log(3, `Deleted calendar note: ${journal.name}`);
      return true;
    } catch (error) {
      log(2, `Error deleting calendar note:`, error);
      ui.notifications.error(`Error deleting note: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a note stub from the index.
   * @param {string} journalId  Journal entry ID
   * @returns {object|null}  Note stub or null
   */
  static getNote(journalId) {
    return this.#noteIndex.get(journalId) || null;
  }

  /**
   * Get full journal entry for a note.
   * @param {string} journalId  Journal entry ID
   * @returns {JournalEntry|null}  Journal entry or null
   */
  static getFullNote(journalId) {
    return game.journal.get(journalId) || null;
  }

  /**
   * Get all note stubs.
   * @returns {object[]}  Array of note stubs
   */
  static getAllNotes() {
    return Array.from(this.#noteIndex.values());
  }

  /* -------------------------------------------- */
  /*  Date Queries                                */
  /* -------------------------------------------- */

  /**
   * Get all notes for a specific date.
   * @param {number} year  Year
   * @param {number} month  Month (0-indexed)
   * @param {number} day  Day of month
   * @returns {object[]}  Array of note stubs
   */
  static getNotesForDate(year, month, day) {
    const targetDate = { year, month, day };
    const matchingNotes = [];

    for (const stub of this.#noteIndex.values()) {
      if (!stub.visible) continue;

      if (this.#matchesDate(stub, targetDate)) matchingNotes.push(stub);
    }

    // Sort by start time
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
   * @returns {object[]}  Array of note stubs
   */
  static getNotesInRange(startDate, endDate) {
    const matchingNotes = [];

    for (const stub of this.#noteIndex.values()) {
      if (!stub.visible) continue;

      // Check if note's start or end date falls within range
      const noteStart = stub.flagData.startDate;
      const noteEnd = stub.flagData.endDate;

      const startsInRange = compareDates(noteStart, startDate) >= 0 && compareDates(noteStart, endDate) <= 0;

      const endsInRange = noteEnd && compareDates(noteEnd, startDate) >= 0 && compareDates(noteEnd, endDate) <= 0;

      const spansRange = noteEnd && compareDates(noteStart, startDate) < 0 && compareDates(noteEnd, endDate) > 0;

      if (startsInRange || endsInRange || spansRange) matchingNotes.push(stub);
      else if (stub.flagData.repeat && stub.flagData.repeat !== 'never') {
        // Check for recurring occurrences in range
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
  /*  Utilities                                   */
  /* -------------------------------------------- */

  /**
   * Get or create the Calendar Notes folder.
   * @returns {Promise<Folder|null>}  Folder document or null
   */
  static async getCalendarNotesFolder() {
    // Check if we've already found the folder
    if (this.#notesFolderId) {
      const folder = game.folders.get(this.#notesFolderId);
      if (folder) return folder;
    }

    // Search for existing Calendar Notes folder
    const existing = game.folders.find((f) => f.type === 'JournalEntry' && f.name === 'Calendar Notes');

    if (existing) {
      this.#notesFolderId = existing.id;
      return existing;
    }

    // Create new folder if GM
    if (game.user.isGM) {
      try {
        const folder = await Folder.create({
          name: 'Calendar Notes',
          type: 'JournalEntry',
          color: '#4a9eff'
        });

        this.#notesFolderId = folder.id;
        log(3, 'Created Calendar Notes folder');
        return folder;
      } catch (error) {
        log(2, 'Error creating Calendar Notes folder:', error);
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

  /**
   * Get current date from game time.
   * @returns {object}  Current date
   */
  static getCurrentDate() {
    return getCurrentDate();
  }
}
