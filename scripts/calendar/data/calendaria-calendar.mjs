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
import { formatEraTemplate } from '../calendar-utils.mjs';
import * as LeapYearUtils from '../leap-year-utils.mjs';

const { ArrayField, BooleanField, NumberField, SchemaField, StringField } = foundry.data.fields;

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
    const dayOfYear = dt.ordinal - 1;
    const daysPerYear = calendar.days?.daysPerYear ?? 365;
    const yearZero = calendar.years?.yearZero ?? 0;
    const golarionYear = wc.year;
    const totalDays = (golarionYear - yearZero) * daysPerYear + dayOfYear;
    const internalTime = totalDays * secondsPerDay + dt.hour * secondsPerHour + dt.minute * secondsPerMinute + dt.second;
    this.#epochOffset = internalTime - game.time.worldTime;
    const numWeekdays = calendar.days?.values?.length ?? 7;
    const internalYear = golarionYear - yearZero;
    let calendarDayOfYear = dt.day - 1;
    for (let m = 0; m < dt.month - 1; m++) calendarDayOfYear += calendar.getDaysInMonth?.(m, internalYear) ?? 30;
    let totalDaysFromPriorYears = 0;
    if (internalYear > 0) for (let y = 0; y < internalYear; y++) totalDaysFromPriorYears += calendar.getDaysInYear?.(y) ?? daysPerYear;
    else if (internalYear < 0) for (let y = -1; y >= internalYear; y--) totalDaysFromPriorYears -= calendar.getDaysInYear?.(y) ?? daysPerYear;
    const calendarTotalDays = totalDaysFromPriorYears + calendarDayOfYear;
    const components = { year: internalYear, month: dt.month - 1, dayOfMonth: dt.day - 1 };
    const nonCountingFestivalsInYear = calendar.countNonWeekdayFestivalsBefore?.(components) ?? 0;
    const nonCountingFestivalsFromPriorYears = calendar.countNonWeekdayFestivalsBeforeYear?.(internalYear) ?? 0;
    const intercalaryInYear = calendar.countIntercalaryDaysBefore?.(components) ?? 0;
    const intercalaryFromPriorYears = calendar.countIntercalaryDaysBeforeYear?.(internalYear) ?? 0;
    const totalNonCounting = nonCountingFestivalsFromPriorYears + nonCountingFestivalsInYear + intercalaryFromPriorYears + intercalaryInYear;
    const countingDays = calendarTotalDays - totalNonCounting;
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

  /**
   * Check if this calendar operates without named months (e.g., Traveller Imperial Calendar).
   * Monthless calendars use day-of-year numbering instead of month/day.
   * @returns {boolean} True if the calendar has no named months
   */
  get isMonthless() {
    const months = this.months?.values ?? [];
    if (months.length === 0) return true;
    if (months.length === 1 && (!months[0].name || months[0].name === '')) return true;
    return false;
  }

  /** @override */
  timeToComponents(time) {
    return super.timeToComponents(time + CalendariaCalendar.epochOffset);
  }

  /** @override */
  componentsToTime(components) {
    return super.componentsToTime(components) - CalendariaCalendar.epochOffset;
  }

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    const extendedMonthSchema = new SchemaField(
      {
        values: new ArrayField(
          new SchemaField({
            name: new StringField({ required: true, blank: false }),
            abbreviation: new StringField(),
            ordinal: new NumberField({ required: true, nullable: false, min: 1, integer: true }),
            days: new NumberField({ required: true, nullable: false }),
            leapDays: new NumberField({ required: false, nullable: true }),
            type: new StringField({ required: false }),
            startingWeekday: new NumberField({ required: false, integer: true, nullable: true, min: 0 }),
            weekdays: new ArrayField(
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
        presets: new ArrayField(climatePresetSchema, { required: false })
      },
      { required: false, nullable: true }
    );
    const extendedSeasonSchema = new SchemaField(
      {
        type: new StringField({ required: false, initial: 'dated', choices: ['dated', 'periodic'] }),
        offset: new NumberField({ required: false, integer: true, min: 0, initial: 0 }),
        values: new ArrayField(
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
        values: new ArrayField(
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
      festivals: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true }),
          month: new NumberField({ required: false, nullable: true, min: 1, integer: true }),
          day: new NumberField({ required: false, nullable: true, min: 1, integer: true }),
          dayOfYear: new NumberField({ required: false, nullable: true, min: 1, max: 400, integer: true }),
          duration: new NumberField({ required: false, nullable: false, min: 1, integer: true, initial: 1 }),
          leapDuration: new NumberField({ required: false, nullable: true, min: 1, integer: true }),
          leapYearOnly: new BooleanField({ required: false, initial: false }),
          countsForWeekday: new BooleanField({ required: false, initial: true })
        })
      ),
      moons: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true }),
          cycleLength: new NumberField({ required: true, nullable: false, min: 1 }),
          cycleDayAdjust: new NumberField({ required: false, nullable: false, initial: 0 }),
          color: new StringField({ required: false, initial: '' }),
          hidden: new BooleanField({ required: false, initial: false }),
          phases: new ArrayField(
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
      eras: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true }),
          abbreviation: new StringField({ required: true }),
          startYear: new NumberField({ required: true, integer: true }),
          endYear: new NumberField({ required: false, nullable: true, integer: true }),
          format: new StringField({ required: false, initial: 'suffix' }),
          template: new StringField({ required: false, nullable: true, initial: null })
        })
      ),
      cycles: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true }),
          length: new NumberField({ required: true, nullable: false, min: 1, initial: 12 }),
          offset: new NumberField({ required: false, nullable: false, initial: 0 }),
          basedOn: new StringField({ required: true, initial: 'month', choices: ['year', 'eraYear', 'month', 'monthDay', 'day', 'yearDay'] }),
          entries: new ArrayField(new SchemaField({ name: new StringField({ required: true }) }))
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
      amPmNotation: new SchemaField({ am: new StringField({ required: false, initial: 'AM' }), pm: new StringField({ required: false, initial: 'PM' }) }, { required: false }),
      canonicalHours: new ArrayField(
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
          names: new ArrayField(new SchemaField({ name: new StringField({ required: true }), abbreviation: new StringField({ required: false }) }))
        },
        { required: false }
      ),
      dateFormats: new SchemaField(
        {
          short: new StringField({ required: false, initial: 'D MMM' }),
          long: new StringField({ required: false, initial: 'D MMMM, YYYY' }),
          full: new StringField({ required: false, initial: 'MMMM D, YYYY' }),
          time: new StringField({ required: false, initial: 'HH:mm' }),
          time12: new StringField({ required: false, initial: 'h:mm a' })
        },
        { required: false }
      ),
      weather: new SchemaField(
        {
          activeZone: new StringField({ required: false, initial: 'temperate' }),
          autoGenerate: new BooleanField({ required: false, initial: false }),
          zones: new ArrayField(
            new SchemaField({
              id: new StringField({ required: true }),
              name: new StringField({ required: true }),
              description: new StringField({ required: false }),
              temperatures: new foundry.data.fields.ObjectField({ required: false, initial: {} }),
              presets: new ArrayField(
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
    const month = this.months?.values?.[monthIndex];
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
    return (this.months?.values ?? []).reduce((sum, month) => {
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
   * Get the number of hours in a given day.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @returns {number} - Number of hours between sunrise and sunset.
   */
  daylightHours(time = game.time.components) {
    return this.sunset(time) - this.sunrise(time);
  }

  /**
   * Progress between sunrise and sunset assuming it is daylight half the day duration.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @returns {number} - Progress through day period, with 0 representing sunrise and 1 sunset.
   */
  progressDay(time = game.time.components) {
    return (CalendariaCalendar.hoursOfDay(time, this) - this.sunrise(time)) / this.daylightHours(time);
  }

  /**
   * Progress between sunset and sunrise assuming it is night half the day duration.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @returns {number} - Progress through night period, with 0 representing sunset and 1 sunrise.
   */
  progressNight(time = game.time.components) {
    const daylightHours = this.daylightHours(time);
    let hour = CalendariaCalendar.hoursOfDay(time, this);
    if (hour < daylightHours) hour += this.days.hoursPerDay;
    return (hour - this.sunset(time)) / daylightHours;
  }

  /**
   * Get the sunrise time for a given day.
   * Uses dynamic daylight calculation if enabled, otherwise static 25% of day.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @returns {number} - Sunrise time in hours.
   */
  sunrise(time = game.time.components) {
    const daylightHrs = this._getDaylightHoursForDay(time);
    const midday = this.days.hoursPerDay / 2;
    return midday - daylightHrs / 2;
  }

  /**
   * Get the sunset time for a given day.
   * Uses dynamic daylight calculation if enabled, otherwise static 75% of day.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @returns {number} - Sunset time in hours.
   */
  sunset(time = game.time.components) {
    const daylightHrs = this._getDaylightHoursForDay(time);
    const midday = this.days.hoursPerDay / 2;
    return midday + daylightHrs / 2;
  }

  /**
   * Get solar midday - the midpoint between sunrise and sunset.
   * This varies throughout the year when dynamic daylight is enabled.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @returns {number} - Solar midday time in hours.
   */
  solarMidday(time = game.time.components) {
    return (this.sunrise(time) + this.sunset(time)) / 2;
  }

  /**
   * Get solar midnight - the midpoint of the night period.
   * This is halfway between sunset and the next sunrise.
   * @param {number|object} [time] - The time to use, by default the current world time.
   * @returns {number} - Solar midnight time in hours (may exceed hoursPerDay for next day).
   */
  solarMidnight(time = game.time.components) {
    const sunsetHour = this.sunset(time);
    const nightHours = this.days.hoursPerDay - this.daylightHours(time);
    return sunsetHour + nightHours / 2;
  }

  /**
   * Calculate daylight hours for a specific day based on dynamic daylight settings.
   * @param {number|object} [time] - The time to use.
   * @returns {number} - Hours of daylight for this day.
   * @private
   */
  _getDaylightHoursForDay(time = game.time.components) {
    if (!this.daylight?.enabled) return this.days.hoursPerDay * 0.5;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) dayOfYear += this.months.values[i]?.days ?? 0;
    const daysPerYear = this.days.daysPerYear ?? 365;
    const { shortestDay, longestDay, winterSolstice, summerSolstice } = this.daylight;
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
    day ??= components.dayOfMonth;
    components.year = year - this.years.yearZero;
    const { leapYear } = this._decomposeTimeYears(this.componentsToTime(components));
    let dayOfYear = day - 1;
    for (let idx = 0; idx < month; idx++) {
      const m = this.months.values[idx];
      dayOfYear += leapYear ? (m.leapDays ?? m.days) : m.days;
    }
    components.day = dayOfYear;
    components.month = month;
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
      this.festivals?.find((f) => {
        if (f.leapYearOnly && !isLeap) return false;
        const duration = isLeap && f.leapDuration != null ? f.leapDuration : (f.duration ?? 1);
        if (f.dayOfYear != null) {
          return currentDayOfYear >= f.dayOfYear && currentDayOfYear < f.dayOfYear + duration;
        }
        if (f.month != null && f.day != null) {
          const festivalDayOfYear = this._calculateDayOfYearFromMonthDay(f.month - 1, f.day - 1) + 1;
          return currentDayOfYear >= festivalDayOfYear && currentDayOfYear < festivalDayOfYear + duration;
        }
        return false;
      }) ?? null
    );
  }

  /**
   * Calculate day of year (1-indexed) from month and day.
   * @param {number} month - Month index (0-indexed)
   * @param {number} day - Day of month (0-indexed)
   * @returns {number} Day of year (0-indexed)
   * @private
   */
  _calculateDayOfYearFromMonthDay(month, day) {
    if (this.isMonthless) return day;
    let dayOfYear = day;
    for (let i = 0; i < month; i++) dayOfYear += this.months?.values?.[i]?.days ?? 0;
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
    for (let i = 0; i < components.month; i++) dayOfYear += this.months?.values?.[i]?.days ?? 0;
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
    if (!this.festivals?.length) return 0;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const isLeap = this.isLeapYear(components.year);
    const currentDayOfYear = this._calculateDayOfYear(components) + 1;
    let count = 0;
    for (const festival of this.festivals) {
      if (festival.countsForWeekday !== false) continue;
      if (festival.leapYearOnly && !isLeap) continue;
      const duration = isLeap && festival.leapDuration != null ? festival.leapDuration : (festival.duration ?? 1);
      let festivalStart;
      if (festival.dayOfYear != null) {
        festivalStart = festival.dayOfYear;
      } else if (festival.month != null && festival.day != null) {
        festivalStart = this._calculateDayOfYearFromMonthDay(festival.month - 1, festival.day - 1) + 1;
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
    if (!this.festivals?.length) return 0;
    let count = 0;
    for (const festival of this.festivals) {
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
    if (!this.festivals?.length || year === 0) return 0;
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
    const months = this.months?.values;
    if (!months?.length) return 0;
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
    const months = this.months?.values;
    if (!months?.length) return 0;
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
    const months = this.months?.values;
    if (!months?.length) return 0;
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
    const months = this.months?.values;
    if (!months?.length || year === 0) return 0;
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
    const moon = this.moons?.[moonIndex];
    if (!moon) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const currentDays = this._componentsToDays(components);
    const referenceDays = this._componentsToDays(moon.referenceDate);
    const daysSinceReference = currentDays - referenceDays;
    if (!Number.isFinite(daysSinceReference) || !Number.isFinite(moon.cycleLength) || moon.cycleLength <= 0) {
      return moon.phases?.[0] ? { name: moon.phases[0].name, subPhaseName: moon.phases[0].name, icon: moon.phases[0].icon || '', position: 0, dayInCycle: 0 } : null;
    }
    const cycleDayAdjust = Number.isFinite(moon.cycleDayAdjust) ? moon.cycleDayAdjust : 0;
    const daysIntoCycleRaw = (((daysSinceReference % moon.cycleLength) + moon.cycleLength) % moon.cycleLength) + cycleDayAdjust;
    const daysIntoCycle = ((daysIntoCycleRaw % moon.cycleLength) + moon.cycleLength) % moon.cycleLength;
    const normalizedPosition = daysIntoCycle / moon.cycleLength;
    const dayIndex = Math.floor(daysIntoCycle);

    // Use phase start/end ranges if defined, otherwise fall back to even distribution
    const phases = moon.phases || [];
    const hasRanges = phases.length > 0 && phases[0].start !== undefined && phases[0].end !== undefined;

    let phaseArrayIndex = 0;
    let dayWithinPhase = 0;
    let phaseDuration = 1;

    if (hasRanges) {
      // Match phase by normalized position against start/end ranges
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        const start = phase.start ?? 0;
        const end = phase.end ?? 1;
        // Handle wrap-around (e.g., start=0.9, end=0.1)
        const inRange = end > start ? normalizedPosition >= start && normalizedPosition < end : normalizedPosition >= start || normalizedPosition < end;
        if (inRange) {
          phaseArrayIndex = i;
          const phaseLength = end > start ? end - start : 1 - start + end;
          phaseDuration = Math.max(1, Math.round(phaseLength * moon.cycleLength));
          const posInPhase = end > start ? normalizedPosition - start : normalizedPosition >= start ? normalizedPosition - start : normalizedPosition + (1 - start);
          dayWithinPhase = Math.floor(posInPhase * moon.cycleLength);
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
    if (!this.moons) return [];
    return this.moons.map((_moon, index) => this.getMoonPhase(index, time)).filter(Boolean);
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
    let dayOfYear = dayOfMonth;
    const monthDays = this.months?.values || [];
    for (let i = 0; i < month && i < monthDays.length; i++) dayOfYear += monthDays[i]?.days || 30;
    const normalized = { year, day: dayOfYear, hour: Number(components.hour) || 0, minute: Number(components.minute) || 0, second: Number(components.second) || 0 };
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
    const seasons = this.seasons?.values ?? [];
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
    if (!this.seasons?.values?.length) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) dayOfYear += this.months.values[i]?.days ?? 0;
    if (this.seasons.type === 'periodic') {
      const totalDays = this.getDaysInYear(components.year);
      for (let i = 0; i < this.seasons.values.length; i++) {
        const { dayStart, dayEnd } = this._calculatePeriodicSeasonBounds(i, totalDays);
        if (dayStart <= dayEnd) {
          if (dayOfYear >= dayStart && dayOfYear <= dayEnd) return this.seasons.values[i];
        } else {
          if (dayOfYear >= dayStart || dayOfYear <= dayEnd) return this.seasons.values[i];
        }
      }

      return this.seasons.values[0] ?? null;
    }

    for (const season of this.seasons.values) {
      if (season.monthStart != null && season.monthEnd != null) {
        const currentMonth = components.month + 1;
        const startDay = season.dayStart ?? 1;
        const endDay = season.dayEnd ?? this.months.values[season.monthEnd - 1]?.days ?? 30;
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

    return this.seasons.values[0] ?? null;
  }

  /**
   * Get all seasons for this calendar.
   * @returns {Array<object>} All seasons
   */
  getAllSeasons() {
    return this.seasons?.values ?? [];
  }

  /**
   * Get weekday data for a specific month, falling back to calendar-level weekdays.
   * @param {number} monthIndex - 0-indexed month
   * @returns {Array<object>} Weekdays in month
   */
  getWeekdaysForMonth(monthIndex) {
    const month = this.months?.values?.[monthIndex];
    if (month?.weekdays?.length) return month.weekdays;
    return this.days?.values ?? [];
  }

  /**
   * Get weekday info for a specific date.
   * @param {number|object} [time] - Time to check, defaults to current world time
   * @returns {object|null} Weekday for date
   */
  getWeekdayForDate(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const weekdays = this.getWeekdaysForMonth(components.month);
    const weekdayIndex = components.dayOfWeek ?? 0;
    const weekday = weekdays[weekdayIndex];
    if (!weekday) return null;
    return { ...weekday, index: weekdayIndex };
  }

  /**
   * Get the current era for a given year.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{name: string, abbreviation: string, format: string, template: string|null, yearInEra: number}|null} - Era data or null
   */
  getCurrentEra(time = game.time.worldTime) {
    if (!this.eras?.length) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);
    const sortedEras = [...this.eras].sort((a, b) => b.startYear - a.startYear);
    for (const era of sortedEras) {
      if (displayYear >= era.startYear && (era.endYear == null || displayYear <= era.endYear)) {
        return { name: era.name, abbreviation: era.abbreviation, format: era.format || 'suffix', template: era.template || null, yearInEra: displayYear - era.startYear + 1 };
      }
    }

    if (this.eras.length > 0) {
      const era = this.eras[0];
      return { name: era.name, abbreviation: era.abbreviation, format: era.format || 'suffix', template: era.template || null, yearInEra: displayYear };
    }

    return null;
  }

  /**
   * Format a year with its era designation.
   * @param {number} year  The display year to format.
   * @returns {string}  Formatted year string (e.g., "1492 DR" or "CY 591").
   */
  formatYearWithEra(year) {
    const eraData = this.getCurrentEra({ year: year - (this.years?.yearZero ?? 0), month: 0, dayOfMonth: 0 });
    if (!eraData) return String(year);
    const abbr = eraData.abbreviation ? localize(eraData.abbreviation) : '';
    const eraName = eraData.name ? localize(eraData.name) : '';
    if (eraData.template) return formatEraTemplate(eraData.template, { year, abbreviation: abbr, era: eraName, yearInEra: eraData.yearInEra });
    if (!abbr) return String(year);
    if (eraData.format === 'prefix') return `${abbr} ${year}`;
    return `${year} ${abbr}`;
  }

  /**
   * Get all eras for this calendar.
   * @returns {Array<object>} All eras
   */
  getAllEras() {
    return this.eras ?? [];
  }

  /**
   * Get the current canonical hour for a given time.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{name: string, abbreviation: string, startHour: number, endHour: number}|null} - Canonical hour or null
   */
  getCanonicalHour(time = game.time.worldTime) {
    if (!this.canonicalHours?.length) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const currentHour = components.hour;

    for (const ch of this.canonicalHours) {
      if (ch.startHour <= ch.endHour)
        if (currentHour >= ch.startHour && currentHour < ch.endHour) return ch;
        else if (currentHour >= ch.startHour || currentHour < ch.endHour) return ch;
    }

    for (const ch of this.canonicalHours) if (currentHour === ch.endHour) return ch;
    return null;
  }

  /**
   * Get all canonical hours for this calendar.
   * @returns {Array<{name: string, abbreviation: string, startHour: number, endHour: number}>} - All canonical hours
   */
  getAllCanonicalHours() {
    return this.canonicalHours ?? [];
  }

  /**
   * Get the current week number and name for a given time.
   * Supports both month-based and year-based week counting.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{weekNumber: number, weekName: string, weekAbbr: string, type: string}|null} - Week data or null
   */
  getCurrentWeek(time = game.time.worldTime) {
    if (!this.weeks?.enabled || !this.weeks?.names?.length) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const daysInWeek = this.days?.values?.length || 7;
    const weekNames = this.weeks.names;

    let weekNumber;
    if (this.weeks.type === 'month-based') {
      const dayOfMonth = components.dayOfMonth;
      weekNumber = Math.floor(dayOfMonth / daysInWeek);
    } else {
      let dayOfYear = components.dayOfMonth;
      for (let i = 0; i < components.month; i++) dayOfYear += this.months.values[i]?.days ?? 0;
      weekNumber = Math.floor(dayOfYear / daysInWeek);
    }
    const nameIndex = weekNumber % weekNames.length;
    const week = weekNames[nameIndex];
    return { weekNumber: weekNumber + 1, weekName: localize(week?.name ?? ''), weekAbbr: week?.abbreviation ? localize(week.abbreviation) : '', type: this.weeks.type };
  }

  /**
   * Get week number within the year (1-indexed).
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {number} Week number (1-indexed).
   */
  getWeekOfYear(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const daysInWeek = this.days?.values?.length || 7;
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) dayOfYear += this.months.values[i]?.days ?? 0;
    return Math.floor(dayOfYear / daysInWeek) + 1;
  }

  /**
   * Get week number within the month (1-indexed).
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {number} Week number (1-indexed).
   */
  getWeekOfMonth(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const daysInWeek = this.days?.values?.length || 7;
    return Math.floor(components.dayOfMonth / daysInWeek) + 1;
  }

  /**
   * Get all named weeks for this calendar.
   * @returns {Array<{name: string, abbreviation: string}>} - All named weeks
   */
  getAllNamedWeeks() {
    return this.weeks?.names ?? [];
  }

  /**
   * Get the current values for all cycles.
   * @param {number|object} [time]  Time to use, by default the current world time.
   * @returns {{text: string, values: Array<{cycleName: string, entryName: string, index: number}>}} - Cycle values
   */
  getCycleValues(time = game.time.worldTime) {
    if (!this.cycles?.length) return { text: '', values: [] };
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);
    const epochValues = this._getCycleEpochValues(components, displayYear);
    const values = [];
    const textReplacements = { n: '<br>' };

    for (let i = 0; i < this.cycles.length; i++) {
      const cycle = this.cycles[i];
      if (!cycle.entries?.length) continue;
      const epochValue = epochValues[cycle.basedOn] ?? 0;
      const adjustedValue = epochValue + (cycle.offset || 0);
      let entryIndex = adjustedValue % cycle.entries.length;
      if (entryIndex < 0) entryIndex += cycle.entries.length;
      const entry = cycle.entries[entryIndex];
      values.push({ cycleName: cycle.name, entryName: entry?.name ?? '', index: entryIndex });
      textReplacements[(i + 1).toString()] = localize(entry?.name ?? '');
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
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) dayOfYear += this.months.values[i]?.days ?? 0;
    const totalDays = this._componentsToDays(components);
    let eraYear = displayYear;
    if (this.eras?.length) {
      const sortedEras = [...this.eras].sort((a, b) => b.startYear - a.startYear);
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
    return this.cycles ?? [];
  }

  /**
   * Get the current 1-indexed cycle number for a specific cycle.
   * Cycle 1 is the first cycle; negative years return Cycle 1.
   * @param {number} [cycleIndex] - Index of the cycle definition to use
   * @param {number|object} [time] - Time to use, by default the current world time
   * @returns {number} - 1-indexed cycle number (minimum 1)
   */
  getCurrentCycleNumber(cycleIndex = 0, time = game.time.worldTime) {
    const cycle = this.cycles?.[cycleIndex];
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
    const cycle = this.cycles?.[cycleIndex];
    if (!cycle?.entries?.length) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);
    const epochValues = this._getCycleEpochValues(components, displayYear);
    const epochValue = epochValues[cycle.basedOn] ?? 0;
    const adjustedValue = epochValue + (cycle.offset || 0);
    let entryIndex = adjustedValue % cycle.entries.length;
    if (entryIndex < 0) entryIndex += cycle.entries.length;
    const cycleNumber = Math.max(1, Math.floor(adjustedValue / cycle.length) + 1);
    const entry = cycle.entries[entryIndex];
    return { name: entry?.name ?? '', index: entryIndex, cycleNumber };
  }

  /**
   * Prepare formatting context from calendar and components.
   * @param {object} calendar  The calendar instance.
   * @param {object} components    Time components.
   * @returns {object} Formatting context with year, month, day parts.
   */
  static dateFormattingParts(calendar, components) {
    const month = calendar.months.values[components.month];
    const year = components.year + (calendar.years?.yearZero ?? 0);
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    const midday = Math.floor(hoursPerDay / 2);
    const hour24 = components.hour;
    const isPM = hour24 >= midday;
    const hour12 = hour24 === 0 ? midday : hour24 > midday ? hour24 - midday : hour24;
    const amPm = calendar.amPmNotation ?? {};
    const period = isPM ? amPm.pm || 'PM' : amPm.am || 'AM';
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
    const festivalDay = calendar.findFestivalDay?.(components);
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
    const festivalDay = calendar.findFestivalDay?.(components);
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
        dateShort: 'D MMM', dateMedium: 'D MMMM', dateLong: 'D MMMM, YYYY', dateFull: 'EEEE, D MMMM YYYY',
        time24: 'HH:mm', time12: 'h:mm A', time24Sec: 'HH:mm:ss', time12Sec: 'h:mm:ss A'
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
    const zones = this.weather?.zones ?? [];
    const activeId = this.weather?.activeZone ?? 'temperate';
    return zones.find((z) => z.id === activeId) ?? zones[0] ?? null;
  }

  /**
   * Get a climate zone by ID.
   * @param {string} id - Zone ID
   * @returns {object|null} Zone object or null
   */
  getClimateZoneById(id) {
    return this.weather?.zones?.find((z) => z.id === id) ?? null;
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
    return this.weather?.zones?.map((z) => z.id) ?? [];
  }
}
