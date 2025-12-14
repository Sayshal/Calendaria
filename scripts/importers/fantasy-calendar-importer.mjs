/**
 * Fantasy-Calendar.com Importer
 * Imports calendar data from Fantasy-Calendar.com JSON exports.
 *
 * @module Importers/FantasyCalendarImporter
 * @author Tyler
 */

import BaseImporter from './base-importer.mjs';
import { log } from '../utils/logger.mjs';
import NoteManager from '../notes/note-manager.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';

/**
 * FC color names to hex mapping.
 */
const FC_COLORS = {
  Blue: '#2196f3',
  'Light-Blue': '#03a9f4',
  Cyan: '#00bcd4',
  Teal: '#009688',
  Green: '#4caf50',
  'Light-Green': '#8bc34a',
  Lime: '#cddc39',
  Yellow: '#ffeb3b',
  Amber: '#ffc107',
  Orange: '#ff9800',
  'Deep-Orange': '#ff5722',
  Red: '#f44336',
  Pink: '#e91e63',
  Purple: '#9c27b0',
  'Deep-Purple': '#673ab7',
  Indigo: '#3f51b5',
  Brown: '#795548',
  Grey: '#9e9e9e',
  'Blue-Grey': '#607d8b',
  Dark: '#212121'
};

/**
 * Moon phase names for different granularities.
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
 * Moon phase icons base path.
 */
const MOON_ICON_PATH = 'modules/calendaria/assets/moon-phases';

/**
 * Importer for Fantasy-Calendar.com exports.
 * @extends BaseImporter
 */
export default class FantasyCalendarImporter extends BaseImporter {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static id = 'fantasy-calendar';
  static label = 'CALENDARIA.Importer.FantasyCalendar.Name';
  static icon = 'fa-globe';
  static description = 'CALENDARIA.Importer.FantasyCalendar.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = false;
  static fileExtensions = ['.json'];

  /* -------------------------------------------- */
  /*  Detection                                   */
  /* -------------------------------------------- */

  /**
   * Check if data is a Fantasy-Calendar export.
   * @param {object} data - Parsed JSON data
   * @returns {boolean}
   */
  static isFantasyCalendarExport(data) {
    return !!(data.static_data && data.dynamic_data && data.static_data.year_data);
  }

  /* -------------------------------------------- */
  /*  Transformation                              */
  /* -------------------------------------------- */

  /**
   * Transform Fantasy-Calendar data into CalendariaCalendar format.
   * @param {object} data - Raw FC export data
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    if (!FantasyCalendarImporter.isFantasyCalendarExport(data)) {
      throw new Error(game.i18n.localize('CALENDARIA.Importer.FantasyCalendar.InvalidFormat'));
    }

    log(3, 'Transforming Fantasy-Calendar data:', data.name);

    const staticData = data.static_data;
    const yearData = staticData.year_data;
    const timespans = yearData.timespans || [];

    // Store categories for event import
    this._categories = this.#buildCategoryMap(data.categories);

    // Transform months first (needed for season calculations)
    const months = this.#transformMonths(timespans);
    const daysPerYear = months.reduce((sum, m) => sum + (m.days || 0), 0);

    // Transform weekdays
    const weekdays = this.#transformWeekdays(yearData.global_week);
    const daysInWeek = weekdays.length || 7;

    // FC's first_day is 1-indexed and represents the weekday that the epoch (year 0/1) starts on
    // Convert to 0-indexed for Foundry
    const year0FirstWeekday = ((yearData.first_day ?? 1) - 1 + daysInWeek) % daysInWeek;

    log(3, `FC first_day: ${yearData.first_day}, converted firstWeekday: ${year0FirstWeekday}, yearZero: 1`);

    return {
      name: data.name || 'Imported Calendar',

      // Days configuration
      days: {
        values: weekdays,
        ...this.#transformTime(staticData.clock),
        daysPerYear
      },

      // Months
      months: { values: months },

      // Years config (minimal, leap year handled separately)
      // FC default: no year 0 (goes -1 to 1), so epoch is year 1
      years: {
        yearZero: 1,
        firstWeekday: year0FirstWeekday,
        leapYear: null
      },

      // Leap year config
      leapYearConfig: this.#transformLeapDays(yearData.leap_days),

      // Seasons
      seasons: {
        values: this.#transformSeasons(staticData.seasons?.data, timespans)
      },

      // Moons
      moons: this.#transformMoons(staticData.moons),

      // Eras
      eras: this.#transformEras(staticData.eras),

      // Cycles
      cycles: this.#transformCycles(staticData.cycles?.data),
      cycleFormat: staticData.cycles?.format || '',

      // Daylight from seasons
      daylight: this.#transformDaylight(staticData.seasons?.data, staticData.clock),

      // Metadata
      metadata: {
        description: `Imported from Fantasy-Calendar.com`,
        system: data.name || 'Unknown',
        importedFrom: 'fantasy-calendar'
      }
    };
  }

  /* -------------------------------------------- */
  /*  Transform Helpers                           */
  /* -------------------------------------------- */

  /**
   * Transform FC clock to time config.
   * @param {object} clock - FC clock config
   * @returns {object}
   */
  #transformTime(clock = {}) {
    return {
      hoursPerDay: clock.hours ?? 24,
      minutesPerHour: clock.minutes ?? 60,
      secondsPerMinute: 60
    };
  }

  /**
   * Transform FC timespans to months.
   * @param {object[]} timespans - FC timespans array
   * @returns {object[]}
   */
  #transformMonths(timespans = []) {
    return timespans.map((ts, index) => ({
      name: ts.name,
      abbreviation: ts.name.substring(0, 3),
      days: ts.length,
      leapDays: null,
      ordinal: index + 1,
      type: ts.type === 'intercalary' ? 'intercalary' : null,
      startingWeekday: null
    }));
  }

  /**
   * Transform FC global_week to weekdays.
   * @param {string[]} weekdays - FC weekday names
   * @returns {object[]}
   */
  #transformWeekdays(weekdays = []) {
    if (!weekdays.length) {
      // Use localization keys for default weekdays
      return [
        { name: 'CALENDARIA.Weekday.Sunday', abbreviation: 'Su', ordinal: 1 },
        { name: 'CALENDARIA.Weekday.Monday', abbreviation: 'Mo', ordinal: 2 },
        { name: 'CALENDARIA.Weekday.Tuesday', abbreviation: 'Tu', ordinal: 3 },
        { name: 'CALENDARIA.Weekday.Wednesday', abbreviation: 'We', ordinal: 4 },
        { name: 'CALENDARIA.Weekday.Thursday', abbreviation: 'Th', ordinal: 5 },
        { name: 'CALENDARIA.Weekday.Friday', abbreviation: 'Fr', ordinal: 6 },
        { name: 'CALENDARIA.Weekday.Saturday', abbreviation: 'Sa', ordinal: 7 }
      ];
    }

    return weekdays.map((name, index) => ({
      name,
      abbreviation: name.substring(0, 2),
      ordinal: index + 1
    }));
  }

  /**
   * Transform FC leap_days to leapYearConfig.
   * @param {object[]} leapDays - FC leap_days array
   * @returns {object|null}
   */
  #transformLeapDays(leapDays = []) {
    if (!leapDays.length) return null;

    // Use first leap day rule (FC can have multiple, we support one)
    const ld = leapDays[0];
    const interval = ld.interval;

    if (!interval) return null;

    // Detect rule type from interval string
    if (interval === '400,!100,4') {
      return { rule: 'gregorian', start: ld.offset ?? 0 };
    } else if (interval.includes(',') || interval.includes('!')) {
      return { rule: 'custom', pattern: interval, start: ld.offset ?? 0 };
    } else {
      const num = parseInt(interval, 10);
      if (num > 0) {
        return { rule: 'simple', interval: num, start: ld.offset ?? 0 };
      }
    }

    return null;
  }

  /**
   * Transform FC seasons to Calendaria format.
   * @param {object[]} seasons - FC seasons array
   * @param {object[]} timespans - FC timespans for day calculation
   * @returns {object[]}
   */
  #transformSeasons(seasons = [], timespans = []) {
    if (!seasons.length) return [];

    // Build day-of-year starts for each timespan
    const monthDayStarts = [];
    let dayCount = 0;
    for (const ts of timespans) {
      monthDayStarts.push(dayCount);
      dayCount += ts.length || 0;
    }
    const totalDays = dayCount;

    // Sort seasons by start position
    const sortedSeasons = [...seasons].sort((a, b) => {
      const aDay = (monthDayStarts[a.timespan] ?? 0) + (a.day ?? 0);
      const bDay = (monthDayStarts[b.timespan] ?? 0) + (b.day ?? 0);
      return aDay - bDay;
    });

    return sortedSeasons.map((season, index) => {
      const dayStart = (monthDayStarts[season.timespan] ?? 0) + (season.day ?? 0);

      // End is day before next season
      const nextSeason = sortedSeasons[(index + 1) % sortedSeasons.length];
      let dayEnd = (monthDayStarts[nextSeason.timespan] ?? 0) + (nextSeason.day ?? 0) - 1;
      if (dayEnd < 0) dayEnd = totalDays - 1;
      if (dayEnd < dayStart) dayEnd += totalDays;

      return {
        name: season.name,
        dayStart,
        dayEnd: dayEnd >= totalDays ? dayEnd - totalDays : dayEnd,
        color: season.color?.[0] || null
      };
    });
  }

  /**
   * Transform FC moons to Calendaria format.
   * @param {object[]} moons - FC moons array
   * @returns {object[]}
   */
  #transformMoons(moons = []) {
    return moons.map((moon) => ({
      name: moon.name,
      cycleLength: moon.cycle,
      cycleDayAdjust: moon.shift ?? 0,
      color: moon.color || '',
      phases: this.#generateMoonPhases(moon.granularity || 8),
      referenceDate: { year: 0, month: 0, day: 0 }
    }));
  }

  /**
   * Generate moon phases for a given granularity.
   * @param {number} granularity - Number of phases
   * @returns {object[]}
   */
  #generateMoonPhases(granularity) {
    const phases = [];

    for (let i = 0; i < granularity; i++) {
      const start = i / granularity;
      const end = (i + 1) / granularity;

      // Map phase index to name and icon
      const { name, icon } = this.#getPhaseNameAndIcon(i, granularity);

      phases.push({ name, icon, start, end });
    }

    return phases;
  }

  /**
   * Get phase name and icon for index.
   * @param {number} index - Phase index
   * @param {number} total - Total phases
   * @returns {{name: string, icon: string}}
   */
  #getPhaseNameAndIcon(index, total) {
    // Map index to approximate 8-phase position
    const position8 = Math.floor((index / total) * 8);
    const baseName = PHASE_NAMES_8[position8] || `Phase ${index + 1}`;

    // Icon based on 8-phase mapping
    const iconIndex = position8 + 1;
    const iconNames = ['01_newmoon', '02_waxingcrescent', '03_firstquarter', '04_waxinggibbous', '05_fullmoon', '06_waninggibbous', '07_lastquarter', '08_waningcrescent'];
    const iconName = iconNames[position8] || '01_newmoon';

    return {
      name: baseName,
      icon: `${MOON_ICON_PATH}/${iconName}.svg`
    };
  }

  /**
   * Transform FC eras.
   * @param {object[]} eras - FC eras array
   * @returns {object[]}
   */
  #transformEras(eras = []) {
    return eras.map((era) => ({
      name: era.name || 'Era',
      abbreviation: era.abbreviation || era.name?.substring(0, 2) || 'E',
      startYear: era.start ?? 0,
      endYear: era.end ?? null,
      format: 'suffix',
      template: era.date_format || null
    }));
  }

  /**
   * Transform FC cycles.
   * @param {object[]} cycles - FC cycles array
   * @returns {object[]}
   */
  #transformCycles(cycles = []) {
    const basedOnMap = {
      year: 'year',
      era_year: 'eraYear',
      month: 'month',
      day: 'monthDay',
      epoch: 'day',
      year_day: 'yearDay'
    };

    return cycles.map((cycle) => ({
      name: cycle.name || 'Cycle',
      length: cycle.length || 12,
      offset: cycle.offset ?? 0,
      basedOn: basedOnMap[cycle.type] || 'year',
      entries: (cycle.data || []).map((entry) => ({ name: entry.name || entry }))
    }));
  }

  /**
   * Transform FC season sunrise/sunset to daylight config.
   * @param {object[]} seasons - FC seasons array
   * @param {object} clock - FC clock config
   * @returns {object}
   */
  #transformDaylight(seasons = [], clock = {}) {
    if (!seasons.length) return { enabled: false };

    let shortestDaylight = Infinity;
    let longestDaylight = 0;

    for (const season of seasons) {
      const sunrise = season.time?.sunrise;
      const sunset = season.time?.sunset;

      if (sunrise && sunset) {
        const sunriseHours = sunrise.hour + (sunrise.minute ?? 0) / 60;
        const sunsetHours = sunset.hour + (sunset.minute ?? 0) / 60;
        const daylight = sunsetHours - sunriseHours;

        if (daylight < shortestDaylight) shortestDaylight = daylight;
        if (daylight > longestDaylight) longestDaylight = daylight;
      }
    }

    if (shortestDaylight === Infinity || longestDaylight === 0) {
      return { enabled: false };
    }

    return {
      enabled: true,
      shortestDay: Math.round(shortestDaylight),
      longestDay: Math.round(longestDaylight)
    };
  }

  /**
   * Build category map from FC categories.
   * @param {object[]} categories - FC categories array
   * @returns {Map<string, object>}
   */
  #buildCategoryMap(categories = []) {
    const map = new Map();
    for (const cat of categories) {
      map.set(cat.id, {
        name: cat.name,
        color: FC_COLORS[cat.event_settings?.color] || '#2196f3',
        hidden: cat.event_settings?.hide ?? false,
        gmOnly: cat.category_settings?.hide ?? false
      });
    }
    return map;
  }

  /* -------------------------------------------- */
  /*  Note Extraction                             */
  /* -------------------------------------------- */

  /**
   * Extract notes from FC events.
   * @param {object} data - Raw FC export data
   * @returns {Promise<object[]>}
   */
  async extractNotes(data) {
    const events = data.events || [];
    const notes = [];

    log(3, `Extracting ${events.length} events from Fantasy-Calendar`);

    for (const event of events) {
      try {
        const note = this.#transformEvent(event, data);
        if (note) notes.push(note);
      } catch (error) {
        log(2, `Error transforming event "${event.name}":`, error);
      }
    }

    log(3, `Extracted ${notes.length} notes from Fantasy-Calendar`);
    return notes;
  }

  /**
   * Transform a single FC event to note format.
   * @param {object} event - FC event
   * @param {object} data - Full FC data (for context)
   * @returns {object|null}
   */
  #transformEvent(event, data) {
    const conditions = event.data?.conditions || [];
    const eventType = this.#detectEventType(conditions);

    // Get category info
    const category = this._categories?.get(event.event_category_id);
    const gmOnly = event.settings?.hide || category?.gmOnly || false;

    // Parse date - prefer direct data.date array, fall back to conditions
    const date = this.#extractDate(event.data, conditions, data);

    // Determine suggested type:
    // - Populated data.date = one-time event = note
    // - Empty data.date = recurring = festival (unless random event)
    const isOneTimeEvent = Array.isArray(event.data?.date) && event.data.date.length >= 3;
    const isRandomEvent = eventType.repeat === 'random';
    const suggestedType = isOneTimeEvent || isRandomEvent ? 'note' : 'festival';

    const noteData = {
      name: event.name,
      content: event.description || '',
      startDate: date,
      repeat: eventType.repeat,
      interval: eventType.interval || 1,
      gmOnly,
      category: category?.name || 'default',
      color: FC_COLORS[event.settings?.color] || category?.color || '#2196f3',
      duration: event.data?.duration || 1,
      originalId: event.id,
      suggestedType
    };

    // Add moon conditions if present
    if (eventType.moonConditions?.length) {
      noteData.moonConditions = eventType.moonConditions;
    }

    // Add random config if present
    if (eventType.randomConfig) {
      noteData.randomConfig = eventType.randomConfig;
    }

    // Add max occurrences if limited
    if (event.data?.limited_repeat && event.data?.limited_repeat_num > 0) {
      noteData.maxOccurrences = event.data.limited_repeat_num;
    }

    return noteData;
  }

  /**
   * Detect event type from FC conditions.
   * @param {Array} conditions - FC conditions array
   * @returns {{repeat: string, interval: number, moonConditions?: Array, randomConfig?: object}}
   */
  #detectEventType(conditions) {
    const result = { repeat: 'yearly', interval: 1 };
    const types = conditions.filter((c) => Array.isArray(c) && c.length >= 1).map((c) => c[0]);

    // Random event
    if (types.includes('Random')) {
      const randomCond = conditions.find((c) => c[0] === 'Random');
      if (randomCond) {
        result.repeat = 'random';
        result.randomConfig = {
          probability: parseFloat(randomCond[2]?.[0]) || 10,
          seed: parseInt(randomCond[2]?.[1]) || Math.floor(Math.random() * 2147483647),
          checkInterval: 'daily'
        };
      }
      return result;
    }

    // One-time date event
    if (types.includes('Date') && !types.includes('Month') && !types.includes('Day')) {
      result.repeat = 'never';
      return result;
    }

    // Moon-based event
    if (types.includes('Moons')) {
      const moonCond = conditions.find((c) => c[0] === 'Moons');
      if (moonCond) {
        const moonIndex = parseInt(moonCond[2]?.[0]) || 0;
        const phaseIndex = parseInt(moonCond[2]?.[1]) || 0;
        const granularity = 24; // FC default

        result.moonConditions = [
          {
            moonIndex,
            phaseStart: phaseIndex / granularity,
            phaseEnd: (phaseIndex + 1) / granularity
          }
        ];

        // If only moon condition, set repeat to 'moon'
        if (!types.includes('Month') && !types.includes('Day')) {
          result.repeat = 'moon';
        }
      }
    }

    // Yearly (Month + Day)
    if (types.includes('Month') && types.includes('Day')) {
      result.repeat = 'yearly';
    } else if (types.includes('Day') && !types.includes('Month')) {
      result.repeat = 'monthly';
    }

    return result;
  }

  /**
   * Extract date from FC event data.
   * FC format: data.date = [year, month, day] where month is 0-indexed, day is 1-indexed
   * NoteManager format: { year, month, day } where month is 0-indexed, day is 1-indexed
   * @param {object} eventData - FC event.data object
   * @param {Array} conditions - FC conditions array (fallback)
   * @param {object} fullData - Full FC export data
   * @returns {{year: number, month: number, day: number}}
   */
  #extractDate(eventData, conditions, fullData) {
    // Prefer direct data.date array if available
    if (Array.isArray(eventData?.date) && eventData.date.length >= 3) {
      return {
        year: eventData.date[0],
        month: eventData.date[1], // 0-indexed
        day: eventData.date[2] // 1-indexed (NoteManager expects 1-indexed)
      };
    }

    // Fall back to parsing conditions
    const date = { year: fullData.dynamic_data?.year || 0, month: 0, day: 1 };

    for (const cond of conditions) {
      if (!Array.isArray(cond) || cond.length < 3) continue;

      const [type, , values] = cond;

      switch (type) {
        case 'Date':
          // FC Date condition: [year, month, day] - month 0-indexed, day 1-indexed
          date.year = values[0] ?? date.year;
          date.month = values[1] ?? 0;
          date.day = values[2] ?? 1; // Keep 1-indexed
          break;
        case 'Month':
          date.month = parseInt(values[0]) || 0;
          break;
        case 'Day':
          // Day condition uses 1-indexed days
          date.day = parseInt(values[0]) || 1; // Keep 1-indexed
          break;
      }
    }

    return date;
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

    const calendar = CalendarManager.getCalendar(calendarId);

    for (const note of notes) {
      try {
        // FC stores display years directly, no yearZero adjustment needed
        const startDate = { ...note.startDate };

        // Calculate end date from duration (accounting for month boundaries)
        let endDate = null;
        if (note.duration > 1) {
          endDate = this.#addDaysToDate(startDate, note.duration - 1, calendar);
        }

        const noteData = {
          startDate,
          endDate,
          allDay: true,
          repeat: note.repeat,
          interval: note.interval,
          moonConditions: note.moonConditions || [],
          randomConfig: note.randomConfig || null,
          maxOccurrences: note.maxOccurrences || 0,
          gmOnly: note.gmOnly
        };

        const page = await NoteManager.createNote({
          name: note.name,
          content: note.content || '',
          noteData,
          calendarId
        });

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

    log(3, `Note import complete: ${count}/${notes.length}, ${errors.length} errors`);
    return { success: errors.length === 0, count, errors };
  }

  /**
   * Add days to a date, handling month/year overflow.
   * @param {object} date - Start date {year, month, day}
   * @param {number} daysToAdd - Number of days to add
   * @param {object} calendar - Calendar object with months data
   * @returns {object} New date {year, month, day}
   */
  #addDaysToDate(date, daysToAdd, calendar) {
    let { year, month, day } = { ...date };
    let remaining = daysToAdd;

    const months = calendar?.months?.values || [];
    if (!months.length) return { year, month, day: day + daysToAdd };

    while (remaining > 0) {
      const monthData = months[month];
      const daysInMonth = monthData?.days || 30;
      const daysLeftInMonth = daysInMonth - day;

      if (remaining <= daysLeftInMonth) {
        day += remaining;
        remaining = 0;
      } else {
        remaining -= daysLeftInMonth + 1;
        day = 1;
        month++;
        if (month >= months.length) {
          month = 0;
          year++;
        }
      }
    }

    return { year, month, day };
  }

  /* -------------------------------------------- */
  /*  Preview                                     */
  /* -------------------------------------------- */

  /** @override */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    preview.noteCount = rawData.events?.length ?? 0;
    preview.categoryCount = rawData.categories?.length ?? 0;
    preview.hasCycles = (rawData.static_data?.cycles?.data?.length ?? 0) > 0;
    return preview;
  }
}
