/**
 * Calendar Note Sheet
 * Sheet for editing calendar note journal entry pages with ProseMirror editor.
 *
 * @module Sheets/CalendarNoteSheet
 * @author Tyler
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

import { log } from '../utils/logger.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';

export class CalendarNoteSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.journal.JournalEntryPageSheet) {
  static DEFAULT_OPTIONS = {
    classes: ['calendaria', 'calendar-note-sheet'],
    position: { width: 900, height: 700 },
    actions: {
      selectIcon: this._onSelectIcon,
      selectDate: this._onSelectDate,
      save: this._onSaveAndClose,
      reset: this._onReset
    },
    form: {
      closeOnSubmit: false
    }
  };

  static PARTS = {
    form: { template: 'modules/calendaria/templates/sheets/calendar-note-form.hbs' }
  };

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
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);

    // Inject Save and Reset buttons into window header
    const windowHeader = this.element.querySelector('.window-header');
    if (!windowHeader) return;

    // Find or create a controls container at the beginning of the header
    let controlsContainer = windowHeader.querySelector('.header-controls');
    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.className = 'header-controls';

      // Insert at the very beginning of window-header
      windowHeader.insertBefore(controlsContainer, windowHeader.firstChild);
    }

    // Create Save button
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'header-control icon fa-solid fa-save';
    saveBtn.dataset.action = 'save';
    saveBtn.dataset.tooltip = 'Save & Close';
    saveBtn.setAttribute('aria-label', 'Save & Close');
    controlsContainer.appendChild(saveBtn);

    // Create Reset button
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'header-control icon fa-solid fa-undo';
    resetBtn.dataset.action = 'reset';
    resetBtn.dataset.tooltip = 'Reset Form';
    resetBtn.setAttribute('aria-label', 'Reset Form');
    controlsContainer.appendChild(resetBtn);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.document.system;
    context.text = this.document.text;

    // Get active calendar
    const calendar = CalendarManager.getActiveCalendar();

    // Get current calendar date as fallback
    const calendarCurrentDate = calendar?.current || {};
    const currentYear = calendarCurrentDate.year || 1492;
    const currentMonth = calendarCurrentDate.month ?? 0;
    const currentDay = calendarCurrentDate.day || 1;

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

    // Format time as HH:mm
    const hour = String(this.document.system.startDate.hour ?? 12).padStart(2, '0');
    const minute = String(this.document.system.startDate.minute ?? 0).padStart(2, '0');
    context.timeValue = `${hour}:${minute}`;

    // Prepare repeat options with selected state
    context.repeatOptions = [
      { value: 'never', label: 'Never', selected: this.document.system.repeat === 'never' },
      { value: 'daily', label: 'Daily', selected: this.document.system.repeat === 'daily' },
      { value: 'weekly', label: 'Weekly', selected: this.document.system.repeat === 'weekly' },
      { value: 'monthly', label: 'Monthly', selected: this.document.system.repeat === 'monthly' },
      { value: 'yearly', label: 'Yearly', selected: this.document.system.repeat === 'yearly' }
    ];
    log(3, 'DEBUG', { context });
    return context;
  }

  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);

    // Convert date input (yyyy-mm-dd) to individual components
    if (event.target?.name === 'system.startDate.date') {
      const [year, month, day] = event.target.value.split('-').map(Number);
      if (year && month && day) {
        // Create hidden inputs or update the form data directly
        const form = event.target.closest('form');
        const updateField = (name, value) => {
          let input = form.querySelector(`input[name="${name}"]`);
          if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
          }
          input.value = value;
        };

        updateField('system.startDate.year', year);
        updateField('system.startDate.month', month - 1); // Convert to 0-indexed
        updateField('system.startDate.day', day);
      }
    }

    // Convert end date input (yyyy-mm-dd) to individual components
    if (event.target?.name === 'system.endDate.date') {
      const form = event.target.closest('form');
      const updateField = (name, value) => {
        let input = form.querySelector(`input[name="${name}"]`);
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          form.appendChild(input);
        }
        input.value = value;
      };

      if (event.target.value) {
        const [year, month, day] = event.target.value.split('-').map(Number);
        if (year && month && day) {
          updateField('system.endDate.year', year);
          updateField('system.endDate.month', month - 1); // Convert to 0-indexed
          updateField('system.endDate.day', day);
        }
      } else {
        // Clear end date if input is cleared
        updateField('system.endDate.year', '');
        updateField('system.endDate.month', '');
        updateField('system.endDate.day', '');
      }
    }

    // Convert time input (HH:mm) to individual components
    if (event.target?.name === 'system.startDate.time') {
      const [hour, minute] = event.target.value.split(':').map(Number);
      if (!isNaN(hour) && !isNaN(minute)) {
        const form = event.target.closest('form');
        const updateField = (name, value) => {
          let input = form.querySelector(`input[name="${name}"]`);
          if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
          }
          input.value = value;
        };

        updateField('system.startDate.hour', hour);
        updateField('system.startDate.minute', minute);
      }
    }

    // Handle All Day checkbox to disable/enable time input
    if (event.target?.name === 'system.allDay') {
      const form = event.target.closest('form');
      const timeInput = form.querySelector('input[name="system.startDate.time"]');
      if (timeInput) {
        timeInput.disabled = event.target.checked;
      }
    }

    // Handle color changes to update icon preview
    if (event.target?.name === 'system.color') {
      const form = event.target.closest('form');
      const color = event.target.value;

      // Update Font Awesome icon color
      const iconPreview = form.querySelector('.icon-picker i.icon-preview');
      if (iconPreview) {
        iconPreview.style.color = color;
      }

      // Update image color using CSS filter (works best with SVGs)
      const imgPreview = form.querySelector('.icon-picker img.icon-preview');
      if (imgPreview) {
        // Use drop-shadow trick to colorize the image
        imgPreview.style.filter = `drop-shadow(0px 1000px 0 ${color})`;
        imgPreview.style.transform = 'translateY(-1000px)';
      }
    }
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
        if (iconElement) {
          iconElement.className = `${newIcon} icon-preview`;
        }
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
        // Apply color filter for SVG colorization
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
    const dateField = target.dataset.dateField; // 'startDate' or 'endDate'
    const form = target.closest('form');
    if (!form) return;

    // Get calendar
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) {
      ui.notifications.error('No active calendar found');
      return;
    }

    // Get current calendar date as fallback
    const calendarCurrentDate = calendar.current || {};
    const fallbackYear = calendarCurrentDate.year || 1492;
    const fallbackMonth = calendarCurrentDate.month ?? 0;
    const fallbackDay = calendarCurrentDate.day || 1;

    // Get current date values from form (or use calendar's current date as fallback)
    const yearInput = form.querySelector(`input[name="system.${dateField}.year"]`);
    const monthInput = form.querySelector(`input[name="system.${dateField}.month"]`);
    const dayInput = form.querySelector(`input[name="system.${dateField}.day"]`);

    const currentYear = parseInt(yearInput?.value) || fallbackYear;
    const currentMonth = parseInt(monthInput?.value) ?? fallbackMonth;
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
          return {
            year: parseInt(button.form.elements.year.value),
            month: parseInt(button.form.elements.month.value),
            day: parseInt(button.form.elements.day.value)
          };
        }
      },
      render: (event, dialog) => {
        log(1, 'DEBUG:', { event, dialog });
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
    const form = this.element.querySelector('form');
    if (!form) return;

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    // Close the sheet after a brief delay to allow save to complete
    setTimeout(() => {
      this.close();
    }, 100);
  }

  /**
   * Handle reset button click
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element
   */
  static async _onReset(event, target) {
    // Reset the form
    const form = this.element.querySelector('form');
    if (!form) return;

    form.reset();
    // Re-render to show default values
    this.render();
  }
}
