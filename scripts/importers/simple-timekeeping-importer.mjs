/**
 * Simple Timekeeping Importer
 * Imports calendar data from the Simple Timekeeping module.
 * Live import only - STK does not export to files.
 *
 * @module Importers/SimpleTimekeepingImporter
 * @author Tyler
 */

import BaseImporter from './base-importer.mjs';
import { log } from '../utils/logger.mjs';
import NoteManager from '../notes/note-manager.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import WeatherManager from '../weather/weather-manager.mjs';
import { getDefaultZoneConfig } from '../weather/climate-data.mjs';
import { getDefaultMoonPhases } from '../calendar/data/calendar-defaults.mjs';

/**
 * Importer for Simple Timekeeping module data.
 * Live import only - reads directly from STK settings and journal entries.
 * @extends BaseImporter
 */
export default class SimpleTimekeepingImporter extends BaseImporter {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static id = 'simple-timekeeping';
  static label = 'CALENDARIA.Importer.SimpleTimekeeping.Name';
  static icon = 'fa-clock';
  static description = 'CALENDARIA.Importer.SimpleTimekeeping.Description';
  static supportsFileUpload = false;
  static supportsLiveImport = true;
  static moduleId = 'simple-timekeeping';
  static fileExtensions = [];

  /* -------------------------------------------- */
  /*  STK Calendar Data Access                    */
  /* -------------------------------------------- */

  /** @type {object[]|null} Cached STK calendars after dynamic import. */
  static #stkCalendarsCache = null;

  /**
   * Dynamically import STK's calendar definitions.
   * @returns {Promise<object[]|null>} Array of STK calendar configs or null.
   */
  static async importSTKCalendars() {
    // Return cached result if already loaded
    if (this.#stkCalendarsCache) return this.#stkCalendarsCache;

    try {
      // Get the module's script path and import calendars.js
      const module = game.modules.get('simple-timekeeping');
      if (!module?.active) return null;

      const modulePath = `modules/simple-timekeeping/scripts/calendars.js`;
      const { CALENDARS } = await import(`/${modulePath}`);

      if (CALENDARS?.length) {
        log(3, `Imported ${CALENDARS.length} calendars from Simple Timekeeping module`);
        this.#stkCalendarsCache = CALENDARS;
        return CALENDARS;
      }
    } catch (error) {
      log(2, 'Failed to import STK calendars:', error.message);
    }

    return null;
  }

  /**
   * Find a specific STK calendar preset by ID.
   * @param {string} calendarId - The calendar ID to find.
   * @returns {Promise<object|null>} The calendar config or null.
   */
  static async findSTKCalendar(calendarId) {
    const calendars = await this.importSTKCalendars();
    if (!calendars) return null;
    return calendars.find((c) => c.id === calendarId) || null;
  }

  /* -------------------------------------------- */
  /*  Data Loading                                */
  /* -------------------------------------------- */

  /**
   * Load calendar data from installed Simple Timekeeping module.
   * @returns {Promise<object>} Raw STK calendar data
   */
  async loadFromModule() {
    if (!this.constructor.detect()) throw new Error(game.i18n.localize('CALENDARIA.Importer.SimpleTimekeeping.NotInstalled'));

    // Get STK configuration
    const config = game.settings.get('simple-timekeeping', 'configuration');
    if (!config) throw new Error(game.i18n.localize('CALENDARIA.Importer.SimpleTimekeeping.NoConfig'));

    // Resolve calendar data
    let calendarData;
    let isNativeFormat = false;

    if (config.calendar === 'custom' && config.customCalendar) {
      // Custom calendar JSON from settings
      calendarData = JSON.parse(config.customCalendar);
      calendarData._isCustom = true;
      isNativeFormat = true;
    } else {
      // Try to dynamically import preset from STK module
      calendarData = await this.constructor.findSTKCalendar(config.calendar);
      if (calendarData) {
        isNativeFormat = true;
        log(3, `Loaded calendar "${calendarData.name}" from Simple Timekeeping module`);
      } else {
        log(1, `Could not find STK preset: ${config.calendar}`);
      }
    }

    // Resolve moon data - STK native format uses moons.values
    let moons = isNativeFormat ? calendarData.moons?.values || [] : calendarData.moons || [];
    if (config.useCustomMoons && config.customMoons) moons = JSON.parse(config.customMoons);

    // Get events from journal entries with STK flags
    const events = await this.#loadEvents(config);

    // Get scene darkness sync settings
    const sceneDarkness = this.#loadSceneDarknessFlags();

    // Get current weather if set
    const weather = this.#loadWeatherState();

    return { config, calendar: calendarData, moons, events, sceneDarkness, weather, isNativeFormat };
  }

  /**
   * Load events from journal entries with STK flags.
   * @param {object} config - STK configuration
   * @returns {Promise<object[]>} Array of event objects
   */
  async #loadEvents(config) {
    const events = [];

    // STK stores event folder ID in journalEntryEvents setting
    let folderId;
    try {
      folderId = game.settings.get('simple-timekeeping', 'journalEntryEvents');
    } catch {
      log(3, 'No STK events folder setting found');
    }

    // Search all journal entry pages for STK event flags
    for (const journal of game.journal.contents) {
      for (const page of journal.pages.contents) {
        const eventTime = page.getFlag('simple-timekeeping', 'eventTime');
        if (eventTime !== undefined) {
          events.push({
            name: page.name,
            content: page.text?.content || '',
            eventTime,
            eventEnd: page.getFlag('simple-timekeeping', 'eventEnd'),
            repeat: page.getFlag('simple-timekeeping', 'repeat') || '',
            pageId: page.id,
            journalId: journal.id
          });
        }
      }
    }

    log(3, `Found ${events.length} events with STK flags`);
    return events;
  }

  /**
   * Load scene darkness sync flags.
   * @returns {object[]} Array of scene flag objects
   */
  #loadSceneDarknessFlags() {
    const sceneFlags = [];

    for (const scene of game.scenes.contents) {
      const darknessSync = scene.getFlag('simple-timekeeping', 'darknessSync');
      if (darknessSync && darknessSync !== 'default') sceneFlags.push({ sceneId: scene.id, sceneName: scene.name, darknessSync });
    }

    return sceneFlags;
  }

  /**
   * Load current weather state from STK.
   * @returns {object|null} Weather state or null
   */
  #loadWeatherState() {
    try {
      const config = game.settings.get('simple-timekeeping', 'configuration');
      if (config.weatherLabel && config.weatherLabel !== 'Click Me') {
        return {
          label: config.weatherLabel,
          color: config.weatherColor || '#ffffff'
        };
      }
    } catch {
      log(3, 'No STK weather state found');
    }
    return null;
  }

  /* -------------------------------------------- */
  /*  Transformation                              */
  /* -------------------------------------------- */

  /**
   * Transform Simple Timekeeping data into CalendariaCalendar format.
   * @param {object} data - Raw STK data from loadFromModule
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    const { calendar, moons, config, isNativeFormat } = data;

    log(3, 'Transforming Simple Timekeeping data:', calendar.name);

    // Handle native STK format vs legacy format
    const rawWeekdays = isNativeFormat ? calendar.days?.values : calendar.weekdays;
    const rawMonths = isNativeFormat ? calendar.months?.values : calendar.months;

    const weekdays = this.#transformWeekdays(rawWeekdays, isNativeFormat);
    const months = this.#transformMonths(rawMonths, isNativeFormat);

    // Get time config from native format or use defaults
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
    const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
    const daysPerYear = calendar.days?.daysPerYear ?? months.reduce((sum, m) => sum + (m.days || 0), 0);

    // Get seasons from native format
    const seasons = isNativeFormat ? this.#transformSeasons(calendar.seasons?.values) : [];

    return {
      name: calendar.name || 'Imported Calendar',

      // Days configuration
      days: { values: weekdays, hoursPerDay, minutesPerHour, secondsPerMinute, daysPerYear },

      // Months
      months: { values: months },

      // Years configuration
      years: this.#transformYears(calendar, isNativeFormat),

      // Leap year configuration
      leapYearConfig: this.#transformLeapYear(calendar.leapYear ?? calendar.years?.leapYear, isNativeFormat),

      // Moons
      moons: this.#transformMoons(moons),

      // Seasons
      seasons: { values: seasons },

      // Festivals from intercalary months
      festivals: this.#extractFestivals(rawMonths),

      // Metadata
      metadata: {
        description: calendar.description || (calendar._isCustom ? 'Custom calendar imported from Simple Timekeeping' : `Imported from Simple Timekeeping: ${config.calendar}`),
        system: calendar.system || calendar.name || config.calendar,
        importedFrom: 'simple-timekeeping'
      },

      // Weather - default temperate zone
      weather: { activeZone: 'temperate', autoGenerate: false, zones: [getDefaultZoneConfig('temperate')] }
    };
  }

  /* -------------------------------------------- */
  /*  Transform Helpers                           */
  /* -------------------------------------------- */

  /**
   * Transform STK weekdays to Calendaria format.
   * @param {string[]|object[]} weekdays - STK weekday names or objects.
   * @param {boolean} isNativeFormat - Whether data is in native STK format.
   * @returns {object[]} Calendaria weekdays array.
   */
  #transformWeekdays(weekdays = [], isNativeFormat = false) {
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

    // Native STK format already has objects with name, abbreviation, ordinal
    if (isNativeFormat && typeof weekdays[0] === 'object') {
      return weekdays.map((day, index) => ({
        name: this.#localizeString(day.name),
        abbreviation: this.#localizeString(day.abbreviation) || this.#localizeString(day.name).substring(0, 2),
        ordinal: day.ordinal ?? index + 1,
        isRestDay: day.isRestDay || false
      }));
    }

    // Legacy format - array of strings
    return weekdays.map((name, index) => ({ name, abbreviation: name.substring(0, 2), ordinal: index + 1 }));
  }

  /**
   * Transform STK months to Calendaria format.
   * Filters out intercalary months (they become festivals).
   * @param {object[]} months - STK months array.
   * @param {boolean} isNativeFormat - Whether data is in native STK format.
   * @returns {object[]} Calendaria months array.
   */
  #transformMonths(months = [], isNativeFormat = false) {
    return months
      .filter((m) => !m.intercalary)
      .map((month, index) => ({
        name: this.#localizeString(month.name),
        abbreviation: this.#localizeString(month.abbreviation) || this.#localizeString(month.name).substring(0, 3),
        days: month.days,
        leapDays: month.leapDays !== month.days ? month.leapDays : undefined,
        ordinal: month.ordinal ?? index + 1,
        startingWeekday: month.startingWeekday
      }));
  }

  /**
   * Transform STK seasons to Calendaria format.
   * @param {object[]} seasons - STK seasons array.
   * @returns {object[]} Calendaria seasons array.
   */
  #transformSeasons(seasons = []) {
    if (!seasons?.length) return [];

    return seasons.map((season, index) => ({
      name: this.#localizeString(season.name),
      abbreviation: this.#localizeString(season.abbreviation) || this.#localizeString(season.name).substring(0, 3),
      monthStart: season.monthStart,
      monthEnd: season.monthEnd,
      dayStart: season.dayStart,
      dayEnd: season.dayEnd,
      ordinal: index + 1
    }));
  }

  /**
   * Localize a string if it's a localization key.
   * @param {string} str - String that may be a localization key.
   * @returns {string} Localized string or original string.
   */
  #localizeString(str) {
    if (!str) return '';
    // Check if it's a localization key (contains dots like "CALENDAR.GREGORIAN.January")
    if (str.includes('.') && !str.includes(' ')) {
      const localized = game.i18n.localize(str);
      // If localization failed (returned the key), use the last part of the key
      if (localized === str) {
        const parts = str.split('.');
        return parts[parts.length - 1];
      }
      return localized;
    }
    return str;
  }

  /**
   * Transform STK years configuration.
   * @param {object} calendar - STK calendar data.
   * @param {boolean} isNativeFormat - Whether data is in native STK format.
   * @returns {object} Calendaria years config.
   */
  #transformYears(calendar, isNativeFormat = false) {
    const years = isNativeFormat ? calendar.years : calendar;
    return {
      yearZero: years?.yearZero ?? 0,
      firstWeekday: years?.firstWeekday ?? 0
    };
  }

  /**
   * Transform STK leap year config.
   * @param {object} leapYear - STK leap year config.
   * @param {boolean} isNativeFormat - Whether data is in native STK format.
   * @returns {object|null} Calendaria leapYearConfig.
   */
  #transformLeapYear(leapYear, isNativeFormat = false) {
    if (!leapYear) return null;

    // Native STK format uses leapStart and leapInterval
    if (isNativeFormat || leapYear.leapInterval) {
      if (leapYear.leapInterval > 0) {
        return { rule: 'simple', interval: leapYear.leapInterval, start: leapYear.leapStart ?? 0 };
      }
      return null;
    }
    if (leapYear.rule === 'gregorian') return { rule: 'gregorian', start: 0 };
    if (leapYear.rule === 'custom' && leapYear.interval > 0) return { rule: 'simple', interval: leapYear.interval, start: 0 };
    return null;
  }

  /**
   * Transform STK moons to Calendaria format.
   * @param {object[]} moons - STK moons array.
   * @returns {object[]} Calendaria moons array.
   */
  #transformMoons(moons = []) {
    return moons.map((moon) => ({
      name: this.#localizeString(moon.name),
      cycleLength: moon.cycleLength,
      cycleDayAdjust: moon.offset ?? 0,
      phases: getDefaultMoonPhases(),
      referenceDate: { year: 0, month: 0, day: 0 }
    }));
  }

  /**
   * Extract festivals from intercalary months.
   * @param {object[]} months - STK months array.
   * @returns {object[]} Calendaria festivals array.
   */
  #extractFestivals(months = []) {
    const festivals = [];
    let regularMonthIndex = 0;

    for (const month of months) {
      if (month.intercalary) {
        const monthName = this.#localizeString(month.name);
        for (let day = 1; day <= month.days; day++) {
          const festival = { name: month.days === 1 ? monthName : `${monthName} (Day ${day})`, month: regularMonthIndex + 1, day };
          // Handle leap-year-only intercalary days (days: 0, leapDays: 1)
          if (month.leapYearOnly || (month.days === 0 && month.leapDays > 0)) festival.leapYearOnly = true;
          festivals.push(festival);
        }
        // Handle leap-year-only festivals that have 0 days normally
        if (month.days === 0 && month.leapDays > 0) {
          const monthName = this.#localizeString(month.name);
          for (let day = 1; day <= month.leapDays; day++) {
            festivals.push({ name: month.leapDays === 1 ? monthName : `${monthName} (Day ${day})`, month: regularMonthIndex + 1, day, leapYearOnly: true });
          }
        }
      } else {
        regularMonthIndex++;
      }
    }

    return festivals;
  }

  /* -------------------------------------------- */
  /*  Note Extraction                             */
  /* -------------------------------------------- */

  /**
   * Extract notes/events from STK data.
   * @param {object} data - Raw STK data.
   * @returns {Promise<object[]>} Array of note data objects.
   */
  async extractNotes(data) {
    const { events, calendar, isNativeFormat } = data;
    const notes = [];

    log(3, `Extracting ${events.length} events from Simple Timekeeping data`);

    // Calculate seconds per day for timestamp conversion
    const secondsPerDay = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);

    // Get days per year from calendar - handle both native and legacy format
    const months = isNativeFormat ? calendar.months?.values : calendar.months;
    const daysPerYear = calendar.days?.daysPerYear ?? months?.reduce((sum, m) => sum + (m.days || 0), 0) ?? 365;

    for (const event of events) {
      const startDate = this.#timestampToDate(event.eventTime, calendar, secondsPerDay, daysPerYear, isNativeFormat);
      const endDate = event.eventEnd ? this.#timestampToDate(event.eventEnd, calendar, secondsPerDay, daysPerYear, isNativeFormat) : null;

      notes.push({
        name: event.name,
        content: event.content,
        startDate,
        endDate,
        allDay: true,
        repeat: this.#transformRepeatRule(event.repeat),
        originalId: event.pageId,
        suggestedType: event.content?.trim() ? 'note' : 'festival'
      });
    }

    return notes;
  }

  /**
   * Convert STK Unix timestamp to date components.
   * @param {number} timestamp - Unix timestamp in seconds.
   * @param {object} calendar - Calendar data.
   * @param {number} secondsPerDay - Seconds per day.
   * @param {number} daysPerYear - Days per year.
   * @param {boolean} isNativeFormat - Whether data is in native STK format.
   * @returns {object} Date components.
   */
  #timestampToDate(timestamp, calendar, secondsPerDay, daysPerYear, isNativeFormat = false) {
    const totalDays = Math.floor(timestamp / secondsPerDay);
    const timeOfDay = timestamp % secondsPerDay;

    // Calculate year
    let year = Math.floor(totalDays / daysPerYear);
    let dayOfYear = totalDays % daysPerYear;

    // Adjust for negative timestamps
    if (totalDays < 0) {
      year = Math.floor(totalDays / daysPerYear);
      dayOfYear = ((totalDays % daysPerYear) + daysPerYear) % daysPerYear;
    }

    // Find month and day - handle both native and legacy format
    let month = 0;
    let remainingDays = dayOfYear;
    const months = isNativeFormat ? calendar.months?.values : calendar.months;
    const regularMonths = (months || []).filter((m) => !m.intercalary);

    for (let i = 0; i < regularMonths.length; i++) {
      if (remainingDays < regularMonths[i].days) {
        month = i;
        break;
      }
      remainingDays -= regularMonths[i].days;
      month = i + 1;
    }

    // Calculate time
    const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
    const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
    const secondsPerHour = minutesPerHour * secondsPerMinute;
    const hour = Math.floor(timeOfDay / secondsPerHour);
    const minute = Math.floor((timeOfDay % secondsPerHour) / secondsPerMinute);

    return { year, month, day: remainingDays, hour, minute };
  }

  /**
   * Transform STK repeat rule to Calendaria format.
   * @param {string} repeat - STK repeat value
   * @returns {string} Calendaria repeat rule
   */
  #transformRepeatRule(repeat) {
    const rules = { '': 'never', day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' };
    return rules[repeat] || 'never';
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
        const startDate = { ...note.startDate, year: note.startDate.year + yearZero };
        const endDate = note.endDate ? { ...note.endDate, year: note.endDate.year + yearZero } : null;
        const noteData = { startDate, endDate, allDay: note.allDay, repeat: note.repeat };
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
  /*  Scene & Weather Import                      */
  /* -------------------------------------------- */

  /**
   * Import scene darkness sync settings.
   * @param {object[]} sceneFlags - Scene flag data from extraction
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>}
   */
  async importSceneDarkness(sceneFlags) {
    const errors = [];
    let count = 0;

    for (const { sceneId, darknessSync } of sceneFlags) {
      try {
        const scene = game.scenes.get(sceneId);
        if (!scene) continue;

        // Map STK sync modes to Calendaria
        const syncMap = { sync: 'enabled', noSync: 'disabled', weatherOnly: 'disabled', darknessOnly: 'enabled' };
        const calendariaSyncMode = syncMap[darknessSync] || 'default';
        await scene.setFlag('calendaria', 'darknessSync', calendariaSyncMode);
        count++;
      } catch (error) {
        errors.push(`Error setting darkness sync for scene: ${error.message}`);
        log(2, `Error importing scene darkness:`, error);
      }
    }

    return { success: errors.length === 0, count, errors };
  }

  /**
   * Import weather state from STK.
   * @param {object|null} weather - Weather data
   * @returns {Promise<boolean>} Success
   */
  async importWeather(weather) {
    if (!weather?.label) return false;

    try {
      await WeatherManager.setCustomWeather({ label: weather.label, color: weather.color, description: 'Imported from Simple Timekeeping' });
      return true;
    } catch (error) {
      log(2, 'Error importing weather:', error);
      return false;
    }
  }

  /* -------------------------------------------- */
  /*  Preview                                     */
  /* -------------------------------------------- */

  /**
   * Count notes in raw STK data.
   * @param {object} data - Raw STK data
   * @returns {number} Total note count
   */
  #countNotes(data) {
    return data.events?.length || 0;
  }

  /** @override */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    preview.noteCount = this.#countNotes(rawData);
    preview.sceneCount = rawData.sceneDarkness?.length || 0;
    preview.hasWeather = !!rawData.weather;
    return preview;
  }
}
