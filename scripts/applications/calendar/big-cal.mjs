/**
 * Standalone application for displaying the calendar UI.
 * @module Applications/BigCal
 * @author Tyler
 */

import { CalendarManager, CalendarRegistry, getEquivalentDates } from '../../calendar/_module.mjs';
import { HOOKS, MODULE, REPLACEABLE_ELEMENTS, SETTINGS, SOCKET_TYPES, TEMPLATES, WIDGET_POINTS } from '../../constants.mjs';
import { FestivalManager } from '../../festivals/_module.mjs';
import {
  NoteManager,
  addDays,
  clearDisplayPropsCache,
  dayOfWeek,
  enrichNoteForDisplay,
  extractNoteMatchData,
  getEffectiveDuration,
  isRecurringMatch,
  resolveNoteDisplayProps,
  topologicalSortNotes
} from '../../notes/_module.mjs';
import { TimeClock } from '../../time/_module.mjs';
import {
  CalendariaSocket,
  attachWidgetListeners,
  buildOpenAppsMenuItem,
  buildWeatherLookup,
  buildWeatherPillData,
  canViewBigCal,
  enrichSeasonData,
  format,
  formatForLocation,
  generateDayTooltip,
  getAllMoonPhases,
  getCalendarNotes,
  getDayWeather,
  getFestivalNoteForDay,
  getLeadingDays,
  getVisibleMoons,
  getVisibleNotes,
  hasFogRevealedMonthInDirection,
  hasMoonIconMarkers,
  hasWidgetsForPoint,
  isCombatBlocked,
  isFogEnabled,
  isMonthFullyFogged,
  isRevealed,
  localize,
  renderCycleIndicator,
  renderEraIndicator,
  renderMoonIcons,
  renderReplacementOrOriginal,
  renderSeasonIndicator,
  renderWeatherIndicator,
  renderWidgetsForPoint,
  setVisibleMoons,
  setupDayContextMenu,
  showMoonPicker,
  warnShowToAll
} from '../../utils/_module.mjs';
import { WeatherManager } from '../../weather/_module.mjs';
import { MiniCal, NoteViewer, SecondaryCalendar, SettingsPanel, WeatherPickerApp } from '../_module.mjs';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** @type {number} Max moon icons visible per day cell before overflow. */
const MAX_VISIBLE_MOONS = 3;

/**
 * Process moon phases array for display with overflow handling.
 * @param {object[]|null} phases - Array of moon phase objects
 * @returns {object|null} Processed object with visible, overflow, and overflowTooltip
 */
function processMoonPhases(phases) {
  if (!phases?.length) return null;
  const override = getVisibleMoons();
  let ordered = phases;
  if (override?.length && phases.length > MAX_VISIBLE_MOONS) {
    const phaseMap = new Map(phases.map((m) => [m.moonName, m]));
    const prioritized = override.map((name) => phaseMap.get(name)).filter(Boolean);
    const prioritizedSet = new Set(override);
    const rest = phases.filter((m) => !prioritizedSet.has(m.moonName));
    ordered = [...prioritized, ...rest];
  }
  if (ordered.length <= MAX_VISIBLE_MOONS) return { visible: ordered, overflow: [], overflowTooltip: '', overflowTooltipText: '' };
  const visible = ordered.slice(0, MAX_VISIBLE_MOONS);
  const overflow = ordered.slice(MAX_VISIBLE_MOONS);
  const overflowTooltip = overflow.map((m) => `<div class='moon-tooltip-row'><img src='${m.icon}'><span>${m.moonName}: ${m.phaseName}</span></div>`).join('');
  const overflowTooltipText = overflow.map((m) => `${m.moonName}: ${m.phaseName}`).join(', ');
  return { visible, overflow, overflowTooltip, overflowTooltipText };
}

/**
 * Calendar Application - displays the calendar UI.
 * @extends ApplicationV2
 */
export class BigCal extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options - Application options
   */
  constructor(options = {}) {
    super(options);
    this._viewedDate = null;
    this._calendarId = options.calendarId || null;
    this._displayMode = 'month';
    this._selectedDate = null;
    this._selectedTimeSlot = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-big-cal',
    classes: ['calendaria', 'big-cal'],
    tag: 'div',
    window: { frame: false, positioned: true },
    actions: {
      navigate: BigCal._onNavigate,
      today: BigCal._onToday,
      addNote: BigCal._onAddNote,
      addNoteToday: BigCal._onAddNoteToday,
      editNote: BigCal._onEditNote,
      deleteNote: BigCal._onDeleteNote,
      changeView: BigCal._onChangeView,
      selectDay: BigCal._onSelectDay,
      selectMonth: BigCal._onSelectMonth,
      setAsCurrentDate: BigCal._onSetAsCurrentDate,
      selectTimeSlot: BigCal._onSelectTimeSlot,
      toggleCompact: BigCal._onToggleCompact,
      openWeatherPicker: BigCal._onOpenWeatherPicker,
      openNoteViewer: BigCal._onOpenNoteViewer,
      openChronicle: BigCal._onOpenChronicle,
      openSettings: BigCal._onOpenSettings,
      navigateToMonth: BigCal._onNavigateToMonth,
      moonClick: BigCal._onMoonClick,
      closeBigCal: BigCal._onCloseBigCal,
      openSecondaryCalendar: BigCal._onOpenSecondaryCalendar
    },
    position: { width: 'auto', height: 'auto' }
  };

  /** @override */
  static PARTS = { header: { template: TEMPLATES.SHEETS.CALENDAR_HEADER }, content: { template: TEMPLATES.SHEETS.CALENDAR_CONTENT } };

  /** @override */
  async render(options = {}, _options = {}) {
    if (!canViewBigCal()) {
      if (!options.silent) ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return this;
    }
    Hooks.callAll(HOOKS.PRE_RENDER_CALENDAR, { app: this, displayMode: this._displayMode, calendar: CalendarManager.getActiveCalendar() });
    return super.render(options, _options);
  }

  /** @override */
  async close(options = {}) {
    if (!options.combat && !game.user.isGM && game.settings.get(MODULE.ID, SETTINGS.FORCE_BIG_CAL)) {
      ui.notifications.warn('CALENDARIA.Common.ForcedDisplayWarning', { localize: true });
      return;
    }
    return super.close(options);
  }

  /** @override */
  get title() {
    return this.calendar?.name || '';
  }

  /**
   * Get the calendar to display
   * @returns {object} The active calendar or specified calendar
   */
  get calendar() {
    return this._calendarId ? CalendarManager.getCalendar(this._calendarId) : CalendarManager.getActiveCalendar();
  }

  /**
   * Get the date being viewed/displayed in the calendar
   * @returns {object} The currently viewed date with year, month, dayOfMonth (0-indexed)
   */
  get viewedDate() {
    if (this._viewedDate) return this._viewedDate;
    const components = game.time.components;
    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;
    return { ...components, year: components.year + yearZero, dayOfMonth: components.dayOfMonth ?? 0 };
  }

  /**
   * Set the viewed date.
   * @param {object} date - The date to view
   */
  set viewedDate(date) {
    this._viewedDate = date;
  }

  /**
   * Navigate the calendar view to a specific date and select it.
   * @param {object} date - Date to select {year, month, dayOfMonth} (all 0-indexed internally)
   */
  selectDate(date) {
    this._viewedDate = { year: date.year, month: date.month, dayOfMonth: date.dayOfMonth ?? 0 };
    this._selectedDate = { year: date.year, month: date.month, dayOfMonth: date.dayOfMonth ?? 0 };
  }

  /** @override */
  bringToFront() {
    if (!this.element) return;
    this.position.zIndex = ++ApplicationV2._maxZ;
    this.element.style.zIndex = String(this.position.zIndex);
    ui.activeWindow = this;
  }

  /**
   * Prepare context data for rendering.
   * @param {object} options - Render options
   * @returns {Promise<object>} The prepared context
   * @override
   */
  async _prepareContext(options) {
    clearDisplayPropsCache();
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const viewedDate = this.viewedDate;
    context.editable = game.user.isGM;
    context.canAddNotes = true;
    context.showChronicleButton = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_BIG_CAL_BUTTON);
    context.calendar = calendar;
    context.viewedDate = viewedDate;
    context.displayMode = this._displayMode;
    context.selectedDate = this._selectedDate;
    context.selectedTimeSlot = this._selectedTimeSlot;
    const today = game.time.components;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const todayYear = today.year + yearZero;
    const todayMonth = today.month;
    const todayDayOfMonth = today.dayOfMonth ?? 0;
    if (this._selectedDate) context.isToday = this._selectedDate.year === todayYear && this._selectedDate.month === todayMonth && this._selectedDate.dayOfMonth === todayDayOfMonth;
    else context.isToday = true;
    context.disableSetCurrentDate = !this._selectedDate || context.isToday;
    const allNotes = getCalendarNotes();
    context.notes = allNotes;
    context.visibleNotes = topologicalSortNotes(getVisibleNotes(allNotes));
    if (calendar) {
      switch (this._displayMode) {
        case 'week':
          context.calendarData = this._generateWeekData(calendar, viewedDate, context.visibleNotes);
          break;
        case 'year':
          context.calendarData = this._generateYearData(calendar, viewedDate);
          break;
        default:
          context.calendarData = this._generateCalendarData(calendar, viewedDate, context.visibleNotes);
          break;
      }
    }
    if (!game.user.isGM && isFogEnabled() && game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_NAV_MODE) === 'skip') {
      context.fogNavDisablePrev = !hasFogRevealedMonthInDirection(viewedDate.year, viewedDate.month, -1, calendar);
      context.fogNavDisableNext = !hasFogRevealedMonthInDirection(viewedDate.year, viewedDate.month, 1, calendar);
    }
    context.currentMonthNotes = this._getNotesForMonth(context.visibleNotes, viewedDate.year, viewedDate.month);
    context.showMoonPhases = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_MOON_PHASES);
    context.weather = this._getWeatherContext();
    context.showWeather = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_WEATHER);
    context.showSeason = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_SEASON);
    context.showEra = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_ERA);
    context.showCycles = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_CYCLES);
    context.weatherDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_WEATHER_DISPLAY_MODE);
    context.seasonDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SEASON_DISPLAY_MODE);
    context.eraDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_ERA_DISPLAY_MODE);
    context.cyclesDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_CYCLES_DISPLAY_MODE);
    if (calendar.cyclesArray?.length && context.showCycles) {
      const yearZeroOffset = calendar.years?.yearZero ?? 0;
      const viewedComponents = { year: viewedDate.year - yearZeroOffset, month: viewedDate.month, dayOfMonth: viewedDate.dayOfMonth ?? 0, hour: 12, minute: 0, second: 0 };
      const cycleResult = calendar.getCycleValues(viewedComponents);
      context.cycleText = cycleResult.text;
      context.cycleValues = cycleResult.values;
      context.cycleData = cycleResult;
    }
    const eqCalendars = game.settings.get(MODULE.ID, SETTINGS.EQUIVALENT_DATE_CALENDARS);
    if (eqCalendars.size) {
      const activeId = CalendarRegistry.getActiveId();
      const equivalents = getEquivalentDates({ year: viewedDate.year, month: viewedDate.month, dayOfMonth: viewedDate.dayOfMonth ?? 0 }, activeId, [...eqCalendars]);
      if (equivalents.length) context.equivalentDates = equivalents.map((eq) => ({ label: eq.formatted, tooltip: eq.calendarName, calendarId: eq.calendarId }));
    }
    context.widgets = this._prepareWidgetContext(context);
    return context;
  }

  /**
   * Prepare widget context for template rendering.
   * @param {object} context - The template context
   * @returns {object} Widget context
   */
  _prepareWidgetContext(context) {
    const widgets = {};
    widgets.actions = renderWidgetsForPoint(WIDGET_POINTS.BIGCAL_ACTIONS, 'bigcal');
    const weatherObj = context.showWeather && context.weather ? { ...context.weather, icon: this._normalizeWeatherIcon(context.weather.icon) } : null;
    widgets.weatherIndicator = renderReplacementOrOriginal(
      REPLACEABLE_ELEMENTS.WEATHER_INDICATOR,
      renderWeatherIndicator({ weather: weatherObj, displayMode: context.weatherDisplayMode, canInteract: context.editable, showBlock: context.showWeather && context.editable }),
      'bigcal'
    );
    const season = context.showSeason ? this._normalizeSeasonData(context.calendarData?.currentSeason) : null;
    widgets.seasonIndicator = renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.SEASON_INDICATOR, renderSeasonIndicator({ season, displayMode: context.seasonDisplayMode }), 'bigcal');
    const era = context.showEra ? this._normalizeEraData(context.calendarData?.currentEra) : null;
    widgets.eraIndicator = renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.ERA_INDICATOR, renderEraIndicator({ era, displayMode: context.eraDisplayMode }), 'bigcal');
    const cycleData = context.showCycles ? context.cycleData : null;
    widgets.cycleIndicator = renderReplacementOrOriginal(
      REPLACEABLE_ELEMENTS.CYCLE_INDICATOR,
      renderCycleIndicator({ cycleData, displayMode: context.cyclesDisplayMode, cycleText: context.cycleText }),
      'bigcal'
    );
    widgets.indicators = renderWidgetsForPoint(WIDGET_POINTS.HUD_INDICATORS, 'bigcal');
    widgets.hasIndicators = hasWidgetsForPoint(WIDGET_POINTS.HUD_INDICATORS);
    return widgets;
  }

  /**
   * Normalize weather icon to include font-awesome class prefix.
   * @param {string} icon - Raw icon class
   * @returns {string} Normalized icon class
   */
  _normalizeWeatherIcon(icon) {
    if (!icon) return 'fas fa-cloud';
    if (icon.includes('fa-solid') || icon.includes('fa-regular') || icon.includes('fa-light') || icon.includes('fas ') || icon.includes('far ')) return icon;
    return `fas ${icon}`;
  }

  /**
   * Normalize season data for shared indicator function.
   * @param {object|null} season - Raw season data
   * @returns {object|null} Normalized season with localized name
   */
  _normalizeSeasonData(season) {
    if (!season) return null;
    return { name: localize(season.name), icon: season.icon || 'fas fa-sun', color: season.color || '#888' };
  }

  /**
   * Normalize era data for shared indicator function.
   * @param {object|null} era - Raw era data
   * @returns {object|null} Normalized era with localized name and abbreviation
   */
  _normalizeEraData(era) {
    if (!era) return null;
    return { name: localize(era.name), abbreviation: localize(era.abbreviation || era.name) };
  }

  /**
   * Abbreviate month name if longer than 5 characters
   * @param {string} monthName - Full month name
   * @returns {{full: string, abbrev: string, useAbbrev: boolean}} Abbreviation data
   */
  _abbreviateMonthName(monthName) {
    if (!monthName) return { full: '', abbrev: '', useAbbrev: false };
    const full = monthName;
    const useAbbrev = monthName.length > 5;
    if (!useAbbrev) return { full, abbrev: full, useAbbrev: false };
    const words = monthName.split(' ');
    const abbrev = words.map((word) => word.charAt(0).toUpperCase()).join('');
    return { full, abbrev, useAbbrev: true };
  }

  /**
   * Generate calendar grid data for month view.
   * @param {object} calendar - The calendar configuration
   * @param {object} date - The date being viewed
   * @param {Array} notes - Calendar notes to display
   * @returns {object} Calendar grid data for rendering
   */
  _generateCalendarData(calendar, date, notes) {
    if (calendar.isMonthless) return this._generateMonthlessWeekData(calendar, date, notes);
    const { year, month } = date;
    const monthData = calendar.monthsArray[month];
    if (!monthData) return null;
    const yearZero = calendar.years?.yearZero ?? 0;
    const internalYear = year - yearZero;
    const daysInMonth = calendar.getDaysInMonth(month, internalYear);
    const daysInWeek = calendar.daysInWeek;
    const weeks = [];
    let currentWeek = [];
    const showMoons = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_MOON_PHASES) && calendar.moonsArray.length;
    const hasFixedStart = monthData?.startingWeekday != null;
    const startDayOfWeek = hasFixedStart ? monthData.startingWeekday : dayOfWeek({ year, month, dayOfMonth: 0 });
    if (startDayOfWeek > 0) {
      const prevDays = getLeadingDays(calendar, year, month, startDayOfWeek);
      for (const pd of prevDays) currentWeek.push({ ...pd, isToday: this._isToday(pd.year, pd.month, pd.dayOfMonth) });
    }
    const showWeatherIcons = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_WEATHER);
    let weatherLookup = null;
    if (showWeatherIcons) weatherLookup = buildWeatherLookup();
    const intercalaryDays = [];
    let dayIndex = startDayOfWeek;
    const fogEnabled = isFogEnabled();
    for (let dayOfMonth = 0; dayOfMonth < daysInMonth; dayOfMonth++) {
      const displayDay = dayOfMonth + 1;
      const isFogged = fogEnabled && !isRevealed(year, month, dayOfMonth);
      const dayNotes = isFogged ? [] : this._getNotesForDay(notes, year, month, dayOfMonth);
      const fi = isFogged ? null : getFestivalNoteForDay(notes, year, month, dayOfMonth);
      let moonPhases = null;
      if (showMoons && !isFogged) {
        const dayComponents = { year: internalYear, month, dayOfMonth, hour: 12, minute: 0, second: 0 };
        const dayWorldTime = calendar.componentsToTime(dayComponents);
        moonPhases = calendar.moonsArray
          .map((moon, index) => {
            const phase = calendar.getMoonPhase(index, dayWorldTime);
            if (!phase) return null;
            return { moonName: localize(moon.name), phaseName: phase.subPhaseName || localize(phase.name), icon: phase.icon, color: moon.color || null };
          })
          .filter(Boolean)
          .sort((a, b) => a.moonName.localeCompare(b.moonName));
        moonPhases = processMoonPhases(moonPhases);
      }
      const isIntercalary = fi && !fi.countsForWeekday;
      const festivalInfo = fi ? { name: fi.name, description: fi.description, color: fi.color, position: fi.position } : null;
      if (isIntercalary) {
        const wd = !isFogged && weatherLookup ? getDayWeather(year, month, dayOfMonth, weatherLookup, weatherLookup.lookup) : null;
        intercalaryDays.push({
          day: displayDay,
          dayOfMonth,
          year,
          month,
          isFogged,
          isToday: this._isToday(year, month, dayOfMonth),
          isSelected: this._isSelected(year, month, dayOfMonth),
          notes: dayNotes,
          isFestival: !isFogged && !!fi?.showVisuals,
          festivalName: !isFogged && fi?.showVisuals ? fi.name : '',
          festivalColor: !isFogged && fi?.showVisuals ? fi.color : '',
          festivalIcon: !isFogged && fi?.showVisuals ? fi.icon : '',
          festivalDescription: !isFogged ? fi?.description || '' : '',
          festivalNoteId: !isFogged ? fi?.note?.id || '' : '',
          dayTooltip: isFogged ? '' : generateDayTooltip(calendar, year, month, dayOfMonth, festivalInfo, wd, dayNotes),
          moonPhases,
          isIntercalary: true,
          ...buildWeatherPillData(isFogged ? null : wd)
        });
      } else {
        const weekdayData = calendar.weekdaysArray[currentWeek.length];
        const wd = !isFogged && weatherLookup ? getDayWeather(year, month, dayOfMonth, weatherLookup, weatherLookup.lookup) : null;
        currentWeek.push({
          day: displayDay,
          dayOfMonth,
          year,
          month,
          isFogged,
          isToday: this._isToday(year, month, dayOfMonth),
          isSelected: this._isSelected(year, month, dayOfMonth),
          notes: dayNotes,
          isOddDay: dayIndex % 2 === 1,
          isFestival: !isFogged && !!fi?.showVisuals,
          festivalName: !isFogged && fi?.showVisuals ? fi.name : '',
          festivalColor: !isFogged && fi?.showVisuals ? fi.color : '',
          festivalIcon: !isFogged && fi?.showVisuals ? fi.icon : '',
          festivalDescription: !isFogged ? fi?.description || '' : '',
          festivalNoteId: !isFogged ? fi?.note?.id || '' : '',
          dayTooltip: isFogged ? '' : generateDayTooltip(calendar, year, month, dayOfMonth, festivalInfo, wd, dayNotes),
          isRestDay: weekdayData?.isRestDay || false,
          moonPhases,
          ...buildWeatherPillData(isFogged ? null : wd)
        });
        dayIndex++;
        if (currentWeek.length === daysInWeek) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
    }
    const lastRegularWeekLength = currentWeek.length;
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    if (intercalaryDays.length > 0) {
      weeks.push({ isIntercalaryRow: true, days: intercalaryDays });
      currentWeek = [];
    }
    const lastRegularWeek = weeks.filter((w) => !w.isIntercalaryRow).pop();
    const needsNextMonth = intercalaryDays.length > 0 || (lastRegularWeek && lastRegularWeek.length < daysInWeek);
    if (needsNextMonth) {
      const totalMonths = calendar.monthsArray.length ?? 12;
      const startPosition = intercalaryDays.length > 0 ? lastRegularWeekLength : lastRegularWeek?.length || 0;
      let remainingSlots = daysInWeek - startPosition;
      let checkMonth = month;
      let checkYear = year;
      let dayInMonth = 1;
      checkMonth = checkMonth === totalMonths - 1 ? 0 : checkMonth + 1;
      if (checkMonth === 0) checkYear++;
      if (intercalaryDays.length > 0 && startPosition > 0) for (let i = 0; i < startPosition; i++) currentWeek.push({ empty: true });
      while (remainingSlots > 0) {
        const checkMonthDays = calendar.getDaysInMonth(checkMonth, checkYear - yearZero);
        const festivalDay = calendar.findFestivalDay({ year: checkYear - yearZero, month: checkMonth, dayOfMonth: dayInMonth - 1 });
        const isIntercalary = festivalDay?.countsForWeekday === false;
        if (!isIntercalary) {
          currentWeek.push({ day: dayInMonth, dayOfMonth: dayInMonth - 1, year: checkYear, month: checkMonth, isFromOtherMonth: true, isToday: this._isToday(checkYear, checkMonth, dayInMonth - 1) });
          remainingSlots--;
        }
        dayInMonth++;
        if (dayInMonth > checkMonthDays && remainingSlots > 0) {
          checkMonth = checkMonth === totalMonths - 1 ? 0 : checkMonth + 1;
          if (checkMonth === 0) checkYear++;
          dayInMonth = 1;
        }
      }
      if (intercalaryDays.length > 0) weeks.push(currentWeek);
      else if (lastRegularWeek) lastRegularWeek.push(...currentWeek);
    }
    const allMultiDayEvents = this._findMultiDayEvents(notes, year, month, startDayOfWeek, daysInWeek, daysInMonth);
    weeks.forEach((week, weekIndex) => {
      week.multiDayEvents = allMultiDayEvents.filter((e) => e.weekIndex === weekIndex);
    });
    const seasonDay = this._selectedDate ?? date;
    const currentSeason = enrichSeasonData(calendar.getCurrentSeason?.(seasonDay));
    const currentEra = calendar.getCurrentEra?.();
    const monthWeekdays = calendar.getWeekdaysForMonth?.(month) ?? calendar.weekdaysArray ?? [];
    const weekdaysData = monthWeekdays.map((wd) => ({ name: localize(wd.name), isRestDay: wd.isRestDay || false }));
    const showSelectedInHeader = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_HEADER_SHOW_SELECTED);
    const headerDate = showSelectedInHeader && this._selectedDate ? this._selectedDate : { year, month, dayOfMonth: date.dayOfMonth };
    const headerComponents = { year: headerDate.year, month: headerDate.month, dayOfMonth: headerDate.dayOfMonth ?? 0 };
    const rawHeader = formatForLocation(calendar, headerComponents, 'bigCalHeader');
    const formattedHeader = hasMoonIconMarkers(rawHeader) ? renderMoonIcons(rawHeader) : rawHeader;
    return {
      year,
      month,
      monthName: localize(monthData.name),
      yearDisplay: String(year),
      formattedHeader,
      formattedHeaderHtml: hasMoonIconMarkers(rawHeader),
      weeks,
      weekdays: weekdaysData,
      daysInWeek,
      currentSeason,
      currentEra
    };
  }

  /**
   * Generate week-based view data for monthless calendars.
   * @param {object} calendar - The calendar configuration
   * @param {object} date - The date being viewed (year, day for monthless)
   * @param {Array} notes - Calendar notes to display
   * @returns {object} Week view data for rendering
   */
  _generateMonthlessWeekData(calendar, date, notes) {
    const { year } = date;
    const viewedDayOfMonth = date.dayOfMonth ?? 0;
    const daysInWeek = calendar.daysInWeek;
    const yearZero = calendar.years?.yearZero ?? 0;
    const daysInYear = calendar.getDaysInYear(year - yearZero);
    const showMoons = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_MOON_PHASES) && calendar.moonsArray.length;
    const fogEnabled = isFogEnabled();
    const weekNumber = Math.floor(viewedDayOfMonth / daysInWeek);
    const totalWeeks = Math.ceil(daysInYear / daysInWeek);
    const weeks = [];
    for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
      const targetWeek = weekNumber + weekOffset;
      const weekStartDay = targetWeek * daysInWeek + 1;
      const currentWeek = [];
      for (let i = 0; i < daysInWeek; i++) {
        let dayNum = weekStartDay + i;
        let dayYear = year;
        const targetYearDays = calendar.getDaysInYear(dayYear - yearZero);
        if (dayNum > targetYearDays) {
          dayNum -= targetYearDays;
          dayYear++;
        } else if (dayNum < 1) {
          const prevYearDays = calendar.getDaysInYear(dayYear - yearZero - 1);
          dayNum += prevYearDays;
          dayYear--;
        }
        const dayInternalYear = dayYear - yearZero;
        const dayOfMonth = dayNum - 1;
        const dayIsFogged = fogEnabled && !isRevealed(dayYear, 0, dayOfMonth);
        const dayNotes = dayIsFogged ? [] : this._getNotesForDay(notes, dayYear, 0, dayOfMonth);
        const festivalDay = dayIsFogged ? null : calendar.findFestivalDay({ year: dayInternalYear, month: 0, dayOfMonth });
        const isIntercalary = festivalDay?.countsForWeekday === false;
        let moonPhases = null;
        if (showMoons && !dayIsFogged) {
          const dayComponents = { year: dayInternalYear, month: 0, dayOfMonth, hour: 12, minute: 0, second: 0 };
          const dayWorldTime = calendar.componentsToTime(dayComponents);
          moonPhases = calendar.moonsArray
            .map((moon, index) => {
              const phase = calendar.getMoonPhase(index, dayWorldTime);
              if (!phase) return null;
              return { moonName: localize(moon.name), phaseName: phase.subPhaseName || localize(phase.name), icon: phase.icon, color: moon.color || null };
            })
            .filter(Boolean)
            .sort((a, b) => a.moonName.localeCompare(b.moonName));
          moonPhases = processMoonPhases(moonPhases);
        }
        const weekdayData = calendar.weekdaysArray[i % daysInWeek];
        const festivalNoteId = this._getFestivalNoteId(festivalDay, calendar);
        const dayData = {
          day: dayNum,
          dayOfMonth,
          year: dayYear,
          month: 0,
          isFogged: dayIsFogged,
          isToday: this._isToday(dayYear, 0, dayOfMonth),
          isSelected: this._isSelected(dayYear, 0, dayOfMonth),
          notes: dayNotes,
          isFestival: !dayIsFogged && !!festivalDay,
          festivalName: !dayIsFogged && festivalDay ? localize(festivalDay.name) : null,
          festivalColor: !dayIsFogged ? festivalDay?.color || '' : '',
          festivalIcon: !dayIsFogged && festivalDay?.icon ? `fas ${festivalDay.icon}` : '',
          festivalNoteId: dayIsFogged ? '' : festivalNoteId,
          moonPhases,
          isRestDay: weekdayData?.isRestDay || false,
          isFromOtherWeek: weekOffset !== 0,
          isIntercalary
        };
        currentWeek.push(dayData);
      }
      weeks.push(currentWeek);
    }
    const seasonDay = this._selectedDate ?? date;
    const currentSeason = enrichSeasonData(calendar.getCurrentSeason?.(seasonDay));
    const currentEra = calendar.getCurrentEra?.();
    const weekdayData = calendar.weekdaysArray ?? [];
    const displayWeek = weekNumber + 1;
    const yearDisplay = String(year);
    const formattedHeader = `${localize('CALENDARIA.Common.Week')} ${displayWeek}, ${yearDisplay}`;
    return {
      year,
      month: 0,
      monthName: '',
      yearDisplay,
      formattedHeader,
      weeks,
      weekdays: weekdayData.map((wd) => ({ name: localize(wd.name), isRestDay: wd.isRestDay || false })),
      daysInWeek,
      currentSeason,
      currentEra,
      isMonthless: true,
      weekNumber: displayWeek,
      totalWeeks
    };
  }

  /**
   * Generate calendar grid data for week view
   * @param {object} calendar - The calendar configuration
   * @param {object} date - The date being viewed
   * @param {Array} notes - Calendar notes to display
   * @returns {object} Week view data for rendering
   */
  _generateWeekData(calendar, date, notes) {
    const { year, month } = date;
    const viewedDayOfMonth = date.dayOfMonth ?? 0;
    const yearZero = calendar.years?.yearZero ?? 0;
    const currentDayOfWeek = dayOfWeek({ year, month, dayOfMonth: viewedDayOfMonth });
    let weekStartDayOfMonth = viewedDayOfMonth - currentDayOfWeek;
    let weekStartMonth = month;
    let weekStartYear = year;
    const monthsInYear = calendar.monthsArray.length ?? 12;
    if (weekStartDayOfMonth < 0) {
      weekStartMonth--;
      if (weekStartMonth < 0) {
        weekStartMonth = monthsInYear - 1;
        weekStartYear--;
      }
      const prevMonthDays = calendar.getDaysInMonth(weekStartMonth, weekStartYear - yearZero);
      weekStartDayOfMonth = prevMonthDays + weekStartDayOfMonth;
    }
    while (true) {
      const festivalDay = calendar.findFestivalDay({ year: weekStartYear - yearZero, month: weekStartMonth, dayOfMonth: weekStartDayOfMonth });
      const weekStartMonthData = calendar.monthsArray[weekStartMonth];
      if (festivalDay?.countsForWeekday === false || weekStartMonthData?.type === 'intercalary') {
        weekStartDayOfMonth++;
        if (weekStartDayOfMonth >= calendar.getDaysInMonth(weekStartMonth, weekStartYear - yearZero)) {
          weekStartDayOfMonth = 0;
          weekStartMonth++;
          if (weekStartMonth >= monthsInYear) {
            weekStartMonth = 0;
            weekStartYear++;
          }
        }
      } else {
        break;
      }
    }
    const currentTime = game.time.components || {};
    const currentHour = currentTime.hour ?? 0;
    const daysInWeek = calendar.daysInWeek;
    const fogEnabled = isFogEnabled();
    const days = [];
    let currentDayOfMonth = weekStartDayOfMonth;
    let currentMonth = weekStartMonth;
    let currentYear = weekStartYear;
    let weekdayIndex = 0;
    while (weekdayIndex < daysInWeek) {
      const monthData = calendar.monthsArray[currentMonth];
      if (!monthData) break;
      const festivalDay = calendar.findFestivalDay({ year: currentYear - yearZero, month: currentMonth, dayOfMonth: currentDayOfMonth });
      const isIntercalary = festivalDay?.countsForWeekday === false || monthData?.type === 'intercalary';
      if (isIntercalary) {
        currentDayOfMonth++;
        if (currentDayOfMonth >= calendar.getDaysInMonth(currentMonth, currentYear - yearZero)) {
          currentDayOfMonth = 0;
          currentMonth++;
          if (currentMonth >= calendar.monthsArray.length) {
            currentMonth = 0;
            currentYear++;
          }
        }
        continue;
      }
      const weekDayFogged = fogEnabled && !isRevealed(currentYear, currentMonth, currentDayOfMonth);
      const dayNotes = weekDayFogged ? [] : this._getNotesForDay(notes, currentYear, currentMonth, currentDayOfMonth);
      const monthWeekdays = calendar.getWeekdaysForMonth?.(currentMonth) ?? calendar.weekdaysArray ?? [];
      const weekdayData = monthWeekdays[weekdayIndex];
      const dayName = weekdayData?.name ? localize(weekdayData.name) : '';
      const monthName = calendar.monthsArray[currentMonth]?.name ? localize(calendar.monthsArray[currentMonth].name) : '';
      const isToday = this._isToday(currentYear, currentMonth, currentDayOfMonth);
      const selectedHour =
        this._selectedTimeSlot?.year === currentYear && this._selectedTimeSlot?.month === currentMonth && this._selectedTimeSlot?.dayOfMonth === currentDayOfMonth ? this._selectedTimeSlot.hour : null;
      days.push({
        day: currentDayOfMonth + 1,
        dayOfMonth: currentDayOfMonth,
        year: currentYear,
        month: currentMonth,
        isFogged: weekDayFogged,
        monthName: monthName,
        dayName: dayName,
        isToday: isToday,
        currentHour: isToday ? currentHour : null,
        selectedHour: selectedHour,
        isRestDay: weekdayData?.isRestDay || false,
        notes: dayNotes
      });
      weekdayIndex++;
      currentDayOfMonth++;
      if (currentDayOfMonth >= calendar.getDaysInMonth(currentMonth, currentYear - yearZero)) {
        currentDayOfMonth = 0;
        currentMonth++;
        if (currentMonth >= calendar.monthsArray.length) {
          currentMonth = 0;
          currentYear++;
        }
      }
    }
    const timeSlots = [];
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    for (let hour = 0; hour < hoursPerDay; hour++) timeSlots.push({ label: hour.toString(), hour: hour });
    const eventBlocks = this._createEventBlocks(notes, days);
    days.forEach((day) => {
      day.eventBlocks = eventBlocks.filter((block) => block.year === day.year && block.month === day.month && block.dayOfMonth === day.dayOfMonth);
    });
    let dayOfYear = viewedDayOfMonth + 1;
    for (let m = 0; m < month; m++) dayOfYear += calendar.getDaysInMonth(m, year - yearZero);
    const weekNumber = Math.ceil(dayOfYear / daysInWeek);
    const seasonDay = this._selectedDate ?? date;
    const currentSeason = enrichSeasonData(calendar.getCurrentSeason?.(seasonDay));
    const currentEra = calendar.getCurrentEra?.();
    const weekWeekdays = calendar.getWeekdaysForMonth?.(weekStartMonth) ?? calendar.weekdaysArray ?? [];
    const showSelectedInHeader = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_HEADER_SHOW_SELECTED);
    const weekHeaderDate = showSelectedInHeader && this._selectedDate ? this._selectedDate : { year: weekStartYear, month: weekStartMonth, dayOfMonth: weekStartDayOfMonth };
    const weekHeaderComponents = { year: weekHeaderDate.year, month: weekHeaderDate.month, dayOfMonth: weekHeaderDate.dayOfMonth ?? 0 };
    const rawHeader = formatForLocation(calendar, weekHeaderComponents, 'bigCalWeekHeader');
    const formattedHeader = hasMoonIconMarkers(rawHeader) ? renderMoonIcons(rawHeader) : rawHeader;
    return {
      year: weekStartYear,
      month: weekStartMonth,
      monthName: calendar.monthsArray[month]?.name ? localize(calendar.monthsArray[month].name) : '',
      yearDisplay: String(weekStartYear),
      formattedHeader,
      formattedHeaderHtml: hasMoonIconMarkers(rawHeader),
      weekNumber,
      days: days,
      timeSlots: timeSlots,
      weekdays: weekWeekdays.map((wd) => ({ name: localize(wd.name), isRestDay: wd.isRestDay || false })),
      daysInWeek,
      hoursPerDay,
      currentHour,
      currentSeason,
      currentEra
    };
  }

  /**
   * Generate calendar grid data for year view
   * @param {object} calendar - The calendar configuration
   * @param {object} date - The date being viewed
   * @returns {object} Year view data for rendering
   */
  _generateYearData(calendar, date) {
    const { year } = date;
    const yearZero = calendar.years?.yearZero ?? 0;
    const currentComponents = game.time.components;
    const currentYear = currentComponents.year + yearZero;
    const currentMonth = currentComponents.month;
    const yearGrid = [];
    const startYear = year - 4;
    for (let row = 0; row < 3; row++) {
      const yearRow = [];
      for (let col = 0; col < 3; col++) {
        const displayYear = startYear + row * 3 + col;
        const yearComponents = { year: displayYear, month: 0, dayOfMonth: 0 };
        yearRow.push({
          year: displayYear,
          yearDisplay: formatForLocation(calendar, yearComponents, 'bigCalYearLabel'),
          isCurrent: displayYear === year,
          months:
            calendar.monthsArray.map((m, idx) => {
              const localizedName = localize(m.name);
              const localizedAbbrev = m.abbreviation ? localize(m.abbreviation) : localizedName;
              const abbrevData = this._abbreviateMonthName(localizedAbbrev);
              const daysInMonth = calendar.getDaysInMonth(idx, displayYear - yearZero);
              return {
                localizedName,
                abbreviation: abbrevData.abbrev,
                fullAbbreviation: localizedAbbrev,
                tooltipText: `${localizedName} (${localizedAbbrev})`,
                month: idx,
                year: displayYear,
                hasNoDays: daysInMonth === 0,
                isCurrent: displayYear === currentYear && idx === currentMonth
              };
            }) || []
        });
      }
      yearGrid.push(yearRow);
    }
    const seasonDay = this._selectedDate ?? date;
    const currentSeason = enrichSeasonData(calendar.getCurrentSeason?.(seasonDay));
    const currentEra = calendar.getCurrentEra?.();
    const startYearComponents = { year: startYear, month: 0, dayOfMonth: 0 };
    const endYearComponents = { year: startYear + 8, month: 0, dayOfMonth: 0 };
    return {
      year,
      startYear,
      endYear: startYear + 8,
      startYearDisplay: formatForLocation(calendar, startYearComponents, 'bigCalYearHeader'),
      endYearDisplay: formatForLocation(calendar, endYearComponents, 'bigCalYearHeader'),
      yearGrid,
      weekdays: [],
      currentSeason,
      currentEra
    };
  }

  /**
   * Check if a date is today
   * @param {number} year - Display year (with yearZero applied)
   * @param {number} month - Month index (0-indexed)
   * @param {number} dayOfMonth - Day of month (0-indexed)
   * @returns {boolean} True if the date matches today
   */
  _isToday(year, month, dayOfMonth) {
    const today = game.time.components;
    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const displayYear = today.year + yearZero;
    const todayDayOfMonth = today.dayOfMonth ?? 0;
    return displayYear === year && today.month === month && todayDayOfMonth === dayOfMonth;
  }

  /**
   * Check if a date is the selected date
   * @param {number} year - Display year (with yearZero applied)
   * @param {number} month - Month index (0-indexed)
   * @param {number} dayOfMonth - Day of month (0-indexed)
   * @returns {boolean} True if the date is selected
   */
  _isSelected(year, month, dayOfMonth) {
    if (!this._selectedDate) return false;
    return this._selectedDate.year === year && this._selectedDate.month === month && this._selectedDate.dayOfMonth === dayOfMonth;
  }

  /**
   * Get notes for a specific day
   * @param {object[]} notePages - All note pages to filter
   * @param {number} year - The year to match
   * @param {number} month - The month to match
   * @param {number} dayOfMonth - The day to match (0-indexed)
   * @returns {Array} Notes matching the specified date
   */
  _getNotesForDay(notePages, year, month, dayOfMonth) {
    const targetDate = { year, month, dayOfMonth };
    const STYLE_PRIORITY = { banner: 0, icon: 1, pip: 2 };
    return notePages
      .filter((page) => {
        if (page.system.linkedFestival) return false;
        const start = page.system.startDate;
        const end = page.system.endDate;
        const hasValidEndDate = end && end.year != null && end.month != null && end.dayOfMonth != null;
        if (hasValidEndDate && (end.year !== start.year || end.month !== start.month || end.dayOfMonth !== start.dayOfMonth)) return false;
        if (getEffectiveDuration({ hasDuration: page.system.hasDuration, duration: page.system.duration }) > 0) return false;
        return isRecurringMatch(extractNoteMatchData(page), targetDate);
      })
      .map((page) => enrichNoteForDisplay(page))
      .sort((a, b) => {
        const aPri = STYLE_PRIORITY[a.displayStyle] ?? 1;
        const bPri = STYLE_PRIORITY[b.displayStyle] ?? 1;
        if (aPri !== bPri) return aPri - bPri;
        return a.name.localeCompare(b.name);
      });
  }

  /**
   * Get the journal page ID for a festival's note.
   * @param {object|null} festivalDay - Festival definition from findFestivalDay
   * @param {object} calendar - Calendar instance
   * @returns {string} Page ID or empty string
   */
  _getFestivalNoteId(festivalDay, calendar) {
    if (!festivalDay || !calendar?.festivals) return '';
    const calendarId = this._calendarId || CalendarManager.getActiveCalendar()?.metadata?.id;
    if (!calendarId) return '';
    const key = Object.entries(calendar.festivals).find(([, f]) => f === festivalDay)?.[0];
    if (!key) return '';
    return FestivalManager.getFestivalNoteByKey(calendarId, key)?.id || '';
  }

  /**
   * Get notes for a specific month
   * @param {object[]} notePages - All note pages to filter
   * @param {number} year - The year to match
   * @param {number} month - The month to match
   * @returns {Array} Notes occurring in the specified month
   */
  _getNotesForMonth(notePages, year, month) {
    return notePages.filter((page) => {
      const start = page.system.startDate;
      const repeat = page.system.repeat;
      if (!repeat || repeat === 'never') return start.year === year && start.month === month;
      const startBeforeOrInMonth = start.year < year || (start.year === year && start.month <= month);
      if (!startBeforeOrInMonth) return false;
      const repeatEndDate = page.system.repeatEndDate;
      if (repeatEndDate) {
        const endAfterOrInMonth = repeatEndDate.year > year || (repeatEndDate.year === year && repeatEndDate.month >= month);
        if (!endAfterOrInMonth) return false;
      }
      return true;
    });
  }

  /**
   * Find multi-day events and calculate their visual representation
   * @param {Array} notes - All note pages
   * @param {number} year - Current year
   * @param {number} month - Current month
   * @param {number} startDayOfWeek - Offset for first day of month
   * @param {number} daysInWeek - Number of days in a week
   * @param {number} daysInMonth - Number of days in this month
   * @returns {Array} Array of event bar data
   * @private
   */
  _findMultiDayEvents(notes, year, month, startDayOfWeek, daysInWeek, daysInMonth) {
    const events = [];
    const rows = [];
    const multiDayEvents = [];
    for (const note of notes) {
      const start = note.system.startDate;
      const end = note.system.endDate;
      const hasValidEndDate = end && end.year != null && end.month != null && end.dayOfMonth != null;
      const hasDur = note.system.hasDuration && note.system.duration > 0;
      if (!hasValidEndDate && !hasDur) continue;
      if (hasValidEndDate && !hasDur) {
        const isSameDay = end.year === start.year && end.month === start.month && end.dayOfMonth === start.dayOfMonth;
        if (isSameDay) continue;
      }
      const repeat = note.system.repeat;
      const hasConditionTree = note.system.conditionTree?.children?.length > 0 || note.system.conditionTree?.field;
      const noteData = { startDate: start, endDate: end, hasDuration: note.system.hasDuration, duration: note.system.duration };
      const duration = getEffectiveDuration(noteData);
      if (duration <= 0) continue;
      const isAllDay = start.hour == null || note.system.allDay;
      const priority = isAllDay ? -1 : start.hour;
      if ((repeat && repeat !== 'never') || hasConditionTree) {
        const recNoteData = { ...extractNoteMatchData(note), hasDuration: false, duration: 0 };
        const calendar = CalendarManager.getActiveCalendar();
        const yearZero = calendar?.years?.yearZero ?? 0;
        const prevMonth = month === 0 ? (calendar?.monthsArray.length || 12) - 1 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const prevMonthDays = calendar?.getDaysInMonth(prevMonth, prevYear - yearZero) || 30;
        const checkFromDay = Math.max(1, prevMonthDays - duration);
        for (let d = checkFromDay; d <= prevMonthDays; d++) {
          const checkDate = { year: prevYear, month: prevMonth, dayOfMonth: d - 1 };
          if (isRecurringMatch(recNoteData, checkDate)) {
            const occEnd = addDays(checkDate, duration);
            if (occEnd.year > year || (occEnd.year === year && occEnd.month >= month)) {
              const endDayOfMonth = occEnd.month === month && occEnd.year === year ? occEnd.dayOfMonth : daysInMonth - 1;
              multiDayEvents.push({ note, start: checkDate, end: occEnd, startDayOfMonth: 0, endDayOfMonth, priority, isContinuation: true });
            }
          }
        }
        for (let d = 1; d <= daysInMonth; d++) {
          const checkDate = { year, month, dayOfMonth: d - 1 };
          if (isRecurringMatch(recNoteData, checkDate)) {
            const occEnd = addDays(checkDate, duration);
            const endDayOfMonth = occEnd.month === month && occEnd.year === year ? occEnd.dayOfMonth : daysInMonth - 1;
            multiDayEvents.push({ note, start: checkDate, end: occEnd, startDayOfMonth: checkDate.dayOfMonth, endDayOfMonth, priority, isContinuation: false });
          }
        }
      } else {
        const effectiveEnd = hasDur ? addDays(start, duration) : end;
        const startBeforeOrInMonth = start.year < year || (start.year === year && start.month <= month);
        const endInOrAfterMonth = effectiveEnd.year > year || (effectiveEnd.year === year && effectiveEnd.month >= month);
        if (!startBeforeOrInMonth || !endInOrAfterMonth) continue;
        const isContinuation = start.year < year || (start.year === year && start.month < month);
        const startDayOfMonth = isContinuation ? 0 : start.dayOfMonth;
        const endDayOfMonth = effectiveEnd.month === month && effectiveEnd.year === year ? effectiveEnd.dayOfMonth : daysInMonth - 1;
        if (endDayOfMonth < startDayOfMonth) continue;
        multiDayEvents.push({ note, start, end: effectiveEnd, startDayOfMonth, endDayOfMonth, priority, isContinuation });
      }
    }
    multiDayEvents.sort((a, b) => a.startDayOfMonth - b.startDayOfMonth || a.priority - b.priority);
    const singleDayWidth = (1 / daysInWeek) * 100;
    const BAR_HEIGHT = 1;
    const CONDENSED_HEIGHT = 0.375;
    const CONDENSED_GAP = 0.125;
    const BAR_OFFSET = 1.625;
    multiDayEvents.forEach(({ note, end, startDayOfMonth, endDayOfMonth, isContinuation }) => {
      const endsInMonth = end.month === month && end.year === year;
      const resolved = resolveNoteDisplayProps(note);
      const displayStyle = resolved.displayStyle;
      const isHidden = resolved.visibility === 'hidden';
      const isSecret = resolved.visibility === 'secret';
      const showBookends = note.system.showBookends || false;
      const startPosition = startDayOfMonth + startDayOfWeek;
      const endPosition = endDayOfMonth + startDayOfWeek;
      if (showBookends) {
        const baseProps = { name: note.name, color: resolved.color, icon: resolved.icon, iconType: resolved.iconType, displayStyle, showBookends, isHidden, isSecret };
        if (!isContinuation) {
          const col = startPosition % daysInWeek;
          events.push({
            ...baseProps,
            id: `${note.id}-bk-start`,
            weekIndex: Math.floor(startPosition / daysInWeek),
            left: (col / daysInWeek) * 100,
            width: singleDayWidth,
            row: 0,
            top: BAR_OFFSET,
            isCondensed: false,
            isContinuation: false,
            isStart: true,
            isEnd: false
          });
        }
        if (endsInMonth) {
          const col = endPosition % daysInWeek;
          events.push({
            ...baseProps,
            id: `${note.id}-bk-end`,
            weekIndex: Math.floor(endPosition / daysInWeek),
            left: (col / daysInWeek) * 100,
            width: singleDayWidth,
            row: 0,
            top: BAR_OFFSET,
            isCondensed: false,
            isContinuation: false,
            isStart: false,
            isEnd: true
          });
        }
        return;
      }
      const startWeekIndex = Math.floor(startPosition / daysInWeek);
      const endWeekIndex = Math.floor(endPosition / daysInWeek);
      let eventRow = rows.length;
      for (let r = 0; r < rows.length; r++) {
        const rowEvents = rows[r] || [];
        const hasOverlap = rowEvents.some((existing) => {
          return !(endPosition < existing.start || startPosition > existing.end);
        });
        if (!hasOverlap) {
          eventRow = r;
          break;
        }
      }
      if (eventRow >= rows.length) rows.push([]);
      rows[eventRow].push({ start: startPosition, end: endPosition });
      if (startWeekIndex === endWeekIndex) {
        const startColumn = startPosition % daysInWeek;
        const endColumn = endPosition % daysInWeek;
        const left = (startColumn / daysInWeek) * 100;
        const width = ((endColumn - startColumn + 1) / daysInWeek) * 100;
        events.push({
          id: note.id,
          name: note.name,
          color: resolved.color,
          icon: resolved.icon,
          iconType: resolved.iconType,
          weekIndex: startWeekIndex,
          left,
          width,
          row: eventRow,
          top: 0,
          isCondensed: false,
          isContinuation,
          isStart: !isContinuation,
          isEnd: endsInMonth,
          displayStyle,
          showBookends: false,
          isHidden,
          isSecret
        });
      } else {
        for (let weekIdx = startWeekIndex; weekIdx <= endWeekIndex; weekIdx++) {
          const weekStart = weekIdx * daysInWeek;
          const weekEnd = weekStart + daysInWeek - 1;
          const segmentStart = Math.max(startPosition, weekStart);
          const segmentEnd = Math.min(endPosition, weekEnd);
          const startColumn = segmentStart % daysInWeek;
          const endColumn = segmentEnd % daysInWeek;
          const left = (startColumn / daysInWeek) * 100;
          const width = ((endColumn - startColumn + 1) / daysInWeek) * 100;
          const showContinuationIcon = isContinuation && weekIdx === startWeekIndex;
          events.push({
            id: `${note.id}-week-${weekIdx}`,
            name: note.name,
            color: resolved.color,
            icon: resolved.icon,
            iconType: resolved.iconType,
            weekIndex: weekIdx,
            left,
            width,
            row: eventRow,
            top: 0,
            isCondensed: false,
            isSegment: true,
            isContinuation: showContinuationIcon,
            isStart: weekIdx === startWeekIndex && !isContinuation,
            isEnd: weekIdx === endWeekIndex && endsInMonth,
            displayStyle,
            showBookends: false,
            isHidden,
            isSecret
          });
        }
      }
    });
    const hasOverlaps = rows.length > 1;
    for (const event of events) {
      if (hasOverlaps) {
        event.isCondensed = true;
        event.top = BAR_OFFSET + event.row * (CONDENSED_HEIGHT + CONDENSED_GAP);
      } else {
        event.top = BAR_OFFSET + event.row * BAR_HEIGHT;
      }
    }
    return events;
  }

  /**
   * Create event blocks for week view with proper time positioning
   * @param {Array} notes - All note pages
   * @param {Array} days - Days in the week
   * @returns {Array} Array of event block data
   * @private
   */
  _createEventBlocks(notes, days) {
    const blocks = [];
    const calendar = CalendarManager.getActiveCalendar();
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    notes.forEach((note) => {
      const resolved = resolveNoteDisplayProps(note);
      const start = note.system.startDate;
      const end = note.system.endDate;
      const allDay = note.system.allDay;
      const hasValidEnd = end && end.year != null && end.month != null && end.dayOfMonth != null;
      const isSameDay = !hasValidEnd || (end.year === start.year && end.month === start.month && end.dayOfMonth === start.dayOfMonth);
      if (isSameDay) {
        const dayMatch = days.find((d) => d.year === start.year && d.month === start.month && d.dayOfMonth === start.dayOfMonth);
        if (!dayMatch) return;
        const startHour = allDay ? 0 : (start.hour ?? 0);
        let hourSpan = 1;
        if (allDay) {
          hourSpan = hoursPerDay;
        } else if (hasValidEnd) {
          const endHour = end.hour ?? startHour;
          hourSpan = Math.max(endHour - startHour, 1);
        }
        const startTime = allDay ? 'All Day' : `${startHour.toString().padStart(2, '0')}:${(start.minute ?? 0).toString().padStart(2, '0')}`;
        const endTime = hasValidEnd && !allDay ? `${(end.hour ?? 0).toString().padStart(2, '0')}:${(end.minute ?? 0).toString().padStart(2, '0')}` : null;
        blocks.push({
          id: note.id,
          name: note.name,
          color: resolved.color,
          icon: resolved.icon,
          iconType: resolved.iconType,
          day: start.dayOfMonth + 1,
          dayOfMonth: start.dayOfMonth,
          month: start.month,
          year: start.year,
          startHour,
          hourSpan,
          startTime,
          endTime,
          allDay
        });
      } else {
        const eventStartHour = allDay ? 0 : (start.hour ?? 0);
        const eventEndHour = allDay ? hoursPerDay : (end.hour ?? eventStartHour);
        const eventHourSpan = allDay ? hoursPerDay : Math.max(eventEndHour - eventStartHour, 1);
        const eventStartTime = allDay ? 'All Day' : `${eventStartHour.toString().padStart(2, '0')}:${(start.minute ?? 0).toString().padStart(2, '0')}`;
        const eventEndTime = allDay ? null : `${eventEndHour.toString().padStart(2, '0')}:${(end.minute ?? 0).toString().padStart(2, '0')}`;
        for (const dayData of days) {
          const afterStart =
            dayData.year > start.year ||
            (dayData.year === start.year && dayData.month > start.month) ||
            (dayData.year === start.year && dayData.month === start.month && dayData.dayOfMonth >= start.dayOfMonth);
          const beforeEnd =
            dayData.year < end.year || (dayData.year === end.year && dayData.month < end.month) || (dayData.year === end.year && dayData.month === end.month && dayData.dayOfMonth <= end.dayOfMonth);
          if (!afterStart || !beforeEnd) continue;
          blocks.push({
            id: note.id,
            name: note.name,
            color: resolved.color,
            icon: resolved.icon,
            iconType: resolved.iconType,
            day: dayData.day,
            dayOfMonth: dayData.dayOfMonth,
            month: dayData.month,
            year: dayData.year,
            startHour: eventStartHour,
            hourSpan: eventHourSpan,
            startTime: eventStartTime,
            endTime: eventEndTime,
            allDay,
            isMultiDay: true
          });
        }
      }
    });
    return blocks;
  }

  /**
   * Adjust window size to fit rendered content, capping at viewport bounds.
   */
  _adjustSizeForView() {
    if (!this.element) return;
    const content = this.element.querySelector('.calendar-main-content');
    const header = this.element.querySelector('.calendar-header');
    if (!content) return;
    const width = Math.max(content.scrollWidth, header?.scrollWidth || 0);
    const headerHeight = header?.offsetHeight || 0;
    const naturalHeight = headerHeight + content.scrollHeight;
    const maxHeight = window.innerHeight - 40;
    const height = Math.min(naturalHeight, maxHeight);
    if (naturalHeight > maxHeight) {
      const maxContentHeight = maxHeight - headerHeight;
      content.style.maxHeight = `${maxContentHeight}px`;
      content.style.overflowY = 'auto';
    } else {
      content.style.maxHeight = '';
      content.style.overflowY = '';
    }
    this.setPosition({ width: width + 2, height: height + 2 });
  }

  /**
   * Update view class and handle post-render tasks
   * @param {object} context - Render context
   * @param {object} options - Render options
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.classList.remove('view-month', 'view-week', 'view-year');
    this.element.classList.add(`view-${this._displayMode}`);
    this.#enableDragging();
    const viewSelect = this.element.querySelector('.view-select');
    viewSelect?.addEventListener('change', (e) => {
      this._displayMode = e.target.value;
      this.render();
    });
    const header = this.element.querySelector('.calendar-header');
    header?.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, a, input, select, .note-item, .event-block, .multi-day-event')) return;
      e.preventDefault();
      this.close();
      MiniCal.show();
    });
    attachWidgetListeners(this.element);
    Hooks.callAll(HOOKS.RENDER_CALENDAR, { app: this, element: this.element, displayMode: this._displayMode, calendar: CalendarManager.getActiveCalendar() });
  }

  /**
   * Build context menu items for BigCal.
   * @returns {object[]} Array of context menu item definitions
   */
  #getContextMenuItems() {
    const items = [];
    items.push({
      name: 'CALENDARIA.BigCal.ContextMenu.Settings',
      icon: '<i class="fas fa-gear"></i>',
      callback: () => {
        const panel = new SettingsPanel();
        panel.render(true).then(() => {
          requestAnimationFrame(() => panel.changeTab('bigcal', 'primary'));
        });
      }
    });
    items.push(buildOpenAppsMenuItem());
    if (game.user.isGM) {
      const forceBigCal = game.settings.get(MODULE.ID, SETTINGS.FORCE_BIG_CAL);
      items.push({
        name: forceBigCal ? 'CALENDARIA.Common.HideFromAll' : 'CALENDARIA.Common.ShowToAll',
        icon: `<i class="fas fa-${forceBigCal ? 'eye-slash' : 'eye'}"></i>`,
        callback: async () => {
          const newValue = !forceBigCal;
          if (newValue) warnShowToAll('viewBigCal', game.i18n.localize('CALENDARIA.Permissions.ViewBigCal'));
          await game.settings.set(MODULE.ID, SETTINGS.FORCE_BIG_CAL, newValue);
          CalendariaSocket.emit(SOCKET_TYPES.BIG_CAL_VISIBILITY, { visible: newValue });
        }
      });
    }
    items.push({ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => this.close() });
    return items;
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this._adjustSizeForView();
    this._resizeHandler = () => this._adjustSizeForView();
    window.addEventListener('resize', this._resizeHandler);
    const saved = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_POSITION);
    if (saved?.left != null && saved?.top != null) {
      const rect = this.element.getBoundingClientRect();
      const left = Math.min(saved.left, window.innerWidth - rect.width);
      const top = Math.min(saved.top, window.innerHeight - rect.height);
      this.setPosition({ left: Math.max(0, left), top: Math.max(0, top) });
    } else {
      const rect = this.element.getBoundingClientRect();
      const left = Math.max(0, (window.innerWidth - rect.width) / 2);
      const top = Math.max(0, (window.innerHeight - rect.height) / 2);
      this.setPosition({ left, top });
    }
    setupDayContextMenu(this.element, '.calendar-day:not(.empty)', this.calendar, {
      onSetDate: () => {
        this._selectedDate = null;
        this.render();
      },
      onCreateNote: () => this.render(),
      extraItems: this.#getContextMenuItems()
    });
    new foundry.applications.ux.ContextMenu.implementation(this.element, '.calendar-header', this.#getContextMenuItems(), {
      fixed: true,
      jQuery: false,
      onOpen: () => document.getElementById('context-menu')?.classList.add('calendaria')
    });
    this.#enableDragging();
    this._hooks = [];
    const c = game.time.components;
    this._lastDay = `${c.year}-${c.month}-${c.dayOfMonth}`;
    this._debouncedRender = foundry.utils.debounce(() => this.render(), 100);
    const debouncedRender = this._debouncedRender;
    this._hooks.push({
      name: 'updateJournalEntryPage',
      id: Hooks.on('updateJournalEntryPage', (page, _changes, _options, _userId) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });
    this._hooks.push({
      name: 'updateJournalEntry',
      id: Hooks.on('updateJournalEntry', (journal, changes) => {
        if (changes.ownership && journal.getFlag?.(MODULE.ID, 'isCalendarNote')) debouncedRender();
      })
    });
    this._hooks.push({
      name: 'createJournalEntry',
      id: Hooks.on('createJournalEntry', (journal) => {
        if (journal.getFlag?.(MODULE.ID, 'isCalendarNote')) debouncedRender();
      })
    });
    this._hooks.push({
      name: 'createJournalEntryPage',
      id: Hooks.on('createJournalEntryPage', (page, _options, _userId) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });
    this._hooks.push({
      name: 'deleteJournalEntry',
      id: Hooks.on('deleteJournalEntry', (journal) => {
        if (journal.getFlag?.(MODULE.ID, 'isCalendarNote') || journal.pages.some((p) => p.type === 'calendaria.calendarnote')) debouncedRender();
      })
    });
    this._hooks.push({ name: HOOKS.WEATHER_CHANGE, id: Hooks.on(HOOKS.WEATHER_CHANGE, () => debouncedRender()) });
    this._hooks.push({ name: HOOKS.WIDGETS_REFRESH, id: Hooks.on(HOOKS.WIDGETS_REFRESH, () => debouncedRender()) });
    this._hooks.push({ name: HOOKS.DISPLAY_FORMATS_CHANGED, id: Hooks.on(HOOKS.DISPLAY_FORMATS_CHANGED, () => debouncedRender()) });
    this._hooks.push({ name: HOOKS.WORLD_TIME_UPDATED, id: Hooks.on(HOOKS.WORLD_TIME_UPDATED, this._onUpdateWorldTime.bind(this)) });
    this._hooks.push({ name: HOOKS.VISUAL_TICK, id: Hooks.on(HOOKS.VISUAL_TICK, this._onVisualTick.bind(this)) });
  }

  /** Enable header-based dragging for the frameless window. */
  #enableDragging() {
    const dragHandle = this.element.querySelector('.calendar-header');
    if (!dragHandle) return;
    const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, dragHandle, false);
    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      if (event.target.closest('button, a, input, select, [data-action]')) return;
      originalMouseDown(event);
    };
    const originalMouseUp = drag._onDragMouseUp.bind(drag);
    drag._onDragMouseUp = (event) => {
      originalMouseUp(event);
      const { left, top } = this.position;
      game.settings.set(MODULE.ID, SETTINGS.CALENDAR_POSITION, { left, top });
    };
  }

  /**
   * Handle visual tick — detect day boundary crossings from predicted time.
   */
  _onVisualTick() {
    if (!this.rendered || !TimeClock.running) return;
    const cal = game.time?.calendar;
    if (!cal) return;
    const components = cal.timeToComponents(TimeClock.predictedWorldTime);
    const predictedDay = `${components.year}-${components.month}-${components.dayOfMonth}`;
    if (predictedDay !== this._lastDay) {
      this._lastDay = predictedDay;
      this._debouncedRender();
    }
  }

  /**
   * Handle world time updates - re-render if day changed.
   */
  _onUpdateWorldTime() {
    if (!this.rendered) return;
    const components = game.time.components;
    const currentDay = `${components.year}-${components.month}-${components.dayOfMonth}`;
    if (currentDay !== this._lastDay) {
      this._lastDay = currentDay;
      this._debouncedRender();
    }
  }

  /**
   * Clean up hook listeners when the application is closed
   * @param {object} options - Close options
   * @override
   */
  async _onClose(options) {
    if (this._hooks) {
      this._hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
      this._hooks = [];
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._clickOutsideHandler) {
      document.removeEventListener('mousedown', this._clickOutsideHandler);
      this._clickOutsideHandler = null;
    }
    await super._onClose(options);
  }

  /**
   * Navigate forward or backward in the calendar view.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with direction data
   */
  static async _onNavigate(_event, target) {
    const direction = target.dataset.direction === 'next' ? 1 : -1;
    const current = this.viewedDate;
    const calendar = this.calendar;
    const yearZero = calendar.years?.yearZero ?? 0;
    switch (this._displayMode) {
      case 'week': {
        const daysInWeek = calendar.daysInWeek;
        let newDayOfMonth = (current.dayOfMonth ?? 0) + direction * daysInWeek;
        let newMonth = current.month;
        let newYear = current.year;
        const daysInCurrentMonth = calendar.getDaysInMonth(newMonth, newYear - yearZero);
        if (newDayOfMonth >= daysInCurrentMonth) {
          newDayOfMonth -= daysInCurrentMonth;
          newMonth++;
          if (newMonth >= calendar.monthsArray.length) {
            newMonth = 0;
            newYear++;
          }
        } else if (newDayOfMonth < 0) {
          newMonth--;
          if (newMonth < 0) {
            newMonth = calendar.monthsArray.length - 1;
            newYear--;
          }
          newDayOfMonth += calendar.getDaysInMonth(newMonth, newYear - yearZero);
        }
        while (calendar.monthsArray[newMonth]?.type === 'intercalary') {
          if (direction > 0) {
            newDayOfMonth = 0;
            newMonth++;
            if (newMonth >= calendar.monthsArray.length) {
              newMonth = 0;
              newYear++;
            }
          } else {
            newMonth--;
            if (newMonth < 0) {
              newMonth = calendar.monthsArray.length - 1;
              newYear--;
            }
            newDayOfMonth = Math.max(0, calendar.getDaysInMonth(newMonth, newYear - yearZero) - 1);
          }
        }
        this.viewedDate = { year: newYear, month: newMonth, dayOfMonth: newDayOfMonth };
        break;
      }
      case 'year': {
        this.viewedDate = { ...current, year: current.year + direction * 9 };
        break;
      }
      default: {
        if (calendar.isMonthless) {
          const daysInWeek = calendar.daysInWeek;
          const daysInYear = calendar.getDaysInYear(current.year - yearZero);
          let newDayOfMonth = (current.dayOfMonth ?? 0) + direction * daysInWeek;
          let newYear = current.year;
          if (newDayOfMonth >= daysInYear) {
            newDayOfMonth -= daysInYear;
            newYear++;
          } else if (newDayOfMonth < 0) {
            const prevYearDays = calendar.getDaysInYear(newYear - 1 - yearZero);
            newDayOfMonth += prevYearDays;
            newYear--;
          }
          this.viewedDate = { year: newYear, month: 0, dayOfMonth: newDayOfMonth };
          break;
        }
        let newMonth = current.month + direction;
        let newYear = current.year;
        if (newMonth >= calendar.monthsArray.length) {
          newMonth = 0;
          newYear++;
        } else if (newMonth < 0) {
          newMonth = calendar.monthsArray.length - 1;
          newYear--;
        }
        let attempts = 0;
        const maxAttempts = calendar.monthsArray.length;
        while (calendar.getDaysInMonth(newMonth, newYear - yearZero) === 0 && attempts < maxAttempts) {
          newMonth += direction;
          if (newMonth >= calendar.monthsArray.length) {
            newMonth = 0;
            newYear++;
          } else if (newMonth < 0) {
            newMonth = calendar.monthsArray.length - 1;
            newYear--;
          }
          attempts++;
        }
        if (!game.user.isGM && isFogEnabled() && game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_NAV_MODE) === 'skip') {
          let fogAttempts = 0;
          const maxFogAttempts = calendar.monthsArray.length * 10;
          while (isMonthFullyFogged(newYear, newMonth) && fogAttempts < maxFogAttempts) {
            newMonth += direction;
            if (newMonth >= calendar.monthsArray.length) {
              newMonth = 0;
              newYear++;
            } else if (newMonth < 0) {
              newMonth = calendar.monthsArray.length - 1;
              newYear--;
            }
            fogAttempts++;
          }
          if (isMonthFullyFogged(newYear, newMonth)) return;
        }
        this.viewedDate = { year: newYear, month: newMonth, dayOfMonth: 0 };
        break;
      }
    }
    await this.render();
  }

  /**
   * Reset the view to today's date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onToday(_event, _target) {
    this._viewedDate = null;
    await this.render();
  }

  /**
   * Add a new note at the selected or targeted date/time.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with date data
   */
  static async _onAddNote(_event, target) {
    let dayOfMonth, month, year, hour;
    if (this._selectedTimeSlot) {
      ({ dayOfMonth, month, year, hour } = this._selectedTimeSlot);
    } else {
      dayOfMonth = target.dataset.day;
      month = target.dataset.month;
      year = target.dataset.year;
      hour = target.dataset.hour ?? game.time.components?.hour ?? 0;
    }
    const calendar = this.calendar;
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    const endHour = (parseInt(hour) + 1) % hoursPerDay;
    await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: parseInt(year), month: parseInt(month), dayOfMonth: parseInt(dayOfMonth), hour: parseInt(hour), minute: 0 },
        endDate: { year: parseInt(year), month: parseInt(month), dayOfMonth: parseInt(dayOfMonth), hour: endHour, minute: 0 }
      },
      source: 'ui'
    });
    this._selectedTimeSlot = null;
  }

  /**
   * Add a new note for today or the selected date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onAddNoteToday(_event, _target) {
    let dayOfMonth, month, year, hour, minute;
    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    if (this._selectedTimeSlot) {
      ({ dayOfMonth, month, year, hour } = this._selectedTimeSlot);
      minute = 0;
    } else if (this._selectedDate) {
      ({ dayOfMonth, month, year } = this._selectedDate);
      hour = game.time.components?.hour ?? 0;
      minute = 0;
    } else {
      const today = game.time.components;
      year = today.year + yearZero;
      month = today.month;
      dayOfMonth = today.dayOfMonth ?? 0;
      hour = today.hour ?? 0;
      minute = today.minute ?? 0;
    }
    const endHour = (parseInt(hour) + 1) % hoursPerDay;
    await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: parseInt(year), month: parseInt(month), dayOfMonth: parseInt(dayOfMonth), hour: parseInt(hour), minute: parseInt(minute) },
        endDate: { year: parseInt(year), month: parseInt(month), dayOfMonth: parseInt(dayOfMonth), hour: endHour, minute: parseInt(minute) }
      },
      source: 'ui'
    });
    this._selectedTimeSlot = null;
  }

  /**
   * Open a note for editing.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with note ID
   */
  static async _onEditNote(_event, target) {
    let pageId = target.dataset.noteId;
    if (pageId.includes('-week-')) pageId = pageId.split('-week-')[0];
    const page = game.journal.find((j) => j.pages.get(pageId))?.pages.get(pageId);
    if (page) page.sheet.render(true, { mode: 'edit', forceMode: 'edit' });
  }

  /**
   * Delete a note after confirmation.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with note ID
   */
  static async _onDeleteNote(_event, target) {
    const pageId = target.dataset.noteId;
    const journal = game.journal.find((j) => j.pages.get(pageId));
    const page = journal?.pages.get(pageId);
    if (page) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: localize('CALENDARIA.Common.DeleteNote') },
        content: `<p>${format('CALENDARIA.ContextMenu.DeleteConfirm', { name: page.name })}</p>`,
        rejectClose: false,
        modal: true
      });
      if (confirmed) {
        if (journal.pages.size === 1) await journal.delete();
        else await page.delete();
        await this.render();
      }
    }
  }

  /**
   * Change the calendar display mode (month/week/year).
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with mode data
   */
  static async _onChangeView(_event, target) {
    const mode = target.dataset.mode;
    this._displayMode = mode;
    await this.render();
    this._adjustSizeForView();
  }

  /**
   * Select a month from the year view.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with year/month data
   */
  static async _onSelectMonth(_event, target) {
    const calendar = this.calendar;
    const yearZero = calendar.years?.yearZero ?? 0;
    let year = parseInt(target.dataset.year);
    let month = parseInt(target.dataset.month);
    let attempts = 0;
    const maxAttempts = calendar.monthsArray.length;
    while (calendar.getDaysInMonth(month, year - yearZero) === 0 && attempts < maxAttempts) {
      month++;
      if (month >= calendar.monthsArray.length) {
        month = 0;
        year++;
      }
      attempts++;
    }
    this._displayMode = 'month';
    this.viewedDate = { year, month, dayOfMonth: 0 };
    await this.render();
    this._adjustSizeForView();
  }

  /**
   * Select a day in the calendar.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with date data
   */
  static async _onSelectDay(_event, target) {
    const dayOfMonth = parseInt(target.dataset.day);
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);
    if (this._selectedDate?.year === year && this._selectedDate?.month === month && this._selectedDate?.dayOfMonth === dayOfMonth) this._selectedDate = null;
    else this._selectedDate = { year, month, dayOfMonth };
    await this.render();
  }

  /**
   * Set the selected or viewed date as the current world time.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onSetAsCurrentDate(_event, _target) {
    const calendar = this.calendar;
    const dateToSet = this._selectedDate || this.viewedDate;
    await calendar.jumpToDate({ year: dateToSet.year, month: dateToSet.month, dayOfMonth: dateToSet.dayOfMonth ?? 0 });
    this._selectedDate = null;
    await this.render();
  }

  /**
   * Select a time slot in week view.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with time data
   */
  static async _onSelectTimeSlot(_event, target) {
    const dayOfMonth = parseInt(target.dataset.day);
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);
    const hour = parseInt(target.dataset.hour);
    if (this._selectedTimeSlot?.year === year && this._selectedTimeSlot?.month === month && this._selectedTimeSlot?.dayOfMonth === dayOfMonth && this._selectedTimeSlot?.hour === hour)
      this._selectedTimeSlot = null;
    else this._selectedTimeSlot = { year, month, dayOfMonth, hour };
    await this.render();
  }

  /**
   * Toggle between full and MiniCal views.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onToggleCompact(_event, _target) {
    await this.close();
    MiniCal.show();
  }

  /**
   * Close BigCal.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onCloseBigCal(_event, _target) {
    await this.close();
  }

  /**
   * Open a secondary calendar viewer for the clicked equivalent date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onOpenSecondaryCalendar(_event, target) {
    const calendarId = target.dataset.calendarId;
    if (calendarId) SecondaryCalendar.open(calendarId);
  }

  /**
   * Cycle through weather presets or generate new weather.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onOpenWeatherPicker(_event, _target) {
    if (!game.user.isGM) return;
    new WeatherPickerApp().render({ force: true });
  }

  /**
   * Get weather context for template.
   * @returns {object|null} Weather context or null if no weather set
   */
  _getWeatherContext() {
    const weather = WeatherManager.getCurrentWeather(null, game.scenes?.active);
    if (!weather) return null;
    const label = localize(weather.label);
    const windSpeed = weather.wind?.speed ?? 0;
    const windDirection = weather.wind?.direction;
    const precipType = weather.precipitation?.type ?? null;
    const temp = WeatherManager.formatTemperature(WeatherManager.getTemperature());
    const windKph = weather.wind?.kph ?? null;
    const tooltipHtml = WeatherManager.buildWeatherTooltip({
      label,
      description: weather.description ? localize(weather.description) : null,
      temp,
      windSpeed,
      windKph,
      windDirection,
      precipType,
      precipIntensity: weather.precipitation?.intensity
    });
    return { id: weather.id, label, icon: weather.icon, color: weather.color, temperature: temp, tooltipHtml, windSpeed, windKph, windDirection, precipType };
  }

  /** Open the Note Viewer. */
  static _onOpenNoteViewer() {
    NoteViewer.toggle();
  }

  /**
   * Open the Chronicle chronicle.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onOpenChronicle(_event, _target) {
    CALENDARIA.apps.Chronicle.toggle();
  }

  /**
   * Open the settings panel.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onOpenSettings(_event, _target) {
    new SettingsPanel().render(true);
  }

  /**
   * Navigate to a specific month (from clicking other-month day).
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with month/year data
   */
  static async _onNavigateToMonth(_event, target) {
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);
    this.viewedDate = { year, month, dayOfMonth: 0 };
    await this.render();
  }

  /**
   * Handle click on a visible moon icon in the day cell.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked moon-phase element
   */
  static async _onMoonClick(_event, target) {
    _event.stopPropagation();
    const dayCell = target.closest('[data-year][data-month][data-day]');
    if (!dayCell) return;
    const year = parseInt(dayCell.dataset.year);
    const month = parseInt(dayCell.dataset.month);
    const dayOfMonth = parseInt(dayCell.dataset.day);
    const slot = parseInt(target.dataset.moonSlot);
    const allMoons = getAllMoonPhases(this.calendar, year, month, dayOfMonth);
    if (!allMoons?.length || allMoons.length <= MAX_VISIBLE_MOONS) return;
    const clickedMoon = target.dataset.moonName;
    await showMoonPicker(target, allMoons, clickedMoon, (moonName) => {
      const current = getVisibleMoons() ?? allMoons.slice(0, MAX_VISIBLE_MOONS).map((m) => m.moonName);
      const updated = [...current];
      const existingIdx = updated.indexOf(moonName);
      if (existingIdx !== -1 && existingIdx !== slot) updated[existingIdx] = updated[slot];
      if (slot >= 0 && slot < updated.length) updated[slot] = moonName;
      setVisibleMoons(updated);
      this.render();
    });
  }

  /**
   * Get the singleton instance from Foundry's application registry.
   * @returns {BigCal|undefined} The instance if it exists
   */
  static get instance() {
    return foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
  }

  /** Update the idle opacity CSS variable from settings. */
  static updateIdleOpacity() {
    const autoFade = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_AUTO_FADE);
    const opacity = autoFade ? game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_IDLE_OPACITY) / 100 : 1;
    document.documentElement.style.setProperty('--calendaria-bigcal-idle-opacity', opacity);
  }

  /**
   * Show the BigCal application.
   * @param {object} [options] - Show options
   * @param {boolean} [options.silent] - If true, don't show permission warning
   * @static
   * @returns {BigCal} The BigCal instance
   */
  static show({ silent = false } = {}) {
    if (isCombatBlocked(SETTINGS.BIG_CAL_COMBAT_MODE)) return null;
    const instance = this.instance ?? new BigCal();
    instance.render({ force: true, silent });
    return instance;
  }

  /**
   * Hide the BigCal application.
   * @static
   * @returns {void}
   */
  static hide() {
    this.instance?.close();
  }

  /**
   * Toggle the BigCal visibility.
   * @static
   * @returns {void}
   */
  static toggle() {
    if (this.instance?.rendered) this.hide();
    else this.show();
  }
}
