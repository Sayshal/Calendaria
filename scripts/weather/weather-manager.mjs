/**
 * Weather Manager - Core state management and API for the weather system.
 * Handles current weather state, settings integration, and procedural generation.
 * Reads weather configuration from the active calendar's climate zones.
 *
 * @module Weather/WeatherManager
 * @author Tyler
 */

import { MODULE, SETTINGS, HOOKS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { getPreset, getAllPresets, ALL_PRESETS, WEATHER_CATEGORIES } from './weather-presets.mjs';
import { CLIMATE_ZONE_TEMPLATES } from './climate-data.mjs';
import { generateWeather, generateForecast } from './weather-generator.mjs';

/**
 * Weather Manager singleton.
 * Manages weather state and provides the main weather API.
 */
class WeatherManager {
  /** @type {object|null} Current weather state */
  #currentWeather = null;

  /** @type {boolean} Whether the manager is initialized */
  #initialized = false;

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Initialize the weather manager.
   * Called during module ready hook.
   */
  async initialize() {
    if (this.#initialized) return;

    // Load current weather from settings
    this.#currentWeather = game.settings.get(MODULE.ID, SETTINGS.CURRENT_WEATHER) || null;

    // Set up day change hook for auto-generation
    Hooks.on(HOOKS.DAY_CHANGE, this.#onDayChange.bind(this));

    this.#initialized = true;
    log(3, 'WeatherManager initialized');
  }

  /* -------------------------------------------- */
  /*  Current Weather                             */
  /* -------------------------------------------- */

  /**
   * Get the current weather.
   * @returns {object|null} Current weather state
   */
  getCurrentWeather() {
    return this.#currentWeather;
  }

  /**
   * Get temperature for current weather, generating if missing.
   * @returns {number|null} Temperature or null if no weather/zone
   */
  getTemperature() {
    if (!this.#currentWeather) return null;
    if (this.#currentWeather.temperature != null) return this.#currentWeather.temperature;
    return this.#generateTemperatureForPreset(this.#currentWeather.id);
  }

  /**
   * Set the current weather by preset ID.
   * @param {string} presetId - Weather preset ID
   * @param {object} [options={}] - Additional options
   * @param {number} [options.temperature] - Optional temperature override
   * @param {boolean} [options.broadcast=true] - Whether to broadcast to other clients
   * @returns {Promise<object>} The set weather
   */
  async setWeather(presetId, options = {}) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can set weather');
      ui.notifications.error(game.i18n.localize('CALENDARIA.Weather.Error.GMOnly'));
      return this.#currentWeather;
    }

    const customPresets = this.getCustomPresets();
    const preset = getPreset(presetId, customPresets);

    if (!preset) {
      log(2, `Weather preset not found: ${presetId}`);
      ui.notifications.warn(game.i18n.format('CALENDARIA.Weather.Error.PresetNotFound', { id: presetId }));
      return this.#currentWeather;
    }

    // Generate temperature from zone config if not provided
    const temperature = options.temperature ?? this.#generateTemperatureForPreset(presetId);

    const weather = {
      id: preset.id,
      label: preset.label,
      description: preset.description,
      icon: preset.icon,
      color: preset.color,
      category: preset.category,
      temperature,
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
   * @param {string} [weatherData.icon='fa-question'] - Icon class
   * @param {string} [weatherData.color='#888888'] - Display color
   * @param {string} [weatherData.description] - Description
   * @param {number} [weatherData.temperature] - Temperature
   * @param {boolean} [broadcast=true] - Whether to broadcast
   * @returns {Promise<object>} The set weather
   */
  async setCustomWeather(weatherData, broadcast = true) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can set weather');
      ui.notifications.error(game.i18n.localize('CALENDARIA.Weather.Error.GMOnly'));
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
      setAt: game.time.worldTime,
      setBy: game.user.id
    };

    await this.#saveWeather(weather, broadcast);
    return weather;
  }

  /**
   * Clear the current weather.
   * @param {boolean} [broadcast=true] - Whether to broadcast
   * @returns {Promise<void>}
   */
  async clearWeather(broadcast = true) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can clear weather');
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
  async #saveWeather(weather, broadcast) {
    const previous = this.#currentWeather;
    this.#currentWeather = weather;

    await game.settings.set(MODULE.ID, SETTINGS.CURRENT_WEATHER, weather);

    // Fire hook
    Hooks.callAll(HOOKS.WEATHER_CHANGE, { previous, current: weather });

    // Broadcast to other clients
    if (broadcast) CalendariaSocket.emit('weatherChange', { weather });

    log(3, 'Weather changed:', weather?.id ?? 'cleared');
  }

  /**
   * Handle remote weather change.
   * @param {object} data - Socket data
   */
  handleRemoteWeatherChange(data) {
    this.#currentWeather = data.weather;
    Hooks.callAll(HOOKS.WEATHER_CHANGE, { previous: null, current: data.weather, remote: true });
  }

  /* -------------------------------------------- */
  /*  Weather Generation                          */
  /* -------------------------------------------- */

  /**
   * Generate and set weather based on active calendar's climate zone.
   * @param {object} [options={}] - Generation options
   * @param {string} [options.zoneId] - Zone ID override (uses active if not provided)
   * @param {string} [options.season] - Season override (uses current if not provided)
   * @param {boolean} [options.broadcast=true] - Whether to broadcast
   * @returns {Promise<object>} Generated weather
   */
  async generateAndSetWeather(options = {}) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can generate weather');
      return this.#currentWeather;
    }

    const zoneConfig = this.getActiveZone(options.zoneId);
    if (!zoneConfig) {
      log(2, 'No climate zone configured');
      return this.#currentWeather;
    }

    const season = options.season || this.#getCurrentSeasonName();
    const customPresets = this.getCustomPresets();

    const result = generateWeather({
      zoneConfig,
      season,
      customPresets
    });

    const weather = {
      id: result.preset.id,
      label: result.preset.label,
      description: result.preset.description,
      icon: result.preset.icon,
      color: result.preset.color,
      category: result.preset.category,
      temperature: result.temperature,
      setAt: game.time.worldTime,
      setBy: game.user.id,
      generated: true
    };

    await this.#saveWeather(weather, options.broadcast !== false);
    return weather;
  }

  /**
   * Generate a weather forecast using active calendar's zone config.
   * @param {object} [options={}] - Forecast options
   * @param {number} [options.days=7] - Number of days
   * @param {string} [options.zoneId] - Zone ID override
   * @returns {object[]} Forecast array
   */
  getForecast(options = {}) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return [];

    const zoneConfig = this.getActiveZone(options.zoneId);
    if (!zoneConfig) return [];

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
        const season = calendar.getCurrentSeason?.({ month, dayOfMonth: day - 1 });
        return season ? game.i18n.localize(season.name) : null;
      }
    });
  }

  /**
   * Handle day change for auto-generation.
   * @private
   */
  async #onDayChange() {
    // Check calendar's weather.autoGenerate flag
    const calendar = CalendarManager.getActiveCalendar();
    const autoGenerate = calendar?.weather?.autoGenerate ?? false;

    if (!autoGenerate || !game.user.isGM) return;

    // Only primary GM generates
    if (!CalendariaSocket.isPrimaryGM()) return;

    await this.generateAndSetWeather();
  }

  /**
   * Get current season name.
   * @returns {string|null} Season name
   * @private
   */
  #getCurrentSeasonName() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.getCurrentSeason) return null;

    const season = calendar.getCurrentSeason(game.time.components);
    return season ? game.i18n.localize(season.name) : null;
  }

  /**
   * Generate temperature for a preset based on active zone and season.
   * @param {string} presetId - Weather preset ID
   * @returns {number|null} Generated temperature or null if no zone configured
   * @private
   */
  #generateTemperatureForPreset(presetId) {
    const zoneConfig = this.getActiveZone();
    if (!zoneConfig?.temperatures) return null;

    const season = this.#getCurrentSeasonName();
    const temps = zoneConfig.temperatures;

    // Get base temperature range from season or default
    let tempRange = { min: 10, max: 22 };
    if (season && temps[season]) tempRange = temps[season];
    else if (temps._default) tempRange = temps._default;

    // Apply preset-specific overrides if configured
    const presetConfig = zoneConfig.presets?.find((p) => p.id === presetId);
    if (presetConfig?.tempMin != null) tempRange = { ...tempRange, min: presetConfig.tempMin };
    if (presetConfig?.tempMax != null) tempRange = { ...tempRange, max: presetConfig.tempMax };

    return Math.round(tempRange.min + Math.random() * (tempRange.max - tempRange.min));
  }

  /* -------------------------------------------- */
  /*  Active Zone Management                      */
  /* -------------------------------------------- */

  /**
   * Get the active climate zone config from the calendar.
   * @param {string} [zoneId] - Optional zone ID override
   * @returns {object|null} Zone config object
   */
  getActiveZone(zoneId) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.weather?.zones?.length) return null;

    const targetId = zoneId ?? calendar.weather.activeZone ?? 'temperate';
    return calendar.weather.zones.find((z) => z.id === targetId) ?? calendar.weather.zones[0] ?? null;
  }

  /**
   * Set the active climate zone on the calendar.
   * @param {string} zoneId - Zone ID to set as active
   * @returns {Promise<void>}
   */
  async setActiveZone(zoneId) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can set active zone');
      return;
    }

    const calendarId = CalendarManager.getActiveCalendarId();
    if (!calendarId) return;

    const calendarData = CalendarManager.getCalendarData(calendarId);
    if (!calendarData?.weather) return;

    // Validate zone exists
    const zone = calendarData.weather.zones?.find((z) => z.id === zoneId);
    if (!zone) {
      log(2, `Climate zone not found: ${zoneId}`);
      return;
    }

    calendarData.weather.activeZone = zoneId;
    await CalendarManager.updateCalendar(calendarId, calendarData);

    log(3, `Active climate zone set to: ${zoneId}`);
  }

  /**
   * Get all climate zones for the active calendar.
   * @returns {object[]} Array of zone config objects
   */
  getCalendarZones() {
    const calendar = CalendarManager.getActiveCalendar();
    return calendar?.weather?.zones ?? [];
  }

  /**
   * Get all available climate zone templates.
   * @returns {object[]} Climate zone template objects
   */
  getClimateZoneTemplates() {
    return Object.values(CLIMATE_ZONE_TEMPLATES);
  }

  /* -------------------------------------------- */
  /*  Custom Presets                              */
  /* -------------------------------------------- */

  /**
   * Get custom weather presets.
   * @returns {object[]} Custom presets
   */
  getCustomPresets() {
    return game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
  }

  /**
   * Add a custom weather preset.
   * @param {object} preset - Preset to add
   * @param {string} preset.id - Unique ID
   * @param {string} preset.label - Display label
   * @param {string} [preset.icon='fa-question'] - Icon class
   * @param {string} [preset.color='#888888'] - Display color
   * @param {string} [preset.description] - Description
   * @returns {Promise<object>} The added preset
   */
  async addCustomPreset(preset) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can add custom presets');
      return null;
    }

    const customPresets = this.getCustomPresets();

    // Check for duplicate ID
    if (customPresets.some((p) => p.id === preset.id) || ALL_PRESETS.some((p) => p.id === preset.id)) {
      log(2, `Weather preset ID already exists: ${preset.id}`);
      ui.notifications.warn(game.i18n.format('CALENDARIA.Weather.Error.DuplicateId', { id: preset.id }));
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
  async removeCustomPreset(presetId) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can remove custom presets');
      return false;
    }

    const customPresets = this.getCustomPresets();
    const index = customPresets.findIndex((p) => p.id === presetId);

    if (index === -1) {
      log(2, `Custom preset not found: ${presetId}`);
      return false;
    }

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
  async updateCustomPreset(presetId, updates) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can update custom presets');
      return null;
    }

    const customPresets = this.getCustomPresets();
    const index = customPresets.findIndex((p) => p.id === presetId);

    if (index === -1) {
      log(2, `Custom preset not found: ${presetId}`);
      return null;
    }

    const preset = customPresets[index];
    Object.assign(preset, updates);
    preset.category = 'custom';

    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, customPresets);

    log(3, `Updated custom weather preset: ${presetId}`);
    return preset;
  }

  /* -------------------------------------------- */
  /*  Preset Access                               */
  /* -------------------------------------------- */

  /**
   * Get all weather presets (built-in + custom).
   * @returns {object[]} All presets
   */
  getAllPresets() {
    return getAllPresets(this.getCustomPresets());
  }

  /**
   * Get a weather preset by ID.
   * @param {string} presetId - Preset ID
   * @returns {object|null} Preset or null
   */
  getPreset(presetId) {
    return getPreset(presetId, this.getCustomPresets());
  }

  /**
   * Get presets grouped by category.
   * @returns {object} Presets by category
   */
  getPresetsByCategory() {
    const all = this.getAllPresets();
    const grouped = {};
    for (const category of Object.keys(WEATHER_CATEGORIES)) grouped[category] = all.filter((p) => p.category === category);
    return grouped;
  }

  /**
   * Get weather categories.
   * @returns {object} Category definitions
   */
  getCategories() {
    return WEATHER_CATEGORIES;
  }

  /* -------------------------------------------- */
  /*  Temperature Formatting                       */
  /* -------------------------------------------- */

  /**
   * Format a temperature value with the configured unit.
   * @param {number} celsius - Temperature in Celsius
   * @returns {string} Formatted temperature with unit symbol
   */
  formatTemperature(celsius) {
    if (celsius == null) return '';
    const unit = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_UNIT);
    if (unit === 'fahrenheit') {
      const fahrenheit = Math.round((celsius * 9) / 5 + 32);
      return `${fahrenheit}°F`;
    }
    return `${Math.round(celsius)}°C`;
  }
}

export default new WeatherManager();
