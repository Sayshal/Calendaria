/**
 * Weather Picker Application
 * @module Weather/WeatherPicker
 * @author Tyler
 */

import CalendarManager from '../../calendar/calendar-manager.mjs';
import { COMPASS_DIRECTIONS, PRECIPITATION_TYPES, TEMPLATES, WIND_SPEEDS } from '../../constants.mjs';
import { getAvailableFxPresets, isFXMasterActive } from '../../integrations/fxmaster.mjs';
import { localize } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';
import { fromDisplayUnit, getTemperatureUnit, toDisplayUnit } from '../../weather/data/climate-data.mjs';
import { SOUND_FX_OPTIONS, WEATHER_CATEGORIES, getPreset, getPresetAlias, getPresetsByCategory } from '../../weather/data/weather-presets.mjs';
import WeatherManager from '../../weather/weather-manager.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
export default class WeatherPickerApp extends HandlebarsApplicationMixin(ApplicationV2) {
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

  /** @type {string|null} FXMaster preset override */
  #fxPreset = null;

  /** @type {string|null} Sound effect override */
  #soundFx = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'weather-picker',
    classes: ['calendaria', 'weather-picker', 'standard-form'],
    tag: 'form',
    window: { title: 'CALENDARIA.Weather.Picker.Title', icon: 'fas fa-cloud-sun', resizable: false },
    position: { width: 'auto', height: 'auto' },
    form: { handler: WeatherPickerApp._onSave, submitOnChange: false, closeOnSubmit: false },
    actions: {
      selectWeather: WeatherPickerApp._onSelectWeather,
      randomWeather: WeatherPickerApp._onRandomWeather,
      clearWeather: WeatherPickerApp._onClearWeather
    }
  };

  /** @override */
  static PARTS = { content: { template: TEMPLATES.WEATHER.PICKER }, footer: { template: TEMPLATES.WEATHER.PICKER_FOOTER } };

  /** @override */
  async close(options) {
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
    this.#fxPreset = null;
    this.#soundFx = null;
    return super.close(options);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const customPresets = WeatherManager.getCustomPresets();
    const zones = WeatherManager.getCalendarZones() || [];
    const scene = game.scenes?.active;
    const sceneZone = WeatherManager.getActiveZone(null, scene);
    const selectedZoneId = sceneZone?.id ?? null;
    context.sceneZoneName = sceneZone ? localize(sceneZone.name) : localize('CALENDARIA.Weather.Picker.NoZone');
    context.zoneOptions = [];
    for (const z of zones) context.zoneOptions.push({ value: z.id, label: localize(z.name), selected: z.id === selectedZoneId });
    context.zoneOptions.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    const enabledPresetIds = new Set();
    if (sceneZone?.presets) for (const p of Object.values(sceneZone.presets)) if (p.enabled !== false) enabledPresetIds.add(p.id);
    const hasZoneFilter = sceneZone && enabledPresetIds.size > 0;
    context.categories = [];
    context.selectedPresetId = this.#selectedPresetId;
    const calendarId = CalendarManager.getActiveCalendar()?.metadata?.id;
    const notActiveLabel = localize('CALENDARIA.Weather.Picker.NotActiveInZone');
    const categoryIds = ['standard', 'severe', 'environmental', 'fantasy'];
    for (const categoryId of categoryIds) {
      const category = WEATHER_CATEGORIES[categoryId];
      const presets = getPresetsByCategory(categoryId, customPresets);
      if (presets.length === 0) continue;
      const mappedPresets = presets
        .map((p) => {
          const alias = getPresetAlias(p.id, calendarId, selectedZoneId);
          const label = alias || localize(p.label);
          const description = p.description ? localize(p.description) : label;
          const zoneEnabled = !hasZoneFilter || enabledPresetIds.has(p.id);
          const tooltip = zoneEnabled ? description : `${description} ${notActiveLabel}`;
          return { id: p.id, label, tooltip, icon: p.icon, color: p.color, selected: p.id === this.#selectedPresetId, zoneEnabled };
        })
        .sort((a, b) => {
          if (a.zoneEnabled !== b.zoneEnabled) return a.zoneEnabled ? -1 : 1;
          return a.label.localeCompare(b.label, game.i18n.lang);
        });
      context.categories.push({ id: categoryId, label: localize(category.label), presets: mappedPresets });
    }
    if (customPresets.length > 0) {
      const mappedCustom = customPresets
        .map((p) => {
          const alias = getPresetAlias(p.id, calendarId, selectedZoneId);
          const label = alias || (p.label.startsWith('CALENDARIA.') ? localize(p.label) : p.label);
          const description = p.description ? (p.description.startsWith('CALENDARIA.') ? localize(p.description) : p.description) : label;
          const zoneEnabled = !hasZoneFilter || enabledPresetIds.has(p.id);
          const tooltip = zoneEnabled ? description : `${description} ${notActiveLabel}`;
          return { id: p.id, label, tooltip, icon: p.icon, color: p.color, selected: p.id === this.#selectedPresetId, zoneEnabled };
        })
        .sort((a, b) => {
          if (a.zoneEnabled !== b.zoneEnabled) return a.zoneEnabled ? -1 : 1;
          return a.label.localeCompare(b.label, game.i18n.lang);
        });
      if (mappedCustom.length > 0) {
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
    const activeWindSpeed = this.#windSpeed ?? currentWeather?.wind?.speed ?? 0;
    context.windSpeedRandom = this.#windSpeed === 'random';
    context.windSpeedOptions = Object.values(WIND_SPEEDS).map((w) => ({ value: w.value, label: localize(w.label), kph: w.kph, selected: !context.windSpeedRandom && activeWindSpeed === w.value }));
    context.compassDirections = Object.entries(COMPASS_DIRECTIONS).map(([id, deg]) => ({
      id,
      degrees: deg,
      label: localize(`CALENDARIA.Weather.Wind.Dir.${id}`),
      selected: (this.#windDirection ?? currentWeather?.wind?.direction) === deg
    }));
    const activePrecipType = this.#precipType ?? currentWeather?.precipitation?.type ?? null;
    context.precipTypeRandom = this.#precipType === 'random';
    context.precipitationTypes = [
      { value: '', label: localize('CALENDARIA.Common.None'), selected: !context.precipTypeRandom && !activePrecipType },
      ...Object.entries(PRECIPITATION_TYPES)
        .filter(([, v]) => v !== null)
        .map(([, v]) => ({ value: v, label: localize(`CALENDARIA.Weather.Precipitation.${v.charAt(0).toUpperCase() + v.slice(1)}`), selected: !context.precipTypeRandom && activePrecipType === v }))
    ];
    context.precipIntensity = this.#precipIntensity ?? currentWeather?.precipitation?.intensity ?? 0;
    context.precipIntensityLabel = getPrecipIntensityLabel(context.precipIntensity);
    context.hasFXMaster = isFXMasterActive();
    if (context.hasFXMaster) {
      const currentFxPreset = this.#fxPreset !== null ? this.#fxPreset : (currentWeather?.fxPreset ?? '');
      context.fxPreset = currentFxPreset;
      const fxPresets = getAvailableFxPresets();
      context.fxPresetOptions = [
        { value: '', label: localize('CALENDARIA.Common.None'), selected: !currentFxPreset },
        ...fxPresets.map((p) => ({ value: p.value, label: p.label, selected: p.value === currentFxPreset }))
      ];
    }
    const currentSoundFx = this.#soundFx !== null ? this.#soundFx : (currentWeather?.soundFx ?? '');
    context.soundFx = currentSoundFx;
    const sfxEntries = SOUND_FX_OPTIONS.map((key) => ({ value: key, label: localize(`CALENDARIA.SoundFx.${key}`), selected: key === currentSoundFx })).sort((a, b) =>
      a.label.localeCompare(b.label, game.i18n.lang)
    );
    context.soundFxOptions = [{ value: '', label: localize('CALENDARIA.Common.None'), selected: !currentSoundFx }, ...sfxEntries];
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const zoneSelect = this.element.querySelector('select[name="sceneZone"]');
    if (zoneSelect) {
      zoneSelect.addEventListener('change', async (e) => {
        const zoneId = e.target.value || null;
        await WeatherManager.setSceneZoneOverride(game.scenes?.active, zoneId);
        this.render();
      });
    }
    for (const input of this.element.querySelectorAll('.details input')) {
      input.addEventListener('input', () => {
        this.#customEdited = true;
        this.#selectedPresetId = null;
        for (const btn of this.element.querySelectorAll('.weather-btn.active')) btn.classList.remove('active');
      });
    }
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
    const sceneZone = WeatherManager.getActiveZone(null, game.scenes?.active);
    const zoneId = sceneZone?.id ?? null;
    const fxPreset = fd.fxPreset || null;
    const soundFx = fd.soundFx || null;
    if (this.#selectedPresetId && !this.#customEdited) {
      const preset = getPreset(this.#selectedPresetId, WeatherManager.getCustomPresets());
      const nativeFx = preset?.fxPreset || '';
      const userPickedFx = this.#fxPreset || '';
      const fxOverride = userPickedFx !== nativeFx ? userPickedFx || null : undefined;
      const nativeSound = preset?.soundFx || '';
      const userPickedSound = this.#soundFx || '';
      const soundOverride = userPickedSound !== nativeSound ? userPickedSound || null : undefined;
      await WeatherManager.setWeather(this.#selectedPresetId, { wind: windData, precipitation: precipData, fxPreset: fxOverride, soundFx: soundOverride, zoneId });
    } else {
      const data = foundry.utils.expandObject(fd);
      const label = data.customLabel?.trim();
      if (label) {
        const temp = data.customTemp;
        const icon = data.customIcon?.trim() || 'fa-question';
        const color = data.customColor || '#888888';
        const temperature = temp ? fromDisplayUnit(parseInt(temp, 10)) : null;
        await WeatherManager.setCustomWeather({ label, temperature, icon, color, wind: windData, precipitation: precipData, fxPreset, soundFx, zoneId });
      }
    }
    log(3, `Weather applied: ${this.#selectedPresetId ?? 'custom'}`);
    if (fd.saveAsPreset) {
      const data = foundry.utils.expandObject(fd);
      const label = data.customLabel?.trim();
      if (label) {
        const preset = this.#selectedPresetId ? getPreset(this.#selectedPresetId, WeatherManager.getCustomPresets()) : null;
        await WeatherManager.addCustomPreset({
          id: `custom-${Date.now()}`,
          label,
          description: '',
          icon: data.customIcon?.trim() || preset?.icon || 'fa-question',
          color: data.customColor || preset?.color || '#888888',
          wind: windData,
          precipitation: precipData,
          tempMin: data.customTemp ? fromDisplayUnit(parseInt(data.customTemp, 10)) : null,
          tempMax: data.customTemp ? fromDisplayUnit(parseInt(data.customTemp, 10)) : null,
          fxPreset,
          soundFx,
          inertiaWeight: preset?.inertiaWeight ?? 1,
          chance: preset?.chance ?? 1,
          darknessPenalty: preset?.darknessPenalty ?? 0
        });
      }
    }
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
    const zoneId = sceneZone?.id ?? null;
    const alias = getPresetAlias(presetId, calendarId, zoneId);
    this.#customLabel = alias || localize(preset.label);
    this.#customTemp = null;
    this.#customIcon = preset.icon || 'fa-question';
    this.#customColor = preset.color || '#888888';
    this.#windSpeed = preset.wind?.speed ?? 0;
    this.#windDirection = preset.wind?.direction ?? null;
    this.#precipType = preset.precipitation?.type ?? null;
    this.#precipIntensity = preset.precipitation?.intensity ?? 0;
    this.#fxPreset = preset.fxPreset || '';
    this.#soundFx = preset.soundFx || '';
    this.render();
  }

  /**
   * Generate random weather.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onRandomWeather(_event, _target) {
    const sceneZone = WeatherManager.getActiveZone(null, game.scenes?.active);
    const zoneId = sceneZone?.id ?? null;
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
    this.#fxPreset = weather?.fxPreset ?? null;
    this.#soundFx = weather?.soundFx ?? null;
    log(3, 'Random weather generated');
    this.render();
  }

  /**
   * Clear current weather and reset custom fields.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onClearWeather(_event, _target) {
    await WeatherManager.clearWeather();
    log(3, 'Weather cleared');
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
    this.#fxPreset = null;
    this.#soundFx = null;
    this.render();
  }
}
