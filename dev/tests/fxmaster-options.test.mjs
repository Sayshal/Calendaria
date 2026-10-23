import { beforeEach, describe, expect, it } from 'vitest';
import { SCENE_FLAGS, SETTINGS } from '../../scripts/constants.mjs';
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

/**
 * Build a scene stub returning the given Calendaria flags.
 * @param {object} [flags] - Flag values keyed by scene flag
 * @returns {object} Scene stub
 */
function sceneWithFlags(flags = {}) {
  return { getFlag: (_module, key) => flags[key] };
}

describe('FXMaster background and token trails', () => {
  beforeEach(() => {
    globalThis.canvas = { scene: null };
    settingValues = { [SETTINGS.FXMASTER_SPEED_MULTIPLIER]: 1 };
    game.settings.get.mockImplementation((_module, key) => settingValues[key]);
  });

  it('drops token trails when the background is off', () => {
    settingValues[SETTINGS.FXMASTER_BACKGROUND] = false;
    settingValues[SETTINGS.FXMASTER_TOKEN_TRAILS] = true;
    const options = buildPresetOptions(weatherState(), sceneWithFlags());
    expect(options.background).toBe(false);
    expect(options.tokenTrails).toBe(false);
  });

  it('passes both when background and token trails are on', () => {
    settingValues[SETTINGS.FXMASTER_BACKGROUND] = true;
    settingValues[SETTINGS.FXMASTER_TOKEN_TRAILS] = true;
    const options = buildPresetOptions(weatherState(), sceneWithFlags());
    expect(options.background).toBe(true);
    expect(options.tokenTrails).toBe(true);
  });

  it('lets a scene override enable the background over the global setting', () => {
    settingValues[SETTINGS.FXMASTER_BACKGROUND] = false;
    settingValues[SETTINGS.FXMASTER_TOKEN_TRAILS] = true;
    const options = buildPresetOptions(weatherState(), sceneWithFlags({ [SCENE_FLAGS.FXMASTER_BACKGROUND_OVERRIDE]: 'on' }));
    expect(options.background).toBe(true);
    expect(options.tokenTrails).toBe(true);
  });

  it('drops token trails when a scene override disables the background', () => {
    settingValues[SETTINGS.FXMASTER_BACKGROUND] = true;
    settingValues[SETTINGS.FXMASTER_TOKEN_TRAILS] = true;
    const options = buildPresetOptions(weatherState(), sceneWithFlags({ [SCENE_FLAGS.FXMASTER_BACKGROUND_OVERRIDE]: 'off' }));
    expect(options.background).toBe(false);
    expect(options.tokenTrails).toBe(false);
  });

  it('reads overrides from the passed scene rather than the canvas scene', () => {
    settingValues[SETTINGS.FXMASTER_BACKGROUND] = false;
    globalThis.canvas = { scene: sceneWithFlags({ [SCENE_FLAGS.FXMASTER_BACKGROUND_OVERRIDE]: 'on' }) };
    expect(buildPresetOptions(weatherState(), sceneWithFlags()).background).toBe(false);
    expect(buildPresetOptions(weatherState()).background).toBe(true);
  });
});
