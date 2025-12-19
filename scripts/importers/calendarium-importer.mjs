/**
 * Calendarium (Obsidian) Importer
 * Imports calendar data from Calendarium Obsidian plugin data.json exports.
 *
 * @module Importers/CalendariumImporter
 * @author Tyler
 */

import BaseImporter from './base-importer.mjs';
import { log } from '../utils/logger.mjs';
import NoteManager from '../notes/note-manager.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { ASSETS } from '../constants.mjs';

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
 * Season preset weather data.
 */
const SEASON_WEATHER_PRESETS = {
  Winter: { tempRange: [-7, 2], precipitationChance: 0.5 },
  Spring: { tempRange: [9.5, 21], precipitationChance: 0.75 },
  Summer: { tempRange: [22, 30], precipitationChance: 0.55 },
  Autumn: { tempRange: [1, 11], precipitationChance: 0.5 }
};

/**
 * Importer for Calendarium Obsidian plugin exports.
 * @extends BaseImporter
 */
export default class CalendariumImporter extends BaseImporter {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static id = 'calendarium';
  static label = 'CALENDARIA.Importer.Calendarium.Name';
  static icon = 'fa-book-atlas';
  static description = 'CALENDARIA.Importer.Calendarium.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = false;
  static fileExtensions = ['.json'];

  /* -------------------------------------------- */
  /*  Instance Properties                         */
  /* -------------------------------------------- */

  /** @type {Map<string, object>} Category map from Calendarium */
  _categories = new Map();

  /** @type {object[]} Undated events to migrate to journals */
  _undatedJournals = [];

  /* -------------------------------------------- */
  /*  Detection                                   */
  /* -------------------------------------------- */

  /**
   * Check if data is a Calendarium export.
   * @param {object} data - Parsed JSON data
   * @returns {boolean}
   */
  static isCalendariumExport(data) {
    return !!(data.calendars && Array.isArray(data.calendars) && data.calendars[0]?.static?.months && data.calendars[0]?.static?.weekdays);
  }

  /* -------------------------------------------- */
  /*  Transformation                              */
  /* -------------------------------------------- */

  /**
   * Transform Calendarium data into CalendariaCalendar format.
   * @param {object} data - Raw Calendarium export data
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    if (!CalendariumImporter.isCalendariumExport(data)) {
      throw new Error(game.i18n.localize('CALENDARIA.Importer.Calendarium.InvalidFormat'));
    }

    // Use first calendar
    const calendar = data.calendars[0];
    const warnings = [];

    log(3, 'Transforming Calendarium data:', calendar.name);

    // Store categories for event import
    this._categories = this.#buildCategoryMap(calendar.categories);

    // Transform months (including intercalary)
    const months = this.#transformMonths(calendar.static.months, warnings);
    const daysPerYear = months.reduce((sum, m) => sum + (m.days || 0), 0);

    // Transform weekdays
    const weekdays = this.#transformWeekdays(calendar.static.weekdays, calendar.static.months, warnings);

    // Transform leap days
    const { config: leapYearConfig, festivals: leapFestivals } = this.#transformLeapDays(calendar.static.leapDays, warnings);

    // Transform moons
    const moons = this.#transformMoons(calendar.static.moons, warnings);

    // Transform seasons
    const seasons = this.#transformSeasons(calendar.seasonal, months, daysPerYear, warnings);

    // Transform eras
    const eras = this.#transformEras(calendar.static.eras);

    // Transform custom years to cycles
    const { cycles, cycleFormat } = this.#transformCustomYears(calendar.static);

    return {
      name: calendar.name || 'Imported Calendar',

      days: { values: weekdays, hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60, daysPerYear },

      months: { values: months },

      years: { yearZero: 0, firstWeekday: calendar.static.firstWeekDay || 0, leapYear: null },

      leapYearConfig,

      festivals: leapFestivals,

      moons,

      seasons: { values: seasons },

      eras,

      cycles,
      cycleFormat,

      metadata: { id: calendar.id || 'imported-calendarium', description: calendar.description || 'Imported from Calendarium', system: calendar.name || 'Unknown', importedFrom: 'calendarium' },

      currentDate: this.#transformCurrentDate(calendar.current),

      _warnings: warnings
    };
  }

  /* -------------------------------------------- */
  /*  Transform Helpers                           */
  /* -------------------------------------------- */

  /**
   * Build category map from Calendarium categories.
   * @param {object[]} categories - Calendarium categories array
   * @returns {Map<string, object>}
   */
  #buildCategoryMap(categories = []) {
    const map = new Map();
    for (const cat of categories) {
      map.set(cat.id, {
        name: cat.name,
        color: cat.color || '#2196f3'
      });
    }
    return map;
  }

  /**
   * Transform Calendarium months to Calendaria format.
   * @param {object[]} months - Calendarium months array
   * @param {string[]} warnings - Warnings array to populate
   * @returns {object[]}
   */
  #transformMonths(months = [], warnings) {
    return months.map((m, idx) => ({
      name: m.name,
      abbreviation: m.short || m.name.substring(0, 3),
      days: m.length,
      ordinal: idx + 1,
      type: m.type === 'intercalary' ? 'intercalary' : null,
      startingWeekday: null,
      leapDays: null
    }));
  }

  /**
   * Transform Calendarium weekdays to Calendaria format.
   * @param {object[]} weekdays - Calendarium weekdays array
   * @param {object[]} months - Calendarium months array (to check for custom weeks)
   * @param {string[]} warnings - Warnings array to populate
   * @returns {object[]}
   */
  #transformWeekdays(weekdays = [], months = [], warnings) {
    // Check for per-month custom weekdays
    const monthsWithCustomWeeks = months.filter((m) => m.week && Array.isArray(m.week) && m.week.length > 0);
    if (monthsWithCustomWeeks.length > 0) {
      const details = monthsWithCustomWeeks.map((m) => m.name).join(', ');
      warnings.push(game.i18n.format('CALENDARIA.Importer.Calendarium.Warning.CustomWeekdays', { details }));
    }

    return weekdays.map((wd, idx) => ({ name: wd.name, abbreviation: wd.name.substring(0, 2), ordinal: idx + 1 }));
  }

  /**
   * Transform Calendarium leap days to Calendaria format.
   * @param {object[]} leapDays - Calendarium leap_days array
   * @param {string[]} warnings - Warnings array to populate
   * @returns {{config: object|null, festivals: object[]}}
   */
  #transformLeapDays(leapDays = [], warnings) {
    if (!leapDays.length) return { config: null, festivals: [] };

    const festivals = [];
    let leapYearConfig = null;

    for (const ld of leapDays) {
      const intervals = ld.interval || [];

      // Build leapYearConfig from first leap day rule
      if (!leapYearConfig && intervals.length > 0) {
        if (this.#isGregorianPattern(intervals)) {
          leapYearConfig = {
            rule: 'gregorian',
            start: ld.offset || 0
          };
        } else if (intervals.length === 1 && !intervals[0].ignore) {
          leapYearConfig = {
            rule: 'simple',
            interval: intervals[0].interval,
            start: ld.offset || 0
          };
        } else {
          leapYearConfig = {
            rule: 'custom',
            pattern: this.#serializeIntervals(intervals),
            start: ld.offset || 0
          };
        }
      }

      // Intercalary leap days become festivals
      if (ld.intercalary && ld.name) festivals.push({ name: ld.name, month: (ld.timespan || 0) + 1, day: (ld.after || 0) + 1, leapYearOnly: true, countsForWeekday: !ld.numbered });
    }

    if (leapDays.length > 1 && !leapDays.some((ld) => ld.intercalary)) warnings.push(game.i18n.localize('CALENDARIA.Importer.Calendarium.Warning.MultipleLeapDays'));
    return { config: leapYearConfig, festivals };
  }

  /**
   * Check if intervals match Gregorian pattern (400, !100, 4).
   * @param {object[]} intervals - Leap day interval conditions
   * @returns {boolean}
   */
  #isGregorianPattern(intervals) {
    if (intervals.length !== 3) return false;
    return intervals[0].interval === 400 && !intervals[0].ignore && intervals[1].interval === 100 && intervals[1].ignore && intervals[2].interval === 4 && !intervals[2].ignore;
  }

  /**
   * Serialize intervals to pattern string.
   * @param {object[]} intervals - Leap day interval conditions
   * @returns {string}
   */
  #serializeIntervals(intervals) {
    return intervals.map((i) => (i.ignore ? '!' : '') + (i.exclusive ? '#' : '') + i.interval).join(',');
  }

  /**
   * Transform Calendarium moons to Calendaria format.
   * @param {object[]} moons - Calendarium moons array
   * @param {string[]} warnings - Warnings array to populate
   * @returns {object[]}
   */
  #transformMoons(moons = [], warnings) {
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
   * @returns {object[]}
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
   * @param {string[]} warnings - Warnings array to populate
   * @returns {object[]}
   */
  #transformSeasons(seasonal = {}, months, daysPerYear, warnings) {
    const seasons = seasonal.seasons || [];
    if (!seasons.length) return [];

    // Check for procedural weather
    if (seasonal.weather?.enabled) warnings.push(game.i18n.localize('CALENDARIA.Importer.Calendarium.Warning.ProceduralWeather'));

    // Build day-of-year starts for each month
    const monthDayStarts = [];
    let dayCount = 0;
    for (const m of months) {
      monthDayStarts.push(dayCount);
      dayCount += m.days || 0;
    }

    // Determine if seasons are dated or periodic
    const isDated = seasons[0]?.date != null;
    if (isDated) return this.#transformDatedSeasons(seasons, monthDayStarts, daysPerYear);
    else return this.#transformPeriodicSeasons(seasons, seasonal.offset || 0, daysPerYear);
  }

  /**
   * Transform dated seasons (specific month/day).
   * @param {object[]} seasons - Calendarium seasons
   * @param {number[]} monthDayStarts - Day-of-year for each month start
   * @param {number} totalDays - Total days per year
   * @returns {object[]}
   */
  #transformDatedSeasons(seasons, monthDayStarts, totalDays) {
    // Sort seasons by start position
    const sortedSeasons = [...seasons].sort((a, b) => {
      const aDay = (monthDayStarts[a.date?.month] ?? 0) + (a.date?.day ?? 0);
      const bDay = (monthDayStarts[b.date?.month] ?? 0) + (b.date?.day ?? 0);
      return aDay - bDay;
    });

    return sortedSeasons.map((season, index) => {
      const dayStart = (monthDayStarts[season.date?.month] ?? 0) + (season.date?.day ?? 0);

      // End is day before next season
      const nextSeason = sortedSeasons[(index + 1) % sortedSeasons.length];
      let dayEnd = (monthDayStarts[nextSeason.date?.month] ?? 0) + (nextSeason.date?.day ?? 0) - 1;
      if (dayEnd < 0) dayEnd = totalDays - 1;
      if (dayEnd < dayStart) dayEnd += totalDays;

      return { name: season.name, dayStart, dayEnd: dayEnd >= totalDays ? dayEnd - totalDays : dayEnd, color: season.color || null, icon: this.#mapSeasonIcon(season.kind) };
    });
  }

  /**
   * Transform periodic seasons (duration-based).
   * @param {object[]} seasons - Calendarium seasons
   * @param {number} offset - Starting day offset
   * @param {number} totalDays - Total days per year
   * @returns {object[]}
   */
  #transformPeriodicSeasons(seasons, offset, totalDays) {
    let dayStart = offset;

    return seasons.map((season) => {
      const dayEnd = (dayStart + (season.duration || 91) - 1) % totalDays;
      const result = { name: season.name, dayStart, dayEnd, color: season.color || null, icon: this.#mapSeasonIcon(season.kind) };
      dayStart = (dayEnd + 1) % totalDays;
      return result;
    });
  }

  /**
   * Map Calendarium season kind to icon.
   * @param {string} kind - Season kind (Winter, Spring, Summer, Autumn)
   * @returns {string|null}
   */
  #mapSeasonIcon(kind) {
    const icons = { Winter: 'fas fa-snowflake', Spring: 'fas fa-seedling', Summer: 'fas fa-sun', Autumn: 'fas fa-leaf' };
    return icons[kind] || null;
  }

  /**
   * Transform Calendarium eras.
   * @param {object[]} eras - Calendarium eras array
   * @returns {object[]}
   */
  #transformEras(eras = []) {
    return eras.map((era) => ({
      name: era.name || 'Era',
      abbreviation: era.name?.substring(0, 3) || 'E',
      startYear: era.date?.year ?? 0,
      endYear: era.end?.year ?? null,
      format: this.#detectEraFormat(era.format),
      template: era.format || null
    }));
  }

  /**
   * Detect era format (prefix or suffix) from template string.
   * @param {string} formatString - Era format template
   * @returns {string}
   */
  #detectEraFormat(formatString) {
    if (!formatString) return 'suffix';
    const abbrevIndex = formatString.indexOf('{{abbreviation}}') !== -1 ? formatString.indexOf('{{abbreviation}}') : formatString.indexOf('{{era_name}}');
    const yearIndex = formatString.indexOf('{{year}}');
    if (abbrevIndex === -1 || yearIndex === -1) return 'suffix';
    return abbrevIndex < yearIndex ? 'prefix' : 'suffix';
  }

  /**
   * Transform custom year definitions to cycles.
   * @param {object} staticData - Calendarium static data
   * @returns {{cycles: object[], cycleFormat: string|null}}
   */
  #transformCustomYears(staticData) {
    if (!staticData.useCustomYears || !staticData.years?.length) return { cycles: [], cycleFormat: null };

    return {
      cycles: [
        {
          name: 'Custom Years',
          length: staticData.years.length,
          offset: 0,
          basedOn: 'year',
          entries: staticData.years.map((year) => ({ name: year.name || year.id }))
        }
      ],
      cycleFormat: 'Year of {{1}}'
    };
  }

  /**
   * Transform current date.
   * @param {object} current - Calendarium current date
   * @returns {object|null}
   */
  #transformCurrentDate(current = {}) {
    if (!current.year && current.year !== 0) return null;

    return { year: current.year, month: current.month ?? 0, day: current.day ?? 1, hour: 0, minute: 0 };
  }

  /* -------------------------------------------- */
  /*  Note Extraction                             */
  /* -------------------------------------------- */

  /**
   * Extract notes from Calendarium events.
   * @param {object} data - Raw Calendarium export data
   * @returns {Promise<object[]>}
   */
  async extractNotes(data) {
    const calendar = data.calendars[0];
    const events = calendar.events || [];
    const notes = [];

    this._undatedJournals = [];

    log(3, `Extracting ${events.length} events from Calendarium`);

    for (const event of events) {
      try {
        const note = this.#transformEvent(event, calendar.categories);
        if (note) notes.push(note);
      } catch (error) {
        log(2, `Error transforming event "${event.name}":`, error);
      }
    }

    log(3, `Extracted ${notes.length} notes from Calendarium`);
    return notes;
  }

  /**
   * Transform a single Calendarium event to note format.
   * @param {object} event - Calendarium event
   * @param {object[]} categories - Calendarium categories
   * @returns {object|null}
   */
  #transformEvent(event, categories) {
    const { type, date, category, name, description } = event;

    // Get category info
    const categoryData = this._categories.get(category);

    // Handle undated events - migrate to journals later
    if (type === 'Undated' || (!date?.year && date?.year !== 0)) {
      this._undatedJournals.push({ name, content: description || '', category: categoryData?.name || 'default' });
      return null;
    }

    // Handle Date type (one-time event)
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

    // Handle Range type (multi-day event)
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

    // Handle Recurring type - use range repeat with pattern
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

    // Fallback - treat as one-time event
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
   * @returns {{repeat: string, startDate: object, rangePattern?: object, interval?: number, warnings?: string[]}}
   */
  #detectRecurringPattern(date) {
    const { year, month, day } = date;

    const yearIsRange = Array.isArray(year);
    const monthIsRange = Array.isArray(month);
    const dayIsRange = Array.isArray(day);

    // Check for simple yearly pattern: any year, specific month/day
    // { year: [null, null], month: 0, day: 15 }
    if (yearIsRange && year[0] === null && year[1] === null && !monthIsRange && !dayIsRange) {
      return { repeat: 'yearly', startDate: { year: 1, month: month ?? 0, day: day ?? 1 } };
    }

    // Check for simple monthly pattern: any year/month, specific day
    // { year: [null, null], month: [null, null], day: 15 }
    if (yearIsRange && monthIsRange && !dayIsRange && year[0] === null && month[0] === null) {
      return { repeat: 'monthly', startDate: { year: 1, month: 0, day: day ?? 1 } };
    }

    // Complex pattern - use range repeat type
    return { repeat: 'range', rangePattern: { year, month, day }, startDate: { year: this.#extractFirst(year), month: this.#extractFirst(month), day: this.#extractFirst(day) } };
  }

  /**
   * Extract first usable value from a range bit.
   * @param {number|Array|null} value - Range bit
   * @returns {number}
   */
  #extractFirst(value) {
    if (Array.isArray(value)) return value[0] !== null ? value[0] : value[1] !== null ? value[1] : 1;
    return value ?? 1;
  }

  /**
   * Import notes into Calendaria.
   * @param {object[]} notes - Extracted note data
   * @param {object} options - Import options
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>}
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
        log(2, `Error importing note "${note.name}":`, error);
      }
    }

    // Migrate undated events to journal entries
    if (this._undatedJournals.length > 0) await this.#migrateUndatedEvents(options.calendarName || 'Calendarium Import');
    log(3, `Note import complete: ${count}/${notes.length}, ${errors.length} errors`);
    return { success: errors.length === 0, count, errors };
  }

  /**
   * Migrate undated events to Foundry journal entries.
   * @param {string} calendarName - Name for folder organization
   */
  async #migrateUndatedEvents(calendarName) {
    if (!this._undatedJournals?.length) return;

    // Create folder hierarchy
    const folderName = `Calendaria Imports/${calendarName}/Undated Events`;
    const parts = folderName.split('/');
    let parentId = null;

    for (const part of parts) {
      let existing = game.folders.find((f) => f.name === part && f.folder?.id === parentId && f.type === 'JournalEntry');
      if (!existing) existing = await Folder.create({ name: part, type: 'JournalEntry', folder: parentId });

      parentId = existing.id;
    }

    // Create journal entries
    const journalData = this._undatedJournals.map((event) => ({ name: event.name, folder: parentId, pages: [{ name: event.name, type: 'text', text: { content: event.content || '' } }] }));
    await JournalEntry.createDocuments(journalData);
    ui.notifications.info(game.i18n.format('CALENDARIA.Importer.Calendarium.Warning.UndatedEvents', { count: this._undatedJournals.length }));
  }

  /* -------------------------------------------- */
  /*  Preview                                     */
  /* -------------------------------------------- */

  /** @override */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    const calendar = rawData.calendars?.[0] || {};
    preview.noteCount = calendar.events?.length ?? 0;
    preview.categoryCount = calendar.categories?.length ?? 0;
    preview.intercalaryMonths = calendar.static?.months?.filter((m) => m.type === 'intercalary').length || 0;
    preview.hasCustomWeeks = calendar.static?.months?.some((m) => m.week) || false;
    preview.warnings = transformedData._warnings || [];
    return preview;
  }
}
