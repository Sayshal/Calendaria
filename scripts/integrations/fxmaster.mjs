/**
 * FXMaster Integration
 * Bridges Calendaria weather presets to FXMaster particle/filter effects.
 * @module Integrations/FXMaster
 * @author Tyler
 */

import { HOOKS, MODULE, SCENE_FLAGS, SETTINGS } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';
import WeatherManager from '../weather/weather-manager.mjs';

/** 8-point cardinal directions accepted by FXMaster, keyed by compass degrees. */
const FXMASTER_CARDINALS = [
  [0, 'n'],
  [45, 'ne'],
  [90, 'e'],
  [135, 'se'],
  [180, 's'],
  [225, 'sw'],
  [270, 'w'],
  [315, 'nw']
];

/**
 * Get the FXMaster API object.
 * @returns {object|null} FXMaster presets API or null
 */
function getFxApi() {
  return globalThis.FXMASTER?.api?.presets ?? game.modules.get('fxmaster')?.api?.presets ?? null;
}

/**
 * Check if the FXMaster module is installed and active.
 * @returns {boolean} Whether FXMaster is active
 */
export function isFXMasterActive() {
  return game.modules.get('fxmaster')?.active ?? false;
}

/**
 * Check if FXMaster+ (premium) is installed and active.
 * @returns {boolean} Whether FXMaster+ is active
 */
export function isFXMasterPlusActive() {
  return game.modules.get('fxmaster-plus')?.active ?? false;
}

/**
 * Get the list of available FXMaster presets for dropdown selection.
 * Uses listValid() to only return presets valid for this world.
 * @returns {{value: string, label: string}[]} Preset options sorted alphabetically
 */
export function getAvailableFxPresets() {
  const fxApi = getFxApi();
  const names = fxApi?.listValid?.() ?? fxApi?.list?.() ?? [];
  return names.map((name) => ({ value: name, label: localize(`CALENDARIA.FxPreset.${name}`) })).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
}

/**
 * Get the currently active FXMaster preset name on a scene.
 * @param {object} [scene] - Scene document (defaults to canvas scene)
 * @returns {string|null} Active preset name or null
 */
function getActivePreset(scene) {
  const fxApi = getFxApi();
  if (!fxApi?.listActive) return null;
  const opts = scene ? { scene: scene.uuid } : {};
  const active = fxApi.listActive(opts);
  return active?.[0] ?? null;
}

/**
 * Initialize FXMaster integration.
 * Called from calendaria.mjs on the ready hook.
 */
export function initializeFXMaster() {
  if (!isFXMasterActive()) return;
  log(3, 'FXMaster detected, registering weather change handler');
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.on('canvasReady', onCanvasReady);
  Hooks.on('updateScene', onSceneUpdate);

  const restoredName = getActivePreset(canvas?.scene);
  if (restoredName) {
    const weather = WeatherManager.getCurrentWeather();
    const expectedFx = weather?.fxPreset || null;
    if (expectedFx !== restoredName) playWeather(weather || null);
  } else {
    syncWeatherToScene();
  }
}

/**
 * On canvas ready, sync FXMaster state with current weather.
 */
function onCanvasReady() {
  syncWeatherToScene();
}

/**
 * On scene update, re-sync FX if the weather disable flag changed.
 * @param {object} scene - Updated scene document
 * @param {object} change - Flattened change data
 */
function onSceneUpdate(scene, change) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  if (scene !== canvas?.scene) return;
  const flagKey = `flags.${MODULE.ID}.${SCENE_FLAGS.WEATHER_FX_DISABLED}`;
  if (!(flagKey in foundry.utils.flattenObject(change))) return;
  syncWeatherToScene();
}

/**
 * Sync current weather to the active scene's FXMaster state.
 */
function syncWeatherToScene() {
  if (!CalendariaSocket.isPrimaryGM()) return;
  const scene = canvas?.scene;
  if (!scene) return;

  if (scene.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    stopAll();
    return;
  }

  const weather = WeatherManager.getCurrentWeather();
  playWeather(weather || null);
}

/**
 * Handle weather change events.
 * @param {object} payload - Weather change hook payload
 * @param {object|null} payload.current - Current weather data
 * @param {string|null} payload.zoneId - Active zone ID
 * @param {boolean} payload.bulk - Whether this is a bulk weather change
 * @param {boolean} payload.visualOnly - Whether this is a visual-only refresh (skip FX)
 */
function onWeatherChange({ current, zoneId: _zoneId, bulk, visualOnly } = {}) {
  if (visualOnly) return;
  if (!CalendariaSocket.isPrimaryGM()) return;

  if (bulk) {
    const weather = WeatherManager.getCurrentWeather();
    playWeather(weather || null);
    return;
  }

  const scene = game.scenes?.active;
  if (scene?.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    stopAll();
    return;
  }

  playWeather(current || null);
}

/**
 * Stop all active presets on the current scene.
 */
async function stopAll() {
  const fxApi = getFxApi();
  if (!fxApi) return;
  const active = fxApi.listActive?.() ?? [];
  for (const name of active) await fxApi.stop(name, { silent: true });
}

/**
 * Play the weather preset, stopping any others via switch().
 * @param {object|null} weather - Weather to play, or null to just stop
 */
async function playWeather(weather) {
  const fxApi = getFxApi();
  if (!fxApi) return;

  const fxName = weather?.fxPreset || null;

  if (!fxName) {
    await stopAll();
    return;
  }

  const available = fxApi.listValid();
  if (!available.includes(fxName)) {
    log(2, `FXMaster Preset "${fxName}" not available, stopping active effects`);
    await stopAll();
    return;
  }

  const options = buildPresetOptions(weather);
  options.silent = true;
  await fxApi.switch(fxName, options);
}

/**
 * Convert a degree value to the nearest 8-point cardinal direction for FXMaster.
 * FXMaster only supports n/ne/e/se/s/sw/w/nw; intermediate 16-point directions are snapped.
 * @param {number} degrees - Direction in compass degrees (0-360, 0=north)
 * @returns {string} Lowercase cardinal direction (e.g. "n", "ne", "sw")
 */
function degreesToCardinal(degrees) {
  let closest = 'n';
  let minDiff = 360;
  for (const [deg, name] of FXMASTER_CARDINALS) {
    const diff = Math.abs(((degrees - deg + 540) % 360) - 180);
    if (diff < minDiff) {
      minDiff = diff;
      closest = name;
    }
  }
  return closest;
}

/**
 * Build options object for FXMaster preset playback.
 * @param {object} weather - Current weather state
 * @returns {object} Options for FXMaster play/switch
 */
function buildPresetOptions(weather) {
  const options = {};

  if (weather.wind?.direction != null) options.direction = degreesToCardinal(weather.wind.direction);
  if (game.settings.get(MODULE.ID, SETTINGS.FXMASTER_TOP_DOWN)) options.topDown = true;
  if (game.settings.get(MODULE.ID, SETTINGS.FXMASTER_BELOW_TOKENS)) options.belowTokens = true;

  return options;
}
