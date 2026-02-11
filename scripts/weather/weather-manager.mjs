/**
 * Weather Manager - Core state management and API for the weather system.
 * Handles current weather state, settings integration, and procedural generation.
 * Reads weather configuration from the active calendar's climate zones.
 * @module Weather/WeatherManager
 * @author Tyler
 */

import { isBundledCalendar } from '../calendar/calendar-loader.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SCENE_FLAGS, SETTINGS } from '../constants.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { canChangeWeather } from '../utils/permissions.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';
import { CLIMATE_ZONE_TEMPLATES } from './climate-data.mjs';
import { generateForecast, generateWeather } from './weather-generator.mjs';
import { ALL_PRESETS, getAllPresets, getPreset, WEATHER_CATEGORIES } from './weather-presets.mjs';

/**
 * Weather Manager.
 * Manages weather state and provides the main weather API.
 */
export default class WeatherManager {
  /** @type {object|null} Current weather state */
  static #currentWeather = null;

  /** @type {boolean} Whether the manager is initialized */
  static #initialized = false;

  /**
   * Initialize the weather manager.
   * Called during module ready hook.
   */
  static async initialize() {
    if (this.#initialized) return;
    this.#currentWeather = game.settings.get(MODULE.ID, SETTINGS.CURRENT_WEATHER) || null;
    Hooks.on(HOOKS.DAY_CHANGE, this.#onDayChange.bind(this));
    this.#initialized = true;
    log(3, 'WeatherManager initialized');
  }

  /**
   * Get the current weather.
   * @returns {object|null} Current weather state
   */
  static getCurrentWeather() {
    return this.#currentWeather;
  }

  /**
   * Get temperature for current weather, generating if missing.
   * @returns {number|null} Temperature or null if no weather/zone
   */
  static getTemperature() {
    if (!this.#currentWeather) return null;
    if (this.#currentWeather.temperature != null) return this.#currentWeather.temperature;
    return this.#generateTemperatureForPreset(this.#currentWeather.id);
  }

  /**
   * Set the current weather by preset ID.
   * @param {string} presetId - Weather preset ID
   * @param {object} [options] - Additional options
   * @param {number} [options.temperature] - Optional temperature override
   * @param {boolean} [options.broadcast] - Whether to broadcast to other clients
   * @param {boolean} [options.fromSocket] - Whether this is a GM executing a socket request
   * @returns {Promise<object>} The set weather
   */
  static async setWeather(presetId, options = {}) {
    if (!options.fromSocket && !canChangeWeather()) {
      log(1, 'User lacks permission to set weather');
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return this.#currentWeather;
    }

    // Non-GM users with permission must request via socket
    if (!options.fromSocket && !game.user.isGM && canChangeWeather()) {
      CalendariaSocket.emit('weatherRequest', { action: 'set', presetId, options: { temperature: options.temperature } });
      return this.#currentWeather;
    }

    const customPresets = this.getCustomPresets();
    const preset = getPreset(presetId, customPresets);

    if (!preset) {
      log(2, `Weather preset not found: ${presetId}`);
      ui.notifications.warn(format('CALENDARIA.Weather.Error.PresetNotFound', { id: presetId }));
      return this.#currentWeather;
    }

    const temperature = options.temperature ?? this.#generateTemperatureForPreset(presetId);

    const weather = {
      id: preset.id,
      label: preset.label,
      description: preset.description,
      icon: preset.icon,
      color: preset.color,
      category: preset.category,
      temperature,
      darknessPenalty: preset.darknessPenalty ?? 0,
      environmentBase: preset.environmentBase ?? null,
      environmentDark: preset.environmentDark ?? null,
      setAt: game.time.worldTime,
      setBy: game.user.id
    };

    await this.#saveWeather(weather, options.broadcast !== false);
    return weather;
  }

  /**
   * Set custom weather with arbitrary values.
   * @param {object} weatherData - Weather data
   * @param {string} weatherData.label - Display label
   * @param {string} [weatherData.icon] - Icon class
   * @param {string} [weatherData.color] - Display color
   * @param {string} [weatherData.description] - Description
   * @param {number} [weatherData.temperature] - Temperature
   * @param {boolean} [broadcast] - Whether to broadcast
   * @returns {Promise<object>} The set weather
   */
  static async setCustomWeather(weatherData, broadcast = true) {
    if (!canChangeWeather()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return this.#currentWeather;
    }
    if (!game.user.isGM) {
      ui.notifications.warn('CALENDARIA.Weather.Error.CustomRequiresGM', { localize: true });
      return this.#currentWeather;
    }
    const weather = {
      id: 'custom',
      label: weatherData.label,
      description: weatherData.description || '',
      icon: weatherData.icon || 'fa-question',
      color: weatherData.color || '#888888',
      category: 'custom',
      temperature: weatherData.temperature ?? null,
      darknessPenalty: weatherData.darknessPenalty ?? 0,
      environmentBase: weatherData.environmentBase ?? null,
      environmentDark: weatherData.environmentDark ?? null,
      setAt: game.time.worldTime,
      setBy: game.user.id
    };
    await this.#saveWeather(weather, broadcast);
    return weather;
  }

  /**
   * Clear the current weather.
   * @param {boolean} [broadcast] - Whether to broadcast
   * @param {boolean} [fromSocket] - Whether this was triggered by a socket event
   * @returns {Promise<void>}
   */
  static async clearWeather(broadcast = true, fromSocket = false) {
    if (!fromSocket && !canChangeWeather()) return;
    if (!fromSocket && !game.user.isGM && canChangeWeather()) {
      CalendariaSocket.emit('weatherRequest', { action: 'clear' });
      return;
    }
    await this.#saveWeather(null, broadcast);
  }

  /**
   * Save weather to settings and optionally broadcast.
   * @param {object|null} weather - Weather to save
   * @param {boolean} broadcast - Whether to broadcast
   * @private
   */
  static async #saveWeather(weather, broadcast) {
    const previous = this.#currentWeather;
    this.#currentWeather = weather;
    await game.settings.set(MODULE.ID, SETTINGS.CURRENT_WEATHER, weather);
    Hooks.callAll(HOOKS.WEATHER_CHANGE, { previous, current: weather });
    if (broadcast) CalendariaSocket.emit('weatherChange', { weather });
    log(3, 'Weather changed:', weather?.id ?? 'cleared');
  }

  /**
   * Handle remote weather change.
   * @param {object} data - Socket data
   */
  static handleRemoteWeatherChange(data) {
    this.#currentWeather = data.weather;
    Hooks.callAll(HOOKS.WEATHER_CHANGE, { previous: null, current: data.weather, remote: true });
  }

  /**
   * Generate and set weather based on active calendar's climate zone.
   * @param {object} [options] - Generation options
   * @param {string} [options.zoneId] - Zone ID override (uses active if not provided)
   * @param {string} [options.season] - Season name override (uses current if not provided)
   * @param {boolean} [options.broadcast] - Whether to broadcast
   * @returns {Promise<object>} Generated weather
   */
  static async generateAndSetWeather(options = {}) {
    if (!options.fromSocket && !canChangeWeather()) {
      log(1, 'User lacks permission to generate weather');
      return this.#currentWeather;
    }
    if (!options.fromSocket && !game.user.isGM && canChangeWeather()) {
      CalendariaSocket.emit('weatherRequest', { action: 'generate', options: { zoneId: options.zoneId, season: options.season } });
      return this.#currentWeather;
    }
    const zoneConfig = this.getActiveZone(options.zoneId);
    const seasonData = this.#getCurrentSeason();
    const season = options.season || (seasonData ? localize(seasonData.name) : null);
    const seasonClimate = seasonData?.climate ?? null;
    const customPresets = this.getCustomPresets();
    let result;
    if (!zoneConfig && !seasonClimate) {
      log(2, 'No climate zone or season climate configured, using random preset');
      const allPresets = getAllPresets(customPresets);
      const randomPreset = allPresets[Math.floor(Math.random() * allPresets.length)];
      const min = randomPreset.tempMin ?? 10;
      const max = randomPreset.tempMax ?? 25;
      const temperature = Math.round(min + Math.random() * (max - min));
      result = { preset: randomPreset, temperature };
    } else {
      result = generateWeather({ seasonClimate, zoneConfig, season, customPresets });
    }
    const weather = {
      id: result.preset.id,
      label: result.preset.label,
      description: result.preset.description,
      icon: result.preset.icon,
      color: result.preset.color,
      category: result.preset.category,
      temperature: result.temperature,
      darknessPenalty: result.preset.darknessPenalty ?? 0,
      setAt: game.time.worldTime,
      setBy: game.user.id,
      generated: true
    };
    await this.#saveWeather(weather, options.broadcast !== false);
    return weather;
  }

  /**
   * Generate a weather forecast using active calendar's zone config.
   * @param {object} [options] - Forecast options
   * @param {number} [options.days] - Number of days
   * @param {string} [options.zoneId] - Zone ID override
   * @returns {object[]} Forecast array
   */
  static getForecast(options = {}) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return [];
    const zoneConfig = this.getActiveZone(options.zoneId);
    const days = options.days || 7;
    const customPresets = this.getCustomPresets();
    const components = game.time.components;
    const yearZero = calendar.years?.yearZero ?? 0;

    return generateForecast({
      zoneConfig,
      startYear: components.year + yearZero,
      startMonth: components.month,
      startDay: (components.dayOfMonth ?? 0) + 1,
      days,
      customPresets,
      getSeasonForDate: (year, month, day) => {
        const season = calendar.getCurrentSeason?.({ year: year - yearZero, month, dayOfMonth: day - 1 });
        if (!season) return null;
        return { name: localize(season.name), climate: season.climate };
      }
    });
  }

  /**
   * Handle day change for auto-generation.
   * @private
   */
  static async #onDayChange() {
    const calendar = CalendarManager.getActiveCalendar();
    const autoGenerate = calendar?.weather?.autoGenerate ?? false;
    if (!autoGenerate || !CalendariaSocket.isPrimaryGM()) return;
    await this.generateAndSetWeather();
  }

  /**
   * Get current season object.
   * @returns {object|null} Season object with name, climate, etc.
   * @private
   */
  static #getCurrentSeason() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.getCurrentSeason) return null;
    return calendar.getCurrentSeason(game.time.components);
  }

  /**
   * Generate temperature for a preset based on active zone and season.
   * Uses season climate as base with zone overrides.
   * @param {string} presetId - Weather preset ID
   * @returns {number|null} Generated temperature or null if no config
   * @private
   */
  static #generateTemperatureForPreset(presetId) {
    const zoneConfig = this.getActiveZone();
    const seasonData = this.#getCurrentSeason();
    const season = seasonData ? localize(seasonData.name) : null;
    const seasonClimate = seasonData?.climate;
    let tempRange = { min: 10, max: 22 };
    const zoneOverride = season && zoneConfig?.seasonOverrides?.[season];
    if (zoneOverride?.temperatures?.min != null || zoneOverride?.temperatures?.max != null) {
      tempRange = { min: zoneOverride.temperatures.min ?? 10, max: zoneOverride.temperatures.max ?? 22 };
    } else if (seasonClimate?.temperatures?.min != null || seasonClimate?.temperatures?.max != null) {
      tempRange = { min: seasonClimate.temperatures.min ?? 10, max: seasonClimate.temperatures.max ?? 22 };
    } else if (zoneConfig?.temperatures) {
      const temps = zoneConfig.temperatures;
      if (season && temps[season]) tempRange = temps[season];
      else if (temps._default) tempRange = temps._default;
    } else {
      const customPresets = this.getCustomPresets();
      const preset = getPreset(presetId, customPresets);
      const min = preset?.tempMin ?? 10;
      const max = preset?.tempMax ?? 25;
      return Math.round(min + Math.random() * (max - min));
    }
    const presetConfig = Object.values(zoneConfig?.presets ?? {}).find((p) => p.id === presetId && p.enabled !== false);
    if (presetConfig?.tempMin != null) tempRange = { ...tempRange, min: presetConfig.tempMin };
    if (presetConfig?.tempMax != null) tempRange = { ...tempRange, max: presetConfig.tempMax };
    return Math.round(tempRange.min + Math.random() * (tempRange.max - tempRange.min));
  }

  /**
   * Get the active climate zone config from the calendar.
   * @param {string} [zoneId] - Optional zone ID override
   * @param {object} [scene] - Optional scene to check for scene-level override
   * @returns {object|null} Zone config object
   */
  static getActiveZone(zoneId, scene) {
    const calendar = CalendarManager.getActiveCalendar();
    const zones = calendar?.weatherZonesArray;
    if (!zones?.length) return null;
    const sceneOverride = scene?.getFlag?.(MODULE.ID, SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE);
    const targetId = zoneId ?? sceneOverride ?? calendar.weather.activeZone ?? 'temperate';
    return zones.find((z) => z.id === targetId) ?? zones[0] ?? null;
  }

  /**
   * Set the active climate zone on the calendar.
   * @param {string} zoneId - Zone ID to set as active
   * @returns {Promise<void>}
   */
  static async setActiveZone(zoneId) {
    if (!canChangeWeather()) return;
    const calendar = CalendarManager.getActiveCalendar();
    const calendarId = calendar?.metadata?.id;
    if (!calendarId) return;
    const calendarData = CalendarManager.getCalendar(calendarId)?.toObject();
    if (!calendarData?.weather) return;
    const zones = calendarData.weather.zones ? Object.values(calendarData.weather.zones) : [];
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    calendarData.weather.activeZone = zoneId;
    if (isBundledCalendar(calendarId)) await CalendarManager.saveDefaultOverride(calendarId, calendarData);
    else await CalendarManager.updateCustomCalendar(calendarId, calendarData);
    log(3, `Active climate zone set to: ${zoneId}`);
  }

  /**
   * Get all climate zones for the active calendar.
   * @returns {object[]} Array of zone config objects
   */
  static getCalendarZones() {
    const calendar = CalendarManager.getActiveCalendar();
    return calendar?.weatherZonesArray ?? [];
  }

  /**
   * Get all available climate zone templates.
   * @returns {object[]} Climate zone template objects
   */
  static getClimateZoneTemplates() {
    return Object.values(CLIMATE_ZONE_TEMPLATES);
  }

  /**
   * Get custom weather presets.
   * @returns {object[]} Custom presets
   */
  static getCustomPresets() {
    return game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
  }

  /**
   * Add a custom weather preset.
   * @param {object} preset - Preset to add
   * @param {string} preset.id - Unique ID
   * @param {string} preset.label - Display label
   * @param {string} [preset.icon] - Icon class
   * @param {string} [preset.color] - Display color
   * @param {string} [preset.description] - Description
   * @returns {Promise<object>} The added preset
   */
  static async addCustomPreset(preset) {
    if (!canChangeWeather()) return null;
    const customPresets = this.getCustomPresets();

    if (customPresets.some((p) => p.id === preset.id) || ALL_PRESETS.some((p) => p.id === preset.id)) {
      log(2, `Weather preset ID already exists: ${preset.id}`);
      ui.notifications.warn(format('CALENDARIA.Weather.Error.DuplicateId', { id: preset.id }));
      return null;
    }

    const newPreset = { id: preset.id, label: preset.label, description: preset.description || '', icon: preset.icon || 'fa-question', color: preset.color || '#888888', category: 'custom' };
    customPresets.push(newPreset);
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, customPresets);
    log(3, `Added custom weather preset: ${preset.id}`);
    return newPreset;
  }

  /**
   * Remove a custom weather preset.
   * @param {string} presetId - Preset ID to remove
   * @returns {Promise<boolean>} True if removed
   */
  static async removeCustomPreset(presetId) {
    if (!canChangeWeather()) return false;
    const customPresets = this.getCustomPresets();
    const index = customPresets.findIndex((p) => p.id === presetId);
    if (index === -1) return false;
    customPresets.splice(index, 1);
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, customPresets);
    log(3, `Removed custom weather preset: ${presetId}`);
    return true;
  }

  /**
   * Update a custom weather preset.
   * @param {string} presetId - Preset ID to update
   * @param {object} updates - Updates to apply
   * @returns {Promise<object|null>} Updated preset or null
   */
  static async updateCustomPreset(presetId, updates) {
    if (!canChangeWeather()) return null;
    const customPresets = this.getCustomPresets();
    const index = customPresets.findIndex((p) => p.id === presetId);
    if (index === -1) return null;
    const preset = customPresets[index];
    Object.assign(preset, updates);
    preset.category = 'custom';
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, customPresets);
    log(3, `Updated custom weather preset: ${presetId}`);
    return preset;
  }

  /**
   * Get all weather presets (built-in + custom).
   * @returns {object[]} All presets
   */
  static getAllPresets() {
    return getAllPresets(this.getCustomPresets());
  }

  /**
   * Get a weather preset by ID.
   * @param {string} presetId - Preset ID
   * @returns {object|null} Preset or null
   */
  static getPreset(presetId) {
    return getPreset(presetId, this.getCustomPresets());
  }

  /**
   * Get presets grouped by category.
   * @returns {object} Presets by category
   */
  static getPresetsByCategory() {
    const all = this.getAllPresets();
    const grouped = {};
    for (const category of Object.keys(WEATHER_CATEGORIES)) grouped[category] = all.filter((p) => p.category === category);
    return grouped;
  }

  /**
   * Get weather categories.
   * @returns {object} Category definitions
   */
  static getCategories() {
    return WEATHER_CATEGORIES;
  }

  /**
   * Format a temperature value with the configured unit.
   * @param {number} celsius - Temperature in Celsius
   * @returns {string} Formatted temperature with unit symbol
   */
  static formatTemperature(celsius) {
    if (celsius == null) return '';
    const unit = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_UNIT);
    if (unit === 'fahrenheit') return `${Math.round((celsius * 9) / 5 + 32)}°F`;
    return `${Math.round(celsius)}°C`;
  }
}
