/**
 * TimeKeeper - Compact time control interface.
 * Provides forward/reverse buttons, increment selector, and current time display.
 * @module Applications/TimeKeeper
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SETTINGS, SOCKET_TYPES, TEMPLATES } from '../constants.mjs';
import TimeClock, { getTimeIncrements } from '../time/time-clock.mjs';
import { formatForLocation, getDisplayFormat, hasMoonIconMarkers, renderMoonIcons } from '../utils/format-utils.mjs';
import { localize } from '../utils/localization.mjs';
import { canChangeDateTime, canViewTimeKeeper } from '../utils/permissions.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';
import * as StickyZones from '../utils/sticky-zones.mjs';
import { MiniCal } from './mini-cal.mjs';
import { SettingsPanel } from './settings/settings-panel.mjs';
import { Stopwatch } from './stopwatch.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Compact HUD for controlling game time.
 */
export class TimeKeeper extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {number|null} Hook ID for updateWorldTime */
  #timeHookId = null;

  /** @type {number|null} Hook ID for clock state changes */
  #clockHookId = null;

  /** @type {number|null} Hook ID for display format changes */
  #formatsHookId = null;

  /** @type {object|null} Currently active sticky zone during drag */
  #activeSnapZone = null;

  /** @type {string|null} ID of zone HUD is currently snapped to */
  #snappedZoneId = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'time-keeper',
    classes: ['calendaria', 'time-keeper'],
    position: { width: 200, height: 'auto', zIndex: 100 },
    window: { frame: false, positioned: true },
    actions: {
      dec2: TimeKeeper.#onDec2,
      dec1: TimeKeeper.#onDec1,
      inc1: TimeKeeper.#onInc1,
      inc2: TimeKeeper.#onInc2,
      toggle: TimeKeeper.#onToggle,
      openStopwatch: TimeKeeper.#onOpenStopwatch
    }
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.TIME_KEEPER } };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = game.time?.calendar;
    const isMonthless = calendar?.isMonthless ?? false;
    context.increments = Object.entries(getTimeIncrements())
      .filter(([key]) => !isMonthless || key !== 'month')
      .map(([key, seconds]) => ({ key, label: this.#formatIncrementLabel(key), seconds, selected: key === TimeClock.incrementKey }));
    context.running = TimeClock.running;
    context.isGM = game.user.isGM;
    context.canChangeDateTime = canChangeDateTime();
    const rawTime = this.#formatTime();
    const rawDate = this.#formatDate();
    context.currentTime = hasMoonIconMarkers(rawTime) ? renderMoonIcons(rawTime) : rawTime;
    context.currentDate = hasMoonIconMarkers(rawDate) ? renderMoonIcons(rawDate) : rawDate;
    const dateFormat = getDisplayFormat('timekeeperDate');
    context.showDate = dateFormat !== 'off';
    const tooltips = this.#getJumpTooltips();
    context.dec2Tooltip = tooltips.dec2Tooltip;
    context.dec1Tooltip = tooltips.dec1Tooltip;
    context.inc1Tooltip = tooltips.inc1Tooltip;
    context.inc2Tooltip = tooltips.inc2Tooltip;
    context.showDec2 = tooltips.dec2 !== null;
    context.showDec1 = tooltips.dec1 !== null;
    context.showInc1 = tooltips.inc1 !== null;
    context.showInc2 = tooltips.inc2 !== null;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (options.isFirstRender) this.#restorePosition();
    this.#enableDragging();
    const incrementSelect = this.element.querySelector('[data-action="increment"]');
    incrementSelect?.addEventListener('change', (e) => {
      TimeClock.setIncrement(e.target.value);
      this.render();
    });
    if (incrementSelect && canChangeDateTime()) {
      incrementSelect.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
          const incrementKeys = Object.keys(getTimeIncrements());
          const currentIndex = incrementKeys.indexOf(TimeClock.incrementKey);
          if (currentIndex === -1) return;
          const direction = event.deltaY < 0 ? -1 : 1;
          const newIndex = Math.max(0, Math.min(incrementKeys.length - 1, currentIndex + direction));
          if (newIndex === currentIndex) return;
          TimeClock.setIncrement(incrementKeys[newIndex]);
          this.render();
        },
        { passive: false }
      );
    }

    if (!this.#clockHookId) this.#clockHookId = Hooks.on(HOOKS.CLOCK_START_STOP, this.#onClockStateChange.bind(this));
    if (!this.#timeHookId) this.#timeHookId = Hooks.on('updateWorldTime', this.#onUpdateWorldTime.bind(this));
    if (!this.#formatsHookId) this.#formatsHookId = Hooks.on('calendaria.displayFormatsChanged', () => this.render());
    const container = this.element.querySelector('.time-keeper-content');
    container?.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#context-menu')) return;
      e.preventDefault();
      document.getElementById('context-menu')?.remove();
      const menu = new foundry.applications.ux.ContextMenu.implementation(this.element, '.time-keeper-content', this.#getContextMenuItems(), { fixed: true, jQuery: false });
      menu._onActivate(e);
    });
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
    const rightBuffer = StickyZones.getSidebarBuffer();
    let { left, top } = this.position;
    left = Math.max(0, Math.min(left, window.innerWidth - rect.width - rightBuffer));
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
      const rightBuffer = StickyZones.getSidebarBuffer();
      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width - rightBuffer));
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
  async close(options = {}) {
    return super.close({ animate: false, ...options });
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
    if (this.#formatsHookId) {
      Hooks.off('calendaria.displayFormatsChanged', this.#formatsHookId);
      this.#formatsHookId = null;
    }
  }

  /**
   * Get context menu items for the TimeKeeper.
   * @returns {object[]} Array of context menu item configs
   * @private
   */
  #getContextMenuItems() {
    const items = [];
    items.push({
      name: 'CALENDARIA.TimeKeeper.ContextMenu.Settings',
      icon: '<i class="fas fa-gear"></i>',
      callback: () => {
        const panel = new SettingsPanel();
        panel.render(true).then(() => {
          requestAnimationFrame(() => panel.changeTab('timekeeper', 'primary'));
        });
      }
    });
    if (game.user.isGM) {
      const isVisible = !!TimeKeeper.instance;
      items.push({
        name: isVisible ? 'CALENDARIA.TimeKeeper.ContextMenu.HideFromAll' : 'CALENDARIA.TimeKeeper.ContextMenu.ShowToAll',
        icon: `<i class="fas fa-${isVisible ? 'eye-slash' : 'eye'}"></i>`,
        callback: () => CalendariaSocket.emit(SOCKET_TYPES.TIME_KEEPER_VISIBILITY, { visible: !isVisible })
      });
    }
    items.push({
      name: 'CALENDARIA.TimeKeeper.ContextMenu.ResetPosition',
      icon: '<i class="fas fa-arrows-to-dot"></i>',
      callback: () => this.resetPosition()
    });
    const stickyStates = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_STICKY_STATES) || {};
    const isLocked = stickyStates.position ?? false;
    items.push({
      name: isLocked ? 'CALENDARIA.TimeKeeper.ContextMenu.UnlockPosition' : 'CALENDARIA.TimeKeeper.ContextMenu.LockPosition',
      icon: `<i class="fas fa-${isLocked ? 'unlock' : 'lock'}"></i>`,
      callback: () => this._toggleStickyPosition()
    });
    items.push({
      name: 'CALENDARIA.TimeKeeper.ContextMenu.OpenStopwatch',
      icon: '<i class="fas fa-stopwatch"></i>',
      callback: () => Stopwatch.show()
    });
    items.push({
      name: 'CALENDARIA.TimeKeeper.ContextMenu.SwapToMiniCal',
      icon: '<i class="fas fa-calendar-alt"></i>',
      callback: () => {
        TimeKeeper.hide();
        MiniCal.show();
      }
    });
    items.push({ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => this.close() });
    return items;
  }

  /**
   * Save sticky states to settings.
   * @param {object} updates - The state updates to save
   * @private
   */
  async #saveStickyStates(updates) {
    const current = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_STICKY_STATES) || {};
    await game.settings.set(MODULE.ID, SETTINGS.TIMEKEEPER_STICKY_STATES, { ...current, ...updates });
  }

  /**
   * Toggle position lock state.
   */
  async _toggleStickyPosition() {
    const current = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_STICKY_STATES) || {};
    const newLocked = !(current.position ?? false);
    await this.#saveStickyStates({ position: newLocked });
    ui.notifications.info(newLocked ? 'CALENDARIA.TimeKeeper.ContextMenu.PositionLocked' : 'CALENDARIA.TimeKeeper.ContextMenu.PositionUnlocked', { localize: true });
  }

  /**
   * Reset position to default and clear any sticky zone.
   */
  async resetPosition() {
    StickyZones.unregisterFromZoneUpdates(this);
    StickyZones.unpinFromZone(this.element);
    this.#snappedZoneId = null;
    this.setPosition({ left: 120, top: 120 });
    await game.settings.set(MODULE.ID, SETTINGS.TIME_KEEPER_POSITION, { left: 120, top: 120, zoneId: null });
    ui.notifications.info('CALENDARIA.TimeKeeper.ContextMenu.PositionReset', { localize: true });
  }

  /** Decrement time by configured dec2 amount. */
  static #onDec2() {
    const jumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const currentJumps = jumps[TimeClock.incrementKey] || { dec2: -5 };
    const amount = currentJumps.dec2 || -5;
    TimeClock.forward(amount);
  }

  /** Decrement time by configured dec1 amount. */
  static #onDec1() {
    const jumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const currentJumps = jumps[TimeClock.incrementKey] || { dec1: -1 };
    const amount = currentJumps.dec1 || -1;
    TimeClock.forward(amount);
  }

  /** Increment time by configured inc1 amount. */
  static #onInc1() {
    const jumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const currentJumps = jumps[TimeClock.incrementKey] || { inc1: 1 };
    const amount = currentJumps.inc1 || 1;
    TimeClock.forward(amount);
  }

  /** Increment time by configured inc2 amount. */
  static #onInc2() {
    const jumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const currentJumps = jumps[TimeClock.incrementKey] || { inc2: 5 };
    const amount = currentJumps.inc2 || 5;
    TimeClock.forward(amount);
  }

  /** Toggle clock running state. */
  static #onToggle() {
    TimeClock.toggle();
    this.render();
  }

  /** Open the Stopwatch application. */
  static #onOpenStopwatch() {
    Stopwatch.toggle();
  }

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
    if (timeEl) {
      const timeFormatted = this.#formatTime();
      if (hasMoonIconMarkers(timeFormatted)) timeEl.innerHTML = renderMoonIcons(timeFormatted);
      else timeEl.textContent = timeFormatted;
    }
    if (dateEl) {
      const dateFormatted = this.#formatDate();
      if (hasMoonIconMarkers(dateFormatted)) dateEl.innerHTML = renderMoonIcons(dateFormatted);
      else dateEl.textContent = dateFormatted;
    }
  }

  /**
   * Format time using the timekeeperTime format location.
   * @returns {string} Formatted time
   * @private
   */
  #formatTime() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return TimeClock.getFormattedTime();
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
    if (!calendar) return TimeClock.getFormattedDate();
    const components = game.time.components;
    const yearZero = calendar.years?.yearZero ?? 0;
    return formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'timekeeperDate');
  }

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
   * @returns {{dec2Tooltip: string|null, dec1Tooltip: string|null, inc1Tooltip: string|null, inc2Tooltip: string|null, dec2: number|null, dec1: number|null, inc1: number|null, inc2: number|null}} Tooltip strings and values
   * @private
   */
  #getJumpTooltips() {
    const jumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const currentJumps = jumps[TimeClock.incrementKey] || {};
    const dec2 = currentJumps.dec2 ?? null;
    const dec1 = currentJumps.dec1 ?? null;
    const inc1 = currentJumps.inc1 ?? null;
    const inc2 = currentJumps.inc2 ?? null;
    const unitLabel = this.#formatIncrementLabel(TimeClock.incrementKey);
    const formatTooltip = (val) => (val !== null ? `${val > 0 ? '+' : ''}${val} ${unitLabel}` : null);
    return { dec2Tooltip: formatTooltip(dec2), dec1Tooltip: formatTooltip(dec1), inc1Tooltip: formatTooltip(inc1), inc2Tooltip: formatTooltip(inc2), dec2, dec1, inc1, inc2 };
  }

  /**
   * Get the singleton instance from Foundry's application registry.
   * @returns {TimeKeeper|undefined} The instance if it exists
   */
  static get instance() {
    return foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
  }

  /**
   * Render the TimeKeeper singleton.
   * @param {object} [options] - Show options
   * @param {boolean} [options.silent] - If true, don't show permission warning
   * @returns {TimeKeeper} The instance
   */
  static show({ silent = false } = {}) {
    if (!canViewTimeKeeper()) {
      if (!silent) ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    const instance = this.instance ?? new TimeKeeper();
    instance.render({ force: true });
    return instance;
  }

  /** Hide the TimeKeeper. */
  static hide() {
    this.instance?.close();
  }

  /** Toggle the TimeKeeper visibility. */
  static toggle() {
    if (this.instance?.rendered) this.hide();
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
}
