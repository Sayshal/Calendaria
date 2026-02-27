/**
 * Calendaria Hook Registration
 * @module Hooks
 * @author Tyler
 */

import { registerBatches } from '../dev/quench/index.mjs';
import { HUD } from './applications/hud/hud.mjs';
import { Stopwatch } from './applications/time/stopwatch.mjs';
import CalendarManager from './calendar/calendar-manager.mjs';
import { HOOKS } from './constants.mjs';
import { onLongRest, onPreRest } from './integrations/rest-time.mjs';
import NoteManager from './notes/note-manager.mjs';
import { onMoonPhaseChange, onRenderSceneConfig, onUpdateScene, onWeatherChange } from './time/darkness.mjs';
import TimeClock from './time/time-clock.mjs';
import { onChatMessage } from './utils/chat/chat-commands.mjs';
import { onPreCreateChatMessage, onRenderAnnouncementMessage, onRenderChatMessageHTML } from './utils/chat/chat-timestamp.mjs';
import { log } from './utils/logger.mjs';
import { onRenderDocumentDirectory } from './utils/ui/journal-button.mjs';
import { onGetSceneControlButtons } from './utils/ui/toolbar-buttons.mjs';

/**
 * Register all hooks for the Calendaria module.
 */
export function registerHooks() {
  Hooks.on(HOOKS.CALENDAR_SWITCHED, NoteManager.onCalendarSwitched.bind(NoteManager));
  Hooks.on('chatMessage', onChatMessage);
  Hooks.on('combatRound', TimeClock.onCombatTimeBlock);
  Hooks.on('combatTurn', TimeClock.onCombatTimeBlock);
  Hooks.on('createJournalEntryPage', NoteManager.onCreateJournalEntryPage.bind(NoteManager));
  Hooks.on('deleteJournalEntry', NoteManager.onDeleteJournalEntry.bind(NoteManager));
  Hooks.on('deleteJournalEntryPage', NoteManager.onDeleteJournalEntryPage.bind(NoteManager));
  Hooks.on('dnd5e.longRest', onLongRest);
  Hooks.on('dnd5e.preLongRest', onPreRest);
  Hooks.on('dnd5e.preShortRest', onPreRest);
  Hooks.on('getSceneControlButtons', onGetSceneControlButtons);
  Hooks.on('preCreateChatMessage', onPreCreateChatMessage);
  Hooks.on('preDeleteFolder', NoteManager.onPreDeleteFolder.bind(NoteManager));
  Hooks.on('preDeleteJournalEntry', NoteManager.onPreDeleteJournalEntry.bind(NoteManager));
  Hooks.on('quenchReady', (quench) => registerBatches(quench));
  Hooks.on('renderChatMessageHTML', onRenderAnnouncementMessage);
  Hooks.on('renderChatMessageHTML', onRenderChatMessageHTML);
  Hooks.on('renderDocumentDirectory', onRenderDocumentDirectory);
  Hooks.on('renderSceneConfig', onRenderSceneConfig);
  Hooks.on('updateJournalEntryPage', NoteManager.onUpdateJournalEntryPage.bind(NoteManager));
  Hooks.on('updateScene', onUpdateScene);
  Hooks.on('updateSetting', CalendarManager.onUpdateSetting.bind(CalendarManager));
  Hooks.on('updateWorldTime', TimeClock.onUpdateWorldTime);
  Hooks.on(HOOKS.MOON_PHASE_CHANGE, onMoonPhaseChange);
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.once('ready', () => Stopwatch.restore());
  Hooks.once('ready', patchTooltipActivate);
  HUD.registerCombatHooks();
  log(3, 'Hooks registered');
}

/**
 * Patch TooltipManager#activate to work around a Foundry core bug where nested
 * tooltip elements (parent with data-tooltip-html, child with data-tooltip + aria-label)
 * produce blank tooltips on first hover due to a stale activation timeout race condition.
 * @see https://github.com/foundryvtt/foundryvtt/issues/13865
 */
function patchTooltipActivate() {
  const tm = game.tooltip;
  const orig = tm.activate.bind(tm);
  tm.activate = function (element, options = {}) {
    if (!options.text && !options.html && element?.ariaLabel && element?.dataset?.tooltip === '') options.text = element.ariaLabel;
    return orig(element, options);
  };
}
