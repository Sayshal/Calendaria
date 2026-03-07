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
   * Read super.PARTS dynamically.
   * @returns {object} The merged PARTS definition including the calendaria tab
   */
  static get PARTS() {
    const { footer, ...rest } = super.PARTS;
    return { ...rest, calendaria: { template: TEMPLATES.SCENE.CONFIG_CALENDARIA, scrollable: [''] }, footer };
  }

  /**
   * Mutates SceneConfig.TABS so all subclasses inherit the Calendaria tab.
   * @returns {object} The extended TABS configuration
   */
  static buildTabs() {
    super.TABS.sheet.tabs.push({ id: 'calendaria', icon: 'fa-solid fa-calendar-days', label: 'CALENDARIA.Scene.Tab' });
    return super.TABS;
  }

  static TABS = CalendariaSceneConfig.buildTabs();

  /**
   * Patch the base SceneConfig
   */
  static patchBaseSceneConfig() {
    const Base = foundry.applications.sheets.SceneConfig;
    const { footer, ...rest } = Base.PARTS;
    Object.defineProperty(Base, 'PARTS', { value: { ...rest, calendaria: { template: TEMPLATES.SCENE.CONFIG_CALENDARIA, scrollable: [''] }, footer }, writable: true, configurable: true });
    const origPrepare = Base.prototype._preparePartContext;
    Base.prototype._preparePartContext = async function (partId, context, options) {
      context = await origPrepare.call(this, partId, context, options);
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
        context.fxTopDownOverride = doc.getFlag(MODULE.ID, SCENE_FLAGS.FXMASTER_TOP_DOWN_OVERRIDE) ?? 'default';
        context.weatherSoundDisabled = doc.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_SOUND_DISABLED) ?? false;
      }
      return context;
    };
    const origAttach = Base.prototype._attachPartListeners;
    Base.prototype._attachPartListeners = function (partId, htmlElement, options) {
      origAttach.call(this, partId, htmlElement, options);
      if (partId !== 'calendaria') return;
      const rangeInput = htmlElement.querySelector(`[name="flags.${MODULE.ID}.${SCENE_FLAGS.BRIGHTNESS_MULTIPLIER}"]`);
      if (rangeInput) {
        rangeInput.addEventListener('input', (e) => {
          const display = e.target.parentElement.querySelector('.range-value');
          if (display) display.textContent = `${e.target.value}x`;
        });
      }
    };
  }
}
