/**
 * Keybinding Registration and Handlers
 * @module Utils/Keybinds
 * @author Tyler
 */

import { SYSTEM } from '../constants.mjs';
import { log } from './logger.mjs';

/**
 * Register all keybindings for the Calendaria module
 */
export function registerKeybindings() {
  game.keybindings.register('calendaria', 'toggle-calendar', {
    name: 'CALENDARIA.Keybinds.ToggleCalendar.Name',
    hint: 'CALENDARIA.Keybinds.ToggleCalendar.Hint',
    editable: [{ key: 'KeyC', modifiers: ['CONTROL'] }],
    onDown: () => {
      toggleCalendarVisibility();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  log(3, 'Keybindings registered');
}

/**
 * Toggle calendar visibility.
 * Only works when on dnd5e system which provides the calendar HUD.
 */
export function toggleCalendarVisibility() {
  // Only toggle visibility for dnd5e system
  if (!SYSTEM.isDnd5e) return;

  const prefs = game.settings.get('dnd5e', 'calendarPreferences');
  const newVisibility = !prefs.visible;
  game.settings.set('dnd5e', 'calendarPreferences', { ...prefs, visible: newVisibility });
}
