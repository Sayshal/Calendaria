/**
 * Tests for weather-generator.mjs
 * Covers: seeded random, weighted selection, climate merging,
 * temperature modifiers, inertia, forecast chaining, variance, wind, precipitation.
 * @module Tests/WeatherGenerator
 */

import { describe, it, expect, vi } from 'vitest';

// Mock logger (no-op)
vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));

// Mock weather-presets with controlled data
vi.mock('../../scripts/weather/weather-presets.mjs', () => ({
  getPreset: (id, custom = []) => {
    const builtIn = {
      clear: { id: 'clear', label: 'Clear', icon: 'fa-sun', color: '#ffd700', category: 'clear', inertiaWeight: 1.2, wind: { speed: 0 }, precipitation: null },
      rain: { id: 'rain', label: 'Rain', icon: 'fa-cloud-rain', color: '#4a86e8', category: 'rain', inertiaWeight: 1.3, wind: { speed: 2 }, precipitation: { type: 'rain', intensity: 0.5 } },
      snow: { id: 'snow', label: 'Snow', icon: 'fa-snowflake', color: '#87ceeb', category: 'snow', inertiaWeight: 1.3, wind: { speed: 1 }, precipitation: { type: 'snow', intensity: 0.4 } },
      drizzle: { id: 'drizzle', label: 'Drizzle', icon: 'fa-cloud-rain', color: '#6a9bd1', category: 'rain', inertiaWeight: 1.0, wind: { speed: 1 }, precipitation: { type: 'rain', intensity: 0.2 } },
      tornado: { id: 'tornado', label: 'Tornado', icon: 'fa-tornado', color: '#333', category: 'severe', inertiaWeight: 0, wind: { speed: 5, direction: 0, forced: true }, precipitation: null },
      overcast: { id: 'overcast', label: 'Overcast', icon: 'fa-cloud', color: '#999', category: 'cloudy', inertiaWeight: 1.5, wind: { speed: 1 }, precipitation: null }
    };
    const found = custom.find((p) => p.id === id);
    return found || builtIn[id] || null;
  },
  getAllPresets: (custom = []) => {
    const builtIn = [
      { id: 'clear', label: 'Clear', category: 'clear', inertiaWeight: 1.2 },
      { id: 'rain', label: 'Rain', category: 'rain', inertiaWeight: 1.3 },
      { id: 'snow', label: 'Snow', category: 'snow', inertiaWeight: 1.3 },
      { id: 'drizzle', label: 'Drizzle', category: 'rain', inertiaWeight: 1.0 },
      { id: 'tornado', label: 'Tornado', category: 'severe', inertiaWeight: 0 },
      { id: 'overcast', label: 'Overcast', category: 'cloudy', inertiaWeight: 1.5 }
    ];
    return [...builtIn, ...custom];
  }
}));

// Mock constants
vi.mock('../../scripts/constants.mjs', () => ({
  COMPASS_DIRECTIONS: { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }
}));

import {
  seededRandom,
  dateSeed,
  applyTempModifier,
  mergeClimateConfig,
  generateWeather,
  generateForecast,
  applyForecastVariance,
  applyWeatherInertia
} from '../../scripts/weather/weather-generator.mjs';

/* -------------------------------------------- */
/*  seededRandom — Determinism                  */
/* -------------------------------------------- */

describe('seededRandom()', () => {
  it('produces deterministic output for same seed', () => {
    const rng1 = seededRandom(42);
    const rng2 = seededRandom(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it('produces different output for different seeds', () => {
    const rng1 = seededRandom(42);
    const rng2 = seededRandom(99);
    const val1 = rng1();
    const val2 = rng2();
    expect(val1).not.toBe(val2);
  });

  it('returns values in [0, 1) range', () => {
    const rng = seededRandom(12345);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('has reasonable distribution (chi-squared rough check)', () => {
    const rng = seededRandom(7777);
    const buckets = [0, 0, 0, 0, 0];
    const n = 5000;
    for (let i = 0; i < n; i++) buckets[Math.floor(rng() * 5)]++;
    const expected = n / 5;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });
});

/* -------------------------------------------- */
/*  dateSeed                                    */
/* -------------------------------------------- */

describe('dateSeed()', () => {
  it('produces unique values for different dates', () => {
    expect(dateSeed(2024, 5, 15)).toBe(20240515);
    expect(dateSeed(2024, 5, 16)).toBe(20240516);
    expect(dateSeed(2024, 6, 15)).toBe(20240615);
    expect(dateSeed(2025, 5, 15)).toBe(20250515);
  });

  it('handles month 0 and day 1 correctly', () => {
    expect(dateSeed(1, 0, 1)).toBe(10001);
  });
});

/* -------------------------------------------- */
/*  applyTempModifier                           */
/* -------------------------------------------- */

describe('applyTempModifier()', () => {
  it('returns absolute number value', () => {
    expect(applyTempModifier(15, 10)).toBe(15);
  });

  it('adds with "+" suffix', () => {
    expect(applyTempModifier('5+', 10)).toBe(15);
  });

  it('subtracts with "-" suffix', () => {
    expect(applyTempModifier('3-', 10)).toBe(7);
  });

  it('parses numeric string as absolute', () => {
    expect(applyTempModifier('20', 10)).toBe(20);
  });

  it('parses negative numeric string as absolute', () => {
    expect(applyTempModifier('-5', 10)).toBe(-5);
  });

  it('returns base for null/undefined', () => {
    expect(applyTempModifier(null, 10)).toBe(10);
    expect(applyTempModifier(undefined, 10)).toBe(10);
  });

  it('returns base for NaN string', () => {
    expect(applyTempModifier('abc', 10)).toBe(10);
    expect(applyTempModifier('abc+', 10)).toBe(10);
  });
});

/* -------------------------------------------- */
/*  mergeClimateConfig — Probability merging    */
/* -------------------------------------------- */

describe('mergeClimateConfig()', () => {
  it('uses season climate presets as base', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 30 }, 1: { id: 'rain', chance: 20 } } };
    const { probabilities } = mergeClimateConfig(seasonClimate, null, null, null);
    expect(probabilities).toEqual({ clear: 30, rain: 20 });
  });

  it('applies zone override absolute chances', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 30 }, 1: { id: 'rain', chance: 20 } } };
    const zoneOverride = { presets: { 0: { id: 'rain', chance: 40 } } };
    const { probabilities } = mergeClimateConfig(seasonClimate, zoneOverride, null, null);
    expect(probabilities.rain).toBe(40);
    expect(probabilities.clear).toBe(30);
  });

  it('applies zone override relative "+" modifier', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 30 } } };
    const zoneOverride = { presets: { 0: { id: 'clear', chance: '+10' } } };
    const { probabilities } = mergeClimateConfig(seasonClimate, zoneOverride, null, null);
    expect(probabilities.clear).toBe(40);
  });

  it('applies zone override relative "-" modifier', () => {
    const seasonClimate = { presets: { 0: { id: 'rain', chance: 20 } } };
    const zoneOverride = { presets: { 0: { id: 'rain', chance: '-5' } } };
    const { probabilities } = mergeClimateConfig(seasonClimate, zoneOverride, null, null);
    expect(probabilities.rain).toBe(15);
  });

  it('clamps negative relative modifier to 0 and removes', () => {
    const seasonClimate = { presets: { 0: { id: 'rain', chance: 3 } } };
    const zoneOverride = { presets: { 0: { id: 'rain', chance: '-10' } } };
    const { probabilities } = mergeClimateConfig(seasonClimate, zoneOverride, null, null);
    expect(probabilities.rain).toBeUndefined();
  });

  it('removes preset when zone chance is 0', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 30 }, 1: { id: 'rain', chance: 20 } } };
    const zoneOverride = { presets: { 0: { id: 'rain', chance: 0 } } };
    const { probabilities } = mergeClimateConfig(seasonClimate, zoneOverride, null, null);
    expect(probabilities.rain).toBeUndefined();
    expect(probabilities.clear).toBe(30);
  });

  it('falls back to zone default presets when no override presets', () => {
    const zoneFallback = { presets: { 0: { id: 'snow', enabled: true, chance: 25 }, 1: { id: 'rain', enabled: false, chance: 10 } } };
    const { probabilities } = mergeClimateConfig(null, null, zoneFallback, null);
    expect(probabilities.snow).toBe(25);
    expect(probabilities.rain).toBeUndefined(); // not enabled
  });

  // Temperature merging
  it('uses season climate temperatures as base', () => {
    const seasonClimate = { temperatures: { min: 5, max: 15 } };
    const { tempRange } = mergeClimateConfig(seasonClimate, null, null, null);
    expect(tempRange).toEqual({ min: 5, max: 15 });
  });

  it('applies zone override temperature modifiers', () => {
    const seasonClimate = { temperatures: { min: 10, max: 20 } };
    const zoneOverride = { temperatures: { min: '5+', max: '3-' } };
    const { tempRange } = mergeClimateConfig(seasonClimate, zoneOverride, null, null);
    expect(tempRange.min).toBe(15); // 10 + 5
    expect(tempRange.max).toBe(17); // 20 - 3
  });

  it('uses zone fallback season temperatures', () => {
    const zoneFallback = { temperatures: { Winter: { min: -10, max: 0 }, _default: { min: 10, max: 20 } } };
    const { tempRange } = mergeClimateConfig(null, null, zoneFallback, 'Winter');
    expect(tempRange.min).toBe(-10);
    expect(tempRange.max).toBe(0);
  });

  it('uses zone fallback _default when season not found', () => {
    const zoneFallback = { temperatures: { _default: { min: 8, max: 18 } } };
    const { tempRange } = mergeClimateConfig(null, null, zoneFallback, 'Monsoon');
    expect(tempRange).toEqual({ min: 8, max: 18 });
  });

  it('returns defaults (10, 22) when no config provided', () => {
    const { tempRange } = mergeClimateConfig(null, null, null, null);
    expect(tempRange).toEqual({ min: 10, max: 22 });
  });
});

/* -------------------------------------------- */
/*  applyWeatherInertia                         */
/* -------------------------------------------- */

describe('applyWeatherInertia()', () => {
  it('boosts current weather and reduces others', () => {
    const probs = { clear: 30, rain: 20, snow: 10 };
    const adjusted = applyWeatherInertia('clear', probs, 0.3);
    expect(adjusted.clear).toBeGreaterThan(30);
    expect(adjusted.rain).toBeLessThan(20);
    expect(adjusted.snow).toBeLessThan(10);
  });

  it('preserves total weight (approximately)', () => {
    const probs = { clear: 30, rain: 20, snow: 10 };
    const adjusted = applyWeatherInertia('clear', probs, 0.5);
    const totalBefore = 60;
    const totalAfter = Object.values(adjusted).reduce((s, w) => s + w, 0);
    expect(totalAfter).toBeCloseTo(totalBefore, 5);
  });

  it('returns unchanged if currentWeatherId not in probabilities', () => {
    const probs = { clear: 30, rain: 20 };
    const adjusted = applyWeatherInertia('blizzard', probs, 0.5);
    expect(adjusted).toEqual(probs);
  });

  it('returns unchanged if inertia is 0', () => {
    const probs = { clear: 30, rain: 20 };
    const adjusted = applyWeatherInertia('clear', probs, 0);
    expect(adjusted).toEqual(probs);
  });

  it('respects preset inertiaWeight (tornado has 0 → no inertia)', () => {
    const probs = { tornado: 5, clear: 30, rain: 20 };
    const adjusted = applyWeatherInertia('tornado', probs, 0.5);
    // tornado inertiaWeight=0 → effectiveInertia=0 → unchanged
    expect(adjusted).toEqual(probs);
  });

  it('respects high preset inertiaWeight (overcast has 1.5)', () => {
    const probs = { overcast: 10, clear: 30, rain: 20 };
    const adj1 = applyWeatherInertia('overcast', probs, 0.3);
    // overcast inertiaWeight=1.5 → effective=0.45
    // clear inertiaWeight=1.2 → effective=0.36
    const adj2 = applyWeatherInertia('clear', { ...probs }, 0.3);
    // overcast should get bigger boost relative to its base
    const overcastBoostRatio = adj1.overcast / 10;
    const clearBoostRatio = adj2.clear / 30;
    expect(overcastBoostRatio).toBeGreaterThan(clearBoostRatio);
  });

  it('caps effective inertia at 1', () => {
    const probs = { overcast: 10, clear: 30 };
    // inertia=0.8, overcast weight=1.5, effective = min(1, 1.2) = 1
    const adjusted = applyWeatherInertia('overcast', probs, 0.8);
    // At inertia=1, others should be 0
    expect(adjusted.clear).toBeCloseTo(0, 5);
    expect(adjusted.overcast).toBeCloseTo(40, 5);
  });
});

/* -------------------------------------------- */
/*  generateWeather — Integration               */
/* -------------------------------------------- */

describe('generateWeather()', () => {
  it('returns a preset, temperature, wind, and precipitation', () => {
    const result = generateWeather({
      seasonClimate: { presets: { 0: { id: 'clear', chance: 100 } }, temperatures: { min: 20, max: 30 } },
      seed: 42
    });
    expect(result.preset).toBeDefined();
    expect(result.preset.id).toBe('clear');
    expect(result.temperature).toBeGreaterThanOrEqual(20);
    expect(result.temperature).toBeLessThanOrEqual(30);
    expect(result.wind).toBeDefined();
    expect(result.precipitation).toBeDefined();
  });

  it('selects from all available presets when no config provided', () => {
    const result = generateWeather({ seed: 42 });
    expect(result.preset).toBeDefined();
    expect(result.preset.id).toBeTruthy();
  });

  it('produces deterministic results with same seed', () => {
    const opts = {
      seasonClimate: { presets: { 0: { id: 'clear', chance: 50 }, 1: { id: 'rain', chance: 50 } }, temperatures: { min: 10, max: 20 } },
      seed: 999
    };
    const r1 = generateWeather(opts);
    const r2 = generateWeather(opts);
    expect(r1.preset.id).toBe(r2.preset.id);
    expect(r1.temperature).toBe(r2.temperature);
  });

  it('respects zone season override probabilities', () => {
    const zoneConfig = { seasonOverrides: { Summer: { presets: { 0: { id: 'clear', chance: 100 } } } } };
    const result = generateWeather({ zoneConfig, season: 'Summer', seed: 42 });
    expect(result.preset.id).toBe('clear');
  });

  it('applies preset-level temp overrides from zone config', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 100 } }, temperatures: { min: 10, max: 20 } };
    const zoneConfig = { presets: { 0: { id: 'clear', enabled: true, tempMin: 30, tempMax: 35 } } };
    const result = generateWeather({ seasonClimate, zoneConfig, seed: 42 });
    expect(result.temperature).toBeGreaterThanOrEqual(30);
    expect(result.temperature).toBeLessThanOrEqual(35);
  });

  it('generates precipitation for rain preset', () => {
    const result = generateWeather({
      seasonClimate: { presets: { 0: { id: 'rain', chance: 100 } }, temperatures: { min: 10, max: 20 } },
      seed: 42
    });
    expect(result.precipitation.type).toBe('rain');
    expect(result.precipitation.intensity).toBeGreaterThan(0);
    expect(result.precipitation.intensity).toBeLessThanOrEqual(1);
  });

  it('generates no precipitation for clear preset', () => {
    const result = generateWeather({
      seasonClimate: { presets: { 0: { id: 'clear', chance: 100 } }, temperatures: { min: 20, max: 30 } },
      seed: 42
    });
    expect(result.precipitation.type).toBeNull();
    expect(result.precipitation.intensity).toBe(0);
  });

  it('generates forced wind for tornado', () => {
    const result = generateWeather({
      seasonClimate: { presets: { 0: { id: 'tornado', chance: 100 } }, temperatures: { min: 20, max: 30 } },
      seed: 42
    });
    expect(result.wind.forced).toBe(true);
    expect(result.wind.speed).toBe(5);
  });
});

/* -------------------------------------------- */
/*  generateForecast — Multi-day chaining       */
/* -------------------------------------------- */

describe('generateForecast()', () => {
  const getDaysInMonth = (_month, _year) => 30;
  getDaysInMonth._monthsPerYear = 12;

  it('generates the requested number of days', () => {
    const forecast = generateForecast({
      zoneConfig: { presets: { 0: { id: 'clear', enabled: true, chance: 50 }, 1: { id: 'rain', enabled: true, chance: 50 } } },
      startYear: 1,
      startMonth: 0,
      startDayOfMonth: 0,
      days: 7,
      getDaysInMonth
    });
    expect(forecast).toHaveLength(7);
  });

  it('advances dates correctly', () => {
    const forecast = generateForecast({
      zoneConfig: { presets: { 0: { id: 'clear', enabled: true, chance: 100 } } },
      startYear: 1,
      startMonth: 0,
      startDayOfMonth: 27,
      days: 5,
      getDaysInMonth
    });
    expect(forecast.map((f) => f.dayOfMonth)).toEqual([27, 28, 29, 0, 1]);
    expect(forecast[3].month).toBe(1); // rolled over
  });

  it('rolls over year correctly', () => {
    const forecast = generateForecast({
      zoneConfig: { presets: { 0: { id: 'clear', enabled: true, chance: 100 } } },
      startYear: 1,
      startMonth: 11,
      startDayOfMonth: 29,
      days: 3,
      getDaysInMonth
    });
    expect(forecast[0]).toMatchObject({ year: 1, month: 11, dayOfMonth: 29 });
    expect(forecast[1]).toMatchObject({ year: 2, month: 0, dayOfMonth: 0 });
    expect(forecast[2]).toMatchObject({ year: 2, month: 0, dayOfMonth: 1 });
  });

  it('produces deterministic results (seeded)', () => {
    const opts = {
      zoneConfig: { presets: { 0: { id: 'clear', enabled: true, chance: 50 }, 1: { id: 'rain', enabled: true, chance: 50 } } },
      startYear: 1,
      startMonth: 0,
      startDayOfMonth: 0,
      days: 7,
      getDaysInMonth
    };
    const f1 = generateForecast(opts);
    const f2 = generateForecast(opts);
    for (let i = 0; i < 7; i++) {
      expect(f1[i].preset.id).toBe(f2[i].preset.id);
      expect(f1[i].temperature).toBe(f2[i].temperature);
    }
  });

  it('chains inertia from previous day', () => {
    // With high inertia and clear as start, most days should stay clear
    const forecast = generateForecast({
      zoneConfig: { presets: { 0: { id: 'clear', enabled: true, chance: 30 }, 1: { id: 'rain', enabled: true, chance: 30 }, 2: { id: 'snow', enabled: true, chance: 30 } } },
      startYear: 1,
      startMonth: 0,
      startDayOfMonth: 0,
      days: 10,
      currentWeatherId: 'clear',
      inertia: 0.8,
      getDaysInMonth
    });
    // With inertia, clear should appear more often than without (baseline ~3.3 of 10)
    // Verify inertia is being applied by checking first day keeps the chain
    expect(forecast[0].preset.id).toBe('clear'); // First day should chain from currentWeatherId
  });

  it('applies season changes mid-forecast via getSeasonForDate', () => {
    const getSeasonForDate = (_year, _month, dayOfMonth) => {
      if (dayOfMonth <= 2) return { name: 'Summer', climate: { presets: { 0: { id: 'clear', chance: 100 } }, temperatures: { min: 25, max: 35 } } };
      return { name: 'Winter', climate: { presets: { 0: { id: 'snow', chance: 100 } }, temperatures: { min: -10, max: 0 } } };
    };
    const forecast = generateForecast({
      startYear: 1,
      startMonth: 0,
      startDayOfMonth: 0,
      days: 7,
      getDaysInMonth,
      getSeasonForDate
    });
    // Days 0-2: clear (summer), Days 3-6: snow (winter)
    expect(forecast[0].preset.id).toBe('clear');
    expect(forecast[1].preset.id).toBe('clear');
    expect(forecast[2].preset.id).toBe('clear');
    expect(forecast[3].preset.id).toBe('snow');
  });
});

/* -------------------------------------------- */
/*  applyForecastVariance                       */
/* -------------------------------------------- */

describe('applyForecastVariance()', () => {
  const baseWeather = {
    preset: { id: 'rain', label: 'Rain', category: 'rain' },
    temperature: 15
  };

  it('returns unchanged at 100% accuracy', () => {
    const rng = seededRandom(42);
    const result = applyForecastVariance(baseWeather, 3, 7, 100, rng, []);
    expect(result.preset.id).toBe('rain');
    expect(result.temperature).toBe(15);
    expect(result.isVaried).toBe(false);
  });

  it('temperature variance scales with distance', () => {
    // Collect variance magnitudes for day 1 vs day 7
    const variances1 = [];
    const variances7 = [];
    for (let seed = 0; seed < 100; seed++) {
      const r1 = applyForecastVariance(baseWeather, 1, 7, 50, seededRandom(seed), []);
      const r7 = applyForecastVariance(baseWeather, 7, 7, 50, seededRandom(seed + 1000), []);
      variances1.push(Math.abs(r1.temperature - 15));
      variances7.push(Math.abs(r7.temperature - 15));
    }
    const avgVar1 = variances1.reduce((s, v) => s + v, 0) / variances1.length;
    const avgVar7 = variances7.reduce((s, v) => s + v, 0) / variances7.length;
    expect(avgVar7).toBeGreaterThan(avgVar1);
  });

  it('stays within same category when varying preset', () => {
    // Force preset change by running many trials at low accuracy
    for (let seed = 0; seed < 200; seed++) {
      const result = applyForecastVariance(baseWeather, 7, 7, 10, seededRandom(seed), []);
      // rain category → should only get rain or drizzle (both category: 'rain')
      expect(['rain', 'drizzle']).toContain(result.preset.id);
    }
  });

  it('variance chance increases with lower accuracy', () => {
    let variedAt30 = 0;
    let variedAt80 = 0;
    for (let seed = 0; seed < 500; seed++) {
      const r30 = applyForecastVariance(baseWeather, 5, 7, 30, seededRandom(seed), []);
      const r80 = applyForecastVariance(baseWeather, 5, 7, 80, seededRandom(seed), []);
      if (r30.isVaried) variedAt30++;
      if (r80.isVaried) variedAt80++;
    }
    expect(variedAt30).toBeGreaterThan(variedAt80);
  });
});

/* -------------------------------------------- */
/*  Wind generation edge cases                  */
/* -------------------------------------------- */

describe('generateWeather() — wind', () => {
  it('clamps wind speed to zone range', () => {
    const zoneConfig = {
      presets: { 0: { id: 'clear', enabled: true, chance: 100 } },
      windSpeedRange: { min: 2, max: 3 }
    };
    // Run multiple times — speed should always be in [2, 3]
    for (let seed = 0; seed < 50; seed++) {
      const result = generateWeather({
        seasonClimate: { presets: { 0: { id: 'clear', chance: 100 } } },
        zoneConfig,
        seed
      });
      expect(result.wind.speed).toBeGreaterThanOrEqual(2);
      expect(result.wind.speed).toBeLessThanOrEqual(3);
    }
  });

  it('uses zone wind direction weights', () => {
    const zoneConfig = {
      presets: { 0: { id: 'clear', enabled: true, chance: 100 } },
      windDirections: { N: 100, S: 0 }
    };
    const result = generateWeather({
      seasonClimate: { presets: { 0: { id: 'clear', chance: 100 } } },
      zoneConfig,
      seed: 42
    });
    expect(result.wind.direction).toBe(0); // N = 0 degrees
  });
});

/* -------------------------------------------- */
/*  Precipitation generation                    */
/* -------------------------------------------- */

describe('generateWeather() — precipitation', () => {
  it('intensity is clamped to [0.1, 1.0]', () => {
    for (let seed = 0; seed < 100; seed++) {
      const result = generateWeather({
        seasonClimate: { presets: { 0: { id: 'rain', chance: 100 } }, temperatures: { min: 10, max: 20 } },
        seed
      });
      expect(result.precipitation.intensity).toBeGreaterThanOrEqual(0.1);
      expect(result.precipitation.intensity).toBeLessThanOrEqual(1.0);
    }
  });

  it('snow preset generates snow precipitation', () => {
    const result = generateWeather({
      seasonClimate: { presets: { 0: { id: 'snow', chance: 100 } }, temperatures: { min: -5, max: 0 } },
      seed: 42
    });
    expect(result.precipitation.type).toBe('snow');
  });
});
