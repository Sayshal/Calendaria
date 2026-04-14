/**
 * Settings Import/Export utilities.
 * @module Utils/SettingsIO
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { FestivalManager } from '../festivals/_module.mjs';
import { sanitizeNoteData } from '../notes/_module.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { format, localize } from './localization.mjs';
import { log } from './logger.mjs';

/** @type {string[]} List of settings keys to export. */
const EXPORTABLE_SETTINGS = [
  SETTINGS.ACTIVE_CALENDAR,
  SETTINGS.ADVANCE_TIME_ON_REST,
  SETTINGS.ALLOW_SIDEBAR_OVERLAP,
  SETTINGS.AMBIENCE_SYNC,
  SETTINGS.AUTO_GENERATE_WEATHER,
  SETTINGS.BIG_CAL_CYCLES_DISPLAY_MODE,
  SETTINGS.BIG_CAL_ERA_DISPLAY_MODE,
  SETTINGS.BIG_CAL_SEASON_DISPLAY_MODE,
  SETTINGS.BIG_CAL_SHOW_CYCLES,
  SETTINGS.BIG_CAL_SHOW_ERA,
  SETTINGS.BIG_CAL_SHOW_MOON_PHASES,
  SETTINGS.BIG_CAL_SHOW_SEASON,
  SETTINGS.BIG_CAL_SHOW_WEATHER,
  SETTINGS.BIG_CAL_WEATHER_DISPLAY_MODE,
  SETTINGS.CALENDAR_HUD_MODE,
  SETTINGS.CHAT_TIMESTAMP_MODE,
  SETTINGS.CHAT_TIMESTAMP_SHOW_TIME,
  SETTINGS.CINEMATIC_ENABLED,
  SETTINGS.CINEMATIC_EVENT_MAX_CARDS,
  SETTINGS.CINEMATIC_EVENT_WEIGHTING,
  SETTINGS.CINEMATIC_ON_REST,
  SETTINGS.CINEMATIC_SHOW_EVENTS,
  SETTINGS.CINEMATIC_SHOW_MOONS,
  SETTINGS.CINEMATIC_SHOW_WEATHER,
  SETTINGS.CINEMATIC_PANEL_DURATION,
  SETTINGS.CINEMATIC_THRESHOLD,
  SETTINGS.CINEMATIC_THRESHOLD_UNIT,
  SETTINGS.CHRONICLE_BIG_CAL_BUTTON,
  SETTINGS.CHRONICLE_COMBAT_MODE,
  SETTINGS.CHRONICLE_ENTRY_DEPTH,
  SETTINGS.CHRONICLE_HUD_BUTTON,
  SETTINGS.CHRONICLE_MINI_CAL_BUTTON,
  SETTINGS.CHRONICLE_SHOW_EMPTY,
  SETTINGS.CHRONICLE_SHOW_MOON_PHASES,
  SETTINGS.CHRONICLE_SHOW_SEASON_CHANGES,
  SETTINGS.CHRONICLE_SHOW_WEATHER,
  SETTINGS.CHRONICLE_VIEW_MODE,
  SETTINGS.CURRENT_WEATHER,
  SETTINGS.CUSTOM_CALENDARS,
  SETTINGS.CUSTOM_PRESETS,
  SETTINGS.CUSTOM_THEME_COLORS,
  SETTINGS.CUSTOM_TIME_JUMPS,
  SETTINGS.CUSTOM_WEATHER_PRESETS,
  SETTINGS.COLOR_SHIFT_SYNC,
  SETTINGS.DARKNESS_MOON_SYNC,
  SETTINGS.DARKNESS_SYNC,
  SETTINGS.DARKNESS_SYNC_ALL_SCENES,
  SETTINGS.DARKNESS_WEATHER_SYNC,
  SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER,
  SETTINGS.DEFAULT_NOTE_PRESET,
  SETTINGS.DEFAULT_OVERRIDES,
  SETTINGS.DISPLAY_FORMATS,
  SETTINGS.EQUIVALENT_DATE_CALENDARS,
  SETTINGS.FOG_OF_WAR_CONFIG,
  SETTINGS.FOG_OF_WAR_ENABLED,
  SETTINGS.FOG_OF_WAR_NAV_MODE,
  SETTINGS.FOG_OF_WAR_RANGES,
  SETTINGS.FOG_OF_WAR_REVEAL_INTERMEDIATE,
  SETTINGS.FOG_OF_WAR_START_DATE,
  SETTINGS.FORCE_BIG_CAL,
  SETTINGS.FORCE_CHRONICLE,
  SETTINGS.FORCE_HUD,
  SETTINGS.FORCE_MINI_CAL,
  SETTINGS.FORCE_STOPWATCH,
  SETTINGS.FORCE_SUN_DIAL,
  SETTINGS.FORCE_THEME,
  SETTINGS.FORCE_TIME_KEEPER,
  SETTINGS.FORCED_THEME_COLORS,
  SETTINGS.FORECAST_ACCURACY,
  SETTINGS.FORECAST_DAYS,
  SETTINGS.GM_OVERRIDE_CLEARS_FORECAST,
  SETTINGS.HUD_AUTO_FADE,
  SETTINGS.HUD_COMBAT_MODE,
  SETTINGS.HUD_CYCLES_DISPLAY_MODE,
  SETTINGS.HUD_DIAL_STYLE,
  SETTINGS.HUD_DOME_AUTO_HIDE,
  SETTINGS.HUD_DOME_BELOW,
  SETTINGS.HUD_ERA_DISPLAY_MODE,
  SETTINGS.HUD_IDLE_OPACITY,
  SETTINGS.HUD_SEASON_DISPLAY_MODE,
  SETTINGS.HUD_SHOW_CYCLES,
  SETTINGS.HUD_SHOW_ERA,
  SETTINGS.HUD_SHOW_SEASON,
  SETTINGS.HUD_SHOW_WEATHER,
  SETTINGS.HUD_STICKY_STATES,
  SETTINGS.HUD_STICKY_ZONES_ENABLED,
  SETTINGS.HUD_TRAY_DIRECTION,
  SETTINGS.HUD_WEATHER_DISPLAY_MODE,
  SETTINGS.HUD_WIDTH_SCALE,
  SETTINGS.INTRADAY_CARRY_OVER,
  SETTINGS.INTRADAY_WEATHER,
  SETTINGS.MACRO_TRIGGERS,
  SETTINGS.MINI_CAL_AUTO_FADE,
  SETTINGS.MINI_CAL_CONFIRM_SET_DATE,
  SETTINGS.MINI_CAL_CONTROLS_DELAY,
  SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE,
  SETTINGS.MINI_CAL_ERA_DISPLAY_MODE,
  SETTINGS.MINI_CAL_IDLE_OPACITY,
  SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE,
  SETTINGS.MINI_CAL_SHOW_CYCLES,
  SETTINGS.MINI_CAL_SHOW_ERA,
  SETTINGS.MINI_CAL_SHOW_MOON_PHASES,
  SETTINGS.MINI_CAL_SHOW_SEASON,
  SETTINGS.MINI_CAL_SHOW_WEATHER,
  SETTINGS.MINI_CAL_STICKY_STATES,
  SETTINGS.MINI_CAL_TIME_JUMPS,
  SETTINGS.MINI_CAL_WEATHER_DISPLAY_MODE,
  SETTINGS.PERMISSIONS,
  SETTINGS.PRECIPITATION_UNIT,
  SETTINGS.PRIMARY_GM,
  SETTINGS.SAVED_TIMEPOINTS,
  SETTINGS.SHOW_BIG_CAL,
  SETTINGS.SHOW_CALENDAR_HUD,
  SETTINGS.SHOW_MINI_CAL,
  SETTINGS.SHOW_TIME_KEEPER,
  SETTINGS.SHOW_JOURNAL_FOOTER,
  SETTINGS.SHOW_TOOLBAR_BUTTON,
  SETTINGS.STOPWATCH_AUTO_START_TIME,
  SETTINGS.STOPWATCH_STICKY_STATES,
  SETTINGS.SYNC_CLOCK_PAUSE,
  SETTINGS.TEMPERATURE_UNIT,
  SETTINGS.THEME_MODE,
  SETTINGS.TIME_SPEED_INCREMENT,
  SETTINGS.TIME_SPEED_MULTIPLIER,
  SETTINGS.TIMEKEEPER_AUTO_FADE,
  SETTINGS.TIMEKEEPER_IDLE_OPACITY,
  SETTINGS.TIMEKEEPER_STICKY_STATES,
  SETTINGS.TIMEKEEPER_TIME_JUMPS,
  SETTINGS.TOOLBAR_APPS,
  SETTINGS.WEATHER_FORECAST_PLAN,
  SETTINGS.WEATHER_HISTORY,
  SETTINGS.WEATHER_HISTORY_DAYS,
  SETTINGS.WEATHER_INERTIA,
  SETTINGS.WEATHER_PRESET_ALIASES,
  SETTINGS.WEATHER_SOUND_FX,
  SETTINGS.WEATHER_SOUND_VOLUME,
  SETTINGS.WEATHER_VISUAL_OVERRIDES,
  SETTINGS.WIND_SPEED_UNIT
];

/** Settings to skip when exporting with calendar data (to avoid duplicating calendar info). */
const CALENDAR_DATA_SETTINGS = [SETTINGS.CUSTOM_CALENDARS, SETTINGS.DEFAULT_OVERRIDES];

/**
 * Serialize all calendar notes for a given calendar into a portable array.
 * @param {string} calendarId - Calendar ID to export notes for
 * @returns {object[]} Serialized note objects
 */
export function serializeNotes(calendarId) {
  const allNotes = NoteManager.getAllNotes();
  const calendarNotes = (calendarId ? allNotes.filter((n) => n.calendarId === calendarId) : allNotes).filter((n) => !n.flagData?.linkedFestival);
  return calendarNotes.map((stub) => {
    const page = NoteManager.getFullNote(stub.id);
    const systemData = page?.system?.toObject?.() ?? page?.system ?? stub.flagData;
    return {
      id: stub.id,
      name: stub.name,
      content: page?.text?.content ?? stub.content ?? '',
      calendarId: stub.calendarId,
      system: systemData
    };
  });
}

/**
 * Import serialized notes into the world, remapping linked IDs.
 * @param {object[]} notes - Serialized note array from export
 * @param {string} [calendarId] - Override calendar ID for all notes
 * @returns {Promise<number>} Number of notes imported
 */
async function importNotes(notes, calendarId) {
  if (!notes?.length) return 0;
  const idMap = new Map();
  let imported = 0;
  for (const note of notes) {
    if (note.system?.linkedFestival) continue;
    const targetCalendarId = calendarId || note.calendarId;
    const noteData = sanitizeNoteData(note.system || {});
    noteData.macro = null;
    noteData.sceneId = null;
    noteData.playlistId = null;
    noteData.linkedEvent = null;
    noteData.connectedEvents = undefined;
    const page = await NoteManager.createNote({ name: note.name, content: note.content || '', noteData, calendarId: targetCalendarId, openSheet: false });
    if (page) {
      idMap.set(note.id, page.id);
      imported++;
    }
  }
  for (const note of notes) {
    const linked = note.system?.linkedEvent;
    const connected = note.system?.connectedEvents;
    if (!linked?.noteId && !connected?.length) continue;
    const newId = idMap.get(note.id);
    if (!newId) continue;
    const updates = {};
    if (linked?.noteId && idMap.has(linked.noteId)) updates.linkedEvent = { noteId: idMap.get(linked.noteId), offset: linked.offset };
    if (connected?.length) {
      const remapped = connected.map((id) => idMap.get(id)).filter(Boolean);
      if (remapped.length) updates.connectedEvents = remapped;
    }
    if (Object.keys(updates).length) await NoteManager.updateNote(newId, { noteData: updates });
  }
  log(3, `Imported ${imported} calendar notes`);
  return imported;
}

/**
 * Show export dialog and export settings to JSON file.
 */
export async function exportSettings() {
  const activeCalendar = CalendarManager.getActiveCalendar();
  const calendarName = activeCalendar?.name ? localize(activeCalendar.name) : null;
  const calendarId = activeCalendar?.metadata?.id;
  let content = `<p>${localize('CALENDARIA.SettingsPanel.ExportSettings.DialogText')}</p>`;
  if (calendarName) {
    content += `
      <div class="form-group">
        <label for="includeCalendar">${format('CALENDARIA.SettingsPanel.ExportSettings.IncludeCalendar', { name: calendarName })}</label>
        <div class="form-fields">
          <input type="checkbox" id="includeCalendar" name="includeCalendar" checked>
        </div>
      </div>`;
  }
  let dialogElement = null;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: localize('CALENDARIA.Common.ExportSettings') },
    content,
    buttons: [
      { action: 'export', label: localize('CALENDARIA.Common.Export'), icon: 'fas fa-file-export', default: true },
      { action: 'cancel', label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
    ],
    close: () => 'cancel',
    render: (_event, dialog) => {
      dialogElement = dialog.element;
    }
  });
  if (result !== 'export') return;
  const includeCalendar = dialogElement?.querySelector('input[name="includeCalendar"]')?.checked ?? false;
  const exportData = { version: game.modules.get(MODULE.ID)?.version, exportedAt: new Date().toISOString(), settings: {} };
  for (const key of EXPORTABLE_SETTINGS) {
    if (includeCalendar && CALENDAR_DATA_SETTINGS.includes(key)) continue;
    exportData.settings[key] = game.settings.get(MODULE.ID, key);
  }
  if (includeCalendar && activeCalendar) {
    if (calendarId) await FestivalManager.syncFestivalDefinitionsFromNotes(calendarId);
    const refreshedCalendar = (calendarId && CalendarManager.getCalendar(calendarId)) || activeCalendar;
    const calendarData = refreshedCalendar.toObject();
    const currentDate = CalendarManager.getCurrentDateTime();
    calendarData.currentDate = { year: currentDate.year - (refreshedCalendar.yearZero ?? 0), month: currentDate.month, dayOfMonth: currentDate.dayOfMonth };
    exportData.calendarData = calendarData;
    log(3, `Included active calendar data: ${calendarData.name}`);
    if (calendarId) {
      const notes = serializeNotes(calendarId);
      if (notes.length) {
        exportData.notes = notes;
        log(3, `Included ${notes.length} calendar notes`);
      }
    }
  }
  const filename = `calendaria-settings-${Date.now()}.json`;
  foundry.utils.saveDataToFile(JSON.stringify(exportData, null, 2), 'application/json', filename);
  ui.notifications.info('CALENDARIA.SettingsPanel.ExportSettings.Success', { localize: true });
}

/**
 * Import settings from JSON file.
 * @param {Function} [onComplete] - Callback after successful import
 */
export async function importSettings(onComplete) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await foundry.utils.readTextFromFile(file);
      const importData = JSON.parse(text);
      if (!importData.settings || typeof importData.settings !== 'object') throw new Error('Invalid settings file format');
      if (importData.calendarData && !importData.calendarData.name) throw new Error('Calendar data is missing a name');
      const hasCalendarData = !!importData.calendarData?.name;
      const hasNotes = Array.isArray(importData.notes) && importData.notes.length > 0;
      const settingsCount = Object.keys(importData.settings).length;
      const calendarName = importData.calendarData?.name;
      let content = `<p>${format('CALENDARIA.SettingsPanel.ImportSettings.ConfirmContent', { count: settingsCount, version: importData.version || 'unknown' })}</p>`;
      if (hasCalendarData) {
        content += `
          <div class="form-group">
            <label for="importCalendar">${format('CALENDARIA.SettingsPanel.ImportSettings.IncludesCalendar', { name: calendarName })}</label>
            <div class="form-fields">
              <input type="checkbox" id="importCalendar" name="importCalendar" checked>
            </div>
          </div>
          <div class="form-group">
            <label for="setActive">${localize('CALENDARIA.Editor.SetAsActive')}</label>
            <div class="form-fields">
              <input type="checkbox" id="setActive" name="setActive" checked>
            </div>
          </div>`;
      }
      if (hasNotes) {
        content += `
          <div class="form-group">
            <label for="importNotes">${format('CALENDARIA.SettingsPanel.ImportSettings.IncludesNotes', { count: importData.notes.length })}</label>
            <div class="form-fields">
              <input type="checkbox" id="importNotes" name="importNotes" checked>
            </div>
          </div>`;
      }
      let dialogElement = null;
      const result = await foundry.applications.api.DialogV2.wait({
        window: { title: localize('CALENDARIA.Common.ImportSettings') },
        content,
        buttons: [
          { action: 'import', label: localize('CALENDARIA.Common.Import'), icon: 'fas fa-file-import', default: true },
          { action: 'cancel', label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
        ],
        close: () => 'cancel',
        render: (_event, dialog) => {
          dialogElement = dialog.element;
        }
      });
      if (result !== 'import') return;
      const doImportCalendar = dialogElement?.querySelector('input[name="importCalendar"]')?.checked ?? false;
      const setActive = dialogElement?.querySelector('input[name="setActive"]')?.checked ?? false;
      const doImportNotes = dialogElement?.querySelector('input[name="importNotes"]')?.checked ?? false;
      let imported = 0;
      for (const [key, value] of Object.entries(importData.settings)) {
        if (EXPORTABLE_SETTINGS.includes(key)) {
          await game.settings.set(MODULE.ID, key, value);
          imported++;
        }
      }
      ui.notifications.info(format('CALENDARIA.SettingsPanel.ImportSettings.Success', { count: imported }));
      let importedCalendarId = null;
      if (hasCalendarData && doImportCalendar) {
        const calendarData = importData.calendarData;
        if (hasNotes && calendarData.festivals) FestivalManager.applyFestivalDatesToCalendarData(calendarData, importData.notes);
        const calendarId = calendarData.name
          .toLowerCase()
          .replace(/[^\da-z]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 32);
        const calendar = await CalendarManager.createCustomCalendar(calendarId, calendarData);
        if (calendar) {
          importedCalendarId = calendar.metadata?.id || `custom-${calendarId}`;
          ui.notifications.info(format('CALENDARIA.SettingsPanel.ImportSettings.CalendarImported', { name: calendarName }));
          if (setActive) {
            await CalendarManager.switchCalendar(importedCalendarId);
            ui.notifications.info(format('CALENDARIA.SettingsPanel.ImportSettings.CalendarActivated', { name: calendarName }));
          }
        }
      }
      if (hasNotes && doImportNotes) {
        const noteCalendarId = importedCalendarId || CalendarManager.getActiveCalendar()?.metadata?.id;
        const noteCount = await importNotes(importData.notes, noteCalendarId);
        if (noteCount > 0) ui.notifications.info(format('CALENDARIA.SettingsPanel.ImportSettings.NotesImported', { count: noteCount }));
      }
      if (onComplete) onComplete();
    } catch (error) {
      log(1, 'Settings import failed:', error);
      ui.notifications.error('CALENDARIA.SettingsPanel.ImportSettings.Error', { localize: true });
    }
  });
  input.click();
}
