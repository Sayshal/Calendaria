/**
 * Calendar Editor Application
 * A comprehensive UI for creating and editing custom calendars.
 *
 * @module Applications/CalendarEditor
 * @author Tyler
 */

import { MODULE, SETTINGS, TEMPLATES, ASSETS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { createImporter } from '../importers/index.mjs';
import { formatEraTemplate } from '../calendar/calendar-utils.mjs';
import { createBlankCalendar, getDefaultMoonPhases } from '../calendar/data/calendar-defaults.mjs';
import { ALL_PRESETS, WEATHER_CATEGORIES } from '../weather/weather-presets.mjs';
import { CLIMATE_ZONE_TEMPLATES, getDefaultZoneConfig, getClimateTemplateOptions } from '../weather/climate-data.mjs';

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
      addEra: CalendarEditor.#onAddEra,
      removeEra: CalendarEditor.#onRemoveEra,
      addFestival: CalendarEditor.#onAddFestival,
      removeFestival: CalendarEditor.#onRemoveFestival,
      addMoon: CalendarEditor.#onAddMoon,
      removeMoon: CalendarEditor.#onRemoveMoon,
      addMoonPhase: CalendarEditor.#onAddMoonPhase,
      removeMoonPhase: CalendarEditor.#onRemoveMoonPhase,
      pickMoonPhaseIcon: CalendarEditor.#onPickMoonPhaseIcon,
      addCycle: CalendarEditor.#onAddCycle,
      removeCycle: CalendarEditor.#onRemoveCycle,
      addCycleEntry: CalendarEditor.#onAddCycleEntry,
      removeCycleEntry: CalendarEditor.#onRemoveCycleEntry,
      addCanonicalHour: CalendarEditor.#onAddCanonicalHour,
      removeCanonicalHour: CalendarEditor.#onRemoveCanonicalHour,
      addNamedWeek: CalendarEditor.#onAddNamedWeek,
      removeNamedWeek: CalendarEditor.#onRemoveNamedWeek,
      loadCalendar: CalendarEditor.#onLoadCalendar,
      saveCalendar: CalendarEditor.#onSaveCalendar,
      resetCalendar: CalendarEditor.#onResetCalendar,
      resetToDefault: CalendarEditor.#onResetToDefault,
      deleteCalendar: CalendarEditor.#onDeleteCalendar,
      toggleCategory: CalendarEditor.#onToggleCategory,
      resetWeatherPreset: CalendarEditor.#onResetWeatherPreset,
      toggleDescription: CalendarEditor.#onToggleDescription,
      addZone: CalendarEditor.#onAddZone,
      editZone: CalendarEditor.#onEditZone,
      deleteZone: CalendarEditor.#onDeleteZone,
      toggleCategorySelectAll: CalendarEditor.#onToggleCategorySelectAll
    }
  };

  /** @override */
  static PARTS = {
    tabs: { template: TEMPLATES.EDITOR.TAB_NAVIGATION },
    basic: { template: TEMPLATES.EDITOR.TAB_BASIC, scrollable: [''] },
    months: { template: TEMPLATES.EDITOR.TAB_MONTHS, scrollable: [''] },
    weekdays: { template: TEMPLATES.EDITOR.TAB_WEEKDAYS, scrollable: [''] },
    time: { template: TEMPLATES.EDITOR.TAB_TIME, scrollable: [''] },
    seasons: { template: TEMPLATES.EDITOR.TAB_SEASONS, scrollable: [''] },
    eras: { template: TEMPLATES.EDITOR.TAB_ERAS, scrollable: [''] },
    festivals: { template: TEMPLATES.EDITOR.TAB_FESTIVALS, scrollable: [''] },
    moons: { template: TEMPLATES.EDITOR.TAB_MOONS, scrollable: [''] },
    cycles: { template: TEMPLATES.EDITOR.TAB_CYCLES, scrollable: [''] },
    weather: { template: TEMPLATES.EDITOR.TAB_WEATHER, scrollable: [''] },
    footer: { template: TEMPLATES.FORM_FOOTER }
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
        { id: 'eras', icon: 'fas fa-hourglass-half', label: 'CALENDARIA.Editor.Tab.Eras' },
        { id: 'festivals', icon: 'fas fa-star', label: 'CALENDARIA.Editor.Tab.Festivals' },
        { id: 'moons', icon: 'fas fa-moon', label: 'CALENDARIA.Editor.Tab.Moons' },
        { id: 'cycles', icon: 'fas fa-arrows-rotate', label: 'CALENDARIA.Editor.Tab.Cycles' },
        { id: 'weather', icon: 'fas fa-cloud-sun', label: 'CALENDARIA.Editor.Tab.Weather' }
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

  /**
   * Whether to set this calendar as active after saving
   * @type {boolean}
   */
  #setActiveOnSave = false;

  /**
   * Pending notes to import after save (stored separately to avoid metadata clearing)
   * @type {object[]|null}
   */
  #pendingNotes = null;

  /**
   * Importer ID for pending notes
   * @type {string|null}
   */
  #pendingImporterId = null;

  /**
   * Create a new CalendarEditor.
   * @param {object} [options] - Application options
   * @param {string} [options.calendarId] - ID of calendar to edit (null for new)
   * @param {object} [options.initialData] - Pre-loaded calendar data (e.g., from importer)
   * @param {string} [options.suggestedId] - Suggested ID for new calendar
   */
  constructor(options = {}) {
    super(options);

    if (options.calendarId) {
      this.#calendarId = options.calendarId;
      this.#isEditing = true;
      this.#loadExistingCalendar(options.calendarId);
    } else if (options.initialData) {
      this.#loadInitialData(options.initialData, options.suggestedId);
    } else {
      // Default to loading the active calendar
      const activeCalendar = CalendarManager.getActiveCalendar();
      if (activeCalendar?.metadata?.id) {
        this.#calendarId = activeCalendar.metadata.id;
        this.#isEditing = true;
        this.#loadExistingCalendar(this.#calendarId);
      } else {
        this.#initializeBlankCalendar();
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Initialize a blank calendar structure.
   * @private
   */
  #initializeBlankCalendar() {
    this.#calendarData = createBlankCalendar();
  }

  /**
   * Load an existing calendar for editing.
   * @param {string} calendarId - Calendar ID to load
   * @private
   */
  #loadExistingCalendar(calendarId) {
    const calendar = CalendarManager.getCalendar(calendarId);
    if (calendar) this.#calendarData = foundry.utils.mergeObject(createBlankCalendar(), calendar.toObject());
    else this.#initializeBlankCalendar();
  }

  /**
   * Load initial data from an external source (e.g., importer).
   * @param {object} data - Calendar data to load
   * @param {string} [suggestedId] - Suggested ID for the calendar
   * @private
   */
  #loadInitialData(data, suggestedId) {
    // Merge imported data with blank calendar to ensure all required fields exist
    this.#calendarData = foundry.utils.mergeObject(createBlankCalendar(), data);

    // Store suggested ID for later use
    if (suggestedId) this.#calendarData.metadata.suggestedId = suggestedId;

    // Extract pending notes to separate instance variables (to avoid metadata clearing issues)
    if (this.#calendarData.metadata?.pendingNotes?.length > 0) {
      this.#pendingNotes = this.#calendarData.metadata.pendingNotes;
      this.#pendingImporterId = this.#calendarData.metadata.importerId;
      // Clean up metadata
      delete this.#calendarData.metadata.pendingNotes;
      delete this.#calendarData.metadata.importerId;
    }

    // Pre-localize strings (imported data may have literal strings)
    this.#prelocalizeCalendarData();

    log(3, `Loaded initial data for calendar: ${this.#calendarData.name}`);
    log(3, `  pendingNotes (instance): ${this.#pendingNotes?.length || 0}, importerId: ${this.#pendingImporterId}`);
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    const name = this.#calendarData?.name || game.i18n.localize('CALENDARIA.Editor.NewCalendar');
    return game.i18n.format('CALENDARIA.Editor.TitleEdit', { name });
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

    // Prepare starting weekday options from weekdays (for per-month fixed weekday start)
    const startingWeekdayOptions = this.#calendarData.days.values.map((day, idx) => ({
      value: idx,
      label: day.name
    }));

    // Prepare months with navigation flags for up/down buttons
    const monthCount = this.#calendarData.months.values.length;
    context.monthsWithNav = this.#calendarData.months.values.map((month, idx) => ({
      ...month,
      index: idx,
      isFirst: idx === 0,
      isLast: idx === monthCount - 1,
      hasStartingWeekday: month.startingWeekday != null,
      startingWeekdayOptions: startingWeekdayOptions.map((opt) => ({
        ...opt,
        selected: opt.value === month.startingWeekday
      }))
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

    // Prepare leap year values - check leapYearConfig first, then legacy years.leapYear
    const leapYearConfig = this.#calendarData.leapYearConfig;
    const legacyLeapYear = this.#calendarData.years?.leapYear;

    // Determine current rule
    let currentRule = 'none';
    if (leapYearConfig?.rule && leapYearConfig.rule !== 'none') currentRule = leapYearConfig.rule;
    else if (legacyLeapYear?.leapInterval > 0) currentRule = 'simple';

    context.leapRuleOptions = [
      { value: 'none', label: 'CALENDARIA.Editor.LeapRule.None', selected: currentRule === 'none' },
      { value: 'simple', label: 'CALENDARIA.Editor.LeapRule.Simple', selected: currentRule === 'simple' },
      { value: 'gregorian', label: 'CALENDARIA.Editor.LeapRule.Gregorian', selected: currentRule === 'gregorian' },
      { value: 'custom', label: 'CALENDARIA.Editor.LeapRule.Custom', selected: currentRule === 'custom' }
    ];

    // Show/hide appropriate fields
    context.showLeapSimple = currentRule === 'simple';
    context.showLeapGregorian = currentRule === 'gregorian';
    context.showLeapCustom = currentRule === 'custom';

    // Get values
    context.leapInterval = leapYearConfig?.interval ?? legacyLeapYear?.leapInterval ?? 4;
    context.leapStart = leapYearConfig?.start ?? legacyLeapYear?.leapStart ?? 0;
    context.leapPattern = leapYearConfig?.pattern ?? '';

    // Prepare month options for reference date dropdown (0-indexed for internal use)
    context.monthOptionsZeroIndexed = this.#calendarData.months.values.map((month, idx) => ({
      value: idx,
      label: month.name
    }));

    // Prepare moons with month options and expanded phase data
    context.moonsWithNav = this.#calendarData.moons.map((moon, idx) => ({
      ...moon,
      color: moon.color || '',
      index: idx,
      refMonthOptions: context.monthOptionsZeroIndexed.map((opt) => ({
        ...opt,
        selected: opt.value === moon.referenceDate?.month
      })),
      phasesWithIndex: (moon.phases || getDefaultMoonPhases()).map((phase, pIdx) => ({
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

    // Prepare format options for eras
    const formatOptions = [
      { value: 'suffix', label: 'CALENDARIA.Editor.Format.Suffix' },
      { value: 'prefix', label: 'CALENDARIA.Editor.Format.Prefix' }
    ];

    // Prepare eras with format options and preview
    context.erasWithNav = this.#calendarData.eras.map((era, idx) => ({
      ...era,
      index: idx,
      formatOptions: formatOptions.map((opt) => ({
        ...opt,
        selected: opt.value === (era.format || 'suffix')
      })),
      preview: this.#generateEraPreview(era)
    }));
    context.formatOptions = formatOptions;

    // Prepare basedOn options for cycles
    const basedOnOptions = [
      { value: 'year', label: 'CALENDARIA.Editor.Cycle.BasedOn.Year' },
      { value: 'eraYear', label: 'CALENDARIA.Editor.Cycle.BasedOn.EraYear' },
      { value: 'month', label: 'CALENDARIA.Editor.Cycle.BasedOn.Month' },
      { value: 'monthDay', label: 'CALENDARIA.Editor.Cycle.BasedOn.MonthDay' },
      { value: 'day', label: 'CALENDARIA.Editor.Cycle.BasedOn.Day' },
      { value: 'yearDay', label: 'CALENDARIA.Editor.Cycle.BasedOn.YearDay' }
    ];

    // Prepare cycles with entries and basedOn options
    context.cyclesWithNav = (this.#calendarData.cycles || []).map((cycle, idx) => ({
      ...cycle,
      index: idx,
      basedOnOptions: basedOnOptions.map((opt) => ({
        ...opt,
        selected: opt.value === (cycle.basedOn || 'month')
      })),
      entriesWithIndex: (cycle.entries || []).map((entry, eIdx) => ({
        ...entry,
        index: eIdx,
        displayNum: eIdx + 1,
        cycleIndex: idx
      }))
    }));
    context.cycleFormat = this.#calendarData.cycleFormat || '';
    context.basedOnOptions = basedOnOptions;

    // Prepare canonical hours
    context.canonicalHoursWithNav = (this.#calendarData.canonicalHours || []).map((ch, idx) => ({
      ...ch,
      index: idx
    }));

    // Prepare named weeks
    const currentWeeksType = this.#calendarData.weeks?.type || 'year-based';
    context.weeksTypeOptions = [
      { value: 'year-based', label: 'CALENDARIA.Editor.WeeksType.YearBased', selected: currentWeeksType === 'year-based' },
      { value: 'month-based', label: 'CALENDARIA.Editor.WeeksType.MonthBased', selected: currentWeeksType === 'month-based' }
    ];
    context.namedWeeksWithNav = (this.#calendarData.weeks?.names || []).map((week, idx) => ({
      ...week,
      index: idx
    }));

    // Prepare solstice month/day values from day-of-year
    const daylight = this.#calendarData.daylight || {};
    const winterSolstice = this.#dayOfYearToMonthDay(daylight.winterSolstice ?? 0);
    const summerSolstice = this.#dayOfYearToMonthDay(daylight.summerSolstice ?? Math.floor(context.calculatedDaysPerYear / 2));

    context.winterSolsticeMonth = winterSolstice.month;
    context.winterSolsticeDay = winterSolstice.day;
    context.summerSolsticeMonth = summerSolstice.month;
    context.summerSolsticeDay = summerSolstice.day;

    // Month options for solstice dropdowns (1-indexed)
    context.winterSolsticeMonthOptions = context.monthOptions.map((opt) => ({
      ...opt,
      selected: opt.value === winterSolstice.month
    }));
    context.summerSolsticeMonthOptions = context.monthOptions.map((opt) => ({
      ...opt,
      selected: opt.value === summerSolstice.month
    }));

    // Weather context
    this.#prepareWeatherContext(context);

    // Footer buttons
    context.buttons = [
      { type: 'button', action: 'saveCalendar', icon: 'fas fa-save', label: 'CALENDARIA.Editor.Button.Save' },
      { type: 'button', action: 'resetCalendar', icon: 'fas fa-undo', label: 'CALENDARIA.Editor.Button.Reset' }
    ];

    // Add Reset to Default button if editing a default calendar with an override
    if (this.#calendarId && CalendarManager.hasDefaultOverride(this.#calendarId)) {
      context.buttons.push({ type: 'button', action: 'resetToDefault', icon: 'fas fa-history', label: 'CALENDARIA.Editor.Button.ResetToDefault' });
    }

    // Add delete button only for custom calendars (not default calendars)
    if (this.#calendarId && CalendarManager.isCustomCalendar(this.#calendarId)) {
      context.buttons.push({ type: 'button', action: 'deleteCalendar', icon: 'fas fa-trash', label: 'CALENDARIA.Editor.Button.Delete', cssClass: 'delete-button' });
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
   * Apply theme class to the application element after render.
   * @param {ApplicationRenderContext} context - Render context
   * @param {RenderOptions} options - Render options
   * @protected
   */
  _onRender(context, options) {
    super._onRender?.(context, options);

    // Add listener for leap rule dropdown
    const leapRuleSelect = this.element.querySelector('.leap-rule-select');
    if (leapRuleSelect) {
      leapRuleSelect.addEventListener('change', (event) => {
        const rule = event.target.value;
        const simpleFields = this.element.querySelector('.leap-simple-fields');
        const customFields = this.element.querySelector('.leap-custom-fields');
        const gregorianInfo = this.element.querySelector('.leap-gregorian-info');

        if (simpleFields) simpleFields.style.display = rule === 'simple' ? '' : 'none';
        if (customFields) customFields.style.display = rule === 'custom' ? '' : 'none';
        if (gregorianInfo) gregorianInfo.style.display = rule === 'gregorian' ? '' : 'none';
      });
    }

    // Add listener for moon color preview
    for (const colorInput of this.element.querySelectorAll('input[name^="moons."][name$=".color"]')) {
      colorInput.addEventListener('input', (event) => {
        const preview = event.target.closest('.color-input-wrapper')?.querySelector('.moon-color-preview');
        if (!preview) return;
        const color = event.target.value;
        const isDefault = color.toLowerCase() === '#b8b8b8';
        preview.style.setProperty('--moon-color', color);
        preview.classList.toggle('tinted', !isDefault);
      });
    }

    // Add listener for era template preview and format dropdown state
    for (const templateInput of this.element.querySelectorAll('input[name^="eras."][name$=".template"]')) {
      const updatePreview = (input) => {
        const eraItem = input.closest('.era-item');
        if (!eraItem) return;

        const template = input.value.trim();
        const abbr = eraItem.querySelector('input[name$=".abbreviation"]')?.value || '';
        const eraName = eraItem.querySelector('input[name$=".name"]')?.value || '';
        const formatSelect = eraItem.querySelector('select[name$=".format"]');
        const previewEl = eraItem.querySelector('.era-preview');

        // Disable format dropdown when template is set
        if (formatSelect) {
          formatSelect.disabled = !!template;
          formatSelect.dataset.tooltip = template ? game.i18n.localize('CALENDARIA.Editor.Era.FormatDisabled') : '';
        }

        if (!previewEl) return;
        const sampleYear = 1492;
        if (template) previewEl.textContent = formatEraTemplate(template, { year: sampleYear, abbreviation: abbr, era: eraName, yearInEra: 1 });
        else previewEl.textContent = game.i18n.localize('CALENDARIA.Editor.Era.PreviewEmpty');
      };

      // Initial state
      updatePreview(templateInput);

      // Listen for changes
      templateInput.addEventListener('input', (event) => updatePreview(event.target));
    }

    // Add listener for weather chance and enabled inputs to update total dynamically
    this.#setupWeatherTotalListener();
  }

  /**
   * Set up event listeners for weather chance updates.
   * @private
   */
  #setupWeatherTotalListener() {
    const updateTotal = () => {
      let total = 0;
      for (const item of this.element.querySelectorAll('.weather-preset-item')) {
        const enabled = item.querySelector('.preset-enabled')?.checked;
        const chanceInput = item.querySelector('.preset-chance input');
        if (enabled && chanceInput) total += Number(chanceInput.value) || 0;
      }
      const totalEl = this.element.querySelector('.weather-totals .total-value');
      if (totalEl) {
        totalEl.textContent = `${total.toFixed(2)}%`;
        totalEl.classList.toggle('valid', Math.abs(total - 100) < 0.1);
        totalEl.classList.toggle('warning', Math.abs(total - 100) >= 0.1);
      }
    };

    // Listen to chance inputs
    for (const input of this.element.querySelectorAll('.preset-chance input')) input.addEventListener('input', updateTotal);

    // Listen to enabled checkboxes
    for (const checkbox of this.element.querySelectorAll('.preset-enabled')) checkbox.addEventListener('change', updateTotal);
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

  /**
   * Convert month and day to day-of-year (0-indexed).
   * @param {number} month - Month (1-indexed)
   * @param {number} day - Day of month (1-indexed)
   * @returns {number} Day of year (0-indexed)
   * @private
   */
  #monthDayToDayOfYear(month, day) {
    const months = this.#calendarData.months.values;
    let dayOfYear = 0;

    // Sum days of all months before the target month
    for (let i = 0; i < month - 1 && i < months.length; i++) dayOfYear += months[i].days || 0;

    // Add the day within the month (convert to 0-indexed)
    dayOfYear += (day || 1) - 1;

    return dayOfYear;
  }

  /**
   * Prepare weather context for the weather tab.
   * @param {object} context - Render context to populate
   * @private
   */
  #prepareWeatherContext(context) {
    const weather = this.#calendarData.weather || {};
    const zones = weather.zones || [];
    const activeZoneId = weather.activeZone || 'temperate';

    // Build zone options for dropdown
    context.zoneOptions = zones.map((z) => ({
      value: z.id,
      label: z.name,
      selected: z.id === activeZoneId
    }));

    // If no zones, add a default placeholder
    if (context.zoneOptions.length === 0) context.zoneOptions = [{ value: '', label: 'CALENDARIA.Editor.Weather.Zone.NoZones', selected: true }];

    // Get the active zone's presets
    const activeZone = zones.find((z) => z.id === activeZoneId) || zones[0] || null;
    const savedPresets = activeZone?.presets || [];

    // Temperature unit
    const tempUnit = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_UNIT) || 'celsius';
    context.tempUnit = tempUnit === 'fahrenheit' ? 'F' : 'C';

    // Build weather categories with presets
    let presetIndex = 0;
    let totalChance = 0;

    context.weatherCategories = Object.values(WEATHER_CATEGORIES)
      .map((cat) => {
        const categoryPresets = ALL_PRESETS.filter((p) => p.category === cat.id);
        let categoryChance = 0;
        let enabledCount = 0;

        const presetsWithData = categoryPresets.map((preset) => {
          // Find saved config for this preset
          const saved = savedPresets.find((s) => s.id === preset.id) || {};

          // Use saved values or fall back to preset defaults
          const chance = saved.chance ?? 0;
          const enabled = saved.enabled ?? false;
          if (enabled) {
            totalChance += chance;
            categoryChance += chance;
            enabledCount++;
          }

          const presetData = {
            ...preset,
            index: presetIndex++,
            enabled,
            chance: chance.toFixed(2),
            tempMin: saved.tempMin ?? '',
            tempMax: saved.tempMax ?? '',
            customDescription: saved.description || ''
          };

          return presetData;
        });

        return {
          id: cat.id,
          label: cat.label,
          presets: presetsWithData,
          totalChance: categoryChance.toFixed(1),
          enabledCount,
          allEnabled: enabledCount === presetsWithData.length && presetsWithData.length > 0
        };
      })
      .filter((cat) => cat.presets.length > 0);

    context.totalChance = totalChance.toFixed(2);
    context.chancesValid = Math.abs(totalChance - 100) < 0.1;
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
    // Debug: Check pending notes before form update
    log(3, `updateFromFormData - before: pendingNotes=${this.#calendarData.metadata?.pendingNotes?.length || 0}, importerId=${this.#calendarData.metadata?.importerId}`);

    // Basic info
    this.#calendarData.name = data.name || '';
    this.#calendarData.metadata.description = data['metadata.description'] || '';
    this.#calendarData.metadata.system = data['metadata.system'] || '';

    // Debug: Check pending notes after metadata update
    log(3, `updateFromFormData - after metadata: pendingNotes=${this.#calendarData.metadata?.pendingNotes?.length || 0}, importerId=${this.#calendarData.metadata?.importerId}`);

    // Year settings
    this.#calendarData.years.yearZero = parseInt(data['years.yearZero']) || 0;
    this.#calendarData.years.firstWeekday = parseInt(data['years.firstWeekday']) || 0;

    // Leap year rule - store in leapYearConfig (advanced) and sync to years.leapYear (Foundry standard)
    const leapRule = data['leapYearConfig.rule'] || 'none';
    if (leapRule === 'none') {
      this.#calendarData.leapYearConfig = null;
      this.#calendarData.years.leapYear = null;
    } else {
      const leapConfig = { rule: leapRule, start: parseInt(data['leapYearConfig.start']) || 0 };

      if (leapRule === 'simple') {
        leapConfig.interval = parseInt(data['leapYearConfig.interval']) || 4;
        // Also set Foundry standard format for compatibility
        this.#calendarData.years.leapYear = { leapStart: leapConfig.start, leapInterval: leapConfig.interval };
      } else if (leapRule === 'custom') {
        leapConfig.pattern = data['leapYearConfig.pattern'] || '';
        this.#calendarData.years.leapYear = null; // Complex patterns not supported by Foundry
      } else if (leapRule === 'gregorian') {
        // Gregorian uses interval 4 as approximation for Foundry
        this.#calendarData.years.leapYear = { leapStart: leapConfig.start, leapInterval: 4 };
      }

      this.#calendarData.leapYearConfig = leapConfig;
    }

    // Time settings
    this.#calendarData.days.daysPerYear = parseInt(data['days.daysPerYear']) || 365;
    this.#calendarData.days.hoursPerDay = parseInt(data['days.hoursPerDay']) || 24;
    this.#calendarData.days.minutesPerHour = parseInt(data['days.minutesPerHour']) || 60;
    this.#calendarData.days.secondsPerMinute = parseInt(data['days.secondsPerMinute']) || 60;

    // Daylight settings
    if (!this.#calendarData.daylight) this.#calendarData.daylight = {};
    this.#calendarData.daylight.enabled = data['daylight.enabled'] ?? false;
    this.#calendarData.daylight.shortestDay = parseFloat(data['daylight.shortestDay']) || 8;
    this.#calendarData.daylight.longestDay = parseFloat(data['daylight.longestDay']) || 16;

    // Convert solstice month/day to day-of-year
    const winterMonth = parseInt(data['daylight.winterSolsticeMonth']) || 1;
    const winterDay = parseInt(data['daylight.winterSolsticeDay']) || 1;
    this.#calendarData.daylight.winterSolstice = this.#monthDayToDayOfYear(winterMonth, winterDay);

    const summerMonth = parseInt(data['daylight.summerSolsticeMonth']) || 1;
    const summerDay = parseInt(data['daylight.summerSolsticeDay']) || 1;
    this.#calendarData.daylight.summerSolstice = this.#monthDayToDayOfYear(summerMonth, summerDay);

    // Process months array
    this.#updateArrayFromFormData(data, 'months', this.#calendarData.months.values, ['name', 'abbreviation', 'days', 'leapDays', 'startingWeekday']);

    // Process weekdays array
    this.#updateArrayFromFormData(data, 'weekdays', this.#calendarData.days.values, ['name', 'abbreviation', 'isRestDay']);

    // Process seasons array
    this.#updateSeasonsFromFormData(data);

    // Process eras array
    this.#updateErasFromFormData(data);

    // Process festivals array
    this.#updateArrayFromFormData(data, 'festivals', this.#calendarData.festivals, ['name', 'month', 'day', 'leapYearOnly', 'countsForWeekday']);

    // Process moons array
    this.#updateMoonsFromFormData(data);

    // Process cycles array
    this.#updateCyclesFromFormData(data);

    // AM/PM notation
    if (!this.#calendarData.amPmNotation) this.#calendarData.amPmNotation = {};
    this.#calendarData.amPmNotation.am = data['amPmNotation.am'] || 'AM';
    this.#calendarData.amPmNotation.pm = data['amPmNotation.pm'] || 'PM';

    // Date formats
    if (!this.#calendarData.dateFormats) this.#calendarData.dateFormats = {};
    this.#calendarData.dateFormats.short = data['dateFormats.short'] || '{{d}} {{b}}';
    this.#calendarData.dateFormats.long = data['dateFormats.long'] || '{{d}} {{B}}, {{y}}';
    this.#calendarData.dateFormats.full = data['dateFormats.full'] || '{{B}} {{d}}, {{y}}';
    this.#calendarData.dateFormats.time = data['dateFormats.time'] || '{{H}}:{{M}}';
    this.#calendarData.dateFormats.time12 = data['dateFormats.time12'] || '{{h}}:{{M}} {{p}}';

    // Canonical hours
    this.#updateCanonicalHoursFromFormData(data);

    // Named weeks
    this.#updateNamedWeeksFromFormData(data);

    // Weather config
    this.#updateWeatherFromFormData(data);
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
          if (field === 'leapDays' || field === 'startingWeekday') item[field] = isNaN(parseInt(data[key])) ? null : parseInt(data[key]);
          else if (field === 'days' || field === 'day' || field === 'month' || field === 'dayStart' || field === 'dayEnd') item[field] = parseInt(data[key]) || 0;
          else if (field === 'isRestDay' || field === 'leapYearOnly' || field === 'countsForWeekday') item[field] = !!data[key];
          else item[field] = data[key];
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
   * Update eras array from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateErasFromFormData(data) {
    const indices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^eras\.(\d+)\./);
      if (match) indices.add(parseInt(match[1]));
    }

    const sortedIndices = [...indices].sort((a, b) => a - b);
    this.#calendarData.eras.length = 0;

    for (const idx of sortedIndices) {
      const templateValue = data[`eras.${idx}.template`]?.trim();
      const era = {
        name: data[`eras.${idx}.name`] || '',
        abbreviation: data[`eras.${idx}.abbreviation`] || '',
        startYear: parseInt(data[`eras.${idx}.startYear`]) || 1,
        endYear: this.#parseOptionalInt(data[`eras.${idx}.endYear`]),
        format: data[`eras.${idx}.format`] || 'suffix',
        template: templateValue || null
      };
      this.#calendarData.eras.push(era);
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
      const existingPhases = existingMoon?.phases || getDefaultMoonPhases();

      // Detect phase indices from form data (supports dynamic phase counts)
      const phaseIndices = new Set();
      const phasePattern = new RegExp(`^moons\\.${moonIdx}\\.phases\\.(\\d+)\\.`);
      for (const key of Object.keys(data)) {
        const match = key.match(phasePattern);
        if (match) phaseIndices.add(parseInt(match[1]));
      }
      const sortedPhaseIndices = [...phaseIndices].sort((a, b) => a - b);

      // Build phases from form data (convert percentages to decimals)
      const phases = [];
      for (const pIdx of sortedPhaseIndices) {
        const phaseName = data[`moons.${moonIdx}.phases.${pIdx}.name`];
        const phaseRisingName = data[`moons.${moonIdx}.phases.${pIdx}.rising`];
        const phaseFadingName = data[`moons.${moonIdx}.phases.${pIdx}.fading`];
        const phaseIcon = data[`moons.${moonIdx}.phases.${pIdx}.icon`];
        const phaseStartPercent = data[`moons.${moonIdx}.phases.${pIdx}.startPercent`];
        const phaseEndPercent = data[`moons.${moonIdx}.phases.${pIdx}.endPercent`];

        // Use form data if available, otherwise fall back to existing (convert % to decimal)
        phases.push({
          name: phaseName ?? existingPhases[pIdx]?.name ?? '',
          rising: phaseRisingName ?? existingPhases[pIdx]?.rising ?? '',
          fading: phaseFadingName ?? existingPhases[pIdx]?.fading ?? '',
          icon: phaseIcon ?? existingPhases[pIdx]?.icon ?? '',
          start: phaseStartPercent != null ? parseFloat(phaseStartPercent) / 100 : (existingPhases[pIdx]?.start ?? pIdx * 0.125),
          end: phaseEndPercent != null ? parseFloat(phaseEndPercent) / 100 : (existingPhases[pIdx]?.end ?? (pIdx + 1) * 0.125)
        });
      }

      // Treat default gray as "no color" (matches natural SVG gray)
      const rawColor = data[`moons.${moonIdx}.color`] || '';
      const moonColor = rawColor.toLowerCase() === '#b8b8b8' ? '' : rawColor;

      const moon = {
        name: data[`moons.${moonIdx}.name`] || '',
        cycleLength: parseInt(data[`moons.${moonIdx}.cycleLength`]) || 28,
        color: moonColor,
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
   * Update cycles array from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateCyclesFromFormData(data) {
    // Update cycle format
    this.#calendarData.cycleFormat = data.cycleFormat || '';

    // Find all cycle indices
    const cycleIndices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^cycles\.(\d+)\./);
      if (match) cycleIndices.add(parseInt(match[1]));
    }

    const sortedCycleIndices = [...cycleIndices].sort((a, b) => a - b);
    const newCycles = [];

    for (const cycleIdx of sortedCycleIndices) {
      // Find all entry indices for this cycle
      const entryIndices = new Set();
      const entryPattern = new RegExp(`^cycles\\.${cycleIdx}\\.entries\\.(\\d+)\\.`);
      for (const key of Object.keys(data)) {
        const match = key.match(entryPattern);
        if (match) entryIndices.add(parseInt(match[1]));
      }
      const sortedEntryIndices = [...entryIndices].sort((a, b) => a - b);

      // Build entries array
      const entries = [];
      for (const eIdx of sortedEntryIndices) entries.push({ name: data[`cycles.${cycleIdx}.entries.${eIdx}.name`] || '' });

      const cycle = {
        name: data[`cycles.${cycleIdx}.name`] || '',
        length: parseInt(data[`cycles.${cycleIdx}.length`]) || 12,
        offset: parseInt(data[`cycles.${cycleIdx}.offset`]) || 0,
        basedOn: data[`cycles.${cycleIdx}.basedOn`] || 'month',
        entries
      };
      newCycles.push(cycle);
    }

    this.#calendarData.cycles = newCycles;
  }

  /**
   * Update canonical hours from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateCanonicalHoursFromFormData(data) {
    const indices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^canonicalHours\.(\d+)\./);
      if (match) indices.add(parseInt(match[1]));
    }

    const sortedIndices = [...indices].sort((a, b) => a - b);
    const newCanonicalHours = [];

    for (const idx of sortedIndices) {
      newCanonicalHours.push({
        name: data[`canonicalHours.${idx}.name`] || '',
        abbreviation: data[`canonicalHours.${idx}.abbreviation`] || '',
        startHour: parseInt(data[`canonicalHours.${idx}.startHour`]) || 0,
        endHour: parseInt(data[`canonicalHours.${idx}.endHour`]) || 0
      });
    }

    this.#calendarData.canonicalHours = newCanonicalHours;
  }

  /**
   * Update named weeks from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateNamedWeeksFromFormData(data) {
    if (!this.#calendarData.weeks) this.#calendarData.weeks = {};

    this.#calendarData.weeks.enabled = !!data['weeks.enabled'];
    this.#calendarData.weeks.type = data['weeks.type'] || 'year-based';

    // Find all name indices
    const indices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^weeks\.names\.(\d+)\./);
      if (match) indices.add(parseInt(match[1]));
    }

    const sortedIndices = [...indices].sort((a, b) => a - b);
    const newNames = [];

    for (const idx of sortedIndices) newNames.push({ name: data[`weeks.names.${idx}.name`] || '', abbreviation: data[`weeks.names.${idx}.abbreviation`] || '' });

    this.#calendarData.weeks.names = newNames;
  }

  /**
   * Update weather config from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateWeatherFromFormData(data) {
    if (!this.#calendarData.weather) this.#calendarData.weather = { zones: [], activeZone: null, autoGenerate: false };

    // Update active zone and auto-generate settings
    const selectedZone = data['weather.activeZone'];
    if (selectedZone) this.#calendarData.weather.activeZone = selectedZone;
    this.#calendarData.weather.autoGenerate = !!data['weather.autoGenerate'];

    // Find all preset indices
    const presetIndices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^weather\.presets\.(\d+)\./);
      if (match) presetIndices.add(parseInt(match[1]));
    }

    const sortedIndices = [...presetIndices].sort((a, b) => a - b);
    const newPresets = [];

    for (const idx of sortedIndices) {
      const id = data[`weather.presets.${idx}.id`];
      if (!id) continue;

      const preset = { id, enabled: !!data[`weather.presets.${idx}.enabled`], chance: parseFloat(data[`weather.presets.${idx}.chance`]) || 0 };

      // Only store temp values if they're set
      const tempMin = data[`weather.presets.${idx}.tempMin`];
      const tempMax = data[`weather.presets.${idx}.tempMax`];
      if (tempMin !== '' && tempMin != null) preset.tempMin = parseInt(tempMin);
      if (tempMax !== '' && tempMax != null) preset.tempMax = parseInt(tempMax);

      // Only store description if it's customized
      const desc = data[`weather.presets.${idx}.description`]?.trim();
      if (desc) preset.description = desc;

      newPresets.push(preset);
    }

    // Update presets on the active zone
    const activeZoneId = this.#calendarData.weather.activeZone;
    const zones = this.#calendarData.weather.zones || [];
    const activeZone = zones.find((z) => z.id === activeZoneId);

    if (activeZone) activeZone.presets = newPresets;
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
   * Add a new era after the target index.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddEra(event, target) {
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.eras.length - 1;
    const insertIdx = afterIdx + 1;
    const totalEras = this.#calendarData.eras.length + 1;
    this.#calendarData.eras.splice(insertIdx, 0, {
      name: game.i18n.format('CALENDARIA.Editor.Default.EraName', { num: totalEras }),
      abbreviation: game.i18n.format('CALENDARIA.Editor.Default.EraAbbr', { num: totalEras }),
      startYear: 1,
      endYear: null,
      format: 'suffix',
      template: null
    });
    this.render();
  }

  /**
   * Remove an era.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveEra(event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.eras.splice(idx, 1);
    this.render();
  }

  /**
   * Generate a preview string for an era template.
   * @param {object} era - Era object with template, abbreviation, name, format
   * @returns {string} Preview string or empty placeholder
   */
  #generateEraPreview(era) {
    if (!era.template) return game.i18n.localize('CALENDARIA.Editor.Era.PreviewEmpty');
    const sampleYear = 1492;
    const abbr = era.abbreviation ? game.i18n.localize(era.abbreviation) : '';
    const eraName = era.name ? game.i18n.localize(era.name) : '';
    return formatEraTemplate(era.template, { year: sampleYear, abbreviation: abbr, era: eraName, yearInEra: 1 });
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
    this.#calendarData.festivals.splice(insertIdx, 0, { name: game.i18n.format('CALENDARIA.Editor.Default.FestivalName', { num: totalFestivals }), month: 1, day: 1 });
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
    this.#calendarData.moons.push({ name: game.i18n.localize('CALENDARIA.Editor.Default.MoonName'), cycleLength: 28, phases: getDefaultMoonPhases(), referenceDate: { year: 0, month: 0, day: 1 } });
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
   * Add a new phase to a moon.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddMoonPhase(event, target) {
    const moonIdx = parseInt(target.dataset.moonIndex);
    const moon = this.#calendarData.moons[moonIdx];
    if (!moon) return;

    if (!moon.phases) moon.phases = getDefaultMoonPhases();

    const phaseCount = moon.phases.length;
    const interval = 1 / (phaseCount + 1);

    // Add new phase at end
    moon.phases.push({
      name: game.i18n.format('CALENDARIA.Editor.Default.PhaseName', { num: phaseCount + 1 }),
      rising: '',
      fading: '',
      icon: `${ASSETS.MOON_ICONS}/05_fullmoon.svg`,
      start: phaseCount * interval,
      end: 1
    });

    // Redistribute phase ranges evenly
    const newCount = moon.phases.length;
    const newInterval = 1 / newCount;
    for (let i = 0; i < newCount; i++) {
      moon.phases[i].start = i * newInterval;
      moon.phases[i].end = (i + 1) * newInterval;
    }

    this.render();
  }

  /**
   * Remove a phase from a moon.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveMoonPhase(event, target) {
    const moonIdx = parseInt(target.dataset.moonIndex);
    const phaseIdx = parseInt(target.dataset.phaseIndex);
    const moon = this.#calendarData.moons[moonIdx];
    if (!moon?.phases || moon.phases.length <= 1) return;

    moon.phases.splice(phaseIdx, 1);

    // Redistribute phase ranges evenly
    const count = moon.phases.length;
    const interval = 1 / count;
    for (let i = 0; i < count; i++) {
      moon.phases[i].start = i * interval;
      moon.phases[i].end = (i + 1) * interval;
    }

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
        if (!moon.phases) moon.phases = getDefaultMoonPhases();
        moon.phases[phaseIdx].icon = path;
        this.render();
      }
    });
    picker.render(true);
  }

  /**
   * Add a new cycle.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddCycle(event, target) {
    if (!this.#calendarData.cycles) this.#calendarData.cycles = [];
    const totalCycles = this.#calendarData.cycles.length + 1;
    this.#calendarData.cycles.push({
      name: game.i18n.format('CALENDARIA.Editor.Default.CycleName', { num: totalCycles }),
      length: 12,
      offset: 0,
      basedOn: 'month',
      entries: [{ name: game.i18n.format('CALENDARIA.Editor.Default.CycleEntry', { num: 1 }) }]
    });
    this.render();
  }

  /**
   * Remove a cycle.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveCycle(event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.cycles.splice(idx, 1);
    this.render();
  }

  /**
   * Add a new entry to a cycle.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddCycleEntry(event, target) {
    const cycleIdx = parseInt(target.dataset.cycleIndex);
    const cycle = this.#calendarData.cycles[cycleIdx];
    if (!cycle) return;

    if (!cycle.entries) cycle.entries = [];
    const entryCount = cycle.entries.length + 1;
    cycle.entries.push({ name: game.i18n.format('CALENDARIA.Editor.Default.CycleEntry', { num: entryCount }) });
    this.render();
  }

  /**
   * Remove an entry from a cycle.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveCycleEntry(event, target) {
    const cycleIdx = parseInt(target.dataset.cycleIndex);
    const entryIdx = parseInt(target.dataset.entryIndex);
    const cycle = this.#calendarData.cycles[cycleIdx];
    if (!cycle?.entries || cycle.entries.length <= 1) return;

    cycle.entries.splice(entryIdx, 1);
    this.render();
  }

  /**
   * Add a new canonical hour.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddCanonicalHour(event, target) {
    if (!this.#calendarData.canonicalHours) this.#calendarData.canonicalHours = [];
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.canonicalHours.length - 1;
    const insertIdx = afterIdx + 1;
    const totalHours = this.#calendarData.canonicalHours.length;
    this.#calendarData.canonicalHours.splice(insertIdx, 0, {
      name: game.i18n.format('CALENDARIA.Editor.Default.CanonicalHourName', { num: totalHours + 1 }),
      abbreviation: '',
      startHour: totalHours * 3,
      endHour: (totalHours + 1) * 3
    });
    this.render();
  }

  /**
   * Remove a canonical hour.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveCanonicalHour(event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.canonicalHours.splice(idx, 1);
    this.render();
  }

  /**
   * Add a new named week.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddNamedWeek(event, target) {
    if (!this.#calendarData.weeks) this.#calendarData.weeks = { enabled: false, type: 'year-based', names: [] };
    if (!this.#calendarData.weeks.names) this.#calendarData.weeks.names = [];
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.weeks.names.length - 1;
    const insertIdx = afterIdx + 1;
    const totalWeeks = this.#calendarData.weeks.names.length;
    this.#calendarData.weeks.names.splice(insertIdx, 0, {
      name: game.i18n.format('CALENDARIA.Editor.Default.WeekName', { num: totalWeeks + 1 }),
      abbreviation: ''
    });
    this.render();
  }

  /**
   * Remove a named week.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveNamedWeek(event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.weeks.names.splice(idx, 1);
    this.render();
  }

  /**
   * Toggle a weather category's collapsed state.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onToggleCategory(event, target) {
    const category = target.closest('.weather-category');
    if (category) category.classList.toggle('collapsed');
  }

  /**
   * Reset a weather preset to its default values.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onResetWeatherPreset(event, target) {
    const presetId = target.dataset.presetId;
    if (!presetId) return;

    // Find and remove this preset from saved config
    const presets = this.#calendarData.weather?.presets || [];
    const idx = presets.findIndex((p) => p.id === presetId);
    if (idx >= 0) {
      presets.splice(idx, 1);
      this.render();
    }
  }

  /**
   * Toggle description popover visibility.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static #onToggleDescription(event, target) {
    const presetItem = target.closest('.weather-preset-item');
    if (!presetItem) return;

    const popover = presetItem.querySelector('.description-popover');
    if (!popover) return;

    // Close any other open popovers
    this.element.querySelectorAll('.description-popover.show').forEach((p) => {
      if (p !== popover) p.classList.remove('show');
    });

    popover.classList.toggle('show');
  }

  /**
   * Add a new climate zone from a template.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddZone(event, target) {
    const templateOptions = getClimateTemplateOptions();
    const selectHtml = templateOptions.map((opt) => `<option value="${opt.value}">${game.i18n.localize(opt.label)}</option>`).join('');

    const content = `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize('CALENDARIA.Editor.Weather.Zone.CopyFrom')}</label>
          <select name="template">${selectHtml}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('CALENDARIA.Editor.Weather.Zone.Name')}</label>
          <input type="text" name="name" placeholder="${game.i18n.localize('CALENDARIA.Editor.Weather.Zone.Name')}">
        </div>
      </form>
    `;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('CALENDARIA.Editor.Weather.Zone.Add') },
      content,
      ok: {
        callback: (event, button, dialog) => {
          const form = button.form;
          return { template: form.elements.template.value, name: form.elements.name.value };
        }
      }
    });

    if (!result) return;

    // Get season names from the calendar for temperature keys
    const seasonNames = this.#calendarData.seasons?.values?.map((s) => s.name) || ['Spring', 'Summer', 'Autumn', 'Winter'];

    // Create zone from template
    const zoneConfig = getDefaultZoneConfig(result.template, seasonNames);
    if (!zoneConfig) return;

    // Generate unique ID
    const baseId = result.name?.toLowerCase().replace(/\s+/g, '-') || result.template;
    let zoneId = baseId;
    let counter = 1;
    const existingIds = (this.#calendarData.weather?.zones || []).map((z) => z.id);
    while (existingIds.includes(zoneId)) zoneId = `${baseId}-${counter++}`;
    zoneConfig.id = zoneId;
    zoneConfig.name = result.name || game.i18n.localize(CLIMATE_ZONE_TEMPLATES[result.template]?.name || result.template);

    // Add to calendar
    if (!this.#calendarData.weather) this.#calendarData.weather = { zones: [], activeZone: null, autoGenerate: false };
    if (!this.#calendarData.weather.zones) this.#calendarData.weather.zones = [];
    this.#calendarData.weather.zones.push(zoneConfig);
    this.#calendarData.weather.activeZone = zoneConfig.id;

    this.render();
  }

  /**
   * Edit the active climate zone.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onEditZone(event, target) {
    const zones = this.#calendarData.weather?.zones || [];
    const activeZoneId = this.#calendarData.weather?.activeZone;
    const zone = zones.find((z) => z.id === activeZoneId);

    if (!zone) {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.Editor.Weather.Zone.NoZones'));
      return;
    }

    // Get season names from calendar
    const seasonNames = this.#calendarData.seasons?.values?.map((s) => s.name) || ['Spring', 'Summer', 'Autumn', 'Winter'];

    // Build temperature fields for each season
    const tempRows = seasonNames
      .map((season) => {
        const temp = zone.temperatures?.[season] || zone.temperatures?._default || { min: 10, max: 22 };
        return `
        <div class="form-group temperature-row">
          <label>${season}</label>
          <input type="number" name="temp_${season}_min" value="${temp.min}" placeholder="${game.i18n.localize('CALENDARIA.Editor.Weather.Zone.TempMin')}">
          <span>–</span>
          <input type="number" name="temp_${season}_max" value="${temp.max}" placeholder="${game.i18n.localize('CALENDARIA.Editor.Weather.Zone.TempMax')}">
        </div>
      `;
      })
      .join('');

    const content = `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize('CALENDARIA.Editor.Weather.Zone.Name')}</label>
          <input type="text" name="name" value="${zone.name}">
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('CALENDARIA.Editor.Weather.Zone.Description')}</label>
          <textarea name="description">${zone.description || ''}</textarea>
        </div>
        <fieldset>
          <legend>${game.i18n.localize('CALENDARIA.Editor.Weather.Zone.Temperatures')}</legend>
          ${tempRows}
        </fieldset>
      </form>
    `;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('CALENDARIA.Editor.Weather.Zone.Edit') },
      content,
      ok: {
        callback: (event, button, dialog) => {
          const form = button.form;
          const data = { name: form.elements.name.value, description: form.elements.description.value, temperatures: {} };

          for (const season of seasonNames) {
            data.temperatures[season] = {
              min: parseInt(form.elements[`temp_${season}_min`].value) || 0,
              max: parseInt(form.elements[`temp_${season}_max`].value) || 20
            };
          }

          return data;
        }
      }
    });

    if (!result) return;

    // Update zone
    zone.name = result.name;
    zone.description = result.description;
    zone.temperatures = result.temperatures;

    this.render();
  }

  /**
   * Delete the active climate zone.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onDeleteZone(event, target) {
    const zones = this.#calendarData.weather?.zones || [];
    const activeZoneId = this.#calendarData.weather?.activeZone;
    const zoneIdx = zones.findIndex((z) => z.id === activeZoneId);

    if (zoneIdx < 0) {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.Editor.Weather.Zone.NoZones'));
      return;
    }

    const zone = zones[zoneIdx];
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CALENDARIA.Editor.Weather.Zone.Delete') },
      content: `<p>${game.i18n.format('CALENDARIA.Editor.Weather.Zone.DeleteConfirm', { name: zone.name })}</p>`
    });

    if (!confirm) return;

    zones.splice(zoneIdx, 1);

    // Select another zone if available
    if (zones.length > 0) this.#calendarData.weather.activeZone = zones[0].id;
    else this.#calendarData.weather.activeZone = null;

    this.render();
  }

  /**
   * Toggle all presets in a category.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static #onToggleCategorySelectAll(event, target) {
    event.stopPropagation();

    const categoryId = target.dataset.category;
    if (!categoryId) return;

    const shouldEnable = target.checked;
    const categoryDiv = this.element.querySelector(`.weather-category[data-category="${categoryId}"]`);
    if (!categoryDiv) return;

    // Toggle all preset checkboxes in this category
    const checkboxes = categoryDiv.querySelectorAll('.preset-enabled');
    checkboxes.forEach((cb) => {
      cb.checked = shouldEnable;
    });
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

    if (isCustom) buttons.push({ action: 'edit', label: game.i18n.localize('CALENDARIA.Editor.EditCalendar'), icon: 'fas fa-edit', default: true });
    buttons.push({ action: 'template', label: game.i18n.localize('CALENDARIA.Editor.UseAsTemplate'), icon: 'fas fa-copy', default: !isCustom });
    buttons.push({ action: 'cancel', label: game.i18n.localize('CALENDARIA.UI.Cancel'), icon: 'fas fa-times' });

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
      if (!this.#calendarData.eras) this.#calendarData.eras = [];
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
    if (data.festivals) for (const festival of data.festivals) if (festival.name) festival.name = game.i18n.localize(festival.name);

    // Localize eras
    if (data.eras) {
      for (const era of data.eras) {
        if (era.name) era.name = game.i18n.localize(era.name);
        if (era.abbreviation) era.abbreviation = game.i18n.localize(era.abbreviation);
      }
    }

    // Localize moons
    if (data.moons) {
      for (const moon of data.moons) {
        if (moon.name) moon.name = game.i18n.localize(moon.name);
        if (moon.phases) for (const phase of moon.phases) if (phase.name) phase.name = game.i18n.localize(phase.name);
      }
    }

    // Localize cycles
    if (data.cycles) {
      for (const cycle of data.cycles) {
        if (cycle.name) cycle.name = game.i18n.localize(cycle.name);
        if (cycle.entries) for (const entry of cycle.entries) if (entry.name) entry.name = game.i18n.localize(entry.name);
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

    // Show save dialog with "Set as active" option
    const setActive = await this.#showSaveDialog();
    if (setActive === null) return; // Cancelled

    // Calculate daysPerYear from months
    this.#calendarData.days.daysPerYear = this.#calculateDaysPerYear();

    try {
      let calendar;
      let calendarId;

      if (this.#isEditing && this.#calendarId) {
        // Check if this is a default calendar (needs override) or custom calendar
        if (CalendarManager.isDefaultCalendar(this.#calendarId) || CalendarManager.hasDefaultOverride(this.#calendarId)) {
          // Save as override for default calendar
          calendar = await CalendarManager.saveDefaultOverride(this.#calendarId, this.#calendarData);
        } else {
          // Update existing custom calendar
          calendar = await CalendarManager.updateCustomCalendar(this.#calendarId, this.#calendarData);
        }
        calendarId = this.#calendarId;
      } else {
        // Create new - use suggested ID from importer if available
        const id =
          this.#calendarData.metadata?.suggestedId ||
          this.#calendarData.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-');
        calendar = await CalendarManager.createCustomCalendar(id, this.#calendarData);
        if (calendar) {
          calendarId = calendar.metadata?.id;
          this.#calendarId = calendarId;
          this.#isEditing = true;
        }
      }

      if (calendar) {
        ui.notifications.info(game.i18n.format('CALENDARIA.Editor.SaveSuccess', { name: this.#calendarData.name }));

        // Import pending notes from importer if any (using instance variables)
        log(3, `Checking for pending notes: ${this.#pendingNotes?.length || 0}, importerId: ${this.#pendingImporterId}, calendarId: ${calendarId}`);
        if (this.#pendingNotes?.length > 0 && this.#pendingImporterId && calendarId) {
          const importer = createImporter(this.#pendingImporterId);
          if (importer) {
            log(3, `Importing ${this.#pendingNotes.length} pending notes to calendar ${calendarId}`);
            const result = await importer.importNotes(this.#pendingNotes, { calendarId });
            if (result.count > 0) ui.notifications.info(game.i18n.format('CALENDARIA.Editor.NotesImported', { count: result.count }));
            if (result.errors?.length > 0) log(1, 'Note import errors:', result.errors);

            // Clear pending notes after import
            this.#pendingNotes = null;
            this.#pendingImporterId = null;
          }
        }

        // Set as active calendar if requested
        if (setActive && calendarId) {
          await CalendarManager.switchCalendar(calendarId);
          // Reload the world to fully apply the new calendar
          foundry.utils.debouncedReload();
        }
      }
    } catch (error) {
      log(2, 'Error saving calendar:', error);
      ui.notifications.error(game.i18n.format('CALENDARIA.Editor.SaveError', { error: error.message }));
    }
  }

  /**
   * Show save dialog with "Set as active calendar" option.
   * @returns {Promise<boolean|null>} True if set active, false if not, null if cancelled
   * @private
   */
  async #showSaveDialog() {
    const isGM = game.user.isGM;
    const content = `
      <p>${game.i18n.localize('CALENDARIA.Editor.ConfirmSave')}</p>
      ${
        isGM
          ? `<div class="form-group">
        <label class="checkbox">
          <input type="checkbox" name="setActive" ${this.#setActiveOnSave ? 'checked' : ''}>
          ${game.i18n.localize('CALENDARIA.Editor.SetAsActive')}
        </label>
        <p class="hint">${game.i18n.localize('CALENDARIA.Editor.SetAsActiveHint')}</p>
      </div>`
          : ''
      }
    `;

    return new Promise((resolve) => {
      foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize('CALENDARIA.Editor.Button.Save') },
        content,
        ok: {
          label: game.i18n.localize('CALENDARIA.Editor.Button.Save'),
          icon: 'fas fa-save',
          callback: (event, button, dialog) => {
            const setActive = isGM ? (button.form.elements.setActive?.checked ?? false) : false;
            this.#setActiveOnSave = setActive; // Remember for next save
            resolve(setActive);
          }
        },
        rejectClose: false
      }).then((result) => {
        if (result === undefined) resolve(null); // Dialog was closed
      });
    });
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
   * Reset a default calendar to its original state (remove override).
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onResetToDefault(event, target) {
    if (!this.#calendarId || !CalendarManager.hasDefaultOverride(this.#calendarId)) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CALENDARIA.Editor.Button.ResetToDefault') },
      content: `<p>${game.i18n.localize('CALENDARIA.Editor.ConfirmResetToDefault')}</p>`,
      yes: { label: game.i18n.localize('CALENDARIA.Editor.Button.ResetToDefault'), icon: 'fas fa-history', callback: () => true },
      no: { label: game.i18n.localize('CALENDARIA.UI.Cancel'), icon: 'fas fa-times' }
    });

    if (!confirmed) return;

    const reset = await CalendarManager.resetDefaultCalendar(this.#calendarId);
    if (reset) {
      // Reload the calendar data from the registry
      this.#loadExistingCalendar(this.#calendarId);
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
    if (deleted) {
      // Switch to editing the active calendar
      const activeCalendar = CalendarManager.getActiveCalendar();
      if (activeCalendar?.metadata?.id) {
        this.#calendarId = activeCalendar.metadata.id;
        this.#isEditing = true;
        this.#loadExistingCalendar(this.#calendarId);
      } else {
        // No calendars left, switch to create new mode
        this.#calendarId = null;
        this.#isEditing = false;
        this.#initializeBlankCalendar();
      }
      this.render();
    }
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

  /**
   * Open the calendar builder with pre-loaded data (e.g., from importer).
   * @param {object} data - Calendar data to load
   * @param {object} [options] - Additional options
   * @param {string} [options.suggestedId] - Suggested ID for the calendar
   * @returns {CalendarEditor}
   */
  static createFromData(data, options = {}) {
    return new CalendarEditor({ initialData: data, suggestedId: options.suggestedId }).render(true);
  }
}
