/**
 * Calendar Application
 * Standalone application for displaying the calendar UI.
 * This is NOT a sheet - it's an independent application.
 *
 * @module Applications/CalendarApplication
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
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
    return this.calendar?.name;
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
    const components = game.time.components || { year: 1492, month: 0, day: 1, dayOfMonth: 0 };
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
    console.log(
      `[Calendaria] Found ${notes.length} calendar notes:`,
      notes.map((n) => ({
        name: n.name,
        date: `${n.system.startDate.year}-${n.system.startDate.month + 1}-${n.system.startDate.day}`,
        color: n.system.color,
        gmOnly: n.system.gmOnly
      }))
    );
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
      currentWeek.push({
        day,
        year,
        month,
        isToday: this._isToday(year, month, day),
        isSelected: this._isSelected(year, month, day),
        notes: dayNotes,
        isOddDay: dayIndex % 2 === 1
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

    // Generate time slots (2-hour increments)
    const timeSlots = [];
    for (let hour = 0; hour < 24; hour += 2) {
      timeSlots.push({
        label: `${hour.toString().padStart(2, '0')}:00`,
        hour: hour,
        endHour: hour + 2
      });
    }

    return {
      year: weekStartYear,
      month: weekStartMonth,
      monthName: calendar.months?.values?.[month]?.name ? game.i18n.localize(calendar.months.values[month].name) : '',
      days: days,
      timeSlots: timeSlots,
      weekdays: calendar.days?.values?.map((wd) => game.i18n.localize(wd.name)) || [],
      daysInWeek
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
      return start.year === year && start.month === month && start.day === day;
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

    // Create new journal entry with calendar note page
    const journal = await JournalEntry.create({
      name: `Note - ${month}/${day}/${year}`,
      pages: [
        {
          name: 'New Note',
          type: 'calendaria.calendarnote',
          system: {
            startDate: {
              year: parseInt(year),
              month: parseInt(month),
              day: parseInt(day),
              hour: parseInt(hour),
              minute: 0
            }
          }
        }
      ]
    });

    // Open the note for editing
    journal.pages.contents[0].sheet.render(true);

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

    // Create new journal entry with calendar note page
    const journal = await JournalEntry.create({
      name: `Note - ${month + 1}/${day}/${year}`,
      pages: [
        {
          name: 'New Note',
          type: 'calendaria.calendarnote',
          system: {
            startDate: {
              year: parseInt(year),
              month: parseInt(month),
              day: parseInt(day),
              hour: parseInt(hour),
              minute: parseInt(minute)
            }
          }
        }
      ]
    });

    // Open the note for editing
    journal.pages.contents[0].sheet.render(true);

    // Clear the selected time slot
    this._selectedTimeSlot = null;

    // Refresh the calendar
    await this.render();
  }

  static async _onEditNote(event, target) {
    const pageId = target.dataset.noteId;
    const page = game.journal.find((j) => j.pages.get(pageId))?.pages.get(pageId);
    if (page) {
      page.sheet.render(true);
    }
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
        if (journal.pages.size === 1) {
          await journal.delete();
        } else {
          // Otherwise just delete the page
          await page.delete();
        }
        await this.render();
      }
    }
  }

  static async _onChangeView(event, target) {
    const mode = target.dataset.mode;
    this._displayMode = mode;
    await this.render();
  }

  static async _onSelectDay(event, target) {
    const day = parseInt(target.dataset.day);
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);

    // Toggle selection - if clicking the same day, deselect it
    if (this._selectedDate?.year === year && this._selectedDate?.month === month && this._selectedDate?.day === day) {
      this._selectedDate = null;
    } else {
      this._selectedDate = { year, month, day };
    }

    await this.render();
  }

  static async _onSetAsCurrentDate(event, target) {
    if (!this._selectedDate) return;

    const calendar = this.calendar;
    const yearZero = calendar?.years?.yearZero ?? 0;

    // Convert display year back to internal year
    const internalYear = this._selectedDate.year - yearZero;

    // Convert day of month (1-indexed) to 0-indexed
    const dayOfMonth = this._selectedDate.day - 1;

    // Use the calendar's jumpToDate method if available
    if (calendar && typeof calendar.jumpToDate === 'function') {
      await calendar.jumpToDate({
        year: this._selectedDate.year,
        month: this._selectedDate.month,
        day: this._selectedDate.day
      });
    } else {
      // Fallback: construct time components and set world time
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
    if (
      this._selectedTimeSlot?.year === year &&
      this._selectedTimeSlot?.month === month &&
      this._selectedTimeSlot?.day === day &&
      this._selectedTimeSlot?.hour === hour
    ) {
      this._selectedTimeSlot = null;
    } else {
      this._selectedTimeSlot = { year, month, day, hour };
    }

    await this.render();
  }
}
