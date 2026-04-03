/**
 * Preset Manager Application
 * @module Applications/PresetManager
 * @author Tyler
 */

import { DISPLAY_STYLES, MODULE, NOTE_VISIBILITY } from '../../constants.mjs';
import { DEFAULT_PRESET_ID, NoteManager, getAllPresetsIncludingHidden, getBuiltinPresetSeeds, saveAllPresets } from '../../notes/_module.mjs';
import { format, localize } from '../../utils/_module.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Preset Manager for managing note presets with defaults and overrides.
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class PresetManager extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-preset-manager',
    classes: ['calendaria', 'preset-manager'],
    tag: 'form',
    window: { icon: 'fas fa-tags', title: 'CALENDARIA.PresetManager.Title', resizable: false },
    position: { width: 900, height: 835 },
    form: { handler: PresetManager.#onSubmit, submitOnChange: false, closeOnSubmit: false },
    actions: {
      selectPreset: PresetManager.#onSelectPreset,
      addPreset: PresetManager.#onAddPreset,
      removePreset: PresetManager.#onRemovePreset,
      editIcon: PresetManager.#onEditIcon,
      savePresets: PresetManager.#onSave,
      restorePresets: PresetManager.#onRestorePresets,
      resetSection: PresetManager.#onResetSection,
      exportPreset: PresetManager.#onExportPreset,
      importPreset: PresetManager.#onImportPreset,
      syncPreset: PresetManager.#onSyncPreset
    }
  };

  /** @override */
  static PARTS = {
    main: { template: `modules/${MODULE.ID}/templates/applications/settings/preset-manager.hbs`, scrollable: ['.preset-editor-panel'] },
    footer: { template: `modules/${MODULE.ID}/templates/applications/settings/preset-manager-footer.hbs` }
  };

  /** Currently selected preset ID. */
  _selectedId = null;

  /** Working copy of presets (edited in-memory, saved on submit). */
  _presets = null;

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (!this._presets) {
      this._presets = structuredClone(getAllPresetsIncludingHidden());
      for (const p of this._presets) {
        if (!p.defaults) p.defaults = {};
        if (!('content' in p.defaults)) p.defaults.content = null;
      }
      this._originalPresets = structuredClone(this._presets);
    }
    if (!this._selectedId && this._presets.length) this._selectedId = DEFAULT_PRESET_ID;
    const selected = this._presets.find((c) => c.id === this._selectedId) || null;
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const displayStyleOptions = Object.values(DISPLAY_STYLES).map((v) => ({ value: v, label: localize(`CALENDARIA.Note.DisplayStyle.${capitalize(v)}`) }));
    const visibilityOptions = Object.values(NOTE_VISIBILITY).map((v) => ({ value: v, label: localize(`CALENDARIA.Note.Visibility.${capitalize(v)}`) }));
    const macroOptions = game.macros?.contents?.map((m) => ({ value: m.id, label: m.name })) || [];
    const presets = this._presets
      .filter((c) => !c.hidden)
      .map((c) => ({ ...c, selected: c.id === this._selectedId, isDefault: c.id === DEFAULT_PRESET_ID }))
      .sort((a, b) => {
        if (a.id === DEFAULT_PRESET_ID) return -1;
        if (b.id === DEFAULT_PRESET_ID) return 1;
        return (a.label || '').localeCompare(b.label || '');
      });
    let contentFields = [];
    let scheduleFields = [];
    let settingsFields = [];
    if (selected) {
      const defaults = selected.defaults || {};
      const groups = this.#buildDefaultFields(defaults, displayStyleOptions, visibilityOptions, macroOptions);
      contentFields = groups.content;
      scheduleFields = groups.schedule;
      settingsFields = groups.settings;
    }
    const hasHiddenBuiltins = this._presets.some((c) => c.builtin && c.hidden);
    const selectedContext = selected ? { ...selected, isDefault: selected.id === DEFAULT_PRESET_ID } : null;
    return { ...context, presets, selected: selectedContext, contentFields, scheduleFields, settingsFields, hasHiddenBuiltins };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll('[data-toggles]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const ids = checkbox.dataset.toggles.split(',');
        for (const id of ids) {
          const target = this.element.querySelector(`#${id}`);
          if (target) target.disabled = !checkbox.checked;
        }
      });
    });
  }

  /**
   * Build the default fields grouped by note tab.
   * @param {object} defaults - Preset defaults
   * @param {object[]} displayStyleOptions - Display style options
   * @param {object[]} visibilityOptions - Visibility options
   * @param {object[]} macroOptions - Macro options
   * @returns {{ content: object[], schedule: object[], settings: object[] }} Grouped field descriptors
   */
  #buildDefaultFields(defaults, displayStyleOptions, visibilityOptions, macroOptions) {
    const noDefault = localize('CALENDARIA.PresetManager.NoDefault');
    const esc = (s) => (s ?? '').toString().replace(/"/g, '&quot;');
    const selectHtml = (name, value, options) => {
      let html = `<select id="cat-def-${name}" name="selected.defaults.${name}">`;
      html += `<option value="null" ${value === null || value === undefined ? 'selected' : ''}>${noDefault}</option>`;
      for (const opt of options) html += `<option value="${esc(opt.value)}" ${String(opt.value) === String(value) ? 'selected' : ''}>${opt.label}</option>`;
      html += '</select>';
      return html;
    };
    const checkboxHtml = (name, value, extra = '') => {
      return `<input type="hidden" name="selected.defaults.${name}" value="false"><input type="checkbox" id="cat-def-${name}" name="selected.defaults.${name}" value="true" ${value === true ? 'checked' : ''} ${extra}>`;
    };
    const numberHtml = (name, value, extra = '') => {
      return `<input type="number" id="cat-def-${name}" name="selected.defaults.${name}" value="${value ?? ''}" placeholder="${noDefault}" ${extra}>`;
    };
    const textHtml = (name, value, placeholder = '') => {
      return `<input type="text" id="cat-def-${name}" name="selected.defaults.${name}" value="${esc(value ?? '')}" placeholder="${placeholder || noDefault}">`;
    };
    const reminderTargetOptions = [
      { value: 'all', label: localize('CALENDARIA.Note.ReminderTargetAll') },
      { value: 'gm', label: localize('CALENDARIA.Common.GMOnly') },
      { value: 'author', label: localize('CALENDARIA.Note.ReminderTargetAuthor') },
      { value: 'viewers', label: localize('CALENDARIA.Note.ReminderTargetViewers') }
    ];
    const ownershipOptions = [
      { value: 0, label: localize('CALENDARIA.PresetManager.OwnershipNone') },
      { value: 2, label: localize('CALENDARIA.PresetManager.OwnershipObserver') },
      { value: 3, label: localize('CALENDARIA.PresetManager.OwnershipOwner') }
    ];
    const hasDur = defaults.hasDuration === true;
    const hasLimited = defaults.limitedRepeat === true;
    return {
      content: [
        {
          key: 'name',
          label: localize('CALENDARIA.Note.Title'),
          inputHtml: textHtml('name', defaults.name, localize('CALENDARIA.PresetManager.TitleTemplatePlaceholder')),
          hint: localize('CALENDARIA.PresetManager.TitleTemplateHint')
        }
      ],
      schedule: [
        { key: 'allDay', label: localize('CALENDARIA.Common.AllDay'), inputHtml: checkboxHtml('allDay', defaults.allDay), hint: localize('CALENDARIA.PresetManager.DefaultAllDayHint') },
        {
          key: 'maxOccurrences',
          label: localize('CALENDARIA.PresetManager.MaxOccurrences'),
          inputHtml: numberHtml('maxOccurrences', defaults.maxOccurrences, 'min="0"'),
          hint: localize('CALENDARIA.PresetManager.DefaultMaxOccurrencesHint')
        }
      ],
      settings: [
        {
          key: 'visibility',
          label: localize('CALENDARIA.Common.Visibility'),
          inputHtml: selectHtml('visibility', defaults.visibility, visibilityOptions),
          hint: localize('CALENDARIA.PresetManager.DefaultVisibilityHint')
        },
        { key: 'silent', label: localize('CALENDARIA.Note.Silent'), inputHtml: checkboxHtml('silent', defaults.silent), hint: localize('CALENDARIA.PresetManager.DefaultSilentHint') },
        {
          key: 'displayStyle',
          label: localize('CALENDARIA.Note.DisplayStyleLabel'),
          inputHtml: selectHtml('displayStyle', defaults.displayStyle, displayStyleOptions),
          hint: localize('CALENDARIA.PresetManager.DefaultDisplayStyleHint')
        },
        { key: 'macro', label: localize('CALENDARIA.Common.Macro'), inputHtml: selectHtml('macro', defaults.macro, macroOptions), hint: localize('CALENDARIA.PresetManager.DefaultMacroHint') },
        {
          key: 'hasDuration',
          label: localize('CALENDARIA.Common.HasDuration'),
          inputHtml: checkboxHtml('hasDuration', defaults.hasDuration, 'data-toggles="cat-def-duration,cat-def-showBookends,cat-def-limitedRepeat,cat-def-limitedRepeatDays"'),
          hint: localize('CALENDARIA.PresetManager.DefaultHasDurationHint')
        },
        {
          key: 'duration',
          label: localize('CALENDARIA.Common.Duration'),
          inputHtml: numberHtml('duration', defaults.duration, `min="1" ${hasDur ? '' : 'disabled'}`),
          hint: localize('CALENDARIA.PresetManager.DefaultDurationHint')
        },
        {
          key: 'showBookends',
          label: localize('CALENDARIA.Note.Duration.ShowBookends'),
          inputHtml: checkboxHtml('showBookends', defaults.showBookends, hasDur ? '' : 'disabled'),
          hint: localize('CALENDARIA.Note.Duration.ShowBookendsHint')
        },
        {
          key: 'limitedRepeat',
          label: localize('CALENDARIA.Note.Duration.LimitedRepeat'),
          inputHtml: checkboxHtml('limitedRepeat', defaults.limitedRepeat, `${hasDur ? '' : 'disabled'} data-toggles="cat-def-limitedRepeatDays"`),
          hint: localize('CALENDARIA.Note.Duration.LimitedRepeatHint')
        },
        {
          key: 'limitedRepeatDays',
          label: localize('CALENDARIA.Note.Duration.LimitedRepeatDays'),
          inputHtml: numberHtml('limitedRepeatDays', defaults.limitedRepeatDays, `min="1" ${hasDur && hasLimited ? '' : 'disabled'}`),
          hint: localize('CALENDARIA.Note.Duration.LimitedRepeatHint')
        },
        {
          key: 'reminderType',
          label: localize('CALENDARIA.Common.NotifType'),
          inputHtml: selectHtml('reminderType', defaults.reminderType, [
            { value: 'toast', label: 'Toast' },
            { value: 'chat', label: 'Chat' },
            { value: 'dialog', label: 'Dialog' }
          ]),
          hint: localize('CALENDARIA.PresetManager.DefaultReminderTypeHint')
        },
        {
          key: 'reminderTargets',
          label: localize('CALENDARIA.PresetManager.ReminderTargets'),
          inputHtml: selectHtml('reminderTargets', defaults.reminderTargets, reminderTargetOptions),
          hint: localize('CALENDARIA.PresetManager.DefaultReminderTargetsHint')
        },
        {
          key: 'reminderOffset',
          label: localize('CALENDARIA.Note.ReminderOffset'),
          inputHtml: numberHtml('reminderOffset', defaults.reminderOffset),
          hint: localize('CALENDARIA.Note.ReminderOffsetTooltip')
        },
        {
          key: 'defaultOwnership',
          label: localize('CALENDARIA.PresetManager.DefaultOwnership'),
          inputHtml: selectHtml('defaultOwnership', defaults.defaultOwnership, ownershipOptions),
          hint: localize('CALENDARIA.PresetManager.DefaultOwnershipHint')
        }
      ]
    };
  }

  /**
   * Select a preset in the list.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static #onSelectPreset(_event, target) {
    const id = target.closest('[data-preset-id]')?.dataset.presetId;
    if (!id) return;
    const form = this.element;
    if (form) {
      const formData = new foundry.applications.ux.FormDataExtended(form);
      PresetManager.#onSubmit.call(this, null, form, formData);
    }
    this._selectedId = id;
    this.render();
  }

  /**
   * Add a new custom preset.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static #onAddPreset(_event, _target) {
    const id = foundry.utils.randomID();
    const maxSort = this._presets.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1);
    this._presets.push({
      id,
      label: localize('CALENDARIA.Common.NewPreset'),
      color: '#4a90e2',
      icon: 'fas fa-bookmark',
      builtin: false,
      sortOrder: maxSort + 1,
      playerUsable: true,
      defaults: {
        name: null,
        allDay: null,
        displayStyle: null,
        visibility: null,
        color: null,
        icon: null,
        reminderType: null,
        reminderOffset: null,
        reminderTargets: null,
        hasDuration: null,
        duration: null,
        maxOccurrences: null,
        silent: null,
        showBookends: null,
        limitedRepeat: null,
        limitedRepeatDays: null,
        defaultOwnership: null,
        macro: null,
        owners: []
      }
    });
    this._selectedId = id;
    this.render();
  }

  /**
   * Remove a preset.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onRemovePreset(_event, target) {
    const id = target.closest('[data-preset-id]')?.dataset.presetId;
    if (!id) return;
    const cat = this._presets.find((c) => c.id === id);
    if (!cat) return;
    if (id === DEFAULT_PRESET_ID) {
      ui.notifications.warn('CALENDARIA.PresetManager.CannotDeleteDefault', { localize: true });
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Common.DeletePreset') },
      content: `<p>${format('CALENDARIA.PresetManager.ConfirmDeleteMessage', { name: cat.label })}</p>`,
      yes: { default: false }
    });
    if (!confirmed) return;
    if (cat.builtin) cat.hidden = true;
    else this._presets = this._presets.filter((c) => c.id !== id);
    if (this._selectedId === id) this._selectedId = this._presets.find((c) => !c.hidden)?.id || null;
    this.render();
  }

  /**
   * Restore hidden built-in presets.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onRestorePresets(_event, _target) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.PresetManager.RestorePresets') },
      content: `<p>${localize('CALENDARIA.PresetManager.RestorePresetsMessage')}</p>`,
      rejectClose: false
    });
    if (!confirmed) return;
    const seeds = getBuiltinPresetSeeds();
    for (const cat of this._presets) {
      if (!cat.builtin || !cat.hidden) continue;
      cat.hidden = false;
      const seed = seeds.find((s) => s.id === cat.id);
      if (seed?.defaults?.content && !cat.defaults?.content) {
        cat.defaults = cat.defaults || {};
        cat.defaults.content = seed.defaults.content;
      }
    }
    this.render();
  }

  /**
   * Edit preset icon/color via dialog.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static #onEditIcon(_event, target) {
    const id = target.closest('[data-preset-id]')?.dataset.presetId;
    const cat = this._presets.find((c) => c.id === id);
    if (!cat) return;
    const content = `
      <div class="form-group">
        <label>${localize('CALENDARIA.Common.Icon')}</label>
        <div class="form-fields">
          <input type="text" name="icon" value="${cat.icon}" placeholder="fas fa-bookmark">
        </div>
        <p class="hint">${localize('CALENDARIA.Common.IconHint')}</p>
      </div>
      <div class="form-group">
        <label>${localize('CALENDARIA.Common.Color')}</label>
        <div class="form-fields">
          <color-picker name="color" value="${cat.color}"></color-picker>
        </div>
      </div>
    `;
    const manager = this;
    new foundry.applications.api.DialogV2({
      window: { title: localize('CALENDARIA.SettingsPanel.Preset.EditIconColor'), contentClasses: ['calendaria', 'season-icon-dialog'] },
      content,
      buttons: [
        {
          action: 'save',
          label: localize('CALENDARIA.Common.Save'),
          icon: 'fas fa-save',
          default: true,
          callback: (_event, _button, dialog) => {
            cat.icon = dialog.element.querySelector('[name="icon"]')?.value || 'fas fa-bookmark';
            cat.color = dialog.element.querySelector('[name="color"]')?.value || '#4a90e2';
            manager.render();
          }
        }
      ],
      position: { width: 350 }
    }).render(true);
  }

  /**
   * Parse a form value into typed value for defaults/overrides.
   * @param {string} raw - Raw form string
   * @param {'bool'|'string'|'number'} type - Expected type
   * @returns {*} Typed value or null
   */
  static #parseValue(raw, type) {
    if (raw === 'null' || raw === '' || raw === undefined) return null;
    if (type === 'bool') return raw === 'true';
    if (type === 'number') return Number(raw);
    return raw || null;
  }

  /**
   * Read form data and update in-memory presets.
   * @param {Event} _event - The submit event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - The form data
   */
  static async #onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const cat = this._presets.find((c) => c.id === this._selectedId);
    if (!cat || !data.selected) return;
    const s = data.selected;
    cat.label = s.label || cat.label;
    cat.playerUsable = cat.id === DEFAULT_PRESET_ID ? true : !!s.playerUsable;
    const raw = s.defaults || {};
    cat.defaults = cat.defaults || {};
    const fieldTypes = {
      name: 'string',
      allDay: 'bool',
      displayStyle: 'string',
      visibility: 'string',
      reminderType: 'string',
      reminderOffset: 'number',
      reminderTargets: 'string',
      hasDuration: 'bool',
      duration: 'number',
      maxOccurrences: 'number',
      silent: 'bool',
      showBookends: 'bool',
      limitedRepeat: 'bool',
      limitedRepeatDays: 'number',
      defaultOwnership: 'number',
      macro: 'string'
    };
    for (const [key, type] of Object.entries(fieldTypes)) {
      cat.defaults[key] = PresetManager.#parseValue(raw[key], type);
    }
    cat.defaults.color = cat.defaults.color ?? null;
    cat.defaults.icon = cat.defaults.icon ?? null;
    cat.defaults.owners = cat.defaults.owners ?? [];
    const rawContent = raw.content?.trim();
    cat.defaults.content = rawContent && rawContent !== '<p></p>' ? rawContent : null;
    this.render();
  }

  /**
   * Save all presets to settings and clean up orphaned preset references.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onSave(_event, _target) {
    const form = this.element;
    if (form) {
      const formData = new foundry.applications.ux.FormDataExtended(form);
      await PresetManager.#onSubmit.call(this, null, form, formData);
    }
    const savedIds = new Set(this._presets.map((c) => c.id));
    await saveAllPresets(this._presets);
    const allNotes = NoteManager.getAllNotes();
    const orphanUpdates = [];
    for (const stub of allNotes) {
      const cats = stub.flagData?.categories;
      if (!Array.isArray(cats) || !cats.length) continue;
      const filtered = cats.filter((id) => savedIds.has(id));
      if (filtered.length !== cats.length) orphanUpdates.push(NoteManager.updateNote(stub.id, { noteData: { categories: filtered } }));
    }
    if (orphanUpdates.length) await Promise.all(orphanUpdates);
    const changedPresets = this._presets.filter((p) => {
      const orig = this._originalPresets?.find((o) => o.id === p.id);
      if (!orig) return false;
      return orig.icon !== p.icon || orig.color !== p.color;
    });
    if (changedPresets.length) {
      const affectedNotes = allNotes.filter((stub) => {
        const cats = stub.flagData?.categories;
        return cats?.some((id) => changedPresets.some((p) => p.id === id));
      });
      if (affectedNotes.length) {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: localize('CALENDARIA.PresetManager.UpdateNotesTitle') },
          content: `<p>${format('CALENDARIA.PresetManager.UpdateNotesContent', { count: affectedNotes.length })}</p>`,
          rejectClose: false,
          modal: true
        });
        if (confirmed) {
          const noteUpdates = [];
          for (const stub of affectedNotes) {
            const cats = stub.flagData?.categories || [];
            const preset = changedPresets.find((p) => cats.includes(p.id));
            if (!preset) continue;
            const updates = {};
            if (preset.icon) updates.icon = preset.icon;
            if (preset.color) updates.color = preset.color;
            noteUpdates.push(NoteManager.updateNote(stub.id, { noteData: updates }));
          }
          await Promise.all(noteUpdates);
        }
      }
    }
    this._originalPresets = structuredClone(this._presets);
    ui.notifications.clear();
    ui.notifications.info(localize('CALENDARIA.PresetManager.Saved'));
  }

  /**
   * Reset a fieldset section to default values.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked button
   */
  static async #onResetSection(_event, target) {
    const section = target.dataset.section;
    const cat = this._presets.find((c) => c.id === this._selectedId);
    if (!cat || !section) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.SettingsPanel.ResetSection.Title'), contentClasses: ['calendaria', 'reset-section-dialog'] },
      content: `<p>${localize('CALENDARIA.SettingsPanel.ResetSection.Content')}</p>`,
      yes: { label: localize('CALENDARIA.Common.Reset'), icon: 'fas fa-undo' },
      no: { label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
    });
    if (!confirmed) return;
    const seed = cat.builtin ? getBuiltinPresetSeeds().find((s) => s.id === cat.id) : null;
    const sd = seed?.defaults || {};
    const resetNull = (keys) => {
      for (const k of keys) cat.defaults[k] = sd[k] ?? null;
    };
    cat.defaults = cat.defaults || {};
    if (section === 'content') {
      if (seed) {
        if (cat.id !== DEFAULT_PRESET_ID) cat.label = seed.label;
        cat.icon = seed.icon;
        cat.color = seed.color;
        cat.playerUsable = cat.id === DEFAULT_PRESET_ID ? true : (seed.playerUsable ?? true);
      } else {
        cat.label = localize('CALENDARIA.Common.NewPreset');
        cat.icon = 'fas fa-bookmark';
        cat.color = '#4a90e2';
        cat.playerUsable = true;
      }
      resetNull(['name']);
      cat.defaults.content = sd.content ?? null;
    } else if (section === 'schedule') {
      resetNull(['allDay', 'maxOccurrences']);
    } else if (section === 'settings') {
      resetNull([
        'displayStyle',
        'visibility',
        'silent',
        'reminderType',
        'reminderOffset',
        'reminderTargets',
        'hasDuration',
        'duration',
        'showBookends',
        'limitedRepeat',
        'limitedRepeatDays',
        'defaultOwnership',
        'macro'
      ]);
    }
    this.render();
  }

  /**
   * Export the currently selected preset to a JSON file.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static #onExportPreset(_event, _target) {
    const preset = this._presets.find((c) => c.id === this._selectedId);
    if (!preset) return;
    const exportData = {
      type: 'calendaria-preset',
      version: 1,
      exportedAt: new Date().toISOString(),
      moduleVersion: game.modules.get(MODULE.ID)?.version ?? 'unknown',
      preset: structuredClone(preset)
    };
    const safeName = (preset.label || 'preset')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\da-z-]/g, '')
      .substring(0, 32);
    const filename = `calendaria-preset-${safeName}-${Date.now()}.json`;
    foundry.utils.saveDataToFile(JSON.stringify(exportData, null, 2), 'application/json', filename);
    ui.notifications.info(format('CALENDARIA.PresetManager.ExportPresetSuccess', { name: preset.label }));
  }

  /**
   * Import a preset from a JSON file into the working preset list.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static #onImportPreset(_event, _target) {
    const manager = this;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await foundry.utils.readTextFromFile(file);
        const importData = JSON.parse(text);
        if (importData.type !== 'calendaria-preset' || !importData.preset) {
          ui.notifications.error('CALENDARIA.PresetManager.ImportPresetInvalidType', { localize: true });
          return;
        }
        const raw = importData.preset;
        const newId = foundry.utils.randomID();
        let label = raw.label || localize('CALENDARIA.Common.NewPreset');
        if (manager._presets.some((c) => c.label === label)) label = `${label} (Imported)`;
        const maxSort = manager._presets.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1);
        manager._presets.push({
          id: newId,
          label,
          color: raw.color || '#4a90e2',
          icon: raw.icon || 'fas fa-bookmark',
          builtin: false,
          sortOrder: maxSort + 1,
          playerUsable: raw.playerUsable ?? true,
          hidden: false,
          defaults: {
            name: raw.defaults?.name ?? null,
            allDay: raw.defaults?.allDay ?? null,
            displayStyle: raw.defaults?.displayStyle ?? null,
            visibility: raw.defaults?.visibility ?? null,
            color: raw.defaults?.color ?? null,
            icon: raw.defaults?.icon ?? null,
            reminderType: raw.defaults?.reminderType ?? null,
            reminderOffset: raw.defaults?.reminderOffset ?? null,
            reminderTargets: raw.defaults?.reminderTargets ?? null,
            hasDuration: raw.defaults?.hasDuration ?? null,
            duration: raw.defaults?.duration ?? null,
            maxOccurrences: raw.defaults?.maxOccurrences ?? null,
            silent: raw.defaults?.silent ?? null,
            showBookends: raw.defaults?.showBookends ?? null,
            limitedRepeat: raw.defaults?.limitedRepeat ?? null,
            limitedRepeatDays: raw.defaults?.limitedRepeatDays ?? null,
            defaultOwnership: raw.defaults?.defaultOwnership ?? null,
            macro: raw.defaults?.macro ?? null,
            owners: raw.defaults?.owners ?? [],
            content: raw.defaults?.content ?? null
          }
        });
        manager._selectedId = newId;
        manager.render();
        ui.notifications.info(format('CALENDARIA.PresetManager.ImportPresetSuccess', { name: label }));
      } catch {
        ui.notifications.error('CALENDARIA.PresetManager.ImportPresetError', { localize: true });
      }
    });
    input.click();
  }

  /**
   * Sync preset defaults to all existing notes with this preset's category.
   * Skips title, content, and schedule dates. Syncs all other defaults.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onSyncPreset(_event, _target) {
    const form = this.element;
    if (form) {
      const formData = new foundry.applications.ux.FormDataExtended(form);
      await PresetManager.#onSubmit.call(this, null, form, formData);
    }
    const preset = this._presets.find((c) => c.id === this._selectedId);
    if (!preset) return;
    if (preset.id === DEFAULT_PRESET_ID) {
      ui.notifications.warn('CALENDARIA.PresetManager.SyncDefaultNotAllowed', { localize: true });
      return;
    }
    const allNotes = NoteManager.getAllNotes();
    const affected = allNotes.filter((stub) => {
      const cats = stub.flagData?.categories;
      return Array.isArray(cats) && cats.includes(preset.id);
    });
    if (!affected.length) {
      ui.notifications.info('CALENDARIA.PresetManager.SyncNoNotes', { localize: true });
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.PresetManager.SyncTitle') },
      content: `<p>${format('CALENDARIA.PresetManager.SyncConfirm', { count: affected.length, name: preset.label })}</p>`,
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return;
    const defaults = preset.defaults || {};
    const syncFields = [
      'allDay',
      'displayStyle',
      'visibility',
      'reminderType',
      'reminderOffset',
      'reminderTargets',
      'hasDuration',
      'duration',
      'showBookends',
      'limitedRepeat',
      'limitedRepeatDays',
      'maxOccurrences',
      'silent',
      'macro'
    ];
    const updates = [];
    for (const stub of affected) {
      const noteUpdates = {};
      for (const key of syncFields) if (defaults[key] != null) noteUpdates[key] = defaults[key];
      if (defaults.color) noteUpdates.color = defaults.color;
      if (defaults.icon) noteUpdates.icon = defaults.icon;
      if (preset.icon) noteUpdates.icon = preset.icon;
      if (preset.color) noteUpdates.color = preset.color;
      if (Object.keys(noteUpdates).length) updates.push(NoteManager.updateNote(stub.id, { noteData: noteUpdates }));
    }
    if (updates.length) await Promise.all(updates);
    ui.notifications.info(format('CALENDARIA.PresetManager.SyncComplete', { count: affected.length }));
  }

  /** @override */
  async close(options = {}) {
    this._presets = null;
    this._originalPresets = null;
    this._selectedId = null;
    return super.close(options);
  }
}
