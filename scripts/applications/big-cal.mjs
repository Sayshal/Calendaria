/**
 * Standalone application for displaying the calendar UI.
 * @module Applications/BigCal
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, REPLACEABLE_ELEMENTS, SETTINGS, TEMPLATES, WIDGET_POINTS } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { addDays, dayOfWeek, daysBetween } from '../notes/utils/date-utils.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';
import SearchManager from '../search/search-manager.mjs';
import { formatForLocation, hasMoonIconMarkers, renderMoonIcons, toRomanNumeral } from '../utils/format-utils.mjs';
import { format, localize } from '../utils/localization.mjs';
import { canViewBigCal } from '../utils/permissions.mjs';
import * as WidgetManager from '../utils/widget-manager.mjs';
import WeatherManager from '../weather/weather-manager.mjs';
import { openWeatherPicker } from '../weather/weather-picker.mjs';
import * as ViewUtils from './calendar-view-utils.mjs';
import { MiniCal } from './mini-cal.mjs';
import { SettingsPanel } from './settings/settings-panel.mjs';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** Max moon icons visible per day cell before overflow. */
const MAX_VISIBLE_MOONS = 3;

/**
 * Process moon phases array for display with overflow handling.
 * @param {object[]|null} phases - Array of moon phase objects
 * @returns {object|null} Processed object with visible, overflow, and overflowTooltip
 */
function processMoonPhases(phases) {
  if (!phases?.length) return null;
  if (phases.length <= MAX_VISIBLE_MOONS) return { visible: phases, overflow: [], overflowTooltip: '', overflowTooltipText: '' };
  const visible = phases.slice(0, MAX_VISIBLE_MOONS);
  const overflow = phases.slice(MAX_VISIBLE_MOONS);
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
    this._searchTerm = '';
    this._searchResults = null;
    this._searchOpen = false;
    this._clickOutsideHandler = null;
  }

  static DEFAULT_OPTIONS = {
    id: 'calendaria-big-cal',
    classes: ['calendaria', 'big-cal'],
    tag: 'div',
    window: { contentClasses: ['big-cal'], icon: 'fas fa-calendar', resizable: false },
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
      toggleSearch: BigCal._onToggleSearch,
      closeSearch: BigCal._onCloseSearch,
      openSearchResult: BigCal._onOpenSearchResult,
      openSettings: BigCal._onOpenSettings,
      navigateToMonth: BigCal._onNavigateToMonth
    },
    position: { width: 'auto', height: 'auto' }
  };

  static PARTS = { header: { template: TEMPLATES.SHEETS.CALENDAR_HEADER }, content: { template: TEMPLATES.SHEETS.CALENDAR_CONTENT } };

  /** @override */
  async render(options = {}, _options = {}) {
    if (!canViewBigCal()) {
      if (!options.silent) ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return this;
    }
    return super.render(options, _options);
  }

  /**
   * Get the application window title.
   * @returns {string} The calendar name
   */
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
   * @returns {object} The currently viewed date with year, month, day
   */
  get viewedDate() {
    if (this._viewedDate) return this._viewedDate;
    const components = game.time.components;
    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const dayOfMonth = (components.dayOfMonth ?? 0) + 1;
    return { ...components, year: components.year + yearZero, day: dayOfMonth };
  }

  /**
   * Set the viewed date.
   * @param {object} date - The date to view
   */
  set viewedDate(date) {
    this._viewedDate = date;
  }

  /**
   * Prepare context data for rendering.
   * @param {object} options - Render options
   * @returns {Promise<object>} The prepared context
   * @override
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const viewedDate = this.viewedDate;
    context.editable = game.user.isGM;
    context.canAddNotes = true;
    context.calendar = calendar;
    context.viewedDate = viewedDate;
    context.displayMode = this._displayMode;
    context.selectedDate = this._selectedDate;
    context.selectedTimeSlot = this._selectedTimeSlot;
    const today = game.time.components;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const todayYear = today.year + yearZero;
    const todayMonth = today.month;
    const todayDay = (today.dayOfMonth ?? 0) + 1;
    if (this._selectedDate) context.isToday = this._selectedDate.year === todayYear && this._selectedDate.month === todayMonth && this._selectedDate.day === todayDay;
    else context.isToday = viewedDate.year === todayYear && viewedDate.month === todayMonth && viewedDate.day === todayDay;
    const allNotes = ViewUtils.getCalendarNotes();
    context.notes = allNotes;
    context.visibleNotes = ViewUtils.getVisibleNotes(allNotes);
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
    context.currentMonthNotes = this._getNotesForMonth(context.visibleNotes, viewedDate.year, viewedDate.month);
    context.showMoonPhases = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_MOON_PHASES);
    context.weather = this._getWeatherContext();

    // Block visibility settings
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
      const viewedComponents = { year: viewedDate.year - yearZeroOffset, month: viewedDate.month, dayOfMonth: (viewedDate.day ?? 1) - 1, hour: 12, minute: 0, second: 0 };
      const cycleResult = calendar.getCycleValues(viewedComponents);
      context.cycleText = cycleResult.text;
      context.cycleValues = cycleResult.values;
      context.cycleData = cycleResult;
    }

    context.searchTerm = this._searchTerm;
    context.searchOpen = this._searchOpen;
    context.searchResults = this._searchResults || [];
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
    widgets.actions = WidgetManager.renderWidgetsForPoint(WIDGET_POINTS.BIGCAL_ACTIONS, 'bigcal');
    widgets.weatherIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.WEATHER_INDICATOR, this._renderWeatherIndicator(context), 'bigcal');
    widgets.seasonIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.SEASON_INDICATOR, this._renderSeasonIndicator(context), 'bigcal');
    widgets.eraIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.ERA_INDICATOR, this._renderEraIndicator(context), 'bigcal');
    widgets.cycleIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.CYCLE_INDICATOR, this._renderCycleIndicator(context), 'bigcal');
    widgets.indicators = WidgetManager.renderWidgetsForPoint(WIDGET_POINTS.HUD_INDICATORS, 'bigcal');
    widgets.hasIndicators = WidgetManager.hasWidgetsForPoint(WIDGET_POINTS.HUD_INDICATORS);
    return widgets;
  }

  /**
   * Render weather indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  _renderWeatherIndicator(context) {
    if (!context.showWeather) return '';
    const { weather, editable, weatherDisplayMode } = context;
    if (weather) {
      const clickable = editable ? ' clickable' : '';
      const action = editable ? 'data-action="openWeatherPicker"' : '';
      const showIcon = weatherDisplayMode === 'full' || weatherDisplayMode === 'icon' || weatherDisplayMode === 'iconTemp';
      const showLabel = weatherDisplayMode === 'full';
      const showTemp = weatherDisplayMode === 'full' || weatherDisplayMode === 'temp' || weatherDisplayMode === 'iconTemp';
      const icon = showIcon ? `<i class="fas ${weather.icon}"></i>` : '';
      const label = showLabel ? ` ${weather.label}` : '';
      const temp = showTemp && weather.temperature ? `<span class="weather-temp">${weather.temperature}</span>` : '';
      return `<span class="weather-indicator${clickable}" ${action}
        style="--weather-color: ${weather.color}" data-tooltip="${weather.tooltip}">
        ${icon}${label} ${temp}
      </span>`;
    } else if (editable) {
      return `<span class="weather-indicator clickable no-weather" data-action="openWeatherPicker"
        data-tooltip="${localize('CALENDARIA.Weather.ClickToGenerate')}">
        <i class="fas fa-cloud"></i> ${localize('CALENDARIA.Weather.None')}
      </span>`;
    }
    return '';
  }

  /**
   * Render season indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  _renderSeasonIndicator(context) {
    if (!context.showSeason) return '';
    const season = context.calendarData?.currentSeason;
    if (!season) return '';
    const mode = context.seasonDisplayMode;
    const showIcon = mode === 'full' || mode === 'icon';
    const showLabel = mode === 'full' || mode === 'text';
    const icon = showIcon ? `<i class="${season.icon}"></i>` : '';
    const label = showLabel ? ` ${localize(season.name)}` : '';
    return `<span class="season-indicator" style="--season-color: ${season.color}" data-tooltip="${localize(season.name)}">${icon}${label}</span>`;
  }

  /**
   * Render era indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  _renderEraIndicator(context) {
    if (!context.showEra) return '';
    const era = context.calendarData?.currentEra;
    if (!era) return '';
    const mode = context.eraDisplayMode;
    const showIcon = mode === 'full' || mode === 'icon';
    const showLabel = mode === 'full' || mode === 'text';
    const showAbbr = mode === 'abbr';
    const icon = showIcon ? '<i class="fas fa-hourglass-half"></i>' : '';
    let label = '';
    if (showLabel) label = ` ${localize(era.name)}`;
    else if (showAbbr) label = ` ${localize(era.abbreviation || era.name)}`;
    return `<span class="era-indicator" data-tooltip="${localize(era.name)}">${icon}${label}</span>`;
  }

  /**
   * Render cycle indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  _renderCycleIndicator(context) {
    if (!context.showCycles || !context.cycleData?.values?.length) return '';
    const mode = context.cyclesDisplayMode;
    const icon = '<i class="fas fa-arrows-rotate"></i>';
    // Icon only mode - just show icon with tooltip
    if (mode === 'icon') {
      return `<span class="cycle-indicator" data-tooltip="${context.cycleText}">${icon}</span>`;
    }
    let displayText = '';
    if (mode === 'number') {
      displayText = context.cycleData.values.map((v) => v.index + 1).join(', ');
    } else if (mode === 'roman') {
      displayText = context.cycleData.values.map((v) => toRomanNumeral(v.index + 1)).join(', ');
    } else {
      displayText = context.cycleData.values.map((v) => v.entryName).join(', ');
    }
    const label = `<span class="cycle-label">${displayText}</span>`;
    return `<span class="cycle-indicator" data-tooltip="${context.cycleText || displayText}">${icon}${label}</span>`;
  }

  /**
   * Abbreviate month name if longer than 5 characters
   * Takes first letter of each word
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
    const startDayOfWeek = hasFixedStart ? monthData.startingWeekday : dayOfWeek({ year, month, day: 1 });
    if (startDayOfWeek > 0) {
      const totalMonths = calendar.monthsArray.length ?? 12;
      let prevDays = [];
      let remainingSlots = startDayOfWeek;
      let checkMonth = month === 0 ? totalMonths - 1 : month - 1;
      let checkYear = month === 0 ? year - 1 : year;
      let checkDay = calendar.getDaysInMonth(checkMonth, checkYear - yearZero);

      // Collect previous month days, skipping intercalary days
      while (remainingSlots > 0 && checkDay > 0) {
        const festivalDay = calendar.findFestivalDay({ year: checkYear - yearZero, month: checkMonth, dayOfMonth: checkDay - 1 });
        const isIntercalary = festivalDay?.countsForWeekday === false;

        if (!isIntercalary) {
          prevDays.unshift({ day: checkDay, year: checkYear, month: checkMonth });
          remainingSlots--;
        }

        checkDay--;
        if (checkDay < 1 && remainingSlots > 0) {
          checkMonth = checkMonth === 0 ? totalMonths - 1 : checkMonth - 1;
          if (checkMonth === totalMonths - 1) checkYear--;
          checkDay = calendar.getDaysInMonth(checkMonth, checkYear - yearZero);
        }
      }

      for (const pd of prevDays) currentWeek.push({ day: pd.day, year: pd.year, month: pd.month, isFromOtherMonth: true, isToday: this._isToday(pd.year, pd.month, pd.day) });
    }

    // Collect intercalary days to insert after regular days
    const intercalaryDays = [];
    let dayIndex = startDayOfWeek;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayNotes = this._getNotesForDay(notes, year, month, day);
      const festivalDay = calendar.findFestivalDay({ year: internalYear, month, dayOfMonth: day - 1 });
      let moonPhases = null;
      if (showMoons) {
        const dayComponents = { year: internalYear, month, dayOfMonth: day - 1, hour: 12, minute: 0, second: 0 };
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

      // Check if this is a non-counting festival (intercalary day)
      const isIntercalary = festivalDay?.countsForWeekday === false;

      if (isIntercalary) {
        // Don't add to weekday grid - collect separately
        const festivalNameStr = festivalDay ? localize(festivalDay.name) : null;
        const festivalInfo = festivalDay ? { name: festivalNameStr, description: festivalDay.description || '', color: festivalDay.color || '' } : null;
        intercalaryDays.push({
          day,
          year,
          month,
          isToday: this._isToday(year, month, day),
          isSelected: this._isSelected(year, month, day),
          notes: dayNotes,
          isFestival: true,
          festivalName: festivalNameStr,
          festivalColor: festivalDay?.color || '',
          festivalIcon: festivalDay?.icon || '',
          festivalDescription: festivalDay?.description || '',
          dayTooltip: ViewUtils.generateDayTooltip(calendar, year, month, day, festivalInfo),
          moonPhases,
          isIntercalary: true
        });
      } else {
        const weekdayData = calendar.weekdaysArray[currentWeek.length];
        const festivalNameStr = festivalDay ? localize(festivalDay.name) : null;
        const festivalInfo = festivalDay ? { name: festivalNameStr, description: festivalDay.description || '', color: festivalDay.color || '' } : null;
        currentWeek.push({
          day,
          year,
          month,
          isToday: this._isToday(year, month, day),
          isSelected: this._isSelected(year, month, day),
          notes: dayNotes,
          isOddDay: dayIndex % 2 === 1,
          isFestival: !!festivalDay,
          festivalName: festivalNameStr,
          festivalColor: festivalDay?.color || '',
          festivalIcon: festivalDay?.icon || '',
          festivalDescription: festivalDay?.description || '',
          dayTooltip: ViewUtils.generateDayTooltip(calendar, year, month, day, festivalInfo),
          isRestDay: weekdayData?.isRestDay || false,
          moonPhases
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
          currentWeek.push({ day: dayInMonth, year: checkYear, month: checkMonth, isFromOtherMonth: true, isToday: this._isToday(checkYear, checkMonth, dayInMonth) });
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
    const viewedComponents = { month, dayOfMonth: Math.floor(daysInMonth / 2) };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    const monthWeekdays = calendar.getWeekdaysForMonth?.(month) ?? calendar.weekdaysArray ?? [];
    const weekdaysData = monthWeekdays.map((wd) => ({ name: localize(wd.name), isRestDay: wd.isRestDay || false }));
    const showSelectedInHeader = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_HEADER_SHOW_SELECTED);
    const headerDate = showSelectedInHeader && this._selectedDate ? this._selectedDate : { year, month, day: date.day };
    const headerComponents = { year: headerDate.year, month: headerDate.month, dayOfMonth: headerDate.day };
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
    const viewedDay = date.day || 1;
    const daysInWeek = calendar.daysInWeek;
    const yearZero = calendar.years?.yearZero ?? 0;
    const daysInYear = calendar.getDaysInYear(year - yearZero);
    const showMoons = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_MOON_PHASES) && calendar.moonsArray.length;
    const weekNumber = Math.floor((viewedDay - 1) / daysInWeek);
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
        const dayNotes = this._getNotesForDay(notes, dayYear, 0, dayNum);
        const festivalDay = calendar.findFestivalDay({ year: dayInternalYear, month: 0, dayOfMonth: dayNum - 1 });
        const isIntercalary = festivalDay?.countsForWeekday === false;
        let moonPhases = null;
        if (showMoons) {
          const dayComponents = { year: dayInternalYear, month: 0, dayOfMonth: dayNum - 1, hour: 12, minute: 0, second: 0 };
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
        const dayData = {
          day: dayNum,
          year: dayYear,
          month: 0,
          isToday: this._isToday(dayYear, 0, dayNum),
          isSelected: this._isSelected(dayYear, 0, dayNum),
          notes: dayNotes,
          isFestival: !!festivalDay,
          festivalName: festivalDay ? localize(festivalDay.name) : null,
          festivalColor: festivalDay?.color || '',
          festivalIcon: festivalDay?.icon || '',
          moonPhases,
          isRestDay: weekdayData?.isRestDay || false,
          isFromOtherWeek: weekOffset !== 0,
          isIntercalary
        };

        currentWeek.push(dayData);
      }

      weeks.push(currentWeek);
    }

    const viewedComponents = { month: 0, dayOfMonth: viewedDay - 1 };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
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
    const { year, month, day } = date;
    const yearZero = calendar.years?.yearZero ?? 0;
    const currentDayOfWeek = dayOfWeek({ year, month, day });
    let weekStartDay = day - currentDayOfWeek;
    let weekStartMonth = month;
    let weekStartYear = year;
    const monthsInYear = calendar.monthsArray.length ?? 12;
    if (weekStartDay < 1) {
      weekStartMonth--;
      if (weekStartMonth < 0) {
        weekStartMonth = monthsInYear - 1;
        weekStartYear--;
      }
      const prevMonthDays = calendar.getDaysInMonth(weekStartMonth, weekStartYear - yearZero);
      weekStartDay = prevMonthDays + weekStartDay;
    }

    // Skip any intercalary days at the start position
    while (true) {
      const festivalDay = calendar.findFestivalDay({ year: weekStartYear - yearZero, month: weekStartMonth, dayOfMonth: weekStartDay - 1 });
      if (festivalDay?.countsForWeekday === false) {
        weekStartDay++;
        if (weekStartDay > calendar.getDaysInMonth(weekStartMonth, weekStartYear - yearZero)) {
          weekStartDay = 1;
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
    const days = [];
    let currentDay = weekStartDay;
    let currentMonth = weekStartMonth;
    let currentYear = weekStartYear;
    let weekdayIndex = 0;

    // Loop until we've filled all weekday slots, skipping intercalary days
    while (weekdayIndex < daysInWeek) {
      const monthData = calendar.monthsArray[currentMonth];
      if (!monthData) break;

      // Check if current day is intercalary (non-counting festival)
      const festivalDay = calendar.findFestivalDay({ year: currentYear - yearZero, month: currentMonth, dayOfMonth: currentDay - 1 });
      const isIntercalary = festivalDay?.countsForWeekday === false;

      if (isIntercalary) {
        // Skip intercalary days - they don't occupy weekday slots
        currentDay++;
        if (currentDay > calendar.getDaysInMonth(currentMonth, currentYear - yearZero)) {
          currentDay = 1;
          currentMonth++;
          if (currentMonth >= calendar.monthsArray.length) {
            currentMonth = 0;
            currentYear++;
          }
        }
        continue;
      }

      const dayNotes = this._getNotesForDay(notes, currentYear, currentMonth, currentDay);
      const monthWeekdays = calendar.getWeekdaysForMonth?.(currentMonth) ?? calendar.weekdaysArray ?? [];
      const weekdayData = monthWeekdays[weekdayIndex];
      const dayName = weekdayData?.name ? localize(weekdayData.name) : '';
      const monthName = calendar.monthsArray[currentMonth]?.name ? localize(calendar.monthsArray[currentMonth].name) : '';
      const isToday = this._isToday(currentYear, currentMonth, currentDay);
      const selectedHour =
        this._selectedTimeSlot?.year === currentYear && this._selectedTimeSlot?.month === currentMonth && this._selectedTimeSlot?.day === currentDay ? this._selectedTimeSlot.hour : null;
      days.push({
        day: currentDay,
        year: currentYear,
        month: currentMonth,
        monthName: monthName,
        dayName: dayName,
        isToday: isToday,
        currentHour: isToday ? currentHour : null,
        selectedHour: selectedHour,
        isRestDay: weekdayData?.isRestDay || false,
        notes: dayNotes
      });

      weekdayIndex++;
      currentDay++;
      if (currentDay > calendar.getDaysInMonth(currentMonth, currentYear - yearZero)) {
        currentDay = 1;
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
      day.eventBlocks = eventBlocks.filter((block) => block.year === day.year && block.month === day.month && block.day === day.day);
    });
    let dayOfYear = day;
    for (let m = 0; m < month; m++) dayOfYear += calendar.getDaysInMonth(m, year - yearZero);
    const weekNumber = Math.ceil(dayOfYear / daysInWeek);
    const midWeekDay = days[Math.floor(days.length / 2)];
    const viewedComponents = { month: midWeekDay?.month ?? month, dayOfMonth: (midWeekDay?.day ?? day) - 1 };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    const weekWeekdays = calendar.getWeekdaysForMonth?.(weekStartMonth) ?? calendar.weekdaysArray ?? [];
    const showSelectedInHeader = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_HEADER_SHOW_SELECTED);
    const weekHeaderDate = showSelectedInHeader && this._selectedDate ? this._selectedDate : { year: weekStartYear, month: weekStartMonth, day: weekStartDay };
    const weekHeaderComponents = { year: weekHeaderDate.year, month: weekHeaderDate.month, dayOfMonth: weekHeaderDate.day };
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
    const yearGrid = [];
    const startYear = year - 4;
    for (let row = 0; row < 3; row++) {
      const yearRow = [];
      for (let col = 0; col < 3; col++) {
        const displayYear = startYear + row * 3 + col;
        const yearComponents = { year: displayYear, month: 0, dayOfMonth: 1 };
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
                hasNoDays: daysInMonth === 0
              };
            }) || []
        });
      }
      yearGrid.push(yearRow);
    }
    const viewedComponents = { month: 0, dayOfMonth: 0 };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    const startYearComponents = { year: startYear, month: 0, dayOfMonth: 1 };
    const endYearComponents = { year: startYear + 8, month: 0, dayOfMonth: 1 };
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
   * @param {number} day - Day of month (1-indexed)
   * @returns {boolean} True if the date matches today
   */
  _isToday(year, month, day) {
    const today = game.time.components;
    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const displayYear = today.year + yearZero;
    const todayDayOfMonth = (today.dayOfMonth ?? 0) + 1;
    return displayYear === year && today.month === month && todayDayOfMonth === day;
  }

  /**
   * Check if a date is the selected date
   * @param {number} year - Display year (with yearZero applied)
   * @param {number} month - Month index (0-indexed)
   * @param {number} day - Day of month (1-indexed)
   * @returns {boolean} True if the date is selected
   */
  _isSelected(year, month, day) {
    if (!this._selectedDate) return false;
    return this._selectedDate.year === year && this._selectedDate.month === month && this._selectedDate.day === day;
  }

  /**
   * Get notes for a specific day
   * @param {object[]} notePages - All note pages to filter
   * @param {number} year - The year to match
   * @param {number} month - The month to match
   * @param {number} day - The day to match
   * @returns {Array} Notes matching the specified date
   */
  _getNotesForDay(notePages, year, month, day) {
    const targetDate = { year, month, day };
    return notePages
      .filter((page) => {
        const start = page.system.startDate;
        const end = page.system.endDate;
        // Exclude multi-day notes - they render as event bars via _findMultiDayEvents
        const hasValidEndDate = end && end.year != null && end.month != null && end.day != null;
        if (hasValidEndDate && (end.year !== start.year || end.month !== start.month || end.day !== start.day)) return false;
        const noteData = {
          startDate: start,
          endDate: end,
          repeat: page.system.repeat,
          repeatInterval: page.system.repeatInterval,
          repeatEndDate: page.system.repeatEndDate,
          maxOccurrences: page.system.maxOccurrences,
          moonConditions: page.system.moonConditions,
          randomConfig: page.system.randomConfig,
          cachedRandomOccurrences: page.flags?.[MODULE.ID]?.randomOccurrences,
          linkedEvent: page.system.linkedEvent,
          weekday: page.system.weekday,
          weekNumber: page.system.weekNumber,
          seasonalConfig: page.system.seasonalConfig,
          conditions: page.system.conditions
        };
        return isRecurringMatch(noteData, targetDate);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
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
      const hasValidEndDate = end && end.year != null && end.month != null && end.day != null;
      if (!hasValidEndDate) continue;
      const isSameDay = end.year === start.year && end.month === start.month && end.day === start.day;
      if (isSameDay) continue;

      const repeat = note.system.repeat;
      const duration = daysBetween(start, end);
      const isAllDay = start.hour == null || note.system.allDay;
      const priority = isAllDay ? -1 : start.hour;

      // For repeating multi-day notes, find all occurrences in this month
      if (repeat && repeat !== 'never') {
        // Build noteData that looks like single-day to find occurrence START dates
        const noteData = {
          startDate: start,
          endDate: start,
          repeat: note.system.repeat,
          repeatInterval: note.system.repeatInterval,
          repeatEndDate: note.system.repeatEndDate,
          maxOccurrences: note.system.maxOccurrences,
          moonConditions: note.system.moonConditions,
          randomConfig: note.system.randomConfig,
          cachedRandomOccurrences: note.flags?.[MODULE.ID]?.randomOccurrences,
          linkedEvent: note.system.linkedEvent,
          weekday: note.system.weekday,
          weekNumber: note.system.weekNumber,
          seasonalConfig: note.system.seasonalConfig,
          rangePattern: note.system.rangePattern,
          computedConfig: note.system.computedConfig,
          conditions: note.system.conditions
        };

        // Check previous month for occurrences that extend into this month
        const calendar = CalendarManager.getActiveCalendar();
        const yearZero = calendar?.years?.yearZero ?? 0;
        const prevMonth = month === 0 ? (calendar?.monthsArray.length || 12) - 1 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const prevMonthDays = calendar?.getDaysInMonth(prevMonth, prevYear - yearZero) || 30;

        // Only check days in previous month that could extend into current month
        const checkFromDay = Math.max(1, prevMonthDays - duration);
        for (let d = checkFromDay; d <= prevMonthDays; d++) {
          const checkDate = { year: prevYear, month: prevMonth, day: d };
          if (isRecurringMatch(noteData, checkDate)) {
            const occEnd = addDays(checkDate, duration);
            // Check if this occurrence extends into current month
            if (occEnd.year > year || (occEnd.year === year && occEnd.month >= month)) {
              const endDay = occEnd.month === month && occEnd.year === year ? occEnd.day : daysInMonth;
              multiDayEvents.push({ note, start: checkDate, end: occEnd, startDay: 1, endDay, priority, isContinuation: true });
            }
          }
        }

        // Check current month for occurrence starts
        for (let d = 1; d <= daysInMonth; d++) {
          const checkDate = { year, month, day: d };
          if (isRecurringMatch(noteData, checkDate)) {
            const occEnd = addDays(checkDate, duration);
            const endDay = occEnd.month === month && occEnd.year === year ? occEnd.day : daysInMonth;
            multiDayEvents.push({ note, start: checkDate, end: occEnd, startDay: d, endDay, priority, isContinuation: false });
          }
        }
      } else {
        // Non-repeating multi-day note - original logic
        const startBeforeOrInMonth = start.year < year || (start.year === year && start.month <= month);
        const endInOrAfterMonth = end.year > year || (end.year === year && end.month >= month);
        if (!startBeforeOrInMonth || !endInOrAfterMonth) continue;
        const isContinuation = start.year < year || (start.year === year && start.month < month);
        const startDay = isContinuation ? 1 : start.day;
        const endDay = end.month === month && end.year === year ? end.day : daysInMonth;
        if (endDay < startDay) continue;
        multiDayEvents.push({ note, start, end, startDay, endDay, priority, isContinuation });
      }
    }

    multiDayEvents.sort((a, b) => a.priority - b.priority);

    multiDayEvents.forEach(({ note, startDay, endDay, isContinuation }) => {
      const startPosition = startDay - 1 + startDayOfWeek;
      const endPosition = endDay - 1 + startDayOfWeek;
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
          color: note.system.color || '#4a86e8',
          icon: note.system.icon,
          iconType: note.system.iconType,
          weekIndex: startWeekIndex,
          left,
          width,
          row: eventRow,
          isContinuation
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
            color: note.system.color || '#4a86e8',
            icon: note.system.icon,
            iconType: note.system.iconType,
            weekIndex: weekIdx,
            left,
            width,
            row: eventRow,
            isSegment: true,
            isContinuation: showContinuationIcon
          });
        }
      }
    });

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
      const start = note.system.startDate;
      const end = note.system.endDate;
      const allDay = note.system.allDay;
      const hasValidEnd = end && end.year != null && end.month != null && end.day != null;
      const isSameDay = !hasValidEnd || (end.year === start.year && end.month === start.month && end.day === start.day);

      if (isSameDay) {
        const dayMatch = days.find((d) => d.year === start.year && d.month === start.month && d.day === start.day);
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
          color: note.system.color || '#4a86e8',
          icon: note.system.icon,
          iconType: note.system.iconType,
          day: start.day,
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
          const dayDate = { year: dayData.year, month: dayData.month, day: dayData.day };
          const afterStart =
            dayDate.year > start.year || (dayDate.year === start.year && dayDate.month > start.month) || (dayDate.year === start.year && dayDate.month === start.month && dayDate.day >= start.day);
          const beforeEnd = dayDate.year < end.year || (dayDate.year === end.year && dayDate.month < end.month) || (dayDate.year === end.year && dayDate.month === end.month && dayDate.day <= end.day);
          if (!afterStart || !beforeEnd) continue;
          blocks.push({
            id: note.id,
            name: note.name,
            color: note.system.color || '#4a86e8',
            icon: note.system.icon,
            iconType: note.system.iconType,
            day: dayData.day,
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
   * Adjust window size to exactly fit rendered content.
   * Measures actual DOM elements after render.
   */
  _adjustSizeForView() {
    const windowContent = this.element.querySelector('.window-content');
    const windowHeader = this.element.querySelector('.window-header');
    if (!windowContent) return;
    const contentRect = windowContent.scrollWidth;
    const contentHeight = windowContent.scrollHeight;
    const headerHeight = windowHeader?.offsetHeight || 30;
    this.setPosition({ width: contentRect + 2, height: contentHeight + headerHeight + 2 });
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
    const content = this.element.querySelector('.window-content');
    content?.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, a, input, select, .note-item, .event-block, .multi-day-event')) return;
      e.preventDefault();
      this.close();
      MiniCal.show();
    });

    const searchInput = this.element.querySelector('.search-input');
    if (searchInput) {
      if (this._searchOpen) searchInput.focus();
      const debouncedSearch = foundry.utils.debounce((term) => {
        this._searchTerm = term;
        if (term.length >= 2) this._searchResults = SearchManager.search(term, { searchContent: true });
        else this._searchResults = null;
        this._updateSearchResults();
      }, 300);

      searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this._closeSearch();
      });
    }

    if (this._searchOpen) {
      this._positionSearchPanel();
      const panel = this.element.querySelector('.calendaria-hud-search-panel');
      const button = this.element.querySelector('.search-toggle');
      if (panel && !this._clickOutsideHandler) {
        setTimeout(() => {
          this._clickOutsideHandler = (event) => {
            if (!panel.contains(event.target) && !button?.contains(event.target)) this._closeSearch();
          };
          document.addEventListener('mousedown', this._clickOutsideHandler);
        }, 100);
      }
    }

    WidgetManager.attachWidgetListeners(this.element);
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
    items.push({
      name: 'CALENDARIA.BigCal.ContextMenu.SwapToMiniCal',
      icon: '<i class="fas fa-calendar-alt"></i>',
      callback: () => {
        this.close();
        MiniCal.show();
      }
    });
    items.push({ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => this.close() });
    return items;
  }

  /**
   * Update search results without full re-render.
   */
  _updateSearchResults() {
    const panel = this.element.querySelector('.calendaria-hud-search-panel');
    if (!panel) return;
    const resultsContainer = panel.querySelector('.search-panel-results');
    if (!resultsContainer) return;
    if (this._searchResults?.length) {
      resultsContainer.innerHTML = this._searchResults
        .map((r) => {
          const icons = [];
          if (r.data?.icon) icons.push(`<i class="result-note-icon ${r.data.icon}" style="color: ${r.data.color || '#4a9eff'}" data-tooltip="${localize('CALENDARIA.Search.NoteIcon')}"></i>`);
          if (r.data?.gmOnly) icons.push(`<i class="result-gm-icon fas fa-lock" data-tooltip="${localize('CALENDARIA.Search.GMOnly')}"></i>`);
          if (r.data?.repeatIcon) icons.push(`<i class="result-repeat-icon ${r.data.repeatIcon}"${r.data.repeatTooltip ? ` data-tooltip="${r.data.repeatTooltip}"` : ''}></i>`);
          if (r.data?.categoryIcons?.length) {
            for (const cat of r.data.categoryIcons) icons.push(`<i class="result-category-icon fas ${cat.icon}" style="color: ${cat.color}" data-tooltip="${cat.label}"></i>`);
          }
          return `<div class="search-result-item" data-action="openSearchResult" data-id="${r.id}" data-journal-id="${r.data?.journalId || ''}">
            <div class="result-content">
              <span class="result-name">${r.name}</span>
              ${r.description ? `<span class="result-description">${r.description}</span>` : ''}
            </div>
            ${icons.length ? `<div class="result-icons">${icons.join('')}</div>` : ''}
          </div>`;
        })
        .join('');
      resultsContainer.classList.add('has-results');
    } else if (this._searchTerm?.length >= 2) {
      resultsContainer.innerHTML = `<div class="no-results"><i class="fas fa-search"></i><span>${localize('CALENDARIA.Search.NoResults')}</span></div>`;
      resultsContainer.classList.add('has-results');
    } else {
      resultsContainer.innerHTML = '';
      resultsContainer.classList.remove('has-results');
    }
  }

  /**
   * Position search panel - CSS handles positioning, this just sets dimensions.
   */
  _positionSearchPanel() {
    const panel = this.element.querySelector('.calendaria-hud-search-panel');
    if (!panel) return;
    panel.style.width = '17.5rem';
    panel.style.maxHeight = '21.875rem';
  }

  /**
   * Close search and clean up.
   */
  _closeSearch() {
    if (this._clickOutsideHandler) {
      document.removeEventListener('mousedown', this._clickOutsideHandler);
      this._clickOutsideHandler = null;
    }
    this._searchTerm = '';
    this._searchResults = null;
    this._searchOpen = false;
    this.render();
  }

  /**
   * Set up hook listeners when the application is first rendered
   * @param {object} context - Render context
   * @param {object} options - Render options
   * @override
   */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this._adjustSizeForView();
    ViewUtils.setupDayContextMenu(this.element, '.calendar-day:not(.empty)', this.calendar, {
      onSetDate: () => {
        this._selectedDate = null;
        this.render();
      },
      onCreateNote: () => this.render(),
      extraItems: this.#getContextMenuItems()
    });
    new foundry.applications.ux.ContextMenu.implementation(this.element, '.window-header', this.#getContextMenuItems(), { fixed: true, jQuery: false });
    this._hooks = [];
    const c = game.time.components;
    this._lastDay = `${c.year}-${c.month}-${c.dayOfMonth}`;
    const debouncedRender = foundry.utils.debounce(() => this.render(), 100);
    this._hooks.push({
      name: 'updateJournalEntryPage',
      id: Hooks.on('updateJournalEntryPage', (page, _changes, _options, _userId) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
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
        if (journal.pages.some((p) => p.type === 'calendaria.calendarnote')) debouncedRender();
      })
    });
    this._hooks.push({ name: HOOKS.WEATHER_CHANGE, id: Hooks.on(HOOKS.WEATHER_CHANGE, () => debouncedRender()) });
    this._hooks.push({ name: HOOKS.WIDGETS_REFRESH, id: Hooks.on(HOOKS.WIDGETS_REFRESH, () => debouncedRender()) });
    this._hooks.push({ name: 'calendaria.displayFormatsChanged', id: Hooks.on('calendaria.displayFormatsChanged', () => debouncedRender()) });
    this._hooks.push({ name: HOOKS.WORLD_TIME_UPDATED, id: Hooks.on(HOOKS.WORLD_TIME_UPDATED, this._onUpdateWorldTime.bind(this)) });
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
      this.render();
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
        let newDay = current.day + direction * daysInWeek;
        let newMonth = current.month;
        let newYear = current.year;
        const daysInCurrentMonth = calendar.getDaysInMonth(newMonth, newYear - yearZero);
        if (newDay > daysInCurrentMonth) {
          newDay -= daysInCurrentMonth;
          newMonth++;
          if (newMonth >= calendar.monthsArray.length) {
            newMonth = 0;
            newYear++;
          }
        } else if (newDay < 1) {
          newMonth--;
          if (newMonth < 0) {
            newMonth = calendar.monthsArray.length - 1;
            newYear--;
          }
          newDay += calendar.getDaysInMonth(newMonth, newYear - yearZero);
        }

        this.viewedDate = { year: newYear, month: newMonth, day: newDay };
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
          let newDay = (current.day || 1) + direction * daysInWeek;
          let newYear = current.year;
          if (newDay > daysInYear) {
            newDay -= daysInYear;
            newYear++;
          } else if (newDay < 1) {
            const prevYearDays = calendar.getDaysInYear(newYear - 1 - yearZero);
            newDay += prevYearDays;
            newYear--;
          }
          this.viewedDate = { year: newYear, month: 0, day: newDay };
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

        this.viewedDate = { year: newYear, month: newMonth, day: 1 };
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
    let day, month, year, hour;
    if (this._selectedTimeSlot) {
      ({ day, month, year, hour } = this._selectedTimeSlot);
    } else {
      day = target.dataset.day;
      month = target.dataset.month;
      year = target.dataset.year;
      hour = target.dataset.hour ?? 12;
    }
    const calendar = this.calendar;
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    const endHour = (parseInt(hour) + 1) % hoursPerDay;
    const endDay = endHour < parseInt(hour) ? parseInt(day) + 1 : parseInt(day);
    const page = await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), minute: 0 },
        endDate: { year: parseInt(year), month: parseInt(month), day: endDay, hour: endHour, minute: 0 }
      }
    });
    this._selectedTimeSlot = null;
    if (page) page.sheet.render(true, { mode: 'edit' });
  }

  /**
   * Add a new note for today or the selected date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onAddNoteToday(_event, _target) {
    let day, month, year, hour, minute;
    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    if (this._selectedTimeSlot) {
      ({ day, month, year, hour } = this._selectedTimeSlot);
      minute = 0;
    } else if (this._selectedDate) {
      ({ day, month, year } = this._selectedDate);
      hour = 12;
      minute = 0;
    } else {
      const today = game.time.components;
      year = today.year + yearZero;
      month = today.month;
      day = (today.dayOfMonth ?? 0) + 1;
      hour = today.hour ?? 12;
      minute = today.minute ?? 0;
    }

    const endHour = (parseInt(hour) + 1) % hoursPerDay;
    const endDay = endHour < parseInt(hour) ? parseInt(day) + 1 : parseInt(day);
    const page = await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), minute: parseInt(minute) },
        endDate: { year: parseInt(year), month: parseInt(month), day: endDay, hour: endHour, minute: parseInt(minute) }
      }
    });
    this._selectedTimeSlot = null;
    if (page) page.sheet.render(true, { mode: 'edit' });
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
    if (page) page.sheet.render(true, { mode: 'edit' });
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
        window: { title: localize('CALENDARIA.ContextMenu.DeleteNote') },
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
    this.viewedDate = { year, month, day: 1 };
    await this.render();
    this._adjustSizeForView();
  }

  /**
   * Select a day in the calendar.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with date data
   */
  static async _onSelectDay(_event, target) {
    const day = parseInt(target.dataset.day);
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);
    if (this._selectedDate?.year === year && this._selectedDate?.month === month && this._selectedDate?.day === day) this._selectedDate = null;
    else this._selectedDate = { year, month, day };
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
    await calendar.jumpToDate({ year: dateToSet.year, month: dateToSet.month, day: dateToSet.day });
    this._selectedDate = null;
    await this.render();
  }

  /**
   * Select a time slot in week view.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with time data
   */
  static async _onSelectTimeSlot(_event, target) {
    const day = parseInt(target.dataset.day);
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);
    const hour = parseInt(target.dataset.hour);
    if (this._selectedTimeSlot?.year === year && this._selectedTimeSlot?.month === month && this._selectedTimeSlot?.day === day && this._selectedTimeSlot?.hour === hour) this._selectedTimeSlot = null;
    else this._selectedTimeSlot = { year, month, day, hour };
    await this.render();
  }

  /**
   * Toggle between full and MiniCal views.
   * Closes this window and opens the MiniCal.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onToggleCompact(_event, _target) {
    await this.close();
    MiniCal.show();
  }

  /**
   * Cycle through weather presets or generate new weather.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onOpenWeatherPicker(_event, _target) {
    if (!game.user.isGM) return;
    await openWeatherPicker();
  }

  /**
   * Get weather context for template.
   * @returns {object|null} Weather context or null if no weather set
   */
  _getWeatherContext() {
    const weather = WeatherManager.getCurrentWeather();
    if (!weather) return null;
    return {
      id: weather.id,
      label: localize(weather.label),
      icon: weather.icon,
      color: weather.color,
      temperature: WeatherManager.formatTemperature(WeatherManager.getTemperature()),
      tooltip: weather.description ? localize(weather.description) : localize(weather.label)
    };
  }

  /**
   * Toggle the search input visibility.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onToggleSearch(_event, _target) {
    this._searchOpen = !this._searchOpen;
    if (!this._searchOpen) {
      this._searchTerm = '';
      this._searchResults = null;
    }
    await this.render();
  }

  /**
   * Close the search panel.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onCloseSearch(_event, _target) {
    this._searchTerm = '';
    this._searchResults = null;
    this._searchOpen = false;
    await this.render();
  }

  /**
   * Open a search result (note).
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with result data
   */
  static async _onOpenSearchResult(_event, target) {
    const id = target.dataset.id;
    const journalId = target.dataset.journalId;
    const page = NoteManager.getFullNote(id);
    if (page) page.sheet.render(true, { mode: 'view' });
    else if (journalId) {
      const journal = game.journal.get(journalId);
      if (journal) journal.sheet.render(true, { pageId: id });
    }
    this._searchTerm = '';
    this._searchResults = null;
    this._searchOpen = false;
    await this.render();
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
    this.viewedDate = { year, month, day: 1 };
    await this.render();
  }

  /**
   * Get the singleton instance from Foundry's application registry.
   * @returns {BigCal|undefined} The instance if it exists
   */
  static get instance() {
    return foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
  }

  /**
   * Show the BigCal application.
   * @static
   * @returns {BigCal} The BigCal instance
   */
  static show() {
    const instance = this.instance ?? new BigCal();
    instance.render({ force: true });
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
