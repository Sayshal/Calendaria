/**
 * Darkness calculation utilities for syncing scene darkness with time of day.
 * @module Darkness
 * @author Tyler
 */

import { MODULE, SCENE_FLAGS, SETTINGS, SOCKET_TYPES, TEMPLATES } from './constants.mjs';
import { log } from './utils/logger.mjs';
import { CalendariaSocket } from './utils/socket.mjs';
import WeatherManager from './weather/weather-manager.mjs';

/** @type {number|null} Last hour we calculated darkness for */
let lastHour = null;

/**
 * Calculate darkness level based on time of day, shaped by sunrise and sunset.
 * Uses a piecewise cosine: darkest at solar midnight, brightest at solar midday,
 * with smooth ramps between sunrise/sunset boundaries.
 * @param {number} hours - Hours (0 to hoursPerDay-1)
 * @param {number} minutes - Minutes (0 to minutesPerHour-1)
 * @param {number} [hoursPerDay] - Hours per day for this calendar
 * @param {number} [minutesPerHour] - Minutes per hour for this calendar
 * @param {number} [sunrise] - Sunrise hour (decimal). If null, uses symmetric cosine.
 * @param {number} [sunset] - Sunset hour (decimal). If null, uses symmetric cosine.
 * @returns {number} Darkness level between 0.0 (brightest) and 1.0 (darkest)
 */
export function calculateDarknessFromTime(hours, minutes, hoursPerDay = 24, minutesPerHour = 60, sunrise = null, sunset = null) {
  const currentHour = hours + minutes / minutesPerHour;
  if (sunrise == null || sunset == null) {
    const dayProgress = currentHour / hoursPerDay;
    const darkness = (Math.cos(dayProgress * 2 * Math.PI) + 1) / 2;
    return Math.max(0, Math.min(1, darkness));
  }
  const daylightHours = sunset - sunrise;
  const nightHours = hoursPerDay - daylightHours;
  if (currentHour >= sunrise && currentHour < sunset) {
    const dayProgress = (currentHour - sunrise) / daylightHours;
    return Math.max(0, Math.min(1, (Math.cos(dayProgress * Math.PI * 2 - Math.PI) + 1) / 2));
  }
  let nightProgress;
  if (currentHour >= sunset) nightProgress = (currentHour - sunset) / nightHours;
  else nightProgress = (currentHour + hoursPerDay - sunset) / nightHours;
  return Math.max(0, Math.min(1, ((1 - Math.cos(nightProgress * Math.PI * 2 - Math.PI)) / 2) * 0.5 + 0.5));
}

/**
 * Get the current darkness level based on game world time and active zone.
 * @param {object} [scene] - Scene for zone resolution
 * @returns {number} Darkness level between 0.0 (brightest) and 1.0 (darkest)
 */
export function getCurrentDarkness(scene = null) {
  const calendar = game.time.calendar;
  const components = game.time.components;
  const hours = components.hour ?? 0;
  const minutes = components.minute ?? 0;
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
  const zone = WeatherManager.getActiveZone?.(null, scene);
  const sunrise = calendar?.sunrise?.(components, zone) ?? null;
  const sunset = calendar?.sunset?.(components, zone) ?? null;
  return calculateDarknessFromTime(hours, minutes, hoursPerDay, minutesPerHour, sunrise, sunset);
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
  const activeZone = WeatherManager.getActiveZone?.(null, scene);
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
 * @param {object} [scene] - The scene to check for climate zone override
 * @returns {{base: {hue: number|null, saturation: number|null}, dark: {hue: number|null, saturation: number|null}}|null} - environment config
 */
export function calculateEnvironmentLighting(scene) {
  const activeZone = WeatherManager.getActiveZone?.(null, scene);
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
  return { base: { hue: baseHue, saturation: baseSaturation }, dark: { hue: darkHue, saturation: darkSaturation } };
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
  const hudHideForPlayers = app.document.getFlag(MODULE.ID, SCENE_FLAGS.HUD_HIDE_FOR_PLAYERS) ?? false;
  const climateZoneOverride = app.document.getFlag(MODULE.ID, SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE) ?? '';
  const climateZones = WeatherManager.getCalendarZones?.() ?? [];
  const formGroup = await foundry.applications.handlebars.renderTemplate(TEMPLATES.PARTIALS.SCENE_DARKNESS_SYNC, {
    moduleId: MODULE.ID,
    flagName: SCENE_FLAGS.DARKNESS_SYNC,
    brightnessFlag: SCENE_FLAGS.BRIGHTNESS_MULTIPLIER,
    hudHideFlag: SCENE_FLAGS.HUD_HIDE_FOR_PLAYERS,
    climateZoneFlag: SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE,
    value,
    brightnessMultiplier,
    hudHideForPlayers,
    climateZoneOverride,
    climateZones
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
 * Computes per-scene darkness based on each scene's active climate zone.
 * @param {number} worldTime - The new world time
 * @param {number} _dt - The time delta
 */
export async function updateDarknessFromWorldTime(worldTime, _dt) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  const calendar = game.time.calendar;
  const components = game.time.components ?? calendar?.timeToComponents(worldTime);
  const currentHour = components?.hour ?? 0;
  if (lastHour !== null && lastHour === currentHour) return;
  lastHour = currentHour;
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
  for (const scene of getDarknessScenes()) {
    const zone = WeatherManager.getActiveZone?.(null, scene);
    const sunrise = calendar?.sunrise?.(components, zone) ?? null;
    const sunset = calendar?.sunset?.(components, zone) ?? null;
    const baseDarkness = calculateDarknessFromTime(currentHour, 0, hoursPerDay, minutesPerHour, sunrise, sunset);
    const darkness = calculateAdjustedDarkness(baseDarkness, scene);
    scene.update({ 'environment.darknessLevel': darkness }, { animateDarkness: true });
  }
  log(3, `Hour changed: ${lastHour} → ${currentHour}`);
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
 * Get all scenes that should receive darkness updates.
 * When "all scenes" setting is enabled, returns every scene with sync enabled.
 * Otherwise, returns only the active scene.
 * @returns {object[]} Array of scene documents with darkness sync enabled
 */
function getDarknessScenes() {
  if (game.settings.get(MODULE.ID, SETTINGS.DARKNESS_SYNC_ALL_SCENES)) return game.scenes.filter((scene) => shouldSyncSceneDarkness(scene));
  const activeScene = game.scenes.active;
  if (!activeScene || !shouldSyncSceneDarkness(activeScene)) return [];
  return [activeScene];
}

/**
 * Handle weather change to update scene darkness and environment lighting.
 */
export async function onWeatherChange() {
  if (!CalendariaSocket.isPrimaryGM()) return;
  const calendar = game.time.calendar;
  const components = game.time.components;
  const currentHour = components?.hour ?? 0;
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
  for (const scene of getDarknessScenes()) {
    const zone = WeatherManager.getActiveZone?.(null, scene);
    const sunrise = calendar?.sunrise?.(components, zone) ?? null;
    const sunset = calendar?.sunset?.(components, zone) ?? null;
    const baseDarkness = calculateDarknessFromTime(currentHour, 0, hoursPerDay, minutesPerHour, sunrise, sunset);
    const darkness = calculateAdjustedDarkness(baseDarkness, scene);
    scene.update({ 'environment.darknessLevel': darkness }, { animateDarkness: true });
    const lighting = calculateEnvironmentLighting(scene);
    await applyEnvironmentLighting(scene, lighting);
  }
  log(3, 'Weather changed, updating darkness across viewed scenes');
}

/**
 * Handle scene update to sync darkness when a scene becomes active.
 * @param {object} scene - The scene that was updated
 * @param {object} change - The change data
 */
export async function onUpdateScene(scene, change) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  if (!change.active) return;
  if (scene.getFlag(MODULE.ID, SCENE_FLAGS.HUD_HIDE_FOR_PLAYERS)) CalendariaSocket.emit(SOCKET_TYPES.HUD_VISIBILITY, { visible: false });
  else CalendariaSocket.emit(SOCKET_TYPES.HUD_VISIBILITY, { visible: true });
  if (!shouldSyncSceneDarkness(scene)) return;
  lastHour = null;
  const calendar = game.time.calendar;
  const components = game.time.components;
  const currentHour = components?.hour ?? 0;
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
  const zone = WeatherManager.getActiveZone?.(null, scene);
  const sunrise = calendar?.sunrise?.(components, zone) ?? null;
  const sunset = calendar?.sunset?.(components, zone) ?? null;
  const baseDarkness = calculateDarknessFromTime(currentHour, 0, hoursPerDay, minutesPerHour, sunrise, sunset);
  const darkness = calculateAdjustedDarkness(baseDarkness, scene);
  scene.update({ 'environment.darknessLevel': darkness }, { animateDarkness: true });
  const lighting = calculateEnvironmentLighting(scene);
  await applyEnvironmentLighting(scene, lighting);
  log(3, `Scene activated, transitioning darkness to ${darkness.toFixed(3)}`);
}
