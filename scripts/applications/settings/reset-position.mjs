/**
 * Reset Position Dialog
 * @module Applications/Settings/ResetPosition
 * @author Tyler
 */

import { MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
import { localize, format } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Settings menu button that opens a confirmation dialog to reset calendar position
 * @extends {HandlebarsApplicationMixin(ApplicationV2)}
 */
export class ResetPositionDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-reset-position',
    classes: ['calendaria', 'reset-position-dialog'],
    tag: 'form',
    window: {
      title: 'CALENDARIA.Settings.ResetPosition.Name',
      icon: 'fas fa-undo',
      positioned: true,
      minimizable: false
    },
    actions: {
      reset: this.#onReset,
      cancel: this.#onCancel
    },
    position: { width: 400, height: 'auto' }
  };

  /** @inheritdoc */
  static PARTS = { content: { template: TEMPLATES.SETTINGS.RESET_POSITION } };

  /**
   * Handle reset button click
   * @this {ResetPositionDialog}
   * @private
   */
  static async #onReset() {
    log(3, 'Reset button clicked');

    await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_POSITION, null);
    await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_POSITION, null);
    ui.notifications.info(localize('CALENDARIA.Settings.ResetPosition.Success'));

    // Reset position on the HUD instance if open
    const hud = foundry.applications.instances.get('calendaria-hud');
    if (hud) {
      hud.setPosition({ left: null, top: null });
      hud.render();
    }

    log(3, 'Calendar position reset successfully');
    await this.close();
  }

  /**
   * Handle cancel button click
   * @this {ResetPositionDialog}
   * @private
   */
  static async #onCancel() {
    log(3, 'Cancel button clicked');
    await this.close();
  }
}
