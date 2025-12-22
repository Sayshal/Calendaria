/**
 * Calendaria HUD - System-agnostic calendar widget.
 * Displays a sundial dome with sun/moon, time controls, date/weather info.
 * Fully independent of dnd5e or any other game system.
 *
 * @module Applications/CalendariaHUD
 * @author Tyler
 */

import { CalendarApplication } from './calendar-application.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { MODULE, SETTINGS, TEMPLATES, HOOKS } from '../constants.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import NoteManager from '../notes/note-manager.mjs';
import TimeKeeper, { getTimeIncrements } from '../time/time-keeper.mjs';
import WeatherManager from '../weather/weather-manager.mjs';
import * as ViewUtils from './calendar-view-utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-hud',
    classes: ['calendaria-hud-wrapper'],
    position: { width: 'auto', height: 'auto' },
    window: { frame: false, positioned: true },
    actions: {
      openTimeDial: CalendariaHUD.#onOpenTimeDial,
      searchNotes: CalendariaHUD.#onSearchNotes,
      addNote: CalendariaHUD.#onAddNote,
      openEvent: CalendariaHUD.#onOpenEvent,
      toggleTimeFlow: CalendariaHUD.#onToggleTimeFlow,
      openCalendar: CalendariaHUD.#onOpenCalendar,
      toggleLock: CalendariaHUD.#onToggleLock,
      openSettings: CalendariaHUD.#onOpenSettings,
      openWeatherPicker: CalendariaHUD.#onOpenWeatherPicker,
      toSunrise: CalendariaHUD.#onToSunrise,
      toMidday: CalendariaHUD.#onToMidday,
      toSunset: CalendariaHUD.#onToSunset,
      toMidnight: CalendariaHUD.#onToMidnight,
      reverse: CalendariaHUD.#onReverse,
      reverse5x: CalendariaHUD.#onReverse5x,
      forward: CalendariaHUD.#onForward,
      forward5x: CalendariaHUD.#onForward5x
    }
  };

  /** @override */
  static PARTS = { hud: { template: TEMPLATES.CALENDAR_HUD } };

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Get the active calendar.
   * @returns {CalendariaCalendar}
   */
  get calendar() {
    return CalendarManager.getActiveCalendar();
  }

  /**
   * Whether position is locked.
   * @returns {boolean}
   */
  get isLocked() {
    return game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_LOCKED);
  }

  /**
   * Whether compact mode is enabled.
   * @returns {boolean}
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

    // Core state
    context.isGM = game.user.isGM;
    context.locked = this.isLocked;
    context.isPlaying = TimeKeeper.running;

    // Time display
    context.time = this.#formatTime(components);

    // Date display
    context.date = this.#formatDate(components);
    context.year = this.#formatYear(components);

    // Season and Era
    const currentSeason = calendar?.getCurrentSeason?.();
    const currentEra = calendar?.getCurrentEra?.();
    context.season = currentSeason?.name ? localize(currentSeason.name) : null;
    context.era = currentEra?.name ? localize(currentEra.name) : null;

    // Weather
    context.weather = this.#getWeatherContext();

    // Live event (first event on current day)
    context.liveEvent = this.#getLiveEvent();

    // Time increments for dropdown
    context.increments = Object.entries(getTimeIncrements()).map(([key, seconds]) => ({
      key,
      label: this.#formatIncrementLabel(key),
      seconds,
      selected: key === TimeKeeper.incrementKey
    }));

    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Apply compact mode class
    this.element.classList.toggle('compact', this.isCompact);

    // Restore position
    this.#restorePosition();

    // Enable dragging
    this.#enableDragging();

    // Update celestial visuals
    this.#updateCelestialDisplay();

    // Increment selector listener
    this.element.querySelector('[data-action="setIncrement"]')?.addEventListener('change', (event) => {
      TimeKeeper.setIncrement(event.target.value);
    });

    // Set up time update hook
    if (!this.#timeHookId) {
      this.#timeHookId = Hooks.on('updateWorldTime', this.#onUpdateWorldTime.bind(this));
    }
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    // Clock state hook
    this.#hooks.push({
      name: HOOKS.CLOCK_START_STOP,
      id: Hooks.on(HOOKS.CLOCK_START_STOP, () => this.#onClockStateChange())
    });

    // Weather change hook
    this.#hooks.push({
      name: HOOKS.WEATHER_CHANGE,
      id: Hooks.on(HOOKS.WEATHER_CHANGE, () => this.render())
    });

    // Note changes
    const debouncedRender = foundry.utils.debounce(() => this.render(), 100);
    this.#hooks.push({
      name: 'updateJournalEntryPage',
      id: Hooks.on('updateJournalEntryPage', (page) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });
  }

  /** @override */
  async _onClose(options) {
    if (this.#timeHookId) {
      Hooks.off('updateWorldTime', this.#timeHookId);
      this.#timeHookId = null;
    }

    this.#hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
    this.#hooks = [];

    await super._onClose(options);
  }

  /* -------------------------------------------- */
  /*  Position & Dragging                         */
  /* -------------------------------------------- */

  /**
   * Restore saved position from settings.
   */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_POSITION);

    if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
      this.setPosition({ left: savedPos.left, top: savedPos.top });
    } else {
      // Default: centered horizontally, near top
      const rect = this.element.getBoundingClientRect();
      const left = (window.innerWidth - rect.width) / 2;
      const top = 16;
      this.setPosition({ left, top });
    }
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
      // Prevent dragging when locked
      if (this.isLocked) return;

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

      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;

      // Clamp to viewport
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));

      this.setPosition({ left: newLeft, top: newTop });
    };

    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);

      dragHandle.classList.remove('dragging');

      // Save position
      await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_POSITION, {
        left: this.position.left,
        top: this.position.top
      });
    };
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

    // Update sky gradient
    const sky = this.element.querySelector('.calendaria-hud-sky');
    if (sky) {
      const colors = this.#getSkyColors(hour);
      sky.style.background = `linear-gradient(to bottom, ${colors.top} 0%, ${colors.mid} 50%, ${colors.bottom} 100%)`;
    }

    // Update stars visibility
    const stars = this.element.querySelector('.calendaria-hud-stars');
    if (stars) {
      const showStars = hour < 5.5 || hour > 19;
      const partialStars = (hour >= 5.5 && hour < 7) || (hour > 17.5 && hour <= 19);
      stars.classList.toggle('visible', showStars || partialStars);

      if (partialStars) {
        const starOpacity = hour < 12 ? 1 - (hour - 5.5) / 1.5 : (hour - 17.5) / 1.5;
        stars.style.opacity = Math.max(0, Math.min(1, starOpacity));
      } else if (showStars) {
        stars.style.opacity = '';
      }
    }

    // Update sun/moon positions
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
      // Sun: maps 6-18 to 0-12
      normalizedHour = hour - 6;
    } else {
      // Moon: maps 18-6 (wrapping) to 0-12
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
   * @returns {{top: string, mid: string, bottom: string}}
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

    return {
      top: this.#lerpColor(kf1.top, kf2.top, t),
      mid: this.#lerpColor(kf1.mid, kf2.mid, t),
      bottom: this.#lerpColor(kf1.bottom, kf2.bottom, t)
    };
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

    // Update time display
    const timeEl = this.element.querySelector('.calendaria-hud-time');
    if (timeEl) timeEl.textContent = this.#formatTime(components);

    // Update celestial display
    this.#updateCelestialDisplay();
  }

  /**
   * Handle clock state changes.
   */
  #onClockStateChange() {
    if (!this.rendered) return;

    const running = TimeKeeper.running;
    const playBtn = this.element.querySelector('.calendaria-hud-play-btn');

    if (playBtn) {
      playBtn.classList.toggle('playing', running);
      playBtn.dataset.tooltip = running
        ? localize('CALENDARIA.HUD.PauseTime')
        : localize('CALENDARIA.HUD.StartTime');

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
    return (components.hour ?? 0) +
           (components.minute ?? 0) / minutesPerHour +
           (components.second ?? 0) / (minutesPerHour * secondsPerMinute);
  }

  /**
   * Format time for display.
   * @param {object} components - Time components
   * @returns {string} Formatted time (HH:MM:SS)
   */
  #formatTime(components) {
    const h = String(components.hour ?? 0).padStart(2, '0');
    const m = String(components.minute ?? 0).padStart(2, '0');
    const s = String(components.second ?? 0).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  /**
   * Format date for display.
   * @param {object} components - Time components
   * @returns {string} Formatted date
   */
  #formatDate(components) {
    const calendar = this.calendar;
    if (!calendar) return '';

    const day = (components.dayOfMonth ?? 0) + 1;
    const month = calendar.months?.values?.[components.month];
    const monthName = month?.name ? localize(month.name) : '';

    return `${day}${this.#getOrdinalSuffix(day)} of ${monthName}`;
  }

  /**
   * Format year for display.
   * @param {object} components - Time components
   * @returns {string} Formatted year with era
   */
  #formatYear(components) {
    const calendar = this.calendar;
    if (!calendar) return '';

    const yearZero = calendar.years?.yearZero ?? 0;
    const displayYear = components.year + yearZero;
    return calendar.formatYearWithEra?.(displayYear) ?? String(displayYear);
  }

  /**
   * Get ordinal suffix for a number.
   * @param {number} n - Number
   * @returns {string} Ordinal suffix (st, nd, rd, th)
   */
  #getOrdinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  /**
   * Format increment key for display.
   * @param {string} key - Increment key
   * @returns {string} Localized label
   */
  #formatIncrementLabel(key) {
    const labels = {
      second: localize('CALENDARIA.TimeKeeper.Second'),
      round: localize('CALENDARIA.TimeKeeper.Round'),
      minute: localize('CALENDARIA.TimeKeeper.Minute'),
      hour: localize('CALENDARIA.TimeKeeper.Hour'),
      day: localize('CALENDARIA.TimeKeeper.Day'),
      week: localize('CALENDARIA.TimeKeeper.Week'),
      month: localize('CALENDARIA.TimeKeeper.Month'),
      season: localize('CALENDARIA.TimeKeeper.Season'),
      year: localize('CALENDARIA.TimeKeeper.Year')
    };
    return labels[key] || key;
  }

  /* -------------------------------------------- */
  /*  Context Helpers                             */
  /* -------------------------------------------- */

  /**
   * Get weather context for template.
   * @returns {object|null}
   */
  #getWeatherContext() {
    const weather = WeatherManager.getCurrentWeather();
    if (!weather) return null;

    return {
      id: weather.id,
      label: localize(weather.label),
      icon: weather.icon,
      color: weather.color,
      temp: WeatherManager.formatTemperature(WeatherManager.getTemperature()),
      tooltip: weather.description ? localize(weather.description) : localize(weather.label)
    };
  }

  /**
   * Get the first live event for the current day.
   * @returns {object|null}
   */
  #getLiveEvent() {
    const components = game.time.components;
    const calendar = this.calendar;
    if (!calendar) return null;

    const yearZero = calendar.years?.yearZero ?? 0;
    const year = components.year + yearZero;
    const month = components.month;
    const day = (components.dayOfMonth ?? 0) + 1;

    const notes = ViewUtils.getNotesOnDay(year, month, day);
    if (!notes.length) return null;

    const note = notes[0];
    return {
      id: note.id,
      parentId: note.parent.id,
      name: note.name,
      shortName: note.name.length > 10 ? note.name.substring(0, 10) + '...' : note.name,
      icon: note.system.icon || 'fas fa-star',
      color: note.system.color || '#e88'
    };
  }

  /* -------------------------------------------- */
  /*  Time Dial                                   */
  /* -------------------------------------------- */

  /**
   * Open the circular time rotation dial.
   * Reuses the existing time dial template and logic.
   */
  async #openTimeRotationDial() {
    log(3, 'Opening time rotation dial');

    // Remove any existing dial
    const existingDial = document.getElementById('calendaria-time-dial');
    if (existingDial) existingDial.remove();

    // Get current calendar time
    const currentTime = game.time.worldTime;
    const date = new Date(currentTime * 1000);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();

    // Prepare template data
    const templateData = {
      currentTime: this.#formatDialTime(hours, minutes),
      hourMarkers: this.#generateHourMarkers()
    };

    // Render the template
    const html = await foundry.applications.handlebars.renderTemplate(TEMPLATES.TIME_DIAL, templateData);

    // Create the dial container
    const dial = document.createElement('div');
    dial.id = 'calendaria-time-dial';
    dial.className = 'calendaria-time-dial';
    dial.innerHTML = html;

    // Position relative to HUD
    document.body.appendChild(dial);
    const dialContainer = dial.querySelector('.dial-container');
    const dialRect = dialContainer.getBoundingClientRect();
    const hudRect = this.element.getBoundingClientRect();

    // Center on HUD horizontally
    let left = hudRect.left + hudRect.width / 2 - dialRect.width / 2;
    left = Math.min(Math.max(left, 0), window.innerWidth - dialRect.width);

    // Position below HUD (or above if not enough room)
    let top;
    const spaceBelow = window.innerHeight - hudRect.bottom;
    const spaceAbove = hudRect.top;

    if (spaceBelow >= dialRect.height + 20) top = hudRect.bottom + 20;
    else if (spaceAbove >= dialRect.height + 20) top = hudRect.top - dialRect.height - 20;
    else top = hudRect.bottom + 20;

    dial.style.left = `${left}px`;
    dial.style.top = `${top}px`;

    // Store initial values
    this._dialState = { currentHours: hours, currentMinutes: minutes, initialTime: currentTime };

    // Set initial rotation
    const initialAngle = this.#timeToAngle(hours, minutes);
    this.#updateDialRotation(dial, initialAngle);

    // Add interaction handlers
    this.#setupDialInteraction(dial);
  }

  /**
   * Generate hour marker data for the dial template.
   * @returns {Array}
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
   * @param {number} hours
   * @param {number} minutes
   * @returns {string}
   */
  #formatDialTime(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  /**
   * Convert time to angle in degrees.
   * @param {number} hours
   * @param {number} minutes
   * @returns {number}
   */
  #timeToAngle(hours, minutes) {
    const totalMinutes = hours * 60 + minutes;
    let angle = (totalMinutes / (24 * 60)) * 360;
    angle = (angle + 180) % 360;
    return angle;
  }

  /**
   * Convert angle to time.
   * @param {number} angle
   * @returns {{hours: number, minutes: number}}
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
   * @param {HTMLElement} dial
   * @param {number} angle
   */
  #updateDialRotation(dial, angle) {
    const handleContainer = dial.querySelector('.dial-handle-container');
    const sky = dial.querySelector('.dial-sky');
    const sunContainer = dial.querySelector('.dial-sun');

    if (!handleContainer || !sky || !sunContainer) return;

    const time = this.#angleToTime(angle);
    const timeDisplay = dial.querySelector('.dial-time');
    if (timeDisplay && document.activeElement !== timeDisplay) {
      timeDisplay.value = this.#formatDialTime(time.hours, time.minutes);
    }

    const normalizedAngle = ((angle % 360) + 360) % 360;

    // Calculate sun opacity
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

    // Calculate moon opacity
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

    // Apply horizon blocker
    const sunPosition = normalizedAngle;
    if (sunPosition >= 91 && sunPosition <= 269) sunOpacity = 0;
    if (moonPosition >= 91 && moonPosition <= 269) moonOpacity = 0;

    // Calculate day progress for sky
    const totalMinutes = time.hours * 60 + time.minutes;
    const dayProgress = ((totalMinutes / (24 * 60)) * 2 + 1.5) % 2;

    // Update CSS custom properties
    sky.style.setProperty('--calendar-day-progress', dayProgress);
    sky.style.setProperty('--calendar-night-progress', dayProgress);
    sky.style.setProperty('--sun-opacity', sunOpacity);
    sky.style.setProperty('--moon-opacity', moonOpacity);

    sunContainer.style.transform = `rotate(${angle - 84}deg)`;
    handleContainer.style.transform = `rotate(${angle}deg)`;

    // Store current time
    if (this._dialState) {
      this._dialState.currentHours = time.hours;
      this._dialState.currentMinutes = time.minutes;
    }
  }

  /**
   * Setup interaction handlers for the dial.
   * @param {HTMLElement} dial
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

    // Time input handlers
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
   * @param {string} input
   * @returns {{hours: number, minutes: number}|null}
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
   * @param {boolean} [nextDay=false] - Always advance to next day
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

  static async #onOpenTimeDial(event, target) {
    await this.#openTimeRotationDial();
  }

  static async #onSearchNotes(event, target) {
    // TODO: Implement search dialog
    ui.notifications.info('Search functionality coming soon');
  }

  static async #onAddNote(event, target) {
    const today = game.time.components;
    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;

    const page = await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: {
          year: today.year + yearZero,
          month: today.month,
          day: (today.dayOfMonth ?? 0) + 1,
          hour: 12,
          minute: 0
        },
        endDate: {
          year: today.year + yearZero,
          month: today.month,
          day: (today.dayOfMonth ?? 0) + 1,
          hour: 13,
          minute: 0
        }
      }
    });

    if (page) page.sheet.render(true, { mode: 'edit' });
  }

  static #onOpenEvent(event, target) {
    const pageId = target.dataset.eventId;
    const journalId = target.dataset.parentId;
    const journal = game.journal.get(journalId);
    const page = journal?.pages.get(pageId);
    if (page) page.sheet.render(true, { mode: 'view' });
  }

  static #onToggleTimeFlow(event, target) {
    TimeKeeper.toggle();
  }

  static #onOpenCalendar(event, target) {
    new CalendarApplication().render(true);
  }

  static async #onToggleLock(event, target) {
    const newLocked = !this.isLocked;
    await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_LOCKED, newLocked);

    // Update UI
    const bar = this.element.querySelector('.calendaria-hud-bar');
    bar?.classList.toggle('locked', newLocked);

    const icon = target.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-lock', newLocked);
      icon.classList.toggle('fa-lock-open', !newLocked);
    }

    target.dataset.tooltip = newLocked
      ? localize('CALENDARIA.HUD.UnlockPosition')
      : localize('CALENDARIA.HUD.LockPosition');
  }

  static #onOpenSettings(event, target) {
    game.settings.sheet.render(true, { activeCategory: MODULE.ID });
  }

  static async #onOpenWeatherPicker(event, target) {
    if (!game.user.isGM) return;
    const { openWeatherPicker } = await import('../weather/weather-picker.mjs');
    await openWeatherPicker();
  }

  static async #onToSunrise(event, target) {
    const calendar = this.calendar;
    if (!calendar?.sunrise) return;
    const targetHour = calendar.sunrise();
    if (targetHour !== null) await this.#advanceToHour(targetHour);
  }

  static async #onToMidday(event, target) {
    const calendar = this.calendar;
    const targetHour = calendar?.solarMidday?.() ?? (game.time.calendar?.days?.hoursPerDay ?? 24) / 2;
    await this.#advanceToHour(targetHour);
  }

  static async #onToSunset(event, target) {
    const calendar = this.calendar;
    if (!calendar?.sunset) return;
    const targetHour = calendar.sunset();
    if (targetHour !== null) await this.#advanceToHour(targetHour);
  }

  static async #onToMidnight(event, target) {
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

  static #onReverse(event, target) {
    TimeKeeper.reverse();
  }

  static #onReverse5x(event, target) {
    TimeKeeper.reverse(5);
  }

  static #onForward(event, target) {
    TimeKeeper.forward();
  }

  static #onForward5x(event, target) {
    TimeKeeper.forward(5);
  }

  /* -------------------------------------------- */
  /*  Static Methods                              */
  /* -------------------------------------------- */

  /**
   * Show the HUD.
   * @returns {CalendariaHUD}
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
    await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_POSITION, null);
    if (foundry.applications.instances.get('calendaria-hud')?.rendered) {
      this.hide();
      this.show();
    }
  }
}
