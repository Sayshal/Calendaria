import { beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS } from '../../scripts/constants.mjs';
import { buildPresetOptions } from '../../scripts/integrations/fxmaster.mjs';

/** Setting values used by buildPresetOptions, overridable per test. */
let settingValues = {};

/**
 * Build a minimal weather state for option derivation.
 * @param {object} [overrides] - Fields to merge over the defaults
 * @returns {object} Weather state
 */
function weatherState(overrides = {}) {
  return { wind: { speed: 2, direction: null }, precipitation: { type: 'snow', intensity: 0.5 }, ...overrides };
}

describe('FXMaster preset options', () => {
  beforeEach(() => {
    globalThis.canvas = { scene: null };
    settingValues = { [SETTINGS.FXMASTER_SPEED_MULTIPLIER]: 1 };
    game.settings.get.mockImplementation((_module, key) => settingValues[key]);
  });

  it('treats moderate wind and moderate intensity as no change', () => {
    const options = buildPresetOptions(weatherState());
    expect(options.speed).toBe(1);
    expect(options.density).toBe(1);
  });

  it('scales speed with wind speed', () => {
    expect(buildPresetOptions(weatherState({ wind: { speed: 0 } })).speed).toBe(0.5);
    expect(buildPresetOptions(weatherState({ wind: { speed: 5 } })).speed).toBe(1.75);
  });

  it('scales density with precipitation intensity', () => {
    expect(buildPresetOptions(weatherState({ precipitation: { type: 'snow', intensity: 0 } })).density).toBe(0.5);
    expect(buildPresetOptions(weatherState({ precipitation: { type: 'snow', intensity: 1 } })).density).toBe(1.5);
  });

  it('leaves density unchanged when the weather has no precipitation', () => {
    expect(buildPresetOptions(weatherState({ precipitation: { type: null, intensity: 0 } })).density).toBe(1);
  });

  it('multiplies the derived values by the explicit FX overrides', () => {
    const options = buildPresetOptions(weatherState({ fxSpeed: 'high', fxDensity: 'very-high' }));
    expect(options.speed).toBe(1.5);
    expect(options.density).toBe(2);
  });

  it('slows rather than freezes particles at the very-low level', () => {
    const options = buildPresetOptions(weatherState({ fxSpeed: 'very-low', fxDensity: 'very-low' }));
    expect(options.speed).toBeGreaterThan(0);
    expect(options.density).toBeGreaterThan(0);
  });

  it('applies the global speed multiplier on top', () => {
    settingValues[SETTINGS.FXMASTER_SPEED_MULTIPLIER] = 2;
    expect(buildPresetOptions(weatherState()).speed).toBe(2);
  });
});
