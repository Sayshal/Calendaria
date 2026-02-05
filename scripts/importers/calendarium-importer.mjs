/**
 * Calendarium (Obsidian) Importer
 * Imports calendar data from Calendarium Obsidian plugin data.json exports.
 * @module Importers/CalendariumImporter
 * @author Tyler
 */

import { ASSETS } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import BaseImporter from './base-importer.mjs';

/**
 * Moon phase names for standard 8 phases.
 */
const PHASE_NAMES_8 = [
  'CALENDARIA.MoonPhase.NewMoon',
  'CALENDARIA.MoonPhase.WaxingCrescent',
  'CALENDARIA.MoonPhase.FirstQuarter',
  'CALENDARIA.MoonPhase.WaxingGibbous',
  'CALENDARIA.MoonPhase.FullMoon',
  'CALENDARIA.MoonPhase.WaningGibbous',
  'CALENDARIA.MoonPhase.LastQuarter',
  'CALENDARIA.MoonPhase.WaningCrescent'
];

/**
 * Importer for Calendarium Obsidian plugin exports.
 * @extends BaseImporter
 */
export default class CalendariumImporter extends BaseImporter {
  static id = 'calendarium';
  static label = 'CALENDARIA.Importer.Calendarium.Name';
  static icon = 'fa-book-atlas';
  static description = 'CALENDARIA.Importer.Calendarium.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = false;
  static fileExtensions = ['.json'];

  /** @type {Map<string, object>} Category map from Calendarium */
  _categories = new Map();

  /**
   * Check if data is a Calendarium export.
   * @param {object} data - Parsed JSON data
   * @returns {boolean} - Is valid export
   */
  static isCalendariumExport(data) {
    // Check for wrapped calendars array format
    if (data.calendars && Array.isArray(data.calendars) && data.calendars[0]?.static?.months && data.calendars[0]?.static?.weekdays) return true;
    // Check for single calendar object format (direct export)
    if (data.static?.months && data.static?.weekdays) return true;
    return false;
  }

  /**
   * Normalize Calendarium data to expected format.
   * Wraps single calendar exports in a calendars array.
   * @param {object} data - Raw Calendarium data
   * @returns {object} - Normalized data with calendars array
   */
  static normalizeData(data) {
    if (data.calendars && Array.isArray(data.calendars)) return data;
    // Wrap single calendar object in calendars array
    return { calendars: [data] };
  }

  /**
   * Transform Calendarium data into CalendariaCalendar format.
   * @param {object} data - Raw Calendarium export data
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    if (!CalendariumImporter.isCalendariumExport(data)) throw new Error(localize('CALENDARIA.Importer.Calendarium.InvalidFormat'));
    const normalizedData = CalendariumImporter.normalizeData(data);
    const calendar = normalizedData.calendars[0];
    log(3, 'Transforming Calendarium data:', calendar.name);
    this._categories = this.#buildCategoryMap(calendar.categories);
    const months = this.#transformMonths(calendar.static.months);
    const daysPerYear = months.reduce((sum, m) => sum + (m.days || 0), 0);
    const weekdays = this.#transformWeekdays(calendar.static.weekdays, calendar.static.months);
    const { config: leapYearConfig, festivals: leapFestivals } = this.#transformLeapDays(calendar.static.leapDays);
    const moons = this.#transformMoons(calendar.static.moons);
    const seasons = this.#transformSeasons(calendar.seasonal, months, daysPerYear);
    const eras = this.#transformEras(calendar.static.eras);
    const { cycles, cycleFormat } = this.#transformCustomYears(calendar.static);
    return {
      name: calendar.name || localize('CALENDARIA.Importer.Fallback.CalendarName'),
      days: { values: weekdays, hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60, daysPerYear },
      months: { values: months },
      years: { yearZero: 0, firstWeekday: calendar.static.firstWeekDay || 0, leapYear: null },
      leapYearConfig,
      festivals: leapFestivals,
      moons,
      seasons,
      eras,
      cycles,
      cycleFormat,
      metadata: {
        id: calendar.id || 'imported-calendarium',
        description: calendar.description || localize('CALENDARIA.Common.ImportedFromCalendarium'),
        system: calendar.name || localize('CALENDARIA.Common.Unknown'),
        importedFrom: 'calendarium'
      },
      currentDate: this.#transformCurrentDate(calendar.current)
    };
  }

  /**
   * Build category map from Calendarium categories.
   * @param {object[]} categories - Calendarium categories array
   * @returns {Map<string, object>} - Category ID to config map
   */
  #buildCategoryMap(categories = []) {
    const map = new Map();
    for (const cat of categories) map.set(cat.id, { name: cat.name, color: cat.color || '#2196f3' });
    return map;
  }

  /**
   * Transform Calendarium months to Calendaria format.
   * Includes per-month custom weekdays if present.
   * @param {object[]} months - Calendarium months array
   * @returns {object[]} - Transformed months array
   */
  #transformMonths(months = []) {
    return months.map((m, idx) => {
      const month = {
        name: m.name,
        abbreviation: m.short || m.name.substring(0, 3),
        days: m.length,
        ordinal: idx + 1,
        type: m.type === 'intercalary' ? 'intercalary' : null,
        startingWeekday: null,
        leapDays: null
      };

      if (m.week && Array.isArray(m.week) && m.week.length > 0) {
        month.weekdays = m.week.map((wd) => ({
          name: wd.name,
          abbreviation: wd.name?.substring(0, 2) || '',
          isRestDay: false
        }));
      }

      return month;
    });
  }

  /**
   * Transform Calendarium weekdays to Calendaria format.
   * @param {object[]} weekdays - Calendarium weekdays array
   * @param {object[]} months - Calendarium months array (to log custom week info)
   * @returns {object[]} - Transformed weekdays array
   */
  #transformWeekdays(weekdays = [], months = []) {
    const monthsWithCustomWeeks = months.filter((m) => m.week && Array.isArray(m.week) && m.week.length > 0);
    if (monthsWithCustomWeeks.length > 0) {
      const details = monthsWithCustomWeeks.map((m) => m.name).join(', ');
      log(3, `Imported custom weekdays for months: ${details}`);
    }

    return weekdays.map((wd, idx) => ({ name: wd.name, abbreviation: wd.name.substring(0, 2), ordinal: idx + 1 }));
  }

  /**
   * Transform Calendarium leap days to Calendaria format.
   * @param {object[]} leapDays - Calendarium leap_days array
   * @returns {{config: object|null, festivals: object[]}} - Leap year config and festivals
   */
  #transformLeapDays(leapDays = []) {
    if (!leapDays.length) return { config: null, festivals: [] };
    const festivals = [];
    let leapYearConfig = null;
    for (const ld of leapDays) {
      const intervals = ld.interval || [];
      if (!leapYearConfig && intervals.length > 0) {
        if (this.#isGregorianPattern(intervals)) leapYearConfig = { rule: 'gregorian', start: ld.offset || 0 };
        else if (intervals.length === 1 && !intervals[0].ignore) leapYearConfig = { rule: 'simple', interval: intervals[0].interval, start: ld.offset || 0 };
        else leapYearConfig = { rule: 'custom', pattern: this.#serializeIntervals(intervals), start: ld.offset || 0 };
      }
      if (ld.intercalary && ld.name) festivals.push({ name: ld.name, month: (ld.timespan || 0) + 1, day: (ld.after || 0) + 1, leapYearOnly: true, countsForWeekday: !ld.numbered });
    }
    return { config: leapYearConfig, festivals };
  }

  /**
   * Check if intervals match Gregorian pattern (400, !100, 4).
   * @param {object[]} intervals - Leap day interval conditions
   * @returns {boolean} - Is Gregorian pattern?
   */
  #isGregorianPattern(intervals) {
    if (intervals.length !== 3) return false;
    return intervals[0].interval === 400 && !intervals[0].ignore && intervals[1].interval === 100 && intervals[1].ignore && intervals[2].interval === 4 && !intervals[2].ignore;
  }

  /**
   * Serialize intervals to pattern string.
   * @param {object[]} intervals - Leap day interval conditions
   * @returns {string} - Serialized pattern string
   */
  #serializeIntervals(intervals) {
    return intervals.map((i) => (i.ignore ? '!' : '') + (i.exclusive ? '#' : '') + i.interval).join(',');
  }

  /**
   * Transform Calendarium moons to Calendaria format.
   * @param {object[]} moons - Calendarium moons array
   * @returns {object[]} - Transformed moons array
   */
  #transformMoons(moons = []) {
    return moons.map((moon) => ({
      name: moon.name,
      cycleLength: moon.cycle,
      cycleDayAdjust: moon.offset || 0,
      color: moon.faceColor || '',
      hidden: false,
      phases: this.#generateMoonPhases(),
      referenceDate: { year: 1, month: 0, day: 1 }
    }));
  }

  /**
   * Generate standard 8 moon phases.
   * @returns {object[]} - Moon phases array
   */
  #generateMoonPhases() {
    const iconNames = ['01_newmoon', '02_waxingcrescent', '03_firstquarter', '04_waxinggibbous', '05_fullmoon', '06_waninggibbous', '07_lastquarter', '08_waningcrescent'];
    return PHASE_NAMES_8.map((name, i) => ({ name, rising: '', fading: '', icon: `${ASSETS.MOON_ICONS}/${iconNames[i]}.svg`, start: i / 8, end: (i + 1) / 8 }));
  }

  /**
   * Transform Calendarium seasons to Calendaria format.
   * @param {object} seasonal - Calendarium seasonal config
   * @param {object[]} months - Transformed months array
   * @param {number} daysPerYear - Total days per year
   * @returns {{type: string, offset: number, values: object[]}} - Seasons configuration
   */
  #transformSeasons(seasonal = {}, months, daysPerYear) {
    const seasons = seasonal.seasons || [];
    if (!seasons.length) return { type: 'dated', offset: 0, values: [] };
    const monthDayStarts = [];
    let dayCount = 0;
    for (const m of months) {
      monthDayStarts.push(dayCount);
      dayCount += m.days || 0;
    }

    const isDated = seasons[0]?.date != null;
    if (isDated) return { type: 'dated', offset: 0, values: this.#transformDatedSeasons(seasons, monthDayStarts, daysPerYear) };
    else return { type: 'periodic', offset: seasonal.offset || 0, values: this.#transformPeriodicSeasons(seasons, daysPerYear) };
  }

  /**
   * Transform dated seasons (specific month/day).
   * @param {object[]} seasons - Calendarium seasons
   * @param {number[]} monthDayStarts - Day-of-year for each month start
   * @param {number} totalDays - Total days per year
   * @returns {object[]} - Transformed dated seasons array
   */
  #transformDatedSeasons(seasons, monthDayStarts, totalDays) {
    const sortedSeasons = [...seasons].sort((a, b) => {
      const aDay = (monthDayStarts[a.date?.month] ?? 0) + (a.date?.day ?? 0);
      const bDay = (monthDayStarts[b.date?.month] ?? 0) + (b.date?.day ?? 0);
      return aDay - bDay;
    });

    return sortedSeasons.map((season, index) => {
      const dayStart = (monthDayStarts[season.date?.month] ?? 0) + (season.date?.day ?? 0);
      const nextSeason = sortedSeasons[(index + 1) % sortedSeasons.length];
      let dayEnd = (monthDayStarts[nextSeason.date?.month] ?? 0) + (nextSeason.date?.day ?? 0) - 1;
      if (dayEnd < 0) dayEnd = totalDays - 1;
      if (dayEnd < dayStart) dayEnd += totalDays;
      return { name: season.name, dayStart, dayEnd: dayEnd >= totalDays ? dayEnd - totalDays : dayEnd, color: season.color || null, icon: this.#mapSeasonIcon(season.kind) };
    });
  }

  /**
   * Transform periodic seasons (duration-based).
   * Preserves duration on each season for periodic calculation.
   * @param {object[]} seasons - Calendarium seasons
   * @param {number} totalDays - Total days per year
   * @returns {object[]} - Transformed periodic seasons array
   */
  #transformPeriodicSeasons(seasons, totalDays) {
    return seasons.map((season) => ({ name: season.name, duration: season.duration || Math.floor(totalDays / seasons.length), color: season.color || null, icon: this.#mapSeasonIcon(season.kind) }));
  }

  /**
   * Map Calendarium season kind to icon.
   * @param {string} kind - Season kind (Winter, Spring, Summer, Autumn)
   * @returns {string|null} - Icon class or null
   */
  #mapSeasonIcon(kind) {
    const icons = { Winter: 'fas fa-snowflake', Spring: 'fas fa-seedling', Summer: 'fas fa-sun', Autumn: 'fas fa-leaf' };
    return icons[kind] || null;
  }

  /**
   * Transform Calendarium eras.
   * @param {object[]} eras - Calendarium eras array
   * @returns {object[]} - Transformed eras array
   */
  #transformEras(eras = []) {
    return eras.map((era) => ({
      name: era.name || localize('CALENDARIA.Common.Era'),
      abbreviation: era.name?.substring(0, 3) || 'E',
      startYear: era.date?.year ?? 0,
      endYear: era.end?.year ?? null
    }));
  }

  /**
   * Transform custom year definitions to cycles.
   * @param {object} staticData - Calendarium static data
   * @returns {{cycles: object[], cycleFormat: string|null}} - Cycles and format
   */
  #transformCustomYears(staticData) {
    if (!staticData.useCustomYears || !staticData.years?.length) return { cycles: [], cycleFormat: null };
    return {
      cycles: [
        { name: localize('CALENDARIA.Importer.CustomYears'), length: staticData.years.length, offset: 0, basedOn: 'year', stages: staticData.years.map((year) => ({ name: year.name || year.id })) }
      ],
      cycleFormat: localize('CALENDARIA.Importer.CycleFormatYear')
    };
  }

  /**
   * Extract current date from Calendarium data for preservation after import.
   * @param {object} data - Raw Calendarium data
   * @returns {{year: number, month: number, day: number}|null} Current date
   */
  extractCurrentDate(data) {
    const normalizedData = CalendariumImporter.normalizeData(data);
    const calendar = normalizedData.calendars?.[0];
    const current = calendar?.current;
    if (!current || (current.year === undefined && current.year !== 0)) return null;
    return { year: current.year, month: current.month ?? 0, day: current.day ?? 1, hour: 0, minute: 0 };
  }

  /**
   * Transform current date.
   * @param {object} current - Calendarium current date
   * @returns {object|null} - Current date object or null
   */
  #transformCurrentDate(current = {}) {
    if (!current.year && current.year !== 0) return null;
    return { year: current.year, month: current.month ?? 0, day: current.day ?? 1, hour: 0, minute: 0 };
  }

  /**
   * Extract notes from Calendarium events.
   * @param {object} data - Raw Calendarium export data
   * @returns {Promise<object[]>} - Extracted notes array
   */
  async extractNotes(data) {
    const normalizedData = CalendariumImporter.normalizeData(data);
    const calendar = normalizedData.calendars[0];
    const events = calendar.events || [];
    const notes = [];
    this._undatedEvents = [];
    log(3, `Extracting ${events.length} events from Calendarium`);
    for (const event of events) {
      try {
        const note = this.#transformEvent(event);
        if (note) notes.push(note);
      } catch (error) {
        log(1, `Error transforming event "${event.name}":`, error);
      }
    }

    log(3, `Extracted ${notes.length} notes from Calendarium`);
    return notes;
  }

  /**
   * Transform a single Calendarium event to note format.
   * @param {object} event - Calendarium event
   * @returns {object|null} - Transformed note or null
   */
  #transformEvent(event) {
    const { type, date, category, name, description } = event;
    const categoryData = this._categories.get(category);
    if (type === 'Undated' || (!date?.year && date?.year !== 0)) {
      this._undatedEvents.push({ name, content: description || '', category: categoryData?.name || 'default' });
      return null;
    }

    if (type === 'Date') {
      return {
        name,
        content: description || '',
        startDate: { year: date.year, month: date.month ?? 0, day: date.day ?? 1 },
        repeat: 'never',
        gmOnly: false,
        category: categoryData?.name || 'default',
        color: categoryData?.color || '#2196f3',
        suggestedType: 'note'
      };
    }

    if (type === 'Range') {
      return {
        name,
        content: description || '',
        startDate: { year: date.start?.year ?? date.year ?? 0, month: date.start?.month ?? date.month ?? 0, day: date.start?.day ?? date.day ?? 1 },
        endDate: { year: date.end?.year ?? date.year ?? 0, month: date.end?.month ?? date.month ?? 0, day: date.end?.day ?? date.day ?? 1 },
        repeat: 'never',
        gmOnly: false,
        category: categoryData?.name || 'default',
        color: categoryData?.color || '#2196f3',
        suggestedType: 'note'
      };
    }

    if (type === 'Recurring') {
      const pattern = this.#detectRecurringPattern(date);
      return {
        name,
        content: description || '',
        startDate: pattern.startDate,
        repeat: pattern.repeat,
        rangePattern: pattern.rangePattern || null,
        repeatInterval: pattern.interval || 1,
        gmOnly: false,
        category: categoryData?.name || 'default',
        color: categoryData?.color || '#2196f3',
        suggestedType: pattern.repeat === 'never' ? 'note' : 'festival',
        importWarnings: pattern.warnings
      };
    }

    return {
      name,
      content: description || '',
      startDate: { year: date?.year ?? 0, month: date?.month ?? 0, day: date?.day ?? 1 },
      repeat: 'never',
      gmOnly: false,
      category: categoryData?.name || 'default',
      color: categoryData?.color || '#2196f3',
      suggestedType: 'note'
    };
  }

  /**
   * Detect recurring pattern from Calendarium date specification.
   * @param {object} date - Calendarium recurring date { year, month, day }
   * @returns {object} Recurring pattern(s)
   */
  #detectRecurringPattern(date) {
    const { year, month, day } = date;
    const yearIsRange = Array.isArray(year);
    const monthIsRange = Array.isArray(month);
    const dayIsRange = Array.isArray(day);
    if (yearIsRange && year[0] === null && year[1] === null && !monthIsRange && !dayIsRange) return { repeat: 'yearly', startDate: { year: 1, month: month ?? 0, day: day ?? 1 } };
    if (yearIsRange && monthIsRange && !dayIsRange && year[0] === null && month[0] === null) return { repeat: 'monthly', startDate: { year: 1, month: 0, day: day ?? 1 } };
    return { repeat: 'range', rangePattern: { year, month, day }, startDate: { year: this.#extractFirst(year), month: this.#extractFirst(month), day: this.#extractFirst(day) } };
  }

  /**
   * Extract first usable value from a range bit.
   * @param {number|Array|null} value - Range bit
   * @returns {number} - First usable value
   */
  #extractFirst(value) {
    if (Array.isArray(value)) return value[0] !== null ? value[0] : value[1] !== null ? value[1] : 1;
    return value ?? 1;
  }

  /**
   * Import notes into Calendaria.
   * @param {object[]} notes - Extracted note data
   * @param {object} options - Import options
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>} - Import result
   */
  async importNotes(notes, options = {}) {
    const { calendarId } = options;
    const errors = [];
    let count = 0;
    log(3, `Starting note import: ${notes.length} notes to calendar ${calendarId}`);

    for (const note of notes) {
      try {
        const noteData = {
          startDate: { ...note.startDate },
          endDate: note.endDate ? { ...note.endDate } : null,
          allDay: true,
          repeat: note.repeat,
          repeatInterval: note.repeatInterval || 1,
          rangePattern: note.rangePattern || null,
          gmOnly: note.gmOnly
        };

        const page = await NoteManager.createNote({ name: note.name, content: note.content || '', noteData, calendarId });

        if (page) {
          count++;
          log(3, `Created note: ${note.name}`);
        } else {
          errors.push(`Failed to create note: ${note.name}`);
        }
      } catch (error) {
        errors.push(`Error creating "${note.name}": ${error.message}`);
        log(1, `Error importing note "${note.name}":`, error);
      }
    }

    if (this._undatedEvents.length > 0) await this.migrateUndatedEvents(options.calendarName || 'Calendarium Import');
    log(3, `Note import complete: ${count}/${notes.length}, ${errors.length} errors`);
    return { success: errors.length === 0, count, errors };
  }

  /** @override */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    const normalizedData = CalendariumImporter.normalizeData(rawData);
    const calendar = normalizedData.calendars?.[0] || {};
    preview.noteCount = calendar.events?.length ?? 0;
    preview.categoryCount = calendar.categories?.length ?? 0;
    preview.intercalaryMonths = calendar.static?.months?.filter((m) => m.type === 'intercalary').length || 0;
    preview.hasCustomWeeks = calendar.static?.months?.some((m) => m.week) || false;
    return preview;
  }
}
