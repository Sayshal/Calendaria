/**
 * Calendaria Hook Registration
 * @module Hooks
 * @author Tyler
 */

import { registerBatches } from '../dev/quench/index.mjs';
import { BigCal, Chronicle, HUD, MiniCal, Stopwatch, SunDial, TimeKeeper } from './applications/_module.mjs';
import { CalendarManager } from './calendar/_module.mjs';
import { HOOKS, SETTINGS } from './constants.mjs';
import { FestivalManager } from './festivals/_module.mjs';
import { onLongRest, onPF2eRest, onPreRest } from './integrations/_module.mjs';
import { NoteManager, clearComputedDateCache } from './notes/_module.mjs';
import { TimeClock, onMoonPhaseChange, onUpdateScene, onWeatherChange } from './time/_module.mjs';
import {
  autoRevealCurrentDay,
  log,
  onChatMessage,
  onGetSceneControlButtons,
  onPreCreateChatMessage,
  onRenderAnnouncementMessage,
  onRenderChatMessageHTML,
  onRenderDocumentDirectory,
  registerWidgetCombatHooks
} from './utils/_module.mjs';

/**
 * Register all hooks for the Calendaria module.
 */
export function registerHooks() {
  Hooks.on(HOOKS.CALENDAR_SWITCHED, (...args) => {
    if (NoteManager.isInitialized()) NoteManager.onCalendarSwitched(...args);
  });
  Hooks.on(HOOKS.CALENDAR_SWITCHED, (calendarId, calendar) => {
    if (NoteManager.isInitialized()) FestivalManager.ensureFestivalNotes(calendarId, calendar);
  });
  Hooks.on(HOOKS.CALENDAR_UPDATED, clearComputedDateCache);
  Hooks.on('chatMessage', onChatMessage);
  Hooks.on('combatRound', TimeClock.onCombatTimeBlock);
  Hooks.on('combatTurn', TimeClock.onCombatTimeBlock);
  Hooks.on('createJournalEntry', NoteManager.onCreateJournalEntry.bind(NoteManager));
  Hooks.on('createJournalEntryPage', NoteManager.onCreateJournalEntryPage.bind(NoteManager));
  Hooks.on('deleteJournalEntry', NoteManager.onDeleteJournalEntry.bind(NoteManager));
  Hooks.on('deleteJournalEntryPage', NoteManager.onDeleteJournalEntryPage.bind(NoteManager));
  Hooks.on('dnd5e.longRest', onLongRest);
  Hooks.on('dnd5e.preLongRest', onPreRest);
  Hooks.on('dnd5e.preShortRest', onPreRest);
  Hooks.on('pf2e.restForTheNight', onPF2eRest);
  Hooks.on('getSceneControlButtons', onGetSceneControlButtons);
  Hooks.on('preCreateChatMessage', onPreCreateChatMessage);
  Hooks.on('preDeleteFolder', NoteManager.onPreDeleteFolder.bind(NoteManager));
  Hooks.on('preDeleteJournalEntry', NoteManager.onPreDeleteJournalEntry.bind(NoteManager));
  Hooks.on('quenchReady', (quench) => registerBatches(quench));
  Hooks.on('renderChatMessageHTML', onRenderAnnouncementMessage);
  Hooks.on('renderChatMessageHTML', onRenderChatMessageHTML);
  Hooks.on('renderDocumentDirectory', onRenderDocumentDirectory);
  Hooks.on('updateJournalEntry', NoteManager.onUpdateJournalEntry.bind(NoteManager));
  Hooks.on('updateJournalEntryPage', NoteManager.onUpdateJournalEntryPage.bind(NoteManager));
  Hooks.on('updateScene', onUpdateScene);
  Hooks.on('updateSetting', CalendarManager.onUpdateSetting.bind(CalendarManager));
  Hooks.on('updateWorldTime', TimeClock.onUpdateWorldTime);
  Hooks.on(HOOKS.DAY_CHANGE, autoRevealCurrentDay);
  Hooks.on(HOOKS.MOON_PHASE_CHANGE, onMoonPhaseChange);
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.once('ready', () => Stopwatch.restore());
  Hooks.once('ready', patchTooltipActivate);
  registerWidgetCombatHooks({
    settingKey: SETTINGS.HUD_COMBAT_MODE,
    showSettingKey: SETTINGS.SHOW_CALENDAR_HUD,
    getInstance: () => HUD.instance,
    showWidget: () => HUD.show({ silent: true })
  });
  registerWidgetCombatHooks({
    settingKey: SETTINGS.MINI_CAL_COMBAT_MODE,
    showSettingKey: SETTINGS.SHOW_MINI_CAL,
    getInstance: () => MiniCal.instance,
    showWidget: () => MiniCal.show({ silent: true })
  });
  registerWidgetCombatHooks({
    settingKey: SETTINGS.TIMEKEEPER_COMBAT_MODE,
    showSettingKey: SETTINGS.SHOW_TIME_KEEPER,
    getInstance: () => TimeKeeper.instance,
    showWidget: () => TimeKeeper.show({ silent: true })
  });
  registerWidgetCombatHooks({
    settingKey: SETTINGS.SUN_DIAL_COMBAT_MODE,
    showSettingKey: SETTINGS.SHOW_SUN_DIAL,
    getInstance: () => foundry.applications.instances.get('calendaria-sun-dial'),
    showWidget: () => SunDial.show({ silent: true })
  });
  registerWidgetCombatHooks({
    settingKey: SETTINGS.STOPWATCH_COMBAT_MODE,
    showSettingKey: SETTINGS.SHOW_STOPWATCH,
    getInstance: () => Stopwatch.instance,
    showWidget: () => Stopwatch.show({ silent: true })
  });
  registerWidgetCombatHooks({
    settingKey: SETTINGS.BIG_CAL_COMBAT_MODE,
    showSettingKey: SETTINGS.SHOW_BIG_CAL,
    getInstance: () => BigCal.instance,
    showWidget: () => BigCal.show({ silent: true })
  });
  registerWidgetCombatHooks({
    settingKey: SETTINGS.CHRONICLE_COMBAT_MODE,
    showSettingKey: SETTINGS.SHOW_CHRONICLE,
    getInstance: () => Chronicle.instance,
    showWidget: () => Chronicle.show({ silent: true })
  });
  log(3, 'Hooks registered');
}

/**
 * Patch TooltipManager#activate to work around a Foundry core bug where nested
 * tooltip elements (parent with data-tooltip-html, child with data-tooltip + aria-label)
 * produce blank tooltips on first hover due to a stale activation timeout race condition.
 * @see https://github.com/foundryvtt/foundryvtt/issues/13865
 */
function patchTooltipActivate() {
  const t = game.tooltip;
  const o = t.activate.bind(t);
  t.activate = function (element, options = {}) {
    if (!options.text && !options.html && element?.ariaLabel && element?.dataset?.tooltip === '') options.text = element.ariaLabel;
    return o(element, options);
  };
}
