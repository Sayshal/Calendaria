/**
 * Calendaria Module
 * System-agnostic calendar and time management for Foundry VTT.
 * @module Calendaria
 * @author Tyler
 */

import { registerSettings, registerReadySettings } from './scripts/settings.mjs';
import { registerHooks } from './scripts/hooks.mjs';
import { initializeLogger, log } from './scripts/utils/logger.mjs';
import { registerKeybindings, toggleCalendarVisibility } from './scripts/utils/keybinds.mjs';
import { CalendariaSocket } from './scripts/utils/socket.mjs';
import { CalendariaHUD } from './scripts/applications/calendaria-hud.mjs';
import { MODULE, SETTINGS, TEMPLATES, JOURNAL_TYPES, SHEET_IDS, HOOKS } from './scripts/constants.mjs';
import CalendarManager from './scripts/calendar/calendar-manager.mjs';
import CalendariaCalendar from './scripts/calendar/data/calendaria-calendar.mjs';
import NoteManager from './scripts/notes/note-manager.mjs';
import TimeTracker from './scripts/time/time-tracker.mjs';
import TimeKeeper from './scripts/time/time-keeper.mjs';
import EventScheduler from './scripts/time/event-scheduler.mjs';
import ReminderScheduler from './scripts/time/reminder-scheduler.mjs';
import { TimeKeeperHUD } from './scripts/applications/time-keeper-hud.mjs';
import { CalendarApplication } from './scripts/applications/calendar-application.mjs';
import { CompactCalendar } from './scripts/applications/compact-calendar.mjs';
import { CalendarNoteDataModel } from './scripts/sheets/calendar-note-data-model.mjs';
import { CalendarNoteSheet } from './scripts/sheets/calendar-note-sheet.mjs';
import { CalendariaAPI } from './scripts/api.mjs';
import { CalendarEditor } from './scripts/applications/calendar-editor.mjs';
import { ThemeEditor } from './scripts/applications/settings/theme-editor.mjs';
import WeatherManager from './scripts/weather/weather-manager.mjs';

Hooks.once('init', async () => {
  // Fire calendaria.init hook for other modules to prepare
  Hooks.callAll(HOOKS.INIT);
  registerSettings();
  initializeLogger();
  registerKeybindings();
  registerHooks();
  CalendariaSocket.initialize();

  // Register CalendarNote document type
  Object.assign(CONFIG.JournalEntryPage.dataModels, { [JOURNAL_TYPES.CALENDAR_NOTE]: CalendarNoteDataModel });

  // Initialize sheet classes
  CONFIG.JournalEntryPage.sheetClasses[JOURNAL_TYPES.CALENDAR_NOTE] = {};

  // Register CalendarNote sheet
  foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, SHEET_IDS.CALENDARIA, CalendarNoteSheet, {
    types: [JOURNAL_TYPES.CALENDAR_NOTE],
    makeDefault: true,
    label: 'Calendar Note'
  });

  log(3, 'Calendar note type and sheet registered');

  // Load templates
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
  // Register settings that require game.users
  registerReadySettings();

  // Initialize calendar system
  await CalendarManager.initialize();

  // Initialize notes system
  await NoteManager.initialize();

  // Initialize time tracking
  TimeTracker.initialize();

  // Initialize real-time clock controller
  TimeKeeper.initialize();

  // Initialize event scheduler
  EventScheduler.initialize();

  // Initialize reminder scheduler
  ReminderScheduler.initialize();

  // Initialize custom theme colors
  ThemeEditor.initialize();

  // Initialize weather system
  await WeatherManager.initialize();

  // Show TimeKeeper HUD if setting is enabled
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER)) {
    TimeKeeperHUD.show();
  }

  // Show Compact Calendar if auto-show is enabled
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_COMPACT_CALENDAR)) {
    CompactCalendar.show();
  }

  if (game.system.id === 'dnd5e') {
    const calendarConfig = game.settings.get('dnd5e', 'calendarConfig');
    if (calendarConfig?.enabled) {
      await game.settings.set('dnd5e', 'calendarConfig', { ...calendarConfig, enabled: false });
      await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, true);
    }
  }

  // Show Calendar HUD if auto-show is enabled
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD)) {
    CalendariaHUD.show();
  }

  // Fire calendaria.ready hook - module is fully initialized
  Hooks.callAll(HOOKS.READY, {
    api: CalendariaAPI,
    calendar: CalendarManager.getActiveCalendar(),
    version: game.modules.get('calendaria')?.version
  });

  log(3, 'Calendaria ready.');
});

Hooks.once('setup', () => {
  CONFIG.time.worldCalendarClass = CalendariaCalendar;
  log(3, 'Calendaria calendar class registered');
});

globalThis['CALENDARIA'] = {
  CalendariaHUD,
  CalendariaCalendar,
  CalendarManager,
  CalendariaSocket,
  NoteManager,
  CalendarApplication,
  CalendarEditor,
  CompactCalendar,
  ThemeEditor,
  TimeKeeper,
  TimeKeeperHUD,
  WeatherManager,
  toggleCalendarVisibility,
  api: CalendariaAPI
};
