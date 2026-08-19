import { HOOKS, MODULE, SCENE_FLAGS, SETTINGS } from '../constants.mjs';
import { resolveWeatherSoundPath } from './data/weather-presets.mjs';
import WeatherManager from './weather-manager.mjs';

/** Crossfade duration in milliseconds. */
const FADE_MS = 2000;

/** @type {object|null} Currently playing weather ambient sound. */
let activeSound = null;

/** @type {string|null} Full path of the currently playing sound (for dedup). */
let activeSoundKey = null;

/** @type {boolean} Whether the current client is inside a core SuppressWeather region, muting Calendaria's audio. */
let suppressedByRegion = false;

/** @type {Set<object>} Cached scene regions with an active `suppressWeather` behavior. */
let suppressRegions = new Set();

/** @type {Set<object>} Cached tokens whose actor the current user owns, used when nothing is actively controlled. */
let ownedTokens = new Set();

/**
 * Initialize weather sound hooks.
 */
export function initializeWeatherSound() {
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.on('canvasReady', onCanvasReady);
  Hooks.on('updateScene', onSceneUpdate);
  for (const hook of ['createRegion', 'updateRegion', 'deleteRegion', 'createRegionBehavior', 'updateRegionBehavior', 'deleteRegionBehavior']) {
    Hooks.on(hook, () => {
      rebuildSuppressRegions();
      applyRegionSuppression();
    });
  }
  for (const hook of ['createToken', 'deleteToken', 'updateToken']) {
    Hooks.on(hook, () => {
      rebuildOwnedTokens();
      applyRegionSuppression();
    });
  }
  Hooks.on('controlToken', applyRegionSuppression);
  Hooks.on('refreshToken', onRefreshToken);
  rebuildSuppressRegions();
  rebuildOwnedTokens();
  playSound(WeatherManager.getCurrentWeather() || null);
  ATLAS.log(3, 'WeatherSound initialized');
}

/** Rebuild the cached set of regions whose `suppressWeather` behavior is active on the current scene. */
function rebuildSuppressRegions() {
  suppressRegions = new Set();
  const scene = canvas?.scene;
  if (!scene) return;
  for (const region of scene.regions) if (region.behaviors.some((b) => b.type === 'suppressWeather' && !b.disabled)) suppressRegions.add(region);
}

/** Rebuild the cached set of placed tokens whose actor the current user owns. */
function rebuildOwnedTokens() {
  ownedTokens = new Set();
  if (!canvas?.tokens) return;
  for (const t of canvas.tokens.placeables) if (t.actor?.isOwner) ownedTokens.add(t);
}

/**
 * Return true when any of the current user's relevant tokens is inside a cached suppress-weather region.
 * @returns {boolean} True when a relevant token is inside any cached suppress-weather region
 */
function isInsideSuppressWeatherRegion() {
  if (!suppressRegions.size) return false;
  const controlled = canvas.tokens.controlled;
  const tokens = controlled.length ? controlled : ownedTokens;
  if ((tokens.size ?? tokens.length) === 0) return false;
  for (const region of suppressRegions) {
    for (const token of tokens) {
      const c = token.center;
      if (!c) continue;
      if (region.testPoint({ x: c.x, y: c.y, elevation: token.document?.elevation ?? 0 })) return true;
    }
  }
  return false;
}

/**
 * Resolve the target playback volume, muffled while a relevant token sits in a suppress-weather region.
 * @returns {number} Volume in the 0-1 range
 */
function targetVolume() {
  const baseVolume = game.settings.get(MODULE.ID, SETTINGS.WEATHER_SOUND_VOLUME) ?? 0.5;
  const muffle = game.settings.get(MODULE.ID, SETTINGS.WEATHER_SUPPRESS_MUFFLE) ?? 0;
  return suppressedByRegion ? baseVolume * muffle : baseVolume;
}

/**
 * Refresh suppression state and fade the active sound to/from silence when it changes.
 */
function applyRegionSuppression() {
  if (!activeSound) return;
  const next = isInsideSuppressWeatherRegion();
  if (next === suppressedByRegion) return;
  suppressedByRegion = next;
  activeSound.fade(targetVolume(), { duration: FADE_MS });
}

/**
 * Per-frame token refresh handler — only triggers suppression checks for tokens the user actually cares about.
 * @param {object} token - The refreshing token placeable
 */
function onRefreshToken(token) {
  if (!activeSound || !suppressRegions.size) return;
  const controlled = canvas.tokens.controlled;
  const relevant = controlled.length ? controlled.includes(token) : ownedTokens.has(token);
  if (!relevant) return;
  applyRegionSuppression();
}

/**
 * On scene update, re-sync sound if the weather sound flag changed or scene activated.
 * @param {object} scene - Updated scene document
 * @param {object} change - Change data
 */
function onSceneUpdate(scene, change) {
  if (change.active) {
    playSound(WeatherManager.getCurrentWeather(null, scene) || null);
    return;
  }
  if (scene !== canvas?.scene) return;
  const soundKey = `flags.${MODULE.ID}.${SCENE_FLAGS.WEATHER_SOUND_DISABLED}`;
  if (!(soundKey in foundry.utils.flattenObject(change))) return;
  playSound(WeatherManager.getCurrentWeather() || null);
}

/**
 * Handle canvas ready — sync sound to the new scene's weather.
 */
function onCanvasReady() {
  rebuildSuppressRegions();
  rebuildOwnedTokens();
  suppressedByRegion = false;
  if (!canvas?.scene) return;
  playSound(WeatherManager.getCurrentWeather() || null);
}

/**
 * Handle weather change hook — play or stop sound.
 * @param {object} payload - Weather change hook payload
 * @param {object|null} payload.current - Current weather data
 * @param {boolean} payload.bulk - Whether this is a bulk weather change
 * @param {boolean} payload.visualOnly - Whether this is a visual-only refresh (skip sound)
 */
function onWeatherChange({ current, bulk, visualOnly } = {}) {
  if (visualOnly) return;
  playSound((bulk ? WeatherManager.getCurrentWeather() : current) || null);
}

/**
 * Fade out and stop a sound, then clean up.
 * @param {object} sound - The sound to fade out
 */
async function fadeOutAndStop(sound) {
  try {
    await sound.fade(0, { duration: FADE_MS });
  } finally {
    sound.stop();
  }
}

/**
 * Check if weather sound is disabled for a scene.
 * @param {object} [scene] - Scene document
 * @returns {boolean} Whether sound is disabled
 */
function isSoundDisabledForScene(scene) {
  if (!scene) return false;
  return Boolean(scene.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_SOUND_DISABLED));
}

/**
 * Play the ambient sound loop for the current weather with crossfade.
 * @param {object|null} weather - Current weather state
 */
async function playSound(weather) {
  if (!game.settings.get(MODULE.ID, SETTINGS.WEATHER_SOUND_FX) || isSoundDisabledForScene(canvas?.scene)) {
    stopSound();
    return;
  }
  if (game.audio.locked) {
    game.audio.awaitFirstGesture().then(() => playSound(weather));
    return;
  }
  const soundKey = weather?.soundFx || null;
  const src = resolveWeatherSoundPath(soundKey);
  if (src === activeSoundKey && activeSound?.playing) return;
  const oldSound = activeSound;
  activeSound = null;
  activeSoundKey = null;
  if (oldSound) await fadeOutAndStop(oldSound);
  if (!src) return;
  try {
    const sound = await game.audio.play(src, { loop: true, volume: 0, context: game.audio.environment });
    suppressedByRegion = isInsideSuppressWeatherRegion();
    sound.fade(targetVolume(), { duration: FADE_MS });
    activeSound = sound;
    activeSoundKey = src;
    ATLAS.log(3, `Playing "${src}"${suppressedByRegion ? ' (suppressed by region)' : ''}`);
  } catch (error) {
    ATLAS.log(1, 'Weather sound playback failed:', error);
  }
}

/**
 * Fade out and stop the currently playing weather sound.
 */
async function stopSound() {
  if (activeSound) {
    const stoppingKey = activeSoundKey;
    const sound = activeSound;
    activeSound = null;
    activeSoundKey = null;
    ATLAS.log(3, `Stopping "${stoppingKey}"`);
    try {
      await fadeOutAndStop(sound);
    } catch (error) {
      ATLAS.log(1, 'Weather sound stop failed:', error);
    }
  }
}

/** Re-apply the world sound settings to the current scene, starting, stopping, or re-levelling the ambience as needed. */
export function refreshWeatherSound() {
  if (activeSound) activeSound.fade(targetVolume(), { duration: FADE_MS });
  playSound(WeatherManager.getCurrentWeather() || null);
}

/**
 * Play an arbitrary audio file as the weather sound with crossfade.
 * @param {string} src - Foundry audio path (e.g., "modules/my-mod/sounds/rain.ogg")
 * @param {object} [options] - Playback options
 * @param {number} [options.volume] - Volume override (0-1, defaults to Weather Sound Volume setting)
 * @param {number} [options.fade] - Fade-in duration in ms (default: 2000)
 * @param {boolean} [options.loop] - Loop playback (default: true)
 * @param {object} [options.context] - Audio context override (default: game.audio.environment)
 * @returns {Promise<boolean>} True if playback started successfully
 */
export async function playStandaloneSound(src, options = {}) {
  if (!game.settings.get(MODULE.ID, SETTINGS.WEATHER_SOUND_FX)) {
    ATLAS.log(2, 'Weather sounds are disabled');
    return false;
  }
  if (isSoundDisabledForScene(canvas?.scene)) {
    ATLAS.log(2, 'Weather sounds are disabled for this scene');
    return false;
  }
  if (game.audio.locked) {
    game.audio.awaitFirstGesture().then(() => playStandaloneSound(src, options));
    return false;
  }
  if (src === activeSoundKey && activeSound?.playing) return true;
  const oldSound = activeSound;
  activeSound = null;
  activeSoundKey = null;
  if (oldSound) await fadeOutAndStop(oldSound);
  const fadeDuration = options.fade ?? FADE_MS;
  try {
    const sound = await game.audio.play(src, { loop: options.loop ?? true, volume: 0, context: options.context ?? game.audio.environment });
    const volume = options.volume ?? game.settings.get(MODULE.ID, SETTINGS.WEATHER_SOUND_VOLUME) ?? 0.5;
    sound.fade(volume, { duration: fadeDuration });
    activeSound = sound;
    activeSoundKey = src;
    ATLAS.log(3, `Standalone playing "${src}"`);
    return true;
  } catch (error) {
    ATLAS.log(1, 'Standalone sound playback failed:', error);
    return false;
  }
}

/**
 * Stop the current weather sound with configurable fade-out.
 * @param {object} [options] - Stop options
 * @param {number} [options.fade] - Fade-out duration in ms (default: 2000)
 * @returns {Promise<boolean>} True if a sound was stopped
 */
export async function stopStandaloneSound(options = {}) {
  if (!activeSound) return false;
  const stoppingKey = activeSoundKey;
  const sound = activeSound;
  activeSound = null;
  activeSoundKey = null;
  ATLAS.log(3, `Standalone stopping "${stoppingKey}"`);
  try {
    const fadeDuration = options.fade ?? FADE_MS;
    await sound.fade(0, { duration: fadeDuration });
    sound.stop();
    return true;
  } catch (error) {
    ATLAS.log(1, 'Standalone sound stop failed:', error);
    return false;
  }
}
