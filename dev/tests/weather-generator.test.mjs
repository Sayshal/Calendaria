import { describe, expect, it, vi } from 'vitest';
import {
  applyForecastVariance,
  applyTempModifier,
  applyWeatherInertia,
  dateSeed,
  generateForecast,
  generateIntradayWeather,
  generateWeather,
  mergeClimateConfig,
  periodSeed,
  seededRandom
} from '../../scripts/weather/weather-generator.mjs';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
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
vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  SETTINGS: { WEATHER_PRESET_ALIASES: 'weatherPresetAliases' },
  COMPASS_DIRECTIONS: { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 },
  WIND_SPEEDS: {
    CALM: { id: 'calm', value: 0, label: 'Calm', kph: 5 },
    LIGHT: { id: 'light', value: 1, label: 'Light', kph: 20 },
    MODERATE: { id: 'moderate', value: 2, label: 'Moderate', kph: 40 },
    STRONG: { id: 'strong', value: 3, label: 'Strong', kph: 60 },
    SEVERE: { id: 'severe', value: 4, label: 'Severe', kph: 90 },
    EXTREME: { id: 'extreme', value: 5, label: 'Extreme', kph: 250 }
  },
  WEATHER_PERIODS: {
    NIGHT: { id: 'night', index: 0, label: 'Night', icon: 'fa-moon' },
    MORNING: { id: 'morning', index: 1, label: 'Morning', icon: 'fa-sun-bright' },
    AFTERNOON: { id: 'afternoon', index: 2, label: 'Afternoon', icon: 'fa-sun' },
    EVENING: { id: 'evening', index: 3, label: 'Evening', icon: 'fa-cloud-moon' }
  }
}));

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
    const zoneOverride = { presets: { 0: { id: 'clear', chance: '10+' } } };
    const { probabilities } = mergeClimateConfig(seasonClimate, zoneOverride, null, null);
    expect(probabilities.clear).toBe(40);
  });
  it('applies zone override relative "-" modifier', () => {
    const seasonClimate = { presets: { 0: { id: 'rain', chance: 20 } } };
    const zoneOverride = { presets: { 0: { id: 'rain', chance: '5-' } } };
    const { probabilities } = mergeClimateConfig(seasonClimate, zoneOverride, null, null);
    expect(probabilities.rain).toBe(15);
  });
  it('clamps negative relative modifier to 0 and removes', () => {
    const seasonClimate = { presets: { 0: { id: 'rain', chance: 3 } } };
    const zoneOverride = { presets: { 0: { id: 'rain', chance: '10-' } } };
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
  it('zone fallback only filters enabled/disabled, does not inject weights', () => {
    const zoneFallback = { presets: { 0: { id: 'snow', enabled: true }, 1: { id: 'rain', enabled: false } } };
    const { probabilities } = mergeClimateConfig(null, null, zoneFallback, null);
    expect(probabilities.snow).toBeUndefined();
    expect(probabilities.rain).toBeUndefined();
  });
  it('excludes presets absent from zone presets when zone has overrides (issue #432)', () => {
    const zoneFallback = { presets: { a: { id: 'clear', enabled: true } } };
    const zoneOverride = { presets: { clear: { id: 'clear', chance: 50 }, mist: { id: 'mist', chance: 14 } } };
    const { probabilities } = mergeClimateConfig(null, zoneOverride, zoneFallback, 'Spring');
    expect(probabilities.clear).toBe(50);
    expect(probabilities.mist).toBeUndefined();
  });
  it('excludes disabled presets from season override — zone base only filters', () => {
    const zoneFallback = { presets: { a: { id: 'windy', enabled: true }, b: { id: 'clear', enabled: true } } };
    const zoneOverride = { presets: { rain: { id: 'rain', chance: 28 }, mist: { id: 'mist', chance: 14 }, clear: { id: 'clear', chance: 14 } } };
    const { probabilities } = mergeClimateConfig(null, zoneOverride, zoneFallback, 'Spring');
    expect(probabilities.mist).toBeUndefined();
    expect(probabilities.rain).toBeUndefined();
    expect(probabilities.clear).toBe(14);
    expect(probabilities.windy).toBeUndefined();
  });
  it('zone fallback filters season presets to only enabled ones (#432)', () => {
    const zoneFallback = { presets: { a: { id: 'clear', enabled: true }, b: { id: 'sandstorm', enabled: true } } };
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 40 } } };
    const { probabilities } = mergeClimateConfig(seasonClimate, null, zoneFallback, null);
    expect(probabilities.clear).toBe(40);
    expect(probabilities.sandstorm).toBeUndefined();
  });
  it('uses season climate temperatures as base', () => {
    const seasonClimate = { temperatures: { min: 5, max: 15 } };
    const { tempRange } = mergeClimateConfig(seasonClimate, null, null, null);
    expect(tempRange).toEqual({ min: 5, max: 15 });
  });
  it('applies zone override temperature modifiers', () => {
    const seasonClimate = { temperatures: { min: 10, max: 20 } };
    const zoneOverride = { temperatures: { min: '5+', max: '3-' } };
    const { tempRange } = mergeClimateConfig(seasonClimate, zoneOverride, null, null);
    expect(tempRange.min).toBe(15);
    expect(tempRange.max).toBe(17);
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
    expect(adjusted).toEqual(probs);
  });
  it('respects high preset inertiaWeight (overcast has 1.5)', () => {
    const probs = { overcast: 10, clear: 30, rain: 20 };
    const adj1 = applyWeatherInertia('overcast', probs, 0.3);
    const adj2 = applyWeatherInertia('clear', { ...probs }, 0.3);
    const overcastBoostRatio = adj1.overcast / 10;
    const clearBoostRatio = adj2.clear / 30;
    expect(overcastBoostRatio).toBeGreaterThan(clearBoostRatio);
  });
  it('caps effective inertia at 1', () => {
    const probs = { overcast: 10, clear: 30 };
    const adjusted = applyWeatherInertia('overcast', probs, 0.8);
    expect(adjusted.clear).toBeCloseTo(0, 5);
    expect(adjusted.overcast).toBeCloseTo(40, 5);
  });
});

describe('generateWeather()', () => {
  it('returns a preset, temperature, wind, and precipitation', () => {
    const result = generateWeather({ seasonClimate: { presets: { 0: { id: 'clear', chance: 100 } }, temperatures: { min: 20, max: 30 } }, seed: 42 });
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
    const opts = { seasonClimate: { presets: { 0: { id: 'clear', chance: 50 }, 1: { id: 'rain', chance: 50 } }, temperatures: { min: 10, max: 20 } }, seed: 999 };
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
  it('applies preset-level temp overrides from zone config when overlapping', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 100 } }, temperatures: { min: 10, max: 40 } };
    const zoneConfig = { presets: { 0: { id: 'clear', enabled: true, tempMin: 30, tempMax: 35 } } };
    const result = generateWeather({ seasonClimate, zoneConfig, seed: 42 });
    expect(result.temperature).toBeGreaterThanOrEqual(30);
    expect(result.temperature).toBeLessThanOrEqual(35);
  });
  it('falls back to season range when preset override conflicts', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 100 } }, temperatures: { min: 10, max: 20 } };
    const zoneConfig = { presets: { 0: { id: 'clear', enabled: true, tempMin: 30, tempMax: 35 } } };
    const result = generateWeather({ seasonClimate, zoneConfig, seed: 42 });
    expect(result.temperature).toBeGreaterThanOrEqual(10);
    expect(result.temperature).toBeLessThanOrEqual(20);
  });
  it('still selects preset when relative tempMin/tempMax resolve outside season range (#694)', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 1 } }, temperatures: { min: 18, max: 32 } };
    const zoneConfig = {
      presets: { a: { id: 'clear', enabled: true }, b: { id: 'rain', enabled: false } },
      seasonOverrides: { Summer: { presets: { rain: { id: 'rain', enabled: true, chance: '100+', tempMin: '56+', tempMax: '61+' } } } }
    };
    const result = generateWeather({ seasonClimate, zoneConfig, season: 'Summer', seed: 7 });
    expect(result.preset.id).toBe('rain');
  });
  it('relative "+" tempMax extends the upper bound above the season range', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 100 } }, temperatures: { min: 18, max: 32 } };
    const zoneConfig = { presets: { 0: { id: 'clear', enabled: true, tempMin: '10+', tempMax: '20+' } } };
    const result = generateWeather({ seasonClimate, zoneConfig, seed: 13 });
    expect(result.temperature).toBeGreaterThanOrEqual(28);
    expect(result.temperature).toBeLessThanOrEqual(52);
  });
  it('generates precipitation for rain preset', () => {
    const result = generateWeather({ seasonClimate: { presets: { 0: { id: 'rain', chance: 100 } }, temperatures: { min: 10, max: 20 } }, seed: 42 });
    expect(result.precipitation.type).toBe('rain');
    expect(result.precipitation.intensity).toBeGreaterThan(0);
    expect(result.precipitation.intensity).toBeLessThanOrEqual(1);
  });
  it('generates no precipitation for clear preset', () => {
    const result = generateWeather({ seasonClimate: { presets: { 0: { id: 'clear', chance: 100 } }, temperatures: { min: 20, max: 30 } }, seed: 42 });
    expect(result.precipitation.type).toBeNull();
    expect(result.precipitation.intensity).toBe(0);
  });
  it('generates forced wind for tornado', () => {
    const result = generateWeather({ seasonClimate: { presets: { 0: { id: 'tornado', chance: 100 } }, temperatures: { min: 20, max: 30 } }, seed: 42 });
    expect(result.wind.forced).toBe(true);
    expect(result.wind.speed).toBe(5);
  });
});

describe('generateForecast()', () => {
  const getDaysInMonth = (_month, _year) => 30;
  getDaysInMonth._monthsPerYear = 12;
  it('generates the requested number of days', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 50 }, 1: { id: 'rain', chance: 50 } } };
    const forecast = generateForecast({
      zoneConfig: { presets: { 0: { id: 'clear', enabled: true }, 1: { id: 'rain', enabled: true } } },
      startYear: 1,
      startMonth: 0,
      startDayOfMonth: 0,
      days: 7,
      getDaysInMonth,
      getSeasonForDate: () => ({ name: 'Default', climate: seasonClimate })
    });
    expect(forecast).toHaveLength(7);
  });
  it('advances dates correctly', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 100 } } };
    const forecast = generateForecast({
      zoneConfig: { presets: { 0: { id: 'clear', enabled: true } } },
      startYear: 1,
      startMonth: 0,
      startDayOfMonth: 27,
      days: 5,
      getDaysInMonth,
      getSeasonForDate: () => ({ name: 'Default', climate: seasonClimate })
    });
    expect(forecast.map((f) => f.dayOfMonth)).toEqual([27, 28, 29, 0, 1]);
    expect(forecast[3].month).toBe(1);
  });
  it('rolls over year correctly', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 100 } } };
    const forecast = generateForecast({
      zoneConfig: { presets: { 0: { id: 'clear', enabled: true } } },
      startYear: 1,
      startMonth: 11,
      startDayOfMonth: 29,
      days: 3,
      getDaysInMonth,
      getSeasonForDate: () => ({ name: 'Default', climate: seasonClimate })
    });
    expect(forecast[0]).toMatchObject({ year: 1, month: 11, dayOfMonth: 29 });
    expect(forecast[1]).toMatchObject({ year: 2, month: 0, dayOfMonth: 0 });
    expect(forecast[2]).toMatchObject({ year: 2, month: 0, dayOfMonth: 1 });
  });
  it('produces deterministic results (seeded)', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 50 }, 1: { id: 'rain', chance: 50 } } };
    const opts = {
      zoneConfig: { presets: { 0: { id: 'clear', enabled: true }, 1: { id: 'rain', enabled: true } } },
      startYear: 1,
      startMonth: 0,
      startDayOfMonth: 0,
      days: 7,
      getDaysInMonth,
      getSeasonForDate: () => ({ name: 'Default', climate: seasonClimate })
    };
    const f1 = generateForecast(opts);
    const f2 = generateForecast(opts);
    for (let i = 0; i < 7; i++) {
      expect(f1[i].preset.id).toBe(f2[i].preset.id);
      expect(f1[i].temperature).toBe(f2[i].temperature);
    }
  });
  it('chains inertia from previous day', () => {
    const seasonClimate = { presets: { 0: { id: 'clear', chance: 30 }, 1: { id: 'rain', chance: 30 }, 2: { id: 'snow', chance: 30 } } };
    const forecast = generateForecast({
      zoneConfig: { presets: { 0: { id: 'clear', enabled: true }, 1: { id: 'rain', enabled: true }, 2: { id: 'snow', enabled: true } } },
      startYear: 1,
      startMonth: 0,
      startDayOfMonth: 0,
      days: 10,
      currentWeatherId: 'clear',
      inertia: 0.8,
      getDaysInMonth,
      getSeasonForDate: () => ({ name: 'Default', climate: seasonClimate })
    });
    expect(forecast[0].preset.id).toBe('clear');
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
    expect(forecast[0].preset.id).toBe('clear');
    expect(forecast[1].preset.id).toBe('clear');
    expect(forecast[2].preset.id).toBe('clear');
    expect(forecast[3].preset.id).toBe('snow');
  });
});

describe('applyForecastVariance()', () => {
  const baseWeather = { preset: { id: 'rain', label: 'Rain', category: 'rain' }, temperature: 15 };
  it('returns unchanged at 100% accuracy', () => {
    const rng = seededRandom(42);
    const result = applyForecastVariance(baseWeather, 3, 7, 100, rng, []);
    expect(result.preset.id).toBe('rain');
    expect(result.temperature).toBe(15);
    expect(result.isVaried).toBe(false);
  });
  it('temperature variance scales with distance', () => {
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
    for (let seed = 0; seed < 200; seed++) {
      const result = applyForecastVariance(baseWeather, 7, 7, 10, seededRandom(seed), []);
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

describe('generateWeather() — wind', () => {
  it('clamps wind speed to zone range', () => {
    const zoneConfig = { presets: { 0: { id: 'clear', enabled: true } }, windSpeedRange: { min: 2, max: 3 } };
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
    const zoneConfig = { presets: { 0: { id: 'clear', enabled: true } }, windDirections: { N: 100, S: 0 } };
    const result = generateWeather({ seasonClimate: { presets: { 0: { id: 'clear', chance: 100 } } }, zoneConfig, seed: 42 });
    expect(result.wind.direction).toBe(0);
  });
});

describe('generateWeather() — precipitation', () => {
  it('intensity is clamped to [0.1, 1.0]', () => {
    for (let seed = 0; seed < 100; seed++) {
      const result = generateWeather({ seasonClimate: { presets: { 0: { id: 'rain', chance: 100 } }, temperatures: { min: 10, max: 20 } }, seed });
      expect(result.precipitation.intensity).toBeGreaterThanOrEqual(0.1);
      expect(result.precipitation.intensity).toBeLessThanOrEqual(1.0);
    }
  });
  it('snow preset generates snow precipitation', () => {
    const result = generateWeather({ seasonClimate: { presets: { 0: { id: 'snow', chance: 100 } }, temperatures: { min: -5, max: 0 } }, seed: 42 });
    expect(result.precipitation.type).toBe('snow');
  });
});

describe('periodSeed()', () => {
  it('produces deterministic output for same inputs', () => {
    expect(periodSeed(2024, 5, 10, 0)).toBe(periodSeed(2024, 5, 10, 0));
    expect(periodSeed(2024, 5, 10, 1)).toBe(periodSeed(2024, 5, 10, 1));
  });
  it('produces different seeds for different periods', () => {
    const seeds = [0, 1, 2, 3].map((i) => periodSeed(2024, 5, 10, i));
    const unique = new Set(seeds);
    expect(unique.size).toBe(4);
  });
  it('produces different seeds for different dates', () => {
    const s1 = periodSeed(2024, 5, 10, 1);
    const s2 = periodSeed(2024, 5, 11, 1);
    expect(s1).not.toBe(s2);
  });
  it('equals dateSeed * 4 + periodIndex', () => {
    expect(periodSeed(2024, 5, 10, 2)).toBe(dateSeed(2024, 5, 10) * 4 + 2);
  });
});

describe('generateIntradayWeather()', () => {
  const climate = { presets: { 0: { id: 'clear', chance: 40 }, 1: { id: 'rain', chance: 30 }, 2: { id: 'overcast', chance: 30 } }, temperatures: { min: 10, max: 25 } };
  const zoneConfig = {};

  it('returns 4 periods', () => {
    const result = generateIntradayWeather({ seasonClimate: climate, zoneConfig, year: 2024, month: 5, dayOfMonth: 10 });
    expect(result.periods).toBeDefined();
    expect(Object.keys(result.periods)).toEqual(['night', 'morning', 'afternoon', 'evening']);
  });

  it('returns a dominant entry from morning period', () => {
    const result = generateIntradayWeather({ seasonClimate: climate, zoneConfig, year: 2024, month: 5, dayOfMonth: 10 });
    expect(result.dominant).toBe(result.periods.morning);
  });

  it('produces deterministic results', () => {
    const r1 = generateIntradayWeather({ seasonClimate: climate, zoneConfig, year: 2024, month: 5, dayOfMonth: 10 });
    const r2 = generateIntradayWeather({ seasonClimate: climate, zoneConfig, year: 2024, month: 5, dayOfMonth: 10 });
    expect(r1.periods.night.preset.id).toBe(r2.periods.night.preset.id);
    expect(r1.periods.morning.preset.id).toBe(r2.periods.morning.preset.id);
    expect(r1.periods.afternoon.preset.id).toBe(r2.periods.afternoon.preset.id);
    expect(r1.periods.evening.preset.id).toBe(r2.periods.evening.preset.id);
    expect(r1.periods.morning.temperature).toBe(r2.periods.morning.temperature);
  });

  it('each period has a valid preset, temperature, wind, and precipitation', () => {
    const result = generateIntradayWeather({ seasonClimate: climate, zoneConfig, year: 2024, month: 5, dayOfMonth: 10 });
    for (const [, period] of Object.entries(result.periods)) {
      expect(period.preset).toBeDefined();
      expect(period.preset.id).toBeTruthy();
      expect(typeof period.temperature).toBe('number');
      expect(period.wind).toBeDefined();
      expect(period.precipitation).toBeDefined();
    }
  });

  it('different dates produce different weather', () => {
    const r1 = generateIntradayWeather({ seasonClimate: climate, zoneConfig, year: 2024, month: 5, dayOfMonth: 10 });
    const r2 = generateIntradayWeather({ seasonClimate: climate, zoneConfig, year: 2024, month: 5, dayOfMonth: 15 });
    // At least one period should differ (statistically very likely with different seeds)
    const allSame = Object.keys(r1.periods).every((p) => r1.periods[p].preset.id === r2.periods[p].preset.id && r1.periods[p].temperature === r2.periods[p].temperature);
    expect(allSame).toBe(false);
  });

  it('100% carry-over makes all periods identical', () => {
    const result = generateIntradayWeather({ seasonClimate: climate, zoneConfig, year: 2024, month: 5, dayOfMonth: 10, carryOverChance: 100 });
    const nightId = result.periods.night.preset.id;
    expect(result.periods.morning.preset.id).toBe(nightId);
    expect(result.periods.afternoon.preset.id).toBe(nightId);
    expect(result.periods.evening.preset.id).toBe(nightId);
  });

  it('0% carry-over generates independently', () => {
    // With different seeds, at least some periods should differ across many runs
    let anyDiffer = false;
    for (let day = 0; day < 20; day++) {
      const result = generateIntradayWeather({ seasonClimate: climate, zoneConfig, year: 2024, month: 5, dayOfMonth: day, carryOverChance: 0 });
      const ids = Object.values(result.periods).map((p) => p.preset.id);
      if (new Set(ids).size > 1) { anyDiffer = true; break; }
    }
    expect(anyDiffer).toBe(true);
  });
});

describe('generateForecast() — intraday', () => {
  const climate = { presets: { 0: { id: 'clear', chance: 50 }, 1: { id: 'rain', chance: 50 } }, temperatures: { min: 10, max: 25 } };
  const zoneConfig = {};

  it('includes periods when intraday=true', () => {
    const forecast = generateForecast({
      zoneConfig, startYear: 2024, startMonth: 5, startDayOfMonth: 10, days: 3,
      getSeasonForDate: () => ({ name: 'Summer', climate }),
      intraday: true
    });
    expect(forecast.length).toBe(3);
    for (const entry of forecast) {
      expect(entry.periods).toBeDefined();
      expect(Object.keys(entry.periods)).toEqual(['night', 'morning', 'afternoon', 'evening']);
    }
  });

  it('does not include periods when intraday=false', () => {
    const forecast = generateForecast({
      zoneConfig, startYear: 2024, startMonth: 5, startDayOfMonth: 10, days: 3,
      getSeasonForDate: () => ({ name: 'Summer', climate }),
      intraday: false
    });
    for (const entry of forecast) {
      expect(entry.periods).toBeUndefined();
    }
  });

  it('chains cross-day via evening→night', () => {
    const forecast = generateForecast({
      zoneConfig, startYear: 2024, startMonth: 5, startDayOfMonth: 10, days: 2,
      getSeasonForDate: () => ({ name: 'Summer', climate }),
      intraday: true
    });
    // Day 2 exists and has period data
    expect(forecast[1].periods).toBeDefined();
    expect(forecast[1].periods.night).toBeDefined();
  });
});
