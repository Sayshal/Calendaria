/**
 * Preset Manager Application
 * @module Applications/PresetManager
 * @author Tyler
 */

import { DISPLAY_STYLES, MODULE, NOTE_VISIBILITY } from '../../constants.mjs';
import { NoteManager, getAllPresetsIncludingHidden, getBuiltinPresetSeeds, saveAllPresets } from '../../notes/_module.mjs';
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
      toggleLock: PresetManager.#onToggleLock,
      restorePresets: PresetManager.#onRestorePresets,
      resetSection: PresetManager.#onResetSection,
      exportPreset: PresetManager.#onExportPreset,
      importPreset: PresetManager.#onImportPreset
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
    if (!this._selectedId && this._presets.length) this._selectedId = this._presets[0].id;
    const selected = this._presets.find((c) => c.id === this._selectedId) || null;
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const displayStyleOptions = Object.values(DISPLAY_STYLES).map((v) => ({ value: v, label: localize(`CALENDARIA.Note.DisplayStyle.${capitalize(v)}`) }));
    const visibilityOptions = Object.values(NOTE_VISIBILITY).map((v) => ({ value: v, label: localize(`CALENDARIA.Note.Visibility.${capitalize(v)}`) }));
    const macroOptions = game.macros?.contents?.map((m) => ({ value: m.id, label: m.name })) || [];
    const presets = this._presets
      .filter((c) => !c.hidden)
      .map((c) => ({ ...c, selected: c.id === this._selectedId }))
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    let defaultFields = [];
    if (selected) {
      const defaults = selected.defaults || {};
      const overrides = selected.overrides || {};
      defaultFields = this.#buildDefaultFields(defaults, overrides, displayStyleOptions, visibilityOptions, macroOptions);
    }
    const hasHiddenBuiltins = this._presets.some((c) => c.builtin && c.hidden);
    return { ...context, presets, selected, defaultFields, hasHiddenBuiltins };
  }

  /**
   * Build the default fields array for the template.
   * @param {object} defaults - Preset defaults
   * @param {object} overrides - Preset overrides
   * @param {object[]} displayStyleOptions - Display style options
   * @param {object[]} visibilityOptions - Visibility options
   * @param {object[]} macroOptions - Macro options
   * @returns {object[]} Array of field descriptors
   */
  #buildDefaultFields(defaults, overrides, displayStyleOptions, visibilityOptions, macroOptions) {
    const noDefault = localize('CALENDARIA.PresetManager.NoDefault');
    const esc = (s) => (s ?? '').toString().replace(/"/g, '&quot;');
    const selectHtml = (name, value, options) => {
      let html = `<select id="cat-def-${name}" name="selected.defaults.${name}">`;
      html += `<option value="null" ${!value ? 'selected' : ''}>${noDefault}</option>`;
      for (const opt of options) html += `<option value="${esc(opt.value)}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`;
      html += '</select>';
      return html;
    };
    const boolSelectHtml = (name, value) => {
      return `<select id="cat-def-${name}" name="selected.defaults.${name}">
        <option value="null" ${value === null || value === undefined ? 'selected' : ''}>${noDefault}</option>
        <option value="true" ${value === true ? 'selected' : ''}>${localize('CALENDARIA.Common.Yes')}</option>
        <option value="false" ${value === false ? 'selected' : ''}>${localize('CALENDARIA.Common.No')}</option>
      </select>`;
    };
    const numberHtml = (name, value, extra = '') => {
      return `<input type="number" id="cat-def-${name}" name="selected.defaults.${name}" value="${value ?? ''}" placeholder="${noDefault}" ${extra}>`;
    };
    return [
      {
        key: 'allDay',
        label: localize('CALENDARIA.Common.AllDay'),
        locked: overrides.allDay != null,
        inputHtml: boolSelectHtml('allDay', overrides.allDay ?? defaults.allDay),
        hint: localize('CALENDARIA.PresetManager.DefaultAllDayHint')
      },
      {
        key: 'displayStyle',
        label: localize('CALENDARIA.Note.DisplayStyleLabel'),
        locked: overrides.displayStyle != null,
        inputHtml: selectHtml('displayStyle', overrides.displayStyle ?? defaults.displayStyle, displayStyleOptions),
        hint: localize('CALENDARIA.PresetManager.DefaultDisplayStyleHint')
      },
      {
        key: 'visibility',
        label: localize('CALENDARIA.Common.Visibility'),
        locked: overrides.visibility != null,
        inputHtml: selectHtml('visibility', overrides.visibility ?? defaults.visibility, visibilityOptions),
        hint: localize('CALENDARIA.PresetManager.DefaultVisibilityHint')
      },
      {
        key: 'reminderType',
        label: localize('CALENDARIA.Common.NotifType'),
        locked: overrides.reminderType != null,
        inputHtml: selectHtml('reminderType', overrides.reminderType ?? defaults.reminderType, [
          { value: 'toast', label: 'Toast' },
          { value: 'chat', label: 'Chat' },
          { value: 'dialog', label: 'Dialog' }
        ]),
        hint: localize('CALENDARIA.PresetManager.DefaultReminderTypeHint')
      },
      {
        key: 'reminderOffset',
        label: localize('CALENDARIA.Note.ReminderOffset'),
        locked: overrides.reminderOffset != null,
        inputHtml: numberHtml('reminderOffset', overrides.reminderOffset ?? defaults.reminderOffset),
        hint: localize('CALENDARIA.Note.ReminderOffsetTooltip')
      },
      {
        key: 'hasDuration',
        label: localize('CALENDARIA.Common.HasDuration'),
        locked: overrides.hasDuration != null,
        inputHtml: boolSelectHtml('hasDuration', overrides.hasDuration ?? defaults.hasDuration),
        hint: localize('CALENDARIA.PresetManager.DefaultHasDurationHint')
      },
      {
        key: 'duration',
        label: localize('CALENDARIA.Common.Duration'),
        locked: overrides.duration != null,
        inputHtml: numberHtml('duration', overrides.duration ?? defaults.duration, 'min="1"'),
        hint: localize('CALENDARIA.PresetManager.DefaultDurationHint')
      },
      {
        key: 'macro',
        label: localize('CALENDARIA.Common.Macro'),
        locked: overrides.macro != null,
        inputHtml: selectHtml('macro', overrides.macro ?? defaults.macro, macroOptions),
        hint: localize('CALENDARIA.PresetManager.DefaultMacroHint')
      }
    ];
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
      defaults: { allDay: null, displayStyle: null, visibility: null, color: null, icon: null, reminderType: null, reminderOffset: null, hasDuration: null, duration: null, macro: null, owners: [] },
      overrides: {}
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
   * Toggle lock state on a default field.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked button
   */
  static #onToggleLock(_event, target) {
    const field = target.dataset.field;
    if (!field) return;
    const hiddenInput = target.parentElement.querySelector(`input[name="selected.locks.${field}"]`);
    const isLocked = hiddenInput?.value === 'true';
    if (hiddenInput) hiddenInput.value = isLocked ? 'false' : 'true';
    target.classList.toggle('locked', !isLocked);
    const icon = target.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-lock', !isLocked);
      icon.classList.toggle('fa-lock-open', isLocked);
    }
    target.dataset.tooltip = !isLocked ? localize('CALENDARIA.PresetManager.ForcedTooltip') : localize('CALENDARIA.PresetManager.DefaultTooltip');
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
    cat.playerUsable = !!s.playerUsable;
    const locks = s.locks || {};
    const raw = s.defaults || {};
    cat.defaults = cat.defaults || {};
    cat.overrides = cat.overrides || {};
    const fieldTypes = {
      allDay: 'bool',
      displayStyle: 'string',
      visibility: 'string',
      reminderType: 'string',
      reminderOffset: 'number',
      hasDuration: 'bool',
      duration: 'number',
      macro: 'string'
    };
    for (const [key, type] of Object.entries(fieldTypes)) {
      const value = PresetManager.#parseValue(raw[key], type);
      const locked = locks[key] === 'true';
      if (locked) {
        cat.overrides[key] = value;
        cat.defaults[key] = null;
      } else {
        cat.defaults[key] = value;
        cat.overrides[key] = null;
      }
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
      if (filtered.length !== cats.length) {
        orphanUpdates.push(NoteManager.updateNote(stub.id, { noteData: { categories: filtered } }));
      }
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
    if (section === 'basic') {
      if (seed) {
        cat.label = seed.label;
        cat.icon = seed.icon;
        cat.color = seed.color;
        cat.playerUsable = true;
      } else {
        cat.label = localize('CALENDARIA.Common.NewPreset');
        cat.icon = 'fas fa-bookmark';
        cat.color = '#4a90e2';
        cat.playerUsable = true;
      }
    } else if (section === 'defaults') {
      if (seed) {
        const seedDefaults = seed.defaults || {};
        cat.defaults = {
          allDay: seedDefaults.allDay ?? null,
          displayStyle: seedDefaults.displayStyle ?? null,
          visibility: seedDefaults.visibility ?? null,
          color: null,
          icon: null,
          reminderType: seedDefaults.reminderType ?? null,
          reminderOffset: seedDefaults.reminderOffset ?? null,
          hasDuration: seedDefaults.hasDuration ?? null,
          duration: seedDefaults.duration ?? null,
          macro: null,
          owners: [],
          content: null
        };
      } else {
        cat.defaults = {
          allDay: null,
          displayStyle: null,
          visibility: null,
          color: null,
          icon: null,
          reminderType: null,
          reminderOffset: null,
          hasDuration: null,
          duration: null,
          macro: null,
          owners: [],
          content: null
        };
      }
      cat.overrides = { displayStyle: null, visibility: null };
    } else if (section === 'content') {
      cat.defaults = cat.defaults || {};
      cat.defaults.content = seed?.defaults?.content ?? null;
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
            allDay: raw.defaults?.allDay ?? null,
            displayStyle: raw.defaults?.displayStyle ?? null,
            visibility: raw.defaults?.visibility ?? null,
            color: raw.defaults?.color ?? null,
            icon: raw.defaults?.icon ?? null,
            reminderType: raw.defaults?.reminderType ?? null,
            reminderOffset: raw.defaults?.reminderOffset ?? null,
            hasDuration: raw.defaults?.hasDuration ?? null,
            duration: raw.defaults?.duration ?? null,
            macro: raw.defaults?.macro ?? null,
            owners: raw.defaults?.owners ?? [],
            content: raw.defaults?.content ?? null
          },
          overrides: {
            displayStyle: raw.overrides?.displayStyle ?? null,
            visibility: raw.overrides?.visibility ?? null
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

  /** @override */
  async close(options = {}) {
    this._presets = null;
    this._originalPresets = null;
    this._selectedId = null;
    return super.close(options);
  }
}
