import { CalendarManager } from '../calendar/_module.mjs';
import { NOTE_VISIBILITY } from '../constants.mjs';
import { formatForLocation } from '../utils/_module.mjs';
import { NoteManager, compareDates } from './_module.mjs';

/**
 * Filter and sort an array of note stubs based on filter state.
 * @param {object[]} notes - Note stubs from NoteManager.getAllNotes()
 * @param {object} state - Flat filter state object
 * @param {object} [options] - Additional options
 * @param {boolean} [options.isGM] - Whether the current user is a GM
 * @param {string|string[]} [options.calendarId] - Single calendar ID or array of IDs to include
 * @returns {object[]} Filtered and sorted note stubs
 */
export function filterNotes(notes, state, options = {}) {
  let result = [...notes];
  if (options.calendarId) {
    const ids = Array.isArray(options.calendarId) ? new Set(options.calendarId) : new Set([options.calendarId]);
    result = result.filter((n) => ids.has(n.calendarId));
  }
  if (!result.length) return result;
  if (!options.isGM) {
    result = result.filter((n) => {
      if (!n.visible) return false;
      const effective = n.flagData.visibility || NOTE_VISIBILITY.VISIBLE;
      return effective === NOTE_VISIBILITY.VISIBLE;
    });
  }
  if (state.visibility && state.visibility !== 'all') {
    result = result.filter((n) => {
      const effective = n.flagData.visibility || NOTE_VISIBILITY.VISIBLE;
      return effective === state.visibility;
    });
  }
  if (!result.length) return result;
  if (state.search && state.search.length >= 2) {
    const term = state.search.toLowerCase();
    result = result.filter((n) => n.name?.toLowerCase().includes(term));
  }
  if (!result.length) return result;
  if (state.presets?.size > 0) {
    result = result.filter((n) => {
      const cats = n.flagData.categories || [];
      if (state.presets.has('__none__') && cats.length === 0) return true;
      return cats.some((id) => state.presets.has(id));
    });
  }
  if (!result.length) return result;
  if (state.allDay) result = result.filter((n) => n.flagData.allDay === true);
  if (!result.length) return result;
  if (state.dateRangeStart && state.dateRangeEnd) {
    const rangeNotes = NoteManager.getNotesInRange(state.dateRangeStart, state.dateRangeEnd);
    const rangeIds = new Set(rangeNotes.map((n) => n.id));
    result = result.filter((n) => rangeIds.has(n.id));
  }
  if (!result.length) return result;
  if (options.isGM && state.author && state.author !== 'all') result = result.filter((n) => n.flagData.author?._id === state.author);
  if (state.hasDuration) result = result.filter((n) => n.flagData.hasDuration === true);
  if (state.isRecurring) result = result.filter((n) => (n.flagData.repeat && n.flagData.repeat !== 'never') || !!n.flagData.conditionTree);
  if (state.isFestival) result = result.filter((n) => !!n.flagData.linkedFestival);
  return sortNotes(result, state.sortBy);
}

/**
 * Sort note stubs by the given sort key.
 * @param {object[]} notes - Note stubs to sort
 * @param {string} sortBy - Sort key
 * @returns {object[]} Sorted array (mutates in place)
 */
function sortNotes(notes, sortBy = 'dateAsc') {
  switch (sortBy) {
    case 'dateDesc':
      return notes.sort((a, b) => compareDates(b.flagData.startDate, a.flagData.startDate));
    case 'nameAsc':
      return notes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'nameDesc':
      return notes.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    case 'dateAsc':
    default:
      return notes.sort((a, b) => compareDates(a.flagData.startDate, b.flagData.startDate));
  }
}

/**
 * Get unique authors from note stubs for the author filter dropdown.
 * @param {object[]} notes - Note stubs
 * @returns {{ id: string, name: string }[]} Unique authors sorted by name
 */
export function getAvailableAuthors(notes) {
  const seen = new Map();
  for (const note of notes) {
    const author = note.flagData.author;
    if (author?._id && !seen.has(author._id)) seen.set(author._id, { id: author._id, name: author.name || author._id });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Format a note's start date for display in the results list.
 * @param {object} note - Note stub
 * @returns {string} Formatted date string (e.g. "15 Hammer, 1492")
 */
export function formatNoteDate(note) {
  const flagData = note.flagData;
  if (!flagData?.startDate) return '';
  const calendar = CalendarManager.getActiveCalendar();
  const { year, month, dayOfMonth } = flagData.startDate;
  return formatForLocation(calendar, { year, month, dayOfMonth: dayOfMonth ?? 0, hour: 12, minute: 0, second: 0 }, 'noteViewerDate');
}
