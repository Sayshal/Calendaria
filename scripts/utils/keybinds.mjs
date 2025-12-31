/**
 * Keybinding Registration and Handlers
 * @module Utils/Keybinds
 * @author Tyler
 */

import { CalendariaHUD } from '../applications/calendaria-hud.mjs';
import { log } from './logger.mjs';

/**
 * Register all keybindings for the Calendaria module
 */
export function registerKeybindings() {
  game.keybindings.register('calendaria', 'toggle-calendar', {
    name: 'CALENDARIA.Keybinds.ToggleCalendar.Name',
    hint: 'CALENDARIA.Keybinds.ToggleCalendar.Hint',
    editable: [{ key: 'KeyC', modifiers: ['Alt'] }],
    onDown: () => {
      log(3, 'Toggle calendar keybinding triggered');
      toggleCalendarVisibility();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  log(3, 'Keybindings registered');
}

/**
 * Toggle calendar HUD visibility.
 */
export function toggleCalendarVisibility() {
  CalendariaHUD.toggle();
}
