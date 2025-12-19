/**
 * TimeKeeper HUD - Compact time control interface.
 * Provides forward/reverse buttons, increment selector, and current time display.
 *
 * @module Applications/TimeKeeperHUD
 * @author Tyler
 */

import { MODULE, HOOKS, TEMPLATES } from '../constants.mjs';
import TimeKeeper, { getTimeIncrements } from '../time/time-keeper.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Compact HUD for controlling game time.
 */
export class TimeKeeperHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {number|null} Hook ID for updateWorldTime */
  #timeHookId = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'time-keeper-hud',
    classes: ['time-keeper-hud'],
    position: { width: 'auto', height: 'auto', top: 80, left: 120, zIndex: 100 },
    window: { frame: false, positioned: true }
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

    // Set up event listeners
    this.#activateListeners();

    // Listen for clock state changes to update UI
    Hooks.on(HOOKS.CLOCK_START_STOP, this.#onClockStateChange.bind(this));

    // Listen for world time changes to update clock display
    if (!this.#timeHookId) this.#timeHookId = Hooks.on('updateWorldTime', this.#onUpdateWorldTime.bind(this));
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);

    // Clean up time hook
    if (this.#timeHookId) {
      Hooks.off('updateWorldTime', this.#timeHookId);
      this.#timeHookId = null;
    }
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Activate HUD event listeners.
   * @private
   */
  #activateListeners() {
    const html = this.element;

    // Reverse 5x button
    html.querySelector('[data-action="reverse5x"]')?.addEventListener('click', () => {
      TimeKeeper.reverse(5);
    });

    // Reverse 1x button
    html.querySelector('[data-action="reverse"]')?.addEventListener('click', () => {
      TimeKeeper.reverse();
    });

    // Forward 1x button
    html.querySelector('[data-action="forward"]')?.addEventListener('click', () => {
      TimeKeeper.forward();
    });

    // Forward 5x button
    html.querySelector('[data-action="forward5x"]')?.addEventListener('click', () => {
      TimeKeeper.forward(5);
    });

    // Play/Pause button
    html.querySelector('[data-action="toggle"]')?.addEventListener('click', () => {
      TimeKeeper.toggle();
      this.render();
    });

    // Increment selector
    html.querySelector('[data-action="increment"]')?.addEventListener('change', (event) => {
      TimeKeeper.setIncrement(event.target.value);
    });
  }

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
      second: game.i18n.localize('CALENDARIA.TimeKeeper.Second'),
      round: game.i18n.localize('CALENDARIA.TimeKeeper.Round'),
      minute: game.i18n.localize('CALENDARIA.TimeKeeper.Minute'),
      hour: game.i18n.localize('CALENDARIA.TimeKeeper.Hour'),
      day: game.i18n.localize('CALENDARIA.TimeKeeper.Day'),
      week: game.i18n.localize('CALENDARIA.TimeKeeper.Week'),
      month: game.i18n.localize('CALENDARIA.TimeKeeper.Month'),
      season: game.i18n.localize('CALENDARIA.TimeKeeper.Season'),
      year: game.i18n.localize('CALENDARIA.TimeKeeper.Year')
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
