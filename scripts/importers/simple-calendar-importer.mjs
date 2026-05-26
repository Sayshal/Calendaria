import { CalendarManager } from '../calendar/_module.mjs';
import { ASSETS } from '../constants.mjs';
import { FestivalManager } from '../festivals/_module.mjs';
import { NoteManager, addCustomPreset, getAllPresets } from '../notes/_module.mjs';
import { localize, log } from '../utils/_module.mjs';
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
      } catch {}
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
   * @param {object} data - Raw SC export data
   * @returns {object[]|null} Array of calendar choices or null if single calendar
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
    const calendars = data.calendars || data;
    const calendar = Array.isArray(calendars) ? calendars[calendarIndex] : calendars;
    const sourceCd = data.currentDate || calendar?.currentDate;
    if (!sourceCd) return null;
    const monthMap = this.#buildMonthMap(calendar?.months);
    const remapped = this.#remapMonthDay(sourceCd.month ?? 0, sourceCd.day ?? 0, monthMap);
    if (data.currentDate && !calendar?.time) return { year: sourceCd.year, month: remapped.month, dayOfMonth: remapped.dayOfMonth, hour: sourceCd.hour ?? 0, minute: sourceCd.minute ?? 0 };
    const secondsPerHour = (calendar?.time?.minutesInHour ?? 60) * (calendar?.time?.secondsInMinute ?? 60);
    const hour = Math.floor((sourceCd.seconds ?? 0) / secondsPerHour);
    const minute = Math.floor(((sourceCd.seconds ?? 0) % secondsPerHour) / (calendar?.time?.secondsInMinute ?? 60));
    return { year: sourceCd.year, month: remapped.month, dayOfMonth: remapped.dayOfMonth, hour, minute };
  }

  /**
   * Build a remap from SC month index (incl. intercalaries) to Calendaria month index (regular only).
   * @param {object[]} scMonths - Source SC months array
   * @returns {{regularIndex: Map<number, number>, lastRegularBefore: Map<number, number>, lastRegularDays: Map<number, number>, intercalary: Set<number>, regularCount: number}} Index maps and intercalary set
   * @private
   */
  #buildMonthMap(scMonths = []) {
    const regularIndex = new Map();
    const lastRegularBefore = new Map();
    const lastRegularDays = new Map();
    const intercalary = new Set();
    let regIdx = 0;
    let lastReg = 0;
    let lastRegDays = 0;
    let hasSeenRegular = false;
    for (let i = 0; i < scMonths.length; i++) {
      if (scMonths[i]?.intercalary) {
        intercalary.add(i);
        lastRegularBefore.set(i, hasSeenRegular ? lastReg : 0);
        lastRegularDays.set(i, lastRegDays);
      } else {
        regularIndex.set(i, regIdx);
        lastReg = regIdx;
        lastRegDays = scMonths[i]?.numberOfDays || 0;
        hasSeenRegular = true;
        regIdx++;
      }
    }
    return { regularIndex, lastRegularBefore, lastRegularDays, intercalary, regularCount: regIdx };
  }

  /**
   * Remap an SC (month, day) pair to a Calendaria (month, dayOfMonth) pair.
   * @param {number} scMonth - Source month index
   * @param {number} scDay - Source day index (0-based)
   * @param {object} monthMap - From {@link #buildMonthMap}
   * @returns {{month: number, dayOfMonth: number, wasIntercalary: boolean}} Remapped position and origin flag
   * @private
   */
  #remapMonthDay(scMonth, scDay, monthMap) {
    if (monthMap.intercalary.has(scMonth)) {
      const month = monthMap.lastRegularBefore.get(scMonth) ?? 0;
      const lastDays = monthMap.lastRegularDays.get(scMonth) ?? 0;
      const dayOfMonth = lastDays > 0 ? lastDays - 1 : 0;
      return { month, dayOfMonth, wasIntercalary: true };
    }
    if (monthMap.regularIndex.has(scMonth)) return { month: monthMap.regularIndex.get(scMonth), dayOfMonth: scDay, wasIntercalary: false };
    const fallback = monthMap.regularCount > 0 ? monthMap.regularCount - 1 : 0;
    log(2, `Simple Calendar import: SC month ${scMonth} out of bounds (regularCount=${monthMap.regularCount}); clamped to ${fallback}`);
    return { month: fallback, dayOfMonth: scDay, wasIntercalary: false };
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
    const festivals = this.#extractFestivals(calendar.months);
    const toKeyedObject = (arr) => {
      const out = {};
      for (const item of arr) out[foundry.utils.randomID()] = item;
      return out;
    };
    return {
      name: calendar.name || 'Imported Calendar',
      days: { values: toKeyedObject(weekdays), ...this.#transformTime(calendar.time), daysPerYear },
      months: { values: toKeyedObject(months) },
      years: this.#transformYears(calendar.year, calendar.leapYear),
      leapYearConfig: this.#transformLeapYearConfig(calendar.leapYear),
      seasons: { values: toKeyedObject(this.#transformSeasons(calendar.seasons, calendar.months)) },
      moons: this.#transformMoons(calendar.moons),
      festivals,
      eras: this.#transformEras(calendar.year),
      daylight: this.#transformDaylight(calendar.seasons),
      metadata: {
        description: localize('CALENDARIA.Importer.ImportedFrom.SimpleCalendar'),
        system: calendar.name || localize('CALENDARIA.Common.Unknown'),
        importedFrom: 'simple-calendar',
        originalId: calendar.id
      }
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
      return { name: season.name, dayStart, dayEnd: dayEnd >= totalDays ? dayEnd - totalDays : dayEnd, color: season.color || '', icon: SEASON_ICON_MAP[season.icon] || '' };
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
    const calendars = data.calendars || (data.months ? [data] : []);
    const monthMaps = new Map();
    for (const cal of calendars) monthMaps.set(cal.id || 'default', this.#buildMonthMap(cal.months));
    const fallbackMap = monthMaps.values().next().value || this.#buildMonthMap([]);
    const allNotes = [];
    for (const [calId, calendarNotes] of Object.entries(notes)) {
      const monthMap = monthMaps.get(calId) || fallbackMap;
      for (const note of calendarNotes) {
        const noteData = SimpleCalendarImporter.#getFlag(note, 'noteData');
        if (!noteData) continue;
        const content = note.pages?.[0]?.text?.content || '';
        const startTransformed = this.#transformNoteDate(noteData.startDate, monthMap);
        const endTransformed = this.#transformNoteDate(noteData.endDate, monthMap);
        const suggestedType = SimpleCalendarImporter.#classifyNote({ repeats: noteData.repeats, wasIntercalary: startTransformed.wasIntercalary });
        allNotes.push({
          name: note.name,
          content,
          startDate: startTransformed.date,
          endDate: endTransformed.date,
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
   * Choose `note` vs `festival` for an SC entry.
   * @param {{repeats: number, wasIntercalary: boolean}} info - SC repeat code and intercalary-anchor flag
   * @returns {'note'|'festival'} Suggested type
   * @private
   */
  static #classifyNote({ wasIntercalary, repeats }) {
    if (wasIntercalary) return 'festival';
    if (repeats === 3) return 'festival';
    return 'note';
  }

  /**
   * Import SC notes with category and visibility support.
   * @param {object[]} notes - Array of note objects to import
   * @param {object} options - Import options including calendarId
   * @returns {Promise<object>} Result with success, count, and errors
   */
  async importNotes(notes, options = {}) {
    const { calendarId } = options;
    const errors = [];
    let count = 0;
    log(3, `Starting note import: ${notes.length} notes to calendar ${calendarId}`);
    const categoryMap = this.#scNoteCategories.length ? await this.#importNoteCategories(this.#scNoteCategories) : new Map();
    const calendar = CalendarManager.getCalendar(calendarId);
    const yearZero = calendar?.years?.yearZero ?? 0;
    for (const note of notes) {
      try {
        const startDate = { ...note.startDate, year: note.startDate.year + yearZero };
        const endDate = note.endDate ? { ...note.endDate, year: note.endDate.year + yearZero } : null;
        const mappedCategories = (note.categories || []).map((id) => categoryMap.get(id) ?? id);
        const noteData = { startDate, endDate, allDay: note.allDay, repeat: note.repeat, categories: mappedCategories };
        const page = await NoteManager.createNote({ name: note.name, content: note.content || '', noteData, calendarId, openSheet: false });
        if (page) count++;
        else errors.push(`Failed to create note: ${note.name}`);
      } catch (error) {
        errors.push(`Error creating note "${note.name}": ${error.message}`);
      }
    }
    log(3, `Note import complete: ${count}/${notes.length} imported, ${errors.length} errors`);
    return { success: errors.length === 0, count, errors };
  }

  /**
   * Import SC note categories as Calendaria custom presets.
   * @param {object[]} scCategories - SC note category definitions
   * @returns {Promise<Map<string, string>>} Map of SC category ID to Calendaria preset ID
   */
  async #importNoteCategories(scCategories) {
    const existing = getAllPresets();
    const existingIds = new Set(existing.map((c) => c.id));
    const categoryMap = new Map();
    for (const cat of scCategories) {
      const id =
        cat.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\da-z-]/g, '') || foundry.utils.randomID();
      categoryMap.set(cat.id ?? cat.name, id);
      if (!existingIds.has(id)) {
        await addCustomPreset(cat.name, cat.color, 'fa-tag');
        log(3, `Imported SC note category: ${cat.name} (${cat.id} -> ${id})`);
      }
    }
    return categoryMap;
  }

  /** @override */
  async importFestivals(festivals, options = {}) {
    const { calendarId } = options;
    const errors = [];
    log(3, `Starting festival import: ${festivals.length} festivals to calendar ${calendarId}`);
    const calendar = CalendarManager.getCalendar(calendarId);
    if (!calendar) return { success: false, count: 0, errors: [`Calendar ${calendarId} not found`] };
    let created = 0;
    for (const festival of festivals) {
      try {
        const festivalDef = { name: festival.name, month: festival.startDate.month ?? 0, dayOfMonth: festival.startDate.day ?? 0 };
        await FestivalManager.createFestivalNote(calendarId, foundry.utils.randomID(), festivalDef, calendar);
        created++;
      } catch (error) {
        errors.push(`Error processing festival "${festival.name}": ${error.message}`);
      }
    }
    log(3, `Festival import complete: ${created} festival notes created`);
    return { success: errors.length === 0, count: created, errors };
  }

  /**
   * Transform SC note date to Calendaria format with month-index remap.
   * @param {object} date - SC date object
   * @param {object} monthMap - From {@link #buildMonthMap}
   * @returns {{date: {year:number, month:number, dayOfMonth:number, hour:number, minute:number, second:number}, wasIntercalary: boolean}} Calendaria-format date plus intercalary-origin flag
   */
  #transformNoteDate(date = {}, monthMap = null) {
    const safeMap = monthMap || this.#buildMonthMap([]);
    const remapped = this.#remapMonthDay(date.month ?? 0, date.day ?? 0, safeMap);
    return {
      date: { year: date.year ?? 0, month: remapped.month, dayOfMonth: remapped.dayOfMonth, hour: date.hour ?? 0, minute: date.minute ?? 0, second: date.seconds ?? 0 },
      wasIntercalary: remapped.wasIntercalary
    };
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
   * @param {object} rawData - Raw SC export data
   * @param {object} transformedData - Transformed calendar data
   * @returns {object} Preview data with additional SC-specific fields
   */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    preview.noteCount = this.#countNotes(rawData);
    return preview;
  }
}
