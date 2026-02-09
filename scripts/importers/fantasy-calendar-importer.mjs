/**
 * Fantasy-Calendar.com Importer
 * Imports calendar data from Fantasy-Calendar.com JSON exports.
 * @module Importers/FantasyCalendarImporter
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { ASSETS } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import BaseImporter from './base-importer.mjs';

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

/** Moon phase names for different granularities. */
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
 * Importer for Fantasy-Calendar.com exports.
 * @extends BaseImporter
 */
export default class FantasyCalendarImporter extends BaseImporter {
  static id = 'fantasy-calendar';
  static label = 'CALENDARIA.Importer.FantasyCalendar.Name';
  static icon = 'fa-globe';
  static description = 'CALENDARIA.Importer.FantasyCalendar.Description';
  static supportsFileUpload = true;
  static supportsLiveImport = false;
  static fileExtensions = ['.json'];

  /**
   * Check if data is a Fantasy-Calendar export.
   * @param {object} data - Parsed JSON data
   * @returns {boolean} - Is Fantasy-Calendar export?
   */
  static isFantasyCalendarExport(data) {
    return !!(data.static_data && data.dynamic_data && data.static_data.year_data);
  }

  /**
   * Transform Fantasy-Calendar data into CalendariaCalendar format.
   * @param {object} data - Raw FC export data
   * @returns {Promise<object>} CalendariaCalendar-compatible data
   */
  async transform(data) {
    if (!FantasyCalendarImporter.isFantasyCalendarExport(data)) throw new Error(localize('CALENDARIA.Importer.FantasyCalendar.InvalidFormat'));
    log(3, 'Transforming Fantasy-Calendar data:', data.name);
    const staticData = data.static_data;
    const yearData = staticData.year_data;
    const timespans = yearData.timespans || [];
    this._categories = this.#buildCategoryMap(data.categories);
    const months = this.#transformMonths(timespans, yearData.leap_days);
    const daysPerYear = months.reduce((sum, m) => sum + (m.days || 0), 0);
    const weekdays = this.#transformWeekdays(yearData.global_week);
    const daysInWeek = weekdays.length || 7;
    const year0FirstWeekday = ((yearData.first_day ?? 1) - 1 + daysInWeek) % daysInWeek;
    log(3, `FC first_day: ${yearData.first_day}, converted firstWeekday: ${year0FirstWeekday}, yearZero: 1`);

    return {
      name: data.name || localize('CALENDARIA.Importer.Fallback.CalendarName'),
      days: { values: weekdays, ...this.#transformTime(staticData.clock), daysPerYear },
      months: { values: months },
      years: { yearZero: 1, firstWeekday: year0FirstWeekday, leapYear: null },
      leapYearConfig: this.#transformLeapDays(yearData.leap_days),
      seasons: { values: this.#transformSeasons(staticData.seasons?.data, timespans) },
      moons: this.#transformMoons(staticData.moons),
      eras: this.#transformEras(staticData.eras),
      cycles: this.#transformCycles(staticData.cycles?.data),
      cycleFormat: staticData.cycles?.format || '',
      daylight: this.#transformDaylight(staticData.seasons?.data),
      metadata: { description: localize('CALENDARIA.Common.ImportedFromFantasyCalendar'), system: data.name || localize('CALENDARIA.Common.Unknown'), importedFrom: 'fantasy-calendar' },
      currentDate: this.#transformCurrentDate(data.dynamic_data)
    };
  }

  /**
   * Extract current date from FC data for preservation after import.
   * @param {object} data - Raw FC data
   * @returns {{year: number, month: number, day: number}|null} Current date
   */
  extractCurrentDate(data) {
    const dynamicData = data.dynamic_data;
    if (!dynamicData || (dynamicData.year === undefined && dynamicData.year !== 0)) return null;
    return { year: dynamicData.year, month: dynamicData.timespan ?? 0, day: dynamicData.day ?? 1, hour: dynamicData.hour ?? 0, minute: dynamicData.minute ?? 0 };
  }

  /**
   * Transform FC dynamic_data to current date.
   * @param {object} dynamicData - FC dynamic_data
   * @returns {object|null} - Current date object or null
   */
  #transformCurrentDate(dynamicData = {}) {
    if (!dynamicData.year && dynamicData.year !== 0) return null;
    return { year: dynamicData.year, month: dynamicData.timespan ?? 0, day: dynamicData.day ?? 1, hour: dynamicData.hour ?? 0, minute: dynamicData.minute ?? 0 };
  }

  /**
   * Transform FC clock to time config.
   * @param {object} clock - FC clock config
   * @returns {object} - Time configuration
   */
  #transformTime(clock = {}) {
    return { hoursPerDay: clock.hours ?? 24, minutesPerHour: clock.minutes ?? 60, secondsPerMinute: 60 };
  }

  /**
   * Transform FC timespans to months.
   * @param {object[]} timespans - FC timespans array
   * @param {object[]} leapDays - FC leap_days array
   * @returns {object[]} - Transformed months array
   */
  #transformMonths(timespans = [], leapDays = []) {
    const leapDaysByMonth = new Map();
    for (const ld of leapDays) {
      if (ld.timespan == null) continue;
      const current = leapDaysByMonth.get(ld.timespan) || 0;
      leapDaysByMonth.set(ld.timespan, current + 1);
    }

    return timespans.map((ts, index) => {
      const extraLeapDays = leapDaysByMonth.get(index) || 0;
      return {
        name: ts.name,
        abbreviation: ts.name.substring(0, 3),
        days: ts.length,
        leapDays: extraLeapDays > 0 ? ts.length + extraLeapDays : null,
        ordinal: index + 1,
        type: ts.type === 'intercalary' ? 'intercalary' : null,
        startingWeekday: null
      };
    });
  }

  /**
   * Transform FC global_week to weekdays.
   * @param {string[]} weekdays - FC weekday names
   * @returns {object[]} - Transformed weekdays array
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

    return weekdays.map((name, index) => ({ name, abbreviation: name.substring(0, 2), ordinal: index + 1 }));
  }

  /**
   * Transform FC leap_days to leapYearConfig.
   * @param {object[]} leapDays - FC leap_days array
   * @returns {object|null} - Leap year configuration or null
   */
  #transformLeapDays(leapDays = []) {
    if (!leapDays.length) return null;
    const ld = leapDays[0];
    const interval = ld.interval;
    if (!interval) return null;
    if (interval === '400,!100,4') {
      return { rule: 'gregorian', start: ld.offset ?? 0 };
    } else if (interval.includes(',') || interval.includes('!')) {
      return { rule: 'custom', pattern: interval, start: ld.offset ?? 0 };
    } else {
      const num = parseInt(interval, 10);
      if (num > 0) return { rule: 'simple', interval: num, start: ld.offset ?? 0 };
    }

    return null;
  }

  /**
   * Transform FC seasons to Calendaria format.
   * @param {object[]} seasons - FC seasons array
   * @param {object[]} timespans - FC timespans for day calculation
   * @returns {object[]} - Transformed seasons array
   */
  #transformSeasons(seasons = [], timespans = []) {
    if (!seasons.length) return [];
    const monthDayStarts = [];
    let dayCount = 0;
    for (const ts of timespans) {
      monthDayStarts.push(dayCount);
      dayCount += ts.length || 0;
    }
    const totalDays = dayCount;
    const sortedSeasons = [...seasons].sort((a, b) => {
      const aDay = (monthDayStarts[a.timespan] ?? 0) + (a.day ?? 0);
      const bDay = (monthDayStarts[b.timespan] ?? 0) + (b.day ?? 0);
      return aDay - bDay;
    });

    return sortedSeasons.map((season, index) => {
      const dayStart = (monthDayStarts[season.timespan] ?? 0) + (season.day ?? 0);
      const nextSeason = sortedSeasons[(index + 1) % sortedSeasons.length];
      let dayEnd = (monthDayStarts[nextSeason.timespan] ?? 0) + (nextSeason.day ?? 0) - 1;
      if (dayEnd < 0) dayEnd = totalDays - 1;
      if (dayEnd < dayStart) dayEnd += totalDays;
      return { name: season.name, dayStart, dayEnd: dayEnd >= totalDays ? dayEnd - totalDays : dayEnd, color: season.color?.[0] || null };
    });
  }

  /**
   * Transform FC moons to Calendaria format.
   * @param {object[]} moons - FC moons array
   * @returns {object[]} - Transformed moons array
   */
  #transformMoons(moons = []) {
    return moons.map((moon) => ({
      name: moon.name,
      cycleLength: moon.cycle,
      cycleDayAdjust: moon.shift ?? 0,
      color: moon.color || '',
      phases: this.#generateMoonPhases(),
      referenceDate: { year: 1, month: 0, day: 1 }
    }));
  }

  /**
   * Generate 8 standard moon phases.
   * Sub-phase names (rising/fading) are left empty to auto-generate from localization.
   * @returns {object[]} - Moon phases array
   */
  #generateMoonPhases() {
    const iconNames = ['01_newmoon', '02_waxingcrescent', '03_firstquarter', '04_waxinggibbous', '05_fullmoon', '06_waninggibbous', '07_lastquarter', '08_waningcrescent'];
    return PHASE_NAMES_8.map((name, i) => ({ name, rising: '', fading: '', icon: `${ASSETS.MOON_ICONS}/${iconNames[i]}.svg`, start: i / 8, end: (i + 1) / 8 }));
  }

  /**
   * Transform FC eras.
   * @param {object[]} eras - FC eras array
   * @returns {object[]} - Transformed eras array
   */
  #transformEras(eras = []) {
    return eras.map((era) => ({
      name: era.name || localize('CALENDARIA.Common.Era'),
      abbreviation: era.abbreviation || era.name?.substring(0, 2) || 'E',
      startYear: era.start ?? 0,
      endYear: era.end ?? null
    }));
  }

  /**
   * Transform FC cycles.
   * @param {object[]} cycles - FC cycles array
   * @returns {object[]} - Transformed cycles array
   */
  #transformCycles(cycles = []) {
    const basedOnMap = { year: 'year', era_year: 'eraYear', month: 'month', day: 'monthDay', epoch: 'day', year_day: 'yearDay' };
    return cycles.map((cycle) => ({
      name: cycle.name || localize('CALENDARIA.Common.Cycle'),
      length: cycle.length || 12,
      offset: cycle.offset ?? 0,
      basedOn: basedOnMap[cycle.type] || 'year',
      stages: (cycle.data || []).map((entry) => ({ name: entry.name || entry }))
    }));
  }

  /**
   * Transform FC season sunrise/sunset to daylight config.
   * @param {object[]} seasons - FC seasons array
   * @returns {object} - Daylight configuration
   */
  #transformDaylight(seasons = []) {
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
    if (shortestDaylight === Infinity || longestDaylight === 0) return { enabled: false };
    return { enabled: true, shortestDay: Math.round(shortestDaylight), longestDay: Math.round(longestDaylight) };
  }

  /**
   * Build category map from FC categories.
   * @param {object[]} categories - FC categories array
   * @returns {Map<string, object>} - Category ID to config map
   */
  #buildCategoryMap(categories = []) {
    const map = new Map();
    for (const cat of categories) {
      map.set(cat.id, { name: cat.name, color: FC_COLORS[cat.event_settings?.color] || '#2196f3', hidden: cat.event_settings?.hide ?? false, gmOnly: cat.category_settings?.hide ?? false });
    }
    return map;
  }

  /**
   * Extract notes from FC events.
   * @param {object} data - Raw FC export data
   * @returns {Promise<object[]>} - Extracted notes array
   */
  async extractNotes(data) {
    const events = data.events || [];
    const notes = [];
    this._undatedEvents = [];
    log(3, `Extracting ${events.length} events from Fantasy-Calendar`);
    for (const event of events) {
      try {
        const conditions = event.data?.conditions || [];
        if (this.#hasOrLogic(conditions)) {
          const splitNotes = this.#splitOrEvent(event, data);
          for (const note of splitNotes) if (note) notes.push(note);
        } else {
          const note = this.#transformEvent(event, data);
          if (note) notes.push(note);
        }
      } catch (error) {
        log(1, `Error transforming event "${event.name}":`, error);
      }
    }

    log(3, `Extracted ${notes.length} notes from Fantasy-Calendar`);
    return notes;
  }

  /**
   * Split an event with OR conditions into multiple notes.
   * @param {object} event - FC event with OR conditions
   * @param {object} data - Full FC data
   * @returns {object[]} Array of note objects
   */
  #splitOrEvent(event, data) {
    const conditions = event.data?.conditions || [];
    const orBranches = this.#extractOrBranches(conditions);
    if (orBranches.length <= 1) {
      const note = this.#transformEvent(event, data);
      return note ? [note] : [];
    }

    log(3, `Splitting event "${event.name}" into ${orBranches.length} notes (OR conditions)`);
    const notes = [];
    for (let i = 0; i < orBranches.length; i++) {
      const branchEvent = { ...event, data: { ...event.data, conditions: orBranches[i] } };
      const note = this.#transformEvent(branchEvent, data);
      if (note) {
        if (orBranches.length > 1) note.name = `${event.name} (${i + 1}/${orBranches.length})`;
        if (note.importWarnings) note.importWarnings = note.importWarnings.filter((w) => !w.includes('OR conditions'));
        notes.push(note);
      }
    }

    return notes;
  }

  /**
   * Extract OR branches from nested conditions.
   * @param {Array} conditions - FC conditions array
   * @returns {Array[]} Array of condition arrays, one per OR branch
   */
  #extractOrBranches(conditions) {
    const branches = [];
    let currentBranch = [];
    const processLevel = (arr) => {
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (item === '||' || (Array.isArray(item) && item[0] === '||')) {
          if (currentBranch.length > 0) {
            branches.push([...currentBranch]);
            currentBranch = [];
          }
        } else if (Array.isArray(item)) {
          if (item.length >= 1 && typeof item[0] === 'string' && item[0] !== '&&' && item[0] !== '') currentBranch.push(item);
          else if (item[0] === '') processLevel(item.slice(1));
          else processLevel(item);
        }
      }
    };

    processLevel(conditions);
    if (currentBranch.length > 0) branches.push(currentBranch);
    return branches.length > 0 ? branches : [conditions];
  }

  /**
   * Transform a single FC event to note format.
   * @param {object} event - FC event
   * @param {object} data - Full FC data (for context)
   * @returns {object|null} - Transformed note or null
   */
  #transformEvent(event, data) {
    const conditions = event.data?.conditions || [];
    const hasDate = Array.isArray(event.data?.date) && event.data.date.length >= 3;
    const hasConditions = conditions.length > 0;
    if (!hasDate && !hasConditions) {
      const category = this._categories?.get(event.event_category_id);
      this._undatedEvents.push({ name: event.name, content: event.description || '', category: category?.name || 'default' });
      return null;
    }

    const eventType = this.#detectEventType(conditions, data);
    if (eventType.warnings?.length) for (const warning of eventType.warnings) log(2, `Event "${event.name}": ${warning}`);
    const category = this._categories?.get(event.event_category_id);
    const gmOnly = event.settings?.hide || category?.gmOnly || false;
    const date = this.#extractDate(event.data, conditions, data);
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

    if (eventType.moonConditions?.length) noteData.moonConditions = eventType.moonConditions;
    if (eventType.randomConfig) noteData.randomConfig = eventType.randomConfig;
    if (event.data?.limited_repeat && event.data?.limited_repeat_num > 0) noteData.maxOccurrences = event.data.limited_repeat_num;
    if (eventType.weekday != null) noteData.weekday = eventType.weekday;
    if (eventType.weekNumber != null) noteData.weekNumber = eventType.weekNumber;
    if (eventType.seasonalConfig) noteData.seasonalConfig = eventType.seasonalConfig;
    const flatConditions = this.#flattenConditions(conditions);
    const extractedConditions = this.#extractConditions(flatConditions, data);
    if (extractedConditions.length > 0) noteData.conditions = extractedConditions;
    if (eventType.warnings?.length) noteData.importWarnings = eventType.warnings;
    return noteData;
  }

  /**
   * Detect event type from FC conditions.
   * @param {Array} conditions - FC conditions array
   * @param {object} data - Full FC data for context (weekday names, etc.)
   * @returns {object} FC event type data
   */
  #detectEventType(conditions, data) {
    const result = { repeat: 'yearly', interval: 1, warnings: [] };
    const flatConditions = this.#flattenConditions(conditions);
    const types = new Set(flatConditions.map((c) => c[0]).filter(Boolean));
    const hasOrLogic = this.#hasOrLogic(conditions);
    if (hasOrLogic) result.warnings.push('Event has OR conditions; importing first date only');
    if (types.has('Random')) {
      const randomCond = flatConditions.find((c) => c[0] === 'Random');
      if (randomCond) {
        result.repeat = 'random';
        result.randomConfig = { probability: parseFloat(randomCond[2]?.[0]) || 10, seed: parseInt(randomCond[2]?.[1]) || Math.floor(Math.random() * 2147483647), checkInterval: 'daily' };
      }
      return result;
    }

    if (types.has('Date') && !types.has('Month') && !types.has('Day')) {
      result.repeat = 'never';
      return result;
    }

    if (types.has('Weekday') && !types.has('Month') && !types.has('Day')) {
      const weekdayCond = flatConditions.find((c) => c[0] === 'Weekday');
      if (weekdayCond) {
        const weekdayName = weekdayCond[2]?.[0];
        const weekdays = data?.static_data?.year_data?.global_week || [];
        const weekdayIndex = weekdays.findIndex((w) => w.toLowerCase() === weekdayName?.toLowerCase());
        result.repeat = 'weekly';
        result.weekday = weekdayIndex >= 0 ? weekdayIndex : 0;
      }
      return result;
    }

    if (types.has('Season') && !types.has('Month') && !types.has('Day')) {
      const seasonCond = flatConditions.find((c) => c[0] === 'Season');
      const conditionType = parseInt(seasonCond?.[1]) || 0;
      const seasonIndex = parseInt(seasonCond?.[2]?.[0]) || 0;
      result.repeat = 'seasonal';
      let trigger = 'entire';
      if (conditionType >= 6 && conditionType <= 9) trigger = 'firstDay';
      result.seasonalConfig = { seasonIndex, trigger };
      return result;
    }

    if (types.has('Weekday')) {
      const weekdayCond = flatConditions.find((c) => c[0] === 'Weekday');
      const conditionType = parseInt(weekdayCond?.[1]) || 0;
      if (conditionType >= 8 && conditionType <= 13) {
        const weekdayName = weekdayCond?.[2]?.[0];
        const weekNumber = parseInt(weekdayCond?.[2]?.[1]) || 1;
        const weekdays = data?.static_data?.year_data?.global_week || [];
        const weekdayIndex = weekdays.findIndex((w) => w.toLowerCase() === weekdayName?.toLowerCase());
        result.repeat = 'weekOfMonth';
        result.weekNumber = weekNumber;
        result.weekday = weekdayIndex >= 0 ? weekdayIndex : 0;
        return result;
      }

      if (conditionType >= 14 && conditionType <= 19) {
        const weekdayName = weekdayCond?.[2]?.[0];
        const inverseNum = parseInt(weekdayCond?.[2]?.[1]) || 1;
        const weekdays = data?.static_data?.year_data?.global_week || [];
        const weekdayIndex = weekdays.findIndex((w) => w.toLowerCase() === weekdayName?.toLowerCase());
        result.repeat = 'weekOfMonth';
        result.weekNumber = -inverseNum;
        result.weekday = weekdayIndex >= 0 ? weekdayIndex : 0;
        return result;
      }
    }

    if (types.has('Week') && !types.has('Day')) {
      const weekCond = flatConditions.find((c) => c[0] === 'Week');
      result.repeat = 'weekOfMonth';
      result.weekNumber = parseInt(weekCond?.[2]?.[0]) || 1;
      if (types.has('Weekday')) {
        const weekdayCond = flatConditions.find((c) => c[0] === 'Weekday');
        const weekdayName = weekdayCond?.[2]?.[0];
        const weekdays = data?.static_data?.year_data?.global_week || [];
        const weekdayIndex = weekdays.findIndex((w) => w.toLowerCase() === weekdayName?.toLowerCase());
        result.weekday = weekdayIndex >= 0 ? weekdayIndex : 0;
      }
      return result;
    }

    if (types.has('Year') && !types.has('Month') && !types.has('Day')) {
      const yearCond = flatConditions.find((c) => c[0] === 'Year');
      const years = yearCond?.[2] || [];
      if (years.length === 1) {
        result.repeat = 'never';
      } else if (years.length > 1) {
        result.warnings.push(`Event spans specific years (${years.join(', ')}); importing for first year only`);
        result.repeat = 'never';
      }
    }

    if (types.has('Moons')) {
      const moonCond = flatConditions.find((c) => c[0] === 'Moons');
      if (moonCond) {
        const moonIndex = parseInt(moonCond[2]?.[0]) || 0;
        const phaseIndex = parseInt(moonCond[2]?.[1]) || 0;
        const granularity = 24;
        result.moonConditions = [{ moonIndex, phaseStart: phaseIndex / granularity, phaseEnd: (phaseIndex + 1) / granularity }];
        if (!types.has('Month') && !types.has('Day')) result.repeat = 'moon';
      }
    }

    if (types.has('Month') && types.has('Day')) result.repeat = 'yearly';
    else if (types.has('Day') && !types.has('Month')) result.repeat = 'monthly';
    return result;
  }

  /**
   * Flatten nested FC conditions to a flat array.
   * @param {Array} conditions - Nested conditions array
   * @returns {Array} Flat array of condition tuples
   */
  #flattenConditions(conditions) {
    const result = [];
    const flatten = (arr) => {
      if (!Array.isArray(arr)) return;
      if (arr.length >= 1 && typeof arr[0] === 'string' && arr[0] !== '&&' && arr[0] !== '||' && arr[0] !== '') result.push(arr);
      else for (const item of arr) if (Array.isArray(item)) flatten(item);
    };
    flatten(conditions);
    return result;
  }

  /**
   * Check if conditions contain OR logic.
   * @param {Array} conditions - FC conditions array
   * @returns {boolean} - Has OR logic?
   */
  #hasOrLogic(conditions) {
    const check = (arr) => {
      if (!Array.isArray(arr)) return false;
      for (const item of arr) {
        if (item === '||') return true;
        if (Array.isArray(item) && item[0] === '||') return true;
        if (Array.isArray(item) && check(item)) return true;
      }
      return false;
    };
    return check(conditions);
  }

  /**
   * Extract advanced conditions from FC flat conditions.
   * Converts FC condition format to Calendaria conditions array.
   * @param {Array} flatConditions - Flattened FC conditions
   * @param {object} data - Full FC data for context
   * @returns {object[]} Array of condition objects
   */
  #extractConditions(flatConditions, data) {
    const conditions = [];
    const weekdays = data?.static_data?.year_data?.global_week || [];
    for (const cond of flatConditions) {
      if (!Array.isArray(cond) || cond.length < 3) continue;
      const [type, typeIndex, values] = cond;
      const ti = parseInt(typeIndex) || 0;
      if (type === 'Date' || type === 'Random') continue;
      switch (type) {
        case 'Year':
          conditions.push(...this.#mapYearCondition(ti, values));
          break;
        case 'Month':
          conditions.push(...this.#mapMonthCondition(ti, values));
          break;
        case 'Day':
          conditions.push(...this.#mapDayCondition(ti, values));
          break;
        case 'Weekday':
          conditions.push(...this.#mapWeekdayCondition(ti, values, weekdays));
          break;
        case 'Week':
          conditions.push(...this.#mapWeekCondition(ti, values));
          break;
        case 'Season':
          conditions.push(...this.#mapSeasonCondition(ti, values));
          break;
        case 'Moons':
          conditions.push(...this.#mapMoonCondition(ti, values));
          break;
        case 'Cycle':
          conditions.push(...this.#mapCycleCondition(ti, values));
          break;
        case 'Era':
          conditions.push(...this.#mapEraCondition(ti, values));
          break;
        case 'Era Year':
          conditions.push(...this.#mapEraYearCondition(ti, values));
          break;
      }
    }

    return conditions;
  }

  /**
   * Map FC Year condition to Calendaria condition format.
   * @param {number} ti - Type index determining comparison operator
   * @param {Array} values - Condition values [year, offset?]
   * @returns {object[]} - Array of condition objects
   */
  #mapYearCondition(ti, values) {
    const ops = ['==', '!=', '>=', '<=', '>', '<', '%'];
    const op = ops[ti] || '==';
    const value = parseInt(values?.[0]) || 0;
    if (op === '%') return [{ field: 'year', op: '%', value, offset: parseInt(values?.[1]) || 0 }];
    return [{ field: 'year', op, value }];
  }

  /**
   * Map FC Month condition to Calendaria condition format.
   * @param {number} ti - Type index determining comparison operator
   * @param {Array} values - Condition values [month, offset?]
   * @returns {object[]} - Array of condition objects
   */
  #mapMonthCondition(ti, values) {
    if (ti <= 6) {
      const ops = ['==', '!=', '>=', '<=', '>', '<', '%'];
      const op = ops[ti] || '==';
      const value = parseInt(values?.[0]) || 0;
      if (op === '%') return [{ field: 'month', op: '%', value, offset: parseInt(values?.[1]) || 0 }];
      return [{ field: 'month', op, value }];
    }
    return [];
  }

  /**
   * Map FC Day condition to Calendaria condition format.
   * Handles day of month, day of year, days before month end, and intercalary checks.
   * @param {number} ti - Type index determining field and comparison operator
   * @param {Array} values - Condition values [day, offset?]
   * @returns {object[]} - Array of condition objects
   */
  #mapDayCondition(ti, values) {
    const value = parseInt(values?.[0]) || 0;

    if (ti <= 6) {
      const ops = ['==', '!=', '>=', '<=', '>', '<', '%'];
      const op = ops[ti] || '==';
      if (op === '%') return [{ field: 'day', op: '%', value, offset: parseInt(values?.[1]) || 0 }];
      return [{ field: 'day', op, value }];
    }

    if (ti >= 7 && ti <= 13) {
      const ops = ['==', '!=', '>=', '<=', '>', '<', '%'];
      const op = ops[ti - 7] || '==';
      if (op === '%') return [{ field: 'dayOfYear', op: '%', value, offset: parseInt(values?.[1]) || 0 }];
      return [{ field: 'dayOfYear', op, value }];
    }

    if (ti >= 14 && ti <= 19) {
      const ops = ['==', '!=', '>=', '<=', '>', '<'];
      const op = ops[ti - 14] || '==';
      return [{ field: 'daysBeforeMonthEnd', op, value }];
    }

    if (ti === 20) return [{ field: 'intercalary', op: '==', value: true }];
    if (ti === 21) return [{ field: 'intercalary', op: '==', value: false }];

    return [];
  }

  /**
   * Map FC Weekday condition to Calendaria condition format.
   * Handles weekday matching, week number in month, and inverse week number.
   * @param {number} ti - Type index determining field and comparison operator
   * @param {Array} values - Condition values [weekdayName, weekNumber?]
   * @param {string[]} weekdays - Calendar weekday names for index lookup
   * @returns {object[]} - Array of condition objects
   */
  #mapWeekdayCondition(ti, values, weekdays) {
    const weekdayName = values?.[0];
    const weekdayIdx = weekdays.findIndex((w) => w.toLowerCase() === weekdayName?.toLowerCase());
    const weekdayValue = weekdayIdx >= 0 ? weekdayIdx : parseInt(values?.[0]) || 0;

    if (ti <= 1) {
      const op = ti === 0 ? '==' : '!=';
      return [{ field: 'weekday', op, value: weekdayValue }];
    }

    if (ti >= 2 && ti <= 7) {
      const ops = ['==', '!=', '>=', '<=', '>', '<'];
      const op = ops[ti - 2] || '==';
      return [{ field: 'weekday', op, value: parseInt(values?.[0]) || 0 }];
    }

    if (ti >= 8 && ti <= 13) {
      const ops = ['==', '!=', '>=', '<=', '>', '<'];
      const op = ops[ti - 8] || '==';
      return [{ field: 'weekNumberInMonth', op, value: parseInt(values?.[1]) || 1 }];
    }

    if (ti >= 14 && ti <= 19) {
      const ops = ['==', '!=', '>=', '<=', '>', '<'];
      const op = ops[ti - 14] || '==';
      return [{ field: 'inverseWeekNumber', op, value: parseInt(values?.[1]) || 1 }];
    }

    return [];
  }

  /**
   * Map FC Week condition to Calendaria condition format.
   * Handles week in month, week in year, weeks before month/year end, and total week.
   * @param {number} ti - Type index determining field and comparison operator
   * @param {Array} values - Condition values [week, offset?]
   * @returns {object[]} - Array of condition objects
   */
  #mapWeekCondition(ti, values) {
    const value = parseInt(values?.[0]) || 0;
    const ops = ['==', '!=', '>=', '<=', '>', '<', '%'];

    if (ti <= 6) {
      const op = ops[ti] || '==';
      if (op === '%') return [{ field: 'weekInMonth', op: '%', value, offset: parseInt(values?.[1]) || 0 }];
      return [{ field: 'weekInMonth', op, value }];
    }

    if (ti >= 7 && ti <= 13) {
      const op = ops[ti - 7] || '==';
      if (op === '%') return [{ field: 'weekInYear', op: '%', value, offset: parseInt(values?.[1]) || 0 }];
      return [{ field: 'weekInYear', op, value }];
    }

    if (ti >= 14 && ti <= 19) {
      const op = ops[ti - 14] || '==';
      return [{ field: 'weeksBeforeMonthEnd', op, value }];
    }

    if (ti >= 20 && ti <= 25) {
      const op = ops[ti - 20] || '==';
      return [{ field: 'weeksBeforeYearEnd', op, value }];
    }

    if (ti >= 26 && ti <= 32) {
      const op = ops[ti - 26] || '==';
      if (op === '%') return [{ field: 'totalWeek', op: '%', value, offset: parseInt(values?.[1]) || 0 }];
      return [{ field: 'totalWeek', op, value }];
    }

    return [];
  }

  /**
   * Map FC Season condition to Calendaria condition format.
   * Handles season index, season percent, season day, and solstice/equinox checks.
   * @param {number} ti - Type index determining field and comparison operator
   * @param {Array} values - Condition values [seasonIndex/value, offset?]
   * @returns {object[]} - Array of condition objects
   */
  #mapSeasonCondition(ti, values) {
    const value = parseInt(values?.[0]) || 0;
    const ops = ['==', '!=', '>=', '<=', '>', '<', '%'];

    if (ti <= 1) {
      const op = ti === 0 ? '==' : '!=';
      return [{ field: 'season', op, value }];
    }

    if (ti >= 2 && ti <= 7) {
      const op = ops[ti - 2] || '==';
      return [{ field: 'seasonPercent', op, value }];
    }

    if (ti >= 8 && ti <= 14) {
      const op = ops[ti - 8] || '==';
      if (op === '%') return [{ field: 'seasonDay', op: '%', value, offset: parseInt(values?.[1]) || 0 }];
      return [{ field: 'seasonDay', op, value }];
    }

    if (ti === 15) return [{ field: 'isLongestDay', op: '==', value: true }];
    if (ti === 16) return [{ field: 'isShortestDay', op: '==', value: true }];
    if (ti === 17) return [{ field: 'isSpringEquinox', op: '==', value: true }];
    if (ti === 18) return [{ field: 'isAutumnEquinox', op: '==', value: true }];

    return [];
  }

  /**
   * Map FC Moons condition to Calendaria condition format.
   * Handles moon phase index, phase count per month, and phase count per year.
   * @param {number} ti - Type index determining field and comparison operator
   * @param {Array} values - Condition values [moonIndex, phaseValue]
   * @returns {object[]} - Array of condition objects
   */
  #mapMoonCondition(ti, values) {
    const moonIdx = parseInt(values?.[0]) || 0;
    const value = parseInt(values?.[1]) || 0;
    const ops = ['==', '!=', '>=', '<=', '>', '<', '%'];

    if (ti <= 6) {
      const op = ops[ti] || '==';
      return [{ field: 'moonPhaseIndex', op, value, value2: moonIdx }];
    }

    if (ti >= 7 && ti <= 13) {
      const op = ops[ti - 7] || '==';
      return [{ field: 'moonPhaseCountMonth', op, value, value2: moonIdx }];
    }

    if (ti >= 14 && ti <= 20) {
      const op = ops[ti - 14] || '==';
      return [{ field: 'moonPhaseCountYear', op, value, value2: moonIdx }];
    }

    return [];
  }

  /**
   * Map FC Cycle condition to Calendaria condition format.
   * @param {number} ti - Type index (0 = equals, 1 = not equals)
   * @param {Array} values - Condition values [cycleIndex, cycleValue]
   * @returns {object[]} - Array of condition objects
   */
  #mapCycleCondition(ti, values) {
    const cycleIdx = parseInt(values?.[0]) || 0;
    const value = parseInt(values?.[1]) || 0;
    const op = ti === 0 ? '==' : '!=';
    return [{ field: 'cycle', op, value, value2: cycleIdx }];
  }

  /**
   * Map FC Era condition to Calendaria condition format.
   * @param {number} ti - Type index (0 = equals, 1 = not equals)
   * @param {Array} values - Condition values [eraIndex]
   * @returns {object[]} - Array of condition objects
   */
  #mapEraCondition(ti, values) {
    const value = parseInt(values?.[0]) || 0;
    const op = ti === 0 ? '==' : '!=';
    return [{ field: 'era', op, value }];
  }

  /**
   * Map FC Era Year condition to Calendaria condition format.
   * @param {number} ti - Type index determining comparison operator
   * @param {Array} values - Condition values [year, offset?]
   * @returns {object[]} - Array of condition objects
   */
  #mapEraYearCondition(ti, values) {
    const value = parseInt(values?.[0]) || 0;
    const ops = ['==', '!=', '>=', '<=', '>', '<', '%'];
    const op = ops[ti] || '==';
    if (op === '%') return [{ field: 'eraYear', op: '%', value, offset: parseInt(values?.[1]) || 0 }];
    return [{ field: 'eraYear', op, value }];
  }

  /**
   * Extract date from FC event data.
   * @param {object} eventData - FC event.data object
   * @param {Array} conditions - FC conditions array (fallback)
   * @param {object} fullData - Full FC export data
   * @returns {{year: number, month: number, day: number}} - Current date
   */
  #extractDate(eventData, conditions, fullData) {
    if (Array.isArray(eventData?.date) && eventData.date.length >= 3) return { year: eventData.date[0], month: eventData.date[1], day: eventData.date[2] };
    const date = { year: fullData.dynamic_data?.year || 0, month: 0, day: 1 };
    for (const cond of conditions) {
      if (!Array.isArray(cond) || cond.length < 3) continue;
      const [type, , values] = cond;
      switch (type) {
        case 'Date':
          date.year = values[0] ?? date.year;
          date.month = values[1] ?? 0;
          date.day = values[2] ?? 1;
          break;
        case 'Month':
          date.month = parseInt(values[0]) || 0;
          break;
        case 'Day':
          date.day = parseInt(values[0]) || 1;
          break;
      }
    }

    return date;
  }

  /**
   * Import notes into Calendaria.
   * @param {object[]} notes - Extracted note data
   * @param {object} options - Import options
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>} - Note objects
   */
  async importNotes(notes, options = {}) {
    const { calendarId } = options;
    const errors = [];
    let count = 0;
    log(3, `Starting note import: ${notes.length} notes to calendar ${calendarId}`);
    const calendar = CalendarManager.getCalendar(calendarId);
    for (const note of notes) {
      try {
        const startDate = { ...note.startDate };
        let endDate = null;
        if (note.duration > 1) endDate = this.#addDaysToDate(startDate, note.duration - 1, calendar);

        const noteData = {
          startDate,
          endDate,
          allDay: true,
          repeat: note.repeat,
          repeatInterval: note.interval,
          moonConditions: note.moonConditions || [],
          randomConfig: note.randomConfig || null,
          maxOccurrences: note.maxOccurrences || 0,
          weekday: note.weekday ?? null,
          weekNumber: note.weekNumber ?? null,
          seasonalConfig: note.seasonalConfig || null,
          conditions: note.conditions || [],
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

    if (this._undatedEvents.length > 0) await this.migrateUndatedEvents(options.calendarName || 'Fantasy-Calendar Import');
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
    const months = calendar?.monthsArray || [];
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

  /** @override */
  getPreviewData(rawData, transformedData) {
    const preview = super.getPreviewData(rawData, transformedData);
    preview.noteCount = rawData.events?.length ?? 0;
    preview.categoryCount = rawData.categories?.length ?? 0;
    preview.hasCycles = (rawData.static_data?.cycles?.data?.length ?? 0) > 0;
    return preview;
  }
}
