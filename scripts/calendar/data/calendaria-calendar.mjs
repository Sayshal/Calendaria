/**
 * Extended calendar data model with Calendaria-specific features.
 * System-agnostic calendar that extends Foundry's base CalendarData.
 * @extends foundry.data.CalendarData
 * @module Calendar/Data/CalendariaCalendar
 * @author Tyler
 */

import { DEFAULT_MOON_PHASES } from '../../constants.mjs';
import { format, localize } from '../../utils/localization.mjs';
import CalendarRegistry from '../calendar-registry.mjs';
import * as LeapYearUtils from '../leap-year-utils.mjs';

const { BooleanField, NumberField, SchemaField, StringField, TypedObjectField } = foundry.data.fields;

/**
 * Calendar data model with extended features for fantasy calendars.
 */
export default class CalendariaCalendar extends foundry.data.CalendarData {
  /** @type {number} Epoch offset in seconds */
  static #epochOffset = 0;

  /**
   * Whether PF2e sync is currently active.
   * @returns {boolean} Is calendar golarian and pf2e system in play
   */
  static get usePF2eSync() {
    if (!game.pf2e?.worldClock) return false;
    const dateTheme = game.pf2e.worldClock.dateTheme;
    if (dateTheme !== 'AR' && dateTheme !== 'IC') return false;
    const activeCalendarId = game.settings.get('calendaria', 'activeCalendar');
    return activeCalendarId === 'golarion';
  }

  /**
   * Initialize epoch offset for PF2e sync.
   * Calculates offset by matching PF2e's Luxon date to our internal time.
   * Also adjusts firstWeekday to align weekdays with Luxon.
   * Only applies when using PF2e with AR/IC theme AND Golarion calendar.
   */
  static initializeEpochOffset() {
    this.#epochOffset = 0;
    if (!this.usePF2eSync) return;
    const calendar = CalendarRegistry.getActive();
    if (!calendar) return;
    const wc = game.pf2e.worldClock;
    const dt = wc.worldCreatedOn.plus({ seconds: game.time.worldTime });
    const secondsPerMinute = calendar.time?.secondsPerMinute ?? 60;
    const minutesPerHour = calendar.time?.minutesPerHour ?? 60;
    const hoursPerDay = calendar.time?.hoursPerDay ?? 24;
    const secondsPerHour = minutesPerHour * secondsPerMinute;
    const secondsPerDay = hoursPerDay * secondsPerHour;
    const daysPerYear = calendar.days?.daysPerYear ?? 365;
    const yearZero = calendar.years?.yearZero ?? 0;
    const golarionYear = wc.year;
    const internalYear = golarionYear - yearZero;
    let dayOfYear = dt.day - 1;
    for (let m = 0; m < dt.month - 1; m++) dayOfYear += calendar.getDaysInMonth?.(m, internalYear) ?? 30;
    let totalDays = 0;
    if (internalYear > 0) for (let y = 0; y < internalYear; y++) totalDays += calendar.getDaysInYear?.(y) ?? daysPerYear;
    else if (internalYear < 0) for (let y = -1; y >= internalYear; y--) totalDays -= calendar.getDaysInYear?.(y) ?? daysPerYear;
    totalDays += dayOfYear;
    const internalTime = totalDays * secondsPerDay + dt.hour * secondsPerHour + dt.minute * secondsPerMinute + dt.second;
    this.#epochOffset = internalTime - game.time.worldTime;
    const numWeekdays = calendar?.daysInWeek ?? 7;
    const components = { year: internalYear, month: dt.month - 1, dayOfMonth: dt.day - 1 };
    const nonCountingFestivalsInYear = calendar.countNonWeekdayFestivalsBefore?.(components) ?? 0;
    const nonCountingFestivalsFromPriorYears = calendar.countNonWeekdayFestivalsBeforeYear?.(internalYear) ?? 0;
    const intercalaryInYear = calendar.countIntercalaryDaysBefore?.(components) ?? 0;
    const intercalaryFromPriorYears = calendar.countIntercalaryDaysBeforeYear?.(internalYear) ?? 0;
    const totalNonCounting = nonCountingFestivalsFromPriorYears + nonCountingFestivalsInYear + intercalaryFromPriorYears + intercalaryInYear;
    const countingDays = totalDays - totalNonCounting;
    const expectedWeekday = dt.weekday - 1;
    const correctFirstWeekday = (((expectedWeekday - (countingDays % numWeekdays)) % numWeekdays) + numWeekdays) % numWeekdays;
    if (calendar.years && calendar.years.firstWeekday !== correctFirstWeekday) calendar.years.firstWeekday = correctFirstWeekday;
    this.#correctFirstWeekday = correctFirstWeekday;
  }

  /** @type {number|null} Correct firstWeekday for PF2e sync */
  static #correctFirstWeekday = null;

  /**
   * Get the correct firstWeekday calculated during epoch initialization.
   * @returns {number|null} Correct first weekday
   */
  static get correctFirstWeekday() {
    return this.#correctFirstWeekday;
  }

  /**
   * Get the current epoch offset.
   * @returns {number} Valid epoch offset
   */
  static get epochOffset() {
    return this.#epochOffset;
  }

  /**
   * Get the current date components based on world time.
   * Computed dynamically for API consistency.
   * @returns {{year: number, month: number, day: number, hour: number, minute: number}} Current date
   */
  get currentDate() {
    const components = this.timeToComponents(game.time.worldTime);
    return {
      year: components.year + (this.years?.yearZero ?? 0),
      month: components.month,
      day: components.dayOfMonth + 1,
      hour: components.hour,
      minute: components.minute
    };
  }

  /** No-op setter, computed dynamically. */
  set currentDate(_value) {}

  /** @returns {Array<object>} Months in calendar order (from keyed `months.values` collection) */
  get monthsArray() {
    return this.months?.values ? Object.values(this.months.values) : [];
  }

  /** @returns {Array<object>} Weekdays in calendar order (from keyed `days.values` collection) */
  get weekdaysArray() {
    return this.days?.values ? Object.values(this.days.values) : [];
  }

  /** @returns {Array<object>} Seasons in calendar order (from keyed `seasons.values` collection) */
  get seasonsArray() {
    return this.seasons?.values ? Object.values(this.seasons.values) : [];
  }

  /** @returns {Array<object>} Moons in calendar order (from keyed `moons` collection) */
  get moonsArray() {
    return this.moons ? Object.values(this.moons) : [];
  }

  /** @returns {Array<object>} Cycles in calendar order (from keyed `cycles` collection) */
  get cyclesArray() {
    return this.cycles ? Object.values(this.cycles) : [];
  }

  /** @returns {Array<object>} Eras in calendar order (from keyed `eras` collection) */
  get erasArray() {
    return this.eras ? Object.values(this.eras) : [];
  }

  /** @returns {Array<object>} Festivals in calendar order (from keyed `festivals` collection) */
  get festivalsArray() {
    return this.festivals ? Object.values(this.festivals) : [];
  }

  /** @returns {Array<object>} Canonical hours in calendar order (from keyed `canonicalHours` collection) */
  get canonicalHoursArray() {
    return this.canonicalHours ? Object.values(this.canonicalHours) : [];
  }

  /** @returns {Array<object>} Named weeks in calendar order (from keyed `weeks.names` collection) */
  get namedWeeksArray() {
    return this.weeks?.names ? Object.values(this.weeks.names) : [];
  }

  /** @returns {Array<object>} Weather zones in calendar order (from keyed `weather.zones` collection) */
  get weatherZonesArray() {
    return this.weather?.zones ? Object.values(this.weather.zones) : [];
  }

  /** @returns {number} Number of days in a week (weekday count, defaults to 7) */
  get daysInWeek() {
    return this.weekdaysArray.length || 7;
  }

  /**
   * Check if this calendar operates without named months (e.g., Traveller Imperial Calendar).
   * Monthless calendars use day-of-year numbering instead of month/day.
   * @returns {boolean} True if the calendar has no named months
   */
  get isMonthless() {
    const months = this.monthsArray;
    if (months.length === 0) return true;
    if (months.length === 1 && (!months[0].name || months[0].name === '')) return true;
    return false;
  }

  /** @override */
  timeToComponents(time) {
    const adjustedTime = time + CalendariaCalendar.epochOffset;
    const secondsPerMinute = this.days?.secondsPerMinute ?? 60;
    const minutesPerHour = this.days?.minutesPerHour ?? 60;
    const hoursPerDay = this.days?.hoursPerDay ?? 24;
    const secondsPerHour = secondsPerMinute * minutesPerHour;
    const secondsPerDay = secondsPerHour * hoursPerDay;

    let totalDays = Math.floor(adjustedTime / secondsPerDay);
    const daySeconds = adjustedTime - totalDays * secondsPerDay;
    const hour = Math.floor(daySeconds / secondsPerHour);
    const minute = Math.floor((daySeconds % secondsPerHour) / secondsPerMinute);
    const second = Math.floor(daySeconds % secondsPerMinute);

    let year = 0;
    if (totalDays >= 0) {
      while (totalDays >= this.getDaysInYear(year)) {
        totalDays -= this.getDaysInYear(year);
        year++;
      }
    } else {
      while (totalDays < 0) {
        year--;
        totalDays += this.getDaysInYear(year);
      }
    }

    let month = 0;
    const months = this.monthsArray;
    while (month < months.length && totalDays >= this.getDaysInMonth(month, year)) {
      totalDays -= this.getDaysInMonth(month, year);
      month++;
    }

    return { year, month, dayOfMonth: totalDays, hour, minute, second };
  }

  /** @override */
  componentsToTime(components) {
    const { year = 0, month = 0, dayOfMonth = 0, hour = 0, minute = 0, second = 0 } = components;
    const secondsPerMinute = this.days?.secondsPerMinute ?? 60;
    const minutesPerHour = this.days?.minutesPerHour ?? 60;
    const hoursPerDay = this.days?.hoursPerDay ?? 24;
    const secondsPerHour = secondsPerMinute * minutesPerHour;
    const secondsPerDay = secondsPerHour * hoursPerDay;

    let totalDays = 0;
    if (year >= 0) {
      for (let y = 0; y < year; y++) totalDays += this.getDaysInYear(y);
    } else {
      for (let y = -1; y >= year; y--) totalDays -= this.getDaysInYear(y);
    }

    for (let m = 0; m < month; m++) totalDays += this.getDaysInMonth(m, year);
    totalDays += dayOfMonth;

    const totalSeconds = totalDays * secondsPerDay + hour * secondsPerHour + minute * secondsPerMinute + second;
    return totalSeconds - CalendariaCalendar.epochOffset;
  }

  /**
   * Legacy {{var}} → modern token mapping.
   * @since 0.9.0
   * @deprecated Remove in 1.1.0
   */
  static #LEGACY_TOKENS = {
    '{{y}}': 'YY',
    '{{yyyy}}': 'YYYY',
    '{{Y}}': 'YYYY',
    '{{B}}': 'MMMM',
    '{{b}}': 'MMM',
    '{{m}}': 'M',
    '{{mm}}': 'MM',
    '{{d}}': 'D',
    '{{dd}}': 'DD',
    '{{0}}': 'Do',
    '{{j}}': 'DDD',
    '{{w}}': 'd',
    '{{A}}': 'dddd',
    '{{a}}': 'ddd',
    '{{H}}': 'HH',
    '{{h}}': 'h',
    '{{hh}}': 'hh',
    '{{M}}': 'mm',
    '{{S}}': 'ss',
    '{{p}}': 'a',
    '{{P}}': 'A',
    '{{W}}': 'W',
    '{{WW}}': 'WW',
    '{{WN}}': '[namedWeek]',
    '{{Wn}}': '[namedWeekAbbr]',
    '{{ch}}': '[ch]',
    '{{chAbbr}}': '[chAbbr]',
    '{{E}}': 'GGGG',
    '{{e}}': '[yearInEra]',
    '{{season}}': 'QQQQ',
    '{{moon}}': '[moon]',
    '{{era}}': 'GGGG',
    '{{eraYear}}': '[yearInEra]',
    '{{yearInEra}}': '[yearInEra]',
    '{{year}}': 'YYYY',
    '{{abbreviation}}': 'G',
    '{{short}}': 'G'
  };

  /**
   * Deprecated token → replacement mapping.
   * @since 0.9.0
   * @deprecated Remove in 1.1.0
   */
  static #DEPRECATED_TOKENS = {
    dddd: 'EEEE',
    ddd: 'EEE',
    dd: 'EE',
    d: 'e',
    '[era]': 'GGGG',
    '[eraAbbr]': 'G',
    '[year]': 'YYYY',
    '[short]': 'G',
    '[season]': 'QQQQ',
    '[seasonAbbr]': 'QQQ'
  };

  /**
   * Migrate source data before schema validation.
   * Each migration is idempotent and short-circuits if data is already current.
   * @param {object} source - Raw source data
   * @returns {object} Migrated source data
   * @override
   */
  static migrateData(source) {
    CalendariaCalendar.#migrateCycleStages(source);
    CalendariaCalendar.#migrateLegacyFormats(source);
    CalendariaCalendar.#migrateDeprecatedTokens(source);
    CalendariaCalendar.#migrateArraysToObjects(source);
    return super.migrateData(source);
  }

  /**
   * Rename cycle.entries → cycle.stages.
   * @param {object} source - Raw source data
   * @since 0.9.0
   * @deprecated Remove in 1.1.0
   */
  static #migrateCycleStages(source) {
    const cycles = Array.isArray(source.cycles) ? source.cycles : source.cycles ? Object.values(source.cycles) : [];
    if (!cycles.length) return;
    for (const cycle of cycles) {
      if (cycle.entries && !cycle.stages) {
        cycle.stages = cycle.entries;
        delete cycle.entries;
      }
    }
  }

  /**
   * Convert legacy {{var}} format strings to modern bracket tokens.
   * @param {object} source - Raw source data
   * @since 0.9.0
   * @deprecated Remove in 1.1.0
   */
  static #migrateLegacyFormats(source) {
    const format = (str) => {
      let out = str.replace(/{{c\d+}}/g, '[cycle]').replace(/{{(\d+)}}/g, '[$1]');
      for (const [old, rep] of Object.entries(CalendariaCalendar.#LEGACY_TOKENS)) {
        out = out.replace(new RegExp(old.replace(/[{}]/g, '\\$&'), 'g'), rep);
      }
      return out;
    };
    const isLegacy = (str) => typeof str === 'string' && /{{[^}]+}}/.test(str);
    if (source.dateFormats) {
      for (const [key, val] of Object.entries(source.dateFormats)) {
        if (isLegacy(val)) source.dateFormats[key] = format(val);
      }
    }
    if (isLegacy(source.cycleFormat)) source.cycleFormat = format(source.cycleFormat);
  }

  /**
   * Replace deprecated format tokens with current equivalents.
   * @param {object} source - Raw source data
   * @since 0.9.0
   * @deprecated Remove in 1.1.0
   */
  static #migrateDeprecatedTokens(source) {
    const migrate = (str) => {
      if (typeof str !== 'string') return str;
      let out = str;
      for (const [tok, rep] of Object.entries(CalendariaCalendar.#DEPRECATED_TOKENS).sort((a, b) => b[0].length - a[0].length)) {
        if (tok.startsWith('[')) {
          out = out.split(tok).join(rep);
        } else {
          out = out.replace(new RegExp(`(?<![a-zA-Z])${tok}(?![a-zA-Z])`, 'g'), rep);
        }
      }
      return out;
    };
    if (source.dateFormats) {
      for (const [key, val] of Object.entries(source.dateFormats)) {
        const migrated = migrate(val);
        if (migrated !== val) source.dateFormats[key] = migrated;
      }
    }
    if (source.cycleFormat) {
      const migrated = migrate(source.cycleFormat);
      if (migrated !== source.cycleFormat) source.cycleFormat = migrated;
    }
  }

  /**
   * Convert legacy array-based collections to keyed objects.
   * @param {object} source - Raw source data
   */
  static #migrateArraysToObjects(source) {
    const convert = (arr) => {
      if (!Array.isArray(arr)) return arr;
      const obj = {};
      for (const item of arr) obj[foundry.utils.randomID()] = item;
      return obj;
    };
    // Top-level collections
    for (const key of ['festivals', 'eras', 'moons', 'cycles', 'canonicalHours']) {
      if (Array.isArray(source[key])) source[key] = convert(source[key]);
    }
    // Nested in parent objects
    if (source.months?.values && Array.isArray(source.months.values)) source.months.values = convert(source.months.values);
    if (source.days?.values && Array.isArray(source.days.values)) source.days.values = convert(source.days.values);
    if (source.seasons?.values && Array.isArray(source.seasons.values)) source.seasons.values = convert(source.seasons.values);
    if (source.weather?.zones && Array.isArray(source.weather.zones)) source.weather.zones = convert(source.weather.zones);
    if (source.weeks?.names && Array.isArray(source.weeks.names)) source.weeks.names = convert(source.weeks.names);
    // Deeply nested collections
    const convertNested = (parent, key) => {
      if (!parent || typeof parent !== 'object') return;
      for (const item of Object.values(parent)) {
        if (item && Array.isArray(item[key])) item[key] = convert(item[key]);
      }
    };
    if (source.moons && !Array.isArray(source.moons)) convertNested(source.moons, 'phases');
    if (source.cycles && !Array.isArray(source.cycles)) convertNested(source.cycles, 'stages');
    if (source.weather?.zones && !Array.isArray(source.weather.zones)) convertNested(source.weather.zones, 'presets');
    if (source.months?.values && !Array.isArray(source.months.values)) convertNested(source.months.values, 'weekdays');
    // Season climate presets (nested within seasons)
    if (source.seasons?.values && !Array.isArray(source.seasons.values)) {
      for (const season of Object.values(source.seasons.values)) {
        if (season?.climate?.presets && Array.isArray(season.climate.presets)) season.climate.presets = convert(season.climate.presets);
      }
    }
  }

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    const extendedMonthSchema = new SchemaField(
      {
        values: new TypedObjectField(
          new SchemaField({
            name: new StringField({ required: true, blank: false }),
            abbreviation: new StringField(),
            ordinal: new NumberField({ required: true, nullable: false, min: 1, integer: true }),
            days: new NumberField({ required: true, nullable: false }),
            leapDays: new NumberField({ required: false, nullable: true }),
            type: new StringField({ required: false }),
            startingWeekday: new NumberField({ required: false, integer: true, nullable: true, min: 0 }),
            weekdays: new TypedObjectField(
              new SchemaField({ name: new StringField({ required: true }), abbreviation: new StringField({ required: false }), isRestDay: new BooleanField({ required: false, initial: false }) }),
              { required: false, nullable: true }
            )
          })
        )
      },
      { required: true, nullable: true, initial: null }
    );
    const climatePresetSchema = new SchemaField({
      id: new StringField({ required: true }),
      chance: new NumberField({ required: false, initial: 0, min: 0 })
    });
    const climateSchema = new SchemaField(
      {
        temperatures: new SchemaField({ min: new NumberField({ required: false, nullable: true }), max: new NumberField({ required: false, nullable: true }) }, { required: false, nullable: true }),
        presets: new TypedObjectField(climatePresetSchema, { required: false })
      },
      { required: false, nullable: true }
    );
    const extendedSeasonSchema = new SchemaField(
      {
        type: new StringField({ required: false, initial: 'dated', choices: ['dated', 'periodic'] }),
        offset: new NumberField({ required: false, integer: true, min: 0, initial: 0 }),
        values: new TypedObjectField(
          new SchemaField({
            name: new StringField({ required: true, blank: false }),
            abbreviation: new StringField({ required: false }),
            icon: new StringField({ required: false, initial: '' }),
            color: new StringField({ required: false, initial: '' }),
            seasonalType: new StringField({ required: false, nullable: true, choices: ['spring', 'summer', 'autumn', 'winter'] }),
            dayStart: new NumberField({ required: false, integer: true, min: 0, nullable: true }),
            dayEnd: new NumberField({ required: false, integer: true, min: 0, nullable: true }),
            monthStart: new NumberField({ required: false, integer: true, min: 1, nullable: true }),
            monthEnd: new NumberField({ required: false, integer: true, min: 1, nullable: true }),
            duration: new NumberField({ required: false, integer: true, min: 1, nullable: true }),
            climate: climateSchema
          })
        )
      },
      { required: false, nullable: true, initial: null }
    );
    const extendedDaysSchema = new SchemaField(
      {
        values: new TypedObjectField(
          new SchemaField({
            name: new StringField({ required: true, blank: false }),
            abbreviation: new StringField({ required: false }),
            ordinal: new NumberField({ required: true, nullable: false, min: 1, integer: true }),
            isRestDay: new BooleanField({ required: false, initial: false })
          })
        ),
        daysPerYear: new NumberField({ required: false, integer: true, min: 1 }),
        hoursPerDay: new NumberField({ required: false, integer: true, min: 1 }),
        minutesPerHour: new NumberField({ required: false, integer: true, min: 1 }),
        secondsPerMinute: new NumberField({ required: false, integer: true, min: 1 })
      },
      { required: false, nullable: true }
    );
    return {
      ...schema,
      months: extendedMonthSchema,
      seasons: extendedSeasonSchema,
      days: extendedDaysSchema,
      secondsPerRound: new NumberField({ required: false, integer: true, min: 1, initial: 6 }),
      leapYearConfig: new SchemaField(
        {
          rule: new StringField({ required: false, initial: 'none' }),
          interval: new NumberField({ required: false, integer: true, min: 1 }),
          start: new NumberField({ required: false, integer: true, initial: 0 }),
          pattern: new StringField({ required: false })
        },
        { required: false, nullable: true }
      ),
      festivals: new TypedObjectField(
        new SchemaField({
          name: new StringField({ required: true }),
          description: new StringField({ required: false, initial: '' }),
          color: new StringField({ required: false, initial: '' }),
          icon: new StringField({ required: false, initial: '' }),
          month: new NumberField({ required: false, nullable: true, min: 1, integer: true }),
          day: new NumberField({ required: false, nullable: true, min: 1, integer: true }),
          dayOfYear: new NumberField({ required: false, nullable: true, min: 1, max: 400, integer: true }),
          duration: new NumberField({ required: false, nullable: false, min: 1, integer: true, initial: 1 }),
          leapDuration: new NumberField({ required: false, nullable: true, min: 1, integer: true }),
          leapYearOnly: new BooleanField({ required: false, initial: false }),
          countsForWeekday: new BooleanField({ required: false, initial: true })
        })
      ),
      moons: new TypedObjectField(
        new SchemaField({
          name: new StringField({ required: true }),
          cycleLength: new NumberField({ required: true, nullable: false, min: 1 }),
          cycleDayAdjust: new NumberField({ required: false, nullable: false, initial: 0 }),
          referencePhase: new NumberField({ required: false, nullable: false, initial: 0, integer: true, min: 0 }),
          color: new StringField({ required: false, initial: '' }),
          phases: new TypedObjectField(
            new SchemaField({
              name: new StringField({ required: true }),
              rising: new StringField({ required: false }),
              fading: new StringField({ required: false }),
              icon: new StringField({ required: false }),
              start: new NumberField({ required: true, min: 0, max: 1 }),
              end: new NumberField({ required: true, min: 0, max: 1 })
            }),
            { initial: DEFAULT_MOON_PHASES }
          ),
          referenceDate: new SchemaField({
            year: new NumberField({ required: true, integer: true, initial: 1 }),
            month: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            day: new NumberField({ required: true, integer: true, min: 1, initial: 1 })
          })
        })
      ),
      eras: new TypedObjectField(
        new SchemaField({
          name: new StringField({ required: true }),
          abbreviation: new StringField({ required: true }),
          startYear: new NumberField({ required: true, integer: true }),
          endYear: new NumberField({ required: false, nullable: true, integer: true }),
          format: new StringField({ required: false, initial: 'suffix' }),
          template: new StringField({ required: false, nullable: true, initial: null })
        })
      ),
      cycles: new TypedObjectField(
        new SchemaField({
          name: new StringField({ required: true }),
          length: new NumberField({ required: true, nullable: false, min: 1, initial: 12 }),
          offset: new NumberField({ required: false, nullable: false, initial: 0 }),
          basedOn: new StringField({ required: true, initial: 'month', choices: ['year', 'eraYear', 'month', 'monthDay', 'day', 'yearDay'] }),
          stages: new TypedObjectField(new SchemaField({ name: new StringField({ required: true }) }))
        })
      ),
      cycleFormat: new StringField({ required: false, initial: '' }),
      metadata: new SchemaField(
        { id: new StringField({ required: false }), description: new StringField({ required: false }), author: new StringField({ required: false }), system: new StringField({ required: false }) },
        { required: false }
      ),
      daylight: new SchemaField(
        {
          enabled: new foundry.data.fields.BooleanField({ required: false, initial: false }),
          shortestDay: new NumberField({ required: false, initial: 8, min: 0 }),
          longestDay: new NumberField({ required: false, initial: 16, min: 0 }),
          winterSolstice: new NumberField({ required: false, initial: 355, integer: true, min: 0 }),
          summerSolstice: new NumberField({ required: false, initial: 172, integer: true, min: 0 })
        },
        { required: false }
      ),
      currentDate: new SchemaField(
        {
          year: new NumberField({ required: true, integer: true }),
          month: new NumberField({ required: true, integer: true, min: 0 }),
          day: new NumberField({ required: true, integer: true, min: 1 }),
          hour: new NumberField({ required: false, integer: true, initial: 0, min: 0 }),
          minute: new NumberField({ required: false, integer: true, initial: 0, min: 0 })
        },
        { required: false, nullable: true }
      ),
      amPmNotation: new SchemaField(
        {
          am: new StringField({ required: false, initial: 'AM' }),
          pm: new StringField({ required: false, initial: 'PM' }),
          amAbbr: new StringField({ required: false, initial: 'AM' }),
          pmAbbr: new StringField({ required: false, initial: 'PM' })
        },
        { required: false }
      ),
      canonicalHours: new TypedObjectField(
        new SchemaField({
          name: new StringField({ required: true }),
          abbreviation: new StringField({ required: false }),
          startHour: new NumberField({ required: true, nullable: false, min: 0, integer: true }),
          endHour: new NumberField({ required: true, nullable: false, min: 0, integer: true })
        })
      ),
      weeks: new SchemaField(
        {
          enabled: new BooleanField({ required: false, initial: false }),
          type: new StringField({ required: false, initial: 'year-based', choices: ['month-based', 'year-based'] }),
          perMonth: new NumberField({ required: false, integer: true, min: 1 }),
          names: new TypedObjectField(new SchemaField({ name: new StringField({ required: true }), abbreviation: new StringField({ required: false }) }))
        },
        { required: false }
      ),
      dateFormats: new SchemaField(
        {
          short: new StringField({ required: false, initial: 'D MMM' }),
          long: new StringField({ required: false, initial: 'D MMMM, YYYY' }),
          full: new StringField({ required: false, initial: 'MMMM D, YYYY' }),
          time: new StringField({ required: false, initial: 'HH:mm' }),
          time12: new StringField({ required: false, initial: 'h:mm a' }),
          weekHeader: new StringField({ required: false, initial: '[W]' }),
          yearHeader: new StringField({ required: false, initial: '[YYYY]' }),
          yearLabel: new StringField({ required: false, initial: '[YYYY] [GGGG]' })
        },
        { required: false }
      ),
      weather: new SchemaField(
        {
          activeZone: new StringField({ required: false, initial: 'temperate' }),
          autoGenerate: new BooleanField({ required: false, initial: true }),
          zones: new TypedObjectField(
            new SchemaField({
              id: new StringField({ required: true }),
              name: new StringField({ required: true }),
              description: new StringField({ required: false }),
              latitude: new NumberField({ required: false, nullable: true, initial: null, min: -90, max: 90 }),
              shortestDay: new NumberField({ required: false, nullable: true, initial: null, min: 0 }),
              longestDay: new NumberField({ required: false, nullable: true, initial: null, min: 0 }),
              temperatures: new foundry.data.fields.ObjectField({ required: false, initial: {} }),
              presets: new TypedObjectField(
                new SchemaField({
                  id: new StringField({ required: true }),
                  enabled: new BooleanField({ required: false, initial: false }),
                  chance: new NumberField({ required: false, initial: 0 }),
                  tempMin: new NumberField({ required: false, nullable: true }),
                  tempMax: new NumberField({ required: false, nullable: true }),
                  description: new StringField({ required: false })
                })
              ),
              seasonOverrides: new foundry.data.fields.ObjectField({ required: false, initial: {} })
            })
          )
        },
        { required: false }
      )
    };
  }

  /**
   * Calculate the decimal hours since the start of the day.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @param {object} [calendar] - Calendar to use, by default this calendar.
   * @returns {number} - Number of hours since the start of the day as a decimal.
   */
  static hoursOfDay(time = game.time.components, calendar = game.time.calendar) {
    const components = typeof time === 'number' ? calendar.timeToComponents(time) : time;
    const minutes = components.minute + components.second / calendar.days.secondsPerMinute;
    return components.hour + minutes / calendar.days.minutesPerHour;
  }

  /**
   * Check if a given year is a leap year.
   * Supports complex leap year patterns (e.g., "400,!100,4" for Gregorian).
   * @param {number} year - The internal year to check (0-based from calendar epoch)
   * @returns {boolean} True if the year is a leap year
   */
  isLeapYear(year) {
    const yearZero = this.years?.yearZero ?? 0;
    const displayYear = year + yearZero;
    const advancedConfig = this.leapYearConfig;
    if (advancedConfig?.rule && advancedConfig.rule !== 'none') return LeapYearUtils.isLeapYear(advancedConfig, displayYear, true);
    const leapConfig = this.years?.leapYear;
    if (!leapConfig) return false;
    const interval = leapConfig.leapInterval;
    const start = leapConfig.leapStart ?? 0;
    if (!interval || interval <= 0) return false;
    return LeapYearUtils.isLeapYear({ rule: 'simple', interval, start }, displayYear, true);
  }

  /**
   * Check if the current year is a leap year.
   * @param {number|object} [time] - Time to check, defaults to current world time
   * @returns {boolean} True if the year is a leap year
   */
  isCurrentYearLeapYear(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    return this.isLeapYear(components.year);
  }

  /**
   * Get the number of days in a month, accounting for leap years.
   * @param {number} monthIndex - The 0-indexed month
   * @param {number} year - The internal year (0-based from calendar epoch)
   * @returns {number} Number of days in the month
   */
  getDaysInMonth(monthIndex, year) {
    const month = this.monthsArray[monthIndex];
    if (!month) return 0;
    if (this.isLeapYear(year) && month.leapDays != null) return month.leapDays;
    return month.days;
  }

  /**
   * Get total days in a year, accounting for leap years.
   * @param {number} year - The internal year (0-based from calendar epoch)
   * @returns {number} - Total days in the year
   */
  getDaysInYear(year) {
    if (this.isMonthless) {
      const base = this.days?.daysPerYear ?? 365;
      return this.isLeapYear(year) ? base + 1 : base;
    }
    const isLeap = this.isLeapYear(year);
    return this.monthsArray.reduce((sum, month) => {
      const days = isLeap && month.leapDays != null ? month.leapDays : month.days;
      return sum + days;
    }, 0);
  }

  /**
   * Get a description of the leap year rule.
   * @returns {string} - Human-readable description
   */
  getLeapYearDescription() {
    const advancedConfig = this.leapYearConfig;
    if (advancedConfig?.rule && advancedConfig.rule !== 'none') return LeapYearUtils.getLeapYearDescription(advancedConfig);
    const leapConfig = this.years?.leapYear;
    if (!leapConfig) return LeapYearUtils.getLeapYearDescription(null);
    return LeapYearUtils.getLeapYearDescription({ rule: 'simple', interval: leapConfig.leapInterval, start: leapConfig.leapStart ?? 0 });
  }

  /**
   * Compute daylight hours from latitude using the astronomical hour-angle formula.
   * Uses Earth's axial tilt (23.44°) as default. Handles polar day/night edge cases.
   * @param {number} latitude - Latitude in degrees (-90 to 90)
   * @param {number} dayOfYear - Day of year (0-indexed)
   * @param {number} daysPerYear - Total days in the calendar year
   * @param {number} hoursPerDay - Hours per day for this calendar
   * @param {number} [summerSolsticeDay] - Day of year when summer solstice occurs (declination peaks)
   * @returns {number} Daylight hours for the given day and latitude
   */
  static computeDaylightFromLatitude(latitude, dayOfYear, daysPerYear, hoursPerDay, summerSolsticeDay = null) {
    const axialTilt = 23.44;
    const tiltRad = (axialTilt * Math.PI) / 180;
    const latRad = (latitude * Math.PI) / 180;
    // Solar declination — cosine peaks at summer solstice day
    const peak = summerSolsticeDay ?? Math.round(daysPerYear * 0.47);
    const yearProgress = ((dayOfYear - peak) / daysPerYear) * 2 * Math.PI;
    const declination = tiltRad * Math.cos(yearProgress);
    // Hour angle
    const cosHourAngle = -Math.tan(latRad) * Math.tan(declination);
    if (cosHourAngle <= -1) return hoursPerDay; // Polar day
    if (cosHourAngle >= 1) return 0; // Polar night
    const hourAngle = Math.acos(cosHourAngle);
    return (hourAngle / Math.PI) * hoursPerDay;
  }

  /**
   * Get the number of hours in a given day.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @param {object} [zone] - Optional climate zone with latitude/daylight overrides.
   * @returns {number} - Number of hours between sunrise and sunset.
   */
  daylightHours(time = game.time.components, zone = null) {
    return this.sunset(time, zone) - this.sunrise(time, zone);
  }

  /**
   * Progress between sunrise and sunset assuming it is daylight half the day duration.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @param {object} [zone] - Optional climate zone with latitude/daylight overrides.
   * @returns {number} - Progress through day period, with 0 representing sunrise and 1 sunset.
   */
  progressDay(time = game.time.components, zone = null) {
    return (CalendariaCalendar.hoursOfDay(time, this) - this.sunrise(time, zone)) / this.daylightHours(time, zone);
  }

  /**
   * Progress between sunset and sunrise assuming it is night half the day duration.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @param {object} [zone] - Optional climate zone with latitude/daylight overrides.
   * @returns {number} - Progress through night period, with 0 representing sunset and 1 sunrise.
   */
  progressNight(time = game.time.components, zone = null) {
    const daylightHrs = this.daylightHours(time, zone);
    let hour = CalendariaCalendar.hoursOfDay(time, this);
    if (hour < daylightHrs) hour += this.days.hoursPerDay;
    return (hour - this.sunset(time, zone)) / daylightHrs;
  }

  /**
   * Get the sunrise time for a given day.
   * Uses zone latitude if available, then global daylight curve, then static 25% of day.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @param {object} [zone] - Optional climate zone with latitude/daylight overrides.
   * @returns {number} - Sunrise time in hours.
   */
  sunrise(time = game.time.components, zone = null) {
    const daylightHrs = this._getDaylightHoursForDay(time, zone);
    const midday = this.days.hoursPerDay / 2;
    return midday - daylightHrs / 2;
  }

  /**
   * Get the sunset time for a given day.
   * Uses zone latitude if available, then global daylight curve, then static 75% of day.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @param {object} [zone] - Optional climate zone with latitude/daylight overrides.
   * @returns {number} - Sunset time in hours.
   */
  sunset(time = game.time.components, zone = null) {
    const daylightHrs = this._getDaylightHoursForDay(time, zone);
    const midday = this.days.hoursPerDay / 2;
    return midday + daylightHrs / 2;
  }

  /**
   * Get solar midday - the midpoint between sunrise and sunset.
   * This varies throughout the year when dynamic daylight is enabled.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @param {object} [zone] - Optional climate zone with latitude/daylight overrides.
   * @returns {number} - Solar midday time in hours.
   */
  solarMidday(time = game.time.components, zone = null) {
    return (this.sunrise(time, zone) + this.sunset(time, zone)) / 2;
  }

  /**
   * Get solar midnight - the midpoint of the night period.
   * This is halfway between sunset and the next sunrise.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @param {object} [zone] - Optional climate zone with latitude/daylight overrides.
   * @returns {number} - Solar midnight time in hours (may exceed hoursPerDay for next day).
   */
  solarMidnight(time = game.time.components, zone = null) {
    const sunsetHour = this.sunset(time, zone);
    const nightHours = this.days.hoursPerDay - this.daylightHours(time, zone);
    return sunsetHour + nightHours / 2;
  }

  /**
   * Calculate daylight hours for a specific day based on zone latitude, zone manual overrides,
   * global dynamic daylight settings, or static 50% fallback.
   * @param {number|object} [time] - The time to use.
   * @param {object} [zone] - Optional climate zone with latitude/daylight overrides.
   * @returns {number} - Hours of daylight for this day.
   * @private
   */
  _getDaylightHoursForDay(time = game.time.components, zone = null) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const hoursPerDay = this.days.hoursPerDay;
    const daysPerYear = this.days.daysPerYear ?? 365;

    // Calculate day of year (shared by multiple branches)
    let dayOfYear = components.dayOfMonth;
    const months = this.monthsArray;
    for (let i = 0; i < components.month; i++) dayOfYear += months[i]?.days ?? 0;

    // 1. Zone latitude — astronomical formula
    if (zone?.latitude != null) {
      const summerSolsticeDay = this.daylight?.summerSolstice ?? Math.round(daysPerYear * 0.47);
      return CalendariaCalendar.computeDaylightFromLatitude(zone.latitude, dayOfYear, daysPerYear, hoursPerDay, summerSolsticeDay);
    }

    // 2. Zone manual shortestDay/longestDay — sinusoidal with zone-specific extremes
    if (zone?.shortestDay != null && zone?.longestDay != null) {
      return this.#computeSinusoidalDaylight(dayOfYear, daysPerYear, zone.shortestDay, zone.longestDay);
    }

    // 3. Global daylight curve
    if (this.daylight?.enabled) {
      const { shortestDay, longestDay } = this.daylight;
      return this.#computeSinusoidalDaylight(dayOfYear, daysPerYear, shortestDay, longestDay);
    }

    // 4. Static fallback
    return hoursPerDay * 0.5;
  }

  /**
   * Compute daylight hours using the sinusoidal curve between solstices.
   * @param {number} dayOfYear - 0-indexed day of year
   * @param {number} daysPerYear - Total days per year
   * @param {number} shortestDay - Shortest daylight hours
   * @param {number} longestDay - Longest daylight hours
   * @returns {number} Hours of daylight
   * @private
   */
  #computeSinusoidalDaylight(dayOfYear, daysPerYear, shortestDay, longestDay) {
    const winterSolstice = this.daylight?.winterSolstice ?? Math.round(daysPerYear * 0.97);
    const summerSolstice = this.daylight?.summerSolstice ?? Math.round(daysPerYear * 0.47);
    const daysSinceWinter = (dayOfYear - winterSolstice + daysPerYear) % daysPerYear;
    const daysBetweenSolstices = (summerSolstice - winterSolstice + daysPerYear) % daysPerYear;
    let progress;
    if (daysSinceWinter <= daysBetweenSolstices) {
      progress = daysSinceWinter / daysBetweenSolstices;
    } else {
      const daysSinceSummer = daysSinceWinter - daysBetweenSolstices;
      const daysWinterToSummer = daysPerYear - daysBetweenSolstices;
      progress = 1 - daysSinceSummer / daysWinterToSummer;
    }
    const cosineProgress = (1 - Math.cos(progress * Math.PI)) / 2;
    return shortestDay + (longestDay - shortestDay) * cosineProgress;
  }

  /**
   * Set the date to a specific year, month, or day. Any values not provided will remain the same.
   * @param {object} components - Date components to set
   * @param {number} [components.year] - Visible year (with `yearZero` added in).
   * @param {number} [components.month] - Index of month.
   * @param {number} [components.day] - Day within the month.
   */
  async jumpToDate({ year, month, day }) {
    const components = { ...game.time.components };
    year ??= components.year + this.years.yearZero;
    month ??= components.month;
    day ??= components.dayOfMonth + 1; // Default to current day (1-indexed)
    components.year = year - this.years.yearZero;
    components.month = month;
    components.dayOfMonth = day - 1; // Convert 1-indexed to 0-indexed
    await game.time.set(components);
  }

  /**
   * Find festival day for current day.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{name: string, month: number, day: number, dayOfYear: number, duration: number, leapYearOnly: boolean}|null} - Festival or null
   */
  findFestivalDay(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const isLeap = this.isLeapYear(components.year);
    const currentDayOfYear = this._calculateDayOfYear(components) + 1;
    return (
      this.festivalsArray.find((f) => {
        if (f.leapYearOnly && !isLeap) return false;
        const duration = isLeap && f.leapDuration != null ? f.leapDuration : (f.duration ?? 1);
        if (f.dayOfYear != null) {
          return currentDayOfYear >= f.dayOfYear && currentDayOfYear < f.dayOfYear + duration;
        }
        if (f.month != null && f.day != null) {
          const festivalDayOfYear = this._calculateDayOfYearFromMonthDay(f.month - 1, f.day - 1, components.year) + 1;
          return currentDayOfYear >= festivalDayOfYear && currentDayOfYear < festivalDayOfYear + duration;
        }
        return false;
      }) ?? null
    );
  }

  /**
   * Calculate day of year (0-indexed) from month and day.
   * @param {number} month - Month index (0-indexed)
   * @param {number} day - Day of month (0-indexed)
   * @param {number} [year] - Year for leap year calculation
   * @returns {number} Day of year (0-indexed)
   * @private
   */
  _calculateDayOfYearFromMonthDay(month, day, year) {
    if (this.isMonthless) return day;
    let dayOfYear = day;
    const months = this.monthsArray;
    for (let i = 0; i < month; i++) dayOfYear += year !== undefined ? this.getDaysInMonth(i, year) : (months[i]?.days ?? 0);
    return dayOfYear;
  }

  /**
   * Calculate day of year (0-indexed) from components.
   * @param {object} components - Time components
   * @returns {number} Day of year (0-indexed)
   * @private
   */
  _calculateDayOfYear(components) {
    if (this.isMonthless) return components.dayOfMonth;
    let dayOfYear = components.dayOfMonth;
    const months = this.monthsArray;
    for (let i = 0; i < components.month; i++) dayOfYear += components.year !== undefined ? this.getDaysInMonth(i, components.year) : (months[i]?.days ?? 0);
    return dayOfYear;
  }

  /**
   * Check if a date is a festival day.
   * @param {number|object} [time] - Time to check.
   * @returns {boolean} - Is festival day?
   */
  isFestivalDay(time = game.time.worldTime) {
    return this.findFestivalDay(time) !== null;
  }

  /**
   * Count festival days that don't count for weekday calculation before a given date in the same year.
   * @param {number|object} time  Time to check up to.
   * @returns {number} Number of non-counting festival days before this date in the year.
   */
  countNonWeekdayFestivalsBefore(time) {
    const festivals = this.festivalsArray;
    if (!festivals.length) return 0;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const isLeap = this.isLeapYear(components.year);
    const currentDayOfYear = this._calculateDayOfYear(components) + 1;
    let count = 0;
    for (const festival of festivals) {
      if (festival.countsForWeekday !== false) continue;
      if (festival.leapYearOnly && !isLeap) continue;
      const duration = isLeap && festival.leapDuration != null ? festival.leapDuration : (festival.duration ?? 1);
      let festivalStart;
      if (festival.dayOfYear != null) {
        festivalStart = festival.dayOfYear;
      } else if (festival.month != null && festival.day != null) {
        festivalStart = this._calculateDayOfYearFromMonthDay(festival.month - 1, festival.day - 1, components.year) + 1;
      } else {
        continue;
      }
      const festivalEnd = festivalStart + duration;
      if (festivalEnd <= currentDayOfYear) {
        count += duration;
      } else if (festivalStart < currentDayOfYear) {
        count += currentDayOfYear - festivalStart;
      }
    }
    return count;
  }

  /**
   * Check if a specific date is a non-counting festival day.
   * @param {number|object} time  Time to check.
   * @returns {boolean} True if date is a festival that doesn't count for weekdays.
   */
  isNonWeekdayFestival(time) {
    const festival = this.findFestivalDay(time);
    return festival?.countsForWeekday === false;
  }

  /**
   * Count total festival days that don't count for weekday calculation in a full year.
   * Only counts non-leap-year festivals (those that occur every year).
   * @param {boolean} [isLeap] - Whether to calculate for a leap year.
   * @returns {number} Number of non-counting festival days per year.
   */
  countNonWeekdayFestivalsInYear(isLeap = false) {
    const festivals = this.festivalsArray;
    if (!festivals.length) return 0;
    let count = 0;
    for (const festival of festivals) {
      if (festival.countsForWeekday !== false) continue;
      if (festival.leapYearOnly && !isLeap) continue;
      const duration = isLeap && festival.leapDuration != null ? festival.leapDuration : (festival.duration ?? 1);
      count += duration;
    }
    return count;
  }

  /**
   * Count all non-counting festival days between the epoch (year 0) and the given year.
   * For positive years: counts festivals in years 0 through year-1 (positive return).
   * For negative years: counts festivals in years -1 through year (negative return).
   * Accounts for leap year festivals and multi-day durations.
   * @param {number} year - Internal year (0-based from calendar epoch)
   * @returns {number} Total non-counting festival days (negative for years before epoch).
   */
  countNonWeekdayFestivalsBeforeYear(year) {
    if (!this.festivalsArray.length || year === 0) return 0;
    const regularYearDays = this.countNonWeekdayFestivalsInYear(false);
    const leapYearDays = this.countNonWeekdayFestivalsInYear(true);

    if (year > 0) {
      let leapYears = 0;
      for (let y = 0; y < year; y++) if (this.isLeapYear(y)) leapYears++;
      const regularYears = year - leapYears;
      return regularYears * regularYearDays + leapYears * leapYearDays;
    } else {
      let leapYears = 0;
      for (let y = -1; y >= year; y--) if (this.isLeapYear(y)) leapYears++;
      const totalYears = -year;
      const regularYears = totalYears - leapYears;
      return -(regularYears * regularYearDays + leapYears * leapYearDays);
    }
  }

  /**
   * Count days in intercalary months before a given date in the same year.
   * @param {number|object} time - Time to check up to.
   * @returns {number} Number of intercalary days before this date in the year.
   */
  countIntercalaryDaysBefore(time) {
    const months = this.monthsArray;
    if (!months.length) return 0;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const isLeap = this.isLeapYear(components.year);
    let count = 0;
    for (let i = 0; i < components.month; i++) {
      const month = months[i];
      if (month.type !== 'intercalary') continue;
      const days = isLeap && month.leapDays != null ? month.leapDays : month.days;
      count += days;
    }
    const currentMonth = months[components.month];
    if (currentMonth?.type === 'intercalary') count += components.dayOfMonth;
    return count;
  }

  /**
   * Count intercalary days per year (non-leap).
   * @returns {number} Total intercalary days in a regular year.
   */
  countIntercalaryDaysInYear() {
    const months = this.monthsArray;
    if (!months.length) return 0;
    let count = 0;
    for (const month of months) {
      if (month.type !== 'intercalary') continue;
      count += month.days ?? 0;
    }
    return count;
  }

  /**
   * Count intercalary days per leap year.
   * @returns {number} Total intercalary days in a leap year.
   */
  countIntercalaryDaysInLeapYear() {
    const months = this.monthsArray;
    if (!months.length) return 0;
    let count = 0;
    for (const month of months) {
      if (month.type !== 'intercalary') continue;
      count += month.leapDays ?? month.days ?? 0;
    }
    return count;
  }

  /**
   * Count all intercalary days between the epoch (year 0) and the given year.
   * @param {number} year - Internal year (0-based from calendar epoch)
   * @returns {number} Total intercalary days (negative for years before epoch).
   */
  countIntercalaryDaysBeforeYear(year) {
    if (!this.monthsArray.length || year === 0) return 0;
    const regularCount = this.countIntercalaryDaysInYear();
    const leapCount = this.countIntercalaryDaysInLeapYear();
    if (year > 0) {
      let leapYears = 0;
      for (let y = 0; y < year; y++) if (this.isLeapYear(y)) leapYears++;
      const regularYears = year - leapYears;
      return regularYears * regularCount + leapYears * leapCount;
    } else {
      let leapYears = 0;
      for (let y = -1; y >= year; y--) if (this.isLeapYear(y)) leapYears++;
      const totalYears = -year;
      const regularYears = totalYears - leapYears;
      return -(regularYears * regularCount + leapYears * leapCount);
    }
  }

  /**
   * Get the current phase of a moon using FC-style distribution.
   * Primary phases (new/full moon) get floor(cycleLength/8) days each,
   * remaining phases split the leftover days evenly.
   * @param {number} [moonIndex]  Index of the moon (0 for primary moon).
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{name: string, subPhaseName: string, icon: string, position: number}|null} - Moon phase data or null
   */
  getMoonPhase(moonIndex = 0, time = game.time.worldTime) {
    const moon = this.moonsArray[moonIndex];
    if (!moon) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const currentDays = this._componentsToDays(components);
    const referenceDays = this._componentsToDays(moon.referenceDate);
    const daysSinceReference = currentDays - referenceDays;
    const phases = moon.phases ? Object.values(moon.phases) : [];
    if (!phases.length) return null;
    if (!Number.isFinite(daysSinceReference) || !Number.isFinite(moon.cycleLength) || moon.cycleLength <= 0) {
      return { name: phases[0].name, subPhaseName: phases[0].name, icon: phases[0].icon || '', position: 0, dayInCycle: 0 };
    }
    const refPhase = phases[moon.referencePhase ?? 0];
    const phaseOffset = (refPhase?.start ?? 0) * moon.cycleLength;
    const cycleDayAdjust = Number.isFinite(moon.cycleDayAdjust) ? moon.cycleDayAdjust : 0;
    const daysIntoCycleRaw = (((daysSinceReference % moon.cycleLength) + moon.cycleLength) % moon.cycleLength) + phaseOffset + cycleDayAdjust;
    const daysIntoCycle = ((daysIntoCycleRaw % moon.cycleLength) + moon.cycleLength) % moon.cycleLength;
    const normalizedPosition = daysIntoCycle / moon.cycleLength;
    const dayIndex = Math.floor(daysIntoCycle);
    const hasRanges = phases.length > 0 && phases[0].start !== undefined && phases[0].end !== undefined;

    let phaseArrayIndex = 0;
    let dayWithinPhase = 0;
    let phaseDuration = 1;

    if (hasRanges) {
      // Convert fractional start/end to integer day boundaries to avoid floating-point precision issues
      const totalCycleDays = Math.round(moon.cycleLength);
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        const startDay = Math.round((phase.start ?? 0) * moon.cycleLength);
        const endDay = Math.round((phase.end ?? 1) * moon.cycleLength);
        // Handle wrap-around (e.g., startDay=25, endDay=3 in a 28-day cycle)
        const inRange = endDay > startDay ? dayIndex >= startDay && dayIndex < endDay : dayIndex >= startDay || dayIndex < endDay;
        if (inRange) {
          phaseArrayIndex = i;
          phaseDuration = Math.max(1, endDay > startDay ? endDay - startDay : totalCycleDays - startDay + endDay);
          dayWithinPhase = dayIndex >= startDay ? dayIndex - startDay : dayIndex + totalCycleDays - startDay;
          break;
        }
      }
    } else {
      // Fall back to even distribution
      const numPhases = phases.length || 8;
      const phaseDays = CalendariaCalendar.#buildPhaseDayDistribution(moon.cycleLength, numPhases);
      let cumulativeDays = 0;
      for (let i = 0; i < phaseDays.length; i++) {
        if (dayIndex < cumulativeDays + phaseDays[i]) {
          phaseArrayIndex = i;
          dayWithinPhase = dayIndex - cumulativeDays;
          phaseDuration = phaseDays[i];
          break;
        }
        cumulativeDays += phaseDays[i];
      }
    }

    const matchedPhase = phases[phaseArrayIndex] || phases[0];
    if (!matchedPhase) return null;
    const subPhaseName = CalendariaCalendar.#getSubPhaseName(matchedPhase, dayWithinPhase, phaseDuration);
    return { name: matchedPhase.name, subPhaseName, icon: matchedPhase.icon || '', position: normalizedPosition, dayInCycle: dayIndex, phaseIndex: phaseArrayIndex, dayWithinPhase, phaseDuration };
  }

  /**
   * Build FC-style phase day distribution.
   * Primary phases (new moon at 0, full moon at 4) get floor(cycleLength/8) days,
   * remaining phases split leftover days evenly.
   * @param {number} cycleLength  Total days in moon cycle.
   * @param {number} numPhases  Number of phases (typically 8).
   * @returns {number[]}  Array of days per phase.
   * @private
   */
  static #buildPhaseDayDistribution(cycleLength, numPhases = 8) {
    if (numPhases !== 8) {
      const baseDays = Math.floor(cycleLength / numPhases);
      const remainder = cycleLength % numPhases;
      return Array.from({ length: numPhases }, (_, i) => baseDays + (i < remainder ? 1 : 0));
    }
    const primaryDays = Math.floor(cycleLength / 8);
    const totalPrimaryDays = primaryDays * 2;
    const remainingDays = cycleLength - totalPrimaryDays;
    const secondaryDays = Math.floor(remainingDays / 6);
    const extraDays = remainingDays % 6;
    const distribution = [];
    let extraAssigned = 0;
    for (let i = 0; i < 8; i++) {
      if (i === 0 || i === 4) {
        distribution.push(primaryDays);
      } else {
        const extra = extraAssigned < extraDays ? 1 : 0;
        distribution.push(secondaryDays + extra);
        extraAssigned++;
      }
    }

    return distribution;
  }

  /**
   * Get sub-phase name based on position within phase.
   * Uses stored rising/fading if available, otherwise generates from localization.
   * @param {object} phase  Phase object with name, rising, fading.
   * @param {number} dayWithinPhase  Current day within this phase (0-indexed).
   * @param {number} phaseDuration  Total days in this phase.
   * @returns {string}  Sub-phase name.
   * @private
   */
  static #getSubPhaseName(phase, dayWithinPhase, phaseDuration) {
    const phaseName = phase.name;
    if (phaseDuration <= 1) return localize(phaseName);
    const third = phaseDuration / 3;

    if (dayWithinPhase < third) {
      if (phase.rising) return localize(phase.rising);
      return format('CALENDARIA.MoonPhase.SubPhase.Rising', { phase: localize(phaseName) });
    } else if (dayWithinPhase >= phaseDuration - third) {
      if (phase.fading) return localize(phase.fading);
      return format('CALENDARIA.MoonPhase.SubPhase.Fading', { phase: localize(phaseName) });
    }
    return localize(phaseName);
  }

  /**
   * Get all moon phases for the current time.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {Array<{name: string, icon: string, position: number}>} - All moon phase data
   */
  getAllMoonPhases(time = game.time.worldTime) {
    return this.moonsArray.map((_moon, index) => this.getMoonPhase(index, time)).filter(Boolean);
  }

  /**
   * Convert time components to total days (helper for moon calculations).
   * @param {object} components  Time components (can have 'day' or 'dayOfMonth').
   * @returns {number}  Total days since epoch.
   * @private
   */
  _componentsToDays(components) {
    if (!components) return 0;
    const year = Number(components.year) || 0;
    const month = Number(components.month) || 0;
    const dayOfMonth = components.dayOfMonth ?? (Number(components.day) || 1) - 1;
    const normalized = { year, month, dayOfMonth, hour: Number(components.hour) || 0, minute: Number(components.minute) || 0, second: Number(components.second) || 0 };
    const worldTime = this.componentsToTime(normalized);
    const secondsPerDay = (this.days?.hoursPerDay || 24) * (this.days?.minutesPerHour || 60) * (this.days?.secondsPerMinute || 60);
    return Math.floor(worldTime / secondsPerDay);
  }

  /**
   * Calculate the day-of-year bounds for a periodic season.
   * @param {number} seasonIndex - Index of the season in values array
   * @param {number} [totalDays] - Total days in the year (optional, calculated if not provided)
   * @returns {{dayStart: number, dayEnd: number}} 0-indexed day bounds
   */
  _calculatePeriodicSeasonBounds(seasonIndex, totalDays) {
    const seasons = this.seasonsArray;
    if (!seasons.length || seasonIndex < 0 || seasonIndex >= seasons.length) return { dayStart: 0, dayEnd: 0 };
    totalDays ??= this.getDaysInYear(1);
    const offset = this.seasons?.offset ?? 0;
    let dayStart = offset;
    for (let i = 0; i < seasonIndex; i++) dayStart += seasons[i].duration ?? Math.floor(totalDays / seasons.length);
    dayStart = dayStart % totalDays;
    const duration = seasons[seasonIndex].duration ?? Math.floor(totalDays / seasons.length);
    let dayEnd = (dayStart + duration - 1) % totalDays;
    return { dayStart, dayEnd };
  }

  /**
   * Get the current season for a given time.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {object|null} Current season.
   */
  getCurrentSeason(time = game.time.worldTime) {
    const seasons = this.seasonsArray;
    if (!seasons.length) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const months = this.monthsArray;
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) dayOfYear += months[i]?.days ?? 0;
    if (this.seasons.type === 'periodic') {
      const totalDays = this.getDaysInYear(components.year);
      for (let i = 0; i < seasons.length; i++) {
        const { dayStart, dayEnd } = this._calculatePeriodicSeasonBounds(i, totalDays);
        if (dayStart <= dayEnd) {
          if (dayOfYear >= dayStart && dayOfYear <= dayEnd) return seasons[i];
        } else {
          if (dayOfYear >= dayStart || dayOfYear <= dayEnd) return seasons[i];
        }
      }

      return seasons[0] ?? null;
    }

    for (const season of seasons) {
      if (season.monthStart != null && season.monthEnd != null) {
        const currentMonth = components.month + 1;
        const startDay = season.dayStart ?? 1;
        const endDay = season.dayEnd ?? months[season.monthEnd - 1]?.days ?? 30;
        if (season.monthStart <= season.monthEnd) {
          if (currentMonth > season.monthStart && currentMonth < season.monthEnd) return season;
          if (currentMonth === season.monthStart && components.dayOfMonth + 1 >= startDay) return season;
          if (currentMonth === season.monthEnd && components.dayOfMonth + 1 <= endDay) return season;
        } else {
          if (currentMonth > season.monthStart || currentMonth < season.monthEnd) return season;
          if (currentMonth === season.monthStart && components.dayOfMonth + 1 >= startDay) return season;
          if (currentMonth === season.monthEnd && components.dayOfMonth + 1 <= endDay) return season;
        }
      } else if (season.dayStart != null && season.dayEnd != null) {
        if (season.dayStart <= season.dayEnd) {
          if (dayOfYear >= season.dayStart && dayOfYear <= season.dayEnd) return season;
        } else {
          if (dayOfYear >= season.dayStart || dayOfYear <= season.dayEnd) return season;
        }
      }
    }

    return seasons[0] ?? null;
  }

  /**
   * Get all seasons for this calendar.
   * @returns {Array<object>} All seasons
   */
  getAllSeasons() {
    return this.seasonsArray;
  }

  /**
   * Get weekday data for a specific month, falling back to calendar-level weekdays.
   * @param {number} monthIndex - 0-indexed month
   * @returns {Array<object>} Weekdays in month
   */
  getWeekdaysForMonth(monthIndex) {
    const month = this.monthsArray[monthIndex];
    const monthWeekdays = month?.weekdays ? Object.values(month.weekdays) : [];
    if (monthWeekdays.length) return monthWeekdays;
    return this.weekdaysArray;
  }

  /**
   * Get weekday info for a specific date.
   * @param {number|object} [time] - Time to check, defaults to current world time
   * @returns {object|null} Weekday for date
   */
  getWeekdayForDate(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const weekdays = this.getWeekdaysForMonth(components.month);
    const weekdayIndex = this._computeDayOfWeek(components);
    const weekday = weekdays[weekdayIndex];
    if (!weekday) return null;
    return { ...weekday, index: weekdayIndex };
  }

  /**
   * Compute the day-of-week index for decomposed time components.
   * @param {object} components - Components from timeToComponents ({year, month, dayOfMonth})
   * @returns {number} 0-based weekday index
   */
  _computeDayOfWeek(components) {
    const daysInWeek = this.daysInWeek;
    const monthData = this.monthsArray[components.month];
    if (monthData?.startingWeekday != null) {
      const dayIndex = components.dayOfMonth ?? 0;
      const ctx = { year: components.year, month: components.month, dayOfMonth: dayIndex };
      const nonCounting = (this.countNonWeekdayFestivalsBefore?.(ctx) ?? 0) + (this.countIntercalaryDaysBefore?.(ctx) ?? 0);
      return (monthData.startingWeekday + dayIndex - nonCounting + daysInWeek * 100) % daysInWeek;
    }
    let dayOfYear = components.dayOfMonth ?? 0;
    for (let m = 0; m < components.month; m++) dayOfYear += this.getDaysInMonth(m, components.year);
    let totalDaysFromPriorYears = 0;
    if (components.year > 0) for (let y = 0; y < components.year; y++) totalDaysFromPriorYears += this.getDaysInYear(y);
    else if (components.year < 0) for (let y = -1; y >= components.year; y--) totalDaysFromPriorYears -= this.getDaysInYear(y);
    const totalDays = totalDaysFromPriorYears + dayOfYear;
    const ctx = { year: components.year, month: components.month, dayOfMonth: components.dayOfMonth ?? 0 };
    const totalNonCounting =
      (this.countNonWeekdayFestivalsBeforeYear?.(components.year) ?? 0) +
      (this.countNonWeekdayFestivalsBefore?.(ctx) ?? 0) +
      (this.countIntercalaryDaysBeforeYear?.(components.year) ?? 0) +
      (this.countIntercalaryDaysBefore?.(ctx) ?? 0);
    const firstWeekday = this.years?.firstWeekday ?? 0;
    const countingDays = totalDays - totalNonCounting;
    return (((countingDays + firstWeekday) % daysInWeek) + daysInWeek) % daysInWeek;
  }

  /**
   * Get the current era for a given year.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{name: string, abbreviation: string, yearInEra: number}|null} - Era data or null
   */
  getCurrentEra(time = game.time.worldTime) {
    const eras = this.erasArray;
    if (!eras.length) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);
    const sortedEras = [...eras].sort((a, b) => b.startYear - a.startYear);
    for (const era of sortedEras) {
      if (displayYear >= era.startYear && (era.endYear == null || displayYear <= era.endYear)) {
        return { name: era.name, abbreviation: era.abbreviation, yearInEra: displayYear - era.startYear + 1 };
      }
    }

    if (eras.length > 0) {
      const era = eras[0];
      return { name: era.name, abbreviation: era.abbreviation, yearInEra: displayYear };
    }

    return null;
  }

  /**
   * Get all eras for this calendar.
   * @returns {Array<object>} All eras
   */
  getAllEras() {
    return this.erasArray;
  }

  /**
   * Get the current canonical hour for a given time.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{name: string, abbreviation: string, startHour: number, endHour: number}|null} - Canonical hour or null
   */
  getCanonicalHour(time = game.time.worldTime) {
    const canonicalHours = this.canonicalHoursArray;
    if (!canonicalHours.length) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const currentHour = components.hour;

    for (const ch of canonicalHours) {
      if (ch.startHour <= ch.endHour)
        if (currentHour >= ch.startHour && currentHour < ch.endHour) return ch;
        else if (currentHour >= ch.startHour || currentHour < ch.endHour) return ch;
    }

    for (const ch of canonicalHours) if (currentHour === ch.endHour) return ch;
    return null;
  }

  /**
   * Get all canonical hours for this calendar.
   * @returns {Array<{name: string, abbreviation: string, startHour: number, endHour: number}>} - All canonical hours
   */
  getAllCanonicalHours() {
    return this.canonicalHoursArray;
  }

  /**
   * Get the current week number and name for a given time.
   * Supports both month-based and year-based week counting.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{weekNumber: number, weekName: string, weekAbbr: string, type: string}|null} - Week data or null
   */
  getCurrentWeek(time = game.time.worldTime) {
    const weekNames = this.namedWeeksArray;
    if (!weekNames.length) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const daysInWeek = this.daysInWeek;

    let weekNumber;
    if (this.weeks.type === 'month-based') {
      weekNumber = Math.floor(components.dayOfMonth / daysInWeek) + 1;
      const nameIndex = (weekNumber - 1) % weekNames.length;
      const week = weekNames[nameIndex];
      return { weekNumber, weekName: localize(week?.name ?? ''), weekAbbr: week?.abbreviation ? localize(week.abbreviation) : '', type: this.weeks.type };
    }

    // Year-based: use explicit weekNumber assignments
    const months = this.monthsArray;
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) dayOfYear += months[i]?.days ?? 0;
    weekNumber = Math.floor(dayOfYear / daysInWeek) + 1;

    let week = weekNames.find((w) => w.weekNumber === weekNumber);
    if (!week && this.weeks.repeat) {
      const sortedWeeks = [...weekNames].sort((a, b) => a.weekNumber - b.weekNumber);
      const index = (weekNumber - sortedWeeks[0].weekNumber) % sortedWeeks.length;
      week = sortedWeeks[((index % sortedWeeks.length) + sortedWeeks.length) % sortedWeeks.length];
    }
    if (!week) return { weekNumber, weekName: '', weekAbbr: '', type: this.weeks.type };
    return { weekNumber, weekName: localize(week.name ?? ''), weekAbbr: week.abbreviation ? localize(week.abbreviation) : '', type: this.weeks.type };
  }

  /**
   * Get week number within the year (1-indexed).
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {number} Week number (1-indexed).
   */
  getWeekOfYear(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const daysInWeek = this.daysInWeek;
    const months = this.monthsArray;
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) dayOfYear += months[i]?.days ?? 0;
    return Math.floor(dayOfYear / daysInWeek) + 1;
  }

  /**
   * Get week number within the month (1-indexed).
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {number} Week number (1-indexed).
   */
  getWeekOfMonth(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const daysInWeek = this.daysInWeek;
    return Math.floor(components.dayOfMonth / daysInWeek) + 1;
  }

  /**
   * Get all named weeks for this calendar.
   * @returns {Array<{name: string, abbreviation: string}>} - All named weeks
   */
  getAllNamedWeeks() {
    return this.namedWeeksArray;
  }

  /**
   * Get the current values for all cycles.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{text: string, values: Array<{cycleName: string, entryName: string, index: number}>}} - Cycle values
   */
  getCycleValues(time = game.time.worldTime) {
    const cycles = this.cyclesArray;
    if (!cycles.length) return { text: '', values: [] };
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);
    const epochValues = this._getCycleEpochValues(components, displayYear);
    const values = [];
    const textReplacements = {};

    for (let i = 0; i < cycles.length; i++) {
      const cycle = cycles[i];
      const stages = cycle.stages ? Object.values(cycle.stages) : [];
      if (!stages?.length) continue;
      const epochValue = epochValues[cycle.basedOn] ?? 0;
      const adjustedValue = epochValue + (cycle.offset || 0);
      let stageIndex = adjustedValue % stages.length;
      if (stageIndex < 0) stageIndex += stages.length;
      const stage = stages[stageIndex];
      values.push({ cycleName: cycle.name, entryName: stage?.name ?? '', index: stageIndex });
      textReplacements[(i + 1).toString()] = localize(stage?.name ?? '');
    }

    let text = this.cycleFormat || '';
    for (const [key, value] of Object.entries(textReplacements)) text = text.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
    return { text, values };
  }

  /**
   * Calculate epoch values for different cycle basedOn types.
   * @param {object} components - Time components.
   * @param {number} displayYear - The display year (with yearZero applied).
   * @returns {object} - Epoch values keyed by basedOn type.
   * @private
   */
  _getCycleEpochValues(components, displayYear) {
    const months = this.monthsArray;
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) dayOfYear += months[i]?.days ?? 0;
    const totalDays = this._componentsToDays(components);
    let eraYear = displayYear;
    const eras = this.erasArray;
    if (eras.length) {
      const sortedEras = [...eras].sort((a, b) => b.startYear - a.startYear);
      for (const era of sortedEras) {
        if (displayYear >= era.startYear && (era.endYear == null || displayYear <= era.endYear)) {
          eraYear = displayYear - era.startYear + 1;
          break;
        }
      }
    }
    return { year: displayYear, eraYear, month: components.month, monthDay: components.dayOfMonth, day: totalDays, yearDay: dayOfYear };
  }

  /**
   * Get all cycles for this calendar.
   * @returns {Array<{name: string, length: number, offset: number, basedOn: string, entries: Array}>} - All cycles
   */
  getAllCycles() {
    return this.cyclesArray;
  }

  /**
   * Get the current 1-indexed cycle number for a specific cycle.
   * Cycle 1 is the first cycle; negative years return Cycle 1.
   * @param {number} [cycleIndex] - Index of the cycle definition to use
   * @param {number|object} [time] - Time to use, by default the current world time
   * @returns {number} - 1-indexed cycle number (minimum 1)
   */
  getCurrentCycleNumber(cycleIndex = 0, time = game.time.worldTime) {
    const cycle = this.cyclesArray[cycleIndex];
    if (!cycle?.length) return 1;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);
    const epochValues = this._getCycleEpochValues(components, displayYear);
    const epochValue = epochValues[cycle.basedOn] ?? 0;
    const adjustedValue = epochValue + (cycle.offset || 0);
    const cycleNum = Math.floor(adjustedValue / cycle.length) + 1;
    return Math.max(1, cycleNum);
  }

  /**
   * Get the current cycle entry (named entry) for a specific cycle.
   * @param {number} [cycleIndex] - Index of the cycle definition to use
   * @param {number|object} [time] - Time to use, by default the current world time
   * @returns {{name: string, index: number, cycleNumber: number}|null} - Entry data or null
   */
  getCycleEntry(cycleIndex = 0, time = game.time.worldTime) {
    const cycle = this.cyclesArray[cycleIndex];
    const stages = cycle?.stages ? Object.values(cycle.stages) : [];
    if (!stages.length) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);
    const epochValues = this._getCycleEpochValues(components, displayYear);
    const epochValue = epochValues[cycle.basedOn] ?? 0;
    const adjustedValue = epochValue + (cycle.offset || 0);
    let stageIndex = adjustedValue % stages.length;
    if (stageIndex < 0) stageIndex += stages.length;
    const cycleNumber = Math.max(1, Math.floor(adjustedValue / cycle.length) + 1);
    const stage = stages[stageIndex];
    return { name: stage?.name ?? '', index: stageIndex, cycleNumber };
  }

  /**
   * Prepare formatting context from calendar and components.
   * @param {object} calendar  The calendar instance.
   * @param {object} components    Time components.
   * @returns {object} Formatting context with year, month, day parts.
   */
  static dateFormattingParts(calendar, components) {
    const month = calendar.monthsArray[components.month];
    const year = components.year + (calendar.years?.yearZero ?? 0);
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    const midday = Math.floor(hoursPerDay / 2);
    const hour24 = components.hour;
    const isPM = hour24 >= midday;
    const hour12 = hour24 === 0 ? midday : hour24 > midday ? hour24 - midday : hour24;
    const amPm = calendar.amPmNotation ?? {};
    const meridiemFull = isPM ? amPm.pm || 'PM' : amPm.am || 'AM';
    const period = isPM ? amPm.pmAbbr || meridiemFull : amPm.amAbbr || meridiemFull;
    const canonicalHour = calendar.getCanonicalHour?.(components);
    const chName = canonicalHour ? localize(canonicalHour.name) : '';
    const chAbbr = canonicalHour?.abbreviation ? localize(canonicalHour.abbreviation) : '';
    const currentWeek = calendar.getCurrentWeek?.(components);
    const weekName = currentWeek?.weekName ?? '';
    const weekAbbr = currentWeek?.weekAbbr ?? '';
    const weekNum = currentWeek?.weekNumber ?? calendar.getWeekOfYear?.(components) ?? 1;

    return {
      y: year,
      yyyy: String(year).padStart(4, '0'),
      B: localize(month?.name ?? 'CALENDARIA.Common.Unknown'),
      b: month?.abbreviation ?? '',
      m: month?.ordinal ?? components.month + 1,
      mm: String(month?.ordinal ?? components.month + 1).padStart(2, '0'),
      d: components.dayOfMonth + 1,
      dd: String(components.dayOfMonth + 1).padStart(2, '0'),
      D: components.dayOfMonth + 1,
      j: String(components.day + 1).padStart(3, '0'),
      w: String(components.dayOfWeek + 1),
      H: String(components.hour).padStart(2, '0'),
      h: String(hour12),
      hh: String(hour12).padStart(2, '0'),
      M: String(components.minute).padStart(2, '0'),
      S: String(components.second).padStart(2, '0'),
      p: period,
      P: period.toUpperCase(),
      ch: chName,
      chAbbr: chAbbr,
      W: weekNum,
      WW: String(weekNum).padStart(2, '0'),
      WN: weekName,
      Wn: weekAbbr
    };
  }

  /**
   * Format month and day, accounting for festival days.
   * @param {object} calendar - The calendar instance.
   * @param {object} components - Time components.
   * @param {object} _options - Formatting options.
   * @returns {string} Formatted date string.
   */
  static formatMonthDay(calendar, components, _options = {}) {
    const yearZero = calendar?.years?.yearZero ?? 0;
    const internalYear = components.year - yearZero;
    const festivalDay = calendar.findFestivalDay?.({ ...components, year: internalYear, dayOfMonth: components.dayOfMonth - 1 });
    if (festivalDay) return localize(festivalDay.name);
    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    return format('CALENDARIA.Formatters.DayMonth', { day: context.d, month: context.B });
  }

  /**
   * Format full date with month, day, and year, accounting for festival days.
   * @param {object} calendar - The calendar instance.
   * @param {object} components - Time components.
   * @param {object} _options - Formatting options.
   * @returns {string} Formatted date string.
   */
  static formatMonthDayYear(calendar, components, _options = {}) {
    const yearZero = calendar?.years?.yearZero ?? 0;
    const internalYear = components.year - yearZero;
    const festivalDay = calendar.findFestivalDay?.({ ...components, year: internalYear, dayOfMonth: components.dayOfMonth - 1 });
    if (festivalDay) {
      const context = CalendariaCalendar.dateFormattingParts(calendar, components);
      return format('CALENDARIA.Formatters.FestivalDayYear', { day: localize(festivalDay.name), yyyy: context.y });
    }

    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    return format('CALENDARIA.Formatters.DayMonthYear', { day: context.d, month: context.B, yyyy: context.y });
  }

  /**
   * Format hours and minutes.
   * @param {object} calendar - The calendar instance.
   * @param {object} components - Time components.
   * @param {object} _options - Formatting options.
   * @returns {string} Formatted time string.
   */
  static formatHoursMinutes(calendar, components, _options = {}) {
    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    return `${context.H}:${context.M}`;
  }

  /**
   * Format hours, minutes, and seconds.
   * @param {object} calendar - The calendar instance.
   * @param {object} components - Time components.
   * @param {object} _options - Formatting options.
   * @returns {string} Formatted time string.
   */
  static formatHoursMinutesSeconds(calendar, components, _options = {}) {
    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    return `${context.H}:${context.M}:${context.S}`;
  }

  /**
   * Format time in 12-hour format with AM/PM notation.
   * @param {object} calendar - The calendar instance.
   * @param {object} components - Time components.
   * @param {object} options - Formatting options.
   * @param {boolean} [options.seconds] - Include seconds.
   * @returns {string} Formatted time string (e.g., "3:45 PM").
   */
  static formatTime12Hour(calendar, components, options = {}) {
    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    if (options.seconds) return `${context.h}:${context.M}:${context.S} ${context.p}`;
    return `${context.h}:${context.M} ${context.p}`;
  }

  /**
   * Format a date using a custom template or predefined format.
   * @param {object} calendar - The calendar instance.
   * @param {object} components - Time components.
   * @param {string} format - Template key (dateShort, dateLong, dateFull, time24, time12, etc.) or custom template.
   * @returns {string} Formatted date string.
   */
  static formatDateWithTemplate(calendar, components, format = 'dateLong') {
    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    let template;
    if (calendar.dateFormats?.[format]) {
      template = calendar.dateFormats[format];
    } else if (format.includes('{{') || format.includes('[')) {
      template = format;
    } else {
      const defaults = {
        dateShort: 'D MMM',
        dateMedium: 'D MMMM',
        dateLong: 'D MMMM, YYYY',
        dateFull: 'EEEE, D MMMM YYYY',
        time24: 'HH:mm',
        time12: 'h:mm A',
        time24Sec: 'HH:mm:ss',
        time12Sec: 'h:mm:ss A'
      };
      template = defaults[format] ?? defaults.dateLong;
    }

    return template.replace(/\[(\w+)]/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }

  /**
   * Get available format variables with descriptions.
   * @returns {object} Map of variable names to descriptions.
   */
  static getFormatVariables() {
    return {
      y: localize('CALENDARIA.FormatVar.y'),
      yyyy: localize('CALENDARIA.FormatVar.yyyy'),
      B: localize('CALENDARIA.FormatVar.B'),
      b: localize('CALENDARIA.FormatVar.b'),
      m: localize('CALENDARIA.FormatVar.m'),
      mm: localize('CALENDARIA.FormatVar.mm'),
      d: localize('CALENDARIA.FormatVar.d'),
      dd: localize('CALENDARIA.FormatVar.dd'),
      j: localize('CALENDARIA.FormatVar.j'),
      w: localize('CALENDARIA.FormatVar.w'),
      H: localize('CALENDARIA.FormatVar.H'),
      h: localize('CALENDARIA.FormatVar.h'),
      hh: localize('CALENDARIA.FormatVar.hh'),
      M: localize('CALENDARIA.FormatVar.M'),
      S: localize('CALENDARIA.FormatVar.S'),
      p: localize('CALENDARIA.FormatVar.p'),
      P: localize('CALENDARIA.FormatVar.P'),
      ch: localize('CALENDARIA.FormatVar.ch'),
      chAbbr: localize('CALENDARIA.FormatVar.chAbbr'),
      W: localize('CALENDARIA.FormatVar.W'),
      WW: localize('CALENDARIA.FormatVar.WW'),
      WN: localize('CALENDARIA.FormatVar.WN'),
      Wn: localize('CALENDARIA.FormatVar.Wn')
    };
  }

  /**
   * Get the active climate zone configuration.
   * @returns {object|null} Active zone object or null
   */
  getActiveClimateZone() {
    const zones = this.weatherZonesArray;
    const activeId = this.weather?.activeZone ?? 'temperate';
    return zones.find((z) => z.id === activeId) ?? zones[0] ?? null;
  }

  /**
   * Get a climate zone by ID.
   * @param {string} id - Zone ID
   * @returns {object|null} Zone object or null
   */
  getClimateZoneById(id) {
    return this.weatherZonesArray.find((z) => z.id === id) ?? null;
  }

  /**
   * Get temperature range for a season in a specific zone.
   * Falls back to _default if season not found.
   * @param {string} zoneId - Climate zone ID
   * @param {string} seasonName - Season name (localized or key)
   * @returns {{min: number, max: number}} Temperature range
   */
  getTemperatureForSeason(zoneId, seasonName) {
    const zone = this.getClimateZoneById(zoneId);
    if (!zone?.temperatures) return { min: 10, max: 22 };
    const temps = zone.temperatures;
    if (temps[seasonName]) return temps[seasonName];
    const lowerSeason = seasonName?.toLowerCase();
    const matchedKey = Object.keys(temps).find((k) => k.toLowerCase() === lowerSeason);
    if (matchedKey) return temps[matchedKey];
    return temps._default ?? { min: 10, max: 22 };
  }

  /**
   * Get all climate zone IDs for this calendar.
   * @returns {string[]} Array of zone IDs
   */
  getClimateZoneIds() {
    return this.weatherZonesArray.map((z) => z.id);
  }
}
