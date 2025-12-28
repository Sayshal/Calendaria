/**
 * Search Manager
 * Provides search functionality across calendar entities.
 * @module Search/SearchManager
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';

/**
 * @typedef {object} SearchResult
 * @property {string} type - Entity type (note, festival, season, moon, era, month)
 * @property {string} id - Entity identifier
 * @property {string} name - Display name
 * @property {string} [description] - Optional description/preview
 * @property {object} [data] - Additional entity-specific data
 */

/**
 * @typedef {object} SearchResults
 * @property {SearchResult[]} notes - Matching notes
 * @property {SearchResult[]} festivals - Matching festivals
 * @property {SearchResult[]} seasons - Matching seasons
 * @property {SearchResult[]} moons - Matching moons
 * @property {SearchResult[]} eras - Matching eras
 * @property {SearchResult[]} months - Matching months
 * @property {number} total - Total number of results
 */

export default class SearchManager {
  /**
   * Search all calendar entities for matching term.
   * @param {string} term - Search term
   * @param {object} [options={}] - Search options
   * @param {string[]} [options.types] - Entity types to search (defaults to all)
   * @param {boolean} [options.caseSensitive=false] - Case-sensitive search
   * @param {number} [options.limit=50] - Max results per type
   * @returns {SearchResults} Grouped search results
   */
  static search(term, options = {}) {
    if (!term || typeof term !== 'string') {
      return this.#emptyResults();
    }

    const searchTerm = options.caseSensitive ? term.trim() : term.trim().toLowerCase();
    if (searchTerm.length < 2) {
      return this.#emptyResults();
    }

    const types = options.types || ['notes', 'festivals', 'seasons', 'moons', 'eras', 'months'];
    const limit = options.limit || 50;
    const caseSensitive = options.caseSensitive || false;

    const results = this.#emptyResults();

    if (types.includes('notes')) {
      results.notes = this.#searchNotes(searchTerm, caseSensitive, limit);
    }
    if (types.includes('festivals')) {
      results.festivals = this.#searchFestivals(searchTerm, caseSensitive, limit);
    }
    if (types.includes('seasons')) {
      results.seasons = this.#searchSeasons(searchTerm, caseSensitive, limit);
    }
    if (types.includes('moons')) {
      results.moons = this.#searchMoons(searchTerm, caseSensitive, limit);
    }
    if (types.includes('eras')) {
      results.eras = this.#searchEras(searchTerm, caseSensitive, limit);
    }
    if (types.includes('months')) {
      results.months = this.#searchMonths(searchTerm, caseSensitive, limit);
    }

    results.total =
      results.notes.length +
      results.festivals.length +
      results.seasons.length +
      results.moons.length +
      results.eras.length +
      results.months.length;

    log(3, `Search for "${term}" returned ${results.total} results`);
    return results;
  }

  /**
   * Search notes by name and content.
   * @param {string} term - Search term
   * @param {object} [options={}] - Search options
   * @param {boolean} [options.searchContent=true] - Search note content
   * @param {number} [options.limit=50] - Max results
   * @returns {SearchResult[]} Matching notes
   */
  static searchNotes(term, options = {}) {
    if (!term || typeof term !== 'string') return [];

    const searchTerm = term.trim().toLowerCase();
    if (searchTerm.length < 2) return [];

    const searchContent = options.searchContent !== false;
    const limit = options.limit || 50;

    return this.#searchNotes(searchTerm, false, limit, searchContent);
  }

  /* -------------------------------------------- */
  /*  Private Search Methods                       */
  /* -------------------------------------------- */

  /**
   * Create empty results object.
   * @returns {SearchResults}
   */
  static #emptyResults() {
    return {
      notes: [],
      festivals: [],
      seasons: [],
      moons: [],
      eras: [],
      months: [],
      total: 0
    };
  }

  /**
   * Check if text matches search term.
   * @param {string} text - Text to search
   * @param {string} term - Search term
   * @param {boolean} caseSensitive - Case-sensitive match
   * @returns {boolean}
   */
  static #matches(text, term, caseSensitive) {
    if (!text) return false;
    const searchText = caseSensitive ? text : text.toLowerCase();
    return searchText.includes(term);
  }

  /**
   * Search calendar notes.
   * @param {string} term - Search term (already lowercase if not case-sensitive)
   * @param {boolean} caseSensitive - Case-sensitive search
   * @param {number} limit - Max results
   * @param {boolean} [searchContent=false] - Search note content
   * @returns {SearchResult[]}
   */
  static #searchNotes(term, caseSensitive, limit, searchContent = false) {
    const results = [];
    const allNotes = NoteManager.getAllNotes();

    for (const note of allNotes) {
      if (results.length >= limit) break;

      // Search name
      if (this.#matches(note.name, term, caseSensitive)) {
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
        if (page?.text?.content && this.#matches(page.text.content, term, caseSensitive)) {
          // Extract snippet around match
          const snippet = this.#extractSnippet(page.text.content, term, caseSensitive);
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

  /**
   * Search calendar festivals.
   * @param {string} term - Search term
   * @param {boolean} caseSensitive - Case-sensitive search
   * @param {number} limit - Max results
   * @returns {SearchResult[]}
   */
  static #searchFestivals(term, caseSensitive, limit) {
    const results = [];
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.festivals?.length) return results;

    for (const festival of calendar.festivals) {
      if (results.length >= limit) break;

      const name = localize(festival.name);
      if (this.#matches(name, term, caseSensitive)) {
        results.push({
          type: 'festival',
          id: `festival-${festival.name}`,
          name,
          description: this.#formatFestivalDate(calendar, festival),
          data: { festival }
        });
      }
    }

    return results;
  }

  /**
   * Search calendar seasons.
   * @param {string} term - Search term
   * @param {boolean} caseSensitive - Case-sensitive search
   * @param {number} limit - Max results
   * @returns {SearchResult[]}
   */
  static #searchSeasons(term, caseSensitive, limit) {
    const results = [];
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.seasons?.values?.length) return results;

    for (const season of calendar.seasons.values) {
      if (results.length >= limit) break;

      const name = localize(season.name);
      if (this.#matches(name, term, caseSensitive)) {
        results.push({
          type: 'season',
          id: `season-${season.name}`,
          name,
          description: this.#formatSeasonDate(calendar, season),
          data: { season }
        });
      }
    }

    return results;
  }

  /**
   * Search calendar moons.
   * @param {string} term - Search term
   * @param {boolean} caseSensitive - Case-sensitive search
   * @param {number} limit - Max results
   * @returns {SearchResult[]}
   */
  static #searchMoons(term, caseSensitive, limit) {
    const results = [];
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.moons?.length) return results;

    for (const moon of calendar.moons) {
      if (results.length >= limit) break;

      const name = localize(moon.name);
      if (this.#matches(name, term, caseSensitive)) {
        results.push({
          type: 'moon',
          id: `moon-${moon.name}`,
          name,
          description: `${moon.cycleLength} day cycle`,
          data: { moon }
        });
      }
    }

    return results;
  }

  /**
   * Search calendar eras.
   * @param {string} term - Search term
   * @param {boolean} caseSensitive - Case-sensitive search
   * @param {number} limit - Max results
   * @returns {SearchResult[]}
   */
  static #searchEras(term, caseSensitive, limit) {
    const results = [];
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.eras?.length) return results;

    for (const era of calendar.eras) {
      if (results.length >= limit) break;

      const name = localize(era.name);
      const abbreviation = era.abbreviation || '';

      if (this.#matches(name, term, caseSensitive) || this.#matches(abbreviation, term, caseSensitive)) {
        results.push({
          type: 'era',
          id: `era-${era.name}`,
          name,
          description: abbreviation ? `(${abbreviation})` : '',
          data: { era }
        });
      }
    }

    return results;
  }

  /**
   * Search calendar months.
   * @param {string} term - Search term
   * @param {boolean} caseSensitive - Case-sensitive search
   * @param {number} limit - Max results
   * @returns {SearchResult[]}
   */
  static #searchMonths(term, caseSensitive, limit) {
    const results = [];
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.months?.values?.length) return results;

    calendar.months.values.forEach((month, index) => {
      if (results.length >= limit) return;

      const name = localize(month.name);
      if (this.#matches(name, term, caseSensitive)) {
        results.push({
          type: 'month',
          id: `month-${index}`,
          name,
          description: `${month.days} days`,
          data: { month, index }
        });
      }
    });

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
    const monthName = monthData ? localize(monthData.name) : `Month ${month + 1}`;

    return `${day} ${monthName}, ${displayYear}`;
  }

  /**
   * Format festival date for display.
   * @param {object} calendar - Calendar
   * @param {object} festival - Festival data
   * @returns {string}
   */
  static #formatFestivalDate(calendar, festival) {
    const monthData = calendar.months?.values?.[festival.month];
    const monthName = monthData ? localize(monthData.name) : `Month ${festival.month + 1}`;
    return `${festival.day + 1} ${monthName}`;
  }

  /**
   * Format season date range for display.
   * @param {object} calendar - Calendar
   * @param {object} season - Season data
   * @returns {string}
   */
  static #formatSeasonDate(calendar, season) {
    const startMonth = calendar.months?.values?.[season.monthStart];
    const endMonth = calendar.months?.values?.[season.monthEnd];

    const startName = startMonth ? localize(startMonth.name) : '';
    const endName = endMonth ? localize(endMonth.name) : '';

    if (startName && endName && startName !== endName) {
      return `${startName} - ${endName}`;
    }
    return startName || '';
  }

  /**
   * Extract snippet around search term match.
   * @param {string} content - Full content
   * @param {string} term - Search term
   * @param {boolean} caseSensitive - Case-sensitive match
   * @returns {string}
   */
  static #extractSnippet(content, term, caseSensitive) {
    // Strip HTML tags
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const searchText = caseSensitive ? text : text.toLowerCase();
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
