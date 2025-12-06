/**
 * Note Data Schema and Validation
 * Defines the structure and validation rules for calendar note flags.
 *
 * @module Notes/NoteData
 * @author Tyler
 */

import { isValidDate } from './utils/date-utils.mjs';

/**
 * Default note data structure.
 * @returns {object}  Default note data
 */
export function getDefaultNoteData() {
  const currentDate = game.time.components;

  return {
    startDate: {
      year: currentDate.year,
      month: currentDate.month,
      day: currentDate.dayOfMonth,
      hour: currentDate.hour,
      minute: currentDate.minute
    },
    endDate: null,
    allDay: false,
    repeat: 'never',
    repeatInterval: 1,
    repeatEndDate: null,
    categories: [],
    color: '#4a9eff',
    icon: 'fas fa-calendar',
    iconType: 'fontawesome',
    remindUsers: [],
    reminderOffset: 0,
    macro: null,
    sceneId: null,
    isCalendarNote: true,
    version: 1
  };
}

/**
 * Validate note data structure.
 * @param {object} noteData  Note data to validate
 * @returns {object}  { valid: boolean, errors: string[] }
 */
export function validateNoteData(noteData) {
  const errors = [];

  // Check required fields
  if (!noteData) {
    errors.push('Note data is required');
    return { valid: false, errors };
  }

  // Validate start date
  if (!noteData.startDate) errors.push('Start date is required');
  else if (!isValidDate(noteData.startDate)) errors.push('Start date is invalid');

  // Validate end date if present
  if (noteData.endDate && !isValidDate(noteData.endDate)) errors.push('End date is invalid');

  // Validate allDay
  if (noteData.allDay !== undefined && typeof noteData.allDay !== 'boolean') errors.push('allDay must be a boolean');

  // Validate repeat
  const validRepeatValues = ['never', 'daily', 'weekly', 'monthly', 'yearly'];
  if (noteData.repeat && !validRepeatValues.includes(noteData.repeat)) errors.push(`repeat must be one of: ${validRepeatValues.join(', ')}`);

  // Validate repeat interval
  if (noteData.repeatInterval !== undefined) if (typeof noteData.repeatInterval !== 'number' || noteData.repeatInterval < 1) errors.push('repeatInterval must be a positive number');

  // Validate repeat end date if present
  if (noteData.repeatEndDate && !isValidDate(noteData.repeatEndDate)) errors.push('Repeat end date is invalid');

  // Validate categories
  if (noteData.categories !== undefined) {
    if (!Array.isArray(noteData.categories)) errors.push('categories must be an array');
    else if (noteData.categories.some((c) => typeof c !== 'string')) errors.push('categories must be an array of strings');
  }

  // Validate color
  if (noteData.color !== undefined) {
    if (typeof noteData.color !== 'string') errors.push('color must be a string');
    else if (!/^#[0-9A-Fa-f]{6}$/.test(noteData.color)) errors.push('color must be a valid hex color (e.g., #4a9eff)');
  }

  // Validate icon
  if (noteData.icon !== undefined && typeof noteData.icon !== 'string') errors.push('icon must be a string');

  // Validate remind users
  if (noteData.remindUsers !== undefined) {
    if (!Array.isArray(noteData.remindUsers)) errors.push('remindUsers must be an array');
    else if (noteData.remindUsers.some((id) => typeof id !== 'string')) errors.push('remindUsers must be an array of user IDs (strings)');
  }

  // Validate reminder offset
  if (noteData.reminderOffset !== undefined) if (typeof noteData.reminderOffset !== 'number') errors.push('reminderOffset must be a number');

  // Validate macro
  if (noteData.macro !== undefined && noteData.macro !== null) if (typeof noteData.macro !== 'string') errors.push('macro must be a string (macro ID) or null');

  // Validate scene ID
  if (noteData.sceneId !== undefined && noteData.sceneId !== null) if (typeof noteData.sceneId !== 'string') errors.push('sceneId must be a string (scene ID) or null');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize and normalize note data.
 * @param {object} noteData  Raw note data
 * @returns {object}  Sanitized note data
 */
export function sanitizeNoteData(noteData) {
  const defaults = getDefaultNoteData();

  return {
    startDate: noteData.startDate || defaults.startDate,
    endDate: noteData.endDate || null,
    allDay: noteData.allDay ?? defaults.allDay,
    repeat: noteData.repeat || defaults.repeat,
    repeatInterval: noteData.repeatInterval ?? defaults.repeatInterval,
    repeatEndDate: noteData.repeatEndDate || null,
    categories: Array.isArray(noteData.categories) ? noteData.categories : defaults.categories,
    color: noteData.color || defaults.color,
    icon: noteData.icon || defaults.icon,
    remindUsers: Array.isArray(noteData.remindUsers) ? noteData.remindUsers : defaults.remindUsers,
    reminderOffset: noteData.reminderOffset ?? defaults.reminderOffset,
    macro: noteData.macro || null,
    sceneId: noteData.sceneId || null,
    isCalendarNote: true,
    version: noteData.version || defaults.version
  };
}

/**
 * Create a note stub for indexing (lightweight reference).
 * @param {JournalEntryPage} page  Journal entry page document
 * @returns {object|null}  Note stub or null if not a calendar note
 */
export function createNoteStub(page) {
  // Only process calendaria.calendarnote pages
  if (page.type !== 'calendaria.calendarnote') return null;

  const flagData = page.system;

  if (!flagData || !flagData.isCalendarNote) return null;

  return {
    id: page.id,
    name: page.name,
    flagData: flagData,
    visible: page.testUserPermission(game.user, 'OBSERVER'),
    journalId: page.parent?.id || null,
    ownership: page.ownership
  };
}

/**
 * Get predefined note categories.
 * @returns {object[]}  Array of category definitions
 */
export function getPredefinedCategories() {
  return [
    { id: 'holiday', label: 'Holiday', color: '#ff6b6b', icon: 'fa-gift' },
    { id: 'festival', label: 'Festival', color: '#f0a500', icon: 'fa-masks-theater' },
    { id: 'quest', label: 'Quest', color: '#4a9eff', icon: 'fa-scroll' },
    { id: 'session', label: 'Session', color: '#51cf66', icon: 'fa-users' },
    { id: 'combat', label: 'Combat', color: '#ff6b6b', icon: 'fa-swords' },
    { id: 'meeting', label: 'Meeting', color: '#845ef7', icon: 'fa-handshake' },
    { id: 'birthday', label: 'Birthday', color: '#ff6b6b', icon: 'fa-cake-candles' },
    { id: 'deadline', label: 'Deadline', color: '#f03e3e', icon: 'fa-hourglass-end' },
    { id: 'reminder', label: 'Reminder', color: '#fcc419', icon: 'fa-bell' },
    { id: 'other', label: 'Other', color: '#868e96', icon: 'fa-circle' }
  ];
}

/**
 * Get category definition by ID.
 * @param {string} categoryId  Category ID
 * @returns {object|null}  Category definition or null
 */
export function getCategoryDefinition(categoryId) {
  const categories = getPredefinedCategories();
  return categories.find((c) => c.id === categoryId) || null;
}
