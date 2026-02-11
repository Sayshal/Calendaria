/**
 * Calendaria Module
 * System-agnostic calendar and time management for Foundry VTT.
 * @module Calendaria
 * @author Tyler
 */

import { CalendariaAPI } from './scripts/api.mjs';
import { BigCal } from './scripts/applications/big-cal.mjs';
import { CalendarEditor } from './scripts/applications/calendar-editor.mjs';
import { HUD } from './scripts/applications/hud.mjs';
import { MiniCal } from './scripts/applications/mini-cal.mjs';
import { Stopwatch } from './scripts/applications/stopwatch.mjs';
import { TimeKeeper } from './scripts/applications/time-keeper.mjs';
import CalendarManager from './scripts/calendar/calendar-manager.mjs';
import CalendariaCalendar from './scripts/calendar/data/calendaria-calendar.mjs';
import { overrideChatLogTimestamps } from './scripts/chat/chat-timestamp.mjs';
import { HOOKS, JOURNALS, MODULE, SETTINGS, SHEETS, TEMPLATES } from './scripts/constants.mjs';
import { registerHooks } from './scripts/hooks.mjs';
import { initializeImporters } from './scripts/importers/index.mjs';
import { initializeChatCommander } from './scripts/integrations/chat-commander.mjs';
import NoteManager from './scripts/notes/note-manager.mjs';
import { registerReadySettings, registerSettings } from './scripts/settings.mjs';
import { CalendarNoteDataModel } from './scripts/sheets/calendar-note-data-model.mjs';
import { CalendarNoteSheet } from './scripts/sheets/calendar-note-sheet.mjs';
import EventScheduler from './scripts/time/event-scheduler.mjs';
import ReminderScheduler from './scripts/time/reminder-scheduler.mjs';
import TimeClock from './scripts/time/time-clock.mjs';
import TimeTracker from './scripts/time/time-tracker.mjs';
import { registerKeybindings } from './scripts/utils/keybinds.mjs';
import { initializeLogger, log } from './scripts/utils/logger.mjs';
import { runAllMigrations } from './scripts/utils/migrations.mjs';
import * as Permissions from './scripts/utils/permissions.mjs';
import { CalendariaSocket } from './scripts/utils/socket.mjs';
import * as StickyZones from './scripts/utils/sticky-zones.mjs';
import { initializeTheme } from './scripts/utils/theme-utils.mjs';
import WeatherManager from './scripts/weather/weather-manager.mjs';

const { canViewMiniCal, canViewTimeKeeper } = Permissions;

Hooks.once('init', async () => {
  Hooks.callAll(HOOKS.INIT);
  registerSettings();
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
  registerReadySettings();
  await CalendarManager.initialize();
  await runAllMigrations();
  await NoteManager.initialize();
  TimeTracker.initialize();
  TimeClock.initialize();
  EventScheduler.initialize();
  ReminderScheduler.initialize();
  initializeTheme();
  await WeatherManager.initialize();
  TimeKeeper.updateIdleOpacity();
  HUD.updateIdleOpacity();
  MiniCal.updateIdleOpacity();
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER) && canViewTimeKeeper()) TimeKeeper.show({ silent: true });
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_MINI_CAL)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_MINI_CAL, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_HUD)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, true);
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_MINI_CAL) && canViewMiniCal()) MiniCal.show({ silent: true });
  if (game.system.id === 'dnd5e' && foundry.utils.isNewerVersion(game.system.version, '5.1.10')) {
    const calendarConfig = game.settings.get('dnd5e', 'calendarConfig');
    if (calendarConfig?.enabled) {
      await game.settings.set('dnd5e', 'calendarConfig', { ...calendarConfig, enabled: false });
      await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, true);
    }
  }
  // Disable PF2e world clock darkness sync if Calendaria darkness sync is enabled
  if (game.pf2e?.worldClock && game.settings.get(MODULE.ID, SETTINGS.DARKNESS_SYNC)) {
    const pf2eWorldClock = game.settings.get('pf2e', 'worldClock');
    if (pf2eWorldClock?.syncDarkness) {
      await game.settings.set('pf2e', 'worldClock', { ...pf2eWorldClock, syncDarkness: false });
      ui.notifications.warn('CALENDARIA.Notification.PF2eDarknessSyncDisabled', { localize: true });
    }
  }
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD)) HUD.show();
  if (game.settings.get(MODULE.ID, SETTINGS.DEV_MODE)) StickyZones.showDebugZones();
  Hooks.on('renderSceneControls', () => StickyZones.updateZonePositions('below-controls'));
  initializeChatCommander();
  Hooks.callAll(HOOKS.READY, { api: CalendariaAPI, calendar: CalendarManager.getActiveCalendar(), version: game.modules.get('calendaria')?.version });
});
Hooks.once('setup', () => {
  CONFIG.time.worldCalendarClass = CalendariaCalendar;
});

globalThis['CALENDARIA'] = {
  HUD,
  CalendariaCalendar,
  CalendarManager,
  CalendariaSocket,
  NoteManager,
  BigCal,
  CalendarEditor,
  MiniCal,
  Stopwatch,
  TimeClock,
  TimeKeeper,
  WeatherManager,
  api: CalendariaAPI,
  ...Permissions
};
