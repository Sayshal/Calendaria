/**
 * Seasons & Stars Importer
 * Imports calendar data from the Seasons & Stars module.
 *
 * @module Importers/SeasonsStarsImporter
 * @author Tyler
 */

import BaseImporter from './base-importer.mjs';
import { log } from '../utils/logger.mjs';
import NoteManager from '../notes/note-manager.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { ASSETS } from '../constants.mjs';

/**
 * Importer for Seasons & Stars module data.
 * Handles both file uploads and live import from installed module.
 * @extends BaseImporter
 */
export default class SeasonsStarsImporter extends BaseImporter {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static id = 'seasons-stars';
  static label = 'CALENDARIA.Importer.SeasonsStars.Name';
  static icon = 'fa-star';
  static description = 'CALENDARIA.Importer.SeasonsStars.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = true;
  static moduleId = 'seasons-and-stars';
  static fileExtensions = ['.json'];

  /* -------------------------------------------- */
  /*  Detection                                   */
  /* -------------------------------------------- */

  /**
   * Check if the provided data is in S&S format.
   * @param {object} data - Data to check
   * @returns {boolean} True if data appears to be S&S format
   */
  static isSSFormat(data) {
    return !!(data.id && data.translations && (data.months || data.weekdays || data.year));
  }

  /* -------------------------------------------- */
  /*  Data Loading                                */
  /* -------------------------------------------- */

  /**
   * Load calendar data from installed Seasons & Stars module.
   * @returns {Promise<object>} Raw S&S calendar data
   */
  async loadFromModule() {
    if (!this.constructor.detect()) throw new Error(game.i18n.localize('CALENDARIA.Importer.SeasonsStars.NotInstalled'));

    const calendarData = game.settings.get('seasons-and-stars', 'activeCalendarData');
    if (!calendarData) throw new Error(game.i18n.localize('CALENDARIA.Importer.SeasonsStars.NoCalendar'));

    // Also get world events if available
    let worldEvents = [];
    try {
      worldEvents = game.settings.get('seasons-and-stars', 'worldEvents') || [];
    } catch (e) {
      log(3, 'No world events found in S&S settings');
    }

    return { calendar: calendarData, worldEvents };
  }

  /* -------------------------------------------- */
  /*  Transformation                              */
  /* -------------------------------------------- */

  /**
   * Transform Seasons & Stars data into CalendariaCalendar format.
   * @param {object} data - Raw S&S export data or calendar object
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    const calendar = data.calendar || data;
    const label = calendar.translations?.en?.label || calendar.id || 'Imported Calendar';

    log(3, 'Transforming Seasons & Stars data:', label);

    // Log warning for unsupported features
    if (calendar.variants) log(2, game.i18n.localize('CALENDARIA.Importer.SeasonsStars.Warning.Variants'));

    const weekdays = this.#transformWeekdays(calendar.weekdays);
    const months = this.#transformMonths(calendar.months);
    const daysPerYear = months.reduce((sum, m) => sum + m.days, 0);

    return {
      name: label,

      // Days configuration (weekdays + time)
      days: { values: weekdays, ...this.#transformTime(calendar.time), daysPerYear },

      // Months
      months: { values: months },

      // Years configuration
      years: this.#transformYears(calendar.year),

      // Leap year configuration
      leapYearConfig: this.#transformLeapYear(calendar.leapYear, calendar.months),

      // Seasons
      seasons: { values: this.#transformSeasons(calendar.seasons, months) },

      // Moons
      moons: this.#transformMoons(calendar.moons),

      // Eras from year prefix/suffix
      eras: this.#transformEras(calendar.year),

      // Festivals from intercalary days
      festivals: this.#transformIntercalary(calendar.intercalary, calendar.months),

      // Daylight from solar anchors
      daylight: this.#transformDaylight(calendar.solarAnchors, calendar.time, months),

      // Current date
      currentDate: this.#transformCurrentDate(calendar.year),

      // AM/PM notation
      amPmNotation: this.#transformAmPmNotation(calendar.time),

      // Canonical hours
      canonicalHours: this.#transformCanonicalHours(calendar.canonicalHours),

      // Named weeks
      weeks: this.#transformWeeks(calendar.weeks),

      // Date formats
      dateFormats: this.#transformDateFormats(calendar.dateFormats),

      // Metadata
      metadata: { id: calendar.id, description: calendar.translations?.en?.description || '', system: calendar.translations?.en?.setting || 'Unknown', importedFrom: 'seasons-stars' }
    };
  }

  /* -------------------------------------------- */
  /*  Transform Helpers                           */
  /* -------------------------------------------- */

  /**
   * Transform S&S weekdays to Calendaria format.
   * @param {object[]} weekdays - S&S weekdays array
   * @returns {object[]} Calendaria weekdays array
   */
  #transformWeekdays(weekdays = []) {
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

    return weekdays.map((day, index) => ({ name: day.name, abbreviation: day.abbreviation || day.name.substring(0, 2), ordinal: index + 1 }));
  }

  /**
   * Transform S&S months to Calendaria format.
   * @param {object[]} months - S&S months array
   * @returns {object[]} Calendaria months array
   */
  #transformMonths(months = []) {
    return months.map((month, index) => ({ name: month.name, abbreviation: month.abbreviation || month.name.substring(0, 3), days: month.length ?? month.days ?? 30, ordinal: index + 1 }));
  }

  /**
   * Transform S&S time configuration.
   * @param {object} time - S&S time config
   * @returns {object} Calendaria time config
   */
  #transformTime(time = {}) {
    return { hoursPerDay: time.hoursInDay ?? 24, minutesPerHour: time.minutesInHour ?? 60, secondsPerMinute: time.secondsInMinute ?? 60 };
  }

  /**
   * Transform S&S year config to Calendaria format.
   * @param {object} year - S&S year config
   * @returns {object} Calendaria years config
   */
  #transformYears(year = {}) {
    return { yearZero: year.epoch ?? 0, firstWeekday: year.startDay ?? 0 };
  }

  /**
   * Transform S&S leap year config to Calendaria format.
   * @param {object} leapYear - S&S leap year config
   * @param {object[]} months - S&S months array (for month index lookup)
   * @returns {object|null} Calendaria leapYearConfig
   */
  #transformLeapYear(leapYear = {}, months = []) {
    if (!leapYear.rule || leapYear.rule === 'none') return null;
    if (leapYear.rule === 'gregorian') return { rule: 'gregorian', start: leapYear.offset ?? 0 };
    if (leapYear.rule === 'custom') return { rule: 'simple', interval: leapYear.interval ?? 4, start: leapYear.offset ?? 0 };
    return null;
  }

  /**
   * Transform S&S seasons to Calendaria format.
   * @param {object[]} seasons - S&S seasons array
   * @param {object[]} months - Transformed months array
   * @returns {object[]} Calendaria seasons array
   */
  #transformSeasons(seasons = [], months = []) {
    if (!seasons.length) return [];

    // Build month start day index for conversion
    let dayIndex = 0;
    const monthStartDays = months.map((m) => {
      const start = dayIndex;
      dayIndex += m.days || 0;
      return start;
    });
    const daysInYear = dayIndex;

    return seasons.map((season) => {
      // S&S uses 1-indexed months
      const startMonthIdx = (season.startMonth ?? 1) - 1;
      const endMonthIdx = (season.endMonth ?? season.startMonth ?? 1) - 1;

      const dayStart = (monthStartDays[startMonthIdx] ?? 0) + ((season.startDay ?? 1) - 1);
      const dayEnd = (monthStartDays[endMonthIdx] ?? 0) + ((season.endDay ?? months[endMonthIdx]?.days ?? 1) - 1);

      return { name: season.name, dayStart: dayStart % daysInYear, dayEnd: dayEnd % daysInYear, color: this.#mapSeasonColor(season.icon) };
    });
  }

  /**
   * Map S&S season icon to color.
   * @param {string} icon - S&S season icon
   * @returns {string} Hex color
   */
  #mapSeasonColor(icon) {
    const colorMap = { winter: '#87CEEB', spring: '#90EE90', summer: '#FFD700', fall: '#DEB887', autumn: '#DEB887' };
    return colorMap[icon] || '#888888';
  }

  /**
   * Transform S&S moons to Calendaria format.
   * @param {object[]} moons - S&S moons array
   * @returns {object[]} Calendaria moons array
   */
  #transformMoons(moons = []) {
    return moons.map((moon) => ({
      name: moon.name,
      cycleLength: moon.cycleLength,
      cycleDayAdjust: 0,
      color: moon.color || '',
      hidden: false,
      phases: this.#convertPhasesToPercentages(moon.phases || [], moon.cycleLength),
      referenceDate: { year: moon.firstNewMoon?.year ?? 1, month: (moon.firstNewMoon?.month ?? 1) - 1, day: moon.firstNewMoon?.day ?? 1 }
    }));
  }

  /**
   * Convert S&S phase lengths (days) to Calendaria percentage format.
   * @param {object[]} phases - S&S phases array
   * @param {number} cycleLength - Total cycle length
   * @returns {object[]} Calendaria phases array
   */
  #convertPhasesToPercentages(phases, cycleLength) {
    const totalLength = phases.reduce((sum, p) => sum + (p.length ?? 0), 0) || cycleLength;
    let currentPosition = 0;

    return phases.map((phase) => {
      const start = currentPosition / totalLength;
      currentPosition += phase.length ?? 0;
      const end = currentPosition / totalLength;

      return { name: phase.name, icon: this.#mapPhaseIcon(phase.icon), start, end: Math.min(end, 1) };
    });
  }

  /**
   * Map S&S moon phase icon to Calendaria SVG path.
   * @param {string} ssIcon - S&S icon name
   * @returns {string} Calendaria SVG path
   */
  #mapPhaseIcon(ssIcon) {
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
    return iconMap[ssIcon] || `${ASSETS.MOON_ICONS}/01_newmoon.svg`;
  }

  /**
   * Transform S&S era config from year prefix/suffix.
   * @param {object} year - S&S year config
   * @returns {object[]} Calendaria eras array
   */
  #transformEras(year = {}) {
    const prefix = year.prefix?.trim();
    const suffix = year.suffix?.trim();
    if (!prefix && !suffix) return [];
    return [{ name: suffix || prefix || 'Era', abbreviation: suffix || prefix || '', startYear: -999999, endYear: null, format: prefix ? 'prefix' : 'suffix' }];
  }

  /**
   * Transform S&S intercalary days to Calendaria festivals.
   * @param {object[]} intercalary - S&S intercalary array
   * @param {object[]} months - S&S months array
   * @returns {object[]} Calendaria festivals array
   */
  #transformIntercalary(intercalary = [], months = []) {
    const festivals = [];
    const monthNames = months.map((m) => m.name);

    for (const item of intercalary) {
      let monthIndex, dayInMonth;

      if (item.after) {
        // After month X → first day of month X+1
        monthIndex = monthNames.indexOf(item.after) + 1;
        dayInMonth = 1;
      } else if (item.before) {
        // Before month X → last day of month X-1
        monthIndex = monthNames.indexOf(item.before);
        if (monthIndex > 0) {
          const prevMonth = months[monthIndex - 1];
          dayInMonth = prevMonth.days ?? prevMonth.length ?? 1;
        } else {
          // Before first month = last day of last month
          monthIndex = months.length;
          dayInMonth = months[months.length - 1]?.days ?? 1;
        }
      } else {
        // No positioning - skip
        continue;
      }

      // Handle multi-day intercalary periods
      const dayCount = item.days ?? 1;
      for (let d = 0; d < dayCount; d++) {
        const festival = {
          name: dayCount > 1 ? `${item.name} (Day ${d + 1})` : item.name,
          month: monthIndex + 1, // 1-indexed for Calendaria
          day: dayInMonth + d
        };

        // Leap-year-only festivals
        if (item.leapYearOnly) festival.leapYearOnly = true;

        // Non-weekday intercalary days
        if (item.countsForWeekdays === false) festival.countsForWeekday = false;

        festivals.push(festival);
      }
    }

    return festivals;
  }

  /**
   * Transform S&S solar anchors to Calendaria daylight config.
   * @param {object[]} solarAnchors - S&S solar anchors array
   * @param {object} time - S&S time config
   * @param {object[]} months - Transformed months array
   * @returns {object|null} Calendaria daylight config
   */
  #transformDaylight(solarAnchors = [], time = {}, months = []) {
    if (!solarAnchors.length) return { enabled: false };

    const winterSolstice = solarAnchors.find((a) => a.subtype === 'winter' && a.type === 'solstice');
    const summerSolstice = solarAnchors.find((a) => a.subtype === 'summer' && a.type === 'solstice');

    if (!winterSolstice || !summerSolstice) return { enabled: false };

    const parseTime = (timeStr) => {
      const [h, m] = (timeStr || '0:0').split(':').map(Number);
      return h + m / 60;
    };

    const winterDaylight = parseTime(winterSolstice.sunset) - parseTime(winterSolstice.sunrise);
    const summerDaylight = parseTime(summerSolstice.sunset) - parseTime(summerSolstice.sunrise);

    // Calculate day-of-year for solstices
    let dayIndex = 0;
    const monthStartDays = months.map((m) => {
      const start = dayIndex;
      dayIndex += m.days || 0;
      return start;
    });
    const winterDay = winterSolstice.month && winterSolstice.day ? (monthStartDays[winterSolstice.month - 1] ?? 0) + (winterSolstice.day - 1) : 355;
    const summerDay = summerSolstice.month && summerSolstice.day ? (monthStartDays[summerSolstice.month - 1] ?? 0) + (summerSolstice.day - 1) : 172;
    return { enabled: true, shortestDay: Math.round(winterDaylight), longestDay: Math.round(summerDaylight), winterSolstice: winterDay, summerSolstice: summerDay };
  }

  /**
   * Transform S&S current date.
   * @param {object} year - S&S year config
   * @returns {object} Calendaria current date
   */
  #transformCurrentDate(year = {}) {
    return { year: year.currentYear ?? 1 };
  }

  /**
   * Transform S&S AM/PM notation.
   * @param {object} time - S&S time config
   * @returns {object|null} Calendaria amPmNotation
   */
  #transformAmPmNotation(time = {}) {
    if (!time.amPmNotation) return null;
    return { am: time.amPmNotation.am ?? 'AM', pm: time.amPmNotation.pm ?? 'PM' };
  }

  /**
   * Transform S&S canonical hours.
   * @param {object[]} canonicalHours - S&S canonical hours array
   * @returns {object[]} Calendaria canonical hours array
   */
  #transformCanonicalHours(canonicalHours = []) {
    if (!canonicalHours?.length) return [];

    return canonicalHours.map((hour) => ({
      name: hour.name,
      abbreviation: hour.abbreviation || hour.name.substring(0, 2),
      startHour: hour.startHour ?? 0,
      endHour: hour.endHour ?? 0
    }));
  }

  /**
   * Transform S&S named weeks configuration.
   * @param {object} weeks - S&S weeks config
   * @returns {object|null} Calendaria weeks config
   */
  #transformWeeks(weeks = {}) {
    if (!weeks.names?.length) return null;

    return {
      enabled: true,
      type: weeks.type || 'month-based',
      names: weeks.names.map((name, index) => ({
        name: typeof name === 'string' ? name : name.name,
        abbreviation: typeof name === 'string' ? name.substring(0, 2) : name.abbreviation || name.name.substring(0, 2),
        ordinal: index + 1
      }))
    };
  }

  /**
   * Transform S&S date formats.
   * @param {object} dateFormats - S&S date formats
   * @returns {object|null} Calendaria date formats
   */
  #transformDateFormats(dateFormats = {}) {
    if (!dateFormats.short && !dateFormats.long) return null;
    return { short: dateFormats.short || null, long: dateFormats.long || null };
  }

  /* -------------------------------------------- */
  /*  Note Extraction                             */
  /* -------------------------------------------- */

  /**
   * Extract notes/events from S&S export data.
   * @param {object} data - Raw S&S export data
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    const calendar = data.calendar || data;
    const events = Array.isArray(calendar.events) ? calendar.events : [];
    const worldEvents = Array.isArray(data.worldEvents) ? data.worldEvents : [];
    const allEvents = [...events, ...worldEvents];

    log(3, `Extracting ${allEvents.length} events from Seasons & Stars data`);

    return allEvents.map((event) => this.#transformEvent(event));
  }

  /**
   * Transform a single S&S event to Calendaria note format.
   * @param {object} event - S&S event
   * @returns {object} Calendaria note data
   */
  #transformEvent(event) {
    const note = {
      name: event.name,
      content: event.description || '',
      gmOnly: event.visibility === 'gm-only',
      color: event.color || '#888888',
      icon: event.icon || 'fas fa-calendar-day',
      suggestedType: 'note'
    };

    // Handle recurrence
    const rec = event.recurrence;
    if (rec) {
      if (rec.type === 'fixed') {
        note.repeat = 'yearly';
        note.startDate = {
          year: event.startYear ?? 1,
          month: (rec.month ?? 1) - 1, // Convert to 0-indexed
          day: rec.day ?? 1 // Days are 1-indexed
        };
      } else if (rec.type === 'ordinal') {
        // Nth weekday of month - limited support, use first of month as placeholder
        note.repeat = 'yearly';
        note.startDate = {
          year: event.startYear ?? 1,
          month: (rec.month ?? 1) - 1,
          day: 1 // Placeholder - ordinal dates can't be accurately represented
        };
        note.importWarnings = [`Ordinal recurrence (${rec.occurrence} ${rec.weekday} of month) imported as first of month`];
        log(2, game.i18n.localize('CALENDARIA.Importer.SeasonsStars.Warning.OrdinalRecurrence'));
      } else if (rec.type === 'interval') {
        note.repeat = 'yearly';
        note.interval = rec.intervalYears;
        note.startDate = {
          year: rec.anchorYear ?? 1,
          month: (rec.month ?? 1) - 1,
          day: rec.day ?? 1 // Days are 1-indexed
        };
      }
    }

    // Ensure there's always a startDate for events without recurrence
    if (!note.startDate && event.startDate) {
      note.startDate = {
        year: event.startDate.year ?? 1,
        month: (event.startDate.month ?? 1) - 1,
        day: event.startDate.day ?? 1
      };
    }

    // Duration parsing
    if (event.duration) {
      const match = event.duration.match(/^(\d+)([smhdw])$/);
      if (match) {
        const [, value, unit] = match;
        const durationMap = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
        note.duration = parseInt(value) * (durationMap[unit] || 1);
      }
    }

    return note;
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

    const calendar = CalendarManager.getCalendar(calendarId);
    const yearZero = calendar?.years?.yearZero ?? 0;

    for (const note of notes) {
      try {
        const startDate = note.startDate ? { ...note.startDate, year: note.startDate.year + yearZero } : { year: yearZero, month: 0, day: 1 };
        const noteData = { startDate, allDay: true, repeat: note.repeat || 'never' };
        const page = await NoteManager.createNote({ name: note.name, content: note.content || '', noteData, calendarId });

        if (page) {
          count++;
          log(3, `Successfully created note: ${note.name}`);
        } else {
          errors.push(`Failed to create note: ${note.name}`);
        }
      } catch (error) {
        errors.push(`Error creating note "${note.name}": ${error.message}`);
        log(2, `Error importing note "${note.name}":`, error);
      }
    }

    log(3, `Note import complete: ${count}/${notes.length} imported, ${errors.length} errors`);
    return { success: errors.length === 0, count, errors };
  }

  /* -------------------------------------------- */
  /*  Preview                                     */
  /* -------------------------------------------- */

  /**
   * Count notes in raw S&S data.
   * @param {object} data - Raw S&S export data
   * @returns {number} Total note count
   */
  #countNotes(data) {
    const calendar = data.calendar || data;
    const events = calendar.events?.length || 0;
    const worldEvents = data.worldEvents?.length || 0;
    return events + worldEvents;
  }

  /** @override */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    preview.noteCount = this.#countNotes(rawData);
    return preview;
  }
}
