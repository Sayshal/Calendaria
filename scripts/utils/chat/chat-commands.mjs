import { localize } from '../localization.mjs';
import { canChangeActiveCalendar, canChangeDateTime } from '../permissions.mjs';
import {
  cmdAdvance,
  cmdCalendar,
  cmdCalendars,
  cmdCycle,
  cmdDate,
  cmdDateTime,
  cmdEnrichers,
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
} from './chat-command-handler.mjs';

/** Command patterns for parsing chat input. */
const COMMAND_PATTERNS = {
  date: /^\/(?:date|d)(?:\s+(.*))?$/i,
  time: /^\/(?:time|t)(?:\s+(.*))?$/i,
  datetime: /^\/(?:datetime|dt)(?:\s+(.*))?$/i,
  note: /^\/(?:note|n)(?:\s+(.*))?$/i,
  weather: /^\/weather(?:\s+(.*))?$/i,
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
  cycle: /^\/(?:cycle|zodiac)$/i,
  forecast: /^\/(?:forecast|fc)(?:\s+(\d+))?$/i,
  weatherprob: /^\/(?:weatherprob|wp)(?:\s+(.*))?$/i,
  enrichers: /^\/enrichers$/i
};

/**
 * Handle chatMessage hook to intercept custom commands.
 * @param {object} _chatLog - The ChatLog instance
 * @param {string} message - The raw message content
 * @param {object} _chatData - Chat message data
 * @returns {boolean|void} False to cancel default processing, undefined otherwise
 */
export function onChatMessage(_chatLog, message, _chatData) {
  const trimmed = message
    .replace(/^\s*<p(?:\s[^>]*)?>/i, '')
    .replace(/<\/p>\s*$/i, '')
    .trim();
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
async function handleCommand(cmd, match) {
  const arg = match[1]?.trim() || '';
  const noCalMsg = () => ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoCalendar'));
  const handlers = {
    date: () => sendResult(cmdDate(arg), noCalMsg),
    time: () => sendResult(cmdTime(arg), noCalMsg),
    datetime: () => sendResult(cmdDateTime(arg), noCalMsg),
    note: async () => {
      if (!arg) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoteTitleRequired'));
      try {
        const result = await cmdNote(arg);
        if (!result) return noCalMsg();
        ui.notifications.info(localize('CALENDARIA.ChatCommand.NoteCreated'));
      } catch {
        ui.notifications.error(localize('CALENDARIA.ChatCommand.NoteError'));
      }
    },
    weather: () => {
      const result = cmdWeather(arg);
      if (!result) return noCalMsg();
      if (result.error) return ui.notifications.warn(result.content);
      sendChat(result.content);
    },
    moon: () => sendResult(cmdMoon(arg), noCalMsg),
    season: () => sendResult(cmdSeason(), noCalMsg),
    today: () => sendResult(cmdToday(), noCalMsg),
    sunrise: () => sendResult(cmdSunrise(arg), noCalMsg),
    sunset: () => sendResult(cmdSunset(arg), noCalMsg),
    advance: async () => {
      if (!canChangeDateTime()) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoPermission'));
      try {
        const result = await cmdAdvance(match[1]);
        if (!result) return noCalMsg();
        if (result.error) return ui.notifications.warn(result.content);
        if (result.content) ui.notifications.info(result.content);
      } catch {
        ui.notifications.error(localize('CALENDARIA.ChatCommand.AdvanceError'));
      }
    },
    setdate: async () => {
      if (!canChangeDateTime()) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoPermission'));
      try {
        const result = await cmdSetDate(match[1]);
        if (!result) return noCalMsg();
        if (result.error) return ui.notifications.warn(result.content);
        if (result.content) ui.notifications.info(result.content);
      } catch {
        ui.notifications.error(localize('CALENDARIA.ChatCommand.SetDateError'));
      }
    },
    settime: async () => {
      if (!canChangeDateTime()) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoPermission'));
      try {
        const result = await cmdSetTime(match[1]);
        if (!result) return noCalMsg();
        if (result.error) return ui.notifications.warn(result.content);
        if (result.content) ui.notifications.info(result.content);
      } catch {
        ui.notifications.error(localize('CALENDARIA.ChatCommand.SetTimeError'));
      }
    },
    calendar: () => sendResult(cmdCalendar(), noCalMsg),
    calendars: () => sendResult(cmdCalendars()),
    switchcal: async () => {
      if (!canChangeActiveCalendar()) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.NoPermission'));
      const calendarId = match[1]?.trim();
      if (!calendarId) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.CalendarIdRequired'));
      try {
        const result = await cmdSwitchCal(calendarId);
        if (!result) return ui.notifications.warn(localize('CALENDARIA.ChatCommand.CalendarNotFound'));
        if (result.content) ui.notifications.info(result.content);
      } catch {
        ui.notifications.error(localize('CALENDARIA.ChatCommand.SwitchCalError'));
      }
    },
    festival: () => sendResult(cmdFestival(), noCalMsg),
    weekday: () => sendResult(cmdWeekday(), noCalMsg),
    cycle: () => sendResult(cmdCycle(), noCalMsg),
    forecast: () => {
      const result = cmdForecast(arg);
      if (!result) return noCalMsg();
      if (result.error) return ui.notifications.warn(result.content);
      if (result.whisper) return sendWhisperChat(result.content);
      sendChat(result.content);
    },
    weatherprob: () => {
      const result = cmdWeatherProb(arg);
      if (!result) return noCalMsg();
      if (result.error) return ui.notifications.warn(result.content);
      if (result.whisper) return sendWhisperChat(result.content);
      sendChat(result.content);
    },
    enrichers: async () => {
      const result = await cmdEnrichers();
      if (result?.content) sendChat(result.content);
    }
  };
  await handlers[cmd]?.();
}

/**
 * Send handler result as a chat message, or call fallback if null.
 * @param {object|null} result - Handler result with content string
 * @param {Function} [fallback] - Called when result is null (no calendar)
 * @returns {Promise<void>}
 */
async function sendResult(result, fallback) {
  if (!result) return fallback?.();
  if (result.content) await sendChat(result.content);
}

/**
 * Send a chat message with calendaria styling.
 * @param {string} content - HTML content
 */
async function sendChat(content) {
  await ChatMessage.create({ content: `<div class="calendaria chat-output">${content}</div>`, speaker: ChatMessage.getSpeaker() });
}

/**
 * Send a whisper chat message with calendaria styling (GM-only forecast/prob).
 * @param {string} content - HTML content
 */
async function sendWhisperChat(content) {
  await ChatMessage.create({ content: `<div class="calendaria chat-output">${content}</div>`, speaker: ChatMessage.getSpeaker(), whisper: game.user.isGM ? [game.user.id] : [] });
}
