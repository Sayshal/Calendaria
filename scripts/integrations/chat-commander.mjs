/**
 * Chat Commander Integration
 * Registers Calendaria commands with the Chat Commander module.
 * @module Integrations/ChatCommander
 * @author Tyler
 */

import { CalendariaAPI } from '../api.mjs';
import { MODULE } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { canAddNotes, canChangeActiveCalendar, canChangeDateTime } from '../utils/permissions.mjs';
import WeatherManager from '../weather/weather-manager.mjs';

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
 * Wrap content in calendaria styling.
 * @param {string} content - Content to wrap
 * @returns {string} Styled content
 */
function wrapContent(content) {
  return `<div class="calendaria-chat-output">${content}</div>`;
}

/**
 * Initialize Chat Commander integration.
 * Should be called in the ready hook.
 */
export function initializeChatCommander() {
  if (!game.modules.get('_chatcommands')?.active) return;
  log(3, 'Chat Commander detected, registering commands');
  registerCommands();
}

/**
 * Register all Calendaria commands with Chat Commander.
 */
function registerCommands() {
  const commands = [
    {
      name: '/date',
      aliases: ['/d'],
      description: localize('CALENDARIA.ChatCommander.DateDesc'),
      icon: '<i class="fas fa-calendar-day"></i>',
      requiredRole: 'NONE',
      callback: cmdDate,
      autocompleteCallback: autocompleteDate
    },
    {
      name: '/time',
      aliases: ['/t'],
      description: localize('CALENDARIA.ChatCommander.TimeDesc'),
      icon: '<i class="fas fa-clock"></i>',
      requiredRole: 'NONE',
      callback: cmdTime,
      autocompleteCallback: autocompleteTime
    },
    {
      name: '/datetime',
      aliases: ['/dt'],
      description: localize('CALENDARIA.ChatCommander.DateTimeDesc'),
      icon: '<i class="fas fa-calendar-clock"></i>',
      requiredRole: 'NONE',
      callback: cmdDateTime,
      autocompleteCallback: autocompleteDateTime
    },
    {
      name: '/note',
      aliases: ['/n'],
      description: localize('CALENDARIA.ChatCommander.NoteDesc'),
      icon: '<i class="fas fa-sticky-note"></i>',
      requiredRole: 'NONE',
      callback: cmdNote
    },
    {
      name: '/weather',
      aliases: ['/w'],
      description: localize('CALENDARIA.ChatCommander.WeatherDesc'),
      icon: '<i class="fas fa-cloud-sun"></i>',
      requiredRole: 'NONE',
      callback: cmdWeather
    },
    {
      name: '/moon',
      description: localize('CALENDARIA.ChatCommander.MoonDesc'),
      icon: '<i class="fas fa-moon"></i>',
      requiredRole: 'NONE',
      callback: cmdMoon
    },
    {
      name: '/season',
      description: localize('CALENDARIA.ChatCommander.SeasonDesc'),
      icon: '<i class="fas fa-leaf"></i>',
      requiredRole: 'NONE',
      callback: cmdSeason
    },
    {
      name: '/today',
      description: localize('CALENDARIA.ChatCommander.TodayDesc'),
      icon: '<i class="fas fa-list"></i>',
      requiredRole: 'NONE',
      callback: cmdToday
    },
    {
      name: '/sunrise',
      description: localize('CALENDARIA.ChatCommander.SunriseDesc'),
      icon: '<i class="fas fa-sun"></i>',
      requiredRole: 'NONE',
      callback: cmdSunrise,
      autocompleteCallback: autocompleteSunrise
    },
    {
      name: '/sunset',
      description: localize('CALENDARIA.ChatCommander.SunsetDesc'),
      icon: '<i class="fas fa-moon"></i>',
      requiredRole: 'NONE',
      callback: cmdSunset,
      autocompleteCallback: autocompleteSunset
    },
    {
      name: '/advance',
      aliases: ['/adv'],
      description: localize('CALENDARIA.ChatCommander.AdvanceDesc'),
      icon: '<i class="fas fa-forward"></i>',
      requiredRole: 'GAMEMASTER',
      callback: cmdAdvance
    },
    {
      name: '/setdate',
      description: localize('CALENDARIA.ChatCommander.SetDateDesc'),
      icon: '<i class="fas fa-calendar-plus"></i>',
      requiredRole: 'GAMEMASTER',
      callback: cmdSetDate
    },
    {
      name: '/settime',
      description: localize('CALENDARIA.ChatCommander.SetTimeDesc'),
      icon: '<i class="fas fa-clock"></i>',
      requiredRole: 'GAMEMASTER',
      callback: cmdSetTime
    },
    {
      name: '/calendar',
      aliases: ['/cal'],
      description: localize('CALENDARIA.ChatCommander.CalendarDesc'),
      icon: '<i class="fas fa-calendar"></i>',
      requiredRole: 'NONE',
      callback: cmdCalendar
    },
    {
      name: '/calendars',
      aliases: ['/cals'],
      description: localize('CALENDARIA.ChatCommander.CalendarsDesc'),
      icon: '<i class="fas fa-calendars"></i>',
      requiredRole: 'NONE',
      callback: cmdCalendars
    },
    {
      name: '/switchcal',
      description: localize('CALENDARIA.ChatCommander.SwitchCalDesc'),
      icon: '<i class="fas fa-exchange-alt"></i>',
      requiredRole: 'GAMEMASTER',
      callback: cmdSwitchCal,
      autocompleteCallback: autocompleteSwitchCal
    },
    {
      name: '/festival',
      description: localize('CALENDARIA.ChatCommander.FestivalDesc'),
      icon: '<i class="fas fa-star"></i>',
      requiredRole: 'NONE',
      callback: cmdFestival
    },
    {
      name: '/weekday',
      description: localize('CALENDARIA.ChatCommander.WeekdayDesc'),
      icon: '<i class="fas fa-calendar-week"></i>',
      requiredRole: 'NONE',
      callback: cmdWeekday
    },
    {
      name: '/cycle',
      aliases: ['/zodiac'],
      description: localize('CALENDARIA.ChatCommander.CycleDesc'),
      icon: '<i class="fas fa-yin-yang"></i>',
      requiredRole: 'NONE',
      callback: cmdCycle
    }
  ];

  for (const cmd of commands) game.chatCommands.register({ ...cmd, module: MODULE.ID });
  log(3, `Registered ${commands.length} Chat Commander commands`);
}

// --- Command Handlers ---

/**
 * /date [format] - Display current date.
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Optional format string
 * @returns {object} Chat message data
 */
function cmdDate(_chat, parameters) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const formatted = CalendariaAPI.formatDate(null, parameters?.trim() || 'dateLong');
  return { content: wrapContent(formatted) };
}

/**
 * /time [format] - Display current time.
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Optional format string
 * @returns {object} Chat message data
 */
function cmdTime(_chat, parameters) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const formatted = CalendariaAPI.formatDate(null, parameters?.trim() || 'time24');
  return { content: wrapContent(formatted) };
}

/**
 * /datetime [format] - Display date and time.
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Optional format string
 * @returns {object} Chat message data
 */
function cmdDateTime(_chat, parameters) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const formatted = CalendariaAPI.formatDate(null, parameters?.trim() || 'dateTimeLong');
  return { content: wrapContent(formatted) };
}

/**
 * /note [title] [desc] - Create a quick note.
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Note title and optional description
 * @returns {Promise<object>} Empty object (no chat output)
 */
async function cmdNote(_chat, parameters) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar || !canAddNotes()) return {};
  const args = parameters?.trim() || '';
  if (!args) return {};
  const quotedMatch = args.match(/^"([^"]+)"(?:\s+"([^"]*)")?/);
  const title = quotedMatch ? quotedMatch[1] : args.trim();
  const description = quotedMatch?.[2] || '';
  if (!title) return {};
  const dt = CalendariaAPI.getCurrentDateTime();
  try {
    const page = await CalendariaAPI.createNote({
      name: title,
      content: description,
      startDate: { year: dt.year, month: dt.month, day: (dt.dayOfMonth ?? 0) + 1, hour: dt.hour, minute: dt.minute },
      allDay: false,
      categories: ['event']
    });
    if (page) log(3, `Created note via Chat Commander: ${title}`);
  } catch (error) {
    log(1, 'Error creating note:', error);
  }
  return {};
}

/**
 * /weather - Show current weather.
 * @returns {object} Chat message data
 */
function cmdWeather() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const weather = WeatherManager.getCurrentWeather();
  if (!weather) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoWeather')) };
  const temp = WeatherManager.getTemperature();
  const unit = game.settings.get('calendaria', 'temperatureUnit');
  const tempStr = temp != null ? ` (${Math.round(temp)}°${unit === 'fahrenheit' ? 'F' : 'C'})` : '';
  return { content: wrapContent(`<i class="${weather.icon || 'fas fa-cloud'}"></i> ${localize(weather.label)}${tempStr}`) };
}

/**
 * /moon [index] - Display moon phase(s).
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Optional moon index
 * @returns {object} Chat message data
 */
function cmdMoon(_chat, parameters) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const moons = calendar.moonsArray;
  if (!moons?.length) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoMoons')) };
  const moonIndex = parameters?.trim() ? parseInt(parameters.trim(), 10) : null;
  if (moonIndex !== null && !isNaN(moonIndex)) {
    const moon = moons[moonIndex];
    const phase = calendar.getMoonPhase(moonIndex);
    if (!moon || !phase) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoMoons')) };
    const icon = phase.icon ? `<img src="${phase.icon}" style="height:1.2em;vertical-align:middle;margin-right:0.25rem;">` : '';
    return { content: wrapContent(`${icon}<strong>${localize(moon.name)}:</strong> ${phase.subPhaseName || localize(phase.name)}`) };
  }
  const lines = moons
    .map((moon, index) => {
      const phase = calendar.getMoonPhase(index);
      if (!phase) return null;
      const icon = phase.icon ? `<img src="${phase.icon}" style="height:1.2em;vertical-align:middle;margin-right:0.25rem;">` : '';
      return `${icon}<strong>${localize(moon.name)}:</strong> ${phase.subPhaseName || localize(phase.name)}`;
    })
    .filter(Boolean);
  if (!lines.length) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoMoons')) };
  return { content: wrapContent(lines.join('<br>')) };
}

/**
 * /season - Show current season.
 * @returns {object} Chat message data
 */
function cmdSeason() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const season = CalendariaAPI.getCurrentSeason();
  if (!season) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoSeason')) };
  const icon = season.icon ? `<i class="${season.icon}"></i> ` : '';
  return { content: wrapContent(`${icon}${localize(season.name)}`) };
}

/**
 * /today - List today's notes.
 * @returns {object} Chat message data
 */
function cmdToday() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const dt = CalendariaAPI.getCurrentDateTime();
  const notes = CalendariaAPI.getNotesForDate(dt.year, dt.month, (dt.dayOfMonth ?? 0) + 1);
  if (!notes?.length) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoNotesToday')) };
  const lines = notes.map((n) => {
    const time = n.flagData.allDay ? '' : ` (${String(n.flagData.startDate.hour).padStart(2, '0')}:${String(n.flagData.startDate.minute).padStart(2, '0')})`;
    return `• ${n.name}${time}`;
  });
  return { content: wrapContent(`<strong>${localize('CALENDARIA.ChatCommand.TodayHeader')}</strong><br>${lines.join('<br>')}`) };
}

/**
 * /sunrise [format] - Display sunrise time.
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Optional format string
 * @returns {object} Chat message data
 */
function cmdSunrise(_chat, parameters) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const sunrise = CalendariaAPI.getSunrise();
  if (sunrise == null) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoSunData')) };
  const dt = CalendariaAPI.getCurrentDateTime();
  const h = Math.floor(sunrise);
  const m = Math.round((sunrise - h) * 60);
  const components = { ...dt, hour: h, minute: m, second: 0 };
  const formatted = CalendariaAPI.formatDate(components, parameters?.trim() || 'time24');
  return { content: wrapContent(`<i class="fas fa-sun"></i> ${localize('CALENDARIA.ChatCommand.Sunrise')}: ${formatted}`) };
}

/**
 * /sunset [format] - Display sunset time.
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Optional format string
 * @returns {object} Chat message data
 */
function cmdSunset(_chat, parameters) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const sunset = CalendariaAPI.getSunset();
  if (sunset == null) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoSunData')) };
  const dt = CalendariaAPI.getCurrentDateTime();
  const h = Math.floor(sunset);
  const m = Math.round((sunset - h) * 60);
  const components = { ...dt, hour: h, minute: m, second: 0 };
  const formatted = CalendariaAPI.formatDate(components, parameters?.trim() || 'time24');
  return { content: wrapContent(`<i class="fas fa-moon"></i> ${localize('CALENDARIA.ChatCommand.Sunset')}: ${formatted}`) };
}

/**
 * /advance <n> <unit> - Advance time.
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Amount and unit (e.g., "2 hours")
 * @returns {Promise<object>} Empty object (no chat output)
 */
async function cmdAdvance(_chat, parameters) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar || !canChangeDateTime()) return {};
  const args = parameters?.trim();
  const match = args?.match(/^(-?\d+)\s*(\w+)$/i);
  if (!match) return {};
  const value = parseInt(match[1], 10);
  const unitInput = match[2].toLowerCase();
  const baseUnit = TIME_UNIT_MAP[unitInput];
  if (!baseUnit) return {};
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
    log(3, `Advanced time by ${value} ${unitInput}`);
  } catch (error) {
    log(1, 'Error advancing time:', error);
  }
  return {};
}

/**
 * /setdate <y> <m> <d> - Jump to specific date.
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Year month day
 * @returns {Promise<object>} Empty object (no chat output)
 */
async function cmdSetDate(_chat, parameters) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar || !canChangeDateTime()) return {};
  const args = parameters?.trim();
  const match = args?.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
  if (!match) return {};
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  try {
    await CalendariaAPI.jumpToDate({ year, month, day });
    log(3, `Set date to ${year}-${month + 1}-${day}`);
  } catch (error) {
    log(1, 'Error setting date:', error);
  }
  return {};
}

/**
 * /settime <h> <m> [s] - Set specific time.
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Hour minute [second]
 * @returns {Promise<object>} Empty object (no chat output)
 */
async function cmdSetTime(_chat, parameters) {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar || !canChangeDateTime()) return {};
  const args = parameters?.trim();
  const match = args?.match(/^(\d+)\s+(\d+)(?:\s+(\d+))?$/);
  if (!match) return {};
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const second = match[3] ? parseInt(match[3], 10) : 0;
  const dt = CalendariaAPI.getCurrentDateTime();
  try {
    await CalendariaAPI.setDateTime({ ...dt, hour, minute, second });
    log(3, `Set time to ${hour}:${minute}:${second}`);
  } catch (error) {
    log(1, 'Error setting time:', error);
  }
  return {};
}

/**
 * /calendar - Full calendar summary.
 * @returns {object} Chat message data
 */
function cmdCalendar() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
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
  return { content: wrapContent(lines.join('<br>')) };
}

/**
 * /calendars - List all calendars.
 * @returns {object} Chat message data
 */
function cmdCalendars() {
  const calendars = CalendariaAPI.getAllCalendarMetadata();
  if (!calendars?.length) return { content: wrapContent(localize('CALENDARIA.ChatCommander.NoCalendars')) };
  const active = CalendariaAPI.getActiveCalendar();
  const lines = calendars.map((cal) => {
    const isActive = cal.id === active?.id;
    const marker = isActive ? ' <i class="fas fa-check"></i>' : '';
    return `• <strong>${cal.name}</strong>${marker}`;
  });
  return { content: wrapContent(`<strong>${localize('CALENDARIA.ChatCommander.AvailableCalendars')}:</strong><br>${lines.join('<br>')}`) };
}

/**
 * /switchcal <id> - Switch active calendar.
 * @param {object} _chat - Chat log instance
 * @param {string} parameters - Calendar ID
 * @returns {Promise<object>} Empty object (no chat output)
 */
async function cmdSwitchCal(_chat, parameters) {
  if (!canChangeActiveCalendar()) return {};
  const calendarId = parameters?.trim();
  if (!calendarId) return {};
  const calendar = CalendariaAPI.getCalendar(calendarId);
  if (!calendar) return {};
  try {
    await CalendariaAPI.switchCalendar(calendarId);
    log(3, `Switched calendar to ${calendarId}`);
  } catch (error) {
    log(1, 'Error switching calendar:', error);
  }
  return {};
}

/**
 * Autocomplete for /switchcal - show available calendars.
 * @param {object} _menu - Autocomplete menu instance
 * @param {string} _alias - Command alias used
 * @param {string} parameters - Current input parameters
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteSwitchCal(_menu, _alias, parameters) {
  const calendars = CalendariaAPI.getAllCalendarMetadata();
  const term = parameters?.toLowerCase() || '';
  const filtered = calendars.filter((cal) => cal.id.toLowerCase().includes(term) || cal.name.toLowerCase().includes(term));
  return filtered.map((cal) => game.chatCommands.createCommandElement(`/switchcal ${cal.id}`, `<span class="command-title">${cal.name}</span> <span class="notes">(${cal.id})</span>`));
}

/** Date format presets for autocomplete. */
const DATE_FORMAT_PRESETS = [
  { key: 'dateLong', example: 'D MMMM, Y' },
  { key: 'dateFull', example: 'EEEE, D MMMM Y' },
  { key: 'dateShort', example: 'D MMM' },
  { key: 'dateUS', example: 'MMMM D, Y' },
  { key: 'dateISO', example: 'YYYY-MM-DD' },
  { key: 'ordinal', example: 'Do of MMMM' },
  { key: 'ordinalEra', example: 'Do of MMMM, Y GGGG' }
];

/** Time format presets for autocomplete. */
const TIME_FORMAT_PRESETS = [
  { key: 'time24', example: 'HH:mm' },
  { key: 'time12', example: 'h:mm A' },
  { key: 'time24Sec', example: 'HH:mm:ss' },
  { key: 'time12Sec', example: 'h:mm:ss A' }
];

/** DateTime format presets for autocomplete. */
const DATETIME_FORMAT_PRESETS = [
  { key: 'datetime24', example: 'D MMMM Y, HH:mm' },
  { key: 'datetime12', example: 'D MMMM Y, h:mm A' },
  { key: 'datetimeShort24', example: 'D MMM, HH:mm' },
  { key: 'datetimeShort12', example: 'D MMM, h:mm A' }
];

/**
 * Create autocomplete entries for format presets.
 * @param {string} command - The command name
 * @param {Array<{key: string, example: string}>} presets - Format presets
 * @param {string} parameters - Current input parameters
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteFormat(command, presets, parameters) {
  const term = parameters?.toLowerCase() || '';
  const entries = [];
  const filtered = presets.filter((p) => p.key.toLowerCase().includes(term) || p.example.toLowerCase().includes(term));
  for (const preset of filtered) {
    entries.push(game.chatCommands.createCommandElement(`${command} ${preset.key}`, `<span class="command-title">${preset.key}</span> <span class="notes">${preset.example}</span>`));
  }
  if (!term) entries.push(game.chatCommands.createInfoElement(`<span class="notes">${localize('CALENDARIA.ChatCommander.FormatTokensHint')}</span>`));
  return entries;
}

/**
 * Autocomplete for /date - show format presets.
 * @param {object} _menu - Autocomplete menu instance
 * @param {string} _alias - Command alias used
 * @param {string} parameters - Current input parameters
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteDate(_menu, _alias, parameters) {
  return autocompleteFormat('/date', DATE_FORMAT_PRESETS, parameters);
}

/**
 * Autocomplete for /time - show format presets.
 * @param {object} _menu - Autocomplete menu instance
 * @param {string} _alias - Command alias used
 * @param {string} parameters - Current input parameters
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteTime(_menu, _alias, parameters) {
  return autocompleteFormat('/time', TIME_FORMAT_PRESETS, parameters);
}

/**
 * Autocomplete for /datetime - show format presets.
 * @param {object} _menu - Autocomplete menu instance
 * @param {string} _alias - Command alias used
 * @param {string} parameters - Current input parameters
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteDateTime(_menu, _alias, parameters) {
  return autocompleteFormat('/datetime', DATETIME_FORMAT_PRESETS, parameters);
}

/**
 * Autocomplete for /sunrise - show format presets.
 * @param {object} _menu - Autocomplete menu instance
 * @param {string} _alias - Command alias used
 * @param {string} parameters - Current input parameters
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteSunrise(_menu, _alias, parameters) {
  return autocompleteFormat('/sunrise', TIME_FORMAT_PRESETS, parameters);
}

/**
 * Autocomplete for /sunset - show format presets.
 * @param {object} _menu - Autocomplete menu instance
 * @param {string} _alias - Command alias used
 * @param {string} parameters - Current input parameters
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteSunset(_menu, _alias, parameters) {
  return autocompleteFormat('/sunset', TIME_FORMAT_PRESETS, parameters);
}

/**
 * /festival - Current festival info.
 * @returns {object} Chat message data
 */
function cmdFestival() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const festival = CalendariaAPI.getCurrentFestival();
  if (!festival) return { content: wrapContent(localize('CALENDARIA.ChatCommander.NoFestival')) };
  const icon = festival.icon ? `<i class="${festival.icon}"></i> ` : '<i class="fas fa-star"></i> ';
  return { content: wrapContent(`${icon}<strong>${localize(festival.name)}</strong>`) };
}

/**
 * /weekday - Current weekday info.
 * @returns {object} Chat message data
 */
function cmdWeekday() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const weekday = CalendariaAPI.getCurrentWeekday();
  if (!weekday) return { content: wrapContent(localize('CALENDARIA.ChatCommander.NoWeekday')) };
  const restDay = weekday.isRestDay ? ` (${localize('CALENDARIA.ChatCommander.RestDay')})` : '';
  return { content: wrapContent(`<i class="fas fa-calendar-week"></i> <strong>${localize(weekday.name)}</strong>${restDay}`) };
}

/**
 * /cycle - Zodiac/cycle values.
 * @returns {object} Chat message data
 */
function cmdCycle() {
  const calendar = CalendariaAPI.getActiveCalendar();
  if (!calendar) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  const cycleData = CalendariaAPI.getCycleValues();
  if (!cycleData?.values?.length) return { content: wrapContent(localize('CALENDARIA.ChatCommander.NoCycles')) };
  const lines = cycleData.values.map((cycle) => `• <strong>${cycle.cycleName}:</strong> ${cycle.entryName}`);
  return { content: wrapContent(lines.join('<br>')) };
}
