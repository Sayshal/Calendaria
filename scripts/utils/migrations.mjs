/**
 * Consolidated Migration Utilities
 * @module Utils/Migrations
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { dayOfWeek, extractEventDependencies, getOccurrencesInRange, invalidatePresetCache, migratePresetSchema } from '../notes/_module.mjs';
import { log } from './logger.mjs';

/** Converter dispatch table. */
const CONDITION_TREE_CONVERTERS = {
  daily: convertDaily,
  weekly: convertWeekly,
  monthly: convertMonthly,
  yearly: convertYearly,
  seasonal: convertSeasonal,
  weekOfMonth: convertWeekOfMonth,
  range: convertRange,
  moon: convertMoon,
  random: convertRandom,
  computed: convertComputed,
  linked: convertLinked
};

/**
 * Build an AND group, flattening single-child groups.
 * @param {object[]} children - Condition/group entries
 * @returns {object|null} Condition tree root or null if empty
 */
function buildAndGroup(children) {
  if (!children.length) return null;
  if (children.length === 1) return children[0];
  return { type: 'group', mode: 'and', children };
}

/**
 * Create a condition entry.
 * @param {string} field - Condition field name
 * @param {string} op - Operator
 * @param {*} value - Comparison value
 * @param {object} [extras] - Additional fields (value2, offset)
 * @returns {object} Condition entry
 */
function ct(field, op, value, extras = {}) {
  return { type: 'condition', field, op, value, ...extras };
}

/**
 * Convert daily repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object} Condition tree root
 */
function convertDaily(noteData) {
  const interval = noteData.repeatInterval || 1;
  if (interval === 1) return { type: 'group', mode: 'and', children: [] };
  return ct('date', '%', interval);
}

/**
 * Convert weekly repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object} Condition tree root
 */
function convertWeekly(noteData) {
  const interval = noteData.repeatInterval || 1;
  const children = [ct('weekday', '==', dayOfWeek(noteData.startDate) + 1)];
  if (interval > 1) children.push(ct('totalWeek', '%', interval));
  return buildAndGroup(children);
}

/**
 * Convert monthly repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object} Condition tree root
 */
function convertMonthly(noteData) {
  const interval = noteData.repeatInterval || 1;
  const children = [ct('day', '==', noteData.startDate.dayOfMonth + 1)];
  if (interval > 1) children.push(ct('month', '%', interval));
  return buildAndGroup(children);
}

/**
 * Convert yearly repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object} Condition tree root
 */
function convertYearly(noteData) {
  const interval = noteData.repeatInterval || 1;
  const children = [ct('month', '==', noteData.startDate.month + 1), ct('day', '==', noteData.startDate.dayOfMonth + 1)];
  if (interval > 1) children.push(ct('year', '%', interval));
  return buildAndGroup(children);
}

/**
 * Convert seasonal repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertSeasonal(noteData) {
  const config = noteData.seasonalConfig;
  if (!config) return null;
  const children = [ct('season', '==', (config.seasonIndex ?? 0) + 1)];
  if (config.trigger === 'firstDay' || config.trigger === 'lastDay') {
    const season = CalendarManager.getActiveCalendar()?.seasonsArray?.[config.seasonIndex];
    if (season) children.push(ct('dayOfYear', '==', config.trigger === 'firstDay' ? (season.dayStart ?? 0) : (season.dayEnd ?? 0)));
  }
  return buildAndGroup(children);
}

/**
 * Convert weekOfMonth repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object} Condition tree root
 */
function convertWeekOfMonth(noteData) {
  const interval = noteData.repeatInterval || 1;
  const daysInWeek = CalendarManager.getActiveCalendar()?.daysInWeek ?? 7;
  const children = [ct('weekday', '==', (noteData.weekday ?? dayOfWeek(noteData.startDate)) + 1)];
  const weekNumber = noteData.weekNumber ?? Math.ceil((noteData.startDate.dayOfMonth + 1) / daysInWeek);
  if (weekNumber > 0) children.push(ct('weekNumberInMonth', '==', weekNumber));
  else children.push(ct('inverseWeekNumber', '==', Math.abs(weekNumber)));
  if (interval > 1) children.push(ct('month', '%', interval));
  return buildAndGroup(children);
}

/**
 * Convert range pattern repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertRange(noteData) {
  const pattern = noteData.rangePattern;
  if (!pattern) return null;
  const children = [];
  addRangeBit(children, 'year', pattern.year);
  addRangeBit(children, 'month', offsetRangeBit(pattern.month, 1));
  addRangeBit(children, 'day', pattern.dayOfMonth);
  if (!children.length) return { type: 'group', mode: 'and', children: [] };
  return buildAndGroup(children);
}

/**
 * Offset a range bit value (number or [min, max]) by a fixed amount.
 * @param {*} rangeBit - Range specification (number, [min, max], or null)
 * @param {number} offset - Amount to add
 * @returns {*} Offset range bit
 */
function offsetRangeBit(rangeBit, offset) {
  if (rangeBit == null) return null;
  if (typeof rangeBit === 'number') return rangeBit + offset;
  if (Array.isArray(rangeBit) && rangeBit.length === 2) return [rangeBit[0] !== null ? rangeBit[0] + offset : null, rangeBit[1] !== null ? rangeBit[1] + offset : null];
  return rangeBit;
}

/**
 * Add conditions for a range bit specification.
 * @param {object[]} children - Array to push conditions onto
 * @param {string} field - Condition field name
 * @param {*} rangeBit - Range specification (number, [min, max], or null)
 */
function addRangeBit(children, field, rangeBit) {
  if (rangeBit == null) return;
  if (typeof rangeBit === 'number') {
    children.push(ct(field, '==', rangeBit));
    return;
  }
  if (Array.isArray(rangeBit) && rangeBit.length === 2) {
    if (rangeBit[0] !== null) children.push(ct(field, '>=', rangeBit[0]));
    if (rangeBit[1] !== null) children.push(ct(field, '<=', rangeBit[1]));
  }
}

/**
 * Convert moon repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertMoon(noteData) {
  const moonConditions = noteData.moonConditions;
  if (!moonConditions?.length) return null;
  const calendar = CalendarManager.getActiveCalendar();
  const orChildren = [];
  for (const cond of moonConditions) {
    const moon = calendar?.moonsArray?.[cond.moonIndex];
    if (!moon) continue;
    const phases = Object.values(moon.phases ?? {});
    const phaseIdx = phases.findIndex((p) => Math.abs(p.start - cond.phaseStart) < 0.01 && Math.abs(p.end - cond.phaseEnd) < 0.01);
    if (phaseIdx === -1) continue;
    const phaseCondition = ct('moonPhaseIndex', '==', phaseIdx, { value2: cond.moonIndex });
    const modifier = cond.modifier || 'any';
    if (modifier === 'any') {
      orChildren.push(phaseCondition);
    } else {
      const modValue = modifier === 'rising' ? 1 : modifier === 'true' ? 2 : 3;
      orChildren.push(buildAndGroup([phaseCondition, ct('moonSubPhase', '==', modValue, { value2: cond.moonIndex })]));
    }
  }
  if (!orChildren.length) return null;
  if (orChildren.length === 1) return orChildren[0];
  return { type: 'group', mode: 'or', children: orChildren };
}

/**
 * Convert random repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertRandom(noteData) {
  const config = noteData.randomConfig;
  if (!config) return null;
  const { seed, probability, checkInterval } = config;
  if (probability <= 0) return null;
  if (probability >= 100) return { type: 'group', mode: 'and', children: [] };
  const children = [ct('random', '<=', probability, { value2: seed })];
  if (checkInterval === 'weekly') children.push(ct('weekday', '==', dayOfWeek(noteData.startDate) + 1));
  else if (checkInterval === 'monthly') children.push(ct('day', '==', noteData.startDate.dayOfMonth + 1));
  return buildAndGroup(children);
}

/**
 * Convert computed repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertComputed(noteData) {
  const config = noteData.computedConfig;
  if (!config?.chain?.length) return null;
  return ct('computed', '==', true, { value2: config });
}

/**
 * Convert linked repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertLinked(noteData) {
  const { linkedEvent } = noteData;
  if (!linkedEvent?.noteId) return null;
  const { noteId, offset } = linkedEvent;
  if (offset >= 0) return ct('event', 'daysAgo', offset, { value2: { noteId } });
  return ct('event', 'daysFromNow', Math.abs(offset), { value2: { noteId } });
}

/**
 * Normalize conditions array entries to include type discriminator.
 * @param {object[]} conditions - Existing conditions from the note
 * @returns {object[]} Normalized conditions
 */
function normalizeConditions(conditions) {
  if (!conditions?.length) return [];
  return conditions.map((entry) => {
    if (entry.type === 'condition' || entry.type === 'group') return entry;
    if (entry.mode && entry.children) return { type: 'group', ...entry };
    return { type: 'condition', ...entry };
  });
}

/**
 * Convert a note's legacy recurrence to a condition tree.
 * @param {object} noteData - Note flag data (page.system)
 * @returns {object|null} Condition tree root, or null if not convertible
 */
export function convertToConditionTree(noteData) {
  if (noteData.conditionTree) return noteData.conditionTree;
  const { repeat, conditions } = noteData;
  if (repeat === 'never' || !repeat) {
    const normalized = normalizeConditions(conditions);
    return normalized.length ? buildAndGroup(normalized) : null;
  }
  const converter = CONDITION_TREE_CONVERTERS[repeat];
  if (!converter) return null;
  const recurrenceTree = converter(noteData);
  if (!recurrenceTree) return null;
  const normalized = normalizeConditions(conditions);
  if (!normalized.length) return recurrenceTree;
  const allChildren = recurrenceTree.type === 'group' && recurrenceTree.mode === 'and' ? [...recurrenceTree.children, ...normalized] : [recurrenceTree, ...normalized];
  return buildAndGroup(allChildren);
}

/**
 * Validate migration by comparing occurrences against old engine over a 3-year range.
 * @param {object} oldData - Original note data (no conditionTree)
 * @param {object} newData - Migrated note data (with conditionTree)
 * @param {string} name - Note name for logging
 * @returns {boolean} True if occurrences match
 */
function validateNoteMigration(oldData, newData, name) {
  const { startDate } = oldData;
  const rangeEnd = { year: startDate.year + 3, month: startDate.month, dayOfMonth: startDate.dayOfMonth };
  const oldOcc = getOccurrencesInRange(oldData, startDate, rangeEnd, 500);
  const newOcc = getOccurrencesInRange(newData, startDate, rangeEnd, 500);
  const oldSet = new Set(oldOcc.map((d) => `${d.year}:${d.month}:${d.dayOfMonth}`));
  const newSet = new Set(newOcc.map((d) => `${d.year}:${d.month}:${d.dayOfMonth}`));
  let discrepancies = 0;
  for (const key of oldSet) if (!newSet.has(key)) discrepancies++;
  for (const key of newSet) if (!oldSet.has(key)) discrepancies++;
  if (discrepancies) log(2, `Migration discrepancy for "${name}": ${discrepancies} date mismatches over 3-year range`);
  return discrepancies === 0;
}

/**
 * Migrate notes from legacy repeat-type schema to condition tree format.
 * @since 1.0.0
 * @deprecated Remove in 1.2.0
 * @returns {Promise<void>}
 */
async function migrateNotesDataModel() {
  const KEY = 'noteConditionTreeMigrationComplete';
  if (!game.user?.isGM) return;
  if (game.settings.get(MODULE.ID, KEY)) return;
  log(3, 'Starting note condition tree migration...');
  const pages = [];
  for (const journal of game.journal) {
    for (const page of journal.pages) {
      if (page.type !== 'calendaria.calendarnote') continue;
      const noteData = page.system;
      if (!noteData?.startDate) continue;
      const hasLegacyRepeat = noteData.repeat && noteData.repeat !== 'never';
      const hasLegacyConditions = noteData.conditions?.length > 0;
      const needsConversion = !noteData.conditionTree && (hasLegacyRepeat || hasLegacyConditions);
      const needsCleanup = noteData.conditionTree && (hasLegacyRepeat || hasLegacyConditions);
      if (!needsConversion && !needsCleanup) continue;
      pages.push(page);
    }
  }
  let migrated = 0;
  let failed = 0;
  let warnings = 0;
  const total = pages.length;
  const BATCH_SIZE = 10;
  const LEGACY_RESETS = {
    'system.repeat': 'never',
    'system.repeatInterval': 1,
    'system.repeatEndDate': null,
    'system.maxOccurrences': 0,
    'system.moonConditions': [],
    'system.randomConfig': null,
    'system.linkedEvent': null,
    'system.rangePattern': null,
    'system.weekday': null,
    'system.weekNumber': null,
    'system.seasonalConfig': null,
    'system.computedConfig': null,
    'system.conditions': []
  };
  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const noteData = page.system;
    try {
      const updateData = { ...LEGACY_RESETS };
      if (!noteData.conditionTree) {
        const conditionTree = convertToConditionTree(noteData);
        if (!conditionTree) continue;
        const valid = validateNoteMigration({ ...noteData, conditionTree: undefined }, { ...noteData, conditionTree }, page.name);
        if (!valid) warnings++;
        updateData['system.conditionTree'] = conditionTree;
        const deps = extractEventDependencies(conditionTree);
        if (deps.length) updateData['system.connectedEvents'] = deps;
      }
      await page.update(updateData);
      migrated++;
    } catch (error) {
      failed++;
      log(1, `Failed to migrate note "${page.name}":`, error);
    }
    if (total > BATCH_SIZE && (i + 1) % BATCH_SIZE === 0) {
      ui.notifications?.info(`Calendaria: Migrating notes... ${i + 1}/${total}`);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  log(3, `Note migration complete: ${migrated} migrated, ${failed} failed${warnings ? `, ${warnings} with discrepancies` : ''}`);
  await game.settings.set(MODULE.ID, KEY, true);
}

/**
 * Migrate gmOnly boolean to visibility enum.
 * @since 1.0.0
 * @deprecated Remove in 1.2.0
 * @returns {Promise<void>}
 */
async function migrateNoteVisibility() {
  const KEY = 'noteVisibilityMigrationComplete';
  if (!game.user?.isGM) return;
  if (game.settings.get(MODULE.ID, KEY)) return;
  log(3, 'Starting note visibility migration...');
  let migrated = 0;
  for (const journal of game.journal) {
    for (const page of journal.pages) {
      if (page.type !== 'calendaria.calendarnote') continue;
      const source = page.toObject().system;
      if (source.visibility) continue;
      if (source.gmOnly === undefined) continue;
      const visibility = source.gmOnly ? 'hidden' : 'visible';
      await page.update({ 'system.visibility': visibility, 'system.-=gmOnly': null });
      migrated++;
    }
  }
  if (migrated > 0) log(3, `Migrated visibility for ${migrated} notes`);
  await game.settings.set(MODULE.ID, KEY, true);
}

/**
 * Remove the built-in 'festival' preset if no notes reference it in their categories.
 * @since 0.11.0
 * @deprecated Remove in 1.1.0
 * @returns {Promise<void>}
 */
async function migrateFestivalPresetRemoval() {
  if (!game.user?.isGM) return;
  const KEY = 'festivalPresetRemovalComplete';
  if (game.settings.get(MODULE.ID, KEY)) return;
  const raw = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_PRESETS) || [];
  if (!raw.some((p) => p.id === 'festival')) {
    await game.settings.set(MODULE.ID, KEY, true);
    return;
  }
  let inUse = false;
  for (const journal of game.journal) {
    for (const page of journal.pages) {
      if (page.type !== 'calendaria.calendarnote') continue;
      if (page.system?.categories?.includes('festival')) {
        inUse = true;
        break;
      }
    }
    if (inUse) break;
  }
  if (!inUse) {
    const filtered = raw.filter((p) => p.id !== 'festival');
    invalidatePresetCache();
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_PRESETS, filtered);
    log(3, 'Removed unused "festival" preset');
  }
  await game.settings.set(MODULE.ID, KEY, true);
}

/**
 * Run all migrations
 * @returns {Promise<void>}
 */
export async function runAllMigrations() {
  if (!game.user?.isGM) return;
  await migrateNotesDataModel();
  await migrateNoteVisibility();
  await migratePresetSchema();
  await migrateFestivalPresetRemoval();
}
