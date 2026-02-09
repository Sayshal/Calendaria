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
 * Ensure calendar data has required fields.
 * @param {object} data - Calendar data object to migrate
 * @deprecated since 1.0.0 — Now handled by CalendariaCalendar.migrateData
 */
export function migrateCalendarDataStructure(data) {
  if (!data.seasons) data.seasons = { values: [] };
  if (!data.months) data.months = { values: [] };
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
      const festivals = upd.festivals ? (Array.isArray(upd.festivals) ? upd.festivals : Object.values(upd.festivals)) : [];
      if ((id === 'harptos' || cal.metadata?.id === 'harptos') && festivals.length) {
        for (const f of festivals) {
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
 * Migrate weather zone configuration to ensure all required fields exist.
 * Adds missing seasonOverrides and validates zone structure.
 * @returns {Promise<number>} Number of calendars migrated
 */
async function migrateWeatherZones() {
  const KEY = 'weatherZoneMigrationComplete';
  try {
    if (game.settings.get(MODULE.ID, KEY)) return 0;
  } catch {}
  if (!game.user?.isGM) return 0;

  let migratedCount = 0;

  // Helper to validate and fix a single zone
  const fixZone = (zone) => {
    if (!zone || typeof zone !== 'object') return null;
    const fixed = { ...zone };
    let changed = false;

    // Ensure required fields
    if (!fixed.id || typeof fixed.id !== 'string') return null;
    if (!fixed.name || typeof fixed.name !== 'string') return null;

    // Add missing optional fields with defaults
    if (!fixed.temperatures || typeof fixed.temperatures !== 'object') {
      fixed.temperatures = {};
      changed = true;
    }
    if (!fixed.presets || typeof fixed.presets !== 'object') {
      fixed.presets = Array.isArray(fixed.presets) ? fixed.presets : [];
      changed = true;
    }
    if (!fixed.seasonOverrides || typeof fixed.seasonOverrides !== 'object') {
      fixed.seasonOverrides = {};
      changed = true;
    }

    // Validate presets (array or keyed object)
    const presetsArr = Array.isArray(fixed.presets) ? fixed.presets : Object.values(fixed.presets);
    for (const preset of presetsArr) {
      if (preset.enabled === undefined) preset.enabled = false;
      if (preset.chance === undefined) preset.chance = 0;
    }
    if (Array.isArray(fixed.presets)) fixed.presets = fixed.presets.filter((p) => p && typeof p === 'object' && p.id);

    return changed ? fixed : zone;
  };

  // Helper to migrate weather in a calendar
  const migrateCalendarWeather = (cal) => {
    if (!cal?.weather) return false;
    const zones = cal.weather.zones;
    if (!zones || typeof zones !== 'object') return false;
    const zonesArray = Array.isArray(zones) ? zones : Object.values(zones);
    if (zonesArray.length === 0) return false;

    let modified = false;
    const fixedZones = [];
    for (const zone of zonesArray) {
      const fixed = fixZone(zone);
      if (fixed) {
        fixedZones.push(fixed);
        if (fixed !== zone) modified = true;
      } else {
        modified = true; // Dropped invalid zone
      }
    }

    if (modified) {
      cal.weather.zones = fixedZones;
      // Ensure activeZone still exists
      if (cal.weather.activeZone && !fixedZones.find((z) => z.id === cal.weather.activeZone)) {
        cal.weather.activeZone = fixedZones[0]?.id || null;
      }
    }
    return modified;
  };

  try {
    // Migrate custom calendars
    const customCalendars = game.settings.get(MODULE.ID, 'customCalendars') || {};
    let customModified = false;
    for (const [id, cal] of Object.entries(customCalendars)) {
      if (migrateCalendarWeather(cal)) {
        log(3, `Migrated weather zones in custom calendar: ${id}`);
        customModified = true;
        migratedCount++;
      }
    }
    if (customModified) {
      await game.settings.set(MODULE.ID, 'customCalendars', customCalendars);
    }

    // Migrate default overrides
    const overrides = game.settings.get(MODULE.ID, 'defaultOverrides') || {};
    let overridesModified = false;
    for (const [id, cal] of Object.entries(overrides)) {
      if (migrateCalendarWeather(cal)) {
        log(3, `Migrated weather zones in override: ${id}`);
        overridesModified = true;
        migratedCount++;
      }
    }
    if (overridesModified) {
      await game.settings.set(MODULE.ID, 'defaultOverrides', overrides);
    }

    // Migrate legacy calendars
    const legacy = game.settings.get(MODULE.ID, 'calendars') || {};
    if (legacy.calendars) {
      let legacyModified = false;
      for (const [id, cal] of Object.entries(legacy.calendars)) {
        if (migrateCalendarWeather(cal)) {
          log(3, `Migrated weather zones in legacy calendar: ${id}`);
          legacyModified = true;
          migratedCount++;
        }
      }
      if (legacyModified) {
        await game.settings.set(MODULE.ID, 'calendars', legacy);
      }
    }

    await game.settings.set(MODULE.ID, KEY, true);
    if (migratedCount > 0) {
      log(2, `Weather zone migration complete: ${migratedCount} calendar(s) updated`);
    }
  } catch (e) {
    log(2, 'Weather zone migration failed:', e);
  }

  return migratedCount;
}

/**
 * Diagnose weather configuration - inspects raw settings to find any weather data.
 * Use this if weather zones appear missing after an update.
 * @param {boolean} [showDialog] - Whether to show a dialog with results
 * @returns {object} Diagnostic results
 */
export async function diagnoseWeatherConfig(showDialog = true) {
  const results = [];

  // Helper to get zones array from either array or object format
  const getZonesArray = (zones) => {
    if (!zones || typeof zones !== 'object') return [];
    return Array.isArray(zones) ? zones : Object.values(zones);
  };

  // Check defaultOverrides (customized bundled calendars)
  const overrides = game.settings.get(MODULE.ID, 'defaultOverrides') || {};
  for (const [id, cal] of Object.entries(overrides)) {
    const zones = getZonesArray(cal?.weather?.zones);
    if (zones.length) {
      results.push({
        source: 'defaultOverrides',
        calendarId: id,
        calendarName: cal.name || id,
        zones,
        activeZone: cal.weather.activeZone,
        autoGenerate: cal.weather.autoGenerate
      });
    }
  }

  // Check customCalendars
  const customs = game.settings.get(MODULE.ID, 'customCalendars') || {};
  for (const [id, cal] of Object.entries(customs)) {
    const zones = getZonesArray(cal?.weather?.zones);
    if (zones.length) {
      results.push({
        source: 'customCalendars',
        calendarId: id,
        calendarName: cal.name || id,
        zones,
        activeZone: cal.weather.activeZone,
        autoGenerate: cal.weather.autoGenerate
      });
    }
  }

  // Check legacy calendars setting
  const legacy = game.settings.get(MODULE.ID, 'calendars') || {};
  if (legacy.calendars) {
    for (const [id, cal] of Object.entries(legacy.calendars)) {
      const zones = getZonesArray(cal?.weather?.zones);
      if (zones.length) {
        results.push({
          source: 'calendars (legacy)',
          calendarId: id,
          calendarName: cal.name || id,
          zones,
          activeZone: cal.weather.activeZone,
          autoGenerate: cal.weather.autoGenerate
        });
      }
    }
  }

  // Get active calendar info
  const active = game.time.calendar;
  const activeWeather = active?.weather || null;

  const diagnostic = {
    activeCalendar: active?.name || null,
    activeCalendarId: active?.metadata?.id || null,
    activeWeatherZones: getZonesArray(activeWeather?.zones).length,
    settingsData: results,
    migrationComplete: game.settings.get(MODULE.ID, 'weatherZoneMigrationComplete')
  };

  log(2, 'Weather diagnostic:', diagnostic);
  console.log('Calendaria Weather Diagnostic:', diagnostic);

  if (showDialog) {
    let report = '<h3>Active Calendar</h3>';
    report += `<p><strong>${active?.name || 'None'}</strong></p>`;
    report += `<p>Weather zones loaded: ${getZonesArray(activeWeather?.zones).length}</p>`;

    if (results.length > 0) {
      report += '<h3>Weather Data in Settings</h3>';
      for (const r of results) {
        report += `<div style="border:1px solid #666; padding:8px; margin:4px 0;">`;
        report += `<p><strong>${r.calendarName}</strong> (${r.source})</p>`;
        report += `<p>Zones: ${r.zones.length} | Active: ${r.activeZone || 'none'}</p>`;
        report += '<ul>';
        for (const z of r.zones) {
          report += `<li>${z.name} (${z.id}) - ${z.presets?.length || 0} presets</li>`;
        }
        report += '</ul></div>';
      }
    } else {
      report += '<p style="color:#c66;">No weather configuration found in settings.</p>';
    }

    report += '<p><em>Full data logged to browser console (F12).</em></p>';

    await foundry.applications.api.DialogV2.prompt({
      window: { title: 'Weather Diagnostic', width: 500 },
      content: report,
      ok: { label: 'Close' }
    });
  }

  return diagnostic;
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
  await migrateWeatherZones();
  const changes = await migrateAllTokens();
  if (changes.length) {
    const list = [...new Map(changes.map((c) => [`${c.from}→${c.to}`, c])).values()].map((c) => `${c.from} → ${c.to}`).join(', ');
    log(2, `Auto-migrated deprecated format tokens: ${list}`);
  }
}
