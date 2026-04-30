import { HOOKS, MODULE, SCENE_FLAGS, SETTINGS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import { expandLegacySoundKey } from './data/weather-presets.mjs';
import WeatherManager from './weather-manager.mjs';

/** Crossfade duration in milliseconds. */
const FADE_MS = 2000;

/** @type {object|null} Currently playing weather ambient sound. */
let activeSound = null;

/** @type {string|null} Full path of the currently playing sound (for dedup). */
let activeSoundKey = null;

/**
 * Initialize weather sound hooks.
 */
export function initializeWeatherSound() {
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.on('canvasReady', onCanvasReady);
  Hooks.on('updateScene', onSceneUpdate);
  if (!isSoundDisabledForScene(canvas?.scene)) {
    const weather = WeatherManager.getCurrentWeather();
    playSound(weather || null);
  }
  log(3, 'WeatherSound initialized');
}

/**
 * On scene update, re-sync sound if the weather disable flag changed or scene activated.
 * @param {object} scene - Updated scene document
 * @param {object} change - Change data
 */
function onSceneUpdate(scene, change) {
  if (change.active) {
    if (isSoundDisabledForScene(scene)) {
      stopSound();
    } else {
      const weather = WeatherManager.getCurrentWeather(null, scene);
      playSound(weather || null);
    }
    return;
  }
  if (scene !== canvas?.scene) return;
  const flat = foundry.utils.flattenObject(change);
  const fxKey = `flags.${MODULE.ID}.${SCENE_FLAGS.WEATHER_FX_DISABLED}`;
  const soundKey = `flags.${MODULE.ID}.${SCENE_FLAGS.WEATHER_SOUND_DISABLED}`;
  if (!(fxKey in flat) && !(soundKey in flat)) return;
  if (isSoundDisabledForScene(scene)) {
    stopSound();
  } else {
    const weather = WeatherManager.getCurrentWeather();
    playSound(weather || null);
  }
}

/**
 * Handle canvas ready — sync sound to the new scene's weather.
 */
function onCanvasReady() {
  const scene = canvas?.scene;
  if (!scene) return;
  if (isSoundDisabledForScene(scene)) {
    stopSound();
    return;
  }
  const weather = WeatherManager.getCurrentWeather();
  playSound(weather || null);
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
  if (bulk) {
    const weather = WeatherManager.getCurrentWeather();
    playSound(weather || null);
    return;
  }
  const scene = game.scenes?.active;
  if (isSoundDisabledForScene(scene)) {
    stopSound();
    return;
  }
  playSound(current || null);
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
 * Check if weather sound is disabled for a scene (per-scene flag or FX disabled).
 * @param {object} [scene] - Scene document
 * @returns {boolean} Whether sound is disabled
 */
function isSoundDisabledForScene(scene) {
  if (!scene) return false;
  return scene.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_SOUND_DISABLED) || scene.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED);
}

/**
 * Play the ambient sound loop for the current weather with crossfade.
 * @param {object|null} weather - Current weather state
 */
async function playSound(weather) {
  if (!game.settings.get(MODULE.ID, SETTINGS.WEATHER_SOUND_FX)) {
    stopSound();
    return;
  }
  if (game.audio.locked) {
    game.audio.awaitFirstGesture().then(() => playSound(weather));
    return;
  }
  const soundKey = weather?.soundFx || null;
  const src = expandLegacySoundKey(soundKey);
  if (src === activeSoundKey && activeSound?.playing) return;
  const oldSound = activeSound;
  activeSound = null;
  activeSoundKey = null;
  if (oldSound) await fadeOutAndStop(oldSound);
  if (!src) return;
  try {
    const sound = await game.audio.play(src, { loop: true, volume: 0, context: game.audio.environment });
    const volume = game.settings.get(MODULE.ID, SETTINGS.WEATHER_SOUND_VOLUME) ?? 0.5;
    sound.fade(volume, { duration: FADE_MS });
    activeSound = sound;
    activeSoundKey = src;
    log(3, `Playing "${src}"`);
  } catch (error) {
    log(1, 'Weather sound playback failed:', error);
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
    log(3, `Stopping "${stoppingKey}"`);
    try {
      await fadeOutAndStop(sound);
    } catch (error) {
      log(1, 'Weather sound stop failed:', error);
    }
  }
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
    log(2, 'Weather sounds are disabled');
    return false;
  }
  if (isSoundDisabledForScene(canvas?.scene)) {
    log(2, 'Weather sounds are disabled for this scene');
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
    log(3, `Standalone playing "${src}"`);
    return true;
  } catch (error) {
    log(1, 'Standalone sound playback failed:', error);
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
  log(3, `Standalone stopping "${stoppingKey}"`);
  try {
    const fadeDuration = options.fade ?? FADE_MS;
    await sound.fade(0, { duration: fadeDuration });
    sound.stop();
    return true;
  } catch (error) {
    log(1, 'Standalone sound stop failed:', error);
    return false;
  }
}
