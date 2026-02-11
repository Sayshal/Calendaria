/**
 * Search Manager
 * Provides note search functionality.
 * @module Search/SearchManager
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { getAllCategories } from '../notes/note-data.mjs';
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

/**
 * Provides note search functionality.
 */
export default class SearchManager {
  /**
   * Search notes by name and optionally content.
   * @param {string} term - Search term
   * @param {object} [options] - Search options
   * @param {boolean} [options.searchContent] - Search note content
   * @param {number} [options.limit] - Max results
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

  /**
   * Check if text matches search term.
   * @param {string} text - Text to search
   * @param {string} term - Search term (lowercase)
   * @returns {boolean} - Does text match?
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
   * @returns {SearchResult[]} - Results
   */
  static #searchNotes(term, limit, searchContent) {
    const results = [];
    const allNotes = NoteManager.getAllNotes().filter((stub) => stub.visible);
    const allCategories = getAllCategories();

    // Handle category: prefix search
    if (term.startsWith('category:')) {
      const categoryName = term.slice(9).trim();
      if (!categoryName) return results;
      const matchingCategories = allCategories.filter((c) => c.label.toLowerCase().includes(categoryName));
      if (matchingCategories.length === 0) return results;
      const matchingCategoryIds = matchingCategories.map((c) => c.id);

      for (const note of allNotes) {
        if (results.length >= limit) break;
        const noteCategories = note.flagData?.categories ?? [];
        if (noteCategories.some((id) => matchingCategoryIds.includes(id))) {
          results.push(this.#buildSearchResult(note, this.#formatNoteDate(note)));
        }
      }
      return results;
    }

    // Standard search with category matching
    for (const note of allNotes) {
      if (results.length >= limit) break;

      // Match by name
      if (this.#matches(note.name, term)) {
        results.push(this.#buildSearchResult(note, this.#formatNoteDate(note)));
        continue;
      }

      // Match by category name
      const noteCategories = note.flagData?.categories ?? [];
      const matchedCategory = noteCategories.some((catId) => {
        const cat = allCategories.find((c) => c.id === catId);
        return cat && this.#matches(cat.label, term);
      });
      if (matchedCategory) {
        results.push(this.#buildSearchResult(note, this.#formatNoteDate(note)));
        continue;
      }

      // Match by content
      if (searchContent) {
        const page = NoteManager.getFullNote(note.id);
        if (page?.text?.content && this.#matches(page.text.content, term)) {
          const snippet = this.#extractSnippet(page.text.content, term);
          results.push(this.#buildSearchResult(note, snippet));
        }
      }
    }

    return results;
  }

  /**
   * Build a search result with icon data.
   * @param {object} note - Note stub
   * @param {string} description - Description text
   * @returns {SearchResult} - Search result with icon data
   */
  static #buildSearchResult(note, description) {
    const flagData = note.flagData || {};
    const iconData = this.#extractIconData(flagData);
    return {
      type: 'note',
      id: note.id,
      name: note.name,
      description,
      data: {
        journalId: note.journalId,
        flagData,
        ...iconData
      }
    };
  }

  /**
   * Extract icon-related data from note flags.
   * @param {object} flagData - Note flag data
   * @returns {object} - Icon data for template
   */
  static #extractIconData(flagData) {
    const result = {
      icon: flagData.icon || null,
      color: flagData.color || '#4a9eff',
      gmOnly: flagData.gmOnly || false,
      repeatIcon: null,
      repeatTooltip: null,
      categoryIcons: []
    };

    // Repeat icon based on recurrence type
    const repeatIcons = {
      daily: 'fas fa-rotate',
      weekly: 'fas fa-rotate',
      monthly: 'fas fa-rotate',
      yearly: 'fas fa-rotate',
      moon: 'fas fa-moon',
      random: 'fas fa-dice',
      linked: 'fas fa-link',
      seasonal: 'fas fa-leaf',
      weekOfMonth: 'fas fa-calendar-week',
      range: 'fas fa-arrows-left-right'
    };

    if (flagData.repeat && flagData.repeat !== 'never') {
      result.repeatIcon = repeatIcons[flagData.repeat] || 'fas fa-rotate';
      result.repeatTooltip = localize(`CALENDARIA.Repeat.${flagData.repeat}`);
    }

    // Category icons (max 6 to fit 3x2 grid alongside other icons)
    if (Array.isArray(flagData.categories) && flagData.categories.length > 0) {
      const allCategories = getAllCategories();
      const maxCategories = 6;
      for (let i = 0; i < Math.min(flagData.categories.length, maxCategories); i++) {
        const catId = flagData.categories[i];
        const catDef = allCategories.find((c) => c.id === catId);
        if (catDef) {
          result.categoryIcons.push({
            icon: catDef.icon,
            color: catDef.color,
            label: catDef.label
          });
        }
      }
    }

    return result;
  }

  /**
   * Format note date for display.
   * @param {object} note - Note stub
   * @returns {string} - DAY Month, DisplayYear
   */
  static #formatNoteDate(note) {
    const flagData = note.flagData;
    if (!flagData?.startDate) return '';
    const calendar = CalendarManager.getActiveCalendar();
    const { year, month, day } = flagData.startDate;
    const monthData = calendar?.monthsArray?.[month];
    const monthName = monthData ? localize(monthData.name) : format('CALENDARIA.Calendar.MonthFallback', { num: month + 1 });
    return `${day} ${monthName}, ${year}`;
  }

  /**
   * Extract snippet around search term match.
   * @param {string} content - Full content
   * @param {string} term - Search term (lowercase)
   * @returns {string} - Snippet of description text
   */
  static #extractSnippet(content, term) {
    const text = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const searchText = text.toLowerCase();
    const index = searchText.indexOf(term);
    if (index === -1) return `${text.slice(0, 60)}...`;
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + term.length + 30);
    let snippet = text.slice(start, end);
    if (start > 0) snippet = `...${snippet}`;
    if (end < text.length) snippet = `${snippet}...`;
    return snippet;
  }
}
