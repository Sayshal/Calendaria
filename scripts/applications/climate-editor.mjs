/**
 * Climate Editor Application — edits season or zone climate settings.
 * Replaces the former DialogV2-based climate editing with a full AppV2 form.
 * @module Applications/ClimateEditor
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import CalendariaCalendar from '../calendar/data/calendaria-calendar.mjs';
import { MODULE, SETTINGS, TEMPLATES } from '../constants.mjs';
import { format, localize } from '../utils/localization.mjs';
import { fromDisplayUnit, toDisplayUnit } from '../weather/climate-data.mjs';
import { ALL_PRESETS, getAllPresets, getPresetAlias, setPresetAlias, WEATHER_CATEGORIES } from '../weather/weather-presets.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Climate editor for season or zone climate configuration.
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class ClimateEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['calendaria', 'climate-editor'],
    tag: 'form',
    window: { contentClasses: ['standard-form'] },
    position: { width: 'auto', height: 'auto' },
    form: { handler: ClimateEditor.#onSubmit, submitOnChange: true, closeOnSubmit: false },
    actions: {
      resetAlias: ClimateEditor.#onResetAlias
    }
  };

  /** @override */
  static PARTS = {
    form: { template: TEMPLATES.WEATHER.CLIMATE_EDITOR, scrollable: [''] }
  };

  /** @type {'season'|'zone'} */
  #mode;

  /** @type {object} Deep-cloned data for the season/zone being edited */
  #data;

  /** @type {string} Key of the zone being edited (zone mode) */
  #zoneKey;

  /** @type {string} Calendar ID */
  #calendarId;
  #calendarData;

  /** @type {string[]} Season names for zone temperature rows */
  #seasonNames;

  /** @type {Function} Callback invoked on save with parsed result */
  #onSave;

  /**
   * @param {object} options - Application options
   * @param {string} options.mode - 'season' or 'zone'
   * @param {object} options.data - Climate data to edit (deep-cloned internally)
   * @param {string} [options.seasonKey] - Season key (season mode)
   * @param {string} [options.zoneKey] - Zone key (zone mode)
   * @param {string} options.calendarId - Calendar ID
   * @param {object} [options.calendarData] - In-progress calendar data (unsaved edits from editor)
   * @param {string[]} [options.seasonNames] - Season names (zone mode)
   * @param {Function} options.onSave - Callback with parsed result
   */
  constructor(options = {}) {
    const mode = options.mode;
    const key = mode === 'season' ? options.seasonKey : options.zoneKey;
    const classes = ['calendaria', 'climate-editor'];
    if (mode === 'zone') classes.push('zone-mode');
    super({
      ...options,
      id: `climate-editor-${mode}-${key}`,
      classes,
      window: {
        contentClasses: ['standard-form'],
        title:
          mode === 'season'
            ? format('CALENDARIA.Editor.Season.Climate.Title', { name: localize(options.data?.name ?? '') })
            : format('CALENDARIA.Editor.Weather.Zone.EditTitle', { name: options.data?.name ?? '' })
      }
    });
    this.#mode = mode;
    this.#data = foundry.utils.deepClone(options.data);
    this.#zoneKey = options.zoneKey ?? null;
    this.#calendarId = options.calendarId;
    this.#calendarData = options.calendarData ?? null;
    this.#seasonNames = options.seasonNames ?? [];
    this.#onSave = options.onSave;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isZoneMode = this.#mode === 'zone';
    const tempUnit = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_UNIT) || 'celsius';
    const tempLabel = tempUnit === 'fahrenheit' ? '°F' : '°C';
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const allPresets = getAllPresets(customPresets);

    // Season mode: single temp row
    let tempMin = '';
    let tempMax = '';
    if (!isZoneMode) {
      const climate = this.#data.climate ?? {};
      if (climate.temperatures?.min != null) tempMin = toDisplayUnit(climate.temperatures.min);
      if (climate.temperatures?.max != null) tempMax = toDisplayUnit(climate.temperatures.max);
    }

    // Zone mode: per-season temp rows
    let temperatureRows = [];
    if (isZoneMode) {
      const seasonNames = this.#seasonNames.length ? this.#seasonNames : ['CALENDARIA.Season.Spring', 'CALENDARIA.Season.Summer', 'CALENDARIA.Season.Autumn', 'CALENDARIA.Season.Winter'];
      temperatureRows = seasonNames.map((season) => {
        const temp = this.#data.temperatures?.[season] || this.#data.temperatures?._default || { min: 10, max: 22 };
        return {
          seasonName: season,
          label: localize(season),
          min: toDisplayUnit(temp.min),
          max: toDisplayUnit(temp.max)
        };
      });
    }

    // Build preset data grouped by category
    const categories = Object.values(WEATHER_CATEGORIES)
      .map((cat) => {
        const categoryPresets = allPresets.filter((p) => p.category === cat.id);
        if (!categoryPresets.length) return null;
        const presets = categoryPresets.map((preset) => {
          if (isZoneMode) {
            const savedPresets = this.#data.presets ? Object.values(this.#data.presets) : [];
            const saved = savedPresets.find((s) => s.id === preset.id) || {};
            const alias = getPresetAlias(preset.id, this.#calendarId, this.#zoneKey) || '';
            return {
              id: preset.id,
              icon: preset.icon,
              color: preset.color,
              label: localize(preset.label),
              alias,
              hasAlias: !!alias,
              enabled: saved.enabled ?? false,
              chance: saved.chance ? saved.chance.toFixed(2) : '',
              tempMin: saved.tempMin != null ? toDisplayUnit(saved.tempMin) : '',
              tempMax: saved.tempMax != null ? toDisplayUnit(saved.tempMax) : ''
            };
          }
          // Season mode
          const climatePresets = this.#data.climate?.presets ?? {};
          const existing = Object.values(climatePresets).find((p) => p.id === preset.id);
          return {
            id: preset.id,
            icon: preset.icon,
            color: preset.color,
            label: localize(preset.label),
            chance: existing?.chance ?? ''
          };
        });
        return { label: localize(cat.label), presets };
      })
      .filter(Boolean);

    // Zone daylight preview
    let latitude = this.#data.latitude ?? null;
    let shortestDayHours = '';
    let longestDayHours = '';
    let hoursPerDay = 24;
    let zoneShortestDay = this.#data.shortestDay ?? '';
    let zoneLongestDay = this.#data.longestDay ?? '';
    let defaultShortestDay = '';
    let defaultLongestDay = '';
    const hasManualDaylight = zoneShortestDay !== '' || zoneLongestDay !== '';

    let shortestDayDate = '';
    let longestDayDate = '';

    if (isZoneMode) {
      const calendar = this.#calendarData ?? CalendarManager.getCalendar(this.#calendarId) ?? CalendarManager.getActiveCalendar();
      hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
      const daysPerYear = calendar?.days?.daysPerYear ?? 365;
      const winterSolstice = calendar?.daylight?.winterSolstice ?? Math.round(daysPerYear * 0.97);
      const summerSolstice = calendar?.daylight?.summerSolstice ?? Math.round(daysPerYear * 0.47);
      const globalShort = calendar?.daylight?.enabled ? (calendar?.daylight?.shortestDay ?? hoursPerDay * 0.5) : hoursPerDay * 0.5;
      const globalLong = calendar?.daylight?.enabled ? (calendar?.daylight?.longestDay ?? hoursPerDay * 0.5) : hoursPerDay * 0.5;
      defaultShortestDay = globalShort;
      defaultLongestDay = globalLong;

      // Resolve day-of-year to "Month Day" date strings
      const months = calendar?.monthsArray ?? Object.values(calendar?.months?.values ?? {});
      const dayOfYearToDate = (doy) => {
        let remaining = ((doy % daysPerYear) + daysPerYear) % daysPerYear;
        for (const month of months) {
          const d = month.days || 0;
          if (remaining < d) return `${month.name} ${remaining + 1}`;
          remaining -= d;
        }
        const last = months[months.length - 1];
        return `${last?.name ?? '?'} ${last?.days ?? 1}`;
      };
      shortestDayDate = dayOfYearToDate(winterSolstice);
      longestDayDate = dayOfYearToDate(summerSolstice);

      if (hasManualDaylight) {
        shortestDayHours = `${parseFloat(zoneShortestDay || globalShort).toFixed(1)}h`;
        longestDayHours = `${parseFloat(zoneLongestDay || globalLong).toFixed(1)}h`;
      } else if (latitude != null) {
        const winterHrs = CalendariaCalendar.computeDaylightFromLatitude(latitude, winterSolstice, daysPerYear, hoursPerDay, summerSolstice);
        const summerHrs = CalendariaCalendar.computeDaylightFromLatitude(latitude, summerSolstice, daysPerYear, hoursPerDay, summerSolstice);
        shortestDayHours = `${winterHrs.toFixed(1)}h`;
        longestDayHours = `${summerHrs.toFixed(1)}h`;
      } else {
        shortestDayHours = `${globalShort.toFixed(1)}h`;
        longestDayHours = `${globalLong.toFixed(1)}h`;
      }
    }

    return {
      ...context,
      isZoneMode,
      tempLabel,
      tempMin,
      tempMax,
      temperatureRows,
      categories,
      // Zone-only fields
      description: this.#data.description ?? '',
      brightnessMultiplier: this.#data.brightnessMultiplier ?? 1.0,
      envBase: this.#data.environmentBase ?? {},
      envDark: this.#data.environmentDark ?? {},
      zoneKey: this.#zoneKey,
      // Daylight fields
      latitude: latitude ?? '',
      hasManualDaylight,
      hoursPerDay,
      zoneShortestDay,
      zoneLongestDay,
      defaultShortestDay,
      defaultLongestDay,
      shortestDayHours,
      longestDayHours,
      shortestDayDate,
      longestDayDate
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Brightness slider live label
    const slider = this.element.querySelector('[name="brightnessMultiplier"]');
    if (slider) {
      const label = slider.nextElementSibling;
      slider.addEventListener('input', () => {
        label.textContent = `${slider.value}x`;
      });
    }

    // Daylight mode toggle — checkbox switches between latitude and manual fields
    const forceCheckbox = this.element.querySelector('[name="forceSolstice"]');
    const latGroup = this.element.querySelector('.daylight-latitude');
    const manualGroups = this.element.querySelectorAll('.daylight-manual');
    if (forceCheckbox) {
      forceCheckbox.addEventListener('change', () => {
        const manual = forceCheckbox.checked;
        if (latGroup) latGroup.hidden = manual;
        manualGroups.forEach((g) => (g.hidden = !manual));
      });
    }

    // Latitude input — live-update solstice preview
    const latInput = this.element.querySelector('[name="latitude"]');
    if (latInput) {
      const shortestVal = this.element.querySelector('[data-daylight="shortest"]');
      const longestVal = this.element.querySelector('[data-daylight="longest"]');
      const calendar = this.#calendarData ?? CalendarManager.getCalendar(this.#calendarId) ?? CalendarManager.getActiveCalendar();
      const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
      const daysPerYear = calendar?.days?.daysPerYear ?? 365;
      const winterSolstice = calendar?.daylight?.winterSolstice ?? Math.round(daysPerYear * 0.97);
      const summerSolstice = calendar?.daylight?.summerSolstice ?? Math.round(daysPerYear * 0.47);

      latInput.addEventListener('input', () => {
        const lat = parseFloat(latInput.value);
        if (Number.isFinite(lat) && lat >= -90 && lat <= 90) {
          const winterHrs = CalendariaCalendar.computeDaylightFromLatitude(lat, winterSolstice, daysPerYear, hoursPerDay, summerSolstice);
          const summerHrs = CalendariaCalendar.computeDaylightFromLatitude(lat, summerSolstice, daysPerYear, hoursPerDay, summerSolstice);
          if (shortestVal) shortestVal.textContent = `${winterHrs.toFixed(1)}h`;
          if (longestVal) longestVal.textContent = `${summerHrs.toFixed(1)}h`;
        }
      });
    }

    // Alias change listeners (zone mode) — live-save to world settings
    for (const input of this.element.querySelectorAll('.preset-alias-input')) {
      input.addEventListener('change', async (e) => {
        const presetId = e.target.dataset.presetId;
        const zoneId = e.target.dataset.zoneId;
        const alias = e.target.value.trim();
        await setPresetAlias(presetId, alias || null, this.#calendarId, zoneId);
        this.render();
      });
    }
  }

  /**
   * Handle form submission — parse form data and invoke onSave callback.
   * @param {Event} _event - Submit event
   * @param {HTMLFormElement} _form - Form element
   * @param {object} formData - Parsed form data
   */
  static #onSubmit(_event, _form, formData) {
    const data = formData.object;

    if (this.#mode === 'season') {
      // Season mode: temp range + preset chances
      const tempMin = data.tempMin;
      const tempMax = data.tempMax;
      const presets = [];
      for (const preset of ALL_PRESETS) {
        const chance = parseFloat(data[`preset_${preset.id}`]);
        if (chance > 0) presets.push({ id: preset.id, chance });
      }
      const result = {
        temperatures:
          (tempMin !== '' && tempMin != null) || (tempMax !== '' && tempMax != null) ? { min: fromDisplayUnit(parseFloat(tempMin) || 0), max: fromDisplayUnit(parseFloat(tempMax) || 20) } : null,
        presets
      };
      this.#onSave(result);
      return;
    }

    // Zone mode: full zone data
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const allPresets = getAllPresets(customPresets);
    const seasonNames = this.#seasonNames.length ? this.#seasonNames : ['CALENDARIA.Season.Spring', 'CALENDARIA.Season.Summer', 'CALENDARIA.Season.Autumn', 'CALENDARIA.Season.Winter'];

    const baseHue = data.baseHue !== '' && data.baseHue != null ? parseFloat(data.baseHue) : null;
    const baseSat = data.baseSaturation !== '' && data.baseSaturation != null ? parseFloat(data.baseSaturation) : null;
    const darkHue = data.darkHue !== '' && data.darkHue != null ? parseFloat(data.darkHue) : null;
    const darkSat = data.darkSaturation !== '' && data.darkSaturation != null ? parseFloat(data.darkSaturation) : null;

    // Parse latitude and daylight overrides — mutually exclusive via checkbox
    const forceSolstice = data.forceSolstice;
    const latVal = data.latitude !== '' && data.latitude != null ? parseFloat(data.latitude) : null;
    const shortDayVal = data.shortestDay !== '' && data.shortestDay != null ? parseFloat(data.shortestDay) : null;
    const longDayVal = data.longestDay !== '' && data.longestDay != null ? parseFloat(data.longestDay) : null;

    const result = {
      description: data.description || '',
      brightnessMultiplier: parseFloat(data.brightnessMultiplier) || 1.0,
      latitude: forceSolstice ? null : latVal,
      shortestDay: forceSolstice ? shortDayVal : null,
      longestDay: forceSolstice ? longDayVal : null,
      environmentBase: baseHue !== null || baseSat !== null ? { hue: baseHue, saturation: baseSat } : null,
      environmentDark: darkHue !== null || darkSat !== null ? { hue: darkHue, saturation: darkSat } : null,
      temperatures: {},
      presets: {}
    };

    for (const season of seasonNames) {
      const minVal = parseInt(data[`temp_${season}_min`]) || 0;
      const maxVal = parseInt(data[`temp_${season}_max`]) || 20;
      result.temperatures[season] = { min: fromDisplayUnit(minVal), max: fromDisplayUnit(maxVal) };
    }

    for (const preset of allPresets) {
      const enabled = !!data[`preset_${preset.id}_enabled`];
      const chance = parseFloat(data[`preset_${preset.id}_chance`]) || 0;
      if (!enabled && !chance) continue;
      const pData = { id: preset.id, enabled, chance };
      const tMin = data[`preset_${preset.id}_tempMin`];
      const tMax = data[`preset_${preset.id}_tempMax`];
      if (tMin !== '' && tMin != null) pData.tempMin = fromDisplayUnit(parseInt(tMin));
      if (tMax !== '' && tMax != null) pData.tempMax = fromDisplayUnit(parseInt(tMax));
      result.presets[preset.id] = pData;
    }

    this.#onSave(result);
  }

  /**
   * Reset a preset alias back to default name.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Button element
   */
  static async #onResetAlias(_event, target) {
    const presetId = target.dataset.presetId;
    await setPresetAlias(presetId, null, this.#calendarId, this.#zoneKey);
    this.render();
  }

  /**
   * Open the ClimateEditor as a singleton per mode+key.
   * @param {object} options - Options for the editor
   * @returns {ClimateEditor} The editor instance
   */
  static open(options) {
    const key = options.mode === 'season' ? options.seasonKey : options.zoneKey;
    const appId = `climate-editor-${options.mode}-${key}`;
    const existing = foundry.applications.instances.get(appId);
    if (existing) {
      existing.bringToFront();
      return existing;
    }
    const editor = new ClimateEditor(options);
    editor.render({ force: true });
    return editor;
  }
}
