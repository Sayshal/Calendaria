/**
 * Weather Picker Application
 * Allows GMs to select or randomly generate weather.
 * @module Weather/WeatherPicker
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { COMPASS_DIRECTIONS, PRECIPITATION_TYPES, TEMPLATES, WIND_SPEEDS } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { fromDisplayUnit, getTemperatureUnit, toDisplayUnit } from './climate-data.mjs';
import WeatherManager from './weather-manager.mjs';
import { WEATHER_CATEGORIES, getPreset, getPresetAlias, getPresetsByCategory } from './weather-presets.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Localization keys for the 16-point compass rose. */
const COMPASS_LABEL_KEYS = {
  N: 'CALENDARIA.Weather.Wind.Dir.N',
  NNE: 'CALENDARIA.Weather.Wind.Dir.NNE',
  NE: 'CALENDARIA.Weather.Wind.Dir.NE',
  ENE: 'CALENDARIA.Weather.Wind.Dir.ENE',
  E: 'CALENDARIA.Weather.Wind.Dir.E',
  ESE: 'CALENDARIA.Weather.Wind.Dir.ESE',
  SE: 'CALENDARIA.Weather.Wind.Dir.SE',
  SSE: 'CALENDARIA.Weather.Wind.Dir.SSE',
  S: 'CALENDARIA.Weather.Wind.Dir.S',
  SSW: 'CALENDARIA.Weather.Wind.Dir.SSW',
  SW: 'CALENDARIA.Weather.Wind.Dir.SW',
  WSW: 'CALENDARIA.Weather.Wind.Dir.WSW',
  W: 'CALENDARIA.Weather.Wind.Dir.W',
  WNW: 'CALENDARIA.Weather.Wind.Dir.WNW',
  NW: 'CALENDARIA.Weather.Wind.Dir.NW',
  NNW: 'CALENDARIA.Weather.Wind.Dir.NNW'
};

/**
 * Map a 0-1 intensity to a descriptive label.
 * @param {number} value - Intensity value (0-1)
 * @returns {string} Localized intensity label
 */
function getPrecipIntensityLabel(value) {
  if (value <= 0) return localize('CALENDARIA.Common.None');
  if (value <= 0.25) return localize('CALENDARIA.Weather.Precipitation.IntensityLight');
  if (value <= 0.5) return localize('CALENDARIA.Weather.Precipitation.IntensityModerate');
  if (value <= 0.75) return localize('CALENDARIA.Weather.Precipitation.IntensityHeavy');
  return localize('CALENDARIA.Weather.Precipitation.IntensityTorrential');
}

/**
 * Weather picker application with selectable presets.
 */
class WeatherPickerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {string|null|undefined} Zone override from dropdown (undefined = use calendar default) */
  #zoneOverride = undefined;

  /** @type {string|null} Selected preset ID (null = none selected) */
  #selectedPresetId = null;

  /** @type {boolean} Whether user has edited custom fields */
  #customEdited = false;

  /** @type {string|null} Custom weather label input */
  #customLabel = null;

  /** @type {string|null} Custom weather temperature input */
  #customTemp = null;

  /** @type {string|null} Custom weather icon input */
  #customIcon = null;

  /** @type {string|null} Custom weather color input */
  #customColor = null;

  /** @type {number|string|null} Wind speed (0-5 scale or 'random') */
  #windSpeed = null;

  /** @type {number|null} Wind direction (degrees) */
  #windDirection = null;

  /** @type {string|null} Precipitation type (or 'random') */
  #precipType = null;

  /** @type {number|null} Precipitation intensity (0-1) */
  #precipIntensity = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'weather-picker',
    classes: ['calendaria', 'weather-picker-app', 'standard-form'],
    tag: 'form',
    window: { title: 'CALENDARIA.Weather.Picker.Title', icon: 'fas fa-cloud-sun', resizable: false },
    position: { width: 550, height: 'auto' },
    form: { handler: WeatherPickerApp._onSave, submitOnChange: false, closeOnSubmit: false },
    actions: {
      selectWeather: WeatherPickerApp._onSelectWeather,
      randomWeather: WeatherPickerApp._onRandomWeather,
      clearWeather: WeatherPickerApp._onClearWeather
    }
  };

  /** @override */
  static PARTS = {
    content: { template: TEMPLATES.WEATHER.PICKER },
    footer: { template: TEMPLATES.WEATHER.PICKER_FOOTER }
  };

  /** @override */
  async close(options) {
    this.#zoneOverride = undefined;
    this.#selectedPresetId = null;
    this.#customEdited = false;
    this.#customLabel = null;
    this.#customTemp = null;
    this.#customIcon = null;
    this.#customColor = null;
    this.#windSpeed = null;
    this.#windDirection = null;
    this.#precipType = null;
    this.#precipIntensity = null;
    return super.close(options);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const customPresets = WeatherManager.getCustomPresets();
    const zones = WeatherManager.getCalendarZones() || [];
    const calendar = CalendarManager.getActiveCalendar();
    const calendarActiveZone = calendar?.weather?.activeZone ?? null;
    const sceneZone = WeatherManager.getActiveZone(null, game.scenes?.active);
    const defaultZoneId = sceneZone?.id ?? calendarActiveZone;
    const selectedZoneId = this.#zoneOverride !== undefined ? this.#zoneOverride : defaultZoneId;
    const selectedZone = selectedZoneId ? zones.find((z) => z.id === selectedZoneId) : null;
    context.setAsActiveZone = selectedZoneId === calendarActiveZone && calendarActiveZone != null;
    context.zoneOptions = [{ value: '', label: localize('CALENDARIA.Common.None'), selected: !selectedZoneId }];
    for (const z of zones) context.zoneOptions.push({ value: z.id, label: localize(z.name), selected: z.id === selectedZoneId });
    context.zoneOptions.sort((a, b) => {
      if (a.value === '') return -1;
      if (b.value === '') return 1;
      return a.label.localeCompare(b.label, game.i18n.lang);
    });
    const enabledPresetIds = new Set();
    if (selectedZone?.presets) for (const p of Object.values(selectedZone.presets)) if (p.enabled !== false) enabledPresetIds.add(p.id);
    const shouldFilter = selectedZone && enabledPresetIds.size > 0;
    context.categories = [];
    context.selectedPresetId = this.#selectedPresetId;
    const calendarId = CalendarManager.getActiveCalendar()?.metadata?.id;
    const categoryIds = ['standard', 'severe', 'environmental', 'fantasy'];
    for (const categoryId of categoryIds) {
      const category = WEATHER_CATEGORIES[categoryId];
      let presets = getPresetsByCategory(categoryId, customPresets);
      if (shouldFilter) presets = presets.filter((p) => enabledPresetIds.has(p.id));
      if (presets.length === 0) continue;
      const mappedPresets = presets
        .map((p) => {
          const alias = getPresetAlias(p.id, calendarId, selectedZoneId);
          const label = alias || localize(p.label);
          return { id: p.id, label, description: p.description ? localize(p.description) : label, icon: p.icon, color: p.color, selected: p.id === this.#selectedPresetId };
        })
        .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
      context.categories.push({ id: categoryId, label: localize(category.label), presets: mappedPresets });
    }

    if (customPresets.length > 0) {
      let filtered = customPresets;
      if (shouldFilter) filtered = customPresets.filter((p) => enabledPresetIds.has(p.id));
      if (filtered.length > 0) {
        const mappedCustom = filtered
          .map((p) => {
            const alias = getPresetAlias(p.id, calendarId, selectedZoneId);
            const label = alias || (p.label.startsWith('CALENDARIA.') ? localize(p.label) : p.label);
            const description = p.description ? (p.description.startsWith('CALENDARIA.') ? localize(p.description) : p.description) : label;
            return { id: p.id, label, description, icon: p.icon, color: p.color, selected: p.id === this.#selectedPresetId };
          })
          .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
        context.categories.push({ id: 'custom', label: localize(WEATHER_CATEGORIES.custom.label), presets: mappedCustom });
      }
    }

    context.temperatureUnit = getTemperatureUnit() === 'fahrenheit' ? '°F' : '°C';
    const currentWeather = WeatherManager.getCurrentWeather(selectedZoneId);
    const currentTemp = WeatherManager.getTemperature(selectedZoneId);
    context.selectedZoneId = selectedZoneId;
    const currentWeatherAlias = currentWeather?.id ? getPresetAlias(currentWeather.id, calendarId, selectedZoneId) : null;
    context.customLabel = this.#customLabel ?? (currentWeatherAlias || (currentWeather?.label ? localize(currentWeather.label) : ''));
    context.customTemp = this.#customTemp ?? (currentTemp != null ? toDisplayUnit(currentTemp) : '');
    context.customIcon = this.#customIcon ?? (currentWeather?.icon || 'fa-question');
    context.customColor = this.#customColor ?? (currentWeather?.color || '#888888');

    // Wind/precipitation
    const activeWindSpeed = this.#windSpeed ?? currentWeather?.wind?.speed ?? 0;
    context.windSpeedRandom = this.#windSpeed === 'random';
    context.windSpeedOptions = Object.values(WIND_SPEEDS).map((w) => ({
      value: w.value,
      label: localize(w.label),
      kph: w.kph,
      selected: !context.windSpeedRandom && activeWindSpeed === w.value
    }));
    context.compassDirections = Object.entries(COMPASS_DIRECTIONS).map(([id, deg]) => ({
      id,
      degrees: deg,
      label: COMPASS_LABEL_KEYS[id] ? localize(COMPASS_LABEL_KEYS[id]) : id,
      selected: (this.#windDirection ?? currentWeather?.wind?.direction) === deg
    }));
    const activePrecipType = this.#precipType ?? currentWeather?.precipitation?.type ?? null;
    context.precipTypeRandom = this.#precipType === 'random';
    context.precipitationTypes = [
      { value: '', label: localize('CALENDARIA.Common.None'), selected: !context.precipTypeRandom && !activePrecipType },
      ...Object.entries(PRECIPITATION_TYPES)
        .filter(([, v]) => v !== null)
        .map(([, v]) => ({
          value: v,
          label: localize(`CALENDARIA.Weather.Precipitation.${v.charAt(0).toUpperCase() + v.slice(1)}`),
          selected: !context.precipTypeRandom && activePrecipType === v
        }))
    ];
    context.precipIntensity = this.#precipIntensity ?? currentWeather?.precipitation?.intensity ?? 0;
    context.precipIntensityLabel = getPrecipIntensityLabel(context.precipIntensity);

    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const zoneSelect = this.element.querySelector('select[name="climateZone"]');
    if (zoneSelect) {
      zoneSelect.addEventListener('change', (e) => {
        this.#zoneOverride = e.target.value || null;
        this.render();
      });
    }
    for (const input of this.element.querySelectorAll('.weather-picker-custom input')) {
      input.addEventListener('input', () => {
        this.#customEdited = true;
        this.#selectedPresetId = null;
        for (const btn of this.element.querySelectorAll('.weather-btn.active')) btn.classList.remove('active');
      });
    }

    // Precipitation intensity slider live label
    const precipSlider = this.element.querySelector('[name="precipIntensity"]');
    if (precipSlider) {
      const label = precipSlider.nextElementSibling;
      precipSlider.addEventListener('input', () => {
        if (label) label.textContent = getPrecipIntensityLabel(parseFloat(precipSlider.value));
      });
    }
  }

  /**
   * Handle save button. Applies selected preset or custom weather.
   * @param {Event} _event - The submit event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - The form data
   */
  static async _onSave(_event, _form, formData) {
    const fd = formData.object;
    const compassValues = Object.values(COMPASS_DIRECTIONS);
    const windSpeed = fd.windSpeed === 'random' ? Math.floor(Math.random() * 6) : parseInt(fd.windSpeed ?? 0);
    const windDirCompass = fd.windDirectionCompass;
    const windDir = windDirCompass !== '' && windDirCompass != null ? parseFloat(windDirCompass) : compassValues[Math.floor(Math.random() * compassValues.length)];
    const precipTypes = Object.values(PRECIPITATION_TYPES).filter((v) => v !== null);
    const precipType = fd.precipType === 'random' ? precipTypes[Math.floor(Math.random() * precipTypes.length)] : fd.precipType || null;
    const precipIntensity = fd.precipType === 'random' ? Math.round(Math.random() * 20) / 20 : parseFloat(fd.precipIntensity ?? 0);
    const windData = { speed: windSpeed, direction: windDir, forced: false };
    const precipData = { type: precipType, intensity: precipType ? precipIntensity : 0 };

    const zoneId = formData.object.climateZone || null;
    if (this.#selectedPresetId && !this.#customEdited) {
      await WeatherManager.setWeather(this.#selectedPresetId, { wind: windData, precipitation: precipData, zoneId });
    } else {
      const data = foundry.utils.expandObject(fd);
      const label = data.customLabel?.trim();
      if (!label) return;
      const temp = data.customTemp;
      const icon = data.customIcon?.trim() || 'fa-question';
      const color = data.customColor || '#888888';
      const temperature = temp ? fromDisplayUnit(parseInt(temp, 10)) : null;
      await WeatherManager.setCustomWeather({ label, temperature, icon, color, wind: windData, precipitation: precipData, zoneId });
    }
    const setActive = formData.object.setAsActiveZone;
    if (setActive && zoneId) await WeatherManager.setActiveZone(zoneId);
    await this.close();
  }

  /**
   * Select a weather preset — populates custom fields for preview/editing.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onSelectWeather(_event, target) {
    const presetId = target.dataset.presetId;
    const preset = getPreset(presetId, WeatherManager.getCustomPresets());
    if (!preset) return;
    this.#selectedPresetId = presetId;
    this.#customEdited = false;
    const calendar = CalendarManager.getActiveCalendar();
    const calendarId = calendar?.metadata?.id;
    const sceneZone = WeatherManager.getActiveZone(null, game.scenes?.active);
    const zoneId = this.#zoneOverride !== undefined ? this.#zoneOverride : (sceneZone?.id ?? calendar?.weather?.activeZone ?? null);
    const alias = getPresetAlias(presetId, calendarId, zoneId);
    this.#customLabel = alias || localize(preset.label);
    this.#customTemp = null;
    this.#customIcon = preset.icon || 'fa-question';
    this.#customColor = preset.color || '#888888';
    this.#windSpeed = preset.wind?.speed ?? 0;
    this.#windDirection = preset.wind?.direction ?? null;
    this.#precipType = preset.precipitation?.type ?? null;
    this.#precipIntensity = preset.precipitation?.intensity ?? 0;
    this.render();
  }

  /**
   * Generate random weather.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onRandomWeather(_event, _target) {
    const sceneZone = WeatherManager.getActiveZone(null, game.scenes?.active);
    const zoneId = this.#zoneOverride !== undefined ? this.#zoneOverride : (sceneZone?.id ?? CalendarManager.getActiveCalendar()?.weather?.activeZone ?? null);
    const weather = await WeatherManager.generateAndSetWeather({ zoneId });
    this.#selectedPresetId = weather?.id ?? null;
    this.#customEdited = false;
    this.#customLabel = null;
    this.#customTemp = null;
    this.#customIcon = null;
    this.#customColor = null;
    this.#windSpeed = weather?.wind?.speed ?? null;
    this.#windDirection = weather?.wind?.direction ?? null;
    this.#precipType = weather?.precipitation?.type ?? null;
    this.#precipIntensity = weather?.precipitation?.intensity ?? null;
    this.render();
  }

  /**
   * Clear current weather and reset custom fields.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onClearWeather(_event, _target) {
    await WeatherManager.clearWeather();
    this.#selectedPresetId = null;
    this.#customEdited = false;
    this.#customLabel = '';
    this.#customTemp = '';
    this.#customIcon = '';
    this.#customColor = '#888888';
    this.#windSpeed = 0;
    this.#windDirection = null;
    this.#precipType = null;
    this.#precipIntensity = 0;
    this.render();
  }
}

/**
 * Open the weather picker application.
 * @returns {Promise<void>}
 */
export async function openWeatherPicker() {
  const existing = foundry.applications.instances.get('weather-picker');
  if (existing) {
    existing.render(true, { focus: true });
    return;
  }
  new WeatherPickerApp().render(true);
}
