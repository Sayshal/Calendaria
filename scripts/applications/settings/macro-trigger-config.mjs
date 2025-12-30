/**
 * Macro Trigger Configuration Application
 * UI for configuring macros that execute on calendar events.
 * @module Applications/Settings/MacroTriggerConfig
 * @todo inline this into the Settings menu instead of making it a seperate button
 * @author Tyler
 */

import CalendarManager from '../../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
import { localize } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Global trigger types with localization keys.
 * @type {Array<{key: string, label: string, hint: string}>}
 */
const GLOBAL_TRIGGERS = [
  { key: 'dawn', label: 'CALENDARIA.MacroTrigger.Dawn', hint: 'CALENDARIA.MacroTrigger.DawnHint' },
  { key: 'dusk', label: 'CALENDARIA.MacroTrigger.Dusk', hint: 'CALENDARIA.MacroTrigger.DuskHint' },
  { key: 'midday', label: 'CALENDARIA.MacroTrigger.Midday', hint: 'CALENDARIA.MacroTrigger.MiddayHint' },
  { key: 'midnight', label: 'CALENDARIA.MacroTrigger.Midnight', hint: 'CALENDARIA.MacroTrigger.MidnightHint' },
  { key: 'newDay', label: 'CALENDARIA.MacroTrigger.NewDay', hint: 'CALENDARIA.MacroTrigger.NewDayHint' }
];

/**
 * Macro Trigger Configuration Application.
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class MacroTriggerConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-macro-trigger-config',
    classes: ['calendaria', 'macro-trigger-config', 'standard-form'],
    tag: 'form',
    window: { icon: 'fas fa-bolt', resizable: false, title: 'CALENDARIA.MacroTrigger.Title' },
    position: { width: 650, height: 680 },
    form: { handler: MacroTriggerConfig.#onSubmit, submitOnChange: false, closeOnSubmit: true },
    actions: {
      addMoonTrigger: MacroTriggerConfig.#onAddMoonTrigger,
      removeMoonTrigger: MacroTriggerConfig.#onRemoveMoonTrigger,
      addSeasonTrigger: MacroTriggerConfig.#onAddSeasonTrigger,
      removeSeasonTrigger: MacroTriggerConfig.#onRemoveSeasonTrigger
    }
  };

  /** @override */
  static PARTS = {
    form: { template: TEMPLATES.SETTINGS.MACRO_TRIGGER_CONFIG, scrollable: [''] },
    footer: { template: TEMPLATES.FORM_FOOTER }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const config = game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS);
    context.macros = game.macros.contents.map((m) => ({ id: m.id, name: m.name }));
    context.globalTriggers = GLOBAL_TRIGGERS.map((trigger) => ({ ...trigger, label: localize(trigger.label), hint: localize(trigger.hint), macroId: config.global?.[trigger.key] || '' }));
    const calendar = CalendarManager.getActiveCalendar();
    context.hasSeasons = calendar?.seasons?.values?.length > 0;
    if (context.hasSeasons) {
      context.seasons = calendar.seasons.values.map((season, index) => ({ index, name: localize(season.name) }));
      context.seasonTriggers = (config.season || []).map((trigger, index) => {
        const isAll = trigger.seasonIndex === -1;
        const season = isAll ? null : calendar.seasons.values[trigger.seasonIndex];
        return {
          index,
          seasonIndex: trigger.seasonIndex,
          seasonName: isAll ? localize('CALENDARIA.MacroTrigger.AllSeasons') : season ? localize(season.name) : `Season ${trigger.seasonIndex}`,
          macroId: trigger.macroId
        };
      });
    }

    context.hasMoons = calendar?.moons?.length > 0;
    if (context.hasMoons) {
      context.moons = calendar.moons.map((moon, index) => ({ index, name: localize(moon.name) }));
      context.moonPhases = {};
      calendar.moons.forEach((moon, moonIndex) => {
        context.moonPhases[moonIndex] = moon.phases?.map((phase, phaseIndex) => ({ index: phaseIndex, name: localize(phase.name) })) || [];
      });

      context.moonTriggers = (config.moonPhase || []).map((trigger, index) => {
        const isAllMoons = trigger.moonIndex === -1;
        const isAllPhases = trigger.phaseIndex === -1;
        const moon = isAllMoons ? null : calendar.moons[trigger.moonIndex];
        const phase = isAllMoons || isAllPhases ? null : moon?.phases?.[trigger.phaseIndex];
        return {
          index,
          moonIndex: trigger.moonIndex,
          moonName: isAllMoons ? localize('CALENDARIA.MacroTrigger.AllMoons') : moon ? localize(moon.name) : `Moon ${trigger.moonIndex}`,
          phaseIndex: trigger.phaseIndex,
          phaseName: isAllPhases ? localize('CALENDARIA.MacroTrigger.AllPhases') : phase ? localize(phase.name) : `Phase ${trigger.phaseIndex}`,
          macroId: trigger.macroId
        };
      });
    }
    context.buttons = [{ type: 'submit', icon: 'fas fa-save', label: 'CALENDARIA.MacroTrigger.Save' }];
    return context;
  }

  /**
   * Handle form submission.
   * @param {Event} _event - The form submission event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - The form data
   */
  static async #onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const config = { global: {}, season: [], moonPhase: [] };
    for (const trigger of GLOBAL_TRIGGERS) config.global[trigger.key] = data.global?.[trigger.key] || '';
    if (data.seasonTrigger) {
      const triggers = Array.isArray(data.seasonTrigger) ? data.seasonTrigger : [data.seasonTrigger];
      for (const trigger of triggers) if (trigger?.macroId) config.season.push({ seasonIndex: parseInt(trigger.seasonIndex), macroId: trigger.macroId });
    }
    if (data.moonTrigger) {
      const triggers = Array.isArray(data.moonTrigger) ? data.moonTrigger : [data.moonTrigger];
      for (const trigger of triggers) if (trigger?.macroId) config.moonPhase.push({ moonIndex: parseInt(trigger.moonIndex), phaseIndex: parseInt(trigger.phaseIndex), macroId: trigger.macroId });
    }
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    log(3, 'Macro trigger config saved', config);
    ui.notifications.info('CALENDARIA.MacroTrigger.Saved', { localize: true });
  }

  /**
   * Handle adding a new moon phase trigger.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onAddMoonTrigger(_event, _target) {
    const moonSelect = this.element.querySelector('select[name="newMoonTrigger.moonIndex"]');
    const phaseSelect = this.element.querySelector('select[name="newMoonTrigger.phaseIndex"]');
    const macroSelect = this.element.querySelector('select[name="newMoonTrigger.macroId"]');
    const moonIndex = parseInt(moonSelect?.value);
    const phaseIndex = parseInt(phaseSelect?.value);
    const macroId = macroSelect?.value;
    if (isNaN(moonIndex) || isNaN(phaseIndex) || !macroId) {
      ui.notifications.warn('CALENDARIA.MacroTrigger.SelectAll', { localize: true });
      return;
    }
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.moonPhase) config.moonPhase = [];
    const exists = config.moonPhase.some((t) => t.moonIndex === moonIndex && t.phaseIndex === phaseIndex);
    if (exists) {
      ui.notifications.warn('CALENDARIA.MacroTrigger.DuplicateMoon', { localize: true });
      return;
    }
    config.moonPhase.push({ moonIndex, phaseIndex, macroId });
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    this.render();
  }

  /**
   * Handle removing a moon phase trigger.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onRemoveMoonTrigger(_event, target) {
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.moonPhase) return;
    config.moonPhase.splice(index, 1);
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    this.render();
  }

  /**
   * Handle adding a new season trigger.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onAddSeasonTrigger(_event, _target) {
    const seasonSelect = this.element.querySelector('select[name="newSeasonTrigger.seasonIndex"]');
    const macroSelect = this.element.querySelector('select[name="newSeasonTrigger.macroId"]');
    const seasonIndex = parseInt(seasonSelect?.value);
    const macroId = macroSelect?.value;
    if (isNaN(seasonIndex) || !macroId) {
      ui.notifications.warn('CALENDARIA.MacroTrigger.SelectSeasonAndMacro', { localize: true });
      return;
    }

    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.season) config.season = [];
    const exists = config.season.some((t) => t.seasonIndex === seasonIndex);
    if (exists) {
      ui.notifications.warn('CALENDARIA.MacroTrigger.DuplicateSeason', { localize: true });
      return;
    }
    config.season.push({ seasonIndex, macroId });
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    this.render();
  }

  /**
   * Handle removing a season trigger.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onRemoveSeasonTrigger(_event, target) {
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.season) return;
    config.season.splice(index, 1);
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    this.render();
  }

  /** @inheritdoc */
  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);
    const moonSelect = htmlElement.querySelector('select[name="newMoonTrigger.moonIndex"]');
    const phaseSelect = htmlElement.querySelector('select[name="newMoonTrigger.phaseIndex"]');
    if (moonSelect && phaseSelect) {
      moonSelect.addEventListener('change', () => {
        const selectedMoon = moonSelect.value;
        const phaseOptions = phaseSelect.querySelectorAll('option[data-moon]');
        phaseOptions.forEach((opt) => {
          if (selectedMoon === '-1') opt.hidden = opt.dataset.moon !== '-1';
          else if (selectedMoon === '') opt.hidden = false;
          else opt.hidden = opt.dataset.moon !== '-1' && opt.dataset.moon !== selectedMoon;
        });
        if (phaseSelect.selectedOptions[0]?.hidden) phaseSelect.value = '';
      });
    }
  }
}
