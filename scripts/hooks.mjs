/**
 * Calendaria Hook Registration
 * All hooks for the Calendaria module should be registered here.
 * @module Hooks
 * @author Tyler
 */

import CalendarManager from './calendar/calendar-manager.mjs';
import { onPreCreateChatMessage, onRenderAnnouncementMessage, onRenderChatMessageHTML } from './chat/chat-timestamp.mjs';
import { onRenderSceneConfig, onUpdateWorldTime } from './darkness.mjs';
import { onUpdateCombat } from './integrations/combat-time.mjs';
import { onLongRest, onPreRest } from './integrations/rest-time.mjs';
import NoteManager from './notes/note-manager.mjs';
import EventScheduler from './time/event-scheduler.mjs';
import ReminderScheduler from './time/reminder-scheduler.mjs';
import TimeTracker from './time/time-tracker.mjs';
import { onRenderJournalDirectory } from './utils/journal-button.mjs';
import { log } from './utils/logger.mjs';

/**
 * Register all hooks for the Calendaria module.
 */
export function registerHooks() {
  Hooks.on('calendaria.calendarSwitched', NoteManager.onCalendarSwitched.bind(NoteManager));
  Hooks.on('closeGame', CalendarManager.onCloseGame.bind(CalendarManager));
  Hooks.on('createJournalEntryPage', NoteManager.onCreateJournalEntryPage.bind(NoteManager));
  Hooks.on('deleteJournalEntryPage', NoteManager.onDeleteJournalEntryPage.bind(NoteManager));
  Hooks.on('dnd5e.longRest', onLongRest);
  Hooks.on('dnd5e.preLongRest', onPreRest);
  Hooks.on('dnd5e.preShortRest', onPreRest);
  Hooks.on('preCreateChatMessage', onPreCreateChatMessage);
  Hooks.on('preDeleteFolder', NoteManager.onPreDeleteFolder.bind(NoteManager));
  Hooks.on('preDeleteJournalEntry', NoteManager.onPreDeleteJournalEntry.bind(NoteManager));
  Hooks.on('renderChatMessageHTML', onRenderAnnouncementMessage);
  Hooks.on('renderChatMessageHTML', onRenderChatMessageHTML);
  Hooks.on('renderJournalDirectory', onRenderJournalDirectory);
  Hooks.on('renderSceneConfig', onRenderSceneConfig);
  Hooks.on('updateCombat', onUpdateCombat);
  Hooks.on('updateJournalEntryPage', NoteManager.onUpdateJournalEntryPage.bind(NoteManager));
  Hooks.on('updateSetting', CalendarManager.onUpdateSetting.bind(CalendarManager));
  Hooks.on('updateWorldTime', EventScheduler.onUpdateWorldTime.bind(EventScheduler));
  Hooks.on('updateWorldTime', onUpdateWorldTime);
  Hooks.on('updateWorldTime', ReminderScheduler.onUpdateWorldTime.bind(ReminderScheduler));
  Hooks.on('updateWorldTime', TimeTracker.onUpdateWorldTime.bind(TimeTracker));
  log(3, 'Hooks registered');
}
