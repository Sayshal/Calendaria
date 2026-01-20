/**
 * Journal Calendar Button
 * Adds a calendar button to the journal sidebar and hides calendar infrastructure.
 * @module Utils/JournalButton
 * @author Tyler
 */

import { BigCal } from '../applications/big-cal.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { localize } from './localization.mjs';
import { log } from './logger.mjs';

/**
 * Handle Journal Directory activation.
 * Adds calendar button and hides calendar folders/journals from sidebar.
 * @param {object} app - The document directory application
 */
export function onActivateDocumentDirectory(app) {
  const element = app.element;
  if (!element) return;
  addCalendarButton({ element });
  hideCalendarInfrastructure({ element });
}

/**
 * Add Calendar button to journal sidebar footer.
 * @param {object} options - Options object
 * @param {HTMLElement} options.element - The sidebar element
 */
function addCalendarButton({ element }) {
  const footer = element.querySelector('.directory-footer');
  if (!footer) return;
  if (footer.querySelector('.calendaria-open-button')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'calendaria-open-button';
  button.innerHTML = `<i class="fas fa-calendar-days"></i> ${localize('CALENDARIA.HUD.OpenBigCal')}`;
  button.addEventListener('click', () => new BigCal().render(true));
  footer.appendChild(button);
  log(3, 'Journal calendar button added');
}

/**
 * Hide calendar folders and journals from the sidebar.
 * Players never see them; GMs only see them in dev mode.
 * @param {object} options - Options object
 * @param {HTMLElement} options.element - The sidebar element
 */
function hideCalendarInfrastructure({ element }) {
  const showInfrastructure = game.user.isGM && game.settings.get(MODULE.ID, SETTINGS.DEV_MODE);
  if (showInfrastructure) return;

  for (const folder of game.folders) {
    if (folder.type !== 'JournalEntry') continue;
    const isCalendarNotesFolder = folder.getFlag(MODULE.ID, 'isCalendarNotesFolder');
    const isCalendarFolder = folder.getFlag(MODULE.ID, 'isCalendarFolder');
    if (isCalendarNotesFolder || isCalendarFolder) element.querySelector(`[data-folder-id="${folder.id}"]`)?.remove();
  }

  for (const journal of game.journal) {
    const isCalendarNote = journal.getFlag(MODULE.ID, 'isCalendarNote');
    const isCalendarJournal = journal.getFlag(MODULE.ID, 'isCalendarJournal');
    if (isCalendarNote || isCalendarJournal) element.querySelector(`[data-entry-id="${journal.id}"]`)?.remove();
  }
}
