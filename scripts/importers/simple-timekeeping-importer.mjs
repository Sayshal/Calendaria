import { CalendarManager } from '../calendar/_module.mjs';
import { DEFAULT_MOON_PHASES } from '../constants.mjs';
import { NoteManager } from '../notes/_module.mjs';
import { format, localize, log } from '../utils/_module.mjs';
import { WeatherManager, getDefaultZoneConfig } from '../weather/_module.mjs';
import BaseImporter from './base-importer.mjs';

/**
 * Self-contained Foundry macro that exports STK data with pre-converted dates.
 */
const STK_EXPORT_MACRO = `// Calendaria - Simple Timekeeping Export Macro
// Run with Simple Timekeeping ENABLED and Calendaria DISABLED.
// Saves STK calendar, events, and current date to a JSON file you can
// then upload via Calendaria's Simple Timekeeping importer.
(async () => {
  if (!game.modules.get('simple-timekeeping')?.active) {
    ui.notifications.error('Simple Timekeeping is not active. Enable it before running this macro.');
    return;
  }
  if (typeof game.time?.calendar?.timeToComponents !== 'function') {
    ui.notifications.error('STK calendar not available on game.time.calendar.');
    return;
  }
  const config = game.settings.get('simple-timekeeping', 'configuration');
  if (!config) {
    ui.notifications.error('No Simple Timekeeping configuration found.');
    return;
  }
  const calendar = game.time.calendar.toObject();
  // Build month index map: original index -> regular-month index (intercalary skipped).
  const monthList = calendar.months?.values || [];
  const monthIndexMap = {};
  let regIdx = 0;
  for (let i = 0; i < monthList.length; i++) if (!monthList[i].intercalary) monthIndexMap[i] = regIdx++;
  for (let i = 0; i < monthList.length; i++) {
    if (!monthList[i].intercalary) continue;
    let next = i + 1;
    while (next < monthList.length && monthList[next].intercalary) next++;
    monthIndexMap[i] = next < monthList.length ? monthIndexMap[next] : Math.max(0, regIdx - 1);
  }
  const remapDate = (d) => {
    if (!d) return null;
    return {year: d.year ?? 0,month: monthIndexMap[d.month] ?? 0,dayOfMonth: d.dayOfMonth ?? 0,hour: d.hour ?? 0,minute: d.minute ?? 0};
  };

  // Custom moons override (stored in STK config rather than the calendar).
  let moons = calendar.moons?.values ?? calendar.moons ?? [];
  if (config.useCustomMoons && config.customMoons) try { moons = JSON.parse(config.customMoons); } catch (e) { console.warn('STK export: failed to parse custom moons', e); }
  // Events from journal page flags, with pre-converted date components.
  const events = [];
  for (const journal of game.journal.contents) {
    for (const page of journal.pages.contents) {
      const eventTime = page.getFlag('simple-timekeeping', 'eventTime');
      if (eventTime === undefined) continue;
      const eventEnd = page.getFlag('simple-timekeeping', 'eventEnd');
      events.push({
        name: page.name,
        content: page.text?.content || '',
        eventTime,
        eventEnd: eventEnd ?? null,
        repeat: page.getFlag('simple-timekeeping', 'repeat') || '',
        pageId: page.id,
        journalId: journal.id,
        startDate: remapDate(game.time.calendar.timeToComponents(eventTime)),
        endDate: eventEnd ? remapDate(game.time.calendar.timeToComponents(eventEnd)) : null
      });
    }
  }

  // Scene darkness sync flags.
  const sceneDarkness = [];
  for (const scene of game.scenes.contents) {
    const darknessSync = scene.getFlag('simple-timekeeping', 'darknessSync');
    if (darknessSync && darknessSync !== 'default') sceneDarkness.push({ sceneId: scene.id, sceneName: scene.name, darknessSync });
  }
  // Weather state.
  const weather = (config.weatherLabel && config.weatherLabel !== 'Click Me')
    ? { label: config.weatherLabel, color: config.weatherColor || '#ffffff' }
    : null;
  // Current world date.
  const worldTime = game.time.worldTime;
  const currentDate = remapDate(game.time.calendar.timeToComponents(worldTime));
  const exportData = {
    _calendariaImport: 'simple-timekeeping',
    _version: 1,
    _exportedAt: new Date().toISOString(),
    config,
    calendar,
    moons,
    events,
    sceneDarkness,
    weather,
    worldTime,
    currentDate
  };
  const safeName = (calendar.name || 'stk-export').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = 'stk-export-' + safeName + '-' + Date.now() + '.json';
  foundry.utils.saveDataToFile(JSON.stringify(exportData, null, 2), 'application/json', filename);
  ui.notifications.info('Exported ' + events.length + ' STK events to ' + filename);
})();
`;

/**
 * Importer for Simple Timekeeping module data.
 * @extends BaseImporter
 */
export default class SimpleTimekeepingImporter extends BaseImporter {
  static id = 'simple-timekeeping';
  static label = 'CALENDARIA.Importer.SimpleTimekeeping.Name';
  static icon = 'fa-clock';
  static description = 'CALENDARIA.Importer.SimpleTimekeeping.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = false;
  static moduleId = 'simple-timekeeping';
  static fileExtensions = ['.json'];

  /** @type {string} The macro source users run with STK enabled to produce the import file. */
  static exportMacro = STK_EXPORT_MACRO;

  /** @type {string} Localization key for instructions panel rendered in the importer UI. */
  static instructions = 'CALENDARIA.Importer.SimpleTimekeeping.Instructions';

  /**
   * Parse and validate an STK macro export JSON file.
   * @param {File} file - Uploaded JSON file from the export macro
   * @returns {Promise<object>} Parsed export payload
   */
  async parseFile(file) {
    const data = await super.parseFile(file);
    if (data?._calendariaImport !== 'simple-timekeeping') throw new Error(localize('CALENDARIA.Importer.SimpleTimekeeping.InvalidFile'));

    return data;
  }

  /**
   * Extract current date from macro export.
   * @param {object} data - Parsed export payload
   * @returns {{year: number, month: number, dayOfMonth: number, hour: number, minute: number}|null} Pre-converted date components or null
   */
  extractCurrentDate(data) {
    return data?.currentDate ?? null;
  }

  /**
   * Transform macro export data into CalendariaCalendar format.
   * @param {object} data - Parsed export payload
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    const { calendar, moons, config } = data;
    log(3, 'Transforming Simple Timekeeping export:', calendar?.name);
    const rawWeekdays = calendar?.days?.values ? Object.values(calendar.days.values) : [];
    const rawMonths = calendar?.months?.values ? Object.values(calendar.months.values) : [];
    const weekdays = this.#transformWeekdays(rawWeekdays);
    const months = this.#transformMonths(rawMonths);
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
    const secondsPerMinute = calendar?.days?.secondsPerMinute ?? 60;
    const daysPerYear = calendar?.days?.daysPerYear ?? months.reduce((sum, m) => sum + (m.days || 0), 0);
    const seasons = calendar?.seasons?.values ? Object.values(calendar.seasons.values) : [];
    const transformedSeasons = this.#transformSeasons(seasons, config);
    return {
      name: calendar?.name || 'Imported Calendar',
      days: { values: weekdays, hoursPerDay, minutesPerHour, secondsPerMinute, daysPerYear },
      months: { values: months },
      years: this.#transformYears(calendar),
      leapYearConfig: this.#transformLeapYear(calendar?.years?.leapYear ?? calendar?.leapYear),
      moons: this.#transformMoons(moons),
      seasons: { values: transformedSeasons },
      festivals: this.#extractFestivals(rawMonths),
      metadata: {
        description: calendar?.description || format('CALENDARIA.Importer.ImportedFrom.SimpleTimekeeping', { name: calendar?.name || config?.calendar || '' }),
        system: calendar?.system || calendar?.name || config?.calendar,
        importedFrom: 'simple-timekeeping'
      },
      weather: { activeZone: 'temperate', zones: [getDefaultZoneConfig('temperate')] }
    };
  }

  /**
   * Transform STK weekdays to Calendaria format.
   * @param {object[]} weekdays - STK weekday objects
   * @returns {object[]} Calendaria weekdays array
   */
  #transformWeekdays(weekdays = []) {
    if (!weekdays.length) {
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
      name: this.#localizeString(day.name),
      abbreviation: this.#localizeString(day.abbreviation) || this.#localizeString(day.name).substring(0, 2),
      ordinal: day.ordinal ?? index + 1,
      isRestDay: day.isRestDay || false
    }));
  }

  /**
   * Transform STK months to Calendaria format, dropping intercalary months
   * (they become festivals via #extractFestivals).
   * @param {object[]} months - STK months array
   * @returns {object[]} Calendaria months array
   */
  #transformMonths(months = []) {
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
   * @param {object[]} seasons - STK seasons array
   * @param {object} config - STK configuration with season colors
   * @returns {object[]} Calendaria seasons array
   */
  #transformSeasons(seasons = [], config = {}) {
    if (!seasons.length) return [];
    const seasonColors = [config.season0, config.season1, config.season2, config.season3].filter(Boolean);
    return seasons.map((season, index) => ({
      name: this.#localizeString(season.name),
      abbreviation: this.#localizeString(season.abbreviation) || this.#localizeString(season.name).substring(0, 3),
      monthStart: season.monthStart,
      monthEnd: season.monthEnd,
      dayStart: season.dayStart,
      dayEnd: season.dayEnd,
      color: seasonColors[index] || '',
      ordinal: index + 1
    }));
  }

  /**
   * Localize a string if it's a localization key, falling back to the trailing segment.
   * @param {string} str - String that may be a localization key
   * @returns {string} Localized string or original
   */
  #localizeString(str) {
    if (!str) return '';
    if (str.includes('.') && !str.includes(' ')) {
      const localized = localize(str);
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
   * @param {object} calendar - STK calendar
   * @returns {object} Calendaria years config
   */
  #transformYears(calendar) {
    const years = calendar?.years ?? calendar;
    return { yearZero: years?.yearZero ?? 0, firstWeekday: years?.firstWeekday ?? 0 };
  }

  /**
   * Transform STK leap year config.
   * @param {object} leapYear - STK leap year config
   * @returns {object|null} Calendaria leapYearConfig
   */
  #transformLeapYear(leapYear) {
    if (!leapYear) return null;
    if (leapYear.leapInterval > 0) return { rule: 'simple', interval: leapYear.leapInterval, start: leapYear.leapStart ?? 0 };
    if (leapYear.rule === 'gregorian') return { rule: 'gregorian', start: 0 };
    if (leapYear.rule === 'custom' && leapYear.interval > 0) return { rule: 'simple', interval: leapYear.interval, start: 0 };
    return null;
  }

  /**
   * Transform STK moons to Calendaria format.
   * @param {object[]} moons - STK moons array
   * @returns {object[]} Calendaria moons array
   */
  #transformMoons(moons = []) {
    return moons.map((moon) => ({
      name: this.#localizeString(moon.name),
      cycleLength: moon.cycleLength,
      cycleDayAdjust: moon.offset ?? 0,
      phases: this.#buildMoonPhases(moon.phaseNames),
      referenceDate: { year: 0, month: 0, dayOfMonth: 0 }
    }));
  }

  /**
   * Build moon phases, mapping custom STK phase names if provided.
   * @param {string[]} [phaseNames] - Optional array of phase name strings
   * @returns {object} Keyed phases object matching Calendaria format
   */
  #buildMoonPhases(phaseNames) {
    if (!phaseNames?.length) return DEFAULT_MOON_PHASES;
    const keys = Object.keys(DEFAULT_MOON_PHASES);
    const phases = {};
    for (let i = 0; i < keys.length; i++) {
      const base = DEFAULT_MOON_PHASES[keys[i]];
      phases[keys[i]] = { ...base, name: phaseNames[i] ? this.#localizeString(phaseNames[i]) : base.name };
    }
    return phases;
  }

  /**
   * Extract festivals from intercalary months.
   * @param {object[]} months - STK months array (full, with intercalary)
   * @returns {object[]} Calendaria festivals array
   */
  #extractFestivals(months = []) {
    const festivals = [];
    let lastRegularMonthIndex = 0;
    let regularCount = 0;
    for (const month of months) {
      if (month.intercalary) {
        const monthName = this.#localizeString(month.name);
        const targetMonth = regularCount > 0 ? lastRegularMonthIndex : 0;
        for (let day = 0; day < month.days; day++) {
          const festival = { name: month.days === 1 ? monthName : `${monthName} (Day ${day + 1})`, month: targetMonth, dayOfMonth: day, countsForWeekday: false };
          if (month.leapYearOnly || (month.days === 0 && month.leapDays > 0)) festival.leapYearOnly = true;
          festivals.push(festival);
        }
        if (month.days === 0 && month.leapDays > 0) {
          for (let day = 0; day < month.leapDays; day++) {
            festivals.push({ name: month.leapDays === 1 ? monthName : `${monthName} (Day ${day + 1})`, month: targetMonth, dayOfMonth: day, leapYearOnly: true, countsForWeekday: false });
          }
        }
      } else {
        lastRegularMonthIndex = regularCount;
        regularCount++;
      }
    }
    return festivals;
  }

  /**
   * Extract notes/events from macro export.
   * @param {object} data - Parsed export payload
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    const events = data?.events ?? [];
    log(3, `Extracting ${events.length} STK events from macro export`);
    return events.map((event) => ({
      name: event.name,
      content: event.content,
      startDate: event.startDate,
      endDate: event.endDate,
      allDay: true,
      repeat: this.#transformRepeatRule(event.repeat),
      originalId: event.pageId,
      suggestedType: event.content?.trim() ? 'note' : 'festival'
    }));
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
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>} Import result with count and errors
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
        if (page) count++;
        else errors.push(`Failed to create note: ${note.name}`);
      } catch (error) {
        errors.push(`Error creating note "${note.name}": ${error.message}`);
        log(1, `Error importing note "${note.name}":`, error);
      }
    }
    log(3, `Note import complete: ${count}/${notes.length} imported, ${errors.length} errors`);
    return { success: errors.length === 0, count, errors };
  }

  /**
   * Import scene darkness sync settings from macro export.
   * @param {object[]} sceneFlags - Scene flag data
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>} Import result with count and errors
   */
  async importSceneDarkness(sceneFlags) {
    const errors = [];
    let count = 0;
    for (const { sceneId, darknessSync } of sceneFlags) {
      try {
        const scene = game.scenes.get(sceneId);
        if (!scene) continue;
        const syncMap = { sync: 'enabled', noSync: 'disabled', weatherOnly: 'disabled', darknessOnly: 'enabled' };
        const calendariaSyncMode = syncMap[darknessSync] || 'default';
        await scene.setFlag('calendaria', 'darknessSync', calendariaSyncMode);
        count++;
      } catch (error) {
        errors.push(`Error setting darkness sync for scene: ${error.message}`);
        log(1, `Error importing scene darkness:`, error);
      }
    }
    return { success: errors.length === 0, count, errors };
  }

  /**
   * Import weather state from macro export.
   * @param {object|null} weather - Weather data
   * @returns {Promise<boolean>} Success
   */
  async importWeather(weather) {
    if (!weather?.label) return false;
    try {
      await WeatherManager.setCustomWeather({ label: weather.label, color: weather.color, description: localize('CALENDARIA.Importer.ImportedFrom.SimpleTimekeepingCustom') });
      return true;
    } catch (error) {
      log(1, 'Error importing weather:', error);
      return false;
    }
  }

  /**
   * Count notes in macro export data.
   * @param {object} data - Parsed export payload
   * @returns {number} Total note count
   */
  #countNotes(data) {
    return data?.events?.length || 0;
  }

  /**
   * Generate preview data with STK-specific scene and weather info.
   * @param {object} rawData - Parsed export payload
   * @param {object} transformedData - Transformed calendar data
   * @returns {object} Preview data with additional STK-specific fields
   */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    preview.noteCount = this.#countNotes(rawData);
    preview.sceneCount = rawData?.sceneDarkness?.length || 0;
    preview.hasWeather = !!rawData?.weather;
    return preview;
  }
}
