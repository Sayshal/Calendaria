/**
 * Calendaria Module
 * System-agnostic calendar and time management for Foundry VTT.
 * @module Calendaria
 * @author Tyler
 */

import { CalendariaAPI, createGlobalNamespace } from './scripts/api.mjs';
import { BigCal, CalendarNoteSheet, CalendariaSceneConfig, Chronicle, HUD, MiniCal, Stopwatch, SunDial, TimeKeeper } from './scripts/applications/_module.mjs';
import { CalendarManager } from './scripts/calendar/_module.mjs';
import { HOOKS, JOURNALS, MODULE, SETTINGS, SHEETS, TEMPLATES } from './scripts/constants.mjs';
import { CalendarNoteDataModel, CalendariaCalendar } from './scripts/data/_module.mjs';
import { FestivalManager } from './scripts/festivals/_module.mjs';
import { registerHooks } from './scripts/hooks.mjs';
import { initializeImporters } from './scripts/importers/_module.mjs';
import { initializeChatCommander, initializeFXMaster } from './scripts/integrations/_module.mjs';
import { NoteManager } from './scripts/notes/_module.mjs';
import CalendariaSettings from './scripts/settings-handler.mjs';
import { EventScheduler, ReminderScheduler, TimeClock, TimeTracker } from './scripts/time/_module.mjs';
import {
  CalendariaSocket,
  canViewBigCal,
  canViewChronicle,
  canViewHUD,
  canViewMiniCal,
  canViewStopwatch,
  canViewSunDial,
  canViewTimeKeeper,
  checkReleaseMessage,
  initializeLogger,
  initializeTheme,
  log,
  overrideChatLogTimestamps,
  registerEnrichers,
  registerKeybindings,
  runAllMigrations,
  showDebugZones,
  updateZonePositions
} from './scripts/utils/_module.mjs';
import { WeatherManager, initializeWeatherSound } from './scripts/weather/_module.mjs';
import './styles/big-cal.css';
import './styles/calendar-editor.css';
import './styles/chat.css';
import './styles/chronicle.css';
import './styles/cinematics.css';
import './styles/climate-editor.css';
import './styles/condition-builder.css';
import './styles/dialogs.css';
import './styles/enrichers.css';
import './styles/global.css';
import './styles/hud.css';
import './styles/importer.css';
import './styles/mini-cal.css';
import './styles/note-sheet.css';
import './styles/note-viewer.css';
import './styles/secondary-calendar.css';
import './styles/settings.css';
import './styles/sun-dial.css';
import './styles/theme.css';
import './styles/time-keeper.css';
import './styles/tooltips.css';
import './styles/weather.css';

Hooks.once('init', async () => {
  createGlobalNamespace();
  Hooks.callAll(HOOKS.INIT);
  CalendariaSettings.registerSettings();
  initializeLogger();
  registerKeybindings();
  registerHooks();
  registerEnrichers();
  initializeImporters();
  overrideChatLogTimestamps();
  CalendariaSocket.initialize();
  Object.assign(CONFIG.JournalEntryPage.dataModels, { [JOURNALS.CALENDAR_NOTE]: CalendarNoteDataModel });
  CONFIG.JournalEntryPage.sheetClasses[JOURNALS.CALENDAR_NOTE] = {};
  foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, SHEETS.CALENDARIA, CalendarNoteSheet, { types: [JOURNALS.CALENDAR_NOTE], makeDefault: true, label: 'Calendar Note' });
  foundry.applications.apps.DocumentSheetConfig.unregisterSheet(Scene, 'core', foundry.applications.sheets.SceneConfig);
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Scene, MODULE.ID, CalendariaSceneConfig, { makeDefault: true, label: 'Calendaria Scene Config' });
  CalendariaSceneConfig.patchBaseSceneConfig();
  await foundry.applications.handlebars.loadTemplates(Object.values(TEMPLATES).flatMap((v) => (typeof v === 'string' ? v : Object.values(v))));
  log(3, 'Calendaria module initialized.');
});

Hooks.once('dnd5e.setupCalendar', () => {
  CONFIG.DND5E.calendar.application = null;
  CONFIG.DND5E.calendar.calendars = [];
  return false;
});

Hooks.once('ready', async () => {
  CalendariaSettings.registerReadySettings();
  await CalendarManager.initialize();
  await runAllMigrations();
  await NoteManager.initialize();
  if (game.user.isGM) {
    const activeCalendar = CalendarManager.getActiveCalendar();
    if (activeCalendar?.metadata?.id) await FestivalManager.ensureFestivalNotes(activeCalendar.metadata.id, activeCalendar);
  }
  TimeTracker.initialize();
  TimeClock.initialize();
  EventScheduler.initialize();
  ReminderScheduler.initialize();
  initializeTheme();
  try {
    await WeatherManager.initialize();
  } catch (err) {
    log(1, 'WeatherManager initialization failed:', err);
  }
  BigCal.updateIdleOpacity();
  TimeKeeper.updateIdleOpacity();
  HUD.updateIdleOpacity();
  MiniCal.updateIdleOpacity();
  SunDial.updateIdleOpacity();
  Stopwatch.updateIdleOpacity();
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER) && canViewTimeKeeper()) TimeKeeper.show({ silent: true });
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_SUN_DIAL) && canViewSunDial()) SunDial.show({ silent: true });
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_STOPWATCH) && canViewStopwatch()) Stopwatch.show({ silent: true });
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_BIG_CAL) && canViewBigCal()) BigCal.show();
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_CHRONICLE) && canViewChronicle()) Chronicle.show({ silent: true });
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_BIG_CAL)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_BIG_CAL, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_CHRONICLE)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_CHRONICLE, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_MINI_CAL)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_MINI_CAL, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_HUD)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_STOPWATCH)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_STOPWATCH, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_SUN_DIAL)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_SUN_DIAL, true);
  if (game.settings.get(MODULE.ID, SETTINGS.FORCE_TIME_KEEPER)) await game.settings.set(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER, true);
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_MINI_CAL) && canViewMiniCal()) MiniCal.show({ silent: true });
  if (game.system.id === 'dnd5e' && foundry.utils.isNewerVersion(game.system.version, '5.1.10')) {
    const calendarConfig = game.settings.get('dnd5e', 'calendarConfig');
    if (calendarConfig?.enabled) {
      await game.settings.set('dnd5e', 'calendarConfig', { ...calendarConfig, enabled: false });
      await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, true);
    }
  }
  const systemWorldClock = game.pf2e?.worldClock ?? game.sf2e?.worldClock;
  if (systemWorldClock && game.settings.get(MODULE.ID, SETTINGS.DARKNESS_SYNC)) {
    const systemId = game.system.id;
    const systemClockSetting = game.settings.get(systemId, 'worldClock');
    if (systemClockSetting?.syncDarkness) {
      await game.settings.set(systemId, 'worldClock', { ...systemClockSetting, syncDarkness: false });
      ui.notifications.warn('CALENDARIA.Notification.PF2eDarknessSyncDisabled', { localize: true });
    }
  }
  if (game.settings.get(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD) && canViewHUD()) HUD.show({ silent: true });
  if (game.settings.get(MODULE.ID, SETTINGS.DEV_MODE)) showDebugZones();
  Hooks.on('renderSceneControls', () => updateZonePositions('below-controls'));
  initializeChatCommander();
  initializeFXMaster();
  initializeWeatherSound();
  await checkReleaseMessage();
  Hooks.callAll(HOOKS.READY, { api: CalendariaAPI, calendar: CalendarManager.getActiveCalendar(), version: game.modules.get('calendaria')?.version });
});
Hooks.once('setup', () => {
  CONFIG.time.worldCalendarClass = CalendariaCalendar;
});
