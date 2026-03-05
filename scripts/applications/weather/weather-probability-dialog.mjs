/**
 * Weather Probability Dialog - Shows probability breakdown for a zone and season.
 * @module Applications/WeatherProbabilityDialog
 * @author Tyler
 */

import CalendarManager from '../../calendar/calendar-manager.mjs';
import { TEMPLATES } from '../../constants.mjs';
import { localize } from '../../utils/localization.mjs';
import WeatherManager from '../../weather/weather-manager.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialog displaying weather probability breakdown for a given zone and season.
 */
export class WeatherProbabilityDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {string|null} Currently selected zone ID */
  #selectedZoneId = null;

  /** @type {string|null} Currently selected season name */
  #selectedSeason = null;

  /** @type {boolean} Whether in editor mode (using raw data instead of active calendar) */
  #editorMode = false;

  /** @type {object|null} Raw zone config for editor mode */
  #zoneConfig = null;

  /** @type {string|null} Calendar ID for editor mode */
  #calendarId = null;

  /** @type {object[]} Seasons array for editor mode */
  #seasons = [];

  /**
   * @param {object} [options] - Application options
   * @param {string} [options.zoneId] - Initial zone ID
   * @param {string} [options.season] - Initial season name
   * @param {boolean} [options.editorMode] - Use raw data from editor
   * @param {object} [options.zoneConfig] - Raw zone config (editor mode)
   * @param {string} [options.calendarId] - Calendar ID (editor mode)
   * @param {object[]} [options.seasons] - Seasons array (editor mode)
   */
  constructor(options = {}) {
    super(options);
    this.#selectedZoneId = options.zoneId ?? null;
    this.#selectedSeason = options.season ?? null;
    this.#editorMode = options.editorMode ?? false;
    this.#zoneConfig = options.zoneConfig ?? null;
    this.#calendarId = options.calendarId ?? null;
    this.#seasons = options.seasons ?? [];
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-weather-probability',
    classes: ['calendaria', 'weather-probability-dialog'],
    position: { width: 420, height: 'auto' },
    window: { title: 'CALENDARIA.WeatherProbability.Title', resizable: false, contentClasses: ['standard-form'] }
  };

  /** @override */
  static PARTS = {
    form: { template: TEMPLATES.WEATHER.PROBABILITY_DIALOG }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (this.#editorMode) return this.#prepareEditorContext(context);
    const calendar = CalendarManager.getActiveCalendar();
    const zones = WeatherManager.getCalendarZones();
    const seasons = calendar?.seasonsArray ?? [];
    const isSceneNoZone = WeatherManager.isZoneDisabled();
    const activeZone = WeatherManager.getActiveZone(null, game.scenes?.active);
    const zoneId = this.#selectedZoneId ?? (isSceneNoZone ? 'none' : (activeZone?.id ?? zones[0]?.id ?? null));
    const currentSeason = calendar?.getCurrentSeason?.(game.time.components);
    const seasonName = this.#selectedSeason ?? currentSeason?.name ?? seasons[0]?.name ?? null;
    context.zones = [
      ...zones.map((z) => ({ id: z.id, name: localize(z.name), selected: z.id === zoneId })),
      { id: 'none', name: localize('CALENDARIA.Weather.Picker.NoZone'), selected: zoneId === 'none' }
    ];
    context.seasons = seasons.map((s) => ({ name: s.name, label: localize(s.name), selected: s.name === seasonName }));
    context.zoneDisabled = zones.length === 0;
    const data = WeatherManager.getWeatherProbabilities({ zoneId, season: seasonName });
    context.entries = data.entries;
    context.tempRange = { min: WeatherManager.formatTemperature(data.tempRange.min), max: WeatherManager.formatTemperature(data.tempRange.max) };
    context.hasEntries = data.entries.length > 0;
    return context;
  }

  /**
   * Prepare context using raw editor data.
   * @param {object} context - Base context
   * @returns {object} Enriched context
   */
  #prepareEditorContext(context) {
    const seasons = this.#seasons;
    const selectedZoneId = this.#selectedZoneId ?? this.#zoneConfig?.id ?? null;
    const seasonName = this.#selectedSeason ?? seasons[0]?.name ?? null;
    const seasonObj = seasons.find((s) => s.name === seasonName);
    const seasonClimate = seasonObj?.climate ?? null;
    const allZones = WeatherManager.getCalendarZones();
    const isNoZone = selectedZoneId === 'none';
    const useEditorData = !isNoZone && (!this.#selectedZoneId || this.#selectedZoneId === this.#zoneConfig?.id);
    const resolvedZoneConfig = isNoZone ? null : useEditorData ? this.#zoneConfig : (allZones.find((z) => z.id === this.#selectedZoneId) ?? this.#zoneConfig);
    context.zones = [
      ...allZones.map((z) => ({ id: z.id, name: localize(z.name), selected: z.id === selectedZoneId })),
      { id: 'none', name: localize('CALENDARIA.Weather.Picker.NoZone'), selected: isNoZone }
    ];
    context.zoneDisabled = allZones.length === 0;
    context.seasons = seasons.map((s) => ({ name: s.name, label: localize(s.name), selected: s.name === seasonName }));
    const data = WeatherManager.computeProbabilitiesFromRaw({ seasonClimate, zoneConfig: resolvedZoneConfig, season: seasonName, calendarId: this.#calendarId });
    context.entries = data.entries;
    context.tempRange = { min: WeatherManager.formatTemperature(data.tempRange.min), max: WeatherManager.formatTemperature(data.tempRange.max) };
    context.hasEntries = data.entries.length > 0;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const zoneSelect = this.element.querySelector('select[name="zone"]');
    const seasonSelect = this.element.querySelector('select[name="season"]');
    zoneSelect?.addEventListener('change', (e) => {
      this.#selectedZoneId = e.target.value || null;
      this.render();
    });
    seasonSelect?.addEventListener('change', (e) => {
      this.#selectedSeason = e.target.value || null;
      this.render();
    });
  }

  /**
   * Open the Weather Probability dialog with instance caching.
   * @param {object} [options] - Options
   * @param {string} [options.zoneId] - Initial zone ID
   * @param {string} [options.season] - Initial season name
   * @param {boolean} [options.editorMode] - Use raw data from editor
   * @param {object} [options.zoneConfig] - Raw zone config (editor mode)
   * @param {string} [options.calendarId] - Calendar ID (editor mode)
   * @param {object[]} [options.seasons] - Seasons array (editor mode)
   * @returns {WeatherProbabilityDialog} The dialog instance
   */
  static open(options = {}) {
    const existing = foundry.applications.instances.get('calendaria-weather-probability');
    if (existing) existing.close();
    const dialog = new WeatherProbabilityDialog(options);
    dialog.render({ force: true });
    return dialog;
  }
}
