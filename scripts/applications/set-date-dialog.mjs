/**
 * Set Date Dialog - Dialog for setting world date/time and managing timepoints.
 * @module Applications/SetDateDialog
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS, SOCKET_TYPES, TEMPLATES } from '../constants.mjs';
import TimeTracker from '../time/time-tracker.mjs';
import { formatForLocation } from '../utils/format-utils.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialog for setting the current date/time and managing saved timepoints.
 */
export class SetDateDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {boolean} Whether the timepoints section is expanded */
  #timepointsExpanded = false;

  /** @type {string|null} ID of timepoint currently being edited */
  #editingTimepointId = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-set-date-dialog',
    classes: ['calendaria', 'set-date-dialog'],
    tag: 'form',
    position: { width: 550, height: 'auto' },
    window: { title: 'CALENDARIA.SetDate.Title', resizable: false, contentClasses: ['standard-form'] },
    form: { handler: SetDateDialog.#onSubmit, closeOnSubmit: true },
    actions: {
      toggleTimepoints: SetDateDialog.#onToggleTimepoints,
      saveTimepoint: SetDateDialog.#onSaveTimepoint,
      jumpToTimepoint: SetDateDialog.#onJumpToTimepoint,
      deleteTimepoint: SetDateDialog.#onDeleteTimepoint,
      editTimepointName: SetDateDialog.#onEditTimepointName
    }
  };

  /** @override */
  static PARTS = {
    form: { template: TEMPLATES.SET_DATE_DIALOG, classes: ['standard-form'] }
  };

  /**
   * Get the active calendar.
   * @returns {object} The active calendar instance
   */
  get calendar() {
    return CalendarManager.getActiveCalendar();
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const components = game.time.components;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const displayYear = components.year + yearZero;
    const isMonthless = calendar?.isMonthless ?? false;
    context.year = displayYear;
    context.isMonthless = isMonthless;
    context.months = isMonthless ? [] : (calendar?.monthsArray ?? []).map((m, i) => ({ index: i, name: localize(m.name), selected: i === components.month }));
    if (isMonthless) {
      const daysInYear = calendar?.getDaysInYear?.(displayYear) ?? 365;
      context.days = Array.from({ length: daysInYear }, (_, i) => i + 1);
      context.currentDay = (components.dayOfMonth ?? 0) + 1;
      context.dayLabel = localize('CALENDARIA.SetDate.DayOfYear');
    } else {
      const daysInMonth = calendar?.getDaysInMonth?.(components.month, displayYear) ?? 30;
      context.days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      context.currentDay = (components.dayOfMonth ?? 0) + 1;
      context.dayLabel = localize('CALENDARIA.Common.Day');
    }
    context.hour = components.hour ?? 0;
    context.minute = components.minute ?? 0;
    context.maxHour = (calendar?.days?.hoursPerDay ?? 24) - 1;
    context.timepointsExpanded = this.#timepointsExpanded;
    context.timepoints = this.#getTimepointsContext();
    context.editingTimepointId = this.#editingTimepointId;
    context.skipTriggers = true;
    return context;
  }

  /**
   * Get timepoints formatted for template context.
   * @returns {Array} Array of timepoint objects with formatted dates
   */
  #getTimepointsContext() {
    const timepoints = game.settings.get(MODULE.ID, SETTINGS.SAVED_TIMEPOINTS) || [];
    const calendar = this.calendar;
    if (!calendar) return timepoints;
    return timepoints.map((tp) => {
      const components = calendar.timeToComponents(tp.worldTime);
      const yearZero = calendar.years?.yearZero ?? 0;
      const formattedDate = formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'hudDate');
      const formattedTime = formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'hudTime');
      return { ...tp, formattedDate, formattedTime, isEditing: tp.id === this.#editingTimepointId };
    });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#setupEventListeners();
  }

  /**
   * Setup event listeners for the dialog.
   */
  #setupEventListeners() {
    const monthSelect = this.element.querySelector('select[name="month"]');
    monthSelect?.addEventListener('change', () => this.#updateDaysDropdown());
    const yearInput = this.element.querySelector('input[name="year"]');
    yearInput?.addEventListener('change', () => this.#updateDaysDropdown());
    const nameInputs = this.element.querySelectorAll('.timepoint-name-input');
    nameInputs.forEach((input) => {
      input.addEventListener('blur', (e) => this.#finishEditingName(e.target));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.#finishEditingName(e.target);
        } else if (e.key === 'Escape') {
          this.#editingTimepointId = null;
          this.render();
        }
      });
      if (input.closest('.timepoint-row')?.dataset.id === this.#editingTimepointId) {
        input.focus();
        input.select();
      }
    });
  }

  /**
   * Update days dropdown based on selected month/year.
   */
  #updateDaysDropdown() {
    const calendar = this.calendar;
    if (!calendar) return;
    const yearInput = this.element.querySelector('input[name="year"]');
    const monthSelect = this.element.querySelector('select[name="month"]');
    const daySelect = this.element.querySelector('select[name="day"]');
    if (!yearInput || !daySelect) return;
    const year = parseInt(yearInput.value);
    const currentDay = parseInt(daySelect.value);
    const isMonthless = calendar.isMonthless ?? false;
    let maxDays;
    if (isMonthless) {
      maxDays = calendar.getDaysInYear?.(year) ?? 365;
    } else {
      if (!monthSelect) return;
      const month = parseInt(monthSelect.value);
      maxDays = calendar.getDaysInMonth?.(month, year) ?? 30;
    }
    daySelect.innerHTML = '';
    for (let i = 1; i <= maxDays; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = i;
      if (i === currentDay || (currentDay > maxDays && i === maxDays)) option.selected = true;
      daySelect.appendChild(option);
    }
  }

  /**
   * Finish editing a timepoint name.
   * @param {HTMLInputElement} input - The input element
   */
  async #finishEditingName(input) {
    const id = input.closest('.timepoint-row')?.dataset.id;
    const newName = input.value.trim();
    if (!id || !newName) {
      this.#editingTimepointId = null;
      this.render();
      return;
    }

    const timepoints = game.settings.get(MODULE.ID, SETTINGS.SAVED_TIMEPOINTS) || [];
    const index = timepoints.findIndex((tp) => tp.id === id);
    if (index >= 0) {
      timepoints[index].name = newName;
      await game.settings.set(MODULE.ID, SETTINGS.SAVED_TIMEPOINTS, timepoints);
    }

    this.#editingTimepointId = null;
    this.render();
  }

  /**
   * Toggle timepoints section visibility.
   * @this {SetDateDialog}
   */
  static #onToggleTimepoints() {
    this.#timepointsExpanded = !this.#timepointsExpanded;
    this.render();
  }

  /**
   * Save current world time as a new timepoint.
   * @this {SetDateDialog}
   */
  static async #onSaveTimepoint() {
    const timepoints = game.settings.get(MODULE.ID, SETTINGS.SAVED_TIMEPOINTS) || [];
    const calendar = this.calendar;
    const components = game.time.components;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const monthName = calendar?.monthsArray?.[components.month]?.name;
    const defaultName = `${localize(monthName || 'Month')} ${(components.dayOfMonth ?? 0) + 1}, ${components.year + yearZero}`;
    const newTimepoint = { id: foundry.utils.randomID(), name: defaultName, worldTime: game.time.worldTime, createdAt: Date.now() };
    timepoints.push(newTimepoint);
    await game.settings.set(MODULE.ID, SETTINGS.SAVED_TIMEPOINTS, timepoints);
    this.#editingTimepointId = newTimepoint.id;
    this.#timepointsExpanded = true;
    this.render();
    log(3, `Saved new timepoint: ${newTimepoint.name}`);
  }

  /**
   * Jump to a saved timepoint.
   * @this {SetDateDialog}
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onJumpToTimepoint(_event, target) {
    const id = target.closest('.timepoint-row')?.dataset.id;
    if (!id) return;
    const timepoints = game.settings.get(MODULE.ID, SETTINGS.SAVED_TIMEPOINTS) || [];
    const timepoint = timepoints.find((tp) => tp.id === id);
    if (!timepoint) return;
    const skipCheckbox = this.element.querySelector('input[name="skipTriggers"]');
    const skipTriggers = skipCheckbox?.checked ?? true;
    if (skipTriggers) TimeTracker.skipNextHooks();
    const delta = timepoint.worldTime - game.time.worldTime;
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta });
      this.close();
      return;
    }
    await game.time.advance(delta);
    log(3, `Jumped to timepoint: ${timepoint.name} (skip triggers: ${skipTriggers})`);
    this.close();
  }

  /**
   * Delete a saved timepoint.
   * @this {SetDateDialog}
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onDeleteTimepoint(_event, target) {
    const id = target.closest('.timepoint-row')?.dataset.id;
    if (!id) return;
    const timepoints = game.settings.get(MODULE.ID, SETTINGS.SAVED_TIMEPOINTS) || [];
    const index = timepoints.findIndex((tp) => tp.id === id);
    if (index < 0) return;
    const name = timepoints[index].name;
    timepoints.splice(index, 1);
    await game.settings.set(MODULE.ID, SETTINGS.SAVED_TIMEPOINTS, timepoints);
    log(3, `Deleted timepoint: ${name}`);
    this.render();
  }

  /**
   * Start editing a timepoint name.
   * @this {SetDateDialog}
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static #onEditTimepointName(_event, target) {
    const id = target.closest('.timepoint-row')?.dataset.id;
    if (!id) return;
    this.#editingTimepointId = id;
    this.render();
  }

  /**
   * Submit the form and set the date.
   * @this {SetDateDialog}
   * @param {SubmitEvent} _event - Form submission event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - Processed form data
   */
  static async #onSubmit(_event, _form, formData) {
    const calendar = this.calendar;
    if (!calendar) return;
    const yearZero = calendar.years?.yearZero ?? 0;
    const data = formData.object;
    const year = parseInt(data.year) - yearZero;
    const day = parseInt(data.day);
    const hour = parseInt(data.hour) || 0;
    const minute = parseInt(data.minute) || 0;
    const skipTriggers = data.skipTriggers ?? true;
    const isMonthless = calendar.isMonthless ?? false;
    let month = 0;
    if (!isMonthless) {
      month = parseInt(data.month);
    }
    const newTimeComponents = { year, month, dayOfMonth: day - 1, hour, minute, second: 0 };
    const newTime = calendar.componentsToTime(newTimeComponents);
    const delta = newTime - game.time.worldTime;
    if (delta !== 0) {
      if (skipTriggers) TimeTracker.skipNextHooks();
      if (!game.user.isGM) {
        CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta });
        return;
      }
      await game.time.advance(delta);
      log(3, `Set date to ${year + yearZero}/${month + 1}/${day} ${hour}:${minute} (skip triggers: ${skipTriggers})`);
    }
  }

  /**
   * Open the Set Date dialog.
   * @returns {SetDateDialog} The dialog instance
   */
  static open() {
    const existing = foundry.applications.instances.get('calendaria-set-date-dialog');
    if (existing) {
      existing.render({ force: true });
      return existing;
    }
    const dialog = new SetDateDialog();
    dialog.render({ force: true });
    return dialog;
  }
}
