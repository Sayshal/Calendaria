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
  /*  STK Calendar Presets                        */
  /* -------------------------------------------- */

  /**
   * Built-in STK calendar preset definitions.
   * These are hardcoded as STK doesn't export preset data.
   * @type {object}
   */
  static STK_PRESETS = {
    harptos: {
      name: 'Harptos (Forgotten Realms)',
      months: [
        { name: 'Hammer', days: 30 },
        { name: 'Midwinter', days: 1, intercalary: true },
        { name: 'Alturiak', days: 30 },
        { name: 'Ches', days: 30 },
        { name: 'Tarsakh', days: 30 },
        { name: 'Greengrass', days: 1, intercalary: true },
        { name: 'Mirtul', days: 30 },
        { name: 'Kythorn', days: 30 },
        { name: 'Flamerule', days: 30 },
        { name: 'Midsummer', days: 1, intercalary: true },
        { name: 'Shieldmeet', days: 1, intercalary: true, leapYearOnly: true },
        { name: 'Eleasis', days: 30 },
        { name: 'Eleint', days: 30 },
        { name: 'Highharvestide', days: 1, intercalary: true },
        { name: 'Marpenoth', days: 30 },
        { name: 'Uktar', days: 30 },
        { name: 'Feast of the Moon', days: 1, intercalary: true },
        { name: 'Nightal', days: 30 }
      ],
      weekdays: ['First-day', 'Second-day', 'Third-day', 'Fourth-day', 'Fifth-day', 'Sixth-day', 'Seventh-day', 'Eighth-day', 'Ninth-day', 'Tenth-day'],
      moons: [{ name: 'Selûne', cycleLength: 30.4375, offset: 0 }],
      leapYear: { rule: 'custom', interval: 4 },
      yearZero: 0
    },
    barovian: {
      name: 'Barovian Calendar (Curse of Strahd)',
      months: [
        { name: 'Month 1', days: 28 },
        { name: 'Month 2', days: 28 },
        { name: 'Month 3', days: 28 },
        { name: 'Month 4', days: 28 },
        { name: 'Month 5', days: 28 },
        { name: 'Month 6', days: 28 },
        { name: 'Month 7', days: 28 },
        { name: 'Month 8', days: 28 },
        { name: 'Month 9', days: 28 },
        { name: 'Month 10', days: 28 },
        { name: 'Month 11', days: 28 },
        { name: 'Month 12', days: 28 },
        { name: 'Last Day', days: 1, intercalary: true }
      ],
      weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      moons: [{ name: 'Moon', cycleLength: 28, offset: 0 }],
      leapYear: null,
      yearZero: 0
    },
    galifar: {
      name: 'Galifar Calendar (Eberron)',
      months: [
        { name: 'Zarantyr', days: 28 },
        { name: 'Olarune', days: 28 },
        { name: 'Therendor', days: 28 },
        { name: 'Eyre', days: 28 },
        { name: 'Dravago', days: 28 },
        { name: 'Nymm', days: 28 },
        { name: 'Lharvion', days: 28 },
        { name: 'Barrakas', days: 28 },
        { name: 'Rhaan', days: 28 },
        { name: 'Sypheros', days: 28 },
        { name: 'Aryth', days: 28 },
        { name: 'Vult', days: 28 }
      ],
      weekdays: ['Sul', 'Mol', 'Zol', 'Wir', 'Zor', 'Far', 'Sar'],
      moons: [
        { name: 'Nymm', cycleLength: 28, offset: 0 },
        { name: 'Sypheros', cycleLength: 35, offset: 0 },
        { name: 'Therendor', cycleLength: 42, offset: 0 },
        { name: 'Rhaan', cycleLength: 49, offset: 0 },
        { name: 'Olarune', cycleLength: 56, offset: 0 },
        { name: 'Eyre', cycleLength: 63, offset: 0 },
        { name: 'Lharvion', cycleLength: 70, offset: 0 },
        { name: 'Barrakas', cycleLength: 77, offset: 0 },
        { name: 'Zarantyr', cycleLength: 84, offset: 0 },
        { name: 'Aryth', cycleLength: 91, offset: 0 },
        { name: 'Vult', cycleLength: 98, offset: 0 },
        { name: 'Dravago', cycleLength: 105, offset: 0 }
      ],
      leapYear: null,
      yearZero: 0
    },
    gregorian: {
      name: 'Gregorian Calendar',
      months: [
        { name: 'January', days: 31 },
        { name: 'February', days: 28, leapDays: 29 },
        { name: 'March', days: 31 },
        { name: 'April', days: 30 },
        { name: 'May', days: 31 },
        { name: 'June', days: 30 },
        { name: 'July', days: 31 },
        { name: 'August', days: 31 },
        { name: 'September', days: 30 },
        { name: 'October', days: 31 },
        { name: 'November', days: 30 },
        { name: 'December', days: 31 }
      ],
      weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      moons: [{ name: 'Luna', cycleLength: 29.53059, offset: 0 }],
      leapYear: { rule: 'gregorian' },
      yearZero: 0
    },
    golarion: {
      name: 'Golarion Calendar (Pathfinder)',
      months: [
        { name: 'Abadius', days: 31 },
        { name: 'Calistril', days: 28 },
        { name: 'Pharast', days: 31 },
        { name: 'Gozran', days: 30 },
        { name: 'Desnus', days: 31 },
        { name: 'Sarenith', days: 30 },
        { name: 'Erastus', days: 31 },
        { name: 'Arodus', days: 31 },
        { name: 'Rova', days: 30 },
        { name: 'Lamashan', days: 31 },
        { name: 'Neth', days: 30 },
        { name: 'Kuthona', days: 31 }
      ],
      weekdays: ['Moonday', 'Toilday', 'Wealday', 'Oathday', 'Fireday', 'Starday', 'Sunday'],
      moons: [{ name: 'Somal', cycleLength: 29.5, offset: 0 }],
      leapYear: { rule: 'custom', interval: 8 },
      yearZero: 0
    },
    exandrian: {
      name: 'Exandrian Calendar (Critical Role)',
      months: [
        { name: 'Horisal', days: 29 },
        { name: 'Misuthar', days: 30 },
        { name: 'Dualahei', days: 30 },
        { name: 'Thunsheer', days: 31 },
        { name: 'Unndilar', days: 28 },
        { name: 'Brussendar', days: 31 },
        { name: 'Sydenstar', days: 32 },
        { name: 'Fessuran', days: 29 },
        { name: 'Quen\'pillar', days: 27 },
        { name: 'Cuersaar', days: 29 },
        { name: 'Duscar', days: 32 }
      ],
      weekdays: ['Miresen', 'Grissen', 'Whelsen', 'Conthsen', 'Folsen', 'Yulisen', 'Da\'leysen'],
      moons: [{ name: 'Catha', cycleLength: 33, offset: 0 }, { name: 'Ruidus', cycleLength: 328, offset: 0 }],
      leapYear: null,
      yearZero: 0
    }
    // Additional presets can be added as needed
  };

  /* -------------------------------------------- */
  /*  Data Loading                                */
  /* -------------------------------------------- */

  /**
   * Load calendar data from installed Simple Timekeeping module.
   * @returns {Promise<object>} Raw STK calendar data
   */
  async loadFromModule() {
    if (!this.constructor.detect()) {
      throw new Error(game.i18n.localize('CALENDARIA.Importer.SimpleTimekeeping.NotInstalled'));
    }

    // Get STK configuration
    const config = game.settings.get('simple-timekeeping', 'configuration');
    if (!config) {
      throw new Error(game.i18n.localize('CALENDARIA.Importer.SimpleTimekeeping.NoConfig'));
    }

    // Resolve calendar data
    let calendarData;
    if (config.calendar === 'custom' && config.customCalendar) {
      calendarData = JSON.parse(config.customCalendar);
      calendarData._isCustom = true;
    } else {
      calendarData = this.constructor.STK_PRESETS[config.calendar];
      if (!calendarData) {
        log(2, `Unknown STK preset: ${config.calendar}, using generic data`);
        calendarData = this.#buildGenericCalendar(config);
      }
    }

    // Resolve moon data
    let moons = calendarData.moons || [];
    if (config.useCustomMoons && config.customMoons) {
      moons = JSON.parse(config.customMoons);
    }

    // Get events from journal entries with STK flags
    const events = await this.#loadEvents(config);

    // Get scene darkness sync settings
    const sceneDarkness = this.#loadSceneDarknessFlags();

    // Get current weather if set
    const weather = this.#loadWeatherState();

    return {
      config,
      calendar: calendarData,
      moons,
      events,
      sceneDarkness,
      weather
    };
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
      if (darknessSync && darknessSync !== 'default') {
        sceneFlags.push({
          sceneId: scene.id,
          sceneName: scene.name,
          darknessSync
        });
      }
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

  /**
   * Build a generic calendar from STK config when preset not found.
   * @param {object} config - STK configuration
   * @returns {object} Generic calendar data
   */
  #buildGenericCalendar(config) {
    return {
      name: config.calendar || 'Imported Calendar',
      months: [
        { name: 'Month 1', days: 30 },
        { name: 'Month 2', days: 30 },
        { name: 'Month 3', days: 30 },
        { name: 'Month 4', days: 30 },
        { name: 'Month 5', days: 30 },
        { name: 'Month 6', days: 30 },
        { name: 'Month 7', days: 30 },
        { name: 'Month 8', days: 30 },
        { name: 'Month 9', days: 30 },
        { name: 'Month 10', days: 30 },
        { name: 'Month 11', days: 30 },
        { name: 'Month 12', days: 30 }
      ],
      weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      moons: [],
      leapYear: null,
      yearZero: 0
    };
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
    const { calendar, moons, config } = data;

    log(3, 'Transforming Simple Timekeeping data:', calendar.name);

    const weekdays = this.#transformWeekdays(calendar.weekdays);
    const months = this.#transformMonths(calendar.months);
    const daysPerYear = months.reduce((sum, m) => sum + (m.days || 0), 0);

    return {
      name: calendar.name || 'Imported Calendar',

      // Days configuration
      days: {
        values: weekdays,
        hoursPerDay: 24,
        minutesPerHour: 60,
        secondsPerMinute: 60,
        daysPerYear
      },

      // Months
      months: { values: months },

      // Years configuration
      years: this.#transformYears(calendar),

      // Leap year configuration
      leapYearConfig: this.#transformLeapYear(calendar.leapYear),

      // Moons
      moons: this.#transformMoons(moons),

      // Festivals from intercalary months
      festivals: this.#extractFestivals(calendar.months),

      // Metadata
      metadata: {
        description: calendar._isCustom
          ? 'Custom calendar imported from Simple Timekeeping'
          : `Imported from Simple Timekeeping: ${config.calendar}`,
        system: calendar.name || config.calendar,
        importedFrom: 'simple-timekeeping'
      },

      // Weather - default temperate zone
      weather: {
        activeZone: 'temperate',
        autoGenerate: false,
        zones: [getDefaultZoneConfig('temperate')]
      }
    };
  }

  /* -------------------------------------------- */
  /*  Transform Helpers                           */
  /* -------------------------------------------- */

  /**
   * Transform STK weekdays to Calendaria format.
   * @param {string[]} weekdays - STK weekday names
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

    return weekdays.map((name, index) => ({
      name,
      abbreviation: name.substring(0, 2),
      ordinal: index + 1
    }));
  }

  /**
   * Transform STK months to Calendaria format.
   * Filters out intercalary months (they become festivals).
   * @param {object[]} months - STK months array
   * @returns {object[]} Calendaria months array
   */
  #transformMonths(months = []) {
    return months
      .filter((m) => !m.intercalary)
      .map((month, index) => ({
        name: month.name,
        abbreviation: month.name.substring(0, 3),
        days: month.days,
        leapDays: month.leapDays !== month.days ? month.leapDays : undefined,
        ordinal: index + 1
      }));
  }

  /**
   * Transform STK years configuration.
   * @param {object} calendar - STK calendar data
   * @returns {object} Calendaria years config
   */
  #transformYears(calendar) {
    return {
      yearZero: calendar.yearZero ?? 0,
      firstWeekday: 0
    };
  }

  /**
   * Transform STK leap year config.
   * @param {object} leapYear - STK leap year config
   * @returns {object|null} Calendaria leapYearConfig
   */
  #transformLeapYear(leapYear) {
    if (!leapYear) return null;

    if (leapYear.rule === 'gregorian') {
      return { rule: 'gregorian', start: 0 };
    }

    if (leapYear.rule === 'custom' && leapYear.interval > 0) {
      return {
        rule: 'simple',
        interval: leapYear.interval,
        start: 0
      };
    }

    return null;
  }

  /**
   * Transform STK moons to Calendaria format.
   * @param {object[]} moons - STK moons array
   * @returns {object[]} Calendaria moons array
   */
  #transformMoons(moons = []) {
    return moons.map((moon) => ({
      name: moon.name,
      cycleLength: moon.cycleLength,
      cycleDayAdjust: moon.offset ?? 0,
      phases: this.#getDefaultMoonPhases(moon.cycleLength),
      referenceDate: { year: 0, month: 0, day: 0 }
    }));
  }

  /**
   * Generate default 8-phase moon configuration.
   * @param {number} cycleLength - Moon cycle length
   * @returns {object[]} Moon phases array
   */
  #getDefaultMoonPhases(cycleLength) {
    const basePath = 'modules/calendaria/assets/moon-phases';
    const phases = [
      { name: 'New Moon', icon: `${basePath}/01_newmoon.svg` },
      { name: 'Waxing Crescent', icon: `${basePath}/02_waxingcrescent.svg` },
      { name: 'First Quarter', icon: `${basePath}/03_firstquarter.svg` },
      { name: 'Waxing Gibbous', icon: `${basePath}/04_waxinggibbous.svg` },
      { name: 'Full Moon', icon: `${basePath}/05_fullmoon.svg` },
      { name: 'Waning Gibbous', icon: `${basePath}/06_waninggibbous.svg` },
      { name: 'Last Quarter', icon: `${basePath}/07_lastquarter.svg` },
      { name: 'Waning Crescent', icon: `${basePath}/08_waningcrescent.svg` }
    ];

    return phases.map((phase, index) => ({
      ...phase,
      start: index / 8,
      end: (index + 1) / 8
    }));
  }

  /**
   * Extract festivals from intercalary months.
   * @param {object[]} months - STK months array
   * @returns {object[]} Calendaria festivals array
   */
  #extractFestivals(months = []) {
    const festivals = [];
    let regularMonthIndex = 0;

    for (const month of months) {
      if (month.intercalary) {
        for (let day = 1; day <= month.days; day++) {
          const festival = {
            name: month.days === 1 ? month.name : `${month.name} (Day ${day})`,
            month: regularMonthIndex + 1,
            day
          };
          if (month.leapYearOnly) festival.leapYearOnly = true;
          festivals.push(festival);
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
   * @param {object} data - Raw STK data
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    const { events, calendar } = data;
    const notes = [];

    log(3, `Extracting ${events.length} events from Simple Timekeeping data`);

    // Calculate seconds per day for timestamp conversion
    const secondsPerDay = 24 * 60 * 60;

    // Get days per year from calendar
    const daysPerYear = calendar.months.reduce((sum, m) => sum + (m.days || 0), 0);

    for (const event of events) {
      const startDate = this.#timestampToDate(event.eventTime, calendar, secondsPerDay, daysPerYear);
      const endDate = event.eventEnd ? this.#timestampToDate(event.eventEnd, calendar, secondsPerDay, daysPerYear) : null;

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
   * @param {number} timestamp - Unix timestamp in seconds
   * @param {object} calendar - Calendar data
   * @param {number} secondsPerDay - Seconds per day
   * @param {number} daysPerYear - Days per year
   * @returns {object} Date components
   */
  #timestampToDate(timestamp, calendar, secondsPerDay, daysPerYear) {
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

    // Find month and day
    let month = 0;
    let remainingDays = dayOfYear;
    const regularMonths = calendar.months.filter((m) => !m.intercalary);

    for (let i = 0; i < regularMonths.length; i++) {
      if (remainingDays < regularMonths[i].days) {
        month = i;
        break;
      }
      remainingDays -= regularMonths[i].days;
      month = i + 1;
    }

    // Calculate time
    const hour = Math.floor(timeOfDay / 3600);
    const minute = Math.floor((timeOfDay % 3600) / 60);

    return {
      year,
      month,
      day: remainingDays,
      hour,
      minute
    };
  }

  /**
   * Transform STK repeat rule to Calendaria format.
   * @param {string} repeat - STK repeat value
   * @returns {string} Calendaria repeat rule
   */
  #transformRepeatRule(repeat) {
    const rules = {
      '': 'never',
      day: 'daily',
      week: 'weekly',
      month: 'monthly',
      year: 'yearly'
    };
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

        const noteData = {
          startDate,
          endDate,
          allDay: note.allDay,
          repeat: note.repeat
        };

        const page = await NoteManager.createNote({
          name: note.name,
          content: note.content || '',
          noteData,
          calendarId
        });

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
        const syncMap = {
          sync: 'enabled',
          noSync: 'disabled',
          weatherOnly: 'disabled',
          darknessOnly: 'enabled'
        };

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
      await WeatherManager.setCustomWeather({
        label: weather.label,
        color: weather.color,
        description: 'Imported from Simple Timekeeping'
      });
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
