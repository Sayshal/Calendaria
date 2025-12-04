/**
 * Darkness calculation utilities for syncing scene darkness with time of day.
 * @module Darkness
 * @author Tyler
 */

import { MODULE, SETTINGS, SCENE_FLAGS } from './constants.mjs';
import { log } from './utils/logger.mjs';

/**
 * Calculate darkness level based on time of day.
 *
 * The darkness level follows the sun's position:
 * - Noon (12:00): Minimum darkness (0.0 - brightest)
 * - Midnight (00:00): Maximum darkness (1.0 - darkest)
 * - Dawn/Dusk: Gradual transition
 *
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @returns {number} Darkness level between 0.0 (brightest) and 1.0 (darkest)
 */
export function calculateDarknessFromTime(hours, minutes) {
  // Convert time to total minutes since midnight
  const totalMinutes = hours * 60 + minutes;

  // Calculate progress through the day (0 = midnight, 0.5 = noon, 1 = midnight)
  const dayProgress = totalMinutes / (24 * 60);

  // Use cosine curve for smooth transition
  // cos(0) = 1 (midnight, dark)
  // cos(π) = -1 (noon, bright)
  // Normalize to 0-1 range
  const darkness = (Math.cos(dayProgress * 2 * Math.PI) + 1) / 2;

  // Clamp to ensure we stay in valid range
  return Math.max(0, Math.min(1, darkness));
}

/**
 * Get the current darkness level based on game world time.
 *
 * @returns {number} Darkness level between 0.0 (brightest) and 1.0 (darkest)
 */
export function getCurrentDarkness() {
  const currentTime = game.time.worldTime;
  const date = new Date(currentTime * 1000);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  return calculateDarknessFromTime(hours, minutes);
}

/**
 * Update a scene's darkness level based on current time.
 *
 * @param {Scene} scene - The scene to update
 * @returns {Promise<void>}
 */
export async function updateSceneDarkness(scene) {
  if (!scene) {
    log(2, 'Cannot update darkness: scene is null or undefined');
    return;
  }

  const darkness = getCurrentDarkness();

  try {
    await scene.update({ darkness });
    log(3, `Updated scene "${scene.name}" darkness to ${darkness.toFixed(3)}`);
  } catch (error) {
    log(2, `Error updating darkness for scene "${scene.name}":`, error);
  }
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

/**
 * Inject the darkness sync override setting into the scene configuration sheet.
 *
 * @param {SceneConfig} app - The scene configuration application
 * @param {HTMLElement} html - The rendered HTML element
 * @param {Object} data - The scene data
 */
export function onRenderSceneConfig(app, html, data) {
  // Get the current flag value (can be null, boolean, or string)
  const flagValue = app.document.getFlag(MODULE.ID, SCENE_FLAGS.DARKNESS_SYNC);

  // Determine the select value based on flag (handle both boolean and string values)
  let selectValue = 'default';
  if (flagValue === true || flagValue === 'enabled') selectValue = 'enabled';
  else if (flagValue === false || flagValue === 'disabled') selectValue = 'disabled';
  else if (flagValue === 'default') selectValue = 'default';

  /** @todo move this to template file */
  const formGroup = `
    <div class="form-group slim">
      <label>${game.i18n.localize('CALENDARIA.Scene.DarknessSync.Name')}</label>
      <select name="flags.${MODULE.ID}.${SCENE_FLAGS.DARKNESS_SYNC}">
        <option value="default" ${selectValue === 'default' ? 'selected' : ''}>${game.i18n.localize('CALENDARIA.Scene.DarknessSync.Choices.Default')}</option>
        <option value="enabled" ${selectValue === 'enabled' ? 'selected' : ''}>${game.i18n.localize('CALENDARIA.Scene.DarknessSync.Choices.Enabled')}</option>
        <option value="disabled" ${selectValue === 'disabled' ? 'selected' : ''}>${game.i18n.localize('CALENDARIA.Scene.DarknessSync.Choices.Disabled')}</option>
      </select>
      <p class="hint">${game.i18n.localize('CALENDARIA.Scene.DarknessSync.Hint')}</p>
    </div>
  `;

  // Find the ambiance tab or environment section to insert after
  const ambientLightField = html.querySelector('[name="environment.globalLight.enabled"]')?.closest('.form-group');
  if (ambientLightField) ambientLightField.insertAdjacentHTML('afterend', formGroup);
  else log(2, 'Could not find ambiance section to inject darkness sync setting');
}

/**
 * Update scene darkness when world time changes.
 *
 * @param {number} worldTime - The new world time
 * @param {number} dt - The time delta
 */
export async function onUpdateWorldTime(worldTime, dt) {
  // Only update the currently active/viewed scene
  const activeScene = game.scenes.active;

  if (!activeScene) {
    log(3, 'No active scene to update darkness');
    return;
  }

  // Check if this scene should sync darkness
  const shouldSync = shouldSyncSceneDarkness(activeScene);
  if (shouldSync) await updateSceneDarkness(activeScene);
}

/**
 * Determine if a scene should have its darkness synced with time.
 *
 * @param {Scene} scene - The scene to check
 * @returns {boolean} True if darkness should be synced
 */
function shouldSyncSceneDarkness(scene) {
  // Get the scene-specific flag (can be null, true/false, or string 'enabled'/'disabled'/'default')
  const sceneFlag = scene.getFlag(MODULE.ID, SCENE_FLAGS.DARKNESS_SYNC);

  // Handle both boolean and string values
  if (sceneFlag === true || sceneFlag === 'enabled') return true;
  if (sceneFlag === false || sceneFlag === 'disabled') return false;

  // If 'default' or null/undefined, use global setting
  const globalSetting = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_SYNC);
  return globalSetting;
}
