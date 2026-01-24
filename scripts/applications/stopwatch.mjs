/**
 * Stopwatch Application - Timer with real-time and game-time modes.
 * Tracks elapsed time with lap functionality and configurable notifications.
 * @module Applications/Stopwatch
 * @author Tyler
 */

import { HOOKS, MODULE, SETTINGS, TEMPLATES } from '../constants.mjs';
import TimeClock from '../time/time-clock.mjs';
import { DEFAULT_FORMAT_PRESETS, formatDuration, formatGameDuration, getDisplayFormat } from '../utils/format-utils.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import * as StickyZones from '../utils/sticky-zones.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Stopwatch HUD for tracking elapsed time.
 */
export class Stopwatch extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {boolean} Whether the stopwatch is running */
  #running = false;

  /** @type {number} Elapsed milliseconds (real-time mode) */
  #elapsedMs = 0;

  /** @type {number} Elapsed game seconds (game-time mode) */
  #elapsedGameSeconds = 0;

  /** @type {number|null} Start timestamp for real-time mode */
  #startTime = null;

  /** @type {number|null} Start world time for game-time mode */
  #startWorldTime = null;

  /** @type {number|null} Animation frame ID for real-time updates */
  #intervalId = null;

  /** @type {number|null} Hook ID for updateWorldTime */
  #timeHookId = null;

  /** @type {Array<{elapsed: number, label: string}>} Recorded lap times */
  #laps = [];

  /** @type {string} Current mode: 'realtime' or 'gametime' */
  #mode = 'gametime';

  /** @type {object|null} Active sticky zone during drag */
  #activeSnapZone = null;

  /** @type {string|null} ID of zone stopwatch is snapped to */
  #snappedZoneId = null;

  /** @type {object|null} Notification settings */
  #notification = null;

  /** @type {number|null} Notification threshold in ms/seconds */
  #notificationThreshold = null;

  /** @type {boolean} Whether notification has fired */
  #notificationFired = false;

  /** @param {object} options - Application options */
  constructor(options = {}) {
    super(options);
    this.#restoreStateSync();
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-stopwatch',
    classes: ['calendaria', 'stopwatch'],
    position: { width: 'auto', height: 'auto', zIndex: 100 },
    window: { frame: false, positioned: true },
    actions: {
      start: Stopwatch.#onStart,
      pause: Stopwatch.#onPause,
      reset: Stopwatch.#onReset,
      lap: Stopwatch.#onLap,
      toggleMode: Stopwatch.#onToggleMode,
      clearLaps: Stopwatch.#onClearLaps,
      openNotification: Stopwatch.#onOpenNotification
    }
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.STOPWATCH } };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.running = this.#running;
    context.mode = this.#mode;
    context.modeLabel = this.#mode === 'realtime' ? localize('CALENDARIA.Stopwatch.RealTime') : localize('CALENDARIA.Stopwatch.GameTime');
    context.elapsed = this.#getDisplayTime();
    context.laps = this.#laps.map((lap, i) => ({ index: i + 1, elapsed: this.#formatLapTime(lap.elapsed), label: lap.label }));
    context.hasLaps = this.#laps.length > 0;
    context.hasNotification = this.#notificationThreshold !== null;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (options.isFirstRender) {
      this.#restoreState();
      this.#restorePosition();
    }

    this.#enableDragging();
    this.#enableResizing();
    this.#setupContextMenu();
    this.#updateDialHands();

    if (this.#running) {
      if (this.#mode === 'realtime') this.#startRealTimeInterval();
      else this.#registerTimeHook();
    }
  }

  /** @override */
  async close(options = {}) {
    return super.close({ animate: false, ...options });
  }

  /** @override */
  _onClose(options) {
    this.#saveState();
    this.#stopRealTimeInterval();
    this.#unregisterTimeHook();
    StickyZones.unregisterFromZoneUpdates(this);
    StickyZones.unpinFromZone(this.element);
    StickyZones.cleanupSnapIndicator();
    super._onClose(options);
  }

  /**
   * Get the current format setting based on mode.
   * @returns {string} Format string
   * @private
   */
  #getFormat() {
    const locationId = this.#mode === 'realtime' ? 'stopwatchRealtime' : 'stopwatchGametime';
    const defaultFormat = this.#mode === 'realtime' ? 'stopwatchRealtimeFull' : 'stopwatchGametimeFull';
    const formatSetting = getDisplayFormat(locationId) || defaultFormat;
    // Resolve preset name to format string, or use as custom format string
    return DEFAULT_FORMAT_PRESETS[formatSetting] || formatSetting;
  }

  /**
   * Get formatted display time based on current mode.
   * @returns {string} Formatted elapsed time
   * @private
   */
  #getDisplayTime() {
    const format = this.#getFormat();
    if (this.#mode === 'realtime') {
      let total = this.#elapsedMs;
      if (this.#running && this.#startTime) total += Date.now() - this.#startTime;
      return formatDuration(total, format);
    }

    let total = this.#elapsedGameSeconds;
    if (this.#running && this.#startWorldTime !== null) total += game.time.worldTime - this.#startWorldTime;
    return formatGameDuration(total, game.time?.calendar, format);
  }

  /**
   * Format lap time based on current mode.
   * @param {number} elapsed - Elapsed time
   * @returns {string} Formatted lap time
   * @private
   */
  #formatLapTime(elapsed) {
    const format = this.#getFormat();
    if (this.#mode === 'realtime') return formatDuration(elapsed, format);
    return formatGameDuration(elapsed, game.time?.calendar, format);
  }

  /**
   * Get current total elapsed time.
   * @returns {number} Total elapsed (ms for realtime, seconds for gametime)
   * @private
   */
  #getCurrentElapsed() {
    if (this.#mode === 'realtime') {
      let total = this.#elapsedMs;
      if (this.#running && this.#startTime) total += Date.now() - this.#startTime;
      return total;
    }

    let total = this.#elapsedGameSeconds;
    if (this.#running && this.#startWorldTime !== null) total += game.time.worldTime - this.#startWorldTime;
    return total;
  }

  /** Start the stopwatch. */
  static #onStart() {
    this.#running = true;
    if (this.#mode === 'realtime') {
      this.#startTime = Date.now();
      this.#startRealTimeInterval();
    } else {
      this.#startWorldTime = game.time.worldTime;
      this.#registerTimeHook();
      if (game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_AUTO_START_TIME)) TimeClock.start();
    }
    this.#notificationFired = false;
    this.#saveState();
    this.render();
    Hooks.callAll(HOOKS.STOPWATCH_START, { mode: this.#mode });
  }

  /** Pause the stopwatch. */
  static #onPause() {
    if (this.#mode === 'realtime') {
      if (this.#startTime) this.#elapsedMs += Date.now() - this.#startTime;
      this.#startTime = null;
      this.#stopRealTimeInterval();
    } else {
      if (this.#startWorldTime !== null) this.#elapsedGameSeconds += game.time.worldTime - this.#startWorldTime;
      this.#startWorldTime = null;
      this.#unregisterTimeHook();
    }
    this.#running = false;
    this.#saveState();
    this.render();
    Hooks.callAll(HOOKS.STOPWATCH_PAUSE, { mode: this.#mode, elapsed: this.#getCurrentElapsed() });
  }

  /** Reset the stopwatch. */
  static #onReset() {
    this.#stopRealTimeInterval();
    this.#unregisterTimeHook();
    this.#running = false;
    this.#elapsedMs = 0;
    this.#elapsedGameSeconds = 0;
    this.#startTime = null;
    this.#startWorldTime = null;
    this.#laps = [];
    this.#notificationFired = false;
    this.#saveState();
    this.render();
    Hooks.callAll(HOOKS.STOPWATCH_RESET, { mode: this.#mode });
  }

  /** Record a lap time. */
  static #onLap() {
    if (!this.#running) return;
    const elapsed = this.#getCurrentElapsed();
    this.#laps.push({ elapsed, label: `${localize('CALENDARIA.Stopwatch.Lap')} ${this.#laps.length + 1}` });
    this.#saveState();
    this.render();
    Hooks.callAll(HOOKS.STOPWATCH_LAP, { mode: this.#mode, lap: this.#laps.length, elapsed });
  }

  /** Toggle between real-time and game-time modes. */
  static #onToggleMode() {
    if (this.#running) {
      if (this.#mode === 'realtime') {
        if (this.#startTime) this.#elapsedMs += Date.now() - this.#startTime;
        this.#stopRealTimeInterval();
      } else {
        if (this.#startWorldTime !== null) this.#elapsedGameSeconds += game.time.worldTime - this.#startWorldTime;
        this.#unregisterTimeHook();
      }
    }

    this.#mode = this.#mode === 'realtime' ? 'gametime' : 'realtime';
    this.#elapsedMs = 0;
    this.#elapsedGameSeconds = 0;
    this.#startTime = null;
    this.#startWorldTime = null;
    this.#running = false;
    this.#laps = [];
    this.#notificationFired = false;
    this.#saveState();
    this.render();
  }

  /** Clear all lap times. */
  static #onClearLaps() {
    this.#laps = [];
    this.#saveState();
    this.render();
  }

  /** Open notification configuration dialog. */
  static async #onOpenNotification() {
    const currentSound = this.#notification?.sound || 'sounds/notify.wav';
    const content = `
      <form class="stopwatch-notification-form">
        <div class="form-group">
          <label>${localize('CALENDARIA.Stopwatch.NotificationThreshold')}</label>
          <input type="number" name="threshold" value="${this.#notificationThreshold ?? ''}" min="1" placeholder="${localize('CALENDARIA.Stopwatch.ThresholdPlaceholder')}" />
          <p class="hint">${this.#mode === 'realtime' ? localize('CALENDARIA.Stopwatch.ThresholdHintRealtime') : localize('CALENDARIA.Stopwatch.ThresholdHintGametime')}</p>
        </div>
        <div class="form-group">
          <label>${localize('CALENDARIA.Stopwatch.NotificationType')}</label>
          <select name="type">
            <option value="toast" ${this.#notification?.type === 'toast' ? 'selected' : ''}>${localize('CALENDARIA.Stopwatch.NotificationToast')}</option>
            <option value="sound" ${this.#notification?.type === 'sound' ? 'selected' : ''}>${localize('CALENDARIA.Stopwatch.NotificationSound')}</option>
            <option value="both" ${this.#notification?.type === 'both' ? 'selected' : ''}>${localize('CALENDARIA.Stopwatch.NotificationBoth')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${localize('CALENDARIA.Stopwatch.NotificationSoundFile')}</label>
          <div class="form-fields">
            <input type="text" name="sound" value="${currentSound}" placeholder="sounds/notify.wav" />
            <button type="button" class="file-picker" data-type="audio" data-target="sound" data-tooltip="${localize('FILES.BrowseTooltip')}">
              <i class="fas fa-file-audio"></i>
            </button>
          </div>
        </div>
      </form>
    `;

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: localize('CALENDARIA.Stopwatch.ConfigureNotification'), icon: 'fas fa-bell' },
      content,
      render: (_event, dialog) => {
        const form = dialog.element.querySelector('form');
        const filePickerBtn = form.querySelector('.file-picker');
        filePickerBtn?.addEventListener('click', async () => {
          const fp = new foundry.applications.apps.FilePicker({
            type: 'audio',
            current: form.sound.value || 'sounds/',
            callback: (path) => {
              form.sound.value = path;
            }
          });
          fp.browse();
        });
      },
      buttons: [
        {
          action: 'save',
          label: localize('CALENDARIA.Common.Save'),
          icon: 'fas fa-save',
          callback: (_event, _button, dialog) => {
            const form = dialog.element.querySelector('form');
            const threshold = parseInt(form.threshold.value) || null;
            const type = form.type.value;
            const sound = form.sound.value || 'sounds/notify.wav';
            return { threshold, type, sound };
          }
        },
        {
          action: 'clear',
          label: localize('CALENDARIA.Stopwatch.ClearNotification'),
          icon: 'fas fa-times',
          callback: () => ({ threshold: null, type: null, sound: null })
        }
      ],
      rejectClose: false
    });

    if (result) {
      this.#notificationThreshold = result.threshold;
      this.#notification = result.threshold ? { type: result.type, sound: result.sound } : null;
      this.#notificationFired = false;
      this.#saveState();
      this.render();
    }
  }

  /** Start the real-time update loop using requestAnimationFrame. */
  #startRealTimeInterval() {
    if (this.#intervalId) return;
    const update = () => {
      if (!this.#running || this.#mode !== 'realtime') return;
      this.#updateDisplay();
      this.#checkNotification();
      this.#intervalId = requestAnimationFrame(update);
    };
    this.#intervalId = requestAnimationFrame(update);
  }

  /** Stop the real-time update loop. */
  #stopRealTimeInterval() {
    if (this.#intervalId) {
      cancelAnimationFrame(this.#intervalId);
      this.#intervalId = null;
    }
  }

  /** Update the display without full re-render. */
  #updateDisplay() {
    if (!this.rendered) return;
    const timeEl = this.element.querySelector('.stopwatch-time');
    if (timeEl) timeEl.textContent = this.#getDisplayTime();
    this.#updateDialHands();
  }

  /** Update the rotation of dial hands based on elapsed time. */
  #updateDialHands() {
    const secondHand = this.element.querySelector('.second-hand');
    const minuteHand = this.element.querySelector('.minute-hand');
    if (!secondHand || !minuteHand) return;

    let totalSeconds;
    if (this.#mode === 'realtime') {
      let totalMs = this.#elapsedMs;
      if (this.#running && this.#startTime) totalMs += Date.now() - this.#startTime;
      totalSeconds = totalMs / 1000;
    } else {
      totalSeconds = this.#elapsedGameSeconds;
      if (this.#running && this.#startWorldTime !== null) {
        totalSeconds += game.time.worldTime - this.#startWorldTime;
      }
    }

    const secondDegrees = ((totalSeconds % 60) / 60) * 360;
    const minuteDegrees = (((totalSeconds / 60) % 60) / 60) * 360;
    secondHand.style.transform = `rotate(${secondDegrees}deg)`;
    minuteHand.style.transform = `rotate(${minuteDegrees}deg)`;
  }

  /** Register hook for world time updates. */
  #registerTimeHook() {
    if (this.#timeHookId) return;
    this.#timeHookId = Hooks.on('updateWorldTime', this.#onUpdateWorldTime.bind(this));
  }

  /** Unregister world time hook. */
  #unregisterTimeHook() {
    if (this.#timeHookId) {
      Hooks.off('updateWorldTime', this.#timeHookId);
      this.#timeHookId = null;
    }
  }

  /** Handle world time updates. */
  #onUpdateWorldTime() {
    if (!this.#running || this.#mode !== 'gametime') return;
    this.#updateDisplay();
    this.#checkNotification();
  }

  /** Check if notification threshold has been reached. */
  #checkNotification() {
    if (!this.#notificationThreshold || this.#notificationFired) return;
    const elapsed = this.#getCurrentElapsed();
    const threshold = this.#mode === 'realtime' ? this.#notificationThreshold * 1000 : this.#notificationThreshold;
    if (elapsed >= threshold) {
      this.#fireNotification();
      this.#notificationFired = true;
    }
  }

  /** Fire the configured notification. */
  #fireNotification() {
    const type = this.#notification?.type || 'toast';
    const sound = this.#notification?.sound || 'sounds/notify.wav';
    const message = localize('CALENDARIA.Stopwatch.NotificationMessage');
    if (type === 'toast' || type === 'both') ui.notifications.info(`<i class="fas fa-stopwatch"></i> ${message}`);
    if (type === 'sound' || type === 'both') foundry.audio.AudioHelper.play({ src: sound, volume: 1, autoplay: true });
  }

  /** Save stopwatch state to client settings. */
  #saveState() {
    const state = {
      running: this.#running,
      mode: this.#mode,
      elapsedMs: this.#elapsedMs,
      elapsedGameSeconds: this.#elapsedGameSeconds,
      savedAt: Date.now(),
      savedWorldTime: game.time?.worldTime ?? 0,
      laps: this.#laps,
      notification: this.#notification,
      notificationThreshold: this.#notificationThreshold,
      notificationFired: this.#notificationFired
    };
    game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_STATE, state);
  }

  /**
   * Restore state synchronously in constructor (for template context).
   * Only restores fields needed for initial render.
   */
  #restoreStateSync() {
    const state = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STATE);
    if (!state) return;

    this.#mode = state.mode || 'gametime';
    this.#running = state.running || false;
    this.#laps = state.laps || [];
    this.#notification = state.notification || null;
    this.#notificationThreshold = state.notificationThreshold ?? null;
    this.#notificationFired = state.notificationFired || false;
    this.#elapsedMs = state.elapsedMs || 0;
    this.#elapsedGameSeconds = state.elapsedGameSeconds || 0;
  }

  /** Restore stopwatch state from settings and resume timers. */
  #restoreState() {
    const state = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STATE);
    if (!state?.running) return;

    if (this.#mode === 'realtime' && state.savedAt) {
      // Add time elapsed since save
      this.#elapsedMs += Date.now() - state.savedAt;
      this.#startTime = Date.now();
      this.#startRealTimeInterval();
    } else if (this.#mode === 'gametime' && state.savedWorldTime !== undefined) {
      // Add game time elapsed since save
      this.#elapsedGameSeconds += game.time.worldTime - state.savedWorldTime;
      this.#startWorldTime = game.time.worldTime;
      this.#registerTimeHook();
    }
  }

  /** Restore saved position and size. */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_POSITION);
    if (savedPos) {
      if (savedPos.size) this.#setSize(savedPos.size);
      if (typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
        this.#snappedZoneId = savedPos.zoneId || null;
        if (this.#snappedZoneId && StickyZones.restorePinnedState(this.element, this.#snappedZoneId)) {
          StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
          return;
        }

        if (this.#snappedZoneId) {
          const rect = this.element.getBoundingClientRect();
          const zonePos = StickyZones.getRestorePosition(this.#snappedZoneId, rect.width, rect.height);
          if (zonePos) {
            this.setPosition({ left: zonePos.left, top: zonePos.top });
            StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
            return;
          }
        }

        this.setPosition({ left: savedPos.left, top: savedPos.top });
      }
    } else {
      this.setPosition({ left: 150, top: 150 });
    }
    this.#clampToViewport();
  }

  /** Clamp position to viewport. */
  #clampToViewport() {
    const rect = this.element.getBoundingClientRect();
    const rightBuffer = StickyZones.getSidebarBuffer();
    let { left, top } = this.position;
    left = Math.max(0, Math.min(left, window.innerWidth - rect.width - rightBuffer));
    top = Math.max(0, Math.min(top, window.innerHeight - rect.height));
    this.setPosition({ left, top });
  }

  /**
   * Set the stopwatch size via CSS variable.
   * @param {number} size - Size in pixels
   */
  #setSize(size) {
    const clamped = Math.max(100, Math.min(400, size));
    this.element.style.setProperty('--stopwatch-size', `${clamped}px`);
  }

  /**
   * Get current size.
   * @returns {number} Current size in pixels
   */
  #getSize() {
    const computed = getComputedStyle(this.element).getPropertyValue('--stopwatch-size');
    return parseInt(computed) || 140;
  }

  /** Enable dragging for move. */
  #enableDragging() {
    const dragHandle = this.element.querySelector('.stopwatch-face');
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
      if (event.target.closest('.stopwatch-btn')) return;
      event.preventDefault();
      isDragging = true;
      previousZoneId = this.#snappedZoneId;
      if (previousZoneId && StickyZones.usesDomParenting(previousZoneId)) {
        const preserved = StickyZones.unpinFromZone(this.element);
        if (preserved) {
          elementStartLeft = preserved.left;
          elementStartTop = preserved.top;
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

  /** Enable resize handle. */
  #enableResizing() {
    const handle = this.element.querySelector('.stopwatch-resize-handle');
    if (!handle) return;
    let startX = 0;
    let startY = 0;
    let startSize = 0;
    const onMouseMove = (event) => {
      event.preventDefault();
      const deltaX = event.clientX - startX;
      const deltaY = startY - event.clientY;
      const delta = Math.max(deltaX, deltaY);
      const newSize = startSize + delta;
      this.#setSize(newSize);
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

  /** Save current position and size to settings. */
  async #savePosition() {
    await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_POSITION, { left: this.position.left, top: this.position.top, size: this.#getSize(), zoneId: this.#snappedZoneId });
  }

  /** Setup context menu. */
  #setupContextMenu() {
    const container = this.element.querySelector('.stopwatch-face');
    container?.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#context-menu')) return;
      e.preventDefault();
      document.getElementById('context-menu')?.remove();
      const menu = new foundry.applications.ux.ContextMenu.implementation(this.element, '.stopwatch-face', this.#getContextMenuItems(), { fixed: true, jQuery: false });
      menu._onActivate(e);
    });
  }

  /**
   * Get context menu items for the Stopwatch.
   * @returns {object[]} Array of context menu item configs
   * @private
   */
  #getContextMenuItems() {
    const items = [];
    items.push({
      name: 'CALENDARIA.Stopwatch.ContextMenu.ResetPosition',
      icon: '<i class="fas fa-arrows-to-dot"></i>',
      callback: () => this.resetPosition()
    });
    const stickyStates = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES) || {};
    const isLocked = stickyStates.position ?? false;
    items.push({
      name: isLocked ? 'CALENDARIA.Stopwatch.ContextMenu.UnlockPosition' : 'CALENDARIA.Stopwatch.ContextMenu.LockPosition',
      icon: `<i class="fas fa-${isLocked ? 'unlock' : 'lock'}"></i>`,
      callback: () => this.#toggleStickyPosition()
    });
    items.push({ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => this.close() });
    return items;
  }

  /**
   * Toggle position lock state.
   * @private
   */
  async #toggleStickyPosition() {
    const current = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES) || {};
    const newLocked = !(current.position ?? false);
    await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES, { ...current, position: newLocked });
    ui.notifications.info(newLocked ? 'CALENDARIA.Stopwatch.ContextMenu.PositionLocked' : 'CALENDARIA.Stopwatch.ContextMenu.PositionUnlocked', { localize: true });
  }

  /**
   * Reset position to default and clear any sticky zone.
   */
  async resetPosition() {
    StickyZones.unregisterFromZoneUpdates(this);
    StickyZones.unpinFromZone(this.element);
    this.#snappedZoneId = null;
    this.setPosition({ left: 150, top: 150 });
    await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_POSITION, { left: 150, top: 150, size: 140, zoneId: null });
    ui.notifications.info('CALENDARIA.Stopwatch.ContextMenu.PositionReset', { localize: true });
  }

  /**
   * Get the singleton instance from Foundry's application registry.
   * @returns {Stopwatch|undefined} The instance if it exists
   */
  static get instance() {
    return foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
  }

  /**
   * Show the Stopwatch.
   * @returns {Stopwatch} The instance
   */
  static show() {
    const instance = this.instance ?? new Stopwatch();
    instance.render({ force: true });
    return instance;
  }

  /** Hide the Stopwatch. */
  static hide() {
    this.instance?.close();
  }

  /** Toggle visibility. */
  static toggle() {
    if (this.instance?.rendered) this.hide();
    else this.show();
  }

  /** Start the stopwatch (keybind action). */
  static start() {
    const instance = this.instance?.rendered ? this.instance : this.show();
    if (!instance.#running) Stopwatch.#onStart.call(instance);
  }

  /** Pause the stopwatch (keybind action). */
  static pause() {
    const instance = this.instance;
    if (instance && instance.#running) Stopwatch.#onPause.call(instance);
  }

  /** Toggle start/pause (keybind action). */
  static toggleStartPause() {
    const instance = this.instance?.rendered ? this.instance : this.show();
    if (instance.#running) Stopwatch.#onPause.call(instance);
    else Stopwatch.#onStart.call(instance);
  }

  /** Reset the stopwatch (keybind action). */
  static reset() {
    if (this.instance) Stopwatch.#onReset.call(this.instance);
  }

  /**
   * Restore stopwatch from saved state on world load.
   * Shows and resumes the stopwatch if it was running.
   */
  static restore() {
    const state = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STATE);
    if (!state?.running) return;
    log(3, 'Restoring running stopwatch');
    this.show();
  }
}
