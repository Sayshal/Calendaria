/**
 * Weather Picker Application
 * Allows GMs to select or randomly generate weather.
 * @module Weather/WeatherPicker
 * @author Tyler
 */

import { HOOKS, TEMPLATES } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import WeatherManager from './weather-manager.mjs';
import { WEATHER_CATEGORIES, getPresetsByCategory } from './weather-presets.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Weather picker application with selectable presets.
 */
class WeatherPickerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'weather-picker',
    classes: ['calendaria', 'weather-picker-app'],
    tag: 'div',
    window: { title: 'CALENDARIA.Weather.Picker.Title', icon: 'fas fa-cloud-sun', resizable: false },
    position: { width: 550, height: 'auto' },
    actions: {
      selectWeather: WeatherPickerApp._onSelectWeather,
      randomWeather: WeatherPickerApp._onRandomWeather
    }
  };

  /** @override */
  static PARTS = { content: { template: TEMPLATES.WEATHER.PICKER } };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const customPresets = WeatherManager.getCustomPresets();
    context.categories = [];
    const categoryIds = ['standard', 'severe', 'environmental', 'fantasy'];
    for (const categoryId of categoryIds) {
      const category = WEATHER_CATEGORIES[categoryId];
      const presets = getPresetsByCategory(categoryId, customPresets);
      if (presets.length === 0) continue;
      context.categories.push({
        id: categoryId,
        label: localize(category.label),
        presets: presets.map((p) => ({ id: p.id, label: localize(p.label), description: p.description ? localize(p.description) : localize(p.label), icon: p.icon, color: p.color }))
      });
    }

    if (customPresets.length > 0) {
      context.categories.push({
        id: 'custom',
        label: localize(WEATHER_CATEGORIES.custom.label),
        presets: customPresets.map((p) => {
          const label = p.label.startsWith('CALENDARIA.') ? localize(p.label) : p.label;
          const description = p.description ? (p.description.startsWith('CALENDARIA.') ? localize(p.description) : p.description) : label;
          return { id: p.id, label, description, icon: p.icon, color: p.color };
        })
      });
    }

    return context;
  }

  /**
   * Select a specific weather preset.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onSelectWeather(_event, target) {
    const presetId = target.dataset.presetId;
    await WeatherManager.setWeather(presetId);
    await this.close();
    Hooks.callAll(HOOKS.WEATHER_CHANGE);
  }

  /**
   * Generate random weather.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onRandomWeather(_event, _target) {
    await WeatherManager.generateAndSetWeather();
    await this.close();
    Hooks.callAll(HOOKS.WEATHER_CHANGE);
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
