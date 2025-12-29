/**
 * Darkness calculation utilities for syncing scene darkness with time of day.
 * @module Darkness
 * @author Tyler
 */

import { MODULE, SCENE_FLAGS, SETTINGS } from './constants.mjs';
import TimeKeeper from './time/time-keeper.mjs';
import { localize } from './utils/localization.mjs';
import { log } from './utils/logger.mjs';

/** @type {number|null} Last hour we calculated darkness for */
let lastHour = null;

/** @type {number|null} Target darkness we're transitioning to */
let targetDarkness = null;

/** @type {number|null} Starting darkness for transition */
let startDarkness = null;

/** @type {number} Transition start timestamp */
let transitionStart = 0;

/** @type {number} Current transition duration in ms */
let transitionDuration = 2500;

/** @type {number|null} Animation frame ID */
let animationFrameId = null;

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
    await scene.update({ 'environment.darknessLevel': darkness });
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
      <label>${localize('CALENDARIA.Scene.DarknessSync.Name')}</label>
      <select name="flags.${MODULE.ID}.${SCENE_FLAGS.DARKNESS_SYNC}">
        <option value="default" ${selectValue === 'default' ? 'selected' : ''}>${localize('CALENDARIA.Scene.DarknessSync.Choices.Default')}</option>
        <option value="enabled" ${selectValue === 'enabled' ? 'selected' : ''}>${localize('CALENDARIA.Scene.DarknessSync.Choices.Enabled')}</option>
        <option value="disabled" ${selectValue === 'disabled' ? 'selected' : ''}>${localize('CALENDARIA.Scene.DarknessSync.Choices.Disabled')}</option>
      </select>
      <p class="hint">${localize('CALENDARIA.Scene.DarknessSync.Hint')}</p>
    </div>
  `;

  // Find the ambiance tab or environment section to insert after
  const ambientLightField = html.querySelector('[name="environment.globalLight.enabled"]')?.closest('.form-group');
  if (ambientLightField) ambientLightField.insertAdjacentHTML('afterend', formGroup);
  else log(2, 'Could not find ambiance section to inject darkness sync setting');
}

/**
 * Update scene darkness when world time changes.
 * Only triggers transition when the hour changes.
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
  if (!shouldSyncSceneDarkness(activeScene)) return;

  // Get current hour
  const components = game.time.components ?? game.time.calendar?.timeToComponents(worldTime);
  const currentHour = components?.hour ?? 0;

  // Only trigger on hour change (or first run)
  if (lastHour !== null && lastHour === currentHour) return;

  log(3, `Hour changed: ${lastHour} → ${currentHour}`);
  lastHour = currentHour;

  // Calculate target darkness for the new hour
  const newTargetDarkness = calculateDarknessFromTime(currentHour, 0);

  // Start smooth transition
  startDarknessTransition(activeScene, newTargetDarkness);
}

/**
 * Start a smooth darkness transition to the target value.
 *
 * @param {Scene} scene - The scene to update
 * @param {number} target - Target darkness value
 */
function startDarknessTransition(scene, target) {
  // Cancel any existing transition
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  startDarkness = scene.environment.darknessLevel;
  targetDarkness = target;
  transitionStart = performance.now();

  // Calculate dynamic transition duration based on time advancement rate
  // gameTimeRatio = game seconds per real second, multiplier = speed multiplier
  const gameSecondsPerRealSecond = TimeKeeper.increment * TimeKeeper.multiplier;
  const secondsPerHour = 3600;

  if (gameSecondsPerRealSecond > 0) {
    // Real seconds until next hour
    const realSecondsPerHour = secondsPerHour / gameSecondsPerRealSecond;
    // Transition should complete in 80% of that time (min 500ms, max 3000ms)
    transitionDuration = Math.max(500, Math.min(3000, realSecondsPerHour * 800));
  } else {
    transitionDuration = 2500;
  }

  log(3, `Starting darkness transition: ${startDarkness.toFixed(3)} → ${targetDarkness.toFixed(3)} (${transitionDuration.toFixed(0)}ms)`);

  // Run the transition animation
  animateDarknessTransition(scene);
}

/**
 * Animate the darkness transition using requestAnimationFrame.
 *
 * @param {Scene} scene - The scene to update
 */
function animateDarknessTransition(scene) {
  const elapsed = performance.now() - transitionStart;
  const progress = Math.min(1, elapsed / transitionDuration);

  // Ease-in-out curve
  const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  // Calculate interpolated darkness
  const currentDarkness = startDarkness + (targetDarkness - startDarkness) * eased;

  // Update scene darkness (throttled to avoid too many updates)
  scene.update({ 'environment.darknessLevel': currentDarkness }, { diff: false });

  if (progress < 1) {
    // Continue animation
    animationFrameId = requestAnimationFrame(() => animateDarknessTransition(scene));
  } else {
    // Transition complete
    animationFrameId = null;
    log(3, `Darkness transition complete: ${targetDarkness.toFixed(3)}`);
  }
}

/**
 * Reset darkness tracking state (call on scene change).
 */
export function resetDarknessState() {
  lastHour = null;
  targetDarkness = null;
  startDarkness = null;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
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
