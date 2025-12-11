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

  /** Whether the compact calendar is open */
  game.settings.register(MODULE.ID, SETTINGS.COMPACT_CALENDAR_OPEN, {
    name: 'Compact Calendar Open',
    scope: 'client',
    config: false,
    type: Boolean,
    default: false
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
  //  Technical                              //
  // ========================================//

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
