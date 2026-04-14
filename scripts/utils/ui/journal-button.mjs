/**
 * Journal Calendar Footer
 * @module Utils/JournalButton
 * @author Tyler
 */

import { BigCal, Chronicle, HUD, MiniCal, Stopwatch, SunDial, TimeKeeper } from '../../applications/_module.mjs';
import { MODULE, SETTINGS } from '../../constants.mjs';
import { localize } from '../localization.mjs';
import { canViewBigCal, canViewChronicle, canViewHUD, canViewMiniCal, canViewStopwatch, canViewSunDial, canViewTimeKeeper } from '../permissions.mjs';

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
  const buttons = document.createElement('div');
  buttons.className = 'calendaria-footer footer-buttons';
  const apps = [
    { id: 'bigcal', icon: 'fa-calendar-days', tooltip: 'CALENDARIA.Common.BigCal', toggle: () => BigCal.toggle(), canView: canViewBigCal },
    { id: 'minical', icon: 'fa-compress', tooltip: 'CALENDARIA.Common.MiniCal', toggle: () => MiniCal.toggle(), canView: canViewMiniCal },
    { id: 'hud', icon: 'fa-landmark-dome', tooltip: 'CALENDARIA.SettingsPanel.Tab.HUD', toggle: () => HUD.toggle(), canView: canViewHUD },
    { id: 'timekeeper', icon: 'fa-gauge', tooltip: 'CALENDARIA.Common.TimeKeeper', toggle: () => TimeKeeper.toggle(), canView: canViewTimeKeeper },
    { id: 'sundial', icon: 'fa-sun', tooltip: 'CALENDARIA.SettingsPanel.Tab.SunDial', toggle: () => SunDial.toggle(), canView: canViewSunDial },
    { id: 'stopwatch', icon: 'fa-stopwatch', tooltip: 'CALENDARIA.Common.StopWatch', toggle: () => Stopwatch.toggle(), canView: canViewStopwatch },
    { id: 'chronicle', icon: 'fa-scroll', tooltip: 'CALENDARIA.Chronicle.Title', toggle: () => Chronicle.toggle(), canView: canViewChronicle }
  ];
  for (const app of apps) {
    if (!app.canView()) continue;
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
