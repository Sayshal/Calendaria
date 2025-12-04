/**
 * Reset Position Dialog
 * @module Applications/Settings/ResetPosition
 * @author Tyler
 */

import { MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
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
    ui.notifications.info(game.i18n.localize('CALENDARIA.Settings.ResetPosition.Success'));

    // Refresh calendar if it's open
    CONFIG.DND5E.calendar.application?.resetPosition();

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
