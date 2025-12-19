/**
 * Calendar Note Sheet
 * Sheet for editing calendar note journal entry pages with ProseMirror editor.
 *
 * @module Sheets/CalendarNoteSheet
 * @author Tyler
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

import { MODULE, SETTINGS, TEMPLATES } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { getAllCategories, addCustomCategory, deleteCustomCategory, isCustomCategory, getRepeatOptions } from '../notes/note-data.mjs';
import { getRecurrenceDescription, generateRandomOccurrences, needsRandomRegeneration } from '../notes/utils/recurrence.mjs';
import NoteManager from '../notes/note-manager.mjs';

export class CalendarNoteSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.journal.JournalEntryPageSheet) {
  /** View/Edit mode enum. */
  static MODES = Object.freeze({ VIEW: 1, EDIT: 2 });

  /** Current sheet mode. */
  _mode = CalendarNoteSheet.MODES.VIEW;

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
      clearLinkedEvent: this._onClearLinkedEvent
    },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static VIEW_PARTS = { view: { template: TEMPLATES.SHEETS.CALENDAR_NOTE_VIEW } };

  static EDIT_PARTS = { form: { template: TEMPLATES.SHEETS.CALENDAR_NOTE_FORM } };

  /** @returns {boolean} Whether currently in view mode. */
  get isViewMode() {
    return this._mode === CalendarNoteSheet.MODES.VIEW;
  }

  /** @returns {boolean} Whether currently in edit mode. */
  get isEditMode() {
    return this._mode === CalendarNoteSheet.MODES.EDIT;
  }

  /** @inheritdoc - Set mode BEFORE _configureRenderParts is called. */
  _configureRenderOptions(options) {
    if (options.isFirstRender) {
      if (options.mode === 'view') this._mode = CalendarNoteSheet.MODES.VIEW;
      else if (options.mode === 'edit' && this.document.isOwner) this._mode = CalendarNoteSheet.MODES.EDIT;
      else if (this.document.isOwner) this._mode = CalendarNoteSheet.MODES.EDIT;
      else this._mode = CalendarNoteSheet.MODES.VIEW;
    }
    super._configureRenderOptions(options);
  }

  /** @inheritdoc */
  _configureRenderParts(options) {
    return this.isViewMode ? { ...this.constructor.VIEW_PARTS } : { ...this.constructor.EDIT_PARTS };
  }

  /** @inheritdoc */
  get title() {
    return this.document.name;
  }

  /** @inheritdoc */
  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    // Add contextmenu listener for icon picker
    const iconPicker = htmlElement.querySelector('.icon-picker');
    if (iconPicker) {
      iconPicker.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.constructor._switchIconMode(event, iconPicker);
      });
    }

    // Add contextmenu listener for category tags (to delete custom categories)
    // Use event delegation on the container since tags are rendered dynamically
    const categoriesContainer = htmlElement.querySelector('.categories-container');
    if (categoriesContainer) {
      categoriesContainer.addEventListener('contextmenu', (event) => {
        log(3, 'Categories contextmenu event', event.target, event.target.className);

        // Try multiple possible selectors for the tag element
        const tag = event.target.closest('.tag');
        if (!tag) return;

        // Foundry multi-select uses data-key for the tag value
        const categoryId = tag.dataset.key;
        log(3, 'Tag found', tag, 'categoryId:', categoryId);

        if (!categoryId || !isCustomCategory(categoryId)) return;

        event.preventDefault();
        this.#showDeleteCategoryMenu(event, categoryId, tag.textContent.trim());
      });
    }

    // Add moon phase filter listener
    const moonSelect = htmlElement.querySelector('select[name="newMoonCondition.moonIndex"]');
    const phaseSelect = htmlElement.querySelector('select[name="newMoonCondition.phase"]');
    if (moonSelect && phaseSelect) {
      moonSelect.addEventListener('change', () => {
        const selectedMoon = moonSelect.value;
        const phaseOptions = phaseSelect.querySelectorAll('option[data-moon]');
        phaseOptions.forEach((opt) => {
          opt.hidden = selectedMoon !== '' && opt.dataset.moon !== selectedMoon;
        });
        // Reset phase selection if hidden
        if (phaseSelect.selectedOptions[0]?.hidden) phaseSelect.value = '';
      });
    }

    // Add range type select listeners - update document and re-render
    const rangeTypeSelects = htmlElement.querySelectorAll('.range-type-select');
    rangeTypeSelects.forEach((select) => {
      select.addEventListener('change', async () => {
        const component = select.dataset.rangeType; // 'year', 'month', 'day'
        const type = select.value;
        const rangePattern = foundry.utils.deepClone(this.document.system.rangePattern || {});

        // Set initial value based on type
        if (type === 'any') {
          rangePattern[component] = [null, null];
        } else if (type === 'exact') {
          // Default to 0 for month, 1 for day, current year for year
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
   * @param {MouseEvent} event - The context menu event
   * @param {string} categoryId - The category ID
   * @param {string} categoryLabel - The category label for display
   */
  async #showDeleteCategoryMenu(event, categoryId, categoryLabel) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Delete Category' },
      content: `<p>Delete custom category "${categoryLabel}"?</p><p class="hint">This will remove it from the list but won't affect notes already using it.</p>`,
      rejectClose: false,
      modal: true
    });

    if (confirmed) {
      const deleted = await deleteCustomCategory(categoryId);
      if (deleted) {
        ui.notifications.info(`Category "${categoryLabel}" deleted`);
        this.render();
      }
    }
  }

  /** @inheritdoc */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.#renderHeaderControls();
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#renderHeaderControls();

    // Add view/edit mode class to element
    this.element.classList.toggle('view-mode', this.isViewMode);
    this.element.classList.toggle('edit-mode', this.isEditMode);
  }

  /** Render header control buttons based on current mode. */
  #renderHeaderControls() {
    const windowHeader = this.element.querySelector('.window-header');
    if (!windowHeader) return;

    // Find or create a controls container at the beginning of the header
    let controlsContainer = windowHeader.querySelector('.header-controls');
    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.className = 'header-controls';
      windowHeader.insertBefore(controlsContainer, windowHeader.firstChild);
    }

    // Clear existing controls
    controlsContainer.innerHTML = '';

    // Mode toggle button (for users with edit permission)
    if (this.document.isOwner) {
      const modeBtn = document.createElement('button');
      modeBtn.type = 'button';
      modeBtn.className = `header-control icon fas ${this.isViewMode ? 'fa-pen' : 'fa-eye'}`;
      modeBtn.dataset.action = 'toggleMode';
      modeBtn.dataset.tooltip = this.isViewMode ? 'Edit Note' : 'View Note';
      modeBtn.setAttribute('aria-label', this.isViewMode ? 'Edit Note' : 'View Note');
      controlsContainer.appendChild(modeBtn);
    }

    // Edit mode buttons
    if (this.isEditMode) {
      // Save button
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'header-control icon fas fa-save';
      saveBtn.dataset.action = 'saveAndClose';
      saveBtn.dataset.tooltip = 'Save & Close';
      saveBtn.setAttribute('aria-label', 'Save & Close');
      controlsContainer.appendChild(saveBtn);

      // Reset button
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'header-control icon fas fa-undo';
      resetBtn.dataset.action = 'reset';
      resetBtn.dataset.tooltip = 'Reset Form';
      resetBtn.setAttribute('aria-label', 'Reset Form');
      controlsContainer.appendChild(resetBtn);

      // Delete button (only for owners of existing notes)
      if (this.document.isOwner && this.document.id) {
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

    // Get active calendar
    const calendar = CalendarManager.getActiveCalendar();

    // Get current game time as fallback
    const components = game.time.components || { year: 1492, month: 0, dayOfMonth: 0 };
    const yearZero = calendar?.years?.yearZero ?? 0;
    const currentYear = components.year + yearZero;
    const currentMonth = components.month ?? 0;
    const currentDay = (components.dayOfMonth ?? 0) + 1; // Convert 0-indexed to 1-indexed

    // Auto-detect Font Awesome icons
    if (context.system.icon && context.system.icon.startsWith('fa')) context.iconType = 'fontawesome';
    else context.iconType = context.system.iconType || 'image';

    // Format start date display using calendar (defaults to current calendar date)
    const startYear = this.document.system.startDate.year || currentYear;
    const startMonth = this.document.system.startDate.month ?? currentMonth;
    const startDay = this.document.system.startDate.day || currentDay;
    context.startDateDisplay = this._formatDateDisplay(calendar, startYear, startMonth, startDay);

    // Format end date display (defaults to start date if not set)
    const endYear = this.document.system.endDate?.year || startYear;
    const endMonth = this.document.system.endDate?.month ?? startMonth;
    const endDay = this.document.system.endDate?.day || startDay;
    context.endDateDisplay = this._formatDateDisplay(calendar, endYear, endMonth, endDay);

    // Format start time as HH:mm
    const startHour = String(this.document.system.startDate.hour ?? 12).padStart(2, '0');
    const startMinute = String(this.document.system.startDate.minute ?? 0).padStart(2, '0');
    context.startTimeValue = `${startHour}:${startMinute}`;

    // Format end time as HH:mm (defaults to start time + 1 hour if not set)
    const endHour = String(this.document.system.endDate?.hour ?? ((this.document.system.startDate.hour ?? 12) + 1) % 24).padStart(2, '0');
    const endMinute = String(this.document.system.endDate?.minute ?? this.document.system.startDate.minute ?? 0).padStart(2, '0');
    context.endTimeValue = `${endHour}:${endMinute}`;

    // Prepare repeat options with selected state
    const repeatType = this.document.system.repeat;
    const hasLinkedEvent = !!this.document.system.linkedEvent?.noteId;
    context.repeatOptions = getRepeatOptions(repeatType);

    // Show repeat options (maxOccurrences) when repeat is not 'never'
    context.showRepeatOptions = repeatType !== 'never';

    // Prepare moon data for moon conditions UI
    context.moons =
      calendar?.moons?.map((moon, index) => ({
        index,
        name: game.i18n.localize(moon.name),
        phases: moon.phases?.map((phase) => ({ name: game.i18n.localize(phase.name), start: phase.start, end: phase.end })) || []
      })) || [];
    context.hasMoons = context.moons.length > 0;

    // Prepare existing moon conditions for display
    context.moonConditions = (this.document.system.moonConditions || []).map((cond, index) => {
      const moon = context.moons[cond.moonIndex];
      const matchingPhase = moon?.phases?.find((p) => Math.abs(p.start - cond.phaseStart) < 0.01 && Math.abs(p.end - cond.phaseEnd) < 0.01);
      return {
        index,
        moonIndex: cond.moonIndex,
        moonName: moon?.name || `Moon ${cond.moonIndex + 1}`,
        phaseStart: cond.phaseStart,
        phaseEnd: cond.phaseEnd,
        phaseName: matchingPhase?.name || 'Custom Range'
      };
    });
    context.showMoonConditions = this.document.system.repeat === 'moon' || this.document.system.moonConditions?.length > 0;

    // Prepare random config context
    context.showRandomConfig = this.document.system.repeat === 'random';
    const randomConfig = this.document.system.randomConfig || {};
    context.randomConfig = {
      seed: randomConfig.seed ?? Math.floor(Math.random() * 1000000),
      probability: randomConfig.probability ?? 10,
      checkInterval: randomConfig.checkInterval ?? 'daily',
      checkIntervalLabel: randomConfig.checkInterval === 'weekly' ? 'week' : randomConfig.checkInterval === 'monthly' ? 'month' : 'day'
    };
    context.randomIntervalOptions = [
      { value: 'daily', label: 'Day', selected: context.randomConfig.checkInterval === 'daily' },
      { value: 'weekly', label: 'Week', selected: context.randomConfig.checkInterval === 'weekly' },
      { value: 'monthly', label: 'Month', selected: context.randomConfig.checkInterval === 'monthly' }
    ];

    // Prepare linked event context
    context.showLinkedConfig = hasLinkedEvent || this.document.system.repeat === 'linked';
    const linkedEvent = this.document.system.linkedEvent || {};
    context.linkedEvent = {
      noteId: linkedEvent.noteId || '',
      offset: linkedEvent.offset ?? 0
    };

    // Get available notes for linking (exclude self)
    const allNotes = NoteManager.getAllNotes() || [];
    context.availableNotes = allNotes.filter((note) => note.id !== this.document.id).map((note) => ({ id: note.id, name: note.name, selected: note.id === linkedEvent.noteId }));

    // Get linked note name for display
    if (linkedEvent.noteId) {
      const linkedNote = NoteManager.getNote(linkedEvent.noteId);
      context.linkedNoteName = linkedNote?.name || 'Unknown Event';
    }

    // Prepare range pattern context
    context.showRangeConfig = this.document.system.repeat === 'range';
    const rangePattern = this.document.system.rangePattern || {};

    // Helper to determine range type for a component
    const getRangeType = (bit) => {
      if (bit == null || (Array.isArray(bit) && bit[0] === null && bit[1] === null)) return 'any';
      if (typeof bit === 'number') return 'exact';
      if (Array.isArray(bit)) return 'range';
      return 'any';
    };

    // Year
    const yearType = getRangeType(rangePattern.year);
    context.rangeYearAny = yearType === 'any';
    context.rangeYearExact = yearType === 'exact';
    context.rangeYearRange = yearType === 'range';
    context.rangeYearValue = yearType === 'exact' ? rangePattern.year : '';
    context.rangeYearMin = yearType === 'range' ? (rangePattern.year[0] ?? '') : '';
    context.rangeYearMax = yearType === 'range' ? (rangePattern.year[1] ?? '') : '';

    // Month
    const monthType = getRangeType(rangePattern.month);
    context.rangeMonthAny = monthType === 'any';
    context.rangeMonthExact = monthType === 'exact';
    context.rangeMonthRange = monthType === 'range';
    const rangeMonthValue = monthType === 'exact' ? rangePattern.month : null;
    const rangeMonthMin = monthType === 'range' ? rangePattern.month[0] : null;
    const rangeMonthMax = monthType === 'range' ? rangePattern.month[1] : null;

    // Build month options for dropdowns
    const months = calendar?.months?.values || [];
    context.monthOptions = months.map((m, idx) => ({
      index: idx,
      name: game.i18n.localize(m.name),
      selected: rangeMonthValue === idx,
      selectedMin: rangeMonthMin === idx,
      selectedMax: rangeMonthMax === idx
    }));

    // Day
    const dayType = getRangeType(rangePattern.day);
    context.rangeDayAny = dayType === 'any';
    context.rangeDayExact = dayType === 'exact';
    context.rangeDayRange = dayType === 'range';
    context.rangeDayValue = dayType === 'exact' ? rangePattern.day : '';
    context.rangeDayMin = dayType === 'range' ? (rangePattern.day[0] ?? '') : '';
    context.rangeDayMax = dayType === 'range' ? (rangePattern.day[1] ?? '') : '';

    // Prepare category options with selected state
    const selectedCategories = this.document.system.categories || [];
    context.categoryOptions = getAllCategories().map((cat) => ({ ...cat, selected: selectedCategories.includes(cat.id) }));

    // Prepare available macros for selection
    const currentMacro = this.document.system.macro || '';
    context.availableMacros = game.macros.contents.map((m) => ({ id: m.id, name: m.name, selected: m.id === currentMacro }));

    // View mode specific context
    context.isViewMode = this.isViewMode;
    context.isEditMode = this.isEditMode;
    context.canEdit = this.document.isOwner;

    if (this.isViewMode) {
      // Enriched HTML content for view mode
      context.enrichedContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.document.text?.content || '', { async: true, relativeTo: this.document });

      // Display categories as labels
      const allCategories = getAllCategories();
      context.displayCategories = selectedCategories.map((id) => allCategories.find((c) => c.id === id)?.label).filter(Boolean);

      // Check if end date differs from start date
      context.hasEndDate = endYear !== startYear || endMonth !== startMonth || endDay !== startDay;

      // Format time displays for view mode
      context.startTimeDisplay = `${startHour}:${startMinute}`;
      context.endTimeDisplay = `${endHour}:${endMinute}`;
      context.hasEndTime = this.document.system.endDate?.hour !== undefined || this.document.system.endDate?.minute !== undefined;

      // Repeat label for view mode
      const repeatLabels = { never: null, daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', moon: 'Moon Phase' };
      context.repeatLabel = repeatLabels[this.document.system.repeat] || null;

      // Moon conditions display for view mode
      if (this.document.system.moonConditions?.length > 0) context.moonConditionsDisplay = getRecurrenceDescription(this.document.system);
    }

    return context;
  }

  _onChangeForm(formConfig, event) {
    const target = event.target;

    // Update hidden time inputs BEFORE form submission
    if (target?.name === 'system.startDate.time' || target?.name === 'system.endDate.time') {
      const [hour, minute] = target.value.split(':').map(Number);
      if (!isNaN(hour) && !isNaN(minute)) {
        const prefix = target.name.includes('startDate') ? 'system.startDate' : 'system.endDate';
        this.element.querySelector(`input[name="${prefix}.hour"]`).value = hour;
        this.element.querySelector(`input[name="${prefix}.minute"]`).value = minute;
      }
    }

    // Let Foundry handle form submission
    super._onChangeForm(formConfig, event);

    // Cosmetic: disable time inputs when All Day is checked
    if (target?.name === 'system.allDay') {
      this.element.querySelector('input[name="system.startDate.time"]').disabled = target.checked;
      this.element.querySelector('input[name="system.endDate.time"]').disabled = target.checked;
    }

    // Cosmetic: update icon color preview
    if (target?.name === 'system.color') {
      const iconPreview = this.element.querySelector('.icon-picker i.icon-preview');
      if (iconPreview) iconPreview.style.color = target.value;
      const imgPreview = this.element.querySelector('.icon-picker img.icon-preview');
      if (imgPreview) {
        imgPreview.style.filter = `drop-shadow(0px 1000px 0 ${target.value})`;
        imgPreview.style.transform = 'translateY(-1000px)';
      }
    }
  }

  /**
   * Process form data to convert range pattern UI fields into proper structure.
   * @param {Event} event - Form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - Extended form data
   * @inheritdoc
   */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const repeatType = data.system?.repeat;

    // Clear type-specific config when switching repeat types
    // linkedEvent - null when not 'linked', or null if noteId is empty
    if (repeatType !== 'linked') data.system.linkedEvent = null;
    else if (data.system.linkedEvent && !data.system.linkedEvent.noteId) data.system.linkedEvent = null;

    // randomConfig - null when not 'random'
    if (repeatType !== 'random') data.system.randomConfig = null;

    // moonConditions - clear when not 'moon' (preserve existing if switching to moon)
    if (repeatType !== 'moon' && data.system.moonConditions === undefined) data.system.moonConditions = [];

    // rangePattern - build from form fields or clear
    if (repeatType === 'range') {
      const rangePattern = {};

      // Helper to get range type value from form
      const getRangeValue = (component) => {
        const typeSelect = form.querySelector(`select[data-range-type="${component}"]`);
        if (!typeSelect) return null;

        const type = typeSelect.value;
        if (type === 'any') return [null, null]; // Wildcard

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
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onSelectIcon(event, target) {
    event.preventDefault();

    // Open icon picker based on current type
    const iconType = target.dataset.iconType || 'image';

    if (iconType === 'fontawesome') {
      // Prompt for Font Awesome class
      const currentIcon = target.querySelector('i')?.className.replace('icon-preview', '').trim() || '';
      const newIcon = await foundry.applications.api.DialogV2.prompt({
        window: { title: 'Font Awesome Icon' },
        content: `<div class="form-group"><label>Font Awesome Classes</label><input type="text" name="icon-class" value="${currentIcon}" placeholder="fas fa-calendar" /></div>`,
        ok: {
          callback: (event, button) => {
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
      // Image picker
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
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The icon picker element
   */
  static async _switchIconMode(event, target) {
    const iconType = target.dataset.iconType || 'image';
    const newType = iconType === 'image' ? 'fontawesome' : 'image';

    // Update data attribute
    target.dataset.iconType = newType;

    // Update hidden input
    const typeInput = target.querySelector('input[name="system.iconType"]');
    if (typeInput) typeInput.value = newType;

    // Get current color
    const form = target.closest('form');
    const colorInput = form?.querySelector('input[name="system.color"]');
    const color = colorInput?.value || '#4a9eff';

    // Replace icon display
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
   * @param {CalendariaCalendar} calendar - The calendar to use
   * @param {number} year - The year
   * @param {number} month - The month index (0-based)
   * @param {number} day - The day
   * @returns {string} - Formatted date string
   * @private
   */
  _formatDateDisplay(calendar, year, month, day) {
    if (!calendar || !calendar.months?.values) return `${day} / ${month + 1} / ${year}`;
    const monthData = calendar.months.values[month];
    const monthName = monthData?.name ? game.i18n.localize(monthData.name) : `Month ${month + 1}`;
    return `${day} ${monthName}, ${year}`;
  }

  /**
   * Handle date selection button click
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onSelectDate(event, target) {
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

    // Get current date values from form (or use calendar's current date as fallback)
    const yearInput = form.querySelector(`input[name="system.${dateField}.year"]`);
    const monthInput = form.querySelector(`input[name="system.${dateField}.month"]`);
    const dayInput = form.querySelector(`input[name="system.${dateField}.day"]`);
    const currentYear = parseInt(yearInput?.value) || fallbackYear;
    const parsedMonth = parseInt(monthInput?.value);
    const currentMonth = !isNaN(parsedMonth) ? parsedMonth : fallbackMonth;
    const currentDay = parseInt(dayInput?.value) || fallbackDay;

    // Show date picker dialog
    const result = await CalendarNoteSheet._showDatePickerDialog(calendar, currentYear, currentMonth, currentDay);
    if (!result) return;

    // Update form fields
    if (yearInput) yearInput.value = result.year;
    if (monthInput) monthInput.value = result.month;
    if (dayInput) dayInput.value = result.day;

    // Update display
    const displaySpan = target.querySelector('.date-display');
    if (displaySpan) {
      const monthData = calendar.months.values[result.month];
      const monthName = monthData?.name ? game.i18n.localize(monthData.name) : `Month ${result.month + 1}`;
      displaySpan.textContent = `${result.day} ${monthName}, ${result.year}`;
    }

    // Trigger change event for form
    const changeEvent = new Event('change', { bubbles: true });
    form.dispatchEvent(changeEvent);
  }

  /**
   * Show date picker dialog
   * @param {CalendariaCalendar} calendar - The calendar to use
   * @param {number} currentYear - Current year
   * @param {number} currentMonth - Current month (0-based)
   * @param {number} currentDay - Current day
   * @returns {Promise<{year: number, month: number, day: number}|null>}
   * @private
   */
  static async _showDatePickerDialog(calendar, currentYear, currentMonth, currentDay) {
    // Build month options
    const monthOptions = calendar.months.values.map((m, i) => `<option value="${i}" ${i === currentMonth ? 'selected' : ''}>${game.i18n.localize(m.name)}</option>`).join('');

    // Build day options for current month
    const daysInMonth = calendar.months.values[currentMonth]?.days || 30;
    const dayOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1)
      .map((d) => `<option value="${d}" ${d === currentDay ? 'selected' : ''}>${d}</option>`)
      .join('');

    const content = `
      <div class="form-group">
        <label>Year</label>
        <input type="number" name="year" value="${currentYear}" />
      </div>
      <div class="form-group">
        <label>Month</label>
        <select name="month" id="month-select">${monthOptions}</select>
      </div>
      <div class="form-group">
        <label>Day</label>
        <select name="day" id="day-select">${dayOptions}</select>
      </div>
    `;

    return foundry.applications.api.DialogV2.prompt({
      window: { title: 'Select Date' },
      content,
      ok: {
        callback: (event, button) => {
          return { year: parseInt(button.form.elements.year.value), month: parseInt(button.form.elements.month.value), day: parseInt(button.form.elements.day.value) };
        }
      },
      render: (event, dialog) => {
        const html = dialog.element;
        // Update day options when month changes
        const monthSelect = html.querySelector('#month-select');
        const daySelect = html.querySelector('#day-select');

        monthSelect.addEventListener('change', () => {
          const selectedMonth = parseInt(monthSelect.value);
          const daysInSelectedMonth = calendar.months.values[selectedMonth]?.days || 30;

          // Rebuild day options
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
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onSaveAndClose(event, target) {
    // Submit the form
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    this.element.dispatchEvent(submitEvent);

    // Close the sheet after a brief delay to allow save to complete
    setTimeout(() => {
      this.close();
    }, 100);
  }

  /**
   * Handle delete note button click
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onDeleteNote(event, target) {
    if (!this.document.isOwner) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CALENDARIA.ContextMenu.DeleteNote') },
      content: `<p>${game.i18n.format('CALENDARIA.ContextMenu.DeleteConfirm', { name: this.document.name })}</p>`,
      rejectClose: false,
      modal: true
    });

    if (confirmed) {
      const journal = this.document.parent;
      await this.close();

      // If journal only has this page, delete the entire journal
      if (journal.pages.size === 1) await journal.delete();
      else await this.document.delete();
    }
  }

  /**
   * Handle reset button click
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onReset(event, target) {
    // Get current calendar date/time as defaults
    const calendar = CalendarManager.getActiveCalendar();
    const currentDateTime = CalendarManager.getCurrentDateTime();

    const currentYear = currentDateTime.year;
    const currentMonth = currentDateTime.month;
    const currentDay = currentDateTime.day;
    const currentHour = currentDateTime.hour;
    const currentMinute = currentDateTime.minute;

    const form = this.element;

    // Reset title
    const titleInput = form.querySelector('input[name="name"]');
    if (titleInput) titleInput.value = game.i18n.localize('CALENDARIA.Note.NewNote');

    // Reset emblem
    const iconInput = form.querySelector('input[name="system.icon"]');
    const iconTypeInput = form.querySelector('input[name="system.iconType"]');
    const colorInput = form.querySelector('input[name="system.color"]');
    if (iconInput) iconInput.value = 'icons/svg/book.svg';
    if (iconTypeInput) iconTypeInput.value = 'image';
    if (colorInput) colorInput.value = '#4a9eff';

    // Update icon preview
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

    // Reset visibility
    const gmOnlyInput = form.querySelector('input[name="system.gmOnly"]');
    if (gmOnlyInput) gmOnlyInput.checked = false;

    // Reset dates to current calendar date
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

    // Update date display
    const dateDisplay = this._formatDateDisplay(calendar, currentYear, currentMonth, currentDay);
    const startDateDisplay = form.querySelector('[data-date-field="startDate"] .date-display');
    const endDateDisplay = form.querySelector('[data-date-field="endDate"] .date-display');
    if (startDateDisplay) startDateDisplay.textContent = dateDisplay;
    if (endDateDisplay) endDateDisplay.textContent = dateDisplay;

    // Reset time to current time
    const hourInput = form.querySelector('input[name="system.startDate.hour"]');
    const minuteInput = form.querySelector('input[name="system.startDate.minute"]');
    const timeInput = form.querySelector('input[name="system.startDate.time"]');
    if (hourInput) hourInput.value = currentHour;
    if (minuteInput) minuteInput.value = currentMinute;
    if (timeInput) timeInput.value = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    // Reset all day checkbox
    const allDayInput = form.querySelector('input[name="system.allDay"]');
    if (allDayInput) {
      allDayInput.checked = false;
      if (timeInput) timeInput.disabled = false;
    }

    // Reset repeat to never
    const repeatSelect = form.querySelector('select[name="system.repeat"]');
    if (repeatSelect) repeatSelect.value = 'never';

    // Reset categories (multi-select)
    const multiSelect = form.querySelector('multi-select[name="system.categories"]');
    if (multiSelect) {
      multiSelect.querySelectorAll('option').forEach((opt) => (opt.selected = false));
      multiSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Reset custom category input
    const newCategoryInput = form.querySelector('.new-category-input');
    if (newCategoryInput) newCategoryInput.value = '';

    // Reset ProseMirror editor
    const proseMirror = form.querySelector('prose-mirror#note-content');
    if (proseMirror) {
      // Try to clear the content by setting value
      proseMirror.value = '';
      // Also try setting innerHTML as a fallback
      const editorContent = proseMirror.querySelector('.ProseMirror');
      if (editorContent) editorContent.innerHTML = '<p></p>';
    }
  }

  /**
   * Handle add custom category button click
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onAddCategory(event, target) {
    const form = target.closest('form');
    const input = form?.querySelector('.new-category-input');
    const label = input?.value?.trim();

    if (!label) {
      ui.notifications.warn('Please enter a category name');
      return;
    }

    // Add the custom category
    const newCategory = await addCustomCategory(label);

    // Clear the input
    input.value = '';

    // Re-render the sheet to show the new category
    this.render();

    // Notify success
    ui.notifications.info(`Category "${newCategory.label}" added`);
  }

  /**
   * Handle mode toggle button click
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onToggleMode(event, target) {
    if (!this.document.isOwner) return;

    // Toggle between VIEW and EDIT modes
    this._mode = this._mode === CalendarNoteSheet.MODES.VIEW ? CalendarNoteSheet.MODES.EDIT : CalendarNoteSheet.MODES.VIEW;

    // Clear existing parts before re-rendering (AppV2 doesn't auto-remove old parts)
    const windowContent = this.element.querySelector('.window-content');
    if (windowContent) windowContent.innerHTML = '';

    // Re-render to switch templates
    this.render();
  }

  /**
   * Handle add moon condition button click.
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onAddMoonCondition(event, target) {
    const form = target.closest('form');
    const moonSelect = form?.querySelector('select[name="newMoonCondition.moonIndex"]');
    const phaseSelect = form?.querySelector('select[name="newMoonCondition.phase"]');

    if (!moonSelect || !phaseSelect) return;

    const moonIndex = parseInt(moonSelect.value);
    const phaseValue = phaseSelect.value;

    if (isNaN(moonIndex) || !phaseValue) {
      ui.notifications.warn('Please select a moon and phase');
      return;
    }

    // Parse phase value (format: "start-end")
    const [phaseStart, phaseEnd] = phaseValue.split('-').map(Number);

    // Get current moon conditions
    const currentConditions = foundry.utils.deepClone(this.document.system.moonConditions || []);

    // Check for duplicate
    const isDuplicate = currentConditions.some((c) => c.moonIndex === moonIndex && c.phaseStart === phaseStart && c.phaseEnd === phaseEnd);
    if (isDuplicate) {
      ui.notifications.warn('This moon condition already exists');
      return;
    }

    // Add new condition
    currentConditions.push({ moonIndex, phaseStart, phaseEnd });

    // Update document
    await this.document.update({ 'system.moonConditions': currentConditions });
  }

  /**
   * Handle remove moon condition button click.
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onRemoveMoonCondition(event, target) {
    const conditionIndex = parseInt(target.dataset.index);
    if (isNaN(conditionIndex)) return;

    // Get current moon conditions
    const currentConditions = foundry.utils.deepClone(this.document.system.moonConditions || []);

    // Remove the condition at index
    currentConditions.splice(conditionIndex, 1);

    // Update document
    await this.document.update({ 'system.moonConditions': currentConditions });
  }

  /**
   * Handle regenerate seed button click.
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onRegenerateSeed(event, target) {
    const newSeed = Math.floor(Math.random() * 1000000);
    const currentConfig = foundry.utils.deepClone(this.document.system.randomConfig || {});
    currentConfig.seed = newSeed;

    // Update seed first
    await this.document.update({ 'system.randomConfig': currentConfig });

    // Regenerate cached occurrences with new seed
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
    if (!calendar?.months?.values) return;

    const components = game.time.components || {};
    const yearZero = calendar?.years?.yearZero ?? 0;
    const currentYear = (components.year ?? 0) + yearZero;

    // Check if we need to generate for next year as well
    const cachedData = this.document.getFlag(MODULE.ID, 'randomOccurrences') || {};
    const generateNextYear = needsRandomRegeneration({ year: currentYear, occurrences: [] });
    const targetYear = generateNextYear ? currentYear + 1 : currentYear;

    // Build note data for generation
    const noteData = { startDate: this.document.system.startDate, randomConfig: this.document.system.randomConfig, repeatEndDate: this.document.system.repeatEndDate };

    // Generate occurrences
    const occurrences = generateRandomOccurrences(noteData, targetYear);

    // Store in flag
    await this.document.setFlag(MODULE.ID, 'randomOccurrences', { year: targetYear, generatedAt: Date.now(), occurrences });

    log(2, `Generated ${occurrences.length} random occurrences for ${this.document.name} until year ${targetYear}`);
  }

  /** @inheritdoc */
  async _processSubmitData(event, form, submitData, options = {}) {
    await super._processSubmitData(event, form, submitData, options);

    // After update, regenerate random occurrences if needed
    if (submitData.system?.repeat === 'random') setTimeout(() => this.#regenerateRandomOccurrences(), 100);
  }

  /**
   * Handle clear linked event button click.
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onClearLinkedEvent(event, target) {
    // Clear the linked event
    await this.document.update({ 'system.linkedEvent': null });
  }
}
