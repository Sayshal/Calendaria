/**
 * Simple Calendar Importer
 * @module Importers/SimpleCalendarImporter
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { ASSETS } from '../constants.mjs';
import { addCustomCategory, getAllCategories } from '../notes/note-data.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import BaseImporter from './base-importer.mjs';

/** Both module IDs to support original SC and SC Reborn. */
const SC_MODULE_IDS = ['foundryvtt-simple-calendar', 'foundryvtt-simple-calendar-reborn'];

/** Map SC season icon strings to FontAwesome classes. */
const SEASON_ICON_MAP = {
  spring: 'fa-seedling',
  summer: 'fa-sun',
  fall: 'fa-leaf',
  winter: 'fa-snowflake'
};

/**
 * Importer for Simple Calendar module data.
 * @extends BaseImporter
 */
export default class SimpleCalendarImporter extends BaseImporter {
  static id = 'simple-calendar';
  static label = 'CALENDARIA.Importer.SimpleCalendar.Name';
  static icon = 'fa-calendar-alt';
  static description = 'CALENDARIA.Importer.SimpleCalendar.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = true;
  static moduleId = 'foundryvtt-simple-calendar';
  static fileExtensions = ['.json'];

  /** @type {object[]} SC note categories extracted during load/transform. */
  #scNoteCategories = [];

  /**
   * Detect either SC or SC Reborn.
   * @returns {boolean} True if either module is active
   */
  static detect() {
    return SC_MODULE_IDS.some((id) => game.modules.get(id)?.active);
  }

  /**
   * Read a setting from whichever SC module is active.
   * @param {string} key - Setting key
   * @returns {*} Setting value
   */
  static #getSetting(key) {
    for (const id of SC_MODULE_IDS) {
      try {
        return game.settings.get(id, key);
      } catch {
        // Module not registered, try next
      }
    }
    return null;
  }

  /**
   * Get a flag value from a document, checking both SC module IDs.
   * @param {object} doc - Foundry document
   * @param {string} flagKey - Flag key
   * @returns {*} Flag value or undefined
   */
  static #getFlag(doc, flagKey) {
    for (const id of SC_MODULE_IDS) {
      const value = doc.getFlag?.(id, flagKey) ?? doc.flags?.[id]?.[flagKey];
      if (value !== undefined) return value;
    }
    return undefined;
  }

  /**
   * Load calendar data from installed Simple Calendar module.
   * @returns {Promise<object>} Raw SC calendar data
   */
  async loadFromModule() {
    if (!this.constructor.detect()) throw new Error(localize('CALENDARIA.Importer.SimpleCalendar.NotInstalled'));
    const calendars = SimpleCalendarImporter.#getSetting('calendar-configuration') || [];
    if (!calendars.length) throw new Error(localize('CALENDARIA.Importer.SimpleCalendar.NoCalendars'));
    const notesFolder = game.folders.find((f) => {
      for (const id of SC_MODULE_IDS) {
        if (f.getFlag(id, 'root') === true) return true;
      }
      return false;
    });
    const notes = {};
    if (notesFolder) {
      for (const entry of notesFolder.contents) {
        const noteData = SimpleCalendarImporter.#getFlag(entry, 'noteData');
        if (noteData) {
          const calId = noteData.calendarId || 'default';
          if (!notes[calId]) notes[calId] = [];
          notes[calId].push({ ...entry.toObject(), flags: entry.flags });
        }
      }
    }
    this.#scNoteCategories = this.#extractNoteCategories(calendars);
    const worldTime = game.time.worldTime;
    const currentDate = this.#worldTimeToDate(worldTime, calendars[0]);
    return { calendars, notes, currentDate, exportVersion: 2 };
  }

  /**
   * Get available calendar choices from multi-calendar SC data.
   * @param data
   */
  getCalendarChoices(data) {
    const calendars = data.calendars || data;
    if (!Array.isArray(calendars) || calendars.length <= 1) return null;
    return calendars.map((cal, index) => ({ name: cal.name || cal.id || `Calendar ${index + 1}`, index }));
  }

  /**
   * Extract current date from SC data for preservation after import.
   * @param {object} data - Raw SC data
   * @param {number} [calendarIndex] - Index of calendar to extract date from
   * @returns {{year: number, month: number, dayOfMonth: number}|null} Current date
   */
  extractCurrentDate(data, calendarIndex = 0) {
    if (data.currentDate) return data.currentDate;
    const calendars = data.calendars || data;
    const calendar = Array.isArray(calendars) ? calendars[calendarIndex] : calendars;
    if (calendar?.currentDate) {
      const cd = calendar.currentDate;
      const secondsPerHour = (calendar.time?.minutesInHour ?? 60) * (calendar.time?.secondsInMinute ?? 60);
      const hour = Math.floor((cd.seconds ?? 0) / secondsPerHour);
      const minute = Math.floor(((cd.seconds ?? 0) % secondsPerHour) / (calendar.time?.secondsInMinute ?? 60));
      return { year: cd.year, month: cd.month, dayOfMonth: cd.day ?? 0, hour, minute };
    }
    return null;
  }

  /**
   * Convert worldTime to date components using SC calendar data.
   * @param {number} worldTime - Raw world time in seconds
   * @param {object} calendar - SC calendar data
   * @returns {{year: number, month: number, dayOfMonth: number, hour: number, minute: number}} Date components
   */
  #worldTimeToDate(worldTime, calendar) {
    const hoursPerDay = calendar.time?.hoursInDay ?? 24;
    const minutesPerHour = calendar.time?.minutesInHour ?? 60;
    const secondsPerMinute = calendar.time?.secondsInMinute ?? 60;
    const secondsPerDay = hoursPerDay * minutesPerHour * secondsPerMinute;
    const months = calendar.months || [];
    const regularMonths = months.filter((m) => !m.intercalary);
    const daysPerYear = regularMonths.reduce((sum, m) => sum + (m.numberOfDays || 0), 0);
    const totalDays = Math.floor(worldTime / secondsPerDay);
    let year = Math.floor(totalDays / daysPerYear);
    let dayOfYear = totalDays % daysPerYear;
    if (totalDays < 0) {
      year = Math.floor(totalDays / daysPerYear);
      dayOfYear = ((totalDays % daysPerYear) + daysPerYear) % daysPerYear;
    }
    let month = 0;
    let remainingDays = dayOfYear;
    for (let i = 0; i < regularMonths.length; i++) {
      const monthDays = regularMonths[i].numberOfDays || 30;
      if (remainingDays < monthDays) {
        month = i;
        break;
      }
      remainingDays -= monthDays;
      month = i + 1;
    }
    const timeOfDay = ((worldTime % secondsPerDay) + secondsPerDay) % secondsPerDay;
    const secondsPerHour = minutesPerHour * secondsPerMinute;
    const hour = Math.floor(timeOfDay / secondsPerHour);
    const minute = Math.floor((timeOfDay % secondsPerHour) / secondsPerMinute);
    return { year, month, dayOfMonth: remainingDays, hour, minute };
  }

  /**
   * Transform Simple Calendar data into CalendariaCalendar format.
   * @param {object} data - Raw SC export data
   * @param {number} [calendarIndex] - Index of calendar to import (if multiple)
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data, calendarIndex = 0) {
    const calendars = data.calendars || data;
    const calendar = Array.isArray(calendars) ? calendars[calendarIndex] : calendars;
    if (!calendar) throw new Error('No calendar found in import data');
    log(3, 'Transforming Simple Calendar data:', calendar.name || calendar.id);
    this.#scNoteCategories = this.#extractNoteCategories(Array.isArray(calendars) ? calendars : [calendars]);
    const weekdays = this.#transformWeekdays(calendar.weekdays);
    const weekdayNumericToIndex = new Map();
    (calendar.weekdays || []).forEach((wd, idx) => {
      weekdayNumericToIndex.set(wd.numericRepresentation, idx);
    });
    const months = this.#transformMonths(calendar.months, weekdayNumericToIndex);
    const daysPerYear = months.reduce((sum, m) => sum + (m.days || 0), 0);
    return {
      name: calendar.name || 'Imported Calendar',
      days: { values: weekdays, ...this.#transformTime(calendar.time), daysPerYear },
      months: { values: months },
      years: this.#transformYears(calendar.year, calendar.leapYear),
      leapYearConfig: this.#transformLeapYearConfig(calendar.leapYear),
      seasons: { values: this.#transformSeasons(calendar.seasons, calendar.months) },
      moons: this.#transformMoons(calendar.moons),
      festivals: this.#extractFestivals(calendar.months),
      eras: this.#transformEras(calendar.year),
      daylight: this.#transformDaylight(calendar.seasons),
      metadata: { description: `Imported from Simple Calendar`, system: calendar.name || 'Unknown', importedFrom: 'simple-calendar', originalId: calendar.id }
    };
  }

  /**
   * Transform SC time configuration.
   * @param {object} time - SC time config
   * @returns {object} Calendaria days config
   */
  #transformTime(time = {}) {
    return { hoursPerDay: time.hoursInDay ?? 24, minutesPerHour: time.minutesInHour ?? 60, secondsPerMinute: time.secondsInMinute ?? 60 };
  }

  /**
   * Transform SC months to Calendaria format.
   * @param {object[]} months - SC months array
   * @param {Map<number,number>} weekdayNumericToIndex - Map from SC numericRepresentation to array index
   * @returns {object[]} Calendaria months array
   */
  #transformMonths(months = [], weekdayNumericToIndex = new Map()) {
    return months
      .filter((m) => !m.intercalary)
      .map((month, index) => ({
        name: month.name,
        abbreviation: month.abbreviation || month.name.substring(0, 3),
        days: month.numberOfDays,
        leapDays: month.numberOfLeapYearDays !== month.numberOfDays ? month.numberOfLeapYearDays : undefined,
        ordinal: month.numericRepresentation || index + 1,
        startingWeekday: month.startingWeekday != null ? (weekdayNumericToIndex.get(month.startingWeekday) ?? null) : null
      }));
  }

  /**
   * Transform SC weekdays to Calendaria format.
   * @param {object[]} weekdays - SC weekdays array
   * @returns {object[]} Calendaria weekdays array
   */
  #transformWeekdays(weekdays = []) {
    if (!weekdays?.length) {
      return [
        { name: 'CALENDARIA.Weekday.Sunday', abbreviation: 'CALENDARIA.Weekday.SundayShort', ordinal: 1 },
        { name: 'CALENDARIA.Weekday.Monday', abbreviation: 'CALENDARIA.Weekday.MondayShort', ordinal: 2 },
        { name: 'CALENDARIA.Weekday.Tuesday', abbreviation: 'CALENDARIA.Weekday.TuesdayShort', ordinal: 3 },
        { name: 'CALENDARIA.Weekday.Wednesday', abbreviation: 'CALENDARIA.Weekday.WednesdayShort', ordinal: 4 },
        { name: 'CALENDARIA.Weekday.Thursday', abbreviation: 'CALENDARIA.Weekday.ThursdayShort', ordinal: 5 },
        { name: 'CALENDARIA.Weekday.Friday', abbreviation: 'CALENDARIA.Weekday.FridayShort', ordinal: 6 },
        { name: 'CALENDARIA.Weekday.Saturday', abbreviation: 'CALENDARIA.Weekday.SaturdayShort', ordinal: 7 }
      ];
    }
    return weekdays.map((day, index) => ({
      name: day.name,
      abbreviation: day.abbreviation || day.name.substring(0, 2),
      ordinal: day.numericRepresentation || index + 1,
      isRestDay: day.restday === true
    }));
  }

  /**
   * Transform SC year and leap year config to Calendaria format.
   * @param {object} year - SC year config
   * @param {object} leapYear - SC leap year config
   * @returns {object} Calendaria years config
   */
  #transformYears(year = {}, leapYear = {}) {
    const result = { yearZero: year.yearZero ?? 0, firstWeekday: year.firstWeekday ?? 0, leapYear: null, names: [] };
    if (leapYear.rule === 'gregorian') result.leapYear = { leapStart: 0, leapInterval: 4 };
    else if (leapYear.rule === 'custom' && leapYear.customMod > 0) result.leapYear = { leapStart: 0, leapInterval: leapYear.customMod };
    if (year.yearNames?.length) {
      const start = year.yearNamesStart ?? 0;
      result.names = year.yearNames.map((name, i) => ({ year: start + i, name }));
    }
    return result;
  }

  /**
   * Transform SC leap year config to Calendaria advanced format.
   * @param {object} leapYear - SC leap year config
   * @returns {object|null} Calendaria leapYearConfig
   */
  #transformLeapYearConfig(leapYear = {}) {
    if (leapYear.rule === 'gregorian') return { rule: 'gregorian', start: 0 };
    else if (leapYear.rule === 'custom' && leapYear.customMod > 0) return { rule: 'simple', interval: leapYear.customMod, start: 0 };
    return null;
  }

  /**
   * Transform SC seasons to Calendaria format.
   * @param {object[]} seasons - SC seasons array
   * @param {object[]} scMonths - Original SC months array (for day calculations)
   * @returns {object[]} Calendaria seasons array
   */
  #transformSeasons(seasons = [], scMonths = []) {
    if (!seasons.length) return [];
    const regularMonths = scMonths.filter((m) => !m.intercalary);
    const monthDayStarts = [];
    let dayCount = 0;
    for (const month of regularMonths) {
      monthDayStarts.push(dayCount);
      dayCount += month.numberOfDays || 0;
    }
    const totalDays = dayCount;
    // Map SC month indices (which include intercalary) to regular-month-only indices
    const scToRegularIndex = new Map();
    let regularIdx = 0;
    for (let i = 0; i < scMonths.length; i++) {
      if (!scMonths[i].intercalary) {
        scToRegularIndex.set(i, regularIdx);
        regularIdx++;
      }
    }
    const sortedSeasons = [...seasons].sort((a, b) => {
      const aRegIdx = scToRegularIndex.get(a.startingMonth) ?? 0;
      const bRegIdx = scToRegularIndex.get(b.startingMonth) ?? 0;
      const aDay = (monthDayStarts[aRegIdx] ?? 0) + (a.startingDay ?? 0);
      const bDay = (monthDayStarts[bRegIdx] ?? 0) + (b.startingDay ?? 0);
      return aDay - bDay;
    });
    return sortedSeasons.map((season, index) => {
      const regIdx = scToRegularIndex.get(season.startingMonth) ?? 0;
      const dayStart = (monthDayStarts[regIdx] ?? 0) + (season.startingDay ?? 0);
      const nextSeason = sortedSeasons[(index + 1) % sortedSeasons.length];
      const nextRegIdx = scToRegularIndex.get(nextSeason.startingMonth) ?? 0;
      let dayEnd = (monthDayStarts[nextRegIdx] ?? 0) + (nextSeason.startingDay ?? 0) - 1;
      if (dayEnd < dayStart) dayEnd += totalDays;
      if (dayEnd < 0) dayEnd = totalDays - 1;
      return {
        name: season.name,
        dayStart,
        dayEnd: dayEnd >= totalDays ? dayEnd - totalDays : dayEnd,
        color: season.color || '',
        icon: SEASON_ICON_MAP[season.icon] || ''
      };
    });
  }

  /**
   * Transform SC moons to Calendaria format.
   * @param {object[]} moons - SC moons array
   * @returns {object[]} Calendaria moons array
   */
  #transformMoons(moons = []) {
    return moons.map((moon) => ({
      name: moon.name,
      cycleLength: moon.cycleLength,
      cycleDayAdjust: moon.cycleDayAdjust ?? 0,
      color: moon.color || '',
      phases: this.#transformMoonPhases(moon.phases, moon.cycleLength),
      referenceDate: this.#transformMoonReference(moon.firstNewMoon)
    }));
  }

  /**
   * Transform SC moon phases to Calendaria format.
   * @param {object[]} phases - SC phases array
   * @param {number} cycleLength - Total cycle length
   * @returns {object[]} Calendaria phases array
   */
  #transformMoonPhases(phases = [], cycleLength = 29.5) {
    const result = [];
    let currentPosition = 0;
    for (const phase of phases) {
      const length = phase.length || 1;
      const start = currentPosition / cycleLength;
      const end = (currentPosition + length) / cycleLength;
      result.push({ name: phase.name, icon: this.#mapMoonPhaseIcon(phase.icon), start: Math.min(start, 0.999), end: Math.min(end, 1) });
      currentPosition += length;
    }
    return result;
  }

  /**
   * Map SC moon phase icon to Calendaria SVG icon path.
   * @param {string} icon - SC icon name
   * @returns {string} Calendaria SVG path
   */
  #mapMoonPhaseIcon(icon) {
    const iconMap = {
      new: `${ASSETS.MOON_ICONS}/01_newmoon.svg`,
      'waxing-crescent': `${ASSETS.MOON_ICONS}/02_waxingcrescent.svg`,
      'first-quarter': `${ASSETS.MOON_ICONS}/03_firstquarter.svg`,
      'waxing-gibbous': `${ASSETS.MOON_ICONS}/04_waxinggibbous.svg`,
      full: `${ASSETS.MOON_ICONS}/05_fullmoon.svg`,
      'waning-gibbous': `${ASSETS.MOON_ICONS}/06_waninggibbous.svg`,
      'last-quarter': `${ASSETS.MOON_ICONS}/07_lastquarter.svg`,
      'waning-crescent': `${ASSETS.MOON_ICONS}/08_waningcrescent.svg`
    };
    return iconMap[icon] || `${ASSETS.MOON_ICONS}/01_newmoon.svg`;
  }

  /**
   * Transform SC moon reference date.
   * @param {object} firstNewMoon - SC first new moon config
   * @returns {object} Calendaria reference date
   */
  #transformMoonReference(firstNewMoon = {}) {
    return { year: firstNewMoon.year ?? 0, month: firstNewMoon.month ?? 0, dayOfMonth: firstNewMoon.day ?? 0 };
  }

  /**
   * Extract festivals from SC intercalary months.
   * Intercalary months are placed relative to the preceding regular month.
   * @param {object[]} months - SC months array
   * @returns {object[]} Calendaria festivals array
   */
  #extractFestivals(months = []) {
    const festivals = [];
    let lastRegularMonthIndex = 0;
    let lastRegularMonthDays = 0;
    let regularCount = 0;
    for (const month of months) {
      if (month.intercalary) {
        // Place festival at end of the last regular month seen (or month 0 day 0 if none yet)
        const targetMonth = regularCount > 0 ? lastRegularMonthIndex : 0;
        const countsForWeekday = month.intercalaryInclude === true;
        for (let day = 0; day < month.numberOfDays; day++) {
          festivals.push({
            name: month.numberOfDays === 1 ? month.name : `${month.name} (Day ${day + 1})`,
            month: targetMonth,
            dayOfMonth: regularCount > 0 ? lastRegularMonthDays - 1 : 0,
            countsForWeekday
          });
        }
      } else {
        lastRegularMonthIndex = regularCount;
        lastRegularMonthDays = month.numberOfDays || 30;
        regularCount++;
      }
    }
    return festivals;
  }

  /**
   * Transform SC year prefix/postfix into era.
   * @param {object} year - SC year config
   * @returns {object[]} Calendaria eras array
   */
  #transformEras(year = {}) {
    const prefix = year.prefix?.trim();
    const postfix = year.postfix?.trim();
    if (!prefix && !postfix) return [];
    return [{ name: postfix || prefix || 'Era', abbreviation: postfix || prefix || '', startYear: -999999, endYear: null, format: prefix ? 'prefix' : 'suffix' }];
  }

  /**
   * Transform season sunrise/sunset into daylight configuration.
   * @param {object[]} seasons - SC seasons array
   * @returns {object} Calendaria daylight config
   */
  #transformDaylight(seasons = []) {
    if (!seasons.length) return { enabled: false };
    let shortestDaylight = Infinity;
    let longestDaylight = 0;
    for (const season of seasons) {
      if (season.sunriseTime != null && season.sunsetTime != null) {
        const daylight = (season.sunsetTime - season.sunriseTime) / 3600;
        if (daylight < shortestDaylight) shortestDaylight = daylight;
        if (daylight > longestDaylight) longestDaylight = daylight;
      }
    }
    if (shortestDaylight === Infinity || longestDaylight === 0) return { enabled: false };
    return { enabled: true, shortestDay: Math.round(shortestDaylight), longestDay: Math.round(longestDaylight) };
  }

  /**
   * Extract note category definitions from SC calendar data.
   * @param {object[]} calendars - SC calendars array
   * @returns {object[]} Array of {id, name, color, textColor}
   */
  #extractNoteCategories(calendars) {
    const categories = [];
    const seen = new Set();
    for (const cal of calendars) {
      for (const cat of cal.noteCategories || []) {
        if (!seen.has(cat.id ?? cat.name)) {
          seen.add(cat.id ?? cat.name);
          categories.push({ id: cat.id ?? cat.name, name: cat.name, color: cat.color || '#868e96', textColor: cat.textColor || '#FFFFFF' });
        }
      }
    }
    return categories;
  }

  /**
   * Extract notes from SC export data.
   * @param {object} data - Raw SC export data
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    const notes = data.notes || {};
    log(3, `extractNotes - Available note calendars in data:`, Object.keys(notes));
    const allNotes = [];
    for (const [calId, calendarNotes] of Object.entries(notes)) {
      log(3, `Processing notes from SC calendar: ${calId} (${calendarNotes?.length || 0} notes)`);
      for (const note of calendarNotes) {
        const noteData = SimpleCalendarImporter.#getFlag(note, 'noteData');
        if (!noteData) {
          log(3, `Skipping note without noteData flag: ${note.name}`);
          continue;
        }
        const content = note.pages?.[0]?.text?.content || '';
        const hasContent = content && content.trim().length > 0;
        const suggestedType = hasContent ? 'note' : 'festival';
        allNotes.push({
          name: note.name,
          content,
          startDate: this.#transformNoteDate(noteData.startDate),
          endDate: this.#transformNoteDate(noteData.endDate),
          allDay: noteData.allDay ?? true,
          repeat: this.#transformRepeatRule(noteData.repeats),
          categories: noteData.categories || [],
          originalId: note._id,
          suggestedType
        });
      }
    }
    log(3, `Extracted ${allNotes.length} notes from Simple Calendar data`);
    return allNotes;
  }

  /**
   * Import SC notes with category and gmOnly support.
   * @param notes
   * @param options
   */
  async importNotes(notes, options = {}) {
    const { calendarId } = options;
    const errors = [];
    let count = 0;
    log(3, `Starting note import: ${notes.length} notes to calendar ${calendarId}`);
    // Import SC note categories as custom categories
    if (this.#scNoteCategories.length) await this.#importNoteCategories(this.#scNoteCategories);
    const calendar = CalendarManager.getCalendar(calendarId);
    const yearZero = calendar?.years?.yearZero ?? 0;
    log(3, `Calendar yearZero: ${yearZero}`);
    for (const note of notes) {
      try {
        const startDate = { ...note.startDate, year: note.startDate.year + yearZero };
        const endDate = note.endDate ? { ...note.endDate, year: note.endDate.year + yearZero } : null;
        const noteData = { startDate, endDate, allDay: note.allDay, repeat: note.repeat, categories: note.categories };
        const page = await NoteManager.createNote({ name: note.name, content: note.content || '', noteData, calendarId });
        if (page) {
          count++;
        } else {
          errors.push(`Failed to create note: ${note.name}`);
          log(1, `Failed to create note: ${note.name}`);
        }
      } catch (error) {
        errors.push(`Error creating note "${note.name}": ${error.message}`);
        log(1, `Error importing note "${note.name}":`, error);
      }
    }
    log(3, `Note import complete: ${count}/${notes.length} imported, ${errors.length} errors`);
    return { success: errors.length === 0, count, errors };
  }

  /**
   * Import SC note categories as Calendaria custom categories.
   * @param {object[]} scCategories - SC note category definitions
   */
  async #importNoteCategories(scCategories) {
    const existing = getAllCategories();
    const existingIds = new Set(existing.map((c) => c.id));
    for (const cat of scCategories) {
      const id = cat.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\da-z-]/g, '');
      if (!existingIds.has(id)) {
        await addCustomCategory(cat.name, cat.color, 'fa-tag');
        log(3, `Imported SC note category: ${cat.name}`);
      }
    }
  }

  /** @override */
  async importFestivals(festivals, options = {}) {
    const { calendarId } = options;
    const errors = [];
    log(3, `Starting festival import: ${festivals.length} festivals to calendar ${calendarId}`);
    const calendar = CalendarManager.getCalendar(calendarId);
    if (!calendar) return { success: false, count: 0, errors: [`Calendar ${calendarId} not found`] };
    const existingFestivals = calendar.festivals ? { ...calendar.festivals } : {};
    const newFestivals = [];
    for (const festival of festivals) {
      try {
        const festivalData = { name: festival.name, month: festival.startDate.month ?? 0, dayOfMonth: festival.startDate.day ?? 0 };
        log(3, `Adding festival: ${festivalData.name} on ${festivalData.month}/${festivalData.dayOfMonth}`);
        newFestivals.push(festivalData);
      } catch (error) {
        errors.push(`Error processing festival "${festival.name}": ${error.message}`);
        log(1, `Error processing festival "${festival.name}":`, error);
      }
    }
    if (newFestivals.length > 0) {
      try {
        for (const festival of newFestivals) existingFestivals[foundry.utils.randomID()] = festival;
        await CalendarManager.updateCustomCalendar(calendarId, { festivals: existingFestivals });
        log(3, `Festival import complete: ${newFestivals.length} festivals added`);
      } catch (error) {
        errors.push(`Error saving festivals: ${error.message}`);
        log(1, 'Error saving festivals:', error);
      }
    }
    return { success: errors.length === 0, count: newFestivals.length, errors };
  }

  /**
   * Transform SC note date to Calendaria format.
   * @param {object} date - SC date object
   * @returns {object} Calendaria date object
   */
  #transformNoteDate(date = {}) {
    return { year: date.year ?? 0, month: date.month ?? 0, dayOfMonth: date.day ?? 0, hour: date.hour ?? 0, minute: date.minute ?? 0, second: date.seconds ?? 0 };
  }

  /**
   * Transform SC repeat rule to Calendaria format.
   * @param {number} repeats - SC repeat value
   * @returns {string} Calendaria repeat rule
   */
  #transformRepeatRule(repeats) {
    const rules = ['never', 'weekly', 'monthly', 'yearly'];
    return rules[repeats] || 'never';
  }

  /**
   * Count notes in raw SC data.
   * @param {object} data - Raw SC export data
   * @returns {number} Total note count
   */
  #countNotes(data) {
    const notes = data.notes || {};
    let count = 0;
    for (const calendarNotes of Object.values(notes)) count += calendarNotes?.length || 0;
    return count;
  }

  /**
   * Generate preview data with SC-specific note and category counts.
   * @param rawData
   * @param transformedData
   */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    preview.noteCount = this.#countNotes(rawData);
    return preview;
  }
}
