/**
 * Extended SceneConfig that adds a dedicated Calendaria tab.
 * @module CalendariaSceneConfig
 * @author Tyler
 */

import { MODULE, SCENE_FLAGS, TEMPLATES } from '../../constants.mjs';
import WeatherManager from '../../weather/weather-manager.mjs';

/**
 * Scene configuration sheet with an additional Calendaria tab for module-specific scene flags.
 */
export class CalendariaSceneConfig extends foundry.applications.sheets.SceneConfig {
  /**
   * Rebuild PARTS to include the Calendaria tab content.
   * @returns {object} The rebuilt parts configuration
   */
  static buildParts() {
    const { footer, ...parts } = super.PARTS;
    return {
      ...parts,
      calendaria: { template: TEMPLATES.SCENE.CONFIG_CALENDARIA, scrollable: [''] },
      footer
    };
  }

  static PARTS = CalendariaSceneConfig.buildParts();

  /**
   * Extend TABS to include the Calendaria tab entry.
   * @returns {object} The extended tabs configuration
   */
  static buildTabs() {
    super.TABS.sheet.tabs.push({ id: 'calendaria', icon: 'fa-solid fa-calendar-days', label: 'CALENDARIA.Scene.Tab' });
    return super.TABS;
  }

  static TABS = CalendariaSceneConfig.buildTabs();

  /**
   * Prepare context data for the Calendaria tab part.
   * @param {string} partId - The part identifier
   * @param {object} context - The rendering context
   * @param {object} options - Render options
   * @returns {Promise<object>} The prepared context
   */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === 'calendaria') {
      const doc = this.document;
      const flagValue = doc.getFlag(MODULE.ID, SCENE_FLAGS.DARKNESS_SYNC);
      let darknessSync = 'default';
      if (flagValue === true || flagValue === 'enabled') darknessSync = 'enabled';
      else if (flagValue === false || flagValue === 'disabled') darknessSync = 'disabled';
      context.moduleId = MODULE.ID;
      context.darknessSync = darknessSync;
      context.brightnessMultiplier = doc.getFlag(MODULE.ID, SCENE_FLAGS.BRIGHTNESS_MULTIPLIER) ?? 1.0;
      context.hudHideForPlayers = doc.getFlag(MODULE.ID, SCENE_FLAGS.HUD_HIDE_FOR_PLAYERS) ?? false;
      context.climateZoneOverride = doc.getFlag(MODULE.ID, SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE) ?? '';
      context.climateZones = WeatherManager.getCalendarZones?.() ?? [];
      context.weatherFxDisabled = doc.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_DISABLED) ?? false;
      context.weatherSoundDisabled = doc.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_SOUND_DISABLED) ?? false;
    }
    return context;
  }

  /**
   * Attach event listeners for the brightness multiplier range slider.
   * @param {string} partId - The part identifier
   * @param {HTMLElement} htmlElement - The rendered HTML element
   * @param {object} options - Render options
   */
  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);
    if (partId === 'calendaria') {
      const rangeInput = htmlElement.querySelector(`[name="flags.${MODULE.ID}.${SCENE_FLAGS.BRIGHTNESS_MULTIPLIER}"]`);
      if (rangeInput) {
        rangeInput.addEventListener('input', (event) => {
          const display = event.target.parentElement.querySelector('.range-value');
          if (display) display.textContent = `${event.target.value}x`;
        });
      }
    }
  }
}
