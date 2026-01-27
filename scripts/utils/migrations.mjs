/**
 * Consolidated Migration Utilities
 * @module Utils/Migrations
 */

import { MODULE } from '../constants.mjs';
import { log } from './logger.mjs';

const LEGACY_TOKENS = {
  '{{y}}': 'YY',
  '{{yyyy}}': 'YYYY',
  '{{Y}}': 'YYYY',
  '{{B}}': 'MMMM',
  '{{b}}': 'MMM',
  '{{m}}': 'M',
  '{{mm}}': 'MM',
  '{{d}}': 'D',
  '{{dd}}': 'DD',
  '{{0}}': 'Do',
  '{{j}}': 'DDD',
  '{{w}}': 'd',
  '{{A}}': 'dddd',
  '{{a}}': 'ddd',
  '{{H}}': 'HH',
  '{{h}}': 'h',
  '{{hh}}': 'hh',
  '{{M}}': 'mm',
  '{{S}}': 'ss',
  '{{p}}': 'a',
  '{{P}}': 'A',
  '{{W}}': 'W',
  '{{WW}}': 'WW',
  '{{WN}}': '[namedWeek]',
  '{{Wn}}': '[namedWeekAbbr]',
  '{{ch}}': '[ch]',
  '{{chAbbr}}': '[chAbbr]',
  '{{E}}': 'GGGG',
  '{{e}}': '[yearInEra]',
  '{{season}}': 'QQQQ',
  '{{moon}}': '[moon]',
  '{{era}}': 'GGGG',
  '{{eraYear}}': '[yearInEra]',
  '{{yearInEra}}': '[yearInEra]',
  '{{year}}': 'YYYY',
  '{{abbreviation}}': 'G',
  '{{short}}': 'G'
};

const DEPRECATED = { dddd: 'EEEE', ddd: 'EEE', dd: 'EE', d: 'e', '[era]': 'GGGG', '[eraAbbr]': 'G', '[year]': 'YYYY', '[short]': 'G', '[season]': 'QQQQ', '[seasonAbbr]': 'QQQ' };

const PRESETS = { time: 'time24', date: 'dateLong', datetime: 'datetime24', dateTime: 'datetime24', short: 'dateShort', long: 'dateLong', full: 'dateFull' };

const KEYS = {
  forceMiniCalendar: 'forceMiniCal',
  miniCalendarAutoFade: 'miniCalAutoFade',
  miniCalendarConfirmSetDate: 'miniCalConfirmSetDate',
  miniCalendarControlsDelay: 'miniCalControlsDelay',
  miniCalendarIdleOpacity: 'miniCalIdleOpacity',
  miniCalendarPosition: 'miniCalPosition',
  miniCalendarStickyStates: 'miniCalStickyStates',
  showMiniCalendar: 'showMiniCal'
};

const HARPTOS = [
  'CALENDARIA.Calendar.Harptos.Festival.Midwinter',
  'CALENDARIA.Calendar.Harptos.Festival.Greengrass',
  'CALENDARIA.Calendar.Harptos.Festival.Midsummer',
  'CALENDARIA.Calendar.Harptos.Festival.Shieldmeet',
  'CALENDARIA.Calendar.Harptos.Festival.Highharvestide',
  'CALENDARIA.Calendar.Harptos.Festival.FeastOfTheMoon'
];

/**
 * Check if format uses legacy {{var}} syntax
 * @param {string} str - Format string to check
 * @returns {boolean} True if legacy format
 */
export function isLegacyFormat(str) {
  return /{{[^}]+}}/.test(str);
}

/**
 * Convert legacy {{var}} format to new tokens
 * @param {string} str - Format string to convert
 * @returns {string} Converted format string
 */
export function migrateLegacyFormat(str) {
  let out = str.replace(/{{c\d+}}/g, '[cycle]').replace(/{{(\d+)}}/g, '[$1]');
  for (const [old, neu] of Object.entries(LEGACY_TOKENS)) out = out.replace(new RegExp(old.replace(/[{}]/g, '\\$&'), 'g'), neu);
  return out;
}

/**
 * Replace deprecated tokens in format string
 * @param {string} str - Format string to migrate
 * @returns {{migrated: string, changes: Array}} Migrated string and list of changes
 */
export function migrateDeprecatedTokens(str) {
  if (!str || typeof str !== 'string') return { migrated: str, changes: [] };
  let out = str;
  const changes = [];
  for (const [tok, rep] of Object.entries(DEPRECATED).sort((a, b) => b[0].length - a[0].length)) {
    if (tok.startsWith('[')) {
      if (out.includes(tok)) {
        out = out.split(tok).join(rep);
        changes.push({ from: tok, to: rep });
      }
    } else {
      const re = new RegExp(`(?<![a-zA-Z])${tok}(?![a-zA-Z])`, 'g');
      if (re.test(out)) {
        out = out.replace(re, rep);
        changes.push({ from: tok, to: rep });
      }
    }
  }
  return { migrated: out, changes };
}

/**
 * Ensure calendar data has required fields
 * @param {object} data - Calendar data object to migrate
 */
export function migrateCalendarDataStructure(data) {
  const added = [];
  if (!data.seasons) {
    data.seasons = { values: [] };
    added.push('seasons');
  }
  if (!data.months) {
    data.months = { values: [] };
    added.push('months');
  }
  if (added.length) log(3, `Migrated calendar "${data.name}": added ${added.join(', ')}`);
}

/**
 * Migrate deprecated tokens in calendar data object
 * @param {object} cal - Calendar data object
 * @returns {Array} List of changes made
 */
function migrateCalTokens(cal) {
  const changes = [];
  if (cal?.dateFormats) {
    for (const [k, v] of Object.entries(cal.dateFormats)) {
      if (typeof v === 'string') {
        const { migrated, changes: c } = migrateDeprecatedTokens(v);
        if (c.length) {
          cal.dateFormats[k] = migrated;
          changes.push(...c);
        }
      }
    }
  }
  const eras = Array.isArray(cal?.eras) ? cal.eras : cal?.eras?.values;
  if (eras?.length) {
    for (const era of eras) {
      if (era.template) {
        const { migrated, changes: c } = migrateDeprecatedTokens(era.template);
        if (c.length) {
          era.template = migrated;
          changes.push(...c);
        }
      }
    }
  }
  if (cal?.cycleFormat) {
    const { migrated, changes: c } = migrateDeprecatedTokens(cal.cycleFormat);
    if (c.length) {
      cal.cycleFormat = migrated;
      changes.push(...c);
    }
  }
  return changes;
}

/**
 * Migrate display format deprecated tokens
 * @returns {Promise<Array>} List of changes made
 */
async function migrateDisplayTokens() {
  if (!game.user?.isGM) return [];
  const changes = [];
  try {
    const fmts = game.settings.get(MODULE.ID, 'displayFormats');
    if (!fmts || typeof fmts !== 'object') return [];
    let mod = false;
    for (const loc of Object.values(fmts)) {
      for (const role of ['gm', 'player']) {
        if (loc?.[role]) {
          const { migrated, changes: c } = migrateDeprecatedTokens(loc[role]);
          if (c.length) {
            loc[role] = migrated;
            changes.push(...c);
            mod = true;
          }
        }
      }
    }
    if (mod) {
      await game.settings.set(MODULE.ID, 'displayFormats', fmts);
      log(3, `Migrated display format tokens: ${[...new Set(changes.map((c) => `${c.from}→${c.to}`))].join(', ')}`);
    }
  } catch {}
  return changes;
}

/**
 * Migrate legacy preset names
 * @returns {Promise<Array>} List of changes made
 */
async function migratePresets() {
  if (!game.user?.isGM) return [];
  const changes = [];
  try {
    const fmts = game.settings.get(MODULE.ID, 'displayFormats');
    if (!fmts || typeof fmts !== 'object') return [];
    let mod = false;
    for (const [loc, val] of Object.entries(fmts)) {
      for (const role of ['gm', 'player']) {
        if (val?.[role] && PRESETS[val[role]]) {
          const old = val[role];
          val[role] = PRESETS[old];
          changes.push({ from: old, to: val[role], loc, role });
          mod = true;
        }
      }
    }
    if (mod) {
      await game.settings.set(MODULE.ID, 'displayFormats', fmts);
      log(3, `Migrated presets: ${changes.map((c) => `${c.loc}/${c.role}: ${c.from}→${c.to}`).join(', ')}`);
    }
  } catch {}
  return changes;
}

/**
 * Migrate all deprecated tokens in calendars
 * @returns {Promise<Array>} List of changes made
 */
async function migrateAllTokens() {
  if (!game.user?.isGM) return [];
  const changes = [];
  try {
    const cals = game.settings.get(MODULE.ID, 'customCalendars') || {};
    let mod = false;
    for (const [id, cal] of Object.entries(cals)) {
      const c = migrateCalTokens(cal);
      if (c.length) {
        log(3, `Migrated tokens in "${cal?.metadata?.name || cal?.name || id}"`);
        changes.push(...c);
        mod = true;
      }
    }
    if (mod) await game.settings.set(MODULE.ID, 'customCalendars', cals);
  } catch (e) {
    log(2, 'Token migration failed', e);
  }

  try {
    const ovr = game.settings.get(MODULE.ID, 'defaultOverrides') || {};
    let mod = false;
    for (const [id, cal] of Object.entries(ovr)) {
      const c = migrateCalTokens(cal);
      if (c.length) {
        log(3, `Migrated tokens in override "${cal?.metadata?.name || cal?.name || id}"`);
        changes.push(...c);
        mod = true;
      }
    }
    if (mod) await game.settings.set(MODULE.ID, 'defaultOverrides', ovr);
  } catch (e) {
    log(2, 'Override token migration failed', e);
  }

  changes.push(...(await migrateDisplayTokens()), ...(await migratePresets()));
  return changes;
}

/**
 * Migrate legacy {{var}} format in custom calendars
 * @returns {Promise<void>}
 */
async function migrateLegacyFormats() {
  const KEY = 'formatMigrationComplete';
  if (game.settings.get(MODULE.ID, KEY)) return;
  if (!game.user.isGM) return;

  const cals = game.settings.get(MODULE.ID, 'customCalendars');
  if (!cals || typeof cals !== 'object') {
    await game.settings.set(MODULE.ID, KEY, true);
    return;
  }
  let mod = false;
  const out = {};
  for (const [id, cal] of Object.entries(cals)) {
    const upd = { ...cal };
    if (upd.dateFormats) {
      for (const [k, v] of Object.entries(upd.dateFormats)) {
        if (typeof v === 'string' && isLegacyFormat(v)) {
          upd.dateFormats[k] = migrateLegacyFormat(v);
          mod = true;
        }
      }
    }
    if (upd.eras?.length) {
      for (const era of upd.eras) {
        if (era.template && isLegacyFormat(era.template)) {
          era.template = migrateLegacyFormat(era.template);
          mod = true;
        }
      }
    }
    if (upd.cycleFormat && isLegacyFormat(upd.cycleFormat)) {
      upd.cycleFormat = migrateLegacyFormat(upd.cycleFormat);
      mod = true;
    }
    out[id] = upd;
  }
  if (mod) {
    await game.settings.set(MODULE.ID, 'customCalendars', out);
    log(3, 'Migrated legacy format tokens');
  }
  await game.settings.set(MODULE.ID, KEY, true);
}

/**
 * Migrate Harptos intercalary festivals
 * @returns {Promise<void>}
 */
async function migrateHarptos() {
  const KEY = 'intercalaryMigrationComplete';
  try {
    if (game.settings.get(MODULE.ID, KEY)) return;
  } catch {}
  if (!game.user.isGM) return;
  try {
    const cals = game.settings.get(MODULE.ID, 'customCalendars');
    if (!cals || typeof cals !== 'object') {
      await game.settings.set(MODULE.ID, KEY, true);
      return;
    }
    let mod = false;
    const out = {};
    for (const [id, cal] of Object.entries(cals)) {
      const upd = { ...cal };
      if ((id === 'harptos' || cal.metadata?.id === 'harptos') && upd.festivals?.length) {
        for (const f of upd.festivals) {
          if (HARPTOS.includes(f.name) && f.countsForWeekday === undefined) {
            f.countsForWeekday = false;
            mod = true;
          }
        }
      }
      out[id] = upd;
    }
    if (mod) {
      await game.settings.set(MODULE.ID, 'customCalendars', out);
      log(3, 'Migrated Harptos festivals');
    }
    await game.settings.set(MODULE.ID, KEY, true);
  } catch (e) {
    log(2, 'Harptos migration failed', e);
  }
}

/**
 * Migrate setting keys
 * @returns {Promise<void>}
 */
async function migrateKeys() {
  if (!game.user.isGM) return;
  if (game.settings.get(MODULE.ID, 'settingKeyMigrationComplete')) return;
  let n = 0;
  for (const [old, neu] of Object.entries(KEYS)) {
    const storage = game.settings.storage.get('world');
    const oldS = storage.getSetting(`${MODULE.ID}.${old}`);
    if (oldS && !storage.getSetting(`${MODULE.ID}.${neu}`)) {
      await game.settings.set(MODULE.ID, neu, oldS.value);
      log(2, `Migrated setting: ${old} -> ${neu}`);
      n++;
    }
  }
  if (n) log(2, `Setting migration complete: ${n} migrated`);
  await game.settings.set(MODULE.ID, 'settingKeyMigrationComplete', true);
}

/**
 * Run all migrations
 * @returns {Promise<void>}
 */
export async function runAllMigrations() {
  if (!game.user?.isGM) return;
  await migrateLegacyFormats();
  await migrateHarptos();
  await migrateKeys();
  const changes = await migrateAllTokens();
  if (changes.length) {
    const list = [...new Map(changes.map((c) => [`${c.from}→${c.to}`, c])).values()].map((c) => `${c.from} → ${c.to}`).join(', ');
    log(2, `Auto-migrated deprecated format tokens: ${list}`);
  }
}
