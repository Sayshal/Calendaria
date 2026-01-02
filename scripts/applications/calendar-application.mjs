/**
 * Calendar Application
 * Standalone application for displaying the calendar UI.
 * This is NOT a sheet - it's an independent application.
 * @module Applications/CalendarApplication
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SETTINGS, TEMPLATES } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { dayOfWeek } from '../notes/utils/date-utils.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';
import SearchManager from '../search/search-manager.mjs';
import { formatForLocation } from '../utils/format-utils.mjs';
import { format, localize } from '../utils/localization.mjs';
import WeatherManager from '../weather/weather-manager.mjs';
import { openWeatherPicker } from '../weather/weather-picker.mjs';
import * as ViewUtils from './calendar-view-utils.mjs';
import { MiniCalendar } from './mini-calendar.mjs';
import { SettingsPanel } from './settings/settings-panel.mjs';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Calendar Application - displays the calendar UI.
 * @extends ApplicationV2
 */
export class CalendarApplication extends HandlebarsApplicationMixin(ApplicationV2) {
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
    classes: ['calendaria', 'calendar-application'],
    tag: 'div',
    window: { contentClasses: ['calendar-application'], icon: 'fas fa-calendar', resizable: false },
    actions: {
      navigate: CalendarApplication._onNavigate,
      today: CalendarApplication._onToday,
      addNote: CalendarApplication._onAddNote,
      addNoteToday: CalendarApplication._onAddNoteToday,
      editNote: CalendarApplication._onEditNote,
      deleteNote: CalendarApplication._onDeleteNote,
      changeView: CalendarApplication._onChangeView,
      selectDay: CalendarApplication._onSelectDay,
      selectMonth: CalendarApplication._onSelectMonth,
      setAsCurrentDate: CalendarApplication._onSetAsCurrentDate,
      selectTimeSlot: CalendarApplication._onSelectTimeSlot,
      toggleCompact: CalendarApplication._onToggleCompact,
      openWeatherPicker: CalendarApplication._onOpenWeatherPicker,
      toggleSearch: CalendarApplication._onToggleSearch,
      closeSearch: CalendarApplication._onCloseSearch,
      openSearchResult: CalendarApplication._onOpenSearchResult,
      openSettings: CalendarApplication._onOpenSettings,
      navigateToMonth: CalendarApplication._onNavigateToMonth
    },
    position: { width: 'auto', height: 'auto' }
  };

  static PARTS = { header: { template: TEMPLATES.SHEETS.CALENDAR_HEADER }, content: { template: TEMPLATES.SHEETS.CALENDAR_CONTENT } };

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
    context.showMoonPhases = game.settings.get(MODULE.ID, SETTINGS.SHOW_MOON_PHASES);
    context.weather = this._getWeatherContext();
    if (calendar.cycles?.length) {
      const yearZeroOffset = calendar.years?.yearZero ?? 0;
      const viewedComponents = { year: viewedDate.year - yearZeroOffset, month: viewedDate.month, dayOfMonth: (viewedDate.day ?? 1) - 1, hour: 12, minute: 0, second: 0 };
      const cycleResult = calendar.getCycleValues(viewedComponents);
      context.cycleText = cycleResult.text;
      context.cycleValues = cycleResult.values;
    }

    context.searchTerm = this._searchTerm;
    context.searchOpen = this._searchOpen;
    context.searchResults = this._searchResults || [];
    return context;
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
   * Generate calendar grid data for month view
   * @param {object} calendar - The calendar configuration
   * @param {object} date - The date being viewed
   * @param {Array} notes - Calendar notes to display
   * @returns {object} Calendar grid data for rendering
   */
  _generateCalendarData(calendar, date, notes) {
    const { year, month } = date;
    const monthData = calendar.months?.values?.[month];
    if (!monthData) return null;
    const daysInMonth = monthData.days;
    const daysInWeek = calendar.days?.values?.length || 7;
    const weeks = [];
    let currentWeek = [];
    const showMoons = game.settings.get(MODULE.ID, SETTINGS.SHOW_MOON_PHASES) && calendar.moons?.length;
    const hasFixedStart = monthData?.startingWeekday != null;
    const startDayOfWeek = hasFixedStart ? monthData.startingWeekday : dayOfWeek({ year, month, day: 1 });
    if (startDayOfWeek > 0) {
      const totalMonths = calendar.months?.values?.length ?? 12;
      const prevDays = [];
      let remainingSlots = startDayOfWeek;
      let checkMonth = month;
      let checkYear = year;
      while (remainingSlots > 0) {
        checkMonth = checkMonth === 0 ? totalMonths - 1 : checkMonth - 1;
        if (checkMonth === totalMonths - 1) checkYear--;
        const checkMonthData = calendar.months?.values?.[checkMonth];
        const checkMonthDays = checkMonthData?.days ?? 30;
        const daysToTake = Math.min(remainingSlots, checkMonthDays);
        for (let d = checkMonthDays - daysToTake + 1; d <= checkMonthDays; d++) prevDays.unshift({ day: d, year: checkYear, month: checkMonth });
        remainingSlots -= daysToTake;
      }
      for (const pd of prevDays) currentWeek.push({ day: pd.day, year: pd.year, month: pd.month, isFromOtherMonth: true, isToday: this._isToday(pd.year, pd.month, pd.day) });
    }

    let dayIndex = startDayOfWeek;
    for (let day = 1; day <= daysInMonth; day++) {
      const dayNotes = this._getNotesForDay(notes, year, month, day);
      const festivalDay = calendar.findFestivalDay({ year, month, dayOfMonth: day - 1 });
      let moonPhases = null;
      if (showMoons) {
        let dayOfYear = day - 1;
        for (let idx = 0; idx < month; idx++) {
          const m = calendar.months.values[idx];
          dayOfYear += m.days;
        }
        const dayComponents = { year: year - (calendar.years?.yearZero ?? 0), month, day: dayOfYear, hour: 12, minute: 0, second: 0 };
        const dayWorldTime = calendar.componentsToTime(dayComponents);
        moonPhases = calendar.moons
          .map((moon, index) => {
            const phase = calendar.getMoonPhase(index, dayWorldTime);
            if (!phase) return null;
            return { moonName: localize(moon.name), phaseName: localize(phase.name), icon: phase.icon, color: moon.color || null };
          })
          .filter(Boolean);
      }
      const weekdayData = calendar.days?.values?.[currentWeek.length];
      currentWeek.push({
        day,
        year,
        month,
        isToday: this._isToday(year, month, day),
        isSelected: this._isSelected(year, month, day),
        notes: dayNotes,
        isOddDay: dayIndex % 2 === 1,
        isFestival: !!festivalDay,
        festivalName: festivalDay ? localize(festivalDay.name) : null,
        isRestDay: weekdayData?.isRestDay || false,
        moonPhases
      });
      dayIndex++;
      if (currentWeek.length === daysInWeek) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0 && currentWeek.length < daysInWeek) {
      const totalMonths = calendar.months?.values?.length ?? 12;
      let remainingSlots = daysInWeek - currentWeek.length;
      let checkMonth = month;
      let checkYear = year;
      let dayInMonth = 1;
      while (remainingSlots > 0) {
        if (dayInMonth > (calendar.months?.values?.[checkMonth]?.days ?? 30) || checkMonth === month) {
          checkMonth = checkMonth === totalMonths - 1 ? 0 : checkMonth + 1;
          if (checkMonth === 0) checkYear++;
          dayInMonth = 1;
        }

        const checkMonthDays = calendar.months?.values?.[checkMonth]?.days ?? 30;
        const daysToTake = Math.min(remainingSlots, checkMonthDays - dayInMonth + 1);
        for (let d = dayInMonth; d < dayInMonth + daysToTake; d++) {
          currentWeek.push({ day: d, year: checkYear, month: checkMonth, isFromOtherMonth: true, isToday: this._isToday(checkYear, checkMonth, d) });
        }
        dayInMonth += daysToTake;
        remainingSlots -= daysToTake;
      }
    }

    if (currentWeek.length > 0) weeks.push(currentWeek);
    const allMultiDayEvents = this._findMultiDayEvents(notes, year, month, startDayOfWeek, daysInWeek, daysInMonth);
    weeks.forEach((week, weekIndex) => {
      week.multiDayEvents = allMultiDayEvents.filter((e) => e.weekIndex === weekIndex);
    });
    const viewedComponents = { month, dayOfMonth: Math.floor(daysInMonth / 2) };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    const monthWeekdays = calendar.getWeekdaysForMonth?.(month) ?? calendar.days?.values ?? [];
    const weekdaysData = monthWeekdays.map((wd) => ({ name: localize(wd.name), isRestDay: wd.isRestDay || false }));
    const headerComponents = { year, month, dayOfMonth: 1 };
    const formattedHeader = formatForLocation(calendar, headerComponents, 'fullCalendarHeader');
    return {
      year,
      month,
      monthName: localize(monthData.name),
      yearDisplay: calendar.formatYearWithEra?.(year) ?? String(year),
      formattedHeader,
      weeks,
      weekdays: weekdaysData,
      daysInWeek,
      currentSeason,
      currentEra
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
    const currentDayOfWeek = dayOfWeek({ year, month, day });
    let weekStartDay = day - currentDayOfWeek;
    let weekStartMonth = month;
    let weekStartYear = year;
    const monthsInYear = calendar.months?.values?.length ?? 12;
    if (weekStartDay < 1) {
      weekStartMonth--;
      if (weekStartMonth < 0) {
        weekStartMonth = monthsInYear - 1;
        weekStartYear--;
      }
      const prevMonthData = calendar.months?.values?.[weekStartMonth];
      weekStartDay = prevMonthData ? prevMonthData.days + weekStartDay : 1;
    }

    const currentTime = game.time.components || {};
    const currentHour = currentTime.hour ?? 0;
    const daysInWeek = calendar.days?.values?.length || 7;
    const days = [];
    let currentDay = weekStartDay;
    let currentMonth = weekStartMonth;
    let currentYear = weekStartYear;
    for (let i = 0; i < daysInWeek; i++) {
      const monthData = calendar.months?.values?.[currentMonth];
      if (!monthData) break;
      const dayNotes = this._getNotesForDay(notes, currentYear, currentMonth, currentDay);
      const monthWeekdays = calendar.getWeekdaysForMonth?.(currentMonth) ?? calendar.days?.values ?? [];
      const weekdayData = monthWeekdays[i];
      const dayName = weekdayData?.name ? localize(weekdayData.name) : '';
      const monthName = calendar.months?.values?.[currentMonth]?.name ? localize(calendar.months.values[currentMonth].name) : '';
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

      currentDay++;
      if (currentDay > monthData.days) {
        currentDay = 1;
        currentMonth++;
        if (currentMonth >= calendar.months.values.length) {
          currentMonth = 0;
          currentYear++;
        }
      }
    }
    const timeSlots = [];
    for (let hour = 0; hour < 24; hour++) timeSlots.push({ label: hour.toString(), hour: hour });
    const eventBlocks = this._createEventBlocks(notes, days);
    days.forEach((day) => {
      day.eventBlocks = eventBlocks.filter((block) => block.year === day.year && block.month === day.month && block.day === day.day);
    });
    let dayOfYear = day;
    for (let m = 0; m < month; m++) dayOfYear += calendar.months?.values?.[m]?.days || 0;
    const weekNumber = Math.ceil(dayOfYear / daysInWeek);
    const midWeekDay = days[Math.floor(days.length / 2)];
    const viewedComponents = { month: midWeekDay?.month ?? month, dayOfMonth: (midWeekDay?.day ?? day) - 1 };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    const weekWeekdays = calendar.getWeekdaysForMonth?.(weekStartMonth) ?? calendar.days?.values ?? [];
    const weekHeaderComponents = { year: weekStartYear, month: weekStartMonth, dayOfMonth: weekStartDay };
    const formattedHeader = formatForLocation(calendar, weekHeaderComponents, 'fullCalendarHeader');
    return {
      year: weekStartYear,
      month: weekStartMonth,
      monthName: calendar.months?.values?.[month]?.name ? localize(calendar.months.values[month].name) : '',
      yearDisplay: calendar.formatYearWithEra?.(weekStartYear) ?? String(weekStartYear),
      formattedHeader,
      weekNumber,
      days: days,
      timeSlots: timeSlots,
      weekdays: weekWeekdays.map((wd) => ({ name: localize(wd.name), isRestDay: wd.isRestDay || false })),
      daysInWeek,
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
    const yearGrid = [];
    const startYear = year - 4;
    for (let row = 0; row < 3; row++) {
      const yearRow = [];
      for (let col = 0; col < 3; col++) {
        const displayYear = startYear + row * 3 + col;
        yearRow.push({
          year: displayYear,
          isCurrent: displayYear === year,
          months:
            calendar.months?.values?.map((m, idx) => {
              const localizedName = localize(m.name);
              const localizedAbbrev = m.abbreviation ? localize(m.abbreviation) : localizedName;
              const abbrevData = this._abbreviateMonthName(localizedAbbrev);
              return { localizedName, abbreviation: abbrevData.abbrev, fullAbbreviation: localizedAbbrev, tooltipText: `${localizedName} (${localizedAbbrev})`, month: idx, year: displayYear };
            }) || []
        });
      }
      yearGrid.push(yearRow);
    }
    const viewedComponents = { month: 0, dayOfMonth: 0 };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    return {
      year,
      startYear,
      endYear: startYear + 8,
      startYearDisplay: calendar.formatYearWithEra?.(startYear) ?? String(startYear),
      endYearDisplay: calendar.formatYearWithEra?.(startYear + 8) ?? String(startYear + 8),
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
    return notePages.filter((page) => {
      const start = page.system.startDate;
      const end = page.system.endDate;
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
    });
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
    const multiDayEvents = notes
      .map((note) => {
        const start = note.system.startDate;
        const end = note.system.endDate;
        const hasValidEndDate = end && end.year != null && end.month != null && end.day != null;
        if (!hasValidEndDate) return null;
        const isSameDay = end.year === start.year && end.month === start.month && end.day === start.day;
        if (isSameDay) return null;
        const startBeforeOrInMonth = start.year < year || (start.year === year && start.month <= month);
        const endInOrAfterMonth = end.year > year || (end.year === year && end.month >= month);
        if (!startBeforeOrInMonth || !endInOrAfterMonth) return null;
        const isContinuation = start.year < year || (start.year === year && start.month < month);
        const startDay = isContinuation ? 1 : start.day;
        const endDay = end.month === month && end.year === year ? end.day : daysInMonth;
        if (endDay < startDay) return null;
        const isAllDay = start.hour == null || note.system.allDay;
        const priority = isAllDay ? -1 : start.hour;
        return { note, start, end, startDay, endDay, priority, isContinuation };
      })
      .filter((e) => e !== null)
      .sort((a, b) => a.priority - b.priority);

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
    notes.forEach((note) => {
      const start = note.system.startDate;
      const end = note.system.endDate;
      const allDay = note.system.allDay;
      const dayMatch = days.find((d) => d.year === start.year && d.month === start.month && d.day === start.day);
      if (!dayMatch) return;
      const startHour = allDay ? 0 : (start.hour ?? 0);
      let hourSpan = 1;
      if (allDay) {
        hourSpan = 24;
      } else if (end && end.year === start.year && end.month === start.month && end.day === start.day) {
        const endHour = end.hour ?? startHour;
        hourSpan = Math.max(endHour - startHour, 1);
      }

      const startTime = allDay ? 'All Day' : `${startHour.toString().padStart(2, '0')}:${(start.minute ?? 0).toString().padStart(2, '0')}`;
      const endTime = end && !allDay ? `${(end.hour ?? 0).toString().padStart(2, '0')}:${(end.minute ?? 0).toString().padStart(2, '0')}` : null;
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
    });

    return blocks;
  }

  /* -------------------------------------------- */
  /*  Lifecycle Methods                           */
  /* -------------------------------------------- */

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
          if (r.data?.repeatIcon) icons.push(`<i class="result-repeat-icon ${r.data.repeatIcon}" data-tooltip="${r.data.repeatTooltip || ''}"></i>`);
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
    panel.style.width = '280px';
    panel.style.maxHeight = '350px';
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
      onCreateNote: () => this.render()
    });
    this._hooks = [];
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
      name: 'deleteJournalEntryPage',
      id: Hooks.on('deleteJournalEntryPage', (page, _options, _userId) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });
    this._hooks.push({ name: HOOKS.WEATHER_CHANGE, id: Hooks.on(HOOKS.WEATHER_CHANGE, () => debouncedRender()) });
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

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Navigate forward or backward in the calendar view.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element with direction data
   */
  static async _onNavigate(_event, target) {
    const direction = target.dataset.direction === 'next' ? 1 : -1;
    const current = this.viewedDate;
    const calendar = this.calendar;
    switch (this._displayMode) {
      case 'week': {
        const daysInWeek = calendar.days?.values?.length || 7;
        let newDay = current.day + direction * daysInWeek;
        let newMonth = current.month;
        let newYear = current.year;
        const monthData = calendar.months?.values?.[newMonth];
        if (newDay > monthData?.days) {
          newDay -= monthData.days;
          newMonth++;
          if (newMonth >= calendar.months.values.length) {
            newMonth = 0;
            newYear++;
          }
        } else if (newDay < 1) {
          newMonth--;
          if (newMonth < 0) {
            newMonth = calendar.months.values.length - 1;
            newYear--;
          }
          const prevMonthData = calendar.months?.values?.[newMonth];
          newDay += prevMonthData?.days || 30;
        }

        this.viewedDate = { year: newYear, month: newMonth, day: newDay };
        break;
      }
      case 'year': {
        this.viewedDate = { ...current, year: current.year + direction * 9 };
        break;
      }
      default: {
        let newMonth = current.month + direction;
        let newYear = current.year;
        if (newMonth >= calendar.months.values.length) {
          newMonth = 0;
          newYear++;
        } else if (newMonth < 0) {
          newMonth = calendar.months.values.length - 1;
          newYear--;
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
      hour = 12;
    }
    const endHour = (parseInt(hour) + 1) % 24;
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
    if (this._selectedTimeSlot) {
      ({ day, month, year, hour } = this._selectedTimeSlot);
      minute = 0;
    } else if (this._selectedDate) {
      ({ day, month, year } = this._selectedDate);
      hour = 12;
      minute = 0;
    } else {
      const today = game.time.components;
      const calendar = this.calendar;
      const yearZero = calendar?.years?.yearZero ?? 0;
      year = today.year + yearZero;
      month = today.month;
      day = (today.dayOfMonth ?? 0) + 1;
      hour = today.hour ?? 12;
      minute = today.minute ?? 0;
    }

    const endHour = (parseInt(hour) + 1) % 24;
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
    const year = parseInt(target.dataset.year);
    const month = parseInt(target.dataset.month);
    this._displayMode = 'month';
    this.viewedDate = { year, month, day: 1 };
    await this.render();
    this._adjustSizeForView();
  }

  /**
   * Select a day in the calendar.
   * @param {PointerEvent} event - The click event
   * @param {HTMLElement} target - The clicked element with date data
   */
  static async _onSelectDay(event, target) {
    const wasDoubleClick = await ViewUtils.handleDayClick(event, this.calendar, {
      onSetDate: () => {
        this._selectedDate = null;
        this.render();
      },
      onCreateNote: () => this.render()
    });
    if (wasDoubleClick) return;
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
   * Toggle between full and MiniCalendar views.
   * Closes this window and opens the MiniCalendar.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onToggleCompact(_event, _target) {
    await this.close();
    const existing = foundry.applications.instances.get('mini-calendar');
    if (existing) existing.render(true, { focus: true });
    else new MiniCalendar().render(true);
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
}
