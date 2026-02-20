/**
 * Darkness calculation utilities for syncing scene darkness with time of day.
 * @module Darkness
 * @author Tyler
 */

import { MODULE, SCENE_FLAGS, SETTINGS, SOCKET_TYPES, TEMPLATES } from './constants.mjs';
import { isFXMasterActive } from './integrations/fxmaster.mjs';
import { log } from './utils/logger.mjs';
import { getMoonPhasePosition } from './utils/moon-utils.mjs';
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
    return Math.max(0, Math.min(1, (Math.cos(dayProgress * Math.PI * 2) + 1) / 4));
  }
  let nightProgress;
  if (currentHour >= sunset) nightProgress = (currentHour - sunset) / nightHours;
  else nightProgress = (currentHour + hoursPerDay - sunset) / nightHours;
  return Math.max(0, Math.min(1, ((1 - Math.cos(nightProgress * Math.PI * 2)) / 2) * 0.5 + 0.5));
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
  const moonSync = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_MOON_SYNC);
  if (moonSync) {
    const moonResult = calculateMoonIllumination(adjustedDarkness);
    adjustedDarkness -= moonResult.reduction;
  }
  const weatherSync = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_WEATHER_SYNC);
  if (weatherSync) {
    const currentWeather = WeatherManager.getCurrentWeather?.(null, scene);
    const deferToFx = currentWeather?.fxPreset && isFXMasterActive();
    if (!deferToFx) {
      const weatherDarknessPenalty = currentWeather?.darknessPenalty ?? 0;
      adjustedDarkness += weatherDarknessPenalty;
    }
  }
  return Math.max(0, Math.min(1, adjustedDarkness));
}

/**
 * Calculate moon illumination factor for the current night.
 * Full moons brighten the scene; new moons have no effect.
 * @param {number} baseDarkness - Current darkness level (0-1)
 * @returns {{ reduction: number, hue: number|null, intensity: number|null, luminosity: number|null }} Moon illumination data
 */
export function calculateMoonIllumination(baseDarkness) {
  if (baseDarkness < 0.5) return { reduction: 0, hue: null, intensity: null, luminosity: null };
  const calendar = game.time.calendar;
  if (!calendar?.moonsArray?.length) return { reduction: 0, hue: null, intensity: null, luminosity: null };
  let totalReduction = 0;
  let totalIllumination = 0;
  const coloredMoons = [];
  for (const moon of calendar.moonsArray) {
    const position = getMoonPhasePosition(moon, game.time.components, calendar);
    const illumination = (1 - Math.cos(position * 2 * Math.PI)) / 2;
    const moonMax = moon.moonBrightnessMax ?? 0.15;
    const nightFactor = (baseDarkness - 0.5) / 0.5;
    totalReduction += illumination * moonMax * nightFactor;
    totalIllumination += illumination * moonMax;
    if (illumination > 0.3 && moon.color) {
      const rgb = foundry.utils.Color.from(moon.color);
      const hsl = rgb.hsl;
      if (hsl[1] > 0.1) coloredMoons.push({ hsl, illumination });
    }
  }

  let hue = null;
  let intensity = null;
  if (coloredMoons.length) {
    let totalWeight = 0;
    let weightedHueX = 0;
    let weightedHueY = 0;
    let weightedSat = 0;
    for (const { hsl, illumination } of coloredMoons) {
      const moonHue = hsl[0] * 360;
      const rad = (moonHue * Math.PI) / 180;
      weightedHueX += Math.cos(rad) * illumination;
      weightedHueY += Math.sin(rad) * illumination;
      weightedSat += hsl[1] * illumination;
      totalWeight += illumination;
    }
    hue = Math.round(((Math.atan2(weightedHueY, weightedHueX) * 180) / Math.PI + 360) % 360);
    intensity = Math.min(0.5, (weightedSat / totalWeight) * 0.55);
  }

  const luminosity = Math.min(0.25, totalIllumination * 0.5);
  return { reduction: Math.min(0.3, totalReduction), hue, intensity, luminosity };
}

/**
 * Calculate time-of-day environment color based on solar position.
 * Returns hue/intensity/luminosity values that shift through dawn/day/dusk/night.
 * @param {number} currentHour - Current hour (decimal)
 * @param {number} hoursPerDay - Hours per day
 * @param {number|null} [sunrise] - Sunrise hour (decimal)
 * @param {number|null} [sunset] - Sunset hour (decimal)
 * @param {object|null} colorShift - Per-zone color shift overrides
 * @param {number} [minutesPerHour] - Minutes per hour for transition calculation
 * @returns {{ hue: number, intensity: number, luminosity: number }} Time-based color values
 */
export function calculateTimeOfDayColor(currentHour, hoursPerDay, sunrise = null, sunset = null, colorShift = null, minutesPerHour = 60) {
  const dawn = { hue: colorShift?.dawnHue ?? 30, intensity: 0.25, luminosity: 0.05 };
  const midday = { hue: 45, intensity: 0.3, luminosity: 0.15 };
  const dusk = { hue: colorShift?.duskHue ?? 15, intensity: 0.25, luminosity: 0.0 };
  const night = { hue: colorShift?.nightHue ?? 220, intensity: 0.12, luminosity: -0.1 };
  const transitionMinutes = colorShift?.transitionMinutes ?? 60;
  const transitionHours = transitionMinutes / minutesPerHour;
  const blend = (a, b, t) => ({ hue: lerpHue(a.hue, b.hue, t), intensity: lerp(a.intensity, b.intensity, t), luminosity: lerp(a.luminosity, b.luminosity, t) });
  if (sunrise == null || sunset == null) {
    const mid = hoursPerDay / 2;
    const quarter = hoursPerDay / 4;
    if (currentHour >= quarter && currentHour < mid) return blend(dawn, midday, (currentHour - quarter) / (mid - quarter));
    if (currentHour >= mid && currentHour < mid + quarter) return blend(midday, dusk, (currentHour - mid) / quarter);
    return { ...night };
  }

  const preDawn = sunrise - transitionHours;
  const mid = sunrise + (sunset - sunrise) / 2;
  const postDusk = sunset + transitionHours;
  if (currentHour >= preDawn && currentHour < sunrise) return blend(night, dawn, (currentHour - preDawn) / transitionHours);
  if (currentHour >= sunrise && currentHour < mid) return blend(dawn, midday, (currentHour - sunrise) / (mid - sunrise));
  if (currentHour >= mid && currentHour < sunset) return blend(midday, dusk, (currentHour - mid) / (sunset - mid));
  if (currentHour >= sunset && currentHour < postDusk) return blend(dusk, night, (currentHour - sunset) / transitionHours);
  return { ...night };
}

/**
 * Linear interpolation between two values.
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Circular hue interpolation — takes shortest path around 360° wheel.
 * @param {number} a - Start hue (0-360)
 * @param {number} b - End hue (0-360)
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated hue (0-360)
 */
function lerpHue(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  let diff = b - a;
  if (diff > 180) diff -= 360;
  else if (diff < -180) diff += 360;
  return (((a + diff * t) % 360) + 360) % 360;
}

/**
 * Calculate environment lighting overrides from time-of-day, climate zone, and weather.
 * @param {object} [scene] - The scene to check for climate zone override
 * @returns {{base: {hue: number|null, intensity: number|null, luminosity: number|null}, dark: {hue: number|null, intensity: number|null, luminosity: number|null}}|null} - environment config
 */
export function calculateEnvironmentLighting(scene) {
  const colorShiftSync = game.settings.get(MODULE.ID, SETTINGS.COLOR_SHIFT_SYNC);
  const activeZone = WeatherManager.getActiveZone?.(null, scene);
  const currentWeather = WeatherManager.getCurrentWeather?.(null, scene);
  let base = { hue: null, intensity: null, luminosity: null };
  let dark = { hue: null, intensity: null, luminosity: null };
  if (colorShiftSync) {
    const calendar = game.time.calendar;
    const components = game.time.components;
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
    const currentHour = (components?.hour ?? 0) + (components?.minute ?? 0) / minutesPerHour;
    const sunrise = calendar?.sunrise?.(components, activeZone) ?? null;
    const sunset = calendar?.sunset?.(components, activeZone) ?? null;
    const colorShift = activeZone?.colorShift ?? null;
    const timeColor = calculateTimeOfDayColor(currentHour, hoursPerDay, sunrise, sunset, colorShift, minutesPerHour);
    base = { hue: timeColor.hue, intensity: timeColor.intensity, luminosity: timeColor.luminosity };
    dark = { hue: timeColor.hue, intensity: timeColor.intensity, luminosity: timeColor.luminosity };
  }

  const moonSync = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_MOON_SYNC);
  if (moonSync) {
    const baseDarkness = getCurrentDarkness();
    if (baseDarkness > 0.5) {
      const moonResult = calculateMoonIllumination(baseDarkness);
      if (moonResult.hue != null) {
        dark.hue = moonResult.hue;
        dark.intensity = moonResult.intensity;
      }
      if (moonResult.luminosity > 0) dark.luminosity = Math.max(dark.luminosity ?? -0.1, (dark.luminosity ?? -0.1) + moonResult.luminosity);
    }
  }

  if (activeZone?.environmentBase?.hue != null) base.hue = activeZone.environmentBase.hue;
  if (activeZone?.environmentDark?.hue != null) dark.hue = activeZone.environmentDark.hue;
  const deferToFx = currentWeather?.fxPreset && isFXMasterActive();
  if (!deferToFx) {
    if (currentWeather?.environmentBase?.hue != null) base.hue = currentWeather.environmentBase.hue;
    if (currentWeather?.environmentDark?.hue != null) dark.hue = currentWeather.environmentDark.hue;
  }
  const hasValues = base.hue !== null || base.intensity !== null || dark.hue !== null || dark.intensity !== null;
  if (!hasValues) return null;
  return { base, dark };
}

/**
 * Build environment lighting update data for a scene.
 * @param {object} _scene - The scene to get update data for (unused, kept for future per-scene overrides)
 * @param {{base: {hue: number|null, intensity: number|null, luminosity: number|null}, dark: {hue: number|null, intensity: number|null, luminosity: number|null}}|null} lighting - Lighting overrides
 * @returns {object|null} Update data object, or null if no updates needed
 */
function buildEnvironmentUpdateData(_scene, lighting) {
  if (!CalendariaSocket.isPrimaryGM()) return null;
  const ambienceSync = game.settings.get(MODULE.ID, SETTINGS.AMBIENCE_SYNC);
  if (!ambienceSync) return null;
  if (!lighting) {
    return { 'environment.base.intensity': 0, 'environment.base.luminosity': 0, 'environment.dark.intensity': 0, 'environment.dark.luminosity': -0.25 };
  }
  const updateData = {};
  if (lighting.base.hue !== null) updateData['environment.base.hue'] = lighting.base.hue / 360;
  if (lighting.base.intensity !== null) updateData['environment.base.intensity'] = lighting.base.intensity;
  if (lighting.base.luminosity !== null) updateData['environment.base.luminosity'] = lighting.base.luminosity;
  if (lighting.dark.hue !== null) updateData['environment.dark.hue'] = lighting.dark.hue / 360;
  if (lighting.dark.intensity !== null) updateData['environment.dark.intensity'] = lighting.dark.intensity;
  if (lighting.dark.luminosity !== null) updateData['environment.dark.luminosity'] = lighting.dark.luminosity;
  return Object.keys(updateData).length > 0 ? updateData : null;
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
  const weatherFxDisabled = app.document.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED) ?? false;
  const formGroup = await foundry.applications.handlebars.renderTemplate(TEMPLATES.PARTIALS.SCENE_DARKNESS_SYNC, {
    moduleId: MODULE.ID,
    flagName: SCENE_FLAGS.DARKNESS_SYNC,
    brightnessFlag: SCENE_FLAGS.BRIGHTNESS_MULTIPLIER,
    hudHideFlag: SCENE_FLAGS.HUD_HIDE_FOR_PLAYERS,
    climateZoneFlag: SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE,
    weatherFxFlag: SCENE_FLAGS.WEATHER_FX_DISABLED,
    value,
    brightnessMultiplier,
    hudHideForPlayers,
    climateZoneOverride,
    climateZones,
    weatherFxDisabled
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
 * @param {number} dt - The time delta in seconds
 */
export async function updateDarknessFromWorldTime(worldTime, dt) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  const calendar = game.time.calendar;
  const components = game.time.components ?? calendar?.timeToComponents(worldTime);
  const currentHour = components?.hour ?? 0;
  if (lastHour !== null && lastHour === currentHour) return;
  lastHour = currentHour;
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
  const secondsPerHour = (calendar?.days?.secondsPerMinute ?? 60) * minutesPerHour;
  const animateDarkness = Math.abs(dt) < secondsPerHour;
  for (const scene of getDarknessScenes()) {
    const zone = WeatherManager.getActiveZone?.(null, scene);
    const sunrise = calendar?.sunrise?.(components, zone) ?? null;
    const sunset = calendar?.sunset?.(components, zone) ?? null;
    const baseDarkness = calculateDarknessFromTime(currentHour, 0, hoursPerDay, minutesPerHour, sunrise, sunset);
    const darkness = calculateAdjustedDarkness(baseDarkness, scene);
    const lighting = calculateEnvironmentLighting(scene);
    const envData = buildEnvironmentUpdateData(scene, lighting);
    const updateData = { 'environment.darknessLevel': darkness, ...envData };
    await scene.update(updateData, { animateDarkness });
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
 * Handle moon phase change to recalculate darkness across synced scenes.
 */
export async function onMoonPhaseChange() {
  if (!CalendariaSocket.isPrimaryGM()) return;
  lastHour = null;
  await updateDarknessFromWorldTime(game.time.worldTime, 0);
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
    const lighting = calculateEnvironmentLighting(scene);
    const envData = buildEnvironmentUpdateData(scene, lighting);
    const updateData = { 'environment.darknessLevel': darkness, ...envData };
    await scene.update(updateData);
  }
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
  const lighting = calculateEnvironmentLighting(scene);
  const envData = buildEnvironmentUpdateData(scene, lighting);
  const updateData = { 'environment.darknessLevel': darkness, ...envData };
  await scene.update(updateData, { animateDarkness: true });
  log(3, `Scene activated, transitioning darkness to ${darkness.toFixed(3)}`);
}
