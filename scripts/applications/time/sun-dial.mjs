/**
 * SunDial - Floating AppV2 circular time rotation dial with PixiJS sky scene.
 * @module Applications/SunDial
 * @author Tyler
 */

import CalendarManager from '../../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SETTINGS, SOCKET_TYPES, TEMPLATES } from '../../constants.mjs';
import NoteManager from '../../notes/note-manager.mjs';
import TimeClock from '../../time/time-clock.mjs';
import { formatForLocation } from '../../utils/formatting/format-utils.mjs';
import { getMoonPhasePosition } from '../../utils/formatting/moon-utils.mjs';
import { localize } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';
import { canViewSunDial } from '../../utils/permissions.mjs';
import { CalendariaSocket } from '../../utils/socket.mjs';
import * as StickyZones from '../../utils/ui/sticky-zones.mjs';
import { applyWeatherSkyTint, computeStarAlpha, getSkyColorsRgb } from '../../utils/ui/sky-utils.mjs';
import { getPreset } from '../../weather/data/weather-presets.mjs';
import WeatherManager from '../../weather/weather-manager.mjs';
import { HudSceneRenderer } from '../hud/hud-scene-renderer.mjs';
import { SettingsPanel } from '../settings/settings-panel.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Floating circular dial for adjusting game time with a PixiJS sky scene.
 */
export class SunDial extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {number} Current dial hours */
  #currentHours = 0;

  /** @type {number} Current dial minutes */
  #currentMinutes = 0;

  /** @type {number} World time at open */
  #initialTime = 0;

  /** @type {HudSceneRenderer|null} PixiJS scene renderer */
  #sceneRenderer = null;

  /** @type {Function|null} Bound mouse move handler for cleanup */
  #boundMouseMove = null;

  /** @type {Function|null} Bound mouse up handler for cleanup */
  #boundMouseUp = null;

  /** @type {Function|null} Bound escape handler for cleanup */
  #boundEscape = null;

  /** @type {number|null} Hook ID for weather changes */
  #weatherHookId = null;

  /** @type {number|null} Hook ID for world time updates */
  #timeHookId = null;

  /** @type {number|null} Hook ID for display format changes */
  #formatsHookId = null;

  /** @type {number|null} Hook ID for clock state changes */
  #clockHookId = null;

  /** @type {number} Cumulative unwrapped rotation during a crank-mode drag */
  #cumulativeAngle = 0;

  /** @type {object|null} Active sticky zone during drag */
  #activeSnapZone = null;

  /** @type {string|null} ID of zone the dial is snapped to */
  #snappedZoneId = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-sun-dial',
    classes: ['calendaria', 'sun-dial'],
    position: { width: 'auto', height: 'auto', zIndex: 100 },
    window: { frame: false, positioned: true },
    actions: {
      toggleClock: SunDial.#onToggleClock,
      addNote: SunDial.#onAddNote,
      openSettings: SunDial.#onOpenSettings
    }
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.SUN_DIAL } };

  /**
   * Get the active calendar.
   * @returns {object} The active calendar instance
   */
  get calendar() {
    return CalendarManager.getActiveCalendar();
  }

  /**
   * Show the sun dial (reuses existing instance or creates new).
   * @param {object} [options] - Show options
   * @param {boolean} [options.silent] - If true, don't show permission warning
   */
  static show({ silent = false } = {}) {
    if (!canViewSunDial()) {
      if (!silent) ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return;
    }
    const existing = foundry.applications.instances.get('calendaria-sun-dial');
    if (existing) {
      existing.render({ force: true });
      return;
    }
    new SunDial().render({ force: true });
  }

  /** Hide (close) the sun dial. */
  static hide() {
    foundry.applications.instances.get('calendaria-sun-dial')?.close();
  }

  /** Toggle the sun dial visibility. */
  static toggle() {
    if (foundry.applications.instances.get('calendaria-sun-dial')) SunDial.hide();
    else SunDial.show();
  }

  /** Update the idle opacity CSS variable from settings. */
  static updateIdleOpacity() {
    const autoFade = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_AUTO_FADE);
    const opacity = autoFade ? game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_IDLE_OPACITY) / 100 : 1;
    document.documentElement.style.setProperty('--calendaria-sundial-idle-opacity', opacity);
  }

  /** Apply sticky state to the running instance. */
  static refreshStickyStates() {
    const instance = foundry.applications.instances.get('calendaria-sun-dial');
    if (!instance) return;
    const sticky = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_STICKY_STATES) || {};
    const isLocked = sticky.position ?? false;
    const dragHandle = instance.element?.querySelector('.container');
    if (dragHandle) dragHandle.style.pointerEvents = isLocked ? 'none' : '';
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const components = game.time.components;
    const hours = components.hour ?? 0;
    const minutes = components.minute ?? 0;
    context.currentTime = this.#formatDialTime(hours, minutes);
    context.hourMarkers = this.#generateHourMarkers();
    context.running = TimeClock.running;
    context.clockLocked = game.settings.get(MODULE.ID, SETTINGS.CLOCK_LOCKED);
    return context;
  }

  /** @override */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    if (existing) existing.replaceWith(element);
    else document.body.append(element);
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const components = game.time.components;
    this.#currentHours = components.hour ?? 0;
    this.#currentMinutes = components.minute ?? 0;
    this.#initialTime = game.time.worldTime;

    if (options.isFirstRender) this.#restorePosition();
    this.#enableDragging();
    this.#enableResizing();
    this.#initSceneRenderer();
    this.#setupContextMenu();

    const initialAngle = this.#timeToAngle(this.#currentHours, this.#currentMinutes);
    this.#updateDialRotation(initialAngle);
    this.#updateSceneForHour({ hours: this.#currentHours, minutes: this.#currentMinutes });
    this.#setupDialInteraction();
    SunDial.refreshStickyStates();

    this.#boundEscape = (e) => {
      if (e.key === 'Escape') this.close();
    };
    window.addEventListener('keydown', this.#boundEscape);

    if (!this.#weatherHookId) {
      this.#weatherHookId = Hooks.on(HOOKS.WEATHER_CHANGE, () => this.#refreshWeatherEffect());
    }
    if (!this.#timeHookId) {
      this.#timeHookId = Hooks.on(HOOKS.WORLD_TIME_UPDATED, () => this.#onTimeUpdated());
    }
    if (!this.#formatsHookId) {
      this.#formatsHookId = Hooks.on(HOOKS.DISPLAY_FORMATS_CHANGED, () => this.#onTimeUpdated());
    }
    if (!this.#clockHookId) {
      this.#clockHookId = Hooks.on(HOOKS.CLOCK_START_STOP, () => this.render());
    }
  }

  /** @override */
  _onClose(options) {
    const pos = this.position;
    if (pos.top != null && pos.left != null) {
      game.settings.set(MODULE.ID, SETTINGS.SUN_DIAL_POSITION, { top: pos.top, left: pos.left, size: this.#getSize(), zoneId: this.#snappedZoneId });
    }
    if (this.#sceneRenderer) {
      this.#sceneRenderer.destroy();
      this.#sceneRenderer = null;
    }
    if (this.#weatherHookId) {
      Hooks.off(HOOKS.WEATHER_CHANGE, this.#weatherHookId);
      this.#weatherHookId = null;
    }
    if (this.#timeHookId) {
      Hooks.off(HOOKS.WORLD_TIME_UPDATED, this.#timeHookId);
      this.#timeHookId = null;
    }
    if (this.#formatsHookId) {
      Hooks.off(HOOKS.DISPLAY_FORMATS_CHANGED, this.#formatsHookId);
      this.#formatsHookId = null;
    }
    if (this.#clockHookId) {
      Hooks.off(HOOKS.CLOCK_START_STOP, this.#clockHookId);
      this.#clockHookId = null;
    }
    if (this.#boundMouseMove) window.removeEventListener('mousemove', this.#boundMouseMove);
    if (this.#boundMouseUp) window.removeEventListener('mouseup', this.#boundMouseUp);
    if (this.#boundEscape) window.removeEventListener('keydown', this.#boundEscape);
    this.#boundMouseMove = null;
    this.#boundMouseUp = null;
    this.#boundEscape = null;
    StickyZones.unregisterFromZoneUpdates(this);
    StickyZones.unpinFromZone(this.element);
    StickyZones.cleanupSnapIndicator();
    super._onClose(options);
  }

  /** @override */
  async close(options = {}) {
    if (!game.user.isGM && game.settings.get(MODULE.ID, SETTINGS.FORCE_SUN_DIAL)) {
      ui.notifications.warn('CALENDARIA.Common.ForcedDisplayWarning', { localize: true });
      return;
    }
    return super.close({ animate: false, ...options });
  }

  // ---------------------------------------------------------------------------
  // Scene Renderer
  // ---------------------------------------------------------------------------

  /** Initialize the PixiJS scene renderer on the dial canvas. */
  #initSceneRenderer() {
    const canvas = this.element.querySelector('.scene-canvas');
    if (!canvas) return;
    if (this.#sceneRenderer) {
      this.#sceneRenderer.destroy();
      this.#sceneRenderer = null;
    }
    this.#sceneRenderer = new HudSceneRenderer(canvas, 'dial');
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

  /** Sync dial to current world time when time changes externally. */
  #onTimeUpdated() {
    const components = game.time.components;
    this.#currentHours = components.hour ?? 0;
    this.#currentMinutes = components.minute ?? 0;
    this.#initialTime = game.time.worldTime;
    const angle = this.#timeToAngle(this.#currentHours, this.#currentMinutes);
    this.#updateDialRotation(angle);
  }

  /** Refresh the weather effect on the scene renderer. */
  #refreshWeatherEffect() {
    if (!this.#sceneRenderer) return;
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
    this.#updateSceneForHour({ hours: this.#currentHours, minutes: this.#currentMinutes });
  }

  /**
   * Resolve visual and sky overrides for a preset.
   * @param {object|null} preset - The weather preset object
   * @returns {{hudEffect: string|null, visualOverrides: object|null, skyOverrides: object|null}}
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
   * Update the PixiJS scene to match the given time.
   * @param {{hours: number, minutes: number}} time - Current dial time
   */
  #updateSceneForHour(time) {
    if (!this.#sceneRenderer) return;
    const calendar = this.calendar;
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
    const hour = time.hours + time.minutes / minutesPerHour;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const sunrise = calendar?.sunrise?.(undefined, zone) ?? hoursPerDay / 4;
    const sunset = calendar?.sunset?.(undefined, zone) ?? (hoursPerDay * 3) / 4;
    const skyColors = getSkyColorsRgb(hour, calendar);
    const tintedColors = applyWeatherSkyTint(skyColors);
    const starAlpha = computeStarAlpha(hour, sunrise, sunset);
    const moons = [];
    if (calendar) {
      const moonsArray = calendar.moonsArray;
      const showAll = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_ALL_MOONS);
      const moonList = showAll ? moonsArray : (moonsArray?.slice(0, 1) ?? []);
      const components = game.time.components;
      for (let mi = 0; mi < moonList.length; mi++) {
        const moon = moonList[mi];
        const phase = getMoonPhasePosition(moon, components, calendar);
        moons.push({ phase, color: moon.color || null, name: moon.name || '' });
      }
    }
    this.#sceneRenderer.update({ hour, sunrise, sunset, hoursPerDay, moons, skyColors: tintedColors, starAlpha });
  }

  // ---------------------------------------------------------------------------
  // Hour Markers
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Dial Time Formatting / Conversion
  // ---------------------------------------------------------------------------

  /**
   * Format time for dial display using the sundialTime display format.
   * @param {number} hours - Hour value
   * @param {number} minutes - Minute value
   * @returns {string} Formatted time string
   */
  #formatDialTime(hours, minutes) {
    const calendar = this.calendar;
    if (calendar) {
      const components = { ...game.time.components, hour: hours, minute: minutes };
      const yearZero = calendar.years?.yearZero ?? 0;
      components.year = (components.year ?? 0) + yearZero;
      components.dayOfMonth = components.dayOfMonth ?? 0;
      return formatForLocation(calendar, components, 'sundialTime');
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  /**
   * Convert time to angle in degrees.
   * @param {number} hours - Hour value
   * @param {number} minutes - Minute value
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
   * @returns {{hours: number, minutes: number}} Time object
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

  // ---------------------------------------------------------------------------
  // Dial Rotation
  // ---------------------------------------------------------------------------

  /**
   * Update the dial's visual rotation and PixiJS scene.
   * @param {number} angle - Rotation angle in degrees
   */
  #updateDialRotation(angle) {
    const handleContainer = this.element.querySelector('.handle-container');
    if (!handleContainer) return;
    const time = this.#angleToTime(angle);
    const timeDisplay = this.element.querySelector('.time');
    if (timeDisplay && document.activeElement !== timeDisplay) {
      timeDisplay.value = this.#formatDialTime(time.hours, time.minutes);
    }
    // Update day offset indicator for crank mode
    this.#updateDayOffsetDisplay(time);
    handleContainer.style.transform = `rotate(${angle}deg)`;
    this.#currentHours = time.hours;
    this.#currentMinutes = time.minutes;
    this.#updateSceneForHour(time);
  }

  /**
   * Update the day offset label below the time input during crank drags.
   * @param {{hours: number, minutes: number}} time - Current dial time
   */
  #updateDayOffsetDisplay(time) {
    const label = this.element.querySelector('.day-offset');
    if (!label) return;
    const crankMode = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_CRANK_MODE);
    if (!crankMode || this.#cumulativeAngle === 0) {
      label.textContent = '';
      return;
    }
    const dayOffset = this.#cumulativeAngle >= 0 ? Math.floor(this.#cumulativeAngle / 360) : Math.ceil(this.#cumulativeAngle / 360);
    if (dayOffset === 0) {
      label.textContent = '';
      return;
    }
    const sign = dayOffset > 0 ? '+' : '';
    label.textContent = `${sign}${dayOffset} ${localize('CALENDARIA.SunDial.Days')}`;
  }

  // ---------------------------------------------------------------------------
  // Dial Interaction
  // ---------------------------------------------------------------------------

  /** Setup handle drag and time input interaction. */
  #setupDialInteraction() {
    const sky = this.element.querySelector('.sky');
    const handle = this.element.querySelector('.handle');
    if (!sky || !handle) return;
    let isDragging = false;
    let dragCancelled = false;
    let initialDialAngle = 0;
    let prevMouseAngle = 0;
    let unwrappedMouseAngle = 0;

    const getAngleFromEvent = (event) => {
      const rect = sky.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = event.clientX - centerX;
      const deltaY = event.clientY - centerY;
      return (Math.atan2(deltaY, deltaX) * 180) / Math.PI + 90;
    };

    /** Cancel the current drag and reset dial to world time. */
    const cancelDrag = () => {
      isDragging = false;
      dragCancelled = true;
      handle.style.cursor = 'grab';
      this.#cumulativeAngle = 0;
      unwrappedMouseAngle = 0;
      const components = game.time.components;
      this.#currentHours = components.hour ?? 0;
      this.#currentMinutes = components.minute ?? 0;
      this.#initialTime = game.time.worldTime;
      const angle = this.#timeToAngle(this.#currentHours, this.#currentMinutes);
      this.#updateDialRotation(angle);
    };

    const onMouseDown = (event) => {
      if (event.button !== 0) return;
      isDragging = true;
      dragCancelled = false;
      initialDialAngle = this.#timeToAngle(this.#currentHours, this.#currentMinutes);
      prevMouseAngle = getAngleFromEvent(event);
      unwrappedMouseAngle = 0;
      this.#cumulativeAngle = 0;
      handle.style.cursor = 'grabbing';
      event.preventDefault();
      event.stopPropagation();
    };

    const onMouseMove = (event) => {
      if (!isDragging) return;
      const rawMouseAngle = getAngleFromEvent(event);

      // Accumulate unwrapped mouse delta (handles atan2 ±180 jumps)
      let mouseDelta = rawMouseAngle - prevMouseAngle;
      if (mouseDelta > 180) mouseDelta -= 360;
      else if (mouseDelta < -180) mouseDelta += 360;
      unwrappedMouseAngle += mouseDelta;
      prevMouseAngle = rawMouseAngle;

      // Cumulative angle tracks total rotation from drag start
      this.#cumulativeAngle = unwrappedMouseAngle;

      const newAngle = initialDialAngle + unwrappedMouseAngle;
      this.#updateDialRotation(newAngle);
      event.preventDefault();
    };

    const onMouseUp = async (event) => {
      if (!isDragging || event.button !== 0) return;
      if (dragCancelled) {
        dragCancelled = false;
        return;
      }
      isDragging = false;
      handle.style.cursor = 'grab';
      await this.#applyTimeChange();
      this.#cumulativeAngle = 0;
      const label = this.element.querySelector('.day-offset');
      if (label) label.textContent = '';
      event.preventDefault();
    };

    // Right-click during drag cancels crank accumulation and resets to current time
    const onRightMouseDown = (event) => {
      if (event.button !== 2 || !isDragging) return;
      event.preventDefault();
      event.stopPropagation();
      cancelDrag();
    };

    handle.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousedown', onRightMouseDown, true);
    this.#boundMouseMove = onMouseMove;
    this.#boundMouseUp = onMouseUp;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Time input handlers
    const timeInput = this.element.querySelector('.time');
    if (!timeInput) return;
    const applyTimeFromInput = async () => {
      const parsed = this.#parseTimeInput(timeInput.value);
      if (parsed) {
        this.#currentHours = parsed.hours;
        this.#currentMinutes = parsed.minutes;
        const newAngle = this.#timeToAngle(parsed.hours, parsed.minutes);
        this.#updateDialRotation(newAngle);
        await this.#applyTimeChange();
      } else {
        timeInput.value = this.#formatDialTime(this.#currentHours, this.#currentMinutes);
      }
    };
    timeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        timeInput.blur();
      } else if (event.key === 'Escape') {
        timeInput.value = this.#formatDialTime(this.#currentHours, this.#currentMinutes);
        timeInput.blur();
      }
    });
    timeInput.addEventListener('blur', async () => applyTimeFromInput());
    timeInput.addEventListener('focus', () => timeInput.select());
  }

  // ---------------------------------------------------------------------------
  // Time Input Parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse flexible time input string.
   * @param {string} input - Time input string (e.g., "14:30", "2:30pm")
   * @returns {{hours: number, minutes: number}|null} Parsed time or null
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

  // ---------------------------------------------------------------------------
  // Apply Time Change
  // ---------------------------------------------------------------------------

  /** Apply the current dial time as a world time change. */
  async #applyTimeChange() {
    const cal = game.time.calendar;
    const days = cal?.days ?? {};
    const secondsPerMinute = days.secondsPerMinute ?? 60;
    const minutesPerHour = days.minutesPerHour ?? 60;
    const hoursPerDay = days.hoursPerDay ?? 24;
    const secondsPerHour = secondsPerMinute * minutesPerHour;
    const secondsPerDay = secondsPerHour * hoursPerDay;
    const crankMode = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_CRANK_MODE);
    let timeDiff;

    if (crankMode) {
      // Crank mode: derive time diff from cumulative unwrapped rotation
      timeDiff = Math.round((this.#cumulativeAngle / 360) * secondsPerDay);
    } else {
      // Standard mode: shortest-path within a single day
      const initialComponents = cal?.timeToComponents?.(this.#initialTime) ?? game.time.components;
      const initialHours = initialComponents.hour ?? 0;
      const initialMinutes = initialComponents.minute ?? 0;
      const initialSeconds = initialComponents.second ?? 0;
      const initialDaySeconds = initialHours * secondsPerHour + initialMinutes * secondsPerMinute + initialSeconds;
      const newDaySeconds = this.#currentHours * secondsPerHour + this.#currentMinutes * secondsPerMinute;
      timeDiff = newDaySeconds - initialDaySeconds;
      if (Math.abs(timeDiff) > secondsPerDay / 2) {
        if (timeDiff > 0) timeDiff -= secondsPerDay;
        else timeDiff += secondsPerDay;
      }
    }

    if (timeDiff !== 0) {
      if (!game.user.isGM) {
        CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: timeDiff });
        this.#initialTime = this.#initialTime + timeDiff;
        return;
      }
      await game.time.advance(timeDiff);
      log(3, `Time adjusted by ${timeDiff} seconds to ${this.#formatDialTime(this.#currentHours, this.#currentMinutes)}`);
    }
    this.#initialTime = this.#initialTime + timeDiff;
  }

  // ---------------------------------------------------------------------------
  // Context Menu
  // ---------------------------------------------------------------------------

  /** Set up the right-click context menu on the dial. */
  #setupContextMenu() {
    const container = this.element.querySelector('.container');
    container?.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#context-menu')) return;
      e.preventDefault();
      document.getElementById('context-menu')?.remove();
      const menu = new foundry.applications.ux.ContextMenu.implementation(this.element, '.container', this.#getContextMenuItems(), { fixed: true, jQuery: false });
      menu._onActivate(e);
    });
  }

  /**
   * Get context menu items for the sun dial.
   * @returns {object[]} Array of context menu item configs
   */
  #getContextMenuItems() {
    const items = [];
    // Crank mode toggle
    const crankMode = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_CRANK_MODE);
    items.push({
      name: crankMode ? 'CALENDARIA.SunDial.ContextMenu.DisableCrankMode' : 'CALENDARIA.SunDial.ContextMenu.EnableCrankMode',
      icon: `<i class="fas fa-${crankMode ? 'toggle-on' : 'toggle-off'}"></i>`,
      callback: () => this.#toggleCrankMode()
    });
    // Reset position
    items.push({
      name: 'CALENDARIA.SunDial.ContextMenu.ResetPosition',
      icon: '<i class="fas fa-arrows-to-dot"></i>',
      callback: () => this.resetPosition()
    });
    // Lock/unlock position
    const stickyStates = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_STICKY_STATES) || {};
    const isLocked = stickyStates.position ?? false;
    items.push({
      name: isLocked ? 'CALENDARIA.SunDial.ContextMenu.UnlockPosition' : 'CALENDARIA.SunDial.ContextMenu.LockPosition',
      icon: `<i class="fas fa-${isLocked ? 'unlock' : 'lock'}"></i>`,
      callback: () => this.#toggleStickyPosition()
    });
    // Show/Hide from all players (GM only)
    if (game.user.isGM) {
      const forceSunDial = game.settings.get(MODULE.ID, SETTINGS.FORCE_SUN_DIAL);
      items.push({
        name: forceSunDial ? 'CALENDARIA.SunDial.ContextMenu.HideFromAll' : 'CALENDARIA.SunDial.ContextMenu.ShowToAll',
        icon: `<i class="fas fa-${forceSunDial ? 'eye-slash' : 'eye'}"></i>`,
        callback: async () => {
          const newValue = !forceSunDial;
          await game.settings.set(MODULE.ID, SETTINGS.FORCE_SUN_DIAL, newValue);
          CalendariaSocket.emit(SOCKET_TYPES.SUN_DIAL_VISIBILITY, { visible: newValue });
        }
      });
    }
    // Close
    items.push({ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => this.close() });
    return items;
  }

  /** Toggle crank mode setting. */
  async #toggleCrankMode() {
    const current = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_CRANK_MODE);
    await game.settings.set(MODULE.ID, SETTINGS.SUN_DIAL_CRANK_MODE, !current);
    ui.notifications.info(!current ? 'CALENDARIA.SunDial.ContextMenu.CrankModeEnabled' : 'CALENDARIA.SunDial.ContextMenu.CrankModeDisabled', { localize: true });
  }

  /** Toggle position lock state. */
  async #toggleStickyPosition() {
    const current = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_STICKY_STATES) || {};
    const newLocked = !(current.position ?? false);
    await game.settings.set(MODULE.ID, SETTINGS.SUN_DIAL_STICKY_STATES, { ...current, position: newLocked });
    SunDial.refreshStickyStates();
    ui.notifications.info(newLocked ? 'CALENDARIA.SunDial.ContextMenu.PositionLocked' : 'CALENDARIA.SunDial.ContextMenu.PositionUnlocked', { localize: true });
  }

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  /**
   * Toggle clock running state. Shift-click toggles lock.
   * @param event
   */
  static #onToggleClock(event) {
    if (event.shiftKey) {
      TimeClock.toggleLock();
    } else {
      TimeClock.toggle();
    }
    this.render();
  }

  /** Create a new note for today. */
  static async #onAddNote() {
    const today = game.time.components;
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: today.year + yearZero, month: today.month, dayOfMonth: today.dayOfMonth ?? 0, hour: today.hour ?? 0, minute: today.minute ?? 0 },
        endDate: { year: today.year + yearZero, month: today.month, dayOfMonth: today.dayOfMonth ?? 0, hour: (today.hour ?? 0) + 1, minute: today.minute ?? 0 }
      }
    });
  }

  /** Open the settings panel. */
  static #onOpenSettings() {
    new SettingsPanel().render(true);
  }

  /** Reset position to default center. */
  async resetPosition() {
    StickyZones.unregisterFromZoneUpdates(this);
    StickyZones.unpinFromZone(this.element);
    this.#snappedZoneId = null;
    const w = this.#getSize();
    const h = w;
    const left = Math.round((window.innerWidth - w) / 2);
    const top = Math.round((window.innerHeight - h) / 2);
    this.setPosition({ left, top });
    await game.settings.set(MODULE.ID, SETTINGS.SUN_DIAL_POSITION, { left, top, size: w, zoneId: null });
    ui.notifications.info('CALENDARIA.SunDial.ContextMenu.PositionReset', { localize: true });
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  /** Set up mouse-based resizing via the resize handle. */
  #enableResizing() {
    const handle = this.element.querySelector('.resize-handle');
    if (!handle) return;
    let startX = 0;
    let startY = 0;
    let startSize = 0;
    const onMouseMove = (event) => {
      event.preventDefault();
      const delta = event.clientX - startX;
      this.#setSize(startSize + delta);
    };
    const onMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      await this.#savePosition();
    };
    handle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      startX = event.clientX;
      startY = event.clientY;
      startSize = this.#getSize();
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * Set the dial size via CSS variable.
   * @param {number} size - Size in pixels
   */
  #setSize(size) {
    const clamped = Math.max(150, Math.min(500, size));
    this.element.style.setProperty('--dial-size', `${clamped}px`);
  }

  /**
   * Get current dial size.
   * @returns {number} Current size in pixels
   */
  #getSize() {
    const computed = getComputedStyle(this.element).getPropertyValue('--dial-size');
    return parseInt(computed) || 300;
  }

  // ---------------------------------------------------------------------------
  // Position Persistence
  // ---------------------------------------------------------------------------

  /** Save current position and size to settings. */
  async #savePosition() {
    await game.settings.set(MODULE.ID, SETTINGS.SUN_DIAL_POSITION, { left: this.position.left, top: this.position.top, size: this.#getSize(), zoneId: this.#snappedZoneId });
  }

  /** Restore saved position from settings. */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_POSITION);
    if (savedPos?.size) this.#setSize(savedPos.size);
    const w = this.#getSize();
    const h = w;
    if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
      this.#snappedZoneId = savedPos.zoneId || null;
      if (this.#snappedZoneId && StickyZones.restorePinnedState(this.element, this.#snappedZoneId)) {
        StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
        return;
      }
      if (this.#snappedZoneId) {
        const zonePos = StickyZones.getRestorePosition(this.#snappedZoneId, w, h);
        if (zonePos) {
          this.setPosition({ left: zonePos.left, top: zonePos.top });
          StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
          return;
        }
      }
      this.setPosition({ left: savedPos.left, top: savedPos.top });
    } else {
      const left = Math.round((window.innerWidth - w) / 2);
      const top = Math.round((window.innerHeight - h) / 2);
      this.setPosition({ left, top });
    }
    this.#clampToViewport(w, h);
  }

  /**
   * Clamp position to viewport bounds.
   * @param {number} [w] - Known element width
   * @param {number} [h] - Known element height
   */
  #clampToViewport(w, h) {
    if (!w || !h) {
      const rect = this.element.getBoundingClientRect();
      w = rect.width || 300;
      h = rect.height || 300;
    }
    const rightBuffer = StickyZones.getSidebarBuffer();
    let { left, top } = this.position;
    left = Math.max(0, Math.min(left, window.innerWidth - w - rightBuffer));
    top = Math.max(0, Math.min(top, window.innerHeight - h));
    this.setPosition({ left, top });
  }

  /** Enable window-level dragging on the container element. */
  #enableDragging() {
    const dragHandle = this.element.querySelector('.container');
    if (!dragHandle) return;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartLeft = 0;
    let elementStartTop = 0;
    let previousZoneId = null;

    const onMouseMove = (event) => {
      if (!isDragging) return;
      event.preventDefault();
      const deltaX = event.clientX - dragStartX;
      const deltaY = event.clientY - dragStartY;
      const rect = this.element.getBoundingClientRect();
      const rightBuffer = StickyZones.getSidebarBuffer();
      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width - rightBuffer));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      this.setPosition({ left: newLeft, top: newTop });
      this.#activeSnapZone = StickyZones.checkStickyZones(dragHandle, newLeft, newTop, rect.width, rect.height);
    };

    const onMouseUp = async (event) => {
      if (!isDragging) return;
      isDragging = false;
      event.preventDefault();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const rect = this.element.getBoundingClientRect();
      const result = StickyZones.finalizeDrag(dragHandle, this.#activeSnapZone, this, rect.width, rect.height, previousZoneId);
      this.#snappedZoneId = result.zoneId;
      StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
      this.#activeSnapZone = null;
      previousZoneId = null;
      await this.#savePosition();
    };

    dragHandle.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('.handle') || event.target.closest('.time') || event.target.closest('.resize-handle')) return;
      event.preventDefault();
      isDragging = true;
      previousZoneId = this.#snappedZoneId;
      if (previousZoneId && StickyZones.usesDomParenting(previousZoneId)) {
        const preserved = StickyZones.unpinFromZone(this.element);
        if (preserved) {
          elementStartLeft = preserved.left;
          elementStartTop = preserved.top;
          this.setPosition({ left: preserved.left, top: preserved.top });
        }
      } else {
        const rect = this.element.getBoundingClientRect();
        elementStartLeft = rect.left;
        elementStartTop = rect.top;
      }
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }
}
