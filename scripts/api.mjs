/**
 * Calendaria Public API
 * @module API
 * @author Tyler
 */

import { BigCal } from './applications/big-cal.mjs';
import { CalendarEditor } from './applications/calendar-editor.mjs';
import { MiniCal } from './applications/mini-cal.mjs';
import CalendarManager from './calendar/calendar-manager.mjs';
import { HOOKS, REPLACEABLE_ELEMENTS, SOCKET_TYPES, WIDGET_POINTS } from './constants.mjs';
import NoteManager from './notes/note-manager.mjs';
import { addDays, addMonths, addYears, compareDates, compareDays, dayOfWeek, daysBetween, isSameDay, isValidDate, monthsBetween } from './notes/utils/date-utils.mjs';
import SearchManager from './search/search-manager.mjs';
import { DEFAULT_FORMAT_PRESETS, formatCustom, getAvailableTokens, PRESET_FORMATTERS, resolveFormatString, timeSince } from './utils/format-utils.mjs';
import { log } from './utils/logger.mjs';
import { diagnoseWeatherConfig } from './utils/migrations.mjs';
import { canAddNotes, canChangeActiveCalendar, canChangeDateTime, canEditCalendars, canEditNotes } from './utils/permissions.mjs';
import { CalendariaSocket } from './utils/socket.mjs';
import * as WidgetManager from './utils/widget-manager.mjs';
import WeatherManager from './weather/weather-manager.mjs';

/**
 * Public API for Calendaria module.
 * Provides access to calendar data, time management, moon phases, and more.
 */
export const CalendariaAPI = {
  /**
   * Get the current date and time components.
   * @returns {object} Current time components (year, month, day, hour, minute, second, etc.)
   */
  getCurrentDateTime() {
    const components = game.time.components;
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    return { ...components, year: components.year + yearZero };
  },

  /**
   * Advance the current time by a delta.
   * @param {number} delta - Time delta in seconds to advance
   * @returns {Promise<number>} New world time after advancement
   */
  async advanceTime(delta) {
    if (!canChangeDateTime()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return game.time.worldTime;
    }
    // Non-GM users with permission must request via socket
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta });
      return game.time.worldTime;
    }
    return await game.time.advance(delta);
  },

  /**
   * Set the current date and time to specific components.
   * @param {object} components - Time components to set (year, month, day, hour, minute, second)
   * @returns {Promise<number>} New world time after setting
   */
  async setDateTime(components) {
    if (!canChangeDateTime()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return game.time.worldTime;
    }
    const internalComponents = { ...components };
    if (components.year !== undefined) {
      const calendar = CalendarManager.getActiveCalendar();
      const yearZero = calendar?.years?.yearZero ?? 0;
      internalComponents.year = components.year - yearZero;
    }
    // Non-GM users with permission must request via socket
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'set', components: internalComponents });
      return game.time.worldTime;
    }
    return await game.time.set(internalComponents);
  },

  /**
   * Jump to a specific date while preserving the current time of day.
   * @param {object} options - Date to jump to
   * @param {number} [options.year] - Target year
   * @param {number} [options.month] - Target month (0-indexed)
   * @param {number} [options.day] - Target day of month
   * @returns {Promise<void>}
   */
  async jumpToDate({ year, month, day }) {
    if (!canChangeDateTime()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return;
    }
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) {
      ui.notifications.warn('CALENDARIA.Error.NoActiveCalendar', { localize: true });
      return;
    }
    // Non-GM users with permission must request via socket
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'jump', date: { year, month, day } });
      return;
    }
    await calendar.jumpToDate({ year, month, day });
  },

  /**
   * Get the currently active calendar.
   * @returns {object|null} The active calendar or null if none
   */
  getActiveCalendar() {
    return CalendarManager.getActiveCalendar();
  },

  /**
   * Get a specific calendar by ID.
   * @param {string} id - Calendar ID
   * @returns {object|null} The calendar or null if not found
   */
  getCalendar(id) {
    return CalendarManager.getCalendar(id);
  },

  /**
   * Get all registered calendars.
   * @returns {Map<string, object>} Map of calendar ID to calendar
   */
  getAllCalendars() {
    return CalendarManager.getAllCalendars();
  },

  /**
   * Get metadata for all calendars.
   * @returns {object[]} Array of calendar metadata
   */
  getAllCalendarMetadata() {
    return CalendarManager.getAllCalendarMetadata();
  },

  /**
   * Switch to a different calendar.
   * @param {string} id - Calendar ID to switch to
   * @returns {Promise<boolean>} True if calendar was switched successfully
   */
  async switchCalendar(id) {
    if (!canChangeActiveCalendar()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return false;
    }
    // Non-GM users with permission must request via socket
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.CALENDAR_REQUEST, { calendarId: id });
      return true;
    }
    return await CalendarManager.switchCalendar(id);
  },

  /**
   * Get the current phase of a specific moon.
   * @param {number} [moonIndex] - Index of the moon (0 for primary moon)
   * @returns {object|null} Moon phase data with name, icon, position, and dayInCycle
   */
  getMoonPhase(moonIndex = 0) {
    return CalendarManager.getCurrentMoonPhase(moonIndex);
  },

  /**
   * Get all moon phases for the active calendar.
   * @returns {Array<object>} Array of moon phase data
   */
  getAllMoonPhases() {
    return CalendarManager.getAllCurrentMoonPhases();
  },

  /**
   * Get the current season.
   * @returns {object|null} Season data with name and other properties
   */
  getCurrentSeason() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.seasons) return null;
    const components = game.time.components;
    const seasonIndex = components.season ?? 0;
    return calendar.seasonsArray?.[seasonIndex] ?? null;
  },

  /**
   * Get the current values for all cycles (zodiac signs, elemental weeks, etc).
   * @returns {{text: string, values: Array<{cycleName: string, entryName: string, index: number}>}|null}
   */
  getCycleValues() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    return calendar.getCycleValues();
  },

  /**
   * Get the sunrise time in hours for the current day.
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {number|null} Sunrise time in hours (e.g., 6.5 = 6:30 AM)
   */
  getSunrise(zone) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    zone ??= WeatherManager.getActiveZone?.(null, game.scenes?.active);
    return calendar.sunrise(undefined, zone);
  },

  /**
   * Get the sunset time in hours for the current day.
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {number|null} Sunset time in hours (e.g., 18.5 = 6:30 PM)
   */
  getSunset(zone) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    zone ??= WeatherManager.getActiveZone?.(null, game.scenes?.active);
    return calendar.sunset(undefined, zone);
  },

  /**
   * Get the number of daylight hours for the current day.
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {number|null} Hours of daylight (e.g., 12.5)
   */
  getDaylightHours(zone) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    zone ??= WeatherManager.getActiveZone?.(null, game.scenes?.active);
    return calendar.daylightHours(undefined, zone);
  },

  /**
   * Get progress through the day period (0 = sunrise, 1 = sunset).
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {number|null} Progress value between 0-1
   */
  getProgressDay(zone) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    zone ??= WeatherManager.getActiveZone?.(null, game.scenes?.active);
    return calendar.progressDay(undefined, zone);
  },

  /**
   * Get progress through the night period (0 = sunset, 1 = sunrise).
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {number|null} Progress value between 0-1
   */
  getProgressNight(zone) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    zone ??= WeatherManager.getActiveZone?.(null, game.scenes?.active);
    return calendar.progressNight(undefined, zone);
  },

  /**
   * @param {number} targetHour - Target hour (0-hoursPerDay)
   * @returns {object|null} Time until target hour
   */
  getTimeUntilTarget(targetHour) {
    const components = game.time.components;
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = this.calendar?.days?.minutesPerHour ?? 60;
    const secondsPerMinute = this.calendar?.days?.secondsPerMinute ?? 60;
    const currentHour = components.hour + components.minute / minutesPerHour + components.second / (minutesPerHour * secondsPerMinute);
    const hoursUntil = currentHour < targetHour ? targetHour - currentHour : hoursPerDay - currentHour + targetHour;
    const hours = Math.floor(hoursUntil);
    const remainingMinutes = (hoursUntil - hours) * minutesPerHour;
    const minutes = Math.floor(remainingMinutes);
    const seconds = Math.floor((remainingMinutes - minutes) * secondsPerMinute);
    return { hours, minutes, seconds };
  },

  /** @returns {object|null} Time until sunrise */
  getTimeUntilSunrise() {
    const calendar = CalendarManager.getActiveCalendar();
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const targetHour = calendar?.sunrise?.(undefined, zone);
    return targetHour != null ? this.getTimeUntilTarget(targetHour) : null;
  },

  /** @returns {object|null} Time until sunset */
  getTimeUntilSunset() {
    const calendar = CalendarManager.getActiveCalendar();
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const targetHour = calendar?.sunset?.(undefined, zone);
    return targetHour != null ? this.getTimeUntilTarget(targetHour) : null;
  },

  /** @returns {object|null} Time until midnight */
  getTimeUntilMidnight() {
    return CalendarManager.getActiveCalendar() ? this.getTimeUntilTarget(0) : null;
  },

  /** @returns {object|null} Time until midday */
  getTimeUntilMidday() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    return this.getTimeUntilTarget(hoursPerDay / 2);
  },

  /**
   * Get the current weekday information including rest day status.
   * Respects per-month custom weekdays if defined.
   * @returns {{index: number, name: string, abbreviation: string, isRestDay: boolean}|null}
   */
  getCurrentWeekday() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    const weekdayInfo = calendar.getWeekdayForDate?.();
    if (!weekdayInfo) return null;
    return { index: weekdayInfo.index, name: weekdayInfo.name || '', abbreviation: weekdayInfo.abbreviation || '', isRestDay: weekdayInfo.isRestDay || false };
  },

  /**
   * Check if the current day is a rest day.
   * @returns {boolean} True if current day is a rest day
   */
  isRestDay() {
    const weekday = this.getCurrentWeekday();
    return weekday?.isRestDay ?? false;
  },

  /**
   * Get the festival for the current date, if any.
   * @returns {object|null} Festival data with name, month, and day
   */
  getCurrentFestival() {
    return CalendarManager.getCurrentFestival();
  },

  /**
   * Check if the current date is a festival day.
   * @returns {boolean} True if current date is a festival
   */
  isFestivalDay() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return false;
    return calendar.isFestivalDay();
  },

  /**
   * Format date and time components as a string.
   * @param {object} [components] - Time components to format (defaults to current time)
   * @param {string} [formatOrPreset] - Format string with tokens OR preset name (dateLong, dateFull, time24, etc.)
   * @returns {string} Formatted date/time string
   */
  formatDate(components = null, formatOrPreset = 'dateLong') {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return '';
    const raw = components || game.time.components;
    const formatted = {
      ...raw,
      year: components ? raw.year : raw.year + (calendar.years?.yearZero ?? 0),
      dayOfMonth: components ? raw.day || 1 : (raw.dayOfMonth ?? 0) + 1
    };
    if (PRESET_FORMATTERS[formatOrPreset]) return PRESET_FORMATTERS[formatOrPreset](calendar, formatted);
    const formatStr = resolveFormatString(formatOrPreset);
    return formatCustom(calendar, formatted, formatStr);
  },

  /**
   * Get relative time description between two dates.
   * @param {object} targetDate - Target date { year, month, dayOfMonth }
   * @param {object} [currentDate] - Current date (defaults to current time)
   * @returns {string} Relative time string (e.g., "3 days ago", "in 2 weeks")
   */
  timeSince(targetDate, currentDate = null) {
    currentDate = currentDate || game.time.components;
    return timeSince(targetDate, currentDate);
  },

  /**
   * Get available format tokens and their descriptions.
   * @returns {Array<{token: string, descriptionKey: string, type: string}>}
   */
  getFormatTokens() {
    return getAvailableTokens();
  },

  /**
   * Get default format presets.
   * @returns {Object<string, string>}
   */
  getFormatPresets() {
    return { ...DEFAULT_FORMAT_PRESETS };
  },

  /**
   * Get all calendar notes.
   * @returns {object[]} Array of note stubs with id, name, flagData, etc.
   */
  getAllNotes() {
    return NoteManager.getAllNotes();
  },

  /**
   * Get a specific note by ID.
   * @param {string} pageId - The journal entry page ID
   * @returns {object|null} Note stub or null if not found
   */
  getNote(pageId) {
    return NoteManager.getNote(pageId);
  },

  /**
   * Delete a specific calendar note.
   * @param {string} pageId - The journal entry page ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteNote(pageId) {
    return await NoteManager.deleteNote(pageId);
  },

  /**
   * Delete all calendar notes.
   * @returns {Promise<number>} Number of notes deleted
   */
  async deleteAllNotes() {
    return await NoteManager.deleteAllNotes();
  },

  /**
   * Search all content including notes and dates.
   * Returns results with type information for categorized display.
   * @param {string} term - Search term (minimum 2 characters)
   * @param {object} [options] - Search options
   * @param {boolean} [options.searchContent] - Search note content
   * @param {number} [options.limit] - Max results
   * @returns {object[]} Array of results with type field (e.g., 'note')
   */
  search(term, options = {}) {
    return SearchManager.search(term, options);
  },

  /**
   * Create a new calendar note.
   * @param {object} options - Note creation options
   * @param {string} options.name - Note title
   * @param {string} [options.content] - Note content (HTML)
   * @param {object} options.startDate - Start date {year, month, day, hour?, minute?}
   * @param {object} [options.endDate] - End date {year, month, day, hour?, minute?}
   * @param {boolean} [options.allDay] - Whether this is an all-day event
   * @param {string} [options.repeat] - Repeat pattern: 'never', 'daily', 'weekly', 'monthly', 'yearly'
   * @param {string[]} [options.categories] - Category IDs
   * @param {string} [options.icon] - Icon path or class
   * @param {string} [options.color] - Event color (hex)
   * @param {boolean} [options.gmOnly] - Whether note is GM-only
   * @returns {Promise<object>} Created note page
   */
  async createNote({ name, content = '', startDate, endDate, allDay = true, repeat = 'never', categories = [], icon, color, gmOnly = false }) {
    if (!canAddNotes()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    const noteData = {
      startDate: { year: startDate.year, month: startDate.month, day: startDate.day, hour: startDate.hour ?? 0, minute: startDate.minute ?? 0 },
      endDate: endDate ? { year: endDate.year, month: endDate.month, day: endDate.day, hour: endDate.hour ?? 23, minute: endDate.minute ?? 59 } : null,
      allDay,
      repeat,
      categories,
      icon: icon || 'fas fa-calendar-day',
      color: color || '#4a90e2',
      gmOnly
    };
    return await NoteManager.createNote({ name, content, noteData });
  },

  /**
   * Update an existing calendar note.
   * @param {string} pageId - Journal entry page ID
   * @param {object} updates - Updates to apply
   * @param {string} [updates.name] - New name
   * @param {object} [updates.startDate] - New start date
   * @param {object} [updates.endDate] - New end date
   * @param {boolean} [updates.allDay] - New all-day setting
   * @param {string} [updates.repeat] - New repeat pattern
   * @param {string[]} [updates.categories] - New categories
   * @returns {Promise<object>} Updated note page
   */
  async updateNote(pageId, updates) {
    if (!canEditNotes()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    const noteData = {};
    if (updates.startDate) noteData.startDate = { ...updates.startDate };
    if (updates.endDate) noteData.endDate = { ...updates.endDate };
    if (updates.allDay !== undefined) noteData.allDay = updates.allDay;
    if (updates.repeat !== undefined) noteData.repeat = updates.repeat;
    if (updates.categories !== undefined) noteData.categories = updates.categories;
    if (updates.icon !== undefined) noteData.icon = updates.icon;
    if (updates.color !== undefined) noteData.color = updates.color;
    if (updates.gmOnly !== undefined) noteData.gmOnly = updates.gmOnly;
    return await NoteManager.updateNote(pageId, { name: updates.name, noteData: Object.keys(noteData).length > 0 ? noteData : undefined });
  },

  /**
   * Open a note in the UI.
   * @param {string} pageId - Journal entry page ID
   * @param {object} [options] - Render options
   * @param {string} [options.mode] - 'view' or 'edit'
   * @returns {Promise<void>}
   */
  async openNote(pageId, options = {}) {
    const page = NoteManager.getFullNote(pageId);
    if (!page) {
      ui.notifications.warn('CALENDARIA.Error.NoteNotFound', { localize: true });
      return;
    }
    page.sheet.render(true, { mode: options.mode ?? 'view' });
  },

  /**
   * Get all notes for a specific date.
   * @param {number} year - Year (display year, not internal)
   * @param {number} month - Month (0-indexed)
   * @param {number} day - Day of month
   * @returns {object[]} Array of note stubs
   */
  getNotesForDate(year, month, day) {
    return NoteManager.getNotesForDate(year, month, day);
  },

  /**
   * Get all notes for a specific month.
   * @param {number} year - Year (display year)
   * @param {number} month - Month (0-indexed)
   * @returns {object[]} Array of note stubs
   */
  getNotesForMonth(year, month) {
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const daysInMonth = calendar?.getDaysInMonth(month, year - yearZero) ?? 30;
    return NoteManager.getNotesInRange({ year, month, day: 1 }, { year, month, day: daysInMonth });
  },

  /**
   * Get all notes within a date range.
   * @param {object} startDate - Start date {year, month, day}
   * @param {object} endDate - End date {year, month, day}
   * @returns {object[]} Array of note stubs
   */
  getNotesInRange(startDate, endDate) {
    return NoteManager.getNotesInRange(startDate, endDate);
  },

  /**
   * Search notes only, with simple filtering options.
   * Unlike search(), this returns raw note stubs without type metadata.
   * @param {string} searchTerm - Text to search for
   * @param {object} [options] - Search options
   * @param {boolean} [options.caseSensitive] - Case-sensitive search (default: false)
   * @param {string[]} [options.categories] - Filter by category IDs
   * @returns {object[]} Array of note stubs (id, name, content, flagData)
   */
  searchNotes(searchTerm, options = {}) {
    const allNotes = NoteManager.getAllNotes();
    const term = options.caseSensitive ? searchTerm : searchTerm.toLowerCase();
    return allNotes.filter((note) => {
      if (options.categories?.length > 0) {
        const noteCategories = note.flagData?.categories ?? [];
        if (!options.categories.some((cat) => noteCategories.includes(cat))) return false;
      }
      const name = options.caseSensitive ? note.name : note.name.toLowerCase();
      if (name.includes(term)) return true;
      if (note.content) {
        const content = options.caseSensitive ? note.content : note.content.toLowerCase();
        if (content.includes(term)) return true;
      }
      return false;
    });
  },

  /**
   * Get notes by category.
   * @param {string} categoryId - Category ID
   * @returns {object[]} Array of note stubs
   */
  getNotesByCategory(categoryId) {
    return NoteManager.getNotesByCategory(categoryId);
  },

  /**
   * Get all category definitions.
   * @returns {object[]} Array of category definitions
   */
  getCategories() {
    return NoteManager.getCategoryDefinitions();
  },

  /**
   * Open the main BigCal application.
   * @param {object} [options] - Open options
   * @param {object} [options.date] - Date to display {year, month, day}
   * @param {string} [options.view] - View mode: 'month', 'week', 'year'
   * @returns {Promise<object>} The BigCal application
   */
  async openBigCal(options = {}) {
    const app = new BigCal();
    return app.render(true, options);
  },

  /**
   * Open the calendar editor for creating/editing custom calendars.
   * @param {string} [calendarId] - Calendar ID to edit (omit for new calendar)
   * @returns {Promise<object>} The editor application
   */
  async openCalendarEditor(calendarId) {
    if (!canEditCalendars()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    const app = new CalendarEditor({ calendarId });
    return app.render(true);
  },

  /**
   * Show the MiniCal widget.
   * @returns {Promise<object>} The MiniCal application
   */
  async showMiniCal() {
    return MiniCal.show();
  },

  /**
   * Hide the MiniCal widget.
   */
  async hideMiniCal() {
    MiniCal.hide();
  },

  /**
   * Toggle the MiniCal widget visibility.
   */
  async toggleMiniCal() {
    MiniCal.toggle();
  },

  /**
   * Convert a timestamp (world time in seconds) to date components.
   * @param {number} timestamp - World time in seconds
   * @returns {object} Date components {year, month, day, hour, minute}
   */
  timestampToDate(timestamp) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    const components = calendar.timeToComponents(timestamp);
    const yearZero = calendar.years?.yearZero ?? 0;
    return { year: components.year + yearZero, month: components.month, day: components.dayOfMonth + 1, hour: components.hour, minute: components.minute };
  },

  /**
   * Convert date components to a timestamp (world time in seconds).
   * @param {object} date - Date components {year, month, day, hour?, minute?, second?}
   * @returns {number} World time in seconds
   */
  dateToTimestamp(date) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return 0;
    const yearZero = calendar.years?.yearZero ?? 0;
    const year = date.year - yearZero;
    const month = date.month ?? 0;
    const dayOfMonth = date.dayOfMonth ?? (date.day != null ? date.day - 1 : 0);
    let day = dayOfMonth;
    const months = calendar.monthsArray ?? [];
    for (let i = 0; i < month; i++) {
      const isLeap = calendar.isLeapYear?.(year);
      day += isLeap && months[i]?.leapDays ? months[i].leapDays : (months[i]?.days ?? 0);
    }
    return calendar.componentsToTime({ year, month, day, dayOfMonth, hour: date.hour ?? 0, minute: date.minute ?? 0, second: date.second ?? 0 });
  },

  /**
   * Generate a random date within a range.
   * @param {object} [startDate] - Start date (defaults to current date)
   * @param {object} [endDate] - End date (defaults to 1 year from start)
   * @returns {object} Random date components
   */
  chooseRandomDate(startDate, endDate) {
    const current = this.getCurrentDateTime();
    if (!startDate) startDate = { year: current.year, month: current.month, day: current.dayOfMonth + 1 };
    if (!endDate) endDate = { year: startDate.year + 1, month: startDate.month, day: startDate.day };
    const startTimestamp = this.dateToTimestamp(startDate);
    const endTimestamp = this.dateToTimestamp(endDate);
    const randomTimestamp = startTimestamp + Math.floor(Math.random() * (endTimestamp - startTimestamp));
    return this.timestampToDate(randomTimestamp);
  },

  /**
   * Check if it's currently daytime.
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {boolean} True if between sunrise and sunset
   */
  isDaytime(zone) {
    const sunrise = this.getSunrise(zone);
    const sunset = this.getSunset(zone);
    if (sunrise === null || sunset === null) return true;
    const components = game.time.components;
    const minutesPerHour = this.calendar?.days?.minutesPerHour ?? 60;
    const currentHour = components.hour + components.minute / minutesPerHour;
    return currentHour >= sunrise && currentHour < sunset;
  },

  /**
   * Check if it's currently nighttime.
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {boolean} True if before sunrise or after sunset
   */
  isNighttime(zone) {
    return !this.isDaytime(zone);
  },

  /**
   * Advance time to the next occurrence of a preset time.
   * @param {string} preset - Time preset: 'sunrise', 'midday', 'sunset', 'midnight'
   * @returns {Promise<number>} New world time
   */
  async advanceTimeToPreset(preset) {
    if (!canChangeDateTime()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return game.time.worldTime;
    }
    const components = game.time.components;
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = this.calendar?.days?.minutesPerHour ?? 60;
    const secondsPerMinute = this.calendar?.days?.secondsPerMinute ?? 60;
    const secondsPerHour = minutesPerHour * secondsPerMinute;
    const currentHour = components.hour + components.minute / minutesPerHour + components.second / secondsPerHour;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    let targetHour;
    switch (preset.toLowerCase()) {
      case 'sunrise':
        targetHour = this.getSunrise(zone) ?? hoursPerDay / 4;
        break;
      case 'midday':
      case 'noon':
        targetHour = hoursPerDay / 2;
        break;
      case 'sunset':
        targetHour = this.getSunset(zone) ?? (hoursPerDay * 3) / 4;
        break;
      case 'midnight':
        targetHour = 0;
        break;
      default:
        log(2, `Unknown preset: ${preset}`);
        return game.time.worldTime;
    }
    let hoursUntil = targetHour - currentHour;
    if (hoursUntil <= 0) hoursUntil += hoursPerDay;
    const secondsUntil = Math.floor(hoursUntil * secondsPerHour);
    // Non-GM users with permission must request via socket
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: secondsUntil });
      return game.time.worldTime;
    }
    return await game.time.advance(secondsUntil);
  },

  /**
   * Check if the current user is the primary GM.
   * The primary GM is responsible for time saves and sync operations.
   * @returns {boolean} True if current user is primary GM
   */
  isPrimaryGM() {
    return CalendariaSocket.isPrimaryGM();
  },

  /**
   * Check if the current user can modify time.
   * @returns {boolean} True if user can advance/set time
   */
  canModifyTime() {
    return canChangeDateTime();
  },

  /**
   * Check if the current user can create/edit notes.
   * @returns {boolean} True if user can manage notes
   */
  canManageNotes() {
    return canAddNotes();
  },

  /**
   * Get the current weather.
   * @returns {object|null} Current weather state with id, label, icon, color, temperature
   */
  getCurrentWeather() {
    return WeatherManager.getCurrentWeather();
  },

  /**
   * Set the current weather by preset ID.
   * @param {string} presetId - Weather preset ID (e.g., 'clear', 'rain', 'thunderstorm')
   * @param {object} [options] - Additional options
   * @param {number} [options.temperature] - Optional temperature value
   * @returns {Promise<object>} The set weather
   */
  async setWeather(presetId, options = {}) {
    return WeatherManager.setWeather(presetId, options);
  },

  /**
   * Set custom weather with arbitrary values.
   * @param {object} weatherData - Weather data
   * @param {string} weatherData.label - Display label
   * @param {string} [weatherData.icon] - Font Awesome icon class
   * @param {string} [weatherData.color] - Display color
   * @param {string} [weatherData.description] - Description text
   * @param {number} [weatherData.temperature] - Temperature value
   * @returns {Promise<object>} The set weather
   */
  async setCustomWeather(weatherData) {
    return WeatherManager.setCustomWeather(weatherData);
  },

  /**
   * Clear the current weather.
   * @returns {Promise<void>}
   */
  async clearWeather() {
    return WeatherManager.clearWeather();
  },

  /**
   * Generate and set weather based on current climate and season.
   * @param {object} [options] - Generation options
   * @param {string} [options.climate] - Climate override (uses setting if not provided)
   * @param {string} [options.season] - Season override (uses current if not provided)
   * @returns {Promise<object>} Generated weather
   */
  async generateWeather(options = {}) {
    return WeatherManager.generateAndSetWeather(options);
  },

  /**
   * Get a weather forecast for upcoming days.
   * @param {object} [options] - Forecast options
   * @param {number} [options.days] - Number of days to forecast
   * @param {string} [options.climate] - Climate override
   * @returns {Promise<object[]>} Array of forecast entries
   */
  async getWeatherForecast(options = {}) {
    return WeatherManager.getForecast(options);
  },

  /**
   * Get the active climate zone.
   * @returns {object|null} Active zone config
   */
  getActiveZone() {
    return WeatherManager.getActiveZone();
  },

  /**
   * Set the active climate zone.
   * @param {string} zoneId - Climate zone ID
   * @returns {Promise<void>}
   */
  async setActiveZone(zoneId) {
    return WeatherManager.setActiveZone(zoneId);
  },

  /**
   * Get all available weather presets.
   * @returns {Promise<object[]>} Array of weather presets
   */
  async getWeatherPresets() {
    return WeatherManager.getAllPresets();
  },

  /**
   * Get all climate zones for the active calendar.
   * @returns {object[]} Array of zone configs
   */
  getCalendarZones() {
    return WeatherManager.getCalendarZones();
  },

  /**
   * Add a custom weather preset.
   * @param {object} preset - Preset definition
   * @param {string} preset.id - Unique ID
   * @param {string} preset.label - Display label
   * @param {string} [preset.icon] - Icon class
   * @param {string} [preset.color] - Display color
   * @param {string} [preset.description] - Description
   * @returns {Promise<object>} The added preset
   */
  async addWeatherPreset(preset) {
    return WeatherManager.addCustomPreset(preset);
  },

  /**
   * Remove a custom weather preset.
   * @param {string} presetId - Preset ID to remove
   * @returns {Promise<boolean>} True if removed
   */
  async removeWeatherPreset(presetId) {
    return WeatherManager.removeCustomPreset(presetId);
  },

  /**
   * Get available climate zone templates for creating new zones.
   * @returns {object[]} Array of climate zone template objects
   */
  getClimateZoneTemplates() {
    return WeatherManager.getClimateZoneTemplates();
  },

  /**
   * Check if a calendar is a bundled (built-in) calendar.
   * @param {string} calendarId - Calendar ID to check
   * @returns {boolean} True if bundled calendar
   */
  isBundledCalendar(calendarId) {
    return CalendarManager.isBundledCalendar(calendarId);
  },

  /**
   * Diagnose weather configuration issues.
   * Inspects raw settings to find weather data that may not be loading properly.
   * @param {boolean} [showDialog] - Whether to show a dialog with results
   * @returns {Promise<object>} Diagnostic results with settingsData and activeCalendar info
   */
  async diagnoseWeather(showDialog = true) {
    return diagnoseWeatherConfig(showDialog);
  },

  /**
   * Get all available Calendaria hook names.
   * @returns {object} Object containing all hook name constants
   */
  get hooks() {
    return { ...HOOKS };
  },

  /**
   * Add days to a date.
   * @param {object} date - Starting date {year, month, day, hour?, minute?}
   * @param {number} days - Days to add (can be negative)
   * @returns {object} New date object
   */
  addDays(date, days) {
    return addDays(date, days);
  },

  /**
   * Add months to a date.
   * @param {object} date - Starting date {year, month, day, hour?, minute?}
   * @param {number} months - Months to add (can be negative)
   * @returns {object} New date object
   */
  addMonths(date, months) {
    return addMonths(date, months);
  },

  /**
   * Add years to a date.
   * @param {object} date - Starting date {year, month, day, hour?, minute?}
   * @param {number} years - Years to add (can be negative)
   * @returns {object} New date object
   */
  addYears(date, years) {
    return addYears(date, years);
  },

  /**
   * Calculate days between two dates.
   * @param {object} startDate - Start date {year, month, day}
   * @param {object} endDate - End date {year, month, day}
   * @returns {number} Number of days (can be negative)
   */
  daysBetween(startDate, endDate) {
    return daysBetween(startDate, endDate);
  },

  /**
   * Calculate months between two dates.
   * @param {object} startDate - Start date {year, month}
   * @param {object} endDate - End date {year, month}
   * @returns {number} Number of months (can be negative)
   */
  monthsBetween(startDate, endDate) {
    return monthsBetween(startDate, endDate);
  },

  /**
   * Compare two date objects including time.
   * @param {object} date1 - First date
   * @param {object} date2 - Second date
   * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
   */
  compareDates(date1, date2) {
    return compareDates(date1, date2);
  },

  /**
   * Compare two dates by day only (ignoring time).
   * @param {object} date1 - First date
   * @param {object} date2 - Second date
   * @returns {number} -1 if date1 < date2, 0 if same day, 1 if date1 > date2
   */
  compareDays(date1, date2) {
    return compareDays(date1, date2);
  },

  /**
   * Check if two dates are the same day (ignoring time).
   * @param {object} date1 - First date
   * @param {object} date2 - Second date
   * @returns {boolean} True if same day
   */
  isSameDay(date1, date2) {
    return isSameDay(date1, date2);
  },

  /**
   * Get day of week for a date (0 = first day of week).
   * @param {object} date - Date to check {year, month, day}
   * @returns {number} Day of week index
   */
  dayOfWeek(date) {
    return dayOfWeek(date);
  },

  /**
   * Check if a date is valid for the current calendar.
   * @param {object} date - Date to validate {year, month, day, hour?, minute?}
   * @returns {boolean} True if valid
   */
  isValidDate(date) {
    return isValidDate(date);
  },

  /**
   * Get the full JournalEntryPage document for a note.
   * @param {string} pageId - The journal entry page ID
   * @returns {object|null} The page document or null if not found
   */
  getNoteDocument(pageId) {
    return NoteManager.getFullNote(pageId);
  },

  /**
   * Get available widget insertion points.
   * @returns {object} Object containing insertion point constants
   */
  get widgetPoints() {
    return { ...WIDGET_POINTS };
  },

  /**
   * Get replaceable element IDs.
   * @returns {object} Object containing replaceable element constants
   */
  get replaceableElements() {
    return { ...REPLACEABLE_ELEMENTS };
  },

  /**
   * Register a widget to be displayed in Calendaria UIs.
   * @param {string} moduleId - Your module's ID
   * @param {object} config - Widget configuration
   * @param {string} config.id - Unique widget ID within your module
   * @param {string} config.type - Widget type: 'button' | 'indicator' | 'custom'
   * @param {string} [config.insertAt] - Insertion point (use widgetPoints constants)
   * @param {string} [config.replaces] - Built-in element ID to replace (use replaceableElements constants)
   * @param {string|Function} [config.icon] - Icon class or function returning icon
   * @param {string|Function} [config.label] - Label text or function for dynamic content
   * @param {string|Function} [config.color] - Color or function
   * @param {string|Function} [config.tooltip] - Tooltip or function
   * @param {Function} [config.onClick] - Click handler (receives event)
   * @param {Function} [config.render] - Custom render function for type='custom'
   * @param {Function} [config.onAttach] - Called when widget attached to DOM
   * @param {Function} [config.onDetach] - Called when widget detached
   * @param {boolean} [config.disabled] - If true with replaces, hides element entirely
   * @returns {boolean} True if registered successfully
   */
  registerWidget(moduleId, config) {
    return WidgetManager.registerWidget(moduleId, config);
  },

  /**
   * Get all registered widgets, optionally filtered by insertion point.
   * @param {string} [insertPoint] - Filter by insertion point
   * @returns {Array<object>} Array of widget configurations
   */
  getRegisteredWidgets(insertPoint) {
    return WidgetManager.getRegisteredWidgets(insertPoint);
  },

  /**
   * Get the widget that is replacing a built-in element.
   * @param {string} elementId - The built-in element ID
   * @returns {object|null} Widget config or null if not replaced
   */
  getWidgetByReplacement(elementId) {
    return WidgetManager.getWidgetByReplacement(elementId);
  },

  /**
   * Refresh all widget displays. Call after dynamic content changes.
   */
  refreshWidgets() {
    WidgetManager.refreshWidgets();
  }
};
