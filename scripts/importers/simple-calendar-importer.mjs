/**
 * Simple Calendar Importer
 * Imports calendar data from the Simple Calendar module.
 *
 * @module Importers/SimpleCalendarImporter
 * @author Tyler
 */

import BaseImporter from './base-importer.mjs';
import { log } from '../utils/logger.mjs';
import NoteManager from '../notes/note-manager.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { ASSETS } from '../constants.mjs';

/**
 * Importer for Simple Calendar module data.
 * Handles both file uploads and live import from installed module.
 * @extends BaseImporter
 */
export default class SimpleCalendarImporter extends BaseImporter {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static id = 'simple-calendar';
  static label = 'CALENDARIA.Importer.SimpleCalendar.Name';
  static icon = 'fa-calendar-alt';
  static description = 'CALENDARIA.Importer.SimpleCalendar.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = true;
  static moduleId = 'foundryvtt-simple-calendar';
  static fileExtensions = ['.json'];

  /* -------------------------------------------- */
  /*  Data Loading                                */
  /* -------------------------------------------- */

  /**
   * Load calendar data from installed Simple Calendar module.
   * @returns {Promise<object>} Raw SC calendar data
   */
  async loadFromModule() {
    if (!this.constructor.detect()) throw new Error(game.i18n.localize('CALENDARIA.Importer.SimpleCalendar.NotInstalled'));

    // SC stores calendar data in settings
    const calendars = game.settings.get('foundryvtt-simple-calendar', 'calendar-configuration') || [];
    if (!calendars.length) throw new Error(game.i18n.localize('CALENDARIA.Importer.SimpleCalendar.NoCalendars'));

    // Get notes from the SC notes folder
    const notesFolder = game.folders.find((f) => f.getFlag('foundryvtt-simple-calendar', 'root') === true);
    const notes = {};
    if (notesFolder) {
      for (const entry of notesFolder.contents) {
        const noteData = entry.getFlag('foundryvtt-simple-calendar', 'noteData');
        if (noteData) {
          const calId = noteData.calendarId || 'default';
          if (!notes[calId]) notes[calId] = [];
          notes[calId].push({ ...entry.toObject(), flags: entry.flags });
        }
      }
    }

    return { calendars, notes, exportVersion: 2 };
  }

  /* -------------------------------------------- */
  /*  Transformation                              */
  /* -------------------------------------------- */

  /**
   * Transform Simple Calendar data into CalendariaCalendar format.
   * @param {object} data - Raw SC export data
   * @param {number} [calendarIndex=0] - Index of calendar to import (if multiple)
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data, calendarIndex = 0) {
    // Handle both export format and direct calendar array
    const calendars = data.calendars || data;
    const calendar = Array.isArray(calendars) ? calendars[calendarIndex] : calendars;

    if (!calendar) throw new Error('No calendar found in import data');

    log(3, 'Transforming Simple Calendar data:', calendar.name || calendar.id);

    // Transform weekdays first (needed for startingWeekday mapping)
    const weekdays = this.#transformWeekdays(calendar.weekdays);

    // Build map from SC numericRepresentation to our array index
    const weekdayNumericToIndex = new Map();
    (calendar.weekdays || []).forEach((wd, idx) => {
      weekdayNumericToIndex.set(wd.numericRepresentation, idx);
    });

    // Transform months (needs weekday map for startingWeekday)
    const months = this.#transformMonths(calendar.months, weekdayNumericToIndex);
    const daysPerYear = months.reduce((sum, m) => sum + (m.days || 0), 0);

    return {
      name: calendar.name || 'Imported Calendar',

      // Days configuration (weekdays + time)
      days: { values: weekdays, ...this.#transformTime(calendar.time), daysPerYear },

      // Months
      months: { values: months },

      // Years and leap year (Foundry format)
      years: this.#transformYears(calendar.year, calendar.leapYear),

      // Advanced leap year config (Calendaria format)
      leapYearConfig: this.#transformLeapYearConfig(calendar.leapYear),

      // Seasons (needs months to calculate day of year)
      seasons: { values: this.#transformSeasons(calendar.seasons, months, calendar.months) },

      // Moons
      moons: this.#transformMoons(calendar.moons),

      // Festivals (from intercalary months)
      festivals: this.#extractFestivals(calendar.months),

      // Eras (from year prefix/postfix)
      eras: this.#transformEras(calendar.year),

      // Daylight configuration from seasons
      daylight: this.#transformDaylight(calendar.seasons, calendar.time),

      // Metadata
      metadata: { description: `Imported from Simple Calendar`, system: calendar.name || 'Unknown', importedFrom: 'simple-calendar', originalId: calendar.id }
    };
  }

  /* -------------------------------------------- */
  /*  Transform Helpers                           */
  /* -------------------------------------------- */

  /**
   * Transform SC time configuration.
   * @param {object} time - SC time config
   * @returns {object} Calendaria days config
   */
  #transformTime(time = {}) {
    return {
      hoursPerDay: time.hoursInDay ?? 24,
      minutesPerHour: time.minutesInHour ?? 60,
      secondsPerMinute: time.secondsInMinute ?? 60
    };
  }

  /**
   * Transform SC months to Calendaria format.
   * @param {object[]} months - SC months array
   * @param {Map<number,number>} weekdayNumericToIndex - Map from SC numericRepresentation to array index
   * @returns {object[]} Calendaria months array
   */
  #transformMonths(months = [], weekdayNumericToIndex = new Map()) {
    return months
      .filter((m) => !m.intercalary) // Filter out intercalary months (become festivals)
      .map((month, index) => ({
        name: month.name,
        abbreviation: month.abbreviation || month.name.substring(0, 3),
        days: month.numberOfDays,
        leapDays: month.numberOfLeapYearDays !== month.numberOfDays ? month.numberOfLeapYearDays : undefined,
        ordinal: month.numericRepresentation || index + 1,
        // Convert SC's numericRepresentation-based startingWeekday to our array index
        startingWeekday: month.startingWeekday != null ? (weekdayNumericToIndex.get(month.startingWeekday) ?? null) : null
      }));
  }

  /**
   * Transform SC weekdays to Calendaria format.
   * Provides default 7-day week if none defined.
   * @param {object[]} weekdays - SC weekdays array
   * @returns {object[]} Calendaria weekdays array
   */
  #transformWeekdays(weekdays = []) {
    // Default to standard 7-day week if no weekdays defined
    if (!weekdays?.length) {
      return [
        { name: 'Sunday', abbreviation: 'Su', ordinal: 1 },
        { name: 'Monday', abbreviation: 'Mo', ordinal: 2 },
        { name: 'Tuesday', abbreviation: 'Tu', ordinal: 3 },
        { name: 'Wednesday', abbreviation: 'We', ordinal: 4 },
        { name: 'Thursday', abbreviation: 'Th', ordinal: 5 },
        { name: 'Friday', abbreviation: 'Fr', ordinal: 6 },
        { name: 'Saturday', abbreviation: 'Sa', ordinal: 7 }
      ];
    }

    return weekdays.map((day, index) => ({
      name: day.name,
      abbreviation: day.abbreviation || day.name.substring(0, 2),
      ordinal: day.numericRepresentation || index + 1
    }));
  }

  /**
   * Transform SC year and leap year config to Foundry format.
   * @param {object} year - SC year config
   * @param {object} leapYear - SC leap year config
   * @returns {object} Calendaria years config (Foundry format)
   */
  #transformYears(year = {}, leapYear = {}) {
    const result = {
      yearZero: year.yearZero ?? 0,
      firstWeekday: year.firstWeekday ?? 0,
      leapYear: null // Default to no leap year
    };

    // Transform leap year rule to Foundry format (leapStart, leapInterval)
    if (leapYear.rule === 'gregorian') result.leapYear = { leapStart: 0, leapInterval: 4 };
    else if (leapYear.rule === 'custom' && leapYear.customMod > 0) result.leapYear = { leapStart: 0, leapInterval: leapYear.customMod };
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
   * Calculates dayStart/dayEnd from month positions.
   * @param {object[]} seasons - SC seasons array
   * @param {object[]} transformedMonths - Already transformed months array
   * @param {object[]} scMonths - Original SC months array (for day calculations)
   * @returns {object[]} Calendaria seasons array
   */
  #transformSeasons(seasons = [], transformedMonths = [], scMonths = []) {
    if (!seasons.length) return [];
    const monthDayStarts = [];
    let dayCount = 0;
    for (const month of scMonths) {
      monthDayStarts.push(dayCount);
      dayCount += month.numberOfDays || 0;
    }
    const totalDays = dayCount;

    // Sort seasons by start date to calculate end dates
    const sortedSeasons = [...seasons].sort((a, b) => {
      const aDay = monthDayStarts[a.startingMonth] + (a.startingDay ?? 0);
      const bDay = monthDayStarts[b.startingMonth] + (b.startingDay ?? 0);
      return aDay - bDay;
    });

    return sortedSeasons.map((season, index) => {
      // Calculate dayStart (0-indexed day of year)
      const dayStart = monthDayStarts[season.startingMonth] + (season.startingDay ?? 0);

      // dayEnd is the day before the next season starts (wrapping around)
      const nextSeason = sortedSeasons[(index + 1) % sortedSeasons.length];
      let dayEnd = monthDayStarts[nextSeason.startingMonth] + (nextSeason.startingDay ?? 0) - 1;
      if (dayEnd < dayStart) dayEnd += totalDays; // Wrap around year
      if (dayEnd < 0) dayEnd = totalDays - 1;

      return { name: season.name, dayStart, dayEnd: dayEnd >= totalDays ? dayEnd - totalDays : dayEnd };
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
      phases: this.#transformMoonPhases(moon.phases, moon.cycleLength),
      referenceDate: this.#transformMoonReference(moon.firstNewMoon)
    }));
  }

  /**
   * Transform SC moon phases to Calendaria format.
   * SC uses length in days, Calendaria uses start/end as percentage of cycle.
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
    return { year: firstNewMoon.year ?? 0, month: firstNewMoon.month ?? 0, day: firstNewMoon.day ?? 0 };
  }

  /**
   * Extract festivals from SC intercalary months.
   * @param {object[]} months - SC months array
   * @returns {object[]} Calendaria festivals array
   */
  #extractFestivals(months = []) {
    const festivals = [];
    let regularMonthIndex = 0;
    for (const month of months) {
      if (month.intercalary) {
        for (let day = 1; day <= month.numberOfDays; day++) festivals.push({ name: month.numberOfDays === 1 ? month.name : `${month.name} (Day ${day})`, month: regularMonthIndex, day: day });
      } else {
        regularMonthIndex++;
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
   * @param {object} time - SC time config
   * @returns {object} Calendaria daylight config
   */
  #transformDaylight(seasons = [], time = {}) {
    if (!seasons.length) return { enabled: false };

    const secondsPerDay = (time.hoursInDay ?? 24) * (time.minutesInHour ?? 60) * (time.secondsInMinute ?? 60);

    // Find shortest and longest day from season sunrise/sunset
    let shortestDaylight = Infinity;
    let longestDaylight = 0;

    for (const season of seasons) {
      if (season.sunriseTime != null && season.sunsetTime != null) {
        const daylight = (season.sunsetTime - season.sunriseTime) / 3600; // Convert to hours
        if (daylight < shortestDaylight) shortestDaylight = daylight;
        if (daylight > longestDaylight) longestDaylight = daylight;
      }
    }

    if (shortestDaylight === Infinity || longestDaylight === 0) {
      return { enabled: false };
    }

    return { enabled: true, shortestDay: Math.round(shortestDaylight), longestDay: Math.round(longestDaylight) };
  }

  /* -------------------------------------------- */
  /*  Note Extraction                             */
  /* -------------------------------------------- */

  /**
   * Extract notes from SC export data.
   * @param {object} data - Raw SC export data
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    const notes = data.notes || {};
    log(3, `extractNotes - Available note calendars in data:`, Object.keys(notes));

    // Iterate over all calendar note arrays (extract from all SC calendars)
    const allNotes = [];
    for (const [calId, calendarNotes] of Object.entries(notes)) {
      log(3, `Processing notes from SC calendar: ${calId} (${calendarNotes?.length || 0} notes)`);

      for (const note of calendarNotes) {
        const noteData = note.flags?.['foundryvtt-simple-calendar']?.noteData;
        if (!noteData) {
          log(3, `Skipping note without noteData flag: ${note.name}`);
          continue;
        }

        // Extract content from first page
        const content = note.pages?.[0]?.text?.content || '';

        // Determine suggested type: festival if no meaningful content, note otherwise
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
   * Import notes into Calendaria.
   * @param {object[]} notes - Extracted note data
   * @param {object} options - Import options
   * @param {string} options.calendarId - Target calendar ID
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>}
   * @override
   */
  async importNotes(notes, options = {}) {
    const { calendarId } = options;
    const errors = [];
    let count = 0;

    log(3, `Starting note import: ${notes.length} notes to calendar ${calendarId}`);

    // Get calendar's yearZero to convert SC internal years to display years
    const calendar = CalendarManager.getCalendar(calendarId);
    const yearZero = calendar?.years?.yearZero ?? 0;
    log(3, `Calendar yearZero: ${yearZero}`);

    for (const note of notes) {
      try {
        log(3, `Importing note: ${note.name}`, note);

        // Convert SC internal years to display years (add yearZero)
        // SC internal 795 + yearZero 1970 = display 2765
        const startDate = { ...note.startDate, year: note.startDate.year + yearZero };
        const endDate = note.endDate ? { ...note.endDate, year: note.endDate.year + yearZero } : null;
        const noteData = { startDate, endDate, allDay: note.allDay, repeat: note.repeat, categories: note.categories };
        log(3, `Note data prepared:`, noteData);

        // Create note via NoteManager
        const page = await NoteManager.createNote({ name: note.name, content: note.content || '', noteData, calendarId });

        if (page) {
          count++;
          log(3, `Successfully created note: ${note.name} (${page.id})`);
        } else {
          errors.push(`Failed to create note: ${note.name}`);
          log(2, `Failed to create note: ${note.name}`);
        }
      } catch (error) {
        errors.push(`Error creating note "${note.name}": ${error.message}`);
        log(2, `Error importing note "${note.name}":`, error);
      }
    }

    log(3, `Note import complete: ${count}/${notes.length} imported, ${errors.length} errors`);
    return { success: errors.length === 0, count, errors };
  }

  /**
   * Import festivals (fixed calendar events) into the calendar definition.
   * @param {object[]} festivals - Extracted festival data
   * @param {object} options - Import options
   * @param {string} options.calendarId - Target calendar ID
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>}
   * @override
   */
  async importFestivals(festivals, options = {}) {
    const { calendarId } = options;
    const errors = [];

    log(3, `Starting festival import: ${festivals.length} festivals to calendar ${calendarId}`);

    // Get current calendar
    const calendar = CalendarManager.getCalendar(calendarId);
    if (!calendar) return { success: false, count: 0, errors: [`Calendar ${calendarId} not found`] };

    // Build new festivals array
    const existingFestivals = calendar.festivals || [];
    const newFestivals = [];

    for (const festival of festivals) {
      try {
        // Festival format: { name, month (1-indexed), day }
        const festivalData = {
          name: festival.name,
          month: (festival.startDate.month ?? 0) + 1, // Convert 0-indexed to 1-indexed
          day: (festival.startDate.day ?? 0) + 1 // Convert 0-indexed to 1-indexed
        };

        log(3, `Adding festival: ${festivalData.name} on ${festivalData.month}/${festivalData.day}`);
        newFestivals.push(festivalData);
      } catch (error) {
        errors.push(`Error processing festival "${festival.name}": ${error.message}`);
        log(2, `Error processing festival "${festival.name}":`, error);
      }
    }

    // Update calendar with merged festivals
    if (newFestivals.length > 0) {
      try {
        const mergedFestivals = [...existingFestivals, ...newFestivals];
        await CalendarManager.updateCustomCalendar(calendarId, { festivals: mergedFestivals });
        log(3, `Festival import complete: ${newFestivals.length} festivals added`);
      } catch (error) {
        errors.push(`Error saving festivals: ${error.message}`);
        log(2, 'Error saving festivals:', error);
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
    return { year: date.year ?? 0, month: date.month ?? 0, day: date.day ?? 0, hour: date.hour ?? 0, minute: date.minute ?? 0, second: date.seconds ?? 0 };
  }

  /**
   * Transform SC repeat rule to Calendaria format.
   * SC: 0=Never, 1=Weekly, 2=Monthly, 3=Yearly
   * @param {number} repeats - SC repeat value
   * @returns {string} Calendaria repeat rule
   */
  #transformRepeatRule(repeats) {
    const rules = ['never', 'weekly', 'monthly', 'yearly'];
    return rules[repeats] || 'never';
  }

  /* -------------------------------------------- */
  /*  Preview                                     */
  /* -------------------------------------------- */

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

  /** @override */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    preview.noteCount = this.#countNotes(rawData);
    return preview;
  }
}
