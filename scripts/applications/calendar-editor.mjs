/**
 * Calendar Editor Application
 * A comprehensive UI for creating and editing custom calendars.
 *
 * @module Applications/CalendarEditor
 * @author Tyler
 */

import { MODULE, TEMPLATES } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Calendar Editor Application for creating and editing custom calendars.
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class CalendarEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-editor',
    classes: ['calendaria', 'calendar-editor', 'standard-form'],
    tag: 'form',
    window: { icon: 'fas fa-calendar-plus', resizable: true },
    position: { width: 850, height: 750 },
    form: {
      handler: CalendarEditor.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      addMonth: CalendarEditor.#onAddMonth,
      removeMonth: CalendarEditor.#onRemoveMonth,
      moveMonthUp: CalendarEditor.#onMoveMonthUp,
      moveMonthDown: CalendarEditor.#onMoveMonthDown,
      addWeekday: CalendarEditor.#onAddWeekday,
      removeWeekday: CalendarEditor.#onRemoveWeekday,
      moveWeekdayUp: CalendarEditor.#onMoveWeekdayUp,
      moveWeekdayDown: CalendarEditor.#onMoveWeekdayDown,
      addSeason: CalendarEditor.#onAddSeason,
      removeSeason: CalendarEditor.#onRemoveSeason,
      addFestival: CalendarEditor.#onAddFestival,
      removeFestival: CalendarEditor.#onRemoveFestival,
      addMoon: CalendarEditor.#onAddMoon,
      removeMoon: CalendarEditor.#onRemoveMoon,
      pickMoonPhaseIcon: CalendarEditor.#onPickMoonPhaseIcon,
      loadCalendar: CalendarEditor.#onLoadCalendar,
      saveCalendar: CalendarEditor.#onSaveCalendar,
      resetCalendar: CalendarEditor.#onResetCalendar,
      deleteCalendar: CalendarEditor.#onDeleteCalendar
    }
  };

  /** @override */
  static PARTS = {
    tabs: { template: 'templates/generic/tab-navigation.hbs' },
    basic: { template: TEMPLATES.EDITOR.TAB_BASIC, scrollable: [''] },
    months: { template: TEMPLATES.EDITOR.TAB_MONTHS, scrollable: [''] },
    weekdays: { template: TEMPLATES.EDITOR.TAB_WEEKDAYS, scrollable: [''] },
    time: { template: TEMPLATES.EDITOR.TAB_TIME, scrollable: [''] },
    seasons: { template: TEMPLATES.EDITOR.TAB_SEASONS, scrollable: [''] },
    festivals: { template: TEMPLATES.EDITOR.TAB_FESTIVALS, scrollable: [''] },
    moons: { template: TEMPLATES.EDITOR.TAB_MOONS, scrollable: [''] },
    footer: { template: 'templates/generic/form-footer.hbs' }
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: 'basic', icon: 'fas fa-info-circle', label: 'CALENDARIA.Editor.Tab.Basic' },
        { id: 'months', icon: 'fas fa-calendar', label: 'CALENDARIA.Editor.Tab.Months' },
        { id: 'weekdays', icon: 'fas fa-calendar-week', label: 'CALENDARIA.Editor.Tab.Weekdays' },
        { id: 'time', icon: 'fas fa-clock', label: 'CALENDARIA.Editor.Tab.Time' },
        { id: 'seasons', icon: 'fas fa-sun', label: 'CALENDARIA.Editor.Tab.Seasons' },
        { id: 'festivals', icon: 'fas fa-star', label: 'CALENDARIA.Editor.Tab.Festivals' },
        { id: 'moons', icon: 'fas fa-moon', label: 'CALENDARIA.Editor.Tab.Moons' }
      ],
      initial: 'basic'
    }
  };

  /**
   * The calendar ID being edited (null if creating new)
   * @type {string|null}
   */
  #calendarId = null;

  /**
   * The working calendar data
   * @type {object}
   */
  #calendarData = null;

  /**
   * Flag indicating if we're editing an existing calendar
   * @type {boolean}
   */
  #isEditing = false;

  /* -------------------------------------------- */

  /**
   * Create a new CalendarEditor.
   * @param {object} [options] - Application options
   * @param {string} [options.calendarId] - ID of calendar to edit (null for new)
   */
  constructor(options = {}) {
    super(options);

    if (options.calendarId) {
      this.#calendarId = options.calendarId;
      this.#isEditing = true;
      this.#loadExistingCalendar(options.calendarId);
    } else {
      this.#initializeBlankCalendar();
    }
  }

  /* -------------------------------------------- */

  /**
   * Initialize a blank calendar structure.
   * @private
   */
  #initializeBlankCalendar() {
    this.#calendarData = {
      name: '',
      years: {
        yearZero: 0,
        firstWeekday: 0,
        leapYear: null
      },
      months: {
        values: [
          {
            name: game.i18n.format('CALENDARIA.Editor.Default.MonthName', { num: 1 }),
            abbreviation: game.i18n.format('CALENDARIA.Editor.Default.MonthAbbr', { num: 1 }),
            ordinal: 1,
            days: 30
          }
        ]
      },
      days: {
        values: [
          {
            name: game.i18n.format('CALENDARIA.Editor.Default.DayName', { num: 1 }),
            abbreviation: game.i18n.format('CALENDARIA.Editor.Default.DayAbbr', { num: 1 }),
            ordinal: 1
          }
        ],
        daysPerYear: 365,
        hoursPerDay: 24,
        minutesPerHour: 60,
        secondsPerMinute: 60
      },
      seasons: {
        values: []
      },
      festivals: [],
      moons: [],
      metadata: {
        id: '',
        description: '',
        author: game.user.name,
        system: ''
      }
    };
  }

  /**
   * Load an existing calendar for editing.
   * @param {string} calendarId - Calendar ID to load
   * @private
   */
  #loadExistingCalendar(calendarId) {
    const calendar = CalendarManager.getCalendar(calendarId);
    if (calendar) {
      this.#calendarData = calendar.toObject();
      // Ensure all required structures exist
      if (!this.#calendarData.seasons) this.#calendarData.seasons = { values: [] };
      if (!this.#calendarData.festivals) this.#calendarData.festivals = [];
      if (!this.#calendarData.moons) this.#calendarData.moons = [];
      if (!this.#calendarData.metadata) this.#calendarData.metadata = {};
    } else {
      log(2, `Calendar ${calendarId} not found, initializing blank`);
      this.#initializeBlankCalendar();
    }
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    if (this.#isEditing) return game.i18n.format('CALENDARIA.Editor.TitleEdit', { name: this.#calendarData?.name || this.#calendarId });
    return game.i18n.localize('CALENDARIA.Editor.Title');
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Calendar data
    context.calendar = this.#calendarData;
    context.isEditing = this.#isEditing;
    context.calendarId = this.#calendarId;
    context.isCustom = this.#calendarId ? CalendarManager.isCustomCalendar(this.#calendarId) : true;

    // Available templates for "Start from..."
    context.templates = CalendarManager.getCalendarTemplates();

    // Calculate totals for validation display
    context.calculatedDaysPerYear = this.#calculateDaysPerYear();
    context.calculatedLeapDaysPerYear = this.#calculateDaysPerYear(true);
    context.hasLeapDaysDifference = context.calculatedLeapDaysPerYear !== context.calculatedDaysPerYear;
    context.daysMatch = context.calculatedDaysPerYear === this.#calendarData.days.daysPerYear;

    // Prepare display string for days per year
    if (context.hasLeapDaysDifference) {
      const leapText = game.i18n.localize('CALENDARIA.Editor.OnLeapYears');
      context.daysPerYearDisplay = `${context.calculatedDaysPerYear} (${context.calculatedLeapDaysPerYear} ${leapText})`;
    } else {
      context.daysPerYearDisplay = String(context.calculatedDaysPerYear);
    }

    // Calculate time summaries
    const { hoursPerDay, minutesPerHour, secondsPerMinute, daysPerYear } = this.#calendarData.days;
    context.secondsPerDay = hoursPerDay * minutesPerHour * secondsPerMinute;
    context.secondsPerYear = daysPerYear * context.secondsPerDay;

    // Prepare month options for festival dropdowns (1-indexed for display)
    context.monthOptions = this.#calendarData.months.values.map((month, idx) => ({
      value: idx + 1,
      label: month.name
    }));

    // Prepare months with navigation flags for up/down buttons
    const monthCount = this.#calendarData.months.values.length;
    context.monthsWithNav = this.#calendarData.months.values.map((month, idx) => ({
      ...month,
      index: idx,
      isFirst: idx === 0,
      isLast: idx === monthCount - 1
    }));

    // Prepare festivals with month options
    context.festivalsWithNav = this.#calendarData.festivals.map((festival, idx) => ({
      ...festival,
      index: idx,
      monthOptions: context.monthOptions.map((opt) => ({
        ...opt,
        selected: opt.value === festival.month
      }))
    }));

    // Prepare weekday options for first weekday dropdown
    const currentFirstWeekday = this.#calendarData.years.firstWeekday ?? 0;
    context.weekdayOptions = this.#calendarData.days.values.map((day, idx) => ({
      value: idx,
      label: day.name,
      selected: idx === currentFirstWeekday
    }));

    // Prepare weekdays with navigation flags for up/down buttons
    const weekdayCount = this.#calendarData.days.values.length;
    context.weekdaysWithNav = this.#calendarData.days.values.map((day, idx) => ({
      ...day,
      index: idx,
      isFirst: idx === 0,
      isLast: idx === weekdayCount - 1
    }));

    // Prepare leap year values (-1 = disabled)
    const leapYear = this.#calendarData.years.leapYear;
    context.leapInterval = leapYear?.leapInterval ?? -1;
    context.leapStart = leapYear?.leapStart ?? 0;

    // Prepare month options for reference date dropdown (0-indexed for internal use)
    context.monthOptionsZeroIndexed = this.#calendarData.months.values.map((month, idx) => ({
      value: idx,
      label: month.name
    }));

    // Prepare moons with month options and expanded phase data
    context.moonsWithNav = this.#calendarData.moons.map((moon, idx) => ({
      ...moon,
      index: idx,
      refMonthOptions: context.monthOptionsZeroIndexed.map((opt) => ({
        ...opt,
        selected: opt.value === moon.referenceDate?.month
      })),
      phasesWithIndex: (moon.phases || this.#getDefaultMoonPhases()).map((phase, pIdx) => ({
        ...phase,
        index: pIdx,
        moonIndex: idx,
        isImagePath: phase.icon?.includes('/') ?? false,
        startPercent: Math.round((phase.start ?? pIdx * 0.125) * 1000) / 10,
        endPercent: Math.round((phase.end ?? (pIdx + 1) * 0.125) * 1000) / 10
      }))
    }));

    // Prepare seasons with month options
    // Handle both formats: monthStart/monthEnd OR dayStart/dayEnd
    context.seasonsWithNav = this.#calendarData.seasons.values.map((season, idx) => {
      let startMonth, startDay, endMonth, endDay;

      // If monthStart is set, use month-based format
      if (season.monthStart != null) {
        startMonth = season.monthStart;
        startDay = season.dayStart;
        endMonth = season.monthEnd;
        endDay = season.dayEnd;
      } else if (season.dayStart != null) {
        // Convert day-of-year to month/day
        const startConverted = this.#dayOfYearToMonthDay(season.dayStart);
        const endConverted = this.#dayOfYearToMonthDay(season.dayEnd);
        startMonth = startConverted.month;
        startDay = startConverted.day;
        endMonth = endConverted.month;
        endDay = endConverted.day;
      } else {
        // Default fallback
        startMonth = 1;
        startDay = null;
        endMonth = 3;
        endDay = null;
      }

      return {
        ...season,
        index: idx,
        displayStartMonth: startMonth,
        displayStartDay: startDay,
        displayEndMonth: endMonth,
        displayEndDay: endDay,
        startMonthOptions: context.monthOptions.map((opt) => ({
          ...opt,
          selected: opt.value === startMonth
        })),
        endMonthOptions: context.monthOptions.map((opt) => ({
          ...opt,
          selected: opt.value === endMonth
        }))
      };
    });

    // Footer buttons
    context.buttons = [
      {
        type: 'button',
        action: 'saveCalendar',
        icon: 'fas fa-save',
        label: 'CALENDARIA.Editor.Button.Save'
      },
      {
        type: 'button',
        action: 'resetCalendar',
        icon: 'fas fa-undo',
        label: 'CALENDARIA.Editor.Button.Reset'
      }
    ];

    // Add delete button if editing an existing calendar
    if (this.#calendarId) {
      context.buttons.push({
        type: 'button',
        action: 'deleteCalendar',
        icon: 'fas fa-trash',
        label: 'CALENDARIA.Editor.Button.Delete',
        cssClass: 'delete-button'
      });
    }

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.tab = context.tabs[partId];
    return context;
  }

  /**
   * Calculate total days per year from month definitions.
   * @param {boolean} [leapYear=false] - Whether to calculate for leap year
   * @returns {number} Total days
   * @private
   */
  #calculateDaysPerYear(leapYear = false) {
    return this.#calendarData.months.values.reduce((sum, month) => {
      if (leapYear && month.leapDays) return sum + month.leapDays;
      return sum + (month.days || 0);
    }, 0);
  }

  /**
   * Convert a day-of-year (0-indexed) to month and day.
   * @param {number} dayOfYear - Day of year (0-indexed)
   * @returns {{month: number, day: number}} Month (1-indexed) and day (1-indexed)
   * @private
   */
  #dayOfYearToMonthDay(dayOfYear) {
    const months = this.#calendarData.months.values;
    const totalDays = this.#calculateDaysPerYear();

    // Handle wrap-around for seasons that span year boundary (e.g., Winter: 354-78)
    let remaining = ((dayOfYear % totalDays) + totalDays) % totalDays;

    for (let i = 0; i < months.length; i++) {
      const monthDays = months[i].days || 0;
      if (remaining < monthDays) return { month: i + 1, day: remaining + 1 };
      remaining -= monthDays;
    }
    // Fallback: return last day of last month
    const lastMonth = months.length;
    const lastDay = months[lastMonth - 1]?.days || 1;
    return { month: lastMonth, day: lastDay };
  }

  /* -------------------------------------------- */
  /*  Form Handling                               */
  /* -------------------------------------------- */

  /**
   * Handle form submission.
   * @param {Event} event - Form submit event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - Processed form data
   */
  static async #onSubmit(event, form, formData) {
    this.#updateFromFormData(formData.object);
  }

  /**
   * Update calendar data from form submission.
   * @param {object} data - Form data object
   * @private
   */
  #updateFromFormData(data) {
    // Basic info
    this.#calendarData.name = data.name || '';
    this.#calendarData.metadata.description = data['metadata.description'] || '';
    this.#calendarData.metadata.system = data['metadata.system'] || '';

    // Year settings
    this.#calendarData.years.yearZero = parseInt(data['years.yearZero']) || 0;
    this.#calendarData.years.firstWeekday = parseInt(data['years.firstWeekday']) || 0;

    // Leap year (-1 interval = disabled)
    const leapInterval = parseInt(data['years.leapYear.leapInterval']);
    if (leapInterval > 0) {
      this.#calendarData.years.leapYear = {
        leapStart: parseInt(data['years.leapYear.leapStart']) || 0,
        leapInterval: leapInterval
      };
    } else {
      this.#calendarData.years.leapYear = null;
    }

    // Time settings
    this.#calendarData.days.daysPerYear = parseInt(data['days.daysPerYear']) || 365;
    this.#calendarData.days.hoursPerDay = parseInt(data['days.hoursPerDay']) || 24;
    this.#calendarData.days.minutesPerHour = parseInt(data['days.minutesPerHour']) || 60;
    this.#calendarData.days.secondsPerMinute = parseInt(data['days.secondsPerMinute']) || 60;

    // Process months array
    this.#updateArrayFromFormData(data, 'months', this.#calendarData.months.values, ['name', 'abbreviation', 'days', 'leapDays', 'type']);

    // Process weekdays array
    this.#updateArrayFromFormData(data, 'weekdays', this.#calendarData.days.values, ['name', 'abbreviation', 'isRestDay']);

    // Process seasons array
    this.#updateSeasonsFromFormData(data);

    // Process festivals array
    this.#updateArrayFromFormData(data, 'festivals', this.#calendarData.festivals, ['name', 'month', 'day']);

    // Process moons array
    this.#updateMoonsFromFormData(data);
  }

  /**
   * Update an array field from form data.
   * @param {object} data - Form data
   * @param {string} prefix - Field prefix
   * @param {Array} targetArray - Target array to update
   * @param {Array<string>} fields - Field names to extract
   * @private
   */
  #updateArrayFromFormData(data, prefix, targetArray, fields) {
    // Find all indices in form data
    const indices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(new RegExp(`^${prefix}\\.(\\d+)\\.`));
      if (match) indices.add(parseInt(match[1]));
    }

    // Sort indices and rebuild array
    const sortedIndices = [...indices].sort((a, b) => a - b);

    // Clear and rebuild
    targetArray.length = 0;
    for (const idx of sortedIndices) {
      const item = { ordinal: targetArray.length + 1 };
      for (const field of fields) {
        const key = `${prefix}.${idx}.${field}`;
        if (data[key] !== undefined) {
          if (field === 'leapDays') {
            // leapDays should stay null/undefined when empty, not become 0
            const parsed = parseInt(data[key]);
            if (!isNaN(parsed)) item[field] = parsed;
          } else if (field === 'days' || field === 'day' || field === 'month' || field === 'dayStart' || field === 'dayEnd') {
            item[field] = parseInt(data[key]) || 0;
          } else if (field === 'isRestDay') {
            item[field] = !!data[key];
          } else {
            item[field] = data[key];
          }
        }
      }
      targetArray.push(item);
    }
  }

  /**
   * Update seasons array from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateSeasonsFromFormData(data) {
    const indices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^seasons\.(\d+)\./);
      if (match) indices.add(parseInt(match[1]));
    }

    const sortedIndices = [...indices].sort((a, b) => a - b);
    this.#calendarData.seasons.values.length = 0;

    for (const idx of sortedIndices) {
      const season = {
        name: data[`seasons.${idx}.name`] || '',
        abbreviation: data[`seasons.${idx}.abbreviation`] || '',
        monthStart: parseInt(data[`seasons.${idx}.monthStart`]) || 1,
        monthEnd: parseInt(data[`seasons.${idx}.monthEnd`]) || 1,
        dayStart: this.#parseOptionalInt(data[`seasons.${idx}.dayStart`]),
        dayEnd: this.#parseOptionalInt(data[`seasons.${idx}.dayEnd`]),
        ordinal: this.#calendarData.seasons.values.length + 1
      };
      this.#calendarData.seasons.values.push(season);
    }
  }

  /**
   * Parse an optional integer value, returning null if empty.
   * @param {string|number} value - Value to parse
   * @returns {number|null}
   * @private
   */
  #parseOptionalInt(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Update moons array from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateMoonsFromFormData(data) {
    const moonIndices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^moons\.(\d+)\./);
      if (match) moonIndices.add(parseInt(match[1]));
    }

    const sortedMoonIndices = [...moonIndices].sort((a, b) => a - b);
    const newMoons = [];

    for (const moonIdx of sortedMoonIndices) {
      // Get existing phases to preserve icon paths set via filepicker
      const existingMoon = this.#calendarData.moons[moonIdx];
      const existingPhases = existingMoon?.phases || this.#getDefaultMoonPhases();

      // Build phases from form data (convert percentages to decimals)
      const phases = [];
      for (let pIdx = 0; pIdx < 8; pIdx++) {
        const phaseName = data[`moons.${moonIdx}.phases.${pIdx}.name`];
        const phaseIcon = data[`moons.${moonIdx}.phases.${pIdx}.icon`];
        const phaseStartPercent = data[`moons.${moonIdx}.phases.${pIdx}.startPercent`];
        const phaseEndPercent = data[`moons.${moonIdx}.phases.${pIdx}.endPercent`];

        // Use form data if available, otherwise fall back to existing (convert % to decimal)
        phases.push({
          name: phaseName ?? existingPhases[pIdx]?.name ?? '',
          icon: phaseIcon ?? existingPhases[pIdx]?.icon ?? '',
          start: phaseStartPercent != null ? parseFloat(phaseStartPercent) / 100 : (existingPhases[pIdx]?.start ?? pIdx * 0.125),
          end: phaseEndPercent != null ? parseFloat(phaseEndPercent) / 100 : (existingPhases[pIdx]?.end ?? (pIdx + 1) * 0.125)
        });
      }

      const moon = {
        name: data[`moons.${moonIdx}.name`] || '',
        cycleLength: parseInt(data[`moons.${moonIdx}.cycleLength`]) || 28,
        phases,
        referenceDate: {
          year: parseInt(data[`moons.${moonIdx}.referenceDate.year`]) || 0,
          month: parseInt(data[`moons.${moonIdx}.referenceDate.month`]) || 0,
          day: parseInt(data[`moons.${moonIdx}.referenceDate.day`]) || 1
        }
      };
      newMoons.push(moon);
    }

    this.#calendarData.moons = newMoons;
  }

  /**
   * Get default moon phases.
   * @returns {Array} Default 8-phase moon cycle
   * @private
   */
  #getDefaultMoonPhases() {
    return [
      { name: game.i18n.localize('CALENDARIA.MoonPhase.NewMoon'), icon: '🌑', start: 0, end: 0.125 },
      { name: game.i18n.localize('CALENDARIA.MoonPhase.WaxingCrescent'), icon: '🌒', start: 0.125, end: 0.25 },
      { name: game.i18n.localize('CALENDARIA.MoonPhase.FirstQuarter'), icon: '🌓', start: 0.25, end: 0.375 },
      { name: game.i18n.localize('CALENDARIA.MoonPhase.WaxingGibbous'), icon: '🌔', start: 0.375, end: 0.5 },
      { name: game.i18n.localize('CALENDARIA.MoonPhase.FullMoon'), icon: '🌕', start: 0.5, end: 0.625 },
      { name: game.i18n.localize('CALENDARIA.MoonPhase.WaningGibbous'), icon: '🌖', start: 0.625, end: 0.75 },
      { name: game.i18n.localize('CALENDARIA.MoonPhase.LastQuarter'), icon: '🌗', start: 0.75, end: 0.875 },
      { name: game.i18n.localize('CALENDARIA.MoonPhase.WaningCrescent'), icon: '🌘', start: 0.875, end: 1 }
    ];
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Add a new month after the target index.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddMonth(event, target) {
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.months.values.length - 1;
    const insertIdx = afterIdx + 1;
    const totalMonths = this.#calendarData.months.values.length + 1;
    this.#calendarData.months.values.splice(insertIdx, 0, {
      name: game.i18n.format('CALENDARIA.Editor.Default.MonthName', { num: totalMonths }),
      abbreviation: game.i18n.format('CALENDARIA.Editor.Default.MonthAbbr', { num: totalMonths }),
      ordinal: insertIdx + 1,
      days: 30
    });
    this.render();
  }

  /**
   * Remove a month.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveMonth(event, target) {
    const idx = parseInt(target.dataset.index);
    if (this.#calendarData.months.values.length > 1) {
      this.#calendarData.months.values.splice(idx, 1);
      this.#reindexArray(this.#calendarData.months.values);
      this.render();
    } else {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.Editor.Error.MinOneMonth'));
    }
  }

  /**
   * Move month up in order.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveMonthUp(event, target) {
    const idx = parseInt(target.dataset.index);
    if (idx > 0) {
      const months = this.#calendarData.months.values;
      [months[idx - 1], months[idx]] = [months[idx], months[idx - 1]];
      this.#reindexArray(months);
      this.render();
    }
  }

  /**
   * Move month down in order.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveMonthDown(event, target) {
    const idx = parseInt(target.dataset.index);
    const months = this.#calendarData.months.values;
    if (idx < months.length - 1) {
      [months[idx], months[idx + 1]] = [months[idx + 1], months[idx]];
      this.#reindexArray(months);
      this.render();
    }
  }

  /**
   * Add a new weekday after the target index.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddWeekday(event, target) {
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.days.values.length - 1;
    const insertIdx = afterIdx + 1;
    const totalDays = this.#calendarData.days.values.length + 1;
    this.#calendarData.days.values.splice(insertIdx, 0, {
      name: game.i18n.format('CALENDARIA.Editor.Default.DayName', { num: totalDays }),
      abbreviation: game.i18n.format('CALENDARIA.Editor.Default.DayAbbr', { num: totalDays }),
      ordinal: insertIdx + 1,
      isRestDay: false
    });
    this.render();
  }

  /**
   * Remove a weekday.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveWeekday(event, target) {
    const idx = parseInt(target.dataset.index);
    if (this.#calendarData.days.values.length > 1) {
      this.#calendarData.days.values.splice(idx, 1);
      this.#reindexArray(this.#calendarData.days.values);
      this.render();
    } else {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.Editor.Error.MinOneWeekday'));
    }
  }

  /**
   * Move a weekday up in the list.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveWeekdayUp(event, target) {
    const idx = parseInt(target.dataset.index);
    const days = this.#calendarData.days.values;
    if (idx > 0) {
      [days[idx - 1], days[idx]] = [days[idx], days[idx - 1]];
      this.#reindexArray(days);
      this.render();
    }
  }

  /**
   * Move a weekday down in the list.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveWeekdayDown(event, target) {
    const idx = parseInt(target.dataset.index);
    const days = this.#calendarData.days.values;
    if (idx < days.length - 1) {
      [days[idx], days[idx + 1]] = [days[idx + 1], days[idx]];
      this.#reindexArray(days);
      this.render();
    }
  }

  /**
   * Add a new season after the target index.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddSeason(event, target) {
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.seasons.values.length - 1;
    const insertIdx = afterIdx + 1;
    const totalSeasons = this.#calendarData.seasons.values.length + 1;
    this.#calendarData.seasons.values.splice(insertIdx, 0, {
      name: game.i18n.format('CALENDARIA.Editor.Default.SeasonName', { num: totalSeasons }),
      abbreviation: game.i18n.format('CALENDARIA.Editor.Default.SeasonAbbr', { num: totalSeasons }),
      monthStart: 1,
      monthEnd: 3,
      dayStart: null,
      dayEnd: null,
      ordinal: insertIdx + 1
    });
    this.#reindexArray(this.#calendarData.seasons.values);
    this.render();
  }

  /**
   * Remove a season.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveSeason(event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.seasons.values.splice(idx, 1);
    this.#reindexArray(this.#calendarData.seasons.values);
    this.render();
  }

  /**
   * Add a new festival after the target index.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddFestival(event, target) {
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.festivals.length - 1;
    const insertIdx = afterIdx + 1;
    const totalFestivals = this.#calendarData.festivals.length + 1;
    this.#calendarData.festivals.splice(insertIdx, 0, {
      name: game.i18n.format('CALENDARIA.Editor.Default.FestivalName', { num: totalFestivals }),
      month: 1,
      day: 1
    });
    this.render();
  }

  /**
   * Remove a festival.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveFestival(event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.festivals.splice(idx, 1);
    this.render();
  }

  /**
   * Add a new moon.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddMoon(event, target) {
    this.#calendarData.moons.push({
      name: game.i18n.localize('CALENDARIA.Editor.Default.MoonName'),
      cycleLength: 28,
      phases: this.#getDefaultMoonPhases(),
      referenceDate: { year: 0, month: 0, day: 1 }
    });
    this.render();
  }

  /**
   * Remove a moon.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveMoon(event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.moons.splice(idx, 1);
    this.render();
  }

  /**
   * Pick a custom icon for a moon phase.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onPickMoonPhaseIcon(event, target) {
    const moonIdx = parseInt(target.dataset.moonIndex);
    const phaseIdx = parseInt(target.dataset.phaseIndex);

    const moon = this.#calendarData.moons[moonIdx];
    if (!moon) return;

    const currentIcon = moon.phases?.[phaseIdx]?.icon || '';

    const picker = new FilePicker({
      type: 'image',
      current: currentIcon.startsWith('icons/') ? currentIcon : '',
      callback: (path) => {
        if (!moon.phases) moon.phases = this.#getDefaultMoonPhases();
        moon.phases[phaseIdx].icon = path;
        this.render();
      }
    });
    picker.render(true);
  }

  /**
   * Load a calendar for editing or as a template.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onLoadCalendar(event, target) {
    const dropdown = this.element.querySelector('select[name="calendarSelect"]');
    const calendarId = dropdown?.value;

    if (!calendarId) {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.Editor.SelectCalendarFirst'));
      return;
    }

    const calendar = CalendarManager.getCalendar(calendarId);
    if (!calendar) {
      ui.notifications.error(game.i18n.format('CALENDARIA.Editor.CalendarNotFound', { id: calendarId }));
      return;
    }

    const isCustom = CalendarManager.isCustomCalendar(calendarId);
    const calendarName = game.i18n.localize(calendar.name || calendarId);

    // Build dialog buttons
    const buttons = [];

    if (isCustom) {
      buttons.push({
        action: 'edit',
        label: game.i18n.localize('CALENDARIA.Editor.EditCalendar'),
        icon: 'fas fa-edit',
        default: true
      });
    }

    buttons.push({
      action: 'template',
      label: game.i18n.localize('CALENDARIA.Editor.UseAsTemplate'),
      icon: 'fas fa-copy',
      default: !isCustom
    });

    buttons.push({
      action: 'cancel',
      label: game.i18n.localize('CALENDARIA.UI.Cancel'),
      icon: 'fas fa-times'
    });

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('CALENDARIA.Editor.LoadCalendar') },
      content: `<p>${game.i18n.format('CALENDARIA.Editor.LoadCalendarPrompt', { name: calendarName })}</p>`,
      buttons
    });

    if (result === 'edit') {
      // Close this builder and open new one for editing
      await this.close();
      CalendarEditor.edit(calendarId);
    } else if (result === 'template') {
      // Load as template (copy data)
      this.#calendarData = calendar.toObject();
      this.#prelocalizeCalendarData();

      this.#calendarData.name = game.i18n.format('CALENDARIA.Editor.CopyOfName', {
        name: calendarName
      });
      if (!this.#calendarData.seasons) this.#calendarData.seasons = { values: [] };
      if (!this.#calendarData.festivals) this.#calendarData.festivals = [];
      if (!this.#calendarData.moons) this.#calendarData.moons = [];
      if (this.#calendarData.metadata) {
        delete this.#calendarData.metadata.id;
        delete this.#calendarData.metadata.isCustom;
      }

      ui.notifications.info(game.i18n.format('CALENDARIA.Editor.TemplateLoaded', { name: calendarName }));
      this.render();
    }
  }

  /**
   * Pre-localize all string fields in calendar data.
   * Converts i18n keys to localized strings for editing.
   * @private
   */
  #prelocalizeCalendarData() {
    const data = this.#calendarData;

    // Localize calendar name and metadata
    if (data.name) data.name = game.i18n.localize(data.name);
    if (data.metadata?.description) data.metadata.description = game.i18n.localize(data.metadata.description);

    // Localize months
    if (data.months?.values) {
      for (const month of data.months.values) {
        if (month.name) month.name = game.i18n.localize(month.name);
        if (month.abbreviation) month.abbreviation = game.i18n.localize(month.abbreviation);
      }
    }

    // Localize weekdays
    if (data.days?.values) {
      for (const day of data.days.values) {
        if (day.name) day.name = game.i18n.localize(day.name);
        if (day.abbreviation) day.abbreviation = game.i18n.localize(day.abbreviation);
      }
    }

    // Localize seasons
    if (data.seasons?.values) {
      for (const season of data.seasons.values) {
        if (season.name) season.name = game.i18n.localize(season.name);
        if (season.abbreviation) season.abbreviation = game.i18n.localize(season.abbreviation);
      }
    }

    // Localize festivals
    if (data.festivals) {
      for (const festival of data.festivals) {
        if (festival.name) festival.name = game.i18n.localize(festival.name);
      }
    }

    // Localize moons
    if (data.moons) {
      for (const moon of data.moons) {
        if (moon.name) moon.name = game.i18n.localize(moon.name);
        if (moon.phases) for (const phase of moon.phases) if (phase.name) phase.name = game.i18n.localize(phase.name);
      }
    }
  }

  /**
   * Save the calendar.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onSaveCalendar(event, target) {
    // Validate
    if (!this.#calendarData.name) {
      ui.notifications.error(game.i18n.localize('CALENDARIA.Editor.Error.NameRequired'));
      return;
    }

    // Calculate daysPerYear from months
    this.#calendarData.days.daysPerYear = this.#calculateDaysPerYear();

    try {
      let calendar;
      if (this.#isEditing && this.#calendarId) {
        // Update existing
        calendar = await CalendarManager.updateCustomCalendar(this.#calendarId, this.#calendarData);
      } else {
        // Create new
        const id = this.#calendarData.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-');
        calendar = await CalendarManager.createCustomCalendar(id, this.#calendarData);
        if (calendar) {
          this.#calendarId = calendar.metadata?.id;
          this.#isEditing = true;
        }
      }

      if (calendar) {
        ui.notifications.info(game.i18n.format('CALENDARIA.Editor.SaveSuccess', { name: this.#calendarData.name }));
      }
    } catch (error) {
      log(2, 'Error saving calendar:', error);
      ui.notifications.error(game.i18n.format('CALENDARIA.Editor.SaveError', { error: error.message }));
    }
  }

  /**
   * Reset the calendar to blank state.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onResetCalendar(event, target) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CALENDARIA.Editor.Reset') },
      content: `<p>${game.i18n.localize('CALENDARIA.Editor.ConfirmReset')}</p>`,
      yes: { label: game.i18n.localize('CALENDARIA.Editor.Reset'), icon: 'fas fa-undo' },
      no: { label: game.i18n.localize('CALENDARIA.UI.Cancel'), icon: 'fas fa-times' }
    });

    if (confirmed) {
      this.#initializeBlankCalendar();
      ui.notifications.info(game.i18n.localize('CALENDARIA.Editor.ResetComplete'));
      this.render();
    }
  }

  /**
   * Delete the calendar.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onDeleteCalendar(event, target) {
    if (!this.#calendarId || !this.#isEditing) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CALENDARIA.Editor.Button.Delete') },
      content: `<p>${game.i18n.format('CALENDARIA.Editor.ConfirmDelete', { name: this.#calendarData.name })}</p>`,
      yes: { label: game.i18n.localize('CALENDARIA.Editor.Button.Delete'), icon: 'fas fa-trash', callback: () => true },
      no: { label: game.i18n.localize('CALENDARIA.UI.Cancel'), icon: 'fas fa-times' }
    });

    if (!confirmed) return;

    const deleted = await CalendarManager.deleteCustomCalendar(this.#calendarId);
    if (deleted) this.close();
  }

  /**
   * Reindex ordinal values in an array.
   * @param {Array} arr - Array to reindex
   * @private
   */
  #reindexArray(arr) {
    arr.forEach((item, idx) => {
      item.ordinal = idx + 1;
    });
  }

  /* -------------------------------------------- */
  /*  Static API                                  */
  /* -------------------------------------------- */

  /**
   * Open the calendar builder to create a new calendar.
   * @returns {CalendarEditor}
   */
  static createNew() {
    return new CalendarEditor().render(true);
  }

  /**
   * Open the calendar builder to edit an existing calendar.
   * @param {string} calendarId - Calendar ID to edit
   * @returns {CalendarEditor}
   */
  static edit(calendarId) {
    return new CalendarEditor({ calendarId }).render(true);
  }
}
