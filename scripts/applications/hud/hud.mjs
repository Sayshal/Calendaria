/**
 * HUD - System-agnostic calendar widget.
 * @module Applications/HUD
 * @author Tyler
 */

import { CalendarManager } from '../../calendar/_module.mjs';
import { HOOKS, MODULE, REDUCED_FX_DENSITY, REPLACEABLE_ELEMENTS, SCENE_FLAGS, SETTINGS, SOCKET_TYPES, TEMPLATES, WIDGET_POINTS } from '../../constants.mjs';
import { NoteManager } from '../../notes/_module.mjs';
import { TimeClock, getTimeIncrements } from '../../time/_module.mjs';
import {
  CalendariaSocket,
  WOBBLE_CLASS,
  applyWeatherSkyTint,
  attachWidgetListeners,
  buildOpenAppsMenuItem,
  canChangeDateTime,
  canChangeWeather,
  canViewBigCal,
  canViewHUD,
  canViewMiniCal,
  checkStickyZones,
  cleanupSnapIndicator,
  computeStarAlpha,
  encodeHtmlAttribute,
  escapeText,
  finalizeDrag,
  formatForLocation,
  getActiveZone,
  getEquivalentDateTooltip,
  getMoonPhasePosition,
  getNotesOnDay,
  getRestorePosition,
  getSidebarBuffer,
  getSkyColorsRgb,
  hasMoonIconMarkers,
  hideSnapIndicator,
  isBottomAnchored,
  isCombatBlocked,
  localize,
  previewSnippet,
  registerForZoneUpdates,
  renderCycleIndicator,
  renderEraIndicator,
  renderMoonIcons,
  renderReplacementOrOriginal,
  renderSeasonIndicator,
  renderWeatherIndicator,
  renderWidgetsForPoint,
  restorePinnedState,
  stripMoonIconMarkers,
  stripSecrets,
  unpinFromZone,
  unregisterFromZoneUpdates,
  updateAllZonePositions,
  usesDomParenting,
  warnShowToAll
} from '../../utils/_module.mjs';
import { WeatherManager, getPreset, getPresetAlias } from '../../weather/_module.mjs';
import { BigCal, Chronicle, CinematicOverlay, HudSceneRenderer, MiniCal, NoteViewer, SetDateDialog, SettingsPanel, SunDial, WeatherPickerApp } from '../_module.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Calendar HUD with sundial dome, time controls, and calendar info.
 */
export class HUD extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {number|null} Hook ID for visual tick */
  #timeHookId = null;

  /** @type {number|null} Hook ID for world time updated */
  #worldTimeHookId = null;

  /** @type {Array} Hook references for cleanup */
  #hooks = [];

  /** @type {boolean} Sticky tray (always visible) */
  #stickyTray = false;

  /** @type {boolean} Sticky position (locks position) */
  #stickyPosition = false;

  /** @type {number|null} Last tracked day for re-render */
  #lastDay = null;

  /** @type {Array} Cached live events */
  #liveEvents = [];

  /** @type {number|null} Debounce timer for bar re-render */
  #barRenderDebounce = null;

  /** @type {boolean} Whether combat is currently active */
  #inCombat = false;

  /** @type {Function|null} Debounced resize handler for window resize */
  #resizeHandler = null;

  /** @type {Function|null} Debounced fullscreen change handler */
  #fullscreenHandler = null;

  /** @type {object|null} Currently active sticky zone during drag */
  #activeSnapZone = null;

  /** @type {string|null} ID of zone HUD is currently snapped to */
  #snappedZoneId = null;

  /** @type {HudSceneRenderer|null} Pixi scene renderer (sky/stars/weather/sun/moon) */
  #sceneRenderer = null;

  /** @type {string|null} Last tracked mode state for position handling */
  #lastModeState = null;

  /** @type {number|null} Last tracked width for center-based positioning */
  #lastWidth = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-hud',
    classes: ['calendaria', 'calendaria-hud'],
    position: { width: 'auto', height: 'auto' },
    window: { frame: false, positioned: true },
    actions: {
      openSunDial: HUD.#onOpenSunDial,
      openNoteViewer: HUD.#onOpenNoteViewer,
      addNote: HUD.#onAddNote,
      openEvent: HUD.#onOpenEvent,
      toggleTimeFlow: HUD.#onToggleTimeFlow,
      showBigCal: HUD.#onShowBigCal,
      openMiniCal: HUD.#onOpenMiniCal,
      openChronicle: HUD.#onOpenChronicle,
      openSettings: HUD.#onOpenSettings,
      openWeatherPicker: HUD.#onOpenWeatherPicker,
      toSunrise: HUD.#onToSunrise,
      toMidday: HUD.#onToMidday,
      toSunset: HUD.#onToSunset,
      toMidnight: HUD.#onToMidnight,
      reverse: HUD.#onReverse,
      forward: HUD.#onForward,
      customDec2: HUD.#onCustomDec2,
      customDec1: HUD.#onCustomDec1,
      customInc1: HUD.#onCustomInc1,
      customInc2: HUD.#onCustomInc2,
      setDate: HUD.#onSetDate
    }
  };

  /** @override */
  static PARTS = {
    container: { template: TEMPLATES.CALENDAR_HUD },
    dome: { template: TEMPLATES.CALENDAR_HUD_DOME, container: '.content' },
    bar: { template: TEMPLATES.CALENDAR_HUD_BAR, container: '.content' }
  };

  /**
   * Get the active calendar.
   * @returns {object} The active calendar instance
   */
  get calendar() {
    return CalendarManager.getActiveCalendar();
  }

  /**
   * Whether position is locked via settings or sticky.
   * @returns {boolean} True if position is locked
   */
  get isLocked() {
    return this.#stickyPosition || game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_LOCKED);
  }

  /**
   * Whether compact mode is enabled.
   * @returns {boolean} True if compact mode is enabled
   */
  get isCompact() {
    return game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE) === 'compact';
  }

  /**
   * Whether to use slice mode instead of dome.
   * @returns {boolean} True if slice mode should be used
   */
  get useSliceMode() {
    const dialStyle = game.settings.get(MODULE.ID, SETTINGS.HUD_DIAL_STYLE);
    if (dialStyle === 'slice') return true;
    if (this.isCompact) return true;
    const combatMode = game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_MODE);
    if (this.#inCombat && (combatMode === 'compactCombat' || combatMode === 'compactEncounter')) return true;
    return false;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const components = this.#getPredictedComponents();
    context.isGM = game.user.isGM;
    context.showChronicleButton = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_HUD_BUTTON);
    context.canChangeDateTime = canChangeDateTime();
    context.canChangeWeather = canChangeWeather();
    context.canViewBigCal = canViewBigCal();
    context.canViewMiniCal = canViewMiniCal();
    context.hudCalendarButton = game.settings.get(MODULE.ID, SETTINGS.HUD_CALENDAR_BUTTON);
    context.locked = this.isLocked;
    context.isPlaying = TimeClock.running;
    context.clockDisabled = TimeClock.disabled;
    context.clockLocked = TimeClock.locked || TimeClock.disabled;
    const stickyStates = game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_STATES) || {};
    this.#stickyTray = stickyStates.tray ?? false;
    this.#stickyPosition = stickyStates.position ?? false;
    context.stickyTray = this.#stickyTray;
    context.domeBelow = game.settings.get(MODULE.ID, SETTINGS.HUD_DOME_BELOW);
    context.trayUp = game.settings.get(MODULE.ID, SETTINGS.HUD_TRAY_DIRECTION) === 'up';
    const appSettings = TimeClock.getAppSettings('calendaria-hud');
    if (stickyStates.increment && stickyStates.increment !== appSettings.incrementKey) {
      TimeClock.setAppIncrement('calendaria-hud', stickyStates.increment);
      TimeClock.setIncrement(stickyStates.increment);
    }
    const timeFormatted = this.#formatTime(components);
    context.time = stripMoonIconMarkers(timeFormatted);
    context.timeHtml = renderMoonIcons(timeFormatted);
    const dateFormatted = this.#formatDateDisplay(components);
    context.dateDisplay = stripMoonIconMarkers(dateFormatted);
    context.dateDisplayHtml = renderMoonIcons(dateFormatted);
    context.dateCompressed = context.dateDisplay.length > 35;
    const yearZero = calendar?.years?.yearZero ?? 0;
    context.dateEquivalentHtml = getEquivalentDateTooltip(components.year + yearZero, components.month, components.dayOfMonth ?? 0);
    const showWeatherBlock = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_WEATHER);
    const showSeasonBlock = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_SEASON);
    const showEraBlock = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_ERA);
    const isCompact = this.isCompact;
    const weatherDisplayMode = isCompact ? 'icon' : game.settings.get(MODULE.ID, SETTINGS.HUD_WEATHER_DISPLAY_MODE);
    const seasonDisplayMode = isCompact ? 'icon' : game.settings.get(MODULE.ID, SETTINGS.HUD_SEASON_DISPLAY_MODE);
    context.seasonDisplayMode = seasonDisplayMode;
    const season = calendar?.getCurrentSeason?.();
    context.currentSeason = showSeasonBlock && season ? { name: localize(season.name), color: season.color || '#888', icon: season.icon || 'fas fa-sun' } : null;
    context.showSeasonIcon = seasonDisplayMode === 'full' || seasonDisplayMode === 'icon';
    context.showSeasonLabel = seasonDisplayMode === 'full' || seasonDisplayMode === 'text';
    const eraDisplayMode = isCompact ? 'icon' : game.settings.get(MODULE.ID, SETTINGS.HUD_ERA_DISPLAY_MODE);
    context.eraDisplayMode = eraDisplayMode;
    const era = calendar?.getCurrentEra?.();
    context.currentEra = showEraBlock && era ? { name: localize(era.name), abbreviation: localize(era.abbreviation || era.name), icon: 'fas fa-hourglass-half' } : null;
    context.showEraIcon = eraDisplayMode === 'full' || eraDisplayMode === 'icon';
    context.showEraLabel = eraDisplayMode === 'full' || eraDisplayMode === 'text';
    context.showEraAbbr = eraDisplayMode === 'abbr';
    const showCyclesBlock = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_CYCLES);
    const cyclesDisplayMode = isCompact ? 'icon' : game.settings.get(MODULE.ID, SETTINGS.HUD_CYCLES_DISPLAY_MODE);
    const cycleData = calendar?.getCycleValues?.();
    context.cycleData = showCyclesBlock && cycleData?.values?.length ? cycleData : null;
    context.cycleText = showCyclesBlock ? cycleData?.text || null : null;
    context.cyclesDisplayMode = cyclesDisplayMode;
    const weatherData = this.#getWeatherContext();
    context.weather = showWeatherBlock ? weatherData : null;
    context.showWeatherBlock = showWeatherBlock;
    context.weatherDisplayMode = weatherDisplayMode;
    context.showWeatherIcon = weatherDisplayMode === 'full' || weatherDisplayMode === 'icon' || weatherDisplayMode === 'iconTemp';
    context.showWeatherLabel = weatherDisplayMode === 'full';
    context.showWeatherTemp = weatherDisplayMode === 'full' || weatherDisplayMode === 'temp' || weatherDisplayMode === 'iconTemp';
    this.#liveEvents = this.#getLiveEvents();
    context.hasEvents = this.#liveEvents.length > 0;
    context.liveEvents = this.#liveEvents;
    context.borderGlow = game.settings.get(MODULE.ID, SETTINGS.HUD_BORDER_GLOW);
    context.firstEventColor = this.#liveEvents[0]?.color || null;
    context.currentEvent = this.#liveEvents.length > 0 ? this.#liveEvents[0] : null;
    const isMonthless = calendar?.isMonthless ?? false;
    context.increments = Object.entries(getTimeIncrements())
      .filter(([key]) => !isMonthless || key !== 'month')
      .map(([key, seconds]) => ({ key, label: this.#formatIncrementLabel(key), seconds, selected: key === appSettings.incrementKey }));
    const customJumps = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_TIME_JUMPS) || {};
    const currentJumps = customJumps[appSettings.incrementKey] || {};
    context.customJumps = { dec2: currentJumps.dec2 ?? null, dec1: currentJumps.dec1 ?? null, inc1: currentJumps.inc1 ?? null, inc2: currentJumps.inc2 ?? null };
    context.useSliceMode = this.useSliceMode;
    context.inCombat = this.#inCombat;
    context.widgets = this.#prepareWidgetContext(context);
    return context;
  }

  /**
   * Prepare widget context for template rendering.
   * @param {object} context - Main context object
   * @returns {object} Widget HTML strings
   */
  #prepareWidgetContext(context) {
    const widgets = {};
    widgets.buttonsLeft = renderWidgetsForPoint(WIDGET_POINTS.HUD_BUTTONS_LEFT, 'hud');
    widgets.buttonsRight = renderWidgetsForPoint(WIDGET_POINTS.HUD_BUTTONS_RIGHT, 'hud');
    widgets.indicators = renderWidgetsForPoint(WIDGET_POINTS.HUD_INDICATORS, 'hud');
    widgets.tray = renderWidgetsForPoint(WIDGET_POINTS.HUD_TRAY, 'hud');
    const weatherObj = context.weather ? { ...context.weather, temperature: context.weather.temp } : null;
    widgets.weatherIndicator = renderReplacementOrOriginal(
      REPLACEABLE_ELEMENTS.WEATHER_INDICATOR,
      renderWeatherIndicator({ weather: weatherObj, displayMode: context.weatherDisplayMode, canInteract: context.canChangeWeather, showBlock: context.showWeatherBlock }),
      'hud'
    );
    widgets.seasonIndicator = renderReplacementOrOriginal(
      REPLACEABLE_ELEMENTS.SEASON_INDICATOR,
      renderSeasonIndicator({ season: context.currentSeason, displayMode: context.seasonDisplayMode }),
      'hud'
    );
    widgets.eraIndicator = renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.ERA_INDICATOR, renderEraIndicator({ era: context.currentEra, displayMode: context.eraDisplayMode }), 'hud');
    widgets.cycleIndicator = renderReplacementOrOriginal(
      REPLACEABLE_ELEMENTS.CYCLE_INDICATOR,
      renderCycleIndicator({ cycleData: context.cycleData, displayMode: context.cyclesDisplayMode, cycleText: context.cycleText }),
      'hud'
    );
    return widgets;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.classList.toggle('compact', this.isCompact);
    this.element.classList.toggle('slice-mode', this.useSliceMode);
    this.element.classList.toggle('dome-below', game.settings.get(MODULE.ID, SETTINGS.HUD_DOME_BELOW));
    if (!this.isCompact) this.element.style.setProperty('--hud-width-scale', game.settings.get(MODULE.ID, SETTINGS.HUD_WIDTH_SCALE));
    else this.element.style.removeProperty('--hud-width-scale');
    const currentModeState = `${this.isCompact}-${this.useSliceMode}`;
    if (options.isFirstRender) {
      this.#restorePosition();
      this.#lastModeState = currentModeState;
      this.#lastWidth = this.element.getBoundingClientRect().width;
    } else if (this.#lastModeState !== currentModeState) {
      if (this.#sceneRenderer) {
        this.#sceneRenderer.destroy();
        this.#sceneRenderer = null;
      }
      this.#handleModeChange();
      this.#lastModeState = currentModeState;
      this.#lastWidth = this.element.getBoundingClientRect().width;
    } else {
      this.#recenterIfWidthChanged();
    }
    this.#enableDragging();
    this.#updateCelestialDisplay();
    this.#updateDomeVisibility();
    this.#setupEventListeners();
    this.#updateTooltipDirections();
    attachWidgetListeners(this.element);
    if (!this.#timeHookId) this.#timeHookId = Hooks.on(HOOKS.VISUAL_TICK, this.#onVisualTick.bind(this));
    if (!this.#worldTimeHookId) this.#worldTimeHookId = Hooks.on(HOOKS.WORLD_TIME_UPDATED, this.#onWorldTimeUpdated.bind(this));
    const c = this.#getPredictedComponents();
    this.#lastDay = `${c.year}-${c.month}-${c.dayOfMonth}`;
  }

  /** Update tooltip directions based on HUD position. */
  #updateTooltipDirections() {
    const bar = this.element.querySelector('.bar');
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const inBottomHalf = barRect.top > window.innerHeight / 2;
    const direction = inBottomHalf ? 'UP' : null;
    const tooltipEls = [...bar.querySelectorAll('[data-tooltip], [data-tooltip-html]')];
    const dome = this.element.querySelector('.dome[data-tooltip]');
    if (dome) tooltipEls.push(dome);
    for (const el of tooltipEls) {
      if (direction) el.setAttribute('data-tooltip-direction', direction);
      else el.removeAttribute('data-tooltip-direction');
    }
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#restoreStickyStates();
    this.#hooks.push({ name: HOOKS.CLOCK_START_STOP, id: Hooks.on(HOOKS.CLOCK_START_STOP, () => this.#onClockStateChange()) });
    this.#hooks.push({ name: HOOKS.WEATHER_CHANGE, id: Hooks.on(HOOKS.WEATHER_CHANGE, () => this.render({ parts: ['dome', 'bar'] })) });
    this.#hooks.push({ name: HOOKS.WIDGETS_REFRESH, id: Hooks.on(HOOKS.WIDGETS_REFRESH, () => this.render({ parts: ['bar'] })) });
    this.#hooks.push({
      name: 'updateScene',
      id: Hooks.on('updateScene', (_scene, change) => {
        if (change.active) this.render({ parts: ['dome', 'bar'] });
      })
    });
    const debouncedRender = foundry.utils.debounce(() => this.render({ parts: ['bar'] }), 100);
    this.#hooks.push({
      name: 'updateJournalEntryPage',
      id: Hooks.on('updateJournalEntryPage', (page) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });
    this.#hooks.push({
      name: 'updateJournalEntry',
      id: Hooks.on('updateJournalEntry', (journal, changes) => {
        if (changes.ownership && journal.getFlag?.(MODULE.ID, 'isCalendarNote')) debouncedRender();
      })
    });
    this.#hooks.push({
      name: 'createJournalEntry',
      id: Hooks.on('createJournalEntry', (journal) => {
        if (journal.getFlag?.(MODULE.ID, 'isCalendarNote')) debouncedRender();
      })
    });
    this.#hooks.push({
      name: 'deleteJournalEntry',
      id: Hooks.on('deleteJournalEntry', (journal) => {
        if (journal.getFlag?.(MODULE.ID, 'isCalendarNote') || journal.pages.some((p) => p.type === 'calendaria.calendarnote')) debouncedRender();
      })
    });
    this.#hooks.push({
      name: 'createJournalEntryPage',
      id: Hooks.on('createJournalEntryPage', (page) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });
    this.#hooks.push({
      name: HOOKS.DISPLAY_FORMATS_CHANGED,
      id: Hooks.on(HOOKS.DISPLAY_FORMATS_CHANGED, () => this.render({ parts: ['bar'] }))
    });
    this.#hooks.push({
      name: 'combatStart',
      id: Hooks.on('combatStart', () => this.#onCombatChange(true))
    });
    this.#hooks.push({
      name: 'createCombat',
      id: Hooks.on('createCombat', () => this.#onEncounterChange(true))
    });
    this.#hooks.push({
      name: 'deleteCombat',
      id: Hooks.on('deleteCombat', () => {
        this.#onCombatChange(false);
        this.#onEncounterChange(false);
      })
    });
    this.#hooks.push({
      name: 'updateCombat',
      id: Hooks.on('updateCombat', () => this.#onCombatChange(!!game.combat?.started))
    });
    this.#inCombat = !!game.combat?.started;
    this.#resizeHandler = foundry.utils.debounce(() => requestAnimationFrame(() => this.#onViewportResize()), 200);
    window.addEventListener('resize', this.#resizeHandler);
    this.#fullscreenHandler = foundry.utils.debounce(() => this.#onViewportResize(), 50);
    document.addEventListener('fullscreenchange', this.#fullscreenHandler);
  }

  /**
   * Handle combat state changes for auto-compact and auto-hide.
   * @param {boolean} inCombat - Whether combat is now active
   */
  #onCombatChange(inCombat) {
    if (this.#inCombat === inCombat) return;
    this.#inCombat = inCombat;
    const mode = game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_MODE);
    if (mode === 'compactCombat' || mode === 'compactEncounter') this.render();
  }

  /**
   * Handle encounter creation/deletion for encounter-level modes.
   * @param {boolean} created - Whether an encounter was created
   */
  #onEncounterChange(created) {
    const mode = game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_MODE);
    if (mode === 'compactEncounter') {
      if (created) this.render();
      else if (!game.combat) this.render();
    }
  }

  /** @override */
  async close(options = {}) {
    if (!options.combat && !game.user.isGM && game.settings.get(MODULE.ID, SETTINGS.FORCE_HUD)) {
      ui.notifications.warn('CALENDARIA.Common.ForcedDisplayWarning', { localize: true });
      return;
    }
    return super.close({ animate: false, ...options });
  }

  /** @override */
  async _onClose(options) {
    if (this.#timeHookId) {
      Hooks.off(HOOKS.VISUAL_TICK, this.#timeHookId);
      this.#timeHookId = null;
    }
    if (this.#worldTimeHookId) {
      Hooks.off(HOOKS.WORLD_TIME_UPDATED, this.#worldTimeHookId);
      this.#worldTimeHookId = null;
    }
    if (this.#resizeHandler) {
      window.removeEventListener('resize', this.#resizeHandler);
      this.#resizeHandler = null;
    }
    if (this.#fullscreenHandler) {
      document.removeEventListener('fullscreenchange', this.#fullscreenHandler);
      this.#fullscreenHandler = null;
    }
    if (this.#sceneRenderer) {
      this.#sceneRenderer.destroy();
      this.#sceneRenderer = null;
    }
    unregisterFromZoneUpdates(this);
    unpinFromZone(this.element);
    cleanupSnapIndicator();
    this.#hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
    this.#hooks = [];
    await super._onClose(options);
  }

  /**
   * Setup event listeners for the HUD.
   */
  #setupEventListeners() {
    const incrementSelect = this.element.querySelector('.select[data-action="setIncrement"]');
    incrementSelect?.addEventListener('change', async (event) => {
      TimeClock.setAppIncrement('calendaria-hud', event.target.value);
      TimeClock.setIncrement(event.target.value);
      await this.#saveStickyStates();
      this.render({ parts: ['bar'] });
    });
    if (incrementSelect && canChangeDateTime()) {
      incrementSelect.addEventListener(
        'wheel',
        async (event) => {
          event.preventDefault();
          const incrementKeys = Object.keys(getTimeIncrements());
          const currentKey = TimeClock.getAppSettings('calendaria-hud').incrementKey || 'minute';
          const currentIndex = incrementKeys.indexOf(currentKey);
          if (currentIndex === -1) return;
          const direction = event.deltaY < 0 ? -1 : 1;
          const newIndex = Math.max(0, Math.min(incrementKeys.length - 1, currentIndex + direction));
          if (newIndex === currentIndex) return;
          const newKey = incrementKeys[newIndex];
          TimeClock.setAppIncrement('calendaria-hud', newKey);
          TimeClock.setIncrement(newKey);
          await this.#saveStickyStates();
          this.render({ parts: ['bar'] });
        },
        { passive: false }
      );
    }
    const timeDisplay = this.element.querySelector('.time');
    if (timeDisplay && canChangeDateTime()) {
      timeDisplay.addEventListener(
        'wheel',
        async (event) => {
          event.preventDefault();
          const incrementKeys = Object.keys(getTimeIncrements());
          const currentKey = TimeClock.getAppSettings('calendaria-hud').incrementKey || 'minute';
          const currentIndex = incrementKeys.indexOf(currentKey);
          if (currentIndex === -1) return;
          const direction = event.deltaY < 0 ? 1 : -1;
          const newIndex = Math.max(0, Math.min(incrementKeys.length - 1, currentIndex + direction));
          if (newIndex === currentIndex) return;
          const newKey = incrementKeys[newIndex];
          TimeClock.setAppIncrement('calendaria-hud', newKey);
          TimeClock.setIncrement(newKey);
          await this.#saveStickyStates();
          this.render({ parts: ['bar'] });
        },
        { passive: false }
      );
    }
    const dome = this.element.querySelector('.dome');
    if (dome) {
      dome.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          SunDial.show({ closeOnClickOutside: true });
        }
      });
    }
    const bar = this.element.querySelector('.bar');
    bar?.addEventListener('dblclick', (e) => {
      e.preventDefault();
      game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE, this.isCompact ? 'fullsize' : 'compact');
    });
    bar?.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#context-menu')) return;
      e.preventDefault();
      document.getElementById('context-menu')?.remove();
      const menu = new foundry.applications.ux.ContextMenu.implementation(this.element, '.bar', this.#getContextMenuItems(), { fixed: true, jQuery: false });
      menu._onActivate(e);
    });
  }

  /**
   * Build context menu items for the HUD bar.
   * @returns {object[]} Array of context menu item definitions
   */
  #getContextMenuItems() {
    const items = [];
    items.push({
      name: 'CALENDARIA.HUD.ContextMenu.Settings',
      icon: '<i class="fas fa-gear"></i>',
      callback: () => {
        const panel = new SettingsPanel();
        panel.render(true).then(() => {
          requestAnimationFrame(() => panel.changeTab('hud', 'primary'));
        });
      }
    });
    if (game.user.isGM) {
      const forceHUD = game.settings.get(MODULE.ID, SETTINGS.FORCE_HUD);
      items.push({
        name: forceHUD ? 'CALENDARIA.Common.HideFromAll' : 'CALENDARIA.Common.ShowToAll',
        icon: forceHUD ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>',
        callback: async () => {
          const newValue = !forceHUD;
          if (newValue) warnShowToAll('viewHUD', game.i18n.localize('CALENDARIA.Permissions.ViewHUD'));
          await game.settings.set(MODULE.ID, SETTINGS.FORCE_HUD, newValue);
          CalendariaSocket.emit(SOCKET_TYPES.HUD_VISIBILITY, { visible: newValue });
        }
      });
    }
    items.push({ name: 'CALENDARIA.Common.ResetPosition', icon: '<i class="fas fa-arrows-to-dot"></i>', callback: () => HUD.resetPosition() });
    items.push({
      name: this.#stickyPosition ? 'CALENDARIA.Common.UnlockPosition' : 'CALENDARIA.Common.LockPosition',
      icon: this.#stickyPosition ? '<i class="fas fa-lock-open"></i>' : '<i class="fas fa-lock"></i>',
      callback: () => this._toggleStickyPosition()
    });
    items.push({
      name: this.isCompact ? 'CALENDARIA.HUD.ContextMenu.FullsizeMode' : 'CALENDARIA.HUD.ContextMenu.CompactMode',
      icon: this.isCompact ? '<i class="fas fa-expand"></i>' : '<i class="fas fa-compress"></i>',
      callback: () => {
        const newMode = this.isCompact ? 'fullsize' : 'compact';
        game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE, newMode);
      }
    });
    items.push(buildOpenAppsMenuItem());
    items.push({ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => HUD.hide() });
    return items;
  }

  /**
   * Restore sticky states from settings.
   */
  #restoreStickyStates() {
    const states = game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_STATES);
    if (!states) return;
    this.#stickyTray = states.tray ?? false;
    this.#stickyPosition = states.position ?? false;
    if (states.increment) {
      TimeClock.setAppIncrement('calendaria-hud', states.increment);
      TimeClock.setIncrement(states.increment);
    }
    if (this.#stickyTray) {
      const tray = this.element.querySelector('.tray');
      tray?.classList.add('visible');
    }
  }

  /**
   * Save sticky states to settings.
   */
  async #saveStickyStates() {
    await game.settings.set(MODULE.ID, SETTINGS.HUD_STICKY_STATES, { tray: this.#stickyTray, position: this.#stickyPosition, increment: TimeClock.getAppSettings('calendaria-hud').incrementKey });
  }

  /**
   * Toggle sticky tray.
   */
  _toggleStickyTray() {
    this.#stickyTray = !this.#stickyTray;
    const tray = this.element.querySelector('.tray');
    tray?.classList.toggle('visible', this.#stickyTray);
    this._updatePinButtonState();
    this.#saveStickyStates();
  }

  /**
   * Toggle sticky position.
   */
  _toggleStickyPosition() {
    this.#stickyPosition = !this.#stickyPosition;
    const bar = this.element.querySelector('.bar');
    bar?.classList.toggle('locked', this.#stickyPosition);
    this._updatePinButtonState();
    this.#saveStickyStates();
  }

  /**
   * Update pin button visual state.
   */
  _updatePinButtonState() {
    const pinBtn = this.element.querySelector('.pin-btn');
    if (!pinBtn) return;
    const hasAnySticky = this.#stickyTray || this.#stickyPosition;
    pinBtn.classList.toggle('has-sticky', hasAnySticky);
    pinBtn.classList.toggle('sticky-tray', this.#stickyTray);
    pinBtn.classList.toggle('sticky-position', this.#stickyPosition);
  }

  /**
   * Restore saved position from settings.
   */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION);
    if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
      this.#snappedZoneId = savedPos.zoneId || null;
      if (this.#snappedZoneId && restorePinnedState(this.element, this.#snappedZoneId)) {
        registerForZoneUpdates(this, this.#snappedZoneId);
        return;
      }
      if (this.#snappedZoneId) {
        const rect = this.element.getBoundingClientRect();
        const barEl = this.element.querySelector('.bar');
        const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
        const zonePos = getRestorePosition(this.#snappedZoneId, rect.width, barHeight);
        if (zonePos) {
          let newTop = zonePos.top;
          if (isBottomAnchored(this.#snappedZoneId) && typeof savedPos.anchorY === 'number') {
            newTop = savedPos.anchorY - barHeight;
          }
          this.setPosition({ left: zonePos.left, top: newTop });
          registerForZoneUpdates(this, this.#snappedZoneId);
          return;
        }
      }
      if (typeof savedPos.centerX === 'number' && typeof savedPos.centerY === 'number') {
        const rect = this.element.getBoundingClientRect();
        const left = savedPos.centerX - rect.width / 2;
        const top = savedPos.centerY - rect.height / 2;
        this.setPosition({ left, top });
      } else {
        this.setPosition({ left: savedPos.left, top: savedPos.top });
      }
    } else {
      const rect = this.element.getBoundingClientRect();
      const left = (window.innerWidth - rect.width) / 2;
      const top = 75;
      this.setPosition({ left, top });
    }
    this.#clampToViewport();
    if (!this.#snappedZoneId) {
      this.#snappedZoneId = this.#detectCurrentZone();
      if (this.#snappedZoneId) {
        registerForZoneUpdates(this, this.#snappedZoneId);
        const posData = { left: this.position.left, top: this.position.top, zoneId: this.#snappedZoneId };
        if (isBottomAnchored(this.#snappedZoneId)) {
          const barEl = this.element.querySelector('.bar');
          if (barEl) posData.anchorY = barEl.getBoundingClientRect().bottom;
        }
        game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, posData);
      }
    }
  }

  /**
   * Detect if current position matches a sticky zone.
   * @returns {string|null} Zone ID if matched, null otherwise
   */
  #detectCurrentZone() {
    const rect = this.element.getBoundingClientRect();
    const barEl = this.element.querySelector('.bar');
    const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + barHeight / 2;
    const zone = getActiveZone(centerX, centerY, rect.width, barHeight);
    return zone?.id || null;
  }

  /**
   * Handle display mode change by recalculating position to maintain center point.
   */
  #handleModeChange() {
    if (!this.#snappedZoneId) this.#snappedZoneId = this.#detectCurrentZone();
    if (this.#snappedZoneId && usesDomParenting(this.#snappedZoneId)) return;
    const rect = this.element.getBoundingClientRect();
    if (this.#snappedZoneId) {
      const barEl = this.element.querySelector('.bar');
      const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
      const zonePos = getRestorePosition(this.#snappedZoneId, rect.width, barHeight);
      if (zonePos) {
        let newLeft = zonePos.left;
        let newTop = zonePos.top;
        let anchorY = null;
        if (isBottomAnchored(this.#snappedZoneId)) {
          const savedPos = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION);
          anchorY = savedPos?.anchorY;
          if (typeof anchorY === 'number') newTop = anchorY - barHeight;
        }
        this.setPosition({ left: newLeft, top: newTop });
        const posData = { left: newLeft, top: newTop, zoneId: this.#snappedZoneId };
        if (anchorY) posData.anchorY = anchorY;
        game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, posData);
      }
    } else {
      const savedPos = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION);
      if (savedPos && typeof savedPos.centerX === 'number' && typeof savedPos.centerY === 'number') {
        const newLeft = savedPos.centerX - rect.width / 2;
        const newTop = savedPos.centerY - rect.height / 2;
        this.setPosition({ left: newLeft, top: newTop });
        game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, { left: newLeft, top: newTop, centerX: savedPos.centerX, centerY: savedPos.centerY, zoneId: null });
      }
    }
    this.#clampToViewport();
  }

  /**
   * Recenter the HUD if width changed (for center-based positioning or snap zones).
   */
  #recenterIfWidthChanged() {
    if (this.isLocked) return;
    const currentWidth = this.element.getBoundingClientRect().width;
    if (this.#lastWidth !== null && Math.abs(currentWidth - this.#lastWidth) > 1) {
      if (this.#snappedZoneId) {
        const rect = this.element.getBoundingClientRect();
        const barEl = this.element.querySelector('.bar');
        const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
        const zonePos = getRestorePosition(this.#snappedZoneId, currentWidth, barHeight);
        if (zonePos) {
          let newTop = zonePos.top;
          if (isBottomAnchored(this.#snappedZoneId)) {
            const savedPos = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION);
            if (typeof savedPos?.anchorY === 'number') newTop = savedPos.anchorY - barHeight;
          }
          this.setPosition({ left: zonePos.left, top: newTop });
        }
      } else {
        const savedPos = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION);
        if (savedPos && typeof savedPos.centerX === 'number' && typeof savedPos.centerY === 'number') {
          const newLeft = savedPos.centerX - currentWidth / 2;
          const newTop = savedPos.centerY - this.element.getBoundingClientRect().height / 2;
          this.setPosition({ left: newLeft, top: newTop });
          this.#clampToViewport();
        }
      }
    }
    this.#lastWidth = currentWidth;
  }

  /**
   * Clamp position to viewport.
   */
  #clampToViewport() {
    const rect = this.element.getBoundingClientRect();
    const rightBuffer = getSidebarBuffer();
    let { left, top } = this.position;
    left = Math.max(0, Math.min(left, window.innerWidth - rect.width - rightBuffer));
    top = Math.max(0, Math.min(top, window.innerHeight - rect.height));
    this.setPosition({ left, top });
  }

  /**
   * Handle viewport resize (fullscreen toggle, window resize).
   */
  #onViewportResize() {
    if (!this.rendered || !this.element) return;
    if (this.#snappedZoneId && usesDomParenting(this.#snappedZoneId)) return;
    const rect = this.element.getBoundingClientRect();
    const barEl = this.element.querySelector('.bar');
    const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
    if (this.#snappedZoneId) {
      const zonePos = getRestorePosition(this.#snappedZoneId, rect.width, barHeight);
      if (zonePos) {
        let newTop = zonePos.top;
        if (isBottomAnchored(this.#snappedZoneId)) {
          const savedPos = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION);
          if (typeof savedPos?.anchorY === 'number') {
            const hotbar = document.getElementById('hotbar');
            if (hotbar) {
              const hotbarRect = hotbar.getBoundingClientRect();
              newTop = hotbarRect.top - barHeight;
            }
          }
        }
        this.setPosition({ left: zonePos.left, top: newTop });
      }
    } else {
      const savedPos = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION);
      if (savedPos && typeof savedPos.centerX === 'number' && typeof savedPos.centerY === 'number') {
        const newLeft = savedPos.centerX - rect.width / 2;
        const newTop = savedPos.centerY - rect.height / 2;
        this.setPosition({ left: newLeft, top: newTop });
      }
    }
    this.#clampToViewport();
    this.#updateDomeVisibility();
    updateAllZonePositions();
  }

  /**
   * Enable dragging on the main bar.
   */
  #enableDragging() {
    const dragHandle = this.element.querySelector('.bar');
    if (!dragHandle) return;
    const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, dragHandle, false);
    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartLeft = 0;
    let elementStartTop = 0;
    let previousZoneId = null;
    let hasMoved = false;
    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      if (this.isLocked) return;
      if (event.detail >= 2) return;
      previousZoneId = this.#snappedZoneId;
      hasMoved = false;
      const rect = this.element.getBoundingClientRect();
      elementStartLeft = rect.left;
      elementStartTop = rect.top;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragHandle.classList.add('dragging');
      originalMouseDown(event);
    };
    drag._onDragMouseMove = (event) => {
      event.preventDefault();
      const now = Date.now();
      if (!drag._moveTime) drag._moveTime = 0;
      if (now - drag._moveTime < 1000 / 60) return;
      drag._moveTime = now;
      const deltaX = event.clientX - dragStartX;
      const deltaY = event.clientY - dragStartY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) hasMoved = true;
      const rect = this.element.getBoundingClientRect();
      const rightBuffer = getSidebarBuffer();
      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width - rightBuffer));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      this.setPosition({ left: newLeft, top: newTop });
      this.#updateDomeVisibility();
      const barEl = this.element.querySelector('.bar');
      const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
      this.#activeSnapZone = checkStickyZones(dragHandle, newLeft, newTop, rect.width, barHeight);
    };
    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);
      dragHandle.classList.remove('dragging');
      hideSnapIndicator();
      if (!hasMoved) {
        dragHandle.classList.remove(WOBBLE_CLASS);
        this.#activeSnapZone = null;
        previousZoneId = null;
        return;
      }
      const rect = this.element.getBoundingClientRect();
      const barEl = this.element.querySelector('.bar');
      const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
      const result = finalizeDrag(dragHandle, this.#activeSnapZone, this, rect.width, barHeight, previousZoneId);
      this.#snappedZoneId = result.zoneId;
      registerForZoneUpdates(this, this.#snappedZoneId);
      this.#activeSnapZone = null;
      previousZoneId = null;
      const posData = { left: this.position.left, top: this.position.top, zoneId: this.#snappedZoneId };
      if (!this.#snappedZoneId) {
        posData.centerX = this.position.left + rect.width / 2;
        posData.centerY = this.position.top + rect.height / 2;
      } else if (isBottomAnchored(this.#snappedZoneId)) {
        const barEl = this.element.querySelector('.bar');
        if (barEl) posData.anchorY = barEl.getBoundingClientRect().bottom;
      }
      await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, posData);
    };
  }

  /**
   * Update dome visibility based on viewport position.
   */
  #updateDomeVisibility() {
    const dome = this.element.querySelector('.dome');
    if (!dome) return;
    if (!game.settings.get(MODULE.ID, SETTINGS.HUD_DOME_AUTO_HIDE) || game.settings.get(MODULE.ID, SETTINGS.HUD_DOME_BELOW)) {
      dome.classList.remove('hidden');
      dome.style.opacity = '';
      return;
    }
    const domeHeight = this.isCompact ? 60 : 80;
    const minVisibleHeight = 20;
    const hudTop = this.position.top;
    const domeTop = hudTop - domeHeight + (this.isCompact ? 10 : 14);
    if (domeTop < -domeHeight + minVisibleHeight) {
      dome.classList.add('hidden');
    } else if (domeTop < 0) {
      dome.classList.remove('hidden');
      const visibility = 1 + domeTop / domeHeight;
      dome.style.opacity = Math.max(0, Math.min(1, visibility));
    } else {
      dome.classList.remove('hidden');
      dome.style.opacity = '';
    }
  }

  /**
   * Update the sundial dome/slice display via the unified scene renderer.
   */
  #updateCelestialDisplay() {
    const components = this.#getPredictedComponents();
    const hour = this.#getDecimalHour(components);
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const sunrise = this.calendar?.sunrise?.(undefined, zone) ?? hoursPerDay / 4;
    const sunset = this.calendar?.sunset?.(undefined, zone) ?? (hoursPerDay * 3) / 4;
    const useSlice = this.useSliceMode;
    const selector = useSlice ? '.slice-canvas' : '.scene-canvas';
    this.#updateSceneRenderer(selector, useSlice ? 'slice' : 'dome');
    const skyColors = getSkyColorsRgb(hour, this.calendar);
    const tintedColors = applyWeatherSkyTint(skyColors);
    const starAlpha = computeStarAlpha(hour, sunrise, sunset);
    const moons = [];
    const calendar = this.calendar;
    if (calendar) {
      const moonsArray = calendar.moonsArray;
      const showAll = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_ALL_MOONS);
      const moonList = showAll ? moonsArray : (moonsArray?.slice(0, 1) ?? []);
      for (let mi = 0; mi < moonList.length; mi++) {
        const moon = moonList[mi];
        const phase = getMoonPhasePosition(moon, components, calendar);
        moons.push({ phase, color: moon.color || null, name: moon.name || '' });
      }
    }
    if (this.#sceneRenderer) this.#sceneRenderer.update({ hour, sunrise, sunset, hoursPerDay, moons, skyColors: tintedColors, starAlpha });
  }

  /**
   * Resolve visual and sky overrides for a preset.
   * @param {object|null} preset - The weather preset object
   * @returns {{visualOverrides: object|null, skyOverrides: object|null}} Resolved overrides
   */
  #resolveOverrides(preset) {
    if (!preset) return { hudEffect: null, visualOverrides: null, skyOverrides: null };
    if (preset.category === 'custom') return { hudEffect: preset.hudEffect || null, visualOverrides: preset.visualOverrides || null, skyOverrides: preset.skyOverrides || null };
    const overrides = game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {};
    const entry = overrides[preset.id];
    if (!entry) return { hudEffect: null, visualOverrides: null, skyOverrides: null };
    return { hudEffect: entry.hudEffect || null, visualOverrides: entry.visualOverrides || null, skyOverrides: entry.skyOverrides || null };
  }

  /**
   * Update the scene renderer for a given canvas selector and mode.
   * @param {string} selector - CSS selector for the canvas element
   * @param {string} mode - 'dome' or 'slice'
   */
  #updateSceneRenderer(selector, mode) {
    const canvas = this.element?.querySelector(selector);
    if (!canvas) return;
    if (this.#sceneRenderer && this.#sceneRenderer.canvas !== canvas) {
      this.#sceneRenderer.destroy();
      this.#sceneRenderer = null;
    }
    if (!this.#sceneRenderer) this.#sceneRenderer = new HudSceneRenderer(canvas, mode);
    this.#sceneRenderer.setFlipped(game.settings.get(MODULE.ID, SETTINGS.HUD_DOME_BELOW));
    const weather = WeatherManager.getCurrentWeather(null, game.scenes?.active);
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const preset = weather ? getPreset(weather.id, customPresets) : null;
    const resolved = this.#resolveOverrides(preset);
    const fxMode = game.settings.get(MODULE.ID, SETTINGS.HUD_WEATHER_FX_MODE);
    const fxOff = fxMode === 'off';
    const effect = fxOff ? 'clear' : resolved.hudEffect || preset?.hudEffect || 'clear';
    const densityScale = fxMode === 'reduced' ? REDUCED_FX_DENSITY : 1;
    const { visualOverrides } = resolved;
    const sceneTopDown = game.scenes?.active?.getFlag(MODULE.ID, SCENE_FLAGS.FXMASTER_TOP_DOWN_OVERRIDE);
    const useTopDown = sceneTopDown === 'topdown' || (sceneTopDown !== 'sideview' && game.settings.get(MODULE.ID, SETTINGS.FXMASTER_TOP_DOWN));
    const forceDownward = !useTopDown || game.settings.get(MODULE.ID, SETTINGS.FXMASTER_FORCE_DOWNWARD);
    this.#sceneRenderer.setEffect(
      effect,
      { windSpeed: weather?.wind?.speed ?? 0, windDirection: weather?.wind?.direction ?? 0, precipIntensity: weather?.precipitation?.intensity ?? 0, forceDownward },
      fxOff ? null : visualOverrides,
      densityScale
    );
  }

  /**
   * Get predicted time components for UI display.
   * @returns {object} Time components
   */
  #getPredictedComponents() {
    if (TimeClock.running) {
      const cal = game.time?.calendar;
      if (cal) return cal.timeToComponents(TimeClock.predictedWorldTime);
    }
    return game.time.components;
  }

  /**
   * Handle visual tick — update time/date text and celestial display every 1s.
   */
  #onVisualTick() {
    if (!this.rendered) return;
    const components = this.#getPredictedComponents();
    const predictedDay = `${components.year}-${components.month}-${components.dayOfMonth}`;
    if (this.#lastDay !== null && predictedDay !== this.#lastDay) {
      this.#lastDay = predictedDay;
      if (this.#barRenderDebounce) clearTimeout(this.#barRenderDebounce);
      this.#barRenderDebounce = setTimeout(() => {
        this.#barRenderDebounce = null;
        this.render({ parts: ['bar'] });
      }, 200);
    }
    const timeEl = this.element.querySelector('.time');
    if (timeEl) {
      const timeFormatted = this.#formatTime(components);
      if (hasMoonIconMarkers(timeFormatted)) timeEl.innerHTML = renderMoonIcons(timeFormatted);
      else timeEl.textContent = timeFormatted;
    }
    const dateEl = this.element.querySelector('.date');
    if (dateEl) {
      const dateFormatted = this.#formatDateDisplay(components);
      const dateText = stripMoonIconMarkers(dateFormatted);
      if (hasMoonIconMarkers(dateFormatted)) dateEl.innerHTML = renderMoonIcons(dateFormatted);
      else dateEl.textContent = dateFormatted;
      dateEl.classList.toggle('compressed', dateText.length > 35);
    }
    const hud = this.element.querySelector('.content');
    if (hud) hud.classList.toggle('time-flowing', TimeClock.running);
    this.#updateCelestialDisplay();
  }

  /**
   * Handle real world time update — day-change detection, bar re-render, and display sync.
   */
  #onWorldTimeUpdated() {
    if (!this.rendered) return;
    const components = this.#getPredictedComponents();
    const currentDay = `${components.year}-${components.month}-${components.dayOfMonth}`;
    const dayChanged = this.#lastDay !== null && this.#lastDay !== currentDay;
    if (dayChanged) {
      this.#lastDay = currentDay;
      if (this.#barRenderDebounce) clearTimeout(this.#barRenderDebounce);
      this.#barRenderDebounce = setTimeout(() => {
        this.#barRenderDebounce = null;
        this.render({ parts: ['bar'] });
      }, 200);
    }
    this.#onVisualTick();
  }

  /**
   * Handle clock state changes.
   */
  #onClockStateChange() {
    if (!this.rendered) return;
    const running = TimeClock.running;
    const locked = TimeClock.locked || TimeClock.disabled;
    const hud = this.element.querySelector('.content');
    if (hud) hud.classList.toggle('time-flowing', running);
    const playBtn = this.element.querySelector('.play-btn');
    if (playBtn) {
      playBtn.classList.toggle('playing', running);
      playBtn.classList.toggle('clock-locked', locked);
      playBtn.setAttribute('aria-pressed', String(running));
      const tooltip = TimeClock.disabled
        ? localize('CALENDARIA.TimeClock.Disabled')
        : locked
          ? localize('CALENDARIA.TimeClock.Locked')
          : running
            ? localize('CALENDARIA.HUD.PauseTime')
            : localize('CALENDARIA.TimeKeeper.Start');
      playBtn.dataset.tooltip = tooltip;
      const icon = playBtn.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-play', 'fa-pause', 'fa-lock');
        if (locked) icon.classList.add('fa-lock');
        else if (running) icon.classList.add('fa-pause');
        else icon.classList.add('fa-play');
      }
    }
  }

  /**
   * Get decimal hour from time components.
   * @param {object} components - Time components
   * @returns {number} Decimal hour (0-24)
   */
  #getDecimalHour(components) {
    const cal = game.time.calendar;
    const minutesPerHour = cal?.days?.minutesPerHour ?? 60;
    const secondsPerMinute = cal?.days?.secondsPerMinute ?? 60;
    return (components.hour ?? 0) + (components.minute ?? 0) / minutesPerHour + (components.second ?? 0) / (minutesPerHour * secondsPerMinute);
  }

  /**
   * Format time for display using display format settings.
   * @param {object} components - Time components
   * @returns {string} Formatted time
   */
  #formatTime(components) {
    const calendar = this.calendar;
    if (!calendar) {
      const h = String(components.hour ?? 0).padStart(2, '0');
      const m = String(components.minute ?? 0).padStart(2, '0');
      const s = String(components.second ?? 0).padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
    const yearZero = calendar.years?.yearZero ?? 0;
    return formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: components.dayOfMonth ?? 0 }, 'hudTime');
  }

  /**
   * Format full date display using display format settings.
   * @param {object} components - Time components
   * @returns {string} Formatted date
   */
  #formatDateDisplay(components) {
    const calendar = this.calendar;
    if (!calendar) return '';
    const yearZero = calendar.years?.yearZero ?? 0;
    return formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: components.dayOfMonth ?? 0 }, 'hudDate');
  }

  /**
   * Format increment key for display.
   * @param {string} key - Increment key
   * @returns {string} Localized label
   */
  #formatIncrementLabel(key) {
    const labels = {
      second: localize('CALENDARIA.Common.Second'),
      round: localize('CALENDARIA.Common.Round'),
      minute: localize('CALENDARIA.Common.Minute'),
      hour: localize('CALENDARIA.Common.Hour'),
      day: localize('CALENDARIA.Common.Day'),
      week: localize('CALENDARIA.Common.Week'),
      month: localize('CALENDARIA.Common.Month'),
      season: localize('CALENDARIA.Common.Season'),
      year: localize('CALENDARIA.Common.Year')
    };
    return labels[key] || key;
  }

  /**
   * Get weather context for template.
   * @returns {object|null} Weather data object or null if no weather
   */
  #getWeatherContext() {
    const zone = WeatherManager.getActiveZone(null, game.scenes?.active);
    const zoneId = zone?.id;
    const weather = WeatherManager.getCurrentWeather(zoneId);
    if (!weather) return null;
    let icon = weather.icon || 'fa-cloud';
    if (icon && !icon.includes('fa-solid') && !icon.includes('fa-regular') && !icon.includes('fa-light') && !icon.includes('fas ') && !icon.includes('far ')) icon = `fa-solid ${icon}`;
    const calendarId = this.calendar?.metadata?.id;
    const alias = getPresetAlias(weather.id, calendarId, zoneId);
    const label = alias || localize(weather.label);
    const windSpeed = weather.wind?.speed ?? 0;
    const windDirection = weather.wind?.direction;
    const precipType = weather.precipitation?.type ?? null;
    const temp = WeatherManager.formatTemperature(WeatherManager.getTemperature(zoneId));
    const windKph = weather.wind?.kph ?? null;
    const tooltipArgs = {
      label,
      description: weather.description ? localize(weather.description) : null,
      temp,
      windSpeed,
      windKph,
      windDirection,
      precipType,
      precipIntensity: weather.precipitation?.intensity
    };
    const tooltipHtml = weather.periods ? WeatherManager.buildWeatherTooltipWithPeriods(tooltipArgs, weather.periods, weather.activePeriod) : WeatherManager.buildWeatherTooltip(tooltipArgs);
    return { id: weather.id, label, icon, color: weather.color, temp, tooltipHtml, windSpeed, windKph, windDirection, precipType };
  }

  /**
   * Get live events for the current day.
   * @returns {Array} Array of event objects with id, name, icon, color, tooltip
   */
  #getLiveEvents() {
    const components = game.time.components;
    const calendar = this.calendar;
    if (!calendar) return [];
    const yearZero = calendar.years?.yearZero ?? 0;
    const year = components.year + yearZero;
    const month = components.month;
    const dayOfMonth = components.dayOfMonth ?? 0;
    const notes = getNotesOnDay(year, month, dayOfMonth);
    if (!notes.length) return [];
    const esc = escapeText;
    return notes.slice(0, 5).map((note) => {
      const color = note.system.color || '#e88';
      const lines = [`<strong style="color: ${color}">${esc(note.name)}</strong>`];
      const desc = stripSecrets(note.text?.content);
      if (desc) {
        const snippet = previewSnippet(desc, 120);
        if (snippet) lines.push(`<hr style="margin: 0.25rem 0; border-color: var(--calendaria-border-light)"><span style="font-style: italic">${snippet}</span>`);
      }
      const tooltipHtml = encodeHtmlAttribute(`<div class="calendaria"><div class="day-tooltip">${lines.join('<br>')}</div></div>`);
      return { id: note.id, parentId: note.parent.id, name: note.name, icon: note.system.icon || 'fas fa-star', color, tooltipHtml };
    });
  }

  /**
   * Advance time to a specific hour of day.
   * @param {number} targetHour - Target hour (fractional)
   * @param {boolean} [nextDay] - Always advance to next day
   */
  async #advanceToHour(targetHour, nextDay = false) {
    if (!canChangeDateTime()) return;
    const cal = game.time.calendar;
    if (!cal) return;
    const days = cal.days ?? {};
    const secondsPerMinute = days.secondsPerMinute ?? 60;
    const minutesPerHour = days.minutesPerHour ?? 60;
    const hoursPerDay = days.hoursPerDay ?? 24;
    const secondsPerHour = secondsPerMinute * minutesPerHour;
    const components = game.time.components;
    const currentHour = components.hour + components.minute / minutesPerHour + components.second / secondsPerHour;
    let hoursUntil;
    if (nextDay || currentHour >= targetHour) hoursUntil = hoursPerDay - currentHour + targetHour;
    else hoursUntil = targetHour - currentHour;
    const secondsToAdvance = Math.round(hoursUntil * secondsPerHour);
    if (secondsToAdvance > 0) {
      if (!game.user.isGM) {
        CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: secondsToAdvance });
        return;
      }
      await CinematicOverlay.gatedAdvance(secondsToAdvance);
    }
  }

  /**
   * Handle click on dome to open sun dial.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onOpenSunDial(_event, _target) {
    if (!canChangeDateTime()) return;
    SunDial.show({ closeOnClickOutside: true });
  }

  /**
   * Open the Note Viewer.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onOpenNoteViewer(_event, _target) {
    NoteViewer.toggle();
  }

  /**
   * Handle click on date to open Set Date dialog.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onSetDate(_event, _target) {
    if (!canChangeDateTime()) {
      ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return;
    }
    SetDateDialog.open();
  }

  /**
   * Handle click on add note button to create a new note.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onAddNote(_event, _target) {
    const today = game.time.components;
    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;
    await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: today.year + yearZero, month: today.month, dayOfMonth: today.dayOfMonth ?? 0, hour: today.hour ?? 0, minute: today.minute ?? 0 },
        endDate: { year: today.year + yearZero, month: today.month, dayOfMonth: today.dayOfMonth ?? 0, hour: (today.hour ?? 0) + 1, minute: today.minute ?? 0 }
      },
      source: 'ui'
    });
  }

  /**
   * Handle click on event icon to open the event note.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element with event data
   */
  static #onOpenEvent(_event, target) {
    const pageId = target.dataset.eventId;
    const journalId = target.dataset.parentId;
    const journal = game.journal.get(journalId);
    const page = journal?.pages.get(pageId);
    if (page) page.sheet.render(true, { mode: 'view' });
  }

  /**
   * Handle click on play/pause button to toggle time flow. Shift-click toggles lock.
   * @param {Event} event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onToggleTimeFlow(event, _target) {
    if (event.shiftKey) {
      TimeClock.toggleLock();
      return;
    }
    TimeClock.toggle();
  }

  /**
   * Handle click to show BigCal application.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onShowBigCal(_event, _target) {
    BigCal.show();
  }

  /**
   * Handle click to open MiniCal application.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onOpenMiniCal(_event, _target) {
    MiniCal.show();
  }

  /**
   * Open the Chronicle chronicle.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onOpenChronicle(_event, _target) {
    Chronicle.toggle();
  }

  /**
   * Open the settings panel.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onOpenSettings(_event, _target) {
    new SettingsPanel().render(true);
  }

  /**
   * Handle click to open weather picker.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onOpenWeatherPicker(_event, _target) {
    if (!canChangeWeather()) return;
    new WeatherPickerApp().render({ force: true });
  }

  /**
   * Handle click to advance time to sunrise.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onToSunrise(_event, _target) {
    const calendar = this.calendar;
    if (!calendar?.sunrise) return;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const targetHour = calendar.sunrise(undefined, zone);
    if (targetHour !== null) await this.#advanceToHour(targetHour);
  }

  /**
   * Handle click to advance time to midday.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onToMidday(_event, _target) {
    const calendar = this.calendar;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const targetHour = calendar?.solarMidday?.(undefined, zone) ?? (game.time.calendar?.days?.hoursPerDay ?? 24) / 2;
    await this.#advanceToHour(targetHour);
  }

  /**
   * Handle click to advance time to sunset.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onToSunset(_event, _target) {
    const calendar = this.calendar;
    if (!calendar?.sunset) return;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const targetHour = calendar.sunset(undefined, zone);
    if (targetHour !== null) await this.#advanceToHour(targetHour);
  }

  /**
   * Handle click to advance time to midnight.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onToMidnight(_event, _target) {
    const calendar = this.calendar;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    if (calendar?.solarMidnight) {
      const targetHour = calendar.solarMidnight(undefined, zone);
      const hoursPerDay = game.time.calendar?.days?.hoursPerDay ?? 24;
      if (targetHour >= hoursPerDay) await this.#advanceToHour(targetHour - hoursPerDay, true);
      else await this.#advanceToHour(targetHour);
    } else {
      await this.#advanceToHour(0, true);
    }
  }

  /**
   * Handle click on reverse time button.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onReverse(_event, _target) {
    TimeClock.reverseFor('calendaria-hud');
  }

  /**
   * Handle click on forward time button.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onForward(_event, _target) {
    TimeClock.forwardFor('calendaria-hud');
  }

  /**
   * Handle custom decrement 2 (larger).
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onCustomDec2(_event, _target) {
    HUD.#applyCustomJump('dec2');
  }

  /**
   * Handle custom decrement 1 (smaller).
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onCustomDec1(_event, _target) {
    HUD.#applyCustomJump('dec1');
  }

  /**
   * Handle custom increment 1 (smaller).
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onCustomInc1(_event, _target) {
    HUD.#applyCustomJump('inc1');
  }

  /**
   * Handle custom increment 2 (larger).
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onCustomInc2(_event, _target) {
    HUD.#applyCustomJump('inc2');
  }

  /**
   * Apply a custom time jump based on the current increment.
   * @param {string} jumpKey - The jump key (dec2, dec1, inc1, inc2)
   */
  static #applyCustomJump(jumpKey) {
    if (!canChangeDateTime()) return;
    const appSettings = TimeClock.getAppSettings('calendaria-hud');
    const incrementKey = appSettings.incrementKey || 'minute';
    const customJumps = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_TIME_JUMPS) || {};
    const jumps = customJumps[incrementKey] || {};
    const amount = jumps[jumpKey];
    if (!amount) return;
    const increments = getTimeIncrements();
    const secondsPerUnit = increments[incrementKey] || 60;
    const totalSeconds = amount * secondsPerUnit;
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: totalSeconds });
      return;
    }
    CinematicOverlay.gatedAdvance(totalSeconds);
  }

  /**
   * Get the singleton instance from Foundry's application registry.
   * @returns {HUD|undefined} The instance if it exists
   */
  static get instance() {
    return foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
  }

  /**
   * Show the HUD.
   * @param {object} [options] - Show options
   * @param {boolean} [options.silent] - If true, don't show permission warning
   * @returns {HUD|null} The HUD instance, or null if blocked by combat hide
   */
  static show({ silent = false } = {}) {
    if (!canViewHUD()) {
      if (!silent) ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    if (isCombatBlocked(SETTINGS.HUD_COMBAT_MODE)) return null;
    if (!game.user.isGM && canvas?.scene?.getFlag(MODULE.ID, SCENE_FLAGS.HUD_HIDE_FOR_PLAYERS)) return null;
    const instance = this.instance ?? new HUD();
    instance.render({ force: true });
    return instance;
  }

  /**
   * Hide the HUD.
   */
  static hide() {
    this.instance?.close();
  }

  /**
   * Toggle HUD visibility.
   */
  static toggle() {
    if (this.instance?.rendered) this.hide();
    else this.show();
  }

  /**
   * Reset position to default (centered).
   */
  static async resetPosition() {
    await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, null);
    if (this.instance?.rendered) {
      this.hide();
      this.show();
    }
  }

  /**
   * Update the idle opacity CSS variable from settings.
   */
  static updateIdleOpacity() {
    const autoFade = game.settings.get(MODULE.ID, SETTINGS.HUD_AUTO_FADE);
    const opacity = autoFade ? game.settings.get(MODULE.ID, SETTINGS.HUD_IDLE_OPACITY) / 100 : 1;
    document.documentElement.style.setProperty('--calendaria-hud-idle-opacity', opacity);
  }
}
