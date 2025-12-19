/**
 * Climate zone templates for procedural weather generation.
 * Each template defines default temperature ranges and weather probabilities by season.
 * Templates can be copied to create calendar-specific climate zones.
 *
 * @module Weather/ClimateData
 * @author Tyler
 */

import { ALL_PRESETS } from './weather-presets.mjs';

/**
 * Climate zone template definitions.
 * Weather probabilities are relative weights (higher = more likely).
 * Temperatures are stored per-season with a _default fallback.
 *
 * @type {object}
 */
export const CLIMATE_ZONE_TEMPLATES = {
  arctic: {
    id: 'arctic',
    name: 'CALENDARIA.Weather.Climate.Arctic',
    description: 'CALENDARIA.Weather.Climate.ArcticDesc',
    temperatures: { Spring: { min: -15, max: 0 }, Summer: { min: -5, max: 8 }, Autumn: { min: -20, max: -5 }, Winter: { min: -45, max: -20 }, _default: { min: -25, max: -5 } },
    weather: {
      summer: { clear: 3, 'partly-cloudy': 3, snow: 3, blizzard: 2, windy: 3, fog: 1 },
      winter: { blizzard: 6, snow: 5, overcast: 2, windy: 4 },
      default: { snow: 5, blizzard: 4, overcast: 3, windy: 3, clear: 1 }
    }
  },

  subarctic: {
    id: 'subarctic',
    name: 'CALENDARIA.Weather.Climate.Subarctic',
    description: 'CALENDARIA.Weather.Climate.SubarcticDesc',
    temperatures: { Spring: { min: -10, max: 8 }, Summer: { min: 5, max: 18 }, Autumn: { min: -5, max: 10 }, Winter: { min: -35, max: -10 }, _default: { min: -10, max: 5 } },
    weather: {
      summer: { clear: 4, 'partly-cloudy': 4, rain: 3, snow: 1, mist: 2 },
      winter: { snow: 6, blizzard: 4, overcast: 3, windy: 3 },
      default: { snow: 4, cloudy: 3, overcast: 3, windy: 2, clear: 2 }
    }
  },

  temperate: {
    id: 'temperate',
    name: 'CALENDARIA.Weather.Climate.Temperate',
    description: 'CALENDARIA.Weather.Climate.TemperateDesc',
    temperatures: { Spring: { min: 8, max: 18 }, Summer: { min: 18, max: 30 }, Autumn: { min: 8, max: 18 }, Winter: { min: -5, max: 5 }, _default: { min: 8, max: 20 } },
    weather: {
      summer: { clear: 6, 'partly-cloudy': 4, thunderstorm: 2, rain: 2 },
      winter: { snow: 5, blizzard: 2, fog: 2, overcast: 3, clear: 2 },
      spring: { rain: 4, drizzle: 3, 'partly-cloudy': 3, clear: 2, mist: 2 },
      autumn: { cloudy: 4, rain: 3, fog: 3, 'partly-cloudy': 2, windy: 2 },
      default: { rain: 3, cloudy: 3, mist: 2, drizzle: 2, clear: 3 }
    }
  },

  subtropical: {
    id: 'subtropical',
    name: 'CALENDARIA.Weather.Climate.Subtropical',
    description: 'CALENDARIA.Weather.Climate.SubtropicalDesc',
    temperatures: { Spring: { min: 15, max: 28 }, Summer: { min: 22, max: 35 }, Autumn: { min: 15, max: 28 }, Winter: { min: 5, max: 17 }, _default: { min: 12, max: 28 } },
    weather: {
      summer: { clear: 5, 'partly-cloudy': 4, rain: 5, drizzle: 2, thunderstorm: 3, sunshower: 1 },
      winter: { clear: 2, cloudy: 4, rain: 3, mist: 2, fog: 1 },
      default: { clear: 4, 'partly-cloudy': 5, cloudy: 3, rain: 2 }
    }
  },

  tropical: {
    id: 'tropical',
    name: 'CALENDARIA.Weather.Climate.Tropical',
    description: 'CALENDARIA.Weather.Climate.TropicalDesc',
    temperatures: { Spring: { min: 24, max: 32 }, Summer: { min: 26, max: 35 }, Autumn: { min: 24, max: 32 }, Winter: { min: 22, max: 30 }, _default: { min: 24, max: 35 } },
    weather: { default: { clear: 8, 'partly-cloudy': 5, rain: 7, thunderstorm: 3, fog: 2, sunshower: 1 } }
  },

  arid: {
    id: 'arid',
    name: 'CALENDARIA.Weather.Climate.Arid',
    description: 'CALENDARIA.Weather.Climate.AridDesc',
    temperatures: { Spring: { min: 18, max: 35 }, Summer: { min: 28, max: 48 }, Autumn: { min: 18, max: 35 }, Winter: { min: 5, max: 22 }, _default: { min: 15, max: 40 } },
    weather: {
      summer: { clear: 10, 'partly-cloudy': 3, sandstorm: 2, windy: 1 },
      winter: { clear: 6, 'partly-cloudy': 4, cloudy: 2, drizzle: 1 },
      default: { clear: 8, 'partly-cloudy': 4, sandstorm: 1, windy: 1 }
    }
  },

  polar: {
    id: 'polar',
    name: 'CALENDARIA.Weather.Climate.Polar',
    description: 'CALENDARIA.Weather.Climate.PolarDesc',
    temperatures: { Spring: { min: -20, max: -5 }, Summer: { min: -5, max: 10 }, Autumn: { min: -25, max: -10 }, Winter: { min: -50, max: -25 }, _default: { min: -30, max: -10 } },
    weather: {
      summer: { clear: 4, 'partly-cloudy': 3, windy: 2, mist: 1, snow: 2 },
      winter: { blizzard: 6, snow: 5, overcast: 2, windy: 3 },
      default: { snow: 4, overcast: 3, blizzard: 2, windy: 2, clear: 1 }
    }
  }
};

/**
 * Get a climate zone template by ID.
 * @param {string} id - Climate zone ID
 * @returns {object|null} Climate zone template or null
 */
export function getClimateZoneTemplate(id) {
  return CLIMATE_ZONE_TEMPLATES[id] ?? null;
}

/**
 * Get all climate zone template IDs.
 * @returns {string[]} Climate zone IDs
 */
export function getClimateZoneTemplateIds() {
  return Object.keys(CLIMATE_ZONE_TEMPLATES);
}

/**
 * Get a fully populated zone config object from a template.
 * Includes preset configurations based on the template's weather probabilities.
 * @param {string} templateId - Climate zone template ID
 * @param {string[]} [seasonNames=['Spring', 'Summer', 'Autumn', 'Winter']] - Season names for temperature keys
 * @returns {object|null} Populated zone config object
 */
export function getDefaultZoneConfig(templateId, seasonNames = ['Spring', 'Summer', 'Autumn', 'Winter']) {
  const template = getClimateZoneTemplate(templateId);
  if (!template) return null;

  // Build temperatures object using provided season names
  const temperatures = { _default: template.temperatures._default ?? { min: 10, max: 22 } };
  for (const season of seasonNames) {
    // Try to match season name to template temperatures
    const templateTemp = template.temperatures[season] ?? template.temperatures[season.toLowerCase()] ?? template.temperatures._default;
    if (templateTemp) temperatures[season] = { ...templateTemp };
  }

  // Build preset configurations from weather probabilities
  const presets = [];
  const defaultWeather = template.weather?.default ?? {};
  const totalWeight = Object.values(defaultWeather).reduce((sum, w) => sum + w, 0);

  for (const preset of ALL_PRESETS) {
    const weight = defaultWeather[preset.id] ?? 0;
    const chance = totalWeight > 0 ? Math.round((weight / totalWeight) * 100 * 100) / 100 : 0;
    presets.push({ id: preset.id, enabled: weight > 0, chance, tempMin: preset.tempMin ?? null, tempMax: preset.tempMax ?? null });
  }

  return { id: template.id, name: template.name, description: template.description ?? '', temperatures, presets };
}

/**
 * Normalize season name to match climate data keys.
 * @param {string} seasonName - Season name (may be localized)
 * @returns {string} Normalized season key
 */
export function normalizeSeasonName(seasonName) {
  if (!seasonName) return 'default';

  const lower = seasonName.toLowerCase();

  // Common mappings
  if (lower.includes('spring') || lower.includes('vernal')) return 'spring';
  if (lower.includes('summer') || lower.includes('estival')) return 'summer';
  if (lower.includes('autumn') || lower.includes('fall') || lower.includes('autumnal')) return 'autumn';
  if (lower.includes('winter') || lower.includes('hibernal')) return 'winter';

  return 'default';
}

/**
 * Get all template IDs as options for a dropdown.
 * @returns {Array<{value: string, label: string}>} Options array
 */
export function getClimateTemplateOptions() {
  return Object.values(CLIMATE_ZONE_TEMPLATES).map((t) => ({ value: t.id, label: t.name }));
}
