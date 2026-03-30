/**
 * Keybinding Registration and Handlers
 * @module Utils/Keybinds
 * @author Tyler
 */

import { BigCal, Chronicle, HUD, MiniCal, NoteViewer, Stopwatch, SunDial, TimeKeeper } from '../applications/_module.mjs';
import { KEYBINDS, MODULE } from '../constants.mjs';
import { log } from './logger.mjs';

/** Register all keybindings for the Calendaria module. */
export function registerKeybindings() {
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_BIGCAL, {
    name: 'CALENDARIA.Keybinds.ToggleBigCal.Name',
    hint: 'CALENDARIA.Keybinds.ToggleBigCal.Hint',
    editable: [],
    onDown: () => {
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
      TimeKeeper.toggle();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_SUNDIAL, {
    name: 'CALENDARIA.Keybinds.ToggleSunDial.Name',
    hint: 'CALENDARIA.Keybinds.ToggleSunDial.Hint',
    editable: [],
    onDown: () => {
      SunDial.toggle();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_CHRONICLE, {
    name: 'CALENDARIA.Keybinds.ToggleChronicle.Name',
    hint: 'CALENDARIA.Keybinds.ToggleChronicle.Hint',
    editable: [],
    onDown: () => {
      Chronicle.toggle();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_NOTEVIEWER, {
    name: 'CALENDARIA.Keybinds.ToggleNoteViewer.Name',
    hint: 'CALENDARIA.Keybinds.ToggleNoteViewer.Hint',
    editable: [],
    onDown: () => {
      NoteViewer.toggle();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_STOPWATCH, {
    name: 'CALENDARIA.Keybinds.ToggleStopwatch.Name',
    hint: 'CALENDARIA.Keybinds.ToggleStopwatch.Hint',
    editable: [{ key: 'KeyW', modifiers: ['Alt'] }],
    onDown: () => {
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
      Stopwatch.reset();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  log(3, 'Keybindings registered');
}
