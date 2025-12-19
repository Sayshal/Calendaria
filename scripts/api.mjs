/**
 * Calendaria Public API
 * Provides a stable public API for macros and other modules to interact with Calendaria.
 *
 * Access via: game.modules.get('calendaria').api or window.CALENDARIA.api
 *
 * @module API
 * @author Tyler
 */

import CalendarManager from './calendar/calendar-manager.mjs';
import NoteManager from './notes/note-manager.mjs';
import { CalendariaSocket } from './utils/socket.mjs';
import { log } from './utils/logger.mjs';
import { HOOKS } from './constants.mjs';
import { CalendarApplication } from './applications/calendar-application.mjs';
import { CalendarEditor } from './applications/calendar-editor.mjs';
import { CompactCalendar } from './applications/compact-calendar.mjs';
import WeatherManager from './weather/weather-manager.mjs';

/**
 * Public API for Calendaria module.
 * Provides access to calendar data, time management, moon phases, and more.
 */
export const CalendariaAPI = {
  /* -------------------------------------------- */
  /*  Time Management                             */
  /* -------------------------------------------- */

  /**
   * Get the current date and time components.
   * @returns {TimeComponents} Current time components (year, month, day, hour, minute, second, etc.)
   * @example
   * const now = CALENDARIA.api.getCurrentDateTime();
   * console.log(now.year, now.month, now.dayOfMonth);
   */
  getCurrentDateTime() {
    const components = game.time.components;
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;

    return { ...components, year: components.year + yearZero };
  },

  /**
   * Advance the current time by a delta.
   * @param {object} delta - Time delta to advance (e.g., {day: 1, hour: 2})
   * @returns {Promise<number>} New world time after advancement
   * @example
   * await CALENDARIA.api.advanceTime({ day: 1 }); // Advance by 1 day
   * await CALENDARIA.api.advanceTime({ hour: 8, minute: 30 }); // Advance by 8.5 hours
   */
  async advanceTime(delta) {
    if (!game.user.isGM) {
      ui.notifications.error('Only GMs can advance time');
      return game.time.worldTime;
    }

    return await game.time.advance(delta);
  },

  /**
   * Set the current date and time to specific components.
   * @param {object} components - Time components to set (year, month, day, hour, minute, second)
   * @returns {Promise<number>} New world time after setting
   * @example
   * await CALENDARIA.api.setDateTime({ year: 1492, month: 1, day: 15 });
   */
  async setDateTime(components) {
    if (!game.user.isGM) {
      ui.notifications.error('Only GMs can set date/time');
      return game.time.worldTime;
    }

    // Convert display year to internal year if year is provided
    const internalComponents = { ...components };
    if (components.year !== undefined) {
      const calendar = CalendarManager.getActiveCalendar();
      const yearZero = calendar?.years?.yearZero ?? 0;
      internalComponents.year = components.year - yearZero;
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
   * @example
   * await CALENDARIA.api.jumpToDate({ year: 1492, month: 5, day: 21 });
   */
  async jumpToDate({ year, month, day }) {
    if (!game.user.isGM) {
      ui.notifications.error('Only GMs can jump to date');
      return;
    }

    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) {
      ui.notifications.warn('No active calendar available');
      return;
    }

    await calendar.jumpToDate({ year, month, day });
  },

  /* -------------------------------------------- */
  /*  Calendar Access                             */
  /* -------------------------------------------- */

  /**
   * Get the currently active calendar.
   * @returns {CalendariaCalendar|null} The active calendar or null if none
   * @example
   * const calendar = CALENDARIA.api.getActiveCalendar();
   * console.log(calendar.name, calendar.months);
   */
  getActiveCalendar() {
    return CalendarManager.getActiveCalendar();
  },

  /**
   * Get a specific calendar by ID.
   * @param {string} id - Calendar ID
   * @returns {CalendariaCalendar|null} The calendar or null if not found
   * @example
   * const harptos = CALENDARIA.api.getCalendar('harptos');
   */
  getCalendar(id) {
    return CalendarManager.getCalendar(id);
  },

  /**
   * Get all registered calendars.
   * @returns {Map<string, CalendariaCalendar>} Map of calendar ID to calendar
   * @example
   * const allCalendars = CALENDARIA.api.getAllCalendars();
   * for (const [id, calendar] of allCalendars) {
   *   console.log(id, calendar.name);
   * }
   */
  getAllCalendars() {
    return CalendarManager.getAllCalendars();
  },

  /**
   * Get metadata for all calendars.
   * @returns {object[]} Array of calendar metadata
   * @example
   * const metadata = CALENDARIA.api.getAllCalendarMetadata();
   * metadata.forEach(cal => console.log(cal.name, cal.author, cal.isActive));
   */
  getAllCalendarMetadata() {
    return CalendarManager.getAllCalendarMetadata();
  },

  /**
   * Switch to a different calendar.
   * @param {string} id - Calendar ID to switch to
   * @returns {Promise<boolean>} True if calendar was switched successfully
   * @example
   * await CALENDARIA.api.switchCalendar('greyhawk');
   */
  async switchCalendar(id) {
    if (!game.user.isGM) {
      ui.notifications.error('Only GMs can switch calendars');
      return false;
    }

    return await CalendarManager.switchCalendar(id);
  },

  /* -------------------------------------------- */
  /*  Moon Phases                                 */
  /* -------------------------------------------- */

  /**
   * Get the current phase of a specific moon.
   * @param {number} [moonIndex=0] - Index of the moon (0 for primary moon)
   * @returns {object|null} Moon phase data with name, icon, position, and dayInCycle
   * @example
   * const selune = CALENDARIA.api.getMoonPhase(0);
   * console.log(selune.name, selune.position);
   */
  getMoonPhase(moonIndex = 0) {
    return CalendarManager.getCurrentMoonPhase(moonIndex);
  },

  /**
   * Get all moon phases for the active calendar.
   * @returns {Array<object>} Array of moon phase data
   * @example
   * const moons = CALENDARIA.api.getAllMoonPhases();
   * moons.forEach(moon => console.log(moon.name));
   */
  getAllMoonPhases() {
    return CalendarManager.getAllCurrentMoonPhases();
  },

  /* -------------------------------------------- */
  /*  Seasons & Sun Position                      */
  /* -------------------------------------------- */

  /**
   * Get the current season.
   * @returns {object|null} Season data with name and other properties
   * @example
   * const season = CALENDARIA.api.getCurrentSeason();
   * console.log(season.name);
   */
  getCurrentSeason() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || !calendar.seasons) return null;
    const components = game.time.components;
    const seasonIndex = components.season ?? 0;
    return calendar.seasons.values?.[seasonIndex] ?? null;
  },

  /**
   * Get the current values for all cycles (zodiac signs, elemental weeks, etc).
   * @returns {{text: string, values: Array<{cycleName: string, entryName: string, index: number}>}|null}
   * @example
   * const cycles = CALENDARIA.api.getCycleValues();
   * console.log(cycles.text); // Formatted display text
   * cycles.values.forEach(v => console.log(v.cycleName, v.entryName));
   */
  getCycleValues() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.getCycleValues !== 'function') return null;
    return calendar.getCycleValues();
  },

  /**
   * Get the sunrise time in hours for the current day.
   * @returns {number|null} Sunrise time in hours (e.g., 6.5 = 6:30 AM)
   * @example
   * const sunrise = CALENDARIA.api.getSunrise();
   * console.log(`Sunrise at ${Math.floor(sunrise)}:${Math.round((sunrise % 1) * 60)}`);
   */
  getSunrise() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.sunrise !== 'function') return null;
    return calendar.sunrise();
  },

  /**
   * Get the sunset time in hours for the current day.
   * @returns {number|null} Sunset time in hours (e.g., 18.5 = 6:30 PM)
   * @example
   * const sunset = CALENDARIA.api.getSunset();
   * console.log(`Sunset at ${Math.floor(sunset)}:${Math.round((sunset % 1) * 60)}`);
   */
  getSunset() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.sunset !== 'function') return null;
    return calendar.sunset();
  },

  /**
   * Get the number of daylight hours for the current day.
   * @returns {number|null} Hours of daylight (e.g., 12.5)
   * @example
   * const daylight = CALENDARIA.api.getDaylightHours();
   * console.log(`${daylight} hours of daylight`);
   */
  getDaylightHours() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.daylightHours !== 'function') return null;
    return calendar.daylightHours();
  },

  /**
   * Get progress through the day period (0 = sunrise, 1 = sunset).
   * @returns {number|null} Progress value between 0-1
   * @example
   * const progress = CALENDARIA.api.getProgressDay();
   * console.log(`${Math.round(progress * 100)}% through the day`);
   */
  getProgressDay() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.progressDay !== 'function') return null;
    return calendar.progressDay();
  },

  /**
   * Get progress through the night period (0 = sunset, 1 = sunrise).
   * @returns {number|null} Progress value between 0-1
   * @example
   * const progress = CALENDARIA.api.getProgressNight();
   * console.log(`${Math.round(progress * 100)}% through the night`);
   */
  getProgressNight() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.progressNight !== 'function') return null;
    return calendar.progressNight();
  },

  /**
   * Get time until next sunrise.
   * @returns {Object|null} Time delta {hours, minutes, seconds} or null
   * @example
   * const until = CALENDARIA.api.getTimeUntilSunrise();
   * if (until) console.log(`${until.hours}h ${until.minutes}m until sunrise`);
   */
  getTimeUntilSunrise() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.sunrise !== 'function') return null;
    const targetHour = calendar.sunrise();
    if (targetHour === null) return null;
    const components = game.time.components;
    const currentHour = components.hour + components.minute / 60 + components.second / 3600;
    const hoursUntil = currentHour < targetHour ? targetHour - currentHour : 24 - currentHour + targetHour;
    const hours = Math.floor(hoursUntil);
    const remainingMinutes = (hoursUntil - hours) * 60;
    const minutes = Math.floor(remainingMinutes);
    const seconds = Math.floor((remainingMinutes - minutes) * 60);
    return { hours, minutes, seconds };
  },

  /**
   * Get time until next sunset.
   * @returns {Object|null} Time delta {hours, minutes, seconds} or null
   * @example
   * const until = CALENDARIA.api.getTimeUntilSunset();
   * if (until) console.log(`${until.hours}h ${until.minutes}m until sunset`);
   */
  getTimeUntilSunset() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.sunset !== 'function') return null;
    const targetHour = calendar.sunset();
    if (targetHour === null) return null;
    const components = game.time.components;
    const currentHour = components.hour + components.minute / 60 + components.second / 3600;
    const hoursUntil = currentHour < targetHour ? targetHour - currentHour : 24 - currentHour + targetHour;
    const hours = Math.floor(hoursUntil);
    const remainingMinutes = (hoursUntil - hours) * 60;
    const minutes = Math.floor(remainingMinutes);
    const seconds = Math.floor((remainingMinutes - minutes) * 60);
    return { hours, minutes, seconds };
  },

  /**
   * Get time until next midnight.
   * @returns {Object|null} Time delta {hours, minutes, seconds} or null
   * @example
   * const until = CALENDARIA.api.getTimeUntilMidnight();
   * if (until) console.log(`${until.hours}h ${until.minutes}m until midnight`);
   */
  getTimeUntilMidnight() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    const targetHour = 0;
    const components = game.time.components;
    const currentHour = components.hour + components.minute / 60 + components.second / 3600;
    const hoursUntil = currentHour < targetHour ? targetHour - currentHour : 24 - currentHour + targetHour;
    const hours = Math.floor(hoursUntil);
    const remainingMinutes = (hoursUntil - hours) * 60;
    const minutes = Math.floor(remainingMinutes);
    const seconds = Math.floor((remainingMinutes - minutes) * 60);
    return { hours, minutes, seconds };
  },

  /**
   * Get time until next midday.
   * @returns {Object|null} Time delta {hours, minutes, seconds} or null
   * @example
   * const until = CALENDARIA.api.getTimeUntilMidday();
   * if (until) console.log(`${until.hours}h ${until.minutes}m until midday`);
   */
  getTimeUntilMidday() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    const targetHour = 12;
    const components = game.time.components;
    const currentHour = components.hour + components.minute / 60 + components.second / 3600;
    const hoursUntil = currentHour < targetHour ? targetHour - currentHour : 24 - currentHour + targetHour;
    const hours = Math.floor(hoursUntil);
    const remainingMinutes = (hoursUntil - hours) * 60;
    const minutes = Math.floor(remainingMinutes);
    const seconds = Math.floor((remainingMinutes - minutes) * 60);
    return { hours, minutes, seconds };
  },

  /* -------------------------------------------- */
  /*  Festivals & Special Days                    */
  /* -------------------------------------------- */

  /**
   * Get the festival for the current date, if any.
   * @returns {object|null} Festival data with name, month, and day
   * @example
   * const festival = CALENDARIA.api.getCurrentFestival();
   * if (festival) console.log(`Today is ${festival.name}!`);
   */
  getCurrentFestival() {
    return CalendarManager.getCurrentFestival();
  },

  /**
   * Check if the current date is a festival day.
   * @returns {boolean} True if current date is a festival
   * @example
   * if (CALENDARIA.api.isFestivalDay()) {
   *   console.log('It\'s a festival day!');
   * }
   */
  isFestivalDay() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar || typeof calendar.isFestivalDay !== 'function') return false;
    return calendar.isFestivalDay();
  },

  /* -------------------------------------------- */
  /*  Formatters                                  */
  /* -------------------------------------------- */

  /**
   * Format date and time components as a string.
   * @param {TimeComponents} [components] - Time components to format (defaults to current time)
   * @param {string} [formatter] - Formatter type (e.g., 'date', 'time', 'datetime')
   * @returns {string} Formatted date/time string
   * @example
   * const formatted = CALENDARIA.api.formatDate(null, 'datetime');
   * console.log(formatted); // "15 Hammer 1492, 3:30 PM"
   */
  formatDate(components = null, formatter = 'date') {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return '';

    // If no components provided, use current game time (internal year)
    const isInternalComponents = !components;
    components = components || game.time.components;

    // Use calendar's format method if available
    if (typeof calendar.format === 'function') return calendar.format(components, formatter);

    // Fallback to basic formatting
    // Only add yearZero if components are internal (from game.time.components)
    const displayYear = isInternalComponents ? components.year + calendar.years.yearZero : components.year;
    return `${components.dayOfMonth + 1} ${calendar.months.values[components.month]?.name ?? 'Unknown'} ${displayYear}`;
  },

  /* -------------------------------------------- */
  /*  Notes Management                            */
  /* -------------------------------------------- */

  /**
   * Get all calendar notes.
   * @returns {object[]} Array of note stubs with id, name, flagData, etc.
   * @example
   * const notes = CALENDARIA.api.getAllNotes();
   * notes.forEach(note => console.log(note.name, note.flagData.startDate));
   */
  getAllNotes() {
    return NoteManager.getAllNotes();
  },

  /**
   * Get a specific note by ID.
   * @param {string} pageId - The journal entry page ID
   * @returns {object|null} Note stub or null if not found
   * @example
   * const note = CALENDARIA.api.getNote('abc123');
   * if (note) console.log(note.name);
   */
  getNote(pageId) {
    return NoteManager.getNote(pageId);
  },

  /**
   * Delete a specific calendar note.
   * @param {string} pageId - The journal entry page ID
   * @returns {Promise<boolean>} True if deleted successfully
   * @example
   * await CALENDARIA.api.deleteNote('abc123');
   */
  async deleteNote(pageId) {
    return await NoteManager.deleteNote(pageId);
  },

  /**
   * Delete all calendar notes.
   * @returns {Promise<number>} Number of notes deleted
   * @example
   * const count = await CALENDARIA.api.deleteAllNotes();
   * console.log(`Deleted ${count} notes`);
   */
  async deleteAllNotes() {
    return await NoteManager.deleteAllNotes();
  },

  /* -------------------------------------------- */
  /*  Note Creation & Management                  */
  /* -------------------------------------------- */

  /**
   * Create a new calendar note.
   * @param {object} options - Note creation options
   * @param {string} options.name - Note title
   * @param {string} [options.content=''] - Note content (HTML)
   * @param {object} options.startDate - Start date {year, month, day, hour?, minute?}
   * @param {object} [options.endDate] - End date {year, month, day, hour?, minute?}
   * @param {boolean} [options.allDay=true] - Whether this is an all-day event
   * @param {string} [options.repeat='never'] - Repeat pattern: 'never', 'daily', 'weekly', 'monthly', 'yearly'
   * @param {string[]} [options.categories=[]] - Category IDs
   * @param {string} [options.icon] - Icon path or class
   * @param {string} [options.color] - Event color (hex)
   * @param {boolean} [options.gmOnly=false] - Whether note is GM-only
   * @returns {Promise<JournalEntryPage>} Created note page
   * @example
   * const note = await CALENDARIA.api.createNote({
   *   name: 'Festival of the Moon',
   *   startDate: { year: 1492, month: 0, day: 15 },
   *   allDay: true,
   *   categories: ['holiday']
   * });
   */
  async createNote({ name, content = '', startDate, endDate, allDay = true, repeat = 'never', categories = [], icon, color, gmOnly = false }) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can create notes');
      ui.notifications.error('Only GMs can create notes');
      return null;
    }

    // Convert display year to internal year
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const noteData = {
      startDate: { year: startDate.year - yearZero, month: startDate.month, day: startDate.day, hour: startDate.hour ?? 0, minute: startDate.minute ?? 0 },
      endDate: endDate ? { year: endDate.year - yearZero, month: endDate.month, day: endDate.day, hour: endDate.hour ?? 23, minute: endDate.minute ?? 59 } : null,
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
   * @returns {Promise<JournalEntryPage>} Updated note page
   * @example
   * await CALENDARIA.api.updateNote('abc123', { name: 'Updated Title' });
   */
  async updateNote(pageId, updates) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can update notes');
      ui.notifications.error('Only GMs can update notes');
      return null;
    }

    // Convert display year to internal year if dates are provided
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;

    const noteData = {};
    if (updates.startDate) noteData.startDate = { ...updates.startDate, year: updates.startDate.year - yearZero };
    if (updates.endDate) noteData.endDate = { ...updates.endDate, year: updates.endDate.year - yearZero };
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
   * @param {string} [options.mode='view'] - 'view' or 'edit'
   * @returns {Promise<void>}
   * @example
   * await CALENDARIA.api.openNote('abc123');
   */
  async openNote(pageId, options = {}) {
    const page = NoteManager.getFullNote(pageId);
    if (!page) {
      log(2, `Note not found: ${pageId}`);
      ui.notifications.warn('Note not found');
      return;
    }

    page.sheet.render(true, { mode: options.mode ?? 'view' });
  },

  /* -------------------------------------------- */
  /*  Note Queries                                */
  /* -------------------------------------------- */

  /**
   * Get all notes for a specific date.
   * @param {number} year - Year (display year, not internal)
   * @param {number} month - Month (0-indexed)
   * @param {number} day - Day of month
   * @returns {object[]} Array of note stubs
   * @example
   * const notes = CALENDARIA.api.getNotesForDate(1492, 0, 15);
   * notes.forEach(note => console.log(note.name));
   */
  getNotesForDate(year, month, day) {
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    return NoteManager.getNotesForDate(year - yearZero, month, day);
  },

  /**
   * Get all notes for a specific month.
   * @param {number} year - Year (display year)
   * @param {number} month - Month (0-indexed)
   * @returns {object[]} Array of note stubs
   * @example
   * const notes = CALENDARIA.api.getNotesForMonth(1492, 0);
   */
  getNotesForMonth(year, month) {
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const internalYear = year - yearZero;

    // Get the number of days in this month
    const monthData = calendar?.months?.values?.[month];
    const daysInMonth = monthData?.days ?? 30;

    return NoteManager.getNotesInRange({ year: internalYear, month, day: 0 }, { year: internalYear, month, day: daysInMonth - 1 });
  },

  /**
   * Get all notes within a date range.
   * @param {object} startDate - Start date {year, month, day}
   * @param {object} endDate - End date {year, month, day}
   * @returns {object[]} Array of note stubs
   * @example
   * const notes = CALENDARIA.api.getNotesInRange(
   *   { year: 1492, month: 0, day: 1 },
   *   { year: 1492, month: 0, day: 31 }
   * );
   */
  getNotesInRange(startDate, endDate) {
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;

    return NoteManager.getNotesInRange({ ...startDate, year: startDate.year - yearZero }, { ...endDate, year: endDate.year - yearZero });
  },

  /**
   * Search notes by text in title or content.
   * @param {string} searchTerm - Text to search for
   * @param {object} [options] - Search options
   * @param {boolean} [options.caseSensitive=false] - Case-sensitive search
   * @param {string[]} [options.categories] - Filter by categories
   * @returns {object[]} Array of matching note stubs
   * @example
   * const results = CALENDARIA.api.searchNotes('festival');
   */
  searchNotes(searchTerm, options = {}) {
    const allNotes = NoteManager.getAllNotes();
    const term = options.caseSensitive ? searchTerm : searchTerm.toLowerCase();

    return allNotes.filter((note) => {
      // Check categories filter
      if (options.categories?.length > 0) {
        const noteCategories = note.flagData?.categories ?? [];
        if (!options.categories.some((cat) => noteCategories.includes(cat))) return false;
      }

      // Check name
      const name = options.caseSensitive ? note.name : note.name.toLowerCase();
      if (name.includes(term)) return true;

      // Check content (if available in stub)
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
   * @example
   * const holidays = CALENDARIA.api.getNotesByCategory('holiday');
   */
  getNotesByCategory(categoryId) {
    return NoteManager.getNotesByCategory(categoryId);
  },

  /**
   * Get all category definitions.
   * @returns {object[]} Array of category definitions
   * @example
   * const categories = CALENDARIA.api.getCategories();
   */
  getCategories() {
    return NoteManager.getCategoryDefinitions();
  },

  /* -------------------------------------------- */
  /*  UI & Application                            */
  /* -------------------------------------------- */

  /**
   * Open the main calendar application.
   * @param {object} [options] - Open options
   * @param {object} [options.date] - Date to display {year, month, day}
   * @param {string} [options.view] - View mode: 'month', 'week', 'year'
   * @returns {Promise<Application>} The calendar application
   * @example
   * await CALENDARIA.api.openCalendar();
   * await CALENDARIA.api.openCalendar({ date: { year: 1492, month: 5, day: 1 } });
   */
  async openCalendar(options = {}) {
    const app = new CalendarApplication();
    return app.render(true, options);
  },

  /**
   * Open the calendar editor for creating/editing custom calendars.
   * @param {string} [calendarId] - Calendar ID to edit (omit for new calendar)
   * @returns {Promise<Application>} The editor application
   * @example
   * await CALENDARIA.api.openCalendarEditor(); // New calendar
   * await CALENDARIA.api.openCalendarEditor('custom-mycalendar'); // Edit existing
   */
  async openCalendarEditor(calendarId) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can edit calendars');
      ui.notifications.error('Only GMs can edit calendars');
      return null;
    }

    const app = new CalendarEditor({ calendarId });
    return app.render(true);
  },

  /**
   * Show the compact calendar widget.
   * @returns {Promise<Application>} The compact calendar application
   * @example
   * CALENDARIA.api.showCompactCalendar();
   */
  async showCompactCalendar() {
    return CompactCalendar.show();
  },

  /**
   * Hide the compact calendar widget.
   * @example
   * CALENDARIA.api.hideCompactCalendar();
   */
  async hideCompactCalendar() {
    CompactCalendar.hide();
  },

  /**
   * Toggle the compact calendar widget visibility.
   * @example
   * CALENDARIA.api.toggleCompactCalendar();
   */
  async toggleCompactCalendar() {
    CompactCalendar.toggle();
  },

  /* -------------------------------------------- */
  /*  Date/Time Conversion                        */
  /* -------------------------------------------- */

  /**
   * Convert a timestamp (world time in seconds) to date components.
   * @param {number} timestamp - World time in seconds
   * @returns {object} Date components {year, month, dayOfMonth, hour, minute, second}
   * @example
   * const date = CALENDARIA.api.timestampToDate(game.time.worldTime);
   */
  timestampToDate(timestamp) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;

    const components = calendar.timeToComponents(timestamp);
    const yearZero = calendar.years?.yearZero ?? 0;

    return { ...components, year: components.year + yearZero };
  },

  /**
   * Convert date components to a timestamp (world time in seconds).
   * @param {object} date - Date components {year, month, day, hour?, minute?, second?}
   * @returns {number} World time in seconds
   * @example
   * const timestamp = CALENDARIA.api.dateToTimestamp({ year: 1492, month: 0, day: 15 });
   */
  dateToTimestamp(date) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return 0;

    const yearZero = calendar.years?.yearZero ?? 0;

    return calendar.componentsToTime({
      year: date.year - yearZero,
      month: date.month,
      dayOfMonth: date.day ?? date.dayOfMonth ?? 0,
      hour: date.hour ?? 0,
      minute: date.minute ?? 0,
      second: date.second ?? 0
    });
  },

  /**
   * Generate a random date within a range.
   * @param {object} [startDate] - Start date (defaults to current date)
   * @param {object} [endDate] - End date (defaults to 1 year from start)
   * @returns {object} Random date components
   * @example
   * const randomDate = CALENDARIA.api.chooseRandomDate(
   *   { year: 1492, month: 0, day: 1 },
   *   { year: 1492, month: 11, day: 30 }
   * );
   */
  chooseRandomDate(startDate, endDate) {
    const current = this.getCurrentDateTime();

    // Default start to current date
    if (!startDate) startDate = { year: current.year, month: current.month, day: current.dayOfMonth };

    // Default end to 1 year from start
    if (!endDate) endDate = { year: startDate.year + 1, month: startDate.month, day: startDate.day };

    const startTimestamp = this.dateToTimestamp(startDate);
    const endTimestamp = this.dateToTimestamp(endDate);

    const randomTimestamp = startTimestamp + Math.floor(Math.random() * (endTimestamp - startTimestamp));

    return this.timestampToDate(randomTimestamp);
  },

  /* -------------------------------------------- */
  /*  Time-of-Day Utilities                       */
  /* -------------------------------------------- */

  /**
   * Check if it's currently daytime.
   * @returns {boolean} True if between sunrise and sunset
   * @example
   * if (CALENDARIA.api.isDaytime()) {
   *   console.log('The sun is up!');
   * }
   */
  isDaytime() {
    const sunrise = this.getSunrise();
    const sunset = this.getSunset();
    if (sunrise === null || sunset === null) return true;

    const components = game.time.components;
    const currentHour = components.hour + components.minute / 60;

    return currentHour >= sunrise && currentHour < sunset;
  },

  /**
   * Check if it's currently nighttime.
   * @returns {boolean} True if before sunrise or after sunset
   * @example
   * if (CALENDARIA.api.isNighttime()) {
   *   console.log('The stars are out!');
   * }
   */
  isNighttime() {
    return !this.isDaytime();
  },

  /**
   * Advance time to the next occurrence of a preset time.
   * @param {string} preset - Time preset: 'sunrise', 'midday', 'sunset', 'midnight'
   * @returns {Promise<number>} New world time
   * @example
   * await CALENDARIA.api.advanceTimeToPreset('sunrise');
   */
  async advanceTimeToPreset(preset) {
    if (!game.user.isGM) {
      log(1, 'Only GMs can advance time');
      ui.notifications.error('Only GMs can advance time');
      return game.time.worldTime;
    }

    const components = game.time.components;
    const currentHour = components.hour + components.minute / 60 + components.second / 3600;

    let targetHour;
    switch (preset.toLowerCase()) {
      case 'sunrise':
        targetHour = this.getSunrise() ?? 6;
        break;
      case 'midday':
      case 'noon':
        targetHour = 12;
        break;
      case 'sunset':
        targetHour = this.getSunset() ?? 18;
        break;
      case 'midnight':
        targetHour = 0;
        break;
      default:
        log(2, `Unknown preset: ${preset}`);
        return game.time.worldTime;
    }

    // Calculate hours until target
    let hoursUntil = targetHour - currentHour;
    if (hoursUntil <= 0) hoursUntil += 24; // Next day

    const secondsUntil = Math.floor(hoursUntil * 3600);
    return await game.time.advance(secondsUntil);
  },

  /* -------------------------------------------- */
  /*  Multiplayer & Permissions                   */
  /* -------------------------------------------- */

  /**
   * Check if the current user is the primary GM.
   * The primary GM is responsible for time saves and sync operations.
   * @returns {boolean} True if current user is primary GM
   * @example
   * if (CALENDARIA.api.isPrimaryGM()) {
   *   // Perform GM-only sync operation
   * }
   */
  isPrimaryGM() {
    return CalendariaSocket.isPrimaryGM();
  },

  /**
   * Check if the current user can modify time.
   * @returns {boolean} True if user can advance/set time
   */
  canModifyTime() {
    return game.user.isGM;
  },

  /**
   * Check if the current user can create/edit notes.
   * @returns {boolean} True if user can manage notes
   */
  canManageNotes() {
    return game.user.isGM;
  },

  /* -------------------------------------------- */
  /*  Weather System                              */
  /* -------------------------------------------- */

  /**
   * Get the current weather.
   * @returns {object|null} Current weather state with id, label, icon, color, temperature
   * @example
   * const weather = CALENDARIA.api.getCurrentWeather();
   * if (weather) console.log(`Current weather: ${weather.label}`);
   */
  getCurrentWeather() {
    return WeatherManager.getCurrentWeather();
  },

  /**
   * Set the current weather by preset ID.
   * @param {string} presetId - Weather preset ID (e.g., 'clear', 'rain', 'thunderstorm')
   * @param {object} [options={}] - Additional options
   * @param {number} [options.temperature] - Optional temperature value
   * @returns {Promise<object>} The set weather
   * @example
   * await CALENDARIA.api.setWeather('rain');
   * await CALENDARIA.api.setWeather('snow', { temperature: -5 });
   */
  async setWeather(presetId, options = {}) {
    return WeatherManager.setWeather(presetId, options);
  },

  /**
   * Set custom weather with arbitrary values.
   * @param {object} weatherData - Weather data
   * @param {string} weatherData.label - Display label
   * @param {string} [weatherData.icon='fa-question'] - Font Awesome icon class
   * @param {string} [weatherData.color='#888888'] - Display color
   * @param {string} [weatherData.description] - Description text
   * @param {number} [weatherData.temperature] - Temperature value
   * @returns {Promise<object>} The set weather
   * @example
   * await CALENDARIA.api.setCustomWeather({
   *   label: 'Magical Aurora',
   *   icon: 'fa-star',
   *   color: '#E0BBFF',
   *   description: 'Shimmering lights dance across the sky'
   * });
   */
  async setCustomWeather(weatherData) {
    return WeatherManager.setCustomWeather(weatherData);
  },

  /**
   * Clear the current weather.
   * @returns {Promise<void>}
   * @example
   * await CALENDARIA.api.clearWeather();
   */
  async clearWeather() {
    return WeatherManager.clearWeather();
  },

  /**
   * Generate and set weather based on current climate and season.
   * @param {object} [options={}] - Generation options
   * @param {string} [options.climate] - Climate override (uses setting if not provided)
   * @param {string} [options.season] - Season override (uses current if not provided)
   * @returns {Promise<object>} Generated weather
   * @example
   * await CALENDARIA.api.generateWeather();
   * await CALENDARIA.api.generateWeather({ climate: 'polar' });
   */
  async generateWeather(options = {}) {
    return WeatherManager.generateAndSetWeather(options);
  },

  /**
   * Get a weather forecast for upcoming days.
   * @param {object} [options={}] - Forecast options
   * @param {number} [options.days=7] - Number of days to forecast
   * @param {string} [options.climate] - Climate override
   * @returns {Promise<object[]>} Array of forecast entries
   * @example
   * const forecast = await CALENDARIA.api.getWeatherForecast({ days: 5 });
   * forecast.forEach(day => console.log(day.preset.label, day.temperature));
   */
  async getWeatherForecast(options = {}) {
    return WeatherManager.getForecast(options);
  },

  /**
   * Get the current climate zone.
   * @returns {Promise<string>} Climate zone ID
   * @example
   * const climate = await CALENDARIA.api.getCurrentClimate();
   * console.log(climate); // 'temperate'
   */
  async getCurrentClimate() {
    return WeatherManager.getCurrentClimate();
  },

  /**
   * Set the current climate zone.
   * @param {string} climateId - Climate zone ID ('tropical', 'subtropical', 'temperate', 'polar')
   * @returns {Promise<void>}
   * @example
   * await CALENDARIA.api.setClimate('polar');
   */
  async setClimate(climateId) {
    return WeatherManager.setClimate(climateId);
  },

  /**
   * Get all available weather presets.
   * @returns {Promise<object[]>} Array of weather presets
   * @example
   * const presets = await CALENDARIA.api.getWeatherPresets();
   * presets.forEach(p => console.log(p.id, p.label));
   */
  async getWeatherPresets() {
    return WeatherManager.getAllPresets();
  },

  /**
   * Get all available climate zones.
   * @returns {Promise<object[]>} Array of climate zones
   * @example
   * const climates = await CALENDARIA.api.getClimateZones();
   * climates.forEach(c => console.log(c.id, c.label));
   */
  async getClimateZones() {
    return WeatherManager.getClimateZones();
  },

  /**
   * Add a custom weather preset.
   * @param {object} preset - Preset definition
   * @param {string} preset.id - Unique ID
   * @param {string} preset.label - Display label
   * @param {string} [preset.icon='fa-question'] - Icon class
   * @param {string} [preset.color='#888888'] - Display color
   * @param {string} [preset.description] - Description
   * @returns {Promise<object>} The added preset
   * @example
   * await CALENDARIA.api.addWeatherPreset({
   *   id: 'acid-rain',
   *   label: 'Acid Rain',
   *   icon: 'fa-skull',
   *   color: '#00FF00',
   *   description: 'Corrosive rainfall'
   * });
   */
  async addWeatherPreset(preset) {
    return WeatherManager.addCustomPreset(preset);
  },

  /**
   * Remove a custom weather preset.
   * @param {string} presetId - Preset ID to remove
   * @returns {Promise<boolean>} True if removed
   * @example
   * await CALENDARIA.api.removeWeatherPreset('acid-rain');
   */
  async removeWeatherPreset(presetId) {
    return WeatherManager.removeCustomPreset(presetId);
  },

  /* -------------------------------------------- */
  /*  Hook Constants                              */
  /* -------------------------------------------- */

  /**
   * Get all available Calendaria hook names.
   * @returns {object} Object containing all hook name constants
   * @example
   * const hooks = CALENDARIA.api.hooks;
   * Hooks.on(hooks.DATE_TIME_CHANGE, (data) => console.log('Time changed!'));
   */
  get hooks() {
    return { ...HOOKS };
  }
};
