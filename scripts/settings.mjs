/**
 * Calendaria Module Settings Registration
 * @module Settings
 * @author Tyler
 */

import { CalendarEditor } from './applications/calendar-editor.mjs';
import { HUD } from './applications/hud.mjs';
import { ImporterApp } from './applications/importer-app.mjs';
import { MiniCal } from './applications/mini-cal.mjs';
import { SettingsPanel } from './applications/settings/settings-panel.mjs';
import { TimeKeeper } from './applications/time-keeper.mjs';
import { MODULE, SETTINGS } from './constants.mjs';
import NoteManager from './notes/note-manager.mjs';
import { localize } from './utils/localization.mjs';
import { log } from './utils/logger.mjs';
import * as StickyZones from './utils/sticky-zones.mjs';

const { ArrayField, ObjectField, BooleanField, NumberField, SetField, StringField } = foundry.data.fields;

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

  /** Saved position for the MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_POSITION, {
    name: 'MiniCal Position',
    scope: 'user',
    config: false,
    type: new ObjectField({ nullable: true, initial: null })
  });

  /** Saved position for the TimeKeeper */
  game.settings.register(MODULE.ID, SETTINGS.TIME_KEEPER_POSITION, {
    name: 'TimeKeeper Position',
    scope: 'user',
    config: false,
    type: new ObjectField({ nullable: true, initial: null })
  });

  /** Saved position for the Stopwatch */
  game.settings.register(MODULE.ID, SETTINGS.STOPWATCH_POSITION, {
    name: 'Stopwatch Position',
    scope: 'user',
    config: false,
    type: new ObjectField({ nullable: true, initial: null })
  });

  /** Saved state for the Stopwatch (running, elapsed time, etc.) */
  game.settings.register(MODULE.ID, SETTINGS.STOPWATCH_STATE, {
    name: 'Stopwatch State',
    scope: 'client',
    config: false,
    type: new ObjectField({ nullable: true, initial: null })
  });

  /** Stopwatch auto-start game time */
  game.settings.register(MODULE.ID, SETTINGS.STOPWATCH_AUTO_START_TIME, {
    name: 'CALENDARIA.Settings.StopwatchAutoStartTime.Name',
    hint: 'CALENDARIA.Settings.StopwatchAutoStartTime.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Sticky states for Stopwatch */
  game.settings.register(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES, {
    name: 'Stopwatch Sticky States',
    scope: 'user',
    config: false,
    type: new ObjectField({ initial: { position: false } })
  });

  /** MiniCal auto-fade on idle */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_AUTO_FADE, {
    name: 'CALENDARIA.Settings.AutoFade.Name',
    hint: 'CALENDARIA.Settings.AutoFade.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: false }),
    onChange: () => MiniCal.updateIdleOpacity()
  });

  /** MiniCal idle opacity (0-100) */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_IDLE_OPACITY, {
    name: 'CALENDARIA.Settings.IdleOpacity.Name',
    hint: 'CALENDARIA.Settings.IdleOpacity.Hint',
    scope: 'user',
    config: false,
    type: new NumberField({ initial: 40, min: 0, max: 100, integer: true }),
    onChange: () => MiniCal.updateIdleOpacity()
  });

  /** Delay before auto-hiding MiniCal controls */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_CONTROLS_DELAY, {
    name: 'CALENDARIA.Settings.MiniCalControlsDelay.Name',
    hint: 'CALENDARIA.Settings.MiniCalControlsDelay.Hint',
    scope: 'user',
    config: false,
    type: new NumberField({ min: 1, max: 10, step: 1, integer: true, initial: 3 })
  });

  /** Sticky states for MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_STICKY_STATES, {
    name: 'MiniCal Sticky States',
    scope: 'user',
    config: false,
    type: new ObjectField({ initial: { timeControls: false, sidebar: false, position: false } })
  });

  /** Confirm before setting current date in MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_CONFIRM_SET_DATE, {
    name: 'CALENDARIA.Settings.ConfirmSetDate.Name',
    hint: 'CALENDARIA.Settings.ConfirmSetDate.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true })
  });

  // ========================================//
  //  MiniCal Block Visibility               //
  // ========================================//

  /** Show weather on MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_SHOW_WEATHER, {
    name: 'CALENDARIA.Settings.MiniCalShowWeather.Name',
    hint: 'CALENDARIA.Settings.MiniCalShowWeather.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('mini-cal')?.render()
  });

  /** Weather display mode on MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_WEATHER_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.MiniCalWeatherDisplayMode.Name',
    hint: 'CALENDARIA.Settings.MiniCalWeatherDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        full: 'CALENDARIA.Settings.HUDWeatherDisplayMode.Full',
        iconTemp: 'CALENDARIA.Settings.HUDWeatherDisplayMode.IconTemp',
        icon: 'CALENDARIA.Settings.HUDWeatherDisplayMode.IconOnly',
        temp: 'CALENDARIA.Settings.HUDWeatherDisplayMode.TempOnly'
      },
      initial: 'full'
    }),
    onChange: () => foundry.applications.instances.get('mini-cal')?.render()
  });

  /** Show season on MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_SHOW_SEASON, {
    name: 'CALENDARIA.Settings.MiniCalShowSeason.Name',
    hint: 'CALENDARIA.Settings.MiniCalShowSeason.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('mini-cal')?.render()
  });

  /** Season display mode on MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.MiniCalSeasonDisplayMode.Name',
    hint: 'CALENDARIA.Settings.MiniCalSeasonDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        full: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Full',
        icon: 'CALENDARIA.Settings.HUDSeasonDisplayMode.IconOnly',
        text: 'CALENDARIA.Settings.HUDSeasonDisplayMode.TextOnly'
      },
      initial: 'full'
    }),
    onChange: () => foundry.applications.instances.get('mini-cal')?.render()
  });

  /** Show era on MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_SHOW_ERA, {
    name: 'CALENDARIA.Settings.MiniCalShowEra.Name',
    hint: 'CALENDARIA.Settings.MiniCalShowEra.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('mini-cal')?.render()
  });

  /** Era display mode on MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_ERA_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.MiniCalEraDisplayMode.Name',
    hint: 'CALENDARIA.Settings.MiniCalEraDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        full: 'CALENDARIA.Settings.HUDEraDisplayMode.Full',
        icon: 'CALENDARIA.Settings.HUDEraDisplayMode.IconOnly',
        text: 'CALENDARIA.Settings.HUDEraDisplayMode.TextOnly',
        abbr: 'CALENDARIA.Settings.HUDEraDisplayMode.Abbreviation'
      },
      initial: 'full'
    }),
    onChange: () => foundry.applications.instances.get('mini-cal')?.render()
  });

  /** Show cycles on MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_SHOW_CYCLES, {
    name: 'CALENDARIA.Settings.MiniCalShowCycles.Name',
    hint: 'CALENDARIA.Settings.MiniCalShowCycles.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('mini-cal')?.render()
  });

  /** Cycles display mode on MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.MiniCalCyclesDisplayMode.Name',
    hint: 'CALENDARIA.Settings.MiniCalCyclesDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        name: 'CALENDARIA.Settings.HUDCyclesDisplayMode.NameOption',
        icon: 'CALENDARIA.Settings.HUDCyclesDisplayMode.IconOnly',
        number: 'CALENDARIA.Settings.HUDCyclesDisplayMode.Number',
        roman: 'CALENDARIA.Settings.HUDCyclesDisplayMode.Roman'
      },
      initial: 'icon'
    }),
    onChange: () => foundry.applications.instances.get('mini-cal')?.render()
  });

  /** Show moon phases on MiniCal */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_SHOW_MOON_PHASES, {
    name: 'CALENDARIA.Settings.MiniCalShowMoonPhases.Name',
    hint: 'CALENDARIA.Settings.MiniCalShowMoonPhases.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('mini-cal')?.render()
  });

  /** Show selected date in MiniCal header instead of viewed date */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_HEADER_SHOW_SELECTED, {
    name: 'CALENDARIA.Settings.MiniCalHeaderShowSelected.Name',
    hint: 'CALENDARIA.Settings.MiniCalHeaderShowSelected.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: false }),
    onChange: () => foundry.applications.instances.get('mini-cal')?.render()
  });

  // ========================================//
  //  BigCal Block Visibility                //
  // ========================================//

  /** Show weather on BigCal */
  game.settings.register(MODULE.ID, SETTINGS.BIG_CAL_SHOW_WEATHER, {
    name: 'CALENDARIA.Settings.BigCalShowWeather.Name',
    hint: 'CALENDARIA.Settings.BigCalShowWeather.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('calendaria')?.render()
  });

  /** Weather display mode on BigCal */
  game.settings.register(MODULE.ID, SETTINGS.BIG_CAL_WEATHER_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.BigCalWeatherDisplayMode.Name',
    hint: 'CALENDARIA.Settings.BigCalWeatherDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        full: 'CALENDARIA.Settings.HUDWeatherDisplayMode.Full',
        iconTemp: 'CALENDARIA.Settings.HUDWeatherDisplayMode.IconTemp',
        icon: 'CALENDARIA.Settings.HUDWeatherDisplayMode.IconOnly',
        temp: 'CALENDARIA.Settings.HUDWeatherDisplayMode.TempOnly'
      },
      initial: 'full'
    }),
    onChange: () => foundry.applications.instances.get('calendaria')?.render()
  });

  /** Show season on BigCal */
  game.settings.register(MODULE.ID, SETTINGS.BIG_CAL_SHOW_SEASON, {
    name: 'CALENDARIA.Settings.BigCalShowSeason.Name',
    hint: 'CALENDARIA.Settings.BigCalShowSeason.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('calendaria')?.render()
  });

  /** Season display mode on BigCal */
  game.settings.register(MODULE.ID, SETTINGS.BIG_CAL_SEASON_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.BigCalSeasonDisplayMode.Name',
    hint: 'CALENDARIA.Settings.BigCalSeasonDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        full: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Full',
        icon: 'CALENDARIA.Settings.HUDSeasonDisplayMode.IconOnly',
        text: 'CALENDARIA.Settings.HUDSeasonDisplayMode.TextOnly'
      },
      initial: 'full'
    }),
    onChange: () => foundry.applications.instances.get('calendaria')?.render()
  });

  /** Show era on BigCal */
  game.settings.register(MODULE.ID, SETTINGS.BIG_CAL_SHOW_ERA, {
    name: 'CALENDARIA.Settings.BigCalShowEra.Name',
    hint: 'CALENDARIA.Settings.BigCalShowEra.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('calendaria')?.render()
  });

  /** Era display mode on BigCal */
  game.settings.register(MODULE.ID, SETTINGS.BIG_CAL_ERA_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.BigCalEraDisplayMode.Name',
    hint: 'CALENDARIA.Settings.BigCalEraDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        full: 'CALENDARIA.Settings.HUDEraDisplayMode.Full',
        icon: 'CALENDARIA.Settings.HUDEraDisplayMode.IconOnly',
        text: 'CALENDARIA.Settings.HUDEraDisplayMode.TextOnly',
        abbr: 'CALENDARIA.Settings.HUDEraDisplayMode.Abbreviation'
      },
      initial: 'full'
    }),
    onChange: () => foundry.applications.instances.get('calendaria')?.render()
  });

  /** Show cycles on BigCal */
  game.settings.register(MODULE.ID, SETTINGS.BIG_CAL_SHOW_CYCLES, {
    name: 'CALENDARIA.Settings.BigCalShowCycles.Name',
    hint: 'CALENDARIA.Settings.BigCalShowCycles.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('calendaria')?.render()
  });

  /** Cycles display mode on BigCal */
  game.settings.register(MODULE.ID, SETTINGS.BIG_CAL_CYCLES_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.BigCalCyclesDisplayMode.Name',
    hint: 'CALENDARIA.Settings.BigCalCyclesDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        name: 'CALENDARIA.Settings.HUDCyclesDisplayMode.NameOption',
        icon: 'CALENDARIA.Settings.HUDCyclesDisplayMode.IconOnly',
        number: 'CALENDARIA.Settings.HUDCyclesDisplayMode.Number',
        roman: 'CALENDARIA.Settings.HUDCyclesDisplayMode.Roman'
      },
      initial: 'icon'
    }),
    onChange: () => foundry.applications.instances.get('calendaria')?.render()
  });

  /** Show moon phases on BigCal */
  game.settings.register(MODULE.ID, SETTINGS.BIG_CAL_SHOW_MOON_PHASES, {
    name: 'CALENDARIA.Settings.BigCalShowMoonPhases.Name',
    hint: 'CALENDARIA.Settings.BigCalShowMoonPhases.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('calendaria')?.render()
  });

  /** Show selected date in BigCal header instead of viewed date */
  game.settings.register(MODULE.ID, SETTINGS.BIG_CAL_HEADER_SHOW_SELECTED, {
    name: 'CALENDARIA.Settings.BigCalHeaderShowSelected.Name',
    hint: 'CALENDARIA.Settings.BigCalHeaderShowSelected.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: false }),
    onChange: () => foundry.applications.instances.get('calendaria')?.render()
  });

  /** Track if format migration has been run */
  game.settings.register(MODULE.ID, 'formatMigrationComplete', {
    name: 'Format Migration Complete',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Track if intercalary weekday migration has been run */
  game.settings.register(MODULE.ID, 'settingKeyMigrationComplete', {
    name: 'Setting Key Migration Complete',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });

  game.settings.register(MODULE.ID, 'intercalaryMigrationComplete', {
    name: 'Intercalary Migration Complete',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });

  game.settings.register(MODULE.ID, 'weatherZoneMigrationComplete', {
    name: 'Weather Zone Migration Complete',
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

  /** Sync darkness across all scenes, not just the active one */
  game.settings.register(MODULE.ID, SETTINGS.DARKNESS_SYNC_ALL_SCENES, {
    name: 'CALENDARIA.Settings.DarknessSyncAllScenes.Name',
    hint: 'CALENDARIA.Settings.DarknessSyncAllScenes.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Allow weather to affect scene darkness (via darknessPenalty) */
  game.settings.register(MODULE.ID, SETTINGS.DARKNESS_WEATHER_SYNC, {
    name: 'CALENDARIA.Settings.DarknessWeatherSync.Name',
    hint: 'CALENDARIA.Settings.DarknessWeatherSync.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: true })
  });

  /** Sync scene ambience (hue/saturation) with weather and climate */
  game.settings.register(MODULE.ID, SETTINGS.AMBIENCE_SYNC, {
    name: 'CALENDARIA.Settings.AmbienceSync.Name',
    hint: 'CALENDARIA.Settings.AmbienceSync.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: true })
  });

  /** Allow Calendaria windows to overlap sidebar area */
  game.settings.register(MODULE.ID, SETTINGS.ALLOW_SIDEBAR_OVERLAP, {
    name: 'CALENDARIA.Settings.AllowSidebarOverlap.Name',
    hint: 'CALENDARIA.Settings.AllowSidebarOverlap.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Default brightness multiplier for all scenes */
  game.settings.register(MODULE.ID, SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER, {
    name: 'CALENDARIA.Settings.DefaultBrightnessMultiplier.Name',
    hint: 'CALENDARIA.Settings.DefaultBrightnessMultiplier.Hint',
    scope: 'world',
    config: false,
    type: new NumberField({ initial: 1.0, min: 0.5, max: 1.5, step: 0.1 })
  });

  /** TimeKeeper auto-fade on idle */
  game.settings.register(MODULE.ID, SETTINGS.TIMEKEEPER_AUTO_FADE, {
    name: 'CALENDARIA.Settings.AutoFade.Name',
    hint: 'CALENDARIA.Settings.AutoFade.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => TimeKeeper.updateIdleOpacity()
  });

  /** TimeKeeper idle opacity (0-100) */
  game.settings.register(MODULE.ID, SETTINGS.TIMEKEEPER_IDLE_OPACITY, {
    name: 'CALENDARIA.Settings.IdleOpacity.Name',
    hint: 'CALENDARIA.Settings.IdleOpacity.Hint',
    scope: 'user',
    config: false,
    type: new NumberField({ initial: 40, min: 0, max: 100, integer: true }),
    onChange: () => TimeKeeper.updateIdleOpacity()
  });

  /** TimeKeeper custom time jump amounts per interval */
  game.settings.register(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS, {
    name: 'TimeKeeper Time Jumps',
    scope: 'world',
    config: false,
    type: new ObjectField({
      initial: {
        second: { dec2: -30, dec1: -5, inc1: 5, inc2: 30 },
        round: { dec2: -5, dec1: -1, inc1: 1, inc2: 5 },
        minute: { dec2: -30, dec1: -5, inc1: 5, inc2: 30 },
        hour: { dec2: -6, dec1: -1, inc1: 1, inc2: 6 },
        day: { dec2: -7, dec1: -1, inc1: 1, inc2: 7 },
        week: { dec2: -4, dec1: -1, inc1: 1, inc2: 4 },
        month: { dec2: -3, dec1: -1, inc1: 1, inc2: 3 },
        season: { dec2: -2, dec1: -1, inc1: 1, inc2: 2 },
        year: { dec2: -10, dec1: -1, inc1: 1, inc2: 10 }
      }
    })
  });

  /** Sticky states for TimeKeeper */
  game.settings.register(MODULE.ID, SETTINGS.TIMEKEEPER_STICKY_STATES, {
    name: 'TimeKeeper Sticky States',
    scope: 'user',
    config: false,
    type: new ObjectField({ initial: { position: false } })
  });

  /** MiniCal custom time jump amounts per interval */
  game.settings.register(MODULE.ID, SETTINGS.MINI_CAL_TIME_JUMPS, {
    name: 'MiniCal Time Jumps',
    scope: 'world',
    config: false,
    type: new ObjectField({
      initial: {
        second: { dec2: -30, dec1: -5, inc1: 5, inc2: 30 },
        round: { dec2: -5, dec1: -1, inc1: 1, inc2: 5 },
        minute: { dec2: -30, dec1: -5, inc1: 5, inc2: 30 },
        hour: { dec2: -6, dec1: -1, inc1: 1, inc2: 6 },
        day: { dec2: -7, dec1: -1, inc1: 1, inc2: 7 },
        week: { dec2: -4, dec1: -1, inc1: 1, inc2: 4 },
        month: { dec2: -3, dec1: -1, inc1: 1, inc2: 3 },
        season: { dec2: -2, dec1: -1, inc1: 1, inc2: 2 },
        year: { dec2: -10, dec1: -1, inc1: 1, inc2: 10 }
      }
    })
  });

  /** Show toolbar buttons in scene controls */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_TOOLBAR_BUTTON, {
    name: 'CALENDARIA.Settings.ShowToolbarButton.Name',
    hint: 'CALENDARIA.Settings.ShowToolbarButton.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: true }),
    requiresReload: true
  });

  /** Which apps to show as toolbar buttons */
  game.settings.register(MODULE.ID, SETTINGS.TOOLBAR_APPS, {
    name: 'CALENDARIA.Settings.ToolbarApps.Name',
    hint: 'CALENDARIA.Settings.ToolbarApps.Hint',
    scope: 'world',
    config: false,
    type: new SetField(new StringField()),
    default: ['minical'],
    requiresReload: true
  });

  /** Show Calendaria footer in journal sidebar */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_JOURNAL_FOOTER, {
    name: 'CALENDARIA.Settings.ShowJournalFooter.Name',
    hint: 'CALENDARIA.Settings.ShowJournalFooter.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false }),
    requiresReload: true
  });

  // ========================================//
  //  Show on Load (visible in settings menu)  //
  // ========================================//

  /** Show HUD on world load */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, {
    name: 'CALENDARIA.Settings.ShowCalendarHUD.Name',
    hint: 'CALENDARIA.Settings.ShowCalendarHUD.Hint',
    scope: 'user',
    config: true,
    type: new BooleanField({ initial: false })
  });

  /** Show MiniCal on world load */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_MINI_CAL, {
    name: 'CALENDARIA.Settings.ShowMiniCal.Name',
    hint: 'CALENDARIA.Settings.ShowMiniCal.Hint',
    scope: 'user',
    config: true,
    type: new BooleanField({ initial: true })
  });

  /** Show TimeKeeper on world load (GM only) */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER, {
    name: 'CALENDARIA.Settings.ShowTimeKeeper.Name',
    hint: 'CALENDARIA.Settings.ShowTimeKeeper.Hint',
    scope: 'world',
    config: true,
    type: new BooleanField({ initial: false }),
    requiresReload: false,
    onChange: (value) => {
      if (!game.user.isGM) return;
      if (value) TimeKeeper.show();
      else TimeKeeper.hide();
    }
  });

  // ========================================//
  //  Calendar HUD                            //
  // ========================================//

  /** Calendar HUD display mode (fullsize or compact) */
  game.settings.register(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE, {
    name: 'CALENDARIA.Settings.CalendarHUDMode.Name',
    hint: 'CALENDARIA.Settings.CalendarHUDMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({ choices: { fullsize: 'CALENDARIA.Settings.CalendarHUDMode.Fullsize', compact: 'CALENDARIA.Settings.CalendarHUDMode.Compact' }, initial: 'fullsize' }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render()
  });

  /** Calendar HUD dial style (dome vs slice) */
  game.settings.register(MODULE.ID, SETTINGS.HUD_DIAL_STYLE, {
    name: 'CALENDARIA.Settings.HUDDialStyle.Name',
    hint: 'CALENDARIA.Settings.HUDDialStyle.Hint',
    scope: 'user',
    config: false,
    type: new StringField({ choices: { dome: 'CALENDARIA.Settings.HUDDialStyle.Dome', slice: 'CALENDARIA.Settings.HUDDialStyle.Slice' }, initial: 'dome' }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render()
  });

  /** Calendar HUD tray direction (down or up) */
  game.settings.register(MODULE.ID, SETTINGS.HUD_TRAY_DIRECTION, {
    name: 'CALENDARIA.Settings.HUDTrayDirection.Name',
    hint: 'CALENDARIA.Settings.HUDTrayDirection.Hint',
    scope: 'user',
    config: false,
    type: new StringField({ choices: { down: 'CALENDARIA.Settings.HUDTrayDirection.Down', up: 'CALENDARIA.Settings.HUDTrayDirection.Up' }, initial: 'down' }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render()
  });

  /** Calendar HUD combat compact mode */
  game.settings.register(MODULE.ID, SETTINGS.HUD_COMBAT_COMPACT, {
    name: 'CALENDARIA.Settings.HUDCombatCompact.Name',
    hint: 'CALENDARIA.Settings.HUDCombatCompact.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true })
  });

  /** Calendar HUD hide during combat */
  game.settings.register(MODULE.ID, SETTINGS.HUD_COMBAT_HIDE, {
    name: 'CALENDARIA.Settings.HUDCombatHide.Name',
    hint: 'CALENDARIA.Settings.HUDCombatHide.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Calendar HUD dome auto-hide when near viewport top */
  game.settings.register(MODULE.ID, SETTINGS.HUD_DOME_AUTO_HIDE, {
    name: 'CALENDARIA.Settings.DomeAutoHide.Name',
    hint: 'CALENDARIA.Settings.DomeAutoHide.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => HUD.instance?.render()
  });

  /** Calendar HUD auto-fade on idle */
  game.settings.register(MODULE.ID, SETTINGS.HUD_AUTO_FADE, {
    name: 'CALENDARIA.Settings.AutoFade.Name',
    hint: 'CALENDARIA.Settings.AutoFade.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: false }),
    onChange: () => HUD.updateIdleOpacity()
  });

  /** Calendar HUD idle opacity (0-100) */
  game.settings.register(MODULE.ID, SETTINGS.HUD_IDLE_OPACITY, {
    name: 'CALENDARIA.Settings.IdleOpacity.Name',
    hint: 'CALENDARIA.Settings.IdleOpacity.Hint',
    scope: 'user',
    config: false,
    type: new NumberField({ initial: 40, min: 0, max: 100, integer: true }),
    onChange: () => HUD.updateIdleOpacity()
  });

  /** Calendar HUD width scale (fullsize mode only) */
  game.settings.register(MODULE.ID, SETTINGS.HUD_WIDTH_SCALE, {
    name: 'CALENDARIA.Settings.HUDWidthScale.Name',
    hint: 'CALENDARIA.Settings.HUDWidthScale.Hint',
    scope: 'user',
    config: false,
    type: new NumberField({ initial: 1, min: 0.5, max: 2, step: 0.05 }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render()
  });

  /** Sticky zones enabled for all Calendaria windows */
  game.settings.register(MODULE.ID, SETTINGS.HUD_STICKY_ZONES_ENABLED, {
    name: 'CALENDARIA.Settings.StickyZones.Name',
    hint: 'CALENDARIA.Settings.StickyZones.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true })
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

  /** Custom time jump amounts per interval */
  game.settings.register(MODULE.ID, SETTINGS.CUSTOM_TIME_JUMPS, {
    name: 'Custom Time Jumps',
    scope: 'world',
    config: false,
    type: new ObjectField({
      initial: {
        second: { dec2: -30, dec1: -5, inc1: 5, inc2: 30 },
        round: { dec2: -10, dec1: -1, inc1: 1, inc2: 10 },
        minute: { dec2: -30, dec1: -15, inc1: 15, inc2: 30 },
        hour: { dec2: -6, dec1: -1, inc1: 1, inc2: 6 },
        day: { dec2: -7, dec1: -1, inc1: 1, inc2: 7 },
        week: { dec2: -4, dec1: -1, inc1: 1, inc2: 4 },
        month: { dec2: -6, dec1: -1, inc1: 1, inc2: 6 },
        season: { dec2: -2, dec1: -1, inc1: 1, inc2: 2 },
        year: { dec2: -10, dec1: -1, inc1: 1, inc2: 10 }
      }
    })
  });

  /** Show weather indicator on HUD */
  game.settings.register(MODULE.ID, SETTINGS.HUD_SHOW_WEATHER, {
    name: 'CALENDARIA.Settings.HUDShowWeather.Name',
    hint: 'CALENDARIA.Settings.HUDShowWeather.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render({ parts: ['bar'] })
  });

  /** Show season indicator on HUD */
  game.settings.register(MODULE.ID, SETTINGS.HUD_SHOW_SEASON, {
    name: 'CALENDARIA.Settings.HUDShowSeason.Name',
    hint: 'CALENDARIA.Settings.HUDShowSeason.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render({ parts: ['bar'] })
  });

  /** Show era/cycle indicators on HUD */
  game.settings.register(MODULE.ID, SETTINGS.HUD_SHOW_ERA, {
    name: 'CALENDARIA.Settings.HUDShowEra.Name',
    hint: 'CALENDARIA.Settings.HUDShowEra.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render({ parts: ['bar'] })
  });

  /** Weather display mode on HUD */
  game.settings.register(MODULE.ID, SETTINGS.HUD_WEATHER_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.HUDWeatherDisplayMode.Name',
    hint: 'CALENDARIA.Settings.HUDWeatherDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        full: 'CALENDARIA.Settings.HUDWeatherDisplayMode.Full',
        temp: 'CALENDARIA.Settings.HUDWeatherDisplayMode.TempOnly',
        icon: 'CALENDARIA.Settings.HUDWeatherDisplayMode.IconOnly',
        iconTemp: 'CALENDARIA.Settings.HUDWeatherDisplayMode.IconTemp'
      },
      initial: 'full'
    }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render({ parts: ['bar'] })
  });

  /** Season display mode on HUD */
  game.settings.register(MODULE.ID, SETTINGS.HUD_SEASON_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Name',
    hint: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        full: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Full',
        icon: 'CALENDARIA.Settings.HUDSeasonDisplayMode.IconOnly',
        text: 'CALENDARIA.Settings.HUDSeasonDisplayMode.TextOnly'
      },
      initial: 'full'
    }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render({ parts: ['bar'] })
  });

  /** Era display mode on HUD */
  game.settings.register(MODULE.ID, SETTINGS.HUD_ERA_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.HUDEraDisplayMode.Name',
    hint: 'CALENDARIA.Settings.HUDEraDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        full: 'CALENDARIA.Settings.HUDEraDisplayMode.Full',
        icon: 'CALENDARIA.Settings.HUDEraDisplayMode.IconOnly',
        text: 'CALENDARIA.Settings.HUDEraDisplayMode.TextOnly',
        abbr: 'CALENDARIA.Settings.HUDEraDisplayMode.Abbreviation'
      },
      initial: 'full'
    }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render({ parts: ['bar'] })
  });

  /** Show cycles indicator on HUD */
  game.settings.register(MODULE.ID, SETTINGS.HUD_SHOW_CYCLES, {
    name: 'CALENDARIA.Settings.HUDShowCycles.Name',
    hint: 'CALENDARIA.Settings.HUDShowCycles.Hint',
    scope: 'user',
    config: false,
    type: new BooleanField({ initial: true }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render({ parts: ['bar'] })
  });

  /** Cycles display mode on HUD */
  game.settings.register(MODULE.ID, SETTINGS.HUD_CYCLES_DISPLAY_MODE, {
    name: 'CALENDARIA.Settings.HUDCyclesDisplayMode.Name',
    hint: 'CALENDARIA.Settings.HUDCyclesDisplayMode.Hint',
    scope: 'user',
    config: false,
    type: new StringField({
      choices: {
        name: 'CALENDARIA.Settings.HUDCyclesDisplayMode.NameOption',
        icon: 'CALENDARIA.Settings.HUDCyclesDisplayMode.IconOnly',
        number: 'CALENDARIA.Settings.HUDCyclesDisplayMode.Number',
        roman: 'CALENDARIA.Settings.HUDCyclesDisplayMode.Roman'
      },
      initial: 'icon'
    }),
    onChange: () => foundry.applications.instances.get('calendaria-hud')?.render({ parts: ['bar'] })
  });

  /** Force HUD display for all clients */
  game.settings.register(MODULE.ID, SETTINGS.FORCE_HUD, {
    name: 'CALENDARIA.Settings.ForceHUD.Name',
    hint: 'CALENDARIA.Settings.ForceHUD.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false }),
    onChange: async (value) => {
      if (value) {
        await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, true);
        HUD.show();
      }
    }
  });

  /** Force MiniCal display for all clients */
  game.settings.register(MODULE.ID, SETTINGS.FORCE_MINI_CAL, {
    name: 'CALENDARIA.Settings.ForceMiniCal.Name',
    hint: 'CALENDARIA.Settings.ForceMiniCal.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false }),
    onChange: async (value) => {
      if (value) {
        await game.settings.set(MODULE.ID, SETTINGS.SHOW_MINI_CAL, true);
        MiniCal.show();
      }
    }
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
    config: false,
    type: new StringField({ initial: 'gregorian', blank: true }),
    requiresReload: true
  });

  /** Whether to show the active calendar setting to players */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_ACTIVE_CALENDAR_TO_PLAYERS, {
    name: 'CALENDARIA.Settings.ShowActiveCalendarToPlayers.Name',
    hint: 'CALENDARIA.Settings.ShowActiveCalendarToPlayers.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
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
        hudTime: { gm: 'time24', player: 'time24' },
        miniCalHeader: { gm: 'MMMM GGGG', player: 'MMMM GGGG' },
        miniCalTime: { gm: 'time24', player: 'time24' },
        bigCalHeader: { gm: 'MMMM GGGG', player: 'MMMM GGGG' },
        chatTimestamp: { gm: 'dateShort', player: 'dateShort' },
        stopwatchRealtime: { gm: 'stopwatchRealtimeFull', player: 'stopwatchRealtimeFull' },
        stopwatchGametime: { gm: 'stopwatchGametimeFull', player: 'stopwatchGametimeFull' }
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

  /** Whether to sync clock pause with game pause */
  game.settings.register(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE, {
    name: 'CALENDARIA.Settings.SyncClockPause.Name',
    hint: 'CALENDARIA.Settings.SyncClockPause.Hint',
    scope: 'world',
    config: false,
    type: new BooleanField({ initial: false })
  });

  /** Real-time clock speed multiplier (game units per real second) */
  game.settings.register(MODULE.ID, SETTINGS.TIME_SPEED_MULTIPLIER, {
    name: 'CALENDARIA.Settings.TimeSpeedMultiplier.Name',
    hint: 'CALENDARIA.Settings.TimeSpeedMultiplier.Hint',
    scope: 'world',
    config: false,
    type: new NumberField({ initial: 1, min: 0.01 })
  });

  /** Real-time clock speed increment unit */
  game.settings.register(MODULE.ID, SETTINGS.TIME_SPEED_INCREMENT, {
    name: 'CALENDARIA.Settings.TimeSpeedIncrement.Name',
    hint: 'CALENDARIA.Settings.TimeSpeedIncrement.Hint',
    scope: 'world',
    config: false,
    type: new StringField({ initial: 'second' })
  });

  // ========================================//
  //  Permissions                            //
  // ========================================//

  /** Permission levels for various actions by role */
  game.settings.register(MODULE.ID, SETTINGS.PERMISSIONS, {
    name: 'Permissions',
    scope: 'world',
    config: false,
    type: new ObjectField({
      initial: {
        viewBigCal: { player: false, trusted: true, assistant: true },
        viewMiniCal: { player: false, trusted: true, assistant: true },
        viewTimeKeeper: { player: false, trusted: true, assistant: true },
        addNotes: { player: true, trusted: true, assistant: true },
        changeDateTime: { player: false, trusted: false, assistant: true },
        changeActiveCalendar: { player: false, trusted: false, assistant: false },
        changeWeather: { player: false, trusted: false, assistant: true },
        editNotes: { player: false, trusted: true, assistant: true },
        deleteNotes: { player: false, trusted: false, assistant: true },
        editCalendars: { player: false, trusted: false, assistant: false }
      }
    }),
    onChange: () => NoteManager.syncNoteOwnership()
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

  /** World-level weather preset label aliases */
  game.settings.register(MODULE.ID, SETTINGS.WEATHER_PRESET_ALIASES, {
    name: 'Weather Preset Aliases',
    scope: 'world',
    config: false,
    type: new ObjectField({ initial: {} })
  });

  // ========================================//
  //  Timepoints                             //
  // ========================================//

  /** Saved timepoints for quick time navigation */
  game.settings.register(MODULE.ID, SETTINGS.SAVED_TIMEPOINTS, {
    name: 'Saved Timepoints',
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
    type: new BooleanField({ initial: false }),
    onChange: (enabled) => {
      if (enabled) StickyZones.showDebugZones();
      else StickyZones.hideDebugZones();
    }
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
      blank: true,
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
}
