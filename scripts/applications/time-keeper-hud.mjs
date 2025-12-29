/**
 * TimeKeeper HUD - Compact time control interface.
 * Provides forward/reverse buttons, increment selector, and current time display.
 *
 * @module Applications/TimeKeeperHUD
 * @author Tyler
 */

import { MODULE, HOOKS, TEMPLATES, SETTINGS } from '../constants.mjs';
import { localize, format } from '../utils/localization.mjs';
import { SettingsPanel } from './settings/settings-panel.mjs';
import TimeKeeper, { getTimeIncrements } from '../time/time-keeper.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Compact HUD for controlling game time.
 */
export class TimeKeeperHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {number|null} Hook ID for updateWorldTime */
  #timeHookId = null;

  /** @type {number|null} Hook ID for clock state changes */
  #clockHookId = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'time-keeper-hud',
    classes: ['time-keeper-hud'],
    position: { width: 'auto', height: 'auto', zIndex: 100 },
    window: { frame: false, positioned: true },
    actions: {
      reverse5x: TimeKeeperHUD.#onReverse5x,
      reverse: TimeKeeperHUD.#onReverse,
      forward: TimeKeeperHUD.#onForward,
      forward5x: TimeKeeperHUD.#onForward5x,
      toggle: TimeKeeperHUD.#onToggle,
      openSettings: TimeKeeperHUD.#onOpenSettings
    }
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.TIME_KEEPER_HUD } };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.increments = Object.entries(getTimeIncrements()).map(([key, seconds]) => ({
      key,
      label: this.#formatIncrement(key),
      seconds,
      selected: key === TimeKeeper.incrementKey
    }));
    context.running = TimeKeeper.running;
    context.isGM = game.user.isGM;
    context.currentTime = TimeKeeper.getFormattedTime();
    context.currentDate = TimeKeeper.getFormattedDate();

    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Restore saved position
    this.#restorePosition();

    // Enable dragging
    this.#enableDragging();

    // Increment selector (change event, not handled by actions)
    this.element.querySelector('[data-action="increment"]')?.addEventListener('change', (e) => {
      TimeKeeper.setIncrement(e.target.value);
    });

    // Listen for clock state changes to update UI
    if (!this.#clockHookId) this.#clockHookId = Hooks.on(HOOKS.CLOCK_START_STOP, this.#onClockStateChange.bind(this));

    // Listen for world time changes to update clock display
    if (!this.#timeHookId) this.#timeHookId = Hooks.on('updateWorldTime', this.#onUpdateWorldTime.bind(this));
  }

  /**
   * Restore saved position from settings.
   * @private
   */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.TIME_KEEPER_POSITION);
    if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') this.setPosition({ left: savedPos.left, top: savedPos.top });
    else this.setPosition({ left: 120, top: 120 });
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

    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
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

      // Clamp to viewport
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));

      this.setPosition({ left: newLeft, top: newTop });
    };

    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);

      // Save position
      await game.settings.set(MODULE.ID, SETTINGS.TIME_KEEPER_POSITION, { left: this.position.left, top: this.position.top });
    };
  }

  /** @override */
  _onClose(options) {
    // Save position before closing
    const pos = this.position;
    if (pos.top != null && pos.left != null) game.settings.set(MODULE.ID, SETTINGS.TIME_KEEPER_POSITION, { top: pos.top, left: pos.left });

    super._onClose(options);

    // Clean up hooks
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

  /** Reverse time by 5x increment. */
  static #onReverse5x() {
    TimeKeeper.reverse(5);
  }

  /** Reverse time by 1x increment. */
  static #onReverse() {
    TimeKeeper.reverse();
  }

  /** Advance time by 1x increment. */
  static #onForward() {
    TimeKeeper.forward();
  }

  /** Advance time by 5x increment. */
  static #onForward5x() {
    TimeKeeper.forward(5);
  }

  /** Toggle clock running state. */
  static #onToggle() {
    TimeKeeper.toggle();
    this.render();
  }

  /** Open settings panel. */
  static #onOpenSettings() {
    new SettingsPanel().render(true);
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle clock state changes.
   * @param {Object} data - Clock state data
   * @private
   */
  #onClockStateChange(data) {
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

    if (timeEl) timeEl.textContent = TimeKeeper.getFormattedTime();
    if (dateEl) dateEl.textContent = TimeKeeper.getFormattedDate();
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Format increment key for display.
   * @param {string} key - Increment key
   * @returns {string} Formatted label
   * @todo Can we use global keys from foundry?
   * @private
   */
  #formatIncrement(key) {
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

  /** @type {TimeKeeperHUD|null} Singleton instance */
  static _instance = null;
}
