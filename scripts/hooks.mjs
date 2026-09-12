import { registerBatches } from '../dev/quench/index.mjs';
import { BigCal, Chronicle, HUD, MiniCal, Stopwatch, SunDial, TimeKeeper } from './applications/_module.mjs';
import { CalendarManager } from './calendar/_module.mjs';
import { HOOKS, MODULE, SCENE_FLAGS, SETTINGS } from './constants.mjs';
import { FestivalManager } from './festivals/_module.mjs';
import { onDayChangeForBastions, onLongRest, onPF1eRest, onPF2eRest, onPreRest, onShortRest, patchBastionButton } from './integrations/_module.mjs';
import { NoteManager, clearComputedDateCache } from './notes/_module.mjs';
import { TimeClock, onMoonPhaseChange, onUpdateScene, onWeatherChange } from './time/_module.mjs';
import {
  autoRevealCurrentDay,
  onChatMessage,
  onGetSceneControlButtons,
  onPreCreateChatMessage,
  onRenderAnnouncementMessage,
  onRenderChatMessageHTML,
  onRenderDocumentDirectory,
  patchTooltipActivate,
  publishWeeklyAlmanac,
  registerWidgetCombatHooks
} from './utils/_module.mjs';

/** Widget combat hook configurations. */
const WIDGET_COMBAT_CONFIGS = [
  { settingKey: SETTINGS.HUD_COMBAT_MODE, showSettingKey: SETTINGS.SHOW_CALENDAR_HUD, getInstance: () => HUD.instance, showWidget: () => HUD.show({ silent: true }) },
  { settingKey: SETTINGS.MINI_CAL_COMBAT_MODE, showSettingKey: SETTINGS.SHOW_MINI_CAL, getInstance: () => MiniCal.instance, showWidget: () => MiniCal.show({ silent: true }) },
  { settingKey: SETTINGS.TIMEKEEPER_COMBAT_MODE, showSettingKey: SETTINGS.SHOW_TIME_KEEPER, getInstance: () => TimeKeeper.instance, showWidget: () => TimeKeeper.show({ silent: true }) },
  {
    settingKey: SETTINGS.SUN_DIAL_COMBAT_MODE,
    showSettingKey: SETTINGS.SHOW_SUN_DIAL,
    getInstance: () => foundry.applications.instances.get('calendaria-sun-dial'),
    showWidget: () => SunDial.show({ silent: true })
  },
  { settingKey: SETTINGS.STOPWATCH_COMBAT_MODE, showSettingKey: SETTINGS.SHOW_STOPWATCH, getInstance: () => Stopwatch.instance, showWidget: () => Stopwatch.show({ silent: true }) },
  { settingKey: SETTINGS.BIG_CAL_COMBAT_MODE, showSettingKey: SETTINGS.SHOW_BIG_CAL, getInstance: () => BigCal.instance, showWidget: () => BigCal.show({ silent: true }) },
  { settingKey: SETTINGS.CHRONICLE_COMBAT_MODE, showSettingKey: SETTINGS.SHOW_CHRONICLE, getInstance: () => Chronicle.instance, showWidget: () => Chronicle.show() }
];

/** Re-evaluate HUD visibility for the current player against the active scene's hide flag. */
function onCanvasReadyForHUD() {
  if (game.user.isGM) return;
  const hideForPlayers = canvas?.scene?.getFlag(MODULE.ID, SCENE_FLAGS.HUD_HIDE_FOR_PLAYERS);
  if (hideForPlayers) HUD.hide();
  else if (game.settings.get(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD)) HUD.show({ silent: true });
}

/**
 * Offer to remove festival notes when the GM turns Calendaria off in Manage Modules.
 * @param {object} setting - The updated setting document
 * @param {object} _changes - The applied changes
 * @param {object} _options - Update options
 * @param {string} userId - ID of the user who made the change
 * @returns {Promise<void>}
 */
async function onModuleConfigurationChange(setting, _changes, _options, userId) {
  if (setting.key !== 'core.moduleConfiguration' || userId !== game.user.id || !game.user.isGM) return;
  if (!game.modules.get(MODULE.ID)?.active) return;
  if (game.settings.get('core', 'moduleConfiguration')?.[MODULE.ID] !== false) return;
  await FestivalManager.promptNoteCleanup({ disabling: true });
}

/**
 * Register all hooks for the Calendaria module.
 */
export function registerHooks() {
  Hooks.on(HOOKS.CALENDAR_SWITCHED, (...args) => {
    if (NoteManager.isInitialized()) NoteManager.onCalendarSwitched(...args);
  });
  Hooks.on(HOOKS.CALENDAR_SWITCHED, (calendarId, calendar) => {
    if (ATLAS.isPrimaryGM && NoteManager.isInitialized()) FestivalManager.seedFestivalNotes(calendarId, calendar);
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
  Hooks.on('dnd5e.shortRest', onShortRest);
  Hooks.on('dnd5e.preLongRest', onPreRest);
  Hooks.on('dnd5e.preShortRest', onPreRest);
  Hooks.on('pf1ActorRest', onPF1eRest);
  Hooks.on('pf2e.restForTheNight', onPF2eRest);
  Hooks.on('getSceneControlButtons', onGetSceneControlButtons);
  Hooks.on('preCreateChatMessage', onPreCreateChatMessage);
  Hooks.on('preDeleteFolder', NoteManager.onPreDeleteFolder.bind(NoteManager));
  Hooks.on('preDeleteJournalEntry', NoteManager.onPreDeleteJournalEntry.bind(NoteManager));
  Hooks.on('preUpdateJournalEntryPage', NoteManager.onPreUpdateJournalEntryPage.bind(NoteManager));
  Hooks.on('quenchReady', (quench) => registerBatches(quench));
  Hooks.on('renderChatMessageHTML', onRenderAnnouncementMessage);
  Hooks.on('renderChatMessageHTML', onRenderChatMessageHTML);
  Hooks.on('renderDocumentDirectory', onRenderDocumentDirectory);
  Hooks.on('updateJournalEntry', NoteManager.onUpdateJournalEntry.bind(NoteManager));
  Hooks.on('updateJournalEntryPage', NoteManager.onUpdateJournalEntryPage.bind(NoteManager));
  Hooks.on('updateScene', onUpdateScene);
  Hooks.on('canvasReady', onCanvasReadyForHUD);
  Hooks.on('updateSetting', CalendarManager.onUpdateSetting.bind(CalendarManager));
  Hooks.on('updateSetting', onModuleConfigurationChange);
  Hooks.on('updateWorldTime', TimeClock.onUpdateWorldTime.bind(TimeClock));
  Hooks.on(HOOKS.DAY_CHANGE, autoRevealCurrentDay);
  Hooks.on(HOOKS.DAY_CHANGE, onDayChangeForBastions);
  Hooks.on(HOOKS.DAY_CHANGE, publishWeeklyAlmanac);
  Hooks.on(HOOKS.MOON_PHASE_CHANGE, onMoonPhaseChange);
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.once('ready', () => Stopwatch.restore());
  Hooks.once('ready', patchTooltipActivate);
  Hooks.once('ready', patchBastionButton);
  Hooks.once('pf2e.systemReady', () => CalendarManager.reapplyActiveCalendar());
  for (const config of WIDGET_COMBAT_CONFIGS) registerWidgetCombatHooks(config);
  ATLAS.log(3, 'Hooks registered');
}
