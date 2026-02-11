/**
 * Mini Calendar Importer
 * Imports calendar data from the Mini Calendar (wgtgm-mini-calendar) module.
 * @module Importers/MiniCalendarImporter
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { ASSETS } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import BaseImporter from './base-importer.mjs';

/**
 * Importer for Mini Calendar (wgtgm-mini-calendar) module data.
 * Handles both file uploads and live import from installed module.
 * @extends BaseImporter
 */
export default class MiniCalendarImporter extends BaseImporter {
  static id = 'mini-calendar';
  static label = 'CALENDARIA.Importer.MiniCalendar.Name';
  static icon = 'fa-calendar-days';
  static description = 'CALENDARIA.Importer.MiniCalendar.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = true;
  static moduleId = 'wgtgm-mini-calendar';
  static fileExtensions = ['.json'];

  /** @type {boolean} Whether to import intercalary months as intercalary (true) or festivals (false) */
  importIntercalaryAsMonths = true;

  /**
   * Load calendar data from installed Mini Calendar module.
   * @returns {Promise<object>} Raw MC calendar data
   */
  async loadFromModule() {
    if (!this.constructor.detect()) throw new Error(localize('CALENDARIA.Importer.MiniCalendar.NotInstalled'));
    const calendarConfig = game.settings.get('wgtgm-mini-calendar', 'calendarConfiguration') || {};
    const calendarSource = game.settings.get('wgtgm-mini-calendar', 'calendarSource') || 'world';
    const biome = game.settings.get('wgtgm-mini-calendar', 'biome') || 'temperate';
    const customBiomeConfig = game.settings.get('wgtgm-mini-calendar', 'customBiomeConfig') || {};
    const notes = await this.#extractJournalNotes();
    const worldTime = game.time.worldTime;
    const currentDate = this.#worldTimeToDate(worldTime, calendarConfig);
    return { calendar: calendarConfig, calendarSource, biome, customBiomeConfig, notes, currentDate, exportVersion: 1 };
  }

  /**
   * Extract current date from MC data for preservation after import.
   * @param {object} data - Raw MC data
   * @returns {{year: number, month: number, day: number}|null} Current date
   */
  extractCurrentDate(data) {
    return data.currentDate || null;
  }

  /**
   * Convert worldTime to date components using MC calendar data.
   * @param {number} worldTime - Raw world time in seconds
   * @param {object} calendar - MC calendar data
   * @returns {{year: number, month: number, day: number, hour: number, minute: number}} Date components
   */
  #worldTimeToDate(worldTime, calendar) {
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
    const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
    const secondsPerDay = hoursPerDay * minutesPerHour * secondsPerMinute;
    const months = calendar.months?.values ? Object.values(calendar.months.values) : [];
    const regularMonths = months.filter((m) => !m.intercalary);
    const daysPerYear = calendar.days?.daysPerYear ?? (regularMonths.reduce((sum, m) => sum + (m.days || 0), 0) || 365);
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
      const monthDays = regularMonths[i].days || 30;
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
    return { year, month, day: remainingDays + 1, hour, minute };
  }

  /**
   * Extract notes from Mini Calendar's journal entry.
   * @returns {Promise<object[]>} Array of note objects
   * @private
   */
  async #extractJournalNotes() {
    const journalName = 'Calendar Events - Mini Calendar';
    const journal = game.journal.getName(journalName);
    if (!journal) return [];
    const notes = [];
    for (const page of journal.pages) {
      const pageNotes = page.flags?.['wgtgm-mini-calendar']?.notes || [];
      for (const note of pageNotes) notes.push({ ...note, pageId: page.id, pageName: page.name, isJournalNote: true });
    }

    log(3, `Extracted ${notes.length} notes from Mini Calendar journal`);
    return notes;
  }

  /**
   * Transform Mini Calendar data into CalendariaCalendar format.
   * @param {object} data - Raw MC export data
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    const calendar = data.calendar || data;
    if (!calendar || Object.keys(calendar).length === 0) throw new Error('No calendar data found in import');
    log(3, 'Transforming Mini Calendar data:', calendar.name || calendar.id);
    const rawWeekdays = calendar.days?.values ? Object.values(calendar.days.values) : [];
    const rawMonths = calendar.months?.values ? Object.values(calendar.months.values) : [];
    const rawSeasons = calendar.seasons?.values ? Object.values(calendar.seasons.values) : [];
    const rawMoons = calendar.moons?.values ? Object.values(calendar.moons.values) : [];
    const rawSun = calendar.sun?.values ? Object.values(calendar.sun.values) : [];
    const rawWeather = calendar.weather?.values ? Object.values(calendar.weather.values) : [];
    const weekdays = this.#transformWeekdays(rawWeekdays);
    const months = this.#transformMonths(rawMonths);
    const daysPerYear = months.reduce((sum, m) => sum + (m.days || 0), 0);
    return {
      name: calendar.name || 'Imported Calendar',
      days: {
        values: weekdays,
        hoursPerDay: calendar.days?.hoursPerDay ?? 24,
        minutesPerHour: calendar.days?.minutesPerHour ?? 60,
        secondsPerMinute: calendar.days?.secondsPerMinute ?? 60,
        daysPerYear
      },
      months: { values: months },
      years: this.#transformYears(calendar.years),
      leapYearConfig: this.#transformLeapYearConfig(calendar.years?.leapYear),
      seasons: { values: this.#transformSeasons(rawSeasons, rawMonths) },
      moons: this.#transformMoons(rawMoons),
      festivals: this.#extractFestivals(rawMonths),
      daylight: this.#transformDaylight(rawSun, rawMonths),
      weather: this.#transformWeather(data, rawWeather),
      metadata: {
        description: calendar.description || 'Imported from Mini Calendar',
        system: calendar.name || 'Unknown',
        importedFrom: 'mini-calendar',
        originalId: calendar.id
      }
    };
  }

  /**
   * Transform MC weekdays to Calendaria format.
   * @param {object[]} weekdays - MC weekdays array
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
    return weekdays.map((day, index) => ({ name: day.name, abbreviation: day.abbreviation || day.name.substring(0, 2), ordinal: day.ordinal || index + 1, isRestDay: day.isRestDay || false }));
  }

  /**
   * Transform MC months to Calendaria format.
   * @param {object[]} months - MC months array
   * @returns {object[]} Calendaria months array
   */
  #transformMonths(months = []) {
    if (this.importIntercalaryAsMonths) {
      return months.map((month, index) => ({
        name: month.name,
        abbreviation: month.abbreviation || month.name.substring(0, 3),
        days: month.days,
        leapDays: month.leapDays !== undefined && month.leapDays !== month.days ? month.leapDays : undefined,
        ordinal: month.ordinal || index + 1,
        type: month.intercalary ? 'intercalary' : undefined,
        startingWeekday: month.startingWeekday ?? null
      }));
    }

    return months
      .filter((m) => !m.intercalary)
      .map((month, index) => ({
        name: month.name,
        abbreviation: month.abbreviation || month.name.substring(0, 3),
        days: month.days,
        leapDays: month.leapDays !== undefined && month.leapDays !== month.days ? month.leapDays : undefined,
        ordinal: month.ordinal || index + 1,
        startingWeekday: month.startingWeekday ?? null
      }));
  }

  /**
   * Transform MC year config to Calendaria format.
   * @param {object} years - MC years config
   * @returns {object} Calendaria years config
   */
  #transformYears(years = {}) {
    const result = { yearZero: years.yearZero ?? 0, firstWeekday: years.firstWeekday ?? 0, resetWeekdays: years.resetWeekdays ?? false, leapYear: null };
    const leapYear = years.leapYear;
    if (leapYear?.leapInterval > 0) result.leapYear = { leapStart: leapYear.leapStart ?? 0, leapInterval: leapYear.leapInterval };
    return result;
  }

  /**
   * Transform MC leap year config to Calendaria advanced format.
   * @param {object} leapYear - MC leap year config
   * @returns {object|null} Calendaria leapYearConfig
   */
  #transformLeapYearConfig(leapYear = {}) {
    if (!leapYear?.leapInterval || leapYear.leapInterval <= 0) return null;
    return { rule: 'simple', interval: leapYear.leapInterval, start: leapYear.leapStart ?? 0 };
  }

  /**
   * Transform MC seasons to Calendaria format.
   * @param {object[]} seasons - MC seasons array
   * @param {object[]} _months - MC months array for day calculation
   * @returns {object[]} Calendaria seasons array
   */
  #transformSeasons(seasons = [], _months = []) {
    if (!seasons?.length) return [];
    return seasons.map((season) => ({ name: season.name, monthStart: season.monthStart, monthEnd: season.monthEnd }));
  }

  /**
   * Transform MC moons to Calendaria format.
   * @param {object[]} moons - MC moons array
   * @returns {object[]} Calendaria moons array
   */
  #transformMoons(moons = []) {
    if (!moons?.length) return [];
    return moons.map((moon) => ({
      name: moon.name,
      cycleLength: moon.cycleLength,
      cycleDayAdjust: moon.offset ?? 0,
      color: moon.color || '',
      phases: this.#transformMoonPhases(moon.phases, moon.cycleLength),
      referenceDate: this.#transformMoonReference(moon.firstNewMoon)
    }));
  }

  /**
   * Transform MC moon phases to Calendaria format.
   * @param {object[]} phases - MC phases array
   * @param {number} cycleLength - Total cycle length
   * @returns {object[]} Calendaria phases array
   */
  #transformMoonPhases(phases = [], cycleLength = 29.5) {
    if (!phases?.length) {
      return [
        { name: 'CALENDARIA.MoonPhase.NewMoon', icon: `${ASSETS.MOON_ICONS}/01_newmoon.svg`, start: 0, end: 0.125 },
        { name: 'CALENDARIA.MoonPhase.WaxingCrescent', icon: `${ASSETS.MOON_ICONS}/02_waxingcrescent.svg`, start: 0.125, end: 0.25 },
        { name: 'CALENDARIA.MoonPhase.FirstQuarter', icon: `${ASSETS.MOON_ICONS}/03_firstquarter.svg`, start: 0.25, end: 0.375 },
        { name: 'CALENDARIA.MoonPhase.WaxingGibbous', icon: `${ASSETS.MOON_ICONS}/04_waxinggibbous.svg`, start: 0.375, end: 0.5 },
        { name: 'CALENDARIA.MoonPhase.FullMoon', icon: `${ASSETS.MOON_ICONS}/05_fullmoon.svg`, start: 0.5, end: 0.625 },
        { name: 'CALENDARIA.MoonPhase.WaningGibbous', icon: `${ASSETS.MOON_ICONS}/06_waninggibbous.svg`, start: 0.625, end: 0.75 },
        { name: 'CALENDARIA.MoonPhase.LastQuarter', icon: `${ASSETS.MOON_ICONS}/07_lastquarter.svg`, start: 0.75, end: 0.875 },
        { name: 'CALENDARIA.MoonPhase.WaningCrescent', icon: `${ASSETS.MOON_ICONS}/08_waningcrescent.svg`, start: 0.875, end: 1 }
      ];
    }

    const result = [];
    let currentPosition = 0;
    for (const phase of phases) {
      const length = phase.length || cycleLength / phases.length;
      const start = currentPosition / cycleLength;
      const end = (currentPosition + length) / cycleLength;
      result.push({ name: phase.name, icon: this.#mapMoonPhaseIcon(phase.name, phase.icon), start: Math.min(start, 0.999), end: Math.min(end, 1) });
      currentPosition += length;
    }

    return result;
  }

  /**
   * Map MC moon phase icon to Calendaria SVG icon path.
   * @param {string} phaseName - Phase name for fallback matching
   * @param {string} _icon - MC icon class (FontAwesome)
   * @returns {string} Calendaria SVG path
   */
  #mapMoonPhaseIcon(phaseName, _icon) {
    const n = phaseName.toLowerCase();
    if (n.includes('new')) return `${ASSETS.MOON_ICONS}/01_newmoon.svg`;
    if (n.includes('waxing') && n.includes('crescent')) return `${ASSETS.MOON_ICONS}/02_waxingcrescent.svg`;
    if (n.includes('first') && n.includes('quarter')) return `${ASSETS.MOON_ICONS}/03_firstquarter.svg`;
    if (n.includes('waxing') && n.includes('gibbous')) return `${ASSETS.MOON_ICONS}/04_waxinggibbous.svg`;
    if (n.includes('full')) return `${ASSETS.MOON_ICONS}/05_fullmoon.svg`;
    if (n.includes('waning') && n.includes('gibbous')) return `${ASSETS.MOON_ICONS}/06_waninggibbous.svg`;
    if (n.includes('last') && n.includes('quarter')) return `${ASSETS.MOON_ICONS}/07_lastquarter.svg`;
    if (n.includes('third') && n.includes('quarter')) return `${ASSETS.MOON_ICONS}/07_lastquarter.svg`;
    if (n.includes('waning') && n.includes('crescent')) return `${ASSETS.MOON_ICONS}/08_waningcrescent.svg`;
    return `${ASSETS.MOON_ICONS}/01_newmoon.svg`;
  }

  /**
   * Transform MC moon reference date.
   * @param {object} firstNewMoon - MC first new moon config
   * @returns {object} Calendaria reference date
   */
  #transformMoonReference(firstNewMoon = {}) {
    return { year: firstNewMoon.year ?? 0, month: firstNewMoon.month ?? 0, day: (firstNewMoon.day ?? 0) + 1 };
  }

  /**
   * Extract festivals from MC intercalary months.
   * @param {object[]} months - MC months array
   * @returns {object[]} Calendaria festivals array
   */
  #extractFestivals(months = []) {
    if (this.importIntercalaryAsMonths) return [];
    const festivals = [];
    let regularMonthIndex = 0;
    for (const month of months) {
      if (month.intercalary) {
        for (let day = 1; day <= month.days; day++) festivals.push({ name: month.days === 1 ? month.name : `${month.name} (Day ${day})`, month: regularMonthIndex + 1, day, countsForWeekday: false });
      } else {
        regularMonthIndex++;
      }
    }

    return festivals;
  }

  /**
   * Transform MC sun/daylight data to Calendaria daylight config.
   * @param {object[]} sunValues - MC sun values array
   * @param {object[]} months - MC months array
   * @returns {object} Calendaria daylight config
   */
  #transformDaylight(sunValues = [], months = []) {
    if (!sunValues?.length) return { enabled: false };
    let shortestDaylight = Infinity;
    let longestDaylight = 0;
    let shortestMonthStart = 0;
    let longestMonthStart = 0;
    for (const sun of sunValues) {
      const daylight = (sun.dusk || 18) - (sun.dawn || 6);
      if (daylight < shortestDaylight) {
        shortestDaylight = daylight;
        shortestMonthStart = sun.monthStart || 1;
      }
      if (daylight > longestDaylight) {
        longestDaylight = daylight;
        longestMonthStart = sun.monthStart || 6;
      }
    }

    if (shortestDaylight === Infinity || longestDaylight === 0) return { enabled: false };
    const winterSolstice = this.#estimateSolsticeDay(shortestMonthStart, months);
    const summerSolstice = this.#estimateSolsticeDay(longestMonthStart, months);
    return { enabled: true, shortestDay: Math.round(shortestDaylight), longestDay: Math.round(longestDaylight), winterSolstice, summerSolstice };
  }

  /**
   * Estimate the day of year for a solstice based on month ordinal.
   * @param {number} monthOrdinal - Month ordinal (1-indexed)
   * @param {object[]} months - MC months array
   * @returns {number} Estimated day of year
   */
  #estimateSolsticeDay(monthOrdinal, months = []) {
    let dayOfYear = 0;

    for (const month of months) {
      if (month.ordinal < monthOrdinal) {
        dayOfYear += month.days || 30;
      } else if (month.ordinal === monthOrdinal) {
        dayOfYear += Math.floor((month.days || 30) / 2);
        break;
      }
    }

    return dayOfYear;
  }

  /**
   * Transform MC weather data to Calendaria climate zones.
   * @param {object} data - Full MC data (for biome info)
   * @param {object[]} weatherValues - MC weather values
   * @returns {object} Calendaria weather config
   */
  #transformWeather(data = {}, weatherValues = []) {
    const biome = data.biome || 'temperate';
    if (!weatherValues?.length) return { activeZone: biome, autoGenerate: false, zones: [] };
    const seasonOverrides = {};
    for (const weather of weatherValues) {
      const tempOffset = weather.tempOffset || 0;
      const baseTemp = 60;
      seasonOverrides[weather.name] = { min: baseTemp + tempOffset - 10, max: baseTemp + tempOffset + 10 };
    }
    const zone = {
      id: biome,
      name: biome.charAt(0).toUpperCase() + biome.slice(1),
      description: `Imported from Mini Calendar (${biome} biome)`,
      temperatures: { _default: { min: 50, max: 70 }, ...seasonOverrides },
      presets: [],
      seasonOverrides: {}
    };
    return { activeZone: biome, autoGenerate: false, zones: [zone] };
  }

  /**
   * Extract notes from MC data (both preset and journal-based).
   * @param {object} data - Raw MC export data
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    const allNotes = [];
    const calendar = data.calendar || data;
    const presetNotes = calendar.notes || [];
    for (const note of presetNotes) {
      const dateObj = note.date || note.startDate;
      if (!dateObj) continue;
      allNotes.push({
        name: note.title || note.name || 'Untitled',
        content: note.content || '',
        startDate: { year: dateObj.year ?? 0, month: dateObj.month ?? 0, day: dateObj.day ?? 0, hour: 0, minute: 0, second: 0 },
        endDate: null,
        allDay: true,
        repeat: this.#transformRepeatRule(note.repeatUnit, note.repeatInterval),
        categories: [],
        originalId: note.id,
        isPreset: note.isPreset ?? true,
        icon: note.icon,
        suggestedType: note.content?.trim() ? 'note' : 'festival'
      });
    }

    const journalNotes = data.notes || [];
    for (const note of journalNotes) {
      const dateObj = note.startDate || note.date;
      if (!dateObj) {
        this._undatedEvents.push({ name: note.title || note.name || 'Untitled', content: note.content || '' });
        continue;
      }

      allNotes.push({
        name: note.title || note.name || 'Untitled',
        content: note.content || '',
        startDate: { year: dateObj.year ?? 0, month: dateObj.month ?? 0, day: dateObj.day ?? 0, hour: 0, minute: 0, second: 0 },
        endDate: null,
        allDay: true,
        repeat: this.#transformRepeatRule(note.repeatUnit, note.repeatInterval),
        categories: [],
        originalId: note.id,
        isPreset: note.isPreset ?? false,
        icon: note.icon,
        suggestedType: note.content?.trim() ? 'note' : 'festival'
      });
    }

    log(3, `Extracted ${allNotes.length} notes from Mini Calendar data`);
    return allNotes;
  }

  /**
   * Transform MC repeat rule to Calendaria format.
   * @param {string} repeatUnit - MC repeat unit (years, months, weeks, days, none)
   * @param {number} repeatInterval - MC repeat interval
   * @returns {string} Calendaria repeat rule
   */
  #transformRepeatRule(repeatUnit, repeatInterval = 1) {
    if (!repeatUnit || repeatUnit === 'none' || repeatInterval === 0) return 'never';
    const unitMap = { years: 'yearly', months: 'monthly', weeks: 'weekly', days: 'daily' };
    return unitMap[repeatUnit] || 'never';
  }

  /** @override */
  async importNotes(notes, options = {}) {
    const { calendarId } = options;
    const errors = [];
    let count = 0;
    log(3, `Starting note import: ${notes.length} notes to calendar ${calendarId}`);
    const calendar = CalendarManager.getCalendar(calendarId);
    const yearZero = calendar?.years?.yearZero ?? 0;
    for (const note of notes) {
      try {
        const startDate = { ...note.startDate, year: note.startDate.year + yearZero };
        const endDate = note.endDate ? { ...note.endDate, year: note.endDate.year + yearZero } : null;
        const noteData = { startDate, endDate, allDay: note.allDay, repeat: note.repeat, categories: note.categories };
        const page = await NoteManager.createNote({ name: note.name, content: note.content || '', noteData, calendarId });
        if (page) count++;
        else errors.push(`Failed to create note: ${note.name}`);
      } catch (error) {
        errors.push(`Error creating note "${note.name}": ${error.message}`);
      }
    }

    log(3, `Note import complete: ${count}/${notes.length} imported, ${errors.length} errors`, { errors });
    return { success: errors.length === 0, count, errors };
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
        const festivalData = { name: festival.name, month: (festival.startDate.month ?? 0) + 1, day: (festival.startDate.day ?? 0) + 1 };
        log(3, `Adding festival: ${festivalData.name} on ${festivalData.month}/${festivalData.day}`);
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
   * Count notes in raw MC data.
   * @param {object} data - Raw MC export data
   * @returns {number} Total note count
   */
  #countNotes(data) {
    const calendar = data.calendar || data;
    const presetCount = calendar.notes?.length || 0;
    const journalCount = data.notes?.length || 0;
    return presetCount + journalCount;
  }

  /** @override */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    preview.noteCount = this.#countNotes(rawData);
    preview.source = rawData.calendarSource || 'custom';
    preview.biome = rawData.biome || 'temperate';
    return preview;
  }
}
