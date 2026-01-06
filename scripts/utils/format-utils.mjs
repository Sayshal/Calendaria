/**
 * Format utilities for Calendaria date/time formatting.
 * @module Utils/FormatUtils
 * @author Tyler
 */

import { format, localize } from './localization.mjs';

/* -------------------------------------------- */
/*  Ordinal Suffix Helper                       */
/* -------------------------------------------- */

/**
 * Get ordinal suffix for a number.
 * @param {number} n - Number
 * @returns {string} - Number with ordinal suffix (1st, 2nd, 3rd, etc.)
 */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Convert a number to Roman numerals.
 * @param {number} n - Number (1-3999)
 * @returns {string} - Roman numeral string
 */
export function toRomanNumeral(n) {
  if (n < 1 || n > 3999) return String(n);
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const numerals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < values.length; i++) {
    while (n >= values[i]) {
      result += numerals[i];
      n -= values[i];
    }
  }
  return result;
}

/* -------------------------------------------- */
/*  Date Formatting Parts                       */
/* -------------------------------------------- */

/**
 * Prepared date parts passed to formatters.
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components { year, month, dayOfMonth, hour, minute, second }
 * @returns {object} - Object with all formatting parts
 */
export function dateFormattingParts(calendar, components) {
  const { year, month, dayOfMonth, hour = 0, minute = 0, second = 0 } = components;
  const displayYear = year;
  const isMonthless = calendar?.isMonthless ?? false;
  const monthData = isMonthless ? null : calendar?.months?.values?.[month];
  const monthName = isMonthless ? '' : monthData ? localize(monthData.name) : `Month ${month + 1}`;
  const monthAbbr = isMonthless ? '' : monthData?.abbreviation ? localize(monthData.abbreviation) : monthName.slice(0, 3);
  const weekdays = calendar?.days?.values || [];
  const daysInMonthsBefore = isMonthless ? 0 : (calendar?.months?.values || []).slice(0, month).reduce((sum, m) => sum + (m.days || 0), 0);
  const dayOfYear = isMonthless ? dayOfMonth : daysInMonthsBefore + dayOfMonth;
  const yearZero = calendar?.years?.yearZero ?? 0;
  const internalYear = displayYear - yearZero;
  const daysPerYear = calendar?.days?.daysPerYear ?? 365;
  const firstWeekday = calendar?.years?.firstWeekday ?? 0;
  const totalDays = internalYear * daysPerYear + dayOfYear - 1;
  const weekday = weekdays.length > 0 ? (((totalDays + firstWeekday) % weekdays.length) + weekdays.length) % weekdays.length : 0;
  const weekdayData = weekdays[weekday];
  const weekdayName = weekdayData ? localize(weekdayData.name) : '';
  const weekdayAbbr = weekdayData?.abbreviation ? localize(weekdayData.abbreviation) : weekdayName.slice(0, 3);
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? 'AM' : 'PM';
  let eraName = '';
  let eraAbbr = '';
  let eraYear = '';
  const erasArray = Array.isArray(calendar?.eras) ? calendar.eras : calendar?.eras?.values;
  if (erasArray?.length > 0) {
    for (const era of erasArray) {
      if (displayYear >= era.startYear && (!era.endYear || displayYear <= era.endYear)) {
        eraName = localize(era.name);
        eraAbbr = era.abbreviation ? localize(era.abbreviation) : eraName.slice(0, 2);
        eraYear = displayYear - era.startYear + 1;
        break;
      }
    }
  }

  let seasonName = '';
  let seasonAbbr = '';
  let seasonIndex = -1;
  const currentSeason = calendar?.getCurrentSeason?.({ year, month, dayOfMonth, hour, minute, second });
  if (currentSeason) {
    seasonName = localize(currentSeason.name);
    seasonAbbr = currentSeason.abbreviation ? localize(currentSeason.abbreviation) : seasonName.slice(0, 3);
    const seasonsArray = calendar?.seasons?.values || [];
    seasonIndex = seasonsArray.indexOf(currentSeason);
  }

  return {
    // Year
    y: displayYear,
    yy: String(displayYear).slice(-2),
    yyyy: String(displayYear).padStart(4, '0'),

    // Month (empty for monthless calendars)
    M: isMonthless ? '' : month + 1,
    MM: isMonthless ? '' : String(month + 1).padStart(2, '0'),
    MMM: monthAbbr,
    MMMM: monthName,
    Mo: isMonthless ? '' : ordinal(month + 1),

    // Day (for monthless calendars, D is day-of-year)
    D: isMonthless ? dayOfYear : dayOfMonth,
    DD: isMonthless ? String(dayOfYear).padStart(2, '0') : String(dayOfMonth).padStart(2, '0'),
    Do: isMonthless ? ordinal(dayOfYear) : ordinal(dayOfMonth),
    DDD: String(dayOfYear).padStart(3, '0'),

    // Weekday
    d: weekday,
    dd: weekdayAbbr?.slice(0, 2) || '',
    ddd: weekdayAbbr,
    dddd: weekdayName,

    // Hour
    H: hour,
    HH: String(hour).padStart(2, '0'),
    h: hour12,
    hh: String(hour12).padStart(2, '0'),

    // Minute
    m: minute,
    mm: String(minute).padStart(2, '0'),

    // Second
    s: second,
    ss: String(second).padStart(2, '0'),

    // AM/PM
    A: ampm,
    a: ampm.toLowerCase(),

    // Era
    era: eraName,
    eraAbbr: eraAbbr,
    eraYear: eraYear,

    // Season
    season: seasonName,
    seasonAbbr: seasonAbbr,
    seasonIndex: seasonIndex,

    // Day of year (for calculations)
    dayOfYear: dayOfYear
  };
}

/* -------------------------------------------- */
/*  Preset Formatter Functions                  */
/* -------------------------------------------- */

/**
 * Format date as short (e.g., "5 Jan").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatShort(calendar, components) {
  const parts = dateFormattingParts(calendar, components);
  return `${parts.D} ${parts.MMM}`;
}

/**
 * Format date as long (e.g., "5 January, 1492").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatLong(calendar, components) {
  const parts = dateFormattingParts(calendar, components);
  return `${parts.D} ${parts.MMMM}, ${parts.y}`;
}

/**
 * Format date as full (e.g., "Monday, 5 January 1492").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatFull(calendar, components) {
  const parts = dateFormattingParts(calendar, components);
  return `${parts.dddd}, ${parts.D} ${parts.MMMM} ${parts.y}`;
}

/**
 * Format date with ordinal (e.g., "5th of January, Second Age").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatOrdinal(calendar, components) {
  const parts = dateFormattingParts(calendar, components);
  let result = `${parts.Do} of ${parts.MMMM}`;
  if (parts.era) result += `, ${parts.era}`;
  return result;
}

/**
 * Format date as fantasy (e.g., "5th of January, 1492 Second Age").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatFantasy(calendar, components) {
  const parts = dateFormattingParts(calendar, components);
  let result = `${parts.Do} of ${parts.MMMM}, ${parts.y}`;
  if (parts.era) result += ` ${parts.era}`;
  return result;
}

/**
 * Format time as 24h (e.g., "14:30").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatTime(calendar, components) {
  const parts = dateFormattingParts(calendar, components);
  return `${parts.HH}:${parts.mm}`;
}

/**
 * Format time as 12h (e.g., "2:30 PM").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatTime12(calendar, components) {
  const parts = dateFormattingParts(calendar, components);
  return `${parts.h}:${parts.mm} ${parts.A}`;
}

/**
 * Format as datetime 24h (e.g., "5 January 1492, 14:30").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatDateTime(calendar, components) {
  const parts = dateFormattingParts(calendar, components);
  return `${parts.D} ${parts.MMMM} ${parts.y}, ${parts.HH}:${parts.mm}`;
}

/**
 * Format as datetime 12h (e.g., "5 January 1492, 2:30 PM").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatDateTime12(calendar, components) {
  const parts = dateFormattingParts(calendar, components);
  return `${parts.D} ${parts.MMMM} ${parts.y}, ${parts.h}:${parts.mm} ${parts.A}`;
}

/**
 * Format time to approximate value (e.g., "Dawn", "Noon", "Night").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatApproximateTime(calendar, components) {
  const { hour = 0 } = components;
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const sunriseHour = calendar?.sunrise?.(components) ?? hoursPerDay * 0.25;
  const sunsetHour = calendar?.sunset?.(components) ?? hoursPerDay * 0.75;
  const daylightHours = sunsetHour - sunriseHour;
  const dayProgress = (hour - sunriseHour) / daylightHours;
  const nightProgress = hour >= sunsetHour ? (hour - sunsetHour) / (hoursPerDay - daylightHours) : hour < sunriseHour ? (hour + hoursPerDay - sunsetHour) / (hoursPerDay - daylightHours) : -1;

  let formatter;
  if (nightProgress > 0.96 && dayProgress < 0.04) formatter = 'Sunrise';
  else if (dayProgress > 0.96 && nightProgress < 0.04) formatter = 'Sunset';
  else if (dayProgress > 0.45 && dayProgress < 0.55) formatter = 'Noon';
  else if (nightProgress > 0.45 && nightProgress < 0.55) formatter = 'Midnight';
  else if (nightProgress > 0.84 && dayProgress < 0) formatter = 'Dawn';
  else if (dayProgress > 1 && nightProgress < 0.16) formatter = 'Dusk';
  else if (dayProgress > 0 && dayProgress < 0.5) formatter = 'Morning';
  else if (dayProgress >= 0.5 && dayProgress <= 0.85) formatter = 'Afternoon';
  else if (dayProgress > 0.85 && nightProgress < 0) formatter = 'Evening';
  else formatter = 'Night';

  return localize(`CALENDARIA.Format.ApproxTime.${formatter}`);
}

/**
 * Format date to approximate value based on season (e.g., "Early Spring", "Mid-Winter").
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components
 * @returns {string} - Formatted string
 */
export function formatApproximateDate(calendar, components) {
  const parts = dateFormattingParts(calendar, components);

  // Use calendar's getCurrentSeason method if available
  const season = calendar?.getCurrentSeason?.(components);
  if (!season) {
    // Fallback to month name if no seasons
    return parts.MMMM;
  }

  const seasonName = localize(season.name);

  // Calculate day of year
  let dayOfYear = components.dayOfMonth;
  const monthsValues = calendar?.months?.values || [];
  for (let i = 0; i < components.month; i++) {
    dayOfYear += monthsValues[i]?.days ?? 0;
  }

  // Get season bounds - use calendar method if available
  let seasonStart = 0;
  let seasonEnd = 365;
  const seasonsArray = calendar?.seasons?.values || [];
  const seasonIdx = seasonsArray.indexOf(season);

  if (seasonIdx >= 0 && calendar?._calculatePeriodicSeasonBounds) {
    const bounds = calendar._calculatePeriodicSeasonBounds(seasonIdx);
    seasonStart = bounds.dayStart;
    seasonEnd = bounds.dayEnd;
  } else if (season.dayStart !== undefined) {
    seasonStart = season.dayStart;
    seasonEnd = season.dayEnd ?? 365;
  }

  // Calculate progress within season
  let seasonLength, seasonPercent;
  if (seasonStart <= seasonEnd) {
    seasonLength = seasonEnd - seasonStart + 1;
    seasonPercent = (dayOfYear - seasonStart) / seasonLength;
  } else {
    // Season wraps around year boundary
    const daysInYear = calendar?.getDaysInYear?.(components.year) ?? 365;
    seasonLength = daysInYear - seasonStart + seasonEnd + 1;
    if (dayOfYear >= seasonStart) {
      seasonPercent = (dayOfYear - seasonStart) / seasonLength;
    } else {
      seasonPercent = (dayOfYear + daysInYear - seasonStart) / seasonLength;
    }
  }

  let formatter;
  if (seasonPercent <= 0.33) formatter = 'Early';
  else if (seasonPercent >= 0.66) formatter = 'Late';
  else formatter = 'Mid';

  return format(`CALENDARIA.Format.ApproxDate.${formatter}`, { season: seasonName });
}

/* -------------------------------------------- */
/*  Custom Token-based Formatting               */
/* -------------------------------------------- */

/**
 * Token regex pattern for custom format strings.
 * Matches standard tokens (longest first) and custom tokens in brackets.
 */
const TOKEN_REGEX = /\[([^\]]+)]|YYYY|YY|MMMM|MMM|MM|Mo|M|dddd|ddd|dd|Do|DDD|DD|D|d|HH|H|hh|h|mm|m|ss|s|WW|W|A|a/g;

/**
 * Format a date using a custom format string with tokens.
 * @param {object} calendar - Calendar data
 * @param {object} components - Date components
 * @param {string} formatStr - Format string with tokens
 * @returns {string} - Formatted date string
 */
export function formatCustom(calendar, components, formatStr) {
  const parts = dateFormattingParts(calendar, components);

  // Build context for custom tokens
  const cycleNum = getCycleNumber(calendar, components);
  const customContext = {
    moon: getMoonPhaseName(calendar, components),
    moonIcon: getMoonPhaseIcon(calendar, components),
    era: parts.era,
    eraAbbr: parts.eraAbbr,
    yearInEra: parts.eraYear,
    season: parts.season,
    seasonAbbr: parts.seasonAbbr,
    ch: getCanonicalHour(calendar, components),
    chAbbr: getCanonicalHourAbbr(calendar, components),
    cycle: cycleNum,
    cycleName: getCycleName(calendar, components) || cycleNum,
    cycleRoman: cycleNum ? toRomanNumeral(cycleNum) : '',
    cycleYear: cycleNum,
    approxTime: formatApproximateTime(calendar, components),
    approxDate: formatApproximateDate(calendar, components)
  };

  return formatStr.replace(TOKEN_REGEX, (match, customToken) => {
    // Custom token in brackets - return value if known, otherwise literal text
    if (customToken) return customContext[customToken] ?? customToken;

    // Standard token - map to parts
    const tokenMap = {
      YYYY: parts.yyyy,
      YY: parts.yy,
      MMMM: parts.MMMM,
      MMM: parts.MMM,
      MM: parts.MM,
      Mo: parts.Mo,
      M: parts.M,
      dddd: parts.dddd,
      ddd: parts.ddd,
      dd: parts.dd,
      Do: parts.Do,
      DDD: parts.DDD,
      DD: parts.DD,
      D: parts.D,
      d: parts.d,
      HH: parts.HH,
      H: parts.H,
      hh: parts.hh,
      h: parts.h,
      mm: parts.mm,
      m: parts.m,
      ss: parts.ss,
      s: parts.s,
      A: parts.A,
      a: parts.a
    };

    return tokenMap[match] ?? match;
  });
}

/* -------------------------------------------- */
/*  Helper Functions for Custom Tokens          */
/* -------------------------------------------- */

/**
 * Get moon phase name for the given date.
 * @param {object} calendar - Calendar data
 * @param {object} components - Date components
 * @returns {string} Moon phase name
 */
function getMoonPhaseName(calendar, components) {
  const { year, month, dayOfMonth } = components;
  if (!calendar?.moons?.length) return '';
  const moon = calendar.moons[0];
  if (!moon.phases?.length) return '';
  const cycleLength = moon.cycleLength || 29;
  const refDate = moon.referenceDate || { year: 0, month: 0, day: 1 };
  const refDays = refDate.year * 365 + refDate.month * 30 + refDate.day;
  const currentDays = year * 365 + month * 30 + dayOfMonth;
  const daysSinceRef = currentDays - refDays;
  const cyclePosition = (((daysSinceRef % cycleLength) + cycleLength) % cycleLength) / cycleLength;
  const phaseIndex = Math.floor(cyclePosition * moon.phases.length);
  const phase = moon.phases[phaseIndex];
  return phase ? localize(phase.name) : '';
}

/**
 * Get moon phase icon for the given date.
 * @param {object} calendar - Calendar data
 * @param {object} components - Date components
 * @returns {string} Moon phase icon
 */
function getMoonPhaseIcon(calendar, components) {
  const { year, month, dayOfMonth } = components;
  if (!calendar?.moons?.length) return '';
  const moon = calendar.moons[0];
  if (!moon.phases?.length) return '';
  const cycleLength = moon.cycleLength || 29;
  const refDate = moon.referenceDate || { year: 0, month: 0, day: 1 };
  const refDays = refDate.year * 365 + refDate.month * 30 + refDate.day;
  const currentDays = year * 365 + month * 30 + dayOfMonth;
  const daysSinceRef = currentDays - refDays;
  const cyclePosition = (((daysSinceRef % cycleLength) + cycleLength) % cycleLength) / cycleLength;
  const phaseIndex = Math.floor(cyclePosition * moon.phases.length);
  const phase = moon.phases[phaseIndex];
  return phase?.icon || '';
}

/**
 * Get canonical hour name for the given time.
 * @param {object} calendar - Calendar data
 * @param {object} components - Time components
 * @returns {string} Canonical hour name
 */
function getCanonicalHour(calendar, components) {
  const { hour = 0 } = components;
  if (!calendar?.canonicalHours?.length) return '';
  for (const ch of calendar.canonicalHours) {
    if (hour >= ch.startHour && hour < ch.endHour) {
      return localize(ch.name);
    }
  }
  return '';
}

/**
 * Get canonical hour abbreviation for the given time.
 * @param {object} calendar - Calendar data
 * @param {object} components - Time components
 * @returns {string} Canonical hour abbreviation
 */
function getCanonicalHourAbbr(calendar, components) {
  const { hour = 0 } = components;
  if (!calendar?.canonicalHours?.length) return '';
  for (const ch of calendar.canonicalHours) {
    if (hour >= ch.startHour && hour < ch.endHour) {
      return ch.abbreviation ? localize(ch.abbreviation) : localize(ch.name).slice(0, 3);
    }
  }
  return '';
}

/**
 * Get cycle entry name for the given date.
 * Uses calendar's getCycleEntry method if available.
 * @param {object} calendar - Calendar data
 * @param {object} components - Date components
 * @returns {string} Cycle entry name
 */
function getCycleName(calendar, components) {
  if (calendar?.getCycleEntry) {
    const entry = calendar.getCycleEntry(0, components);
    return entry?.name ? localize(entry.name) : '';
  }
  if (!calendar?.cycles?.length) return '';
  const cycle = calendar.cycles[0];
  if (!cycle?.entries?.length) return '';
  const yearZero = calendar?.years?.yearZero ?? 0;
  const displayYear = components.year + yearZero;
  const adjustedValue = displayYear + (cycle.offset || 0);
  let entryIndex = adjustedValue % cycle.entries.length;
  if (entryIndex < 0) entryIndex += cycle.entries.length;
  return localize(cycle.entries[entryIndex]?.name ?? '');
}

/**
 * Get 1-indexed cycle number for the given date.
 * Uses calendar's getCurrentCycleNumber method if available.
 * @param {object} calendar - Calendar data
 * @param {object} components - Date components
 * @returns {number|string} Cycle number (1-indexed)
 */
function getCycleNumber(calendar, components) {
  if (calendar?.getCurrentCycleNumber) return calendar.getCurrentCycleNumber(0, components);
  if (!calendar?.cycles?.length) return '';
  const cycle = calendar.cycles[0];
  if (!cycle?.length) return '';
  const yearZero = calendar?.years?.yearZero ?? 0;
  const displayYear = components.year + yearZero;
  const adjustedValue = displayYear + (cycle.offset || 0);
  const cycleNum = Math.floor(adjustedValue / cycle.length) + 1;
  return Math.max(1, cycleNum);
}

/* -------------------------------------------- */
/*  Legacy Format Migration                     */
/* -------------------------------------------- */

/**
 * Check if a format string uses legacy {{var}} syntax.
 * @param {string} formatStr - Format string
 * @returns {boolean} - True if legacy syntax detected
 */
export function isLegacyFormat(formatStr) {
  return /{{[^}]+}}/.test(formatStr);
}

/**
 * Migrate a legacy {{var}} format string to new token format.
 * @param {string} legacyFormat - Legacy format string with {{var}} syntax
 * @returns {string} - New format string with standard tokens
 */
export function migrateLegacyFormat(legacyFormat) {
  const migrations = {
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
    '{{E}}': '[era]',
    '{{e}}': '[yearInEra]',
    '{{season}}': '[season]',
    '{{moon}}': '[moon]',
    // Era template tokens
    '{{era}}': '[era]',
    '{{eraYear}}': '[yearInEra]',
    '{{yearInEra}}': '[yearInEra]',
    '{{year}}': 'YYYY',
    '{{abbreviation}}': '[eraAbbr]',
    '{{short}}': '[eraAbbr]'
  };

  let newFormat = legacyFormat;

  // Handle cycle tokens like {{c12}} -> [cycle]
  newFormat = newFormat.replace(/{{c\d+}}/g, '[cycle]');

  // Handle numbered cycle tokens like {{1}}, {{2}} -> [1], [2]
  newFormat = newFormat.replace(/{{(\d+)}}/g, '[$1]');

  // Apply standard migrations
  for (const [legacy, modern] of Object.entries(migrations)) {
    newFormat = newFormat.replace(new RegExp(legacy.replace(/[{}]/g, '\\$&'), 'g'), modern);
  }

  return newFormat;
}

/* -------------------------------------------- */
/*  Preset Registry                             */
/* -------------------------------------------- */

/**
 * Map of preset names to formatter functions.
 */
export const PRESET_FORMATTERS = {
  off: () => '',
  short: formatShort,
  long: formatLong,
  full: formatFull,
  ordinal: formatOrdinal,
  fantasy: formatFantasy,
  time: formatTime,
  time12: formatTime12,
  approxTime: formatApproximateTime,
  approxDate: formatApproximateDate,
  datetime: formatDateTime,
  datetime12: formatDateTime12
};

/**
 * Default format presets for reference.
 * @type {Object<string, string>}
 */
export const DEFAULT_FORMAT_PRESETS = {
  short: 'D MMM',
  long: 'D MMMM, YYYY',
  full: 'dddd, D MMMM YYYY',
  ordinal: 'Do of MMMM, [era]',
  fantasy: 'Do of MMMM, YYYY [era]',
  time: 'HH:mm',
  time12: 'h:mm A',
  approxTime: '[approxTime]',
  approxDate: '[approxDate]',
  datetime: 'D MMMM YYYY, HH:mm',
  datetime12: 'D MMMM YYYY, h:mm A'
};

/* -------------------------------------------- */
/*  Display Location Formatting                 */
/* -------------------------------------------- */

/**
 * Map location IDs to their corresponding calendar dateFormat key.
 * Used for "Calendar Default" preset resolution.
 */
const LOCATION_FORMAT_KEYS = {
  hudDate: 'long',
  hudTime: 'time',
  timekeeperDate: 'long',
  timekeeperTime: 'time',
  miniCalendarHeader: 'long',
  miniCalendarTime: 'time',
  fullCalendarHeader: 'full',
  chatTimestamp: 'long'
};

/**
 * Get the format string/preset for a specific display location.
 * Automatically selects GM or player format based on user role.
 * @param {string} locationId - Location identifier
 * @returns {string} - Format string or preset name
 */
export function getDisplayFormat(locationId) {
  const MODULE_ID = 'calendaria';
  const SETTINGS_KEY = 'displayFormats';

  try {
    const formats = game.settings.get(MODULE_ID, SETTINGS_KEY);
    const locationFormats = formats?.[locationId];
    if (!locationFormats) return 'long';

    const isGM = game.user.isGM;
    return isGM ? locationFormats.gm || 'long' : locationFormats.player || 'long';
  } catch {
    return 'long';
  }
}

/**
 * Resolve "calendarDefault" preset to the actual format string from calendar data.
 * @param {object} calendar - Calendar data with dateFormats
 * @param {string} locationId - Location identifier to map to format key
 * @returns {string} - Resolved format string or fallback preset name
 */
function resolveCalendarDefault(calendar, locationId) {
  const formatKey = LOCATION_FORMAT_KEYS[locationId] || 'long';
  const calendarFormat = calendar?.dateFormats?.[formatKey];
  return calendarFormat || formatKey;
}

/**
 * Format date/time for a specific display location.
 * Automatically handles GM vs player format selection.
 * @param {object} calendar - Calendar data
 * @param {object} components - Date components
 * @param {string} locationId - Location identifier
 * @returns {string} - Formatted date/time string
 */
export function formatForLocation(calendar, components, locationId) {
  let formatSetting = getDisplayFormat(locationId);
  if (formatSetting === 'calendarDefault') formatSetting = resolveCalendarDefault(calendar, locationId);
  if (PRESET_FORMATTERS[formatSetting]) return PRESET_FORMATTERS[formatSetting](calendar, components);
  return formatCustom(calendar, components, formatSetting);
}

/**
 * Get all display location definitions with labels.
 * @returns {Array<{id: string, label: string, category: string}>} Array of location definitions
 */
export function getDisplayLocationDefinitions() {
  return [
    { id: 'hudDate', label: 'CALENDARIA.Format.Location.HudDate', category: 'hud' },
    { id: 'hudTime', label: 'CALENDARIA.Format.Location.HudTime', category: 'hud' },
    { id: 'miniCalendarHeader', label: 'CALENDARIA.Format.Location.MiniCalendarHeader', category: 'miniCalendar' },
    { id: 'miniCalendarTime', label: 'CALENDARIA.Format.Location.MiniCalendarTime', category: 'miniCalendar' },
    { id: 'fullCalendarHeader', label: 'CALENDARIA.Format.Location.FullCalendarHeader', category: 'fullcal' },
    { id: 'chatTimestamp', label: 'CALENDARIA.Format.Location.ChatTimestamp', category: 'chat' }
  ];
}

/* -------------------------------------------- */
/*  Relative Time                               */
/* -------------------------------------------- */

/**
 * Get relative time description between two dates.
 * @param {object} targetDate - Target date { year, month, dayOfMonth }
 * @param {object} currentDate - Current date { year, month, dayOfMonth }
 * @returns {string} Relative time string (e.g., "3 days ago", "in 2 weeks")
 */
export function timeSince(targetDate, currentDate) {
  const daysPerMonth = 30;
  const daysPerYear = 365;

  const targetDays = targetDate.year * daysPerYear + targetDate.month * daysPerMonth + targetDate.dayOfMonth;
  const currentDays = currentDate.year * daysPerYear + currentDate.month * daysPerMonth + currentDate.dayOfMonth;
  const diff = targetDays - currentDays;

  if (diff === 0) return localize('CALENDARIA.Format.Today');
  if (diff === 1) return localize('CALENDARIA.Format.Tomorrow');
  if (diff === -1) return localize('CALENDARIA.Format.Yesterday');

  const absDiff = Math.abs(diff);
  const isFuture = diff > 0;

  const years = Math.floor(absDiff / daysPerYear);
  const months = Math.floor((absDiff % daysPerYear) / daysPerMonth);
  const weeks = Math.floor(absDiff / 7);
  const days = absDiff;

  let unit, count;
  if (years >= 1) {
    unit = years === 1 ? localize('CALENDARIA.Format.Year') : localize('CALENDARIA.Format.Years');
    count = years;
  } else if (months >= 1) {
    unit = months === 1 ? localize('CALENDARIA.Format.Month') : localize('CALENDARIA.Format.Months');
    count = months;
  } else if (weeks >= 1) {
    unit = weeks === 1 ? localize('CALENDARIA.Format.Week') : localize('CALENDARIA.Format.Weeks');
    count = weeks;
  } else {
    unit = days === 1 ? localize('CALENDARIA.Format.Day') : localize('CALENDARIA.Format.Days');
    count = days;
  }

  if (isFuture) {
    return format('CALENDARIA.Format.InFuture', { count, unit });
  } else {
    return format('CALENDARIA.Format.InPast', { count, unit });
  }
}

/* -------------------------------------------- */
/*  Token Reference                             */
/* -------------------------------------------- */

/**
 * Get all available tokens with descriptions.
 * @returns {Array<{token: string, description: string, type: string}>} Array of token definitions
 */
export function getAvailableTokens() {
  return [
    // Date tokens
    { token: 'YYYY', description: '4-digit year', type: 'standard' },
    { token: 'YY', description: '2-digit year', type: 'standard' },
    { token: 'MMMM', description: 'Full month name', type: 'standard' },
    { token: 'MMM', description: 'Month abbreviation', type: 'standard' },
    { token: 'MM', description: 'Month (01-12)', type: 'standard' },
    { token: 'M', description: 'Month (1-12)', type: 'standard' },
    { token: 'DD', description: 'Day (01-31)', type: 'standard' },
    { token: 'D', description: 'Day (1-31)', type: 'standard' },
    { token: 'Do', description: 'Day ordinal (1st)', type: 'standard' },
    { token: 'dddd', description: 'Full weekday', type: 'standard' },
    { token: 'ddd', description: 'Weekday abbr', type: 'standard' },
    // Time tokens
    { token: 'HH', description: 'Hour 24h (00-23)', type: 'standard' },
    { token: 'H', description: 'Hour 24h (0-23)', type: 'standard' },
    { token: 'hh', description: 'Hour 12h (01-12)', type: 'standard' },
    { token: 'h', description: 'Hour 12h (1-12)', type: 'standard' },
    { token: 'mm', description: 'Minute (00-59)', type: 'standard' },
    { token: 'ss', description: 'Second (00-59)', type: 'standard' },
    { token: 'A', description: 'AM/PM', type: 'standard' },
    { token: 'a', description: 'am/pm', type: 'standard' },
    // Custom tokens
    { token: '[era]', description: 'Era name', type: 'custom' },
    { token: '[eraAbbr]', description: 'Era abbreviation', type: 'custom' },
    { token: '[eraYear]', description: 'Year within era', type: 'custom' },
    { token: '[season]', description: 'Season name', type: 'custom' },
    { token: '[seasonAbbr]', description: 'Season abbreviation', type: 'custom' },
    { token: '[moon]', description: 'Moon phase', type: 'custom' },
    { token: '[moonIcon]', description: 'Moon phase icon', type: 'custom' },
    { token: '[ch]', description: 'Canonical hour', type: 'custom' },
    { token: '[chAbbr]', description: 'Canonical hour abbr', type: 'custom' },
    { token: '[cycle]', description: 'Cycle number (1-indexed)', type: 'custom' },
    { token: '[cycleName]', description: 'Cycle entry name', type: 'custom' },
    { token: '[cycleRoman]', description: 'Cycle number (Roman)', type: 'custom' },
    { token: '[approxTime]', description: 'Approx time (Noon)', type: 'custom' },
    { token: '[approxDate]', description: 'Approx date (Early Spring)', type: 'custom' }
  ];
}

/* -------------------------------------------- */
/*  Migration                                   */
/* -------------------------------------------- */

/**
 * Migrate all custom calendars to new bracket token format.
 * Handles dateFormats, era templates, and cycleFormat.
 * Runs once per version.
 * @returns {Promise<void>}
 */
export async function migrateCustomCalendars() {
  const MODULE_ID = 'calendaria';
  const SETTINGS_KEY = 'customCalendars';
  const MIGRATION_KEY = 'formatMigrationComplete';

  try {
    const migrationDone = game.settings.get(MODULE_ID, MIGRATION_KEY);
    if (migrationDone) return;
  } catch {
    // Setting not registered yet
  }

  if (!game.user.isGM) return;

  try {
    const customCalendars = game.settings.get(MODULE_ID, SETTINGS_KEY);
    if (!customCalendars || typeof customCalendars !== 'object') {
      await game.settings.set(MODULE_ID, MIGRATION_KEY, true);
      return;
    }

    let migrated = false;
    const updatedCalendars = {};

    for (const [id, calendar] of Object.entries(customCalendars)) {
      const updated = { ...calendar };

      // Migrate dateFormats
      if (updated.dateFormats) {
        const formats = updated.dateFormats;
        for (const [key, fmt] of Object.entries(formats)) {
          if (typeof fmt === 'string' && isLegacyFormat(fmt)) {
            formats[key] = migrateLegacyFormat(fmt);
            migrated = true;
          }
        }
      }

      // Migrate era templates
      if (updated.eras && Array.isArray(updated.eras)) {
        for (const era of updated.eras) {
          if (era.template && isLegacyFormat(era.template)) {
            era.template = migrateLegacyFormat(era.template);
            migrated = true;
          }
        }
      }

      // Migrate cycleFormat
      if (updated.cycleFormat && isLegacyFormat(updated.cycleFormat)) {
        updated.cycleFormat = migrateLegacyFormat(updated.cycleFormat);
        migrated = true;
      }

      updatedCalendars[id] = updated;
    }

    if (migrated) {
      await game.settings.set(MODULE_ID, SETTINGS_KEY, updatedCalendars);
      console.log('Calendaria: Migrated custom calendar formats to new bracket token syntax');
    }

    await game.settings.set(MODULE_ID, MIGRATION_KEY, true);
  } catch (e) {
    console.warn('Calendaria: Could not migrate custom calendars', e);
  }
}

/**
 * Migrate Harptos calendar festivals to add countsForWeekday: false.
 * This fixes intercalary days not being excluded from weekday calculations.
 * @returns {Promise<void>}
 */
export async function migrateIntercalaryFestivals() {
  const MODULE_ID = 'calendaria';
  const SETTINGS_KEY = 'customCalendars';
  const MIGRATION_KEY = 'intercalaryMigrationComplete';

  try {
    const migrationDone = game.settings.get(MODULE_ID, MIGRATION_KEY);
    if (migrationDone) return;
  } catch {
    // Setting not registered yet
  }

  if (!game.user.isGM) return;

  // Known Harptos festival names that should not count for weekday
  const HARPTOS_FESTIVALS = [
    'CALENDARIA.Calendar.Harptos.Festival.Midwinter',
    'CALENDARIA.Calendar.Harptos.Festival.Greengrass',
    'CALENDARIA.Calendar.Harptos.Festival.Midsummer',
    'CALENDARIA.Calendar.Harptos.Festival.Shieldmeet',
    'CALENDARIA.Calendar.Harptos.Festival.Highharvestide',
    'CALENDARIA.Calendar.Harptos.Festival.FeastOfTheMoon'
  ];

  try {
    const customCalendars = game.settings.get(MODULE_ID, SETTINGS_KEY);
    if (!customCalendars || typeof customCalendars !== 'object') {
      await game.settings.set(MODULE_ID, MIGRATION_KEY, true);
      return;
    }

    let migrated = false;
    const updatedCalendars = {};

    for (const [id, calendar] of Object.entries(customCalendars)) {
      const updated = { ...calendar };

      // Check if this is a Harptos-based calendar
      if (id === 'harptos' || calendar.metadata?.id === 'harptos') {
        if (updated.festivals && Array.isArray(updated.festivals)) {
          for (const festival of updated.festivals) {
            if (HARPTOS_FESTIVALS.includes(festival.name) && festival.countsForWeekday === undefined) {
              festival.countsForWeekday = false;
              migrated = true;
            }
          }
        }
      }

      updatedCalendars[id] = updated;
    }

    if (migrated) {
      await game.settings.set(MODULE_ID, SETTINGS_KEY, updatedCalendars);
      console.log('Calendaria: Migrated Harptos festivals to set countsForWeekday: false');
    }

    await game.settings.set(MODULE_ID, MIGRATION_KEY, true);
  } catch (e) {
    console.warn('Calendaria: Could not migrate intercalary festivals', e);
  }
}
