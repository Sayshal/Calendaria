/**
 * Calendaria Hook Registration
 * All hooks for the Calendaria module should be registered here.
 * @module Hooks
 * @author Tyler
 */

import { SYSTEM } from './constants.mjs';
import { log } from './utils/logger.mjs';
import { onRenderSceneConfig, onUpdateWorldTime } from './darkness.mjs';
import CalendarManager from './calendar/calendar-manager.mjs';
import NoteManager from './notes/note-manager.mjs';
import TimeTracker from './time/time-tracker.mjs';

/**
 * Register all hooks for the Calendaria module.
 * @returns {void}
 */
export function registerHooks() {
  // Darkness hooks
  Hooks.on('renderSceneConfig', onRenderSceneConfig);
  Hooks.on('updateWorldTime', onUpdateWorldTime);

  // Time tracking hooks
  Hooks.on('updateWorldTime', TimeTracker.onUpdateWorldTime.bind(TimeTracker));

  // Calendar Manager hooks
  if (SYSTEM.isDnd5e) Hooks.on('updateSetting', CalendarManager.onUpdateSetting.bind(CalendarManager));
  if (!SYSTEM.isDnd5e) Hooks.on('closeGame', CalendarManager.onCloseGame.bind(CalendarManager));

  // Note Manager hooks
  Hooks.on('createJournalEntryPage', NoteManager.onCreateJournalEntryPage.bind(NoteManager));
  Hooks.on('updateJournalEntryPage', NoteManager.onUpdateJournalEntryPage.bind(NoteManager));
  Hooks.on('deleteJournalEntryPage', NoteManager.onDeleteJournalEntryPage.bind(NoteManager));
  Hooks.on('calendaria.calendarSwitched', NoteManager.onCalendarSwitched.bind(NoteManager));
  Hooks.on('preDeleteJournalEntry', NoteManager.onPreDeleteJournalEntry.bind(NoteManager));
  Hooks.on('preDeleteFolder', NoteManager.onPreDeleteFolder.bind(NoteManager));

  log(3, 'Hooks registered');
}
