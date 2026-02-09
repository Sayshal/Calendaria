/**
 * Computed Event Builder Application
 * Step-by-step UI for building moveable feast computation chains.
 * @module Applications/ComputedEventBuilder
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { localize } from '../utils/localization.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * UI builder for computed (moveable feast) events.
 * @extends ApplicationV2
 */
export class ComputedEventBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {object} Current config being built */
  #config = { chain: [], yearOverrides: {} };

  /** @type {Function} Callback when config changes */
  #onChange = null;

  /**
   * @param {object} options - Application options
   * @param {object} [options.config] - Initial computed config
   * @param {Function} [options.onChange] - Callback when config changes
   */
  constructor(options = {}) {
    super(options);
    if (options.config) this.#config = foundry.utils.deepClone(options.config);
    if (options.onChange) this.#onChange = options.onChange;
  }

  static DEFAULT_OPTIONS = {
    id: 'computed-event-builder',
    classes: ['calendaria', 'computed-event-builder'],
    tag: 'form',
    window: { title: 'CALENDARIA.Note.Computed', icon: 'fas fa-calculator', resizable: true },
    position: { width: 500, height: 'auto' },
    actions: {
      addStep: ComputedEventBuilder.#onAddStep,
      removeStep: ComputedEventBuilder.#onRemoveStep,
      addOverride: ComputedEventBuilder.#onAddOverride,
      removeOverride: ComputedEventBuilder.#onRemoveOverride,
      save: ComputedEventBuilder.#onSave
    }
  };

  static PARTS = {
    form: { template: 'modules/calendaria/templates/applications/computed-event-builder.hbs' }
  };

  /** @override */
  async _prepareContext() {
    const calendar = CalendarManager.getActiveCalendar();
    const moons = calendar?.moonsArray ?? [];
    const weekdays = calendar?.weekdaysArray ?? [];
    const seasons = calendar?.seasonsArray ?? [];

    const anchorTypes = [
      { value: 'springEquinox', label: localize('CALENDARIA.Recurrence.SpringEquinox') },
      { value: 'summerSolstice', label: localize('CALENDARIA.Recurrence.SummerSolstice') },
      { value: 'autumnEquinox', label: localize('CALENDARIA.Recurrence.AutumnEquinox') },
      { value: 'winterSolstice', label: localize('CALENDARIA.Recurrence.WinterSolstice') }
    ];
    seasons.forEach((s, i) => {
      anchorTypes.push({ value: `seasonStart:${i}`, label: `${localize(s.name)} Start` });
      anchorTypes.push({ value: `seasonEnd:${i}`, label: `${localize(s.name)} End` });
    });

    const stepTypes = [
      { value: 'anchor', label: localize('CALENDARIA.Note.ComputedAnchor') },
      { value: 'firstAfter', label: localize('CALENDARIA.Note.ComputedFirstAfter') },
      { value: 'daysAfter', label: localize('CALENDARIA.Note.ComputedDaysAfter') },
      { value: 'weekdayOnOrAfter', label: localize('CALENDARIA.Note.ComputedWeekdayOnOrAfter') }
    ];

    const conditionTypes = [
      { value: 'moonPhase', label: localize('CALENDARIA.Note.ComputedMoonPhase') },
      { value: 'weekday', label: localize('CALENDARIA.Note.ComputedWeekday') }
    ];

    const moonPhases = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'];

    const chain = this.#config.chain.map((step, idx) => ({
      ...step,
      index: idx,
      isFirst: idx === 0,
      isAnchor: step.type === 'anchor',
      isFirstAfter: step.type === 'firstAfter',
      isDaysAfter: step.type === 'daysAfter',
      isWeekdayOnOrAfter: step.type === 'weekdayOnOrAfter',
      isMoonPhase: step.condition === 'moonPhase',
      isWeekdayCondition: step.condition === 'weekday'
    }));

    const overrides = Object.entries(this.#config.yearOverrides || {}).map(([year, date]) => ({
      year: parseInt(year, 10),
      month: date.month,
      day: date.day
    }));

    return {
      chain,
      overrides,
      anchorTypes,
      stepTypes,
      conditionTypes,
      moonPhases,
      moons: moons.map((m, i) => ({ index: i, name: localize(m.name) })),
      weekdays: weekdays.map((d, i) => ({ index: i, name: localize(d.name) })),
      months: (calendar?.monthsArray ?? []).map((m, i) => ({ index: i, name: localize(m.name) })),
      hasChain: chain.length > 0,
      hasOverrides: overrides.length > 0,
      helpText: localize('CALENDARIA.Note.ComputedHelp')
    };
  }

  /**
   * Add a new step to the chain.
   * @param {Event} _event - Click event (unused)
   * @param {HTMLElement} _target - Target element (unused)
   */
  static async #onAddStep(_event, _target) {
    const isFirst = this.#config.chain.length === 0;
    const step = isFirst ? { type: 'anchor', value: 'springEquinox' } : { type: 'firstAfter', condition: 'weekday', params: { weekday: 0 } };
    this.#config.chain.push(step);
    this.render();
    this.#notifyChange();
  }

  /**
   * Remove a step from the chain.
   * @param {Event} _event - Click event (unused)
   * @param {HTMLElement} target - Target element with step index
   */
  static async #onRemoveStep(_event, target) {
    const idx = parseInt(target.dataset.index, 10);
    this.#config.chain.splice(idx, 1);
    this.render();
    this.#notifyChange();
  }

  /**
   * Add a year override.
   * @param {Event} _event - Click event (unused)
   * @param {HTMLElement} _target - Target element (unused)
   */
  static async #onAddOverride(_event, _target) {
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const currentYear = (game.time?.components?.year ?? 0) + yearZero;
    if (!this.#config.yearOverrides) this.#config.yearOverrides = {};
    if (!this.#config.yearOverrides[currentYear]) this.#config.yearOverrides[currentYear] = { month: 0, day: 1 };
    this.render();
    this.#notifyChange();
  }

  /**
   * Remove a year override.
   * @param {Event} _event - Click event (unused)
   * @param {HTMLElement} target - Target element with year data
   */
  static async #onRemoveOverride(_event, target) {
    const year = target.dataset.year;
    delete this.#config.yearOverrides[year];
    this.render();
    this.#notifyChange();
  }

  /**
   * Save and close the builder.
   * @param {Event} _event - Click event (unused)
   * @param {HTMLElement} _target - Target element (unused)
   */
  static async #onSave(_event, _target) {
    this.#notifyChange();
    this.close();
  }

  /** @override */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    const target = event.target;
    const name = target.name;

    if (name.startsWith('chain.')) {
      const [, idxStr, field, subfield] = name.split('.');
      const idx = parseInt(idxStr, 10);
      const step = this.#config.chain[idx];
      if (!step) return;

      if (field === 'type') {
        step.type = target.value;
        if (step.type === 'anchor') {
          step.value = step.value || 'springEquinox';
          delete step.condition;
          delete step.params;
        } else if (step.type === 'firstAfter') {
          step.condition = step.condition || 'weekday';
          step.params = step.params || { weekday: 0 };
          delete step.value;
        } else if (step.type === 'daysAfter') {
          step.params = step.params || { days: 0 };
          delete step.value;
          delete step.condition;
        } else if (step.type === 'weekdayOnOrAfter') {
          step.params = step.params || { weekday: 0 };
          delete step.value;
          delete step.condition;
        }
        this.render();
      } else if (field === 'value') {
        step.value = target.value;
      } else if (field === 'condition') {
        step.condition = target.value;
        if (step.condition === 'moonPhase') step.params = { moon: 0, phase: 'full' };
        else if (step.condition === 'weekday') step.params = { weekday: 0 };
        this.render();
      } else if (field === 'params') {
        step.params = step.params || {};
        if (subfield === 'days') step.params.days = parseInt(target.value, 10) || 0;
        else if (subfield === 'weekday') step.params.weekday = parseInt(target.value, 10) || 0;
        else if (subfield === 'moon') step.params.moon = parseInt(target.value, 10) || 0;
        else if (subfield === 'phase') step.params.phase = target.value;
      }
    } else if (name.startsWith('override.')) {
      const [, yearStr, field] = name.split('.');
      if (!this.#config.yearOverrides[yearStr]) this.#config.yearOverrides[yearStr] = { month: 0, day: 1 };
      if (field === 'month') this.#config.yearOverrides[yearStr].month = parseInt(target.value, 10) || 0;
      else if (field === 'day') this.#config.yearOverrides[yearStr].day = parseInt(target.value, 10) || 1;
    }

    this.#notifyChange();
  }

  /**
   * Notify listener of config changes.
   */
  #notifyChange() {
    if (this.#onChange) this.#onChange(foundry.utils.deepClone(this.#config));
  }

  /**
   * Get the current config.
   * @returns {object} Computed config
   */
  getConfig() {
    return foundry.utils.deepClone(this.#config);
  }
}
