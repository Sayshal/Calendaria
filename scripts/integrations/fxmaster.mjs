import { HOOKS, MODULE, SCENE_FLAGS, SETTINGS } from '../constants.mjs';
import { CalendariaSocket, localize, log } from '../utils/_module.mjs';
import { WeatherManager } from '../weather/_module.mjs';

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
 * On scene update, re-sync FX if the weather disable flag changed or scene activated.
 * @param {object} scene - Updated scene document
 * @param {object} change - Change data
 */
function onSceneUpdate(scene, change) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  if (change.active) {
    syncWeatherToScene(scene);
    return;
  }
  if (scene !== canvas?.scene) return;
  const flat = foundry.utils.flattenObject(change);
  const fxDisabledKey = `flags.${MODULE.ID}.${SCENE_FLAGS.WEATHER_FX_DISABLED}`;
  const topDownKey = `flags.${MODULE.ID}.${SCENE_FLAGS.FXMASTER_TOP_DOWN_OVERRIDE}`;
  if (!(fxDisabledKey in flat) && !(topDownKey in flat)) return;
  syncWeatherToScene();
}

/**
 * Sync current weather to a scene's FXMaster state.
 * @param {object} [sceneOverride] - Scene to sync for (defaults to canvas scene)
 */
function syncWeatherToScene(sceneOverride) {
  if (!CalendariaSocket.isPrimaryGM()) return;
  const scene = sceneOverride ?? canvas?.scene;
  if (!scene) return;
  if (!game.settings.get(MODULE.ID, SETTINGS.FXMASTER_ENABLED) || scene.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    stopAllFX();
    return;
  }
  const weather = WeatherManager.getCurrentWeather(null, scene);
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
    const scene = game.scenes?.active;
    if (!game.settings.get(MODULE.ID, SETTINGS.FXMASTER_ENABLED) || scene?.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
      stopAllFX();
      return;
    }
    const weather = WeatherManager.getCurrentWeather();
    playWeather(weather || null);
    return;
  }
  if (!game.settings.get(MODULE.ID, SETTINGS.FXMASTER_ENABLED)) {
    stopAllFX();
    return;
  }
  const scene = game.scenes?.active;
  if (scene?.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    stopAllFX();
    return;
  }
  playWeather(current || null);
}

/**
 * Stop all active FXMaster presets on the current scene.
 * @returns {Promise<void>}
 */
export async function stopAllFX() {
  const fxApi = getFxApi();
  if (!fxApi) return;
  const active = fxApi.listActive?.() ?? [];
  for (const name of active) await fxApi.stop(name, { silent: true });
  log(3, 'FXMaster effects stopped');
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
    await stopAllFX();
    return;
  }
  const available = fxApi.listValid();
  if (!available.includes(fxName)) {
    log(2, `FXMaster Preset "${fxName}" not available, stopping active effects`);
    await stopAllFX();
    return;
  }
  const options = buildPresetOptions(weather);
  options.silent = true;
  await fxApi.switch(fxName, options);
  log(3, `FXMaster playing weather: ${fxName}`);
}

/**
 * Convert a degree value to the nearest 8-point cardinal direction for FXMaster.
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
 * Clamp a "blow toward" direction so particles always fall mostly downward.
 * @param {number} blowDeg - Direction particles move toward (0-360, 180=south/downward)
 * @param {number} [maxAngle] - Maximum deviation from south in degrees
 * @returns {number} Clamped direction in degrees
 */
function clampToDownward(blowDeg, maxAngle = 45) {
  const offset = ((blowDeg - 180 + 540) % 360) - 180;
  if (Math.abs(offset) <= maxAngle) return blowDeg;
  const ew = Math.sin((blowDeg * Math.PI) / 180);
  return (180 - ew * maxAngle + 360) % 360;
}

/**
 * Build options object for FXMaster preset playback.
 * @param {object} weather - Current weather state
 * @returns {object} Options for FXMaster play/switch
 */
function buildPresetOptions(weather) {
  const options = {};
  const sceneTopDown = canvas?.scene?.getFlag(MODULE.ID, SCENE_FLAGS.FXMASTER_TOP_DOWN_OVERRIDE);
  const useTopDown = sceneTopDown === 'topdown' || (sceneTopDown !== 'sideview' && game.settings.get(MODULE.ID, SETTINGS.FXMASTER_TOP_DOWN));
  const forceDownward = !useTopDown || game.settings.get(MODULE.ID, SETTINGS.FXMASTER_FORCE_DOWNWARD);
  if (weather.wind?.direction != null) {
    let blowDeg = (weather.wind.direction + 180) % 360;
    if (forceDownward) blowDeg = clampToDownward(blowDeg);
    options.direction = degreesToCardinal(blowDeg);
  }
  if (useTopDown) options.topDown = true;
  if (game.settings.get(MODULE.ID, SETTINGS.FXMASTER_BELOW_TOKENS)) options.belowTokens = true;
  if (weather.fxDensity) options.density = weather.fxDensity;
  if (weather.fxSpeed) options.speed = weather.fxSpeed;
  if (weather.fxColor) options.color = weather.fxColor;
  if (game.settings.get(MODULE.ID, SETTINGS.FXMASTER_SOUND_FX)) options.soundFx = true;
  return options;
}

/**
 * Play an FXMaster preset with custom options, independent of weather state.
 * @param {string} presetName - FXMaster preset name (e.g., "rain", "snow", "fog")
 * @param {object} [options] - FXMaster preset options
 * @param {string} [options.density] - Particle density
 * @param {string} [options.speed] - Particle speed
 * @param {string} [options.color] - Tint color
 * @param {string} [options.direction] - Cardinal direction (n, ne, e, se, s, sw, w, nw)
 * @param {boolean} [options.topDown] - Top-down particle view
 * @param {boolean} [options.belowTokens] - Render below token layer
 * @returns {Promise<boolean>} True if FX started successfully
 */
export async function playStandaloneFX(presetName, options = {}) {
  if (!isFXMasterActive()) {
    log(2, localize('CALENDARIA.Weather.Error.FXMasterInactive'));
    return false;
  }
  const fxApi = getFxApi();
  if (!fxApi) return false;
  if (!game.settings.get(MODULE.ID, SETTINGS.FXMASTER_ENABLED)) {
    log(2, localize('CALENDARIA.Weather.Error.FXDisabled'));
    return false;
  }
  const scene = canvas?.scene;
  if (scene?.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    log(2, localize('CALENDARIA.Weather.Error.FXDisabled'));
    return false;
  }
  const available = fxApi.listValid?.() ?? [];
  if (!available.includes(presetName)) {
    ui.notifications.warn(localize('CALENDARIA.Weather.Error.FXPresetInvalid', { name: presetName }));
    return false;
  }
  const fxOptions = { ...options, silent: true };
  try {
    await fxApi.switch(presetName, fxOptions);
    log(3, `FXMaster standalone playing: ${presetName}`);
    return true;
  } catch (error) {
    log(1, 'FXMaster standalone playback failed:', error);
    return false;
  }
}
