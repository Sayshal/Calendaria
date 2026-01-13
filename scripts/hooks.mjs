/**
 * Calendaria Hook Registration
 * All hooks for the Calendaria module should be registered here.
 * @module Hooks
 * @author Tyler
 */

import { CalendariaHUD } from './applications/calendaria-hud.mjs';
import { MiniCalendar } from './applications/mini-calendar.mjs';
import CalendarManager from './calendar/calendar-manager.mjs';
import { onChatMessage } from './chat/chat-commands.mjs';
import { onPreCreateChatMessage, onRenderAnnouncementMessage, onRenderChatMessageHTML } from './chat/chat-timestamp.mjs';
import { HOOKS, MODULE, SETTINGS } from './constants.mjs';
import { onRenderSceneConfig, onUpdateScene, onUpdateWorldTime, onWeatherChange } from './darkness.mjs';
import { onLongRest, onPreRest } from './integrations/rest-time.mjs';
import NoteManager from './notes/note-manager.mjs';
import EventScheduler from './time/event-scheduler.mjs';
import ReminderScheduler from './time/reminder-scheduler.mjs';
import TimeTracker from './time/time-tracker.mjs';
import { onActivateDocumentDirectory } from './utils/journal-button.mjs';
import { localize } from './utils/localization.mjs';
import { log } from './utils/logger.mjs';

/**
 * Register all hooks for the Calendaria module.
 */
export function registerHooks() {
  Hooks.on('calendaria.calendarSwitched', NoteManager.onCalendarSwitched.bind(NoteManager));
  Hooks.on('chatMessage', onChatMessage);
  Hooks.on('closeGame', CalendarManager.onCloseGame.bind(CalendarManager));
  Hooks.on('createJournalEntryPage', NoteManager.onCreateJournalEntryPage.bind(NoteManager));
  Hooks.on('deleteJournalEntry', NoteManager.onDeleteJournalEntry.bind(NoteManager));
  Hooks.on('deleteJournalEntryPage', NoteManager.onDeleteJournalEntryPage.bind(NoteManager));
  Hooks.on('dnd5e.longRest', onLongRest);
  Hooks.on('dnd5e.preLongRest', onPreRest);
  Hooks.on('dnd5e.preShortRest', onPreRest);
  Hooks.on('preCreateChatMessage', onPreCreateChatMessage);
  Hooks.on('preDeleteFolder', NoteManager.onPreDeleteFolder.bind(NoteManager));
  Hooks.on('preDeleteJournalEntry', NoteManager.onPreDeleteJournalEntry.bind(NoteManager));
  Hooks.on('renderChatMessageHTML', onRenderAnnouncementMessage);
  Hooks.on('renderChatMessageHTML', onRenderChatMessageHTML);
  Hooks.on('activateDocumentDirectory', onActivateDocumentDirectory);
  Hooks.on('renderSceneConfig', onRenderSceneConfig);
  Hooks.on('updateJournalEntryPage', NoteManager.onUpdateJournalEntryPage.bind(NoteManager));
  Hooks.on('updateScene', onUpdateScene);
  Hooks.on('updateSetting', CalendarManager.onUpdateSetting.bind(CalendarManager));
  Hooks.on('updateWorldTime', EventScheduler.onUpdateWorldTime.bind(EventScheduler));
  Hooks.on('updateWorldTime', onUpdateWorldTime);
  Hooks.on('updateWorldTime', ReminderScheduler.onUpdateWorldTime.bind(ReminderScheduler));
  Hooks.on('updateWorldTime', TimeTracker.onUpdateWorldTime.bind(TimeTracker));
  Hooks.on('getSceneControlButtons', onGetSceneControlButtons);
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  CalendariaHUD.registerCombatHooks();
  log(3, 'Hooks registered');
}

/**
 * Add Calendaria button to scene controls.
 * @param {object} controls - Scene controls object (V13 style)
 */
function onGetSceneControlButtons(controls) {
  if (!controls.notes?.tools) return;
  if (!game.settings.get(MODULE.ID, SETTINGS.SHOW_TOOLBAR_BUTTON)) return;
  controls.notes.tools.calendaria = {
    name: 'calendaria',
    title: localize('CALENDARIA.SceneControl.OpenCalendar'),
    icon: 'fas fa-calendar-days',
    visible: true,
    onChange: () => MiniCalendar.toggle(),
    button: true
  };
}
