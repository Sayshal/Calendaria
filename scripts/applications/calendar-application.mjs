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

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class CalendarApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._currentDate = null;
    this._calendarId = options.calendarId || null;
    this._displayMode = 'month';
    this._selectedDate = null; // Track clicked/selected date
    this._selectedTimeSlot = null; // Track selected time slot for week view
  }

  static DEFAULT_OPTIONS = {
    classes: ['calendaria', 'calendar-application'],
    tag: 'div',
    window: {
      contentClasses: ['calendar-application'],
      icon: 'fas fa-calendar',
      resizable: true
    },
    actions: {
      previousMonth: CalendarApplication._onPreviousMonth,
      nextMonth: CalendarApplication._onNextMonth,
      today: CalendarApplication._onToday,
      addNote: CalendarApplication._onAddNote,
      addNoteToday: CalendarApplication._onAddNoteToday,
      editNote: CalendarApplication._onEditNote,
      deleteNote: CalendarApplication._onDeleteNote,
      changeView: CalendarApplication._onChangeView,
      selectDay: CalendarApplication._onSelectDay,
      selectMonth: CalendarApplication._onSelectMonth,
      setAsCurrentDate: CalendarApplication._onSetAsCurrentDate,
      selectTimeSlot: CalendarApplication._onSelectTimeSlot
    },
    position: {
      width: 800,
      height: 600
    }
  };

  static PARTS = {
    header: { template: 'modules/calendaria/templates/sheets/calendar-header.hbs' },
    content: { template: 'modules/calendaria/templates/sheets/calendar-content.hbs' }
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
   * Get the current viewed date
   * @returns {object}
   */
  get currentDate() {
    if (this._currentDate) return this._currentDate;

    // Use current game time
    const components = game.time.components;

    const calendar = this.calendar;

    // Adjust year for display (add yearZero offset)
    const yearZero = calendar?.years?.yearZero ?? 0;

    // Use dayOfMonth (0-indexed) converted to 1-indexed day
    const dayOfMonth = (components.dayOfMonth ?? 0) + 1;

    return {
      ...components,
      year: components.year + yearZero,
      day: dayOfMonth
    };
  }

  set currentDate(date) {
    this._currentDate = date;
  }

  /**
   * Get all calendar note pages
   * @returns {JournalEntryPage[]}
   */
  _getCalendarNotes() {
    const notes = [];
    for (const journal of game.journal) {
      for (const page of journal.pages) {
        if (page.type === 'calendaria.calendarnote') {
          notes.push(page);
        }
      }
    }
    return notes;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const currentDate = this.currentDate;

    // Basic context
    context.editable = game.user.isGM;

    // Calendar data
    context.calendar = calendar;
    context.currentDate = currentDate;
    context.displayMode = this._displayMode;
    context.selectedDate = this._selectedDate;
    context.selectedTimeSlot = this._selectedTimeSlot;

    // Get notes from journal pages
    const allNotes = this._getCalendarNotes();
    context.notes = allNotes;
    context.visibleNotes = allNotes.filter((page) => !page.system.gmOnly || game.user.isGM);

    // Generate calendar data based on display mode
    if (calendar) {
      switch (this._displayMode) {
        case 'week':
          context.calendarData = this._generateWeekData(calendar, currentDate, context.visibleNotes);
          break;
        case 'year':
          context.calendarData = this._generateYearData(calendar, currentDate);
          break;
        default: // month
          context.calendarData = this._generateCalendarData(calendar, currentDate, context.visibleNotes);
          break;
      }
    }

    // Filter notes for current view
    context.currentMonthNotes = this._getNotesForMonth(context.visibleNotes, currentDate.year, currentDate.month);

    return context;
  }

  /**
   * Abbreviate month name if longer than 5 characters
   * Takes first letter of each word
   * @param {string} monthName - Full month name
   * @returns {{full: string, abbrev: string, useAbbrev: boolean}}
   */
  _abbreviateMonthName(monthName) {
    const full = monthName;
    const useAbbrev = monthName.length > 5;

    if (!useAbbrev) {
      return { full, abbrev: full, useAbbrev: false };
    }

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

    if (!monthData) {
      console.warn('Month data not found for month:', month);
      return null;
    }

    const daysInMonth = monthData.days;
    const daysInWeek = calendar.days?.values?.length || 7;
    const weeks = [];
    let currentWeek = [];

    // Calculate starting day of week for the first day of the month
    // For fantasy calendars (like Harptos with 10-day weeks), months always start on first day of week
    // TODO: Make this configurable via calendar metadata when building calendar configuration UI
    const useFixedMonthStart = daysInWeek === 10 || calendar.years?.firstWeekday === 0;
    const startDayOfWeek = useFixedMonthStart ? 0 : dayOfWeek({ year, month, day: 1 });

    // Add empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) currentWeek.push({ empty: true });

    // Add days of the month
    let dayIndex = startDayOfWeek;
    for (let day = 1; day <= daysInMonth; day++) {
      const dayNotes = this._getNotesForDay(notes, year, month, day);

      // Check if this day is a festival day
      const festivalDay = calendar.findFestivalDay({ year, month, dayOfMonth: day - 1 });

      currentWeek.push({
        day,
        year,
        month,
        isToday: this._isToday(year, month, day),
        isSelected: this._isSelected(year, month, day),
        notes: dayNotes,
        isOddDay: dayIndex % 2 === 1,
        isFestival: !!festivalDay,
        festivalName: festivalDay ? game.i18n.localize(festivalDay.name) : null
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

    return {
      year,
      month,
      monthName: game.i18n.localize(monthData.name),
      weeks,
      weekdays: calendar.days?.values?.map((wd) => game.i18n.localize(wd.name)) || [],
      daysInWeek
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

      days.push({
        day: currentDay,
        year: currentYear,
        month: currentMonth,
        monthName: monthName,
        dayName: dayName,
        isToday: isToday,
        currentHour: isToday ? currentHour : null,
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
    for (let hour = 0; hour < 24; hour++) {
      timeSlots.push({
        label: `${hour.toString().padStart(2, '0')}:00`,
        hour: hour
      });
    }

    // Create event blocks for week view
    const eventBlocks = this._createEventBlocks(notes, days);

    // Attach event blocks to their respective days
    days.forEach((day) => {
      day.eventBlocks = eventBlocks.filter((block) => block.year === day.year && block.month === day.month && block.day === day.day);
    });

    return {
      year: weekStartYear,
      month: weekStartMonth,
      monthName: calendar.months?.values?.[month]?.name ? game.i18n.localize(calendar.months.values[month].name) : '',
      days: days,
      timeSlots: timeSlots,
      weekdays: calendar.days?.values?.map((wd) => game.i18n.localize(wd.name)) || [],
      daysInWeek,
      currentHour
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

    // Create a 3x3 grid of years
    // Current year should be at position [1][1] (center of grid)
    const yearGrid = [];
    const startYear = year - 4; // 4 years before current

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
              const localizedAbbrev = game.i18n.localize(m.abbreviation);
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

    return {
      year,
      yearGrid,
      weekdays: []
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
    return notePages.filter((page) => {
      const start = page.system.startDate;
      const end = page.system.endDate;

      // Only include events that start on this day
      if (start.year !== year || start.month !== month || start.day !== day) return false;

      // Exclude multi-day events (they're shown as event bars instead)
      if (end && (end.year !== start.year || end.month !== start.month || end.day !== start.day)) return false;

      // Include single-day events and events without end dates
      return true;
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
      return start.year === year && start.month === month;
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

        // Only process events that start this month and have an end date
        if (start.year !== year || start.month !== month || !end) return null;

        // Calculate if this is truly a multi-day event
        const startDay = start.day;
        const endDay = end.month === month ? end.day : daysInMonth;

        if (endDay <= startDay) return null; // Not multi-day

        // Calculate priority: all-day events appear first (priority -1), then by start hour
        // All-day events have no hour set, or explicitly marked with allDay flag
        const isAllDay = start.hour == null || note.system.allDay;
        const priority = isAllDay ? -1 : start.hour;

        return { note, start, end, startDay, endDay, priority };
      })
      .filter((e) => e !== null)
      .sort((a, b) => a.priority - b.priority); // Sort by priority (earlier = higher)

    multiDayEvents.forEach(({ note, start, end, startDay, endDay }) => {

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
          row: eventRow
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
            isSegment: true
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

      // Find which day this event is on
      const dayMatch = days.find((d) => d.year === start.year && d.month === start.month && d.day === start.day);
      if (!dayMatch) return;

      // Calculate grid row positioning (add 2 for header rows)
      const startRow = start.hour + 2;
      const duration = end && end.year === start.year && end.month === start.month && end.day === start.day ? end.hour - start.hour : 1;
      const endRow = startRow + Math.max(duration, 1);

      // Format times
      const startTime = `${start.hour.toString().padStart(2, '0')}:${start.minute.toString().padStart(2, '0')}`;
      const endTime = end ? `${end.hour.toString().padStart(2, '0')}:${end.minute.toString().padStart(2, '0')}` : null;

      blocks.push({
        id: note.id,
        name: note.name,
        color: note.system.color || '#4a86e8',
        icon: note.system.icon,
        iconType: note.system.iconType,
        day: start.day,
        month: start.month,
        year: start.year,
        startRow,
        endRow,
        startTime,
        endTime,
        duration
      });
    });

    return blocks;
  }

  /* -------------------------------------------- */
  /*  Lifecycle Methods                           */
  /* -------------------------------------------- */

  /**
   * Set up hook listeners when the application is first rendered
   * @param {ApplicationRenderContext} context - Render context
   * @param {object} options - Render options
   * @override
   */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    // Set up hook to re-render when journal entries are updated, created, or deleted
    this._hookIds = [];

    // Listen for journal entry page updates
    this._hookIds.push(
      Hooks.on('updateJournalEntryPage', (page, changes, options, userId) => {
        if (page.type === 'calendaria.calendar-note') this.render();
      })
    );

    // Listen for journal entry page creation
    this._hookIds.push(
      Hooks.on('createJournalEntryPage', (page, options, userId) => {
        if (page.type === 'calendaria.calendar-note') this.render();
      })
    );

    // Listen for journal entry page deletion
    this._hookIds.push(
      Hooks.on('deleteJournalEntryPage', (page, options, userId) => {
        if (page.type === 'calendaria.calendar-note') this.render();
      })
    );
  }

  /**
   * Clean up hook listeners when the application is closed
   * @param {object} options - Close options
   * @override
   */
  async _onClose(options) {
    // Remove all hook listeners
    if (this._hookIds) {
      this._hookIds.forEach((id) => Hooks.off(id));
      this._hookIds = [];
    }

    await super._onClose(options);
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  static async _onPreviousMonth(event, target) {
    const current = this.currentDate;
    const calendar = this.calendar;

    let newMonth = current.month - 1;
    let newYear = current.year;

    if (newMonth < 0) {
      newMonth = calendar.months.values.length - 1;
      newYear--;
    }

    this.currentDate = { year: newYear, month: newMonth, day: 1 };
    await this.render();
  }

  static async _onNextMonth(event, target) {
    const current = this.currentDate;
    const calendar = this.calendar;

    let newMonth = current.month + 1;
    let newYear = current.year;

    if (newMonth >= calendar.months.values.length) {
      newMonth = 0;
      newYear++;
    }

    this.currentDate = { year: newYear, month: newMonth, day: 1 };
    await this.render();
  }

  static async _onToday(event, target) {
    this._currentDate = null; // Reset to use live game time
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

    // Create note using NoteManager (which creates it as a page in the calendar journal)
    const page = await NoteManager.createNote({
      name: 'New Note',
      noteData: {
        startDate: {
          year: parseInt(year),
          month: parseInt(month),
          day: parseInt(day),
          hour: parseInt(hour),
          minute: 0
        }
      }
    });

    // Open the note for editing
    if (page) {
      page.sheet.render(true);
    }

    // Clear the selected time slot
    this._selectedTimeSlot = null;

    // Refresh the calendar
    await this.render();
  }

  static async _onAddNoteToday(event, target) {
    // Use selected time slot if available, otherwise use today
    let day, month, year, hour, minute;

    if (this._selectedTimeSlot) {
      ({ day, month, year, hour } = this._selectedTimeSlot);
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

    // Create note using NoteManager (which creates it as a page in the calendar journal)
    const page = await NoteManager.createNote({
      name: 'New Note',
      noteData: {
        startDate: {
          year: parseInt(year),
          month: parseInt(month),
          day: parseInt(day),
          hour: parseInt(hour),
          minute: parseInt(minute)
        }
      }
    });

    // Open the note for editing
    if (page) {
      page.sheet.render(true);
    }

    // Clear the selected time slot
    this._selectedTimeSlot = null;

    // Refresh the calendar
    await this.render();
  }

  static async _onEditNote(event, target) {
    let pageId = target.dataset.noteId;

    // Handle segmented event IDs (e.g., "abc123-week-1" -> "abc123")
    if (pageId.includes('-week-')) pageId = pageId.split('-week-')[0];

    const page = game.journal.find((j) => j.pages.get(pageId))?.pages.get(pageId);
    if (page) page.sheet.render(true);
  }

  static async _onDeleteNote(event, target) {
    const pageId = target.dataset.noteId;
    const journal = game.journal.find((j) => j.pages.get(pageId));
    const page = journal?.pages.get(pageId);

    if (page) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: 'Delete Note' },
        content: `<p>Delete note "${page.name}"?</p>`,
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
  }

  static async _onSelectMonth(event, target) {
    const year = parseInt(target.dataset.year);
    const month = parseInt(target.dataset.month);

    // Switch to month view and navigate to the selected month
    this._displayMode = 'month';
    this.currentDate = { year, month, day: 1 };
    await this.render();
  }

  static async _onSelectDay(event, target) {
    const day = parseInt(target.dataset.day);
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);

    // Toggle selection - if clicking the same day, deselect it
    if (this._selectedDate?.year === year && this._selectedDate?.month === month && this._selectedDate?.day === day) this._selectedDate = null;
    else this._selectedDate = { year, month, day };

    await this.render();
  }

  static async _onSetAsCurrentDate(event, target) {
    if (!this._selectedDate) return;

    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;

    // Use the calendar's jumpToDate method if available
    if (calendar && typeof calendar.jumpToDate === 'function') {
      // calendar.jumpToDate expects display year and 1-indexed day
      await calendar.jumpToDate({
        year: this._selectedDate.year, // Display year
        month: this._selectedDate.month,
        day: this._selectedDate.day // 1-indexed day (jumpToDate subtracts 1 internally)
      });
    } else {
      // Fallback: construct time components and set world time
      // For internal components, we need to subtract yearZero and convert day to 0-indexed dayOfMonth
      const internalYear = this._selectedDate.year - yearZero;
      const dayOfMonth = this._selectedDate.day - 1; // Convert 1-indexed day to 0-indexed dayOfMonth
      const components = {
        year: internalYear,
        month: this._selectedDate.month,
        dayOfMonth: dayOfMonth,
        hour: game.time.components.hour ?? 12,
        minute: game.time.components.minute ?? 0,
        second: 0
      };

      // Convert to world time and update
      if (calendar) {
        const worldTime = calendar.componentsToTime(components);
        await game.time.set(worldTime);
      }
    }

    // Clear selection and refresh
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
}
