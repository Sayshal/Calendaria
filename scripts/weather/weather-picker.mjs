/**
 * Weather Picker Application
 * Allows GMs to select or randomly generate weather.
 *
 * @module Weather/WeatherPicker
 * @author Tyler
 */

import { MODULE, TEMPLATES, HOOKS } from '../constants.mjs';
import { WEATHER_CATEGORIES, getPresetsByCategory } from './weather-presets.mjs';
import WeatherManager from './weather-manager.mjs';

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
  static PARTS = {
    content: { template: TEMPLATES.WEATHER.PICKER }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const customPresets = WeatherManager.getCustomPresets();

    // Build categories with presets
    context.categories = [];
    const categoryIds = ['standard', 'severe', 'environmental', 'fantasy'];

    for (const categoryId of categoryIds) {
      const category = WEATHER_CATEGORIES[categoryId];
      const presets = getPresetsByCategory(categoryId, customPresets);
      if (presets.length === 0) continue;

      context.categories.push({
        id: categoryId,
        label: game.i18n.localize(category.label),
        presets: presets.map((p) => ({
          id: p.id,
          label: game.i18n.localize(p.label),
          description: p.description ? game.i18n.localize(p.description) : game.i18n.localize(p.label),
          icon: p.icon,
          color: p.color
        }))
      });
    }

    // Custom presets
    if (customPresets.length > 0) {
      context.categories.push({
        id: 'custom',
        label: game.i18n.localize(WEATHER_CATEGORIES.custom.label),
        presets: customPresets.map((p) => {
          const label = p.label.startsWith('CALENDARIA.') ? game.i18n.localize(p.label) : p.label;
          const description = p.description ? (p.description.startsWith('CALENDARIA.') ? game.i18n.localize(p.description) : p.description) : label;
          return { id: p.id, label, description, icon: p.icon, color: p.color };
        })
      });
    }

    return context;
  }

  /**
   * Select a specific weather preset.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onSelectWeather(event, target) {
    const presetId = target.dataset.presetId;
    await WeatherManager.setWeather(presetId);
    await this.close();
    Hooks.callAll(HOOKS.WEATHER_CHANGE);
  }

  /**
   * Generate random weather.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onRandomWeather(event, target) {
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

export default { openWeatherPicker };
