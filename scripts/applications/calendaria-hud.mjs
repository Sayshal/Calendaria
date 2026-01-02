/**
 * Calendaria HUD - System-agnostic calendar widget.
 * Displays a sundial dome with sun/moon, time controls, date/weather info.
 * @module Applications/CalendariaHUD
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SETTINGS, TEMPLATES } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import SearchManager from '../search/search-manager.mjs';
import TimeKeeper, { getTimeIncrements } from '../time/time-keeper.mjs';
import { formatForLocation } from '../utils/format-utils.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import WeatherManager from '../weather/weather-manager.mjs';
import { openWeatherPicker } from '../weather/weather-picker.mjs';
import { CalendarApplication } from './calendar-application.mjs';
import * as ViewUtils from './calendar-view-utils.mjs';
import { SettingsPanel } from './settings/settings-panel.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Available time multipliers for the tray dropdown.
 */
const TIME_MULTIPLIERS = [
  { value: 0.25, label: '¼' },
  { value: 0.5, label: '½' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' }
];

/**
 * Sky color keyframes for interpolation throughout the day.
 * Each entry defines top/mid/bottom gradient colors at a specific hour.
 */
const SKY_KEYFRAMES = [
  { hour: 0, top: '#0a0a12', mid: '#0f0f1a', bottom: '#151525' },
  { hour: 4, top: '#0a0a15', mid: '#151530', bottom: '#1a1a35' },
  { hour: 5, top: '#1a1a35', mid: '#2d2d50', bottom: '#4a4a6a' },
  { hour: 6, top: '#4a4a6a', mid: '#7a5a70', bottom: '#ff9966' },
  { hour: 7, top: '#6a8cba', mid: '#9ec5e0', bottom: '#ffe4b3' },
  { hour: 8, top: '#4a90d9', mid: '#87ceeb', bottom: '#c9e8f5' },
  { hour: 10, top: '#3a7fc8', mid: '#6bb5e0', bottom: '#a8d8f0' },
  { hour: 12, top: '#2e6ab3', mid: '#4a90d9', bottom: '#87ceeb' },
  { hour: 14, top: '#3a7fc8', mid: '#6bb5e0', bottom: '#a8d8f0' },
  { hour: 16, top: '#5a8ac0', mid: '#8bb8d8', bottom: '#c5dff0' },
  { hour: 17.5, top: '#6a6a8a', mid: '#aa7a6a', bottom: '#ffaa66' },
  { hour: 18.5, top: '#3d3d5a', mid: '#8a5a5a', bottom: '#ff7744' },
  { hour: 19.5, top: '#25253a', mid: '#4a4a6a', bottom: '#885544' },
  { hour: 20.5, top: '#151525', mid: '#1a1a35', bottom: '#2a2a45' },
  { hour: 24, top: '#0a0a12', mid: '#0f0f1a', bottom: '#151525' }
];

/**
 * Calendar HUD with sundial dome, time controls, and calendar info.
 * System-agnostic implementation using AppV2.
 */
export class CalendariaHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {number|null} Hook ID for updateWorldTime */
  #timeHookId = null;

  /** @type {Array} Hook references for cleanup */
  #hooks = [];

  /** @type {object|null} Dial state for time rotation */
  _dialState = null;

  /** @type {boolean} Sticky tray (always visible) */
  #stickyTray = false;

  /** @type {boolean} Sticky position (locks position) */
  #stickyPosition = false;

  /** @type {number} Current time multiplier */
  #multiplier = 1;

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

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-hud',
    classes: ['calendaria', 'calendaria-hud-wrapper'],
    position: { width: 'auto', height: 'auto' },
    window: { frame: false, positioned: true },
    actions: {
      openTimeDial: CalendariaHUD.#onOpenTimeDial,
      searchNotes: CalendariaHUD.#onSearchNotes,
      addNote: CalendariaHUD.#onAddNote,
      openEvent: CalendariaHUD.#onOpenEvent,
      toggleTimeFlow: CalendariaHUD.#onToggleTimeFlow,
      openCalendar: CalendariaHUD.#onOpenCalendar,
      openSettings: CalendariaHUD.#onOpenSettings,
      openWeatherPicker: CalendariaHUD.#onOpenWeatherPicker,
      toSunrise: CalendariaHUD.#onToSunrise,
      toMidday: CalendariaHUD.#onToMidday,
      toSunset: CalendariaHUD.#onToSunset,
      toMidnight: CalendariaHUD.#onToMidnight,
      reverse: CalendariaHUD.#onReverse,
      forward: CalendariaHUD.#onForward,
      closeSearch: CalendariaHUD.#onCloseSearch,
      openSearchResult: CalendariaHUD.#onOpenSearchResult,
      setDate: CalendariaHUD.#onSetDate
    }
  };

  /** @override */
  static PARTS = {
    container: { template: TEMPLATES.CALENDAR_HUD },
    dome: { template: TEMPLATES.CALENDAR_HUD_DOME, container: '.calendaria-hud' },
    bar: { template: TEMPLATES.CALENDAR_HUD_BAR, container: '.calendaria-hud' }
  };

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

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
    return game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_LOCKED);
  }

  /**
   * Whether compact mode is enabled.
   * @returns {boolean} True if compact mode is enabled
   */
  get isCompact() {
    return game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE) === 'compact';
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const components = game.time.components;
    context.isGM = game.user.isGM;
    context.locked = this.isLocked;
    context.isPlaying = TimeKeeper.running;
    const stickyStates = game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_STATES) || {};
    this.#stickyTray = stickyStates.tray ?? false;
    this.#stickyPosition = stickyStates.position ?? false;
    this.#multiplier = stickyStates.multiplier ?? 1;
    context.stickyTray = this.#stickyTray;
    const appSettings = TimeKeeper.getAppSettings('calendaria-hud');
    if (stickyStates.increment && stickyStates.increment !== appSettings.incrementKey) {
      TimeKeeper.setAppIncrement('calendaria-hud', stickyStates.increment);
      TimeKeeper.setIncrement(stickyStates.increment);
    }
    if (this.#multiplier !== appSettings.multiplier) {
      TimeKeeper.setAppMultiplier('calendaria-hud', this.#multiplier);
      TimeKeeper.setMultiplier(this.#multiplier);
    }

    context.time = this.#formatTime(components);
    context.dateDisplay = this.#formatDateDisplay(components);
    const season = calendar?.getCurrentSeason?.();
    context.currentSeason = season ? { name: localize(season.name), color: season.color || '#888', icon: season.icon || 'fas fa-sun' } : null;
    const era = calendar?.getCurrentEra?.();
    context.currentEra = era ? { name: localize(era.name), abbreviation: localize(era.abbreviation || era.name) } : null;
    const cycleData = calendar?.getCycleValues?.();
    context.cycleText = cycleData?.text || null;
    context.weather = this.#getWeatherContext();
    this.#liveEvents = this.#getLiveEvents();
    context.hasEvents = this.#liveEvents.length > 0;
    context.liveEvents = this.#liveEvents;
    context.firstEventColor = this.#liveEvents[0]?.color || null;
    context.currentEvent = this.#liveEvents.length > 0 ? this.#liveEvents[0] : null;
    context.increments = Object.entries(getTimeIncrements()).map(([key, seconds]) => ({ key, label: this.#formatIncrementLabel(key), seconds, selected: key === appSettings.incrementKey }));
    context.multipliers = TIME_MULTIPLIERS.map((m) => ({ value: m.value, label: m.label, selected: m.value === this.#multiplier }));
    context.searchOpen = this.#searchOpen;
    context.searchTerm = this.#searchTerm;
    context.searchResults = this.#searchResults || [];
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.classList.toggle('compact', this.isCompact);
    this.#restorePosition();
    this.#enableDragging();
    this.#updateCelestialDisplay();
    this.#updateDomeVisibility();
    this.#setupEventListeners();
    if (!this.#timeHookId) this.#timeHookId = Hooks.on('updateWorldTime', this.#onUpdateWorldTime.bind(this));
    this.#lastDay = game.time.components.dayOfMonth;
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#restoreStickyStates();
    this.#hooks.push({ name: HOOKS.CLOCK_START_STOP, id: Hooks.on(HOOKS.CLOCK_START_STOP, () => this.#onClockStateChange()) });
    this.#hooks.push({ name: HOOKS.WEATHER_CHANGE, id: Hooks.on(HOOKS.WEATHER_CHANGE, () => this.render({ parts: ['bar'] })) });
    const debouncedRender = foundry.utils.debounce(() => this.render({ parts: ['bar'] }), 100);
    this.#hooks.push({
      name: 'updateJournalEntryPage',
      id: Hooks.on('updateJournalEntryPage', (page) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });
    this.#hooks.push({
      name: 'collapseSidebar',
      id: Hooks.on('collapseSidebar', () => this.#clampToViewport())
    });
    this.#hooks.push({
      name: 'calendaria.displayFormatsChanged',
      id: Hooks.on('calendaria.displayFormatsChanged', () => this.render({ parts: ['bar'] }))
    });
  }

  /** @override */
  async _onClose(options) {
    if (this.#timeHookId) {
      Hooks.off('updateWorldTime', this.#timeHookId);
      this.#timeHookId = null;
    }
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    if (this.#clickOutsideHandler) {
      document.removeEventListener('mousedown', this.#clickOutsideHandler);
      this.#clickOutsideHandler = null;
    }
    if (this.#searchPanelEl?.parentElement === document.body) {
      this.#searchPanelEl.remove();
      this.#searchPanelEl = null;
    }
    this.#hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
    this.#hooks = [];
    await super._onClose(options);
  }

  /* -------------------------------------------- */
  /*  Event Listeners                             */
  /* -------------------------------------------- */

  /**
   * Setup event listeners for the HUD.
   */
  #setupEventListeners() {
    this.element.querySelector('.calendaria-hud-select[data-action="setIncrement"]')?.addEventListener('change', (event) => {
      TimeKeeper.setAppIncrement('calendaria-hud', event.target.value);
      TimeKeeper.setIncrement(event.target.value);
      this.#saveStickyStates();
    });
    this.element.querySelector('.calendaria-hud-select[data-action="setMultiplier"]')?.addEventListener('change', (event) => {
      this.#multiplier = parseFloat(event.target.value);
      TimeKeeper.setAppMultiplier('calendaria-hud', this.#multiplier);
      TimeKeeper.setMultiplier(this.#multiplier);
      this.#saveStickyStates();
    });
    const searchInput = this.element.querySelector('.calendaria-hud-search-panel .search-input');
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

    this._resizeHandler = this.#onWindowResize.bind(this);
    window.addEventListener('resize', this._resizeHandler);
  }

  /**
   * Handle window resize events.
   */
  #onWindowResize() {
    this.#updateDomeVisibility();
    this.#clampToViewport();
  }

  /* -------------------------------------------- */
  /*  Sticky States                               */
  /* -------------------------------------------- */

  /**
   * Restore sticky states from settings.
   */
  #restoreStickyStates() {
    const states = game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_STATES);
    if (!states) return;
    this.#stickyTray = states.tray ?? false;
    this.#stickyPosition = states.position ?? false;
    this.#multiplier = states.multiplier ?? 1;
    TimeKeeper.setAppMultiplier('calendaria-hud', this.#multiplier);
    TimeKeeper.setMultiplier(this.#multiplier);
    if (states.increment) {
      TimeKeeper.setAppIncrement('calendaria-hud', states.increment);
      TimeKeeper.setIncrement(states.increment);
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
    await game.settings.set(MODULE.ID, SETTINGS.HUD_STICKY_STATES, {
      tray: this.#stickyTray,
      position: this.#stickyPosition,
      multiplier: this.#multiplier,
      increment: TimeKeeper.getAppSettings('calendaria-hud').incrementKey
    });
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

  /* -------------------------------------------- */
  /*  Position & Dragging                         */
  /* -------------------------------------------- */

  /**
   * Restore saved position from settings.
   */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION);
    if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
      this.setPosition({ left: savedPos.left, top: savedPos.top });
    } else {
      const rect = this.element.getBoundingClientRect();
      const left = (window.innerWidth - rect.width) / 2;
      const top = 75;
      this.setPosition({ left, top });
    }
    this.#clampToViewport();
  }

  /**
   * Clamp position to viewport, accounting for sidebar.
   */
  #clampToViewport() {
    const rect = this.element.getBoundingClientRect();
    const sidebar = document.getElementById('sidebar');
    const sidebarWidth = sidebar && !sidebar.classList.contains('collapsed') ? sidebar.offsetWidth : 0;
    let { left, top } = this.position;
    left = Math.max(0, Math.min(left, window.innerWidth - rect.width - sidebarWidth));
    top = Math.max(0, Math.min(top, window.innerHeight - rect.height));
    this.setPosition({ left, top });
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
    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      if (this.isLocked) return;
      if (this.#searchOpen) this.#closeSearch();
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
      const rect = this.element.getBoundingClientRect();
      const sidebar = document.getElementById('sidebar');
      const sidebarWidth = sidebar && !sidebar.classList.contains('collapsed') ? sidebar.offsetWidth : 0;
      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width - sidebarWidth));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      this.setPosition({ left: newLeft, top: newTop });
      this.#updateDomeVisibility();
    };

    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);
      dragHandle.classList.remove('dragging');
      await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, { left: this.position.left, top: this.position.top });
    };
  }

  /* -------------------------------------------- */
  /*  Dome Visibility                             */
  /* -------------------------------------------- */

  /**
   * Update dome visibility based on viewport position.
   * Fades dome as it approaches top of viewport, hides if not enough space.
   */
  #updateDomeVisibility() {
    const dome = this.element.querySelector('.calendaria-hud-dome');
    if (!dome) return;
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

  /* -------------------------------------------- */
  /*  Celestial Display                           */
  /* -------------------------------------------- */

  /**
   * Update the sundial dome display (sky gradient, sun/moon positions, stars).
   */
  #updateCelestialDisplay() {
    const components = game.time.components;
    const hour = this.#getDecimalHour(components);
    const sky = this.element.querySelector('.calendaria-hud-sky');
    if (sky) {
      const colors = this.#getSkyColors(hour);
      sky.style.background = `linear-gradient(to bottom, ${colors.top} 0%, ${colors.mid} 50%, ${colors.bottom} 100%)`;
    }

    const stars = this.element.querySelector('.calendaria-hud-stars');
    if (stars) {
      const showStars = hour < 5.5 || hour > 19;
      const partialStars = (hour >= 5.5 && hour < 7) || (hour > 17.5 && hour <= 19);
      stars.classList.toggle('visible', showStars || partialStars);
      if (partialStars) {
        const starOpacity = hour < 12 ? 1 - (hour - 5.5) / 1.5 : (hour - 17.5) / 1.5;
        stars.style.opacity = Math.max(0, Math.min(1, starOpacity));
      } else {
        stars.style.opacity = '';
      }
    }

    const clouds = this.element.querySelector('.calendaria-hud-clouds');
    if (clouds) {
      const showClouds = hour >= 7 && hour < 18;
      const partialClouds = (hour >= 6 && hour < 7) || (hour >= 18 && hour < 19);
      clouds.classList.toggle('visible', showClouds || partialClouds);
      if (partialClouds) {
        const cloudOpacity = hour < 12 ? hour - 6 : 1 - (hour - 18);
        clouds.style.opacity = Math.max(0, Math.min(1, cloudOpacity));
      } else {
        clouds.style.opacity = '';
      }
    }

    const isCompact = this.isCompact;
    const trackWidth = isCompact ? 100 : 140;
    const trackHeight = isCompact ? 50 : 70;
    const sunSize = isCompact ? 16 : 20;
    const moonSize = isCompact ? 14 : 18;
    const isSunVisible = hour >= 6 && hour < 18;
    const sun = this.element.querySelector('.calendaria-hud-sun');
    const moon = this.element.querySelector('.calendaria-hud-moon');
    if (sun) {
      sun.style.opacity = isSunVisible ? '1' : '0';
      if (isSunVisible) this.#positionCelestialBody(sun, hour, trackWidth, trackHeight, sunSize, true);
    }
    if (moon) {
      moon.style.opacity = isSunVisible ? '0' : '1';
      if (!isSunVisible) this.#positionCelestialBody(moon, hour, trackWidth, trackHeight, moonSize, false);
    }
  }

  /**
   * Position a celestial body on the semicircular track.
   * @param {HTMLElement} element - The body element
   * @param {number} hour - Current hour (decimal)
   * @param {number} trackWidth - Track width in pixels
   * @param {number} trackHeight - Track height in pixels
   * @param {number} bodySize - Body size in pixels
   * @param {boolean} isSun - Whether this is the sun (vs moon)
   */
  #positionCelestialBody(element, hour, trackWidth, trackHeight, bodySize, isSun) {
    let normalizedHour;
    if (isSun) {
      normalizedHour = hour - 6;
    } else {
      if (hour >= 18) normalizedHour = hour - 18;
      else normalizedHour = hour + 6;
    }
    normalizedHour = Math.max(0, Math.min(12, normalizedHour));
    const angle = (normalizedHour / 12) * Math.PI;
    const centerX = trackWidth / 2;
    const centerY = trackHeight;
    const radius = Math.min(trackWidth / 2, trackHeight) - bodySize / 2 - 4;
    const x = centerX - radius * Math.cos(angle) - bodySize / 2;
    const y = centerY - radius * Math.sin(angle) - bodySize / 2;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }

  /**
   * Get interpolated sky colors for a given hour.
   * @param {number} hour - Hour (0-24, decimal)
   * @returns {{top: string, mid: string, bottom: string}} Sky gradient colors
   */
  #getSkyColors(hour) {
    hour = ((hour % 24) + 24) % 24;
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
    return { top: this.#lerpColor(kf1.top, kf2.top, t), mid: this.#lerpColor(kf1.mid, kf2.mid, t), bottom: this.#lerpColor(kf1.bottom, kf2.bottom, t) };
  }

  /**
   * Linearly interpolate between two hex colors.
   * @param {string} color1 - Start color (#RRGGBB)
   * @param {string} color2 - End color (#RRGGBB)
   * @param {number} t - Interpolation factor (0-1)
   * @returns {string} Interpolated color as rgb()
   */
  #lerpColor(color1, color2, t) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /* -------------------------------------------- */
  /*  Time Updates                                */
  /* -------------------------------------------- */

  /**
   * Handle world time updates - update display without full re-render.
   */
  #onUpdateWorldTime() {
    if (!this.rendered) return;
    const components = game.time.components;
    if (this.#lastDay !== null && this.#lastDay !== components.dayOfMonth) {
      this.#lastDay = components.dayOfMonth;
      if (this.#barRenderDebounce) clearTimeout(this.#barRenderDebounce);
      this.#barRenderDebounce = setTimeout(() => {
        this.#barRenderDebounce = null;
        this.render({ parts: ['bar'] });
      }, 200);
      const dateEl = this.element.querySelector('.calendaria-hud-date');
      if (dateEl) dateEl.textContent = this.#formatDateDisplay(components);
    }

    const timeEl = this.element.querySelector('.calendaria-hud-time');
    if (timeEl) timeEl.textContent = this.#formatTime(components);
    const hud = this.element.querySelector('.calendaria-hud');
    if (hud) hud.classList.toggle('time-flowing', TimeKeeper.running);
    this.#updateCelestialDisplay();
  }

  /**
   * Handle clock state changes.
   */
  #onClockStateChange() {
    if (!this.rendered) return;
    const running = TimeKeeper.running;
    const hud = this.element.querySelector('.calendaria-hud');
    if (hud) hud.classList.toggle('time-flowing', running);
    const playBtn = this.element.querySelector('.calendaria-hud-play-btn');
    if (playBtn) {
      playBtn.classList.toggle('playing', running);
      playBtn.setAttribute('aria-pressed', String(running));
      playBtn.dataset.tooltip = running ? localize('CALENDARIA.HUD.PauseTime') : localize('CALENDARIA.TimeKeeper.Start');
      const icon = playBtn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-play', !running);
        icon.classList.toggle('fa-pause', running);
      }
    }
  }

  /* -------------------------------------------- */
  /*  Formatting Helpers                          */
  /* -------------------------------------------- */

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
    return formatForLocation(calendar, { ...components, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'hudTime');
  }

  /**
   * Format full date display using display format settings.
   * @param {object} components - Time components
   * @returns {string} Formatted date
   */
  #formatDateDisplay(components) {
    const calendar = this.calendar;
    if (!calendar) return '';
    return formatForLocation(calendar, { ...components, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'hudDate');
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

  /* -------------------------------------------- */
  /*  Context Helpers                             */
  /* -------------------------------------------- */

  /**
   * Get weather context for template.
   * @returns {object|null} Weather data object or null if no weather
   */
  #getWeatherContext() {
    const weather = WeatherManager.getCurrentWeather();
    if (!weather) return null;
    let icon = weather.icon || 'fa-cloud';
    if (icon && !icon.includes('fa-solid') && !icon.includes('fa-regular') && !icon.includes('fa-light') && !icon.includes('fas ') && !icon.includes('far ')) icon = `fa-solid ${icon}`;
    return {
      id: weather.id,
      label: localize(weather.label),
      icon,
      color: weather.color,
      temp: WeatherManager.formatTemperature(WeatherManager.getTemperature()),
      tooltip: weather.description ? localize(weather.description) : localize(weather.label)
    };
  }

  /**
   * Get live events for the current day (up to 4).
   * Returns icon-only data with full tooltips.
   * @returns {Array} Array of event objects with id, name, icon, color, tooltip
   */
  #getLiveEvents() {
    const components = game.time.components;
    const calendar = this.calendar;
    if (!calendar) return [];
    const yearZero = calendar.years?.yearZero ?? 0;
    const year = components.year + yearZero;
    const month = components.month;
    const day = (components.dayOfMonth ?? 0) + 1;
    const notes = ViewUtils.getNotesOnDay(year, month, day);
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

  /* -------------------------------------------- */
  /*  Time Dial                                   */
  /* -------------------------------------------- */

  /**
   * Open the circular time rotation dial.
   */
  async #openTimeRotationDial() {
    log(3, 'Opening time rotation dial');
    const existingDial = document.getElementById('calendaria-time-dial');
    if (existingDial) existingDial.remove();
    const currentTime = game.time.worldTime;
    const date = new Date(currentTime * 1000);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const templateData = { currentTime: this.#formatDialTime(hours, minutes), hourMarkers: this.#generateHourMarkers() };
    const html = await foundry.applications.handlebars.renderTemplate(TEMPLATES.TIME_DIAL, templateData);
    const dial = document.createElement('div');
    dial.id = 'calendaria-time-dial';
    dial.className = 'calendaria-time-dial';
    dial.innerHTML = html;
    document.body.appendChild(dial);
    const dialContainer = dial.querySelector('.dial-container');
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
    const markers = [];
    for (let hour = 0; hour < 24; hour++) {
      const angle = hour * 15 + 90;
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
        strokeWidth: hour % 6 === 0 ? 2 : 1,
        showLabel: hour % 6 === 0
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
   * @param {number} hours - Hour value (0-23)
   * @param {number} minutes - Minute value (0-59)
   * @returns {number} Angle in degrees (0-360)
   */
  #timeToAngle(hours, minutes) {
    const totalMinutes = hours * 60 + minutes;
    let angle = (totalMinutes / (24 * 60)) * 360;
    angle = (angle + 180) % 360;
    return angle;
  }

  /**
   * Convert angle to time.
   * @param {number} angle - Angle in degrees (0-360)
   * @returns {{hours: number, minutes: number}} Time object with hours and minutes
   */
  #angleToTime(angle) {
    angle = ((angle % 360) + 360) % 360;
    angle = (angle - 180 + 360) % 360;
    const totalMinutes = Math.round((angle / 360) * (24 * 60));
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return { hours, minutes };
  }

  /**
   * Update the dial's visual rotation.
   * @param {HTMLElement} dial - The dial container element
   * @param {number} angle - Rotation angle in degrees
   */
  #updateDialRotation(dial, angle) {
    const handleContainer = dial.querySelector('.dial-handle-container');
    const sky = dial.querySelector('.dial-sky');
    const sunContainer = dial.querySelector('.dial-sun');
    if (!handleContainer || !sky || !sunContainer) return;
    const time = this.#angleToTime(angle);
    const timeDisplay = dial.querySelector('.dial-time');
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
    const totalMinutes = time.hours * 60 + time.minutes;
    const dayProgress = ((totalMinutes / (24 * 60)) * 2 + 1.5) % 2;
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
    const sky = dial.querySelector('.dial-sky');
    const backdrop = dial.querySelector('.dial-backdrop');
    const handle = dial.querySelector('.dial-handle');
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

    const timeInput = dial.querySelector('.dial-time');
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
    if (isPM && hours < 12) hours += 12;
    else if (isAM && hours === 12) hours = 0;
    if (hours < 0 || hours > 23) return null;
    if (minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
  }

  /**
   * Apply the time change from the dial.
   */
  async #applyTimeChange() {
    if (!this._dialState) return;
    const { currentHours, currentMinutes, initialTime } = this._dialState;
    const currentDate = new Date(initialTime * 1000);
    currentDate.setUTCHours(currentHours, currentMinutes, 0, 0);
    const newWorldTime = Math.floor(currentDate.getTime() / 1000);
    const timeDiff = newWorldTime - initialTime;
    if (timeDiff !== 0) {
      await game.time.advance(timeDiff);
      log(3, `Time adjusted by ${timeDiff} seconds to ${this.#formatDialTime(currentHours, currentMinutes)}`);
    }
    this._dialState.initialTime = newWorldTime;
  }

  /* -------------------------------------------- */
  /*  Time Shortcuts                              */
  /* -------------------------------------------- */

  /**
   * Advance time to a specific hour of day.
   * @param {number} targetHour - Target hour (fractional)
   * @param {boolean} [nextDay] - Always advance to next day
   */
  async #advanceToHour(targetHour, nextDay = false) {
    if (!game.user.isGM) return;
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
    if (secondsToAdvance > 0) await game.time.advance(secondsToAdvance);
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Handle click on dome to open time dial.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onOpenTimeDial(_event, _target) {
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
   * Handle click on date to open date picker dialog.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onSetDate(_event, _target) {
    if (!game.user.isGM) {
      ui.notifications.warn('CALENDARIA.Common.GMOnly', { localize: true });
      return;
    }

    const calendar = this.calendar;
    const components = game.time.components;
    const yearZero = calendar.years?.yearZero ?? 0;
    const daysInMonth = calendar.months.values[components.month]?.days ?? 30;
    const currentDay = (components.dayOfMonth ?? 0) + 1;
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.PARTIALS.DATE_PICKER, {
      formClass: 'set-date-form',
      year: components.year + yearZero,
      months: calendar.months.values.map((m, i) => ({ index: i, name: localize(m.name), selected: i === components.month })),
      days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      currentDay
    });

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: localize('CALENDARIA.HUD.SetDate') },
      content,
      ok: {
        label: localize('CALENDARIA.HUD.SetDate'),
        icon: 'fas fa-calendar-check',
        callback: (_event, button, _dialog) => {
          const form = button.form;
          return { year: parseInt(form.elements.year.value) - yearZero, month: parseInt(form.elements.month.value), day: parseInt(form.elements.day.value) };
        }
      },
      rejectClose: false
    });

    if (result) {
      const newTime = calendar.componentsToTime({
        year: result.year,
        month: result.month,
        dayOfMonth: result.day - 1,
        hour: components.hour,
        minute: components.minute,
        second: components.second ?? 0
      });

      await game.time.advance(newTime - game.time.worldTime);
    }
  }

  /**
   * Update search results without full re-render.
   */
  #updateSearchResults() {
    const panel = this.#searchPanelEl || this.element.querySelector('.calendaria-hud-search-panel');
    if (!panel) return;
    const resultsContainer = panel.querySelector('.search-panel-results');
    if (!resultsContainer) return;
    if (this.#searchResults?.length) {
      resultsContainer.innerHTML = this.#searchResults
        .map((r) => {
          const icons = [];
          if (r.data?.icon) icons.push(`<i class="result-note-icon ${r.data.icon}" style="color: ${r.data.color || '#4a9eff'}" data-tooltip="${localize('CALENDARIA.Search.NoteIcon')}"></i>`);
          if (r.data?.gmOnly) icons.push(`<i class="result-gm-icon fas fa-lock" data-tooltip="${localize('CALENDARIA.Search.GMOnly')}"></i>`);
          if (r.data?.repeatIcon) icons.push(`<i class="result-repeat-icon ${r.data.repeatIcon}" data-tooltip="${r.data.repeatTooltip || ''}"></i>`);
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
   * Moves panel to document.body to avoid ApplicationV2 positioning issues.
   */
  #positionSearchPanel() {
    const panel = this.element.querySelector('.calendaria-hud-search-panel');
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
    const page = await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: today.year + yearZero, month: today.month, day: (today.dayOfMonth ?? 0) + 1, hour: 12, minute: 0 },
        endDate: { year: today.year + yearZero, month: today.month, day: (today.dayOfMonth ?? 0) + 1, hour: 13, minute: 0 }
      }
    });
    if (page) page.sheet.render(true, { mode: 'edit' });
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
   * Handle click on play/pause button to toggle time flow.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onToggleTimeFlow(_event, _target) {
    TimeKeeper.toggle();
  }

  /**
   * Handle click to open calendar application.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onOpenCalendar(_event, _target) {
    new CalendarApplication().render(true);
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
    if (!game.user.isGM) return;
    await openWeatherPicker();
  }

  /**
   * Handle click to advance time to sunrise.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onToSunrise(_event, _target) {
    const calendar = this.calendar;
    if (!calendar?.sunrise) return;
    const targetHour = calendar.sunrise();
    if (targetHour !== null) await this.#advanceToHour(targetHour);
  }

  /**
   * Handle click to advance time to midday.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onToMidday(_event, _target) {
    const calendar = this.calendar;
    const targetHour = calendar?.solarMidday?.() ?? (game.time.calendar?.days?.hoursPerDay ?? 24) / 2;
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
    const targetHour = calendar.sunset();
    if (targetHour !== null) await this.#advanceToHour(targetHour);
  }

  /**
   * Handle click to advance time to midnight.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onToMidnight(_event, _target) {
    const calendar = this.calendar;
    if (calendar?.solarMidnight) {
      const targetHour = calendar.solarMidnight();
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
    TimeKeeper.reverseFor('calendaria-hud');
  }

  /**
   * Handle click on forward time button.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onForward(_event, _target) {
    TimeKeeper.forwardFor('calendaria-hud');
  }

  /* -------------------------------------------- */
  /*  Static Methods                              */
  /* -------------------------------------------- */

  /**
   * Show the HUD.
   * @returns {CalendariaHUD} The HUD instance
   */
  static show() {
    const existing = foundry.applications.instances.get('calendaria-hud');
    if (existing) {
      existing.render({ force: true });
      return existing;
    }
    const hud = new CalendariaHUD();
    hud.render({ force: true });
    return hud;
  }

  /**
   * Hide the HUD.
   */
  static hide() {
    foundry.applications.instances.get('calendaria-hud')?.close();
  }

  /**
   * Toggle HUD visibility.
   */
  static toggle() {
    const existing = foundry.applications.instances.get('calendaria-hud');
    if (existing?.rendered) this.hide();
    else this.show();
  }

  /**
   * Reset position to default (centered).
   */
  static async resetPosition() {
    await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, null);
    if (foundry.applications.instances.get('calendaria-hud')?.rendered) {
      this.hide();
      this.show();
    }
  }
}
