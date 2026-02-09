/**
 * Procedural weather generation based on climate zones and seasons.
 * Uses weighted random selection with optional seeded randomness.
 * Uses zone-based config from calendar for generation.
 * @module Weather/WeatherGenerator
 * @author Tyler
 */

import { getPreset } from './weather-presets.mjs';

/**
 * Seeded random number generator (mulberry32).
 * @param {number} seed - Seed value
 * @returns {Function} Random function returning 0-1
 */
function seededRandom(seed) {
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
 * Merge season climate with zone overrides.
 * @param {object} seasonClimate - Season's base climate { temperatures, presets }
 * @param {object} zoneOverride - Zone's override for this season { temperatures, presets }
 * @param {object} zoneFallback - Zone's default config { temperatures, presets } for backward compat
 * @param {string} season - Season name for temperature lookup
 * @returns {object} Merged config { probabilities, tempRange }
 */
function mergeClimateConfig(seasonClimate, zoneOverride, zoneFallback, season) {
  const probabilities = {};
  let tempRange = { min: 10, max: 22 };
  const seasonPresets = Object.values(seasonClimate?.presets ?? {});
  if (seasonPresets.length) for (const preset of seasonPresets) if (preset.chance > 0) probabilities[preset.id] = preset.chance;
  const zonePresets = Object.values(zoneOverride?.presets ?? {});
  if (zonePresets.length) {
    for (const preset of zonePresets) {
      if (preset.chance === 0) delete probabilities[preset.id];
      else if (preset.chance > 0) probabilities[preset.id] = preset.chance;
    }
  } else {
    const fallbackPresets = Object.values(zoneFallback?.presets ?? {});
    if (fallbackPresets.length) for (const preset of fallbackPresets) if (preset.enabled && preset.chance > 0) probabilities[preset.id] = preset.chance;
  }
  if (zoneOverride?.temperatures?.min != null || zoneOverride?.temperatures?.max != null) tempRange = { min: zoneOverride.temperatures.min ?? 10, max: zoneOverride.temperatures.max ?? 22 };
  else if (seasonClimate?.temperatures?.min != null || seasonClimate?.temperatures?.max != null) tempRange = { min: seasonClimate.temperatures.min ?? 10, max: seasonClimate.temperatures.max ?? 22 };
  else if (zoneFallback?.temperatures) {
    const temps = zoneFallback.temperatures;
    if (season && temps[season]) tempRange = temps[season];
    else if (temps._default) tempRange = temps._default;
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
 * @returns {object} Generated weather { preset, temperature }
 */
export function generateWeather({ seasonClimate, zoneConfig, season, seed, customPresets = [] }) {
  const randomFn = seed != null ? seededRandom(seed) : Math.random;
  const zoneOverride = season && zoneConfig?.seasonOverrides?.[season];
  const { probabilities, tempRange } = mergeClimateConfig(seasonClimate, zoneOverride, zoneConfig, season);
  if (Object.keys(probabilities).length === 0) probabilities.clear = 1;
  const weatherId = weightedSelect(probabilities, randomFn);
  const preset = getPreset(weatherId, customPresets);
  let finalTempRange = { ...tempRange };
  const presetConfig = Object.values(zoneConfig?.presets ?? {}).find((p) => p.id === weatherId && p.enabled !== false);
  if (presetConfig?.tempMin != null) finalTempRange.min = presetConfig.tempMin;
  if (presetConfig?.tempMax != null) finalTempRange.max = presetConfig.tempMax;
  const temperature = Math.round(finalTempRange.min + randomFn() * (finalTempRange.max - finalTempRange.min));
  return { preset: preset || { id: weatherId, label: weatherId, icon: 'fa-question', color: '#888888' }, temperature };
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
 * Generate a forecast for multiple days using zone config.
 * @param {object} options - Generation options
 * @param {object} options.zoneConfig - Climate zone config
 * @param {string} [options.season] - Season name (assumed constant for forecast period)
 * @param {number} options.startYear - Starting year
 * @param {number} options.startMonth - Starting month (0-indexed)
 * @param {number} options.startDay - Starting day
 * @param {number} [options.days] - Number of days to forecast
 * @param {object[]} [options.customPresets] - Custom weather presets
 * @param {Function} [options.getSeasonForDate] - Function to get season data for a date
 * @returns {object[]} Array of weather forecasts
 */
export function generateForecast({ zoneConfig, season, startYear, startMonth, startDay, days = 7, customPresets = [], getSeasonForDate }) {
  const forecast = [];
  let year = startYear;
  let month = startMonth;
  let day = startDay;
  for (let i = 0; i < days; i++) {
    const seasonData = getSeasonForDate ? getSeasonForDate(year, month, day) : null;
    const currentSeason = seasonData?.name ?? season;
    const seasonClimate = seasonData?.climate ?? null;
    const weather = generateWeatherForDate({ seasonClimate, zoneConfig, season: currentSeason, year, month, day, customPresets });
    forecast.push({ year, month, day, ...weather });
    day++;
  }
  return forecast;
}

/**
 * Apply weather transition smoothing.
 * Reduces jarring weather changes by considering previous weather.
 * @param {string} currentWeatherId - Current weather ID
 * @param {object} probabilities - Base probabilities
 * @param {number} [inertia] - How much to favor current weather (0-1)
 * @returns {object} Adjusted probabilities
 */
export function applyWeatherInertia(currentWeatherId, probabilities, inertia = 0.3) {
  if (!currentWeatherId || !probabilities[currentWeatherId]) return probabilities;
  const adjusted = { ...probabilities };
  const currentWeight = adjusted[currentWeatherId] || 0;
  const totalOther = Object.values(adjusted).reduce((sum, w) => sum + w, 0) - currentWeight;
  if (totalOther > 0) {
    const boost = totalOther * inertia;
    adjusted[currentWeatherId] = currentWeight + boost;
    for (const id of Object.keys(adjusted)) if (id !== currentWeatherId) adjusted[id] *= 1 - inertia;
  }
  return adjusted;
}
