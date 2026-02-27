/**
 * Journal Calendar Footer
 * @module Utils/JournalButton
 * @author Tyler
 */

import { BigCal } from '../../applications/calendar/big-cal.mjs';
import { MiniCal } from '../../applications/calendar/mini-cal.mjs';
import { HUD } from '../../applications/hud/hud.mjs';
import { Stopwatch } from '../../applications/time/stopwatch.mjs';
import { TimeKeeper } from '../../applications/time/time-keeper.mjs';
import { MODULE, SETTINGS } from '../../constants.mjs';
import { localize } from '../localization.mjs';

/**
 * Handle Journal Directory activation.
 * @param {object} app - The document directory application
 */
export function onRenderDocumentDirectory(app) {
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
  const buttons = document.createElement('div');
  buttons.className = 'footer-buttons';
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
}

/**
 * Hide calendar folders and journals from the sidebar.
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
