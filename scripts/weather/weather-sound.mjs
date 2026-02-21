/**
 * Weather Sound Manager
 * Plays ambient sound loops tied to weather presets via Foundry's AudioHelper.
 * Controlled by the WEATHER_SOUND_FX setting toggle.
 * @module Weather/WeatherSound
 * @author Tyler
 */

import { HOOKS, MODULE, SCENE_FLAGS, SETTINGS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import WeatherManager from './weather-manager.mjs';

/** Crossfade duration in milliseconds. */
const FADE_MS = 2000;

/** Target playback volume (before environment gain). */
const VOLUME = 0.5;

/** @type {Sound|null} Currently playing weather ambient sound. */
let activeSound = null;

/** @type {string|null} SoundFx key of the currently playing sound (for dedup). */
let activeSoundKey = null;

/**
 * Initialize weather sound hooks.
 * Called from calendaria.mjs on the ready hook.
 */
export function initializeWeatherSound() {
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.on('canvasReady', onCanvasReady);

  // Sync sound to current weather on startup
  const weather = WeatherManager.getCurrentWeather();
  playSound(weather || null);
  log(3, 'WeatherSound initialized');
}

/**
 * Handle canvas ready — sync sound to the new scene's weather.
 */
function onCanvasReady() {
  const scene = canvas?.scene;
  if (!scene) return;

  if (scene.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    stopSound();
    return;
  }

  const weather = WeatherManager.getCurrentWeather();
  playSound(weather || null);
}

/**
 * Handle weather change hook — play or stop sound.
 * @param {object} payload - Weather change hook payload
 * @param payload.current
 * @param payload.bulk
 */
function onWeatherChange({ current, bulk } = {}) {
  if (bulk) {
    const weather = WeatherManager.getCurrentWeather();
    playSound(weather || null);
    return;
  }

  const scene = game.scenes?.active;
  if (scene?.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED)) {
    stopSound();
    return;
  }

  playSound(current || null);
}

/**
 * Fade out and stop a sound, then clean up.
 * @param {Sound} sound - The sound to fade out
 */
async function fadeOutAndStop(sound) {
  await sound.fade(0, { duration: FADE_MS });
  sound.stop();
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

  const soundKey = weather?.soundFx || null;

  // Same sound already playing — no-op
  if (soundKey === activeSoundKey && activeSound?.playing) return;

  // Fade out the old sound (fire-and-forget so new sound overlaps)
  const oldSound = activeSound;
  if (oldSound) fadeOutAndStop(oldSound);

  activeSound = null;
  activeSoundKey = null;

  if (!soundKey) return;

  const src = `modules/${MODULE.ID}/assets/sound/${soundKey}.ogg`;
  const sound = await game.audio.play(src, { loop: true, volume: 0, context: game.audio.environment });
  sound.fade(VOLUME, { duration: FADE_MS });
  activeSound = sound;
  activeSoundKey = soundKey;
  log(3, `[Sound] Playing "${soundKey}"`);
}

/**
 * Fade out and stop the currently playing weather sound.
 */
async function stopSound() {
  if (activeSound) {
    const sound = activeSound;
    activeSound = null;
    activeSoundKey = null;
    log(3, `[Sound] Stopping "${activeSoundKey}"`);
    await fadeOutAndStop(sound);
  }
}
