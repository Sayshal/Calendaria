import { MODULE, SCENE_FLAGS, TEMPLATES } from '../../constants.mjs';
import { WeatherManager } from '../../weather/_module.mjs';

/**
 * Scene configuration sheet with an additional Calendaria tab for module-specific scene flags.
 */
export class CalendariaSceneConfig extends foundry.applications.sheets.SceneConfig {
  /**
   * Patch the base SceneConfig to add the Calendaria part and context handling.
   */
  static patchBaseSceneConfig() {
    const Base = foundry.applications.sheets.SceneConfig;
    const calPart = { template: TEMPLATES.SCENE.CONFIG_CALENDARIA, scrollable: [''] };
    const calTab = { id: 'calendaria', icon: 'fa-solid fa-calendar-days', label: 'CALENDARIA.Scene.Tab' };
    const footer = Base.PARTS.footer;
    delete Base.PARTS.footer;
    Base.PARTS.calendaria = calPart;
    Base.PARTS.footer = footer;
    Base.TABS.sheet.tabs.push(calTab);
    const origConfigure = Base.prototype._configureRenderOptions;
    Base.prototype._configureRenderOptions = function (options) {
      if (!this.constructor.PARTS.calendaria) {
        const f = this.constructor.PARTS.footer;
        delete this.constructor.PARTS.footer;
        this.constructor.PARTS.calendaria = calPart;
        this.constructor.PARTS.footer = f;
      }
      const tabs = this.constructor.TABS?.sheet?.tabs;
      if (tabs && !tabs.find((t) => t.id === 'calendaria')) tabs.push(calTab);
      return origConfigure.call(this, options);
    };

    const origPrepare = Base.prototype._preparePartContext;
    Base.prototype._preparePartContext = async function (partId, context, options) {
      context = await origPrepare.call(this, partId, context, options);
      if (partId === 'calendaria') {
        const doc = this.document;
        const threeWay = (flagKey) => {
          const v = doc.getFlag(MODULE.ID, flagKey);
          if (v === true || v === 'enabled') return 'enabled';
          if (v === false || v === 'disabled') return 'disabled';
          return 'default';
        };
        context.moduleId = MODULE.ID;
        context.darknessSync = threeWay(SCENE_FLAGS.DARKNESS_SYNC);
        context.ambienceSync = threeWay(SCENE_FLAGS.AMBIENCE_SYNC);
        context.colorShiftSync = threeWay(SCENE_FLAGS.COLOR_SHIFT_SYNC);
        context.weatherDarknessSync = threeWay(SCENE_FLAGS.DARKNESS_WEATHER_SYNC);
        context.moonDarknessSync = threeWay(SCENE_FLAGS.DARKNESS_MOON_SYNC);
        context.brightnessMultiplier = doc.getFlag(MODULE.ID, SCENE_FLAGS.BRIGHTNESS_MULTIPLIER) ?? 1.0;
        context.hudHideForPlayers = doc.getFlag(MODULE.ID, SCENE_FLAGS.HUD_HIDE_FOR_PLAYERS) ?? false;
        context.climateZoneOverride = doc.getFlag(MODULE.ID, SCENE_FLAGS.CLIMATE_ZONE_OVERRIDE) ?? '';
        context.climateZones = WeatherManager.getCalendarZones?.() ?? [];
        const weatherFxOverride = doc.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_OVERRIDE) ?? 'inherit';
        context.weatherFxOverride = weatherFxOverride;
        context.weatherFxOverrideOptions = [
          { value: 'inherit', label: 'CALENDARIA.SceneConfig.WeatherFxOverride.Inherit', selected: weatherFxOverride === 'inherit' },
          { value: 'on', label: 'CALENDARIA.SceneConfig.WeatherFxOverride.On', selected: weatherFxOverride === 'on' },
          { value: 'off', label: 'CALENDARIA.SceneConfig.WeatherFxOverride.Off', selected: weatherFxOverride === 'off' }
        ];
        context.fxTopDownOverride = doc.getFlag(MODULE.ID, SCENE_FLAGS.FXMASTER_TOP_DOWN_OVERRIDE) ?? 'default';
        context.weatherSoundDisabled = doc.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_SOUND_DISABLED) ?? false;
        const selectedLevels = doc.getFlag(MODULE.ID, SCENE_FLAGS.WEATHER_FX_LEVELS) ?? [];
        context.sceneLevels = [...(doc.levels ?? [])].map((l) => ({ id: l.id, name: l.name, selected: selectedLevels.includes(l.id) }));
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
