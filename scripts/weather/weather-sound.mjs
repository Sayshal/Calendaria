/**
 * Weather Sound Manager
 * @module Weather/WeatherSound
 * @author Tyler
 */

import { HOOKS, MODULE, SCENE_FLAGS, SETTINGS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import WeatherManager from './weather-manager.mjs';

/** Crossfade duration in milliseconds. */
const FADE_MS = 2000;

/** @type {object|null} Currently playing weather ambient sound. */
let activeSound = null;

/** @type {string|null} SoundFx key of the currently playing sound (for dedup). */
let activeSoundKey = null;

/**
 * Initialize weather sound hooks.
 */
export function initializeWeatherSound() {
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.on('canvasReady', onCanvasReady);
  Hooks.on('updateScene', onSceneUpdate);
  const weather = WeatherManager.getCurrentWeather();
  playSound(weather || null);
  log(3, 'WeatherSound initialized');
}

/**
 * On scene update, re-sync sound if the weather disable flag changed.
 * @param {object} scene - Updated scene document
 * @param {object} change - Flattened change data
 */
function onSceneUpdate(scene, change) {
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
  await sound.fade(0, { duration: FADE_MS });
  sound.stop();
}

/**
 * Check if weather sound is disabled for a scene (per-scene flag or FX disabled).
 * @param {object} [scene] - Scene document
 * @returns {boolean} Whether sound is disabled
 */
function isSoundDisabledForScene(scene) {
  if (!scene) return false;
  return scene.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED) || scene.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_SOUND_DISABLED);
}

/**
 * Play the ambient sound loop for the current weather with crossfade.
 * @param {object|null} weather - Current weather state
 */
async function playSound(weather) {
  if (!game.settings.get(MODULE.ID, SETTINGS.WEATHER_SOUND_FX) || !game.settings.get(MODULE.ID, SETTINGS.FXMASTER_ENABLED)) {
    stopSound();
    return;
  }
  const soundKey = weather?.soundFx || null;
  if (soundKey === activeSoundKey && activeSound?.playing) return;
  const oldSound = activeSound;
  if (oldSound) fadeOutAndStop(oldSound);
  activeSound = null;
  activeSoundKey = null;
  if (!soundKey) return;
  const src = `modules/${MODULE.ID}/assets/sound/${soundKey}.ogg`;
  try {
    const sound = await game.audio.play(src, { loop: true, volume: 0, context: game.audio.environment });
    const volume = game.settings.get(MODULE.ID, SETTINGS.WEATHER_SOUND_VOLUME) ?? 0.5;
    sound.fade(volume, { duration: FADE_MS });
    activeSound = sound;
    activeSoundKey = soundKey;
    log(3, `Playing "${soundKey}"`);
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
