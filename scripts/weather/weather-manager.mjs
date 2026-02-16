/**
 * Weather Manager - Core state management and API for the weather system.
 * Handles current weather state, settings integration, and procedural generation.
 * Reads weather configuration from the active calendar's climate zones.
 * @module Weather/WeatherManager
 * @author Tyler
 */

import { isBundledCalendar } from '../calendar/calendar-loader.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { COMPASS_DIRECTIONS, HOOKS, MODULE, SCENE_FLAGS, SETTINGS, WIND_SPEEDS } from '../constants.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { canChangeWeather } from '../utils/permissions.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';
import { CLIMATE_ZONE_TEMPLATES } from './climate-data.mjs';
import { applyTempModifier, generateForecast, generateWeather, mergeClimateConfig } from './weather-generator.mjs';
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
    if (this.#currentWeather && CalendariaSocket.isPrimaryGM()) {
      const components = game.time.components;
      const calendar = CalendarManager.getActiveCalendar();
      const yearZero = calendar?.years?.yearZero ?? 0;
      const existing = this.getWeatherForDate(components.year + yearZero, components.month, (components.dayOfMonth ?? 0) + 1);
      if (!existing) await this.#recordWeatherHistory(this.#currentWeather);
    }
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
   * @param {object} [options.wind] - Wind override { speed, direction, forced }
   * @param {object} [options.precipitation] - Precipitation override { type, intensity }
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
      wind: options.wind ?? preset.wind ?? { speed: 0, direction: null, forced: false },
      precipitation: options.precipitation ?? preset.precipitation ?? { type: null, intensity: 0 },
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
      wind: weatherData.wind ?? { speed: 0, direction: null, forced: false },
      precipitation: weatherData.precipitation ?? { type: null, intensity: 0 },
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
    if (weather && CalendariaSocket.isPrimaryGM()) await this.#recordWeatherHistory(weather);
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
    const currentWeatherId = this.#currentWeather?.id ?? null;
    let inertia = game.settings.get(MODULE.ID, SETTINGS.WEATHER_INERTIA) ?? 0.3;
    if (this.#currentWeather?.season && season !== this.#currentWeather.season) inertia *= 0.5;
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
      result = generateWeather({ seasonClimate, zoneConfig, season, customPresets, currentWeatherId, inertia });
    }
    const weather = {
      id: result.preset.id,
      label: result.preset.label,
      description: result.preset.description,
      icon: result.preset.icon,
      color: result.preset.color,
      category: result.preset.category,
      temperature: result.temperature,
      wind: result.wind ?? { speed: 0, direction: null, forced: false },
      precipitation: result.precipitation ?? { type: null, intensity: 0 },
      darknessPenalty: result.preset.darknessPenalty ?? 0,
      setAt: game.time.worldTime,
      setBy: game.user.id,
      generated: true,
      season
    };
    await this.#saveWeather(weather, options.broadcast !== false);
    return weather;
  }

  /**
   * Generate a weather forecast using active calendar's zone config.
   * @param {object} [options] - Forecast options
   * @param {number} [options.days] - Number of days
   * @param {string} [options.zoneId] - Zone ID override
   * @param {number} [options.accuracy] - Forecast accuracy 0-100 (default: from setting)
   * @returns {object[]} Forecast array
   */
  static getForecast(options = {}) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return [];
    const zoneConfig = this.getActiveZone(options.zoneId);
    const maxDays = game.settings.get(MODULE.ID, SETTINGS.FORECAST_DAYS) ?? 7;
    const days = Math.min(options.days || maxDays, maxDays);
    const customPresets = this.getCustomPresets();
    const components = game.time.components;
    const yearZero = calendar.years?.yearZero ?? 0;
    const currentWeatherId = this.#currentWeather?.id ?? null;
    const inertia = game.settings.get(MODULE.ID, SETTINGS.WEATHER_INERTIA) ?? 0.3;
    const accuracy = options.accuracy ?? game.settings.get(MODULE.ID, SETTINGS.FORECAST_ACCURACY) ?? 70;
    return generateForecast({
      zoneConfig,
      startYear: components.year + yearZero,
      startMonth: components.month,
      startDay: (components.dayOfMonth ?? 0) + 1,
      days,
      customPresets,
      currentWeatherId,
      inertia,
      accuracy,
      getSeasonForDate: this.#makeSeasonResolver(calendar, yearZero),
      getDaysInMonth: this.#makeDaysInMonth(calendar, yearZero)
    });
  }

  /**
   * Handle day change for auto-generation.
   * @param {object} data - Hook data with previous/current components and calendar
   * @private
   */
  static async #onDayChange(data) {
    if (!CalendariaSocket.isPrimaryGM()) return;
    const calendar = CalendarManager.getActiveCalendar();
    const autoGenerate = calendar?.weather?.autoGenerate ?? false;
    if (this.#currentWeather) await this.#recordWeatherHistory(this.#currentWeather);
    if (!autoGenerate) return;
    const gap = this.#calcDayGap(data, calendar);
    if (gap > 1) await this.#backfillHistory(data, calendar, gap);
    else await this.generateAndSetWeather();
  }

  /**
   * Calculate the number of days between previous and current date from hook data.
   * @param {object} data - Hook data with previous/current components
   * @param {object} calendar - Active calendar
   * @returns {number} Number of days jumped (1 = normal single day advance)
   * @private
   */
  static #calcDayGap(data, calendar) {
    if (!data?.previous || !data?.current || !calendar) return 1;
    const yearZero = calendar.years?.yearZero ?? 0;
    const prevTime = calendar.componentsToTime({ year: data.previous.year - yearZero, month: data.previous.month, dayOfMonth: data.previous.dayOfMonth ?? 0, hour: 0, minute: 0, second: 0 });
    const currTime = calendar.componentsToTime({ year: data.current.year - yearZero, month: data.current.month, dayOfMonth: data.current.dayOfMonth ?? 0, hour: 0, minute: 0, second: 0 });
    const secondsPerDay = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
    return Math.max(1, Math.round((currTime - prevTime) / secondsPerDay));
  }

  /**
   * Backfill weather history for a multi-day jump.
   * Generates from (today - daysToFill) forward to today, records each day,
   * and sets the final day as current weather.
   * @param {object} data - Hook data with current components
   * @param {object} calendar - Active calendar
   * @param {number} gap - Number of days jumped
   * @private
   */
  static async #backfillHistory(data, calendar, gap) {
    const maxDays = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY_DAYS) ?? 365;
    if (maxDays === 0) {
      await this.generateAndSetWeather();
      return;
    }
    const daysToFill = Math.min(gap - 1, maxDays);
    const yearZero = calendar.years?.yearZero ?? 0;
    const currentYear = data.current.year;
    const currentMonth = data.current.month;
    const zoneConfig = this.getActiveZone();
    const customPresets = this.getCustomPresets();
    const inertia = game.settings.get(MODULE.ID, SETTINGS.WEATHER_INERTIA) ?? 0.3;
    const secondsPerDay = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
    const currentTime = calendar.componentsToTime({ year: currentYear - yearZero, month: currentMonth, dayOfMonth: data.current.dayOfMonth ?? 0, hour: 0, minute: 0, second: 0 });
    const startTime = currentTime - daysToFill * secondsPerDay;
    const startComponents = calendar.timeToComponents(startTime);
    const startYear = startComponents.year + yearZero;
    const startMonth = startComponents.month;
    const startDay = (startComponents.dayOfMonth ?? 0) + 1;
    const forecast = generateForecast({
      zoneConfig,
      startYear,
      startMonth,
      startDay,
      days: daysToFill + 1,
      customPresets,
      currentWeatherId: null,
      inertia,
      getSeasonForDate: this.#makeSeasonResolver(calendar, yearZero),
      getDaysInMonth: this.#makeDaysInMonth(calendar, yearZero)
    });

    const history = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY) || {};
    for (let i = 0; i < forecast.length - 1; i++) {
      const f = forecast[i];
      history[f.year] ??= {};
      history[f.year][f.month] ??= {};
      history[f.year][f.month][f.day] = {
        id: f.preset.id,
        label: localize(f.preset.label),
        icon: f.preset.icon,
        color: f.preset.color,
        category: f.preset.category,
        temperature: f.temperature,
        wind: f.wind ?? null,
        precipitation: f.precipitation ?? null,
        generated: true,
        zoneId: zoneConfig?.id ?? null
      };
    }
    this.#pruneHistory(history, maxDays);
    await game.settings.set(MODULE.ID, SETTINGS.WEATHER_HISTORY, history);
    const today = forecast[forecast.length - 1];
    const seasonData = calendar.getCurrentSeason?.(game.time.components);
    const season = seasonData ? localize(seasonData.name) : null;
    const weather = {
      id: today.preset.id,
      label: today.preset.label,
      description: today.preset.description,
      icon: today.preset.icon,
      color: today.preset.color,
      category: today.preset.category,
      temperature: today.temperature,
      wind: today.wind ?? { speed: 0, direction: null, forced: false },
      precipitation: today.precipitation ?? { type: null, intensity: 0 },
      darknessPenalty: today.preset.darknessPenalty ?? 0,
      setAt: game.time.worldTime,
      setBy: game.user.id,
      generated: true,
      season
    };
    await this.#saveWeather(weather, true);
    log(3, `Backfilled ${daysToFill} days of weather history`);
  }

  /**
   * Record weather for today into history storage.
   * @param {object} weather - Weather state to record
   * @private
   */
  static async #recordWeatherHistory(weather) {
    const maxDays = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY_DAYS) ?? 365;
    if (maxDays === 0) return;
    const components = game.time.components;
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const year = components.year + yearZero;
    const month = components.month;
    const day = (components.dayOfMonth ?? 0) + 1;
    const history = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY) || {};
    history[year] ??= {};
    history[year][month] ??= {};
    const zone = this.getActiveZone();
    history[year][month][day] = {
      id: weather.id,
      label: localize(weather.label),
      icon: weather.icon,
      color: weather.color,
      category: weather.category,
      temperature: weather.temperature,
      wind: weather.wind ?? null,
      precipitation: weather.precipitation ?? null,
      generated: weather.generated ?? false,
      zoneId: zone?.id ?? null
    };
    this.#pruneHistory(history, maxDays);
    await game.settings.set(MODULE.ID, SETTINGS.WEATHER_HISTORY, history);
  }

  /**
   * Prune history to stay within max day count, removing oldest entries first.
   * @param {object} history - Nested year→month→day history object (mutated)
   * @param {number} maxDays - Maximum entries to retain
   * @private
   */
  static #pruneHistory(history, maxDays) {
    const entries = [];
    for (const [y, months] of Object.entries(history)) for (const [m, days] of Object.entries(months)) for (const d of Object.keys(days)) entries.push([Number(y), Number(m), Number(d)]);
    if (entries.length <= maxDays) return;
    entries.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    const toRemove = entries.length - maxDays;
    for (let i = 0; i < toRemove; i++) {
      const [y, m, d] = entries[i];
      delete history[y][m][d];
      if (!Object.keys(history[y][m]).length) delete history[y][m];
      if (!Object.keys(history[y]).length) delete history[y];
    }
  }

  /**
   * Build a getDaysInMonth callback for generateForecast.
   * @param {object} calendar - Active calendar
   * @param {number} yearZero - Year zero offset
   * @returns {Function} getDaysInMonth(month, year)
   * @private
   */
  static #makeDaysInMonth(calendar, yearZero) {
    const fn = (month, year) => calendar.getDaysInMonth?.(month, year - yearZero) ?? 30;
    fn._monthsPerYear = calendar.monthsArray?.length ?? 12;
    return fn;
  }

  /**
   * Build a getSeasonForDate callback for generateForecast.
   * @param {object} calendar - Active calendar
   * @param {number} yearZero - Year zero offset
   * @returns {Function} getSeasonForDate(year, month, day)
   * @private
   */
  static #makeSeasonResolver(calendar, yearZero) {
    return (year, month, day) => {
      const season = calendar.getCurrentSeason?.({ year: year - yearZero, month, dayOfMonth: day - 1 });
      if (!season) return null;
      return { name: localize(season.name), climate: season.climate };
    };
  }

  /**
   * Get historical weather for a specific date.
   * @param {number} year - Display year
   * @param {number} month - Month (0-indexed)
   * @param {number} day - Day of month (1-indexed)
   * @returns {object|null} Historical weather entry or null
   */
  static getWeatherForDate(year, month, day) {
    const history = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY) || {};
    return history[year]?.[month]?.[day] ?? null;
  }

  /**
   * Get weather history as the raw nested object, or a flat array for a specific year/month.
   * @param {object} [options] - Filter options
   * @param {number} [options.year] - Filter to a specific year
   * @param {number} [options.month] - Filter to a specific month (requires year)
   * @returns {object|object[]} Nested history object, or array of { year, month, day, ...entry }
   */
  static getWeatherHistory(options = {}) {
    const history = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY) || {};
    if (options.year == null) return history;
    const yearData = history[options.year];
    if (!yearData) return [];
    const results = [];
    const months = options.month != null ? { [options.month]: yearData[options.month] } : yearData;
    for (const [m, days] of Object.entries(months)) {
      if (!days) continue;
      for (const [d, entry] of Object.entries(days)) results.push({ year: options.year, month: Number(m), day: Number(d), ...entry });
    }
    return results.sort((a, b) => a.month - b.month || a.day - b.day);
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
    if (!zoneConfig && !seasonClimate) {
      const customPresets = this.getCustomPresets();
      const preset = getPreset(presetId, customPresets);
      const min = preset?.tempMin ?? 10;
      const max = preset?.tempMax ?? 25;
      return Math.round(min + Math.random() * (max - min));
    }
    const zoneOverride = season && zoneConfig?.seasonOverrides?.[season];
    const { tempRange } = mergeClimateConfig(seasonClimate, zoneOverride, zoneConfig, season);
    let finalRange = { ...tempRange };
    const presetConfig = Object.values(zoneConfig?.presets ?? {}).find((p) => p.id === presetId && p.enabled !== false);
    if (presetConfig?.tempMin != null) finalRange.min = applyTempModifier(presetConfig.tempMin, tempRange.min);
    if (presetConfig?.tempMax != null) finalRange.max = applyTempModifier(presetConfig.tempMax, tempRange.max);
    return Math.round(finalRange.min + Math.random() * (finalRange.max - finalRange.min));
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

  /**
   * Format a wind speed value with the configured unit.
   * @param {number} kph - Wind speed in kph
   * @returns {string} Formatted wind speed with unit
   */
  static formatWindSpeed(kph) {
    if (kph == null) return '';
    const unit = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_UNIT);
    if (unit === 'fahrenheit') return `${Math.round(kph * 0.621371)} mph`;
    return `${Math.round(kph)} kph`;
  }

  /**
   * Format a precipitation rate with the configured unit.
   * @param {number} mmhr - Precipitation in mm/hr
   * @returns {string} Formatted precipitation with unit
   */
  static formatPrecipitation(mmhr) {
    if (mmhr == null || mmhr === 0) return '';
    const unit = game.settings.get(MODULE.ID, SETTINGS.PRECIPITATION_UNIT);
    if (unit === 'imperial') return `${(mmhr * 0.03937).toFixed(2)} in/hr`;
    return `${mmhr.toFixed(1)} mm/hr`;
  }

  /**
   * Get the localized label for a wind speed value (0-5 scale).
   * @param {number} speed - Wind speed on 0-5 scale
   * @returns {string} Localized wind speed label
   */
  static getWindSpeedLabel(speed) {
    if (speed == null) return '';
    const entry = Object.values(WIND_SPEEDS).find((w) => w.value === speed);
    return entry ? localize(entry.label) : '';
  }

  /**
   * Get the nearest compass direction abbreviation for a degree value.
   * @param {number|null} degrees - Direction in degrees (0-360)
   * @returns {string} Compass abbreviation (e.g. "NNE") or empty string
   */
  static getWindDirectionLabel(degrees) {
    if (degrees == null) return '';
    const entries = Object.entries(COMPASS_DIRECTIONS);
    let closest = entries[0];
    let minDiff = 360;
    for (const [id, deg] of entries) {
      const diff = Math.abs(((degrees - deg + 540) % 360) - 180);
      if (diff < minDiff) {
        minDiff = diff;
        closest = [id, deg];
      }
    }
    return closest[0];
  }

  /**
   * Get a randomized kph value for a wind speed scale value (0-5).
   * Picks a value between the previous tier's kph and this tier's kph.
   * @param {number} speed - Wind speed on 0-5 scale
   * @returns {number} Speed in kph
   */
  static getWindSpeedKph(speed) {
    const speeds = Object.values(WIND_SPEEDS);
    const entry = speeds.find((w) => w.value === speed);
    if (!entry) return 0;
    const prevEntry = speeds.find((w) => w.value === speed - 1);
    const min = prevEntry ? prevEntry.kph + 1 : 0;
    const max = entry.kph;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Build a rich HTML tooltip for weather display.
   * @param {object} options - Paramters for HTML tooltips
   * @param {string} options.label - Weather label
   * @param {string} [options.description] - Weather description
   * @param {string} [options.temp] - Formatted temperature string
   * @param {number} [options.windSpeed] - Wind speed (0-5 scale)
   * @param {number|null} [options.windDirection] - Wind direction in degrees
   * @param {string|null} [options.precipType] - Precipitation type key
   * @param {number} [options.precipIntensity] - Precipitation intensity (0-1)
   * @returns {string} HTML-encoded string for data-tooltip-html
   */
  static buildWeatherTooltip({ label, description, temp, windSpeed, windDirection, precipType, precipIntensity }) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = [];
    const desc = description && description !== label ? esc(description) : '';
    rows.push(`<div class="calendaria-weather-tooltip-header"><strong>${esc(label)}</strong>${desc ? ` — ${desc}` : ''}</div>`);
    if (temp) rows.push(`<div class="calendaria-weather-tooltip-row"><i class="fas fa-temperature-half"></i> ${esc(temp)}</div>`);
    if (windSpeed > 0) {
      const windLabel = this.getWindSpeedLabel(windSpeed);
      const windKph = this.getWindSpeedKph(windSpeed);
      const windFormatted = this.formatWindSpeed(windKph);
      const dirLabel = this.getWindDirectionLabel(windDirection);
      rows.push(`<div class="calendaria-weather-tooltip-row"><i class="fas fa-wind"></i> ${esc(windLabel)}${dirLabel ? ` ${esc(dirLabel)}` : ''} · ${esc(windFormatted)}</div>`);
    }
    if (precipType) {
      const precipLabel = localize(`CALENDARIA.Weather.Precipitation.${precipType.charAt(0).toUpperCase() + precipType.slice(1)}`);
      const rate = this.formatPrecipitation((precipIntensity ?? 0) * 10);
      rows.push(`<div class="calendaria-weather-tooltip-row"><i class="fas fa-droplet"></i> ${esc(precipLabel)}${rate ? ` · ${esc(rate)}` : ''}</div>`);
    }
    const html = `<div class="calendaria-weather-tooltip">${rows.join('')}</div>`;
    return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
