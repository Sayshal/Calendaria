/**
 * Calendaria text enricher system.
 * @module Utils/Enrichers
 */

import { BigCal, Chronicle, MiniCal } from '../applications/_module.mjs';
import { CalendarManager, CalendarRegistry } from '../calendar/_module.mjs';
import { COMPASS_DIRECTIONS, HOOKS, MODULE, SETTINGS, WIND_SPEEDS } from '../constants.mjs';
import { NoteManager, addDays, addMonths, addYears, daysBetween, getNextOccurrences, monthsBetween } from '../notes/_module.mjs';
import {
  ECLIPSE_TYPES,
  PRESET_FORMATTERS,
  formatCustom,
  getEclipseAtDate,
  getMoonPhasePosition,
  getNextConvergence,
  getNextEclipse,
  getNextFullMoon,
  isMoonFull,
  log,
  resolveFormatString,
  timeSince
} from '../utils/_module.mjs';
import { WeatherManager } from '../weather/_module.mjs';

/** @type {Object<string, Function>} Combined handler map for all enricher types. */
export const handlers = {
  date: enrichDate,
  time: enrichTime,
  weekday: enrichWeekday,
  season: enrichSeason,
  era: enrichEra,
  cycle: enrichCycle,
  festival: enrichFestival,
  restday: enrichRestDay,
  countdown: enrichCountdown,
  countup: enrichCountup,
  elapsed: enrichCountup,
  between: enrichBetween,
  timeuntil: enrichTimeUntil,
  datemath: enrichDateMath,
  calname: enrichCalName,
  month: enrichMonth,
  year: enrichYear,
  dayofyear: enrichDayOfYear,
  yearprogress: enrichYearProgress,
  leapyear: enrichLeapYear,
  intercalary: enrichIntercalary,
  daysinyear: enrichDaysInYear,
  sunrise: enrichSunrise,
  sunset: enrichSunset,
  daylight: enrichDaylight,
  isdaytime: enrichIsDaytime,
  dayprogress: enrichDayProgress,
  nightprogress: enrichNightProgress,
  untilsunrise: enrichUntilSunrise,
  untilsunset: enrichUntilSunset,
  moon: enrichMoon,
  moons: enrichMoons,
  nextfullmoon: enrichNextFullMoon,
  convergence: enrichConvergence,
  eclipse: enrichEclipse,
  nexteclipse: enrichNextEclipse,
  weather: enrichWeather,
  temperature: enrichTemperature,
  wind: enrichWind,
  precipitation: enrichPrecipitation,
  weathericon: enrichWeatherIcon,
  zone: enrichZone,
  forecast: enrichForecast,
  event: enrichEvent,
  notes: enrichNotes,
  next: enrichNext,
  category: enrichCategory,
  chronicle: enrichChronicle,
  summary: enrichSummary,
  almanac: enrichAlmanac,
  format: enrichFormat,
  compare: enrichCompare,
  peek: enrichPeek
};

/** @type {Object<string, string>} Eclipse type display name localization keys. */
const ECLIPSE_TYPE_LABELS = {
  [ECLIPSE_TYPES.TOTAL_SOLAR]: 'CALENDARIA.Eclipse.TotalSolar',
  [ECLIPSE_TYPES.PARTIAL_SOLAR]: 'CALENDARIA.Eclipse.PartialSolar',
  [ECLIPSE_TYPES.ANNULAR_SOLAR]: 'CALENDARIA.Eclipse.AnnularSolar',
  [ECLIPSE_TYPES.TOTAL_LUNAR]: 'CALENDARIA.Eclipse.TotalLunar',
  [ECLIPSE_TYPES.PARTIAL_LUNAR]: 'CALENDARIA.Eclipse.PartialLunar',
  [ECLIPSE_TYPES.PENUMBRAL_LUNAR]: 'CALENDARIA.Eclipse.PenumbralLunar'
};

/**
 * Convert public date to internal format.
 * @param {object} date - Public date {year, month, day}
 * @returns {object} Internal date {year, month, dayOfMonth}
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
 * Convert internal date to public format.
 * @param {object} date - Internal date {year, month, dayOfMonth}
 * @returns {object} Public date {year, month, day}
 */
function toPublic(date) {
  const d = { ...date };
  d.month = (d.month ?? 0) + 1;
  d.day = (d.dayOfMonth ?? 0) + 1;
  delete d.dayOfMonth;
  return d;
}

/**
 * Resolve calendar context from config.
 * @param {object} config - Parsed enricher config (checks config.cal)
 * @returns {{calendar: object|null, components: object}} Calendar instance and time components
 */
function resolveCalendar(config) {
  if (config?.cal) {
    const calendar = CalendarRegistry.get(config.cal);
    if (calendar) {
      const components = calendar.timeToComponents(game.time.worldTime);
      return { calendar, components };
    }
  }
  return { calendar: CalendarManager.getActiveCalendar(), components: game.time.components };
}

/**
 * Convert internal date to public format, applying yearZero.
 * @param {object} internalDate - Internal date {year, month, dayOfMonth}
 * @param {object} [calendar] - Calendar instance (defaults to active)
 * @returns {object} Public date {year, month, day}
 */
function internalToPublic(internalDate, calendar = null) {
  const cal = calendar || CalendarManager.getActiveCalendar();
  const yearZero = cal?.years?.yearZero ?? 0;
  return { year: internalDate.year + yearZero, month: (internalDate.month ?? 0) + 1, day: (internalDate.dayOfMonth ?? 0) + 1 };
}

/**
 * Get current date and time.
 * @param {object} [calendar] - Calendar instance (defaults to active)
 * @param {object} [components] - Time components (defaults to game.time.components)
 * @returns {object} {year, month, day, hour, minute, second}
 */
function getCurrentDateTime(calendar = null, components = null) {
  const comp = components || game.time.components;
  const cal = calendar || CalendarManager.getActiveCalendar();
  const yearZero = cal?.years?.yearZero ?? 0;
  const { dayOfMonth: _dom, ...rest } = comp;
  return { ...rest, year: comp.year + yearZero, month: comp.month + 1, day: _dom + 1 };
}

/**
 * Format a date using a preset or token string.
 * @param {object|null} components - Public date (1-indexed) or null for current
 * @param {string} [formatOrPreset] - Preset name or format string
 * @param {object} [calendar] - Calendar instance (defaults to active)
 * @returns {string} Formatted date string
 */
function formatDate(components = null, formatOrPreset = 'dateLong', calendar = null) {
  const cal = calendar || CalendarManager.getActiveCalendar();
  if (!cal) return '';
  const raw = components || game.time.components;
  const formatted = {
    ...raw,
    year: components ? raw.year : raw.year + (cal.years?.yearZero ?? 0),
    month: components ? (raw.month ?? 1) - 1 : raw.month,
    dayOfMonth: components ? (raw.day ?? 1) - 1 : (raw.dayOfMonth ?? 0)
  };
  delete formatted.day;
  if (PRESET_FORMATTERS[formatOrPreset]) return PRESET_FORMATTERS[formatOrPreset](cal, formatted);
  const formatStr = resolveFormatString(formatOrPreset);
  return formatCustom(cal, formatted, formatStr);
}

/**
 * Parse enricher config string.
 * @param {string} configStr - Raw config string from regex match
 * @returns {object} Parsed config with values array, raw string, and key-value properties
 */
function parseConfig(configStr) {
  const config = { values: [], raw: configStr?.trim() || '' };
  if (!config.raw) return config;
  for (const part of config.raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []) {
    if (!part) continue;
    const eqIndex = part.indexOf('=');
    if (eqIndex > 0) {
      const key = part.slice(0, eqIndex);
      let value = part.slice(eqIndex + 1).replace(/(^"|"$)/g, '');
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (value !== '' && !isNaN(value)) value = Number(value);
      config[key] = value;
    } else {
      config.values.push(part.replace(/(^"|"$)/g, ''));
    }
  }
  return config;
}

/**
 * Parse a date from positional values.
 * @param {string[]} values - Array of positional string values
 * @returns {object|null} Date object {year, month, day} (1-indexed) or null
 */
function parseDateFromValues(values) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar || !values?.length) return null;
  const months = calendar.monthsArray || [];
  let day, monthIdx, year;
  let found = false;
  for (let i = 0; i < values.length; i++) {
    if (!isNaN(values[i])) continue;
    const val = values[i].toLowerCase();
    const idx = months.findIndex((m) => {
      const name = game.i18n.localize(m.name).toLowerCase();
      const abbr = m.abbreviation ? game.i18n.localize(m.abbreviation).toLowerCase() : '';
      return name === val || abbr === val;
    });
    if (idx >= 0) {
      monthIdx = idx + 1;
      found = true;
      const before = values
        .slice(0, i)
        .filter((v) => !isNaN(v))
        .map(Number);
      const after = values
        .slice(i + 1)
        .filter((v) => !isNaN(v))
        .map(Number);
      if (before.length) day = before[0];
      if (after.length) year = after[0];
      break;
    }
  }
  if (!found) {
    const nums = values.filter((v) => !isNaN(v)).map(Number);
    if (nums.length >= 3) [day, monthIdx, year] = nums;
    else if (nums.length === 2) [day, monthIdx] = nums;
    else if (nums.length === 1) day = nums[0];
    else return null;
  }
  const current = getCurrentDateTime();
  return { year: year ?? current.year, month: monthIdx ?? current.month, day: day ?? current.day };
}

/**
 * Create a badge enricher element.
 * @param {string} type - Enricher type name
 * @param {string|HTMLElement} content - Text content or child element
 * @param {string} configStr - Raw config for live refresh
 * @param {boolean} isLive - Whether this element should live-update
 * @param {string|null} [iconClass] - FontAwesome icon class
 * @param {string|null} [tooltip] - Tooltip text
 * @returns {HTMLElement} The enricher span element
 */
function createElement(type, content, configStr, isLive = false, iconClass = null, tooltip = null) {
  const span = document.createElement('span');
  span.classList.add('calendaria-enricher', `calendaria-enricher--${type}`);
  if (iconClass) span.classList.add('calendaria-enricher--badge');
  if (isLive) {
    span.classList.add('calendaria-enricher--live');
    span.dataset.calType = type;
    span.dataset.calConfig = configStr || '';
  }
  if (iconClass) {
    const icon = document.createElement('i');
    icon.className = `fa-solid ${iconClass}`;
    icon.setAttribute('inert', '');
    span.appendChild(icon);
    span.append(typeof content === 'string' ? ` ${content}` : '');
  } else if (typeof content === 'string') {
    span.textContent = content;
  }
  if (content instanceof HTMLElement) span.appendChild(content);
  if (tooltip) span.dataset.tooltip = tooltip;
  return span;
}

/**
 * Create an error enricher element.
 * @param {string} messageKey - Localization key for the error message
 * @param {object} [data] - Data for localization string interpolation
 * @returns {HTMLElement} The error span element
 */
function createErrorElement(messageKey, data = {}) {
  const span = document.createElement('span');
  span.classList.add('calendaria-enricher', 'calendaria-enricher--error');
  const message = Object.keys(data).length ? game.i18n.format(messageKey, data) : game.i18n.localize(messageKey);
  span.textContent = message;
  span.dataset.tooltip = message;
  return span;
}

/**
 * Create a clickable enricher link.
 * @param {string} type - Enricher type name
 * @param {string} text - Link label text
 * @param {object} [dataset] - Data attributes
 * @param {string} [iconClass] - FontAwesome icon class
 * @param {string|null} [tooltip] - Tooltip text
 * @param {string|null} [liveConfig] - Makes the link live-updating when set
 * @returns {HTMLAnchorElement} The content link element
 */
function createContentLink(type, text, dataset = {}, iconClass = 'fa-calendar-day', tooltip = null, liveConfig = null) {
  const anchor = document.createElement('a');
  anchor.classList.add('calendaria-enricher', `calendaria-enricher--${type}`, 'calendaria-enricher--link');
  const icon = document.createElement('i');
  icon.className = `fa-solid ${iconClass}`;
  icon.setAttribute('inert', '');
  anchor.appendChild(icon);
  anchor.append(` ${text}`);
  for (const [key, value] of Object.entries(dataset)) anchor.dataset[key] = value;
  if (tooltip) anchor.dataset.tooltip = tooltip;
  if (liveConfig != null) {
    anchor.classList.add('calendaria-enricher--live');
    anchor.dataset.calType = type;
    anchor.dataset.calConfig = liveConfig;
  }
  return anchor;
}

/**
 * Format decimal hours to HH:MM.
 * @param {number} hours - Hours as decimal
 * @returns {string} Formatted time string
 */
function formatHoursToTime(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Format a duration to compact string.
 * @param {object} duration - Duration with hours, minutes, seconds
 * @returns {string} Formatted duration string (e.g. "3h 20m")
 */
function formatDuration(duration) {
  const parts = [];
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);
  if (!parts.length) parts.push(`${duration.seconds || 0}s`);
  return parts.join(' ');
}

/**
 * Format a value as percentage.
 * @param {number} value - Value between 0 and 1
 * @returns {string} Formatted percentage (e.g. "75%")
 */
function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

/**
 * Format a day count as countdown string.
 * @param {number} days - Number of days (positive = future, negative = past)
 * @returns {string} Localized countdown string
 */
function formatCountdown(days) {
  if (days === 0) return game.i18n.localize('CALENDARIA.Common.Today');
  const abs = Math.abs(days);
  if (days > 0) return abs === 1 ? game.i18n.localize('CALENDARIA.Enricher.Label.DayUntil') : game.i18n.format('CALENDARIA.Enricher.Label.DaysUntil', { count: abs });
  return abs === 1 ? game.i18n.localize('CALENDARIA.Enricher.Label.DayAgo') : game.i18n.format('CALENDARIA.Enricher.Label.DaysAgo', { count: abs });
}

/**
 * Parse date math expression.
 * @param {string} input - Date math expression
 * @returns {Array<{amount: number, unit: string}>} Array of operations
 */
function parseDateMath(input) {
  const operations = [];
  const regex = /([+-]?\d+)([dmy])/gi;
  let match;
  while ((match = regex.exec(input)) !== null) operations.push({ amount: parseInt(match[1]), unit: match[2].toLowerCase() });
  return operations;
}

/**
 * Append a moon phase icon.
 * @param {HTMLElement} parent - Parent element to append to
 * @param {string} iconPath - SVG file path
 * @param {string|null} [color] - Hex color for tinting
 */
function appendMoonIcon(parent, iconPath, color = null) {
  if (!iconPath) return;
  const img = document.createElement('img');
  img.src = iconPath;
  img.classList.add('calendaria-enricher--moon-icon');
  if (color) {
    const wrapper = document.createElement('span');
    wrapper.classList.add('calendaria-enricher--moon-icon-wrapper', 'tinted');
    wrapper.style.setProperty('--moon-color', color);
    wrapper.appendChild(img);
    parent.appendChild(wrapper);
  } else {
    parent.appendChild(img);
  }
  parent.append(' ');
}

/**
 * Append a weather icon.
 * @param {HTMLElement} parent - Parent element to append to
 * @param {string} iconClass - FontAwesome icon class
 */
function appendWeatherIcon(parent, iconClass) {
  if (!iconClass) return;
  const i = document.createElement('i');
  i.className = `fa-solid ${iconClass}`;
  i.setAttribute('inert', '');
  parent.appendChild(i);
  parent.append(' ');
}

/**
 * Get wind speed label.
 * @param {number} speed - Wind speed on 0-5 scale
 * @returns {string} Localized wind label
 */
function getWindLabel(speed) {
  const entry = Object.values(WIND_SPEEDS).find((w) => w.value === speed);
  return game.i18n.localize(entry?.label || WIND_SPEEDS.CALM.label);
}

/**
 * Convert degrees to compass direction.
 * @param {number} degrees - Compass degrees (0-360)
 * @returns {string} Direction abbreviation (N, NNE, NE, ENE, etc.)
 */
function degreesToCompass(degrees) {
  const entries = Object.entries(COMPASS_DIRECTIONS);
  let closest = entries[0];
  let minDiff = 360;
  for (const [id, deg] of entries) {
    const diff = Math.abs(((degrees - deg + 540) % 360) - 180);
    if (diff < minDiff) {
      minDiff = diff;
      closest = [id, deg];
    }
  }
  return closest[0];
}

/**
 * Date enricher.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichDate(config, label) {
  const { calendar, components } = resolveCalendar(config);
  if (config.approx) {
    const formatted = formatDate(null, 'approxDate', calendar);
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.TimeOfYear', { value: formatted });
    return createElement('date', label || formatted, 'approx=true', true, 'fa-calendar', tooltip);
  }
  if (config.time) {
    const formatted = formatDate(null, 'datetime24', calendar);
    const current = getCurrentDateTime(calendar, components);
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.CurrentDateTime', { value: formatted });
    return createContentLink('date', label || formatted, { calYear: current.year, calMonth: current.month, calDay: current.day }, 'fa-calendar-days', tooltip, 'time=true');
  }
  if (config.values.length > 0) {
    const date = parseDateFromValues(config.values);
    if (!date) return createErrorElement('CALENDARIA.Enricher.Error.InvalidDate');
    const formatted = formatDate(date, config.format || 'dateLong', calendar);
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Date', { value: formatted });
    return createContentLink('date', label || formatted, { calYear: date.year, calMonth: date.month, calDay: date.day }, 'fa-calendar', tooltip);
  }
  const preset = config.format || 'dateLong';
  const formatted = formatDate(null, preset, calendar);
  const current = getCurrentDateTime(calendar, components);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.CurrentDate', { value: formatted });
  return createContentLink('date', label || formatted, { calYear: current.year, calMonth: current.month, calDay: current.day }, 'fa-calendar', tooltip, `format=${preset}`);
}

/**
 * Time enricher.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichTime(config, label) {
  const { calendar } = resolveCalendar(config);
  if (config.approx) {
    const formatted = formatDate(null, 'approxTime', calendar);
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.TimeOfDay', { value: formatted });
    return createElement('time', label || formatted, 'approx=true', true, 'fa-clock', tooltip);
  }
  const preset = config['12h'] ? 'time12' : 'time24';
  const formatted = formatDate(null, preset, calendar);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.CurrentTime', { value: formatted });
  const configStr = config['12h'] ? '12h=true' : '';
  return createElement('time', label || formatted, configStr, true, 'fa-clock', tooltip);
}

/**
 * Current weekday name.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichWeekday(config, label) {
  const { calendar } = resolveCalendar(config);
  const weekday = calendar?.getWeekdayForDate?.();
  if (!weekday) return createErrorElement('CALENDARIA.Enricher.Error.NoCalendar');
  const text = label || weekday.name;
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Weekday', { value: weekday.name });
  return createElement('weekday', text, '', true, 'fa-calendar-week', tooltip);
}

/**
 * Current season name.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichSeason(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const season = calendar?.getCurrentSeason?.(components);
  if (!season) return createErrorElement('CALENDARIA.Enricher.Error.NoSeasons');
  const name = game.i18n.localize(season.name);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Season', { value: name });
  return createElement('season', label || name, '', true, season.icon || 'fa-leaf', tooltip);
}

/**
 * Current era name.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichEra(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const eras = calendar?.erasArray || [];
  if (!eras.length) return createErrorElement('CALENDARIA.Enricher.Error.NoEras');
  const current = getCurrentDateTime(calendar, components);
  const match = eras.find((e) => current.year >= e.startYear && (e.endYear == null || current.year <= e.endYear));
  if (!match) return createErrorElement('CALENDARIA.Enricher.Error.NoEras');
  const name = game.i18n.localize(match.name);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Era', { value: name });
  return createElement('era', label || name, '', true, 'fa-landmark', tooltip);
}

/**
 * Current cycle values.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichCycle(config, label) {
  const { calendar } = resolveCalendar(config);
  const result = calendar?.getCycleValues();
  if (!result) return createErrorElement('CALENDARIA.Enricher.Error.NoCycles');
  const text = result.values.map((v) => game.i18n.localize(v.entryName)).join(', ');
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Cycle', { value: text });
  return createElement('cycle', label || text, '', true, 'fa-rotate', tooltip);
}

/**
 * Current festival.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichFestival(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const festival = calendar?.findFestivalDay?.();
  if (!festival) {
    const text = label || game.i18n.localize('CALENDARIA.Enricher.Label.NoFestival');
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Festival', { value: game.i18n.localize('CALENDARIA.Enricher.Label.NoFestival') });
    return createElement('festival', text, '', true, 'fa-champagne-glasses', tooltip);
  }
  const name = game.i18n.localize(festival.name);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Festival', { value: name });
  const notes = searchNotes(name);
  const festivalNote = notes.find((n) => n.flagData?.linkedFestival);
  if (festivalNote) return createContentLink('festival', label || name, { calPageId: festivalNote.id }, 'fa-champagne-glasses', tooltip, '');
  const current = getCurrentDateTime(calendar, components);
  return createContentLink('festival', label || name, { calYear: current.year, calMonth: current.month, calDay: current.day }, 'fa-champagne-glasses', tooltip, '');
}

/**
 * Rest day or work day.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichRestDay(config, label) {
  const { calendar } = resolveCalendar(config);
  const weekday = calendar?.getWeekdayForDate?.();
  const isRest = weekday?.isRestDay ?? false;
  const key = isRest ? 'CALENDARIA.Common.RestDay' : 'CALENDARIA.Enricher.Label.WorkDay';
  const text = game.i18n.localize(key);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.DayType', { value: text });
  return createElement('restday', label || text, '', true, 'fa-couch', tooltip);
}

/**
 * Countdown to a date.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichCountdown(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const target = parseDateFromValues(config.values);
  if (!target) return createErrorElement('CALENDARIA.Enricher.Error.InvalidDate');
  const current = getCurrentDateTime(calendar, components);
  const days = daysBetween(toInternal(current), toInternal(target));
  const abs = Math.abs(days);
  const unit = abs === 1 ? game.i18n.localize('CALENDARIA.Common.UnitDay') : game.i18n.localize('CALENDARIA.Common.UnitDays');
  const text = label || formatCountdown(days);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Countdown', { date: formatDate(target, 'dateLong', calendar), value: `${abs} ${unit}` });
  return createContentLink('countdown', text, { calYear: target.year, calMonth: target.month, calDay: target.day }, 'fa-hourglass-half', tooltip, config.raw);
}

/**
 * Count up from a date.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichCountup(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const target = parseDateFromValues(config.values);
  if (!target) return createErrorElement('CALENDARIA.Enricher.Error.InvalidDate');
  let endDate, endComponents;
  const isStatic = config.to != null;
  if (isStatic) {
    const toValues = String(config.to).split(/\s+/);
    endDate = parseDateFromValues(toValues);
    if (!endDate) return createErrorElement('CALENDARIA.Enricher.Error.InvalidDate');
    endComponents = toInternal(endDate);
  } else {
    endDate = getCurrentDateTime(calendar, components);
    endComponents = components;
  }
  if (config.relative) {
    const yearZero = calendar?.years?.yearZero ?? 0;
    const text = timeSince({ year: target.year - yearZero, month: target.month - 1, dayOfMonth: target.day - 1 }, endComponents, !!config.simple);
    const sinceDays = Math.abs(daysBetween(toInternal(target), toInternal(endDate)));
    const sinceUnit = sinceDays === 1 ? game.i18n.localize('CALENDARIA.Common.UnitDay') : game.i18n.localize('CALENDARIA.Common.UnitDays');
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.TimeSince', { date: formatDate(target, 'dateLong', calendar), value: `${sinceDays} ${sinceUnit}` });
    return createContentLink('countup', label || text, { calYear: target.year, calMonth: target.month, calDay: target.day }, 'fa-hourglass-half', tooltip, isStatic ? null : config.raw);
  }
  const days = daysBetween(toInternal(target), toInternal(endDate));
  const abs = Math.abs(days);
  const unit = abs === 1 ? game.i18n.localize('CALENDARIA.Common.UnitDay') : game.i18n.localize('CALENDARIA.Common.UnitDays');
  const text = label || (config.simple ? String(abs) : `${abs} ${unit}`);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.TimeSince', { date: formatDate(target, 'dateLong', calendar), value: `${abs} ${unit}` });
  return createContentLink('countup', text, { calYear: target.year, calMonth: target.month, calDay: target.day }, 'fa-hourglass-half', tooltip, isStatic ? null : config.raw);
}

/**
 * Distance between two dates.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichBetween(config, label) {
  const { calendar } = resolveCalendar(config);
  const dates = parseTwoDates(config.values);
  if (!dates) return createErrorElement('CALENDARIA.Enricher.Error.InvalidDate');
  const useMonths = config.unit === 'months';
  if (useMonths) {
    const months = Math.abs(monthsBetween(toInternal(dates.date1), toInternal(dates.date2)));
    const unit = months === 1 ? game.i18n.localize('CALENDARIA.Common.UnitMonth') : game.i18n.localize('CALENDARIA.Common.UnitMonths');
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.DaysBetween', {
      value: `${months} ${unit}`,
      from: formatDate(dates.date1, 'dateLong', calendar),
      to: formatDate(dates.date2, 'dateLong', calendar)
    });
    return createElement('between', label || `${months} ${unit}`, null, false, 'fa-ruler-horizontal', tooltip);
  }
  const days = Math.abs(daysBetween(toInternal(dates.date1), toInternal(dates.date2)));
  const unit = days === 1 ? game.i18n.localize('CALENDARIA.Common.UnitDay') : game.i18n.localize('CALENDARIA.Common.UnitDays');
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.DaysBetween', {
    value: `${days} ${unit}`,
    from: formatDate(dates.date1, 'dateLong', calendar),
    to: formatDate(dates.date2, 'dateLong', calendar)
  });
  return createElement('between', label || `${days} ${unit}`, null, false, 'fa-ruler-horizontal', tooltip);
}

/**
 * Time until an event.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichTimeUntil(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const target = config.values[0]?.toLowerCase();
  const result = resolveTimeUntilTarget(target, calendar, components);
  if (!result) return createErrorElement('CALENDARIA.Enricher.Error.InvalidConfig');
  if (config.hours) {
    const parts = [];
    if (result.hours) parts.push(`${result.hours}h`);
    if (result.minutes) parts.push(`${result.minutes}m`);
    const text = parts.length ? parts.join(' ') : '0m';
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.TimeUntil', { target, value: text });
    return createElement('timeuntil', label || text, config.raw, true, 'fa-hourglass-half', tooltip);
  }
  const text = formatDuration(result);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.TimeUntil', { target, value: text });
  return createElement('timeuntil', label || text, config.raw, true, 'fa-hourglass-half', tooltip);
}

/**
 * Date arithmetic.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichDateMath(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const ops = parseDateMath(config.raw);
  if (!ops.length) return createErrorElement('CALENDARIA.Enricher.Error.InvalidMath', { input: config.raw });
  let date = getCurrentDateTime(calendar, components);
  for (const op of ops) {
    switch (op.unit) {
      case 'd':
        date = toPublic(addDays(toInternal(date), op.amount));
        break;
      case 'm':
        date = toPublic(addMonths(toInternal(date), op.amount));
        break;
      case 'y':
        date = toPublic(addYears(toInternal(date), op.amount));
        break;
    }
  }
  const formatted = formatDate(date, 'dateLong', calendar);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.DateMath', { expr: config.raw, value: formatted });
  return createContentLink('datemath', label || formatted, { calYear: date.year, calMonth: date.month, calDay: date.day }, 'fa-calculator', tooltip, config.raw);
}

/**
 * Split values on "to" into two dates.
 * @param {string[]} values - Array of value tokens
 * @returns {object|null} Parsed date pair or null
 */
function parseTwoDates(values) {
  const toIndex = values.indexOf('to');
  if (toIndex < 0) return null;
  const date1 = parseDateFromValues(values.slice(0, toIndex));
  const date2 = parseDateFromValues(values.slice(toIndex + 1));
  return date1 && date2 ? { date1, date2 } : null;
}

/**
 * Compute time until a named target.
 * @param {string} target - Target keyword (sunrise, sunset, midnight, midday)
 * @param {object} calendar - Resolved calendar instance
 * @param {object} components - Time components from the calendar
 * @returns {object|null} Time result or null
 */
function resolveTimeUntilTarget(target, calendar, components) {
  if (!calendar) return null;
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  let targetHour;
  switch (target) {
    case 'sunrise':
      targetHour = calendar.sunrise?.(undefined, zone);
      break;
    case 'sunset':
      targetHour = calendar.sunset?.(undefined, zone);
      break;
    case 'midnight':
      targetHour = 0;
      break;
    case 'midday':
      targetHour = (calendar.days?.hoursPerDay ?? 24) / 2;
      break;
    default:
      return null;
  }
  if (targetHour == null) return null;
  const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
  const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
  const currentHour = components.hour + components.minute / minutesPerHour + components.second / (minutesPerHour * secondsPerMinute);
  const hoursUntil = currentHour < targetHour ? targetHour - currentHour : hoursPerDay - currentHour + targetHour;
  const hours = Math.floor(hoursUntil);
  const remainingMinutes = (hoursUntil - hours) * minutesPerHour;
  const minutes = Math.floor(remainingMinutes);
  const seconds = Math.floor((remainingMinutes - minutes) * secondsPerMinute);
  return { hours, minutes, seconds };
}

/**
 * Calendar name.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichCalName(config, label) {
  const { calendar } = resolveCalendar(config);
  if (!calendar) return createErrorElement('CALENDARIA.Enricher.Error.NoCalendar');
  const name = calendar.metadata?.name || calendar.name || '';
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Calendar', { value: name });
  return createElement('calname', label || name, null, false, 'fa-book', tooltip);
}

/**
 * Current month name.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichMonth(config, label) {
  const { calendar, components } = resolveCalendar(config);
  if (!calendar) return createErrorElement('CALENDARIA.Enricher.Error.NoCalendar');
  const current = getCurrentDateTime(calendar, components);
  const months = calendar.monthsArray || [];
  const monthData = months[current.month - 1];
  const name = monthData ? game.i18n.localize(monthData.name) : '';
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.CurrentMonth', { value: name });
  return createElement('month', label || name, '', true, 'fa-calendar', tooltip);
}

/**
 * Current year.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichYear(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const current = getCurrentDateTime(calendar, components);
  const text = String(current.year);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.CurrentYear', { value: text });
  return createElement('year', label || text, '', true, 'fa-calendar', tooltip);
}

/**
 * Day of year.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichDayOfYear(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const dayOfYear = getDayOfYear(calendar, components);
  if (dayOfYear == null) return createErrorElement('CALENDARIA.Enricher.Error.NoCalendar');
  const text = String(dayOfYear);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.DayOfYear', { value: text });
  return createElement('dayofyear', label || text, '', true, 'fa-calendar', tooltip);
}

/**
 * Year progress bar.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichYearProgress(config, label) {
  const { calendar, components } = resolveCalendar(config);
  if (!calendar) return createErrorElement('CALENDARIA.Enricher.Error.NoCalendar');
  const current = getCurrentDateTime(calendar, components);
  const yearZero = calendar.years?.yearZero ?? 0;
  const daysInYear = calendar.getDaysInYear?.(current.year - yearZero) ?? 365;
  const dayOfYear = getDayOfYear(calendar, components);
  const progress = (dayOfYear ?? 1) / daysInYear;
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.YearProgress', { value: formatPercent(progress) });
  if (label) return createElement('yearprogress', label, '', true, null, tooltip);
  const el = createProgressElement('yearprogress', progress);
  el.dataset.tooltip = tooltip;
  return el;
}

/**
 * Leap year status.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichLeapYear(config, label) {
  const { calendar, components } = resolveCalendar(config);
  if (!calendar) return createErrorElement('CALENDARIA.Enricher.Error.NoCalendar');
  const current = getCurrentDateTime(calendar, components);
  const yearZero = calendar.years?.yearZero ?? 0;
  const isLeap = calendar.isLeapYear?.(current.year - yearZero) ?? false;
  const key = isLeap ? 'CALENDARIA.Editor.Section.LeapYear' : 'CALENDARIA.Enricher.Label.NotLeapYear';
  const text = game.i18n.localize(key);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.LeapYear', { value: text });
  return createElement('leapyear', label || text, '', true, 'fa-calendar', tooltip);
}

/**
 * Intercalary month status.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichIntercalary(config, label) {
  const { calendar, components } = resolveCalendar(config);
  if (!calendar) return createErrorElement('CALENDARIA.Enricher.Error.NoCalendar');
  const current = getCurrentDateTime(calendar, components);
  const months = calendar.monthsArray || [];
  const monthData = months[current.month - 1];
  const isIntercalary = monthData?.type === 'intercalary';
  const key = isIntercalary ? 'CALENDARIA.Editor.MonthType.Intercalary' : 'CALENDARIA.Common.Standard';
  const text = game.i18n.localize(key);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.MonthType', { value: text });
  return createElement('intercalary', label || text, '', true, 'fa-calendar', tooltip);
}

/**
 * Days in year.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichDaysInYear(config, label) {
  const { calendar, components } = resolveCalendar(config);
  if (!calendar) return createErrorElement('CALENDARIA.Enricher.Error.NoCalendar');
  const current = getCurrentDateTime(calendar, components);
  const yearZero = calendar.years?.yearZero ?? 0;
  const days = calendar.getDaysInYear?.(current.year - yearZero) ?? 365;
  const text = String(days);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.DaysInYear', { value: text });
  return createElement('daysinyear', label || text, null, false, 'fa-calendar', tooltip);
}

/**
 * Calculate day-of-year.
 * @param {object} calendar - Resolved calendar instance
 * @param {object} components - Time components from the calendar
 * @returns {number|null} Day of year or null if no calendar
 */
function getDayOfYear(calendar, components) {
  if (!calendar) return null;
  const current = getCurrentDateTime(calendar, components);
  const yearZero = calendar.years?.yearZero ?? 0;
  const months = calendar.monthsArray || [];
  let dayOfYear = 0;
  for (let m = 0; m < current.month - 1; m++) dayOfYear += calendar.getDaysInMonth?.(m, current.year - yearZero) ?? (months[m]?.days || 30);
  dayOfYear += current.day;
  return dayOfYear;
}

/**
 * Create progress bar element.
 * @param {string} type - Enricher type identifier
 * @param {number} progress - Progress value between 0 and 1
 * @returns {HTMLElement} Progress bar element
 */
function createProgressElement(type, progress) {
  const clamped = Math.min(1, Math.max(0, progress));
  const span = document.createElement('span');
  span.classList.add('calendaria-enricher', `calendaria-enricher--${type}`, 'calendaria-enricher--progress', 'calendaria-enricher--live');
  span.dataset.calType = type;
  span.dataset.calConfig = '';
  const bar = document.createElement('span');
  bar.classList.add('calendaria-enricher--progress-bar');
  const fill = document.createElement('span');
  fill.classList.add('calendaria-enricher--progress-fill');
  fill.style.width = formatPercent(clamped);
  bar.appendChild(fill);
  span.appendChild(bar);
  const text = document.createElement('span');
  text.textContent = formatPercent(progress);
  span.appendChild(text);
  return span;
}

/**
 * Sunrise time.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichSunrise(config, label) {
  const { calendar } = resolveCalendar(config);
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const sunrise = calendar?.sunrise(undefined, zone);
  if (sunrise == null) return createErrorElement('CALENDARIA.Enricher.Error.NoSunData');
  const text = formatHoursToTime(sunrise);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Sunrise', { value: text });
  return createElement('sunrise', label || text, '', true, 'fa-sun', tooltip);
}

/**
 * Sunset time.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichSunset(config, label) {
  const { calendar } = resolveCalendar(config);
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const sunset = calendar?.sunset(undefined, zone);
  if (sunset == null) return createErrorElement('CALENDARIA.Enricher.Error.NoSunData');
  const text = formatHoursToTime(sunset);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Sunset', { value: text });
  return createElement('sunset', label || text, '', true, 'fa-sun', tooltip);
}

/**
 * Hours of daylight.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichDaylight(config, label) {
  const { calendar } = resolveCalendar(config);
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const hours = calendar?.daylightHours(undefined, zone);
  if (hours == null) return createErrorElement('CALENDARIA.Enricher.Error.NoSunData');
  const text = `${hours.toFixed(1)}h`;
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.DaylightHours', { value: text });
  return createElement('daylight', label || text, '', true, 'fa-sun', tooltip);
}

/**
 * Daytime or nighttime.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichIsDaytime(config, label) {
  const { calendar, components } = resolveCalendar(config);
  if (!calendar) return createErrorElement('CALENDARIA.Enricher.Error.NoSunData');
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const sunrise = calendar.sunrise(undefined, zone);
  const sunset = calendar.sunset(undefined, zone);
  let isDaytime = true;
  if (sunrise != null && sunset != null) {
    const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
    const currentHour = components.hour + components.minute / minutesPerHour;
    isDaytime = currentHour >= sunrise && currentHour < sunset;
  }
  const key = isDaytime ? 'CALENDARIA.Enricher.Label.Daytime' : 'CALENDARIA.Enricher.Label.Nighttime';
  const text = game.i18n.localize(key);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.TimeOfDay', { value: text });
  return createElement('isdaytime', label || text, '', true, 'fa-sun', tooltip);
}

/**
 * Day progress percentage.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichDayProgress(config, label) {
  const { calendar } = resolveCalendar(config);
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const progress = calendar?.progressDay(undefined, zone);
  if (progress == null) return createErrorElement('CALENDARIA.Enricher.Error.NoSunData');
  const text = formatPercent(Math.min(1, Math.max(0, progress)));
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.DayProgress', { value: text });
  return createElement('dayprogress', label || text, '', true, 'fa-sun', tooltip);
}

/**
 * Night progress percentage.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichNightProgress(config, label) {
  const { calendar } = resolveCalendar(config);
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const progress = calendar?.progressNight(undefined, zone);
  if (progress == null) return createErrorElement('CALENDARIA.Enricher.Error.NoSunData');
  const text = formatPercent(Math.min(1, Math.max(0, progress)));
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.NightProgress', { value: text });
  return createElement('nightprogress', label || text, '', true, 'fa-moon', tooltip);
}

/**
 * Time until sunrise.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichUntilSunrise(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const result = resolveTimeUntilTarget('sunrise', calendar, components);
  if (!result) return createErrorElement('CALENDARIA.Enricher.Error.NoSunData');
  const text = formatDuration(result);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.TimeUntilSunrise', { value: text });
  return createElement('untilsunrise', label || text, '', true, 'fa-sun', tooltip);
}

/**
 * Time until sunset.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichUntilSunset(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const result = resolveTimeUntilTarget('sunset', calendar, components);
  if (!result) return createErrorElement('CALENDARIA.Enricher.Error.NoSunData');
  const text = formatDuration(result);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.TimeUntilSunset', { value: text });
  return createElement('untilsunset', label || text, '', true, 'fa-sun', tooltip);
}

/**
 * Moon phase enricher.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichMoon(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const moonIndex = config.values.length > 0 && !isNaN(config.values[0]) ? parseInt(config.values[0]) : 0;
  if (config.position) {
    const moonsArr = calendar?.moonsArray || [];
    if (!moonsArr.length) return createErrorElement('CALENDARIA.Enricher.Error.NoMoons');
    const moon = moonsArr[moonIndex];
    if (!moon) return createErrorElement('CALENDARIA.Enricher.Error.MoonNotFound', { index: moonIndex });
    const position = getMoonPhasePosition(moon, components);
    const text = formatPercent(position);
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.MoonCyclePosition', { value: text });
    return createElement('moon', label || text, config.raw || '', true, 'fa-moon', tooltip);
  }
  if (config.cycleday) {
    const moon = calendar?.getMoonPhase?.(moonIndex);
    if (!moon) return createErrorElement('CALENDARIA.Enricher.Error.NoMoons');
    const text = String(moon.dayInCycle ?? '');
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.MoonCycleDay', { value: text });
    return createElement('moon', label || text, config.raw || '', true, 'fa-moon', tooltip);
  }
  if (config.isfull) {
    const moonsArr = calendar?.moonsArray || [];
    if (!moonsArr.length) return createErrorElement('CALENDARIA.Enricher.Error.NoMoons');
    const moon = moonsArr[moonIndex];
    if (!moon) return createErrorElement('CALENDARIA.Enricher.Error.MoonNotFound', { index: moonIndex });
    const isFull = isMoonFull(moon, components);
    const key = isFull ? 'CALENDARIA.MoonPhase.FullMoon' : 'CALENDARIA.Enricher.Label.NotFullMoon';
    const text = game.i18n.localize(key);
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.FullMoon', { value: text });
    return createElement('moon', label || text, config.raw || '', true, 'fa-moon', tooltip);
  }
  const moon = calendar?.getMoonPhase?.(moonIndex);
  if (!moon) return createErrorElement('CALENDARIA.Enricher.Error.NoMoons');
  const moonDef = calendar?.moonsArray?.[moonIndex];
  const phaseName = game.i18n.localize(moon.name);
  const span = createElement('moon', '', config.raw || '', true);
  span.classList.add('calendaria-enricher--badge');
  appendMoonIcon(span, moon.icon, moonDef?.color);
  if (!config.icon) span.append(label || phaseName);
  else if (label) span.append(label);
  span.dataset.tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.MoonPhase', { value: phaseName });
  return span;
}

/**
 * All moon phases.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichMoons(config, label) {
  const { calendar } = resolveCalendar(config);
  const moons = calendar?.getAllMoonPhases?.();
  if (!moons?.length) return createErrorElement('CALENDARIA.Enricher.Error.NoMoons');
  const text = moons
    .map((m) => {
      const moonName = m.moonName ? game.i18n.localize(m.moonName) : m.name ? game.i18n.localize(m.name) : '';
      const phaseName = m.phaseName ? game.i18n.localize(m.phaseName) : m.name ? game.i18n.localize(m.name) : '';
      return moonName !== phaseName ? `${moonName}: ${phaseName}` : phaseName;
    })
    .join(', ');
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.MoonPhases', { value: text });
  return createElement('moons', label || text, '', true, 'fa-moon', tooltip);
}

/**
 * Next full moon.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichNextFullMoon(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const moonsArr = calendar?.moonsArray || [];
  if (!moonsArr.length) return createErrorElement('CALENDARIA.Enricher.Error.NoMoons');
  const isCountdown = config.values.some((v) => v.toLowerCase() === 'countdown');
  const moonIdxVal = config.values.find((v) => !isNaN(v));
  const moonIndex = moonIdxVal != null ? parseInt(moonIdxVal) : 0;
  const targetMoon = moonsArr[moonIndex];
  if (!targetMoon) return createErrorElement('CALENDARIA.Enricher.Error.MoonNotFound', { index: moonIndex });
  const nextFull = getNextFullMoon(targetMoon, components);
  if (!nextFull) return createErrorElement('CALENDARIA.Common.NoConvergence');
  const nextDate = internalToPublic(nextFull, calendar);
  if (isCountdown) {
    const current = getCurrentDateTime(calendar, components);
    const days = daysBetween(toInternal(current), toInternal(nextDate));
    const text = formatCountdown(days);
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.NextFullMoon', { value: text });
    return createElement('nextfullmoon', label || text, config.raw, true, 'fa-moon', tooltip);
  }
  const dateText = formatDate(nextDate, 'dateLong', calendar);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.NextFullMoon', { value: dateText });
  return createContentLink('nextfullmoon', label || dateText, { calYear: nextDate.year, calMonth: nextDate.month, calDay: nextDate.day }, 'fa-moon', tooltip, config.raw);
}

/**
 * Next moon convergence.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichConvergence(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const moonsArr = calendar?.moonsArray || [];
  if (moonsArr.length < 2) return createErrorElement('CALENDARIA.Enricher.Error.NoMoons');
  const result = getNextConvergence(moonsArr, components);
  const moonNames = moonsArr.map((m) => game.i18n.localize(m.name)).join(', ');
  if (!result) {
    const noText = game.i18n.localize('CALENDARIA.Common.NoConvergence');
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.NextConvergence', { moons: moonNames, phase: '', date: noText });
    return createElement('convergence', label || noText, '', true, 'fa-moon', tooltip);
  }
  const date = internalToPublic(result, calendar);
  const dateText = formatDate(date, 'dateLong', calendar);
  const fullMoonLabel = game.i18n.localize('CALENDARIA.MoonPhase.FullMoon');
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.NextConvergence', { moons: moonNames, phase: fullMoonLabel, date: dateText });
  return createContentLink('convergence', label || dateText, { calYear: date.year, calMonth: date.month, calDay: date.day }, 'fa-moon', tooltip, '');
}

/**
 * Current eclipse status.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichEclipse(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const moonsArr = calendar?.moonsArray || [];
  if (!moonsArr.length) return createErrorElement('CALENDARIA.Enricher.Error.NoMoons');
  const moonIdxVal = config.values.find((v) => !isNaN(v));
  const moonIndex = moonIdxVal != null ? parseInt(moonIdxVal) : 0;
  const targetMoon = moonsArr[moonIndex];
  if (!targetMoon) return createErrorElement('CALENDARIA.Enricher.Error.MoonNotFound', { index: moonIndex });
  const result = getEclipseAtDate(targetMoon, components, calendar);
  const text = result.type ? game.i18n.localize(ECLIPSE_TYPE_LABELS[result.type] ?? result.type) : game.i18n.localize('CALENDARIA.Eclipse.None');
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Eclipse', { value: text });
  return createElement('eclipse', label || text, config.raw, true, 'fa-sun', tooltip);
}

/**
 * Next eclipse date.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichNextEclipse(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const moonsArr = calendar?.moonsArray || [];
  if (!moonsArr.length) return createErrorElement('CALENDARIA.Enricher.Error.NoMoons');
  const isCountdown = config.values.some((v) => v.toLowerCase() === 'countdown');
  const moonIdxVal = config.values.find((v) => !isNaN(v));
  const moonIndex = moonIdxVal != null ? parseInt(moonIdxVal) : 0;
  const targetMoon = moonsArr[moonIndex];
  if (!targetMoon) return createErrorElement('CALENDARIA.Enricher.Error.MoonNotFound', { index: moonIndex });
  const result = getNextEclipse(targetMoon, components, { calendar });
  if (!result) return createErrorElement('CALENDARIA.Enricher.Error.NoEclipseFound');
  const nextDate = internalToPublic(result.date, calendar);
  const typeLabel = game.i18n.localize(ECLIPSE_TYPE_LABELS[result.type] ?? result.type);
  if (isCountdown) {
    const current = getCurrentDateTime(calendar, components);
    const days = daysBetween(toInternal(current), toInternal(nextDate));
    const text = formatCountdown(days);
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.NextEclipse', { type: typeLabel, value: text });
    return createElement('nexteclipse', label || text, config.raw, true, 'fa-sun', tooltip);
  }
  const dateText = formatDate(nextDate, 'dateLong', calendar);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.NextEclipse', { type: typeLabel, value: dateText });
  return createContentLink('nexteclipse', label || dateText, { calYear: nextDate.year, calMonth: nextDate.month, calDay: nextDate.day }, 'fa-sun', tooltip, config.raw);
}

/**
 * Current weather.
 * @param {object} _config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichWeather(_config, label) {
  const weather = WeatherManager.getCurrentWeather();
  if (!weather) return createErrorElement('CALENDARIA.Enricher.Error.NoWeather');
  const weatherLabel = game.i18n.localize(weather.label);
  const span = createElement('weather', '', '', true);
  span.classList.add('calendaria-enricher--badge');
  appendWeatherIcon(span, weather.icon);
  span.append(label || weatherLabel);
  span.dataset.tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Weather', { value: weatherLabel });
  return span;
}

/**
 * Current temperature.
 * @param {object} _config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichTemperature(_config, label) {
  const temp = WeatherManager.getTemperature();
  if (temp == null) return createErrorElement('CALENDARIA.Enricher.Error.NoWeather');
  const text = WeatherManager.formatTemperature(temp);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Temperature', { value: text });
  return createElement('temperature', label || text, '', true, 'fa-temperature-half', tooltip);
}

/**
 * Current wind.
 * @param {object} _config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichWind(_config, label) {
  const weather = WeatherManager.getCurrentWeather();
  if (!weather) return createErrorElement('CALENDARIA.Enricher.Error.NoWeather');
  const speedLabel = getWindLabel(weather.wind?.speed ?? 0);
  const dir = weather.wind?.direction;
  const dirLabel = dir != null ? ` ${degreesToCompass(dir)}` : '';
  const text = `${speedLabel}${dirLabel}`;
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Wind', { value: text });
  return createElement('wind', label || text, '', true, 'fa-wind', tooltip);
}

/**
 * Current precipitation.
 * @param {object} _config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichPrecipitation(_config, label) {
  const weather = WeatherManager.getCurrentWeather();
  if (!weather) return createErrorElement('CALENDARIA.Enricher.Error.NoWeather');
  const precipType = weather.precipitation?.type;
  const text = precipType ? precipType.charAt(0).toUpperCase() + precipType.slice(1) : game.i18n.localize('CALENDARIA.Common.None');
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Precipitation', { value: text });
  return createElement('precipitation', label || text, '', true, 'fa-cloud-rain', tooltip);
}

/**
 * Weather icon only.
 * @param {object} _config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichWeatherIcon(_config, label) {
  const weather = WeatherManager.getCurrentWeather();
  if (!weather) return createErrorElement('CALENDARIA.Enricher.Error.NoWeather');
  const span = createElement('weathericon', '', '', true);
  span.classList.add('calendaria-enricher--badge');
  appendWeatherIcon(span, weather.icon);
  if (label) span.append(label);
  const weatherLabel = game.i18n.localize(weather.label);
  span.dataset.tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Weather', { value: weatherLabel });
  return span;
}

/**
 * Climate zone name.
 * @param {object} _config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichZone(_config, label) {
  const zone = WeatherManager.getActiveZone(null, game.scenes?.active);
  const name = zone?.name ? game.i18n.localize(zone.name) : zone?.id || '';
  if (!name) return createErrorElement('CALENDARIA.Enricher.Error.NoZone');
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.ClimateZone', { value: name });
  return createElement('zone', label || name, null, false, 'fa-globe', tooltip);
}

/**
 * Weather forecast.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichForecast(config, label) {
  const { calendar } = resolveCalendar(config);
  const days = config.values.length > 0 && !isNaN(config.values[0]) ? parseInt(config.values[0]) : 3;
  const forecast = WeatherManager.getForecast({ days });
  if (!forecast?.length) return createErrorElement('CALENDARIA.Enricher.Error.NoWeather');
  if (label) return createElement('forecast', label, '', true);
  const currentWeather = WeatherManager.getCurrentWeather();
  if (currentWeather && forecast.length > 0) {
    const today = game.time.components;
    const first = forecast[0];
    if (first.year === today.year && first.month === today.month && first.dayOfMonth === today.dayOfMonth) {
      forecast[0] = { ...first, preset: currentWeather.preset ?? first.preset, temperature: currentWeather.temperature ?? first.temperature, wind: currentWeather.wind ?? first.wind };
    }
  }
  const container = document.createElement('span');
  container.classList.add('calendaria-enricher', 'calendaria-enricher--almanac', 'calendaria-enricher--live');
  container.dataset.calType = 'forecast';
  container.dataset.calConfig = config.raw || '';
  const lines = forecast.map((entry) => {
    const date = { year: entry.year, month: (entry.month ?? 0) + 1, day: (entry.dayOfMonth ?? 0) + 1 };
    const dateStr = formatDate(date, 'dateShort', calendar);
    const weatherLabel = entry.preset?.label ? game.i18n.localize(entry.preset.label) : '';
    const temp = entry.temperature != null ? `, ${WeatherManager.formatTemperature(entry.temperature)}` : '';
    let windStr = '';
    if (entry.wind?.speed != null) {
      const dir = entry.wind.direction != null ? ` ${degreesToCompass(entry.wind.direction)}` : '';
      windStr = `, ${getWindLabel(entry.wind.speed)}${dir}`;
    }
    return `${dateStr}: ${weatherLabel}${temp}${windStr}`;
  });
  container.innerHTML = lines.map((l) => foundry.utils.escapeHTML(l)).join('<br>');
  container.dataset.tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Forecast', { days: String(forecast.length) });
  return container;
}

/**
 * Named note link.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichEvent(config, label) {
  const searchTerm = config.raw;
  if (!searchTerm) return createErrorElement('CALENDARIA.Enricher.Error.InvalidConfig');
  const notes = searchNotes(searchTerm);
  if (!notes.length) {
    const el = createElement('event', label || searchTerm, null, false);
    el.classList.add('calendaria-enricher--dimmed');
    return el;
  }
  const note = notes[0];
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Event', { value: note.name });
  return createContentLink('event', label || note.name, { calPageId: note.id }, 'fa-calendar-day', tooltip);
}

/**
 * Notes for a date.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichNotes(config, label) {
  const { calendar, components } = resolveCalendar(config);
  if (config.count) {
    const current = getCurrentDateTime(calendar, components);
    const scope = config.scope?.toLowerCase();
    let count;
    if (scope === 'month') {
      const yearZero = calendar?.years?.yearZero ?? 0;
      const internalMonth = current.month - 1;
      const daysInMonth = calendar?.getDaysInMonth(internalMonth, current.year - yearZero) ?? 30;
      count = NoteManager.getNotesInRange({ year: current.year, month: internalMonth, dayOfMonth: 0 }, { year: current.year, month: internalMonth, dayOfMonth: daysInMonth - 1 }).length;
    } else count = NoteManager.getNotesForDate(current.year, current.month - 1, current.day - 1).length;
    let text;
    if (count === 0) text = game.i18n.localize('CALENDARIA.Enricher.Label.NoNotes');
    else if (count === 1) text = game.i18n.localize('CALENDARIA.Enricher.Label.NoteCountOne');
    else text = game.i18n.format('CALENDARIA.Enricher.Label.NoteCount', { count });
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.NoteCount', { value: text });
    const configStr = scope ? `count=true scope=${scope}` : 'count=true';
    if (label) return createElement('notes', label, configStr, true, 'fa-note-sticky', tooltip);
    return createElement('notes', text, configStr, true, 'fa-note-sticky', tooltip);
  }
  let notes;
  let isLive = false;
  if (config.values.length > 0) {
    const date = parseDateFromValues(config.values);
    if (!date) return createErrorElement('CALENDARIA.Enricher.Error.InvalidDate');
    notes = NoteManager.getNotesForDate(date.year, date.month - 1, date.day - 1);
  } else {
    const current = getCurrentDateTime(calendar, components);
    notes = NoteManager.getNotesForDate(current.year, current.month - 1, current.day - 1);
    isLive = true;
  }
  if (!notes.length) {
    const noText = game.i18n.localize('CALENDARIA.Enricher.Label.NoNotes');
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Notes', { value: noText });
    return createElement('notes', label || noText, isLive ? '' : null, isLive, 'fa-note-sticky', tooltip);
  }
  const text = notes.map((n) => n.name).join(', ');
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Notes', { value: text });
  return createElement('notes', label || text, isLive ? '' : null, isLive, 'fa-note-sticky', tooltip);
}

/**
 * Next note occurrence.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichNext(config, label) {
  const { calendar, components } = resolveCalendar(config);
  let searchTerm = config.raw;
  let countdown = false;
  if (config.values.length > 1 && config.values[config.values.length - 1].toLowerCase() === 'countdown') {
    countdown = true;
    searchTerm = config.values.slice(0, -1).join(' ');
  }
  const notes = searchNotes(searchTerm);
  if (!notes.length) return createErrorElement('CALENDARIA.Enricher.Error.NoteNotFound', { name: searchTerm });
  const note = notes[0];
  const stub = NoteManager.getNote(note.id);
  const current = getCurrentDateTime(calendar, components);
  const fromDate = { year: current.year, month: current.month - 1, dayOfMonth: current.day - 1 };
  const nextOccs = stub ? getNextOccurrences(stub.flagData, fromDate, 1).map(toPublic) : [];
  if (!nextOccs?.length) return createElement('next', label || note.name, config.raw, true, 'fa-calendar-day');
  const nextDate = nextOccs[0];
  if (countdown) {
    const days = daysBetween(toInternal(current), toInternal(nextDate));
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.NextOccurrenceCountdown', { name: note.name, value: formatCountdown(days) });
    return createElement('next', label || formatCountdown(days), config.raw, true, 'fa-hourglass-half', tooltip);
  }
  const dateText = formatDate(nextDate, 'dateLong', calendar);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.NextOccurrence', { name: note.name, date: dateText });
  return createContentLink('event', label || dateText, { calPageId: note.id }, 'fa-calendar-day', tooltip);
}

/**
 * Notes by category.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichCategory(config, label) {
  const presetId = config.raw;
  if (!presetId) return createErrorElement('CALENDARIA.Enricher.Error.InvalidConfig');
  const presets = NoteManager.getPresetDefinitions();
  const preset = presets.find((p) => p.id === presetId);
  const iconClass = preset?.icon?.replace('fas ', '') || 'fa-tag';
  const presetLabel = preset?.label || presetId;
  const notes = NoteManager.getNotesByPreset(presetId);
  if (!notes.length) {
    const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Category', { preset: presetLabel, count: '0' });
    return createElement('category', label || game.i18n.localize('CALENDARIA.Enricher.Label.NoNotes'), null, false, iconClass, tooltip);
  }
  const text = notes.map((n) => n.name).join(', ');
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Category', { preset: presetLabel, count: String(notes.length) });
  return createElement('category', label || text, null, false, iconClass, tooltip);
}

/**
 * Chronicle range link — opens Chronicle locked to the date range on click.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichChronicle(config, label) {
  const { calendar } = resolveCalendar(config);
  if (!calendar) return createErrorElement('CALENDARIA.Enricher.Error.NoCalendar');
  const dates = parseTwoDates(config.values);
  if (!dates) return createErrorElement('CALENDARIA.Enricher.Error.InvalidDate');
  const { date1: startPublic, date2: endPublic } = dates;
  const startText = formatDate(startPublic, 'dateLong', calendar);
  const endText = formatDate(endPublic, 'dateLong', calendar);
  const text = label || `${startText} - ${endText}`;
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.Chronicle', { start: startText, end: endText });
  const dataset = {
    calChronicleFromYear: startPublic.year,
    calChronicleFromMonth: startPublic.month - 1,
    calChronicleFromDay: startPublic.day - 1,
    calChronicleToYear: endPublic.year,
    calChronicleToMonth: endPublic.month - 1,
    calChronicleToDay: endPublic.day - 1
  };
  if (config.cal) dataset.calChronicleCalendarId = config.cal;
  return createContentLink('chronicle', text, dataset, 'fa-scroll', tooltip);
}

/**
 * Calendar summary.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichSummary(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const parts = [];
  parts.push(formatDate(null, 'dateLong', calendar));
  const weather = WeatherManager.getCurrentWeather();
  if (weather?.label) parts.push(game.i18n.localize(weather.label));
  const moon = calendar?.getCurrentMoonPhase?.(0);
  if (moon) parts.push(game.i18n.localize(moon.name));
  const text = label || parts.join(' · ');
  const current = getCurrentDateTime(calendar, components);
  const tooltip = game.i18n.localize('CALENDARIA.Enricher.Tooltip.CalendarSummary');
  return createContentLink('summary', text, { calYear: current.year, calMonth: current.month, calDay: current.day }, 'fa-calendar-days', tooltip, '');
}

/**
 * Daily almanac.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichAlmanac(config, label) {
  const { calendar, components } = resolveCalendar(config);
  if (label) return createElement('almanac', label, '', true);
  const container = document.createElement('span');
  container.classList.add('calendaria-enricher', 'calendaria-enricher--almanac', 'calendaria-enricher--live');
  container.dataset.calType = 'almanac';
  container.dataset.calConfig = '';
  const lines = [];
  lines.push(formatDate(null, 'dateFull', calendar));
  const seasonIndex = components.season ?? 0;
  const season = calendar?.seasonsArray?.[seasonIndex];
  if (season) lines.push(`${game.i18n.localize('CALENDARIA.Common.Season')}: ${game.i18n.localize(season.name)}`);
  const weather = WeatherManager.getCurrentWeather();
  if (weather) {
    const weatherLabel = game.i18n.localize(weather.label);
    const temp = WeatherManager.getTemperature();
    const tempStr = temp != null ? ` ${WeatherManager.formatTemperature(temp)}` : '';
    lines.push(`${game.i18n.localize('CALENDARIA.Common.Weather')}: ${weatherLabel}${tempStr}`);
    const windSpeed = weather.wind?.speed;
    if (windSpeed != null) {
      const windLabel = getWindLabel(windSpeed);
      const windDir = weather.wind?.direction;
      const dirStr = windDir != null ? ` ${degreesToCompass(windDir)}` : '';
      lines.push(`${game.i18n.localize('CALENDARIA.Common.Wind')}: ${windLabel}${dirStr}`);
    }
  }
  const moon = calendar?.getCurrentMoonPhase?.(0);
  if (moon) {
    const phaseName = game.i18n.localize(moon.name);
    lines.push(`${game.i18n.localize('CALENDARIA.Common.Moon')}: ${phaseName}`);
  }
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const sunrise = calendar?.sunrise(undefined, zone);
  const sunset = calendar?.sunset(undefined, zone);
  if (sunrise != null && sunset != null) {
    const srLabel = game.i18n.localize('CALENDARIA.Common.Sunrise');
    const ssLabel = game.i18n.localize('CALENDARIA.Common.Sunset');
    lines.push(`${srLabel}: ${formatHoursToTime(sunrise)} | ${ssLabel}: ${formatHoursToTime(sunset)}`);
  }
  container.innerHTML = lines.map((l) => foundry.utils.escapeHTML(l)).join('<br>');
  container.dataset.tooltip = game.i18n.localize('CALENDARIA.Enricher.Tooltip.DailyAlmanac');
  return container;
}

/**
 * Custom format string.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichFormat(config, label) {
  const { calendar } = resolveCalendar(config);
  const text = formatDate(null, config.raw, calendar);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.FormattedDate', { value: text });
  return createElement('format', label || text, config.raw, true, 'fa-calendar', tooltip);
}

/**
 * Date comparison.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichCompare(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const target = parseDateFromValues(config.values);
  if (!target) return createErrorElement('CALENDARIA.Enricher.Error.InvalidDate');
  const yearZero = calendar?.years?.yearZero ?? 0;
  const timeSinceText = timeSince({ year: target.year - yearZero, month: target.month - 1, dayOfMonth: target.day - 1 }, components);
  const days = Math.abs(daysBetween(toInternal(target), toInternal(getCurrentDateTime(calendar, components))));
  const unit = days === 1 ? game.i18n.localize('CALENDARIA.Common.UnitDay') : game.i18n.localize('CALENDARIA.Common.UnitDays');
  const text = `${timeSinceText} (${days} ${unit})`;
  const targetStr = formatDate(target, 'dateLong', calendar);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.DateComparison', { value: targetStr });
  return createContentLink('compare', label || text, { calYear: target.year, calMonth: target.month, calDay: target.day }, 'fa-scale-balanced', tooltip, config.raw);
}

/**
 * Date preview.
 * @param {object} config - Parsed enricher config
 * @param {string|null} label - Custom label override
 * @returns {HTMLElement} Enricher element
 */
function enrichPeek(config, label) {
  const { calendar, components } = resolveCalendar(config);
  const ops = parseDateMath(config.raw);
  if (!ops.length) return createErrorElement('CALENDARIA.Enricher.Error.InvalidMath', { input: config.raw });
  let date = getCurrentDateTime(calendar, components);
  for (const op of ops) {
    switch (op.unit) {
      case 'd':
        date = toPublic(addDays(toInternal(date), op.amount));
        break;
      case 'm':
        date = toPublic(addMonths(toInternal(date), op.amount));
        break;
      case 'y':
        date = toPublic(addYears(toInternal(date), op.amount));
        break;
    }
  }
  const text = formatDate(date, 'dateLong', calendar);
  const tooltip = game.i18n.format('CALENDARIA.Enricher.Tooltip.DatePreview', { expr: config.raw, value: text });
  return createContentLink('peek', label || text, { calYear: date.year, calMonth: date.month, calDay: date.day }, 'fa-calendar', tooltip);
}

/**
 * Search notes.
 * @param {string} term - Search term
 * @returns {object[]} Matching notes
 */
function searchNotes(term) {
  const lower = term.toLowerCase();
  return NoteManager.getAllNotes().filter((note) => {
    if (note.name.toLowerCase().includes(lower)) return true;
    if (note.content?.toLowerCase().includes(lower)) return true;
    return false;
  });
}

/** Batch refresh manager for live enricher elements. */
class LiveUpdateManager {
  static #debounceTimer = null;
  static #refreshFn = null;

  /**
   * Set up hooks for live refresh.
   * @param {Function} refreshFn - Callback to refresh a single element
   */
  static initialize(refreshFn) {
    this.#refreshFn = refreshFn;
    Hooks.on('updateWorldTime', () => this.scheduleRefresh());
    Hooks.on(HOOKS.CALENDAR_SWITCHED, () => this.scheduleRefresh());
    Hooks.on(HOOKS.WEATHER_CHANGE, () => this.scheduleRefresh());
  }

  /** Schedule debounced refresh. */
  static scheduleRefresh() {
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    this.#debounceTimer = setTimeout(() => this.#batchRefresh(), 100);
  }

  /** Process batch in animation frames. */
  static #batchRefresh() {
    const elements = document.querySelectorAll('.calendaria-enricher--live');
    if (!elements.length) return;
    const batch = Array.from(elements);
    let index = 0;
    const process = () => {
      const end = Math.min(index + 20, batch.length);
      for (; index < end; index++) if (batch[index].isConnected) this.#refreshFn(batch[index]);
      if (index < batch.length) requestAnimationFrame(process);
    };
    requestAnimationFrame(process);
  }
}

/**
 * Enricher dispatcher.
 * @param {object} match - Regex match result
 * @param {object} _options - Enrichment options from Foundry (unused)
 * @returns {Promise<HTMLElement|null>} Element to insert, or null to leave raw text
 */
async function enrichCalendaria(match, _options) {
  const { type, config: configStr, label } = match.groups;
  const typeLower = type.toLowerCase();
  const handler = handlers[typeLower];
  if (!handler) {
    log(2, `Unknown enricher type: ${type}`);
    return null;
  }
  if (!CalendarManager.getActiveCalendar()) return createElement(typeLower, label || '', configStr?.trim() || '', true, 'fa-spinner fa-spin');
  const config = parseConfig(configStr);
  const result = await handler(config, label);
  return label ? applyLabel(result, label) : result;
}

/**
 * Strip live attributes for custom labels.
 * @param {HTMLElement} element - Enricher element to modify
 * @param {string} _label - Custom label (unused)
 * @returns {HTMLElement|null} Modified element or null
 */
function applyLabel(element, _label) {
  if (!element) return null;
  element.classList.remove('calendaria-enricher--live');
  delete element.dataset.calType;
  delete element.dataset.calConfig;
  return element;
}

/**
 * Refresh a live enricher element.
 * @param {HTMLElement} el - The element to refresh
 */
function refreshElement(el) {
  if (!CalendarManager.getActiveCalendar()) return;
  const type = el.dataset.calType;
  const configStr = el.dataset.calConfig || '';
  const handler = handlers[type];
  if (!handler) return;
  const config = parseConfig(configStr);
  const newEl = handler(config, null);
  if (!newEl) return;
  if (!newEl.classList.contains('calendaria-enricher--live')) newEl.classList.add('calendaria-enricher--live');
  newEl.dataset.calType = type;
  newEl.dataset.calConfig = configStr;
  el.replaceWith(newEl);
}

/**
 * Navigate calendar to a date.
 * @param {number} year - Display year
 * @param {number} month - Month (1-indexed)
 * @param {number} day - Day (1-indexed)
 */
async function navigateToDate(year, month, day) {
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
}

/** Register enrichers with Foundry. */
export function registerEnrichers() {
  CONFIG.TextEditor.enrichers.push({
    pattern: /\[\[cal\.(?<type>\w+)(?:\s+(?<config>[^\]]*?))?]](?:\{(?<label>[^}]+)\})?/gi,
    enricher: enrichCalendaria
  });
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('.calendaria-enricher--link');
    if (!link) return;
    e.preventDefault();
    const pageId = link.dataset.calPageId;
    if (pageId) {
      const page = NoteManager.getFullNote(pageId);
      if (page) page.sheet.render(true, { mode: 'view' });
      return;
    }
    const year = link.dataset.calYear;
    const month = link.dataset.calMonth;
    const day = link.dataset.calDay;
    if (year && month && day) navigateToDate(Number(year), Number(month), Number(day));
  });
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('.calendaria-enricher--chronicle.calendaria-enricher--link');
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    const ds = link.dataset;
    const startDate = { year: Number(ds.calChronicleFromYear), month: Number(ds.calChronicleFromMonth), dayOfMonth: Number(ds.calChronicleFromDay) };
    const endDate = { year: Number(ds.calChronicleToYear), month: Number(ds.calChronicleToMonth), dayOfMonth: Number(ds.calChronicleToDay) };
    Chronicle.show({ startDate, endDate, lockedRange: true, calendarId: ds.calChronicleCalendarId || null });
  });
  LiveUpdateManager.initialize(refreshElement);
  Hooks.once('calendaria.ready', () => LiveUpdateManager.scheduleRefresh());
}
