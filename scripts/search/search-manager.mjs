/**
 * Search Manager
 * Provides note search functionality.
 * @module Search/SearchManager
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';

/**
 * @typedef {object} SearchResult
 * @property {string} type - Entity type (always 'note')
 * @property {string} id - Note page ID
 * @property {string} name - Note name
 * @property {string} [description] - Date or content snippet
 * @property {object} [data] - Additional note data
 */

export default class SearchManager {
  /**
   * Search notes by name and optionally content.
   * @param {string} term - Search term
   * @param {object} [options={}] - Search options
   * @param {boolean} [options.searchContent=true] - Search note content
   * @param {number} [options.limit=50] - Max results
   * @returns {SearchResult[]} Matching notes
   */
  static search(term, options = {}) {
    if (!term || typeof term !== 'string') return [];

    const searchTerm = term.trim().toLowerCase();
    if (searchTerm.length < 2) return [];

    const searchContent = options.searchContent !== false;
    const limit = options.limit || 50;

    const results = this.#searchNotes(searchTerm, limit, searchContent);
    log(3, `Search for "${term}" returned ${results.length} results`);
    return results;
  }

  /* -------------------------------------------- */
  /*  Private Search Methods                       */
  /* -------------------------------------------- */

  /**
   * Check if text matches search term.
   * @param {string} text - Text to search
   * @param {string} term - Search term (lowercase)
   * @returns {boolean}
   */
  static #matches(text, term) {
    if (!text) return false;
    return text.toLowerCase().includes(term);
  }

  /**
   * Search calendar notes.
   * @param {string} term - Search term (lowercase)
   * @param {number} limit - Max results
   * @param {boolean} searchContent - Search note content
   * @returns {SearchResult[]}
   */
  static #searchNotes(term, limit, searchContent) {
    const results = [];
    const allNotes = NoteManager.getAllNotes();

    for (const note of allNotes) {
      if (results.length >= limit) break;

      // Search name
      if (this.#matches(note.name, term)) {
        results.push({
          type: 'note',
          id: note.id,
          name: note.name,
          description: this.#formatNoteDate(note),
          data: { journalId: note.journalId, flagData: note.flagData }
        });
        continue;
      }

      // Search content if enabled
      if (searchContent) {
        const page = NoteManager.getFullNote(note.id);
        if (page?.text?.content && this.#matches(page.text.content, term)) {
          const snippet = this.#extractSnippet(page.text.content, term);
          results.push({
            type: 'note',
            id: note.id,
            name: note.name,
            description: snippet,
            data: { journalId: note.journalId, flagData: note.flagData }
          });
        }
      }
    }

    return results;
  }

  /* -------------------------------------------- */
  /*  Formatting Helpers                           */
  /* -------------------------------------------- */

  /**
   * Format note date for display.
   * @param {object} note - Note stub
   * @returns {string}
   */
  static #formatNoteDate(note) {
    const flagData = note.flagData;
    if (!flagData?.startDate) return '';

    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const { year, month, day } = flagData.startDate;
    const displayYear = year + yearZero;

    const monthData = calendar?.months?.values?.[month];
    const monthName = monthData ? localize(monthData.name) : format('CALENDARIA.Calendar.MonthFallback', { num: month + 1 });

    return `${day} ${monthName}, ${displayYear}`;
  }

  /**
   * Extract snippet around search term match.
   * @param {string} content - Full content
   * @param {string} term - Search term (lowercase)
   * @returns {string}
   */
  static #extractSnippet(content, term) {
    const text = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const searchText = text.toLowerCase();
    const index = searchText.indexOf(term);

    if (index === -1) return text.slice(0, 60) + '...';

    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + term.length + 30);

    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }
}
