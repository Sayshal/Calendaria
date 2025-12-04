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
import { CalendariaHUD } from './scripts/applications/calendaria-hud.mjs';
import { TEMPLATES } from './scripts/constants.mjs';
import CalendarManager from './scripts/calendar/calendar-manager.mjs';
import CalendariaCalendar from './scripts/calendar/data/calendaria-calendar.mjs';
import NoteManager from './scripts/notes/note-manager.mjs';
import { CalendarApplication } from './scripts/applications/calendar-application.mjs';
import { CalendarNoteDataModel } from './scripts/sheets/calendar-note-data-model.mjs';
import { CalendarNoteSheet } from './scripts/sheets/calendar-note-sheet.mjs';

Hooks.once('init', async () => {
  registerSettings();
  initializeLogger();
  registerKeybindings();
  registerHooks();

  // Register CalendarNote document type
  Object.assign(CONFIG.JournalEntryPage.dataModels, { 'calendaria.calendarnote': CalendarNoteDataModel });

  // Initialize sheet classes
  CONFIG.JournalEntryPage.sheetClasses['calendaria.calendarnote'] = {};

  // Register CalendarNote sheet
  foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, 'calendaria', CalendarNoteSheet, {
    types: ['calendaria.calendarnote'],
    makeDefault: true,
    label: 'Calendar Note'
  });

  log(3, 'Calendar note type and sheet registered');

  // Load templates
  await foundry.applications.handlebars.loadTemplates(Object.values(TEMPLATES).flatMap((v) => (typeof v === 'string' ? v : Object.values(v))));

  log(3, 'Calendaria module initialized.');
});

Hooks.once('ready', async () => {
  // Initialize calendar system
  await CalendarManager.initialize();

  // Initialize notes system
  await NoteManager.initialize();

  log(3, 'Calendaria ready.');
});

Hooks.once('setup', () => {
  if (CONFIG.DND5E?.calendar) {
    log(3, 'Replacing D&D 5e calendar with CalendariaHUD');
    CONFIG.DND5E.calendar.application = CalendariaHUD;
  }
});

globalThis['CALENDARIA'] = {
  CalendariaHUD,
  CalendariaCalendar,
  CalendarManager,
  NoteManager,
  CalendarApplication,
  toggleCalendarVisibility
};
