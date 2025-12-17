/**
 * Calendaria Module
 * Calendar and time management system for D&D 5.2
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
import { TimeKeeperHUD } from './scripts/applications/time-keeper-hud.mjs';
import { CalendarApplication } from './scripts/applications/calendar-application.mjs';
import { CompactCalendar } from './scripts/applications/compact-calendar.mjs';
import { CalendarNoteDataModel } from './scripts/sheets/calendar-note-data-model.mjs';
import { CalendarNoteSheet } from './scripts/sheets/calendar-note-sheet.mjs';
import { CalendariaAPI } from './scripts/api.mjs';
import { RENESCARA_CALENDAR, RENESCARA_DEFAULT_DATE } from './scripts/calendar/data/renescara-calendar.mjs';
import { preLocalizeCalendar } from './scripts/calendar/calendar-utils.mjs';
import { CalendarEditor } from './scripts/applications/calendar-editor.mjs';
import { ThemeEditor } from './scripts/applications/settings/theme-editor.mjs';
import { getCalendarDefaults } from './scripts/calendar/data/calendar-defaults.mjs';
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

// Prelocalize calendar data after i18n is ready
Hooks.once('i18nInit', () => {
  preLocalizeCalendar(RENESCARA_CALENDAR);
  log(3, 'Prelocalized Renescara calendar data');
});

// Hook into D&D 5e's calendar setup to take over calendar system completely
Hooks.once('dnd5e.setupCalendar', () => {
  // Inject defaults (moons, seasons, eras) into 5e calendars
  for (const entry of CONFIG.DND5E.calendar.calendars) {
    const defaults = getCalendarDefaults(entry.value);
    if (defaults) {
      const configObj = entry.config.toObject?.() ?? entry.config;
      if (defaults.moons && !configObj.moons?.length) configObj.moons = defaults.moons;
      if (defaults.seasons && !configObj.seasons?.values?.length) configObj.seasons = defaults.seasons;
      if (defaults.eras && !configObj.eras?.length) configObj.eras = defaults.eras;
      entry.config = new CalendariaCalendar(configObj);
      entry.class = CalendariaCalendar;
      log(3, `Injected defaults into calendar: ${entry.value}`);
    }
  }

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

  // Initialize custom theme colors
  ThemeEditor.initialize();

  // Initialize weather system
  await WeatherManager.initialize();

  // Set initial world time if it's at 0 (new world)
  if (game.user.isGM && game.time.worldTime === 0) {
    log(3, 'Initializing world time to default Renescarran date...');

    // game.time.calendar should now be our Renescara calendar (set in setup hook)
    const worldTime = game.time.calendar.componentsToTime(RENESCARA_DEFAULT_DATE);
    await game.time.advance(worldTime);
  }

  // Show TimeKeeper HUD if setting is enabled
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER)) {
    TimeKeeperHUD.show();
  }

  // Show Compact Calendar if auto-show is enabled
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_COMPACT_CALENDAR)) {
    CompactCalendar.show();
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
  // For non-dnd5e systems, override game.time.calendar with our calendar
  if (!game.system.id.includes('dnd5e')) {
    log(3, 'Setting up Calendaria calendar for non-dnd5e system...');

    // Set the config as a plain object (not an instance) and our class
    CONFIG.time.worldCalendarConfig = RENESCARA_CALENDAR;
    CONFIG.time.worldCalendarClass = CalendariaCalendar;

    // Re-initialize the calendar with our config
    game.time.initializeCalendar();
    log(3, `Synced game.time.calendar to Renescara calendar`);
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
  CompactCalendar,
  ThemeEditor,
  TimeKeeper,
  TimeKeeperHUD,
  WeatherManager,
  toggleCalendarVisibility,
  api: CalendariaAPI
};
