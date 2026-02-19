/**
 * Procedural weather generation based on climate zones and seasons.
 * Uses weighted random selection with optional seeded randomness.
 * Uses zone-based config from calendar for generation.
 * @module Weather/WeatherGenerator
 * @author Tyler
 */

import { COMPASS_DIRECTIONS } from '../constants.mjs';
import { getAllPresets, getPreset } from './weather-presets.mjs';

/**
 * Seeded random number generator (mulberry32).
 * @param {number} seed - Seed value
 * @returns {Function} Random function returning 0-1
 */
export function seededRandom(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a seed from date components.
 * @param {number} year - Year
 * @param {number} month - Month (0-indexed)
 * @param {number} day - Day of month
 * @returns {number} Seed value
 */
export function dateSeed(year, month, day) {
  return year * 10000 + month * 100 + day;
}

/**
 * Select a random item from weighted options.
 * @param {object} weights - Object mapping IDs to weights
 * @param {Function} [randomFn] - Random function
 * @returns {string} Selected ID
 */
function weightedSelect(weights, randomFn = Math.random) {
  const entries = Object.entries(weights);
  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight <= 0) return entries[0][0];
  let roll = randomFn() * totalWeight;
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

/**
 * Apply a temperature value that may be a relative modifier or absolute.
 * Suffix convention: "5+" = add 5 to base, "5-" = subtract 5 from base.
 * All other values (numbers, negative strings like "-4") are absolute.
 * @param {number|string} value - Temperature value or "N+"/"N-" modifier string
 * @param {number} base - Base temperature to apply modifier against
 * @returns {number} Resolved temperature
 */
export function applyTempModifier(value, base) {
  if (typeof value === 'string') {
    if (value.endsWith('+')) {
      const delta = Number(value.slice(0, -1));
      return !isNaN(delta) ? base + delta : base;
    }
    if (value.endsWith('-')) {
      const delta = Number(value.slice(0, -1));
      return !isNaN(delta) ? base - delta : base;
    }
    const num = Number(value);
    return !isNaN(num) ? num : base;
  }
  return value ?? base;
}

/**
 * Merge season climate with zone overrides.
 * Zone override presets support relative modifiers: "+5" adds to base, "-3" subtracts (chances are always positive).
 * Zone override temperatures support "N+"/"N-" suffix modifiers (e.g., "5+" adds, "3-" subtracts).
 * @param {object} seasonClimate - Season's base climate { temperatures, presets }
 * @param {object} zoneOverride - Zone's override for this season { temperatures, presets }
 * @param {object} zoneFallback - Zone's default config { temperatures, presets } for backward compat
 * @param {string} season - Season name for temperature lookup
 * @returns {object} Merged config { probabilities, tempRange }
 */
export function mergeClimateConfig(seasonClimate, zoneOverride, zoneFallback, season) {
  const probabilities = {};
  let tempRange = { min: 10, max: 22 };
  const seasonPresets = Object.values(seasonClimate?.presets ?? {});
  if (seasonPresets.length) for (const preset of seasonPresets) if (preset.chance > 0) probabilities[preset.id] = preset.chance;
  const zonePresets = Object.values(zoneOverride?.presets ?? {});
  if (zonePresets.length) {
    for (const preset of zonePresets) {
      if (typeof preset.chance === 'string' && /^[+-]/.test(preset.chance)) {
        const delta = Number(preset.chance);
        if (!isNaN(delta)) {
          probabilities[preset.id] = Math.max(0, (probabilities[preset.id] ?? 0) + delta);
          if (probabilities[preset.id] === 0) delete probabilities[preset.id];
        }
      } else if (preset.chance === 0) {
        delete probabilities[preset.id];
      } else if (preset.chance > 0) {
        probabilities[preset.id] = preset.chance;
      }
    }
  } else {
    const fallbackPresets = Object.values(zoneFallback?.presets ?? {});
    if (fallbackPresets.length) for (const preset of fallbackPresets) if (preset.enabled && preset.chance > 0) probabilities[preset.id] = preset.chance;
  }
  const baseMin = seasonClimate?.temperatures?.min ?? 10;
  const baseMax = seasonClimate?.temperatures?.max ?? 22;
  if (zoneOverride?.temperatures?.min != null || zoneOverride?.temperatures?.max != null) {
    tempRange = { min: applyTempModifier(zoneOverride.temperatures.min, baseMin), max: applyTempModifier(zoneOverride.temperatures.max, baseMax) };
  } else if (seasonClimate?.temperatures?.min != null || seasonClimate?.temperatures?.max != null) {
    tempRange = { min: baseMin, max: baseMax };
  } else if (zoneFallback?.temperatures) {
    const temps = zoneFallback.temperatures;
    if (season && temps[season]) {
      tempRange = { min: applyTempModifier(temps[season].min, baseMin), max: applyTempModifier(temps[season].max, baseMax) };
    } else if (temps._default) {
      tempRange = temps._default;
    }
  }
  return { probabilities, tempRange };
}

/**
 * Generate weather using season climate as base with zone overrides.
 * @param {object} options - Generation options
 * @param {object} [options.seasonClimate] - Season's base climate { temperatures, presets }
 * @param {object} [options.zoneConfig] - Climate zone config object from calendar (for backward compat)
 * @param {string} [options.season] - Season name for temperature lookup and zone overrides
 * @param {number} [options.seed] - Random seed for deterministic generation
 * @param {object[]} [options.customPresets] - Custom weather presets
 * @param {string} [options.currentWeatherId] - Current weather ID for inertia calculation
 * @param {number} [options.inertia] - How much to favor current weather (0-1)
 * @returns {object} Generated weather { preset, temperature }
 */
export function generateWeather({ seasonClimate, zoneConfig, season, seed, customPresets = [], currentWeatherId = null, inertia = 0 }) {
  const randomFn = seed != null ? seededRandom(seed) : Math.random;
  const zoneOverride = season && zoneConfig?.seasonOverrides?.[season];
  let { probabilities, tempRange } = mergeClimateConfig(seasonClimate, zoneOverride, zoneConfig, season);
  if (Object.keys(probabilities).length === 0) probabilities.clear = 1;
  if (currentWeatherId && inertia > 0) probabilities = applyWeatherInertia(currentWeatherId, probabilities, inertia, customPresets, zoneConfig);
  const weatherId = weightedSelect(probabilities, randomFn);
  const preset = getPreset(weatherId, customPresets);
  let finalTempRange = { ...tempRange };
  const presetConfig = Object.values(zoneConfig?.presets ?? {}).find((p) => p.id === weatherId && p.enabled !== false);
  if (presetConfig?.tempMin != null) finalTempRange.min = applyTempModifier(presetConfig.tempMin, tempRange.min);
  if (presetConfig?.tempMax != null) finalTempRange.max = applyTempModifier(presetConfig.tempMax, tempRange.max);
  const temperature = Math.round(finalTempRange.min + randomFn() * (finalTempRange.max - finalTempRange.min));
  const resolvedPreset = preset || { id: weatherId, label: weatherId, icon: 'fa-question', color: '#888888' };
  const wind = generateWind(resolvedPreset, zoneConfig, randomFn);
  const precipitation = generatePrecipitation(resolvedPreset, randomFn);
  return { preset: resolvedPreset, temperature, wind, precipitation };
}

/**
 * Generate weather for a specific date using zone config.
 * Uses date-based seeding for consistent results.
 * @param {object} options - Generation options
 * @param {object} [options.seasonClimate] - Season's base climate
 * @param {object} options.zoneConfig - Climate zone config
 * @param {string} [options.season] - Season name
 * @param {number} options.year - Year
 * @param {number} options.month - Month (0-indexed)
 * @param {number} options.day - Day of month
 * @param {object[]} [options.customPresets] - Custom weather presets
 * @returns {object} Generated weather
 */
export function generateWeatherForDate({ seasonClimate, zoneConfig, season, year, month, day, customPresets = [] }) {
  const seed = dateSeed(year, month, day);
  return generateWeather({ seasonClimate, zoneConfig, season, seed, customPresets });
}

/**
 * Apply forecast variance to a generated weather result.
 * @param {object} weather - Generated weather { preset, temperature }
 * @param {number} dayDistance - Days from today (1 = tomorrow)
 * @param {number} totalDays - Total forecast window
 * @param {number} accuracy - 0-100 accuracy setting
 * @param {Function} randomFn - Random function
 * @param {object[]} customPresets - Custom presets
 * @returns {object} Potentially modified weather with `isVaried` flag
 */
export function applyForecastVariance(weather, dayDistance, totalDays, accuracy, randomFn, customPresets) {
  if (accuracy >= 100) return { ...weather, isVaried: false };
  const distanceFactor = dayDistance / totalDays;
  const varianceChance = (1 - accuracy / 100) * distanceFactor;
  let isVaried = false;
  let temperature = weather.temperature;
  let preset = weather.preset;
  const maxTempVariance = 8;
  const tempVariance = (randomFn() - 0.5) * 2 * maxTempVariance * (1 - accuracy / 100) * distanceFactor;
  temperature = Math.round(temperature + tempVariance);
  if (Math.abs(tempVariance) > 1) isVaried = true;
  if (randomFn() < varianceChance) {
    const sameCategory = getAllPresets(customPresets).filter((p) => p.category === preset.category && p.id !== preset.id);
    if (sameCategory.length > 0) {
      preset = sameCategory[Math.floor(randomFn() * sameCategory.length)];
      isVaried = true;
    }
  }
  return { preset, temperature, isVaried };
}

/**
 * Generate a forecast for multiple days using zone config.
 * @param {object} options - Generation options
 * @param {object} options.zoneConfig - Climate zone config
 * @param {string} [options.season] - Season name (assumed constant for forecast period)
 * @param {number} options.startYear - Starting year
 * @param {number} options.startMonth - Starting month (0-indexed)
 * @param {number} options.startDay - Starting day (1-indexed)
 * @param {number} [options.days] - Number of days to forecast
 * @param {object[]} [options.customPresets] - Custom weather presets
 * @param {Function} [options.getSeasonForDate] - Function to get season data for a date
 * @param {Function} [options.getDaysInMonth] - Function(month, year) returning days in that month. Set ._monthsPerYear for year rollover (default 12).
 * @param {string} [options.currentWeatherId] - Current weather ID for inertia chain start
 * @param {number} [options.inertia] - Inertia value (0-1) for path-dependent chaining
 * @param {number} [options.accuracy] - Forecast accuracy 0-100 (100 = perfect)
 * @returns {object[]} Array of weather forecasts
 */
export function generateForecast({
  zoneConfig,
  season,
  startYear,
  startMonth,
  startDay,
  days = 7,
  customPresets = [],
  getSeasonForDate,
  getDaysInMonth,
  currentWeatherId = null,
  inertia = 0,
  accuracy = 100
}) {
  const forecast = [];
  let year = startYear;
  let month = startMonth;
  let day = startDay;
  let previousWeatherId = currentWeatherId;
  for (let i = 0; i < days; i++) {
    const seasonData = getSeasonForDate ? getSeasonForDate(year, month, day) : null;
    const currentSeason = seasonData?.name ?? season;
    const seasonClimate = seasonData?.climate ?? null;
    const seed = dateSeed(year, month, day);
    const weather = generateWeather({ seasonClimate, zoneConfig, season: currentSeason, seed, customPresets, currentWeatherId: previousWeatherId, inertia });
    previousWeatherId = weather.preset.id;
    if (accuracy < 100) {
      const varied = applyForecastVariance(weather, i + 1, days, accuracy, seededRandom(seed + 1), customPresets);
      forecast.push({ year, month, day, ...varied });
    } else {
      forecast.push({ year, month, day, ...weather, isVaried: false });
    }
    day++;
    if (getDaysInMonth) {
      const dim = getDaysInMonth(month, year);
      if (day > dim) {
        day = 1;
        month++;
        const monthsPerYear = getDaysInMonth._monthsPerYear ?? 12;
        if (month >= monthsPerYear) {
          month = 0;
          year++;
        }
      }
    }
  }
  return forecast;
}

/**
 * Generate wind conditions based on preset, zone config, and forced wind rules.
 * @param {object} preset - Weather preset with wind defaults
 * @param {object} [zoneConfig] - Zone config (windDirections, windSpeedRange)
 * @param {Function} [randomFn] - Random function
 * @returns {{ speed: number, direction: number|null, forced: boolean }} Wind conditions
 */
function generateWind(preset, zoneConfig, randomFn = Math.random) {
  const compassValues = Object.values(COMPASS_DIRECTIONS);
  const randomCompass = () => compassValues[Math.floor(randomFn() * compassValues.length)];
  if (preset.wind?.forced) return { speed: preset.wind.speed, direction: preset.wind.direction ?? randomCompass(), forced: true };
  const baseSpeed = preset.wind?.speed ?? 0;
  const zoneMin = zoneConfig?.windSpeedRange?.min ?? 0;
  const zoneMax = zoneConfig?.windSpeedRange?.max ?? 5;
  const variance = Math.round((randomFn() - 0.5) * 2);
  const speed = Math.max(zoneMin, Math.min(zoneMax, baseSpeed + variance));
  let direction;
  const dirWeights = zoneConfig?.windDirections ?? {};
  if (Object.keys(dirWeights).length > 0) {
    const dirId = weightedSelect(dirWeights, randomFn);
    direction = COMPASS_DIRECTIONS[dirId] ?? randomCompass();
  } else {
    direction = preset.wind?.direction ?? randomCompass();
  }
  return { speed, direction, forced: false };
}

/**
 * Generate precipitation based on preset defaults with intensity variance.
 * @param {object} preset - Weather preset with precipitation defaults
 * @param {Function} [randomFn] - Random function
 * @returns {{ type: string|null, intensity: number }} Precipitation conditions
 */
function generatePrecipitation(preset, randomFn = Math.random) {
  const type = preset.precipitation?.type ?? null;
  if (!type) return { type: null, intensity: 0 };
  const baseIntensity = preset.precipitation?.intensity ?? 0.5;
  const variance = (randomFn() - 0.5) * 0.3;
  const intensity = Math.max(0.1, Math.min(1, baseIntensity + variance));
  return { type, intensity: Math.round(intensity * 100) / 100 };
}

/**
 * Apply weather transition smoothing.
 * Reduces jarring weather changes by considering previous weather.
 * Per-preset `inertiaWeight` scales the effect: 0 = never persists, 1 = normal, 2 = very sticky.
 * Zone-level overrides take priority over the preset's built-in value.
 * @param {string} currentWeatherId - Current weather ID
 * @param {object} probabilities - Base probabilities
 * @param {number} [inertia] - How much to favor current weather (0-1)
 * @param {object[]} [customPresets] - Custom presets for weight lookup
 * @param {object} [zoneConfig] - Zone config for per-preset inertiaWeight overrides
 * @returns {object} Adjusted probabilities
 */
export function applyWeatherInertia(currentWeatherId, probabilities, inertia = 0.3, customPresets = [], zoneConfig = null) {
  if (!currentWeatherId || !probabilities[currentWeatherId]) return probabilities;
  const zonePreset = zoneConfig?.presets ? Object.values(zoneConfig.presets).find((p) => p.id === currentWeatherId) : null;
  const preset = getPreset(currentWeatherId, customPresets);
  const weight = zonePreset?.inertiaWeight ?? preset?.inertiaWeight ?? 1;
  const effectiveInertia = Math.min(1, inertia * weight);
  if (effectiveInertia <= 0) return probabilities;
  const adjusted = { ...probabilities };
  const currentWeight = adjusted[currentWeatherId] || 0;
  const totalOther = Object.values(adjusted).reduce((sum, w) => sum + w, 0) - currentWeight;
  if (totalOther > 0) {
    const boost = totalOther * effectiveInertia;
    adjusted[currentWeatherId] = currentWeight + boost;
    for (const id of Object.keys(adjusted)) if (id !== currentWeatherId) adjusted[id] *= 1 - effectiveInertia;
  }
  return adjusted;
}
