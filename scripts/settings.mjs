/**
 * Calendaria Module Settings Registration
 * @module Settings
 * @author Tyler
 */

import { MODULE, SETTINGS } from './constants.mjs';
import { log } from './utils/logger.mjs';
import { ResetPositionDialog } from './applications/settings/reset-position.mjs';

/**
 * Register all module settings with Foundry VTT.
 * @returns {void}
 */
export function registerSettings() {
  // ========================================//
  //  Calendar Functionality                 //
  // ========================================//

  /** Saved position for the draggable calendar HUD */
  game.settings.register(MODULE.ID, SETTINGS.CALENDAR_POSITION, {
    name: 'Calendar Position',
    scope: 'user',
    config: false,
    type: Object,
    default: null
  });

  /** Default setting for syncing scene darkness with sun position */
  game.settings.register(MODULE.ID, SETTINGS.DARKNESS_SYNC, {
    name: 'CALENDARIA.Settings.DarknessSync.Name',
    hint: 'CALENDARIA.Settings.DarknessSync.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  /** Stored calendar configurations and active calendar state */
  game.settings.register(MODULE.ID, SETTINGS.CALENDARS, {
    name: 'Calendar Configurations',
    scope: 'world',
    config: false,
    type: Object,
    default: null
  });

  // ========================================//
  //  Technical                              //
  // ========================================//

  /** Logging level configuration for debug output */
  game.settings.register(MODULE.ID, SETTINGS.LOGGING_LEVEL, {
    name: 'CALENDARIA.Settings.Logger.Name',
    hint: 'CALENDARIA.Settings.Logger.Hint',
    scope: 'client',
    config: true,
    type: new foundry.data.fields.StringField({
      choices: {
        0: 'CALENDARIA.Settings.Logger.Choices.Off',
        1: 'CALENDARIA.Settings.Logger.Choices.Errors',
        2: 'CALENDARIA.Settings.Logger.Choices.Warnings',
        3: 'CALENDARIA.Settings.Logger.Choices.Verbose'
      },
      initial: 2
    }),
    onChange: (value) => {
      MODULE.LOG_LEVEL = parseInt(value);
    }
  });

  /** Settings menu button to reset calendar position */
  game.settings.registerMenu(MODULE.ID, 'resetPosition', {
    name: 'CALENDARIA.Settings.ResetPosition.Name',
    hint: 'CALENDARIA.Settings.ResetPosition.Hint',
    label: 'CALENDARIA.Settings.ResetPosition.Label',
    icon: 'fas fa-undo',
    type: ResetPositionDialog,
    restricted: false
  });

  log(3, 'Module settings registered.');
}
