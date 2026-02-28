/**
 * Tests for darkness.mjs
 * Covers: calculateDarknessFromTime, calculateTimeOfDayColor,
 * calculateAdjustedDarkness, calculateMoonIllumination.
 * @module Tests/Darkness
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/utils/socket.mjs', () => ({
  CalendariaSocket: { isPrimaryGM: vi.fn(() => true), emit: vi.fn() }
}));
vi.mock('../../scripts/weather/weather-manager.mjs', () => ({
  default: {
    getActiveZone: vi.fn(() => null),
    getCurrentWeather: vi.fn(() => null),
    getCalendarZones: vi.fn(() => [])
  }
}));
vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  SETTINGS: {
    DEFAULT_BRIGHTNESS_MULTIPLIER: 'defaultBrightnessMultiplier',
    DARKNESS_MOON_SYNC: 'darknessMoonSync',
    DARKNESS_WEATHER_SYNC: 'darknessWeatherSync',
    COLOR_SHIFT_SYNC: 'colorShiftSync',
    AMBIENCE_SYNC: 'ambienceSync',
    DARKNESS_SYNC: 'darknessSync',
    DARKNESS_SYNC_ALL_SCENES: 'darknessSyncAllScenes'
  },
  SCENE_FLAGS: {
    BRIGHTNESS_MULTIPLIER: 'brightnessMultiplier',
    DARKNESS_SYNC: 'darknessSync',
    HUD_HIDE_FOR_PLAYERS: 'hudHideForPlayers',
    CLIMATE_ZONE_OVERRIDE: 'climateZoneOverride',
    WEATHER_FX_DISABLED: 'weatherFxDisabled'
  },
  TEMPLATES: { PARTIALS: { SCENE_DARKNESS_SYNC: '' } },
  SOCKET_TYPES: { HUD_VISIBILITY: 'hudVisibility' }
}));
vi.mock('../../scripts/utils/formatting/moon-utils.mjs', () => ({
  getMoonPhasePosition: vi.fn(() => 0.5)
}));

import { calculateDarknessFromTime, calculateTimeOfDayColor, calculateAdjustedDarkness, calculateMoonIllumination } from '../../scripts/time/darkness.mjs';
import WeatherManager from '../../scripts/weather/weather-manager.mjs';
import { getMoonPhasePosition } from '../../scripts/utils/formatting/moon-utils.mjs';

/* -------------------------------------------- */
/*  calculateDarknessFromTime — Symmetric cosine */
/* -------------------------------------------- */

describe('calculateDarknessFromTime()', () => {
  it('returns maximum darkness at midnight (hour 0) with no sunrise/sunset', () => {
    const darkness = calculateDarknessFromTime(0, 0, 24, 60);
    expect(darkness).toBeCloseTo(1.0, 1);
  });

  it('returns minimum darkness at midday (hour 12) with no sunrise/sunset', () => {
    const darkness = calculateDarknessFromTime(12, 0, 24, 60);
    expect(darkness).toBeCloseTo(0.0, 1);
  });

  it('returns ~0.5 at quarter day (hour 6) with no sunrise/sunset', () => {
    const darkness = calculateDarknessFromTime(6, 0, 24, 60);
    expect(darkness).toBeCloseTo(0.5, 1);
  });

  it('always returns values clamped to [0, 1]', () => {
    for (let h = 0; h < 24; h++) {
      const d = calculateDarknessFromTime(h, 0, 24, 60);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it('handles non-standard hours per day', () => {
    const darkness = calculateDarknessFromTime(5, 0, 10, 60);
    expect(darkness).toBeCloseTo(0.0, 1); // midday at 5 of 10
  });

  it('handles minutes correctly', () => {
    const d1 = calculateDarknessFromTime(12, 0, 24, 60);
    const d2 = calculateDarknessFromTime(12, 30, 24, 60);
    expect(d2).toBeGreaterThan(d1); // past midday → getting darker
  });

  // With sunrise/sunset
  it('returns low darkness during daytime with sunrise/sunset', () => {
    const darkness = calculateDarknessFromTime(12, 0, 24, 60, 6, 18);
    expect(darkness).toBeLessThan(0.3);
  });

  it('returns high darkness during nighttime with sunrise/sunset', () => {
    const darkness = calculateDarknessFromTime(0, 0, 24, 60, 6, 18);
    expect(darkness).toBeGreaterThan(0.5);
  });

  it('returns low darkness at midday between sunrise and sunset', () => {
    const darkness = calculateDarknessFromTime(12, 0, 24, 60, 6, 18);
    expect(darkness).toBeLessThan(0.15);
  });

  it('calculates correctly at sunrise boundary', () => {
    const darkness = calculateDarknessFromTime(6, 0, 24, 60, 6, 18);
    expect(darkness).toBeLessThanOrEqual(0.5);
  });

  it('calculates correctly at sunset boundary', () => {
    const darkness = calculateDarknessFromTime(18, 0, 24, 60, 6, 18);
    expect(darkness).toBeGreaterThan(0.4);
  });

  it('handles edge case of 0 sunrise, sunset at 24', () => {
    const darkness = calculateDarknessFromTime(12, 0, 24, 60, 0, 24);
    expect(darkness).toBeLessThan(0.15);
  });

  it('handles non-standard minutesPerHour', () => {
    const d1 = calculateDarknessFromTime(12, 0, 24, 100);
    const d2 = calculateDarknessFromTime(12, 50, 24, 100);
    expect(d2).toBeGreaterThan(d1);
  });
});

/* -------------------------------------------- */
/*  calculateTimeOfDayColor                     */
/* -------------------------------------------- */

describe('calculateTimeOfDayColor()', () => {
  it('returns night color at hour 0 with no sunrise/sunset', () => {
    const result = calculateTimeOfDayColor(0, 24);
    expect(result.hue).toBe(220); // default nightHue
  });

  it('returns dawn-midday blend during morning quarter with no sunrise/sunset', () => {
    const result = calculateTimeOfDayColor(9, 24);
    expect(result.hue).toBeGreaterThan(0);
    expect(result.intensity).toBeGreaterThan(0);
  });

  it('returns night at late hours with no sunrise/sunset', () => {
    const result = calculateTimeOfDayColor(23, 24);
    expect(result.hue).toBe(220);
  });

  it('returns dawn blend during pre-dawn with sunrise/sunset', () => {
    const result = calculateTimeOfDayColor(5, 24, 6, 18);
    expect(result.intensity).toBeGreaterThan(0);
  });

  it('returns night after sunset transition', () => {
    const result = calculateTimeOfDayColor(20, 24, 6, 18);
    expect(result.hue).toBe(220);
  });

  it('respects colorShift overrides', () => {
    const colorShift = { dawnHue: 50, duskHue: 300, nightHue: 180, transitionMinutes: 30 };
    const result = calculateTimeOfDayColor(0, 24, 6, 18, colorShift);
    expect(result.hue).toBe(180); // custom nightHue
  });

  it('blends dawn to midday between sunrise and mid', () => {
    const result = calculateTimeOfDayColor(9, 24, 6, 18);
    expect(result.hue).toBeLessThan(30); // between dawn(30) and midday(0)
    expect(result.hue).toBeGreaterThanOrEqual(0);
  });

  it('returns valid hue/intensity/luminosity structure', () => {
    const result = calculateTimeOfDayColor(12, 24, 6, 18);
    expect(result).toHaveProperty('hue');
    expect(result).toHaveProperty('intensity');
    expect(result).toHaveProperty('luminosity');
    expect(typeof result.hue).toBe('number');
  });
});

/* -------------------------------------------- */
/*  calculateAdjustedDarkness                    */
/* -------------------------------------------- */

describe('calculateAdjustedDarkness()', () => {
  beforeEach(() => {
    game.settings.get.mockReturnValue(null);
    WeatherManager.getActiveZone.mockReturnValue(null);
    WeatherManager.getCurrentWeather.mockReturnValue(null);
  });

  it('returns clamped value between 0 and 1', () => {
    game.settings.get.mockReturnValue(1.0);
    const result = calculateAdjustedDarkness(0.5, { getFlag: vi.fn(() => null) });
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('applies scene brightness multiplier', () => {
    game.settings.get.mockImplementation((_module, key) => {
      if (key === 'defaultBrightnessMultiplier') return 1.0;
      return null;
    });
    const scene = { getFlag: vi.fn(() => 2.0) }; // 2x brightness
    const result = calculateAdjustedDarkness(0.5, scene);
    expect(result).toBeLessThan(0.5); // brighter
  });

  it('applies climate brightness multiplier', () => {
    game.settings.get.mockImplementation((_module, key) => {
      if (key === 'defaultBrightnessMultiplier') return 1.0;
      return null;
    });
    WeatherManager.getActiveZone.mockReturnValue({ brightnessMultiplier: 0.5 });
    const scene = { getFlag: vi.fn(() => null) };
    const result = calculateAdjustedDarkness(0.5, scene);
    expect(result).toBeGreaterThan(0.5); // dimmer (less brightness)
  });

  it('applies moon illumination when moonSync enabled', () => {
    game.settings.get.mockImplementation((_module, key) => {
      if (key === 'darknessMoonSync') return true;
      if (key === 'defaultBrightnessMultiplier') return 1.0;
      return null;
    });
    // Set up moon data for illumination calculation
    game.time.calendar = {
      moonsArray: [{ name: 'Luna', cycleLength: 29.5, moonBrightnessMax: 0.15, referenceDate: { year: 2000, month: 0, dayOfMonth: 5 } }],
      days: { hoursPerDay: 24, minutesPerHour: 60 }
    };
    game.time.components = { year: 1, month: 0, dayOfMonth: 0, hour: 0, minute: 0 };
    const scene = { getFlag: vi.fn(() => null) };
    const baseDarkness = 0.8; // nighttime
    const result = calculateAdjustedDarkness(baseDarkness, scene);
    // Moon illumination should reduce darkness
    expect(result).toBeLessThanOrEqual(baseDarkness);
  });

  it('applies weather darkness penalty when weatherSync enabled', () => {
    game.settings.get.mockImplementation((_module, key) => {
      if (key === 'darknessWeatherSync') return true;
      if (key === 'defaultBrightnessMultiplier') return 1.0;
      return null;
    });
    WeatherManager.getCurrentWeather.mockReturnValue({ darknessPenalty: 0.1 });
    const scene = { getFlag: vi.fn(() => null) };
    const result = calculateAdjustedDarkness(0.3, scene);
    expect(result).toBeGreaterThan(0.3); // darker due to weather
  });

  it('uses default brightness multiplier when scene has no override', () => {
    game.settings.get.mockImplementation((_module, key) => {
      if (key === 'defaultBrightnessMultiplier') return 1.5;
      return null;
    });
    const scene = { getFlag: vi.fn(() => null) };
    const result = calculateAdjustedDarkness(0.5, scene);
    expect(result).toBeLessThan(0.5); // brighter from 1.5x multiplier
  });

  it('clamps result when multipliers exceed bounds', () => {
    game.settings.get.mockImplementation((_module, key) => {
      if (key === 'defaultBrightnessMultiplier') return 10.0;
      return null;
    });
    const scene = { getFlag: vi.fn(() => null) };
    const result = calculateAdjustedDarkness(0.5, scene);
    expect(result).toBe(0); // clamped to 0
  });
});

/* -------------------------------------------- */
/*  calculateMoonIllumination                    */
/* -------------------------------------------- */

describe('calculateMoonIllumination()', () => {
  beforeEach(() => {
    game.time.calendar = null;
    game.time.components = { year: 1, month: 0, dayOfMonth: 0, hour: 0, minute: 0, second: 0 };
  });

  it('returns zero reduction when darkness < 0.5 (daytime)', () => {
    const result = calculateMoonIllumination(0.3);
    expect(result.reduction).toBe(0);
    expect(result.hue).toBeNull();
    expect(result.intensity).toBeNull();
    expect(result.luminosity).toBeNull();
  });

  it('returns zero reduction when no calendar moons', () => {
    game.time.calendar = { moonsArray: [] };
    const result = calculateMoonIllumination(0.8);
    expect(result.reduction).toBe(0);
  });

  it('returns zero reduction when calendar has no moonsArray', () => {
    game.time.calendar = {};
    const result = calculateMoonIllumination(0.8);
    expect(result.reduction).toBe(0);
  });

  it('calculates reduction for a full moon at night', () => {
    getMoonPhasePosition.mockReturnValue(0.5); // full moon position
    game.time.calendar = {
      moonsArray: [{ name: 'Luna', cycleLength: 29.5, moonBrightnessMax: 0.15, referenceDate: { year: 0, month: 0, dayOfMonth: 0 } }]
    };
    const result = calculateMoonIllumination(0.8);
    expect(result.reduction).toBeGreaterThan(0);
    expect(result.reduction).toBeLessThanOrEqual(0.3);
  });

  it('caps reduction at 0.3', () => {
    getMoonPhasePosition.mockReturnValue(0.5);
    // Multiple bright moons
    game.time.calendar = {
      moonsArray: [
        { name: 'Moon1', cycleLength: 29.5, moonBrightnessMax: 0.5, referenceDate: { year: 0, month: 0, dayOfMonth: 0 } },
        { name: 'Moon2', cycleLength: 20, moonBrightnessMax: 0.5, referenceDate: { year: 0, month: 0, dayOfMonth: 0 } },
        { name: 'Moon3', cycleLength: 15, moonBrightnessMax: 0.5, referenceDate: { year: 0, month: 0, dayOfMonth: 0 } }
      ]
    };
    const result = calculateMoonIllumination(1.0);
    expect(result.reduction).toBeLessThanOrEqual(0.3);
  });

  it('uses default moonBrightnessMax of 0.15 when not specified', () => {
    getMoonPhasePosition.mockReturnValue(0.5);
    game.time.calendar = {
      moonsArray: [{ name: 'Luna', cycleLength: 29.5, referenceDate: { year: 0, month: 0, dayOfMonth: 0 } }]
    };
    const result = calculateMoonIllumination(0.8);
    expect(result.reduction).toBeGreaterThan(0);
  });

  it('scales reduction with nightFactor (deeper night = more moon effect)', () => {
    getMoonPhasePosition.mockReturnValue(0.5);
    game.time.calendar = {
      moonsArray: [{ name: 'Luna', cycleLength: 29.5, moonBrightnessMax: 0.15, referenceDate: { year: 0, month: 0, dayOfMonth: 0 } }]
    };
    const resultLight = calculateMoonIllumination(0.6);
    const resultDark = calculateMoonIllumination(1.0);
    expect(resultDark.reduction).toBeGreaterThan(resultLight.reduction);
  });

  it('returns no reduction for new moon (position 0)', () => {
    getMoonPhasePosition.mockReturnValue(0); // new moon
    game.time.calendar = {
      moonsArray: [{ name: 'Luna', cycleLength: 29.5, moonBrightnessMax: 0.15, referenceDate: { year: 0, month: 0, dayOfMonth: 0 } }]
    };
    const result = calculateMoonIllumination(0.8);
    expect(result.reduction).toBeCloseTo(0, 5);
  });

  it('calculates hue from colored moons', () => {
    getMoonPhasePosition.mockReturnValue(0.5); // full illumination
    game.time.calendar = {
      moonsArray: [{ name: 'Red Moon', cycleLength: 29.5, moonBrightnessMax: 0.15, color: '#ff0000', referenceDate: { year: 0, month: 0, dayOfMonth: 0 } }]
    };
    const result = calculateMoonIllumination(0.8);
    // Red hue → hue should be around 0
    expect(result.hue).not.toBeNull();
    expect(result.intensity).not.toBeNull();
  });

  it('returns null hue when moons have no color', () => {
    getMoonPhasePosition.mockReturnValue(0.5);
    game.time.calendar = {
      moonsArray: [{ name: 'Luna', cycleLength: 29.5, moonBrightnessMax: 0.15, referenceDate: { year: 0, month: 0, dayOfMonth: 0 } }]
    };
    const result = calculateMoonIllumination(0.8);
    expect(result.hue).toBeNull();
    expect(result.intensity).toBeNull();
  });

  it('calculates luminosity based on total illumination', () => {
    getMoonPhasePosition.mockReturnValue(0.5);
    game.time.calendar = {
      moonsArray: [{ name: 'Luna', cycleLength: 29.5, moonBrightnessMax: 0.15, referenceDate: { year: 0, month: 0, dayOfMonth: 0 } }]
    };
    const result = calculateMoonIllumination(0.8);
    expect(result.luminosity).toBeGreaterThanOrEqual(0);
    expect(result.luminosity).toBeLessThanOrEqual(0.25);
  });

  it('returns expected structure', () => {
    const result = calculateMoonIllumination(0.3);
    expect(result).toHaveProperty('reduction');
    expect(result).toHaveProperty('hue');
    expect(result).toHaveProperty('intensity');
    expect(result).toHaveProperty('luminosity');
  });
});
