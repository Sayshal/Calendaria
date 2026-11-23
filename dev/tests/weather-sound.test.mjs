import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WeatherManager from '../../scripts/weather/weather-manager.mjs';

vi.mock('../../scripts/weather/weather-manager.mjs', () => ({ default: { getCurrentWeather: vi.fn(() => null), getActiveZone: vi.fn(() => null) } }));

const SRC = (key) => `modules/calendaria/assets/sound/${key}.ogg`;

/** @type {object[]} Every sound created by the mocked audio helper. */
let sounds;

/**
 * Build a fake Foundry Sound whose fade resolves on the next macrotask.
 * @param {string} src - Sound source path
 * @returns {object} Fake sound
 */
function makeSound(src) {
  const sound = { src, playing: true, fade: vi.fn(() => new Promise((resolve) => setTimeout(resolve, 5))), stop: vi.fn(() => (sound.playing = false)) };
  sounds.push(sound);
  return sound;
}

/** Let queued transitions settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

/** Sources of sounds that are still playing. */
const playing = () => sounds.filter((s) => s.playing).map((s) => s.src);

let weatherSound;

beforeEach(async () => {
  vi.resetModules();
  sounds = [];
  globalThis.canvas = { scene: null, tokens: { controlled: [], placeables: [] } };
  game.settings.get.mockImplementation((_module, key) => (key === 'weatherSoundFx' ? true : 0.5));
  game.audio = { locked: false, environment: {}, play: vi.fn(async (src) => makeSound(src)), awaitFirstGesture: vi.fn() };
  weatherSound = await import('../../scripts/weather/weather-sound.mjs');
});

afterEach(() => {
  delete globalThis.canvas;
});

describe('weather sound transitions', () => {
  it('leaves exactly one loop when changes overlap the crossfade', async () => {
    WeatherManager.getCurrentWeather.mockReturnValue({ soundFx: 'rain' });
    weatherSound.refreshWeatherSound();
    await settle();
    WeatherManager.getCurrentWeather.mockReturnValue({ soundFx: 'thunderstorm' });
    weatherSound.refreshWeatherSound();
    WeatherManager.getCurrentWeather.mockReturnValue({ soundFx: 'snow' });
    weatherSound.refreshWeatherSound();
    await settle();
    expect(playing()).toEqual([SRC('snow')]);
  });

  it('queues a single unlock wait and plays current weather once audio unlocks', async () => {
    let unlock;
    game.audio.locked = true;
    game.audio.awaitFirstGesture.mockReturnValue(new Promise((resolve) => (unlock = resolve)));
    WeatherManager.getCurrentWeather.mockReturnValue({ soundFx: 'rain' });
    weatherSound.refreshWeatherSound();
    weatherSound.refreshWeatherSound();
    weatherSound.refreshWeatherSound();
    await settle();
    expect(game.audio.awaitFirstGesture).toHaveBeenCalledTimes(1);
    game.audio.locked = false;
    WeatherManager.getCurrentWeather.mockReturnValue({ soundFx: 'snow' });
    unlock();
    await settle();
    expect(playing()).toEqual([SRC('snow')]);
  });

  it('serializes standalone play and stop with weather changes', async () => {
    WeatherManager.getCurrentWeather.mockReturnValue({ soundFx: 'rain' });
    weatherSound.refreshWeatherSound();
    const started = weatherSound.playStandaloneSound('custom.ogg');
    const stopped = weatherSound.stopStandaloneSound();
    expect(await started).toBe(true);
    expect(await stopped).toBe(true);
    expect(playing()).toEqual([]);
  });
});
