/**
 * Consolidated Migration Utilities
 * @module Utils/Migrations
 */

import { isBundledCalendar } from '../calendar/calendar-loader.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
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
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
 * @param {string} str - Format string to check
 * @returns {boolean} True if legacy format
 */
function isLegacyFormat(str) {
  return /{{[^}]+}}/.test(str);
}

/**
 * Convert legacy {{var}} format to new tokens
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
 * @param {string} str - Format string to convert
 * @returns {string} Converted format string
 */
function migrateLegacyFormat(str) {
  let out = str.replace(/{{c\d+}}/g, '[cycle]').replace(/{{(\d+)}}/g, '[$1]');
  for (const [old, neu] of Object.entries(LEGACY_TOKENS)) out = out.replace(new RegExp(old.replace(/[{}]/g, '\\$&'), 'g'), neu);
  return out;
}

/**
 * Replace deprecated tokens in format string
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
 * @param {string} str - Format string to migrate
 * @returns {{migrated: string, changes: Array}} Migrated string and list of changes
 */
function migrateDeprecatedTokens(str) {
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
 * Migrate deprecated tokens in calendar data object
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
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
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
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
  } catch {
    log(3, 'No display token settings to migrate');
  }
  return changes;
}

/**
 * Migrate legacy preset names
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
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
  } catch {
    log(3, 'No preset settings to migrate');
  }
  return changes;
}

/**
 * Migrate all deprecated tokens in calendars
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
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
    log(1, 'Token migration failed', e);
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
    log(1, 'Override token migration failed', e);
  }
  changes.push(...(await migrateDisplayTokens()), ...(await migratePresets()));
  return changes;
}

/**
 * Migrate legacy {{var}} format in custom calendars
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
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
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
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
    log(1, 'Harptos migration failed', e);
  }
}

/**
 * Migrate setting keys
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
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
      log(3, `Migrated setting: ${old} -> ${neu}`);
      n++;
    }
  }
  if (n) log(3, `Setting migration complete: ${n} migrated`);
  await game.settings.set(MODULE.ID, 'settingKeyMigrationComplete', true);
}

/**
 * Migrate weather zone configuration to ensure all required fields exist.
 * @since 0.10.0
 * @deprecated Remove in 1.1.0
 * @returns {Promise<number>} Number of calendars migrated
 */
async function migrateWeatherZones() {
  const KEY = 'weatherZoneMigrationComplete';
  if (game.settings.get(MODULE.ID, KEY)) return 0;
  if (!game.user?.isGM) return 0;
  let migratedCount = 0;
  const fixZone = (zone) => {
    if (!zone || typeof zone !== 'object') return null;
    const fixed = { ...zone };
    let changed = false;
    if (!fixed.id || typeof fixed.id !== 'string') return null;
    if (!fixed.name || typeof fixed.name !== 'string') return null;
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
    const presetsArr = Array.isArray(fixed.presets) ? fixed.presets : Object.values(fixed.presets);
    for (const preset of presetsArr) {
      if (preset.enabled === undefined) preset.enabled = false;
      if (preset.chance === undefined) preset.chance = 0;
    }
    if (Array.isArray(fixed.presets)) fixed.presets = fixed.presets.filter((p) => p && typeof p === 'object' && p.id);
    return changed ? fixed : zone;
  };
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
        modified = true;
      }
    }
    if (modified) {
      cal.weather.zones = fixedZones;
      if (cal.weather.activeZone && !fixedZones.find((z) => z.id === cal.weather.activeZone)) cal.weather.activeZone = fixedZones[0]?.id || null;
    }
    return modified;
  };
  const customCalendars = game.settings.get(MODULE.ID, 'customCalendars') || {};
  let customModified = false;
  for (const [id, cal] of Object.entries(customCalendars)) {
    if (migrateCalendarWeather(cal)) {
      log(3, `Migrated weather zones in custom calendar: ${id}`);
      customModified = true;
      migratedCount++;
    }
  }
  if (customModified) await game.settings.set(MODULE.ID, 'customCalendars', customCalendars);
  const overrides = game.settings.get(MODULE.ID, 'defaultOverrides') || {};
  let overridesModified = false;
  for (const [id, cal] of Object.entries(overrides)) {
    if (migrateCalendarWeather(cal)) {
      log(3, `Migrated weather zones in override: ${id}`);
      overridesModified = true;
      migratedCount++;
    }
  }
  if (overridesModified) await game.settings.set(MODULE.ID, 'defaultOverrides', overrides);
  await game.settings.set(MODULE.ID, KEY, true);
  if (migratedCount > 0) log(3, `Weather zone migration complete: ${migratedCount} calendar(s) updated`);
  return migratedCount;
}

/**
 * Diagnose weather configuration - inspects raw settings to find any weather data.
 * @param {boolean} [showDialog] - Whether to show a dialog with results
 * @returns {object} Diagnostic results
 */
export async function diagnoseWeatherConfig(showDialog = true) {
  const results = [];
  const getZonesArray = (zones) => {
    if (!zones || typeof zones !== 'object') return [];
    return Array.isArray(zones) ? zones : Object.values(zones);
  };
  const overrides = game.settings.get(MODULE.ID, 'defaultOverrides') || {};
  for (const [id, cal] of Object.entries(overrides)) {
    const zones = getZonesArray(cal?.weather?.zones);
    if (zones.length) results.push({ source: 'defaultOverrides', calendarId: id, calendarName: cal.name || id, zones, activeZone: cal.weather.activeZone, autoGenerate: cal.weather.autoGenerate });
  }
  const customs = game.settings.get(MODULE.ID, 'customCalendars') || {};
  for (const [id, cal] of Object.entries(customs)) {
    const zones = getZonesArray(cal?.weather?.zones);
    if (zones.length) results.push({ source: 'customCalendars', calendarId: id, calendarName: cal.name || id, zones, activeZone: cal.weather.activeZone, autoGenerate: cal.weather.autoGenerate });
  }
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
        for (const z of r.zones) report += `<li>${z.name} (${z.id}) - ${z.presets?.length || 0} presets</li>`;
        report += '</ul></div>';
      }
    } else {
      report += '<p style="color:#c66;">No weather configuration found in settings.</p>';
    }
    report += '<p><em>Full data logged to browser console (F12).</em></p>';
    await foundry.applications.api.DialogV2.prompt({ window: { title: 'Weather Diagnostic', width: 500 }, content: report, ok: { label: 'Close' } });
  }
  return diagnostic;
}

/**
 * Migrate legacy SETTINGS.CALENDARS data to customCalendars, then clear the legacy setting.
 * @since 0.10.0
 * @deprecated Remove in 1.1.0 — all legacy data will have been migrated by then.
 * @returns {Promise<void>}
 */
async function migrateLegacyCalendars() {
  const KEY = 'legacyCalendarMigrationComplete';
  if (game.settings.get(MODULE.ID, KEY)) return;
  if (!game.user?.isGM) return;
  const legacyData = game.settings.get(MODULE.ID, SETTINGS.CALENDARS);
  if (!legacyData?.calendars || Object.keys(legacyData.calendars).length === 0) {
    await game.settings.set(MODULE.ID, KEY, true);
    return;
  }
  const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
  let migrated = 0;
  for (const [id, calendarData] of Object.entries(legacyData.calendars)) {
    if (isBundledCalendar(id)) continue;
    if (customCalendars[id]) continue;
    calendarData.metadata = calendarData.metadata || {};
    calendarData.metadata.isCustom = true;
    customCalendars[id] = calendarData;
    migrated++;
  }
  if (migrated > 0) {
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, customCalendars);
    log(3, `Migrated ${migrated} legacy calendar(s) to customCalendars`);
  }
  await game.settings.set(MODULE.ID, SETTINGS.CALENDARS, null);
  await game.settings.set(MODULE.ID, KEY, true);
  log(3, 'Legacy calendar migration complete');
}

/**
 * Migrate date fields from 1-indexed day/month to 0-indexed dayOfMonth/month.
 * @since 0.10.4
 * @deprecated Remove in 1.1.0
 * @returns {Promise<void>}
 */
async function migrateDateIndexing() {
  const KEY = 'dateIndexingMigrationComplete';
  if (game.settings.get(MODULE.ID, KEY)) return;
  if (!game.user?.isGM) return;

  const migrateCalendarDates = (cal) => {
    let modified = false;
    // Festivals
    if (cal.festivals) {
      const festivals = Array.isArray(cal.festivals) ? cal.festivals : Object.values(cal.festivals);
      for (const f of festivals) {
        if ('day' in f && !('dayOfMonth' in f)) {
          f.dayOfMonth = (f.day ?? 1) - 1;
          delete f.day;
          if (f.month != null && f.month >= 1) f.month -= 1;
          if (f.dayOfYear != null && f.dayOfYear >= 1) f.dayOfYear -= 1;
          modified = true;
        }
      }
    }
    // Seasons — only migrate if festivals were old format (co-stored in same era)
    if (modified && cal.seasons?.values) {
      const seasons = Array.isArray(cal.seasons.values) ? cal.seasons.values : Object.values(cal.seasons.values);
      for (const s of seasons) {
        if (s.monthStart != null && s.monthStart >= 1) s.monthStart -= 1;
        if (s.monthEnd != null && s.monthEnd >= 1) s.monthEnd -= 1;
      }
    }
    // Moons
    if (cal.moons) {
      const moons = Array.isArray(cal.moons) ? cal.moons : Object.values(cal.moons);
      for (const m of moons) {
        if (m.referenceDate && 'day' in m.referenceDate && !('dayOfMonth' in m.referenceDate)) {
          m.referenceDate.dayOfMonth = (m.referenceDate.day ?? 1) - 1;
          delete m.referenceDate.day;
          modified = true;
        }
      }
    }
    return modified;
  };

  // 1. Migrate customCalendars
  const custom = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
  let customModified = false;
  for (const cal of Object.values(custom)) {
    if (migrateCalendarDates(cal)) customModified = true;
  }
  if (customModified) await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, custom);

  // 2. Migrate defaultOverrides
  const overrides = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES) || {};
  let overridesModified = false;
  for (const cal of Object.values(overrides)) {
    if (migrateCalendarDates(cal)) overridesModified = true;
  }
  if (overridesModified) await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES, overrides);

  // 3. Migrate note journal pages
  for (const journal of game.journal) {
    for (const page of journal.pages) {
      if (page.type !== 'calendaria.calendarnote') continue;
      const data = page.system;
      if (!data) continue;
      const updates = {};
      for (const field of ['startDate', 'endDate', 'repeatEndDate']) {
        if (data[field]?.day != null && data[field]?.dayOfMonth == null) {
          updates[`system.${field}.dayOfMonth`] = (data[field].day ?? 1) - 1;
          updates[`system.${field}.-=day`] = null;
        }
      }
      if (data.rangePattern?.day != null && data.rangePattern?.dayOfMonth == null) {
        updates['system.rangePattern.dayOfMonth'] = data.rangePattern.day;
        updates['system.rangePattern.-=day'] = null;
      }
      if (Object.keys(updates).length) await page.update(updates);
    }
  }

  await game.settings.set(MODULE.ID, KEY, true);
  log(3, 'Date indexing migration complete');
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
  await migrateLegacyCalendars();
  await migrateDateIndexing();
  const changes = await migrateAllTokens();
  if (changes.length) {
    const list = [...new Map(changes.map((c) => [`${c.from}→${c.to}`, c])).values()].map((c) => `${c.from} → ${c.to}`).join(', ');
    log(3, `Auto-migrated deprecated format tokens: ${list}`);
  }
}
