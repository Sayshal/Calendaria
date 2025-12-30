/**
 * Localize a string key. Wrapper for game.i18n.localize.
 * @param {string} key - i18n key or string
 * @returns {string} Localized string (or original if not a key)
 */
export function localize(key) {
  return game.i18n.localize(key);
}

/**
 * Format a localized string with data. Wrapper for game.i18n.format.
 * @param {string} key - i18n key
 * @param {object} data - Data to interpolate
 * @returns {string} Formatted localized string
 */
export function format(key, data) {
  return game.i18n.format(key, data);
}

/**
 * Pre-localize all translatable fields in a calendar data object.
 * Mutates the object in-place.
 * @param {object} calendarData - Calendar data object to localize
 */
export function preLocalizeCalendar(calendarData) {
  if (!calendarData) return;
  if (calendarData.name) calendarData.name = localize(calendarData.name);
  if (calendarData.metadata?.description) calendarData.metadata.description = localize(calendarData.metadata.description);
  if (calendarData.months?.values) {
    for (const month of calendarData.months.values) {
      if (month.name) month.name = localize(month.name);
      if (month.abbreviation) month.abbreviation = localize(month.abbreviation);
    }
  }

  if (calendarData.days?.values) {
    for (const day of calendarData.days.values) {
      if (day.name) day.name = localize(day.name);
      if (day.abbreviation) day.abbreviation = localize(day.abbreviation);
    }
  }

  if (calendarData.seasons?.values) {
    for (const season of calendarData.seasons.values) {
      if (season.name) season.name = localize(season.name);
      if (season.abbreviation) season.abbreviation = localize(season.abbreviation);
    }
  }

  if (calendarData.eras) {
    for (const era of calendarData.eras) {
      if (era.name) era.name = localize(era.name);
      if (era.abbreviation) era.abbreviation = localize(era.abbreviation);
    }
  }

  if (calendarData.festivals) for (const festival of calendarData.festivals) if (festival.name) festival.name = localize(festival.name);
  if (calendarData.moons) for (const moon of calendarData.moons) if (moon.name) moon.name = localize(moon.name);
  if (calendarData.cycles) {
    for (const cycle of calendarData.cycles) {
      if (cycle.name) cycle.name = localize(cycle.name);
      if (cycle.entries) for (const entry of cycle.entries) if (entry.name) entry.name = localize(entry.name);
    }
  }

  if (calendarData.canonicalHours) {
    for (const hour of calendarData.canonicalHours) {
      if (hour.name) hour.name = localize(hour.name);
      if (hour.abbreviation) hour.abbreviation = localize(hour.abbreviation);
    }
  }

  if (calendarData.weeks?.names) {
    calendarData.weeks.names = calendarData.weeks.names.map((n) => {
      if (typeof n === 'string') return localize(n);
      if (n?.name) n.name = localize(n.name);
      if (n?.abbreviation) n.abbreviation = localize(n.abbreviation);
      return n;
    });
  }
}
