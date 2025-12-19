/**
 * Macro Trigger Configuration Application
 * UI for configuring macros that execute on calendar events.
 *
 * @module Applications/Settings/MacroTriggerConfig
 * @author Tyler
 */

import { MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
import { log } from '../../utils/logger.mjs';
import CalendarManager from '../../calendar/calendar-manager.mjs';

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
    window: {
      icon: 'fas fa-bolt',
      resizable: false,
      title: 'CALENDARIA.MacroTrigger.Title'
    },
    position: { width: 650, height: 680 },
    form: {
      handler: MacroTriggerConfig.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
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

    // Available macros for dropdowns
    context.macros = game.macros.contents.map((m) => ({
      id: m.id,
      name: m.name
    }));

    // Global triggers with current values
    context.globalTriggers = GLOBAL_TRIGGERS.map((trigger) => ({
      ...trigger,
      label: game.i18n.localize(trigger.label),
      hint: game.i18n.localize(trigger.hint),
      macroId: config.global?.[trigger.key] || ''
    }));

    // Get calendar for moons and seasons
    const calendar = CalendarManager.getActiveCalendar();

    // Season triggers
    context.hasSeasons = calendar?.seasons?.values?.length > 0;

    if (context.hasSeasons) {
      // Build season options
      context.seasons = calendar.seasons.values.map((season, index) => ({
        index,
        name: game.i18n.localize(season.name)
      }));

      // Existing season triggers
      context.seasonTriggers = (config.season || []).map((trigger, index) => {
        const isAll = trigger.seasonIndex === -1;
        const season = isAll ? null : calendar.seasons.values[trigger.seasonIndex];
        return {
          index,
          seasonIndex: trigger.seasonIndex,
          seasonName: isAll ? game.i18n.localize('CALENDARIA.MacroTrigger.AllSeasons') : season ? game.i18n.localize(season.name) : `Season ${trigger.seasonIndex}`,
          macroId: trigger.macroId
        };
      });
    }

    // Moon phase triggers
    context.hasMoons = calendar?.moons?.length > 0;

    if (context.hasMoons) {
      // Build moon options
      context.moons = calendar.moons.map((moon, index) => ({
        index,
        name: game.i18n.localize(moon.name)
      }));

      // Build phase options per moon
      context.moonPhases = {};
      calendar.moons.forEach((moon, moonIndex) => {
        context.moonPhases[moonIndex] =
          moon.phases?.map((phase, phaseIndex) => ({
            index: phaseIndex,
            name: game.i18n.localize(phase.name)
          })) || [];
      });

      // Existing moon phase triggers
      context.moonTriggers = (config.moonPhase || []).map((trigger, index) => {
        const isAllMoons = trigger.moonIndex === -1;
        const isAllPhases = trigger.phaseIndex === -1;
        const moon = isAllMoons ? null : calendar.moons[trigger.moonIndex];
        const phase = isAllMoons || isAllPhases ? null : moon?.phases?.[trigger.phaseIndex];
        return {
          index,
          moonIndex: trigger.moonIndex,
          moonName: isAllMoons ? game.i18n.localize('CALENDARIA.MacroTrigger.AllMoons') : moon ? game.i18n.localize(moon.name) : `Moon ${trigger.moonIndex}`,
          phaseIndex: trigger.phaseIndex,
          phaseName: isAllPhases ? game.i18n.localize('CALENDARIA.MacroTrigger.AllPhases') : phase ? game.i18n.localize(phase.name) : `Phase ${trigger.phaseIndex}`,
          macroId: trigger.macroId
        };
      });
    }

    // Footer buttons
    context.buttons = [{ type: 'submit', icon: 'fas fa-save', label: 'CALENDARIA.MacroTrigger.Save' }];

    return context;
  }

  /**
   * Handle form submission.
   * @param {Event} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The form data
   */
  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);

    // Build config object
    const config = { global: {}, season: [], moonPhase: [] };

    // Process global triggers
    for (const trigger of GLOBAL_TRIGGERS) config.global[trigger.key] = data.global?.[trigger.key] || '';

    // Process season triggers from existing entries
    if (data.seasonTrigger) {
      const triggers = Array.isArray(data.seasonTrigger) ? data.seasonTrigger : [data.seasonTrigger];
      for (const trigger of triggers) if (trigger?.macroId) config.season.push({ seasonIndex: parseInt(trigger.seasonIndex), macroId: trigger.macroId });
    }

    // Process moon phase triggers from existing entries
    if (data.moonTrigger) {
      const triggers = Array.isArray(data.moonTrigger) ? data.moonTrigger : [data.moonTrigger];
      for (const trigger of triggers) if (trigger?.macroId) config.moonPhase.push({ moonIndex: parseInt(trigger.moonIndex), phaseIndex: parseInt(trigger.phaseIndex), macroId: trigger.macroId });
    }

    // Save config
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    log(3, 'Macro trigger config saved', config);
    ui.notifications.info(game.i18n.localize('CALENDARIA.MacroTrigger.Saved'));
  }

  /**
   * Handle adding a new moon phase trigger.
   * @param {PointerEvent} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onAddMoonTrigger(event, target) {
    // this.element IS the form since tag: 'form'
    const moonSelect = this.element.querySelector('select[name="newMoonTrigger.moonIndex"]');
    const phaseSelect = this.element.querySelector('select[name="newMoonTrigger.phaseIndex"]');
    const macroSelect = this.element.querySelector('select[name="newMoonTrigger.macroId"]');

    const moonIndex = parseInt(moonSelect?.value);
    const phaseIndex = parseInt(phaseSelect?.value);
    const macroId = macroSelect?.value;

    if (isNaN(moonIndex) || isNaN(phaseIndex) || !macroId) {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.MacroTrigger.SelectAll'));
      return;
    }

    // Get current config and add new trigger
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.moonPhase) config.moonPhase = [];

    // Check for duplicate
    const exists = config.moonPhase.some((t) => t.moonIndex === moonIndex && t.phaseIndex === phaseIndex);
    if (exists) {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.MacroTrigger.DuplicateMoon'));
      return;
    }

    config.moonPhase.push({ moonIndex, phaseIndex, macroId });
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);

    // Re-render
    this.render();
  }

  /**
   * Handle removing a moon phase trigger.
   * @param {PointerEvent} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onRemoveMoonTrigger(event, target) {
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.moonPhase) return;

    config.moonPhase.splice(index, 1);
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);

    // Re-render
    this.render();
  }

  /**
   * Handle adding a new season trigger.
   * @param {PointerEvent} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onAddSeasonTrigger(event, target) {
    const seasonSelect = this.element.querySelector('select[name="newSeasonTrigger.seasonIndex"]');
    const macroSelect = this.element.querySelector('select[name="newSeasonTrigger.macroId"]');

    const seasonIndex = parseInt(seasonSelect?.value);
    const macroId = macroSelect?.value;

    if (isNaN(seasonIndex) || !macroId) {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.MacroTrigger.SelectSeasonAndMacro'));
      return;
    }

    // Get current config and add new trigger
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.season) config.season = [];

    // Check for duplicate
    const exists = config.season.some((t) => t.seasonIndex === seasonIndex);
    if (exists) {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.MacroTrigger.DuplicateSeason'));
      return;
    }

    config.season.push({ seasonIndex, macroId });
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);

    // Re-render
    this.render();
  }

  /**
   * Handle removing a season trigger.
   * @param {PointerEvent} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onRemoveSeasonTrigger(event, target) {
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;

    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.season) return;

    config.season.splice(index, 1);
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);

    // Re-render
    this.render();
  }

  /** @inheritdoc */
  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    // Filter phase dropdown when moon changes
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
