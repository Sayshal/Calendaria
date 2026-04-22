/**
 * Calendar Note Sheet
 * @module Sheets/CalendarNoteSheet
 * @author Tyler
 */

import { CalendarManager, CalendarRegistry, getEquivalentDates } from '../../calendar/_module.mjs';
import { MODULE, SETTINGS, SOCKET_TYPES, TEMPLATES } from '../../constants.mjs';
import {
  addCustomPreset,
  applyPresetDefaultsToNoteData,
  deleteCustomPreset,
  describeConditionTree,
  detectCycles,
  extractEventDependencies,
  getAllPresets,
  getConditionPresets,
  getNextOccurrences,
  getRecurrenceDescription,
  groupPresets,
  isCustomPreset,
  NoteManager,
  summarizeConditionTree,
  validateConditions,
  wrapInRootGroup
} from '../../notes/_module.mjs';
import { daysBetween, isSameDay } from '../../notes/date-utils.mjs';
import { CalendariaSocket, convertToConditionTree, format, localize, log } from '../../utils/_module.mjs';
import { CalendarEditor, ConditionBuilderDialog } from '../_module.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const ContextMenu = foundry.applications.ux.ContextMenu.implementation;

/**
 * Sheet application for calendar note journal entry pages.
 * @extends foundry.applications.sheets.journal.JournalEntryPageSheet
 */
export class CalendarNoteSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.journal.JournalEntryPageSheet) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['calendaria', 'calendar-note-sheet'],
    tag: 'form',
    position: { width: 820, height: 'auto' },
    actions: {
      selectIcon: this._onSelectIcon,
      selectDate: this._onSelectDate,
      saveAndClose: this._onSaveAndClose,
      deleteNote: this._onDeleteNote,
      addPreset: this._onAddPreset,
      toggleMode: this._onToggleMode,
      openConditionBuilder: this._onOpenConditionBuilder,
      openFestivalEditor: this._onOpenFestivalEditor
    },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  /** @type {{VIEW: number, EDIT: number}} */
  static MODES = Object.freeze({ VIEW: 1, EDIT: 2 });

  /** @type {Object<string, {template: string}>} */
  static VIEW_PARTS = { view: { template: TEMPLATES.SHEETS.CALENDAR_NOTE_VIEW } };

  /** @type {Object<string, {template: string}>} */
  static EDIT_PARTS = {
    tabs: { template: TEMPLATES.TAB_NAVIGATION },
    content: { template: TEMPLATES.SHEETS.NOTE_TAB_CONTENT, scrollable: [''] },
    schedule: { template: TEMPLATES.SHEETS.NOTE_TAB_SCHEDULE, scrollable: [''] },
    settings: { template: TEMPLATES.SHEETS.NOTE_TAB_SETTINGS, scrollable: [''] }
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: 'content', group: 'primary', label: 'CALENDARIA.Common.Content' },
        { id: 'schedule', group: 'primary', label: 'CALENDARIA.Note.Tab.Schedule' },
        { id: 'settings', group: 'primary', label: 'CALENDARIA.Common.Settings' }
      ],
      initial: 'content'
    }
  };

  /** Current sheet mode. */
  _mode = CalendarNoteSheet.MODES.VIEW;

  /** Track if this is a newly created note that may need cleanup. */
  _isNewNote = false;

  /** @returns {boolean} Whether currently in view mode. */
  get isViewMode() {
    return this._mode === CalendarNoteSheet.MODES.VIEW;
  }

  /** @returns {boolean} Whether currently in edit mode. */
  get isEditMode() {
    return this._mode === CalendarNoteSheet.MODES.EDIT;
  }

  /** @returns {boolean} Whether user is the original author of this note. */
  get isAuthor() {
    return this.document.system.author?._id === game.user.id;
  }

  /** @override */
  _configureRenderOptions(options) {
    if (options.isFirstRender) {
      const settingMode = game.settings.get(MODULE.ID, SETTINGS.NOTE_OPEN_MODE);
      const mode = options.forceMode ? options.forceMode : settingMode !== 'default' ? settingMode : options.mode || 'view';
      if (mode === 'edit' && this.document.isOwner) {
        this._mode = CalendarNoteSheet.MODES.EDIT;
        const defaultName = localize('CALENDARIA.Note.NewNote');
        const hasDefaultName = this.document.name === defaultName;
        const hasNoContent = !this.document.text?.content?.trim();
        this._isNewNote = hasDefaultName && hasNoContent;
      } else {
        this._mode = CalendarNoteSheet.MODES.VIEW;
      }
    }
    super._configureRenderOptions(options);
  }

  /** @override */
  async _onClose(options) {
    if (this._isNewNote && this.document) {
      const journal = this.document.parent;
      if (!journal || !game.journal.has(journal.id)) return super._onClose(options);
      const defaultName = localize('CALENDARIA.Note.NewNote');
      const hasDefaultName = this.document.name === defaultName;
      const hasNoContent = !this.document.text?.content?.trim();
      if (hasDefaultName && hasNoContent) {
        if (journal.pages?.size === 1) await journal.delete();
        else await this.document.delete();
      }
    }
    return super._onClose(options);
  }

  /** @override */
  _configureRenderParts(options) {
    super._configureRenderParts(options);
    return this.isViewMode ? { ...this.constructor.VIEW_PARTS } : { ...this.constructor.EDIT_PARTS };
  }

  /** @override */
  get title() {
    return this.document.name;
  }

  /** @override */
  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);
    const iconPicker = htmlElement.querySelector('.icon-picker');
    if (iconPicker) {
      iconPicker.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.constructor._switchIconMode(event, iconPicker);
      });
    }
    const categoriesContainer = htmlElement.querySelector('.categories-container');
    if (categoriesContainer) {
      categoriesContainer.addEventListener('contextmenu', (event) => {
        const tag = event.target.closest('.tag');
        if (!tag) return;
        const presetId = tag.dataset.key;
        if (!presetId || !isCustomPreset(presetId)) return;
        event.preventDefault();
        this.#showDeletePresetMenu(event, presetId, tag.textContent.trim());
      });
    }
    const presetSelect = htmlElement.querySelector('.preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', () => {
        if (presetSelect.value === '__clear__') this.#clearConditions();
        else if (presetSelect.value) this.#applyPreset(presetSelect.value);
      });
    }
    new ContextMenu(htmlElement, '.condition-pill[data-path]', [], {
      fixed: true,
      jQuery: false,
      onOpen: (target) => {
        const path = target.dataset.path;
        if (!path) return;
        ui.context.menuItems = [
          {
            name: localize('CALENDARIA.Common.Delete'),
            icon: '<i class="fas fa-trash"></i>',
            callback: () => this.#removeConditionAtPath(path)
          }
        ];
      }
    });
  }

  /**
   * Show context menu to delete a custom preset.
   * @param {MouseEvent} _event - The context menu event
   * @param {string} presetId - The preset ID
   * @param {string} presetLabel - The preset label for display
   */
  async #showDeletePresetMenu(_event, presetId, presetLabel) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Common.DeletePreset') },
      content: `<p>${format('CALENDARIA.Note.DeletePresetConfirm', { label: presetLabel })}</p><p class="hint">${localize('CALENDARIA.Note.DeletePresetHint')}</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed) {
      const deleted = await deleteCustomPreset(presetId);
      if (deleted) {
        ui.notifications.info(format('CALENDARIA.Info.PresetDeleted', { label: presetLabel }));
        this.render();
      }
    }
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.#renderHeaderControls();
    if (this._isNewNote && this.isEditMode) {
      const titleInput = this.element.querySelector('input[name="name"]');
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }
    if (this.isEditMode) this.#autoConvertLegacy();
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#renderHeaderControls();
    this.element.classList.toggle('view-mode', this.isViewMode);
    this.element.classList.toggle('edit-mode', this.isEditMode);
    this.element.classList.remove('dnd5e2', 'dnd5e-journal');
    for (const select of this.element.querySelectorAll('select[data-ownership-user]')) select.addEventListener('change', (e) => this.#onOwnershipChange(e));
    for (const input of this.element.querySelectorAll('.time-inputs input[type="text"]')) {
      input.addEventListener('blur', () => {
        input.value = String(parseInt(input.value) || 0).padStart(2, '0');
      });
    }
  }

  /**
   * Selectors for temporary form fields not backed by the data model.
   * @type {string[]}
   */
  static TRANSIENT_FIELDS = ['.new-preset-input'];

  /** @override */
  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);
    state.transientValues = {};
    for (const selector of this.constructor.TRANSIENT_FIELDS) {
      const el = priorElement.querySelector(selector);
      if (el) state.transientValues[selector] = el.value;
    }
  }

  /** @override */
  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state);
    if (!state.transientValues) return;
    for (const [selector, value] of Object.entries(state.transientValues)) {
      const el = newElement.querySelector(selector);
      if (el && value) el.value = value;
    }
  }

  /**
   * Render header control buttons based on current mode.
   * @private
   */
  #renderHeaderControls() {
    const windowHeader = this.element.querySelector('.window-header');
    if (!windowHeader) return;
    let controlsContainer = windowHeader.querySelector('.header-controls');
    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.className = 'header-controls';
      windowHeader.insertBefore(controlsContainer, windowHeader.firstChild);
    }
    controlsContainer.innerHTML = '';
    if (this.document.isOwner) {
      const modeBtn = document.createElement('button');
      modeBtn.type = 'button';
      modeBtn.className = `header-control icon fas ${this.isViewMode ? 'fa-pen-to-square' : 'fa-eye'}`;
      modeBtn.dataset.action = 'toggleMode';
      modeBtn.dataset.tooltip = this.isViewMode ? 'Edit Note' : 'View Note';
      modeBtn.setAttribute('aria-label', this.isViewMode ? 'Edit Note' : 'View Note');
      controlsContainer.appendChild(modeBtn);
    }
    if (this.isEditMode) {
      const divider = document.createElement('span');
      divider.className = 'header-divider';
      controlsContainer.appendChild(divider);
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'header-control icon fas fa-save';
      saveBtn.dataset.action = 'saveAndClose';
      saveBtn.dataset.tooltip = 'Save & Close';
      saveBtn.setAttribute('aria-label', 'Save & Close');
      controlsContainer.appendChild(saveBtn);
      if ((this.isAuthor || game.user.isGM) && this.document.id) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'header-control icon fas fa-trash';
        deleteBtn.dataset.action = 'deleteNote';
        deleteBtn.dataset.tooltip = 'Delete Note';
        deleteBtn.setAttribute('aria-label', 'Delete Note');
        controlsContainer.appendChild(deleteBtn);
      }
    }
  }

  /**
   * Prepare grouped and ungrouped tabs for template rendering.
   * @returns {{ungroupedTabs: Array<object>, tabGroups: Array<object>}} Tab data
   */
  #prepareTabGroups() {
    const activeTab = this.tabGroups.primary || 'content';
    const ungroupedTabs = CalendarNoteSheet.TABS.primary.tabs.map((tab) => ({ ...tab, group: 'primary', active: tab.id === activeTab, cssClass: tab.id === activeTab ? 'active' : '' }));
    return { ungroupedTabs, tabGroups: [] };
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.tab = context.tabs[partId];
    return context;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.document.system;
    context.text = this.document.text;
    const calendar = CalendarManager.getActiveCalendar();
    const components = game.time.components || { year: 1492, month: 0, dayOfMonth: 0 };
    const yearZero = calendar?.years?.yearZero ?? 0;
    const currentYear = components.year + yearZero;
    const currentMonth = components.month ?? 0;
    const currentDay = (components.dayOfMonth ?? 0) + 1;
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    if (context.system.icon && context.system.icon.startsWith('fa')) context.iconType = 'fontawesome';
    else context.iconType = context.system.iconType || 'image';
    const startYear = this.document.system.startDate.year || currentYear;
    const startMonth = this.document.system.startDate.month ?? currentMonth;
    const startDay = (this.document.system.startDate.dayOfMonth ?? 0) + 1 || currentDay;
    context.startDateDisplay = this._formatDateDisplay(calendar, startYear, startMonth, startDay);
    const endDateRaw = this.document.system.endDate;
    const endYear = endDateRaw?.year || startYear;
    const endMonth = endDateRaw?.month ?? startMonth;
    const endDay = endDateRaw ? (endDateRaw.dayOfMonth ?? 0) + 1 : startDay;
    context.endDateDisplay = this._formatDateDisplay(calendar, endYear, endMonth, endDay);
    context.maxHour = hoursPerDay - 1;
    context.startHourPadded = String(this.document.system.startDate.hour ?? 0).padStart(2, '0');
    context.startMinutePadded = String(this.document.system.startDate.minute ?? 0).padStart(2, '0');
    context.endHourPadded = String(this.document.system.endDate?.hour ?? 0).padStart(2, '0');
    context.endMinutePadded = String(this.document.system.endDate?.minute ?? 0).padStart(2, '0');
    const startDateObj = this.document.system.startDate;
    const endDateObj = this.document.system.endDate;
    context.durationLockedByRange = !!(endDateObj && !isSameDay(startDateObj, endDateObj));
    context.isFestival = !!this.document.system.linkedFestival;
    const visibility = this.document.system.visibility || 'visible';
    const visibilityConfig = {
      visible: { icon: 'fa-eye', label: 'CALENDARIA.Note.Visibility.Visible', badge: null },
      hidden: { icon: 'fa-eye-slash', label: 'CALENDARIA.Common.Hidden', badge: localize('CALENDARIA.Common.Hidden') },
      secret: { icon: 'fa-lock', label: 'CALENDARIA.Note.Visibility.Secret', badge: localize('CALENDARIA.Note.Visibility.Secret') }
    };
    const vis = visibilityConfig[visibility] || visibilityConfig.visible;
    context.visibilityIcon = vis.icon;
    context.visibilityLabel = vis.label;
    context.visibilityBadge = vis.badge;
    context.isViewMode = this.isViewMode;
    context.isEditMode = this.isEditMode;
    context.isGM = game.user.isGM;
    context.canEdit = this.document.isOwner;
    if (this.isEditMode) {
      const { ungroupedTabs, tabGroups } = this.#prepareTabGroups();
      context.ungroupedTabs = ungroupedTabs;
      context.tabGroups = tabGroups;
      context.showSearch = false;
      context.horizontalTabs = true;
      const selectedCategories = this.document.system.categories || [];
      const allCats = getAllPresets();
      const availableCats = game.user.isGM ? allCats : allCats.filter((c) => c.playerUsable || selectedCategories.includes(c.id));
      context.presetOptions = availableCats.map((cat) => ({ ...cat, selected: selectedCategories.includes(cat.id) }));
      const currentMacro = this.document.system.macro || '';
      context.availableMacros = game.macros.contents.map((m) => ({ id: m.id, name: m.name, selected: m.id === currentMacro }));
      const flatPresets = getConditionPresets(this.document.system.startDate);
      context.presets = flatPresets;
      context.presetGroups = groupPresets(flatPresets);
      const conditionTree = this.#getConditionTreeSummary(calendar);
      context.conditionSummaryHtml = conditionTree ? this.#renderConditionGroup(conditionTree) : '';
      context.occurrences = this.#computeOccurrencePreview(calendar);
      const currentReminderType = this.document.system.reminderType || 'toast';
      context.reminderTypeOptions = [
        { value: 'none', label: localize('CALENDARIA.Common.None'), selected: currentReminderType === 'none' },
        { value: 'toast', label: localize('CALENDARIA.Note.ReminderTypeToast'), selected: currentReminderType === 'toast' },
        { value: 'chat', label: localize('CALENDARIA.Note.ReminderTypeChat'), selected: currentReminderType === 'chat' },
        { value: 'dialog', label: localize('CALENDARIA.Note.ReminderTypeDialog'), selected: currentReminderType === 'dialog' }
      ];
      context.showReminderOptions = currentReminderType !== 'none';
      const currentReminderTargets = this.document.system.reminderTargets || 'all';
      context.reminderTargetOptions = [
        { value: 'all', label: localize('CALENDARIA.Note.ReminderTargetAll'), selected: currentReminderTargets === 'all' },
        { value: 'gm', label: localize('CALENDARIA.Common.GMOnly'), selected: currentReminderTargets === 'gm' },
        { value: 'author', label: localize('CALENDARIA.Note.ReminderTargetAuthor'), selected: currentReminderTargets === 'author' },
        { value: 'viewers', label: localize('CALENDARIA.Note.ReminderTargetViewers'), selected: currentReminderTargets === 'viewers' },
        { value: 'specific', label: localize('CALENDARIA.Note.ReminderTargetSpecific'), selected: currentReminderTargets === 'specific' }
      ];
      context.showReminderUsers = currentReminderTargets === 'specific';
      const selectedReminderUsers = this.document.system.reminderUsers || [];
      context.userOptions = game.users.contents.map((u) => ({ id: u.id, name: u.name, selected: selectedReminderUsers.includes(u.id) }));
      context.ownershipEntries = this.#prepareOwnershipEntries();
    }
    if (this.isViewMode) {
      const selectedCategories = this.document.system.categories || [];
      context.enrichedContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.document.text?.content || '', {
        async: true,
        relativeTo: this.document,
        secrets: this.document.isOwner
      });
      const allPresets = getAllPresets();
      context.displayPresets = selectedCategories
        .map((id) => allPresets.find((c) => c.id === id))
        .filter(Boolean)
        .map((p) => ({ label: p.label, color: p.color, icon: p.icon }));
      context.hasEndDate = endYear !== startYear || endMonth !== startMonth || endDay !== startDay;
      const startHour = String(this.document.system.startDate.hour ?? 12).padStart(2, '0');
      const startMinute = String(this.document.system.startDate.minute ?? 0).padStart(2, '0');
      const endHour = String(this.document.system.endDate?.hour ?? ((this.document.system.startDate.hour ?? 12) + 1) % hoursPerDay).padStart(2, '0');
      const endMinute = String(this.document.system.endDate?.minute ?? this.document.system.startDate.minute ?? 0).padStart(2, '0');
      context.startTimeDisplay = `${startHour}:${startMinute}`;
      context.endTimeDisplay = `${endHour}:${endMinute}`;
      context.hasEndTime = this.document.system.endDate?.hour !== undefined || this.document.system.endDate?.minute !== undefined;
      context.repeatLabel = this.#getRepeatLabel(calendar) || null;
      if (this.document.system.moonConditions?.length > 0) context.moonConditionsDisplay = getRecurrenceDescription(this.document.system);
      const eqCalendars = game.settings.get(MODULE.ID, SETTINGS.EQUIVALENT_DATE_CALENDARS);
      if (eqCalendars.size) {
        const noteCalendarId = this.document.parent?.getFlag?.(MODULE.ID, 'calendarId') ?? CalendarRegistry.getActiveId();
        const startDateInternal = { year: startYear, month: startMonth, dayOfMonth: startDay - 1 };
        context.equivalentDates = getEquivalentDates(startDateInternal, noteCalendarId, [...eqCalendars]);
      }
    }
    return context;
  }

  /**
   * Build a repeat/schedule label for the view mode.
   * Produces friendly text for common conditionTree patterns, falls back to generic description.
   * @param {object} calendar - Active calendar
   * @returns {string|null} Label or null
   * @private
   */
  #getRepeatLabel(calendar) {
    const noteData = this.document.system;
    const tree = noteData.conditionTree;
    if (tree && (noteData.repeat === 'never' || !noteData.repeat)) {
      const summary = summarizeConditionTree(tree, calendar);
      if (summary) return summary;
    }
    return getRecurrenceDescription(noteData);
  }

  /**
   * Get a structured summary of the current condition tree for grouped pill display.
   * @param {object} calendar - Active calendar
   * @returns {object|null} Root group or null if empty
   * @private
   */
  #getConditionTreeSummary(calendar) {
    const tree = this.document.system.conditionTree;
    const rawConditions = this.document.system.conditions || [];
    if (!tree && !rawConditions.length) return null;
    if (!tree) return { mode: null, items: rawConditions.map((cond) => this.#getConditionDescription(cond, calendar)) };
    return this.#describeTreeGrouped(tree, calendar);
  }

  /**
   * Recursively build a nested group description from a condition tree node.
   * @param {object} node - Condition or group node
   * @param {object} calendar - Active calendar
   * @param {string} basePath - Dot-separated path prefix for condition indexing
   * @returns {object} { mode: string|null, items: ({text,path}|object)[] }
   */
  #describeTreeGrouped(node, calendar, basePath = '') {
    if (!node) return { mode: null, items: [] };
    if (node.type !== 'group') {
      const desc = describeConditionTree({ type: 'group', mode: 'and', children: [node] }, calendar);
      return { mode: null, items: desc.map((text) => ({ text, path: basePath })) };
    }
    const children = node.children ?? [];
    if (!children.length) return { mode: null, items: [] };
    const modeLabel = node.mode === 'count' ? `≥${node.threshold ?? 1}` : localize(`CALENDARIA.Condition.Group.Mode.${node.mode || 'and'}`);
    const items = [];
    for (let i = 0; i < children.length; i++) {
      const childPath = basePath ? `${basePath}.${i}` : `${i}`;
      const child = children[i];
      if (child.type === 'group') {
        items.push(this.#describeTreeGrouped(child, calendar, childPath));
      } else {
        const desc = describeConditionTree({ type: 'group', mode: 'and', children: [child] }, calendar);
        items.push(...desc.map((text) => ({ text, path: childPath })));
      }
    }
    return { mode: children.length > 1 ? modeLabel : null, items };
  }

  /**
   * Render a condition group tree node to HTML.
   * @param {object} group - { mode: string|null, items: ({text,path}|object)[] }
   * @returns {string} HTML string
   */
  #renderConditionGroup(group) {
    if (!group?.items?.length) return '';
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const modeHtml = group.mode ? `<span class="group-mode">${esc(group.mode)}</span>` : '';
    const itemsHtml = group.items
      .map((item) => {
        if (item.text != null) return `<span class="condition-pill" data-path="${esc(item.path)}">${esc(item.text)}</span>`;
        return this.#renderConditionGroup(item);
      })
      .join('');
    return `<div class="condition-group">${modeHtml}<div class="group-pills">${itemsHtml}</div></div>`;
  }

  /**
   * Remove a condition from the tree at the given dot-separated path and save.
   * @param {string} path - Dot-separated child indices (e.g. "0", "2.1")
   */
  async #removeConditionAtPath(path) {
    const tree = foundry.utils.deepClone(this.document.system.conditionTree);
    if (!tree) return;
    const indices = path.split('.').map(Number);
    const childIndex = indices.pop();
    let parent = tree;
    for (const idx of indices) {
      parent = parent?.children?.[idx];
      if (!parent) return;
    }
    if (!parent?.children || childIndex >= parent.children.length) return;
    parent.children.splice(childIndex, 1);
    const isEmpty = !tree.children?.length;
    const updateData = {
      'system.conditionTree': isEmpty ? null : tree,
      'system.conditions': isEmpty ? [] : (tree.children ?? [])
    };
    if (!isEmpty) {
      const deps = extractEventDependencies(tree);
      updateData['system.connectedEvents'] = deps.length ? deps : [];
    } else {
      updateData['system.connectedEvents'] = [];
    }
    await this.document.update(updateData);
    this.render();
  }

  /**
   * Compute the next N occurrences for the occurrence preview panel.
   * @param {object} calendar - Active calendar
   * @returns {string[]} Formatted date strings
   */
  #computeOccurrencePreview(calendar) {
    const noteData = this.document.system;
    if (!noteData.conditionTree && noteData.repeat === 'never' && !noteData.conditions?.length) return [];
    const components = game.time.components || {};
    const yearZero = calendar?.years?.yearZero ?? 0;
    const fromDate = { year: (components.year ?? 0) + yearZero, month: components.month ?? 0, dayOfMonth: components.dayOfMonth ?? 0 };
    try {
      const occurrences = getNextOccurrences(noteData, fromDate, 5, 730);
      return occurrences.map((occ) => this._formatDateDisplay(calendar, occ.year, occ.month, (occ.dayOfMonth ?? 0) + 1));
    } catch {
      return [];
    }
  }

  /**
   * Prepare ownership entries for the ownership tab.
   * @returns {object[]} Array of ownership entries per user
   */
  #prepareOwnershipEntries() {
    const journal = this.document.parent;
    const ownership = journal?.ownership ?? {};
    const authorId = this.document.system.author?._id;
    return game.users.contents
      .filter((u) => !u.isGM || u.id === game.user.id)
      .map((u) => {
        const level = ownership[u.id] ?? ownership.default ?? -1;
        return { userId: u.id, name: u.name, color: u.color, level, isAuthorEntry: u.id === authorId, isGMEntry: u.isGM };
      });
  }

  /**
   * Auto-convert legacy repeat data to condition tree format.
   * @private
   */
  async #autoConvertLegacy() {
    const noteData = this.document.system;
    if (noteData.conditionTree) return;
    if ((noteData.repeat === 'never' || !noteData.repeat) && !noteData.conditions?.length) return;
    const tree = convertToConditionTree(noteData);
    if (!tree) return;
    const updateData = { 'system.conditionTree': tree };
    const deps = extractEventDependencies(tree);
    if (deps.length) updateData['system.connectedEvents'] = deps;
    await this.document.update(updateData);
    ui.notifications.info(localize('CALENDARIA.Note.AutoConverted'));
    log(3, `Auto-converted legacy repeat "${noteData.repeat}" for note "${this.document.name}"`);
  }

  /** @override */
  _onChangeForm(formConfig, event) {
    const target = event.target;
    super._onChangeForm(formConfig, event);
    if (target?.name === 'system.allDay') {
      const checked = target.checked;
      const timeInputs = this.element.querySelectorAll('.time-inputs input[type="text"]');
      timeInputs.forEach((input) => (input.disabled = checked));
      const endDateBtn = this.element.querySelector('[data-date-field="endDate"]');
      if (endDateBtn) endDateBtn.disabled = checked;
      if (checked) {
        const startYear = this.element.querySelector('[name="system.startDate.year"]');
        const startMonth = this.element.querySelector('[name="system.startDate.month"]');
        const startDay = this.element.querySelector('[name="system.startDate.dayOfMonth"]');
        const endYear = this.element.querySelector('[name="system.endDate.year"]');
        const endMonth = this.element.querySelector('[name="system.endDate.month"]');
        const endDay = this.element.querySelector('[name="system.endDate.dayOfMonth"]');
        if (startYear && endYear) endYear.value = startYear.value;
        if (startMonth && endMonth) endMonth.value = startMonth.value;
        if (startDay && endDay) endDay.value = startDay.value;
        if (endDateBtn) {
          const startLabel = this.element.querySelector('[data-date-field="startDate"] span');
          const endLabel = endDateBtn.querySelector('span');
          if (startLabel && endLabel) endLabel.textContent = startLabel.textContent;
        }
      }
    }
    if (target?.name === 'system.color') {
      const iconPreview = this.element.querySelector('.icon-picker i.icon-preview');
      if (iconPreview) iconPreview.style.color = target.value;
      const imgPreview = this.element.querySelector('.icon-picker img.icon-preview');
      if (imgPreview) {
        imgPreview.style.filter = `drop-shadow(0px 1000px 0 ${target.value})`;
        imgPreview.style.transform = 'translateY(-1000px)';
      }
    }
    if (target?.name === 'system.reminderType') {
      const disabled = target.value === 'none';
      this.element.querySelector('select[name="system.reminderTargets"]')?.setAttribute('disabled', disabled);
      this.element.querySelector('input[name="system.reminderOffset"]')?.setAttribute('disabled', disabled);
    }
  }

  /**
   * Offer to apply icon and color from a newly added preset.
   * @param {string} presetId - The ID of the newly added preset
   * @private
   */
  async #applyPresetStyle(presetId) {
    const preset = getAllPresets().find((c) => c.id === presetId);
    if (!preset) return;
    const hasDefaults = preset.icon || preset.color || preset.defaults;
    if (!hasDefaults) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Note.ApplyPresetStyleTitle') },
      content: `<p style="text-align:center;font-size:2rem;margin:0.5rem 0"><i class="fas ${preset.icon}" style="color:${preset.color}"></i></p><p>${format('CALENDARIA.Note.ApplyPresetStyleConfirm', { label: preset.label })}</p>`,
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return;
    const noteData = { ...this.document.system };
    applyPresetDefaultsToNoteData(noteData, [presetId]);
    const updates = {};
    if (preset.icon) updates['system.icon'] = `fas ${preset.icon}`;
    if (preset.color) updates['system.color'] = preset.color;
    const defaultFields = ['displayStyle', 'visibility', 'allDay', 'reminderType', 'reminderOffset', 'hasDuration', 'duration', 'macro'];
    for (const field of defaultFields) if (noteData[field] !== this.document.system[field]) updates[`system.${field}`] = noteData[field];
    if (noteData.remindUsers?.length && noteData.remindUsers.length !== (this.document.system.remindUsers?.length ?? 0)) updates['system.remindUsers'] = noteData.remindUsers;
    if (Object.keys(updates).length === 0) return;
    await this.document.update(updates);
  }

  /** Clear all conditions from this note. */
  async #clearConditions() {
    const hasExisting = this.document.system.conditionTree?.children?.length > 0 || this.document.system.conditions?.length > 0;
    if (hasExisting) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: localize('CALENDARIA.Note.Schedule.ClearConditionsTitle') },
        content: `<p>${localize('CALENDARIA.Note.Schedule.ClearConditionsConfirm')}</p>`,
        rejectClose: false,
        modal: true
      });
      if (!confirmed) return;
    }
    await this.document.update({ 'system.conditionTree': null, 'system.conditions': [], 'system.connectedEvents': [] });
    ui.notifications.info(localize('CALENDARIA.Note.Schedule.ConditionsCleared'));
    this.render();
  }

  /**
   * Apply a condition preset by ID.
   * @param {string} presetId - The preset ID
   */
  async #applyPreset(presetId) {
    const presets = getConditionPresets(this.document.system.startDate);
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    const existingTree = this.document.system.conditionTree;
    const hasExisting = existingTree?.children?.length > 0 || this.document.system.conditions?.length > 0;
    let merge = false;
    if (hasExisting) {
      const result = await foundry.applications.api.DialogV2.wait({
        window: { title: localize('CALENDARIA.Note.Preset.ReplaceTitle') },
        content: `<p>${localize('CALENDARIA.Note.Preset.ReplaceConfirm')}</p>
          <label class="checkbox-label"><input type="checkbox" name="merge"> ${localize('CALENDARIA.Note.Preset.MergeOption')}</label>`,
        rejectClose: false,
        modal: true,
        buttons: [
          {
            action: 'apply',
            label: localize('CALENDARIA.Common.Apply'),
            icon: 'fas fa-check',
            default: true,
            callback: (_event, button) => ({ merge: button.form.elements.merge?.checked ?? false })
          },
          {
            action: 'cancel',
            label: localize('CALENDARIA.Common.Cancel'),
            icon: 'fas fa-times'
          }
        ]
      });
      if (!result || result === 'cancel') return;
      merge = result.merge ?? false;
    }
    let tree;
    if (merge && existingTree?.children && preset.tree?.children) {
      tree = foundry.utils.deepClone(existingTree);
      tree.children.push(...foundry.utils.deepClone(preset.tree.children));
    } else {
      tree = preset.tree ?? null;
    }
    const updateData = { 'system.conditionTree': tree, 'system.conditions': tree?.children ?? [] };
    const deps = tree ? extractEventDependencies(tree) : [];
    if (deps.length) updateData['system.connectedEvents'] = deps;
    await this.document.update(updateData);
    log(3, `Applied condition preset: ${preset.label}${merge ? ' (merged)' : ''}`);
  }

  /** @override */
  async _processSubmitData(event, form, submitData, options = {}) {
    CalendarNoteSheet.#enforceDurationFromDateRange(submitData);
    const newCategories = submitData.system?.categories || [];
    const oldCategories = this.document.system.categories || [];
    const addedPreset = newCategories.find((id) => !oldCategories.includes(id));
    NoteManager.enableSuppressOwnershipRebuild();
    try {
      await super._processSubmitData(event, form, submitData, options);
      if (addedPreset) await this.#applyPresetStyle(addedPreset);
    } finally {
      NoteManager.disableSuppressOwnershipRebuild();
    }
  }

  /**
   * Force hasDuration and duration when start/end date define a multi-day range.
   * Disabled form fields are excluded from submitData, so we inject them here.
   * @param {object} submitData - The form submit data
   */
  static #enforceDurationFromDateRange(submitData) {
    const start = submitData.system?.startDate;
    const end = submitData.system?.endDate;
    if (!start || !end || isSameDay(start, end)) return;
    submitData.system.hasDuration = true;
    submitData.system.duration = daysBetween(start, end) + 1;
  }

  /**
   * Handle ownership dropdown change directly (bypasses form submission).
   * @param {Event} event - The change event
   */
  async #onOwnershipChange(event) {
    const select = event.target;
    const userId = select.dataset.ownershipUser;
    const level = parseInt(select.value);
    if (!userId || !Number.isFinite(level)) return;
    const journal = this.document.parent;
    if (!journal) return;
    NoteManager.enableSuppressOwnershipRebuild();
    try {
      if (game.user.isGM) await journal.update({ ownership: { [userId]: level } });
      else CalendariaSocket.emit(SOCKET_TYPES.OWNERSHIP_UPDATE, { journalId: journal.id, ownership: { [userId]: level } });
    } finally {
      NoteManager.disableSuppressOwnershipRebuild();
    }
  }

  /**
   * Handle icon selection (left-click)
   * @param {PointerEvent} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onSelectIcon(event, target) {
    event.preventDefault();
    const iconType = target.dataset.iconType || 'image';
    if (iconType === 'fontawesome') {
      const currentIcon = target.querySelector('i')?.className.replace('icon-preview', '').trim() || '';
      const newIcon = await foundry.applications.api.DialogV2.prompt({
        window: { title: localize('CALENDARIA.Note.FontAwesomeIconTitle') },
        content: `<div class="form-group"><label>${localize('CALENDARIA.Note.FontAwesomeClasses')}</label><input type="text" name="icon-class" value="${currentIcon}" placeholder="fas fa-calendar" /><p class="hint">${localize('CALENDARIA.Common.IconHint')}</p></div>`,
        ok: {
          callback: (_event, button) => {
            return button.form.elements['icon-class'].value;
          }
        },
        rejectClose: false
      });
      if (newIcon) {
        const iconElement = target.querySelector('i.icon-preview');
        if (iconElement) iconElement.className = `${newIcon} icon-preview`;
        const hiddenInput = target.querySelector('input[name="system.icon"]');
        if (hiddenInput) hiddenInput.value = newIcon;
      }
    } else {
      const currentPath = target.querySelector('img')?.src;
      const picker = new foundry.applications.apps.FilePicker({
        type: 'image',
        current: currentPath,
        callback: (path) => {
          const img = target.querySelector('img');
          if (img) img.src = path;
          const hiddenInput = target.querySelector('input[name="system.icon"]');
          if (hiddenInput) hiddenInput.value = path;
        }
      });
      picker.render(true);
    }
  }

  /**
   * Handle right-click to switch icon mode
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The icon picker element
   */
  static async _switchIconMode(_event, target) {
    const iconType = target.dataset.iconType || 'image';
    const newType = iconType === 'image' ? 'fontawesome' : 'image';
    target.dataset.iconType = newType;
    const typeInput = target.querySelector('input[name="system.iconType"]');
    if (typeInput) typeInput.value = newType;
    const form = target.closest('form');
    const colorInput = form?.querySelector('color-picker[name="system.color"]');
    const color = colorInput?.value || '#4a9eff';
    if (newType === 'fontawesome') {
      const img = target.querySelector('img');
      if (img) {
        const icon = document.createElement('i');
        icon.className = 'fas fa-calendar icon-preview';
        icon.style.color = color;
        img.replaceWith(icon);
      }
      const iconInput = target.querySelector('input[name="system.icon"]');
      if (iconInput) iconInput.value = 'fas fa-calendar';
    } else {
      const icon = target.querySelector('i');
      if (icon) {
        const img = document.createElement('img');
        img.src = 'icons/svg/book.svg';
        img.alt = 'Note Icon';
        img.className = 'icon-preview';
        img.style.filter = `drop-shadow(0px 1000px 0 ${color})`;
        img.style.transform = 'translateY(-1000px)';
        icon.replaceWith(img);
      }
      const iconInput = target.querySelector('input[name="system.icon"]');
      if (iconInput) iconInput.value = 'icons/svg/book.svg';
    }
  }

  /**
   * Format a date for display using the calendar system.
   * @param {object} calendar - The calendar to use
   * @param {number} year - The year
   * @param {number} month - The month index (0-based)
   * @param {number} day - The day
   * @returns {string} Formatted date string
   */
  _formatDateDisplay(calendar, year, month, day) {
    const isMonthless = calendar?.isMonthless ?? false;
    if (isMonthless) return `${localize('CALENDARIA.Common.Day')} ${day}, ${year}`;
    if (!calendar?.monthsArray) return `${day} / ${month + 1} / ${year}`;
    const monthData = calendar.monthsArray[month];
    const monthName = monthData?.name ? localize(monthData.name) : `Month ${month + 1}`;
    return `${day} ${monthName}, ${year}`;
  }

  /**
   * Handle date selection button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onSelectDate(_event, target) {
    const dateField = target.dataset.dateField;
    const form = target.closest('form');
    if (!form) return;
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return;
    const components = game.time.components;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const fallbackYear = components.year + yearZero;
    const fallbackMonth = components.month ?? 0;
    const fallbackDay = (components.dayOfMonth ?? 0) + 1;
    const yearInput = form.querySelector(`input[name="system.${dateField}.year"]`);
    const monthInput = form.querySelector(`input[name="system.${dateField}.month"]`);
    const dayInput = form.querySelector(`input[name="system.${dateField}.dayOfMonth"]`);
    const currentYear = parseInt(yearInput?.value) || fallbackYear;
    const parsedMonth = parseInt(monthInput?.value);
    const currentMonth = !isNaN(parsedMonth) ? parsedMonth : fallbackMonth;
    const currentDay = dayInput ? parseInt(dayInput.value) + 1 : fallbackDay;
    const result = await CalendarNoteSheet._showDatePickerDialog(calendar, currentYear, currentMonth, currentDay);
    if (!result) return;
    let syncEndWithStart = false;
    if (dateField === 'startDate') {
      const endYear = parseInt(form.querySelector('[name="system.endDate.year"]')?.value);
      const endMonth = parseInt(form.querySelector('[name="system.endDate.month"]')?.value);
      const endDay = parseInt(form.querySelector('[name="system.endDate.dayOfMonth"]')?.value);
      const oldStart = { year: currentYear, month: currentMonth, dayOfMonth: currentDay - 1 };
      const oldEnd = { year: endYear, month: endMonth, dayOfMonth: endDay };
      syncEndWithStart = !isNaN(endYear) && isSameDay(oldStart, oldEnd);
    }
    if (yearInput) yearInput.value = result.year;
    if (monthInput) monthInput.value = result.month;
    if (dayInput) dayInput.value = result.day - 1;
    const displaySpan = target.querySelector('.date-display');
    if (displaySpan) {
      const isMonthless = calendar?.isMonthless ?? false;
      if (isMonthless) {
        displaySpan.textContent = `${localize('CALENDARIA.Common.Day')} ${result.day}, ${result.year}`;
      } else {
        const monthData = calendar.monthsArray[result.month];
        const monthName = monthData?.name ? localize(monthData.name) : `Month ${result.month + 1}`;
        displaySpan.textContent = `${result.day} ${monthName}, ${result.year}`;
      }
    }
    if (syncEndWithStart) {
      const endYearInput = form.querySelector('input[name="system.endDate.year"]');
      const endMonthInput = form.querySelector('input[name="system.endDate.month"]');
      const endDayInput = form.querySelector('input[name="system.endDate.dayOfMonth"]');
      if (endYearInput) endYearInput.value = result.year;
      if (endMonthInput) endMonthInput.value = result.month;
      if (endDayInput) endDayInput.value = result.day - 1;
      const endDisplaySpan = form.querySelector('[data-date-field="endDate"] .date-display');
      if (endDisplaySpan && displaySpan) endDisplaySpan.textContent = displaySpan.textContent;
    }
    CalendarNoteSheet.#syncDurationFromDateRange(form);
    const changeEvent = new Event('change', { bubbles: true });
    form.dispatchEvent(changeEvent);
  }

  /**
   * Compare startDate and endDate hidden inputs and auto-lock/unlock duration controls.
   * @param {HTMLFormElement} form - The note sheet form
   */
  static #syncDurationFromDateRange(form) {
    const startYear = parseInt(form.querySelector('[name="system.startDate.year"]')?.value);
    const startMonth = parseInt(form.querySelector('[name="system.startDate.month"]')?.value);
    const startDay = parseInt(form.querySelector('[name="system.startDate.dayOfMonth"]')?.value);
    const endYear = parseInt(form.querySelector('[name="system.endDate.year"]')?.value);
    const endMonth = parseInt(form.querySelector('[name="system.endDate.month"]')?.value);
    const endDay = parseInt(form.querySelector('[name="system.endDate.dayOfMonth"]')?.value);
    if ([startYear, startMonth, startDay, endYear, endMonth, endDay].some((v) => isNaN(v))) return;
    const start = { year: startYear, month: startMonth, dayOfMonth: startDay };
    const end = { year: endYear, month: endMonth, dayOfMonth: endDay };
    const isRange = !isSameDay(start, end);
    const hasDurationCheckbox = form.querySelector('[name="system.hasDuration"]');
    const durationInput = form.querySelector('[name="system.duration"]');
    const showBookendsCheckbox = form.querySelector('[name="system.showBookends"]');
    if (!hasDurationCheckbox || !durationInput) return;
    if (isRange) {
      const days = daysBetween(start, end) + 1;
      hasDurationCheckbox.checked = true;
      hasDurationCheckbox.disabled = true;
      durationInput.value = days;
      durationInput.disabled = true;
      if (showBookendsCheckbox) showBookendsCheckbox.disabled = false;
    } else {
      hasDurationCheckbox.disabled = false;
      durationInput.disabled = !hasDurationCheckbox.checked;
      if (showBookendsCheckbox) showBookendsCheckbox.disabled = !hasDurationCheckbox.checked;
    }
  }

  /**
   * Show date picker dialog.
   * @param {object} calendar - The calendar to use
   * @param {number} currentYear - Current year
   * @param {number} currentMonth - Current month (0-based)
   * @param {number} currentDay - Current day
   * @returns {Promise<{year: number, month: number, day: number}|null>} Selected date or null
   */
  static async _showDatePickerDialog(calendar, currentYear, currentMonth, currentDay) {
    const isMonthless = calendar?.isMonthless ?? false;
    const maxDays = isMonthless ? (calendar.getDaysInYear?.(currentYear) ?? 365) : (calendar.getDaysInMonth?.(currentMonth, currentYear) ?? 30);
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.PARTIALS.DATE_PICKER, {
      formClass: '',
      year: currentYear,
      isMonthless,
      months: isMonthless ? [] : calendar.monthsArray.map((m, i) => ({ index: i, name: localize(m.name), selected: i === currentMonth })),
      days: Array.from({ length: maxDays }, (_, i) => i + 1),
      currentDay
    });
    return foundry.applications.api.DialogV2.prompt({
      window: { title: localize('CALENDARIA.Note.SelectDateTitle') },
      content,
      ok: {
        callback: (_event, button) => {
          const month = isMonthless ? 0 : parseInt(button.form.elements.month?.value ?? 0);
          return { year: parseInt(button.form.elements.year.value), month, day: parseInt(button.form.elements.day.value) };
        }
      },
      render: (_event, dialog) => {
        if (isMonthless) return;
        const html = dialog.element;
        const monthSelect = html.querySelector('#month-select');
        const daySelect = html.querySelector('#day-select');
        if (!monthSelect || !daySelect) return;
        monthSelect.addEventListener('change', () => {
          const selectedMonth = parseInt(monthSelect.value);
          const daysInSelectedMonth = calendar.monthsArray[selectedMonth]?.days || 30;
          daySelect.innerHTML = Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1)
            .map((d) => `<option value="${d}">${d}</option>`)
            .join('');
        });
      },
      rejectClose: false
    });
  }

  /**
   * Handle save and close button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onSaveAndClose(_event, _target) {
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    this.element.dispatchEvent(submitEvent);
    setTimeout(() => {
      this.close();
    }, 100);
  }

  /**
   * Handle delete note button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onDeleteNote(_event, _target) {
    if (!this.isAuthor && !game.user.isGM) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Common.DeleteNote') },
      content: `<p>${format('CALENDARIA.ContextMenu.DeleteConfirm', { name: this.document.name })}</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed) {
      const journal = this.document.parent;
      await this.close();
      if (journal.pages.size === 1) await journal.delete();
      else await this.document.delete();
    }
  }

  /**
   * Handle add custom preset button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onAddPreset(_event, target) {
    const form = target.closest('form');
    const input = form?.querySelector('.new-preset-input');
    const label = input?.value?.trim();
    if (!label) return;
    const newPreset = await addCustomPreset(label);
    input.value = '';
    this.render();
    ui.notifications.info(format('CALENDARIA.Info.PresetAdded', { label: newPreset.label }));
  }

  /**
   * Handle mode toggle button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onToggleMode(_event, _target) {
    if (!this.document.isOwner) return;
    this._mode = this._mode === CalendarNoteSheet.MODES.VIEW ? CalendarNoteSheet.MODES.EDIT : CalendarNoteSheet.MODES.VIEW;
    const windowContent = this.element.querySelector('.window-content');
    if (windowContent) windowContent.innerHTML = '';
    this.render();
  }

  /**
   * Open the condition builder dialog.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onOpenConditionBuilder(_event, _target) {
    const tree = this.document.system.conditionTree;
    const conditions = tree?.children?.length ? tree.children : this.document.system.conditions || [];
    new ConditionBuilderDialog({
      conditions,
      onChange: async (updated) => {
        const validation = validateConditions(updated);
        if (!validation.valid) {
          ui.notifications.error(localize('CALENDARIA.Condition.Builder.ValidationError'));
          log(2, 'Condition validation errors:', validation.errors);
          return;
        }
        const tree = updated.length ? wrapInRootGroup(updated) : null;
        const deps = tree ? extractEventDependencies(tree) : [];
        const updateData = { 'system.conditions': updated, 'system.conditionTree': tree };
        if (deps.length) {
          const { hasCycle } = detectCycles(this.document.id, deps);
          if (hasCycle) {
            ui.notifications.error(localize('CALENDARIA.Condition.Builder.CycleError'));
            return;
          }
          updateData['system.connectedEvents'] = deps;
        } else {
          updateData['system.connectedEvents'] = [];
        }
        await this.document.update(updateData);
        this.render();
      }
    }).render(true);
  }

  /**
   * Open the calendar editor to the festivals tab, focused on the linked festival.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onOpenFestivalEditor(_event, _target) {
    const linked = this.document.system.linkedFestival;
    if (!linked?.calendarId) return;
    new CalendarEditor({
      calendarId: linked.calendarId,
      initialTab: 'festivals',
      focusFestivalKey: linked.festivalKey
    }).render(true);
  }

  /**
   * Generate human-readable description for a condition.
   * @param {object} condition - Condition object
   * @param {object} calendar - Active calendar
   * @returns {string} Localized description
   */
  #getConditionDescription(condition, calendar) {
    const { field, op, value, offset } = condition;
    const fieldLabels = {
      year: localize('CALENDARIA.Common.Year'),
      month: localize('CALENDARIA.Common.Month'),
      day: localize('CALENDARIA.Common.Day'),
      dayOfYear: localize('CALENDARIA.Note.Condition.DayInYear'),
      daysBeforeMonthEnd: localize('CALENDARIA.Condition.Field.daysBeforeMonthEnd'),
      weekday: localize('CALENDARIA.Common.Weekday'),
      weekNumberInMonth: localize('CALENDARIA.Note.Condition.WeekdayNumInMonth'),
      inverseWeekNumber: localize('CALENDARIA.Note.Condition.InverseWeekNumber'),
      weekInMonth: localize('CALENDARIA.Condition.Field.weekInMonth'),
      weekInYear: localize('CALENDARIA.Condition.Field.weekInYear'),
      totalWeek: localize('CALENDARIA.Note.Condition.TotalWeek'),
      weeksBeforeMonthEnd: localize('CALENDARIA.Condition.Field.weeksBeforeMonthEnd'),
      weeksBeforeYearEnd: localize('CALENDARIA.Condition.Field.weeksBeforeYearEnd'),
      season: localize('CALENDARIA.Common.Season'),
      seasonPercent: localize('CALENDARIA.Note.Condition.SeasonPercent'),
      seasonDay: localize('CALENDARIA.Condition.Field.seasonDay'),
      isLongestDay: localize('CALENDARIA.Condition.Field.isLongestDay'),
      isShortestDay: localize('CALENDARIA.Condition.Field.isShortestDay'),
      isSpringEquinox: localize('CALENDARIA.Condition.Field.isSpringEquinox'),
      isAutumnEquinox: localize('CALENDARIA.Condition.Field.isAutumnEquinox'),
      moonPhaseIndex: localize('CALENDARIA.Common.MoonPhase'),
      moonPhaseCountMonth: localize('CALENDARIA.Note.Condition.MoonPhaseCountMonth'),
      moonPhaseCountYear: localize('CALENDARIA.Note.Condition.MoonPhaseCountYear'),
      cycle: localize('CALENDARIA.Common.Cycle'),
      era: localize('CALENDARIA.Common.Era'),
      eraYear: localize('CALENDARIA.Condition.Field.eraYear'),
      intercalary: localize('CALENDARIA.Note.Condition.IsIntercalaryDay')
    };
    const opLabels = {
      '==': localize('CALENDARIA.Note.Op.Equals'),
      '!=': localize('CALENDARIA.Note.Op.NotEquals'),
      '>=': localize('CALENDARIA.Note.Op.GreaterEquals'),
      '<=': localize('CALENDARIA.Note.Op.LessEquals'),
      '>': localize('CALENDARIA.Note.Op.Greater'),
      '<': localize('CALENDARIA.Note.Op.Less'),
      '%': localize('CALENDARIA.Note.Op.Every')
    };
    const fieldLabel = fieldLabels[field] || field;
    const opLabel = opLabels[op] || op;
    let valueStr = String(value);
    if (field === 'month' && calendar?.monthsArray?.[value - 1]) valueStr = localize(calendar.monthsArray[value - 1].name);
    if (field === 'weekday' && calendar?.weekdaysArray?.[value - 1]) valueStr = localize(calendar.weekdaysArray[value - 1].name);
    if (field === 'season' && calendar?.seasonsArray?.[value - 1]) valueStr = localize(calendar.seasonsArray[value - 1].name);
    if (field === 'era' && calendar?.erasArray?.[value - 1]) valueStr = localize(calendar.erasArray[value - 1].name);
    if (['isLongestDay', 'isShortestDay', 'isSpringEquinox', 'isAutumnEquinox', 'intercalary'].includes(field)) {
      return value ? fieldLabel : format('CALENDARIA.Note.Condition.Not', { field: fieldLabel });
    }
    if (op === '%') return offset ? format('CALENDARIA.Note.Condition.EveryWithOffset', { field: fieldLabel, value, offset }) : format('CALENDARIA.Note.Condition.Every', { field: fieldLabel, value });
    return `${fieldLabel} ${opLabel} ${valueStr}`;
  }
}
