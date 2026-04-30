import { COMPASS_DIRECTIONS, WEATHER_PERIODS, WIND_SPEEDS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import { getAllPresets, getPreset } from './data/weather-presets.mjs';

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
 * Generate a seed for a specific intraday period.
 * @param {number} year - Year
 * @param {number} month - Month (0-indexed)
 * @param {number} day - Day of month
 * @param {number} periodIndex - Period index (0=night, 1=morning, 2=afternoon, 3=evening)
 * @returns {number} Period-specific seed value
 */
export function periodSeed(year, month, day, periodIndex) {
  return dateSeed(year, month, day) * 4 + periodIndex;
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
  if (totalWeight <= 0) {
    log(2, 'Weather selection: all weights zero, using random fallback');
    return entries[Math.floor(randomFn() * entries.length)][0];
  }
  let roll = randomFn() * totalWeight;
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

/**
 * Check whether a stored temperature value is a relative modifier ("N+"/"N-").
 * @param {number|string|null|undefined} value - Stored temperature value
 * @returns {boolean} True if value is a relative modifier string
 */
export function isRelativeTempModifier(value) {
  return typeof value === 'string' && /[+-]$/.test(value);
}

/**
 * Apply a temperature value that may be a relative modifier or absolute.
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
 * @param {object} seasonClimate - Season's base climate { temperatures, presets }
 * @param {object} zoneOverride - Zone's override for this season { temperatures, presets }
 * @param {object} zoneFallback - Zone's default config { temperatures, presets } for backward compat
 * @param {string} season - Season name for temperature lookup
 * @returns {object} Merged config { probabilities, tempRange }
 */
export function mergeClimateConfig(seasonClimate, zoneOverride, zoneFallback, season) {
  const probabilities = {};
  let tempRange = { min: 10, max: 22 };
  const rawZonePresets = zoneOverride?.presets;
  const zonePresets = rawZonePresets ? Object.values(rawZonePresets) : [];
  if (zonePresets.length) {
    for (const preset of Object.values(seasonClimate?.presets ?? {})) if (preset.chance > 0) probabilities[preset.id] = preset.chance;
    for (const preset of zonePresets) {
      if (typeof preset.chance === 'string' && /[+-]$/.test(preset.chance)) {
        const suffix = preset.chance.slice(-1);
        const value = Number(preset.chance.slice(0, -1));
        if (!isNaN(value)) {
          const delta = suffix === '+' ? value : -value;
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
    for (const preset of Object.values(seasonClimate?.presets ?? {})) if (preset.chance > 0) probabilities[preset.id] = preset.chance;
  }
  const baseMin = seasonClimate?.temperatures?.min ?? 10;
  const baseMax = seasonClimate?.temperatures?.max ?? 22;
  if (zoneOverride?.temperatures?.min != null || zoneOverride?.temperatures?.max != null) {
    tempRange = { min: applyTempModifier(zoneOverride.temperatures.min, baseMin), max: applyTempModifier(zoneOverride.temperatures.max, baseMax) };
  } else if (season && zoneFallback?.temperatures?.[season]) {
    const temps = zoneFallback.temperatures[season];
    tempRange = { min: applyTempModifier(temps.min, baseMin), max: applyTempModifier(temps.max, baseMax) };
  } else if (seasonClimate?.temperatures?.min != null || seasonClimate?.temperatures?.max != null) {
    tempRange = { min: baseMin, max: baseMax };
  } else if (zoneFallback?.temperatures?._default) {
    tempRange = zoneFallback.temperatures._default;
  }
  const rawFallbackPresets = zoneFallback?.presets;
  if (rawFallbackPresets && Object.keys(rawFallbackPresets).length > 0) {
    const seasonPresetMap = rawZonePresets ?? {};
    const enabledIds = new Set(
      Object.values(rawFallbackPresets)
        .filter((p) => {
          if (!p?.id) return false;
          const seasonP = seasonPresetMap[p.id];
          return (seasonP?.enabled ?? p.enabled) !== false;
        })
        .map((p) => p.id)
    );
    for (const id of Object.keys(probabilities)) if (!enabledIds.has(id)) delete probabilities[id];
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
 * @param {object|null} [options.previousWeather] - Previous weather for value-level blending { temperature, wind }
 * @returns {object} Generated weather { preset, temperature }
 */
export function generateWeather({ seasonClimate, zoneConfig, season, seed, customPresets = [], currentWeatherId = null, inertia = 0, previousWeather = null }) {
  const randomFn = seed != null ? seededRandom(seed) : Math.random;
  const zoneOverride = season && zoneConfig?.seasonOverrides?.[season];
  let { probabilities, tempRange } = mergeClimateConfig(seasonClimate, zoneOverride, zoneConfig, season);
  if (Object.keys(probabilities).length === 0) {
    const rawZonePresets = zoneConfig?.presets;
    const seasonPresetMap = zoneOverride?.presets ?? {};
    if (rawZonePresets && Object.keys(rawZonePresets).length > 0) {
      const enabledIds = new Set(
        Object.values(rawZonePresets)
          .filter((p) => {
            if (!p?.id) return false;
            return (seasonPresetMap[p.id]?.enabled ?? p.enabled) !== false;
          })
          .map((p) => p.id)
      );
      for (const preset of getAllPresets(customPresets)) if (enabledIds.has(preset.id)) probabilities[preset.id] = 1;
    }
    if (Object.keys(probabilities).length === 0) for (const preset of getAllPresets(customPresets)) probabilities[preset.id] = 1;
    if (Object.keys(probabilities).length === 0) probabilities.clear = 1;
  }
  for (const [id, weight] of Object.entries(probabilities)) {
    if (weight <= 0) continue;
    const seasonP = zoneOverride?.presets?.[id];
    const zoneP = Object.values(zoneConfig?.presets ?? {}).find((pp) => pp.id === id && pp.enabled !== false);
    const hasOverride = seasonP?.tempMin != null || seasonP?.tempMax != null || zoneP?.tempMin != null || zoneP?.tempMax != null;
    if (!hasOverride) continue;
    const p = getPreset(id, customPresets);
    const effMin = seasonP?.tempMin ?? zoneP?.tempMin ?? p?.tempMin;
    const effMax = seasonP?.tempMax ?? zoneP?.tempMax ?? p?.tempMax;
    if (isRelativeTempModifier(effMin) || isRelativeTempModifier(effMax)) continue;
    const resolvedMin = effMin != null ? applyTempModifier(effMin, tempRange.min) : null;
    const resolvedMax = effMax != null ? applyTempModifier(effMax, tempRange.max) : null;
    if (resolvedMin != null && resolvedMax != null && (resolvedMin > tempRange.max || resolvedMax < tempRange.min)) probabilities[id] = 0;
  }
  if (currentWeatherId && inertia > 0) probabilities = applyWeatherInertia(currentWeatherId, probabilities, inertia, customPresets, zoneConfig, season);
  const weatherId = weightedSelect(probabilities, randomFn);
  const preset = getPreset(weatherId, customPresets);
  let finalTempRange = { ...tempRange };
  const seasonPresetConfig = zoneOverride?.presets?.[weatherId];
  const zonePresetConfig = Object.values(zoneConfig?.presets ?? {}).find((p) => p.id === weatherId && p.enabled !== false);
  const hasPresetOverride = seasonPresetConfig?.tempMin != null || seasonPresetConfig?.tempMax != null || zonePresetConfig?.tempMin != null || zonePresetConfig?.tempMax != null;
  if (hasPresetOverride) {
    const effectiveTempMin = seasonPresetConfig?.tempMin ?? zonePresetConfig?.tempMin ?? preset?.tempMin;
    const effectiveTempMax = seasonPresetConfig?.tempMax ?? zonePresetConfig?.tempMax ?? preset?.tempMax;
    if (effectiveTempMin != null) {
      const resolved = applyTempModifier(effectiveTempMin, tempRange.min);
      finalTempRange.min = isRelativeTempModifier(effectiveTempMin) ? resolved : Math.max(finalTempRange.min, resolved);
    }
    if (effectiveTempMax != null) {
      const resolved = applyTempModifier(effectiveTempMax, tempRange.max);
      finalTempRange.max = isRelativeTempModifier(effectiveTempMax) ? resolved : Math.min(finalTempRange.max, resolved);
    }
    if (finalTempRange.min > finalTempRange.max) finalTempRange = { ...tempRange };
  }
  let temperature = Math.round(finalTempRange.min + randomFn() * (finalTempRange.max - finalTempRange.min));
  const resolvedPreset = preset || { id: weatherId, label: weatherId, icon: 'fa-question', color: '#888888' };
  const wind = generateWind(resolvedPreset, zoneConfig, randomFn);
  const precipitation = generatePrecipitation(resolvedPreset, randomFn);
  if (previousWeather && inertia > 0) {
    if (previousWeather.temperature != null) temperature = Math.round(previousWeather.temperature * inertia + temperature * (1 - inertia));
    if (previousWeather.wind && !wind.forced) {
      wind.speed = Math.round(previousWeather.wind.speed * inertia + wind.speed * (1 - inertia));
      wind.kph = resolveWindKph(wind.speed, randomFn);
      if (previousWeather.wind.direction != null && wind.direction != null) wind.direction = lerpAngle(previousWeather.wind.direction, wind.direction, 1 - inertia);
    }
  }
  temperature = Math.max(finalTempRange.min, Math.min(finalTempRange.max, temperature));
  return { preset: resolvedPreset, temperature, wind, precipitation, probabilities };
}

/**
 * Roll a temperature value for a preset using the same range resolution as generateWeather.
 * @param {object} options - Roll options
 * @param {string} options.presetId - Preset ID to roll against
 * @param {object} [options.seasonClimate] - Season's base climate { temperatures, presets }
 * @param {object} [options.zoneConfig] - Zone config { temperatures, presets, seasonOverrides }
 * @param {string} [options.season] - Season name for zone overrides / fallbacks
 * @param {object[]} [options.customPresets] - Custom presets list
 * @param {Function} [options.randomFn] - Random function (defaults to Math.random)
 * @returns {number} Rounded temperature value (internal units)
 */
export function rollPresetTemperature({ presetId, seasonClimate, zoneConfig, season, customPresets = [], randomFn = Math.random }) {
  const zoneOverride = season && zoneConfig?.seasonOverrides?.[season];
  const { tempRange } = mergeClimateConfig(seasonClimate, zoneOverride, zoneConfig, season);
  const preset = getPreset(presetId, customPresets);
  let finalTempRange = { ...tempRange };
  const seasonPresetConfig = zoneOverride?.presets?.[presetId];
  const zonePresetConfig = Object.values(zoneConfig?.presets ?? {}).find((p) => p.id === presetId && p.enabled !== false);
  const hasPresetOverride = seasonPresetConfig?.tempMin != null || seasonPresetConfig?.tempMax != null || zonePresetConfig?.tempMin != null || zonePresetConfig?.tempMax != null;
  if (hasPresetOverride) {
    const effectiveTempMin = seasonPresetConfig?.tempMin ?? zonePresetConfig?.tempMin ?? preset?.tempMin;
    const effectiveTempMax = seasonPresetConfig?.tempMax ?? zonePresetConfig?.tempMax ?? preset?.tempMax;
    if (effectiveTempMin != null) {
      const resolved = applyTempModifier(effectiveTempMin, tempRange.min);
      finalTempRange.min = isRelativeTempModifier(effectiveTempMin) ? resolved : Math.max(finalTempRange.min, resolved);
    }
    if (effectiveTempMax != null) {
      const resolved = applyTempModifier(effectiveTempMax, tempRange.max);
      finalTempRange.max = isRelativeTempModifier(effectiveTempMax) ? resolved : Math.min(finalTempRange.max, resolved);
    }
    if (finalTempRange.min > finalTempRange.max) finalTempRange = { ...tempRange };
  }
  return Math.round(finalTempRange.min + randomFn() * (finalTempRange.max - finalTempRange.min));
}

/**
 * Generate weather for a specific date using zone config.
 * @param {object} options - Generation options
 * @param {object} [options.seasonClimate] - Season's base climate
 * @param {object} options.zoneConfig - Climate zone config
 * @param {string} [options.season] - Season name
 * @param {number} options.year - Year
 * @param {number} options.month - Month (0-indexed)
 * @param {number} options.dayOfMonth - Day of month (0-indexed)
 * @param {object[]} [options.customPresets] - Custom weather presets
 * @returns {object} Generated weather
 */
export function generateWeatherForDate({ seasonClimate, zoneConfig, season, year, month, dayOfMonth, customPresets = [] }) {
  const seed = dateSeed(year, month, dayOfMonth);
  return generateWeather({ seasonClimate, zoneConfig, season, seed, customPresets });
}

/**
 * Generate weather for all 4 intraday periods with chained inertia.
 * Period order: night → morning → afternoon → evening.
 * @param {object} options - Generation options
 * @param {object} [options.seasonClimate] - Season's base climate
 * @param {object} options.zoneConfig - Climate zone config
 * @param {string} [options.season] - Season name
 * @param {number} options.year - Year
 * @param {number} options.month - Month (0-indexed)
 * @param {number} options.dayOfMonth - Day of month (0-indexed)
 * @param {object[]} [options.customPresets] - Custom weather presets
 * @param {number} [options.carryOverChance] - Chance (0-100) that a period copies the previous period's weather instead of generating new (default 50)
 * @param {string} [options.currentWeatherId] - Current weather ID for first period's inertia
 * @param {number} [options.inertia] - Day-level inertia (0-1), used for all periods
 * @param {object|null} [options.previousWeather] - Previous weather for first period blending { temperature, wind }
 * @returns {{ dominant: object, periods: object }} Dominant weather and per-period breakdown
 */
export function generateIntradayWeather({
  seasonClimate,
  zoneConfig,
  season,
  year,
  month,
  dayOfMonth,
  customPresets = [],
  carryOverChance = 50,
  currentWeatherId = null,
  inertia = 0,
  previousWeather = null
}) {
  const periodOrder = [WEATHER_PERIODS.NIGHT, WEATHER_PERIODS.MORNING, WEATHER_PERIODS.AFTERNOON, WEATHER_PERIODS.EVENING];
  const periods = {};
  let prevId = currentWeatherId;
  let prevWeather = previousWeather;
  let prevResult = null;
  for (const period of periodOrder) {
    const seed = periodSeed(year, month, dayOfMonth, period.index);
    const isFirst = period.index === 0;
    if (!isFirst && prevResult && carryOverChance > 0) {
      const rng = seededRandom(seed + 7919);
      if (rng() * 100 < carryOverChance) {
        periods[period.id] = { ...prevResult };
        continue;
      }
    }
    const weather = generateWeather({ seasonClimate, zoneConfig, season, seed, customPresets, currentWeatherId: prevId, inertia, previousWeather: prevWeather });
    periods[period.id] = weather;
    prevId = weather.preset.id;
    prevWeather = { temperature: weather.temperature, wind: weather.wind };
    prevResult = weather;
  }
  const dominant = periods.morning;
  return { dominant, periods };
}

/**
 * Apply forecast variance to a generated weather result.
 * @param {object} weather - Generated weather { preset, temperature }
 * @param {number} dayDistance - Days from today (1 = tomorrow)
 * @param {number} totalDays - Total forecast window
 * @param {number} accuracy - 0-100 accuracy setting
 * @param {Function} randomFn - Random function
 * @param {object[]} customPresets - Custom presets
 * @param {string[]} [validPresetIds] - Valid preset IDs for the season/zone (restricts variance pool)
 * @returns {object} Potentially modified weather with `isVaried` flag
 */
export function applyForecastVariance(weather, dayDistance, totalDays, accuracy, randomFn, customPresets, validPresetIds) {
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
    const validSet = validPresetIds?.length ? new Set(validPresetIds) : null;
    const sameCategory = getAllPresets(customPresets).filter((p) => p.category === preset.category && p.id !== preset.id && (!validSet || validSet.has(p.id)));
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
 * @param {number} options.startDayOfMonth - Starting day of month (0-indexed)
 * @param {number} [options.days] - Number of days to forecast
 * @param {object[]} [options.customPresets] - Custom weather presets
 * @param {Function} [options.getSeasonForDate] - Function to get season data for a date
 * @param {Function} [options.getDaysInMonth] - Function(month, year) returning days in that month. Set ._monthsPerYear for year rollover (default 12).
 * @param {string} [options.currentWeatherId] - Current weather ID for inertia chain start
 * @param {number} [options.inertia] - Inertia value (0-1) for path-dependent chaining
 * @param {number} [options.accuracy] - Forecast accuracy 0-100 (100 = perfect)
 * @param {object|null} [options.previousWeather] - Previous weather for value-level blending { temperature, wind }
 * @param {boolean} [options.intraday] - Generate per-period weather for each day
 * @param {number} [options.carryOverChance] - Chance (0-100) that a period copies the previous period's weather (default 50)
 * @returns {object[]} Array of weather forecasts
 */
export function generateForecast({
  zoneConfig,
  season,
  startYear,
  startMonth,
  startDayOfMonth,
  days = 7,
  customPresets = [],
  getSeasonForDate,
  getDaysInMonth,
  currentWeatherId = null,
  inertia = 0,
  accuracy = 100,
  previousWeather = null,
  intraday = false,
  carryOverChance = 50
}) {
  const forecast = [];
  let year = startYear;
  let month = startMonth;
  let dayOfMonth = startDayOfMonth;
  let previousWeatherId = currentWeatherId;
  let prevWeather = previousWeather;
  for (let i = 0; i < days; i++) {
    const seasonData = getSeasonForDate ? getSeasonForDate(year, month, dayOfMonth) : null;
    const currentSeason = seasonData?.name ?? season;
    const seasonClimate = seasonData?.climate ?? null;
    if (intraday) {
      const result = generateIntradayWeather({
        seasonClimate,
        zoneConfig,
        season: currentSeason,
        year,
        month,
        dayOfMonth,
        customPresets,
        carryOverChance,
        currentWeatherId: previousWeatherId,
        inertia,
        previousWeather: prevWeather
      });
      previousWeatherId = result.periods.evening.preset.id;
      prevWeather = { temperature: result.periods.evening.temperature, wind: result.periods.evening.wind };
      const entry = { year, month, dayOfMonth, ...result.dominant, isVaried: false, periods: result.periods };
      if (accuracy < 100) {
        const seed = dateSeed(year, month, dayOfMonth);
        const validPresetIds = Object.keys(result.dominant.probabilities ?? {});
        const varied = applyForecastVariance(entry, i + 1, days, accuracy, seededRandom(seed + 1), customPresets, validPresetIds);
        forecast.push({ ...entry, ...varied, periods: entry.periods });
      } else {
        forecast.push(entry);
      }
    } else {
      const seed = dateSeed(year, month, dayOfMonth);
      const weather = generateWeather({ seasonClimate, zoneConfig, season: currentSeason, seed, customPresets, currentWeatherId: previousWeatherId, inertia, previousWeather: prevWeather });
      previousWeatherId = weather.preset.id;
      prevWeather = { temperature: weather.temperature, wind: weather.wind };
      if (accuracy < 100) {
        const validPresetIds = Object.keys(weather.probabilities ?? {});
        const varied = applyForecastVariance(weather, i + 1, days, accuracy, seededRandom(seed + 1), customPresets, validPresetIds);
        forecast.push({ year, month, dayOfMonth, ...varied });
      } else {
        forecast.push({ year, month, dayOfMonth, ...weather, isVaried: false });
      }
    }
    dayOfMonth++;
    if (getDaysInMonth) {
      const dim = getDaysInMonth(month, year);
      if (dayOfMonth >= dim) {
        dayOfMonth = 0;
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
 * Resolve a kph value for a wind speed scale value (0-5) deterministically.
 * @param {number} speed - Wind speed on 0-5 scale
 * @param {Function} [randomFn] - Random function
 * @returns {number} Speed in kph
 */
function resolveWindKph(speed, randomFn = Math.random) {
  const speeds = Object.values(WIND_SPEEDS);
  const entry = speeds.find((w) => w.value === speed);
  if (!entry) return 0;
  const prevEntry = speeds.find((w) => w.value === speed - 1);
  const min = prevEntry ? prevEntry.kph + 1 : 0;
  const max = entry.kph;
  return Math.floor(randomFn() * (max - min + 1)) + min;
}

/**
 * Generate wind conditions based on preset, zone config, and forced wind rules.
 * @param {object} preset - Weather preset with wind defaults
 * @param {object} [zoneConfig] - Zone config (windDirections, windSpeedRange)
 * @param {Function} [randomFn] - Random function
 * @returns {{ speed: number, kph: number, direction: number|null, forced: boolean }} Wind conditions
 */
function generateWind(preset, zoneConfig, randomFn = Math.random) {
  const compassValues = Object.values(COMPASS_DIRECTIONS);
  const randomCompass = () => compassValues[Math.floor(randomFn() * compassValues.length)];
  if (preset.wind?.forced) {
    const kph = resolveWindKph(preset.wind.speed, randomFn);
    return { speed: preset.wind.speed, kph, direction: preset.wind.direction ?? randomCompass(), forced: true };
  }
  const baseSpeed = preset.wind?.speed ?? 0;
  const zoneMin = zoneConfig?.windSpeedRange?.min ?? 0;
  const zoneMax = zoneConfig?.windSpeedRange?.max ?? 5;
  const variance = Math.round((randomFn() - 0.5) * 2);
  const speed = Math.max(zoneMin, Math.min(zoneMax, baseSpeed + variance));
  const kph = resolveWindKph(speed, randomFn);
  let direction;
  const dirWeights = zoneConfig?.windDirections ?? {};
  if (Object.keys(dirWeights).length > 0) {
    const dirId = weightedSelect(dirWeights, randomFn);
    direction = COMPASS_DIRECTIONS[dirId] ?? randomCompass();
  } else {
    direction = preset.wind?.direction ?? randomCompass();
  }
  return { speed, kph, direction, forced: false };
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
 * Interpolate between two angles (degrees) taking the shortest path.
 * @param {number} from - Start angle in degrees
 * @param {number} to - End angle in degrees
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated angle snapped to nearest compass point
 */
function lerpAngle(from, to, t) {
  let diff = to - from;
  if (diff > 180) diff -= 360;
  else if (diff < -180) diff += 360;
  const result = (((from + diff * t) % 360) + 360) % 360;
  return Math.round(result / 22.5) * 22.5;
}

/**
 * Apply weather transition smoothing.
 * @param {string} currentWeatherId - Current weather ID
 * @param {object} probabilities - Base probabilities
 * @param {number} [inertia] - How much to favor current weather (0-1)
 * @param {object[]} [customPresets] - Custom presets for weight lookup
 * @param {object} [zoneConfig] - Zone config for per-preset inertiaWeight overrides
 * @param {string} [season] - Season name for per-season inertiaWeight lookup
 * @returns {object} Adjusted probabilities
 */
export function applyWeatherInertia(currentWeatherId, probabilities, inertia = 0.3, customPresets = [], zoneConfig = null, season = null) {
  if (!currentWeatherId || !probabilities[currentWeatherId]) return probabilities;
  const seasonPreset = season ? zoneConfig?.seasonOverrides?.[season]?.presets?.[currentWeatherId] : null;
  const zonePreset = zoneConfig?.presets ? Object.values(zoneConfig.presets).find((p) => p.id === currentWeatherId) : null;
  const preset = getPreset(currentWeatherId, customPresets);
  const weight = seasonPreset?.inertiaWeight ?? zonePreset?.inertiaWeight ?? preset?.inertiaWeight ?? 1;
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
