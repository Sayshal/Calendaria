/**
 * Calendaria Module Settings Registration
 * @module Settings
 * @author Tyler
 */

import { CalendarEditor } from './applications/calendar-editor.mjs';
import { CalendariaHUD } from './applications/calendaria-hud.mjs';
import { ImporterApp } from './applications/importer-app.mjs';
import { SettingsPanel } from './applications/settings/settings-panel.mjs';
import { TimeKeeperHUD } from './applications/time-keeper-hud.mjs';
import { BUNDLED_CALENDARS } from './calendar/calendar-loader.mjs';
import { MODULE, SETTINGS } from './constants.mjs';
import { migrateCustomCalendars } from './utils/format-utils.mjs';
import { localize } from './utils/localization.mjs';
import { log } from './utils/logger.mjs';

const { ArrayField, ObjectField, BooleanField, NumberField, StringField } = foundry.data.fields;

/**
 * Convert kebab-case ID to PascalCase for localization keys.
 * @param {string} id - Calendar ID (e.g., 'forbidden-lands')
 * @returns {string} PascalCase key (e.g., 'ForbiddenLands')
 */
function toPascalCase(id) {
  return id.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

/**
 * Build calendar choices for the active calendar dropdown.
 * @returns {Object<string, string>} Map of calendar ID to display name
 */
function buildCalendarChoices() {
  const choices = BUNDLED_CALENDARS.reduce((acc, id) => {
    acc[id] = `CALENDARIA.Calendar.${toPascalCase(id)}.Name`;
    return acc;
  }, {});
  const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
  for (const [id, data] of Object.entries(customCalendars)) choices[id] = data.name || id;
  return choices;
}

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
    type: new ObjectField({ nullable: true, initial: null })
  });

  /** Whether the calendar HUD position is locked */
  game.settings.register(MODULE.ID, SETTINGS.POSITION_LOCKED, {
    name: 'Position Locked',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Saved position for the MiniCalendar */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CALENDAR_POSITION, {
    name: 'MiniCalendar Position',
    scope: 'user',
    config: false,
    type: new ObjectField({ nullable: true, initial: null })
  });

  /** Saved position for the TimeKeeper HUD */
  game.settings.register(MODULE.ID, SETTINGS.TIME_KEEPER_POSITION, {
    name: 'TimeKeeper Position',
    scope: 'user',
    config: false,
    type: new ObjectField({ nullable: true, initial: null })
  });

  /** Delay before auto-hiding MiniCalendar controls */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CALENDAR_CONTROLS_DELAY, {
    name: 'CALENDARIA.Settings.MiniCalendarControlsDelay.Name',
    hint: 'CALENDARIA.Settings.MiniCalendarControlsDelay.Hint',
    scope: 'user',
    config: false,
    type: new NumberField({ min: 1, max: 10, step: 1, integer: true, initial: 3 })
  });

  /** Sticky states for MiniCalendar */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CALENDAR_STICKY_STATES, {
    name: 'MiniCalendar Sticky States',
    scope: 'user',
    config: false,
    type: new ObjectField({ initial: { timeControls: false, sidebar: false, position: false } })
  });

  /** Track if format migration has been run */
  game.settings.register(MODULE.ID, 'formatMigrationComplete', {
    name: 'Format Migration Complete',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });


  /** Default setting for syncing scene darkness with sun position */
  game.settings.register(MODULE.ID, SETTINGS.DARKNESS_SYNC, {
    name: 'CALENDARIA.Settings.DarknessSync.Name',
    hint: 'CALENDARIA.Settings.DarknessSync.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: true })
  });

  /** Show moon phases on the calendar UI */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_MOON_PHASES, {
    name: 'CALENDARIA.Settings.ShowMoonPhases.Name',
    hint: 'CALENDARIA.Settings.ShowMoonPhases.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: true })
  });

  /** Show TimeKeeper HUD on world load */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER, {
    name: 'CALENDARIA.Settings.ShowTimeKeeper.Name',
    hint: 'CALENDARIA.Settings.ShowTimeKeeper.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false }),
    requiresReload: false,
    onChange: (value) => {
      if (value) TimeKeeperHUD.show();
      else TimeKeeperHUD.hide();
    }
  });

  /** Show MiniCalendar on world load */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_MINI_CALENDAR, {
    name: 'CALENDARIA.Settings.ShowMiniCalendar.Name',
    hint: 'CALENDARIA.Settings.ShowMiniCalendar.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true })
  });

  // ========================================//
  //  Calendar HUD                            //
  // ========================================//

  /** Show Calendar HUD on world load */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, {
    name: 'CALENDARIA.Settings.ShowCalendarHUD.Name',
    hint: 'CALENDARIA.Settings.ShowCalendarHUD.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: false }),
    onChange: (value) => {
      if (value) CalendariaHUD.show();
      else CalendariaHUD.hide();
    }
  });

  /** Calendar HUD display mode (fullsize or compact) */
  game.settings.register(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE, {
    name: 'CALENDARIA.Settings.CalendarHUDMode.Name',
    hint: 'CALENDARIA.Settings.CalendarHUDMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({ choices: { fullsize: 'CALENDARIA.Settings.CalendarHUDMode.Fullsize', compact: 'CALENDARIA.Settings.CalendarHUDMode.Compact' }, initial: 'fullsize' }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render()
  });

  /** Calendar HUD position lock */
  game.settings.register(MODULE.ID, SETTINGS.CALENDAR_HUD_LOCKED, {
    name: 'Calendar HUD Locked',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Calendar HUD sticky states */
  game.settings.register(MODULE.ID, SETTINGS.HUD_STICKY_STATES, {
    name: 'Calendar HUD Sticky States',
    scope: 'user',
    config: false,
    type: new ObjectField({ initial: { tray: false, position: false } })
  });

  /** Calendar HUD position */
  game.settings.register(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, {
    name: 'Calendar HUD Position',
    scope: 'user',
    config: false,
    type: new ObjectField({ nullable: true, initial: null })
  });

  /** User-customized theme color overrides */
  game.settings.register(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, {
    name: 'Custom Theme Colors',
    scope: 'user',
    config: false,
    type: new ObjectField({ initial: {} })
  });

  /** Current theme mode (dark, highContrast, custom) */
  game.settings.register(MODULE.ID, SETTINGS.THEME_MODE, {
    name: 'Theme Mode',
    scope: 'user',
    config: false,
    type: new StringField({ initial: 'dark', choices: ['dark', 'highContrast', 'custom'] })
  });

  /** Stored calendar configurations and active calendar state */
  game.settings.register(MODULE.ID, SETTINGS.CALENDARS, {
    name: 'Calendar Configurations',
    scope: 'world',
    config: false,
    type: new ObjectField({ nullable: true, initial: null })
  });

  /** User-created custom calendar definitions */
  game.settings.register(MODULE.ID, SETTINGS.CUSTOM_CALENDARS, {
    name: 'Custom Calendars',
    scope: 'world',
    config: false,
    type: new ObjectField({ initial: {} })
  });

  /** Active calendar ID - which calendar is currently being used */
  game.settings.register(MODULE.ID, SETTINGS.ACTIVE_CALENDAR, {
    name: 'CALENDARIA.Settings.ActiveCalendar.Name',
    hint: 'CALENDARIA.Settings.ActiveCalendar.Hint',
    scope: 'world',
    config: true,
    type: new StringField({ choices: buildCalendarChoices(), initial: 'gregorian', blank: true }),
    requiresReload: true
  });

  /** User overrides for default/built-in calendars */
  game.settings.register(MODULE.ID, SETTINGS.DEFAULT_OVERRIDES, {
    name: 'Default Calendar Overrides',
    scope: 'world',
    config: false,
    type: new ObjectField({ initial: {} })
  });

  /** User-created custom note categories */
  game.settings.register(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES, {
    name: 'Custom Categories',
    scope: 'world',
    config: false,
    type: new ArrayField(new ObjectField())
  });

  // ========================================//
  //  Chat Timestamps                        //
  // ========================================//

  /** Chat timestamp display mode */
  game.settings.register(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE, {
    name: 'CALENDARIA.Settings.ChatTimestampMode.Name',
    hint: 'CALENDARIA.Settings.ChatTimestampMode.Hint',
    scope: 'world',
    config: false,
    type: new StringField({
      choices: {
        disabled: 'CALENDARIA.Settings.ChatTimestampMode.Disabled',
        replace: 'CALENDARIA.Settings.ChatTimestampMode.Replace',
        augment: 'CALENDARIA.Settings.ChatTimestampMode.Augment'
      },
      initial: 'disabled'
    })
  });

  /** Whether to show time in chat timestamps */
  game.settings.register(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_SHOW_TIME, {
    name: 'CALENDARIA.Settings.ChatTimestampShowTime.Name',
    hint: 'CALENDARIA.Settings.ChatTimestampShowTime.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: true })
  });

  // ========================================//
  //  Display Formats                        //
  // ========================================//

  /**
   * Display format configuration for each UI location.
   * Stores format strings or preset names for GM and player views.
   * Structure: { locationId: { gm: formatString, player: formatString } }
   */
  game.settings.register(MODULE.ID, SETTINGS.DISPLAY_FORMATS, {
    name: 'Display Formats',
    scope: 'world',
    config: false,
    type: new ObjectField({
      initial: {
        hudDate: { gm: 'ordinal', player: 'ordinal' },
        hudTime: { gm: 'time', player: 'time' },
        miniCalendarHeader: { gm: 'MMMM [era]', player: 'MMMM [era]' },
        miniCalendarTime: { gm: 'time', player: 'time' },
        fullCalendarHeader: { gm: 'MMMM [era]', player: 'MMMM [era]' },
        chatTimestamp: { gm: 'short', player: 'short' }
      }
    })
  });

  // ========================================//
  //  Time Integration                       //
  // ========================================//

  /** Whether to advance world time during short/long rests */
  game.settings.register(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST, {
    name: 'CALENDARIA.Settings.AdvanceTimeOnRest.Name',
    hint: 'CALENDARIA.Settings.AdvanceTimeOnRest.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Whether to advance world time when combat rounds change */
  game.settings.register(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_COMBAT, {
    name: 'CALENDARIA.Settings.AdvanceTimeOnCombat.Name',
    hint: 'CALENDARIA.Settings.AdvanceTimeOnCombat.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Whether to sync clock pause with game pause */
  game.settings.register(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE, {
    name: 'CALENDARIA.Settings.SyncClockPause.Name',
    hint: 'CALENDARIA.Settings.SyncClockPause.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });

  // ========================================//
  //  Weather System                         //
  // ========================================//

  /** Current weather state */
  game.settings.register(MODULE.ID, SETTINGS.CURRENT_WEATHER, {
    name: 'Current Weather',
    scope: 'world',
    config: false,
    type: new ObjectField({ nullable: true, initial: null })
  });

  /** Temperature unit (Celsius or Fahrenheit) */
  game.settings.register(MODULE.ID, SETTINGS.TEMPERATURE_UNIT, {
    name: 'CALENDARIA.Settings.TemperatureUnit.Name',
    hint: 'CALENDARIA.Settings.TemperatureUnit.Hint',
    scope: 'world',
    config: false,
    type: new StringField({
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
    type: new ArrayField(new ObjectField())
  });

  // ========================================//
  //  Macro Triggers                         //
  // ========================================//

  /** Macro trigger configuration - stores all trigger definitions */
  game.settings.register(MODULE.ID, SETTINGS.MACRO_TRIGGERS, {
    name: 'Macro Triggers',
    scope: 'world',
    config: false,
    type: new ObjectField({ initial: { global: { dawn: '', dusk: '', midday: '', midnight: '', newDay: '' }, season: [], moonPhase: [] } })
  });

  // ========================================//
  //  Technical                              //
  // ========================================//

  /** Dev mode - allows deletion of calendar note journals */
  game.settings.register(MODULE.ID, SETTINGS.DEV_MODE, {
    name: 'Dev Mode',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Logging level configuration for debug output */
  game.settings.register(MODULE.ID, SETTINGS.LOGGING_LEVEL, {
    name: 'CALENDARIA.Settings.Logger.Name',
    hint: 'CALENDARIA.Settings.Logger.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
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

  /** Settings menu button to open unified settings panel */
  game.settings.registerMenu(MODULE.ID, 'settingsPanel', {
    name: 'CALENDARIA.SettingsPanel.Title',
    hint: 'CALENDARIA.SettingsPanel.MenuHint',
    label: 'CALENDARIA.SettingsPanel.Title',
    icon: 'fas fa-cog',
    type: SettingsPanel,
    restricted: false
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

  /** Settings menu button to open calendar importer */
  game.settings.registerMenu(MODULE.ID, 'importer', {
    name: 'CALENDARIA.Settings.Importer.Name',
    hint: 'CALENDARIA.Settings.Importer.Hint',
    label: 'CALENDARIA.Settings.Importer.Label',
    icon: 'fas fa-file-import',
    type: ImporterApp,
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
  /** Primary GM user ID override for sync operations */
  game.settings.register(MODULE.ID, SETTINGS.PRIMARY_GM, {
    name: 'CALENDARIA.Settings.PrimaryGM.Name',
    hint: 'CALENDARIA.Settings.PrimaryGM.Hint',
    scope: 'world',
    config: false,
    type: new StringField({
      choices: game.users
        .filter((user) => user.isGM)
        .reduce(
          (acc, user) => {
            acc[user.id] = user.name;
            return acc;
          },
          { '': localize('CALENDARIA.Settings.PrimaryGM.Auto') }
        ),
      initial: ''
    })
  });

  // Run format migration for custom calendars
  migrateCustomCalendars();
}
