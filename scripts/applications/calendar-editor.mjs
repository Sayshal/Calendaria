/**
 * Calendar Editor Application
 * A comprehensive UI for creating and editing custom calendars.
 * @module Applications/CalendarEditor
 * @author Tyler
 */

import { isBundledCalendar } from '../calendar/calendar-loader.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import CalendarRegistry from '../calendar/calendar-registry.mjs';
import { ASSETS, DEFAULT_MOON_PHASES, TEMPLATES } from '../constants.mjs';
import { createImporter } from '../importers/index.mjs';
import { validateFormatString } from '../utils/format-utils.mjs';
import { format, localize, preLocalizeCalendar } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { RangeSlider } from '../utils/range-slider.mjs';
import { CLIMATE_ZONE_TEMPLATES, getClimateTemplateOptions, getDefaultZoneConfig } from '../weather/climate-data.mjs';
import { ClimateEditor } from './climate-editor.mjs';
import { TokenReferenceDialog } from './token-reference-dialog.mjs';

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
    window: { icon: 'fas fa-calendar-plus', resizable: false },
    position: { width: 1100, height: 900 },
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
      editSeasonIcon: CalendarEditor.#onEditSeasonIcon,
      editSeasonClimate: CalendarEditor.#onEditSeasonClimate,
      addEra: CalendarEditor.#onAddEra,
      removeEra: CalendarEditor.#onRemoveEra,
      addFestival: CalendarEditor.#onAddFestival,
      removeFestival: CalendarEditor.#onRemoveFestival,
      editFestivalIcon: CalendarEditor.#onEditFestivalIcon,
      addMoon: CalendarEditor.#onAddMoon,
      removeMoon: CalendarEditor.#onRemoveMoon,
      addMoonPhase: CalendarEditor.#onAddMoonPhase,
      removeMoonPhase: CalendarEditor.#onRemoveMoonPhase,
      pickMoonPhaseIcon: CalendarEditor.#onPickMoonPhaseIcon,
      addCycle: CalendarEditor.#onAddCycle,
      removeCycle: CalendarEditor.#onRemoveCycle,
      addCycleStage: CalendarEditor.#onAddCycleStage,
      removeCycleStage: CalendarEditor.#onRemoveCycleStage,
      addCanonicalHour: CalendarEditor.#onAddCanonicalHour,
      removeCanonicalHour: CalendarEditor.#onRemoveCanonicalHour,
      addNamedWeek: CalendarEditor.#onAddNamedWeek,
      removeNamedWeek: CalendarEditor.#onRemoveNamedWeek,
      addNamedYear: CalendarEditor.#onAddNamedYear,
      removeNamedYear: CalendarEditor.#onRemoveNamedYear,
      duplicateCalendar: CalendarEditor.#onDuplicateCalendar,
      saveCalendar: CalendarEditor.#onSaveCalendar,
      exportCalendar: CalendarEditor.#onExportCalendar,
      resetCalendar: CalendarEditor.#onResetCalendar,
      deleteCalendar: CalendarEditor.#onDeleteCalendar,
      addZone: CalendarEditor.#onAddZone,
      editZoneClimate: CalendarEditor.#onEditZoneClimate,
      setActiveZone: CalendarEditor.#onSetActiveZone,
      deleteZone: CalendarEditor.#onDeleteZone,
      createNew: CalendarEditor.#onCreateNew,
      showTokenReference: CalendarEditor.#onShowTokenReference
    }
  };

  /** @override */
  static PARTS = {
    tabs: { template: TEMPLATES.TAB_NAVIGATION },
    overview: { template: TEMPLATES.EDITOR.TAB_OVERVIEW, scrollable: [''] },
    display: { template: TEMPLATES.EDITOR.TAB_DISPLAY, scrollable: [''] },
    time: { template: TEMPLATES.EDITOR.TAB_TIME, scrollable: [''] },
    months: { template: TEMPLATES.EDITOR.TAB_MONTHS, scrollable: [''] },
    weeks: { template: TEMPLATES.EDITOR.TAB_WEEKS, scrollable: [''] },
    seasons: { template: TEMPLATES.EDITOR.TAB_SEASONS, scrollable: [''] },
    years: { template: TEMPLATES.EDITOR.TAB_YEARS, scrollable: [''] },
    eras: { template: TEMPLATES.EDITOR.TAB_ERAS, scrollable: [''] },
    festivals: { template: TEMPLATES.EDITOR.TAB_FESTIVALS, scrollable: [''] },
    moons: { template: TEMPLATES.EDITOR.TAB_MOONS, scrollable: [''] },
    cycles: { template: TEMPLATES.EDITOR.TAB_CYCLES, scrollable: [''] },
    weather: { template: TEMPLATES.EDITOR.TAB_WEATHER, scrollable: [''] },
    footer: { template: TEMPLATES.FORM_FOOTER }
  };

  /** Tab group definitions with colors */
  static TAB_GROUPS = [
    { id: 'structure', label: 'CALENDARIA.Editor.Group.Structure', tooltip: 'CALENDARIA.Editor.GroupTooltip.Structure', color: '#84cc16' },
    { id: 'features', label: 'CALENDARIA.Editor.Group.Features', tooltip: 'CALENDARIA.Editor.GroupTooltip.Features', color: '#f97316' }
  ];

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        // Core (ungrouped)
        { id: 'overview', group: 'primary', icon: 'fas fa-info-circle', label: 'CALENDARIA.Editor.Tab.Overview', color: '#ff144f' },
        { id: 'display', group: 'primary', icon: 'fas fa-eye', label: 'CALENDARIA.Editor.Tab.Display', color: '#ff144f' },
        // Structure group
        { id: 'months', group: 'primary', icon: 'fas fa-calendar', label: 'CALENDARIA.Common.Months', tabGroup: 'structure' },
        { id: 'weeks', group: 'primary', icon: 'fas fa-calendar-week', label: 'CALENDARIA.Common.Weeks', tabGroup: 'structure' },
        { id: 'years', group: 'primary', icon: 'fas fa-hashtag', label: 'CALENDARIA.Editor.Tab.Years', tabGroup: 'structure' },
        { id: 'time', group: 'primary', icon: 'fas fa-clock', label: 'CALENDARIA.Common.Time', tabGroup: 'structure' },
        // Features group
        { id: 'festivals', group: 'primary', icon: 'fas fa-star', label: 'CALENDARIA.Common.Festivals', tabGroup: 'features' },
        { id: 'eras', group: 'primary', icon: 'fas fa-hourglass-half', label: 'CALENDARIA.Common.Eras', tabGroup: 'features' },
        { id: 'cycles', group: 'primary', icon: 'fas fa-arrows-rotate', label: 'CALENDARIA.Common.Cycles', tabGroup: 'features' },
        { id: 'moons', group: 'primary', icon: 'fas fa-moon', label: 'CALENDARIA.Common.Moons', tabGroup: 'features' },
        { id: 'seasons', group: 'primary', icon: 'fas fa-sun', label: 'CALENDARIA.Common.Seasons', tabGroup: 'features' },
        { id: 'weather', group: 'primary', icon: 'fas fa-cloud-sun', label: 'CALENDARIA.Common.Weather', tabGroup: 'features' }
      ],
      initial: 'overview'
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
      years: { yearZero: 0, firstWeekday: 0, leapYear: null, resetWeekdays: false, allowNegativeYears: true, names: [] },
      months: {
        values: {
          [foundry.utils.randomID()]: { name: format('CALENDARIA.Editor.Default.MonthName', { num: 1 }), abbreviation: format('CALENDARIA.Editor.Default.MonthAbbr', { num: 1 }), ordinal: 1, days: 30 }
        }
      },
      days: {
        values: { [foundry.utils.randomID()]: { name: format('CALENDARIA.Editor.Default.DayName', { num: 1 }), abbreviation: format('CALENDARIA.Editor.Default.DayAbbr', { num: 1 }), ordinal: 1 } },
        daysPerYear: 365,
        hoursPerDay: 24,
        minutesPerHour: 60,
        secondsPerMinute: 60
      },
      secondsPerRound: 6,
      seasons: { type: 'dated', offset: 0, values: {} },
      eras: {},
      festivals: {},
      moons: {},
      cycles: {},
      canonicalHours: {},
      weeks: { enabled: false, type: 'year-based', names: {} },
      amPmNotation: { am: 'AM', pm: 'PM', amAbbr: 'AM', pmAbbr: 'PM' },
      dateFormats: { short: 'D MMM', long: 'D MMMM, YYYY', full: 'MMMM D, YYYY', time: 'HH:mm', time12: 'h:mm a', weekHeader: '[W]', yearHeader: '[YYYY]', yearLabel: '[YYYY] [GGGG]' },
      metadata: { id: '', description: '', author: game.user?.name ?? '', system: '' },
      weather: { activeZone: null, autoGenerate: false, zones: {} }
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
      const calObj = calendar.toObject();
      this.#calendarData = foundry.utils.mergeObject(CalendarEditor.#createBlankCalendar(), calObj);
      // TypedObjectField collections merge key-by-key, so the blank's default entries
      // (e.g. "Month 1") persist alongside real data. Replace them entirely.
      if (calObj.months?.values) this.#calendarData.months.values = calObj.months.values;
      if (calObj.days?.values) this.#calendarData.days.values = calObj.days.values;
      if (calObj.seasons?.values) this.#calendarData.seasons.values = calObj.seasons.values;
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
    // TypedObjectField collections merge key-by-key — replace with source data entirely.
    if (data.months?.values) this.#calendarData.months.values = data.months.values;
    if (data.days?.values) this.#calendarData.days.values = data.days.values;
    if (data.seasons?.values) this.#calendarData.seasons.values = data.seasons.values;
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
    const { tabGroups, ungroupedTabs } = this.#prepareTabGroups();
    context.tabGroups = tabGroups;
    context.ungroupedTabs = ungroupedTabs;
    context.showSearch = false;
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

    const monthsArr = Object.entries(this.#calendarData.months.values);
    const daysArr = Object.entries(this.#calendarData.days.values);
    context.monthOptions = monthsArr.map(([, month], idx) => ({ value: idx + 1, label: month.name }));
    const startingWeekdayOptions = daysArr.map(([, day], idx) => ({ value: idx, label: day.name }));
    const monthCount = monthsArr.length;
    const monthTypeOptions = [
      { value: '', label: 'CALENDARIA.Editor.MonthType.Standard' },
      { value: 'intercalary', label: 'CALENDARIA.Editor.MonthType.Intercalary' }
    ];
    context.monthsWithNav = monthsArr.map(([key, month], idx) => ({
      ...month,
      key,
      index: idx,
      isFirst: idx === 0,
      isLast: idx === monthCount - 1,
      hasStartingWeekday: month.startingWeekday != null,
      hasCustomWeekdays: month.weekdays ? Object.keys(month.weekdays).length > 0 : false,
      customWeekdays: month.weekdays ? Object.entries(month.weekdays).map(([wKey, wd]) => ({ ...wd, key: wKey })) : [],
      startingWeekdayOptions: startingWeekdayOptions.map((opt) => ({ ...opt, selected: opt.value === month.startingWeekday })),
      typeOptions: monthTypeOptions.map((opt) => ({ ...opt, selected: (opt.value || null) === (month.type || null) }))
    }));
    const festivalsArr = Object.entries(this.#calendarData.festivals);
    context.festivalsWithNav = festivalsArr.map(([key, festival]) => ({
      ...festival,
      key,
      monthOptions: context.monthOptions.map((opt) => ({ ...opt, selected: opt.value === festival.month }))
    }));

    const currentFirstWeekday = this.#calendarData.years.firstWeekday ?? 0;
    context.weekdayOptions = daysArr.map(([, day], idx) => ({ value: idx, label: day.name, selected: idx === currentFirstWeekday }));
    const weekdayCount = daysArr.length;
    context.weekdaysWithNav = daysArr.map(([key, day], idx) => ({ ...day, key, index: idx, isFirst: idx === 0, isLast: idx === weekdayCount - 1 }));
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

    const yearNames = this.#calendarData.years.names || [];
    context.namedYears = yearNames.map((entry, idx) => ({ ...entry, index: idx }));

    context.monthOptionsZeroIndexed = monthsArr.map(([, month], idx) => ({ value: idx, label: month.name }));

    const moonsArr = Object.entries(this.#calendarData.moons);
    context.moonsWithNav = moonsArr.map(([moonKey, moon], idx) => {
      const phasesArr = moon.phases ? Object.entries(moon.phases) : [];
      return {
        ...moon,
        key: moonKey,
        color: moon.color || '',
        index: idx,
        referencePhaseOptions: phasesArr.map(([, phase], pIdx) => ({
          value: pIdx,
          label: localize(phase.name),
          selected: pIdx === (moon.referencePhase ?? 0)
        })),
        refMonthOptions: context.monthOptionsZeroIndexed.map((opt) => ({ ...opt, selected: opt.value === moon.referenceDate?.month })),
        phasesWithIndex: phasesArr.map(([phaseKey, phase], pIdx) => {
          const rawStart = Math.round((phase.start ?? pIdx * 0.125) * 10000) / 100;
          const rawEnd = Math.round((phase.end ?? (pIdx + 1) * 0.125) * 10000) / 100;
          const widthPercent = Math.max(0, rawEnd - rawStart);
          return {
            ...phase,
            phaseKey,
            name: localize(phase.name),
            index: pIdx,
            moonKey,
            moonColor: moon.color || '',
            isImagePath: phase.icon?.includes('/') ?? false,
            startPercent: rawStart.toFixed(2),
            endPercent: rawEnd.toFixed(2),
            widthPercent,
            widthFormatted: widthPercent.toFixed(2)
          };
        })
      };
    });

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
    const seasonsArr = Object.entries(this.#calendarData.seasons.values);
    context.seasonsWithNav = seasonsArr.map(([key, season], idx) => {
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
        key,
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
    context.lastSeasonIndex = seasonsArr.length - 1;

    const erasArr = Object.entries(this.#calendarData.eras);
    context.erasWithNav = erasArr.map(([key, era]) => ({
      ...era,
      key
    }));
    const basedOnOptions = [
      { value: 'year', label: 'CALENDARIA.Editor.Cycle.BasedOn.Year' },
      { value: 'eraYear', label: 'CALENDARIA.Editor.Cycle.BasedOn.EraYear' },
      { value: 'month', label: 'CALENDARIA.Common.Month' },
      { value: 'monthDay', label: 'CALENDARIA.Editor.Cycle.BasedOn.MonthDay' },
      { value: 'day', label: 'CALENDARIA.Editor.Cycle.BasedOn.Day' },
      { value: 'yearDay', label: 'CALENDARIA.Editor.Cycle.BasedOn.YearDay' }
    ];

    const cyclesArr = Object.entries(this.#calendarData.cycles || {});
    context.cyclesWithNav = cyclesArr.map(([cycleKey, cycle], idx) => {
      const stagesArr = cycle.stages ? Object.entries(cycle.stages) : [];
      return {
        ...cycle,
        key: cycleKey,
        index: idx,
        basedOnOptions: basedOnOptions.map((opt) => ({ ...opt, selected: opt.value === (cycle.basedOn || 'month') })),
        stagesWithIndex: stagesArr.map(([stageKey, stage], sIdx) => ({ ...stage, key: stageKey, index: sIdx, displayNum: sIdx + 1, cycleKey }))
      };
    });
    context.cycleFormat = this.#calendarData.cycleFormat || '';
    context.basedOnOptions = basedOnOptions;
    const chArr = Object.entries(this.#calendarData.canonicalHours || {});
    context.canonicalHoursWithNav = chArr.map(([key, ch]) => ({ ...ch, key }));
    const currentWeeksType = this.#calendarData.weeks?.type || 'year-based';
    context.isYearBased = currentWeeksType === 'year-based';
    context.weeksTypeOptions = [
      { value: 'year-based', label: 'CALENDARIA.Editor.WeeksType.YearBased', selected: currentWeeksType === 'year-based' },
      { value: 'month-based', label: 'CALENDARIA.Editor.WeeksType.MonthBased', selected: currentWeeksType === 'month-based' }
    ];
    const daysPerWeek = daysArr.length || 7;
    context.maxWeeks = Math.ceil(context.calculatedDaysPerYear / daysPerWeek);
    const weekNamesArr = Object.entries(this.#calendarData.weeks?.names || {});
    // Backfill missing weekNumbers sequentially
    for (let i = 0; i < weekNamesArr.length; i++) {
      if (weekNamesArr[i][1].weekNumber == null) weekNamesArr[i][1].weekNumber = i + 1;
    }
    const weekNumberCounts = weekNamesArr.reduce((acc, [, w]) => {
      acc[w.weekNumber] = (acc[w.weekNumber] || 0) + 1;
      return acc;
    }, {});
    context.namedWeeksWithNav = weekNamesArr.map(([key, week]) => ({ ...week, key, duplicateWeekNumber: weekNumberCounts[week.weekNumber] > 1 }));
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

  /**
   * Prepare grouped and ungrouped tabs for template rendering.
   * @returns {{tabGroups: Array<object>, ungroupedTabs: Array<object>}} Tab groups and ungrouped tabs
   */
  #prepareTabGroups() {
    const activeTab = this.tabGroups.primary || 'overview';
    const mapTab = (tab) => ({
      ...tab,
      group: 'primary',
      active: tab.id === activeTab,
      cssClass: tab.id === activeTab ? 'active' : ''
    });
    const ungroupedTabs = CalendarEditor.TABS.primary.tabs.filter((tab) => !tab.tabGroup).map(mapTab);
    const tabGroups = CalendarEditor.TAB_GROUPS.map((group) => {
      const groupTabs = CalendarEditor.TABS.primary.tabs.filter((tab) => tab.tabGroup === group.id).map(mapTab);
      return { ...group, tabs: groupTabs };
    }).filter((group) => group.tabs.length > 0);
    return { tabGroups, ungroupedTabs };
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
    this.#setupLeapRuleListener();
    this.#setupWeekNumberDuplicateListener();
    for (const colorInput of this.element.querySelectorAll('input[name^="moons."][name$=".color"]')) {
      colorInput.addEventListener('input', (event) => {
        const preview = event.target.closest('.color-input-wrapper')?.querySelector('.moon-color-preview');
        if (!preview) return;
        const color = event.target.value;
        const isDefault = color.toLowerCase() === '#b8b8b8';
        preview.style.setProperty('--moon-color', color);
        preview.classList.toggle('tinted', !isDefault);
        const match = event.target.name.match(/moons\.(\d+)\.color/);
        if (match) {
          const moonItem = event.target.closest('.moon-item');
          if (moonItem) {
            for (const el of moonItem.querySelectorAll('.slider-segment, .phase-icon-btn')) {
              el.style.setProperty('--moon-color', color);
              el.classList.toggle('tinted', !isDefault);
            }
          }
        }
      });
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
    this.#setupPhaseSliderListeners();
    this.#setupFormatPreviewListeners();
  }

  /**
   * Setup leap rule select to toggle visibility of leap year config fields.
   * @private
   */
  #setupLeapRuleListener() {
    const leapRuleSelect = this.element.querySelector('[name="leapYearConfig.rule"]');
    if (!leapRuleSelect || leapRuleSelect.dataset.listenerAttached) return;
    leapRuleSelect.dataset.listenerAttached = 'true';
    leapRuleSelect.addEventListener('change', (event) => {
      const rule = event.target.value;
      for (const el of this.element.querySelectorAll('[data-leap-rule]')) {
        el.style.display = el.dataset.leapRule === rule ? '' : 'none';
      }
    });
  }

  /** Live duplicate detection on week number inputs. */
  #setupWeekNumberDuplicateListener() {
    const list = this.element.querySelector('.named-weeks-list');
    if (!list || list.dataset.duplicateListenerAttached) return;
    list.dataset.duplicateListenerAttached = 'true';
    const tooltip = localize('CALENDARIA.Editor.Tooltip.DuplicateWeekNumber');
    list.addEventListener('change', (event) => {
      if (!event.target.matches('.col-week-number')) return;
      const inputs = list.querySelectorAll('input.col-week-number');
      const counts = {};
      for (const input of inputs) counts[input.value] = (counts[input.value] || 0) + 1;
      for (const input of inputs) {
        const isDuplicate = counts[input.value] > 1;
        input.classList.toggle('duplicate', isDuplicate);
        if (isDuplicate) {
          input.dataset.tooltip = '';
          input.setAttribute('aria-label', tooltip);
        } else {
          delete input.dataset.tooltip;
          input.removeAttribute('aria-label');
        }
      }
    });
  }

  /**
   * Set up live preview listeners for format inputs on the Display tab.
   * @private
   */
  #setupFormatPreviewListeners() {
    const formatInputs = this.element.querySelectorAll('.format-input');
    if (!formatInputs.length) return;

    // Build sample components from the calendar being edited
    const cal = this.#calendarData;
    const yearZero = cal?.years?.yearZero ?? 0;
    const components = { year: yearZero + 1, month: 0, dayOfMonth: 1, hour: 14, minute: 30, second: 0 };

    const updatePreview = (input) => {
      const field = input.closest('.form-group')?.querySelector('.format-preview');
      if (!field) return;
      const formatStr = input.value.trim();
      if (!formatStr) {
        field.textContent = '';
        field.classList.remove('error');
        input.classList.remove('invalid');
        return;
      }
      const result = validateFormatString(formatStr, cal, components);
      if (result.valid) {
        field.textContent = result.preview || formatStr;
        field.classList.remove('error');
        input.classList.remove('invalid');
      } else {
        field.textContent = localize(result.error || 'CALENDARIA.Format.Error.Invalid');
        field.classList.add('error');
        input.classList.add('invalid');
      }
    };

    for (const input of formatInputs) {
      // Initial preview on render
      updatePreview(input);
      // Debounced live preview on input
      let debounceTimer;
      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => updatePreview(input), 200);
      });
    }
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
   * Set up drag handlers for moon phase sliders.
   * @private
   */
  #setupPhaseSliderListeners() {
    for (const slider of this.element.querySelectorAll('.moon-phase-slider')) {
      if (slider.dataset.sliderAttached) continue;
      slider.dataset.sliderAttached = 'true';
      const moonKey = slider.dataset.moonKey;
      const moon = this.#calendarData.moons[moonKey];
      if (!moon?.phases) continue;
      const phaseKeys = Object.keys(moon.phases);
      new RangeSlider({
        container: this.element,
        sliderSelector: `.moon-phase-slider[data-moon-key="${moonKey}"]`,
        trackSelector: '.slider-track',
        segmentSelector: '.slider-segment',
        handleSelector: '.slider-handle',
        handleKeyAttr: 'data-phase-key',
        segmentKeyAttr: 'data-phase-key',
        labelClass: 'phase-percent',
        keys: phaseKeys,
        inputStartSelector: `input[name="moons.${moonKey}.phases.{key}.startPercent"]`,
        inputEndSelector: `input[name="moons.${moonKey}.phases.{key}.endPercent"]`,
        minGap: 1,
        labelMinWidth: 3,
        labelModes: ['percent', 'days'],
        getData: () => Object.values(moon.phases).map((p) => ({ start: p.start, end: p.end })),
        setData: (data) => {
          for (let i = 0; i < data.length; i++) {
            const pKey = phaseKeys[i];
            if (pKey && moon.phases[pKey]) {
              moon.phases[pKey].start = data[i].start;
              moon.phases[pKey].end = data[i].end;
            }
          }
        },
        formatLabel: (widthPercent, mode) => {
          if (mode === 'days') {
            const cycleLength = moon.cycleLength || 29.5;
            const days = (widthPercent / 100) * cycleLength;
            return `${days.toFixed(1)}d`;
          }
          return `${widthPercent.toFixed(2)}%`;
        }
      });
    }
  }

  /**
   * Set up event listeners for preset alias input changes.
   * Saves alias to world settings when changed.
   * @private
   */
  /**
   * Calculate total days per year from month definitions.
   * @param {boolean} [leapYear] - Whether to calculate for leap year
   * @returns {number} Total days
   * @private
   */
  #calculateDaysPerYear(leapYear = false) {
    return Object.values(this.#calendarData.months.values ?? {}).reduce((sum, month) => {
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
    const months = Object.values(this.#calendarData.months.values ?? {});
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
    const months = Object.values(this.#calendarData.months.values ?? {});
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
    const zonesObj = weather.zones ?? {};
    context.seasonClimateList = Object.entries(this.#calendarData.seasons?.values ?? {}).map(([key, season], idx) => ({
      key,
      index: idx,
      name: season.name,
      icon: season.icon,
      color: season.color,
      hasClimate: !!(season.climate?.temperatures || Object.keys(season.climate?.presets ?? {}).length)
    }));
    const activeZoneId = weather.activeZone;
    context.zoneList = Object.entries(zonesObj).map(([key, zone]) => ({
      key,
      name: zone.name || '',
      id: zone.id,
      isActive: zone.id === activeZoneId,
      hasPresets: Object.keys(zone.presets ?? {}).length > 0
    }));
  }

  /**
   * Handle form submission.
   * @param {Event} _event - Form submit event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - Processed form data
   */
  static async #onSubmit(_event, _form, formData) {
    const oldSeasonType = this.#calendarData.seasons?.type;
    const oldWeeksType = this.#calendarData.weeks?.type;
    this.#updateFromFormData(formData.object);
    const newSeasonType = this.#calendarData.seasons?.type;
    const newWeeksType = this.#calendarData.weeks?.type;
    if (oldSeasonType !== newSeasonType) this.render({ parts: ['seasons'] });
    if (oldWeeksType !== newWeeksType) this.render({ parts: ['weeks'] });
  }

  /**
   * Update calendar data from form submission.
   * @param {object} data - Form data object
   * @private
   */
  #updateFromFormData(data) {
    this.#calendarData.name = data.name || '';
    this.#calendarData.metadata.description = data['metadata.description'] || '';
    this.#calendarData.metadata.system = data['metadata.system'] || '';
    this.#calendarData.years.yearZero = parseInt(data['years.yearZero']) || 0;
    this.#calendarData.years.firstWeekday = parseInt(data['years.firstWeekday']) || 0;
    this.#calendarData.years.resetWeekdays = data['years.resetWeekdays'] ?? false;
    this.#calendarData.years.allowNegativeYears = data['years.allowNegativeYears'] ?? true;
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
    this.#updateObjectFromFormData(data, 'weekdays', this.#calendarData.days.values, ['name', 'abbreviation', 'isRestDay']);
    this.#updateSeasonsFromFormData(data);
    this.#updateErasFromFormData(data);
    this.#updateObjectFromFormData(data, 'festivals', this.#calendarData.festivals, [
      'name',
      'description',
      'color',
      'icon',
      'month',
      'day',
      'duration',
      'leapDuration',
      'leapYearOnly',
      'countsForWeekday'
    ]);
    this.#updateMoonsFromFormData(data);
    this.#updateCyclesFromFormData(data);
    if (!this.#calendarData.amPmNotation) this.#calendarData.amPmNotation = {};
    this.#calendarData.amPmNotation.am = data['amPmNotation.am'] || 'AM';
    this.#calendarData.amPmNotation.pm = data['amPmNotation.pm'] || 'PM';
    this.#calendarData.amPmNotation.amAbbr = data['amPmNotation.amAbbr'] || 'AM';
    this.#calendarData.amPmNotation.pmAbbr = data['amPmNotation.pmAbbr'] || 'PM';
    if (!this.#calendarData.dateFormats) this.#calendarData.dateFormats = {};
    this.#calendarData.dateFormats.short = data['dateFormats.short'] || '{{d}} {{b}}';
    this.#calendarData.dateFormats.long = data['dateFormats.long'] || '{{d}} {{B}}, {{y}}';
    this.#calendarData.dateFormats.full = data['dateFormats.full'] || '{{B}} {{d}}, {{y}}';
    this.#calendarData.dateFormats.time = data['dateFormats.time'] || '{{H}}:{{M}}';
    this.#calendarData.dateFormats.time12 = data['dateFormats.time12'] || '{{h}}:{{M}} {{p}}';
    if (data['dateFormats.weekHeader'] != null) this.#calendarData.dateFormats.weekHeader = data['dateFormats.weekHeader'];
    if (data['dateFormats.yearHeader'] != null) this.#calendarData.dateFormats.yearHeader = data['dateFormats.yearHeader'];
    if (data['dateFormats.yearLabel'] != null) this.#calendarData.dateFormats.yearLabel = data['dateFormats.yearLabel'];
    this.#updateCanonicalHoursFromFormData(data);
    this.#updateNamedWeeksFromFormData(data);
    this.#updateNamedYearsFromFormData(data);
    this.#updateWeatherFromFormData(data);
  }

  /**
   * Update a keyed object field from form data.
   * @param {object} data - Form data
   * @param {string} prefix - Field prefix
   * @param {object} targetObj - Target keyed object to update
   * @param {Array<string>} fields - Field names to extract
   * @private
   */
  #updateObjectFromFormData(data, prefix, targetObj, fields) {
    const keys = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(new RegExp(`^${prefix}\\.([^.]+)\\.`));
      if (match) keys.add(match[1]);
    }

    // Clear existing and rebuild preserving key order from form
    for (const k of Object.keys(targetObj)) delete targetObj[k];
    let ordinal = 1;
    for (const itemKey of keys) {
      const item = { ordinal: ordinal++ };
      for (const field of fields) {
        const key = `${prefix}.${itemKey}.${field}`;
        if (data[key] !== undefined) {
          if (field === 'leapDays' || field === 'leapDuration' || field === 'startingWeekday') item[field] = isNaN(parseInt(data[key])) ? null : parseInt(data[key]);
          else if (field === 'days' || field === 'day' || field === 'month' || field === 'duration' || field === 'dayStart' || field === 'dayEnd') item[field] = parseInt(data[key]) || 0;
          else if (field === 'color') item[field] = data[key]?.toLowerCase() === '#d4af37' ? '' : data[key] || '';
          else if (field === 'countsForWeekday') item[field] = !data[key];
          else if (field === 'isRestDay' || field === 'leapYearOnly') item[field] = !!data[key];
          else item[field] = data[key];
        }
      }
      targetObj[itemKey] = item;
    }
  }

  /**
   * Update months array from form data, including custom weekdays.
   * @param {object} data - Form data
   * @private
   */
  #updateMonthsFromFormData(data) {
    const monthKeys = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^months\.([^.]+)\./);
      if (match) monthKeys.add(match[1]);
    }
    const newValues = {};
    let ordinal = 1;
    for (const mKey of monthKeys) {
      const month = {
        name: data[`months.${mKey}.name`] || '',
        abbreviation: data[`months.${mKey}.abbreviation`] || '',
        days: this.#parseOptionalInt(data[`months.${mKey}.days`]) ?? 30,
        leapDays: this.#parseOptionalInt(data[`months.${mKey}.leapDays`]),
        startingWeekday: this.#parseOptionalInt(data[`months.${mKey}.startingWeekday`]),
        ordinal: ordinal++
      };
      const monthType = data[`months.${mKey}.type`];
      if (monthType) month.type = monthType;
      const hasCustom = data[`months.${mKey}.hasCustomWeekdays`] === 'true' || data[`months.${mKey}.hasCustomWeekdays`] === true;
      if (hasCustom) {
        const weekdayKeys = new Set();
        for (const key of Object.keys(data)) {
          const wdMatch = key.match(new RegExp(`^months\\.${mKey}\\.weekdays\\.([^.]+)\\.`));
          if (wdMatch) weekdayKeys.add(wdMatch[1]);
        }

        if (weekdayKeys.size > 0) {
          month.weekdays = {};
          for (const wdKey of weekdayKeys) {
            month.weekdays[wdKey] = {
              name: data[`months.${mKey}.weekdays.${wdKey}.name`] || '',
              abbreviation: data[`months.${mKey}.weekdays.${wdKey}.abbreviation`] || '',
              isRestDay: !!data[`months.${mKey}.weekdays.${wdKey}.isRestDay`]
            };
          }
        } else {
          month.weekdays = {};
          for (const [k, wd] of Object.entries(this.#calendarData.days?.values ?? {})) {
            month.weekdays[k] = { name: wd.name || '', abbreviation: wd.abbreviation || '', isRestDay: !!wd.isRestDay };
          }
        }
      }

      newValues[mKey] = month;
    }
    this.#calendarData.months.values = newValues;
  }

  /**
   * Update seasons array from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateSeasonsFromFormData(data) {
    this.#calendarData.seasons.type = data['seasons.type'] || 'dated';
    this.#calendarData.seasons.offset = parseInt(data['seasons.offset']) || 0;
    const seasonKeys = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^seasons\.([^.]+)\./);
      if (match && match[1] !== 'type' && match[1] !== 'offset') seasonKeys.add(match[1]);
    }
    const isPeriodic = this.#calendarData.seasons.type === 'periodic';
    const existingClimates = {};
    for (const [k, s] of Object.entries(this.#calendarData.seasons.values)) existingClimates[k] = s.climate;
    const newValues = {};
    let ordinal = 1;
    for (const sKey of seasonKeys) {
      const seasonalType = data[`seasons.${sKey}.seasonalType`];
      const season = {
        name: data[`seasons.${sKey}.name`] || '',
        abbreviation: data[`seasons.${sKey}.abbreviation`] || '',
        icon: data[`seasons.${sKey}.icon`] || '',
        color: data[`seasons.${sKey}.color`] || '',
        seasonalType: seasonalType || null,
        ordinal: ordinal++,
        climate: existingClimates[sKey] ?? null
      };
      if (isPeriodic) {
        season.duration = this.#parseOptionalInt(data[`seasons.${sKey}.duration`]) ?? 91;
      } else {
        season.monthStart = parseInt(data[`seasons.${sKey}.monthStart`]) || 1;
        season.monthEnd = parseInt(data[`seasons.${sKey}.monthEnd`]) || 1;
        season.dayStart = this.#parseOptionalInt(data[`seasons.${sKey}.dayStart`]);
        season.dayEnd = this.#parseOptionalInt(data[`seasons.${sKey}.dayEnd`]);
      }
      newValues[sKey] = season;
    }
    this.#calendarData.seasons.values = newValues;
  }

  /**
   * Update eras array from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateErasFromFormData(data) {
    const eraKeys = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^eras\.([^.]+)\./);
      if (match) eraKeys.add(match[1]);
    }
    const newEras = {};
    for (const eKey of eraKeys) {
      newEras[eKey] = {
        name: data[`eras.${eKey}.name`] || '',
        abbreviation: data[`eras.${eKey}.abbreviation`] || '',
        startYear: parseInt(data[`eras.${eKey}.startYear`]) || 1,
        endYear: this.#parseOptionalInt(data[`eras.${eKey}.endYear`])
      };
    }
    this.#calendarData.eras = newEras;
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
    const moonKeys = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^moons\.([^.]+)\./);
      if (match) moonKeys.add(match[1]);
    }
    const newMoons = {};
    for (const mKey of moonKeys) {
      const existingMoon = this.#calendarData.moons[mKey];
      const existingPhases = existingMoon?.phases || DEFAULT_MOON_PHASES;
      const existingPhasesArr = Object.values(existingPhases);
      const phaseKeys = new Set();
      const phasePattern = new RegExp(`^moons\\.${mKey}\\.phases\\.([^.]+)\\.`);
      for (const key of Object.keys(data)) {
        const match = key.match(phasePattern);
        if (match) phaseKeys.add(match[1]);
      }
      const phases = {};
      let pIdx = 0;
      for (const pKey of phaseKeys) {
        const phaseName = data[`moons.${mKey}.phases.${pKey}.name`];
        const phaseRisingName = data[`moons.${mKey}.phases.${pKey}.rising`];
        const phaseFadingName = data[`moons.${mKey}.phases.${pKey}.fading`];
        const phaseIcon = data[`moons.${mKey}.phases.${pKey}.icon`];
        const phaseStartPercent = data[`moons.${mKey}.phases.${pKey}.startPercent`];
        const phaseEndPercent = data[`moons.${mKey}.phases.${pKey}.endPercent`];
        const existingPhase = existingPhases[pKey] ?? existingPhasesArr[pIdx];
        phases[pKey] = {
          name: phaseName ?? existingPhase?.name ?? '',
          rising: phaseRisingName ?? existingPhase?.rising ?? '',
          fading: phaseFadingName ?? existingPhase?.fading ?? '',
          icon: phaseIcon ?? existingPhase?.icon ?? '',
          start: phaseStartPercent != null ? parseFloat(phaseStartPercent) / 100 : (existingPhase?.start ?? pIdx * 0.125),
          end: phaseEndPercent != null ? parseFloat(phaseEndPercent) / 100 : (existingPhase?.end ?? (pIdx + 1) * 0.125)
        };
        pIdx++;
      }
      const rawColor = data[`moons.${mKey}.color`] || '';
      const moonColor = rawColor.toLowerCase() === '#b8b8b8' ? '' : rawColor;
      newMoons[mKey] = {
        name: data[`moons.${mKey}.name`] || '',
        cycleLength: parseFloat(data[`moons.${mKey}.cycleLength`]) || 28,
        cycleDayAdjust: this.#parseOptionalInt(data[`moons.${mKey}.cycleDayAdjust`]) ?? existingMoon?.cycleDayAdjust ?? 0,
        referencePhase: this.#parseOptionalInt(data[`moons.${mKey}.referencePhase`]) ?? existingMoon?.referencePhase ?? 0,
        color: moonColor,
        phases,
        referenceDate: {
          year: parseInt(data[`moons.${mKey}.referenceDate.year`]) || 0,
          month: parseInt(data[`moons.${mKey}.referenceDate.month`]) || 0,
          day: parseInt(data[`moons.${mKey}.referenceDate.day`]) || 1
        }
      };
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
    const cycleKeys = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^cycles\.([^.]+)\./);
      if (match) cycleKeys.add(match[1]);
    }
    const newCycles = {};
    for (const cKey of cycleKeys) {
      const stageKeys = new Set();
      const stagePattern = new RegExp(`^cycles\\.${cKey}\\.stages\\.([^.]+)\\.`);
      for (const key of Object.keys(data)) {
        const match = key.match(stagePattern);
        if (match) stageKeys.add(match[1]);
      }
      const stages = {};
      for (const sKey of stageKeys) stages[sKey] = { name: data[`cycles.${cKey}.stages.${sKey}.name`] || '' };
      newCycles[cKey] = {
        name: data[`cycles.${cKey}.name`] || '',
        length: parseInt(data[`cycles.${cKey}.length`]) || 12,
        offset: parseInt(data[`cycles.${cKey}.offset`]) || 0,
        basedOn: data[`cycles.${cKey}.basedOn`] || 'month',
        stages
      };
    }
    this.#calendarData.cycles = newCycles;
  }

  /**
   * Update canonical hours from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateCanonicalHoursFromFormData(data) {
    const chKeys = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^canonicalHours\.([^.]+)\./);
      if (match) chKeys.add(match[1]);
    }
    const newCanonicalHours = {};
    for (const chKey of chKeys) {
      newCanonicalHours[chKey] = {
        name: data[`canonicalHours.${chKey}.name`] || '',
        abbreviation: data[`canonicalHours.${chKey}.abbreviation`] || '',
        startHour: parseInt(data[`canonicalHours.${chKey}.startHour`]) || 0,
        endHour: parseInt(data[`canonicalHours.${chKey}.endHour`]) || 0
      };
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
    this.#calendarData.weeks.type = data['weeks.type'] || 'year-based';
    this.#calendarData.weeks.repeat = !!data['weeks.repeat'];
    const wKeys = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^weeks\.names\.([^.]+)\./);
      if (match) wKeys.add(match[1]);
    }
    const newNames = {};
    const usedNumbers = new Set();
    for (const wKey of wKeys) {
      let weekNumber = parseInt(data[`weeks.names.${wKey}.weekNumber`]) || 1;
      if (usedNumbers.has(weekNumber)) {
        let next = weekNumber + 1;
        while (usedNumbers.has(next)) next++;
        weekNumber = next;
      }
      usedNumbers.add(weekNumber);
      newNames[wKey] = { name: data[`weeks.names.${wKey}.name`] || '', abbreviation: data[`weeks.names.${wKey}.abbreviation`] || '', weekNumber };
    }
    this.#calendarData.weeks.names = newNames;
  }

  /**
   * Update weather config from form data.
   * @param {object} data - Form data
   * @private
   */
  #updateWeatherFromFormData(data) {
    if (!this.#calendarData.weather) this.#calendarData.weather = { activeZone: null, zones: {}, autoGenerate: false };
    this.#calendarData.weather.autoGenerate = !!data['weather.autoGenerate'];

    // Update zone names from inline inputs
    const zonesObj = this.#calendarData.weather.zones ?? {};
    for (const key of Object.keys(zonesObj)) {
      const name = data[`weather.zones.${key}.name`];
      if (name !== undefined) zonesObj[key].name = name;
    }
  }

  /**
   * Add a new month after the target index.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddMonth(_event, target) {
    const afterKey = target.dataset.key;
    const totalMonths = Object.keys(this.#calendarData.months.values ?? {}).length + 1;
    const newKey = foundry.utils.randomID();
    const newMonth = {
      name: format('CALENDARIA.Editor.Default.MonthName', { num: totalMonths }),
      abbreviation: format('CALENDARIA.Editor.Default.MonthAbbr', { num: totalMonths }),
      ordinal: totalMonths,
      days: 30
    };
    if (afterKey) {
      this.#calendarData.months.values = this.#insertAfterKey(this.#calendarData.months.values, afterKey, newKey, newMonth);
    } else {
      this.#calendarData.months.values[newKey] = newMonth;
    }
    this.#reindexObject(this.#calendarData.months.values);
    this.render();
  }

  /**
   * Remove a month.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveMonth(_event, target) {
    const key = target.dataset.key;
    delete this.#calendarData.months.values[key];
    this.#reindexObject(this.#calendarData.months.values);
    this.render();
  }

  /**
   * Move month up in order.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveMonthUp(_event, target) {
    const key = target.dataset.key;
    const keys = Object.keys(this.#calendarData.months.values);
    const idx = keys.indexOf(key);
    if (idx > 0) {
      this.#calendarData.months.values = this.#swapObjectEntries(this.#calendarData.months.values, keys[idx - 1], key);
      this.#reindexObject(this.#calendarData.months.values);
      this.render();
    }
  }

  /**
   * Move month down in order.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveMonthDown(_event, target) {
    const key = target.dataset.key;
    const keys = Object.keys(this.#calendarData.months.values);
    const idx = keys.indexOf(key);
    if (idx < keys.length - 1) {
      this.#calendarData.months.values = this.#swapObjectEntries(this.#calendarData.months.values, key, keys[idx + 1]);
      this.#reindexObject(this.#calendarData.months.values);
      this.render();
    }
  }

  /**
   * Open custom weekdays dialog for a month.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onToggleCustomWeekdays(_event, target) {
    const key = target.dataset.key;
    const month = this.#calendarData.months.values[key];
    if (!month) return;
    const weekdayValues = month.weekdays ? Object.values(month.weekdays) : [];
    if (!weekdayValues.length) {
      const globalWeekdays = Object.values(this.#calendarData.days?.values ?? {});
      month.weekdays = {};
      for (const wd of globalWeekdays) {
        month.weekdays[foundry.utils.randomID()] = {
          name: wd.name || '',
          abbreviation: wd.abbreviation || '',
          isRestDay: !!wd.isRestDay
        };
      }
    }

    const rows = Object.entries(month.weekdays)
      .map(
        ([wdKey, wd]) => `
      <div class="custom-weekday-row">
        <input type="text" name="weekday-${wdKey}-name" value="${wd.name}" placeholder="${localize('CALENDARIA.Common.Name')}">
        <input type="text" name="weekday-${wdKey}-abbr" value="${wd.abbreviation}" placeholder="${localize('CALENDARIA.Common.Abbreviation')}">
        <input type="checkbox" name="weekday-${wdKey}-rest" ${wd.isRestDay ? 'checked' : ''}>
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
      window: { title: format('CALENDARIA.Editor.Month.CustomWeekdaysFor', { month: month.name }), contentClasses: ['custom-weekdays-dialog'] },
      content,
      buttons: [
        {
          action: 'disable',
          label: localize('CALENDARIA.Editor.Month.DisableCustomWeekdays'),
          icon: 'fas fa-undo',
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
            for (const [wdKey, wd] of Object.entries(month.weekdays)) {
              wd.name = form.querySelector(`[name="weekday-${wdKey}-name"]`)?.value || '';
              wd.abbreviation = form.querySelector(`[name="weekday-${wdKey}-abbr"]`)?.value || '';
              wd.isRestDay = form.querySelector(`[name="weekday-${wdKey}-rest"]`)?.checked || false;
            }
            const globalArr = Object.values(editor.#calendarData.days?.values ?? {});
            const monthArr = Object.values(month.weekdays);
            const isIdentical =
              monthArr.length === globalArr.length &&
              monthArr.every((wd, i) => wd.name === (globalArr[i]?.name || '') && wd.abbreviation === (globalArr[i]?.abbreviation || '') && wd.isRestDay === !!globalArr[i]?.isRestDay);
            if (isIdentical) delete month.weekdays;
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
    const afterKey = target.dataset.key;
    const totalDays = Object.keys(this.#calendarData.days.values ?? {}).length + 1;
    const newKey = foundry.utils.randomID();
    const newDay = {
      name: format('CALENDARIA.Editor.Default.DayName', { num: totalDays }),
      abbreviation: format('CALENDARIA.Editor.Default.DayAbbr', { num: totalDays }),
      ordinal: totalDays,
      isRestDay: false
    };
    if (afterKey) {
      this.#calendarData.days.values = this.#insertAfterKey(this.#calendarData.days.values, afterKey, newKey, newDay);
    } else {
      this.#calendarData.days.values[newKey] = newDay;
    }
    this.#reindexObject(this.#calendarData.days.values);
    this.render();
  }

  /**
   * Remove a weekday.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveWeekday(_event, target) {
    const key = target.dataset.key;
    if (Object.keys(this.#calendarData.days.values).length > 1) {
      delete this.#calendarData.days.values[key];
      this.#reindexObject(this.#calendarData.days.values);
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
    const key = target.dataset.key;
    const keys = Object.keys(this.#calendarData.days.values);
    const idx = keys.indexOf(key);
    if (idx > 0) {
      this.#calendarData.days.values = this.#swapObjectEntries(this.#calendarData.days.values, keys[idx - 1], key);
      this.#reindexObject(this.#calendarData.days.values);
      this.render();
    }
  }

  /**
   * Move a weekday down in the list.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onMoveWeekdayDown(_event, target) {
    const key = target.dataset.key;
    const keys = Object.keys(this.#calendarData.days.values);
    const idx = keys.indexOf(key);
    if (idx < keys.length - 1) {
      this.#calendarData.days.values = this.#swapObjectEntries(this.#calendarData.days.values, key, keys[idx + 1]);
      this.#reindexObject(this.#calendarData.days.values);
      this.render();
    }
  }

  /**
   * Add a new season after the target index.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddSeason(_event, target) {
    const afterKey = target.dataset.key;
    const totalSeasons = Object.keys(this.#calendarData.seasons.values ?? {}).length + 1;
    const isPeriodic = this.#calendarData.seasons.type === 'periodic';
    const newKey = foundry.utils.randomID();
    const newSeason = {
      name: format('CALENDARIA.Editor.Default.SeasonName', { num: totalSeasons }),
      abbreviation: format('CALENDARIA.Editor.Default.SeasonAbbr', { num: totalSeasons }),
      ordinal: totalSeasons
    };

    if (isPeriodic) {
      newSeason.duration = 91;
    } else {
      newSeason.monthStart = 1;
      newSeason.monthEnd = 3;
      newSeason.dayStart = null;
      newSeason.dayEnd = null;
    }

    if (afterKey) {
      this.#calendarData.seasons.values = this.#insertAfterKey(this.#calendarData.seasons.values, afterKey, newKey, newSeason);
    } else {
      this.#calendarData.seasons.values[newKey] = newSeason;
    }
    this.#reindexObject(this.#calendarData.seasons.values);
    this.render();
  }

  /**
   * Remove a season.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveSeason(_event, target) {
    const key = target.dataset.key;
    delete this.#calendarData.seasons.values[key];
    this.#reindexObject(this.#calendarData.seasons.values);
    this.render();
  }

  /**
   * Edit a season's icon and color via dialog.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onEditSeasonIcon(_event, target) {
    const key = target.dataset.key;
    const season = this.#calendarData.seasons.values[key];
    if (!season) return;

    const savedCalendar = this.#calendarId ? CalendarManager.getCalendar(this.#calendarId) : null;
    const savedSeason = savedCalendar?.seasons?.values?.[key];
    const savedIcon = savedSeason?.icon || '';
    const savedColor = savedSeason?.color || '#808080';

    const content = `
      <div class="form-group">
        <label>${localize('CALENDARIA.Common.Icon')}</label>
        <div class="form-fields">
          <input type="text" name="icon" value="${season.icon || ''}" placeholder="fas fa-leaf">
        </div>
        <p class="hint">${localize('CALENDARIA.Common.IconHint')}</p>
      </div>
      <div class="form-group">
        <label>${localize('CALENDARIA.Editor.Season.Color')}</label>
        <div class="form-fields">
          <input type="color" name="color" value="${season.color || '#808080'}">
        </div>
      </div>
    `;
    const editor = this;
    new foundry.applications.api.DialogV2({
      window: { title: format('CALENDARIA.Editor.Season.IconColorFor', { season: season.name }), contentClasses: ['calendaria', 'season-icon-dialog'] },
      content,
      buttons: [
        {
          action: 'reset',
          label: localize('CALENDARIA.Common.Reset'),
          icon: 'fas fa-undo',
          callback: () => {
            season.icon = savedIcon;
            season.color = savedColor;
            editor.render();
          }
        },
        {
          action: 'save',
          label: localize('CALENDARIA.Common.Save'),
          icon: 'fas fa-save',
          default: true,
          callback: (_event, _button, dialog) => {
            season.icon = dialog.element.querySelector('[name="icon"]')?.value || '';
            season.color = dialog.element.querySelector('[name="color"]')?.value || '#808080';
            editor.render();
          }
        }
      ],
      position: { width: 350 }
    }).render(true);
  }

  /**
   * Edit a season's climate settings.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static #onEditSeasonClimate(_event, target) {
    const key = target.dataset.key;
    const season = this.#calendarData.seasons.values[key];
    if (!season) return;
    const editor = this;
    ClimateEditor.open({
      mode: 'season',
      data: season,
      seasonKey: key,
      calendarId: this.#calendarId,
      calendarData: this.#calendarData,
      onSave: (result) => {
        season.climate = Object.keys(result.presets ?? {}).length || result.temperatures ? result : null;
        editor.render({ parts: ['weather'] });
      }
    });
  }

  /**
   * Add a new era after the target index.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddEra(_event, target) {
    const afterKey = target.dataset.key;
    const totalEras = Object.keys(this.#calendarData.eras ?? {}).length + 1;
    const newKey = foundry.utils.randomID();
    const newEra = {
      name: format('CALENDARIA.Editor.Default.EraName', { num: totalEras }),
      abbreviation: format('CALENDARIA.Editor.Default.EraAbbr', { num: totalEras }),
      startYear: 1,
      endYear: null,
      format: 'suffix',
      template: null
    };
    if (afterKey) {
      this.#calendarData.eras = this.#insertAfterKey(this.#calendarData.eras, afterKey, newKey, newEra);
    } else {
      this.#calendarData.eras[newKey] = newEra;
    }
    this.render();
  }

  /**
   * Remove an era.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveEra(_event, target) {
    const key = target.dataset.key;
    delete this.#calendarData.eras[key];
    this.render();
  }

  /**
   * Add a new festival after the target index.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddFestival(_event, target) {
    const afterKey = target.dataset.key;
    const totalFestivals = Object.keys(this.#calendarData.festivals ?? {}).length + 1;
    const newKey = foundry.utils.randomID();
    const newFestival = { name: format('CALENDARIA.Editor.Default.FestivalName', { num: totalFestivals }), month: 1, day: 1, description: '', color: '', icon: '' };
    if (afterKey) {
      this.#calendarData.festivals = this.#insertAfterKey(this.#calendarData.festivals, afterKey, newKey, newFestival);
    } else {
      this.#calendarData.festivals[newKey] = newFestival;
    }
    this.render();
  }

  /**
   * Remove a festival.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveFestival(_event, target) {
    const key = target.dataset.key;
    delete this.#calendarData.festivals[key];
    this.render();
  }

  /**
   * Open icon & color picker dialog for a festival.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onEditFestivalIcon(_event, target) {
    const key = target.dataset.key;
    const festival = this.#calendarData.festivals[key];
    if (!festival) return;

    const savedCalendar = this.#calendarId ? CalendarManager.getCalendar(this.#calendarId) : null;
    const savedFestival = savedCalendar?.festivals?.[key];
    const savedIcon = savedFestival?.icon || '';
    const savedColor = savedFestival?.color || '#d4af37';

    const content = `
      <div class="form-group">
        <label>${localize('CALENDARIA.Common.Icon')}</label>
        <div class="form-fields">
          <input type="text" name="icon" value="${festival.icon || ''}" placeholder="fas fa-star">
        </div>
        <p class="hint">${localize('CALENDARIA.Common.IconHint')}</p>
      </div>
      <div class="form-group">
        <label>${localize('CALENDARIA.Editor.Festival.Color')}</label>
        <div class="form-fields">
          <input type="color" name="color" value="${festival.color || '#d4af37'}">
        </div>
      </div>
    `;
    const editor = this;
    new foundry.applications.api.DialogV2({
      window: { title: format('CALENDARIA.Editor.Festival.IconColorFor', { festival: festival.name }), contentClasses: ['calendaria', 'season-icon-dialog'] },
      content,
      buttons: [
        {
          action: 'reset',
          label: localize('CALENDARIA.Common.Reset'),
          icon: 'fas fa-undo',
          callback: () => {
            festival.icon = savedIcon;
            festival.color = savedColor === '#d4af37' ? '' : savedColor;
            editor.render();
          }
        },
        {
          action: 'save',
          label: localize('CALENDARIA.Common.Save'),
          icon: 'fas fa-save',
          default: true,
          callback: (_event, _button, dialog) => {
            festival.icon = dialog.element.querySelector('[name="icon"]')?.value || '';
            const rawColor = dialog.element.querySelector('[name="color"]')?.value || '#d4af37';
            festival.color = rawColor.toLowerCase() === '#d4af37' ? '' : rawColor;
            editor.render();
          }
        }
      ],
      position: { width: 350 }
    }).render(true);
  }

  /**
   * Add a new moon.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Target element
   */
  static async #onAddMoon(_event, _target) {
    const newKey = foundry.utils.randomID();
    this.#calendarData.moons[newKey] = {
      name: localize('CALENDARIA.Common.Moon'),
      cycleLength: 28,
      cycleDayAdjust: 0,
      referencePhase: 0,
      phases: foundry.utils.deepClone(DEFAULT_MOON_PHASES),
      referenceDate: { year: 0, month: 0, day: 1 }
    };
    this.render();
  }

  /**
   * Remove a moon.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveMoon(_event, target) {
    const key = target.dataset.key;
    delete this.#calendarData.moons[key];
    this.render();
  }

  /**
   * Add a new phase to a moon.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddMoonPhase(_event, target) {
    const moonKey = target.dataset.moonKey;
    const moon = this.#calendarData.moons[moonKey];
    if (!moon) return;
    if (!moon.phases) moon.phases = foundry.utils.deepClone(DEFAULT_MOON_PHASES);
    const phasesArr = Object.values(moon.phases);
    const phaseCount = phasesArr.length;
    const newKey = foundry.utils.randomID();
    moon.phases[newKey] = {
      name: format('CALENDARIA.Editor.Default.PhaseName', { num: phaseCount + 1 }),
      rising: '',
      fading: '',
      icon: `${ASSETS.MOON_ICONS}/05_fullmoon.svg`,
      start: 0,
      end: 1
    };

    const allPhases = Object.values(moon.phases);
    const newCount = allPhases.length;
    const newInterval = 1 / newCount;
    let i = 0;
    for (const phase of allPhases) {
      phase.start = i * newInterval;
      phase.end = (i + 1) * newInterval;
      i++;
    }

    this.render();
  }

  /**
   * Remove a phase from a moon.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveMoonPhase(_event, target) {
    const moonKey = target.dataset.moonKey;
    const phaseKey = target.dataset.phaseKey;
    const moon = this.#calendarData.moons[moonKey];
    if (!moon?.phases || Object.keys(moon.phases).length <= 1) return;
    delete moon.phases[phaseKey];
    const allPhases = Object.values(moon.phases);
    const count = allPhases.length;
    const interval = 1 / count;
    let i = 0;
    for (const phase of allPhases) {
      phase.start = i * interval;
      phase.end = (i + 1) * interval;
      i++;
    }

    this.render();
  }

  /**
   * Pick a custom icon for a moon phase.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onPickMoonPhaseIcon(_event, target) {
    const moonKey = target.dataset.moonKey;
    const phaseKey = target.dataset.phaseKey;
    const moon = this.#calendarData.moons[moonKey];
    if (!moon) return;
    const currentIcon = moon.phases?.[phaseKey]?.icon || '';
    const picker = new foundry.applications.apps.FilePicker({
      type: 'image',
      current: currentIcon.startsWith('icons/') ? currentIcon : '',
      callback: (path) => {
        if (!moon.phases) moon.phases = foundry.utils.deepClone(DEFAULT_MOON_PHASES);
        moon.phases[phaseKey].icon = path;
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
    if (!this.#calendarData.cycles) this.#calendarData.cycles = {};
    const totalCycles = Object.keys(this.#calendarData.cycles).length + 1;
    const newKey = foundry.utils.randomID();
    const stageKey = foundry.utils.randomID();
    this.#calendarData.cycles[newKey] = {
      name: format('CALENDARIA.Editor.Default.CycleName', { num: totalCycles }),
      length: 12,
      offset: 0,
      basedOn: 'month',
      stages: { [stageKey]: { name: format('CALENDARIA.Editor.Default.CycleStage', { num: 1 }) } }
    };
    this.render();
  }

  /**
   * Remove a cycle.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveCycle(_event, target) {
    const key = target.dataset.key;
    delete this.#calendarData.cycles[key];
    this.render();
  }

  /**
   * Add a new stage to a cycle.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddCycleStage(_event, target) {
    const cycleKey = target.dataset.cycleKey;
    const cycle = this.#calendarData.cycles[cycleKey];
    if (!cycle) return;
    if (!cycle.stages) cycle.stages = {};
    const stageCount = Object.keys(cycle.stages).length + 1;
    cycle.stages[foundry.utils.randomID()] = { name: format('CALENDARIA.Editor.Default.CycleStage', { num: stageCount }) };
    this.render();
  }

  /**
   * Remove a stage from a cycle.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveCycleStage(_event, target) {
    const cycleKey = target.dataset.cycleKey;
    const stageKey = target.dataset.stageKey;
    const cycle = this.#calendarData.cycles[cycleKey];
    if (!cycle?.stages || Object.keys(cycle.stages).length === 0) return;
    delete cycle.stages[stageKey];
    this.render();
  }

  /**
   * Add a new canonical hour.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddCanonicalHour(_event, target) {
    if (!this.#calendarData.canonicalHours) this.#calendarData.canonicalHours = {};
    const afterKey = target.dataset.key;
    const totalHours = Object.keys(this.#calendarData.canonicalHours).length;
    const newKey = foundry.utils.randomID();
    const newHour = {
      name: format('CALENDARIA.Editor.Default.CanonicalHourName', { num: totalHours + 1 }),
      abbreviation: '',
      startHour: totalHours * 3,
      endHour: (totalHours + 1) * 3
    };
    if (afterKey) {
      this.#calendarData.canonicalHours = this.#insertAfterKey(this.#calendarData.canonicalHours, afterKey, newKey, newHour);
    } else {
      this.#calendarData.canonicalHours[newKey] = newHour;
    }
    this.render();
  }

  /**
   * Remove a canonical hour.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveCanonicalHour(_event, target) {
    const key = target.dataset.key;
    delete this.#calendarData.canonicalHours[key];
    this.render();
  }

  /**
   * Add a new named week.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddNamedWeek(_event, target) {
    if (!this.#calendarData.weeks) this.#calendarData.weeks = { type: 'year-based', repeat: false, names: {} };
    if (!this.#calendarData.weeks.names) this.#calendarData.weeks.names = {};
    const afterKey = target.dataset.key;
    const namesObj = this.#calendarData.weeks.names;
    const totalWeeks = Object.keys(namesObj).length;
    const existingNumbers = Object.values(namesObj)
      .map((w) => w.weekNumber)
      .filter((n) => n != null);
    const maxExisting = existingNumbers.length ? Math.max(...existingNumbers) : 0;
    const newKey = foundry.utils.randomID();
    const newWeek = {
      name: format('CALENDARIA.Editor.Default.WeekName', { num: totalWeeks + 1 }),
      abbreviation: '',
      weekNumber: maxExisting + 1
    };
    if (afterKey) {
      this.#calendarData.weeks.names = this.#insertAfterKey(namesObj, afterKey, newKey, newWeek);
    } else {
      namesObj[newKey] = newWeek;
    }
    this.render();
  }

  /**
   * Remove a named week.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onRemoveNamedWeek(_event, target) {
    const key = target.dataset.key;
    delete this.#calendarData.weeks.names[key];
    this.render();
  }

  /**
   * Parse named years from form data.
   * @param {object} data - Form data
   */
  #updateNamedYearsFromFormData(data) {
    const indices = Object.keys(data)
      .filter((k) => k.startsWith('years.names.') && k.endsWith('.year'))
      .map((k) => parseInt(k.split('.')[2]));
    if (!indices.length) {
      this.#calendarData.years.names = [];
      return;
    }
    this.#calendarData.years.names = indices
      .sort((a, b) => a - b)
      .map((idx) => ({
        year: parseInt(data[`years.names.${idx}.year`]) || 0,
        name: data[`years.names.${idx}.name`] || ''
      }));
  }

  /**
   * Add a named year.
   * @param {Event} _event - Triggering event
   * @param {HTMLElement} target - Button element
   */
  static async #onAddNamedYear(_event, target) {
    if (!this.#calendarData.years.names) this.#calendarData.years.names = [];
    const afterIdx = parseInt(target.dataset.index) ?? this.#calendarData.years.names.length - 1;
    const insertIdx = afterIdx + 1;
    const yearZero = this.#calendarData.years.yearZero ?? 0;
    this.#calendarData.years.names.splice(insertIdx, 0, { year: yearZero, name: '' });
    this.render();
  }

  /**
   * Remove a named year.
   * @param {Event} _event - Triggering event
   * @param {HTMLElement} target - Button element
   */
  static async #onRemoveNamedYear(_event, target) {
    const idx = parseInt(target.dataset.index);
    this.#calendarData.years.names.splice(idx, 1);
    this.render();
  }

  /**
   * Toggle a weather category's collapsed state.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */

  /**
   * Add a new climate zone after the target key.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onAddZone(_event, target) {
    const afterKey = target.dataset.key;
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
    const seasonNames = Object.values(this.#calendarData.seasons?.values ?? {}).map((s) => s.name);
    if (!seasonNames.length) seasonNames.push('CALENDARIA.Season.Spring', 'CALENDARIA.Season.Summer', 'CALENDARIA.Season.Autumn', 'CALENDARIA.Season.Winter');
    const zoneConfig = getDefaultZoneConfig(result.template, seasonNames);
    if (!zoneConfig) return;
    const baseId = result.name?.toLowerCase().replace(/\s+/g, '-') || result.template;
    let zoneId = baseId;
    let counter = 1;
    const existingIds = Object.values(this.#calendarData.weather?.zones ?? {}).map((z) => z.id);
    while (existingIds.includes(zoneId)) zoneId = `${baseId}-${counter++}`;
    zoneConfig.id = zoneId;
    zoneConfig.name = result.name || localize(CLIMATE_ZONE_TEMPLATES[result.template]?.name || result.template);
    if (!this.#calendarData.weather) this.#calendarData.weather = { activeZone: null, zones: {}, autoGenerate: false };
    if (!this.#calendarData.weather.zones) this.#calendarData.weather.zones = {};
    const zoneKey = foundry.utils.randomID();
    const isFirst = !Object.keys(this.#calendarData.weather.zones).length;
    if (afterKey) {
      this.#calendarData.weather.zones = this.#insertAfterKey(this.#calendarData.weather.zones, afterKey, zoneKey, zoneConfig);
    } else {
      this.#calendarData.weather.zones[zoneKey] = zoneConfig;
    }
    if (isFirst) this.#calendarData.weather.activeZone = zoneConfig.id;
    this.render();
  }

  /**
   * Edit a climate zone's weather configuration.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static #onEditZoneClimate(_event, target) {
    const zoneKey = target.dataset.key;
    const zone = this.#calendarData.weather?.zones?.[zoneKey];
    if (!zone) return;
    const seasonNames = Object.values(this.#calendarData.seasons?.values ?? {}).map((s) => s.name);
    const editor = this;
    ClimateEditor.open({
      mode: 'zone',
      data: zone,
      zoneKey,
      calendarId: this.#calendarId,
      calendarData: this.#calendarData,
      seasonNames,
      onSave: (result) => {
        zone.description = result.description;
        zone.brightnessMultiplier = result.brightnessMultiplier;
        zone.latitude = result.latitude;
        zone.shortestDay = result.shortestDay;
        zone.longestDay = result.longestDay;
        zone.environmentBase = result.environmentBase;
        zone.environmentDark = result.environmentDark;
        zone.temperatures = result.temperatures;
        zone.presets = result.presets;
        editor.render({ parts: ['weather'] });
      }
    });
  }

  /**
   * Set the active climate zone (mutual exclusion).
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Checkbox element
   */
  static #onSetActiveZone(_event, target) {
    const zoneKey = target.dataset.key;
    const zone = this.#calendarData.weather?.zones?.[zoneKey];
    if (!zone) return;
    this.#calendarData.weather.activeZone = zone.id;
    this.render({ parts: ['weather'] });
  }

  /**
   * Delete a climate zone.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onDeleteZone(_event, target) {
    const zoneKey = target.dataset.key;
    const zonesObj = this.#calendarData.weather?.zones ?? {};
    const zone = zonesObj[zoneKey];
    if (!zone) return;

    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Editor.Weather.Zone.Delete') },
      content: `<p>${format('CALENDARIA.Editor.Weather.Zone.DeleteConfirm', { name: zone.name })}</p>`
    });

    if (!confirm) return;
    const wasActive = this.#calendarData.weather.activeZone === zone.id;
    delete zonesObj[zoneKey];
    if (wasActive) {
      const firstRemaining = Object.values(zonesObj)[0];
      this.#calendarData.weather.activeZone = firstRemaining?.id ?? null;
    }
    this.render();
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
   * Open the Token Reference Dialog.
   * @param {PointerEvent} _event - Click event
   * @param {HTMLElement} target - Target element
   */
  static #onShowTokenReference(_event, target) {
    const contextType = target.dataset.contextType || 'all';
    TokenReferenceDialog.open({ contextType });
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
    if (!this.#calendarData.seasons) this.#calendarData.seasons = { values: {} };
    if (!this.#calendarData.eras) this.#calendarData.eras = {};
    if (!this.#calendarData.festivals) this.#calendarData.festivals = {};
    if (!this.#calendarData.moons) this.#calendarData.moons = {};
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
   * Reindex ordinal values in a keyed object.
   * @param {object} obj - Keyed object to reindex
   * @private
   */
  #reindexObject(obj) {
    let idx = 0;
    for (const key of Object.keys(obj)) {
      obj[key].ordinal = ++idx;
    }
  }

  /**
   * Swap two adjacent entries in a keyed object, preserving insertion order.
   * @param {object} obj - Keyed object
   * @param {string} keyA - First key to swap
   * @param {string} keyB - Second key to swap
   * @returns {object} New object with swapped entries
   * @private
   */
  #swapObjectEntries(obj, keyA, keyB) {
    const entries = Object.entries(obj);
    const idxA = entries.findIndex(([k]) => k === keyA);
    const idxB = entries.findIndex(([k]) => k === keyB);
    if (idxA < 0 || idxB < 0) return obj;
    [entries[idxA], entries[idxB]] = [entries[idxB], entries[idxA]];
    return Object.fromEntries(entries);
  }

  /**
   * Insert a new entry into a keyed object after the given key.
   * @param {object} obj - Keyed object
   * @param {string} afterKey - Key to insert after
   * @param {string} newKey - New entry key
   * @param {*} newValue - New entry value
   * @returns {object} New object with inserted entry
   * @private
   */
  #insertAfterKey(obj, afterKey, newKey, newValue) {
    const entries = Object.entries(obj);
    const idx = entries.findIndex(([k]) => k === afterKey);
    entries.splice(idx + 1, 0, [newKey, newValue]);
    return Object.fromEntries(entries);
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
