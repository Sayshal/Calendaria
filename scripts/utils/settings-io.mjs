/**
 * Settings Import/Export utilities.
 * @module Utils/SettingsIO
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { format, localize } from './localization.mjs';
import { log } from './logger.mjs';

/**
 * List of settings keys to export.
 */
const EXPORTABLE_SETTINGS = [
  SETTINGS.ACTIVE_CALENDAR,
  SETTINGS.ADVANCE_TIME_ON_REST,
  SETTINGS.ALLOW_SIDEBAR_OVERLAP,
  SETTINGS.AMBIENCE_SYNC,
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
  SETTINGS.CURRENT_WEATHER,
  SETTINGS.CUSTOM_CALENDARS,
  SETTINGS.CUSTOM_CATEGORIES,
  SETTINGS.CUSTOM_THEME_COLORS,
  SETTINGS.CUSTOM_TIME_JUMPS,
  SETTINGS.CUSTOM_WEATHER_PRESETS,
  SETTINGS.COLOR_SHIFT_SYNC,
  SETTINGS.DARKNESS_MOON_SYNC,
  SETTINGS.DARKNESS_SYNC,
  SETTINGS.DARKNESS_WEATHER_SYNC,
  SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER,
  SETTINGS.DEFAULT_OVERRIDES,
  SETTINGS.DISPLAY_FORMATS,
  SETTINGS.FORCE_BIG_CAL,
  SETTINGS.FORCE_HUD,
  SETTINGS.FORCE_MINI_CAL,
  SETTINGS.FORCE_STOPWATCH,
  SETTINGS.FORCE_SUN_DIAL,
  SETTINGS.FORCE_TIME_KEEPER,
  SETTINGS.HUD_AUTO_FADE,
  SETTINGS.HUD_COMBAT_COMPACT,
  SETTINGS.HUD_COMBAT_HIDE,
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
  SETTINGS.PRIMARY_GM,
  SETTINGS.SAVED_TIMEPOINTS,
  SETTINGS.SHOW_ACTIVE_CALENDAR_TO_PLAYERS,
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
  SETTINGS.TOOLBAR_APPS
];

/** Settings to skip when exporting with calendar data (to avoid duplicating calendar info). */
const CALENDAR_DATA_SETTINGS = [SETTINGS.CUSTOM_CALENDARS, SETTINGS.DEFAULT_OVERRIDES];

/**
 * Show export dialog and export settings to JSON file.
 */
export async function exportSettings() {
  const activeCalendar = CalendarManager.getActiveCalendar();
  const calendarName = activeCalendar?.name ? localize(activeCalendar.name) : null;
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
    window: { title: localize('CALENDARIA.SettingsPanel.ExportSettings.DialogTitle') },
    content,
    buttons: [
      { action: 'export', label: localize('CALENDARIA.SettingsPanel.ExportSettings.Label'), icon: 'fas fa-file-export', default: true },
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
    const calendarData = activeCalendar.toObject();
    const currentDate = CalendarManager.getCurrentDateTime();
    calendarData.currentDate = { year: currentDate.year - (activeCalendar.yearZero ?? 0), month: currentDate.month, dayOfMonth: currentDate.dayOfMonth };
    exportData.calendarData = calendarData;
    log(3, `Included active calendar data: ${calendarData.name}`);
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
      if (!importData.settings || typeof importData.settings !== 'object') {
        throw new Error('Invalid settings file format');
      }
      const hasCalendarData = !!importData.calendarData?.name;
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
            <label for="setActive">${localize('CALENDARIA.SettingsPanel.ImportSettings.SetActive')}</label>
            <div class="form-fields">
              <input type="checkbox" id="setActive" name="setActive" checked>
            </div>
          </div>`;
      }
      let dialogElement = null;
      const result = await foundry.applications.api.DialogV2.wait({
        window: { title: localize('CALENDARIA.SettingsPanel.ImportSettings.ConfirmTitle') },
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
      const importCalendar = dialogElement?.querySelector('input[name="importCalendar"]')?.checked ?? false;
      const setActive = dialogElement?.querySelector('input[name="setActive"]')?.checked ?? false;
      let imported = 0;
      for (const [key, value] of Object.entries(importData.settings)) {
        if (EXPORTABLE_SETTINGS.includes(key)) {
          await game.settings.set(MODULE.ID, key, value);
          imported++;
        }
      }
      ui.notifications.info(format('CALENDARIA.SettingsPanel.ImportSettings.Success', { count: imported }));
      if (hasCalendarData && importCalendar) {
        const calendarData = importData.calendarData;
        const calendarId = calendarData.name
          .toLowerCase()
          .replace(/[^\da-z]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 32);
        const calendar = await CalendarManager.createCustomCalendar(calendarId, calendarData);
        if (calendar) {
          const fullCalendarId = `custom-${calendarId}`;
          ui.notifications.info(format('CALENDARIA.SettingsPanel.ImportSettings.CalendarImported', { name: calendarName }));
          if (setActive) {
            await CalendarManager.switchCalendar(fullCalendarId);
            ui.notifications.info(format('CALENDARIA.SettingsPanel.ImportSettings.CalendarActivated', { name: calendarName }));
          }
        }
      }
      if (onComplete) onComplete();
    } catch (error) {
      log(1, 'Settings import failed:', error);
      ui.notifications.error('CALENDARIA.SettingsPanel.ImportSettings.Error', { localize: true });
    }
  });
  input.click();
}
