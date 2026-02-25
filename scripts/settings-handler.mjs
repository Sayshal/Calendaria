/**
 * Calendaria Module Settings Registration
 * @module CalendariaSettings
 * @author Tyler
 */

import { CalendarEditor } from './applications/calendar/calendar-editor.mjs';
import { MiniCal } from './applications/calendar/mini-cal.mjs';
import { ImporterApp } from './applications/dialogs/importer-app.mjs';
import { HUD } from './applications/hud/hud.mjs';
import { SettingsPanel } from './applications/settings/settings-panel.mjs';
import { TimeKeeper } from './applications/time/time-keeper.mjs';
import { MODULE, SETTINGS } from './constants.mjs';
import NoteManager from './notes/note-manager.mjs';
import { localize } from './utils/localization.mjs';
import { log } from './utils/logger.mjs';
import { initializeTheme } from './utils/theme-utils.mjs';
import * as StickyZones from './utils/ui/sticky-zones.mjs';

const { ArrayField, ObjectField, BooleanField, NumberField, SetField, StringField } = foundry.data.fields;

const renderMiniCal = () => foundry.applications.instances.get('mini-cal')?.render();
const renderBigCal = () => foundry.applications.instances.get('calendaria')?.render();
const renderHUD = () => foundry.applications.instances.get('calendaria-hud')?.render();
const renderHUDBar = () => foundry.applications.instances.get('calendaria-hud')?.render({ parts: ['bar'] });

/**
 * Static class encapsulating all Calendaria module settings.
 */
export default class CalendariaSettings {
  /** @returns {Object<string, object>} All setting definitions keyed by setting key. */
  static get settings() {
    return {
      [SETTINGS.CALENDAR_POSITION]: { name: 'Calendar Position', scope: 'user', config: false, type: new ObjectField({ nullable: true, initial: null }) },
      [SETTINGS.POSITION_LOCKED]: { name: 'Position Locked', scope: 'user', config: false, type: new BooleanField({ initial: false }) },
      [SETTINGS.MINI_CAL_POSITION]: { name: 'MiniCal Position', scope: 'user', config: false, type: new ObjectField({ nullable: true, initial: null }) },
      [SETTINGS.TIME_KEEPER_POSITION]: { name: 'TimeKeeper Position', scope: 'user', config: false, type: new ObjectField({ nullable: true, initial: null }) },
      [SETTINGS.STOPWATCH_POSITION]: { name: 'Stopwatch Position', scope: 'user', config: false, type: new ObjectField({ nullable: true, initial: null }) },
      [SETTINGS.STOPWATCH_STATE]: { name: 'Stopwatch State', scope: 'client', config: false, type: new ObjectField({ nullable: true, initial: null }) },
      [SETTINGS.STOPWATCH_AUTO_START_TIME]: {
        name: 'CALENDARIA.Settings.StopwatchAutoStartTime.Name',
        hint: 'CALENDARIA.Settings.StopwatchAutoStartTime.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.STOPWATCH_STICKY_STATES]: { name: 'Stopwatch Sticky States', scope: 'user', config: false, type: new ObjectField({ initial: { position: false } }) },
      [SETTINGS.MINI_CAL_AUTO_FADE]: {
        name: 'CALENDARIA.Settings.AutoFade.Name',
        hint: 'CALENDARIA.Settings.AutoFade.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: false }),
        onChange: () => MiniCal.updateIdleOpacity()
      },
      [SETTINGS.MINI_CAL_IDLE_OPACITY]: {
        name: 'CALENDARIA.Settings.IdleOpacity.Name',
        hint: 'CALENDARIA.Settings.IdleOpacity.Hint',
        scope: 'user',
        config: false,
        type: new NumberField({ initial: 40, min: 0, max: 100, integer: true }),
        onChange: () => MiniCal.updateIdleOpacity()
      },
      [SETTINGS.MINI_CAL_CONTROLS_DELAY]: {
        name: 'CALENDARIA.Settings.MiniCalControlsDelay.Name',
        hint: 'CALENDARIA.Settings.MiniCalControlsDelay.Hint',
        scope: 'user',
        config: false,
        type: new NumberField({ min: 1, max: 10, step: 1, integer: true, initial: 3 })
      },
      [SETTINGS.MINI_CAL_STICKY_STATES]: { name: 'MiniCal Sticky States', scope: 'user', config: false, type: new ObjectField({ initial: { timeControls: false, sidebar: false, position: false } }) },
      [SETTINGS.MINI_CAL_CONFIRM_SET_DATE]: {
        name: 'CALENDARIA.Settings.ConfirmSetDate.Name',
        hint: 'CALENDARIA.Settings.ConfirmSetDate.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.MINI_CAL_SHOW_WEATHER]: {
        name: 'CALENDARIA.Settings.MiniCalShowWeather.Name',
        hint: 'CALENDARIA.Settings.MiniCalShowWeather.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderMiniCal
      },
      [SETTINGS.MINI_CAL_WEATHER_DISPLAY_MODE]: {
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
        onChange: renderMiniCal
      },
      [SETTINGS.MINI_CAL_SHOW_SEASON]: {
        name: 'CALENDARIA.Settings.MiniCalShowSeason.Name',
        hint: 'CALENDARIA.Settings.MiniCalShowSeason.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderMiniCal
      },
      [SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE]: {
        name: 'CALENDARIA.Settings.MiniCalSeasonDisplayMode.Name',
        hint: 'CALENDARIA.Settings.MiniCalSeasonDisplayMode.Hint',
        scope: 'user',
        config: false,
        type: new StringField({
          choices: { full: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Full', icon: 'CALENDARIA.Settings.HUDSeasonDisplayMode.IconOnly', text: 'CALENDARIA.Settings.HUDSeasonDisplayMode.TextOnly' },
          initial: 'full'
        }),
        onChange: renderMiniCal
      },
      [SETTINGS.MINI_CAL_SHOW_ERA]: {
        name: 'CALENDARIA.Settings.MiniCalShowEra.Name',
        hint: 'CALENDARIA.Settings.MiniCalShowEra.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderMiniCal
      },
      [SETTINGS.MINI_CAL_ERA_DISPLAY_MODE]: {
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
        onChange: renderMiniCal
      },
      [SETTINGS.MINI_CAL_SHOW_CYCLES]: {
        name: 'CALENDARIA.Settings.MiniCalShowCycles.Name',
        hint: 'CALENDARIA.Settings.MiniCalShowCycles.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderMiniCal
      },
      [SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE]: {
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
        onChange: renderMiniCal
      },
      [SETTINGS.MINI_CAL_SHOW_MOON_PHASES]: {
        name: 'CALENDARIA.Settings.MiniCalShowMoonPhases.Name',
        hint: 'CALENDARIA.Settings.MiniCalShowMoonPhases.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderMiniCal
      },
      [SETTINGS.MINI_CAL_HEADER_SHOW_SELECTED]: {
        name: 'CALENDARIA.Settings.MiniCalHeaderShowSelected.Name',
        hint: 'CALENDARIA.Settings.MiniCalHeaderShowSelected.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: false }),
        onChange: renderMiniCal
      },
      [SETTINGS.BIG_CAL_SHOW_WEATHER]: {
        name: 'CALENDARIA.Settings.BigCalShowWeather.Name',
        hint: 'CALENDARIA.Settings.BigCalShowWeather.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderBigCal
      },
      [SETTINGS.BIG_CAL_WEATHER_DISPLAY_MODE]: {
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
        onChange: renderBigCal
      },
      [SETTINGS.BIG_CAL_SHOW_SEASON]: {
        name: 'CALENDARIA.Settings.BigCalShowSeason.Name',
        hint: 'CALENDARIA.Settings.BigCalShowSeason.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderBigCal
      },
      [SETTINGS.BIG_CAL_SEASON_DISPLAY_MODE]: {
        name: 'CALENDARIA.Settings.BigCalSeasonDisplayMode.Name',
        hint: 'CALENDARIA.Settings.BigCalSeasonDisplayMode.Hint',
        scope: 'user',
        config: false,
        type: new StringField({
          choices: { full: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Full', icon: 'CALENDARIA.Settings.HUDSeasonDisplayMode.IconOnly', text: 'CALENDARIA.Settings.HUDSeasonDisplayMode.TextOnly' },
          initial: 'full'
        }),
        onChange: renderBigCal
      },
      [SETTINGS.BIG_CAL_SHOW_ERA]: {
        name: 'CALENDARIA.Settings.BigCalShowEra.Name',
        hint: 'CALENDARIA.Settings.BigCalShowEra.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderBigCal
      },
      [SETTINGS.BIG_CAL_ERA_DISPLAY_MODE]: {
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
        onChange: renderBigCal
      },
      [SETTINGS.BIG_CAL_SHOW_CYCLES]: {
        name: 'CALENDARIA.Settings.BigCalShowCycles.Name',
        hint: 'CALENDARIA.Settings.BigCalShowCycles.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderBigCal
      },
      [SETTINGS.BIG_CAL_CYCLES_DISPLAY_MODE]: {
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
        onChange: renderBigCal
      },
      [SETTINGS.BIG_CAL_SHOW_MOON_PHASES]: {
        name: 'CALENDARIA.Settings.BigCalShowMoonPhases.Name',
        hint: 'CALENDARIA.Settings.BigCalShowMoonPhases.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderBigCal
      },
      [SETTINGS.BIG_CAL_HEADER_SHOW_SELECTED]: {
        name: 'CALENDARIA.Settings.BigCalHeaderShowSelected.Name',
        hint: 'CALENDARIA.Settings.BigCalHeaderShowSelected.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: false }),
        onChange: renderBigCal
      },
      formatMigrationComplete: { name: 'Format Migration Complete', scope: 'world', config: false, type: new BooleanField({ initial: false }) },
      settingKeyMigrationComplete: { name: 'Setting Key Migration Complete', scope: 'world', config: false, type: new BooleanField({ initial: false }) },
      intercalaryMigrationComplete: { name: 'Intercalary Migration Complete', scope: 'world', config: false, type: new BooleanField({ initial: false }) },
      weatherZoneMigrationComplete: { name: 'Weather Zone Migration Complete', scope: 'world', config: false, type: new BooleanField({ initial: false }) },
      [SETTINGS.DARKNESS_SYNC]: {
        name: 'CALENDARIA.Settings.DarknessSync.Name',
        hint: 'CALENDARIA.Settings.DarknessSync.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.DARKNESS_SYNC_ALL_SCENES]: {
        name: 'CALENDARIA.Settings.DarknessSyncAllScenes.Name',
        hint: 'CALENDARIA.Settings.DarknessSyncAllScenes.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.DARKNESS_WEATHER_SYNC]: {
        name: 'CALENDARIA.Settings.DarknessWeatherSync.Name',
        hint: 'CALENDARIA.Settings.DarknessWeatherSync.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.AMBIENCE_SYNC]: {
        name: 'CALENDARIA.Settings.AmbienceSync.Name',
        hint: 'CALENDARIA.Settings.AmbienceSync.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.DARKNESS_MOON_SYNC]: {
        name: 'CALENDARIA.Settings.DarknessMoonSync.Name',
        hint: 'CALENDARIA.Settings.DarknessMoonSync.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.COLOR_SHIFT_SYNC]: {
        name: 'CALENDARIA.Settings.ColorShiftSync.Name',
        hint: 'CALENDARIA.Settings.ColorShiftSync.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.ALLOW_SIDEBAR_OVERLAP]: {
        name: 'CALENDARIA.Settings.AllowSidebarOverlap.Name',
        hint: 'CALENDARIA.Settings.AllowSidebarOverlap.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER]: {
        name: 'CALENDARIA.Settings.DefaultBrightnessMultiplier.Name',
        hint: 'CALENDARIA.Settings.DefaultBrightnessMultiplier.Hint',
        scope: 'world',
        config: false,
        type: new NumberField({ initial: 1.0, min: 0.5, max: 1.5, step: 0.1 })
      },
      [SETTINGS.TIMEKEEPER_AUTO_FADE]: {
        name: 'CALENDARIA.Settings.AutoFade.Name',
        hint: 'CALENDARIA.Settings.AutoFade.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: () => TimeKeeper.updateIdleOpacity()
      },
      [SETTINGS.TIMEKEEPER_IDLE_OPACITY]: {
        name: 'CALENDARIA.Settings.IdleOpacity.Name',
        hint: 'CALENDARIA.Settings.IdleOpacity.Hint',
        scope: 'user',
        config: false,
        type: new NumberField({ initial: 40, min: 0, max: 100, integer: true }),
        onChange: () => TimeKeeper.updateIdleOpacity()
      },
      [SETTINGS.TIMEKEEPER_TIME_JUMPS]: {
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
      },
      [SETTINGS.TIMEKEEPER_STICKY_STATES]: { name: 'TimeKeeper Sticky States', scope: 'user', config: false, type: new ObjectField({ initial: { position: false } }) },
      [SETTINGS.MINI_CAL_TIME_JUMPS]: {
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
      },
      [SETTINGS.SHOW_TOOLBAR_BUTTON]: {
        name: 'CALENDARIA.Settings.ShowToolbarButton.Name',
        hint: 'CALENDARIA.Settings.ShowToolbarButton.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: true }),
        requiresReload: true
      },
      [SETTINGS.TOOLBAR_APPS]: {
        name: 'CALENDARIA.Settings.ToolbarApps.Name',
        hint: 'CALENDARIA.Settings.ToolbarApps.Hint',
        scope: 'world',
        config: false,
        type: new SetField(new StringField()),
        default: ['minical'],
        requiresReload: true
      },
      [SETTINGS.SHOW_JOURNAL_FOOTER]: {
        name: 'CALENDARIA.Settings.ShowJournalFooter.Name',
        hint: 'CALENDARIA.Settings.ShowJournalFooter.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false }),
        requiresReload: true
      },
      [SETTINGS.SHOW_CALENDAR_HUD]: {
        name: 'CALENDARIA.Settings.ShowCalendarHUD.Name',
        hint: 'CALENDARIA.Settings.ShowCalendarHUD.Hint',
        scope: 'user',
        config: true,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.SHOW_MINI_CAL]: { name: 'CALENDARIA.Settings.ShowMiniCal.Name', hint: 'CALENDARIA.Settings.ShowMiniCal.Hint', scope: 'user', config: true, type: new BooleanField({ initial: true }) },
      [SETTINGS.SHOW_TIME_KEEPER]: {
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
      },
      [SETTINGS.CALENDAR_HUD_MODE]: {
        name: 'CALENDARIA.Settings.CalendarHUDMode.Name',
        hint: 'CALENDARIA.Settings.CalendarHUDMode.Hint',
        scope: 'user',
        config: false,
        type: new StringField({ choices: { fullsize: 'CALENDARIA.Settings.CalendarHUDMode.Fullsize', compact: 'CALENDARIA.Settings.CalendarHUDMode.Compact' }, initial: 'fullsize' }),
        onChange: renderHUD
      },
      [SETTINGS.HUD_CALENDAR_BUTTON]: {
        name: 'CALENDARIA.Settings.HUDCalendarButton.Name',
        hint: 'CALENDARIA.Settings.HUDCalendarButton.Hint',
        scope: 'client',
        config: false,
        type: new StringField({ choices: { bigcal: 'CALENDARIA.Settings.HUDCalendarButton.BigCal', minical: 'CALENDARIA.Settings.HUDCalendarButton.MiniCal' }, initial: 'bigcal' }),
        onChange: renderHUDBar
      },
      [SETTINGS.HUD_DIAL_STYLE]: {
        name: 'CALENDARIA.Settings.HUDDialStyle.Name',
        hint: 'CALENDARIA.Settings.HUDDialStyle.Hint',
        scope: 'user',
        config: false,
        type: new StringField({ choices: { dome: 'CALENDARIA.Settings.HUDDialStyle.Dome', slice: 'CALENDARIA.Settings.HUDDialStyle.Slice' }, initial: 'dome' }),
        onChange: renderHUD
      },
      [SETTINGS.HUD_TRAY_DIRECTION]: {
        name: 'CALENDARIA.Settings.HUDTrayDirection.Name',
        hint: 'CALENDARIA.Settings.HUDTrayDirection.Hint',
        scope: 'user',
        config: false,
        type: new StringField({ choices: { down: 'CALENDARIA.Settings.HUDTrayDirection.Down', up: 'CALENDARIA.Settings.HUDTrayDirection.Up' }, initial: 'down' }),
        onChange: renderHUD
      },
      [SETTINGS.HUD_COMBAT_COMPACT]: {
        name: 'CALENDARIA.Settings.HUDCombatCompact.Name',
        hint: 'CALENDARIA.Settings.HUDCombatCompact.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.HUD_COMBAT_HIDE]: {
        name: 'CALENDARIA.Settings.HUDCombatHide.Name',
        hint: 'CALENDARIA.Settings.HUDCombatHide.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.HUD_DOME_BELOW]: {
        name: 'CALENDARIA.Settings.HUDDomeBelow.Name',
        hint: 'CALENDARIA.Settings.HUDDomeBelow.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: false }),
        onChange: renderHUD
      },
      [SETTINGS.HUD_DOME_AUTO_HIDE]: {
        name: 'CALENDARIA.Settings.DomeAutoHide.Name',
        hint: 'CALENDARIA.Settings.DomeAutoHide.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: () => HUD.instance?.render()
      },
      [SETTINGS.HUD_SHOW_ALL_MOONS]: {
        name: 'CALENDARIA.Settings.HUDShowAllMoons.Name',
        hint: 'CALENDARIA.Settings.HUDShowAllMoons.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: () => HUD.instance?.render()
      },
      [SETTINGS.HUD_AUTO_FADE]: {
        name: 'CALENDARIA.Settings.AutoFade.Name',
        hint: 'CALENDARIA.Settings.AutoFade.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: false }),
        onChange: () => HUD.updateIdleOpacity()
      },
      [SETTINGS.HUD_IDLE_OPACITY]: {
        name: 'CALENDARIA.Settings.IdleOpacity.Name',
        hint: 'CALENDARIA.Settings.IdleOpacity.Hint',
        scope: 'user',
        config: false,
        type: new NumberField({ initial: 40, min: 0, max: 100, integer: true }),
        onChange: () => HUD.updateIdleOpacity()
      },
      [SETTINGS.HUD_WIDTH_SCALE]: {
        name: 'CALENDARIA.Settings.HUDWidthScale.Name',
        hint: 'CALENDARIA.Settings.HUDWidthScale.Hint',
        scope: 'user',
        config: false,
        type: new NumberField({ initial: 1, min: 0.5, max: 2, step: 0.05 }),
        onChange: renderHUD
      },
      [SETTINGS.HUD_STICKY_ZONES_ENABLED]: {
        name: 'CALENDARIA.Settings.StickyZones.Name',
        hint: 'CALENDARIA.Settings.StickyZones.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.CALENDAR_HUD_LOCKED]: { name: 'Calendar HUD Locked', scope: 'user', config: false, type: new BooleanField({ initial: false }) },
      [SETTINGS.HUD_STICKY_STATES]: { name: 'Calendar HUD Sticky States', scope: 'user', config: false, type: new ObjectField({ initial: { tray: false, position: false } }) },
      [SETTINGS.CALENDAR_HUD_POSITION]: { name: 'Calendar HUD Position', scope: 'user', config: false, type: new ObjectField({ nullable: true, initial: null }) },
      [SETTINGS.CUSTOM_TIME_JUMPS]: {
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
      },
      [SETTINGS.HUD_SHOW_WEATHER]: {
        name: 'CALENDARIA.Settings.HUDShowWeather.Name',
        hint: 'CALENDARIA.Settings.HUDShowWeather.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderHUDBar
      },
      [SETTINGS.HUD_SHOW_SEASON]: {
        name: 'CALENDARIA.Settings.HUDShowSeason.Name',
        hint: 'CALENDARIA.Settings.HUDShowSeason.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderHUDBar
      },
      [SETTINGS.HUD_SHOW_ERA]: {
        name: 'CALENDARIA.Settings.HUDShowEra.Name',
        hint: 'CALENDARIA.Settings.HUDShowEra.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderHUDBar
      },
      [SETTINGS.HUD_WEATHER_DISPLAY_MODE]: {
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
        onChange: renderHUDBar
      },
      [SETTINGS.HUD_SEASON_DISPLAY_MODE]: {
        name: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Name',
        hint: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Hint',
        scope: 'user',
        config: false,
        type: new StringField({
          choices: { full: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Full', icon: 'CALENDARIA.Settings.HUDSeasonDisplayMode.IconOnly', text: 'CALENDARIA.Settings.HUDSeasonDisplayMode.TextOnly' },
          initial: 'full'
        }),
        onChange: renderHUDBar
      },
      [SETTINGS.HUD_ERA_DISPLAY_MODE]: {
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
        onChange: renderHUDBar
      },
      [SETTINGS.HUD_SHOW_CYCLES]: {
        name: 'CALENDARIA.Settings.HUDShowCycles.Name',
        hint: 'CALENDARIA.Settings.HUDShowCycles.Hint',
        scope: 'user',
        config: false,
        type: new BooleanField({ initial: true }),
        onChange: renderHUDBar
      },
      [SETTINGS.HUD_CYCLES_DISPLAY_MODE]: {
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
        onChange: renderHUDBar
      },
      [SETTINGS.FORCE_HUD]: {
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
      },
      [SETTINGS.FORCE_MINI_CAL]: {
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
      },
      [SETTINGS.CUSTOM_THEME_COLORS]: { name: 'Custom Theme Colors', scope: 'user', config: false, type: new ObjectField({ initial: {} }) },
      [SETTINGS.THEME_MODE]: { name: 'Theme Mode', scope: 'user', config: false, type: new StringField({ initial: 'dark', choices: ['dark', 'highContrast', 'custom'] }) },
      [SETTINGS.FORCE_THEME]: {
        name: 'CALENDARIA.Settings.ForceTheme.Name',
        hint: 'CALENDARIA.Settings.ForceTheme.Hint',
        scope: 'world',
        config: false,
        type: new StringField({
          choices: {
            none: 'CALENDARIA.Settings.ForceTheme.None',
            dark: 'CALENDARIA.ThemeEditor.Presets.Dark',
            highContrast: 'CALENDARIA.ThemeEditor.Presets.HighContrast',
            custom: 'CALENDARIA.ThemeEditor.Custom'
          },
          initial: 'none'
        }),
        onChange: () => initializeTheme()
      },
      [SETTINGS.FORCED_THEME_COLORS]: { name: 'Forced Theme Colors', scope: 'world', config: false, type: new ObjectField({ initial: {} }), onChange: () => initializeTheme() },
      [SETTINGS.CALENDARS]: { name: 'Calendar Configurations', scope: 'world', config: false, type: new ObjectField({ nullable: true, initial: null }) },
      [SETTINGS.CUSTOM_CALENDARS]: { name: 'Custom Calendars', scope: 'world', config: false, type: new ObjectField({ initial: {} }) },
      [SETTINGS.ACTIVE_CALENDAR]: {
        name: 'CALENDARIA.Settings.ActiveCalendar.Name',
        hint: 'CALENDARIA.Settings.ActiveCalendar.Hint',
        scope: 'world',
        config: false,
        type: new StringField({ initial: 'gregorian', blank: true }),
        requiresReload: true
      },
      [SETTINGS.SHOW_ACTIVE_CALENDAR_TO_PLAYERS]: {
        name: 'CALENDARIA.Settings.ShowActiveCalendarToPlayers.Name',
        hint: 'CALENDARIA.Settings.ShowActiveCalendarToPlayers.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.DEFAULT_OVERRIDES]: { name: 'Default Calendar Overrides', scope: 'world', config: false, type: new ObjectField({ initial: {} }) },
      [SETTINGS.CUSTOM_CATEGORIES]: { name: 'Custom Categories', scope: 'world', config: false, type: new ArrayField(new ObjectField()) },
      [SETTINGS.CHAT_TIMESTAMP_MODE]: {
        name: 'CALENDARIA.Settings.ChatTimestampMode.Name',
        hint: 'CALENDARIA.Settings.ChatTimestampMode.Hint',
        scope: 'world',
        config: false,
        type: new StringField({
          choices: { disabled: 'CALENDARIA.Settings.ChatTimestampMode.Disabled', replace: 'CALENDARIA.Settings.ChatTimestampMode.Replace', augment: 'CALENDARIA.Settings.ChatTimestampMode.Augment' },
          initial: 'disabled'
        })
      },
      [SETTINGS.CHAT_TIMESTAMP_SHOW_TIME]: {
        name: 'CALENDARIA.Settings.ChatTimestampShowTime.Name',
        hint: 'CALENDARIA.Settings.ChatTimestampShowTime.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.DISPLAY_FORMATS]: {
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
      },
      [SETTINGS.ADVANCE_TIME_ON_REST]: {
        name: 'CALENDARIA.Settings.AdvanceTimeOnRest.Name',
        hint: 'CALENDARIA.Settings.AdvanceTimeOnRest.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.REST_TO_SUNRISE]: {
        name: 'CALENDARIA.Settings.RestToSunrise.Name',
        hint: 'CALENDARIA.Settings.RestToSunrise.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.CLOCK_LOCKED]: { name: 'Clock Locked', scope: 'world', config: false, type: new BooleanField({ initial: false }) },
      [SETTINGS.SYNC_CLOCK_PAUSE]: {
        name: 'CALENDARIA.Settings.SyncClockPause.Name',
        hint: 'CALENDARIA.Settings.SyncClockPause.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.TIME_ADVANCE_INTERVAL]: {
        name: 'CALENDARIA.Settings.TimeAdvanceInterval.Name',
        hint: 'CALENDARIA.Settings.TimeAdvanceInterval.Hint',
        scope: 'world',
        config: false,
        type: new NumberField({ initial: 60, min: 1, max: 120, step: 1, integer: true })
      },
      [SETTINGS.TIME_SPEED_MULTIPLIER]: {
        name: 'CALENDARIA.Settings.TimeSpeedMultiplier.Name',
        hint: 'CALENDARIA.Settings.TimeSpeedMultiplier.Hint',
        scope: 'world',
        config: false,
        type: new NumberField({ initial: 1, min: 0.01 })
      },
      [SETTINGS.TIME_SPEED_INCREMENT]: {
        name: 'CALENDARIA.Settings.TimeSpeedIncrement.Name',
        hint: 'CALENDARIA.Settings.TimeSpeedIncrement.Hint',
        scope: 'world',
        config: false,
        type: new StringField({ initial: 'second' })
      },
      [SETTINGS.PERMISSIONS]: {
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
            editCalendars: { player: false, trusted: false, assistant: false },
            viewWeatherForecast: { player: false, trusted: true, assistant: true }
          }
        }),
        onChange: () => NoteManager.syncNoteOwnership()
      },
      [SETTINGS.AUTO_GENERATE_WEATHER]: {
        name: 'CALENDARIA.Settings.AutoGenerate.Name',
        hint: 'CALENDARIA.Settings.AutoGenerate.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.CURRENT_WEATHER]: { name: 'Current Weather', scope: 'world', config: false, type: new ObjectField({ nullable: true, initial: null }) },
      [SETTINGS.TEMPERATURE_UNIT]: {
        name: 'CALENDARIA.Settings.TemperatureUnit.Name',
        hint: 'CALENDARIA.Settings.TemperatureUnit.Hint',
        scope: 'world',
        config: false,
        type: new StringField({ choices: { celsius: 'CALENDARIA.Settings.TemperatureUnit.Celsius', fahrenheit: 'CALENDARIA.Settings.TemperatureUnit.Fahrenheit' }, initial: 'celsius' })
      },
      [SETTINGS.PRECIPITATION_UNIT]: {
        name: 'CALENDARIA.Settings.PrecipitationUnit.Name',
        hint: 'CALENDARIA.Settings.PrecipitationUnit.Hint',
        scope: 'world',
        config: false,
        type: new StringField({ choices: { metric: 'CALENDARIA.Settings.PrecipitationUnit.Metric', imperial: 'CALENDARIA.Settings.PrecipitationUnit.Imperial' }, initial: 'metric' })
      },
      [SETTINGS.WIND_SPEED_UNIT]: {
        name: 'CALENDARIA.Settings.WindSpeedUnit.Name',
        hint: 'CALENDARIA.Settings.WindSpeedUnit.Hint',
        scope: 'world',
        config: false,
        type: new StringField({ choices: { kph: 'CALENDARIA.Settings.WindSpeedUnit.Kph', mph: 'CALENDARIA.Settings.WindSpeedUnit.Mph' }, initial: 'kph' })
      },
      [SETTINGS.WEATHER_HISTORY]: { name: 'Weather History', scope: 'world', config: false, type: new ObjectField({ initial: {} }) },
      [SETTINGS.WEATHER_HISTORY_DAYS]: {
        name: 'CALENDARIA.Settings.WeatherHistoryDays.Name',
        hint: 'CALENDARIA.Settings.WeatherHistoryDays.Hint',
        scope: 'world',
        config: false,
        type: new NumberField({ initial: 365, min: 0, max: 3650, integer: true })
      },
      [SETTINGS.FORECAST_ACCURACY]: {
        name: 'CALENDARIA.Settings.ForecastAccuracy.Name',
        hint: 'CALENDARIA.Settings.ForecastAccuracy.Hint',
        scope: 'world',
        config: false,
        type: new NumberField({ initial: 70, min: 0, max: 100, step: 5, integer: true })
      },
      [SETTINGS.FORECAST_DAYS]: {
        name: 'CALENDARIA.Settings.ForecastDays.Name',
        hint: 'CALENDARIA.Settings.ForecastDays.Hint',
        scope: 'world',
        config: false,
        type: new NumberField({ initial: 7, min: 1, max: 30, integer: true })
      },
      [SETTINGS.WEATHER_INERTIA]: {
        name: 'CALENDARIA.Settings.WeatherInertia.Name',
        hint: 'CALENDARIA.Settings.WeatherInertia.Hint',
        scope: 'world',
        config: false,
        type: new NumberField({ initial: 0.3, min: 0, max: 1, step: 0.05 })
      },
      [SETTINGS.CUSTOM_WEATHER_PRESETS]: { name: 'Custom Weather Presets', scope: 'world', config: false, type: new ArrayField(new ObjectField()) },
      [SETTINGS.WEATHER_PRESET_ALIASES]: { name: 'Weather Preset Aliases', scope: 'world', config: false, type: new ObjectField({ initial: {} }) },
      [SETTINGS.WEATHER_FORECAST_PLAN]: { name: 'Weather Forecast Plan', scope: 'world', config: false, type: new ObjectField({ initial: {} }) },
      [SETTINGS.GM_OVERRIDE_CLEARS_FORECAST]: {
        name: 'CALENDARIA.Settings.GMOverrideClearsForecast.Name',
        hint: 'CALENDARIA.Settings.GMOverrideClearsForecast.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: true })
      },
      [SETTINGS.WEATHER_VISUAL_OVERRIDES]: { name: 'Weather Visual Overrides', scope: 'world', config: false, type: new ObjectField({ initial: {} }) },
      [SETTINGS.FXMASTER_TOP_DOWN]: {
        name: 'CALENDARIA.Settings.FXMaster.TopDown.Name',
        hint: 'CALENDARIA.Settings.FXMaster.TopDown.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.FXMASTER_BELOW_TOKENS]: {
        name: 'CALENDARIA.Settings.FXMaster.BelowTokens.Name',
        hint: 'CALENDARIA.Settings.FXMaster.BelowTokens.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.WEATHER_SOUND_FX]: {
        name: 'CALENDARIA.Settings.Weather.SoundFx.Name',
        hint: 'CALENDARIA.Settings.Weather.SoundFx.Hint',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false })
      },
      [SETTINGS.SAVED_TIMEPOINTS]: { name: 'Saved Timepoints', scope: 'world', config: false, type: new ArrayField(new ObjectField()) },
      [SETTINGS.MACRO_TRIGGERS]: {
        name: 'Macro Triggers',
        scope: 'world',
        config: false,
        type: new ObjectField({ initial: { global: { dawn: '', dusk: '', midday: '', midnight: '', newDay: '' }, season: [], moonPhase: [] } })
      },
      [SETTINGS.DEV_MODE]: {
        name: 'Dev Mode',
        scope: 'world',
        config: false,
        type: new BooleanField({ initial: false }),
        onChange: (enabled) => {
          if (enabled) StickyZones.showDebugZones();
          else StickyZones.hideDebugZones();
        }
      },
      [SETTINGS.LOGGING_LEVEL]: {
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
      }
    };
  }

  /** @returns {Object<string, object>} Settings menu registrations. */
  static get menus() {
    return {
      settingsPanel: {
        name: 'CALENDARIA.SettingsPanel.Title',
        hint: 'CALENDARIA.SettingsPanel.MenuHint',
        label: 'CALENDARIA.SettingsPanel.Title',
        icon: 'fas fa-cog',
        type: SettingsPanel,
        restricted: false
      },
      calendarEditor: {
        name: 'CALENDARIA.Settings.CalendarEditor.Name',
        hint: 'CALENDARIA.Settings.CalendarEditor.Hint',
        label: 'CALENDARIA.Settings.CalendarEditor.Label',
        icon: 'fas fa-calendar-plus',
        type: CalendarEditor,
        restricted: true
      },
      importer: {
        name: 'CALENDARIA.Settings.Importer.Name',
        hint: 'CALENDARIA.Settings.Importer.Hint',
        label: 'CALENDARIA.Settings.Importer.Label',
        icon: 'fas fa-file-import',
        type: ImporterApp,
        restricted: true
      }
    };
  }

  /** Register all module settings and menus with Foundry VTT. */
  static registerSettings() {
    for (const [key, config] of Object.entries(this.settings)) game.settings.register(MODULE.ID, key, config);
    for (const [key, config] of Object.entries(this.menus)) game.settings.registerMenu(MODULE.ID, key, config);
    log(3, 'Module settings registered.');
  }

  /** Register settings that require game.users to be available (called during ready hook). */
  static registerReadySettings() {
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
}
