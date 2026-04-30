import { SETTINGS } from '../constants.mjs';
import { NoteManager, getAllPresets, sanitizeNoteData, upsertBundledCustomPreset } from '../notes/_module.mjs';
import { log } from '../utils/_module.mjs';
import BaseImporter from './base-importer.mjs';

/**
 * Importer for Calendaria JSON exports.
 * @extends BaseImporter
 */
export default class CalendariaImporter extends BaseImporter {
  static id = 'calendaria';
  static label = 'CALENDARIA.Importer.Calendaria.Name';
  static icon = 'fa-calendar-alt';
  static description = 'CALENDARIA.Importer.Calendaria.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = false;
  static fileExtensions = ['.json'];

  /** @type {object[]} Custom presets bundled with the export, restored on note import */
  #bundledCustomPresets = [];

  /**
   * Check if data is a settings export file and extract calendar data if so.
   * @param {object} data - Raw data from file
   * @returns {object} Calendar data (extracted from settings export or original)
   */
  #extractCalendarData(data) {
    if (data.settings && data.calendarData?.name) {
      log(3, 'Detected settings export file, extracting calendarData');
      return data.calendarData;
    }
    return data;
  }

  /**
   * Extract current date from Calendaria data for preservation after import.
   * @param {object} data - Raw Calendaria data
   * @returns {{year: number, month: number, dayOfMonth: number}|null} Current date
   */
  extractCurrentDate(data) {
    const calendarData = this.#extractCalendarData(data);
    if (calendarData.currentDate) return calendarData.currentDate;
    if (calendarData.metadata?.currentDate) return calendarData.metadata.currentDate;
    return null;
  }

  /**
   * Extract notes from Calendaria export data.
   * @param {object} data - Raw Calendaria export data
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    const notes = data.notes || this.#extractCalendarData(data).notes;
    if (!notes?.length) return [];
    return notes.map((note) => {
      if (note.system) {
        const linked = note.system.linkedFestival;
        return {
          name: note.name,
          content: note.content || '',
          calendarId: note.calendarId,
          system: note.system,
          startDate: note.system.startDate,
          originalId: note.id,
          festivalKey: linked?.festivalKey ?? null,
          suggestedType: linked ? 'festival' : 'note'
        };
      }
      return {
        name: note.name,
        content: note.content || '',
        startDate: note.startDate,
        endDate: note.endDate,
        allDay: note.allDay ?? true,
        repeat: note.repeat || 'never',
        categories: note.categories || [],
        originalId: note.id,
        festivalKey: null,
        suggestedType: 'note'
      };
    });
  }

  /**
   * Transform Calendaria export data.
   * @param {object} data - Raw Calendaria export data or settings export
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    const calendarData = this.#extractCalendarData(data);
    const monthValues = calendarData.months?.values;
    if (!calendarData.name || !monthValues || !Object.values(monthValues).length) throw new Error('Invalid Calendaria export format');
    log(3, `Transforming Calendaria export: ${calendarData.name}`);
    this.#bundledCustomPresets = data.customPresets || data.settings?.[SETTINGS.CUSTOM_PRESETS] || [];
    const metadata = { ...calendarData.metadata };
    delete metadata.id;
    delete metadata.importedAt;
    metadata.importedFrom = 'calendaria';
    return { ...calendarData, metadata };
  }

  /**
   * Import notes selected via the importer dialog (those marked as 'note').
   * @param {object[]} notes - Notes to import (already filtered to type 'note')
   * @param {object} options - Import options
   * @param {string} options.calendarId - Target calendar ID
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>} Import result with per-note error messages
   */
  async importNotes(notes, options = {}) {
    const { calendarId } = options;
    const errors = [];
    let count = 0;
    log(3, `Starting Calendaria note import: ${notes.length} notes to calendar ${calendarId}`);
    if (this.#bundledCustomPresets.length) {
      let restored = 0;
      for (const preset of this.#bundledCustomPresets) {
        if (preset.builtin) continue;
        const added = await upsertBundledCustomPreset(preset);
        if (added) restored++;
      }
      if (restored) log(3, `Restored ${restored} bundled custom presets`);
    }
    for (const note of notes) {
      try {
        const noteData = sanitizeNoteData(
          note.system || { startDate: note.startDate, endDate: note.endDate, allDay: note.allDay ?? true, repeat: note.repeat || 'never', categories: note.categories || [] }
        );
        noteData.macro = null;
        noteData.sceneId = null;
        noteData.playlistId = null;
        noteData.linkedEvent = null;
        noteData.linkedFestival = null;
        noteData.connectedEvents = undefined;
        if (Array.isArray(noteData.categories)) {
          const knownIds = new Set(getAllPresets().map((p) => p.id));
          noteData.categories = noteData.categories.filter((id) => knownIds.has(id));
        }
        const page = await NoteManager.createNote({ name: note.name, content: note.content || '', noteData, calendarId, openSheet: false });
        if (page) count++;
        else errors.push(`Failed to create note: ${note.name}`);
      } catch (error) {
        errors.push(`Error creating note "${note.name}": ${error.message}`);
      }
    }
    log(3, `Calendaria note import complete: ${count}/${notes.length} imported, ${errors.length} errors`);
    return { success: errors.length === 0, count, errors };
  }
}
