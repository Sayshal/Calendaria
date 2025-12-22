/**
 * Calendar HUD Settings Application
 * Dedicated settings panel for the Calendar HUD.
 *
 * @module Applications/Settings/CalendariaHUDSettings
 * @author Tyler
 */

import { MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
import { localize } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Settings application for Calendar HUD configuration.
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class CalendariaHUDSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-hud-settings',
    classes: ['calendaria', 'hud-settings', 'standard-form'],
    tag: 'form',
    window: {
      icon: 'fas fa-sliders',
      title: 'CALENDARIA.HUD.Settings.Title',
      resizable: false
    },
    position: { width: 400, height: 'auto' },
    form: {
      handler: CalendariaHUDSettings.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      resetPosition: CalendariaHUDSettings.#onResetPosition
    }
  };

  /** @override */
  static PARTS = {
    form: { template: TEMPLATES.SETTINGS.HUD_SETTINGS },
    footer: { template: TEMPLATES.FORM_FOOTER }
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Current mode
    const mode = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE);
    context.modeFullsize = mode === 'fullsize';
    context.modeCompact = mode === 'compact';

    // Sticky states
    const stickyStates = game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_STATES) || {};
    context.stickyTray = stickyStates.tray ?? false;
    context.stickyPosition = stickyStates.position ?? false;

    // Footer buttons
    context.buttons = [
      { type: 'submit', icon: 'fas fa-save', label: 'CALENDARIA.UI.Save' }
    ];

    return context;
  }

  /* -------------------------------------------- */
  /*  Form Handling                               */
  /* -------------------------------------------- */

  /**
   * Handle form submission.
   * @param {Event} event - Form submit event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - Processed form data
   * @this {CalendariaHUDSettings}
   */
  static async #onSubmit(event, form, formData) {
    const data = formData.object;

    // Update mode
    await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE, data.mode);

    // Update sticky states (preserve existing multiplier)
    const existingStates = game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_STATES) || {};
    const stickyStates = {
      tray: data.stickyTray ?? false,
      position: data.stickyPosition ?? false,
      multiplier: existingStates.multiplier ?? 1
    };
    await game.settings.set(MODULE.ID, SETTINGS.HUD_STICKY_STATES, stickyStates);

    // Re-render HUD to apply changes (force: true ensures full re-render)
    const hud = foundry.applications.instances.get('calendaria-hud');
    if (hud) {
      hud.render({ force: true });
    }

    ui.notifications.info(localize('CALENDARIA.HUD.Settings.Saved'));
    log(3, 'HUD settings saved');
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Reset the HUD position to default.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   * @this {CalendariaHUDSettings}
   */
  static async #onResetPosition(event, target) {
    await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, null);

    // Reset position on the HUD instance
    const hud = foundry.applications.instances.get('calendaria-hud');
    if (hud) {
      hud.setPosition({ left: null, top: null });
      hud.render();
    }

    ui.notifications.info(localize('CALENDARIA.Settings.ResetPosition.Success'));
    log(3, 'HUD position reset');
  }
}
