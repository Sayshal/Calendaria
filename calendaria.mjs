/**
 * Calendaria Module
 * System-agnostic calendar and time management for Foundry VTT.
 * @module Calendaria
 * @author Tyler
 */

import './styles/theme.css';
import './styles/global.css';
import './styles/sun-dial.css';
import './styles/big-cal.css';
import './styles/note-sheet.css';
import './styles/calendar-editor.css';
import './styles/climate-editor.css';
import './styles/time-keeper.css';
import './styles/mini-cal.css';
import './styles/importer.css';
import './styles/weather.css';
import './styles/hud.css';
import './styles/chat.css';
import './styles/search.css';
import './styles/tooltips.css';
import './styles/settings.css';
import './styles/dialogs.css';
import { CalendariaAPI, createGlobalNamespace } from './scripts/api.mjs';
import { BigCal } from './scripts/applications/calendar/big-cal.mjs';
import { HUD } from './scripts/applications/hud/hud.mjs';
import { MiniCal } from './scripts/applications/calendar/mini-cal.mjs';
import { Stopwatch } from './scripts/applications/time/stopwatch.mjs';
import { SunDial } from './scripts/applications/time/sun-dial.mjs';
import { TimeKeeper } from './scripts/applications/time/time-keeper.mjs';
import CalendarManager from './scripts/calendar/calendar-manager.mjs';
import CalendariaCalendar from './scripts/data/calendaria-calendar.mjs';
import { overrideChatLogTimestamps } from './scripts/utils/chat/chat-timestamp.mjs';
import { checkReleaseMessage } from './scripts/utils/chat/release-message.mjs';
import { HOOKS, JOURNALS, MODULE, SETTINGS, SHEETS, TEMPLATES } from './scripts/constants.mjs';
import { registerHooks } from './scripts/hooks.mjs';
import { initializeImporters } from './scripts/importers/_module.mjs';
import { initializeChatCommander } from './scripts/integrations/chat-commander.mjs';
import { initializeFXMaster } from './scripts/integrations/fxmaster.mjs';
import NoteManager from './scripts/notes/note-manager.mjs';
import CalendariaSettings from './scripts/settings-handler.mjs';
import { CalendarNoteDataModel } from './scripts/data/calendar-note-data-model.mjs';
import { CalendarNoteSheet } from './scripts/applications/sheets/calendar-note-sheet.mjs';
import EventScheduler from './scripts/time/event-scheduler.mjs';
import ReminderScheduler from './scripts/time/reminder-scheduler.mjs';
import TimeClock from './scripts/time/time-clock.mjs';
import TimeTracker from './scripts/time/time-tracker.mjs';
import { registerKeybindings } from './scripts/utils/keybinds.mjs';
import { initializeLogger, log } from './scripts/utils/logger.mjs';
import { runAllMigrations } from './scripts/utils/migrations.mjs';
import { canViewMiniCal, canViewSunDial, canViewTimeKeeper } from './scripts/utils/permissions.mjs';
import { CalendariaSocket } from './scripts/utils/socket.mjs';
import * as StickyZones from './scripts/utils/ui/sticky-zones.mjs';
import { initializeTheme } from './scripts/utils/theme-utils.mjs';
import WeatherManager from './scripts/weather/weather-manager.mjs';
import { initializeWeatherSound } from './scripts/weather/weather-sound.mjs';

Hooks.once('init', async () => {
  createGlobalNamespace();
  Hooks.callAll(HOOKS.INIT);
  CalendariaSettings.registerSettings();
  initializeLogger();
  registerKeybindings();
  registerHooks();
  initializeImporters();
  overrideChatLogTimestamps();
  CalendariaSocket.initialize();
  Object.assign(CONFIG.JournalEntryPage.dataModels, { [JOURNALS.CALENDAR_NOTE]: CalendarNoteDataModel });
  CONFIG.JournalEntryPage.sheetClasses[JOURNALS.CALENDAR_NOTE] = {};
  foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, SHEETS.CALENDARIA, CalendarNoteSheet, { types: [JOURNALS.CALENDAR_NOTE], makeDefault: true, label: 'Calendar Note' });
  await foundry.applications.handlebars.loadTemplates(Object.values(TEMPLATES).flatMap((v) => (typeof v === 'string' ? v : Object.values(v))));
  log(3, 'Calendaria module initialized.');
});

Hooks.once('dnd5e.setupCalendar', () => {
  CONFIG.DND5E.calendar.application = null;
  CONFIG.DND5E.calendar.calendars = [];
  log(3, 'Disabling D&D 5e calendar system - Calendaria will handle calendars');
  return false;
});

Hooks.once('ready', async () => {
  CalendariaSettings.registerReadySettings();
  await CalendarManager.initialize();
  await runAllMigrations();
  await NoteManager.initialize();
  TimeTracker.initialize();
  TimeClock.initialize();
  EventScheduler.initialize();
  ReminderScheduler.initialize();
  initializeTheme();
  await WeatherManager.initialize();
  BigCal.updateIdleOpacity();
  TimeKeeper.updateIdleOpacity();
  HUD.updateIdleOpacity();
  MiniCal.updateIdleOpacity();
  SunDial.updateIdleOpacity();
  Stopwatch.updateIdleOpacity();
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER) && canViewTimeKeeper()) TimeKeeper.show({ silent: true });
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_SUN_DIAL) && canViewSunDial()) SunDial.show({ silent: true });
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_STOPWATCH)) Stopwatch.show();
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_BIG_CAL)) BigCal.show();
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_MINI_CAL)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_MINI_CAL, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_HUD)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_STOPWATCH)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_STOPWATCH, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_SUN_DIAL)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_SUN_DIAL, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_TIME_KEEPER)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER, true);
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_MINI_CAL) && canViewMiniCal()) MiniCal.show({ silent: true });
  if (game.system.id === 'dnd5e' && foundry.utils.isNewerVersion(game.system.version, '5.1.10')) {
    const calendarConfig = game.settings.get('dnd5e', 'calendarConfig');
    if (calendarConfig?.enabled) {
      await game.settings.set('dnd5e', 'calendarConfig', { ...calendarConfig, enabled: false });
      await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, true);
    }
  }
  if (game.pf2e?.worldClock && game.settings.get(MODULE.ID, SETTINGS.DARKNESS_SYNC)) {
    const systemId = game.system.id;
    const pf2eWorldClock = game.settings.get(systemId, 'worldClock');
    if (pf2eWorldClock?.syncDarkness) {
      await game.settings.set(systemId, 'worldClock', { ...pf2eWorldClock, syncDarkness: false });
      ui.notifications.warn('CALENDARIA.Notification.PF2eDarknessSyncDisabled', { localize: true });
    }
  }
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD)) HUD.show();
  if (game.settings.get(MODULE.ID, SETTINGS.DEV_MODE)) StickyZones.showDebugZones();
  Hooks.on('renderSceneControls', () => StickyZones.updateZonePositions('below-controls'));
  initializeChatCommander();
  initializeFXMaster();
  initializeWeatherSound();
  await checkReleaseMessage();
  Hooks.callAll(HOOKS.READY, { api: CalendariaAPI, calendar: CalendarManager.getActiveCalendar(), version: game.modules.get('calendaria')?.version });
});
Hooks.once('setup', () => {
  CONFIG.time.worldCalendarClass = CalendariaCalendar;
});
