/**
 * Note Data Schema and Validation
 * @module Notes/NoteData
 * @author Tyler
 */

import { DISPLAY_STYLES, HOOKS, MODULE, NOTE_VISIBILITY, SETTINGS } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { isValidDate } from './_module.mjs';

/**
 * Default note data structure.
 * @returns {object}  Default note data
 */
export function getDefaultNoteData() {
  const currentDate = game.time.components;
  const yearZero = game.time.calendar?.years?.yearZero ?? 0;
  return {
    startDate: { year: (currentDate.year ?? 0) + yearZero, month: currentDate.month, dayOfMonth: currentDate.dayOfMonth, hour: currentDate.hour, minute: currentDate.minute },
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
    hasDuration: false,
    duration: 1,
    showBookends: false,
    displayStyle: DISPLAY_STYLES.ICON,
    visibility: game.user.isGM ? NOTE_VISIBILITY.HIDDEN : NOTE_VISIBILITY.VISIBLE,
    linkedFestival: null,
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
      for (const field of ['year', 'month', 'dayOfMonth']) {
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
  if (noteData.hasDuration !== undefined && typeof noteData.hasDuration !== 'boolean') errors.push('hasDuration must be a boolean');
  if (noteData.duration !== undefined) if (typeof noteData.duration !== 'number' || noteData.duration < 1) errors.push('duration must be a positive integer');
  if (noteData.showBookends !== undefined && typeof noteData.showBookends !== 'boolean') errors.push('showBookends must be a boolean');
  if (noteData.displayStyle !== undefined) {
    const validDisplayStyles = Object.values(DISPLAY_STYLES);
    if (!validDisplayStyles.includes(noteData.displayStyle)) errors.push(`displayStyle must be one of: ${validDisplayStyles.join(', ')}`);
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

/** Legacy `repeat` values that are superseded by conditionTree. `'computed'` is still functional via computedConfig. */
const DEPRECATED_REPEAT_VALUES = new Set(['daily', 'weekly', 'monthly', 'yearly', 'moon', 'random', 'linked', 'seasonal', 'weekOfMonth', 'range']);

/**
 * Sanitize and normalize note data.
 * @param {object} noteData  Raw note data
 * @returns {object}  Sanitized note data
 */
export function sanitizeNoteData(noteData) {
  if (noteData?.repeat && DEPRECATED_REPEAT_VALUES.has(noteData.repeat)) {
    foundry.utils.logCompatibilityWarning(`Calendaria: noteData.repeat ('${noteData.repeat}') is deprecated. Use noteData.conditionTree instead.`, { since: '1.0.0', until: '1.2.0', once: true });
  }
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
    hasDuration: noteData.hasDuration ?? defaults.hasDuration,
    duration: noteData.duration ?? defaults.duration,
    showBookends: noteData.showBookends ?? defaults.showBookends,
    displayStyle: noteData.displayStyle || defaults.displayStyle,
    visibility: noteData.visibility || defaults.visibility,
    ...(noteData.conditionTree ? { conditionTree: noteData.conditionTree } : noteData.conditions?.length ? { conditions: noteData.conditions } : {}),
    linkedFestival: noteData.linkedFestival || null,
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
  let enrichedFlagData = randomOccurrences?.occurrences ? { ...flagData, cachedRandomOccurrences: randomOccurrences.occurrences } : flagData;
  if (enrichedFlagData.conditionTree && enrichedFlagData.conditions) enrichedFlagData = Object.fromEntries(Object.entries(enrichedFlagData).filter(([k]) => k !== 'conditions'));
  const parentJournal = page.parent;
  const isOwner = parentJournal?.isOwner ?? page.isOwner;
  return {
    id: page.id,
    name: page.name,
    content: page.text?.content ?? '',
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
  return choices.map((value) => ({ value, label: localize(`CALENDARIA.Notes.Repeat.${value[0].toUpperCase()}${value.slice(1)}`), selected: value === selected }));
}

/**
 * Default preset defaults shape — all null means "don't override".
 * @returns {object} Empty defaults with all null values
 */
function emptyDefaults() {
  return {
    name: null,
    allDay: null,
    displayStyle: null,
    visibility: null,
    color: null,
    icon: null,
    reminderType: null,
    reminderOffset: null,
    reminderTargets: null,
    hasDuration: null,
    duration: null,
    maxOccurrences: null,
    silent: null,
    showBookends: null,
    defaultOwnership: null,
    macro: null,
    owners: [],
    content: null
  };
}

/** Reserved ID for the built-in Default preset. */
export const DEFAULT_PRESET_ID = '__default__';

/**
 * Seed definitions for built-in presets.
 * Used only for initial migration — after that, everything lives in CUSTOM_PRESETS setting.
 * @returns {object[]} Array of built-in preset seed objects
 */
export function getBuiltinPresetSeeds() {
  return [
    {
      id: DEFAULT_PRESET_ID,
      label: localize('CALENDARIA.Preset.Default'),
      color: '#4a9eff',
      icon: 'fas fa-calendar',
      defaults: {
        name: localize('CALENDARIA.Note.NewNote'),
        visibility: 'visible',
        displayStyle: 'banner',
        reminderType: 'chat',
        reminderTargets: 'all',
        reminderOffset: 1,
        defaultOwnership: 2
      }
    },
    { id: 'quest', label: localize('CALENDARIA.Preset.Quest'), color: '#4a9eff', icon: 'fas fa-scroll', defaults: { displayStyle: 'icon' } },
    {
      id: 'session',
      label: localize('CALENDARIA.Preset.Session'),
      color: '#51cf66',
      icon: 'fas fa-users',
      defaults: {
        displayStyle: 'icon',
        allDay: true,
        content: `<p><strong>${localize('CALENDARIA.Preset.SessionContent.Recap')}</strong></p><p></p><p><strong>${localize('CALENDARIA.Preset.SessionContent.KeyEvents')}</strong></p><p></p><p><strong>${localize('CALENDARIA.Preset.SessionContent.NPCsMet')}</strong></p><p></p><p><strong>${localize('CALENDARIA.Preset.SessionContent.LootRewards')}</strong></p><p></p><p><strong>${localize('CALENDARIA.Preset.SessionContent.NextSession')}</strong></p><p></p>`
      }
    },
    { id: 'meeting', label: localize('CALENDARIA.Preset.Meeting'), color: '#845ef7', icon: 'fas fa-handshake', defaults: { reminderType: 'toast', reminderOffset: 1 } },
    { id: 'birthday', label: localize('CALENDARIA.Preset.Birthday'), color: '#ff6b6b', icon: 'fas fa-cake-candles', defaults: { displayStyle: 'pip', allDay: true } },
    { id: 'deadline', label: localize('CALENDARIA.Preset.Deadline'), color: '#f03e3e', icon: 'fas fa-hourglass-end', defaults: { reminderType: 'toast', reminderOffset: 24 } },
    { id: 'reminder', label: localize('CALENDARIA.Reminder.Label'), color: '#fcc419', icon: 'fas fa-bell', defaults: { reminderType: 'toast', reminderOffset: 1 } },
    { id: 'downtime', label: localize('CALENDARIA.Preset.Downtime'), color: '#74c0fc', icon: 'fas fa-couch', defaults: { hasDuration: true, duration: 7 } },
    { id: 'lore', label: localize('CALENDARIA.Preset.Lore'), color: '#a9845b', icon: 'fas fa-book', defaults: { displayStyle: 'pip', allDay: true } }
  ];
}

/** Cached preset array; invalidated on settings change. Avoids repeated filter/sort on settings access. */
let _presetCache = null;

/** Per-render cache for resolveNoteDisplayProps, keyed by page ID. Prevents re-computation during a single render cycle. */
const _displayPropsCache = new Map();

/** Clear the cached preset list. */
export function invalidatePresetCache() {
  _presetCache = null;
}

/** Clear the per-render display props cache. Call at the start of each render cycle. */
export function clearDisplayPropsCache() {
  _displayPropsCache.clear();
}

/**
 * Get all presets sorted by sortOrder.
 * @returns {object[]} Sorted array of all presets
 */
export function getAllPresets() {
  if (_presetCache) return _presetCache;
  _presetCache = getAllPresetsIncludingHidden().filter((c) => !c.hidden && c.id !== DEFAULT_PRESET_ID);
  return _presetCache;
}

/**
 * Get all presets including hidden ones. Used by Preset Manager for editing.
 * @returns {object[]} Sorted array of all presets
 */
export function getAllPresetsIncludingHidden() {
  const raw = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_PRESETS) || [];
  const savedIds = new Set(raw.map((c) => c.id));
  const seeds = getBuiltinPresetSeeds()
    .filter((s) => !savedIds.has(s.id))
    .map((c) => ({ ...c, builtin: true, playerUsable: true, defaults: { ...emptyDefaults(), ...c.defaults } }));
  return [...raw, ...seeds].map((c) => ({ ...c, icon: c.icon && !c.icon.includes(' ') ? `fas ${c.icon}` : c.icon })).sort((a, b) => (a.label || '').localeCompare(b.label || ''));
}

/**
 * Get preset definition by ID.
 * @param {string} presetId - Preset ID
 * @returns {object|null} Preset definition or null if not found
 */
export function getPresetDefinition(presetId) {
  if (presetId === DEFAULT_PRESET_ID) return getAllPresetsIncludingHidden().find((c) => c.id === DEFAULT_PRESET_ID) || null;
  return getAllPresets().find((c) => c.id === presetId) || null;
}

/**
 * Check if a preset is custom (user-created, not built-in).
 * @param {string} presetId - Preset ID
 * @returns {boolean} True if the preset is custom
 */
export function isCustomPreset(presetId) {
  const cat = getPresetDefinition(presetId);
  return cat ? !cat.builtin : false;
}

/**
 * Get presets usable by non-GM players.
 * @returns {object[]} Array of player-usable presets
 */
export function getPlayerUsablePresets() {
  return getAllPresets().filter((c) => c.playerUsable);
}

/**
 * Add a custom preset to world settings.
 * @param {string} label  Preset label
 * @param {string} [color]  Hex color
 * @param {string} [icon]  FontAwesome icon class
 * @returns {Promise<object>}  The created preset
 */
export async function addCustomPreset(label, color = '#868e96', icon = 'fas fa-tag') {
  const id =
    label
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\da-z-]/g, '') || foundry.utils.randomID();
  const existing = getAllPresets();
  if (existing.find((c) => c.id === id)) return existing.find((c) => c.id === id);
  const maxSort = existing.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1);
  const newPreset = { id, label, color, icon, builtin: false, sortOrder: maxSort + 1, playerUsable: true, defaults: emptyDefaults() };
  const raw = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_PRESETS) || [];
  raw.push(newPreset);
  invalidatePresetCache();
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_PRESETS, raw);
  Hooks.callAll(HOOKS.PRESETS_CHANGED, getAllPresets());
  return newPreset;
}

/**
 * Add a bundled custom preset to world settings by full object, preserving its ID.
 * @param {object} preset - Full preset definition (id, label, color, icon, sortOrder, playerUsable, defaults, ...)
 * @returns {Promise<object|null>} The added preset, or null if skipped due to ID collision
 */
export async function upsertBundledCustomPreset(preset) {
  if (!preset?.id || !preset?.label) return null;
  const raw = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_PRESETS) || [];
  if (raw.find((c) => c.id === preset.id)) return null;
  const maxSort = raw.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1);
  const toAdd = { ...preset, builtin: false, sortOrder: preset.sortOrder ?? maxSort + 1, defaults: preset.defaults ?? emptyDefaults() };
  raw.push(toAdd);
  invalidatePresetCache();
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_PRESETS, raw);
  Hooks.callAll(HOOKS.PRESETS_CHANGED, getAllPresets());
  return toAdd;
}

/**
 * Delete a preset from world settings.
 * @param {string} presetId  Preset ID to delete
 * @returns {Promise<boolean>}  True if deleted
 */
export async function deleteCustomPreset(presetId) {
  const raw = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_PRESETS) || [];
  const index = raw.findIndex((c) => c.id === presetId);
  if (index === -1) return false;
  raw.splice(index, 1);
  invalidatePresetCache();
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_PRESETS, raw);
  Hooks.callAll(HOOKS.PRESETS_CHANGED, getAllPresets());
  return true;
}

/**
 * Update a preset's properties.
 * @param {string} presetId  Preset ID
 * @param {object} updates  Partial preset properties to merge
 * @returns {Promise<object|null>}  Updated preset or null if not found
 */
export async function updatePreset(presetId, updates) {
  const raw = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_PRESETS) || [];
  const cat = raw.find((c) => c.id === presetId);
  if (!cat) return null;
  const fields = ['label', 'color', 'icon', 'sortOrder', 'playerUsable'];
  for (const key of fields) if (updates[key] !== undefined) cat[key] = updates[key];
  if (updates.defaults !== undefined) cat.defaults = { ...(cat.defaults || emptyDefaults()), ...updates.defaults };
  invalidatePresetCache();
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_PRESETS, raw);
  Hooks.callAll(HOOKS.PRESETS_CHANGED, getAllPresets());
  return cat;
}

/**
 * Reorder presets by providing an ordered array of IDs.
 * @param {string[]} orderedIds  Preset IDs in desired order
 * @returns {Promise<void>}
 */
export async function reorderPresets(orderedIds) {
  const raw = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_PRESETS) || [];
  for (let i = 0; i < orderedIds.length; i++) {
    const cat = raw.find((c) => c.id === orderedIds[i]);
    if (cat) cat.sortOrder = i;
  }
  invalidatePresetCache();
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_PRESETS, raw);
  Hooks.callAll(HOOKS.PRESETS_CHANGED, getAllPresets());
}

/**
 * Save the full presets array to settings (used by Preset Manager).
 * @param {object[]} presets  Complete presets array
 * @returns {Promise<void>}
 */
export async function saveAllPresets(presets) {
  invalidatePresetCache();
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_PRESETS, presets);
  Hooks.callAll(HOOKS.PRESETS_CHANGED, getAllPresets());
}

/**
 * Get merged preset defaults for a set of preset IDs.
 * @param {string[]} presetIds  Array of preset IDs
 * @returns {object}  Merged defaults (non-null values only)
 */
export function getPresetDefaults(presetIds) {
  const allCats = getAllPresetsIncludingHidden();
  const defaultPreset = allCats.find((c) => c.id === DEFAULT_PRESET_ID);
  const merged = {};
  for (const [key, val] of Object.entries(defaultPreset.defaults)) if (val !== null && val !== undefined && !(Array.isArray(val) && val.length === 0)) merged[key] = val;
  if (!presetIds?.length) return merged;
  const matched = presetIds
    .filter((id) => id !== DEFAULT_PRESET_ID)
    .map((id) => allCats.find((c) => c.id === id))
    .filter(Boolean)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const cat of matched) {
    const d = cat.defaults;
    if (!d) continue;
    for (const [key, val] of Object.entries(d)) if (val !== null && val !== undefined && !(Array.isArray(val) && val.length === 0)) merged[key] = val;
  }
  return merged;
}

/**
 * Get the content template from presets (first non-null content wins).
 * @param {string[]} presetIds  Array of preset IDs
 * @returns {string|null}  Content template HTML or null
 */
export function getPresetContentTemplate(presetIds) {
  if (presetIds?.length) {
    const allCats = getAllPresets();
    for (const id of presetIds) {
      const cat = allCats.find((c) => c.id === id);
      if (cat?.defaults?.content) return cat.defaults.content;
    }
  }
  const defaultPreset = getPresetDefinition(DEFAULT_PRESET_ID);
  return defaultPreset.defaults?.content || null;
}

/**
 * Apply preset defaults to note data. Only sets fields that are null/undefined on the note.
 * @param {object} noteData  Note data to augment
 * @param {string[]} presetIds  Preset IDs to pull defaults from
 * @returns {object}  Augmented note data (mutated)
 */
export function applyPresetDefaultsToNoteData(noteData, presetIds) {
  const defaults = getPresetDefaults(presetIds);
  if (!Object.keys(defaults).length) return noteData;
  const fieldMap = {
    allDay: 'allDay',
    displayStyle: 'displayStyle',
    visibility: 'visibility',
    color: 'color',
    icon: 'icon',
    reminderType: 'reminderType',
    reminderOffset: 'reminderOffset',
    reminderTargets: 'reminderTargets',
    hasDuration: 'hasDuration',
    duration: 'duration',
    showBookends: 'showBookends',
    maxOccurrences: 'maxOccurrences',
    silent: 'silent',
    macro: 'macro'
  };
  const noteDefaults = getDefaultNoteData();
  for (const [defaultKey, noteKey] of Object.entries(fieldMap)) {
    if (defaults[defaultKey] == null) continue;
    if (noteData[noteKey] === noteDefaults[noteKey] || noteData[noteKey] == null) noteData[noteKey] = defaults[defaultKey];
  }
  if (defaults.owners?.length) {
    const existing = noteData.remindUsers || [];
    const combined = [...new Set([...existing, ...defaults.owners])];
    noteData.remindUsers = combined;
  }
  return noteData;
}

/**
 * Resolve the effective display properties for a note page.
 * @param {object} page - JournalEntryPage document (calendaria.calendarnote type)
 * @returns {{ displayStyle: string, visibility: string, color: string, icon: string, iconType: string }} Resolved display properties
 */
export function resolveNoteDisplayProps(page) {
  const id = page.id;
  if (_displayPropsCache.has(id)) return _displayPropsCache.get(id);
  const sys = page.system;
  const result = {
    displayStyle: sys.displayStyle || DISPLAY_STYLES.ICON,
    visibility: sys.visibility || NOTE_VISIBILITY.VISIBLE,
    color: sys.color || '#4a9eff',
    icon: sys.icon || 'fas fa-calendar',
    iconType: sys.iconType || 'fontawesome',
    isFestival: !!sys.linkedFestival
  };
  _displayPropsCache.set(id, result);
  return result;
}

/**
 * Enrich a note page into a plain object suitable for Handlebars templates.
 * @param {object} page - JournalEntryPage document (calendaria.calendarnote type)
 * @returns {object} Enriched note object with resolved display properties
 */
export function enrichNoteForDisplay(page) {
  const props = resolveNoteDisplayProps(page);
  return {
    id: page.id,
    name: page.name,
    parentId: page.parent?.id || null,
    displayStyle: props.displayStyle,
    visibility: props.visibility,
    color: props.color,
    icon: props.icon,
    iconType: props.iconType,
    isFestival: props.isFestival,
    isHidden: props.visibility === NOTE_VISIBILITY.HIDDEN,
    isSecret: props.visibility === NOTE_VISIBILITY.SECRET,
    isOwner: page.parent?.isOwner ?? page.isOwner,
    categories: page.system.categories || [],
    startDate: page.system.startDate,
    endDate: page.system.endDate,
    allDay: page.system.allDay ?? false,
    hasDuration: page.system.hasDuration ?? false,
    duration: page.system.duration ?? 0,
    showBookends: page.system.showBookends ?? false,
    author: page.system.author?.name || null
  };
}

/**
 * Extract recurrence match data from a note page for use with isRecurringMatch().
 * @param {object} page - JournalEntryPage document (calendaria.calendarnote type)
 * @returns {object} Recurrence data object consumable by isRecurringMatch()
 */
export function extractNoteMatchData(page) {
  return {
    startDate: page.system.startDate,
    endDate: page.system.endDate,
    repeat: page.system.repeat,
    repeatInterval: page.system.repeatInterval,
    repeatEndDate: page.system.repeatEndDate,
    maxOccurrences: page.system.maxOccurrences,
    moonConditions: page.system.moonConditions,
    randomConfig: page.system.randomConfig,
    cachedRandomOccurrences: page.flags?.[MODULE.ID]?.randomOccurrences,
    linkedEvent: page.system.linkedEvent,
    weekday: page.system.weekday,
    weekNumber: page.system.weekNumber,
    seasonalConfig: page.system.seasonalConfig,
    conditions: page.system.conditions,
    conditionTree: page.system.conditionTree,
    hasDuration: page.system.hasDuration,
    duration: page.system.duration
  };
}

/**
 * Migrate the preset schema: seed built-in presets into settings, backfill missing fields on custom presets.
 * @since 1.0.0
 * @deprecated Remove in 1.2.0
 * @returns {Promise<boolean>}  True if migration was performed
 */
export async function migratePresetSchema() {
  if (!game.user?.isGM) return false;
  const KEY = 'presetSchemaV2MigrationComplete';
  if (game.settings.get(MODULE.ID, KEY)) return false;
  const raw = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_PRESETS) || [];
  const existingIds = new Set(raw.map((c) => c.id));
  const seeds = getBuiltinPresetSeeds();
  const migrated = [];
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    if (existingIds.has(seed.id)) {
      const existing = raw.find((c) => c.id === seed.id);
      migrated.push({
        ...existing,
        label: existing.label || existing.name || seed.label,
        builtin: true,
        sortOrder: existing.sortOrder ?? i,
        playerUsable: existing.playerUsable ?? true,
        defaults: existing.defaults || emptyDefaults()
      });
    } else {
      migrated.push({ ...seed, builtin: true, sortOrder: i, playerUsable: true, defaults: emptyDefaults() });
    }
  }
  const builtinIds = new Set(seeds.map((s) => s.id));
  let customIndex = seeds.length;
  for (const cat of raw) {
    if (builtinIds.has(cat.id)) continue;
    migrated.push({
      id: cat.id,
      label: cat.label || cat.name || 'Unnamed',
      color: cat.color || '#868e96',
      icon: cat.icon || 'fa-tag',
      builtin: false,
      sortOrder: cat.sortOrder ?? customIndex++,
      playerUsable: cat.playerUsable ?? true,
      defaults: cat.defaults || emptyDefaults()
    });
  }
  invalidatePresetCache();
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_PRESETS, migrated);
  await game.settings.set(MODULE.ID, KEY, true);
  return true;
}
