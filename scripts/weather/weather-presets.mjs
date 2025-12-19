/**
 * Built-in weather presets for the Calendaria weather system.
 * GMs can add custom presets via settings.
 *
 * @module Weather/WeatherPresets
 * @author Tyler
 */

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
    tempMax: 32
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
    tempMax: 28
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
    tempMax: 24
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
    tempMax: 20
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
    tempMax: 18
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
    tempMax: 22
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
    tempMax: 15
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
    tempMax: 18
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
    tempMax: 25
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
    tempMax: 26
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
    tempMax: 28
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
    tempMax: -5
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
    tempMax: 2
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
    tempMax: 18
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
    tempMax: 35
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
    tempMax: 35
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
    tempMax: 40
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
    tempMax: 45
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
    tempMax: 10
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
    tempMax: 20
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
    tempMax: 25
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
    tempMax: 22
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
    tempMax: 15
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
    tempMax: -10
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
    tempMax: 18
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
    tempMax: 20
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
    tempMax: 28
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
 * @param {object[]} [customPresets=[]] - Custom presets to search
 * @returns {object|null} Weather preset or null
 */
export function getPreset(id, customPresets = []) {
  return ALL_PRESETS.find((p) => p.id === id) || customPresets.find((p) => p.id === id) || null;
}

/**
 * Get all weather presets including custom ones.
 * @param {object[]} [customPresets=[]] - Custom presets to include
 * @returns {object[]} All presets
 */
export function getAllPresets(customPresets = []) {
  return [...ALL_PRESETS, ...customPresets];
}

/**
 * Get presets by category.
 * @param {string} category - Category ID
 * @param {object[]} [customPresets=[]] - Custom presets to include
 * @returns {object[]} Presets in category
 */
export function getPresetsByCategory(category, customPresets = []) {
  const all = getAllPresets(customPresets);
  return all.filter((p) => p.category === category);
}
