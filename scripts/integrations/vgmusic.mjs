import { HOOKS, SEVERITY_LEVELS } from '../constants.mjs';
import { shouldSyncSceneDarkness } from '../time/_module.mjs';
import { WeatherManager } from '../weather/_module.mjs';

/** Section priority for night music, between VGMusic's Scene area (-20) and combat (-10) sections. */
const NIGHT_PRIORITY = -18;

/** Section priority for weather music, above night so weather wins when both apply. */
const WEATHER_PRIORITY = -15;

/** Precipitation types mapped to the weather section covering them. */
const PRECIPITATION_SECTIONS = { drizzle: 'rain', rain: 'rain', snow: 'snow', sleet: 'snow', hail: 'storm' };

/** Severity at or above which any weather counts as a storm, whatever it precipitates. */
const STORM_SEVERITY = SEVERITY_LEVELS.SEVERE.min;

/** Weather sections to register, `id` doubling as the context VGMusic stores the playlist under. */
const WEATHER_SECTIONS = [
  { id: 'calendariaRain', section: 'rain', label: 'CALENDARIA.Music.Section.Rain' },
  { id: 'calendariaSnow', section: 'snow', label: 'CALENDARIA.Music.Section.Snow' },
  { id: 'calendariaStorm', section: 'storm', label: 'CALENDARIA.Music.Section.Storm' }
];

/** @type {string|null} Last evaluated section state, used to skip redundant playlist refreshes. */
let lastState = null;

/**
 * Check if the VGMusic module is installed and active.
 * @returns {boolean} Whether VGMusic is active
 */
export function isVGMusicActive() {
  return game.modules.get('vgmusic')?.active ?? false;
}

/**
 * Resolve which weather section the active scene's weather belongs to.
 * @returns {string|null} Section name ('rain', 'snow', 'storm') or null when none applies
 */
function getWeatherSection() {
  const scene = game.scenes?.active;
  const weather = WeatherManager.getCurrentWeather(null, scene);
  if (!weather) return null;
  if (WeatherManager.getSeverity(weather) >= STORM_SEVERITY) return 'storm';
  return PRECIPITATION_SECTIONS[weather.precipitation?.type] ?? null;
}

/**
 * Check whether the active scene is currently between sunset and sunrise.
 * @returns {boolean} True when the scene is in its night window
 */
function isNight() {
  const scene = game.scenes?.active;
  if (!shouldSyncSceneDarkness(scene)) return false;
  const calendar = game.time.calendar;
  const components = game.time.components;
  if (!calendar || !components) return false;
  const zone = WeatherManager.getActiveZone?.(null, scene);
  const sunrise = calendar.sunrise(undefined, zone);
  const sunset = calendar.sunset(undefined, zone);
  if (sunrise == null || sunset == null) return false;
  const hour = components.hour + components.minute / (calendar.days?.minutesPerHour ?? 60);
  return hour < sunrise || hour >= sunset;
}

/**
 * Re-run VGMusic's playlist selection when the night or weather section actually changes.
 */
function refreshSections() {
  const state = `${game.scenes?.active?.id}:${isNight()}:${getWeatherSection()}`;
  if (state === lastState) return;
  lastState = state;
  VGMUSIC.refreshSections();
}

/**
 * Handle weather change events, ignoring visual-only refreshes.
 * @param {object} payload - Weather change hook payload
 * @param {boolean} payload.visualOnly - Whether this is a visual-only refresh
 */
function onWeatherChange({ visualOnly } = {}) {
  if (visualOnly) return;
  refreshSections();
}

/**
 * Initialize VGMusic integration, registering the night and per-condition weather sections.
 */
export function initializeVGMusic() {
  if (!isVGMusicActive()) return;
  ATLAS.log(3, 'VGMusic detected, registering night and weather playlist sections');
  VGMUSIC.registerSection({ id: 'calendariaNight', label: 'CALENDARIA.Music.Section.Night', priority: NIGHT_PRIORITY, types: ['Scene'], predicate: isNight });
  for (const { id, section, label } of WEATHER_SECTIONS) {
    VGMUSIC.registerSection({ id, label, priority: WEATHER_PRIORITY, types: ['Scene'], predicate: () => getWeatherSection() === section });
  }
  Hooks.on(HOOKS.WEATHER_CHANGE, onWeatherChange);
  Hooks.on(HOOKS.SUNRISE, refreshSections);
  Hooks.on(HOOKS.SUNSET, refreshSections);
  Hooks.on(HOOKS.DATE_TIME_CHANGE, refreshSections);
  Hooks.on('canvasReady', refreshSections);
  Hooks.on('updateScene', refreshSections);
}
