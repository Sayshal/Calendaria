/**
 * Built-in weather presets for the Calendaria weather system.
 * @module Weather/WeatherPresets
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../../constants.mjs';

/**
 * Available HUD visual effects for weather overlays (dome and slice modes).
 * @type {string[]}
 */
export const HUD_EFFECTS = [
  'clear',
  'clouds-light',
  'clouds-heavy',
  'clouds-overcast',
  'rain',
  'rain-heavy',
  'snow',
  'snow-heavy',
  'fog',
  'lightning',
  'sand',
  'ashfall',
  'embers',
  'ice',
  'hail',
  'tornado',
  'hurricane',
  'nullstatic',
  'gust',
  'aurora',
  'aether',
  'void',
  'spectral',
  'arcane',
  'arcane-wind',
  'veil',
  'petals',
  'sleet',
  'haze',
  'leaves',
  'smoke',
  'rain-acid',
  'rain-blood',
  'meteors',
  'spores',
  'divine',
  'miasma',
  'ley-surge'
];

/**
 * Available sound effect files for weather ambient loops.
 * @type {string[]}
 */
export const SOUND_FX_OPTIONS = [
  'rain-acid-rain-blood-rain',
  'sunshower-drizzle',
  'thunderstorm',
  'sleet-hail',
  'blizzard-ice-storm',
  'snow-frost',
  'hurricane-monsoon-tornado',
  'sandstorm-dust-devil',
  'wind'
];

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
    environmentDark: null,
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 1.2,
    hudEffect: 'clear',
    fxPreset: null,
    soundFx: null
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
    darknessPenalty: 0,
    environmentBase: null,
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 1.0,
    hudEffect: 'clouds-light',
    fxPreset: 'partly-cloudy',
    soundFx: null
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
    darknessPenalty: 0,
    environmentBase: { hue: null, saturation: 0.7 },
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 1.2,
    hudEffect: 'clouds-heavy',
    fxPreset: 'cloudy',
    soundFx: null
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
    darknessPenalty: 0.05,
    environmentBase: { hue: null, saturation: 0.5 },
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 1.5,
    hudEffect: 'clouds-overcast',
    fxPreset: 'overcast',
    soundFx: null
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
    darknessPenalty: 0,
    environmentBase: { hue: null, saturation: 0.8 },
    environmentDark: null,
    wind: { speed: 0, direction: null },
    precipitation: { type: 'drizzle', intensity: 0.2 },
    inertiaWeight: 1.0,
    hudEffect: 'rain',
    fxPreset: 'drizzle',
    soundFx: 'sunshower-drizzle'
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
    darknessPenalty: 0.05,
    environmentBase: { hue: null, saturation: 0.6 },
    environmentDark: null,
    wind: { speed: 2, direction: null },
    precipitation: { type: 'rain', intensity: 0.6 },
    inertiaWeight: 1.3,
    hudEffect: 'rain',
    fxPreset: 'rain',
    soundFx: 'rain-acid-rain-blood-rain'
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
    darknessPenalty: 0.05,
    environmentBase: { hue: null, saturation: 0.3 },
    environmentDark: null,
    wind: { speed: 0, direction: null },
    precipitation: { type: 'drizzle', intensity: 0.1 },
    inertiaWeight: 1.5,
    hudEffect: 'fog',
    fxPreset: 'fog',
    soundFx: null
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
    darknessPenalty: 0,
    environmentBase: { hue: null, saturation: 0.7 },
    environmentDark: null,
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 1.0,
    hudEffect: 'fog',
    fxPreset: 'mist',
    soundFx: null
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
    environmentDark: null,
    wind: { speed: 3, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 1.0,
    hudEffect: 'gust',
    fxPreset: 'windy',
    soundFx: 'wind'
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
    darknessPenalty: 0,
    environmentBase: null,
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: 'rain', intensity: 0.3 },
    inertiaWeight: 0,
    hudEffect: 'rain',
    fxPreset: 'sunshower',
    soundFx: 'sunshower-drizzle'
  },
  {
    id: 'snow',
    label: 'CALENDARIA.Weather.Snow',
    description: 'CALENDARIA.Weather.SnowDesc',
    icon: 'fa-snowflake',
    color: '#FFFFFF',
    category: 'standard',
    chance: 1,
    tempMin: -10,
    tempMax: 2,
    darknessPenalty: 0,
    environmentBase: { hue: 200, saturation: 0.6 },
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: 'snow', intensity: 0.5 },
    inertiaWeight: 1.3,
    hudEffect: 'snow',
    fxPreset: 'snow',
    soundFx: 'snow-frost'
  },
  {
    id: 'sleet',
    label: 'CALENDARIA.Weather.Sleet',
    description: 'CALENDARIA.Weather.SleetDesc',
    icon: 'fa-cloud-rain',
    color: '#C0D8E8',
    category: 'standard',
    chance: 1,
    tempMin: -2,
    tempMax: 4,
    darknessPenalty: 0.05,
    environmentBase: { hue: 200, saturation: 0.5 },
    environmentDark: null,
    wind: { speed: 2, direction: null },
    precipitation: { type: 'sleet', intensity: 0.5 },
    inertiaWeight: 1.0,
    hudEffect: 'sleet',
    fxPreset: 'sleet',
    soundFx: 'sleet-hail'
  },
  {
    id: 'heat-wave',
    label: 'CALENDARIA.Weather.HeatWave',
    description: 'CALENDARIA.Weather.HeatWaveDesc',
    icon: 'fa-temperature-arrow-up',
    color: '#FF9944',
    category: 'standard',
    chance: 1,
    tempMin: 35,
    tempMax: 48,
    darknessPenalty: 0,
    environmentBase: { hue: 30, saturation: 0.4 },
    environmentDark: null,
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 1.5,
    hudEffect: 'haze',
    fxPreset: 'heat-wave',
    soundFx: null
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
    icon: 'fa-cloud-bolt',
    color: '#3D3560',
    category: 'severe',
    chance: 2,
    tempMin: 15,
    tempMax: 28,
    darknessPenalty: 0.1,
    environmentBase: { hue: 220, saturation: 0.4 },
    environmentDark: null,
    wind: { speed: 4, direction: null, forced: true },
    precipitation: { type: 'rain', intensity: 0.9 },
    inertiaWeight: 0.3,
    hudEffect: 'lightning',
    fxPreset: 'thunderstorm',
    soundFx: 'thunderstorm'
  },
  {
    id: 'blizzard',
    label: 'CALENDARIA.Weather.Blizzard',
    description: 'CALENDARIA.Weather.BlizzardDesc',
    icon: 'fa-snowflake',
    color: '#C8DCE8',
    category: 'severe',
    chance: 0.5,
    tempMin: -20,
    tempMax: -5,
    darknessPenalty: 0.15,
    environmentBase: { hue: 200, saturation: 0.3 },
    environmentDark: { hue: 210, saturation: null },
    wind: { speed: 5, direction: null, forced: true },
    precipitation: { type: 'snow', intensity: 1.0 },
    inertiaWeight: 0.5,
    hudEffect: 'snow-heavy',
    fxPreset: 'blizzard',
    soundFx: 'blizzard-ice-storm'
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
    darknessPenalty: 0.05,
    environmentBase: { hue: null, saturation: 0.5 },
    environmentDark: null,
    wind: { speed: 3, direction: null },
    precipitation: { type: 'hail', intensity: 0.7 },
    inertiaWeight: 0.3,
    hudEffect: 'hail',
    fxPreset: 'hail',
    soundFx: 'sleet-hail'
  },
  {
    id: 'tornado',
    label: 'CALENDARIA.Weather.Tornado',
    description: 'CALENDARIA.Weather.TornadoDesc',
    icon: 'fa-tornado',
    color: '#4A5A3A',
    category: 'severe',
    chance: 0.5,
    tempMin: 18,
    tempMax: 35,
    darknessPenalty: 0.15,
    environmentBase: { hue: 100, saturation: 0.4 },
    environmentDark: null,
    wind: { speed: 5, direction: null, forced: true },
    precipitation: { type: 'rain', intensity: 0.8 },
    inertiaWeight: 0,
    hudEffect: 'tornado',
    fxPreset: 'tornado',
    soundFx: 'hurricane-monsoon-tornado'
  },
  {
    id: 'hurricane',
    label: 'CALENDARIA.Weather.Hurricane',
    description: 'CALENDARIA.Weather.HurricaneDesc',
    icon: 'fa-hurricane',
    color: '#445566',
    category: 'severe',
    chance: 0.5,
    tempMin: 22,
    tempMax: 35,
    darknessPenalty: 0.15,
    environmentBase: { hue: null, saturation: 0.3 },
    environmentDark: null,
    wind: { speed: 5, direction: null, forced: true },
    precipitation: { type: 'rain', intensity: 1.0 },
    inertiaWeight: 0,
    hudEffect: 'hurricane',
    fxPreset: 'hurricane',
    soundFx: 'hurricane-monsoon-tornado'
  },
  {
    id: 'ice-storm',
    label: 'CALENDARIA.Weather.IceStorm',
    description: 'CALENDARIA.Weather.IceStormDesc',
    icon: 'fa-icicles',
    color: '#A0C8E0',
    category: 'severe',
    chance: 0.5,
    tempMin: -10,
    tempMax: 0,
    darknessPenalty: 0.1,
    environmentBase: { hue: 200, saturation: 0.5 },
    environmentDark: { hue: 210, saturation: 0.4 },
    wind: { speed: 4, direction: null, forced: true },
    precipitation: { type: 'hail', intensity: 0.8 },
    inertiaWeight: 0.3,
    hudEffect: 'ice',
    fxPreset: 'ice-storm',
    soundFx: 'blizzard-ice-storm'
  },
  {
    id: 'monsoon',
    label: 'CALENDARIA.Weather.Monsoon',
    description: 'CALENDARIA.Weather.MonsoonDesc',
    icon: 'fa-cloud-showers-water',
    color: '#3A6080',
    category: 'severe',
    chance: 0.5,
    tempMin: 22,
    tempMax: 35,
    darknessPenalty: 0.1,
    environmentBase: { hue: null, saturation: 0.4 },
    environmentDark: null,
    wind: { speed: 4, direction: null, forced: true },
    precipitation: { type: 'rain', intensity: 1.0 },
    inertiaWeight: 0.5,
    hudEffect: 'rain-heavy',
    fxPreset: 'monsoon',
    soundFx: 'hurricane-monsoon-tornado'
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
    icon: 'fa-volcano',
    color: '#8B5A30',
    category: 'environmental',
    chance: 1.5,
    tempMin: 15,
    tempMax: 40,
    darknessPenalty: 0.1,
    environmentBase: { hue: 30, saturation: 0.4 },
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0.5,
    hudEffect: 'ashfall',
    fxPreset: 'ashfall',
    soundFx: null
  },
  {
    id: 'sandstorm',
    label: 'CALENDARIA.Weather.Sandstorm',
    description: 'CALENDARIA.Weather.SandstormDesc',
    icon: 'fa-wind',
    color: '#C49A44',
    category: 'environmental',
    chance: 1.5,
    tempMin: 25,
    tempMax: 45,
    darknessPenalty: 0.1,
    environmentBase: { hue: 35, saturation: 0.6 },
    environmentDark: null,
    wind: { speed: 4, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0.3,
    hudEffect: 'sand',
    fxPreset: 'sandstorm',
    soundFx: 'sandstorm-dust-devil'
  },
  {
    id: 'luminous-sky',
    label: 'CALENDARIA.Weather.LuminousSky',
    description: 'CALENDARIA.Weather.LuminousSkyDesc',
    icon: 'fa-star',
    color: '#2E8B57',
    category: 'environmental',
    chance: 1.5,
    tempMin: -5,
    tempMax: 10,
    darknessPenalty: -0.1,
    environmentBase: null,
    environmentDark: { hue: 280, saturation: 0.8 },
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'aurora',
    fxPreset: 'luminous-sky',
    soundFx: null
  },
  {
    id: 'sakura-bloom',
    label: 'CALENDARIA.Weather.SakuraBloom',
    description: 'CALENDARIA.Weather.SakuraBloomDesc',
    icon: 'fa-spa',
    color: '#ffb7c5',
    category: 'environmental',
    chance: 1.5,
    tempMin: 18,
    tempMax: 32,
    darknessPenalty: 0,
    environmentBase: null,
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'petals',
    fxPreset: 'sakura-bloom',
    soundFx: null
  },
  {
    id: 'autumn-leaves',
    label: 'CALENDARIA.Weather.AutumnLeaves',
    description: 'CALENDARIA.Weather.AutumnLeavesDesc',
    icon: 'fa-leaf',
    color: '#CC7733',
    category: 'environmental',
    chance: 1.5,
    tempMin: 5,
    tempMax: 18,
    darknessPenalty: 0,
    environmentBase: { hue: 30, saturation: 0.6 },
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'leaves',
    fxPreset: 'autumn-leaves',
    soundFx: null
  },
  {
    id: 'rolling-fog',
    label: 'CALENDARIA.Weather.RollingFog',
    description: 'CALENDARIA.Weather.RollingFogDesc',
    icon: 'fa-smog',
    color: '#D0D0D0',
    category: 'environmental',
    chance: 1.5,
    tempMin: 2,
    tempMax: 12,
    darknessPenalty: 0.05,
    environmentBase: { hue: null, saturation: 0.2 },
    environmentDark: null,
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 1.5,
    hudEffect: 'fog',
    fxPreset: 'rolling-fog',
    soundFx: null
  },
  {
    id: 'wildfire-smoke',
    label: 'CALENDARIA.Weather.WildfireSmoke',
    description: 'CALENDARIA.Weather.WildfireSmokeDesc',
    icon: 'fa-fire',
    color: '#8B6040',
    category: 'environmental',
    chance: 1,
    tempMin: 20,
    tempMax: 40,
    darknessPenalty: 0.1,
    environmentBase: { hue: 25, saturation: 0.5 },
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0.5,
    hudEffect: 'smoke',
    fxPreset: 'wildfire-smoke',
    soundFx: null
  },
  {
    id: 'dust-devil',
    label: 'CALENDARIA.Weather.DustDevil',
    description: 'CALENDARIA.Weather.DustDevilDesc',
    icon: 'fa-wind',
    color: '#C8A060',
    category: 'environmental',
    chance: 1,
    tempMin: 28,
    tempMax: 45,
    darknessPenalty: 0.1,
    environmentBase: { hue: 35, saturation: 0.5 },
    environmentDark: null,
    wind: { speed: 3, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'sand',
    fxPreset: 'dust-devil',
    soundFx: 'sandstorm-dust-devil'
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
    icon: 'fa-circle',
    color: '#1A0E22',
    category: 'fantasy',
    chance: 0.5,
    tempMin: 5,
    tempMax: 20,
    darknessPenalty: 0.3,
    environmentBase: { hue: 270, saturation: 0.3 },
    environmentDark: { hue: 280, saturation: 0.4 },
    wind: { speed: 1, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'void',
    fxPreset: 'black-sun',
    soundFx: null
  },
  {
    id: 'ley-surge',
    label: 'CALENDARIA.Weather.LeySurge',
    description: 'CALENDARIA.Weather.LeySurgeDesc',
    icon: 'fa-wand-sparkles',
    color: '#3A9BDC',
    category: 'fantasy',
    chance: 0,
    tempMin: 10,
    tempMax: 25,
    darknessPenalty: -0.1,
    environmentBase: { hue: 180, saturation: 0.9 },
    environmentDark: { hue: 200, saturation: 0.8 },
    wind: { speed: 2, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'ley-surge',
    fxPreset: 'ley-surge',
    soundFx: null
  },
  {
    id: 'aether-haze',
    label: 'CALENDARIA.Weather.AetherHaze',
    description: 'CALENDARIA.Weather.AetherHazeDesc',
    icon: 'fa-smog',
    color: '#7B3F96',
    category: 'fantasy',
    chance: 0,
    tempMin: 12,
    tempMax: 22,
    darknessPenalty: 0.15,
    environmentBase: { hue: 280, saturation: 0.6 },
    environmentDark: { hue: 270, saturation: 0.7 },
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'aether',
    fxPreset: 'aether-haze',
    soundFx: null
  },
  {
    id: 'nullfront',
    label: 'CALENDARIA.Weather.Nullfront',
    description: 'CALENDARIA.Weather.NullfrontDesc',
    icon: 'fa-ban',
    color: '#2A2030',
    category: 'fantasy',
    chance: 0,
    tempMin: 0,
    tempMax: 15,
    darknessPenalty: 0.15,
    environmentBase: { hue: null, saturation: 0.1 },
    environmentDark: { hue: null, saturation: 0.1 },
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'nullstatic',
    fxPreset: 'nullfront',
    soundFx: null
  },
  {
    id: 'permafrost-surge',
    label: 'CALENDARIA.Weather.PermafrostSurge',
    description: 'CALENDARIA.Weather.PermafrostSurgeDesc',
    icon: 'fa-icicles',
    color: '#A8D8EA',
    category: 'fantasy',
    chance: 0,
    tempMin: -30,
    tempMax: -10,
    darknessPenalty: 0.1,
    environmentBase: { hue: 190, saturation: 0.7 },
    environmentDark: { hue: 200, saturation: 0.6 },
    wind: { speed: 3, direction: null },
    precipitation: { type: 'snow', intensity: 0.4 },
    inertiaWeight: 0,
    hudEffect: 'ice',
    fxPreset: 'permafrost-surge',
    soundFx: 'snow-frost'
  },
  {
    id: 'gravewind',
    label: 'CALENDARIA.Weather.Gravewind',
    description: 'CALENDARIA.Weather.GravewindDesc',
    icon: 'fa-ghost',
    color: '#3A5040',
    category: 'fantasy',
    chance: 0,
    tempMin: 5,
    tempMax: 18,
    darknessPenalty: 0.15,
    environmentBase: { hue: 250, saturation: 0.5 },
    environmentDark: { hue: 260, saturation: 0.6 },
    wind: { speed: 3, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'spectral',
    fxPreset: 'gravewind',
    soundFx: 'wind'
  },
  {
    id: 'veilfall',
    label: 'CALENDARIA.Weather.Veilfall',
    description: 'CALENDARIA.Weather.VeilfallDesc',
    icon: 'fa-droplet',
    color: '#6A5A8E',
    category: 'fantasy',
    chance: 0,
    tempMin: 8,
    tempMax: 20,
    darknessPenalty: 0.1,
    environmentBase: { hue: 180, saturation: 0.4 },
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: 'rain', intensity: 0.3 },
    inertiaWeight: 0,
    hudEffect: 'veil',
    fxPreset: 'veilfall',
    soundFx: null
  },
  {
    id: 'arcane-winds',
    label: 'CALENDARIA.Weather.ArcaneWinds',
    description: 'CALENDARIA.Weather.ArcaneWindsDesc',
    icon: 'fa-hat-wizard',
    color: '#8A40B0',
    category: 'fantasy',
    chance: 0,
    tempMin: 15,
    tempMax: 28,
    darknessPenalty: -0.05,
    environmentBase: { hue: 50, saturation: 0.8 },
    environmentDark: null,
    wind: { speed: 2, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'arcane-wind',
    fxPreset: 'arcane-winds',
    soundFx: 'wind'
  },
  {
    id: 'acid-rain',
    label: 'CALENDARIA.Weather.AcidRain',
    description: 'CALENDARIA.Weather.AcidRainDesc',
    icon: 'fa-flask',
    color: '#55BB33',
    category: 'fantasy',
    chance: 0,
    tempMin: 10,
    tempMax: 25,
    darknessPenalty: 0.05,
    environmentBase: { hue: 100, saturation: 0.6 },
    environmentDark: null,
    wind: { speed: 1, direction: null },
    precipitation: { type: 'rain', intensity: 0.6 },
    inertiaWeight: 0,
    hudEffect: 'rain-acid',
    fxPreset: 'acid-rain',
    soundFx: 'rain-acid-rain-blood-rain'
  },
  {
    id: 'blood-rain',
    label: 'CALENDARIA.Weather.BloodRain',
    description: 'CALENDARIA.Weather.BloodRainDesc',
    icon: 'fa-droplet',
    color: '#880022',
    category: 'fantasy',
    chance: 0,
    tempMin: 12,
    tempMax: 28,
    darknessPenalty: 0.1,
    environmentBase: { hue: 0, saturation: 0.7 },
    environmentDark: { hue: 350, saturation: 0.6 },
    wind: { speed: 1, direction: null },
    precipitation: { type: 'rain', intensity: 0.7 },
    inertiaWeight: 0,
    hudEffect: 'rain-blood',
    fxPreset: 'blood-rain',
    soundFx: 'rain-acid-rain-blood-rain'
  },
  {
    id: 'meteor-shower',
    label: 'CALENDARIA.Weather.MeteorShower',
    description: 'CALENDARIA.Weather.MeteorShowerDesc',
    icon: 'fa-meteor',
    color: '#FF6622',
    category: 'fantasy',
    chance: 0,
    tempMin: 10,
    tempMax: 30,
    darknessPenalty: -0.1,
    environmentBase: null,
    environmentDark: { hue: 20, saturation: 0.7 },
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'meteors',
    fxPreset: 'meteor-shower',
    soundFx: null
  },
  {
    id: 'spore-cloud',
    label: 'CALENDARIA.Weather.SporeCloud',
    description: 'CALENDARIA.Weather.SporeCloudDesc',
    icon: 'fa-disease',
    color: '#88AA44',
    category: 'fantasy',
    chance: 0,
    tempMin: 15,
    tempMax: 28,
    darknessPenalty: 0.15,
    environmentBase: { hue: 80, saturation: 0.5 },
    environmentDark: { hue: 90, saturation: 0.4 },
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'spores',
    fxPreset: 'spore-cloud',
    soundFx: null
  },
  {
    id: 'divine-light',
    label: 'CALENDARIA.Weather.DivineLight',
    description: 'CALENDARIA.Weather.DivineLightDesc',
    icon: 'fa-sun',
    color: '#FFD700',
    category: 'fantasy',
    chance: 0,
    tempMin: 18,
    tempMax: 30,
    darknessPenalty: -0.2,
    environmentBase: { hue: 45, saturation: 0.9 },
    environmentDark: null,
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'divine',
    fxPreset: 'divine-light',
    soundFx: null
  },
  {
    id: 'plague-miasma',
    label: 'CALENDARIA.Weather.PlagueMiasma',
    description: 'CALENDARIA.Weather.PlagueMiasmaDesc',
    icon: 'fa-biohazard',
    color: '#556B2F',
    category: 'fantasy',
    chance: 0,
    tempMin: 10,
    tempMax: 22,
    darknessPenalty: 0.25,
    environmentBase: { hue: 80, saturation: 0.4 },
    environmentDark: { hue: 90, saturation: 0.3 },
    wind: { speed: 0, direction: null },
    precipitation: { type: null, intensity: 0 },
    inertiaWeight: 0,
    hudEffect: 'miasma',
    fxPreset: 'plague-miasma',
    soundFx: null
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
