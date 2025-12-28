/**
 * Calendaria Hook Registration
 * All hooks for the Calendaria module should be registered here.
 * @module Hooks
 * @author Tyler
 */

import { CalendarApplication } from './applications/calendar-application.mjs';
import { initializeImporters } from './importers/index.mjs';
import { localize } from './utils/localization.mjs';
import { log } from './utils/logger.mjs';
import { MODULE, SETTINGS } from './constants.mjs';
import { onRenderSceneConfig, onUpdateWorldTime } from './darkness.mjs';
import { registerRestTimeHooks } from './integrations/rest-time.mjs';
import CalendarManager from './calendar/calendar-manager.mjs';
import EventScheduler from './time/event-scheduler.mjs';
import NoteManager from './notes/note-manager.mjs';
import ReminderScheduler from './time/reminder-scheduler.mjs';
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

  // Event scheduler hooks (triggers notifications when time reaches note start dates)
  Hooks.on('updateWorldTime', EventScheduler.onUpdateWorldTime.bind(EventScheduler));

  // Reminder scheduler hooks (triggers pre-event reminders based on offset)
  Hooks.on('updateWorldTime', ReminderScheduler.onUpdateWorldTime.bind(ReminderScheduler));

  // Calendar Manager hooks
  Hooks.on('updateSetting', CalendarManager.onUpdateSetting.bind(CalendarManager));
  Hooks.on('closeGame', CalendarManager.onCloseGame.bind(CalendarManager));

  // Note Manager hooks
  Hooks.on('createJournalEntryPage', NoteManager.onCreateJournalEntryPage.bind(NoteManager));
  Hooks.on('updateJournalEntryPage', NoteManager.onUpdateJournalEntryPage.bind(NoteManager));
  Hooks.on('deleteJournalEntryPage', NoteManager.onDeleteJournalEntryPage.bind(NoteManager));
  Hooks.on('calendaria.calendarSwitched', NoteManager.onCalendarSwitched.bind(NoteManager));
  Hooks.on('preDeleteJournalEntry', NoteManager.onPreDeleteJournalEntry.bind(NoteManager));
  Hooks.on('preDeleteFolder', NoteManager.onPreDeleteFolder.bind(NoteManager));

  // Journal sidebar button
  Hooks.on('renderJournalDirectory', addJournalCalendarButton);

  // Chat message hooks (for announcement click handlers)
  Hooks.on('renderChatMessageHTML', onRenderChatMessage);

  // System integrations
  registerRestTimeHooks();

  // Combat time advancement
  Hooks.on('updateCombat', onUpdateCombat);

  // Initialize importer registry
  initializeImporters();

  log(3, 'Hooks registered');
}

/* -------------------------------------------- */

/**
 * Add Calendar button to journal sidebar footer.
 * @param {Application} app - The journal sidebar application
 * @returns {void}
 */
function addJournalCalendarButton(app) {
  const footer = app.element.querySelector('.directory-footer');
  if (!footer) return;

  // Check if already added
  if (footer.querySelector('.calendaria-open-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'calendaria-open-button';
  button.innerHTML = `<i class="fas fa-calendar-days"></i> ${localize('CALENDARIA.HUD.OpenCalendar')}`;
  button.addEventListener('click', () => new CalendarApplication().render(true));

  footer.appendChild(button);
  log(3, 'Journal calendar button added');
}

/* -------------------------------------------- */

/**
 * Handle renderChatMessage hook for calendar announcements.
 * @param {ChatMessage} message - The chat message document
 * @param {HTMLElement} html - The rendered HTML element
 * @param {object} context - Render context
 * @todo move this to correct utility file.
 */
function onRenderChatMessage(message, html, context) {
  // Only process calendaria announcements
  if (!message.flags?.[MODULE.ID]?.isAnnouncement) return;

  // Add click handler for "Open Note" link
  const openLink = html.querySelector('.announcement-open');
  if (openLink) {
    openLink.addEventListener('click', async (event) => {
      event.preventDefault();
      const noteId = openLink.dataset.noteId;
      const journalId = openLink.dataset.journalId;

      if (!noteId) return;

      // Find and render the note sheet in view mode
      const page = NoteManager.getFullNote(noteId);
      if (page) {
        page.sheet.render(true, { mode: 'view' });
      } else if (journalId) {
        // Fallback: try to open the journal
        const journal = game.journal.get(journalId);
        if (journal) journal.sheet.render(true, { pageId: noteId });
      }
    });
  }
}

/* -------------------------------------------- */

/**
 * Handle combat round changes to advance world time.
 * @param {Combat} combat - The combat document
 * @param {object} changes - The changes made to the combat
 * @param {object} options - Update options
 * @param {string} userId - The user who triggered the update
 */
function onUpdateCombat(combat, changes, options, userId) {
  // Only process round changes
  if (!('round' in changes)) return;

  // Only the GM who triggered the change should advance time
  if (game.user.id !== userId || !game.user.isGM) return;

  // Check if setting is enabled
  if (!game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_COMBAT)) return;

  // Don't advance on round 0 (combat start) or when going backwards
  const previousRound = combat._source?.round ?? 0;
  if (changes.round <= previousRound) return;

  // Calculate rounds advanced (usually 1, but could be more if skipped)
  const roundsAdvanced = changes.round - previousRound;
  const calendar = CalendarManager.getActiveCalendar();
  const secondsPerRound = calendar?.secondsPerRound ?? 6;
  const totalSeconds = roundsAdvanced * secondsPerRound;

  log(3, `Combat round ${previousRound} -> ${changes.round}: advancing time by ${totalSeconds} seconds`);
  game.time.advance(totalSeconds);
}
