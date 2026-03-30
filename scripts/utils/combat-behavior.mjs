/**
 * Shared combat behavior utility for widgets.
 * @module Utils/CombatBehavior
 * @author Tyler
 */

import { MODULE } from '../constants.mjs';

/**
 * Register combat behavior hooks for a widget.
 * @param {object} options - Configuration for combat behavior hooks
 * @param {string} options.settingKey - SETTINGS key for this widget's combat mode
 * @param {string} options.showSettingKey - SETTINGS key for the widget's show/visibility setting
 * @param {Function} options.getInstance - Returns the rendered instance or undefined
 * @param {Function} options.showWidget - Renders/shows the widget
 */
export function registerWidgetCombatHooks({ settingKey, showSettingKey, getInstance, showWidget }) {
  let closedForCombat = false;

  /** Restore the widget when combat ends if it was hidden. */
  function onCombatEnd() {
    if (!closedForCombat) return;
    closedForCombat = false;
    if (!game.settings.get(MODULE.ID, showSettingKey)) return;
    showWidget();
  }

  Hooks.on('combatStart', () => {
    const mode = game.settings.get(MODULE.ID, settingKey);
    if (mode !== 'hideCombat' && mode !== 'hideEncounter') return;
    const instance = getInstance();
    if (instance?.rendered) {
      closedForCombat = true;
      instance.close({ combat: true });
    }
  });

  Hooks.on('createCombat', () => {
    const mode = game.settings.get(MODULE.ID, settingKey);
    if (mode !== 'hideEncounter') return;
    const instance = getInstance();
    if (instance?.rendered) {
      closedForCombat = true;
      instance.close({ combat: true });
    }
  });

  Hooks.on('deleteCombat', () => {
    onCombatEnd();
  });

  Hooks.on('updateCombat', () => {
    if (!game.combat?.started) onCombatEnd();
  });
}

/**
 * Check if a widget should be blocked from showing due to active combat.
 * @param {string} settingKey - SETTINGS key for the widget's combat mode
 * @returns {boolean} True if the widget should be blocked
 */
export function isCombatBlocked(settingKey) {
  const mode = game.settings.get(MODULE.ID, settingKey);
  if (game.combat?.started && (mode === 'hideCombat' || mode === 'hideEncounter')) return true;
  if (game.combat && !game.combat.started && mode === 'hideEncounter') return true;
  return false;
}
