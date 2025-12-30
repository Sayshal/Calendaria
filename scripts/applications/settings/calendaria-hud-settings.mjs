/**
 * Calendar HUD Settings Application
 * Dedicated settings panel for the Calendar HUD.
 * @module Applications/Settings/CalendariaHUDSettings
 * @todo Is this needed anymore? Can we remove now that we have the inline settings version(s)?
 * @author Tyler
 */

import CalendarManager from '../../calendar/calendar-manager.mjs';
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
    window: { icon: 'fas fa-sliders', title: 'CALENDARIA.HUD.Settings.Title', resizable: false },
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
    context.isGM = game.user.isGM;
    if (context.isGM) {
      const activeId = game.settings.get(MODULE.ID, SETTINGS.ACTIVE_CALENDAR);
      context.calendars = CalendarManager.getAllCalendarMetadata().map((meta) => ({ id: meta.id, name: localize(meta.name) || meta.id, isActive: meta.id === activeId }));
    }

    const mode = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE);
    context.modeFullsize = mode === 'fullsize';
    context.modeCompact = mode === 'compact';
    const stickyStates = game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_STATES) || {};
    context.stickyTray = stickyStates.tray ?? false;
    context.stickyPosition = stickyStates.position ?? false;
    context.buttons = [{ type: 'submit', icon: 'fas fa-save', label: 'CALENDARIA.Common.Save' }];
    return context;
  }

  /* -------------------------------------------- */
  /*  Form Handling                               */
  /* -------------------------------------------- */

  /**
   * Handle form submission.
   * @param {Event} _event - Form submit event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - Processed form data
   * @this {CalendariaHUDSettings}
   */
  static async #onSubmit(_event, _form, formData) {
    const data = formData.object;
    let requiresReload = false;
    if (game.user.isGM && data.activeCalendar) {
      const currentCalendar = game.settings.get(MODULE.ID, SETTINGS.ACTIVE_CALENDAR);
      if (data.activeCalendar !== currentCalendar) {
        await game.settings.set(MODULE.ID, SETTINGS.ACTIVE_CALENDAR, data.activeCalendar);
        requiresReload = true;
      }
    }

    await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE, data.mode);
    const existingStates = game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_STATES) || {};
    const stickyStates = { tray: data.stickyTray ?? false, position: data.stickyPosition ?? false, multiplier: existingStates.multiplier ?? 1 };
    await game.settings.set(MODULE.ID, SETTINGS.HUD_STICKY_STATES, stickyStates);
    const hud = foundry.applications.instances.get('calendaria-hud');
    if (hud) hud.render({ force: true });
    ui.notifications.info('CALENDARIA.HUD.Settings.Saved', { localize: true });
    log(3, 'HUD settings saved');
    if (requiresReload) foundry.utils.debouncedReload();
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Reset the HUD position to default.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   * @this {CalendariaHUDSettings}
   */
  static async #onResetPosition(_event, _target) {
    await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, null);
    const hud = foundry.applications.instances.get('calendaria-hud');
    if (hud) {
      hud.setPosition({ left: null, top: null });
      hud.render();
    }
    ui.notifications.info('CALENDARIA.Settings.ResetPosition.Success', { localize: true });
    log(3, 'HUD position reset');
  }
}
