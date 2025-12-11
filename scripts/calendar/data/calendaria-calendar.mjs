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
       * Era configurations for this calendar
       * Eras define named periods of time (e.g., "Dale Reckoning", "Common Year")
       * @type {Array<{name: string, abbreviation: string, startYear: number, endYear: number|null, format: string}>}
       */
      eras: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true }),
          abbreviation: new StringField({ required: true }),
          startYear: new NumberField({ required: true, integer: true }),
          endYear: new NumberField({ required: false, nullable: true, integer: true }),
          format: new StringField({ required: false, initial: 'suffix' }) // 'prefix' or 'suffix'
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
    // Default: static 50% daylight (sunrise at 25%, sunset at 75%)
    if (!this.daylight?.enabled) {
      return this.days.hoursPerDay * 0.5;
    }

    const components = typeof time === 'number' ? this.timeToComponents(time) : time;

    // Calculate day of year (0-indexed)
    let dayOfYear = components.dayOfMonth;
    for (let i = 0; i < components.month; i++) {
      dayOfYear += this.months.values[i]?.days ?? 0;
    }

    const daysPerYear = this.days.daysPerYear ?? 365;
    const { shortestDay, longestDay, winterSolstice, summerSolstice } = this.daylight;

    // Calculate position in the annual cycle using cosine interpolation
    // Winter solstice = shortest day, Summer solstice = longest day
    const daysSinceWinter = (dayOfYear - winterSolstice + daysPerYear) % daysPerYear;
    const daysBetweenSolstices = (summerSolstice - winterSolstice + daysPerYear) % daysPerYear;

    // Use cosine for smooth transition: 0 at winter, 1 at summer, 0 at winter again
    let progress;
    if (daysSinceWinter <= daysBetweenSolstices) {
      // Between winter and summer solstice (days getting longer)
      progress = daysSinceWinter / daysBetweenSolstices;
    } else {
      // Between summer and winter solstice (days getting shorter)
      const daysSinceSummer = daysSinceWinter - daysBetweenSolstices;
      const daysWinterToSummer = daysPerYear - daysBetweenSolstices;
      progress = 1 - daysSinceSummer / daysWinterToSummer;
    }

    // Cosine interpolation for natural transition
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

    if (!this.months?.values) return null;

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
   * @returns {{name: string, abbreviation: string, format: string, yearInEra: number}|null}
   */
  getCurrentEra(time = game.time.worldTime) {
    if (!this.eras?.length) return null;

    const components = typeof time === 'number' ? this.timeToComponents(time) : time;
    const displayYear = components.year + (this.years?.yearZero ?? 0);

    // Find matching era (sorted by startYear descending to get most recent first)
    const sortedEras = [...this.eras].sort((a, b) => b.startYear - a.startYear);
    for (const era of sortedEras) {
      if (displayYear >= era.startYear && (era.endYear == null || displayYear <= era.endYear)) {
        return {
          name: era.name,
          abbreviation: era.abbreviation,
          format: era.format || 'suffix',
          yearInEra: displayYear - era.startYear + 1
        };
      }
    }

    // Fallback: return first era if none matched
    if (this.eras.length > 0) {
      const era = this.eras[0];
      return {
        name: era.name,
        abbreviation: era.abbreviation,
        format: era.format || 'suffix',
        yearInEra: displayYear
      };
    }

    return null;
  }

  /**
   * Format a year with its era designation.
   * @param {number} year  The display year to format.
   * @returns {string}  Formatted year string (e.g., "1492 DR" or "CY 591").
   */
  formatYearWithEra(year) {
    const era = this.getCurrentEra({ year: year - (this.years?.yearZero ?? 0), month: 0, dayOfMonth: 0 });
    if (!era) return String(year);

    const abbr = era.abbreviation ? game.i18n.localize(era.abbreviation) : '';
    if (!abbr) return String(year);
    if (era.format === 'prefix') return `${abbr} ${year}`;
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
      M: String(components.minute).padStart(2, '0'),
      S: String(components.second).padStart(2, '0')
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
    return game.i18n.format('CALENDARIA.Formatters.DayMonth', {
      day: context.d,
      month: context.B
    });
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
      return game.i18n.format('CALENDARIA.Formatters.FestivalDayYear', {
        day: game.i18n.localize(festivalDay.name),
        yyyy: context.y
      });
    }

    const context = CalendariaCalendar.dateFormattingParts(calendar, components);
    return game.i18n.format('CALENDARIA.Formatters.DayMonthYear', {
      day: context.d,
      month: context.B,
      yyyy: context.y
    });
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
}
