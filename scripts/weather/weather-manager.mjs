/**
 * Weather Manager - Core state management and API for the weather system.
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
import { CLIMATE_ZONE_TEMPLATES } from './data/climate-data.mjs';
import { ALL_PRESETS, getAllPresets, getPreset, WEATHER_CATEGORIES } from './data/weather-presets.mjs';
import { applyForecastVariance, applyTempModifier, dateSeed, generateForecast, generateWeather, mergeClimateConfig, seededRandom } from './weather-generator.mjs';

/**
 * Weather Manager.
 */
export default class WeatherManager {
  /** @type {object} Current weather keyed by zone ID */
  static #currentWeatherByZone = {};

  /** @type {boolean} Whether the manager is initialized */
  static #initialized = false;

  /** @type {string} Default zone key used when no climate zone is configured */
  static DEFAULT_ZONE = '_default';

  /**
   * Resolve the effective fxPreset for a preset, checking visual overrides for built-in presets.
   * @param {object} preset - Weather preset object
   * @returns {string|null} FXMaster preset name or null
   */
  static #resolveFxPreset(preset) {
    const overrides = (game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {})[preset.id];
    if (overrides?.fxPreset !== undefined) return overrides.fxPreset;
    return preset.fxPreset ?? null;
  }

  /**
   * Resolve the effective soundFx for a preset, checking visual overrides for built-in presets.
   * @param {object} preset - Weather preset object
   * @returns {string|null} Sound effect filename (without extension) or null
   */
  static #resolveSoundFx(preset) {
    const overrides = (game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {})[preset.id];
    if (overrides?.soundFx !== undefined) return overrides.soundFx;
    return preset.soundFx ?? null;
  }

  /**
   * Resolve effective environmentBase, merging visual overrides for built-in presets.
   * @param {object} preset - Weather preset object
   * @returns {object|null} Merged environment base config or null
   */
  static #resolveEnvironmentBase(preset) {
    const overrides = (game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {})[preset.id];
    const base = preset.environmentBase ?? {};
    const ov = overrides?.environmentBase ?? {};
    const merged = { ...base, ...Object.fromEntries(Object.entries(ov).filter(([, v]) => v != null)) };
    return Object.keys(merged).length ? merged : null;
  }

  /**
   * Resolve effective environmentDark, merging visual overrides for built-in presets.
   * @param {object} preset - Weather preset object
   * @returns {object|null} Merged environment dark config or null
   */
  static #resolveEnvironmentDark(preset) {
    const overrides = (game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {})[preset.id];
    const base = preset.environmentDark ?? {};
    const ov = overrides?.environmentDark ?? {};
    const merged = { ...base, ...Object.fromEntries(Object.entries(ov).filter(([, v]) => v != null)) };
    return Object.keys(merged).length ? merged : null;
  }

  /**
   * Resolve effective environmentCycle, checking visual overrides for built-in presets.
   * @param {object} preset - Weather preset object
   * @returns {boolean|null} Blend ambience override or null
   */
  static #resolveEnvironmentCycle(preset) {
    const overrides = (game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {})[preset.id];
    if (overrides?.environmentCycle != null) return overrides.environmentCycle;
    return preset.environmentCycle ?? null;
  }

  /**
   * Initialize the weather manager.
   */
  static async initialize() {
    if (this.#initialized) return;
    this.#currentWeatherByZone = game.settings.get(MODULE.ID, SETTINGS.CURRENT_WEATHER) || {};
    if ('undefined' in this.#currentWeatherByZone) {
      this.#currentWeatherByZone[this.DEFAULT_ZONE] = this.#currentWeatherByZone['undefined'];
      delete this.#currentWeatherByZone['undefined'];
      if (CalendariaSocket.isPrimaryGM()) {
        await game.settings.set(MODULE.ID, SETTINGS.CURRENT_WEATHER, this.#currentWeatherByZone);
        log(3, 'Migrated stale "undefined" weather zone key to _default');
      }
    }
    Hooks.on(HOOKS.DAY_CHANGE, this.#onDayChange.bind(this));
    if (CalendariaSocket.isPrimaryGM() && !game.settings.get(MODULE.ID, SETTINGS.WEATHER_DAY_INDEX_MIGRATED)) {
      await this.#migrateWeatherDayIndex();
    }
    if (CalendariaSocket.isPrimaryGM()) {
      const calendar = CalendarManager.getActiveCalendar();
      if (calendar?.weather?.autoGenerate !== undefined) {
        const calendarId = calendar.metadata?.id;
        if (calendarId) {
          await game.settings.set(MODULE.ID, SETTINGS.AUTO_GENERATE_WEATHER, !!calendar.weather.autoGenerate);
          log(3, `Migrated autoGenerate=${calendar.weather.autoGenerate} to world setting`);
        }
      }
      if (Object.keys(this.#currentWeatherByZone).length) {
        const components = game.time.components;
        const yearZero = calendar?.years?.yearZero ?? 0;
        const zones = this.#getEffectiveZones();
        for (const zone of zones) {
          const weather = this.#currentWeatherByZone[zone.id];
          if (!weather) continue;
          const existing = this.getWeatherForDate(components.year + yearZero, components.month, components.dayOfMonth ?? 0, zone.id);
          if (!existing) await this.#recordWeatherHistory(weather, zone.id);
        }
        if (game.settings.get(MODULE.ID, SETTINGS.AUTO_GENERATE_WEATHER)) await this.#ensureForecastPlan();
      }
    }
    this.#initialized = true;
    log(3, 'WeatherManager initialized');
  }

  /**
   * Re-resolve environment overrides for a preset in all cached weather zones.
   * @param {string} presetId - The preset ID whose overrides changed
   */
  static refreshEnvironmentOverrides(presetId) {
    const customPresets = this.getCustomPresets();
    const preset = getPreset(presetId, customPresets);
    if (!preset) return;
    for (const weather of Object.values(this.#currentWeatherByZone)) {
      if (weather?.id !== presetId) continue;
      weather.environmentBase = this.#resolveEnvironmentBase(preset);
      weather.environmentDark = this.#resolveEnvironmentDark(preset);
      weather.environmentCycle = this.#resolveEnvironmentCycle(preset);
    }
  }

  /**
   * Get the current weather for a zone.
   * @param {string} [zoneId] - Zone ID (resolves from active scene if omitted)
   * @param {object} [scene] - Scene to resolve zone from
   * @returns {object|null} Current weather state
   */
  static getCurrentWeather(zoneId, scene) {
    const resolvedZoneId = zoneId ?? this.getActiveZone(null, scene ?? game.scenes?.active)?.id ?? this.DEFAULT_ZONE;
    return this.#currentWeatherByZone[resolvedZoneId] ?? null;
  }

  /**
   * Get temperature for current weather, generating if missing.
   * @param {string} [zoneId] - Zone ID (resolves from active scene if omitted)
   * @returns {number|null} Temperature or null if no weather/zone
   */
  static getTemperature(zoneId) {
    const weather = this.getCurrentWeather(zoneId);
    if (!weather) return null;
    if (weather.temperature != null) return weather.temperature;
    return this.#generateTemperatureForPreset(weather.id);
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
    const zoneId = 'zoneId' in options ? options.zoneId : this.getActiveZone(null, game.scenes?.active)?.id;
    if (!options.fromSocket && !canChangeWeather()) {
      log(1, 'User lacks permission to set weather');
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return this.getCurrentWeather(zoneId);
    }
    if (!options.fromSocket && !game.user.isGM && canChangeWeather()) {
      CalendariaSocket.emit('weatherRequest', { action: 'set', presetId, options: { temperature: options.temperature, zoneId } });
      return this.getCurrentWeather(zoneId);
    }
    const customPresets = this.getCustomPresets();
    const preset = getPreset(presetId, customPresets);
    if (!preset) {
      log(2, `Weather preset not found: ${presetId}`);
      ui.notifications.warn(format('CALENDARIA.Weather.Error.PresetNotFound', { id: presetId }));
      return this.getCurrentWeather(zoneId);
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
      environmentBase: this.#resolveEnvironmentBase(preset),
      environmentDark: this.#resolveEnvironmentDark(preset),
      environmentCycle: this.#resolveEnvironmentCycle(preset),
      fxPreset: options.fxPreset ?? this.#resolveFxPreset(preset),
      soundFx: options.soundFx ?? this.#resolveSoundFx(preset),
      setAt: game.time.worldTime,
      setBy: game.user.id
    };
    await this.#saveWeather(weather, options.broadcast !== false, zoneId);
    if (game.settings.get(MODULE.ID, SETTINGS.GM_OVERRIDE_CLEARS_FORECAST)) {
      await this.#clearForecastPlan(zoneId);
      await this.#ensureForecastPlan();
    }
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
    const zoneId = weatherData.zoneId ?? this.getActiveZone(null, game.scenes?.active)?.id;
    if (!canChangeWeather()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return this.getCurrentWeather(zoneId);
    }
    if (!game.user.isGM) {
      ui.notifications.warn('CALENDARIA.Weather.Error.CustomRequiresGM', { localize: true });
      return this.getCurrentWeather(zoneId);
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
      fxPreset: weatherData.fxPreset ?? null,
      soundFx: weatherData.soundFx ?? null,
      setAt: game.time.worldTime,
      setBy: game.user.id
    };
    await this.#saveWeather(weather, broadcast, zoneId);
    if (game.settings.get(MODULE.ID, SETTINGS.GM_OVERRIDE_CLEARS_FORECAST)) {
      await this.#clearForecastPlan(zoneId);
      await this.#ensureForecastPlan();
    }
    return weather;
  }

  /**
   * Clear the current weather.
   * @param {boolean} [broadcast] - Whether to broadcast
   * @param {boolean} [fromSocket] - Whether this was triggered by a socket event
   * @param {string} [zoneId] - Zone ID to clear weather for
   * @returns {Promise<void>}
   */
  static async clearWeather(broadcast = true, fromSocket = false, zoneId) {
    if (!fromSocket && !canChangeWeather()) return;
    const resolvedZoneId = zoneId ?? this.getActiveZone(null, game.scenes?.active)?.id;
    if (!fromSocket && !game.user.isGM && canChangeWeather()) {
      CalendariaSocket.emit('weatherRequest', { action: 'clear', options: { zoneId: resolvedZoneId } });
      return;
    }
    await this.#saveWeather(null, broadcast, resolvedZoneId);
    log(3, `Weather cleared for zone ${resolvedZoneId}`);
  }

  /**
   * Save weather to settings and optionally broadcast.
   * @param {object|null} weather - Weather to save
   * @param {boolean} broadcast - Whether to broadcast
   * @param {string} [zoneId] - Zone ID for this weather entry
   * @private
   */
  static async #saveWeather(weather, broadcast, zoneId) {
    zoneId ??= this.DEFAULT_ZONE;
    const previous = this.#currentWeatherByZone[zoneId] ?? null;
    if (weather) this.#currentWeatherByZone[zoneId] = weather;
    else delete this.#currentWeatherByZone[zoneId];
    await game.settings.set(MODULE.ID, SETTINGS.CURRENT_WEATHER, this.#currentWeatherByZone);
    if (weather && CalendariaSocket.isPrimaryGM()) await this.#recordWeatherHistory(weather, zoneId);
    Hooks.callAll(HOOKS.WEATHER_CHANGE, { previous, current: weather, zoneId });
    if (broadcast) CalendariaSocket.emit('weatherChange', { weather, zoneId });
    log(3, `Weather changed for zone ${zoneId}:`, weather?.id ?? 'cleared');
  }

  /**
   * Handle remote weather change.
   * @param {object} data - Socket data
   */
  static handleRemoteWeatherChange(data) {
    if (data.bulk) {
      this.#currentWeatherByZone = { ...data.weatherByZone };
      Hooks.callAll(HOOKS.WEATHER_CHANGE, { bulk: true, remote: true });
      return;
    }
    const { weather, zoneId } = data;
    if (weather) this.#currentWeatherByZone[zoneId] = weather;
    else delete this.#currentWeatherByZone[zoneId];
    Hooks.callAll(HOOKS.WEATHER_CHANGE, { previous: null, current: weather, zoneId, remote: true });
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
    const zoneId = 'zoneId' in options ? options.zoneId : this.getActiveZone(null, game.scenes?.active)?.id;
    if (!options.fromSocket && !canChangeWeather()) {
      log(1, 'User lacks permission to generate weather');
      return this.getCurrentWeather(zoneId);
    }
    if (!options.fromSocket && !game.user.isGM && canChangeWeather()) {
      CalendariaSocket.emit('weatherRequest', { action: 'generate', options: { zoneId, season: options.season } });
      return this.getCurrentWeather(zoneId);
    }
    const zoneConfig = this.getActiveZone(zoneId);
    const seasonData = this.#getCurrentSeason();
    const season = options.season || (seasonData?.name ?? null);
    const seasonClimate = seasonData?.climate ?? null;
    const customPresets = this.getCustomPresets();
    const currentWeather = this.#currentWeatherByZone[zoneId];
    const currentWeatherId = currentWeather?.id ?? null;
    let inertia = game.settings.get(MODULE.ID, SETTINGS.WEATHER_INERTIA) ?? 0.3;
    if (currentWeather?.season && season !== currentWeather.season) inertia *= 0.5;
    const prevWeather = currentWeather ? { temperature: currentWeather.temperature, wind: currentWeather.wind } : null;
    const result = generateWeather({ seasonClimate, zoneConfig, season, customPresets, currentWeatherId, inertia, previousWeather: prevWeather });
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
      environmentBase: this.#resolveEnvironmentBase(result.preset),
      environmentDark: this.#resolveEnvironmentDark(result.preset),
      environmentCycle: this.#resolveEnvironmentCycle(result.preset),
      fxPreset: this.#resolveFxPreset(result.preset),
      soundFx: this.#resolveSoundFx(result.preset),
      setAt: game.time.worldTime,
      setBy: game.user.id,
      generated: true,
      season
    };
    await this.#saveWeather(weather, options.broadcast !== false, zoneId);
    log(3, `Weather generated for zone ${zoneId}: ${weather.preset}`);
    if (!options._fromPlan && game.settings.get(MODULE.ID, SETTINGS.GM_OVERRIDE_CLEARS_FORECAST)) {
      await this.#clearForecastPlan(zoneId);
      await this.#ensureForecastPlan();
    }
    return weather;
  }

  /**
   * Generate a weather forecast using the stored forecast plan.
   * @param {object} [options] - Forecast options
   * @param {number} [options.days] - Number of days
   * @param {string} [options.zoneId] - Zone ID override
   * @param {number} [options.accuracy] - Forecast accuracy 0-100 (default: from setting)
   * @returns {object[]} Forecast array
   */
  static getForecast(options = {}) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return [];
    const zoneId = 'zoneId' in options ? options.zoneId : (this.getActiveZone(null, game.scenes?.active)?.id ?? this.DEFAULT_ZONE);
    const maxDays = game.settings.get(MODULE.ID, SETTINGS.FORECAST_DAYS) ?? 7;
    const days = Math.min(options.days || maxDays, maxDays);
    const accuracy = options.accuracy ?? game.settings.get(MODULE.ID, SETTINGS.FORECAST_ACCURACY) ?? 70;
    const isGM = game.user.isGM;
    const customPresets = this.getCustomPresets();
    const fullPlan = game.settings.get(MODULE.ID, SETTINGS.WEATHER_FORECAST_PLAN) || {};
    const plan = zoneId ? (fullPlan[zoneId] ?? {}) : {};
    const components = game.time.components;
    const yearZero = calendar.years?.yearZero ?? 0;
    const getDaysInMonth = this.#makeDaysInMonth(calendar, yearZero);
    let year = components.year + yearZero;
    let month = components.month;
    let dayOfMonth = components.dayOfMonth ?? 0;
    const result = [];
    for (let i = 0; i < days; i++) {
      const entry = plan[year]?.[month]?.[dayOfMonth];
      if (!entry) return this.#getForecastLegacy({ ...options, zoneId });
      const preset = {
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        color: entry.color,
        category: entry.category,
        description: entry.description ?? '',
        darknessPenalty: entry.darknessPenalty ?? 0
      };
      let forecastEntry = { year, month, dayOfMonth, preset, temperature: entry.temperature, wind: entry.wind, precipitation: entry.precipitation, isVaried: false };
      if (!isGM && accuracy < 100) {
        const seed = dateSeed(year, month, dayOfMonth);
        const varied = applyForecastVariance({ preset, temperature: entry.temperature }, i + 1, days, accuracy, seededRandom(seed + 1), customPresets);
        forecastEntry = { year, month, dayOfMonth, ...varied, wind: entry.wind, precipitation: entry.precipitation };
      }
      result.push(forecastEntry);
      dayOfMonth++;
      const dim = getDaysInMonth(month, year);
      if (dayOfMonth >= dim) {
        dayOfMonth = 0;
        month++;
        if (month >= (getDaysInMonth._monthsPerYear ?? 12)) {
          month = 0;
          year++;
        }
      }
    }
    return result;
  }

  /**
   * Legacy on-demand forecast generation (fallback when plan is unavailable).
   * @param {object} [options] - Forecast options
   * @returns {object[]} Forecast array
   * @private
   */
  static #getForecastLegacy(options = {}) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return [];
    const zoneId = 'zoneId' in options ? options.zoneId : (this.getActiveZone(null, game.scenes?.active)?.id ?? this.DEFAULT_ZONE);
    const zoneConfig = this.getActiveZone(zoneId);
    const maxDays = game.settings.get(MODULE.ID, SETTINGS.FORECAST_DAYS) ?? 7;
    const days = Math.min(options.days || maxDays, maxDays);
    const customPresets = this.getCustomPresets();
    const components = game.time.components;
    const yearZero = calendar.years?.yearZero ?? 0;
    const currentWeatherId = this.#currentWeatherByZone[zoneId]?.id ?? null;
    const inertia = game.settings.get(MODULE.ID, SETTINGS.WEATHER_INERTIA) ?? 0.3;
    const accuracy = options.accuracy ?? game.settings.get(MODULE.ID, SETTINGS.FORECAST_ACCURACY) ?? 70;
    const currentWeather = this.#currentWeatherByZone[zoneId];
    const prevWeather = currentWeather ? { temperature: currentWeather.temperature, wind: currentWeather.wind } : null;
    return generateForecast({
      zoneConfig,
      startYear: components.year + yearZero,
      startMonth: components.month,
      startDayOfMonth: components.dayOfMonth ?? 0,
      days,
      customPresets,
      currentWeatherId,
      inertia,
      accuracy,
      previousWeather: prevWeather,
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
    const autoGenerate = game.settings.get(MODULE.ID, SETTINGS.AUTO_GENERATE_WEATHER) ?? false;
    const zones = this.#getEffectiveZones();
    for (const zone of zones) {
      const weather = this.#currentWeatherByZone[zone.id];
      if (weather) await this.#recordWeatherHistory(weather, zone.id);
    }
    if (!autoGenerate) return;
    const gap = this.#calcDayGap(data, calendar);
    if (gap > 1) {
      await this.#backfillHistory(data, calendar, gap);
      return;
    }
    await this.#ensureForecastPlan();
    const seasonData = calendar.getCurrentSeason?.(data.current);
    const season = seasonData?.name ?? null;
    const customPresets = this.getCustomPresets();
    const weatherUpdates = {};
    for (const zone of zones) {
      const planEntry = this.#getFromForecastPlan(data.current.year, data.current.month, data.current.dayOfMonth ?? 0, zone.id);
      if (planEntry) {
        weatherUpdates[zone.id] = {
          id: planEntry.id,
          label: planEntry.label,
          description: planEntry.description ?? '',
          icon: planEntry.icon,
          color: planEntry.color,
          category: planEntry.category,
          temperature: planEntry.temperature,
          wind: planEntry.wind ?? { speed: 0, direction: null, forced: false },
          precipitation: planEntry.precipitation ?? { type: null, intensity: 0 },
          darknessPenalty: planEntry.darknessPenalty ?? 0,
          environmentBase: planEntry.environmentBase ?? null,
          environmentDark: planEntry.environmentDark ?? null,
          fxPreset: planEntry.fxPreset ?? null,
          soundFx: planEntry.soundFx ?? null,
          setAt: game.time.worldTime,
          setBy: game.user.id,
          generated: true,
          season
        };
      } else {
        const zoneConfig = this.getActiveZone(zone.id);
        const seasonClimate = seasonData?.climate ?? null;
        const currentWeather = this.#currentWeatherByZone[zone.id];
        let inertia = game.settings.get(MODULE.ID, SETTINGS.WEATHER_INERTIA) ?? 0.3;
        if (currentWeather?.season && season !== currentWeather.season) inertia *= 0.5;
        const prevWeather = currentWeather ? { temperature: currentWeather.temperature, wind: currentWeather.wind } : null;
        const result = generateWeather({ seasonClimate, zoneConfig, season, customPresets, currentWeatherId: currentWeather?.id ?? null, inertia, previousWeather: prevWeather });
        weatherUpdates[zone.id] = {
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
          environmentBase: this.#resolveEnvironmentBase(result.preset),
          environmentDark: this.#resolveEnvironmentDark(result.preset),
          environmentCycle: this.#resolveEnvironmentCycle(result.preset),
          fxPreset: this.#resolveFxPreset(result.preset),
          soundFx: this.#resolveSoundFx(result.preset),
          setAt: game.time.worldTime,
          setBy: game.user.id,
          generated: true,
          season
        };
      }
    }
    for (const [zid, weather] of Object.entries(weatherUpdates)) this.#currentWeatherByZone[zid] = weather;
    await game.settings.set(MODULE.ID, SETTINGS.CURRENT_WEATHER, this.#currentWeatherByZone);
    for (const [zid, weather] of Object.entries(weatherUpdates)) await this.#recordWeatherHistory(weather, zid);
    Hooks.callAll(HOOKS.WEATHER_CHANGE, { bulk: true });
    CalendariaSocket.emit('weatherChange', { weatherByZone: this.#currentWeatherByZone, bulk: true });
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
   * @param {object} data - Hook data with current components
   * @param {object} calendar - Active calendar
   * @param {number} gap - Number of days jumped
   * @private
   */
  static async #backfillHistory(data, calendar, gap) {
    const maxDays = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY_DAYS) ?? 365;
    const zones = this.#getEffectiveZones();
    if (maxDays === 0) {
      for (const zone of zones) await this.generateAndSetWeather({ zoneId: zone.id, _fromPlan: true });
      return;
    }
    const daysToFill = Math.min(gap - 1, maxDays);
    const yearZero = calendar.years?.yearZero ?? 0;
    const currentYear = data.current.year;
    const currentMonth = data.current.month;
    const customPresets = this.getCustomPresets();
    const inertia = game.settings.get(MODULE.ID, SETTINGS.WEATHER_INERTIA) ?? 0.3;
    const secondsPerDay = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
    const currentTime = calendar.componentsToTime({ year: currentYear - yearZero, month: currentMonth, dayOfMonth: data.current.dayOfMonth ?? 0, hour: 0, minute: 0, second: 0 });
    const startTime = currentTime - daysToFill * secondsPerDay;
    const startComponents = calendar.timeToComponents(startTime);
    const startYear = startComponents.year + yearZero;
    const startMonth = startComponents.month;
    const startDayOfMonth = startComponents.dayOfMonth ?? 0;
    const fullPlan = game.settings.get(MODULE.ID, SETTINGS.WEATHER_FORECAST_PLAN) || {};
    const history = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY) || {};
    const seasonData = calendar.getCurrentSeason?.(game.time.components);
    const season = seasonData?.name ?? null;
    for (const zone of zones) {
      const zoneConfig = zone;
      const zonePlan = fullPlan[zone.id] ?? {};
      const forecast = generateForecast({
        zoneConfig,
        startYear,
        startMonth,
        startDayOfMonth,
        days: daysToFill + 1,
        customPresets,
        currentWeatherId: null,
        inertia,
        getSeasonForDate: this.#makeSeasonResolver(calendar, yearZero),
        getDaysInMonth: this.#makeDaysInMonth(calendar, yearZero)
      });
      for (let i = 0; i < forecast.length - 1; i++) {
        const f = forecast[i];
        const planEntry = zonePlan[f.year]?.[f.month]?.[f.dayOfMonth];
        const entry = planEntry ?? {
          id: f.preset.id,
          label: localize(f.preset.label),
          icon: f.preset.icon,
          color: f.preset.color,
          category: f.preset.category,
          temperature: f.temperature,
          wind: f.wind ?? null,
          precipitation: f.precipitation ?? null
        };
        history[f.year] ??= {};
        history[f.year][f.month] ??= {};
        history[f.year][f.month][f.dayOfMonth] ??= {};
        history[f.year][f.month][f.dayOfMonth][zone.id] = {
          id: entry.id,
          label: planEntry ? entry.label : localize(f.preset.label),
          icon: entry.icon,
          color: entry.color,
          category: entry.category,
          temperature: entry.temperature,
          wind: entry.wind ?? null,
          precipitation: entry.precipitation ?? null,
          generated: true,
          zoneId: zone.id
        };
      }
      const todayF = forecast[forecast.length - 1];
      const todayPlan = zonePlan[todayF.year]?.[todayF.month]?.[todayF.dayOfMonth];
      if (todayPlan) {
        this.#currentWeatherByZone[zone.id] = {
          id: todayPlan.id,
          label: todayPlan.label,
          description: todayPlan.description ?? '',
          icon: todayPlan.icon,
          color: todayPlan.color,
          category: todayPlan.category,
          temperature: todayPlan.temperature,
          wind: todayPlan.wind ?? { speed: 0, direction: null, forced: false },
          precipitation: todayPlan.precipitation ?? { type: null, intensity: 0 },
          darknessPenalty: todayPlan.darknessPenalty ?? 0,
          environmentBase: todayPlan.environmentBase ?? null,
          environmentDark: todayPlan.environmentDark ?? null,
          fxPreset: todayPlan.fxPreset ?? null,
          soundFx: todayPlan.soundFx ?? null,
          setAt: game.time.worldTime,
          setBy: game.user.id,
          generated: true,
          season
        };
      } else {
        this.#currentWeatherByZone[zone.id] = {
          id: todayF.preset.id,
          label: todayF.preset.label,
          description: todayF.preset.description,
          icon: todayF.preset.icon,
          color: todayF.preset.color,
          category: todayF.preset.category,
          temperature: todayF.temperature,
          wind: todayF.wind ?? { speed: 0, direction: null, forced: false },
          precipitation: todayF.precipitation ?? { type: null, intensity: 0 },
          darknessPenalty: todayF.preset.darknessPenalty ?? 0,
          environmentBase: this.#resolveEnvironmentBase(todayF.preset),
          environmentDark: this.#resolveEnvironmentDark(todayF.preset),
          environmentCycle: this.#resolveEnvironmentCycle(todayF.preset),
          fxPreset: this.#resolveFxPreset(todayF.preset),
          soundFx: this.#resolveSoundFx(todayF.preset),
          setAt: game.time.worldTime,
          setBy: game.user.id,
          generated: true,
          season
        };
      }
    }
    await game.settings.set(MODULE.ID, SETTINGS.CURRENT_WEATHER, this.#currentWeatherByZone);
    this.#pruneHistory(history, maxDays);
    await game.settings.set(MODULE.ID, SETTINGS.WEATHER_HISTORY, history);
    Hooks.callAll(HOOKS.WEATHER_CHANGE, { bulk: true });
    CalendariaSocket.emit('weatherChange', { weatherByZone: this.#currentWeatherByZone, bulk: true });
    await this.#clearForecastPlan();
    await this.#ensureForecastPlan();
    log(3, `Backfilled ${daysToFill} days of weather history for ${zones.length} zones`);
  }

  /**
   * Record weather for today into history storage.
   * @param {object} weather - Weather state to record
   * @param {string} [zoneId] - Zone ID (resolves from active zone if omitted)
   * @private
   */
  static async #recordWeatherHistory(weather, zoneId) {
    const maxDays = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY_DAYS) ?? 365;
    if (maxDays === 0) return;
    const resolvedZoneId = zoneId ?? this.getActiveZone()?.id ?? this.DEFAULT_ZONE;
    const components = game.time.components;
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const year = components.year + yearZero;
    const month = components.month;
    const dayOfMonth = components.dayOfMonth ?? 0;
    const history = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY) || {};
    history[year] ??= {};
    history[year][month] ??= {};
    history[year][month][dayOfMonth] ??= {};
    history[year][month][dayOfMonth][resolvedZoneId] = {
      id: weather.id,
      label: localize(weather.label),
      icon: weather.icon,
      color: weather.color,
      category: weather.category,
      temperature: weather.temperature,
      wind: weather.wind ?? null,
      precipitation: weather.precipitation ?? null,
      generated: weather.generated ?? false,
      zoneId: resolvedZoneId
    };
    this.#pruneHistory(history, maxDays);
    await game.settings.set(MODULE.ID, SETTINGS.WEATHER_HISTORY, history);
  }

  /**
   * Prune history to stay within max day count, removing oldest day entries first.
   * @param {object} history - Nested history object (mutated)
   * @param {number} maxDays - Maximum day entries to retain
   * @private
   */
  static #pruneHistory(history, maxDays) {
    const entries = [];
    for (const [y, months] of Object.entries(history)) for (const [m, days] of Object.entries(months)) for (const d of Object.keys(days)) entries.push([Number(y), Number(m), Number(d)]);
    const unique = [...new Set(entries.map((e) => `${e[0]}-${e[1]}-${e[2]}`))].map((k) => k.split('-').map(Number));
    if (unique.length <= maxDays) return;
    unique.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    const toRemove = unique.length - maxDays;
    for (let i = 0; i < toRemove; i++) {
      const [y, m, d] = unique[i];
      delete history[y][m][d];
      if (!Object.keys(history[y][m]).length) delete history[y][m];
      if (!Object.keys(history[y]).length) delete history[y];
    }
  }

  /**
   * Migrate weather history and forecast plan day keys from 1-indexed to 0-indexed.
   * @private
   */
  static async #migrateWeatherDayIndex() {
    let changed = false;
    const history = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY) || {};
    if (Object.keys(history).length) {
      const migrated = this.#shiftDayKeys(history);
      await game.settings.set(MODULE.ID, SETTINGS.WEATHER_HISTORY, migrated);
      changed = true;
      log(3, 'Migrated weather history day keys from 1-indexed to 0-indexed');
    }
    const plan = game.settings.get(MODULE.ID, SETTINGS.WEATHER_FORECAST_PLAN) || {};
    if (Object.keys(plan).length) {
      await game.settings.set(MODULE.ID, SETTINGS.WEATHER_FORECAST_PLAN, {});
      changed = true;
      log(3, 'Cleared forecast plan for 0-indexed day migration');
    }
    if (changed) log(3, 'Weather day index migration complete');
    await game.settings.set(MODULE.ID, SETTINGS.WEATHER_DAY_INDEX_MIGRATED, true);
  }

  /**
   * Shift all day-level keys in a nested year→month→day object by -1.
   * @param {object} data - Nested object (year → month → day → value)
   * @returns {object} New object with shifted day keys
   * @private
   */
  static #shiftDayKeys(data) {
    const result = {};
    for (const [year, months] of Object.entries(data)) {
      result[year] = {};
      for (const [month, days] of Object.entries(months)) {
        result[year][month] = {};
        for (const [day, value] of Object.entries(days)) {
          const newDay = Math.max(0, Number(day) - 1);
          result[year][month][newDay] = value;
        }
      }
    }
    return result;
  }

  /**
   * Ensure the forecast plan has enough future entries.
   * @private
   */
  static async #ensureForecastPlan() {
    if (!CalendariaSocket.isPrimaryGM()) return;
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return;
    const zones = this.#getEffectiveZones();
    const forecastDays = game.settings.get(MODULE.ID, SETTINGS.FORECAST_DAYS) ?? 7;
    const components = game.time.components;
    const yearZero = calendar.years?.yearZero ?? 0;
    const todayYear = components.year + yearZero;
    const todayMonth = components.month;
    const todayDayOfMonth = components.dayOfMonth ?? 0;
    const todayKey = todayYear * 10000 + todayMonth * 100 + todayDayOfMonth;
    const plan = game.settings.get(MODULE.ID, SETTINGS.WEATHER_FORECAST_PLAN) || {};
    const getDaysInMonth = this.#makeDaysInMonth(calendar, yearZero);
    const customPresets = this.getCustomPresets();
    const inertia = game.settings.get(MODULE.ID, SETTINGS.WEATHER_INERTIA) ?? 0.3;
    const needed = forecastDays + 1;
    let anyChanged = false;
    for (const zone of zones) {
      const zonePlan = plan[zone.id] ?? {};
      const entries = [];
      for (const [y, months] of Object.entries(zonePlan)) {
        for (const [m, days] of Object.entries(months)) {
          for (const [d, entry] of Object.entries(days)) {
            const key = Number(y) * 10000 + Number(m) * 100 + Number(d);
            entries.push({ key, year: Number(y), month: Number(m), dayOfMonth: Number(d), entry });
          }
        }
      }
      entries.sort((a, b) => a.key - b.key);
      const futureEntries = entries.filter((e) => e.key >= todayKey);
      if (futureEntries.length >= needed) {
        const pastCount = entries.length - futureEntries.length;
        if (pastCount > 0) {
          this.#prunePlanEntries(zonePlan, todayKey);
          plan[zone.id] = zonePlan;
          anyChanged = true;
        }
        continue;
      }
      let startYear, startMonth, startDayOfMonth, chainWeatherId;
      const lastFuture = futureEntries[futureEntries.length - 1];
      if (lastFuture) {
        startYear = lastFuture.year;
        startMonth = lastFuture.month;
        startDayOfMonth = lastFuture.dayOfMonth + 1;
        chainWeatherId = lastFuture.entry.id;
        const dim = getDaysInMonth(startMonth, startYear);
        if (startDayOfMonth >= dim) {
          startDayOfMonth = 0;
          startMonth++;
          if (startMonth >= (getDaysInMonth._monthsPerYear ?? 12)) {
            startMonth = 0;
            startYear++;
          }
        }
      } else {
        startYear = todayYear;
        startMonth = todayMonth;
        startDayOfMonth = todayDayOfMonth;
        chainWeatherId = this.#currentWeatherByZone[zone.id]?.id ?? null;
      }
      const toGenerate = needed - futureEntries.length;
      const chainWeather = lastFuture?.entry ?? this.#currentWeatherByZone[zone.id];
      const chainPrevWeather = chainWeather ? { temperature: chainWeather.temperature, wind: chainWeather.wind } : null;
      const forecast = generateForecast({
        zoneConfig: zone,
        startYear,
        startMonth,
        startDayOfMonth,
        days: toGenerate,
        customPresets,
        currentWeatherId: chainWeatherId,
        inertia,
        accuracy: 100,
        previousWeather: chainPrevWeather,
        getSeasonForDate: this.#makeSeasonResolver(calendar, yearZero),
        getDaysInMonth
      });
      for (const f of forecast) {
        zonePlan[f.year] ??= {};
        zonePlan[f.year][f.month] ??= {};
        zonePlan[f.year][f.month][f.dayOfMonth] = {
          id: f.preset.id,
          label: f.preset.label,
          icon: f.preset.icon,
          color: f.preset.color,
          category: f.preset.category,
          description: f.preset.description ?? '',
          temperature: f.temperature,
          wind: f.wind ?? null,
          precipitation: f.precipitation ?? null,
          darknessPenalty: f.preset.darknessPenalty ?? 0,
          environmentBase: this.#resolveEnvironmentBase(f.preset),
          environmentDark: this.#resolveEnvironmentDark(f.preset),
          environmentCycle: this.#resolveEnvironmentCycle(f.preset),
          fxPreset: this.#resolveFxPreset(f.preset),
          soundFx: this.#resolveSoundFx(f.preset)
        };
      }
      this.#prunePlanEntries(zonePlan, todayKey);
      plan[zone.id] = zonePlan;
      anyChanged = true;
      log(3, `Forecast plan updated for zone ${zone.id}: ${toGenerate} entries generated`);
    }
    if (anyChanged) await game.settings.set(MODULE.ID, SETTINGS.WEATHER_FORECAST_PLAN, plan);
  }

  /**
   * Look up a forecast plan entry for a specific date and zone.
   * @param {number} year - Display year
   * @param {number} month - Month (0-indexed)
   * @param {number} dayOfMonth - Day of month (0-indexed)
   * @param {string} [zoneId] - Zone ID
   * @returns {object|null} Plan entry or null
   * @private
   */
  static #getFromForecastPlan(year, month, dayOfMonth, zoneId) {
    const plan = game.settings.get(MODULE.ID, SETTINGS.WEATHER_FORECAST_PLAN) || {};
    const resolvedZoneId = zoneId ?? this.getActiveZone(null, game.scenes?.active)?.id;
    return plan[resolvedZoneId]?.[year]?.[month]?.[dayOfMonth] ?? null;
  }

  /**
   * Clear the stored forecast plan, optionally scoped to a single zone.
   * @param {string} [zoneId] - Zone ID to clear; clears all zones if omitted
   * @private
   */
  static async #clearForecastPlan(zoneId) {
    if (zoneId) {
      const plan = game.settings.get(MODULE.ID, SETTINGS.WEATHER_FORECAST_PLAN) || {};
      delete plan[zoneId];
      await game.settings.set(MODULE.ID, SETTINGS.WEATHER_FORECAST_PLAN, plan);
      log(3, `Forecast plan cleared for zone ${zoneId}`);
    } else {
      await game.settings.set(MODULE.ID, SETTINGS.WEATHER_FORECAST_PLAN, {});
      log(3, 'Forecast plan cleared for all zones');
    }
  }

  /**
   * Remove plan entries before today.
   * @param {object} plan - Nested year→month→day plan object (mutated)
   * @param {number} todayKey - Comparable key for today (year*10000 + month*100 + day)
   * @private
   */
  static #prunePlanEntries(plan, todayKey) {
    for (const [year, months] of Object.entries(plan)) {
      for (const [month, days] of Object.entries(months)) {
        for (const day of Object.keys(days)) {
          const key = Number(year) * 10000 + Number(month) * 100 + Number(day);
          if (key < todayKey) delete days[day];
        }
        if (!Object.keys(days).length) delete months[month];
      }
      if (!Object.keys(months).length) delete plan[year];
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
    return (year, month, dayOfMonth) => {
      const season = calendar.getCurrentSeason?.({ year: year - yearZero, month, dayOfMonth });
      if (!season) return null;
      return { name: season.name, climate: season.climate };
    };
  }

  /**
   * Get historical weather for a specific date.
   * @param {number} year - Display year
   * @param {number} month - Month (0-indexed)
   * @param {number} dayOfMonth - Day of month (0-indexed)
   * @param {string} [zoneId] - Zone ID filter (resolves from active scene if omitted)
   * @returns {object|null} Historical weather entry or null
   */
  static getWeatherForDate(year, month, dayOfMonth, zoneId) {
    const history = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY) || {};
    const dayData = history[year]?.[month]?.[dayOfMonth];
    if (!dayData) return null;
    if (dayData.id !== undefined) return !zoneId || dayData.zoneId === zoneId ? dayData : null;
    const resolvedZoneId = zoneId ?? this.getActiveZone(null, game.scenes?.active)?.id ?? this.DEFAULT_ZONE;
    if (dayData[resolvedZoneId]) return dayData[resolvedZoneId];
    const firstKey = Object.keys(dayData)[0];
    return firstKey ? dayData[firstKey] : null;
  }

  /**
   * Get weather history as the raw nested object, or a flat array for a specific year/month.
   * @param {object} [options] - Filter options
   * @param {number} [options.year] - Filter to a specific year
   * @param {number} [options.month] - Filter to a specific month (requires year)
   * @param {string} [options.zoneId] - Zone ID filter (resolves from active scene if omitted)
   * @returns {object|object[]} Nested history object, or array of { year, month, dayOfMonth, ...entry }
   */
  static getWeatherHistory(options = {}) {
    const history = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY) || {};
    if (options.year == null) return history;
    const yearData = history[options.year];
    if (!yearData) return [];
    const resolvedZoneId = 'zoneId' in options ? options.zoneId : (this.getActiveZone(null, game.scenes?.active)?.id ?? this.DEFAULT_ZONE);
    const results = [];
    const months = options.month != null ? { [options.month]: yearData[options.month] } : yearData;
    for (const [m, days] of Object.entries(months)) {
      if (!days) continue;
      for (const [d, dayData] of Object.entries(days)) {
        if (dayData.id !== undefined) {
          if (!resolvedZoneId || dayData.zoneId === resolvedZoneId) results.push({ year: options.year, month: Number(m), dayOfMonth: Number(d), ...dayData });
        } else {
          const entry = dayData[resolvedZoneId] ?? dayData[Object.keys(dayData)[0]];
          if (entry) results.push({ year: options.year, month: Number(m), dayOfMonth: Number(d), ...entry });
        }
      }
    }
    return results.sort((a, b) => a.month - b.month || a.dayOfMonth - b.dayOfMonth);
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
   * @param {string} presetId - Weather preset ID
   * @returns {number|null} Generated temperature or null if no config
   * @private
   */
  static #generateTemperatureForPreset(presetId) {
    const zoneConfig = this.getActiveZone();
    const seasonData = this.#getCurrentSeason();
    const season = seasonData?.name ?? null;
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
    const sceneOverride = scene?.getFlag?.(MODULE.ID, SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE) || null;
    if (sceneOverride === 'none' && zoneId == null) return null;
    const targetId = zoneId ?? sceneOverride ?? calendar.weather.activeZone;
    if (!targetId) return null;
    return zones.find((z) => z.id === targetId) ?? zones[0] ?? null;
  }

  /**
   * Check if a scene has explicitly opted out of climate zones.
   * @param {object} [scene] - Scene to check (defaults to active scene)
   * @returns {boolean} True if the scene has "No Zone" set
   */
  static isZoneDisabled(scene) {
    return (scene ?? game.scenes?.active)?.getFlag?.(MODULE.ID, SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE) === 'none';
  }

  /**
   * Set a scene-level climate zone override via scene flag.
   * @param {object} scene - Scene document to set the flag on
   * @param {string|null} zoneId - Zone ID to set, or null to clear the override
   * @returns {Promise<void>}
   */
  static async setSceneZoneOverride(scene, zoneId) {
    if (!scene) return;
    if (zoneId === null) await scene.setFlag(MODULE.ID, SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE, 'none');
    else if (zoneId) await scene.setFlag(MODULE.ID, SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE, zoneId);
    else await scene.unsetFlag(MODULE.ID, SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE);
    log(3, `Scene zone override ${zoneId !== null ? `set to ${zoneId || 'default'}` : 'set to none'} for scene ${scene.name}`);
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
    if (zoneId) {
      const zones = calendarData.weather.zones ? Object.values(calendarData.weather.zones) : [];
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return;
    }
    calendarData.weather.activeZone = zoneId ?? null;
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
   * Get effective zones for weather operations, always returning at least a default entry.
   * @returns {object[]} Array of zone-like objects with at least an `id` property
   * @private
   */
  static #getEffectiveZones() {
    const zones = this.getCalendarZones();
    if (zones.length) return zones;
    return [{ id: this.DEFAULT_ZONE }];
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
    const newPreset = {
      id: preset.id,
      label: preset.label,
      description: preset.description || '',
      icon: preset.icon || 'fa-question',
      color: preset.color || '#888888',
      category: 'custom',
      ...(preset.wind && { wind: preset.wind }),
      ...(preset.precipitation && { precipitation: preset.precipitation }),
      ...(preset.tempMin != null && { tempMin: preset.tempMin }),
      ...(preset.tempMax != null && { tempMax: preset.tempMax }),
      ...(preset.hudEffect && { hudEffect: preset.hudEffect }),
      ...(preset.fxPreset && { fxPreset: preset.fxPreset }),
      ...(preset.soundFx && { soundFx: preset.soundFx }),
      ...(preset.inertiaWeight != null && { inertiaWeight: preset.inertiaWeight }),
      ...(preset.chance != null && { chance: preset.chance }),
      ...(preset.darknessPenalty != null && { darknessPenalty: preset.darknessPenalty })
    };
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
    const unit = game.settings.get(MODULE.ID, SETTINGS.WIND_SPEED_UNIT);
    if (unit === 'mph') return `${Math.round(kph * 0.621371)} mph`;
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
    const esc = (s) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = [];
    const desc = description && description !== label ? esc(description) : '';
    rows.push(`<div class="header"><strong>${esc(label)}</strong>${desc ? ` — ${desc}` : ''}</div>`);
    if (temp) rows.push(`<div class="row"><i class="fas fa-temperature-half"></i> ${esc(temp)}</div>`);
    if (windSpeed > 0) {
      const windLabel = this.getWindSpeedLabel(windSpeed);
      const windKph = this.getWindSpeedKph(windSpeed);
      const windFormatted = this.formatWindSpeed(windKph);
      const dirLabel = this.getWindDirectionLabel(windDirection);
      rows.push(`<div class="row"><i class="fas fa-wind"></i> ${esc(windLabel)}${dirLabel ? ` ${esc(dirLabel)}` : ''} · ${esc(windFormatted)}</div>`);
    }
    if (precipType) {
      const precipLabel = localize(`CALENDARIA.Weather.Precipitation.${precipType.charAt(0).toUpperCase() + precipType.slice(1)}`);
      const rate = this.formatPrecipitation((precipIntensity ?? 0) * 10);
      rows.push(`<div class="row"><i class="fas fa-droplet"></i> ${esc(precipLabel)}${rate ? ` · ${esc(rate)}` : ''}</div>`);
    }
    const html = `<div class="calendaria"><div class="weather-tooltip">${rows.join('')}</div></div>`;
    return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
