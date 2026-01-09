/**
 * Note Data Schema and Validation
 * Defines the structure and validation rules for calendar note flags.
 * @module Notes/NoteData
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { isValidDate } from './utils/date-utils.mjs';

/**
 * Default note data structure.
 * @returns {object}  Default note data
 */
export function getDefaultNoteData() {
  const currentDate = game.time.components;

  return {
    startDate: { year: currentDate.year, month: currentDate.month, day: currentDate.dayOfMonth, hour: currentDate.hour, minute: currentDate.minute },
    endDate: null,
    allDay: false,
    repeat: 'never',
    repeatInterval: 1,
    repeatEndDate: null,
    weekday: null,
    seasonIndex: null,
    weekNumber: null,
    moonConditions: [],
    linkedEvent: null,
    rangePattern: null,
    categories: [],
    color: '#4a9eff',
    icon: 'fas fa-calendar',
    iconType: 'fontawesome',
    remindUsers: [],
    reminderOffset: 0,
    reminderType: 'toast',
    reminderTargets: game.user.isGM ? 'gm' : 'author',
    macro: null,
    sceneId: null,
    author: null,
    gmOnly: game.user.isGM,
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
  if (!noteData) {
    errors.push('Note data is required');
    return { valid: false, errors };
  }

  if (!noteData.startDate) errors.push('Start date is required');
  else if (!isValidDate(noteData.startDate)) errors.push('Start date is invalid');
  if (noteData.endDate && !isValidDate(noteData.endDate)) errors.push('End date is invalid');
  if (noteData.allDay !== undefined && typeof noteData.allDay !== 'boolean') errors.push('allDay must be a boolean');
  const validRepeatValues = CONFIG.JournalEntryPage.dataModels['calendaria.calendarnote']._schema.fields.repeat.choices;
  if (noteData.repeat && !validRepeatValues.includes(noteData.repeat)) errors.push(`repeat must be one of: ${validRepeatValues.join(', ')}`);
  if (noteData.weekday !== undefined && noteData.weekday !== null) {
    if (typeof noteData.weekday !== 'number' || noteData.weekday < 0) errors.push('weekday must be a non-negative number (0-indexed day of week)');
  }
  if (noteData.seasonIndex !== undefined && noteData.seasonIndex !== null) {
    if (typeof noteData.seasonIndex !== 'number' || noteData.seasonIndex < 0) errors.push('seasonIndex must be a non-negative number');
  }
  if (noteData.weekNumber !== undefined && noteData.weekNumber !== null) {
    if (typeof noteData.weekNumber !== 'number' || noteData.weekNumber < 1) errors.push('weekNumber must be a positive number (1-indexed week of month)');
  }
  if (noteData.repeatInterval !== undefined) if (typeof noteData.repeatInterval !== 'number' || noteData.repeatInterval < 1) errors.push('repeatInterval must be a positive number');
  if (noteData.repeatEndDate && !isValidDate(noteData.repeatEndDate)) errors.push('Repeat end date is invalid');
  if (noteData.moonConditions !== undefined) {
    if (!Array.isArray(noteData.moonConditions)) errors.push('moonConditions must be an array');
    else {
      for (let i = 0; i < noteData.moonConditions.length; i++) {
        const cond = noteData.moonConditions[i];
        if (typeof cond !== 'object' || cond === null) {
          errors.push(`moonConditions[${i}] must be an object`);
          continue;
        }
        if (typeof cond.moonIndex !== 'number' || cond.moonIndex < 0) errors.push(`moonConditions[${i}].moonIndex must be a non-negative number`);
        if (typeof cond.phaseStart !== 'number' || cond.phaseStart < 0 || cond.phaseStart > 1) errors.push(`moonConditions[${i}].phaseStart must be 0-1`);
        if (typeof cond.phaseEnd !== 'number' || cond.phaseEnd < 0 || cond.phaseEnd > 1) errors.push(`moonConditions[${i}].phaseEnd must be 0-1`);
      }
    }
  }
  if (noteData.linkedEvent !== undefined && noteData.linkedEvent !== null) {
    if (typeof noteData.linkedEvent !== 'object') {
      errors.push('linkedEvent must be an object or null');
    } else {
      if (typeof noteData.linkedEvent.noteId !== 'string' || !noteData.linkedEvent.noteId) errors.push('linkedEvent.noteId must be a non-empty string');
      if (typeof noteData.linkedEvent.offset !== 'number') errors.push('linkedEvent.offset must be a number');
    }
  }
  if (noteData.rangePattern !== undefined && noteData.rangePattern !== null) {
    if (typeof noteData.rangePattern !== 'object') {
      errors.push('rangePattern must be an object or null');
    } else {
      for (const field of ['year', 'month', 'day']) {
        const bit = noteData.rangePattern[field];
        if (bit !== undefined && bit !== null) {
          if (typeof bit === 'number') {
            continue;
          } else if (Array.isArray(bit) && bit.length === 2) {
            const [min, max] = bit;
            if (min !== null && typeof min !== 'number') errors.push(`rangePattern.${field}[0] must be number or null`);
            if (max !== null && typeof max !== 'number') errors.push(`rangePattern.${field}[1] must be number or null`);
          } else {
            errors.push(`rangePattern.${field} must be number, [min, max], or null`);
          }
        }
      }
    }
  }
  if (noteData.categories !== undefined) {
    if (!Array.isArray(noteData.categories)) errors.push('categories must be an array');
    else if (noteData.categories.some((c) => typeof c !== 'string')) errors.push('categories must be an array of strings');
  }
  if (noteData.color !== undefined) {
    if (typeof noteData.color !== 'string') errors.push('color must be a string');
    else if (!/^#[\dA-Fa-f]{6}$/.test(noteData.color)) errors.push('color must be a valid hex color (e.g., #4a9eff)');
  }
  if (noteData.icon !== undefined && typeof noteData.icon !== 'string') errors.push('icon must be a string');
  if (noteData.remindUsers !== undefined) {
    if (!Array.isArray(noteData.remindUsers)) errors.push('remindUsers must be an array');
    else if (noteData.remindUsers.some((id) => typeof id !== 'string')) errors.push('remindUsers must be an array of user IDs (strings)');
  }
  if (noteData.reminderOffset !== undefined) if (typeof noteData.reminderOffset !== 'number') errors.push('reminderOffset must be a number');
  if (noteData.macro !== undefined && noteData.macro !== null) if (typeof noteData.macro !== 'string') errors.push('macro must be a string (macro ID) or null');
  if (noteData.sceneId !== undefined && noteData.sceneId !== null) if (typeof noteData.sceneId !== 'string') errors.push('sceneId must be a string (scene ID) or null');
  return { valid: errors.length === 0, errors };
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
    weekday: noteData.weekday ?? null,
    seasonIndex: noteData.seasonIndex ?? null,
    weekNumber: noteData.weekNumber ?? null,
    moonConditions: Array.isArray(noteData.moonConditions) ? noteData.moonConditions : defaults.moonConditions,
    linkedEvent: noteData.linkedEvent || null,
    rangePattern: noteData.rangePattern || null,
    categories: Array.isArray(noteData.categories) ? noteData.categories : defaults.categories,
    color: noteData.color || defaults.color,
    icon: noteData.icon || defaults.icon,
    remindUsers: Array.isArray(noteData.remindUsers) ? noteData.remindUsers : defaults.remindUsers,
    reminderOffset: noteData.reminderOffset ?? defaults.reminderOffset,
    reminderType: noteData.reminderType || defaults.reminderType,
    reminderTargets: noteData.reminderTargets || defaults.reminderTargets,
    macro: noteData.macro || null,
    sceneId: noteData.sceneId || null,
    author: noteData.author || null,
    gmOnly: noteData.gmOnly ?? game.user.isGM,
    isCalendarNote: true,
    version: noteData.version || defaults.version
  };
}

/**
 * Create a note stub for indexing (lightweight reference).
 * @param {object} page  Journal entry page document
 * @returns {object|null}  Note stub or null if not a calendar note
 */
export function createNoteStub(page) {
  if (page.type !== 'calendaria.calendarnote') return null;
  const flagData = page.system;
  if (!flagData) return null;
  let calendarId = page.getFlag(MODULE.ID, 'calendarId') || page.parent?.getFlag(MODULE.ID, 'calendarId');
  if (!calendarId && page.parent?.folder) calendarId = page.parent.folder.getFlag?.(MODULE.ID, 'calendarId') || null;
  const randomOccurrences = page.getFlag(MODULE.ID, 'randomOccurrences');
  const enrichedFlagData = randomOccurrences?.occurrences ? { ...flagData, cachedRandomOccurrences: randomOccurrences.occurrences } : flagData;
  const parentJournal = page.parent;
  const isOwner = parentJournal?.isOwner ?? page.isOwner;
  return {
    id: page.id,
    name: page.name,
    flagData: enrichedFlagData,
    calendarId,
    visible: page.testUserPermission(game.user, 'OBSERVER'),
    isOwner,
    journalId: parentJournal?.id || null,
    ownership: parentJournal?.ownership || page.ownership
  };
}

/**
 * Get repeat options from the data model with localized labels.
 * @param {string} [selected]  Currently selected repeat value
 * @returns {object[]}  Array of { value, label, selected }
 */
export function getRepeatOptions(selected = 'never') {
  const choices = CONFIG.JournalEntryPage.dataModels['calendaria.calendarnote']._schema.fields.repeat.choices;
  return choices.map((value) => ({ value, label: localize(`CALENDARIA.Repeat.${value}`), selected: value === selected }));
}

/**
 * Get predefined note categories.
 * @returns {object[]}  Array of category definitions
 */
export function getPredefinedCategories() {
  return [
    { id: 'holiday', label: localize('CALENDARIA.Category.Holiday'), color: '#ff6b6b', icon: 'fa-gift' },
    { id: 'festival', label: localize('CALENDARIA.Category.Festival'), color: '#f0a500', icon: 'fa-masks-theater' },
    { id: 'quest', label: localize('CALENDARIA.Category.Quest'), color: '#4a9eff', icon: 'fa-scroll' },
    { id: 'session', label: localize('CALENDARIA.Category.Session'), color: '#51cf66', icon: 'fa-users' },
    { id: 'combat', label: localize('CALENDARIA.Category.Combat'), color: '#ff6b6b', icon: 'fa-swords' },
    { id: 'meeting', label: localize('CALENDARIA.Category.Meeting'), color: '#845ef7', icon: 'fa-handshake' },
    { id: 'birthday', label: localize('CALENDARIA.Category.Birthday'), color: '#ff6b6b', icon: 'fa-cake-candles' },
    { id: 'deadline', label: localize('CALENDARIA.Category.Deadline'), color: '#f03e3e', icon: 'fa-hourglass-end' },
    { id: 'reminder', label: localize('CALENDARIA.Category.Reminder'), color: '#fcc419', icon: 'fa-bell' },
    { id: 'other', label: localize('CALENDARIA.Category.Other'), color: '#868e96', icon: 'fa-circle' }
  ];
}

/**
 * Get custom categories from world settings.
 * @returns {object[]}  Array of custom category definitions
 */
export function getCustomCategories() {
  const raw = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES) || [];
  return raw.map((c) => ({ id: c.id, label: c.label || c.name, color: c.color, icon: c.icon || 'fa-tag', custom: true }));
}

/**
 * Get all categories (predefined + custom).
 * @returns {object[]}  Merged array of category definitions
 */
export function getAllCategories() {
  const predefined = getPredefinedCategories();
  const custom = getCustomCategories();
  return [...predefined, ...custom];
}

/**
 * Add a custom category to world settings.
 * @param {string} label  Category label
 * @param {string} [color]  Hex color (defaults to gray)
 * @param {string} [icon]  FontAwesome icon class (defaults to fa-tag)
 * @returns {Promise<object>}  The created category
 */
export async function addCustomCategory(label, color = '#868e96', icon = 'fa-tag') {
  const id = label
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\da-z-]/g, '');
  const existing = getAllCategories().find((c) => c.id === id);
  if (existing) return existing;
  const newCategory = { id, label, color, icon, custom: true };
  const customCategories = getCustomCategories();
  customCategories.push(newCategory);
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES, customCategories);
  return newCategory;
}

/**
 * Delete a custom category from world settings.
 * @param {string} categoryId  Category ID to delete
 * @returns {Promise<boolean>}  True if deleted, false if not found or predefined
 */
export async function deleteCustomCategory(categoryId) {
  const predefined = getPredefinedCategories().find((c) => c.id === categoryId);
  if (predefined) return false;
  const customCategories = getCustomCategories();
  const index = customCategories.findIndex((c) => c.id === categoryId);
  if (index === -1) return false;
  customCategories.splice(index, 1);
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES, customCategories);
  return true;
}

/**
 * Check if a category is custom (user-created).
 * @param {string} categoryId  Category ID
 * @returns {boolean}  True if custom
 */
export function isCustomCategory(categoryId) {
  const custom = getCustomCategories();
  return custom.some((c) => c.id === categoryId);
}

/**
 * Get category definition by ID.
 * @param {string} categoryId  Category ID
 * @returns {object|null}  Category definition or null
 */
export function getCategoryDefinition(categoryId) {
  const categories = getAllCategories();
  return categories.find((c) => c.id === categoryId) || null;
}
