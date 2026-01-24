/**
 * Calendar Editor Application
 * A comprehensive UI for creating and editing custom calendars.
 * @module Applications/CalendarEditor
 * @author Tyler
 */

import { isBundledCalendar } from '../calendar/calendar-loader.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import CalendarRegistry from '../calendar/calendar-registry.mjs';
import { formatEraTemplate } from '../calendar/calendar-utils.mjs';
import { ASSETS, DEFAULT_MOON_PHASES, MODULE, SETTINGS, TEMPLATES } from '../constants.mjs';
import { createImporter } from '../importers/index.mjs';
import { format, localize, preLocalizeCalendar } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { CLIMATE_ZONE_TEMPLATES, fromDisplayUnit, getClimateTemplateOptions, getDefaultZoneConfig, toDisplayUnit } from '../weather/climate-data.mjs';
import { ALL_PRESETS, getAllPresets, WEATHER_CATEGORIES } from '../weather/weather-presets.mjs';

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
      toggleCustomWeekdays: CalendarEditor.#onToggleCustomWeekdays,
      addWeekday: CalendarEditor.#onAddWeekday,
      removeWeekday: CalendarEditor.#onRemoveWeekday,
      moveWeekdayUp: CalendarEditor.#onMoveWeekdayUp,
      moveWeekdayDown: CalendarEditor.#onMoveWeekdayDown,
      addSeason: CalendarEditor.#onAddSeason,
      removeSeason: CalendarEditor.#onRemoveSeason,
      editSeasonClimate: CalendarEditor.#onEditSeasonClimate,
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
      duplicateCalendar: CalendarEditor.#onDuplicateCalendar,
      saveCalendar: CalendarEditor.#onSaveCalendar,
      exportCalendar: CalendarEditor.#onExportCalendar,
      resetCalendar: CalendarEditor.#onResetCalendar,
      deleteCalendar: CalendarEditor.#onDeleteCalendar,
      toggleCategory: CalendarEditor.#onToggleCategory,
      resetWeatherPreset: CalendarEditor.#onResetWeatherPreset,
      toggleDescription: CalendarEditor.#onToggleDescription,
      addZone: CalendarEditor.#onAddZone,
      editZone: CalendarEditor.#onEditZone,
      deleteZone: CalendarEditor.#onDeleteZone,
      toggleCategorySelectAll: CalendarEditor.#onToggleCategorySelectAll,
      createNew: CalendarEditor.#onCreateNew
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
        { id: 'months', icon: 'fas fa-calendar', label: 'CALENDARIA.Common.Months' },
        { id: 'weekdays', icon: 'fas fa-calendar-week', label: 'CALENDARIA.Common.Weekdays' },
        { id: 'time', icon: 'fas fa-clock', label: 'CALENDARIA.Common.Time' },
        { id: 'seasons', icon: 'fas fa-sun', label: 'CALENDARIA.Common.Seasons' },
        { id: 'eras', icon: 'fas fa-hourglass-half', label: 'CALENDARIA.Common.Eras' },
        { id: 'festivals', icon: 'fas fa-star', label: 'CALENDARIA.Common.Festivals' },
        { id: 'moons', icon: 'fas fa-moon', label: 'CALENDARIA.Common.Moons' },
        { id: 'cycles', icon: 'fas fa-arrows-rotate', label: 'CALENDARIA.Common.Cycles' },
        { id: 'weather', icon: 'fas fa-cloud-sun', label: 'CALENDARIA.Common.Weather' }
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
   * Pending current date to apply after import
   * @type {{year: number, month: number, day: number}|null}
   */
  #pendingCurrentDate = null;

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

  /**
   * Create a blank calendar structure with minimum required data.
   * @returns {object} Blank calendar object
   * @private
   */
  static #createBlankCalendar() {
    return {
      name: '',
      years: { yearZero: 0, firstWeekday: 0, leapYear: null },
      months: { values: [{ name: format('CALENDARIA.Editor.Default.MonthName', { num: 1 }), abbreviation: format('CALENDARIA.Editor.Default.MonthAbbr', { num: 1 }), ordinal: 1, days: 30 }] },
      days: {
        values: [{ name: format('CALENDARIA.Editor.Default.DayName', { num: 1 }), abbreviation: format('CALENDARIA.Editor.Default.DayAbbr', { num: 1 }), ordinal: 1 }],
        daysPerYear: 365,
        hoursPerDay: 24,
        minutesPerHour: 60,
        secondsPerMinute: 60
      },
      secondsPerRound: 6,
      seasons: { type: 'dated', offset: 0, values: [] },
      eras: [],
      festivals: [],
      moons: [],
      cycles: [],
      canonicalHours: [],
      weeks: { enabled: false, type: 'year-based', names: [] },
      amPmNotation: { am: 'AM', pm: 'PM' },
      dateFormats: { short: 'D MMM', long: 'D MMMM, YYYY', full: 'MMMM D, YYYY', time: 'HH:mm', time12: 'h:mm a' },
      metadata: { id: '', description: '', author: game.user?.name ?? '', system: '' },
      weather: { activeZone: null, autoGenerate: false, zones: [] }
    };
  }

  /**
   * Initialize a blank calendar structure.
   * @private
   */
  #initializeBlankCalendar() {
    this.#calendarData = CalendarEditor.#createBlankCalendar();
  }

  /**
   * Load an existing calendar for editing.
   * @param {string} calendarId - Calendar ID to load
   * @private
   */
  #loadExistingCalendar(calendarId) {
    const calendar = CalendarManager.getCalendar(calendarId);
    if (calendar) {
      this.#calendarData = foundry.utils.mergeObject(CalendarEditor.#createBlankCalendar(), calendar.toObject());
      preLocalizeCalendar(this.#calendarData);
    } else {
      this.#initializeBlankCalendar();
    }
  }

  /**
   * Load initial data from an external source (e.g., importer).
   * @param {object} data - Calendar data to load
   * @param {string} [suggestedId] - Suggested ID for the calendar
   * @private
   */
  #loadInitialData(data, suggestedId) {
    this.#calendarData = foundry.utils.mergeObject(CalendarEditor.#createBlankCalendar(), data);
    if (suggestedId) this.#calendarData.metadata.suggestedId = suggestedId;
    if (this.#calendarData.metadata?.pendingNotes?.length > 0) {
      this.#pendingNotes = this.#calendarData.metadata.pendingNotes;
      this.#pendingImporterId = this.#calendarData.metadata.importerId;
      delete this.#calendarData.metadata.pendingNotes;
      delete this.#calendarData.metadata.importerId;
    }

    if (this.#calendarData._pendingCurrentDate) {
      this.#pendingCurrentDate = this.#calendarData._pendingCurrentDate;
      delete this.#calendarData._pendingCurrentDate;
    }

    preLocalizeCalendar(this.#calendarData);
    log(3, `Loaded initial data for calendar: ${this.#calendarData.name}`);
    log(3, `pendingNotes (instance): ${this.#pendingNotes?.length || 0}, importerId: ${this.#pendingImporterId}, pendingCurrentDate: ${this.#pendingCurrentDate ? 'yes' : 'no'}`);
  }

  /** @override */
  get title() {
    const name = this.#calendarData?.name || localize('CALENDARIA.Editor.NewCalendar');
    return format('CALENDARIA.Editor.TitleEdit', { name });
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.calendar = this.#calendarData;
    context.isEditing = this.#isEditing;
    context.calendarId = this.#calendarId;
    context.isCustom = this.#calendarId ? CalendarManager.isCustomCalendar(this.#calendarId) : true;
    context.templates = CalendarManager.getCalendarTemplates();
    context.calculatedDaysPerYear = this.#calculateDaysPerYear();
    context.calculatedLeapDaysPerYear = this.#calculateDaysPerYear(true);
    context.hasLeapDaysDifference = context.calculatedLeapDaysPerYear !== context.calculatedDaysPerYear;
    context.daysMatch = context.calculatedDaysPerYear === this.#calendarData.days.daysPerYear;
    if (context.hasLeapDaysDifference) {
      const leapText = localize('CALENDARIA.Editor.OnLeapYears');
      context.daysPerYearDisplay = `${context.calculatedDaysPerYear} (${context.calculatedLeapDaysPerYear} ${leapText})`;
    } else {
      context.daysPerYearDisplay = String(context.calculatedDaysPerYear);
    }

    context.monthOptions = this.#calendarData.months.values.map((month, idx) => ({ value: idx + 1, label: month.name }));
    const startingWeekdayOptions = this.#calendarData.days.values.map((day, idx) => ({ value: idx, label: day.name }));
    const monthCount = this.#calendarData.months.values.length;
    const monthTypeOptions = [
      { value: '', label: 'CALENDARIA.Editor.MonthType.Standard' },
      { value: 'intercalary', label: 'CALENDARIA.Editor.MonthType.Intercalary' }
    ];
    context.monthsWithNav = this.#calendarData.months.values.map((month, idx) => ({
      ...month,
      index: idx,
      isFirst: idx === 0,
      isLast: idx === monthCount - 1,
      hasStartingWeekday: month.startingWeekday != null,
      hasCustomWeekdays: month.weekdays?.length > 0,
      customWeekdays: month.weekdays ?? [],
      startingWeekdayOptions: startingWeekdayOptions.map((opt) => ({ ...opt, selected: opt.value === month.startingWeekday })),
      typeOptions: monthTypeOptions.map((opt) => ({ ...opt, selected: (opt.value || null) === (month.type || null) }))
    }));
    context.festivalsWithNav = this.#calendarData.festivals.map((festival, idx) => ({
      ...festival,
      index: idx,
      monthOptions: context.monthOptions.map((opt) => ({ ...opt, selected: opt.value === festival.month }))
    }));

    const currentFirstWeekday = this.#calendarData.years.firstWeekday ?? 0;
    context.weekdayOptions = this.#calendarData.days.values.map((day, idx) => ({ value: idx, label: day.name, selected: idx === currentFirstWeekday }));
    const weekdayCount = this.#calendarData.days.values.length;
    context.weekdaysWithNav = this.#calendarData.days.values.map((day, idx) => ({ ...day, index: idx, isFirst: idx === 0, isLast: idx === weekdayCount - 1 }));
    const leapYearConfig = this.#calendarData.leapYearConfig;
    const legacyLeapYear = this.#calendarData.years?.leapYear;
    let currentRule = 'none';
    if (leapYearConfig?.rule && leapYearConfig.rule !== 'none') currentRule = leapYearConfig.rule;
    else if (legacyLeapYear?.leapInterval > 0) currentRule = 'simple';
    context.leapRuleOptions = [
      { value: 'none', label: 'CALENDARIA.Editor.LeapRule.None', selected: currentRule === 'none' },
      { value: 'simple', label: 'CALENDARIA.Editor.LeapRule.Simple', selected: currentRule === 'simple' },
      { value: 'gregorian', label: 'CALENDARIA.Editor.LeapRule.Gregorian', selected: currentRule === 'gregorian' },
      { value: 'custom', label: 'CALENDARIA.Editor.LeapRule.Custom', selected: currentRule === 'custom' }
    ];
    context.showLeapSimple = currentRule === 'simple';
    context.showLeapGregorian = currentRule === 'gregorian';
    context.showLeapCustom = currentRule === 'custom';
    context.leapInterval = leapYearConfig?.interval ?? legacyLeapYear?.leapInterval ?? 4;
    context.leapStart = leapYearConfig?.start ?? legacyLeapYear?.leapStart ?? 0;
    context.leapPattern = leapYearConfig?.pattern ?? '';
    context.monthOptionsZeroIndexed = this.#calendarData.months.values.map((month, idx) => ({ value: idx, label: month.name }));

    context.moonsWithNav = this.#calendarData.moons.map((moon, idx) => ({
      ...moon,
      color: moon.color || '',
      index: idx,
      refMonthOptions: context.monthOptionsZeroIndexed.map((opt) => ({ ...opt, selected: opt.value === moon.referenceDate?.month })),
      phasesWithIndex: moon.phases.map((phase, pIdx) => ({
        ...phase,
        name: localize(phase.name),
        index: pIdx,
        moonIndex: idx,
        isImagePath: phase.icon?.includes('/') ?? false,
        startPercent: Math.round((phase.start ?? pIdx * 0.125) * 1000) / 10,
        endPercent: Math.round((phase.end ?? (pIdx + 1) * 0.125) * 1000) / 10
      }))
    }));

    const seasonTypeOptions = [
      { value: 'dated', label: 'CALENDARIA.Editor.Season.Type.Dated' },
      { value: 'periodic', label: 'CALENDARIA.Editor.Season.Type.Periodic' }
    ];

    context.seasonType = this.#calendarData.seasons.type || 'dated';
    context.seasonOffset = this.#calendarData.seasons.offset ?? 0;
    context.seasonTypeOptions = seasonTypeOptions.map((opt) => ({ ...opt, selected: opt.value === context.seasonType }));
    context.isPeriodic = context.seasonType === 'periodic';
    const seasonalTypeOptions = [
      { value: '', label: 'CALENDARIA.Common.None' },
      { value: 'spring', label: 'CALENDARIA.Season.Spring' },
      { value: 'summer', label: 'CALENDARIA.Season.Summer' },
      { value: 'autumn', label: 'CALENDARIA.Season.Autumn' },
      { value: 'winter', label: 'CALENDARIA.Season.Winter' }
    ];
    context.seasonsWithNav = this.#calendarData.seasons.values.map((season, idx) => {
      let startMonth, startDay, endMonth, endDay;
      if (season.monthStart != null) {
        startMonth = season.monthStart;
        startDay = season.dayStart;
        endMonth = season.monthEnd;
        endDay = season.dayEnd;
      } else if (season.dayStart != null) {
        const startConverted = this.#dayOfYearToMonthDay(season.dayStart);
        const endConverted = this.#dayOfYearToMonthDay(season.dayEnd);
        startMonth = startConverted.month;
        startDay = startConverted.day;
        endMonth = endConverted.month;
        endDay = endConverted.day;
      } else {
        startMonth = 1;
        startDay = null;
        endMonth = 3;
        endDay = null;
      }

      return {
        ...season,
        index: idx,
        duration: season.duration ?? null,
        displayStartMonth: startMonth,
        displayStartDay: startDay,
        displayEndMonth: endMonth,
        displayEndDay: endDay,
        startMonthOptions: context.monthOptions.map((opt) => ({ ...opt, selected: opt.value === startMonth })),
        endMonthOptions: context.monthOptions.map((opt) => ({ ...opt, selected: opt.value === endMonth })),
        seasonalTypeOptions: seasonalTypeOptions.map((opt) => ({ ...opt, selected: opt.value === (season.seasonalType ?? '') }))
      };
    });

    const formatOptions = [
      { value: 'suffix', label: 'CALENDARIA.Editor.Format.Suffix' },
      { value: 'prefix', label: 'CALENDARIA.Editor.Format.Prefix' }
    ];

    context.erasWithNav = this.#calendarData.eras.map((era, idx) => ({
      ...era,
      index: idx,
      formatOptions: formatOptions.map((opt) => ({ ...opt, selected: opt.value === (era.format || 'suffix') })),
      preview: this.#generateEraPreview(era)
    }));
    context.formatOptions = formatOptions;
    const basedOnOptions = [
      { value: 'year', label: 'CALENDARIA.Editor.Cycle.BasedOn.Year' },
      { value: 'eraYear', label: 'CALENDARIA.Editor.Cycle.BasedOn.EraYear' },
      { value: 'month', label: 'CALENDARIA.Common.Month' },
      { value: 'monthDay', label: 'CALENDARIA.Editor.Cycle.BasedOn.MonthDay' },
      { value: 'day', label: 'CALENDARIA.Editor.Cycle.BasedOn.Day' },
      { value: 'yearDay', label: 'CALENDARIA.Editor.Cycle.BasedOn.YearDay' }
    ];

    context.cyclesWithNav = (this.#calendarData.cycles || []).map((cycle, idx) => ({
      ...cycle,
      index: idx,
      basedOnOptions: basedOnOptions.map((opt) => ({ ...opt, selected: opt.value === (cycle.basedOn || 'month') })),
      entriesWithIndex: (cycle.entries || []).map((entry, eIdx) => ({ ...entry, index: eIdx, displayNum: eIdx + 1, cycleIndex: idx }))
    }));
    context.cycleFormat = this.#calendarData.cycleFormat || '';
    context.basedOnOptions = basedOnOptions;
    context.canonicalHoursWithNav = (this.#calendarData.canonicalHours || []).map((ch, idx) => ({ ...ch, index: idx }));
    const currentWeeksType = this.#calendarData.weeks?.type || 'year-based';
    context.weeksTypeOptions = [
      { value: 'year-based', label: 'CALENDARIA.Editor.WeeksType.YearBased', selected: currentWeeksType === 'year-based' },
      { value: 'month-based', label: 'CALENDARIA.Editor.WeeksType.MonthBased', selected: currentWeeksType === 'month-based' }
    ];
    context.namedWeeksWithNav = (this.#calendarData.weeks?.names || []).map((week, idx) => ({ ...week, index: idx }));
    const daylight = this.#calendarData.daylight || {};
    const winterSolstice = this.#dayOfYearToMonthDay(daylight.winterSolstice ?? 0);
    const summerSolstice = this.#dayOfYearToMonthDay(daylight.summerSolstice ?? Math.floor(context.calculatedDaysPerYear / 2));
    context.winterSolsticeMonth = winterSolstice.month;
    context.winterSolsticeDay = winterSolstice.day;
    context.summerSolsticeMonth = summerSolstice.month;
    context.summerSolsticeDay = summerSolstice.day;
    context.winterSolsticeMonthOptions = context.monthOptions.map((opt) => ({ ...opt, selected: opt.value === winterSolstice.month }));
    context.summerSolsticeMonthOptions = context.monthOptions.map((opt) => ({ ...opt, selected: opt.value === summerSolstice.month }));
    this.#prepareWeatherContext(context);
    context.buttons = [
      { type: 'button', action: 'deleteCalendar', icon: 'fas fa-trash', label: 'CALENDARIA.Common.Delete', cssClass: 'delete-button' },
      { type: 'button', action: 'resetCalendar', icon: 'fas fa-undo', label: 'CALENDARIA.Common.Reset' },
      { type: 'button', action: 'exportCalendar', icon: 'fas fa-file-export', label: 'CALENDARIA.Common.Export' },
      { type: 'button', action: 'saveCalendar', icon: 'fas fa-floppy-disk', label: 'SETTINGS.Save', cssClass: 'primary' }
    ];

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
   * @param {object} context - Render context
   * @param {object} options - Render options
   * @protected
   */
  _onRender(context, options) {
    super._onRender?.(context, options);
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
    for (const templateInput of this.element.querySelectorAll('input[name^="eras."][name$=".template"]')) {
      const updatePreview = (input) => {
        const eraItem = input.closest('.era-item');
        if (!eraItem) return;
        const template = input.value.trim();
        const abbr = eraItem.querySelector('input[name$=".abbreviation"]')?.value || '';
        const eraName = eraItem.querySelector('input[name$=".name"]')?.value || '';
        const formatSelect = eraItem.querySelector('select[name$=".format"]');
        const previewEl = eraItem.querySelector('.era-preview');
        if (formatSelect) {
          formatSelect.disabled = !!template;
          formatSelect.dataset.tooltip = template ? localize('CALENDARIA.Editor.Era.FormatDisabled') : '';
        }
        if (!previewEl) return;
        const sampleYear = 1492;
        if (template) previewEl.textContent = formatEraTemplate(template, { year: sampleYear, abbreviation: abbr, era: eraName, yearInEra: 1 });
        else previewEl.textContent = localize('CALENDARIA.Editor.Era.PreviewEmpty');
      };
      updatePreview(templateInput);
      templateInput.addEventListener('input', (event) => updatePreview(event.target));
    }
    // Disable delete button for unsaved calendars
    const deleteBtn = this.element.querySelector('button[data-action="deleteCalendar"]');
    if (deleteBtn && (!this.#calendarId || !this.#isEditing)) {
      deleteBtn.disabled = true;
      deleteBtn.dataset.tooltip = localize('CALENDARIA.Info.SaveBeforeDelete');
    }
    // Calendar dropdown: switch to selected calendar on change
    const calendarSelect = this.element.querySelector('select[name="calendarSelect"]');
    if (calendarSelect) {
      calendarSelect.value = this.#calendarId || '';
      calendarSelect.addEventListener('change', (event) => {
        const id = event.target.value;
        if (id && id !== this.#calendarId) {
          this.#calendarId = id;
          this.#isEditing = true;
          this.#loadExistingCalendar(id);
          this.render();
        }
      });
    }
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

    for (const input of this.element.querySelectorAll('.preset-chance input')) input.addEventListener('input', updateTotal);
    for (const checkbox of this.element.querySelectorAll('.preset-enabled')) checkbox.addEventListener('change', updateTotal);
  }

  /**
   * Calculate total days per year from month definitions.
   * @param {boolean} [leapYear] - Whether to calculate for leap year
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
    let remaining = ((dayOfYear % totalDays) + totalDays) % totalDays;
    for (let i = 0; i < months.length; i++) {
      const monthDays = months[i].days || 0;
      if (remaining < monthDays) return { month: i + 1, day: remaining + 1 };
      remaining -= monthDays;
    }
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
    for (let i = 0; i < month - 1 && i < months.length; i++) dayOfYear += months[i].days || 0;
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
    let activeZoneId = weather.activeZone;
    if (!activeZoneId || !zones.find((z) => z.id === activeZoneId)) {
      activeZoneId = zones[0]?.id || null;
      if (activeZoneId) weather.activeZone = activeZoneId;
    }
    context.zoneOptions = zones.map((z) => ({ value: z.id, label: localize(z.name), selected: z.id === activeZoneId }));
    context.zoneOptions.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    if (context.zoneOptions.length === 0) context.zoneOptions = [{ value: '', label: 'CALENDARIA.Editor.Weather.Zone.NoZones', selected: true }];
    const activeZone = zones.find((z) => z.id === activeZoneId) || null;
    const savedPresets = activeZone?.presets || [];
    const tempUnit = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_UNIT) || 'celsius';
    context.tempUnit = tempUnit === 'fahrenheit' ? 'F' : 'C';
    let presetIndex = 0;
    let totalChance = 0;
    const seasons = this.#calendarData.seasons?.values || [];
    context.seasonClimateList = seasons.map((season, idx) => ({
      index: idx,
      name: season.name,
      icon: season.icon,
      color: season.color,
      hasClimate: !!(season.climate?.temperatures || season.climate?.presets?.length)
    }));

    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const allPresets = getAllPresets(customPresets);
    context.weatherCategories = Object.values(WEATHER_CATEGORIES)
      .map((cat) => {
        const categoryPresets = allPresets.filter((p) => p.category === cat.id);
        let categoryChance = 0;
        let enabledCount = 0;
        const presetsWithData = categoryPresets.map((preset) => {
          const saved = savedPresets.find((s) => s.id === preset.id) || {};
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
            tempMin: saved.tempMin != null ? toDisplayUnit(saved.tempMin) : '',
            tempMax: saved.tempMax != null ? toDisplayUnit(saved.tempMax) : '',
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

  /**
   * Handle form submission.
   * @param {Event} _event - Form submit event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - Processed form data
   */
  static async #onSubmit(_event, _form, formData) {
    const oldSeasonType = this.#calendarData.seasons?.type;
    const oldActiveZone = this.#calendarData.weather?.activeZone;
    this.#updateFromFormData(formData.object);
    const newSeasonType = this.#calendarData.seasons?.type;
    const newActiveZone = this.#calendarData.weather?.activeZone;
    if (oldSeasonType !== newSeasonType) this.render({ parts: ['seasons'] });
    if (oldActiveZone !== newActiveZone) this.render({ parts: ['weather'] });
  }

  /**
   * Update calendar data from form submission.
   * @param {object} data - Form data object
   * @private
   */
  #updateFromFormData(data) {
    log(3, `updateFromFormData - before: pendingNotes=${this.#calendarData.metadata?.pendingNotes?.length || 0}, importerId=${this.#calendarData.metadata?.importerId}`);
    this.#calendarData.name = data.name || '';
    this.#calendarData.metadata.description = data['metadata.description'] || '';
    this.#calendarData.metadata.system = data['metadata.system'] || '';
    log(3, `updateFromFormData - after metadata: pendingNotes=${this.#calendarData.metadata?.pendingNotes?.length || 0}, importerId=${this.#calendarData.metadata?.importerId}`);
    this.#calendarData.years.yearZero = parseInt(data['years.yearZero']) || 0;
    this.#calendarData.years.firstWeekday = parseInt(data['years.firstWeekday']) || 0;
    const leapRule = data['leapYearConfig.rule'] || 'none';
    if (leapRule === 'none') {
      this.#calendarData.leapYearConfig = null;
      this.#calendarData.years.leapYear = null;
    } else {
      const leapConfig = { rule: leapRule, start: parseInt(data['leapYearConfig.start']) || 0 };
      if (leapRule === 'simple') {
        leapConfig.interval = parseInt(data['leapYearConfig.interval']) || 4;
        this.#calendarData.years.leapYear = { leapStart: leapConfig.start, leapInterval: leapConfig.interval };
      } else if (leapRule === 'custom') {
        leapConfig.pattern = data['leapYearConfig.pattern'] || '';
        this.#calendarData.years.leapYear = null;
      } else if (leapRule === 'gregorian') {
        this.#calendarData.years.leapYear = { leapStart: leapConfig.start, leapInterval: 4 };
      }
      this.#calendarData.leapYearConfig = leapConfig;
    }

    this.#calendarData.days.daysPerYear = parseInt(data['days.daysPerYear']) || 365;
    this.#calendarData.days.hoursPerDay = parseInt(data['days.hoursPerDay']) || 24;
    this.#calendarData.days.minutesPerHour = parseInt(data['days.minutesPerHour']) || 60;
    this.#calendarData.days.secondsPerMinute = parseInt(data['days.secondsPerMinute']) || 60;
    this.#calendarData.secondsPerRound = parseInt(data.secondsPerRound) || 6;
    if (!this.#calendarData.daylight) this.#calendarData.daylight = {};
    this.#calendarData.daylight.enabled = data['daylight.enabled'] ?? false;
    this.#calendarData.daylight.shortestDay = parseFloat(data['daylight.shortestDay']) || 8;
    this.#calendarData.daylight.longestDay = parseFloat(data['daylight.longestDay']) || 16;
    const winterMonth = parseInt(data['daylight.winterSolsticeMonth']) || 1;
    const winterDay = parseInt(data['daylight.winterSolsticeDay']) || 1;
    this.#calendarData.daylight.winterSolstice = this.#monthDayToDayOfYear(winterMonth, winterDay);
    const summerMonth = parseInt(data['daylight.summerSolsticeMonth']) || 1;
    const summerDay = parseInt(data['daylight.summerSolsticeDay']) || 1;
    this.#calendarData.daylight.summerSolstice = this.#monthDayToDayOfYear(summerMonth, summerDay);
    this.#updateMonthsFromFormData(data);
    this.#updateArrayFromFormData(data, 'weekdays', this.#calendarData.days.values, ['name', 'abbreviation', 'isRestDay']);
    this.#updateSeasonsFromFormData(data);
    this.#updateErasFromFormData(data);
    this.#updateArrayFromFormData(data, 'festivals', this.#calendarData.festivals, ['name', 'month', 'day', 'leapYearOnly', 'countsForWeekday']);
    this.#updateMoonsFromFormData(data);
    this.#updateCyclesFromFormData(data);
    if (!this.#calendarData.amPmNotation) this.#calendarData.amPmNotation = {};
    this.#calendarData.amPmNotation.am = data['amPmNotation.am'] || 'AM';
    this.#calendarData.amPmNotation.pm = data['amPmNotation.pm'] || 'PM';
    if (!this.#calendarData.dateFormats) this.#calendarData.dateFormats = {};
    this.#calendarData.dateFormats.short = data['dateFormats.short'] || '{{d}} {{b}}';
    this.#calendarData.dateFormats.long = data['dateFormats.long'] || '{{d}} {{B}}, {{y}}';
    this.#calendarData.dateFormats.full = data['dateFormats.full'] || '{{B}} {{d}}, {{y}}';
    this.#calendarData.dateFormats.time = data['dateFormats.time'] || '{{H}}:{{M}}';
    this.#calendarData.dateFormats.time12 = data['dateFormats.time12'] || '{{h}}:{{M}} {{p}}';
    this.#updateCanonicalHoursFromFormData(data);
    this.#updateNamedWeeksFromFormData(data);
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
    const indices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(new RegExp(`^${prefix}\\.(\\d+)\\.`));
      if (match) indices.add(parseInt(match[1]));
    }

    const sortedIndices = [...indices].sort((a, b) => a - b);
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
   * Update months array from form data, including custom weekdays.
   * @param {object} data - Form data
   * @private
   */
  #updateMonthsFromFormData(data) {
    const indices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^months\.(\d+)\./);
      if (match) indices.add(parseInt(match[1]));
    }
    const sortedIndices = [...indices].sort((a, b) => a - b);
    this.#calendarData.months.values.length = 0;
    for (const idx of sortedIndices) {
      const month = {
        name: data[`months.${idx}.name`] || '',
        abbreviation: data[`months.${idx}.abbreviation`] || '',
        days: this.#parseOptionalInt(data[`months.${idx}.days`]) ?? 30,
        leapDays: this.#parseOptionalInt(data[`months.${idx}.leapDays`]),
        startingWeekday: this.#parseOptionalInt(data[`months.${idx}.startingWeekday`]),
        ordinal: this.#calendarData.months.values.length + 1
      };
      const monthType = data[`months.${idx}.type`];
      if (monthType) month.type = monthType;
      const hasCustom = data[`months.${idx}.hasCustomWeekdays`] === 'true' || data[`months.${idx}.hasCustomWeekdays`] === true;
      if (hasCustom) {
        const weekdayIndices = new Set();
        for (const key of Object.keys(data)) {
          const wdMatch = key.match(new RegExp(`^months\\.${idx}\\.weekdays\\.(\\d+)\\.`));
          if (wdMatch) weekdayIndices.add(parseInt(wdMatch[1]));
        }

        if (weekdayIndices.size > 0) {
          month.weekdays = [...weekdayIndices]
            .sort((a, b) => a - b)
            .map((wdIdx) => ({
              name: data[`months.${idx}.weekdays.${wdIdx}.name`] || '',
              abbreviation: data[`months.${idx}.weekdays.${wdIdx}.abbreviation`] || '',
              isRestDay: !!data[`months.${idx}.weekdays.${wdIdx}.isRestDay`]
            }));
        } else {
          month.weekdays = (this.#calendarData.days?.values ?? []).map((wd) => ({ name: wd.name || '', abbreviation: wd.abbreviation || '', isRestDay: !!wd.isRestDay }));
        }
      }

      this.#calendarData.months.values.push(month);
    }
  }

  /**
   * Update seasons array from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateSeasonsFromFormData(data) {
    this.#calendarData.seasons.type = data['seasons.type'] || 'dated';
    this.#calendarData.seasons.offset = parseInt(data['seasons.offset']) || 0;
    const indices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^seasons\.(\d+)\./);
      if (match) indices.add(parseInt(match[1]));
    }
    const sortedIndices = [...indices].sort((a, b) => a - b);
    const isPeriodic = this.#calendarData.seasons.type === 'periodic';
    const existingClimates = this.#calendarData.seasons.values.map((s) => s.climate);
    this.#calendarData.seasons.values.length = 0;
    for (const idx of sortedIndices) {
      const seasonalType = data[`seasons.${idx}.seasonalType`];
      const season = {
        name: data[`seasons.${idx}.name`] || '',
        abbreviation: data[`seasons.${idx}.abbreviation`] || '',
        icon: data[`seasons.${idx}.icon`] || '',
        color: data[`seasons.${idx}.color`] || '',
        seasonalType: seasonalType || null,
        ordinal: this.#calendarData.seasons.values.length + 1,
        climate: existingClimates[idx] ?? null
      };
      if (isPeriodic) {
        season.duration = this.#parseOptionalInt(data[`seasons.${idx}.duration`]) ?? 91;
      } else {
        season.monthStart = parseInt(data[`seasons.${idx}.monthStart`]) || 1;
        season.monthEnd = parseInt(data[`seasons.${idx}.monthEnd`]) || 1;
        season.dayStart = this.#parseOptionalInt(data[`seasons.${idx}.dayStart`]);
        season.dayEnd = this.#parseOptionalInt(data[`seasons.${idx}.dayEnd`]);
      }
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
   * @returns {number|null} Parsed integer or null if empty/invalid
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
      const existingMoon = this.#calendarData.moons[moonIdx];
      const existingPhases = existingMoon?.phases || DEFAULT_MOON_PHASES;
      const phaseIndices = new Set();
      const phasePattern = new RegExp(`^moons\\.${moonIdx}\\.phases\\.(\\d+)\\.`);
      for (const key of Object.keys(data)) {
        const match = key.match(phasePattern);
        if (match) phaseIndices.add(parseInt(match[1]));
      }
      const sortedPhaseIndices = [...phaseIndices].sort((a, b) => a - b);
      const phases = [];
      for (const pIdx of sortedPhaseIndices) {
        const phaseName = data[`moons.${moonIdx}.phases.${pIdx}.name`];
        const phaseRisingName = data[`moons.${moonIdx}.phases.${pIdx}.rising`];
        const phaseFadingName = data[`moons.${moonIdx}.phases.${pIdx}.fading`];
        const phaseIcon = data[`moons.${moonIdx}.phases.${pIdx}.icon`];
        const phaseStartPercent = data[`moons.${moonIdx}.phases.${pIdx}.startPercent`];
        const phaseEndPercent = data[`moons.${moonIdx}.phases.${pIdx}.endPercent`];
        phases.push({
          name: phaseName ?? existingPhases[pIdx]?.name ?? '',
          rising: phaseRisingName ?? existingPhases[pIdx]?.rising ?? '',
          fading: phaseFadingName ?? existingPhases[pIdx]?.fading ?? '',
          icon: phaseIcon ?? existingPhases[pIdx]?.icon ?? '',
          start: phaseStartPercent != null ? parseFloat(phaseStartPercent) / 100 : (existingPhases[pIdx]?.start ?? pIdx * 0.125),
          end: phaseEndPercent != null ? parseFloat(phaseEndPercent) / 100 : (existingPhases[pIdx]?.end ?? (pIdx + 1) * 0.125)
        });
      }
      const rawColor = data[`moons.${moonIdx}.color`] || '';
      const moonColor = rawColor.toLowerCase() === '#b8b8b8' ? '' : rawColor;
      const moon = {
        name: data[`moons.${moonIdx}.name`] || '',
        cycleLength: parseFloat(data[`moons.${moonIdx}.cycleLength`]) || 28,
        cycleDayAdjust: this.#parseOptionalInt(data[`moons.${moonIdx}.cycleDayAdjust`]) ?? existingMoon?.cycleDayAdjust ?? 0,
        color: moonColor,
        hidden: data[`moons.${moonIdx}.hidden`] === 'true' || data[`moons.${moonIdx}.hidden`] === true || existingMoon?.hidden || false,
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
    this.#calendarData.cycleFormat = data.cycleFormat || '';
    const cycleIndices = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^cycles\.(\d+)\./);
      if (match) cycleIndices.add(parseInt(match[1]));
    }
    const sortedCycleIndices = [...cycleIndices].sort((a, b) => a - b);
    const newCycles = [];
    for (const cycleIdx of sortedCycleIndices) {
      const entryIndices = new Set();
      const entryPattern = new RegExp(`^cycles\\.${cycleIdx}\\.entries\\.(\\d+)\\.`);
      for (const key of Object.keys(data)) {
        const match = key.match(entryPattern);
        if (match) entryIndices.add(parseInt(match[1]));
      }
      const sortedEntryIndices = [...entryIndices].sort((a, b) => a - b);
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
    const oldZoneId = this.#calendarData.weather.activeZone;
    const selectedZone = data['weather.activeZone'];
    const zoneChanged = selectedZone && selectedZone !== oldZoneId;
    if (selectedZone) this.#calendarData.weather.activeZone = selectedZone;
    this.#calendarData.weather.autoGenerate = !!data['weather.autoGenerate'];
    if (zoneChanged) return;
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
      const tempMin = data[`weather.presets.${idx}.tempMin`];
      const tempMax = data[`weather.presets.${idx}.tempMax`];
      if (tempMin !== '' && tempMin != null) preset.tempMin = fromDisplayUnit(parseInt(tempMin));
      if (tempMax !== '' && tempMax != null) preset.tempMax = fromDisplayUnit(parseInt(tempMax));
      const desc = data[`weather.presets.${idx}.description`]?.trim();
      if (desc) preset.description = desc;
      newPresets.push(preset);
    }

    const activeZoneId = this.#calendarData.weather.activeZone;
    const zones = this.#calendarData.weather.zones || [];
    const activeZone = zones.find((z) => z.id === activeZoneId);
    if (activeZone) activeZone.presets = newPresets;
  }

  /**
   * Add a new month after the target index.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddMonth(_event, target) {
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.months.values.length - 1;
    const insertIdx = afterIdx + 1;
    const totalMonths = this.#calendarData.months.values.length + 1;
    this.#calendarData.months.values.splice(insertIdx, 0, {
      name: format('CALENDARIA.Editor.Default.MonthName', { num: totalMonths }),
      abbreviation: format('CALENDARIA.Editor.Default.MonthAbbr', { num: totalMonths }),
      ordinal: insertIdx + 1,
      days: 30
    });
    this.render();
  }

  /**
   * Remove a month.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveMonth(_event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.months.values.splice(idx, 1);
    this.#reindexArray(this.#calendarData.months.values);
    this.render();
  }

  /**
   * Move month up in order.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveMonthUp(_event, target) {
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
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveMonthDown(_event, target) {
    const idx = parseInt(target.dataset.index);
    const months = this.#calendarData.months.values;
    if (idx < months.length - 1) {
      [months[idx], months[idx + 1]] = [months[idx + 1], months[idx]];
      this.#reindexArray(months);
      this.render();
    }
  }

  /**
   * Open custom weekdays dialog for a month.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onToggleCustomWeekdays(_event, target) {
    const idx = parseInt(target.dataset.index);
    const month = this.#calendarData.months.values[idx];
    if (!month) return;
    if (!month.weekdays?.length) {
      month.weekdays = (this.#calendarData.days?.values ?? []).map((wd) => ({
        name: wd.name || '',
        abbreviation: wd.abbreviation || '',
        isRestDay: !!wd.isRestDay
      }));
    }

    const rows = month.weekdays
      .map(
        (wd, i) => `
      <div class="custom-weekday-row">
        <input type="text" name="weekday-${i}-name" value="${wd.name}" placeholder="${localize('CALENDARIA.Common.Name')}">
        <input type="text" name="weekday-${i}-abbr" value="${wd.abbreviation}" placeholder="${localize('CALENDARIA.Common.Abbreviation')}">
        <input type="checkbox" name="weekday-${i}-rest" ${wd.isRestDay ? 'checked' : ''}>
      </div>
    `
      )
      .join('');

    const content = `
      <p class="hint">${localize('CALENDARIA.Editor.Month.CustomWeekdaysHint')}</p>
      <div class="custom-weekdays-list">
        <div class="custom-weekday-header">
          <span>${localize('CALENDARIA.Common.Weekday')}</span>
          <span>${localize('CALENDARIA.Common.Abbreviation')}</span>
          <span>${localize('CALENDARIA.Common.RestDay')}</span>
        </div>
        ${rows}
      </div>
    `;

    const editor = this;
    new foundry.applications.api.DialogV2({
      window: { title: format('CALENDARIA.Editor.Month.CustomWeekdaysFor', { month: month.name }) },
      content,
      buttons: [
        {
          action: 'disable',
          label: localize('CALENDARIA.Editor.Month.DisableCustomWeekdays'),
          icon: 'fas fa-times',
          callback: () => {
            delete month.weekdays;
            editor.render();
          }
        },
        {
          action: 'save',
          label: localize('CALENDARIA.Common.Save'),
          icon: 'fas fa-save',
          default: true,
          callback: (_event, _button, dialog) => {
            const form = dialog.element.querySelector('form');
            month.weekdays.forEach((wd, i) => {
              wd.name = form.querySelector(`[name="weekday-${i}-name"]`)?.value || '';
              wd.abbreviation = form.querySelector(`[name="weekday-${i}-abbr"]`)?.value || '';
              wd.isRestDay = form.querySelector(`[name="weekday-${i}-rest"]`)?.checked || false;
            });
            editor.render();
          }
        }
      ],
      position: { width: 400 }
    }).render(true);
  }

  /**
   * Add a new weekday after the target index.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddWeekday(_event, target) {
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.days.values.length - 1;
    const insertIdx = afterIdx + 1;
    const totalDays = this.#calendarData.days.values.length + 1;
    this.#calendarData.days.values.splice(insertIdx, 0, {
      name: format('CALENDARIA.Editor.Default.DayName', { num: totalDays }),
      abbreviation: format('CALENDARIA.Editor.Default.DayAbbr', { num: totalDays }),
      ordinal: insertIdx + 1,
      isRestDay: false
    });
    this.render();
  }

  /**
   * Remove a weekday.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveWeekday(_event, target) {
    const idx = parseInt(target.dataset.index);
    if (this.#calendarData.days.values.length > 1) {
      this.#calendarData.days.values.splice(idx, 1);
      this.#reindexArray(this.#calendarData.days.values);
      this.render();
    } else {
      ui.notifications.warn('CALENDARIA.Editor.Error.MinOneWeekday', { localize: true });
    }
  }

  /**
   * Move a weekday up in the list.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveWeekdayUp(_event, target) {
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
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveWeekdayDown(_event, target) {
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
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddSeason(_event, target) {
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.seasons.values.length - 1;
    const insertIdx = afterIdx + 1;
    const totalSeasons = this.#calendarData.seasons.values.length + 1;
    const isPeriodic = this.#calendarData.seasons.type === 'periodic';
    const newSeason = {
      name: format('CALENDARIA.Editor.Default.SeasonName', { num: totalSeasons }),
      abbreviation: format('CALENDARIA.Editor.Default.SeasonAbbr', { num: totalSeasons }),
      ordinal: insertIdx + 1
    };

    if (isPeriodic) {
      newSeason.duration = 91;
    } else {
      newSeason.monthStart = 1;
      newSeason.monthEnd = 3;
      newSeason.dayStart = null;
      newSeason.dayEnd = null;
    }

    this.#calendarData.seasons.values.splice(insertIdx, 0, newSeason);
    this.#reindexArray(this.#calendarData.seasons.values);
    this.render();
  }

  /**
   * Remove a season.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveSeason(_event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.seasons.values.splice(idx, 1);
    this.#reindexArray(this.#calendarData.seasons.values);
    this.render();
  }

  /**
   * Edit a season's climate settings.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onEditSeasonClimate(_event, target) {
    const idx = parseInt(target.dataset.index);
    const season = this.#calendarData.seasons.values[idx];
    if (!season) return;
    const climate = season.climate ?? { temperatures: null, presets: [] };
    const displayMin = climate.temperatures?.min != null ? toDisplayUnit(climate.temperatures.min) : '';
    const displayMax = climate.temperatures?.max != null ? toDisplayUnit(climate.temperatures.max) : '';
    const tempUnit = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_UNIT) === 'fahrenheit' ? '°F' : '°C';
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const allPresets = getAllPresets(customPresets);
    const presetRows = Object.values(WEATHER_CATEGORIES)
      .map((cat) => {
        const categoryPresets = allPresets.filter((p) => p.category === cat.id);
        const rows = categoryPresets
          .map((preset) => {
            const existing = climate.presets?.find((p) => p.id === preset.id);
            return `
          <div class="preset-row" data-preset-id="${preset.id}">
            <span class="preset-icon" style="color: ${preset.color}"><i class="fas ${preset.icon}"></i></span>
            <label>${localize(preset.label)}</label>
            <input type="number" name="preset_${preset.id}" value="${existing?.chance ?? ''}" min="0" max="100" step="0.1" placeholder="—">
            <span class="units">%</span>
          </div>`;
          })
          .join('');
        return `<div class="preset-category"><h4>${localize(cat.label)}</h4>${rows}</div>`;
      })
      .join('');

    const content = `
      <div class="form-group">
        <label>${localize('CALENDARIA.Editor.Season.Climate.Temperatures')}</label>
        <div class="temp-fields">
          <input type="number" name="tempMin" value="${displayMin}" placeholder="${localize('CALENDARIA.Common.Min')}">
          <span>–</span>
          <input type="number" name="tempMax" value="${displayMax}" placeholder="${localize('CALENDARIA.Common.Max')}">
          <span class="units">${tempUnit}</span>
        </div>
        <p class="hint">${localize('CALENDARIA.Editor.Season.Climate.TemperaturesHint')}</p>
      </div>
      <div class="form-group">
        <label>${localize('CALENDARIA.Editor.Season.Climate.WeatherChances')}</label>
        <p class="hint">${localize('CALENDARIA.Editor.Season.Climate.WeatherChancesHint')}</p>
        <div class="preset-list">${presetRows}</div>
      </div>`;

    const result = await foundry.applications.api.DialogV2.prompt({
      classes: ['calendaria', 'climate-settings-dialog'],
      window: { title: format('CALENDARIA.Editor.Season.Climate.Title', { name: localize(season.name) }) },
      content,
      ok: {
        label: localize('CALENDARIA.Common.Save'),
        callback: (_event, button) => {
          const form = button.form;
          const tempMin = form.elements.tempMin?.value;
          const tempMax = form.elements.tempMax?.value;
          const presets = [];
          for (const preset of ALL_PRESETS) {
            const chance = parseFloat(form.elements[`preset_${preset.id}`]?.value);
            if (chance > 0) presets.push({ id: preset.id, chance });
          }
          return { temperatures: tempMin !== '' || tempMax !== '' ? { min: fromDisplayUnit(parseFloat(tempMin) || 0), max: fromDisplayUnit(parseFloat(tempMax) || 20) } : null, presets };
        }
      }
    });
    if (!result) return;
    season.climate = result.presets.length > 0 || result.temperatures ? result : null;
    this.render({ parts: ['weather'] });
  }

  /**
   * Add a new era after the target index.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddEra(_event, target) {
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.eras.length - 1;
    const insertIdx = afterIdx + 1;
    const totalEras = this.#calendarData.eras.length + 1;
    this.#calendarData.eras.splice(insertIdx, 0, {
      name: format('CALENDARIA.Editor.Default.EraName', { num: totalEras }),
      abbreviation: format('CALENDARIA.Editor.Default.EraAbbr', { num: totalEras }),
      startYear: 1,
      endYear: null,
      format: 'suffix',
      template: null
    });
    this.render();
  }

  /**
   * Remove an era.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveEra(_event, target) {
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
    if (!era.template) return localize('CALENDARIA.Editor.Era.PreviewEmpty');
    const sampleYear = 1492;
    const abbr = era.abbreviation ? localize(era.abbreviation) : '';
    const eraName = era.name ? localize(era.name) : '';
    return formatEraTemplate(era.template, { year: sampleYear, abbreviation: abbr, era: eraName, yearInEra: 1 });
  }

  /**
   * Add a new festival after the target index.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddFestival(_event, target) {
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.festivals.length - 1;
    const insertIdx = afterIdx + 1;
    const totalFestivals = this.#calendarData.festivals.length + 1;
    this.#calendarData.festivals.splice(insertIdx, 0, { name: format('CALENDARIA.Editor.Default.FestivalName', { num: totalFestivals }), month: 1, day: 1 });
    this.render();
  }

  /**
   * Remove a festival.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveFestival(_event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.festivals.splice(idx, 1);
    this.render();
  }

  /**
   * Add a new moon.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onAddMoon(_event, _target) {
    this.#calendarData.moons.push({
      name: localize('CALENDARIA.Common.Moon'),
      cycleLength: 28,
      cycleDayAdjust: 0,
      hidden: false,
      phases: DEFAULT_MOON_PHASES,
      referenceDate: { year: 0, month: 0, day: 1 }
    });
    this.render();
  }

  /**
   * Remove a moon.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveMoon(_event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.moons.splice(idx, 1);
    this.render();
  }

  /**
   * Add a new phase to a moon.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddMoonPhase(_event, target) {
    const moonIdx = parseInt(target.dataset.moonIndex);
    const moon = this.#calendarData.moons[moonIdx];
    if (!moon) return;
    if (!moon.phases) moon.phases = DEFAULT_MOON_PHASES;
    const phaseCount = moon.phases.length;
    const interval = 1 / (phaseCount + 1);
    moon.phases.push({
      name: format('CALENDARIA.Editor.Default.PhaseName', { num: phaseCount + 1 }),
      rising: '',
      fading: '',
      icon: `${ASSETS.MOON_ICONS}/05_fullmoon.svg`,
      start: phaseCount * interval,
      end: 1
    });

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
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveMoonPhase(_event, target) {
    const moonIdx = parseInt(target.dataset.moonIndex);
    const phaseIdx = parseInt(target.dataset.phaseIndex);
    const moon = this.#calendarData.moons[moonIdx];
    if (!moon?.phases || moon.phases.length <= 1) return;
    moon.phases.splice(phaseIdx, 1);
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
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onPickMoonPhaseIcon(_event, target) {
    const moonIdx = parseInt(target.dataset.moonIndex);
    const phaseIdx = parseInt(target.dataset.phaseIndex);
    const moon = this.#calendarData.moons[moonIdx];
    if (!moon) return;
    const currentIcon = moon.phases?.[phaseIdx]?.icon || '';
    const picker = new foundry.applications.apps.FilePicker({
      type: 'image',
      current: currentIcon.startsWith('icons/') ? currentIcon : '',
      callback: (path) => {
        if (!moon.phases) moon.phases = DEFAULT_MOON_PHASES;
        moon.phases[phaseIdx].icon = path;
        this.render();
      }
    });
    picker.render(true);
  }

  /**
   * Add a new cycle.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onAddCycle(_event, _target) {
    if (!this.#calendarData.cycles) this.#calendarData.cycles = [];
    const totalCycles = this.#calendarData.cycles.length + 1;
    this.#calendarData.cycles.push({
      name: format('CALENDARIA.Editor.Default.CycleName', { num: totalCycles }),
      length: 12,
      offset: 0,
      basedOn: 'month',
      entries: [{ name: format('CALENDARIA.Editor.Default.CycleEntry', { num: 1 }) }]
    });
    this.render();
  }

  /**
   * Remove a cycle.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveCycle(_event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.cycles.splice(idx, 1);
    this.render();
  }

  /**
   * Add a new entry to a cycle.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddCycleEntry(_event, target) {
    const cycleIdx = parseInt(target.dataset.cycleIndex);
    const cycle = this.#calendarData.cycles[cycleIdx];
    if (!cycle) return;
    if (!cycle.entries) cycle.entries = [];
    const entryCount = cycle.entries.length + 1;
    cycle.entries.push({ name: format('CALENDARIA.Editor.Default.CycleEntry', { num: entryCount }) });
    this.render();
  }

  /**
   * Remove an entry from a cycle.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveCycleEntry(_event, target) {
    const cycleIdx = parseInt(target.dataset.cycleIndex);
    const entryIdx = parseInt(target.dataset.entryIndex);
    const cycle = this.#calendarData.cycles[cycleIdx];
    if (!cycle?.entries || cycle.entries.length <= 1) return;
    cycle.entries.splice(entryIdx, 1);
    this.render();
  }

  /**
   * Add a new canonical hour.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddCanonicalHour(_event, target) {
    if (!this.#calendarData.canonicalHours) this.#calendarData.canonicalHours = [];
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.canonicalHours.length - 1;
    const insertIdx = afterIdx + 1;
    const totalHours = this.#calendarData.canonicalHours.length;
    this.#calendarData.canonicalHours.splice(insertIdx, 0, {
      name: format('CALENDARIA.Editor.Default.CanonicalHourName', { num: totalHours + 1 }),
      abbreviation: '',
      startHour: totalHours * 3,
      endHour: (totalHours + 1) * 3
    });
    this.render();
  }

  /**
   * Remove a canonical hour.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveCanonicalHour(_event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.canonicalHours.splice(idx, 1);
    this.render();
  }

  /**
   * Add a new named week.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddNamedWeek(_event, target) {
    if (!this.#calendarData.weeks) this.#calendarData.weeks = { enabled: false, type: 'year-based', names: [] };
    if (!this.#calendarData.weeks.names) this.#calendarData.weeks.names = [];
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.weeks.names.length - 1;
    const insertIdx = afterIdx + 1;
    const totalWeeks = this.#calendarData.weeks.names.length;
    this.#calendarData.weeks.names.splice(insertIdx, 0, {
      name: format('CALENDARIA.Editor.Default.WeekName', { num: totalWeeks + 1 }),
      abbreviation: ''
    });
    this.render();
  }

  /**
   * Remove a named week.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveNamedWeek(_event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.weeks.names.splice(idx, 1);
    this.render();
  }

  /**
   * Toggle a weather category's collapsed state.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onToggleCategory(_event, target) {
    const category = target.closest('.weather-category');
    if (category) category.classList.toggle('collapsed');
  }

  /**
   * Reset a weather preset to its default values.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onResetWeatherPreset(_event, target) {
    const presetId = target.dataset.presetId;
    if (!presetId) return;

    // Find and reset this preset in the active zone
    const activeZoneId = this.#calendarData.weather?.activeZone;
    const zones = this.#calendarData.weather?.zones || [];
    const activeZone = zones.find((z) => z.id === activeZoneId);
    if (!activeZone?.presets) return;

    const idx = activeZone.presets.findIndex((p) => p.id === presetId);
    if (idx >= 0) {
      activeZone.presets.splice(idx, 1);
      this.render();
    }
  }

  /**
   * Toggle description popover visibility.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static #onToggleDescription(_event, target) {
    const presetItem = target.closest('.weather-preset-item');
    if (!presetItem) return;
    const popover = presetItem.querySelector('.description-popover');
    if (!popover) return;
    this.element.querySelectorAll('.description-popover.show').forEach((p) => {
      if (p !== popover) p.classList.remove('show');
    });

    popover.classList.toggle('show');
  }

  /**
   * Add a new climate zone from a template.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onAddZone(_event, _target) {
    const templateOptions = getClimateTemplateOptions();
    const selectHtml = templateOptions.map((opt) => `<option value="${opt.value}">${localize(opt.label)}</option>`).join('');

    const content = `
      <form>
        <div class="form-group">
          <label>${localize('CALENDARIA.Editor.Weather.Zone.CopyFrom')}</label>
          <select name="template">${selectHtml}</select>
        </div>
        <div class="form-group">
          <label>${localize('CALENDARIA.Editor.Weather.Zone.Name')}</label>
          <input type="text" name="name" placeholder="${localize('CALENDARIA.Editor.Weather.Zone.Name')}">
        </div>
      </form>
    `;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: localize('CALENDARIA.Editor.Weather.Zone.Add') },
      content,
      ok: {
        callback: (_event, button, _dialog) => {
          const form = button.form;
          return { template: form.elements.template.value, name: form.elements.name.value };
        }
      }
    });

    if (!result) return;
    const seasonNames = this.#calendarData.seasons?.values?.map((s) => s.name) || ['CALENDARIA.Season.Spring', 'CALENDARIA.Season.Summer', 'CALENDARIA.Season.Autumn', 'CALENDARIA.Season.Winter'];
    const zoneConfig = getDefaultZoneConfig(result.template, seasonNames);
    if (!zoneConfig) return;
    const baseId = result.name?.toLowerCase().replace(/\s+/g, '-') || result.template;
    let zoneId = baseId;
    let counter = 1;
    const existingIds = (this.#calendarData.weather?.zones || []).map((z) => z.id);
    while (existingIds.includes(zoneId)) zoneId = `${baseId}-${counter++}`;
    zoneConfig.id = zoneId;
    zoneConfig.name = result.name || localize(CLIMATE_ZONE_TEMPLATES[result.template]?.name || result.template);
    if (!this.#calendarData.weather) this.#calendarData.weather = { zones: [], activeZone: null, autoGenerate: false };
    if (!this.#calendarData.weather.zones) this.#calendarData.weather.zones = [];
    this.#calendarData.weather.zones.push(zoneConfig);
    this.#calendarData.weather.activeZone = zoneConfig.id;
    this.render();
  }

  /**
   * Edit the active climate zone.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onEditZone(_event, _target) {
    const zones = this.#calendarData.weather?.zones || [];
    const activeZoneId = this.#calendarData.weather?.activeZone;
    const zone = zones.find((z) => z.id === activeZoneId);
    if (!zone) {
      ui.notifications.warn('CALENDARIA.Editor.Weather.Zone.NoZones', { localize: true });
      return;
    }

    const seasonNames = this.#calendarData.seasons?.values?.map((s) => s.name) || ['CALENDARIA.Season.Spring', 'CALENDARIA.Season.Summer', 'CALENDARIA.Season.Autumn', 'CALENDARIA.Season.Winter'];
    const tempRows = seasonNames
      .map((season) => {
        const temp = zone.temperatures?.[season] || zone.temperatures?._default || { min: 10, max: 22 };
        const displayMin = toDisplayUnit(temp.min);
        const displayMax = toDisplayUnit(temp.max);
        return `
        <div class="form-group temperature-row">
          <label>${localize(season)}</label>
          <input type="number" name="temp_${season}_min" value="${displayMin}" placeholder="${localize('CALENDARIA.Common.Min')}">
          <span>–</span>
          <input type="number" name="temp_${season}_max" value="${displayMax}" placeholder="${localize('CALENDARIA.Common.Max')}">
        </div>
      `;
      })
      .join('');

    const brightnessMultiplier = zone.brightnessMultiplier ?? 1.0;
    const envBase = zone.environmentBase ?? {};
    const envDark = zone.environmentDark ?? {};
    const content = `
      <form>
        <div class="form-group">
          <label>${localize('CALENDARIA.Editor.Weather.Zone.Name')}</label>
          <input type="text" name="name" value="${zone.name}">
        </div>
        <div class="form-group">
          <label>${localize('CALENDARIA.Common.Description')}</label>
          <textarea name="description">${zone.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label>${localize('CALENDARIA.Editor.Weather.Zone.BrightnessMultiplier')}</label>
          <div class="form-fields">
            <input type="range" name="brightnessMultiplier" min="0.5" max="1.5" step="0.1" value="${brightnessMultiplier}" oninput="this.nextElementSibling.textContent = this.value + 'x'">
            <span>${brightnessMultiplier}x</span>
          </div>
          <p class="hint">${localize('CALENDARIA.Editor.Weather.Zone.BrightnessMultiplierHint')}</p>
        </div>
        <fieldset>
          <legend>${localize('CALENDARIA.Editor.Weather.Zone.EnvironmentLighting')}</legend>
          <p class="hint">${localize('CALENDARIA.Editor.Weather.Zone.EnvironmentLightingHint')}</p>
          <div class="form-group">
            <label>${localize('CALENDARIA.Editor.Weather.Zone.BaseHue')}</label>
            <div class="form-fields">
              <input type="number" name="baseHue" min="0" max="360" step="1" value="${envBase.hue ?? ''}" placeholder="${localize('CALENDARIA.Common.Default')}">
              <span>°</span>
            </div>
          </div>
          <div class="form-group">
            <label>${localize('CALENDARIA.Editor.Weather.Zone.BaseSaturation')}</label>
            <div class="form-fields">
              <input type="number" name="baseSaturation" min="0" max="1" step="0.1" value="${envBase.saturation ?? ''}" placeholder="${localize('CALENDARIA.Common.Default')}">
            </div>
          </div>
          <div class="form-group">
            <label>${localize('CALENDARIA.Editor.Weather.Zone.DarkHue')}</label>
            <div class="form-fields">
              <input type="number" name="darkHue" min="0" max="360" step="1" value="${envDark.hue ?? ''}" placeholder="${localize('CALENDARIA.Common.Default')}">
              <span>°</span>
            </div>
          </div>
          <div class="form-group">
            <label>${localize('CALENDARIA.Editor.Weather.Zone.DarkSaturation')}</label>
            <div class="form-fields">
              <input type="number" name="darkSaturation" min="0" max="1" step="0.1" value="${envDark.saturation ?? ''}" placeholder="${localize('CALENDARIA.Common.Default')}">
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>${localize('CALENDARIA.Editor.Weather.Zone.Temperatures')}</legend>
          ${tempRows}
        </fieldset>
      </form>
    `;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: localize('CALENDARIA.Editor.Weather.Zone.Edit') },
      position: { width: 'auto', height: 'auto' },
      content,
      ok: {
        callback: (_event, button, _dialog) => {
          const form = button.form;
          const baseHue = form.elements.baseHue.value ? parseFloat(form.elements.baseHue.value) : null;
          const baseSat = form.elements.baseSaturation.value ? parseFloat(form.elements.baseSaturation.value) : null;
          const darkHue = form.elements.darkHue.value ? parseFloat(form.elements.darkHue.value) : null;
          const darkSat = form.elements.darkSaturation.value ? parseFloat(form.elements.darkSaturation.value) : null;
          const data = {
            name: form.elements.name.value,
            description: form.elements.description.value,
            brightnessMultiplier: parseFloat(form.elements.brightnessMultiplier.value) || 1.0,
            environmentBase: baseHue !== null || baseSat !== null ? { hue: baseHue, saturation: baseSat } : null,
            environmentDark: darkHue !== null || darkSat !== null ? { hue: darkHue, saturation: darkSat } : null,
            temperatures: {}
          };
          for (const season of seasonNames) {
            const minVal = parseInt(form.elements[`temp_${season}_min`].value) || 0;
            const maxVal = parseInt(form.elements[`temp_${season}_max`].value) || 20;
            data.temperatures[season] = { min: fromDisplayUnit(minVal), max: fromDisplayUnit(maxVal) };
          }

          return data;
        }
      }
    });

    if (!result) return;
    zone.name = result.name;
    zone.description = result.description;
    zone.brightnessMultiplier = result.brightnessMultiplier;
    zone.environmentBase = result.environmentBase;
    zone.environmentDark = result.environmentDark;
    zone.temperatures = result.temperatures;
    this.render();
  }

  /**
   * Delete the active climate zone.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onDeleteZone(_event, _target) {
    const zones = this.#calendarData.weather?.zones || [];
    const activeZoneId = this.#calendarData.weather?.activeZone;
    const zoneIdx = zones.findIndex((z) => z.id === activeZoneId);
    if (zoneIdx < 0) {
      ui.notifications.warn('CALENDARIA.Editor.Weather.Zone.NoZones', { localize: true });
      return;
    }

    const zone = zones[zoneIdx];
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Editor.Weather.Zone.Delete') },
      content: `<p>${format('CALENDARIA.Editor.Weather.Zone.DeleteConfirm', { name: zone.name })}</p>`
    });

    if (!confirm) return;
    zones.splice(zoneIdx, 1);
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
    const checkboxes = categoryDiv.querySelectorAll('.preset-enabled');
    checkboxes.forEach((cb) => {
      cb.checked = shouldEnable;
    });
  }

  /**
   * Create a new blank calendar.
   */
  static #onCreateNew() {
    this.#initializeBlankCalendar();
    this.#calendarId = null;
    this.#isEditing = false;
    this.render();
  }

  /**
   * Duplicate the currently loaded calendar.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onDuplicateCalendar(_event, _target) {
    if (!this.#calendarId) {
      ui.notifications.warn('CALENDARIA.Editor.SelectCalendarFirst', { localize: true });
      return;
    }

    const calendar = CalendarManager.getCalendar(this.#calendarId);
    if (!calendar) {
      ui.notifications.error(format('CALENDARIA.Editor.CalendarNotFound', { id: this.#calendarId }));
      return;
    }

    const calendarName = localize(calendar.name || this.#calendarId);
    this.#calendarData = calendar.toObject();
    preLocalizeCalendar(this.#calendarData);
    this.#calendarData.name = format('CALENDARIA.Editor.CopyOfName', { name: calendarName });
    if (!this.#calendarData.seasons) this.#calendarData.seasons = { values: [] };
    if (!this.#calendarData.eras) this.#calendarData.eras = [];
    if (!this.#calendarData.festivals) this.#calendarData.festivals = [];
    if (!this.#calendarData.moons) this.#calendarData.moons = [];
    if (this.#calendarData.metadata) {
      delete this.#calendarData.metadata.id;
      delete this.#calendarData.metadata.isCustom;
    }

    this.#calendarId = null;
    this.#isEditing = false;
    ui.notifications.info(format('CALENDARIA.Editor.Duplicated', { name: calendarName }));
    this.render();
  }

  /**
   * Save the calendar.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onSaveCalendar(_event, _target) {
    if (!this.#calendarData.name) {
      ui.notifications.error('CALENDARIA.Editor.Error.NameRequired', { localize: true });
      return;
    }

    const setActive = await this.#showSaveDialog();
    if (setActive === null) return;
    this.#calendarData.days.daysPerYear = this.#calculateDaysPerYear();

    try {
      let calendar;
      let calendarId;

      if (this.#isEditing && this.#calendarId) {
        // Use isBundledCalendar directly to check BUNDLED_CALENDARS array, avoiding legacy data issues
        if (isBundledCalendar(this.#calendarId) || CalendarManager.hasDefaultOverride(this.#calendarId)) {
          calendar = await CalendarManager.saveDefaultOverride(this.#calendarId, this.#calendarData);
        } else {
          calendar = await CalendarManager.updateCustomCalendar(this.#calendarId, this.#calendarData);
        }
        calendarId = this.#calendarId;
      } else {
        const id =
          this.#calendarData.metadata?.suggestedId ||
          this.#calendarData.name
            .toLowerCase()
            .replace(/[^\da-z]/g, '-')
            .replace(/-+/g, '-');
        calendar = await CalendarManager.createCustomCalendar(id, this.#calendarData);
        if (calendar) {
          calendarId = calendar.metadata?.id;
          this.#calendarId = calendarId;
          this.#isEditing = true;
        }
      }

      if (calendar) {
        log(3, `Checking for pending notes: ${this.#pendingNotes?.length || 0}, importerId: ${this.#pendingImporterId}, calendarId: ${calendarId}`);
        if (this.#pendingNotes?.length > 0 && this.#pendingImporterId && calendarId) {
          const importer = createImporter(this.#pendingImporterId);
          if (importer) {
            log(3, `Importing ${this.#pendingNotes.length} pending notes to calendar ${calendarId}`);
            const result = await importer.importNotes(this.#pendingNotes, { calendarId });
            if (result.count > 0) ui.notifications.info(format('CALENDARIA.Editor.NotesImported', { count: result.count }));
            if (result.errors?.length > 0) log(1, 'Note import errors:', result.errors);
            this.#pendingNotes = null;
          }
        }

        if (this.#pendingCurrentDate && this.#pendingImporterId && calendarId) {
          const importer = createImporter(this.#pendingImporterId);
          if (importer) await importer.applyCurrentDate(this.#pendingCurrentDate, calendarId);
        }

        this.#pendingCurrentDate = null;
        this.#pendingImporterId = null;

        if (setActive && calendarId) {
          await CalendarManager.switchCalendar(calendarId);
          foundry.utils.debouncedReload();
        } else {
          CalendarManager.rerenderCalendarUIs();
        }
      }
    } catch (error) {
      log(1, 'Error saving calendar:', error);
      ui.notifications.error(format('CALENDARIA.Editor.SaveError', { error: error.message }));
    }
  }

  /**
   * Show save dialog with "Set as active calendar" option.
   * @returns {Promise<boolean|null>} True if set active, false if not, null if cancelled
   * @private
   */
  async #showSaveDialog() {
    const isGM = game.user.isGM;
    const activeCalendarId = CalendarRegistry.getActiveId();
    const isAlreadyActive = activeCalendarId === this.#calendarId;
    const showSetActiveOption = isGM && !isAlreadyActive;

    const content = `
      <p>${localize('CALENDARIA.Editor.ConfirmSave')}</p>
      ${
        showSetActiveOption
          ? `<div class="form-group">
        <label class="checkbox">
          <input type="checkbox" name="setActive" ${this.#setActiveOnSave ? 'checked' : ''}>
          ${localize('CALENDARIA.Editor.SetAsActive')}
        </label>
        <p class="hint">${localize('CALENDARIA.Editor.SetAsActiveHint')}</p>
      </div>`
          : ''
      }
    `;

    return new Promise((resolve) => {
      foundry.applications.api.DialogV2.prompt({
        window: { title: localize('CALENDARIA.Common.Save') },
        content,
        ok: {
          label: localize('CALENDARIA.Common.Save'),
          icon: 'fas fa-save',
          callback: (_event, button, _dialog) => {
            const setActive = isGM ? (button.form.elements.setActive?.checked ?? false) : false;
            this.#setActiveOnSave = setActive;
            resolve(setActive);
          }
        },
        rejectClose: false
      }).then((result) => {
        if (result === undefined) resolve(null);
      });
    });
  }

  /**
   * Export the calendar as a JSON file.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static #onExportCalendar(_event, _target) {
    if (!this.#calendarData.name) {
      ui.notifications.error('CALENDARIA.Editor.Error.NameRequired', { localize: true });
      return;
    }

    const exportData = foundry.utils.deepClone(this.#calendarData);
    exportData.metadata = exportData.metadata || {};
    exportData.metadata.exportedFrom = 'calendaria';
    exportData.metadata.exportedAt = Date.now();
    exportData.metadata.version = game.modules.get('calendaria')?.version || '1.0.0';
    const activeCalendar = CalendarManager.getActiveCalendar();
    if (activeCalendar && this.#calendarId && CalendarRegistry.getActiveId() === this.#calendarId) exportData.currentDate = activeCalendar.currentDate;
    const filename = this.#calendarData.name
      .toLowerCase()
      .replace(/[^\da-z]+/g, '-')
      .replace(/^-|-$/g, '')
      .concat('.json');
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    ui.notifications.info(format('CALENDARIA.Editor.ExportSuccess', { name: this.#calendarData.name }));
  }

  /**
   * Reset the calendar to blank state.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onResetCalendar(_event, _target) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Common.Reset') },
      content: `<p>${localize('CALENDARIA.Editor.ConfirmReset')}</p>`,
      yes: { label: localize('CALENDARIA.Common.Reset'), icon: 'fas fa-undo' },
      no: { label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
    });

    if (confirmed) {
      this.#initializeBlankCalendar();
      ui.notifications.info('CALENDARIA.Editor.ResetComplete', { localize: true });
      this.render();
    }
  }

  /**
   * Delete the calendar (custom) or reset to default (bundled with overrides).
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onDeleteCalendar(_event, _target) {
    // Can't delete unsaved calendar
    if (!this.#calendarId || !this.#isEditing) {
      ui.notifications.info('CALENDARIA.Info.SaveBeforeDelete', { localize: true });
      return;
    }

    const isCustom = CalendarManager.isCustomCalendar(this.#calendarId);
    const hasOverride = CalendarManager.hasDefaultOverride(this.#calendarId);

    // Bundled calendar without overrides - can't delete
    if (!isCustom && !hasOverride) {
      ui.notifications.info('CALENDARIA.Info.CannotDeleteBundled', { localize: true });
      return;
    }

    // Bundled calendar with overrides - reset to default
    if (!isCustom && hasOverride) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: localize('CALENDARIA.Editor.ResetToDefault') },
        content: `<p>${localize('CALENDARIA.Editor.ConfirmResetToDefault')}</p>`,
        yes: { label: localize('CALENDARIA.Editor.ResetToDefault'), icon: 'fas fa-history', callback: () => true },
        no: { label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
      });

      if (!confirmed) return;
      const reset = await CalendarManager.resetDefaultCalendar(this.#calendarId);
      if (reset) {
        ui.notifications.info('CALENDARIA.Info.CalendarResetToDefault', { localize: true });
        this.#loadExistingCalendar(this.#calendarId);
        this.render();
      }
      return;
    }

    // Custom calendar - delete
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Common.DeleteCalendar') },
      content: `<p>${format('CALENDARIA.Editor.ConfirmDelete', { name: this.#calendarData.name })}</p>`,
      yes: { label: localize('CALENDARIA.Common.DeleteCalendar'), icon: 'fas fa-trash', callback: () => true },
      no: { label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
    });

    if (!confirmed) return;

    // If deleting active calendar, switch to Gregorian first
    if (CalendarRegistry.getActiveId() === this.#calendarId) {
      const switched = await CalendarManager.switchCalendar('gregorian');
      if (!switched) {
        ui.notifications.error('CALENDARIA.Error.CalendarDeleteFailed', { localize: true });
        return;
      }
    }

    const deleted = await CalendarManager.deleteCustomCalendar(this.#calendarId);
    if (deleted) {
      const activeCalendar = CalendarManager.getActiveCalendar();
      if (activeCalendar?.metadata?.id) {
        this.#calendarId = activeCalendar.metadata.id;
        this.#isEditing = true;
        this.#loadExistingCalendar(this.#calendarId);
      } else {
        this.#calendarId = null;
        this.#isEditing = false;
        this.#initializeBlankCalendar();
      }
      this.render();
    } else {
      ui.notifications.error('CALENDARIA.Error.CalendarDeleteFailed', { localize: true });
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

  /**
   * Open the calendar builder to create a new calendar.
   * @returns {CalendarEditor} The rendered calendar editor instance
   */
  static createNew() {
    return new CalendarEditor().render(true);
  }

  /**
   * Open the calendar builder to edit an existing calendar.
   * @param {string} calendarId - Calendar ID to edit
   * @returns {CalendarEditor} The rendered calendar editor instance
   */
  static edit(calendarId) {
    return new CalendarEditor({ calendarId }).render(true);
  }

  /**
   * Open the calendar builder with pre-loaded data (e.g., from importer).
   * @param {object} data - Calendar data to load
   * @param {object} [options] - Additional options
   * @param {string} [options.suggestedId] - Suggested ID for the calendar
   * @returns {CalendarEditor} The rendered calendar editor instance
   */
  static createFromData(data, options = {}) {
    return new CalendarEditor({ initialData: data, suggestedId: options.suggestedId }).render(true);
  }
}
