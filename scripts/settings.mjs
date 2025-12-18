/**
 * Calendaria Module Settings Registration
 * @module Settings
 * @author Tyler
 */

import { MODULE, SETTINGS } from './constants.mjs';
import { log } from './utils/logger.mjs';
import { ResetPositionDialog } from './applications/settings/reset-position.mjs';
import { ThemeEditor } from './applications/settings/theme-editor.mjs';
import { CalendarEditor } from './applications/calendar-editor.mjs';
import { TimeKeeperHUD } from './applications/time-keeper-hud.mjs';
import { ImporterApp } from './applications/importer-app.mjs';
import { MacroTriggerConfig } from './applications/settings/macro-trigger-config.mjs';

/**
 * Register all module settings with Foundry VTT.
 * @returns {void}
 */
export function registerSettings() {
  // ========================================//
  //  Calendar Functionality                 //
  // ========================================//

  /** Saved position for the draggable calendar HUD */
  game.settings.register(MODULE.ID, SETTINGS.CALENDAR_POSITION, {
    name: 'Calendar Position',
    scope: 'user',
    config: false,
    type: Object,
    default: null
  });

  /** Whether the calendar HUD position is locked */
  game.settings.register(MODULE.ID, SETTINGS.POSITION_LOCKED, {
    name: 'Position Locked',
    scope: 'user',
    config: false,
    type: Boolean,
    default: false
  });

  /** Saved position for the compact calendar */
  game.settings.register(MODULE.ID, SETTINGS.COMPACT_CALENDAR_POSITION, {
    name: 'Compact Calendar Position',
    scope: 'client',
    config: false,
    type: Object,
    default: null
  });

  /** Delay before auto-hiding compact calendar controls */
  game.settings.register(MODULE.ID, SETTINGS.COMPACT_CONTROLS_DELAY, {
    name: 'CALENDARIA.Settings.CompactControlsDelay.Name',
    hint: 'CALENDARIA.Settings.CompactControlsDelay.Hint',
    scope: 'client',
    config: true,
    type: Number,
    default: 3,
    range: { min: 1, max: 10, step: 1 }
  });

  /** Sticky states for compact calendar */
  game.settings.register(MODULE.ID, SETTINGS.COMPACT_STICKY_STATES, {
    name: 'Compact Calendar Sticky States',
    scope: 'client',
    config: false,
    type: Object,
    default: { timeControls: false, sidebar: false, position: false }
  });

  /** Default setting for syncing scene darkness with sun position */
  game.settings.register(MODULE.ID, SETTINGS.DARKNESS_SYNC, {
    name: 'CALENDARIA.Settings.DarknessSync.Name',
    hint: 'CALENDARIA.Settings.DarknessSync.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  /** Show moon phases on the calendar UI */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_MOON_PHASES, {
    name: 'CALENDARIA.Settings.ShowMoonPhases.Name',
    hint: 'CALENDARIA.Settings.ShowMoonPhases.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  /** Show TimeKeeper HUD on world load */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER, {
    name: 'CALENDARIA.Settings.ShowTimeKeeper.Name',
    hint: 'CALENDARIA.Settings.ShowTimeKeeper.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
    onChange: (value) => {
      if (value) TimeKeeperHUD.show();
      else TimeKeeperHUD.hide();
    }
  });

  /** Show Compact Calendar on world load */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_COMPACT_CALENDAR, {
    name: 'CALENDARIA.Settings.ShowCompactCalendar.Name',
    hint: 'CALENDARIA.Settings.ShowCompactCalendar.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true
  });

  /** User-customized theme color overrides */
  game.settings.register(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, {
    name: 'Custom Theme Colors',
    scope: 'client',
    config: false,
    type: Object,
    default: {}
  });

  /** Stored calendar configurations and active calendar state */
  game.settings.register(MODULE.ID, SETTINGS.CALENDARS, {
    name: 'Calendar Configurations',
    scope: 'world',
    config: false,
    type: Object,
    default: null
  });

  /** User-created custom calendar definitions */
  game.settings.register(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, {
    name: 'Custom Calendars',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  /** User overrides for default/built-in calendars */
  game.settings.register(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES, {
    name: 'Default Calendar Overrides',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  /** User-created custom note categories */
  game.settings.register(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES, {
    name: 'Custom Categories',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // ========================================//
  //  Time Integration (dnd5e)               //
  // ========================================//

  /** Whether to advance world time during short/long rests */
  game.settings.register(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST, {
    name: 'CALENDARIA.Settings.AdvanceTimeOnRest.Name',
    hint: 'CALENDARIA.Settings.AdvanceTimeOnRest.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  /** Whether to advance world time when combat rounds change */
  game.settings.register(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_COMBAT, {
    name: 'CALENDARIA.Settings.AdvanceTimeOnCombat.Name',
    hint: 'CALENDARIA.Settings.AdvanceTimeOnCombat.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // ========================================//
  //  Sync & Multiplayer                     //
  // ========================================//

  // Primary GM setting registered in registerReadySettings() when users are available

  // ========================================//
  //  Weather System                         //
  // ========================================//

  /** Current weather state */
  game.settings.register(MODULE.ID, SETTINGS.CURRENT_WEATHER, {
    name: 'Current Weather',
    scope: 'world',
    config: false,
    type: Object,
    default: null
  });

  /** Temperature unit (Celsius or Fahrenheit) */
  game.settings.register(MODULE.ID, SETTINGS.TEMPERATURE_UNIT, {
    name: 'CALENDARIA.Settings.TemperatureUnit.Name',
    hint: 'CALENDARIA.Settings.TemperatureUnit.Hint',
    scope: 'world',
    config: true,
    type: new foundry.data.fields.StringField({
      choices: {
        celsius: 'CALENDARIA.Settings.TemperatureUnit.Celsius',
        fahrenheit: 'CALENDARIA.Settings.TemperatureUnit.Fahrenheit'
      },
      initial: 'celsius'
    })
  });

  /** Custom weather presets */
  game.settings.register(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, {
    name: 'Custom Weather Presets',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // ========================================//
  //  Macro Triggers                         //
  // ========================================//

  /** Macro trigger configuration - stores all trigger definitions */
  game.settings.register(MODULE.ID, SETTINGS.MACRO_TRIGGERS, {
    name: 'Macro Triggers',
    scope: 'world',
    config: false,
    type: Object,
    default: {
      global: {
        dawn: '',
        dusk: '',
        midday: '',
        midnight: '',
        newDay: ''
      },
      season: [],
      moonPhase: []
    }
  });

  // ========================================//
  //  Technical                              //
  // ========================================//

  /** Dev mode - allows deletion of calendar note journals */
  game.settings.register(MODULE.ID, SETTINGS.DEV_MODE, {
    name: 'Dev Mode',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  /** Logging level configuration for debug output */
  game.settings.register(MODULE.ID, SETTINGS.LOGGING_LEVEL, {
    name: 'CALENDARIA.Settings.Logger.Name',
    hint: 'CALENDARIA.Settings.Logger.Hint',
    scope: 'client',
    config: true,
    type: new foundry.data.fields.StringField({
      choices: {
        0: 'CALENDARIA.Settings.Logger.Choices.Off',
        1: 'CALENDARIA.Settings.Logger.Choices.Errors',
        2: 'CALENDARIA.Settings.Logger.Choices.Warnings',
        3: 'CALENDARIA.Settings.Logger.Choices.Verbose'
      },
      initial: 2
    }),
    onChange: (value) => {
      MODULE.LOG_LEVEL = parseInt(value);
    }
  });

  /** Settings menu button to open calendar editor */
  game.settings.registerMenu(MODULE.ID, 'calendarEditor', {
    name: 'CALENDARIA.Settings.CalendarEditor.Name',
    hint: 'CALENDARIA.Settings.CalendarEditor.Hint',
    label: 'CALENDARIA.Settings.CalendarEditor.Label',
    icon: 'fas fa-calendar-plus',
    type: CalendarEditor,
    restricted: true
  });

  /** Settings menu button to open theme editor */
  game.settings.registerMenu(MODULE.ID, 'themeEditor', {
    name: 'CALENDARIA.Settings.ThemeEditor.Name',
    hint: 'CALENDARIA.Settings.ThemeEditor.Hint',
    label: 'CALENDARIA.Settings.ThemeEditor.Label',
    icon: 'fas fa-palette',
    type: ThemeEditor,
    restricted: false
  });

  /** Settings menu button to reset calendar position */
  game.settings.registerMenu(MODULE.ID, 'resetPosition', {
    name: 'CALENDARIA.Settings.ResetPosition.Name',
    hint: 'CALENDARIA.Settings.ResetPosition.Hint',
    label: 'CALENDARIA.Settings.ResetPosition.Label',
    icon: 'fas fa-undo',
    type: ResetPositionDialog,
    restricted: false
  });

  /** Settings menu button to open TimeKeeper HUD */
  game.settings.registerMenu(MODULE.ID, 'timeKeeper', {
    name: 'CALENDARIA.Settings.TimeKeeper.Name',
    hint: 'CALENDARIA.Settings.TimeKeeper.Hint',
    label: 'CALENDARIA.Settings.TimeKeeper.Label',
    icon: 'fas fa-clock',
    type: TimeKeeperHUD,
    restricted: true
  });

  /** Settings menu button to open calendar importer */
  game.settings.registerMenu(MODULE.ID, 'importer', {
    name: 'CALENDARIA.Settings.Importer.Name',
    hint: 'CALENDARIA.Settings.Importer.Hint',
    label: 'CALENDARIA.Settings.Importer.Label',
    icon: 'fas fa-file-import',
    type: ImporterApp,
    restricted: true
  });

  /** Settings menu button to open macro trigger config */
  game.settings.registerMenu(MODULE.ID, 'macroTriggers', {
    name: 'CALENDARIA.Settings.MacroTriggers.Name',
    hint: 'CALENDARIA.Settings.MacroTriggers.Hint',
    label: 'CALENDARIA.Settings.MacroTriggers.Label',
    icon: 'fas fa-bolt',
    type: MacroTriggerConfig,
    restricted: true
  });

  log(3, 'Module settings registered.');
}

/**
 * Register settings that require game.users to be available.
 * Called during the ready hook.
 * @returns {void}
 */
export function registerReadySettings() {
  // Build GM user choices dropdown
  const gmChoices = game.users
    .filter((user) => user.isGM)
    .reduce(
      (acc, user) => {
        acc[user.id] = user.name;
        return acc;
      },
      { '': game.i18n.localize('CALENDARIA.Settings.PrimaryGM.Auto') }
    );

  /** Primary GM user ID override for sync operations */
  game.settings.register(MODULE.ID, SETTINGS.PRIMARY_GM, {
    name: 'CALENDARIA.Settings.PrimaryGM.Name',
    hint: 'CALENDARIA.Settings.PrimaryGM.Hint',
    scope: 'world',
    config: true,
    type: String,
    default: '',
    choices: gmChoices
  });

  log(3, 'Ready settings registered.');
}
