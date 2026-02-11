/**
 * Format utilities for Calendaria date/time formatting.
 * @module Utils/FormatUtils
 * @author Tyler
 */

import { format, localize } from './localization.mjs';

/**
 * Resolve a convenience array getter from a calendar object, falling back to Object.values()
 * for plain data objects (e.g., in-progress editor data) that lack model getters.
 * @param {object} calendar - Calendar model or plain data object
 * @param {string} getter - Getter name (e.g., 'monthsArray')
 * @param {string} path - Dot-separated path to the keyed object (e.g., 'months.values')
 * @returns {Array<object>} Ordered array of collection items
 */
function resolveArray(calendar, getter, path) {
  if (calendar?.[getter]) return calendar[getter];
  const obj = path.split('.').reduce((o, k) => o?.[k], calendar);
  return obj ? Object.values(obj) : [];
}

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

/**
 * Prepared date parts passed to formatters.
 * @param {object} calendar - The calendar data
 * @param {object} components - Time components { year, month, dayOfMonth, hour, minute, second }
 * @returns {object} - Object with all formatting parts
 */
export function dateFormattingParts(calendar, components) {
  const { year, month, dayOfMonth, hour = 0, minute = 0, second = 0 } = components;
  const displayYear = year;
  const yearZero = calendar?.years?.yearZero ?? 0;
  const internalYear = displayYear - yearZero;
  const isMonthless = calendar?.isMonthless ?? false;
  const months = resolveArray(calendar, 'monthsArray', 'months.values');
  const monthData = isMonthless ? null : months[month];
  const festivalDay = calendar?.findFestivalDay?.({ ...components, year: internalYear, dayOfMonth: dayOfMonth - 1 });
  const isIntercalaryMonth = monthData?.type === 'intercalary';
  const isIntercalaryFestival = festivalDay?.countsForWeekday === false || isIntercalaryMonth;
  const intercalaryName = festivalDay ? localize(festivalDay.name) : monthData ? localize(monthData.name) : '';
  const monthName = isIntercalaryFestival ? intercalaryName : isMonthless ? '' : monthData ? localize(monthData.name) : format('CALENDARIA.Calendar.MonthFallback', { num: month + 1 });
  const monthAbbr = isIntercalaryFestival ? intercalaryName.slice(0, 3) : isMonthless ? '' : monthData?.abbreviation ? localize(monthData.abbreviation) : monthName.slice(0, 3);
  const weekdays = resolveArray(calendar, 'weekdaysArray', 'days.values');
  let daysInMonthsBefore = 0;
  if (!isMonthless && calendar?.getDaysInMonth) for (let m = 0; m < month; m++) daysInMonthsBefore += calendar.getDaysInMonth(m, internalYear);
  else if (!isMonthless) daysInMonthsBefore = months.slice(0, month).reduce((sum, m) => sum + (m.days || 0), 0);
  const dayOfYear = isMonthless ? dayOfMonth : daysInMonthsBefore + dayOfMonth;
  let totalDaysFromPriorYears = 0;
  if (calendar?.getDaysInYear) {
    if (internalYear > 0) for (let y = 0; y < internalYear; y++) totalDaysFromPriorYears += calendar.getDaysInYear(y);
    else if (internalYear < 0) for (let y = -1; y >= internalYear; y--) totalDaysFromPriorYears -= calendar.getDaysInYear(y);
  }
  const totalDays = totalDaysFromPriorYears + dayOfYear - 1;
  const firstWeekday = calendar?.years?.firstWeekday ?? 0;
  const nonCountingFestivalsInYear = calendar?.countNonWeekdayFestivalsBefore?.({ year: internalYear, month, dayOfMonth: dayOfMonth - 1 }) ?? 0;
  const nonCountingFestivalsFromPriorYears = calendar?.countNonWeekdayFestivalsBeforeYear?.(internalYear) ?? 0;
  const intercalaryInYear = calendar?.countIntercalaryDaysBefore?.({ year: internalYear, month, dayOfMonth: dayOfMonth - 1 }) ?? 0;
  const intercalaryFromPriorYears = calendar?.countIntercalaryDaysBeforeYear?.(internalYear) ?? 0;
  const nonCountingTotal = nonCountingFestivalsFromPriorYears + nonCountingFestivalsInYear + intercalaryFromPriorYears + intercalaryInYear;
  const countingDays = totalDays - nonCountingTotal;
  const weekday = weekdays.length > 0 ? (((countingDays + firstWeekday) % weekdays.length) + weekdays.length) % weekdays.length : 0;
  const weekdayData = weekdays[weekday];
  const weekdayName = weekdayData ? localize(weekdayData.name) : '';
  const weekdayAbbr = weekdayData?.abbreviation ? localize(weekdayData.abbreviation) : weekdayName.slice(0, 3);
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const midday = Math.floor(hoursPerDay / 2);
  const hour12 = hour === 0 ? midday : hour > midday ? hour - midday : hour;
  const amPm = calendar?.amPmNotation ?? {};
  const isPM = hour >= midday;
  const meridiemFull = isPM ? amPm.pm || 'PM' : amPm.am || 'AM';
  const meridiemAbbr = isPM ? amPm.pmAbbr || meridiemFull : amPm.amAbbr || meridiemFull;
  const eras = resolveArray(calendar, 'erasArray', 'eras');
  const matchingEras = [];
  if (eras.length > 0) {
    for (const era of eras) {
      if (displayYear >= era.startYear && (era.endYear == null || displayYear <= era.endYear)) {
        const name = localize(era.name);
        const abbr = era.abbreviation ? localize(era.abbreviation) : name.slice(0, 2);
        matchingEras.push({ name, abbr, yearInEra: displayYear - era.startYear + 1 });
      }
    }
  }
  const primaryEra = matchingEras[0] || {};
  const eraName = primaryEra.name || '';
  const eraAbbr = primaryEra.abbr || '';
  const eraYear = primaryEra.yearInEra || '';

  const yearNames = calendar?.years?.names || [];
  const yearNameEntry = yearNames.find((e) => e.year === displayYear);
  const yearName = yearNameEntry ? localize(yearNameEntry.name) : '';

  let seasonName = '';
  let seasonAbbr = '';
  let seasonIndex = -1;
  const currentSeason = calendar?.getCurrentSeason?.({ year, month, dayOfMonth, hour, minute, second });
  if (currentSeason) {
    seasonName = localize(currentSeason.name);
    seasonAbbr = currentSeason.abbreviation ? localize(currentSeason.abbreviation) : seasonName.slice(0, 3);
    const allSeasons = resolveArray(calendar, 'seasonsArray', 'seasons.values');
    seasonIndex = allSeasons.indexOf(currentSeason);
  }

  const daysPerWeek = weekdays.length || 7;
  const weekOfYear = Math.ceil(dayOfYear / daysPerWeek);
  const weekOfMonth = Math.ceil(dayOfMonth / daysPerWeek);
  let namedWeek = '';
  let namedWeekAbbr = '';
  const currentWeek = calendar?.getCurrentWeek?.({ year: internalYear, month, dayOfMonth: dayOfMonth - 1 });
  if (currentWeek) {
    namedWeek = localize(currentWeek.name) || '';
    namedWeekAbbr = currentWeek.abbreviation ? localize(currentWeek.abbreviation) : namedWeek.slice(0, 3);
  }
  let climateZoneName = '';
  let climateZoneAbbr = '';
  const activeZone = calendar?.getActiveClimateZone?.();
  if (activeZone) {
    climateZoneName = activeZone.name ? localize(activeZone.name) : activeZone.id || '';
    climateZoneAbbr = climateZoneName.slice(0, 3);
  }

  return {
    // Year
    y: displayYear,
    yy: String(displayYear).slice(-2),
    yyyy: String(displayYear).padStart(4, '0'),
    yearName: yearName,

    // Month (empty for monthless calendars and intercalary festivals, festival name for MMMM/MMM)
    M: isIntercalaryFestival || isMonthless ? '' : month + 1,
    MM: isIntercalaryFestival || isMonthless ? '' : String(month + 1).padStart(2, '0'),
    MMM: monthAbbr,
    MMMM: monthName,
    Mo: isIntercalaryFestival || isMonthless ? '' : ordinal(month + 1),

    // Day (empty for intercalary festivals, day-of-year for monthless calendars)
    D: isIntercalaryFestival ? '' : isMonthless ? dayOfYear : dayOfMonth,
    DD: isIntercalaryFestival ? '' : isMonthless ? String(dayOfYear).padStart(2, '0') : String(dayOfMonth).padStart(2, '0'),
    Do: isIntercalaryFestival ? '' : isMonthless ? ordinal(dayOfYear) : ordinal(dayOfMonth),
    DDD: String(dayOfYear).padStart(3, '0'),

    // Weekday (E tokens are UTS #35 standard, d tokens deprecated)
    E: weekdayAbbr,
    EE: weekdayAbbr,
    EEE: weekdayAbbr,
    EEEE: weekdayName,
    EEEEE: weekdayName?.charAt(0) || '',
    e: weekday,
    d: weekday,
    dd: weekdayAbbr?.slice(0, 2) || '',
    ddd: weekdayAbbr,
    dddd: weekdayName,

    // Week
    w: weekOfYear,
    ww: String(weekOfYear).padStart(2, '0'),
    W: weekOfMonth,
    namedWeek: namedWeek,
    namedWeekAbbr: namedWeekAbbr,

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

    // AM/PM (abbreviation by default, [meridiemFull] for full name)
    A: meridiemAbbr,
    a: meridiemAbbr.toLowerCase(),
    meridiemFull: meridiemFull,

    // Era (G tokens are UTS #35 standard, era* tokens deprecated)
    G: eraAbbr,
    GG: eraAbbr,
    GGG: eraAbbr,
    GGGG: eraName,
    era: eraName,
    eraAbbr: eraAbbr,
    eraYear: eraYear,
    matchingEras: matchingEras,

    // Season/Quarter (Q tokens mapped to season, season* tokens deprecated)
    Q: seasonIndex >= 0 ? seasonIndex + 1 : '',
    QQ: seasonIndex >= 0 ? String(seasonIndex + 1).padStart(2, '0') : '',
    QQQ: seasonAbbr,
    QQQQ: seasonName,
    season: seasonName,
    seasonAbbr: seasonAbbr,
    seasonIndex: seasonIndex,

    // Climate zone
    z: climateZoneAbbr,
    zzzz: climateZoneName,

    // Day of year
    dayOfYear: dayOfYear
  };
}

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
 * @param {object} [zone] - Optional climate zone for latitude-based daylight
 * @returns {string} - Formatted string
 */
export function formatApproximateTime(calendar, components, zone = null) {
  const { hour = 0 } = components;
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const sunriseHour = calendar?.sunrise?.(components, zone) ?? hoursPerDay * 0.25;
  const sunsetHour = calendar?.sunset?.(components, zone) ?? hoursPerDay * 0.75;
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
  const monthsValues = resolveArray(calendar, 'monthsArray', 'months.values');
  for (let i = 0; i < components.month; i++) {
    dayOfYear += monthsValues[i]?.days ?? 0;
  }

  // Get season bounds - check month-based first (most specific), then periodic, then day-of-year
  let seasonStart = 0;
  let seasonEnd = 365;
  const seasonsArray = resolveArray(calendar, 'seasonsArray', 'seasons.values');
  const seasonIdx = seasonsArray.indexOf(season);

  if (season.monthStart != null && season.monthEnd != null) {
    seasonStart = (season.dayStart ?? 1) - 1;
    for (let i = 0; i < season.monthStart - 1; i++) seasonStart += monthsValues[i]?.days ?? 0;
    seasonEnd = (season.dayEnd ?? monthsValues[season.monthEnd - 1]?.days ?? 30) - 1;
    for (let i = 0; i < season.monthEnd - 1; i++) seasonEnd += monthsValues[i]?.days ?? 0;
  } else if (seasonIdx >= 0 && calendar?.seasons?.type === 'periodic' && calendar?._calculatePeriodicSeasonBounds) {
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

/**
 * Token regex pattern for custom format strings.
 * Matches standard tokens (longest first) and custom tokens in brackets.
 */
const TOKEN_REGEX = /\[([^\]]+)]|YYYY|YY|Y|MMMM|MMM|MM|Mo|M|EEEEE|EEEE|EEE|EE|E|dddd|ddd|dd|Do|DDD|DD|D|d|e|GGGG|GGG|GG|G|QQQQ|QQQ|QQ|Q|zzzz|z|ww|w|W|HH|H|hh|h|mm|m|ss|s|A|a/g;

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
    era: parts.era,
    eraAbbr: parts.eraAbbr,
    yearInEra: parts.eraYear,
    season: parts.season,
    seasonAbbr: parts.seasonAbbr,
    namedWeek: parts.namedWeek,
    namedWeekAbbr: parts.namedWeekAbbr,
    ch: getCanonicalHour(calendar, components),
    chAbbr: getCanonicalHourAbbr(calendar, components),
    cycle: cycleNum,
    cycleName: getCycleName(calendar, components) || cycleNum,
    cycleRoman: cycleNum ? toRomanNumeral(cycleNum) : '',
    cycleYear: cycleNum,
    approxTime: formatApproximateTime(calendar, components),
    approxDate: formatApproximateDate(calendar, components),
    meridiemFull: parts.meridiemFull,
    yearName: parts.yearName
  };

  // Standard token map (built once, used for both direct and fallback resolution)
  const tokenMap = {
    YYYY: parts.yyyy,
    YY: parts.yy,
    Y: parts.y,
    MMMM: parts.MMMM,
    MMM: parts.MMM,
    MM: parts.MM,
    Mo: parts.Mo,
    M: parts.M,
    EEEEE: parts.EEEEE,
    EEEE: parts.EEEE,
    EEE: parts.EEE,
    EE: parts.EE,
    E: parts.E,
    e: parts.e,
    dddd: parts.dddd,
    ddd: parts.ddd,
    dd: parts.dd,
    d: parts.d,
    Do: parts.Do,
    DDD: parts.DDD,
    DD: parts.DD,
    D: parts.D,
    GGGG: parts.GGGG,
    GGG: parts.GGG,
    GG: parts.GG,
    G: parts.G,
    QQQQ: parts.QQQQ,
    QQQ: parts.QQQ,
    QQ: parts.QQ,
    Q: parts.Q,
    zzzz: parts.zzzz,
    z: parts.z,
    ww: parts.ww,
    w: parts.w,
    W: parts.W,
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

  /**
   * Resolve a token string to its value.
   * @param {string} token - Format token to resolve
   */
  const resolveToken = (token) => {
    if (token in tokenMap) return tokenMap[token];
    if (token in customContext) return customContext[token];
    return token;
  };

  return formatStr.replace(TOKEN_REGEX, (match, customToken) => {
    if (customToken) {
      // Handle pipe fallback syntax: [token|fallback]
      if (customToken.includes('|')) {
        const [primary, fallback] = customToken.split('|', 2);
        const value = customContext[primary] ?? '';
        return value || String(resolveToken(fallback));
      }
      // Handle era index syntax: [era=N], [eraAbbr=N], [yearInEra=N]
      const eraIndexMatch = customToken.match(/^(era|eraAbbr|yearInEra)=(\d+)$/);
      if (eraIndexMatch) {
        const [, field, idxStr] = eraIndexMatch;
        const era = parts.matchingEras?.[parseInt(idxStr)] || {};
        if (field === 'era') return era.name || '';
        if (field === 'eraAbbr') return era.abbr || '';
        if (field === 'yearInEra') return era.yearInEra != null ? String(era.yearInEra) : '';
        return '';
      }
      if (customToken.startsWith('moonIcon')) {
        const paramPart = customToken.slice(9);
        let moonSelector;
        if (paramPart) {
          if ((paramPart.startsWith("'") && paramPart.endsWith("'")) || (paramPart.startsWith('"') && paramPart.endsWith('"'))) moonSelector = paramPart.slice(1, -1);
          else moonSelector = /^\d+$/.test(paramPart) ? parseInt(paramPart, 10) : paramPart;
        }
        return getMoonPhaseIcon(calendar, components, moonSelector);
      }
      return customContext[customToken] ?? customToken;
    }

    return tokenMap[match] ?? match;
  });
}

/**
 * Validate a custom format string and generate a preview.
 * @param {string} formatStr - The format string to validate
 * @param {object} [calendar] - Optional calendar data for preview
 * @param {object} [components] - Optional date components for preview
 * @returns {{valid: boolean, preview: string, error: string}} Validation result
 */
export function validateFormatString(formatStr, calendar, components) {
  if (!formatStr || typeof formatStr !== 'string') return { valid: true };
  const openBrackets = (formatStr.match(/\[/g) || []).length;
  const closeBrackets = (formatStr.match(/]/g) || []).length;
  if (openBrackets !== closeBrackets) return { valid: false, error: 'CALENDARIA.Format.Error.UnclosedBracket' };
  if (/\[]/.test(formatStr)) return { valid: false, error: 'CALENDARIA.Format.Error.EmptyBracket' };
  if (calendar && components) {
    try {
      const preview = formatCustom(calendar, components, formatStr);
      const cleanPreview = stripMoonIconMarkers(preview);
      return { valid: true, preview: cleanPreview };
    } catch (e) {
      log(1, e);
      return { valid: false, error: 'CALENDARIA.Format.Error.Invalid' };
    }
  }
  return { valid: true };
}

/**
 * Get moon phase name for the given date.
 * @param {object} calendar - Calendar data
 * @param {object} components - Date components
 * @returns {string} Moon phase name
 */
function getMoonPhaseName(calendar, components) {
  const moons = resolveArray(calendar, 'moonsArray', 'moons');
  if (!moons.length) return '';
  if (calendar.getMoonPhase && calendar.componentsToTime) {
    const worldTime = calendar.componentsToTime(components);
    const phaseData = calendar.getMoonPhase(0, worldTime);
    return phaseData?.subPhaseName || phaseData?.name || '';
  }
  // Fallback for non-CalendariaCalendar objects
  const moon = moons[0];
  const phasesArr = Object.values(moon.phases ?? {});
  if (!phasesArr.length) return '';
  const { year, month, dayOfMonth } = components;
  const cycleLength = moon.cycleLength || 29;
  const refDate = moon.referenceDate || { year: 0, month: 0, day: 1 };
  const refDays = refDate.year * 365 + refDate.month * 30 + refDate.day;
  const currentDays = year * 365 + month * 30 + dayOfMonth;
  const daysSinceRef = currentDays - refDays;
  const cyclePosition = (((daysSinceRef % cycleLength) + cycleLength) % cycleLength) / cycleLength;
  const phaseIndex = Math.floor(cyclePosition * phasesArr.length);
  const phase = phasesArr[phaseIndex];
  return phase ? localize(phase.name) : '';
}

/**
 * Get moon phase icon marker for the given date.
 * @param {object} calendar - Calendar data
 * @param {object} components - Date components
 * @param {string|number} [moonSelector] - Moon name or index (default: first moon)
 * @returns {string} Moon phase icon marker (use renderMoonIcons to convert to HTML)
 */
function getMoonPhaseIcon(calendar, components, moonSelector) {
  const moons = resolveArray(calendar, 'moonsArray', 'moons');
  if (!moons.length) return '';
  let moonIndex = 0;
  if (moonSelector !== undefined && moonSelector !== null && moonSelector !== '') {
    if (typeof moonSelector === 'number') moonIndex = moonSelector;
    else if (/^\d+$/.test(moonSelector)) moonIndex = parseInt(moonSelector, 10);
    else {
      const selectorLower = String(moonSelector).toLowerCase();
      const foundIndex = moons.findIndex((m) => {
        const moonName = localize(m.name).toLowerCase();
        const rawName = (m.name || '').toLowerCase();
        return moonName === selectorLower || rawName === selectorLower;
      });
      if (foundIndex >= 0) moonIndex = foundIndex;
    }
  }

  const moon = moons[moonIndex];
  if (!moon) return '';
  let phase;
  if (calendar.getMoonPhase && calendar.componentsToTime) {
    const yearZero = calendar.years?.yearZero ?? 0;
    const internalComponents = {
      ...components,
      year: components.year - yearZero,
      dayOfMonth: (components.dayOfMonth ?? 1) - 1
    };
    const worldTime = calendar.componentsToTime(internalComponents);
    const phaseData = calendar.getMoonPhase(moonIndex, worldTime);
    if (phaseData) phase = { name: phaseData.name, icon: phaseData.icon };
  }

  if (!phase) {
    const phasesArr = Object.values(moon.phases ?? {});
    if (phasesArr.length) {
      const { year, month, dayOfMonth } = components;
      const cycleLength = moon.cycleLength || 29;
      const refDate = moon.referenceDate || { year: 0, month: 0, day: 1 };
      const refDays = refDate.year * 365 + refDate.month * 30 + refDate.day;
      const currentDays = year * 365 + month * 30 + dayOfMonth;
      const daysSinceRef = currentDays - refDays;
      const cyclePosition = (((daysSinceRef % cycleLength) + cycleLength) % cycleLength) / cycleLength;
      const phaseIndex = Math.floor(cyclePosition * phasesArr.length);
      phase = phasesArr[phaseIndex];
    }
  }

  if (!phase?.icon) return '';
  const phaseName = localize(phase.name);
  const moonName = localize(moon.name);
  const moonColor = moon.color || '';
  return `${'__MOONICON:'}${phase.icon}|${phaseName}|${moonName}: ${phaseName}|${moonColor}${'__'}`;
}

/**
 * Check if a formatted string contains moon icon markers.
 * @param {string} str - Formatted string
 * @returns {boolean} True if string contains moon icon markers
 */
export function hasMoonIconMarkers(str) {
  return str?.includes('__MOONICON:') ?? false;
}

/**
 * Convert moon icon markers in a string to HTML img elements.
 * @param {string} str - String with moon icon markers
 * @returns {string} String with markers replaced by <img> elements
 */
export function renderMoonIcons(str) {
  if (!str || !hasMoonIconMarkers(str)) return str;
  return str.replace(/__MOONICON:([^|]*)\|([^|]*)\|([^|]*)\|(.*?)__/g, (_, src, alt, tooltip, color) => {
    if (color) return `<span class="calendaria-moon-icon tinted" style="--moon-color: ${color}" data-tooltip="${tooltip}"><img src="${src}" alt="${alt}"></span>`;
    return `<img class="calendaria-moon-icon" src="${src}" alt="${alt}" data-tooltip="${tooltip}">`;
  });
}

/**
 * Strip moon icon markers from a string (for text-only contexts).
 * @param {string} str - String with moon icon markers
 * @returns {string} String with markers removed
 */
export function stripMoonIconMarkers(str) {
  if (!str || !hasMoonIconMarkers(str)) return str;
  return str.replace(/__MOONICON:([^|]*)\|([^|]*)\|([^|]*)\|(.*?)__/g, '');
}

/**
 * Get canonical hour name for the given time.
 * @param {object} calendar - Calendar data
 * @param {object} components - Time components
 * @returns {string} Canonical hour name
 */
function getCanonicalHour(calendar, components) {
  const { hour = 0 } = components;
  const hours = resolveArray(calendar, 'canonicalHoursArray', 'canonicalHours');
  if (!hours.length) return '';
  for (const ch of hours) {
    // Handle hours that wrap around midnight (e.g., 21-1 means 21:00 to 01:00)
    if (ch.startHour <= ch.endHour) {
      if (hour >= ch.startHour && hour < ch.endHour) return localize(ch.name);
    } else {
      // Wraps around midnight: startHour > endHour
      if (hour >= ch.startHour || hour < ch.endHour) return localize(ch.name);
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
  const hours = resolveArray(calendar, 'canonicalHoursArray', 'canonicalHours');
  if (!hours.length) return '';
  for (const ch of hours) {
    // Handle hours that wrap around midnight (e.g., 21-1 means 21:00 to 01:00)
    let matches = false;
    if (ch.startHour <= ch.endHour) matches = hour >= ch.startHour && hour < ch.endHour;
    else matches = hour >= ch.startHour || hour < ch.endHour;
    if (matches) return ch.abbreviation ? localize(ch.abbreviation) : localize(ch.name).slice(0, 3);
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
  const cycles = resolveArray(calendar, 'cyclesArray', 'cycles');
  if (!cycles.length) return '';
  const cycle = cycles[0];
  const stages = Object.values(cycle?.stages ?? {});
  if (!stages.length) return '';
  const yearZero = calendar?.years?.yearZero ?? 0;
  const displayYear = components.year + yearZero;
  const adjustedValue = displayYear + (cycle.offset || 0);
  let entryIndex = adjustedValue % stages.length;
  if (entryIndex < 0) entryIndex += stages.length;
  return localize(stages[entryIndex]?.name ?? '');
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
  const cycles = resolveArray(calendar, 'cyclesArray', 'cycles');
  if (!cycles.length) return '';
  const cycle = cycles[0];
  if (!cycle?.length) return '';
  const yearZero = calendar?.years?.yearZero ?? 0;
  const displayYear = components.year + yearZero;
  const adjustedValue = displayYear + (cycle.offset || 0);
  const cycleNum = Math.floor(adjustedValue / cycle.length) + 1;
  return Math.max(1, cycleNum);
}

// ==================== Duration Formatting ====================

/**
 * Format milliseconds into a display string based on format setting.
 * Supports tokens: HH (hours), mm (minutes), ss (seconds), SSS (milliseconds).
 * @param {number} ms - Milliseconds to format
 * @param {string} format - Format string (e.g., 'HH:mm:ss.SSS', 'mm:ss')
 * @returns {string} Formatted duration string
 */
export function formatDuration(ms, format = 'HH:mm:ss.SSS') {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  switch (format) {
    case 'HH:mm:ss.SSS':
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
    case 'HH:mm:ss':
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    case 'mm:ss.SSS':
      return `${pad(minutes + hours * 60)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
    case 'mm:ss':
      return `${pad(minutes + hours * 60)}:${pad(seconds)}`;
    case 'ss.SSS':
      return `${pad(seconds + minutes * 60 + hours * 3600)}:${pad(milliseconds, 3)}`;
    case 'ss':
      return `${pad(seconds + minutes * 60 + hours * 3600)}`;
    default:
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
  }
}

/**
 * Format game time seconds into display string based on calendar settings.
 * Uses calendar's time units (hoursPerDay, minutesPerHour, secondsPerMinute).
 * @param {number} totalSecs - Total game time seconds
 * @param {object} calendar - Active calendar with time unit definitions
 * @param {string} format - Format string (e.g., 'HH:mm:ss', 'mm:ss')
 * @returns {string} Formatted duration string
 */
export function formatGameDuration(totalSecs, calendar, format = 'HH:mm:ss') {
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
  const secondsPerMinute = calendar?.days?.secondsPerMinute ?? 60;
  const secsPerMin = secondsPerMinute;
  const secsPerHour = minutesPerHour * secsPerMin;
  const secsPerDay = hoursPerDay * secsPerHour;
  const days = Math.floor(totalSecs / secsPerDay);
  const hours = Math.floor((totalSecs % secsPerDay) / secsPerHour);
  const minutes = Math.floor((totalSecs % secsPerHour) / secsPerMin);
  const secs = Math.floor(totalSecs % secsPerMin);
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const showMs = format.includes('.SSS');
  const msSuffix = showMs ? '.000' : '';

  switch (format) {
    case 'HH:mm:ss.SSS':
    case 'HH:mm:ss':
      if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(secs)}${msSuffix}`;
      return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${msSuffix}`;
    case 'mm:ss.SSS':
    case 'mm:ss': {
      const totalMins = minutes + hours * minutesPerHour + days * hoursPerDay * minutesPerHour;
      return `${pad(totalMins)}:${pad(secs)}${msSuffix}`;
    }
    case 'ss.SSS':
    case 'ss': {
      const totalSecsCalc = secs + minutes * secsPerMin + hours * secsPerHour + days * secsPerDay;
      return `${pad(totalSecsCalc)}${msSuffix}`;
    }
    default:
      if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(secs)}${msSuffix}`;
      return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${msSuffix}`;
  }
}

// ==================== Legacy Format Migration ====================

/**
 * Map of preset names to formatter functions.
 * Most presets use formatCustom with a format string from DEFAULT_FORMAT_PRESETS.
 */
export const PRESET_FORMATTERS = {
  off: () => '',
  approxTime: formatApproximateTime,
  approxDate: formatApproximateDate
};

/**
 * Default format presets for reference.
 * @type {Object<string, string>}
 */
export const DEFAULT_FORMAT_PRESETS = {
  // Approximate
  approxDate: '[approxDate]',
  approxTime: '[approxTime]',
  // Date - Standard
  dateShort: 'D MMM',
  dateMedium: 'D MMMM',
  dateLong: 'D MMMM, Y',
  dateFull: 'EEEE, D MMMM Y',
  // Date - Regional
  dateUS: 'MMMM D, Y',
  dateUSFull: 'EEEE, MMMM D, Y',
  dateISO: 'YYYY-MM-DD',
  dateNumericUS: 'MM/DD/YYYY',
  dateNumericEU: 'DD/MM/YYYY',
  // Date - Ordinal/Fantasy
  ordinal: 'Do of MMMM',
  ordinalLong: 'Do of MMMM, Y',
  ordinalEra: 'Do of MMMM, Y GGGG',
  ordinalFull: 'EEEE, Do of MMMM, Y GGGG',
  seasonDate: 'QQQQ, Do of MMMM',
  // Year/Week
  weekHeader: '[Week] W [of] MMMM, Y',
  yearOnly: 'Y',
  yearEra: 'Y G',
  // Time
  time12: 'h:mm A',
  time12Sec: 'h:mm:ss A',
  time24: 'HH:mm',
  time24Sec: 'HH:mm:ss',
  // Date + Time
  datetimeShort12: 'D MMM, h:mm A',
  datetimeShort24: 'D MMM, HH:mm',
  datetime12: 'D MMMM Y, h:mm A',
  datetime24: 'D MMMM Y, HH:mm',
  // Stopwatch duration presets (realtime)
  stopwatchRealtimeFull: 'HH:mm:ss.SSS',
  stopwatchRealtimeNoMs: 'HH:mm:ss',
  stopwatchRealtimeMinSec: 'mm:ss.SSS',
  stopwatchRealtimeSecOnly: 'ss.SSS',
  // Stopwatch duration presets (gametime)
  stopwatchGametimeFull: 'HH:mm:ss',
  stopwatchGametimeMinSec: 'mm:ss',
  stopwatchGametimeSecOnly: 'ss'
};

/**
 * Map location IDs to their corresponding calendar dateFormat key.
 * Used for "Calendar Default" preset resolution.
 */
const LOCATION_FORMAT_KEYS = {
  hudDate: 'dateLong',
  hudTime: 'time24',
  timekeeperDate: 'dateLong',
  timekeeperTime: 'time24',
  miniCalHeader: 'dateLong',
  miniCalTime: 'time24',
  bigCalHeader: 'dateFull',
  bigCalWeekHeader: 'weekHeader',
  bigCalYearHeader: 'yearHeader',
  bigCalYearLabel: 'yearLabel',
  chatTimestamp: 'dateLong'
};

/**
 * Default format presets for each location (fallback when not in settings).
 * @type {Object<string, string>}
 */
export const LOCATION_DEFAULTS = {
  hudDate: 'ordinal',
  hudTime: 'time24',
  timekeeperDate: 'dateLong',
  timekeeperTime: 'time24',
  miniCalHeader: 'dateLong',
  miniCalTime: 'time24',
  bigCalHeader: 'dateFull',
  bigCalWeekHeader: 'weekHeader',
  bigCalYearHeader: 'yearOnly',
  bigCalYearLabel: 'yearEra',
  chatTimestamp: 'dateShort',
  stopwatchRealtime: 'stopwatchRealtimeFull',
  stopwatchGametime: 'stopwatchGametimeFull'
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
  const defaultFormat = LOCATION_DEFAULTS[locationId] || 'dateLong';

  try {
    const formats = game.settings.get(MODULE_ID, SETTINGS_KEY);
    const locationFormats = formats?.[locationId];
    if (!locationFormats) return defaultFormat;

    const isGM = game.user.isGM;
    return isGM ? locationFormats.gm || defaultFormat : locationFormats.player || defaultFormat;
  } catch {
    return defaultFormat;
  }
}

/**
 * Resolve "calendarDefault" preset to the actual format string from calendar data.
 * @param {object} calendar - Calendar data with dateFormats
 * @param {string} locationId - Location identifier to map to format key
 * @returns {string} - Resolved format string or fallback preset name
 */
function resolveCalendarDefault(calendar, locationId) {
  const formatKey = LOCATION_FORMAT_KEYS[locationId] || 'dateLong';
  const calendarFormat = calendar?.dateFormats?.[formatKey];
  // Fall back to the preset format if calendar doesn't have this format key
  return calendarFormat || DEFAULT_FORMAT_PRESETS[formatKey] || LOCATION_DEFAULTS[locationId] || 'dateLong';
}

/**
 * Resolve a preset name or format string to an actual format string.
 * @param {string} formatSetting - Preset name or custom format string
 * @returns {string} - Format string
 */
export function resolveFormatString(formatSetting) {
  return DEFAULT_FORMAT_PRESETS[formatSetting] || formatSetting;
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
  const formatStr = resolveFormatString(formatSetting);
  return formatCustom(calendar, components, formatStr);
}

/**
 * Get all display location definitions with labels.
 * @returns {Array<{id: string, label: string, category: string}>} Array of location definitions
 */
export function getDisplayLocationDefinitions() {
  return [
    { id: 'hudDate', label: 'CALENDARIA.Format.Location.HudDate', category: 'hud' },
    { id: 'hudTime', label: 'CALENDARIA.Format.Location.HudTime', category: 'hud' },
    { id: 'miniCalHeader', label: 'CALENDARIA.Format.Location.MiniCalHeader', category: 'miniCal' },
    { id: 'miniCalTime', label: 'CALENDARIA.Format.Location.MiniCalTime', category: 'miniCal' },
    { id: 'bigCalHeader', label: 'CALENDARIA.Format.Location.BigCalHeader', category: 'bigcal' },
    { id: 'bigCalWeekHeader', label: 'CALENDARIA.Format.Location.BigCalWeekHeader', category: 'bigcal' },
    { id: 'bigCalYearHeader', label: 'CALENDARIA.Format.Location.BigCalYearHeader', category: 'bigcal' },
    { id: 'bigCalYearLabel', label: 'CALENDARIA.Format.Location.BigCalYearLabel', category: 'bigcal' },
    { id: 'chatTimestamp', label: 'CALENDARIA.Format.Location.ChatTimestamp', category: 'chat' }
  ];
}

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

/**
 * Get all available tokens with descriptions.
 * @returns {Array<{token: string, descriptionKey: string, type: string}>} Array of token definitions
 */
export function getAvailableTokens() {
  return [
    // Year tokens
    { token: 'Y', descriptionKey: 'CALENDARIA.Format.Token.Y', type: 'standard' },
    { token: 'YY', descriptionKey: 'CALENDARIA.Format.Token.YY', type: 'standard' },
    { token: 'YYYY', descriptionKey: 'CALENDARIA.Format.Token.YYYY', type: 'standard' },
    { token: '[yearName]', descriptionKey: 'CALENDARIA.Format.Token.yearName', type: 'custom' },
    // Month tokens
    { token: 'M', descriptionKey: 'CALENDARIA.Format.Token.M', type: 'standard' },
    { token: 'MM', descriptionKey: 'CALENDARIA.Format.Token.MM', type: 'standard' },
    { token: 'MMM', descriptionKey: 'CALENDARIA.Format.Token.MMM', type: 'standard' },
    { token: 'MMMM', descriptionKey: 'CALENDARIA.Format.Token.MMMM', type: 'standard' },
    { token: 'Mo', descriptionKey: 'CALENDARIA.Format.Token.Mo', type: 'standard' },
    // Day tokens
    { token: 'D', descriptionKey: 'CALENDARIA.Format.Token.D', type: 'standard' },
    { token: 'DD', descriptionKey: 'CALENDARIA.Format.Token.DD', type: 'standard' },
    { token: 'Do', descriptionKey: 'CALENDARIA.Format.Token.Do', type: 'standard' },
    { token: 'DDD', descriptionKey: 'CALENDARIA.Format.Token.DDD', type: 'standard' },
    // Weekday tokens
    { token: 'EEEE', descriptionKey: 'CALENDARIA.Format.Token.EEEE', type: 'standard' },
    { token: 'EEE', descriptionKey: 'CALENDARIA.Format.Token.EEE', type: 'standard' },
    { token: 'EE', descriptionKey: 'CALENDARIA.Format.Token.EE', type: 'standard' },
    { token: 'E', descriptionKey: 'CALENDARIA.Format.Token.E', type: 'standard' },
    { token: 'EEEEE', descriptionKey: 'CALENDARIA.Format.Token.EEEEE', type: 'standard' },
    { token: 'e', descriptionKey: 'CALENDARIA.Format.Token.e', type: 'standard' },
    // Week tokens
    { token: 'w', descriptionKey: 'CALENDARIA.Format.Token.w', type: 'standard' },
    { token: 'ww', descriptionKey: 'CALENDARIA.Format.Token.ww', type: 'standard' },
    { token: 'W', descriptionKey: 'CALENDARIA.Format.Token.W', type: 'standard' },
    { token: '[namedWeek]', descriptionKey: 'CALENDARIA.Format.Token.namedWeek', type: 'custom' },
    { token: '[namedWeekAbbr]', descriptionKey: 'CALENDARIA.Format.Token.namedWeekAbbr', type: 'custom' },
    // Era tokens
    { token: 'GGGG', descriptionKey: 'CALENDARIA.Format.Token.GGGG', type: 'standard' },
    { token: 'GGG', descriptionKey: 'CALENDARIA.Format.Token.GGG', type: 'standard' },
    { token: 'GG', descriptionKey: 'CALENDARIA.Format.Token.GG', type: 'standard' },
    { token: 'G', descriptionKey: 'CALENDARIA.Format.Token.G', type: 'standard' },
    { token: '[yearInEra]', descriptionKey: 'CALENDARIA.Format.Token.yearInEra', type: 'custom' },
    { token: '[era=N]', descriptionKey: 'CALENDARIA.Format.Token.eraIndex', type: 'custom' },
    { token: '[eraAbbr=N]', descriptionKey: 'CALENDARIA.Format.Token.eraAbbrIndex', type: 'custom' },
    { token: '[yearInEra=N]', descriptionKey: 'CALENDARIA.Format.Token.yearInEraIndex', type: 'custom' },
    // Season/Quarter tokens
    { token: 'QQQQ', descriptionKey: 'CALENDARIA.Format.Token.QQQQ', type: 'standard' },
    { token: 'QQQ', descriptionKey: 'CALENDARIA.Format.Token.QQQ', type: 'standard' },
    { token: 'QQ', descriptionKey: 'CALENDARIA.Format.Token.QQ', type: 'standard' },
    { token: 'Q', descriptionKey: 'CALENDARIA.Format.Token.Q', type: 'standard' },
    // Climate zone tokens
    { token: 'zzzz', descriptionKey: 'CALENDARIA.Format.Token.zzzz', type: 'standard' },
    { token: 'z', descriptionKey: 'CALENDARIA.Format.Token.z', type: 'standard' },
    // Time tokens
    { token: 'H', descriptionKey: 'CALENDARIA.Format.Token.H', type: 'standard' },
    { token: 'HH', descriptionKey: 'CALENDARIA.Format.Token.HH', type: 'standard' },
    { token: 'h', descriptionKey: 'CALENDARIA.Format.Token.h', type: 'standard' },
    { token: 'hh', descriptionKey: 'CALENDARIA.Format.Token.hh', type: 'standard' },
    { token: 'm', descriptionKey: 'CALENDARIA.Format.Token.m', type: 'standard' },
    { token: 'mm', descriptionKey: 'CALENDARIA.Format.Token.mm', type: 'standard' },
    { token: 's', descriptionKey: 'CALENDARIA.Format.Token.s', type: 'standard' },
    { token: 'ss', descriptionKey: 'CALENDARIA.Format.Token.ss', type: 'standard' },
    { token: 'A', descriptionKey: 'CALENDARIA.Format.Token.A', type: 'standard' },
    { token: 'a', descriptionKey: 'CALENDARIA.Format.Token.a', type: 'standard' },
    { token: '[meridiemFull]', descriptionKey: 'CALENDARIA.Format.Token.meridiemFull', type: 'custom' },
    // Custom tokens (bracket syntax)
    { token: '[moon]', descriptionKey: 'CALENDARIA.Format.Token.moon', type: 'custom' },
    { token: '[moonIcon]', descriptionKey: 'CALENDARIA.Format.Token.moonIcon', type: 'custom' },
    { token: '[ch]', descriptionKey: 'CALENDARIA.Format.Token.ch', type: 'custom' },
    { token: '[chAbbr]', descriptionKey: 'CALENDARIA.Format.Token.chAbbr', type: 'custom' },
    { token: '[cycle]', descriptionKey: 'CALENDARIA.Format.Token.cycle', type: 'custom' },
    { token: '[cycleName]', descriptionKey: 'CALENDARIA.Format.Token.cycleName', type: 'custom' },
    { token: '[cycleRoman]', descriptionKey: 'CALENDARIA.Format.Token.cycleRoman', type: 'custom' },
    { token: '[approxTime]', descriptionKey: 'CALENDARIA.Format.Token.approxTime', type: 'custom' },
    { token: '[approxDate]', descriptionKey: 'CALENDARIA.Format.Token.approxDate', type: 'custom' }
  ];
}
