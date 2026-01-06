/**
 * TimeKeeper HUD - Compact time control interface.
 * Provides forward/reverse buttons, increment selector, and current time display.
 * @module Applications/TimeKeeperHUD
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SETTINGS, TEMPLATES } from '../constants.mjs';
import TimeKeeper, { getTimeIncrements } from '../time/time-keeper.mjs';
import { formatForLocation, getDisplayFormat } from '../utils/format-utils.mjs';
import { localize } from '../utils/localization.mjs';
import * as StickyZones from '../utils/sticky-zones.mjs';
import { SettingsPanel } from './settings/settings-panel.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Compact HUD for controlling game time.
 */
export class TimeKeeperHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {number|null} Hook ID for updateWorldTime */
  #timeHookId = null;

  /** @type {number|null} Hook ID for clock state changes */
  #clockHookId = null;

  /** @type {object|null} Currently active sticky zone during drag */
  #activeSnapZone = null;

  /** @type {string|null} ID of zone HUD is currently snapped to */
  #snappedZoneId = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'time-keeper-hud',
    classes: ['calendaria', 'time-keeper-hud'],
    position: { width: 200, height: 'auto', zIndex: 100 },
    window: { frame: false, positioned: true },
    actions: { dec2: TimeKeeperHUD.#onDec2, dec1: TimeKeeperHUD.#onDec1, inc1: TimeKeeperHUD.#onInc1, inc2: TimeKeeperHUD.#onInc2, toggle: TimeKeeperHUD.#onToggle }
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.TIME_KEEPER_HUD } };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = game.time?.calendar;
    const isMonthless = calendar?.isMonthless ?? false;
    context.increments = Object.entries(getTimeIncrements())
      .filter(([key]) => !isMonthless || key !== 'month')
      .map(([key, seconds]) => ({ key, label: this.#formatIncrementLabel(key), seconds, selected: key === TimeKeeper.incrementKey }));
    context.running = TimeKeeper.running;
    context.isGM = game.user.isGM;
    context.currentTime = this.#formatTime();
    context.currentDate = this.#formatDate();
    const dateFormat = getDisplayFormat('timekeeperDate');
    context.showDate = dateFormat !== 'off';
    const tooltips = this.#getJumpTooltips();
    context.dec2Tooltip = tooltips.dec2Tooltip;
    context.dec1Tooltip = tooltips.dec1Tooltip;
    context.inc1Tooltip = tooltips.inc1Tooltip;
    context.inc2Tooltip = tooltips.inc2Tooltip;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (options.isFirstRender) this.#restorePosition();
    this.#enableDragging();
    this.element.querySelector('[data-action="increment"]')?.addEventListener('change', (e) => {
      TimeKeeper.setIncrement(e.target.value);
      this.#updateJumpTooltips();
    });

    if (!this.#clockHookId) this.#clockHookId = Hooks.on(HOOKS.CLOCK_START_STOP, this.#onClockStateChange.bind(this));
    if (!this.#timeHookId) this.#timeHookId = Hooks.on('updateWorldTime', this.#onUpdateWorldTime.bind(this));
    new foundry.applications.ux.ContextMenu.implementation(
      this.element,
      '.time-keeper-content',
      [
        { name: 'CALENDARIA.Common.Settings', icon: '<i class="fas fa-cog"></i>', callback: () => new SettingsPanel().render(true) },
        { name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => TimeKeeperHUD.hide() }
      ],
      { fixed: true, jQuery: false }
    );
  }

  /**
   * Restore saved position from settings.
   * @private
   */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.TIME_KEEPER_POSITION);
    if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
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
    } else {
      this.setPosition({ left: 120, top: 120 });
    }
    this.#clampToViewport();
  }

  /**
   * Clamp position to viewport bounds.
   * @private
   */
  #clampToViewport() {
    const rect = this.element.getBoundingClientRect();
    let { left, top } = this.position;
    left = Math.max(0, Math.min(left, window.innerWidth - rect.width));
    top = Math.max(0, Math.min(top, window.innerHeight - rect.height));
    this.setPosition({ left, top });
  }

  /**
   * Enable dragging on the time display.
   * @private
   */
  #enableDragging() {
    const dragHandle = this.element.querySelector('.time-display');
    if (!dragHandle) return;
    const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, dragHandle, false);
    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartLeft = 0;
    let elementStartTop = 0;
    let previousZoneId = null;
    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      previousZoneId = this.#snappedZoneId;
      const rect = this.element.getBoundingClientRect();
      elementStartLeft = rect.left;
      elementStartTop = rect.top;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
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
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      this.setPosition({ left: newLeft, top: newTop });
      this.#activeSnapZone = StickyZones.checkStickyZones(dragHandle, newLeft, newTop, rect.width, rect.height);
    };

    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);
      const rect = this.element.getBoundingClientRect();
      const result = StickyZones.finalizeDrag(dragHandle, this.#activeSnapZone, this, rect.width, rect.height, previousZoneId);
      this.#snappedZoneId = result.zoneId;
      StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
      this.#activeSnapZone = null;
      previousZoneId = null;
      await game.settings.set(MODULE.ID, SETTINGS.TIME_KEEPER_POSITION, { left: this.position.left, top: this.position.top, zoneId: this.#snappedZoneId });
    };
  }

  /** @override */
  _onClose(options) {
    const pos = this.position;
    if (pos.top != null && pos.left != null) game.settings.set(MODULE.ID, SETTINGS.TIME_KEEPER_POSITION, { top: pos.top, left: pos.left, zoneId: this.#snappedZoneId });
    StickyZones.unregisterFromZoneUpdates(this);
    StickyZones.unpinFromZone(this.element);
    StickyZones.cleanupSnapIndicator();
    super._onClose(options);
    if (this.#timeHookId) {
      Hooks.off('updateWorldTime', this.#timeHookId);
      this.#timeHookId = null;
    }
    if (this.#clockHookId) {
      Hooks.off(HOOKS.CLOCK_START_STOP, this.#clockHookId);
      this.#clockHookId = null;
    }
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /** Decrement time by configured dec2 amount. */
  static #onDec2() {
    const jumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const currentJumps = jumps[TimeKeeper.incrementKey] || { dec2: -5 };
    const amount = currentJumps.dec2 || -5;
    TimeKeeper.forward(amount);
  }

  /** Decrement time by configured dec1 amount. */
  static #onDec1() {
    const jumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const currentJumps = jumps[TimeKeeper.incrementKey] || { dec1: -1 };
    const amount = currentJumps.dec1 || -1;
    TimeKeeper.forward(amount);
  }

  /** Increment time by configured inc1 amount. */
  static #onInc1() {
    const jumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const currentJumps = jumps[TimeKeeper.incrementKey] || { inc1: 1 };
    const amount = currentJumps.inc1 || 1;
    TimeKeeper.forward(amount);
  }

  /** Increment time by configured inc2 amount. */
  static #onInc2() {
    const jumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const currentJumps = jumps[TimeKeeper.incrementKey] || { inc2: 5 };
    const amount = currentJumps.inc2 || 5;
    TimeKeeper.forward(amount);
  }

  /** Toggle clock running state. */
  static #onToggle() {
    TimeKeeper.toggle();
    this.render();
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle clock state changes.
   * @private
   */
  #onClockStateChange() {
    this.render();
  }

  /**
   * Handle world time updates - update clock display without full re-render.
   * @private
   */
  #onUpdateWorldTime() {
    if (!this.rendered) return;
    const timeEl = this.element.querySelector('.time-display-time');
    const dateEl = this.element.querySelector('.time-display-date');
    if (timeEl) timeEl.textContent = this.#formatTime();
    if (dateEl) dateEl.textContent = this.#formatDate();
  }

  /**
   * Format time using the timekeeperTime format location.
   * @returns {string} Formatted time
   * @private
   */
  #formatTime() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return TimeKeeper.getFormattedTime();
    const components = game.time.components;
    const yearZero = calendar.years?.yearZero ?? 0;
    return formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'timekeeperTime');
  }

  /**
   * Format date using the timekeeperDate format location.
   * @returns {string} Formatted date
   * @private
   */
  #formatDate() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return TimeKeeper.getFormattedDate();
    const components = game.time.components;
    const yearZero = calendar.years?.yearZero ?? 0;
    return formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'timekeeperDate');
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Format increment key for display.
   * @param {string} key - Increment key
   * @returns {string} Formatted label
   * @private
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
   * Get tooltip strings for time jump buttons based on current increment and jump settings.
   * @returns {{dec2Tooltip: string, dec1Tooltip: string, inc1Tooltip: string, inc2Tooltip: string}} Tooltip strings
   * @private
   */
  #getJumpTooltips() {
    const jumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const currentJumps = jumps[TimeKeeper.incrementKey] || { dec2: -5, dec1: -1, inc1: 1, inc2: 5 };
    const dec2 = currentJumps.dec2 || -5;
    const dec1 = currentJumps.dec1 || -1;
    const inc1 = currentJumps.inc1 || 1;
    const inc2 = currentJumps.inc2 || 5;
    const unitLabel = this.#formatIncrementLabel(TimeKeeper.incrementKey);
    const formatTooltip = (val) => `${val > 0 ? '+' : ''}${val} ${unitLabel}`;
    return { dec2Tooltip: formatTooltip(dec2), dec1Tooltip: formatTooltip(dec1), inc1Tooltip: formatTooltip(inc1), inc2Tooltip: formatTooltip(inc2) };
  }

  /**
   * Update the time jump button tooltips after increment change.
   * @private
   */
  #updateJumpTooltips() {
    const tooltips = this.#getJumpTooltips();
    const dec2Btn = this.element.querySelector('[data-action="dec2"]');
    const dec1Btn = this.element.querySelector('[data-action="dec1"]');
    const inc1Btn = this.element.querySelector('[data-action="inc1"]');
    const inc2Btn = this.element.querySelector('[data-action="inc2"]');
    if (dec2Btn) dec2Btn.dataset.tooltip = tooltips.dec2Tooltip;
    if (dec1Btn) dec1Btn.dataset.tooltip = tooltips.dec1Tooltip;
    if (inc1Btn) inc1Btn.dataset.tooltip = tooltips.inc1Tooltip;
    if (inc2Btn) inc2Btn.dataset.tooltip = tooltips.inc2Tooltip;
  }

  /* -------------------------------------------- */
  /*  Static Methods                              */
  /* -------------------------------------------- */

  /**
   * Render the TimeKeeper HUD singleton.
   * @returns {TimeKeeperHUD} The HUD instance
   */
  static show() {
    if (!this._instance) this._instance = new TimeKeeperHUD();
    this._instance.render(true);
    return this._instance;
  }

  /**
   * Hide the TimeKeeper HUD.
   */
  static hide() {
    this._instance?.close();
  }

  /**
   * Toggle the TimeKeeper HUD visibility.
   */
  static toggle() {
    if (this._instance?.rendered) this.hide();
    else this.show();
  }

  /**
   * Update the idle opacity CSS variable from settings.
   */
  static updateIdleOpacity() {
    const autoFade = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_AUTO_FADE);
    const opacity = autoFade ? game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_IDLE_OPACITY) / 100 : 1;
    document.documentElement.style.setProperty('--calendaria-timekeeper-idle-opacity', opacity);
  }

  /** @type {TimeKeeperHUD|null} Singleton instance */
  static _instance = null;
}
