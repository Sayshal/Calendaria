/**
 * FXMaster Integration
 * Bridges Calendaria weather presets to FXMaster particle/filter effects.
 * @module Integrations/FXMaster
 * @author Tyler
 */

import { COMPASS_DIRECTIONS, HOOKS, MODULE, SCENE_FLAGS, SETTINGS } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';

/** Reverse lookup: degree value → lowercase cardinal string for FXMaster direction option. */
const DEGREES_TO_CARDINAL = Object.fromEntries(Object.entries(COMPASS_DIRECTIONS).map(([name, deg]) => [deg, name.toLowerCase()]));

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

  const restoredName = getActivePreset(canvas?.scene);
  log(1, `[FXMaster init] restoredName=${restoredName}`);
  if (restoredName) {
    const WeatherManager = game.modules.get(MODULE.ID)?.api?.WeatherManager ?? globalThis.CALENDARIA?.WeatherManager;
    const weather = WeatherManager?.getCurrentWeather?.();
    const expectedFx = weather?.fxPreset || null;
    log(1, `[FXMaster init] expectedFx=${expectedFx}, match=${expectedFx === restoredName}`);
    if (expectedFx !== restoredName) {
      playWeather(weather || null);
    }
  } else {
    log(1, '[FXMaster init] no active preset, syncing');
    syncWeatherToScene();
  }
}

/**
 * On canvas ready, sync FXMaster state with current weather.
 */
function onCanvasReady() {
  log(1, '[FXMaster] canvasReady fired');
  syncWeatherToScene();
}

/**
 * Sync current weather to the active scene's FXMaster state.
 */
function syncWeatherToScene() {
  if (!CalendariaSocket.isPrimaryGM()) {
    log(1, '[FXMaster sync] not primary GM, skipping');
    return;
  }
  const scene = canvas?.scene;
  if (!scene) {
    log(1, '[FXMaster sync] no canvas scene');
    return;
  }

  if (scene.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    log(1, '[FXMaster sync] FX disabled on scene, stopping all');
    stopAll();
    return;
  }

  const WeatherManager = game.modules.get(MODULE.ID)?.api?.WeatherManager ?? globalThis.CALENDARIA?.WeatherManager;
  const weather = WeatherManager?.getCurrentWeather?.();
  log(1, `[FXMaster sync] weather.id=${weather?.id}, fxPreset=${weather?.fxPreset}`);
  playWeather(weather || null);
}

/**
 * Handle weather change events.
 * @param {object} payload - Weather change hook payload
 * @param payload.current
 * @param payload.zoneId
 * @param payload.bulk
 */
function onWeatherChange({ current, zoneId: _zoneId, bulk } = {}) {
  if (!CalendariaSocket.isPrimaryGM()) return;

  if (bulk) {
    const WeatherManager = game.modules.get(MODULE.ID)?.api?.WeatherManager ?? globalThis.CALENDARIA?.WeatherManager;
    if (!WeatherManager) return;
    const weather = WeatherManager.getCurrentWeather();
    log(1, `[FXMaster onChange] bulk=true, weather.id=${weather?.id}, fxPreset=${weather?.fxPreset}`);
    playWeather(weather || null);
    return;
  }

  const scene = game.scenes?.active;
  if (scene?.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    log(1, '[FXMaster onChange] FX disabled on scene, stopping all');
    stopAll();
    return;
  }

  log(1, `[FXMaster onChange] current.id=${current?.id}, fxPreset=${current?.fxPreset}`);
  playWeather(current || null);
}

/**
 * Stop all active presets on the current scene.
 */
async function stopAll() {
  const fxApi = getFxApi();
  if (!fxApi) {
    log(1, '[FXMaster stopAll] no fxApi');
    return;
  }
  const active = fxApi.listActive?.() ?? [];
  log(1, `[FXMaster stopAll] active presets: ${JSON.stringify(active)}`);
  for (const name of active) {
    log(1, `[FXMaster stopAll] stopping "${name}"`);
    await fxApi.stop(name);
  }
}

/**
 * Play the weather preset, stopping any others via switch().
 * @param {object|null} weather - Weather to play, or null to just stop
 */
async function playWeather(weather) {
  const fxApi = getFxApi();
  if (!fxApi) {
    log(1, '[FXMaster playWeather] no fxApi');
    return;
  }

  const fxName = weather?.fxPreset || null;
  log(1, `[FXMaster playWeather] weather.id=${weather?.id}, fxName=${fxName}`);

  if (!fxName) {
    log(1, '[FXMaster playWeather] no fxPreset, calling stopAll');
    await stopAll();
    return;
  }

  const available = fxApi.list?.() ?? [];
  if (!available.includes(fxName)) {
    log(1, `[FXMaster playWeather] "${fxName}" not in available presets, skipping`);
    return;
  }

  const options = buildPresetOptions(weather);
  log(1, `[FXMaster playWeather] calling switch("${fxName}", ${JSON.stringify(options)})`);
  await fxApi.switch(fxName, options);
}

/**
 * Convert a degree value to the nearest cardinal direction string for FXMaster.
 * @param {number} degrees - Direction in degrees (0-360)
 * @returns {string} Lowercase cardinal direction (e.g. "n", "nne", "sw")
 */
function degreesToCardinal(degrees) {
  if (DEGREES_TO_CARDINAL[degrees] !== undefined) return DEGREES_TO_CARDINAL[degrees];
  let closest = 'n';
  let minDiff = 360;
  for (const [deg, name] of Object.entries(DEGREES_TO_CARDINAL)) {
    const diff = Math.abs(((degrees - Number(deg) + 540) % 360) - 180);
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
  if (game.settings.get(MODULE.ID, SETTINGS.FXMASTER_SOUND_FX) && isFXMasterPlusActive()) options.soundFx = true;

  return options;
}
