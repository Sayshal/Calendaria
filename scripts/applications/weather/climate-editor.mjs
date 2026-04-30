/**
 * Climate Editor Application — edits season or zone climate settings.
 * @module Applications/ClimateEditor
 * @author Tyler
 */

import { CalendarManager } from '../../calendar/_module.mjs';
import { COMPASS_DIRECTIONS, MODULE, SETTINGS, TEMPLATES, WIND_SPEEDS } from '../../constants.mjs';
import { CalendariaCalendar } from '../../data/_module.mjs';
import { format, localize } from '../../utils/_module.mjs';
import { ALL_PRESETS, WEATHER_CATEGORIES, fromDisplayDelta, fromDisplayUnit, getAllPresets, getPresetAlias, setPresetAlias, toDisplayDelta, toDisplayUnit } from '../../weather/_module.mjs';
import { WeatherProbabilityDialog } from '../_module.mjs';

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
    position: { width: 1100, height: 900 },
    form: { handler: ClimateEditor.#onSubmit, submitOnChange: true, closeOnSubmit: false },
    actions: { resetAlias: ClimateEditor.#onResetAlias, viewProbabilities: ClimateEditor.#onViewProbabilities }
  };

  /** @override */
  static PARTS = {
    form: { template: TEMPLATES.WEATHER.CLIMATE_EDITOR, scrollable: [''] },
    tabs: { template: TEMPLATES.WEATHER.CLIMATE_EDITOR_TABS },
    weather: { template: TEMPLATES.WEATHER.CLIMATE_EDITOR_WEATHER, scrollable: [''] },
    presets: { template: TEMPLATES.WEATHER.CLIMATE_EDITOR_PRESETS, scrollable: [''] },
    environment: { template: TEMPLATES.WEATHER.CLIMATE_EDITOR_ENVIRONMENT, scrollable: [''] }
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: 'weather', group: 'primary', icon: 'fas fa-cloud-sun', label: 'CALENDARIA.Common.Weather' },
        { id: 'presets', group: 'primary', icon: 'fas fa-sliders', label: 'CALENDARIA.PresetManager.Overrides' },
        { id: 'environment', group: 'primary', icon: 'fas fa-tree', label: 'CALENDARIA.ClimateEditor.Tab.Environment' }
      ],
      initial: 'weather'
    }
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

  /** @type {object|null} Pending aliases from import (used before calendar is saved) */
  #pendingAliases;

  /** @type {string[]} Season names for zone temperature rows */
  #seasonNames;

  /** @type {string} Currently selected season for zone preset overrides */
  #selectedSeason;

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
      id: `calendaria-climate-editor-${mode}-${key}`,
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
    this.#pendingAliases = options.pendingAliases ?? null;
    this.#seasonNames = options.seasonNames ?? [];
    this.#selectedSeason = this.#seasonNames[0] ?? null;
    this.#onSave = options.onSave;
  }

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if (this.#mode === 'zone') options.parts = ['tabs', 'weather', 'presets', 'environment'];
    else options.parts = ['form'];
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === 'weather' || partId === 'presets' || partId === 'environment') context.tab = context.tabs?.[partId];
    return context;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isZoneMode = this.#mode === 'zone';
    const tempUnit = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_UNIT) || 'celsius';
    const tempLabel = tempUnit === 'fahrenheit' ? '°F' : '°C';
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const allPresets = getAllPresets(customPresets);
    let tempMin = '';
    let tempMax = '';
    if (!isZoneMode) {
      const climate = this.#data.climate ?? {};
      if (climate.temperatures?.min != null) tempMin = toDisplayUnit(climate.temperatures.min);
      if (climate.temperatures?.max != null) tempMax = toDisplayUnit(climate.temperatures.max);
    }
    let temperatureRows = [];
    if (isZoneMode) {
      const seasonNames = this.#seasonNames.length ? this.#seasonNames : ['CALENDARIA.Season.Spring', 'CALENDARIA.Season.Summer', 'CALENDARIA.Season.Autumn', 'CALENDARIA.Season.Winter'];
      const aliasMap = this.#data.seasonAliases ?? {};
      const calendarSeasons = this.#calendarData?.seasons?.values ?? CalendarManager.getCalendar(this.#calendarId)?.seasons?.values ?? {};
      const parentByName = {};
      for (const s of Object.values(calendarSeasons)) if (s?.name) parentByName[s.name] = s;
      const DEFAULT_ALIAS_COLOR = '#888888';
      temperatureRows = seasonNames.map((season) => {
        const stored = this.#data.temperatures?.[season];
        const temp = stored !== undefined ? (stored ?? { min: null, max: null }) : (this.#data.temperatures?._default ?? { min: 10, max: 22 });
        const isRelativeMin = typeof temp.min === 'string' && /[+-]$/.test(temp.min);
        const isRelativeMax = typeof temp.max === 'string' && /[+-]$/.test(temp.max);
        const formatMin = temp.min == null ? '' : isRelativeMin ? `${toDisplayDelta(Number(temp.min.slice(0, -1)))}${temp.min.slice(-1)}` : toDisplayUnit(temp.min);
        const formatMax = temp.max == null ? '' : isRelativeMax ? `${toDisplayDelta(Number(temp.max.slice(0, -1)))}${temp.max.slice(-1)}` : toDisplayUnit(temp.max);
        const alias = aliasMap[season] ?? {};
        const parent = parentByName[season] ?? {};
        const parentColor = parent.color || DEFAULT_ALIAS_COLOR;
        const colorOverridden = !!(alias.color && alias.color !== parentColor);
        const hasAlias = !!(alias.name || alias.abbreviation || alias.icon || colorOverridden);
        return {
          seasonName: season,
          label: localize(season),
          min: formatMin,
          max: formatMax,
          isRelativeMin,
          isRelativeMax,
          aliasName: alias.name ?? '',
          aliasAbbr: alias.abbreviation ?? '',
          aliasIcon: alias.icon ?? '',
          aliasColor: alias.color || parentColor,
          parentColor,
          hasAlias
        };
      });
    }
    const selectedSeason = isZoneMode ? this.#selectedSeason : null;
    const seasonOptions = isZoneMode ? this.#seasonNames.map((name) => ({ value: name, label: localize(name), selected: name === selectedSeason })) : [];
    let selectedSeasonClimate = null;
    if (isZoneMode && selectedSeason) {
      const calendarSeasons = this.#calendarData?.seasons?.values ?? CalendarManager.getCalendar(this.#calendarId)?.seasons?.values ?? {};
      const seasonObj = Object.values(calendarSeasons).find((s) => s?.name === selectedSeason);
      selectedSeasonClimate = seasonObj?.climate ?? null;
    }
    const categories = Object.values(WEATHER_CATEGORIES)
      .map((cat) => {
        const categoryPresets = allPresets.filter((p) => p.category === cat.id);
        if (!categoryPresets.length) return null;
        const presets = categoryPresets.map((preset) => {
          if (isZoneMode) {
            const savedPresets = this.#data.presets ? Object.values(this.#data.presets) : [];
            const saved = savedPresets.find((s) => s.id === preset.id) || {};
            const alias = this.#pendingAliases?.[this.#data.id]?.[preset.id] || getPresetAlias(preset.id, this.#calendarId, this.#data.id) || '';
            const seasonPresets = selectedSeason ? (this.#data.seasonOverrides?.[selectedSeason]?.presets ?? {}) : {};
            const seasonOverride = seasonPresets[preset.id] ?? {};
            const seasonChance = seasonOverride.chance;
            const seasonChanceDisplay = seasonChance != null ? String(seasonChance) : '';
            const isRelativeChance = typeof seasonChance === 'string' && /[+-]$/.test(seasonChance);
            const effectiveEnabled = seasonOverride.enabled ?? saved.enabled ?? false;
            const baseChance = Object.values(selectedSeasonClimate?.presets ?? {}).find((p) => p?.id === preset.id)?.chance;
            const effectiveChance = ClimateEditor.#resolveEffectiveChance(baseChance, seasonChance);
            const effectiveTempMin = seasonOverride.tempMin ?? saved.tempMin;
            const effectiveTempMax = seasonOverride.tempMax ?? saved.tempMax;
            const effectiveInertia = seasonOverride.inertiaWeight ?? saved.inertiaWeight;
            return {
              id: preset.id,
              icon: preset.icon,
              color: preset.color,
              label: localize(preset.label),
              alias,
              hasAlias: !!alias,
              enabled: effectiveEnabled,
              enabledNoWeight: effectiveEnabled && !(effectiveChance > 0),
              seasonChance: seasonChanceDisplay,
              isRelativeChance,
              tempMin: ClimateEditor.#formatTempValue(effectiveTempMin),
              tempMax: ClimateEditor.#formatTempValue(effectiveTempMax),
              defaultTempMin: preset.tempMin != null ? String(toDisplayUnit(preset.tempMin)) : '',
              defaultTempMax: preset.tempMax != null ? String(toDisplayUnit(preset.tempMax)) : '',
              isRelativeTempMin: typeof effectiveTempMin === 'string' && /[+-]$/.test(effectiveTempMin),
              isRelativeTempMax: typeof effectiveTempMax === 'string' && /[+-]$/.test(effectiveTempMax),
              inertiaWeight: effectiveInertia ?? '',
              defaultInertiaWeight: preset.inertiaWeight ?? 1
            };
          }
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
    let latitude = this.#data.latitude ?? null;
    let shortestDayHours = '';
    let longestDayHours = '';
    let hoursPerDay = 24;
    let zoneShortestDay = this.#data.shortestDay ?? '';
    let zoneLongestDay = this.#data.longestDay ?? '';
    let zoneSunriseOverride = this.#data.sunriseOverride ?? '';
    let zoneSunsetOverride = this.#data.sunsetOverride ?? '';
    let defaultShortestDay = '';
    let defaultLongestDay = '';
    const lockSunTimes = zoneSunriseOverride !== '' && zoneSunsetOverride !== '';
    const hasManualDaylight = zoneShortestDay !== '' || zoneLongestDay !== '' || lockSunTimes;
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
      if (lockSunTimes) {
        const fixedHours = parseFloat(zoneSunsetOverride) - parseFloat(zoneSunriseOverride);
        shortestDayHours = `${fixedHours.toFixed(1)}h`;
        longestDayHours = `${fixedHours.toFixed(1)}h`;
      } else if (hasManualDaylight) {
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
    let colorShift = {};
    if (isZoneMode) {
      colorShift = {
        dawnHue: this.#data.colorShift?.dawnHue ?? '',
        duskHue: this.#data.colorShift?.duskHue ?? '',
        nightHue: this.#data.colorShift?.nightHue ?? '',
        dawnHueNorm: ClimateEditor.#hueToNorm(this.#data.colorShift?.dawnHue),
        duskHueNorm: ClimateEditor.#hueToNorm(this.#data.colorShift?.duskHue),
        nightHueNorm: ClimateEditor.#hueToNorm(this.#data.colorShift?.nightHue),
        transitionMinutes: this.#data.colorShift?.transitionMinutes ?? ''
      };
    }
    let windDirections = [];
    let windSpeedMin = null;
    let windSpeedMax = null;
    if (isZoneMode) {
      const dirWeights = this.#data.windDirections ?? {};
      windDirections = Object.entries(COMPASS_DIRECTIONS).map(([id]) => ({ id, label: game.i18n.localize(`CALENDARIA.Wind.${id}`), weight: dirWeights[id] ?? '' }));
      windSpeedMin = this.#data.windSpeedRange?.min ?? null;
      windSpeedMax = this.#data.windSpeedRange?.max ?? null;
    }
    return {
      ...context,
      isZoneMode,
      seasonOptions,
      selectedSeason,
      tempLabel,
      tempMin,
      tempMax,
      temperatureRows,
      categories,
      description: this.#data.description ?? '',
      brightnessMultiplier: this.#data.brightnessMultiplier ?? 1.0,
      envBase: { ...(this.#data.environmentBase ?? {}), hueNorm: this.#data.environmentBase ? ClimateEditor.#hueToNorm(this.#data.environmentBase.hue) : '' },
      envDark: { ...(this.#data.environmentDark ?? {}), hueNorm: this.#data.environmentDark ? ClimateEditor.#hueToNorm(this.#data.environmentDark.hue) : '' },
      zoneKey: this.#zoneKey,
      zoneId: this.#data.id,
      latitude: latitude ?? '',
      hasManualDaylight,
      lockSunTimes,
      hoursPerDay,
      zoneShortestDay,
      zoneLongestDay,
      zoneSunriseOverride,
      zoneSunsetOverride,
      defaultShortestDay,
      defaultLongestDay,
      shortestDayHours,
      longestDayHours,
      shortestDayDate,
      longestDayDate,
      colorShift,
      windDirections,
      windSpeedMin,
      windSpeedMax,
      windSpeedMinOptions: Object.values(WIND_SPEEDS).map((w) => ({ value: w.value, label: localize(w.label), selected: w.value === windSpeedMin })),
      windSpeedMaxOptions: Object.values(WIND_SPEEDS).map((w) => ({ value: w.value, label: localize(w.label), selected: w.value === windSpeedMax }))
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const slider = this.element.querySelector('[name="brightnessMultiplier"]');
    if (slider) {
      const label = this.element.querySelector('.range-value');
      slider.addEventListener('input', () => {
        label.textContent = `${slider.value}x`;
      });
    }
    const forceCheckbox = this.element.querySelector('[name="forceSolstice"]');
    const lockCheckbox = this.element.querySelector('[name="lockSunTimes"]');
    const latGroup = this.element.querySelector('.daylight-latitude');
    const manualGroups = this.element.querySelectorAll('.daylight-manual');
    const hoursGroups = this.element.querySelectorAll('.daylight-hours');
    const fixedGroups = this.element.querySelectorAll('.daylight-fixed');
    const updateDaylightVisibility = () => {
      const manual = forceCheckbox?.checked ?? false;
      const lockTimes = lockCheckbox?.checked ?? false;
      if (latGroup) latGroup.hidden = manual;
      manualGroups.forEach((g) => (g.hidden = !manual));
      if (manual) {
        hoursGroups.forEach((g) => (g.hidden = lockTimes));
        fixedGroups.forEach((g) => (g.hidden = !lockTimes));
      }
    };
    forceCheckbox?.addEventListener('change', updateDaylightVisibility);
    lockCheckbox?.addEventListener('change', updateDaylightVisibility);
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
    const seasonSelect = this.element.querySelector('.season-override-select');
    if (seasonSelect) {
      seasonSelect.addEventListener('change', () => {
        this.#snapshotSeasonPresets();
        this.#selectedSeason = seasonSelect.value;
        this.render({ parts: ['presets'] });
      });
    }
    for (const input of this.element.querySelectorAll('.form-fields.temperature input[type="text"], .preset-temp-input')) {
      input.addEventListener('input', () => {
        input.classList.toggle('modifier-relative', /^\d+(\.\d+)?[+-]$/.test(input.value.trim()));
      });
    }
    for (const input of this.element.querySelectorAll('.preset-season-chance')) {
      input.addEventListener('input', () => {
        input.classList.toggle('modifier-relative', /^\d+(\.\d+)?[+-]$/.test(input.value.trim()));
        const row = input.closest('.preset-row');
        const enabled = row?.querySelector('input[type="checkbox"]')?.checked;
        input.classList.toggle('zero-weight-warning', !!enabled && !input.value.trim());
      });
    }
    for (const checkbox of this.element.querySelectorAll('.preset-row input[type="checkbox"]')) {
      checkbox.addEventListener('change', () => {
        const row = checkbox.closest('.preset-row');
        const chanceInput = row?.querySelector('.preset-season-chance');
        if (chanceInput) chanceInput.classList.toggle('zero-weight-warning', checkbox.checked && !chanceInput.value.trim());
      });
    }
    for (const button of this.element.querySelectorAll('.season-alias-toggle')) {
      button.addEventListener('click', () => {
        const season = button.dataset.season;
        const row = this.element.querySelector(`.season-alias-row[data-season="${CSS.escape(season)}"]`);
        if (row) row.hidden = !row.hidden;
      });
    }
    for (const button of this.element.querySelectorAll('.season-alias-clear')) {
      button.addEventListener('click', () => {
        const season = button.dataset.season;
        const parentColor = button.dataset.parentColor || '#888888';
        const row = this.element.querySelector(`.season-alias-row[data-season="${CSS.escape(season)}"]`);
        if (!row) return;
        for (const field of ['name', 'abbreviation', 'icon']) {
          const input = row.querySelector(`[name="alias_${season}_${field}"]`);
          if (input) input.value = '';
        }
        const colorEl = row.querySelector(`[name="alias_${season}_color"]`);
        if (colorEl) {
          colorEl.value = parentColor;
          const inner = colorEl.querySelector('input[type="color"], input[type="text"]');
          if (inner) inner.value = parentColor;
        }
        const tempRow = this.element.querySelector(`.season-temp-row[data-season="${CSS.escape(season)}"] .season-alias-toggle`);
        tempRow?.classList.remove('has-alias');
        this.element.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
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
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const allPresets = getAllPresets(customPresets);
    const seasonNames = this.#seasonNames.length ? this.#seasonNames : ['CALENDARIA.Season.Spring', 'CALENDARIA.Season.Summer', 'CALENDARIA.Season.Autumn', 'CALENDARIA.Season.Winter'];
    const baseHue = ClimateEditor.#normToHue(data.baseHue);
    const baseSat = data.baseSaturation !== '' && data.baseSaturation != null ? parseFloat(data.baseSaturation) : null;
    const darkHue = ClimateEditor.#normToHue(data.darkHue);
    const darkSat = data.darkSaturation !== '' && data.darkSaturation != null ? parseFloat(data.darkSaturation) : null;
    const forceSolstice = data.forceSolstice;
    const lockSunTimes = !!data.lockSunTimes;
    const latVal = data.latitude !== '' && data.latitude != null ? parseFloat(data.latitude) : null;
    const shortDayVal = data.shortestDay !== '' && data.shortestDay != null ? parseFloat(data.shortestDay) : null;
    const longDayVal = data.longestDay !== '' && data.longestDay != null ? parseFloat(data.longestDay) : null;
    const sunriseVal = data.sunriseOverride !== '' && data.sunriseOverride != null ? parseFloat(data.sunriseOverride) : null;
    const sunsetVal = data.sunsetOverride !== '' && data.sunsetOverride != null ? parseFloat(data.sunsetOverride) : null;
    const useSunOverride = forceSolstice && lockSunTimes && sunriseVal != null && sunsetVal != null && sunriseVal < sunsetVal;
    const result = {
      description: data.description || '',
      brightnessMultiplier: parseFloat(data.brightnessMultiplier) || 1.0,
      latitude: forceSolstice ? null : latVal,
      shortestDay: forceSolstice && !useSunOverride ? shortDayVal : null,
      longestDay: forceSolstice && !useSunOverride ? longDayVal : null,
      sunriseOverride: useSunOverride ? sunriseVal : null,
      sunsetOverride: useSunOverride ? sunsetVal : null,
      environmentBase: baseHue !== null || baseSat !== null ? { hue: baseHue, saturation: baseSat } : null,
      environmentDark: darkHue !== null || darkSat !== null ? { hue: darkHue, saturation: darkSat } : null,
      temperatures: {},
      presets: {}
    };
    for (const season of seasonNames) {
      const minRaw = String(data[`temp_${season}_min`] ?? '').trim();
      const maxRaw = String(data[`temp_${season}_max`] ?? '').trim();
      const min = minRaw ? ClimateEditor.#parseTempInput(minRaw, null) : null;
      const max = maxRaw ? ClimateEditor.#parseTempInput(maxRaw, null) : null;
      result.temperatures[season] = min == null && max == null ? null : { min, max };
    }
    const seasonOverrides = foundry.utils.deepClone(this.#data.seasonOverrides ?? {});
    for (const season of seasonNames) {
      if (!seasonOverrides[season]) continue;
      seasonOverrides[season].temperatures = result.temperatures[season] ? { ...result.temperatures[season] } : null;
    }
    const selectedSeason = this.element?.querySelector('[data-rendered-season]')?.dataset.renderedSeason || this.#selectedSeason;
    if (selectedSeason) {
      if (!seasonOverrides[selectedSeason]) seasonOverrides[selectedSeason] = {};
      const seasonPresets = {};
      for (const preset of allPresets) {
        const pData = { id: preset.id };
        pData.enabled = !!data[`preset_${preset.id}_enabled`];
        const raw = String(data[`preset_${preset.id}_seasonChance`] ?? '').trim();
        if (raw) {
          if (/^\d+(\.\d+)?[+-]$/.test(raw)) {
            pData.chance = raw;
          } else {
            const num = parseFloat(raw);
            if (Number.isFinite(num)) pData.chance = num;
          }
        }
        const tMinRaw = String(data[`preset_${preset.id}_tempMin`] ?? '').trim();
        const tMaxRaw = String(data[`preset_${preset.id}_tempMax`] ?? '').trim();
        if (tMinRaw) pData.tempMin = ClimateEditor.#parseTempInput(tMinRaw, null);
        if (tMaxRaw) pData.tempMax = ClimateEditor.#parseTempInput(tMaxRaw, null);
        const iwRaw = data[`preset_${preset.id}_inertiaWeight`];
        if (iwRaw !== '' && iwRaw != null) pData.inertiaWeight = parseFloat(iwRaw);
        seasonPresets[preset.id] = pData;
      }
      seasonOverrides[selectedSeason].presets = seasonPresets;
    }
    result.seasonOverrides = seasonOverrides;
    this.#data.seasonOverrides = seasonOverrides;
    for (const preset of allPresets) {
      const existing = this.#data.presets?.[preset.id] ?? Object.values(this.#data.presets ?? {}).find((p) => p.id === preset.id);
      result.presets[preset.id] = existing ? { ...existing } : { id: preset.id, enabled: false };
    }
    this.#data.presets = result.presets;
    const colorShiftResult = {};
    const csHueFields = ['dawnHue', 'duskHue', 'nightHue'];
    for (const field of csHueFields) {
      const key = `colorShift${field.charAt(0).toUpperCase()}${field.slice(1)}`;
      colorShiftResult[field] = ClimateEditor.#normToHue(data[key]);
    }
    const tmVal = data.colorShiftTransitionMinutes;
    colorShiftResult.transitionMinutes = tmVal !== '' && tmVal != null ? parseFloat(tmVal) : null;
    result.colorShift = colorShiftResult;
    const seasonAliases = {};
    const calendarSeasons = this.#calendarData?.seasons?.values ?? CalendarManager.getCalendar(this.#calendarId)?.seasons?.values ?? {};
    const parentColorByName = {};
    for (const s of Object.values(calendarSeasons)) if (s?.name) parentColorByName[s.name] = s.color || '#888888';
    for (const season of seasonNames) {
      const aliasName = String(data[`alias_${season}_name`] ?? '').trim();
      const aliasAbbr = String(data[`alias_${season}_abbreviation`] ?? '').trim();
      const aliasIcon = String(data[`alias_${season}_icon`] ?? '').trim();
      const rawColor = String(data[`alias_${season}_color`] ?? '').trim();
      const parentColor = parentColorByName[season] || '#888888';
      const aliasColor = rawColor && rawColor.toLowerCase() !== parentColor.toLowerCase() ? rawColor : '';
      if (aliasName || aliasAbbr || aliasIcon || aliasColor) seasonAliases[season] = { name: aliasName, abbreviation: aliasAbbr, icon: aliasIcon, color: aliasColor };
    }
    result.seasonAliases = seasonAliases;
    const windDirections = {};
    for (const dir of Object.keys(COMPASS_DIRECTIONS)) {
      const val = parseInt(data[`wind_${dir}`]);
      if (val > 0) windDirections[dir] = val;
    }
    result.windDirections = windDirections;
    const wsMin = data.windSpeedMin;
    const wsMax = data.windSpeedMax;
    result.windSpeedRange = { min: wsMin !== '' && wsMin != null ? parseInt(wsMin) : null, max: wsMax !== '' && wsMax != null ? parseInt(wsMax) : null };
    this.#onSave(result);
  }

  /**
   * Reset a preset alias back to default name.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Button element
   */
  static async #onResetAlias(_event, target) {
    const presetId = target.dataset.presetId;
    await setPresetAlias(presetId, null, this.#calendarId, this.#data.id);
    this.render();
  }

  /**
   * Open the Weather Probability dialog using the editor's in-progress data.
   * @this {ClimateEditor}
   */
  static #onViewProbabilities() {
    const calendar = this.#calendarData ?? CalendarManager.getCalendar(this.#calendarId) ?? CalendarManager.getActiveCalendar();
    const seasons = calendar?.seasonsArray ?? Object.values(calendar?.seasons?.values ?? {});
    WeatherProbabilityDialog.open({
      zoneConfig: this.#data,
      calendarId: this.#calendarId,
      seasons,
      editorMode: true
    });
  }

  /**
   * Format a stored temperature value for display.
   * @param {number|string|null} value - Stored temperature value
   * @returns {string} Display value
   */
  static #formatTempValue(value) {
    if (value == null) return '';
    const str = String(value);
    if (/[+-]$/.test(str)) return `${toDisplayDelta(Number(str.slice(0, -1)))}${str.slice(-1)}`;
    return String(toDisplayUnit(Number(str)));
  }

  /**
   * Snapshot the currently rendered season's preset data from the DOM into #data.seasonOverrides.
   */
  #snapshotSeasonPresets() {
    const renderedSeason = this.element?.querySelector('[data-rendered-season]')?.dataset.renderedSeason;
    if (!renderedSeason) return;
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const allPresets = getAllPresets(customPresets);
    if (!this.#data.seasonOverrides) this.#data.seasonOverrides = {};
    if (!this.#data.seasonOverrides[renderedSeason]) this.#data.seasonOverrides[renderedSeason] = {};
    const seasonPresets = {};
    for (const preset of allPresets) {
      const pData = { id: preset.id };
      const row = this.element.querySelector(`.preset-row[data-preset-id="${preset.id}"]`);
      if (!row) continue;
      pData.enabled = !!row.querySelector(`[name="preset_${preset.id}_enabled"]`)?.checked;
      const raw = (row.querySelector(`[name="preset_${preset.id}_seasonChance"]`)?.value ?? '').trim();
      if (raw) {
        if (/^\d+(\.\d+)?[+-]$/.test(raw)) pData.chance = raw;
        else {
          const num = parseFloat(raw);
          if (Number.isFinite(num)) pData.chance = num;
        }
      }
      const tMinRaw = (row.querySelector(`[name="preset_${preset.id}_tempMin"]`)?.value ?? '').trim();
      const tMaxRaw = (row.querySelector(`[name="preset_${preset.id}_tempMax"]`)?.value ?? '').trim();
      if (tMinRaw) pData.tempMin = ClimateEditor.#parseTempInput(tMinRaw, null);
      if (tMaxRaw) pData.tempMax = ClimateEditor.#parseTempInput(tMaxRaw, null);
      const iwRaw = row.querySelector(`[name="preset_${preset.id}_inertiaWeight"]`)?.value ?? '';
      if (iwRaw !== '') pData.inertiaWeight = parseFloat(iwRaw);
      seasonPresets[preset.id] = pData;
    }
    this.#data.seasonOverrides[renderedSeason].presets = seasonPresets;
  }

  /**
   * Parse a temperature input value, preserving +/- relative modifiers as strings.
   * @param {string} raw - Raw input value
   * @param {number} fallback - Fallback value if input is empty/invalid
   * @returns {number|string} Celsius value (number) or "+N"/"-N" modifier (string)
   */
  static #parseTempInput(raw, fallback) {
    if (!raw && raw !== '0') return fallback != null ? fromDisplayUnit(fallback) : null;
    if (/^\d+(\.\d+)?[+-]$/.test(raw)) {
      const suffix = raw.slice(-1);
      const delta = fromDisplayDelta(Number(raw.slice(0, -1)));
      return `${delta}${suffix}`;
    }
    const num = parseFloat(raw);
    return isNaN(num) ? (fallback != null ? fromDisplayUnit(fallback) : null) : fromDisplayUnit(num);
  }

  /**
   * Resolve the effective preset chance for a zone-season cell.
   * @param {number|undefined} baseChance - Season climate chance for this preset
   * @param {number|string|null|undefined} zoneChance - Zone override value
   * @returns {number} Effective chance (0 if disabled or unresolvable)
   */
  static #resolveEffectiveChance(baseChance, zoneChance) {
    if (zoneChance == null || zoneChance === '') return baseChance ?? 0;
    if (typeof zoneChance === 'string' && /[+-]$/.test(zoneChance)) {
      const suffix = zoneChance.slice(-1);
      const value = Number(zoneChance.slice(0, -1));
      if (isNaN(value)) return baseChance ?? 0;
      const delta = suffix === '+' ? value : -value;
      return Math.max(0, (baseChance ?? 0) + delta);
    }
    const num = Number(zoneChance);
    if (!Number.isFinite(num)) return baseChance ?? 0;
    return Math.max(0, num);
  }

  /**
   * Convert a 0-360 degree hue to 0-1 normalized for hue-slider.
   * @param {number|null} hue - Hue in degrees (0-360)
   * @returns {number} Normalized hue (0-1)
   */
  static #hueToNorm(hue) {
    return hue != null ? hue / 360 : 0;
  }

  /**
   * Convert a 0-1 normalized hue-slider value back to 0-360 degrees.
   * @param {number|string|null} val - Normalized hue value (0-1)
   * @returns {number|null} Hue in degrees (0-360)
   */
  static #normToHue(val) {
    if (val === '' || val == null) return null;
    const num = parseFloat(val);
    return Number.isFinite(num) ? Math.round(num * 360) : null;
  }

  /**
   * Open the ClimateEditor as a singleton per mode+key.
   * @param {object} options - Options for the editor
   * @returns {ClimateEditor} The editor instance
   */
  static open(options) {
    const key = options.mode === 'season' ? options.seasonKey : options.zoneKey;
    const appId = `calendaria-climate-editor-${options.mode}-${key}`;
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
