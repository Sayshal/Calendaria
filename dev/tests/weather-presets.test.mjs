/**
 * Tests for weather-presets.mjs
 * Covers: getPreset, getAllPresets, getPresetsByCategory,
 * getPresetAlias/setPresetAlias, data integrity.
 * @module Tests/WeatherPresets
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  SETTINGS: { WEATHER_PRESET_ALIASES: 'weatherPresetAliases' }
}));

import {
  ALL_PRESETS,
  STANDARD_WEATHER,
  SEVERE_WEATHER,
  ENVIRONMENTAL_WEATHER,
  FANTASY_WEATHER,
  WEATHER_CATEGORIES,
  HUD_EFFECTS,
  SOUND_FX_OPTIONS,
  getPreset,
  getAllPresets,
  getPresetsByCategory,
  getPresetAlias,
  setPresetAlias
} from '../../scripts/weather/data/weather-presets.mjs';

/* -------------------------------------------- */
/*  Data Integrity                               */
/* -------------------------------------------- */

describe('Weather Preset Data Integrity', () => {
  it('ALL_PRESETS combines all categories', () => {
    const expected = STANDARD_WEATHER.length + SEVERE_WEATHER.length + ENVIRONMENTAL_WEATHER.length + FANTASY_WEATHER.length;
    expect(ALL_PRESETS.length).toBe(expected);
  });

  it('all presets have unique IDs', () => {
    const ids = ALL_PRESETS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all presets have required fields', () => {
    for (const preset of ALL_PRESETS) {
      expect(preset.id, `${preset.id} missing id`).toBeDefined();
      expect(preset.label, `${preset.id} missing label`).toBeDefined();
      expect(preset.icon, `${preset.id} missing icon`).toBeDefined();
      expect(preset.color, `${preset.id} missing color`).toBeDefined();
      expect(preset.category, `${preset.id} missing category`).toBeDefined();
      expect(preset.wind, `${preset.id} missing wind`).toBeDefined();
      expect(preset.precipitation, `${preset.id} missing precipitation`).toBeDefined();
      expect(typeof preset.chance, `${preset.id} chance not number`).toBe('number');
      expect(typeof preset.darknessPenalty, `${preset.id} darknessPenalty not number`).toBe('number');
    }
  });

  it('all presets have valid category values', () => {
    const validCategories = Object.keys(WEATHER_CATEGORIES);
    for (const preset of ALL_PRESETS) {
      expect(validCategories, `${preset.id} has invalid category "${preset.category}"`).toContain(preset.category);
    }
  });

  it('all presets have valid hex colors', () => {
    const hexRegex = /^#[\dA-Fa-f]{6}$/;
    for (const preset of ALL_PRESETS) {
      expect(hexRegex.test(preset.color), `${preset.id} has invalid color "${preset.color}"`).toBe(true);
    }
  });

  it('all preset hudEffects are in HUD_EFFECTS list', () => {
    for (const preset of ALL_PRESETS) {
      if (preset.hudEffect) {
        expect(HUD_EFFECTS, `${preset.id} has unknown hudEffect "${preset.hudEffect}"`).toContain(preset.hudEffect);
      }
    }
  });

  it('all preset soundFx values are valid or null', () => {
    for (const preset of ALL_PRESETS) {
      if (preset.soundFx) {
        expect(SOUND_FX_OPTIONS, `${preset.id} has unknown soundFx "${preset.soundFx}"`).toContain(preset.soundFx);
      }
    }
  });

  it('standard weather has expected count', () => {
    expect(STANDARD_WEATHER.length).toBeGreaterThanOrEqual(10);
  });

  it('HUD_EFFECTS has expected entries', () => {
    expect(HUD_EFFECTS.length).toBeGreaterThan(20);
    expect(HUD_EFFECTS).toContain('clear');
    expect(HUD_EFFECTS).toContain('rain');
    expect(HUD_EFFECTS).toContain('snow');
  });

  it('WEATHER_CATEGORIES has required categories', () => {
    expect(WEATHER_CATEGORIES).toHaveProperty('standard');
    expect(WEATHER_CATEGORIES).toHaveProperty('severe');
    expect(WEATHER_CATEGORIES).toHaveProperty('environmental');
    expect(WEATHER_CATEGORIES).toHaveProperty('fantasy');
    expect(WEATHER_CATEGORIES).toHaveProperty('custom');
  });
});

/* -------------------------------------------- */
/*  getPreset                                    */
/* -------------------------------------------- */

describe('getPreset()', () => {
  it('finds a built-in preset by ID', () => {
    const preset = getPreset('clear');
    expect(preset).not.toBeNull();
    expect(preset.id).toBe('clear');
  });

  it('returns null for unknown ID', () => {
    expect(getPreset('nonexistent')).toBeNull();
  });

  it('finds a custom preset when provided', () => {
    const custom = [{ id: 'custom-1', label: 'Custom' }];
    const result = getPreset('custom-1', custom);
    expect(result).not.toBeNull();
    expect(result.id).toBe('custom-1');
  });

  it('prefers built-in over custom with same ID', () => {
    const custom = [{ id: 'clear', label: 'Custom Clear' }];
    const result = getPreset('clear', custom);
    expect(result.label).toBe('CALENDARIA.Weather.Clear'); // built-in
  });
});

/* -------------------------------------------- */
/*  getAllPresets                                 */
/* -------------------------------------------- */

describe('getAllPresets()', () => {
  it('returns all built-in presets when no customs', () => {
    const all = getAllPresets();
    expect(all.length).toBe(ALL_PRESETS.length);
  });

  it('includes custom presets', () => {
    const custom = [{ id: 'custom-1' }, { id: 'custom-2' }];
    const all = getAllPresets(custom);
    expect(all.length).toBe(ALL_PRESETS.length + 2);
  });
});

/* -------------------------------------------- */
/*  getPresetsByCategory                         */
/* -------------------------------------------- */

describe('getPresetsByCategory()', () => {
  it('returns only standard presets for standard category', () => {
    const standard = getPresetsByCategory('standard');
    expect(standard.length).toBe(STANDARD_WEATHER.length);
    for (const p of standard) expect(p.category).toBe('standard');
  });

  it('returns only severe presets for severe category', () => {
    const severe = getPresetsByCategory('severe');
    expect(severe.length).toBe(SEVERE_WEATHER.length);
  });

  it('returns empty for unknown category', () => {
    expect(getPresetsByCategory('unknown').length).toBe(0);
  });

  it('includes custom presets in their category', () => {
    const custom = [{ id: 'c1', category: 'custom' }];
    const result = getPresetsByCategory('custom', custom);
    expect(result.length).toBe(1);
  });
});

/* -------------------------------------------- */
/*  getPresetAlias / setPresetAlias              */
/* -------------------------------------------- */

describe('getPresetAlias()', () => {
  beforeEach(() => {
    game.settings.get.mockReturnValue({});
  });

  it('returns null when no aliases exist', () => {
    expect(getPresetAlias('clear', 'gregorian', 'temperate')).toBeNull();
  });

  it('returns alias when scoped to calendar and zone', () => {
    game.settings.get.mockReturnValue({
      gregorian: { temperate: { clear: 'Sunny' } }
    });
    expect(getPresetAlias('clear', 'gregorian', 'temperate')).toBe('Sunny');
  });

  it('returns null when missing calendarId or zoneId', () => {
    expect(getPresetAlias('clear')).toBeNull();
    expect(getPresetAlias('clear', 'cal')).toBeNull();
  });
});

describe('setPresetAlias()', () => {
  beforeEach(() => {
    game.settings.get.mockReturnValue({});
    game.settings.set.mockResolvedValue(true);
  });

  it('sets an alias', async () => {
    await setPresetAlias('clear', 'Sunny', 'cal1', 'zone1');
    expect(game.settings.set).toHaveBeenCalledWith('calendaria', 'weatherPresetAliases', expect.objectContaining({ cal1: { zone1: { clear: 'Sunny' } } }));
  });

  it('removes alias when null', async () => {
    game.settings.get.mockReturnValue({ cal1: { zone1: { clear: 'Sunny' } } });
    await setPresetAlias('clear', null, 'cal1', 'zone1');
    const setCall = game.settings.set.mock.calls[0][2];
    expect(setCall.cal1).toBeUndefined();
  });

  it('does nothing without calendarId or zoneId', async () => {
    await setPresetAlias('clear', 'Sunny');
    expect(game.settings.set).not.toHaveBeenCalled();
  });

  it('trims whitespace from alias', async () => {
    await setPresetAlias('clear', '  Sunny  ', 'cal1', 'zone1');
    const setCall = game.settings.set.mock.calls[0][2];
    expect(setCall.cal1.zone1.clear).toBe('Sunny');
  });
});
