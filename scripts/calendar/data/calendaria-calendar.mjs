/**
 * Extended calendar data model with Calendaria-specific features.
 * System-agnostic calendar that extends Foundry's base CalendarData.
 *
 * @extends {foundry.data.CalendarData}
 * @module Calendar/Data/CalendariaCalendar
 * @author Tyler
 */

import * as LeapYearUtils from '../leap-year-utils.mjs';
import { formatEraTemplate } from '../calendar-utils.mjs';

const { ArrayField, BooleanField, NumberField, SchemaField, StringField } = foundry.data.fields;

export default class CalendariaCalendar extends foundry.data.CalendarData {
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
            startingWeekday: new NumberField({ required: false, integer: true, nullable: true, min: 0 })
          })
        )
      },
      { required: true, nullable: true, initial: null }
    );

    const extendedSeasonSchema = new SchemaField(
      {
        values: new ArrayField(
          new SchemaField({
            name: new StringField({ required: true, blank: false }),
            abbreviation: new StringField({ required: false }),
            icon: new StringField({ required: false, initial: '' }),
            color: new StringField({ required: false, initial: '' }),
            dayStart: new NumberField({ required: false, integer: true, min: 0, nullable: true }),
            dayEnd: new NumberField({ required: false, integer: true, min: 0, nullable: true }),
            monthStart: new NumberField({ required: false, integer: true, min: 1, nullable: true }),
            monthEnd: new NumberField({ required: false, integer: true, min: 1, nullable: true })
          })
        )
      },
      { required: false, nullable: true, initial: null }
    );

    return {
      ...schema,
      months: extendedMonthSchema,
      seasons: extendedSeasonSchema,

      /**
       * Advanced leap year configuration
       * Supports complex patterns like "400,!100,4" for true Gregorian rules.
       * When set, this overrides the standard years.leapYear config.
       * @type {object}
       */
      leapYearConfig: new SchemaField(
        {
          rule: new StringField({ required: false, initial: 'none' }),
          interval: new NumberField({ required: false, integer: true, min: 1 }),
          start: new NumberField({ required: false, integer: true, initial: 0 }),
          pattern: new StringField({ required: false })
        },
        { required: false, nullable: true }
      ),

      /**
       * Festival/intercalary days (days outside normal calendar structure)
       * @type {Array<{name: string, month: number, day: number, leapYearOnly: boolean, countsForWeekday: boolean}>}
       */
      festivals: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true }),
          month: new NumberField({ required: true, nullable: false, min: 1, integer: true }),
          day: new NumberField({ required: true, nullable: false, min: 1, integer: true }),
          leapYearOnly: new BooleanField({ required: false, initial: false }),
          countsForWeekday: new BooleanField({ required: false, initial: true })
        })
      ),

      /**
       * Moon configurations for this calendar
       * @type {Array<{name: string, cycleLength: number, phases: Array, referenceDate: object}>}
       */
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
            })
          ),
          referenceDate: new SchemaField({
            year: new NumberField({ required: true, integer: true, initial: 1 }),
            month: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            day: new NumberField({ required: true, integer: true, min: 1, initial: 1 })
          })
        })
      ),

      /**
       * Era configurations for this calendar
       * @type {Array<{name: string, abbreviation: string, startYear: number, endYear: number|null, format: string, template: string|null}>}
       */
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

      /**
       * Named repeating cycles (e.g., zodiac signs, elemental weeks)
       * @type {Array<{name: string, length: number, offset: number, basedOn: string, entries: Array<{name: string}>}>}
       */
      cycles: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true }),
          length: new NumberField({ required: true, nullable: false, min: 1, initial: 12 }),
          offset: new NumberField({ required: false, nullable: false, initial: 0 }),
          basedOn: new StringField({ required: true, initial: 'month', choices: ['year', 'eraYear', 'month', 'monthDay', 'day', 'yearDay'] }),
          entries: new ArrayField(new SchemaField({ name: new StringField({ required: true }) }))
        })
      ),

      /**
       * Template for displaying cycle values (e.g., "{{1}} - Week of {{2}}")
       * @type {string}
       */
      cycleFormat: new StringField({ required: false, initial: '' }),

      /**
       * Calendar metadata
       * @type {object}
       */
      metadata: new SchemaField(
        {
          id: new StringField({ required: false }),
          description: new StringField({ required: false }),
          author: new StringField({ required: false }),
          system: new StringField({ required: false })
        },
        { required: false }
      ),

      /**
       * Daylight configuration for dynamic sunrise/sunset
       * @type {object}
       */
      daylight: new SchemaField(
        {
          /** Enable dynamic daylight calculation based on seasons */
          enabled: new foundry.data.fields.BooleanField({ required: false, initial: false }),
          /** Hours of daylight on the shortest day (winter solstice) */
          shortestDay: new NumberField({ required: false, initial: 8, min: 0 }),
          /** Hours of daylight on the longest day (summer solstice) */
          longestDay: new NumberField({ required: false, initial: 16, min: 0 }),
          /** Day of year for winter solstice (shortest day) - 0-indexed */
          winterSolstice: new NumberField({ required: false, initial: 355, integer: true, min: 0 }),
          /** Day of year for summer solstice (longest day) - 0-indexed */
          summerSolstice: new NumberField({ required: false, initial: 172, integer: true, min: 0 })
        },
        { required: false }
      ),

      /**
       * Current/starting date from import (e.g., Fantasy-Calendar's dynamic_data)
       * Can be used to set initial game time after import.
       * @type {object|null}
       */
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

      /**
       * Custom AM/PM notation for 12-hour time display.
       * @type {object}
       */
      amPmNotation: new SchemaField({ am: new StringField({ required: false, initial: 'AM' }), pm: new StringField({ required: false, initial: 'PM' }) }, { required: false }),

      /**
       * Canonical hours - named time-of-day periods (e.g., Matins, Lauds, Prime).
       * @type {Array<{name: string, abbreviation: string, startHour: number, endHour: number}>}
       */
      canonicalHours: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true }),
          abbreviation: new StringField({ required: false }),
          startHour: new NumberField({ required: true, nullable: false, min: 0, integer: true }),
          endHour: new NumberField({ required: true, nullable: false, min: 0, integer: true })
        })
      ),

      /**
       * Named weeks configuration.
       * @type {object}
       */
      weeks: new SchemaField(
        {
          enabled: new BooleanField({ required: false, initial: false }),
          type: new StringField({ required: false, initial: 'year-based', choices: ['month-based', 'year-based'] }),
          perMonth: new NumberField({ required: false, integer: true, min: 1 }),
          names: new ArrayField(new SchemaField({ name: new StringField({ required: true }), abbreviation: new StringField({ required: false }) }))
        },
        { required: false }
      ),

      /**
       * Custom date format templates.
       * @type {object}
       */
      dateFormats: new SchemaField(
        {
          short: new StringField({ required: false, initial: '{{d}} {{b}}' }),
          long: new StringField({ required: false, initial: '{{d}} {{B}}, {{y}}' }),
          full: new StringField({ required: false, initial: '{{B}} {{d}}, {{y}}' }),
          time: new StringField({ required: false, initial: '{{H}}:{{M}}' }),
          time12: new StringField({ required: false, initial: '{{h}}:{{M}} {{p}}' })
        },
        { required: false }
      ),

      /**
       * Weather configuration for this calendar.
       * @type {object}
       */
      weather: new SchemaField(
        {
          /** Currently active climate zone ID */
          activeZone: new StringField({ required: false, initial: 'temperate' }),
          /** Auto-generate weather on day change */
          autoGenerate: new BooleanField({ required: false, initial: false }),
          /** Climate zones with per-season temperatures and preset configs */
          zones: new ArrayField(
            new SchemaField({
              id: new StringField({ required: true }),
              name: new StringField({ required: true }),
              description: new StringField({ required: false }),
              /** Dynamic temperatures keyed by season name, plus _default fallback */
              temperatures: new foundry.data.fields.ObjectField({ required: false, initial: {} }),
              /** Preset configurations for this zone */
              presets: new ArrayField(
                new SchemaField({
                  id: new StringField({ required: true }),
                  enabled: new BooleanField({ required: false, initial: false }),
                  chance: new NumberField({ required: false, initial: 0 }),
                  tempMin: new NumberField({ required: false, nullable: true }),
                  tempMax: new NumberField({ required: false, nullable: true }),
                  description: new StringField({ required: false })
                })
              )
            })
          )
        },
        { required: false }
      )
    };
  }

  /* -------------------------------------------- */
  /*  Calendar Helper Methods                     */
  /* -------------------------------------------- */

  /**
   * Calculate the decimal hours since the start of the day.
   * @param {number|TimeComponents} [time]  The time to use, by default the current world time.
   * @param {CalendarData} [calendar]       Calendar to use, by default this calendar.
   * @returns {number}                      Number of hours since the start of the day as a decimal.
   */
  static hoursOfDay(time = game.time.components, calendar = game.time.calendar) {
    const components = typeof time === 'number' ? calendar.timeToComponents(time) : time;
    const minutes = components.minute + components.second / calendar.days.secondsPerMinute;
    return components.hour + minutes / calendar.days.minutesPerHour;
  }

  /* -------------------------------------------- */
  /*  Leap Year Methods                           */
  /* -------------------------------------------- */

  /**
   * Check if a given year is a leap year.
   * Supports complex leap year patterns (e.g., "400,!100,4" for Gregorian).
   *
   * @param {number} year - The display year to check (with yearZero applied)
   * @returns {boolean} True if the year is a leap year
   */
  isLeapYear(year) {
    // Check for advanced leap year config first (Fantasy-Calendar patterns)
    const advancedConfig = this.leapYearConfig;
    if (advancedConfig?.rule && advancedConfig.rule !== 'none') return LeapYearUtils.isLeapYear(advancedConfig, year, true);

    // Fall back to standard Foundry leap year config
    const leapConfig = this.years?.leapYear;
    if (!leapConfig) return false;

    const interval = leapConfig.leapInterval;
    const start = leapConfig.leapStart ?? 0;

    if (!interval || interval <= 0) return false;

    // Use LeapYearUtils for consistency
    return LeapYearUtils.isLeapYear({ rule: 'simple', interval, start }, year, true);
  }

  /**
   * Check if the current year is a leap year.
   * @param {number|TimeComponents} [time] - Time to check, defaults to current world time
   * @returns {boolean} True if the year is a leap year
   */
  isCurrentYearLeapYear(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);
    return this.isLeapYear(displayYear);
  }

  /**
   * Get the number of days in a month, accounting for leap years.
   * @param {number} monthIndex - The 0-indexed month
   * @param {number} year - The display year
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
   * @param {number} year - The display year
   * @returns {number} Total days in the year
   */
  getDaysInYear(year) {
    const isLeap = this.isLeapYear(year);
    return (this.months?.values ?? []).reduce((sum, month) => {
      const days = isLeap && month.leapDays != null ? month.leapDays : month.days;
      return sum + days;
    }, 0);
  }

  /**
   * Get a description of the leap year rule.
   * @returns {string} Human-readable description
   */
  getLeapYearDescription() {
    // Check for advanced leap year config first
    const advancedConfig = this.leapYearConfig;
    if (advancedConfig?.rule && advancedConfig.rule !== 'none') return LeapYearUtils.getLeapYearDescription(advancedConfig);

    // Fall back to standard Foundry leap year config
    const leapConfig = this.years?.leapYear;
    if (!leapConfig) return LeapYearUtils.getLeapYearDescription(null);

    // Convert Foundry format to LeapYearUtils format
    return LeapYearUtils.getLeapYearDescription({ rule: 'simple', interval: leapConfig.leapInterval, start: leapConfig.leapStart ?? 0 });
  }

  /* -------------------------------------------- */

  /**
   * Get the number of hours in a given day.
   * @param {number|TimeComponents} [time]  The time to use, by default the current world time.
   * @returns {number}                      Number of hours between sunrise and sunset.
   */
  daylightHours(time = game.time.components) {
    return this.sunset(time) - this.sunrise(time);
  }

  /**
   * Progress between sunrise and sunset assuming it is daylight half the day duration.
   * @param {number|TimeComponents} [time]  The time to use, by default the current world time.
   * @returns {number}                      Progress through day period, with 0 representing sunrise and 1 sunset.
   */
  progressDay(time = game.time.components) {
    return (CalendariaCalendar.hoursOfDay(time, this) - this.sunrise(time)) / this.daylightHours(time);
  }

  /**
   * Progress between sunset and sunrise assuming it is night half the day duration.
   * @param {number|TimeComponents} [time]  The time to use, by default the current world time.
   * @returns {number}                      Progress through night period, with 0 representing sunset and 1 sunrise.
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
   * @param {number|TimeComponents} [time]  The time to use, by default the current world time.
   * @returns {number}                      Sunrise time in hours.
   */
  sunrise(time = game.time.components) {
    const daylightHrs = this._getDaylightHoursForDay(time);
    const midday = this.days.hoursPerDay / 2;
    return midday - daylightHrs / 2;
  }

  /**
   * Get the sunset time for a given day.
   * Uses dynamic daylight calculation if enabled, otherwise static 75% of day.
   * @param {number|TimeComponents} [time]  The time to use, by default the current world time.
   * @returns {number}                      Sunset time in hours.
   */
  sunset(time = game.time.components) {
    const daylightHrs = this._getDaylightHoursForDay(time);
    const midday = this.days.hoursPerDay / 2;
    return midday + daylightHrs / 2;
  }

  /**
   * Get solar midday - the midpoint between sunrise and sunset.
   * This varies throughout the year when dynamic daylight is enabled.
   * @param {number|TimeComponents} [time]  The time to use, by default the current world time.
   * @returns {number}                      Solar midday time in hours.
   */
  solarMidday(time = game.time.components) {
    return (this.sunrise(time) + this.sunset(time)) / 2;
  }

  /**
   * Get solar midnight - the midpoint of the night period.
   * This is halfway between sunset and the next sunrise.
   * @param {number|TimeComponents} [time]  The time to use, by default the current world time.
   * @returns {number}                      Solar midnight time in hours (may exceed hoursPerDay for next day).
   */
  solarMidnight(time = game.time.components) {
    const sunsetHour = this.sunset(time);
    const nightHours = this.days.hoursPerDay - this.daylightHours(time);
    return sunsetHour + nightHours / 2;
  }

  /**
   * Calculate daylight hours for a specific day based on dynamic daylight settings.
   * @param {number|TimeComponents} [time]  The time to use.
   * @returns {number}                      Hours of daylight for this day.
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
   * @param {object} components
   * @param {number} [components.year]   Visible year (with `yearZero` added in).
   * @param {number} [components.month]  Index of month.
   * @param {number} [components.day]    Day within the month.
   */
  async jumpToDate({ year, month, day }) {
    const components = { ...game.time.components };
    year ??= components.year + this.years.yearZero;
    month ??= components.month;
    day ??= components.dayOfMonth;

    // Subtract out year zero
    components.year = year - this.years.yearZero;
    const { leapYear } = this._decomposeTimeYears(this.componentsToTime(components));

    // Convert days within month to day of year
    let dayOfYear = day - 1;
    for (let idx = 0; idx < month; idx++) {
      const m = this.months.values[idx];
      dayOfYear += leapYear ? (m.leapDays ?? m.days) : m.days;
    }
    components.day = dayOfYear;
    components.month = month;

    await game.time.set(components);
  }

  /* -------------------------------------------- */
  /*  Festival Day Methods                        */
  /* -------------------------------------------- */

  /**
   * Find festival day for current day.
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
   * @returns {{name: string, month: number, day: number, leapYearOnly: boolean}|null}
   */
  findFestivalDay(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);
    const isLeap = this.isLeapYear(displayYear);

    return (
      this.festivals?.find((f) => {
        // Check date match
        if (f.month !== components.month + 1 || f.day !== components.dayOfMonth + 1) return false;
        // If leap-year-only festival, only show in leap years
        if (f.leapYearOnly && !isLeap) return false;
        return true;
      }) ?? null
    );
  }

  /**
   * Check if a date is a festival day.
   * @param {number|TimeComponents} [time]  Time to check.
   * @returns {boolean}
   */
  isFestivalDay(time = game.time.worldTime) {
    return this.findFestivalDay(time) !== null;
  }

  /**
   * Count festival days that don't count for weekday calculation before a given date in the same year.
   * Used to adjust weekday calculations for intercalary days.
   * @param {number|TimeComponents} time  Time to check up to.
   * @returns {number} Number of non-counting festival days before this date in the year.
   */
  countNonWeekdayFestivalsBefore(time) {
    if (!this.festivals?.length) return 0;

    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);
    const isLeap = this.isLeapYear(displayYear);

    // Current date as 1-indexed (month: 1-N, day: 1-N)
    const currentMonth = components.month + 1;
    const currentDay = components.dayOfMonth + 1;

    let count = 0;
    for (const festival of this.festivals) {
      // Skip festivals that count for weekdays (default behavior)
      if (festival.countsForWeekday !== false) continue;

      // Skip leap-year-only festivals in non-leap years
      if (festival.leapYearOnly && !isLeap) continue;

      // Check if festival is before current date (not including current date)
      if (festival.month < currentMonth) count++;
      else if (festival.month === currentMonth && festival.day < currentDay) count++;
    }

    return count;
  }

  /**
   * Check if a specific date is a non-counting festival day.
   * @param {number|TimeComponents} time  Time to check.
   * @returns {boolean} True if date is a festival that doesn't count for weekdays.
   */
  isNonWeekdayFestival(time) {
    const festival = this.findFestivalDay(time);
    return festival?.countsForWeekday === false;
  }

  /* -------------------------------------------- */
  /*  Moon Phase Methods                          */
  /* -------------------------------------------- */

  /**
   * Get the current phase of a moon using FC-style distribution.
   * Primary phases (new/full moon) get floor(cycleLength/8) days each,
   * remaining phases split the leftover days evenly.
   * @param {number} [moonIndex=0]  Index of the moon (0 for primary moon).
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
   * @returns {{name: string, subPhaseName: string, icon: string, position: number}|null}
   */
  getMoonPhase(moonIndex = 0, time = game.time.worldTime) {
    const moon = this.moons?.[moonIndex];
    if (!moon) return null;
    if (!this.months?.values) return null;
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;

    // Calculate days since reference date
    const currentDays = this._componentsToDays(components);
    const referenceDays = this._componentsToDays(moon.referenceDate);
    const daysSinceReference = currentDays - referenceDays;

    // Guard against invalid calculations
    if (!Number.isFinite(daysSinceReference) || !Number.isFinite(moon.cycleLength) || moon.cycleLength <= 0) {
      return moon.phases?.[0] ? { name: moon.phases[0].name, subPhaseName: moon.phases[0].name, icon: moon.phases[0].icon || '', position: 0, dayInCycle: 0 } : null;
    }

    // Calculate position in cycle (0-1), including manual adjustment
    const cycleDayAdjust = Number.isFinite(moon.cycleDayAdjust) ? moon.cycleDayAdjust : 0;
    const daysIntoCycleRaw = (((daysSinceReference % moon.cycleLength) + moon.cycleLength) % moon.cycleLength) + cycleDayAdjust;
    const daysIntoCycle = ((daysIntoCycleRaw % moon.cycleLength) + moon.cycleLength) % moon.cycleLength;
    const normalizedPosition = daysIntoCycle / moon.cycleLength;
    const numPhases = moon.phases?.length || 8;
    const phaseDays = CalendariaCalendar.#buildPhaseDayDistribution(moon.cycleLength, numPhases);

    // Find which phase contains the current day
    const dayIndex = Math.floor(daysIntoCycle);
    let cumulativeDays = 0;
    let phaseArrayIndex = 0;
    let dayWithinPhase = 0;

    for (let i = 0; i < phaseDays.length; i++) {
      if (dayIndex < cumulativeDays + phaseDays[i]) {
        phaseArrayIndex = i;
        dayWithinPhase = dayIndex - cumulativeDays;
        break;
      }
      cumulativeDays += phaseDays[i];
    }

    const matchedPhase = moon.phases[phaseArrayIndex] || moon.phases?.[0];
    if (!matchedPhase) return null;

    // Calculate sub-phase name (Rising/Peak/Fading)
    const phaseDuration = phaseDays[phaseArrayIndex];
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
      // For non-standard phase counts, distribute evenly
      const baseDays = Math.floor(cycleLength / numPhases);
      const remainder = cycleLength % numPhases;
      return Array.from({ length: numPhases }, (_, i) => baseDays + (i < remainder ? 1 : 0));
    }

    const primaryDays = Math.floor(cycleLength / 8);
    const totalPrimaryDays = primaryDays * 2;
    const remainingDays = cycleLength - totalPrimaryDays;
    const secondaryDays = Math.floor(remainingDays / 6);
    const extraDays = remainingDays % 6;

    // Distribution: [New, WaxCres, 1stQ, WaxGib, Full, WanGib, LastQ, WanCres]
    // Primary phases at index 0 (new) and 4 (full)
    const distribution = [];
    let extraAssigned = 0;

    for (let i = 0; i < 8; i++) {
      if (i === 0 || i === 4) {
        // Primary phases (new moon, full moon)
        distribution.push(primaryDays);
      } else {
        // Secondary phases - distribute extra days to early secondary phases
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
    if (phaseDuration <= 1) return game.i18n.localize(phaseName);

    // Divide phase into thirds: Rising, Peak, Fading
    const third = phaseDuration / 3;

    if (dayWithinPhase < third) {
      if (phase.rising) return game.i18n.localize(phase.rising);
      return game.i18n.format('CALENDARIA.MoonPhase.SubPhase.Rising', { phase: game.i18n.localize(phaseName) });
    } else if (dayWithinPhase >= phaseDuration - third) {
      if (phase.fading) return game.i18n.localize(phase.fading);
      return game.i18n.format('CALENDARIA.MoonPhase.SubPhase.Fading', { phase: game.i18n.localize(phaseName) });
    }
    return game.i18n.localize(phaseName);
  }

  /**
   * Get all moon phases for the current time.
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
   * @returns {Array<{name: string, icon: string, position: number}>}
   */
  getAllMoonPhases(time = game.time.worldTime) {
    if (!this.moons) return [];
    return this.moons.map((moon, index) => this.getMoonPhase(index, time)).filter(Boolean);
  }

  /**
   * Convert time components to total days (helper for moon calculations).
   * @param {TimeComponents|object} components  Time components (can have 'day' or 'dayOfMonth').
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

  /* -------------------------------------------- */
  /*  Season Methods                              */
  /* -------------------------------------------- */

  /**
   * Get the current season for a given time.
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
   * @returns {{name: string, abbreviation?: string, icon?: string, color?: string}|null}
   */
  getCurrentSeason(time = game.time.worldTime) {
    if (!this.seasons?.values?.length) return null;

    const components = typeof time === 'number' ? this.timeToComponents(time) : time;

    // Calculate day of year (0-indexed)
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) dayOfYear += this.months.values[i]?.days ?? 0;

    // Check each season
    for (const season of this.seasons.values) {
      // Handle both formats: dayStart/dayEnd OR monthStart/monthEnd
      if (season.dayStart != null && season.dayEnd != null) {
        // Day of year format (0-indexed)
        if (season.dayStart <= season.dayEnd) {
          // Normal range (e.g., Spring: 78-170)
          if (dayOfYear >= season.dayStart && dayOfYear <= season.dayEnd) return season;
        } else {
          // Wrapping range (e.g., Winter: 354-77)
          if (dayOfYear >= season.dayStart || dayOfYear <= season.dayEnd) return season;
        }
      } else if (season.monthStart != null && season.monthEnd != null) {
        // Month-based format (1-indexed months)
        const currentMonth = components.month + 1; // Convert to 1-indexed
        const startDay = season.dayStart ?? 1;
        const endDay = season.dayEnd ?? this.months.values[season.monthEnd - 1]?.days ?? 30;

        if (season.monthStart <= season.monthEnd) {
          // Normal range
          if (currentMonth > season.monthStart && currentMonth < season.monthEnd) return season;
          if (currentMonth === season.monthStart && components.dayOfMonth + 1 >= startDay) return season;
          if (currentMonth === season.monthEnd && components.dayOfMonth + 1 <= endDay) return season;
        } else {
          // Wrapping range (e.g., Winter: month 11 to month 2)
          if (currentMonth > season.monthStart || currentMonth < season.monthEnd) return season;
          if (currentMonth === season.monthStart && components.dayOfMonth + 1 >= startDay) return season;
          if (currentMonth === season.monthEnd && components.dayOfMonth + 1 <= endDay) return season;
        }
      }
    }

    // Fallback: return first season if none matched
    return this.seasons.values[0] ?? null;
  }

  /**
   * Get all seasons for this calendar.
   * @returns {Array<{name: string, abbreviation?: string}>}
   */
  getAllSeasons() {
    return this.seasons?.values ?? [];
  }

  /* -------------------------------------------- */
  /*  Era Methods                                 */
  /* -------------------------------------------- */

  /**
   * Get the current era for a given year.
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
   * @returns {{name: string, abbreviation: string, format: string, template: string|null, yearInEra: number}|null}
   */
  getCurrentEra(time = game.time.worldTime) {
    if (!this.eras?.length) return null;

    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);

    // Find matching era (sorted by startYear descending to get most recent first)
    const sortedEras = [...this.eras].sort((a, b) => b.startYear - a.startYear);
    for (const era of sortedEras) {
      if (displayYear >= era.startYear && (era.endYear == null || displayYear <= era.endYear)) {
        return { name: era.name, abbreviation: era.abbreviation, format: era.format || 'suffix', template: era.template || null, yearInEra: displayYear - era.startYear + 1 };
      }
    }

    // Fallback: return first era if none matched
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

    const abbr = eraData.abbreviation ? game.i18n.localize(eraData.abbreviation) : '';
    const eraName = eraData.name ? game.i18n.localize(eraData.name) : '';

    // Template mode: use {{variable}} pattern substitution
    if (eraData.template) {
      return formatEraTemplate(eraData.template, { year, abbreviation: abbr, era: eraName, yearInEra: eraData.yearInEra });
    }

    // Legacy mode: simple prefix/suffix
    if (!abbr) return String(year);
    if (eraData.format === 'prefix') return `${abbr} ${year}`;
    return `${year} ${abbr}`;
  }

  /**
   * Get all eras for this calendar.
   * @returns {Array<{name: string, abbreviation: string, startYear: number, endYear?: number}>}
   */
  getAllEras() {
    return this.eras ?? [];
  }

  /* -------------------------------------------- */
  /*  Canonical Hour Methods                      */
  /* -------------------------------------------- */

  /**
   * Get the current canonical hour for a given time.
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
   * @returns {{name: string, abbreviation: string, startHour: number, endHour: number}|null}
   */
  getCanonicalHour(time = game.time.worldTime) {
    if (!this.canonicalHours?.length) return null;

    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const currentHour = components.hour;

    // Find matching canonical hour
    for (const ch of this.canonicalHours) {
      if (ch.startHour <= ch.endHour)
        if (currentHour >= ch.startHour && currentHour < ch.endHour) return ch;
        else if (currentHour >= ch.startHour || currentHour < ch.endHour) return ch;
    }

    // Fallback: check for exact end hour match (some definitions may use inclusive end)
    for (const ch of this.canonicalHours) if (currentHour === ch.endHour) return ch;

    return null;
  }

  /**
   * Get all canonical hours for this calendar.
   * @returns {Array<{name: string, abbreviation: string, startHour: number, endHour: number}>}
   */
  getAllCanonicalHours() {
    return this.canonicalHours ?? [];
  }

  /* -------------------------------------------- */
  /*  Named Week Methods                          */
  /* -------------------------------------------- */

  /**
   * Get the current week number and name for a given time.
   * Supports both month-based and year-based week counting.
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
   * @returns {{weekNumber: number, weekName: string, weekAbbr: string, type: string}|null}
   */
  getCurrentWeek(time = game.time.worldTime) {
    if (!this.weeks?.enabled || !this.weeks?.names?.length) return null;

    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const daysInWeek = this.days?.values?.length || 7;
    const weekNames = this.weeks.names;

    let weekNumber;
    if (this.weeks.type === 'month-based') {
      // Week number within the current month (1-indexed)
      const dayOfMonth = components.dayOfMonth; // 0-indexed
      weekNumber = Math.floor(dayOfMonth / daysInWeek);
    } else {
      // Week number within the year (0-indexed, then converted to 1-indexed)
      let dayOfYear = components.dayOfMonth;
      for (let i = 0; i < components.month; i++) dayOfYear += this.months.values[i]?.days ?? 0;
      weekNumber = Math.floor(dayOfYear / daysInWeek);
    }

    // Get week name (cycle through names array)
    const nameIndex = weekNumber % weekNames.length;
    const week = weekNames[nameIndex];

    return { weekNumber: weekNumber + 1, weekName: game.i18n.localize(week?.name ?? ''), weekAbbr: week?.abbreviation ? game.i18n.localize(week.abbreviation) : '', type: this.weeks.type };
  }

  /**
   * Get week number within the year (1-indexed).
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
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
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
   * @returns {number} Week number (1-indexed).
   */
  getWeekOfMonth(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const daysInWeek = this.days?.values?.length || 7;
    return Math.floor(components.dayOfMonth / daysInWeek) + 1;
  }

  /**
   * Get all named weeks for this calendar.
   * @returns {Array<{name: string, abbreviation: string}>}
   */
  getAllNamedWeeks() {
    return this.weeks?.names ?? [];
  }

  /* -------------------------------------------- */
  /*  Cycle Methods                               */
  /* -------------------------------------------- */

  /**
   * Get the current values for all cycles.
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
   * @returns {{text: string, values: Array<{cycleName: string, entryName: string, index: number}>}}
   */
  getCycleValues(time = game.time.worldTime) {
    if (!this.cycles?.length) return { text: '', values: [] };

    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);

    // Calculate various epoch values for different basedOn types
    const epochValues = this._getCycleEpochValues(components, displayYear);

    const values = [];
    const textReplacements = { n: '<br>' };

    for (let i = 0; i < this.cycles.length; i++) {
      const cycle = this.cycles[i];
      if (!cycle.entries?.length) continue;

      const epochValue = epochValues[cycle.basedOn] ?? 0;

      // Calculate cycle index: floor((epochValue / length) + (offset / length)) % entries.length
      let cycleNum = Math.floor(epochValue / cycle.length);
      if (cycleNum < 0) cycleNum += Math.ceil(Math.abs(epochValue) / cycle.entries.length) * cycle.entries.length;
      const cycleIndex = (cycleNum + Math.floor((cycle.offset || 0) / cycle.length)) % cycle.entries.length;
      const normalizedIndex = ((cycleIndex % cycle.entries.length) + cycle.entries.length) % cycle.entries.length;

      const entry = cycle.entries[normalizedIndex];
      values.push({ cycleName: cycle.name, entryName: entry?.name ?? '', index: normalizedIndex });

      // Add to text replacements for format template
      textReplacements[(i + 1).toString()] = game.i18n.localize(entry?.name ?? '');
    }

    // Format the cycle text using the template
    let text = this.cycleFormat || '';
    for (const [key, value] of Object.entries(textReplacements)) text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);

    return { text, values };
  }

  /**
   * Calculate epoch values for different cycle basedOn types.
   * @param {TimeComponents} components  Time components.
   * @param {number} displayYear         The display year (with yearZero applied).
   * @returns {object}                   Epoch values keyed by basedOn type.
   * @private
   */
  _getCycleEpochValues(components, displayYear) {
    // Calculate day of year
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) dayOfYear += this.months.values[i]?.days ?? 0;

    // Calculate total days
    const totalDays = this._componentsToDays(components);

    // Get era year if applicable
    let eraYear = displayYear;
    const era = this.getCurrentEra({ year: components.year, month: components.month, dayOfMonth: components.dayOfMonth });
    if (era) eraYear = era.yearInEra;

    return { year: displayYear, eraYear, month: components.month, monthDay: components.dayOfMonth, day: totalDays, yearDay: dayOfYear };
  }

  /**
   * Get all cycles for this calendar.
   * @returns {Array<{name: string, length: number, offset: number, basedOn: string, entries: Array}>}
   */
  getAllCycles() {
    return this.cycles ?? [];
  }

  /* -------------------------------------------- */
  /*  Formatter Methods                           */
  /* -------------------------------------------- */

  /**
   * Prepare formatting context from calendar and components.
   * @param {CalendariaCalendar} calendar  The calendar instance.
   * @param {TimeComponents} components    Time components.
   * @returns {object} Formatting context with year, month, day parts.
   */
  static dateFormattingParts(calendar, components) {
    const month = calendar.months.values[components.month];
    const year = components.year + (calendar.years?.yearZero ?? 0);

    // 12-hour time calculation
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    const midday = Math.floor(hoursPerDay / 2);
    const hour24 = components.hour;
    const isPM = hour24 >= midday;
    const hour12 = hour24 === 0 ? midday : hour24 > midday ? hour24 - midday : hour24;
    const amPm = calendar.amPmNotation ?? {};
    const period = isPM ? amPm.pm || 'PM' : amPm.am || 'AM';

    // Canonical hour lookup
    const canonicalHour = calendar.getCanonicalHour?.(components);
    const chName = canonicalHour ? game.i18n.localize(canonicalHour.name) : '';
    const chAbbr = canonicalHour?.abbreviation ? game.i18n.localize(canonicalHour.abbreviation) : '';

    // Named week lookup
    const currentWeek = calendar.getCurrentWeek?.(components);
    const weekName = currentWeek?.weekName ?? '';
    const weekAbbr = currentWeek?.weekAbbr ?? '';
    const weekNum = currentWeek?.weekNumber ?? calendar.getWeekOfYear?.(components) ?? 1;

    return {
      y: year,
      yyyy: String(year).padStart(4, '0'),
      B: game.i18n.localize(month?.name ?? 'Unknown'),
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
   * @param {CalendariaCalendar} calendar  The calendar instance.
   * @param {TimeComponents} components    Time components.
   * @param {object} options               Formatting options.
   * @returns {string} Formatted date string.
   */
  static formatMonthDay(calendar, components, options = {}) {
    const festivalDay = calendar.findFestivalDay?.(components);
    if (festivalDay) return game.i18n.localize(festivalDay.name);

    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    return game.i18n.format('CALENDARIA.Formatters.DayMonth', { day: context.d, month: context.B });
  }

  /**
   * Format full date with month, day, and year, accounting for festival days.
   * @param {CalendariaCalendar} calendar  The calendar instance.
   * @param {TimeComponents} components    Time components.
   * @param {object} options               Formatting options.
   * @returns {string} Formatted date string.
   */
  static formatMonthDayYear(calendar, components, options = {}) {
    const festivalDay = calendar.findFestivalDay?.(components);
    if (festivalDay) {
      const context = CalendariaCalendar.dateFormattingParts(calendar, components);
      return game.i18n.format('CALENDARIA.Formatters.FestivalDayYear', { day: game.i18n.localize(festivalDay.name), yyyy: context.y });
    }

    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    return game.i18n.format('CALENDARIA.Formatters.DayMonthYear', { day: context.d, month: context.B, yyyy: context.y });
  }

  /**
   * Format hours and minutes.
   * @param {CalendariaCalendar} calendar  The calendar instance.
   * @param {TimeComponents} components    Time components.
   * @param {object} options               Formatting options.
   * @returns {string} Formatted time string.
   */
  static formatHoursMinutes(calendar, components, options = {}) {
    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    return `${context.H}:${context.M}`;
  }

  /**
   * Format hours, minutes, and seconds.
   * @param {CalendariaCalendar} calendar  The calendar instance.
   * @param {TimeComponents} components    Time components.
   * @param {object} options               Formatting options.
   * @returns {string} Formatted time string.
   */
  static formatHoursMinutesSeconds(calendar, components, options = {}) {
    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    return `${context.H}:${context.M}:${context.S}`;
  }

  /**
   * Format time in 12-hour format with AM/PM notation.
   * @param {CalendariaCalendar} calendar  The calendar instance.
   * @param {TimeComponents} components    Time components.
   * @param {object} options               Formatting options.
   * @param {boolean} [options.seconds=false]  Include seconds.
   * @returns {string} Formatted time string (e.g., "3:45 PM").
   */
  static formatTime12Hour(calendar, components, options = {}) {
    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    if (options.seconds) return `${context.h}:${context.M}:${context.S} ${context.p}`;
    return `${context.h}:${context.M} ${context.p}`;
  }

  /**
   * Format a date using a custom template or predefined format.
   * @param {CalendariaCalendar} calendar  The calendar instance.
   * @param {TimeComponents} components    Time components.
   * @param {string} format                Template key ('short', 'long', 'full', 'time', 'time12') or custom template.
   * @returns {string} Formatted date string.
   */
  static formatDateWithTemplate(calendar, components, format = 'long') {
    const context = CalendariaCalendar.dateFormattingParts(calendar, components);

    // Get template from calendar's dateFormats or use format as template
    let template;
    if (calendar.dateFormats?.[format]) {
      template = calendar.dateFormats[format];
    } else if (format.includes('{{')) {
      template = format;
    } else {
      const defaults = { short: '{{d}} {{b}}', long: '{{d}} {{B}}, {{y}}', full: '{{B}} {{d}}, {{y}}', time: '{{H}}:{{M}}', time12: '{{h}}:{{M}} {{p}}' };
      template = defaults[format] ?? defaults.long;
    }

    // Replace all {{variable}} placeholders
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }

  /**
   * Get available format variables with descriptions.
   * @returns {object} Map of variable names to descriptions.
   */
  static getFormatVariables() {
    return {
      y: game.i18n.localize('CALENDARIA.FormatVar.y'),
      yyyy: game.i18n.localize('CALENDARIA.FormatVar.yyyy'),
      B: game.i18n.localize('CALENDARIA.FormatVar.B'),
      b: game.i18n.localize('CALENDARIA.FormatVar.b'),
      m: game.i18n.localize('CALENDARIA.FormatVar.m'),
      mm: game.i18n.localize('CALENDARIA.FormatVar.mm'),
      d: game.i18n.localize('CALENDARIA.FormatVar.d'),
      dd: game.i18n.localize('CALENDARIA.FormatVar.dd'),
      j: game.i18n.localize('CALENDARIA.FormatVar.j'),
      w: game.i18n.localize('CALENDARIA.FormatVar.w'),
      H: game.i18n.localize('CALENDARIA.FormatVar.H'),
      h: game.i18n.localize('CALENDARIA.FormatVar.h'),
      hh: game.i18n.localize('CALENDARIA.FormatVar.hh'),
      M: game.i18n.localize('CALENDARIA.FormatVar.M'),
      S: game.i18n.localize('CALENDARIA.FormatVar.S'),
      p: game.i18n.localize('CALENDARIA.FormatVar.p'),
      P: game.i18n.localize('CALENDARIA.FormatVar.P'),
      ch: game.i18n.localize('CALENDARIA.FormatVar.ch'),
      chAbbr: game.i18n.localize('CALENDARIA.FormatVar.chAbbr'),
      W: game.i18n.localize('CALENDARIA.FormatVar.W'),
      WW: game.i18n.localize('CALENDARIA.FormatVar.WW'),
      WN: game.i18n.localize('CALENDARIA.FormatVar.WN'),
      Wn: game.i18n.localize('CALENDARIA.FormatVar.Wn')
    };
  }

  /* -------------------------------------------- */
  /*  Climate Zone Methods                        */
  /* -------------------------------------------- */

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

    // Try exact match first, then lowercase, then _default
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
