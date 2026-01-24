/**
 * Settings Import/Export utilities.
 * Handles exporting and importing Calendaria world settings.
 * @module Utils/SettingsIO
 */

import { MODULE, SETTINGS } from '../constants.mjs';
import { format, localize } from './localization.mjs';
import { log } from './logger.mjs';

/**
 * List of settings keys to export (world-scoped user settings).
 * Excludes internal/migration flags and position data.
 */
const EXPORTABLE_SETTINGS = [
  SETTINGS.ACTIVE_CALENDAR,
  SETTINGS.ADVANCE_TIME_ON_REST,
  SETTINGS.AMBIENCE_SYNC,
  SETTINGS.CALENDAR_HUD_MODE,
  SETTINGS.CALENDARS,
  SETTINGS.CHAT_TIMESTAMP_MODE,
  SETTINGS.CHAT_TIMESTAMP_SHOW_TIME,
  SETTINGS.CURRENT_WEATHER,
  SETTINGS.CUSTOM_CALENDARS,
  SETTINGS.CUSTOM_CATEGORIES,
  SETTINGS.CUSTOM_THEME_COLORS,
  SETTINGS.CUSTOM_TIME_JUMPS,
  SETTINGS.CUSTOM_WEATHER_PRESETS,
  SETTINGS.DARKNESS_SYNC,
  SETTINGS.DARKNESS_WEATHER_SYNC,
  SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER,
  SETTINGS.DEFAULT_OVERRIDES,
  SETTINGS.DISPLAY_FORMATS,
  SETTINGS.FORCE_HUD,
  SETTINGS.FORCE_MINI_CAL,
  SETTINGS.HUD_AUTO_FADE,
  SETTINGS.HUD_COMBAT_COMPACT,
  SETTINGS.HUD_COMBAT_HIDE,
  SETTINGS.HUD_DIAL_STYLE,
  SETTINGS.HUD_DOME_AUTO_HIDE,
  SETTINGS.HUD_IDLE_OPACITY,
  SETTINGS.HUD_SEASON_DISPLAY_MODE,
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
  SETTINGS.MINI_CAL_IDLE_OPACITY,
  SETTINGS.MINI_CAL_STICKY_STATES,
  SETTINGS.MINI_CAL_TIME_JUMPS,
  SETTINGS.PERMISSIONS,
  SETTINGS.PRIMARY_GM,
  SETTINGS.SHOW_ACTIVE_CALENDAR_TO_PLAYERS,
  SETTINGS.SHOW_CALENDAR_HUD,
  SETTINGS.SHOW_MINI_CAL,
  SETTINGS.SHOW_TIME_KEEPER,
  SETTINGS.SHOW_JOURNAL_FOOTER,
  SETTINGS.SHOW_TOOLBAR_BUTTON,
  SETTINGS.STOPWATCH_AUTO_START_TIME,
  SETTINGS.TOOLBAR_APPS,
  SETTINGS.SYNC_CLOCK_PAUSE,
  SETTINGS.TEMPERATURE_UNIT,
  SETTINGS.THEME_MODE,
  SETTINGS.TIME_SPEED_INCREMENT,
  SETTINGS.TIME_SPEED_MULTIPLIER,
  SETTINGS.TIMEKEEPER_AUTO_FADE,
  SETTINGS.TIMEKEEPER_IDLE_OPACITY,
  SETTINGS.TIMEKEEPER_TIME_JUMPS
];

/**
 * Export all world settings to JSON file.
 */
export async function exportSettings() {
  const exportData = { version: game.modules.get(MODULE.ID)?.version, exportedAt: new Date().toISOString(), settings: {} };
  for (const key of EXPORTABLE_SETTINGS) {
    try {
      exportData.settings[key] = game.settings.get(MODULE.ID, key);
    } catch (error) {
      log(1, 'Error exporting settings:', error);
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
      if (!importData.settings || typeof importData.settings !== 'object') {
        throw new Error('Invalid settings file format');
      }
      const settingsCount = Object.keys(importData.settings).length;
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: localize('CALENDARIA.SettingsPanel.ImportSettings.ConfirmTitle') },
        content: format('CALENDARIA.SettingsPanel.ImportSettings.ConfirmContent', { count: settingsCount, version: importData.version || 'unknown' }),
        yes: { label: localize('CALENDARIA.Common.Import'), icon: 'fas fa-file-import' },
        no: { label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
      });
      if (!confirmed) return;

      let imported = 0;
      for (const [key, value] of Object.entries(importData.settings)) {
        if (EXPORTABLE_SETTINGS.includes(key)) {
          try {
            await game.settings.set(MODULE.ID, key, value);
            imported++;
          } catch (err) {
            log(2, `Failed to import setting ${key}:`, err);
          }
        }
      }
      ui.notifications.info(format('CALENDARIA.SettingsPanel.ImportSettings.Success', { count: imported }));
      if (onComplete) onComplete();
    } catch (error) {
      log(2, 'Settings import failed:', error);
      ui.notifications.error('CALENDARIA.SettingsPanel.ImportSettings.Error', { localize: true });
    }
  });
  input.click();
}
