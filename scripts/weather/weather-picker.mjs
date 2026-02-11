/**
 * Weather Picker Application
 * Allows GMs to select or randomly generate weather.
 * @module Weather/WeatherPicker
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, TEMPLATES } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { fromDisplayUnit, getTemperatureUnit, toDisplayUnit } from './climate-data.mjs';
import WeatherManager from './weather-manager.mjs';
import { WEATHER_CATEGORIES, getPreset, getPresetAlias, getPresetsByCategory } from './weather-presets.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
  static PARTS = { content: { template: TEMPLATES.WEATHER.PICKER } };

  /** @override */
  async close(options) {
    this.#zoneOverride = undefined;
    this.#selectedPresetId = null;
    this.#customEdited = false;
    this.#customLabel = null;
    this.#customTemp = null;
    this.#customIcon = null;
    this.#customColor = null;
    return super.close(options);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const customPresets = WeatherManager.getCustomPresets();
    const zones = WeatherManager.getCalendarZones() || [];
    const calendar = CalendarManager.getActiveCalendar();
    const calendarActiveZone = calendar?.weather?.activeZone ?? null;
    const selectedZoneId = this.#zoneOverride !== undefined ? this.#zoneOverride : calendarActiveZone;
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
      context.categories.push({
        id: categoryId,
        label: localize(category.label),
        presets: presets.map((p) => {
          const alias = getPresetAlias(p.id, calendarId, selectedZoneId);
          const label = alias || localize(p.label);
          return { id: p.id, label, description: p.description ? localize(p.description) : label, icon: p.icon, color: p.color, selected: p.id === this.#selectedPresetId };
        })
      });
    }

    if (customPresets.length > 0) {
      let filtered = customPresets;
      if (shouldFilter) filtered = customPresets.filter((p) => enabledPresetIds.has(p.id));
      if (filtered.length > 0) {
        context.categories.push({
          id: 'custom',
          label: localize(WEATHER_CATEGORIES.custom.label),
          presets: filtered.map((p) => {
            const alias = getPresetAlias(p.id, calendarId, selectedZoneId);
            const label = alias || (p.label.startsWith('CALENDARIA.') ? localize(p.label) : p.label);
            const description = p.description ? (p.description.startsWith('CALENDARIA.') ? localize(p.description) : p.description) : label;
            return { id: p.id, label, description, icon: p.icon, color: p.color, selected: p.id === this.#selectedPresetId };
          })
        });
      }
    }

    context.temperatureUnit = getTemperatureUnit() === 'fahrenheit' ? '°F' : '°C';
    const currentWeather = WeatherManager.getCurrentWeather();
    const currentTemp = WeatherManager.getTemperature();
    context.selectedZoneId = selectedZoneId;
    const currentWeatherAlias = currentWeather?.id ? getPresetAlias(currentWeather.id, calendarId, selectedZoneId) : null;
    context.customLabel = this.#customLabel ?? (currentWeatherAlias || (currentWeather?.label ? localize(currentWeather.label) : ''));
    context.customTemp = this.#customTemp ?? (currentTemp != null ? toDisplayUnit(currentTemp) : '');
    context.customIcon = this.#customIcon ?? (currentWeather?.icon || 'fa-question');
    context.customColor = this.#customColor ?? (currentWeather?.color || '#888888');
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
  }

  /**
   * Handle save button. Applies selected preset or custom weather.
   * @param {Event} _event - The submit event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - The form data
   */
  static async _onSave(_event, _form, formData) {
    if (this.#selectedPresetId && !this.#customEdited) {
      await WeatherManager.setWeather(this.#selectedPresetId);
    } else {
      const data = foundry.utils.expandObject(formData.object);
      const label = data.customLabel?.trim();
      if (!label) return;
      const temp = data.customTemp;
      const icon = data.customIcon?.trim() || 'fa-question';
      const color = data.customColor || '#888888';
      const temperature = temp ? fromDisplayUnit(parseInt(temp, 10)) : null;
      await WeatherManager.setCustomWeather({ label, temperature, icon, color });
    }
    const setActive = formData.object.setAsActiveZone;
    const zoneId = formData.object.climateZone || null;
    if (setActive && zoneId) await WeatherManager.setActiveZone(zoneId);
    Hooks.callAll(HOOKS.WEATHER_CHANGE);
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
    const calendarId = CalendarManager.getActiveCalendar()?.metadata?.id;
    const zoneId = this.#zoneOverride !== undefined ? this.#zoneOverride : (CalendarManager.getActiveCalendar()?.weather?.activeZone ?? null);
    const alias = getPresetAlias(presetId, calendarId, zoneId);
    this.#customLabel = alias || localize(preset.label);
    this.#customTemp = null;
    this.#customIcon = preset.icon || 'fa-question';
    this.#customColor = preset.color || '#888888';
    this.render();
  }

  /**
   * Generate random weather.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onRandomWeather(_event, _target) {
    const zoneId = this.#zoneOverride !== undefined ? this.#zoneOverride : (CalendarManager.getActiveCalendar()?.weather?.activeZone ?? null);
    await WeatherManager.generateAndSetWeather({ zoneId });
    this.#selectedPresetId = null;
    this.#customEdited = false;
    this.#customLabel = null;
    this.#customTemp = null;
    this.#customIcon = null;
    this.#customColor = null;
    Hooks.callAll(HOOKS.WEATHER_CHANGE);
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
    Hooks.callAll(HOOKS.WEATHER_CHANGE);
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
