/**
 * Shared Chat Command Handlers
 * Core logic for all chat commands, consumed by both native chat and Chat Commander.
 * @module Chat/ChatCommandHandler
 * @author Tyler
 */

import { CalendarManager } from '../../calendar/_module.mjs';
import { MODULE, SETTINGS, SOCKET_TYPES } from '../../constants.mjs';
import { NoteManager } from '../../notes/_module.mjs';
import { WeatherManager } from '../../weather/_module.mjs';
import { PRESET_FORMATTERS, formatCustom, resolveFormatString } from '../formatting/format-utils.mjs';
import { format, localize } from '../localization.mjs';
import { log } from '../logger.mjs';
import { canViewWeatherForecast } from '../permissions.mjs';
import { CalendariaSocket } from '../socket.mjs';

/** Time unit aliases mapping to component fields. */
export const TIME_UNIT_MAP = {
  second: 'second',
  seconds: 'second',
  secs: 'second',
  sec: 'second',
  s: 'second',
  round: 'round',
  rounds: 'round',
  rd: 'round',
  minute: 'minute',
  minutes: 'minute',
  mins: 'minute',
  min: 'minute',
  m: 'minute',
  hour: 'hour',
  hours: 'hour',
  hrs: 'hour',
  hr: 'hour',
  h: 'hour',
  day: 'day',
  days: 'day',
  d: 'day',
  week: 'week',
  weeks: 'week',
  w: 'week',
  month: 'month',
  months: 'month',
  mo: 'month',
  year: 'year',
  years: 'year',
  yrs: 'year',
  yr: 'year',
  y: 'year'
};

/**
 * Format hours as HH:MM string.
 * @param {number} hours - Decimal hours
 * @returns {string} Formatted time string
 */
export function formatHours(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Format date/time using preset or custom format string.
 * @param {object|null} components - Time components (0-indexed month/dayOfMonth, display year) or null for current
 * @param {string} formatOrPreset - Preset name or custom format string
 * @returns {string} Formatted string
 */
function formatDate(components, formatOrPreset) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return '';
  const formatted = components || { ...game.time.components, year: game.time.components.year + (calendar.years?.yearZero ?? 0) };
  if (PRESET_FORMATTERS[formatOrPreset]) return PRESET_FORMATTERS[formatOrPreset](calendar, formatted);
  const formatStr = resolveFormatString(formatOrPreset);
  return formatCustom(calendar, formatted, formatStr);
}

/**
 * Get current date/time components (0-indexed month/dayOfMonth, display year with yearZero).
 * @returns {object} Current time components
 */
function getCurrentDateTime() {
  const components = game.time.components;
  const calendar = CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  return { ...components, year: components.year + yearZero };
}

/**
 * Get current season from the active calendar.
 * @returns {object|null} Season data
 */
function getCurrentSeason() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar?.seasons) return null;
  const components = game.time.components;
  const seasonIndex = components.season ?? 0;
  return calendar.seasonsArray?.[seasonIndex] ?? null;
}

/**
 * Get sunrise time in decimal hours.
 * @returns {number|null} Sunrise hours
 */
function getSunrise() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  return calendar.sunrise(undefined, zone);
}

/**
 * Get sunset time in decimal hours.
 * @returns {number|null} Sunset hours
 */
function getSunset() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  return calendar.sunset(undefined, zone);
}

/**
 * Get current weekday information.
 * @returns {object|null} Weekday data
 */
function getCurrentWeekday() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const weekdayInfo = calendar.getWeekdayForDate?.();
  if (!weekdayInfo) return null;
  return { index: weekdayInfo.index, name: weekdayInfo.name || '', abbreviation: weekdayInfo.abbreviation || '', isRestDay: weekdayInfo.isRestDay || false };
}

// ─── Command Handlers ──────────────────────────────────────────────────────────

/**
 * /date — format and return current date.
 * @param {string} formatStr - Format preset or custom string
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdDate(formatStr) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const formatted = formatDate(null, formatStr || 'dateLong');
  return { content: formatted };
}

/**
 * /time — format and return current time.
 * @param {string} formatStr - Format preset or custom string
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdTime(formatStr) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const formatted = formatDate(null, formatStr || 'time24');
  return { content: formatted };
}

/**
 * /datetime — format and return date+time.
 * @param {string} formatStr - Format preset or custom string
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdDateTime(formatStr) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const formatted = formatDate(null, formatStr || 'dateTimeLong');
  return { content: formatted };
}

/**
 * /note — create a quick note.
 * @param {string} args - Note title and optional description
 * @returns {Promise<{ content: string }|null>} Null if no calendar or no title
 */
export async function cmdNote(args) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  if (!args) return null;
  const quotedMatch = args.match(/^"([^"]+)"(?:\s+"([^"]*)")?/);
  const title = quotedMatch ? quotedMatch[1] : args.trim();
  const description = quotedMatch?.[2] || '';
  if (!title) return null;
  const dt = getCurrentDateTime();
  const noteData = {
    startDate: { year: dt.year, month: dt.month, dayOfMonth: dt.dayOfMonth, hour: dt.hour, minute: dt.minute },
    allDay: false,
    categories: ['event'],
    icon: 'fas fa-calendar-day',
    color: '#4a90e2',
    visibility: 'visible'
  };
  const page = await NoteManager.createNote({ name: title, content: description, noteData, openSheet: 'edit' });
  if (page) log(3, `Created note via chat: ${title}`);
  return { content: '' };
}

/**
 * /weather — get current or historical weather info.
 * @param {string} args - Optional date as "year month day"
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdWeather(args) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  if (args) {
    const match = args.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
    if (!match) return { content: localize('CALENDARIA.ChatCommand.InvalidDateFormat'), error: true };
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10) - 1;
    const yearZero = calendar.years?.yearZero ?? 0;
    const weather = WeatherManager.getWeatherForDate(year - yearZero, month, day);
    if (!weather) return { content: format('CALENDARIA.ChatCommand.NoWeatherForDate', { date: `${match[1]}/${match[2]}/${match[3]}` }) };
    const tempStr = weather.temperature != null ? ` (${WeatherManager.formatTemperature(weather.temperature)})` : '';
    const windStr = weather.wind?.speed > 0 ? ` · ${WeatherManager.getWindSpeedLabel(weather.wind.speed)}` : '';
    return { content: `<i class="fas ${weather.icon}" style="color:${weather.color}"></i> <strong>${match[1]}/${match[2]}/${match[3]}</strong> — ${localize(weather.label)}${tempStr}${windStr}` };
  }
  const weather = WeatherManager.getCurrentWeather();
  if (!weather) return { content: localize('CALENDARIA.ChatCommand.NoWeather') };
  const temp = WeatherManager.getTemperature();
  const tempStr = temp != null ? ` (${WeatherManager.formatTemperature(temp)})` : '';
  return { content: `<i class="${weather.icon || 'fas fa-cloud'}"></i> ${localize(weather.label)}${tempStr}` };
}

/**
 * /moon — get moon phase(s).
 * @param {string} args - Optional moon index
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdMoon(args) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const moons = calendar.moonsArray;
  if (!moons?.length) return { content: localize('CALENDARIA.Common.NoMoonsConfigured') };
  const moonIndex = args ? parseInt(args, 10) : null;
  if (moonIndex !== null && !isNaN(moonIndex)) {
    const moon = moons[moonIndex];
    const phase = calendar.getMoonPhase(moonIndex);
    if (!moon || !phase) return { content: localize('CALENDARIA.Common.NoMoonsConfigured') };
    const icon = phase.icon ? `<img src="${phase.icon}" style="height:1.2em;vertical-align:middle;margin-right:0.25rem;">` : '';
    return { content: `${icon}<strong>${localize(moon.name)}:</strong> ${phase.subPhaseName || localize(phase.name)}` };
  }
  const lines = moons
    .map((moon, index) => {
      const phase = calendar.getMoonPhase(index);
      if (!phase) return null;
      const icon = phase.icon ? `<img src="${phase.icon}" style="height:1.2em;vertical-align:middle;margin-right:0.25rem;">` : '';
      return `${icon}<strong>${localize(moon.name)}:</strong> ${phase.subPhaseName || localize(phase.name)}`;
    })
    .filter(Boolean);
  if (!lines.length) return { content: localize('CALENDARIA.Common.NoMoonsConfigured') };
  return { content: lines.join('<br>') };
}

/**
 * /season — get current season.
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdSeason() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const season = getCurrentSeason();
  if (!season) return { content: localize('CALENDARIA.ChatCommand.NoSeason') };
  const icon = season.icon ? `<i class="${season.icon}"></i> ` : '';
  return { content: `${icon}${localize(season.name)}` };
}

/**
 * /today — get today's notes.
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdToday() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const dt = getCurrentDateTime();
  const notes = NoteManager.getNotesForDate(dt.year, dt.month, dt.dayOfMonth);
  if (!notes?.length) return { content: localize('CALENDARIA.ChatCommand.NoNotesToday') };
  const lines = notes.map((n) => {
    const time = n.flagData.allDay ? '' : ` (${String(n.flagData.startDate.hour).padStart(2, '0')}:${String(n.flagData.startDate.minute).padStart(2, '0')})`;
    return `• ${n.name}${time}`;
  });
  return { content: `<strong>${localize('CALENDARIA.ChatCommand.TodayHeader')}</strong><br>${lines.join('<br>')}` };
}

/**
 * /sunrise — get sunrise time.
 * @param {string} formatStr - Format preset or custom string
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdSunrise(formatStr) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const sunrise = getSunrise();
  if (sunrise == null) return { content: localize('CALENDARIA.ChatCommand.NoSunData') };
  const dt = getCurrentDateTime();
  const h = Math.floor(sunrise);
  const m = Math.round((sunrise - h) * 60);
  const components = { ...dt, hour: h, minute: m, second: 0 };
  const formatted = formatDate(components, formatStr || 'time24');
  return { content: `<i class="fas fa-sun"></i> ${localize('CALENDARIA.Common.Sunrise')}: ${formatted}` };
}

/**
 * /sunset — get sunset time.
 * @param {string} formatStr - Format preset or custom string
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdSunset(formatStr) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const sunset = getSunset();
  if (sunset == null) return { content: localize('CALENDARIA.ChatCommand.NoSunData') };
  const dt = getCurrentDateTime();
  const h = Math.floor(sunset);
  const m = Math.round((sunset - h) * 60);
  const components = { ...dt, hour: h, minute: m, second: 0 };
  const formatted = formatDate(components, formatStr || 'time24');
  return { content: `<i class="fas fa-moon"></i> ${localize('CALENDARIA.Common.Sunset')}: ${formatted}` };
}

/**
 * /advance — advance time by specified amount.
 * @param {string} args - Time amount and unit (e.g., "2 hours")
 * @returns {Promise<{ content: string }|null>} Null if no calendar or invalid input
 */
export async function cmdAdvance(args) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const match = args?.trim().match(/^(-?\d+)\s*(\w+)$/i);
  if (!match) return { content: localize('CALENDARIA.ChatCommand.InvalidTimeFormat'), error: true };
  const value = parseInt(match[1], 10);
  const unitInput = match[2].toLowerCase();
  const baseUnit = TIME_UNIT_MAP[unitInput];
  if (!baseUnit) return { content: localize('CALENDARIA.ChatCommand.InvalidTimeFormat'), error: true };
  const dt = getCurrentDateTime();
  const daysPerWeek = calendar.weeks?.values?.length ?? 7;
  const secondsPerRound = calendar.secondsPerRound ?? 6;
  const yearZero = calendar.years?.yearZero ?? 0;
  const updates = {
    second: { second: (dt.second ?? 0) + value },
    round: { second: (dt.second ?? 0) + value * secondsPerRound },
    minute: { minute: dt.minute + value },
    hour: { hour: dt.hour + value },
    day: { dayOfMonth: dt.dayOfMonth + value },
    week: { dayOfMonth: dt.dayOfMonth + value * daysPerWeek },
    month: { month: dt.month + value },
    year: { year: dt.year + value }
  };
  const components = { ...dt, ...updates[baseUnit] };
  components.year -= yearZero;
  if (!game.user.isGM) CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'set', components });
  else await game.time.set(components);
  log(3, `Advanced time by ${value} ${unitInput}`);
  return { content: format('CALENDARIA.ChatCommand.TimeAdvanced', { value, unit: unitInput }) };
}

/**
 * /setdate — set date to specific values.
 * @param {string} args - Year month day
 * @returns {Promise<{ content: string }|null>} Null if no calendar or invalid input
 */
export async function cmdSetDate(args) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const match = args?.trim().match(/^(\d+)\s+(\d+)\s+(\d+)$/);
  if (!match) return { content: localize('CALENDARIA.ChatCommand.InvalidDateFormat'), error: true };
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const dayOfMonth = parseInt(match[3], 10) - 1;
  if (!game.user.isGM) CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'jump', date: { year, month, dayOfMonth } });
  else await calendar.jumpToDate({ year, month, dayOfMonth });
  log(3, `Set date to ${year}-${month + 1}-${dayOfMonth + 1}`);
  return { content: localize('CALENDARIA.ChatCommand.DateSet') };
}

/**
 * /settime — set time to specific values.
 * @param {string} args - Hour minute [second]
 * @returns {Promise<{ content: string }|null>} Null if no calendar or invalid input
 */
export async function cmdSetTime(args) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const match = args?.trim().match(/^(\d+)\s+(\d+)(?:\s+(\d+))?$/);
  if (!match) return { content: localize('CALENDARIA.ChatCommand.InvalidTimeFormat'), error: true };
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const second = match[3] ? parseInt(match[3], 10) : 0;
  const dt = getCurrentDateTime();
  const yearZero = calendar.years?.yearZero ?? 0;
  const components = { ...dt, hour, minute, second, year: dt.year - yearZero };
  if (!game.user.isGM) CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'set', components });
  else await game.time.set(components);
  log(3, `Set time to ${hour}:${minute}:${second}`);
  return { content: localize('CALENDARIA.ChatCommand.TimeSet') };
}

/**
 * /calendar — show active calendar summary.
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdCalendar() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const lines = [];
  lines.push(`<strong>${localize('CALENDARIA.Common.Date')}:</strong> ${formatDate(null, 'dateLong')}`);
  lines.push(`<strong>${localize('CALENDARIA.Common.Time')}:</strong> ${formatDate(null, 'time24')}`);
  const season = getCurrentSeason();
  if (season) lines.push(`<strong>${localize('CALENDARIA.Common.Season')}:</strong> ${localize(season.name)}`);
  const weather = WeatherManager.getCurrentWeather();
  if (weather) {
    const temp = WeatherManager.getTemperature();
    const unit = game.settings.get('calendaria', 'temperatureUnit');
    const tempStr = temp != null ? ` (${Math.round(temp)}°${unit === 'fahrenheit' ? 'F' : 'C'})` : '';
    lines.push(`<strong>${localize('CALENDARIA.Common.Weather')}:</strong> <i class="${weather.icon || 'fas fa-cloud'}"></i> ${localize(weather.label)}${tempStr}`);
  }
  const calMoons = calendar.moonsArray;
  if (calMoons?.length) {
    const moonStrs = calMoons
      .map((moon, index) => {
        const phase = calendar.getMoonPhase(index);
        return phase ? `${localize(moon.name)}: ${phase.subPhaseName || localize(phase.name)}` : null;
      })
      .filter(Boolean);
    if (moonStrs.length) lines.push(`<strong>${localize('CALENDARIA.Common.Moons')}:</strong> ${moonStrs.join(', ')}`);
  }
  const sunrise = getSunrise();
  const sunset = getSunset();
  if (sunrise != null && sunset != null) lines.push(`<strong>${localize('CALENDARIA.ChatCommand.Daylight')}:</strong> ${formatHours(sunrise)} - ${formatHours(sunset)}`);
  return { content: lines.join('<br>') };
}

/**
 * /calendars — list all calendars.
 * @returns {{ content: string }} Calendar list
 */
export function cmdCalendars() {
  const calendars = CalendarManager.getAllCalendarMetadata();
  if (!calendars?.length) return { content: localize('CALENDARIA.ChatCommand.NoCalendars') };
  const active = CalendarManager.getActiveCalendar();
  const lines = calendars.map((cal) => {
    const isActive = cal.id === active?.id;
    const marker = isActive ? ' <i class="fas fa-check"></i>' : '';
    return `• <strong>${cal.name}</strong>${marker}`;
  });
  return { content: `<strong>${localize('CALENDARIA.ChatCommand.AvailableCalendars')}:</strong><br>${lines.join('<br>')}` };
}

/**
 * /switchcal — switch active calendar.
 * @param {string} args - Calendar ID
 * @returns {Promise<{ content: string }|null>} Null if missing ID or calendar not found
 */
export async function cmdSwitchCal(args) {
  const calendarId = args?.trim();
  if (!calendarId) return null;
  const calendar = CalendarManager.getCalendar(calendarId);
  if (!calendar) return null;
  if (!game.user.isGM) CalendariaSocket.emit(SOCKET_TYPES.CALENDAR_REQUEST, { calendarId });
  else await CalendarManager.switchCalendar(calendarId);
  log(3, `Switched calendar to ${calendarId}`);
  return { content: format('CALENDARIA.ChatCommand.CalendarSwitched', { name: calendar.name }) };
}

/**
 * /festival — get current festival.
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdFestival() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const festival = CalendarManager.getCurrentFestival();
  if (!festival) return { content: localize('CALENDARIA.ChatCommand.NoFestival') };
  const icon = festival.icon ? `<i class="fas ${festival.icon}"></i> ` : '<i class="fas fa-star"></i> ';
  return { content: `${icon}<strong>${localize(festival.name)}</strong>` };
}

/**
 * /weekday — get current weekday.
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdWeekday() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const weekday = getCurrentWeekday();
  if (!weekday) return { content: localize('CALENDARIA.ChatCommand.NoWeekday') };
  const restDay = weekday.isRestDay ? ` (${localize('CALENDARIA.Common.RestDay')})` : '';
  return { content: `<i class="fas fa-calendar-week"></i> <strong>${localize(weekday.name)}</strong>${restDay}` };
}

/**
 * /cycle — get zodiac/cycle info.
 * @returns {{ content: string }|null} Null if no calendar
 */
export function cmdCycle() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  const cycleData = calendar.getCycleValues();
  if (!cycleData?.values?.length) return { content: localize('CALENDARIA.ChatCommand.NoCycles') };
  const lines = cycleData.values.map((cycle) => `• <strong>${cycle.cycleName}:</strong> ${cycle.entryName}`);
  return { content: lines.join('<br>') };
}

/**
 * /forecast — get weather forecast.
 * @param {string} args - Optional day count
 * @returns {{ content: string, whisper: boolean }|null} Null if no calendar, whisper flag for GM-only delivery
 */
export function cmdForecast(args) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  if (!game.settings.get(MODULE.ID, SETTINGS.AUTO_GENERATE_WEATHER)) return { content: localize('CALENDARIA.ChatCommand.NoForecast') };
  if (!canViewWeatherForecast()) return { content: localize('CALENDARIA.ChatCommand.NoPermission'), error: true };
  const days = args ? parseInt(args, 10) : undefined;
  if (args && isNaN(days)) return { content: localize('CALENDARIA.ChatCommand.InvalidForecastDays'), error: true };
  const forecast = WeatherManager.getForecast({ days: days || undefined });
  if (!forecast.length) return { content: localize('CALENDARIA.ChatCommand.NoForecast') };
  const zone = WeatherManager.getActiveZone(null, game.scenes?.active);
  const zoneName = zone ? localize(zone.name) : '';
  const subtitle = zoneName ? `<div class="forecast-zone">${zoneName}</div>` : '';
  const lines = forecast.map((f) => {
    const tempStr = f.temperature != null ? ` ${f.isVaried ? '~' : ''}${WeatherManager.formatTemperature(f.temperature)}` : '';
    const label = localize(f.preset.label);
    return `<i class="fas ${f.preset.icon}" style="color:${f.preset.color}"></i> <strong>${f.dayOfMonth + 1}</strong> — ${label}${tempStr}`;
  });
  return { content: `<h3>${localize('CALENDARIA.ChatCommand.ForecastHeader')}</h3>${subtitle}${lines.join('<br>')}`, whisper: true };
}

/**
 * /weatherprob — get weather probability breakdown.
 * @param {string} args - Optional season name
 * @returns {{ content: string, whisper: boolean }|null} Null if no calendar
 */
export function cmdWeatherProb(args) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return null;
  if (!game.settings.get(MODULE.ID, SETTINGS.AUTO_GENERATE_WEATHER)) return { content: localize('CALENDARIA.ChatCommand.NoForecast') };
  if (!canViewWeatherForecast()) return { content: localize('CALENDARIA.ChatCommand.NoPermission'), error: true };
  const data = WeatherManager.getWeatherProbabilities({ season: args || undefined });
  if (!data.entries.length) return { content: localize('CALENDARIA.WeatherProbability.NoPresets') };
  const header = `<h3>${localize('CALENDARIA.WeatherProbability.Title')}</h3>`;
  const subtitle = data.zone ? `<div class="forecast-zone">${data.zone.name}${data.season ? ` — ${data.season}` : ''}</div>` : '';
  const rows = data.entries.map((e) => `<i class="fas ${e.icon}" style="color:${e.color}"></i> ${e.label} — <strong>${e.percent}%</strong>`);
  const tempStr = `${WeatherManager.formatTemperature(data.tempRange.min)} – ${WeatherManager.formatTemperature(data.tempRange.max)}`;
  const footer = `<div style="margin-top:0.5em;"><i class="fas fa-temperature-half"></i> ${localize('CALENDARIA.Common.TemperatureRange')}: ${tempStr}</div>`;
  return { content: `${header}${subtitle}${rows.join('<br>')}${footer}`, whisper: true };
}

/** @type {string} Flag key for identifying the enricher reference journal. */
const ENRICHER_JOURNAL_FLAG = 'isEnricherReference';

/** @type {Array<{label: string, keys: string[], examples?: object}>} Enricher categories for the reference journal. */
const ENRICHER_CATEGORIES = [
  { label: 'CALENDARIA.Enricher.Category.DateTime', keys: ['date', 'time', 'weekday', 'season', 'era', 'cycle', 'festival', 'restday'] },
  {
    label: 'CALENDARIA.Enricher.Category.TimeMath',
    keys: ['countdown', 'countup', 'between', 'timeuntil', 'datemath'],
    examples: { countdown: '1 1 2030 cal=gregorian', countup: '1 1 2020 cal=gregorian', between: '1 1 2020 to 1 6 2025 cal=gregorian', timeuntil: 'sunset', datemath: '+30d' }
  },
  { label: 'CALENDARIA.Enricher.Category.Calendar', keys: ['calname', 'month', 'year', 'dayofyear', 'yearprogress', 'leapyear', 'intercalary', 'daysinyear'] },
  { label: 'CALENDARIA.Enricher.Category.Sun', keys: ['sunrise', 'sunset', 'daylight', 'isdaytime', 'dayprogress', 'nightprogress', 'untilsunrise', 'untilsunset'] },
  { label: 'CALENDARIA.Enricher.Category.Moon', keys: ['moon', 'moons', 'nextfullmoon', 'convergence', 'eclipse', 'nexteclipse'] },
  { label: 'CALENDARIA.Enricher.Category.Weather', keys: ['weather', 'temperature', 'wind', 'precipitation', 'weathericon', 'zone', 'forecast'] },
  { label: 'CALENDARIA.Enricher.Category.Notes', keys: ['event', 'notes', 'next', 'category'], examples: { event: 'Winter Solstice', category: 'quest' } },
  { label: 'CALENDARIA.Enricher.Category.Composite', keys: ['summary', 'almanac', 'format', 'compare', 'peek'], examples: { format: 'MMMM YYYY', compare: '1 1 2025 cal=gregorian', peek: '+7d' } }
];

/**
 * /enrichers — create or open the enricher reference journal.
 * @returns {{ content: string }} Chat result
 */
export async function cmdEnrichers() {
  const existing = game.journal.find((j) => j.getFlag(MODULE.ID, ENRICHER_JOURNAL_FLAG));
  if (existing) {
    existing.sheet.render(true);
    return { content: `<i class="fas fa-book-open"></i> ${localize('CALENDARIA.Enricher.Reference.Opened')}` };
  }
  const { handlers: enricherHandlers } = await import('../enrichers.mjs');
  const syntaxHeader = localize('CALENDARIA.Enricher.Reference.Syntax');
  const outputHeader = localize('CALENDARIA.Enricher.Reference.Output');
  const sections = ENRICHER_CATEGORIES.map((cat) => {
    const examples = cat.examples ?? {};
    const rows = cat.keys
      .filter((k) => enricherHandlers[k])
      .map((k) => {
        const args = examples[k] ? ` ${examples[k]}` : '';
        return `<tr><td><code>[\u200B[cal.${k}${args}]\u200B]</code></td><td>[[cal.${k}${args}]]</td></tr>`;
      });
    return `<h2>${localize(cat.label)}</h2><table><thead><tr><th>${syntaxHeader}</th><th>${outputHeader}</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  });
  const wikiLink = `<p><a href="https://github.com/Sayshal/calendaria/wiki/Text-Enrichers">${localize('CALENDARIA.Enricher.Reference.WikiLink')}</a></p>`;
  const content = `${wikiLink}${sections.join('')}`;
  const journalName = localize('CALENDARIA.Enricher.Reference.Title');
  const journal = await JournalEntry.create({ name: journalName, pages: [{ name: journalName, type: 'text', text: { content } }], flags: { [MODULE.ID]: { [ENRICHER_JOURNAL_FLAG]: true } } });
  journal.sheet.render(true);
  return { content: `<i class="fas fa-book-open"></i> ${localize('CALENDARIA.Enricher.Reference.Created')}` };
}
