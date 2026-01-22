/**
 * Keybinding Registration and Handlers
 * @module Utils/Keybinds
 * @author Tyler
 */

import { BigCal } from '../applications/big-cal.mjs';
import { HUD } from '../applications/hud.mjs';
import { MiniCal } from '../applications/mini-cal.mjs';
import { Stopwatch } from '../applications/stopwatch.mjs';
import { TimeKeeper } from '../applications/time-keeper.mjs';
import { log } from './logger.mjs';

/**
 * Register all keybindings for the Calendaria module
 */
export function registerKeybindings() {
  game.keybindings.register('calendaria', 'toggle-bigcal', {
    name: 'CALENDARIA.Keybinds.ToggleBigCal.Name',
    hint: 'CALENDARIA.Keybinds.ToggleBigCal.Hint',
    editable: [],
    onDown: () => {
      log(3, 'Toggle BigCal keybinding triggered');
      BigCal.toggle();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register('calendaria', 'toggle-minical', {
    name: 'CALENDARIA.Keybinds.ToggleMiniCal.Name',
    hint: 'CALENDARIA.Keybinds.ToggleMiniCal.Hint',
    editable: [],
    onDown: () => {
      log(3, 'Toggle MiniCal keybinding triggered');
      MiniCal.toggle();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register('calendaria', 'toggle-hud', {
    name: 'CALENDARIA.Keybinds.ToggleHUD.Name',
    hint: 'CALENDARIA.Keybinds.ToggleHUD.Hint',
    editable: [{ key: 'KeyC', modifiers: ['Alt'] }],
    onDown: () => {
      log(3, 'Toggle HUD keybinding triggered');
      HUD.toggle();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register('calendaria', 'toggle-timekeeper', {
    name: 'CALENDARIA.Keybinds.ToggleTimeKeeper.Name',
    hint: 'CALENDARIA.Keybinds.ToggleTimeKeeper.Hint',
    editable: [],
    onDown: () => {
      log(3, 'Toggle TimeKeeper keybinding triggered');
      TimeKeeper.toggle();
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
