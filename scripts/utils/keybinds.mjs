/**
 * Keybinding Registration and Handlers
 * @module Utils/Keybinds
 * @author Tyler
 */

import { HUD } from '../applications/hud.mjs';
import { Stopwatch } from '../applications/stopwatch.mjs';
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

  game.keybindings.register('calendaria', 'toggle-stopwatch', {
    name: 'CALENDARIA.Keybinds.ToggleStopwatch.Name',
    hint: 'CALENDARIA.Keybinds.ToggleStopwatch.Hint',
    editable: [{ key: 'KeyW', modifiers: ['Alt'] }],
    onDown: () => {
      log(3, 'Toggle stopwatch keybinding triggered');
      Stopwatch.toggle();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register('calendaria', 'stopwatch-start-pause', {
    name: 'CALENDARIA.Keybinds.StopwatchStartPause.Name',
    hint: 'CALENDARIA.Keybinds.StopwatchStartPause.Hint',
    editable: [],
    onDown: () => {
      log(3, 'Stopwatch start/pause keybinding triggered');
      Stopwatch.toggleStartPause();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register('calendaria', 'stopwatch-reset', {
    name: 'CALENDARIA.Keybinds.StopwatchReset.Name',
    hint: 'CALENDARIA.Keybinds.StopwatchReset.Hint',
    editable: [],
    onDown: () => {
      log(3, 'Stopwatch reset keybinding triggered');
      Stopwatch.reset();
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
  HUD.toggle();
}
