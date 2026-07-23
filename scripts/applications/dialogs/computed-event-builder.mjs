import { CalendarManager } from '../../calendar/_module.mjs';
import { MOON_PHASE_LABELS, TEMPLATES } from '../../constants.mjs';
import { NoteManager, resolveComputedDate } from '../../notes/_module.mjs';

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
    if (options.config) {
      this.#config = foundry.utils.deepClone(options.config);
      for (const override of Object.values(this.#config.yearOverrides ?? {})) {
        if (!override) continue;
        if (override.day == null && override.dayOfMonth != null) override.day = override.dayOfMonth + 1;
        delete override.dayOfMonth;
      }
    }
    if (options.onChange) this.#onChange = options.onChange;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-computed-event-builder',
    classes: ['calendaria', 'condition-builder', 'computed-event-builder'],
    tag: 'form',
    window: { title: 'CALENDARIA.Common.ComputedEvent', icon: 'fas fa-calculator', resizable: true },
    position: { width: 'auto', height: 'auto' },
    actions: {
      addStep: ComputedEventBuilder.#onAddStep,
      removeStep: ComputedEventBuilder.#onRemoveStep,
      addOverride: ComputedEventBuilder.#onAddOverride,
      removeOverride: ComputedEventBuilder.#onRemoveOverride,
      save: ComputedEventBuilder.#onSave
    }
  };

  /** @override */
  static PARTS = { form: { template: TEMPLATES.DIALOGS.COMPUTED_EVENT_BUILDER, scrollable: ['.cb-content'] }, footer: { template: TEMPLATES.FORM_FOOTER } };

  /** @override */
  async _prepareContext() {
    const calendar = CalendarManager.getActiveCalendar();
    const moons = calendar?.moonsArray ?? [];
    const weekdays = calendar?.weekdaysArray ?? [];
    const seasons = calendar?.seasonsArray ?? [];
    const anchorTypes = [
      { value: 'springEquinox', label: _loc('CALENDARIA.Recurrence.SpringEquinox') },
      { value: 'summerSolstice', label: _loc('CALENDARIA.Recurrence.SummerSolstice') },
      { value: 'autumnEquinox', label: _loc('CALENDARIA.Recurrence.AutumnEquinox') },
      { value: 'winterSolstice', label: _loc('CALENDARIA.Recurrence.WinterSolstice') }
    ];
    seasons.forEach((s, i) => {
      anchorTypes.push({ value: `seasonStart:${i}`, label: `${_loc(s.name)} Start` });
      anchorTypes.push({ value: `seasonEnd:${i}`, label: `${_loc(s.name)} End` });
    });
    anchorTypes.push({ value: 'date', label: _loc('CALENDARIA.Note.ComputedFixedDate') });
    for (const stub of NoteManager.getAllNotes?.() ?? []) {
      anchorTypes.push({ value: `event:${stub.id}`, label: _loc('CALENDARIA.Note.ComputedEventAnchor', { name: stub.name }) });
    }
    const stepTypes = [
      { value: 'anchor', label: _loc('CALENDARIA.Note.ComputedAnchor') },
      { value: 'firstAfter', label: _loc('CALENDARIA.Note.ComputedFirstAfter') },
      { value: 'daysAfter', label: _loc('CALENDARIA.Note.ComputedDaysAfter') },
      { value: 'weekdayOnOrAfter', label: _loc('CALENDARIA.Note.ComputedWeekdayOnOrAfter') }
    ];
    const conditionTypes = [
      { value: 'moonPhase', label: _loc('CALENDARIA.Common.MoonPhase') },
      { value: 'weekday', label: _loc('CALENDARIA.Common.Weekday') }
    ];
    const phaseValues = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'];
    const moonPhases = phaseValues.map((value, i) => ({ value, label: _loc(MOON_PHASE_LABELS[i]) }));
    const chain = this.#config.chain.map((step, idx) => {
      const isDateAnchor = step.type === 'anchor' && String(step.value).startsWith('date:');
      const [, dateMonth = 0, dateDay = 0] = isDateAnchor ? step.value.split(':').map(Number) : [];
      return {
        ...step,
        value: isDateAnchor ? 'date' : step.value,
        index: idx,
        num: idx + 1,
        isFirst: idx === 0,
        isAnchor: step.type === 'anchor',
        isDateAnchor,
        dateAnchorMonth: dateMonth,
        dateAnchorDay: dateDay + 1,
        isFirstAfter: step.type === 'firstAfter',
        isDaysAfter: step.type === 'daysAfter',
        isWeekdayOnOrAfter: step.type === 'weekdayOnOrAfter',
        isMoonPhase: step.condition === 'moonPhase',
        isWeekdayCondition: step.condition === 'weekday'
      };
    });
    const yearZero = calendar?.years?.yearZero ?? 0;
    const previewStart = (game.time?.components?.year ?? 0) + yearZero;
    const monthsArr = calendar?.monthsArray ?? [];
    const preview = [];
    if (this.#config.chain.length) {
      const cfg = { chain: this.#config.chain, yearOverrides: this.#config.yearOverrides };
      for (let y = previewStart; y < previewStart + 3; y++) {
        const resolved = resolveComputedDate(cfg, y);
        preview.push({ year: y, failed: !resolved, label: resolved ? `${resolved.dayOfMonth + 1} ${_loc(monthsArr[resolved.month]?.name ?? '')}` : _loc('CALENDARIA.Note.ComputedPreviewNone') });
      }
    }
    const overrides = Object.entries(this.#config.yearOverrides || {}).map(([year, date]) => ({ year: parseInt(year, 10), month: date.month, day: date.day }));
    return {
      chain,
      preview,
      overrides,
      anchorTypes,
      stepTypes,
      conditionTypes,
      moonPhases,
      moons: moons.map((m, i) => ({ index: i, name: _loc(m.name) })),
      weekdays: weekdays.map((d, i) => ({ index: i, name: _loc(d.name) })),
      months: (calendar?.monthsArray ?? []).map((m, i) => ({ index: i, name: _loc(m.name) })),
      hasChain: chain.length > 0,
      hasOverrides: overrides.length > 0,
      helpText: _loc('CALENDARIA.Note.ComputedHelp'),
      buttons: [{ type: 'button', action: 'save', icon: 'fas fa-save', label: 'Save', cssClass: 'primary' }]
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
    let year = currentYear;
    while (this.#config.yearOverrides[year]) year++;
    this.#config.yearOverrides[year] = { month: 0, day: 1 };
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
      } else if (field === 'value') {
        step.value = target.value === 'date' ? (String(step.value).startsWith('date:') ? step.value : 'date:0:0') : target.value;
      } else if (field === 'anchorMonth' || field === 'anchorDay') {
        const [, m = 0, d = 0] = String(step.value).startsWith('date:') ? step.value.split(':').map(Number) : [];
        const month = field === 'anchorMonth' ? parseInt(target.value, 10) || 0 : m;
        const day = field === 'anchorDay' ? Math.max(0, (parseInt(target.value, 10) || 1) - 1) : d;
        step.value = `date:${month}:${day}`;
      } else if (field === 'condition') {
        step.condition = target.value;
        if (step.condition === 'moonPhase') step.params = { moon: 0, phase: 'full' };
        else if (step.condition === 'weekday') step.params = { weekday: 0 };
      } else if (field === 'params') {
        step.params = step.params || {};
        if (subfield === 'days') step.params.days = parseInt(target.value, 10) || 0;
        else if (subfield === 'weekday') step.params.weekday = parseInt(target.value, 10) || 0;
        else if (subfield === 'moon') step.params.moon = parseInt(target.value, 10) || 0;
        else if (subfield === 'phase') step.params.phase = target.value;
        else if (subfield === 'inclusive') step.params.inclusive = target.checked;
      }
    } else if (name.startsWith('override.')) {
      const [, yearStr, field] = name.split('.');
      if (!this.#config.yearOverrides[yearStr]) this.#config.yearOverrides[yearStr] = { month: 0, day: 1 };
      if (field === 'month') this.#config.yearOverrides[yearStr].month = parseInt(target.value, 10) || 0;
      else if (field === 'day') this.#config.yearOverrides[yearStr].day = parseInt(target.value, 10) || 1;
      else if (field === 'year') {
        const newYear = parseInt(target.value, 10);
        if (Number.isFinite(newYear) && String(newYear) !== yearStr) {
          this.#config.yearOverrides[newYear] = this.#config.yearOverrides[yearStr];
          delete this.#config.yearOverrides[yearStr];
        }
      }
    }
    // Single re-render keeps the live preview current after any edit.
    this.render();
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
