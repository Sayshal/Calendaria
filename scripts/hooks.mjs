/**
 * Calendaria Hook Registration
 * All hooks for the Calendaria module should be registered here.
 * @module Hooks
 * @author Tyler
 */

import { BigCal } from './applications/big-cal.mjs';
import { HUD } from './applications/hud.mjs';
import { MiniCal } from './applications/mini-cal.mjs';
import { Stopwatch } from './applications/stopwatch.mjs';
import { TimeKeeper } from './applications/time-keeper.mjs';
import CalendarManager from './calendar/calendar-manager.mjs';
import { onChatMessage } from './chat/chat-commands.mjs';
import { onPreCreateChatMessage, onRenderAnnouncementMessage, onRenderChatMessageHTML } from './chat/chat-timestamp.mjs';
import { HOOKS, MODULE, SETTINGS } from './constants.mjs';
import { onRenderSceneConfig, onUpdateScene, onWeatherChange, updateDarknessFromWorldTime } from './darkness.mjs';
import { onLongRest, onPreRest } from './integrations/rest-time.mjs';
import NoteManager from './notes/note-manager.mjs';
import EventScheduler from './time/event-scheduler.mjs';
import ReminderScheduler from './time/reminder-scheduler.mjs';
import TimeTracker from './time/time-tracker.mjs';
import { onRenderDocumentDirectory } from './utils/journal-button.mjs';
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
  Hooks.on('renderDocumentDirectory', onRenderDocumentDirectory);
  Hooks.on('renderSceneConfig', onRenderSceneConfig);
  Hooks.on('updateJournalEntryPage', NoteManager.onUpdateJournalEntryPage.bind(NoteManager));
  Hooks.on('updateScene', onUpdateScene);
  Hooks.on('updateSetting', CalendarManager.onUpdateSetting.bind(CalendarManager));
  Hooks.on('updateWorldTime', onUpdateWorldTime);
  Hooks.on('getSceneControlButtons', onGetSceneControlButtons);
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.once('ready', () => Stopwatch.restore());
  HUD.registerCombatHooks();
  log(3, 'Hooks registered');
}

/**
 * Unified updateWorldTime handler — calls all subsystems in sequence,
 * then fires calendaria.worldTimeUpdated for UI apps.
 * @param {number} worldTime - The new world time
 * @param {number} dt - The delta time in seconds
 */
function onUpdateWorldTime(worldTime, dt) {
  EventScheduler.onUpdateWorldTime(worldTime, dt);
  updateDarknessFromWorldTime(worldTime, dt);
  ReminderScheduler.onUpdateWorldTime(worldTime, dt);
  TimeTracker.onUpdateWorldTime(worldTime, dt);
  Hooks.callAll(HOOKS.WORLD_TIME_UPDATED, worldTime, dt);
}

/** App definitions for toolbar buttons. */
const TOOLBAR_APP_DEFS = {
  bigcal: { icon: 'fa-calendar-days', label: 'CALENDARIA.SettingsPanel.Tab.BigCal', toggle: () => BigCal.toggle() },
  minical: { icon: 'fa-compress', label: 'CALENDARIA.SettingsPanel.Tab.MiniCal', toggle: () => MiniCal.toggle() },
  hud: { icon: 'fa-sun', label: 'CALENDARIA.SettingsPanel.Tab.HUD', toggle: () => HUD.toggle() },
  timekeeper: { icon: 'fa-gauge', label: 'CALENDARIA.SettingsPanel.Tab.TimeKeeper', toggle: () => TimeKeeper.toggle() },
  stopwatch: { icon: 'fa-stopwatch', label: 'CALENDARIA.SettingsPanel.Tab.Stopwatch', toggle: () => Stopwatch.toggle() }
};

/**
 * Add Calendaria buttons to scene controls.
 * @param {object} controls - Scene controls object (V13 style)
 */
function onGetSceneControlButtons(controls) {
  if (!controls.notes?.tools) return;
  if (!game.settings.get(MODULE.ID, SETTINGS.SHOW_TOOLBAR_BUTTON)) return;
  const toolbarApps = game.settings.get(MODULE.ID, SETTINGS.TOOLBAR_APPS);
  for (const appId of toolbarApps) {
    const def = TOOLBAR_APP_DEFS[appId];
    if (!def) continue;
    controls.notes.tools[`calendaria-${appId}`] = { name: `calendaria-${appId}`, title: localize(def.label), icon: `fas ${def.icon}`, visible: true, onChange: def.toggle, button: true };
  }
}
