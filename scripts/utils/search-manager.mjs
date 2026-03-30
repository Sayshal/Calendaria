/**
 * Search Manager
 * @module Search/SearchManager
 * @author Tyler
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { NoteManager, getAllPresets, getPresetOverrides } from '../notes/_module.mjs';
import { format, localize } from './localization.mjs';
import { stripSecrets } from './ui/calendar-view-utils.mjs';

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
   * @returns {object[]} Matching notes
   */
  static search(term, options = {}) {
    if (!term || typeof term !== 'string') return [];
    const searchTerm = term.trim().toLowerCase();
    if (searchTerm.length < 2) return [];
    const searchContent = options.searchContent !== false;
    const limit = options.limit || 50;
    const results = this.#searchNotes(searchTerm, limit, searchContent);
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
   * @returns {object[]} - Results
   */
  static #searchNotes(term, limit, searchContent) {
    const results = [];
    const allNotes = NoteManager.getAllNotes().filter((stub) => stub.visible);
    const allPresets = getAllPresets();
    if (term.startsWith('preset:')) {
      const presetName = term.slice(7).trim();
      if (!presetName) return results;
      const matchingPresets = allPresets.filter((c) => c.label.toLowerCase().includes(presetName));
      if (matchingPresets.length === 0) return results;
      const matchingPresetIds = matchingPresets.map((c) => c.id);
      for (const note of allNotes) {
        if (results.length >= limit) break;
        const noteCategories = note.flagData?.categories ?? [];
        if (noteCategories.some((id) => matchingPresetIds.includes(id))) results.push(this.#buildobject(note, this.#formatNoteDate(note)));
      }
      return results;
    }
    for (const note of allNotes) {
      if (results.length >= limit) break;
      if (this.#matches(note.name, term)) {
        results.push(this.#buildobject(note, this.#formatNoteDate(note)));
        continue;
      }
      const noteCategories = note.flagData?.categories ?? [];
      const matchedPreset = noteCategories.some((catId) => {
        const cat = allPresets.find((c) => c.id === catId);
        return cat && this.#matches(cat.label, term);
      });
      if (matchedPreset) {
        results.push(this.#buildobject(note, this.#formatNoteDate(note)));
        continue;
      }
      if (searchContent) {
        const page = NoteManager.getFullNote(note.id);
        const cleaned = stripSecrets(page?.text?.content);
        if (cleaned && this.#matches(cleaned, term)) {
          const snippet = this.#extractSnippet(cleaned, term);
          results.push(this.#buildobject(note, snippet));
        }
      }
    }
    return results;
  }

  /**
   * Build a search result with icon data.
   * @param {object} note - Note stub
   * @param {string} description - Description text
   * @returns {object} - Search result with icon data
   */
  static #buildobject(note, description) {
    const flagData = note.flagData || {};
    const iconData = this.#extractIconData(flagData);
    return { type: 'note', id: note.id, name: note.name, description, data: { journalId: note.journalId, flagData, ...iconData } };
  }

  /**
   * Extract icon-related data from note flags.
   * @param {object} flagData - Note flag data
   * @returns {object} - Icon data for template
   */
  static #extractIconData(flagData) {
    const overrides = getPresetOverrides(flagData.categories);
    const result = {
      icon: flagData.icon || null,
      color: flagData.color || '#4a9eff',
      visibility: overrides.visibility || flagData.visibility || 'visible',
      repeatIcon: null,
      repeatTooltip: null,
      presetIcons: []
    };
    if (flagData.conditionTree) {
      result.repeatIcon = 'fas fa-rotate';
      result.repeatTooltip = localize('CALENDARIA.Note.HasConditions');
    }
    if (Array.isArray(flagData.categories) && flagData.categories.length > 0) {
      const allPresets = getAllPresets();
      const maxPresets = 6;
      for (let i = 0; i < Math.min(flagData.categories.length, maxPresets); i++) {
        const catId = flagData.categories[i];
        const catDef = allPresets.find((c) => c.id === catId);
        if (catDef) result.presetIcons.push({ icon: catDef.icon, color: catDef.color, label: catDef.label });
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
    const { year, month, dayOfMonth } = flagData.startDate;
    const monthData = calendar?.monthsArray?.[month];
    const monthName = monthData ? localize(monthData.name) : format('CALENDARIA.Common.MonthFallback', { num: month + 1 });
    return `${(dayOfMonth ?? 0) + 1} ${monthName}, ${year}`;
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
