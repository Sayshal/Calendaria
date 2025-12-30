/**
 * Chat Message Timestamp System
 * Stores world time with chat messages and optionally displays in-game dates.
 * @module ChatTimestamp
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { format, localize } from '../utils/localization.mjs';

const ChatLog = foundry.applications.sidebar.tabs.ChatLog;

/**
 * Hook handler for preCreateChatMessage.
 * Stores current world time and formatted fantasy date in message flags.
 * @param {ChatMessage} message - The chat message being created
 * @param {object} data - The creation data
 * @param {object} options - Creation options
 * @param {string} userId - The creating user's ID
 */
export function onPreCreateChatMessage(message, data, options, userId) {
  const mode = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE);
  if (mode === 'disabled') return;

  const worldTime = game.time.worldTime;
  const fantasyDate = formatWorldTime(worldTime);

  // Store both world time and pre-formatted date in message flags
  message.updateSource({
    [`flags.${MODULE.ID}.worldTime`]: worldTime,
    [`flags.${MODULE.ID}.fantasyDate`]: fantasyDate
  });
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

  const flags = message.flags?.[MODULE.ID];
  if (!flags?.worldTime && !flags?.fantasyDate) return;

  const timestampEl = html.querySelector('.message-timestamp');
  if (!timestampEl) return;

  // Use stored fantasyDate, fallback to computing from worldTime
  const formattedDate = flags.fantasyDate || formatWorldTime(flags.worldTime);
  if (!formattedDate) return;

  if (mode === 'replace') {
    timestampEl.textContent = formattedDate;
  } else if (mode === 'augment') {
    // Create wrapper for inline display: "Fantasy Date (real time)"
    const wrapper = document.createElement('span');
    wrapper.className = 'calendaria-timestamp-wrapper';

    const gameDate = document.createElement('span');
    gameDate.className = 'calendaria-timestamp';
    gameDate.textContent = formattedDate + ' ';

    const realDate = document.createElement('span');
    realDate.className = 'calendaria-timestamp-real';
    realDate.textContent = timestampEl.textContent;

    wrapper.appendChild(gameDate);
    wrapper.appendChild(realDate);

    timestampEl.replaceChildren(wrapper);
  }
}

/**
 * Override ChatLog.prototype.updateTimestamps to prevent Foundry from
 * overwriting our custom timestamps.
 * Call this during the init hook.
 */
export function overrideChatLogTimestamps() {
  const originalUpdateTimestamps = ChatLog.prototype.updateTimestamps;

  ChatLog.prototype.updateTimestamps = function () {
    const mode = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE);
    if (mode === 'disabled') return originalUpdateTimestamps.call(this);

    for (const li of document.querySelectorAll('.chat-message[data-message-id]')) {
      const message = game.messages.get(li.dataset.messageId);
      if (!message?.timestamp) continue;
      const stamp = li.querySelector('.message-timestamp');
      if (!stamp) continue;

      const flags = message.flags?.[MODULE.ID];
      if (flags?.worldTime !== undefined || flags?.fantasyDate) {
        // Use stored fantasyDate, fallback to computing from worldTime
        const formattedDate = flags.fantasyDate || formatWorldTime(flags.worldTime);
        if (formattedDate) {
          // In replace mode: show in-game date, tooltip shows relative time
          if (mode === 'replace') {
            stamp.textContent = formattedDate;
            stamp.dataset.tooltip = foundry.utils.timeSince(message.timestamp);
          }
          // In augment mode: update inline "Fantasy Date (real time)"
          else if (mode === 'augment') {
            const gameDate = stamp.querySelector('.calendaria-timestamp');
            if (gameDate) gameDate.textContent = formattedDate + ' ';
            const realDate = stamp.querySelector('.calendaria-timestamp-real');
            if (realDate) realDate.textContent = foundry.utils.timeSince(message.timestamp);
          }
        }
      } else {
        // No calendaria flag, use default behavior
        stamp.textContent = foundry.utils.timeSince(message.timestamp);
      }
    }
  };
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
  const monthNameRaw = monthData?.name ?? format('CALENDARIA.Calendar.MonthFallback', { num: components.month + 1 });
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
