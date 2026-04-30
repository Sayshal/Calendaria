import { CalendarManager } from '../../calendar/_module.mjs';
import { CONDITION_GROUP_MODES, CONDITION_OPERATORS, MAX_NESTING_DEPTH, TEMPLATES } from '../../constants.mjs';
import {
  annotateForRender,
  createDefaultCondition,
  createDefaultGroup,
  getDefaultsForField,
  getFieldSchema,
  getNodeAtPath,
  getParentAndIndex,
  isGroup,
  unwrapFromRootGroup,
  wrapInRootGroup
} from '../../notes/_module.mjs';
import { localize } from '../../utils/_module.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * UI builder for condition trees with nested boolean groups.
 */
export class ConditionBuilderDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {object} Root group representing the condition tree */
  #tree = { type: 'group', mode: 'and', children: [], threshold: null };

  /** @type {Function} Callback when tree changes */
  #onChange = null;

  /**
   * @param {object} options - Application options
   * @param {Array} [options.conditions] - Initial flat conditions array
   * @param {Function} [options.onChange] - Callback when conditions change
   */
  constructor(options = {}) {
    super(options);
    if (options.conditions?.length) this.#tree = wrapInRootGroup(options.conditions);
    if (options.onChange) this.#onChange = options.onChange;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-condition-builder',
    classes: ['calendaria', 'condition-builder'],
    tag: 'form',
    window: { title: 'CALENDARIA.Condition.Builder.Title', icon: 'fas fa-sitemap', resizable: true },
    position: { width: 'auto', height: 'auto' },
    actions: {
      addCondition: ConditionBuilderDialog.#onAddCondition,
      addGroup: ConditionBuilderDialog.#onAddGroup,
      removeEntry: ConditionBuilderDialog.#onRemoveEntry,
      close: ConditionBuilderDialog.#onClose
    }
  };

  /** @override */
  static PARTS = { form: { template: TEMPLATES.DIALOGS.CONDITION_BUILDER, scrollable: ['.cb-content'] }, footer: { template: TEMPLATES.FORM_FOOTER } };

  /** @override */
  async _prepareContext() {
    const calendar = CalendarManager.getActiveCalendar();
    const tree = annotateForRender(this.#tree, calendar, '', 0);
    const buttons = [{ type: 'button', action: 'close', icon: 'fas fa-check', label: 'Close', cssClass: 'primary' }];
    return { tree, maxDepth: MAX_NESTING_DEPTH, buttons };
  }

  /**
   * Add a new condition to a group.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Button with data-path
   */
  static async #onAddCondition(_event, target) {
    const path = target.dataset.path ?? '';
    const group = getNodeAtPath(this.#tree, path);
    if (!group?.children) return;
    group.children.push(createDefaultCondition());
    this.#notifyChange();
    this.render();
  }

  /**
   * Add a new nested group.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Button with data-path
   */
  static async #onAddGroup(_event, target) {
    const path = target.dataset.path ?? '';
    const depth = path ? path.split('.').length : 0;
    if (depth >= MAX_NESTING_DEPTH - 1) return;
    const group = getNodeAtPath(this.#tree, path);
    if (!group?.children) return;
    group.children.push(createDefaultGroup());
    this.#notifyChange();
    this.render();
  }

  /**
   * Remove a condition or group.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Button with data-path
   */
  static async #onRemoveEntry(_event, target) {
    const path = target.dataset.path;
    if (!path && path !== '0') return;
    const result = getParentAndIndex(this.#tree, path);
    if (!result) return;
    const { parent, index } = result;
    const entry = parent.children[index];
    if (isGroup(entry) && entry.children?.length > 0) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: localize('CALENDARIA.Condition.Builder.ConfirmDeleteTitle') },
        content: `<p>${localize('CALENDARIA.Condition.Builder.ConfirmDeleteGroup')}</p>`,
        yes: { default: true },
        rejectClose: false
      });
      if (!confirmed) return;
    }

    parent.children.splice(index, 1);
    this.#notifyChange();
    this.render();
  }

  /**
   * Close the builder. Changes are already saved live via _onChangeForm.
   */
  static async #onClose() {
    this.close();
  }

  /** @override */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    const target = event.target;
    const name = target.name;
    if (name.startsWith('condition.')) this.#handleConditionChange(name, target);
    else if (name.startsWith('group.')) this.#handleGroupChange(name, target);
    this.#notifyChange();
  }

  /**
   * Handle changes to a condition field's form inputs.
   * @param {string} name - Input name (e.g., 'condition.1.2.field')
   * @param {HTMLElement} target - Changed input element
   */
  #handleConditionChange(name, target) {
    const parts = name.split('.');
    parts.shift();
    const property = parts.pop();
    const path = parts.join('.');
    const node = getNodeAtPath(this.#tree, path);
    if (!node || isGroup(node)) return;
    switch (property) {
      case 'field': {
        const newField = target.value;
        const defaults = getDefaultsForField(newField, CalendarManager.getActiveCalendar());
        node.field = newField;
        node.op = defaults.op;
        node.value = defaults.value;
        node.value2 = defaults.value2;
        node.offset = defaults.offset;
        this.render();
        return;
      }
      case 'op':
        node.op = target.value;
        if (target.value !== CONDITION_OPERATORS.MODULO) node.offset = 0;
        this.render();
        return;
      case 'value': {
        const schema = getFieldSchema(node.field);
        if (schema?.inputType === 'boolean') {
          node.value = target.value === 'true';
        } else if (schema?.inputType === 'select') {
          const parsed = Number(target.value);
          node.value = isNaN(parsed) ? target.value : parsed;
        } else {
          node.value = parseFloat(target.value) || 0;
        }
        return;
      }
      case 'value2': {
        const parsed = Number(target.value);
        node.value2 = isNaN(parsed) ? target.value : parsed;
        const schema = getFieldSchema(node.field);
        if (schema?.getOptions?.length > 1) this.render();
        return;
      }
      case 'dateYear':
      case 'dateMonth':
      case 'dateDay': {
        if (typeof node.value !== 'object' || node.value === null) node.value = { year: 0, month: 0, dayOfMonth: 0 };
        if (property === 'dateYear') {
          node.value.year = parseInt(target.value) || 0;
        } else if (property === 'dateMonth') {
          node.value.month = parseInt(target.value) || 0;
          const calendar = CalendarManager.getActiveCalendar();
          const months = calendar?.monthsArray ?? [];
          const maxDay = months[node.value.month]?.days ?? 30;
          const dayInput = target.closest('.cb-date-inputs')?.querySelector('.cb-date-day');
          if (dayInput) {
            dayInput.max = maxDay;
            if (node.value.dayOfMonth > maxDay) {
              node.value.dayOfMonth = maxDay;
              dayInput.value = maxDay;
            }
          }
        } else if (property === 'dateDay') {
          node.value.dayOfMonth = parseInt(target.value) || 0;
        }
        return;
      }
      case 'offset':
        node.offset = parseInt(target.value) || 0;
        return;
    }
  }

  /**
   * Handle changes to a group's form inputs.
   * @param {string} name - Input name (e.g., 'group..mode' or 'group.1.mode')
   * @param {HTMLElement} target - Changed input element
   */
  #handleGroupChange(name, target) {
    const parts = name.split('.');
    parts.shift();
    const property = parts.pop();
    const path = parts.join('.');
    const node = getNodeAtPath(this.#tree, path);
    if (!node || !isGroup(node)) return;
    switch (property) {
      case 'mode':
        node.mode = target.value;
        if (node.mode === CONDITION_GROUP_MODES.COUNT && !node.threshold) node.threshold = 1;
        this.render();
        return;
      case 'threshold':
        node.threshold = Math.max(1, parseInt(target.value) || 1);
        return;
    }
  }

  /**
   * Notify listener of tree changes.
   */
  #notifyChange() {
    if (this.#onChange) this.#onChange(unwrapFromRootGroup(this.#tree));
  }

  /**
   * Get the current conditions array.
   * @returns {Array} Conditions array
   */
  getConditions() {
    return unwrapFromRootGroup(this.#tree);
  }
}
