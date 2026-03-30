/**
 * Calendaria Public API
 * @module API
 * @author Tyler
 */

import { BigCal, CalendarEditor, Chronicle, CinematicOverlay, HUD, MiniCal, NoteViewer, SecondaryCalendar, Stopwatch, SunDial, TimeKeeper, WeatherProbabilityDialog } from './applications/_module.mjs';
import {
  CalendarManager,
  CalendarRegistry,
  convertDate as coreConvertDate,
  getCurrentDateOn as coreGetCurrentDateOn,
  getEquivalentDates as coreGetEquivalentDates,
  isBundledCalendar
} from './calendar/_module.mjs';
import {
  CONDITION_FIELDS,
  CONDITION_GROUP_MODES,
  CONDITION_OPERATORS,
  DISPLAY_STYLES,
  HOOKS,
  MODULE,
  NOTE_VISIBILITY,
  REPLACEABLE_ELEMENTS,
  SETTINGS,
  SOCKET_TYPES,
  TEMPLATES,
  WIDGET_POINTS
} from './constants.mjs';
import { CalendariaCalendar } from './data/_module.mjs';
import { FestivalManager } from './festivals/_module.mjs';
import { playStandaloneFX, stopAllFX } from './integrations/_module.mjs';
import {
  NoteManager,
  addCustomPreset,
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addSeconds,
  addYears,
  compareDates,
  compareDays,
  createGroup,
  dayOfWeek,
  daysBetween,
  deleteCustomPreset,
  getNextOccurrences,
  getOccurrencesInRange,
  hoursBetween,
  isRecurringMatch,
  isSameDay,
  isValidDate,
  minutesBetween,
  monthsBetween,
  secondsBetween,
  updatePreset
} from './notes/_module.mjs';
import { TimeClock, TimeTracker } from './time/_module.mjs';
import {
  CalendariaSocket,
  DEFAULT_FORMAT_PRESETS,
  PRESET_FORMATTERS,
  SearchManager,
  canAddNotes,
  canChangeActiveCalendar,
  canChangeDateTime,
  canEditCalendars,
  canEditNotes,
  canViewWeatherForecast,
  formatCustom,
  getAvailableTokens,
  getConvergencesInRange,
  getEclipseAtDate,
  getEclipsesInRange,
  getMoonPhasePosition,
  getNextConvergence,
  getNextEclipse,
  getNextFullMoon,
  getRegisteredWidgets,
  getWidgetByReplacement,
  isEclipseOnDate,
  isMoonFull,
  log,
  refreshWidgets,
  registerWidget,
  resolveFormatString,
  timeSince
} from './utils/_module.mjs';
import { clearRanges as fogClearRanges, getRevealedRanges as fogGetRevealedRanges, isRevealed as fogIsRevealed, revealRange as fogRevealRange, isFogEnabled } from './utils/fog-of-war.mjs';
import { WeatherManager, playStandaloneSound, stopStandaloneSound } from './weather/_module.mjs';

/**
 * Convert a public API date {month, day} (1-indexed) to internal {month, dayOfMonth} (0-indexed).
 * @param {object} date - Public API date object
 * @returns {object} Internal date object
 */
function toInternal(date) {
  const d = { ...date };
  if (d.month != null) d.month -= 1;
  if (d.day != null) {
    d.dayOfMonth = d.day - 1;
    delete d.day;
  }
  return d;
}

/**
 * Convert an internal date {month, dayOfMonth} (0-indexed) to public API {month, day} (1-indexed).
 * @param {object} date - Internal date object
 * @returns {object} Public API date object
 */
function toPublic(date) {
  const d = { ...date };
  d.month = (d.month ?? 0) + 1;
  d.day = (d.dayOfMonth ?? 0) + 1;
  delete d.dayOfMonth;
  return d;
}

/**
 * Strip content from note stubs for lightweight API responses.
 * Stubs already carry content from the index; this removes it when not requested.
 * @param {object[]} stubs - Array of note stubs
 * @returns {object[]} Stubs without `content` field
 */
function stripContent(stubs) {
  return stubs.map(({ content: _content, ...rest }) => rest);
}

/**
 * Convert a note stub's date fields from internal (0-indexed) to public API (1-indexed) format.
 * Deep-clones flagData to avoid mutating the internal note index.
 * @param {object} stub - Note stub from the internal index
 * @returns {object} Clone with public-format dates in flagData
 */
function toPublicStub(stub) {
  if (!stub?.flagData) return stub;
  const flagData = { ...stub.flagData };
  if (flagData.startDate) flagData.startDate = toPublic(flagData.startDate);
  if (flagData.endDate) flagData.endDate = toPublic(flagData.endDate);
  if (flagData.repeatEndDate) flagData.repeatEndDate = toPublic(flagData.repeatEndDate);
  return { ...stub, flagData };
}

/**
 * Convert an array of note stubs to public API format.
 * @param {object[]} stubs - Array of note stubs
 * @returns {object[]} Clones with public-format dates
 */
function toPublicStubs(stubs) {
  return stubs.map(toPublicStub);
}

/**
 * Enrich note stubs with occurrence metadata (next occurrence and occurrence count).
 * @param {object[]} stubs - Array of note stubs
 * @param {object} [rangeStart] - Optional range start for counting occurrences within a range
 * @param {object} [rangeEnd] - Optional range end for counting occurrences within a range
 * @param {number} [maxOccurrences] - Max occurrences to count per note (default: 100)
 * @returns {object[]} Stubs enriched with `nextOccurrence` and optionally `occurrenceCount`
 */
function enrichWithOccurrences(stubs, rangeStart = null, rangeEnd = null, maxOccurrences = 100) {
  const components = game.time.components ?? {};
  const calendar = CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  const fromDate = { year: (components.year ?? 0) + yearZero, month: components.month ?? 0, dayOfMonth: components.dayOfMonth ?? 0 };
  return stubs.map((stub) => {
    const enriched = { ...stub };
    const flagData = stub.flagData;
    if (!flagData) return enriched;
    const nextArr = getNextOccurrences(flagData, fromDate, 1);
    enriched.nextOccurrence = nextArr.length ? toPublic(nextArr[0]) : null;
    if (rangeStart && rangeEnd) {
      const occs = getOccurrencesInRange(flagData, rangeStart, rangeEnd, maxOccurrences);
      enriched.occurrenceCount = occs.length;
    }
    return enriched;
  });
}

/**
 * Public API for Calendaria module.
 * Provides access to calendar data, time management, moon phases, and more.
 */
export const CalendariaAPI = {
  /**
   * Get the current date and time components.
   * @returns {object} Current time components with month (1-indexed), day (1-indexed)
   */
  getCurrentDateTime() {
    const components = game.time.components;
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const { dayOfMonth: _dom, ...rest } = components;
    return { ...rest, year: components.year + yearZero, month: components.month + 1, day: _dom + 1 };
  },

  /**
   * Advance the current time by a delta.
   * @param {number} delta - Time delta in seconds to advance
   * @returns {Promise<number>} New world time after advancement
   */
  async advanceTime(delta) {
    if (!canChangeDateTime()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return game.time.worldTime;
    }
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta });
      return game.time.worldTime;
    }
    await CinematicOverlay.gatedAdvance(delta);
    return game.time.worldTime;
  },

  /**
   * Set the current date and time to specific components.
   * @param {object} components - Time components (month: 1-indexed, day: 1-indexed)
   * @returns {Promise<number>} New world time after setting
   */
  async setDateTime(components) {
    if (!canChangeDateTime()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return game.time.worldTime;
    }
    if (!CalendarManager.getActiveCalendar()) {
      log(1, 'setDateTime failed: no active calendar');
      return game.time.worldTime;
    }
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const internalComponents = { ...components };
    if (components.year !== undefined) internalComponents.year = components.year - yearZero;
    if (components.month !== undefined) internalComponents.month = components.month - 1;
    if (components.day !== undefined) {
      internalComponents.dayOfMonth = components.day - 1;
      delete internalComponents.day;
    }
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'set', components: internalComponents });
      return game.time.worldTime;
    }
    return await game.time.set(internalComponents);
  },

  /**
   * Jump to a specific date while preserving the current time of day.
   * @param {object} options - Date to jump to
   * @param {number} [options.year] - Target year
   * @param {number} [options.month] - Target month (1-indexed)
   * @param {number} [options.day] - Target day of month (1-indexed)
   * @returns {Promise<void>}
   */
  async jumpToDate({ year, month, day }) {
    if (!canChangeDateTime()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return;
    }
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) {
      log(1, 'jumpToDate failed: no active calendar');
      ui.notifications.warn('CALENDARIA.Error.NoActiveCalendar', { localize: true });
      return;
    }
    const dayOfMonth = day != null ? day - 1 : undefined;
    const monthIdx = month != null ? month - 1 : undefined;
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'jump', date: { year, month: monthIdx, dayOfMonth } });
      return;
    }
    await calendar.jumpToDate({ year, month: monthIdx, dayOfMonth });
  },

  /**
   * Get the currently active calendar.
   * @returns {object|null} The active calendar or null if none
   */
  getActiveCalendar() {
    return CalendarManager.getActiveCalendar();
  },

  /**
   * Get a specific calendar by ID.
   * @param {string} id - Calendar ID
   * @returns {object|null} The calendar or null if not found
   */
  getCalendar(id) {
    return CalendarManager.getCalendar(id);
  },

  /**
   * Get all registered calendars.
   * @returns {Map<string, object>} Map of calendar ID to calendar
   */
  getAllCalendars() {
    return CalendarManager.getAllCalendars();
  },

  /**
   * Get metadata for all calendars.
   * @returns {object[]} Array of calendar metadata
   */
  getAllCalendarMetadata() {
    return CalendarManager.getAllCalendarMetadata();
  },

  /**
   * Add a new calendar.
   * @param {string} id - Unique calendar ID
   * @param {object} definition - Calendar definition object
   * @returns {Promise<object|null>} The created calendar or null if the ID already exists
   */
  async addCalendar(id, definition) {
    return CalendarManager.addCalendar(id, definition);
  },

  /**
   * Switch to a different calendar.
   * @param {string} id - Calendar ID to switch to
   * @returns {Promise<boolean>} True if calendar was switched successfully
   */
  async switchCalendar(id) {
    if (!canChangeActiveCalendar()) {
      log(1, 'switchCalendar denied: insufficient permissions');
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return false;
    }
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.CALENDAR_REQUEST, { calendarId: id });
      return true;
    }
    return await CalendarManager.switchCalendar(id);
  },

  /**
   * Convert a date from one calendar to another.
   * @param {object} date - Date {year, month (1-indexed), day (1-indexed), hour?, minute?}
   * @param {string} fromCalendarId - Source calendar ID
   * @param {string} toCalendarId - Target calendar ID
   * @returns {object|null} Converted date {year, month (1-indexed), day (1-indexed), hour, minute} or null
   */
  convertDate(date, fromCalendarId, toCalendarId) {
    const internalDate = toInternal(date);
    const result = coreConvertDate(internalDate, fromCalendarId, toCalendarId);
    return result ? toPublic(result) : null;
  },

  /**
   * Get equivalent dates for a date on all other registered calendars.
   * @param {object} date - Date {year, month (1-indexed), day (1-indexed)}
   * @param {string} [calendarId] - Source calendar ID (defaults to active calendar)
   * @returns {Array<{calendarId: string, calendarName: string, date: object, formatted: string}>}
   */
  getEquivalentDates(date, calendarId = null) {
    const sourceId = calendarId ?? CalendarRegistry.getActiveId();
    if (!sourceId) return [];
    const internalDate = toInternal(date);
    return coreGetEquivalentDates(internalDate, sourceId).map((entry) => ({ ...entry, date: toPublic(entry.date) }));
  },

  /**
   * Get the current date expressed on a specific (non-active) calendar.
   * @param {string} calendarId - Target calendar ID
   * @returns {object|null} Date {year, month (1-indexed), day (1-indexed), hour, minute} or null
   */
  getCurrentDateOn(calendarId) {
    const result = coreGetCurrentDateOn(calendarId);
    return result ? toPublic(result) : null;
  },

  /**
   * Get the current phase of a specific moon.
   * @param {number} [moonIndex] - Index of the moon (0 for primary moon)
   * @returns {object|null} Moon phase data with name, icon, position, and dayInCycle
   */
  getMoonPhase(moonIndex = 0) {
    return CalendarManager.getCurrentMoonPhase(moonIndex);
  },

  /**
   * Get all moon phases for the active calendar.
   * @returns {Array<object>} Array of moon phase data
   */
  getAllMoonPhases() {
    return CalendarManager.getAllCurrentMoonPhases();
  },

  /**
   * Get the phase position (0-1) for a moon at a given date.
   * @param {object} moon - Moon definition with cycleLength and referenceDate
   * @param {object} [date] - Date to check { year, month, day }. Defaults to current date.
   * @returns {number} Phase position from 0 (new moon) to 1
   */
  getMoonPhasePosition(moon, date = null) {
    return getMoonPhasePosition(moon, date ? toInternal(date) : game.time.components);
  },

  /**
   * Check if a moon is in its full phase at a given date.
   * @param {object} moon - Moon definition
   * @param {object} [date] - Date to check. Defaults to current date.
   * @returns {boolean} True if moon is full
   */
  isMoonFull(moon, date = null) {
    return isMoonFull(moon, date ? toInternal(date) : game.time.components);
  },

  /**
   * Find the next date when all given moons are simultaneously full.
   * @param {object[]} moons - Array of moon definitions (use calendar.moonsArray)
   * @param {object} [startDate] - Date to start searching from. Defaults to current date.
   * @param {object} [options] - Search options
   * @param {number} [options.maxDays] - Maximum days to search (default: 1000)
   * @returns {object|null} Next convergence date { year, month, day }, or null if not found
   */
  getNextConvergence(moons, startDate = null, options = {}) {
    const start = startDate ? toInternal(startDate) : game.time.components;
    const result = getNextConvergence(moons, start, options);
    return result ? toPublic(result) : null;
  },

  /**
   * Find the next full moon date for a single moon.
   * @param {object} moon - Moon definition
   * @param {object} [startDate] - Date to start searching from. Defaults to current date.
   * @param {object} [options] - Search options
   * @param {number} [options.maxDays] - Maximum days to search (default: 1000)
   * @returns {object|null} Next full moon date { year, month, day }
   */
  getNextFullMoon(moon, startDate = null, options = {}) {
    const start = startDate ? toInternal(startDate) : game.time.components;
    const result = getNextFullMoon(moon, start, options);
    return result ? toPublic(result) : null;
  },

  /**
   * Get all convergences (all moons full simultaneously) within a date range.
   * @param {object[]} moons - Array of moon definitions
   * @param {object} startDate - Range start { year, month, day }
   * @param {object} endDate - Range end { year, month, day }
   * @param {object} [options] - Search options
   * @returns {object[]} Array of convergence dates
   */
  getConvergencesInRange(moons, startDate, endDate, options = {}) {
    return getConvergencesInRange(moons, toInternal(startDate), toInternal(endDate), options).map(toPublic);
  },

  /**
   * Get eclipse data for a moon on a specific date.
   * @param {object|number} moonOrIndex - Moon definition or index into moonsArray
   * @param {object} [date] - Date to check { year, month, day }. Defaults to current date.
   * @returns {object} Eclipse result { type, proximity } or { type: null }
   */
  getEclipse(moonOrIndex, date = null) {
    const calendar = CalendarManager.getActiveCalendar();
    const moon = typeof moonOrIndex === 'number' ? calendar?.moonsArray?.[moonOrIndex] : moonOrIndex;
    return getEclipseAtDate(moon, date ? toInternal(date) : game.time.components, calendar);
  },

  /**
   * Check if any eclipse occurs on a specific date.
   * @param {object} [date] - Date to check. Defaults to current date.
   * @returns {boolean}
   */
  isEclipse(date = null) {
    const calendar = CalendarManager.getActiveCalendar();
    return isEclipseOnDate(calendar?.moonsArray ?? [], date ? toInternal(date) : game.time.components, calendar);
  },

  /**
   * Find the next eclipse for a moon.
   * @param {object|number} moonOrIndex - Moon definition or index into moonsArray
   * @param {object} [startDate] - Date to start searching from. Defaults to current date.
   * @param {object} [options] - Search options
   * @param {number} [options.maxDays] - Maximum days to search
   * @returns {object|null} Result { date, type, proximity } or null
   */
  getNextEclipse(moonOrIndex, startDate = null, options = {}) {
    const calendar = CalendarManager.getActiveCalendar();
    const moon = typeof moonOrIndex === 'number' ? calendar?.moonsArray?.[moonOrIndex] : moonOrIndex;
    const start = startDate ? toInternal(startDate) : game.time.components;
    const result = getNextEclipse(moon, start, { ...options, calendar });
    if (!result) return null;
    return { ...result, date: toPublic(result.date) };
  },

  /**
   * Get all eclipses for a moon within a date range.
   * @param {object|number} moonOrIndex - Moon definition or index into moonsArray
   * @param {object} startDate - Range start { year, month, day }
   * @param {object} endDate - Range end { year, month, day }
   * @param {object} [options] - Search options
   * @returns {Array} Array of { date, type, proximity }
   */
  getEclipsesInRange(moonOrIndex, startDate, endDate, options = {}) {
    const calendar = CalendarManager.getActiveCalendar();
    const moon = typeof moonOrIndex === 'number' ? calendar?.moonsArray?.[moonOrIndex] : moonOrIndex;
    return getEclipsesInRange(moon, toInternal(startDate), toInternal(endDate), { ...options, calendar }).map((e) => ({ ...e, date: toPublic(e.date) }));
  },

  /**
   * Get the current season.
   * @returns {object|null} Season data with name and other properties
   */
  getCurrentSeason() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.seasons) return null;
    const components = game.time.components;
    const seasonIndex = components.season ?? 0;
    return calendar.seasonsArray?.[seasonIndex] ?? null;
  },

  /**
   * Get the current values for all cycles (zodiac signs, elemental weeks, etc).
   * @returns {{text: string, values: Array<{cycleName: string, entryName: string, index: number}>}|null}
   */
  getCycleValues() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    return calendar.getCycleValues();
  },

  /**
   * Get the sunrise time in hours for the current day.
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {number|null} Sunrise time in hours (e.g., 6.5 = 6:30 AM)
   */
  getSunrise(zone) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    zone ??= WeatherManager.getActiveZone?.(null, game.scenes?.active);
    return calendar.sunrise(undefined, zone);
  },

  /**
   * Get the sunset time in hours for the current day.
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {number|null} Sunset time in hours (e.g., 18.5 = 6:30 PM)
   */
  getSunset(zone) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    zone ??= WeatherManager.getActiveZone?.(null, game.scenes?.active);
    return calendar.sunset(undefined, zone);
  },

  /**
   * Get the number of daylight hours for the current day.
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {number|null} Hours of daylight (e.g., 12.5)
   */
  getDaylightHours(zone) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    zone ??= WeatherManager.getActiveZone?.(null, game.scenes?.active);
    return calendar.daylightHours(undefined, zone);
  },

  /**
   * Get progress through the day period (0 = sunrise, 1 = sunset).
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {number|null} Progress value between 0-1
   */
  getProgressDay(zone) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    zone ??= WeatherManager.getActiveZone?.(null, game.scenes?.active);
    return calendar.progressDay(undefined, zone);
  },

  /**
   * Get progress through the night period (0 = sunset, 1 = sunrise).
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {number|null} Progress value between 0-1
   */
  getProgressNight(zone) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    zone ??= WeatherManager.getActiveZone?.(null, game.scenes?.active);
    return calendar.progressNight(undefined, zone);
  },

  /**
   * @param {number} targetHour - Target hour (0-hoursPerDay)
   * @returns {object|null} Time until target hour
   */
  getTimeUntilTarget(targetHour) {
    const components = game.time.components;
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = this.calendar?.days?.minutesPerHour ?? 60;
    const secondsPerMinute = this.calendar?.days?.secondsPerMinute ?? 60;
    const currentHour = components.hour + components.minute / minutesPerHour + components.second / (minutesPerHour * secondsPerMinute);
    const hoursUntil = currentHour < targetHour ? targetHour - currentHour : hoursPerDay - currentHour + targetHour;
    const hours = Math.floor(hoursUntil);
    const remainingMinutes = (hoursUntil - hours) * minutesPerHour;
    const minutes = Math.floor(remainingMinutes);
    const seconds = Math.floor((remainingMinutes - minutes) * secondsPerMinute);
    return { hours, minutes, seconds };
  },

  /** @returns {object|null} Time until sunrise */
  getTimeUntilSunrise() {
    const calendar = CalendarManager.getActiveCalendar();
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const targetHour = calendar?.sunrise?.(undefined, zone);
    return targetHour != null ? this.getTimeUntilTarget(targetHour) : null;
  },

  /** @returns {object|null} Time until sunset */
  getTimeUntilSunset() {
    const calendar = CalendarManager.getActiveCalendar();
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const targetHour = calendar?.sunset?.(undefined, zone);
    return targetHour != null ? this.getTimeUntilTarget(targetHour) : null;
  },

  /** @returns {object|null} Time until midnight */
  getTimeUntilMidnight() {
    return CalendarManager.getActiveCalendar() ? this.getTimeUntilTarget(0) : null;
  },

  /** @returns {object|null} Time until midday */
  getTimeUntilMidday() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    return this.getTimeUntilTarget(hoursPerDay / 2);
  },

  /**
   * Get the current weekday information including rest day status.
   * @returns {{index: number, name: string, abbreviation: string, isRestDay: boolean}|null}
   */
  getCurrentWeekday() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    const weekdayInfo = calendar.getWeekdayForDate?.();
    if (!weekdayInfo) return null;
    return { index: weekdayInfo.index, name: weekdayInfo.name || '', abbreviation: weekdayInfo.abbreviation || '', isRestDay: weekdayInfo.isRestDay || false };
  },

  /**
   * Check if the current day is a rest day.
   * @returns {boolean} True if current day is a rest day
   */
  isRestDay() {
    const weekday = this.getCurrentWeekday();
    return weekday?.isRestDay ?? false;
  },

  /**
   * Get the festival for the current date, if any.
   * @returns {object|null} Festival data with name, month, and day
   */
  getCurrentFestival() {
    return CalendarManager.getCurrentFestival();
  },

  /**
   * Check if the current date is a festival day.
   * @returns {boolean} True if current date is a festival
   */
  isFestivalDay() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return false;
    return calendar.isFestivalDay();
  },

  /**
   * Format date and time components as a string.
   * @param {object} [components] - Time components to format with month (1-indexed), day (1-indexed). Defaults to current time.
   * @param {string} [formatOrPreset] - Format string with tokens OR preset name (dateLong, dateFull, time24, etc.)
   * @returns {string} Formatted date/time string
   */
  formatDate(components = null, formatOrPreset = 'dateLong') {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return '';
    const raw = components || game.time.components;
    const formatted = {
      ...raw,
      year: components ? raw.year : raw.year + (calendar.years?.yearZero ?? 0),
      month: components ? (raw.month ?? 1) - 1 : raw.month,
      dayOfMonth: components ? (raw.day ?? 1) - 1 : (raw.dayOfMonth ?? 0)
    };
    delete formatted.day;
    if (PRESET_FORMATTERS[formatOrPreset]) return PRESET_FORMATTERS[formatOrPreset](calendar, formatted);
    const formatStr = resolveFormatString(formatOrPreset);
    return formatCustom(calendar, formatted, formatStr);
  },

  /**
   * Get relative time description between two dates.
   * @param {object} targetDate - Target date { year, month, dayOfMonth }
   * @param {object} [currentDate] - Current date (defaults to current time)
   * @returns {string} Relative time string (e.g., "3 days ago", "in 2 weeks")
   */
  timeSince(targetDate, currentDate = null) {
    currentDate = currentDate || game.time.components;
    return timeSince(toInternal(targetDate), currentDate);
  },

  /**
   * Get available format tokens and their descriptions.
   * @returns {Array<{token: string, descriptionKey: string, type: string}>}
   */
  getFormatTokens() {
    return getAvailableTokens();
  },

  /**
   * Get default format presets.
   * @returns {Object<string, string>}
   */
  getFormatPresets() {
    return { ...DEFAULT_FORMAT_PRESETS };
  },

  /**
   * Get all calendar notes.
   * @returns {object[]} Array of note stubs with id, name, flagData, etc.
   */
  getAllNotes() {
    return toPublicStubs(NoteManager.getAllNotes());
  },

  /**
   * Get a specific note by ID.
   * @param {string} pageId - The journal entry page ID
   * @returns {object|null} Note stub or null if not found
   */
  getNote(pageId) {
    return toPublicStub(NoteManager.getNote(pageId));
  },

  /**
   * Delete a specific calendar note.
   * @param {string} pageId - The journal entry page ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteNote(pageId) {
    return await NoteManager.deleteNote(pageId);
  },

  /**
   * Delete all calendar notes.
   * @returns {Promise<number>} Number of notes deleted
   */
  async deleteAllNotes() {
    return await NoteManager.deleteAllNotes();
  },

  /**
   * Search all content including notes and dates.
   * @param {string} term - Search term (minimum 2 characters)
   * @param {object} [options] - Search options
   * @param {boolean} [options.searchContent] - Search note content
   * @param {number} [options.limit] - Max results
   * @returns {object[]} Array of results with type field (e.g., 'note')
   */
  search(term, options = {}) {
    return SearchManager.search(term, options);
  },

  /**
   * Create a new calendar note.
   * @param {object} options - Note creation options
   * @param {string} options.name - Note title
   * @param {string} [options.content] - Note content (HTML)
   * @param {object} options.startDate - Start date {year, month (1-indexed), day (1-indexed), hour?, minute?}
   * @param {object} [options.endDate] - End date {year, month (1-indexed), day (1-indexed), hour?, minute?}
   * @param {boolean} [options.allDay] - Whether this is an all-day event
   * @param {object} [options.conditionTree] - Condition tree for recurrence scheduling
   * @param {string[]} [options.categories] - Preset IDs
   * @param {string} [options.icon] - Icon path or class
   * @param {string} [options.color] - Event color (hex)
   * @param {string} [options.visibility] - Visibility level: 'visible', 'hidden', 'secret' (default 'visible')
   * @param {string} [options.displayStyle] - Display style: 'icon', 'pip', 'banner' (default 'label')
   * @param {false|'edit'|'view'} [options.openSheet] - Open the note sheet after creation in the given mode, or false to skip (default 'edit')
   * @returns {Promise<object>} Created note page
   */
  async createNote({ name, content = '', startDate, endDate, allDay = true, conditionTree, categories = [], icon, color, visibility = 'visible', displayStyle, openSheet = 'edit' }) {
    if (!canAddNotes()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    const noteData = {
      startDate: { year: startDate.year, month: (startDate.month ?? 1) - 1, dayOfMonth: (startDate.day ?? 1) - 1, hour: startDate.hour ?? 0, minute: startDate.minute ?? 0 },
      endDate: endDate ? { year: endDate.year, month: (endDate.month ?? 1) - 1, dayOfMonth: (endDate.day ?? 1) - 1, hour: endDate.hour ?? 23, minute: endDate.minute ?? 59 } : null,
      allDay,
      conditionTree: conditionTree ?? null,
      categories,
      icon: icon || 'fas fa-calendar-day',
      color: color || '#4a90e2',
      visibility,
      displayStyle: displayStyle || DISPLAY_STYLES.ICON
    };
    return await NoteManager.createNote({ name, content, noteData, openSheet });
  },

  /**
   * Update an existing calendar note.
   * @param {string} pageId - Journal entry page ID
   * @param {object} updates - Updates to apply
   * @param {string} [updates.name] - New name
   * @param {object} [updates.startDate] - New start date
   * @param {object} [updates.endDate] - New end date
   * @param {boolean} [updates.allDay] - New all-day setting
   * @param {object} [updates.conditionTree] - New condition tree for recurrence
   * @param {string[]} [updates.categories] - New preset IDs
   * @param {string} [updates.displayStyle] - New display style: 'icon', 'pip', 'banner'
   * @returns {Promise<object>} Updated note page
   */
  async updateNote(pageId, updates) {
    if (!canEditNotes()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    const noteData = {};
    if (updates.startDate) noteData.startDate = { ...updates.startDate };
    if (updates.endDate) noteData.endDate = { ...updates.endDate };
    if (updates.allDay !== undefined) noteData.allDay = updates.allDay;
    if (updates.conditionTree !== undefined) noteData.conditionTree = updates.conditionTree;
    if (updates.categories !== undefined) noteData.categories = updates.categories;
    if (updates.icon !== undefined) noteData.icon = updates.icon;
    if (updates.color !== undefined) noteData.color = updates.color;
    if (updates.visibility !== undefined) noteData.visibility = updates.visibility;
    if (updates.displayStyle !== undefined) noteData.displayStyle = updates.displayStyle;
    return await NoteManager.updateNote(pageId, { name: updates.name, noteData: Object.keys(noteData).length > 0 ? noteData : undefined });
  },

  /**
   * Open a note in the UI.
   * @param {string} pageId - Journal entry page ID
   * @param {object} [options] - Render options
   * @param {string} [options.mode] - 'view' or 'edit'
   * @returns {Promise<void>}
   */
  async openNote(pageId, options = {}) {
    const page = NoteManager.getFullNote(pageId);
    if (!page) {
      ui.notifications.warn('CALENDARIA.Error.NoteNotFound', { localize: true });
      return;
    }
    page.sheet.render(true, { mode: options.mode ?? 'view' });
  },

  /**
   * Navigate to a note's date in a calendar view and open it.
   * @param {string} pageId - Journal entry page ID
   * @param {object} [options] - Options
   * @param {string} [options.mode] - Sheet mode: 'view' (default) or 'edit'
   * @param {string} [options.context] - Force target: 'bigcal' or 'minical' (auto-detects if omitted)
   * @returns {Promise<void>}
   */
  async navigateToNote(pageId, options = {}) {
    const stub = NoteManager.getNote(pageId);
    if (!stub) {
      ui.notifications.warn('CALENDARIA.Error.NoteNotFound', { localize: true });
      return;
    }
    const startDate = stub.flagData.startDate;
    if (!startDate) return;
    const dateObj = { year: startDate.year, month: startDate.month, dayOfMonth: startDate.dayOfMonth ?? 0 };
    const useMiniCal = options.context === 'minical' || (options.context !== 'bigcal' && MiniCal.instance?.rendered && !BigCal.instance?.rendered);
    if (useMiniCal) {
      const mini = MiniCal.show();
      if (mini) {
        mini.selectDate(dateObj);
        await mini.render({ force: true });
      }
    } else {
      const instance = BigCal.show();
      instance.selectDate(dateObj);
      await instance.render({ force: true });
    }
    const page = NoteManager.getFullNote(pageId);
    if (page) page.sheet.render(true, { mode: options.mode ?? 'view' });
  },

  /**
   * Navigate a calendar view to a specific date.
   * Prefers MiniCal if rendered, otherwise opens BigCal.
   * @param {number} year - Year (display year, 1-indexed)
   * @param {number} month - Month (1-indexed)
   * @param {number} day - Day (1-indexed)
   * @returns {Promise<void>}
   */
  async navigateToDate(year, month, day) {
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const dateObj = { year: year - yearZero, month: month - 1, dayOfMonth: day - 1 };
    const pref = game.settings.get(MODULE.ID, SETTINGS.ENRICHER_CLICK_TARGET);
    const useMiniCal = pref === 'minical' || (pref === 'auto' && MiniCal.instance?.rendered && !BigCal.instance?.rendered);
    if (useMiniCal) {
      const mini = MiniCal.show();
      if (mini) {
        mini.selectDate(dateObj);
        await mini.render({ force: true });
      }
    } else {
      const instance = BigCal.show();
      instance.selectDate(dateObj);
      await instance.render({ force: true });
    }
  },

  /**
   * Get all notes for a specific date.
   * @param {number} year - Year (display year, not internal)
   * @param {number} month - Month (1-indexed)
   * @param {number} day - Day of month (1-indexed)
   * @param {object} [options] - Query options
   * @param {boolean} [options.includeContent] - Include note HTML content in results (default: false)
   * @param {boolean} [options.includeOccurrences] - Enrich each stub with `nextOccurrence` and `occurrenceCount` (default: false)
   * @returns {object[]} Array of note stubs, optionally enriched with occurrence data
   */
  getNotesForDate(year, month, day, options = {}) {
    const stubs = NoteManager.getNotesForDate(year, month - 1, day - 1);
    let result = options.includeContent ? stubs : stripContent(stubs);
    if (options.includeOccurrences) result = enrichWithOccurrences(result);
    return toPublicStubs(result);
  },

  /**
   * Get all notes for a specific month.
   * @param {number} year - Year (display year)
   * @param {number} month - Month (1-indexed)
   * @param {object} [options] - Query options
   * @param {boolean} [options.includeContent] - Include note HTML content in results (default: false)
   * @param {boolean} [options.includeOccurrences] - Enrich each stub with `nextOccurrence` and `occurrenceCount` (default: false)
   * @returns {object[]} Array of note stubs, optionally enriched with occurrence data
   */
  getNotesForMonth(year, month, options = {}) {
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    const internalMonth = month - 1;
    const daysInMonth = calendar?.getDaysInMonth(internalMonth, year - yearZero) ?? 30;
    const stubs = NoteManager.getNotesInRange({ year, month: internalMonth, dayOfMonth: 0 }, { year, month: internalMonth, dayOfMonth: daysInMonth - 1 });
    let result = options.includeContent ? stubs : stripContent(stubs);
    if (options.includeOccurrences) result = enrichWithOccurrences(result);
    return toPublicStubs(result);
  },

  /**
   * Get all notes within a date range.
   * @param {object} startDate - Start date {year, month (1-indexed), day (1-indexed)}
   * @param {object} endDate - End date {year, month (1-indexed), day (1-indexed)}
   * @param {object} [options] - Query options
   * @param {boolean} [options.includeContent] - Include note HTML content in results (default: false)
   * @param {boolean} [options.includeOccurrences] - Enrich each stub with `nextOccurrence` and `occurrenceCount` (default: false)
   * @param {number} [options.maxOccurrences] - Max occurrences to count per note when includeOccurrences is true (default: 100)
   * @returns {object[]} Array of note stubs, optionally enriched with occurrence data
   */
  getNotesInRange(startDate, endDate, options = {}) {
    const internalStart = { ...startDate, month: startDate.month - 1, dayOfMonth: (startDate.day ?? 1) - 1 };
    const internalEnd = { ...endDate, month: endDate.month - 1, dayOfMonth: (endDate.day ?? 1) - 1 };
    const stubs = NoteManager.getNotesInRange(internalStart, internalEnd);
    let result = options.includeContent ? stubs : stripContent(stubs);
    if (options.includeOccurrences) result = enrichWithOccurrences(result, internalStart, internalEnd, options.maxOccurrences);
    return toPublicStubs(result);
  },

  /**
   * Search notes only, with simple filtering options.
   * @param {string} searchTerm - Text to search for
   * @param {object} [options] - Search options
   * @param {boolean} [options.caseSensitive] - Case-sensitive search (default: false)
   * @param {string[]} [options.categories] - Filter by preset IDs
   * @returns {object[]} Array of note stubs (id, name, content, flagData)
   */
  searchNotes(searchTerm, options = {}) {
    const allNotes = NoteManager.getAllNotes();
    const term = options.caseSensitive ? searchTerm : searchTerm.toLowerCase();
    const filtered = allNotes.filter((note) => {
      if (options.categories?.length > 0) {
        const noteCategories = note.flagData?.categories ?? [];
        if (!options.categories.some((cat) => noteCategories.includes(cat))) return false;
      }
      const name = options.caseSensitive ? note.name : note.name.toLowerCase();
      if (name.includes(term)) return true;
      if (note.content) {
        const content = options.caseSensitive ? note.content : note.content.toLowerCase();
        if (content.includes(term)) return true;
      }
      return false;
    });
    return toPublicStubs(filtered);
  },

  /**
   * Get notes by preset.
   * @param {string} presetId - Preset ID
   * @returns {object[]} Array of note stubs
   */
  getNotesByPreset(presetId) {
    return toPublicStubs(NoteManager.getNotesByPreset(presetId));
  },

  /**
   * Get all preset definitions.
   * @returns {object[]} Array of preset definitions
   */
  getPresets() {
    return NoteManager.getPresetDefinitions();
  },

  /**
   * Add a custom note preset.
   * @param {object} options - Preset options
   * @param {string} options.label - Display name
   * @param {string} [options.color] - Hex color (default '#868e96')
   * @param {string} [options.icon] - FontAwesome icon class (default 'fas fa-tag')
   * @param {object} [options.defaults] - Default values: { allDay, displayStyle, visibility, reminderType, reminderOffset, hasDuration, duration, macro, content }
   * @returns {Promise<object>} The created preset
   */
  async addPreset({ label, color, icon, defaults } = {}) {
    if (!label) throw new Error('Preset label is required');
    const preset = await addCustomPreset(label, color, icon);
    if (defaults && Object.keys(defaults).length) await updatePreset(preset.id, { defaults });
    return preset;
  },

  /**
   * Update a note preset.
   * @param {string} presetId - Preset ID
   * @param {object} updates - Properties to update
   * @param {string} [updates.label] - New display name
   * @param {string} [updates.color] - New hex color
   * @param {string} [updates.icon] - New FontAwesome icon class
   * @param {boolean} [updates.playerUsable] - Allow non-GM users
   * @param {object} [updates.defaults] - Updated default values, merged with existing (includes content template)
   * @param {object} [updates.overrides] - Updated override values (merged with existing)
   * @returns {Promise<object|null>} Updated preset or null if not found
   */
  async updatePreset(presetId, updates) {
    return updatePreset(presetId, updates);
  },

  /**
   * Delete a custom note preset.
   * @param {string} presetId - Preset ID to delete
   * @returns {Promise<boolean>} True if deleted
   */
  async deletePreset(presetId) {
    return deleteCustomPreset(presetId);
  },

  /**
   * Show the BigCal application.
   * @returns {BigCal} The BigCal instance
   */
  showBigCal() {
    return BigCal.show();
  },

  /** Hide the BigCal application. */
  hideBigCal() {
    BigCal.hide();
  },

  /** Toggle BigCal visibility. */
  toggleBigCal() {
    BigCal.toggle();
  },

  /**
   * Show the Chronicle chronicle view.
   * @param {object} [options] - Options
   * @param {object} [options.startDate] - Start date { year, month (0-indexed), dayOfMonth (0-indexed) }
   * @param {object} [options.endDate] - End date
   * @param {string} [options.calendarId] - Calendar ID
   * @param {string} [options.theme] - Theme: parchment, logbook, arcane, modern
   * @returns {Chronicle} The instance
   */
  showChronicle(options = {}) {
    return Chronicle.show(options);
  },

  /** Hide the Chronicle. */
  hideChronicle() {
    Chronicle.hide();
  },

  /** Toggle Chronicle visibility. */
  toggleChronicle() {
    Chronicle.toggle();
  },

  /**
   * Show the Note Viewer.
   * @param {object} [options] - Pre-filter options
   * @param {object} [options.date] - Pre-filter to date { year, month (1-indexed), day (1-indexed) }
   * @param {string} [options.preset] - Pre-filter to preset ID
   * @param {string} [options.search] - Pre-filter with search term
   * @param {string} [options.visibility] - Pre-filter to visibility level
   * @returns {NoteViewer} The instance
   */
  showNoteViewer(options = {}) {
    return NoteViewer.show(options);
  },

  /** Hide the Note Viewer. */
  hideNoteViewer() {
    NoteViewer.hide();
  },

  /** Toggle Note Viewer visibility. */
  toggleNoteViewer() {
    NoteViewer.toggle();
  },

  /**
   * Show a date picker dialog.
   * @param {object} [options] - Picker options
   * @param {object} [options.date] - Initial date {year, month (1-indexed), day (1-indexed)} (defaults to current date)
   * @param {boolean} [options.showTime] - Show time inputs (default: false)
   * @param {string} [options.title] - Custom dialog title
   * @param {object} [options.position] - Dialog position {x, y} in pixels
   * @param {Function} [options.onSelect] - Callback fired with the selected date (alongside the Promise return)
   * @returns {Promise<object|null>} Selected date {year, month (1-indexed), day (1-indexed), hour?, minute?} or null if cancelled
   */
  async showDatePicker(options = {}) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    const yearZero = calendar.years?.yearZero ?? 0;
    const current = options.date ?? this.getCurrentDateTime();
    const currentYear = current.year - yearZero;
    const currentMonth = (current.month ?? 1) - 1;
    const currentDay = current.day ?? 1;
    const currentHour = current.hour ?? 12;
    const currentMinute = current.minute ?? 0;
    const isMonthless = calendar.isMonthless ?? false;
    const maxDays = isMonthless ? (calendar.getDaysInYear?.(currentYear) ?? 365) : (calendar.getDaysInMonth?.(currentMonth, currentYear) ?? 30);
    const showTime = options.showTime ?? false;
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.PARTIALS.DATE_PICKER, {
      formClass: '',
      year: current.year,
      isMonthless,
      months: isMonthless ? [] : calendar.monthsArray.map((m, i) => ({ index: i, name: game.i18n.localize(m.name), selected: i === currentMonth })),
      days: Array.from({ length: maxDays }, (_, i) => i + 1),
      currentDay,
      showTime,
      currentHour,
      currentMinute,
      maxHour: hoursPerDay - 1,
      maxMinute: minutesPerHour - 1
    });
    const dialogOptions = {
      window: { title: options.title ?? game.i18n.localize('CALENDARIA.Note.SelectDateTitle') },
      content,
      ok: {
        callback: (_event, button) => {
          const month = isMonthless ? 0 : parseInt(button.form.elements.month?.value ?? 0);
          const selected = { year: parseInt(button.form.elements.year.value), month: month + 1, day: parseInt(button.form.elements.day.value) };
          if (showTime) {
            const currentMaxHour = (calendar.days?.hoursPerDay ?? 24) - 1;
            const currentMaxMinute = (calendar.days?.minutesPerHour ?? 60) - 1;
            selected.hour = Math.min(parseInt(button.form.elements.hour?.value ?? 0), currentMaxHour);
            selected.minute = Math.min(parseInt(button.form.elements.minute?.value ?? 0), currentMaxMinute);
          }
          return selected;
        }
      },
      render: (_event, dialog) => {
        if (isMonthless) return;
        const html = dialog.element;
        const monthSelect = html.querySelector('#month-select');
        const daySelect = html.querySelector('#day-select');
        if (!monthSelect || !daySelect) return;
        monthSelect.addEventListener('change', () => {
          const selectedMonth = parseInt(monthSelect.value);
          const daysInSelectedMonth = calendar.monthsArray[selectedMonth]?.days || 30;
          daySelect.innerHTML = Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1)
            .map((d) => `<option value="${d}">${d}</option>`)
            .join('');
        });
      },
      rejectClose: false
    };
    if (options.position) dialogOptions.position = { left: options.position.x, top: options.position.y };
    const result = await foundry.applications.api.DialogV2.prompt(dialogOptions);
    const selected = result ?? null;
    if (selected && typeof options.onSelect === 'function') options.onSelect(selected);
    return selected;
  },

  /**
   * Show the MiniCal widget.
   * @returns {MiniCal} The MiniCal instance
   */
  showMiniCal() {
    return MiniCal.show();
  },

  /** Hide the MiniCal widget. */
  hideMiniCal() {
    MiniCal.hide();
  },

  /** Toggle MiniCal visibility. */
  toggleMiniCal() {
    MiniCal.toggle();
  },

  /**
   * Open a secondary calendar viewer for a non-active calendar.
   * The viewer stays synced with worldTime and displays the calendar's own date representation.
   * @param {string} calendarId - Calendar ID to display
   * @returns {SecondaryCalendar} The viewer instance
   */
  showSecondaryCalendar(calendarId) {
    return SecondaryCalendar.open(calendarId);
  },

  /**
   * Show the HUD.
   * @returns {HUD|null} The HUD instance, or null if blocked by combat
   */
  showHUD() {
    return HUD.show();
  },

  /** Hide the HUD. */
  hideHUD() {
    HUD.hide();
  },

  /** Toggle HUD visibility. */
  toggleHUD() {
    HUD.toggle();
  },

  /**
   * Show the TimeKeeper.
   * @returns {TimeKeeper} The TimeKeeper instance
   */
  showTimeKeeper() {
    return TimeKeeper.show();
  },

  /** Hide the TimeKeeper. */
  hideTimeKeeper() {
    TimeKeeper.hide();
  },

  /** Toggle TimeKeeper visibility. */
  toggleTimeKeeper() {
    TimeKeeper.toggle();
  },

  /**
   * Show the Sun Dial.
   * @param {object} [options] - Show options
   * @param {boolean} [options.closeOnClickOutside] - If true, close when clicking outside the dial
   * @returns {SunDial} The Sun Dial instance
   */
  showSunDial(options = {}) {
    return SunDial.show(options);
  },

  /** Hide the Sun Dial. */
  hideSunDial() {
    SunDial.hide();
  },

  /** Toggle Sun Dial visibility. */
  toggleSunDial() {
    SunDial.toggle();
  },

  /**
   * Show the Stopwatch.
   * @returns {Stopwatch} The Stopwatch instance
   */
  showStopwatch() {
    return Stopwatch.show();
  },

  /** Hide the Stopwatch. */
  hideStopwatch() {
    Stopwatch.hide();
  },

  /** Toggle Stopwatch visibility. */
  toggleStopwatch() {
    Stopwatch.toggle();
  },

  /** Show and start the Stopwatch. */
  startStopwatch() {
    Stopwatch.start();
  },

  /** Pause the running Stopwatch. */
  pauseStopwatch() {
    Stopwatch.pause();
  },

  /** Reset the Stopwatch to zero. */
  resetStopwatch() {
    Stopwatch.reset();
  },

  /**
   * Open the calendar editor for creating/editing custom calendars.
   * @param {string} [calendarId] - Calendar ID to edit (omit for new calendar)
   * @returns {Promise<object>} The editor application
   */
  async openCalendarEditor(calendarId) {
    if (!canEditCalendars()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    const app = new CalendarEditor({ calendarId });
    return app.render(true);
  },

  /**
   * Convert a timestamp (world time in seconds) to date components.
   * @param {number} timestamp - World time in seconds
   * @returns {object} Date components {year, month (1-indexed), day (1-indexed), hour, minute}
   */
  timestampToDate(timestamp) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return null;
    const components = calendar.timeToComponents(timestamp);
    const yearZero = calendar.years?.yearZero ?? 0;
    const months = calendar.monthsArray;
    const monthData = months[components.month];
    return {
      year: components.year + yearZero,
      month: components.month + 1,
      ordinal: monthData?.ordinal ?? components.month + 1,
      monthName: monthData?.name ?? '',
      intercalary: monthData?.type === 'intercalary',
      day: components.dayOfMonth + 1,
      hour: components.hour,
      minute: components.minute
    };
  },

  /**
   * Convert date components to a timestamp (world time in seconds).
   * @param {object} date - Date components {year, month (1-indexed), day (1-indexed), hour?, minute?, second?}
   * @returns {number} World time in seconds
   */
  dateToTimestamp(date) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return 0;
    const yearZero = calendar.years?.yearZero ?? 0;
    const year = date.year - yearZero;
    let month;
    if (date.month != null) {
      month = date.month - 1;
    } else if (date.ordinal != null) {
      const months = calendar.monthsArray;
      const nonIntercalary = months.findIndex((m) => m.ordinal === date.ordinal && m.type !== 'intercalary');
      const idx = nonIntercalary >= 0 ? nonIntercalary : months.findIndex((m) => m.ordinal === date.ordinal);
      month = idx >= 0 ? idx : 0;
    } else {
      month = 0;
    }
    const dayOfMonth = (date.day ?? 1) - 1;
    return calendar.componentsToTime({ year, month, dayOfMonth, hour: date.hour ?? 0, minute: date.minute ?? 0, second: date.second ?? 0 });
  },

  /**
   * Generate a random date within a range.
   * @param {object} [startDate] - Start date (defaults to current date)
   * @param {object} [endDate] - End date (defaults to 1 year from start)
   * @returns {object} Random date components
   */
  chooseRandomDate(startDate, endDate) {
    const current = this.getCurrentDateTime();
    if (!startDate) startDate = { year: current.year, month: current.month, day: current.day };
    if (!endDate) endDate = { year: startDate.year + 1, month: startDate.month, day: startDate.day };
    const startTimestamp = this.dateToTimestamp(startDate);
    const endTimestamp = this.dateToTimestamp(endDate);
    const randomTimestamp = startTimestamp + Math.floor(Math.random() * (endTimestamp - startTimestamp));
    return this.timestampToDate(randomTimestamp);
  },

  /**
   * Check if it's currently daytime.
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {boolean} True if between sunrise and sunset
   */
  isDaytime(zone) {
    const sunrise = this.getSunrise(zone);
    const sunset = this.getSunset(zone);
    if (sunrise === null || sunset === null) return true;
    const components = game.time.components;
    const minutesPerHour = this.calendar?.days?.minutesPerHour ?? 60;
    const currentHour = components.hour + components.minute / minutesPerHour;
    return currentHour >= sunrise && currentHour < sunset;
  },

  /**
   * Check if it's currently nighttime.
   * @param {object} [zone] - Optional climate zone override. Defaults to active scene zone.
   * @returns {boolean} True if before sunrise or after sunset
   */
  isNighttime(zone) {
    return !this.isDaytime(zone);
  },

  /**
   * Advance time to the next occurrence of a preset time.
   * @param {string} preset - Time preset: 'sunrise', 'midday', 'sunset', 'midnight'
   * @returns {Promise<number>} New world time
   */
  async advanceTimeToPreset(preset) {
    if (!canChangeDateTime()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return game.time.worldTime;
    }
    const components = game.time.components;
    const hoursPerDay = this.calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = this.calendar?.days?.minutesPerHour ?? 60;
    const secondsPerMinute = this.calendar?.days?.secondsPerMinute ?? 60;
    const secondsPerHour = minutesPerHour * secondsPerMinute;
    const currentHour = components.hour + components.minute / minutesPerHour + components.second / secondsPerHour;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    let targetHour;
    switch (preset.toLowerCase()) {
      case 'sunrise':
        targetHour = this.getSunrise(zone) ?? hoursPerDay / 4;
        break;
      case 'midday':
      case 'noon':
        targetHour = hoursPerDay / 2;
        break;
      case 'sunset':
        targetHour = this.getSunset(zone) ?? (hoursPerDay * 3) / 4;
        break;
      case 'midnight':
        targetHour = 0;
        break;
      default:
        log(2, `Unknown preset: ${preset}`);
        return game.time.worldTime;
    }
    let hoursUntil = targetHour - currentHour;
    if (hoursUntil <= 0) hoursUntil += hoursPerDay;
    const secondsUntil = Math.floor(hoursUntil * secondsPerHour);
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: secondsUntil });
      return game.time.worldTime;
    }
    await CinematicOverlay.gatedAdvance(secondsUntil);
    return game.time.worldTime;
  },

  /**
   * Check if the real-time clock is currently running.
   * @returns {boolean} True if the clock is running
   */
  isClockRunning() {
    return TimeClock.running;
  },

  /**
   * Start the real-time clock.
   */
  startClock() {
    TimeClock.start();
  },

  /**
   * Stop the real-time clock.
   */
  stopClock() {
    TimeClock.stop();
  },

  /**
   * Toggle the real-time clock on/off.
   */
  toggleClock() {
    TimeClock.toggle();
  },

  /**
   * Get the current real-time clock speed (game seconds per real second).
   * @returns {number} Clock speed multiplier
   */
  getClockSpeed() {
    return TimeClock.realTimeSpeed;
  },

  /**
   * Check if the current user is the primary GM.
   * @returns {boolean} True if current user is primary GM
   */
  isPrimaryGM() {
    return CalendariaSocket.isPrimaryGM();
  },

  /**
   * Check if the current user can modify time.
   * @returns {boolean} True if user can advance/set time
   */
  canModifyTime() {
    return canChangeDateTime();
  },

  /**
   * Check if the current user can create/edit notes.
   * @returns {boolean} True if user can manage notes
   */
  canManageNotes() {
    return canAddNotes();
  },

  /**
   * Get the current weather.
   * @param {string} [zoneId] - Zone ID (resolves from active scene if omitted)
   * @returns {object|null} Current weather state with id, label, icon, color, temperature
   */
  getCurrentWeather(zoneId) {
    return WeatherManager.getCurrentWeather(zoneId);
  },

  /**
   * Get the current intraday weather period.
   * Returns 'night', 'morning', 'afternoon', or 'evening' based on the world clock.
   * @returns {string} Current period ID
   */
  getCurrentWeatherPeriod() {
    return WeatherManager.getCurrentPeriod();
  },

  /**
   * Get weather for a specific intraday period from the current day.
   * @param {string} periodName - Period ID: 'night', 'morning', 'afternoon', or 'evening'
   * @param {string} [zoneId] - Zone ID (resolves from active scene if omitted)
   * @returns {object|null} Weather data for the requested period, or null if intraday is disabled
   */
  getWeatherForPeriod(periodName, zoneId) {
    const weather = WeatherManager.getCurrentWeather(zoneId);
    if (!weather?.periods) return null;
    return weather.periods[periodName] ?? null;
  },

  /**
   * Set the current weather by preset ID.
   * @param {string} presetId - Weather preset ID (e.g., 'clear', 'rain', 'thunderstorm')
   * @param {object} [options] - Additional options
   * @param {number} [options.temperature] - Optional temperature value
   * @param {string} [options.period] - Specific period to set when intraday is enabled
   * @param {boolean} [options.allPeriods] - Set all periods to this weather when intraday is enabled
   * @returns {Promise<object>} The set weather
   */
  async setWeather(presetId, options = {}) {
    return WeatherManager.setWeather(presetId, options);
  },

  /**
   * Set custom weather with arbitrary values.
   * @param {object} weatherData - Weather data
   * @param {string} weatherData.label - Display label
   * @param {string} [weatherData.icon] - Font Awesome icon class
   * @param {string} [weatherData.color] - Display color
   * @param {string} [weatherData.description] - Description text
   * @param {number} [weatherData.temperature] - Temperature value
   * @returns {Promise<object>} The set weather
   */
  async setCustomWeather(weatherData) {
    return WeatherManager.setCustomWeather(weatherData);
  },

  /**
   * Clear the current weather.
   * @returns {Promise<void>}
   */
  async clearWeather() {
    return WeatherManager.clearWeather();
  },

  /**
   * Clear weather history entries and optionally the forecast plan.
   * @param {object} [options] - Clear options
   * @param {boolean} [options.future] - Only clear entries after the current date
   * @param {boolean} [options.all] - Clear all history
   * @param {number} [options.year] - Clear entries for a specific year (1-indexed display year)
   * @param {number} [options.month] - Clear entries for a specific month (1-indexed, requires year)
   * @param {boolean} [options.clearForecast] - Also clear the forecast plan (default: true)
   * @returns {Promise<number>} Number of entries removed
   */
  async clearWeatherHistory(options = {}) {
    const converted = { ...options };
    if (converted.month != null) converted.month = converted.month - 1;
    return WeatherManager.clearWeatherHistory(converted);
  },

  /**
   * Generate and set weather based on current climate and season.
   * @param {object} [options] - Generation options
   * @param {string} [options.climate] - Climate override (uses setting if not provided)
   * @param {string} [options.season] - Season override (uses current if not provided)
   * @returns {Promise<object>} Generated weather
   */
  async generateWeather(options = {}) {
    return WeatherManager.generateAndSetWeather(options);
  },

  /**
   * Get a weather forecast for upcoming days.
   * @param {object} [options] - Forecast options
   * @param {number} [options.days] - Number of days to forecast
   * @param {string} [options.zoneId] - Zone ID override
   * @param {number} [options.accuracy] - Accuracy override (GM only)
   * @returns {object[]} Array of forecast entries with `isVaried` flag
   */
  getWeatherForecast(options = {}) {
    if (!game.user.isGM && !canViewWeatherForecast()) {
      ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return [];
    }
    const accuracy = game.user.isGM ? (options.accuracy ?? 100) : undefined;
    return WeatherManager.getForecast({ ...options, accuracy });
  },

  /**
   * Get historical weather for a specific date.
   * @param {number} year - Display year
   * @param {number} month - Month (1-indexed)
   * @param {number} day - Day of month (1-indexed)
   * @param {string} [zoneId] - Zone ID (resolves from active scene if omitted)
   * @returns {object|null} Historical weather entry or null
   */
  getWeatherForDate(year, month, day, zoneId) {
    return WeatherManager.getWeatherForDate(year, month - 1, day - 1, zoneId);
  },

  /**
   * Get weather history as the raw nested object, or a flat array for a specific year/month.
   * @param {object} [options] - Filter options
   * @param {number} [options.year] - Filter to a specific year
   * @param {number} [options.month] - Filter to a specific month (1-indexed, requires year)
   * @returns {object|object[]} Nested history object, or array of { year, month, day, ...entry }
   */
  getWeatherHistory(options = {}) {
    const converted = { ...options };
    if (converted.month != null) converted.month = converted.month - 1;
    return WeatherManager.getWeatherHistory(converted);
  },

  /**
   * Get the active climate zone.
   * @returns {object|null} Active zone config
   */
  getActiveZone() {
    return WeatherManager.getActiveZone();
  },

  /**
   * Set the active climate zone.
   * @param {string} zoneId - Climate zone ID
   * @returns {Promise<void>}
   */
  async setActiveZone(zoneId) {
    return WeatherManager.setActiveZone(zoneId);
  },

  /**
   * Get all available weather presets.
   * @returns {Promise<object[]>} Array of weather presets
   */
  async getWeatherPresets() {
    return WeatherManager.getAllPresets();
  },

  /**
   * Get all climate zones for the active calendar.
   * @returns {object[]} Array of zone configs
   */
  getCalendarZones() {
    return WeatherManager.getCalendarZones();
  },

  /**
   * Add a custom weather preset.
   * @param {object} preset - Preset definition
   * @param {string} preset.id - Unique ID
   * @param {string} preset.label - Display label
   * @param {string} [preset.icon] - Icon class
   * @param {string} [preset.color] - Display color
   * @param {string} [preset.description] - Description
   * @returns {Promise<object>} The added preset
   */
  async addWeatherPreset(preset) {
    return WeatherManager.addCustomPreset(preset);
  },

  /**
   * Remove a custom weather preset.
   * @param {string} presetId - Preset ID to remove
   * @returns {Promise<boolean>} True if removed
   */
  async removeWeatherPreset(presetId) {
    return WeatherManager.removeCustomPreset(presetId);
  },

  /**
   * Get the current temperature for a zone.
   * @param {string} [zoneId] - Zone ID (resolves from active scene if omitted)
   * @returns {object|null} Temperature data with celsius, display value, and unit
   */
  getTemperature(zoneId) {
    return WeatherManager.getTemperature(zoneId);
  },

  /**
   * Get a specific weather preset by ID.
   * @param {string} presetId - Preset ID (e.g., 'clear', 'rain', 'thunderstorm')
   * @returns {object|null} Preset definition or null if not found
   */
  getPreset(presetId) {
    return WeatherManager.getPreset(presetId);
  },

  /**
   * Update an existing custom weather preset.
   * @param {string} presetId - Preset ID to update
   * @param {object} updates - Properties to update (label, icon, color, etc.)
   * @returns {Promise<object|null>} Updated preset or null if not found
   */
  async updateWeatherPreset(presetId, updates) {
    return WeatherManager.updateCustomPreset(presetId, updates);
  },

  /**
   * Format a temperature value for display using the world's temperature unit setting.
   * @param {number} celsius - Temperature in Celsius
   * @returns {string} Formatted temperature string (e.g., "72°F" or "22°C")
   */
  formatTemperature(celsius) {
    return WeatherManager.formatTemperature(celsius);
  },

  /**
   * Get available climate zone templates for creating new zones.
   * @returns {object[]} Array of climate zone template objects
   */
  getClimateZoneTemplates() {
    return WeatherManager.getClimateZoneTemplates();
  },

  /**
   * Check if a calendar is a bundled (built-in) calendar.
   * @param {string} calendarId - Calendar ID to check
   * @returns {boolean} True if bundled calendar
   */
  isBundledCalendar(calendarId) {
    return isBundledCalendar(calendarId);
  },

  /**
   * Get the weather probability breakdown for a zone and season.
   * @param {object} [options] - Options
   * @param {string} [options.zoneId] - Zone ID (defaults to active zone)
   * @param {string} [options.season] - Season name (defaults to current season)
   * @returns {object} { zone, season, entries, tempRange }
   */
  getWeatherProbabilities(options = {}) {
    return WeatherManager.getWeatherProbabilities(options);
  },

  /**
   * Open the Weather Probability dialog.
   * @param {object} [options] - Options
   * @param {string} [options.zoneId] - Initial zone ID
   * @param {string} [options.season] - Initial season name
   * @returns {object} The dialog instance
   */
  openWeatherProbabilities(options = {}) {
    return WeatherProbabilityDialog.open(options);
  },

  /**
   * Play a weather sound from any Foundry audio path.
   * Replaces any currently playing weather sound with crossfade.
   * The sound will be overwritten on the next automatic weather change.
   * @param {string} src - Foundry audio path (e.g., "modules/my-mod/sounds/rain.ogg")
   * @param {object} [options] - Playback options
   * @param {number} [options.volume] - Volume (0-1, defaults to Weather Sound Volume setting)
   * @param {number} [options.fade] - Fade-in duration in ms (default: 2000)
   * @param {boolean} [options.loop] - Loop playback (default: true)
   * @param {object} [options.context] - Audio context override (default: game.audio.environment)
   * @returns {Promise<boolean>} True if playback started successfully
   */
  async playWeatherSound(src, options = {}) {
    return playStandaloneSound(src, options);
  },

  /**
   * Stop the currently playing weather sound with fade-out.
   * @param {object} [options] - Stop options
   * @param {number} [options.fade] - Fade-out duration in ms (default: 2000)
   * @returns {Promise<boolean>} True if a sound was stopped
   */
  async stopWeatherSound(options = {}) {
    return stopStandaloneSound(options);
  },

  /**
   * Play an FXMaster weather preset with custom options.
   * Uses exclusive mode (stops other presets). The effect will be overwritten
   * on the next automatic weather change. Requires FXMaster module.
   * @param {string} presetName - FXMaster preset name (e.g., "rain", "snow", "fog")
   * @param {object} [options] - FXMaster preset options
   * @param {string} [options.density] - Particle density
   * @param {string} [options.speed] - Particle speed
   * @param {string} [options.color] - Tint color
   * @param {string} [options.direction] - Cardinal direction (n, ne, e, se, s, sw, w, nw)
   * @param {boolean} [options.topDown] - Top-down particle view
   * @param {boolean} [options.belowTokens] - Render below token layer
   * @returns {Promise<boolean>} True if FX started successfully
   */
  async playWeatherFX(presetName, options = {}) {
    return playStandaloneFX(presetName, options);
  },

  /**
   * Stop all active FXMaster weather effects. Requires FXMaster module.
   * @returns {Promise<boolean>} True if effects were stopped
   */
  async stopWeatherFX() {
    return stopAllFX();
  },

  /**
   * Get all available Calendaria hook names.
   * @returns {object} Object containing all hook name constants
   */
  get hooks() {
    return { ...HOOKS };
  },

  /**
   * Add days to a date.
   * @param {object} date - Starting date {year, month, day, hour?, minute?}
   * @param {number} days - Days to add (can be negative)
   * @returns {object} New date object
   */
  addDays(date, days) {
    return toPublic(addDays(toInternal(date), days));
  },

  /**
   * Add months to a date.
   * @param {object} date - Starting date {year, month, day, hour?, minute?}
   * @param {number} months - Months to add (can be negative)
   * @returns {object} New date object
   */
  addMonths(date, months) {
    return toPublic(addMonths(toInternal(date), months));
  },

  /**
   * Add years to a date.
   * @param {object} date - Starting date {year, month, day, hour?, minute?}
   * @param {number} years - Years to add (can be negative)
   * @returns {object} New date object
   */
  addYears(date, years) {
    return toPublic(addYears(toInternal(date), years));
  },

  /**
   * Add hours to a date.
   * @param {object} date - Starting date {year, month, day, hour?, minute?}
   * @param {number} hours - Hours to add (can be negative)
   * @returns {object} New date object
   */
  addHours(date, hours) {
    return toPublic(addHours(toInternal(date), hours));
  },

  /**
   * Add minutes to a date.
   * @param {object} date - Starting date {year, month, day, hour?, minute?}
   * @param {number} minutes - Minutes to add (can be negative)
   * @returns {object} New date object
   */
  addMinutes(date, minutes) {
    return toPublic(addMinutes(toInternal(date), minutes));
  },

  /**
   * Add seconds to a date.
   * @param {object} date - Starting date {year, month, day, hour?, minute?}
   * @param {number} seconds - Seconds to add (can be negative)
   * @returns {object} New date object
   */
  addSeconds(date, seconds) {
    return toPublic(addSeconds(toInternal(date), seconds));
  },

  /**
   * Calculate days between two dates.
   * @param {object} startDate - Start date {year, month, day}
   * @param {object} endDate - End date {year, month, day}
   * @returns {number} Number of days (can be negative)
   */
  daysBetween(startDate, endDate) {
    return daysBetween(toInternal(startDate), toInternal(endDate));
  },

  /**
   * Calculate months between two dates.
   * @param {object} startDate - Start date {year, month}
   * @param {object} endDate - End date {year, month}
   * @returns {number} Number of months (can be negative)
   */
  monthsBetween(startDate, endDate) {
    return monthsBetween(toInternal(startDate), toInternal(endDate));
  },

  /**
   * Calculate hours between two dates.
   * @param {object} startDate - Start date {year, month, day, hour?, minute?}
   * @param {object} endDate - End date {year, month, day, hour?, minute?}
   * @returns {number} Number of hours (can be negative/fractional)
   */
  hoursBetween(startDate, endDate) {
    return hoursBetween(toInternal(startDate), toInternal(endDate));
  },

  /**
   * Calculate minutes between two dates.
   * @param {object} startDate - Start date {year, month, day, hour?, minute?}
   * @param {object} endDate - End date {year, month, day, hour?, minute?}
   * @returns {number} Number of minutes (can be negative)
   */
  minutesBetween(startDate, endDate) {
    return minutesBetween(toInternal(startDate), toInternal(endDate));
  },

  /**
   * Calculate seconds between two dates.
   * @param {object} startDate - Start date {year, month, day, hour?, minute?}
   * @param {object} endDate - End date {year, month, day, hour?, minute?}
   * @returns {number} Number of seconds (can be negative)
   */
  secondsBetween(startDate, endDate) {
    return secondsBetween(toInternal(startDate), toInternal(endDate));
  },

  /**
   * Compare two date objects including time.
   * @param {object} date1 - First date
   * @param {object} date2 - Second date
   * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
   */
  compareDates(date1, date2) {
    return compareDates(toInternal(date1), toInternal(date2));
  },

  /**
   * Compare two dates by day only (ignoring time).
   * @param {object} date1 - First date
   * @param {object} date2 - Second date
   * @returns {number} -1 if date1 < date2, 0 if same day, 1 if date1 > date2
   */
  compareDays(date1, date2) {
    return compareDays(toInternal(date1), toInternal(date2));
  },

  /**
   * Check if two dates are the same day (ignoring time).
   * @param {object} date1 - First date
   * @param {object} date2 - Second date
   * @returns {boolean} True if same day
   */
  isSameDay(date1, date2) {
    return isSameDay(toInternal(date1), toInternal(date2));
  },

  /**
   * Get day of week for a date (0 = first day of week).
   * @param {object} date - Date to check {year, month, day}
   * @returns {number} Day of week index
   */
  dayOfWeek(date) {
    return dayOfWeek(toInternal(date));
  },

  /**
   * Check if a date is valid for the current calendar.
   * @param {object} date - Date to validate {year, month, day, hour?, minute?}
   * @returns {boolean} True if valid
   */
  isValidDate(date) {
    return isValidDate(toInternal(date));
  },

  /**
   * Get the full JournalEntryPage document for a note.
   * @param {string} pageId - The journal entry page ID
   * @returns {object|null} The page document or null if not found
   */
  getNoteDocument(pageId) {
    return NoteManager.getFullNote(pageId);
  },

  /**
   * Get available widget insertion points.
   * @returns {object} Object containing insertion point constants
   */
  get widgetPoints() {
    return { ...WIDGET_POINTS };
  },

  /**
   * Get replaceable element IDs.
   * @returns {object} Object containing replaceable element constants
   */
  get replaceableElements() {
    return { ...REPLACEABLE_ELEMENTS };
  },

  /**
   * Register a widget to be displayed in Calendaria UIs.
   * @param {string} moduleId - Your module's ID
   * @param {object} config - Widget configuration
   * @param {string} config.id - Unique widget ID within your module
   * @param {string} config.type - Widget type: 'button' | 'indicator' | 'custom'
   * @param {string} [config.insertAt] - Insertion point (use widgetPoints constants)
   * @param {string} [config.replaces] - Built-in element ID to replace (use replaceableElements constants)
   * @param {string|Function} [config.icon] - Icon class or function returning icon
   * @param {string|Function} [config.label] - Label text or function for dynamic content
   * @param {string|Function} [config.color] - Color or function
   * @param {string|Function} [config.tooltip] - Tooltip or function
   * @param {Function} [config.onClick] - Click handler (receives event)
   * @param {Function} [config.render] - Custom render function for type='custom'
   * @param {Function} [config.onAttach] - Called when widget attached to DOM
   * @param {Function} [config.onDetach] - Called when widget detached
   * @param {boolean} [config.disabled] - If true with replaces, hides element entirely
   * @returns {boolean} True if registered successfully
   */
  registerWidget(moduleId, config) {
    return registerWidget(moduleId, config);
  },

  /**
   * Get all registered widgets, optionally filtered by insertion point.
   * @param {string} [insertPoint] - Filter by insertion point
   * @returns {Array<object>} Array of widget configurations
   */
  getRegisteredWidgets(insertPoint) {
    return getRegisteredWidgets(insertPoint);
  },

  /**
   * Get the widget that is replacing a built-in element.
   * @param {string} elementId - The built-in element ID
   * @returns {object|null} Widget config or null if not replaced
   */
  getWidgetByReplacement(elementId) {
    return getWidgetByReplacement(elementId);
  },

  /** Refresh all widget displays. Call after dynamic content changes. */
  refreshWidgets() {
    refreshWidgets();
  },

  /**
   * Create a condition object for use in a condition tree.
   * @param {string} field - Condition field (use CONDITION_FIELDS enum values, e.g. 'month', 'weekday')
   * @param {string} op - Comparison operator (use CONDITION_OPERATORS enum values, e.g. '==', '!=')
   * @param {...*} values - Condition value(s). First is the primary value, second (if any) is the secondary value.
   * @returns {object} Condition object {field, operator, value, value2?}
   */
  createCondition(field, op, ...values) {
    const validFields = Object.values(CONDITION_FIELDS);
    if (!validFields.includes(field)) log(1, `Unknown condition field: "${field}". Valid fields: ${validFields.join(', ')}`);
    const validOps = Object.values(CONDITION_OPERATORS);
    if (!validOps.includes(op)) log(1, `Unknown condition operator: "${op}". Valid operators: ${validOps.join(', ')}`);
    const condition = { type: 'condition', field, op, value: values[0] ?? null };
    if (values.length > 1) condition.value2 = values[1];
    return condition;
  },

  /**
   * Create a condition group for combining conditions with boolean logic.
   * @param {string} mode - Group mode: 'and', 'or', 'nand', 'xor', 'count'
   * @param {object[]} children - Array of condition objects and/or nested groups
   * @param {object} [options] - Additional group options
   * @param {number} [options.threshold] - Required match count for 'count' mode
   * @returns {object} Group object {type: 'group', mode, children, threshold?}
   */
  createConditionGroup(mode, children = [], options = {}) {
    const validModes = Object.values(CONDITION_GROUP_MODES);
    if (!validModes.includes(mode)) log(1, `Unknown group mode: "${mode}". Valid modes: ${validModes.join(', ')}`);
    return createGroup(mode, children, options);
  },

  /**
   * Get the available condition fields enum.
   * @returns {object} CONDITION_FIELDS enum
   */
  get conditionFields() {
    return { ...CONDITION_FIELDS };
  },

  /**
   * Get the available condition operators enum.
   * @returns {object} CONDITION_OPERATORS enum
   */
  get conditionOperators() {
    return { ...CONDITION_OPERATORS };
  },

  /**
   * Get the available condition group modes enum.
   * @returns {object} CONDITION_GROUP_MODES enum
   */
  get conditionGroupModes() {
    return { ...CONDITION_GROUP_MODES };
  },

  /**
   * Get the available display styles enum.
   * @returns {object} DISPLAY_STYLES enum
   */
  get displayStyles() {
    return { ...DISPLAY_STYLES };
  },

  /**
   * Get the available note visibility levels enum.
   * @returns {object} NOTE_VISIBILITY enum
   */
  get noteVisibility() {
    return { ...NOTE_VISIBILITY };
  },

  /**
   * Check if a note occurs on a specific date.
   * @param {string} pageId - Journal entry page ID
   * @param {object} date - Date to check {year, month (1-indexed), day (1-indexed)}
   * @param {object} [options] - Evaluation options
   * @param {boolean} [options.silent] - If true, skip firing the CONDITION_EVALUATED hook (useful in loops)
   * @returns {boolean} True if the note occurs on this date
   */
  evaluateNote(pageId, date, options = {}) {
    const stub = NoteManager.getNote(pageId);
    if (!stub) {
      log(1, `evaluateNote: Note not found: ${pageId}`);
      return false;
    }
    const internalDate = toInternal(date);
    const result = isRecurringMatch(stub.flagData, internalDate);
    if (!options.silent) Hooks.callAll(HOOKS.CONDITION_EVALUATED, pageId, date, result);
    return result;
  },

  /**
   * Get the next N occurrences of a note from the current date.
   * @param {string} pageId - Journal entry page ID
   * @param {number} [count] - Number of occurrences to find
   * @returns {object[]} Array of date objects {year, month (1-indexed), day (1-indexed)}
   */
  getNextOccurrences(pageId, count = 5) {
    const stub = NoteManager.getNote(pageId);
    if (!stub) {
      log(1, `getNextOccurrences: Note not found: ${pageId}`);
      return [];
    }
    const current = this.getCurrentDateTime();
    const fromDate = { year: current.year, month: current.month - 1, dayOfMonth: current.day - 1 };
    return getNextOccurrences(stub.flagData, fromDate, count).map(toPublic);
  },

  /**
   * Get all occurrences of a note within a date range.
   * @param {string} pageId - Journal entry page ID
   * @param {object} startDate - Range start {year, month (1-indexed), day (1-indexed)}
   * @param {object} endDate - Range end {year, month (1-indexed), day (1-indexed)}
   * @param {number} [maxOccurrences] - Maximum occurrences to return
   * @returns {object[]} Array of date objects {year, month (1-indexed), day (1-indexed)}
   */
  getNoteOccurrencesInRange(pageId, startDate, endDate, maxOccurrences = 100) {
    const stub = NoteManager.getNote(pageId);
    if (!stub) {
      log(1, `getNoteOccurrencesInRange: Note not found: ${pageId}`);
      return [];
    }
    const internalStart = toInternal(startDate);
    const internalEnd = toInternal(endDate);
    return getOccurrencesInRange(stub.flagData, internalStart, internalEnd, maxOccurrences).map(toPublic);
  },

  /**
   * Set a note's visibility level.
   * @param {string} pageId - Journal entry page ID
   * @param {string} visibility - Visibility level: 'visible', 'hidden', 'secret'
   * @returns {Promise<object|null>} Updated note page, or null on failure
   */
  async setNoteVisibility(pageId, visibility) {
    const validValues = Object.values(NOTE_VISIBILITY);
    if (!validValues.includes(visibility)) {
      log(1, `setNoteVisibility: Invalid visibility "${visibility}". Valid values: ${validValues.join(', ')}`);
      return null;
    }
    return this.updateNote(pageId, { visibility });
  },

  /**
   * Set a note's display style.
   * @param {string} pageId - Journal entry page ID
   * @param {string} style - Display style: 'icon', 'pip', 'banner'
   * @returns {Promise<object|null>} Updated note page, or null on failure
   */
  async setNoteDisplayStyle(pageId, style) {
    const validValues = Object.values(DISPLAY_STYLES);
    if (!validValues.includes(style)) {
      log(1, `setNoteDisplayStyle: Invalid display style "${style}". Valid values: ${validValues.join(', ')}`);
      return null;
    }
    return this.updateNote(pageId, { displayStyle: style });
  },

  /**
   * Create a festival note for a calendar.
   * @param {string} calendarId - Calendar ID
   * @param {object} festivalData - Festival definition
   * @param {string} festivalData.name - Festival name
   * @param {string} [festivalData.content] - Festival description (HTML)
   * @param {object} festivalData.startDate - Start date {year, month (1-indexed), day (1-indexed)}
   * @param {string} [festivalData.color] - Festival color (hex)
   * @param {string} [festivalData.icon] - Icon class (e.g. 'fa-masks-theater')
   * @param {number} [festivalData.duration] - Duration in days (default 1)
   * @param {object} [festivalData.conditionTree] - Condition tree for recurrence
   * @param {string[]} [festivalData.categories] - Preset IDs
   * @returns {Promise<object|null>} Created note page, or null on failure
   */
  async createFestival(calendarId, festivalData) {
    if (!canEditNotes()) {
      ui.notifications.error('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    if (!calendarId || !festivalData?.name || !festivalData?.startDate) {
      log(1, 'createFestival: calendarId, festivalData.name, and festivalData.startDate are required');
      return null;
    }
    const noteData = {
      startDate: { year: festivalData.startDate.year, month: (festivalData.startDate.month ?? 1) - 1, dayOfMonth: (festivalData.startDate.day ?? 1) - 1, hour: 0, minute: 0 },
      allDay: true,
      linkedFestival: { calendarId, festivalKey: foundry.utils.randomID() },
      categories: festivalData.categories ?? ['festival'],
      color: festivalData.color || '#f0a500',
      icon: festivalData.icon ? `fas ${festivalData.icon}` : 'fas fa-masks-theater',
      visibility: NOTE_VISIBILITY.VISIBLE,
      displayStyle: DISPLAY_STYLES.ICON,
      hasDuration: (festivalData.duration ?? 1) > 1,
      duration: festivalData.duration ?? 1,
      conditionTree: festivalData.conditionTree ?? null
    };
    return await NoteManager.createNote({ name: festivalData.name, content: festivalData.content || '', noteData, calendarId, openSheet: false });
  },

  /**
   * Get all festival notes for a calendar.
   * @param {string} [calendarId] - Calendar ID (defaults to active calendar)
   * @returns {object[]} Array of festival note stubs
   */
  getFestivals(calendarId) {
    const targetId = calendarId || CalendarManager.getActiveCalendar()?.metadata?.id;
    if (!targetId) return [];
    return FestivalManager.getFestivalNotes(targetId);
  },

  /**
   * Check whether a cinematic is currently playing.
   * @returns {boolean}
   */
  isCinematicActive() {
    return CinematicOverlay.active;
  },

  /**
   * Play a cinematic overlay with the given payload.
   * @param {object} payload - Cinematic payload (from buildCinematicPayload)
   * @returns {Promise<void>} Resolves when the cinematic completes or is aborted
   */
  async playCinematic(payload) {
    return CinematicOverlay.play(payload);
  },

  /**
   * Abort the currently playing cinematic.
   */
  abortCinematic() {
    CinematicOverlay.abort();
  },

  /**
   * Build a cinematic payload without playing it.
   * @param {number} startTime - Start world time (seconds)
   * @param {number} endTime - End world time (seconds)
   * @returns {object} Cinematic payload with keyframes and settings
   */
  buildCinematicPayload(startTime, endTime) {
    return CinematicOverlay.buildPayload(startTime, endTime);
  },

  // ─── Fog of War ──────────────────────────────────────────────

  /**
   * Check whether Fog of War is enabled.
   * @returns {boolean}
   */
  isFogEnabled() {
    return isFogEnabled();
  },

  /**
   * Check whether a specific date is revealed (visible to the current user).
   * GMs always return true. Returns true if fog is disabled.
   * @param {number} year - Year
   * @param {number} month - Month (1-indexed)
   * @param {number} day - Day (1-indexed)
   * @param {string} [calendarId] - Calendar ID (defaults to active)
   * @returns {boolean}
   */
  isDateRevealed(year, month, day, calendarId) {
    return fogIsRevealed(year, month - 1, day - 1, calendarId);
  },

  /**
   * Get all revealed date ranges for a calendar.
   * @param {string} [calendarId] - Calendar ID (defaults to active)
   * @returns {Array<{start: {year, month, day}, end: {year, month, day}}>} Revealed ranges (1-indexed)
   */
  getRevealedRanges(calendarId) {
    const id = calendarId || CalendarRegistry.getActiveId();
    return fogGetRevealedRanges(id).map((r) => ({
      start: toPublic(r.start),
      end: toPublic(r.end)
    }));
  },

  /**
   * Reveal a date range. GM only. Merges adjacent/overlapping ranges.
   * @param {object} start - Start date {year, month (1-indexed), day (1-indexed)}
   * @param {object} end - End date {year, month (1-indexed), day (1-indexed)}
   * @param {string} [calendarId] - Calendar ID (defaults to active)
   * @returns {Promise<void>}
   */
  async revealDateRange(start, end, calendarId) {
    return fogRevealRange(toInternal(start), toInternal(end), calendarId);
  },

  /**
   * Clear all revealed ranges for a calendar. GM only.
   * @param {string} [calendarId] - Calendar ID (defaults to active)
   * @returns {Promise<void>}
   */
  async clearRevealedRanges(calendarId) {
    return fogClearRanges(calendarId);
  }
};

/**
 * Create and install the global CALENDARIA namespace.
 */
export function createGlobalNamespace() {
  globalThis['CALENDARIA'] = {
    apps: { HUD, BigCal, CalendarEditor, MiniCal, Chronicle, NoteViewer, Stopwatch, TimeKeeper },
    managers: { CalendarManager, WeatherManager, NoteManager, TimeClock, TimeTracker },
    models: { CalendariaCalendar },
    socket: CalendariaSocket,
    api: CalendariaAPI,
    permissions: { ...Permissions }
  };
}
