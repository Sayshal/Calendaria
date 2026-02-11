/**
 * Built-in weather presets for the Calendaria weather system.
 * GMs can add custom presets via settings.
 * @module Weather/WeatherPresets
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';

/**
 * Standard weather conditions - common everyday weather.
 * @type {object[]}
 */
export const STANDARD_WEATHER = [
  {
    id: 'clear',
    label: 'CALENDARIA.Weather.Clear',
    description: 'CALENDARIA.Weather.ClearDesc',
    icon: 'fa-sun',
    color: '#FFEE88',
    category: 'standard',
    chance: 15,
    tempMin: 18,
    tempMax: 32,
    darknessPenalty: 0,
    environmentBase: null,
    environmentDark: null
  },
  {
    id: 'partly-cloudy',
    label: 'CALENDARIA.Weather.PartlyCloudy',
    description: 'CALENDARIA.Weather.PartlyCloudyDesc',
    icon: 'fa-cloud-sun',
    color: '#D0E8FF',
    category: 'standard',
    chance: 18,
    tempMin: 15,
    tempMax: 28,
    darknessPenalty: 0.05,
    environmentBase: null,
    environmentDark: null
  },
  {
    id: 'cloudy',
    label: 'CALENDARIA.Weather.Cloudy',
    description: 'CALENDARIA.Weather.CloudyDesc',
    icon: 'fa-cloud',
    color: '#B0C4DE',
    category: 'standard',
    chance: 14,
    tempMin: 12,
    tempMax: 24,
    darknessPenalty: 0.1,
    environmentBase: { hue: null, saturation: 0.7 },
    environmentDark: null
  },
  {
    id: 'overcast',
    label: 'CALENDARIA.Weather.Overcast',
    description: 'CALENDARIA.Weather.OvercastDesc',
    icon: 'fa-smog',
    color: '#CCCCCC',
    category: 'standard',
    chance: 10,
    tempMin: 10,
    tempMax: 20,
    darknessPenalty: 0.15,
    environmentBase: { hue: null, saturation: 0.5 },
    environmentDark: null
  },
  {
    id: 'drizzle',
    label: 'CALENDARIA.Weather.Drizzle',
    description: 'CALENDARIA.Weather.DrizzleDesc',
    icon: 'fa-cloud-rain',
    color: '#CDEFFF',
    category: 'standard',
    chance: 8,
    tempMin: 8,
    tempMax: 18,
    darknessPenalty: 0.1,
    environmentBase: { hue: null, saturation: 0.8 },
    environmentDark: null
  },
  {
    id: 'rain',
    label: 'CALENDARIA.Weather.Rain',
    description: 'CALENDARIA.Weather.RainDesc',
    icon: 'fa-cloud-showers-heavy',
    color: '#A0D8EF',
    category: 'standard',
    chance: 10,
    tempMin: 10,
    tempMax: 22,
    darknessPenalty: 0.15,
    environmentBase: { hue: null, saturation: 0.6 },
    environmentDark: null
  },
  {
    id: 'fog',
    label: 'CALENDARIA.Weather.Fog',
    description: 'CALENDARIA.Weather.FogDesc',
    icon: 'fa-smog',
    color: '#E6E6E6',
    category: 'standard',
    chance: 5,
    tempMin: 5,
    tempMax: 15,
    darknessPenalty: 0.2,
    environmentBase: { hue: null, saturation: 0.3 },
    environmentDark: null
  },
  {
    id: 'mist',
    label: 'CALENDARIA.Weather.Mist',
    description: 'CALENDARIA.Weather.MistDesc',
    icon: 'fa-water',
    color: '#F0F8FF',
    category: 'standard',
    chance: 4,
    tempMin: 8,
    tempMax: 18,
    darknessPenalty: 0.1,
    environmentBase: { hue: null, saturation: 0.7 },
    environmentDark: null
  },
  {
    id: 'windy',
    label: 'CALENDARIA.Weather.Windy',
    description: 'CALENDARIA.Weather.WindyDesc',
    icon: 'fa-wind',
    color: '#E0F7FA',
    category: 'standard',
    chance: 4,
    tempMin: 10,
    tempMax: 25,
    darknessPenalty: 0,
    environmentBase: null,
    environmentDark: null
  },
  {
    id: 'sunshower',
    label: 'CALENDARIA.Weather.Sunshower',
    description: 'CALENDARIA.Weather.SunshowerDesc',
    icon: 'fa-cloud-sun-rain',
    color: '#FCEABB',
    category: 'standard',
    chance: 2,
    tempMin: 15,
    tempMax: 26,
    darknessPenalty: 0.05,
    environmentBase: null,
    environmentDark: null
  }
];

/**
 * Severe weather conditions - dangerous or extreme weather.
 * @type {object[]}
 */
export const SEVERE_WEATHER = [
  {
    id: 'thunderstorm',
    label: 'CALENDARIA.Weather.Thunderstorm',
    description: 'CALENDARIA.Weather.ThunderstormDesc',
    icon: 'fa-bolt',
    color: '#FFD966',
    category: 'severe',
    chance: 2,
    tempMin: 15,
    tempMax: 28,
    darknessPenalty: 0.25,
    environmentBase: { hue: 220, saturation: 0.4 },
    environmentDark: null
  },
  {
    id: 'blizzard',
    label: 'CALENDARIA.Weather.Blizzard',
    description: 'CALENDARIA.Weather.BlizzardDesc',
    icon: 'fa-snowman',
    color: '#E0F7FF',
    category: 'severe',
    chance: 0.5,
    tempMin: -20,
    tempMax: -5,
    darknessPenalty: 0.3,
    environmentBase: { hue: 200, saturation: 0.3 },
    environmentDark: { hue: 210, saturation: null }
  },
  {
    id: 'snow',
    label: 'CALENDARIA.Weather.Snow',
    description: 'CALENDARIA.Weather.SnowDesc',
    icon: 'fa-snowflake',
    color: '#FFFFFF',
    category: 'severe',
    chance: 1,
    tempMin: -10,
    tempMax: 2,
    darknessPenalty: 0.1,
    environmentBase: { hue: 200, saturation: 0.6 },
    environmentDark: null
  },
  {
    id: 'hail',
    label: 'CALENDARIA.Weather.Hail',
    description: 'CALENDARIA.Weather.HailDesc',
    icon: 'fa-cloud-meatball',
    color: '#D1EFFF',
    category: 'severe',
    chance: 0.5,
    tempMin: 5,
    tempMax: 18,
    darknessPenalty: 0.2,
    environmentBase: { hue: null, saturation: 0.5 },
    environmentDark: null
  },
  {
    id: 'tornado',
    label: 'CALENDARIA.Weather.Tornado',
    description: 'CALENDARIA.Weather.TornadoDesc',
    icon: 'fa-poo-storm',
    color: '#FFD1DC',
    category: 'severe',
    chance: 0.5,
    tempMin: 18,
    tempMax: 35,
    darknessPenalty: 0.3,
    environmentBase: { hue: 100, saturation: 0.4 },
    environmentDark: null
  },
  {
    id: 'hurricane',
    label: 'CALENDARIA.Weather.Hurricane',
    description: 'CALENDARIA.Weather.HurricaneDesc',
    icon: 'fa-hurricane',
    color: '#FFE599',
    category: 'severe',
    chance: 0.5,
    tempMin: 22,
    tempMax: 35,
    darknessPenalty: 0.35,
    environmentBase: { hue: null, saturation: 0.3 },
    environmentDark: null
  }
];

/**
 * Environmental weather conditions - location-specific phenomena.
 * @type {object[]}
 */
export const ENVIRONMENTAL_WEATHER = [
  {
    id: 'ashfall',
    label: 'CALENDARIA.Weather.Ashfall',
    description: 'CALENDARIA.Weather.AshfallDesc',
    icon: 'fa-cloud',
    color: '#DADADA',
    category: 'environmental',
    chance: 1.5,
    tempMin: 15,
    tempMax: 40,
    darknessPenalty: 0.25,
    environmentBase: { hue: 30, saturation: 0.4 },
    environmentDark: null
  },
  {
    id: 'sandstorm',
    label: 'CALENDARIA.Weather.Sandstorm',
    description: 'CALENDARIA.Weather.SandstormDesc',
    icon: 'fa-cloud-sun',
    color: '#F4E1A1',
    category: 'environmental',
    chance: 1.5,
    tempMin: 25,
    tempMax: 45,
    darknessPenalty: 0.2,
    environmentBase: { hue: 35, saturation: 0.6 },
    environmentDark: null
  },
  {
    id: 'luminous-sky',
    label: 'CALENDARIA.Weather.LuminousSky',
    description: 'CALENDARIA.Weather.LuminousSkyDesc',
    icon: 'fa-star',
    color: '#E0BBFF',
    category: 'environmental',
    chance: 1.5,
    tempMin: -5,
    tempMax: 10,
    darknessPenalty: -0.1,
    environmentBase: null,
    environmentDark: { hue: 280, saturation: 0.8 }
  }
];

/**
 * Fantasy weather conditions - magical or supernatural phenomena.
 * @type {object[]}
 */
export const FANTASY_WEATHER = [
  {
    id: 'black-sun',
    label: 'CALENDARIA.Weather.BlackSun',
    description: 'CALENDARIA.Weather.BlackSunDesc',
    icon: 'fa-sun',
    color: '#4A4A4A',
    category: 'fantasy',
    chance: 0.5,
    tempMin: 5,
    tempMax: 20,
    darknessPenalty: 0.4,
    environmentBase: { hue: 270, saturation: 0.3 },
    environmentDark: { hue: 280, saturation: 0.4 }
  },
  {
    id: 'ley-surge',
    label: 'CALENDARIA.Weather.LeySurge',
    description: 'CALENDARIA.Weather.LeySurgeDesc',
    icon: 'fa-bolt',
    color: '#B3E5FC',
    category: 'fantasy',
    chance: 0,
    tempMin: 10,
    tempMax: 25,
    darknessPenalty: -0.1,
    environmentBase: { hue: 180, saturation: 0.9 },
    environmentDark: { hue: 200, saturation: 0.8 }
  },
  {
    id: 'aether-haze',
    label: 'CALENDARIA.Weather.AetherHaze',
    description: 'CALENDARIA.Weather.AetherHazeDesc',
    icon: 'fa-smog',
    color: '#E6CCFF',
    category: 'fantasy',
    chance: 0,
    tempMin: 12,
    tempMax: 22,
    darknessPenalty: 0.15,
    environmentBase: { hue: 280, saturation: 0.6 },
    environmentDark: { hue: 270, saturation: 0.7 }
  },
  {
    id: 'nullfront',
    label: 'CALENDARIA.Weather.Nullfront',
    description: 'CALENDARIA.Weather.NullfrontDesc',
    icon: 'fa-ban',
    color: '#808080',
    category: 'fantasy',
    chance: 0,
    tempMin: 0,
    tempMax: 15,
    darknessPenalty: 0.2,
    environmentBase: { hue: null, saturation: 0.1 },
    environmentDark: { hue: null, saturation: 0.1 }
  },
  {
    id: 'permafrost-surge',
    label: 'CALENDARIA.Weather.PermafrostSurge',
    description: 'CALENDARIA.Weather.PermafrostSurgeDesc',
    icon: 'fa-icicles',
    color: '#D0FFFF',
    category: 'fantasy',
    chance: 0,
    tempMin: -30,
    tempMax: -10,
    darknessPenalty: 0.1,
    environmentBase: { hue: 190, saturation: 0.7 },
    environmentDark: { hue: 200, saturation: 0.6 }
  },
  {
    id: 'gravewind',
    label: 'CALENDARIA.Weather.Gravewind',
    description: 'CALENDARIA.Weather.GravewindDesc',
    icon: 'fa-wind',
    color: '#C9C9FF',
    category: 'fantasy',
    chance: 0,
    tempMin: 5,
    tempMax: 18,
    darknessPenalty: 0.15,
    environmentBase: { hue: 250, saturation: 0.5 },
    environmentDark: { hue: 260, saturation: 0.6 }
  },
  {
    id: 'veilfall',
    label: 'CALENDARIA.Weather.Veilfall',
    description: 'CALENDARIA.Weather.VeilfallDesc',
    icon: 'fa-water',
    color: '#E0F7F9',
    category: 'fantasy',
    chance: 0,
    tempMin: 8,
    tempMax: 20,
    darknessPenalty: 0.1,
    environmentBase: { hue: 180, saturation: 0.4 },
    environmentDark: null
  },
  {
    id: 'arcane',
    label: 'CALENDARIA.Weather.Arcane',
    description: 'CALENDARIA.Weather.ArcaneDesc',
    icon: 'fa-wind',
    color: '#FFFACD',
    category: 'fantasy',
    chance: 0,
    tempMin: 15,
    tempMax: 28,
    darknessPenalty: -0.05,
    environmentBase: { hue: 50, saturation: 0.8 },
    environmentDark: null
  }
];

/**
 * All built-in weather presets combined.
 * @type {object[]}
 */
export const ALL_PRESETS = [...STANDARD_WEATHER, ...SEVERE_WEATHER, ...ENVIRONMENTAL_WEATHER, ...FANTASY_WEATHER];

/**
 * Weather categories for organizing presets.
 * @type {object}
 */
export const WEATHER_CATEGORIES = {
  standard: { id: 'standard', label: 'CALENDARIA.Weather.Category.Standard' },
  severe: { id: 'severe', label: 'CALENDARIA.Weather.Category.Severe' },
  environmental: { id: 'environmental', label: 'CALENDARIA.Weather.Category.Environmental' },
  fantasy: { id: 'fantasy', label: 'CALENDARIA.Weather.Category.Fantasy' },
  custom: { id: 'custom', label: 'CALENDARIA.Weather.Category.Custom' }
};

/**
 * Get a weather preset by ID.
 * @param {string} id - Weather preset ID
 * @param {object[]} [customPresets] - Custom presets to search
 * @returns {object|null} Weather preset or null
 */
export function getPreset(id, customPresets = []) {
  return ALL_PRESETS.find((p) => p.id === id) || customPresets.find((p) => p.id === id) || null;
}

/**
 * Get all weather presets including custom ones.
 * @param {object[]} [customPresets] - Custom presets to include
 * @returns {object[]} All presets
 */
export function getAllPresets(customPresets = []) {
  return [...ALL_PRESETS, ...customPresets];
}

/**
 * Get presets by category.
 * @param {string} category - Category ID
 * @param {object[]} [customPresets] - Custom presets to include
 * @returns {object[]} Presets in category
 */
export function getPresetsByCategory(category, customPresets = []) {
  const all = getAllPresets(customPresets);
  return all.filter((p) => p.category === category);
}

/**
 * Get the alias for a specific preset if one exists.
 * @param {string} presetId - Weather preset ID
 * @param {string} [calendarId] - Calendar ID for zone-scoped lookup
 * @param {string} [zoneId] - Zone ID for zone-scoped lookup
 * @returns {string|null} Alias label or null if no alias
 */
export function getPresetAlias(presetId, calendarId, zoneId) {
  const aliases = game.settings.get(MODULE.ID, SETTINGS.WEATHER_PRESET_ALIASES) || {};
  if (calendarId && zoneId) return aliases[calendarId]?.[zoneId]?.[presetId] || null;
  return null;
}

/**
 * Set an alias for a weather preset, scoped to a calendar and zone.
 * @param {string} presetId - Weather preset ID
 * @param {string|null} alias - Alias label, or null to remove
 * @param {string} calendarId - Calendar ID
 * @param {string} zoneId - Zone ID
 * @returns {Promise<void>}
 */
export async function setPresetAlias(presetId, alias, calendarId, zoneId) {
  if (!calendarId || !zoneId) return;
  const aliases = game.settings.get(MODULE.ID, SETTINGS.WEATHER_PRESET_ALIASES) || {};
  if (alias && alias.trim()) {
    aliases[calendarId] ??= {};
    aliases[calendarId][zoneId] ??= {};
    aliases[calendarId][zoneId][presetId] = alias.trim();
  } else {
    delete aliases[calendarId]?.[zoneId]?.[presetId];
    if (aliases[calendarId]?.[zoneId] && Object.keys(aliases[calendarId][zoneId]).length === 0) delete aliases[calendarId][zoneId];
    if (aliases[calendarId] && Object.keys(aliases[calendarId]).length === 0) delete aliases[calendarId];
  }
  await game.settings.set(MODULE.ID, SETTINGS.WEATHER_PRESET_ALIASES, aliases);
}
