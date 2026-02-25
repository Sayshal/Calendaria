/**
 * Keybinding Registration and Handlers
 * @module Utils/Keybinds
 * @author Tyler
 */

import { BigCal } from '../applications/calendar/big-cal.mjs';
import { MiniCal } from '../applications/calendar/mini-cal.mjs';
import { HUD } from '../applications/hud/hud.mjs';
import { Stopwatch } from '../applications/time/stopwatch.mjs';
import { TimeKeeper } from '../applications/time/time-keeper.mjs';
import { KEYBINDS, MODULE } from '../constants.mjs';
import { log } from './logger.mjs';

/**
 * Register all keybindings for the Calendaria module.
 */
export function registerKeybindings() {
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_BIGCAL, {
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
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_MINICAL, {
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
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_HUD, {
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
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_TIMEKEEPER, {
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
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_STOPWATCH, {
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
  game.keybindings.register(MODULE.ID, KEYBINDS.STOPWATCH_START_PAUSE, {
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
  game.keybindings.register(MODULE.ID, KEYBINDS.STOPWATCH_RESET, {
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
