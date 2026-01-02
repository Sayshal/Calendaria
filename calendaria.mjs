/**
 * Calendaria Module
 * System-agnostic calendar and time management for Foundry VTT.
 * @module Calendaria
 * @author Tyler
 */

import { CalendariaAPI } from './scripts/api.mjs';
import { CalendarApplication } from './scripts/applications/calendar-application.mjs';
import { CalendarEditor } from './scripts/applications/calendar-editor.mjs';
import { CalendariaHUD } from './scripts/applications/calendaria-hud.mjs';
import { MiniCalendar } from './scripts/applications/mini-calendar.mjs';
import { TimeKeeperHUD } from './scripts/applications/time-keeper-hud.mjs';
import CalendarManager from './scripts/calendar/calendar-manager.mjs';
import CalendariaCalendar from './scripts/calendar/data/calendaria-calendar.mjs';
import { overrideChatLogTimestamps } from './scripts/chat/chat-timestamp.mjs';
import { HOOKS, JOURNALS, MODULE, SETTINGS, SHEETS, TEMPLATES } from './scripts/constants.mjs';
import { registerHooks } from './scripts/hooks.mjs';
import { initializeImporters } from './scripts/importers/index.mjs';
import NoteManager from './scripts/notes/note-manager.mjs';
import { registerReadySettings, registerSettings } from './scripts/settings.mjs';
import { CalendarNoteDataModel } from './scripts/sheets/calendar-note-data-model.mjs';
import { CalendarNoteSheet } from './scripts/sheets/calendar-note-sheet.mjs';
import EventScheduler from './scripts/time/event-scheduler.mjs';
import ReminderScheduler from './scripts/time/reminder-scheduler.mjs';
import TimeKeeper from './scripts/time/time-keeper.mjs';
import TimeTracker from './scripts/time/time-tracker.mjs';
import { registerKeybindings, toggleCalendarVisibility } from './scripts/utils/keybinds.mjs';
import { initializeLogger, log } from './scripts/utils/logger.mjs';
import { CalendariaSocket } from './scripts/utils/socket.mjs';
import { initializeTheme } from './scripts/utils/theme-utils.mjs';
import { migrateCustomCalendars } from './scripts/utils/format-utils.mjs';
import WeatherManager from './scripts/weather/weather-manager.mjs';

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
  await migrateCustomCalendars();
  await NoteManager.initialize();
  TimeTracker.initialize();
  TimeKeeper.initialize();
  EventScheduler.initialize();
  ReminderScheduler.initialize();
  initializeTheme();
  await WeatherManager.initialize();
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER)) TimeKeeperHUD.show();
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_MINI_CALENDAR)) MiniCalendar.show();
  if (game.system.id === 'dnd5e') {
    const calendarConfig = game.settings.get('dnd5e', 'calendarConfig');
    if (calendarConfig?.enabled) {
      await game.settings.set('dnd5e', 'calendarConfig', { ...calendarConfig, enabled: false });
      await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, true);
    }
  }
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD)) CalendariaHUD.show();

  Hooks.callAll(HOOKS.READY, { api: CalendariaAPI, calendar: CalendarManager.getActiveCalendar(), version: game.modules.get('calendaria')?.version });
});

Hooks.once('setup', () => {
  CONFIG.time.worldCalendarClass = CalendariaCalendar;
});

globalThis['CALENDARIA'] = {
  CalendariaHUD,
  CalendariaCalendar,
  CalendarManager,
  CalendariaSocket,
  NoteManager,
  CalendarApplication,
  CalendarEditor,
  MiniCalendar,
  TimeKeeper,
  TimeKeeperHUD,
  WeatherManager,
  toggleCalendarVisibility,
  api: CalendariaAPI
};
