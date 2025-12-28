/**
 * Chat Message Timestamp System
 * Stores world time with chat messages and optionally displays in-game dates.
 * @module ChatTimestamp
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';

/**
 * Hook handler for preCreateChatMessage.
 * Stores current world time in message flags.
 * @param {ChatMessage} message - The chat message being created
 * @param {object} data - The creation data
 * @param {object} options - Creation options
 * @param {string} userId - The creating user's ID
 */
export function onPreCreateChatMessage(message, data, options, userId) {
  const mode = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE);
  if (mode === 'disabled') return;

  // Store world time in message flags
  message.updateSource({ [`flags.${MODULE.ID}.worldTime`]: game.time.worldTime });
}

/**
 * Hook handler for renderChatMessageHTML.
 * Replaces or augments the timestamp display with in-game date/time.
 * @param {ChatMessage} message - The chat message document
 * @param {HTMLElement} html - The rendered HTML element
 * @param {object} context - Render context
 */
export function onRenderChatMessageHTML(message, html, context) {
  const mode = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE);
  if (mode === 'disabled') return;

  const worldTime = message.flags?.[MODULE.ID]?.worldTime;
  if (worldTime === undefined) return;

  const timestampEl = html.querySelector('.message-timestamp');
  if (!timestampEl) return;

  const formattedDate = formatWorldTime(worldTime);
  if (!formattedDate) return;

  if (mode === 'replace') {
    timestampEl.textContent = formattedDate;
    timestampEl.classList.add('calendaria-timestamp');
  } else if (mode === 'augment') {
    // Create wrapper for augmented display
    const wrapper = document.createElement('span');
    wrapper.className = 'calendaria-timestamp-wrapper';

    const gameDate = document.createElement('span');
    gameDate.className = 'calendaria-timestamp';
    gameDate.textContent = formattedDate;

    const realDate = document.createElement('span');
    realDate.className = 'calendaria-timestamp-real';
    realDate.textContent = timestampEl.textContent;

    wrapper.appendChild(gameDate);
    wrapper.appendChild(realDate);

    timestampEl.replaceChildren(wrapper);
  }
}

/**
 * Format world time to a readable date string.
 * @param {number} worldTime - The world time in seconds
 * @returns {string} Formatted date string
 */
function formatWorldTime(worldTime) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return '';

  const components = calendar.timeToComponents(worldTime);
  const showTime = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_SHOW_TIME);

  // Get month name
  const monthData = calendar.months?.values?.[components.month];
  const monthNameRaw = monthData?.name ?? `Month ${components.month + 1}`;
  const monthName = localize(monthNameRaw);

  // Calculate display year
  const yearZero = calendar.years?.yearZero ?? 0;
  const displayYear = components.year + yearZero;

  // Format date
  const day = components.dayOfMonth + 1;
  let result = `${day} ${monthName}, ${displayYear}`;

  // Optionally add time
  if (showTime) {
    const h = String(components.hour ?? 0).padStart(2, '0');
    const m = String(components.minute ?? 0).padStart(2, '0');
    result += ` ${h}:${m}`;
  }

  return result;
}
