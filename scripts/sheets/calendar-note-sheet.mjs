/**
 * Calendar Note Sheet
 * Sheet for editing calendar note journal entry pages with ProseMirror editor.
 * @module Sheets/CalendarNoteSheet
 * @author Tyler
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, TEMPLATES } from '../constants.mjs';
import { addCustomCategory, deleteCustomCategory, getAllCategories, getRepeatOptions, isCustomCategory } from '../notes/note-data.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { generateRandomOccurrences, getRecurrenceDescription, needsRandomRegeneration } from '../notes/utils/recurrence.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';

/**
 * Sheet application for calendar note journal entry pages.
 * @extends foundry.applications.sheets.journal.JournalEntryPageSheet
 */
export class CalendarNoteSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.journal.JournalEntryPageSheet) {
  static DEFAULT_OPTIONS = {
    classes: ['calendaria', 'calendar-note-sheet'],
    position: { width: 650, height: 850 },
    actions: {
      selectIcon: this._onSelectIcon,
      selectDate: this._onSelectDate,
      saveAndClose: this._onSaveAndClose,
      reset: this._onReset,
      deleteNote: this._onDeleteNote,
      addCategory: this._onAddCategory,
      toggleMode: this._onToggleMode,
      addMoonCondition: this._onAddMoonCondition,
      removeMoonCondition: this._onRemoveMoonCondition,
      regenerateSeed: this._onRegenerateSeed,
      clearLinkedEvent: this._onClearLinkedEvent,
      addCondition: this._onAddCondition,
      removeCondition: this._onRemoveCondition
    },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static MODES = Object.freeze({ VIEW: 1, EDIT: 2 });
  static VIEW_PARTS = { view: { template: TEMPLATES.SHEETS.CALENDAR_NOTE_VIEW } };
  static EDIT_PARTS = { form: { template: TEMPLATES.SHEETS.CALENDAR_NOTE_FORM } };

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

  /** @inheritdoc */
  _configureRenderOptions(options) {
    if (options.isFirstRender) {
      if (options.mode === 'edit' && this.document.isOwner) {
        this._mode = CalendarNoteSheet.MODES.EDIT;
        // Track if this is a new note (default name and no text content)
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

  /** @inheritdoc */
  async _onClose(options) {
    // Clean up empty notes that were never edited
    if (this._isNewNote && this.document) {
      const journal = this.document.parent;
      if (!journal || !game.journal.has(journal.id)) return super._onClose(options);
      const defaultName = localize('CALENDARIA.Note.NewNote');
      const hasDefaultName = this.document.name === defaultName;
      const hasNoContent = !this.document.text?.content?.trim();
      if (hasDefaultName && hasNoContent) {
        if (journal.pages?.size === 1) await journal.delete();
        else await this.document.delete();
        log(3, 'Deleted empty note on close');
      }
    }
    return super._onClose(options);
  }

  /** @inheritdoc */
  _configureRenderParts(options) {
    super._configureRenderParts(options);
    return this.isViewMode ? { ...this.constructor.VIEW_PARTS } : { ...this.constructor.EDIT_PARTS };
  }

  /** @inheritdoc */
  get title() {
    return this.document.name;
  }

  /** @inheritdoc */
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
        const categoryId = tag.dataset.key;
        if (!categoryId || !isCustomCategory(categoryId)) return;
        event.preventDefault();
        this.#showDeleteCategoryMenu(event, categoryId, tag.textContent.trim());
      });
    }

    const moonSelect = htmlElement.querySelector('select[name="newMoonCondition.moonIndex"]');
    const phaseSelect = htmlElement.querySelector('select[name="newMoonCondition.phase"]');
    if (moonSelect && phaseSelect) {
      moonSelect.addEventListener('change', () => {
        const selectedMoon = moonSelect.value;
        const phaseOptions = phaseSelect.querySelectorAll('option[data-moon]');
        phaseOptions.forEach((opt) => {
          opt.hidden = selectedMoon !== '' && opt.dataset.moon !== selectedMoon;
        });
        if (phaseSelect.selectedOptions[0]?.hidden) phaseSelect.value = '';
      });
    }

    const rangeTypeSelects = htmlElement.querySelectorAll('.range-type-select');
    rangeTypeSelects.forEach((select) => {
      select.addEventListener('change', async () => {
        const component = select.dataset.rangeType;
        const type = select.value;
        const rangePattern = foundry.utils.deepClone(this.document.system.rangePattern || {});
        if (type === 'any') {
          rangePattern[component] = [null, null];
        } else if (type === 'exact') {
          const defaults = { year: new Date().getFullYear(), month: 0, day: 1 };
          rangePattern[component] = defaults[component];
        } else if (type === 'range') {
          rangePattern[component] = [0, 0];
        }
        await this.document.update({ 'system.rangePattern': rangePattern });
      });
    });
  }

  /**
   * Show context menu to delete a custom category.
   * @param {MouseEvent} _event - The context menu event
   * @param {string} categoryId - The category ID
   * @param {string} categoryLabel - The category label for display
   */
  async #showDeleteCategoryMenu(_event, categoryId, categoryLabel) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Note.DeleteCategoryTitle') },
      content: `<p>${format('CALENDARIA.Note.DeleteCategoryConfirm', { label: categoryLabel })}</p><p class="hint">${localize('CALENDARIA.Note.DeleteCategoryHint')}</p>`,
      rejectClose: false,
      modal: true
    });

    if (confirmed) {
      const deleted = await deleteCustomCategory(categoryId);
      if (deleted) {
        ui.notifications.info(format('CALENDARIA.Info.CategoryDeleted', { label: categoryLabel }));
        this.render();
      }
    }
  }

  /** @inheritdoc */
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
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#renderHeaderControls();
    this.element.classList.toggle('view-mode', this.isViewMode);
    this.element.classList.toggle('edit-mode', this.isEditMode);
  }

  /**
   * Selectors for temporary form fields not backed by the data model.
   * @type {string[]}
   */
  static TRANSIENT_FIELDS = [
    'select[name="newCondition.field"]',
    'select[name="newCondition.op"]',
    'input[name="newCondition.value"]',
    'input[name="newCondition.offset"]',
    'select[name="newMoonCondition.moonIndex"]',
    'select[name="newMoonCondition.phase"]',
    'select[name="newMoonCondition.modifier"]',
    '.new-category-input'
  ];

  /** @inheritdoc */
  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);
    state.transientValues = {};
    for (const selector of this.constructor.TRANSIENT_FIELDS) {
      const el = priorElement.querySelector(selector);
      if (el) state.transientValues[selector] = el.value;
    }
  }

  /** @inheritdoc */
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
   * Creates mode toggle, save, reset, and delete buttons as appropriate.
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
      modeBtn.className = `header-control icon fas ${this.isViewMode ? 'fa-pen' : 'fa-eye'}`;
      modeBtn.dataset.action = 'toggleMode';
      modeBtn.dataset.tooltip = this.isViewMode ? 'Edit Note' : 'View Note';
      modeBtn.setAttribute('aria-label', this.isViewMode ? 'Edit Note' : 'View Note');
      controlsContainer.appendChild(modeBtn);
    }

    if (this.isEditMode) {
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'header-control icon fas fa-save';
      saveBtn.dataset.action = 'saveAndClose';
      saveBtn.dataset.tooltip = 'Save & Close';
      saveBtn.setAttribute('aria-label', 'Save & Close');
      controlsContainer.appendChild(saveBtn);
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'header-control icon fas fa-undo';
      resetBtn.dataset.action = 'reset';
      resetBtn.dataset.tooltip = 'Reset Form';
      resetBtn.setAttribute('aria-label', 'Reset Form');
      controlsContainer.appendChild(resetBtn);
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

  /** @inheritdoc */
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
    if (context.system.icon && context.system.icon.startsWith('fa')) context.iconType = 'fontawesome';
    else context.iconType = context.system.iconType || 'image';
    const startYear = this.document.system.startDate.year || currentYear;
    const startMonth = this.document.system.startDate.month ?? currentMonth;
    const startDay = this.document.system.startDate.day || currentDay;
    context.startDateDisplay = this._formatDateDisplay(calendar, startYear, startMonth, startDay);
    const endYear = this.document.system.endDate?.year || startYear;
    const endMonth = this.document.system.endDate?.month ?? startMonth;
    const endDay = this.document.system.endDate?.day || startDay;
    context.endDateDisplay = this._formatDateDisplay(calendar, endYear, endMonth, endDay);
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    context.maxHour = hoursPerDay - 1;
    const repeatType = this.document.system.repeat;
    const hasLinkedEvent = !!this.document.system.linkedEvent?.noteId;
    const isMonthless = calendar?.isMonthless ?? false;
    const allRepeatOptions = getRepeatOptions(repeatType);
    context.repeatOptions = isMonthless ? allRepeatOptions.filter((opt) => !['monthly', 'weekOfMonth'].includes(opt.value)) : allRepeatOptions;
    context.isMonthless = isMonthless;
    context.showRepeatOptions = repeatType !== 'never';
    context.moons =
      calendar?.moonsArray?.map((moon, index) => ({
        index,
        name: localize(moon.name),
        phases: Object.values(moon.phases ?? {}).map((phase) => ({ name: localize(phase.name), start: phase.start, end: phase.end }))
      })) ?? [];
    context.hasMoons = context.moons.length > 0;
    const modifierLabels = {
      any: null,
      rising: localize('CALENDARIA.Note.MoonModifier.Rising'),
      true: localize('CALENDARIA.Note.MoonModifier.True'),
      fading: localize('CALENDARIA.Note.MoonModifier.Fading')
    };
    context.moonConditions = (this.document.system.moonConditions || []).map((cond, index) => {
      const moon = context.moons[cond.moonIndex];
      const matchingPhase = Object.values(moon?.phases ?? {}).find((p) => Math.abs(p.start - cond.phaseStart) < 0.01 && Math.abs(p.end - cond.phaseEnd) < 0.01);
      const modifier = cond.modifier || 'any';
      return {
        index,
        moonIndex: cond.moonIndex,
        moonName: moon?.name,
        phaseStart: cond.phaseStart,
        phaseEnd: cond.phaseEnd,
        phaseName: matchingPhase?.name,
        modifier,
        modifierLabel: modifierLabels[modifier]
      };
    });
    context.showMoonConditions = this.document.system.repeat === 'moon' || this.document.system.moonConditions?.length > 0;
    context.showRandomConfig = this.document.system.repeat === 'random';
    const randomConfig = this.document.system.randomConfig || {};
    context.randomConfig = {
      seed: randomConfig.seed ?? Math.floor(Math.random() * 1000000),
      probability: randomConfig.probability ?? 10,
      checkInterval: randomConfig.checkInterval ?? 'daily',
      checkIntervalLabel: randomConfig.checkInterval === 'weekly' ? 'week' : randomConfig.checkInterval === 'monthly' ? 'month' : 'day'
    };
    context.randomIntervalOptions = [
      { value: 'daily', label: localize('CALENDARIA.Note.IntervalDaily'), selected: context.randomConfig.checkInterval === 'daily' },
      { value: 'weekly', label: localize('CALENDARIA.Note.IntervalWeekly'), selected: context.randomConfig.checkInterval === 'weekly' },
      { value: 'monthly', label: localize('CALENDARIA.Note.IntervalMonthly'), selected: context.randomConfig.checkInterval === 'monthly' }
    ];

    context.showLinkedConfig = hasLinkedEvent || this.document.system.repeat === 'linked';
    const linkedEvent = this.document.system.linkedEvent || {};
    context.linkedEvent = { noteId: linkedEvent.noteId, offset: linkedEvent.offset ?? 0 };
    const allNotes = NoteManager.getAllNotes() || [];
    context.availableNotes = allNotes.filter((note) => note.id !== this.document.id).map((note) => ({ id: note.id, name: note.name, selected: note.id === linkedEvent.noteId }));

    if (linkedEvent.noteId) {
      const linkedNote = NoteManager.getNote(linkedEvent.noteId);
      context.linkedNoteName = linkedNote?.name || localize('CALENDARIA.Note.UnknownEvent');
    }

    context.showRangeConfig = this.document.system.repeat === 'range';
    const rangePattern = this.document.system.rangePattern || {};
    const getRangeType = (bit) => {
      if (bit == null || (Array.isArray(bit) && bit[0] === null && bit[1] === null)) return 'any';
      if (typeof bit === 'number') return 'exact';
      if (Array.isArray(bit)) return 'range';
      return 'any';
    };

    const yearType = getRangeType(rangePattern.year);
    context.rangeYearAny = yearType === 'any';
    context.rangeYearExact = yearType === 'exact';
    context.rangeYearRange = yearType === 'range';
    context.rangeYearValue = yearType === 'exact' ? rangePattern.year : '';
    context.rangeYearMin = yearType === 'range' ? (rangePattern.year[0] ?? '') : '';
    context.rangeYearMax = yearType === 'range' ? (rangePattern.year[1] ?? '') : '';
    const monthType = getRangeType(rangePattern.month);
    context.rangeMonthAny = monthType === 'any';
    context.rangeMonthExact = monthType === 'exact';
    context.rangeMonthRange = monthType === 'range';
    const rangeMonthValue = monthType === 'exact' ? rangePattern.month : null;
    const rangeMonthMin = monthType === 'range' ? rangePattern.month[0] : null;
    const rangeMonthMax = monthType === 'range' ? rangePattern.month[1] : null;
    const months = calendar?.monthsArray ?? [];
    context.monthOptions = months.map((m, idx) => ({ index: idx, name: localize(m.name), selected: rangeMonthValue === idx, selectedMin: rangeMonthMin === idx, selectedMax: rangeMonthMax === idx }));
    const dayType = getRangeType(rangePattern.day);
    context.rangeDayAny = dayType === 'any';
    context.rangeDayExact = dayType === 'exact';
    context.rangeDayRange = dayType === 'range';
    context.rangeDayValue = dayType === 'exact' ? rangePattern.day : '';
    context.rangeDayMin = dayType === 'range' ? (rangePattern.day[0] ?? '') : '';
    context.rangeDayMax = dayType === 'range' ? (rangePattern.day[1] ?? '') : '';
    context.showWeekOfMonthConfig = this.document.system.repeat === 'weekOfMonth';
    context.weekNumber = this.document.system.weekNumber ?? 1;
    const weekdays = calendar?.weekdaysArray ?? [];
    const selectedWeekday = this.document.system.weekday ?? 0;
    context.weekdayOptions = weekdays.map((wd, idx) => ({ index: idx, name: localize(wd.name), selected: idx === selectedWeekday }));
    const selectedWeekNumber = this.document.system.weekNumber ?? 1;
    context.weekNumberOptions = [
      { value: 1, label: localize('CALENDARIA.Note.WeekOrdinal1st'), selected: selectedWeekNumber === 1 },
      { value: 2, label: localize('CALENDARIA.Note.WeekOrdinal2nd'), selected: selectedWeekNumber === 2 },
      { value: 3, label: localize('CALENDARIA.Note.WeekOrdinal3rd'), selected: selectedWeekNumber === 3 },
      { value: 4, label: localize('CALENDARIA.Note.WeekOrdinal4th'), selected: selectedWeekNumber === 4 },
      { value: 5, label: localize('CALENDARIA.Note.WeekOrdinal5th'), selected: selectedWeekNumber === 5 },
      { value: -1, label: localize('CALENDARIA.Note.WeekOrdinalLast'), selected: selectedWeekNumber === -1 },
      { value: -2, label: localize('CALENDARIA.Note.WeekOrdinal2ndLast'), selected: selectedWeekNumber === -2 }
    ];

    if (context.showWeekOfMonthConfig) {
      const ordinals =
        context.weekNumber > 0
          ? [
              localize('CALENDARIA.Note.WeekOrdinal1st'),
              localize('CALENDARIA.Note.WeekOrdinal2nd'),
              localize('CALENDARIA.Note.WeekOrdinal3rd'),
              localize('CALENDARIA.Note.WeekOrdinal4th'),
              localize('CALENDARIA.Note.WeekOrdinal5th')
            ]
          : [localize('CALENDARIA.Note.WeekOrdinalLast'), localize('CALENDARIA.Note.WeekOrdinal2ndLast')];
      const ordinal =
        context.weekNumber > 0 ? ordinals[context.weekNumber - 1] || `${context.weekNumber}th` : ordinals[Math.abs(context.weekNumber) - 1] || localize('CALENDARIA.Note.WeekOrdinalLast');
      const weekdayName = context.weekdayOptions[selectedWeekday]?.name || localize('CALENDARIA.Common.Day');
      context.weekOfMonthDescription = format('CALENDARIA.Note.WeekOfMonthDescription', { ordinal, weekday: weekdayName });
    }

    context.showSeasonalConfig = this.document.system.repeat === 'seasonal';
    const seasonalConfig = this.document.system.seasonalConfig || { seasonIndex: 0, trigger: 'entire' };
    context.seasonalTrigger = seasonalConfig.trigger || 'entire';
    const seasons = calendar?.seasonsArray ?? [];
    context.seasonOptions = seasons.map((s, idx) => ({ index: idx, name: localize(s.name), selected: idx === seasonalConfig.seasonIndex }));
    context.hasSeasons = seasons.length > 0;
    const triggerChoices = this.document.system.schema.fields.seasonalConfig?.fields?.trigger?.choices || ['entire', 'firstDay', 'lastDay'];
    const triggerLabels = { entire: 'Entire Season', firstDay: 'First Day', lastDay: 'Last Day' };
    context.seasonalTriggerOptions = triggerChoices.map((value) => ({ value, label: triggerLabels[value] || value, selected: seasonalConfig.trigger === value }));
    if (context.showSeasonalConfig && context.hasSeasons) {
      const seasonName = context.seasonOptions[seasonalConfig.seasonIndex]?.name;
      switch (seasonalConfig.trigger) {
        case 'firstDay':
          context.seasonalDescription = `Occurs on the first day of ${seasonName}`;
          break;
        case 'lastDay':
          context.seasonalDescription = `Occurs on the last day of ${seasonName}`;
          break;
        default:
          context.seasonalDescription = `Occurs every day during ${seasonName}`;
      }
    }

    context.showConditionsUI = repeatType !== 'never';
    context.hasCycles = (calendar?.cyclesArray?.length ?? 0) > 0;
    context.hasEras = (calendar?.erasArray?.length ?? 0) > 0;
    context.showRepeatConfigGrid =
      context.showMoonConditions ||
      context.showRandomConfig ||
      context.showLinkedConfig ||
      context.showRangeConfig ||
      context.showWeekOfMonthConfig ||
      context.showSeasonalConfig ||
      context.showConditionsUI;
    const rawConditions = this.document.system.conditions || [];
    context.conditions = rawConditions.map((cond, idx) => ({ ...cond, index: idx, description: this.#getConditionDescription(cond, calendar) }));
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
      { value: 'gm', label: localize('CALENDARIA.Note.ReminderTargetGM'), selected: currentReminderTargets === 'gm' },
      { value: 'author', label: localize('CALENDARIA.Note.ReminderTargetAuthor'), selected: currentReminderTargets === 'author' },
      { value: 'specific', label: localize('CALENDARIA.Note.ReminderTargetSpecific'), selected: currentReminderTargets === 'specific' }
    ];
    context.showReminderUsers = currentReminderTargets === 'specific';
    const selectedReminderUsers = this.document.system.reminderUsers || [];
    context.userOptions = game.users.contents.map((u) => ({ id: u.id, name: u.name, selected: selectedReminderUsers.includes(u.id) }));
    const selectedCategories = this.document.system.categories || [];
    context.categoryOptions = getAllCategories().map((cat) => ({ ...cat, selected: selectedCategories.includes(cat.id) }));
    const currentMacro = this.document.system.macro || '';
    context.availableMacros = game.macros.contents.map((m) => ({ id: m.id, name: m.name, selected: m.id === currentMacro }));
    context.isViewMode = this.isViewMode;
    context.isEditMode = this.isEditMode;
    context.isGM = game.user.isGM;
    context.canEdit = this.document.isOwner;
    if (this.isViewMode) {
      context.enrichedContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.document.text?.content || '', {
        async: true,
        relativeTo: this.document,
        secrets: this.document.isOwner
      });
      const allCategories = getAllCategories();
      context.displayCategories = selectedCategories.map((id) => allCategories.find((c) => c.id === id)?.label).filter(Boolean);
      context.hasEndDate = endYear !== startYear || endMonth !== startMonth || endDay !== startDay;
      const startHour = String(this.document.system.startDate.hour ?? 12).padStart(2, '0');
      const startMinute = String(this.document.system.startDate.minute ?? 0).padStart(2, '0');
      const endHour = String(this.document.system.endDate?.hour ?? ((this.document.system.startDate.hour ?? 12) + 1) % hoursPerDay).padStart(2, '0');
      const endMinute = String(this.document.system.endDate?.minute ?? this.document.system.startDate.minute ?? 0).padStart(2, '0');
      context.startTimeDisplay = `${startHour}:${startMinute}`;
      context.endTimeDisplay = `${endHour}:${endMinute}`;
      context.hasEndTime = this.document.system.endDate?.hour !== undefined || this.document.system.endDate?.minute !== undefined;
      const repeatLabels = { never: null, daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', moon: 'Moon Phase' };
      context.repeatLabel = repeatLabels[this.document.system.repeat] || null;
      if (this.document.system.moonConditions?.length > 0) context.moonConditionsDisplay = getRecurrenceDescription(this.document.system);
    }

    return context;
  }

  /** @inheritdoc */
  _onChangeForm(formConfig, event) {
    const target = event.target;
    super._onChangeForm(formConfig, event);

    if (target?.name === 'system.allDay') {
      const timeInputs = this.element.querySelectorAll('.time-inputs input[type="number"]');
      timeInputs.forEach((input) => (input.disabled = target.checked));
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
      this.element.querySelector('select[name="system.reminderTargets"]').disabled = disabled;
      this.element.querySelector('input[name="system.reminderOffset"]').disabled = disabled;
    }
  }

  /**
   * Offer to apply icon and color from a newly added category.
   * @param {string} categoryId - The ID of the newly added category
   * @private
   */
  async #applyCategoryStyle(categoryId) {
    const category = getAllCategories().find((c) => c.id === categoryId);
    if (!category) return;
    const updates = {};
    if (category.icon) updates['system.icon'] = `fas ${category.icon}`;
    if (category.color) updates['system.color'] = category.color;
    if (Object.keys(updates).length === 0) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Note.ApplyCategoryStyleTitle') },
      content: `<p style="text-align:center;font-size:2rem;margin:0.5rem 0"><i class="fas ${category.icon}" style="color:${category.color}"></i></p><p>${format('CALENDARIA.Note.ApplyCategoryStyleConfirm', { label: category.label })}</p>`,
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return;
    await this.document.update(updates);
  }

  /**
   * Process form data to convert range pattern UI fields into proper structure.
   * @param {Event} event - Form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {object} formData - Extended form data
   * @inheritdoc
   */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const repeatType = data.system?.repeat;
    if (repeatType !== 'linked') data.system.linkedEvent = null;
    else if (data.system.linkedEvent && !data.system.linkedEvent.noteId) data.system.linkedEvent = null;
    if (repeatType !== 'random') data.system.randomConfig = null;
    if (repeatType !== 'moon' && data.system.moonConditions === undefined) data.system.moonConditions = [];
    if (repeatType !== 'weekOfMonth') {
      data.system.weekday = null;
      data.system.weekNumber = null;
    }

    if (repeatType !== 'seasonal') data.system.seasonalConfig = null;
    if (repeatType === 'range') {
      const rangePattern = {};
      const getRangeValue = (component) => {
        const typeSelect = form.querySelector(`select[data-range-type="${component}"]`);
        if (!typeSelect) return null;
        const type = typeSelect.value;
        if (type === 'any') return [null, null];
        if (type === 'exact') {
          const valueInput =
            form.querySelector(`input[name="range${component.charAt(0).toUpperCase() + component.slice(1)}"]`) ||
            form.querySelector(`select[name="range${component.charAt(0).toUpperCase() + component.slice(1)}"]`);
          if (!valueInput || valueInput.value === '') return null;
          return Number(valueInput.value);
        }
        if (type === 'range') {
          const minInput =
            form.querySelector(`input[name="range${component.charAt(0).toUpperCase() + component.slice(1)}Min"]`) ||
            form.querySelector(`select[name="range${component.charAt(0).toUpperCase() + component.slice(1)}Min"]`);
          const maxInput =
            form.querySelector(`input[name="range${component.charAt(0).toUpperCase() + component.slice(1)}Max"]`) ||
            form.querySelector(`select[name="range${component.charAt(0).toUpperCase() + component.slice(1)}Max"]`);
          const min = minInput && minInput.value !== '' ? Number(minInput.value) : null;
          const max = maxInput && maxInput.value !== '' ? Number(maxInput.value) : null;
          return [min, max];
        }
        return null;
      };
      rangePattern.year = getRangeValue('year');
      rangePattern.month = getRangeValue('month');
      rangePattern.day = getRangeValue('day');
      data.system.rangePattern = rangePattern;
    } else {
      data.system.rangePattern = null;
    }
    return data;
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
    const colorInput = form?.querySelector('input[name="system.color"]');
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
   * Format a date for display using the calendar system
   * @param {object} calendar - The calendar to use
   * @param {number} year - The year
   * @param {number} month - The month index (0-based)
   * @param {number} day - The day
   * @returns {string} - Formatted date string
   * @private
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
   * Handle date selection button click
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
    const dayInput = form.querySelector(`input[name="system.${dateField}.day"]`);
    const currentYear = parseInt(yearInput?.value) || fallbackYear;
    const parsedMonth = parseInt(monthInput?.value);
    const currentMonth = !isNaN(parsedMonth) ? parsedMonth : fallbackMonth;
    const currentDay = parseInt(dayInput?.value) || fallbackDay;
    const result = await CalendarNoteSheet._showDatePickerDialog(calendar, currentYear, currentMonth, currentDay);
    if (!result) return;
    if (yearInput) yearInput.value = result.year;
    if (monthInput) monthInput.value = result.month;
    if (dayInput) dayInput.value = result.day;
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

    const changeEvent = new Event('change', { bubbles: true });
    form.dispatchEvent(changeEvent);
  }

  /**
   * Show date picker dialog
   * @param {object} calendar - The calendar to use
   * @param {number} currentYear - Current year
   * @param {number} currentMonth - Current month (0-based)
   * @param {number} currentDay - Current day
   * @returns {Promise<{year: number, month: number, day: number}|null>} Dialog
   * @private
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
   * Handle save and close button click
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
   * Handle delete note button click
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onDeleteNote(_event, _target) {
    if (!this.isAuthor && !game.user.isGM) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.ContextMenu.DeleteNote') },
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
   * Handle reset button click
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onReset(_event, _target) {
    const calendar = CalendarManager.getActiveCalendar();
    const currentDateTime = CalendarManager.getCurrentDateTime();
    const currentYear = currentDateTime.year;
    const currentMonth = currentDateTime.month;
    const currentDay = currentDateTime.day;
    const currentHour = currentDateTime.hour;
    const currentMinute = currentDateTime.minute;
    const form = this.element;
    const titleInput = form.querySelector('input[name="name"]');
    if (titleInput) titleInput.value = localize('CALENDARIA.Note.NewNote');
    const iconInput = form.querySelector('input[name="system.icon"]');
    const iconTypeInput = form.querySelector('input[name="system.iconType"]');
    const colorInput = form.querySelector('input[name="system.color"]');
    if (iconInput) iconInput.value = 'icons/svg/book.svg';
    if (iconTypeInput) iconTypeInput.value = 'image';
    if (colorInput) colorInput.value = '#4a9eff';
    const iconPicker = form.querySelector('.icon-picker');
    if (iconPicker) {
      iconPicker.dataset.iconType = 'image';
      const existingIcon = iconPicker.querySelector('i, img');
      if (existingIcon) {
        const img = document.createElement('img');
        img.src = 'icons/svg/book.svg';
        img.alt = 'Note Icon';
        img.className = 'icon-preview';
        img.style.filter = 'drop-shadow(0px 1000px 0 #4a9eff)';
        img.style.transform = 'translateY(-1000px)';
        existingIcon.replaceWith(img);
      }
    }

    const gmOnlyInput = form.querySelector('input[name="system.gmOnly"]');
    if (gmOnlyInput) gmOnlyInput.checked = game.user.isGM;
    const startYearInput = form.querySelector('input[name="system.startDate.year"]');
    const startMonthInput = form.querySelector('input[name="system.startDate.month"]');
    const startDayInput = form.querySelector('input[name="system.startDate.day"]');
    if (startYearInput) startYearInput.value = currentYear;
    if (startMonthInput) startMonthInput.value = currentMonth;
    if (startDayInput) startDayInput.value = currentDay;
    const endYearInput = form.querySelector('input[name="system.endDate.year"]');
    const endMonthInput = form.querySelector('input[name="system.endDate.month"]');
    const endDayInput = form.querySelector('input[name="system.endDate.day"]');
    if (endYearInput) endYearInput.value = currentYear;
    if (endMonthInput) endMonthInput.value = currentMonth;
    if (endDayInput) endDayInput.value = currentDay;
    const dateDisplay = this._formatDateDisplay(calendar, currentYear, currentMonth, currentDay);
    const startDateDisplay = form.querySelector('[data-date-field="startDate"] .date-display');
    const endDateDisplay = form.querySelector('[data-date-field="endDate"] .date-display');
    if (startDateDisplay) startDateDisplay.textContent = dateDisplay;
    if (endDateDisplay) endDateDisplay.textContent = dateDisplay;
    const startHourInput = form.querySelector('input[name="system.startDate.hour"]');
    const startMinuteInput = form.querySelector('input[name="system.startDate.minute"]');
    const endHourInput = form.querySelector('input[name="system.endDate.hour"]');
    const endMinuteInput = form.querySelector('input[name="system.endDate.minute"]');
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    if (startHourInput) startHourInput.value = currentHour;
    if (startMinuteInput) startMinuteInput.value = currentMinute;
    if (endHourInput) endHourInput.value = (currentHour + 1) % hoursPerDay;
    if (endMinuteInput) endMinuteInput.value = currentMinute;
    const allDayInput = form.querySelector('input[name="system.allDay"]');
    if (allDayInput) {
      allDayInput.checked = false;
      const timeInputs = form.querySelectorAll('.time-inputs input[type="number"]');
      timeInputs.forEach((input) => (input.disabled = false));
    }

    const repeatSelect = form.querySelector('select[name="system.repeat"]');
    if (repeatSelect) repeatSelect.value = 'never';
    const multiSelect = form.querySelector('multi-select[name="system.categories"]');
    if (multiSelect) {
      multiSelect.querySelectorAll('option').forEach((opt) => (opt.selected = false));
      multiSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const newCategoryInput = form.querySelector('.new-category-input');
    if (newCategoryInput) newCategoryInput.value = '';

    const proseMirror = form.querySelector('prose-mirror#note-content');
    if (proseMirror) {
      proseMirror.value = '';
      const editorContent = proseMirror.querySelector('.ProseMirror');
      if (editorContent) editorContent.innerHTML = '<p></p>';
    }
  }

  /**
   * Handle add custom category button click
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onAddCategory(_event, target) {
    const form = target.closest('form');
    const input = form?.querySelector('.new-category-input');
    const label = input?.value?.trim();
    if (!label) return;
    const newCategory = await addCustomCategory(label);
    input.value = '';
    this.render();
    ui.notifications.info(format('CALENDARIA.Info.CategoryAdded', { label: newCategory.label }));
  }

  /**
   * Handle mode toggle button click
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
   * Handle add moon condition button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onAddMoonCondition(_event, target) {
    const form = target.closest('form');
    const moonSelect = form?.querySelector('select[name="newMoonCondition.moonIndex"]');
    const phaseSelect = form?.querySelector('select[name="newMoonCondition.phase"]');
    const modifierSelect = form?.querySelector('select[name="newMoonCondition.modifier"]');
    if (!moonSelect || !phaseSelect) return;
    const moonIndex = parseInt(moonSelect.value);
    const phaseValue = phaseSelect.value;
    const modifier = modifierSelect?.value || 'any';
    if (isNaN(moonIndex) || !phaseValue) return;
    const [phaseStart, phaseEnd] = phaseValue.split('-').map(Number);
    const currentConditions = foundry.utils.deepClone(this.document.system.moonConditions || []);
    const isDuplicate = currentConditions.some((c) => c.moonIndex === moonIndex && c.phaseStart === phaseStart && c.phaseEnd === phaseEnd && c.modifier === modifier);
    if (isDuplicate) return;
    currentConditions.push({ moonIndex, phaseStart, phaseEnd, modifier });
    await this.document.update({ 'system.moonConditions': currentConditions });
  }

  /**
   * Handle remove moon condition button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onRemoveMoonCondition(_event, target) {
    const conditionIndex = parseInt(target.dataset.index);
    if (isNaN(conditionIndex)) return;
    const currentConditions = foundry.utils.deepClone(this.document.system.moonConditions || []);
    currentConditions.splice(conditionIndex, 1);
    await this.document.update({ 'system.moonConditions': currentConditions });
  }

  /**
   * Handle regenerate seed button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onRegenerateSeed(_event, _target) {
    const newSeed = Math.floor(Math.random() * 1000000);
    const currentConfig = foundry.utils.deepClone(this.document.system.randomConfig || {});
    currentConfig.seed = newSeed;
    await this.document.update({ 'system.randomConfig': currentConfig });
    await this.#regenerateRandomOccurrences();
  }

  /**
   * Regenerate cached random occurrences for this note.
   * Generates occurrences until end of current year (or next year if approaching year end).
   * @returns {Promise<void>}
   */
  async #regenerateRandomOccurrences() {
    if (this.document.system.repeat !== 'random') return;
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.monthsArray) return;
    const components = game.time.components || {};
    const yearZero = calendar?.years?.yearZero ?? 0;
    const currentYear = (components.year ?? 0) + yearZero;
    const generateNextYear = needsRandomRegeneration({ year: currentYear, occurrences: [] });
    const targetYear = generateNextYear ? currentYear + 1 : currentYear;
    const noteData = { startDate: this.document.system.startDate, randomConfig: this.document.system.randomConfig, repeatEndDate: this.document.system.repeatEndDate };
    const occurrences = generateRandomOccurrences(noteData, targetYear);
    await this.document.setFlag(MODULE.ID, 'randomOccurrences', { year: targetYear, generatedAt: Date.now(), occurrences });
    log(2, `Generated ${occurrences.length} random occurrences for ${this.document.name} until year ${targetYear}`);
  }

  /** @inheritdoc */
  async _processSubmitData(event, form, submitData, options = {}) {
    const newCategories = submitData.system?.categories || [];
    const oldCategories = this.document.system.categories || [];
    const addedCategory = newCategories.find((id) => !oldCategories.includes(id));
    await super._processSubmitData(event, form, submitData, options);
    if (submitData.system?.repeat === 'random') setTimeout(() => this.#regenerateRandomOccurrences(), 100);
    if (addedCategory) await this.#applyCategoryStyle(addedCategory);
  }

  /**
   * Handle clear linked event button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onClearLinkedEvent(_event, _target) {
    await this.document.update({ 'system.linkedEvent': null });
  }

  /**
   * Handle add condition button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onAddCondition(_event, target) {
    const form = target.closest('form');
    const fieldSelect = form?.querySelector('select[name="newCondition.field"]');
    const opSelect = form?.querySelector('select[name="newCondition.op"]');
    const valueInput = form?.querySelector('input[name="newCondition.value"]');
    const offsetInput = form?.querySelector('input[name="newCondition.offset"]');
    if (!fieldSelect || !opSelect || !valueInput) return;
    const field = fieldSelect.value;
    const op = opSelect.value;
    const rawValue = valueInput.value;
    const offset = parseInt(offsetInput?.value) || 0;
    if (!field || rawValue === '') return;
    let value;
    const booleanFields = ['isLongestDay', 'isShortestDay', 'isSpringEquinox', 'isAutumnEquinox', 'intercalary'];
    if (booleanFields.includes(field)) {
      value = rawValue === 'true' || rawValue === '1';
    } else {
      value = parseFloat(rawValue);
      if (isNaN(value)) value = parseInt(rawValue);
    }

    const currentConditions = foundry.utils.deepClone(this.document.system.conditions || []);
    const newCondition = { field, op, value };
    if (op === '%' && offset !== 0) newCondition.offset = offset;
    currentConditions.push(newCondition);
    await this.document.update({ 'system.conditions': currentConditions });
    valueInput.value = '';
    if (offsetInput) offsetInput.value = '';
  }

  /**
   * Handle remove condition button click.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onRemoveCondition(_event, target) {
    const conditionIndex = parseInt(target.dataset.index);
    if (isNaN(conditionIndex)) return;
    const currentConditions = foundry.utils.deepClone(this.document.system.conditions || []);
    currentConditions.splice(conditionIndex, 1);
    await this.document.update({ 'system.conditions': currentConditions });
  }

  /**
   * Generate human-readable description for a condition.
   * @param {object} condition - Condition object
   * @param {object} calendar - Active calendar
   * @returns {string} - Localized description
   */
  #getConditionDescription(condition, calendar) {
    const { field, op, value, offset } = condition;

    const fieldLabels = {
      year: localize('CALENDARIA.Note.Condition.Year'),
      month: localize('CALENDARIA.Note.Condition.Month'),
      day: localize('CALENDARIA.Note.Condition.Day'),
      dayOfYear: localize('CALENDARIA.Note.Condition.DayInYear'),
      daysBeforeMonthEnd: localize('CALENDARIA.Note.Condition.DaysBeforeMonthEnd'),
      weekday: localize('CALENDARIA.Note.Condition.Weekday'),
      weekNumberInMonth: localize('CALENDARIA.Note.Condition.WeekdayNumInMonth'),
      inverseWeekNumber: localize('CALENDARIA.Note.Condition.InverseWeekNumber'),
      weekInMonth: localize('CALENDARIA.Note.Condition.WeekInMonth'),
      weekInYear: localize('CALENDARIA.Note.Condition.WeekInYear'),
      totalWeek: localize('CALENDARIA.Note.Condition.TotalWeek'),
      weeksBeforeMonthEnd: localize('CALENDARIA.Note.Condition.WeeksBeforeMonthEnd'),
      weeksBeforeYearEnd: localize('CALENDARIA.Note.Condition.WeeksBeforeYearEnd'),
      season: localize('CALENDARIA.Note.Condition.Season'),
      seasonPercent: localize('CALENDARIA.Note.Condition.SeasonPercent'),
      seasonDay: localize('CALENDARIA.Note.Condition.DayInSeason'),
      isLongestDay: localize('CALENDARIA.Note.Condition.IsLongestDay'),
      isShortestDay: localize('CALENDARIA.Note.Condition.IsShortestDay'),
      isSpringEquinox: localize('CALENDARIA.Note.Condition.IsSpringEquinox'),
      isAutumnEquinox: localize('CALENDARIA.Note.Condition.IsAutumnEquinox'),
      moonPhaseIndex: localize('CALENDARIA.Note.Condition.MoonPhase'),
      moonPhaseCountMonth: localize('CALENDARIA.Note.Condition.MoonPhaseCountMonth'),
      moonPhaseCountYear: localize('CALENDARIA.Note.Condition.MoonPhaseCountYear'),
      cycle: localize('CALENDARIA.Note.Condition.Cycle'),
      era: localize('CALENDARIA.Note.Condition.Era'),
      eraYear: localize('CALENDARIA.Note.Condition.EraYear'),
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
    if (op === '%') {
      return offset ? format('CALENDARIA.Note.Condition.EveryWithOffset', { field: fieldLabel, value, offset }) : format('CALENDARIA.Note.Condition.Every', { field: fieldLabel, value });
    }
    return `${fieldLabel} ${opLabel} ${valueStr}`;
  }
}
