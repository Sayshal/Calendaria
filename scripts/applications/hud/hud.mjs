/**
 * HUD - System-agnostic calendar widget.
 * @module Applications/HUD
 * @author Tyler
 */

import CalendarManager from '../../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, REPLACEABLE_ELEMENTS, SCENE_FLAGS, SETTINGS, SOCKET_TYPES, TEMPLATES, WIDGET_POINTS } from '../../constants.mjs';
import NoteManager from '../../notes/note-manager.mjs';
import TimeClock, { getTimeIncrements } from '../../time/time-clock.mjs';
import { formatForLocation, hasMoonIconMarkers, renderMoonIcons, stripMoonIconMarkers, toRomanNumeral } from '../../utils/formatting/format-utils.mjs';
import { getMoonPhasePosition } from '../../utils/formatting/moon-utils.mjs';
import { localize } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';
import { canChangeDateTime, canChangeWeather, canViewBigCal, canViewMiniCal } from '../../utils/permissions.mjs';
import SearchManager from '../../utils/search-manager.mjs';
import { CalendariaSocket } from '../../utils/socket.mjs';
import * as ViewUtils from '../../utils/ui/calendar-view-utils.mjs';
import * as StickyZones from '../../utils/ui/sticky-zones.mjs';
import * as WidgetManager from '../../utils/widget-manager.mjs';
import { getPreset, getPresetAlias } from '../../weather/data/weather-presets.mjs';
import WeatherManager from '../../weather/weather-manager.mjs';
import { BigCal } from '../calendar/big-cal.mjs';
import { MiniCal } from '../calendar/mini-cal.mjs';
import { SetDateDialog } from '../dialogs/set-date-dialog.mjs';
import { SettingsPanel } from '../settings/settings-panel.mjs';
import WeatherPickerApp from '../weather/weather-picker.mjs';
import { HudSceneRenderer, SKY_KEYFRAMES, SKY_OVERRIDES } from './hud-scene-renderer.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Calendar HUD with sundial dome, time controls, and calendar info.
 */
export class HUD extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {boolean} Tracks if HUD was closed due to combat (for reopening) */
  static #closedForCombat = false;

  /** @type {number|null} Hook ID for visual tick */
  #timeHookId = null;

  /** @type {number|null} Hook ID for world time updated */
  #worldTimeHookId = null;

  /** @type {Array} Hook references for cleanup */
  #hooks = [];

  /** @type {object|null} Dial state for time rotation */
  _dialState = null;

  /** @type {boolean} Sticky tray (always visible) */
  #stickyTray = false;

  /** @type {boolean} Sticky position (locks position) */
  #stickyPosition = false;

  /** @type {number|null} Last tracked day for re-render */
  #lastDay = null;

  /** @type {Array} Cached live events */
  #liveEvents = [];

  /** @type {boolean} Search panel visibility state */
  #searchOpen = false;

  /** @type {string} Current search term */
  #searchTerm = '';

  /** @type {object[]|null} Current search results */
  #searchResults = null;

  /** @type {number|null} Debounce timer for bar re-render */
  #barRenderDebounce = null;

  /** @type {HTMLElement|null} Search panel element (moved to body for positioning) */
  #searchPanelEl = null;

  /** @type {Function|null} Click-outside handler for search panel */
  #clickOutsideHandler = null;

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
      openTimeDial: HUD.#onOpenTimeDial,
      searchNotes: HUD.#onSearchNotes,
      addNote: HUD.#onAddNote,
      openEvent: HUD.#onOpenEvent,
      toggleTimeFlow: HUD.#onToggleTimeFlow,
      openBigCal: HUD.#onOpenBigCal,
      openMiniCal: HUD.#onOpenMiniCal,
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
      closeSearch: HUD.#onCloseSearch,
      openSearchResult: HUD.#onOpenSearchResult,
      setDate: HUD.#onSetDate
    }
  };

  /** @override */
  static PARTS = {
    container: { template: TEMPLATES.CALENDAR_HUD },
    dome: { template: TEMPLATES.CALENDAR_HUD_DOME, container: '.calendaria-hud-content' },
    bar: { template: TEMPLATES.CALENDAR_HUD_BAR, container: '.calendaria-hud-content' }
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
    if (this.#inCombat && game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_COMPACT)) return true;
    return false;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const components = this.#getPredictedComponents();
    context.isGM = game.user.isGM;
    context.canChangeDateTime = canChangeDateTime();
    context.canChangeWeather = canChangeWeather();
    context.canViewBigCal = canViewBigCal();
    context.canViewMiniCal = canViewMiniCal();
    context.hudCalendarButton = game.settings.get(MODULE.ID, SETTINGS.HUD_CALENDAR_BUTTON);
    context.locked = this.isLocked;
    context.isPlaying = TimeClock.running;
    context.clockLocked = TimeClock.locked;
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
    const showWeatherBlock = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_WEATHER);
    const showSeasonBlock = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_SEASON);
    const showEraBlock = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_ERA);
    const isCompact = this.isCompact;
    const weatherDisplayMode = isCompact ? 'icon' : game.settings.get(MODULE.ID, SETTINGS.HUD_WEATHER_DISPLAY_MODE);
    const seasonDisplayMode = isCompact ? 'icon' : game.settings.get(MODULE.ID, SETTINGS.HUD_SEASON_DISPLAY_MODE);
    const season = calendar?.getCurrentSeason?.();
    context.currentSeason = showSeasonBlock && season ? { name: localize(season.name), color: season.color || '#888', icon: season.icon || 'fas fa-sun' } : null;
    context.showSeasonIcon = seasonDisplayMode === 'full' || seasonDisplayMode === 'icon';
    context.showSeasonLabel = seasonDisplayMode === 'full' || seasonDisplayMode === 'text';
    const eraDisplayMode = isCompact ? 'icon' : game.settings.get(MODULE.ID, SETTINGS.HUD_ERA_DISPLAY_MODE);
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
    context.firstEventColor = this.#liveEvents[0]?.color || null;
    context.currentEvent = this.#liveEvents.length > 0 ? this.#liveEvents[0] : null;
    const isMonthless = calendar?.isMonthless ?? false;
    context.increments = Object.entries(getTimeIncrements())
      .filter(([key]) => !isMonthless || key !== 'month')
      .map(([key, seconds]) => ({ key, label: this.#formatIncrementLabel(key), seconds, selected: key === appSettings.incrementKey }));
    const customJumps = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_TIME_JUMPS) || {};
    const currentJumps = customJumps[appSettings.incrementKey] || {};
    context.customJumps = { dec2: currentJumps.dec2 ?? null, dec1: currentJumps.dec1 ?? null, inc1: currentJumps.inc1 ?? null, inc2: currentJumps.inc2 ?? null };
    context.searchOpen = this.#searchOpen;
    context.searchTerm = this.#searchTerm;
    context.searchResults = this.#searchResults || [];
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
    widgets.buttonsLeft = WidgetManager.renderWidgetsForPoint(WIDGET_POINTS.HUD_BUTTONS_LEFT, 'hud');
    widgets.buttonsRight = WidgetManager.renderWidgetsForPoint(WIDGET_POINTS.HUD_BUTTONS_RIGHT, 'hud');
    widgets.indicators = WidgetManager.renderWidgetsForPoint(WIDGET_POINTS.HUD_INDICATORS, 'hud');
    widgets.tray = WidgetManager.renderWidgetsForPoint(WIDGET_POINTS.HUD_TRAY, 'hud');
    widgets.weatherIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.WEATHER_INDICATOR, this.#renderWeatherIndicator(context), 'hud');
    widgets.seasonIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.SEASON_INDICATOR, this.#renderSeasonIndicator(context), 'hud');
    widgets.eraIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.ERA_INDICATOR, this.#renderEraIndicator(context), 'hud');
    widgets.cycleIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.CYCLE_INDICATOR, this.#renderCycleIndicator(context), 'hud');
    return widgets;
  }

  /**
   * Render the built-in weather indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  #renderWeatherIndicator(context) {
    if (context.weather) {
      const clickable = context.canChangeWeather ? 'clickable' : '';
      const action = context.canChangeWeather ? 'data-action="openWeatherPicker"' : '';
      const icon = context.showWeatherIcon ? `<i class="${context.weather.icon}"></i>` : '';
      const label = context.showWeatherLabel ? `<span class="weather-label">${context.weather.label}</span>` : '';
      const temp = context.showWeatherTemp ? `<span class="weather-temp">${context.weather.temp}</span>` : '';
      let windHtml = '';
      if (context.showWeatherLabel && context.weather.windSpeed > 0) {
        const rotation = context.weather.windDirection != null ? context.weather.windDirection : 0;
        windHtml = `<span class="weather-wind"><i class="fas fa-up-long" style="transform: rotate(${rotation}deg)"></i></span>`;
      }
      let precipHtml = '';
      if (context.showWeatherLabel && context.weather.precipType) precipHtml = `<span class="weather-precip"><i class="fas fa-droplet"></i></span>`;
      return `<span class="weather-indicator ${clickable} weather-mode-${context.weatherDisplayMode}"
        ${action} style="--weather-color: ${context.weather.color}" data-tooltip-html="${context.weather.tooltipHtml}">
        ${icon}${label}${temp}${windHtml}${precipHtml}
      </span>`;
    } else if (context.showWeatherBlock && context.canChangeWeather) {
      return `<span class="weather-indicator clickable no-weather" data-action="openWeatherPicker" data-tooltip="${localize('CALENDARIA.Weather.ClickToGenerate')}"><i class="fas fa-cloud"></i></span>`;
    }
    return '';
  }

  /**
   * Render the built-in season indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  #renderSeasonIndicator(context) {
    if (!context.currentSeason) return '';
    const icon = context.showSeasonIcon ? `<i class="${context.currentSeason.icon}"></i>` : '';
    const label = context.showSeasonLabel ? `<span class="season-label">${context.currentSeason.name}</span>` : '';
    return `<span class="season-indicator" style="--season-color: ${context.currentSeason.color}" data-tooltip="${context.currentSeason.name}">${icon}${label}</span>`;
  }

  /**
   * Render the built-in era indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  #renderEraIndicator(context) {
    if (!context.currentEra) return '';
    const icon = context.showEraIcon ? `<i class="${context.currentEra.icon}"></i>` : '';
    let label = '';
    if (context.showEraLabel) label = `<span class="era-label">${context.currentEra.name}</span>`;
    else if (context.showEraAbbr) label = `<span class="era-label">${context.currentEra.abbreviation}</span>`;
    return `<span class="era-indicator" data-tooltip="${context.currentEra.name}">${icon}${label}</span>`;
  }

  /**
   * Render the built-in cycle indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  #renderCycleIndicator(context) {
    if (!context.cycleData?.values?.length) return '';
    const mode = context.cyclesDisplayMode;
    const icon = '<i class="fas fa-arrows-rotate"></i>';
    if (mode === 'icon') return `<span class="cycle-indicator" data-tooltip="${context.cycleText}">${icon}</span>`;
    let displayText = '';
    if (mode === 'number') displayText = context.cycleData.values.map((v) => v.index + 1).join(', ');
    else if (mode === 'roman') displayText = context.cycleData.values.map((v) => toRomanNumeral(v.index + 1)).join(', ');
    else displayText = context.cycleData.values.map((v) => v.entryName).join(', ');
    const label = `<span class="cycle-label">${displayText}</span>`;
    return `<span class="cycle-indicator" data-tooltip="${context.cycleText || displayText}">${icon}${label}</span>`;
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
    WidgetManager.attachWidgetListeners(this.element);
    if (!this.#timeHookId) this.#timeHookId = Hooks.on(HOOKS.VISUAL_TICK, this.#onVisualTick.bind(this));
    if (!this.#worldTimeHookId) this.#worldTimeHookId = Hooks.on(HOOKS.WORLD_TIME_UPDATED, this.#onWorldTimeUpdated.bind(this));
    const c = this.#getPredictedComponents();
    this.#lastDay = `${c.year}-${c.month}-${c.dayOfMonth}`;
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
      name: 'deleteJournalEntry',
      id: Hooks.on('deleteJournalEntry', (journal) => {
        if (journal.pages.some((p) => p.type === 'calendaria.calendarnote')) debouncedRender();
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
      name: 'deleteCombat',
      id: Hooks.on('deleteCombat', () => this.#onCombatChange(false))
    });
    this.#hooks.push({
      name: 'updateCombat',
      id: Hooks.on('updateCombat', () => this.#onCombatChange(!!game.combat?.started))
    });
    this.#inCombat = !!game.combat?.started;
    if (this.#inCombat && game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_HIDE)) {
      HUD.#closedForCombat = true;
      this.close({ combat: true });
    }
    this.#resizeHandler = foundry.utils.debounce(() => this.#onViewportResize(), 100);
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
    if (game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_HIDE)) {
      if (inCombat) {
        HUD.#closedForCombat = true;
        this.close({ combat: true });
      }
      return;
    }
    if (game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_COMPACT)) this.render();
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
    if (this.#clickOutsideHandler) {
      document.removeEventListener('mousedown', this.#clickOutsideHandler);
      this.#clickOutsideHandler = null;
    }
    if (this.#resizeHandler) {
      window.removeEventListener('resize', this.#resizeHandler);
      this.#resizeHandler = null;
    }
    if (this.#fullscreenHandler) {
      document.removeEventListener('fullscreenchange', this.#fullscreenHandler);
      this.#fullscreenHandler = null;
    }
    if (this.#searchPanelEl?.parentElement === document.body) {
      this.#searchPanelEl.remove();
      this.#searchPanelEl = null;
    }
    if (this.#sceneRenderer) {
      this.#sceneRenderer.destroy();
      this.#sceneRenderer = null;
    }
    StickyZones.unregisterFromZoneUpdates(this);
    StickyZones.unpinFromZone(this.element);
    StickyZones.cleanupSnapIndicator();
    this.#hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
    this.#hooks = [];
    await super._onClose(options);
  }

  /**
   * Setup event listeners for the HUD.
   */
  #setupEventListeners() {
    const incrementSelect = this.element.querySelector('.calendaria-hud-select[data-action="setIncrement"]');
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
    const timeDisplay = this.element.querySelector('.calendaria-hud-time');
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
    const searchInput = this.element.querySelector('.calendaria-search .search-input');
    if (searchInput) {
      if (this.#searchOpen) searchInput.focus();
      const debouncedSearch = foundry.utils.debounce((term) => {
        this.#searchTerm = term;
        if (term.length >= 2) this.#searchResults = SearchManager.search(term, { searchContent: true });
        else this.#searchResults = null;
        this.#updateSearchResults();
      }, 300);
      searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.#closeSearch();
      });
    }
    if (this.#searchOpen) requestAnimationFrame(() => this.#positionSearchPanel());
    const dome = this.element.querySelector('.calendaria-hud-dome');
    if (dome) {
      dome.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.#openTimeRotationDial();
        }
      });
    }
    const bar = this.element.querySelector('.calendaria-hud-bar');
    bar?.addEventListener('dblclick', (e) => {
      e.preventDefault();
      game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE, this.isCompact ? 'fullsize' : 'compact');
    });
    bar?.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#context-menu')) return;
      e.preventDefault();
      document.getElementById('context-menu')?.remove();
      const menu = new foundry.applications.ux.ContextMenu.implementation(this.element, '.calendaria-hud-bar', this.#getContextMenuItems(), { fixed: true, jQuery: false });
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
        name: forceHUD ? 'CALENDARIA.HUD.ContextMenu.HideFromAll' : 'CALENDARIA.HUD.ContextMenu.ShowToAll',
        icon: forceHUD ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>',
        callback: async () => {
          const newValue = !forceHUD;
          await game.settings.set(MODULE.ID, SETTINGS.FORCE_HUD, newValue);
          CalendariaSocket.emit(SOCKET_TYPES.HUD_VISIBILITY, { visible: newValue });
        }
      });
    }
    items.push({ name: 'CALENDARIA.HUD.ContextMenu.ResetPosition', icon: '<i class="fas fa-arrows-to-dot"></i>', callback: () => HUD.resetPosition() });
    items.push({
      name: this.#stickyPosition ? 'CALENDARIA.HUD.ContextMenu.UnlockPosition' : 'CALENDARIA.HUD.ContextMenu.LockPosition',
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
      const tray = this.element.querySelector('.calendaria-hud-tray');
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
    const tray = this.element.querySelector('.calendaria-hud-tray');
    tray?.classList.toggle('visible', this.#stickyTray);
    this._updatePinButtonState();
    this.#saveStickyStates();
  }

  /**
   * Toggle sticky position.
   */
  _toggleStickyPosition() {
    this.#stickyPosition = !this.#stickyPosition;
    const bar = this.element.querySelector('.calendaria-hud-bar');
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
      if (this.#snappedZoneId && StickyZones.restorePinnedState(this.element, this.#snappedZoneId)) {
        StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
        return;
      }
      if (this.#snappedZoneId) {
        const rect = this.element.getBoundingClientRect();
        const barEl = this.element.querySelector('.calendaria-hud-bar');
        const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
        const zonePos = StickyZones.getRestorePosition(this.#snappedZoneId, rect.width, barHeight);
        if (zonePos) {
          let newTop = zonePos.top;
          if (StickyZones.isBottomAnchored(this.#snappedZoneId) && typeof savedPos.anchorY === 'number') {
            newTop = savedPos.anchorY - barHeight;
          }
          this.setPosition({ left: zonePos.left, top: newTop });
          StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
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
        StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
        const posData = { left: this.position.left, top: this.position.top, zoneId: this.#snappedZoneId };
        if (StickyZones.isBottomAnchored(this.#snappedZoneId)) {
          const barEl = this.element.querySelector('.calendaria-hud-bar');
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
    const barEl = this.element.querySelector('.calendaria-hud-bar');
    const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + barHeight / 2;
    const zone = StickyZones.getActiveZone(centerX, centerY, rect.width, barHeight);
    return zone?.id || null;
  }

  /**
   * Handle display mode change by recalculating position to maintain center point.
   */
  #handleModeChange() {
    if (!this.#snappedZoneId) this.#snappedZoneId = this.#detectCurrentZone();
    if (this.#snappedZoneId && StickyZones.usesDomParenting(this.#snappedZoneId)) return;
    const rect = this.element.getBoundingClientRect();
    if (this.#snappedZoneId) {
      const barEl = this.element.querySelector('.calendaria-hud-bar');
      const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
      const zonePos = StickyZones.getRestorePosition(this.#snappedZoneId, rect.width, barHeight);
      if (zonePos) {
        let newLeft = zonePos.left;
        let newTop = zonePos.top;
        let anchorY = null;
        if (StickyZones.isBottomAnchored(this.#snappedZoneId)) {
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
        const barEl = this.element.querySelector('.calendaria-hud-bar');
        const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
        const zonePos = StickyZones.getRestorePosition(this.#snappedZoneId, currentWidth, barHeight);
        if (zonePos) {
          let newTop = zonePos.top;
          if (StickyZones.isBottomAnchored(this.#snappedZoneId)) {
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
    const rightBuffer = StickyZones.getSidebarBuffer();
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

    if (this.#snappedZoneId && StickyZones.usesDomParenting(this.#snappedZoneId)) return;
    const rect = this.element.getBoundingClientRect();
    const barEl = this.element.querySelector('.calendaria-hud-bar');
    const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;

    if (this.#snappedZoneId) {
      const zonePos = StickyZones.getRestorePosition(this.#snappedZoneId, rect.width, barHeight);
      if (zonePos) {
        let newTop = zonePos.top;
        if (StickyZones.isBottomAnchored(this.#snappedZoneId)) {
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
  }

  /**
   * Enable dragging on the main bar.
   */
  #enableDragging() {
    const dragHandle = this.element.querySelector('.calendaria-hud-bar');
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
      if (this.#searchOpen) this.#closeSearch();
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
      const rightBuffer = StickyZones.getSidebarBuffer();
      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width - rightBuffer));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      this.setPosition({ left: newLeft, top: newTop });
      this.#updateDomeVisibility();
      const barEl = this.element.querySelector('.calendaria-hud-bar');
      const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
      this.#activeSnapZone = StickyZones.checkStickyZones(dragHandle, newLeft, newTop, rect.width, barHeight);
    };
    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);
      dragHandle.classList.remove('dragging');
      StickyZones.hideSnapIndicator();
      if (!hasMoved) {
        dragHandle.classList.remove(StickyZones.WOBBLE_CLASS);
        this.#activeSnapZone = null;
        previousZoneId = null;
        return;
      }
      const rect = this.element.getBoundingClientRect();
      const barEl = this.element.querySelector('.calendaria-hud-bar');
      const barHeight = barEl ? barEl.getBoundingClientRect().bottom - rect.top : rect.height;
      const result = StickyZones.finalizeDrag(dragHandle, this.#activeSnapZone, this, rect.width, barHeight, previousZoneId);
      this.#snappedZoneId = result.zoneId;
      StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
      this.#activeSnapZone = null;
      previousZoneId = null;
      const posData = { left: this.position.left, top: this.position.top, zoneId: this.#snappedZoneId };
      if (!this.#snappedZoneId) {
        posData.centerX = this.position.left + rect.width / 2;
        posData.centerY = this.position.top + rect.height / 2;
      } else if (StickyZones.isBottomAnchored(this.#snappedZoneId)) {
        const barEl = this.element.querySelector('.calendaria-hud-bar');
        if (barEl) posData.anchorY = barEl.getBoundingClientRect().bottom;
      }
      await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, posData);
    };
  }

  /**
   * Update dome visibility based on viewport position.
   */
  #updateDomeVisibility() {
    const dome = this.element.querySelector('.calendaria-hud-dome');
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
    const selector = useSlice ? '.calendaria-slice-scene-canvas' : '.calendaria-hud-scene-canvas';
    this.#updateSceneRenderer(selector, useSlice ? 'slice' : 'dome');
    const skyColors = this.#getSkyColorsRgb(hour);
    const tintedColors = this.#applyWeatherSkyTint(skyColors);
    const dawnStart = sunrise - 0.5;
    const dawnEnd = sunrise + 1;
    const duskStart = sunset - 0.5;
    const duskEnd = sunset + 1;
    let starAlpha = 0;
    if (hour < dawnStart || hour > duskEnd) starAlpha = 1;
    else if (hour >= dawnStart && hour < dawnEnd) starAlpha = Math.max(0, Math.min(1, 1 - (hour - dawnStart) / 1.5));
    else if (hour > duskStart && hour <= duskEnd) starAlpha = Math.max(0, Math.min(1, (hour - duskStart) / 1.5));
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
    const effect = resolved.hudEffect || preset?.hudEffect || 'clear';
    const { visualOverrides } = resolved;
    this.#sceneRenderer.setEffect(
      effect,
      { windSpeed: weather?.wind?.speed ?? 0, windDirection: weather?.wind?.direction ?? 0, precipIntensity: weather?.precipitation?.intensity ?? 0 },
      visualOverrides
    );
  }

  /**
   * Get interpolated sky colors for a given hour as RGB arrays.
   * @param {number} hour - Hour (0-hoursPerDay, decimal)
   * @returns {{top: number[], mid: number[], bottom: number[]}} Sky gradient colors as [r,g,b]
   */
  #getSkyColorsRgb(hour) {
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    hour = ((hour / hoursPerDay) * 24 + 24) % 24;
    let kf1 = SKY_KEYFRAMES[0];
    let kf2 = SKY_KEYFRAMES[1];
    for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
      if (hour >= SKY_KEYFRAMES[i].hour && hour < SKY_KEYFRAMES[i + 1].hour) {
        kf1 = SKY_KEYFRAMES[i];
        kf2 = SKY_KEYFRAMES[i + 1];
        break;
      }
    }
    const range = kf2.hour - kf1.hour;
    const t = range > 0 ? (hour - kf1.hour) / range : 0;
    return { top: HUD.#lerpColorRgb(kf1.top, kf2.top, t), mid: HUD.#lerpColorRgb(kf1.mid, kf2.mid, t), bottom: HUD.#lerpColorRgb(kf1.bottom, kf2.bottom, t) };
  }

  /**
   * Linearly interpolate between two hex color strings, returning [r,g,b].
   * @param {string} color1 - Start color (#RRGGBB)
   * @param {string} color2 - End color (#RRGGBB)
   * @param {number} t - Interpolation factor (0-1)
   * @returns {number[]} [r, g, b] array
   */
  static #lerpColorRgb(color1, color2, t) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    return [Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t)];
  }

  /**
   * Apply weather-based sky color tint to gradient colors (RGB array form).
   * @param {{top: number[], mid: number[], bottom: number[]}} colors - Sky colors as [r,g,b]
   * @returns {{top: number[], mid: number[], bottom: number[]}} Tinted colors
   */
  #applyWeatherSkyTint(colors) {
    const weather = WeatherManager.getCurrentWeather(null, game.scenes?.active);
    if (!weather) return colors;
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const preset = getPreset(weather.id, customPresets);
    const resolved = this.#resolveOverrides(preset);
    const effect = resolved.hudEffect || preset?.hudEffect || 'clear';
    const { skyOverrides } = resolved;
    const override = skyOverrides
      ? {
          strength: skyOverrides.strength ?? SKY_OVERRIDES[effect]?.strength ?? 0.7,
          top: skyOverrides.top ?? SKY_OVERRIDES[effect]?.top,
          mid: skyOverrides.mid ?? SKY_OVERRIDES[effect]?.mid,
          bottom: skyOverrides.bottom ?? SKY_OVERRIDES[effect]?.bottom
        }
      : SKY_OVERRIDES[effect];
    if (!override || !override.top) return colors;
    const strength = override.strength ?? 0.7;
    const blend = (rgb, overrideRgb) => [
      Math.round(rgb[0] * (1 - strength) + overrideRgb[0] * strength),
      Math.round(rgb[1] * (1 - strength) + overrideRgb[1] * strength),
      Math.round(rgb[2] * (1 - strength) + overrideRgb[2] * strength)
    ];
    return { top: blend(colors.top, override.top), mid: blend(colors.mid, override.mid), bottom: blend(colors.bottom, override.bottom) };
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
    const timeEl = this.element.querySelector('.calendaria-hud-time');
    if (timeEl) {
      const timeFormatted = this.#formatTime(components);
      if (hasMoonIconMarkers(timeFormatted)) timeEl.innerHTML = renderMoonIcons(timeFormatted);
      else timeEl.textContent = timeFormatted;
    }
    const dateEl = this.element.querySelector('.calendaria-hud-date');
    if (dateEl) {
      const dateFormatted = this.#formatDateDisplay(components);
      const dateText = stripMoonIconMarkers(dateFormatted);
      if (hasMoonIconMarkers(dateFormatted)) dateEl.innerHTML = renderMoonIcons(dateFormatted);
      else dateEl.textContent = dateFormatted;
      dateEl.classList.toggle('compressed', dateText.length > 35);
    }
    const hud = this.element.querySelector('.calendaria-hud-content');
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
    const locked = TimeClock.locked;
    const hud = this.element.querySelector('.calendaria-hud-content');
    if (hud) hud.classList.toggle('time-flowing', running);
    const playBtn = this.element.querySelector('.calendaria-hud-play-btn');
    if (playBtn) {
      playBtn.classList.toggle('playing', running);
      playBtn.classList.toggle('clock-locked', locked);
      playBtn.setAttribute('aria-pressed', String(running));
      playBtn.dataset.tooltip = locked ? localize('CALENDARIA.TimeClock.Locked') : running ? localize('CALENDARIA.HUD.PauseTime') : localize('CALENDARIA.TimeKeeper.Start');
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
    const tooltipHtml = WeatherManager.buildWeatherTooltip({
      label,
      description: weather.description ? localize(weather.description) : null,
      temp,
      windSpeed,
      windDirection,
      precipType,
      precipIntensity: weather.precipitation?.intensity
    });
    return { id: weather.id, label, icon, color: weather.color, temp, tooltipHtml, windSpeed, windDirection, precipType };
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
    const notes = ViewUtils.getNotesOnDay(year, month, dayOfMonth);
    if (!notes.length) return [];
    return notes.slice(0, 5).map((note) => {
      let tooltip = note.name;
      const desc = note.text?.content;
      if (desc) {
        const plainText = desc.replace(/<[^>]*>/g, '').trim();
        if (plainText) {
          const truncated = plainText.length > 120 ? `${plainText.substring(0, 117)}...` : plainText;
          tooltip += `\n${truncated}`;
        }
      }
      return { id: note.id, parentId: note.parent.id, name: note.name, icon: note.system.icon || 'fas fa-star', color: note.system.color || '#e88', tooltip };
    });
  }

  /**
   * Open the circular time rotation dial.
   */
  async #openTimeRotationDial() {
    log(3, 'Opening time rotation dial');
    const existingDial = document.getElementById('calendaria-time-dial');
    if (existingDial) existingDial.remove();
    const currentTime = game.time.worldTime;
    const components = game.time.components;
    const hours = components.hour ?? 0;
    const minutes = components.minute ?? 0;
    const templateData = { currentTime: this.#formatDialTime(hours, minutes), hourMarkers: this.#generateHourMarkers() };
    const html = await foundry.applications.handlebars.renderTemplate(TEMPLATES.TIME_DIAL, templateData);
    const dial = document.createElement('div');
    dial.id = 'calendaria-time-dial';
    dial.className = 'calendaria time-dial';
    dial.innerHTML = html;
    document.body.appendChild(dial);
    const dialContainer = dial.querySelector('.container');
    const dialRect = dialContainer.getBoundingClientRect();
    const hudRect = this.element.getBoundingClientRect();
    let left = hudRect.left + hudRect.width / 2 - dialRect.width / 2;
    left = Math.min(Math.max(left, 0), window.innerWidth - dialRect.width);
    let top;
    const spaceBelow = window.innerHeight - hudRect.bottom;
    const spaceAbove = hudRect.top;
    if (spaceBelow >= dialRect.height + 20) top = hudRect.bottom + 20;
    else if (spaceAbove >= dialRect.height + 20) top = hudRect.top - dialRect.height - 20;
    else top = hudRect.bottom + 20;
    dial.style.left = `${left}px`;
    dial.style.top = `${top}px`;
    this._dialState = { currentHours: hours, currentMinutes: minutes, initialTime: currentTime };
    const initialAngle = this.#timeToAngle(hours, minutes);
    this.#updateDialRotation(dial, initialAngle);
    this.#setupDialInteraction(dial);
  }

  /**
   * Generate hour marker data for the dial template.
   * @returns {Array} Array of hour marker objects with position data
   */
  #generateHourMarkers() {
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    const degreesPerHour = 360 / hoursPerDay;
    const labelInterval = Math.max(1, Math.floor(hoursPerDay / 4));
    const markers = [];
    for (let hour = 0; hour < hoursPerDay; hour++) {
      const angle = hour * degreesPerHour + 90;
      const radians = (angle * Math.PI) / 180;
      const x1 = 100 + Math.cos(radians) * 80;
      const y1 = 100 + Math.sin(radians) * 80;
      const x2 = 100 + Math.cos(radians) * 90;
      const y2 = 100 + Math.sin(radians) * 90;
      const textX = 100 + Math.cos(radians) * 70;
      const textY = 100 + Math.sin(radians) * 70;
      markers.push({
        hour,
        x1: x1.toFixed(2),
        y1: y1.toFixed(2),
        x2: x2.toFixed(2),
        y2: y2.toFixed(2),
        textX: textX.toFixed(2),
        textY: textY.toFixed(2),
        strokeWidth: hour % labelInterval === 0 ? 2 : 1,
        showLabel: hour % labelInterval === 0
      });
    }
    return markers;
  }

  /**
   * Format time for dial display.
   * @param {number} hours - Hour value (0-23)
   * @param {number} minutes - Minute value (0-59)
   * @returns {string} Formatted time string (HH:MM)
   */
  #formatDialTime(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  /**
   * Convert time to angle in degrees.
   * @param {number} hours - Hour value (0 to hoursPerDay-1)
   * @param {number} minutes - Minute value (0 to minutesPerHour-1)
   * @returns {number} Angle in degrees (0-360)
   */
  #timeToAngle(hours, minutes) {
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = this.calendar?.days?.minutesPerHour ?? 60;
    const totalMinutes = hours * minutesPerHour + minutes;
    let angle = (totalMinutes / (hoursPerDay * minutesPerHour)) * 360;
    angle = (angle + 180) % 360;
    return angle;
  }

  /**
   * Convert angle to time.
   * @param {number} angle - Angle in degrees (0-360)
   * @returns {{hours: number, minutes: number}} Time object with hours and minutes
   */
  #angleToTime(angle) {
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = this.calendar?.days?.minutesPerHour ?? 60;
    angle = ((angle % 360) + 360) % 360;
    angle = (angle - 180 + 360) % 360;
    const totalMinutes = Math.round((angle / 360) * (hoursPerDay * minutesPerHour));
    const hours = Math.floor(totalMinutes / minutesPerHour) % hoursPerDay;
    const minutes = totalMinutes % minutesPerHour;
    return { hours, minutes };
  }

  /**
   * Update the dial's visual rotation.
   * @param {HTMLElement} dial - The dial container element
   * @param {number} angle - Rotation angle in degrees
   */
  #updateDialRotation(dial, angle) {
    const handleContainer = dial.querySelector('.handle-container');
    const sky = dial.querySelector('.sky');
    const sunContainer = dial.querySelector('.sun');
    if (!handleContainer || !sky || !sunContainer) return;
    const time = this.#angleToTime(angle);
    const timeDisplay = dial.querySelector('.time');
    if (timeDisplay && document.activeElement !== timeDisplay) timeDisplay.value = this.#formatDialTime(time.hours, time.minutes);
    const normalizedAngle = ((angle % 360) + 360) % 360;
    let sunOpacity;
    let adjustedAngle;
    if (normalizedAngle >= 270) adjustedAngle = normalizedAngle - 360;
    else if (normalizedAngle <= 90) adjustedAngle = normalizedAngle;
    else adjustedAngle = null;
    if (adjustedAngle !== null) {
      const radians = (adjustedAngle * Math.PI) / 180;
      sunOpacity = Math.max(0, Math.cos(radians));
    } else {
      sunOpacity = 0;
    }
    const moonPosition = (normalizedAngle + 180) % 360;
    let moonAdjustedAngle;
    if (moonPosition >= 270) moonAdjustedAngle = moonPosition - 360;
    else if (moonPosition <= 90) moonAdjustedAngle = moonPosition;
    else moonAdjustedAngle = null;
    let moonOpacity;
    if (moonAdjustedAngle !== null) {
      const radians = (moonAdjustedAngle * Math.PI) / 180;
      moonOpacity = Math.max(0, Math.cos(radians));
    } else {
      moonOpacity = 0;
    }
    const sunPosition = normalizedAngle;
    if (sunPosition >= 91 && sunPosition <= 269) sunOpacity = 0;
    if (moonPosition >= 91 && moonPosition <= 269) moonOpacity = 0;
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = this.calendar?.days?.minutesPerHour ?? 60;
    const totalMinutes = time.hours * minutesPerHour + time.minutes;
    const dayProgress = ((totalMinutes / (hoursPerDay * minutesPerHour)) * 2 + 1.5) % 2;
    sky.style.setProperty('--calendar-day-progress', dayProgress);
    sky.style.setProperty('--calendar-night-progress', dayProgress);
    sky.style.setProperty('--sun-opacity', sunOpacity);
    sky.style.setProperty('--moon-opacity', moonOpacity);
    sunContainer.style.transform = `rotate(${angle - 84}deg)`;
    handleContainer.style.transform = `rotate(${angle}deg)`;
    if (this._dialState) {
      this._dialState.currentHours = time.hours;
      this._dialState.currentMinutes = time.minutes;
    }
  }

  /**
   * Setup interaction handlers for the dial.
   * @param {HTMLElement} dial - The dial container element
   */
  #setupDialInteraction(dial) {
    const sky = dial.querySelector('.sky');
    const backdrop = dial.querySelector('.backdrop');
    const handle = dial.querySelector('.handle');
    let isDragging = false;
    let initialAngle = 0;
    let initialMouseAngle = 0;
    const getAngleFromEvent = (event) => {
      const rect = sky.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = event.clientX - centerX;
      const deltaY = event.clientY - centerY;
      return (Math.atan2(deltaY, deltaX) * 180) / Math.PI + 90;
    };
    const onMouseDown = (event) => {
      if (event.button !== 0) return;
      isDragging = true;
      initialAngle = this.#timeToAngle(this._dialState.currentHours, this._dialState.currentMinutes);
      initialMouseAngle = getAngleFromEvent(event);
      handle.style.cursor = 'grabbing';
      event.preventDefault();
      event.stopPropagation();
    };
    const onMouseMove = (event) => {
      if (!isDragging) return;
      const currentMouseAngle = getAngleFromEvent(event);
      const deltaAngle = currentMouseAngle - initialMouseAngle;
      const newAngle = initialAngle + deltaAngle;
      this.#updateDialRotation(dial, newAngle);
      event.preventDefault();
    };
    const onMouseUp = async (event) => {
      if (!isDragging) return;
      isDragging = false;
      handle.style.cursor = 'grab';
      await this.#applyTimeChange();
      event.preventDefault();
    };
    const onBackdropClick = () => {
      dial.remove();
    };
    const timeInput = dial.querySelector('.time');
    const applyTimeFromInput = async () => {
      const parsed = this.#parseTimeInput(timeInput.value);
      if (parsed) {
        this._dialState.currentHours = parsed.hours;
        this._dialState.currentMinutes = parsed.minutes;
        const newAngle = this.#timeToAngle(parsed.hours, parsed.minutes);
        this.#updateDialRotation(dial, newAngle);
        await this.#applyTimeChange();
      } else {
        timeInput.value = this.#formatDialTime(this._dialState.currentHours, this._dialState.currentMinutes);
      }
    };
    const onTimeInputKeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        timeInput.blur();
      } else if (event.key === 'Escape') {
        timeInput.value = this.#formatDialTime(this._dialState.currentHours, this._dialState.currentMinutes);
        timeInput.blur();
      }
    };
    const onTimeInputBlur = async () => {
      await applyTimeFromInput();
    };
    const onTimeInputFocus = () => {
      timeInput.select();
    };
    handle.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    backdrop.addEventListener('click', onBackdropClick);
    timeInput.addEventListener('keydown', onTimeInputKeydown);
    timeInput.addEventListener('blur', onTimeInputBlur);
    timeInput.addEventListener('focus', onTimeInputFocus);
    dial._cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }

  /**
   * Parse flexible time input string.
   * @param {string} input - Time input string (e.g., "14:30", "2:30pm")
   * @returns {{hours: number, minutes: number}|null} Parsed time object or null if invalid
   */
  #parseTimeInput(input) {
    if (!input) return null;
    const str = input.trim().toLowerCase();
    if (!str) return null;
    const isPM = /p/.test(str);
    const isAM = /a/.test(str);
    const cleaned = str.replace(/[ap]\.?m?\.?/gi, '').trim();
    let hours = 0;
    let minutes = 0;
    if (cleaned.includes(':')) {
      const [h, m] = cleaned.split(':').map((s) => parseInt(s, 10));
      if (isNaN(h)) return null;
      hours = h;
      minutes = isNaN(m) ? 0 : m;
    } else {
      const h = parseInt(cleaned, 10);
      if (isNaN(h)) return null;
      hours = h;
      minutes = 0;
    }
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = this.calendar?.days?.minutesPerHour ?? 60;
    const midday = Math.floor(hoursPerDay / 2);
    if (isPM && hours < midday) hours += midday;
    else if (isAM && hours === midday) hours = 0;
    if (hours < 0 || hours >= hoursPerDay) return null;
    if (minutes < 0 || minutes >= minutesPerHour) return null;
    return { hours, minutes };
  }

  /**
   * Apply the time change from the dial.
   */
  async #applyTimeChange() {
    if (!this._dialState) return;
    const { currentHours, currentMinutes, initialTime } = this._dialState;
    const cal = game.time.calendar;
    const days = cal?.days ?? {};
    const secondsPerMinute = days.secondsPerMinute ?? 60;
    const minutesPerHour = days.minutesPerHour ?? 60;
    const hoursPerDay = days.hoursPerDay ?? 24;
    const secondsPerHour = secondsPerMinute * minutesPerHour;
    const secondsPerDay = secondsPerHour * hoursPerDay;
    const initialComponents = cal?.timeToComponents?.(initialTime) ?? game.time.components;
    const initialHours = initialComponents.hour ?? 0;
    const initialMinutes = initialComponents.minute ?? 0;
    const initialSeconds = initialComponents.second ?? 0;
    const initialDaySeconds = initialHours * secondsPerHour + initialMinutes * secondsPerMinute + initialSeconds;
    const newDaySeconds = currentHours * secondsPerHour + currentMinutes * secondsPerMinute;
    let timeDiff = newDaySeconds - initialDaySeconds;
    if (Math.abs(timeDiff) > secondsPerDay / 2) {
      if (timeDiff > 0) timeDiff -= secondsPerDay;
      else timeDiff += secondsPerDay;
    }
    if (timeDiff !== 0) {
      if (!game.user.isGM) {
        CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: timeDiff });
        this._dialState.initialTime = initialTime + timeDiff;
        return;
      }
      await game.time.advance(timeDiff);
      log(3, `Time adjusted by ${timeDiff} seconds to ${this.#formatDialTime(currentHours, currentMinutes)}`);
    }
    this._dialState.initialTime = initialTime + timeDiff;
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
      await game.time.advance(secondsToAdvance);
    }
  }

  /**
   * Handle click on dome to open time dial.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onOpenTimeDial(_event, _target) {
    if (!canChangeDateTime()) return;
    await this.#openTimeRotationDial();
  }

  /**
   * Handle click on search button to toggle search panel.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onSearchNotes(_event, _target) {
    this.#searchOpen = !this.#searchOpen;
    if (!this.#searchOpen) {
      this.#searchTerm = '';
      this.#searchResults = null;
    }
    await this.render({ parts: ['bar'] });
  }

  /**
   * Handle click to close search panel.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onCloseSearch(_event, _target) {
    this.#closeSearch();
  }

  /**
   * Handle click on search result to open the note.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element with data attributes
   */
  static async #onOpenSearchResult(_event, target) {
    const id = target.dataset.id;
    const journalId = target.dataset.journalId;
    const page = NoteManager.getFullNote(id);
    if (page) page.sheet.render(true, { mode: 'view' });
    else if (journalId) {
      const journal = game.journal.get(journalId);
      if (journal) journal.sheet.render(true, { pageId: id });
    }
    this.#closeSearch();
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
   * Update search results without full re-render.
   */
  #updateSearchResults() {
    const panel = this.#searchPanelEl || this.element.querySelector('.calendaria-search');
    if (!panel) return;
    const resultsContainer = panel.querySelector('.search-panel-results');
    if (!resultsContainer) return;
    if (this.#searchResults?.length) {
      resultsContainer.innerHTML = this.#searchResults
        .map((r) => {
          const icons = [];
          if (r.data?.icon) icons.push(`<i class="result-note-icon ${r.data.icon}" style="color: ${r.data.color || '#4a9eff'}" data-tooltip="${localize('CALENDARIA.Search.NoteIcon')}"></i>`);
          if (r.data?.gmOnly) icons.push(`<i class="result-gm-icon fas fa-lock" data-tooltip="${localize('CALENDARIA.Search.GMOnly')}"></i>`);
          if (r.data?.repeatIcon) icons.push(`<i class="result-repeat-icon ${r.data.repeatIcon}"${r.data.repeatTooltip ? ` data-tooltip="${r.data.repeatTooltip}"` : ''}></i>`);
          if (r.data?.categoryIcons?.length) {
            for (const cat of r.data.categoryIcons) icons.push(`<i class="result-category-icon fas ${cat.icon}" style="color: ${cat.color}" data-tooltip="${cat.label}"></i>`);
          }
          return `<div class="search-result-item" data-action="openSearchResult" data-id="${r.id}" data-journal-id="${r.data?.journalId || ''}">
            <div class="result-content">
              <span class="result-name">${r.name}</span>
              ${r.description ? `<span class="result-description">${r.description}</span>` : ''}
            </div>
            ${icons.length ? `<div class="result-icons">${icons.join('')}</div>` : ''}
          </div>`;
        })
        .join('');
      resultsContainer.classList.add('has-results');
      if (this.#searchPanelEl) {
        resultsContainer.querySelectorAll('[data-action="openSearchResult"]').forEach((el) => {
          el.addEventListener('click', () => {
            const id = el.dataset.id;
            const journalId = el.dataset.journalId;
            const page = NoteManager.getFullNote(id);
            if (page) page.sheet.render(true, { mode: 'view' });
            else if (journalId) {
              const journal = game.journal.get(journalId);
              if (journal) journal.sheet.render(true, { pageId: id });
            }
            this.#closeSearch();
          });
        });
      }
    } else if (this.#searchTerm?.length >= 2) {
      resultsContainer.innerHTML = `<div class="no-results"><i class="fas fa-search"></i><span>${localize('CALENDARIA.Search.NoResults')}</span></div>`;
      resultsContainer.classList.add('has-results');
    } else {
      resultsContainer.innerHTML = '';
      resultsContainer.classList.remove('has-results');
    }
  }

  /**
   * Position search panel with edge awareness.
   */
  #positionSearchPanel() {
    const panel = this.element.querySelector('.calendaria-search');
    const bar = this.element.querySelector('.calendaria-hud-bar');
    if (!panel || !bar) return;
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
      this.#searchPanelEl = panel;
      panel.querySelectorAll('[data-action="openSearchResult"]').forEach((el) => {
        el.addEventListener('click', () => {
          const id = el.dataset.id;
          const journalId = el.dataset.journalId;
          const page = NoteManager.getFullNote(id);
          if (page) page.sheet.render(true, { mode: 'view' });
          else if (journalId) {
            const journal = game.journal.get(journalId);
            if (journal) journal.sheet.render(true, { pageId: id });
          }
          this.#closeSearch();
        });
      });
      const searchInput = panel.querySelector('.search-input');
      if (searchInput) {
        searchInput.focus();
        const debouncedSearch = foundry.utils.debounce((term) => {
          this.#searchTerm = term;
          if (term.length >= 2) this.#searchResults = SearchManager.search(term, { searchContent: true });
          else this.#searchResults = null;
          this.#updateSearchResults();
        }, 300);
        searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') this.#closeSearch();
        });
      }
      setTimeout(() => {
        this.#clickOutsideHandler = (event) => {
          if (!panel.contains(event.target) && !this.element.contains(event.target)) this.#closeSearch();
        };
        document.addEventListener('mousedown', this.#clickOutsideHandler);
      }, 100);
    }
    const barRect = bar.getBoundingClientRect();
    const panelWidth = 280;
    let left = barRect.left;
    let top = barRect.bottom + 4;
    if (left + panelWidth > window.innerWidth - 10) left = window.innerWidth - panelWidth - 10;
    left = Math.max(10, left);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  /**
   * Close search and clean up.
   */
  #closeSearch() {
    if (this.#clickOutsideHandler) {
      document.removeEventListener('mousedown', this.#clickOutsideHandler);
      this.#clickOutsideHandler = null;
    }
    if (this.#searchPanelEl?.parentElement === document.body) {
      this.#searchPanelEl.remove();
      this.#searchPanelEl = null;
    }
    this.#searchTerm = '';
    this.#searchResults = null;
    this.#searchOpen = false;
    this.render({ parts: ['bar'] });
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
        startDate: { year: today.year + yearZero, month: today.month, day: (today.dayOfMonth ?? 0) + 1, hour: 12, minute: 0 },
        endDate: { year: today.year + yearZero, month: today.month, day: (today.dayOfMonth ?? 0) + 1, hour: 13, minute: 0 }
      }
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
   * Handle click to open BigCal application.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onOpenBigCal(_event, _target) {
    new BigCal().render(true);
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
   * Handle click to open settings panel.
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

  /** Handle custom decrement 2 (larger). */
  static #onCustomDec2() {
    HUD.#applyCustomJump('dec2');
  }

  /** Handle custom decrement 1 (smaller). */
  static #onCustomDec1() {
    HUD.#applyCustomJump('dec1');
  }

  /** Handle custom increment 1 (smaller). */
  static #onCustomInc1() {
    HUD.#applyCustomJump('inc1');
  }

  /** Handle custom increment 2 (larger). */
  static #onCustomInc2() {
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
    game.time.advance(totalSeconds);
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
   * @returns {HUD|null} The HUD instance, or null if blocked by combat hide
   */
  static show() {
    if (game.combat?.started && game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_HIDE)) return null;
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

  /**
   * Register global combat hooks for hide during combat functionality.
   * Should be called once during module initialization.
   */
  static registerCombatHooks() {
    Hooks.on('combatStart', () => {
      if (!game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_HIDE)) return;
      if (this.instance?.rendered) {
        HUD.#closedForCombat = true;
        this.instance.close({ combat: true });
      }
    });

    Hooks.on('deleteCombat', () => {
      HUD.#onCombatEnd();
    });

    Hooks.on('updateCombat', () => {
      if (!game.combat?.started) HUD.#onCombatEnd();
    });
  }

  /**
   * Handle combat ending - reopen HUD if it was closed due to combat.
   */
  static #onCombatEnd() {
    if (!HUD.#closedForCombat) return;
    HUD.#closedForCombat = false;
    if (game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_HIDE) && game.settings.get(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD)) HUD.show();
  }
}
