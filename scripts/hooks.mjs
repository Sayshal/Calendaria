/**
 * Calendaria Hook Registration
 * @module Hooks
 * @author Tyler
 */

import { HUD } from './applications/hud/hud.mjs';
import { Stopwatch } from './applications/time/stopwatch.mjs';
import CalendarManager from './calendar/calendar-manager.mjs';
import { HOOKS } from './constants.mjs';
import { onLongRest, onPreRest } from './integrations/rest-time.mjs';
import NoteManager from './notes/note-manager.mjs';
import { onMoonPhaseChange, onRenderSceneConfig, onUpdateScene, onWeatherChange } from './time/darkness.mjs';
import TimeClock from './time/time-clock.mjs';
import { onChatMessage } from './utils/chat/chat-commands.mjs';
import { onPreCreateChatMessage, onRenderAnnouncementMessage, onRenderChatMessageHTML } from './utils/chat/chat-timestamp.mjs';
import { log } from './utils/logger.mjs';
import { onRenderDocumentDirectory } from './utils/ui/journal-button.mjs';
import { onGetSceneControlButtons } from './utils/ui/toolbar-buttons.mjs';

/**
 * Register all hooks for the Calendaria module.
 */
export function registerHooks() {
  Hooks.on('calendaria.calendarSwitched', NoteManager.onCalendarSwitched.bind(NoteManager));
  Hooks.on('chatMessage', onChatMessage);
  Hooks.on('closeGame', CalendarManager.onCloseGame.bind(CalendarManager));
  Hooks.on('combatRound', TimeClock.onCombatTimeBlock);
  Hooks.on('combatTurn', TimeClock.onCombatTimeBlock);
  Hooks.on('createJournalEntryPage', NoteManager.onCreateJournalEntryPage.bind(NoteManager));
  Hooks.on('deleteJournalEntry', NoteManager.onDeleteJournalEntry.bind(NoteManager));
  Hooks.on('deleteJournalEntryPage', NoteManager.onDeleteJournalEntryPage.bind(NoteManager));
  Hooks.on('dnd5e.longRest', onLongRest);
  Hooks.on('dnd5e.preLongRest', onPreRest);
  Hooks.on('dnd5e.preShortRest', onPreRest);
  Hooks.on('getSceneControlButtons', onGetSceneControlButtons);
  Hooks.on('preCreateChatMessage', onPreCreateChatMessage);
  Hooks.on('preDeleteFolder', NoteManager.onPreDeleteFolder.bind(NoteManager));
  Hooks.on('preDeleteJournalEntry', NoteManager.onPreDeleteJournalEntry.bind(NoteManager));
  Hooks.on('renderChatMessageHTML', onRenderAnnouncementMessage);
  Hooks.on('renderChatMessageHTML', onRenderChatMessageHTML);
  Hooks.on('renderDocumentDirectory', onRenderDocumentDirectory);
  Hooks.on('renderSceneConfig', onRenderSceneConfig);
  Hooks.on('updateJournalEntryPage', NoteManager.onUpdateJournalEntryPage.bind(NoteManager));
  Hooks.on('updateScene', onUpdateScene);
  Hooks.on('updateSetting', CalendarManager.onUpdateSetting.bind(CalendarManager));
  Hooks.on('updateWorldTime', TimeClock.onUpdateWorldTime);
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.on(HOOKS.MOON_PHASE_CHANGE, onMoonPhaseChange);
  Hooks.once('ready', () => Stopwatch.restore());
  HUD.registerCombatHooks();
  log(3, 'Hooks registered');
}
