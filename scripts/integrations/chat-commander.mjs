/**
 * Chat Commander Integration
 * @module Integrations/ChatCommander
 * @author Tyler
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { MODULE } from '../constants.mjs';
import { canAddNotes, canChangeActiveCalendar, canChangeDateTime, format, localize, log } from '../utils/_module.mjs';
import {
  cmdAdvance,
  cmdCalendar,
  cmdCalendars,
  cmdCycle,
  cmdDate,
  cmdDateTime,
  cmdFestival,
  cmdForecast,
  cmdMoon,
  cmdNote,
  cmdSeason,
  cmdSetDate,
  cmdSetTime,
  cmdSunrise,
  cmdSunset,
  cmdSwitchCal,
  cmdTime,
  cmdToday,
  cmdWeather,
  cmdWeatherProb,
  cmdWeekday
} from '../utils/chat/chat-command-handler.mjs';

/** @type {{key: string, example: string}[]} Date format presets for autocomplete. */
const DATE_FORMAT_PRESETS = [
  { key: 'dateLong', example: 'D MMMM, Y' },
  { key: 'dateFull', example: 'EEEE, D MMMM Y' },
  { key: 'dateShort', example: 'D MMM' },
  { key: 'dateUS', example: 'MMMM D, Y' },
  { key: 'dateISO', example: 'YYYY-MM-DD' },
  { key: 'ordinal', example: 'Do of MMMM' },
  { key: 'ordinalEra', example: 'Do of MMMM, Y GGGG' }
];

/** @type {{key: string, example: string}[]} Time format presets for autocomplete. */
const TIME_FORMAT_PRESETS = [
  { key: 'time24', example: 'HH:mm' },
  { key: 'time12', example: 'h:mm A' },
  { key: 'time24Sec', example: 'HH:mm:ss' },
  { key: 'time12Sec', example: 'h:mm:ss A' }
];

/** @type {{key: string, example: string}[]} DateTime format presets for autocomplete. */
const DATETIME_FORMAT_PRESETS = [
  { key: 'datetime24', example: 'D MMMM Y, HH:mm' },
  { key: 'datetime12', example: 'D MMMM Y, h:mm A' },
  { key: 'datetimeShort24', example: 'D MMM, HH:mm' },
  { key: 'datetimeShort12', example: 'D MMM, h:mm A' }
];

/**
 * Wrap content in calendaria styling.
 * @param {string} content - Content to wrap
 * @returns {string} Styled content
 */
function wrapContent(content) {
  return `<div class="calendaria chat-output">${content}</div>`;
}

/**
 * Wrap handler result in calendaria styling, with fallback for null (no calendar).
 * @param {object|null} result - Handler result with content string
 * @returns {object} Chat message data
 */
function wrapResult(result) {
  if (!result) return { content: wrapContent(localize('CALENDARIA.ChatCommand.NoCalendar')) };
  if (!result.content) return {};
  return { content: wrapContent(result.content) };
}

/**
 * Initialize Chat Commander integration.
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
      callback: (_chat, parameters) => wrapResult(cmdDate(parameters?.trim() || '')),
      autocompleteCallback: autocompleteDate
    },
    {
      name: '/time',
      aliases: ['/t'],
      description: localize('CALENDARIA.ChatCommander.TimeDesc'),
      icon: '<i class="fas fa-clock"></i>',
      requiredRole: 'NONE',
      callback: (_chat, parameters) => wrapResult(cmdTime(parameters?.trim() || '')),
      autocompleteCallback: autocompleteTime
    },
    {
      name: '/datetime',
      aliases: ['/dt'],
      description: localize('CALENDARIA.ChatCommander.DateTimeDesc'),
      icon: '<i class="fas fa-calendar-clock"></i>',
      requiredRole: 'NONE',
      callback: (_chat, parameters) => wrapResult(cmdDateTime(parameters?.trim() || '')),
      autocompleteCallback: autocompleteDateTime
    },
    {
      name: '/note',
      aliases: ['/n'],
      description: localize('CALENDARIA.ChatCommander.NoteDesc'),
      icon: '<i class="fas fa-sticky-note"></i>',
      requiredRole: 'NONE',
      callback: async (_chat, parameters) => {
        const args = parameters?.trim() || '';
        if (!args || !canAddNotes()) return {};
        try {
          await cmdNote(args);
        } catch (error) {
          log(1, 'Error creating note:', error);
        }
        return {};
      }
    },
    {
      name: '/weather',
      description: localize('CALENDARIA.ChatCommander.WeatherDesc'),
      icon: '<i class="fas fa-cloud-sun"></i>',
      requiredRole: 'NONE',
      callback: (_chat, parameters) => wrapResult(cmdWeather(parameters?.trim() || '')),
      autocompleteCallback: autocompleteWeather
    },
    {
      name: '/moon',
      description: localize('CALENDARIA.ChatCommander.MoonDesc'),
      icon: '<i class="fas fa-moon"></i>',
      requiredRole: 'NONE',
      callback: (_chat, parameters) => wrapResult(cmdMoon(parameters?.trim() || ''))
    },
    {
      name: '/season',
      description: localize('CALENDARIA.ChatCommander.SeasonDesc'),
      icon: '<i class="fas fa-leaf"></i>',
      requiredRole: 'NONE',
      callback: () => wrapResult(cmdSeason())
    },
    {
      name: '/today',
      description: localize('CALENDARIA.ChatCommander.TodayDesc'),
      icon: '<i class="fas fa-list"></i>',
      requiredRole: 'NONE',
      callback: () => wrapResult(cmdToday())
    },
    {
      name: '/sunrise',
      description: localize('CALENDARIA.ChatCommander.SunriseDesc'),
      icon: '<i class="fas fa-sun"></i>',
      requiredRole: 'NONE',
      callback: (_chat, parameters) => wrapResult(cmdSunrise(parameters?.trim() || '')),
      autocompleteCallback: autocompleteSunrise
    },
    {
      name: '/sunset',
      description: localize('CALENDARIA.ChatCommander.SunsetDesc'),
      icon: '<i class="fas fa-moon"></i>',
      requiredRole: 'NONE',
      callback: (_chat, parameters) => wrapResult(cmdSunset(parameters?.trim() || '')),
      autocompleteCallback: autocompleteSunset
    },
    {
      name: '/advance',
      aliases: ['/adv'],
      description: localize('CALENDARIA.ChatCommander.AdvanceDesc'),
      icon: '<i class="fas fa-forward"></i>',
      requiredRole: 'GAMEMASTER',
      callback: async (_chat, parameters) => {
        if (!canChangeDateTime()) return {};
        try {
          await cmdAdvance(parameters?.trim());
        } catch {
          /* silent */
        }
        return {};
      }
    },
    {
      name: '/setdate',
      description: localize('CALENDARIA.ChatCommander.SetDateDesc'),
      icon: '<i class="fas fa-calendar-plus"></i>',
      requiredRole: 'GAMEMASTER',
      callback: async (_chat, parameters) => {
        if (!canChangeDateTime()) return {};
        try {
          await cmdSetDate(parameters?.trim());
        } catch {
          /* silent */
        }
        return {};
      }
    },
    {
      name: '/settime',
      description: localize('CALENDARIA.ChatCommander.SetTimeDesc'),
      icon: '<i class="fas fa-clock"></i>',
      requiredRole: 'GAMEMASTER',
      callback: async (_chat, parameters) => {
        if (!canChangeDateTime()) return {};
        try {
          await cmdSetTime(parameters?.trim());
        } catch {
          /* silent */
        }
        return {};
      }
    },
    {
      name: '/calendar',
      aliases: ['/cal'],
      description: localize('CALENDARIA.ChatCommander.CalendarDesc'),
      icon: '<i class="fas fa-calendar"></i>',
      requiredRole: 'NONE',
      callback: () => wrapResult(cmdCalendar())
    },
    {
      name: '/calendars',
      aliases: ['/cals'],
      description: localize('CALENDARIA.ChatCommander.CalendarsDesc'),
      icon: '<i class="fas fa-calendars"></i>',
      requiredRole: 'NONE',
      callback: () => wrapResult(cmdCalendars())
    },
    {
      name: '/switchcal',
      description: localize('CALENDARIA.ChatCommander.SwitchCalDesc'),
      icon: '<i class="fas fa-exchange-alt"></i>',
      requiredRole: 'GAMEMASTER',
      callback: async (_chat, parameters) => {
        if (!canChangeActiveCalendar()) return {};
        try {
          await cmdSwitchCal(parameters?.trim());
        } catch {
          /* silent */
        }
        return {};
      },
      autocompleteCallback: autocompleteSwitchCal
    },
    {
      name: '/festival',
      description: localize('CALENDARIA.ChatCommander.FestivalDesc'),
      icon: '<i class="fas fa-star"></i>',
      requiredRole: 'NONE',
      callback: () => wrapResult(cmdFestival())
    },
    {
      name: '/weekday',
      description: localize('CALENDARIA.ChatCommander.WeekdayDesc'),
      icon: '<i class="fas fa-calendar-week"></i>',
      requiredRole: 'NONE',
      callback: () => wrapResult(cmdWeekday())
    },
    {
      name: '/cycle',
      aliases: ['/zodiac'],
      description: localize('CALENDARIA.ChatCommander.CycleDesc'),
      icon: '<i class="fas fa-yin-yang"></i>',
      requiredRole: 'NONE',
      callback: () => wrapResult(cmdCycle())
    },
    {
      name: '/forecast',
      aliases: ['/fc'],
      description: localize('CALENDARIA.ChatCommander.ForecastDesc'),
      icon: '<i class="fas fa-cloud-sun-rain"></i>',
      requiredRole: 'NONE',
      callback: (_chat, parameters) => wrapResult(cmdForecast(parameters?.trim() || '')),
      autocompleteCallback: autocompleteForecast
    },
    {
      name: '/weatherprob',
      aliases: ['/wp'],
      description: localize('CALENDARIA.ChatCommander.WeatherProbDesc'),
      icon: '<i class="fas fa-chart-pie"></i>',
      requiredRole: 'NONE',
      callback: (_chat, parameters) => wrapResult(cmdWeatherProb(parameters?.trim() || '')),
      autocompleteCallback: autocompleteWeatherProb
    }
  ];
  for (const cmd of commands) game.chatCommands.register({ ...cmd, module: MODULE.ID });
  log(3, `Registered ${commands.length} Chat Commander commands`);
}

/**
 * Autocomplete for /switchcal - show available calendars.
 * @param {object} _menu - Autocomplete menu instance
 * @param {string} _alias - Command alias used
 * @param {string} parameters - Current input parameters
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteSwitchCal(_menu, _alias, parameters) {
  const calendars = CalendarManager.getAllCalendarMetadata();
  const term = parameters?.toLowerCase() || '';
  const filtered = calendars.filter((cal) => cal.id.toLowerCase().includes(term) || cal.name.toLowerCase().includes(term));
  return filtered.map((cal) => game.chatCommands.createCommandElement(`/switchcal ${cal.id}`, `<span class="command-title">${cal.name}</span> <span class="notes">(${cal.id})</span>`));
}

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
 * Autocomplete for /date.
 * @param {object} _menu - Chat Commander menu reference
 * @param {string} _alias - Command alias
 * @param {string} parameters - User-typed parameters
 * @returns {HTMLElement[]} Autocomplete suggestion elements
 */
function autocompleteDate(_menu, _alias, parameters) {
  return autocompleteFormat('/date', DATE_FORMAT_PRESETS, parameters);
}

/**
 * Autocomplete for /time.
 * @param {object} _menu - Chat Commander menu reference
 * @param {string} _alias - Command alias
 * @param {string} parameters - User-typed parameters
 * @returns {HTMLElement[]} Autocomplete suggestion elements
 */
function autocompleteTime(_menu, _alias, parameters) {
  return autocompleteFormat('/time', TIME_FORMAT_PRESETS, parameters);
}

/**
 * Autocomplete for /datetime.
 * @param {object} _menu - Chat Commander menu reference
 * @param {string} _alias - Command alias
 * @param {string} parameters - User-typed parameters
 * @returns {HTMLElement[]} Autocomplete suggestion elements
 */
function autocompleteDateTime(_menu, _alias, parameters) {
  return autocompleteFormat('/datetime', DATETIME_FORMAT_PRESETS, parameters);
}

/**
 * Autocomplete for /sunrise.
 * @param {object} _menu - Chat Commander menu reference
 * @param {string} _alias - Command alias
 * @param {string} parameters - User-typed parameters
 * @returns {HTMLElement[]} Autocomplete suggestion elements
 */
function autocompleteSunrise(_menu, _alias, parameters) {
  return autocompleteFormat('/sunrise', TIME_FORMAT_PRESETS, parameters);
}

/**
 * Autocomplete for /sunset.
 * @param {object} _menu - Chat Commander menu reference
 * @param {string} _alias - Command alias
 * @param {string} parameters - User-typed parameters
 * @returns {HTMLElement[]} Autocomplete suggestion elements
 */
function autocompleteSunset(_menu, _alias, parameters) {
  return autocompleteFormat('/sunset', TIME_FORMAT_PRESETS, parameters);
}

/**
 * Autocomplete for /weather - show usage hint.
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteWeather() {
  return [
    game.chatCommands.createCommandElement('/weather', `<span class="command-title">${localize('CALENDARIA.ChatCommander.WeatherCurrent')}</span>`),
    game.chatCommands.createCommandElement('/weather [year] [month] [day]', `<span class="command-title">${localize('CALENDARIA.ChatCommander.WeatherHistorical')}</span>`)
  ];
}

/**
 * Autocomplete for /forecast - show day count options.
 * @param {object} _menu - Autocomplete menu instance
 * @param {string} _alias - Command alias used
 * @param {string} _parameters - Current input parameters
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteForecast(_menu, _alias, _parameters) {
  const maxDays = game.settings.get(MODULE.ID, 'forecastDays') ?? 7;
  const entries = [];
  for (let i = 1; i <= maxDays; i++) {
    const label = i === 1 ? format('CALENDARIA.ChatCommander.ForecastDay', { count: i }) : format('CALENDARIA.ChatCommander.ForecastDays', { count: i });
    entries.push(game.chatCommands.createCommandElement(`/forecast ${i}`, `<span class="command-title">${label}</span>`));
  }
  return entries;
}

/**
 * Autocomplete for /weatherprob - show available seasons.
 * @param {object} _menu - Autocomplete menu instance
 * @param {string} _alias - Command alias used
 * @param {string} parameters - Current input parameters
 * @returns {HTMLElement[]} Autocomplete entries
 */
function autocompleteWeatherProb(_menu, _alias, parameters) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return [];
  const seasons = calendar.seasonsArray ?? [];
  const term = parameters?.toLowerCase() || '';
  const filtered = seasons.filter((s) => localize(s.name).toLowerCase().includes(term));
  return filtered.map((s) => {
    const name = localize(s.name);
    return game.chatCommands.createCommandElement(`/weatherprob ${name}`, `<span class="command-title">${name}</span>`);
  });
}
