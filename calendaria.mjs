/**
 * Calendaria Module
 * Calendar and time management system for D&D 5.2
 * @module Calendaria
 * @author Tyler
 */

import { registerSettings } from './scripts/settings.mjs';
import { registerHooks } from './scripts/hooks.mjs';
import { initializeLogger, log } from './scripts/utils/logger.mjs';
import { registerKeybindings, toggleCalendarVisibility } from './scripts/utils/keybinds.mjs';
import { CalendariaSocket } from './scripts/utils/socket.mjs';
import { CalendariaHUD } from './scripts/applications/calendaria-hud.mjs';
import { TEMPLATES, JOURNAL_TYPES, SHEET_IDS } from './scripts/constants.mjs';
import CalendarManager from './scripts/calendar/calendar-manager.mjs';
import CalendariaCalendar from './scripts/calendar/data/calendaria-calendar.mjs';
import NoteManager from './scripts/notes/note-manager.mjs';
import TimeTracker from './scripts/time/time-tracker.mjs';
import { CalendarApplication } from './scripts/applications/calendar-application.mjs';
import { CalendarNoteDataModel } from './scripts/sheets/calendar-note-data-model.mjs';
import { CalendarNoteSheet } from './scripts/sheets/calendar-note-sheet.mjs';
import { CalendariaAPI } from './scripts/api.mjs';
import { RENESCARA_CALENDAR, RENESCARA_DEFAULT_DATE } from './scripts/calendar/data/renescara-calendar.mjs';
import { preLocalizeCalendar } from './scripts/calendar/calendar-utils.mjs';
import { CalendarEditor } from './scripts/applications/calendar-editor.mjs';

Hooks.once('init', async () => {
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

// Prelocalize calendar data after i18n is ready
Hooks.once('i18nInit', () => {
  preLocalizeCalendar(RENESCARA_CALENDAR);
  log(3, 'Prelocalized Renescara calendar data');
});

// Hook into D&D 5e's calendar setup to take over calendar system completely
Hooks.once('dnd5e.setupCalendar', () => {
  // Create CalendariaCalendar instances for all calendars
  const renescaraCalendar = new CalendariaCalendar(RENESCARA_CALENDAR);

  // Add Renescara to dnd5e's calendar list with our class
  CONFIG.DND5E.calendar.calendars.push({
    value: 'renescara',
    label: 'CALENDARIA.Calendar.RENESCARA.Name',
    config: renescaraCalendar,
    class: CalendariaCalendar
  });

  // Load any custom calendars from settings and add them to the list
  try {
    const customCalendars = game.settings.get('calendaria', 'customCalendars') || {};
    for (const [id, calendarData] of Object.entries(customCalendars)) {
      const calendar = new CalendariaCalendar(calendarData);
      CONFIG.DND5E.calendar.calendars.push({
        value: id,
        label: calendarData.name || id,
        config: calendar,
        class: CalendariaCalendar
      });
      log(3, `Added custom calendar "${id}" to D&D 5e calendar selection`);
    }
  } catch (e) {
    // Setting may not exist yet on first load
    log(3, 'No custom calendars found');
  }

  // Get the currently selected calendar from dnd5e settings
  const selectedCalendarId = game.settings.get('dnd5e', 'calendar');
  const calendarEntry = CONFIG.DND5E.calendar.calendars.find((c) => c.value === selectedCalendarId);

  // Set up CONFIG.time with CalendariaCalendar class
  CONFIG.time.worldCalendarClass = CalendariaCalendar;
  CONFIG.time.worldCalendarConfig = calendarEntry?.config?.toObject?.() ?? calendarEntry?.config ?? renescaraCalendar.toObject();

  log(3, `Calendaria taking over calendar system with: ${selectedCalendarId || 'renescara'}`);

  // Return false to prevent dnd5e from overwriting our setup
  return false;
});

Hooks.once('ready', async () => {
  // Initialize calendar system
  await CalendarManager.initialize();

  // Initialize notes system
  await NoteManager.initialize();

  // Initialize time tracking
  TimeTracker.initialize();

  // Set initial world time if it's at 0 (new world)
  if (game.user.isGM && game.time.worldTime === 0) {
    log(3, 'Initializing world time to default Renescarran date...');

    // Convert to world time and advance by that amount
    const worldTime = game.time.calendar.componentsToTime(RENESCARA_DEFAULT_DATE);
    await game.time.advance(worldTime);
  }

  log(3, 'Calendaria ready.');
});

Hooks.once('setup', () => {
  // For non-dnd5e systems, set Renescarran Calendar as the world calendar
  if (!game.system.id.includes('dnd5e')) {
    const renescaraCalendar = new CalendariaCalendar(RENESCARA_CALENDAR);
    CONFIG.time.worldCalendarConfig = renescaraCalendar;
    CONFIG.time.worldCalendarClass = CalendariaCalendar;
    log(3, 'Set Renescarran Calendar as world calendar');
  }

  if (CONFIG.DND5E?.calendar) {
    log(3, 'Replacing D&D 5e calendar with CalendariaHUD');
    CONFIG.DND5E.calendar.application = CalendariaHUD;
  }
});

globalThis['CALENDARIA'] = {
  CalendariaHUD,
  CalendariaCalendar,
  CalendarManager,
  CalendariaSocket,
  NoteManager,
  CalendarApplication,
  CalendarEditor,
  toggleCalendarVisibility,
  api: CalendariaAPI
};
