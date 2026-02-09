/**
 * Chat Commands for Calendaria
 * Native handlers for all chat commands.
 * @module Chat/ChatCommands
 * @author Tyler
 */

import { CalendariaAPI } from '../api.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { canChangeActiveCalendar, canChangeDateTime } from '../utils/permissions.mjs';
import WeatherManager from '../weather/weather-manager.mjs';

/** Command patterns for parsing chat input. */
const COMMAND_PATTERNS = {
  date: /^\/(?:date|d)(?:\s+(.*))?$/i,
  time: /^\/(?:time|t)(?:\s+(.*))?$/i,
  datetime: /^\/(?:datetime|dt)(?:\s+(.*))?$/i,
  note: /^\/(?:note|n)(?:\s+(.*))?$/i,
  weather: /^\/(?:weather|w)$/i,
  moon: /^\/moon(?:\s+(.*))?$/i,
  season: /^\/season$/i,
  today: /^\/today$/i,
  sunrise: /^\/sunrise(?:\s+(.*))?$/i,
  sunset: /^\/sunset(?:\s+(.*))?$/i,
  advance: /^\/(?:advance|adv)\s+(.+)$/i,
  setdate: /^\/setdate\s+(.+)$/i,
  settime: /^\/settime\s+(.+)$/i,
  calendar: /^\/(?:calendar|cal)$/i,
  calendars: /^\/(?:calendars|cals)$/i,
  switchcal: /^\/switchcal\s+(.+)$/i,
  festival: /^\/festival$/i,
  weekday: /^\/weekday$/i,
  cycle: /^\/(?:cycle|zodiac)$/i
};

/** Time unit aliases mapping to component fields. */
const TIME_UNIT_MAP = {
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
 * Handle chatMessage hook to intercept custom commands.
 * @param {object} _chatLog - The ChatLog instance
 * @param {string} message - The raw message content
 * @param {object} _chatData - Chat message data
 * @returns {boolean|void} False to cancel default processing, undefined otherwise
 */
export function onChatMessage(_chatLog, message, _chatData) {
  const trimmed = message.trim();
  if (!trimmed.startsWith('/')) return;
  for (const [cmd, pattern] of Object.entries(COMMAND_PATTERNS)) {
    const match = trimmed.match(pattern);
    if (match) {
      handleCommand(cmd, match);
      return false;
    }
  }
}

/**
 * Route command to handler.
 * @param {string} cmd - Command name
 * @param {Array} match - Regex match array
 */
function handleCommand(cmd, match) {
  const handlers = {
    date: () => cmdDate(match[1]?.trim() || ''),
    time: () => cmdTime(match[1]?.trim() || ''),
    datetime: () => cmdDateTime(match[1]?.trim() || ''),
    note: () => cmdNote(match[1]?.trim() || ''),
    weather: cmdWeather,
    moon: () => cmdMoon(match[1]?.trim() || ''),
    season: cmdSeason,
    today: cmdToday,
    sunrise: () => cmdSunrise(match[1]?.trim() || ''),
    sunset: () => cmdSunset(match[1]?.trim() || ''),
    advance: () => cmdAdvance(match[1]),
    setdate: () => cmdSetDate(match[1]),
    settime: () => cmdSetTime(match[1]),
    calendar: cmdCalendar,
    calendars: cmdCalendars,
    switchcal: () => cmdSwitchCal(match[1]),
    festival: cmdFestival,
    weekday: cmdWeekday,
    cycle: cmdCycle
  };
  handlers[cmd]?.();
}

/**
 * Send a chat message with calendaria styling.
 * @param {string} content - HTML content
 */
async function sendChat(content) {
  await ChatMessage.create({ content: `<div class="calendaria-chat-output">${content}</div>`, speaker: ChatMessage.getSpeaker() });
}

/**
 * Format hours as HH:MM string.
 * @param {number} hours - Decimal hours
 * @returns {string} Formatted time string
 */
function formatHours(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Handle /date command - output formatted date.
 * @param {string} formatStr - Optional format string
 * @returns {Promise<void>}
 */
async function cmdDate(formatStr) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const formatted = CalendariaAPI.formatDate(null, formatStr || 'dateLong');
  await sendChat(formatted);
}

/**
 * Handle /time command - output formatted time.
 * @param {string} formatStr - Optional format string
 * @returns {Promise<void>}
 */
async function cmdTime(formatStr) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const formatted = CalendariaAPI.formatDate(null, formatStr || 'time24');
  await sendChat(formatted);
}

/**
 * Handle /note command - create a quick note.
 * @param {string} args - Note title and optional description
 * @returns {Promise<void>}
 */
async function cmdNote(args) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  if (!args) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoteTitleRequired'));
  const quotedMatch = args.match(/^"([^"]+)"(?:\s+"([^"]*)")?/);
  const title = quotedMatch ? quotedMatch[1] : args.trim();
  const description = quotedMatch?.[2] || '';
  if (!title) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoteTitleRequired'));
  const dt = CalendariaAPI.getCurrentDateTime();
  try {
    const page = await CalendariaAPI.createNote({
      name: title,
      content: description,
      startDate: { year: dt.year, month: dt.month, day: (dt.dayOfMonth ?? 0) + 1, hour: dt.hour, minute: dt.minute },
      allDay: false,
      categories: ['event']
    });
    if (page) {
      ui.notifications.info(localize('CALENDARIA.ChatCommand.NoteCreated'));
      log(3, `Created note via chat: ${title}`);
    }
  } catch (error) {
    log(1, 'Error creating note:', error);
    ui.notifications.error(localize('CALENDARIA.ChatCommand.NoteError'));
  }
}

/**
 * Handle /weather command - output current weather.
 * @returns {Promise<void>}
 */
async function cmdWeather() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const weather = WeatherManager.getCurrentWeather();
  if (!weather) return sendChat(localize('CALENDARIA.ChatCommand.NoWeather'));
  const temp = WeatherManager.getTemperature();
  const unit = game.settings.get('calendaria', 'temperatureUnit');
  const tempStr = temp != null ? ` (${Math.round(temp)}°${unit === 'fahrenheit' ? 'F' : 'C'})` : '';
  await sendChat(`<i class="${weather.icon || 'fas fa-cloud'}"></i> ${localize(weather.label)}${tempStr}`);
}

/**
 * Handle /moon command - output current moon phases.
 * @param {string} args - Optional moon index
 * @returns {Promise<void>}
 */
async function cmdMoon(args) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const moons = calendar.moonsArray;
  if (!moons?.length) return sendChat(localize('CALENDARIA.ChatCommand.NoMoons'));
  const moonIndex = args ? parseInt(args, 10) : null;
  if (moonIndex !== null && !isNaN(moonIndex)) {
    const moon = moons[moonIndex];
    const phase = calendar.getMoonPhase(moonIndex);
    if (!moon || !phase) return sendChat(localize('CALENDARIA.ChatCommand.NoMoons'));
    const icon = phase.icon ? `<img src="${phase.icon}" style="height:1.2em;vertical-align:middle;margin-right:0.25rem;">` : '';
    return sendChat(`${icon}<strong>${localize(moon.name)}:</strong> ${phase.subPhaseName || localize(phase.name)}`);
  }
  const lines = moons
    .map((moon, index) => {
      const phase = calendar.getMoonPhase(index);
      if (!phase) return null;
      const icon = phase.icon ? `<img src="${phase.icon}" style="height:1.2em;vertical-align:middle;margin-right:0.25rem;">` : '';
      return `${icon}<strong>${localize(moon.name)}:</strong> ${phase.subPhaseName || localize(phase.name)}`;
    })
    .filter(Boolean);
  if (!lines.length) return sendChat(localize('CALENDARIA.ChatCommand.NoMoons'));
  await sendChat(lines.join('<br>'));
}

/**
 * Handle /season command - output current season.
 * @returns {Promise<void>}
 */
async function cmdSeason() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const season = CalendariaAPI.getCurrentSeason();
  if (!season) return sendChat(localize('CALENDARIA.ChatCommand.NoSeason'));
  const icon = season.icon ? `<i class="${season.icon}"></i> ` : '';
  await sendChat(`${icon}${localize(season.name)}`);
}

/**
 * Handle /today command - list today's notes.
 * @returns {Promise<void>}
 */
async function cmdToday() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const dt = CalendariaAPI.getCurrentDateTime();
  const notes = CalendariaAPI.getNotesForDate(dt.year, dt.month, (dt.dayOfMonth ?? 0) + 1);
  if (!notes?.length) return sendChat(localize('CALENDARIA.ChatCommand.NoNotesToday'));
  const lines = notes.map((n) => {
    const time = n.flagData.allDay ? '' : ` (${String(n.flagData.startDate.hour).padStart(2, '0')}:${String(n.flagData.startDate.minute).padStart(2, '0')})`;
    return `• ${n.name}${time}`;
  });
  await sendChat(`<strong>${localize('CALENDARIA.ChatCommand.TodayHeader')}</strong><br>${lines.join('<br>')}`);
}

/**
 * Handle /sunrise command - output formatted sunrise time.
 * @param {string} formatStr - Optional format string
 * @returns {Promise<void>}
 */
async function cmdSunrise(formatStr) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const sunrise = CalendariaAPI.getSunrise();
  if (sunrise == null) return sendChat(localize('CALENDARIA.ChatCommand.NoSunData'));
  const dt = CalendariaAPI.getCurrentDateTime();
  const h = Math.floor(sunrise);
  const m = Math.round((sunrise - h) * 60);
  const components = { ...dt, hour: h, minute: m, second: 0 };
  const formatted = CalendariaAPI.formatDate(components, formatStr || 'time24');
  await sendChat(`<i class="fas fa-sun"></i> ${localize('CALENDARIA.ChatCommand.Sunrise')}: ${formatted}`);
}

/**
 * Handle /sunset command - output formatted sunset time.
 * @param {string} formatStr - Optional format string
 * @returns {Promise<void>}
 */
async function cmdSunset(formatStr) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const sunset = CalendariaAPI.getSunset();
  if (sunset == null) return sendChat(localize('CALENDARIA.ChatCommand.NoSunData'));
  const dt = CalendariaAPI.getCurrentDateTime();
  const h = Math.floor(sunset);
  const m = Math.round((sunset - h) * 60);
  const components = { ...dt, hour: h, minute: m, second: 0 };
  const formatted = CalendariaAPI.formatDate(components, formatStr || 'time24');
  await sendChat(`<i class="fas fa-moon"></i> ${localize('CALENDARIA.ChatCommand.Sunset')}: ${formatted}`);
}

/**
 * Handle /advance command - advance time by specified amount.
 * @param {string} args - Time amount and unit (e.g., "2 hours")
 * @returns {Promise<void>}
 */
async function cmdAdvance(args) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const match = args.trim().match(/^(-?\d+)\s*(\w+)$/i);
  if (!match) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.InvalidTimeFormat'));
  const value = parseInt(match[1], 10);
  const unitInput = match[2].toLowerCase();
  const baseUnit = TIME_UNIT_MAP[unitInput];
  if (!baseUnit) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.InvalidTimeFormat'));
  const dt = CalendariaAPI.getCurrentDateTime();
  const daysPerWeek = calendar.weeks?.values?.length ?? 7;
  const secondsPerRound = calendar.secondsPerRound ?? 6;
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

  try {
    await CalendariaAPI.setDateTime({ ...dt, ...updates[baseUnit] });
    ui.notifications.info(format('CALENDARIA.ChatCommand.TimeAdvanced', { value, unit: unitInput }));
    log(3, `Advanced time by ${value} ${unitInput}`);
  } catch (error) {
    log(1, 'Error advancing time:', error);
    ui.notifications.error(localize('CALENDARIA.ChatCommand.AdvanceError'));
  }
}

/**
 * Handle /calendar command - output full calendar summary.
 * @returns {Promise<void>}
 */
async function cmdCalendar() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const lines = [];
  lines.push(`<strong>${localize('CALENDARIA.ChatCommand.Date')}:</strong> ${CalendariaAPI.formatDate(null, 'dateLong')}`);
  lines.push(`<strong>${localize('CALENDARIA.ChatCommand.Time')}:</strong> ${CalendariaAPI.formatDate(null, 'time24')}`);
  const season = CalendariaAPI.getCurrentSeason();
  if (season) lines.push(`<strong>${localize('CALENDARIA.ChatCommand.Season')}:</strong> ${localize(season.name)}`);
  const weather = WeatherManager.getCurrentWeather();
  if (weather) {
    const temp = WeatherManager.getTemperature();
    const unit = game.settings.get('calendaria', 'temperatureUnit');
    const tempStr = temp != null ? ` (${Math.round(temp)}°${unit === 'fahrenheit' ? 'F' : 'C'})` : '';
    lines.push(`<strong>${localize('CALENDARIA.ChatCommand.Weather')}:</strong> <i class="${weather.icon || 'fas fa-cloud'}"></i> ${localize(weather.label)}${tempStr}`);
  }

  const calMoons = calendar.moonsArray;
  if (calMoons?.length) {
    const moonStrs = calMoons
      .map((moon, index) => {
        const phase = calendar.getMoonPhase(index);
        return phase ? `${localize(moon.name)}: ${phase.subPhaseName || localize(phase.name)}` : null;
      })
      .filter(Boolean);
    if (moonStrs.length) lines.push(`<strong>${localize('CALENDARIA.ChatCommand.Moons')}:</strong> ${moonStrs.join(', ')}`);
  }

  const sunrise = CalendariaAPI.getSunrise();
  const sunset = CalendariaAPI.getSunset();
  if (sunrise != null && sunset != null) lines.push(`<strong>${localize('CALENDARIA.ChatCommand.Daylight')}:</strong> ${formatHours(sunrise)} - ${formatHours(sunset)}`);
  await sendChat(lines.join('<br>'));
}

/**
 * Handle /datetime command - output formatted date and time.
 * @param {string} formatStr - Optional format string
 * @returns {Promise<void>}
 */
async function cmdDateTime(formatStr) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const formatted = CalendariaAPI.formatDate(null, formatStr || 'dateTimeLong');
  await sendChat(formatted);
}

/**
 * Handle /setdate command - set specific date (GM only).
 * @param {string} args - Year month day
 * @returns {Promise<void>}
 */
async function cmdSetDate(args) {
  if (!canChangeDateTime()) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoPermission'));
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const match = args?.trim().match(/^(\d+)\s+(\d+)\s+(\d+)$/);
  if (!match) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.InvalidDateFormat'));
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  try {
    await CalendariaAPI.jumpToDate({ year, month, day });
    ui.notifications.info(localize('CALENDARIA.ChatCommand.DateSet'));
    log(3, `Set date to ${year}-${month + 1}-${day}`);
  } catch (error) {
    log(1, 'Error setting date:', error);
    ui.notifications.error(localize('CALENDARIA.ChatCommand.SetDateError'));
  }
}

/**
 * Handle /settime command - set specific time (GM only).
 * @param {string} args - Hour minute [second]
 * @returns {Promise<void>}
 */
async function cmdSetTime(args) {
  if (!canChangeDateTime()) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoPermission'));
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const match = args?.trim().match(/^(\d+)\s+(\d+)(?:\s+(\d+))?$/);
  if (!match) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.InvalidTimeFormat'));
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const second = match[3] ? parseInt(match[3], 10) : 0;
  const dt = CalendariaAPI.getCurrentDateTime();
  try {
    await CalendariaAPI.setDateTime({ ...dt, hour, minute, second });
    ui.notifications.info(localize('CALENDARIA.ChatCommand.TimeSet'));
    log(3, `Set time to ${hour}:${minute}:${second}`);
  } catch (error) {
    log(1, 'Error setting time:', error);
    ui.notifications.error(localize('CALENDARIA.ChatCommand.SetTimeError'));
  }
}

/**
 * Handle /calendars command - list all calendars.
 * @returns {Promise<void>}
 */
async function cmdCalendars() {
  const calendars = CalendariaAPI.getAllCalendarMetadata();
  if (!calendars?.length) return sendChat(localize('CALENDARIA.ChatCommand.NoCalendars'));
  const active = CalendariaAPI.getActiveCalendar();
  const lines = calendars.map((cal) => {
    const isActive = cal.id === active?.id;
    const marker = isActive ? ' <i class="fas fa-check"></i>' : '';
    return `• <strong>${cal.name}</strong>${marker}`;
  });
  await sendChat(`<strong>${localize('CALENDARIA.ChatCommand.AvailableCalendars')}:</strong><br>${lines.join('<br>')}`);
}

/**
 * Handle /switchcal command - switch active calendar (GM only).
 * @param {string} args - Calendar ID
 * @returns {Promise<void>}
 */
async function cmdSwitchCal(args) {
  if (!canChangeActiveCalendar()) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoPermission'));
  const calendarId = args?.trim();
  if (!calendarId) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.CalendarIdRequired'));
  const calendar = CalendariaAPI.getCalendar(calendarId);
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.CalendarNotFound'));
  try {
    await CalendariaAPI.switchCalendar(calendarId);
    ui.notifications.info(format('CALENDARIA.ChatCommand.CalendarSwitched', { name: calendar.name }));
    log(3, `Switched calendar to ${calendarId}`);
  } catch (error) {
    log(1, 'Error switching calendar:', error);
    ui.notifications.error(localize('CALENDARIA.ChatCommand.SwitchCalError'));
  }
}

/**
 * Handle /festival command - output current festival.
 * @returns {Promise<void>}
 */
async function cmdFestival() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const festival = CalendariaAPI.getCurrentFestival();
  if (!festival) return sendChat(localize('CALENDARIA.ChatCommand.NoFestival'));
  const icon = festival.icon ? `<i class="${festival.icon}"></i> ` : '<i class="fas fa-star"></i> ';
  await sendChat(`${icon}<strong>${localize(festival.name)}</strong>`);
}

/**
 * Handle /weekday command - output current weekday.
 * @returns {Promise<void>}
 */
async function cmdWeekday() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const weekday = CalendariaAPI.getCurrentWeekday();
  if (!weekday) return sendChat(localize('CALENDARIA.ChatCommand.NoWeekday'));
  const restDay = weekday.isRestDay ? ` (${localize('CALENDARIA.ChatCommand.RestDay')})` : '';
  await sendChat(`<i class="fas fa-calendar-week"></i> <strong>${localize(weekday.name)}</strong>${restDay}`);
}

/**
 * Handle /cycle command - output zodiac/cycle values.
 * @returns {Promise<void>}
 */
async function cmdCycle() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const cycleData = CalendariaAPI.getCycleValues();
  if (!cycleData?.values?.length) return sendChat(localize('CALENDARIA.ChatCommand.NoCycles'));
  const lines = cycleData.values.map((cycle) => `• <strong>${cycle.cycleName}:</strong> ${cycle.entryName}`);
  await sendChat(lines.join('<br>'));
}
