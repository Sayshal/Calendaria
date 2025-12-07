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
import { CalendarApplication } from './applications/calendar-application.mjs';

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

  // Journal sidebar button
  Hooks.on('renderJournalDirectory', addJournalCalendarButton);

  log(3, 'Hooks registered');
}

/* -------------------------------------------- */

/**
 * Add Calendar button to journal sidebar footer.
 * @param {Application} app - The journal sidebar application
 * @returns {void}
 */
function addJournalCalendarButton(app) {
  if (SYSTEM.isDnd5e) return;
  const footer = app.element.querySelector('.directory-footer');
  if (!footer) return;

  // Check if already added
  if (footer.querySelector('.calendaria-open-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'calendaria-open-button';
  button.innerHTML = `<i class="fas fa-calendar-days"></i> ${game.i18n.localize('CALENDARIA.HUD.OpenCalendar')}`;
  button.addEventListener('click', () => new CalendarApplication().render(true));

  footer.appendChild(button);
  log(3, 'Journal calendar button added');
}
