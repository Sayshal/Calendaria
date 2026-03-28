/**
 * Extended calendar data model with Calendaria-specific features.
 * @extends foundry.data.CalendarData
 * @module Calendar/Data/CalendariaCalendar
 * @author Tyler
 */

import { CalendarRegistry, getLeapYearDescription, intersectsYear, parseInterval, parsePattern } from '../calendar/_module.mjs';
import { DEFAULT_MOON_PHASES } from '../constants.mjs';
import { format, localize } from '../utils/_module.mjs';
import { resolveRandomizedPhase } from './_module.mjs';

const { ArrayField, BooleanField, NumberField, SchemaField, StringField, TypedObjectField } = foundry.data.fields;

/**
 * Calendar data model with extended features for fantasy calendars.
 */
export default class CalendariaCalendar extends foundry.data.CalendarData {
  /** @type {number} Epoch offset in seconds */
  static #epochOffset = 0;

  /** @type {Object<string, string[]>} Maps date themes to accepted Calendaria calendar IDs */
  static #themeCalendarMap = { AR: ['golarion'], IC: ['golarion-imperial', 'golarion'], AG: ['golarion', 'pact-standard'], AD: ['gregorian'], CE: ['gregorian'] };

  /**
   * Get the active system world clock (PF2E or SF2E).
   * @returns {object|null} The worldClock object or null
   */
  static get #systemWorldClock() {
    return game.pf2e?.worldClock ?? game.sf2e?.worldClock ?? null;
  }

  /**
   * Whether system world clock sync is currently active.
   * @returns {boolean} True if a compatible worldClock exists and active calendar matches the theme
   */
  static get usePF2eSync() {
    const wc = this.#systemWorldClock;
    if (!wc) return false;
    const acceptedCalendars = this.#themeCalendarMap[wc.dateTheme];
    if (!acceptedCalendars) return false;
    const activeCalendarId = game.settings.get('calendaria', 'activeCalendar');
    return acceptedCalendars.includes(activeCalendarId);
  }

  /**
   * Initialize epoch offset for system world clock sync (PF2E/SF2E).
   */
  static initializeEpochOffset() {
    this.#epochOffset = 0;
    if (!this.usePF2eSync) return;
    const calendar = CalendarRegistry.getActive();
    if (!calendar) return;
    const wc = this.#systemWorldClock;
    const dt = wc.worldCreatedOn.plus({ seconds: game.time.worldTime });
    const secondsPerMinute = calendar.time?.secondsPerMinute ?? 60;
    const minutesPerHour = calendar.time?.minutesPerHour ?? 60;
    const hoursPerDay = calendar.time?.hoursPerDay ?? 24;
    const secondsPerHour = minutesPerHour * secondsPerMinute;
    const secondsPerDay = hoursPerDay * secondsPerHour;
    const internalYear = dt.year;
    let dayOfYear = dt.day - 1;
    for (let m = 0; m < dt.month - 1; m++) dayOfYear += calendar.getDaysInMonth?.(m, internalYear) ?? 30;
    let totalDays = calendar.totalDaysBeforeYear?.(internalYear) ?? 0;
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
    const activeCalendarId = game.settings.get('calendaria', 'activeCalendar');
    const isoOfFirstWeekday = activeCalendarId === 'gregorian' ? 7 : 1;
    const expectedWeekday = (((dt.weekday - isoOfFirstWeekday) % numWeekdays) + numWeekdays) % numWeekdays;
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
   * @returns {{year: number, month: number, day: number, hour: number, minute: number}} Current date
   */
  get currentDate() {
    const components = this.timeToComponents(game.time.worldTime);
    return {
      year: components.year + (this.years?.yearZero ?? 0),
      month: components.month,
      day: components.dayOfMonth + 1,
      dayOfMonth: components.dayOfMonth,
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
   * Check if this calendar operates without named months
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
    let dayOfMonth = Math.floor(adjustedTime / secondsPerDay);
    const daySeconds = adjustedTime - dayOfMonth * secondsPerDay;
    const hour = Math.floor(daySeconds / secondsPerHour);
    const minute = Math.floor((daySeconds % secondsPerHour) / secondsPerMinute);
    const second = Math.floor(daySeconds % secondsPerMinute);
    const { regular: regularDays } = this._getDaysPerYear();
    let year = regularDays > 0 ? Math.floor(dayOfMonth / regularDays) : 0;
    let dby = this.totalDaysBeforeYear(year);
    while (dby > dayOfMonth) {
      year--;
      dby = this.totalDaysBeforeYear(year);
    }
    let nextDby = this.totalDaysBeforeYear(year + 1);
    while (nextDby <= dayOfMonth) {
      year++;
      dby = nextDby;
      nextDby = this.totalDaysBeforeYear(year + 1);
    }
    dayOfMonth -= dby;
    let month = 0;
    const months = this.monthsArray;
    const isLeap = this.isLeapYear(year);
    while (month < months.length) {
      const m = months[month];
      const d = isLeap && m.leapDays != null ? m.leapDays : m.days;
      if (dayOfMonth < d) break;
      dayOfMonth -= d;
      month++;
    }
    return { year, month, dayOfMonth, hour, minute, second };
  }

  /** @override */
  componentsToTime(components) {
    const { year = 0, month = 0, dayOfMonth = 0, hour = 0, minute = 0, second = 0 } = components;
    const secondsPerMinute = this.days?.secondsPerMinute ?? 60;
    const minutesPerHour = this.days?.minutesPerHour ?? 60;
    const hoursPerDay = this.days?.hoursPerDay ?? 24;
    const secondsPerHour = secondsPerMinute * minutesPerHour;
    const secondsPerDay = secondsPerHour * hoursPerDay;
    let totalDays = this.totalDaysBeforeYear(year);
    for (let m = 0; m < month; m++) totalDays += this.getDaysInMonth(m, year);
    totalDays += dayOfMonth;
    const totalSeconds = totalDays * secondsPerDay + hour * secondsPerHour + minute * secondsPerMinute + second;
    return totalSeconds - CalendariaCalendar.epochOffset;
  }

  /**
   * Migrate source data before schema validation.
   * @param {object} source - Raw source data
   * @returns {object} Migrated source data
   * @override
   */
  static migrateData(source) {
    CalendariaCalendar.#migrateDateIndexing(source);
    CalendariaCalendar.#migrateFestivalIcons(source);
    CalendariaCalendar.#migrateFestivalConditionTrees(source);
    return super.migrateData(source);
  }

  /**
   * Migrate date fields from 1-indexed to 0-indexed conventions.
   * @deprecated since 0.10.4 — remove in 1.1.0
   * @param {object} source - Raw source data
   */
  static #migrateDateIndexing(source) {
    const festivals = source.festivals ? Object.values(source.festivals) : [];
    const moons = source.moons ? Object.values(source.moons) : [];
    const hasOldFestival = festivals.some((f) => 'day' in f && !('dayOfMonth' in f));
    const hasOldMoon = moons.some((m) => m.referenceDate && 'day' in m.referenceDate && !('dayOfMonth' in m.referenceDate));
    if (!hasOldFestival && !hasOldMoon) return;
    for (const f of festivals) {
      if (!('day' in f) || 'dayOfMonth' in f) continue;
      f.dayOfMonth = (f.day ?? 1) - 1;
      delete f.day;
      if (f.month != null && f.month >= 1) f.month -= 1;
      if (f.dayOfYear != null && f.dayOfYear >= 1) f.dayOfYear -= 1;
    }
    if (hasOldFestival && source.seasons?.values) {
      for (const s of Object.values(source.seasons.values)) {
        if (s.monthStart != null && s.monthStart >= 1) s.monthStart -= 1;
        if (s.monthEnd != null && s.monthEnd >= 1) s.monthEnd -= 1;
      }
    }
    for (const m of moons) {
      if (m.referenceDate && 'day' in m.referenceDate && !('dayOfMonth' in m.referenceDate)) {
        m.referenceDate.dayOfMonth = (m.referenceDate.day ?? 1) - 1;
        delete m.referenceDate.day;
      }
    }
    if (source.currentDate && 'day' in source.currentDate && !('dayOfMonth' in source.currentDate)) {
      source.currentDate.dayOfMonth = (source.currentDate.day ?? 1) - 1;
      delete source.currentDate.day;
    }
  }

  /**
   * Strip legacy `fas ` prefix from festival icons.
   * @deprecated since 1.0.0 — remove in 1.2.0
   * @param {object} source - Raw source data
   * @private
   */
  static #migrateFestivalIcons(source) {
    if (!source.festivals) return;
    for (const fest of Object.values(source.festivals)) {
      if (typeof fest.icon !== 'string') continue;
      if (fest.icon.startsWith('fas ')) fest.icon = fest.icon.slice(4);
      else if (fest.icon.startsWith('fa-solid ')) fest.icon = fest.icon.slice(9);
    }
  }

  /**
   * Populate conditionTree on festivals that only have month+day fields.
   * @param {object} source - Raw source data
   * @since 1.1.0
   * @deprecated Remove in 1.3.0
   * @private
   */
  static #migrateFestivalConditionTrees(source) {
    if (!source.festivals) return;
    for (const fest of Object.values(source.festivals)) {
      if (fest.conditionTree != null) continue;
      let dateCondition;
      if (fest.dayOfYear != null) {
        dateCondition = { type: 'condition', field: 'dayOfYear', op: '==', value: fest.dayOfYear + 1 };
      } else if (fest.month != null && fest.dayOfMonth != null) {
        dateCondition = {
          type: 'group',
          mode: 'and',
          children: [
            { type: 'condition', field: 'month', op: '==', value: fest.month + 1 },
            { type: 'condition', field: 'day', op: '==', value: fest.dayOfMonth + 1 }
          ]
        };
      }
      if (!dateCondition) continue;
      if (fest.leapYearOnly) {
        fest.conditionTree = {
          type: 'group',
          mode: 'and',
          children: [{ type: 'condition', field: 'isLeapYear', op: '==', value: 1 }, dateCondition]
        };
      } else {
        fest.conditionTree = dateCondition;
      }
    }
  }

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    const extendedYearsSchema = new SchemaField({
      yearZero: new NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
      firstWeekday: new NumberField({ required: true, nullable: false, min: 0, integer: true }),
      leapYear: new SchemaField(
        { leapStart: new NumberField({ required: true, nullable: false, integer: true }), leapInterval: new NumberField({ required: true, nullable: false, min: 2, integer: true }) },
        { required: true, nullable: true, initial: null }
      ),
      names: new ArrayField(new SchemaField({ year: new NumberField({ required: true, integer: true }), name: new StringField({ required: true }) }), { required: false, initial: [] })
    });
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
    const climatePresetSchema = new SchemaField({ id: new StringField({ required: true }), chance: new NumberField({ required: false, initial: 0, min: 0 }) });
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
            monthStart: new NumberField({ required: false, integer: true, min: 0, nullable: true }),
            monthEnd: new NumberField({ required: false, integer: true, min: 0, nullable: true }),
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
      years: extendedYearsSchema,
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
          month: new NumberField({ required: false, nullable: true, min: 0, integer: true }),
          dayOfMonth: new NumberField({ required: false, nullable: true, min: 0, integer: true }),
          dayOfYear: new NumberField({ required: false, nullable: true, min: 0, max: 400, integer: true }),
          duration: new NumberField({ required: false, nullable: false, min: 1, integer: true, initial: 1 }),
          leapDuration: new NumberField({ required: false, nullable: true, min: 1, integer: true }),
          leapYearOnly: new BooleanField({ required: false, initial: false }),
          countsForWeekday: new BooleanField({ required: false, initial: true }),
          conditionTree: new foundry.data.fields.ObjectField({ nullable: true, initial: null })
        })
      ),
      moons: new TypedObjectField(
        new SchemaField({
          name: new StringField({ required: true }),
          cycleLength: new NumberField({ required: true, nullable: false, min: 1 }),
          cycleDayAdjust: new NumberField({ required: false, nullable: false, initial: 0 }),
          referencePhase: new NumberField({ required: false, nullable: false, initial: 0, integer: true, min: 0 }),
          color: new StringField({ required: false, initial: '' }),
          moonBrightnessMax: new NumberField({ required: false, nullable: true, initial: null, min: 0, max: 0.3 }),
          phaseMode: new StringField({ required: false, initial: 'fixed', choices: ['fixed', 'randomized'] }),
          phaseSeed: new NumberField({ required: false, nullable: false, integer: true, initial: 0 }),
          cycleVariance: new NumberField({ required: false, nullable: false, initial: 0, min: 0, max: 1 }),
          anchorPhases: new TypedObjectField(
            new SchemaField({
              year: new NumberField({ required: false, nullable: true, integer: true }),
              month: new NumberField({ required: true, integer: true, min: 0 }),
              dayOfMonth: new NumberField({ required: true, integer: true, min: 0 }),
              phaseIndex: new NumberField({ required: true, integer: true, min: 0 })
            })
          ),
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
            dayOfMonth: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
          }),
          eclipseMode: new StringField({ required: false, initial: 'never', choices: ['never', 'rare', 'occasional', 'frequent', 'custom'] }),
          nodalPeriod: new NumberField({ required: false, nullable: true, initial: null, min: 1 }),
          apparentSize: new NumberField({ required: false, nullable: false, initial: 1.0, min: 0.1, max: 2.0 })
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
          dayOfMonth: new NumberField({ required: true, integer: true, min: 0 }),
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
                  tempMin: new StringField({ required: false, nullable: true, initial: null }),
                  tempMax: new StringField({ required: false, nullable: true, initial: null }),
                  description: new StringField({ required: false })
                })
              ),
              seasonOverrides: new foundry.data.fields.ObjectField({ required: false, initial: {} }),
              windDirections: new foundry.data.fields.ObjectField({ required: false, initial: {} }),
              windSpeedRange: new SchemaField(
                {
                  min: new NumberField({ required: false, nullable: true, initial: null, min: 0, max: 5 }),
                  max: new NumberField({ required: false, nullable: true, initial: null, min: 0, max: 5 })
                },
                { required: false }
              ),
              colorShift: new SchemaField(
                {
                  dawnHue: new NumberField({ required: false, nullable: true, initial: null, min: 0, max: 360 }),
                  duskHue: new NumberField({ required: false, nullable: true, initial: null, min: 0, max: 360 }),
                  nightHue: new NumberField({ required: false, nullable: true, initial: null, min: 0, max: 360 }),
                  transitionMinutes: new NumberField({ required: false, nullable: true, initial: null, min: 0 })
                },
                { required: false }
              )
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
   * @param {number} year - The internal year to check (0-based from calendar epoch)
   * @returns {boolean} True if the year is a leap year
   */
  isLeapYear(year) {
    const { intervals, yearZero } = this._getLeapYearLookup();
    if (!intervals.length) return false;
    return intersectsYear(intervals, year + yearZero, true);
  }

  /**
   * Build or retrieve cached leap year lookup table for O(1) leap year counting.
   * @returns {{intervals: Array, period: number, perPeriod: number, cumulative: Int32Array|null, yearZero: number}} Lookup table
   */
  _getLeapYearLookup() {
    const advancedConfig = this.leapYearConfig;
    const leapConfig = this.years?.leapYear;
    const yearZero = this.years?.yearZero ?? 0;
    const key = `${advancedConfig?.rule}|${advancedConfig?.interval}|${advancedConfig?.start}|${advancedConfig?.pattern}|${leapConfig?.leapInterval}|${leapConfig?.leapStart}|${yearZero}`;
    if (this.__leapLookup?.key === key) return this.__leapLookup;
    this.__dpy = null;
    let intervals = [];
    if (advancedConfig?.rule && advancedConfig.rule !== 'none') {
      const start = advancedConfig.start ?? 0;
      switch (advancedConfig.rule) {
        case 'simple': {
          const interval = advancedConfig.interval;
          if (interval && interval > 0) intervals = [parseInterval(String(interval), start)];
          break;
        }
        case 'gregorian':
          intervals = parsePattern('400,!100,4', start);
          break;
        case 'custom':
          if (advancedConfig.pattern) intervals = parsePattern(advancedConfig.pattern, start);
          break;
      }
    } else if (leapConfig) {
      const interval = leapConfig.leapInterval;
      const start = leapConfig.leapStart ?? 0;
      if (interval && interval > 0) intervals = [parseInterval(String(interval), start)];
    }
    if (!intervals.length) {
      const lookup = { key, intervals, period: 1, perPeriod: 0, cumulative: null, yearZero };
      this.__leapLookup = lookup;
      return lookup;
    }
    const gcd = (a, b) => {
      a = Math.abs(a);
      b = Math.abs(b);
      while (b) [a, b] = [b, a % b];
      return a;
    };
    const period = intervals.reduce((acc, iv) => (acc / gcd(acc, iv.interval)) * iv.interval, 1);
    let cumulative = null;
    let perPeriod = 0;
    if (period <= 100_000) {
      cumulative = new Int32Array(period + 1);
      for (let i = 0; i < period; i++) cumulative[i + 1] = cumulative[i] + (intersectsYear(intervals, i, true) ? 1 : 0);
      perPeriod = cumulative[period];
    }
    const lookup = { key, intervals, period, perPeriod, cumulative, yearZero };
    this.__leapLookup = lookup;
    return lookup;
  }

  /**
   * Count leap years in display year range [0, displayYear) using period-based O(1) math.
   * @param {number} displayYear - Display year
   * @returns {number} Count of leap years
   */
  _cumulativeLeapCount(displayYear) {
    const { period, perPeriod, cumulative, intervals } = this._getLeapYearLookup();
    if (!cumulative) {
      let count = 0;
      if (displayYear > 0) {
        for (let y = 0; y < displayYear; y++) if (intersectsYear(intervals, y, true)) count++;
      } else {
        for (let y = -1; y >= displayYear; y--) if (intersectsYear(intervals, y, true)) count--;
      }
      return count;
    }
    if (perPeriod === 0) return 0;
    const fullPeriods = Math.floor(displayYear / period);
    const remainder = ((displayYear % period) + period) % period;
    return fullPeriods * perPeriod + cumulative[remainder];
  }

  /**
   * Get days-per-year for regular and leap years (cached).
   * @returns {{regular: number, leap: number}} Days per regular and leap year
   */
  _getDaysPerYear() {
    if (this.__dpy) return this.__dpy;
    let regular, leap;
    if (this.isMonthless) {
      regular = this.days?.daysPerYear ?? 365;
      leap = regular + 1;
    } else {
      regular = 0;
      leap = 0;
      for (const m of this.monthsArray) {
        regular += m.days ?? 0;
        leap += m.leapDays ?? m.days ?? 0;
      }
    }
    this.__dpy = { regular, leap };
    return this.__dpy;
  }

  /**
   * Get total days from epoch (internal year 0) to the start of the given internal year. O(1).
   * @param {number} year - Internal year (0-based)
   * @returns {number} Signed total days
   */
  totalDaysBeforeYear(year) {
    if (year === 0) return 0;
    const leapCount = this.countLeapYearsBefore(year);
    const { regular, leap } = this._getDaysPerYear();
    return year * regular + leapCount * (leap - regular);
  }

  /**
   * Count leap years between epoch (internal year 0) and the given internal year. O(1).
   * @param {number} year - Internal year (0-based)
   * @returns {number} Signed leap year count (positive for future, negative for past)
   */
  countLeapYearsBefore(year) {
    if (year === 0) return 0;
    const { yearZero } = this._getLeapYearLookup();
    return this._cumulativeLeapCount(yearZero + year) - this._cumulativeLeapCount(yearZero);
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
    if (advancedConfig?.rule && advancedConfig.rule !== 'none') return getLeapYearDescription(advancedConfig);
    const leapConfig = this.years?.leapYear;
    if (!leapConfig) return getLeapYearDescription(null);
    return getLeapYearDescription({ rule: 'simple', interval: leapConfig.leapInterval, start: leapConfig.leapStart ?? 0 });
  }

  /**
   * Compute daylight hours from latitude using the astronomical hour-angle formula.
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
    const peak = summerSolsticeDay ?? Math.round(daysPerYear * 0.47);
    const yearProgress = ((dayOfYear - peak) / daysPerYear) * 2 * Math.PI;
    const declination = tiltRad * Math.cos(yearProgress);
    const cosHourAngle = -Math.tan(latRad) * Math.tan(declination);
    if (cosHourAngle <= -1) return hoursPerDay;
    if (cosHourAngle >= 1) return 0;
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
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @param {object} [zone] - Optional climate zone with latitude/daylight overrides.
   * @returns {number} - Solar midday time in hours.
   */
  solarMidday(time = game.time.components, zone = null) {
    return (this.sunrise(time, zone) + this.sunset(time, zone)) / 2;
  }

  /**
   * Get solar midnight - the midpoint of the night period.
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
   * @param {number|object} [time] - The time to use.
   * @param {object} [zone] - Optional climate zone with latitude/daylight overrides.
   * @returns {number} - Hours of daylight for this day.
   * @private
   */
  _getDaylightHoursForDay(time = game.time.components, zone = null) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const hoursPerDay = this.days.hoursPerDay;
    const daysPerYear = this.days.daysPerYear ?? 365;
    let dayOfYear = components.dayOfMonth;
    const months = this.monthsArray;
    for (let i = 0; i < components.month; i++) dayOfYear += months[i]?.days ?? 0;
    if (zone?.latitude != null) {
      const summerSolsticeDay = this.daylight?.summerSolstice ?? Math.round(daysPerYear * 0.47);
      return CalendariaCalendar.computeDaylightFromLatitude(zone.latitude, dayOfYear, daysPerYear, hoursPerDay, summerSolsticeDay);
    }
    if (zone?.shortestDay != null && zone?.longestDay != null) return this.#computeSinusoidalDaylight(dayOfYear, daysPerYear, zone.shortestDay, zone.longestDay);
    if (this.daylight?.enabled) {
      const { shortestDay, longestDay } = this.daylight;
      return this.#computeSinusoidalDaylight(dayOfYear, daysPerYear, shortestDay, longestDay);
    }
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
   * @param {number} [components.month] - Month index (0-indexed).
   * @param {number} [components.dayOfMonth] - Day within the month (0-indexed).
   */
  async jumpToDate({ year, month, dayOfMonth }) {
    const components = { ...game.time.components };
    year ??= components.year + this.years.yearZero;
    month ??= components.month;
    dayOfMonth ??= components.dayOfMonth;
    components.year = year - this.years.yearZero;
    components.month = month;
    components.dayOfMonth = dayOfMonth;
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
    const currentDayOfYear = this._calculateDayOfYear(components);
    return (
      this.festivalsArray.find((f) => {
        if (f.leapYearOnly && !isLeap) return false;
        const duration = isLeap && f.leapDuration != null ? f.leapDuration : (f.duration ?? 1);
        if (f.dayOfYear != null) return currentDayOfYear >= f.dayOfYear && currentDayOfYear < f.dayOfYear + duration;
        if (f.month != null && f.dayOfMonth != null) {
          const festivalDayOfYear = this._calculateDayOfYearFromMonthDay(f.month, f.dayOfMonth, components.year);
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
    const currentDayOfYear = this._calculateDayOfYear(components);
    let count = 0;
    for (const festival of festivals) {
      if (festival.countsForWeekday !== false) continue;
      if (festival.leapYearOnly && !isLeap) continue;
      const duration = isLeap && festival.leapDuration != null ? festival.leapDuration : (festival.duration ?? 1);
      let festivalStart;
      if (festival.dayOfYear != null) festivalStart = festival.dayOfYear;
      else if (festival.month != null && festival.dayOfMonth != null) festivalStart = this._calculateDayOfYearFromMonthDay(festival.month, festival.dayOfMonth, components.year);
      else continue;
      const festivalEnd = festivalStart + duration;
      if (festivalEnd <= currentDayOfYear) count += duration;
      else if (festivalStart < currentDayOfYear) count += currentDayOfYear - festivalStart;
    }
    return count;
  }

  /**
   * Count total festival days that don't count for weekday calculation in a full year.
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
   * @param {number} year - Internal year (0-based from calendar epoch)
   * @returns {number} Total non-counting festival days (negative for years before epoch).
   */
  countNonWeekdayFestivalsBeforeYear(year) {
    if (!this.festivalsArray.length || year === 0) return 0;
    const regularYearDays = this.countNonWeekdayFestivalsInYear(false);
    const leapYearDays = this.countNonWeekdayFestivalsInYear(true);
    const leapCount = this.countLeapYearsBefore(year);
    return year * regularYearDays + leapCount * (leapYearDays - regularYearDays);
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
    const leapYears = this.countLeapYearsBefore(year);
    return year * regularCount + leapYears * (leapCount - regularCount);
  }

  /**
   * Get the current phase of a moon using FC-style distribution.
   * @param {number} [moonIndex]  Index of the moon (0 for primary moon).
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{name: string, subPhaseName: string, icon: string, position: number}|null} - Moon phase data or null
   */
  getMoonPhase(moonIndex = 0, time = game.time.worldTime) {
    const moon = this.moonsArray[moonIndex];
    if (!moon) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const currentDays = this._componentsToDays(components);
    const ref = moon.referenceDate;
    const referenceDays = this._componentsToDays({ year: ref.year, month: ref.month, dayOfMonth: ref.dayOfMonth ?? 0 });
    const daysSinceReference = currentDays - referenceDays;
    const phases = moon.phases ? Object.values(moon.phases) : [];
    if (!phases.length) return null;
    if (!Number.isFinite(daysSinceReference) || !Number.isFinite(moon.cycleLength) || moon.cycleLength <= 0) {
      return { name: phases[0].name, subPhaseName: phases[0].name, icon: phases[0].icon || '', position: 0, dayInCycle: 0 };
    }
    if (moon.phaseMode === 'randomized') return this.#resolveRandomizedMoonPhase(moon, phases, currentDays, components);
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
      const totalCycleDays = Math.round(moon.cycleLength);
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        const startDay = Math.round((phase.start ?? 0) * moon.cycleLength);
        const endDay = Math.round((phase.end ?? 1) * moon.cycleLength);
        const inRange = endDay > startDay ? dayIndex >= startDay && dayIndex < endDay : dayIndex >= startDay || dayIndex < endDay;
        if (inRange) {
          phaseArrayIndex = i;
          phaseDuration = Math.max(1, endDay > startDay ? endDay - startDay : totalCycleDays - startDay + endDay);
          dayWithinPhase = dayIndex >= startDay ? dayIndex - startDay : dayIndex + totalCycleDays - startDay;
          break;
        }
      }
    } else {
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
   * Resolve moon phase for a randomized moon using the seeded PRNG resolver.
   * @param {object} moon - Moon definition
   * @param {object[]} phases - Phase definitions array
   * @param {number} absoluteDay - Absolute day number
   * @param {object} components - Date components {year, month, dayOfMonth}
   * @returns {object} Moon phase data
   * @private
   */
  #resolveRandomizedMoonPhase(moon, phases, absoluteDay, components) {
    const dateComponents = { year: components.year, month: components.month, dayOfMonth: components.dayOfMonth ?? components.day ?? 0 };
    const normalizedPosition = resolveRandomizedPhase(moon, absoluteDay, dateComponents);
    const dayIndex = Math.floor(normalizedPosition * moon.cycleLength);
    const hasRanges = phases.length > 0 && phases[0].start !== undefined && phases[0].end !== undefined;
    let phaseArrayIndex = 0;
    let dayWithinPhase = 0;
    let phaseDuration = 1;
    if (hasRanges) {
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        if (normalizedPosition >= (phase.start ?? 0) && normalizedPosition < (phase.end ?? 1)) {
          phaseArrayIndex = i;
          const startDay = Math.round((phase.start ?? 0) * moon.cycleLength);
          const endDay = Math.round((phase.end ?? 1) * moon.cycleLength);
          phaseDuration = Math.max(1, endDay - startDay);
          dayWithinPhase = dayIndex - startDay;
          break;
        }
      }
    } else {
      const numPhases = phases.length || 8;
      phaseArrayIndex = Math.min(Math.floor(normalizedPosition * numPhases), numPhases - 1);
      phaseDuration = Math.max(1, Math.round(moon.cycleLength / numPhases));
      dayWithinPhase = dayIndex % phaseDuration;
    }
    const matchedPhase = phases[phaseArrayIndex] || phases[0];
    if (!matchedPhase) return null;
    const subPhaseName = CalendariaCalendar.#getSubPhaseName(matchedPhase, dayWithinPhase, phaseDuration);
    return { name: matchedPhase.name, subPhaseName, icon: matchedPhase.icon || '', position: normalizedPosition, dayInCycle: dayIndex, phaseIndex: phaseArrayIndex, dayWithinPhase, phaseDuration };
  }

  /**
   * Build phase day distribution.
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
    const dayOfMonth = components.dayOfMonth ?? 0;
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
    if (!seasons.length || seasonIndex < 0 || seasonIndex >= seasons.length) return { dayStart: 0, dayEnd: 0, cycleLength: 0 };
    totalDays ??= this.getDaysInYear(1);
    const offset = this.seasons?.offset ?? 0;
    const cycleLength = seasons.reduce((sum, s) => sum + (s.duration ?? Math.floor(totalDays / seasons.length)), 0) || totalDays;
    let dayStart = offset;
    for (let i = 0; i < seasonIndex; i++) dayStart += seasons[i].duration ?? Math.floor(totalDays / seasons.length);
    const duration = seasons[seasonIndex].duration ?? Math.floor(totalDays / seasons.length);
    let dayEnd = dayStart + duration - 1;
    if (seasonIndex === seasons.length - 1 && totalDays > cycleLength) dayEnd += totalDays - cycleLength;
    return { dayStart, dayEnd, cycleLength };
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
      const { cycleLength } = this._calculatePeriodicSeasonBounds(0, totalDays);
      if (cycleLength <= 0) return null;
      const offset = this.seasons?.offset ?? 0;
      const leapDayOfYear = this._calculateDayOfYear(components);
      const dayInCycle = (((leapDayOfYear - offset) % totalDays) + totalDays) % totalDays;
      let cumulative = 0;
      for (let i = 0; i < seasons.length; i++) {
        const duration = seasons[i].duration ?? Math.floor(totalDays / seasons.length);
        cumulative += duration;
        if (dayInCycle < cumulative) return seasons[i];
      }
      return seasons[seasons.length - 1];
    }
    for (const season of seasons) {
      if (season.monthStart != null && season.monthEnd != null) {
        const currentMonth = components.month;
        const startDay = season.dayStart ?? 0;
        const endDay = season.dayEnd ?? (months[season.monthEnd]?.days ?? 30) - 1;
        if (season.monthStart === season.monthEnd) {
          if (currentMonth === season.monthStart && components.dayOfMonth >= startDay && components.dayOfMonth <= endDay) return season;
        } else if (season.monthStart < season.monthEnd) {
          if (currentMonth > season.monthStart && currentMonth < season.monthEnd) return season;
          if (currentMonth === season.monthStart && components.dayOfMonth >= startDay) return season;
          if (currentMonth === season.monthEnd && components.dayOfMonth <= endDay) return season;
        } else {
          if (currentMonth > season.monthStart || currentMonth < season.monthEnd) return season;
          if (currentMonth === season.monthStart && components.dayOfMonth >= startDay) return season;
          if (currentMonth === season.monthEnd && components.dayOfMonth <= endDay) return season;
        }
      } else if (season.dayStart != null && season.dayEnd != null) {
        const { dayStart, dayEnd } = season;
        const inRange = dayStart <= dayEnd ? dayOfYear >= dayStart && dayOfYear <= dayEnd : dayOfYear >= dayStart || dayOfYear <= dayEnd;
        if (inRange) return season;
      }
    }
    return null;
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
    const totalDays = this.totalDaysBeforeYear(components.year) + dayOfYear;
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
}
