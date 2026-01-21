/**
 * Journal Calendar Footer
 * Replaces the journal sidebar footer with Calendaria app toggles.
 * @module Utils/JournalButton
 * @author Tyler
 */

import { BigCal } from '../applications/big-cal.mjs';
import { HUD } from '../applications/hud.mjs';
import { MiniCal } from '../applications/mini-cal.mjs';
import { Stopwatch } from '../applications/stopwatch.mjs';
import { TimeKeeper } from '../applications/time-keeper.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { localize } from './localization.mjs';
import { log } from './logger.mjs';

/**
 * Handle Journal Directory activation.
 * Replaces footer with Calendaria controls and hides calendar infrastructure.
 * @param {object} app - The document directory application
 */
export function onActivateDocumentDirectory(app) {
  if (app.documentName !== 'JournalEntry') return;
  const element = app.element;
  if (!element) return;
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_JOURNAL_FOOTER)) replaceFooter({ element });
  hideCalendarInfrastructure({ element });
}

/**
 * Replace the journal sidebar footer with Calendaria controls.
 * @param {object} options - Options object
 * @param {HTMLElement} options.element - The sidebar element
 */
function replaceFooter({ element }) {
  const footer = element.querySelector('.directory-footer');
  if (!footer) return;
  if (footer.querySelector('.calendaria-footer')) return;

  footer.innerHTML = '';
  footer.classList.add('calendaria-footer');

  // Button container
  const buttons = document.createElement('div');
  buttons.className = 'calendaria-footer-buttons';

  const apps = [
    { id: 'bigcal', icon: 'fa-calendar-days', tooltip: 'CALENDARIA.SettingsPanel.Tab.BigCal', toggle: () => BigCal.toggle() },
    { id: 'minical', icon: 'fa-compress', tooltip: 'CALENDARIA.SettingsPanel.Tab.MiniCal', toggle: () => MiniCal.toggle() },
    { id: 'hud', icon: 'fa-sun', tooltip: 'CALENDARIA.SettingsPanel.Tab.HUD', toggle: () => HUD.toggle() },
    { id: 'timekeeper', icon: 'fa-gauge', tooltip: 'CALENDARIA.SettingsPanel.Tab.TimeKeeper', toggle: () => TimeKeeper.toggle() },
    { id: 'stopwatch', icon: 'fa-stopwatch', tooltip: 'CALENDARIA.SettingsPanel.Tab.Stopwatch', toggle: () => Stopwatch.toggle() }
  ];

  for (const app of apps) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendaria-footer-btn';
    btn.dataset.app = app.id;
    btn.dataset.tooltip = localize(app.tooltip);
    btn.dataset.tooltipDirection = 'UP';
    btn.innerHTML = `<i class="fas ${app.icon}"></i>`;
    btn.addEventListener('click', app.toggle);
    buttons.appendChild(btn);
  }

  footer.appendChild(buttons);
  log(3, 'Journal footer replaced with Calendaria controls');
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
