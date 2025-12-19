/**
 * Calendar Application
 * Standalone application for displaying the calendar UI.
 * This is NOT a sheet - it's an independent application.
 *
 * @module Applications/CalendarApplication
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { dayOfWeek } from '../notes/utils/date-utils.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';
import { MODULE, SETTINGS, HOOKS, TEMPLATES } from '../constants.mjs';
import * as ViewUtils from './calendar-view-utils.mjs';
import WeatherManager from '../weather/weather-manager.mjs';
import { openWeatherPicker } from '../weather/weather-picker.mjs';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class CalendarApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._viewedDate = null;
    this._calendarId = options.calendarId || null;
    this._displayMode = 'month';
    this._selectedDate = null;
    this._selectedTimeSlot = null;
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
      openWeatherPicker: CalendarApplication._onOpenWeatherPicker
    },
    position: { width: 'auto', height: 'auto' }
  };

  static PARTS = {
    header: { template: TEMPLATES.SHEETS.CALENDAR_HEADER },
    content: { template: TEMPLATES.SHEETS.CALENDAR_CONTENT }
  };

  get title() {
    return this.calendar?.name || '';
  }

  /**
   * Get the calendar to display
   * @returns {CalendariaCalendar}
   */
  get calendar() {
    return this._calendarId ? CalendarManager.getCalendar(this._calendarId) : CalendarManager.getActiveCalendar();
  }

  /**
   * Get the date being viewed/displayed in the calendar
   * @returns {object}
   */
  get viewedDate() {
    if (this._viewedDate) return this._viewedDate;

    // Use current game time
    const components = game.time.components;
    const calendar = this.calendar;

    // Adjust year for display (add yearZero offset)
    const yearZero = calendar?.years?.yearZero ?? 0;

    // Use dayOfMonth (0-indexed) converted to 1-indexed day
    const dayOfMonth = (components.dayOfMonth ?? 0) + 1;

    return { ...components, year: components.year + yearZero, day: dayOfMonth };
  }

  set viewedDate(date) {
    this._viewedDate = date;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const viewedDate = this.viewedDate;

    // Basic context
    context.editable = game.user.isGM;

    // Calendar data
    context.calendar = calendar;
    context.viewedDate = viewedDate;
    context.displayMode = this._displayMode;
    context.selectedDate = this._selectedDate;
    context.selectedTimeSlot = this._selectedTimeSlot;

    // Check if selected date (or viewed date if none selected) matches game time
    const today = game.time.components;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const todayYear = today.year + yearZero;
    const todayMonth = today.month;
    const todayDay = (today.dayOfMonth ?? 0) + 1;

    if (this._selectedDate) context.isToday = this._selectedDate.year === todayYear && this._selectedDate.month === todayMonth && this._selectedDate.day === todayDay;
    else context.isToday = viewedDate.year === todayYear && viewedDate.month === todayMonth && viewedDate.day === todayDay;

    // Get notes from journal pages (filtered by active calendar)
    const allNotes = ViewUtils.getCalendarNotes();
    context.notes = allNotes;
    context.visibleNotes = ViewUtils.getVisibleNotes(allNotes);

    // Generate calendar data based on display mode
    if (calendar) {
      switch (this._displayMode) {
        case 'week':
          context.calendarData = this._generateWeekData(calendar, viewedDate, context.visibleNotes);
          break;
        case 'year':
          context.calendarData = this._generateYearData(calendar, viewedDate);
          break;
        default: // month
          context.calendarData = this._generateCalendarData(calendar, viewedDate, context.visibleNotes);
          break;
      }
    }

    // Filter notes for current view
    context.currentMonthNotes = this._getNotesForMonth(context.visibleNotes, viewedDate.year, viewedDate.month);

    // Moon phases setting for use in calendar data generation
    context.showMoonPhases = game.settings.get(MODULE.ID, SETTINGS.SHOW_MOON_PHASES);

    // Weather badge data
    context.weather = this._getWeatherContext();

    // Get cycle values for display in header (based on viewed date, not world time)
    if (calendar.cycles?.length) {
      const yearZeroOffset = calendar.years?.yearZero ?? 0;
      const viewedComponents = { year: viewedDate.year - yearZeroOffset, month: viewedDate.month, dayOfMonth: (viewedDate.day ?? 1) - 1, hour: 12, minute: 0, second: 0 };
      const cycleResult = calendar.getCycleValues(viewedComponents);
      context.cycleText = cycleResult.text;
      context.cycleValues = cycleResult.values;
    }

    return context;
  }

  /**
   * Abbreviate month name if longer than 5 characters
   * Takes first letter of each word
   * @param {string} monthName - Full month name
   * @returns {{full: string, abbrev: string, useAbbrev: boolean}}
   */
  _abbreviateMonthName(monthName) {
    if (!monthName) return { full: '', abbrev: '', useAbbrev: false };
    const full = monthName;
    const useAbbrev = monthName.length > 5;

    if (!useAbbrev) return { full, abbrev: full, useAbbrev: false };

    // Take first letter of each word
    const words = monthName.split(' ');
    const abbrev = words.map((word) => word.charAt(0).toUpperCase()).join('');

    return { full, abbrev, useAbbrev: true };
  }

  /**
   * Generate calendar grid data for month view
   * @param {CalendariaCalendar} calendar
   * @param {object} date
   * @param {Array} notes
   * @returns {object}
   */
  _generateCalendarData(calendar, date, notes) {
    const { year, month } = date;

    const monthData = calendar.months?.values?.[month];

    if (!monthData) return null;

    const daysInMonth = monthData.days;
    const daysInWeek = calendar.days?.values?.length || 7;
    const weeks = [];
    let currentWeek = [];

    // Check if moon phases should be shown
    const showMoons = game.settings.get(MODULE.ID, SETTINGS.SHOW_MOON_PHASES) && calendar.moons?.length;

    // Calculate starting day of week for the first day of the month
    // If month has startingWeekday set, use that; otherwise calculate normally
    const hasFixedStart = monthData?.startingWeekday != null;
    const startDayOfWeek = hasFixedStart ? monthData.startingWeekday : dayOfWeek({ year, month, day: 1 });

    // Add empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) currentWeek.push({ empty: true });

    // Add days of the month
    let dayIndex = startDayOfWeek;
    for (let day = 1; day <= daysInMonth; day++) {
      const dayNotes = this._getNotesForDay(notes, year, month, day);

      // Check if this day is a festival day
      const festivalDay = calendar.findFestivalDay({ year, month, dayOfMonth: day - 1 });

      // Get moon phases for this day
      let moonPhases = null;
      if (showMoons) {
        // Calculate day of year (0-indexed) from month and day
        let dayOfYear = day - 1;
        for (let idx = 0; idx < month; idx++) {
          const m = calendar.months.values[idx];
          dayOfYear += m.days;
        }

        // Build complete time components for this day
        const dayComponents = { year: year - (calendar.years?.yearZero ?? 0), month, day: dayOfYear, hour: 12, minute: 0, second: 0 };
        const dayWorldTime = calendar.componentsToTime(dayComponents);
        moonPhases = calendar.moons
          .map((moon, index) => {
            const phase = calendar.getMoonPhase(index, dayWorldTime);
            if (!phase) return null;
            return {
              moonName: game.i18n.localize(moon.name),
              phaseName: game.i18n.localize(phase.name),
              icon: phase.icon,
              color: moon.color || null
            };
          })
          .filter(Boolean);
      }

      currentWeek.push({
        day,
        year,
        month,
        isToday: this._isToday(year, month, day),
        isSelected: this._isSelected(year, month, day),
        notes: dayNotes,
        isOddDay: dayIndex % 2 === 1,
        isFestival: !!festivalDay,
        festivalName: festivalDay ? game.i18n.localize(festivalDay.name) : null,
        moonPhases
      });
      dayIndex++;

      // Start new week when we reach the week length
      if (currentWeek.length === daysInWeek) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Add remaining empty cells
    while (currentWeek.length > 0 && currentWeek.length < daysInWeek) currentWeek.push({ empty: true });

    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Find multi-day events and attach them to their respective weeks
    const allMultiDayEvents = this._findMultiDayEvents(notes, year, month, startDayOfWeek, daysInWeek, daysInMonth);

    // Attach events to their weeks
    weeks.forEach((week, weekIndex) => {
      week.multiDayEvents = allMultiDayEvents.filter((e) => e.weekIndex === weekIndex);
    });

    // Get season and era for the viewed month (use mid-month day for accuracy)
    const viewedComponents = { month, dayOfMonth: Math.floor(daysInMonth / 2) };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();

    return {
      year,
      month,
      monthName: game.i18n.localize(monthData.name),
      yearDisplay: calendar.formatYearWithEra?.(year) ?? String(year),
      weeks,
      weekdays: calendar.days?.values?.map((wd) => game.i18n.localize(wd.name)) || [],
      daysInWeek,
      currentSeason,
      currentEra
    };
  }

  /**
   * Generate calendar grid data for week view
   * @param {CalendariaCalendar} calendar
   * @param {object} date
   * @param {Array} notes
   * @returns {object}
   */
  _generateWeekData(calendar, date, notes) {
    const { year, month, day } = date;

    // Calculate which day of the week this is
    const currentDayOfWeek = dayOfWeek({ year, month, day });

    // Calculate the start of the week
    let weekStartDay = day - currentDayOfWeek;
    let weekStartMonth = month;
    let weekStartYear = year;

    // Handle month boundaries (simplified)
    if (weekStartDay < 1) {
      weekStartMonth--;
      if (weekStartMonth < 0) {
        weekStartMonth = 11;
        weekStartYear--;
      }
      const prevMonthData = calendar.months?.values?.[weekStartMonth];
      weekStartDay = prevMonthData ? prevMonthData.days + weekStartDay : 1;
    }

    // Get current time for highlighting
    const currentTime = game.time.components || {};
    const currentHour = currentTime.hour ?? 0;

    // Generate days for the week
    const daysInWeek = calendar.days?.values?.length || 7;
    const days = [];
    let currentDay = weekStartDay;
    let currentMonth = weekStartMonth;
    let currentYear = weekStartYear;

    for (let i = 0; i < daysInWeek; i++) {
      const monthData = calendar.months?.values?.[currentMonth];
      if (!monthData) break;

      const dayNotes = this._getNotesForDay(notes, currentYear, currentMonth, currentDay);
      const dayName = calendar.days?.values?.[i]?.name ? game.i18n.localize(calendar.days.values[i].name) : '';
      const monthName = calendar.months?.values?.[currentMonth]?.name ? game.i18n.localize(calendar.months.values[currentMonth].name) : '';

      const isToday = this._isToday(currentYear, currentMonth, currentDay);

      // Check if this day has a selected time slot
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
        notes: dayNotes
      });

      // Move to next day
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

    // Generate time slots (1-hour increments for 24-hour view)
    const timeSlots = [];
    for (let hour = 0; hour < 24; hour++) timeSlots.push({ label: hour.toString(), hour: hour });

    // Create event blocks for week view
    const eventBlocks = this._createEventBlocks(notes, days);

    // Attach event blocks to their respective days
    days.forEach((day) => {
      day.eventBlocks = eventBlocks.filter((block) => block.year === day.year && block.month === day.month && block.day === day.day);
    });

    // Calculate week number (approximate: day of year / days per week)
    let dayOfYear = day;
    for (let m = 0; m < month; m++) dayOfYear += calendar.months?.values?.[m]?.days || 0;
    const weekNumber = Math.ceil(dayOfYear / daysInWeek);

    // Get season and era for the viewed week (use mid-week day)
    const midWeekDay = days[Math.floor(days.length / 2)];
    const viewedComponents = { month: midWeekDay?.month ?? month, dayOfMonth: (midWeekDay?.day ?? day) - 1 };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();

    return {
      year: weekStartYear,
      month: weekStartMonth,
      monthName: calendar.months?.values?.[month]?.name ? game.i18n.localize(calendar.months.values[month].name) : '',
      yearDisplay: calendar.formatYearWithEra?.(weekStartYear) ?? String(weekStartYear),
      weekNumber,
      days: days,
      timeSlots: timeSlots,
      weekdays: calendar.days?.values?.map((wd) => game.i18n.localize(wd.name)) || [],
      daysInWeek,
      currentHour,
      currentSeason,
      currentEra
    };
  }

  /**
   * Generate calendar grid data for year view
   * @param {CalendariaCalendar} calendar
   * @param {object} date
   * @returns {object}
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
              const localizedName = game.i18n.localize(m.name);
              const localizedAbbrev = m.abbreviation ? game.i18n.localize(m.abbreviation) : localizedName;
              const abbrevData = this._abbreviateMonthName(localizedAbbrev);
              return {
                localizedName,
                abbreviation: abbrevData.abbrev,
                fullAbbreviation: localizedAbbrev,
                tooltipText: `${localizedName} (${localizedAbbrev})`,
                month: idx,
                year: displayYear
              };
            }) || []
        });
      }
      yearGrid.push(yearRow);
    }

    // Get season for the viewed year (use first month)
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
   * @param {number} month
   * @param {number} day - Day of month (1-indexed)
   * @returns {boolean}
   */
  _isToday(year, month, day) {
    const today = game.time.components;
    const calendar = this.calendar;

    // Adjust today's year for comparison (add yearZero offset)
    const yearZero = calendar?.years?.yearZero ?? 0;
    const displayYear = today.year + yearZero;

    // Compare using dayOfMonth (convert from 0-indexed to 1-indexed)
    const todayDayOfMonth = (today.dayOfMonth ?? 0) + 1;
    return displayYear === year && today.month === month && todayDayOfMonth === day;
  }

  /**
   * Check if a date is the selected date
   * @param {number} year - Display year (with yearZero applied)
   * @param {number} month
   * @param {number} day - Day of month (1-indexed)
   * @returns {boolean}
   */
  _isSelected(year, month, day) {
    if (!this._selectedDate) return false;
    return this._selectedDate.year === year && this._selectedDate.month === month && this._selectedDate.day === day;
  }

  /**
   * Get notes for a specific day
   * @param {JournalEntryPage[]} notePages
   * @param {number} year
   * @param {number} month
   * @param {number} day
   * @returns {Array}
   */
  _getNotesForDay(notePages, year, month, day) {
    const targetDate = { year, month, day };
    return notePages.filter((page) => {
      const start = page.system.startDate;
      const end = page.system.endDate;

      // Check if end date has valid values (not null/undefined)
      const hasValidEndDate = end && end.year != null && end.month != null && end.day != null;

      // Exclude multi-day events (they're shown as event bars instead)
      if (hasValidEndDate && (end.year !== start.year || end.month !== start.month || end.day !== start.day)) return false;

      // Build noteData for recurrence check
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
        linkedEvent: page.system.linkedEvent
      };

      // Check if this event occurs on this day (handles recurring events)
      return isRecurringMatch(noteData, targetDate);
    });
  }

  /**
   * Get notes for a specific month
   * @param {JournalEntryPage[]} notePages
   * @param {number} year
   * @param {number} month
   * @returns {Array}
   */
  _getNotesForMonth(notePages, year, month) {
    return notePages.filter((page) => {
      const start = page.system.startDate;
      const repeat = page.system.repeat;

      // Non-repeating notes: only include if they start in this month
      if (!repeat || repeat === 'never') return start.year === year && start.month === month;

      // Recurring notes: include if they could occur in this month
      // (start date is before or during this month, and no end date or end date is after this month)
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
    const rows = []; // Track occupied spans for each row

    // Filter and prepare events with priority (earlier start times = higher priority)
    const multiDayEvents = notes
      .map((note) => {
        const start = note.system.startDate;
        const end = note.system.endDate;

        // Check if end date has valid values (not just an empty object)
        const hasValidEndDate = end && end.year != null && end.month != null && end.day != null;
        if (!hasValidEndDate) return null;

        // Check if end date is actually different from start date
        const isSameDay = end.year === start.year && end.month === start.month && end.day === start.day;
        if (isSameDay) return null; // Not multi-day

        // Check if this event is visible in the current month
        const startBeforeOrInMonth = start.year < year || (start.year === year && start.month <= month);
        const endInOrAfterMonth = end.year > year || (end.year === year && end.month >= month);

        if (!startBeforeOrInMonth || !endInOrAfterMonth) return null;

        // Determine if this is a continuation from a previous month
        const isContinuation = start.year < year || (start.year === year && start.month < month);

        // Calculate effective start/end days for this month
        const startDay = isContinuation ? 1 : start.day;
        const endDay = end.month === month && end.year === year ? end.day : daysInMonth;

        if (endDay < startDay) return null; // Invalid range

        // Calculate priority: all-day events appear first (priority -1), then by start hour
        const isAllDay = start.hour == null || note.system.allDay;
        const priority = isAllDay ? -1 : start.hour;

        return { note, start, end, startDay, endDay, priority, isContinuation };
      })
      .filter((e) => e !== null)
      .sort((a, b) => a.priority - b.priority); // Sort by priority (earlier = higher)

    multiDayEvents.forEach(({ note, start, end, startDay, endDay, isContinuation }) => {
      // Calculate grid positions
      const startPosition = startDay - 1 + startDayOfWeek; // 0-indexed
      const endPosition = endDay - 1 + startDayOfWeek;

      const startWeekIndex = Math.floor(startPosition / daysInWeek);
      const endWeekIndex = Math.floor(endPosition / daysInWeek);

      // Find the first available row where this event doesn't overlap with existing events
      let eventRow = rows.length; // Default to new row if no space found
      for (let r = 0; r < rows.length; r++) {
        const rowEvents = rows[r] || [];
        const hasOverlap = rowEvents.some((existing) => {
          // Check if this event overlaps with any existing event in this row
          return !(endPosition < existing.start || startPosition > existing.end);
        });
        if (!hasOverlap) {
          eventRow = r;
          break;
        }
      }
      // If we need a new row (eventRow equals rows.length), create it
      if (eventRow >= rows.length) rows.push([]);

      // Mark this span as occupied in the chosen row
      rows[eventRow].push({ start: startPosition, end: endPosition });

      // Handle events that span multiple weeks
      if (startWeekIndex === endWeekIndex) {
        // Event fits in one week
        const startColumn = startPosition % daysInWeek; // 0-indexed for this week
        const endColumn = endPosition % daysInWeek; // 0-indexed for this week
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
        // Event spans multiple weeks - create a bar for each week segment
        for (let weekIdx = startWeekIndex; weekIdx <= endWeekIndex; weekIdx++) {
          const weekStart = weekIdx * daysInWeek;
          const weekEnd = weekStart + daysInWeek - 1;

          const segmentStart = Math.max(startPosition, weekStart);
          const segmentEnd = Math.min(endPosition, weekEnd);

          const startColumn = segmentStart % daysInWeek;
          const endColumn = segmentEnd % daysInWeek;
          const left = (startColumn / daysInWeek) * 100;
          const width = ((endColumn - startColumn + 1) / daysInWeek) * 100;

          // First week segment of a continuation shows the >> icon
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

      // Find which day this event is on
      const dayMatch = days.find((d) => d.year === start.year && d.month === start.month && d.day === start.day);
      if (!dayMatch) return;

      // Calculate hour span for the event
      const startHour = allDay ? 0 : (start.hour ?? 0);
      let hourSpan = 1; // Default 1 hour

      if (allDay) {
        hourSpan = 24;
      } else if (end && end.year === start.year && end.month === start.month && end.day === start.day) {
        // Same-day event: calculate span from start to end hour
        const endHour = end.hour ?? startHour;
        hourSpan = Math.max(endHour - startHour, 1);
      }

      // Format times
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

    // Measure actual content size
    const contentRect = windowContent.scrollWidth;
    const contentHeight = windowContent.scrollHeight;
    const headerHeight = windowHeader?.offsetHeight || 30;

    this.setPosition({
      width: contentRect + 2, // +2 for borders
      height: contentHeight + headerHeight + 2
    });
  }

  /**
   * Update view class and handle post-render tasks
   * @param {ApplicationRenderContext} context - Render context
   * @param {object} options - Render options
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options);

    // Update view class for CSS targeting
    this.element.classList.remove('view-month', 'view-week', 'view-year');
    this.element.classList.add(`view-${this._displayMode}`);
  }

  /**
   * Set up hook listeners when the application is first rendered
   * @param {ApplicationRenderContext} context - Render context
   * @param {object} options - Render options
   * @override
   */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    // Set initial size based on view mode
    this._adjustSizeForView();

    // Set up context menu for day cells
    ViewUtils.setupDayContextMenu(this.element, '.calendar-day:not(.empty)', this.calendar, {
      onSetDate: () => {
        this._selectedDate = null;
        this.render();
      },
      onCreateNote: () => this.render()
    });

    // Set up hook to re-render when journal entries are updated, created, or deleted
    this._hooks = [];

    // Debounced render to avoid rapid consecutive renders
    const debouncedRender = foundry.utils.debounce(() => this.render(), 100);

    // Listen for journal entry page updates
    this._hooks.push({
      name: 'updateJournalEntryPage',
      id: Hooks.on('updateJournalEntryPage', (page, changes, options, userId) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });

    // Listen for journal entry page creation
    this._hooks.push({
      name: 'createJournalEntryPage',
      id: Hooks.on('createJournalEntryPage', (page, options, userId) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });

    // Listen for journal entry page deletion
    this._hooks.push({
      name: 'deleteJournalEntryPage',
      id: Hooks.on('deleteJournalEntryPage', (page, options, userId) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });

    // Listen for weather changes
    this._hooks.push({
      name: HOOKS.WEATHER_CHANGE,
      id: Hooks.on(HOOKS.WEATHER_CHANGE, () => debouncedRender())
    });
  }

  /**
   * Clean up hook listeners when the application is closed
   * @param {object} options - Close options
   * @override
   */
  async _onClose(options) {
    // Remove all hook listeners
    if (this._hooks) {
      this._hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
      this._hooks = [];
    }

    await super._onClose(options);
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  static async _onNavigate(event, target) {
    const direction = target.dataset.direction === 'next' ? 1 : -1;
    const current = this.viewedDate;
    const calendar = this.calendar;

    switch (this._displayMode) {
      case 'week': {
        // Navigate by one week
        const daysInWeek = calendar.days?.values?.length || 7;
        let newDay = current.day + direction * daysInWeek;
        let newMonth = current.month;
        let newYear = current.year;

        // Handle month boundaries
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
        // Navigate by 9 years (full grid)
        this.viewedDate = { ...current, year: current.year + direction * 9 };
        break;
      }
      default: {
        // Month view - navigate by one month
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

  static async _onToday(event, target) {
    this._viewedDate = null; // Reset to use live game time
    await this.render();
  }

  static async _onAddNote(event, target) {
    // Use selected time slot if available, otherwise use target data
    let day, month, year, hour;

    if (this._selectedTimeSlot) {
      ({ day, month, year, hour } = this._selectedTimeSlot);
    } else {
      day = target.dataset.day;
      month = target.dataset.month;
      year = target.dataset.year;
      hour = 12;
    }

    // Calculate end time (default 1 hour duration)
    const endHour = (parseInt(hour) + 1) % 24;
    const endDay = endHour < parseInt(hour) ? parseInt(day) + 1 : parseInt(day); // Handle day rollover

    // Create note using NoteManager (which creates it as a page in the calendar journal)
    const page = await NoteManager.createNote({
      name: game.i18n.localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), minute: 0 },
        endDate: { year: parseInt(year), month: parseInt(month), day: endDay, hour: endHour, minute: 0 }
      }
    });

    // Clear the selected time slot
    this._selectedTimeSlot = null;

    // Open the note for editing (hook will handle calendar re-render)
    if (page) page.sheet.render(true, { mode: 'edit' });
  }

  static async _onAddNoteToday(event, target) {
    // Priority: selected time slot > selected date > today
    let day, month, year, hour, minute;

    if (this._selectedTimeSlot) {
      ({ day, month, year, hour } = this._selectedTimeSlot);
      minute = 0;
    } else if (this._selectedDate) {
      // Use the selected day in the calendar
      ({ day, month, year } = this._selectedDate);
      hour = 12;
      minute = 0;
    } else {
      const today = game.time.components;
      const calendar = this.calendar;

      // Adjust year for display
      const yearZero = calendar?.years?.yearZero ?? 0;
      year = today.year + yearZero;
      month = today.month;
      day = (today.dayOfMonth ?? 0) + 1;
      hour = today.hour ?? 12;
      minute = today.minute ?? 0;
    }

    // Calculate end time (default 1 hour duration)
    const endHour = (parseInt(hour) + 1) % 24;
    const endDay = endHour < parseInt(hour) ? parseInt(day) + 1 : parseInt(day); // Handle day rollover

    // Create note using NoteManager (which creates it as a page in the calendar journal)
    const page = await NoteManager.createNote({
      name: game.i18n.localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), minute: parseInt(minute) },
        endDate: { year: parseInt(year), month: parseInt(month), day: endDay, hour: endHour, minute: parseInt(minute) }
      }
    });

    // Clear the selected time slot
    this._selectedTimeSlot = null;

    // Open the note for editing (hook will handle calendar re-render)
    if (page) page.sheet.render(true, { mode: 'edit' });
  }

  static async _onEditNote(event, target) {
    let pageId = target.dataset.noteId;

    // Handle segmented event IDs (e.g., "abc123-week-1" -> "abc123")
    if (pageId.includes('-week-')) pageId = pageId.split('-week-')[0];

    const page = game.journal.find((j) => j.pages.get(pageId))?.pages.get(pageId);
    if (page) page.sheet.render(true, { mode: 'edit' });
  }

  static async _onDeleteNote(event, target) {
    const pageId = target.dataset.noteId;
    const journal = game.journal.find((j) => j.pages.get(pageId));
    const page = journal?.pages.get(pageId);

    if (page) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize('CALENDARIA.ContextMenu.DeleteNote') },
        content: `<p>${game.i18n.format('CALENDARIA.ContextMenu.DeleteConfirm', { name: page.name })}</p>`,
        rejectClose: false,
        modal: true
      });

      if (confirmed) {
        // If the journal only has this one page, delete the entire journal entry
        if (journal.pages.size === 1) await journal.delete();
        else await page.delete();

        await this.render();
      }
    }
  }

  static async _onChangeView(event, target) {
    const mode = target.dataset.mode;
    this._displayMode = mode;
    await this.render();
    this._adjustSizeForView();
  }

  static async _onSelectMonth(event, target) {
    const year = parseInt(target.dataset.year);
    const month = parseInt(target.dataset.month);

    // Switch to month view and navigate to the selected month
    this._displayMode = 'month';
    this.viewedDate = { year, month, day: 1 };
    await this.render();
    this._adjustSizeForView();
  }

  static async _onSelectDay(event, target) {
    // Check for double-click first (manual detection since re-render breaks native dblclick)
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

    // Toggle selection - if clicking the same day, deselect it
    if (this._selectedDate?.year === year && this._selectedDate?.month === month && this._selectedDate?.day === day) this._selectedDate = null;
    else this._selectedDate = { year, month, day };

    await this.render();
  }

  static async _onSetAsCurrentDate(event, target) {
    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const dateToSet = this._selectedDate || this.viewedDate;
    await calendar.jumpToDate({ year: dateToSet.year, month: dateToSet.month, day: dateToSet.day });
    this._selectedDate = null;
    await this.render();
  }

  static async _onSelectTimeSlot(event, target) {
    const day = parseInt(target.dataset.day);
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);
    const hour = parseInt(target.dataset.hour);

    // Toggle selection - if clicking the same slot, deselect it
    if (this._selectedTimeSlot?.year === year && this._selectedTimeSlot?.month === month && this._selectedTimeSlot?.day === day && this._selectedTimeSlot?.hour === hour) this._selectedTimeSlot = null;
    else this._selectedTimeSlot = { year, month, day, hour };

    await this.render();
  }

  /**
   * Toggle between full and compact calendar views.
   * Closes this window and opens the compact calendar.
   */
  static async _onToggleCompact(event, target) {
    // Close this full calendar
    await this.close();

    // Open or focus the compact calendar
    const { CompactCalendar } = await import('./compact-calendar.mjs');
    const existing = foundry.applications.instances.get('compact-calendar');
    if (existing) existing.render(true, { focus: true });
    else new CompactCalendar().render(true);
  }

  /**
   * Cycle through weather presets or generate new weather.
   */
  static async _onOpenWeatherPicker(event, target) {
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
      label: game.i18n.localize(weather.label),
      icon: weather.icon,
      color: weather.color,
      temperature: WeatherManager.formatTemperature(WeatherManager.getTemperature()),
      tooltip: weather.description ? game.i18n.localize(weather.description) : game.i18n.localize(weather.label)
    };
  }
}
