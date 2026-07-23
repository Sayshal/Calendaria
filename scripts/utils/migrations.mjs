import { CONDITION_FIELDS, CONDITION_OPERATORS, MODULE } from '../constants.mjs';

/**
 * Read a legacy Calendaria setting directly from its stored Setting.
 * @param {string} key       Unprefixed setting key
 * @param {string} [userId]  Prefer a user-scoped entry belonging to this user id
 * @returns {*} Parsed value, or undefined when not stored
 */
function readLegacyThemeSetting(key, userId) {
  const fullKey = `${MODULE.ID}.${key}`;
  const world = game.settings.storage.get('world');
  const matches = world?.filter?.((s) => s.key === fullKey) ?? [];
  const doc = (userId && matches.find((s) => s.user === userId)) || matches.find((s) => !s.user) || matches[0];
  if (!doc) return undefined;
  try {
    return typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
  } catch {
    return doc.value;
  }
}

/**
 * Carry this client's Calendaria theme selection into the ATLAS theme system.
 * @since 1.1.0
 * @deprecated Remove in 1.3.0
 * @returns {Promise<void>}
 */
async function migrateThemeToAtlas() {
  const KEY = 'themeAtlasMigrationComplete';
  if (game.settings.get(MODULE.ID, KEY)) return;
  const api = game.modules.get('3ds-atlas')?.api;
  if (!api?.theme) return;
  try {
    const oldThemeMode = readLegacyThemeSetting('themeMode', game.user.id);
    const oldCustomThemes = readLegacyThemeSetting('customThemeColors', game.user.id) || {};
    const oldForced = readLegacyThemeSetting('forceTheme') || null;
    const keyMap = {};
    for (const [oldKey, entry] of Object.entries(oldCustomThemes)) {
      if (!entry || typeof entry !== 'object' || !entry.colors) continue;
      const newKey = await api.theme.createCustomTheme(entry.basePreset || 'dark', entry.name);
      await api.theme.updateCustomTheme(newKey, entry.colors, entry.name);
      keyMap[oldKey] = newKey;
    }
    const resolve = (k) => (k && keyMap[k]) || k;
    if (oldThemeMode && oldThemeMode !== 'dark') await api.theme.setModuleTheme('calendaria', resolve(oldThemeMode));
    if (oldForced && oldForced !== 'none') await api.theme.setForcedTheme('calendaria', resolve(oldForced));
    ATLAS.log(3, 'Migrated Calendaria theme selection into ATLAS');
  } catch (err) {
    ATLAS.log(1, 'Theme ATLAS migration failed:', err);
  }
  await game.settings.set(MODULE.ID, KEY, true);
}

/**
 * Rewrite lone `day % N` interval conditions to the absolute day counter so they space correctly across months.
 * @since 1.1.4
 * @deprecated Remove in 1.3.0
 * @returns {Promise<void>}
 */
async function migrateIntervalConditionField() {
  const KEY = 'intervalConditionFieldMigrationComplete';
  if (!game.user?.isGM) return;
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
 * Run all migrations.
 * @returns {Promise<void>}
 */
export async function runAllMigrations() {
  await migrateThemeToAtlas();
  if (!game.user?.isGM) return;
  await migrateIntervalConditionField();
}
