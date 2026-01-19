/**
 * Darkness calculation utilities for syncing scene darkness with time of day.
 * @module Darkness
 * @author Tyler
 */

import { MODULE, SCENE_FLAGS, SETTINGS, TEMPLATES } from './constants.mjs';
import TimeClock from './time/time-clock.mjs';
import { log } from './utils/logger.mjs';
import { CalendariaSocket } from './utils/socket.mjs';
import WeatherManager from './weather/weather-manager.mjs';

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
 * @param {number} hours - Hours (0 to hoursPerDay-1)
 * @param {number} minutes - Minutes (0 to minutesPerHour-1)
 * @param {number} [hoursPerDay] - Hours per day for this calendar
 * @param {number} [minutesPerHour] - Minutes per hour for this calendar
 * @returns {number} Darkness level between 0.0 (brightest) and 1.0 (darkest)
 */
export function calculateDarknessFromTime(hours, minutes, hoursPerDay = 24, minutesPerHour = 60) {
  const totalMinutes = hours * minutesPerHour + minutes;
  const dayProgress = totalMinutes / (hoursPerDay * minutesPerHour);
  const darkness = (Math.cos(dayProgress * 2 * Math.PI) + 1) / 2;
  return Math.max(0, Math.min(1, darkness));
}

/**
 * Get the current darkness level based on game world time.
 * @returns {number} Darkness level between 0.0 (brightest) and 1.0 (darkest)
 */
export function getCurrentDarkness() {
  const components = game.time.components;
  const hours = components.hour ?? 0;
  const minutes = components.minute ?? 0;
  const hoursPerDay = game.time.calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = game.time.calendar?.days?.minutesPerHour ?? 60;
  return calculateDarknessFromTime(hours, minutes, hoursPerDay, minutesPerHour);
}

/**
 * Calculate adjusted darkness with scene, climate, and weather modifiers.
 * @param {number} baseDarkness - Base darkness from time of day (0-1)
 * @param {object} scene - The scene to get modifiers from
 * @returns {number} Adjusted darkness level (0-1)
 */
export function calculateAdjustedDarkness(baseDarkness, scene) {
  const defaultMult = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER) ?? 1.0;
  const sceneFlag = scene?.getFlag(MODULE.ID, SCENE_FLAGS.BRIGHTNESS_MULTIPLIER);
  const sceneBrightnessMult = sceneFlag ?? defaultMult;
  const activeZone = WeatherManager.getActiveZone?.();
  const climateBrightnessMult = activeZone?.brightnessMultiplier ?? 1.0;
  const brightness = 1 - baseDarkness;
  const adjustedBrightness = brightness * sceneBrightnessMult * climateBrightnessMult;
  let adjustedDarkness = 1 - adjustedBrightness;
  const weatherSync = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_WEATHER_SYNC);
  if (weatherSync) {
    const currentWeather = WeatherManager.getCurrentWeather?.();
    const weatherDarknessPenalty = currentWeather?.darknessPenalty ?? 0;
    adjustedDarkness += weatherDarknessPenalty;
  }
  return Math.max(0, Math.min(1, adjustedDarkness));
}

/**
 * Calculate environment lighting overrides from climate zone and weather.
 * @returns {{base: {hue: number|null, saturation: number|null}, dark: {hue: number|null, saturation: number|null}}|null} - environment config
 */
export function calculateEnvironmentLighting() {
  const activeZone = WeatherManager.getActiveZone?.();
  const currentWeather = WeatherManager.getCurrentWeather?.();
  let baseHue = activeZone?.environmentBase?.hue ?? null;
  let baseSaturation = activeZone?.environmentBase?.saturation ?? null;
  let darkHue = activeZone?.environmentDark?.hue ?? null;
  let darkSaturation = activeZone?.environmentDark?.saturation ?? null;
  if (currentWeather?.environmentBase?.hue != null) baseHue = currentWeather.environmentBase.hue;
  if (currentWeather?.environmentBase?.saturation != null) baseSaturation = currentWeather.environmentBase.saturation;
  if (currentWeather?.environmentDark?.hue != null) darkHue = currentWeather.environmentDark.hue;
  if (currentWeather?.environmentDark?.saturation != null) darkSaturation = currentWeather.environmentDark.saturation;
  if (baseHue === null && baseSaturation === null && darkHue === null && darkSaturation === null) return null;
  return {
    base: { hue: baseHue, saturation: baseSaturation },
    dark: { hue: darkHue, saturation: darkSaturation }
  };
}

/**
 * Apply environment lighting to a scene.
 * @param {object} scene - The scene to update
 * @param {{base: {hue: number|null, saturation: number|null}, dark: {hue: number|null, saturation: number|null}}|null} lighting - Lighting overrides
 */
async function applyEnvironmentLighting(scene, lighting) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  const ambienceSync = game.settings.get(MODULE.ID, SETTINGS.AMBIENCE_SYNC);
  if (!ambienceSync) return;
  if (!lighting) {
    await scene.update({ 'environment.base.intensity': 0, 'environment.dark.intensity': 0 });
    log(3, 'Reset environment lighting to defaults');
    return;
  }
  const intensityData = {};
  if (lighting.base.hue !== null) intensityData['environment.base.intensity'] = 0.5;
  else intensityData['environment.base.intensity'] = 0;
  if (lighting.dark.hue !== null) intensityData['environment.dark.intensity'] = 0.5;
  else intensityData['environment.dark.intensity'] = 0;
  await scene.update(intensityData);
  log(3, 'Set environment intensity:', intensityData);
  const updateData = {};
  if (lighting.base.hue !== null) updateData['environment.base.hue'] = lighting.base.hue / 360;
  if (lighting.base.saturation !== null) updateData['environment.base.saturation'] = lighting.base.saturation * 2 - 1;
  if (lighting.dark.hue !== null) updateData['environment.dark.hue'] = lighting.dark.hue / 360;
  if (lighting.dark.saturation !== null) updateData['environment.dark.saturation'] = lighting.dark.saturation * 2 - 1;
  if (Object.keys(updateData).length > 0) {
    await scene.update(updateData);
    log(3, 'Applied environment lighting:', updateData);
  }
}

/**
 * Update a scene's darkness level based on current time.
 * @param {object} scene - The scene to update
 * @returns {Promise<void>}
 */
export async function updateSceneDarkness(scene) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  if (!scene) return;
  const baseDarkness = getCurrentDarkness();
  const darkness = calculateAdjustedDarkness(baseDarkness, scene);

  try {
    await scene.update({ 'environment.darknessLevel': darkness });
    log(3, `Updated scene "${scene.name}" darkness to ${darkness.toFixed(3)}`);
  } catch (error) {
    log(1, `Error updating darkness for scene "${scene.name}":`, error);
  }
}

/**
 * Inject the darkness sync override setting into the scene configuration sheet.
 * @param {object} app - The scene configuration application
 * @param {HTMLElement} html - The rendered HTML element
 * @param {object} _data - The scene data
 */
export async function onRenderSceneConfig(app, html, _data) {
  const flagValue = app.document.getFlag(MODULE.ID, SCENE_FLAGS.DARKNESS_SYNC);
  let value = 'default';
  if (flagValue === true || flagValue === 'enabled') value = 'enabled';
  else if (flagValue === false || flagValue === 'disabled') value = 'disabled';
  const brightnessMultiplier = app.document.getFlag(MODULE.ID, SCENE_FLAGS.BRIGHTNESS_MULTIPLIER) ?? 1.0;
  const formGroup = await foundry.applications.handlebars.renderTemplate(TEMPLATES.PARTIALS.SCENE_DARKNESS_SYNC, {
    moduleId: MODULE.ID,
    flagName: SCENE_FLAGS.DARKNESS_SYNC,
    brightnessFlag: SCENE_FLAGS.BRIGHTNESS_MULTIPLIER,
    value,
    brightnessMultiplier
  });
  const ambientLightField = html.querySelector('[name="environment.globalLight.enabled"]')?.closest('.form-group');
  if (ambientLightField) ambientLightField.insertAdjacentHTML('afterend', formGroup);
  else log(2, 'Could not find ambiance section to inject darkness sync setting');
  const rangeInput = html.querySelector(`[name="flags.${MODULE.ID}.${SCENE_FLAGS.BRIGHTNESS_MULTIPLIER}"]`);
  if (rangeInput) {
    rangeInput.addEventListener('input', (event) => {
      const display = event.target.parentElement.querySelector('.range-value');
      if (display) display.textContent = `${event.target.value}x`;
    });
  }
}

/**
 * Update scene darkness when world time changes.
 * @param {number} worldTime - The new world time
 * @param {number} _dt - The time delta
 */
export async function onUpdateWorldTime(worldTime, _dt) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  const activeScene = game.scenes.active;
  if (!activeScene) return;
  if (!shouldSyncSceneDarkness(activeScene)) return;
  const components = game.time.components ?? game.time.calendar?.timeToComponents(worldTime);
  const currentHour = components?.hour ?? 0;
  if (lastHour !== null && lastHour === currentHour) return;
  lastHour = currentHour;
  const hoursPerDay = game.time.calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = game.time.calendar?.days?.minutesPerHour ?? 60;
  const baseDarkness = calculateDarknessFromTime(currentHour, 0, hoursPerDay, minutesPerHour);
  const newTargetDarkness = calculateAdjustedDarkness(baseDarkness, activeScene);
  startDarknessTransition(activeScene, newTargetDarkness);
  log(3, `Hour changed: ${lastHour} → ${currentHour}`);
}

/**
 * Start a smooth darkness transition to the target value.
 * @param {object} scene - The scene to update
 * @param {number} target - Target darkness value
 */
function startDarknessTransition(scene, target) {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  startDarkness = scene.environment.darknessLevel;
  targetDarkness = target;
  transitionStart = performance.now();
  const gameSecondsPerRealSecond = TimeClock.increment * TimeClock.multiplier;
  const minutesPerHour = game.time.calendar?.days?.minutesPerHour ?? 60;
  const secondsPerMinute = game.time.calendar?.days?.secondsPerMinute ?? 60;
  const secondsPerHour = minutesPerHour * secondsPerMinute;
  if (gameSecondsPerRealSecond > 0) transitionDuration = Math.max(500, Math.min(3000, (secondsPerHour / gameSecondsPerRealSecond) * 800));
  else transitionDuration = 2500;
  log(3, `Starting darkness transition: ${startDarkness.toFixed(3)} → ${targetDarkness.toFixed(3)} (${transitionDuration.toFixed(0)}ms)`);
  animateDarknessTransition(scene);
}

/**
 * Animate the darkness transition using requestAnimationFrame.
 * @param {object} scene - The scene to update
 */
function animateDarknessTransition(scene) {
  const elapsed = performance.now() - transitionStart;
  const progress = Math.min(1, elapsed / transitionDuration);
  const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  const currentDarkness = startDarkness + (targetDarkness - startDarkness) * eased;
  scene.update({ 'environment.darknessLevel': currentDarkness }, { diff: false });
  if (progress < 1) animationFrameId = requestAnimationFrame(() => animateDarknessTransition(scene));
  else animationFrameId = null;
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
 * @param {object} scene - The scene to check
 * @returns {boolean} True if darkness should be synced
 */
function shouldSyncSceneDarkness(scene) {
  const sceneFlag = scene.getFlag(MODULE.ID, SCENE_FLAGS.DARKNESS_SYNC);
  if (sceneFlag === true || sceneFlag === 'enabled') return true;
  if (sceneFlag === false || sceneFlag === 'disabled') return false;
  const globalSetting = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_SYNC);
  return globalSetting;
}

/**
 * Handle weather change to update scene darkness and environment lighting.
 */
export async function onWeatherChange() {
  if (!CalendariaSocket.isPrimaryGM()) return;
  const activeScene = game.scenes.active;
  if (!activeScene) return;
  if (!shouldSyncSceneDarkness(activeScene)) return;
  const components = game.time.components;
  const currentHour = components?.hour ?? 0;
  const hoursPerDay = game.time.calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = game.time.calendar?.days?.minutesPerHour ?? 60;
  const baseDarkness = calculateDarknessFromTime(currentHour, 0, hoursPerDay, minutesPerHour);
  const newTargetDarkness = calculateAdjustedDarkness(baseDarkness, activeScene);
  startDarknessTransition(activeScene, newTargetDarkness);
  const lighting = calculateEnvironmentLighting();
  await applyEnvironmentLighting(activeScene, lighting);
  log(3, `Weather changed, updating darkness to ${newTargetDarkness.toFixed(3)}`);
}

/**
 * Handle scene update to sync darkness when a scene becomes active.
 * @param {object} scene - The scene that was updated
 * @param {object} change - The change data
 */
export async function onUpdateScene(scene, change) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  if (!change.active) return;
  if (!shouldSyncSceneDarkness(scene)) return;
  resetDarknessState();
  const components = game.time.components;
  const currentHour = components?.hour ?? 0;
  const hoursPerDay = game.time.calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = game.time.calendar?.days?.minutesPerHour ?? 60;
  const baseDarkness = calculateDarknessFromTime(currentHour, 0, hoursPerDay, minutesPerHour);
  const newDarkness = calculateAdjustedDarkness(baseDarkness, scene);
  startDarknessTransition(scene, newDarkness);
  const lighting = calculateEnvironmentLighting();
  await applyEnvironmentLighting(scene, lighting);
  log(3, `Scene activated, transitioning darkness to ${newDarkness.toFixed(3)}`);
}
