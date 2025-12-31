/**
 * Journal Calendar Button
 * Adds a calendar button to the journal sidebar.
 * @module Utils/JournalButton
 * @author Tyler
 */

import { CalendarApplication } from '../applications/calendar-application.mjs';
import { localize } from './localization.mjs';
import { log } from './logger.mjs';

/**
 * Add Calendar button to journal sidebar footer.
 * @param {object} app - The journal sidebar application
 */
export function onRenderJournalDirectory(app) {
  const footer = app.element.querySelector('.directory-footer');
  if (!footer) return;
  if (footer.querySelector('.calendaria-open-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'calendaria-open-button';
  button.innerHTML = `<i class="fas fa-calendar-days"></i> ${localize('CALENDARIA.HUD.OpenCalendar')}`;
  button.addEventListener('click', () => new CalendarApplication().render(true));

  footer.appendChild(button);
  log(3, 'Journal calendar button added');
}
