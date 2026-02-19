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

/** Currently active FXMaster preset name for stop-before-play. */
let activeFxName = null;

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
 * Reads directly from FXMaster's live registry.
 * Returns objects sorted alphabetically by localized label.
 * @returns {{value: string, label: string}[]} Preset options
 */
export function getAvailableFxPresets() {
  const fxApi = getFxApi();
  const names = fxApi?.list?.() ?? [];
  return names.map((name) => ({ value: name, label: localize(`CALENDARIA.FxPreset.${name}`) })).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
}

/**
 * Extract the Calendaria-managed preset name from scene FXMaster flags.
 * Looks for keys matching `apiPreset_<name>_p<n>` or `apiPreset_<name>_f<n>`.
 * @param {object} [scene] - Scene document (defaults to active scene)
 * @returns {string|null} Preset name or null
 */
function getPresetFromSceneFlags(scene) {
  scene ??= game.scenes?.active;
  if (!scene) return null;
  const effects = scene.getFlag('fxmaster', 'effects') ?? {};
  const filters = scene.getFlag('fxmaster', 'filters') ?? {};
  const allKeys = [...Object.keys(effects), ...Object.keys(filters)];
  for (const key of allKeys) {
    const match = key.match(/^apiPreset_(.+?)_[pf]\d+$/);
    if (match) return match[1];
  }
  return null;
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

  // Restore activeFxName from scene flags (FXMaster already replayed from them)
  const scene = canvas?.scene;
  const restoredName = getPresetFromSceneFlags(scene);

  if (restoredName) {
    // FXMaster already restored its own effects from scene flags — just track the name
    activeFxName = restoredName;

    // Check if it matches current weather; if not, clear and play correct preset
    const WeatherManager = game.modules.get(MODULE.ID)?.api?.WeatherManager ?? globalThis.CALENDARIA?.WeatherManager;
    const weather = WeatherManager?.getCurrentWeather?.();
    const expectedFx = weather?.fxPreset || weather?.id || null;
    if (expectedFx !== restoredName) {
      stopThenPlay(weather || null);
    }
  } else {
    // No preset on scene — play current weather if any
    syncWeatherToScene();
  }
}

/**
 * On canvas ready, sync FXMaster state with current weather.
 * Always clears and replays to ensure a clean state.
 */
function onCanvasReady() {
  syncWeatherToScene();
}

/**
 * Sync current weather to the active scene's FXMaster state.
 * Stops any active preset and plays the current weather's preset.
 */
function syncWeatherToScene() {
  if (!CalendariaSocket.isPrimaryGM()) return;
  const scene = canvas?.scene;
  if (!scene) return;

  // Check scene suppression
  if (scene.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    stopThenPlay(null);
    return;
  }

  const WeatherManager = game.modules.get(MODULE.ID)?.api?.WeatherManager ?? globalThis.CALENDARIA?.WeatherManager;
  const weather = WeatherManager?.getCurrentWeather?.();

  // Always clear and replay — stop previous, start current (or just stop if no weather)
  stopThenPlay(weather || null);
}

/**
 * Check if a preset's effects exist in the scene's FXMaster flags.
 * @param {string} fxName - FXMaster preset name
 * @param {object} scene - Scene document
 * @returns {boolean} Whether the preset's effects are on the scene
 */
// eslint-disable-next-line no-unused-vars
function isPresetOnScene(fxName, scene) {
  const effects = scene.getFlag('fxmaster', 'effects') ?? {};
  const filters = scene.getFlag('fxmaster', 'filters') ?? {};
  const safe = fxName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '-');
  const prefix = `apiPreset_${safe}_`;
  return Object.keys(effects).some((k) => k.startsWith(prefix)) || Object.keys(filters).some((k) => k.startsWith(prefix));
}

/**
 * Handle weather change events — stop previous preset, play new one.
 * @param {object} payload - Weather change hook payload
 * @param {object} [payload.previous] - Previous weather state
 * @param {object} [payload.current] - Current weather state
 * @param {string} [payload.zoneId] - Climate zone ID
 * @param {boolean} [payload.bulk] - Bulk weather update (day change, etc.)
 */
function onWeatherChange({ previous, current, zoneId: _zoneId, bulk } = {}) {
  if (!CalendariaSocket.isPrimaryGM()) return;

  // For bulk updates, resolve current weather from the manager
  if (bulk) {
    const WeatherManager = game.modules.get(MODULE.ID)?.api?.WeatherManager ?? globalThis.CALENDARIA?.WeatherManager;
    if (!WeatherManager) return;
    const weather = WeatherManager.getCurrentWeather();
    if (!weather) {
      stopThenPlay(null);
      return;
    }
    stopThenPlay(weather);
    return;
  }

  // Check scene suppression
  const scene = game.scenes?.active;
  if (scene?.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    stopThenPlay(null);
    return;
  }

  if (previous || !current) {
    stopThenPlay(current);
  } else if (current) {
    stopThenPlay(current);
  }
}

/**
 * Stop the active preset (awaiting completion), then play the new one.
 * @param {object|null} weather - Weather to play, or null to just stop
 */
async function stopThenPlay(weather) {
  const fxApi = getFxApi();
  if (!fxApi) return;

  if (activeFxName) {
    await fxApi.stop(activeFxName);
    activeFxName = null;
  }

  if (!weather) return;
  const fxName = weather.fxPreset || weather.id;
  if (!fxName) return;

  const options = buildPresetOptions(weather);
  const success = await fxApi.play(fxName, options);
  if (success) activeFxName = fxName;
}

/**
 * Build options object for FXMaster preset playback.
 * @param {object} weather - Current weather state
 * @returns {object} Options for FXMaster play()
 */
function buildPresetOptions(weather) {
  const options = {};

  // Wind direction
  if (weather.wind?.direction != null) options.direction = weather.wind.direction;

  // Top-down mode from settings
  if (game.settings.get(MODULE.ID, SETTINGS.FXMASTER_TOP_DOWN)) options.topDown = true;

  // Below tokens from settings
  if (game.settings.get(MODULE.ID, SETTINGS.FXMASTER_BELOW_TOKENS)) options.belowTokens = true;

  // Sound FX from settings (requires FXMaster+)
  if (game.settings.get(MODULE.ID, SETTINGS.FXMASTER_SOUND_FX) && isFXMasterPlusActive()) options.soundFx = true;

  return options;
}
