/**
 * Extended calendar data model with Calendaria-specific features.
 * System-agnostic calendar that extends Foundry's base CalendarData.
 *
 * Features:
 * - Festival/intercalary days
 * - Moon phases
 * - Custom metadata
 * - Utility methods from CalendarData5e (sunrise, sunset, etc.)
 *
 * @extends {foundry.data.CalendarData}
 * @module Calendar/Data/CalendariaCalendar
 * @author Tyler
 */

const { ArrayField, NumberField, SchemaField, StringField } = foundry.data.fields;

export default class CalendariaCalendar extends foundry.data.CalendarData {
  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return {
      ...schema,

      /**
       * Festival/intercalary days (days outside normal calendar structure)
       * @type {Array<{name: string, month: number, day: number}>}
       */
      festivals: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true }),
          month: new NumberField({ required: true, nullable: false, min: 1, integer: true }),
          day: new NumberField({ required: true, nullable: false, min: 1, integer: true })
        })
      ),

      /**
       * Moon configurations for this calendar
       * @type {Array<{name: string, cycleLength: number, phases: Array, referenceDate: object}>}
       */
      moons: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true }),
          cycleLength: new NumberField({ required: true, nullable: false, min: 1, integer: true }),
          phases: new ArrayField(
            new SchemaField({
              name: new StringField({ required: true }),
              icon: new StringField({ required: false }),
              start: new NumberField({ required: true, min: 0, max: 1 }), // Percentage of cycle
              end: new NumberField({ required: true, min: 0, max: 1 })
            })
          ),
          referenceDate: new SchemaField({
            year: new NumberField({ required: true, integer: true }),
            month: new NumberField({ required: true, integer: true }),
            day: new NumberField({ required: true, integer: true })
          })
        })
      ),

      /**
       * Calendar metadata
       * @type {object}
       */
      metadata: new SchemaField(
        {
          id: new StringField({ required: false }),
          description: new StringField({ required: false }),
          author: new StringField({ required: false }),
          system: new StringField({ required: false }) // e.g., "Forgotten Realms", "Eberron"
        },
        { required: false }
      )
    };
  }

  /* -------------------------------------------- */
  /*  Calendar Helper Methods (from 5e)           */
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
   * @param {number|TimeComponents} [time]  The time to use, by default the current world time.
   * @returns {number}                      Sunrise time in hours.
   */
  sunrise(time = game.time.components) {
    return this.days.hoursPerDay * 0.25;
  }

  /**
   * Get the sunset time for a given day.
   * @param {number|TimeComponents} [time]  The time to use, by default the current world time.
   * @returns {number}                      Sunset time in hours.
   */
  sunset(time = game.time.components) {
    return this.days.hoursPerDay * 0.75;
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
   * @returns {{name: string, month: number, day: number}|null}
   */
  findFestivalDay(time = game.time.worldTime) {
    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    return this.festivals?.find((f) => f.month === components.month + 1 && f.day === components.dayOfMonth + 1) ?? null;
  }

  /**
   * Check if a date is a festival day.
   * @param {number|TimeComponents} [time]  Time to check.
   * @returns {boolean}
   */
  isFestivalDay(time = game.time.worldTime) {
    return this.findFestivalDay(time) !== null;
  }

  /* -------------------------------------------- */
  /*  Moon Phase Methods                          */
  /* -------------------------------------------- */

  /**
   * Get the current phase of a moon.
   * @param {number} [moonIndex=0]  Index of the moon (0 for primary moon).
   * @param {number|TimeComponents} [time]  Time to use, by default the current world time.
   * @returns {{name: string, icon: string, position: number}|null}
   */
  getMoonPhase(moonIndex = 0, time = game.time.worldTime) {
    const moon = this.moons?.[moonIndex];
    if (!moon) return null;

    const components = typeof time === 'number' ? this.timeToComponents(time) : time;

    // Calculate days since reference date
    const currentDays = this._componentsToDays(components);
    const referenceDays = this._componentsToDays(moon.referenceDate);
    const daysSinceReference = currentDays - referenceDays;

    // Calculate position in cycle (0-1)
    const position = (daysSinceReference % moon.cycleLength) / moon.cycleLength;
    const normalizedPosition = ((position % 1) + 1) % 1; // Ensure 0-1 range

    // Find which phase this position falls into
    const phase = moon.phases.find((p) => normalizedPosition >= p.start && normalizedPosition < p.end);

    return phase
      ? {
          name: phase.name,
          icon: phase.icon || '',
          position: normalizedPosition,
          dayInCycle: Math.floor(normalizedPosition * moon.cycleLength)
        }
      : null;
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
   * @param {TimeComponents|object} components  Time components.
   * @returns {number}  Total days since epoch.
   * @private
   */
  _componentsToDays(components) {
    // Convert components to world time, then to days
    const worldTime = this.componentsToTime(components);
    const secondsPerDay = this.days.hoursPerDay * this.days.minutesPerHour * this.days.secondsPerMinute;
    return Math.floor(worldTime / secondsPerDay);
  }

  /* -------------------------------------------- */
  /*  Formatter Extensions                        */
  /* -------------------------------------------- */

  /**
   * Format month and day, accounting for festival days.
   * @override
   */
  static formatMonthDay(calendar, components, options) {
    const festivalDay = calendar.findFestivalDay(components);
    if (festivalDay) return game.i18n.localize(festivalDay.name);

    return super.formatMonthDay(calendar, components, options);
  }

  /**
   * Format full date, accounting for festival days.
   * @override
   */
  static formatMonthDayYear(calendar, components, options) {
    const festivalDay = calendar.findFestivalDay(components);
    if (festivalDay) {
      const context = this.dateFormattingParts(calendar, components);
      context.day = game.i18n.localize(festivalDay.name);
      return game.i18n.format('CALENDARIA.Formatters.FestivalDayYear', context);
    }
    return super.formatMonthDayYear(calendar, components, options);
  }
}
