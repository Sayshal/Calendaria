import { CONDITION_FIELDS, CONDITION_OPERATORS, MODULE, SETTINGS } from '../constants.mjs';

/**
 * Rewrite lone `day % N` interval conditions to the absolute day counter so they space correctly across months.
 * @since 1.3.0
 * @deprecated Remove in 1.5.0
 * @returns {Promise<void>}
 */
async function migrateIntervalConditionField() {
  const KEY = 'intervalConditionFieldMigrationComplete';
  if (!ATLAS.isPrimaryGM) return;
  if (game.settings.get(MODULE.ID, KEY)) return;
  const isTarget = (node) => node?.type === 'condition' && node.field === CONDITION_FIELDS.DAY && node.op === CONDITION_OPERATORS.MODULO && node.value > 1;
  const containsTarget = (node) => {
    if (!node) return false;
    if (isTarget(node)) return true;
    return Array.isArray(node.children) && node.children.some(containsTarget);
  };
  const loneCondition = (tree) => {
    if (!tree) return null;
    if (isTarget(tree)) return tree;
    const children = Array.isArray(tree.children) ? tree.children : [];
    const conditions = children.filter((c) => c?.type === 'condition');
    if (children.length !== 1 || conditions.length !== 1) return null;
    return isTarget(conditions[0]) ? conditions[0] : null;
  };
  let migrated = 0;
  let failed = 0;
  const skipped = [];
  for (const journal of game.journal) {
    const updates = [];
    try {
      for (const page of journal.pages) {
        if (page.type !== 'calendaria.calendarnote') continue;
        const src = page.toObject().system;
        const tree = src?.conditionTree;
        const target = loneCondition(tree);
        if (!target) {
          if (containsTarget(tree)) skipped.push(page.name);
          continue;
        }
        const nextTree = foundry.utils.deepClone(tree);
        const nextNode = isTarget(nextTree) ? nextTree : nextTree.children.find((c) => c?.type === 'condition');
        nextNode.field = CONDITION_FIELDS.EPOCH;
        const nextConditions = foundry.utils.deepClone(src.conditions ?? []);
        for (const entry of nextConditions) {
          if (entry?.field === CONDITION_FIELDS.DAY && entry.op === CONDITION_OPERATORS.MODULO && entry.value === nextNode.value) entry.field = CONDITION_FIELDS.EPOCH;
        }
        updates.push({ _id: page.id, 'system.conditionTree': nextTree, 'system.conditions': nextConditions });
      }
      if (updates.length) {
        await JournalEntryPage.updateDocuments(updates, { parent: journal });
        migrated += updates.length;
      }
    } catch (error) {
      failed++;
      ATLAS.log(1, `Failed to migrate interval conditions in journal ${journal.name}:`, error);
    }
  }
  if (migrated > 0) ATLAS.log(3, `Rewrote ${migrated} interval condition(s) from day-of-month to absolute day count`);
  if (skipped.length) {
    ATLAS.log(2, `Left ${skipped.length} multi-condition note(s) with day-of-month intervals unchanged: ${skipped.join(', ')}`);
    ChatMessage.create({
      content: `<p>${_loc('CALENDARIA.Migration.IntervalConditionSkipped', { count: skipped.length })}</p><ul>${skipped.map((n) => `<li>${n}</li>`).join('')}</ul>`,
      whisper: [game.user.id]
    });
  }
  if (failed > 0) {
    ATLAS.log(1, `Interval condition migration incomplete, ${failed} journal(s) failed. Will retry on next load.`);
    return;
  }
  await game.settings.set(MODULE.ID, KEY, true);
}

/**
 * Strip the legacy `fas ` / `fa-solid ` prefix from festival icons in a keyed map of calendar data.
 * @param {object} calendars - Calendar data keyed by calendar id
 * @returns {boolean} True when at least one icon was rewritten
 */
export function stripFestivalIconPrefixes(calendars) {
  if (!calendars || typeof calendars !== 'object') return false;
  let changed = false;
  for (const data of Object.values(calendars)) {
    for (const fest of Object.values(data?.festivals ?? {})) {
      if (typeof fest?.icon !== 'string') continue;
      if (fest.icon.startsWith('fas ')) fest.icon = fest.icon.slice(4);
      else if (fest.icon.startsWith('fa-solid ')) fest.icon = fest.icon.slice(9);
      else continue;
      changed = true;
    }
  }
  return changed;
}

/**
 * Strip the legacy Font Awesome prefix from festival icons in stored custom calendars and default overrides.
 * @since 1.4.0
 * @deprecated Remove in 1.6.0
 * @returns {Promise<void>}
 */
async function migrateStoredFestivalIcons() {
  const KEY = 'festivalIconPrefixMigrationComplete';
  if (game.settings.get(MODULE.ID, KEY)) return;
  for (const setting of [SETTINGS.CUSTOM_CALENDARS, SETTINGS.DEFAULT_OVERRIDES]) {
    const stored = game.settings.get(MODULE.ID, setting);
    if (!stripFestivalIconPrefixes(stored)) continue;
    await game.settings.set(MODULE.ID, setting, stored);
    ATLAS.log(3, `Stripped legacy festival icon prefixes from ${setting}`);
  }
  await game.settings.set(MODULE.ID, KEY, true);
}

/**
 * Run all migrations.
 * @returns {Promise<void>}
 */
export async function runAllMigrations() {
  if (!ATLAS.isPrimaryGM) return;
  await migrateIntervalConditionField();
  await migrateStoredFestivalIcons();
}
